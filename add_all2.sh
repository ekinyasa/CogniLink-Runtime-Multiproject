#!/bin/bash
awk '
/export async function onRequestPost/ {
    print "function isValidTC(tc) {"
    print "  if (typeof tc !== \"string\" || tc.length !== 11 || /[^0-9]/.test(tc)) return false;"
    print "  if (tc[0] === \"0\") return false;"
    print "  let sumOdd = 0, sumEven = 0;"
    print "  for (let i = 0; i < 9; i++) {"
    print "    if (i % 2 === 0) sumOdd += parseInt(tc[i], 10);"
    print "    else sumEven += parseInt(tc[i], 10);"
    print "  }"
    print "  const tenth = ((sumOdd * 7) - sumEven) % 10;"
    print "  if (tenth !== parseInt(tc[9], 10)) return false;"
    print "  const totalSum = (sumOdd + sumEven + tenth) % 10;"
    print "  if (totalSum !== parseInt(tc[10], 10)) return false;"
    print "  return true;"
    print "}"
    print ""
    print "function isValidPhone(phone) {"
    print "  const p = typeof phone === \"string\" ? phone.replace(/[^0-9]/g, \"\") : \"\";"
    print "  return p.length === 10 || p.length === 11;"
    print "}"
    print $0
    next
}
index($0, "const name = body.name") > 0 {
    print $0
    print "  const tcValue = body.tc || body.tcKimlik || body.tckn || body.tc_kimlik || body.tc_no || body[\"tc-kimlik\"];"
    print "  const referer = request.headers.get(\"referer\");"
    print "  const isJsonReq = request.headers.get(\"content-type\")?.includes(\"application/json\");"
    print ""
    print "  if (tcValue && !isValidTC(String(tcValue).trim())) {"
    print "    if (referer && !isJsonReq) {"
    print "      try {"
    print "        const redirectUrl = new URL(referer);"
    print "        redirectUrl.searchParams.set(\"error\", \"Geçersiz TC Kimlik No\");"
    print "        return Response.redirect(redirectUrl.toString(), 303);"
    print "      } catch(e) {}"
    print "    }"
    print "    return new Response(JSON.stringify({ error: \"Geçersiz TC Kimlik No\" }), {"
    print "      status: 400,"
    print "      headers: corsHeaders"
    print "    });"
    print "  }"
    print "  if (phone && !isValidPhone(String(phone).trim())) {"
    print "    if (referer && !isJsonReq) {"
    print "      try {"
    print "        const redirectUrl = new URL(referer);"
    print "        redirectUrl.searchParams.set(\"error\", \"Geçersiz Telefon Numarası\");"
    print "        return Response.redirect(redirectUrl.toString(), 303);"
    print "      } catch(e) {}"
    print "    }"
    print "    return new Response(JSON.stringify({ error: \"Geçersiz Telefon Numarası\" }), {"
    print "      status: 400,"
    print "      headers: corsHeaders"
    print "    });"
    print "  }"
    next
}
{ print }
' functions/api/lead.js > temp_all2.js
mv temp_all2.js functions/api/lead.js
