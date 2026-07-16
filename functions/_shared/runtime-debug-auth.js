/**
 * functions/_shared/runtime-debug-auth.js
 * 
 * Header-based secure authentication for Runtime Inspector.
 */

// Dependency-free timing-safe string comparison
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  let mismatch = a.length === b.length ? 0 : 1;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const charA = i < a.length ? a.charCodeAt(i) : 0;
    const charB = i < b.length ? b.charCodeAt(i) : 0;
    mismatch |= (charA ^ charB);
  }
  return mismatch === 0;
}

/**
 * Validates if the request is authorized to see the Runtime Inspector JSON.
 * Returns true only if runtime-debug=1 is present AND a valid header token matches env.ADMIN_TOKEN.
 * 
 * Accepted headers:
 * - Authorization: Bearer <TOKEN>
 * - X-Admin-Token: <TOKEN>
 * 
 * @param {Request} request 
 * @param {Object} env 
 * @returns {boolean}
 */
export function verifyAdminDebug(request, env) {
  const url = new URL(request.url);
  
  if (url.searchParams.get("runtime-debug") !== "1") {
    return false;
  }

  const expectedToken = env.ADMIN_TOKEN;
  if (!expectedToken || typeof expectedToken !== 'string') {
    return false; // No token configured in env
  }

  const authHeader = request.headers.get("Authorization");
  const xAdminHeader = request.headers.get("X-Admin-Token");

  let providedToken = null;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    providedToken = authHeader.substring(7);
  } else if (xAdminHeader) {
    providedToken = xAdminHeader;
  }

  if (!providedToken) {
    return false;
  }

  return timingSafeEqual(providedToken, expectedToken);
}
