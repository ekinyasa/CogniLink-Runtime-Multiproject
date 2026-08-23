const fs = require('fs');
let content = fs.readFileSync('functions/c/[slug].js', 'utf8');

// 1. Add productSubdomain extraction at the top of onRequestGet
content = content.replace(
  '  const url = new URL(request.url);',
  '  const url = new URL(request.url);\n  const productSubdomain = extractProductSubdomain(request.url);'
);

// 2. Add validation right after intentData is fetched
const intentBlock = `  const hasIntentData = intentData && typeof intentData === "object" && !Array.isArray(intentData) && Object.keys(intentData).length > 0;
  
  // Enforce subdomain match to prevent conflicts
  const activeData = intentData || campaignDataVal;
  if (productSubdomain && activeData && !validateProductSubdomainMatch(productSubdomain, activeData.product)) {
    const html = renderHub({ notFound: true, config });
    return new Response(html, {
      status: 404,
      headers: { "Content-Type": "text/html;charset=UTF-8", "Cache-Control": "no-store" }
    });
  }`;

content = content.replace(
  '  const hasIntentData = intentData && typeof intentData === "object" && !Array.isArray(intentData) && Object.keys(intentData).length > 0;',
  intentBlock
);

fs.writeFileSync('functions/c/[slug].js', content);
