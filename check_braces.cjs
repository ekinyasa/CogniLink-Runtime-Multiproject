const fs = require('fs');
const code = fs.readFileSync('functions/_shared/admin-renderer.js', 'utf8');
const lines = code.split('\n');
let depth = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('{')) depth += (line.match(/\{/g) || []).length;
  if (line.includes('}')) depth -= (line.match(/\}/g) || []).length;
  if (i >= 5172 && depth === 0) { // 0-indexed
    console.log(`selectCampaign closes at line ${i + 1}`);
    break;
  }
}
console.log(`Final depth: ${depth}`);
