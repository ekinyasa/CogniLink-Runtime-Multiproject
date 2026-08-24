import fs from 'fs';
let code = fs.readFileSync('functions/_shared/hub-renderer.js', 'utf8');

const badNormalBlock = `      // Intercept form submits for seamless validation without reset
      var forms = document.querySelectorAll("form[action='/api/lead']");
      forms.forEach(function(f) {
        f.addEventListener("submit", function(e) {
          e.preventDefault();
          
          var existingAlert = f.querySelector(".form-error-alert");
          if (existingAlert) existingAlert.remove();
          
          var submitBtn = f.querySelector("button[type='submit']") || f.querySelector("input[type='submit']");
          var originalBtnText = submitBtn ? (submitBtn.textContent || submitBtn.value) : "";
          if (submitBtn) {
            submitBtn.disabled = true;
            if (submitBtn.tagName === "BUTTON") submitBtn.textContent = "Lütfen Bekleyin...";
            else submitBtn.value = "Lütfen Bekleyin...";
          }

          var formData = new FormData(f);
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
          
          fetch("/api/lead", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(jsonBody)
          })
          .then(async function(res) {
            if (res.ok) {
              var red = formData.get("_redirect");
              if (red) window.location.href = red;
              else alert("Talebiniz başarıyla alındı.");
            } else {
              var data = await res.json().catch(function(){ return {}; });
              var errMsg = data.error || "Geçersiz bilgi girdiniz. Lütfen kontrol edin.";
              
              var d = document.createElement("div");
              d.className = "form-error-alert";
              d.style.cssText = "background:#fee2e2;color:#991b1b;padding:12px;border-radius:6px;border:1px solid #f87171;margin-bottom:16px;font-weight:500;text-align:center;font-size:14px;";
              d.textContent = errMsg;
              f.insertBefore(d, f.firstChild);
              
              if (submitBtn) {
                submitBtn.disabled = false;
                if (submitBtn.tagName === "BUTTON") submitBtn.textContent = originalBtnText;
                else submitBtn.value = originalBtnText;
              }
            }
          }).catch(function(err) {
            if (submitBtn) {
              submitBtn.disabled = false;
              if (submitBtn.tagName === "BUTTON") submitBtn.textContent = originalBtnText;
              else submitBtn.value = originalBtnText;
            }
          });
        });
      });
    });
  </script>`;

const goodNormalBlock = `      // Intercept form submits for seamless validation without reset
      var turnstileSiteKey = "\${escAttr(cfg.turnstileSiteKey || "")}";
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
          if (existingAlert) existingAlert.remove();
          
          var submitBtn = f.querySelector("button[type='submit']") || f.querySelector("input[type='submit']");
          var originalBtnText = submitBtn ? (submitBtn.textContent || submitBtn.value) : "";
          if (submitBtn) {
            submitBtn.disabled = true;
            if (submitBtn.tagName === "BUTTON") submitBtn.textContent = "Lütfen Bekleyin...";
            else submitBtn.value = "Lütfen Bekleyin...";
          }

          var formData = new FormData(f);
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
          }
          
          fetch("/api/lead", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(jsonBody)
          })
          .then(async function(res) {
            if (res.ok) {
              var red = formData.get("_redirect");
              if (red) window.location.href = red;
              else alert("Talebiniz başarıyla alındı.");
            } else {
              var data = await res.json().catch(function(){ return {}; });
              var errMsg = data.error || "Geçersiz bilgi girdiniz. Lütfen kontrol edin.";
              
              var d = document.createElement("div");
              d.className = "form-error-alert";
              d.style.cssText = "background:#fee2e2;color:#991b1b;padding:12px;border-radius:6px;border:1px solid #f87171;margin-bottom:16px;font-weight:500;text-align:center;font-size:14px;";
              d.textContent = errMsg;
              f.insertBefore(d, f.firstChild);
              
              if (submitBtn) {
                if (turnstileWidgetId !== null && typeof turnstile !== "undefined") {
                   turnstile.reset(turnstileWidgetId);
                }
                submitBtn.disabled = false;
                if (submitBtn.tagName === "BUTTON") submitBtn.textContent = originalBtnText;
                else submitBtn.value = originalBtnText;
              }
            }
          }).catch(function(err) {
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
      });
    });
  </script>`;

if (code.includes(badNormalBlock)) {
  console.log("Fixing missing turnstile in normal block...");
  code = code.replace(badNormalBlock, goodNormalBlock);
  fs.writeFileSync('functions/_shared/hub-renderer.js', code);
} else {
  console.log("Could not find bad normal block.");
}
