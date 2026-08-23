const fs = require('fs');
let code = fs.readFileSync('functions/api/lead.js', 'utf8');
code = code.replace('export async function onRequestPost(context) {', 'export async function onRequestPost(context) {\n  try {');
// Replace the LAST }
const lastIndex = code.lastIndexOf('}');
if (lastIndex !== -1) {
  code = code.substring(0, lastIndex) + '  } catch(globalErr) { return new Response(JSON.stringify({ error: "global_crash", message: globalErr.message, stack: globalErr.stack }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }); }\n}' + code.substring(lastIndex + 1);
}
fs.writeFileSync('functions/api/lead.js', code);
