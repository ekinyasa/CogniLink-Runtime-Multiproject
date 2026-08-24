const fs = require('fs');
let code = fs.readFileSync('functions/_shared/admin-renderer.js', 'utf8');

const oldUpdate = `  function updateStudioUrlPreviews() {
    if (!studioCurrentEditingLanding) return;
    var slugVal = document.getElementById("studio-version-slug")?.value || studioCurrentEditingLanding.slug || studioCurrentEditingLanding.id;
    var aliasVal = document.getElementById("studio-version-alias")?.value || studioCurrentEditingLanding.alias || "";

    var cleanSlug = normalizeSlug(slugVal);
    var cleanAlias = aliasVal ? normalizeSlug(aliasVal) : "";

    var slugPreview = document.getElementById("studio-slug-preview");
    if (slugPreview) {
      slugPreview.textContent = cleanSlug ? buildLandingCanonicalUrl(cleanSlug) : "No slug set";
    }

    var aliasPreview = document.getElementById("studio-alias-preview");
    if (aliasPreview) {
      aliasPreview.textContent = cleanAlias ? buildLandingAliasUrl(cleanAlias) : "No alias set";
    }`;

const newUpdate = `  function updateStudioUrlPreviews() {
    if (!studioCurrentEditingLanding) return;
    var slugVal = document.getElementById("studio-version-slug")?.value || studioCurrentEditingLanding.slug || studioCurrentEditingLanding.id;
    var aliasVal = document.getElementById("studio-version-alias")?.value || studioCurrentEditingLanding.alias || "";

    var cleanSlug = normalizeSlug(slugVal);
    var cleanAlias = aliasVal ? normalizeSlug(aliasVal) : "";
    
    var prod = typeof studioCampaignConfig !== "undefined" && studioCampaignConfig ? studioCampaignConfig.product : null;

    var slugPreview = document.getElementById("studio-slug-preview");
    if (slugPreview) {
      slugPreview.textContent = cleanSlug ? buildLandingCanonicalUrl(cleanSlug, prod) : "No slug set";
    }

    var aliasPreview = document.getElementById("studio-alias-preview");
    if (aliasPreview) {
      aliasPreview.textContent = cleanAlias ? buildLandingAliasUrl(cleanAlias, prod) : "No alias set";
    }`;

code = code.replace(oldUpdate, newUpdate);
fs.writeFileSync('functions/_shared/admin-renderer.js', code);
