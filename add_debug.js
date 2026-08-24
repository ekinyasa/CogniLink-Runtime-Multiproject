import fs from 'fs';
let code = fs.readFileSync('functions/_shared/hub-renderer.js', 'utf8');

// Find the function definition to inject productSubdomain if it's missing
const renderDefRegex = /export function renderHub\(\{\s*contextType.*?config = \{\},.*?\s*slug = "",\s*slugData = null,/s;
if (!code.match(renderDefRegex)) {
  console.log("Could not find renderHub signature!");
}

code = code.replace(/slugData = null,/, 'slugData = null,\n  productSubdomain = "",');

// Now find where we construct the <head> block, and inject the script
const headEndTarget = `</title>`;

const debugScript = `
  const pSub = productSubdomain || (slug ? slug.split('-')[0] : "unknown");
  const dCamp = campaign || (slug ? slug.split('-')[1] : "unknown");
  const dMod = modifier || (slug ? slug.split('-').slice(2).join('-') : "unknown");
  const cUrl = "https://" + pSub + ".teklifi.online/l/" + slug;
  const alias = slugData && slugData.alias ? slugData.alias : null;
  const aUrl = alias ? "https://" + pSub + ".teklifi.online/" + alias : "N/A";
  const pSlug = "{" + slug + "}";
  const pTheme = (slugData && slugData.theme) ? slugData.theme : "Default";
  const pUpdate = (slugData && slugData.updatedAt) ? new Date(slugData.updatedAt).toLocaleString("tr-TR") : (slugData && slugData.updated_at ? new Date(slugData.updated_at).toLocaleString("tr-TR") : "Bilinmiyor");

  const debugString = \`\${pSub} | \${dCamp} | \${dMod} | C: \${cUrl} | A: \${aUrl} | \${pSlug} | \${pTheme} | Last updated: \${pUpdate}\`;
  
  const debugHtml = \`\\n<!--\\nRUNTIME DEBUG INFO:\\n\${debugString}\\n-->\\n<script>console.log("RUNTIME DEBUG INFO: %c" + \${JSON.stringify(debugString)}, "color:#0284c7; font-weight:bold;");</script>\`;
`;

// Inject into the HTML output
code = code.replace(headEndTarget, headEndTarget + "\\n${debugHtml}");

// Add the JS logic right before the return statement inside renderHub
const returnHtmlRegex = /return \`<!DOCTYPE html>/;
code = code.replace(returnHtmlRegex, debugScript + '\n  return `<!DOCTYPE html>');

fs.writeFileSync('functions/_shared/hub-renderer.js', code);
console.log("Debug info added to hub-renderer.js");
