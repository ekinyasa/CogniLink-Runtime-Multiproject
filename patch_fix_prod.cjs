const fs = require('fs');
let code = fs.readFileSync('functions/_shared/admin-renderer.js', 'utf8');

code = code.replace(
  'var prod = studioCurrentEditingLanding.product || (studioCurrentContextData && studioCurrentContextData.product);',
  'var prod = studioCurrentEditingLanding.product || (typeof studioCampaignConfig !== "undefined" && studioCampaignConfig && studioCampaignConfig.product);'
);

code = code.replace(
  'urlInput.value = resolveProductBaseUrl(studioCurrentEditingLanding ? (studioCurrentEditingLanding.product || (studioCurrentContextData && studioCurrentContextData.product)) : null) + previewUrlPath;',
  'urlInput.value = resolveProductBaseUrl(studioCurrentEditingLanding ? (studioCurrentEditingLanding.product || (typeof studioCampaignConfig !== "undefined" && studioCampaignConfig && studioCampaignConfig.product)) : null) + previewUrlPath;'
);

fs.writeFileSync('functions/_shared/admin-renderer.js', code);
