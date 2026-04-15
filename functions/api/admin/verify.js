/**
 * GET /api/admin/verify?alias=<alias>
 *
 * Returns a JSON summary of the resolved hub configuration for the given alias.
 * Stable, parse-error-free diagnostic endpoint.
 *
 * Authentication: Bearer <ADMIN_TOKEN>  (same as all other /api/admin/* endpoints)
 *
 * Response shapes:
 *   Alias live:
 *     { ok: true,  alias, campaign, slug, links: [{ label, url }], defaultUtms }
 *   Alias not found:
 *     { ok: false, alias, reason: "not_in_route_table" }
 *   Auth failure:
 *     401 Unauthorized
 *   Validation failure:
 *     400 { error: "..." }
 *
 * Security:
 *   - ADMIN_TOKEN validated via Authorization: Bearer header (not query param).
 *   - Response is always Cache-Control: no-store.
 *   - Alias sanitised through validateAlias() before use.
 *   - No analytics events emitted (pure diagnostic path).
 *
 * Required env bindings:
 *   KV:  ROUTE_ALIAS, APP_CONFIG, LANDING_CONFIG, SLUG_LINKS
 *   Var: ADMIN_TOKEN
 */

import { verifyToken, unauthorized, jsonHeaders }  from "../../_shared/auth.js";
import { validateAlias }                            from "../../_shared/validators.js";
import { loadHubConfig }                            from "../../_shared/alias-router.js";
import { resolveLinks }                             from "../../_shared/links.js";
import { getTtlMs, cacheGet, cacheSet }             from "../../_shared/kv-cache.js";
import { deriveCampaignFromSlug }                   from "../../_shared/slug-utils.js";

const SEC_HEADERS = {
  "X-Robots-Tag":           "noindex,nofollow",
  "X-Content-Type-Options": "nosniff",
  "Cache-Control":          "no-store",
  "Referrer-Policy":        "no-referrer",
};

function jsonErr(status, error) {
  return new Response(JSON.stringify({ ok: false, error }), {
    status,
    headers: { ...jsonHeaders(), ...SEC_HEADERS },
  });
}

// ── Channel UTM defaults (mirrors [[path]].js) ──────────────────────────────

const CHANNEL_UTM = {
  igbio:   { utm_source: "instagram", utm_medium: "bio" },
  igstory: { utm_source: "instagram", utm_medium: "story" },
  yt:      { utm_source: "youtube",   utm_medium: "description" },
  youtube: { utm_source: "youtube",   utm_medium: "description" },
  spotify: { utm_source: "spotify",   utm_medium: "bio" },
  spbio:   { utm_source: "spotify",   utm_medium: "bio" },
  ttbio:   { utm_source: "tiktok",    utm_medium: "bio" },
  ttstory: { utm_source: "tiktok",    utm_medium: "story" },
  ttpaid:  { utm_source: "tiktok",    utm_medium: "paid" },
  fbpost:  { utm_source: "facebook",  utm_medium: "post" },
  meta:    { utm_source: "meta",      utm_medium: "paid" },
  google:  { utm_source: "google",    utm_medium: "cpc" },
};

function buildDefaultUtms(canonicalSlug) {
  const lastDash      = canonicalSlug.lastIndexOf("-");
  const channelSuffix = lastDash >= 0 ? canonicalSlug.slice(lastDash + 1) : "";
  return CHANNEL_UTM[channelSuffix] || {};
}

// ── Global hub config ────────────────────────────────────────────────────────

async function loadGlobalConfig(env, ttlMs) {
  const CACHE_KEY = "global_cfg:hub_config";
  const cached    = cacheGet(CACHE_KEY);
  if (cached !== null) return cached;

  let config = {};
  try {
    if (env.LANDING_CONFIG) {
      const raw = await env.LANDING_CONFIG.get("hub_config", { type: "json" });
      if (raw && typeof raw === "object") config = raw;
    }
  } catch (_) {}

  cacheSet(CACHE_KEY, config, ttlMs);
  return config;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!verifyToken(request, env)) return unauthorized();

  const url      = new URL(request.url);
  const rawAlias = (url.searchParams.get("alias") || "").toLowerCase().trim();

  if (!rawAlias || !validateAlias(rawAlias)) {
    return jsonErr(400, "Invalid or missing alias parameter");
  }

  const ttlMs = getTtlMs(env);

  // ROUTE_ALIAS lookup (direct KV — bypass Workers Cache to get live state)
  let canonicalSlug = null;
  try {
    if (env.ROUTE_ALIAS) {
      canonicalSlug = await env.ROUTE_ALIAS.get(`route:${rawAlias}`, { type: "text" });
    }
  } catch (_) {}

  // Alias not found (archived or never existed)
  if (!canonicalSlug) {
    return new Response(
      JSON.stringify({ ok: false, alias: rawAlias, reason: "not_in_route_table" }),
      { status: 200, headers: { ...jsonHeaders(), ...SEC_HEADERS } }
    );
  }

  // Alias is live — resolve config + links
  const [hubConfig, globalConfig] = await Promise.all([
    loadHubConfig(canonicalSlug, env, ttlMs),
    loadGlobalConfig(env, ttlMs),
  ]);

  const links       = resolveLinks(hubConfig, globalConfig);
  const defaultUtms = buildDefaultUtms(canonicalSlug);
  const campaign    = (hubConfig?.campaign && String(hubConfig.campaign).trim())
    || deriveCampaignFromSlug(canonicalSlug);

  // Flatten links to { label, url } for clean JSON output
  const linksOut = (links || []).map(function (l) {
    return { label: l.label || l.id || "", url: l.url || "" };
  });

  return new Response(
    JSON.stringify({
      ok:          true,
      alias:       rawAlias,
      campaign,
      slug:        canonicalSlug,
      defaultUtms,
      links:       linksOut,
    }),
    { status: 200, headers: { ...jsonHeaders(), ...SEC_HEADERS } }
  );
}
