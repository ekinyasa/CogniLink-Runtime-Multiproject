const fs = require('fs');
let code = fs.readFileSync('functions/_shared/admin-renderer.js', 'utf8');

code = code.replace(
  '$("cfg-custom-js").value   = cfg.customScript || "";',
  '$("cfg-custom-js").value   = cfg.customScript || "";\n      $("cfg-turnstile-site-key").value = cfg.turnstileSiteKey || "";'
);

code = code.replace(
  'customScript:   $("cfg-custom-js").value.trim()    || null,',
  'customScript:   $("cfg-custom-js").value.trim()    || null,\n        turnstileSiteKey: $("cfg-turnstile-site-key").value.trim() || null,'
);

fs.writeFileSync('functions/_shared/admin-renderer.js', code);
