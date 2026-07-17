import assert from "node:assert/strict";
import { applyDecisionAuthority, selectDecisionAuthority } from "../functions/_shared/decision-authority.js";

const scope = {
  DECISION_V2_CUTOVER_ENABLED: "true",
  DECISION_V2_CUTOVER_ROUTE_TYPE: "c",
  DECISION_V2_CUTOVER_SLUG: "test-1783922084893-igbio",
  DECISION_V2_CUTOVER_SOURCE: "m2-shadow-probe",
  DECISION_V2_CUTOVER_RULE_ID: "m2-shadow-source-render"
};

const eligible = {
  routeType: "c",
  slug: "test-1783922084893-igbio",
  source: "m2-shadow-probe",
  ruleShadow: { raw_count: 1, valid_count: 1, invalid_count: 0 },
  decisionShadow: { action: "render", matched_rule_id: "m2-shadow-source-render" },
  decisionComparison: { status: "identical" },
  legacyError: false,
  v2Error: false
};

const tests = [
  ["selects V2 only for the approved scope", () => {
    const authority = selectDecisionAuthority(scope, eligible);
    assert.equal(authority.authority, "decision_v2");
    assert.equal(authority.fallback_used, false);
  }],
  ["keeps legacy outside the approved source", () => {
    const authority = selectDecisionAuthority(scope, { ...eligible, source: "outside" });
    assert.equal(authority.authority, "legacy");
    assert.equal(authority.fallback_used, false);
  }],
  ["falls back when comparison is not identical", () => {
    const authority = selectDecisionAuthority(scope, { ...eligible, decisionComparison: { status: "semantic_mismatch" } });
    assert.equal(authority.authority, "legacy");
    assert.equal(authority.fallback_used, true);
  }],
  ["falls back on V2 errors and unsupported coverage", () => {
    const v2Error = selectDecisionAuthority(scope, { ...eligible, v2Error: true });
    const unsupported = selectDecisionAuthority(scope, { ...eligible, ruleShadow: { raw_count: 1, valid_count: 0, invalid_count: 1 } });
    assert.equal(v2Error.fallback_used, true);
    assert.equal(unsupported.fallback_used, true);
  }],
  ["uses the V2 action while preserving legacy state and cookies", () => {
    const legacy = { action: "redirect", target: "https://legacy.example", decisionId: "legacy", cookies: ["state"], userState: { uid: "u" } };
    const decision = applyDecisionAuthority(legacy, { action: "render", matched_rule_id: "m2-shadow-source-render" }, { authority: "decision_v2" });
    assert.equal(decision.action, "render");
    assert.equal(decision.decisionId, "m2-shadow-source-render");
    assert.deepEqual(decision.cookies, legacy.cookies);
    assert.deepEqual(decision.userState, legacy.userState);
  }]
];

let failures = 0;
for (const [name, run] of tests) {
  try {
    run();
    console.log(`PASS: ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL: ${name}`);
    console.error(error);
  }
}

if (failures > 0) process.exit(1);
