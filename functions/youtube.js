import { ROUTE_DEFAULTS, resolveLinks } from "./_shared/links.js";
import { renderHub }                    from "./_shared/hub-renderer.js";
import { incrementCounter }             from "./_shared/counter.js";
import { handleDecision }                from "./lib/decision-controller.js";

const CONFIG_KEY = "hub_config";

export async function onRequestGet(context) {
  const { request, env } = context;
  context.waitUntil(incrementCounter(env));

  let globalConfig = {};
  let engineConfig = {};
  let liveComponents = [];
  try {
    if (env.LANDING_CONFIG) {
      const [hubRes, engineRes, compRes] = await Promise.allSettled([
        env.LANDING_CONFIG.get(CONFIG_KEY, { type: "json" }),
        env.LANDING_CONFIG.get("engine_config", { type: "json" }),
        env.APP_CONFIG ? env.APP_CONFIG.get("comp_live", { type: "json" }) : Promise.resolve([])
      ]);
      globalConfig = hubRes.status === "fulfilled" ? (hubRes.value || {}) : {};
      engineConfig = engineRes.status === "fulfilled" ? (engineRes.value || {}) : {};
      liveComponents = compRes.status === "fulfilled" ? (compRes.value || []) : [];
    }
  } catch (e) { /* optional */ }

  const utms = ROUTE_DEFAULTS.youtube || {};

  // ── Step 3: Decision Engine (Invisible Router - Unified) ─────────────────
  // Use handleDecision to check for behavior-driven redirects
  const decision = await handleDecision(request, env, {
    source:   utms.utmSource || "youtube",
    medium:   utms.utmMedium || "social",
    campaign: "yt-route",
    decisionRules: globalConfig?.decision_rules || [],
    engineConfig,
  });

  if (decision.action === "redirect" && decision.target) {
    const redirectUrl = new URL(decision.target);
    redirectUrl.searchParams.set("utm_source",   utms.utmSource || "youtube");
    redirectUrl.searchParams.set("utm_medium",   utms.utmMedium || "social");
    redirectUrl.searchParams.set("cos_decision", decision.decisionId || "default");
    redirectUrl.searchParams.set("cos_uid",      decision.userState.uid);

    const resHeaders = new Headers({ "Location": redirectUrl.toString(), "Cache-Control": "no-store" });
    decision.cookies.forEach((c) => resHeaders.append("Set-Cookie", c));
    return new Response(null, { status: 302, headers: resHeaders });
  }

  const html = renderHub({
    contextType: "route",
    contextId:   "youtube",
    defaultUtms: utms,
    links:       resolveLinks(null, globalConfig),
    ga4Id:       env.GA4_ID       || "",
    metaPixelId: env.META_PIXEL_ID || "",
    config:      globalConfig,
    components:  liveComponents,
  });
  const resHeaders = new Headers({
    "Content-Type":           "text/html;charset=UTF-8",
    "Cache-Control":          "public, max-age=60, s-maxage=60",
    "X-Robots-Tag":           "noindex,nofollow",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy":        "strict-origin-when-cross-origin",
  });

  // Append Decision Engine Cookies (Unified)
  decision.cookies.forEach((c) => resHeaders.append("Set-Cookie", c));

  return new Response(html, { headers: resHeaders });
}
