/**
 * functions/api/experiment/activate.js
 *
 * POST /api/experiment/activate
 *
 * Activate a DRAFT experiment, transitioning it to RUNNING state.
 *
 * DRAFT experiments are fully configured but receive no live traffic.
 * Calling activate starts bandit routing (or static weighted routing if
 * no bandit-update has been run yet).
 *
 * Side effects (via applyLifecycleTransition):
 *   • state → RUNNING
 *   • created_at stamped if absent (records the activation time)
 *
 * Body: { "alias": "<alias>" }
 *
 * Authentication: Bearer <ADMIN_TOKEN>
 *
 * Responses:
 *   200 { ok: true, state: "RUNNING" }
 *   200 { ok: true, state: "RUNNING", noop: true }   (already RUNNING)
 *   400 { error: "invalid_transition", from: "...", to: "RUNNING", allowed: ["DRAFT"] }
 *   400 { error: "invalid_alias" | "invalid_body" }
 *   401 Unauthorized
 *   404 { error: "no_ab_config" }
 */

import { verifyToken, unauthorized } from "../../_shared/auth.js";
import { applyLifecycleTransition }  from "./_lifecycle.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await verifyToken(request, env))) return unauthorized();

  // DRAFT → RUNNING only
  return applyLifecycleTransition(request, env, "RUNNING", ["DRAFT"]);
}
