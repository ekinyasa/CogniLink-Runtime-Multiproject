/**
 * slug-utils.js — Shared slug parsing utilities.
 *
 * Single source of truth for channel suffix detection and campaign derivation.
 * Previously duplicated as:
 *   - deriveCampaign()        in alias-router.js  (uses KNOWN_CHANNELS Set)
 *   - buildCampaignFromSlug() in [[path]].js      (uses CHANNEL_UTM object keys)
 *
 * Both had identical logic and the same 5 channel identifiers.
 * Unified here so future channel additions only need one change.
 *
 * Usage:
 *   import { deriveCampaignFromSlug } from "./_shared/slug-utils.js";
 */

/**
 * Known channel suffix identifiers.
 * Convention: canonical slug = "{campaign}-{channel}"  e.g. "new-beta-igbio"
 *
 * When the last dash-segment of a canonical slug matches one of these identifiers,
 * everything before the last dash is the campaign name.
 * If the suffix is not recognised, campaign is returned as "".
 */
export const KNOWN_CHANNELS = new Set([
  "igbio",
  "igstory",
  "yt",
  "youtube",
  "spotify",
]);

/**
 * Derive the campaign name from a canonical slug.
 *
 * @param  {string} canonicalSlug  e.g. "new-beta-igbio"
 * @returns {string}               e.g. "new-beta"  or ""
 *
 * @example
 *   deriveCampaignFromSlug("new-beta-igbio")  // → "new-beta"
 *   deriveCampaignFromSlug("promo-yt")         // → "promo"
 *   deriveCampaignFromSlug("someslug")         // → ""  (no known suffix)
 *   deriveCampaignFromSlug("")                 // → ""
 */
export function deriveCampaignFromSlug(canonicalSlug) {
  const lastDash = canonicalSlug.lastIndexOf("-");
  if (lastDash < 1) return "";
  const suffix = canonicalSlug.slice(lastDash + 1);
  return KNOWN_CHANNELS.has(suffix) ? canonicalSlug.slice(0, lastDash) : "";
}
