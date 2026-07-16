import { resolveLinks } from "../_shared/links.js";
import { renderHub }    from "../_shared/hub-renderer.js";
import { incrementCounter }         from "../_shared/counter.js";
import { deriveCampaignFromSlug } from "../_shared/slug-utils.js";
import { handleDecision }          from "../lib/decision-controller.js";
import { emitOps, OPS_EVENTS }       from "../_shared/ops-telemetry.js";
import { createRuntimeRepository }   from "../_shared/runtime-repository.js";
import { resolveContext } from "../_shared/runtime-adapter.js";
import { compareRuntime } from "../_shared/runtime-diff.js";
import { evaluateDecision } from "../_shared/decision-engine-v2.js";
import { createLegacyCompatibleView } from "../_shared/runtime-compat-view.js";
import { verifyAdminDebug }          from "../_shared/runtime-debug-auth.js";
import { createRuleRepository } from "../_shared/rule-repository.js";
import { normalizeRules } from "../_shared/rule-compat.js";

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
  const [slugResult, configResult, engineResult, liveComponentsResult, shadowResult] = await Promise.allSettled([
    slug ? env.SLUG_LINKS.get(slug, { type: "json" }) : Promise.resolve(null),
    env.LANDING_CONFIG
      ? env.LANDING_CONFIG.get(CONFIG_KEY, { type: "json" })
      : Promise.resolve(null),
    env.LANDING_CONFIG
      ? env.LANDING_CONFIG.get("engine_config", { type: "json" })
      : Promise.resolve(null),
    env.APP_CONFIG ? env.APP_CONFIG.get("comp_live", { type: "json" }) : Promise.resolve([]),
    (async () => {
      if (!slug) return null;
      // ── SHADOW MODE: Runtime Pipeline Evaluation ─────────────────────────────
      // Evaluates the new decoupled pipeline. Does not affect legacy flow.
      const repo = createRuntimeRepository(env);
      const rawLegacy = await repo.fetchLegacy(slug);
      const rawV2 = await repo.fetchV2(slug);
      const runtimeContext = await resolveContext(slug, repo, { render_mode: "canonical" });
      
      return { rawLegacy, rawV2, context: runtimeContext };
    })()
  ]);

  let runtimeContextShadow = shadowResult.status === "fulfilled" ? shadowResult.value : null;
  if (shadowResult.status === "rejected") {
    console.debug("[Shadow Mode Error]", shadowResult.reason?.message);
  }

  const campaignResult = slugResult;
  const  campaignDataVal = campaignResult.status === "fulfilled" ? (campaignResult.value || null) : null;
  const config = configResult.status === "fulfilled" ? (configResult.value || {}) : {};
  const liveComponents = liveComponentsResult.status === "fulfilled" ? (liveComponentsResult.value || []) : [];
  const engineConfig = engineResult.status === "fulfilled" ? (engineResult.value || {}) : {};
  const shadowData = shadowResult.status === "fulfilled" ? (shadowResult.value || null) : null;
  const runtimeContext = shadowData?.context || null;

  // ── RULE REPOSITORY (Shadow Mode) ─────────────────────────────────────────
  let ruleShadow = null;
  let decisionShadow = null;
  if (runtimeContext) {
    try {
      const ruleRepo = createRuleRepository(env);
      const ruleSource = await ruleRepo.fetchRules(runtimeContext, campaignDataVal || shadowData?.rawLegacy || {}, {
        engineConfig,
        globalConfig: config
      });
      
      const rawRules = ruleSource.rules || [];
      const validRules = normalizeRules(rawRules, runtimeContext);
      
      ruleShadow = {
        source: ruleSource.source,
        source_id: ruleSource.source_id,
        schema: ruleSource.schema,
        raw_count: rawRules.length,
        valid_count: validRules.length,
        invalid_count: rawRules.length - validRules.length,
        rules: validRules
      };

      decisionShadow = evaluateDecision(runtimeContext, validRules);
    } catch (e) {
      console.error("[Shadow Rule Evaluation Error]", e);
      ruleShadow = { source: "error", source_id: null, schema: "none", raw_count: 0, valid_count: 0, invalid_count: 0, rules: [] };
      decisionShadow = evaluateDecision(runtimeContext, []);
    }
  }

  // ── CUTOVER VIEW ──────────────────────────────────────────────────────────
  campaignData = campaignDataVal;
  const originalCampaignData = campaignData;
  const readEnabled = (env.RUNTIME_CONTEXT_READ_ENABLED === "true" || env.RUNTIME_CONTEXT_READ_ENABLED === true);
  if (readEnabled && runtimeContext) {
    try {
      campaignData = createLegacyCompatibleView(runtimeContext, originalCampaignData);
    } catch (e) {
      console.error("[compat_view_error]", e);
      campaignData = originalCampaignData; // fallback on error
    }
  }

  // ── Runtime Inspector (Shadow Mode) ───────────────────────────────────────
  if (verifyAdminDebug(request, env)) {
    const diff = compareRuntime(originalCampaignData, runtimeContext);
    
    const debugPayload = {
      _warning: "RUNTIME INSPECTOR (Shadow Mode)",
      aliasResolution: { canonicalSlug: slug, type: "direct-c-route" },
      repositoryResult: {
        rawLegacy: shadowData?.rawLegacy || null,
        rawV2: shadowData?.rawV2 || null
      },
      legacyObject: originalCampaignData,
      runtimeCompatibilityView: readEnabled ? campaignData : null,
      runtimeContext: shadowData?.context || null,
      runtimeDiff: diff,
      ruleShadow,
      decisionShadow,
      metadata: {
        runtime_version: "adapter",
        render_mode: "canonical",
        source_schema: shadowData?.context?.metadata?.source_schema || "unknown",
        runtime_context_read_enabled: readEnabled
      }
    };
    return new Response(JSON.stringify(debugPayload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        "Cache-Control": "no-store, private",
        "X-Robots-Tag": "noindex,nofollow",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin"
      }
    });
  }

  if (!notFound) {
    if (!campaignData || campaignData.isActive === false) {
      notFound = true;
    }
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
