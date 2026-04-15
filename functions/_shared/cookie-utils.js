/**
 * cookie-utils.js — Minimal cookie parsing and building helpers.
 *
 * Dependency-free. Used for experiment sticky bucketing (exp_<alias> cookies).
 *
 * Cookie naming convention:
 *   exp_<alias>  →  value = selected variant slug
 *
 * Example:
 *   exp_abtest=cd26-test-yt; Path=/; Max-Age=2592000; SameSite=Lax; Secure
 */

// ── Reader ─────────────────────────────────────────────────────────────────────

/**
 * Read a single named cookie value from the request.
 * Returns null when the header is absent or the cookie name is not found.
 *
 * @param {Request} request
 * @param {string}  name    — exact cookie name to look up
 * @returns {string|null}
 */
export function readCookie(request, name) {
  const header = request.headers.get("cookie");
  if (!header) return null;
  
  let latestMatch = null;
  for (const pair of header.split(";")) {
    const eqIdx = pair.indexOf("=");
    if (eqIdx === -1) continue;
    
    const k = pair.slice(0, eqIdx).trim();
    if (k === name) {
      latestMatch = pair.slice(eqIdx + 1).trim();
      // Keep iterating to catch duplicate/shadow cookies and grab the last one.
    }
  }
  return latestMatch || null;
}

// ── Builder ────────────────────────────────────────────────────────────────────

/**
 * Build a Set-Cookie header value string.
 *
 * @param {string}  name
 * @param {string}  value
 * @param {object}  [opts]
 * @param {number}  [opts.maxAge=2592000]   Max-Age in seconds (default 30 days)
 * @param {string}  [opts.path="/"]
 * @param {string}  [opts.sameSite="Lax"]
 * @param {boolean} [opts.secure=true]      Omit Secure only in local dev (http)
 * @returns {string}
 */
export function buildSetCookie(name, value, opts = {}) {
  const maxAge   = opts.maxAge   ?? 2592000;
  const path     = opts.path     ?? "/";
  const sameSite = opts.sameSite ?? "Lax";
  const secure   = opts.secure   !== false;
  const httpOnly = opts.httpOnly === true;

  let cookie = `${name}=${value}; Path=${path}; Max-Age=${maxAge}; SameSite=${sameSite}`;
  if (secure) cookie += "; Secure";
  if (httpOnly) cookie += "; HttpOnly";
  return cookie;
}
