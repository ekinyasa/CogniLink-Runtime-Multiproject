const SEC_HEADERS = {
  "X-Robots-Tag": "noindex,nofollow",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

/**
 * Validates whether a redirect URL is safe (absolute http/https or relative path).
 * Prevents javascript: or data: open redirect injection.
 * 
 * @param {string} targetUrl 
 * @returns {boolean}
 */
export function isSafeRedirectTarget(targetUrl) {
  if (!targetUrl || typeof targetUrl !== "string") return false;
  const trimmed = targetUrl.trim();
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (_) {
    return false;
  }
}

/**
 * Builds a secure, canonical HTTP redirect response.
 * Option to preserve and merge utm_* search params from inbound request URL.
 * 
 * @param {string} targetUrl 
 * @param {object} [options]
 * @param {number} [options.statusCode=302]
 * @param {boolean} [options.preserveUtm=false]
 * @param {string|URL} [options.requestUrl=null]
 * @param {object} [options.headers={}]
 * @returns {Response}
 */
export function buildRedirectResponse(targetUrl, options = {}) {
  const {
    statusCode = 302,
    preserveUtm = false,
    requestUrl = null,
    headers = {}
  } = options;

  if (!isSafeRedirectTarget(targetUrl)) {
    return new Response("Invalid Redirect Target", {
      status: 400,
      headers: { ...SEC_HEADERS, ...headers }
    });
  }

  let finalUrl = targetUrl.trim();

  // Preserves utm_* query parameters if requested
  if (preserveUtm && requestUrl) {
    try {
      const inboundUrl = new URL(requestUrl);
      const targetObj = new URL(finalUrl, inboundUrl.origin);

      inboundUrl.searchParams.forEach((value, key) => {
        if (key.startsWith("utm_") && !targetObj.searchParams.has(key)) {
          targetObj.searchParams.set(key, value);
        }
      });

      finalUrl = targetObj.toString();
    } catch (_) {
      // Fall through to un-decorated finalUrl on parse error
    }
  }

  const responseHeaders = new Headers({
    ...SEC_HEADERS,
    ...headers,
    "Location": finalUrl
  });

  return new Response(null, {
    status: statusCode,
    headers: responseHeaders
  });
}
