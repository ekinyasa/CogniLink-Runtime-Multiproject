const fs = require('fs');
const html = fs.readFileSync('funnel-mapper-UI.html', 'utf8');
let js = fs.readFileSync('functions/_shared/admin-renderer.js', 'utf8');
if (!js.includes('VISUAL_MAPPER_HTML')) {
  js += "\n\nwindow.VISUAL_MAPPER_HTML = `" + html.replace(/`/g, '\\`').replace(/\$/g, '\\$') + "`;\n";
  fs.writeFileSync('functions/_shared/admin-renderer.js', js);
  console.log("Injected!");
}
