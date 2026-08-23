#!/bin/bash
awk '
/      var products = Array.from\(productsSet\)\.sort\(\);/ {
    print $0
    print "      function esc(s) { return String(s || \"\").replace(/&/g,\"&amp;\").replace(/</g,\"&lt;\").replace(/>/g,\"&gt;\").replace(/\"/g,\"&quot;\"); }"
    next
}
/          filterSelect\.innerHTML \+= '\''<option value="'\'' \+ escAttr\(p\) \+ '\''">'\'' \+ escHtml\(p\) \+ '\''<\/option>'\'';/ {
    print "          filterSelect.innerHTML += '\''<option value=\"'\'' + esc(p) + '\''\">'\'' + esc(p) + '\''</option>'\'';"
    next
}
/          dataList\.innerHTML \+= '\''<option value="'\'' \+ escAttr\(p\) \+ '\''">'\''/ {
    print "          dataList.innerHTML += '\''<option value=\"'\'' + esc(p) + '\''\">'\'';"
    next
}
{ print }
' functions/_shared/admin-renderer.js > temp3.js
mv temp3.js functions/_shared/admin-renderer.js
