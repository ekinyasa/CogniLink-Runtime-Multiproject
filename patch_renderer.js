import fs from 'fs';
let code = fs.readFileSync('functions/_shared/hub-renderer.js', 'utf8');

// The renderer has multiple fetch('/api/decision/signal') calls.
// We should find 'source: CONTEXT_ID,' and inject 'product: pSub,' right before it.
// Wait, we defined pSub in the debugScript block. Let's make sure we expose productSubdomain properly.
// The renderer has:
// campaign: CAMPAIGN || getMerged().utm_campaign || ""
// Let's add product: "${pSub}" to the meta block!
const metaRegex = /meta:\s*\{/g;
code = code.replace(metaRegex, 'meta: {\n                product: "${escAttr(productSubdomain)}",');

fs.writeFileSync('functions/_shared/hub-renderer.js', code);
console.log("Renderer patched.");
