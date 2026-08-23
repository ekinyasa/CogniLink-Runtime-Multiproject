const fs = require('fs');
let code = fs.readFileSync('functions/_shared/admin-renderer.js', 'utf8');

const oldSave = `        var product = document.getElementById("studio-intent-product").value.trim();
        var defaultSlug = null; // No longer used, handled by Intent mainLandingId`;

const newSave = `        var product = document.getElementById("studio-intent-product").value.trim();
        var defaultSlug = null; // No longer used, handled by Intent mainLandingId
        
        if (alias && product) {
          var cleanProd = normalizeSlug(product);
          if (cleanProd && !alias.startsWith(cleanProd + "-")) {
            alias = cleanProd + "-" + alias;
          }
        }`;
        
code = code.replace(oldSave, newSave);
fs.writeFileSync('functions/_shared/admin-renderer.js', code);
