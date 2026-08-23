#!/bin/bash
awk '
NR == 1060 {
    print "      <!-- New Intent Modal (Moved to global scope) -->"
    print "      <div id=\"modal-new-intent\" style=\"display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 999999; align-items: center; justify-content: center;\">"
    print "        <div style=\"background: var(--surface, #1e1e1e); padding: 2rem; border-radius: 8px; width: 400px; max-width: 90%; display: flex; flex-direction: column; gap: 1rem; border: 1px solid var(--border);\">"
    print "          <h3 style=\"margin-top: 0;\">Create New Intent</h3>"
    print "          <label style=\"display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8rem; color: var(--text-m);\">"
    print "            Product Group"
    print "            <input type=\"text\" id=\"new-intent-product\" list=\"intent-products-list\" placeholder=\"Select or type Product...\" style=\"padding: 0.5rem; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;\" />"
    print "          </label>"
    print "          <label style=\"display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8rem; color: var(--text-m);\">"
    print "            Intent Name / ID (lowercase, numbers, hyphens)"
    print "            <input type=\"text\" id=\"new-intent-id\" placeholder=\"e.g. kasko-renew\" style=\"padding: 0.5rem; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;\" />"
    print "          </label>"
    print "          <div style=\"display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1rem;\">"
    print "            <button type=\"button\" id=\"btn-cancel-new-intent\" onclick=\"document.getElementById('\''modal-new-intent'\'').style.display='\''none'\''\" class=\"btn-ghost\" style=\"border: 1px solid var(--border);\">Cancel</button>"
    print "            <button type=\"button\" id=\"btn-confirm-new-intent\" class=\"btn-primary\">Create Intent</button>"
    print "          </div>"
    print "        </div>"
    print "      </div>"
    print $0
    next
}
{ print }
' functions/_shared/admin-renderer.js > temp_ins2.js
mv temp_ins2.js functions/_shared/admin-renderer.js
