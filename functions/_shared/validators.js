/**
 * validators.js — Strict input validation for public route grammar.
 *
 * All functions are synchronous and dependency-free.
 * Invalid inputs MUST produce deterministic 404 — no auto-correction.
 *
 * Public grammar constraints:
 *   alias    : [a-z0-9-], max 48 chars
 *   modifier : [a-z0-9-], max 32 chars
 *   canonical_slug : [a-z0-9-], at least one dash, max 200 chars
 *
 * Safety guards enforced here:
 *   - empty strings rejected
 *   - illegal characters rejected  (anything outside [a-z0-9-])
 *   - length caps enforced
 *   - no auto-correction or trimming (caller must normalize first)
 */

// ── Regex constants ───────────────────────────────────────────────────────────

/** Alias: only lowercase a-z0-9 and hyphen, 1–48 chars */
const ALIAS_RE = /^[a-z0-9-]{1,48}$/;

/** Modifier: same charset, 1–32 chars */
const MODIFIER_RE = /^[a-z0-9-]{1,32}$/;

/**
 * Canonical slug:
 *   - starts + ends with [a-z0-9]
 *   - at least one hyphen (separates campaign_id from channel_id)
 *   - only [a-z0-9-]
 */
const CANONICAL_SLUG_RE = /^[a-z0-9][a-z0-9-]*-[a-z0-9][a-z0-9-]*$/;
const CANONICAL_SLUG_MAX = 200;

// ── Validation functions ──────────────────────────────────────────────────────

/**
 * Validate a public alias path segment.
 *
 * @param  {string} alias
 * @returns {boolean}
 */
export function validateAlias(alias) {
  return typeof alias === "string" && ALIAS_RE.test(alias);
}

/**
 * Validate a public modifier path segment.
 *
 * @param  {string} modifier
 * @returns {boolean}
 */
export function validateModifier(modifier) {
  return typeof modifier === "string" && MODIFIER_RE.test(modifier);
}

/**
 * Validate a canonical_slug format.
 *
 * NOTE: Existence in AB_INDEX is an ops-time concern (checked during
 * route compilation, not at runtime), so this function performs format
 * validation only — no KV reads.
 *
 * @param  {string} slug
 * @returns {boolean}
 */
export function validateCanonicalSlug(slug) {
  return (
    typeof slug === "string" &&
    slug.length <= CANONICAL_SLUG_MAX &&
    CANONICAL_SLUG_RE.test(slug)
  );
}
