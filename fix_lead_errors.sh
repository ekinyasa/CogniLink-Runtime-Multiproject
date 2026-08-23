#!/bin/bash
awk '
/  if \(tcValue && !isValidTC/ {
    print "  const referer = request.headers.get(\"referer\");"
    print "  const isJsonReq = request.headers.get(\"content-type\")?.includes(\"application/json\");"
    print ""
    print "  if (tcValue && !isValidTC(String(tcValue).trim())) {"
    print "    if (referer && !isJsonReq) {"
    print "      const redirectUrl = new URL(referer);"
    print "      redirectUrl.searchParams.set(\"error\", \"Geçersiz TC Kimlik No\");"
    print "      return Response.redirect(redirectUrl.toString(), 303);"
    print "    }"
    print "    return new Response(JSON.stringify({ error: \"Geçersiz TC Kimlik No\" }), {"
    print "      status: 400,"
    print "      headers: corsHeaders"
    print "    });"
    print "  }"
    print "  if (phone && !isValidPhone(String(phone).trim())) {"
    print "    if (referer && !isJsonReq) {"
    print "      const redirectUrl = new URL(referer);"
    print "      redirectUrl.searchParams.set(\"error\", \"Geçersiz Telefon Numarası\");"
    print "      return Response.redirect(redirectUrl.toString(), 303);"
    print "    }"
    print "    return new Response(JSON.stringify({ error: \"Geçersiz Telefon Numarası\" }), {"
    print "      status: 400,"
    print "      headers: corsHeaders"
    print "    });"
    print "  }"
    
    skip = 1
    next
}
/  if \(phone && !isValidPhone/ && skip {
    skip = 2
    next
}
/    return new Response\(JSON\.stringify\(\{ error: "Geçersiz Telefon/ && skip == 2 {
    skip = 3
    next
}
/      status: 400,/ && skip == 3 { skip = 4; next }
/      headers: corsHeaders/ && skip == 4 { skip = 5; next }
/    \}\);/ && skip == 5 { skip = 6; next }
/  \}/ && skip == 6 { skip = 0; next }
skip { next }
{ print }
' functions/api/lead.js > temp_err.js
mv temp_err.js functions/api/lead.js
