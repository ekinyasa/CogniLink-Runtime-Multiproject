import { renderAdmin } from './functions/_shared/admin-renderer.js';
import fs from 'fs';

const html = renderAdmin({});
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (scriptMatch) {
  fs.writeFileSync('evaluated_script.js', scriptMatch[1]);
}
