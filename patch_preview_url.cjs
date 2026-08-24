const fs = require('fs');
let code = fs.readFileSync('functions/_shared/admin-renderer.js', 'utf8');

const oldPreviewPath = `    var slugForUrl = campSlugs.length > 0 ? campSlugs[0].slug : studioCampaignConfig.slug;
    var previewUrlPath = isMain ? ("/c/" + encodeURIComponent(slugForUrl)) : ("/l/" + encodeURIComponent(cleanSlug) + "?preview_version=" + encodeURIComponent(studioCurrentEditingLanding.id));`;

const newPreviewPath = `    var slugForUrl = campSlugs.length > 0 ? campSlugs[0].slug : studioCampaignConfig.slug;
    
    // Strip prefix for clean URL presentation
    if (prod) {
       var prefix = normalizeSlug(prod) + "-";
       if (slugForUrl.startsWith(prefix)) slugForUrl = slugForUrl.substring(prefix.length);
       if (cleanSlug.startsWith(prefix)) cleanSlug = cleanSlug.substring(prefix.length);
    }
    
    var previewUrlPath = isMain ? ("/c/" + encodeURIComponent(slugForUrl)) : ("/l/" + encodeURIComponent(cleanSlug) + "?preview_version=" + encodeURIComponent(studioCurrentEditingLanding.id));`;

code = code.replace(oldPreviewPath, newPreviewPath);
fs.writeFileSync('functions/_shared/admin-renderer.js', code);
