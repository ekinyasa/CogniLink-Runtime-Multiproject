/**
 * functions/lib/decision-controller.js — Unified Decision Engine Controller (v1).
 *
 * Centralizes user identification, state management, and rule evaluation.
 * Used by all entry points (root [[path]].js, c/[slug].js, ig.js, etc.)
 * to ensure consistent behavior and cookie persistence.
 */

import { readCookie, buildSetCookie } from "../_shared/cookie-utils.js";
import { parseUserState, serializeUserState, updateUserState } from "../_shared/user-state.js";
import { evaluateRules } from "./decision-engine.js";

/**
 * Handle the decision logic for a regular GET request to any Hub entry point.
 *
 * @param {Request} request
 * @param {object}  env
 * @param {object}  opts
 * @param {string}  opts.source         — e.g. "instagram"
 * @param {string}  opts.medium         — e.g. "story"
 * @param {string}  opts.campaign       — e.g. "new-launch"
 * @param {Array}   opts.decisionRules  — rules from config
 *
 * @returns {Promise<{
 *   action: "redirect" | "render",
 *   target?: string,              — redirect URL
 *   decisionId?: string,          — matched rule ID
 *   userState: object,            — current/updated user state
 *   cookies: string[],            — Set-Cookie header values to append
 * }>}
 */
export async function handleDecision(request, env, opts) {
  
  const { source = "", medium = "", campaign = "", decisionRules = [], engineConfig = null, intentDestinations = null, intentEvaluation = null } = opts;
  // Use campaign (intent slug) as the primary scope key to isolate intents
  const reqProd = opts.campaign || opts.productSubdomain || null;

  // 1. Read existing state
  const rawState = readCookie(request, "cos_state");
  let userState  = parseUserState(rawState);
  let stateUpdate = false;
  const cookies   = [];

  // Get active product state
  const pState = (reqProd && userState.p && userState.p[reqProd]) ? userState.p[reqProd] : { v: 0, f: 0, c: 0, h: 0, e: 0 };
  // Include global conversions if needed, but per intent isolation contract we do not inherit global engagement score


  // 2. Identification: assign persistent UID if missing
  if (!userState.uid) {
    try {
      userState.uid = crypto.randomUUID();
    } catch (_) {
      userState.uid = "u-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
    }
    stateUpdate = true;
  }

  // 3. Evaluate rules
  let decisionMatch = null;
  const contextCtx = { source, medium, campaign };

  // 3a. Priority 1: Dynamic Infinite Tag-Based Rules from Engine Config
  if (engineConfig && engineConfig.redirects && Array.isArray(engineConfig.redirects.rules) && engineConfig.redirects.rules.length > 0) {
    const uTags = Array.isArray(userState.t) ? userState.t : [];
    for (const rule of engineConfig.redirects.rules) {
      let match = true;
      if (Array.isArray(rule.hasTags) && rule.hasTags.length > 0) {
        if (rule.hasTags.some(t => !uTags.includes(t))) match = false;
      }
      if (match && Array.isArray(rule.notTags) && rule.notTags.length > 0) {
        if (rule.notTags.some(t => uTags.includes(t))) match = false;
      }
      if (match && rule.url) {
        decisionMatch = { action: "redirect", target: rule.url, id: `engine_tag_${rule.id || 'rule'}` };
        break;
      }
    }
  }

  // 3b. Priority 2: Intent-specific Destinations (Campaign V2) OR Legacy Engine Config
  if (!decisionMatch) {
    const checkRedirects = (engineConfig && engineConfig.redirects) ? engineConfig.redirects : {};
    
    // Resolve effective destinations (Intent wins over Global Engine Config)
    const effectiveDestinations = {
      post:      (intentDestinations && intentDestinations.postConversion) ? intentDestinations.postConversion : checkRedirects.post,
      sale:      (intentDestinations && intentDestinations.sale) ? intentDestinations.sale : checkRedirects.sale,
      converted: (intentDestinations && intentDestinations.converted) ? intentDestinations.converted : checkRedirects.converted,
      hot:       (intentDestinations && intentDestinations.hot) ? intentDestinations.hot : checkRedirects.hot,
      warm:      (intentDestinations && intentDestinations.warm) ? intentDestinations.warm : null
    };

    if (pState.c === 1 && effectiveDestinations.sale) {
      decisionMatch = { action: "redirect", target: effectiveDestinations.sale, id: "intent_sale_override" };
    } else if (pState.f === 1 || pState.c === 1) {
      if (pState.u === 1 && effectiveDestinations.post) {
        decisionMatch = { action: "redirect", target: effectiveDestinations.post, id: "intent_post_override" };
      } else if (effectiveDestinations.converted) {
        decisionMatch = { action: "redirect", target: effectiveDestinations.converted, id: "intent_converted_override" };
      }
    } else {
      // 3. Score Bands Evaluation (Precedence: Score Bands > Legacy Fallbacks)
      const scoreBands = (intentEvaluation && intentEvaluation.bands) ? intentEvaluation.bands : null;
      if (scoreBands && scoreBands.length > 0) {
        const score = pState.e || 0;
        const matchedBand = scoreBands.find(b => score >= b.min && score <= b.max);
        if (matchedBand && matchedBand.landing) {
          let tUrl = matchedBand.landing;
          if (tUrl.startsWith('version-') && !tUrl.startsWith('/l/')) {
             tUrl = "/l/" + tUrl;
          }
          decisionMatch = { action: "redirect", target: tUrl, id: "intent_band_" + (matchedBand.name || "matched") };
        }
      }

      // 4. Legacy Fallbacks (only if no band matched)
      if (!decisionMatch) {
        if (pState.h === 1 && effectiveDestinations.hot) {
          decisionMatch = { action: "redirect", target: effectiveDestinations.hot, id: "intent_hot_override" };
        } else if (effectiveDestinations.warm) {
          // Legacy hardcoded Warm classification removed per v1 production contract.
          // We only route to warm if they manually configured it and score >= 20 as a fallback.
          if ((pState.e || 0) >= 20) {
            decisionMatch = { action: "redirect", target: effectiveDestinations.warm, id: "intent_warm_override" };
          }
        }
      }
    }
  }

  // 3b. Fall back to standard custom hub routing rules if no global override
  if (!decisionMatch) {
    decisionMatch = evaluateRules(userState, contextCtx, decisionRules);
  }

  // 4. Handle REDIRECT action
  if (decisionMatch && decisionMatch.action === "redirect" && decisionMatch.target) {
    // If we're redirecting, we still want to persist the UID if it was just created
    if (stateUpdate) {
      cookies.push(buildSetCookie("cos_state", serializeUserState(userState), { 
        maxAge: 604800,
        secure: env.ENV_NAME !== "dev" // Disable Secure on localhost/http
      }));
    }
    return {
      action:     "redirect",
      target:     decisionMatch.target,
      decisionId: decisionMatch.id,
      userState,
      cookies,
    };
  }

  // 5. Handle RENDER action (default)
  // Mark as visited (v=1) if this is the first successful render hit
  if (pState.v === 0) {
    userState   = updateUserState(userState, { v: 1 }, reqProd);
    stateUpdate = true;
  }

  if (stateUpdate) {
    cookies.push(buildSetCookie("cos_state", serializeUserState(userState), { 
      maxAge: 604800,
      secure: env.ENV_NAME !== "dev" // Disable Secure on localhost/http
    }));
  }

  return {
    action: "render",
    ...(decisionMatch?.id ? { decisionId: decisionMatch.id } : {}),
    userState,
    cookies,
  };
}
