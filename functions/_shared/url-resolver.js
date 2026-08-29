/**
 * functions/_shared/url-resolver.js
 * 
 * Central URL resolver for Landing Canonical URLs, Landing Aliases,
 * Campaign URLs, and Base Delivery URL resolution.
 */

/**
 * Normalize a slug or alias string (lowercase, trimmed, strip invalid characters).
 * Example: " Sigorta / Yenileme-Cold " -> "sigorta-yenileme-cold"
 */
export function normalizeSlug(str) {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-");
}

/**
 * Resolve the public delivery base URL using priority:
 * 1. env.PUBLIC_DELIVERY_BASE_URL
 * 2. env.PUBLIC_SITE_BASE_URL
 * 3. request.url origin (if request object is provided)
 * 4. window.location.origin (if in browser context)
 * 5. Hardcoded default fallback ("https://runtime.ekinyasa.online")
 */
export function resolveBaseUrl(env = {}, request = null) {
  let base = "";
  if (request) {
    try {
      const u = new URL(request.url);
      const originalHost = request.headers.get("x-forwarded-host") || request.headers.get("x-original-host") || u.hostname;
      base = u.protocol + "//" + originalHost;
    } catch (e) {}
  }
  if (!base && env && typeof env === "object") {
    base = env.PUBLIC_DELIVERY_BASE_URL || env.PUBLIC_SITE_BASE_URL || "";
  }
  if (!base && typeof window !== "undefined" && window && window.location) {
    try {
      base = window.location.origin;
    } catch (e) {}
  }
  if (!base) {
    base = "https://runtime.ekinyasa.online";
  }
  return base.replace(/\/+$/, "");
}

/**
 * Build Canonical Landing URL (/l/{slug})
 */
export function buildLandingCanonicalUrl(slug, env = {}, request = null) {
  const base = resolveBaseUrl(env, request);
  const clean = normalizeSlug(slug);
  return clean ? `${base}/l/${clean}` : "";
}

/**
 * Build Landing Alias URL (/{alias})
 */
export function buildLandingAliasUrl(alias, env = {}, request = null) {
  if (!alias) return "";
  const base = resolveBaseUrl(env, request);
  const clean = normalizeSlug(alias);
  return clean ? `${base}/${clean}` : "";
}

/**
 * Build Campaign URL (/c/{slug})
 */
export function buildCampaignUrl(slug, env = {}, request = null) {
  const base = resolveBaseUrl(env, request);
  const clean = normalizeSlug(slug);
  return clean ? `${base}/c/${clean}` : "";
}

/**
 * Resolve relative or absolute destination URL against public delivery base URL.
 * e.g. "/l/sigorta-yenileme-hot" -> "https://runtime.ekinyasa.online/l/sigorta-yenileme-hot"
 */
export function resolveDestinationUrl(targetUrl, env = {}, request = null, campaignConfig = null) {
  if (!targetUrl) return "";
  if (targetUrl.startsWith("http://") || targetUrl.startsWith("https://")) {
    return targetUrl;
  }
  
  // Parse version ID if present to resolve to Alias or Canonical Slug
  let versionId = "";
  const match = targetUrl.match(/version-\d+/);
  if (match) {
    versionId = match[0];
  }
  
  if (versionId && campaignConfig && Array.isArray(campaignConfig.landings)) {
    const landing = campaignConfig.landings.find(l => l.id === versionId);
    if (landing) {
      const alias = (landing.alias || "").trim();
      const slug = (landing.slug || landing.id || "").trim();
      const base = resolveBaseUrl(env, request);
      
      // Priority 1: Alias URL
      if (alias) {
        const cleanAlias = alias.startsWith("/") ? alias : "/" + alias;
        return `${base}${cleanAlias}`;
      }
      
      // Priority 2: Canonical Slug URL (with product prefix stripped if on custom domain)
      if (slug) {
        let clean = normalizeSlug(slug);
        const product = campaignConfig.product || "";
        if (product && clean) {
          const prefix = normalizeSlug(product) + "-";
          if (clean.startsWith(prefix)) {
            clean = clean.substring(prefix.length);
          }
        }
        return clean ? `${base}/l/${clean}` : "";
      }
    }
  }

  const base = resolveBaseUrl(env, request);
  const cleanPath = targetUrl.startsWith("/") ? targetUrl : "/" + targetUrl;
  return `${base}${cleanPath}`;
}
