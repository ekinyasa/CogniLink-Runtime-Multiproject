import assert from "node:assert/strict";
import { compareDecisions } from "../functions/_shared/decision-comparator.js";
import { normalizeRulesWithReport } from "../functions/_shared/rule-compat.js";
import { createRuleRepository } from "../functions/_shared/rule-repository.js";
import { timingSafeEqual as nodeTimingSafeEqual } from "node:crypto";

// Polyfill crypto.subtle.timingSafeEqual for Node.js (CF Workers API)
if (!globalThis.crypto?.subtle?.timingSafeEqual) {
  if (!globalThis.crypto) globalThis.crypto = {};
  if (!globalThis.crypto.subtle) globalThis.crypto.subtle = {};
  globalThis.crypto.subtle.timingSafeEqual = function(a, b) {
    if (a.byteLength !== b.byteLength) return false;
    return nodeTimingSafeEqual(Buffer.from(a), Buffer.from(b));
  };
}

async function runTests() {
  console.log("Starting Real-Rule Shadow Soak & Decision Comparator Tests...\n");
  let passed = 0; let failed = 0;

  async function test(name, fn) {
    try { await fn(); console.log(`✅ PASS: ${name}`); passed++; }
    catch (e) { console.error(`❌ FAIL: ${name}`); console.error(e); failed++; }
  }

  // ════════════════════════════════════════════════════════════════════════
  // 1. FEATURE FLAG & SOURCE RESOLUTION TESTS
  // ════════════════════════════════════════════════════════════════════════

  await test("1. real rule shadow flag false → conversion/evaluation yok", async () => {
    const env = { REAL_RULE_SHADOW_ENABLED: "false" };
    const repo = createRuleRepository(env);
    const legacyObject = {
      decision_rules: [{ id: "rule1", condition: null, action: "render" }]
    };
    const res = await repo.fetchRules({}, legacyObject, {});
    assert.equal(res.source, "none");
    assert.equal(res.rules.length, 0);
  });

  await test("2. flag true → legacy source okunur", async () => {
    const env = { REAL_RULE_SHADOW_ENABLED: "true" };
    const repo = createRuleRepository(env);
    const legacyObject = {
      decision_rules: [{ id: "rule1", condition: null, action: "render" }]
    };
    const res = await repo.fetchRules({}, legacyObject, {});
    assert.equal(res.source, "page_config");
    assert.equal(res.rules.length, 1);
  });

  // ════════════════════════════════════════════════════════════════════════
  // 2. V2 RULE COMPATIBILITY & ADAPTER TESTS
  // ════════════════════════════════════════════════════════════════════════

  await test("3. stable rule id conversion", async () => {
    const raw = [{ id: "stable_id", action: "render" }];
    const report = normalizeRulesWithReport(raw);
    assert.equal(report.rules.length, 1);
    assert.equal(report.rules[0].id, "stable_id");
  });

  await test("4. priority korunur", async () => {
    const raw = [{ id: "r1", priority: 123, action: "render" }];
    const report = normalizeRulesWithReport(raw);
    assert.equal(report.rules[0].priority, 123);
  });

  await test("5. route scope / property mapping korunur", async () => {
    const raw = [{
      id: "r1",
      condition: { property: "source", operator: "===", value: "instagram" },
      action: "render"
    }];
    const report = normalizeRulesWithReport(raw);
    assert.deepEqual(report.rules[0].condition, {
      field: "metadata.source",
      operator: "equals",
      value: "instagram"
    });
  });

  await test("6. campaign scope korunur", async () => {
    const raw = [{
      id: "r1",
      condition: { property: "campaign", operator: "includes", value: "spring" },
      action: "render"
    }];
    const report = normalizeRulesWithReport(raw);
    assert.deepEqual(report.rules[0].condition, {
      field: "metadata.campaign",
      operator: "contains",
      value: "spring"
    });
  });

  await test("7. threshold semantics korunur", async () => {
    const raw = [{
      id: "r1",
      condition: { property: "user_engaged", operator: "===", value: true },
      action: "render"
    }];
    const report = normalizeRulesWithReport(raw);
    assert.deepEqual(report.rules[0].condition, {
      field: "userState.e",
      operator: "greater_than_or_equal",
      value: 50
    });
  });

  await test("8. unsupported rule açıkça işaretlenir (notTags)", async () => {
    const raw = [{
      id: "unsupported_tags",
      url: "https://url.com",
      hasTags: ["t1"],
      notTags: ["t2"] // notTags is unsupported in V2 since no not_contains operator exists
    }];
    const report = normalizeRulesWithReport(raw);
    assert.equal(report.rules.length, 0);
    assert.equal(report.unsupported.length, 1);
    assert.equal(report.unsupported[0].id, "unsupported_tags");
    assert.equal(report.unsupported[0].reason, "notTags_unsupported");
  });

  await test("9. unsupported rule yanlış uygulanmaz (unknown action)", async () => {
    const raw = [{ id: "bad_action", action: "do_something_crazy" }];
    const report = normalizeRulesWithReport(raw);
    assert.equal(report.rules.length, 0);
    assert.equal(report.unsupported.length, 1);
    assert.equal(report.unsupported[0].reason, "unknown_action");
  });

  // ════════════════════════════════════════════════════════════════════════
  // 3. COMPARATOR TESTS
  // ════════════════════════════════════════════════════════════════════════

  await test("10. identical legacy/V2 decision", async () => {
    const legacy = { action: "redirect", target: "https://url.com", decisionId: "r1" };
    const v2 = { action: "redirect", redirect_target: "https://url.com", matched_rule_id: "r1" };
    const comparison = compareDecisions(legacy, v2, { hasRules: true });
    assert.equal(comparison.status, "identical");
    assert.equal(comparison.comparable, true);
  });

  await test("11. semantic mismatch", async () => {
    const legacy = { action: "redirect", target: "https://url.com", decisionId: "r1" };
    const v2 = { action: "render", redirect_target: null, matched_rule_id: "r1" };
    const comparison = compareDecisions(legacy, v2, { hasRules: true });
    assert.equal(comparison.status, "semantic_mismatch");
    assert.equal(comparison.comparable, true);
    assert.deepEqual(comparison.mismatch_fields, ["action_type", "target"]);
  });

  await test("12. not comparable mismatch sayılmaz", async () => {
    const legacy = { action: "render", decisionId: null };
    const v2 = { action: "render", matched_rule_id: null };
    const comparison = compareDecisions(legacy, v2, { hasRules: false });
    assert.equal(comparison.status, "not_comparable");
    assert.equal(comparison.comparable, false);
  });

  await test("13. same action different rule id mismatch sayılmaz (identical)", async () => {
    const legacy = { action: "redirect", target: "https://url.com", decisionId: "legacy_rule" };
    const v2 = { action: "redirect", redirect_target: "https://url.com", matched_rule_id: "v2_rule" };
    const comparison = compareDecisions(legacy, v2, { hasRules: true });
    assert.equal(comparison.status, "identical"); // Action and target match, so they are semantically identical
    assert.equal(comparison.comparable, true);
  });

  await test("14. legacy error", async () => {
    const v2 = { action: "render", matched_rule_id: null };
    const comparison = compareDecisions(null, v2, { legacyError: true, hasRules: true });
    assert.equal(comparison.status, "legacy_error");
    assert.equal(comparison.comparable, false);
  });

  await test("15. V2 error", async () => {
    const legacy = { action: "render", decisionId: null };
    const comparison = compareDecisions(legacy, null, { v2Error: true, hasRules: true });
    assert.equal(comparison.status, "v2_error");
    assert.equal(comparison.comparable, false);
  });

  console.log("\n── Test Summary ──");
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}`);
  if (failed > 0) process.exit(1);
}

runTests();
