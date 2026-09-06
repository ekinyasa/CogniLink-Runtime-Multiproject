/**
 * functions/[[path]].js — Campaign OS catch-all route handler (v2).
 *
 * Handles ALL public alias traffic. Specific dedicated handlers
 * (ig.js, youtube.js, spotify.js, nilufer.js, c/[slug].js, api/*)
 * take natural precedence over this catch-all.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  Request pipeline (8 steps):                                             │
 * │                                                                          │
 * │  1. parse + normalize path    (parsePath)                                │
 * │  2. validate grammar          (validateAlias / validateModifier)          │
 * │  3. construct routeKey        (buildRouteKey)                            │
 * │  4. Workers Cache lookup      (routeCacheGet)                            │
 * │  5. ROUTE_ALIAS KV lookup     (on cache miss)                            │
 * │  6. 404 on miss               (no fallback)                              │
 * │  7. validate canonical_slug   (format guard)                             │
 * │  8. render hub                (alias + modifier are dropped here)        │
 * │                                                                          │
 * │  Only canonical_slug flows into rendering and analytics.                 │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Observability: emits one structured JSON log line per request:
 *   { routeKey, canonical_slug, cache, kvRead, latency_ms, request_id }
 *   NOTE: routeKey contains alias — it is logged but NOT sent to analytics.
 *         Analytics receives only canonical_slug.
 *
 * Required env bindings (wrangler.toml):
 *   KV:  ROUTE_ALIAS, APP_CONFIG
 *   AE:  AE_TRAFFIC, AE_CONVERSION
 *   Var: GA4_ID, META_PIXEL_ID
 *   Opt: ROUTE_CACHE_TTL, ALIAS_CACHE_TTL_MS, ENABLE_LEGACY_HUB_FALLBACK
 */

import { parsePath, resolveAlias, loadHubConfig, loadLandingConfig } from "./_shared/alias-router.js";
import { buildRouteKey }                           from "./_shared/alias-router.js";
import { resolveLinks }                            from "./_shared/links.js";
import { renderHub, renderLanding }                from "./_shared/hub-renderer.js";
import { createRuntimeRepository }                 from "./_shared/runtime-repository.js";
import { resolveContext }                          from "./_shared/runtime-adapter.js";
import { compareRuntime }                          from "./_shared/runtime-diff.js";
import { emitShadowTelemetry }                     from "./_shared/shadow-telemetry.js";
import { createRuleRepository }                    from "./_shared/rule-repository.js";
import { evaluateDecision }                        from "./_shared/decision-engine-v2.js";
import { createDecisionShadowContext }             from "./_shared/decision-shadow-context.js";
import { createLegacyCompatibleView }              from "./_shared/runtime-compat-view.js";
import { verifyAdminDebug }                        from "./_shared/runtime-debug-auth.js";
import { compareDecisions }                        from "./_shared/decision-comparator.js";
import { cacheGet, cacheSet, getTtlMs }            from "./_shared/kv-cache.js";
import { deriveCampaignFromSlug, extractProductSubdomain, validateProductSubdomainMatch } from "./_shared/slug-utils.js";
import { renderAdmin } from "./_shared/admin-renderer.js";
import { emitOps, OPS_EVENTS }                     from "./_shared/ops-telemetry.js";
import { loadABConfig }                            from "./_shared/ab-router.js";
import { resolveExperimentVariant }                from "./lib/experiment-router.js";
import { resolveJourneyDestination }              from "./lib/journey-router.js";
import { maybeRebalance }                          from "./_shared/bandit-rebalance.js";
import { readCookie, buildSetCookie }              from "./_shared/cookie-utils.js";
import { parseUserState, serializeUserState, updateUserState } from "./_shared/user-state.js";
import { handleDecision }                          from "./lib/decision-controller.js";

async function hashToken(token) {
  if (!token) return "";
  const msgBuffer = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// ── Security headers (applied to all responses) ───────────────────────────────

const SEC_HEADERS = {
  "X-Robots-Tag":           "noindex,nofollow",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy":        "strict-origin-when-cross-origin",
};

// ── Response helpers ──────────────────────────────────────────────────────────

function html404() {
  return new Response("Not Found", {
    status:  404,
    headers: { "Content-Type": "text/plain;charset=UTF-8", ...SEC_HEADERS },
  });
}

// ── Admin-verify overlay ──────────────────────────────────────────────────────

/**
 * Build an inline <script> that annotates external hub links with
 * ✔ VALID / ⚠ SUSPICIOUS / ✖ BROKEN badges, visible to authenticated
 * admins only (injected only when ?admin-verify=<valid-token> is present).
 *
 * Security notes:
 *   • alias comes from validateAlias() — only [a-z0-9-] chars are valid.
 *   • token is stripped of quote chars before embedding.
 *   • Cache-Control is set to no-store for admin-verified responses so the
 *     embedded token is never cached by Workers Cache or CDN edge.
 *
 * @param {string} alias — validated alias (e.g. "nb")
 * @param {string} token — ADMIN_TOKEN value (already validated server-side)
 * @returns {string} — inline <script> block
 */
function buildAdminOverlay(alias, token) {
  // Minimal XSS guard: strip characters that could break out of the JS string literal
  const safeAlias = encodeURIComponent(alias);
  const safeToken = token.replace(/["'\\`]/g, "");

  return `<script>
(function(){
  var ALIAS="${safeAlias}",TOKEN="${safeToken}";
  fetch("/api/admin/manual-test?action=link-check&alias="+ALIAS,{
    headers:{Authorization:"Bearer "+TOKEN}
  })
  .then(function(r){return r.json();})
  .then(function(d){
    var links=d.links||[];
    var map={};
    links.forEach(function(l){map[l.url]=l;});
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
  })
  .catch(function(){});
})();
</script>`;
}

// ── Global hub design config ──────────────────────────────────────────────────

// loadGlobalConfig moved inline to onRequestGet to match c/[slug].js style

// ── UTM defaults ──────────────────────────────────────────────────────────────

const CHANNEL_UTM = {
  // Instagram
  igbio:   { utm_source: "instagram", utm_medium: "bio" },
  igstory: { utm_source: "instagram", utm_medium: "story" },
  // YouTube
  yt:      { utm_source: "youtube",   utm_medium: "description" },
  youtube: { utm_source: "youtube",   utm_medium: "description" },
  // Spotify
  spotify: { utm_source: "spotify",   utm_medium: "bio" },
  spbio:   { utm_source: "spotify",   utm_medium: "bio" },
  // TikTok
  ttbio:   { utm_source: "tiktok",    utm_medium: "bio" },
  ttstory: { utm_source: "tiktok",    utm_medium: "story" },
  ttpaid:  { utm_source: "tiktok",    utm_medium: "paid" },
  // Facebook / Meta paid
  fbpost:  { utm_source: "facebook",  utm_medium: "post" },
  meta:    { utm_source: "meta",      utm_medium: "paid" },
  // Google
  google:  { utm_source: "google",    utm_medium: "cpc" },
};

/**
 * Infer UTM defaults (source + medium) from the canonical slug's channel suffix.
 *
 * @param  {string} canonicalSlug
 * @returns {object}
 */
function buildDefaultUtms(canonicalSlug) {
  const lastDash      = canonicalSlug.lastIndexOf("-");
  const channelSuffix = lastDash >= 0 ? canonicalSlug.slice(lastDash + 1) : "";
  return CHANNEL_UTM[channelSuffix] || {};
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const t0 = Date.now();
  const url = new URL(request.url);
  const originalHost = request.headers.get("x-forwarded-host") || request.headers.get("x-original-host") || url.hostname;
  const productSubdomain = extractProductSubdomain(request.url, originalHost);

  // --- Auth Check for Preview ---
  const previewVersion = url.searchParams.get("preview_version");
  let isAdminPreview = false;
  if (previewVersion) {
    const { verifyToken } = await import("./_shared/auth.js");
    const isAuthorized = await verifyToken(request, env);
    if (!isAuthorized) {
      return new Response("Unauthorized for preview", { status: 401, headers: SEC_HEADERS });
    }
    isAdminPreview = true;
  }

  // ── Step -1: Canonical URL Forcing ──────────────────────────────────────
  // Enforce https://www... for production traffic to unify analytics.
  if (
    url.hostname !== "localhost" &&
    url.hostname !== "127.0.0.1" &&
    !url.hostname.endsWith(".pages.dev")
  ) {
    let needsRedirect = false;
    let newHost = originalHost;

    // Always force HTTPS
    if (url.protocol === "http:") {
      needsRedirect = true;
    }

    const hostSegments = newHost.split('.');
    const rootDomain = (env && env.ROOT_DOMAIN) || "";
    const canonicalMode = (env && env.CANONICAL_HOST_MODE) || "apex";
    const wwwRedirectToApex = (env && (env.WWW_REDIRECT_TO_APEX === "true" || env.WWW_REDIRECT_TO_APEX === true));

    if (rootDomain) {
      if (wwwRedirectToApex && (newHost === `www.${rootDomain}`)) {
        newHost = rootDomain;
        needsRedirect = true;
      } else if (canonicalMode === "www" && newHost === rootDomain) {
        newHost = `www.${rootDomain}`;
        needsRedirect = true;
      }
    } else {
      // Legacy fallback when no ROOT_DOMAIN is configured
      if (newHost === "teklifi.online" || newHost === "www.teklifi.online") {
        newHost = "sigorta.teklifi.online";
        needsRedirect = true;
      } else if (hostSegments.length === 2 && !newHost.startsWith("www.")) {
        newHost = "www." + newHost;
        needsRedirect = true;
      }
    }

    // Safely ignore subdomains (3+ segments like dev.ekinyasa.online)
    // If the user manually typed www.dev..., we just let it be (it will likely fail at DNS level anyway)

    if (needsRedirect) {
      return Response.redirect(`https://${newHost}${url.pathname}${url.search}`, 301);
    }
  }

  // params.path from [[path]] is an array of decoded path segments
  const rawPath = Array.isArray(params.path)
    ? "/" + params.path.join("/")
    : "/" + String(params.path || "");

  // ── Reserved Subdomains & Admin Subdomain Handling ────────────────────────
  const rootDomain = (env && env.ROOT_DOMAIN) || "";
  const adminSubdomain = (env && env.ADMIN_SUBDOMAIN) || "login";
  const adminHost = rootDomain ? `${adminSubdomain}.${rootDomain}` : "login.teklifi.online";
  const isAdminHost = originalHost === adminHost || originalHost === "login.teklifi.online";

  if (isAdminHost && (rawPath === "/" || rawPath === "")) {
    return new Response(renderAdmin({
      branch: (env && env.CF_PAGES_BRANCH)     || "",
      sha:    (env && env.CF_PAGES_COMMIT_SHA) || "",
      customDomain: url.hostname,
      rootDomain: rootDomain
    }), {
      headers: {
        "Content-Type":           "text/html;charset=UTF-8",
        "Cache-Control":          "no-store",
        "X-Robots-Tag":           "noindex,nofollow,noarchive",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options":        "DENY",
        "Referrer-Policy":        "no-referrer",
      },
    });
  }

  // Protect reserved subdomains (e.g. portal.niluferormanli.com reserved for Kartra)
  if (rootDomain && originalHost.endsWith(`.${rootDomain}`)) {
    const sub = originalHost.slice(0, -(rootDomain.length + 1)).toLowerCase();
    const RESERVED_SUBDOMAINS = [
      "login", "admin", "api", "assets", "static", "dash",
      "dashboard", "my", "app", "test", "demo", "portal"
    ];
    if (sub !== adminSubdomain && RESERVED_SUBDOMAINS.includes(sub)) {
      return html404();
    }
  }

  // ── Static Pages & Homepage Resolution ──────────────────────────────────
  if (rawPath === "/" || !rawPath) {
    // 1. Root / -> Check Homepage Static Page
    let homepagePageId = "";
    if (env && env.APP_CONFIG) {
      try {
        const routing = await env.APP_CONFIG.get("site:routing", { type: "json" });
        if (routing && routing.homepagePageId) homepagePageId = routing.homepagePageId;
      } catch (_) {}
    }
    if (!homepagePageId && env && env.LANDING_CONFIG) {
      try {
        const cfg = await env.LANDING_CONFIG.get("hub_config", { type: "json" });
        if (cfg && cfg.homepageStaticPageId) homepagePageId = cfg.homepageStaticPageId;
      } catch (_) {}
    }

    if (homepagePageId && env && env.APP_CONFIG) {
      try {
        const page = await env.APP_CONFIG.get(`static_page:${homepagePageId}`, { type: "json" });
        if (page && (page.status === "published" || isAdminPreview)) {
          const versionId = (isAdminPreview && previewVersion) ? previewVersion : page.live_version_id;
          if (versionId) {
            const version = await env.APP_CONFIG.get(`static_page_ver:${homepagePageId}:${versionId}`, { type: "json" });
            if (version) {
              const [configResult, liveComponentsResult] = await Promise.allSettled([
                env.LANDING_CONFIG ? env.LANDING_CONFIG.get("hub_config", { type: "json" }) : Promise.resolve(null),
                env.APP_CONFIG ? env.APP_CONFIG.get("comp_live", { type: "json" }) : Promise.resolve([])
              ]);
              const config = configResult.status === "fulfilled" ? (configResult.value || {}) : {};
              const liveComponents = liveComponentsResult.status === "fulfilled" ? (liveComponentsResult.value || []) : [];

              const html = renderLanding({
                contextType: "static",
                contextId: page.slug || "home",
                slug: page.slug || "home",
                slugData: version,
                components: liveComponents,
                config,
                isPreview: isAdminPreview,
                rootDomain: rootDomain,
                requestHost: originalHost
              });

              return new Response(html, {
                status: 200,
                headers: {
                  "Content-Type": "text/html; charset=utf-8",
                  ...SEC_HEADERS
                }
              });
            }
          }
        }
      } catch (err) {
        console.error("[catch-all] Failed to render homepage static page:", err);
      }
    }
  } else {
    // 2. /{slug} -> Check Static Page Slugs
    const candidateStaticSlug = rawPath.replace(/^\/+|\/+$/g, "");
    if (candidateStaticSlug && env && env.APP_CONFIG) {
      try {
        let pageId = null;
        let versionId = null;

        const indexData = await env.APP_CONFIG.get(`static_slug:${candidateStaticSlug}`, { type: "json" });
        if (indexData && indexData.page_id) {
          pageId = indexData.page_id;
          versionId = (isAdminPreview && previewVersion) ? previewVersion : indexData.version_id;
        } else if (isAdminPreview) {
          const queryPageId = url.searchParams.get("page_id");
          if (queryPageId) {
            pageId = queryPageId;
            versionId = previewVersion;
          }
        }

        if (pageId && versionId) {
          const [page, version] = await Promise.all([
            env.APP_CONFIG.get(`static_page:${pageId}`, { type: "json" }),
            env.APP_CONFIG.get(`static_page_ver:${pageId}:${versionId}`, { type: "json" }),
          ]);

          if (page && version && (page.status === "published" || isAdminPreview)) {
            const [configResult, liveComponentsResult] = await Promise.allSettled([
              env.LANDING_CONFIG ? env.LANDING_CONFIG.get("hub_config", { type: "json" }) : Promise.resolve(null),
              env.APP_CONFIG ? env.APP_CONFIG.get("comp_live", { type: "json" }) : Promise.resolve([])
            ]);
            const config = configResult.status === "fulfilled" ? (configResult.value || {}) : {};
            const liveComponents = liveComponentsResult.status === "fulfilled" ? (liveComponentsResult.value || []) : [];

            const html = renderLanding({
              contextType: "static",
              contextId: candidateStaticSlug,
              slug: candidateStaticSlug,
              slugData: version,
              components: liveComponents,
              config,
              isPreview: isAdminPreview,
              rootDomain: rootDomain,
              requestHost: originalHost
            });

            return new Response(html, {
              status: 200,
              headers: {
                "Content-Type": "text/html; charset=utf-8",
                ...SEC_HEADERS
              }
            });
          }
        }
      } catch (err) {
        console.error(`[catch-all] Error resolving static slug ${candidateStaticSlug}:`, err);
      }
    }
  }

  // ── Step 0: Root path handling ──────────────────────────────────────────
  // If no path is specified, attempt to serve the "home" page.
  const finalRawPath = (rawPath === "/" || !rawPath) ? "/home" : rawPath;

  // ── Steps 1–2: Parse + validate path ────────────────────────────────────
  const parsed = parsePath(finalRawPath);
  if (parsed.error) return html404();

  const { alias, modifier } = parsed;

  // ── Admin-verify overlay check ────────────────────────────────────────────
  // Removed old query-param logic per security requirements.
  // Inspector auth is now securely handled via headers.

  // Stable tracing ID (cf-ray is available in prod; fallback for local dev)
  const requestId = request.headers.get("cf-ray") || crypto.randomUUID?.() || "";
  const ttlMs     = getTtlMs(env);

  // ── Step 3: Route key construction (happens inside resolveAlias) ─────────
  // ── Steps 4–7: Resolve via Workers Cache + ROUTE_ALIAS ──────────────────
  let resolution;
  try {
    resolution = await resolveAlias({ alias, modifier, env, requestId });
  } catch (err) {
    // Unexpected throw — never expose 500 on public surface
    console.error("[catch-all] resolveAlias threw:", err?.message ?? String(err));
    return html404();
  }

  if (!resolution.ok) return html404();

  // ── BOUNDARY: alias + modifier are dropped here ──────────────────────────
  // From this point only canonicalSlug (and finalSlug after A/B) flows into
  // rendering and analytics.
  const { canonicalSlug, cacheHit } = resolution;

  // ── Alias Path Target Rewrite ──────────────────────────────────────────
  if (typeof canonicalSlug === "string" && canonicalSlug.startsWith("/")) {
    // Instead of redirecting (which changes the user's URL), we do an internal rewrite.
    // This allows the user to see the alias (e.g. /teklifal) in their address bar,
    // while the server transparently fetches the canonical content (/l/trafik-yenileme-cold).
    let targetPath = canonicalSlug;

    // If the user requested an alias with a modifier (like /teklifal/thanks),
    // append the modifier to the canonical path (/l/trafik-yenileme-cold/thanks)
    if (modifier) {
      targetPath = targetPath.endsWith("/") ? targetPath + modifier : targetPath + "/" + modifier;
    }

    const internalUrl = new URL(request.url);
    internalUrl.pathname = targetPath;

    // Fetch internally
    const rewriteReq = new Request(internalUrl.toString(), request);
    return fetch(rewriteReq);
  }

  // ── A/B routing: optionally replace canonicalSlug with a variant ─────────
  // loadABConfig() returns null when no config exists (result is cached in-memory
  // so aliases without A/B config incur at most one KV read per isolate lifetime).
  // TRAFFIC_MEMORY is emitted here — not in alias-router.js — so it always
  // records the final slug that was actually served (including any A/B variant).
  //
  // All experiment routing logic (state gating, sticky bucketing, variant
  // selection, exposure counting, AB_SELECTED telemetry) is handled by
  // resolveExperimentVariant() in lib/experiment-router.js.
  let finalSlug     = canonicalSlug;
  let abActive      = false;
  let utmExperiment = null;   // alias — set when A/B routing is active
  let utmVariant    = null;   // selected variant slug — set when A/B routing is active
  let expResult     = null;   // result from resolveExperimentVariant (null when no A/B config)

  const abConfig = await loadABConfig(alias, env);

  if (abConfig) {
    expResult = await resolveExperimentVariant(request, abConfig, env, {
      alias, canonicalSlug, requestId, modifier,
    });

    finalSlug = expResult.finalSlug;
    abActive  = expResult.abActive;

    if (abActive) {
      utmExperiment = alias;
      utmVariant    = expResult.finalSlug;
      // Diagnostic log for Prompt 130
      console.log("[ab-debug]", JSON.stringify({
        alias, variant: utmVariant,
        hasToken: !!expResult.expToken,
        tokenPrefix: expResult.expToken ? expResult.expToken.slice(0, 5) : null,
        hasSecret: !!env.EXPOSURE_TOKEN_SECRET,
        envName: env.ENV_NAME || "dev"
      }));
    }

    // Schedule exposure counter write (fire-and-forget).
    // counterPromise is null for DRAFT, PAUSED, DECIDED, and ARCHIVED.
    if (expResult.counterPromise) {
      context.waitUntil(expResult.counterPromise);
    }

    // Prompt 71 T5 / Prompt 72 — Epsilon-greedy exposure boundary trigger.
    // Approximates "rebalance after every ~500 exposures" using a probabilistic
    // check (1/500 chance per exposure) rather than reading all shards to get an
    // exact count. The 5-minute cooldown in maybeRebalance() prevents overrun.
    // Only fires when an exposure was actually recorded (counterPromise non-null).
    // Gate: strategy !== "fixed" — matches maybeRebalance() default (opt-out semantics).
    // Experiments without a strategy field are treated as auto-rebalance-eligible.
    if (
      expResult.counterPromise &&
      abConfig.strategy !== "fixed" &&
      Math.random() < 0.002   // ≈ 1/500 per exposure
    ) {
      context.waitUntil(maybeRebalance(env, alias, "exposure"));
    }
  }

  // ── Step 6 observability log (per-request structured event) ──────────────
  //   routeKey is logged for operational debugging but is NOT forwarded to
  //   analytics or included in any marketing payload.
  const routeKey = buildRouteKey(alias, modifier);
  console.log("[route]", JSON.stringify({
    routeKey,                               // alias[@modifier] — ops only
    canonical_slug: canonicalSlug,          // ROUTE_ALIAS base slug
    final_slug:     abActive ? finalSlug : undefined,   // A/B selected slug
    ab_active:      abActive || undefined,
    cache:          cacheHit ? "hit" : "miss",
    kvRead:         !cacheHit,
    latency_ms:     Date.now() - t0,
    request_id:     requestId,
  }));

  // ── Step 8: Load config + render ─────────────────────────────────────────
  // First, check if this is a Journey-based Campaign
  let hubConfig = null;
  let isJourney = false;
  let targetPageId = finalSlug; // default to legacy slug

  if (env.APP_CONFIG) {
    try {
      const campRecord = await env.APP_CONFIG.get(`campaign:${finalSlug}`, { type: "json" });
      if (campRecord && campRecord.journeyId) {
        const journey = await env.APP_CONFIG.get(`journey:${campRecord.journeyId}`, { type: "json" });
        if (journey) {
          // Dummy evaluate early to get visitor state from cookie without modifying it yet
          const rawState = request.headers.get("Cookie")?.includes("cos_state=")
             ? request.headers.get("Cookie").split('cos_state=')[1].split(';')[0]
             : null;
          // Basic state (full parsing is done in decision-controller)
          const tempState = rawState ? { c: rawState.includes("%22c%22%3A1")?1:0, h: rawState.includes("%22h%22%3A1")?1:0, v: rawState.includes("%22v%22%3A1")?1:0 } : {c:0,h:0,v:0};

          const dest = await resolveJourneyDestination(journey, tempState);
          if (dest && dest.pageId) {
            targetPageId = dest.pageId;
            isJourney = true;
          }
        }
      }
    } catch(e) {
      console.error("[journey_error]", e);
    }
  }

  // Fetch page/slug config + global configs
  const [hubConfigResult, globalConfigResult, engineResult, liveComponentsResult, shadowResult] = await Promise.allSettled([
    loadHubConfig(targetPageId, env, ttlMs), // Load the target page (or legacy slug)
    env.LANDING_CONFIG ? env.LANDING_CONFIG.get("hub_config", { type: "json" }) : Promise.resolve({}),
    env.LANDING_CONFIG ? env.LANDING_CONFIG.get("engine_config", { type: "json" }) : Promise.resolve({}),
    env.APP_CONFIG ? env.APP_CONFIG.get("comp_live", { type: "json" }) : Promise.resolve([]),
    (async () => {
      // ── SHADOW MODE: Runtime Pipeline Evaluation ─────────────────────────────
      // Evaluates the new decoupled pipeline. Does not affect legacy flow.
      const repo = createRuntimeRepository(env);
      const rawLegacy = await repo.fetchLegacy(targetPageId);
      const rawV2 = await repo.fetchV2(targetPageId);

      const fetchIdentifier = isAdminPreview ? `${targetPageId}:${previewVersion}` : targetPageId;
      const rMode = isAdminPreview ? "preview" : (abActive ? "experiment" : "canonical");
      const runtimeContext = await resolveContext(fetchIdentifier, repo, { render_mode: rMode });

      return { rawLegacy, rawV2, context: runtimeContext };
    })()
  ]);

  const hubConfigVal = hubConfigResult.status === "fulfilled" ? (hubConfigResult.value || null) : null;

  // Enforce subdomain match to prevent conflicts
  if (productSubdomain && hubConfigVal && !validateProductSubdomainMatch(productSubdomain, hubConfigVal.product)) {
    return html404();
  }
  const globalConfig = globalConfigResult.status === "fulfilled" ? (globalConfigResult.value || {}) : {};
  const liveComponents = liveComponentsResult.status === "fulfilled" ? (liveComponentsResult.value || []) : [];
  const engineConfig = engineResult.status === "fulfilled" ? (engineResult.value || {}) : {};
  const shadowData = shadowResult.status === "fulfilled" ? (shadowResult.value || null) : null;
  const runtimeContext = shadowData?.context || null;

  // Pre-calculate inputs for legacy decision
  const reqUtmSource   = url.searchParams.get("utm_source")   || "";
  const reqUtmMedium   = url.searchParams.get("utm_medium")   || "";
  const reqUtmCampaign = url.searchParams.get("utm_campaign") || "";
  const utmSource      = reqUtmSource;
  const utmMedium      = reqUtmMedium;
  const utmCampaign    = reqUtmCampaign || (runtimeContext?.campaignContext?.name && String(runtimeContext.campaignContext.name).trim()) || (hubConfigVal?.campaign && String(hubConfigVal.campaign).trim()) || deriveCampaignFromSlug(finalSlug);

  let campRecord = null;
  if (env.APP_CONFIG && utmCampaign) {
    try {
      campRecord = await env.APP_CONFIG.get(`campaign:${utmCampaign}`, { type: "json" });
    } catch (_) {}
  }
  const baseDest = campRecord?.destinations || campRecord?.routing?.destinations || {};
  const hasLandingDest = typeof landingRecord !== "undefined" && landingRecord?.destinations && Object.keys(landingRecord.destinations).length > 0;
  const intentDestinations = Object.keys(baseDest).length > 0 || hasLandingDest ? Object.assign({}, baseDest, hasLandingDest ? landingRecord.destinations : {}) : null;
  const intentRules = campRecord?.rules || campRecord?.routing?.rules || hubConfigVal?.decision_rules || globalConfig?.decision_rules || [];

  const staticRedirect = runtimeContext?.pageContent?.redirect ?? hubConfigVal?.redirectUrl;
  const decisionInputState = parseUserState(readCookie(request, "cos_state"));
  const decisionShadowContext = createDecisionShadowContext(runtimeContext, {
    source: utmSource,
    medium: utmMedium,
    campaign: utmCampaign,
        productSubdomain: typeof productSubdomain !== "undefined" ? productSubdomain : (typeof finalSlug !== "undefined" ? finalSlug.split("-")[0] : null),
    userState: decisionInputState
  });

  let decision = null;
  let legacyError = false;
  if (!staticRedirect) {
    try {
      decision = await handleDecision(request, env, {
        source:   utmSource,
        medium:   utmMedium,
        campaign: utmCampaign,
        productSubdomain: typeof productSubdomain !== "undefined" ? productSubdomain : (typeof finalSlug !== "undefined" ? finalSlug.split("-")[0] : null),
        decisionRules: intentRules,
        intentDestinations,
        engineConfig,
        engineMapId: hubConfigVal?.engineMapId || null,
      });
    } catch (err) {
      console.error("[Legacy Decision Error]", err);
      legacyError = true;
    }
  }

  // ── RULE REPOSITORY (Shadow Mode) ─────────────────────────────────────────
  let ruleShadow = null;
  let decisionShadow = null;
  let decisionComparison = null;
  if (runtimeContext) {
    try {
      const { createRuleRepository } = await import("./_shared/rule-repository.js");
      const ruleRepo = createRuleRepository(env);
      const ruleSource = await ruleRepo.fetchRules(runtimeContext, hubConfigVal || shadowData?.rawLegacy || {}, {
        engineConfig,
        globalConfig,
        intentDestinations
      });

      const rawRules = ruleSource.rules || [];
      const validRules = rawRules; // Consolidated repository returns pre-normalized V2 rules

      ruleShadow = {
        source: ruleSource.source,
        source_id: ruleSource.source_id,
        schema: ruleSource.schema,
        raw_count: ruleSource.raw_count !== undefined ? ruleSource.raw_count : rawRules.length,
        valid_count: ruleSource.valid_count !== undefined ? ruleSource.valid_count : validRules.length,
        invalid_count: ruleSource.invalid_count !== undefined ? ruleSource.invalid_count : 0,
        rules: validRules
      };

      const { evaluateDecision } = await import("./_shared/decision-engine-v2.js");
      decisionShadow = evaluateDecision(decisionShadowContext, validRules);

      // Compare legacy vs V2 decisions
      const realRuleShadowEnabled = String(env.REAL_RULE_SHADOW_ENABLED) === "true";
      if (realRuleShadowEnabled) {
        const { compareDecisions } = await import("./_shared/decision-comparator.js");
        const hasRules = validRules && validRules.length > 0;
        decisionComparison = compareDecisions(decision, decisionShadow, {
          legacyError,
          v2Error: false,
          hasRules
        });
      }
    } catch (e) {
      console.error("[Shadow Rule Evaluation Error]", e);
      ruleShadow = { source: "error", source_id: null, schema: "none", raw_count: 0, valid_count: 0, invalid_count: 0, rules: [] };
      const { evaluateDecision } = await import("./_shared/decision-engine-v2.js");
      decisionShadow = evaluateDecision(decisionShadowContext, []);
    }
  }

  // ── CUTOVER VIEW ──────────────────────────────────────────────────────────
  hubConfig = hubConfigVal;
  const originalHubConfig = hubConfig;
  const readEnabled = (env.RUNTIME_CONTEXT_READ_ENABLED === "true" || env.RUNTIME_CONTEXT_READ_ENABLED === true);
  if (readEnabled && runtimeContext) {
    try {
      hubConfig = createLegacyCompatibleView(runtimeContext, originalHubConfig);
    } catch (e) {
      console.error("[compat_view_error]", e);
      hubConfig = originalHubConfig; // fallback on error
    }
  }

  // ── SHADOW TELEMETRY ──────────────────────────────────────────────────────
  let shadowTelemetryMeta = { enabled: false };
  if (shadowData || runtimeContext) {
    try {
      const diff = compareRuntime(originalHubConfig, runtimeContext);
      shadowTelemetryMeta = emitShadowTelemetry(env, request, {
        slug: resolution.canonicalSlug,
        routeType: resolution.type,
        runtimeContext,
        runtimeDiff: diff,
        ruleShadow,
        decisionShadow,
        exception: shadowData?.exception || null,
        request_id: request.headers.get("cf-ray") || "",
        uid: decision?.userState?.uid || "",
        decisionComparison
      });
    } catch (e) {
      console.error("[Shadow Telemetry Error]", e);
    }
  }

  // ── Runtime Inspector (Shadow Mode) ───────────────────────────────────────
  if (verifyAdminDebug(request, env)) {
    const diff = compareRuntime(originalHubConfig, runtimeContext);

    const debugPayload = {
      _warning: "RUNTIME INSPECTOR (Shadow Mode)",
      aliasResolution: resolution,
      repositoryResult: {
        rawLegacy: shadowData?.rawLegacy || null,
        rawV2: shadowData?.rawV2 || null
      },
      legacyObject: originalHubConfig,
      runtimeCompatibilityView: readEnabled ? hubConfig : null,
      runtimeContext: shadowData?.context || null,
      runtimeDiff: diff,
      ruleShadow,
      decisionShadow,
      metadata: {
        runtime_version: "adapter",
        render_mode: abActive ? "experiment" : "canonical",
        source_schema: shadowData?.context?.metadata?.source_schema || "unknown",
        runtime_context_read_enabled: readEnabled,
        shadowTelemetry: shadowTelemetryMeta,
        realRuleShadow: {
          enabled: String(env.REAL_RULE_SHADOW_ENABLED) === "true",
          source_count: ruleShadow?.raw_count || 0,
          converted_count: ruleShadow?.valid_count || 0,
          unsupported_count: ruleShadow?.invalid_count || 0,
          comparable: decisionComparison ? decisionComparison.comparable : false,
          comparison_status: decisionComparison ? decisionComparison.status : "not_comparable",
          legacy_action: decisionComparison?.legacy?.action_type || null,
          v2_action: decisionComparison?.v2?.action_type || null,
          matched_rule_id: decisionShadow?.matched_rule_id || null
        }
      }
    };
    return new Response(JSON.stringify(debugPayload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        "Cache-Control": "no-store, private",
        ...SEC_HEADERS
      }
    });
  }

  // ── Step 7.1: Static Page Redirect ──────────────────────────────────────
  if (staticRedirect) {
    try {
      const rUrl = new URL(staticRedirect);
      // Transfer search params from inbound request
      url.searchParams.forEach((v, k) => rUrl.searchParams.set(k, v));
      return Response.redirect(rUrl.toString(), 302);
    } catch (_) {
      // Fall through if URL is malformed
    }
  }

  // ── Step 7.5: Decision Engine (Invisible Router - Unified) ───────────────
  // Evaluate behavior-driven rules to decide if we should show the hub or
  // perform an instant redirect. Managed by handleDecision() helper.
  if (!decision && !staticRedirect && !legacyError) {
    try {
      decision = await handleDecision(request, env, {
        source:   utmSource,
        medium:   utmMedium,
        campaign: utmCampaign,
        productSubdomain: typeof productSubdomain !== "undefined" ? productSubdomain : (typeof finalSlug !== "undefined" ? finalSlug.split("-")[0] : null),
        decisionRules: hubConfig?.decision_rules || globalConfig?.decision_rules || [],
        engineConfig,
        engineMapId: hubConfig?.engineMapId || null,
      });
    } catch (e) {
      console.error("[Decision Engine Fail]", e);
    }
  }

  if (!decision) {
    decision = { action: "render", cookies: [], userState: { v: 1 } };
  }

  if (decision.action === "redirect" && decision.target) {
    // ── Instant Redirect (Decision Layer remains invisible) ───────────────
    const redirectUrl = new URL(decision.target);
    if (reqUtmSource)   redirectUrl.searchParams.set("utm_source",   reqUtmSource);
    if (reqUtmMedium)   redirectUrl.searchParams.set("utm_medium",   reqUtmMedium);
    if (reqUtmCampaign) redirectUrl.searchParams.set("utm_campaign", reqUtmCampaign);

    const redirectResHeaders = new Headers({
      "Location": redirectUrl.toString(),
      "Cache-Control": "no-store",
    });
    decision.cookies.forEach((c) => redirectResHeaders.append("Set-Cookie", c));

    // ── Log Instant Redirect to AE Traffic Memory ────────────────────────────
    emitOps(env, OPS_EVENTS.TRAFFIC_MEMORY, {
      alias, modifier: modifier ?? "", canonical_slug: finalSlug,
      campaign: utmCampaign,
        productSubdomain: typeof productSubdomain !== "undefined" ? productSubdomain : (typeof finalSlug !== "undefined" ? finalSlug.split("-")[0] : null),
      request_id: requestId,
      utm_source: utmSource || "",
      utm_medium: utmMedium || "",
      decision_v1: decision.decisionId || "default"
    });

    return new Response(null, {
      status: 302,
      headers: redirectResHeaders
    });
  }

  const links = resolveLinks(hubConfig, globalConfig);

  // Section C — UTM resolution priority:
  //   1. stored slug.defaults (written from UTM preset at create time)  ← highest
  //   2. CHANNEL_UTM suffix derivation (heuristic from slug name)
  //   3. {} fallback (utm_campaign + utm_content only)                  ← lowest
  const slugUtms    = buildDefaultUtms(finalSlug);
  const storedUtms  = runtimeContext?.campaignContext?.utm_defaults ?? ((hubConfig?.defaults && typeof hubConfig.defaults === "object") ? hubConfig.defaults : {});
  const defaultUtms = Object.assign({}, slugUtms, storedUtms);

  // LOG TRAFFIC_MEMORY AFTER defaultUtms is safely defined
  emitOps(env, OPS_EVENTS.TRAFFIC_MEMORY, {
    alias, modifier: modifier ?? "", canonical_slug: finalSlug,
    campaign: (runtimeContext?.campaignContext?.name && String(runtimeContext.campaignContext.name).trim()) || (hubConfig?.campaign && String(hubConfig.campaign).trim()) || deriveCampaignFromSlug(finalSlug),
    request_id: requestId,
    utm_source: defaultUtms.utm_source || "",
    utm_medium: defaultUtms.utm_medium || "",
    ...(abActive || cacheHit ? {
      detail: {
        ...(abActive ? { ab_base: canonicalSlug, experiment: alias, variant: finalSlug } : {}),
        ...(cacheHit ? { cache_hit: true } : { cache_hit: false })
      }
    } : {}),
  });
  // Section 1 — utm_experiment + utm_variant: append when A/B routing is active
  if (utmExperiment) defaultUtms.utm_experiment = utmExperiment;
  if (utmVariant)    defaultUtms.utm_variant    = utmVariant;

  // ── Outbound Parameter Injection (Cross-Domain Tracking) ────────────────
  // Append Kartra attribution parameters to all outbound links.
  defaultUtms.cos_exp = utmExperiment || finalSlug;
  defaultUtms.cos_var = utmVariant || "";
  try {
    defaultUtms.cos_cid = crypto.randomUUID();
  } catch (e) {
    // Fallback if randomUUID is unavailable in older contexts
    defaultUtms.cos_cid = "cid-" + Date.now();
  }

  // Prompt 52 — exposure token: embed in hub links so landing pages can send
  // it with /api/convert for cryptographic conversion integrity verification.
  // expToken is null when EXPOSURE_TOKEN_SECRET is not bound (graceful degradation).
  if (expResult?.expToken) defaultUtms.exp_token = expResult.expToken;
  // Prefer explicitly stored slug.campaign; fall back to heuristic for old records.
  // No extra KV reads — campaign is already in hubConfig/runtimeContext (loaded above).
  const campaign    = (runtimeContext?.campaignContext?.name && String(runtimeContext.campaignContext.name).trim()) || (hubConfig?.campaign && String(hubConfig.campaign).trim())
    || deriveCampaignFromSlug(finalSlug);

  // Load draft values if cl_draft_token exists
  let draftValues = {};
  const draftToken = readCookie(request, "cl_draft_token");
  if (draftToken && env.DB) {
    try {
      const tokenHash = await hashToken(draftToken);
      const matchedIntent = campaign;
      const draftRow = await env.DB.prepare(
        "SELECT working_payload_json, created_at FROM applications WHERE situation = ? AND status = 'draft' AND intent = ? LIMIT 1"
      ).bind(tokenHash, matchedIntent).first();

      if (draftRow && (Math.floor(Date.now() / 1000) - draftRow.created_at <= 2592000)) {
        draftValues = JSON.parse(draftRow.working_payload_json || "{}");
      }
    } catch (e) {
      console.error("Hydration draft load error:", e);
    }
  }

  const html = renderHub({
    contextType: "campaign",
    contextId:   finalSlug,        // ← final slug (A/B variant if active)
    campaign:    campaign,
    modifier:    modifier ?? "",
    defaultUtms,
    links,
    ga4Id:       env.GA4_ID        || "",
    metaPixelId: env.META_PIXEL_ID || "",
    config:      globalConfig,
    slug:        finalSlug,        // for CSS scoping (Prompt 116)
    slugData:    hubConfig,        // passing the campaign record
    expToken:    expResult?.expToken  || "",
    utmVariant:  expResult?.finalSlug || "",
    components:  liveComponents,
    draftValues: draftValues,
    rootDomain:  rootDomain,
    requestHost: originalHost
  });

  // ── Admin overlay injection ───────────────────────────────────────────────
  // Removed per security requirements; tokens must not be embedded in HTML.
  const finalHtml = html;


  // ── Build response headers ────────────────────────────────────────────────
  // Use Headers object so we can append Set-Cookie without overwriting it.
  const resHeaders = new Headers({
    "Content-Type": "text/html;charset=UTF-8",
    ...SEC_HEADERS,
  });

  // Cache-Control: no-store when setting a new experiment
  // cookie (prevents the cookie-setting response from being cached and replayed
  // to visitors who already hold a different assignment).
  if (expResult?.isNewAssignment) {
    resHeaders.set("Cache-Control", "no-store");
  } else {
    resHeaders.set("Cache-Control", "public, max-age=60, s-maxage=0");
  }

  // Sticky bucketing: set cookie when a new variant assignment was made.
  // cookieToSet is the pre-built Set-Cookie header value from experiment-router.js.
  if (expResult?.cookieToSet)      resHeaders.append("Set-Cookie", expResult.cookieToSet);

  // Conversion attribution cookies (Prompt 64).
  // cos_variant + cos_exp persist the active assignment so downstream checkout
  // pages can fire the conversion endpoint without knowing the experiment alias.
  // Set on every active experiment request (not just new assignments) so
  // visitors who arrived before P64 also receive cookies on their next visit.
  if (expResult?.cosVariantCookie)     resHeaders.append("Set-Cookie", expResult.cosVariantCookie);
  if (expResult?.cosExpCookie)         resHeaders.append("Set-Cookie", expResult.cosExpCookie);
  // Prompt 70 T1 — sticky attribution cookie (null when already present, so we skip)
  if (expResult?.expAttributionCookie) resHeaders.append("Set-Cookie", expResult.expAttributionCookie);

  // ── Decision Engine State Persistance (Unified) ───────────────────────────
  decision.cookies.forEach((c) => resHeaders.append("Set-Cookie", c));

  return new Response(finalHtml, { status: 200, headers: resHeaders });
}
