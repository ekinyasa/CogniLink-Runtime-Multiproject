#!/bin/bash
awk '
/    response = Response.redirect\(redirectUrl, 303\);/ {
    print "    response = new Response(null, {"
    print "      status: 303,"
    print "      headers: {"
    print "        \"Location\": redirectUrl,"
    print "        ...corsHeaders"
    print "      }"
    print "    });"
    next
}
/    Object.entries\(corsHeaders\).forEach/ {
    next
}
{ print }
' functions/api/lead.js > temp_lead_fix.js
mv temp_lead_fix.js functions/api/lead.js
