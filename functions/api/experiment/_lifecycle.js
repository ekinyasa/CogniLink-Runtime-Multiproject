/**
 * functions/api/experiment/_lifecycle.js
 *
 * Shared helper for experiment lifecycle state transitions.
 *
 * Used by activate.js, pause.js, resume.js, and archive.js.
 * promote.js has custom logic (winner requirement) and handles itself.
 *
 * State machine (valid transitions only):
 *
 *   DRAFT    → RUNNING   (activate)   ← Prompt 47
 *   RUNNING  → PAUSED    (pause)
 *   RUNNING  → ARCHIVED  (archive)
 *   PAUSED   → RUNNING   (resume)
 *   PAUSED   → ARCHIVED  (archive)
 *   DECIDED  → PAUSED    (pause)
 *   DECIDED  → ARCHIVED  (archive)
 *   ARCHIVED → *         (invalid — terminal state)
 *
 * DRAFT experiments receive no live traffic.
 * activate.js handles the DRAFT → RUNNING transition exclusively.
 *
 * Transitions are idempotent: if the experiment is already in the target
 * state, 200 is returned without writing to KV.
 */

import { validateAlias }         from "../../_shared/validators.js";
import { getExpState }           from "../../_shared/ab-router.js";
import { jsonHeaders }           from "../../_shared/auth.js";

const JSON_HEADERS = {
  ...jsonHeaders(),
  "Cache-Control": "no-store",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

/**
 * Apply a lifecycle transition to an experiment's AB config record.
 *
 * @param {Request} request
 * @param {object}  env
 * @param {string}  targetState   — the desired new state
 * @param {string[]} allowedFrom  — valid source states for this transition
 * @returns {Promise<Response>}
 */
export async function applyLifecycleTransition(request, env, targetState, allowedFrom) {
  // ── Parse body ────────────────────────────────────────────────────────────
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: "invalid_body" }, 400);
  }

  const alias = (typeof body?.alias === "string" ? body.alias : "").toLowerCase().trim();
  if (!alias || !validateAlias(alias)) return json({ error: "invalid_alias" }, 400);

  // ── Load current config (direct KV read — bypass in-memory cache) ─────────
  if (!env.AB_INDEX) return json({ error: "no_ab_config" }, 404);

  let existing;
  try {
    existing = await env.AB_INDEX.get(`ab_config:${alias}`, { type: "json" });
  } catch (_) {
    return json({ error: "kv_read_failed" }, 500);
  }
  if (!existing) return json({ error: "no_ab_config" }, 404);

  // ── Check current state ───────────────────────────────────────────────────
  const currentState = getExpState(existing);

  // Idempotent: already in target state → 200 with no write
  if (currentState === targetState) {
    return json({ ok: true, state: targetState, noop: true });
  }

  // Validate transition: ARCHIVED is a terminal state
  if (!allowedFrom.includes(currentState)) {
    return json({
      error:   "invalid_transition",
      from:    currentState,
      to:      targetState,
      allowed: allowedFrom,
    }, 400);
  }

  // ── Build updated config ──────────────────────────────────────────────────
  const now     = Math.floor(Date.now() / 1000);
  const updated = { ...existing, state: targetState, updatedAt: new Date().toISOString() };

  if (targetState === "ARCHIVED") {
    updated.archived_at = now;
  }
  if (targetState === "RUNNING" && !updated.created_at) {
    updated.created_at = now;
  }

  // ── Write to KV ───────────────────────────────────────────────────────────
  try {
    await env.AB_INDEX.put(`ab_config:${alias}`, JSON.stringify(updated));
  } catch (_) {
    return json({ error: "kv_write_failed" }, 500);
  }

  return json({ ok: true, state: targetState });
}
