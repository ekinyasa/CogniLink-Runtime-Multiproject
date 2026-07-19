/**
 * functions/api/experiment/pause.js
 *
 * POST /api/experiment/pause
 *
 * Transition a RUNNING or DECIDED experiment to PAUSED state.
 * Variant selection in [[path]].js continues (stickiness preserved),
 * but exposure counters freeze until the experiment is resumed.
 *
 * Body: { "alias": "<alias>" }
 *
 * Authentication: Bearer <ADMIN_TOKEN>
 *
 * Responses:
 *   200 { ok: true, state: "PAUSED" }
 *   400 { error: "invalid_alias" | "invalid_transition" | "invalid_body" }
 *   401 Unauthorized
 *   404 { error: "no_ab_config" }
 */

import { verifyToken, unauthorized, jsonHeaders } from "../../_shared/auth.js";
import { validateAlias }                          from "../../_shared/validators.js";
import { applyLifecycleTransition }              from "./_lifecycle.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await verifyToken(request, env))) return unauthorized();
  return applyLifecycleTransition(request, env, "PAUSED", ["RUNNING", "DECIDED"]);
}
