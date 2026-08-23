const fs = require('fs');
let code = fs.readFileSync('functions/_shared/admin-renderer.js', 'utf8');

const oldLandingSave = `          var lName = document.getElementById("studio-version-display-name").value.trim();
          var lSlug = document.getElementById("studio-version-slug").value.trim();
          var lAlias = document.getElementById("studio-version-alias").value.trim();`;

const newLandingSave = `          var lName = document.getElementById("studio-version-display-name").value.trim();
          var lSlug = document.getElementById("studio-version-slug").value.trim();
          var lAlias = document.getElementById("studio-version-alias").value.trim();
          
          var prod = studioCampaignConfig.product;
          if (prod) {
             var cleanProd = normalizeSlug(prod);
             if (lSlug && !lSlug.startsWith(cleanProd + "-")) lSlug = cleanProd + "-" + lSlug;
             if (lAlias && !lAlias.startsWith(cleanProd + "-")) lAlias = cleanProd + "-" + lAlias;
          }`;
          
code = code.replace(oldLandingSave, newLandingSave);

// And we must STRIP them when editing a Landing Version!
const oldEditLoad = `      document.getElementById("studio-version-slug").value = l.slug || l.id || "";
      document.getElementById("studio-version-alias").value = l.alias || "";`;

const newEditLoad = `      var eSlug = l.slug || l.id || "";
      var eAlias = l.alias || "";
      if (studioCampaignConfig.product) {
         var prefix = normalizeSlug(studioCampaignConfig.product) + "-";
         if (eSlug.startsWith(prefix)) eSlug = eSlug.substring(prefix.length);
         if (eAlias.startsWith(prefix)) eAlias = eAlias.substring(prefix.length);
      }
      document.getElementById("studio-version-slug").value = eSlug;
      document.getElementById("studio-version-alias").value = eAlias;`;

code = code.replace(oldEditLoad, newEditLoad);
fs.writeFileSync('functions/_shared/admin-renderer.js', code);
