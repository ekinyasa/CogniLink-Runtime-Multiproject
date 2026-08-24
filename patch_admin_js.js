import fs from 'fs';
let code = fs.readFileSync('functions/_shared/admin-renderer.js', 'utf8');

// 1. Populate the fields
const targetPopulate = 'document.getElementById("studio-version-slug").value = studioCurrentEditingLanding.slug;';
const replacePopulate = targetPopulate + `
    document.getElementById("studio-landing-hot-threshold").value = (studioCurrentEditingLanding.signals && studioCurrentEditingLanding.signals.hotThreshold) || "";
    document.getElementById("studio-landing-conv-selector").value = (studioCurrentEditingLanding.signals && studioCurrentEditingLanding.signals.conversionSelector) || "";
    document.getElementById("studio-landing-dest-hot").value = (studioCurrentEditingLanding.destinations && studioCurrentEditingLanding.destinations.hot) || "";
    document.getElementById("studio-landing-dest-converted").value = (studioCurrentEditingLanding.destinations && studioCurrentEditingLanding.destinations.converted) || "";
`;
code = code.replace(targetPopulate, replacePopulate);

// 2. Wire up listeners to update studioCurrentEditingLanding
const targetListeners = '      { id: "studio-version-slug", prop: "slug", cb: function() {';
const replaceListeners = `
      { id: "studio-landing-hot-threshold", cb: function() {
          if (!studioCurrentEditingLanding.signals) studioCurrentEditingLanding.signals = {};
          var v = document.getElementById("studio-landing-hot-threshold").value;
          if (v) studioCurrentEditingLanding.signals.hotThreshold = Number(v);
          else delete studioCurrentEditingLanding.signals.hotThreshold;
      }},
      { id: "studio-landing-conv-selector", cb: function() {
          if (!studioCurrentEditingLanding.signals) studioCurrentEditingLanding.signals = {};
          studioCurrentEditingLanding.signals.conversionSelector = document.getElementById("studio-landing-conv-selector").value;
      }},
      { id: "studio-landing-dest-hot", cb: function() {
          if (!studioCurrentEditingLanding.destinations) studioCurrentEditingLanding.destinations = {};
          studioCurrentEditingLanding.destinations.hot = document.getElementById("studio-landing-dest-hot").value;
      }},
      { id: "studio-landing-dest-converted", cb: function() {
          if (!studioCurrentEditingLanding.destinations) studioCurrentEditingLanding.destinations = {};
          studioCurrentEditingLanding.destinations.converted = document.getElementById("studio-landing-dest-converted").value;
      }},
` + targetListeners;
code = code.replace(targetListeners, replaceListeners);

fs.writeFileSync('functions/_shared/admin-renderer.js', code);
console.log("Admin JS patched.");
