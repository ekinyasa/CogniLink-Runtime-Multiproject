/**
 * functions/_shared/rule-repository.js
 * 
 * Extracts rule definitions from legacy storage sources and bindings.
 * Consolidates legacy tags, redirects, and campaign rules when REAL_RULE_SHADOW_ENABLED is active.
 * Does not mutate rules or perform evaluations.
 */

import { normalizeRulesWithReport } from "./rule-compat.js";

// Helper to make V2 rules for legacy hardcoded overrides
function makeHardcodedOverrideRules(checkRedirects) {
  if (!checkRedirects) return [];
  const rules = [];
  if (checkRedirects.post) {
    rules.push({
      id: "engine_post_override",
      priority: 9000,
      enabled: true,
      condition: {
        and: [
          { field: "userState.c", operator: "equals", value: 1 },
          { field: "userState.u", operator: "equals", value: 1 }
        ]
      },
      action: { type: "redirect", target: checkRedirects.post }
    });
  }
  if (checkRedirects.converted) {
    rules.push({
      id: "engine_converted_override",
      priority: 8999,
      enabled: true,
      condition: { field: "userState.c", operator: "equals", value: 1 },
      action: { type: "redirect", target: checkRedirects.converted }
    });
  }
  if (checkRedirects.hot) {
    rules.push({
      id: "engine_hot_override",
      priority: 8998,
      enabled: true,
      condition: { field: "userState.h", operator: "equals", value: 1 },
      action: { type: "redirect", target: checkRedirects.hot }
    });
  }
  if (checkRedirects.warm) {
    rules.push({
      id: "engine_warm_override",
      priority: 8997,
      enabled: true,
      condition: {
        or: [
          { field: "userState.v", operator: "equals", value: 1 },
          { field: "userState.e", operator: "greater_than_or_equal", value: 20 }
        ]
      },
      action: { type: "redirect", target: checkRedirects.warm }
    });
  }
  return rules;
}

export function createRuleRepository(env) {
  return {
    /**
     * Finds the actual rule source from legacy objects and bindings.
     * 
     * @param {object} runtimeContext 
     * @param {object} legacyObject 
     * @param {object} options
     * @returns {Promise<{ rules: any[], source: string, source_id: string|null, schema: string, raw_count: number, valid_count: number, invalid_count: number }>}
     */
    async fetchRules(runtimeContext, legacyObject = {}, options = {}) {
      try {
        const { engineConfig = null, globalConfig = null, intentDestinations = null } = options;

        // 1. Check shadow_decision_rules for Canary / V2 Direct Rules
        if (Array.isArray(legacyObject.shadow_decision_rules) && legacyObject.shadow_decision_rules.length > 0) {
          return {
            rules: legacyObject.shadow_decision_rules,
            source: "shadow_page_config",
            source_id: legacyObject.slug || legacyObject.id || "unknown",
            schema: "v2",
            raw_count: legacyObject.shadow_decision_rules.length,
            valid_count: legacyObject.shadow_decision_rules.length,
            invalid_count: 0
          };
        }

        const realRuleShadowEnabled = String(env.REAL_RULE_SHADOW_ENABLED) === "true";
        if (!realRuleShadowEnabled) {
          return {
            rules: [],
            source: "none",
            source_id: null,
            schema: "none",
            raw_count: 0,
            valid_count: 0,
            invalid_count: 0
          };
        }

        const consolidatedRules = [];
        let primarySource = "none";
        let primarySourceId = null;
        let totalRawCount = 0;
        let totalUnsupportedCount = 0;
        const unsupportedDetails = [];

        // A. Engine Config Rules & Intent Destination Overrides
        let checkRedirects = null;
        let engineSource = "none";
        let engineSourceId = null;

        if (engineConfig && engineConfig.redirects) {
          checkRedirects = engineConfig.redirects;
          engineSource = "engine_config_global";
          engineSourceId = "global";
        }

        const intentDest = intentDestinations || legacyObject?.destinations || legacyObject?.routing?.destinations || runtimeContext?.campaignContext?.destinations || null;
        const effectiveRedirects = {
          post: (intentDest && intentDest.postConversion) ? intentDest.postConversion : (checkRedirects?.post || null),
          converted: (intentDest && intentDest.converted) ? intentDest.converted : (checkRedirects?.converted || null),
          hot: (intentDest && intentDest.hot) ? intentDest.hot : (checkRedirects?.hot || null),
          warm: (intentDest && intentDest.warm) ? intentDest.warm : (checkRedirects?.warm || null)
        };

        if (checkRedirects) {
          // 1. Tag-based rules
          if (Array.isArray(checkRedirects.rules) && checkRedirects.rules.length > 0) {
            totalRawCount += checkRedirects.rules.length;
            const report = normalizeRulesWithReport(checkRedirects.rules);
            // Apply priority offset to keep original order
            const mappedTagRules = report.rules.map((rule, idx) => {
              return {
                ...rule,
                priority: 10000 - idx
              };
            });
            consolidatedRules.push(...mappedTagRules);
            totalUnsupportedCount += report.unsupported.length;
            unsupportedDetails.push(...report.unsupported);
          }
        }

        // 2. Hardcoded override rules from effective destinations
        const hardcoded = makeHardcodedOverrideRules(effectiveRedirects);
        if (hardcoded.length > 0) {
          totalRawCount += hardcoded.length;
          consolidatedRules.push(...hardcoded);
          if (engineSource === "none") {
            engineSource = "intent_destinations";
            engineSourceId = legacyObject.slug || legacyObject.id || "campaign";
          }
        }

        // B. Page Decision Rules
        let pageRulesExist = false;
        if (Array.isArray(legacyObject.decision_rules) && legacyObject.decision_rules.length > 0) {
          pageRulesExist = true;
          totalRawCount += legacyObject.decision_rules.length;
          const report = normalizeRulesWithReport(legacyObject.decision_rules);
          const mappedPageRules = report.rules.map((rule, idx) => {
            return {
              ...rule,
              priority: (typeof rule.priority === "number" ? rule.priority : 0) + 5000 - idx
            };
          });
          consolidatedRules.push(...mappedPageRules);
          totalUnsupportedCount += report.unsupported.length;
          unsupportedDetails.push(...report.unsupported);
        }

        // C. Global Config Rules
        let globalRulesExist = false;
        if (globalConfig && Array.isArray(globalConfig.decision_rules) && globalConfig.decision_rules.length > 0) {
          globalRulesExist = true;
          totalRawCount += globalConfig.decision_rules.length;
          const report = normalizeRulesWithReport(globalConfig.decision_rules);
          const mappedGlobalRules = report.rules.map((rule, idx) => {
            return {
              ...rule,
              priority: (typeof rule.priority === "number" ? rule.priority : 0) + 1000 - idx
            };
          });
          consolidatedRules.push(...mappedGlobalRules);
          totalUnsupportedCount += report.unsupported.length;
          unsupportedDetails.push(...report.unsupported);
        }

        // Determine Primary Source
        if (checkRedirects && ( (Array.isArray(checkRedirects.rules) && checkRedirects.rules.length > 0) || checkRedirects.post || checkRedirects.converted || checkRedirects.hot )) {
          primarySource = engineSource;
          primarySourceId = engineSourceId;
        } else if (pageRulesExist) {
          primarySource = "page_config";
          primarySourceId = legacyObject.slug || legacyObject.id || "unknown";
        } else if (globalRulesExist) {
          primarySource = "global_config";
          primarySourceId = "global";
        }

        return {
          rules: consolidatedRules,
          source: primarySource,
          source_id: primarySourceId,
          schema: "v2",
          raw_count: totalRawCount,
          valid_count: totalRawCount - totalUnsupportedCount,
          invalid_count: totalUnsupportedCount,
          unsupported_details: unsupportedDetails
        };
      } catch (e) {
        console.error("[rule-repository] Error fetching rules:", e);
        return {
          rules: [],
          source: "error",
          source_id: null,
          schema: "none",
          raw_count: 0,
          valid_count: 0,
          invalid_count: 0
        };
      }
    }
  };
}
