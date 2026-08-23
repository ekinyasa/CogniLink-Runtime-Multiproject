const fs = require('fs');
let code = fs.readFileSync('functions/_shared/admin-renderer.js', 'utf8');

// Fix rendering label
code = code.replace(
  'var labelText = item.type === "component" ? "Component: " + (item.family ? item.family + " v" + item.version : item.id) : "Custom HTML";',
  `var compName = item.name || item.family || item.id;
      if (compName === item.id && typeof componentFamilies !== "undefined") {
        var found = componentFamilies.find(function(f) { return f.family_id === item.id; });
        if (found) compName = found.family_name;
      }
      var labelText = item.type === "component" ? "Component: " + compName : "Custom HTML";`
);

// Fix push logic
code = code.replace(
  `        studioCurrentEditingLanding.layout.push({
          type: "component",
          id: e.target.value,
          name: e.target.value
        });`,
  `        var selectedName = e.target.options[e.target.selectedIndex].text;
        studioCurrentEditingLanding.layout.push({
          type: "component",
          id: e.target.value,
          name: selectedName
        });`
);

fs.writeFileSync('functions/_shared/admin-renderer.js', code);
