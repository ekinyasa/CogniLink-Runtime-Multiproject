const fs = require('fs');
let code = fs.readFileSync('functions/_shared/admin-renderer.js', 'utf8');
const badStr = `(c.product ? ' <span style="font-size:0.7rem; color:var(--text-m); background:var(--bg); border: 1px solid var(--border); padding: 0.1rem 0.3rem; border-radius: 3px;">' + esc(c.product) + '</span>' : ') +`;
const goodStr = `(c.product ? ' <span style="font-size:0.7rem; color:var(--text-m); background:var(--bg); border: 1px solid var(--border); padding: 0.1rem 0.3rem; border-radius: 3px;">' + esc(c.product) + '</span>' : '') +`;
if (code.includes(badStr)) {
  code = code.replace(badStr, goodStr);
  fs.writeFileSync('functions/_shared/admin-renderer.js', code);
  console.log("Replaced!");
} else {
  console.log("Not found!");
}
