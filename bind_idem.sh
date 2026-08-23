#!/bin/bash
awk '
/      var routingEl = document.getElementById\("studio-routing-config"\);/ {
    print "      var idemVal = document.getElementById(\"studio-intent-idem-val\");"
    print "      var idemUnit = document.getElementById(\"studio-intent-idem-unit\");"
    print "      if (idemVal && idemUnit) {"
    print "        if (studioCampaignConfig.idempotency) {"
    print "          idemVal.value = studioCampaignConfig.idempotency.val || \"\";"
    print "          idemUnit.value = studioCampaignConfig.idempotency.unit || \"days\";"
    print "        } else {"
    print "          idemVal.value = \"30\";"
    print "          idemUnit.value = \"days\";"
    print "        }"
    print "      }"
    print $0
    next
}
{ print }
' functions/_shared/admin-renderer.js > temp_bind_idem.js
mv temp_bind_idem.js functions/_shared/admin-renderer.js
