const fs = require('fs');
let code = fs.readFileSync('functions/_shared/admin-renderer.js', 'utf8');

// 1. Auto-prefix during creation
const oldCreation = `        var name = idInput.value.trim().toLowerCase();
        var product = productInput.value.trim();
        if (!name) {
          alert("Intent Name is required.");
          return;
        }
        if (name.length > 1 && !/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(name)) {
          alert("Invalid name. Lowercase letters, numbers, hyphens (no leading/trailing hyphen).");
          return;
        }
        
        confirmBtn.disabled = true;
        confirmBtn.textContent = "Creating...";
        try {
          var createBody = { name: name, alias: name, product: product || null };`;

const newCreation = `        var rawName = idInput.value.trim().toLowerCase();
        var product = productInput.value.trim();
        if (!rawName) {
          alert("Intent Name is required.");
          return;
        }
        if (rawName.length > 1 && !/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(rawName)) {
          alert("Invalid name. Lowercase letters, numbers, hyphens (no leading/trailing hyphen).");
          return;
        }
        
        // Auto-prefix for unique database keys
        var name = rawName;
        if (product) {
          var cleanProd = normalizeSlug(product);
          if (cleanProd && !rawName.startsWith(cleanProd + "-")) {
            name = cleanProd + "-" + rawName;
          }
        }
        
        confirmBtn.disabled = true;
        confirmBtn.textContent = "Creating...";
        try {
          var createBody = { name: name, alias: name, product: product || null };`;

code = code.replace(oldCreation, newCreation);

// 2. Strip prefix in display list
const oldListMap = `    elCampaignList.innerHTML = items.map(function (c) {
      var isActive   = c.isActive !== false;
      var createdFmt  = c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : "—";
      var aliasText   = c.alias ? '<code style="color: var(--success, #22c55e);">' + esc(c.alias) + '</code>' : '';
      var metaText    = aliasText ? aliasText + ' · ' + createdFmt : createdFmt;

      return (
        '<div class="campaign-item" id="camp-item-' + esc(c.name) + '" style="padding: 0.5rem 0; border-bottom: 1px solid var(--border);">' +
          '<div class="campaign-info" style="display: flex; flex-direction: column; gap: 0.15rem;">' +
            '<div style="display: flex; align-items: center; gap: 0.25rem;">' +
            (c.product ? '<span style="font-size:0.7rem; color:var(--text-m);">' + esc(c.product) + '.</span> ' : '') +
            '<a class="campaign-name" href="#" data-name="' + esc(c.name) + '" style="font-weight:bold; color:var(--primary); text-decoration:none;">' + esc(c.name) + '</a>' +
            '</div>'`;

const newListMap = `    elCampaignList.innerHTML = items.map(function (c) {
      var isActive   = c.isActive !== false;
      var createdFmt  = c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : "—";
      
      var displayAlias = c.alias || "";
      var displayName = c.name || "";
      if (c.product) {
        var prefix = normalizeSlug(c.product) + "-";
        if (displayAlias.startsWith(prefix)) displayAlias = displayAlias.substring(prefix.length);
        if (displayName.startsWith(prefix)) displayName = displayName.substring(prefix.length);
      }
      
      var aliasText   = displayAlias ? '<code style="color: var(--success, #22c55e);">' + esc(displayAlias) + '</code>' : '';
      var metaText    = aliasText ? aliasText + ' · ' + createdFmt : createdFmt;

      return (
        '<div class="campaign-item" id="camp-item-' + esc(c.name) + '" style="padding: 0.5rem 0; border-bottom: 1px solid var(--border);">' +
          '<div class="campaign-info" style="display: flex; flex-direction: column; gap: 0.15rem;">' +
            '<div style="display: flex; align-items: center; gap: 0.25rem;">' +
            (c.product ? '<span style="font-size:0.7rem; color:var(--text-m);">' + esc(c.product) + '.</span> ' : '') +
            '<a class="campaign-name" href="#" data-name="' + esc(c.name) + '" style="font-weight:bold; color:var(--primary); text-decoration:none;">' + esc(displayName) + '</a>' +
            '</div>'`;

code = code.replace(oldListMap, newListMap);

// 3. Update buildLandingCanonicalUrl and buildLandingAliasUrl to strip the prefix
const oldUrls = `  function buildLandingCanonicalUrl(slug, product) {
    var base = resolveProductBaseUrl(product);
    var clean = normalizeSlug(slug);
    return clean ? (base + "/l/" + clean) : "";
  }

  function buildLandingAliasUrl(alias, product) {
    if (!alias) return "";
    var base = resolveProductBaseUrl(product);
    var clean = normalizeSlug(alias);
    return clean ? (base + "/" + clean) : "";
  }`;

const newUrls = `  function buildLandingCanonicalUrl(slug, product) {
    var base = resolveProductBaseUrl(product);
    var clean = normalizeSlug(slug);
    if (product && clean) {
       var prefix = normalizeSlug(product) + "-";
       if (clean.startsWith(prefix)) clean = clean.substring(prefix.length);
    }
    return clean ? (base + "/c/" + clean) : ""; // Changed from /l/ to /c/ for Intent URLs
  }

  function buildLandingAliasUrl(alias, product) {
    if (!alias) return "";
    var base = resolveProductBaseUrl(product);
    var clean = normalizeSlug(alias);
    if (product && clean) {
       var prefix = normalizeSlug(product) + "-";
       if (clean.startsWith(prefix)) clean = clean.substring(prefix.length);
    }
    return clean ? (base + "/" + clean) : "";
  }`;
  
code = code.replace(oldUrls, newUrls);

// 4. Update the "Intent Settings" title and inputs to strip prefix
const oldTitle = `    document.getElementById("studio-campaign-title").textContent = campaignName;
    document.getElementById("workspace-title").textContent = campaignName;`;

const newTitle = `    
    var displayCampName = campaignName;
    if (campIndex && campIndex.product) {
      var prefix = normalizeSlug(campIndex.product) + "-";
      if (displayCampName.startsWith(prefix)) displayCampName = displayCampName.substring(prefix.length);
    }
    document.getElementById("studio-campaign-title").textContent = displayCampName;
    document.getElementById("workspace-title").textContent = displayCampName;`;
    
code = code.replace(oldTitle, newTitle);

// 5. Alias input value stripping
const oldAliasSet = `    document.getElementById("studio-campaign-alias").value = campIndex ? (campIndex.alias || "") : "";`;
const newAliasSet = `    var aliasInputVal = campIndex ? (campIndex.alias || "") : "";
    if (campIndex && campIndex.product) {
      var prefix = normalizeSlug(campIndex.product) + "-";
      if (aliasInputVal.startsWith(prefix)) aliasInputVal = aliasInputVal.substring(prefix.length);
    }
    document.getElementById("studio-campaign-alias").value = aliasInputVal;`;
    
code = code.replace(oldAliasSet, newAliasSet);

fs.writeFileSync('functions/_shared/admin-renderer.js', code);
