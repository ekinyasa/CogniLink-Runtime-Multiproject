#!/bin/bash
awk '
/class="campaign-info"/ {
    print $0
    getline
    print "            <div style=\"display: flex; align-items: center; gap: 0.5rem;\">"
    print $0
    getline
    print $0
    print "            </div>"
    next
}
{ print }
' functions/_shared/admin-renderer.js > temp_flex.js
mv temp_flex.js functions/_shared/admin-renderer.js
