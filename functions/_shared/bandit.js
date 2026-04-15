/**
 * bandit.js — Thompson sampling for multi-armed bandit routing.
 *
 * Implements Beta distribution sampling for Thompson Sampling-based
 * variant selection and traffic weight computation.
 *
 * Responsibilities (Prompt 48 — clean separation):
 *   This module is the LEARNING ENGINE only — it is NOT used by the router.
 *
 *   Router (ab-router.js)     → always deterministic weighted bucket routing
 *   Bandit (this module)      → computes updated weights from counter data
 *   bandit-update.js          → calls this module + writes weights to KV
 *
 * Thompson Sampling model:
 *   Each variant maintains a Beta distribution posterior:
 *     alpha (α) = conversions + 1           (successes + Jeffreys prior)
 *     beta  (β) = (exposures − conversions) + 1  (failures + Jeffreys prior)
 *
 *   computeBanditWeights() averages N=200 Beta draws per variant to produce
 *   a stable expected-value estimate. A single draw is too noisy — identical
 *   posterior parameters can produce very different weight splits run-to-run.
 *   N=200 reduces per-variant variance to ≈ ±1–2 percentage points.
 *
 *   Computed weights are written back to the AB config by bandit-update.js.
 *   The router picks them up on the next in-memory cache refresh (≤60 s).
 *
 * Exploration floor:
 *   No variant ever receives less than EXPLORATION_FLOOR_PCT percent of
 *   traffic (default 5%). This prevents premature exploitation and keeps
 *   low-traffic variants observable for continued learning.
 *   With 2 variants at floorPct=5: min allocation = 5%, max = 95%.
 *
 * alpha/beta routing authority (Prompt 48):
 *   alpha and beta fields are metadata — written to the AB config for admin
 *   UI inspection and debugging. They do NOT affect routing at request time.
 *   Routing is driven by variant.weight only.
 *
 * Dependencies: none (pure JS, no external imports or KV reads).
 */

/** Minimum traffic allocation per variant (percentage, 1–99). */
export const EXPLORATION_FLOOR_PCT = 5;

// ── Random number generation ───────────────────────────────────────────────────

/**
 * Sample from a standard Normal distribution via the Box-Muller transform.
 * @returns {number}
 */
function normalSample() {
  const u1 = Math.random() || 1e-15; // guard against log(0)
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Sample from a Gamma(shape, rate=1) distribution using the
 * Marsaglia-Tsang squeeze method (valid for shape ≥ 1).
 * For shape < 1 the Ahrens-Dieter power expansion is applied first.
 *
 * @param  {number} shape — must be > 0
 * @returns {number}
 */
function gammaSample(shape) {
  if (shape < 1) {
    // Ahrens-Dieter expansion: Gamma(d) = Gamma(1+d) × U^(1/d)
    return gammaSample(1 + shape) * Math.pow(Math.random() || 1e-15, 1 / shape);
  }

  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);

  for (;;) {
    let x, v;
    do {
      x = normalSample();
      v = 1 + c * x;
    } while (v <= 0);

    v = v * v * v;
    const u = Math.random() || 1e-15;

    // Fast Marsaglia-Tsang acceptance test
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v || 1e-300))) return d * v;
  }
}

/**
 * Sample from a Beta(α, β) distribution via two independent Gamma draws.
 *
 * @param  {number} alpha — must be > 0
 * @param  {number} beta  — must be > 0
 * @returns {number} — sample in [0, 1]
 */
export function betaSample(alpha, beta) {
  const a  = Math.max(alpha, 1e-6);
  const b  = Math.max(beta,  1e-6);
  const ga = gammaSample(a);
  const gb = gammaSample(b);
  const total = ga + gb;
  if (total <= 0) return 0.5; // defensive; unreachable in practice
  return ga / total;
}

// ── Thompson variant selection ─────────────────────────────────────────────────

/**
 * Select a variant slug using a single Thompson draw per variant.
 *
 * Draws θ_i ~ Beta(α_i, β_i) for each variant and returns the slug of
 * the variant with the highest sampled value.
 *
 * NOTE (Prompt 48): This function is NOT used by the router.
 *   The router (ab-router.js) always uses deterministic weighted bucket routing.
 *   thompsonSelect() is retained here for standalone use (e.g. testing,
 *   admin previews, or future dry-run endpoints).
 *
 * @param  {Array<{ slug: string, alpha?: number, beta?: number }>} variants
 * @returns {string} — selected slug
 */
export function thompsonSelect(variants) {
  let bestSlug = variants[variants.length - 1].slug;
  let bestVal  = -1;

  for (const v of variants) {
    const sample = betaSample(
      Math.max(v.alpha ?? 1, 0.01),
      Math.max(v.beta  ?? 1, 0.01),
    );
    if (sample > bestVal) {
      bestVal  = sample;
      bestSlug = v.slug;
    }
  }

  return bestSlug;
}

// ── Bandit weight computation ──────────────────────────────────────────────────

/**
 * Compute integer traffic weights (summing to 100) for all variants using
 * Thompson Sampling with an exploration floor.
 *
 * Algorithm:
 *   1. Average N=200 Beta draws per variant to get a stable expected-value
 *      estimate (single draw is too noisy — identical posteriors can produce
 *      ±30 pp weight variance run-to-run; N=200 reduces this to ≈ ±1–2 pp).
 *   2. Reserve floor_pct per variant as a minimum allocation.
 *   3. Distribute the remaining budget proportionally to the averaged values.
 *   4. Convert to integers via the largest-remainder method (sum = 100).
 *
 * The exploration floor guarantees no variant ever receives less than
 * floorPct% of traffic, preventing starvation of underperforming variants.
 *
 * @param  {Array<{ slug: string, alpha?: number, beta?: number }>} variants
 * @param  {number} floorPct — minimum traffic per variant (default 5)
 * @param  {number} draws    — Beta draws to average per variant (default 200)
 * @returns {number[]} — integer weights, same order as variants, sum = 100
 */
export function computeBanditWeights(variants, floorPct = EXPLORATION_FLOOR_PCT, draws = 200) {
  const n     = variants.length;
  const floor = Math.max(1, Math.min(Math.round(floorPct), Math.floor(100 / n)));
  const budget = 100 - floor * n;

  if (budget <= 0) {
    // Exploration floor exhausts full budget — distribute evenly
    const base    = Math.floor(100 / n);
    const weights = Array.from({ length: n }, () => base);
    let rem = 100 - base * n;
    for (let i = 0; rem > 0; i++, rem--) weights[i]++;
    return weights;
  }

  // Average N Thompson draws per variant for a stable expected-value estimate
  const samples = variants.map((v) => {
    const a = Math.max(v.alpha ?? 1, 0.01);
    const b = Math.max(v.beta  ?? 1, 0.01);
    let sum = 0;
    for (let i = 0; i < draws; i++) sum += betaSample(a, b);
    return sum / draws;
  });

  const total     = samples.reduce((s, x) => s + x, 0) || 1;
  const rawAllocs = samples.map((s) => (s / total) * budget);

  // Integer floor + exploration base
  const weights = rawAllocs.map((w) => floor + Math.floor(w));

  // Largest-remainder method: distribute rounding residual to highest fractionals
  let rem = 100 - weights.reduce((s, w) => s + w, 0);
  const sorted = rawAllocs
    .map((w, i) => ({ i, frac: w - Math.floor(w) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; rem > 0 && k < sorted.length; k++, rem--) {
    weights[sorted[k].i]++;
  }

  return weights;
}
