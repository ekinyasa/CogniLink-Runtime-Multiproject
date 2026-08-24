import fs from 'fs';
let code = fs.readFileSync('functions/_shared/hub-renderer.js', 'utf8');

const currentEndStr = `          }).catch(function(err) {
            if (submitBtn) {
              submitBtn.disabled = false;
              if (submitBtn.tagName === "BUTTON") submitBtn.textContent = originalBtnText;
              else submitBtn.value = originalBtnText;
            }
        });
      });
    });
        });
      });
  </script>
</body>
</html>\`;
}`;

const correctEndStr = `          }).catch(function(err) {
            if (submitBtn) {
              submitBtn.disabled = false;
              if (submitBtn.tagName === "BUTTON") submitBtn.textContent = originalBtnText;
              else submitBtn.value = originalBtnText;
            }
          });
        });
      });
    });
  </script>
</body>
</html>\`;
}`;

if (code.includes(currentEndStr)) {
  console.log("Found bad ending, fixing...");
  code = code.replace(currentEndStr, correctEndStr);
  fs.writeFileSync('functions/_shared/hub-renderer.js', code);
} else {
  console.log("Could not find bad ending.");
}
