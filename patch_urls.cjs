const fs = require('fs');
let code = fs.readFileSync('functions/_shared/admin-renderer.js', 'utf8');

// 1. Add getRootDomain and resolveProductBaseUrl
const baseHelpers = `  function getRootDomain() {
    var base = "";
    if (typeof window !== "undefined" && window.location) {
      base = window.location.hostname;
    }
    if (!base && typeof window !== "undefined" && window.CUSTOM_DOMAIN) {
      base = window.CUSTOM_DOMAIN;
    }
    if (!base) return "teklifi.online";
    var parts = base.split('.');
    if (parts.length >= 3) {
      return parts.slice(-2).join('.');
    }
    return base;
  }

  function resolveProductBaseUrl(product) {
    var root = getRootDomain();
    if (!product) return "https://www." + root;
    var cleanProd = normalizeSlug(product);
    if (!cleanProd) return "https://www." + root;
    return "https://" + cleanProd + "." + root;
  }

  function resolveBaseUrl() {`;

code = code.replace('  function resolveBaseUrl() {', baseHelpers);

// 2. Update buildLandingCanonicalUrl and buildLandingAliasUrl
code = code.replace(
  '  function buildLandingCanonicalUrl(slug) {\n    var base = resolveBaseUrl();',
  '  function buildLandingCanonicalUrl(slug, product) {\n    var base = resolveProductBaseUrl(product);'
);

code = code.replace(
  '  function buildLandingAliasUrl(alias) {\n    if (!alias) return "";\n    var base = resolveBaseUrl();',
  '  function buildLandingAliasUrl(alias, product) {\n    if (!alias) return "";\n    var base = resolveProductBaseUrl(product);'
);

// 3. Update updateStudioUrlPreviews()
const studioPreviewsOld = `    var cleanSlug = normalizeSlug(slugVal);
    var cleanAlias = normalizeSlug(aliasVal);
    if (slugPreview) {
      slugPreview.textContent = cleanSlug ? buildLandingCanonicalUrl(cleanSlug) : "No slug set";
    }
    if (aliasPreview) {
      aliasPreview.textContent = cleanAlias ? buildLandingAliasUrl(cleanAlias) : "No alias set";
    }`;

const studioPreviewsNew = `    var cleanSlug = normalizeSlug(slugVal);
    var cleanAlias = normalizeSlug(aliasVal);
    var prod = studioCurrentEditingLanding.product || (studioCurrentContextData && studioCurrentContextData.product);
    if (slugPreview) {
      slugPreview.textContent = cleanSlug ? buildLandingCanonicalUrl(cleanSlug, prod) : "No slug set";
    }
    if (aliasPreview) {
      aliasPreview.textContent = cleanAlias ? buildLandingAliasUrl(cleanAlias, prod) : "No alias set";
    }`;
code = code.replace(studioPreviewsOld, studioPreviewsNew);

// 4. Update the l.alias loops in section 4
code = code.replace(
  'var canonicalUrl = buildLandingCanonicalUrl(l.slug || l.id);',
  'var canonicalUrl = buildLandingCanonicalUrl(l.slug || l.id, l.product || (c && c.product));'
);
code = code.replace(
  'var aliasUrl = l.alias ? buildLandingAliasUrl(l.alias) : "";',
  'var aliasUrl = l.alias ? buildLandingAliasUrl(l.alias, l.product || (c && c.product)) : "";'
);

// 5. Update legacy slug list
const legacySlugOld = `      var aliasBtn = item.alias
        ? '<a class="btn-ghost btn-xs slug-alias-link" href="/' + esc(item.alias) + '" ' +
            'target="_blank" rel="noopener noreferrer">' + esc(item.alias) + '</a>'
        : '';
      return (
        '<div class="slug-item' + (isActive ? "" : " slug-inactive") + '">' +
          '<div class="slug-info">' +
            '<a class="slug-name" href="/c/' + esc(item.slug) + '" ' +
               'target="_blank" rel="noopener noreferrer">/c/' + esc(item.slug) + '</a>'`;

const legacySlugNew = `      var prodUrl = resolveProductBaseUrl(item.product);
      var aliasBtn = item.alias
        ? '<a class="btn-ghost btn-xs slug-alias-link" href="' + prodUrl + '/' + esc(item.alias) + '" ' +
            'target="_blank" rel="noopener noreferrer">' + esc(item.alias) + '</a>'
        : '';
      return (
        '<div class="slug-item' + (isActive ? "" : " slug-inactive") + '">' +
          '<div class="slug-info">' +
            '<a class="slug-name" href="' + prodUrl + '/c/' + esc(item.slug) + '" ' +
               'target="_blank" rel="noopener noreferrer">/c/' + esc(item.slug) + '</a>'`;

code = code.replace(legacySlugOld, legacySlugNew);

// 6. Fix copy URL button
code = code.replace(
  'urlInput.value = resolveBaseUrl() + previewUrlPath;',
  'urlInput.value = resolveProductBaseUrl(studioCurrentEditingLanding ? (studioCurrentEditingLanding.product || (studioCurrentContextData && studioCurrentContextData.product)) : null) + previewUrlPath;'
);

fs.writeFileSync('functions/_shared/admin-renderer.js', code);
