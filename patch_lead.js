import fs from 'fs';
let code = fs.readFileSync('functions/api/lead.js', 'utf8');

// The `api/lead.js` receives `productSubdomain` through the URL sometimes, but wait, `reqProd` could be determined from the `body` or `referer`.
// Let's find where we extract `cleanSlug`. We can extract product from `cleanSlug`!
const findUpdateStr = `user = updateUserState(user, {
      c: 1,
      h: 0,
      e: Math.min(100, (user.e || 0) + 30),
      t: newTags
    });`;

const replacement = `const reqProd = cleanSlug ? cleanSlug.split('-')[0] : null;
    user = updateUserState(user, {
      c: 1,
      h: 0,
      e: Math.min(100, (user.e || 0) + 30),
      t: newTags
    }, reqProd);`;

code = code.replace(findUpdateStr, replacement);
fs.writeFileSync('functions/api/lead.js', code);
console.log("api/lead.js patched");
