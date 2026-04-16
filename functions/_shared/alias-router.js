/**
 * alias-router.js — Campaign OS runtime routing pipeline (v2).
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  RUNTIME READS ONLY:  ROUTE_ALIAS + APP_CONFIG                          │
 * │  NEVER reads at runtime: CAMPAIGN_AB_ALIAS_INDEX, AB_INDEX              │
 * │  (those are ops-only truth sources, consumed by route-compiler.js)       │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Public routing pipeline (8 steps):
 *   1. parsePath(rawPath)             → { alias, modifier } | { error }
 *   2. validate alias + modifier      → validateAlias / validateModifier
 *   3. buildRouteKey(alias, modifier) → "album" | "album@ig"
 *   4. Workers Cache lookup           → routeCacheGet(routeKey)
 *   5. ROUTE_ALIAS KV lookup (on miss)→ ROUTE_ALIAS.get("route:<routeKey>")
 *   6. 404 on miss                   → no fallback resolution
 *   7. validateCanonicalSlug(slug)    → format guard
 *   8. return { ok, canonicalSlug, cacheHit }
 *
 * Hub config loading (separate concern, called by catch-all handler):
 *   loadHubConfig(canonicalSlug, env, ttlMs)
 *     → APP_CONFIG["hub:<slug>"]   (new Campaign OS records)
 *     → SLUG_LINKS["<slug>"]    (ONLY if ENABLE_LEGACY_HUB_FALLBACK=true)
 *     → null                       (render with defaults)
 *
 * CANONICAL SLUG INVARIANT
 *   Only canonical_slug flows past the resolution boundary into rendering
 *   and analytics. alias and modifier are dropped at Step 8.
 */

import { validateAlias, validateModifier, validateCanonicalSlug } from "./validators.js";
import { routeCacheGet, routeCacheSet }                            from "./route-cache.js";
import { cacheGet, cacheSet, getTtlMs }                           from "./kv-cache.js";
import { emitOps, OPS_EVENTS }                                    from "./ops-telemetry.js";
import { deriveCampaignFromSlug }                                  from "./slug-utils.js";

// ── Path parsing ──────────────────────────────────────────────────────────────

/**
 * Normalize and parse a raw path string into alias + optional modifier.
 *
 * Safety guards:
 *   - lowercase + trim + strip trailing slashes
 *   - reject path traversal ("." / ".." segments)
 *   - reject empty segments
 *   - reject 0 or 3+ segments
 *   - reject characters outside [a-z0-9-] (via validateAlias / validateModifier)
 *   - enforce max lengths: alias ≤ 48, modifier ≤ 32
 *
 * Does NOT auto-correct. Invalid input → deterministic { error, status: 404 }.
 *
 * @param  {string} rawPath  — e.g. "/album" or "/album/ig"
 * @returns {{ alias: string, modifier: string|null }
 *          | { error: string, status: 404 }}
 */
export function parsePath(rawPath) {
  const normalized = String(rawPath || "")
    .toLowerCase()
    .trim()
    .replace(/\/+$/, "");     // strip trailing slash(es)

  const parts = normalized.split("/").filter(Boolean);

  // 0 or 3+ segments → 404
  if (parts.length === 0 || parts.length > 2) {
    return { error: "invalid_path_segments", status: 404 };
  }

  // Path traversal guard
  for (const part of parts) {
    if (part === "." || part === "..") {
      return { error: "path_traversal", status: 404 };
    }
  }

  const alias    = parts[0];
  const modifier = parts[1] ?? null;

  if (!validateAlias(alias)) {
    return { error: "invalid_alias", status: 404 };
  }
  if (modifier !== null && !validateModifier(modifier)) {
    return { error: "invalid_modifier", status: 404 };
  }

  return { alias, modifier };
}

// ── Route key ─────────────────────────────────────────────────────────────────

/**
 * Build the canonical route key used in both ROUTE_ALIAS and Workers Cache.
 *
 * Format:
 *   alias only      → "<alias>"         (e.g. "album")
 *   alias+modifier  → "<alias>@<mod>"   (e.g. "album@ig")
 *
 * The "route:" KV prefix is applied by the caller (ROUTE_ALIAS.get("route:<key>")).
 *
 * @param  {string}      alias
 * @param  {string|null} modifier
 * @returns {string}
 */
export function buildRouteKey(alias, modifier) {
  return modifier !== null ? `${alias}@${modifier}` : alias;
}

// ── Main resolution pipeline ──────────────────────────────────────────────────

/**
 * Resolve a route key to a canonical_slug (Steps 3–8).
 *
 * @param {object}      opts
 * @param {string}      opts.alias
 * @param {string|null} opts.modifier
 * @param {object}      opts.env          — Workers env
 * @param {string}      [opts.requestId]  — cf-ray or generated UUID
 *
 * @returns {Promise<
 *   { ok: true,  canonicalSlug: string, cacheHit: boolean }
 * | { ok: false, status: 404, reason: string }
 * >}
 */
export async function resolveAlias({ alias, modifier, env, requestId = "" }) {
  const routeKey = buildRouteKey(alias, modifier);

  // ── Step 4: Workers Cache lookup ──────────────────────────────────────────
  const cached = await routeCacheGet(routeKey);
  if (cached !== null) {
    // Cache poisoning guard: validate format before trusting the cached value
    if (!validateCanonicalSlug(cached)) {
      emitOps(env, OPS_EVENTS.ROUTE_FAIL_REGISTRY_INCONSISTENT, {
        alias, modifier: modifier ?? "", request_id: requestId,
        detail: { reason: "invalid_cached_slug", cached_prefix: cached.slice(0, 50) },
      });
      // Fall through to KV read (treat as cache miss)
    } else {
      // NOTE: TRAFFIC_MEMORY is emitted in [[path]].js after A/B variant selection
      //       so it always records the final slug that was served.
      return { ok: true, canonicalSlug: cached, cacheHit: true };
    }
  }

  // ── Step 5: ROUTE_ALIAS KV lookup ─────────────────────────────────────────
  if (!env.ROUTE_ALIAS) {
    emitOps(env, OPS_EVENTS.ROUTE_FAIL_REGISTRY_INCONSISTENT, {
      alias, request_id: requestId,
      detail: { reason: "ROUTE_TABLE_not_bound" },
    });
    return { ok: false, status: 404, reason: "ROUTE_TABLE_not_bound" };
  }

  let kvSlug = null;
  try {
    kvSlug = await env.ROUTE_ALIAS.get(`route:${routeKey}`, { type: "text" });
  } catch (e) {
    emitOps(env, OPS_EVENTS.ROUTE_FAIL_REGISTRY_INCONSISTENT, {
      alias, modifier: modifier ?? "", request_id: requestId,
      detail: { reason: "ROUTE_TABLE_read_error", error: e?.message },
    });
    return { ok: false, status: 404, reason: "ROUTE_TABLE_read_error" };
  }

  // ── Step 6: KV miss ───────────────────────────────────────────────────────
  if (kvSlug === null) {
    // ── Step 6a: Modifier fallback — try the base alias ──────────────────
    if (modifier !== null) {
      let baseSlug = null;
      try {
        baseSlug = await env.ROUTE_ALIAS.get(`route:${alias}`, { type: "text" });
      } catch (_) {}

      if (baseSlug !== null && validateCanonicalSlug(baseSlug)) {
        routeCacheSet(routeKey, baseSlug, env).catch(() => {});
        return { ok: true, canonicalSlug: baseSlug, cacheHit: false };
      }
    }

    // ── Step 6b: Direct Page ID fallback (Unify Pages + Aliases) ──────────
    // If no explicit alias is found, check if the alias matches a Page ID.
    // This allows /my-landing-page to work if "my-landing-page" exists in APP_CONFIG.
    if (env.APP_CONFIG) {
      try {
        // We only check if it EXISTS. loadHubConfig will actually fetch the body later.
        const pageExists = await env.APP_CONFIG.get(`hub:${alias}`, { type: "json" });
        if (pageExists !== null) {
          // Canonical slug is the alias itself
          return { ok: true, canonicalSlug: alias, cacheHit: false };
        }
      } catch (_) {}
    }

    // Final failure
    emitOps(env, OPS_EVENTS.ROUTE_FAIL_NOT_FOUND, {
      alias, modifier: modifier ?? "", request_id: requestId,
    });
    return { ok: false, status: 404, reason: "alias_not_found" };
  }

  // ── Step 7: Canonical slug format validation ───────────────────────────────
  if (!validateCanonicalSlug(kvSlug)) {
    emitOps(env, OPS_EVENTS.ROUTE_FAIL_REGISTRY_INCONSISTENT, {
      alias, modifier: modifier ?? "", request_id: requestId,
      detail: { reason: "invalid_slug_in_route_table", value_prefix: kvSlug.slice(0, 50) },
    });
    return { ok: false, status: 404, reason: "invalid_canonical_slug_in_route_table" };
  }

  // ── Populate Workers Cache for subsequent requests ────────────────────────
  // Fire-and-forget: failure must not block the response
  routeCacheSet(routeKey, kvSlug, env).catch(() => {});

  // ── Step 8: Return canonical_slug; alias + modifier go no further ─────────
  // NOTE: TRAFFIC_MEMORY is emitted in [[path]].js after A/B variant selection
  return { ok: true, canonicalSlug: kvSlug, cacheHit: false };
  // NOTE: TRAFFIC_MEMORY is emitted in [[path]].js after A/B variant selection
  return { ok: true, canonicalSlug: kvSlug, cacheHit: false };
}

// ── Hub config loader ─────────────────────────────────────────────────────────

/**
 * Load per-slug hub config with in-memory TTL cache.
 *
 * Lookup order:
 *   1. In-memory cache (kv-cache.js, module-level Map)
 *   2. APP_CONFIG["hub:<canonicalSlug>"]          — Campaign OS records
 *   3. SLUG_LINKS["<canonicalSlug>"]           — always enabled fallback
 *      (alias hub must produce identical output to slug hub — PART 4)
 *   4. null — render with defaults
 *
 * @param {string} canonicalSlug
 * @param {object} env
 * @param {number} ttlMs
 * @returns {Promise<object|null>}
 */
export async function loadHubConfig(canonicalSlug, env, ttlMs) {
  const cacheKey = `hubcfg:${canonicalSlug}`;
  const cached   = cacheGet(cacheKey);
  if (cached !== null) return cached;

  // 1. APP_CONFIG (Campaign OS layout)
  if (env.APP_CONFIG) {
    try {
      const cfg = await env.APP_CONFIG.get(`hub:${canonicalSlug}`, { type: "json" });
      if (cfg !== null && cfg !== undefined) {
        cacheSet(cacheKey, cfg, ttlMs);
        return cfg;
      }
    } catch (_) {}
  }

  // 2. SLUG_LINKS fallback — always enabled so alias hub matches slug hub (PART 4)
  // Slugs written via /api/slug go to SLUG_LINKS. Without this fallback the alias
  // hub renders with null config while /c/<slug> renders the full slug record.
  if (env.SLUG_LINKS) {
    try {
      const legacy = await env.SLUG_LINKS.get(canonicalSlug, { type: "json" });
      if (legacy !== null && legacy !== undefined) {
        cacheSet(cacheKey, legacy, ttlMs);
        return legacy;
      }
    } catch (_) {}
  }

  // 3. No config found — caller renders with defaults
  cacheSet(cacheKey, null, ttlMs);
  return null;
}
