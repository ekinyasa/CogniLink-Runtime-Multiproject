#!/bin/bash
awk '
/  const now = Math.floor\(Date.now\(\) \/ 1000\);/ {
    print "  let idemSecs = 2592000; // default 30 days"
    print "  if (resolvedCampaign && env.APP_CONFIG) {"
    print "    try {"
    print "      const campConf = await env.APP_CONFIG.get(`campaign:${resolvedCampaign}`, { type: \"json\" });"
    print "      if (campConf && campConf.idempotency && campConf.idempotency.val) {"
    print "        const v = parseInt(campConf.idempotency.val, 10);"
    print "        const u = campConf.idempotency.unit === \"hours\" ? 3600 : 86400;"
    print "        if (!isNaN(v)) idemSecs = v * u;"
    print "      }"
    print "    } catch(e) {}"
    print "  }"
    print $0
    next
}
/      const thirtyDaysAgo = now - 2592000;/ {
    print "      const thirtyDaysAgo = now - idemSecs;"
    next
}
/      const idempThreshold = now - 120; \/\/ Double-submit fallback/ {
    print "      const idempThreshold = now - idemSecs;"
    next
}
{ print }
' functions/api/lead.js > temp_idem2.js
mv temp_idem2.js functions/api/lead.js
