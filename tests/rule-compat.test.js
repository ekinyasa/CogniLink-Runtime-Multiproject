import assert from "node:assert/strict";
import { normalizeRules } from "../functions/_shared/rule-compat.js";

async function runTests() {
  console.log("Starting Rule Compat Tests...\n");
  let passed = 0; let failed = 0;

  async function test(name, fn) {
    try { await fn(); console.log(`✅ PASS: ${name}`); passed++; }
    catch (e) { console.error(`❌ FAIL: ${name}`); console.error(e); failed++; }
  }

  await test("Valid legacy rule maps to V2 format correctly", async () => {
    const raw = [{
      id: "rule1", priority: 10,
      condition: { property: "user_visited", operator: "===", value: true },
      action: "redirect", target: "https://example.com"
    }];
    const res = normalizeRules(raw);
    assert.equal(res.length, 1);
    assert.equal(res[0].id, "rule1");
    assert.equal(res[0].priority, 10);
    assert.deepEqual(res[0].condition, { field: "userState.v", operator: "equals", value: 1 });
    assert.deepEqual(res[0].action, { type: "redirect", target: "https://example.com" });
  });

  await test("Invalid action type is dropped", async () => {
    const raw = [{ id: "rule1", action: "unknown" }];
    const res = normalizeRules(raw);
    assert.equal(res.length, 0);
  });

  await test("Tag-based engine rule is mapped to and condition", async () => {
    const raw = [{ id: "tag_rule", hasTags: ["t1", "t2"], url: "https://test.com" }];
    const res = normalizeRules(raw);
    assert.equal(res.length, 1);
    assert.equal(res[0].id, "engine_tag_tag_rule");
    assert.deepEqual(res[0].condition, {
      and: [
        { field: "userState.t", operator: "contains", value: "t1" },
        { field: "userState.t", operator: "contains", value: "t2" }
      ]
    });
    assert.deepEqual(res[0].action, { type: "redirect", target: "https://test.com" });
  });

  await test("Tag-based engine rule with notTags is skipped (unsupported by V2)", async () => {
    const raw = [{ id: "tag_rule", hasTags: ["t1"], notTags: ["t2"], url: "https://test.com" }];
    const res = normalizeRules(raw);
    assert.equal(res.length, 0);
  });

  await test("Rule without ID is dropped", async () => {
    const raw = [{ condition: {}, action: "render" }];
    const res = normalizeRules(raw);
    assert.equal(res.length, 0);
  });

  await test("Input is not mutated", async () => {
    const raw = [{ id: "r1", action: "render", condition: { property: "source", operator: "===", value: "fb" } }];
    const rawStr = JSON.stringify(raw);
    normalizeRules(raw);
    assert.equal(JSON.stringify(raw), rawStr);
  });

  console.log("\n── Test Summary ──");
  console.log(`Passed: ${passed}`); console.log(`Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}
runTests();
