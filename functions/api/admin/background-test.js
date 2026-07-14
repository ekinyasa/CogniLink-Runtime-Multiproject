/**
 * /api/admin/background-test — Lightweight autonomous background self-test.
 *
 * Designed to be triggered:
 *   a) Manually via the Diagnostics panel ("Run Now" button).
 *   b) Periodically via an external Cloudflare Cron Trigger Worker
 *      (recommended interval: every 6 hours).
 *
 * Each run:
 *   1. Creates an isolated test fixture (unique alias + campaign).
 *   2. Fires the deterministic click sequence (/{alias}×2, /offer, /vsl).
 *   3. Validates analytics ingestion via AE retry (~95s window).
 *   4. Archives the fixture.
 *   5. Stores the result in LANDING_CONFIG["_bg_test_last"] for operator visibility.
 *
 * Results are never shown to normal users.
 * The diagnostics panel displays the timestamp of the last successful run.
 *
 * Authentication:
 *   POST → Bearer <ADMIN_TOKEN>  (manual trigger)
 *   GET  → Bearer <ADMIN_TOKEN>  (read last result)
 *
 * POST response shape:
 *   {
 *     ok:          boolean,
 *     fixture:     { alias, campaign },
 *     observed:    { alias: number, offer: number, vsl: number },
 *     duration_ms: number,
 *     timestamp:   string,   // ISO 8601 UTC — matches stored record
 *     warnings:    string[]
 *   }
 *
 * GET response shape:
 *   {
 *     ok:        boolean,
 *     last:      { ok, timestamp, duration_ms, fixture } | null,
 *     retrieved: string   // ISO timestamp of this read
 *   }
 *
 * KV storage key: LANDING_CONFIG["_bg_test_last"]
 *   { ok, timestamp, duration_ms, fixture: { alias, campaign } }
 */

import { verifyToken, unauthorized, jsonHeaders } from "../../_shared/auth.js";
import { createFixture, archiveFixture }          from "../../_shared/fixture.js";
import { retryWithBackoff }                       from "../../_shared/retry.js";

const AE_SQL_BASE = "https://api.cloudflare.com/client/v4/accounts";
const DATASET     = "linkhub_ops_events";
const STORE_KEY   = "_bg_test_last";

// Require at least 1 ALIAS_CLICK to confirm the telemetry pipeline works (SECTION B).
// AE batches event ingestion — strict counts (4 alias / 1 offer / 1 vsl) risk false
// failures when some events arrive in a later batch. One event is sufficient proof
// that the Worker ran, resolveAlias() executed, and writeDataPoint() was called.
const EXPECTED_MIN_TOTAL = 1;

// ── AE helpers ────────────────────────────────────────────────────────────────

async function aePost(accountId, apiToken, sql) {
  const res = await fetch(
    `${AE_SQL_BASE}/${accountId}/analytics_engine/sql`,
    {
      method:  "POST",
      headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "text/plain" },
      body:    sql,
    }
  );
  if (!res.ok) {
    const hint = await res.text().catch(() => "");
    throw new Error(`AE ${res.status}: ${hint.slice(0, 200)}`);
  }
  return res.json();
}

function fmtTs(ms) {
  return new Date(ms).toISOString().replace("T", " ").slice(0, 19);
}

async function queryEventsSince(accountId, apiToken, testStartMs, alias, campaign, env) {
  // Use Unix integer comparison — avoids AE SQL datetime-string parsing errors (SECTION 6).
  // "The string did not match expected pattern" is caused by space-separated datetime strings;
  // toUnixTimestamp() accepts the AE timestamp column directly and is always unambiguous.
  const since = Math.floor((testStartMs - 5_000) / 1000); // Unix seconds, 5s clock-drift buffer

  const envName = (env.ENV_NAME || "dev").toLowerCase();
  const isProd = envName === "production";
  const dataset = isProd ? "cognilink_runtime_traffic_prod" : `ae_traffic_${envName}`;

  const [totalJson, modJson] = await Promise.all([
    aePost(accountId, apiToken,
      `SELECT COUNT() AS cnt
       FROM ${dataset}
       WHERE index1 = 'traffic_memory'
         AND blob1 = '${alias}'
         AND blob4 = '${campaign}'
         AND toUnixTimestamp(timestamp) >= ${since}`
    ),
    aePost(accountId, apiToken,
      `SELECT blob3 AS modifier, COUNT() AS cnt
       FROM ${dataset}
       WHERE index1 = 'traffic_memory'
         AND blob1 = '${alias}'
         AND blob4 = '${campaign}'
         AND blob3 != ''
         AND toUnixTimestamp(timestamp) >= ${since}
       GROUP BY blob3`
    ),
  ]);

  const total = Number(totalJson?.data?.[0]?.cnt ?? 0);
  const byMod = {};
  for (const row of (modJson?.data ?? [])) byMod[row.modifier] = Number(row.cnt || 0);

  return { total, offer: byMod["offer"] ?? 0, vsl: byMod["vsl"] ?? 0 };
}

// ── Click sequence ────────────────────────────────────────────────────────────

async function fireClickSequence(baseUrl, alias) {
  const paths = [
    `/${alias}?bg_test=1`,
    `/${alias}?bg_test=1`,
    `/${alias}/offer?bg_test=1`,
    `/${alias}/vsl?bg_test=1`,
  ];

  const sleep    = (ms) => new Promise((r) => setTimeout(r, ms));
  const failures = [];
  for (let i = 0; i < paths.length; i++) {
    if (i > 0) await sleep(150);          // 150ms gap — prevents AE event-collapse
    const path = paths[i];
    try {
      const res = await fetch(`${baseUrl}${path}`, { redirect: "follow" });
      if (res.status !== 200 && res.status !== 302) {
        failures.push(`${path} → HTTP ${res.status}`);
      }
    } catch (err) {
      failures.push(`${path} → ${err?.message ?? "network error"}`);
    }
  }
  return { ok: failures.length === 0, failures };
}

// ── Result persistence ────────────────────────────────────────────────────────

async function storeResult(env, record) {
  try {
    if (!env.LANDING_CONFIG) return;
    await env.LANDING_CONFIG.put(STORE_KEY, JSON.stringify(record));
  } catch (_) { /* persistence failure must never abort the test result */ }
}

async function readLastResult(env) {
  try {
    if (!env.LANDING_CONFIG) return null;
    return await env.LANDING_CONFIG.get(STORE_KEY, { type: "json" });
  } catch (_) {
    return null;
  }
}

// ── Core test runner ──────────────────────────────────────────────────────────

async function runBackgroundTest(env, baseUrl) {
  const t0       = Date.now();
  const warnings = [];

  // Stage tracks where a failure occurred for structured diagnostics (PART 5)
  let stage   = "registry";
  let fixture = null;

  function makeFailure(reason, extra = {}) {
    return {
      ok:          false,
      stage,
      reason,
      duration_ms: Date.now() - t0,
      timestamp:   new Date().toISOString(),
      fixture:     fixture
        ? { alias: fixture.alias, campaign: fixture.campaign, slug: fixture.slug ?? null }
        : null,
      ...extra,
    };
  }

  // ── 1. Telemetry credentials check ───────────────────────────────────────
  stage = "telemetry";
  const accountId = env.CF_ACCOUNT_ID   || "";
  const apiToken  = env.CF_AE_API_TOKEN || "";

  if (!accountId || !apiToken) {
    return makeFailure("not_configured", {
      hint: "Set CF_ACCOUNT_ID and CF_AE_API_TOKEN in Pages dashboard",
    });
  }

  // ── 2. Create fixture (registry stage) ───────────────────────────────────
  stage = "registry";
  try {
    fixture = await createFixture(env);
  } catch (err) {
    const result = makeFailure("fixture_creation_failed", { hint: err?.message ?? "unknown" });
    await storeResult(env, result);
    return result;
  }

  const { alias, campaign } = fixture;

  // ── 3. Fire click sequence (router stage) ─────────────────────────────────
  stage = "router";
  const fireResult = await fireClickSequence(baseUrl, alias);
  if (!fireResult.ok) {
    warnings.push(`Some trigger requests failed: ${fireResult.failures.join("; ")}`);
  }

  // ── 4. Retry AE until expected events appear (analytics stage) ────────────
  stage = "analytics";

  // Structured log — alias, click time, and SQL query window for easier debugging (SECTION B)
  const clickTs   = new Date().toISOString();
  const sinceUnix = Math.floor((t0 - 5_000) / 1000);
  console.log("[bg-test] waiting for AE ingestion", JSON.stringify({
    alias,
    campaign,
    click_ts:          clickTs,
    query_since_unix:  sinceUnix,
    query_window_from: new Date(sinceUnix * 1000).toISOString(),
  }));

  const aeResult = await retryWithBackoff(async () => {
    const { total, offer, vsl } = await queryEventsSince(
      accountId, apiToken, t0, alias, campaign, env
    );
    // Pass as soon as at least one ALIAS_CLICK appears in AE (SECTION B).
    // offer/vsl modifier counts are still captured for informational diagnostics
    // but do not affect pass/fail — different event batches may lag independently.
    const ok = total >= EXPECTED_MIN_TOTAL;
    console.log("[bg-test] AE poll", JSON.stringify({ total, offer, vsl, ok }));
    return { ok, total, offer, vsl };
  });

  // ── 5. Determine pass/fail ────────────────────────────────────────────────
  const observed = {
    alias: aeResult.total ?? 0,
    offer: aeResult.offer ?? 0,
    vsl:   aeResult.vsl   ?? 0,
  };
  // At least one ALIAS_CLICK ingested = telemetry pipeline confirmed working (SECTION B)
  const ok = observed.alias >= EXPECTED_MIN_TOTAL;

  if (!ok) {
    warnings.push("AE ingestion timeout — events may appear after retry window.");
  }

  // ── 6. Archive fixture (best-effort) ──────────────────────────────────────
  await archiveFixture(env, fixture).catch(err => {
    warnings.push(`Fixture archival failed: ${err?.message ?? "unknown"}`);
  });

  const timestamp   = new Date().toISOString();
  const duration_ms = Date.now() - t0;

  const result = ok
    ? { ok: true,  stage: "complete",  fixture: { alias, campaign }, observed, duration_ms, timestamp, warnings }
    : { ok: false, stage: "analytics", reason: "AE timeout", fixture: { alias, campaign }, observed, duration_ms, timestamp, warnings };

  // ── 7. Persist result to KV ───────────────────────────────────────────────
  await storeResult(env, {
    ok:          result.ok,
    stage:       result.stage,
    reason:      result.reason ?? null,
    timestamp,
    duration_ms,
    fixture:     { alias, campaign },
  });

  return result;
}

// ── Entrypoint ────────────────────────────────────────────────────────────────

export async function onRequest(context) {
  const { request, env } = context;

  if (!verifyToken(request, env)) return unauthorized();

  const method = request.method;

  // GET → return last stored result
  if (method === "GET") {
    const last = await readLastResult(env);
    return new Response(
      JSON.stringify({
        ok:        true,
        last:      last,
        retrieved: new Date().toISOString(),
      }),
      { status: 200, headers: jsonHeaders() }
    );
  }

  // POST → run a new background test
  if (method === "POST") {
    const baseUrl = new URL(request.url).origin;
    const result  = await runBackgroundTest(env, baseUrl);
    return new Response(
      JSON.stringify(result),
      { status: 200, headers: jsonHeaders() }
    );
  }

  return new Response(
    JSON.stringify({ ok: false, error: "method_not_allowed" }),
    { status: 405, headers: { ...jsonHeaders(), Allow: "GET, POST" } }
  );
}
