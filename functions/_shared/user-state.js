/**
 * functions/_shared/user-state.js — User intent and behavior tracking (v2).
 *
 * Provides a structured way to manage the 'cos_state' cookie, which tracks
 * user "warmth" (intent level) across visits without requiring a database.
 * Supports PRODUCT-SCOPED state tracking to avoid cross-product pollution.
 *
 * State fields (short keys to keep the cookie small):
 *   uid : string  — Persistent User ID (UUID)
 *   p   : object  — Product-scoped states: { "trafik": { c:1, h:0, e:45, v:1 } }
 *   v   : number  — Global Visited
 *   f   : number  — Global Form Submitted
 *   c   : number  — Global Converted (Sale)
 *   h   : number  — Global Hard Click / Hot
 *   e   : number  — Global Engagement Score
 *   u   : number  — Global Entered Upsell
 *   t   : array   — Dynamic Tags Strings
 *   ts  : number  — Unix timestamp of last update
 */

export const DEFAULT_USER_STATE = {
  uid: "",
  p: {},
  v: 0,
  f: 0,
  c: 0,
  h: 0,
  e: 0,
  u: 0,
  t: [],
  ts: 0,
};

export function parseUserState(cookieValue) {
  if (!cookieValue) return { ...DEFAULT_USER_STATE };
  try {
    const raw = JSON.parse(decodeURIComponent(cookieValue));
    if (!raw.p) raw.p = {};
    return Object.assign({ ...DEFAULT_USER_STATE }, raw);
  } catch (_) {
    return { ...DEFAULT_USER_STATE };
  }
}

export function serializeUserState(user) {
  const payload = {
    uid: user.uid || "",
    p: user.p || {},
    v: Number(user.v) || 0,
    f: Number(user.f) || 0,
    c: Number(user.c) || 0,
    h: Number(user.h) || 0,
    e: Number(user.e) || 0,
    u: Number(user.u) || 0,
    t: Array.isArray(user.t) ? user.t : [],
    ts: user.ts || Math.floor(Date.now() / 1000),
  };
  return encodeURIComponent(JSON.stringify(payload));
}

/**
 * Apply updates to a user state object. Can update global or product-scoped state.
 */
export function updateUserState(user, patch, product = null, intentSlug = null) {
  const newState = { ...user, ts: Math.floor(Date.now() / 1000) };
  if (!newState.p) newState.p = {};

  const scopeKey = intentSlug || product;
  if (scopeKey) {
    // Apply patch to product scope
    const prodState = newState.p[scopeKey] || { v: 0, f: 0, c: 0, h: 0, e: 0 };
    newState.p[scopeKey] = { ...prodState, ...patch };

    // Also update global state as a fallback/aggregate (optional but good for backwards compat)
    if (patch.f !== undefined) newState.f = Math.max(newState.f || 0, patch.f);
    if (patch.c !== undefined) newState.c = Math.max(newState.c || 0, patch.c);
    if (patch.h !== undefined) newState.h = Math.max(newState.h || 0, patch.h);
    if (patch.e !== undefined) newState.e = Math.max(newState.e || 0, patch.e);
    if (patch.v !== undefined) newState.v = Math.max(newState.v || 0, patch.v);
  } else {
    // Apply to global scope directly
    Object.assign(newState, patch);
  }

  return newState;
}

export function calculateVisitorIntentLevel(userState, product = null, intentSlug = null) {
  if (!userState) return "cold";

  const scopeKey = intentSlug || product;
  const state = (scopeKey && userState.p && userState.p[scopeKey]) ? userState.p[scopeKey] : userState;

  const hasLegacySubmit = state.c === 1 && Array.isArray(userState.t) && userState.t.includes("lead_submitted");

  if (state.c === 1 && !hasLegacySubmit) return "converted";
  if (state.f === 1 || hasLegacySubmit) return "form_submitted";
  if (state.h === 1 || (state.e || 0) >= 60) return "hot";
  // Hardcoded Warm classification removed per v1 production contract
  // if (state.v === 1 || (state.e || 0) >= 20 || (Array.isArray(userState.t) && userState.t.length > 0)) {
    //   return "warm";
  // }
  return "cold";
}

export function getVisitorIntentSummary(userState, product = null) {
  const base = userState || DEFAULT_USER_STATE;
  const state = (product && base.p && base.p[product]) ? base.p[product] : base;

  const tier = calculateVisitorIntentLevel(base, product);
  return {
    tier,
    score: Number(state.e) || 0,
    isReturning: Number(state.v) === 1,
    hasFormSubmitted: Number(state.f) === 1,
    hasConverted: Number(state.c) === 1,
    isHot: Number(state.h) === 1,
    tags: Array.isArray(base.t) ? base.t : [],
    lastSeen: Number(base.ts) || 0
  };
}
