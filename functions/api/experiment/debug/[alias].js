/**
 * functions/api/experiment/debug/[alias].js — Quick analytics snapshot (Prompt 70 T6).
 *
 * GET /api/experiment/debug/:alias
 *
 * Requires admin Bearer token.
 * Returns a single-request view of counters + weights — useful for verifying
 * attribution and routing during testing without opening the admin UI.
 *
 * Response 200:
 *   {
 *     alias, state, variants: [
 *       { slug, weight, exposures, clicks, conversions, ctr, conversion_rate, lift }
 *     ]
 *   }
 *   lift: percentage uplift vs the first variant (control).
 *        null for control itself, null when control has no conversions.
 *
 * Response 401: unauthorized
 * Response 404: experiment not found
 * Response 503: AB_INDEX / ANALITICS_DATA not bound
 *
 * Guard behind admin auth before exposing to production traffic.
 */

import { verifyToken, unauthorized } from "../../../_shared/auth.js";
import { getExpCounters }            from "../../../_shared/exp-counter.js";
import { detectLeadingVariant }      from "../../../_shared/bandit-rebalance.js";

const JSON_HEADERS = {
  "Content-Type":           "application/json;charset=UTF-8",
  "Cache-Control":          "no-store",
  "X-Content-Type-Options": "nosniff",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export async function onRequestGet(context) {
  const { request, env, params } = context;

  // ── Auth ──────────────────────────────────────────────────────────────────
  if (!(await verifyToken(request, env))) return unauthorized();

  if (!env.AB_INDEX)  return json({ error: "CAMPAIGN_REGISTRY_not_bound"  }, 503);
  if (!env.ANALITICS_DATA) return json({ error: "TELEMETRY_REGISTRY_not_bound" }, 503);

  // ── Load AB config ────────────────────────────────────────────────────────
  const alias = typeof params.alias === "string" ? params.alias.trim().toLowerCase() : "";
  if (!alias) return json({ error: "alias_required" }, 400);

  let config = null;
  try {
    config = await env.AB_INDEX.get(`ab_config:${alias}`, { type: "json" });
  } catch (_) {}

  if (!config || !Array.isArray(config.variants) || config.variants.length === 0) {
    return json({ error: "experiment_not_found" }, 404);
  }

  const slugs = config.variants.map((v) => v.slug);

  // ── Read counters (parallel across all variants) ─────────────────────────
  const counters = await getExpCounters(env, alias, slugs);

  // ── Compute lift relative to first variant (control) ─────────────────────
  const controlCvr = counters[0]?.conversion_rate ?? 0;

  const variants = config.variants.map((v, i) => {
    const c    = counters[i] ?? { exposures: 0, clicks: 0, conversions: 0, ctr: 0, conversion_rate: 0 };
    const lift = (i === 0 || controlCvr === 0)
      ? null
      : Math.round(((c.conversion_rate / controlCvr) - 1) * 10000) / 100;  // 2 d.p.
    return {
      slug:            v.slug,
      weight:          v.weight,
      exposures:       c.exposures,
      clicks:          c.clicks,
      conversions:     c.conversions,
      ctr:             c.ctr,
      conversion_rate: c.conversion_rate,
      lift,                                // % uplift vs control; null = control or no baseline
    };
  });

  // P71 T7 / P77 Task 2 — Bandit debug fields (Option B: dual-field model).
  //
  // current_leader    — computed from LIVE telemetry at query time.
  //                     Answers: "who is winning RIGHT NOW?"
  //                     May differ from weights when performance has shifted
  //                     since the last rebalance (within cooldown window).
  //
  // last_applied_winner — stored in config.winner_at_last_rebalance by
  //                       maybeRebalance() when weights were last written.
  //                       Answers: "who was winning WHEN WEIGHTS WERE SET?"
  //                       Matches the high-weight variant exactly.
  //
  // When current_leader === last_applied_winner: system is consistent.
  // When they differ: a leadership shift has occurred and a rebalance is
  // pending (either within cooldown, or no trigger has fired yet).
  const detectedWinner = detectLeadingVariant(variants.map((v) => ({
    slug:            v.slug,
    exposures:       v.exposures,
    conversion_rate: v.conversion_rate,
  })));

  return json({
    alias,
    state:                config.state          ?? "RUNNING",
    strategy:             config.strategy       ?? "fixed",
    last_rebalance:       config.last_rebalance ?? null,
    current_leader:       detectedWinner?.winner          ?? null,
    last_applied_winner:  config.winner_at_last_rebalance ?? null,
    weights:              config.variants.map((v) => ({ slug: v.slug, weight: v.weight })),
    variants,
  });
}
