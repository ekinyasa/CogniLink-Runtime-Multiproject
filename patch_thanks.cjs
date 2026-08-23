const fs = require('fs');
let content = fs.readFileSync('functions/l/[slug]/thanks.js', 'utf8');

// Add import
content = content.replace('import { renderHub } from "../../_shared/hub-renderer.js";', 'import { extractProductSubdomain, validateProductSubdomainMatch } from "../../_shared/slug-utils.js";\nimport { renderHub } from "../../_shared/hub-renderer.js";');

// Extract subdomain
content = content.replace('  const url = new URL(request.url);', '  const url = new URL(request.url);\n  const productSubdomain = extractProductSubdomain(request.url);');

// Enforce after campaign is found
const validation = `
  const campaign = await env.APP_CONFIG.get(\`campaign:\${campaignId}\`, { type: "json" });
  if (productSubdomain && campaign && !validateProductSubdomainMatch(productSubdomain, campaign.product)) {
    return render404("The requested thank you page belongs to a different product group.");
  }
`;
content = content.replace('  const campaign = await env.APP_CONFIG.get(`campaign:${campaignId}`, { type: "json" });', validation);

fs.writeFileSync('functions/l/[slug]/thanks.js', content);
