import assert from "node:assert/strict";
import { evaluateRules } from "../functions/lib/decision-engine.js";

async function runTests() {
  console.log("Starting Legacy Engine Canary Tests...\n");
  let passed = 0; let failed = 0;

  async function test(name, fn) {
    try { await fn(); console.log(`✅ PASS: ${name}`); passed++; }
    catch (e) { console.error(`❌ FAIL: ${name}`); console.error(e); failed++; }
  }

  await test("Legacy engine safely ignores unknown property 'pageContent.id'", async () => {
    const rules = [{
      id: "shadow_canary_trafik_yenileme",
      condition: { property: "pageContent.id", operator: "===", value: "trafik-yenileme" },
      action: "render"
    }];

    const userState = { v: 1, c: 0, e: 0, h: 0, u: 0 };
    const contextCtx = { source: "", medium: "", campaign: "trafik-yenileme" };

    // This should return null because evaluateCondition will return undefined === "trafik-yenileme" -> false
    const match = evaluateRules(userState, contextCtx, rules);
    assert.equal(match, null, "Legacy engine should return null (no match)");
  });

  console.log("\n── Test Summary ──");
  console.log(`Passed: ${passed}`); console.log(`Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}
runTests();
