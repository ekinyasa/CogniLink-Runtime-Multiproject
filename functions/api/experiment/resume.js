/**
 * functions/api/experiment/resume.js
 *
 * POST /api/experiment/resume
 *
 * Transition a PAUSED experiment back to RUNNING state.
 * Exposure counters resume on the next page view.
 *
 * Body: { "alias": "<alias>" }
 *
 * Authentication: Bearer <ADMIN_TOKEN>
 *
 * Responses:
 *   200 { ok: true, state: "RUNNING" }
 *   400 { error: "invalid_alias" | "invalid_transition" | "invalid_body" }
 *   401 Unauthorized
 *   404 { error: "no_ab_config" }
 */

import { verifyToken, unauthorized } from "../../_shared/auth.js";
import { applyLifecycleTransition }  from "./_lifecycle.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await verifyToken(request, env))) return unauthorized();
  return applyLifecycleTransition(request, env, "RUNNING", ["PAUSED"]);
}
