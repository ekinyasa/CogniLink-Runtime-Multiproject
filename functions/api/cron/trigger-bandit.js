/**
 * GET /api/cron/trigger-bandit
 * 
 * Manual trigger to execute the background Multi-Armed Bandit update process
 * for all running experiments. Retrieves data from Analytics Engine and 
 * updates Thompson Sampling weights in KV.
 * 
 * Authentication: Bearer <ADMIN_TOKEN>
 */
import { runBanditUpdate } from "../../cron/bandit-update.js";
import { verifyToken, unauthorized, jsonHeaders } from "../../_shared/auth.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  
  if (!verifyToken(request, env)) return unauthorized();

  try {
    await runBanditUpdate(env);
    return new Response(JSON.stringify({ ok: true, message: "Smart A/B Multi-Armed Bandit weights rebalanced successfully via Analytics Engine." }), {
      status: 200,
      headers: jsonHeaders()
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: "bandit_update_failed", message: error.message }), {
      status: 500,
      headers: jsonHeaders()
    });
  }
}
