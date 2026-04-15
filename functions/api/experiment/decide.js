/**
 * functions/api/experiment/decide.js
 *
 * POST /api/experiment/decide
 *
 * Declare a winning variant for an experiment.  Sets the winner field and
 * transitions the experiment to DECIDED state.  After this:
 *   • The routing layer routes all traffic to the winning slug.
 *   • The "Promote Winner" button becomes available in the admin UI.
 *   • The experiment can be finalized via POST /api/experiment/promote.
 *
 * Body: { "alias": "<alias>", "winner": "<slug>" }
 *
 * Authentication: Bearer <ADMIN_TOKEN>
 *
 * Responses:
 *   200 { ok: true, state: "DECIDED", winner: "<slug>" }
 *   400 { error: "invalid_alias" | "invalid_winner" | "no_variants" |
 *               "invalid_transition" | "invalid_body" }
 *   401 Unauthorized
 *   404 { error: "no_ab_config" }
 *   500 { error: "kv_read_failed" | "kv_write_failed" }
 *
 * Prompt 68 — Section 5 (winner promotion / manual decide flow)
 */

import { verifyToken, unauthorized, jsonHeaders } from "../../_shared/auth.js";
import { validateAlias }                          from "../../_shared/validators.js";
import { getExpState }                            from "../../_shared/ab-router.js";
import { cacheDelete }                            from "../../_shared/kv-cache.js";

const AB_CACHE_PREFIX = "ab_cfg:";

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

  // ── Parse body ────────────────────────────────────────────────────────────
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: "invalid_body" }, 400);
  }

  const alias  = (typeof body?.alias  === "string" ? body.alias  : "").toLowerCase().trim();
  const winner = (typeof body?.winner === "string" ? body.winner : "").toLowerCase().trim();

  if (!alias  || !validateAlias(alias))  return json({ error: "invalid_alias" },  400);
  if (!winner)                            return json({ error: "invalid_winner" }, 400);

  if (!env.AB_INDEX) return json({ error: "no_ab_config" }, 404);

  // ── Load current config ───────────────────────────────────────────────────
  let existing;
  try {
    existing = await env.AB_INDEX.get(`ab_config:${alias}`, { type: "json" });
  } catch (_) {
    return json({ error: "kv_read_failed" }, 500);
  }
  if (!existing) return json({ error: "no_ab_config" }, 404);

  // ── Validate winner slug belongs to this experiment ───────────────────────
  const variants = Array.isArray(existing.variants) ? existing.variants : [];
  if (variants.length === 0) return json({ error: "no_variants" }, 400);

  const validSlugs = variants.map((v) => v.slug);
  if (!validSlugs.includes(winner)) {
    return json({ error: "invalid_winner", detail: "slug not in experiment variants" }, 400);
  }

  // ── Validate transition — cannot decide an already-archived experiment ────
  const currentState = getExpState(existing);
  if (currentState === "ARCHIVED") {
    return json({ error: "invalid_transition", detail: "already_archived" }, 400);
  }

  // ── Write updated config ──────────────────────────────────────────────────
  const now = Math.floor(Date.now() / 1000);
  const updated = {
    ...existing,
    winner,
    state:       "DECIDED",
    decided_at:  now,
    updatedAt:   new Date().toISOString(),
  };

  try {
    await env.AB_INDEX.put(`ab_config:${alias}`, JSON.stringify(updated));
  } catch (_) {
    return json({ error: "kv_write_failed" }, 500);
  }

  // Invalidate in-memory cache so routing picks up the new state immediately
  cacheDelete(`${AB_CACHE_PREFIX}${alias}`);

  return json({ ok: true, state: "DECIDED", winner });
}
