const fs = require('fs');
let code = fs.readFileSync('functions/_shared/admin-renderer.js', 'utf8');

code = code.replace(
  'studioCampaignConfig.slug = currentSelectedCampaign;',
  'studioCampaignConfig.slug = currentSelectedCampaign;\n          studioCampaignConfig.product = product || null;'
);

fs.writeFileSync('functions/_shared/admin-renderer.js', code);
