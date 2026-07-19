/**
 * functions/api/experiment/promote.js
 *
 * POST /api/experiment/promote
 *
 * Promote the detected winner to canonical routing, then archive the experiment.
 *
 * Requires:
 *   • A winner must already be stored in the AB config (abConfig.winner !== null).
 *   • Experiment must not already be ARCHIVED.
 *
 * Effect:
 *   • state → ARCHIVED
 *   • winner preserved in config
 *   • [[path]].js routing bypasses A/B and always serves winner slug
 *   • Exposure, click, and conversion counters stop incrementing
 *
 * Body: { "alias": "<alias>" }
 *
 * Authentication: Bearer <ADMIN_TOKEN>
 *
 * Responses:
 *   200 { ok: true, state: "ARCHIVED", winner: "<slug>" }
 *   400 { error: "invalid_alias" | "invalid_transition" | "no_winner" | "invalid_body" }
 *   401 Unauthorized
 *   404 { error: "no_ab_config" }
 */

import { verifyToken, unauthorized, jsonHeaders } from "../../_shared/auth.js";
import { validateAlias }                          from "../../_shared/validators.js";
import { loadABConfig, getExpState }              from "../../_shared/ab-router.js";

const JSON_HEADERS = {
  ...jsonHeaders(),
  "Cache-Control": "no-store",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await verifyToken(request, env))) return unauthorized();

  // ── Parse body ────────────────────────────────────────────────────────────
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: "invalid_body" }, 400);
  }

  const alias = (typeof body?.alias === "string" ? body.alias : "").toLowerCase().trim();
  if (!alias || !validateAlias(alias)) return json({ error: "invalid_alias" }, 400);

  // ── Load current config (bypass cache for admin write operations) ─────────
  if (!env.AB_INDEX) return json({ error: "no_ab_config" }, 404);

  let existing;
  try {
    existing = await env.AB_INDEX.get(`ab_config:${alias}`, { type: "json" });
  } catch (_) {
    return json({ error: "kv_read_failed" }, 500);
  }
  if (!existing) return json({ error: "no_ab_config" }, 404);

  // ── Validate transition ───────────────────────────────────────────────────
  const currentState = getExpState(existing);
  if (currentState === "ARCHIVED") {
    return json({ error: "invalid_transition", detail: "already_archived" }, 400);
  }

  // ── Require winner ────────────────────────────────────────────────────────
  const winner = (typeof existing.winner === "string" && existing.winner) ? existing.winner : null;
  if (!winner) {
    return json({ error: "no_winner", detail: "winner must be set before promoting" }, 400);
  }

  // ── Write updated config ──────────────────────────────────────────────────
  const now = Math.floor(Date.now() / 1000);
  const updated = {
    ...existing,
    state:       "ARCHIVED",
    winner,                          // preserved
    archived_at: now,
    updatedAt:   new Date().toISOString(),
  };

  try {
    await env.AB_INDEX.put(`ab_config:${alias}`, JSON.stringify(updated));
  } catch (_) {
    return json({ error: "kv_write_failed" }, 500);
  }

  return json({ ok: true, state: "ARCHIVED", winner });
}
