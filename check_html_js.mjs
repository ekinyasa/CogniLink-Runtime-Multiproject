import fs from 'fs';
const code = fs.readFileSync('functions/_shared/admin-renderer.js', 'utf8');
const scriptMatch = code.match(/<script>\s*\(\s*function\s*\(\)\s*\{([\s\S]*?)\}\(\)\);\s*<\/script>/);

if (scriptMatch) {
  const scriptContent = "(function(){" + scriptMatch[1] + "}());";
  fs.writeFileSync('temp_script.js', scriptContent);
} else {
  console.log("Regex failed to extract");
}
