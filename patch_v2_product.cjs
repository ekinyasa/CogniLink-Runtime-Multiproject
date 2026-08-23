const fs = require('fs');
let code = fs.readFileSync('functions/_shared/admin-renderer.js', 'utf8');

const oldStudioInit = `      studioCampaignConfig = configs.find(function (c) { return c.slug === campaignName; }) || {
        slug: campaignName,
        routing: null,
        landings: [],
        mainLandingId: ""
      };`;

const newStudioInit = `      studioCampaignConfig = configs.find(function (c) { return c.slug === campaignName; }) || {
        slug: campaignName,
        routing: null,
        landings: [],
        mainLandingId: ""
      };
      
      // Inherit product from V1 index if missing
      if (!studioCampaignConfig.product && campIndex && campIndex.product) {
        studioCampaignConfig.product = campIndex.product;
      }`;

code = code.replace(oldStudioInit, newStudioInit);
fs.writeFileSync('functions/_shared/admin-renderer.js', code);
