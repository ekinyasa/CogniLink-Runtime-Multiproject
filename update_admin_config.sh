#!/bin/bash
awk '
/id="cfg-custom-js"/ {
    print $0
    print ""
    print "        <label for=\"cfg-turnstile-site-key\">Cloudflare Turnstile Site Key <span class=\"hint-inline\">(optional; invisible captcha)</span></label>"
    print "        <input id=\"cfg-turnstile-site-key\" type=\"text\" placeholder=\"0x4AAAAAA...\" />"
    next
}
/document\.getElementById\("cfg-custom-js"\)\.value = c\.customScript/ {
    print $0
    print "        document.getElementById(\"cfg-turnstile-site-key\").value = c.turnstileSiteKey || \"\";"
    next
}
/customScript: document\.getElementById\("cfg-custom-js"\)\.value,/ {
    print $0
    print "      turnstileSiteKey: document.getElementById(\"cfg-turnstile-site-key\").value.trim(),"
    next
}
{ print }
' functions/_shared/admin-renderer.js > temp_admin.js
mv temp_admin.js functions/_shared/admin-renderer.js
