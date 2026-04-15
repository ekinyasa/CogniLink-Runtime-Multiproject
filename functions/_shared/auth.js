export function verifyToken(request, env) {
  const header = request.headers.get("Authorization") || "";
  if (!header.startsWith("Bearer ")) return false;
  const token = header.slice(7).trim();
  if (!token || !env.ADMIN_TOKEN) return false;
  // Constant-time comparison via crypto.subtle.timingSafeEqual (CF Workers extension).
  // Prevents timing-based token oracle attacks.
  // Length mismatch is checked first so timingSafeEqual never receives unequal-length
  // buffers (it throws on length mismatch rather than returning false).
  const enc = new TextEncoder();
  const a   = enc.encode(token);
  const b   = enc.encode(env.ADMIN_TOKEN);
  if (a.byteLength !== b.byteLength) return false;
  return crypto.subtle.timingSafeEqual(a, b);
}

export function unauthorized() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: {
      "Content-Type": "application/json",
      "WWW-Authenticate": 'Bearer realm="studio-panel"',
    },
  });
}

export function jsonHeaders() {
  return {
    "Content-Type": "application/json",
    "X-Content-Type-Options": "nosniff",
  };
}

export function validateSlug(slug) {
  if (!slug || typeof slug !== "string") return "Slug is required.";
  if (slug.length > 64) return "Slug must be 64 characters or fewer.";
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) && slug.length > 1)
    return "Slug must use lowercase letters, numbers, and hyphens only (no leading/trailing hyphens).";
  return null;
}

/** Validate a campaign name (same charset rules as slugs). */
export function validateCampaignName(name) {
  if (!name || typeof name !== "string") return "Campaign name is required.";
  if (name.length > 64) return "Campaign name must be 64 characters or fewer.";
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(name) && name.length > 1)
    return "Campaign name must use lowercase letters, numbers, and hyphens only (no leading/trailing hyphens).";
  return null;
}
