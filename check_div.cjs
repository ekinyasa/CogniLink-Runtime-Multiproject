const fs = require('fs');
const code = fs.readFileSync('functions/_shared/admin-renderer.js', 'utf8');
const lines = code.split('\n');

let intentWorkspaceStart = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('id="intent-workspace"')) {
    intentWorkspaceStart = i;
    break;
  }
}

let depth = 0;
for (let i = intentWorkspaceStart; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('<div')) depth += (line.match(/<div/g) || []).length;
  if (line.includes('</div')) depth -= (line.match(/<\/div/g) || []).length;
  if (line.includes('id="modal-new-intent"')) {
    console.log("Modal found at line " + (i + 1) + " with depth " + depth);
  }
  if (depth === 0) {
    console.log("intent-workspace ends at line " + (i + 1));
    break;
  }
}
