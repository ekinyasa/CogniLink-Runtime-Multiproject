import fs from 'fs';
const code = fs.readFileSync('test_brackets.js', 'utf8');
let level = 0;
const lines = code.split('\n');
for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  let changes = 0;
  for (let j = 0; j < line.length; j++) {
    if (line[j] === '{') changes++;
    if (line[j] === '}') changes--;
  }
  level += changes;
  console.log((i+1) + " (Level " + level + "): " + line);
}
