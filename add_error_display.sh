#!/bin/bash
awk '
/<\/body>/ {
    print "  <script>"
    print "    document.addEventListener(\"DOMContentLoaded\", function() {"
    print "      try {"
    print "        var p = new URLSearchParams(window.location.search);"
    print "        var err = p.get(\"error\");"
    print "        if (err) {"
    print "          var f = document.querySelector(\"form\");"
    print "          if (f) {"
    print "            var d = document.createElement(\"div\");"
    print "            d.style.cssText = \"background:#fee2e2;color:#991b1b;padding:12px;border-radius:6px;border:1px solid #f87171;margin-bottom:16px;font-weight:500;text-align:center;font-size:14px;\";"
    print "            d.textContent = err;"
    print "            f.insertBefore(d, f.firstChild);"
    print "            if(window.history && window.history.replaceState) {"
    print "              p.delete(\"error\");"
    print "              var newUrl = window.location.pathname + (p.toString() ? \"?\" + p.toString() : \"\") + window.location.hash;"
    print "              window.history.replaceState({}, \"\", newUrl);"
    print "            }"
    print "          }"
    print "        }"
    print "      } catch(e) {}"
    print "    });"
    print "  </script>"
    print $0
    next
}
{ print }
' functions/_shared/hub-renderer.js > temp_hub.js
mv temp_hub.js functions/_shared/hub-renderer.js
