const fs = require('fs');
let code = fs.readFileSync('functions/_shared/hub-renderer.js', 'utf8');

const oldHeaderFooter = `  // Per-page header/footers only (global fallbacks headerHtml/footerHtml are removed)
  const headerRaw = slugData?.customHeaderHtml || "";
  const footerRaw = slugData?.customFooterHtml || "";`;

const newHeaderFooter = `  // Per-page header/footers only (global fallbacks headerHtml/footerHtml are removed)
  const headerRaw = hasCustomLayout ? "" : (slugData?.customHeaderHtml || "");
  const footerRaw = hasCustomLayout ? "" : (slugData?.customFooterHtml || "");`;

code = code.replace(oldHeaderFooter, newHeaderFooter);
fs.writeFileSync('functions/_shared/hub-renderer.js', code);
