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
    // Uses Promise.all to fetch decoupled entities in parallel
    const [rawCampaign, rawPage] = await Promise.all([
      fetchCampaign(campaignId),
      fetchPage(pageId)
    ]);

    if (!rawCampaign && !rawPage) {
      return null;
    }

    // Map the real existing Landing record (hub:) to the V2 pageContent schema
    let page = null;
    if (rawPage) {
      const headerHtml = typeof rawPage.customHeaderHtml === 'string' ? rawPage.customHeaderHtml : "";
      const footerHtml = typeof rawPage.customFooterHtml === 'string' ? rawPage.customFooterHtml : "";
      const customHtml = [headerHtml, footerHtml].filter(Boolean).join("\n");

      page = {
        id: rawPage.slug || rawPage.id || pageId,
        title: rawPage.pageTitle || rawPage.title || null,
        layout: Array.isArray(rawPage.layout) ? rawPage.layout : [],
        components: Array.isArray(rawPage.components) ? rawPage.components : [],
        links: Array.isArray(rawPage.links) ? rawPage.links : [],
        custom_css: typeof rawPage.customStyleCss === 'string' ? rawPage.customStyleCss : "",
        custom_html: customHtml,
        redirect: rawPage.redirectUrl || rawPage.redirect || null,
        theme: rawPage.theme || null,
        metadata: rawPage.metadata || {},
        modifier: rawPage.modifier || null
      };
    }

    // If campaign is missing but page exists, extract campaign data from the page record (legacy structure)
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
