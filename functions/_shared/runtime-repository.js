/**
 * functions/_shared/runtime-repository.js
 * 
 * CogniLink Runtime Repository.
 * Sole provider of raw KV data to the Runtime Adapter.
 * 
 * Rules:
 * - Knows about KV bindings (`env.SLUG_LINKS`, `env.APP_CONFIG`, `env.ROUTE_ALIAS`).
 * - DOES NOT normalize, fallback, or validate data.
 * - DOES NOT use the request or response objects.
 * - ALWAYS returns raw JSON or null.
 */

export function createRuntimeRepository(env) {
  // TODO: Repository Cache Layer (e.g., new Map() for in-memory cache)

  async function fetchLegacy(identifier) {
    if (!identifier || !env.SLUG_LINKS) return null;
    try {
      // TODO: Check Cache Layer
      return await env.SLUG_LINKS.get(identifier, { type: "json" });
    } catch (e) {
      console.error(`[Repository] Error fetching legacy SLUG_LINKS for ${identifier}:`, e);
      return null;
    }
  }

  async function fetchPage(pageId) {
    if (!pageId || !env.APP_CONFIG) return null;
    try {
      // Use the REAL data source: 'hub:' prefix used by the existing Landing system
      return await env.APP_CONFIG.get(`hub:${pageId}`, { type: "json" });
    } catch (e) {
      console.error(`[Repository] Error fetching page for ${pageId}:`, e);
      return null;
    }
  }

  async function fetchCampaign(campaignId) {
    if (!campaignId || !env.APP_CONFIG) return null;
    try {
      return await env.APP_CONFIG.get(`campaign:${campaignId}`, { type: "json" });
    } catch (e) {
      console.error(`[Repository] Error fetching campaign for ${campaignId}:`, e);
      return null;
    }
  }

  async function fetchAlias(alias) {
    if (!alias || !env.ROUTE_ALIAS) return null;
    try {
      return await env.ROUTE_ALIAS.get(`route:${alias}`, { type: "text" });
    } catch (e) {
      console.error(`[Repository] Error fetching alias for ${alias}:`, e);
      return null;
    }
  }

  async function fetchV2(campaignId, pageId = campaignId) {
    const rawCampaign = await fetchCampaign(campaignId);

    let rawPage = null;
    let nestedLanding = null;

    if (rawCampaign && Array.isArray(rawCampaign.landings)) {
      const targetId = (pageId === campaignId) ? rawCampaign.mainLandingId : pageId;
      nestedLanding = rawCampaign.landings.find(l => l.id === targetId || l.slug === targetId) || rawCampaign.landings[0];
    }

    if (!nestedLanding && pageId) {
      rawPage = await fetchPage(pageId);
    }

    if (!rawCampaign && !rawPage && !nestedLanding) {
      return null;
    }

    const sourcePage = nestedLanding || rawPage;
    let page = null;
    if (sourcePage) {
      const headerHtml = typeof sourcePage.customHeaderHtml === 'string' ? sourcePage.customHeaderHtml : "";
      const footerHtml = typeof sourcePage.customFooterHtml === 'string' ? sourcePage.customFooterHtml : "";
      const customHtml = [headerHtml, footerHtml].filter(Boolean).join("\n");

      page = {
        id: sourcePage.slug || sourcePage.id || pageId,
        title: sourcePage.pageTitle || sourcePage.title || null,
        layout: Array.isArray(sourcePage.layout) ? sourcePage.layout : [],
        components: Array.isArray(sourcePage.components) ? sourcePage.components : [],
        links: Array.isArray(sourcePage.links) ? sourcePage.links : [],
        custom_css: typeof sourcePage.customStyleCss === 'string' ? sourcePage.customStyleCss : "",
        custom_html: customHtml,
        custom_js: typeof sourcePage.customScript === 'string' ? sourcePage.customScript : (typeof sourcePage.custom_js === 'string' ? sourcePage.custom_js : ""),
        redirect: sourcePage.redirectUrl || sourcePage.redirect || null,
        theme: sourcePage.theme || null,
        metadata: sourcePage.metadata || {},
        modifier: sourcePage.modifier || null
      };
    }

    let campaign = rawCampaign;
    if (!campaign && rawPage) {
      campaign = {
        id: rawPage.campaign || null,
        name: rawPage.campaign || null,
        utm_defaults: rawPage.defaults || {},
        status: rawPage.isActive === false ? "inactive" : "active",
        modifier: rawPage.modifier || null
      };
    }

    return { campaign, page };
  }

  return {
    fetchLegacy,
    fetchPage,
    fetchCampaign,
    fetchAlias,
    fetchV2
  };
}
