#!/bin/bash
# 1. Update the button
sed -i '' 's/id="btn-studio-new-intent" onclick="document.getElementById('\''modal-new-intent'\'').style.display='\''flex'\''"/id="btn-studio-new-intent" onclick="window.openNewIntentModal(event)"/' functions/_shared/admin-renderer.js

# 2. Update the modal style
sed -i '' 's/z-index: 1000;/z-index: 999999;/g' functions/_shared/admin-renderer.js
sed -i '' 's/background: var(--surface)/background: var(--surface, #1e1e1e)/g' functions/_shared/admin-renderer.js

# 3. Add the global function
awk '
/<script>/ {
    print $0
    print "window.openNewIntentModal = function(e) {"
    print "  if (e) e.preventDefault();"
    print "  var modal = document.getElementById('\''modal-new-intent'\'');"
    print "  if (modal) {"
    print "    modal.style.display = '\''flex'\'';"
    print "    console.log(\"Modal opened\");"
    print "  } else {"
    print "    alert(\"Modal element not found in DOM!\");"
    print "  }"
    print "};"
    next
}
{ print }
' functions/_shared/admin-renderer.js > temp_fool.js
mv temp_fool.js functions/_shared/admin-renderer.js
