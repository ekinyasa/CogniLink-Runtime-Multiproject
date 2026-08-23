#!/bin/bash
awk '
/listHTML \+= '\''  <a href="#" class="campaign-name"/ {
    print "      var productBadge = c.product ? \" <code style=\\\"font-size: 0.7rem; color: var(--text-m); background: var(--bg); border: 1px solid var(--border); padding: 0.1rem 0.3rem; border-radius: 3px;\\\">\" + escapeHTML(c.product) + \"</code>\" : \"\";"
    print "      listHTML += '\''  <a href=\"#\" class=\"campaign-name\" data-name=\"'\'' + escapeHTML(c.name) + '\''\">'\'' + escapeHTML(c.name) + productBadge + '\''</a>'\'';"
    next
}
{ print }
' functions/_shared/admin-renderer.js > temp_badge.js
mv temp_badge.js functions/_shared/admin-renderer.js
