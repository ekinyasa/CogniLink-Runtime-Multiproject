const fs = require('fs');
let content = fs.readFileSync('functions/l/[slug].js', 'utf8');

// Add import
const importCode = 'import { extractProductSubdomain, validateProductSubdomainMatch } from "../_shared/slug-utils.js";\nimport { renderHub } from "../_shared/hub-renderer.js";';
content = content.replace('import { renderHub } from "../_shared/hub-renderer.js";', importCode);

// Add productSubdomain extraction
const extractCode = `  const url = new URL(request.url);
  const previewVersion = url.searchParams.get("preview_version");
  const productSubdomain = extractProductSubdomain(request.url);`;
content = content.replace(/  const url = new URL\(request\.url\);\n  const previewVersion = url\.searchParams\.get\("preview_version"\);/, extractCode);

// Add validation after 'found'
const validationCode = `  const { campaign, landing } = found;

  // Enforce subdomain match to prevent conflicts
  if (productSubdomain && campaign && !validateProductSubdomainMatch(productSubdomain, campaign.product)) {
    return render404("The requested landing version belongs to a different product group.");
  }
`;
content = content.replace('  const { campaign, landing } = found;', validationCode);

fs.writeFileSync('functions/l/[slug].js', content);
