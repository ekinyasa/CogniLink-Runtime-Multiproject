/**
 * functions/api/experiment/conversion.js — Manual conversion ping (Prompt 69 S4).
 *
 * POST /api/experiment/conversion
 *
 * Public endpoint — no auth required.
 * Intended for thank-you pages to fire a lightweight conversion ping after a user
 * completes a desired action (e.g. form submit, purchase).
 *
 * Payload:  { alias, variant }
 *   alias   — experiment alias   (e.g. "abrand45")
 *   variant — winning slug       (e.g. "ab-rand-45-igbio")
 *
 * Behavior:
 *   1. Increments the sharded ANALITICS_DATA counter so that
 *      GET /api/experiments?alias=<alias> reads the correct totals.
 *      Key format: exp:<alias>:<variant>:conversion:<shard>
 *      (same format as exp-counter.js / t.js — single source of truth).
 *   2. Also increments a simple AB_INDEX counter used only for
 *      the response `total` field (fast single-key read, no N-shard scan).
 *
 * TODO: Add session deduplication (cookie / fingerprint) in a future prompt to
 *       prevent double-counting refreshes on thank-you pages.
 *
 * KV writes:
 *   ANALITICS_DATA["exp:<alias>:<variant>:conversion:<shard>"] (stats panel)
 *   AB_INDEX["conv:<alias>:<variant>"]                    (response total)
 *
 * Response 200: { ok: true, alias, variant, total }
 * Response 400: { error: "alias_and_variant_required" }
 * Response 503: { error: "CAMPAIGN_REGISTRY_not_bound" }
 */

import { incrementExpCounter }  from "../../_shared/exp-counter.js";
import { readCookie, buildSetCookie }           from "../../_shared/cookie-utils.js";
import { parseUserState, serializeUserState, updateUserState } from "../../_shared/user-state.js";
import { maybeRebalance }       from "../../_shared/bandit-rebalance.js";

// ── Resolve variant from attribution cookie (Prompt 70 T2) ────────────────────
// Reads experiment_<alias> set by the router (7-day TTL, httpOnly:false).
// Returns the variant slug, or null when the cookie is absent / malformed.
function resolveVariantFromCookie(request, alias) {
  const raw = readCookie(request, "experiment_" + alias);
  if (!raw) return null;
  try {
    const data = JSON.parse(decodeURIComponent(raw));
    if (typeof data.variant === "string" && data.variant) return data.variant;
  } catch (_) {}
  return null;
}

const JSON_HEADERS = {
  "Content-Type":           "application/json;charset=UTF-8",
  "Cache-Control":          "no-store",
  "X-Content-Type-Options": "nosniff",
  "Access-Control-Allow-Origin": "*",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export async function onRequestPost(context) {
  const { request, env, waitUntil } = context;

  if (!env.AB_INDEX) {
    return json({ error: "CAMPAIGN_REGISTRY_not_bound" }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: "invalid_json" }, 400);
  }

  const alias = typeof body.alias === "string" ? body.alias.trim().toLowerCase() : "";
  if (!alias) return json({ error: "alias_required" }, 400);
  if (alias.length > 64) return json({ error: "field_too_long" }, 400);

  // Prompt 70 T3 — variant is now optional.
  // Priority: 1) explicit payload field  2) experiment_<alias> cookie
  let variant = typeof body.variant === "string" ? body.variant.trim().toLowerCase() : "";
  let source  = "payload";

  if (!variant) {
    // Fall back to the attribution cookie written by the router (Prompt 70 T1).
    const fromCookie = resolveVariantFromCookie(request, alias);
    if (!fromCookie) {
      // No variant in payload and no cookie — cannot attribute; ignore silently.
      return json({ ok: false, reason: "no_variant" });
    }
    variant = fromCookie;
    source  = "cookie";
  }

  if (variant.length > 64) return json({ error: "field_too_long" }, 400);

  // Prompt 70 T5 — attribution debug log (development aid).
  console.log("[conversion]", JSON.stringify({ alias, variant, source }));

  // Write sharded counter to ANALITICS_DATA so GET /api/experiments
  // sees the correct conversion totals. Fire-and-forget — same pattern as t.js.
  // incrementExpCounter is a no-op when ANALITICS_DATA is not bound.
  waitUntil(incrementExpCounter(env, alias, variant, "conversion"));

  // Prompt 71 T5 — Epsilon-greedy rebalance trigger.
  // Fire-and-forget: every conversion is a learning signal.
  // maybeRebalance() guards internally with a 5-minute cooldown and only
  // acts on experiments with strategy:"epsilon" in RUNNING state.
  waitUntil(maybeRebalance(env, alias, "conversion"));

  // Also maintain a simple AB_INDEX counter for the response `total`
  // field (fast single-key read; avoids summing N shards on every ping).
  const key = `conv:${alias}:${variant}`;
  let count = 0;
  try {
    const current = await env.AB_INDEX.get(key, { type: "text" });
    count = current ? (parseInt(current, 10) || 0) : 0;
  } catch (_) { /* treat as 0 on read error */ }

  const newCount = count + 1;
  try {
    await env.AB_INDEX.put(key, String(newCount));
  } catch (e) {
    return json({ error: "kv_write_error", detail: e?.message }, 500);
  }

  const responseObj = { ok: true, alias, variant, source, total: newCount };
  const res = json(responseObj);

  // ── Decision Engine: Persistence ──────────────────────────────────────────
  // Mark the user as 'converted' in their state cookie so the decision engine
  // can route them differently in future sessions (e.g. to upsells vs sales).
  const rawState = readCookie(request, "cos_state");
  if (rawState) {
    const user = parseUserState(rawState);
    const updatedUser = updateUserState(user, { c: 1 });
    res.headers.append("Set-Cookie", buildSetCookie(
      "cos_state", 
      serializeUserState(updatedUser), 
      { 
        maxAge: 604800,
        secure: env.ENV_NAME !== "dev"
      } 
    ));
  }

  return res;
}

// Respond to pre-flight CORS from third-party thank-you pages
export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
