import assert from "node:assert/strict";
import { timingSafeEqual as nodeTimingSafeEqual } from "node:crypto";
import vm from "node:vm";
import { renderAdmin } from "../functions/_shared/admin-renderer.js";
import { onRequestGet as catchAllHandler } from "../functions/[[path]].js";
import {
  onRequestGet as staticPagesGet,
  onRequestPost as staticPagesPost,
  onRequestDelete as staticPagesDelete
} from "../functions/api/admin/static-pages.js";
import {
  onRequestGet as siteRoutingGet,
  onRequestPost as siteRoutingPost
} from "../functions/api/admin/site-routing.js";

// Polyfill crypto.subtle.timingSafeEqual for Node.js (CF Workers API)
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

const runTests = async () => {
  console.log("Starting Static Pages & Homepage Routing Tests...");

  // Test 1: Static Pages Admin CRUD
  {
    const env = createMockEnv();
    const authHeaders = { Authorization: "Bearer secret_admin" };

    // 1. Create page in draft
    const createReq = createMockRequest("https://niluferormanli.com/api/admin/static-pages", "POST", authHeaders, JSON.stringify({
      action: "create_page",
      name: "Privacy Policy",
      slug: "privacy-policy",
      title: "Privacy Policy - Nilüfer Ormanlı",
      status: "draft"
    }));
    const createRes = await staticPagesPost(createMockContext(createReq, env));
    assert.equal(createRes.status, 200);
    const createData = await createRes.json();
    assert.ok(createData.success);
    assert.equal(createData.page.slug, "privacy-policy");
    assert.equal(createData.page.status, "draft");
    assert.equal(createData.version.version_number, 1);

    const pageId = createData.page.page_id;
    const versionId = createData.version.version_id;

    // Verify static_slug is NOT set for draft
    const slugBeforePublish = await env.APP_CONFIG.get("static_slug:privacy-policy", { type: "json" });
    assert.equal(slugBeforePublish, null);

    // 2. Save version contents
    const saveVerReq = createMockRequest("https://niluferormanli.com/api/admin/static-pages", "POST", authHeaders, JSON.stringify({
      action: "save_version",
      page_id: pageId,
      version_id: versionId,
      title: "Privacy Policy & GDPR",
      customBodyHtml: "<div class='privacy-content'>Your privacy is important to us.</div>",
      customStyleCss: ".privacy-content { color: #fff; }",
      customScript: "console.log('privacy loaded');",
      notes: "Updated GDPR section"
    }));
    const saveVerRes = await staticPagesPost(createMockContext(saveVerReq, env));
    assert.equal(saveVerRes.status, 200);
    const saveVerData = await saveVerRes.json();
    assert.equal(saveVerData.version.customBodyHtml, "<div class='privacy-content'>Your privacy is important to us.</div>");

    // 3. Publish version
    const pubReq = createMockRequest("https://niluferormanli.com/api/admin/static-pages", "POST", authHeaders, JSON.stringify({
      action: "publish_version",
      page_id: pageId,
      version_id: versionId
    }));
    const pubRes = await staticPagesPost(createMockContext(pubReq, env));
    assert.equal(pubRes.status, 200);
    const pubData = await pubRes.json();
    assert.equal(pubData.page.status, "published");
    assert.equal(pubData.page.live_version_id, versionId);

    // Verify static_slug index is now active
    const slugIndex = await env.APP_CONFIG.get("static_slug:privacy-policy", { type: "json" });
    assert.ok(slugIndex);
    assert.equal(slugIndex.page_id, pageId);
    assert.equal(slugIndex.version_id, versionId);

    // 4. Duplicate version
    const dupReq = createMockRequest("https://niluferormanli.com/api/admin/static-pages", "POST", authHeaders, JSON.stringify({
      action: "duplicate_version",
      page_id: pageId,
      version_id: versionId
    }));
    const dupRes = await staticPagesPost(createMockContext(dupReq, env));
    assert.equal(dupRes.status, 200);
    const dupData = await dupRes.json();
    assert.equal(dupData.version.version_number, 2);
    assert.equal(dupData.version.status, "draft");

    // 5. GET all pages
    const listReq = createMockRequest("https://niluferormanli.com/api/admin/static-pages", "GET", authHeaders);
    const listRes = await staticPagesGet(createMockContext(listReq, env));
    const listData = await listRes.json();
    assert.equal(listData.pages.length, 1);
    assert.equal(listData.versions.length, 2);

    console.log("✅ PASS: 1. Static Pages Admin CRUD and versioning operations");
  }

  // Test 2: Site Routing Admin API
  {
    const env = createMockEnv();
    const authHeaders = { Authorization: "Bearer secret_admin" };

    const setReq = createMockRequest("https://niluferormanli.com/api/admin/site-routing", "POST", authHeaders, JSON.stringify({
      homepagePageId: "sp_main_coming_soon"
    }));
    const setRes = await siteRoutingPost(createMockContext(setReq, env));
    assert.equal(setRes.status, 200);

    // Verify synced in both APP_CONFIG and LANDING_CONFIG
    const routingInApp = await env.APP_CONFIG.get("site:routing", { type: "json" });
    assert.equal(routingInApp.homepagePageId, "sp_main_coming_soon");

    const hubCfg = await env.LANDING_CONFIG.get("hub_config", { type: "json" });
    assert.equal(hubCfg.homepageStaticPageId, "sp_main_coming_soon");

    const getReq = createMockRequest("https://niluferormanli.com/api/admin/site-routing", "GET", authHeaders);
    const getRes = await siteRoutingGet(createMockContext(getReq, env));
    const getData = await getRes.json();
    assert.equal(getData.homepagePageId, "sp_main_coming_soon");

    console.log("✅ PASS: 2. Site Routing admin API gets and persists homepage configuration");
  }

  // Test 3: Static Page Slug Routing (e.g. /privacy-policy)
  {
    const env = createMockEnv();
    const pageId = "sp_privacy";
    const verId = "ver_1";

    await env.APP_CONFIG.put(`static_page:${pageId}`, JSON.stringify({
      page_id: pageId,
      name: "Privacy Policy",
      slug: "privacy-policy",
      status: "published",
      live_version_id: verId
    }));
    await env.APP_CONFIG.put(`static_page_ver:${pageId}:${verId}`, JSON.stringify({
      version_id: verId,
      page_id: pageId,
      title: "Nilüfer Ormanlı - Gizlilik Politikası",
      status: "published",
      customBodyHtml: "<p class='gdpr-text'>Gizlilik Politikası Detayları</p>",
      customStyleCss: ".gdpr-text { font-size: 16px; }"
    }));
    await env.APP_CONFIG.put(`static_slug:privacy-policy`, JSON.stringify({
      page_id: pageId,
      version_id: verId
    }));

    const req = createMockRequest("https://niluferormanli.com/privacy-policy");
    const res = await catchAllHandler(createMockContext(req, env, { path: ["privacy-policy"] }));
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Content-Type"), "text/html; charset=utf-8");
    const html = await res.text();
    assert.ok(html.includes("Gizlilik Politikası Detayları"));
    assert.ok(html.includes("Nilüfer Ormanlı - Gizlilik Politikası"));
    assert.ok(html.includes(".gdpr-text { font-size: 16px; }"));
    assert.ok(!html.includes("teklifi.online"), "Static page must not contain teklifi.online");
    assert.ok(html.includes("C: https://niluferormanli.com/privacy-policy"), "Static page canonical URL must derive from ROOT_DOMAIN");

    console.log("✅ PASS: 3. Static page slug routing renders published page from root domain");
  }

  // Test 4: Canonical Root Homepage Routing (GET /)
  {
    const env = createMockEnv();
    const pageId = "sp_home";
    const verId = "ver_home_1";

    await env.APP_CONFIG.put(`static_page:${pageId}`, JSON.stringify({
      page_id: pageId,
      name: "Main Coming Soon",
      slug: "coming-soon",
      status: "published",
      live_version_id: verId
    }));
    await env.APP_CONFIG.put(`static_page_ver:${pageId}:${verId}`, JSON.stringify({
      version_id: verId,
      page_id: pageId,
      title: "Nilüfer Ormanlı",
      status: "published",
      customBodyHtml: "<h1>N İ L Ü F E R   O R M A N L I</h1><p>Launching soon.</p>",
      customStyleCss: "h1 { letter-spacing: 0.3em; }"
    }));
    await env.APP_CONFIG.put("site:routing", JSON.stringify({
      homepagePageId: pageId
    }));

    // Request to root /
    const req = createMockRequest("https://niluferormanli.com/");
    const res = await catchAllHandler(createMockContext(req, env, { path: [] }));
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Content-Type"), "text/html; charset=utf-8");
    const html = await res.text();
    assert.ok(html.includes("N İ L Ü F E R   O R M A N L I"));
    assert.ok(html.includes("Launching soon."));
    assert.ok(html.includes("letter-spacing: 0.3em;"));
    assert.ok(!html.includes("teklifi.online"), "Homepage static page must not contain teklifi.online");
    assert.ok(html.includes('<link rel="canonical" href="https://niluferormanli.com/">'), "Homepage canonical URL must be root /");
    assert.ok(!html.includes('<link rel="canonical" href="https://niluferormanli.com/coming-soon">'), "Homepage canonical URL must not be /coming-soon");
    assert.ok(html.includes('<meta property="og:url" content="https://niluferormanli.com/">'), "Homepage og:url must be root /");

    // Direct request to /coming-soon
    await env.APP_CONFIG.put(`static_slug:coming-soon`, JSON.stringify({
      page_id: pageId,
      version_id: verId
    }));
    const reqSlug = createMockRequest("https://niluferormanli.com/coming-soon");
    const resSlug = await catchAllHandler(createMockContext(reqSlug, env, { path: ["coming-soon"] }));
    assert.equal(resSlug.status, 200);
    const htmlSlug = await resSlug.text();
    assert.ok(htmlSlug.includes('<link rel="canonical" href="https://niluferormanli.com/coming-soon">'), "Direct request canonical must be /coming-soon");
    assert.ok(htmlSlug.includes('<meta property="og:url" content="https://niluferormanli.com/coming-soon">'), "Direct request og:url must be /coming-soon");

    console.log("✅ PASS: 4. Root / resolves and renders configured homepage static page with public request URL canonical");
  }

  // Test 5: Homepage Fallback when Unconfigured
  {
    const env = createMockEnv();
    // No site:routing set

    // Alias home configured in ROUTE_ALIAS
    await env.ROUTE_ALIAS.put("route:home", "home-landing");
    await env.SLUG_LINKS.put("home-landing", JSON.stringify({
      campaign: "default-home",
      theme: "Default"
    }));

    const req = createMockRequest("https://niluferormanli.com/");
    const res = await catchAllHandler(createMockContext(req, env, { path: [] }));
    // Resolves alias home-landing without throwing 500
    assert.equal(res.status, 200);

    console.log("✅ PASS: 5. Root / safely falls back to /home alias when homepage static page unconfigured");
  }

  // Test 6: Draft Version Preview with Authorization
  {
    const env = createMockEnv();
    const pageId = "sp_about";
    const ver1 = "ver_published";
    const ver2 = "ver_draft";

    await env.APP_CONFIG.put(`static_page:${pageId}`, JSON.stringify({
      page_id: pageId,
      name: "About Us",
      slug: "about",
      status: "published",
      live_version_id: ver1
    }));
    await env.APP_CONFIG.put(`static_page_ver:${pageId}:${ver1}`, JSON.stringify({
      version_id: ver1,
      page_id: pageId,
      title: "Live About",
      status: "published",
      customBodyHtml: "<div>Live Published Content</div>"
    }));
    await env.APP_CONFIG.put(`static_page_ver:${pageId}:${ver2}`, JSON.stringify({
      version_id: ver2,
      page_id: pageId,
      title: "Draft About",
      status: "draft",
      customBodyHtml: "<div>Unpublished Draft Secret Content</div>"
    }));
    await env.APP_CONFIG.put(`static_slug:about`, JSON.stringify({
      page_id: pageId,
      version_id: ver1
    }));

    // 1. Without preview_version query param -> returns live content
    const normalReq = createMockRequest("https://niluferormanli.com/about");
    const normalRes = await catchAllHandler(createMockContext(normalReq, env, { path: ["about"] }));
    assert.equal(normalRes.status, 200);
    const normalHtml = await normalRes.text();
    assert.ok(normalHtml.includes("Live Published Content"));
    assert.ok(!normalHtml.includes("Unpublished Draft Secret Content"));

    // 2. With preview_version but no auth -> 401
    const unauthReq = createMockRequest(`https://niluferormanli.com/about?preview_version=${ver2}`);
    const unauthRes = await catchAllHandler(createMockContext(unauthReq, env, { path: ["about"] }));
    assert.equal(unauthRes.status, 401);

    // 3. With preview_version and valid auth -> renders draft
    const authReq = createMockRequest(`https://niluferormanli.com/about?preview_version=${ver2}`, "GET", {
      Authorization: "Bearer secret_admin"
    });
    const authRes = await catchAllHandler(createMockContext(authReq, env, { path: ["about"] }));
    assert.equal(authRes.status, 200);
    const authHtml = await authRes.text();
    assert.ok(authHtml.includes("Unpublished Draft Secret Content"));

    console.log("✅ PASS: 6. Draft version preview requires auth and displays draft version");
  }

  // Test 7: Component Reuse by ID without Markup Duplication
  {
    const env = createMockEnv();
    const pageId = "sp_comp_test";
    const verId = "ver_comp_1";

    // Seed live component in comp_live
    await env.APP_CONFIG.put("comp_live", JSON.stringify([
      {
        family_id: "fam_contact_card",
        family_key: "contact_card",
        component_id: "comp_100",
        type: "block",
        placement_hint: "body",
        status: "active",
        title: "Bize Ulaşın",
        body: "<p>info@niluferormanli.com</p>",
        cta_label: "Mesaj Gönder",
        cta_url: "mailto:info@niluferormanli.com"
      }
    ]));

    // Static page layout references component by ID only
    await env.APP_CONFIG.put(`static_page:${pageId}`, JSON.stringify({
      page_id: pageId,
      name: "Contact Page",
      slug: "contact",
      status: "published",
      live_version_id: verId
    }));
    await env.APP_CONFIG.put(`static_page_ver:${pageId}:${verId}`, JSON.stringify({
      version_id: verId,
      page_id: pageId,
      title: "Contact",
      status: "published",
      layout: [
        { type: "custom_html", content: "<section class='intro'>Welcome to contact page</section>" },
        { type: "component", id: "fam_contact_card" }
      ],
      components: ["fam_contact_card"]
    }));
    await env.APP_CONFIG.put("static_slug:contact", JSON.stringify({
      page_id: pageId,
      version_id: verId
    }));

    const req = createMockRequest("https://niluferormanli.com/contact");
    const res = await catchAllHandler(createMockContext(req, env, { path: ["contact"] }));
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes("Welcome to contact page"));
    assert.ok(html.includes("Bize Ulaşın"));
    assert.ok(html.includes("info@niluferormanli.com"));
    assert.ok(html.includes("Mesaj Gönder"));

    console.log("✅ PASS: 7. Library component dynamically rendered into static page layout by family ID");
  }

  // Test 8: Non-interference with Existing Aliases & Campaign Routes
  {
    const env = createMockEnv();
    await env.ROUTE_ALIAS.put("route:campaign-alias", "campaign-canonical-slug");
    await env.SLUG_LINKS.put("campaign-canonical-slug", JSON.stringify({
      campaign: "summer-sale",
      theme: "Default",
      defaults: { utm_source: "instagram", utm_medium: "bio" }
    }));

    const req = createMockRequest("https://niluferormanli.com/campaign-alias");
    const res = await catchAllHandler(createMockContext(req, env, { path: ["campaign-alias"] }));
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes("RUNTIME DEBUG INFO"));

    console.log("✅ PASS: 8. Existing campaign and alias pipeline is completely untouched");
  }

  // Test 9: Admin Renderer client scripts syntax validation
  {
    const html = renderAdmin({});
    const scriptRegex = /<script>([\s\S]*?)<\/script>/gi;
    let match;
    let count = 0;
    while ((match = scriptRegex.exec(html)) !== null) {
      count++;
      // If there are syntax errors, vm.Script will throw SyntaxError
      new vm.Script(match[1], { filename: `admin-inline-script-${count}.js` });
    }
    assert.ok(count >= 2, "Expected at least 2 inline script tags in admin page");

    console.log("✅ PASS: 9. Admin renderer scripts are syntactically valid with zero browser parse errors");
  }

  // Test 10: Active Homepage Delete Protection & Version Deletion
  {
    const env = createMockEnv();
    const authHeaders = { authorization: "Bearer secret_admin" };

    // 1. Create two static pages: page A (homepage) and page B (other)
    const createReqA = createMockRequest("https://niluferormanli.com/api/admin/static-pages", "POST", authHeaders, JSON.stringify({
      action: "create_page",
      name: "Main Homepage",
      slug: "main-home",
      status: "published"
    }));
    const resA = await staticPagesPost(createMockContext(createReqA, env));
    assert.equal(resA.status, 200);
    const dataA = await resA.json();
    const hpPageId = dataA.page.page_id;

    const createReqB = createMockRequest("https://niluferormanli.com/api/admin/static-pages", "POST", authHeaders, JSON.stringify({
      action: "create_page",
      name: "Other Page",
      slug: "other-page",
      status: "draft"
    }));
    const resB = await staticPagesPost(createMockContext(createReqB, env));
    assert.equal(resB.status, 200);
    const dataB = await resB.json();
    const otherPageId = dataB.page.page_id;

    // 2. Set page A as active Homepage in site:routing
    const routeReq = createMockRequest("https://niluferormanli.com/api/admin/site-routing", "POST", authHeaders, JSON.stringify({
      homepagePageId: hpPageId
    }));
    const routeRes = await siteRoutingPost(createMockContext(routeReq, env));
    assert.equal(routeRes.status, 200);

    // 3. Attempt to delete active homepage -> MUST FAIL with 400
    const delHpReq = createMockRequest(`https://niluferormanli.com/api/admin/static-pages?page_id=${hpPageId}`, "DELETE", authHeaders);
    const delHpRes = await staticPagesDelete(createMockContext(delHpReq, env));
    assert.equal(delHpRes.status, 400);
    const delHpData = await delHpRes.json();
    assert.equal(delHpData.success, false);
    assert.ok(delHpData.error.includes("This page is currently assigned as the Homepage"));

    // Verify page A still exists in KV
    const pageAInKv = await env.APP_CONFIG.get(`static_page:${hpPageId}`, { type: "json" });
    assert.ok(pageAInKv);
    assert.equal(pageAInKv.name, "Main Homepage");

    // 4. Attempt to delete non-homepage page B -> MUST SUCCEED with 200
    const delOtherReq = createMockRequest(`https://niluferormanli.com/api/admin/static-pages?page_id=${otherPageId}`, "DELETE", authHeaders);
    const delOtherRes = await staticPagesDelete(createMockContext(delOtherReq, env));
    assert.equal(delOtherRes.status, 200);
    const delOtherData = await delOtherRes.json();
    assert.equal(delOtherData.success, true);

    // Verify page B is deleted from KV
    const pageBInKv = await env.APP_CONFIG.get(`static_page:${otherPageId}`, { type: "json" });
    assert.equal(pageBInKv, null);

    // 5. Unassign page A as homepage, then delete -> MUST SUCCEED
    await siteRoutingPost(createMockContext(createMockRequest("https://niluferormanli.com/api/admin/site-routing", "POST", authHeaders, JSON.stringify({
      homepagePageId: ""
    })), env));

    const delHpReq2 = createMockRequest(`https://niluferormanli.com/api/admin/static-pages?page_id=${hpPageId}`, "DELETE", authHeaders);
    const delHpRes2 = await staticPagesDelete(createMockContext(delHpReq2, env));
    assert.equal(delHpRes2.status, 200);
    const pageAAfterUnset = await env.APP_CONFIG.get(`static_page:${hpPageId}`, { type: "json" });
    assert.equal(pageAAfterUnset, null);

    // 6. Test version deletion and verify line 425 fix (pageId vs page_id)
    const createReqC = createMockRequest("https://niluferormanli.com/api/admin/static-pages", "POST", authHeaders, JSON.stringify({
      action: "create_page",
      name: "Version Test Page",
      slug: "version-test",
      status: "published"
    }));
    const resC = await staticPagesPost(createMockContext(createReqC, env));
    const dataC = await resC.json();
    const verId1 = dataC.version.version_id;

    const delVerReq = createMockRequest(`https://niluferormanli.com/api/admin/static-pages?page_id=${dataC.page.page_id}&version_id=${verId1}`, "DELETE", authHeaders);
    const delVerRes = await staticPagesDelete(createMockContext(delVerReq, env));
    assert.equal(delVerRes.status, 200);
    // Ensure page was updated without reference error or invalid key
    const pageCInKv = await env.APP_CONFIG.get(`static_page:${dataC.page.page_id}`, { type: "json" });
    assert.ok(pageCInKv);
    assert.equal(pageCInKv.live_version_id, null);
    assert.equal(pageCInKv.status, "draft");

    console.log("✅ PASS: 10. Active Homepage Delete Protection enforces that active homepage cannot be deleted, non-homepage can be deleted, and version delete works cleanly");
  }

  // Test 11: Admin UI canonical esc usage, library mode button styling, and delete protection markup validation
  {
    const html = renderAdmin({ rootDomain: "niluferormanli.com" });
    assert.ok(!html.includes("escHtml("), "renderAdmin must not contain any escHtml calls");
    assert.ok(html.includes('id="sp-btn-delete-page"'), "renderAdmin must contain #sp-btn-delete-page");
    assert.ok(html.includes('id="sp-homepage-notice"'), "renderAdmin must contain #sp-homepage-notice");
    assert.ok(html.includes("activeHomepageStaticPageId"), "renderAdmin must track activeHomepageStaticPageId");
    assert.ok(html.includes('window.ROOT_DOMAIN = "niluferormanli.com"'), "renderAdmin must expose window.ROOT_DOMAIN");
    assert.ok(html.includes('#subtab-btn-components,#subtab-btn-static-pages{flex:0 0 auto !important;width:auto !important}'), "Library subtab buttons must prevent flex:1 width expansion");
    console.log("✅ PASS: 11. Admin UI uses canonical esc helper exclusively, prevents library button width expansion, and renders delete protection elements");
  }

  // Test 12: Legacy full-document static page homepage rendering preserves authored styles and selectors
  {
    const env = createMockEnv();
    const pageId = "sp_main_coming_soon";
    const verId = "spv_main_coming_soon_v1";

    const fullDoc = `<!doctype html>
<html>
<head>
<style>
.page{margin:0}
.photo-pair{display:flex}
.main-stage{color:#fff}
.main-glass{backdrop-filter:blur(10px)}
.footer-system{display:grid}
.social{gap:10px}
</style>
</head>
<body>
<div class="page"><div class="photo-pair"><div class="main-glass"><h1 class="main-stage">Coming Soon</h1></div></div><footer class="footer-system"><div class="social"></div></footer></div>
</body>
</html>`;

    await env.APP_CONFIG.put(`static_page:${pageId}`, JSON.stringify({
      page_id: pageId,
      name: "Main Coming Soon",
      slug: "coming-soon",
      status: "published",
      live_version_id: verId
    }));
    await env.APP_CONFIG.put(`static_page_ver:${pageId}:${verId}`, JSON.stringify({
      version_id: verId,
      page_id: pageId,
      title: "Nilüfer Ormanlı",
      status: "published",
      layout: [{ type: "custom_html", content: fullDoc }]
    }));
    await env.APP_CONFIG.put("site:routing", JSON.stringify({
      homepagePageId: pageId
    }));

    const req = createMockRequest("https://niluferormanli.com/");
    const res = await catchAllHandler(createMockContext(req, env, { path: [] }));
    assert.equal(res.status, 200);
    const html = await res.text();

    // Verify document shell ownership
    const countOccurrences = (str, substr) => str.split(substr).length - 1;
    assert.equal(countOccurrences(html, "<!DOCTYPE html>"), 1, "Exactly one <!DOCTYPE html>");
    assert.equal(countOccurrences(html, "<html"), 1, "Exactly one <html");
    assert.equal(countOccurrences(html, "</html>"), 1, "Exactly one </html>");
    assert.equal(countOccurrences(html, "<head>"), 1, "Exactly one <head>");
    assert.equal(countOccurrences(html, "</head>"), 1, "Exactly one </head>");
    assert.equal(countOccurrences(html, "<body"), 1, "Exactly one <body");
    assert.equal(countOccurrences(html, "</body>"), 1, "Exactly one </body>");

    // Verify all Coming Soon CSS rules are preserved and present in rendered output
    assert.ok(html.includes(".page{margin:0}"), "Contains .page style rule");
    assert.ok(html.includes(".photo-pair{display:flex}"), "Contains .photo-pair style rule");
    assert.ok(html.includes(".main-stage{color:#fff}"), "Contains .main-stage style rule");
    assert.ok(html.includes(".main-glass{backdrop-filter:blur(10px)}"), "Contains .main-glass style rule");
    assert.ok(html.includes(".footer-system{display:grid}"), "Contains .footer-system style rule");
    assert.ok(html.includes(".social{gap:10px}"), "Contains .social style rule");

    console.log("✅ PASS: 12. Legacy full-document static page homepage rendering preserves authored styles and selectors");
  }

  console.log("\nAll Static Pages & Homepage Routing Tests Passed! (12/12)");
};

runTests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
