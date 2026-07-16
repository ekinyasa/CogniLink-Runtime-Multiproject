/**
 * functions/_shared/runtime-compat-view.js
 * 
 * Helper for the Controlled Read Cutover.
 * Safely creates a legacy-compatible view using RuntimeContext as the primary source,
 * falling back to legacy data for unmapped or unverified fields.
 * 
 * PURE FUNCTION: Does not mutate inputs, has no side effects.
 */

export function createLegacyCompatibleView(runtimeContext, legacyObject) {
  const legacy = legacyObject || {};
  const ctx = runtimeContext || {};

  // Clone legacy to start with a safe base
  const view = { ...legacy };

  // Helper to deep clone arrays/objects from context to avoid reference sharing
  const safeCopy = (val) => {
    if (val === null || typeof val !== 'object') return val;
    return JSON.parse(JSON.stringify(val));
  };

  // 1. Slug / Page Identity
  if (ctx.pageContent?.id !== undefined) {
    view.slug = ctx.pageContent.id;
  }

  // 2. Campaign Name
  if (ctx.campaignContext?.name !== undefined) {
    view.campaign = ctx.campaignContext.name;
  }

  // 3. UTM Defaults
  if (ctx.campaignContext?.utm_defaults !== undefined) {
    view.defaults = safeCopy(ctx.campaignContext.utm_defaults);
  }

  // 4. Layout
  if (ctx.pageContent?.layout !== undefined) {
    view.layout = safeCopy(ctx.pageContent.layout);
  }

  // 5. Components
  if (ctx.pageContent?.components !== undefined) {
    view.components = safeCopy(ctx.pageContent.components);
  }

  // 6. Links
  if (ctx.activeLinks !== undefined) {
    view.links = safeCopy(ctx.activeLinks);
  }

  // 7. Custom CSS
  if (ctx.pageContent?.custom_css !== undefined) {
    view.customStyleCss = ctx.pageContent.custom_css;
  }

  // 8. Custom HTML (Header/Footer)
  if (ctx.pageContent?.custom_html !== undefined) {
    view.customHeaderHtml = ctx.pageContent.custom_html;
    view.customFooterHtml = ""; // Context combines them, so we flush footer to avoid duplicates
  }

  // 9. Page Title
  if (ctx.pageContent?.title !== undefined) {
    view.pageTitle = ctx.pageContent.title;
  }

  // 10. Theme
  if (ctx.pageContent?.theme !== undefined) {
    view.theme = ctx.pageContent.theme;
  }

  // 11. Redirect Metadata
  if (ctx.pageContent?.redirect !== undefined) {
    view.redirectUrl = ctx.pageContent.redirect;
  }

  // Unverified fields like isActive, modifier, engineMapId, etc., remain from the legacy clone.

  return view;
}
