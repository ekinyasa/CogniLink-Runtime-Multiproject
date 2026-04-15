/**
 * ab-router.js — Deterministic alias A/B routing (Traffic Intelligence Layer — Phase 1).
 *
 * Allows an alias to optionally distribute traffic across multiple canonical
 * slugs using a fixed weight split. Routing is deterministic — the same
 * requestId always resolves to the same variant within a given config version.
 *
 * Config storage:
 *   AB_INDEX["ab_config:<alias>"] = {
 *     variants:    [{ slug: string, weight: integer, alpha?: number, beta?: number }],
 *     updatedAt:   ISO string,
 *     // Lifecycle fields (optional — default to RUNNING when absent):
 *     state:       "DRAFT" | "RUNNING" | "PAUSED" | "DECIDED" | "ARCHIVED",
 *     winner:      null | slug string,
 *     created_at:  unix timestamp (seconds) | null,
 *     decided_at:  unix timestamp (seconds) | null,
 *     archived_at: unix timestamp (seconds) | null,
 *   }
 *
 * alpha/beta per variant are metadata only (Prompt 48):
 *   Written by POST /api/experiment/bandit-update for admin inspection.
 *   The router never reads alpha/beta — only variant.weight drives routing.
 *   Bandit learning (weight computation) is entirely in bandit-update.js.
 *
 * Cache:
 *   Uses kv-cache.js in-memory TTL cache (60 s default).
 *   Sentinel object { _no_ab_config: true } is stored when no config exists
 *   so repeated "no-config" requests do not read KV on every request.
 *
 * Deterministic selection algorithm:
 *   1. Strip non-hex chars from requestId; take the last 8 hex chars.
 *   2. Parse as a hexadecimal integer.
 *   3. bucket = value % 100  (range: 0–99)
 *   4. Walk variants by cumulative weight; return the slug of the first
 *      variant whose cumulative weight exceeds the bucket.
 *
 *   This guarantees:
 *     - Same requestId → same variant (within one config version).
 *     - Uniform distribution across 100 buckets when weights sum to 100.
 *     - No redirect loops — variant slug is used directly for rendering,
 *       not fed back into resolveAlias().
 */

import { cacheGet, cacheSet } from "./kv-cache.js";

const AB_CACHE_PREFIX = "ab_cfg:";
const AB_CACHE_TTL_MS = 60_000;   // 60 s in-memory TTL (same as default kv-cache TTL)

/** Sentinel: cached when no config exists so we avoid KV on every miss. */
const AB_NO_CONFIG = Object.freeze({ _no_ab_config: true });

// ── Config validation ──────────────────────────────────────────────────────────

/**
 * Validate an A/B routing config object before caching or storing.
 *
 * Rules:
 *   • variants must be an array with 2–10 elements
 *   • each variant: { slug: /^[a-z0-9-]{1,200}$/, weight: integer >= 1 }
 *   • sum of all weights must equal exactly 100
 *
 * @param  {unknown} config
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function validateABConfig(config) {
  if (!config || typeof config !== "object") {
    return { ok: false, reason: "config_not_object" };
  }

  const { variants } = config;

  if (!Array.isArray(variants)) {
    return { ok: false, reason: "variants_not_array" };
  }
  if (variants.length < 2 || variants.length > 10) {
    return { ok: false, reason: "variants_count_out_of_range" };
  }

  let total = 0;
  for (let i = 0; i < variants.length; i++) {
    const v = variants[i];
    if (!v || typeof v !== "object") {
      return { ok: false, reason: `variant_${i}_not_object` };
    }
    if (typeof v.slug !== "string" || !/^[a-z0-9-]{1,200}$/.test(v.slug)) {
      return { ok: false, reason: `variant_${i}_invalid_slug` };
    }
    if (!Number.isInteger(v.weight) || v.weight < 1) {
      return { ok: false, reason: `variant_${i}_invalid_weight` };
    }
    total += v.weight;
  }

  if (total !== 100) {
    return { ok: false, reason: "weights_must_sum_to_100" };
  }

  return { ok: true };
}

// ── Config loader ──────────────────────────────────────────────────────────────

/**
 * Load A/B config for an alias from AB_INDEX, with in-memory caching.
 *
 * Returns null when:
 *   - AB_INDEX is not bound
 *   - no config exists for this alias
 *   - config fails validateABConfig()
 *
 * The "no config" state is also cached (AB_NO_CONFIG sentinel) to avoid
 * a KV read on every request for unregistered aliases.
 *
 * @param  {string} alias
 * @param  {object} env   — Workers env
 * @returns {Promise<object|null>}  validated config object, or null
 */
export async function loadABConfig(alias, env) {
  const cacheKey = `${AB_CACHE_PREFIX}${alias}`;
  const cached   = cacheGet(cacheKey);

  // Only honour the AB_NO_CONFIG sentinel (aliases with no experiment configured).
  // Valid config data is intentionally NOT served from cache (P82):
  //   bandit rebalances update KV weights; serving stale cached weights bypasses
  //   those updates for the full 60 s TTL window across all edge isolates.
  //   Reading fresh from KV on every request ensures variant selection always
  //   reflects the latest persisted weights.
  if (cached !== null && cached._no_ab_config) return null;

  // AB_INDEX not bound — no A/B config possible
  if (!env?.AB_INDEX) {
    cacheSet(cacheKey, AB_NO_CONFIG, AB_CACHE_TTL_MS);
    return null;
  }

  let raw = null;
  try {
    raw = await env.AB_INDEX.get(`ab_config:${alias}`, { type: "json" });
  } catch (_) {
    // KV read error — treat as no config; do NOT cache (transient failure)
    return null;
  }

  if (!raw) {
    cacheSet(cacheKey, AB_NO_CONFIG, AB_CACHE_TTL_MS);
    return null;
  }

  // Validate before returning — invalid configs are treated as absent
  const check = validateABConfig(raw);
  if (!check.ok) {
    console.error("[ab-router] invalid config for alias", alias, "reason:", check.reason);
    cacheSet(cacheKey, AB_NO_CONFIG, AB_CACHE_TTL_MS);
    return null;
  }

  // P82: Do NOT cache valid configs — always return fresh KV data so bandit
  // weight changes are immediately reflected in variant selection across all isolates.
  // AB_NO_CONFIG sentinel IS still cached (avoids redundant KV reads for aliases
  // that have no experiment configured).
  return raw;
}

// ── Lifecycle helpers ─────────────────────────────────────────────────────────

/** Valid experiment states (ordered from least → most terminal). */
export const EXP_STATES = Object.freeze(["DRAFT", "RUNNING", "PAUSED", "DECIDED", "ARCHIVED"]);

/**
 * Return the effective lifecycle state for a config object.
 * Absent / invalid values default to "RUNNING" for backward compatibility.
 *
 * @param  {object|null} config — loaded AB config
 * @returns {"DRAFT"|"RUNNING"|"PAUSED"|"DECIDED"|"ARCHIVED"}
 */
export function getExpState(config) {
  if (!config) return "RUNNING";
  // Full lifecycle state field takes precedence (most specific).
  const s = config.state;
  if (typeof s === "string" && EXP_STATES.includes(s)) return s;
  // Fallback: simplified status field (Section 2 — Prompt 46).
  // Handles configs that only carry status:"decided" without a state field
  // (e.g. configs created before the full lifecycle state machine was introduced).
  if (config.status === "decided") return "DECIDED";
  return "RUNNING";
}

// ── Variant selector ───────────────────────────────────────────────────────────

/**
 * Select a canonical slug variant from the A/B config using deterministic
 * weighted bucket routing.
 *
 * Algorithm:
 *   1. Strip non-hex chars from requestId; take the last 8 hex chars.
 *   2. Parse as a 32-bit integer; derive bucket = value % 100  (range 0–99).
 *   3. Normalise: r = (bucket / 100) * totalWeight  → r ∈ [0, totalWeight).
 *   4. Walk variants by cumulative weight; return the slug of the first
 *      variant whose cumulative weight exceeds r.
 *
 * Routing authority: variant.weight only.
 *   alpha/beta fields (written by bandit-update for learning purposes) are
 *   explicitly ignored here — they are metadata for the admin UI and
 *   bandit-update's learning loop, not routing inputs.
 *
 * Weight updates:
 *   POST /api/experiment/bandit-update reads counter data, runs Thompson
 *   sampling with N=200 draws, and writes new integer weights to the config.
 *   The router picks up those weights on the next cache refresh (≤60 s).
 *
 * @param  {object} config    — validated A/B config (from loadABConfig)
 * @param  {string} requestId — cf-ray or crypto.randomUUID()
 * @returns {string}           — selected canonical slug
 */
export function selectABVariant(config, requestId) {
  const hexAll = String(requestId || "").replace(/[^0-9a-f]/gi, "") || "00000000";
  const hex8   = hexAll.slice(-8) || "0";
  const bucket = parseInt(hex8, 16) % 100;   // [0, 99] — entropy source unchanged

  // Canonical weighted sampler.
  // Scale bucket to [0, totalWeight) so the algorithm is correct for any
  // weight sum, not only when weights happen to equal exactly 100.
  const totalWeight = config.variants.reduce((sum, v) => sum + v.weight, 0);
  const r           = (bucket / 100) * totalWeight;

  let cumulative = 0;
  for (const variant of config.variants) {
    cumulative += variant.weight;
    if (r < cumulative) return variant.slug;
  }

  // Defensive fallback — unreachable when weights are positive and sum correctly
  return config.variants[config.variants.length - 1].slug;
}
