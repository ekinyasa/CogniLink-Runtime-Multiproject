import { renderAdmin } from './functions/_shared/admin-renderer.js';
import fs from 'fs';
const html = renderAdmin({
  name: "admin",
  description: "admin",
  version: "1.0",
  user: { uid: "123", email: "test@test.com" }
}, false, false, "https://test.com", "v1.0", "v1", "v1");

fs.writeFileSync('output_admin.html', html);

const scriptRegex = /<script>([\s\S]*?)<\/script>/g;
let match;
let i = 1;
while ((match = scriptRegex.exec(html)) !== null) {
  fs.writeFileSync('output_admin_script_' + i + '.js', match[1]);
  i++;
}
console.log("Extracted", i - 1, "scripts.");
