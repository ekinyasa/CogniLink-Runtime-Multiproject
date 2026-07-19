export async function createSessionCookie(env) {
  const expiresAt = Date.now() + 12 * 60 * 60 * 1000; // 12 hours
  const data = expiresAt.toString();
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.ADMIN_TOKEN),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  const sigHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  const cookieVal = `${data}.${sigHex}`;
  return `admin_session=${cookieVal}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200`;
}

export async function verifyToken(request, env) {
  // Check cookie first
  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(/(?:^|;\s*)admin_session=([^;]+)/);
  if (match) {
    const val = match[1];
    const parts = val.split(".");
    if (parts.length === 2) {
      const data = parts[0];
      const sigHex = parts[1];
      const expiresAt = parseInt(data, 10);
      if (!isNaN(expiresAt) && expiresAt > Date.now()) {
        try {
          const key = await crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(env.ADMIN_TOKEN),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["verify"]
          );
          const sigBytes = new Uint8Array(sigHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
          const valid = await crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(data));
          if (valid) return true;
        } catch(e) {}
      }
    }
  }

  // Fallback to Bearer token
  const header = request.headers.get("Authorization") || "";
  if (!header.startsWith("Bearer ")) return false;
  const token = header.slice(7).trim();
  if (!token || !env.ADMIN_TOKEN) return false;
  
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
