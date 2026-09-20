/**
 * tests/intent-homepage.test.js
 *
 * Regression coverage for Intent Subdomain Homepage Assignment.
 *
 * Requirements tested:
 *   1. Apex / still renders the main-site Static Page Homepage.
 *   2. An Intent without an assigned Homepage retains existing fallback behavior.
 *   3. An Intent with a Homepage renders that Landing Version at {intent}.domain/.
 *   4. Rendering happens without redirect (status 200, no Location header).
 *   5. The Landing Version's ordinary /l/{slug} path continues working.
 *   6. Changing homepageLandingId changes the root rendering.
 *   7. A Landing Version currently assigned as Intent Homepage cannot be deleted
 *      (Admin UI guard — reflected in deleteStudioLanding inline logic).
 */

import assert from "node:assert/strict";
import { timingSafeEqual as nodeTimingSafeEqual } from "node:crypto";
import { onRequestGet as catchAllHandler } from "../functions/[[path]].js";
import { onRequestGet as landingHandler } from "../functions/l/[slug].js";
import { renderAdmin } from "../functions/_shared/admin-renderer.js";

// ── Polyfill crypto.subtle.timingSafeEqual for Node.js ─────────────────────
if (!globalThis.crypto?.subtle?.timingSafeEqual) {
  if (!globalThis.crypto) globalThis.crypto = {};
  if (!globalThis.crypto.subtle) globalThis.crypto.subtle = {};
  globalThis.crypto.subtle.timingSafeEqual = function (a, b) {
    if (a.byteLength !== b.byteLength) return false;
    return nodeTimingSafeEqual(Buffer.from(a), Buffer.from(b));
  };
}

// ── In-memory KV Mock ────────────────────────────────────────────────────────
class MemoryKV {
  constructor() { this.store = new Map(); }
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
  async delete(key) { this.store.delete(key); }
  async list(opts = {}) {
    const prefix = opts.prefix || "";
    const keys = [];
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) keys.push({ name: k });
    }
    return { keys, list_complete: true };
  }
}

const createMockEnv = (overrides = {}) => ({
  APP_CONFIG:     new MemoryKV(),
  LANDING_CONFIG: new MemoryKV(),
  ROUTE_ALIAS:    new MemoryKV(),
  SLUG_LINKS:     new MemoryKV(),
  CAMPAIGN_INDEX: new MemoryKV(),
  AE_TRAFFIC:     { writeDataPoint: () => {} },
  ADMIN_TOKEN:    "secret_admin",
  GA4_ID:         "G-TEST",
  META_PIXEL_ID:  "P-TEST",
  ROOT_DOMAIN:    "niluferormanli.com",
  CANONICAL_HOST_MODE: "apex",
  ...overrides,
});

const createMockRequest = (urlStr, method = "GET", headersObj = {}) => {
  const headers = new Map();
  for (const [k, v] of Object.entries(headersObj)) headers.set(k.toLowerCase(), v);
  return {
    url: urlStr,
    method,
    headers: { get: (k) => headers.get(k.toLowerCase()) || null },
    json: async () => ({}),
  };
};

const createCtx = (request, env, params = {}) => ({
  request, env, params, waitUntil: () => {},
});

// ── Shared fixture seeder ────────────────────────────────────────────────────
async function seedFixtures(env, { setIntentHomepage = true } = {}) {
  // Main-site homepage (Static Page)
  const homePageId = "sp_home";
  const homeVerId  = "ver_home_1";
  await env.APP_CONFIG.put(`static_page:${homePageId}`, JSON.stringify({
    page_id: homePageId,
    name: "Main Coming Soon",
    slug: "coming-soon",
    status: "published",
    live_version_id: homeVerId,
  }));
  await env.APP_CONFIG.put(`static_page_ver:${homePageId}:${homeVerId}`, JSON.stringify({
    version_id: homeVerId,
    page_id:    homePageId,
    title:      "Nilüfer Ormanlı",
    status:     "published",
    customBodyHtml: "<h1 class='apex-home'>APEX HOME CONTENT</h1>",
    customStyleCss: ".apex-home { letter-spacing: 0.3em; }",
  }));
  await env.APP_CONFIG.put("site:routing", JSON.stringify({ homepagePageId: homePageId }));

  // hal intent campaign with a published landing "derin-dinleme"
  const halCampaign = {
    slug: "hal",
    name: "HÂL",
    product: "hal",
    homepageLandingId: setIntentHomepage ? "landing-derin-dinleme" : "",
    mainLandingId: "landing-derin-dinleme",
    landings: [
      {
        id:          "landing-derin-dinleme",
        slug:        "derin-dinleme",
        displayName: "Derin Dinleme",
        status:      "published",
        customBodyHtml: "<section class='hal-content'>HAL LANDING CONTENT</section>",
        customStyleCss: ".hal-content { color: #fff; }",
        layout: [],
        thanksLayout: [],
        head: {},
        updatedAt: new Date().toISOString(),
      },
    ],
  };
  await env.APP_CONFIG.put("campaign:hal", JSON.stringify(halCampaign));

  // Landing slug index (for /l/derin-dinleme route)
  await env.APP_CONFIG.put("landing:derin-dinleme", JSON.stringify({
    campaignId: "hal",
    landingId:  "landing-derin-dinleme",
  }));
}

// ── Tests ────────────────────────────────────────────────────────────────────
const runTests = async () => {
  console.log("Starting Intent Subdomain Homepage Routing Tests...");

  // Test 1 — Apex / still renders the main-site Static Page Homepage
  {
    const env = createMockEnv();
    await seedFixtures(env);

    const req = createMockRequest("https://niluferormanli.com/");
    const res = await catchAllHandler(createCtx(req, env, { path: [] }));

    assert.equal(res.status, 200, "Apex / must return 200");
    assert.ok(!res.headers.get("Location"), "Apex / must not redirect");
    const html = await res.text();
    assert.ok(html.includes("APEX HOME CONTENT"), "Apex / must render main-site homepage content");
    assert.ok(!html.includes("HAL LANDING CONTENT"), "Apex / must not render hal intent content");

    console.log("✅ PASS: 1. Apex / renders main-site homepage, not intent homepage");
  }

  // Test 2 — Intent without homepageLandingId falls through to normal routing
  {
    const env = createMockEnv();
    await seedFixtures(env, { setIntentHomepage: false });

    const req = createMockRequest(
      "https://hal.niluferormanli.com/",
      "GET",
      { "x-forwarded-host": "hal.niluferormanli.com" }
    );
    const res = await catchAllHandler(createCtx(req, env, { path: [] }));

    const html = await res.text();
    assert.ok(!html.includes("HAL LANDING CONTENT"),
      "Intent without homepageLandingId must not render intent landing at /");
    assert.ok(res.status !== 302, "Intent without homepage must not redirect");
    assert.ok(!res.headers.get("Location"), "Intent without homepage must not set Location header");

    console.log("✅ PASS: 2. Intent without homepageLandingId falls through — no intent landing served at /");
  }

  // Test 3 — Intent with homepageLandingId renders that landing at {intent}.domain/
  {
    const env = createMockEnv();
    await seedFixtures(env);

    const req = createMockRequest(
      "https://hal.niluferormanli.com/",
      "GET",
      { "x-forwarded-host": "hal.niluferormanli.com" }
    );
    const res = await catchAllHandler(createCtx(req, env, { path: [] }));

    assert.equal(res.status, 200, "Intent homepage must return 200");
    const html = await res.text();
    assert.ok(html.includes("HAL LANDING CONTENT"),
      "Intent homepage must render the assigned landing version content");
    assert.ok(!html.includes("APEX HOME CONTENT"),
      "Intent homepage must not render main-site apex homepage content");

    console.log("✅ PASS: 3. Intent with homepageLandingId renders that landing at hal.niluferormanli.com/");
  }

  // Test 4 — Rendering happens without redirect (status 200, no Location header)
  {
    const env = createMockEnv();
    await seedFixtures(env);

    const req = createMockRequest(
      "https://hal.niluferormanli.com/",
      "GET",
      { "x-forwarded-host": "hal.niluferormanli.com" }
    );
    const res = await catchAllHandler(createCtx(req, env, { path: [] }));

    assert.equal(res.status, 200, "Must be 200, not a redirect status");
    assert.ok(!res.headers.get("Location"),
      "Must not set a Location header (no redirect)");
    assert.ok(
      (res.headers.get("Content-Type") || "").includes("text/html"),
      "Must respond with HTML"
    );

    console.log("✅ PASS: 4. Intent homepage renders in-place — status 200, no redirect");
  }

  // Test 5 — The Landing Version's ordinary /l/{slug} path continues working
  {
    const env = createMockEnv();
    await seedFixtures(env);

    const req = createMockRequest(
      "https://hal.niluferormanli.com/l/derin-dinleme",
      "GET",
      { "x-forwarded-host": "hal.niluferormanli.com" }
    );
    const res = await landingHandler(createCtx(req, env, { slug: "derin-dinleme" }));

    assert.equal(res.status, 200, "/l/{slug} must still return 200");
    const html = await res.text();
    assert.ok(html.includes("HAL LANDING CONTENT"),
      "/l/{slug} must still render the same landing version content");

    console.log("✅ PASS: 5. Landing Version's ordinary /l/{slug} path continues working");
  }

  // Test 6 — Changing homepageLandingId changes what renders at /
  {
    const env = createMockEnv();
    await seedFixtures(env);

    // Add a second published landing and set it as homepage
    const camp = await env.APP_CONFIG.get("campaign:hal", { type: "json" });
    camp.landings.push({
      id:          "landing-v2",
      slug:        "v2-slug",
      displayName: "Version 2",
      status:      "published",
      customBodyHtml: "<div class='v2-content'>VERSION 2 CONTENT</div>",
      layout: [],
      head: {},
      updatedAt: new Date().toISOString(),
    });
    camp.homepageLandingId = "landing-v2";
    await env.APP_CONFIG.put("campaign:hal", JSON.stringify(camp));

    const req = createMockRequest(
      "https://hal.niluferormanli.com/",
      "GET",
      { "x-forwarded-host": "hal.niluferormanli.com" }
    );
    const res = await catchAllHandler(createCtx(req, env, { path: [] }));

    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes("VERSION 2 CONTENT"),
      "After changing homepageLandingId, / must render the new homepage landing");
    assert.ok(!html.includes("HAL LANDING CONTENT"),
      "After changing homepageLandingId, / must not render the old homepage landing");

    console.log("✅ PASS: 6. Changing homepageLandingId changes what renders at {intent}.domain/");
  }

  // Test 7 — Admin UI guards: homepage landing cannot be deleted or archived
  {
    const adminHtml = renderAdmin({
      username: "admin",
      token: "secret_admin",
      config: {},
      landingConfig: {},
      campaigns: [],
    });

    assert.ok(
      adminHtml.includes("homepageLandingId"),
      "Admin JS must reference homepageLandingId in delete/archive guards"
    );
    assert.ok(
      adminHtml.includes("Remove the Homepage assignment"),
      "deleteStudioLanding must have a guard message about removing homepage assignment"
    );
    assert.ok(
      adminHtml.includes("setStudioIntentHomepage"),
      "Admin JS must define setStudioIntentHomepage function"
    );
    assert.ok(
      adminHtml.includes("clearStudioIntentHomepage"),
      "Admin JS must define clearStudioIntentHomepage function"
    );
    assert.ok(
      adminHtml.includes("#0d9488"),
      "Admin JS must include the homepage badge teal color"
    );
    assert.ok(
      adminHtml.includes("Cannot archive the Intent Homepage"),
      "toggleArchiveStudioLanding must guard against archiving the homepage landing"
    );

    console.log("✅ PASS: 7. Admin UI guards: homepage landing cannot be deleted or archived without first removing the assignment");
  }

  console.log("\nAll Intent Subdomain Homepage Routing Tests Passed! (7/7)");
};

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
