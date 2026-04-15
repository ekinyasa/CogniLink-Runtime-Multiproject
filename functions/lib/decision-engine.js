/**
 * functions/lib/decision-engine.js — Intent-based routing logic (v1).
 *
 * Evaluates a sequence of rules against user behavior and inbound context
 * to decide the optimal flow: instant redirect vs. rendering the decision layer.
 *
 * Rule Structure:
 *   {
 *     "id": "returning_story_buyer",
 *     "condition": { "property": "user_visited", "operator": "===", "value": true },
 *     "action": "redirect",
 *     "target": "https://target-url.com/landing"
 *   }
 */

/**
 * Evaluate decision rules for a visitor.
 *
 * @param {object} userState - from parseUserState
 * @param {object} context   - { source, medium, campaign }
 * @param {Array}  rules     - list of rules from LANDING_CONFIG["decision_rules"]
 *
 * @returns {object|null}    - the matching rule object, or null for default hub
 */
export function evaluateRules(userState, context, rules) {
  if (!Array.isArray(rules) || rules.length === 0) return null;

  for (const rule of rules) {
    if (evaluateCondition(rule.condition, userState, context)) {
      return rule;
    }
  }

  return null;
}

/**
 * Simple property-based condition evaluator.
 * Supports basic operators: ===, !==, >, <, includes.
 */
function evaluateCondition(condition, user, ctx) {
  // No condition means "always match" (used for default catch-all rules)
  if (!condition) return true;

  try {
    const { property, operator, value } = condition;
    if (!property || !operator) return false;

    const actual = getPropertyValue(property, user, ctx);

    switch (operator) {
      case "===": return actual === value;
      case "!==": return actual !== value;
      case ">": return Number(actual) > Number(value);
      case "<": return Number(actual) < Number(value);
      case "includes": return Array.isArray(value) ? value.includes(actual) : String(actual).includes(String(value));
      default: return false;
    }
  } catch (_) {
    return false;
  }
}

/**
 * Map rule property names to actual state/context values.
 */
function getPropertyValue(prop, user, ctx) {
  const map = {
    "user_visited": user.v === 1,
    "user_converted": user.c === 1,
    "user_engaged": user.e >= 50, // threshold for "engaged"
    "user_hot": user.h === 1,
    "entered_upsell": user.u === 1,
    "source": ctx.source || "",
    "medium": ctx.medium || "",
    "campaign": ctx.campaign || "",
    "engagement": user.e || 0,
  };
  return map[prop];
}
