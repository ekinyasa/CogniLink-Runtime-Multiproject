const fs = require('fs');
let code = fs.readFileSync('functions/l/[slug].js', 'utf8');

const oldFind = `  const found = await findLandingVersionBySlug(slug, env);`;
const newFind = `  let found = null;
  if (productSubdomain) {
    found = await findLandingVersionBySlug(productSubdomain + "-" + slug, env);
  }
  if (!found) {
    found = await findLandingVersionBySlug(slug, env);
  }`;
  
code = code.replace(oldFind, newFind);
fs.writeFileSync('functions/l/[slug].js', code);
