import { resolveLinks } from "../_shared/links.js";
import { renderHub }    from "../_shared/hub-renderer.js";
import { incrementCounter }         from "../_shared/counter.js";
import { deriveCampaignFromSlug } from "../_shared/slug-utils.js";
import { handleDecision }          from "../lib/decision-controller.js";
import { emitOps, OPS_EVENTS }       from "../_shared/ops-telemetry.js";

const CONFIG_KEY = "hub_config";

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const slug = params.slug || "";

  context.waitUntil(incrementCounter(env));

  let campaignData = null;
  let notFound     = false;

  if (!slug) {
    notFound = true;
  }

  // Fetch slug + config + engine_config in parallel
  const [slugResult, configResult, engineResult, liveComponentsResult] = await Promise.allSettled([
    slug ? env.SLUG_LINKS.get(slug, { type: "json" }) : Promise.resolve(null),
    env.LANDING_CONFIG
      ? env.LANDING_CONFIG.get(CONFIG_KEY, { type: "json" })
      : Promise.resolve(null),
    env.LANDING_CONFIG
      ? env.LANDING_CONFIG.get("engine_config", { type: "json" })
      : Promise.resolve(null),
    env.APP_CONFIG ? env.APP_CONFIG.get("comp_live", { type: "json" }) : Promise.resolve([]),
  ]);

  const config = configResult.status === "fulfilled" ? (configResult.value || {}) : {};
  const engineConfig = engineResult.status === "fulfilled" ? (engineResult.value || {}) : {};
  const liveComponents = liveComponentsResult.status === "fulfilled" ? (liveComponentsResult.value || []) : [];

  if (!notFound) {
    if (slugResult.status === "fulfilled" && slugResult.value) {
      campaignData = slugResult.value;
    } else {
      notFound = true;
    }
  }

  // Slug isActive check — disabled slug → 404
  if (!notFound && campaignData.isActive === false) {
    notFound = true;
  }

  if (notFound) {
    const html = renderHub({ notFound: true, config });
    return new Response(html, {
      status: 404,
      headers: {
        "Content-Type":           "text/html;charset=UTF-8",
        "Cache-Control":          "no-store",
        "X-Robots-Tag":           "noindex,nofollow",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  // Resolve link hrefs (BASE_LINKS with global config + per-slug overrides + custom links)
  const links = resolveLinks(campaignData, config);

  // defaultUtms carries source + medium + any other stored defaults.
  const defaultUtms = (campaignData.defaults && typeof campaignData.defaults === "object")
    ? { ...campaignData.defaults }
    : {};

  const campaign = campaignData.campaign || deriveCampaignFromSlug(slug);

  // ── Step 3: Decision Engine (Invisible Router - Unified) ─────────────────
  // Evaluate behavior-driven rules in the /c/ entry point.
  const url         = new URL(request.url);
  const utmSource   = url.searchParams.get("utm_source")   || "";
  const utmMedium   = url.searchParams.get("utm_medium")   || "";
  const utmCampaign = campaign;

  const decision = await handleDecision(request, env, {
    source:   utmSource,
    medium:   utmMedium,
    campaign: utmCampaign,
    decisionRules: campaignData?.decision_rules || config?.decision_rules || [],
    engineConfig,
    engineMapId: campaignData?.engineMapId || null,
  });

  if (decision.action === "redirect" && decision.target) {
    const redirectUrl = new URL(decision.target);
    if (utmSource)   redirectUrl.searchParams.set("utm_source",   utmSource);
    if (utmMedium)   redirectUrl.searchParams.set("utm_medium",   utmMedium);
    if (utmCampaign) redirectUrl.searchParams.set("utm_campaign", utmCampaign);
    
    redirectUrl.searchParams.set("cos_decision", decision.decisionId || "default");
    redirectUrl.searchParams.set("cos_uid", decision.userState.uid);
    if (campaignData?.engineMapId) {
      redirectUrl.searchParams.set("cos_emap", campaignData.engineMapId);
    }

    const redirectResHeaders = new Headers();
    decision.cookies.forEach((c) => redirectResHeaders.append("Set-Cookie", c));
    
    // ── Log Instant Redirect to AE Traffic Memory ────────────────────────────
    try {
      emitOps(env, OPS_EVENTS.TRAFFIC_MEMORY, {
        alias: slug, modifier: "", canonical_slug: slug,
        campaign: utmCampaign,
        request_id: request.headers.get("cf-ray") || "",
        utm_source: utmSource || "",
        utm_medium: utmMedium || "",
        decision_v1: decision.decisionId || "default"
      });
    } catch(e) {}

    return new Response(null, {
      status: 302,
      headers: {
        "Location": redirectUrl.toString(),
        "Cache-Control": "no-store",
        ...Object.fromEntries(redirectResHeaders.entries()),
      }
    });
  }

  const html = renderHub({
    contextType: "campaign",
    contextId:   slug,
    campaign:    campaign,
    defaultUtms,
    links,
    ga4Id:       env.GA4_ID       || "",
    metaPixelId: env.META_PIXEL_ID || "",
    config,
    slug,                            // for CSS scoping
    slugData:    campaignData,       // for per-slug landing customization
    components:  liveComponents,
  });

  const resHeaders = new Headers({
    "Content-Type":           "text/html;charset=UTF-8",
    "Cache-Control":          "public, max-age=60",
    "X-Robots-Tag":           "noindex,nofollow",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy":        "strict-origin-when-cross-origin",
  });

  // Persist State Cookie (Unified)
  decision.cookies.forEach((c) => resHeaders.append("Set-Cookie", c));

  return new Response(html, {
    headers: resHeaders
  });
}
