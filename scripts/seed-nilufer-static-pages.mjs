/**
 * scripts/seed-nilufer-static-pages.mjs
 *
 * Seeds Nilüfer's first static page ("Main Coming Soon") into Nilüfer KV namespaces:
 * - APP_CONFIG (cognilink-nilufer-app-config: 274a44f4bf8841498b3f1ffcaeb54cfb)
 * - LANDING_CONFIG (cognilink-nilufer-landing-config: 165cf45a1f64483eac7cb6c3c58f0012)
 *
 * Uses existing Kartra form embed (optin ID CIzVfJ9ZOjdT, owner XpeN1XAg) and Nilüfer coming soon copy.
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const APP_CONFIG_ID = "2a5505c25d204236b37d0afeb4908940";
const LANDING_CONFIG_ID = "9b6888b318e5487eb4b8e9b169ee602f";

const now = new Date().toISOString();
const page_id = "sp_main_coming_soon";
const version_id = "spv_main_coming_soon_v1";
const slug = "coming-soon";

const pageRecord = {
  page_id,
  name: "Main Coming Soon",
  slug,
  title: "Nilüfer Ormanlı",
  status: "published",
  live_version_id: version_id,
  created_at: now,
  updated_at: now,
};

const customCss = `@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Cabin:wght@400;600;700&family=Open+Sans:wght@400;600&display=swap');

body, html {
  margin: 0;
  padding: 0;
  min-height: 100vh;
  background-color: #070a23;
  color: #fff;
  font-family: 'Cabin', sans-serif;
}

.coming-soon-hero {
  position: relative;
  min-height: 85vh;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 60px 20px 40px;
  background-image: url("https://d11n7da8rpqbjy.cloudfront.net/u361080/184630357166her.png");
  background-size: cover;
  background-position: center;
}

.coming-soon-hero::before {
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(7, 10, 35, 0.82);
}

.coming-soon-card {
  position: relative;
  z-index: 2;
  max-width: 580px;
  width: 100%;
  margin: 0 auto;
  background: rgba(25, 28, 37, 0.92);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  padding: 40px 36px 36px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
}

.brand-title {
  font-family: 'Cabin', sans-serif;
  font-size: 1.15rem;
  letter-spacing: 0.35em;
  text-transform: uppercase;
  color: hsl(35, 27%, 88%);
  margin-bottom: 1.25rem;
  font-weight: 700;
}

.headline-text {
  font-family: "Instrument Serif", serif;
  font-size: 2.1rem;
  line-height: 1.25;
  color: hsl(35, 27%, 92%);
  margin-bottom: 2rem;
  font-weight: 400;
}

.optin-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  text-align: left;
}

.optin-input-wrap {
  position: relative;
}

.optin-input {
  width: 100%;
  box-sizing: border-box;
  padding: 14px 16px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(0, 0, 0, 0.35);
  color: #fff;
  font-size: 1rem;
  outline: none;
  transition: border-color 0.2s;
}

.optin-input:focus {
  border-color: rgb(78, 90, 78);
}

.optin-consent {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 0.85rem;
  color: rgba(232, 225, 215, 0.85);
  line-height: 1.4;
  cursor: pointer;
}

.optin-consent input {
  margin-top: 3px;
  accent-color: rgb(78, 90, 78);
}

.optin-btn {
  width: 100%;
  padding: 14px 20px;
  border: none;
  border-radius: 6px;
  background-color: rgb(78, 90, 78);
  color: rgb(232, 225, 215);
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.2s, opacity 0.2s;
  letter-spacing: 0.03em;
}

.optin-btn:hover {
  background-color: rgb(90, 104, 90);
}

.coming-soon-footer {
  background-color: rgb(27, 31, 34);
  padding: 40px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.footer-inner {
  max-width: 1100px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1.5rem;
}

.footer-left {
  font-size: 0.85rem;
  color: hsl(0, 0%, 62%);
}

.footer-links {
  display: flex;
  gap: 1.25rem;
  margin-top: 0.5rem;
}

.footer-links a {
  color: rgb(158, 158, 158);
  text-decoration: none;
  font-size: 0.85rem;
}

.footer-links a:hover {
  color: #fff;
}

.footer-social {
  display: flex;
  gap: 1rem;
}

.footer-social a {
  color: rgb(158, 158, 158);
  font-size: 1.1rem;
  text-decoration: none;
  transition: color 0.2s;
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.footer-social a:hover {
  color: #fff;
  border-color: rgba(255, 255, 255, 0.3);
}`;

const customHtml = `<section class="coming-soon-hero">
  <div class="coming-soon-card">
    <div class="brand-title">N İ L Ü F E R   O R M A N L I</div>
    <div class="headline-text">
      Vocal Embodiment &<br>
      Frequency - Based Digital Experiences<br>
      are launching soon.
    </div>

    <!-- Kartra Form Integration -->
    <form action="https://app.kartra.com//process/add_lead/CIzVfJ9ZOjdT" method="POST" target="_top" class="optin-form filled_optin" data-optin-id="CIzVfJ9ZOjdT" data-kt-type="optin" data-kt-value="CIzVfJ9ZOjdT" data-kt-owner="XpeN1XAg">
      <div class="optin-input-wrap">
        <input type="email" name="email" placeholder="Email..." required class="optin-input" />
      </div>
      <label class="optin-consent">
        <input type="checkbox" name="custom_1[]" value="1" checked required />
        <span>I’d like to receive news, releases and promotional emails from Nilüfer Ormanlı.</span>
      </label>
      <button type="submit" class="optin-btn">Join the early access list</button>
      <input type="text" name="aaddress_url" style="display: none; position: absolute; left: -9999px;" tabindex="-1" aria-hidden="true">
    </form>
  </div>
</section>

<footer class="coming-soon-footer">
  <div class="footer-inner">
    <div class="footer-left">
      <div>© 2026 - Nilufer Ormanlı LLC. - All rights reserved.</div>
      <div class="footer-links">
        <a href="https://app.kartra.com/redirect_to/?asset=page&id=ZHstCpwEU3rK" target="_blank" rel="noopener">Privacy Policy</a>
        <a href="https://app.kartra.com/redirect_to/?asset=page&id=ZHstCpwEU3rK" target="_blank" rel="noopener">Cookie Policy</a>
        <a href="javascript:void(0)" data-cl-consent-preferences>Cookie Preferences</a>
        <a href="https://app.kartra.com/redirect_to/?asset=page&id=28WNkF0QoqCp" target="_blank" rel="noopener">Terms of Use</a>
      </div>
    </div>
    <div class="footer-social">
      <a href="https://facebook.com/niluferormanli" target="_blank" rel="noopener" aria-label="Facebook">Facebook</a>
      <a href="https://www.linkedin.com/in/niluferormanli/" target="_blank" rel="noopener" aria-label="LinkedIn">LinkedIn</a>
      <a href="https://instagram.com/niluferormanli" target="_blank" rel="noopener" aria-label="Instagram">Instagram</a>
      <a href="https://www.tiktok.com/@niluferormanli" target="_blank" rel="noopener" aria-label="TikTok">TikTok</a>
    </div>
  </div>
</footer>`;

const customScript = `(function() {
  var s = document.createElement("script");
  s.src = "https://app.kartra.com/js/build/front/pages/optin.js";
  s.async = true;
  s.defer = true;
  document.body.appendChild(s);
})();`;

const versionRecord = {
  version_id,
  page_id,
  version_number: 1,
  version_label: "v1",
  title: "Nilüfer Ormanlı",
  status: "published",
  layout: [
    { type: "custom_html", content: customHtml }
  ],
  components: [],
  customStyleCss: customCss,
  customScript: customScript,
  customBodyHtml: customHtml,
  customHeaderHtml: "",
  customFooterHtml: "",
  notes: "Initial live coming soon page with Kartra optin form",
  created_at: now,
  updated_at: now,
};

const slugRecord = {
  page_id,
  version_id,
};

const policyCommonCss = `@import url('https://fonts.googleapis.com/css2?family=Cabin:wght@400;600;700&display=swap');
body, html {
  margin: 0;
  padding: 0;
  min-height: 100vh;
  background-color: #070a23;
  color: #fff;
  font-family: 'Cabin', sans-serif;
  line-height: 1.6;
}
.policy-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 60px 24px 80px;
}
.policy-header {
  margin-bottom: 40px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  padding-bottom: 24px;
}
.policy-header h1 {
  font-size: 2.25rem;
  font-weight: 700;
  margin: 0 0 12px;
  letter-spacing: 0.02em;
}
.policy-header .last-updated {
  font-size: 0.9rem;
  color: #9ca3af;
}
.policy-content h2 {
  font-size: 1.35rem;
  margin-top: 32px;
  margin-bottom: 12px;
  color: #e5e7eb;
}
.policy-content h3 {
  font-size: 1.1rem;
  margin-top: 24px;
  margin-bottom: 8px;
  color: #cbd5e1;
}
.policy-content p, .policy-content li {
  font-size: 1rem;
  color: #d1d5db;
  line-height: 1.7;
}
.policy-content ul {
  padding-left: 24px;
  margin-bottom: 16px;
}
.policy-content code {
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.9em;
}
.policy-content a {
  color: #60a5fa;
  text-decoration: underline;
}
.policy-back-btn {
  display: inline-block;
  margin-bottom: 24px;
  color: #9ca3af;
  text-decoration: none;
  font-size: 0.9rem;
}
.policy-back-btn:hover {
  color: #fff;
}
`;

// Note: Route and template infrastructure is implemented.
// Actual official legal text is pending final supply/publication by the legal team.
const privacyHtml = `<div class="policy-container">
  <a href="/" class="policy-back-btn">← Back to Nilüfer Ormanlı</a>
  <div class="policy-header">
    <h1>Privacy Policy</h1>
  </div>
  <div class="policy-content">
    <p>The official Privacy Policy for Nilüfer Ormanlı is currently being finalized and will be published here shortly.</p>
    <p>For inquiries regarding data privacy or to exercise your rights, please contact us directly.</p>
  </div>
</div>`;

const cookieHtml = `<div class="policy-container">
  <a href="/" class="policy-back-btn">← Back to Nilüfer Ormanlı</a>
  <div class="policy-header">
    <h1>Cookie Policy</h1>
  </div>
  <div class="policy-content">
    <p>The official Cookie Policy for Nilüfer Ormanlı is currently being finalized and will be published here shortly.</p>
    <p>You can review and update your cookie preferences at any time using the link below:</p>
    <p style="margin: 24px 0;">
      <button type="button" class="cl-consent-btn cl-consent-btn-accept" data-cl-consent-preferences style="padding: 10px 20px; font-size: 1rem;">Cookie Preferences</button>
    </p>
  </div>
</div>`;

const privacyPageRecord = {
  page_id: "sp_privacy_policy",
  name: "Privacy Policy",
  slug: "privacy-policy",
  title: "Privacy Policy - Nilüfer Ormanlı",
  status: "draft",
  live_version_id: "",
  created_at: now,
  updated_at: now,
};

const privacyVersionRecord = {
  version_id: "spv_privacy_policy_v1",
  page_id: "sp_privacy_policy",
  version_number: 1,
  version_label: "v1",
  title: "Privacy Policy - Nilüfer Ormanlı",
  status: "draft",
  layout: [{ type: "custom_html", content: privacyHtml }],
  components: [],
  customStyleCss: policyCommonCss,
  customScript: "",
  customBodyHtml: privacyHtml,
  customHeaderHtml: "",
  customFooterHtml: "",
  notes: "Pending official legal copy",
  created_at: now,
  updated_at: now,
};

const cookiePageRecord = {
  page_id: "sp_cookie_policy",
  name: "Cookie Policy",
  slug: "cookie-policy",
  title: "Cookie Policy - Nilüfer Ormanlı",
  status: "draft",
  live_version_id: "",
  created_at: now,
  updated_at: now,
};

const cookieVersionRecord = {
  version_id: "spv_cookie_policy_v1",
  page_id: "sp_cookie_policy",
  version_number: 1,
  version_label: "v1",
  title: "Cookie Policy - Nilüfer Ormanlı",
  status: "draft",
  layout: [{ type: "custom_html", content: cookieHtml }],
  components: [],
  customStyleCss: policyCommonCss,
  customScript: "",
  customBodyHtml: cookieHtml,
  customHeaderHtml: "",
  customFooterHtml: "",
  notes: "Pending official legal copy",
  created_at: now,
  updated_at: now,
};

export {
  pageRecord,
  versionRecord,
  slugRecord,
  siteRoutingRecord,
  privacyPageRecord,
  privacyVersionRecord,
  cookiePageRecord,
  cookieVersionRecord
};

// If run directly via node, seed into Cloudflare KV using wrangler kv key put
if (process.argv[1] && process.argv[1].endsWith("seed-nilufer-static-pages.mjs")) {
  console.log("Seeding Nilüfer Static Pages into KV...");

  const tmpDir = "/tmp/nilufer_seed";
  fs.mkdirSync(tmpDir, { recursive: true });

  const files = {
    [`static_page:${page_id}`]: pageRecord,
    [`static_page_ver:${page_id}:${version_id}`]: versionRecord,
    [`static_slug:${slug}`]: slugRecord,
    [`site:routing`]: siteRoutingRecord,
    // Note: /privacy-policy and /cookie-policy route infrastructure is ready in code.
    // KV publishing is withheld until real official legal copy is supplied.
  };

  for (const [key, data] of Object.entries(files)) {
    const fPath = path.join(tmpDir, key.replace(/:/g, "_") + ".json");
    fs.writeFileSync(fPath, JSON.stringify(data));
    console.log(`Putting key: ${key} into APP_CONFIG (${APP_CONFIG_ID})...`);
    execSync(`npx wrangler kv key put --namespace-id=${APP_CONFIG_ID} "${key}" --path="${fPath}" --remote`, {
      stdio: "inherit"
    });
  }

  // Also update hub_config in LANDING_CONFIG
  console.log("Updating hub_config in LANDING_CONFIG...");
  try {
    const getRes = execSync(`npx wrangler kv key get --namespace-id=${LANDING_CONFIG_ID} "hub_config" --remote`, { encoding: "utf8" });
    let hubConfig = {};
    try { hubConfig = JSON.parse(getRes); } catch (_) {}
    hubConfig.homepageStaticPageId = page_id;
    const hubCfgPath = path.join(tmpDir, "hub_config.json");
    fs.writeFileSync(hubCfgPath, JSON.stringify(hubConfig));
    execSync(`npx wrangler kv key put --namespace-id=${LANDING_CONFIG_ID} "hub_config" --path="${hubCfgPath}" --remote`, {
      stdio: "inherit"
    });
  } catch (e) {
    console.warn("Notice: could not get existing hub_config, creating new...");
    const hubCfgPath = path.join(tmpDir, "hub_config.json");
    fs.writeFileSync(hubCfgPath, JSON.stringify({ homepageStaticPageId: page_id }));
    execSync(`npx wrangler kv key put --namespace-id=${LANDING_CONFIG_ID} "hub_config" --path="${hubCfgPath}" --remote`, {
      stdio: "inherit"
    });
  }

  console.log("✅ Nilüfer Static Page and Homepage Routing successfully seeded!");
}
