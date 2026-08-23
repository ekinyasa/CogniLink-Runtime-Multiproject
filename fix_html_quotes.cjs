const fs = require('fs');
let content = fs.readFileSync('functions/_shared/admin-renderer.js', 'utf8');

// Split the content into HTML part (before <script>) and JS part
const scriptIndex = content.indexOf('<script>');
if (scriptIndex !== -1) {
    let htmlPart = content.substring(0, scriptIndex);
    let jsPart = content.substring(scriptIndex);
    
    // Fix the accidental replacements in the HTML part
    htmlPart = htmlPart.replace(/            '<\/div>' \+/g, '            </div>');
    
    // Also, there might be other indentation levels that got replaced? 
    // The sed command was specifically for 12 spaces, so it only matched exactly 12 spaces.
    
    fs.writeFileSync('functions/_shared/admin-renderer.js', htmlPart + jsPart);
    console.log("Fixed HTML part.");
} else {
    console.log("Could not find <script> tag.");
}
