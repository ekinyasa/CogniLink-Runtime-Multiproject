#!/bin/bash
awk '
/export async function onRequestPost\(context\) \{/ {
    print $0
    print "  try {"
    next
}
{ print }
END {
    print "  } catch (globalErr) {"
    print "    return new Response(JSON.stringify({ error: \"global_crash\", message: globalErr.message, stack: globalErr.stack }), { status: 500 });"
    print "  }"
}
' functions/api/lead.js > temp_catch.js
mv temp_catch.js functions/api/lead.js
