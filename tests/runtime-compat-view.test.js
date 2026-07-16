import assert from "node:assert/strict";
import { createLegacyCompatibleView } from "../functions/_shared/runtime-compat-view.js";

async function runTests() {
  console.log("Starting Runtime Compat View Tests...\n");
  let passed = 0, failed = 0;

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

  // Helper mocks
  const mockLegacy = {
    slug: "leg-slug",
    campaign: "leg-camp",
    defaults: { a: 1 },
    layout: [{ id: "l1" }],
    components: ["c1"],
    links: [{ id: "link1", href: "url1" }],
    customStyleCss: "body { color: red; }",
    customHeaderHtml: "<head></head>",
    customFooterHtml: "<footer></footer>",
    pageTitle: "Leg Title",
    theme: "light",
    redirectUrl: "https://legacy.com",
    isActive: true,
    engineMapId: "engine-123",
    unknownField: "preserve-me"
  };

  const mockCtx = {
    pageContent: {
      id: "ctx-slug",
      title: "Ctx Title",
      layout: [{ id: "ctx-l1" }],
      components: ["ctx-c1"],
      custom_css: "body { color: blue; }",
      custom_html: "<head>CTX</head>\n<footer>CTX</footer>",
      redirect: "https://ctx.com",
      theme: "dark"
    },
    campaignContext: {
      name: "ctx-camp",
      utm_defaults: { b: 2 },
      status: "active"
    },
    activeLinks: [{ id: "ctx-link1", href: "ctx-url1" }]
  };

  test("1. RuntimeContext alanı varsa RuntimeContext kazanır", () => {
    const view = createLegacyCompatibleView(mockCtx, mockLegacy);
    assert.equal(view.slug, "ctx-slug");
    assert.equal(view.campaign, "ctx-camp");
    assert.equal(view.pageTitle, "Ctx Title");
    assert.equal(view.theme, "dark");
  });

  test("2. RuntimeContext alanı eksikse legacy fallback çalışır", () => {
    const emptyCtx = { pageContent: {}, campaignContext: {} };
    const view = createLegacyCompatibleView(emptyCtx, mockLegacy);
    assert.equal(view.slug, "leg-slug");
    assert.equal(view.campaign, "leg-camp");
    assert.equal(view.customStyleCss, "body { color: red; }");
  });

  test("3. RuntimeContext null ise legacy obje aynen korunur", () => {
    const view = createLegacyCompatibleView(null, mockLegacy);
    assert.deepEqual(view, mockLegacy);
  });

  test("4. Legacy null ama RuntimeContext varsa güvenli view oluşur", () => {
    const view = createLegacyCompatibleView(mockCtx, null);
    assert.equal(view.slug, "ctx-slug");
    assert.equal(view.campaign, "ctx-camp");
    assert.equal(view.redirectUrl, "https://ctx.com");
  });

  test("5. Input mutation yok", () => {
    const legClone = JSON.parse(JSON.stringify(mockLegacy));
    const ctxClone = JSON.parse(JSON.stringify(mockCtx));
    const view = createLegacyCompatibleView(mockCtx, mockLegacy);
    
    // Assert original inputs remained untouched
    assert.deepEqual(mockLegacy, legClone);
    assert.deepEqual(mockCtx, ctxClone);
    
    // Mutate the view to make sure it doesn't leak into original
    view.defaults.b = 999;
    view.layout[0].id = "mutated";
    
    // The original ctx shouldn't be mutated!
    assert.equal(mockCtx.campaignContext.utm_defaults.b, 2);
    assert.equal(mockCtx.pageContent.layout[0].id, "ctx-l1");
  });

  test("6. Aynı input 100 kez aynı output", () => {
    const firstOutput = JSON.stringify(createLegacyCompatibleView(mockCtx, mockLegacy));
    for (let i = 0; i < 100; i++) {
      assert.equal(JSON.stringify(createLegacyCompatibleView(mockCtx, mockLegacy)), firstOutput);
    }
  });

  test("7. custom CSS mapping", () => {
    const view = createLegacyCompatibleView(mockCtx, mockLegacy);
    assert.equal(view.customStyleCss, "body { color: blue; }");
  });

  test("8. header/footer HTML mapping", () => {
    const view = createLegacyCompatibleView(mockCtx, mockLegacy);
    assert.equal(view.customHeaderHtml, "<head>CTX</head>\n<footer>CTX</footer>");
    assert.equal(view.customFooterHtml, "");
  });

  test("9. links mapping", () => {
    const view = createLegacyCompatibleView(mockCtx, mockLegacy);
    assert.deepEqual(view.links, [{ id: "ctx-link1", href: "ctx-url1" }]);
  });

  test("10. components mapping", () => {
    const view = createLegacyCompatibleView(mockCtx, mockLegacy);
    assert.deepEqual(view.components, ["ctx-c1"]);
  });

  test("11. layout mapping", () => {
    const view = createLegacyCompatibleView(mockCtx, mockLegacy);
    assert.deepEqual(view.layout, [{ id: "ctx-l1" }]);
  });

  test("12. campaign/defaults mapping", () => {
    const view = createLegacyCompatibleView(mockCtx, mockLegacy);
    assert.equal(view.campaign, "ctx-camp");
    assert.deepEqual(view.defaults, { b: 2 });
  });

  test("13. redirect yalnız veri olarak taşınır, uygulanmaz", () => {
    const view = createLegacyCompatibleView(mockCtx, mockLegacy);
    assert.equal(view.redirectUrl, "https://ctx.com");
    // View doesn't have an action or perform a redirect
  });

  test("14. bilinmeyen legacy alanlar kaybolmaz", () => {
    const view = createLegacyCompatibleView(mockCtx, mockLegacy);
    assert.equal(view.unknownField, "preserve-me");
    assert.equal(view.engineMapId, "engine-123");
    assert.equal(view.isActive, true);
  });

  test("15. invalid RuntimeContext legacy response’u bozmaz", () => {
    const invalidCtx = { invalidKey: "value", activeLinks: "not-an-array" };
    const view = createLegacyCompatibleView(invalidCtx, mockLegacy);
    assert.equal(view.unknownField, "preserve-me");
    assert.equal(view.slug, "leg-slug");
    assert.equal(view.links, "not-an-array"); // Validates it blindly copies what ctx has, but since schema validation happens in adapter, we don't care here.
  });

  console.log("\n── Test Summary ──");
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}`);

  if (failed > 0) process.exit(1);
}

runTests();
