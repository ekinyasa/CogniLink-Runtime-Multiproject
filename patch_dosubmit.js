import fs from 'fs';
let code = fs.readFileSync('functions/_shared/hub-renderer.js', 'utf8');

const targetStr = `function doSubmit(turnstileToken) {
          var existingAlert = f.querySelector(".form-error-alert");`;

const replacementStr = `function doSubmit(turnstileToken) {
          f.dataset.isSubmitting = "false";
          var existingAlert = f.querySelector(".form-error-alert");`;

code = code.replace(new RegExp(targetStr.replace(/[.*+?^\${}()|[\]\\]/g, '\\$&'), 'g'), replacementStr);

fs.writeFileSync('functions/_shared/hub-renderer.js', code);
console.log("doSubmit patched successfully.");
