/**
 * functions/_shared/runtime-diff.js
 * 
 * CogniLink Runtime Diff Engine.
 * 
 * Compares the legacy JSON object with the new RuntimeContext payload.
 * Pure function: side-effect free, produces deterministic comparison results.
 */

export function compareRuntime(legacyObject, runtimeContext) {
  const legacy = legacyObject || {};
  const ctx = runtimeContext || {};
  const diffs = [];

  function addDiff(field, type, expected, actual) {
    diffs.push({ field, type, expected, actual });
  }

  function comparePrimitive(field, expected, actual) {
    if (expected === actual) return;
    if (expected == null && actual != null) {
      addDiff(field, "extra", expected, actual);
    } else if (expected != null && actual == null) {
      addDiff(field, "missing", expected, actual);
    } else if (typeof expected !== typeof actual) {
      addDiff(field, "type_mismatch", typeof expected, typeof actual);
    } else {
      addDiff(field, "mismatch", expected, actual);
    }
  }

  // 1. Page Identity
  const expectedPageId = legacy.slug || null;
  const actualPageId = ctx.pageContent?.id || null;
  comparePrimitive("pageContent.id", expectedPageId, actualPageId);

  // 2. Campaign Identity
  const expectedCampaign = legacy.campaign || null;
  const actualCampaign = ctx.campaignContext?.name || null;
  comparePrimitive("campaignContext.name", expectedCampaign, actualCampaign);

  // 3. Custom CSS
  const expectedCss = typeof legacy.customStyleCss === 'string' ? legacy.customStyleCss : "";
  const actualCss = ctx.pageContent?.custom_css || "";
  comparePrimitive("pageContent.custom_css", expectedCss, actualCss);

  // 4. Custom HTML (Header + Footer)
  const headerHtml = typeof legacy.customHeaderHtml === 'string' ? legacy.customHeaderHtml : "";
  const footerHtml = typeof legacy.customFooterHtml === 'string' ? legacy.customFooterHtml : "";
  const expectedHtml = [headerHtml, footerHtml].filter(Boolean).join("\n");
  const actualHtml = ctx.pageContent?.custom_html || "";
  comparePrimitive("pageContent.custom_html", expectedHtml, actualHtml);

  // 5. Components Length (Basic validation)
  const rawComponents = Array.isArray(legacy.components) ? legacy.components : [];
  const expectedComponents = [...new Set(rawComponents.filter(c => typeof c === 'string' && c.trim() !== ''))];
  const actualComponents = Array.isArray(ctx.pageContent?.components) ? ctx.pageContent.components : [];
  if (expectedComponents.length !== actualComponents.length) {
    addDiff("pageContent.components", expectedComponents.length > actualComponents.length ? "missing" : "extra", expectedComponents.length, actualComponents.length);
  } else {
    // Deep match
    for (let i = 0; i < expectedComponents.length; i++) {
      if (expectedComponents[i] !== actualComponents[i]) {
        addDiff(`pageContent.components[${i}]`, "mismatch", expectedComponents[i], actualComponents[i]);
      }
    }
  }

  // 6. Layout Length
  const rawLayout = Array.isArray(legacy.layout) ? legacy.layout : [];
  const expectedLayout = rawLayout.filter(item => item && typeof item === 'object' && item.id);
  const actualLayout = Array.isArray(ctx.pageContent?.layout) ? ctx.pageContent.layout : [];
  if (expectedLayout.length !== actualLayout.length) {
    addDiff("pageContent.layout", expectedLayout.length > actualLayout.length ? "missing" : "extra", expectedLayout.length, actualLayout.length);
  }

  // 7. Links Length
  const rawLinks = Array.isArray(legacy.links) ? legacy.links : [];
  const expectedLinksMap = new Map();
  for (const link of rawLinks) {
    if (!link || typeof link !== 'object') continue;
    if (!link.id || typeof link.href !== 'string' || !link.href.trim()) continue;
    if (link.isActive === false || link.disabled === true) continue;
    if (!expectedLinksMap.has(link.id)) expectedLinksMap.set(link.id, link);
  }
  const expectedLinks = Array.from(expectedLinksMap.values());
  const actualLinks = Array.isArray(ctx.activeLinks) ? ctx.activeLinks : [];
  if (expectedLinks.length !== actualLinks.length) {
    addDiff("activeLinks", expectedLinks.length > actualLinks.length ? "missing" : "extra", expectedLinks.length, actualLinks.length);
  }

  // 8. Metadata Modifier
  const expectedModifier = legacy.modifier || null;
  const actualModifier = ctx.metadata?.modifier || null;
  comparePrimitive("metadata.modifier", expectedModifier, actualModifier);

  // 9. Render Mode (If legacy has none, it shouldn't fail if ctx is "canonical")
  // For now, just compare if legacy exposes it, else omit
  if (legacy.render_mode) {
    comparePrimitive("render_mode", legacy.render_mode, ctx.render_mode);
  }

  return {
    identical: diffs.length === 0,
    mismatchCount: diffs.length,
    items: diffs
  };
}
