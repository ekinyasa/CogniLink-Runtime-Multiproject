#!/bin/bash
awk '
index($0, "const name = body.name") > 0 {
    print $0
    print "  const tcValue = body.tc || body.tcKimlik || body.tckn || body.tc_kimlik || body.tc_no || body[\"tc-kimlik\"];"
    print "  "
    print "  if (tcValue && !isValidTC(String(tcValue).trim())) {"
    print "    return new Response(JSON.stringify({ error: \"Geçersiz TC Kimlik No\" }), {"
    print "      status: 400,"
    print "      headers: corsHeaders"
    print "    });"
    print "  }"
    print "  if (phone && !isValidPhone(String(phone).trim())) {"
    print "    return new Response(JSON.stringify({ error: \"Geçersiz Telefon Numarası\" }), {"
    print "      status: 400,"
    print "      headers: corsHeaders"
    print "    });"
    print "  }"
    next
}
{ print }
' functions/api/lead.js > temp_lead2.js
mv temp_lead2.js functions/api/lead.js
