/**
 * functions/api/experiment/unarchive.js
 *
 * POST /api/experiment/unarchive
 *
 * Re-open an ARCHIVED experiment by transitioning it to PAUSED state.
 * Useful for correcting a premature archive or re-running an experiment
 * after post-hoc analysis.
 *
 * Transition: ARCHIVED → PAUSED
 *
 * Notes:
 *   • All KV counters (exposures, clicks, conversions) remain unchanged.
 *   • The stored winner field is preserved in the config.
 *   • After unarchiving, routing resumes variant selection (sticky bucketing).
 *   • Exposure counters stay frozen until the experiment is also resumed.
 *   • Use POST /api/experiment/resume to move from PAUSED → RUNNING.
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

import { verifyToken, unauthorized } from "../../_shared/auth.js";
import { applyLifecycleTransition }  from "./_lifecycle.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await verifyToken(request, env))) return unauthorized();
  return applyLifecycleTransition(request, env, "PAUSED", ["ARCHIVED"]);
}
