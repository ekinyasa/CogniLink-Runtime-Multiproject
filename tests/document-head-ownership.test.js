import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { timingSafeEqual as nodeTimingSafeEqual } from "node:crypto";
import { renderHub, renderLanding, sanitizeHeadCode, sanitizeBodyFragment, renderThemeTokensCss } from "../functions/_shared/hub-renderer.js";
import { renderAdmin } from "../functions/_shared/admin-renderer.js";
import { onRequestGet as configGet, onRequestPut as configPut } from "../functions/api/config.js";
import {
  onRequestGet as staticPagesGet,
  onRequestPost as staticPagesPost
} from "../functions/api/admin/static-pages.js";

// Polyfill crypto.subtle.timingSafeEqual for Node.js
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

describe("Document + Head Ownership & 3-Layer Inheritance Tests", () => {

  test("1. Single Document Shell in rendered HTML (normal and 404)", () => {
    const normalHtml = renderLanding({
      contextType: "static",
      slug: "home",
      rootDomain: "niluferormanli.com"
    });

    assert.equal(countOccurrences(normalHtml, "<!DOCTYPE html>"), 1, "Exactly one <!DOCTYPE html>");
    assert.equal(countOccurrences(normalHtml, "<html"), 1, "Exactly one <html opening tag");
    assert.equal(countOccurrences(normalHtml, "</html>"), 1, "Exactly one </html> closing tag");
    assert.equal(countOccurrences(normalHtml, "<head>"), 1, "Exactly one <head> opening tag");
    assert.equal(countOccurrences(normalHtml, "</head>"), 1, "Exactly one </head> closing tag");
    assert.equal(countOccurrences(normalHtml, "<body"), 1, "Exactly one <body opening tag");
    assert.equal(countOccurrences(normalHtml, "</body>"), 1, "Exactly one </body> closing tag");

    const notFoundHtml = renderLanding({
      notFound: true,
      rootDomain: "niluferormanli.com"
    });

    assert.equal(countOccurrences(notFoundHtml, "<!DOCTYPE html>"), 1, "404 has exactly one <!DOCTYPE html>");
    assert.equal(countOccurrences(notFoundHtml, "<html"), 1, "404 has exactly one <html opening tag");
    assert.equal(countOccurrences(notFoundHtml, "</html>"), 1, "404 has exactly one </html> closing tag");
    assert.equal(countOccurrences(notFoundHtml, "<head>"), 1, "404 has exactly one <head> opening tag");
    assert.equal(countOccurrences(notFoundHtml, "</head>"), 1, "404 has exactly one </head> closing tag");
    assert.equal(countOccurrences(notFoundHtml, "<body"), 1, "404 has exactly one <body opening tag");
    assert.equal(countOccurrences(notFoundHtml, "</body>"), 1, "404 has exactly one </body> closing tag");
    assert.ok(!notFoundHtml.includes("</style>\n</head>"), "404 must not have rogue unmatched </style> tag");
  });

  test("2. Title 3-layer resolution (Page SEO > Page Title > Config Title > Fallback)", () => {
    // Level 1: Fallback
    const h1 = renderLanding({ contextType: "static", slug: "about" });
    assert.ok(h1.includes("<title>CogniLink</title>"), "Fallback title is CogniLink");

    // Level 2: Config Title
    const h2 = renderLanding({
      contextType: "static",
      slug: "about",
      config: { pageTitle: "Nilüfer Ormanlı Official" }
    });
    assert.ok(h2.includes("<title>Nilüfer Ormanlı Official</title>"), "Config title applies when page title absent");

    // Level 3: Page Title
    const h3 = renderLanding({
      contextType: "static",
      slug: "about",
      config: { pageTitle: "Nilüfer Ormanlı Official" },
      slugData: { title: "About Nilüfer" }
    });
    assert.ok(h3.includes("<title>About Nilüfer</title>"), "Page title overrides config title");

    // Level 4: Page SEO Title in head object
    const h4 = renderLanding({
      contextType: "static",
      slug: "about",
      config: { pageTitle: "Nilüfer Ormanlı Official" },
      slugData: {
        title: "About Nilüfer",
        head: { seoTitle: "About Nilüfer Ormanlı | Pianist & Composer" }
      }
    });
    assert.ok(h4.includes("<title>About Nilüfer Ormanlı | Pianist &amp; Composer</title>"), "SEO title overrides page title and config");
  });

  test("3. Document Language 3-layer resolution (Page head.language > Config language > default en)", () => {
    // Default en
    const h1 = renderLanding({ contextType: "static", slug: "home" });
    assert.ok(h1.includes('<html lang="en">'), "Defaults to en");

    // Config default
    const h2 = renderLanding({
      contextType: "static",
      slug: "home",
      config: { language: "tr" }
    });
    assert.ok(h2.includes('<html lang="tr">'), "Config language overrides default");

    // Page-specific override
    const h3 = renderLanding({
      contextType: "static",
      slug: "home",
      config: { language: "tr" },
      slugData: { head: { language: "de" } }
    });
    assert.ok(h3.includes('<html lang="de">'), "Page-specific head language overrides config");
  });

  test("4. Robots Directive resolution and preview/draft safety enforcement", () => {
    // Default published page: index, follow
    const h1 = renderLanding({ contextType: "static", slug: "about" });
    assert.ok(h1.includes('<meta name="robots" content="index, follow">'), "Default is index, follow");

    // Config default
    const h2 = renderLanding({
      contextType: "static",
      slug: "about",
      config: { robots: "index, nofollow" }
    });
    assert.ok(h2.includes('<meta name="robots" content="index, nofollow">'), "Config robots overrides default");

    // Page head override
    const h3 = renderLanding({
      contextType: "static",
      slug: "about",
      config: { robots: "index, nofollow" },
      slugData: { head: { robots: "noindex, follow" } }
    });
    assert.ok(h3.includes('<meta name="robots" content="noindex, follow">'), "Page robots overrides config");

    // Safety: Draft version must be noindex, nofollow
    const hDraft = renderLanding({
      contextType: "static",
      slug: "about",
      slugData: { status: "draft", head: { robots: "index, follow" } }
    });
    assert.ok(hDraft.includes('<meta name="robots" content="noindex, nofollow">'), "Draft status forces noindex, nofollow");

    // Safety: Preview mode must be noindex, nofollow
    const hPreview = renderLanding({
      contextType: "static",
      slug: "about",
      isPreview: true,
      slugData: { head: { robots: "index, follow" } }
    });
    assert.ok(hPreview.includes('<meta name="robots" content="noindex, nofollow">'), "Preview mode forces noindex, nofollow");

    // Safety: 404 must be noindex, nofollow
    const h404 = renderLanding({
      notFound: true,
      config: { robots: "index, follow" }
    });
    assert.ok(h404.includes('<meta name="robots" content="noindex,nofollow">'), "404 forces noindex,nofollow");
  });

  test("5. Canonical URL auto-derivation & explicit override", () => {
    // 1. Root / homepage derivation when static page slug is 'coming-soon': must be https://domain/ (NOT /coming-soon)
    const hHome = renderLanding({
      contextType: "static",
      slug: "coming-soon",
      requestPath: "/",
      rootDomain: "niluferormanli.com"
    });
    assert.ok(hHome.includes('<link rel="canonical" href="https://niluferormanli.com/">'), "Root/home derives root domain URL");
    assert.ok(!hHome.includes('<link rel="canonical" href="https://niluferormanli.com/coming-soon">'), "Root/home must NOT use underlying static slug");
    assert.ok(hHome.includes('<meta property="og:url" content="https://niluferormanli.com/">'), "Root/home og:url matches canonical");

    // 2. Direct request to /coming-soon: must be https://domain/coming-soon
    const hDirect = renderLanding({
      contextType: "static",
      slug: "coming-soon",
      requestPath: "/coming-soon",
      rootDomain: "niluferormanli.com"
    });
    assert.ok(hDirect.includes('<link rel="canonical" href="https://niluferormanli.com/coming-soon">'), "Direct request derives requested path URL");
    assert.ok(hDirect.includes('<meta property="og:url" content="https://niluferormanli.com/coming-soon">'), "Direct request og:url matches canonical");

    // 3. Inner page derivation without requestPath fallback: https://domain/slug
    const hAbout = renderLanding({
      contextType: "static",
      slug: "biography",
      rootDomain: "niluferormanli.com"
    });
    assert.ok(hAbout.includes('<link rel="canonical" href="https://niluferormanli.com/biography">'), "Inner page derives path URL");

    // 4. Canonical Host Normalization (www -> apex when canonicalMode is apex)
    const hWww = renderLanding({
      contextType: "static",
      slug: "coming-soon",
      requestPath: "/",
      requestHost: "www.niluferormanli.com",
      rootDomain: "niluferormanli.com"
    });
    assert.ok(hWww.includes('<link rel="canonical" href="https://niluferormanli.com/">'), "Canonical host normalizes www to apex");

    // 5. Explicit override
    const hOverride = renderLanding({
      contextType: "static",
      slug: "coming-soon",
      requestPath: "/",
      rootDomain: "niluferormanli.com",
      slugData: { head: { canonicalUrl: "https://niluferormanli.com/custom-canonical" } }
    });
    assert.ok(hOverride.includes('<link rel="canonical" href="https://niluferormanli.com/custom-canonical">'), "Explicit canonicalUrl in head overrides auto-derivation");

    // 6. 404 page: canonical is omitted
    const h404 = renderLanding({ notFound: true });
    assert.ok(!h404.includes('<link rel="canonical"'), "404 must omit canonical link");
  });

  test("6. Meta Description and Favicon inheritance", () => {
    // Neither: no meta description, default favicon
    const h1 = renderLanding({ contextType: "static", slug: "page" });
    assert.ok(!h1.includes('<meta name="description"'), "Omitted when not provided");
    assert.ok(h1.includes('<link rel="icon" href="/favicon.svg">'), "Default favicon is /favicon.svg");

    // Site-wide defaults
    const h2 = renderLanding({
      contextType: "static",
      slug: "page",
      config: {
        metaDescription: "Concert pianist Nilüfer Ormanlı official portfolio.",
        faviconUrl: "https://niluferormanli.com/icon.png"
      }
    });
    assert.ok(h2.includes('<meta name="description" content="Concert pianist Nilüfer Ormanlı official portfolio.">'), "Config meta description rendered");
    assert.ok(h2.includes('<link rel="icon" href="https://niluferormanli.com/icon.png">'), "Config favicon rendered");

    // Page-specific overrides
    const h3 = renderLanding({
      contextType: "static",
      slug: "page",
      config: {
        metaDescription: "Concert pianist Nilüfer Ormanlı official portfolio.",
        faviconUrl: "https://niluferormanli.com/icon.png"
      },
      slugData: {
        head: {
          metaDescription: "Discography and recordings of Nilüfer Ormanlı.",
          faviconUrl: "/custom-fav.ico"
        }
      }
    });
    assert.ok(h3.includes('<meta name="description" content="Discography and recordings of Nilüfer Ormanlı.">'), "Page head meta description overrides config");
    assert.ok(h3.includes('<link rel="icon" href="/custom-fav.ico">'), "Page head favicon overrides config");
  });

  test("7. Open Graph metadata tags rendering and precedence", () => {
    const html = renderLanding({
      contextType: "static",
      slug: "discography",
      rootDomain: "niluferormanli.com",
      config: {
        pageTitle: "Nilüfer Ormanlı",
        metaDescription: "Classical music portfolio.",
        ogImage: "https://niluferormanli.com/og-default.jpg"
      },
      slugData: {
        head: {
          seoTitle: "Discography | Nilüfer Ormanlı",
          ogTitle: "Listen to Nilüfer Ormanlı Albums",
          ogDescription: "Complete album catalogue.",
          ogImage: "https://niluferormanli.com/og-disco.jpg"
        }
      }
    });

    assert.ok(html.includes('<meta property="og:type" content="website">'), "OG type is website");
    assert.ok(html.includes('<meta property="og:title" content="Listen to Nilüfer Ormanlı Albums">'), "OG title uses page head.ogTitle override");
    assert.ok(html.includes('<meta property="og:description" content="Complete album catalogue.">'), "OG description uses page head.ogDescription override");
    assert.ok(html.includes('<meta property="og:image" content="https://niluferormanli.com/og-disco.jpg">'), "OG image uses page head.ogImage override");
    assert.ok(html.includes('<meta property="og:url" content="https://niluferormanli.com/discography">'), "OG url uses canonical URL");
  });

  test("8. Additional Head Code rendering and strict script sanitization", () => {
    // 1. Pure sanitization function test
    const dirty = `
      <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Inter">
      <meta name="theme-color" content="#121214">
      <style>.hero { font-size: 2rem; }</style>
      <script>alert("xss")</script>
      <script src="https://evil.com/payload.js"></script>
      <link rel="stylesheet" href="javascript:alert('evil')">
      <link rel="stylesheet" href="https://example.com/a.css" onload="alert(1)">
      <noscript><link rel="stylesheet" href="fallback.css"></noscript>
    `;
    const clean = sanitizeHeadCode(dirty);
    assert.ok(clean.includes('<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Inter">'), "Legitimate link preserved");
    assert.ok(clean.includes('<meta name="theme-color" content="#121214">'), "Legitimate meta preserved");
    assert.ok(clean.includes('<style>.hero { font-size: 2rem; }</style>'), "Legitimate style preserved");
    assert.ok(clean.includes('<noscript><link rel="stylesheet" href="fallback.css"></noscript>'), "Legitimate noscript preserved");
    assert.ok(!clean.includes("<script"), "Executable script tags completely removed");
    assert.ok(!clean.includes('alert("xss")'), "Script body content stripped");
    assert.ok(!clean.includes("payload.js"), "External script src stripped");
    assert.ok(!clean.includes("javascript:"), "javascript: pseudo-protocols stripped");
    assert.ok(!clean.includes("onload="), "Inline event handlers stripped");

    // 2. Render integration test combining site-wide and page-specific additional head code
    const html = renderLanding({
      contextType: "static",
      slug: "home",
      config: {
        additionalHeadHtml: '<meta name="google-site-verification" content="verify-123">\n<script>evil()</script>'
      },
      slugData: {
        head: {
          additionalHeadHtml: '<link rel="dns-prefetch" href="//cdn.example.com">\n<img src=x onerror=alert(1)>'
        }
      }
    });

    assert.ok(html.includes('<meta name="google-site-verification" content="verify-123">'), "Site-wide additional head tag rendered");
    assert.ok(html.includes('<link rel="dns-prefetch" href="//cdn.example.com">'), "Page-specific additional head tag rendered");
    assert.ok(!html.includes("evil()"), "Site-wide script stripped from rendered output");
    assert.ok(!html.includes("onerror="), "Inline event handler stripped from rendered output");
  });

  test("9. General Settings Admin API persistence (/api/config)", async () => {
    const env = createMockEnv();
    const authHeaders = { Authorization: "Bearer secret_admin" };

    // PUT config with new head defaults
    const payload = {
      pageTitle: "Nilüfer Ormanlı",
      language: "en",
      robots: "index, follow",
      metaDescription: "Concert pianist official website",
      faviconUrl: "/custom-icon.svg",
      ogTitle: "Nilüfer Ormanlı Official",
      ogDescription: "Official classical music website",
      ogImage: "https://niluferormanli.com/share.jpg",
      additionalHeadHtml: '<link rel="preconnect" href="https://fonts.gstatic.com">\n<script>alert(1)</script>'
    };

    const putReq = createMockRequest("https://niluferormanli.com/api/config", "PUT", authHeaders, JSON.stringify(payload));
    const putRes = await configPut({ request: putReq, env });
    const putData = await putRes.json();
    assert.equal(putRes.status, 200);
    assert.equal(putData.ok, true);
    assert.equal(putData.config.language, "en");
    assert.equal(putData.config.robots, "index, follow");
    assert.equal(putData.config.metaDescription, "Concert pianist official website");
    assert.equal(putData.config.faviconUrl, "/custom-icon.svg");
    assert.equal(putData.config.ogTitle, "Nilüfer Ormanlı Official");
    assert.ok(!putData.config.additionalHeadHtml.includes("<script>"), "API strips script tags on save");
    assert.ok(putData.config.additionalHeadHtml.includes("https://fonts.gstatic.com"), "API preserves legitimate head link");

    // GET config verifies retrieval
    const getReq = createMockRequest("https://niluferormanli.com/api/config", "GET", authHeaders);
    const getRes = await configGet({ request: getReq, env });
    const getData = await getRes.json();
    assert.equal(getRes.status, 200);
    assert.equal(getData.config.metaDescription, "Concert pianist official website");
    assert.equal(getData.config.faviconUrl, "/custom-icon.svg");
  });

  test("10. Static Pages Admin API persistence: head storage and version duplication", async () => {
    const env = createMockEnv();
    const authHeaders = { Authorization: "Bearer secret_admin" };

    // 1. Create page with head
    const createReq = createMockRequest("https://niluferormanli.com/api/admin/static-pages", "POST", authHeaders, JSON.stringify({
      action: "create_page",
      name: "Privacy Policy",
      slug: "privacy-policy",
      head: {
        seoTitle: "Privacy Policy | Nilüfer Ormanlı",
        canonicalUrl: "https://niluferormanli.com/privacy-policy",
        metaDescription: "Official privacy policy statement.",
        language: "en",
        robots: "noindex, follow",
        additionalHeadHtml: '<meta name="policy-version" content="2026-09">\n<script>alert(1)</script>'
      }
    }));
    const createRes = await staticPagesPost({ request: createReq, env });
    const createData = await createRes.json();
    assert.equal(createRes.status, 200);
    assert.ok(createData.version.head);
    assert.equal(createData.version.head.seoTitle, "Privacy Policy | Nilüfer Ormanlı");
    assert.equal(createData.version.head.robots, "noindex, follow");
    assert.ok(!createData.version.head.additionalHeadHtml.includes("<script>"), "Script stripped from head");
    assert.ok(createData.version.head.additionalHeadHtml.includes("policy-version"), "Meta preserved in head");

    const pageId = createData.page.page_id;
    const v1Id = createData.version.version_id;

    // 2. Save version with updated head
    const saveReq = createMockRequest("https://niluferormanli.com/api/admin/static-pages", "POST", authHeaders, JSON.stringify({
      action: "save_version",
      page_id: pageId,
      version_id: v1Id,
      head: {
        seoTitle: "Updated Privacy Policy",
        language: "tr",
        robots: "index, follow"
      }
    }));
    const saveRes = await staticPagesPost({ request: saveReq, env });
    const saveData = await saveRes.json();
    assert.equal(saveRes.status, 200);
    assert.equal(saveData.version.head.seoTitle, "Updated Privacy Policy");
    assert.equal(saveData.version.head.language, "tr");

    // 3. Duplicate version preserves head
    const dupReq = createMockRequest("https://niluferormanli.com/api/admin/static-pages", "POST", authHeaders, JSON.stringify({
      action: "duplicate_version",
      page_id: pageId,
      version_id: v1Id
    }));
    const dupRes = await staticPagesPost({ request: dupReq, env });
    const dupData = await dupRes.json();
    assert.equal(dupRes.status, 200);
    assert.equal(dupData.version.version_number, 2);
    assert.ok(dupData.version.head, "Duplicated version must contain head object");
    assert.equal(dupData.version.head.seoTitle, "Updated Privacy Policy");
    assert.equal(dupData.version.head.language, "tr");
  });

  test("11. Admin renderer DOM parity: General Settings & Static Page Head inputs exist", () => {
    const adminHtml = renderAdmin();

    // General Settings inputs
    assert.ok(adminHtml.includes('id="cfg-language"'), "cfg-language input exists in admin DOM");
    assert.ok(adminHtml.includes('id="cfg-robots"'), "cfg-robots input exists in admin DOM");
    assert.ok(adminHtml.includes('id="cfg-meta-desc"'), "cfg-meta-desc input exists in admin DOM");
    assert.ok(adminHtml.includes('id="cfg-favicon-url"'), "cfg-favicon-url input exists in admin DOM");
    assert.ok(adminHtml.includes('id="cfg-og-title"'), "cfg-og-title input exists in admin DOM");
    assert.ok(adminHtml.includes('id="cfg-og-desc"'), "cfg-og-desc input exists in admin DOM");
    assert.ok(adminHtml.includes('id="cfg-og-image"'), "cfg-og-image input exists in admin DOM");
    assert.ok(adminHtml.includes('id="cfg-head-code"'), "cfg-head-code input exists in admin DOM");

    // Static Page Editor inputs
    assert.ok(adminHtml.includes('id="sp-input-seo-title"'), "sp-input-seo-title input exists in admin DOM");
    assert.ok(adminHtml.includes('id="sp-input-canonical-url"'), "sp-input-canonical-url input exists in admin DOM");
    assert.ok(adminHtml.includes('id="sp-input-meta-desc"'), "sp-input-meta-desc input exists in admin DOM");
    assert.ok(adminHtml.includes('id="sp-input-lang"'), "sp-input-lang input exists in admin DOM");
    assert.ok(adminHtml.includes('id="sp-input-robots"'), "sp-input-robots input exists in admin DOM");
    assert.ok(adminHtml.includes('id="sp-input-og-title"'), "sp-input-og-title input exists in admin DOM");
    assert.ok(adminHtml.includes('id="sp-input-og-desc"'), "sp-input-og-desc input exists in admin DOM");
    assert.ok(adminHtml.includes('id="sp-input-og-image"'), "sp-input-og-image input exists in admin DOM");
    assert.ok(adminHtml.includes('id="sp-input-head-code"'), "sp-input-head-code input exists in admin DOM");

    // Implementer handoff documentation notice
    assert.ok(adminHtml.includes("&lt;!-- COGNILINK: ... --&gt;"), "Implementer handoff guidance note present in admin DOM");
    assert.ok(adminHtml.includes("Custom HTML blocks are body fragments only"), "Body fragment boundary guidance present in admin DOM");
  });

  test("12. Shared OS Light/Dark Semantic Theme Contract & Configuration", async () => {
    const niluferTokens = {
      light: {
        "--site-bg": "#F1EFE8",
        "--site-surface": "#EEECE5",
        "--site-text": "#191918",
        "--site-text-muted": "#77736D",
        "--site-border": "rgba(87,86,81,.13)",
        "--site-link": "#5F4937",
        "--site-accent": "#89684E"
      },
      dark: {
        "--site-bg": "#242321",
        "--site-surface": "#22211F",
        "--site-text": "#DCD8CF",
        "--site-text-muted": "#8D8980",
        "--site-border": "rgba(220,216,207,.10)",
        "--site-link": "#CFC8BE",
        "--site-accent": "#A2846F"
      }
    };

    // 1. Helper unit verification
    const css = renderThemeTokensCss(niluferTokens);
    assert.ok(css.includes('<style id="site-theme-tokens">'), "Style tag has id site-theme-tokens");
    assert.ok(css.includes(":root {"), "Contains :root rule for light mode");
    assert.ok(css.includes("@media (prefers-color-scheme: dark)"), "Dark mode activated purely via @media (prefers-color-scheme: dark)");

    // Check all 7 canonical tokens in light mode
    assert.ok(css.includes("--site-bg: #F1EFE8;"), "Light --site-bg present");
    assert.ok(css.includes("--site-surface: #EEECE5;"), "Light --site-surface present");
    assert.ok(css.includes("--site-text: #191918;"), "Light --site-text present");
    assert.ok(css.includes("--site-text-muted: #77736D;"), "Light --site-text-muted present");
    assert.ok(css.includes("--site-border: rgba(87,86,81,.13);"), "Light --site-border present");
    assert.ok(css.includes("--site-link: #5F4937;"), "Light --site-link present");
    assert.ok(css.includes("--site-accent: #89684E;"), "Light --site-accent present");

    // Check all 7 canonical tokens in dark mode
    assert.ok(css.includes("--site-bg: #242321;"), "Dark --site-bg present");
    assert.ok(css.includes("--site-surface: #22211F;"), "Dark --site-surface present");
    assert.ok(css.includes("--site-text: #DCD8CF;"), "Dark --site-text present");
    assert.ok(css.includes("--site-text-muted: #8D8980;"), "Dark --site-text-muted present");
    assert.ok(css.includes("--site-border: rgba(220,216,207,.10);"), "Dark --site-border present");
    assert.ok(css.includes("--site-link: #CFC8BE;"), "Dark --site-link present");
    assert.ok(css.includes("--site-accent: #A2846F;"), "Dark --site-accent present");

    // 2. Full render verification
    const html = renderLanding({
      contextType: "static",
      slug: "home",
      requestPath: "/",
      config: { themeTokens: niluferTokens }
    });

    assert.ok(html.includes('<style id="site-theme-tokens">'), "Rendered HTML contains site theme tokens style tag");
    assert.ok(html.includes("@media (prefers-color-scheme: dark)"), "Dark mode media query present in document head");
    // Strictly verify no JS theme engine or local storage switching
    assert.ok(!html.includes("localStorage.getItem('theme')"), "No localStorage theme read");
    assert.ok(!html.includes("localStorage.setItem('theme'"), "No localStorage theme write");
    assert.ok(!html.includes("theme-toggle"), "No theme toggle button");
    // Verify shared components consume --site-* tokens
    assert.ok(html.includes("var(--site-text-muted"), "Shared CSS consumes --site-text-muted");
    assert.ok(html.includes("var(--site-border"), "Shared CSS consumes --site-border");
    assert.ok(html.includes("var(--site-link"), "Shared CSS consumes --site-link");

    // 3. Config API persistence test
    const env = createMockEnv();
    const authHeaders = { Authorization: "Bearer secret_admin" };

    const putReq = createMockRequest("https://niluferormanli.com/api/config", "PUT", authHeaders, JSON.stringify({
      themeTokens: niluferTokens
    }));
    const putRes = await configPut({ request: putReq, env });
    assert.equal(putRes.status, 200);
    const putData = await putRes.json();
    assert.equal(putData.ok, true);
    assert.deepEqual(putData.config.themeTokens, niluferTokens);

    const getReq = createMockRequest("https://niluferormanli.com/api/config", "GET", authHeaders);
    const getRes = await configGet({ request: getReq, env });
    assert.equal(getRes.status, 200);
    const getData = await getRes.json();
    assert.deepEqual(getData.config.themeTokens, niluferTokens);
  });

  test("10. Full-document legacy static pages preserve authored styles, scripts, and selectors without duplicate document shell", () => {
    const fullDocumentHtml = `
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Legacy Authoring Title</title>
<meta name="description" content="Legacy Description">

<style>
@import url('https://fonts.googleapis.com/css2?family=Cabin:wght@400;500;600&family=Instrument+Serif&display=swap');

:root {
  --photo: url("/assets/coming-soon/niluferormanli-comingsoon.webp");
  --ink: #211f1c;
}
.page { max-width: 1200px; margin: 0 auto; }
.photo-pair { display: flex; }
.main-stage { position: relative; }
.main-glass { backdrop-filter: blur(10px); }
.footer-system { margin-top: 40px; }
.social { display: inline-flex; }
</style>
<script>
  window.__PAGE_LOADED__ = true;
</script>
</head>
<body>
  <div class="page">
    <div class="photo-pair" aria-hidden="true">
      <section class="glass main-glass">
        <h1 class="main-stage">N I L Ü F E R   O R M A N L I</h1>
      </section>
    </div>
    <footer class="footer-system">
      <div class="social">Social Links</div>
    </footer>
  </div>
</body>
</html>
    `;

    // 1. Verify sanitizeBodyFragment directly
    const sanitized = sanitizeBodyFragment(fullDocumentHtml);
    assert.ok(!sanitized.includes("<!doctype html>") && !sanitized.includes("<!DOCTYPE html>"), "Strips doctype");
    assert.ok(!sanitized.includes("<html") && !sanitized.includes("</html>"), "Strips html tags");
    assert.ok(!sanitized.includes("<head") && !sanitized.includes("</head>"), "Strips head tags");
    assert.ok(!sanitized.includes("<body") && !sanitized.includes("</body>"), "Strips body tags");
    assert.ok(!sanitized.includes("<title>Legacy Authoring Title</title>"), "Strips inner title tag");
    assert.ok(sanitized.includes(".page { max-width: 1200px; margin: 0 auto; }"), "Preserves .page CSS");
    assert.ok(sanitized.includes(".photo-pair { display: flex; }"), "Preserves .photo-pair CSS");
    assert.ok(sanitized.includes(".main-stage { position: relative; }"), "Preserves .main-stage CSS");
    assert.ok(sanitized.includes(".main-glass { backdrop-filter: blur(10px); }"), "Preserves .main-glass CSS");
    assert.ok(sanitized.includes(".footer-system { margin-top: 40px; }"), "Preserves .footer-system CSS");
    assert.ok(sanitized.includes(".social { display: inline-flex; }"), "Preserves .social CSS");
    assert.ok(sanitized.includes("window.__PAGE_LOADED__ = true;"), "Preserves script tag");
    assert.ok(sanitized.includes('<div class="page">'), "Preserves inner DOM markup");

    // 2. Full renderLanding verification with layout[0].content
    const rendered = renderLanding({
      contextType: "static",
      slug: "coming-soon",
      slugData: {
        id: "coming-soon-v1",
        title: "Nilüfer Ormanlı",
        layout: [
          { type: "custom_html", content: fullDocumentHtml }
        ]
      },
      requestPath: "/",
      rootDomain: "niluferormanli.com"
    });

    // Verify document shell ownership rules: exactly ONE real document shell
    assert.equal(countOccurrences(rendered, "<!DOCTYPE html>"), 1, "Exactly one <!DOCTYPE html>");
    assert.equal(countOccurrences(rendered, "<html"), 1, "Exactly one <html opening tag");
    assert.equal(countOccurrences(rendered, "</html>"), 1, "Exactly one </html> closing tag");
    assert.equal(countOccurrences(rendered, "<head>"), 1, "Exactly one <head> opening tag");
    assert.equal(countOccurrences(rendered, "</head>"), 1, "Exactly one </head> closing tag");
    assert.equal(countOccurrences(rendered, "<body"), 1, "Exactly one <body opening tag");
    assert.equal(countOccurrences(rendered, "</body>"), 1, "Exactly one </body> closing tag");

    // Verify authoritative title in head and no duplicate title in body
    assert.ok(rendered.includes("<title>Nilüfer Ormanlı</title>"), "Authoritative title is in head");
    assert.ok(!rendered.includes("<title>Legacy Authoring Title</title>"), "Redundant title from body fragment is stripped");

    // Verify all Coming Soon CSS rules reach the rendered document
    assert.ok(rendered.includes(".page {"), "Rendered document includes .page style rule");
    assert.ok(rendered.includes(".photo-pair {"), "Rendered document includes .photo-pair style rule");
    assert.ok(rendered.includes(".main-stage {"), "Rendered document includes .main-stage style rule");
    assert.ok(rendered.includes(".main-glass {"), "Rendered document includes .main-glass style rule");
    assert.ok(rendered.includes(".footer-system {"), "Rendered document includes .footer-system style rule");
    assert.ok(rendered.includes(".social {"), "Rendered document includes .social style rule");

    // Verify scripts and asset references remain intact
    assert.ok(rendered.includes("window.__PAGE_LOADED__ = true;"), "Rendered document includes scripts");
    assert.ok(rendered.includes("/assets/coming-soon/niluferormanli-comingsoon.webp"), "Rendered document includes asset references");
  });

  test("11. Semantic body elements (<header>, <footer>, <main>, etc.) survive sanitizeBodyFragment without breaking document shell ownership", () => {
    // Exact requirement from user prompt:
    // stored:
    // <div><header><h2>Title</h2></header><p>Body</p></div>
    // rendered:
    // contains exactly that semantic <header>.
    const storedFragment = '<div><header><h2>Title</h2></header><p>Body</p></div>';
    const sanitized = sanitizeBodyFragment(storedFragment);
    assert.equal(sanitized, storedFragment, "Semantic <header> inside custom HTML survives sanitization exactly");

    // Comprehensive semantic elements test
    const richFragment = `
      <!DOCTYPE html>
      <html lang="tr">
      <head><title>Drop Title</title></head>
      <body>
        <div class="hal-content__grid">
          <header class="hal-header">
            <h2>HÂL Title</h2>
          </header>
          <main class="hal-main">
            <section class="hal-section">
              <article class="hal-article">
                <nav class="hal-nav"><a href="#offer">Offers</a></nav>
                <aside class="hal-aside">Sidebar</aside>
              </article>
            </section>
          </main>
          <footer class="hal-footer">
            <p>Footer Content</p>
          </footer>
        </div>
      </body>
      </html>
    `;

    const cleanRich = sanitizeBodyFragment(richFragment);
    assert.ok(cleanRich.includes('<header class="hal-header">'), "Semantic <header> preserved");
    assert.ok(cleanRich.includes('</header>'), "Closing </header> preserved");
    assert.ok(cleanRich.includes('<main class="hal-main">'), "Semantic <main> preserved");
    assert.ok(cleanRich.includes('<section class="hal-section">'), "Semantic <section> preserved");
    assert.ok(cleanRich.includes('<article class="hal-article">'), "Semantic <article> preserved");
    assert.ok(cleanRich.includes('<nav class="hal-nav">'), "Semantic <nav> preserved");
    assert.ok(cleanRich.includes('<aside class="hal-aside">'), "Semantic <aside> preserved");
    assert.ok(cleanRich.includes('<footer class="hal-footer">'), "Semantic <footer> preserved");
    // Outer shell stripped
    assert.ok(!cleanRich.includes('<!DOCTYPE'), "DocType stripped");
    assert.ok(!/<html\b/i.test(cleanRich), "<html> stripped");
    assert.ok(!/<head\b/i.test(cleanRich), "<head> stripped");
    assert.ok(!/<\/head>/i.test(cleanRich), "</head> stripped");
    assert.ok(!/<body\b/i.test(cleanRich), "<body> stripped");
    assert.ok(!/<\/body>/i.test(cleanRich), "</body> stripped");
    assert.ok(!cleanRich.includes('<title>'), "<title> stripped");

    // Full renderLanding test
    const rendered = renderLanding({
      contextType: "landing",
      slug: "derin-dinleme",
      slugData: {
        id: "version-1789080299436",
        title: "HÂL | Derin Dinleme",
        layout: [
          { type: "custom_html", content: storedFragment }
        ]
      },
      rootDomain: "niluferormanli.com"
    });

    assert.equal(countOccurrences(rendered, "<!DOCTYPE html>"), 1, "Exactly one <!DOCTYPE html>");
    assert.equal(countOccurrences(rendered, "<html"), 1, "Exactly one <html opening tag");
    assert.equal(countOccurrences(rendered, "</html>"), 1, "Exactly one </html> closing tag");
    assert.equal(countOccurrences(rendered, "<head>"), 1, "Exactly one <head> opening tag");
    assert.equal(countOccurrences(rendered, "</head>"), 1, "Exactly one </head> closing tag");
    assert.equal(countOccurrences(rendered, "<body"), 1, "Exactly one <body opening tag");
    assert.equal(countOccurrences(rendered, "</body>"), 1, "Exactly one </body> closing tag");
    assert.ok(rendered.includes("<header><h2>Title</h2></header>"), "Rendered output contains exactly the semantic <header>");
  });

});
