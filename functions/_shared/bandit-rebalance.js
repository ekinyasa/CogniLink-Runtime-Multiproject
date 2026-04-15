/**
 * functions/_shared/bandit-rebalance.js — Epsilon-greedy auto-rebalancer (Prompt 71).
 *
 * Provides automatic traffic rebalancing for experiments with strategy:"epsilon".
 * This is a lightweight bandit layer that sits on top of the deterministic router.
 * It adjusts stored variant weights based on observed conversion rates; the router
 * itself (ab-router.js) remains completely unchanged.
 *
 * Key constraint (T1 / Prompt 71):
 *   Only experiments with strategy:"epsilon" are rebalanced by this module.
 *   strategy:"fixed" (or absent) → existing behavior, no automatic rebalancing.
 *
 * Exported API:
 *   getExperimentPerformance(env, alias, config)   — T2: performance snapshot
 *   detectLeadingVariant(performance)              — T3: winner detection
 *   computeEpsilonWeights(variants, winnerSlug)    — T4: 90 / 10 weight split
 *   maybeRebalance(env, alias, trigger)            — T5 + T6: guarded KV update
 *
 * Trigger points (wired by callers):
 *   • conversion.js  → waitUntil(maybeRebalance(env, alias, "conversion"))
 *   • [[path]].js    → probabilistic exposure boundary (~1/500 chance per hit)
 *
 * Rate-limiting (T5):
 *   Rebalances at most once every COOLDOWN_MS (5 minutes) per alias.
 *   Checked in-memory first (fast path); falls back to config.last_rebalance
 *   which survives isolate restarts.
 *
 * KV write safety (T6):
 *   • Preserves total weight = 100 by construction (largest-remainder math).
 *   • Writes updated config atomically via a single KV put().
 *   • Logs a [BANDIT] line with old + new weights before each write.
 *   • Invalidates in-memory AB config cache so the router picks up new weights
 *     within one TTL cycle (≤ 60 s).
 */

import { getExpCounters }                  from "./exp-counter.js";
import { getExpState }                     from "./ab-router.js";
import { cacheGet, cacheSet, cacheDelete } from "./kv-cache.js";

// ── Constants ──────────────────────────────────────────────────────────────────

/** Minimum exposures a variant must have before winner detection considers it. */
const MIN_VARIANT_EXPOSURES = 100;

/** Minimum conversions a variant must have before winner detection considers it (P76). */
const MIN_VARIANT_CONVERSIONS = 3;

/** Minimum absolute CVR gap treated as a real signal, not noise (P76). */
const DELTA_ABS_FLOOR = 0.005;   // 0.5 percentage points

/** Minimum relative CVR gap treated as a real signal, not noise (P76). */
const DELTA_REL_THRESHOLD = 0.20;  // 20 %

/** Cooldown between rebalance runs for the same alias (ms). */
const COOLDOWN_MS = 5 * 60 * 1000;   // 5 minutes

/** Traffic allocation for the winning variant (exploitation share). */
const WINNER_WEIGHT = 90;

/** Remaining traffic budget split among non-winner variants (exploration share). */
const EXPLORE_BUDGET = 100 - WINNER_WEIGHT;   // 10

/** Minimum traffic allocation for any non-winner variant (P77).
 *  Prevents learning collapse: even a clear loser keeps receiving traffic so
 *  the system can detect if performance improves. */
const MIN_EXPLORE_FLOOR_PCT = 10;   // 10 % — currently equal to EXPLORE_BUDGET for 2 variants

/** In-memory cooldown cache key prefix. */
const COOLDOWN_PREFIX = "bandit_cool:";

/** AB config cache key prefix — must match the prefix in ab-router.js. */
const AB_CACHE_PREFIX = "ab_cfg:";

// ── T2: Performance snapshot ───────────────────────────────────────────────────

/**
 * Return conversion-rate performance for each variant of an experiment.
 *
 * Reads existing analytics counters from ANALITICS_DATA — does NOT
 * recompute historical metrics; uses the same source as GET /api/experiments.
 *
 * @param {object} env
 * @param {string} alias  — experiment alias
 * @param {object} config — validated ab_config (provides ordered variant list)
 * @returns {Promise<Array<{
 *   slug: string,
 *   exposures: number,
 *   clicks: number,
 *   conversions: number,
 *   ctr: number,
 *   conversion_rate: number
 * }>>}
 */
export async function getExperimentPerformance(env, alias, config) {
  const slugs = config.variants.map((v) => v.slug);
  return getExpCounters(env, alias, slugs);
}

// ── T3: Winner detection ───────────────────────────────────────────────────────

/**
 * Identify the leading variant from a performance snapshot.
 *
 * Rules (per T3 — Prompt 71):
 *   • Only variants with ≥ MIN_VARIANT_EXPOSURES (100) exposures are eligible.
 *   • At least 2 eligible variants required — a single data point is not comparable.
 *   • Winner = eligible variant with the highest conversion_rate.
 *
 * @param {Array<{ slug: string, exposures: number, conversion_rate: number }>} performance
 * @returns {{ winner: string, confidence: true } | null}
 */
export function detectLeadingVariant(performance) {
  // Step 1 — Eligibility: sufficient exposures AND sufficient conversions (P76).
  const eligible = performance.filter(
    (v) => v.exposures >= MIN_VARIANT_EXPOSURES && v.conversions >= MIN_VARIANT_CONVERSIONS,
  );
  if (eligible.length < 2) return null;  // need at least 2 comparable variants

  // Step 2 — Sort by CVR descending; leader = highest CVR.
  const sorted          = [...eligible].sort((a, b) => b.conversion_rate - a.conversion_rate);
  const [leader, runner] = sorted;

  // Step 3 — Delta check: ignore small fluctuations (P75 / P76 stability layer).
  //   delta_abs: absolute CVR gap (pp)
  //   delta_rel: relative CVR gap — safe division via max(..., 0.001)
  //   Reject if BOTH are below their floors (OR semantics: one passing is enough).
  const deltaAbs = leader.conversion_rate - runner.conversion_rate;
  const deltaRel = deltaAbs / Math.max(runner.conversion_rate, 0.001);
  if (deltaAbs < DELTA_ABS_FLOOR && deltaRel < DELTA_REL_THRESHOLD) return null;

  return { winner: leader.slug, confidence: true };
}

// ── T4: Weight computation ─────────────────────────────────────────────────────

/**
 * Compute epsilon-greedy integer weights (sum = 100) for all variants.
 *
 * Distribution:
 *   • Winner     → WINNER_WEIGHT (90)
 *   • All others → share EXPLORE_BUDGET (10) evenly, largest-remainder to fix rounding
 *
 * Examples:
 *   variants [A, B, C],  winner = B  →  [A:5, B:90, C:5]     sum=100 ✓
 *   variants [A, B, C, D], winner = B → [A:4, B:90, C:3, D:3] sum=100 ✓
 *
 * @param {Array<{ slug: string }>} variants — ordered variant array from config
 * @param {string} winnerSlug
 * @returns {number[]} — integer weights in same order as variants, sum = 100
 */
export function computeEpsilonWeights(variants, winnerSlug) {
  const nonWinnerCount = variants.length - 1;
  if (nonWinnerCount <= 0) return [100]; // edge case: single variant

  const baseExplore      = Math.floor(EXPLORE_BUDGET / nonWinnerCount);
  let   explorationLeft  = EXPLORE_BUDGET - baseExplore * nonWinnerCount; // rounding remainder

  return variants.map((v) => {
    if (v.slug === winnerSlug) return WINNER_WEIGHT;
    // Distribute rounding remainder to first N non-winners (+1 each).
    if (explorationLeft > 0) { explorationLeft--; return baseExplore + 1; }
    return baseExplore;
  });
}

// ── T5 + T6: Guarded rebalance ─────────────────────────────────────────────────

/**
 * Attempt an epsilon-greedy rebalance for an experiment.
 *
 * Must be called fire-and-forget via context.waitUntil() — all errors are
 * handled internally and never propagate to the calling request.
 *
 * Guards (all must pass; otherwise returns silently):
 *   1. In-memory cooldown — prevents redundant KV reads within the same isolate.
 *   2. config.last_rebalance — persisted cooldown (survives isolate restarts).
 *   3. strategy === "epsilon" AND state === "RUNNING".
 *   4. detectLeadingVariant finds a winner (sufficient data).
 *   5. Computed weights differ from current weights (skip no-op KV writes).
 *
 * On success:
 *   • Logs [BANDIT] alias / winner / old_weights / new_weights (T6).
 *   • Writes updated config (new weights + last_rebalance) to KV atomically (T6).
 *   • Invalidates the in-memory AB config cache (router picks up within ≤ 60 s).
 *
 * @param {object}                  env
 * @param {string}                  alias   — experiment alias
 * @param {"conversion"|"exposure"} trigger — what initiated this call (logged)
 * @returns {Promise<void>}
 */
export async function maybeRebalance(env, alias, trigger) {
  // [P80 DBG] Entry
  console.log("[BANDIT:DBG] enter", JSON.stringify({ alias, trigger }));

  if (!env?.AB_INDEX || !alias) {
    console.log("[BANDIT:DBG] SKIP no-env-or-alias", JSON.stringify({ hasRegistry: !!env?.AB_INDEX, alias }));
    return;
  }

  // ── Guard 1: In-memory cooldown (fast path) ────────────────────────────────
  const coolKey  = COOLDOWN_PREFIX + alias;
  const lastMemo = cacheGet(coolKey);
  const now0     = Date.now();
  if (lastMemo !== null && (now0 - lastMemo) < COOLDOWN_MS) {
    console.log("[BANDIT:DBG] SKIP in-memory-cooldown", JSON.stringify({ alias, lastMemo, now: now0, remainingMs: COOLDOWN_MS - (now0 - lastMemo) }));
    return;
  }
  console.log("[BANDIT:DBG] PASS in-memory-cooldown", JSON.stringify({ alias, lastMemo }));

  // ── Fresh KV read — bypass in-memory AB config cache ──────────────────────
  let config;
  try {
    config = await env.AB_INDEX.get(`ab_config:${alias}`, { type: "json" });
  } catch (err) {
    console.log("[BANDIT:DBG] SKIP kv-read-error", JSON.stringify({ alias, error: String(err?.message) }));
    return;
  }
  if (!config) {
    console.log("[BANDIT:DBG] SKIP no-config", JSON.stringify({ alias }));
    return;
  }
  console.log("[BANDIT:DBG] kv-config", JSON.stringify({ alias, strategy: config.strategy, state: getExpState(config), last_rebalance: config.last_rebalance ?? null, winner_at_last_rebalance: config.winner_at_last_rebalance ?? null, weights: config.variants?.map((v) => ({ slug: v.slug, weight: v.weight })) }));

  // ── Guard 2: Strategy + state ──────────────────────────────────────────────
  if (config.strategy === "fixed") {
    console.log("[BANDIT:DBG] SKIP strategy-fixed", JSON.stringify({ alias }));
    return;
  }
  const expState = getExpState(config);
  if (expState !== "RUNNING") {
    console.log("[BANDIT:DBG] SKIP state-not-running", JSON.stringify({ alias, state: expState }));
    return;
  }
  console.log("[BANDIT:DBG] PASS strategy+state", JSON.stringify({ alias, strategy: config.strategy ?? "epsilon", state: expState }));

  // ── Claim in-memory cooldown slot ─────────────────────────────────────────
  cacheSet(coolKey, Date.now(), COOLDOWN_MS + 10_000);

  // ── T2: Performance snapshot ───────────────────────────────────────────────
  let performance;
  try {
    performance = await getExperimentPerformance(env, alias, config);
  } catch (err) {
    console.log("[BANDIT:DBG] SKIP perf-read-error", JSON.stringify({ alias, error: String(err?.message) }));
    return;
  }
  console.log("[BANDIT:DBG] perf-snapshot", JSON.stringify({ alias, variants: performance.map((v) => ({ slug: v.slug, exposures: v.exposures, conversions: v.conversions, cvr: v.conversion_rate, eligible: v.exposures >= MIN_VARIANT_EXPOSURES && v.conversions >= MIN_VARIANT_CONVERSIONS })) }));

  // ── T3: Winner detection ───────────────────────────────────────────────────
  const detection = detectLeadingVariant(performance);
  if (!detection) {
    // Log which gate rejected it
    const eligible = performance.filter((v) => v.exposures >= MIN_VARIANT_EXPOSURES && v.conversions >= MIN_VARIANT_CONVERSIONS);
    if (eligible.length < 2) {
      console.log("[BANDIT:DBG] SKIP no-winner:eligibility", JSON.stringify({ alias, eligibleCount: eligible.length, need: 2, variants: performance.map((v) => ({ slug: v.slug, exposures: v.exposures, conversions: v.conversions, expOk: v.exposures >= MIN_VARIANT_EXPOSURES, convOk: v.conversions >= MIN_VARIANT_CONVERSIONS })) }));
    } else {
      const sorted    = [...eligible].sort((a, b) => b.conversion_rate - a.conversion_rate);
      const deltaAbs  = sorted[0].conversion_rate - sorted[1].conversion_rate;
      const deltaRel  = deltaAbs / Math.max(sorted[1].conversion_rate, 0.001);
      console.log("[BANDIT:DBG] SKIP no-winner:delta-too-small", JSON.stringify({ alias, leader: sorted[0].slug, runner: sorted[1].slug, deltaAbs: +deltaAbs.toFixed(5), deltaRel: +deltaRel.toFixed(3), needAbs: DELTA_ABS_FLOOR, needRel: DELTA_REL_THRESHOLD }));
    }
    return;
  }
  console.log("[BANDIT:DBG] PASS winner-detected", JSON.stringify({ alias, winner: detection.winner }));

  // ── Guard 3: Persisted cooldown — with winner-shift override (P77 Task 1) ──
  const now           = Date.now();
  const storedWinner  = config.winner_at_last_rebalance ?? null;
  const winnerChanged = detection.winner !== storedWinner;

  if (!winnerChanged) {
    if (typeof config.last_rebalance === "number" && (now - config.last_rebalance) < COOLDOWN_MS) {
      console.log("[BANDIT:DBG] SKIP persisted-cooldown:same-winner", JSON.stringify({ alias, winner: detection.winner, last_rebalance: config.last_rebalance, remainingMs: COOLDOWN_MS - (now - config.last_rebalance) }));
      return;
    }
  } else {
    console.log("[BANDIT:DBG] PASS persisted-cooldown:winner-changed", JSON.stringify({ alias, prev: storedWinner, next: detection.winner }));
  }

  // ── T4: Compute new epsilon-greedy weights + apply exploration floor (P77) ──
  const rawWeights  = computeEpsilonWeights(config.variants, detection.winner);
  const winnerIdx   = config.variants.findIndex((v) => v.slug === detection.winner);
  const newWeights  = rawWeights.map((w, i) => (i !== winnerIdx ? Math.max(w, MIN_EXPLORE_FLOOR_PCT) : w));
  const explorerSum = newWeights.reduce((s, w, i) => (i !== winnerIdx ? s + w : s), 0);
  newWeights[winnerIdx] = 100 - explorerSum;

  const oldWeights = config.variants.map((v) => v.weight);

  // ── Guard 5: Skip no-op writes ─────────────────────────────────────────────
  const unchanged = newWeights.every((w, i) => w === oldWeights[i]);
  if (unchanged) {
    console.log("[BANDIT:DBG] SKIP no-op-weights", JSON.stringify({ alias, oldWeights, newWeights }));
    return;
  }

  // ── T6: Observability log ──────────────────────────────────────────────────
  console.log("[BANDIT]", JSON.stringify({
    alias,
    winner:         detection.winner,
    winner_changed: winnerChanged,
    trigger,
    old_weights:    oldWeights,
    new_weights:    newWeights,
  }));

  // ── T6: Atomic KV write ────────────────────────────────────────────────────
  const updatedConfig = {
    ...config,
    variants:                 config.variants.map((v, i) => ({ ...v, weight: newWeights[i] })),
    winner_at_last_rebalance: detection.winner,
    last_rebalance:           now,
    updatedAt:                new Date().toISOString(),
  };

  try {
    await env.AB_INDEX.put(`ab_config:${alias}`, JSON.stringify(updatedConfig));
    cacheDelete(AB_CACHE_PREFIX + alias);
    console.log("[BANDIT:DBG] DONE kv-written", JSON.stringify({ alias, newWeights }));
  } catch (e) {
    console.error("[BANDIT] KV write failed", alias, e?.message);
  }
}
