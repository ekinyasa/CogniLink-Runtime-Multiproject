#!/bin/bash
awk '
/const tcKimlik = typeof body.tcKimlik === "string" \? body.tcKimlik.trim\(\) : "";/ {
    print "    const tcKimlik = typeof tcValue === \"string\" || typeof tcValue === \"number\" ? String(tcValue).trim() : \"\";"
    next
}
/      const originalPayload = JSON.stringify\(body\);/ {
    print $0
    print "      if (tcKimlik) body.tcKimlik = tcKimlik;"
    next
}
{ print }
' functions/api/lead.js > temp_tc_idem.js
mv temp_tc_idem.js functions/api/lead.js
