const fs = require('fs');
let code = fs.readFileSync('functions/_shared/admin-renderer.js', 'utf8');

code = code.replace(
  'var canonicalUrl = buildLandingCanonicalUrl(l.slug || l.id, l.product || (c && c.product));',
  'var canonicalUrl = buildLandingCanonicalUrl(l.slug || l.id, l.product || studioCampaignConfig.product);'
);
code = code.replace(
  'var aliasUrl = l.alias ? buildLandingAliasUrl(l.alias, l.product || (c && c.product)) : "";',
  'var aliasUrl = l.alias ? buildLandingAliasUrl(l.alias, l.product || studioCampaignConfig.product) : "";'
);

fs.writeFileSync('functions/_shared/admin-renderer.js', code);
