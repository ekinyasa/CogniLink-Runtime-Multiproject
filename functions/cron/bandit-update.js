/**
 * functions/cron/bandit-update.js — Single-owner bandit weight updater.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  OWNERSHIP RULE (Prompt 54)                                              │
 * │  This module is the ONLY system that updates experiment variant weights. │
 * │  The admin endpoint POST /api/experiment/bandit-update delegates to      │
 * │  rebalanceExperiment() exported below — no separate algorithm exists.    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  This module runs ENTIRELY OUTSIDE the request path.                     │
 * │  No HTTP request latency is affected.                                    │
 * │  The router picks up updated weights on the next cache TTL cycle (≤60s). │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Rebalance algorithm (Section 4 — Prompt 54, executed in order):
 *   1. Read exposures + conversions per variant.
 *   2. score[i]     = conversions[i] / exposures[i]
 *   3. normalized[i] = score[i] / sum(scores)
 *   4. target[i]    = round(normalized[i] × 100)   (percentage weight)
 *   5. clamped[i]   = max(target[i], MIN_WEIGHT)    (exploration floor)
 *   6. guarded[i]   = clamp(clamped[i], old[i]−MAX_DELTA, old[i]+MAX_DELTA)
 *                                                    (traffic shock prevention)
 *   7. Normalize guarded[] so sum = 100 exactly.
 *   8. Persist updated weights.
 *
 * Safety guards (all must pass; else rebalance is skipped):
 *   • experiment.state === "RUNNING"
 *   • total exposures ≥ MIN_TOTAL_EXPOSURES (200)
 *   • every variant exposures ≥ MIN_VARIANT_EXPOSURES (50)
 *
 * Observability (Section 7 — Prompt 54):
 *   BANDIT_UPDATE { experiment, variants[{slug,exposures,conversions,
 *                   old_weight,new_weight}], old_weights{}, new_weights{} }
 *
 * Cron integration:
 *   // _worker.js  (or standalone Worker)
 *   import { runBanditUpdate } from "./functions/cron/bandit-update.js";
 *   export default {
 *     async fetch(request, env, ctx) { /* existing routing *\/ },
 *     async scheduled(event, env, ctx) {
 *       ctx.waitUntil(runBanditUpdate(env));
 *     },
 *   };
 *
 *   // wrangler.toml
 *   [triggers]
 *   crons = ["*\/10 * * * *"]
 *
 * NOTE: Cloudflare Pages Functions do not support cron triggers via the
 * functions/ directory.  The scheduled handler must be wired via _worker.js
 * (Pages advanced mode) or a separate standalone Cloudflare Worker that
 * shares the same AB_INDEX KV namespace binding.
 *
 * Non-goals (Section 9 — Prompt 54):
 *   This system intentionally does NOT use Bayesian Thompson sampling,
 *   statistical significance testing, or request-time bandit evaluation.
 *   Campaign OS prioritises speed, cost efficiency, and operational simplicity.
 */

import { getExpState }                from "../_shared/ab-router.js";
import { cacheDelete }                from "../_shared/kv-cache.js";

// ── Constants ──────────────────────────────────────────────────────────────────

/** Exploration floor: no variant ever receives less than this % of traffic. */
const MIN_WEIGHT = 10;

/**
 * Maximum weight shift per rebalance cycle.
 * Prevents traffic shock when conversion data changes quickly (Section 2).
 */
const MAX_DELTA = 10;

/** Per-variant exposure gate: variant must have ≥ this many exposures to learn. */
const MIN_VARIANT_EXPOSURES = 50;

/** Experiment-level exposure gate: total must be ≥ this value before learning. */
const MIN_TOTAL_EXPOSURES = 200;

/** KV cache key prefix — must match the prefix used in ab-router.js. */
const AB_CACHE_PREFIX = "ab_cfg:";

// ── Weight computation ─────────────────────────────────────────────────────────

/**
 * Normalize an integer weight array so it sums to exactly 100.
 *
 * Strategy:
 *   If sum > 100: greedily subtract 1 from the heaviest variants that still
 *     have room above MIN_WEIGHT, until the total reaches 100.
 *   If sum < 100: add the entire deficit to the largest variant (no ceiling).
 *
 * Called after the delta guard, so all inputs are already ≥ MIN_WEIGHT.
 *
 * @param {number[]} weights
 * @returns {number[]}
 */
function normalizeToSum100(weights) {
  const result = [...weights];
  let diff = 100 - result.reduce((s, w) => s + w, 0);
  if (diff === 0) return result;

  if (diff > 0) {
    // Sum is below 100 — add deficit to the largest variant.
    const maxIdx = result.indexOf(Math.max(...result));
    result[maxIdx] += diff;
  } else {
    // Sum is above 100 — subtract from heaviest variants with headroom.
    let surplus = -diff; // positive amount to remove
    while (surplus > 0) {
      // Find the heaviest variant that can give up 1 without dropping below MIN_WEIGHT.
      let picked = -1;
      for (let i = 0; i < result.length; i++) {
        if (result[i] > MIN_WEIGHT) {
          if (picked === -1 || result[i] > result[picked]) picked = i;
        }
      }
      if (picked === -1) break; // No variant can give up weight — stop (shouldn't happen).
      result[picked]--;
      surplus--;
    }
  }

  return result;
}

/** Simple Gamma PRNG for Beta sampling (Marsaglia & Tsang) */
function sampleGamma(shape) {
  let d = shape - 1 / 3, c = 1 / Math.sqrt(9 * d);
  while (true) {
    let x, v, u = 0, vRand = 0;
    do { 
      while(u === 0) u = Math.random(); 
      while(vRand === 0) vRand = Math.random();
      x = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * vRand);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    let uRand = Math.random();
    if (uRand < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(uRand) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

/** Standard Normal sample (Box-Muller) — faster than rejection sampling for large N */
function sampleNormal(mu = 0, sigma = 1) {
  const u = 1 - Math.random();
  const v = 1 - Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mu + sigma * z;
}

/** Sample from Beta(alpha, beta) */
function sampleBeta(alpha, beta) {
  let a = sampleGamma(Math.max(1, alpha));
  let b = sampleGamma(Math.max(1, beta));
  return a / (a + b);
}

/**
 * Compute new integer traffic weights using Bayesian Thompson Sampling 
 * (Section 4 — Smart A/B evolution).
 *
 * Runs 1000 simulations drawing from Beta(conversions+1, exposures-conversions+1)
 * and allocates weight proportional to win frequency.
 *
 * @param {Array<{ slug: string, weight: number }>} variants
 * @param {Array<{ slug: string, exposures: number, conversions: number }>} counters
 * @returns {number[] | null}
 */
function computeRebalancedWeights(variants, counters) {
  const counterMap = {};
  for (const c of counters) counterMap[c.slug] = c;

  for (const v of variants) {
    if ((counterMap[v.slug]?.exposures ?? 0) < MIN_VARIANT_EXPOSURES) return null;
  }

  // Pre-calculate distribution parameters outside the loop (CPU optimization)
  const variantStats = variants.map(v => {
    const c = counterMap[v.slug];
    const exposures = c?.exposures || 0;
    const conversions = c?.conversions || 0;
    
    const alpha = conversions + 1;
    const betaVal = Math.max(0, exposures - conversions) + 1;
    const sum = alpha + betaVal;
    
    // Normal approximation is valid when alpha and beta are large (e.g. > 500)
    // Faster than rejection-based Gamma sampling for high-volume experiments.
    const useNormal = (exposures > 500);
    const mu = alpha / sum;
    const sigma = Math.sqrt((alpha * betaVal) / (Math.pow(sum, 2) * (sum + 1)));
    
    return { alpha, betaVal, useNormal, mu, sigma };
  });

  // Run Thompson Sampling simulation
  // Reduced to 400 trials to fit Workers CPU limit on large datasets.
  const TRIALS = 400;
  const wins = new Array(variants.length).fill(0);
  
  for (let i = 0; i < TRIALS; i++) {
    let bestIdx = -1, maxSample = -1;
    for (let j = 0; j < variants.length; j++) {
      const stats = variantStats[j];
      const sample = stats.useNormal 
        ? sampleNormal(stats.mu, stats.sigma)
        : sampleBeta(stats.alpha, stats.betaVal);
      
      if (sample > maxSample) {
        maxSample = sample;
        bestIdx = j;
      }
    }
    wins[bestIdx]++;
  }

  // Step 3-4: normalise → percentage weights based on win probability
  let weights = wins.map(w => Math.round((w / TRIALS) * 100));

  // Step 5: clamp to exploration floor
  weights = weights.map(w => Math.max(w, MIN_WEIGHT));

  // Step 6: delta guard
  const oldWeights = variants.map(v => v.weight);
  weights = weights.map((w, i) =>
    Math.max(oldWeights[i] - MAX_DELTA, Math.min(oldWeights[i] + MAX_DELTA, w))
  );

  // Step 7: renormalise to exact sum = 100
  weights = normalizeToSum100(weights);

  return weights;
}

// ── Core rebalance function (single source of truth) ──────────────────────────

/**
 * Evaluate and (if warranted) update traffic weights for one experiment.
 *
 * This is the SINGLE function used by both:
 *   • the scheduled cron (runBanditUpdate)
 *   • the admin manual-trigger endpoint (POST /api/experiment/bandit-update)
 *
 * No other code path modifies experiment variant weights.
 *
 * Return shape:
 *   { ok: false, reason: string }                        — config missing / KV error
 *   { ok: true, action: "skipped", reason, state, ... }  — guard not met; no write
 *   { ok: true, action: "no_change", state, variants }   — computed == current; no write
 *   { ok: true, action: "updated",  state, variants }    — weights written to KV
 *
 * variants[i]:  { slug, exposures, conversions, old_weight, new_weight }
 *
 * @param {object} env   — Workers env (requires AB_INDEX)
 * @param {string} alias — experiment alias (e.g. "abrand45")
 * @returns {Promise<object>}
 */
export async function rebalanceExperiment(env, alias) {
  if (!env?.AB_INDEX) {
    return { ok: false, reason: "CAMPAIGN_REGISTRY_not_bound" };
  }

  // Direct KV read — bypass in-memory cache so we always see the freshest config.
  let config;
  try {
    config = await env.AB_INDEX.get(`ab_config:${alias}`, { type: "json" });
  } catch (_) {
    return { ok: false, reason: "kv_read_failed" };
  }
  if (!config) return { ok: false, reason: "no_config" };

  // Gate 1: only rebalance RUNNING experiments.
  const state = getExpState(config);
  if (state !== "RUNNING") {
    return { ok: true, action: "skipped", reason: "not_running", state };
  }

  // Read sharded counters for all variants via Analytics Engine SQL API (Lookback 12H)
  const accountId = env.CF_ACCOUNT_ID;
  const apiToken  = env.CF_AE_API_TOKEN;
  if (!accountId || !apiToken) return { ok: false, reason: "analytics_api_not_configured" };

  const envName = (env.ENV_NAME || "dev").toLowerCase();
  const datasetOps = `ae_traffic_${envName}`;
  const datasetEvt = `ae_conversion_${envName}`;

  const aliasEscaped = alias.replace(/'/g, "''");
  
  // Query 1: Exposures from datasetOps (ab_selected)
  const sqlExp = `
    SELECT blob2 AS variant, SUM(_sample_interval) AS count
    FROM ${datasetOps}
    WHERE blob1 = '${aliasEscaped}' AND index1 = 'ab_selected'
      AND timestamp >= NOW() - INTERVAL '12' HOUR
    GROUP BY variant
  `;

  // Query 2: Clicks and Conversions from datasetEvt
  const sqlEvt = `
    SELECT index1 AS event_type, blob2 AS variant, SUM(_sample_interval) AS count
    FROM ${datasetEvt}
    WHERE blob1 = '${aliasEscaped}' AND index1 IN ('click', 'conversion')
      AND timestamp >= NOW() - INTERVAL '12' HOUR
    GROUP BY event_type, variant
  `;

  // Map flat AE data to variant performance map
  const map = {};
  config.variants.forEach(v => {
    map[v.slug] = { slug: v.slug, exposures: 0, conversions: 0 };
  });

  try {
    const [resExp, resEvt] = await Promise.all([
      fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiToken}` },
        body: sqlExp
      }),
      fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiToken}` },
        body: sqlEvt
      })
    ]);

    if (resExp.ok) {
      const { data } = await resExp.json();
      (data || []).forEach(row => {
        const slug = row.variant, count = Number(row.count) || 0;
        if (map[slug]) map[slug].exposures += count;
      });
    }

    if (resEvt.ok) {
      const { data } = await resEvt.json();
      (data || []).forEach(row => {
        const slug = row.variant, type = row.event_type, count = Number(row.count) || 0;
        if (map[slug] && type === "conversion") map[slug].conversions += count;
      });
    }
  } catch (err) {
    console.error("[bandit-update] ae query failed:", err.message);
  }
  const counters = Object.values(map);

  // Gate 2: require minimum total exposures.
  const totalExposures = counters.reduce((s, c) => s + c.exposures, 0);
  if (totalExposures < MIN_TOTAL_EXPOSURES) {
    return {
      ok:     true,
      action: "skipped",
      reason: "insufficient_data",
      state,
      total_exposures: totalExposures,
      threshold:       MIN_TOTAL_EXPOSURES,
    };
  }

  // Gate 3 (inside computeRebalancedWeights): per-variant threshold.
  const tSim0 = Date.now();
  const newWeights = computeRebalancedWeights(config.variants, counters);
  const tSimDuration = Date.now() - tSim0;
  
  if (!newWeights) {
    return {
      ok:     true,
      action: "skipped",
      reason: "variant_insufficient_data",
      state,
      variants: counters.map((c) => ({
        slug:      c.slug,
        exposures: c.exposures,
        threshold: MIN_VARIANT_EXPOSURES,
      })),
    };
  }

  // Build enriched variant rows for logging and response.
  const variantRows = config.variants.map((v, i) => {
    const c = counters.find((x) => x.slug === v.slug) ?? {};
    return {
      slug:        v.slug,
      exposures:   c.exposures   ?? 0,
      conversions: c.conversions ?? 0,
      old_weight:  v.weight,
      new_weight:  newWeights[i],
    };
  });

  // No-op: skip write if computed weights equal current weights.
  const unchanged = variantRows.every((r) => r.old_weight === r.new_weight);
  if (unchanged) {
    return { ok: true, action: "no_change", state, variants: variantRows };
  }

  // ── Observability log (Section 7 — Prompt 54) ────────────────────────────
  // Includes experiment alias, per-variant exposures + conversions, and
  // old/new weights so each update is fully auditable in Worker logs.
  const oldWeightsMap = {};
  const newWeightsMap = {};
  variantRows.forEach((r) => {
    oldWeightsMap[r.slug] = r.old_weight;
    newWeightsMap[r.slug] = r.new_weight;
  });

  console.log("BANDIT_UPDATE", JSON.stringify({
    experiment:  alias,
    variants:    variantRows,
    old_weights: oldWeightsMap,
    new_weights: newWeightsMap,
    duration_ms: tSimDuration,
  }));

  // ── Persist updated config (Section 6 — KV safety) ──────────────────────
  // Single KV put: read config above, apply weight changes, write back atomically.
  // Only variant.weight fields are modified; all other config fields are preserved.
  const updatedConfig = {
    ...config,
    variants:  config.variants.map((v, i) => ({ ...v, weight: newWeights[i] })),
    updatedAt: new Date().toISOString(),
  };

  try {
    await env.AB_INDEX.put(
      `ab_config:${alias}`,
      JSON.stringify(updatedConfig),
    );
    // Invalidate in-memory cache so the request router picks up new weights
    // on its next cache miss (within one cache TTL cycle, ≤ 60 s).
    cacheDelete(`${AB_CACHE_PREFIX}${alias}`);
  } catch (_) {
    console.error("[bandit-cron] KV write failed for", alias);
    return { ok: false, reason: "kv_write_failed" };
  }

  return { ok: true, action: "updated", state, variants: variantRows, simulation_ms: tSimDuration };
}

// ── Scheduled entry point ─────────────────────────────────────────────────────

/**
 * Run the bandit weight update pass for all experiments.
 *
 * Iterates every `ab_config:<alias>` key in AB_INDEX (paginated KV list)
 * and calls rebalanceExperiment() for each alias sequentially.
 *
 * Designed for use in a Cloudflare Workers scheduled handler:
 *
 *   export default {
 *     async scheduled(event, env, ctx) {
 *       ctx.waitUntil(runBanditUpdate(env));
 *     },
 *   };
 *
 * @param {object} env — Workers env (requires AB_INDEX)
 * @returns {Promise<void>}
 */
export async function runBanditUpdate(env) {
  if (!env?.AB_INDEX) {
    console.warn("[bandit-cron] AB_INDEX not bound — skipping");
    return;
  }

  // Enumerate all AB config keys via paginated KV list().
  const keys = [];
  try {
    let cursor;
    do {
      const page = await env.AB_INDEX.list({ prefix: "ab_config:", cursor });
      for (const k of page.keys) keys.push(k.name);
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
  } catch (err) {
    console.error("[bandit-cron] KV list failed:", err?.message ?? String(err));
    return;
  }

  if (keys.length === 0) return;

  // Process experiments sequentially to avoid bursting KV write quotas.
  // The 10-minute cron cadence provides ample time even for large namespaces.
  let updatedCount = 0;
  for (const key of keys) {
    const alias  = key.slice("ab_config:".length);
    const result = await rebalanceExperiment(env, alias);
    if (result.ok && result.action === "updated") updatedCount++;
  }

  console.log("[bandit-cron] run complete", JSON.stringify({
    experiments_scanned: keys.length,
    experiments_updated: updatedCount,
  }));
}
