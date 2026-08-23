#!/bin/bash
awk '
/          studioCampaignConfig\.slug = currentSelectedCampaign;/ {
    print "          var idemValInput = document.getElementById(\"studio-intent-idem-val\");"
    print "          var idemUnitInput = document.getElementById(\"studio-intent-idem-unit\");"
    print "          if (idemValInput && idemValInput.value) {"
    print "            studioCampaignConfig.idempotency = {"
    print "              val: parseInt(idemValInput.value, 10),"
    print "              unit: idemUnitInput.value"
    print "            };"
    print "          } else {"
    print "            studioCampaignConfig.idempotency = null;"
    print "          }"
    print $0
    next
}
{ print }
' functions/_shared/admin-renderer.js > temp_save_idem.js
mv temp_save_idem.js functions/_shared/admin-renderer.js
