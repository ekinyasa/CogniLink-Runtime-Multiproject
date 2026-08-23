#!/bin/bash
awk '
/      confirmBtn\.addEventListener\("click", async function\(\) \{/ {
    print "      newIntentBtn.addEventListener(\"click\", function () {"
    print "        idInput.value = \"\";"
    print "        productInput.value = \"\";"
    print "        modal.style.display = \"flex\";"
    print "      });"
    print "      cancelBtn.addEventListener(\"click\", function() {"
    print "        modal.style.display = \"none\";"
    print "      });"
    print $0
    next
}
{ print }
' functions/_shared/admin-renderer.js > temp_fix.js
mv temp_fix.js functions/_shared/admin-renderer.js
