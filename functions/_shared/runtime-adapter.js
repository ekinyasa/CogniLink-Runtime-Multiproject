/**
 * functions/_shared/runtime-adapter.js
 * 
 * CogniLink Runtime Adapter (Compatibility Layer).
 * Takes raw objects from the Repository layer and standardizes them into
 * a strictly typed RuntimeContext for the rest of the application.
 * 
 * Pure normalization engine. Zero hidden state. Zero direct KV I/O operations.
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

  // 1. Attempt V2 decoupled schema first
  if (typeof provider.fetchV2 === "function") {
    rawData = await provider.fetchV2(identifier);
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
  // TODO: Full mapping implementation in next phases.
  // 1. Extract Campaign Context (defaults, status, campaign name)
  // 2. Construct Virtual Page from layout, customHeaderHtml, customStyleCss
  // 3. Consolidate and resolve Components
  // 4. Filter and sort activeLinks
  
  return {
    campaignContext: {
      id: null,
      name: rawLegacyData?.campaign || null,
      utm_defaults: rawLegacyData?.defaults || {},
      status: rawLegacyData?.isActive === false ? "inactive" : "active"
    },
    pageContent: {
      id: rawLegacyData?.slug || null,
      title: null, 
      layout: rawLegacyData?.layout || [],
      components: rawLegacyData?.components || [],
      custom_css: rawLegacyData?.customStyleCss || "",
      custom_html: rawLegacyData?.customHeaderHtml || ""
    },
    activeLinks: Array.isArray(rawLegacyData?.links) ? rawLegacyData.links : []
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
  // TODO: Full mapping implementation in next phases.
  // Expects rawV2Data to have structured { campaign: {...}, page: {...} } objects
  
  return {
    campaignContext: rawV2Data?.campaign || {},
    pageContent: rawV2Data?.page || {},
    activeLinks: rawV2Data?.page?.links || []
  };
}
