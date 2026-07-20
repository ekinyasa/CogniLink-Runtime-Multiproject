/**
 * functions/_shared/runtime-adapter.js
 * 
 * CogniLink Runtime Adapter (Compatibility Layer).
 * Takes raw objects from the Repository layer and standardizes them into
 * a strictly typed RuntimeContext for the rest of the application.
 * 
 * Pure normalization engine. Zero hidden state. Zero direct KV I/O operations.
 * * This module MUST remain:

 *

 * - deterministic

 * - side-effect free

 * - repository independent

 * - renderer independent

 * - decision-engine independent

 * - telemetry independent

 *

 * It only transforms raw runtime objects

 * into RuntimeContext.
 */

/**
 * Strict base schema for the RuntimeContext output.
 * Any normalized output will be safely merged with these defaults.
 */
export const DEFAULT_RUNTIME_CONTEXT = {
  campaignContext: {
    id: null,
    name: null,
    utm_defaults: {},
    status: "inactive"
  },
  pageContent: {
    id: null,
    title: null,
    layout: [],
    components: [],
    custom_css: "",
    custom_html: ""
  },
  activeLinks: [],
  render_mode: "canonical", // canonical | campaign | experiment | preview | redirect
  metadata: {
    source_schema: "unknown",
    runtime_version: "adapter"
  }
};

/**
 * Main public contract for the Adapter.
 * 
 * Dependency injected with a `provider` object to retrieve raw data, allowing
 * the adapter to remain completely agnostic of KV, D1, or Mock environments.
 * 
 * @param {string} identifier - The canonical slug or page ID to resolve.
 * @param {object} provider - The repository abstraction { fetchLegacy(id), fetchV2(id) }.
 * @param {object} options - Options containing render_mode, etc.
 * @returns {Promise<object>} - The normalized, strictly-typed RuntimeContext.
 */
export async function resolveContext(identifier, provider, options = {}) {
  const renderMode = options.render_mode || "canonical";

  if (!provider) {
    throw new Error("Adapter requires a data provider.");
  }

  let rawData = null;
  let schemaType = "unknown";

  let campaignId = identifier;
  let pageId = identifier;
  if (identifier.includes(":")) {
    const parts = identifier.split(":");
    campaignId = parts[0];
    pageId = parts[1];
  }

  // 1. Attempt V2 decoupled schema first
  if (typeof provider.fetchV2 === "function") {
    rawData = await provider.fetchV2(campaignId, pageId);
    if (rawData) schemaType = "v2";
  }

  // 2. Fallback to Legacy SLUG_LINKS schema
  if (!rawData && typeof provider.fetchLegacy === "function") {
    rawData = await provider.fetchLegacy(identifier);
    if (rawData) schemaType = "legacy";
  }

  // 3. Handle missing records
  if (!rawData) {
    return {
      ...DEFAULT_RUNTIME_CONTEXT,
      render_mode: renderMode,
      metadata: { source_schema: "not_found", runtime_version: "adapter" }
    };
  }

  // 4. Normalize based on detected schema
  let normalized;
  if (schemaType === "v2") {
    normalized = normalizeV2(rawData, options);
  } else {
    normalized = normalizeLegacy(rawData, options);
  }

  // 5. Apply deterministic guarantees and merge with defaults
  return {
    campaignContext: { ...DEFAULT_RUNTIME_CONTEXT.campaignContext, ...normalized?.campaignContext },
    pageContent: { ...DEFAULT_RUNTIME_CONTEXT.pageContent, ...normalized?.pageContent },
    activeLinks: Array.isArray(normalized?.activeLinks) ? normalized.activeLinks : [],
    render_mode: renderMode,
    metadata: {
      ...DEFAULT_RUNTIME_CONTEXT.metadata,
      ...(normalized?.metadata || {}),
      source_schema: schemaType,
      runtime_version: "adapter"
    }
  };
}

/**
 * Normalizes legacy SLUG_LINKS data.
 * Pure function: deterministic mapping of legacy schema to V2 contract.
 * 
 * @param {object} rawLegacyData - The raw JSON object from SLUG_LINKS.
 * @param {object} options - Execution context options.
 * @returns {object} - Partial RuntimeContext payload.
 */
function normalizeLegacy(rawLegacyData, options = {}) {
  const data = rawLegacyData || {};
  
  const campaignName = typeof data.campaign === 'string' ? data.campaign : null;
  const utmDefaults = (data.defaults && typeof data.defaults === 'object') ? data.defaults : {};
  const status = data.isActive === false ? "inactive" : "active";

  // Normalize layout
  let layout = Array.isArray(data.layout) ? data.layout : [];
  layout = layout.filter(item => item && typeof item === 'object' && item.id);

  // Normalize components (no null, no duplicate, valid strings)
  const rawComponents = Array.isArray(data.components) ? data.components : [];
  layout.forEach(item => {
    if (item.type === "component" && item.id) rawComponents.push(item.id);
  });
  const components = [...new Set(rawComponents.filter(c => typeof c === 'string' && c.trim() !== ''))];

  // Normalize links (no null, duplicate IDs, disabled/inactive, missing href)
  const rawLinks = Array.isArray(data.links) ? data.links : [];
  const activeLinksMap = new Map();
  
  for (const link of rawLinks) {
    if (!link || typeof link !== 'object') continue;
    if (!link.id || typeof link.href !== 'string' || !link.href.trim()) continue;
    if (link.isActive === false || link.disabled === true) continue;
    
    // First active link with a specific ID wins
    if (!activeLinksMap.has(link.id)) {
      activeLinksMap.set(link.id, link);
    }
  }
  const activeLinks = Array.from(activeLinksMap.values());
  activeLinks.sort((a, b) => (a.order || 0) - (b.order || 0));

  // Normalize HTML/CSS
  const customCss = typeof data.customStyleCss === 'string' ? data.customStyleCss : "";
  const headerHtml = typeof data.customHeaderHtml === 'string' ? data.customHeaderHtml : "";
  const footerHtml = typeof data.customFooterHtml === 'string' ? data.customFooterHtml : "";
  const customHtml = [headerHtml, footerHtml].filter(Boolean).join("\n");

  const title = typeof data.pageTitle === 'string' ? data.pageTitle : (typeof data.title === 'string' ? data.title : null);

  const customMetadata = (data.metadata && typeof data.metadata === 'object') ? data.metadata : {};

  return {
    campaignContext: {
      id: null,
      name: campaignName,
      utm_defaults: utmDefaults,
      status: status
    },
    pageContent: {
      id: data.slug || null,
      title: title, 
      layout: layout,
      components: components,
      custom_css: customCss,
      custom_html: customHtml,
      custom_js: data.customScript || data.custom_js || "",
      redirect: data.redirect || null,
      theme: data.theme || null
    },
    activeLinks: activeLinks,
    metadata: {
      ...customMetadata,
      modifier: data.modifier || null
    }
  };
}

/**
 * Normalizes new decoupled V2 data.
 * Pure function: validates and merges decoupled APP_CONFIG schemas.
 * 
 * @param {object} rawV2Data - The raw combined Campaign & Page object from provider.
 * @param {object} options - Execution context options.
 * @returns {object} - Partial RuntimeContext payload.
 */
function normalizeV2(rawV2Data, options = {}) {
  const data = rawV2Data || {};
  const campaign = data.campaign || {};
  const page = data.page || {};

  // Normalize layout
  let layout = Array.isArray(page.layout) ? page.layout : [];
  layout = layout.filter(item => item && typeof item === 'object' && item.id);

  // Normalize components
  const rawComponents = Array.isArray(page.components) ? page.components : [];
  layout.forEach(item => {
    if (item.type === "component" && item.id) rawComponents.push(item.id);
  });
  const components = [...new Set(rawComponents.filter(c => typeof c === 'string' && c.trim() !== ''))];

  // Normalize links
  const rawLinks = Array.isArray(page.links) ? page.links : [];
  const activeLinksMap = new Map();
  for (const link of rawLinks) {
    if (!link || typeof link !== 'object') continue;
    if (!link.id || typeof link.href !== 'string' || !link.href.trim()) continue;
    if (link.isActive === false || link.disabled === true) continue;
    
    if (!activeLinksMap.has(link.id)) {
      activeLinksMap.set(link.id, link);
    }
  }
  const activeLinks = Array.from(activeLinksMap.values());
  activeLinks.sort((a, b) => (a.order || 0) - (b.order || 0));

  const customMetadata = (page.metadata && typeof page.metadata === 'object') ? page.metadata : {};

  return {
    campaignContext: {
      id: campaign.id || campaign.slug || null,
      name: campaign.name || campaign.slug || null,
      utm_defaults: campaign.utm_defaults || {},
      status: campaign.status || "inactive"
    },
    pageContent: {
      id: page.id || null,
      title: page.title || null,
      layout: layout,
      components: components,
      custom_css: page.custom_css || "",
      custom_html: page.custom_html || "",
      custom_js: page.custom_js || "",
      redirect: page.redirect || null,
      theme: page.theme || null
    },
    activeLinks: activeLinks,
    metadata: {
      ...customMetadata,
      modifier: campaign.modifier || page.modifier || null
    }
  };
}
