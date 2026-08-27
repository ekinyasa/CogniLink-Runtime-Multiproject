#!/bin/bash
# 1. Extract the modal HTML
awk '
/<div id="modal-new-intent"/,/^      <\/div>/ {
    if (!printed_modal) {
        # Store in variable, but for now we just delete it from its original place
        next
    }
}
{ print }
' functions/_shared/admin-renderer.js > temp1.js

# 2. Insert it before the <script> tag at the end of body
awk '
/<\/div>$/ { # This is the end of the main-content wrapper
    print $0
    print "<!-- New Intent Modal (Moved to root) -->"
    print "<div id=\"modal-new-intent\" style=\"display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; align-items: center; justify-content: center;\">"
    print "  <div style=\"background: var(--surface, #1e1e1e); padding: 2rem; border-radius: 8px; width: 400px; max-width: 90%; display: flex; flex-direction: column; gap: 1rem; border: 1px solid var(--border, #333);\">"
    print "    <h3 style=\"margin-top: 0;\">Create New Intent</h3>"
    print "    <label style=\"display: flex; flex-direction: column; gap: 0.25rem; margin-top: 0.85rem; font-size: 0.8rem; color: var(--text-m, #aaa);\">"
    print "      Product Group"
    print "      <input type=\"text\" id=\"new-intent-product\" list=\"intent-products-list\" placeholder=\"Select or type Product...\" style=\"padding: 0.5rem; background: var(--bg, #111); color: var(--text, #fff); border: 1px solid var(--border, #333); border-radius: 4px;\" />"
    print "    </label>"
    print "    <label style=\"display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8rem; color: var(--text-m, #aaa);\">"
    print "      Intent Name / ID (lowercase, numbers, hyphens)"
    print "      <input type=\"text\" id=\"new-intent-id\" placeholder=\"e.g. kasko-renew\" style=\"padding: 0.5rem; background: var(--bg, #111); color: var(--text, #fff); border: 1px solid var(--border, #333); border-radius: 4px;\" />"
    print "    </label>"
    print "    <div style=\"display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1rem;\">"
    print "      <button type=\"button\" id=\"btn-cancel-new-intent\" onclick=\"document.getElementById('\''modal-new-intent'\'').style.display='\''none'\''\" class=\"btn-ghost\" style=\"border: 1px solid var(--border, #333);\">Cancel</button>"
    print "      <button type=\"button\" id=\"btn-confirm-new-intent\" class=\"btn-primary\">Create Intent</button>"
    print "    </div>"
    print "  </div>"
    print "</div>"
    next
}
{ print }
' temp1.js > temp2.js

mv temp2.js functions/_shared/admin-renderer.js
