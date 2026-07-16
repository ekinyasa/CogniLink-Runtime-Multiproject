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
      // TODO: Check Cache Layer
      return await env.APP_CONFIG.get(`page:${pageId}`, { type: "json" });
    } catch (e) {
      console.error(`[Repository] Error fetching page for ${pageId}:`, e);
      return null;
    }
  }

  async function fetchCampaign(campaignId) {
    if (!campaignId || !env.APP_CONFIG) return null;
    try {
      // TODO: Check Cache Layer
      return await env.APP_CONFIG.get(`campaign:${campaignId}`, { type: "json" });
    } catch (e) {
      console.error(`[Repository] Error fetching campaign for ${campaignId}:`, e);
      return null;
    }
  }

  async function fetchAlias(alias) {
    if (!alias || !env.ROUTE_ALIAS) return null;
    try {
      // TODO: Check Cache Layer
      return await env.ROUTE_ALIAS.get(`route:${alias}`, { type: "text" });
    } catch (e) {
      console.error(`[Repository] Error fetching alias for ${alias}:`, e);
      return null;
    }
  }

  async function fetchV2(campaignId, pageId = campaignId) {
    // Uses Promise.all to fetch decoupled entities in parallel (No Waterfall)
    const [campaign, page] = await Promise.all([
      fetchCampaign(campaignId),
      fetchPage(pageId)
    ]);

    // If neither exists, return null so adapter falls back to legacy
    if (!campaign && !page) {
      return null;
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
