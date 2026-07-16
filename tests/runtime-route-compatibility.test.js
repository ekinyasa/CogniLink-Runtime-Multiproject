import assert from "node:assert/strict";
import { onRequestGet as catchAllHandler } from "../functions/[[path]].js";
import { onRequestGet as campaignHandler } from "../functions/c/[slug].js";

// Mock environments and data
const createMockEnv = (overrides = {}) => ({
  ROUTE_ALIAS: { get: async () => null },
  SLUG_LINKS: { get: async () => null },
  APP_CONFIG: { get: async () => null },
  AB_INDEX: { get: async () => null },
  CAMPAIGN_AB_ALIAS_INDEX: { get: async () => null },
  AE_TRAFFIC: { writeDataPoint: () => {} },
  GA4_ID: "G-TEST",
  META_PIXEL_ID: "P-TEST",
  ADMIN_TOKEN: "secret_admin",
  ...overrides
});

const createMockRequest = (urlStr, headersObj = {}) => {
  const headers = new Map(Object.entries(headersObj));
  return {
    url: urlStr,
    headers: {
      get: (k) => {
        for (const [key, value] of headers.entries()) {
          if (key.toLowerCase() === k.toLowerCase()) return value;
        }
        return null;
      }
    }
  };
};

const createMockContext = (request, env, params = {}) => ({
  request,
  env,
  params,
  waitUntil: () => {}
});

async function runTests() {
  console.log("Starting Runtime Route Compatibility Matrix Tests...\n");
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

  // ── 1. Alias Route -> Campaign Page ───────────────────────────────────────
  await test("Route Class: Alias Route (valid)", async () => {
    const env = createMockEnv({
      ROUTE_ALIAS: { get: async (k) => k === "route:test-alias" ? "test-slug" : null },
      SLUG_LINKS: { get: async (k) => k === "test-slug" ? { slug: "test-slug", isActive: true, campaign: "test-camp" } : null }
    });
    const req = createMockRequest("https://localhost/test-alias");
    const ctx = createMockContext(req, env, { path: ["test-alias"] });
    const res = await catchAllHandler(ctx);
    
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Content-Type"), "text/html;charset=UTF-8");
  });

  // ── 2. Direct Campaign Route (/c/{slug}) ──────────────────────────────────
  await test("Route Class: Direct Campaign (/c/{slug})", async () => {
    const env = createMockEnv({
      SLUG_LINKS: { get: async (k) => k === "test-slug" ? { slug: "test-slug", isActive: true } : null }
    });
    const req = createMockRequest("https://localhost/c/test-slug");
    const ctx = createMockContext(req, env, { slug: "test-slug" });
    const res = await campaignHandler(ctx);
    
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Content-Type"), "text/html;charset=UTF-8");
  });

  // ── 3. Independent Landing Page ───────────────────────────────────────────
  await test("Route Class: Independent Landing (alias -> page)", async () => {
    const env = createMockEnv({
      ROUTE_ALIAS: { get: async (k) => k === "route:landing" ? "landing-slug" : null },
      SLUG_LINKS: { get: async (k) => k === "landing-slug" ? { slug: "landing-slug", isActive: true } : null }
    });
    const req = createMockRequest("https://localhost/landing");
    const ctx = createMockContext(req, env, { path: ["landing"] });
    const res = await catchAllHandler(ctx);
    
    assert.equal(res.status, 200);
  });

  // ── 4. Redirect Route ─────────────────────────────────────────────────────
  await test("Route Class: Redirect Route", async () => {
    const env = createMockEnv({
      ROUTE_ALIAS: { get: async (k) => k === "route:rd" ? "rd-slug" : null },
      SLUG_LINKS: { get: async (k) => k === "rd-slug" ? { slug: "rd-slug", redirectUrl: "https://external.com", isActive: true } : null }
    });
    const req = createMockRequest("https://localhost/rd");
    const ctx = createMockContext(req, env, { path: ["rd"] });
    const res = await catchAllHandler(ctx);
    
    assert.equal(res.status, 302);
    assert.equal(res.headers.get("Location"), "https://external.com/");
  });

  // ── 5. Unknown Slug ───────────────────────────────────────────────────────
  await test("Route Class: Unknown Slug (404)", async () => {
    const env = createMockEnv();
    const req = createMockRequest("https://localhost/c/unknown");
    const ctx = createMockContext(req, env, { slug: "unknown" });
    const res = await campaignHandler(ctx);
    
    assert.equal(res.status, 404);
  });

  // ── 6. Inactive Slug ──────────────────────────────────────────────────────
  await test("Route Class: Inactive Slug (404)", async () => {
    const env = createMockEnv({
      SLUG_LINKS: { get: async (k) => k === "inactive-slug" ? { slug: "inactive-slug", isActive: false } : null }
    });
    const req = createMockRequest("https://localhost/c/inactive-slug");
    const ctx = createMockContext(req, env, { slug: "inactive-slug" });
    const res = await campaignHandler(ctx);
    
    assert.equal(res.status, 404);
  });

  // ── 7. Repository Null Data ───────────────────────────────────────────────
  await test("Edge Case: Repository Null", async () => {
    const env = createMockEnv(); // No mocks set, defaults to null
    const req = createMockRequest("https://localhost/null-alias");
    const ctx = createMockContext(req, env, { path: ["null-alias"] });
    const res = await catchAllHandler(ctx);
    
    assert.equal(res.status, 404);
  });

  // ── 8. Runtime Inspector (Admin Verified) ─────────────────────────────────
  await test("Shadow Pipeline: Valid Admin Inspector (JSON response)", async () => {
    const env = createMockEnv({
      ROUTE_ALIAS: { get: async (k) => k === "route:test-alias-8" ? "test-slug-8" : null },
      SLUG_LINKS: { get: async (k) => k === "test-slug-8" ? { slug: "test-slug-8", isActive: true } : null }
    });
    const req = createMockRequest("https://localhost/test-alias-8?runtime-debug=1", {
      "Authorization": "Bearer secret_admin"
    });
    const ctx = createMockContext(req, env, { path: ["test-alias-8"] });
    const res = await catchAllHandler(ctx);
    
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Content-Type"), "application/json;charset=UTF-8");
    assert.equal(res.headers.get("Cache-Control"), "no-store, private");

    const payload = await res.json();
    assert.equal(payload._warning, "RUNTIME INSPECTOR (Shadow Mode)");
    if (!payload.runtimeDiff.identical) console.error(JSON.stringify(payload.runtimeDiff, null, 2)); assert.equal(payload.runtimeDiff.identical, true);
    assert.equal(payload.decisionShadow.matched_rule_id, null);
    assert.equal(payload.decisionShadow.action, "render");
  });

  // ── 9. Runtime Inspector (Unverified / Header missing) ────────────────────
  await test("Shadow Pipeline: Invalid Admin (Normal Legacy Response)", async () => {
    const env = createMockEnv({
      ROUTE_ALIAS: { get: async (k) => k === "route:test-alias-9" ? "test-slug-9" : null },
      SLUG_LINKS: { get: async (k) => k === "test-slug-9" ? { slug: "test-slug-9", isActive: true } : null }
    });
    const req = createMockRequest("https://localhost/test-alias-9?runtime-debug=1", {
      "Authorization": "Bearer wrong_token"
    });
    const ctx = createMockContext(req, env, { path: ["test-alias-9"] });
    const res = await catchAllHandler(ctx);
    
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Content-Type"), "text/html;charset=UTF-8");
  });

  console.log("\n── Test Summary ──");
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}`);

  console.log("\n── Test Summary ──");
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}`);

  if (failed > 0) process.exit(1);
}

runTests();
