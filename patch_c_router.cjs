const fs = require('fs');
let code = fs.readFileSync('functions/c/[slug].js', 'utf8');

const oldLookup = `  if (slug && env.CAMPAIGN_INDEX) {
    try {
      campaignDataVal = await env.CAMPAIGN_INDEX.get(slug, { type: "json" });
    } catch(e) {}
  }`;

const newLookup = `  if (slug && env.CAMPAIGN_INDEX) {
    try {
      if (productSubdomain) {
        campaignDataVal = await env.CAMPAIGN_INDEX.get(productSubdomain + "-" + slug, { type: "json" });
      }
      if (!campaignDataVal) {
        campaignDataVal = await env.CAMPAIGN_INDEX.get(slug, { type: "json" });
      }
    } catch(e) {}
  }`;

code = code.replace(oldLookup, newLookup);

const oldIntentData = `  if (utmCampaign && env.APP_CONFIG) {
    try {
      intentData = await env.APP_CONFIG.get(\`campaign:\${utmCampaign}\`, { type: "json" });
    } catch(e) {}
  }`;

const newIntentData = `  if (utmCampaign && env.APP_CONFIG) {
    try {
      if (productSubdomain) {
        intentData = await env.APP_CONFIG.get(\`campaign:\${productSubdomain}-\${utmCampaign}\`, { type: "json" });
      }
      if (!intentData) {
        intentData = await env.APP_CONFIG.get(\`campaign:\${utmCampaign}\`, { type: "json" });
      }
    } catch(e) {}
  }`;

code = code.replace(oldIntentData, newIntentData);
fs.writeFileSync('functions/c/[slug].js', code);
