#!/bin/bash
# 1. Delete it from the bottom
awk '
/    var newIntentBtn = document.getElementById\("btn-studio-new-intent"\);/ {
    skip = 1
}
skip && /      \}\);/ {
    skip2 = skip2 + 1
}
skip && skip2 == 3 && /    \}/ { 
    skip = 0
    next
}
skip { next }
{ print }
' functions/_shared/admin-renderer.js > temp_del.js

# 2. Insert it at line 1640
awk '
NR == 1640 {
    print "    // --- NEW INTENT MODAL LOGIC ---"
    print "    var newIntentBtn = document.getElementById(\"btn-studio-new-intent\");"
    print "    var modal = document.getElementById(\"modal-new-intent\");"
    print "    var cancelBtn = document.getElementById(\"btn-cancel-new-intent\");"
    print "    var confirmBtn = document.getElementById(\"btn-confirm-new-intent\");"
    print "    var idInput = document.getElementById(\"new-intent-id\");"
    print "    var productInput = document.getElementById(\"new-intent-product\");"
    print ""
    print "    if (newIntentBtn && !newIntentBtn.dataset.wired) {"
    print "      newIntentBtn.dataset.wired = \"1\";"
    print "      "
    print "      confirmBtn.addEventListener(\"click\", async function() {"
    print "        var name = idInput.value.trim().toLowerCase();"
    print "        var product = productInput.value.trim();"
    print "        if (!name) {"
    print "          alert(\"Intent Name is required.\");"
    print "          return;"
    print "        }"
    print "        if (name.length > 1 && !/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(name)) {"
    print "          alert(\"Invalid name. Lowercase letters, numbers, hyphens (no leading/trailing hyphen).\");"
    print "          return;"
    print "        }"
    print "        "
    print "        confirmBtn.disabled = true;"
    print "        confirmBtn.textContent = \"Creating...\";"
    print "        try {"
    print "          var createBody = { name: name, alias: name, product: product || null };"
    print "          if (typeof selectedWorkspace !== \"undefined\" && selectedWorkspace) createBody.workspace = selectedWorkspace;"
    print "          var res = await apiFetch(\"/api/campaign\", {"
    print "            method: \"POST\", body: JSON.stringify(createBody)"
    print "          });"
    print "          var data = await res.json();"
    print "          if (res.ok) {"
    print "            modal.style.display = \"none\";"
    print "            if (typeof loadCampaignList === \"function\") await loadCampaignList();"
    print "            if (typeof selectCampaign === \"function\") selectCampaign(name);"
    print "            else if (typeof window.selectCampaign === \"function\") window.selectCampaign(name);"
    print "          } else {"
    print "            alert(\"Error: \" + (data.error || \"Failed to create intent\"));"
    print "          }"
    print "        } catch (e) {"
    print "          alert(\"Failed to create intent: \" + e.toString());"
    print "        } finally {"
    print "          confirmBtn.disabled = false;"
    print "          confirmBtn.textContent = \"Create Intent\";"
    print "        }"
    print "      });"
    print "    }"
    print "    // ------------------------------"
}
{ print }
' temp_del.js > temp_ins.js

mv temp_ins.js functions/_shared/admin-renderer.js
