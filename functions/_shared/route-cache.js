/**
 * route-cache.js — Workers Cache API layer for route resolution.
 *
 * Provides the zero-KV-read warm path by caching resolved canonical_slug
 * values in caches.default (zone-scoped CDN cache).
 *
 * ┌────────────────────────────────────────────────────────────────┐
 * │  Cache key format:                                             │
 * │    URL: https://route-cache.linkhub.internal/<routeKey>       │
 * │    where routeKey = alias  OR  alias@modifier                 │
 * │                                                                │
 * │  Cache value: canonical_slug (plain text, max 200 chars)      │
 * │                                                                │
 * │  TTL: ROUTE_CACHE_TTL env var (seconds; default 60)           │
 * └────────────────────────────────────────────────────────────────┘
 *
 * Performance targets:
 *   warm path: 0 KV reads
 *   cold path: 1 KV read (ROUTE_ALIAS) then cache is populated
 *
 * Availability:
 *   caches.default is available in the Cloudflare Workers runtime used by
 *   Pages Functions. In local dev (wrangler pages dev) it may not be
 *   available — all functions degrade gracefully (get → null, put/delete → no-op).
 */

const CACHE_BASE    = "https://route-cache.linkhub.internal/";
const DEFAULT_TTL_S = 60;

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Build the cache URL for a given route key.
 * encodeURIComponent prevents '@' or other chars from breaking the URL.
 *
 * @param  {string} routeKey  — e.g. "album" or "album@ig"
 * @returns {string}
 */
function cacheUrl(routeKey) {
  return CACHE_BASE + encodeURIComponent(routeKey);
}

/**
 * Resolve the configured cache TTL in seconds.
 *
 * @param  {object} env  — Workers env
 * @returns {number}     — seconds
 */
function getTtlSeconds(env) {
  const raw = env?.ROUTE_CACHE_TTL;
  if (!raw) return DEFAULT_TTL_S;
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TTL_S;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Look up a canonical_slug in Workers Cache.
 * Returns null on miss or if caches.default is unavailable.
 *
 * @param  {string} routeKey
 * @returns {Promise<string|null>}
 */
export async function routeCacheGet(routeKey) {
  try {
    const cache = caches.default;
    const resp  = await cache.match(cacheUrl(routeKey));
    if (!resp) return null;
    return await resp.text();
  } catch (_) {
    // local dev: caches.default unavailable — treat as cache miss
    return null;
  }
}

/**
 * Store a canonical_slug in Workers Cache.
 * Silently no-ops if caches.default is unavailable.
 *
 * @param {string} routeKey
 * @param {string} canonicalSlug
 * @param {object} env
 * @returns {Promise<void>}
 */
export async function routeCacheSet(routeKey, canonicalSlug, env) {
  try {
    const cache = caches.default;
    const ttl   = getTtlSeconds(env);
    const resp  = new Response(canonicalSlug, {
      headers: {
        "Cache-Control": `public, max-age=${ttl}`,
        "Content-Type":  "text/plain;charset=UTF-8",
      },
    });
    await cache.put(cacheUrl(routeKey), resp);
  } catch (_) {
    // local dev fallback — no-op
  }
}

/**
 * Invalidate a single route key from Workers Cache.
 * Must be called whenever ROUTE_ALIAS is updated for this route key.
 *
 * @param  {string} routeKey
 * @returns {Promise<void>}
 */
export async function invalidateRouteCache(routeKey) {
  try {
    await caches.default.delete(cacheUrl(routeKey));
  } catch (_) {}
}

/**
 * Invalidate multiple route keys from Workers Cache in parallel.
 * Call this after a compileRoutes() run to ensure stale cache entries
 * are not served.
 *
 * @param  {string[]} routeKeys
 * @returns {Promise<void>}
 */
export async function invalidateRoutes(routeKeys) {
  if (!routeKeys?.length) return;
  try {
    const cache = caches.default;
    await Promise.all(routeKeys.map(k => cache.delete(cacheUrl(k))));
  } catch (_) {}
}

export { DEFAULT_TTL_S };
