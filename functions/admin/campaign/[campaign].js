/**
 * functions/admin/campaign/[campaign].js — Unified Campaign Settings & Landing Builder Workspace.
 */

const SEC_HEADERS = {
  "Content-Type":           "text/html;charset=UTF-8",
  "Cache-Control":          "no-store",
  "X-Robots-Tag":           "noindex,nofollow",
  "X-Content-Type-Options": "nosniff",
};

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function verifyAdmin(request, env) {
  if (!env.ADMIN_TOKEN) return false;
  const authHeader = (request.headers.get("Authorization") || "").trim();
  if (authHeader.startsWith("Bearer ") && authHeader.slice(7) === env.ADMIN_TOKEN) return true;
  const token = new URL(request.url).searchParams.get("token") || "";
  return token === env.ADMIN_TOKEN;
}

async function listAllSlugs(LS) {
  const keys  = [];
  let cursor  = undefined;
  do {
    const opts = { limit: 1000 };
    if (cursor !== undefined) opts.cursor = cursor;
    const page = await LS.list(opts);
    for (const k of page.keys) {
      if (!k.name.startsWith("count:") && !k.name.startsWith("webhook:")) {
        keys.push(k.name);
      }
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return keys;
}

export async function onRequestGet(context) {
  const { request, env, params } = context;

  if (!verifyAdmin(request, env)) {
    return new Response(
      `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Forbidden</title></head>
<body style="font-family:system-ui;padding:3rem 2rem;max-width:480px;margin:0 auto;text-align:center;background:#111;color:#eee">
  <p style="font-size:1.5rem;font-weight:700;margin-bottom:.5rem">Access Denied</p>
  <p style="color:#888">Admin authentication required.</p>
  <p style="margin-top:2rem"><a href="/admin" style="color:#eee;font-size:.875rem">← Studio Panel</a></p>
</body></html>`,
      { status: 403, headers: SEC_HEADERS }
    );
  }

  const campaignName = (params.campaign || "").toLowerCase().trim();
  if (!campaignName || !env.SLUG_LINKS) {
    return new Response("Not Found", { status: 404, headers: SEC_HEADERS });
  }

  // Load campaign settings from Campaign Index
  let campaignIndexRecord = null;
  if (env.CAMPAIGN_INDEX) {
    try {
      campaignIndexRecord = await env.CAMPAIGN_INDEX.get(campaignName, { type: "json" });
    } catch (_) {}
  }

  if (!campaignIndexRecord && env.CAMPAIGN_INDEX) {
    return new Response("Campaign not found", { status: 404, headers: SEC_HEADERS });
  }

  // Load decoupled campaign config
  let campaignV2Record = null;
  if (env.APP_CONFIG) {
    try {
      campaignV2Record = await env.APP_CONFIG.get(`campaign:${campaignName}`, { type: "json" });
    } catch (_) {}
  }

  // Build current slug lines list
  let allKeys = [];
  try { allKeys = await listAllSlugs(env.SLUG_LINKS); } catch (_) {}

  const records = await Promise.all(
    allKeys.map(k =>
      env.SLUG_LINKS.get(k, { type: "json" })
        .then(rec => ({ key: k, rec }))
        .catch(() => ({ key: k, rec: null }))
    )
  );

  const campaignSlugs = records
    .filter(({ rec }) => rec && rec.campaign === campaignName)
    .map(({ rec }) => ({
      slug: rec.slug,
      isActive: rec.isActive !== false,
      utm_source: rec.defaults?.utm_source || "",
      utm_medium: rec.defaults?.utm_medium || "",
      alias: rec.alias || ""
    }));

  const token = new URL(request.url).searchParams.get("token") || "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(campaignName)} — Workspace Details</title>
<style>
  :root {
    --bg: #0f0f11;
    --surface: #16161a;
    --border: #2a2a32;
    --text: #f3f4f6;
    --text-m: #9ca3af;
    --primary: #6366f1;
    --primary-hover: #4f46e5;
    --danger: #ef4444;
    --success: #22c55e;
    --radius: 8px;
    --font: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--font);
    padding: 2rem 1.5rem;
    min-height: 100vh;
  }
  .container {
    max-width: 1100px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 350px 1fr;
    gap: 1.5rem;
  }
  header {
    grid-column: 1 / -1;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border);
    padding-bottom: 1rem;
    margin-bottom: 1rem;
  }
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  h2 { font-size: 1.1rem; font-weight: 600; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; }
  label { font-size: 0.8rem; font-weight: 600; color: var(--text-m); display: flex; flex-direction: column; gap: 0.25rem; }
  input, select, textarea {
    background: var(--bg);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 0.5rem;
    border-radius: 4px;
    font-family: inherit;
    font-size: 0.85rem;
  }
  button {
    background: var(--primary);
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    font-weight: 600;
    cursor: pointer;
    font-size: 0.85rem;
  }
  button:hover { background: var(--primary-hover); }
  .btn-secondary { background: transparent; border: 1px solid var(--border); color: var(--text); }
  .btn-secondary:hover { background: var(--border); }
  .btn-danger { background: var(--danger); }
  .btn-danger:hover { background: #dc2626; }
  .grid-layout { display: flex; flex-direction: column; gap: 1rem; }
  .version-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 4px;
    font-size: 0.85rem;
  }
</style>
</head>
<body>
  <header>
    <div>
      <a href="/admin?token=${encodeURIComponent(token)}" style="color: var(--text-m); text-decoration: none; font-size: 0.85rem;">&larr; Back to Studio Panel</a>
      <h1 style="font-size: 1.5rem; margin-top: 0.25rem;">${esc(campaignName)}</h1>
    </div>
    <div style="display: flex; gap: 0.5rem;">
      <button id="btn-save-workspace">Save Workspace Config</button>
    </div>
  </header>

  <div class="container">
    <!-- Left Panel: Campaign Meta & Slugs -->
    <div class="grid-layout">
      <div class="card">
        <h2>Campaign Settings</h2>
        <label>
          Workspace Alias
          <input type="text" id="campaign-alias" value="${esc(campaignIndexRecord?.alias || "")}" placeholder="e.g. ts-renew" />
        </label>
        <label>
          Journey Map
          <select id="journey-select">
            <option value="">Select Journey Map...</option>
          </select>
        </label>
      </div>

      <div class="card">
        <h2>Active Slugs (${campaignSlugs.length})</h2>
        <div id="slug-list-container" style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 300px; overflow-y: auto;">
          ${campaignSlugs.map(s => `
            <div class="version-item">
              <div>
                <strong>/c/${esc(s.slug)}</strong>
                <div style="font-size: 0.7rem; color: var(--text-m);">${esc([s.utm_source, s.utm_medium].filter(Boolean).join(" / "))}</div>
              </div>
              <a href="/c/${esc(s.slug)}" target="_blank" style="color: var(--primary); font-size: 0.75rem;">open &nearr;</a>
            </div>
          `).join("")}
        </div>
      </div>
    </div>

    <!-- Right Panel: Landing Versions & Layout Builder -->
    <div class="grid-layout">
      <div class="card">
        <h2>Landing Page Versions</h2>
        <div id="version-list" style="display: flex; flex-direction: column; gap: 0.5rem;">
          <!-- Loaded via JS -->
        </div>
        <button id="btn-add-version" class="btn-secondary">+ Create New Version</button>
      </div>

      <div class="card" id="builder-panel" style="display: none;">
        <h2>Edit Landing Version: <span id="current-edit-version-id"></span></h2>
        <label>
          Version Name / ID
          <input type="text" id="version-name" />
        </label>
        <label>
          Page Title
          <input type="text" id="version-title" />
        </label>
        <label>
          Theme
          <select id="version-theme">
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="system">System Default</option>
          </select>
        </label>

        <div style="border-top: 1px solid var(--border); padding-top: 1rem; display: flex; flex-direction: column; gap: 1rem;">
          <h3 style="font-size: 0.95rem;">Page Sections & Layout</h3>
          <div id="layout-container" style="display: flex; flex-direction: column; gap: 0.5rem;"></div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
            <button id="btn-add-html" class="btn-secondary" type="button">+ Add Custom HTML</button>
            <select id="comp-select">
              <option value="">+ Add Component...</option>
            </select>
          </div>
        </div>

        <label>
          Custom CSS
          <textarea id="version-css" rows="3" style="font-family: monospace;"></textarea>
        </label>
        <label>
          Custom JS
          <textarea id="version-js" rows="3" style="font-family: monospace;"></textarea>
        </label>
      </div>
    </div>
  </div>

  <script>
    const campaignName = ${JSON.stringify(campaignName)};
    const token = ${JSON.stringify(token)};

    let campaignConfig = ${JSON.stringify(campaignV2Record || { slug: campaignName, journeyId: "", landings: [], mainLandingId: "" })};
    if (!campaignConfig.landings) campaignConfig.landings = [];

    let currentEditingLanding = null;
    let componentFamilies = [];

    // Helper: fetch admin APIs
    async function apiFetch(url, opts = {}) {
      if (!opts.headers) opts.headers = {};
      opts.headers["Authorization"] = "Bearer " + token;
      return fetch(url, opts);
    }

    async function init() {
      // Load Journeys
      try {
        const res = await apiFetch("/api/admin/journeys");
        const data = await res.json();
        const select = document.getElementById("journey-select");
        (data.journeys || []).forEach(j => {
          const opt = document.createElement("option");
          opt.value = j.id;
          opt.textContent = j.name || j.id;
          if (campaignConfig.journeyId === j.id) opt.selected = true;
          select.appendChild(opt);
        });
      } catch(e){}

      // Load Component options
      try {
        const res = await apiFetch("/api/admin/components");
        const data = await res.json();
        componentFamilies = data.families || [];
        const compSelect = document.getElementById("comp-select");
        componentFamilies.forEach(f => {
          if (f.status !== "archived") {
            const opt = document.createElement("option");
            opt.value = f.family_id;
            opt.textContent = f.family_name;
            compSelect.appendChild(opt);
          }
        });
      } catch(e){}

      renderVersionsList();
    }

    function renderVersionsList() {
      const container = document.getElementById("version-list");
      container.innerHTML = "";
      if (campaignConfig.landings.length === 0) {
        container.innerHTML = "<p style='color: var(--text-m); font-style: italic;'>No landing versions created yet.</p>";
        return;
      }

      campaignConfig.landings.forEach(l => {
        const div = document.createElement("div");
        div.className = "version-item";
        const isMain = campaignConfig.mainLandingId === l.id;

        div.innerHTML = \`
          <div>
            <strong>\${l.id}</strong> \${isMain ? '<span style="color: var(--success); font-weight: bold; margin-left: 5px;">[Main]</span>' : ''}
            <div style="font-size: 0.75rem; color: var(--text-m);">\${l.headerInfo?.title || 'No Title'}</div>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn-secondary" style="padding: 2px 6px; font-size: 0.75rem;" onclick="editLanding('\${l.id}')">Edit</button>
            <button class="btn-secondary" style="padding: 2px 6px; font-size: 0.75rem;" onclick="setMainLanding('\${l.id}')" \${isMain ? 'disabled' : ''}>Set Main</button>
            <button class="btn-danger" style="padding: 2px 6px; font-size: 0.75rem;" onclick="deleteLanding('\${l.id}')">Delete</button>
          </div>
        \`;
        container.appendChild(div);
      });
    }

    window.setMainLanding = function(id) {
      campaignConfig.mainLandingId = id;
      renderVersionsList();
    }

    window.editLanding = function(id) {
      currentEditingLanding = campaignConfig.landings.find(l => l.id === id);
      if (!currentEditingLanding) return;

      document.getElementById("builder-panel").style.display = "block";
      document.getElementById("current-edit-version-id").textContent = id;
      document.getElementById("version-name").value = currentEditingLanding.id;
      document.getElementById("version-title").value = currentEditingLanding.headerInfo?.title || "";
      document.getElementById("version-theme").value = currentEditingLanding.theme || "dark";
      document.getElementById("version-css").value = currentEditingLanding.customStyleCss || "";
      document.getElementById("version-js").value = currentEditingLanding.customScript || "";

      renderLayoutManager();
    }

    window.deleteLanding = function(id) {
      campaignConfig.landings = campaignConfig.landings.filter(l => l.id !== id);
      if (campaignConfig.mainLandingId === id) {
        campaignConfig.mainLandingId = campaignConfig.landings[0]?.id || "";
      }
      if (currentEditingLanding?.id === id) {
        document.getElementById("builder-panel").style.display = "none";
        currentEditingLanding = null;
      }
      renderVersionsList();
    }

    function renderLayoutManager() {
      const container = document.getElementById("layout-container");
      container.innerHTML = "";
      if (!currentEditingLanding.layout) currentEditingLanding.layout = [];

      currentEditingLanding.layout.forEach((item, idx) => {
        const row = document.createElement("div");
        row.style = "display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: var(--bg); border: 1px solid var(--border); border-radius: 4px; gap: 0.5rem;";

        let labelText = item.type === "component" ? "Component: " + item.id : "Custom HTML";

        row.innerHTML = \`
          <span style="font-size: 0.8rem; font-weight: bold; color: var(--text-m);">\${idx + 1}. \${labelText}</span>
          <div style="display: flex; gap: 0.25rem;">
            <button class="btn-secondary" style="padding: 2px 6px; font-size: 0.75rem;" onclick="moveItem(\${idx}, -1)">&uarr;</button>
            <button class="btn-secondary" style="padding: 2px 6px; font-size: 0.75rem;" onclick="moveItem(\${idx}, 1)">&darr;</button>
            <button class="btn-danger" style="padding: 2px 6px; font-size: 0.75rem;" onclick="removeItem(\${idx})">&times;</button>
          </div>
        \`;
        container.appendChild(row);
      });
    }

    window.moveItem = function(idx, dir) {
      const layout = currentEditingLanding.layout;
      const target = idx + dir;
      if (target >= 0 && target < layout.length) {
        const temp = layout[idx];
        layout[idx] = layout[target];
        layout[target] = temp;
        renderLayoutManager();
      }
    }

    window.removeItem = function(idx) {
      currentEditingLanding.layout.splice(idx, 1);
      renderLayoutManager();
    }

    document.getElementById("btn-add-version").addEventListener("click", () => {
      const id = "version-" + Date.now();
      const newL = {
        id: id,
        theme: "dark",
        headerInfo: { title: "New Landing Page Version" },
        layout: [],
        components: [],
        customStyleCss: "",
        customScript: ""
      };
      campaignConfig.landings.push(newL);
      if (!campaignConfig.mainLandingId) campaignConfig.mainLandingId = id;
      renderVersionsList();
      editLanding(id);
    });

    document.getElementById("btn-add-html").addEventListener("click", () => {
      if (!currentEditingLanding) return;
      currentEditingLanding.layout.push({
        type: "custom_html",
        id: "html-" + Date.now(),
        name: "Custom HTML",
        content: ""
      });
      renderLayoutManager();
    });

    document.getElementById("comp-select").addEventListener("change", (e) => {
      if (!currentEditingLanding || !e.target.value) return;
      currentEditingLanding.layout.push({
        type: "component",
        id: e.target.value,
        name: e.target.value
      });
      e.target.value = "";
      renderLayoutManager();
    });

    // Update fields dynamically
    document.getElementById("version-name").addEventListener("input", (e) => {
      if (!currentEditingLanding) return;
      currentEditingLanding.id = e.target.value.trim();
      renderVersionsList();
    });
    document.getElementById("version-title").addEventListener("input", (e) => {
      if (!currentEditingLanding) return;
      if (!currentEditingLanding.headerInfo) currentEditingLanding.headerInfo = {};
      currentEditingLanding.headerInfo.title = e.target.value.trim();
      renderVersionsList();
    });
    document.getElementById("version-theme").addEventListener("change", (e) => {
      if (!currentEditingLanding) return;
      currentEditingLanding.theme = e.target.value;
    });
    document.getElementById("version-css").addEventListener("input", (e) => {
      if (!currentEditingLanding) return;
      currentEditingLanding.customStyleCss = e.target.value;
    });
    document.getElementById("version-js").addEventListener("input", (e) => {
      if (!currentEditingLanding) return;
      currentEditingLanding.customScript = e.target.value;
    });

    document.getElementById("btn-save-workspace").addEventListener("click", async () => {
      const alias = document.getElementById("campaign-alias").value.trim();
      const journeyId = document.getElementById("journey-select").value;

      campaignConfig.journeyId = journeyId;

      try {
        // 1. Save Patch Campaign Index Metadata (Alias)
        const patchRes = await apiFetch("/api/campaign/" + encodeURIComponent(campaignName), {
          method: "PATCH",
          body: JSON.stringify({ alias: alias || null })
        });

        // 2. Save V2 Configuration (Landings & Journey)
        const v2Res = await apiFetch("/api/admin/campaign_v2", {
          method: "POST",
          body: JSON.stringify(campaignConfig)
        });

        if (patchRes.ok && v2Res.ok) {
          alert("Workspace Configuration Saved Successfully!");
        } else {
          const err = await v2Res.json();
          alert("Error saving: " + (err.error || "Unknown error"));
        }
      } catch(e) {
        alert("Failed to save: " + e.toString());
      }
    });

    init();
  </script>
</body>
</html>`;

  return new Response(html, { status: 200, headers: SEC_HEADERS });
}
