/**
 * functions/_shared/rule-compat.js
 * 
 * Pure compatibility mapper for translating Legacy Decision Rules 
 * into the Hybrid JSON Pipeline format expected by Decision Engine V2.
 */

const PROPERTY_MAP = {
  "user_visited": "userState.v",
  "user_converted": "userState.c",
  "user_hot": "userState.h",
  "entered_upsell": "userState.u",
  "engagement": "userState.e",
  "user_engaged": "userState.e", // Note: legacy was e >= 50 implicitly, but we'll map the field directly
  "source": "metadata.source",
  "medium": "metadata.medium",
  "campaign": "metadata.campaign",
};

const OPERATOR_MAP = {
  "===": "equals",
  "!==": "not_equals",
  ">": "greater_than",
  "<": "less_than",
  "includes": "contains",
};

export function normalizeRules(rawRules, context = {}) {
  if (!Array.isArray(rawRules)) return [];

  const validRules = [];

  for (const legacy of rawRules) {
    if (!legacy || typeof legacy !== "object") continue;
    if (!legacy.id || typeof legacy.id !== "string") continue; // drop rules without ID

    // We don't drop disabled rules if the legacy rule has it, we pass it along.
    const enabled = legacy.enabled !== false;

    // Validate priority
    let priority = 0;
    if (typeof legacy.priority === "number") {
      priority = legacy.priority;
    }

    // Handle Legacy Engine Tag-based rules
    if (legacy.url && (Array.isArray(legacy.hasTags) || Array.isArray(legacy.notTags))) {
      const andConditions = [];
      if (Array.isArray(legacy.hasTags)) {
        for (const tag of legacy.hasTags) {
          andConditions.push({ field: "userState.t", operator: "contains", value: tag });
        }
      }
      // V2 currently lacks "not_contains". Since we are strictly forbidden 
      // from inventing new operators, we must skip mapping for notTags.
      // "mapping yapılamıyorsa rule atlanmalı"
      if (Array.isArray(legacy.notTags) && legacy.notTags.length > 0) {
         continue; // skip
      }

      const actionType = "redirect";
      const action = { type: actionType, target: legacy.url };
      
      validRules.push({
        id: `engine_tag_${legacy.id || 'rule'}`,
        priority,
        enabled,
        condition: andConditions.length > 1 ? { and: andConditions } : (andConditions[0] || "always"),
        action
      });
      continue;
    }

    // Action mapping
    const actionType = legacy.action === "redirect" ? "redirect" : 
                       legacy.action === "render" ? "render" : 
                       legacy.action === "block" ? "block" : null;
    
    if (!actionType) continue; // Invalid action type

    const action = { type: actionType };
    if (actionType === "redirect") {
      if (typeof legacy.target !== "string" || !legacy.target) continue;
      action.target = legacy.target;
    }

    // Condition mapping
    let condition = "always";
    if (legacy.condition && typeof legacy.condition === "object") {
      const { property, operator, value } = legacy.condition;
      
      const v2Field = PROPERTY_MAP[property] || property;
      let v2Operator = OPERATOR_MAP[operator] || operator;
      let v2Value = value;

      // Legacy user_visited was boolean value=true, V2 userState.v is 1
      if (property === "user_visited" || property === "user_converted" || property === "user_hot" || property === "entered_upsell") {
        if (value === true) v2Value = 1;
        if (value === false) v2Value = 0;
      }
      
      // Legacy user_engaged had an implicit value check in getPropertyValue
      if (property === "user_engaged") {
        v2Operator = "greater_than_or_equal";
        v2Value = 50;
      }

      if (v2Field && v2Operator) {
        condition = {
          field: String(v2Field),
          operator: String(v2Operator),
          value: v2Value
        };
      } else {
        continue; // Unmappable condition
      }
    }

    validRules.push({
      id: legacy.id,
      priority,
      enabled,
      condition,
      action
    });
  }

  return validRules;
}

/**
 * Extended normalizer that also returns unsupported rule report.
 * Used by Real-Rule Shadow Soak to track conversion coverage.
 * 
 * @returns {{ rules: object[], unsupported: object[] }}
 */
export function normalizeRulesWithReport(rawRules, context = {}) {
  if (!Array.isArray(rawRules)) return { rules: [], unsupported: [] };

  const validRules = [];
  const unsupported = [];

  for (const legacy of rawRules) {
    if (!legacy || typeof legacy !== "object") {
      unsupported.push({ id: "unknown", reason: "invalid_shape" });
      continue;
    }
    if (!legacy.id || typeof legacy.id !== "string") {
      unsupported.push({ id: "missing_id", reason: "no_id" });
      continue;
    }

    const enabled = legacy.enabled !== false;
    let priority = 0;
    if (typeof legacy.priority === "number") priority = legacy.priority;

    // Tag-based rules
    if (legacy.url && (Array.isArray(legacy.hasTags) || Array.isArray(legacy.notTags))) {
      if (Array.isArray(legacy.notTags) && legacy.notTags.length > 0) {
        unsupported.push({ id: legacy.id, reason: "notTags_unsupported" });
        continue;
      }

      const andConditions = [];
      if (Array.isArray(legacy.hasTags)) {
        for (const tag of legacy.hasTags) {
          andConditions.push({ field: "userState.t", operator: "contains", value: tag });
        }
      }

      validRules.push({
        id: `engine_tag_${legacy.id || 'rule'}`,
        priority,
        enabled,
        condition: andConditions.length > 1 ? { and: andConditions } : (andConditions[0] || "always"),
        action: { type: "redirect", target: legacy.url }
      });
      continue;
    }

    // Action mapping
    const actionType = legacy.action === "redirect" ? "redirect" : 
                       legacy.action === "render" ? "render" : 
                       legacy.action === "block" ? "block" : null;
    
    if (!actionType) {
      unsupported.push({ id: legacy.id, reason: "unknown_action", action: legacy.action });
      continue;
    }

    const action = { type: actionType };
    if (actionType === "redirect") {
      if (typeof legacy.target !== "string" || !legacy.target) {
        unsupported.push({ id: legacy.id, reason: "missing_redirect_target" });
        continue;
      }
      action.target = legacy.target;
    }

    // Condition mapping
    let condition = "always";
    if (legacy.condition && typeof legacy.condition === "object") {
      const { property, operator, value } = legacy.condition;
      
      const v2Field = PROPERTY_MAP[property] || null;
      if (!v2Field) {
        unsupported.push({ id: legacy.id, reason: "unknown_property", property });
        continue;
      }
      
      let v2Operator = OPERATOR_MAP[operator] || null;
      if (!v2Operator) {
        unsupported.push({ id: legacy.id, reason: "unknown_operator", operator });
        continue;
      }
      
      let v2Value = value;

      if (property === "user_visited" || property === "user_converted" || property === "user_hot" || property === "entered_upsell") {
        if (value === true) v2Value = 1;
        if (value === false) v2Value = 0;
      }
      
      if (property === "user_engaged") {
        v2Operator = "greater_than_or_equal";
        v2Value = 50;
      }

      condition = {
        field: String(v2Field),
        operator: String(v2Operator),
        value: v2Value
      };
    }

    validRules.push({
      id: legacy.id,
      priority,
      enabled,
      condition,
      action
    });
  }

  return { rules: validRules, unsupported };
}
