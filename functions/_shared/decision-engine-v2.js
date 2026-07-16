/**
 * functions/_shared/decision-engine-v2.js
 * 
 * CogniLink Next-Generation Decision Engine
 * Pure, deterministic, dependency-free rule evaluation.
 */

const DEFAULT_DECISION = {
  decision_id: "default",
  matched_rule_id: "default",
  action: "render",
  render_mode: "canonical",
  redirect_target: null,
  render_overrides: {},
  state_mutations: { tags_to_add: [], tags_to_remove: [] },
  telemetry_flags: { is_conversion: false, experiment_exposure: false },
  metadata: {}
};

// Dependency-free deep clone to prevent reference leaks
function deepClone(obj) {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(deepClone);
  const cloned = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
}

// Safe path resolver (e.g. "context.utm_medium" -> value)
function resolvePath(obj, path) {
  if (!path || typeof path !== 'string') return undefined;
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

const OPERATORS = {
  equals: (actual, expected) => actual === expected,
  not_equals: (actual, expected) => actual !== expected,
  exists: (actual) => actual !== undefined && actual !== null,
  not_exists: (actual) => actual === undefined || actual === null,
  contains: (actual, expected) => Array.isArray(actual) && actual.includes(expected),
  in: (actual, expected) => Array.isArray(expected) && expected.includes(actual),
  greater_than: (actual, expected) => typeof actual === 'number' && typeof expected === 'number' && actual > expected,
  greater_than_or_equal: (actual, expected) => typeof actual === 'number' && typeof expected === 'number' && actual >= expected,
  less_than: (actual, expected) => typeof actual === 'number' && typeof expected === 'number' && actual < expected,
  less_than_or_equal: (actual, expected) => typeof actual === 'number' && typeof expected === 'number' && actual <= expected,
};

function evaluateCondition(condition, context) {
  if (!condition) return false;
  if (condition === "always") return true;

  if (Array.isArray(condition.and)) {
    return condition.and.every(c => evaluateCondition(c, context));
  }
  if (Array.isArray(condition.or)) {
    return condition.or.some(c => evaluateCondition(c, context));
  }

  const { field, operator, value } = condition;
  if (!field || !operator) return false;

  const fn = OPERATORS[operator];
  if (!fn) return false; // Unknown operator fails safely

  const actualValue = resolvePath(context, field);
  return fn(actualValue, value);
}

/**
 * Evaluates context against rules to produce an immutable Decision.
 */
export function evaluateDecision(runtimeContext, rules, options = {}) {
  const ctx = runtimeContext || {};
  const safeRules = Array.isArray(rules) ? rules : [];

  // Filter disabled rules
  const validRules = safeRules.filter(r => {
    if (r === null || typeof r !== 'object') return false;
    if (r.enabled === false) return false;
    return true;
  });

  // Sort by priority DESC, then id ASC (deterministic tie-break)
  validRules.sort((a, b) => {
    const pA = typeof a.priority === 'number' ? a.priority : 0;
    const pB = typeof b.priority === 'number' ? b.priority : 0;
    if (pA !== pB) return pB - pA;
    const idA = a.id || "";
    const idB = b.id || "";
    return idA.localeCompare(idB);
  });

  let matchedRule = null;
  for (const rule of validRules) {
    try {
      if (evaluateCondition(rule.condition, ctx)) {
        matchedRule = rule;
        break; // First Match Wins
      }
    } catch (e) {
      // Swallow evaluation errors safely
    }
  }

  const decision = deepClone(DEFAULT_DECISION);
  decision.render_mode = ctx.render_mode || "canonical";

  if (matchedRule) {
    const ruleId = matchedRule.id || "unknown_rule";
    const pageId = resolvePath(ctx, "pageContent.id") || "no_page";
    decision.decision_id = `dec_${ruleId}_${pageId}`;
    decision.matched_rule_id = ruleId;

    const action = matchedRule.action || {};
    const type = action.type;

    if (type === "redirect") {
      decision.action = "redirect";
      decision.redirect_target = action.target || null;
    } else if (type === "render") {
      decision.action = "render";
      decision.render_overrides = deepClone(action.overrides || {});
    } else if (type === "block") {
      decision.action = "block";
    } else {
      // Unknown or missing action defaults safely to render
      decision.action = "render";
    }

    if (action.state_mutations) {
      decision.state_mutations = deepClone(action.state_mutations);
    }
    if (action.telemetry_flags) {
      Object.assign(decision.telemetry_flags, action.telemetry_flags);
    }
  }

  return decision;
}
