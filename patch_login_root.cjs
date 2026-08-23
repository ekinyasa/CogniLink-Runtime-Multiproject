const fs = require('fs');
let code = fs.readFileSync('functions/[[path]].js', 'utf8');

// Import renderAdmin at the top
code = code.replace(
  'import { deriveCampaignFromSlug, extractProductSubdomain, validateProductSubdomainMatch } from "./_shared/slug-utils.js";',
  'import { deriveCampaignFromSlug, extractProductSubdomain, validateProductSubdomainMatch } from "./_shared/slug-utils.js";\nimport { renderAdmin } from "./_shared/admin-renderer.js";'
);

// Add the logic inside onRequestGet right after Canonical URL forcing
const oldLogic = `  // ── Step 0: Root path handling ──────────────────────────────────────────`;
const newLogic = `  // ── Admin Subdomain Handling ─────────────────────────────────────────────
  if (url.hostname === "login.teklifi.online" && (rawPath === "/" || rawPath === "")) {
    return new Response(renderAdmin({
      branch: (env && env.CF_PAGES_BRANCH)     || "",
      sha:    (env && env.CF_PAGES_COMMIT_SHA) || "",
      customDomain: url.hostname
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
  }

  // ── Step 0: Root path handling ──────────────────────────────────────────`;

code = code.replace(oldLogic, newLogic);
fs.writeFileSync('functions/[[path]].js', code);
