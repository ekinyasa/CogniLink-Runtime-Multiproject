/**
 * POST (or GET) /api/admin/smoke-test
 *
 * Runs the Campaign OS internal smoke test suite and returns a structured
 * health report. Core logic lives in _shared/test-runner.js so it is
 * reusable from both this endpoint and the CLI thin wrapper.
 *
 * Authentication: Bearer <ADMIN_TOKEN>
 *
 * Response:
 *   {
 *     ok:          boolean,   // true only when ALL checks pass
 *     router:      "pass"|"fail",
 *     modifier:    "pass"|"fail",
 *     telemetry:   "pass"|"fail",
 *     analytics:   "pass"|"fail",
 *     duration_ms: number,
 *     warnings:    string[]
 *   }
 *
 * HTTP status is always 200 (even on "fail") so the admin panel can read
 * and render the structured result. The ok field carries the health signal.
 *
 * Safety: the smoke test only fires GET requests against existing aliases
 * and reads from Analytics Engine. No KV writes or mutations occur.
 */

import { verifyToken, unauthorized, jsonHeaders } from "../../_shared/auth.js";
import { runSmokeTests }                           from "../../_shared/test-runner.js";

export async function onRequest(context) {
  const { request, env } = context;

  // Accept GET (browser one-click) and POST (admin panel / CLI)
  if (request.method !== "GET" && request.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: "method_not_allowed" }),
      { status: 405, headers: { ...jsonHeaders(), Allow: "GET, POST" } }
    );
  }

  if (!(await verifyToken(request, env))) return unauthorized();

  const t0 = Date.now();

  let report;
  try {
    report = await runSmokeTests(env, request);
  } catch (err) {
    console.error("[smoke-test] runSmokeTests threw:", err?.message ?? String(err));
    return new Response(
      JSON.stringify({
        ok:          false,
        router:      "fail",
        modifier:    "fail",
        telemetry:   "fail",
        analytics:   "fail",
        error:       "internal_error",
        hint:        err?.message?.slice(0, 300) ?? "Unexpected error",
        duration_ms: Date.now() - t0,
        warnings:    [],
      }),
      { status: 500, headers: jsonHeaders() }
    );
  }

  return new Response(JSON.stringify(report), {
    status:  200,  // always 200 — ok field carries the health signal
    headers: jsonHeaders(),
  });
}
