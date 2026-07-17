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
  const { source = "", medium = "", campaign = "", decisionRules = [], engineConfig = null } = opts;

  // 1. Read existing state
  const rawState = readCookie(request, "cos_state");
  let userState  = parseUserState(rawState);
  let stateUpdate = false;
  const cookies   = [];

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

  // 3a. Priorities Global Engine Configuration from Funnels > Dashboard (Hard Overrides)
  if (engineConfig) {
    let checkRedirects = engineConfig.redirects;
    if (opts.engineMapId && engineConfig.customMaps && engineConfig.customMaps[opts.engineMapId]) {
      checkRedirects = engineConfig.customMaps[opts.engineMapId];
    }
    
    if (checkRedirects) {
      // 1. Dynamic Infinite Tag-Based Rules (Evaluate First)
      if (Array.isArray(checkRedirects.rules) && checkRedirects.rules.length > 0) {
        const uTags = Array.isArray(userState.t) ? userState.t : [];
        for (const rule of checkRedirects.rules) {
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

      // 2. Legacy Hardcoded Rules (Fallback)
      if (!decisionMatch) {
        if (userState.c === 1) {
          if (userState.u === 1 && checkRedirects.post) {
            decisionMatch = { action: "redirect", target: checkRedirects.post, id: "engine_post_override" };
          } else if (checkRedirects.converted) {
            decisionMatch = { action: "redirect", target: checkRedirects.converted, id: "engine_converted_override" };
          }
        } else if (userState.h === 1 && checkRedirects.hot) {
          decisionMatch = { action: "redirect", target: checkRedirects.hot, id: "engine_hot_override" };
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
  if (userState.v === 0) {
    userState   = updateUserState(userState, { v: 1 });
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
