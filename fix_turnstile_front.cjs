const fs = require('fs');
let code = fs.readFileSync('functions/_shared/hub-renderer.js', 'utf8');

// 1. Inject script tag into <head>
const turnstileHead = `  const turnstileScript = cfg.turnstileSiteKey ? \`\\n<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"></script>\` : "";`;
code = code.replace(
  '  const globalJsLink = cfg.customScript',
  `${turnstileHead}\n  const globalJsLink = cfg.customScript`
);
code = code.replace(
  '${globalCssLink}',
  '${globalCssLink}\n${turnstileScript}'
);

// 2. Add Turnstile widget logic to DOMContentLoaded
const formScriptStart = `
      // Intercept form submits for seamless validation without reset
      var turnstileSiteKey = "${"$"}{escAttr(cfg.turnstileSiteKey || "")}";
      var forms = document.querySelectorAll("form[action='/api/lead']");
      forms.forEach(function(f) {
        var turnstileWidgetId = null;
        if (turnstileSiteKey && typeof turnstile !== "undefined") {
          var tdiv = document.createElement("div");
          tdiv.className = "cf-turnstile";
          f.appendChild(tdiv);
          try {
            turnstileWidgetId = turnstile.render(tdiv, {
              sitekey: turnstileSiteKey,
              size: "invisible",
              callback: function(token) {
                doSubmit(token);
              }
            });
          } catch (e) {
            console.error("Turnstile error:", e);
          }
        }

        f.addEventListener("submit", function(e) {
          e.preventDefault();
          if (turnstileWidgetId !== null && typeof turnstile !== "undefined") {
            try {
              turnstile.execute(turnstileWidgetId);
            } catch (e) {
              doSubmit(null);
            }
          } else {
            doSubmit(null);
          }
        });

        function doSubmit(turnstileToken) {
          var existingAlert = f.querySelector(".form-error-alert");
`;

code = code.replace(
  `      // Intercept form submits for seamless validation without reset
      var forms = document.querySelectorAll("form[action='/api/lead']");
      forms.forEach(function(f) {
        f.addEventListener("submit", function(e) {
          e.preventDefault();
          
          var existingAlert = f.querySelector(".form-error-alert");`,
  formScriptStart
);

const submitEndReplace = `          var formData = new FormData(f);
          var jsonBody = {};
          formData.forEach(function(value, key) {
            if (jsonBody[key] !== undefined) {
              if (!Array.isArray(jsonBody[key])) {
                jsonBody[key] = [jsonBody[key]];
              }
              jsonBody[key].push(value);
            } else {
              jsonBody[key] = value;
            }
          });
          if (turnstileToken) {
            jsonBody["cf-turnstile-response"] = turnstileToken;
          }`;

code = code.replace(
  `          var formData = new FormData(f);
          var jsonBody = {};
          formData.forEach(function(value, key) {
            if (jsonBody[key] !== undefined) {
              if (!Array.isArray(jsonBody[key])) {
                jsonBody[key] = [jsonBody[key]];
              }
              jsonBody[key].push(value);
            } else {
              jsonBody[key] = value;
            }
          });`,
  submitEndReplace
);

// Catch reset block
const errorResetReplace = `              if (submitBtn) {
                if (turnstileWidgetId !== null && typeof turnstile !== "undefined") {
                   turnstile.reset(turnstileWidgetId);
                }
                submitBtn.disabled = false;`;

code = code.replace(
  `              if (submitBtn) {
                submitBtn.disabled = false;`,
  errorResetReplace
);

// End of doSubmit
code = code.replace(
  `          }).catch(function(err) {
            if (submitBtn) {
              submitBtn.disabled = false;
              if (submitBtn.tagName === "BUTTON") submitBtn.textContent = originalBtnText;
              else submitBtn.value = originalBtnText;
            }
          });
        });
      });`,
  `          }).catch(function(err) {
            if (submitBtn) {
              if (turnstileWidgetId !== null && typeof turnstile !== "undefined") {
                 turnstile.reset(turnstileWidgetId);
              }
              submitBtn.disabled = false;
              if (submitBtn.tagName === "BUTTON") submitBtn.textContent = originalBtnText;
              else submitBtn.value = originalBtnText;
            }
          });
        }
      });`
);

fs.writeFileSync('functions/_shared/hub-renderer.js', code);
