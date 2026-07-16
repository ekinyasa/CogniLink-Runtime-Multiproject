import assert from "node:assert/strict";
import { compareRuntime } from "../functions/_shared/runtime-diff.js";

async function runTests() {
  console.log("Starting Runtime Diff Tests...\n");

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (e) {
      console.error(`❌ FAIL: ${name}`);
      console.error(e);
      failed++;
    }
  }

  await test("compareRuntime identifies completely identical structures", async () => {
    const legacy = {
      slug: "test-page",
      campaign: "test-campaign",
      customStyleCss: ".test { color: red; }",
      customHeaderHtml: "<header>",
      components: ["c1", "c2"],
      layout: [{ id: "l1" }]
    };

    const ctx = {
      campaignContext: { name: "test-campaign" },
      pageContent: {
        id: "test-page",
        custom_css: ".test { color: red; }",
        custom_html: "<header>",
        components: ["c1", "c2"],
        layout: [{ id: "l1" }]
      }
    };

    const diff = compareRuntime(legacy, ctx);
    assert.equal(diff.identical, true);
    assert.equal(diff.mismatchCount, 0);
  });

  await test("compareRuntime detects missing and extra fields", async () => {
    const legacy = {
      slug: "test-page", // missing in ctx
      components: ["c1"] // ctx has an extra one
    };

    const ctx = {
      pageContent: {
        id: null, // missing expected 'test-page'
        components: ["c1", "c2"] // actual > expected
      }
    };

    const diff = compareRuntime(legacy, ctx);
    assert.equal(diff.identical, false);
    assert.equal(diff.mismatchCount, 2);

    const missingId = diff.items.find(i => i.field === "pageContent.id");
    assert.equal(missingId.type, "missing");

    const extraComp = diff.items.find(i => i.field === "pageContent.components");
    assert.equal(extraComp.type, "extra"); // actually since expected=1, actual=2, expected < actual -> extra
  });

  await test("compareRuntime detects primitive mismatch", async () => {
    const legacy = { campaign: "A" };
    const ctx = { campaignContext: { name: "B" } };
    
    const diff = compareRuntime(legacy, ctx);
    assert.equal(diff.identical, false);
    assert.equal(diff.items[0].type, "mismatch");
  });

  await test("compareRuntime detects type mismatch", async () => {
    const legacy = { campaign: 123 }; // Number
    const ctx = { campaignContext: { name: "123" } }; // String
    
    const diff = compareRuntime(legacy, ctx);
    assert.equal(diff.identical, false);
    assert.equal(diff.items[0].type, "type_mismatch");
  });

  // ── Summary ─────────────────────────────────────────────────────────────────

  console.log("\n── Test Summary ──");
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
