import fs from 'fs';
let code = fs.readFileSync('functions/api/lead.js', 'utf8');

const findNewUserStr = `    user.uid = crypto.randomUUID();
    user.v = 1;
    user.c = 1; 
    user.h = 0;
    user.e = 100;
    user.u = 0;
    user.t = ["lead_submitted"];
    user.ts = now;`;

const replacement = `    user.uid = crypto.randomUUID();
    user.ts = now;
    const reqProd = cleanSlug ? cleanSlug.split('-')[0] : null;
    user = updateUserState(user, { v: 1, c: 1, h: 0, e: 100, u: 0, t: ["lead_submitted"] }, reqProd);`;

code = code.replace(findNewUserStr, replacement);
fs.writeFileSync('functions/api/lead.js', code);
console.log("api/lead.js patched for new user");
