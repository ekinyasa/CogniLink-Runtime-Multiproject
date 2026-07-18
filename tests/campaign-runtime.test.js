import assert from "node:assert/strict";
import { onRequestGet } from "../functions/c/[slug].js";

function createMockEnv() {
  const kvData = new Map();
  kvData.set("summer-campaign", JSON.stringify({
    campaign: "summer-sale",
    isActive: true,
    engineMapId: "emap-1"
  }));

  return {
    SLUG_LINKS: {
      async get(key, opts) {
        const val = kvData.get(key);
        if (!val) return null;
        return opts?.type === "json" ? JSON.parse(val) : val;
      }
    },
    LANDING_CONFIG: {
      async get(key, opts) { return null; }
    },
    APP_CONFIG: {
      async get(key, opts) { return []; }
    },
    DECISION_V2_FULL_AUTHORITY_ENABLED: "true"
  };
}

const tests = [
  ["onRequestGet returns 404 for unknown campaign slug", async () => {
    const env = createMockEnv();
    const req = new Request("https://example.com/c/unknown-slug");
    const ctx = {
      request: req,
      env,
      params: { slug: "unknown-slug" },
      waitUntil() {}
    };
    const res = await onRequestGet(ctx);
    assert.equal(res.status, 404);
  }],
  ["onRequestGet renders campaign page for active campaign slug", async () => {
    const env = createMockEnv();
    const req = new Request("https://example.com/c/summer-campaign");
    const ctx = {
      request: req,
      env,
      params: { slug: "summer-campaign" },
      waitUntil() {}
    };
    const res = await onRequestGet(ctx);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Content-Type"), "text/html;charset=UTF-8");
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
