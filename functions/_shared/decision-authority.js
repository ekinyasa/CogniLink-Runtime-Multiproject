const ALLOWED_ACTIONS = new Set(["render", "redirect"]);

function enabled(env) {
  return String(env?.DECISION_V2_CUTOVER_ENABLED) === "true";
}

function isFullAuthority(env) {
  return String(env?.DECISION_V2_FULL_AUTHORITY_ENABLED) === "true"
    || (enabled(env) && String(env?.DECISION_V2_CUTOVER_SLUG) === "*");
}

function scoped(env, input) {
  return enabled(env)
    && String(env?.DECISION_V2_CUTOVER_ROUTE_TYPE) === input.routeType
    && String(env?.DECISION_V2_CUTOVER_SLUG) === input.slug
    && String(env?.DECISION_V2_CUTOVER_SOURCE) === input.source;
}

export function selectDecisionAuthority(env, input = {}) {
  const legacy = {
    authority: "legacy",
    fallback_used: false,
    fallback_reason: "scope_outside"
  };

  const fullAuth = isFullAuthority(env);
  const scopedAuth = scoped(env, input);

  if (!fullAuth && !scopedAuth) return legacy;

  if (input.legacyError) {
    return { ...legacy, fallback_used: true, fallback_reason: "legacy_error" };
  }

  if (input.v2Error) {
    return { ...legacy, fallback_used: true, fallback_reason: "v2_error" };
  }

  const decision = input.decisionShadow || {};

  if (!ALLOWED_ACTIONS.has(decision.action)) {
    return { ...legacy, fallback_used: true, fallback_reason: "invalid_v2_action" };
  }

  if (decision.action === "redirect" && !decision.redirect_target) {
    return { ...legacy, fallback_used: true, fallback_reason: "invalid_v2_redirect" };
  }

  // In M3A scoped cutover mode, enforce strict rule matching and identical comparison
  if (!fullAuth && scopedAuth) {
    const expectedRuleId = String(env?.DECISION_V2_CUTOVER_RULE_ID || "");
    const ruleShadow = input.ruleShadow || {};

    if (
      !expectedRuleId
      || ruleShadow.raw_count !== 1
      || ruleShadow.valid_count !== 1
      || ruleShadow.invalid_count !== 0
      || decision.matched_rule_id !== expectedRuleId
    ) {
      return { ...legacy, fallback_used: true, fallback_reason: "rule_not_eligible" };
    }

    if (input.decisionComparison?.status !== "identical") {
      return { ...legacy, fallback_used: true, fallback_reason: "comparison_not_identical" };
    }
  }

  return {
    authority: "decision_v2",
    fallback_used: false,
    fallback_reason: null
  };
}

export function applyDecisionAuthority(legacyDecision, decisionShadow, authority) {
  if (authority?.authority !== "decision_v2" || !legacyDecision || !decisionShadow) {
    return legacyDecision;
  }

  if (decisionShadow.action === "render") {
    return {
      ...legacyDecision,
      action: "render",
      target: undefined,
      decisionId: decisionShadow.matched_rule_id || legacyDecision.decisionId
    };
  }

  if (decisionShadow.action === "redirect" && decisionShadow.redirect_target) {
    return {
      ...legacyDecision,
      action: "redirect",
      target: decisionShadow.redirect_target,
      decisionId: decisionShadow.matched_rule_id || legacyDecision.decisionId
    };
  }

  return legacyDecision;
}
