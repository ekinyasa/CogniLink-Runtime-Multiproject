#!/bin/bash
awk '
/const globalCssLink =/ {
    print "  const turnstileScript = cfg.turnstileSiteKey ? `\\n<script src=\"https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit\"></script>` : \"\";"
    print $0
    next
}
/<\/style>/ {
    print $0
    print "${turnstileScript}"
    next
}
/var forms = document\.querySelectorAll\("form\[action='\''\/api\/lead'\''\]"\);/ {
    print "      var turnstileSiteKey = \"" "\x24{escAttr(cfg.turnstileSiteKey || \"\")}" "\";"
    print $0
    next
}
/forms\.forEach\(function\(f\) \{/ {
    print $0
    print "        var turnstileWidgetId = null;"
    print "        if (turnstileSiteKey && typeof turnstile !== \"undefined\") {"
    print "          var tdiv = document.createElement(\"div\");"
    print "          f.appendChild(tdiv);"
    print "          turnstileWidgetId = turnstile.render(tdiv, {"
    print "            sitekey: turnstileSiteKey,"
    print "            size: \"invisible\","
    print "            callback: function(token) {"
    print "              doSubmit(token);"
    print "            }"
    print "          });"
    print "        }"
    next
}
/f\.addEventListener\("submit", function\(e\) \{/ {
    print $0
    print "          e.preventDefault();"
    print "          if (turnstileWidgetId !== null) {"
    print "            turnstile.execute(turnstileWidgetId);"
    print "          } else {"
    print "            doSubmit(null);"
    print "          }"
    print "        });"
    print "        "
    print "        function doSubmit(turnstileToken) {"
    # Now we skip the original e.preventDefault() and everything up to the end of the submit handler,
    # moving them inside doSubmit!
    skip_submit=1
    next
}
skip_submit && /var existingAlert = f\.querySelector/ {
    skip_submit=0
    print "          var existingAlert = f.querySelector(\".form-error-alert\");"
    next
}
skip_submit { next }
/body: JSON\.stringify\(jsonBody\)/ {
    print "            if (turnstileToken) {"
    print "              jsonBody[\"cf-turnstile-response\"] = turnstileToken;"
    print "            }"
    print $0
    next
}
/if \(submitBtn\) \{/ {
    print "              if (turnstileWidgetId !== null && typeof turnstile !== \"undefined\") turnstile.reset(turnstileWidgetId);"
    print $0
    next
}
{ print }
' functions/_shared/hub-renderer.js > temp_hub.js
mv temp_hub.js functions/_shared/hub-renderer.js
