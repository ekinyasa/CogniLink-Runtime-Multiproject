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
 *   import { deriveCampaignFromSlug, slugify } from "./_shared/slug-utils.js";
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

/**
 * Normalizes and slugifies a string, specifically handling Turkish characters.
 *
 * @param {string} text
 * @returns {string}
 */
export function slugify(text) {
  if (!text) return "";
  const trMap = {
    'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u',
    'Ç': 'c', 'Ğ': 'g', 'İ': 'i', 'Ö': 'o', 'Ş': 's', 'Ü': 'u'
  };
  return String(text)
    .replace(/[çğıöşüÇĞİÖŞÜ]/g, match => trMap[match])
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export const SUBDOMAIN_BLACKLIST = new Set([
  "www", "admin", "login", "api", "assets", "static", "dash", "dashboard", "my", "app", "test", "demo", "sigorta"
]);

export function extractProductSubdomain(urlStr, reqHeaderHost = null) {
  let actualHost = reqHeaderHost;
  try {
    const url = new URL(urlStr);
    if (!actualHost) actualHost = url.hostname;
    const hostSegments = actualHost.split('.');
    if (hostSegments.length >= 3) {
      const sub = hostSegments[0].toLowerCase();
      if (!SUBDOMAIN_BLACKLIST.has(sub)) {
        return sub;
      }
    }
  } catch (e) {}
  return "";
}

export function validateProductSubdomainMatch(subdomain, productString) {
  if (!subdomain) return true; // root domains (or www) can serve anything
  const productSlug = slugify(productString);
  if (!productSlug) return true; // Legacy campaigns without a product pass
  return productSlug === subdomain;
}
