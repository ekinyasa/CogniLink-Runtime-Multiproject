const fs = require('fs');
let code = fs.readFileSync('functions/[[path]].js', 'utf8');

const oldRouting = `    // Canonical rule for Root Domains (e.g., niluferormanli.com -> www.niluferormanli.com)
    if (hostSegments.length === 2 && !newHost.startsWith("www.")) {
      newHost = "www." + newHost;
      needsRedirect = true;
    }`;

const newRouting = `    // Redirect root and www teklifi.online to sigorta.teklifi.online
    if (newHost === "teklifi.online" || newHost === "www.teklifi.online") {
      newHost = "sigorta.teklifi.online";
      needsRedirect = true;
    } else if (hostSegments.length === 2 && !newHost.startsWith("www.")) {
      // Canonical rule for other Root Domains (e.g., niluferormanli.com -> www.niluferormanli.com)
      newHost = "www." + newHost;
      needsRedirect = true;
    }`;

code = code.replace(oldRouting, newRouting);
fs.writeFileSync('functions/[[path]].js', code);
