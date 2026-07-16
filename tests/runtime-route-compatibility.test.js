import assert from "node:assert/strict";
import { onRequestGet as catchAllHandler } from "../functions/[[path]].js";
import { onRequestGet as campaignHandler } from "../functions/c/[slug].js";

// Mock environments and data
const createMockEnv = (overrides = {}) => {
  const env = {
    ROUTE_ALIAS: { get: async () => null },
    SLUG_LINKS: { get: async () => null },
    APP_CONFIG: { get: async () => null },
    AB_INDEX: { get: async () => null },
    CAMPAIGN_AB_ALIAS_INDEX: { get: async () => null },
    AE_TRAFFIC: { writeDataPoint: () => {} },
    GA4_ID: "G-TEST",
    META_PIXEL_ID: "P-TEST",
    RUNTIME_CONTEXT_READ_ENABLED: "true",
    ADMIN_TOKEN: "secret_admin",
    ...overrides
  };
  // If ADMIN_TOKEN is explicitly passed as undefined in overrides, delete it
  if (overrides && 'ADMIN_TOKEN' in overrides && overrides.ADMIN_TOKEN === undefined) {
    delete env.ADMIN_TOKEN;
  }
  return env;
};

const createMockRequest = (urlStr, headersObj = {}) => {
  const headers = new Map();
  for (const [key, value] of Object.entries(headersObj)) {
    headers.set(key.toLowerCase(), value);
  }
  return {
    url: urlStr,
    headers: {
      get: (k) => headers.get(k.toLowerCase()) || null
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
  console.log("Starting Comprehensive Runtime Route Compatibility & Inspector Auth Tests...\n");
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

  // Common setups
  const standardEnv = createMockEnv({
    ROUTE_ALIAS: { get: async (k) => k === "route:alias-test" ? "alias-test-slug" : null },
    SLUG_LINKS: { get: async (k) => k === "alias-test-slug" ? { slug: "alias-test-slug", isActive: true } : null }
  });

  const cEnv = createMockEnv({
    SLUG_LINKS: { get: async (k) => k === "c-slug" ? { slug: "c-slug", isActive: true } : null }
  });

  const redirectEnv = createMockEnv({
    ROUTE_ALIAS: { get: async (k) => k === "route:redir" ? "redir-slug" : null },
    SLUG_LINKS: { get: async (k) => k === "redir-slug" ? { slug: "redir-slug", redirectUrl: "https://external.com", isActive: true } : null }
  });

  // 1. env.ADMIN_TOKEN mevcut + doğru Bearer + runtime-debug=1 → Inspector JSON
  await test("1. env.ADMIN_TOKEN mevcut + doğru Bearer + runtime-debug=1 → Inspector JSON", async () => {
    const req = createMockRequest("https://localhost/alias-test?runtime-debug=1", { "Authorization": "Bearer secret_admin" });
    const ctx = createMockContext(req, standardEnv, { path: ["alias-test"] });
    const res = await catchAllHandler(ctx);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Content-Type"), "application/json;charset=UTF-8");
  });

  // 2. doğru X-Admin-Token + runtime-debug=1 → Inspector JSON
  await test("2. doğru X-Admin-Token + runtime-debug=1 → Inspector JSON", async () => {
    const req = createMockRequest("https://localhost/alias-test?runtime-debug=1", { "X-Admin-Token": "secret_admin" });
    const ctx = createMockContext(req, standardEnv, { path: ["alias-test"] });
    const res = await catchAllHandler(ctx);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Content-Type"), "application/json;charset=UTF-8");
  });

  // 3. env.ADMIN_TOKEN undefined → normal HTML/redirect
  await test("3. env.ADMIN_TOKEN undefined → normal HTML/redirect", async () => {
    const envNoSecret = createMockEnv({ ADMIN_TOKEN: undefined, ROUTE_ALIAS: standardEnv.ROUTE_ALIAS, SLUG_LINKS: standardEnv.SLUG_LINKS });
    const req = createMockRequest("https://localhost/alias-test?runtime-debug=1", { "Authorization": "Bearer secret_admin" });
    const ctx = createMockContext(req, envNoSecret, { path: ["alias-test"] });
    const res = await catchAllHandler(ctx);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Content-Type"), "text/html;charset=UTF-8");
  });

  // 4. yanlış Bearer → normal HTML/redirect
  await test("4. yanlış Bearer → normal HTML/redirect", async () => {
    const req = createMockRequest("https://localhost/alias-test?runtime-debug=1", { "Authorization": "Bearer wrong_token" });
    const ctx = createMockContext(req, standardEnv, { path: ["alias-test"] });
    const res = await catchAllHandler(ctx);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Content-Type"), "text/html;charset=UTF-8");
  });

  // 5. header yok → normal HTML/redirect
  await test("5. header yok → normal HTML/redirect", async () => {
    const req = createMockRequest("https://localhost/alias-test?runtime-debug=1");
    const ctx = createMockContext(req, standardEnv, { path: ["alias-test"] });
    const res = await catchAllHandler(ctx);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Content-Type"), "text/html;charset=UTF-8");
  });

  // 6. runtime-debug yok → normal HTML/redirect
  await test("6. runtime-debug yok → normal HTML/redirect", async () => {
    const req = createMockRequest("https://localhost/alias-test", { "Authorization": "Bearer secret_admin" });
    const ctx = createMockContext(req, standardEnv, { path: ["alias-test"] });
    const res = await catchAllHandler(ctx);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Content-Type"), "text/html;charset=UTF-8");
  });

  // 7. eski admin-verify query → normal HTML/redirect
  await test("7. eski admin-verify query → normal HTML/redirect", async () => {
    const req = createMockRequest("https://localhost/alias-test?admin-verify=secret_admin");
    const ctx = createMockContext(req, standardEnv, { path: ["alias-test"] });
    const res = await catchAllHandler(ctx);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Content-Type"), "text/html;charset=UTF-8");
  });

  // 8. alias route → JSON
  await test("8. alias route → JSON", async () => {
    const req = createMockRequest("https://localhost/alias-test?runtime-debug=1", { "Authorization": "Bearer secret_admin" });
    const ctx = createMockContext(req, standardEnv, { path: ["alias-test"] });
    const res = await catchAllHandler(ctx);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Content-Type"), "application/json;charset=UTF-8");
  });

  // 9. /c/{slug} route → JSON
  await test("9. /c/{slug} route → JSON", async () => {
    const req = createMockRequest("https://localhost/c/c-slug?runtime-debug=1", { "Authorization": "Bearer secret_admin" });
    const ctx = createMockContext(req, cEnv, { slug: "c-slug" });
    const res = await campaignHandler(ctx);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Content-Type"), "application/json;charset=UTF-8");
  });

  // 10. independent landing route → JSON
  await test("10. independent landing route → JSON", async () => {
    const landingEnv = createMockEnv({
      APP_CONFIG: { get: async (k) => k === "hub:landing-slug" ? { slug: "landing-slug", isActive: true } : null }
    });
    const req = createMockRequest("https://localhost/landing-slug?runtime-debug=1", { "Authorization": "Bearer secret_admin" });
    const ctx = createMockContext(req, landingEnv, { path: ["landing-slug"] });
    const res = await catchAllHandler(ctx);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Content-Type"), "application/json;charset=UTF-8");
  });

  // 11. Inspector response Cache-Control: no-store, private
  await test("11. Inspector response Cache-Control: no-store, private", async () => {
    const req = createMockRequest("https://localhost/alias-test?runtime-debug=1", { "Authorization": "Bearer secret_admin" });
    const ctx = createMockContext(req, standardEnv, { path: ["alias-test"] });
    const res = await catchAllHandler(ctx);
    assert.equal(res.headers.get("Cache-Control"), "no-store, private");
  });

  // 12. normal response body/status/header regression yok
  await test("12. normal response body/status/header regression yok", async () => {
    const req = createMockRequest("https://localhost/alias-test");
    const ctx = createMockContext(req, standardEnv, { path: ["alias-test"] });
    const res = await catchAllHandler(ctx);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Content-Type"), "text/html;charset=UTF-8");
    assert.ok(res.headers.get("Cache-Control").includes("public"));
  });

  // 13. RUNTIME_CONTEXT_READ_ENABLED true ve false durumlarında auth aynı çalışıyor
  await test("13. RUNTIME_CONTEXT_READ_ENABLED true ve false durumlarında auth aynı çalışıyor", async () => {
    const envTrue = createMockEnv({ RUNTIME_CONTEXT_READ_ENABLED: "true", ROUTE_ALIAS: standardEnv.ROUTE_ALIAS, SLUG_LINKS: standardEnv.SLUG_LINKS });
    const envFalse = createMockEnv({ RUNTIME_CONTEXT_READ_ENABLED: "false", ROUTE_ALIAS: standardEnv.ROUTE_ALIAS, SLUG_LINKS: standardEnv.SLUG_LINKS });
    
    const req = createMockRequest("https://localhost/alias-test?runtime-debug=1", { "Authorization": "Bearer secret_admin" });
    
    const resTrue = await catchAllHandler(createMockContext(req, envTrue, { path: ["alias-test"] }));
    const resFalse = await catchAllHandler(createMockContext(req, envFalse, { path: ["alias-test"] }));
    
    assert.equal(resTrue.status, 200);
    assert.equal(resTrue.headers.get("Content-Type"), "application/json;charset=UTF-8");
    assert.equal(resFalse.status, 200);
    assert.equal(resFalse.headers.get("Content-Type"), "application/json;charset=UTF-8");
  });

  // 14. deployed environment shape’ini temsil eden mock env ile test (redirect handler intercepting Inspector fix)
  await test("14. redirect intercepting Inspector fix", async () => {
    // Ensure inspector is returned BEFORE redirect happens
    const req = createMockRequest("https://localhost/redir?runtime-debug=1", { "Authorization": "Bearer secret_admin" });
    const ctx = createMockContext(req, redirectEnv, { path: ["redir"] });
    const res = await catchAllHandler(ctx);
    assert.equal(res.status, 200); // SHOULD NOT BE 302
    assert.equal(res.headers.get("Content-Type"), "application/json;charset=UTF-8");
  });
  
  // 15. c/[slug] 404 intercepting Inspector fix
  await test("15. c/[slug] 404 intercepting Inspector fix", async () => {
    // If not found in SLUG_LINKS, it should still return JSON if auth is valid
    const env404 = createMockEnv({ SLUG_LINKS: { get: async () => null } });
    const req = createMockRequest("https://localhost/c/not-found?runtime-debug=1", { "Authorization": "Bearer secret_admin" });
    const ctx = createMockContext(req, env404, { slug: "not-found" });
    const res = await campaignHandler(ctx);
    assert.equal(res.status, 200); // SHOULD NOT BE 404
    assert.equal(res.headers.get("Content-Type"), "application/json;charset=UTF-8");
  });

  // 16. Verify Landing Inspector correctly populates rawV2 and achieves identical Diff using real APP_CONFIG hub: records
  await test("16. Verify Landing Inspector populates rawV2 and identical Diff using hub: mapping", async () => {
    // We mock APP_CONFIG to return a full hub: object
    const hubEnv = createMockEnv({
      APP_CONFIG: {
        get: async (key) => {
          if (key === "hub:p-2") {
            return {
              slug: "p-2",
              pageTitle: "Page 2",
              customStyleCss: "body { color: blue; }",
              customHeaderHtml: "<meta name='test'>",
              layout: [{ id: "l2" }],
              components: ["c3"],
              links: [{ id: "link2", href: "#", isActive: true }],
              theme: "light",
              campaign: "c-2",
              defaults: { utm_source: "fb" },
              isActive: true,
              decision_rules: [{
                id: "r1",
                // empty condition matches always
                action: "redirect",
                target: "https://test.com"
              }]
            };
          }
          return null;
        }
      },
      SLUG_LINKS: {
        get: async (key) => {
          // This is a direct campaign route or independent landing, 
          // let's return it from SLUG_LINKS as well so the router doesn't 404
          if (key === "p-2") {
            return {
              slug: "p-2",
              isActive: true
            };
          }
          return null;
        }
      },
      ROUTE_ALIAS: {
        get: async (key) => {
          if (key === "route:landing-test") return "p-2";
          return null;
        }
      }
    });

    const req = createMockRequest("https://localhost/landing-test?runtime-debug=1", { "Authorization": "Bearer secret_admin" });
    // path must match the alias resolution logic, let's map route:landing-test to p-2
    const ctx = createMockContext(req, hubEnv, { path: ["landing-test"] });
    const res = await catchAllHandler(ctx);
    
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Content-Type"), "application/json;charset=UTF-8");

    const payload = await res.json();
    assert.ok(payload.repositoryResult.rawV2 !== null, "rawV2 should not be null");
    assert.ok(payload.runtimeDiff.identical === true, "runtimeDiff should be perfectly identical");
    
    // Check ruleShadow and decisionShadow
    assert.ok(payload.ruleShadow !== undefined, "ruleShadow should be exposed");
    assert.ok(payload.decisionShadow !== undefined, "decisionShadow should be exposed");
    assert.equal(payload.ruleShadow.source, "page_config");
    assert.equal(payload.ruleShadow.raw_count, 1);
    assert.equal(payload.ruleShadow.valid_count, 1);
    assert.equal(payload.ruleShadow.invalid_count, 0);
    assert.equal(payload.decisionShadow.decision_id, "dec_r1_p-2");
    assert.equal(payload.decisionShadow.matched_rule_id, "r1");
    assert.equal(payload.decisionShadow.action, "redirect");
    assert.equal(payload.decisionShadow.redirect_target, "https://test.com");
  });

  // 17. Verify normal user doesn't see rule/debug info
  await test("17. Verify normal user doesn't see rule/debug info", async () => {
    const hubEnv = createMockEnv({
      APP_CONFIG: { 
        get: async (key) => {
          if (key === "comp_live") return [];
          return { isActive: true };
        }
      },
      SLUG_LINKS: { get: async () => ({ slug: "test", isActive: true }) }
    });
    const req = createMockRequest("https://localhost/c/test", {});
    const ctx = createMockContext(req, hubEnv, { slug: "test" });
    const res = await campaignHandler(ctx);
    
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.equal(body.includes("ruleShadow"), false);
    assert.equal(body.includes("decisionShadow"), false);
  });

  // 18. Verify shadow_decision_rules is prioritized and evaluated without mapping
  await test("18. Verify shadow_decision_rules is prioritized and evaluated natively", async () => {
    const hubEnv = createMockEnv({
      APP_CONFIG: {
        get: async (key) => {
          if (key === "hub:p-shadow") {
            return {
              slug: "p-shadow",
              theme: "light",
              isActive: true,
              shadow_decision_rules: [{
                id: "shadow_v2",
                enabled: true,
                action: { type: "block" },
                condition: { field: "pageContent.id", operator: "equals", value: "p-shadow" }
              }],
              decision_rules: [{ id: "legacy_r1", action: "redirect", target: "bad" }]
            };
          }
          return null;
        }
      },
      ROUTE_ALIAS: {
        get: async (key) => {
          if (key === "route:shadow-test") return "p-shadow";
          return null;
        }
      }
    });

    const req = createMockRequest("https://localhost/shadow-test?runtime-debug=1", { "Authorization": "Bearer secret_admin" });
    const ctx = createMockContext(req, hubEnv, { path: ["shadow-test"] });
    const res = await catchAllHandler(ctx);
    
    assert.equal(res.status, 200);
    const payload = await res.json();
    
    assert.equal(payload.ruleShadow.source, "shadow_page_config");
    assert.equal(payload.ruleShadow.schema, "v2");
    assert.equal(payload.ruleShadow.valid_count, 1);
    
    assert.equal(payload.decisionShadow.matched_rule_id, "shadow_v2");
    assert.equal(payload.decisionShadow.action, "block");
  });

  console.log("\n── Test Summary ──");
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}`);

  if (failed > 0) process.exit(1);
}

runTests();
