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
      slugData: { headerInfo: { title: "Page Title" } },
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
    const pageCssIdx = html.indexOf(".page-class { color: blue; }");

    if (baseCssIdx === -1 || themeCssIdx === -1 || globalCssIdx === -1 || pageCssIdx === -1) {
      throw new Error("One or more style declarations are missing.");
    }

    if (!(baseCssIdx < themeCssIdx && themeCssIdx < globalCssIdx && globalCssIdx < pageCssIdx)) {
      throw new Error("CSS blocks are not output in correct sequence.");
    }
  });

  // ── TEST 4: CSS Unscoped Verification ──
  runTest("CSS Unscoped: Page CSS matches byte-for-byte and retains media queries", () => {
    const complexCss = `@media (max-width: 768px) {\n  :root { --color: red; }\n  body { background: blue; }\n  .hero:has(> .title) { display: grid; }\n}`;
    const html = renderHub({
      config: {
        customStyleCss: "body { margin: 0; }"
      },
      slugData: {
        customStyleCss: complexCss
      },
      slug: "page1"
    });

    if (!html.includes(complexCss)) {
      throw new Error("Complex page CSS was modified or not preserved byte-for-byte.");
    }
    if (!html.includes("body { margin: 0; }")) {
      throw new Error("Global config CSS was modified or missing.");
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

  // ── TEST 6: Default Base Links Omission ──
  runTest("Default Base Links Omission", () => {
    const html = renderHub({
      config: { baseLinks: [{ label: "Base Link", url: "https://g.com" }] },
      links: [{ id: "l1", label: "Link", href: "http://g.com" }]
    });

    if (html.includes("links-wrap") || html.includes("link-btn") || html.includes("link-text")) {
      throw new Error("Legacy links elements are rendered in HTML.");
    }
  });

  // ── TEST 7: Invariants and Cascades in KV ──
  if (env.APP_CONFIG && env.SLUG_LINKS) {
    const runKVTests = async () => {
      const family_id = "test-fam-123";
      const now = new Date().toISOString();

      const clearKeys = async () => {
        await env.APP_CONFIG.delete(`comp_family:${family_id}`);
        await env.APP_CONFIG.delete(`comp_ver:${family_id}:1`);
        await env.APP_CONFIG.delete(`comp_ver:${family_id}:2`);
      };

      // Helper to invoke components endpoint
      const componentsApi = async (method, body = null, qs = "") => {
        const req = new Request(`http://localhost/api/admin/components${qs}`, {
          method,
          headers: { "Authorization": `Bearer ${env.ADMIN_TOKEN}` },
          body: body ? JSON.stringify(body) : null
        });
        const { onRequestPost, onRequestPut, onRequestDelete } = await import("./components.js");
        if (method === "POST") return (await onRequestPost({ request: req, env })).json();
        if (method === "PUT") return (await onRequestPut({ request: req, env })).json();
        if (method === "DELETE") return (await onRequestDelete({ request: req, env })).json();
      };

      // A. Create Inactive Component test
      await clearKeys();
      const createRes = await componentsApi("POST", {
        family_key: "test-fam-state",
        family_name: "Test Inactive",
        type: "block",
        status: "inactive"
      });

      if (!createRes.success) {
        results.push({ name: "KV States: create inactive family failed", ok: false, message: createRes.error });
        return;
      }

      const checkFam = await env.APP_CONFIG.get(`comp_family:${createRes.family_id}`, { type: "json" });
      const checkVer = await env.APP_CONFIG.get(`comp_ver:${createRes.family_id}:1`, { type: "json" });

      if (checkFam.status !== "inactive" || checkVer.status !== "inactive") {
        results.push({ name: "KV States: status save mismatch", ok: false, message: `Expected inactive/inactive, got ${checkFam.status}/${checkVer.status}` });
        return;
      }
      results.push({ name: "KV States: create inactive status verified", ok: true, message: "Pass" });

      // B. Update Family Status Cascade test
      const updateRes = await componentsApi("PUT", {
        action: "update_family",
        family_id: createRes.family_id,
        status: "active"
      });
      if (!updateRes.success) {
        results.push({ name: "KV States: update family failed", ok: false, message: updateRes.error });
        return;
      }
      const checkFamActive = await env.APP_CONFIG.get(`comp_family:${createRes.family_id}`, { type: "json" });
      const checkVerActive = await env.APP_CONFIG.get(`comp_ver:${createRes.family_id}:1`, { type: "json" });
      if (checkFamActive.status !== "active" || checkVerActive.status !== "active") {
        results.push({ name: "KV States: status cascade active mismatch", ok: false, message: `Expected active/active, got ${checkFamActive.status}/${checkVerActive.status}` });
        return;
      }
      results.push({ name: "KV States: update family status cascade verified", ok: true, message: "Pass" });

      // C. Live Version Deletion test
      // Duplicate to version 2 so there is a remaining version!
      const dupRes = await componentsApi("PUT", {
        action: "duplicate_version",
        family_id: createRes.family_id,
        version_number: 1
      });
      if (!dupRes.success) {
        results.push({ name: "KV States: duplicate version failed", ok: false, message: dupRes.error });
        return;
      }

      // Mock page layout referencing it
      const pageData = {
        id: "test-page-title",
        components: [createRes.family_id],
        layout: [{ type: "component", id: createRes.family_id }]
      };
      await env.APP_CONFIG.put("hub:test-page-title", JSON.stringify(pageData));

      const delRes = await componentsApi("DELETE", null, `?family_id=${createRes.family_id}&version_number=1`);
      if (!delRes.success) {
        results.push({ name: "KV States: live version delete failed", ok: false, message: delRes.error });
        return;
      }

      // Live version record should be deleted
      const checkVerDel = await env.APP_CONFIG.get(`comp_ver:${createRes.family_id}:1`);
      if (checkVerDel !== null) {
        results.push({ name: "KV States: live version record was not deleted", ok: false, message: "Record still exists." });
        return;
      }

      // Family layout reference must be preserved because version 2 still exists
      const pageAfterVerDel = await env.APP_CONFIG.get("hub:test-page-title", { type: "json" });
      if (!pageAfterVerDel.components.includes(createRes.family_id)) {
        results.push({ name: "KV States: family reference scrubbed prematurely on single version delete", ok: false, message: "Reference was scrubbed." });
        return;
      }
      results.push({ name: "KV States: live version delete verified", ok: true, message: "Pass" });

      // D. Cascade Deletion on Last Version Delete
      // Since version 1 was deleted, version 2 is the last remaining version. Delete it now.
      const delRes2 = await componentsApi("DELETE", null, `?family_id=${createRes.family_id}&version_number=2`);
      if (!delRes2.success) {
        results.push({ name: "KV States: last version delete failed", ok: false, message: delRes2.error });
        return;
      }

      // The family should have been cleaned up automatically by recomputeFamilyStatusAndLive
      const checkFamDel = await env.APP_CONFIG.get(`comp_family:${createRes.family_id}`);
      if (checkFamDel !== null) {
        results.push({ name: "KV States: family was not deleted after last version deletion", ok: false, message: "Family record still exists." });
        return;
      }

      // References should be scrubbed because the family is gone
      const pageAfterFamDel = await env.APP_CONFIG.get("hub:test-page-title", { type: "json" });
      if (pageAfterFamDel.components.includes(createRes.family_id)) {
        results.push({ name: "KV States: references not scrubbed after last version deletion", ok: false, message: "References still exist." });
        return;
      }
      results.push({ name: "KV States: cascade deletion on last version delete verified", ok: true, message: "Pass" });

      await env.APP_CONFIG.delete("hub:test-page-title");
      await clearKeys();
    };

    await runKVTests();
  }

  const allPassed = results.every(r => r.ok);

  return new Response(
    JSON.stringify({ ok: allPassed, tests: results }),
    { status: allPassed ? 200 : 500, headers: jsonHeaders() }
  );
}
