/**
 * functions/_shared/user-state.js — User intent and behavior tracking (v1).
 *
 * Provides a structured way to manage the 'cos_state' cookie, which tracks
 * user "warmth" (intent level) across visits without requiring a database.
 *
 * State fields (short keys to keep the cookie small):
 *   uid : string  — Persistent User ID (UUID)
 *   v   : number  — Visited (0=new, 1=returning)
 *   c   : number  — Converted (0=no, 1=yes)
 *   h   : number  — Hard Click (0=none, 1=clicked CTA/Buy)
 *   e   : number  — Engagement Score (0-100, based on time/scroll)
 *   u   : number  — Entered Upsell (0=no, 1=yes)
 *   u   : number  — Entered Upsell (0=no, 1=yes)
 *   t   : array   — Dynamic Tags Strings (e.g. ['music', 'vip'])
 *   ts  : number  — Unix timestamp of last update
 */

export const DEFAULT_USER_STATE = {
  uid: "",
  v: 0,
  c: 0,
  h: 0,
  e: 0,
  u: 0,
  t: [],
  ts: 0,
};

/**
 * Parse the cos_state cookie value into a structured object.
 *
 * @param {string|null} cookieValue — raw value from readCookie(request, "cos_state")
 * @returns {object}                — validated user state object
 */
export function parseUserState(cookieValue) {
  if (!cookieValue) return { ...DEFAULT_USER_STATE };
  try {
    const raw = JSON.parse(decodeURIComponent(cookieValue));
    // Ensure all default fields are present
    return Object.assign({ ...DEFAULT_USER_STATE }, raw);
  } catch (_) {
    // Malformed JSON — reset to default
    return { ...DEFAULT_USER_STATE };
  }
}

/**
 * Serialize the user state object for cookie storage.
 *
 * @param {object} user
 * @returns {string} — URI-encoded JSON
 */
export function serializeUserState(user) {
  const payload = {
    uid: user.uid || "",
    v: Number(user.v) || 0,
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
 * Apply updates to a user state object.
 *
 * @param {object} user  — current state
 * @param {object} patch — fields to update
 * @returns {object}     — new state object with updated 'ts'
 */
export function updateUserState(user, patch) {
  return {
    ...user,
    ...patch,
    ts: Math.floor(Date.now() / 1000),
  };
}
