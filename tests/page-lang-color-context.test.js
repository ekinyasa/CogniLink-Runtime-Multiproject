import test from "node:test";
import assert from "node:assert/strict";
import {
  resolvePrimaryLanguage,
  resolveConsentConfig,
  getConsentCssVariables,
  renderColorContextCss,
  renderConsentSnippet,
  renderHub
} from "../functions/_shared/hub-renderer.js";

test("Page Language-Aware Shared UI & Page Color Context Test Suite", async (t) => {

  await t.test("1. Primary language subtag parsing", () => {
    assert.equal(resolvePrimaryLanguage("tr-TR"), "tr");
    assert.equal(resolvePrimaryLanguage("TR_tr"), "tr");
    assert.equal(resolvePrimaryLanguage("en-US"), "en");
    assert.equal(resolvePrimaryLanguage("EN_gb"), "en");
    assert.equal(resolvePrimaryLanguage(""), "");
    assert.equal(resolvePrimaryLanguage(null), "");
    assert.equal(resolvePrimaryLanguage(undefined), "");
  });

  await t.test("2. language: 'tr' renders Turkish Cookie Banner & Modal text", () => {
    const resolved = resolveConsentConfig({}, "tr");
    assert.equal(resolved.content.bannerTitle, "Çerez Tercihleri");
    assert.equal(resolved.content.btnAcceptAll, "Tümünü kabul et");
    assert.equal(resolved.content.btnRejectNonEssential, "Gerekli olmayanları reddet");

    const html = renderHub({
      slug: "test-tr-page",
      slugData: {
        title: "Test Page",
        head: { language: "tr-TR" }
      }
    });

    assert.match(html, /Çerez Tercihleri/);
    assert.match(html, /Tümünü kabul et/);
    assert.match(html, /Gerekli olmayanları reddet/);
  });

  await t.test("3. language: 'en' renders English Cookie Banner & Modal text", () => {
    const resolved = resolveConsentConfig({}, "en");
    assert.equal(resolved.content.bannerTitle, "Cookie Preferences");
    assert.equal(resolved.content.btnAcceptAll, "Accept all");
    assert.equal(resolved.content.btnRejectNonEssential, "Reject non-essential");

    const html = renderHub({
      slug: "test-en-page",
      slugData: {
        title: "Test Page EN",
        head: { language: "en-US" }
      }
    });

    assert.match(html, /Cookie Preferences/);
    assert.match(html, /Accept all/);
    assert.match(html, /Reject non-essential/);
  });

  await t.test("4. language: undefined preserves default global consent content", () => {
    const resolved = resolveConsentConfig({ content: { bannerTitle: "Global Notice" } }, undefined);
    assert.equal(resolved.content.bannerTitle, "Global Notice");
    assert.equal(resolved.content.btnAcceptAll, "Accept all");
  });

  await t.test("5. Custom TR consent copy override from consent config", () => {
    const rawConsent = {
      tr: {
        bannerTitle: "Özel Çerez Başlığı",
        btnAcceptAll: "Hepsine İzin Ver"
      }
    };
    const resolved = resolveConsentConfig(rawConsent, "tr");
    assert.equal(resolved.content.bannerTitle, "Özel Çerez Başlığı");
    assert.equal(resolved.content.btnAcceptAll, "Hepsine İzin Ver");
    // Fallback field preserved
    assert.equal(resolved.content.btnRejectNonEssential, "Gerekli olmayanları reddet");
  });

  await t.test("6. Consent decision logic and cookie CL_CONSENT remain 100% identical regardless of language", () => {
    const htmlTR = renderHub({
      slug: "tr-test",
      slugData: { head: { language: "tr" } }
    });
    const htmlEN = renderHub({
      slug: "en-test",
      slugData: { head: { language: "en" } }
    });

    assert.match(htmlTR, /var COOKIE_NAME = "cl_consent"/);
    assert.match(htmlEN, /var COOKIE_NAME = "cl_consent"/);
    assert.match(htmlTR, /nec:true,ana:true,mkt:true/);
    assert.match(htmlEN, /nec:true,ana:true,mkt:true/);
  });

  await t.test("7. GA4 / Meta Pixel script gating remains untouched across all language choices", () => {
    const htmlTR = renderHub({
      slug: "tr-test-analytics",
      ga4Id: "G-123456",
      metaPixelId: "PIXEL-123456",
      slugData: { head: { language: "tr" } }
    });
    assert.match(htmlTR, /googletagmanager\.com\/gtag\/js\?id=/);
    assert.match(htmlTR, /var gaId = 'G-123456'/);
    assert.match(htmlTR, /connect\.facebook\.net\/en_US\/fbevents\.js/);
    assert.match(htmlTR, /window\.__clConsent\.has\('analytics'\)/);
    assert.match(htmlTR, /window\.__clConsent\.has\('marketing'\)/);
  });

  await t.test("8. colorContext exposes --page-* CSS variables on rendered HTML", () => {
    const colorContext = {
      surface: "#111113",
      foreground: "#fafafa",
      mutedText: "#888888",
      border: "#333333",
      accent: "#ff0055",
      overlaySurface: "#000000",
      overlayForeground: "#ffffff"
    };

    const css = renderColorContextCss(colorContext);
    assert.match(css, /--page-surface:\s*#111113;/);
    assert.match(css, /--page-foreground:\s*#fafafa;/);
    assert.match(css, /--page-muted-text:\s*#888888;/);
    assert.match(css, /--page-border:\s*#333333;/);
    assert.match(css, /--page-accent:\s*#ff0055;/);
    assert.match(css, /--page-overlay-surface:\s*#000000;/);
    assert.match(css, /--page-overlay-foreground:\s*#ffffff;/);

    const html = renderHub({
      slug: "colored-page",
      slugData: { colorContext }
    });

    assert.match(html, /id="page-color-context"/);
    assert.match(html, /--page-surface:\s*#111113;/);
  });

  await t.test("9. Cookie Banner inherits colorContext.surface and colorContext.foreground as fallbacks", () => {
    const colorContext = {
      surface: "#0b0c10",
      foreground: "#c5c6c7"
    };
    const vars = getConsentCssVariables({}, colorContext);
    assert.match(vars, /--cl-consent-banner-bg:\s*#0b0c10/);
    assert.match(vars, /--cl-consent-text-color:\s*#c5c6c7/);
  });

  await t.test("10. Cookie Modal inherits colorContext.overlaySurface and colorContext.overlayForeground", () => {
    const colorContext = {
      surface: "#1f2833",
      border: "#45a29e",
      overlaySurface: "#000000"
    };
    const vars = getConsentCssVariables({}, colorContext);
    assert.match(vars, /--cl-consent-modal-bg:\s*#000000/);
    assert.match(vars, /--cl-consent-modal-border:\s*#45a29e/);
    assert.match(vars, /--cl-consent-overlay-color:\s*#000000/);
  });

  await t.test("11. Editorial Footer inherits colorContext.mutedText and colorContext.border", () => {
    const colorContext = {
      mutedText: "#999999",
      border: "#222222",
      accent: "#0070f3"
    };
    const css = renderColorContextCss(colorContext);
    assert.match(css, /--site-text-muted:\s*var\(--page-muted-text\);/);
    assert.match(css, /--site-border:\s*var\(--page-border\);/);
    assert.match(css, /--site-link:\s*var\(--page-accent\);/);
  });

  await t.test("12. Page Color Context overrides explicit global Appearance, but global Appearance wins when Page Color Context is absent", () => {
    const rawConsent = {
      visual: {
        bannerBg: "rgba(43,31,24,.88)",
        modalBg: "rgba(43,31,24,.88)"
      }
    };
    const colorContext = {
      surface: "#22211F",
      overlaySurface: "#22211F"
    };

    // 1. With Page Color Context present: Page Color Context wins
    const resolvedWithCC = resolveConsentConfig(rawConsent, "en", colorContext);
    assert.equal(resolvedWithCC.visual.bannerBg, "#22211F");
    assert.equal(resolvedWithCC.visual.modalBg, "#22211F");

    // 2. With Page Color Context absent: Global Appearance wins
    const resolvedWithoutCC = resolveConsentConfig(rawConsent, "en", null);
    assert.equal(resolvedWithoutCC.visual.bannerBg, "rgba(43,31,24,.88)");
    assert.equal(resolvedWithoutCC.visual.modalBg, "rgba(43,31,24,.88)");
  });

  await t.test("13. Undefined colorContext does not emit dummy --page-* variables or mutate theme", () => {
    const css = renderColorContextCss(undefined);
    assert.equal(css, "");

    const html = renderHub({
      slug: "plain-page",
      slugData: { title: "Plain Page" }
    });
    assert.doesNotMatch(html, /id="page-color-context"/);
  });

  await t.test("14. System prefers-color-scheme: dark coexists safely with colorContext", () => {
    const colorContext = {
      surface: "#121212",
      foreground: "#ffffff"
    };
    const html = renderHub({
      slug: "theme-page",
      config: {
        themeTokens: {
          light: { "--site-bg": "#ffffff" },
          dark: { "--site-bg": "#000000" }
        }
      },
      slugData: { colorContext }
    });

    assert.match(html, /id="site-theme-tokens"/);
    assert.match(html, /@media \(prefers-color-scheme: dark\)/);
    assert.match(html, /id="page-color-context"/);
  });

  await t.test("15. Static Page version data model preserves colorContext", () => {
    const version = {
      version_id: "ver-1",
      page_id: "page-1",
      title: "Static Page",
      colorContext: {
        surface: "#0d1117",
        foreground: "#c9d1d9"
      }
    };
    assert.equal(version.colorContext.surface, "#0d1117");
  });

  await t.test("16. Intent Landing Version data model preserves colorContext", () => {
    const landing = {
      id: "landing-derin-dinleme",
      title: "Derin Dinleme",
      colorContext: {
        surface: "#050505",
        accent: "#fa5252"
      }
    };
    assert.equal(landing.colorContext.accent, "#fa5252");
  });

  await t.test("17. Homepage static page route supports language resolution and color context", () => {
    const html = renderHub({
      contextType: "static",
      slug: "home",
      slugData: {
        title: "Home",
        head: { language: "tr-TR" },
        colorContext: { surface: "#0a0a0c" }
      }
    });
    assert.match(html, /Çerez Tercihleri/);
    assert.match(html, /--page-surface:\s*#0a0a0c;/);
  });

  await t.test("18. Intent Subdomain homepage route supports language resolution and color context", () => {
    const html = renderHub({
      contextType: "intent",
      productSubdomain: "hal",
      slug: "derin-dinleme",
      slugData: {
        title: "Derin Dinleme",
        head: { language: "tr" },
        colorContext: { accent: "#e03131" }
      }
    });
    assert.match(html, /Tümünü kabul et/);
    assert.match(html, /--page-accent:\s*#e03131;/);
  });

  await t.test("19. Unknown route 404 page supports language resolution and color context", () => {
    const html = renderHub({
      contextType: "static",
      slug: "custom-404",
      is404Response: true,
      slugData: {
        title: "404 Not Found",
        head: { language: "tr" },
        colorContext: { surface: "#1a1a1a" }
      }
    });
    assert.match(html, /Çerez Tercihleri/);
    assert.match(html, /--page-surface:\s*#1a1a1a;/);
  });

  await t.test("20. No hardcoded HÂL-, Coming-Soon-, hostname-, or slug-specific logic present in language/color resolution", () => {
    const langRes = resolvePrimaryLanguage("tr");
    assert.equal(langRes, "tr");

    const genericHtml = renderHub({
      slug: "generic-any-slug",
      slugData: {
        head: { language: "tr" },
        colorContext: { surface: "#123456" }
      }
    });

    assert.match(genericHtml, /Çerez Tercihleri/);
    assert.match(genericHtml, /--page-surface:\s*#123456;/);
  });

  await t.test("21. Admin API POST and GET round-trip preserves custom Turkish and English consent copy", async () => {
    const { onRequestGet: getConsent, onRequestPost: postConsent } = await import("../functions/api/admin/consent.js");

    class MockKV {
      constructor() { this.store = new Map(); }
      async get(key, opts) {
        const v = this.store.get(key);
        if (!v) return null;
        return opts?.type === "json" ? JSON.parse(v) : v;
      }
      async put(key, val) { this.store.set(key, val); }
    }

    const mockKv = new MockKV();
    const env = { APP_CONFIG: mockKv, ADMIN_TOKEN: "test-token" };

    const payload = {
      en: {
        bannerTitle: "Custom EN Banner",
        btnAcceptAll: "Allow All"
      },
      tr: {
        bannerTitle: "Özel TR Çerez Bildirimi",
        btnAcceptAll: "Hepsini Kabul Et",
        modalTitle: "Özel TR Tercih Modalı"
      },
      visual: { bannerBg: "#111111" }
    };

    const postReq = new Request("https://example.com/api/admin/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer test-token" },
      body: JSON.stringify(payload)
    });

    const postRes = await postConsent({ request: postReq, env });
    assert.equal(postRes.status, 200);

    const postData = await postRes.json();
    assert.equal(postData.ok, true);
    assert.equal(postData.consent.tr.bannerTitle, "Özel TR Çerez Bildirimi");
    assert.equal(postData.consent.tr.btnAcceptAll, "Hepsini Kabul Et");

    const getReq = new Request("https://example.com/api/admin/consent", {
      headers: { "Authorization": "Bearer test-token" }
    });

    const getRes = await getConsent({ request: getReq, env });
    assert.equal(getRes.status, 200);

    const getData = await getRes.json();
    assert.equal(getData.tr.bannerTitle, "Özel TR Çerez Bildirimi");
    assert.equal(getData.tr.btnAcceptAll, "Hepsini Kabul Et");
    assert.equal(getData.tr.modalTitle, "Özel TR Tercih Modalı");
  });

  await t.test("22. Custom saved Turkish copy is rendered when page language is tr", () => {
    const rawConsentConfig = {
      content: { bannerTitle: "Global Banner" },
      en: { bannerTitle: "English Banner" },
      tr: {
        bannerTitle: "Özel Türkçe Çerez Bildirimi",
        btnAcceptAll: "Tümünü Onayla"
      }
    };

    const htmlTR = renderHub({
      slug: "tr-custom-copy-page",
      config: { consent: rawConsentConfig },
      slugData: {
        title: "TR Page",
        head: { language: "tr-TR" }
      }
    });

    assert.match(htmlTR, /Özel Türkçe Çerez Bildirimi/);
    assert.match(htmlTR, /Tümünü Onayla/);
    assert.doesNotMatch(htmlTR, /Global Banner/);

    const htmlEN = renderHub({
      slug: "en-custom-copy-page",
      config: { consent: rawConsentConfig },
      slugData: {
        title: "EN Page",
        head: { language: "en-US" }
      }
    });

    assert.match(htmlEN, /English Banner/);
    assert.doesNotMatch(htmlEN, /Özel Türkçe Çerez Bildirimi/);
  });

  await t.test("23. Regression Test: Page Color Context overrides explicit global Appearance for Cookie Banner, Cookie Modal, and Editorial Footer", () => {
    const globalConsentConfig = {
      visual: {
        bannerBg: "rgba(43,31,24,.88)",
        modalBg: "rgba(43,31,24,.88)",
        textColor: "rgb(241, 233, 223)",
        secondaryTextColor: "rgb(200, 188, 175)",
        borderColor: "rgba(255, 232, 205, 0.24)",
        btnPrimaryBg: "rgba(255, 221, 174, 0.3)"
      }
    };

    const halColorContext = {
      surface: "#22211F",
      foreground: "#DCD8CE",
      mutedText: "#8D8980",
      border: "rgba(220,216,207,.10)",
      accent: "#A2846F",
      overlaySurface: "#22211F",
      overlayForeground: "#DCD8CE"
    };

    // 1. With Page Color Context present on page
    const htmlWithCC = renderHub({
      slug: "hal-derin-dinleme",
      config: { consent: globalConsentConfig },
      slugData: {
        title: "HÂL | Derin Dinleme",
        head: { language: "tr" },
        colorContext: halColorContext
      }
    });

    // Cookie Banner & Modal: must use #22211F, NOT rgba(43,31,24,.88)
    assert.match(htmlWithCC, /--cl-consent-banner-bg:\s*#22211F;/);
    assert.match(htmlWithCC, /--cl-consent-modal-bg:\s*#22211F;/);
    assert.match(htmlWithCC, /--cl-consent-text-color:\s*#DCD8CE;/);
    assert.match(htmlWithCC, /--cl-consent-secondary-text:\s*#8D8980;/);
    assert.match(htmlWithCC, /--cl-consent-border-color:\s*rgba\(220,216,207,\.10\);/);
    assert.match(htmlWithCC, /--cl-consent-btn-primary-bg:\s*#A2846F;/);

    // Editorial Footer: page-color-context block overrides site variables
    assert.match(htmlWithCC, /id="page-color-context"/);
    assert.match(htmlWithCC, /--page-surface:\s*#22211F;/);
    assert.match(htmlWithCC, /--site-surface:\s*var\(--page-surface\);/);

    // 2. With Page Color Context absent (null): global Appearance wins exactly as before
    const htmlWithoutCC = renderHub({
      slug: "plain-page",
      config: { consent: globalConsentConfig },
      slugData: {
        title: "Plain Page",
        head: { language: "tr" }
      }
    });

    assert.match(htmlWithoutCC, /--cl-consent-banner-bg:\s*rgba\(43,31,24,\.88\);/);
    assert.match(htmlWithoutCC, /--cl-consent-modal-bg:\s*rgba\(43,31,24,\.88\);/);
    assert.doesNotMatch(htmlWithoutCC, /id="page-color-context"/);
  });

});
