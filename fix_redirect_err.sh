#!/bin/bash
awk '
/return Response.redirect\(redirectUrl.toString\(\), 303\);/ {
    print "        return new Response(null, {"
    print "          status: 303,"
    print "          headers: {"
    print "            \"Location\": redirectUrl.toString(),"
    print "            ...corsHeaders"
    print "          }"
    print "        });"
    next
}
{ print }
' functions/api/lead.js > temp_err_fix.js
mv temp_err_fix.js functions/api/lead.js
