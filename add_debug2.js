import fs from 'fs';
let code = fs.readFileSync('functions/_shared/hub-renderer.js', 'utf8');

code = code.replace(/slugData = null,\s*\/\/\s*full slug KV record/g, 'slugData = null, // full slug KV record\n  productSubdomain = "",');

const debugScript = `
  // --- DEBUG INFO INJECTION ---
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

// Insert the debugScript variables at the beginning of renderHub
code = code.replace(/const cfg = config \|\| \{\};/, `const cfg = config || {};\n${debugScript}`);

// Append \n${debugHtml} after <title>...</title> for both occurrences
code = code.replace(/<title>\$\{escHtml\(finalTitle\)\}<\/title>/g, `<title>\${escHtml(finalTitle)}</title>\n\${debugHtml}`);

fs.writeFileSync('functions/_shared/hub-renderer.js', code);
console.log("Patched successfully.");
