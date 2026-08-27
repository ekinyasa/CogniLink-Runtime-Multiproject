const fs = require('fs');
let code = fs.readFileSync('functions/_shared/admin-renderer.js', 'utf8');

const oldModalHtml = `          <h3 style="margin-top: 0;">Create New Intent</h3>
          <label style="display: flex; flex-direction: column; gap: 0.25rem; margin-top: 0.85rem; font-size: 0.8rem; color: var(--text-m);">
            Product Group
            <input type="text" id="new-intent-product" list="intent-products-list" placeholder="Select or type Product..." style="padding: 0.5rem; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;" />
          </label>
          <label style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8rem; color: var(--text-m);">
            Intent Name / ID (lowercase, numbers, hyphens)
            <input type="text" id="new-intent-id" placeholder="e.g. kasko-renew" style="padding: 0.5rem; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;" />
          </label>`;

const newModalHtml = `          <h3 style="margin-top: 0;">Create New Intent</h3>
          <label style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8rem; color: var(--text-m);">
            <span>Intent Name / ID (lowercase, numbers, hyphens)<br><span style="color: var(--danger, #ef4444); font-size: 0.7rem; font-style: italic;">* This name cannot be changed once set!</span></span>
            <input type="text" id="new-intent-id" placeholder="e.g. kasko-renew" style="padding: 0.5rem; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;" />
          </label>
          <label style="display: flex; flex-direction: column; gap: 0.25rem; margin-top: 0.85rem; font-size: 0.8rem; color: var(--text-m);">
            Product Group
            <input type="text" id="new-intent-product" list="intent-products-list" placeholder="Select or type Product..." style="padding: 0.5rem; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px;" />
          </label>`;

code = code.replace(oldModalHtml, newModalHtml);
fs.writeFileSync('functions/_shared/admin-renderer.js', code);
