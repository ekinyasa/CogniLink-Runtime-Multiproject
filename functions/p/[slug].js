import { resolveLinks } from "../_shared/links.js";
import { renderLanding } from "../_shared/hub-renderer.js";
import { createRuntimeRepository } from "../_shared/runtime-repository.js";
import { resolveContext } from "../_shared/runtime-adapter.js";
import { compareRuntime } from "../_shared/runtime-diff.js";
import { evaluateDecision } from "../_shared/decision-engine-v2.js";
import { createRuleRepository } from "../_shared/rule-repository.js";
import { emitShadowTelemetry } from "../_shared/shadow-telemetry.js";
import { createLegacyCompatibleView } from "../_shared/runtime-compat-view.js";
import { verifyAdminDebug } from "../_shared/runtime-debug-auth.js";
import { compareDecisions } from "../_shared/decision-comparator.js";
import { createDecisionShadowContext } from "../_shared/decision-shadow-context.js";
import { applyDecisionAuthority, selectDecisionAuthority } from "../_shared/decision-authority.js";
import { readCookie } from "../_shared/cookie-utils.js";
import { parseUserState } from "../_shared/user-state.js";
import { deriveCampaignFromSlug } from "../_shared/slug-utils.js";
import { handleDecision } from "../lib/decision-controller.js";
import { buildRedirectResponse } from "../_shared/redirect-runtime.js";

const SEC_HEADERS = {
  "X-Robots-Tag": "noindex,nofollow",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const slug = params.slug || "";

  if (!slug) {
    return new Response("Not Found", { status: 404, headers: SEC_HEADERS });
  }

  // Parallel lookup of runtime context, configs, and components
  const [slugResult, configResult, engineResult, liveComponentsResult, shadowResult] = await Promise.allSettled([
    env.SLUG_LINKS ? env.SLUG_LINKS.get(slug, { type: "json" }) : Promise.resolve(null),
    env.LANDING_CONFIG ? env.LANDING_CONFIG.get("hub_config", { type: "json" }) : Promise.resolve(null),
    env.LANDING_CONFIG ? env.LANDING_CONFIG.get("engine_config", { type: "json" }) : Promise.resolve(null),
    env.APP_CONFIG ? env.APP_CONFIG.get("comp_live", { type: "json" }) : Promise.resolve([]),
    (async () => {
      const runtimeRepo = createRuntimeRepository(env);
      const runtimeContext = await resolveContext(runtimeRepo, "p", slug, { env });
      return {
        context: runtimeContext,
        rawLegacy: runtimeContext ? runtimeContext.pageContent : null
      };
    })()
  ]);

  const campaignDataVal = slugResult.status === "fulfilled" ? (slugResult.value || null) : null;
  const config = configResult.status === "fulfilled" ? (configResult.value || {}) : {};
  const liveComponents = liveComponentsResult.status === "fulfilled" ? (liveComponentsResult.value || []) : [];
  const engineConfig = engineResult.status === "fulfilled" ? (engineResult.value || {}) : {};
  const shadowData = shadowResult.status === "fulfilled" ? (shadowResult.value || null) : null;
  const runtimeContext = shadowData?.context || null;

  // Pre-calculate inputs for decision engine
  const url = new URL(request.url);
  const utmSource = url.searchParams.get("utm_source") || "";
  const utmMedium = url.searchParams.get("utm_medium") || "";
  const utmCampaign = campaignDataVal?.campaign || deriveCampaignFromSlug(slug);
  const decisionInputState = parseUserState(readCookie(request, "cos_state"));
  const decisionShadowContext = createDecisionShadowContext(runtimeContext, {
    source: utmSource,
    medium: utmMedium,
    campaign: utmCampaign,
    userState: decisionInputState
  });

  let decision = null;
  let legacyError = false;
  try {
    decision = await handleDecision(request, env, {
      source: utmSource,
      medium: utmMedium,
      campaign: utmCampaign,
      decisionRules: campaignDataVal?.decision_rules || config?.decision_rules || [],
      engineConfig,
      engineMapId: campaignDataVal?.engineMapId || null,
    });
  } catch (err) {
    console.error("[Landing Legacy Decision Error]", err);
    legacyError = true;
  }
  const legacyDecision = decision;

  let ruleShadow = null;
  let decisionShadow = null;
  let decisionComparison = null;
  let v2Error = false;
  if (runtimeContext) {
    try {
      const ruleRepo = createRuleRepository(env);
      const ruleSource = await ruleRepo.fetchRules(runtimeContext, campaignDataVal || shadowData?.rawLegacy || {}, {
        engineConfig,
        globalConfig: config
      });

      const rawRules = ruleSource.rules || [];
      const validRules = rawRules;

      ruleShadow = {
        source: ruleSource.source,
        source_id: ruleSource.source_id,
        schema: "v2",
        raw_count: rawRules.length,
        valid_count: validRules.length,
        invalid_count: 0,
        rules: validRules
      };

      decisionShadow = evaluateDecision(validRules, decisionShadowContext, {
        defaultAction: "render",
        defaultRenderMode: "canonical"
      });

      decisionComparison = compareDecisions(legacyDecision, decisionShadow, {
        legacyError,
        v2Error: false,
        hasRules: validRules.length > 0
      });
    } catch (err) {
      console.error("[Landing Rule Shadow Error]", err);
      v2Error = true;
    }
  }

  const authorityResult = selectDecisionAuthority(env, {
    routeType: "p",
    slug,
    source: utmSource,
    ruleShadow,
    decisionShadow,
    decisionComparison,
    legacyError,
    v2Error
  });

  const activeDecision = applyDecisionAuthority(legacyDecision, decisionShadow, authorityResult);

  // Inspector debugging response
  if (url.searchParams.get("runtime-debug") === "1" && verifyAdminDebug(request, env)) {
    const originalLandingConfig = campaignDataVal;
    const runtimeCompatibilityView = runtimeContext
      ? createLegacyCompatibleView(runtimeContext, originalLandingConfig)
      : null;

    const inspectorData = {
      _warning: "LANDING RUNTIME INSPECTOR",
      aliasResolution: {
        canonicalSlug: slug,
        type: "direct-p-route"
      },
      repositoryResult: {
        rawLegacy: shadowData?.rawLegacy || null,
        rawV2: shadowData?.rawLegacy || null
      },
      legacyObject: originalLandingConfig,
      runtimeCompatibilityView,
      runtimeContext,
      runtimeDiff: compareRuntime(originalLandingConfig, runtimeContext),
      ruleShadow,
      decisionShadow,
      metadata: {
        runtime_version: "adapter",
        render_mode: runtimeContext?.render_mode || "canonical",
        source_schema: runtimeContext?.metadata?.source_schema || "legacy",
        runtime_context_read_enabled: true,
        decisionAuthority: authorityResult
      }
    };

    return new Response(JSON.stringify(inspectorData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store, private",
        ...SEC_HEADERS
      }
    });
  }

  // Handle decision redirect action
  if (activeDecision && activeDecision.action === "redirect" && activeDecision.target) {
    const redirectResHeaders = {};
    if (Array.isArray(activeDecision.cookies)) {
      redirectResHeaders["Set-Cookie"] = activeDecision.cookies;
    }
    return buildRedirectResponse(activeDecision.target, {
      statusCode: activeDecision.statusCode || 302,
      headers: redirectResHeaders
    });
  }

  // Handle decision block action
  if (activeDecision && activeDecision.action === "block") {
    return new Response("Access Denied", { status: 403, headers: SEC_HEADERS });
  }

  // Render Landing Page
  const links = resolveLinks(campaignDataVal, config);
  const html = renderLanding({
    contextType: "route",
    contextId: slug,
    campaign: utmCampaign,
    defaultUtms: (campaignDataVal?.defaults && typeof campaignDataVal.defaults === "object") ? campaignDataVal.defaults : {},
    links,
    ga4Id: env.GA4_ID || "",
    metaPixelId: env.META_PIXEL_ID || "",
    notFound: false,
    config,
    slug,
    slugData: campaignDataVal
  });

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      ...SEC_HEADERS
    }
  });
}
