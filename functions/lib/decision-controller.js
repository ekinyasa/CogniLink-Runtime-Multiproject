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
  const reqProd = opts.productSubdomain || (campaign ? campaign.split('-')[0] : null);

  // 1. Read existing state
  const rawState = readCookie(request, "cos_state");
  let userState  = parseUserState(rawState);
  let stateUpdate = false;
  const cookies   = [];

  // Get active product state
  const pState = (reqProd && userState.p && userState.p[reqProd]) ? userState.p[reqProd] : userState;


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
      converted: (intentDestinations && intentDestinations.converted) ? intentDestinations.converted : checkRedirects.converted,
      hot:       (intentDestinations && intentDestinations.hot) ? intentDestinations.hot : checkRedirects.hot,
      warm:      (intentDestinations && intentDestinations.warm) ? intentDestinations.warm : null
    };

        if (pState.c === 1) {
      if (pState.u === 1 && effectiveDestinations.post) {
        decisionMatch = { action: "redirect", target: effectiveDestinations.post, id: "intent_post_override" };
      } else if (effectiveDestinations.converted) {
        decisionMatch = { action: "redirect", target: effectiveDestinations.converted, id: "intent_converted_override" };
      }
    } else if (pState.h === 1 && effectiveDestinations.hot) {
      decisionMatch = { action: "redirect", target: effectiveDestinations.hot, id: "intent_hot_override" };
    } else if (effectiveDestinations.warm) {
      // Intent warm destination check based on pState fields (v=1 or e>=20 or tags exist)
      if (pState.v === 1 || (pState.e || 0) >= 20 || (Array.isArray(userState.t) && userState.t.length > 0)) {
        decisionMatch = { action: "redirect", target: effectiveDestinations.warm, id: "intent_warm_override" };
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
