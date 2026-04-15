/**
 * functions/t.js — Minimal experiment telemetry endpoint.
 *
 * GET /t?e=<event>&exp=<experiment>&v=<variant>[&alias=<alias>][&link_id=<link_id>]
 *
 * Receives fire-and-forget telemetry pings from:
 *   • the edge router  (server-side exposure, via fetch + keepalive)
 *   • the hub page     (client-side click,    via navigator.sendBeacon / fetch)
 *   • checkout pages   (client-side conversion, via script tag or fetch)
 *
 * Design constraints (Prompt 56):
 *   1. Always returns HTTP 200 immediately — telemetry must never block callers.
 *   2. All KV writes are fire-and-forget via context.waitUntil().
 *   3. Invalid or missing params fail silently — no 4xx/5xx exposed.
 *   4. No heavy dependencies; pure Workers + KV.
 *
 * KV key formats:
 *   telemetry:exp:<experiment>:<variant>:<event>    — lightweight counters (all events)
 *   exp:<experiment>:<variant>:conversion:<shard>   — sharded counters (conversion, read by panel)
 *   dedup:conv:<experiment>:<variant>:<ua_hash>     — 30-min dedup gate (conversion only)
 *
 * Prompt 64 additions:
 *   • alias + link_id optional params (enriches AE event payload)
 *   • UA hash computed for conversion dedup + AE payload
 *   • Conversion dedup: 30-min TTL key; duplicate conversions silently ignored
 *   • incrementExpCounter called for conversion events so admin panel reflects reality
 */

import { incrementExpCounter } from "./_shared/exp-counter.js";
import { maybeRebalance } from "./_shared/bandit-rebalance.js";

// Production telemetry model:
// - KV keeps lightweight counters for experiments (fast reads for bandit / dashboards)
// - Analytics Engine (if bound) receives raw events for later analysis
// - Both are fire-and-forget; failure must never affect the caller

/** Allowed event types — any other value is silently dropped. */
const VALID_EVENTS = new Set(["exposure", "click", "conversion"]);

/**
 * Validate and sanitize a telemetry parameter value.
 * Allows: letters, digits, dash, underscore, dot, colon — max 200 chars.
 * Returns the value unchanged, or "" if it fails validation.
 *
 * @param {string|null} v
 * @returns {string}
 */
function sanitize(v) {
  if (typeof v !== "string" || v.length === 0 || v.length > 200) return "";
  return /^[a-zA-Z0-9_:.-]+$/.test(v) ? v : "";
}

/**
 * Compute an 8-byte (16 hex char) SHA-256 prefix of the User-Agent string.
 * Used as a lightweight anonymous fingerprint for conversion deduplication.
 * Non-identifying — only the first 8 bytes are retained.
 *
 * @param {string} userAgent
 * @returns {Promise<string>}  16-character hex string, or "unknown" on failure
 */
async function computeUaHash(userAgent) {
  try {
    const encoded = new TextEncoder().encode(userAgent || "");
    const hashBuf = await crypto.subtle.digest("SHA-256", encoded);
    const bytes = new Uint8Array(hashBuf);
    return Array.from(bytes.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch (_) {
    return "unknown";
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;

  // ── Respond immediately — telemetry must never block callers ──────────────
  // The KV write is scheduled via waitUntil() so the Worker stays alive
  // long enough to flush, but the HTTP response is returned right now.
  const respond = () =>
    new Response("ok", {
      status: 200,
      headers: {
        "Content-Type": "text/plain;charset=UTF-8",
        "Cache-Control": "no-store",
      },
    });

  // ── Parse + validate query params ─────────────────────────────────────────
  let e, exp, v, alias, linkId, ev, cid;
  try {
    const url = new URL(request.url);
    e = url.searchParams.get("e") || "";
    exp = url.searchParams.get("exp") || "";
    v = url.searchParams.get("v") || "";
    alias = url.searchParams.get("alias") || "";
    linkId = url.searchParams.get("link_id") || "";
    ev = url.searchParams.get("ev") || "";
    cid = url.searchParams.get("cid") || "";
  } catch (_) {
    return respond(); // malformed URL — silent no-op
  }

  // Sanitize required values — drop request silently if any is invalid
  e = sanitize(e);
  exp = sanitize(exp);
  v = sanitize(v);

  // Optional params: sanitize but don't gate on them
  alias = sanitize(alias);
  linkId = sanitize(linkId);
  ev = sanitize(ev);
  cid = sanitize(cid);

  if (!ev && e === "conversion") ev = "conversion";

  if (!VALID_EVENTS.has(e) || !exp || !v) {
    return respond();
  }

  // ── Conversion-only pre-processing ────────────────────────────────────────
  // UA hash is computed once and shared by dedup + AE payload.
  let uaHash = "";
  if (e === "conversion") {
    uaHash = await computeUaHash(request.headers.get("User-Agent") || "");

    // ── Deduplication gate (Prompt 64 — Prompt 66: writes to GUARD_CACHE) ──
    // A 30-minute TTL key prevents the same browser from double-counting a
    // conversion on page reload or Kartra script re-fires.
    // The gate is best-effort — if KV is unavailable we allow the write through
    // rather than silently dropping legitimate conversions.
    if (env?.GUARD_CACHE) {
      try {
        const ip = request.headers.get("CF-Connecting-IP") || "unknown";
        const dedupKey = `dedup:conv:${exp}:${v}:${uaHash}:${ip}`;
        const existing = await env.GUARD_CACHE.get(dedupKey, { type: "text" });
        if (existing !== null) {
          // Duplicate within 30-minute window — acknowledge but discard
          return respond();
        }
        // Mark as seen for 30 minutes (1800 seconds)
        await env.GUARD_CACHE.put(dedupKey, "1", { expirationTtl: 1800 });
      } catch (_) {
        // Dedup failure: allow the write through (availability > exactness)
      }
    }
  }

  // ── KV counter: exp:* sharded (conversion only — read by admin panel) ─────
  // The admin experiment panel reads exp:<alias>:<slug>:conversion:<shard>
  // via getExpCounters().  Writing here keeps panel data consistent with
  // conversions that arrive via /t (e.g. from Kartra thank-you pages).
  // Only conversion events need this bridge — exposure and click are already
  // written by the edge router directly via incrementExpCounter.
  if (e === "conversion") {
    context.waitUntil(incrementExpCounter(env, exp, v, "conversion"));
    // ── Bandit rebalance trigger (P79) ───────────────────────────────────────
    // Every conversion is a reliable signal — wire it directly to maybeRebalance.
    // exp = experiment identifier (maps to ab_config:<exp> in AB_INDEX).
    // maybeRebalance is guarded internally (cooldown, strategy, eligibility gates).
    context.waitUntil(maybeRebalance(env, exp, "conversion"));
  }

  // ── Breakdown counters: conv:alias:* + conv:link:* (Prompt 65) ────────────
  // Powers the "Conversion by Alias" and "Conversion by Hub Link" panels on
  // the experiments dashboard.  Written only when the optional query params
  // are present.  Both are fire-and-forget via context.waitUntil().
  //
  // Key format:
  //   conv:alias:<experiment>:<alias>     — conversions from a specific entry link
  //   conv:link:<experiment>:<link_id>    — conversions after clicking a hub button
  if (e === "conversion" && env?.ANALITICS_DATA && (alias || linkId)) {
    context.waitUntil((async () => {
      const writes = [];
      if (alias) {
        const k = `conv:alias:${exp}:${alias}`;
        writes.push(
          env.ANALITICS_DATA.get(k, { type: "text" })
            .then((cur) => env.ANALITICS_DATA.put(k, String((parseInt(cur || "0", 10) || 0) + 1)))
            .catch(() => { })
        );
      }
      if (linkId) {
        const k = `conv:link:${exp}:${linkId}`;
        writes.push(
          env.ANALITICS_DATA.get(k, { type: "text" })
            .then((cur) => env.ANALITICS_DATA.put(k, String((parseInt(cur || "0", 10) || 0) + 1)))
            .catch(() => { })
        );
      }
      await Promise.all(writes);
    })());
  }

  // ── Analytics Engine event log (optional binding) ──────────────────────────
  // Enriched payload includes alias, link_id, ua_hash (for conv), ev, and cid.
  if (env?.AE_EXPERIMENT) {
    try {
      env.AE_EXPERIMENT.writeDataPoint({
        blobs: [exp, v, e, alias, linkId, uaHash, ev, cid],
        doubles: [Date.now()],
      });
    } catch (err) {
      console.log("telemetry analytics error", String(err?.stack || err));
    }
  }

  return respond();
}
