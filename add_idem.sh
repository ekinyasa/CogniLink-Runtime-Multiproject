#!/bin/bash
awk '
/              Routing & Behavior Configuration \(JSON\)/ {
    print "            <div style=\"display: flex; gap: 1rem;\">"
    print "              <label style=\"display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8rem; color: var(--text-m); flex: 1;\">"
    print "                Double-Submit Window (Time)"
    print "                <input type=\"number\" id=\"studio-intent-idem-val\" placeholder=\"e.g. 30\" min=\"0\" />"
    print "              </label>"
    print "              <label style=\"display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8rem; color: var(--text-m); flex: 1;\">"
    print "                Unit"
    print "                <select id=\"studio-intent-idem-unit\">"
    print "                  <option value=\"days\">Days</option>"
    print "                  <option value=\"hours\">Hours</option>"
    print "                </select>"
    print "              </label>"
    print "            </div>"
    print $0
    next
}
{ print }
' functions/_shared/admin-renderer.js > temp_idem.js
mv temp_idem.js functions/_shared/admin-renderer.js
