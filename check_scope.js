const fs = require('fs');
const code = fs.readFileSync('functions/_shared/admin-renderer.js', 'utf8');
const lines = code.split('\n');

let selectCampaignStart = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('async function selectCampaign')) {
    selectCampaignStart = i;
    break;
  }
}

console.log("selectCampaign starts at line " + (selectCampaignStart + 1));

// We know the IIFE starts at line 1620 or something, so let's just find the closing brace of selectCampaign.
// Let's print out lines 5940 to 5955 to manually inspect.
