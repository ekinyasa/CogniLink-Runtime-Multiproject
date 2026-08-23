const fs = require('fs');
let code = fs.readFileSync('functions/_shared/slug-utils.js', 'utf8');
code = code.replace(
  '  "www", "admin", "login", "api", "assets", "static", "dash", "dashboard", "my", "app", "test", "demo"',
  '  "www", "admin", "login", "api", "assets", "static", "dash", "dashboard", "my", "app", "test", "demo", "sigorta"'
);
fs.writeFileSync('functions/_shared/slug-utils.js', code);
