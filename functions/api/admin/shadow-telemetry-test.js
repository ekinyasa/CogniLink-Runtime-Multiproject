/**
 * functions/api/admin/shadow-telemetry-test.js
 * 
 * POST /api/admin/shadow-telemetry-test
 * 
 * Controlled diagnostic endpoint that writes a single synthetic
 * shadow_mismatch event to AE_TRAFFIC for pipeline verification.
 * 
 * - POST only (GET returns 405)
 * - ADMIN_TOKEN required
 * - Does NOT touch production KV/config/pages
 * - Writes exactly one diagnostic event per call
 * - Respects SHADOW_TELEMETRY_ENABLED flag
 * - Optional ?type=evaluation to test shadow_evaluation instead
 */

import { verifyToken, unauthorized, jsonHeaders } from "../../_shared/auth.js";
import { SHADOW_EVENTS } from "../../_shared/shadow-telemetry.js";

const RESPONSE_HEADERS = {
  "Content-Type": "application/json;charset=UTF-8",
  "Cache-Control": "no-store, private",
  "X-Content-Type-Options": "nosniff"
};

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!verifyToken(request, env)) return unauthorized();

  const enabled = String(env.SHADOW_TELEMETRY_ENABLED) === "true";
  if (!enabled) {
    return new Response(JSON.stringify({
      ok: false,
      error: "telemetry_disabled",
      hint: "Set SHADOW_TELEMETRY_ENABLED = 'true' in wrangler.toml and redeploy."
    }), { status: 200, headers: RESPONSE_HEADERS });
  }

  const url = new URL(request.url);
  const eventType = url.searchParams.get("type") === "evaluation"
    ? SHADOW_EVENTS.EVALUATION
    : SHADOW_EVENTS.MISMATCH;

  const detail = {
    mismatch_count: eventType === SHADOW_EVENTS.MISMATCH ? 1 : 0,
    mismatch_categories: eventType === SHADOW_EVENTS.MISMATCH ? ["diagnostic"] : [],
    rule_source: "diagnostic",
    matched_rule_id: "none",
    source_schema: "diagnostic",
    runtime_version: "adapter",
    render_mode: "diagnostic"
  };

  try {
    const dataset = env.AE_TRAFFIC;
    if (!dataset) {
      return new Response(JSON.stringify({
        ok: false,
        error: "ae_binding_missing",
        hint: "AE_TRAFFIC binding is not available."
      }), { status: 503, headers: RESPONSE_HEADERS });
    }

    dataset.writeDataPoint({
      indexes: [eventType],
      blobs: [
        "admin_diagnostic",
        "diagnostic",
        `diag-${Date.now()}`,
        JSON.stringify(detail).slice(0, 1000)
      ]
    });

    return new Response(JSON.stringify({
      ok: true,
      event_type: eventType,
      slug: "admin_diagnostic",
      route_type: "diagnostic",
      written: true,
      timestamp: new Date().toISOString()
    }), { status: 200, headers: RESPONSE_HEADERS });

  } catch (err) {
    console.error("[shadow-telemetry-test] Write error:", err);
    return new Response(JSON.stringify({
      ok: false,
      error: "write_failed",
      hint: err.message?.slice(0, 200) || "Unknown error"
    }), { status: 500, headers: RESPONSE_HEADERS });
  }
}

export async function onRequestGet(context) {
  return new Response(JSON.stringify({
    ok: false,
    error: "method_not_allowed",
    hint: "Use POST to trigger a diagnostic event."
  }), {
    status: 405,
    headers: { ...RESPONSE_HEADERS, "Allow": "POST" }
  });
}
