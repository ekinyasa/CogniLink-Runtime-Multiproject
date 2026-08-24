import fs from 'fs';
let code = fs.readFileSync('functions/_shared/hub-renderer.js', 'utf8');

const targetRenderStr = `turnstileWidgetId = turnstile.render(tdiv, {
              sitekey: turnstileSiteKey,
              size: "invisible",
              callback: function(token) {
                doSubmit(token);
              }
            });`;

const replacementRenderStr = `turnstileWidgetId = turnstile.render(tdiv, {
              sitekey: turnstileSiteKey,
              size: "invisible",
              execution: "execute",
              callback: function(token) {
                if (f.dataset.isSubmitting === "true") {
                  doSubmit(token);
                }
              }
            });`;

// We also need to set dataset.isSubmitting = "true" when the form is submitted!
const targetSubmitStr = `f.addEventListener("submit", function(e) {
          e.preventDefault();
          if (turnstileWidgetId !== null && typeof turnstile !== "undefined") {
            try {
              turnstile.execute(turnstileWidgetId);`;

const replacementSubmitStr = `f.addEventListener("submit", function(e) {
          e.preventDefault();
          f.dataset.isSubmitting = "true";
          if (turnstileWidgetId !== null && typeof turnstile !== "undefined") {
            try {
              turnstile.execute(turnstileWidgetId);`;

if (code.includes(targetRenderStr)) {
  code = code.replace(new RegExp(targetRenderStr.replace(/[.*+?^\${}()|[\]\\]/g, '\\$&'), 'g'), replacementRenderStr);
} else {
  console.log("Could not find targetRenderStr!");
}

if (code.includes(targetSubmitStr)) {
  code = code.replace(new RegExp(targetSubmitStr.replace(/[.*+?^\${}()|[\]\\]/g, '\\$&'), 'g'), replacementSubmitStr);
} else {
  console.log("Could not find targetSubmitStr!");
}

fs.writeFileSync('functions/_shared/hub-renderer.js', code);
console.log("Turnstile logic patched successfully.");
