/**
 * functions/_shared/rule-repository.js
 * 
 * Extracts rule definitions from legacy storage sources and bindings.
 * Does not mutate rules or perform evaluations.
 */

export function createRuleRepository(env) {
  return {
    /**
     * Finds the actual rule source from legacy objects and bindings.
     * 
     * @param {object} runtimeContext 
     * @param {object} legacyObject 
     * @param {object} options
     * @returns {Promise<{ rules: any[], source: string, source_id: string|null, schema: string }>}
     */
    async fetchRules(runtimeContext, legacyObject = {}, options = {}) {
      try {
        const { engineConfig = null, globalConfig = null } = options;
        
        // 1. Check Engine Map ID overrides
        if (legacyObject.engineMapId && engineConfig?.customMaps && engineConfig.customMaps[legacyObject.engineMapId]) {
          const mapData = engineConfig.customMaps[legacyObject.engineMapId];
          if (Array.isArray(mapData.rules)) {
            // Note: mapData.rules are infinite tag-based rules in legacy system.
            // We might just return them raw here.
            return {
              rules: mapData.rules,
              source: "engine_config_map",
              source_id: legacyObject.engineMapId,
              schema: "legacy"
            };
          }
        }

        // 2. Check Global Engine Config tag-based rules
        if (engineConfig?.redirects && Array.isArray(engineConfig.redirects.rules)) {
          return {
            rules: engineConfig.redirects.rules,
            source: "engine_config_global",
            source_id: "global",
            schema: "legacy"
          };
        }

        // 3. Check Page Definition Rules
        if (Array.isArray(legacyObject.decision_rules) && legacyObject.decision_rules.length > 0) {
          return {
            rules: legacyObject.decision_rules,
            source: "page_config",
            source_id: legacyObject.slug || legacyObject.id || "unknown",
            schema: "legacy"
          };
        }

        // 4. Check Global Default Decision Rules
        if (globalConfig && Array.isArray(globalConfig.decision_rules) && globalConfig.decision_rules.length > 0) {
          return {
            rules: globalConfig.decision_rules,
            source: "global_config",
            source_id: "global",
            schema: "legacy"
          };
        }

        return { rules: [], source: "none", source_id: null, schema: "none" };
      } catch (e) {
        console.error("[rule-repository] Error fetching rules:", e);
        return { rules: [], source: "error", source_id: null, schema: "none" };
      }
    }
  };
}
