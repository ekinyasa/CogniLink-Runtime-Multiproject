import assert from "node:assert/strict";
import { createRuleRepository } from "../functions/_shared/rule-repository.js";

async function runTests() {
  console.log("Starting Rule Repository Tests...\n");
  let passed = 0; let failed = 0;

  async function test(name, fn) {
    try { await fn(); console.log(`✅ PASS: ${name}`); passed++; }
    catch (e) { console.error(`❌ FAIL: ${name}`); console.error(e); failed++; }
  }

  const repo = createRuleRepository({ REAL_RULE_SHADOW_ENABLED: "true" });
  const repoDisabled = createRuleRepository({ REAL_RULE_SHADOW_ENABLED: "false" });

  await test("Returns shadow_decision_rules rules if present and schema is v2", async () => {
    const legacy = { id: "p1", shadow_decision_rules: [{ id: "shadow_1" }], decision_rules: [{ id: "r1" }] };
    const res = await repo.fetchRules({}, legacy, {});
    assert.equal(res.source, "shadow_page_config");
    assert.equal(res.schema, "v2");
    assert.equal(res.rules.length, 1);
    assert.equal(res.rules[0].id, "shadow_1");
  });

  await test("Returns page_config rules if present in legacyObject (no shadow rules)", async () => {
    const legacy = { id: "p1", decision_rules: [{ id: "r1", action: "render" }] };
    const res = await repo.fetchRules({}, legacy, {});
    assert.equal(res.source, "page_config");
    assert.equal(res.schema, "v2");
    assert.equal(res.rules.length, 1);
  });

  await test("Returns engine_config_map rules if engineMapId matches", async () => {
    const legacy = { id: "p1", engineMapId: "m1" };
    const engineConfig = { customMaps: { "m1": { rules: [{ id: "tag1", action: "render" }] } } };
    const res = await repo.fetchRules({}, legacy, { engineConfig });
    assert.equal(res.source, "engine_config_map");
    assert.equal(res.schema, "v2");
  });

  await test("Returns empty array and 'none' source if no rules found", async () => {
    const res = await repo.fetchRules({}, {}, {});
    assert.equal(res.source, "none");
    assert.equal(res.rules.length, 0);
  });

  await test("Returns none if REAL_RULE_SHADOW_ENABLED is false", async () => {
    const legacy = { id: "p1", decision_rules: [{ id: "r1", action: "render" }] };
    const res = await repoDisabled.fetchRules({}, legacy, {});
    assert.equal(res.source, "none");
    assert.equal(res.rules.length, 0);
  });

  await test("Exceptions are caught and safe fallback returned", async () => {
    // Force exception
    const fakeLegacy = { get engineMapId() { throw new Error("BOOM"); } };
    const res = await repo.fetchRules({}, fakeLegacy, { engineConfig: {} });
    assert.equal(res.source, "error");
    assert.equal(res.rules.length, 0);
  });

  console.log("\n── Test Summary ──");
  console.log(`Passed: ${passed}`); console.log(`Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}
runTests();
