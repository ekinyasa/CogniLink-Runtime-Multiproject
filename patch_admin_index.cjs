const fs = require('fs');
let code = fs.readFileSync('functions/admin/index.js', 'utf8');

const newCode = `import { renderAdmin } from "../_shared/admin-renderer.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const customDomain = env.CUSTOM_DOMAIN || url.hostname;

  // Enforce login.teklifi.online for admin panel
  if (
    url.hostname.endsWith("teklifi.online") && 
    url.hostname !== "login.teklifi.online"
  ) {
    return Response.redirect(\`https://login.teklifi.online\${url.pathname}\${url.search}\`, 301);
  }

  return new Response(renderAdmin({
    branch: (env && env.CF_PAGES_BRANCH)     || "",
    sha:    (env && env.CF_PAGES_COMMIT_SHA) || "",
    customDomain: customDomain
  }), {
    headers: {
      "Content-Type":           "text/html;charset=UTF-8",
      "Cache-Control":          "no-store",
      "X-Robots-Tag":           "noindex,nofollow,noarchive",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options":        "DENY",
      "Referrer-Policy":        "no-referrer",
    },
  });
}`;

code = code.replace(/import { renderAdmin } from "\.\.\/_shared\/admin-renderer\.js";\n\nexport async function onRequestGet[^}]+}\n}/m, newCode);
fs.writeFileSync('functions/admin/index.js', newCode); // the whole file is replaced
