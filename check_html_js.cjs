const fs = require('fs');
const { parse } = require('acorn');

const code = fs.readFileSync('functions/_shared/admin-renderer.js', 'utf8');

// Extract the script content inside the HTML literal
const scriptMatch = code.match(/<script>([\s\S]*?)<\/script>/);

if (scriptMatch) {
  const scriptContent = scriptMatch[1];
  try {
    parse(scriptContent, { ecmaVersion: 2020 });
    console.log("Syntax is OK!");
  } catch (e) {
    console.log("Syntax Error:", e.message);
    // Print a few lines around the error
    const lines = scriptContent.split('\n');
    const errLine = e.loc.line - 1;
    console.log("Line " + (errLine + 1) + ":", lines[errLine]);
  }
} else {
  console.log("No script tag found!");
}
