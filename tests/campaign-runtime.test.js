import assert from "node:assert/strict";
import { onRequestGet } from "../functions/c/[slug].js";

function createMockEnv(overrides = {}) {
  const kvData = new Map();
  kvData.set("summer-campaign", JSON.stringify({
    campaign: "summer-sale",
    isActive: true,
    engineMapId: "emap-1"
  }));

  const routeKv = new Map();
  const appKv = new Map();

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
    ROUTE_ALIAS: {
      async get(key, opts) {
        return routeKv.get(key) || null;
      },
      async put(key, val) {
        routeKv.set(key, val);
      }
    },
    APP_CONFIG: {
      async get(key, opts) {
        const val = appKv.get(key);
        if (!val) return [];
        return opts?.type === "json" ? JSON.parse(val) : val;
      },
      async put(key, val) {
        appKv.set(key, typeof val === "string" ? val : JSON.stringify(val));
      }
    },
    DECISION_V2_FULL_AUTHORITY_ENABLED: "true",
    ...overrides
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
  }],
  ["onRequestGet 301 redirects /c/{alias} to /{alias} for published Intent landing alias and preserves query params", async () => {
    const env = createMockEnv();
    await env.ROUTE_ALIAS.put("route:derin-dinleme", "/l/version-1789080299436");

    const req = new Request("https://hal.niluferormanli.com/c/derin-dinleme?utm_source=instagram&utm_medium=bio&test=1");
    const ctx = {
      request: req,
      env,
      params: { slug: "derin-dinleme" },
      waitUntil() {}
    };
    const res = await onRequestGet(ctx);
    assert.equal(res.status, 301, "Should return 301 redirect");
    assert.equal(
      res.headers.get("Location"),
      "https://hal.niluferormanli.com/derin-dinleme?utm_source=instagram&utm_medium=bio&test=1",
      "Redirect location must match canonical public alias /{alias} and preserve query params"
    );
  }],
  ["onRequestGet 301 redirects /c/{alias} via APP_CONFIG intent campaign fallback if ROUTE_ALIAS missing", async () => {
    const env = createMockEnv();
    // In this case ROUTE_ALIAS is empty, but APP_CONFIG has the campaign with published landing alias
    await env.APP_CONFIG.put("campaign:hal-derin-dinleme", {
      id: "hal-derin-dinleme",
      landings: [
        {
          id: "version-1789080299436",
          alias: "derin-dinleme",
          status: "published"
        }
      ]
    });

    const req = new Request("https://hal.niluferormanli.com/c/derin-dinleme?campaign=autumn");
    const ctx = {
      request: req,
      env,
      params: { slug: "derin-dinleme" },
      waitUntil() {}
    };
    const res = await onRequestGet(ctx);
    assert.equal(res.status, 301, "Should return 301 redirect");
    assert.equal(
      res.headers.get("Location"),
      "https://hal.niluferormanli.com/derin-dinleme?campaign=autumn",
      "Redirect location must match canonical public alias /{alias} and preserve query params"
    );
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
