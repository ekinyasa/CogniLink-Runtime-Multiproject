const fs = require('fs');
let code = fs.readFileSync('functions/_shared/admin-renderer.js', 'utf8');

// Replace the map function body
const oldCode = `    elCampaignList.innerHTML = items.map(function (c) {
      var isActive   = c.isActive !== false;
      var createdFmt  = c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "—";
      var aliasText   = c.alias ? ' · alias: <code>' + esc(c.alias) + '</code>' : '';

      return (
        '<div class="campaign-item" id="camp-item-' + esc(c.name) + '" style="padding: 0.5rem 0; border-bottom: 1px solid var(--border);">' +
          '<div class="campaign-info" style="display: flex; flex-direction: column; gap: 0.15rem;">' +
            '<div style="display: flex; align-items: center; gap: 0.5rem;">' +
            '<a class="campaign-name" href="#" data-name="' + esc(c.name) + '" style="font-weight:bold; color:var(--primary); text-decoration:none;">' + esc(c.name) + '</a> ' +
            (c.product ? ' <span style="font-size:0.7rem; color:var(--text-m); background:var(--bg); border: 1px solid var(--border); padding: 0.1rem 0.3rem; border-radius: 3px; align-self: flex-start; width: max-content;">' + esc(c.product) + '</span>' : '') +
            '</div>' +
            '<span class="campaign-meta" style="font-size: 0.75rem; color: var(--text-m);">' + createdFmt + aliasText +
              (!isActive ? ' · <span class="badge-inactive">archived</span>' : '') +
            '</span>' +
          '</div>' +
        '</div>'
      );
    }).join("");`;

const newCode = `    elCampaignList.innerHTML = items.map(function (c) {
      var isActive   = c.isActive !== false;
      var createdFmt  = c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : "—";
      var aliasText   = c.alias ? '<code style="color: var(--success, #22c55e);">' + esc(c.alias) + '</code>' : '';
      var metaText    = aliasText ? aliasText + ' · ' + createdFmt : createdFmt;

      return (
        '<div class="campaign-item" id="camp-item-' + esc(c.name) + '" style="padding: 0.5rem 0; border-bottom: 1px solid var(--border);">' +
          '<div class="campaign-info" style="display: flex; flex-direction: column; gap: 0.15rem;">' +
            '<div style="display: flex; align-items: center; gap: 0.25rem;">' +
            (c.product ? '<span style="font-size:0.7rem; color:var(--text-m);">' + esc(c.product) + '.</span> ' : '') +
            '<a class="campaign-name" href="#" data-name="' + esc(c.name) + '" style="font-weight:bold; color:var(--primary); text-decoration:none;">' + esc(c.name) + '</a>' +
            '</div>' +
            '<span class="campaign-meta" style="font-size: 0.75rem; color: var(--text-m);">' + metaText +
              (!isActive ? ' · <span class="badge-inactive">archived</span>' : '') +
            '</span>' +
          '</div>' +
        '</div>'
      );
    }).join("");`;

code = code.replace(oldCode, newCode);
fs.writeFileSync('functions/_shared/admin-renderer.js', code);
