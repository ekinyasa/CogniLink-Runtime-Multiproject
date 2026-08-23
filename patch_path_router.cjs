const fs = require('fs');
let code = fs.readFileSync('functions/[[path]].js', 'utf8');

const oldAliasLookup = `  // Resolve Alias
  let kvSlug = await resolveAlias(env, routeKey);`;

const newAliasLookup = `  // Resolve Alias (Support Clean URLs: Subdomain + Path)
  let kvSlug = null;
  if (productSubdomain) {
    kvSlug = await resolveAlias(env, productSubdomain + "-" + routeKey);
  }
  if (!kvSlug) {
    kvSlug = await resolveAlias(env, routeKey);
  }`;

code = code.replace(oldAliasLookup, newAliasLookup);
fs.writeFileSync('functions/[[path]].js', code);
