import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveContext, DEFAULT_RUNTIME_CONTEXT } from "../functions/_shared/runtime-adapter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Mock Providers ────────────────────────────────────────────────────────────

const createMockProvider = (v2Data = null, legacyData = null) => ({
  fetchV2: async (id) => v2Data,
  fetchLegacy: async (id) => legacyData
});

const failProvider = {
  fetchV2: async () => { throw new Error("Should not fetch"); },
  fetchLegacy: async () => { throw new Error("Should not fetch"); }
};

const nullProvider = {
  fetchV2: async () => null,
  fetchLegacy: async () => null
};

// ── Test Runner ───────────────────────────────────────────────────────────────

async function runTests() {
  console.log("Starting Runtime Adapter Tests...\n");

  const legacyFixtureStr = await fs.readFile(path.join(__dirname, "fixtures/legacy-record.json"), "utf8");
  const legacyRecord = JSON.parse(legacyFixtureStr);

  const v2FixtureStr = await fs.readFile(path.join(__dirname, "fixtures/v2-record.json"), "utf8");
  const v2Record = JSON.parse(v2FixtureStr);

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

  // ── 1. DEFAULT_RUNTIME_CONTEXT Tests ────────────────────────────────────────

  await test("DEFAULT_RUNTIME_CONTEXT shape consistency", async () => {
    assert.ok(DEFAULT_RUNTIME_CONTEXT.campaignContext, "Missing campaignContext");
    assert.ok(DEFAULT_RUNTIME_CONTEXT.pageContent, "Missing pageContent");
    assert.ok(Array.isArray(DEFAULT_RUNTIME_CONTEXT.activeLinks), "Missing activeLinks");
    assert.equal(DEFAULT_RUNTIME_CONTEXT.render_mode, "canonical", "Default render_mode is canonical");
    assert.equal(DEFAULT_RUNTIME_CONTEXT.metadata.runtime_version, "adapter", "runtime_version is adapter");
  });

  // ── 2. Null Safety & Fallbacks ──────────────────────────────────────────────

  await test("resolveContext: Throws without provider", async () => {
    await assert.rejects(
      async () => await resolveContext("test-id", null),
      /Adapter requires a data provider/
    );
  });

  await test("resolveContext: Returns safe defaults when record not found", async () => {
    const result = await resolveContext("test-id", nullProvider);
    assert.equal(result.metadata.source_schema, "not_found");
    assert.equal(result.render_mode, "canonical");
    // Should safely spread DEFAULT_RUNTIME_CONTEXT
    assert.deepEqual(result.campaignContext, DEFAULT_RUNTIME_CONTEXT.campaignContext);
  });

  await test("resolveContext: Handles malformed/empty objects safely", async () => {
    const malformedProvider = createMockProvider({}, null);
    const result = await resolveContext("test-id", malformedProvider);
    assert.equal(result.metadata.source_schema, "v2");
    // Deep merge ensures no undefined access crashes
    assert.ok(result.campaignContext);
    assert.ok(result.pageContent);
    assert.deepEqual(result.activeLinks, []);
  });

  // ── 3. V2 Normalization ─────────────────────────────────────────────────────

  await test("normalizeV2: Maps decoupled data correctly", async () => {
    const provider = createMockProvider(v2Record, null);
    const result = await resolveContext("p_98765", provider);
    
    assert.equal(result.metadata.source_schema, "v2");
    assert.equal(result.campaignContext.id, "c_12345");
    assert.equal(result.pageContent.id, "p_98765");
    assert.equal(result.activeLinks.length, 1);
    assert.equal(result.activeLinks[0].id, "get-quote");
  });

  // ── 4. Legacy Normalization ─────────────────────────────────────────────────

  await test("normalizeLegacy: Maps SLUG_LINKS data correctly", async () => {
    const provider = createMockProvider(null, legacyRecord);
    const result = await resolveContext("legacy-insurance-demo", provider, { render_mode: "campaign" });
    
    assert.equal(result.metadata.source_schema, "legacy");
    assert.equal(result.render_mode, "campaign");
    
    // Campaign mapping
    assert.equal(result.campaignContext.name, "legacy-summer-campaign");
    assert.deepEqual(result.campaignContext.utm_defaults, { "utm_source": "google", "utm_medium": "cpc", "utm_term": "insurance" });
    assert.equal(result.campaignContext.status, "active");

    // Page mapping
    assert.equal(result.pageContent.id, "legacy-insurance-demo");
    assert.equal(result.pageContent.custom_html, "<script>console.log('legacy header');</script>\n<div>Legacy Footer</div>");
    assert.equal(result.pageContent.custom_css, ".legacy { color: red; }");
    assert.equal(result.pageContent.layout[0].id, "fam-hero-1");

    // Links
    assert.equal(result.activeLinks.length, 1);
    assert.equal(result.activeLinks[0].href, "https://example.com/checkout");
  });

  // ── 5. Edge Cases & Filtering ─────────────────────────────────────────────────

  await test("Edge Cases: Filters invalid, duplicate, and inactive components/links", async () => {
    const dirtyLegacy = {
      slug: "dirty-page",
      components: ["hero", "hero", null, " ", "footer"],
      links: [
        { id: "link1", href: "https://a.com", order: 2 },
        { id: "link1", href: "https://duplicate.com" }, // Should be ignored (first wins)
        { id: "link2", href: "" }, // Invalid href
        { id: "link3", href: "https://b.com", isActive: false }, // Inactive
        { id: "link4", href: "https://c.com", order: 1 }
      ],
      customHeaderHtml: "<header>",
      customFooterHtml: "<footer>"
    };

    const provider = createMockProvider(null, dirtyLegacy);
    const result = await resolveContext("dirty-page", provider);

    // Components
    assert.deepEqual(result.pageContent.components, ["hero", "footer"]);

    // Links (should be sorted by order)
    assert.equal(result.activeLinks.length, 2);
    assert.equal(result.activeLinks[0].id, "link4"); // order: 1
    assert.equal(result.activeLinks[1].id, "link1"); // order: 2
    assert.equal(result.activeLinks[1].href, "https://a.com"); // First instance won

    // HTML combination
    assert.equal(result.pageContent.custom_html, "<header>\n<footer>");
  });

  // ── 6. Side Effects & Immutability ──────────────────────────────────────────

  await test("Side effects: Input objects are not mutated", async () => {
    const legacyClone = JSON.parse(JSON.stringify(legacyRecord));
    const provider = createMockProvider(null, legacyClone);
    await resolveContext("legacy-insurance-demo", provider);
    
    // Deep equal checks if the object was mutated inside the adapter
    assert.deepEqual(legacyClone, legacyRecord);
  });

  // ── 7. Deterministic Guarantee ──────────────────────────────────────────────

  await test("Deterministic Guarantee: Same input yields exactly deepEqual output over 100 runs", async () => {
    const provider = createMockProvider(null, legacyRecord);
    
    const baseline = await resolveContext("legacy-insurance-demo", provider);
    
    for (let i = 0; i < 100; i++) {
      const current = await resolveContext("legacy-insurance-demo", provider);
      assert.deepEqual(current, baseline, `Run ${i + 1} produced different output. Adapter is not deterministic!`);
    }
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
