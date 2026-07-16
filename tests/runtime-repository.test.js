import assert from "node:assert/strict";
import { createRuntimeRepository } from "../functions/_shared/runtime-repository.js";

async function runTests() {
  console.log("Starting Runtime Repository Tests...\n");

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

  // ── Mock Cloudflare Env ─────────────────────────────────────────────────────

  const mockEnv = {
    SLUG_LINKS: {
      get: async (key) => {
        if (key === "legacy-1") return { slug: "legacy-1", type: "legacy" };
        return null;
      }
    },
    APP_CONFIG: {
      get: async (key) => {
        if (key === "hub:p-1") {
          return {
            slug: "p-1",
            pageTitle: "Page 1",
            customStyleCss: "body { color: red; }",
            customHeaderHtml: "<head></head>",
            layout: [{ id: "l1" }],
            components: ["c1", "c2"],
            links: [{ id: "link1", href: "#" }],
            theme: "dark",
            campaign: "c-1",
            defaults: { utm_source: "test" },
            isActive: true,
            modifier: "test-mod"
          };
        }
        if (key === "campaign:c-1") return { id: "c-1", name: "Campaign 1" };
        return null;
      }
    },
    ROUTE_ALIAS: {
      get: async (key) => {
        if (key === "route:alias-1") return "target-1";
        return null;
      }
    }
  };

  const repo = createRuntimeRepository(mockEnv);

  // ── Tests ───────────────────────────────────────────────────────────────────

  await test("fetchLegacy returns raw JSON from SLUG_LINKS", async () => {
    const data = await repo.fetchLegacy("legacy-1");
    assert.deepEqual(data, { slug: "legacy-1", type: "legacy" });
    
    const missing = await repo.fetchLegacy("legacy-missing");
    assert.equal(missing, null);
  });

  await test("fetchAlias returns raw string from ROUTE_ALIAS", async () => {
    const data = await repo.fetchAlias("alias-1");
    assert.equal(data, "target-1");
    
    const missing = await repo.fetchAlias("missing");
    assert.equal(missing, null);
  });

  await test("fetchPage returns raw JSON from APP_CONFIG", async () => {
    const data = await repo.fetchPage("p-1");
    assert.deepEqual(data, {
      slug: "p-1",
      pageTitle: "Page 1",
      customStyleCss: "body { color: red; }",
      customHeaderHtml: "<head></head>",
      layout: [{ id: "l1" }],
      components: ["c1", "c2"],
      links: [{ id: "link1", href: "#" }],
      theme: "dark",
      campaign: "c-1",
      defaults: { utm_source: "test" },
      isActive: true,
      modifier: "test-mod"
    });
    
    const missing = await repo.fetchPage("missing");
    assert.equal(missing, null);
  });

  await test("fetchCampaign returns raw JSON from APP_CONFIG", async () => {
    const data = await repo.fetchCampaign("c-1");
    assert.deepEqual(data, { id: "c-1", name: "Campaign 1" });
    
    const missing = await repo.fetchCampaign("missing");
    assert.equal(missing, null);
  });

  await test("fetchV2 combines page and campaign via Promise.all and maps hub: schema", async () => {
    // Both exist
    const data1 = await repo.fetchV2("c-1", "p-1");
    assert.deepEqual(data1.campaign, { id: "c-1", name: "Campaign 1" });
    assert.equal(data1.page.id, "p-1");
    assert.equal(data1.page.title, "Page 1");
    assert.equal(data1.page.custom_css, "body { color: red; }");

    // Only campaign exists
    const data2 = await repo.fetchV2("c-1", "missing");
    assert.deepEqual(data2.campaign, { id: "c-1", name: "Campaign 1" });
    assert.equal(data2.page, null);

    // Only page exists (campaign is extracted from the page record)
    const data3 = await repo.fetchV2("missing", "p-1");
    assert.deepEqual(data3.campaign, {
      id: "c-1",
      name: "c-1",
      utm_defaults: { utm_source: "test" },
      status: "active",
      modifier: "test-mod"
    });
    assert.equal(data3.page.id, "p-1");

    // Single identifier passed (assumes campaignId == pageId)
    const data4 = await repo.fetchV2("p-1");
    assert.equal(data4.page.id, "p-1");
    assert.equal(data4.campaign.id, "c-1"); // Extracted from page

    // Neither exists
    const data5 = await repo.fetchV2("missing1", "missing2");
    assert.equal(data5, null);
  });

  await test("Graceful failures when bindings are missing", async () => {
    const emptyRepo = createRuntimeRepository({}); // No bindings provided
    
    assert.equal(await emptyRepo.fetchLegacy("id"), null);
    assert.equal(await emptyRepo.fetchAlias("id"), null);
    assert.equal(await emptyRepo.fetchPage("id"), null);
    assert.equal(await emptyRepo.fetchCampaign("id"), null);
    assert.equal(await emptyRepo.fetchV2("id"), null);
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
