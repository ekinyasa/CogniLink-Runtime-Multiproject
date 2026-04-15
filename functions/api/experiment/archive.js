/**
 * functions/api/experiment/archive.js
 *
 * POST /api/experiment/archive
 *
 * Transition any non-ARCHIVED experiment to ARCHIVED state without
 * promoting a winner. Routing in [[path]].js will bypass A/B logic
 * and serve the base canonical slug (no winner override).
 *
 * To archive AND promote a winner, use POST /api/experiment/promote instead.
 *
 * Body: { "alias": "<alias>" }
 *
 * Authentication: Bearer <ADMIN_TOKEN>
 *
 * Responses:
 *   200 { ok: true, state: "ARCHIVED" }
 *   400 { error: "invalid_alias" | "invalid_transition" | "invalid_body" }
 *   401 Unauthorized
 *   404 { error: "no_ab_config" }
 */

import { verifyToken, unauthorized } from "../../_shared/auth.js";
import { applyLifecycleTransition }  from "./_lifecycle.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!verifyToken(request, env)) return unauthorized();
  return applyLifecycleTransition(request, env, "ARCHIVED", ["RUNNING", "PAUSED", "DECIDED"]);
}
