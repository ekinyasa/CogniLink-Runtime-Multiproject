const fs = require('fs');
let code = fs.readFileSync('functions/[[path]].js', 'utf8');

code = code.replace(
  'if (url.hostname === "login.teklifi.online" && (rawPath === "/" || rawPath === "")) {',
  'if (originalHost === "login.teklifi.online" && (rawPath === "/" || rawPath === "")) {'
);

fs.writeFileSync('functions/[[path]].js', code);
