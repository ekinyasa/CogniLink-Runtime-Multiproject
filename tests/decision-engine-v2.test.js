import assert from "node:assert/strict";
import { evaluateDecision } from "../functions/_shared/decision-engine-v2.js";

async function runTests() {
  console.log("Starting Decision Engine V2 Tests...\n");

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (e) {
      console.error(`❌ FAIL: ${name}`);
      console.error(e);
      failed++;
    }
  }

  const baseCtx = {
    pageContent: { id: "page_1" },
    render_mode: "canonical",
    metadata: { source_schema: "v2" },
    state: { tags: ["vip", "returning"], score: 10 },
    context: { utm_source: "fb", device: "mobile" }
  };

  test("1. Rules boşsa fallback Decision", () => {
    const dec = evaluateDecision(baseCtx, []);
    assert.equal(dec.matched_rule_id, "default");
    assert.equal(dec.action, "render");
    assert.equal(dec.decision_id, "default");
  });

  test("2. Disabled rule atlanıyor", () => {
    const rules = [
      { id: "r1", enabled: false, condition: "always", action: { type: "redirect", target: "/x" } }
    ];
    const dec = evaluateDecision(baseCtx, rules);
    assert.equal(dec.action, "render"); // Fallback
  });

  test("3. En yüksek priority eşleşiyor", () => {
    const rules = [
      { id: "r1", priority: 10, condition: "always", action: { type: "redirect", target: "/low" } },
      { id: "r2", priority: 100, condition: "always", action: { type: "redirect", target: "/high" } }
    ];
    const dec = evaluateDecision(baseCtx, rules);
    assert.equal(dec.matched_rule_id, "r2");
    assert.equal(dec.redirect_target, "/high");
  });

  test("4. Eşit priority deterministic tie-break", () => {
    const rules = [
      { id: "b", priority: 10, condition: "always", action: { type: "redirect" } },
      { id: "a", priority: 10, condition: "always", action: { type: "render" } }
    ];
    const dec = evaluateDecision(baseCtx, rules);
    assert.equal(dec.matched_rule_id, "a"); // a comes before b alphabetically
  });

  test("5. First Match Wins", () => {
    const rules = [
      { id: "r1", priority: 100, condition: "always", action: { type: "redirect" } },
      { id: "r2", priority: 100, condition: "always", action: { type: "render" } }
    ];
    const dec = evaluateDecision(baseCtx, rules);
    assert.equal(dec.matched_rule_id, "r1"); 
  });

  test("6. equals", () => {
    const rules = [{ id: "r1", condition: { field: "context.utm_source", operator: "equals", value: "fb" }, action: { type: "redirect" } }];
    const dec = evaluateDecision(baseCtx, rules);
    assert.equal(dec.matched_rule_id, "r1");
  });

  test("7. not_equals", () => {
    const rules = [{ id: "r1", condition: { field: "context.utm_source", operator: "not_equals", value: "gg" }, action: { type: "redirect" } }];
    const dec = evaluateDecision(baseCtx, rules);
    assert.equal(dec.matched_rule_id, "r1");
  });

  test("8. exists / not_exists", () => {
    const rules1 = [{ id: "r1", condition: { field: "context.utm_source", operator: "exists" }, action: { type: "redirect" } }];
    const dec1 = evaluateDecision(baseCtx, rules1);
    assert.equal(dec1.matched_rule_id, "r1");

    const rules2 = [{ id: "r2", condition: { field: "context.unknown", operator: "not_exists" }, action: { type: "redirect" } }];
    const dec2 = evaluateDecision(baseCtx, rules2);
    assert.equal(dec2.matched_rule_id, "r2");
  });

  test("9. contains", () => {
    const rules = [{ id: "r1", condition: { field: "state.tags", operator: "contains", value: "vip" }, action: { type: "redirect" } }];
    const dec = evaluateDecision(baseCtx, rules);
    assert.equal(dec.matched_rule_id, "r1");
  });

  test("10. in", () => {
    const rules = [{ id: "r1", condition: { field: "context.device", operator: "in", value: ["mobile", "tablet"] }, action: { type: "redirect" } }];
    const dec = evaluateDecision(baseCtx, rules);
    assert.equal(dec.matched_rule_id, "r1");
  });

  test("11. numeric comparison", () => {
    const rules = [{ id: "r1", condition: { field: "state.score", operator: "greater_than_or_equal", value: 10 }, action: { type: "redirect" } }];
    assert.equal(evaluateDecision(baseCtx, rules).matched_rule_id, "r1");
  });

  test("12. nested all (AND)", () => {
    const rules = [{
      id: "r1",
      condition: {
        and: [
          { field: "state.score", operator: "equals", value: 10 },
          { field: "context.device", operator: "equals", value: "mobile" }
        ]
      },
      action: { type: "redirect" }
    }];
    assert.equal(evaluateDecision(baseCtx, rules).matched_rule_id, "r1");
  });

  test("13. nested any (OR)", () => {
    const rules = [{
      id: "r1",
      condition: {
        or: [
          { field: "state.score", operator: "equals", value: 999 },
          { field: "context.device", operator: "equals", value: "mobile" }
        ]
      },
      action: { type: "redirect" }
    }];
    assert.equal(evaluateDecision(baseCtx, rules).matched_rule_id, "r1");
  });

  test("14. bilinmeyen operator güvenli fallback", () => {
    const rules = [{ id: "r1", condition: { field: "state.score", operator: "magical", value: 10 }, action: { type: "redirect" } }];
    assert.equal(evaluateDecision(baseCtx, rules).matched_rule_id, "default");
  });

  test("15. bozuk condition çökertmiyor", () => {
    const rules = [{ id: "r1", condition: null, action: { type: "redirect" } }];
    assert.equal(evaluateDecision(baseCtx, rules).matched_rule_id, "default");
  });

  test("16. bozuk action render döner", () => {
    const rules = [{ id: "r1", condition: "always", action: null }];
    assert.equal(evaluateDecision(baseCtx, rules).action, "render");
  });

  test("17. redirect action", () => {
    const rules = [{ id: "r1", condition: "always", action: { type: "redirect", target: "/foo" } }];
    const dec = evaluateDecision(baseCtx, rules);
    assert.equal(dec.action, "redirect");
    assert.equal(dec.redirect_target, "/foo");
  });

  test("18. render action overrides üretir", () => {
    const rules = [{ id: "r1", condition: "always", action: { type: "render", overrides: { hidden: ["c1"] } } }];
    const dec = evaluateDecision(baseCtx, rules);
    assert.equal(dec.action, "render");
    assert.deepEqual(dec.render_overrides, { hidden: ["c1"] });
  });

  test("19. render_mode propagation", () => {
    const dec = evaluateDecision({ render_mode: "experiment" }, []);
    assert.equal(dec.render_mode, "experiment");
  });

  test("20. deterministic output (100 kez deepEqual)", () => {
    const rules = [{ id: "r1", condition: "always", action: { type: "redirect" } }];
    const d1 = evaluateDecision(baseCtx, rules);
    for (let i = 0; i < 100; i++) {
      assert.deepEqual(evaluateDecision(baseCtx, rules), d1);
    }
  });

  test("21. input mutation yok", () => {
    const ctx = { state: { tags: ["a"] } };
    const rules = [{ id: "r1", condition: "always", action: { type: "redirect", overrides: { x: 1 } } }];
    const rulesSnapshot = JSON.stringify(rules);
    const ctxSnapshot = JSON.stringify(ctx);
    
    const dec = evaluateDecision(ctx, rules);
    dec.render_overrides.y = 2; // mutating output
    
    assert.equal(JSON.stringify(rules), rulesSnapshot);
    assert.equal(JSON.stringify(ctx), ctxSnapshot);
  });

  test("22. DEFAULT_DECISION mutation yok", () => {
    const dec1 = evaluateDecision({}, []);
    dec1.state_mutations.tags_to_add.push("x");
    const dec2 = evaluateDecision({}, []);
    assert.equal(dec2.state_mutations.tags_to_add.length, 0);
  });

  test("23. null runtimeContext", () => {
    assert.doesNotThrow(() => evaluateDecision(null, []));
  });

  test("24. null veya bozuk rules", () => {
    assert.doesNotThrow(() => evaluateDecision(baseCtx, null));
    assert.doesNotThrow(() => evaluateDecision(baseCtx, [{ x: 1 }, null]));
  });

  test("25. eksik path engine'i çökertmiyor", () => {
    const rules = [{ id: "r1", condition: { field: "this.does.not.exist", operator: "equals", value: "x" }, action: { type: "redirect" } }];
    assert.doesNotThrow(() => evaluateDecision(baseCtx, rules));
  });

  console.log("\n── Test Summary ──");
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}`);

  if (failed > 0) process.exit(1);
}

runTests();
