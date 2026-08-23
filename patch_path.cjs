const fs = require('fs');
let content = fs.readFileSync('functions/[[path]].js', 'utf8');

// Update imports
content = content.replace(
  'import { deriveCampaignFromSlug }                  from "./_shared/slug-utils.js";',
  'import { deriveCampaignFromSlug, extractProductSubdomain, validateProductSubdomainMatch } from "./_shared/slug-utils.js";'
);

// Add productSubdomain extraction
const extractCode = `  const t0 = Date.now();
  const url = new URL(request.url);
  const productSubdomain = extractProductSubdomain(request.url);
`;
content = content.replace(/  const t0 = Date\.now\(\);\n  const url = new URL\(request\.url\);\n/, extractCode);

// Add validation after hubConfigVal
const validationCode = `  const hubConfigVal = hubConfigResult.status === "fulfilled" ? (hubConfigResult.value || null) : null;
  
  // Enforce subdomain match to prevent conflicts
  if (productSubdomain && hubConfigVal && !validateProductSubdomainMatch(productSubdomain, hubConfigVal.product)) {
    return html404();
  }
`;
content = content.replace(/  const hubConfigVal = hubConfigResult\.status === "fulfilled" \? \(hubConfigResult\.value \|\| null\) : null;\n/, validationCode);

fs.writeFileSync('functions/[[path]].js', content);
