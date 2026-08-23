const fs = require('fs');
let code = fs.readFileSync('functions/_shared/admin-renderer.js', 'utf8');

const helperFunctions = `  window.studioLayoutMode = "main";
  window.getActiveStudioLayout = function() {
    if (!studioCurrentEditingLanding) return [];
    if (window.studioLayoutMode === "thanks") {
      if (!studioCurrentEditingLanding.thanksLayout) studioCurrentEditingLanding.thanksLayout = [];
      return studioCurrentEditingLanding.thanksLayout;
    } else {
      if (!studioCurrentEditingLanding.layout) studioCurrentEditingLanding.layout = [];
      return studioCurrentEditingLanding.layout;
    }
  };

  window.setStudioLayoutMode = function(mode) {
    window.studioLayoutMode = mode;
    var btnMain = document.getElementById("btn-studio-layout-main");
    var btnThanks = document.getElementById("btn-studio-layout-thanks");
    if (mode === "thanks") {
      btnThanks.className = "btn-primary btn-sm";
      btnThanks.style.border = "none";
      btnMain.className = "btn-ghost btn-sm";
      btnMain.style.border = "1px solid var(--border)";
    } else {
      btnMain.className = "btn-primary btn-sm";
      btnMain.style.border = "none";
      btnThanks.className = "btn-ghost btn-sm";
      btnThanks.style.border = "1px solid var(--border)";
    }
    renderStudioLayoutManager();
  };

  function renderStudioLayoutManager() {`;

code = code.replace('  function renderStudioLayoutManager() {', helperFunctions);

code = code.replace(
  'if (!studioCurrentEditingLanding.layout) studioCurrentEditingLanding.layout = [];\n\n    studioCurrentEditingLanding.layout.forEach(function (item, idx) {',
  `var activeLayout = getActiveStudioLayout();\n    activeLayout.forEach(function (item, idx) {`
);

code = code.replace(
  `  window.updateStudioHtmlContent = function(idx, val) {
    if (studioCurrentEditingLanding && studioCurrentEditingLanding.layout[idx]) {
      studioCurrentEditingLanding.layout[idx].content = val;
    }
  };`,
  `  window.updateStudioHtmlContent = function(idx, val) {
    var layout = getActiveStudioLayout();
    if (layout[idx]) layout[idx].content = val;
  };`
);

code = code.replace(
  `  window.moveStudioItem = function(idx, dir) {
    var layout = studioCurrentEditingLanding.layout;
    var target = idx + dir;`,
  `  window.moveStudioItem = function(idx, dir) {
    var layout = getActiveStudioLayout();
    var target = idx + dir;`
);

code = code.replace(
  `  window.removeStudioItem = function(idx) {
    studioCurrentEditingLanding.layout.splice(idx, 1);
    renderStudioLayoutManager();
  };`,
  `  window.removeStudioItem = function(idx) {
    var layout = getActiveStudioLayout();
    layout.splice(idx, 1);
    renderStudioLayoutManager();
  };`
);

code = code.replace(
  `        studioCurrentEditingLanding.layout.push({
          type: "custom_html",
          id: "html-" + Date.now(),
          name: "Custom HTML",
          content: ""
        });`,
  `        getActiveStudioLayout().push({
          type: "custom_html",
          id: "html-" + Date.now(),
          name: "Custom HTML",
          content: ""
        });`
);

code = code.replace(
  `        var selectedName = e.target.options[e.target.selectedIndex].text;
        studioCurrentEditingLanding.layout.push({
          type: "component",
          id: e.target.value,
          name: selectedName
        });`,
  `        var selectedName = e.target.options[e.target.selectedIndex].text;
        getActiveStudioLayout().push({
          type: "component",
          id: e.target.value,
          name: selectedName
        });`
);

const uiChange = `            <div style="border-top: 1px solid var(--border); padding-top: 1rem; display: flex; flex-direction: column; gap: 1rem;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <p class="card-title" style="font-size: 0.9rem; margin: 0;">Page Sections & Layout</p>
                <div style="display: flex; gap: 0.5rem; background: var(--bg); padding: 2px; border-radius: 6px; border: 1px solid var(--border);">
                  <button id="btn-studio-layout-main" class="btn-primary btn-sm" type="button" onclick="setStudioLayoutMode('main')" style="border: none;">Landing Page</button>
                  <button id="btn-studio-layout-thanks" class="btn-ghost btn-sm" type="button" onclick="setStudioLayoutMode('thanks')" style="border: 1px solid var(--border);">Thank You Page</button>
                </div>
              </div>`;
code = code.replace(
  `            <div style="border-top: 1px solid var(--border); padding-top: 1rem; display: flex; flex-direction: column; gap: 1rem;">
              <p class="card-title" style="font-size: 0.9rem;">Page Sections & Layout</p>`,
  uiChange
);

// We should also set studioLayoutMode = "main" when editing a new landing version
code = code.replace(
  '    updateStudioUrlPreviews();',
  '    updateStudioUrlPreviews();\n    setStudioLayoutMode("main");'
);


fs.writeFileSync('functions/_shared/admin-renderer.js', code);
