import fs from 'fs';
let code = fs.readFileSync('functions/[[path]].js', 'utf8');

const targetStr = `  // ── Alias Path Target Redirect ──────────────────────────────────────────
  if (typeof canonicalSlug === "string" && canonicalSlug.startsWith("/")) {
    const originalHost = request.headers.get("x-forwarded-host") || request.headers.get("x-original-host") || url.hostname;
    const protocol = request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
    const baseOrigin = \`\${protocol}://\${originalHost}\`;
    
    // Strip subdomain prefix if redirecting to a landing page to keep URLs clean
    let cleanCanonicalSlug = canonicalSlug;
    if (cleanCanonicalSlug.startsWith("/l/")) {
      const parts = originalHost.split(".");
      if (parts.length > 2 && parts[0] !== "www") {
        const subdomain = parts[0];
        const prefix = "/l/" + subdomain + "-";
        if (cleanCanonicalSlug.startsWith(prefix)) {
          cleanCanonicalSlug = "/l/" + cleanCanonicalSlug.slice(prefix.length);
        }
      }
    }

    const redirectUrl = new URL(cleanCanonicalSlug, baseOrigin);
    url.searchParams.forEach((val, key) => {
      redirectUrl.searchParams.set(key, val);
    });
    return Response.redirect(redirectUrl.toString(), 302);
  }`;

const replacementStr = `  // ── Alias Path Target Rewrite ──────────────────────────────────────────
  if (typeof canonicalSlug === "string" && canonicalSlug.startsWith("/")) {
    // Instead of redirecting (which changes the user's URL), we do an internal rewrite.
    // This allows the user to see the alias (e.g. /teklifal) in their address bar,
    // while the server transparently fetches the canonical content (/l/trafik-yenileme-cold).
    let targetPath = canonicalSlug;
    
    // If the user requested an alias with a modifier (like /teklifal/thanks),
    // append the modifier to the canonical path (/l/trafik-yenileme-cold/thanks)
    if (modifier) {
      targetPath = targetPath.endsWith("/") ? targetPath + modifier : targetPath + "/" + modifier;
    }
    
    const internalUrl = new URL(request.url);
    internalUrl.pathname = targetPath;
    
    // Fetch internally
    const rewriteReq = new Request(internalUrl.toString(), request);
    return fetch(rewriteReq);
  }`;

if (code.includes(targetStr)) {
  console.log("Patching [[path]].js to use rewrite...");
  code = code.replace(targetStr, replacementStr);
  fs.writeFileSync('functions/[[path]].js', code);
} else {
  console.log("Target string not found in [[path]].js");
}
