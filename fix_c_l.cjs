const fs = require('fs');
let code = fs.readFileSync('functions/_shared/admin-renderer.js', 'utf8');

code = code.replace(
  'return clean ? (base + "/c/" + clean) : ""; // Changed from /l/ to /c/ for Intent URLs',
  'return clean ? (base + "/l/" + clean) : "";'
);

fs.writeFileSync('functions/_shared/admin-renderer.js', code);
