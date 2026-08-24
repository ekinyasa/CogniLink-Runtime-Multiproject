import { resolveLinks } from "../_shared/links.js";
import { renderHub }    from "../_shared/hub-renderer.js";
import { incrementCounter } from "../_shared/counter.js";
import { handleDecision }  from "../lib/decision-controller.js";
import { verifyToken }     from "../_shared/auth.js";
import { buildRedirectResponse } from "../_shared/redirect-runtime.js";
import { extractProductSubdomain, validateProductSubdomainMatch } from "../_shared/slug-utils.js";
import { resolveDestinationUrl, normalizeSlug } from "../_shared/url-resolver.js";

const SEC_HEADERS = {
  "Content-Type":           "text/html;charset=UTF-8",
  "X-Robots-Tag":           "noindex,nofollow",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy":        "strict-origin-when-cross-origin",
};

function render404(message = "Not Published") {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>404 - Page Not Available</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 1rem; text-align: center; }
    .card { background: #1e293b; border: 1px solid #334155; padding: 2.5rem 2rem; border-radius: 12px; max-width: 420px; width: 100%; box-shadow: 0 10px 25px rgba(0,0,0,0.3); }
    h1 { font-size: 2.5rem; margin: 0 0 0.5rem 0; color: #94a3b8; }
    p { font-size: 1rem; color: #cbd5e1; margin: 0 0 1.5rem 0; line-height: 1.5; }
    .badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 600; text-transform: uppercase; background: #334155; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="card">
    <h1>404</h1>
    <p>${message}</p>
    <span class="badge">CogniLink Page Engine</span>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 404,
    headers: { ...SEC_HEADERS, "Cache-Control": "no-store" }
  });
}

/**
 * Helper to look up a Landing Version by its canonical slug or ID across campaign records.
 */
async function findLandingVersionBySlug(slug, env) {
  if (!slug || !env.APP_CONFIG) return null;
  const clean = normalizeSlug(slug);

  // 1. Direct index lookup in APP_CONFIG
  try {
    const directIdx = await env.APP_CONFIG.get(`landing:${clean}`, { type: "json" });
    if (directIdx && directIdx.campaignId) {
      const campaign = await env.APP_CONFIG.get(`campaign:${directIdx.campaignId}`, { type: "json" });
      if (campaign && Array.isArray(campaign.landings)) {
        const landing = campaign.landings.find(l => 
          l.id === directIdx.landingId || 
          normalizeSlug(l.slug) === clean || 
          l.id === clean
        );
        if (landing) return { campaign, landing };
      }
    }
  } catch (e) {}

  // 2. Fallback scan over all campaign records
  try {
    let cursor;
    do {
      const page = await env.APP_CONFIG.list({ prefix: "campaign:", cursor });
      for (const key of page.keys) {
        try {
          const campaign = await env.APP_CONFIG.get(key.name, { type: "json" });
          if (campaign && Array.isArray(campaign.landings)) {
            const landing = campaign.landings.find(l => 
              normalizeSlug(l.slug) === clean || 
              l.id === clean || 
              normalizeSlug(l.alias) === clean
            );
            if (landing) return { campaign, landing };
          }
        } catch(e) {}
      }
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
  } catch (e) {}

  return null;
}

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const rawSlug = params.slug || "";
  const slug = normalizeSlug(rawSlug);

  context.waitUntil(incrementCounter(env));

  if (!slug) {
    return render404("Landing route not specified.");
  }

  const url = new URL(request.url);
  const previewVersion = url.searchParams.get("preview_version");
  const originalHost = request.headers.get("x-forwarded-host") || request.headers.get("x-original-host") || url.hostname;
  const productSubdomain = extractProductSubdomain(request.url, originalHost);
  let isAdminPreview = false;

  // ── Authorized Preview Check ──────────────────────────────────────────────
  if (previewVersion) {
    const isAuthorized = await verifyToken(request, env);
    if (!isAuthorized) {
      // Requirement 1: Unauthorized preview must NOT fall back to public landing rendering
      return new Response("Unauthorized for preview", { status: 401 });
    }
    isAdminPreview = true;
  }

  // ── Fetch Landing Version ──────────────────────────────────────────────────
  let found = null;
  if (productSubdomain) {
    found = await findLandingVersionBySlug(productSubdomain + "-" + slug, env);
  }
  if (!found) {
    found = await findLandingVersionBySlug(slug, env);
  }
  if (!found) {
    return render404("The requested landing version does not exist.");
  }

  const { campaign, landing } = found;

  // Enforce subdomain match to prevent conflicts
  if (productSubdomain && campaign && !validateProductSubdomainMatch(productSubdomain, campaign.product)) {
    return render404("The requested landing version belongs to a different product group.");
  }

  const statusLower = (landing.status || "draft").toLowerCase();

  // ── Status Enforcement (Section 1) ─────────────────────────────────────────
  if (statusLower === "archived") {
    // Archived: Public content must not be rendered (404 response)
    return render404("This landing page version has been archived.");
  }

  if (statusLower === "draft" && !isAdminPreview) {
    // Draft: Public content must not be rendered without authorized preview
    return render404("This landing page is not published yet.");
  }

  // Published or Authorized Preview -> proceed to render
  const config = (await env.LANDING_CONFIG?.get("hub_config", { type: "json" })) || {};
  const engineConfig = (await env.LANDING_CONFIG?.get("engine_config", { type: "json" })) || {};
  const liveComponents = (await env.APP_CONFIG?.get("comp_live", { type: "json" })) || [];

  const reqUtmSource   = url.searchParams.get("utm_source")   || "";
  const reqUtmMedium   = url.searchParams.get("utm_medium")   || "";
  const reqUtmCampaign = url.searchParams.get("utm_campaign") || "";
  const utmSource      = reqUtmSource;
  const utmMedium      = reqUtmMedium;
  const utmCampaign    = reqUtmCampaign || campaign.slug || campaign.name || slug;

  // ── Decision Engine & Redirect Evaluation (Section 7) ──────────────────────
  let decision = null;
  try {
    decision = await handleDecision(request, env, {
      source: utmSource,
      medium: utmMedium,
      campaign: utmCampaign,
      productSubdomain: typeof productSubdomain !== "undefined" ? productSubdomain : null,
      decisionRules: campaign?.rules || campaign?.routing?.rules || config?.decision_rules || [],
      intentDestinations: Object.keys(campaign?.destinations || campaign?.routing?.destinations || {}).length > 0 || (landing?.destinations && Object.keys(landing.destinations).length > 0) ? Object.assign({}, campaign?.destinations || campaign?.routing?.destinations || {}, landing?.destinations || {}) : null,
      intentEvaluation: campaign?.evaluation || campaign?.routing?.evaluation || null,
      engineConfig,
    });
  } catch (e) {
    console.error("[Decision Engine Fail on /l/]", e);
  }

  if (!decision) {
    decision = { action: "render", cookies: [], userState: { v: 1 } };
  }

  // ── Redirect & Redirect Loop Protection ───────────────────────────────────
  if (decision.action === "redirect" && decision.target) {
    const targetResolved = resolveDestinationUrl(decision.target, env, request);
    try {
      const targetUrlObj = new URL(targetResolved);
      // Loop protection: Do not redirect if target matches current pathname
      if (targetUrlObj.pathname !== url.pathname && targetUrlObj.pathname !== `/l/${slug}`) {
        if (reqUtmSource)   targetUrlObj.searchParams.set("utm_source",   reqUtmSource);
        if (reqUtmMedium)   targetUrlObj.searchParams.set("utm_medium",   reqUtmMedium);
        if (reqUtmCampaign) targetUrlObj.searchParams.set("utm_campaign", reqUtmCampaign);

        const redirectResHeaders = {};
        if (Array.isArray(decision.cookies)) {
          redirectResHeaders["Set-Cookie"] = decision.cookies;
        }

        return buildRedirectResponse(targetUrlObj.toString(), {
          statusCode: 302,
          headers: redirectResHeaders
        });
      }
    } catch(e) {}
  }

  // ── Render Landing Content ────────────────────────────────────────────────
  const links = resolveLinks(campaign, config);

  // Construct effective landing config containing single selected landing version
  const landingConfigData = {
    ...campaign,
    ...landing,
    landings: [landing],
    mainLandingId: landing.id
  };

  const html = renderHub({
    contextType: "landing",
    contextId:   slug,
    requestUrl:  request.url,
    productSubdomain: productSubdomain,
    campaign:    utmCampaign,
    defaultUtms: {},
    links,
    ga4Id:       env.GA4_ID       || "",
    metaPixelId: env.META_PIXEL_ID || "",
    config,
    slug:        landing.slug || slug,
    slugData:    landingConfigData,
    components:  liveComponents,
    isPreview:   isAdminPreview,
    intentConfig: landingConfigData
  });

  const resHeaders = new Headers({
    ...SEC_HEADERS,
    "Content-Type":  "text/html;charset=UTF-8",
    "Cache-Control": "public, max-age=60",
  });

  decision.cookies.forEach((c) => resHeaders.append("Set-Cookie", c));

  return new Response(html, { headers: resHeaders });
}
