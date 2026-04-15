/**
 * functions/admin/verify/[alias].js — Admin overlay testability endpoint.
 *
 * Route: GET /admin/verify/<alias>?token=<ADMIN_TOKEN>
 *
 * Purpose:
 *   Render the hub page for any alias (including archived fixture aliases)
 *   with admin overlay link-validation badges injected.
 *   Useful after fixture cleanup — the alias is gone from ROUTE_ALIAS but
 *   the operator still needs to verify the hub page rendered correctly.
 *
 * Behaviour:
 *   • Validates ?token= against env.ADMIN_TOKEN (query param, not header,
 *     so the URL is copy-pasteable by operators).
 *   • Looks up the alias in ROUTE_ALIAS (direct KV read — no Workers Cache).
 *   • If live:     renders full hub page + link-validation badges injected
 *                  before </body>.
 *   • If archived: renders a minimal diagnostic page (200 OK) so the
 *                  operator receives a useful response rather than 404.
 *
 * Security:
 *   • Token validated server-side before any KV read.
 *   • Response is always Cache-Control: no-store (embedded token).
 *   • Alias sanitised through validateAlias() before use.
 *   • No analytics events are emitted (pure diagnostic path).
 *
 * Required env bindings:
 *   KV:  ROUTE_ALIAS, APP_CONFIG, LANDING_CONFIG
 *   Var: ADMIN_TOKEN, GA4_ID (opt), META_PIXEL_ID (opt)
 */

import { validateAlias }                from "../../_shared/validators.js";
import { loadHubConfig }                from "../../_shared/alias-router.js";
import { resolveLinks }                 from "../../_shared/links.js";
import { renderHub }                    from "../../_shared/hub-renderer.js";
import { checkHubLinks }                from "../../_shared/test-runner.js";
import { getTtlMs, cacheGet, cacheSet } from "../../_shared/kv-cache.js";
import { deriveCampaignFromSlug }       from "../../_shared/slug-utils.js";

// ── Security headers — always applied ────────────────────────────────────────

const SEC_HEADERS = {
  "X-Robots-Tag":           "noindex,nofollow",
  "X-Content-Type-Options": "nosniff",
  "Cache-Control":          "no-store",
  "Referrer-Policy":        "no-referrer",
};

// ── UTM defaults (mirrors [[path]].js) ───────────────────────────────────────

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

// ── Global hub config loader (mirrors [[path]].js) ───────────────────────────

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

// ── Link-validation overlay script ───────────────────────────────────────────

/**
 * Build an inline <script> that annotates every external hub link with
 * ✔/⚠/✖ badges using pre-fetched link-validation results.
 * JSON is embedded directly (no second fetch required).
 *
 * @param {Array<{ url, state, status }>} linkResults
 * @returns {string}
 */
function buildOverlayScript(linkResults) {
  // Build url → result map; escape < to prevent script injection
  const safeJson = JSON.stringify(
    (linkResults || []).reduce((m, l) => { m[l.url] = l; return m; }, {})
  ).replace(/</g, "\\u003c");

  return `<script>
(function(){
  var map=${safeJson};
  document.querySelectorAll("a[href^='http']").forEach(function(a){
    var base=a.href.split("?")[0].split("#")[0];
    var r=map[base];
    if(!r)return;
    var b=document.createElement("span");
    b.style.cssText="display:inline-block;margin-left:5px;font-size:11px;font-weight:700;vertical-align:middle;line-height:1";
    if(r.state==="valid"){
      b.textContent="\u2714";b.style.color="#1a7f37";b.title="VALID \u00b7 HTTP "+r.status;
    }else if(r.state==="suspicious"){
      b.textContent="\u26a0";b.style.color="#c17b00";b.title="SUSPICIOUS \u00b7 HTTP "+r.status;
    }else{
      b.textContent="\u2716";b.style.color="#b91c1c";b.title="BROKEN \u00b7 HTTP "+r.status;
    }
    a.appendChild(b);
  });
})();
</script>`;
}

// ── Archived-alias diagnostic page ───────────────────────────────────────────

function renderArchivedPage(alias) {
  const ts = new Date().toISOString();
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Verify: ${alias}</title>
<style>
body{font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:3rem auto;padding:0 1.25rem;color:#1a1a1a;line-height:1.5}
h2{font-size:1.1rem;font-weight:600;margin:0 0 .625rem}
p{font-size:.875rem;color:#444;margin:.5rem 0}
code{font-family:ui-monospace,"SF Mono",monospace;font-size:.82rem;background:#f5f5f5;border:1px solid #ddd;border-radius:.2rem;padding:.1rem .35rem}
.badge{display:inline-flex;align-items:center;gap:.3rem;padding:.2rem .6rem;border-radius:.3rem;font-size:.75rem;font-weight:600}
.badge-warn{background:#fff7e6;color:#b45309;border:1px solid #fcd34d}
.meta{font-size:.72rem;color:#999;margin-top:2rem;border-top:1px solid #eee;padding-top:.75rem}
</style>
</head>
<body>
<h2>Admin Verify — <code>${alias}</code></h2>
<p><span class="badge badge-warn">&#x26A0; Alias not in route table</span></p>
<p>
  <code>${alias}</code> was not found in <code>ROUTE_ALIAS</code>.
  It may have been archived after a fixture test run. The hub page
  cannot be rendered, but the alias identifier and access token
  were validated successfully.
</p>
<p>
  To inspect archived fixture analytics, use the Analytics tab
  with <strong>Show test campaigns</strong> enabled.
</p>
<p class="meta">Campaign OS &middot; Admin Verify &middot; ${ts}</p>
</body>
</html>`;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function onRequestGet(context) {
  const { request, env, params } = context;

  // ── Token validation (query param — operator-friendly, not Authorization header) ──
  const url   = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token || !env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
    return new Response(
      "<!DOCTYPE html><html><head><title>Unauthorized</title></head><body><p>Unauthorized</p></body></html>",
      { status: 401, headers: { "Content-Type": "text/html;charset=UTF-8", ...SEC_HEADERS } }
    );
  }

  // ── Alias validation ─────────────────────────────────────────────────────────
  const rawAlias = String(params.alias || "").toLowerCase().trim();
  if (!validateAlias(rawAlias)) {
    return new Response(
      "<!DOCTYPE html><html><head><title>Invalid alias</title></head><body><p>Invalid alias</p></body></html>",
      { status: 400, headers: { "Content-Type": "text/html;charset=UTF-8", ...SEC_HEADERS } }
    );
  }

  const baseUrl = url.origin;
  const ttlMs   = getTtlMs(env);

  // ── ROUTE_ALIAS lookup (direct KV — bypass Workers Cache to get live state) ──
  let canonicalSlug = null;
  try {
    if (env.ROUTE_ALIAS) {
      canonicalSlug = await env.ROUTE_ALIAS.get(`route:${rawAlias}`, { type: "text" });
    }
  } catch (_) { /* treat as not found */ }

  // ── Case B: Alias not found (archived or never existed) ───────────────────────
  if (!canonicalSlug) {
    return new Response(renderArchivedPage(rawAlias), {
      status:  200,
      headers: { "Content-Type": "text/html;charset=UTF-8", ...SEC_HEADERS },
    });
  }

  // ── Case A: Alias is live — render hub + overlay ──────────────────────────────
  // Fetch hub config, global config, and link validation results in parallel.
  const [hubConfig, globalConfig, linkResults] = await Promise.all([
    loadHubConfig(canonicalSlug, env, ttlMs),
    loadGlobalConfig(env, ttlMs),
    checkHubLinks(baseUrl, rawAlias),
  ]);

  const links       = resolveLinks(hubConfig, globalConfig);
  const defaultUtms = buildDefaultUtms(canonicalSlug);
  const campaign    = (hubConfig?.campaign && String(hubConfig.campaign).trim())
    || deriveCampaignFromSlug(canonicalSlug);

  const html = renderHub({
    contextType: "campaign",
    contextId:   canonicalSlug,
    campaign,
    modifier:    "",
    defaultUtms,
    links,
    ga4Id:       env.GA4_ID        || "",
    metaPixelId: env.META_PIXEL_ID || "",
    config:      globalConfig,
  });

  // Inject overlay before </body>
  const finalHtml = html.includes("</body>")
    ? html.replace("</body>", buildOverlayScript(linkResults) + "\n</body>")
    : html + buildOverlayScript(linkResults);

  return new Response(finalHtml, {
    status:  200,
    headers: { "Content-Type": "text/html;charset=UTF-8", ...SEC_HEADERS },
  });
}
