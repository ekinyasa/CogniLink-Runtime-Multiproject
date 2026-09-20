/**
 * tests/site-404.test.js
 *
 * Comprehensive regression tests for Configurable Site-Wide 404 Page.
 *
 * 16 required test assertions:
 *  1. Existing apex Homepage still renders normally with HTTP 200.
 *  2. Existing www → apex canonical behavior is unchanged.
 *  3. Existing Static Page routes still work.
 *  4. Existing Intent Homepage routes still work.
 *  5. Existing Landing Version routes still work.
 *  6. Existing aliases still work.
 *  7. Unknown apex path renders configured 404 page body.
 *  8. Unknown apex path returns HTTP 404.
 *  9. Unknown apex path does NOT redirect and preserves requested URL.
 * 10. Unknown valid intent-subdomain path renders configured 404 page with HTTP 404.
 * 11. If no 404 Page is configured, current fallback behavior remains unchanged.
 * 12. Static Page assigned as 404 cannot be deleted.
 * 13. Static Page assigned as 404 cannot be archived/unpublished while assigned.
 * 14. Changing the 404 assignment changes which Static Page is rendered for unknown routes.
 * 15. 404 response contains appropriate noindex behavior.
 * 16. Existing Homepage assignment and 404 assignment can point to different pages without interfering with one another.
 */

import assert from "node:assert/strict";
import { timingSafeEqual as nodeTimingSafeEqual } from "node:crypto";
import { onRequestGet as catchAllHandler } from "../functions/[[path]].js";
import { onRequestGet as landingHandler } from "../functions/l/[slug].js";
import {
  onRequestGet as staticPagesGet,
  onRequestPost as staticPagesPost,
  onRequestDelete as staticPagesDelete
} from "../functions/api/admin/static-pages.js";
import {
  onRequestGet as siteRoutingGet,
  onRequestPost as siteRoutingPost
} from "../functions/api/admin/site-routing.js";
import { renderAdmin } from "../functions/_shared/admin-renderer.js";

// Polyfill crypto.subtle.timingSafeEqual for Node.js
if (!globalThis.crypto?.subtle?.timingSafeEqual) {
  if (!globalThis.crypto) globalThis.crypto = {};
  if (!globalThis.crypto.subtle) globalThis.crypto.subtle = {};
  globalThis.crypto.subtle.timingSafeEqual = function(a, b) {
    if (a.byteLength !== b.byteLength) return false;
    return nodeTimingSafeEqual(Buffer.from(a), Buffer.from(b));
  };
}

// In-memory KV Mock
class MemoryKV {
  constructor() {
    this.store = new Map();
  }
  async get(key, opts) {
    if (!this.store.has(key)) return null;
    const val = this.store.get(key);
    if (opts?.type === "json") {
      try { return JSON.parse(val); } catch (_) { return null; }
    }
    return val;
  }
  async put(key, val) {
    this.store.set(key, typeof val === "string" ? val : JSON.stringify(val));
  }
  async delete(key) {
    this.store.delete(key);
  }
  async list(opts = {}) {
    const prefix = opts.prefix || "";
    const keys = [];
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) {
        keys.push({ name: k });
      }
    }
    return { keys, list_complete: true };
  }
}

const createMockEnv = (overrides = {}) => {
  const appConfig = new MemoryKV();
  const landingConfig = new MemoryKV();
  const routeAlias = new MemoryKV();

  return {
    APP_CONFIG: appConfig,
    LANDING_CONFIG: landingConfig,
    ROUTE_ALIAS: routeAlias,
    SLUG_LINKS: new MemoryKV(),
    CAMPAIGN_INDEX: new MemoryKV(),
    AE_TRAFFIC: { writeDataPoint: () => {} },
    ADMIN_TOKEN: "secret_admin",
    GA4_ID: "G-TEST",
    META_PIXEL_ID: "P-TEST",
    ROOT_DOMAIN: "niluferormanli.com",
    CANONICAL_HOST_MODE: "apex",
    WWW_REDIRECT_TO_APEX: "true",
    ...overrides
  };
};

const createMockRequest = (urlStr, method = "GET", headersObj = {}, body = null) => {
  const headers = new Map();
  for (const [key, value] of Object.entries(headersObj)) {
    headers.set(key.toLowerCase(), value);
  }
  return {
    url: urlStr,
    method,
    headers: {
      get: (k) => headers.get(k.toLowerCase()) || null
    },
    json: async () => (body ? JSON.parse(body) : {})
  };
};

const createMockContext = (request, env, params = {}) => ({
  request,
  env,
  params,
  waitUntil: () => {}
});

async function setupBaseFixtures(env) {
  // 1. Static Page for Homepage: sp_home (slug: coming-soon)
  const homePageId = "sp_home";
  const homeVerId = "ver_home_1";
  await env.APP_CONFIG.put(`static_page:${homePageId}`, JSON.stringify({
    page_id: homePageId,
    name: "Main Coming Soon",
    slug: "coming-soon",
    status: "published",
    live_version_id: homeVerId
  }));
  await env.APP_CONFIG.put(`static_page_ver:${homePageId}:${homeVerId}`, JSON.stringify({
    version_id: homeVerId,
    page_id: homePageId,
    title: "Nilüfer Ormanlı",
    status: "published",
    customBodyHtml: "<h1 class='apex-home'>APEX HOMEPAGE CONTENT</h1>"
  }));
  await env.APP_CONFIG.put(`static_slug:coming-soon`, JSON.stringify({
    page_id: homePageId,
    version_id: homeVerId
  }));

  // 2. Static Page for 404: sp_404 (slug: not-found)
  const notFoundPageId = "sp_404";
  const notFoundVerId = "ver_404_1";
  await env.APP_CONFIG.put(`static_page:${notFoundPageId}`, JSON.stringify({
    page_id: notFoundPageId,
    name: "Custom 404 Not Found",
    slug: "not-found",
    status: "published",
    live_version_id: notFoundVerId
  }));
  await env.APP_CONFIG.put(`static_page_ver:${notFoundPageId}:${notFoundVerId}`, JSON.stringify({
    version_id: notFoundVerId,
    page_id: notFoundPageId,
    title: "Page Not Found - Nilüfer Ormanlı",
    status: "published",
    customBodyHtml: "<div class='custom-404-body'>CUSTOM 404 PAGE CONTENT</div>"
  }));
  await env.APP_CONFIG.put(`static_slug:not-found`, JSON.stringify({
    page_id: notFoundPageId,
    version_id: notFoundVerId
  }));

  // 3. Static Page for privacy policy
  const privacyPageId = "sp_privacy";
  const privacyVerId = "ver_privacy_1";
  await env.APP_CONFIG.put(`static_page:${privacyPageId}`, JSON.stringify({
    page_id: privacyPageId,
    name: "Privacy Policy",
    slug: "privacy-policy",
    status: "published",
    live_version_id: privacyVerId
  }));
  await env.APP_CONFIG.put(`static_page_ver:${privacyPageId}:${privacyVerId}`, JSON.stringify({
    version_id: privacyVerId,
    page_id: privacyPageId,
    title: "Privacy Policy",
    status: "published",
    customBodyHtml: "<div class='privacy-body'>PRIVACY POLICY CONTENT</div>"
  }));
  await env.APP_CONFIG.put(`static_slug:privacy-policy`, JSON.stringify({
    page_id: privacyPageId,
    version_id: privacyVerId
  }));

  // 4. Intent Campaign: hal with homepageLandingId
  const halCampaign = {
    slug: "hal",
    name: "HÂL",
    product: "hal",
    homepageLandingId: "landing-derin-dinleme",
    mainLandingId: "landing-derin-dinleme",
    landings: [
      {
        id: "landing-derin-dinleme",
        slug: "derin-dinleme",
        displayName: "Derin Dinleme",
        status: "published",
        customBodyHtml: "<section class='hal-content'>HAL INTENT HOMEPAGE</section>",
        layout: [],
        head: {},
        updatedAt: new Date().toISOString()
      }
    ]
  };
  await env.APP_CONFIG.put("campaign:hal", JSON.stringify(halCampaign));
  await env.APP_CONFIG.put("landing:derin-dinleme", JSON.stringify({
    campaignId: "hal",
    landingId: "landing-derin-dinleme"
  }));

  // 5. Site Routing: homepagePageId -> sp_home, notFoundPageId -> sp_404
  await env.APP_CONFIG.put("site:routing", JSON.stringify({
    homepagePageId: homePageId,
    notFoundPageId: notFoundPageId
  }));

  // 6. Alias: /alias-test -> derin-dinleme
  await env.ROUTE_ALIAS.put("route:alias-test", "derin-dinleme");
}

const runTests = async () => {
  console.log("Starting Configurable Site-Wide 404 Page Tests...\n");

  // Test 1: Existing apex Homepage still renders normally with HTTP 200
  {
    const env = createMockEnv();
    await setupBaseFixtures(env);

    const req = createMockRequest("https://niluferormanli.com/");
    const res = await catchAllHandler(createMockContext(req, env, { path: [] }));
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes("APEX HOMEPAGE CONTENT"));
    console.log("✅ PASS: 1. Existing apex Homepage renders normally with HTTP 200");
  }

  // Test 2: Existing www → apex canonical behavior is unchanged
  {
    const env = createMockEnv();
    await setupBaseFixtures(env);

    const req = createMockRequest("https://www.niluferormanli.com/", "GET", { "x-forwarded-host": "www.niluferormanli.com" });
    const res = await catchAllHandler(createMockContext(req, env, { path: [] }));
    assert.equal(res.status, 301);
    assert.equal(res.headers.get("location"), "https://niluferormanli.com/");
    console.log("✅ PASS: 2. Existing www -> apex canonical behavior is unchanged");
  }

  // Test 3: Existing Static Page routes still work
  {
    const env = createMockEnv();
    await setupBaseFixtures(env);

    const req = createMockRequest("https://niluferormanli.com/privacy-policy");
    const res = await catchAllHandler(createMockContext(req, env, { path: ["privacy-policy"] }));
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes("PRIVACY POLICY CONTENT"));
    console.log("✅ PASS: 3. Existing Static Page routes still work");
  }

  // Test 4: Existing Intent Homepage routes still work
  {
    const env = createMockEnv();
    await setupBaseFixtures(env);

    const req = createMockRequest("https://hal.niluferormanli.com/", "GET", { "x-forwarded-host": "hal.niluferormanli.com" });
    const res = await catchAllHandler(createMockContext(req, env, { path: [] }));
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes("HAL INTENT HOMEPAGE"));
    console.log("✅ PASS: 4. Existing Intent Homepage routes still work");
  }

  // Test 5: Existing Landing Version routes still work
  {
    const env = createMockEnv();
    await setupBaseFixtures(env);

    const req = createMockRequest("https://hal.niluferormanli.com/l/derin-dinleme", "GET", { "x-forwarded-host": "hal.niluferormanli.com" });
    const res = await landingHandler(createMockContext(req, env, { slug: "derin-dinleme" }));
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes("HAL INTENT HOMEPAGE"));
    console.log("✅ PASS: 5. Existing Landing Version routes still work");
  }

  // Test 6: Existing aliases still work
  {
    const env = createMockEnv();
    await setupBaseFixtures(env);

    const req = createMockRequest("https://niluferormanli.com/alias-test");
    const res = await catchAllHandler(createMockContext(req, env, { path: ["alias-test"] }));
    assert.equal(res.status, 200);
    console.log("✅ PASS: 6. Existing aliases still work");
  }

  // Test 7: Unknown apex path renders configured 404 page body
  {
    const env = createMockEnv();
    await setupBaseFixtures(env);

    const req = createMockRequest("https://niluferormanli.com/this-does-not-exist");
    const res = await catchAllHandler(createMockContext(req, env, { path: ["this-does-not-exist"] }));
    const html = await res.text();
    assert.ok(html.includes("CUSTOM 404 PAGE CONTENT"));
    console.log("✅ PASS: 7. Unknown apex path renders configured 404 page body");
  }

  // Test 8: Unknown apex path returns HTTP 404
  {
    const env = createMockEnv();
    await setupBaseFixtures(env);

    const req = createMockRequest("https://niluferormanli.com/this-does-not-exist");
    const res = await catchAllHandler(createMockContext(req, env, { path: ["this-does-not-exist"] }));
    assert.equal(res.status, 404);
    console.log("✅ PASS: 8. Unknown apex path returns HTTP 404");
  }

  // Test 9: Unknown apex path does NOT redirect and preserves requested URL
  {
    const env = createMockEnv();
    await setupBaseFixtures(env);

    const req = createMockRequest("https://niluferormanli.com/this-does-not-exist");
    const res = await catchAllHandler(createMockContext(req, env, { path: ["this-does-not-exist"] }));
    assert.equal(res.status, 404);
    assert.equal(res.headers.get("location"), null);
    console.log("✅ PASS: 9. Unknown apex path does NOT redirect and preserves requested URL");
  }

  // Test 10: Unknown valid intent-subdomain path renders configured 404 page with HTTP 404
  {
    const env = createMockEnv();
    await setupBaseFixtures(env);

    const req = createMockRequest("https://hal.niluferormanli.com/definitely-not-a-route", "GET", { "x-forwarded-host": "hal.niluferormanli.com" });
    const res = await catchAllHandler(createMockContext(req, env, { path: ["definitely-not-a-route"] }));
    assert.equal(res.status, 404);
    assert.equal(res.headers.get("location"), null);
    const html = await res.text();
    assert.ok(html.includes("CUSTOM 404 PAGE CONTENT"));
    console.log("✅ PASS: 10. Unknown valid intent-subdomain path renders configured 404 page with HTTP 404");
  }

  // Test 11: If no 404 Page is configured, current fallback behavior remains unchanged
  {
    const env = createMockEnv();
    await setupBaseFixtures(env);
    // Clear 404 page assignment
    await env.APP_CONFIG.put("site:routing", JSON.stringify({ homepagePageId: "sp_home", notFoundPageId: "" }));

    const req = createMockRequest("https://niluferormanli.com/unconfigured-404");
    const res = await catchAllHandler(createMockContext(req, env, { path: ["unconfigured-404"] }));
    assert.equal(res.status, 404);
    const body = await res.text();
    assert.equal(body, "Not Found");
    assert.equal(res.headers.get("content-type"), "text/plain;charset=UTF-8");
    console.log("✅ PASS: 11. If no 404 Page is configured, default plain text 404 response is preserved");
  }

  // Test 12: Static Page assigned as 404 cannot be deleted
  {
    const env = createMockEnv();
    await setupBaseFixtures(env);
    const authHeaders = { Authorization: "Bearer secret_admin" };

    const delReq = createMockRequest("https://niluferormanli.com/api/admin/static-pages?page_id=sp_404", "DELETE", authHeaders);
    const delRes = await staticPagesDelete(createMockContext(delReq, env));
    assert.equal(delRes.status, 400);
    const delData = await delRes.json();
    assert.ok(!delData.success);
    assert.ok(delData.error.includes("assigned as the 404 Page"));
    console.log("✅ PASS: 12. Static Page assigned as 404 cannot be deleted");
  }

  // Test 13: Static Page assigned as 404 cannot be archived/unpublished while assigned
  {
    const env = createMockEnv();
    await setupBaseFixtures(env);
    const authHeaders = { Authorization: "Bearer secret_admin" };

    // Attempt to unpublish sp_404 via update_page
    const unpubReq = createMockRequest("https://niluferormanli.com/api/admin/static-pages", "POST", authHeaders, JSON.stringify({
      action: "update_page",
      page_id: "sp_404",
      status: "draft"
    }));
    const unpubRes = await staticPagesPost(createMockContext(unpubReq, env));
    assert.equal(unpubRes.status, 400);
    const unpubData = await unpubRes.json();
    assert.ok(!unpubData.success);
    assert.ok(unpubData.error.includes("assigned as the 404 Page"));

    // Attempt to archive sp_404 via archive_page
    const archReq = createMockRequest("https://niluferormanli.com/api/admin/static-pages", "POST", authHeaders, JSON.stringify({
      action: "archive_page",
      page_id: "sp_404"
    }));
    const archRes = await staticPagesPost(createMockContext(archReq, env));
    assert.equal(archRes.status, 400);
    const archData = await archRes.json();
    assert.ok(!archData.success);
    assert.ok(archData.error.includes("assigned as the 404 Page"));
    console.log("✅ PASS: 13. Static Page assigned as 404 cannot be archived/unpublished while assigned");
  }

  // Test 14: Changing the 404 assignment changes which Static Page is rendered for unknown routes
  {
    const env = createMockEnv();
    await setupBaseFixtures(env);
    const authHeaders = { Authorization: "Bearer secret_admin" };

    // Change 404 assignment from sp_404 to sp_privacy
    const setReq = createMockRequest("https://niluferormanli.com/api/admin/site-routing", "POST", authHeaders, JSON.stringify({
      homepagePageId: "sp_home",
      notFoundPageId: "sp_privacy"
    }));
    const setRes = await siteRoutingPost(createMockContext(setReq, env));
    assert.equal(setRes.status, 200);

    const req = createMockRequest("https://niluferormanli.com/unknown-route-2");
    const res = await catchAllHandler(createMockContext(req, env, { path: ["unknown-route-2"] }));
    assert.equal(res.status, 404);
    const html = await res.text();
    assert.ok(html.includes("PRIVACY POLICY CONTENT"));
    assert.ok(!html.includes("CUSTOM 404 PAGE CONTENT"));
    console.log("✅ PASS: 14. Changing 404 assignment changes which Static Page is rendered for unknown routes");
  }

  // Test 15: 404 response contains appropriate noindex behavior
  {
    const env = createMockEnv();
    await setupBaseFixtures(env);

    const req = createMockRequest("https://niluferormanli.com/seo-404-check");
    const res = await catchAllHandler(createMockContext(req, env, { path: ["seo-404-check"] }));
    assert.equal(res.status, 404);
    const html = await res.text();
    assert.ok(html.includes('<meta name="robots" content="noindex, nofollow">'));
    assert.ok(!html.includes('<link rel="canonical"'), "404 response must not emit a canonical tag");
    assert.ok(!html.includes('<meta property="og:url"'), "404 response must not emit og:url tag");
    console.log("✅ PASS: 15. 404 response contains appropriate noindex behavior and no canonical tag");
  }

  // Test 16: Existing Homepage assignment and 404 assignment can point to different pages without interfering with one another
  {
    const env = createMockEnv();
    await setupBaseFixtures(env);

    // GET / -> renders Homepage (sp_home)
    const homeReq = createMockRequest("https://niluferormanli.com/");
    const homeRes = await catchAllHandler(createMockContext(homeReq, env, { path: [] }));
    assert.equal(homeRes.status, 200);
    const homeHtml = await homeRes.text();
    assert.ok(homeHtml.includes("APEX HOMEPAGE CONTENT"));
    assert.ok(!homeHtml.includes("CUSTOM 404 PAGE CONTENT"));

    // GET /unknown -> renders 404 Page (sp_404)
    const unknownReq = createMockRequest("https://niluferormanli.com/unknown-route-3");
    const unknownRes = await catchAllHandler(createMockContext(unknownReq, env, { path: ["unknown-route-3"] }));
    assert.equal(unknownRes.status, 404);
    const unknownHtml = await unknownRes.text();
    assert.ok(unknownHtml.includes("CUSTOM 404 PAGE CONTENT"));
    assert.ok(!unknownHtml.includes("APEX HOMEPAGE CONTENT"));

    console.log("✅ PASS: 16. Homepage assignment and 404 assignment work independently without interference");
  }

  console.log("\nAll 16 Configurable Site-Wide 404 Page Tests Passed Successfully!");
};

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
