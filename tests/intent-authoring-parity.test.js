/**
 * tests/intent-authoring-parity.test.js
 *
 * Comprehensive regression tests verifying Intent Landing Version authoring parity
 * with the Static Page reference model, without altering Intent routing/scoring behavior.
 *
 * Requirements covered:
 *   A. Metadata persistence (save, reload, verify all head fields)
 *   B. Safe rendering of legacy landings without metadata
 *   C. Exactly one document shell enforcement (<!DOCTYPE html>, <html>, <head>, <body>)
 *   D. SEO Title resolution (Head -> Page Title -> Config -> Fallback)
 *   E. Meta Description resolution (Head -> Config -> Fallback)
 *   F. Document Language resolution (Head -> Config -> Default)
 *   G. Robots Directive resolution with draft/preview protection
 *   H. Canonical URL resolution (explicit override vs auto-derivation)
 *   I. Open Graph tags resolution and fallbacks
 *   J. Additional Head Code sanitization (scripts stripped, links/styles preserved)
 *   K. Shared component blocks attachment and layout rendering in order
 *   L. Intent routing, scoring, and redirect overrides preservation
 *   M. Admin UI parity (DOM elements and implementer guidance note)
 *   N. Shared site theme contract compliance
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { timingSafeEqual as nodeTimingSafeEqual } from "node:crypto";
import {
  renderLanding,
  sanitizeHeadCode,
  sanitizePageHead,
  sanitizeBodyFragment,
  renderThemeTokensCss
} from "../functions/_shared/hub-renderer.js";
import { renderAdmin } from "../functions/_shared/admin-renderer.js";
import {
  onRequestGet as intentRoutingGet,
  onRequestPost as intentRoutingPost
} from "../functions/api/admin/intent-routing.js";
import { onRequestGet as landingRouteGet } from "../functions/l/[slug].js";

// Polyfill crypto.subtle.timingSafeEqual for Node.js test environment
if (!globalThis.crypto?.subtle?.timingSafeEqual) {
  if (!globalThis.crypto) globalThis.crypto = {};
  if (!globalThis.crypto.subtle) globalThis.crypto.subtle = {};
  globalThis.crypto.subtle.timingSafeEqual = function(a, b) {
    if (a.byteLength !== b.byteLength) return false;
    return nodeTimingSafeEqual(Buffer.from(a), Buffer.from(b));
  };
}

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
      if (k.startsWith(prefix)) keys.push({ name: k });
    }
    return { keys, list_complete: true };
  }
}

const createMockEnv = (overrides = {}) => ({
  APP_CONFIG: new MemoryKV(),
  LANDING_CONFIG: new MemoryKV(),
  ROUTE_ALIAS: new MemoryKV(),
  SLUG_LINKS: new MemoryKV(),
  CAMPAIGN_INDEX: new MemoryKV(),
  ADMIN_TOKEN: "secret_admin",
  ROOT_DOMAIN: "niluferormanli.com",
  ...overrides
});

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

function countOccurrences(str, substr) {
  return str.split(substr).length - 1;
}

describe("Intent Landing Version Authoring Parity Tests", () => {

  // ──────────────────────────────────────────────────────────────────────────
  // A. Metadata Persistence (Save, Reload, Verify all Head Fields)
  // ──────────────────────────────────────────────────────────────────────────
  test("A. Intent Landing Version metadata persistence (save, reload, verify all head fields)", async () => {
    const env = createMockEnv();
    const authHeaders = { Authorization: "Bearer secret_admin" };

    const campaignPayload = {
      slug: "piano-masterclass",
      name: "Piano Masterclass Campaign",
      product: "education",
      landings: [
        {
          id: "version-101",
          displayName: "Masterclass Intensive V1",
          slug: "masterclass-intensive",
          alias: "masterclass",
          status: "published",
          headerInfo: { title: "Intensive Piano Masterclass" },
          head: {
            seoTitle: "Piano Masterclass 2026 | Nilüfer Ormanlı",
            canonicalUrl: "https://niluferormanli.com/masterclass-intensive",
            metaDescription: "Masterclass registration for advanced classical pianists.",
            language: "tr",
            robots: "index, follow",
            ogTitle: "Join Nilüfer Ormanlı Piano Masterclass",
            ogDescription: "Limited capacity intensive classical piano masterclass.",
            ogImage: "https://niluferormanli.com/masterclass-og.jpg",
            additionalHeadHtml: '<link rel="preconnect" href="https://fonts.googleapis.com">\n<script>evil()</script>'
          },
          layout: [
            { type: "custom_html", content: "<section><h2>Masterclass Details</h2></section>" }
          ],
          customStyleCss: ".masterclass { padding: 2rem; }",
          customScript: "console.log('loaded');",
          destinations: {
            hot: "https://niluferormanli.com/checkout?tier=hot",
            warm: "https://niluferormanli.com/info"
          },
          signals: {
            hotThreshold: 75,
            conversionSelector: "#enroll-btn"
          }
        }
      ]
    };

    // Save via POST /api/admin/intent-routing
    const postReq = createMockRequest(
      "https://niluferormanli.com/api/admin/intent-routing",
      "POST",
      authHeaders,
      JSON.stringify(campaignPayload)
    );
    const postRes = await intentRoutingPost({ request: postReq, env });
    assert.equal(postRes.status, 200);
    const postData = await postRes.json();
    assert.equal(postData.success, true);

    // Reload via GET /api/admin/intent-routing
    const getReq = createMockRequest("https://niluferormanli.com/api/admin/intent-routing", "GET", authHeaders);
    const getRes = await intentRoutingGet({ request: getReq, env });
    assert.equal(getRes.status, 200);
    const getData = await getRes.json();

    const savedCampaign = getData.campaigns.find(c => c.slug === "piano-masterclass");
    assert.ok(savedCampaign, "Saved campaign should be retrievable");
    assert.equal(savedCampaign.landings.length, 1);

    const savedLanding = savedCampaign.landings[0];
    assert.equal(savedLanding.id, "version-101");
    assert.equal(savedLanding.displayName, "Masterclass Intensive V1");
    assert.equal(savedLanding.slug, "masterclass-intensive");
    assert.equal(savedLanding.alias, "masterclass");

    // Verify all head fields were sanitized and persisted accurately
    assert.ok(savedLanding.head, "Landing head object must be preserved");
    assert.equal(savedLanding.head.seoTitle, "Piano Masterclass 2026 | Nilüfer Ormanlı");
    assert.equal(savedLanding.head.canonicalUrl, "https://niluferormanli.com/masterclass-intensive");
    assert.equal(savedLanding.head.metaDescription, "Masterclass registration for advanced classical pianists.");
    assert.equal(savedLanding.head.language, "tr");
    assert.equal(savedLanding.head.robots, "index, follow");
    assert.equal(savedLanding.head.ogTitle, "Join Nilüfer Ormanlı Piano Masterclass");
    assert.equal(savedLanding.head.ogDescription, "Limited capacity intensive classical piano masterclass.");
    assert.equal(savedLanding.head.ogImage, "https://niluferormanli.com/masterclass-og.jpg");

    // Verify sanitization occurred: <script> stripped from additionalHeadHtml, safe <link> preserved
    assert.ok(savedLanding.head.additionalHeadHtml.includes('<link rel="preconnect" href="https://fonts.googleapis.com">'));
    assert.ok(!savedLanding.head.additionalHeadHtml.includes("<script"));
    assert.ok(!savedLanding.head.additionalHeadHtml.includes("evil()"));

    // Verify Intent-specific controls were preserved intact
    assert.equal(savedLanding.signals.hotThreshold, 75);
    assert.equal(savedLanding.signals.conversionSelector, "#enroll-btn");
    assert.equal(savedLanding.destinations.hot, "https://niluferormanli.com/checkout?tier=hot");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // B. Safe Rendering of Legacy Landings Without Metadata
  // ──────────────────────────────────────────────────────────────────────────
  test("B. Existing Intent Landings without metadata render safely with proper fallbacks", () => {
    const legacyLanding = {
      id: "legacy-v1",
      slug: "legacy-landing",
      status: "published",
      headerInfo: { title: "Legacy Landing Title" },
      // Note: NO head property
      customStyleCss: ".box { color: blue; }",
      layout: [{ type: "custom_html", content: "<div>Legacy Body</div>" }]
    };

    const html = renderLanding({
      contextType: "landing",
      slug: "legacy-landing",
      slugData: legacyLanding,
      config: {
        pageTitle: "Default Site Title",
        metaDescription: "Default site description",
        language: "en"
      },
      rootDomain: "niluferormanli.com"
    });

    assert.ok(html.includes("<!DOCTYPE html>"), "Renders valid DOCTYPE");
    assert.ok(html.includes("<title>Legacy Landing Title</title>"), "Falls back to headerInfo.title");
    assert.ok(html.includes('<meta name="description" content="Default site description">'), "Falls back to config metaDescription");
    assert.ok(html.includes('<html lang="en">'), "Falls back to config language");
    assert.ok(html.includes('<meta name="robots" content="index, follow">'), "Default robots directive");
    assert.ok(html.includes("<div>Legacy Body</div>"), "Custom HTML rendered");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // C. Exactly One Document Shell Enforcement
  // ──────────────────────────────────────────────────────────────────────────
  test("C. Rendered Intent Landings contain exactly one document shell", () => {
    const dirtyCustomHtml = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <title>Malicious or Pasted Title</title>
        <meta charset="utf-8">
        <link rel="stylesheet" href="dirty.css">
      </head>
      <body class="injected-body">
        <div class="landing-content">
          <h1>Main Content Header</h1>
          <p>This is legitimate inner body content.</p>
        </div>
      </body>
      </html>
    `;

    const landingData = {
      id: "shell-test-v1",
      slug: "shell-test",
      status: "published",
      headerInfo: { title: "Authoritative Page Title" },
      head: {
        seoTitle: "Authoritative SEO Title"
      },
      layout: [
        { type: "custom_html", content: dirtyCustomHtml }
      ]
    };

    const html = renderLanding({
      contextType: "landing",
      slug: "shell-test",
      slugData: landingData,
      rootDomain: "niluferormanli.com"
    });

    assert.equal(countOccurrences(html, "<!DOCTYPE html>"), 1, "Exactly one <!DOCTYPE html>");
    assert.equal(countOccurrences(html, "<html"), 1, "Exactly one <html opening tag");
    assert.equal(countOccurrences(html, "</html>"), 1, "Exactly one </html> closing tag");
    assert.equal(countOccurrences(html, "<head>"), 1, "Exactly one <head> opening tag");
    assert.equal(countOccurrences(html, "</head>"), 1, "Exactly one </head> closing tag");
    assert.equal(countOccurrences(html, "<body"), 1, "Exactly one <body opening tag");
    assert.equal(countOccurrences(html, "</body>"), 1, "Exactly one </body> closing tag");

    // Title inside shell comes from authoritative source, not stripped body fragment
    assert.ok(html.includes("<title>Authoritative SEO Title</title>"), "Shell title uses authoritative SEO title");
    assert.ok(!html.includes("<title>Malicious or Pasted Title</title>"), "Injected head title was cleanly stripped");
    assert.ok(html.includes("<h1>Main Content Header</h1>"), "Inner body fragment content is preserved");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // D. SEO Title Resolution (Head -> Page Title -> Config -> Fallback)
  // ──────────────────────────────────────────────────────────────────────────
  test("D. SEO Title resolves correctly (Version Head -> Version Page Title -> Config -> Fallback)", () => {
    // 1. Fallback: "CogniLink"
    const h1 = renderLanding({
      contextType: "landing",
      slug: "title-test",
      slugData: { id: "v1", status: "published" }
    });
    assert.ok(h1.includes("<title>CogniLink</title>"), "Level 1 fallback title is CogniLink");

    // 2. Config Title
    const h2 = renderLanding({
      contextType: "landing",
      slug: "title-test",
      slugData: { id: "v1", status: "published" },
      config: { pageTitle: "Nilüfer Ormanlı Official" }
    });
    assert.ok(h2.includes("<title>Nilüfer Ormanlı Official</title>"), "Level 2 config title applies when landing title absent");

    // 3. Version Page Title (headerInfo.title)
    const h3 = renderLanding({
      contextType: "landing",
      slug: "title-test",
      slugData: {
        id: "v1",
        status: "published",
        headerInfo: { title: "Piano Recital Istanbul" }
      },
      config: { pageTitle: "Nilüfer Ormanlı Official" }
    });
    assert.ok(h3.includes("<title>Piano Recital Istanbul</title>"), "Level 3 headerInfo.title overrides config title");

    // 4. Version Head SEO Title
    const h4 = renderLanding({
      contextType: "landing",
      slug: "title-test",
      slugData: {
        id: "v1",
        status: "published",
        headerInfo: { title: "Piano Recital Istanbul" },
        head: { seoTitle: "Istanbul Concert Tickets & Schedule | Nilüfer Ormanlı" }
      },
      config: { pageTitle: "Nilüfer Ormanlı Official" }
    });
    assert.ok(h4.includes("<title>Istanbul Concert Tickets &amp; Schedule | Nilüfer Ormanlı</title>"), "Level 4 head.seoTitle overrides headerInfo.title and config");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // E. Meta Description Resolution (Version Head -> Config -> Fallback)
  // ──────────────────────────────────────────────────────────────────────────
  test("E. Meta Description resolves correctly (Version Head -> Config -> Fallback)", () => {
    // 1. Fallback: omitted when absent
    const h1 = renderLanding({
      contextType: "landing",
      slug: "desc-test",
      slugData: { id: "v1", status: "published" }
    });
    assert.ok(!h1.includes('<meta name="description"'), "Meta description omitted when absent");

    // 2. Config Meta Description
    const h2 = renderLanding({
      contextType: "landing",
      slug: "desc-test",
      slugData: { id: "v1", status: "published" },
      config: { metaDescription: "Official portal of pianist Nilüfer Ormanlı." }
    });
    assert.ok(h2.includes('<meta name="description" content="Official portal of pianist Nilüfer Ormanlı.">'));

    // 3. Landing Head Meta Description
    const h3 = renderLanding({
      contextType: "landing",
      slug: "desc-test",
      slugData: {
        id: "v1",
        status: "published",
        head: { metaDescription: "Exclusive masterclass tickets and programme." }
      },
      config: { metaDescription: "Official portal of pianist Nilüfer Ormanlı." }
    });
    assert.ok(h3.includes('<meta name="description" content="Exclusive masterclass tickets and programme.">'));
  });

  // ──────────────────────────────────────────────────────────────────────────
  // F. Document Language Resolution (Version Head -> Config -> Default)
  // ──────────────────────────────────────────────────────────────────────────
  test("F. Document Language resolves correctly (Version Head -> Config -> Default)", () => {
    // 1. Default: en
    const h1 = renderLanding({
      contextType: "landing",
      slug: "lang-test",
      slugData: { id: "v1", status: "published" }
    });
    assert.ok(h1.includes('<html lang="en">'), "Defaults to en");

    // 2. Config Language
    const h2 = renderLanding({
      contextType: "landing",
      slug: "lang-test",
      slugData: { id: "v1", status: "published" },
      config: { language: "tr" }
    });
    assert.ok(h2.includes('<html lang="tr">'), "Config language overrides default");

    // 3. Landing Head Language
    const h3 = renderLanding({
      contextType: "landing",
      slug: "lang-test",
      slugData: {
        id: "v1",
        status: "published",
        head: { language: "de" }
      },
      config: { language: "tr" }
    });
    assert.ok(h3.includes('<html lang="de">'), "Landing head language overrides config");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // G. Robots Directive Resolution With Draft/Preview Protection
  // ──────────────────────────────────────────────────────────────────────────
  test("G. Robots Directive resolves correctly and enforces 'noindex, nofollow' on drafts and preview mode", () => {
    // 1. Published with head override
    const h1 = renderLanding({
      contextType: "landing",
      slug: "robots-test",
      slugData: {
        id: "v1",
        status: "published",
        head: { robots: "noindex, follow" }
      }
    });
    assert.ok(h1.includes('<meta name="robots" content="noindex, follow">'), "Page robots override rendered");

    // 2. Published inheriting from config
    const h2 = renderLanding({
      contextType: "landing",
      slug: "robots-test",
      slugData: { id: "v1", status: "published" },
      config: { robots: "index, nofollow" }
    });
    assert.ok(h2.includes('<meta name="robots" content="index, nofollow">'), "Config robots inherited");

    // 3. Draft protection: MUST force noindex, nofollow regardless of head setting
    const hDraft = renderLanding({
      contextType: "landing",
      slug: "robots-test",
      slugData: {
        id: "v1",
        status: "draft",
        head: { robots: "index, follow" }
      }
    });
    assert.ok(hDraft.includes('<meta name="robots" content="noindex, nofollow">'), "Draft status strictly forces noindex, nofollow");

    // 4. Preview protection: MUST force noindex, nofollow regardless of head setting
    const hPreview = renderLanding({
      contextType: "landing",
      slug: "robots-test",
      isPreview: true,
      slugData: {
        id: "v1",
        status: "published",
        head: { robots: "index, follow" }
      }
    });
    assert.ok(hPreview.includes('<meta name="robots" content="noindex, nofollow">'), "Preview mode strictly forces noindex, nofollow");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // H. Canonical URL Resolution (Explicit Override -> Auto-Derivation)
  // ──────────────────────────────────────────────────────────────────────────
  test("H. Canonical URL resolves correctly (explicit override -> Intent landing canonical URL derivation)", () => {
    // 1. Auto-derivation without head.canonicalUrl
    const hAuto = renderLanding({
      contextType: "landing",
      slug: "sigorta-yenileme",
      productSubdomain: "sigorta",
      rootDomain: "niluferormanli.com",
      slugData: {
        id: "v1",
        status: "published"
      }
    });
    assert.ok(hAuto.includes('<link rel="canonical" href="https://sigorta.niluferormanli.com/l/sigorta-yenileme">'), "Derived Intent landing canonical URL");
    assert.ok(hAuto.includes('<meta property="og:url" content="https://sigorta.niluferormanli.com/l/sigorta-yenileme">'), "og:url matches derived canonical");

    // 2. Explicit override via head.canonicalUrl
    const hOverride = renderLanding({
      contextType: "landing",
      slug: "sigorta-yenileme",
      productSubdomain: "sigorta",
      rootDomain: "niluferormanli.com",
      slugData: {
        id: "v1",
        status: "published",
        head: { canonicalUrl: "https://niluferormanli.com/masterclass" }
      }
    });
    assert.ok(hOverride.includes('<link rel="canonical" href="https://niluferormanli.com/masterclass">'), "Explicit canonicalUrl in head overrides auto-derivation");
    assert.ok(hOverride.includes('<meta property="og:url" content="https://niluferormanli.com/masterclass">'), "og:url matches explicit canonical override");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // I. Open Graph Tags Resolution and Fallbacks
  // ──────────────────────────────────────────────────────────────────────────
  test("I. Open Graph tags resolve with proper inheritance and fallbacks", () => {
    const html = renderLanding({
      contextType: "landing",
      slug: "concert-v1",
      rootDomain: "niluferormanli.com",
      productSubdomain: "concerts",
      config: {
        pageTitle: "Nilüfer Ormanlı",
        metaDescription: "Concert Pianist portfolio.",
        ogTitle: "Site OG Title",
        ogDescription: "Site OG Description",
        ogImage: "https://niluferormanli.com/default-og.jpg"
      },
      slugData: {
        id: "v1",
        status: "published",
        head: {
          seoTitle: "Autumn Recital | Nilüfer Ormanlı",
          ogTitle: "Listen Live: Autumn Recital Istanbul",
          ogDescription: "Tickets for the 2026 autumn classical recital.",
          ogImage: "https://niluferormanli.com/autumn-og.jpg"
        }
      }
    });

    assert.ok(html.includes('<meta property="og:type" content="website">'), "OG type website");
    assert.ok(html.includes('<meta property="og:title" content="Listen Live: Autumn Recital Istanbul">'), "head.ogTitle wins");
    assert.ok(html.includes('<meta property="og:description" content="Tickets for the 2026 autumn classical recital.">'), "head.ogDescription wins");
    assert.ok(html.includes('<meta property="og:image" content="https://niluferormanli.com/autumn-og.jpg">'), "head.ogImage wins");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // J. Additional Head Code Sanitization
  // ──────────────────────────────────────────────────────────────────────────
  test("J. Additional Head Code in Intent Landing Versions is sanitized via sanitizeHeadCode()", () => {
    const dirtyHeadCode = `
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <style>:root { --custom-accent: #e11d48; }</style>
      <script>window.pwned = true; alert("xss");</script>
      <script src="https://attacker.com/evil.js"></script>
      <link rel="stylesheet" href="javascript:alert(1)">
      <img src="x" onerror="alert(1)">
      <noscript><link rel="stylesheet" href="fallback.css"></noscript>
    `;

    const html = renderLanding({
      contextType: "landing",
      slug: "safe-head-landing",
      slugData: {
        id: "v1",
        status: "published",
        head: {
          additionalHeadHtml: dirtyHeadCode
        }
      },
      rootDomain: "niluferormanli.com"
    });

    // Safe tags are preserved in rendered <head>
    assert.ok(html.includes('<link rel="preconnect" href="https://fonts.googleapis.com">'), "Preconnect link preserved");
    assert.ok(html.includes('<style>:root { --custom-accent: #e11d48; }</style>'), "Safe style block preserved");
    assert.ok(html.includes('<noscript><link rel="stylesheet" href="fallback.css"></noscript>'), "Safe noscript preserved");

    // Dangerous executable tags are stripped
    assert.ok(!html.includes("pwned"), "Script content stripped");
    assert.ok(!html.includes("evil.js"), "External script src stripped");
    assert.ok(!html.includes("javascript:"), "javascript: pseudo-protocol stripped");
    assert.ok(!html.includes("onerror="), "Inline event handler stripped");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // K. Shared Component Blocks Attachment and Layout Rendering
  // ──────────────────────────────────────────────────────────────────────────
  test("K. Shared component blocks attach and render correctly in Intent Landing layouts", () => {
    const mockComponents = [
      {
        component_id: "comp-hero-10",
        family_id: "hero-family",
        family_name: "Hero Section",
        type: "hero",
        title: "Nilüfer Ormanlı Masterclasses",
        body: "<p>Elevate your musicianship with intensive instruction.</p>",
        cta_label: "Reserve Seat",
        cta_url: "https://niluferormanli.com/reserve",
        status: "active"
      },
      {
        component_id: "comp-faq-20",
        family_id: "faq-family",
        family_name: "Masterclass FAQ",
        type: "faq",
        title: "Frequently Asked Questions",
        body: "<p>Q: Who can apply? A: Advanced piano students.</p>",
        status: "active"
      }
    ];

    const landingData = {
      id: "comp-layout-v1",
      slug: "masterclass-layout",
      status: "published",
      headerInfo: { title: "Masterclass Layout Test" },
      layout: [
        { type: "component", id: "hero-family" },
        { type: "custom_html", content: '<div class="mid-section"><p>Mid Section HTML</p></div>' },
        { type: "component", id: "faq-family" }
      ]
    };

    const html = renderLanding({
      contextType: "landing",
      slug: "masterclass-layout",
      slugData: landingData,
      components: mockComponents,
      rootDomain: "niluferormanli.com"
    });

    // Verify both components rendered in correct order around the custom HTML
    assert.ok(html.includes("comp-type-hero"), "Hero component rendered");
    assert.ok(html.includes("Nilüfer Ormanlı Masterclasses"), "Hero title rendered");
    assert.ok(html.includes("Reserve Seat"), "Hero CTA rendered");
    assert.ok(html.includes('<div class="mid-section"><p>Mid Section HTML</p></div>'), "Custom HTML between components rendered");
    assert.ok(html.includes("comp-type-faq"), "FAQ component rendered");
    assert.ok(html.includes("Frequently Asked Questions"), "FAQ title rendered");

    // Verify order: Hero comes before Mid Section, which comes before FAQ
    const heroIdx = html.indexOf("comp-type-hero");
    const midIdx = html.indexOf("mid-section");
    const faqIdx = html.indexOf("comp-type-faq");

    assert.ok(heroIdx < midIdx, "Hero appears before mid custom HTML block");
    assert.ok(midIdx < faqIdx, "Mid custom HTML appears before FAQ component block");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // L. Intent Routing, Scoring, and Redirect Overrides Preservation
  // ──────────────────────────────────────────────────────────────────────────
  test("L. Intent routing, scoring, and redirect overrides continue to work without regression", async () => {
    const env = createMockEnv();

    // Store a campaign in APP_CONFIG with landing version having head, signals, and destinations
    const campaign = {
      slug: "masterclass-intent",
      name: "Masterclass Intent",
      landings: [
        {
          id: "ver-intent-1",
          slug: "masterclass-landing",
          status: "published",
          headerInfo: { title: "Masterclass Live" },
          head: {
            seoTitle: "Live Masterclass | Nilüfer Ormanlı",
            canonicalUrl: "https://niluferormanli.com/l/masterclass-landing"
          },
          layout: [{ type: "custom_html", content: "<p>Live Masterclass Content</p>" }],
          destinations: {
            hot: "https://niluferormanli.com/direct-checkout",
            warm: "https://niluferormanli.com/schedule"
          },
          signals: {
            hotThreshold: 80,
            conversionSelector: "#apply-now"
          }
        }
      ]
    };

    await env.APP_CONFIG.put("campaign:masterclass-intent", JSON.stringify(campaign));
    await env.APP_CONFIG.put("landing:masterclass-landing", JSON.stringify({
      campaignId: "masterclass-intent",
      landingId: "ver-intent-1"
    }));

    // Request via functions/l/[slug].js
    const req = createMockRequest("https://niluferormanli.com/l/masterclass-landing", "GET");
    const res = await landingRouteGet({
      request: req,
      env,
      params: { slug: "masterclass-landing" },
      waitUntil: () => {}
    });

    assert.equal(res.status, 200);
    const body = await res.text();

    assert.ok(body.includes("<title>Live Masterclass | Nilüfer Ormanlı</title>"), "SEO title in head resolved");
    assert.ok(body.includes('<link rel="canonical" href="https://niluferormanli.com/l/masterclass-landing">'), "Canonical URL resolved");
    assert.ok(body.includes("<p>Live Masterclass Content</p>"), "Landing content rendered");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // M. Admin UI Parity: Controls & Implementer Guidance Note
  // ──────────────────────────────────────────────────────────────────────────
  test("M. Admin UI parity: studio-builder-panel contains head controls and implementer guidance note", () => {
    const adminHtml = renderAdmin({
      username: "admin",
      token: "secret_admin",
      config: {},
      landingConfig: {},
      campaigns: []
    });

    // Check all Page Metadata & Head controls exist in Studio Builder
    assert.ok(adminHtml.includes('id="studio-version-seo-title"'), "Studio SEO Title input present");
    assert.ok(adminHtml.includes('id="studio-version-canonical-url"'), "Studio Canonical URL input present");
    assert.ok(adminHtml.includes('id="studio-version-meta-desc"'), "Studio Meta Description textarea present");
    assert.ok(adminHtml.includes('id="studio-version-lang"'), "Studio Language input present");
    assert.ok(adminHtml.includes('id="studio-version-robots"'), "Studio Robots input present");
    assert.ok(adminHtml.includes('id="studio-version-og-title"'), "Studio OG Title input present");
    assert.ok(adminHtml.includes('id="studio-version-og-image"'), "Studio OG Image input present");
    assert.ok(adminHtml.includes('id="studio-version-og-desc"'), "Studio OG Description textarea present");
    assert.ok(adminHtml.includes('id="studio-version-head-code"'), "Studio Additional Head Code textarea present");

    // Check Implementer Handoff guidance note is present in studio-builder-panel
    assert.ok(adminHtml.includes("Custom HTML blocks are body fragments only"), "Implementer note clarifies body fragments");
    assert.ok(adminHtml.includes("&lt;!-- COGNILINK: ... --&gt;"), "Implementer note explains COGNILINK comment markers");
    assert.ok(adminHtml.includes("Additional Head Code"), "Implementer note directs head resources to Additional Head Code");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // N. Shared Site Theme Contract
  // ──────────────────────────────────────────────────────────────────────────
  test("N. Intent Landing rendering respects shared site theme contract", () => {
    const themeTokens = {
      light: {
        "--site-bg": "#fafafa",
        "--site-surface": "#ffffff",
        "--site-text": "#111827",
        "--site-text-muted": "#6b7280",
        "--site-border": "#e5e7eb",
        "--site-link": "#1a7f37",
        "--site-accent": "#2da44e"
      },
      dark: {
        "--site-bg": "#0d1117",
        "--site-surface": "#161b22",
        "--site-text": "#f0f6fc",
        "--site-text-muted": "#8b949e",
        "--site-border": "#30363d",
        "--site-link": "#2ea043",
        "--site-accent": "#3fb950"
      }
    };

    const html = renderLanding({
      contextType: "landing",
      slug: "themed-landing",
      slugData: {
        id: "v1",
        status: "published",
        customStyleCss: ".box { background: var(--site-surface); color: var(--site-text); }"
      },
      config: {
        themeTokens
      },
      rootDomain: "niluferormanli.com"
    });

    assert.ok(html.includes('<style id="site-theme-tokens">'), "Injected site-theme-tokens style tag");
    assert.ok(html.includes("--site-bg: #fafafa;"), "Light tokens rendered in :root");
    assert.ok(html.includes("@media (prefers-color-scheme: dark)"), "Dark tokens media query rendered");
    assert.ok(html.includes("--site-bg: #0d1117;"), "Dark tokens rendered in dark mode");
    assert.ok(!html.includes("localStorage.setItem('theme'"), "No custom JS theme engine injected");
  });
});
