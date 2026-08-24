import fs from 'fs';
let code = fs.readFileSync('functions/_shared/hub-renderer.js', 'utf8');

// Inject slug into meta block
code = code.replace(/product: "\$\{escAttr\(productSubdomain\)\}",/g, 'product: "${escAttr(productSubdomain)}",\n                slug: "${escAttr(slug)}",');

// Inject the custom conversion selector script
// We need to add an event listener to `conversionSelector` if it exists.
const targetBodyEnd = '</body>';
const convScript = `\n${"${slugData?.signals?.conversionSelector ? `\n<script>\n(function(){\n  var sel = \"${escAttr(slugData.signals.conversionSelector)}\";\n  var el = document.querySelector(sel);\n  if (el) {\n    el.addEventListener(\"click\", function() {\n      fetch(\"/api/decision/signal\", {\n        method: \"POST\",\n        headers: { \"Content-Type\": \"application/json\" },\n        body: JSON.stringify({ type: \"conversion\", meta: { product: \"${escAttr(productSubdomain)}\", slug: \"${escAttr(slug)}\", campaign: \"${escAttr(campaign || '')}\", source: \"${escAttr(contextId)}\" } })\n      }).catch(function(){});\n    });\n  }\n})();\n</script>` : \"\"}"}\n`;

code = code.replace(targetBodyEnd, convScript + targetBodyEnd);

fs.writeFileSync('functions/_shared/hub-renderer.js', code);
console.log("hub-renderer patched with custom conversion script.");
