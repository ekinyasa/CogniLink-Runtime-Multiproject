import { verifyToken, unauthorized, jsonHeaders } from "../../_shared/auth.js";
import { renderHub } from "../../_shared/hub-renderer.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!verifyToken(request, env)) return unauthorized();

  const results = [];
  const runTest = (name, fn) => {
    try {
      const res = fn();
      results.push({ name, ok: true, message: res || "Pass" });
    } catch (e) {
      results.push({ name, ok: false, message: e.message });
    }
  };

  // ── TEST 1: Page Title Priorities ──
  runTest("Page Title: Page-specific wins over Global", () => {
    const html = renderHub({
      config: { pageTitle: "Global Title" },
      slugData: { pageTitle: "Page Title" },
      links: []
    });
    if (!html.includes("<title>Page Title</title>")) {
      throw new Error("Page Title override failed.");
    }
  });

  runTest("Page Title: Fallback to Global if no page title", () => {
    const html = renderHub({
      config: { pageTitle: "Global Title" },
      slugData: {},
      links: []
    });
    if (!html.includes("<title>Global Title</title>")) {
      throw new Error("Global Title fallback failed.");
    }
  });

  runTest("Page Title: Fallback to CogniLink if empty", () => {
    const html = renderHub({
      config: {},
      slugData: {},
      links: []
    });
    if (!html.includes("<title>CogniLink</title>")) {
      throw new Error("CogniLink default fallback failed.");
    }
  });

  // ── TEST 2: Turkish Lang and 404 Translation ──
  runTest("Turkish Lang and 404 message", () => {
    const html = renderHub({
      notFound: true
    });
    if (!html.includes('<html lang="tr">')) {
      throw new Error("Lang is not set to Turkish.");
    }
    if (!html.includes("Aradığınız sayfa aktif değil veya bulunamadı.")) {
      throw new Error("404 translation to Turkish failed.");
    }
  });

  // ── TEST 3: CSS Block sequence ──
  runTest("CSS block sequencing", () => {
    const html = renderHub({
      config: {
        themeCssUrl: "https://example.com/theme.css",
        customStyleCss: ".global-class { color: red; }"
      },
      slugData: {
        customStyleCss: ".page-class { color: blue; }"
      },
      slug: "mypage",
      links: [{ id: "l1", label: "Link 1", href: "https://google.com" }]
    });

    const baseCssIdx = html.indexOf("*,*::before,*::after{box-sizing:border-box}");
    const themeCssIdx = html.indexOf('href="https://example.com/theme.css"');
    const globalCssIdx = html.indexOf(".global-class { color: red; }");
    const pageCssIdx = html.indexOf("#slug-mypage .page-class");

    if (baseCssIdx === -1 || themeCssIdx === -1 || globalCssIdx === -1 || pageCssIdx === -1) {
      throw new Error("One or more style declarations are missing.");
    }

    if (!(baseCssIdx < themeCssIdx && themeCssIdx < globalCssIdx && globalCssIdx < pageCssIdx)) {
      throw new Error("CSS blocks are not output in correct sequence.");
    }
  });

  // ── TEST 4: Scoping Isolation ──
  runTest("Scoping: Global CSS unscoped, Page CSS scoped", () => {
    const html = renderHub({
      config: {
        customStyleCss: ".global-class { color: red; }"
      },
      slugData: {
        customStyleCss: ".page-class { color: blue; }"
      },
      slug: "page1"
    });
    if (html.includes("#slug-page1 .global-class")) {
      throw new Error("Global CSS was scoped incorrectly.");
    }
    if (!html.includes("#slug-page1 .page-class")) {
      throw new Error("Page CSS was not scoped.");
    }
  });

  // ── TEST 5: Clean Page Shell (No Empty Wrappers) ──
  runTest("No empty wrappers", () => {
    const html = renderHub({
      links: []
    });
    if (html.includes("hub-header") || html.includes("hub-footer") || html.includes("links-wrap")) {
      throw new Error("Empty wrapper elements rendered on clean page.");
    }
  });

  // ── TEST 6: Conditional HUB_CSS ──
  runTest("HUB_CSS Conditional Loading", () => {
    const htmlWithLinks = renderHub({
      links: [{ id: "l1", label: "Link", href: "http://g.com" }]
    });
    const htmlWithoutLinks = renderHub({
      links: []
    });

    if (!htmlWithLinks.includes(".link-btn")) {
      throw new Error("HUB_CSS not loaded when links are present.");
    }
    if (htmlWithoutLinks.includes(".link-btn")) {
      throw new Error("HUB_CSS loaded when page contains no links.");
    }
  });

  // ── TEST 7: Invariants and Cascades in KV ──
  if (env.APP_CONFIG && env.SLUG_LINKS) {
    const runKVTests = async () => {
      const family_id = "test-fam-123";
      const now = new Date().toISOString();

      // Clear existing test items first
      await env.APP_CONFIG.delete(`comp_family:${family_id}`);
      await env.APP_CONFIG.delete(`comp_ver:${family_id}:1`);
      await env.APP_CONFIG.delete(`comp_ver:${family_id}:2`);

      // Write mock family
      const family = {
        family_id,
        family_key: "test-fam",
        family_name: "Test Component",
        type: "block",
        status: "active",
        created_at: now,
        updated_at: now
      };
      await env.APP_CONFIG.put(`comp_family:${family_id}`, JSON.stringify(family));

      // Mock page referring to it
      const pageData = {
        id: "test-landing-page",
        components: [family_id],
        layout: [{ type: "component", id: family_id }]
      };
      await env.APP_CONFIG.put("hub:test-landing-page", JSON.stringify(pageData));

      // 1. Run migration endpoint
      await env.APP_CONFIG.put(`comp_ver:${family_id}:1`, JSON.stringify({
        component_id: "ver-1",
        family_id,
        version_number: 1,
        status: "draft",
        is_live: true
      }));

      // Trigger PUT migration logic
      const req = new Request("http://localhost/api/admin/components", {
        method: "PUT",
        headers: { "Authorization": `Bearer ${env.ADMIN_TOKEN}` },
        body: JSON.stringify({ action: "migrate_draft_status" })
      });
      const compContext = { ...context, request: req };
      
      const { onRequestPut } = await import("./components.js");
      const resp = await onRequestPut(compContext);
      const respData = await resp.json();

      if (!respData.success) {
        results.push({ name: "KV Invariants: migration trigger", ok: false, message: respData.error || "Migration failed." });
        return;
      }

      // Check migration result
      const migratedVer = await env.APP_CONFIG.get(`comp_ver:${family_id}:1`, { type: "json" });
      if (migratedVer.status !== "inactive") {
        results.push({ name: "KV Invariants: draft -> inactive migration status check", ok: false, message: "Draft version was not migrated." });
        return;
      }
      results.push({ name: "KV Invariants: migration status", ok: true, message: `Migrated ${respData.migrated_count} records.` });

      // Check recomputed family status invariant (since only inactive version exists, family should be inactive)
      const recomputedFam = await env.APP_CONFIG.get(`comp_family:${family_id}`, { type: "json" });
      if (recomputedFam.status !== "inactive") {
        results.push({ name: "KV Invariants: family status recomputation (inactive)", ok: false, message: `Expected family status to be inactive, got ${recomputedFam.status}` });
        return;
      }
      results.push({ name: "KV Invariants: family status recomputation (inactive)", ok: true, message: "Pass" });

      // Clean up mock references
      const delReq = new Request(`http://localhost/api/admin/components?family_id=${family_id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${env.ADMIN_TOKEN}` }
      });
      const delContext = { ...context, request: delReq };
      const { onRequestDelete } = await import("./components.js");
      const delResp = await onRequestDelete(delContext);
      const delRespData = await delResp.json();

      if (!delRespData.success) {
        results.push({ name: "KV Invariants: delete cascade execution", ok: false, message: delRespData.error });
        return;
      }

      // Assert references are clean
      const cleanedPage = await env.APP_CONFIG.get("hub:test-landing-page", { type: "json" });
      if (cleanedPage.components.includes(family_id) || cleanedPage.layout.some(item => item.id === family_id)) {
        results.push({ name: "KV Invariants: layout reference scrubbing", ok: false, message: "References were not scrubbed from page layout." });
        return;
      }
      results.push({ name: "KV Invariants: layout reference scrubbing", ok: true, message: "Scrubbed successfully." });

      // Clean up mock page
      await env.APP_CONFIG.delete("hub:test-landing-page");
    };

    await runKVTests();
  }

  const allPassed = results.every(r => r.ok);

  return new Response(
    JSON.stringify({ ok: allPassed, tests: results }),
    { status: allPassed ? 200 : 500, headers: jsonHeaders() }
  );
}
