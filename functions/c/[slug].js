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
import { createRuleRepository } from "../_shared/rule-repository.js";
import { emitShadowTelemetry } from "../_shared/shadow-telemetry.js";
import { createLegacyCompatibleView } from "../_shared/runtime-compat-view.js";
import { verifyAdminDebug }          from "../_shared/runtime-debug-auth.js";
import { verifyToken }               from "../_shared/auth.js";
import { normalizeRules } from "../_shared/rule-compat.js";
import { compareDecisions } from "../_shared/decision-comparator.js";
import { createDecisionShadowContext } from "../_shared/decision-shadow-context.js";
import { applyDecisionAuthority, selectDecisionAuthority } from "../_shared/decision-authority.js";
import { readCookie } from "../_shared/cookie-utils.js";
import { parseUserState } from "../_shared/user-state.js";
import { buildRedirectResponse } from "../_shared/redirect-runtime.js";

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

  const url = new URL(request.url);
  const previewVersion = url.searchParams.get("preview_version");
  let isAdminPreview = false;
  
  if (previewVersion) {
    const isAuthorized = await verifyToken(request, env);
    if (!isAuthorized) {
      return new Response("Unauthorized for preview", { status: 401 });
    }
    isAdminPreview = true;
  }
  
  const fetchIdentifier = isAdminPreview ? `${slug}:${previewVersion}` : slug;

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
      
      // Use fetchIdentifier for preview support in V2
      let rawV2CampaignId = slug;
      let rawV2PageId = slug;
      if (fetchIdentifier.includes(":")) {
        const parts = fetchIdentifier.split(":");
        rawV2CampaignId = parts[0];
        rawV2PageId = parts[1];
      }
      const rawV2 = await repo.fetchV2(rawV2CampaignId, rawV2PageId);
      
      const runtimeContext = await resolveContext(fetchIdentifier, repo, { render_mode: isAdminPreview ? "preview" : "canonical" });
      
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

  // Pre-calculate inputs for legacy decision
  const utmSource   = url.searchParams.get("utm_source")   || "";
  const utmMedium   = url.searchParams.get("utm_medium")   || "";
  const utmCampaign = campaignDataVal?.campaign || deriveCampaignFromSlug(slug) || slug;

  // Fetch Intent (Campaign V2 config) to act as the unified routing source
  let intentData = null;
  if (utmCampaign && env.APP_CONFIG) {
    try {
      intentData = await env.APP_CONFIG.get(`campaign:${utmCampaign}`, { type: "json" });
    } catch(e) {}
  }

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
      source:   utmSource,
      medium:   utmMedium,
      campaign: utmCampaign,
      decisionRules: intentData?.rules || campaignDataVal?.decision_rules || config?.decision_rules || [],
      intentDestinations: intentData?.destinations || null,
      intentEvaluation: intentData?.evaluation || null,
      engineConfig,
      engineMapId: campaignDataVal?.engineMapId || null,
    });
  } catch (err) {
    console.error("[Legacy Decision Error]", err);
    legacyError = true;
  }
  const legacyDecision = decision;

  // ── RULE REPOSITORY (Shadow Mode) ─────────────────────────────────────────
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

      decisionShadow = evaluateDecision(decisionShadowContext, validRules);

      // Compare legacy vs V2 decisions
      const realRuleShadowEnabled = String(env.REAL_RULE_SHADOW_ENABLED) === "true";
      if (realRuleShadowEnabled) {
        const hasRules = validRules && validRules.length > 0;
        decisionComparison = compareDecisions(legacyDecision, decisionShadow, {
          legacyError,
          v2Error: false,
          hasRules
        });
      }
    } catch (e) {
      console.error("[Shadow Rule Evaluation Error]", e);
      v2Error = true;
      ruleShadow = { source: "error", source_id: null, schema: "none", raw_count: 0, valid_count: 0, invalid_count: 0, rules: [] };
      decisionShadow = evaluateDecision(decisionShadowContext, []);
    }
  }

  const decisionAuthority = selectDecisionAuthority(env, {
    routeType: "c",
    slug,
    source: utmSource,
    ruleShadow,
    decisionShadow,
    decisionComparison,
    legacyError,
    v2Error
  });
  decision = applyDecisionAuthority(legacyDecision, decisionShadow, decisionAuthority);

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

  // ── SHADOW TELEMETRY ──────────────────────────────────────────────────────
  let shadowTelemetryMeta = { enabled: false };
  if (shadowData || runtimeContext) {
    try {
      const diff = compareRuntime(originalCampaignData, runtimeContext);
      shadowTelemetryMeta = emitShadowTelemetry(env, request, {
        slug,
        routeType: "c",
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
        },
        decisionAuthority
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
  if (!decision && !legacyError) {
    try {
      decision = await handleDecision(request, env, {
        source:   utmSource,
        medium:   utmMedium,
        campaign: utmCampaign,
        decisionRules: intentData?.rules || campaignData?.decision_rules || config?.decision_rules || [],
        intentDestinations: intentData?.destinations || null,
        intentEvaluation: intentData?.evaluation || null,
        engineConfig,
        engineMapId: campaignData?.engineMapId || null,
      });
    } catch (e) {
      console.error("[Decision Engine Fail]", e);
    }
  }

  if (!decision) {
    decision = { action: "render", cookies: [], userState: { v: 1 } };
  }

  if (decision.action === "redirect" && decision.target) {
    const redirectUrl = new URL(decision.target);
    if (utmSource)   redirectUrl.searchParams.set("utm_source",   utmSource);
    if (utmMedium)   redirectUrl.searchParams.set("utm_medium",   utmMedium);
    if (utmCampaign) redirectUrl.searchParams.set("utm_campaign", utmCampaign);
    
    redirectUrl.searchParams.set("cos_decision", decision.decisionId || "default");
    if (decision.userState?.uid) {
      redirectUrl.searchParams.set("cos_uid", decision.userState.uid);
    }
    if (campaignData?.engineMapId) {
      redirectUrl.searchParams.set("cos_emap", campaignData.engineMapId);
    }

    const redirectResHeaders = {};
    if (Array.isArray(decision.cookies)) {
      redirectResHeaders["Set-Cookie"] = decision.cookies;
    }
    
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

    return buildRedirectResponse(redirectUrl.toString(), {
      statusCode: 302,
      headers: redirectResHeaders
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
    isPreview:   isAdminPreview,
    intentConfig: intentData || {}
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
