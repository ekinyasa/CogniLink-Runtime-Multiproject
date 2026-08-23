const fs = require('fs');
let code = fs.readFileSync('functions/admin/index.js', 'utf8');

code = code.replace(
  'return Response.redirect(`https://login.teklifi.online${url.pathname}${url.search}`, 301);',
  'return Response.redirect(`https://login.teklifi.online/${url.search}`, 301);'
);

// We should also redirect login.teklifi.online/admin to login.teklifi.online/
const enforceRoot = `  if (url.hostname === "login.teklifi.online") {
    return Response.redirect(\`https://login.teklifi.online/\${url.search}\`, 301);
  }

  // Enforce login.teklifi.online for admin panel`;
code = code.replace('  // Enforce login.teklifi.online for admin panel', enforceRoot);

fs.writeFileSync('functions/admin/index.js', code);
