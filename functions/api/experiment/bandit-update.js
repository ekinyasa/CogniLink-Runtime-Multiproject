/**
 * functions/api/experiment/bandit-update.js
 *
 * POST /api/experiment/bandit-update
 *
 * Manual trigger for the bandit weight rebalancer.
 *
 * This endpoint is a thin authenticated wrapper around rebalanceExperiment()
 * from functions/cron/bandit-update.js.  It contains NO bandit logic of its
 * own — it simply invokes the same algorithm the scheduled cron uses.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  SINGLE ALGORITHM RULE (Prompt 54)                                       │
 * │  rebalanceExperiment() in functions/cron/bandit-update.js is the ONLY   │
 * │  function that computes or updates variant weights.  If you need to      │
 * │  change the learning algorithm, change it there — not here.              │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Body:
 *   { "alias": "<alias>" }
 *
 * Authentication: Bearer <ADMIN_TOKEN>
 *
 * Responses:
 *   200 { ok: true, action: "updated",  alias, state, variants: [{...}] }
 *   200 { ok: true, action: "no_change", alias, state, variants: [{...}] }
 *   200 { ok: true, action: "skipped",  alias, reason, state?, ... }
 *   400 { error: "invalid_alias" | "invalid_body" | "not_running" }
 *   401 Unauthorized
 *   404 { error: "no_ab_config" }
 *   503 { error: "CAMPAIGN_REGISTRY_not_bound" }
 *
 * variants row shape (action: "updated" | "no_change"):
 *   { slug, exposures, conversions, old_weight, new_weight }
 */

import { verifyToken, unauthorized, jsonHeaders } from "../../_shared/auth.js";
import { validateAlias }                          from "../../_shared/validators.js";
import { rebalanceExperiment }                    from "../../cron/bandit-update.js";

const JSON_HEADERS = {
  ...jsonHeaders(),
  "Cache-Control": "no-store",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!verifyToken(request, env)) return unauthorized();

  if (!env.AB_INDEX) return json({ error: "CAMPAIGN_REGISTRY_not_bound" }, 503);

  // ── Parse + validate request body ─────────────────────────────────────────
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: "invalid_body" }, 400);
  }

  const alias = (typeof body?.alias === "string" ? body.alias : "").toLowerCase().trim();
  if (!alias || !validateAlias(alias)) return json({ error: "invalid_alias" }, 400);

  // ── Delegate to the single learning algorithm ──────────────────────────────
  const result = await rebalanceExperiment(env, alias);

  // ── Map rebalanceExperiment result → HTTP response ─────────────────────────
  if (!result.ok) {
    switch (result.reason) {
      case "no_config":               return json({ error: "no_ab_config" },             404);
      case "CAMPAIGN_REGISTRY_not_bound": return json({ error: "CAMPAIGN_REGISTRY_not_bound" }, 503);
      default:                        return json({ error: result.reason },               500);
    }
  }

  if (result.action === "skipped" && result.reason === "not_running") {
    return json({ error: "not_running", state: result.state }, 400);
  }

  // "updated", "no_change", or other "skipped" variants (insufficient data)
  return json({ ok: true, alias, ...result });
}
