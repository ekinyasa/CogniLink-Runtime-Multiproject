import { test, describe } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {
  renderLanding,
  DEFAULT_CONSENT_CONFIG,
  resolveConsentConfig,
  getConsentCssVariables,
  renderConsentSnippet,
  formatOverlayBg,
  CONSENT_CSS
} from "../functions/_shared/hub-renderer.js";
import { renderAdmin } from "../functions/_shared/admin-renderer.js";
import { onRequestGet as adminConsentGet, onRequestPost as adminConsentPost } from "../functions/api/admin/consent.js";
import { onRequestGet as catchAllHandler } from "../functions/[[path]].js";

function createMockEnv(overrides = {}) {
  const store = new Map();
  const mockKv = {
    get: async (key, opt) => {
      const val = store.get(key);
      if (!val) return null;
      if (opt && opt.type === "json") return JSON.parse(val);
      return val;
    },
    put: async (key, val) => {
      store.set(key, typeof val === "string" ? val : JSON.stringify(val));
    },
    delete: async (key) => {
      store.delete(key);
    },
    list: async () => ({ keys: [] })
  };

  return {
    APP_CONFIG: mockKv,
    LANDING_CONFIG: mockKv,
    ENV_NAME: "production",
    ROOT_DOMAIN: "niluferormanli.com",
    GA4_ID: "G-K5RNWREM5K",
    META_PIXEL_ID: "1452820495739175",
    ...overrides
  };
}

function createMockRequest(url, headers = {}) {
  return new Request(url, {
    method: "GET",
    headers: new Headers({
      "Host": new URL(url).host,
      "User-Agent": "TestBrowser/1.0",
      ...headers
    })
  });
}

function createMockContext(request, env, params = {}) {
  return {
    request,
    env,
    params,
    waitUntil: () => {},
    next: async () => new Response("next", { status: 200 })
  };
}

describe("CogniLink Consent & Privacy Layer Tests", () => {

  test("1. Consent Bootstrap Script & API in head", () => {
    const html = renderLanding({
      contextType: "static",
      contextId: "home",
      slug: "home",
      rootDomain: "niluferormanli.com"
    });

    assert.ok(html.includes('var COOKIE_NAME = "cl_consent"'), "Must define cl_consent cookie name");
    assert.ok(html.includes("window.__clConsent ="), "Must expose window.__clConsent API");
    assert.ok(html.includes("hasChoice: function()"), "Must provide hasChoice()");
    assert.ok(html.includes("openPreferences: function()"), "Must provide openPreferences()");
    assert.ok(html.includes("set: function(prefs)"), "Must provide set(prefs)");
    assert.ok(html.includes("onChange: function(fn)"), "Must provide onChange listener");
    assert.ok(html.includes('ROOT_DOMAIN = "niluferormanli.com"'), "Must bind rootDomain for wildcard cookie scope");
    assert.ok(html.includes("max-age=31536000"), "Must persist cookie with 1-year TTL");
  });

  test("2. Google Consent Mode v2 default setup and strict GA4 gating", () => {
    const html = renderLanding({
      contextType: "static",
      contextId: "home",
      slug: "home",
      ga4Id: "G-TEST12345",
      rootDomain: "niluferormanli.com"
    });

    assert.ok(html.includes('gtag("consent", "default"'), "Must initialize Google Consent Mode v2 default");
    assert.ok(html.includes('"analytics_storage": currentConsent.ana ? "granted" : "denied"'), "Must default analytics_storage based on consent");
    assert.ok(html.includes('"ad_storage": currentConsent.mkt ? "granted" : "denied"'), "Must default ad_storage based on consent");
    assert.ok(html.includes('"wait_for_update": 500'), "Must specify wait_for_update in Consent Mode v2");
    assert.ok(html.includes('window.gtag("consent", "update"'), "Must update consent dynamically in __clConsent.set");
    assert.ok(html.includes('removeGaCookies()'), "Must invoke removeGaCookies on revocation");
  });

  test("2b. ZERO GA4 network traffic before consent: no static script tag for googletagmanager.com", () => {
    const html = renderLanding({
      contextType: "static",
      contextId: "home",
      slug: "home",
      ga4Id: "G-TEST12345",
      rootDomain: "niluferormanli.com"
    });

    // Assert that there is NO static script tag that loads googletagmanager.com before consent
    const staticGtagScriptRegex = /<script[^>]+src=["'][^"']*googletagmanager\.com/i;
    assert.equal(staticGtagScriptRegex.test(html), false, "Must NOT have any static script tag loading googletagmanager.com before consent");

    // Verify it is encapsulated inside dynamic loader with strict consent checks
    assert.ok(html.includes("if (window.__clConsent && window.__clConsent.has('analytics'))"), "Must guard loadGA4 with analytics consent");
    assert.ok(html.includes("window.__clConsent.onChange(function(c) {"), "Must guard dynamic GA4 loading via onChange");
  });

  test("3. Strict Meta Pixel gating: wrapped and guarded by marketing consent", () => {
    const html = renderLanding({
      contextType: "static",
      contextId: "home",
      slug: "home",
      metaPixelId: "1234567890",
      rootDomain: "niluferormanli.com"
    });

    assert.ok(html.includes("if (window.__clConsent && window.__clConsent.has('marketing'))"), "Must check marketing consent before initializing Meta Pixel");
    assert.ok(html.includes("window.__clConsent.onChange(function(c) {"), "Must register onChange listener to initialize Meta Pixel when marketing consent granted");
    assert.ok(html.includes("connect.facebook.net/en_US/fbevents.js"), "Must reference fbevents inside the guarded function");
    assert.ok(html.includes("fbq('init','1234567890')"), "Must initialize fbq with configured ID inside the guarded function");
  });

  test("4. Consent UI Banner & Preferences Modal rendered on live pages in English", () => {
    const html = renderLanding({
      contextType: "static",
      contextId: "home",
      slug: "home",
      isPreview: false,
      rootDomain: "niluferormanli.com"
    });

    assert.ok(html.includes('id="cl-consent-banner"'), "Must render consent banner markup");
    assert.ok(html.includes('id="cl-consent-modal"'), "Must render preferences modal markup");
    assert.ok(html.includes("Accept all"), "Must have Accept all button");
    assert.ok(html.includes("Reject non-essential"), "Must have Reject non-essential button");
    assert.ok(html.includes("Manage preferences"), "Must have Manage preferences button");
    assert.ok(html.includes("Save preferences"), "Must have Save preferences button");
    assert.ok(html.includes("Cookie Preferences"), "Must have Cookie Preferences title");
    assert.ok(html.includes("Necessary"), "Must have Necessary label");
    assert.ok(html.includes("Analytics"), "Must have Analytics label");
    assert.ok(html.includes("Marketing"), "Must have Marketing label");
    assert.ok(html.includes("data-cl-consent-preferences"), "Must attach global preference opener listener");
  });

  test("5. Consent UI omitted in admin preview mode", () => {
    const html = renderLanding({
      contextType: "static",
      contextId: "home",
      slug: "home",
      isPreview: true,
      rootDomain: "niluferormanli.com"
    });

    assert.ok(!html.includes('id="cl-consent-banner"'), "Banner must be omitted in preview mode");
    assert.ok(!html.includes('id="cl-consent-modal"'), "Modal must be omitted in preview mode");
  });

  test("6. Full routing test: Catch-all renders static homepage with consent-gated GA4 and Meta Pixel", async () => {
    const env = createMockEnv();
    const pageId = "sp_home_test";
    const verId = "spv_home_test_1";

    await env.APP_CONFIG.put("site:routing", JSON.stringify({
      homepagePageId: pageId
    }));

    await env.APP_CONFIG.put(`static_page:${pageId}`, JSON.stringify({
      page_id: pageId,
      name: "Nilüfer Home",
      slug: "coming-soon",
      status: "published",
      live_version_id: verId
    }));

    await env.APP_CONFIG.put(`static_page_ver:${pageId}:${verId}`, JSON.stringify({
      version_id: verId,
      page_id: pageId,
      version_number: 1,
      title: "Nilüfer Ormanlı - Welcome",
      customBodyHtml: "<main><h1>Coming Soon</h1><a href='#' data-cl-consent-preferences>Cookie Preferences</a></main>"
    }));

    const req = createMockRequest("https://niluferormanli.com/");
    const res = await catchAllHandler(createMockContext(req, env, { path: [] }));

    assert.equal(res.status, 200);
    const html = await res.text();

    // Verify GA4 and Meta Pixel are present from env vars
    assert.ok(html.includes("G-K5RNWREM5K"), "GA4_ID from env must be injected into homepage HTML");
    assert.ok(html.includes("1452820495739175"), "META_PIXEL_ID from env must be injected into homepage HTML");

    // Verify Consent Mode v2 and Meta Pixel gating are present
    assert.ok(html.includes('gtag("consent", "default"'), "Google Consent Mode v2 must be present in homepage");
    assert.ok(html.includes("window.__clConsent.has('marketing')"), "Meta Pixel gating must be present in homepage");

    // Verify Consent Banner and Preferences trigger
    assert.ok(html.includes('id="cl-consent-banner"'), "Consent banner must be rendered on homepage");
    assert.ok(html.includes("data-cl-consent-preferences"), "Footer cookie preferences trigger must be present");
  });

  test("7. Full routing test: Catch-all renders static slug page with consent-gated GA4 and Meta Pixel", async () => {
    const env = createMockEnv();
    const pageId = "sp_about";
    const verId = "spv_about_1";

    await env.APP_CONFIG.put("static_slug:about", JSON.stringify({
      page_id: pageId,
      version_id: verId
    }));

    await env.APP_CONFIG.put(`static_page:${pageId}`, JSON.stringify({
      page_id: pageId,
      name: "About Nilüfer",
      slug: "about",
      status: "published",
      live_version_id: verId
    }));

    await env.APP_CONFIG.put(`static_page_ver:${pageId}:${verId}`, JSON.stringify({
      version_id: verId,
      page_id: pageId,
      version_number: 1,
      title: "About Nilüfer",
      customBodyHtml: "<section>About Content</section>"
    }));

    const req = createMockRequest("https://niluferormanli.com/about");
    const res = await catchAllHandler(createMockContext(req, env, { path: ["about"] }));

    assert.equal(res.status, 200);
    const html = await res.text();

    assert.ok(html.includes("G-K5RNWREM5K"), "GA4_ID must be forwarded to slug static page");
    assert.ok(html.includes("1452820495739175"), "META_PIXEL_ID must be forwarded to slug static page");
    assert.ok(html.includes("cl-consent-banner"), "Consent banner must be rendered on slug static page");
  });

  test("8. Scoped CSS in BASE_CSS contains all required consent banner and modal rules", () => {
    const html = renderLanding({
      contextType: "static",
      contextId: "home",
      slug: "home",
      rootDomain: "niluferormanli.com"
    });

    assert.ok(html.includes(".cl-consent-banner{"), "CSS must contain banner styles");
    assert.ok(html.includes(".cl-consent-modal-overlay{"), "CSS must contain modal overlay styles");
    assert.ok(html.includes(".cl-consent-btn-accept{"), "CSS must contain accept button styles");
    assert.ok(html.includes(".cl-consent-btn-reject{"), "CSS must contain reject button styles");
  });

  test("9. GA4 in-session lifecycle: OFF -> ON -> OFF -> ON", () => {
    const ga4Id = "G-K5RNWREM5K";
    const html = renderLanding({
      contextType: "static",
      contextId: "home",
      slug: "home",
      ga4Id,
      rootDomain: "niluferormanli.com"
    });

    // Extract script blocks
    const scriptRegex = /<script(?:\s+id="[^"]*")?>([\s\S]*?)<\/script>/gi;
    let match;
    const scripts = [];
    while ((match = scriptRegex.exec(html)) !== null) {
      scripts.push(match[1]);
    }

    const bootstrapScript = scripts.find(s => s.includes("__clConsent ="));
    const ga4LoaderScript = scripts.find(s => s.includes("enableGA4") && s.includes(ga4Id));

    assert.ok(bootstrapScript, "Must contain bootstrap script");
    assert.ok(ga4LoaderScript, "Must contain GA4 dynamic loader script");

    // Create a mock browser execution context
    const injectedScripts = [];
    const elementsById = {};
    const sandbox = {
      window: null,
      document: {
        cookie: "",
        createElement: (tag) => ({
          tagName: tag.toUpperCase(),
          src: "",
          async: false,
          parentNode: null
        }),
        getElementsByTagName: (tag) => {
          if (tag.toLowerCase() === "script") {
            return [{
              parentNode: {
                insertBefore: (newEl, refEl) => {
                  injectedScripts.push(newEl);
                }
              }
            }];
          }
          return [];
        },
        getElementById: (id) => {
          if (!elementsById[id]) {
            elementsById[id] = { style: {}, checked: false };
          }
          return elementsById[id];
        },
        head: {
          appendChild: (el) => { injectedScripts.push(el); }
        }
      },
      location: {
        hostname: "niluferormanli.com",
        pathname: "/"
      },
      CustomEvent: class {
        constructor(type, init) {
          this.type = type;
          this.detail = init?.detail;
        }
      },
      Date: Date,
      JSON: JSON,
      Math: Math,
      encodeURIComponent: encodeURIComponent,
      Boolean: Boolean,
      Object: Object,
      console: console
    };
    sandbox.window = sandbox;
    sandbox.window.location = sandbox.location;
    sandbox.window.document = sandbox.document;
    sandbox.window.dispatchEvent = () => {};

    vm.createContext(sandbox);

    // Execute bootstrap script
    vm.runInContext(bootstrapScript, sandbox);
    // Execute GA4 loader script
    vm.runInContext(ga4LoaderScript, sandbox);

    // Stage 1: Initial state (OFF)
    assert.equal(sandbox.window[`ga-disable-${ga4Id}`], true, "Initial state: ga-disable must be true");
    assert.equal(injectedScripts.length, 0, "Initial state: zero gtag.js scripts injected");
    sandbox.window.gtag("event", "initial_unconsented_event");
    assert.ok(
      !sandbox.window.dataLayer.some(args => args[0] === "event" && args[1] === "initial_unconsented_event"),
      "Initial state: non-consent gtag event must be dropped"
    );

    // Stage 2: First enable (OFF -> ON)
    sandbox.window.__clConsent.set({ nec: true, ana: true, mkt: false });
    assert.equal(sandbox.window[`ga-disable-${ga4Id}`], false, "OFF -> ON: ga-disable must be false");
    assert.equal(injectedScripts.length, 1, "OFF -> ON: gtag.js script must be injected");
    assert.ok(injectedScripts[0].src.includes(`googletagmanager.com/gtag/js?id=${ga4Id}`), "Injected script must target ga4Id");
    sandbox.window.gtag("event", "consented_event_1");
    assert.ok(
      sandbox.window.dataLayer.some(args => args[0] === "event" && args[1] === "consented_event_1"),
      "OFF -> ON: consented event must be queued in dataLayer"
    );

    // Stage 3: Revocation (ON -> OFF)
    sandbox.window.__clConsent.set({ nec: true, ana: false, mkt: false });
    assert.equal(sandbox.window[`ga-disable-${ga4Id}`], true, "ON -> OFF: ga-disable must be set to true on revocation");
    sandbox.window.gtag("event", "revoked_event_2");
    assert.ok(
      !sandbox.window.dataLayer.some(args => args[0] === "event" && args[1] === "revoked_event_2"),
      "ON -> OFF: gtag event after revocation must be dropped"
    );

    // Stage 4: Re-enable in same session without page reload (OFF -> ON)
    sandbox.window.__clConsent.set({ nec: true, ana: true, mkt: false });
    assert.equal(
      sandbox.window[`ga-disable-${ga4Id}`],
      false,
      "OFF -> ON (re-enable): ga-disable must be explicitly reset to false"
    );
    assert.equal(
      injectedScripts.length,
      1,
      "OFF -> ON (re-enable): must NOT inject duplicate gtag.js script element"
    );
    sandbox.window.gtag("event", "resumed_event_3");
    assert.ok(
      sandbox.window.dataLayer.some(args => args[0] === "event" && args[1] === "resumed_event_3"),
      "OFF -> ON (re-enable): GA4 events must resume normally without page reload"
    );
  });

  test("10. Persistent preferences reopen: openPreferences populates saved state and survives multiple cycles", () => {
    const html = renderLanding({
      contextType: "static",
      contextId: "home",
      slug: "home",
      rootDomain: "niluferormanli.com"
    });

    const scriptRegex = /<script(?:\s+id="[^"]*")?>([\s\S]*?)<\/script>/gi;
    let match;
    const scripts = [];
    while ((match = scriptRegex.exec(html)) !== null) {
      scripts.push(match[1]);
    }
    const bootstrapScript = scripts.find(s => s.includes("__clConsent ="));
    assert.ok(bootstrapScript);

    const elementsById = {
      "cl-consent-banner": { style: { display: "none" } },
      "cl-consent-modal": { style: { display: "none" } },
      "cl-pref-nec": { checked: true, disabled: true },
      "cl-pref-ana": { checked: false },
      "cl-pref-mkt": { checked: false },
      "cl-consent-fallback-trigger": { style: { display: "none" } }
    };

    const sandbox = {
      window: null,
      document: {
        cookie: "",
        getElementById: (id) => elementsById[id] || { style: {}, checked: false },
        querySelector: () => null,
        addEventListener: () => {}
      },
      location: { hostname: "niluferormanli.com", pathname: "/" },
      CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
      Date: Date,
      JSON: JSON,
      Math: Math,
      Boolean: Boolean,
      Object: Object,
      encodeURIComponent: encodeURIComponent,
      decodeURIComponent: decodeURIComponent,
      console: console
    };
    sandbox.window = sandbox;
    sandbox.window.location = sandbox.location;
    sandbox.window.document = sandbox.document;
    sandbox.window.dispatchEvent = () => {};

    vm.createContext(sandbox);
    vm.runInContext(bootstrapScript, sandbox);

    // Initial state: no choice
    assert.equal(sandbox.window.__clConsent.hasChoice(), false);

    // User chooses: ana: true, mkt: false
    sandbox.window.__clConsent.set({ nec: true, ana: true, mkt: false });
    assert.equal(sandbox.window.__clConsent.hasChoice(), true);
    assert.equal(sandbox.window.__clConsent.has("analytics"), true);
    assert.equal(sandbox.window.__clConsent.has("marketing"), false);

    // Open preferences modal: must populate checkboxes with saved state
    sandbox.window.__clConsent.openPreferences();
    assert.equal(elementsById["cl-consent-modal"].style.display, "flex");
    assert.equal(elementsById["cl-pref-ana"].checked, true, "Analytics checkbox must be true from saved consent");
    assert.equal(elementsById["cl-pref-mkt"].checked, false, "Marketing checkbox must be false from saved consent");

    // Close preferences modal
    sandbox.window.__clConsent.closePreferences();
    assert.equal(elementsById["cl-consent-modal"].style.display, "none");

    // Cycle 2: User reopens, changes marketing to true, saves via saveFromModal()
    sandbox.window.__clConsent.openPreferences();
    elementsById["cl-pref-mkt"].checked = true;
    sandbox.window.__clConsent.saveFromModal();

    assert.equal(sandbox.window.__clConsent.has("marketing"), true, "Marketing must now be true after saving from modal");
    assert.equal(elementsById["cl-consent-modal"].style.display, "none", "Modal must close on save");

    // Cycle 3: Reopen again to ensure no corruption
    sandbox.window.__clConsent.openPreferences();
    assert.equal(elementsById["cl-pref-ana"].checked, true);
    assert.equal(elementsById["cl-pref-mkt"].checked, true);
  });

  test("11. Fallback persistent trigger: renders fallback trigger markup and syncs based on footer presence", () => {
    const html = renderLanding({
      contextType: "static",
      contextId: "home",
      slug: "home",
      rootDomain: "niluferormanli.com"
    });

    assert.ok(html.includes('id="cl-consent-fallback-trigger"'), "HTML must include #cl-consent-fallback-trigger element");
    assert.ok(html.includes("syncConsentTriggers"), "Script must include syncConsentTriggers function");
    assert.ok(html.includes("data-cl-consent-preferences"), "Script must check for data-cl-consent-preferences");
  });

  test("12. Panel configuration: custom copy and visual appearance tokens apply cleanly", () => {
    const customConsent = {
      content: {
        bannerTitle: "Custom Cookie Title",
        bannerBody: "Custom banner explanation message.",
        btnAcceptAll: "Allow Everything",
        btnRejectNonEssential: "Only Essential",
        btnManagePreferences: "Custom Settings",
        modalTitle: "Configure Privacy",
        modalDescription: "Custom modal description text.",
        necessaryTitle: "Essential Only",
        necessaryBadge: "Permanent",
        analyticsTitle: "Performance Tracking",
        marketingTitle: "Advertising Data",
        btnSavePreferences: "Apply Choices",
        fallbackTriggerLabel: "Privacy Settings"
      },
      visual: {
        bannerBg: "rgba(10, 10, 15, 0.98)",
        textColor: "#ffffff",
        secondaryTextColor: "#888888",
        borderColor: "rgba(255, 255, 255, 0.2)",
        buttonRadius: "10px",
        btnPrimaryBg: "#ff0055",
        modalBg: "#0f0f15",
        modalRadius: "16px"
      }
    };

    const html = renderLanding({
      contextType: "static",
      contextId: "home",
      slug: "home",
      config: { consent: customConsent },
      rootDomain: "niluferormanli.com"
    });

    // Verify custom content strings
    assert.ok(html.includes("Custom Cookie Title"), "Must render custom banner title");
    assert.ok(html.includes("Custom banner explanation message."), "Must render custom banner body");
    assert.ok(html.includes("Allow Everything"), "Must render custom accept button");
    assert.ok(html.includes("Only Essential"), "Must render custom reject button");
    assert.ok(html.includes("Configure Privacy"), "Must render custom modal title");
    assert.ok(html.includes("Essential Only"), "Must render custom necessary title");
    assert.ok(html.includes("Permanent"), "Must render custom necessary badge");
    assert.ok(html.includes("Performance Tracking"), "Must render custom analytics title");
    assert.ok(html.includes("Advertising Data"), "Must render custom marketing title");
    assert.ok(html.includes("Apply Choices"), "Must render custom save button");
    assert.ok(html.includes("Privacy Settings"), "Must render custom fallback trigger label");

    // Verify injected CSS custom properties
    assert.ok(html.includes("--cl-consent-banner-bg: rgba(10, 10, 15, 0.98)"), "Must inject custom banner-bg variable");
    assert.ok(html.includes("--cl-consent-button-radius: 10px"), "Must inject custom button-radius variable");
    assert.ok(html.includes("--cl-consent-btn-primary-bg: #ff0055"), "Must inject custom primary button bg variable");
    assert.ok(html.includes("--cl-consent-modal-bg: #0f0f15"), "Must inject custom modal-bg variable");
    assert.ok(html.includes("--cl-consent-modal-radius: 16px"), "Must inject custom modal-radius variable");
  });

  test("13. Fallback defaults: cleanly falls back to English defaults when consent config is absent", () => {
    const resolved = resolveConsentConfig(null);
    assert.equal(resolved.content.bannerTitle, DEFAULT_CONSENT_CONFIG.content.bannerTitle);
    assert.equal(resolved.content.btnAcceptAll, "Accept all");
    assert.equal(resolved.content.btnRejectNonEssential, "Reject non-essential");
    assert.equal(resolved.visual.btnPrimaryBg, "#2563eb");
    assert.equal(resolved.visual.modalRadius, "12px");

    const cssVars = getConsentCssVariables(resolved.visual);
    assert.ok(cssVars.includes("--cl-consent-btn-primary-bg: #2563eb"));
    assert.ok(cssVars.includes("--cl-consent-modal-radius: 12px"));
  });

  test("14. Admin Consent API: GET returns config and defaults; POST validates and sanitizes", async () => {
    const token = "valid-token-secret";
    const env = createMockEnv({ ADMIN_TOKEN: token });

    const getReq = new Request("https://niluferormanli.com/api/admin/consent", {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` }
    });

    const getRes = await adminConsentGet(createMockContext(getReq, env));
    assert.equal(getRes.status, 200);
    const getData = await getRes.json();
    assert.equal(getData.ok, true);
    assert.equal(getData.consent.content.bannerTitle, "Cookie Preferences");
    assert.ok(getData.defaults);

    // POST update with valid customization + attempt script injection
    const payload = {
      content: {
        bannerTitle: "Brand New Notice",
        bannerBody: "Safe body text <script>alert(1)</script> with link",
        btnAcceptAll: "Got It"
      },
      visual: {
        bannerBg: "#112233",
        btnPrimaryBg: "#334455"
      },
      gatingRules: "bypass",
      cookieName: "evil_cookie"
    };

    const postReq = new Request("https://niluferormanli.com/api/admin/consent", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const postRes = await adminConsentPost(createMockContext(postReq, env));
    assert.equal(postRes.status, 200);
    const postData = await postRes.json();
    assert.equal(postData.ok, true);
    assert.equal(postData.consent.content.bannerTitle, "Brand New Notice");
    assert.equal(postData.consent.content.btnAcceptAll, "Got It");
    // Verify script tags were stripped
    assert.ok(!postData.consent.content.bannerBody.includes("<script>"));
    // Verify engine tampering fields were rejected / not stored
    assert.equal(postData.consent.gatingRules, undefined);
    assert.equal(postData.consent.cookieName, undefined);

    // Verify stored in LANDING_CONFIG hub_config
    const storedHub = await env.LANDING_CONFIG.get("hub_config", { type: "json" });
    assert.equal(storedHub.consent.content.bannerTitle, "Brand New Notice");
  });

  test("15. renderConsentSnippet: outputs valid standalone markup for admin preview", () => {
    const snippet = renderConsentSnippet({
      content: { bannerTitle: "Preview Notice" }
    }, { isPreview: true });

    assert.ok(snippet.includes("Preview Notice"));
    assert.ok(snippet.includes('id="cl-consent-banner"'));
    assert.ok(snippet.includes('id="cl-consent-modal"'));
    assert.ok(snippet.includes('id="cl-consent-fallback-trigger"'));
  });

  test("16. Expanded Appearance tokens accepted and persisted in Admin API", async () => {
    const token = "secret123";
    const env = createMockEnv({ ADMIN_TOKEN: token });

    const visualPayload = {
      bannerBg: "rgba(20,20,22,0.98)",
      textColor: "#ffffff",
      secondaryTextColor: "#888888",
      borderColor: "rgba(255,255,255,0.2)",
      backdropBlur: "16px",
      bannerRadius: "4px",
      maxWidth: "1200px",
      paddingY: "1.25rem",
      paddingX: "1.5rem",
      mobilePaddingY: "0.85rem",
      mobilePaddingX: "1.15rem",
      buttonRadius: "8px",
      linkColor: "#38bdf8",
      accentColor: "#3b82f6",
      btnPrimaryBg: "#1d4ed8",
      btnPrimaryText: "#ffffff",
      btnPrimaryBorder: "#1d4ed8",
      btnSecondaryBg: "rgba(255,255,255,0.1)",
      btnSecondaryText: "#f3f4f6",
      btnSecondaryBorder: "rgba(255,255,255,0.2)",
      modalBg: "#111827",
      modalBorder: "rgba(255,255,255,0.15)",
      modalRadius: "16px",
      overlayOpacity: 0.8,
      fontFamily: "Inter, sans-serif",
      // New visual tokens
      bannerBottom: "12px",
      bannerBorderWidth: "2px",
      bannerAlignment: "center",
      desktopActionLayout: "stacked",
      mobileActionLayout: "horizontal",
      titleBodyGap: "0.5rem",
      bodyActionsGap: "1.5rem",
      actionGap: "0.75rem",
      btnPaddingX: "1.25rem",
      btnPaddingY: "0.65rem",
      btnMinHeight: "42px",
      modalMaxWidth: "600px",
      modalHeaderPadding: "1.5rem",
      modalBodyPadding: "1.5rem",
      modalFooterPadding: "1.25rem",
      cardBg: "rgba(255,255,255,0.05)",
      cardBorderColor: "rgba(255,255,255,0.08)",
      cardBorderWidth: "2px",
      cardRadius: "10px",
      cardGap: "1rem",
      cardPadding: "1rem 1.25rem",
      overlayColor: "#0f172a",
      closeColor: "#f87171",
      closeSize: "1.75rem",
      checkboxSize: "1.5rem",
      mobileMaxWidth: "92%"
    };

    const postReq = new Request("https://niluferormanli.com/api/admin/consent", {
      method: "POST",
      headers: {
        "Host": "niluferormanli.com",
        "Authorization": "Bearer secret123",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        content: { bannerTitle: "Updated Custom Notice" },
        visual: visualPayload
      })
    });

    const res = await adminConsentPost(createMockContext(postReq, env));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.consent.visual.bannerBottom, "12px");
    assert.equal(body.consent.visual.bannerBorderWidth, "2px");
    assert.equal(body.consent.visual.bannerAlignment, "center");
    assert.equal(body.consent.visual.desktopActionLayout, "stacked");
    assert.equal(body.consent.visual.mobileActionLayout, "horizontal");
    assert.equal(body.consent.visual.titleBodyGap, "0.5rem");
    assert.equal(body.consent.visual.bodyActionsGap, "1.5rem");
    assert.equal(body.consent.visual.actionGap, "0.75rem");
    assert.equal(body.consent.visual.btnPaddingX, "1.25rem");
    assert.equal(body.consent.visual.btnPaddingY, "0.65rem");
    assert.equal(body.consent.visual.btnMinHeight, "42px");
    assert.equal(body.consent.visual.modalMaxWidth, "600px");
    assert.equal(body.consent.visual.modalHeaderPadding, "1.5rem");
    assert.equal(body.consent.visual.modalBodyPadding, "1.5rem");
    assert.equal(body.consent.visual.modalFooterPadding, "1.25rem");
    assert.equal(body.consent.visual.cardBg, "rgba(255,255,255,0.05)");
    assert.equal(body.consent.visual.cardBorderColor, "rgba(255,255,255,0.08)");
    assert.equal(body.consent.visual.cardBorderWidth, "2px");
    assert.equal(body.consent.visual.cardRadius, "10px");
    assert.equal(body.consent.visual.cardGap, "1rem");
    assert.equal(body.consent.visual.cardPadding, "1rem 1.25rem");
    assert.equal(body.consent.visual.overlayColor, "#0f172a");
    assert.equal(body.consent.visual.overlayOpacity, "0.8");
    assert.equal(body.consent.visual.closeColor, "#f87171");
    assert.equal(body.consent.visual.closeSize, "1.75rem");
    assert.equal(body.consent.visual.checkboxSize, "1.5rem");
    assert.equal(body.consent.visual.mobileMaxWidth, "92%");

    // Verify stored in LANDING_CONFIG
    const stored = await env.LANDING_CONFIG.get("hub_config", { type: "json" });
    assert.equal(stored.consent.visual.bannerAlignment, "center");
    assert.equal(stored.consent.visual.desktopActionLayout, "stacked");
    assert.equal(stored.consent.visual.modalMaxWidth, "600px");
  });

  test("17. Visual token sanitization & CSS injection protection", async () => {
    const token = "secret123";
    const env = createMockEnv({ ADMIN_TOKEN: token });

    const injectionPayload = {
      bannerBottom: "0px; position: fixed; background: red;",
      bannerBorderWidth: "expression(alert(1))",
      bannerAlignment: "invalid_alignment",
      desktopActionLayout: "grid",
      mobileActionLayout: "flex",
      overlayColor: "red; background: url('https://evil.com')",
      overlayOpacity: 5.5,
      modalMaxWidth: "<script>alert(1)</script>"
    };

    const postReq = new Request("https://niluferormanli.com/api/admin/consent", {
      method: "POST",
      headers: {
        "Host": "niluferormanli.com",
        "Authorization": "Bearer secret123",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        content: {},
        visual: injectionPayload
      })
    });

    const res = await adminConsentPost(createMockContext(postReq, env));
    assert.equal(res.status, 200);
    const body = await res.json();
    const v = body.consent.visual;

    // Semicolon/CSS injection rejected -> sanitized to safe defaults
    assert.equal(v.bannerBottom, "0px");
    assert.equal(v.bannerBorderWidth, "1px");
    assert.equal(v.overlayColor, "#000000");
    assert.equal(v.modalMaxWidth, "540px");
    // Enums safely fall back
    assert.equal(v.bannerAlignment, "left");
    assert.equal(v.desktopActionLayout, "horizontal");
    assert.equal(v.mobileActionLayout, "stacked");
    // Opacity clamped to 1
    assert.equal(v.overlayOpacity, "1");
  });

  test("18. Backwards compatibility for configs without new tokens", () => {
    // Config without any new tokens
    const legacyConfig = {
      content: { bannerTitle: "Legacy Title" },
      visual: {
        bannerBg: "#111111",
        textColor: "#ffffff"
      }
    };

    const resolved = resolveConsentConfig(legacyConfig);
    assert.equal(resolved.content.bannerTitle, "Legacy Title");
    assert.equal(resolved.visual.bannerBg, "#111111");
    // Fallback defaults present for all new tokens
    assert.equal(resolved.visual.bannerBottom, DEFAULT_CONSENT_CONFIG.visual.bannerBottom);
    assert.equal(resolved.visual.bannerBorderWidth, DEFAULT_CONSENT_CONFIG.visual.bannerBorderWidth);
    assert.equal(resolved.visual.bannerAlignment, "left");
    assert.equal(resolved.visual.desktopActionLayout, "horizontal");
    assert.equal(resolved.visual.mobileActionLayout, "stacked");
    assert.equal(resolved.visual.btnPaddingX, DEFAULT_CONSENT_CONFIG.visual.btnPaddingX);
    assert.equal(resolved.visual.modalMaxWidth, DEFAULT_CONSENT_CONFIG.visual.modalMaxWidth);
    assert.equal(resolved.visual.cardBg, DEFAULT_CONSENT_CONFIG.visual.cardBg);
    assert.equal(resolved.visual.overlayColor, DEFAULT_CONSENT_CONFIG.visual.overlayColor);
    assert.equal(resolved.visual.closeColor, DEFAULT_CONSENT_CONFIG.visual.closeColor);
    assert.equal(resolved.visual.checkboxSize, DEFAULT_CONSENT_CONFIG.visual.checkboxSize);
  });

  test("19. formatOverlayBg formats hex, rgb, rgba and clamps opacity safely", () => {
    // Hex 3-digit
    assert.equal(formatOverlayBg("#000", 0.5), "rgba(0, 0, 0, 0.5)");
    assert.equal(formatOverlayBg("#fff", 0.8), "rgba(255, 255, 255, 0.8)");
    // Hex 6-digit
    assert.equal(formatOverlayBg("#111827", 0.9), "rgba(17, 24, 39, 0.9)");
    // rgb()
    assert.equal(formatOverlayBg("rgb(24, 24, 27)", 0.72), "rgba(24, 24, 27, 0.72)");
    // rgba()
    assert.equal(formatOverlayBg("rgba(10, 10, 10, 0.85)", 0.5), "rgba(10, 10, 10, 0.85)");
    // Fallback
    assert.equal(formatOverlayBg("", 0.72), "rgba(0, 0, 0, 0.72)");
  });

  test("20. CSS variables generation and responsive preview styling", () => {
    const cssVars = getConsentCssVariables({
      bannerAlignment: "center",
      desktopActionLayout: "stacked",
      mobileActionLayout: "horizontal",
      modalMaxWidth: "650px",
      cardBg: "rgba(255,255,255,0.04)",
      overlayColor: "#000000",
      overlayOpacity: "0.8"
    });

    assert.ok(cssVars.includes("--cl-consent-content-align: center;"));
    assert.ok(cssVars.includes("--cl-consent-desktop-action-direction: column;"));
    assert.ok(cssVars.includes("--cl-consent-desktop-action-align: stretch;"));
    assert.ok(cssVars.includes("--cl-consent-mobile-action-direction: row;"));
    assert.ok(cssVars.includes("--cl-consent-mobile-action-align: center;"));
    assert.ok(cssVars.includes("--cl-consent-modal-max-width: 650px;"));
    assert.ok(cssVars.includes("--cl-consent-card-bg: rgba(255,255,255,0.04);"));
    assert.ok(cssVars.includes("--cl-consent-overlay-bg: rgba(0, 0, 0, 0.8);"));

    // Verify CONSENT_CSS responsive media query and preview stage overrides
    assert.ok(CONSENT_CSS.includes("@media (max-width: 640px)"));
    assert.ok(CONSENT_CSS.includes(".cl-consent-preview-stage"));
    assert.ok(CONSENT_CSS.includes(".cl-consent-preview-stage.cl-is-mobile"));
  });

  test("21. Studio Panel admin renderer parity: CONSENT_CSS injected, all 7 groups and viewport toggles exist", () => {
    const html = renderAdmin({ branch: "main", sha: "abcdef1" });

    // CSS Parity: CONSENT_CSS injected into studio panel style
    assert.ok(html.includes(".cl-consent-banner{position:fixed"));
    assert.ok(html.includes(".cl-consent-preview-stage"));

    // Subpane and groups in DOM
    assert.ok(html.includes('id="subpane-consent-appearance"'));
    assert.ok(html.includes('id="consent-vis-bannerAlignment"'));
    assert.ok(html.includes('id="consent-vis-desktopActionLayout"'));
    assert.ok(html.includes('id="consent-vis-bannerBottom"'));
    assert.ok(html.includes('id="consent-vis-btnMinHeight"'));
    assert.ok(html.includes('id="consent-vis-modalMaxWidth"'));
    assert.ok(html.includes('id="consent-vis-cardBg"'));
    assert.ok(html.includes('id="consent-vis-overlayColor"'));
    assert.ok(html.includes('id="consent-vis-closeColor"'));
    assert.ok(html.includes('id="consent-vis-checkboxSize"'));
    assert.ok(html.includes('id="consent-vis-mobileMaxWidth"'));
    assert.ok(html.includes('id="consent-vis-mobileActionLayout"'));

    // Preview viewport controls
    assert.ok(html.includes('id="preview-viewport-desktop"'));
    assert.ok(html.includes('id="preview-viewport-mobile"'));
    assert.ok(html.includes('id="consent-preview-viewport"'));
    assert.ok(html.includes('id="consent-preview-canvas"'));

    // JS Controller functions present
    assert.ok(html.includes("setConsentPreviewViewport"));
    assert.ok(html.includes("setConsentPreviewMode"));
    assert.ok(html.includes("updateConsentPreview"));
    assert.ok(html.includes("initConsentLiveListeners"));
  });
});
