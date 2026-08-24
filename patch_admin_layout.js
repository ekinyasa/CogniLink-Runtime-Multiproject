import fs from 'fs';
let code = fs.readFileSync('functions/_shared/admin-renderer.js', 'utf8');

// 1. Wrap the Versions Card and Builder Panel in a flex container
const target1 = `          <!-- 2. Landing Versions -->
          <div class="card">`;
const replacement1 = `          <!-- 2 & 3 side-by-side container -->
          <div style="display: flex; gap: 1rem; align-items: flex-start; flex-wrap: wrap; margin-bottom: 1rem;">
          <!-- 2. Landing Versions -->
          <div class="card" style="flex: 1; min-width: 300px;">`;
code = code.replace(target1, replacement1);

const target2 = `          <!-- 4. Global Fallbacks -->`;
const replacement2 = `          </div> <!-- end of flex container -->
          <!-- 4. Global Fallbacks -->`;
code = code.replace(target2, replacement2);

// 3. Make builder panel flex: 2
const target3 = `<div class="card" id="studio-builder-panel" style="display: none; flex-direction: column; gap: 1rem;">`;
const replacement3 = `<div class="card" id="studio-builder-panel" style="flex: 2; min-width: 400px; display: none; flex-direction: column; gap: 1rem;">`;
code = code.replace(target3, replacement3);

// 4. Inject "Intent & Routing Overrides" into builder panel
const routingHtml = `
            <hr style="border: 0; border-top: 1px solid var(--border); margin: 1rem 0;" />
            <p style="font-weight: bold; color: var(--primary);">Intent & Routing Overrides (Optional)</p>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
              <label style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8rem; color: var(--text-m);">
                "Hot" Intent Threshold (0-100)
                <input type="number" id="studio-landing-hot-threshold" placeholder="e.g. 60" min="0" max="100" />
                <small>Defaults to 60. Overrides campaign settings.</small>
              </label>
              
              <label style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8rem; color: var(--text-m);">
                Custom Conversion Element (CSS Selector)
                <input type="text" id="studio-landing-conv-selector" placeholder="e.g. button#buy-now" />
                <small>Clicking this element will trigger a 'Converted' signal.</small>
              </label>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 0.5rem;">
              <label style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8rem; color: var(--text-m);">
                Redirect if Hot
                <input type="text" id="studio-landing-dest-hot" placeholder="e.g. /l/kasko-hot" />
              </label>
              
              <label style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8rem; color: var(--text-m);">
                Redirect if Converted
                <input type="text" id="studio-landing-dest-converted" placeholder="e.g. /l/kasko-thanks" />
              </label>
            </div>
`;

// Insert it right before the "Cancel / Save" buttons
const target4 = `<div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem;">`;
code = code.replace(target4, routingHtml + "\n" + target4);

fs.writeFileSync('functions/_shared/admin-renderer.js', code);
console.log("Layout patched.");
