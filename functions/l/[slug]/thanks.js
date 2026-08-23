import { extractProductSubdomain, validateProductSubdomainMatch } from "../../_shared/slug-utils.js";
import { renderHub } from "../../_shared/hub-renderer.js";
import { resolveLinks } from "../../_shared/links.js";

const SEC_HEADERS = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=()",
};

/**
 * Normalizes a slug to lowercase.
 */
function normalizeSlug(s) {
  if (!s || typeof s !== "string") return "";
  return s.trim().toLowerCase();
}

/**
 * Renders a simple fallback 404 page if no layout is found.
 */
function renderFallback(message) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Not Found</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .card { background: #1e293b; border: 1px solid #334155; padding: 2.5rem 2rem; border-radius: 12px; max-width: 420px; width: 100%; box-shadow: 0 10px 25px rgba(0,0,0,0.3); text-align: center; }
    h1 { font-size: 2.5rem; margin: 0 0 0.5rem 0; color: #94a3b8; }
    p { font-size: 1rem; color: #cbd5e1; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>404</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
  return new Response(html, {
    status: 404,
    headers: { ...SEC_HEADERS, "Cache-Control": "no-store", "Content-Type": "text/html;charset=UTF-8" }
  });
}

/**
 * Render standard success if no thanksLayout is provided.
 */
function renderDefaultThanks() {
  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Talebiniz Alındı - Teşekkürler!</title>
  <style>
    :root { --primary: #0F172A; --success: #22C55E; --bg: #F8FAFC; --card-bg: #FFFFFF; --text-main: #334155; --text-muted: #64748B; --border: #E2E8F0; }
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: var(--bg); color: var(--text-main); display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .container { background: var(--card-bg); border: 1px solid var(--border); border-radius: 16px; padding: 3rem 2rem; max-width: 480px; width: 90%; text-align: center; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); }
    .icon { background-color: #DCFCE7; color: var(--success); width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem auto; }
    .icon svg { width: 40px; height: 40px; }
    h1 { font-size: 1.75rem; font-weight: 700; color: var(--primary); margin: 0 0 1rem 0; }
    p { font-size: 1rem; line-height: 1.6; color: var(--text-muted); margin: 0 0 2rem 0; }
    .btn { display: inline-block; background-color: var(--primary); color: #FFF; text-decoration: none; padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: 600; transition: opacity 0.2s; }
    .btn:hover { opacity: 0.9; }
    .footer { margin-top: 2rem; font-size: 0.85rem; color: var(--text-muted); }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">
      <svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path>
      </svg>
    </div>
    <h1>Talebiniz Başarıyla Alındı</h1>
    <p>Bilgileriniz sistemimize güvenli bir şekilde ulaştı. İlgili ekiplerimiz en kısa sürede sizinle iletişime geçecektir.</p>
    <a href="https://www.teklifi.online" class="btn">Ana Sayfaya Dön</a>
    <div class="footer">Teklifi.online</div>
  </div>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html;charset=UTF-8", ...SEC_HEADERS, "Cache-Control": "no-store" }
  });
}

async function findLandingVersionBySlug(slug, env) {
  if (!slug || !env.APP_CONFIG) return null;
  const clean = normalizeSlug(slug);

  try {
    const directIdx = await env.APP_CONFIG.get(`landing:${clean}`, { type: "json" });
    if (directIdx && directIdx.campaignId) {
      const campaign = await env.APP_CONFIG.get(`campaign:${directIdx.campaignId}`, { type: "json" });
      if (campaign && Array.isArray(campaign.landings)) {
        const landing = campaign.landings.find(l => 
          l.id === directIdx.landingId || normalizeSlug(l.slug) === clean || l.id === clean
        );
        if (landing) return { campaign, landing };
      }
    }
  } catch (e) {}

  try {
    let cursor;
    do {
      const page = await env.APP_CONFIG.list({ prefix: "campaign:", cursor });
      for (const key of page.keys) {
        try {
          const campaign = await env.APP_CONFIG.get(key.name, { type: "json" });
          if (campaign && Array.isArray(campaign.landings)) {
            const landing = campaign.landings.find(l => 
              normalizeSlug(l.slug) === clean || l.id === clean || normalizeSlug(l.alias) === clean
            );
            if (landing) return { campaign, landing };
          }
        } catch(e) {}
      }
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
  } catch (e) {}

  return null;
}

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const slug = normalizeSlug(params.slug || "");

  if (!slug) {
    return renderFallback("Route not specified.");
  }

  let found = null;
  if (productSubdomain) {
    found = await findLandingVersionBySlug(productSubdomain + "-" + slug, env);
  }
  if (!found) {
    found = await findLandingVersionBySlug(slug, env);
  }
  
  if (!found || !found.landing) {
    // If we can't find a custom setup, return the default so we don't break functionality
    return renderDefaultThanks();
  }

  const { campaign, landing } = found;

  // If there's no thanksLayout configured for this landing, use default
  if (!Array.isArray(landing.thanksLayout) || landing.thanksLayout.length === 0) {
    return renderDefaultThanks();
  }

  const config = (await env.LANDING_CONFIG?.get("hub_config", { type: "json" })) || {};
  const liveComponents = (await env.APP_CONFIG?.get("comp_live", { type: "json" })) || [];
  const links = resolveLinks(campaign, config);

  // Re-map the landing configuration so hub-renderer uses thanksLayout as the main layout
  const landingConfigData = {
    ...campaign,
    ...landing,
    layout: landing.thanksLayout, // Override standard layout with thanksLayout!
    landings: [landing],
    mainLandingId: landing.id
  };

  const html = renderHub({
    contextType: "landing-thanks",
    contextId:   slug + "-thanks",
    campaign:    campaign.slug || slug,
    defaultUtms: {},
    links,
    ga4Id:       env.GA4_ID || "",
    metaPixelId: env.META_PIXEL_ID || "",
    config,
    slug:        (landing.slug || slug) + "-thanks",
    slugData:    landingConfigData,
    components:  liveComponents,
    isPreview:   false,
    intentConfig: landingConfigData
  });

  return new Response(html, {
    status: 200,
    headers: {
      ...SEC_HEADERS,
      "Content-Type":  "text/html;charset=UTF-8",
      "Cache-Control": "no-store",
    }
  });
}
