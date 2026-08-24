import fs from 'fs';
let code = fs.readFileSync('functions/l/[slug].js', 'utf8');

const target = `intentDestinations: campaign?.destinations || campaign?.routing?.destinations || null,`;
const replacement = `intentDestinations: Object.keys(campaign?.destinations || campaign?.routing?.destinations || {}).length > 0 || (landing?.destinations && Object.keys(landing.destinations).length > 0) ? Object.assign({}, campaign?.destinations || campaign?.routing?.destinations || {}, landing?.destinations || {}) : null,`;

code = code.replace(target, replacement);
fs.writeFileSync('functions/l/[slug].js', code);
console.log("l/[slug].js patched");
