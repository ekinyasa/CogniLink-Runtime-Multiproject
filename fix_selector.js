import fs from 'fs';
let code = fs.readFileSync('functions/_shared/hub-renderer.js', 'utf8');

const replacement = `var forms = document.querySelectorAll("form:not([action]), form[action=''], form[action='/api/lead'], form[data-quote-form]");`;
code = code.replace(/var forms = document\.querySelectorAll\("form"\);/g, replacement);

fs.writeFileSync('functions/_shared/hub-renderer.js', code);
