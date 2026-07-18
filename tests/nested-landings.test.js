import assert from "node:assert/strict";
import { createRuntimeRepository } from "../functions/_shared/runtime-repository.js";
import { resolveContext } from "../functions/_shared/runtime-adapter.js";

const tests = [
  ["fetchV2 resolves nested landings from campaign record", async () => {
    const mockEnv = {
      APP_CONFIG: {
        async get(key, opts) {
          if (key === "campaign:test-camp") {
            const data = {
              slug: "test-camp",
              journeyId: "j-1",
              mainLandingId: "landing-b",
              landings: [
                { id: "landing-a", title: "Version A", layout: [{ id: "l1" }] },
                { id: "landing-b", title: "Version B", layout: [{ id: "l2" }] }
              ]
            };
            return opts?.type === "json" ? data : JSON.stringify(data);
          }
          return null;
        }
      }
    };

    const repo = createRuntimeRepository(mockEnv);
    const result = await repo.fetchV2("test-camp");
    assert.ok(result);
    assert.equal(result.campaign.slug, "test-camp");
    assert.equal(result.page.title, "Version B");
    assert.equal(result.page.layout[0].id, "l2");
  }],
  ["fetchV2 falls back to independent page if nested landing doesn't exist", async () => {
    const mockEnv = {
      APP_CONFIG: {
        async get(key, opts) {
          if (key === "campaign:test-camp") {
            const data = {
              slug: "test-camp",
              journeyId: "j-1"
            };
            return opts?.type === "json" ? data : JSON.stringify(data);
          }
          if (key === "hub:test-camp") {
            const data = {
              id: "test-camp",
              pageTitle: "Independent Page",
              layout: [{ id: "fallback-layout" }]
            };
            return opts?.type === "json" ? data : JSON.stringify(data);
          }
          return null;
        }
      }
    };

    const repo = createRuntimeRepository(mockEnv);
    const result = await repo.fetchV2("test-camp");
    assert.ok(result);
    assert.equal(result.campaign.slug, "test-camp");
    assert.equal(result.page.title, "Independent Page");
    assert.equal(result.page.layout[0].id, "fallback-layout");
  }],
  ["resolveContext correctly resolves compound campaign:page identifiers", async () => {
    const mockEnv = {
      APP_CONFIG: {
        async get(key, opts) {
          if (key === "campaign:test-camp") {
            const data = {
              slug: "test-camp",
              journeyId: "j-1",
              mainLandingId: "landing-b",
              landings: [
                { id: "landing-a", title: "Version A", layout: [{ id: "l1" }] },
                { id: "landing-b", title: "Version B", layout: [{ id: "l2" }] }
              ]
            };
            return opts?.type === "json" ? data : JSON.stringify(data);
          }
          return null;
        }
      }
    };

    const repo = createRuntimeRepository(mockEnv);
    const context = await resolveContext("test-camp:landing-a", repo);
    assert.ok(context);
    assert.equal(context.campaignContext.name, "test-camp");
    assert.equal(context.pageContent.title, "Version A");
    assert.equal(context.pageContent.layout[0].id, "l1");
  }]
];

let failures = 0;
for (const [name, run] of tests) {
  try {
    await run();
    console.log(`PASS: ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL: ${name}`);
    console.error(error);
  }
}

if (failures > 0) process.exit(1);
