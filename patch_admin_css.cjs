const fs = require('fs');
let code = fs.readFileSync('functions/_shared/admin-renderer.js', 'utf8');

const oldFlex = '<div style="display: flex; gap: 1rem;">';
const newFlex = '<div style="display: flex; gap: 1rem; align-items: flex-end;">';

code = code.replace(oldFlex, newFlex); // Let's hope it's unique!

fs.writeFileSync('functions/_shared/admin-renderer.js', code);
