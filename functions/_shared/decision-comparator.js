/**
 * functions/_shared/decision-comparator.js
 * 
 * Compares legacy handleDecision output with V2 evaluateDecision output
 * to produce a canonical comparison result for shadow soak validation.
 * 
 * Pure function. No side effects. No mutations.
 */

/**
 * Comparison status values:
 * - identical:        both decisions produce the same canonical action
 * - semantic_mismatch: decisions differ in action, target, or render mode
 * - not_comparable:   legacy or V2 context is missing/incomplete
 * - legacy_error:     legacy decision failed
 * - v2_error:         V2 decision failed
 */

/**
 * Extracts a canonical decision view from legacy handleDecision result.
 * 
 * @param {object|null} legacyDecision - result of handleDecision()
 * @returns {object} canonical view
 */
export function extractLegacyView(legacyDecision) {
  if (!legacyDecision) {
    return { action_type: null, target: null, matched_rule_id: null, fallback_used: true };
  }
  return {
    action_type: legacyDecision.action || "render",
    target: legacyDecision.target || null,
    matched_rule_id: legacyDecision.decisionId || null,
    fallback_used: !legacyDecision.decisionId
  };
}

/**
 * Extracts a canonical decision view from V2 evaluateDecision result.
 * 
 * @param {object|null} v2Decision - result of evaluateDecision()
 * @returns {object} canonical view
 */
export function extractV2View(v2Decision) {
  if (!v2Decision) {
    return { action_type: null, target: null, matched_rule_id: null, fallback_used: true };
  }
  return {
    action_type: v2Decision.action || "render",
    target: v2Decision.redirect_target || null,
    matched_rule_id: v2Decision.matched_rule_id || null,
    fallback_used: !v2Decision.matched_rule_id
  };
}

/**
 * Compare legacy and V2 decision outputs.
 * 
 * @param {object|null} legacyDecision - result of handleDecision()
 * @param {object|null} v2Decision     - result of evaluateDecision()
 * @param {object}      options
 * @param {boolean}     options.legacyError - true if legacy threw
 * @param {boolean}     options.v2Error     - true if V2 threw
 * @param {boolean}     options.hasRules    - true if V2 had real rules to evaluate
 * @returns {object} comparison result
 */
export function compareDecisions(legacyDecision, v2Decision, options = {}) {
  const { legacyError = false, v2Error = false, hasRules = false } = options;

  // Error states
  if (legacyError) {
    return {
      status: "legacy_error",
      comparable: false,
      legacy: extractLegacyView(null),
      v2: extractV2View(v2Decision),
      mismatch_fields: []
    };
  }
  if (v2Error) {
    return {
      status: "v2_error",
      comparable: false,
      legacy: extractLegacyView(legacyDecision),
      v2: extractV2View(null),
      mismatch_fields: []
    };
  }

  const legacyView = extractLegacyView(legacyDecision);
  const v2View = extractV2View(v2Decision);

  // Not comparable: V2 had no real rules (source was "none" or empty)
  // In this case legacy may have engine_config hardcoded rules or page rules,
  // but V2 had nothing to evaluate. This is expected during early soak.
  if (!hasRules) {
    return {
      status: "not_comparable",
      comparable: false,
      legacy: legacyView,
      v2: v2View,
      mismatch_fields: []
    };
  }

  // Both have fallback (no rules matched) → identical
  if (legacyView.fallback_used && v2View.fallback_used) {
    return {
      status: "identical",
      comparable: true,
      legacy: legacyView,
      v2: v2View,
      mismatch_fields: []
    };
  }

  // Compare canonical fields
  const mismatchFields = [];

  if (legacyView.action_type !== v2View.action_type) {
    mismatchFields.push("action_type");
  }

  // Target comparison: normalize nulls
  const legacyTarget = legacyView.target || null;
  const v2Target = v2View.target || null;
  if (legacyTarget !== v2Target) {
    mismatchFields.push("target");
  }

  // Fallback mismatch (one matched, other didn't)
  if (legacyView.fallback_used !== v2View.fallback_used) {
    mismatchFields.push("fallback_used");
  }

  const status = mismatchFields.length === 0 ? "identical" : "semantic_mismatch";

  return {
    status,
    comparable: true,
    legacy: legacyView,
    v2: v2View,
    mismatch_fields: mismatchFields
  };
}
