import fs from 'fs';
let code = fs.readFileSync('functions/[[path]].js', 'utf8');

const target = `const intentDestinations = campRecord?.destinations || campRecord?.routing?.destinations || null;`;
const replacement = `const baseDest = campRecord?.destinations || campRecord?.routing?.destinations || {};
  const intentDestinations = Object.keys(baseDest).length > 0 || (landingRecord?.destinations && Object.keys(landingRecord.destinations).length > 0) ? Object.assign({}, baseDest, landingRecord?.destinations || {}) : null;`;

code = code.replace(target, replacement);
fs.writeFileSync('functions/[[path]].js', code);
console.log("path.js patched");
