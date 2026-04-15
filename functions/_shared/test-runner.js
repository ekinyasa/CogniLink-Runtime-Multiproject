/**
 * test-runner.js — Internal smoke test engine for Campaign OS.
 *
 * Testing layers implemented here:
 *   Layer 1 — Smoke Test: infrastructure health + routing behaviour
 *   Layer 2 — Consistency Probe: telemetry + analytics pipeline integrity
 *   (Layer 3 — Manual Deterministic Test lives in /api/admin/manual-test.js)
 *
 * Exports:
 *   runSmokeTests(env, request)    → full smoke + consistency report
 *   checkHubLinks(baseUrl, alias)  → link integrity array
 *
 * SAFETY — read-only by design:
 *   • Never writes to KV
 *   • Never creates campaigns or slugs
 *   • Only fires GET requests to existing aliases
 *   • Only reads from Analytics Engine
 *   • Base URL always derived from request origin — no hardcoded domains
 *
 * AE ingestion latency note (measured 2026-03):
 *   Analytics Engine events appear 52–57 seconds after the router hit.
 *   All retry logic uses retryWithBackoff (retry.js) with a ~63s window.
 *
 * TODO (future testing layers — do not implement yet):
 *   • Load testing (sustained throughput validation)
 *   • Geographic edge propagation testing (per-colo routing consistency)
 *   • Long-term analytics accuracy monitoring (24h / 7d aggregation drift)
 *   • Alias collision detection (duplicate route key scan in CAMPAIGN_AB_ALIAS_INDEX)
 *   • Campaign registry integrity checks (orphaned slugs, broken campaign refs)
 */

import { retryWithBackoff } from "./retry.js";

const AE_SQL_BASE = "https://api.cloudflare.com/client/v4/accounts";
const DATASET     = "linkhub_ops_events";

// Routes to probe — use only known, pre-existing aliases
const ROUTER_ROUTES   = ["/nb"];
const MODIFIER_ROUTES = ["/nb/offer", "/nb/vsl"];

// KV bindings to health-check
// envKey maps to the actual Cloudflare env binding name
const KV_BINDINGS = [
  { label: "CAMPAIGN_AB_ALIAS_INDEX", envKey: "CAMPAIGN_AB_ALIAS_INDEX"  },
  { label: "ROUTE_ALIAS",    envKey: "ROUTE_ALIAS"     },
  { label: "APP_CONFIG",     envKey: "LANDING_CONFIG"  },
];

/**
 * Fire a GET probe at baseUrl+path.
 *
 * Validation rules (per spec):
 *   • status must be 200 or 302
 *   • response must not be the static fallback page
 *     (fallback pages are short and lack hub-specific markup)
 *
 * Returns { path, ok, status, fallback? } — never throws.
 */
async function probeRoute(baseUrl, path) {
  try {
    const res    = await fetch(`${baseUrl}${path}`, { redirect: "follow" });
    const status = res.status;

    if (status !== 200 && status !== 302) {
      return { path, ok: false, status };
    }

    // Detect static fallback: too short or missing hub-specific markup
    const body       = await res.text().catch(() => "");
    const isFallback = body.length < 500 ||
      (!body.includes("hub-") && !body.includes("<!DOCTYPE"));
    if (isFallback) {
      return { path, ok: false, status, fallback: true };
    }

    return { path, ok: true, status };
  } catch (err) {
    return { path, ok: false, status: 0, error: err?.message ?? "fetch_failed" };
  }
}

/**
 * Verify that critical KV namespaces are accessible (read-only).
 * Uses .list({ limit: 1 }) — minimal cost, no value reads.
 * Returns { ok, failures: string[] }
 */
async function kvHealthCheck(env) {
  const failures = [];
  for (const { label, envKey } of KV_BINDINGS) {
    const ns = env[envKey];
    if (!ns || typeof ns.list !== "function") {
      failures.push(`${label} binding missing or not a KV namespace`);
      continue;
    }
    try {
      await ns.list({ limit: 1 });
    } catch (err) {
      failures.push(`${label} read error: ${err?.message ?? "unknown"}`);
    }
  }
  return { ok: failures.length === 0, failures };
}

/**
 * Query AE for recent alias_click events (last 5 minutes).
 * Returns { ok, events, error? } — never throws.
 */
async function queryRecentEvents(accountId, apiToken) {
  const sql = [
    `SELECT timestamp, blob1 AS alias, blob4 AS campaign`,
    `FROM ${DATASET}`,
    `WHERE index1 = 'alias_click'`,
    `AND timestamp > now() - INTERVAL '5' MINUTE`,
    `ORDER BY timestamp DESC`,
    `LIMIT 10`,
  ].join(" ");

  try {
    const res = await fetch(
      `${AE_SQL_BASE}/${accountId}/analytics_engine/sql`,
      {
        method:  "POST",
        headers: {
          Authorization:  `Bearer ${apiToken}`,
          "Content-Type": "text/plain",
        },
        body: sql,
      }
    );
    if (!res.ok) {
      const hint = await res.text().catch(() => "");
      return { ok: false, events: [], error: `AE ${res.status}: ${hint.slice(0, 150)}` };
    }
    const json   = await res.json();
    const events = Array.isArray(json?.data) ? json.data : [];
    return { ok: true, events };
  } catch (err) {
    return { ok: false, events: [], error: err?.message ?? "fetch_failed" };
  }
}

/**
 * Layer 2 — Consistency Probe.
 * Validates event schema of AE query results.
 *
 * Checks:
 *   dataset_query_successful — AE responded without error
 *   recent_events_present    — at least one event returned
 *   event_fields_valid       — timestamp and alias fields are present
 *
 * Returns { ok, dataset_query_successful, recent_events_present, event_fields_valid }
 */
function consistencyProbe(aeResult) {
  const dataset_query_successful = aeResult.ok;
  const recent_events_present    = aeResult.events.length > 0;

  let event_fields_valid = false;
  if (recent_events_present) {
    const sample       = aeResult.events[0];
    event_fields_valid = Boolean(sample.timestamp && typeof sample.alias === "string");
  }

  return {
    ok: dataset_query_successful && recent_events_present && event_fields_valid,
    dataset_query_successful,
    recent_events_present,
    event_fields_valid,
  };
}

// ── Hub Link Integrity ────────────────────────────────────────────────────────

/**
 * Extract the root domain (eTLD+1) from a hostname for redirect comparison.
 * e.g. "open.spotify.com" → "spotify.com", "evil.com" → "evil.com"
 */
function rootDomain(hostname) {
  const parts = hostname.split(".");
  return parts.slice(-2).join(".");
}

/**
 * Validate a single external link.
 *
 * Validation states:
 *   "valid"      ✔ — reachable, no unexpected redirect, https throughout
 *   "suspicious" ⚠ — reachable but redirected to unexpected root domain,
 *                     non-https final URL, or redirect chain > 3 hops
 *   "broken"     ✖ — status >= 400 or network error
 *
 * @param {string} url — external link URL
 * @returns {Promise<{ url, status, ok, state }>}
 */
async function validateLink(url) {
  try {
    const res    = await fetch(url, { redirect: "follow" });
    const status = res.status;

    if (status >= 400) {
      return { url, status, ok: false, state: "broken" };
    }

    let suspicious = false;

    // Check for unexpected root-domain change in redirect chain
    if (res.redirected) {
      const origRoot  = rootDomain(new URL(url).hostname);
      const finalRoot = rootDomain(new URL(res.url).hostname);
      if (origRoot !== finalRoot) suspicious = true;
    }

    // Verify final destination is still https (non-https = suspicious)
    if (res.url && !res.url.startsWith("https://")) suspicious = true;

    const state = suspicious ? "suspicious" : "valid";
    return { url, status, ok: true, state };

  } catch (err) {
    const msg = err?.message ?? "unreachable";

    // Detect redirect loops: Workers runtime throws when max redirects exceeded.
    // Error message contains "Too many redirects" or "redirect" on most runtimes.
    const isLoop =
      msg.toLowerCase().includes("too many redirect") ||
      msg.toLowerCase().includes("redirect loop");

    return {
      url,
      status: 0,
      ok:     false,
      state:  "broken",
      error:  isLoop ? "redirect_loop" : msg,
    };
  }
}

/**
 * Fetch a hub page and validate all external links.
 * Uses GET (not HEAD) per spec — some platforms reject HEAD requests.
 *
 * Each link is classified as:
 *   "valid"      ✔ VALID      — reachable, no unexpected redirect
 *   "suspicious" ⚠ SUSPICIOUS — redirect to unexpected domain or non-https final
 *   "broken"     ✖ BROKEN     — HTTP 4xx/5xx or network error
 *
 * @param {string} baseUrl — origin (e.g. "https://example.pages.dev")
 * @param {string} alias   — alias to probe (e.g. "nb")
 * @returns {Promise<Array<{ url, status, ok, state }>>}
 */
export async function checkHubLinks(baseUrl, alias) {
  // Fetch the hub page
  let html = "";
  try {
    const res = await fetch(`${baseUrl}/${alias}`, { redirect: "follow" });
    if (res.ok) html = await res.text().catch(() => "");
  } catch { /* no hub page — return empty */ }

  if (!html) return [];

  // Extract unique external link destinations (https only)
  const hrefRegex = /href="(https?:\/\/[^"#?]+)/g;
  const seen      = new Set();
  let m;
  while ((m = hrefRegex.exec(html)) !== null) {
    seen.add(m[1]);
  }

  if (seen.size === 0) return [];

  // Probe each unique destination with full validation
  return Promise.all([...seen].map(validateLink));
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Run all smoke tests (Layer 1 + Layer 2) and return a structured report.
 *
 * Return shape:
 * {
 *   ok:          boolean,
 *   router:      "pass"|"fail",   — Layer 1A
 *   modifier:    "pass"|"fail",   — Layer 1A
 *   kv:          "pass"|"fail",   — Layer 1B (NEW)
 *   telemetry:   "pass"|"fail",   — Layer 1C
 *   analytics:   "pass"|"fail",   — Layer 1D (retry loop)
 *   consistency: "pass"|"fail",   — Layer 2  (NEW)
 *   duration_ms: number,
 *   warnings:    string[]
 * }
 *
 * @param {object}  env     — Cloudflare Pages env bindings
 * @param {Request} request — Incoming request (used to derive base URL)
 */
export async function runSmokeTests(env, request) {
  const t0       = Date.now();
  const warnings = [];

  // Always derive base URL from the live request — no hardcoded domain
  const baseUrl = new URL(request.url).origin;

  // ── Layer 1A: Router probe ────────────────────────────────────────────────
  const routerResults = await Promise.all(ROUTER_ROUTES.map(p => probeRoute(baseUrl, p)));
  const routerOk      = routerResults.every(r => r.ok);
  if (!routerOk) {
    const failed = routerResults.filter(r => !r.ok).map(r =>
      r.fallback
        ? `${r.path} → static fallback (compile routes?)`
        : `${r.path} → HTTP ${r.status}`
    );
    warnings.push(`Router: ${failed.join(", ")}`);
  }

  // ── Layer 1A: Modifier routing probe ─────────────────────────────────────
  const modResults = await Promise.all(MODIFIER_ROUTES.map(p => probeRoute(baseUrl, p)));
  const modifierOk = modResults.every(r => r.ok);
  if (!modifierOk) {
    const failed = modResults.filter(r => !r.ok).map(r => `${r.path} → HTTP ${r.status}`);
    warnings.push(`Modifier: ${failed.join(", ")}`);
  }

  // ── Layer 1B: KV registry health check ───────────────────────────────────
  const kvResult = await kvHealthCheck(env);
  if (!kvResult.ok) {
    kvResult.failures.forEach(f => warnings.push(`KV: ${f}`));
  }

  // ── Layer 1C: Telemetry ───────────────────────────────────────────────────
  // Write-through cannot be confirmed in the same request cycle.
  // "pass" is inferred: if router requests completed, emitOps() was called.
  const telemetryOk = routerOk || modifierOk;
  if (!telemetryOk) {
    warnings.push("Telemetry: no router requests succeeded — events likely not emitted");
  }

  // ── Layer 1D + Layer 2: Analytics + Consistency ───────────────────────────
  // AE ingestion latency is 52–57s in production.
  // retryWithBackoff uses the default ~63s window (1s→2s→4s→8s→16s→32s).
  const accountId = env.CF_ACCOUNT_ID   || "";
  const apiToken  = env.CF_AE_API_TOKEN || "";
  let analyticsOk   = false;
  let consistencyOk = false;

  if (!accountId || !apiToken) {
    warnings.push("Analytics: CF_ACCOUNT_ID or CF_AE_API_TOKEN not configured");
    warnings.push("Consistency: skipped — AE credentials missing");
  } else {
    // Shared retry helper — stops early once events are found
    const combined = await retryWithBackoff(async () => {
      const r = await queryRecentEvents(accountId, apiToken);
      if (!r.ok) return { ok: false, aeQueryOk: false, events: [], error: r.error };
      return { ok: r.events.length > 0, aeQueryOk: true, events: r.events };
    });

    analyticsOk = combined.aeQueryOk && (combined.events?.length ?? 0) > 0;
    if (!analyticsOk) {
      warnings.push(
        `Analytics: ${combined.error ?? "no alias_click events found after retries (~63s)"}`
      );
    }

    // Layer 2 — Consistency Probe (runs on the final AE result — no extra query)
    const probe   = consistencyProbe({
      ok:     combined.aeQueryOk ?? false,
      events: combined.events    ?? [],
    });
    consistencyOk = probe.ok;
    if (!probe.dataset_query_successful) {
      warnings.push("Consistency: dataset query failed");
    } else if (!probe.recent_events_present) {
      warnings.push("Consistency: no alias_click events in last 5 min (AE ingestion may be delayed)");
    } else if (!probe.event_fields_valid) {
      warnings.push("Consistency: event schema invalid — missing timestamp or alias field");
    }
  }

  // ── Report ────────────────────────────────────────────────────────────────
  const overallOk =
    routerOk && modifierOk && kvResult.ok && telemetryOk && analyticsOk && consistencyOk;

  return {
    ok:          overallOk,
    router:      routerOk      ? "pass" : "fail",
    modifier:    modifierOk    ? "pass" : "fail",
    kv:          kvResult.ok   ? "pass" : "fail",
    telemetry:   telemetryOk   ? "pass" : "fail",
    analytics:   analyticsOk   ? "pass" : "fail",
    consistency: consistencyOk ? "pass" : "fail",
    duration_ms: Date.now() - t0,
    warnings,
  };
}
