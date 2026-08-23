const fs = require('fs');
const code = fs.readFileSync('temp_js.js', 'utf8'); // temp_js.js has the inline JS
// Just strip all strings and regexes roughly
let stripped = code.replace(/(["'`])(?:\\.|(?!\1)[^\\])*\1/g, '""');
stripped = stripped.replace(/\/\*[\s\S]*?\*\//g, '');
stripped = stripped.replace(/\/\/.*/g, '');
let lines = stripped.split('\n');
let depth = 0;
for(let i = 0; i < lines.length; i++) {
  let line = lines[i];
  let opens = (line.match(/\{/g) || []).length;
  let closes = (line.match(/\}/g) || []).length;
  depth += opens - closes;
  if(i >= 5172 && depth === 1) { // Wait, the IIFE makes depth 1 at the root. So selectCampaign makes it 2!
      // Actually let's just print depth at 5946
  }
}
console.log("Final depth:", depth);
