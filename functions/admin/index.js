import { renderAdmin } from "../_shared/admin-renderer.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const originalHost = request.headers.get("x-forwarded-host") || request.headers.get("x-original-host") || url.hostname;
  const customDomain = env.CUSTOM_DOMAIN || originalHost;

  const rootDomain = (env && env.ROOT_DOMAIN) || "";
  const adminSubdomain = (env && env.ADMIN_SUBDOMAIN) || "login";
  const adminHost = rootDomain ? `${adminSubdomain}.${rootDomain}` : "login.teklifi.online";

  if (originalHost === adminHost || originalHost === "login.teklifi.online") {
    return Response.redirect(`https://${adminHost}/${url.search}`, 301);
  }

  // Enforce admin host for admin panel
  const isTargetDomain = rootDomain && originalHost.endsWith(rootDomain);
  const isTeklifi = originalHost.endsWith("teklifi.online");
  if ((isTargetDomain || isTeklifi) && originalHost !== adminHost && originalHost !== "login.teklifi.online") {
    return Response.redirect(`https://${adminHost}/${url.search}`, 301);
  }

  return new Response(renderAdmin({
    branch: (env && env.CF_PAGES_BRANCH)     || "",
    sha:    (env && env.CF_PAGES_COMMIT_SHA) || "",
    customDomain: customDomain
  }), {
    headers: {
      "Content-Type":           "text/html;charset=UTF-8",
      "Cache-Control":          "no-store",
      "X-Robots-Tag":           "noindex,nofollow,noarchive",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options":        "DENY",
      "Referrer-Policy":        "no-referrer",
    },
  });
}