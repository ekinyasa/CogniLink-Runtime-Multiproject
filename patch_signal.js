import fs from 'fs';
let code = fs.readFileSync('functions/api/decision/signal.js', 'utf8');

// Inject reqProd extraction
code = code.replace(/const body = await request\.json\(\);/, 'const body = await request.json();\n    const reqProd = body.meta?.product || null;');

// Replace all updateUserState(user, { ... }) with updateUserState(user, { ... }, reqProd)
// Need a smart regex for this since the object can vary.
code = code.replace(/updateUserState\((user,\s*[^,;]+)\)/g, 'updateUserState($1, reqProd)');

// Re-clean the double reqProd I added via sed earlier
code = code.replace(/const reqProd = body\.meta\?\.product \|\| null;\s*user = updateUserState\(([^)]+)\)/g, 'user = updateUserState($1)');

fs.writeFileSync('functions/api/decision/signal.js', code);
console.log("signal.js patched");
