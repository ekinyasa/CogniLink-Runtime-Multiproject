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
    print "  const p = phone.replace(/[^0-9]/g, \"\");"
    print "  return p.length === 10 || p.length === 11;"
    print "}"
    print $0
    next
}
{ print }
' functions/api/lead.js > temp_lead.js
mv temp_lead.js functions/api/lead.js
