const fs = require('fs');

// 1. Patch slug-utils.js
let slugUtils = fs.readFileSync('functions/_shared/slug-utils.js', 'utf8');
slugUtils = slugUtils.replace(
  'export function extractProductSubdomain(urlStr) {',
  'export function extractProductSubdomain(urlStr, reqHeaderHost = null) {\n  let actualHost = reqHeaderHost;'
);
slugUtils = slugUtils.replace(
  '    const hostSegments = url.hostname.split(\'.\');',
  '    if (!actualHost) actualHost = url.hostname;\n    const hostSegments = actualHost.split(\'.\');'
);
fs.writeFileSync('functions/_shared/slug-utils.js', slugUtils);

// 2. Patch [[path]].js
let pathJs = fs.readFileSync('functions/[[path]].js', 'utf8');
pathJs = pathJs.replace(
  'const productSubdomain = extractProductSubdomain(request.url);',
  'const originalHost = request.headers.get("x-forwarded-host") || request.headers.get("x-original-host") || url.hostname;\n  const productSubdomain = extractProductSubdomain(request.url, originalHost);'
);
pathJs = pathJs.replace(
  'let newHost = url.hostname;',
  'let newHost = originalHost;'
);
fs.writeFileSync('functions/[[path]].js', pathJs);

// 3. Patch c/[slug].js
let cSlug = fs.readFileSync('functions/c/[slug].js', 'utf8');
cSlug = cSlug.replace(
  'const productSubdomain = extractProductSubdomain(request.url);',
  'const originalHost = request.headers.get("x-forwarded-host") || request.headers.get("x-original-host") || url.hostname;\n  const productSubdomain = extractProductSubdomain(request.url, originalHost);'
);
fs.writeFileSync('functions/c/[slug].js', cSlug);

// 4. Patch l/[slug].js
let lSlug = fs.readFileSync('functions/l/[slug].js', 'utf8');
lSlug = lSlug.replace(
  'const productSubdomain = extractProductSubdomain(request.url);',
  'const originalHost = request.headers.get("x-forwarded-host") || request.headers.get("x-original-host") || url.hostname;\n  const productSubdomain = extractProductSubdomain(request.url, originalHost);'
);
fs.writeFileSync('functions/l/[slug].js', lSlug);

// 5. Patch l/[slug]/thanks.js
let thanksJs = fs.readFileSync('functions/l/[slug]/thanks.js', 'utf8');
thanksJs = thanksJs.replace(
  'const productSubdomain = extractProductSubdomain(request.url);',
  'const originalHost = request.headers.get("x-forwarded-host") || request.headers.get("x-original-host") || url.hostname;\n  const productSubdomain = extractProductSubdomain(request.url, originalHost);'
);
fs.writeFileSync('functions/l/[slug]/thanks.js', thanksJs);

// 6. Patch admin/index.js
let adminJs = fs.readFileSync('functions/admin/index.js', 'utf8');
adminJs = adminJs.replace(
  'const customDomain = env.CUSTOM_DOMAIN || url.hostname;',
  'const originalHost = request.headers.get("x-forwarded-host") || request.headers.get("x-original-host") || url.hostname;\n  const customDomain = env.CUSTOM_DOMAIN || originalHost;'
);
adminJs = adminJs.replace(
  '  if (url.hostname === "login.teklifi.online") {',
  '  if (originalHost === "login.teklifi.online") {'
);
adminJs = adminJs.replace(
  '    url.hostname.endsWith("teklifi.online") && \n    url.hostname !== "login.teklifi.online"',
  '    originalHost.endsWith("teklifi.online") && \n    originalHost !== "login.teklifi.online"'
);
fs.writeFileSync('functions/admin/index.js', adminJs);

