/**
 * Renders the studio panel HTML.
 * Token management and API calls are entirely client-side.
 * The word "admin" never appears in user-visible text.
 */
export function renderAdmin({ branch = "", sha = "", customDomain = "runtime.ekinyasa.online" } = {}) {
  // Derive version tag from CF Pages branch (e.g. "feat/v9-diagnostics" → "v9")
  var vMatch = branch.match(/v(\d+)/);
  var vTag = vMatch ? "v" + vMatch[1] : "v9";
  // Prompt 69 — CogniLink branding: shaShort = first 2 + . + last 1
  var shaShort = sha ? sha.slice(0, 2) + "." + sha.slice(-1) : "";
  var shaTag = sha ? " \u00b7 " + shaShort : "";
  var panelLogo = "CogniLink";
  var panelTitle = shaTag;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=info,lock,workspace_premium" />
<title>${panelLogo}${panelTitle}</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>${ADMIN_CSS}</style>
</head>
<body>

<!-- ── Token Gate ──────────────────────────────────────── -->
<div id="gate" class="screen">
  <div class="card narrow">
    <p class="card-title">CogniLink</p>
    <p class="hint">Enter your access token to continue.</p>
    <form id="gate-form" autocomplete="off">
      <input id="token-input" type="password" placeholder="Access token"
        autocomplete="current-password" required />
      <p id="gate-error" class="error hidden"></p>
      <button type="submit" class="btn-primary">Continue</button>
    </form>
  </div>
</div>

<!-- ── Main Panel ──────────────────────────────────────── -->
<div id="panel" class="screen hidden">
  <div class="header-container" id="header-container">
  <div class="topbar" id="main-topbar">
    <span class="topbar-title">${panelLogo}<small> <span style="color: var(--text-m)">${panelTitle}</span></small></span>
    <div class="sw-toolbar" id="sw-toolbar" style="display:flex;align-items:center;gap:0.75rem">
      <div id="sw-display-wrap" class="sw-display-oval" title="Start / Stop — click to toggle">
        <span id="sw-display" class="sw-time" style="user-select:none">00:00.0</span>
        <span id="sw-icon" class="sw-icon" style="font-size:20px;padding-top:1.2px">⏵︎</span>
      </div>
      <button type="button" id="btn-sw-reset" class="btn-ghost btn-sm btn-round" title="Reset" style="color: var(--text-m); font-size: 22px; padding: 0px 0px 0px 1.9px; width: 34px; height: 34px; border-radius: 50%;">⟳</button>
    </div>
    <div class="ws-selector" id="ws-selector" style="display:none">
      <label class="ws-label" for="ws-select">Workspace</label>
      <select id="ws-select" class="ws-select">
        <option value="">All</option>
        <option value="default">default</option>
      </select>
    </div>
    <a href="/admin/experiments" target="_blank"><button class="btn-ghost btn-sm btn-oval btn-lab-link" style="padding: 0.6em 1.3em;">Lab <small>&#x2197;</small></button></a>
    <button id="btn-logout" class="btn-ghost btn-sm btn-round" style="padding: 1px; width: 34px; height: 34px; border-radius: 50%;">
      <svg class="" xmlns="http://www.w3.org/2000/svg" fill="none" viewbox="0 0 22 22" style="width: 20px; height: 18px;"><path stroke="var(--text-m)" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12h-9.5m7.5 3 3-3-3-3m-5-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5a2 2 0 0 0 2-2v-1"></path></svg>
    </button>
  </div>


  <!-- Tab bar -->
  <div class="tab-bar">
    <button class="tab-btn active" data-tab="analytics">Pulse</button>
    <button class="tab-btn" data-tab="pages" style="display:none">Landings</button>
        <button class="tab-btn" data-tab="campaigns">Intents</button>
    <button class="tab-btn" data-tab="slugs" style="display:none!important">Nodes</button>
        <button class="tab-btn" data-tab="routing">Traffic</button>
    <button class="tab-btn" data-tab="components">Library</button>
    <button class="tab-btn" data-tab="config">Settings</button>
    <button class="tab-btn" data-tab="diagnostics">Health</button>
  </div>
  </div> <!-- end header-container -->

  <!-- ── Tab: Analytics ───────────────────────────────── -->
  <div id="tab-analytics" class="tab-pane">
    <div class="pulse-grid">

      <!-- A: Header (Full Width) -->
      <div class="pulse-section-a card">
        <div class="dash-header">
          <div>
            <p class="card-title" style="margin-bottom:0.25rem">Analytics</p>
            <p class="hint" style="margin-bottom:0;font-size:0.75rem" id="analytics-freshness-text">Real-time data from Analytics Engine</p>
          </div>
          <div class="dash-header-meta" id="analytics-generated" style="position:absolute;top:1rem;right:1.5rem"></div>
          <div style="display:flex;gap:0.5rem;align-items:center;margin-top:0.25rem;flex-wrap:wrap">
            <div class="filter-bar desktop-only" id="analytics-time-filters">
              <button type="button" class="filter-btn" data-window="1h">1H</button>
              <button type="button" class="filter-btn" data-window="24h">24H</button>
              <button type="button" class="filter-btn" data-window="7d">7D</button>
              <button type="button" class="filter-btn" data-window="30d">30D</button>
            </div>
            <select id="analytics-time-select" class="mobile-only filter-select" style="padding:0.25rem;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:0.8rem;outline:none;display:none;">
              <option value="1h">1H</option>
              <option value="24h">24H</option>
              <option value="7d">7D</option>
              <option value="30d">30D</option>
            </select>
            <div class="date-input-group">
              <input type="date" id="analytics-start-date" class="date-input" title="Start Date" />
              <span style="font-size:0.7rem;color:var(--text-dim)">-</span>
              <input type="date" id="analytics-end-date" class="date-input" title="End Date" />
            </div>
            <button type="button" id="btn-refresh-analytics" class="btn-ghost" style="padding:0.25rem 0.6rem;font-size:1.1rem;border-radius:50%" title="Refresh Now">⟳</button>
          </div>
        </div>

        <div id="analytics-status" class="hint" style="margin:1rem 0">Loading…</div>

        <div id="stat-conv-rate-wrap" class="dash-grid hidden" style="margin-top:1rem">
          <div class="dash-card">
            <span class="dash-card-label">Total Clicks</span>
            <span class="dash-card-value" id="stat-clicks">0</span>
          </div>
          <div class="dash-card">
            <span class="dash-card-label">Conversions</span>
            <span class="dash-card-value" id="stat-conversions">0</span>
          </div>
          <div class="dash-card">
            <span class="dash-card-label">Avg. Conv. Rate</span>
            <span class="dash-card-value" id="stat-conv-rate">0%</span>
          </div>
        </div>
      </div>

      <!-- B: Performance Breakdown (Source) -->
      <div id="analytics-content-b" class="pulse-section-b card hidden">
        <p class="dash-card-label" style="margin-bottom:1rem">Performance Breakdown (Source)</p>
        <div class="dash-chart-container" style="border:none;padding:0">
          <canvas id="dash-source-chart" height="100"></canvas>
        </div>
      </div>

      <!-- C: Traffic & Conversions Over Time -->
      <div id="analytics-content-c" class="pulse-section-c card hidden">
        <p class="dash-card-label" style="margin-bottom:1rem">Traffic & Conversions Over Time</p>
        <div class="dash-chart-container" style="border:none;padding:0">
          <canvas id="dash-chart" height="100"></canvas>
        </div>
      </div>

      <!-- D: Active Experiments -->
      <div id="dash-experiments-wrap" class="pulse-section-d card hidden">
        <p class="analytics-section-title">Active Experiments</p>
        <div class="exp-grid" id="dash-exp-grid"></div>
      </div>

      <!-- E: By Campaign / By Alias -->
      <div id="analytics-content-e" class="pulse-section-e card hidden">
        <div class="analytics-grid" style="grid-template-columns:1fr; gap:1.5rem">
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem">
              <p class="analytics-section-title" style="margin-bottom:0">By Campaign</p>
              <div id="pag-campaigns" class="mini-pagination"></div>
            </div>
            <table class="analytics-table" id="tbl-by-campaign">
              <thead><tr><th>Campaign</th><th>Clicks</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem">
              <p class="analytics-section-title" style="margin-bottom:0">By Alias</p>
              <div id="pag-aliases" class="mini-pagination"></div>
            </div>
            <table class="analytics-table" id="tbl-by-alias">
              <thead><tr><th>Alias</th><th>Clicks</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- F: Recent Events -->
      <div id="analytics-content-f" class="pulse-section-f card hidden">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
          <p class="analytics-section-title" style="margin-bottom:0">Recent Events</p>
          <div style="display:flex;align-items:center;gap:1.5rem">
            <label class="toggle-label" style="font-size:.7rem;margin:0">
              <input type="checkbox" id="show-test-analytics" /> Show Test
            </label>
            <div id="pag-events" class="mini-pagination"></div>
          </div>
        </div>
        <div style="overflow-x:auto">
          <table class="analytics-table analytics-table-full" id="tbl-recent">
            <thead><tr><th>Time</th><th>Alias</th><th>Slug</th><th>Campaign</th><th>Event / Source</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </div>

    </div>
  </div>

  <!-- ── Tab: Pages ───────────────────────────────────── -->
  <div id="tab-pages" class="tab-pane hidden">
    <div class="layout">
      <!-- Left: Create Form -->
      <div class="card form-card">
        <p class="card-title" id="page-form-title">New Landing Page</p>
        <form id="page-form" autocomplete="off">
          <input type="hidden" id="f-page-editing" value="" />
          <label for="f-page-id">Page ID / Slug <span class="req">*</span></label>
          <input type="text" id="f-page-id" placeholder="e.g. black-friday-landing" required pattern="[A-Za-z0-9-_]+" />

          <label for="f-page-title">Page Title</label>
          <input type="text" id="f-page-title" placeholder="My Landing" />

          <label for="f-page-theme">Theme</label>
          <select id="f-page-theme">
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="system">System Default</option>
          </select>

          <label for="f-page-url">Redirect URL (optional)</label>
          <input type="url" id="f-page-url" placeholder="https://external-landing.com" />
          <p class="hint">If provided, this page acts as a pass-through.</p>

          <hr style="margin:20px 0; border:0; border-top:1px solid var(--border);" />
          <p class="card-title" style="font-size:13px; font-weight:600; margin-bottom:10px;">Page Sections & Layout Manager</p>
          <p class="hint" style="margin-top:-5px; margin-bottom:15px; font-size:0.75rem;">Arrange the order of components, links, and custom HTML sections. You can add multiple custom sections and position them anywhere.</p>

          <div id="page-layout-container" style="display:flex; flex-direction:column; gap:12px; margin-bottom:20px;"></div>

          <div style="display:grid; grid-template-columns:1fr 1.2fr; gap:10px; margin-bottom:20px;">
            <button type="button" id="btn-add-layout-html" class="btn-ghost btn-sm" style="background:var(--surface); padding:8px; font-size:0.8rem;">+ Add Custom HTML</button>
            <select id="add-layout-comp-select" style="padding:6px; font-size:0.8rem; border:1px solid var(--border); background:var(--surface); color:var(--text); border-radius:4px;">
              <option value="">+ Add Component...</option>
            </select>
          </div>

          <hr style="margin:20px 0; border:0; border-top:1px solid var(--border);" />
          <p class="card-title" style="font-size:12px; opacity:0.7">Advanced / Code Editor</p>

          <label for="f-page-is-conv" style="display:flex; align-items:center; gap:8px; cursor:pointer;">
             <input type="checkbox" id="f-page-is-conv" /> Mark as Conversion Goal (fires signal on load)
          </label>

          <input type="hidden" id="f-page-html" />

          <label for="f-page-css">Custom CSS</label>
          <textarea id="f-page-css" rows="3" placeholder=".my-class { color: red; }" style="font-family:monospace;"></textarea>

          <label for="f-page-js">Custom Script (JS)</label>
          <textarea id="f-page-js" rows="4" placeholder="console.log('Hello world');" style="font-family:monospace;"></textarea>

          <p id="page-form-error" class="error hidden"></p>
          <p id="page-form-success" class="success hidden"></p>
          <div style="display:flex; gap:10px;">
            <button type="submit" id="btn-save-page" class="btn-primary" style="flex:1;">Save Page</button>
            <button type="button" id="btn-cancel-page" class="btn-ghost hidden">Cancel</button>
          </div>
        </form>
      </div>

      <!-- Right: List -->
      <div class="card list-card">
        <p class="card-title">Active Pages</p>
        <div style="overflow-x:auto;">
          <table id="tbl-pages" class="data-table">
            <thead style="text-align: left;">
              <tr><th>ID</th><th>Title/Dest</th><th width="80">Actions</th></tr>
            </thead>
            <tbody></tbody>
          </table>
        </div> <!-- closes overflow-x:auto -->
      </div> <!-- closes card list-card -->
    </div> <!-- closes layout -->
  </div> <!-- closes tab-pages -->

  <!-- ── Tab: Campaign Links ──────────────────────────── -->
  <div id="tab-slugs" class="tab-pane hidden">
    <div class="layout">

      <!-- Left: Create / Edit form -->
      <div class="card form-card">
        <p class="card-title" id="form-title">New Campaign Link</p>

        <form id="slug-form" autocomplete="off" novalidate>
          <input type="hidden" id="edit-mode" value="create" />

          <!-- Campaign selector -->
          <label for="f-campaign">Campaign <span class="req">*</span></label>
          <div id="campaign-select-wrap">
            <select id="f-campaign" name="campaign" required>
              <option value="__new__">+ Create new campaign</option>
            </select>
          </div>
          <p id="campaign-confirm-msg" class="error hidden"></p>

          <!-- Create new campaign inline -->
          <div id="new-campaign-wrap" class="hidden new-campaign-box">
            <div class="inline-row">
              <input id="f-new-campaign" type="text" placeholder="new-campaign-2026"
                autocomplete="off" spellcheck="false" />
              <button type="button" id="btn-create-campaign" class="btn-ghost btn-sm">Create</button>
            </div>
            <div class="inline-alias-row">
              <input id="f-new-campaign-alias" type="text" placeholder="alias (optional, e.g. iki)"
                autocomplete="off" spellcheck="false" maxlength="48" />
              <p id="new-camp-alias-status" class="field-hint hidden"></p>
            </div>
            <p id="campaign-error" class="error hidden"></p>
          </div>

          <!-- Slug -->
          <label for="f-slug">Slug <span class="hint-inline">(path after /c/)</span></label>
          <div class="input-row">
            <span class="input-prefix">…/c/</span>
            <input id="f-slug" name="slug" type="text" placeholder="spring-2026-yt"
              autocomplete="off" spellcheck="false" required />
          </div>
          <p class="field-hint hidden" id="slug-hint"></p>

          <!-- Route Alias -->
          <label for="f-alias">Route Alias <span class="hint-inline">(optional — short public route, e.g. "bio")</span></label>
          <input id="f-alias" name="alias" type="text" placeholder="bio"
            autocomplete="off" spellcheck="false" maxlength="48" />
          <p id="alias-status" class="field-hint hidden"></p>

          <!-- Attribution Window (TTL) -->
          <label for="f-cos-win" style="margin-top: 15px;">Attribution Window (Days) <span class="hint-inline">(TTL for cross domains)</span></label>
          <div class="input-row">
            <input id="f-cos-win" name="cos_win" type="number" list="attrDaysList" min="1" max="365" placeholder="7" value="7" style="width: 8rem;" />
            <datalist id="attrDaysList">
              <option value="1">
              <option value="7">
              <option value="30">
            </datalist>
          </div>

          <!-- Preset -->
          <label for="f-preset">UTM Preset</label>
          <select id="f-preset" name="preset">
            <option value="instagram_bio">Instagram – Bio</option>
            <option value="instagram_story">Instagram – Story</option>
            <option value="youtube_desc">YouTube – Description</option>
            <option value="spotify_bio">Spotify – Bio</option>
            <option value="tiktok_bio">TikTok – Bio</option>
            <option value="tiktok_paid">TikTok – Paid</option>
            <option value="facebook_post">Facebook – Post</option>
            <option value="paid_meta">Paid – Meta Ads</option>
            <option value="paid_google">Paid – Google Ads</option>
            <option value="custom">Custom</option>
          </select>

          <!-- Custom UTM: source + medium ONLY -->
          <div id="custom-utm" class="hidden custom-utm-box">
            <label for="f-utm-source">utm_source</label>
            <input id="f-utm-source" name="utm_source" type="text"
              placeholder="instagram" autocomplete="off" />
            <label for="f-utm-medium">utm_medium</label>
            <input id="f-utm-medium" name="utm_medium" type="text"
              placeholder="story" autocomplete="off" />
          </div>

          <!-- Additional Global UTM Defaults (lang, market) -->
          <div style="margin-top: 15px; display: flex; gap: 1rem; align-items: center;">
            <div style="display: flex; flex-direction: column;">
              <label for="f-lang" style="font-size: 0.85rem; color: #666; margin-bottom: 2px;">lang</label>
              <input id="f-lang" name="lang" type="text" value="en" autocomplete="off" style="width: 5rem;" />
            </div>
            <div style="display: flex; flex-direction: column;">
              <label for="f-market" style="font-size: 0.85rem; color: #666; margin-bottom: 2px;">market</label>
              <input id="f-market" name="market" type="text" value="global" autocomplete="off" style="width: 6rem;" />
            </div>
          </div>

          <!-- Destination overrides -->
          <details class="overrides-section">
            <summary>Destination overrides <span class="hint-inline">(optional — url, order, active, noUtm per link)</span></summary>
            <div class="overrides-grid">
              <div class="override-row">
                <label class="override-dest-label">Official Website</label>
                <div class="override-fields">
                  <input id="f-dest-official-url" class="override-url" type="url" placeholder="https://${customDomain}/tr" />
                  <input id="f-dest-official-order" class="override-order" type="number" placeholder="order" />
                  <label class="checkbox-label"><input type="checkbox" id="f-dest-official-active" checked /> Active</label>
                  <label class="checkbox-label"><input type="checkbox" id="f-dest-official-noutm" /> No UTM</label>
                </div>
              </div>
              <div class="override-row">
                <label class="override-dest-label">Educational Programs</label>
                <div class="override-fields">
                  <input id="f-dest-programs-url" class="override-url" type="url" placeholder="" />
                  <input id="f-dest-programs-order" class="override-order" type="number" placeholder="order" />
                  <label class="checkbox-label"><input type="checkbox" id="f-dest-programs-active" checked /> Active</label>
                  <label class="checkbox-label"><input type="checkbox" id="f-dest-programs-noutm" /> No UTM</label>
                </div>
              </div>
              <div class="override-row">
                <label class="override-dest-label">Latest Release</label>
                <div class="override-fields">
                  <input id="f-dest-release-url" class="override-url" type="url" placeholder="" />
                  <input id="f-dest-release-order" class="override-order" type="number" placeholder="order" />
                  <label class="checkbox-label"><input type="checkbox" id="f-dest-release-active" checked /> Active</label>
                  <label class="checkbox-label"><input type="checkbox" id="f-dest-release-noutm" /> No UTM</label>
                </div>
              </div>
              <div class="override-row">
                <label class="override-dest-label">Newsletter</label>
                <div class="override-fields">
                  <input id="f-dest-newsletter-url" class="override-url" type="url" placeholder="" />
                  <input id="f-dest-newsletter-order" class="override-order" type="number" placeholder="order" />
                  <label class="checkbox-label"><input type="checkbox" id="f-dest-newsletter-active" checked /> Active</label>
                  <label class="checkbox-label"><input type="checkbox" id="f-dest-newsletter-noutm" /> No UTM</label>
                </div>
              </div>
            </div>
          </details>

          <!-- Custom links[] editor -->
          <details class="links-section" id="links-details">
            <summary>Custom Buttons <span class="hint-inline">(adds extra buttons after base links)</span></summary>
            <div id="links-editor" class="links-editor-wrap"></div>
            <button type="button" id="btn-add-link" class="btn-ghost btn-sm" style="margin-top:.5rem">+ Add button</button>
          </details>

          <!-- Routing Maps selection -->
          <details class="landing-section" id="routing-maps-details" open>
            <summary>Custom Engine Map <span class="hint-inline">(optional — contextual auto-redirect overrides)</span></summary>
            <div class="landing-fields" style="margin-top:0.5rem;">
              <select id="f-engine-map-id">
                <option value="">[Global Default Engine]</option>
              </select>
            </div>
          </details>

          <!-- Per-slug landing customization -->
          <details class="landing-section">
            <summary>Landing Customization <span class="hint-inline">(optional — per-slug header, footer, CSS)</span></summary>
            <div class="landing-fields">
              <label for="f-custom-header-html">Custom Header HTML</label>
              <textarea id="f-custom-header-html" rows="2" placeholder="<p>Special announcement</p>" maxlength="5000"></textarea>
              <label for="f-custom-footer-html">Custom Footer HTML</label>
              <textarea id="f-custom-footer-html" rows="2" placeholder="<p>Limited time only</p>" maxlength="5000"></textarea>
              <label for="f-custom-css">Custom CSS</label>
              <textarea id="f-custom-css" rows="3" placeholder=".hub-header { color: gold; }" maxlength="10000"></textarea>
            </div>
          </details>

          <p id="form-error" class="error hidden"></p>

          <div class="form-actions">
            <button type="submit" class="btn-primary" id="btn-save">Save</button>
            <button type="button" class="btn-ghost" id="btn-cancel" style="display:none">Cancel</button>
          </div>
        </form>

        <!-- Generated link -->
        <div id="generated-wrap" class="hidden">
          <p class="generated-label">Short link</p>
          <div class="generated-row">
            <span id="generated-url" class="generated-url"></span>
            <button id="btn-copy" class="btn-ghost btn-sm">Copy</button>
          </div>
        </div>
      </div>

      <!-- Right: Slug list -->
      <div class="card list-card">
        <div class="list-header">
          <p class="card-title">Campaign Links</p>
          <input id="search-input" type="search" placeholder="Search slug…" />
          <div class="filter-row">
            <select id="filter-source">
              <option value="">All sources</option>
            </select>
            <select id="filter-medium">
              <option value="">All mediums</option>
            </select>
            <label class="toggle-label"><input type="checkbox" id="show-archived-camp-slugs" /> Archived campaigns</label>
            <label class="toggle-label"><input type="checkbox" id="show-test-camp-slugs" /> Test campaigns</label>
            <button type="button" id="btn-reset-filters" class="btn-ghost btn-sm">Reset</button>
          </div>
        </div>
        <div id="slug-list"><p class="empty-state">Loading…</p></div>
      </div>

    </div>
  </div>

  <!-- ── Tab: Campaigns (Intents) ─────────────────────── -->
  <div id="tab-campaigns" class="tab-pane hidden">
    <div class="layout" style="display: grid; grid-template-columns: 320px 1fr; gap: 1.5rem; max-width: 100%;">
      <!-- Left Panel: Intent List -->
      <div class="card" style="display: flex; flex-direction: column; gap: 1rem; height: fit-content;">
        <div class="list-header" style="display: flex; flex-direction: column; gap: 0.5rem; align-items: stretch;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <p class="card-title">Intents</p>
          </div>
          <div class="filter-row" style="display: flex; flex-direction: row; gap: 0.75rem; align-items: center; justify-content: flex-start; margin-top: 0.25rem;">
            <label class="toggle-label" style="font-size: 0.75rem; white-space: nowrap; margin-top: 0; display: flex; align-items: center; gap: 0.25rem;">
              <input type="checkbox" id="show-archived" /> Archived
            </label>
            <label class="toggle-label" style="font-size: 0.75rem; white-space: nowrap; margin-top: 0; display: flex; align-items: center; gap: 0.25rem;">
              <input type="checkbox" id="show-test-campaigns" /> Test
            </label>
          </div>
        </div>
        <div id="campaign-list" style="display: flex; flex-direction: column; gap: 0.5rem; overflow-y: auto; max-height: 50vh;"><p class="empty-state">Loading…</p></div>
      </div>

      <!-- Right Panel: Selected Intent Workspace -->
      <div id="intent-workspace" class="grid-layout" style="display: none; flex-direction: column; gap: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem;">
          <h1 id="workspace-title" style="font-size: 1.3rem;">Selected Intent</h1>
          <button id="btn-studio-new-intent" class="btn-ghost btn-sm" style="border: 1px solid var(--border); width: auto;">+ New Intent</button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 1.5rem; width: 100%;">

          <!-- 1. Intent Settings -->
          <div class="card" style="display: flex; flex-direction: column; gap: 1rem;">
            <p class="card-title">Intent Settings</p>
            <label style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8rem; color: var(--text-m);">
              Workspace Alias
              <input type="text" id="studio-campaign-alias" placeholder="e.g. ts-renew" />
            </label>            <label style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8rem; color: var(--text-m);">
              Routing & Behavior Configuration (JSON)
              <textarea id="studio-routing-config" rows="6" style="font-family: monospace; font-size: 12px;" placeholder='{
  "destinations": [],
  "evaluation": "sequential",
  "rules": []
}'></textarea>
            </label>
            <label style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8rem; color: var(--text-m);">
              Default Redirect Slug
              <select id="studio-default-slug-select">
                <option value="">(first active slug)</option>
              </select>
            </label>

            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 1rem; margin-top: 0.5rem; width: 100%;">
              <div style="display: flex; gap: 0.5rem;">
                <button id="btn-studio-archive-intent" class="btn-danger btn-sm">Archive</button>
              </div>
              <button id="btn-studio-save-intent" class="btn-primary" style="width: auto; min-width: 140px; flex: none;">Save Intent</button>
            </div>
          </div>

          <!-- 2. Landing Versions -->
          <div class="card">
            <p class="card-title">Landing Versions</p>
            <div id="studio-version-list" style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem;">
              <!-- Loaded via JS -->
            </div>
            <button id="btn-studio-add-version" class="btn-ghost btn-sm" style="border: 1px solid var(--border);">+ Create New Version</button>
          </div>

          <!-- 3. Edit Landing Version (builder) -->
          <div class="card" id="studio-builder-panel" style="display: none; flex-direction: column; gap: 1rem;">
            <p class="card-title" style="margin-bottom: 0.25rem;">Edit Landing Version</p>
            <p id="studio-current-edit-version-title" style="font-size: 1.1rem; font-weight: bold; margin-bottom: 1rem; color: var(--primary);"></p>
            <label style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8rem; color: var(--text-m);">
              Display Name
              <input type="text" id="studio-version-display-name" />
            </label>
            <label style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8rem; color: var(--text-m);">
              Version ID (System)
              <input type="text" id="studio-version-name" readonly style="opacity: 0.7; cursor: not-allowed;" />
            </label>
            <label style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8rem; color: var(--text-m);">
              Status
              <select id="studio-version-status">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8rem; color: var(--text-m);">
              Page Title
              <input type="text" id="studio-version-title" />
            </label>
            <label style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8rem; color: var(--text-m);">
              Theme
              <select id="studio-version-theme">
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="system">System Default</option>
              </select>
            </label>

            <div style="border-top: 1px solid var(--border); padding-top: 1rem; display: flex; flex-direction: column; gap: 1rem;">
              <p class="card-title" style="font-size: 0.9rem;">Page Sections & Layout</p>
              <div id="studio-layout-container" style="display: flex; flex-direction: column; gap: 0.5rem;"></div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                <button id="btn-studio-add-html" class="btn-ghost btn-sm" type="button" style="border: 1px solid var(--border);">+ Add Custom HTML</button>
                <select id="studio-comp-select" style="padding: 4px; font-size: 0.8rem;">
                  <option value="">+ Add Component...</option>
                </select>
              </div>
            </div>

            <label style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8rem; color: var(--text-m);">
              Custom CSS
              <textarea id="studio-version-css" rows="3" style="font-family: monospace;"></textarea>
            </label>
            <label style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8rem; color: var(--text-m);">
              Custom JS
              <textarea id="studio-version-js" rows="3" style="font-family: monospace;"></textarea>
            </label>

            <div style="display: flex; justify-content: flex-end; border-top: 1px solid var(--border); padding-top: 1rem; margin-top: 0.5rem; width: 100%;">
              <button id="btn-studio-save-version" class="btn-primary" style="width: auto; min-width: 140px; flex: none;">Save Version</button>
            </div>
          </div>

          <!-- 4. Active Slugs -->
          <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <p class="card-title" style="margin: 0;">Active Slugs</p>
              <button id="btn-studio-new-slug" class="btn-ghost btn-sm" style="border: 1px solid var(--border);">+ New Slug</button>
            </div>
            <div id="studio-slug-list-container" style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 250px; overflow-y: auto;">
              <!-- Loaded via JS -->
            </div>
          </div>

        </div>
      </div>
      </div>
    </div>
  </div>

  <div id="tab-routing" class="tab-pane hidden">
    <div class="paths-grid">

      <!-- ── Section A: Router Status ── -->
      <div class="card">
        <div class="list-header" style="margin-bottom:.5rem">
          <p class="card-title">Router Status</p>
          <button type="button" id="btn-router-status-refresh" class="btn-ghost btn-sm">Refresh</button>
        </div>
        <div id="router-status-body">
          <p class="hint" style="margin:0">Loading...</p>
        </div>
      </div>

      <!-- ── Section B: Compile Routes ── -->
      <div class="card">
        <p class="card-title">Compile Routes</p>
        <p class="hint">Routing activates automatically when aliases are created. Use <strong>Compile Now</strong> to force-rebuild ROUTE_ALIAS.</p>
        <div class="compile-actions">
          <button type="button" id="btn-dry-run" class="btn-ghost">Dry Run</button>
          <button type="button" id="btn-compile-now" class="btn-primary" style="flex:0 0 auto">Compile Now</button>
        </div>
        <div id="compile-result" class="hidden compile-result-box">
          <div id="compile-result-inner"></div>
        </div>
        <p id="compile-error" class="error hidden"></p>
      </div>

      <!-- ── Section C: Experiment Results (Full Width) ── -->
      <div class="card paths-section-c">
        <p class="card-title">Experiment Results</p>
        <p class="hint" style="margin-bottom:.75rem">View traffic split and click-through rate for a live A/B experiment. Counters update as pages are served and links are clicked.</p>
        <div style="display:flex;gap:.5rem;align-items:center;margin-bottom:.75rem;flex-wrap:wrap">
          <select id="exp-alias-select" style="width:180px;flex:0 0 auto">
            <option value="">Select alias&hellip;</option>
          </select>
          <button type="button" id="btn-exp-load" class="btn-ghost btn-sm">Load Results</button>
        </div>
        <p id="exp-status" class="hint hidden" style="margin-bottom:.5rem"></p>
        <p id="exp-alias-info" class="hint hidden" style="margin-bottom:.375rem;line-height:1.5"></p>
        <p id="exp-error" class="error hidden"></p>
        <p id="exp-winner" class="hidden" style="font-size:.8125rem;font-weight:600;color:var(--success,#1a7f37);margin-bottom:.5rem"></p>
        <div id="exp-results" class="hidden" style="max-width: 100%; overflow-x: auto;">
          <table class="analytics-table" style="width:100%; margin-top:.5rem; min-width: 500px;">
            <thead>
              <tr>
                <th>Variant</th>
                <th style="text-align:right">Target&nbsp;Wt%</th>
                <th style="text-align:right">Traffic</th>
                <th style="text-align:right">Clicks</th>
                <th style="text-align:right">CTR</th>
                <th style="text-align:right">Conv.</th>
                <th style="text-align:right">Conv Rate</th>
                <th style="text-align:right">Lift</th>
              </tr>
            </thead>
            <tbody id="exp-rows"></tbody>
          </table>
          <p id="exp-weight-note" class="hint" style="margin-top:.375rem;display:none;font-style:italic"></p>
        </div>
      </div>

      <!-- ── Section D: A/B Routing ── -->
      <div class="card">
        <p class="card-title">A/B Routing</p>
        <p class="hint">Set a traffic split for an alias. Weights must sum to 100. Config is cached for 60 s — changes take effect shortly after saving.</p>

        <div style="display:flex;gap:.5rem;align-items:center;margin-bottom:.75rem;flex-wrap:wrap">
          <select id="ab-alias-select" style="width:180px;flex:0 0 auto">
            <option value="">Loading aliases…</option>
          </select>
          <button type="button" id="btn-ab-load" class="btn-ghost btn-sm">Load</button>
        </div>

        <p id="ab-status" class="hint hidden" style="margin-bottom:.5rem"></p>
        <p id="ab-error" class="error hidden"></p>
        <p id="ab-success" class="hidden" style="font-size:.8125rem;color:var(--success,#1a7f37);margin-bottom:.5rem"></p>

        <div id="ab-config" class="hidden">
          <div style="display:flex;gap:.5rem;margin-bottom:.3rem;padding:0 .1rem">
            <span style="flex:1 1 160px;font-size:.72rem;font-weight:600;color:var(--text-m);text-transform:uppercase;letter-spacing:.04em">Slug</span>
            <span style="width:72px;font-size:.72rem;font-weight:600;color:var(--text-m);text-transform:uppercase;letter-spacing:.04em">Weight</span>
            <span style="width:28px"></span>
          </div>
          <div id="ab-variants"></div>
          <div style="display:flex;align-items:center;gap:.75rem;margin-top:.5rem;flex-wrap:wrap">
            <button type="button" id="btn-ab-add-row" class="btn-ghost btn-sm">+ Add Variant</button>
            <span id="ab-weight-total" style="font-size:.8rem;font-weight:500"></span>
          </div>
          <div style="display:flex;gap:.5rem;margin-top:.85rem;flex-wrap:wrap">
            <button type="button" id="btn-ab-save" class="btn-primary btn-sm">Save Config</button>
            <button type="button" id="btn-ab-delete" class="btn-ghost btn-sm">Delete Config</button>
          </div>
        </div>
      </div>



    </div>
  </div>

  <!-- ── Tab: Diagnostics ─────────────────────────────── -->
  <div id="tab-diagnostics" class="tab-pane hidden">
    <div class="verify-grid">

      <!-- ── State Decoder ── -->
      <div class="card" style="grid-column: 1 / -1;">
        <p class="card-title" style="margin-bottom:0.5rem">cos_state Decoder</p>
        <p class="hint" style="margin-bottom:1rem">Paste an encoded URI 'cos_state' value (or raw JSON) to decode its engine significance.</p>
        <input type="text" id="verify-state-input" placeholder="%7B%22uid..." style="font-family:ui-monospace,monospace; font-size:0.8rem; margin-bottom:1rem;">
        <div id="verify-state-result" class="hidden" style="background:var(--bg); padding:1rem; border:1px solid var(--border); border-radius:var(--radius-sm); font-size: 0.85rem; line-height: 1.6;"></div>
      </div>

      <!-- ── System Test (A) ── -->
      <div class="card">
        <div class="list-header" style="margin-bottom:.75rem">
          <p class="card-title">System Test</p>
          <button type="button" id="btn-run-system" class="btn-primary btn-sm">Run System Test</button>
        </div>
        <p class="hint" style="margin-bottom:1.25rem">
          Runs all checks in parallel: smoke test, manual validation, and hub link integrity.
          One-click full system verification. Allow up to ~2 minutes for AE ingestion.
        </p>
        <div id="system-status" class="hidden"></div>
        <div id="system-result" class="hidden">
          <table class="analytics-table" style="max-width:540px">
            <thead><tr><th>Check</th><th>Result</th></tr></thead>
            <tbody id="system-rows"></tbody>
          </table>
          <p id="system-meta" class="hint" style="margin-top:.75rem;font-size:.7rem"></p>
          <div id="system-fixture-info" class="hidden"
            style="margin-top:.75rem;padding:.6rem .75rem;background:var(--c-surface-2,#f6f8fa);border-radius:6px;font-size:.78rem;line-height:1.7">
            <span style="font-weight:600;color:var(--c-text-muted,#555)">Test Fixture</span><br>
            Campaign: <code id="sfi-campaign" style="font-size:.78rem"></code><br>
            Alias: <code id="sfi-alias" style="font-size:.78rem"></code><br>
            Slug: <code id="sfi-slug" style="font-size:.78rem"></code>
          </div>
          <div id="system-warnings" class="hidden" style="margin-top:.75rem">
            <p class="hint" style="font-weight:600;margin-bottom:.25rem">Warnings</p>
            <ul id="system-warning-list" style="margin:0;padding-left:1.2rem;font-size:.8rem;color:var(--c-warning,#c17b00)"></ul>
          </div>
        </div>
      </div>

      <!-- ── Smoke Test (B) ── -->
      <div class="card">
        <div class="list-header" style="margin-bottom:.75rem">
          <p class="card-title">Smoke Test</p>
          <button type="button" id="btn-run-smoke" class="btn-ghost btn-sm">Run Smoke Test</button>
        </div>
        <p class="hint" style="margin-bottom:1.25rem">
          Probes routing, KV health, and Analytics Engine pipeline. Read-only.
          AE retry takes up to ~63s.
        </p>
        <div id="diag-status" class="hidden"></div>
        <div id="diag-result" class="hidden">
          <table class="analytics-table" style="max-width:480px">
            <thead><tr><th>Check</th><th>Result</th></tr></thead>
            <tbody id="diag-rows"></tbody>
          </table>
          <p id="diag-meta" class="hint" style="margin-top:.75rem;font-size:.7rem"></p>
          <div id="diag-warnings" class="hidden" style="margin-top:.75rem">
            <p class="hint" style="font-weight:600;margin-bottom:.25rem">Warnings</p>
            <ul id="diag-warning-list" style="margin:0;padding-left:1.2rem;font-size:.8rem;color:var(--c-warning,#c17b00)"></ul>
          </div>
        </div>
      </div>

      <!-- ── Manual Validation (C) ── -->
      <div class="card">
        <div class="list-header" style="margin-bottom:.75rem">
          <p class="card-title">Manual Validation</p>
          <button type="button" id="btn-run-manual" class="btn-ghost btn-sm">Run Manual Validation</button>
        </div>
        <p class="hint" style="margin-bottom:1.25rem">
          Generates an isolated fixture campaign, fires /{alias}×2, /{alias}/offer,
          /{alias}/vsl and validates analytics with fixture-scoped filters.
          Allow up to ~2 minutes for AE ingestion.
        </p>
        <div id="manual-status" class="hidden"></div>
        <div id="manual-result" class="hidden">
          <table class="analytics-table" style="max-width:580px">
            <thead><tr><th>Check</th><th>Expected</th><th>Observed</th><th>Result</th></tr></thead>
            <tbody id="manual-rows"></tbody>
          </table>
          <p id="manual-meta" class="hint" style="margin-top:.75rem;font-size:.7rem"></p>
          <div id="manual-warnings" class="hidden" style="margin-top:.75rem">
            <ul id="manual-warning-list" style="margin:0;padding-left:1.2rem;font-size:.8rem;color:var(--c-warning,#c17b00)"></ul>
          </div>
        </div>
      </div>

      <!-- ── Hub Link Integrity (D) ── -->
      <div class="card">
        <div class="list-header" style="margin-bottom:.75rem">
          <p class="card-title">Hub Link Integrity</p>
        </div>
        <p class="hint" style="margin-bottom:.75rem">Verify all external links on a hub page are reachable.</p>
        <div style="display:flex;gap:.5rem;align-items:center;margin-bottom:1rem;flex-wrap:wrap">
          <input id="link-check-alias" type="text" placeholder="alias (e.g. nb)"
            style="flex:0 0 160px;width:160px" maxlength="60" />
          <button type="button" id="btn-link-check" class="btn-ghost btn-sm">Check Links</button>
        </div>
        <div id="link-status" class="hidden"></div>
        <ul id="link-result-list" class="hidden"
          style="margin:0;padding:0;list-style:none;font-size:.85rem;line-height:2"></ul>
      </div>

      <!-- ── Background Self-Test (E) ── -->
      <div class="card">
        <div class="list-header" style="margin-bottom:.75rem">
          <p class="card-title">Background Self-Test</p>
          <button type="button" id="btn-run-bg-test" class="btn-ghost btn-sm">Run Now</button>
        </div>
        <p class="hint" style="margin-bottom:.75rem">
          Lightweight autonomous test: creates a fixture, fires the click sequence,
          validates AE ingestion, then archives. Can be scheduled via Cron Trigger.
        </p>
        <div id="bg-test-status" class="hidden"></div>
        <div id="bg-test-last" class="hidden"
          style="font-size:.8rem;color:var(--c-text-muted,#555);margin-top:.5rem">
          <span id="bg-test-last-text"></span>
        </div>
      </div>

      <!-- ── A/B Diagnostics (F) ── -->
      <div class="card">
        <p class="card-title">A/B Diagnostics</p>
        <p class="hint" style="margin-bottom:.75rem">Simulate a routing decision to verify your A/B config. Each run uses a fresh random request ID.</p>
        <div style="display:flex;gap:.5rem;align-items:center;margin-bottom:.75rem;flex-wrap:wrap">
          <input id="abd-alias-input" type="text" placeholder="alias (e.g. launch)"
            style="width:180px;flex:0 0 auto" autocomplete="off" spellcheck="false" maxlength="48" />
          <button type="button" id="btn-abd-run" class="btn-ghost btn-sm">Test Routing</button>
        </div>
        <p id="abd-status" class="hint hidden" style="margin-bottom:.5rem"></p>
        <p id="abd-error" class="error hidden"></p>
        <pre id="abd-result" class="hidden" style="margin:0;font-size:.78rem;font-family:ui-monospace,'SF Mono',monospace;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:.6rem .75rem;overflow:auto;white-space:pre-wrap"></pre>
      </div>

    </div>
  </div>

  <div id="tab-config" class="tab-pane hidden">
    <p class="analytics-section-title" style="margin:1.25rem 1.25rem 0 1.25rem">Default Landing Page Configuration</p>
    <form id="config-form" class="landings-grid" autocomplete="off" novalidate>

      <!-- Card B: General Settings -->
      <div class="card">
        <p class="card-title">General Settings</p>
        <p class="hint">Changes apply globally to rendered pages without redeployment.</p>

        <label for="cfg-page-title">Default Page Title <span class="hint-inline">(shown in browser tab)</span></label>
        <input id="cfg-page-title" type="text" placeholder="Official Links" maxlength="200" />

        <label for="cfg-css">External CSS URL <span class="hint-inline">(optional; https only)</span></label>
        <input id="cfg-css" type="url" placeholder="https://cdn.example.com/theme.css" />

        <label for="cfg-custom-css">Global Custom CSS <span class="hint-inline">(injected as &lt;style&gt; block)</span></label>
        <textarea id="cfg-custom-css" rows="3" placeholder=".hub-header { color: red; }" maxlength="10000"></textarea>

        <p id="config-error" class="error hidden"></p>
        <p id="config-success" class="success hidden"></p>
        <div class="form-actions" style="margin-top:1.5rem">
          <button type="submit" class="btn-primary" id="btn-save-config">Save Config</button>
        </div>
      </div>

      <!-- Card C: Tracking & Integrations -->
      <div class="card">
        <p class="card-title">Tracking & Integrations</p>
        <p class="hint" style="margin-bottom:.75rem">Generate a tracking snippet for a specific conversion event (e.g. <code>purchase</code>, <code>lead</code>). Place this code on your thank-you page.</p>

        <div style="display:flex;gap:.5rem;align-items:center;margin-bottom:.75rem;flex-wrap:wrap">
          <input id="conv-event-name" type="text" placeholder="purchase"
            style="width:140px;flex:0 0 auto" autocomplete="off" />
          <button type="button" id="btn-conv-gen" class="btn-ghost btn-sm">Generate Snippet</button>
        </div>

        <div id="conv-snippet-wrap" class="hidden" style="margin-top:1rem">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem">
             <span class="hint" style="font-weight:600">JS Snippet</span>
             <button type="button" id="btn-conv-copy" class="btn-ghost btn-sm">Copy Code</button>
          </div>
          <pre id="conv-snippet" style="margin:0;font-size:.78rem;font-family:ui-monospace,'SF Mono',monospace;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:.6rem .75rem;overflow:auto;white-space:pre-wrap"></pre>
        </div>
      </div>


    </form>
  </div>

  <!-- ── Tab: Components ──────────────────────────────── -->
  <div id="tab-components" class="tab-pane hidden">
    <div class="layout">
      <!-- Left: Create/Edit Form & Version Manager -->
      <div class="card form-card">
        <div id="component-editor-container">
          <!-- Dynamically generated HTML goes here -->
        </div>
      </div>

      <!-- Right: List -->
      <div class="card list-card">
        <div class="list-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <p class="card-title" style="margin-bottom: 0;">Component Families</p>
            <div style="display: flex; gap: 12px; font-size: 0.75rem; color: var(--text-m); margin-top: 4px;">
              <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
                <input type="checkbox" id="comp-filter-active" checked /> Active
              </label>
              <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
                <input type="checkbox" id="comp-filter-inactive" checked /> Inactive
              </label>
              <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
                <input type="checkbox" id="comp-filter-archived" /> Archived
              </label>
            </div>
          </div>
          <button type="button" id="btn-new-family" class="btn-primary btn-sm" style="width: auto; padding: 6px 12px;">+ New Component</button>
        </div>
        <div style="overflow-x:auto;">
          <table class="data-table" id="tbl-components">
            <thead style="text-align: left;">
              <tr>
                <th>Slug</th>
                <th>Live</th>
                <th>Latest</th>
                <th>Status</th>
                <th>Modified</th>
              </tr>
            </thead>
            <tbody id="tbl-components-body">
              <tr><td colspan="5" class="empty-state">Loading components...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>


  </div>

</div>

<script>
(function () {
  "use strict";

  /* ── State ──────────────────────────────────────────── */

  function formatLocalTime(raw) {
    if (!raw) return "—";
    var iso = String(raw).replace(" ", "T");
    if (!iso.includes("Z")) iso += "Z";
    var d = new Date(iso);
    var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    var day = d.getDate();
    var month = months[d.getMonth()];
    var year = String(d.getFullYear()).slice(-2);
    var hr = String(d.getHours()).padStart(2, "0");
    var min = String(d.getMinutes()).padStart(2, "0");
    return day + " " + month + " " + year + ", " + hr + ":" + min;
  }
  var token                 = "";      // session Bearer token
  var analyticsWindow       = localStorage.getItem("analyticsWindow") || "24h";
  var rawAnalyticsSummary   = null;    // { conversions, total_clicks, active_experiments, sources }
  var rawAnalyticsSources   = [];      // source breakdown
  var pageCampaigns         = 1;
  var pageAliases           = 1;
  var pageEvents            = 1;
  var dashChart             = null;    // Chart.js instance (main)
  var dashSourceChart       = null;    // Chart.js instance (sources)
  var campaigns             = [];      // full objects { name, isActive, createdAt }
  var slugCache             = [];      // local copy of all records (PART 1)
  var slugTouched           = false;
  var campaignInteracted    = false;
  var showArchivedCampaigns     = false;
  var showArchivedCampaignSlugs = false;
  var showTestCampaignSlugs     = false;   // Campaign Links tab test filter
  var showTestCampaigns         = false;   // Campaigns tab test filter
  var showTestAnalytics         = false;   // Analytics tab test filter
  var selectedWorkspace         = "";      // "" = All workspaces (PART 7)
  var workspaceList             = [];      // derived from campaigns array (PART 7)
  var rawAnalyticsCampaigns     = [];      // cached for re-filtering on toggle
  var rawAnalyticsAliases       = [];      // PART 3: raw alias rows
  var rawAnalyticsSlugs         = [];      // PART 3: raw slug rows
  var rawAnalyticsRecent        = [];      // PART 3: raw recent-events rows
  var campaignsTabLoaded        = false;
  var configTabLoaded           = false;
  var componentsTabLoaded       = false;
  var componentFamilies         = [];
  var componentVersions         = [];
  var pageSelectedComponentIds  = [];
  var pageLayoutItems           = [];
  var selectedFamilyId          = null;
  var selectedVersionNumber     = null;
  var recentEventsPage          = 0;
  var showAllExperiments        = false;
  var analyticsStartDate    = localStorage.getItem("analyticsStartDate") || "";
  var analyticsEndDate      = localStorage.getItem("analyticsEndDate") || "";

  // Dynamic "Today" persistence (Prompt 124)
  var todayStr = new Date().toISOString().split("T")[0];
  if (analyticsEndDate && analyticsEndDate >= (localStorage.getItem("analyticsEndDateSavedAs") || "9999-12-31")) {
    analyticsEndDate = todayStr;
  }

  var GRACE_WINDOW_MS   = 5 * 60 * 1000;
  var aliasCheckTimer   = null;
  var routingTabLoaded     = false;
  var analyticsTabLoaded   = false;
  var slugsTabLoaded       = false;
  var diagnosticsTabLoaded = false;
  var kartraTabLoaded      = false;

  var $ = function (id) { return document.getElementById(id); };

  /* ── DOM refs ────────────────────────────────────────── */
  var elGate            = $("gate");
  var elPanel           = $("panel");
  var elGateForm        = $("gate-form");
  var elGateError       = $("gate-error");
  var elTokenInput      = $("token-input");

  var elForm            = $("slug-form");
  var elFormTitle       = $("form-title");
  var elEditMode        = $("edit-mode");
  var elCampaignSelect  = $("f-campaign");
  var elNewCampWrap     = $("new-campaign-wrap");
  var elNewCampInput    = $("f-new-campaign");
  var elBtnCreateCamp   = $("btn-create-campaign");
  var elCampError       = $("campaign-error");
  var elCampConfirmMsg  = $("campaign-confirm-msg");
  var elSlugInput       = $("f-slug");
  var elSlugHint        = $("slug-hint");
  var elPreset          = $("f-preset");
  var elCustomUtm       = $("custom-utm");
  var elFormError       = $("form-error");
  var elBtnSave         = $("btn-save");
  var elBtnCancel       = $("btn-cancel");
  var elBtnLogout       = $("btn-logout");
  var elGenWrap         = $("generated-wrap");
  var elGenUrl          = $("generated-url");
  var elBtnCopy         = $("btn-copy");
  var elSlugList        = $("slug-list");
  var elSearch          = $("search-input");
  var elFilterSource    = $("filter-source");
  var elFilterMedium    = $("filter-medium");
  var elBtnResetFilters = $("btn-reset-filters");
  var elLinksEditor     = $("links-editor");
  var elBtnAddLink      = $("btn-add-link");
  var elCampaignList          = $("campaign-list");
  var elShowArchived          = $("show-archived");
  var elShowArchivedCampSlugs = $("show-archived-camp-slugs");
  var elShowTestCampSlugs     = $("show-test-camp-slugs");
  var elShowTestCampaigns     = $("show-test-campaigns");
  var elShowTestAnalytics     = $("show-test-analytics");
  var elConfigForm      = $("config-form");
  var elBaseLinksEditor = $("base-links-editor");
  var elBtnAddConfigLink= $("btn-add-config-link");
  var elConfigError     = $("config-error");
  var elConfigSuccess   = $("config-success");
  var elBtnSaveConfig   = $("btn-save-config");

  /* analytics DOM refs */
  var elAnalyticsStatus   = $("analytics-status");
  var elAnalyticsGenerated= $("analytics-generated");
  var elBtnRefreshAnalytics = $("btn-refresh-analytics");

  var elBtnRunSystem  = $("btn-run-system");
  var elSystemStatus  = $("system-status");
  var elSystemResult  = $("system-result");
  var elSystemRows    = $("system-rows");
  var elSystemMeta    = $("system-meta");
  var elSystemWarns   = $("system-warnings");
  var elSystemWarnList= $("system-warning-list");
  var elSystemFixture = $("system-fixture-info");
  var elSfiCampaign   = $("sfi-campaign");
  var elSfiAlias      = $("sfi-alias");
  var elSfiSlug       = $("sfi-slug");

  var elBtnRunSmoke   = $("btn-run-smoke");
  var elDiagStatus    = $("diag-status");
  var elDiagResult    = $("diag-result");
  var elDiagRows      = $("diag-rows");
  var elDiagMeta      = $("diag-meta");
  var elDiagWarnings  = $("diag-warnings");
  var elDiagWarnList  = $("diag-warning-list");

  var elBtnRunManual  = $("btn-run-manual");
  var elManualStatus  = $("manual-status");
  var elManualResult  = $("manual-result");
  var elManualRows    = $("manual-rows");
  var elManualMeta    = $("manual-meta");
  var elManualWarns   = $("manual-warnings");
  var elManualWarnList= $("manual-warning-list");

  var elLinkAlias     = $("link-check-alias");
  var elBtnLinkCheck  = $("btn-link-check");
  var elLinkStatus    = $("link-status");
  var elLinkList      = $("link-result-list");

  var elBtnRunBgTest  = $("btn-run-bg-test");
  var elBgTestStatus  = $("bg-test-status");
  var elBgTestLast    = $("bg-test-last");
  var elBgTestLastTxt = $("bg-test-last-text");

  /* stopwatch DOM refs (PART 7)
   * #sw-display  — <button> — click target; textContent updated directly by swTick() */
  var elSwDisplay = $("sw-display");
  var elBtnSwReset = $("btn-sw-reset");

  /* workspace DOM refs (PART 8) */
  var elWsSelector = $("ws-selector");
  var elWsSelect   = $("ws-select");

  /* alias + routing DOM refs */
  var elSlugAlias              = $("f-alias");
  var elAliasStatus            = $("alias-status");
  var elNewCampAlias           = $("f-new-campaign-alias");
  var elNewCampAliasStatus     = $("new-camp-alias-status");
  var elBtnDryRun              = $("btn-dry-run");
  var elBtnCompileNow          = $("btn-compile-now");
  var elBtnRouterStatusRefresh = $("btn-router-status-refresh");
  var elRouterStatusBody       = $("router-status-body");
  var elCompileResult     = $("compile-result");
  var elCompileResultInner= $("compile-result-inner");
  var elCompileError      = $("compile-error");

  /* A/B config DOM refs */
  var elAbAliasSelect = $("ab-alias-select");
  var elBtnAbLoad     = $("btn-ab-load");
  var elAbStatus      = $("ab-status");
  var elAbError       = $("ab-error");
  var elAbSuccess     = $("ab-success");
  var elAbConfig      = $("ab-config");
  var elAbVariants    = $("ab-variants");
  var elBtnAbAddRow   = $("btn-ab-add-row");
  var elAbWeightTotal = $("ab-weight-total");
  var elBtnAbSave     = $("btn-ab-save");
  var elBtnAbDelete   = $("btn-ab-delete");

  /* A/B diagnostics DOM refs */
  var elAbdAliasInput = $("abd-alias-input");
  var elBtnAbdRun     = $("btn-abd-run");
  var elAbdStatus     = $("abd-status");
  var elAbdError      = $("abd-error");
  var elAbdResult     = $("abd-result");

  /* Experiment Results DOM refs */
  var elExpAliasSelect = $("exp-alias-select");
  var elBtnExpLoad     = $("btn-exp-load");
  var elExpStatus      = $("exp-status");
  var elExpAliasInfo   = $("exp-alias-info");
  var elExpError       = $("exp-error");
  var elExpWinner      = $("exp-winner");
  var elExpResults     = $("exp-results");
  var elExpRows        = $("exp-rows");
  var elExpWeightNote  = $("exp-weight-note");
  var elLnkOpenInLab   = $("lnk-open-in-lab");

  /* Conversion Signals DOM refs */
  var elConvEventName   = $("conv-event-name");
  var elBtnConvGen      = $("btn-conv-gen");
  var elConvSnippetWrap = $("conv-snippet-wrap");
  var elConvSnippet     = $("conv-snippet");
  var elBtnConvCopy     = $("btn-conv-copy");

  /* ── UTM Presets ─────────────────────────────────────── */
  var PRESETS = {
    instagram_bio:   { utm_source: "instagram", utm_medium: "bio" },
    instagram_story: { utm_source: "instagram", utm_medium: "story" },
    youtube_desc:    { utm_source: "youtube",   utm_medium: "description" },
    spotify_bio:     { utm_source: "spotify",   utm_medium: "bio" },
    tiktok_bio:      { utm_source: "tiktok",    utm_medium: "bio" },
    tiktok_paid:     { utm_source: "tiktok",    utm_medium: "paid" },
    facebook_post:   { utm_source: "facebook",  utm_medium: "post" },
    paid_meta:       { utm_source: "meta",       utm_medium: "paid" },
    paid_google:     { utm_source: "google",    utm_medium: "cpc" },
    custom:          {}
  };

  var PRESET_SUFFIX = {
    instagram_bio: "igbio", instagram_story: "igstory", youtube_desc: "yt",
    spotify_bio: "spbio", tiktok_bio: "ttbio", tiktok_paid: "ttpaid",
    facebook_post: "fbpost", paid_meta: "meta", paid_google: "google", custom: ""
  };

  /* ── Token helpers ───────────────────────────────────── */
  var TOKEN_KEY = "admin_token";
  function loadToken() {
    try {
      // Clear legacy plain text token
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem("_sp_tok");
    } catch (e) {}
    return ""; // Token is now in HttpOnly cookie
  }
  function saveToken(t) {
    // No-op. Session is managed by backend cookie.
  }
  function clearToken() {
    // No-op.
  }

  /* ── API helpers ─────────────────────────────────────── */
  function authHeaders() {
    // Fetch automatically sends same-origin cookies, so we just need Content-Type
    return { "Content-Type": "application/json" };
  }
  async function apiFetch(path, opts) {
    opts = Object.assign({ headers: {} }, opts || {});
    if (opts.credentials === undefined) opts.credentials = "same-origin";
    opts.headers = Object.assign({}, authHeaders(), opts.headers);
    var res = await fetch(path, opts);
    if (res.status === 401) {
      // Do NOT call clearToken() here — that would wipe localStorage and break
      // /admin/experiments (which reads the same "admin_token" key on page load).
      // Instead just show the gate; re-entering the token will call saveToken()
      // which overwrites localStorage.  Explicit sign-out is the only way to
      // fully clear the session.
      showGate("Session expired — please sign in again.");
      throw new Error("401");
    }
    return res;
  }

  /* ── UI helpers ──────────────────────────────────────── */
  function show(el) { el.classList.remove("hidden"); }
  function hide(el) { el.classList.add("hidden"); }
  function showErr(el, msg) { el.textContent = msg; show(el); }
  function hideErr(el) { hide(el); el.textContent = ""; }
  function esc(s) {
    return String(s || "")
      .replace(/&/g,"&amp;").replace(/</g,"&lt;")
      .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  /* ── URL helpers ───────────────────────────────────── */
  function normalizeUrl(str) {
    if (!str || typeof str !== "string") return "";
    var trimmed = str.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("https://") || trimmed.startsWith("http://") ||
        trimmed.startsWith("mailto:") || trimmed.startsWith("tel:")) {
      return trimmed;
    }
    return "https://" + trimmed;
  }

  function isWithinGraceWindow(createdAt) {
    if (!createdAt) return false;
    try {
      var t = new Date(createdAt).getTime();
      if (isNaN(t)) return false;
      return Date.now() - t < GRACE_WINDOW_MS;
    } catch (e) { return false; }
  }

  /* ── Alias validation helpers ────────────────────────── */
  var ALIAS_RE = /^[a-z0-9-]{1,48}$/;

  function isValidAliasFormat(val) {
    return ALIAS_RE.test(val);
  }

  async function checkAlias(value) {
    try {
      var res  = await apiFetch("/api/admin/check-alias?value=" + encodeURIComponent(value));
      var data = await res.json();
      return data;
    } catch (e) { return null; }
  }

  function showAliasStatus(el, data, currentAlias) {
    if (!data) {
      el.textContent = "Could not check — will validate on save.";
      el.className = "field-hint";
      show(el);
      return;
    }
    if (data.available) {
      el.textContent = "✓ Available";
      el.className = "field-hint alias-ok";
      show(el);
    } else if (data.reason === "invalid_alias_format") {
      el.textContent = "Invalid format. Use lowercase letters, numbers, hyphens (max 48 chars).";
      el.className = "field-hint alias-err";
      show(el);
    } else if (data.conflict) {
      var type = data.conflict.type === "campaign_alias" ? "campaign alias" : "slug alias";
      el.textContent = "Conflict: already used as " + type + " → " + esc(data.conflict.resolves_to);
      el.className = "field-hint alias-err";
      show(el);
    } else {
      el.textContent = "Alias unavailable.";
      el.className = "field-hint alias-err";
      show(el);
    }
  }

  function attachAliasBlur(inputEl, statusEl, getCurrentAlias) {
    inputEl.addEventListener("blur", function () {
      clearTimeout(aliasCheckTimer);
      var val = inputEl.value.trim().toLowerCase();
      if (!val) { hide(statusEl); statusEl.textContent = ""; return; }
      // If same as current alias (edit mode), mark as current
      var cur = getCurrentAlias ? getCurrentAlias() : null;
      if (cur && val === cur) {
        statusEl.textContent = "Current alias";
        statusEl.className = "field-hint";
        show(statusEl);
        return;
      }
      if (!isValidAliasFormat(val)) {
        statusEl.textContent = "Invalid format. Use lowercase letters, numbers, hyphens (max 48 chars).";
        statusEl.className = "field-hint alias-err";
        show(statusEl);
        return;
      }
      statusEl.textContent = "Checking…";
      statusEl.className = "field-hint";
      show(statusEl);
      aliasCheckTimer = setTimeout(async function () {
        var data = await checkAlias(val);
        showAliasStatus(statusEl, data, cur);
      }, 0);
    });
  }

  /* Wire slug alias blur */
  attachAliasBlur(elSlugAlias, elAliasStatus, function () {
    /* returns the alias that was loaded during editSlug() */
    return elSlugAlias.dataset.originalAlias || null;
  });

  /* Wire new-campaign alias blur */
  attachAliasBlur(elNewCampAlias, elNewCampAliasStatus, null);

  function shakeElement(el) {
    el.classList.remove("shake");
    void el.offsetWidth;
    el.classList.add("shake");
    el.addEventListener("animationend", function handler() {
      el.classList.remove("shake");
      el.removeEventListener("animationend", handler);
    });
  }

  function showGate(msg) {
    hide(elPanel); show(elGate);
    if (msg) showErr(elGateError, msg);
    elTokenInput.value = "";
    setTimeout(function () { elTokenInput.focus(); }, 50);
  }
  function showPanel() {
    hide(elGate); show(elPanel);
    analyticsTabLoaded = true;

    // Load persisted filters (already partially loaded at top of script, but sync to UI here)
    if (analyticsStartDate && $("analytics-start-date")) {
      $("analytics-start-date").value = analyticsStartDate;
    }
    if (analyticsEndDate && $("analytics-end-date")) {
      $("analytics-end-date").value = analyticsEndDate;
    }

    // Sync active class on buttons - ONLY if no custom date range is set
    document.querySelectorAll("#analytics-time-filters .filter-btn").forEach(function (b) {
      var isWinMatch = b.getAttribute("data-window") === analyticsWindow;
      b.classList.toggle("active", isWinMatch && !analyticsStartDate && !analyticsEndDate);
    });
    // Sync mobile select
    var sel = document.getElementById("analytics-time-select");
    if (sel && !analyticsStartDate && !analyticsEndDate) {
      sel.value = analyticsWindow;
    }

    loadAnalytics();
    // Also prime slug form data in background
    loadCampaigns();
  }

  /* ── Tabs ────────────────────────────────────────────── */
  var pagesTabLoaded = false;
    var tabBtns  = document.querySelectorAll(".tab-btn");
  var tabPanes = document.querySelectorAll(".tab-pane");

  tabBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var target = btn.dataset.tab;
      tabBtns.forEach(function (b) { b.classList.remove("active"); });
      tabPanes.forEach(function (p) { p.classList.add("hidden"); });
      btn.classList.add("active");
      $("tab-" + target).classList.remove("hidden");

      if (target === "analytics" && !analyticsTabLoaded) {
        analyticsTabLoaded = true;
        loadAnalytics();
      }
      if (target === "slugs" && !slugsTabLoaded) {
        slugsTabLoaded = true;
        loadSlugs();
      }
      if (target === "campaigns" && !campaignsTabLoaded) {
        campaignsTabLoaded = true;
        loadCampaignList();
        initCampaignWorkspaceListeners();
      }
      if (target === "config" && !configTabLoaded) {
        configTabLoaded = true;
        loadConfig();
      }
      if (target === "components" && !componentsTabLoaded) {
        componentsTabLoaded = true;
        loadComponents();
      }
      if (target === "pages" && !pagesTabLoaded) {
        pagesTabLoaded = true;
        loadPages();
        loadComponents();
      }
      if (target === "routing" && !routingTabLoaded) {
        routingTabLoaded = true;
        loadRouterStatus();   // PART 7 — show router status on first open
        loadAbAliases();      // populate alias selector for A/B config card
        if (slugCache.length === 0) loadSlugs();  // ensure variant slug selects are populated
      }
      if (target === "diagnostics" && !diagnosticsTabLoaded) {
        diagnosticsTabLoaded = true;
        loadBgTestLast();   // PART 6 — show last background test timestamp on first open
      }
          });
  });

  /* ── Gate form ───────────────────────────────────────── */
  elGateForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    hideErr(elGateError);
    var t = elTokenInput.value.trim();
    if (!t) return;

    var btn = elGateForm.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;

    try {
      // Call the login endpoint
      var loginRes = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: t }),
        credentials: "same-origin"
      });

      if (!loginRes.ok) {
        showErr(elGateError, "Invalid password — try again.");
        if (btn) btn.disabled = false;
        return;
      }

      // Cookie is now set, verify access
      var res = await apiFetch("/api/slugs");
      if (res.ok) {
        showPanel();
      }
      else {
        showErr(elGateError, "Session error — try again.");
      }
    } catch (err) {
      if (err.message !== "401") showErr(elGateError, "Connection error. Try again.");
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  elBtnLogout.addEventListener("click", async function () {
    var btn = elBtnLogout;
    btn.disabled = true;
    try {
      await fetch("/api/admin/logout", { method: "POST", credentials: "same-origin" });
    } catch(e) {}
    btn.disabled = false;
    showGate();
  });

  /* ── Pages ───────────────────────────────────────────── */
  var pagesStore = [];
  async function loadPages() {
    try {
      var res = await apiFetch("/api/admin/pages");
      if (res.ok) {
        var d = await res.json();
        pagesStore = d.pages || [];
        renderPages();
      }
    } catch(e) { console.error("Failed loading pages", e); }
  }

  function renderPages() {
    var tbody = $("tbl-pages").querySelector("tbody");
    tbody.innerHTML = "";
    if (!pagesStore.length) {
      tbody.innerHTML = "<tr><td colspan='3' class='empty-state'>No pages created yet.</td></tr>";
      return;
    }
    pagesStore.forEach(function(item) {
      var tr = document.createElement("tr");
      var titleOrDest = item.redirectUrl || (item.headerInfo && item.headerInfo.title) || "-";
      tr.innerHTML = "<td><a href='/" + encodeURIComponent(item.id) + "' target='_blank' style='color:var(--accent);text-decoration:underline;'><code>" + esc(item.id) + "</code></a></td><td>" + esc(titleOrDest) + "</td>" +
        "<td><div style='display:flex;gap:5px;'>" +
        "<button class='btn-ghost btn-sm btn-edit-page' data-id='" + esc(item.id) + "'>Edit</button>" +
        "<button class='btn-ghost btn-sm btn-del-page' style='color:var(--danger)' data-id='" + esc(item.id) + "'>Del</button>" +
        "</div></td>";
      tbody.appendChild(tr);
    });

    document.querySelectorAll(".btn-edit-page").forEach(function(btn) {
      btn.addEventListener("click", function() { editPage(this.dataset.id); });
    });

    document.querySelectorAll(".btn-del-page").forEach(function(btn) {
      btn.addEventListener("click", async function() {
        if (!confirm("Delete page?")) return;
        var res = await apiFetch("/api/admin/pages?id=" + encodeURIComponent(this.dataset.id), {
          method: "DELETE"
        });
        if (res.ok) await loadPages();
      });
    });
  }

  function editPage(id) {
    var p = pagesStore.find(function(item) { return item.id === id; });
    if (!p) return;
    $("f-page-editing").value = p.id;
    $("f-page-id").value = p.id;
    $("f-page-id").disabled = true;
    $("f-page-title").value = (p.headerInfo && p.headerInfo.title) || "";
    $("f-page-theme").value = p.theme || "dark";
    $("f-page-url").value = p.redirectUrl || "";
    $("f-page-is-conv").checked = !!p.isConversion;
    $("f-page-html").value = p.customBodyHtml || "";
    $("f-page-css").value = p.customStyleCss || "";
    $("f-page-js").value = p.customScript || "";

    if (Array.isArray(p.layout)) {
      pageLayoutItems = p.layout.filter(function(item) { return item.type !== "links"; }).map(function(item) {
        return {
          type: item.type,
          id: item.id,
          name: item.name || "",
          content: item.content || ""
        };
      });
    } else {
      pageLayoutItems = convertPageToLayout(p).filter(function(item) { return item.type !== "links"; });
    }
    renderPageLayoutEditor();

    $("page-form-title").textContent = "Editing: " + id;
    $("btn-cancel-page").classList.remove("hidden");

    var formCard = document.querySelector("#tab-pages .form-card");
    if (formCard) formCard.scrollIntoView({ behavior: "smooth" });
  }

  $("btn-cancel-page").addEventListener("click", function() {
    $("page-form").reset();
    $("f-page-editing").value = "";
    $("f-page-id").disabled = false;
    $("page-form-title").textContent = "New Landing Page";
    $("btn-cancel-page").classList.add("hidden");

    pageLayoutItems = getDefaultLayout();
    renderPageLayoutEditor();
  });

  var pageForm = $("page-form");
  if (pageForm) {
    pageForm.addEventListener("submit", async function(e) {
      e.preventDefault();
      $("btn-save-page").disabled = true;
      hideErr($("page-form-error")); hideErr($("page-form-success"));

      var payload = {
        id: $("f-page-id").value.trim(),
        theme: $("f-page-theme").value,
        headerInfo: { title: $("f-page-title").value.trim() },
        linksType: "dynamic",
        links: [],
        isConversion: $("f-page-is-conv").checked,
        customBodyHtml: (function() {
          var firstHtml = pageLayoutItems.find(function(x) { return x.type === "custom_html"; });
          return firstHtml ? firstHtml.content.trim() : "";
        })(),
        customStyleCss: $("f-page-css").value.trim(),
        customScript: $("f-page-js").value.trim(),
        components: pageLayoutItems
          .filter(function(x) { return x.type === "component"; })
          .map(function(x) { return x.id; }),
        layout: pageLayoutItems
      };
      if ($("f-page-url").value.trim()) payload.redirectUrl = $("f-page-url").value.trim();

      try {
        var res = await apiFetch("/api/admin/pages", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          try {
            await apiFetch("/api/admin/components", {
              method: "PUT",
              body: JSON.stringify({ action: "sync_index" })
            });
          } catch (compErr) {
            console.error("Index sync failed:", compErr);
          }

          $("page-form-success").textContent = "Page saved!";
          $("page-form-success").classList.remove("hidden");
          pageForm.reset();
          $("f-page-editing").value = "";
          $("f-page-id").disabled = false;
          $("page-form-title").textContent = "New Landing Page";
          $("btn-cancel-page").classList.add("hidden");

          pageLayoutItems = getDefaultLayout();
          renderPageLayoutEditor();

          await loadPages();
        } else {
          var d = await res.json();
          showErr($("page-form-error"), d.error || "Failed to save page");
        }
      } catch(e) {
        showErr($("page-form-error"), e.toString());
      }
      $("btn-save-page").disabled = false;
    });
  }
  // Initialize Layout Manager controls
  var addHtmlBtn = $("btn-add-layout-html");
  if (addHtmlBtn) {
    addHtmlBtn.addEventListener("click", function() {
      pageLayoutItems.push({
        type: "custom_html",
        id: "section-" + Date.now(),
        name: "Custom HTML Section",
        content: ""
      });
      renderPageLayoutEditor();
    });
  }

  var addCompSelect = $("add-layout-comp-select");
  if (addCompSelect) {
    addCompSelect.addEventListener("change", function() {
      var val = addCompSelect.value;
      if (val) {
        if (val === "links-block") {
          pageLayoutItems.push({
            type: "links",
            id: "links",
            name: "Default Link Buttons"
          });
        } else {
          pageLayoutItems.push({
            type: "component",
            id: val
          });
        }
        addCompSelect.value = "";
        renderPageLayoutEditor();
      }
    });
  }

  function getDefaultLayout() {
    var layout = [];
    var activeFamilies = componentFamilies.filter(function(f) { return f.status === "active"; });
    var placementOrder = { "hero": 1, "trust": 2, "process": 3, "objection": 4, "cta": 5, "legal": 6, "footer": 7 };
    activeFamilies.sort(function(a, b) {
      var pA = placementOrder[(a.placement_hint || a.type || "").toLowerCase()] || 99;
      var pB = placementOrder[(b.placement_hint || b.type || "").toLowerCase()] || 99;
      if (pA !== pB) return pA - pB;
      return (a.priority || 0) - (b.priority || 0);
    });

    activeFamilies.forEach(function(f) {
      layout.push({
        type: "component",
        id: f.family_id
      });
    });
    return layout;
  }

  function convertPageToLayout(p) {
    var layout = [];
    var comps = Array.isArray(p.components) ? p.components : [];
    var placementOrder = { "hero": 1, "trust": 2, "process": 3, "objection": 4, "cta": 5, "legal": 6, "footer": 7 };

    var resolvedComps = comps.map(function(fid) {
      return componentFamilies.find(function(f) { return f.family_id === fid || f.family_key === fid; });
    }).filter(Boolean);

    resolvedComps.sort(function(a, b) {
      var pA = placementOrder[(a.placement_hint || a.type || "").toLowerCase()] || 99;
      var pB = placementOrder[(b.placement_hint || b.type || "").toLowerCase()] || 99;
      if (pA !== pB) return pA - pB;
      return (a.priority || 0) - (b.priority || 0);
    });

    resolvedComps.forEach(function(f) {
      layout.push({
        type: "component",
        id: f.family_id
      });
    });

    if (p.customBodyHtml) {
      layout.push({
        type: "custom_html",
        id: "custom-body",
        name: "Custom Body HTML",
        content: p.customBodyHtml || ""
      });
    }
    return layout;
  }

  function populateLayoutComponentsDropdown() {
    var select = $("add-layout-comp-select");
    if (!select) return;
    select.innerHTML = '<option value="">+ Add Component...</option>';

    var sorted = componentFamilies.slice().sort(function(a, b) {
      return a.family_name.localeCompare(b.family_name);
    });
    sorted.forEach(function(f) {
      if (f.status !== "archived") {
        select.innerHTML += '<option value="' + f.family_id + '">' + esc(f.family_name) + ' (' + esc(f.status) + ')</option>';
      }
    });
  }

  function renderPageLayoutEditor() {
    var container = $("page-layout-container");
    if (!container) return;

    if (pageLayoutItems.length === 0) {
      container.innerHTML = '<p class="hint" style="text-align:center; padding:20px; border:1px dashed var(--border); border-radius:var(--radius-sm);">Layout is empty. Add a component or HTML section to get started.</p>';
      return;
    }

    var html = "";
    pageLayoutItems.forEach(function(item, idx) {
      var isFirst = idx === 0;
      var isLast = idx === pageLayoutItems.length - 1;
      var cardStyle = "display:flex; flex-direction:column; gap:8px; padding:12px; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-sm); position:relative;";

      var upBtn = '<button type="button" class="btn-layout-move" data-idx="' + idx + '" data-dir="up" ' + (isFirst ? 'disabled style="opacity:0.2;cursor:default;"' : '') + ' style="border:none; background:transparent; cursor:pointer; padding:2px 6px; font-weight:bold; color:var(--text);">&#9650;</button>';
      var downBtn = '<button type="button" class="btn-layout-move" data-idx="' + idx + '" data-dir="down" ' + (isLast ? 'disabled style="opacity:0.2;cursor:default;"' : '') + ' style="border:none; background:transparent; cursor:pointer; padding:2px 6px; font-weight:bold; color:var(--text);">&#9660;</button>';

      var orderControls = '<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; border-right:1px solid var(--border); padding-right:10px; gap:4px;">' +
                            upBtn +
                            '<span style="font-size:0.75rem; font-weight:bold; opacity:0.6;">' + (idx + 1) + '</span>' +
                            downBtn +
                          '</div>';

      var removeBtn = '<button type="button" class="btn-layout-remove" data-idx="' + idx + '" style="border:none; background:transparent; color:var(--danger); font-size:1.2rem; cursor:pointer; font-weight:bold; line-height:1; padding:4px 8px;">&times;</button>';

      if (item.type === "component") {
        var f = componentFamilies.find(function(c) { return c.family_id === item.id; });
        var name = f ? f.family_name : "Component: " + item.id;
        var key = f ? f.family_key : item.id;
        var status = f ? f.status : "unknown";
        var statusBadge = status === "active"
          ? '<span style="font-size:0.7rem; background:rgba(0,128,0,0.1); color:green; padding:1px 5px; border-radius:3px; text-transform:uppercase; font-weight:bold;">active</span>'
          : '<span style="font-size:0.7rem; background:var(--border); color:var(--text-m); padding:1px 5px; border-radius:3px; text-transform:uppercase;">' + esc(status) + '</span>';

        html +=
          '<div style="' + cardStyle + '">' +
            '<div style="display:flex; align-items:center; justify-content:space-between; width:100%;">' +
              '<div style="display:flex; align-items:center; gap:12px; flex:1;">' +
                orderControls +
                '<div style="display:flex; flex-direction:column; gap:2px;">' +
                  '<div style="font-size:0.85rem; font-weight:600; color:var(--text);">' + esc(name) + '</div>' +
                  '<div style="font-family:monospace; font-size:0.7rem; opacity:0.6;">' + esc(key) + '</div>' +
                '</div>' +
              '</div>' +
              '<div style="display:flex; align-items:center; gap:10px;">' +
                statusBadge +
                removeBtn +
              '</div>' +
            '</div>' +
          '</div>';
      } else if (item.type === "links") {
        html +=
          '<div style="' + cardStyle + '">' +
            '<div style="display:flex; align-items:center; justify-content:space-between; width:100%;">' +
              '<div style="display:flex; align-items:center; gap:12px; flex:1;">' +
                orderControls +
                '<div style="display:flex; flex-direction:column; gap:2px;">' +
                  '<div style="font-size:0.85rem; font-weight:600; color:var(--text);">' + esc(item.name || "Default Link Buttons") + '</div>' +
                  '<div style="font-size:0.7rem; opacity:0.6;">Displays the landing page dynamic links list</div>' +
                '</div>' +
              '</div>' +
              removeBtn +
            '</div>' +
          '</div>';
      } else {
        var sectionName = item.name || "Custom HTML Section";
        html +=
          '<div style="' + cardStyle + '">' +
            '<div style="display:flex; align-items:flex-start; justify-content:space-between; width:100%; gap:10px;">' +
              '<div style="display:flex; align-items:center; gap:12px; flex:1;">' +
                orderControls +
                '<div style="display:flex; flex-direction:column; gap:6px; flex:1;">' +
                  '<input type="text" class="layout-html-title" data-idx="' + idx + '" value="' + esc(sectionName) + '" placeholder="Section Title (e.g. Custom Body)" style="font-size:0.8rem; font-weight:600; padding:4px 8px; border:1px solid var(--border); background:var(--bg); color:var(--text); border-radius:4px; width:100%;" />' +
                  '<textarea class="layout-html-content" data-idx="' + idx + '" rows="4" placeholder="Enter custom HTML/CSS/JS..." style="font-family:monospace; font-size:0.8rem; padding:6px; border:1px solid var(--border); background:var(--bg); color:var(--text); border-radius:4px; width:100%; resize:vertical;">' + esc(item.content || "") + '</textarea>' +
                '</div>' +
              '</div>' +
              removeBtn +
            '</div>' +
          '</div>';
      }
    });

    container.innerHTML = html;

    container.querySelectorAll(".btn-layout-move").forEach(function(btn) {
      btn.addEventListener("click", function() {
        var idx = parseInt(btn.dataset.idx);
        var dir = btn.dataset.dir;
        var targetIdx = dir === "up" ? idx - 1 : idx + 1;
        if (targetIdx >= 0 && targetIdx < pageLayoutItems.length) {
          var temp = pageLayoutItems[idx];
          pageLayoutItems[idx] = pageLayoutItems[targetIdx];
          pageLayoutItems[targetIdx] = temp;
          renderPageLayoutEditor();
        }
      });
    });

    container.querySelectorAll(".btn-layout-remove").forEach(function(btn) {
      btn.addEventListener("click", function() {
        var idx = parseInt(btn.dataset.idx);
        pageLayoutItems.splice(idx, 1);
        renderPageLayoutEditor();
      });
    });

    container.querySelectorAll(".layout-html-title").forEach(function(input) {
      input.addEventListener("input", function() {
        var idx = parseInt(input.dataset.idx);
        pageLayoutItems[idx].name = input.value;
      });
    });

    container.querySelectorAll(".layout-html-content").forEach(function(textarea) {
      textarea.addEventListener("input", function() {
        var idx = parseInt(textarea.dataset.idx);
        pageLayoutItems[idx].content = textarea.value;
      });
    });
  }


  /* ── Analytics ───────────────────────────────────────── */
  function renderAnalyticsTable(tblId, rows, colKey, colCount) {
    var tbody = $("tbl-" + tblId).querySelector("tbody");
    if (!rows || rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="2" class="analytics-no-data">No data</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(function (r) {
      return '<tr><td>' + esc(r[colKey] || "—") + '</td><td>' + esc(String(r[colCount] ?? 0)) + '</td></tr>';
    }).join("");
  }

  function renderRecentTable(rows) {
    var tbody = $("tbl-recent").querySelector("tbody");
    if (!rows || rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="hint" style="text-align:center;padding:2rem">No recent events in this window</td></tr>';
      if ($("recent-pagination")) $("recent-pagination").classList.add("hidden");
      return;
    }

    var pageSize = 10;
    var totalPages = Math.ceil(rows.length / pageSize);
    var startIdx = recentEventsPage * pageSize;
    var pagedRows = rows.slice(startIdx, startIdx + pageSize);

    tbody.innerHTML = pagedRows.map(function (r) {
      var rawTs = r.timestamp || r.ts || null;
      var ts = formatLocalTime(rawTs);
      var evType = r.event_type || "click";
      var mod = r.modifier && r.modifier !== "direct" ? ' <small style="opacity:0.6">(' + esc(r.modifier) + ")</small>" : "";

      var badgeClass = evType === "click" ? "badge-neutral" : "badge-success";

      return '<tr>' +
        '<td>' + esc(ts) + '</td>' +
        '<td>' + esc(r.alias    || "—") + '</td>' +
        '<td><span class="mono">' + esc(r.slug     || "—") + '</span></td>' +
        '<td>' + esc(r.campaign || "—") + '</td>' +
        '<td><span class="badge ' + badgeClass + '" style="font-size:0.6rem">' + esc(evType) + '</span>' + mod + '</td>' +
      '</tr>';
    }).join("");

    // Render pagination (Prompt 56)
    var pagWrap = $("recent-pagination");
    if (!pagWrap) {
      pagWrap = document.createElement("div");
      pagWrap.id = "recent-pagination";
      pagWrap.className = "pagination";
      var sectionF = $("analytics-content-f");
      if (sectionF) sectionF.appendChild(pagWrap);
    }

    if (totalPages <= 1) {
      pagWrap.classList.add("hidden");
    } else {
      pagWrap.classList.remove("hidden");
      pagWrap.innerHTML =
        '<button type="button" class="btn-ghost btn-xs" id="btn-recent-prev" ' + (recentEventsPage === 0 ? 'disabled' : '') + '>Previous</button>' +
        '<span class="hint" style="font-size:0.75rem">Page ' + (recentEventsPage + 1) + ' of ' + totalPages + '</span>' +
        '<button type="button" class="btn-ghost btn-xs" id="btn-recent-next" ' + (recentEventsPage >= totalPages - 1 ? 'disabled' : '') + '>Next</button>';

      $("btn-recent-prev").onclick = function() { recentEventsPage--; renderRecentTable(rows); };
      $("btn-recent-next").onclick = function() { recentEventsPage++; renderRecentTable(rows); };
    }
  }

  async function loadAnalytics() {
    elAnalyticsStatus.textContent = "Loading analytics…";
    elAnalyticsStatus.className   = "hint";
    show(elAnalyticsStatus);
    hide($("stat-conv-rate-wrap"));
    hide($("analytics-content-b"));
    hide($("analytics-content-c"));
    hide($("dash-experiments-wrap"));
    hide($("analytics-content-e"));
    hide($("analytics-content-f"));

    try {
      // Reset pagination on new load
      recentEventsPage = 0;

      var url = "/api/admin/analytics?window=" + analyticsWindow;
      if (analyticsStartDate) url += "&start=" + analyticsStartDate;
      if (analyticsEndDate)   url += "&end=" + analyticsEndDate;

      var res  = await apiFetch(url);
      var data = await res.json();

      if (!data.ok) {
        var hint = data.hint || data.error || "Unknown error";
        elAnalyticsStatus.textContent = data.error === "not_configured"
          ? "Analytics not configured. Set CF_ACCOUNT_ID and CF_AE_API_TOKEN in Pages dashboard."
          : "Failed to load analytics: " + hint;
        elAnalyticsStatus.className = "hint";
        return;
      }

      // Diagnostic: log partial backend failures for production debugging
      if (data.errors && Array.isArray(data.errors)) {
        console.warn("[Analytics API] Partial query failures detected:", data.errors);
      }

      // Cache all raw rows
      rawAnalyticsCampaigns = data.campaigns || [];
      rawAnalyticsAliases   = data.aliases   || [];
      rawAnalyticsRecent    = data.recent    || [];
      rawAnalyticsSummary   = data.summary   || null;
      rawAnalyticsSources   = data.summary?.sources || [];

      renderAllPaginatedTables();
      renderDashboardSummary();

      var elFr = $("analytics-freshness-text");
      if (data.is_mock && elFr) {
        show(elFr);
        elFr.innerHTML = '<span class="badge badge-warning" style="font-size:0.65rem">MOCK DATA (Local)</span>';
      }

      if (data.generated_at) {
        var elGen = $("analytics-generated");
        if (elGen) elGen.textContent = formatLocalTime(data.generated_at);
      }

      hide(elAnalyticsStatus);
      show($("stat-conv-rate-wrap"));
      show($("analytics-content-b"));
      show($("analytics-content-c"));
      show($("dash-experiments-wrap"));
      show($("analytics-content-e"));
      show($("analytics-content-f"));
    } catch (err) {
      console.error("[Dashboard] Load failure:", err);
      if (err.message !== "401") {
        elAnalyticsStatus.textContent = "Failed to load analytics: " + err.message;
        elAnalyticsStatus.className = "hint";
      }
    }
  }

  /**
   * PART 3 — Test-prefix guard: a value is a test value when it startsWith("test-").
   * More precise than indexOf — avoids false positives like "new-beta-testing".
   */
  function isTestValue(val) {
    return typeof val === "string" && val.indexOf("test-") === 0;
  }

  /** Re-render "Clicks by Campaign" with test filter. */
  function renderAnalyticsByCampaign() {
    var rows = rawAnalyticsCampaigns.filter(function (r) {
      var isTest = isTestValue(r.campaign);
      // PART 8 — workspace filter: only show campaigns in selected workspace
      if (!isAnalyticsCampaignInWs(r.campaign)) return false;
      return showTestAnalytics ? isTest : !isTest;
    });
    renderAnalyticsTable("by-campaign", rows, "campaign", "clicks");
  }

  /** Re-render "Clicks by Alias" with test filter. */
  function renderAnalyticsByAlias() {
    var rows = rawAnalyticsAliases.filter(function (r) {
      var isTest = isTestValue(r.alias);
      return showTestAnalytics ? isTest : !isTest;
    });
    renderAnalyticsTable("by-alias", rows, "alias", "clicks");
  }

  /**
   * Re-render "Clicks by Slug" with test filter.
   * Filter applies to slug field (startsWith "test-").
   */
  function renderAnalyticsBySlug() {
    var rows = rawAnalyticsSlugs.filter(function (r) {
      var isTest = isTestValue(r.slug);
      return showTestAnalytics ? isTest : !isTest;
    });
    renderAnalyticsTable("by-slug", rows, "slug", "clicks");
  }

  /**
   * Re-render "Recent Events" with test + workspace filter.
   * A recent event is "test" if campaign OR alias OR slug startsWith "test-".
   * PART 8 — workspace filter applies to campaign field (recent events have campaign).
   */
  function renderAnalyticsRecentFiltered() {
    var rows = rawAnalyticsRecent.filter(function (r) {
      // PART 8 — workspace filter
      if (!isAnalyticsCampaignInWs(r.campaign)) return false;
      var isTest = isTestValue(r.campaign) || isTestValue(r.alias) || isTestValue(r.slug);
      return showTestAnalytics ? isTest : !isTest;
    });
    renderRecentTable(rows);
  }

  /** Re-render all analytics components. */
  function renderAllAnalyticsTables() {
    renderAnalyticsByCampaign();
    renderAnalyticsByAlias();
    renderAnalyticsRecentFiltered();
  }

  function renderDashboardSummary() {
    if (!rawAnalyticsSummary) return;
    var s = rawAnalyticsSummary;

    if ($("stat-clicks"))      $("stat-clicks").textContent      = s.total_clicks.toLocaleString();
    if ($("stat-conversions")) $("stat-conversions").textContent = s.conversions.toLocaleString();

    var cr = s.total_clicks > 0 ? (s.conversions / s.total_clicks * 100).toFixed(1) + "%" : "0%";
    if ($("stat-conv-rate"))   $("stat-conv-rate").textContent   = cr;

    // Active Experiments
    var exps = s.active_experiments || [];
    var list = $("dash-exp-grid");
    var wrap = $("dash-experiments-wrap");
    if (!list || !wrap) return;

    if (exps.length === 0) {
      wrap.classList.add("hidden");
    } else {
      wrap.classList.remove("hidden");

      // Threshold: If <= 9, show all. If > 9, show 8 + toggle card (fills 3x3 grid).
      var visibleExps = showAllExperiments ? exps : (exps.length <= 9 ? exps : exps.slice(0, 8));
      var hasMore = exps.length > 9;

      var html = visibleExps.map(function (e, idx) {
        return '<div class="dash-card experiment-card" style="margin-bottom:0.75rem">' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
            '<div>' +
              '<p style="font-weight:700;font-size:0.8rem;margin:0">/' + esc(e.alias) + '</p>' +
              '<span class="badge ' + (e.state === 'RUNNING' ? 'badge-success' : 'badge-neutral') + '" style="font-size:0.6rem;display:inline-flex;align-items:center;gap:3px">' +
                 (e.state === 'DECIDED' ? '<span class="material-symbols-outlined" style="font-size:11px">lock</span> LOCKED' : (e.state === 'RUNNING' ? 'OPTIMIZING' : esc(e.state))) +
              '</span>' +
            '</div>' +
            '<div style="text-align:right">' +
              '<p class="dash-card-label" style="margin:0;display:flex;align-items:center;justify-content:flex-end;gap:2px"><span class="material-symbols-outlined" style="font-size:14px;color:var(--warn)">workspace_premium</span> Leader</p>' +
              '<p style="font-size:0.75rem;font-weight:600;margin:0;color:var(--success)">/' + esc(e.leader || "—") + '</p>' +
            '</div>' +
          '</div>' +
          '<div class="dash-grid" style="grid-template-columns:1fr 1fr 1fr;gap:0.5rem;margin-top:0.75rem;margin-bottom:0">' +
            '<div><p class="dash-card-label" style="margin-bottom:0">Traffic</p><p style="font-size:0.9rem;font-weight:700;margin:0">' + e.clicks.toLocaleString() + '</p></div>' +
            '<div><p class="dash-card-label" style="margin-bottom:0">Conversions</p><p style="font-size:0.9rem;font-weight:700;margin:0">' + e.conversions.toLocaleString() + '</p></div>' +
            '<div><p class="dash-card-label" style="margin-bottom:0">Conv. Rate</p><p style="font-size:0.9rem;font-weight:700;margin:0">' + (e.conversion_rate * 100).toFixed(1) + '%</p></div>' +
          '</div>' +
        '</div>';
      }).join("");

      if (hasMore || showAllExperiments) {
        var toggleLabel = showAllExperiments ? "Show Less" : "Show All (" + exps.length + ")";
        html += '<div class="dash-card experiment-card toggle-card" id="btn-toggle-experiments" style="display:flex;align-items:center;justify-content:center;cursor:pointer;background:var(--bg-highlight);border-style:dashed">' +
          '<div style="text-align:center">' +
            '<p style="font-weight:700;font-size:1.1rem;margin:0;color:var(--primary)">' + toggleLabel + '</p>' +
          '</div>' +
        '</div>';
      }

      list.innerHTML = html;

      var btnToggle = $("btn-toggle-experiments");
      if (btnToggle) {
        btnToggle.onclick = function() {
          showAllExperiments = !showAllExperiments;
          renderDashboardSummary();
        };
      }
    }

    // Render Chart
    renderDashboardChart(s.chart);
  }

  /** Render all analytics tables with current pagination. */
  function renderAllPaginatedTables() {
    renderPaginatedTable("tbl-by-campaign", "pag-campaigns", rawAnalyticsCampaigns, pageCampaigns, function(p) { pageCampaigns = p; renderAllPaginatedTables(); }, function(r) {
      return '<td>' + esc(r.campaign) + '</td><td>' + Number(r.clicks).toLocaleString() + '</td>';
    });
    renderPaginatedTable("tbl-by-alias", "pag-aliases", rawAnalyticsAliases, pageAliases, function(p) { pageAliases = p; renderAllPaginatedTables(); }, function(r) {
      return '<td>' + esc(r.alias) + '</td><td>' + Number(r.clicks).toLocaleString() + '</td>';
    });
    renderPaginatedTable("tbl-recent", "pag-events", rawAnalyticsRecent, pageEvents, function(p) { pageEvents = p; renderAllPaginatedTables(); }, function(r) {
      var ts = formatLocalTime(r.timestamp);
      var type = r.modifier ? '<span class="badge badge-neutral" style="font-size:0.6rem">' + esc(r.modifier) + '</span>' : "";
      return '<td>' + ts + '</td><td>' + esc(r.alias || "—") + '</td><td>' + esc(r.slug || "—") + '</td><td>' + esc(r.campaign || "—") + '</td><td>' + type + '</td>';
    });
  }

  /** Generic paginated table helper. */
  function renderPaginatedTable(tableId, pagId, data, currentPage, onPageChange, rowMapper) {
    var tbl = $(tableId);
    var pag = $(pagId);
    if (!tbl || !pag) return;

    var pageSize = 10;
    var totalPages = Math.ceil(data.length / pageSize) || 1;
    if (currentPage > totalPages) currentPage = totalPages;

    var start = (currentPage - 1) * pageSize;
    var end = start + pageSize;
    var slice = data.slice(start, end);

    var tbody = tbl.querySelector("tbody");
    if (tbody) {
      var html = "";
      if (slice.length === 0) {
        html = '<tr><td colspan="10" class="hint" style="text-align:center">No data in this window</td></tr>';
      } else {
        slice.forEach(function(r) {
          html += '<tr>' + rowMapper(r) + '</tr>';
        });
      }
      tbody.innerHTML = html;
    }

    pag.innerHTML =
      '<button type="button" class="mini-btn prev" ' + (currentPage <= 1 ? "disabled" : "") + '>&lsaquo;</button>' +
      '<span>' + currentPage + ' / ' + totalPages + '</span>' +
      '<button type="button" class="mini-btn next" ' + (currentPage >= totalPages ? "disabled" : "") + '>&rsaquo;</button>';

    pag.querySelector(".prev").onclick = function() { if (currentPage > 1) onPageChange(currentPage - 1); };
    pag.querySelector(".next").onclick = function() { if (currentPage < totalPages) onPageChange(currentPage + 1); };
  }

  function renderDashboardChart(series) {
    if (!series || typeof Chart === "undefined") {
      if (typeof Chart === "undefined") {
        var script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
        script.onload = function() { renderDashboardChart(series); };
        document.head.appendChild(script);
      }
      return;
    }

    var ctx = $("dash-chart").getContext("2d");
    if (dashChart) dashChart.destroy();

    dashChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: series.map(function(d) {
          var s = String(d.t);
          if (s.includes(" ")) {
            var parts = s.split(" ");
            // If it's midnight exactly, show the date. Otherwise show the time.
            return parts[1] === "00:00:00" ? parts[0] : parts[1].slice(0, 5);
          }
          return s;
        }),
        datasets: [
          {
            label: "Clicks",
            data: series.map(function(d) { return d.clicks; }),
            borderColor: "#3b82f6",
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            fill: true,
            tension: 0.3,
            pointRadius: 2,
            borderWidth: 2
          },
          {
            label: "Conversions",
            data: series.map(function(d) { return d.conversions; }),
            borderColor: "#10b981",
            borderDash: [5, 5],
            fill: false,
            tension: 0.3,
            pointRadius: 2,
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { mode: "index", intersect: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 } } },
          y: { beginAtZero: true, grid: { color: "rgba(0,0,0,0.05)" }, ticks: { font: { size: 10 } } }
        }
      }
    });

    renderSourceChart();
  }

  function renderSourceChart() {
    var s = rawAnalyticsSources;
    var ctxEl = $("dash-source-chart");
    if (!s || s.length === 0 || !ctxEl || typeof Chart === "undefined") return;

    if (dashSourceChart) dashSourceChart.destroy();
    dashSourceChart = new Chart(ctxEl.getContext("2d"), {
      type: "bar",
      data: {
        labels: s.map(function(d) { return d.source; }),
        datasets: [
          {
            label: "Clicks",
            data: s.map(function(d) { return d.clicks; }),
            backgroundColor: "#3b82f6",
            borderRadius: 4
          },
          {
            label: "Conversions",
            data: s.map(function(d) { return d.conversions; }),
            backgroundColor: "#10b981",
            borderRadius: 4
          }
        ]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, grid: { display: false }, ticks: { font: { size: 10 } } },
          y: { grid: { display: false }, ticks: { font: { size: 10 } } }
        }
      }
    });
  }

  if (elBtnRefreshAnalytics) {
    elBtnRefreshAnalytics.addEventListener("click", function () {
      analyticsTabLoaded = true;
      loadAnalytics();
    });
  }

  if (elShowTestAnalytics) {
    elShowTestAnalytics.addEventListener("change", function () {
      showTestAnalytics = elShowTestAnalytics.checked;
      renderAllAnalyticsTables();
    });
  }

  // Time window filters
  var elTimeSelect = $("analytics-time-select");
  if (elTimeSelect) {
    elTimeSelect.addEventListener("change", function(e) {
      var win = e.target.value;
      if (!win) return;
      analyticsWindow = win;
      localStorage.setItem("analyticsWindow", win);

      analyticsStartDate = "";
      analyticsEndDate   = "";
      localStorage.removeItem("analyticsStartDate");
      localStorage.removeItem("analyticsEndDate");
      if ($("analytics-start-date")) $("analytics-start-date").value = "";
      if ($("analytics-end-date")) $("analytics-end-date").value = "";

      // Update desktop buttons too
      document.querySelectorAll("#analytics-time-filters .filter-btn").forEach(function (b) {
        b.classList.toggle("active", b.getAttribute("data-window") === win);
      });
      loadAnalytics();
    });
  }

  var elTimeFilters = $("analytics-time-filters");
  if (elTimeFilters) {
    elTimeFilters.addEventListener("click", function (e) {
      var btn = e.target.closest(".filter-btn");
      if (!btn) return;

      var win = btn.getAttribute("data-window");
      if (!win) return;

      analyticsWindow = win;
      localStorage.setItem("analyticsWindow", win);

      // Clear custom date range when quick-filter is clicked
      analyticsStartDate = "";
      analyticsEndDate   = "";
      localStorage.removeItem("analyticsStartDate");
      localStorage.removeItem("analyticsEndDate");
      localStorage.removeItem("analyticsEndDateSavedAs");
      if (elStartDate) elStartDate.value = "";
      if (elEndDate)   elEndDate.value = "";

      // Update UI active state
      elTimeFilters.querySelectorAll(".filter-btn").forEach(function (b) {
        b.classList.toggle("active", b === btn);
      });

      loadAnalytics();
    });
  }

  // Date filters
  var elStartDate = $("analytics-start-date");
  var elEndDate   = $("analytics-end-date");
  if (elStartDate && elEndDate) {
    var onDateChange = function () {
      analyticsStartDate = elStartDate.value;
      analyticsEndDate   = elEndDate.value;
      var today = new Date().toISOString().split("T")[0];

      localStorage.setItem("analyticsStartDate", analyticsStartDate);
      localStorage.setItem("analyticsEndDate",   analyticsEndDate);
      if (analyticsEndDate) {
        localStorage.setItem("analyticsEndDateSavedAs", analyticsEndDate >= today ? today : analyticsEndDate);
      }

      // Deactivate quick-filter buttons when custom date is used
      if (elTimeFilters) {
        elTimeFilters.querySelectorAll(".filter-btn").forEach(function(b) { b.classList.remove("active"); });
      }

      loadAnalytics();
    };
    elStartDate.addEventListener("change", onDateChange);
    elEndDate.addEventListener("change", onDateChange);
  }

  /* ── Workspace selector (PART 8) ─────────────────────── */
  if (elWsSelect) {
    elWsSelect.addEventListener("change", function () {
      selectedWorkspace = elWsSelect.value;
      // Re-filter everything that respects workspace
      renderCampaignList();
      populateCampaignSelect();
      if (analyticsTabLoaded) renderAllAnalyticsTables();
      if (slugsTabLoaded) {
        var q   = elSearch  ? elSearch.value.trim().toLowerCase()  : "";
        var src = elFilterSource ? elFilterSource.value : "";
        var med = elFilterMedium ? elFilterMedium.value : "";
        renderList(q, src, med);
      }
    });
  }

  /* ── Diagnostics ─────────────────────────────────────── */

  function diagLabel(value) {
    if (value === "pass")    return '<span style="font-weight:600;color:var(--c-success,#1a7f37)">✓ PASS</span>';
    if (value === "delayed") return '<span style="font-weight:600;color:var(--c-warning,#c17b00)">⚠ DELAYED</span>';
    return '<span style="font-weight:600;color:var(--c-error,#b91c1c)">✖ FAIL</span>';
  }

  /* ── System Test (unified) ──────────────────────────── */
  async function runSystemTest() {
    if (elBtnRunSystem) elBtnRunSystem.disabled = true;

    hide(elSystemResult);
    elSystemStatus.textContent = "Running system test… (may take up to ~2 minutes for AE ingestion)";
    elSystemStatus.className   = "hint";
    show(elSystemStatus);

    try {
      var res  = await apiFetch("/api/admin/system-test", { method: "POST" });
      var data = await res.json();

      var r = data.results || {};
      var checks = [
        ["Router",            r.router],
        ["Modifier routing",  r.modifier],
        ["KV registry",       r.kv],
        ["Telemetry ingest",  r.telemetry],
        ["Analytics ingest",  r.analytics],
        ["Consistency probe", r.consistency],
        ["Manual validation", r.manual_validation],
        ["Hub integrity",     r.hub_integrity],
      ];

      elSystemRows.innerHTML = checks.map(function (c) {
        return "<tr><td>" + esc(c[0]) + "</td><td>" + diagLabel(c[1]) + "</td></tr>";
      }).join("");

      elSystemMeta.textContent =
        (data.ok ? "All checks passed" : "One or more checks failed") +
        (data.duration_ms ? " · " + data.duration_ms + "ms" : "");

      if (data.warnings && data.warnings.length > 0) {
        elSystemWarnList.innerHTML = data.warnings.map(function (w) {
          return "<li>" + esc(w) + "</li>";
        }).join("");
        show(elSystemWarns);
      } else {
        hide(elSystemWarns);
      }

      // PART 2 — Display fixture metadata (slug comes directly from backend, not reconstructed)
      if (data.fixture && elSystemFixture) {
        var fx = data.fixture;
        if (elSfiCampaign) elSfiCampaign.textContent = fx.campaign || "—";
        if (elSfiAlias)    elSfiAlias.textContent    = fx.alias    || "—";
        if (elSfiSlug)     elSfiSlug.textContent     = fx.slug     || "—";
        show(elSystemFixture);
      } else if (elSystemFixture) {
        hide(elSystemFixture);
      }

      hide(elSystemStatus);
      show(elSystemResult);
    } catch (err) {
      elSystemStatus.textContent = "System test error: " + (err.message || "network error");
    }

    if (elBtnRunSystem) elBtnRunSystem.disabled = false;
  }

  if (elBtnRunSystem) {
    elBtnRunSystem.addEventListener("click", runSystemTest);
  }

  async function runDiagnostics() {
    if (elBtnRunSmoke) elBtnRunSmoke.disabled = true;

    hide(elDiagResult);
    elDiagStatus.textContent = "Running smoke test…";
    elDiagStatus.className   = "hint";
    show(elDiagStatus);

    try {
      var res  = await apiFetch("/api/admin/smoke-test", { method: "POST" });
      var data = await res.json();

      // Build result rows — 6 checks (kv + consistency added in 14.md)
      var checks = [
        ["Router",            data.router],
        ["Modifier routing",  data.modifier],
        ["KV registry",       data.kv],
        ["Telemetry ingest",  data.telemetry],
        ["Analytics ingest",  data.analytics],
        ["Consistency probe", data.consistency],
      ];
      elDiagRows.innerHTML = checks.map(function (c) {
        return "<tr><td>" + esc(c[0]) + "</td><td>" + diagLabel(c[1]) + "</td></tr>";
      }).join("");

      // Meta line
      elDiagMeta.textContent =
        (data.ok ? "All checks passed" : "One or more checks failed") +
        (data.duration_ms ? " · " + data.duration_ms + "ms" : "");

      // Warnings
      if (data.warnings && data.warnings.length > 0) {
        elDiagWarnList.innerHTML = data.warnings.map(function (w) {
          return "<li>" + esc(w) + "</li>";
        }).join("");
        show(elDiagWarnings);
      } else {
        hide(elDiagWarnings);
      }

      hide(elDiagStatus);
      show(elDiagResult);
    } catch (err) {
      elDiagStatus.textContent = "Smoke test failed: " + (err.message || "network error");
      elDiagStatus.className   = "hint";
    }

    if (elBtnRunSmoke) elBtnRunSmoke.disabled = false;
  }

  if (elBtnRunSmoke) {
    elBtnRunSmoke.addEventListener("click", runDiagnostics);
  }

  /* ── State Decoder Logic ── */
  var elStateInput = $("verify-state-input");
  var elStateResult = $("verify-state-result");
  if (elStateInput && elStateResult) {
    elStateInput.addEventListener("input", function() {
      var val = elStateInput.value.trim();
      if (!val) { elStateResult.classList.add("hidden"); return; }
      try {
        var str = val;
        // Recursive decode
        while (str.indexOf('%') !== -1) {
          try {
             var decoded = decodeURIComponent(str);
             if (decoded === str) break;
             str = decoded;
          } catch(err) { break; }
        }
        // Strip cookie prefix if pasted as 'cos_state={...}'
        if (str.indexOf('{') !== -1) {
          str = str.substring(str.indexOf('{'));
        }

        var obj = JSON.parse(str);
        elStateResult.classList.remove("hidden");
        var html = '<ul style="padding-left:1.2rem; margin:0; list-style-type:square; display:flex; flex-direction:column; gap:0.4rem;">';
        if (obj.uid !== undefined) html += '<li><strong style="color:var(--text);display:inline-block;width:200px;">User tracking ID (uid):</strong> <span style="font-family:monospace">' + esc(obj.uid) + '</span></li>';
        if (obj.v !== undefined)   html += '<li><strong style="color:var(--text);display:inline-block;width:200px;">Version (v):</strong> ' + obj.v + '</li>';
        if (obj.c !== undefined)   html += '<li><strong style="color:var(--text);display:inline-block;width:200px;">Converted (c):</strong> <span style="font-weight:bold; color:' + (obj.c===1?'var(--success)':'var(--text)') + '">' + obj.c + (obj.c===1?' (Priority Auto-Routing)':'') + '</span></li>';
        if (obj.h !== undefined)   html += '<li><strong style="color:var(--text);display:inline-block;width:200px;">Hot Intent (h):</strong> <span style="font-weight:bold; color:' + (obj.h===1?'var(--danger)':'var(--text)') + '">' + obj.h + (obj.h===1?' (Eligible for checkout routing)':'') + '</span></li>';
        if (obj.e !== undefined)   html += '<li><strong style="color:var(--text);display:inline-block;width:200px;">Engagement Point (e):</strong> ' + obj.e + '/100</li>';
        if (obj.t !== undefined && Array.isArray(obj.t)) {
          var tagsHtml = obj.t.length > 0
            ? obj.t.map(function(t){ return '<span class="badge badge-success" style="margin-right:4px;">' + esc(t) + '</span>'; }).join('')
            : '<span class="hint-inline" style="font-style:italic;">None</span>';
          html += '<li><strong style="color:var(--text);display:inline-block;width:200px;">Active Tags (t):</strong> ' + tagsHtml + '</li>';
        }
        if (obj.u !== undefined)   html += '<li><strong style="color:var(--text);display:inline-block;width:200px;">Upsell Phase (u):</strong> ' + obj.u + '</li>';
        if (obj.ts !== undefined) {
          var date = new Date(parseInt(String(obj.ts).length === 10 ? obj.ts * 1000 : obj.ts));
          html += '<li><strong style="color:var(--text);display:inline-block;width:200px;">Last Interaction (ts):</strong> <span style="font-family:monospace">' + obj.ts + '</span> <span class="hint-inline" style="margin-left:4px;">(' + date.toLocaleString() + ')</span></li>';
        }
        html += '</ul>';
        elStateResult.innerHTML = html;
      } catch (e) {
        elStateResult.classList.remove("hidden");
        elStateResult.innerHTML = '<span style="color:var(--danger);">Invalid JSON format or corrupted encoding. Be sure you are pasting a valid component.</span>';
      }
    });
  }

  /* ── Manual Validation ───────────────────────────────── */
  async function runManualValidation() {
    if (elBtnRunManual) elBtnRunManual.disabled = true;

    hide(elManualResult);
    elManualStatus.textContent = "Running manual validation… (may take ~30s for AE ingestion)";
    elManualStatus.className   = "hint";
    show(elManualStatus);

    try {
      var res  = await apiFetch("/api/admin/manual-test", { method: "POST" });
      var data = await res.json();

      if (data.error && !data.checks) {
        elManualStatus.textContent = "Manual test failed: " + (data.hint || data.error);
        if (elBtnRunManual) elBtnRunManual.disabled = false;
        return;
      }

      var exp = data.expected || {};
      var obs = data.observed || {};

      var rows = [
        { label: "Alias delta (nb)",  exp: exp.alias, obs: obs.alias, pass: data.checks && data.checks.alias_delta_correct },
        { label: "Modifier offer (+1)", exp: exp.offer,  obs: obs.offer,  pass: data.checks && data.checks.modifier_counts_correct },
        { label: "Modifier vsl (+1)",   exp: exp.vsl,   obs: obs.vsl,   pass: data.checks && data.checks.modifier_counts_correct },
      ];

      elManualRows.innerHTML = rows.map(function (r) {
        return "<tr>" +
          "<td>" + esc(r.label) + "</td>" +
          "<td>" + esc(String(r.exp ?? "—")) + "</td>" +
          "<td>" + esc(String(r.obs ?? "—")) + "</td>" +
          "<td>" + diagLabel(r.pass ? "pass" : "fail") + "</td>" +
          "</tr>";
      }).join("");

      elManualMeta.textContent =
        (data.ok ? "All checks passed" : "One or more checks failed") +
        (data.duration_ms ? " · " + data.duration_ms + "ms" : "");

      if (data.warnings && data.warnings.length > 0) {
        elManualWarnList.innerHTML = data.warnings.map(function (w) {
          return "<li>" + esc(w) + "</li>";
        }).join("");
        show(elManualWarns);
      } else {
        hide(elManualWarns);
      }

      hide(elManualStatus);
      show(elManualResult);
    } catch (err) {
      elManualStatus.textContent = "Manual test error: " + (err.message || "network error");
    }

    if (elBtnRunManual) elBtnRunManual.disabled = false;
  }

  if (elBtnRunManual) {
    elBtnRunManual.addEventListener("click", runManualValidation);
  }

  /* ── Hub Link Integrity ──────────────────────────────── */
  async function runLinkCheck() {
    var alias = (elLinkAlias && elLinkAlias.value.trim()) || "nb";
    if (elBtnLinkCheck) elBtnLinkCheck.disabled = true;

    hide(elLinkList);
    elLinkStatus.textContent = "Checking links for /" + alias + "…";
    elLinkStatus.className   = "hint";
    show(elLinkStatus);

    try {
      var res  = await apiFetch(
        "/api/admin/manual-test?action=link-check&alias=" + encodeURIComponent(alias)
      );
      var data = await res.json();
      var links = data.links || [];

      if (links.length === 0) {
        elLinkStatus.textContent = "No external links found on /" + alias;
      } else {
        elLinkList.innerHTML = links.map(function (l) {
          var state = l.state || (l.ok ? "valid" : "broken");
          var icon  = state === "valid" ? "✔" : state === "suspicious" ? "⚠" : "✖";
          var color = state === "valid"
            ? "var(--c-success,#1a7f37)"
            : state === "suspicious"
              ? "var(--c-warning,#c17b00)"
              : "var(--c-error,#b91c1c)";
          var label = state === "valid" ? "VALID" : state === "suspicious" ? "SUSPICIOUS" : "BROKEN";
          return "<li style='color:" + color + ";margin-bottom:.2rem'>" +
            icon + " <span style='font-weight:700'>" + label + "</span>" +
            "  <span style='color:var(--c-text-muted,#666);font-size:.8rem'>HTTP " + esc(String(l.status || 0)) + "</span>" +
            "  <span style='color:var(--c-text)'>" + esc(l.url) + "</span>" +
            "</li>";
        }).join("");
        show(elLinkList);
        hide(elLinkStatus);
      }
    } catch (err) {
      elLinkStatus.textContent = "Link check error: " + (err.message || "network error");
    }

    if (elBtnLinkCheck) elBtnLinkCheck.disabled = false;
  }

  if (elBtnLinkCheck) {
    elBtnLinkCheck.addEventListener("click", runLinkCheck);
  }

  /* ── Background Self-Test ──────────────────────────────── */
  async function loadBgTestLast() {
    try {
      var res  = await apiFetch("/api/admin/background-test");
      var data = await res.json();
      if (data.last) {
        var last   = data.last;
        var ts     = last.timestamp ? new Date(last.timestamp).toUTCString().replace("GMT", "UTC") : "unknown";
        var status = last.ok ? "✔ Passed" : "✖ Failed";
        elBgTestLastTxt.textContent = "Last automatic system test: " + ts + " · " + status;
        show(elBgTestLast);
      }
    } catch (_) { /* non-critical — diagnostics tab may load without last result */ }
  }

  async function runBgTest() {
    if (elBtnRunBgTest) elBtnRunBgTest.disabled = true;

    elBgTestStatus.textContent = "Running background test… (allow up to ~2 minutes for AE ingestion)";
    elBgTestStatus.className   = "hint";
    show(elBgTestStatus);

    try {
      var res  = await apiFetch("/api/admin/background-test", { method: "POST" });
      var data = await res.json();

      if (data.error) {
        elBgTestStatus.textContent = "Background test error: " + (data.hint || data.error);
      } else {
        var icon = data.ok ? "✔" : "✖";
        var ts   = data.timestamp ? new Date(data.timestamp).toUTCString().replace("GMT", "UTC") : "";
        var stageLine = (!data.ok && data.stage)
          ? " · stage: " + data.stage + (data.reason ? " (" + data.reason + ")" : "")
          : "";
        elBgTestStatus.textContent = icon + " Background test " + (data.ok ? "passed" : "failed") +
          (data.duration_ms ? " · " + data.duration_ms + "ms" : "") +
          stageLine +
          (ts ? " · " + ts : "");

        // Update last-run line
        if (ts) {
          elBgTestLastTxt.textContent = "Last automatic system test: " + ts + " · " + (data.ok ? "✔ Passed" : "✖ Failed");
          show(elBgTestLast);
        }
      }
    } catch (err) {
      elBgTestStatus.textContent = "Background test error: " + (err.message || "network error");
    }

    if (elBtnRunBgTest) elBtnRunBgTest.disabled = false;
  }

  if (elBtnRunBgTest) {
    elBtnRunBgTest.addEventListener("click", runBgTest);
  }

  /* ── Stopwatch (PART 7) ──────────────────────────────── */
  var swInterval = null;
  var swStartTime = 0;
  var swElapsed   = 0;
  var swRunning   = false;

  function swTick() {
    var ms = swElapsed + (Date.now() - swStartTime);
    var totalSecs = ms / 1000;
    var m = Math.floor(totalSecs / 60);
    var s = totalSecs % 60;
    var txt = (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s.toFixed(1);
    if (elSwDisplay) elSwDisplay.textContent = txt;
  }

  // CogniLink Pulse (Timer) Logic (Prompt 69)
  var elSwWrap = $("sw-display-wrap");
  var elSwIcon = $("sw-icon");

  function updateSwUi() {
    if (!elSwWrap || !elSwIcon) return;
    if (swRunning) {
      elSwWrap.classList.add("running");
      elSwIcon.textContent = "⏸︎";
    } else {
      elSwWrap.classList.remove("running");
      elSwIcon.textContent = "⏵︎";
    }
  }

  function toggleSw() {
    if (swRunning) {
      clearInterval(swInterval);
      swInterval = null;
      swElapsed += Date.now() - swStartTime;
      swRunning = false;
    } else {
      clearInterval(swInterval);
      swInterval = null;
      swStartTime = Date.now();
      swRunning = true;
      swInterval = setInterval(swTick, 100);
    }
    updateSwUi();
  }

  if (elSwWrap) {
    elSwWrap.addEventListener("click", toggleSw);
  }

  if (elBtnSwReset) {
    elBtnSwReset.addEventListener("click", function () {
      if (swRunning) {
        // Reset while running: keep interval going, but reset startTime
        swStartTime = Date.now();
        swElapsed   = 0;
        // swTick will naturally catch up and show 00:00.0 on next run
      } else {
        // Reset while stopped: simple clear to 0
        swElapsed   = 0;
        if (elSwDisplay) elSwDisplay.textContent = "00:00.0";
      }
      updateSwUi();
    });
  }

  /* ── Load campaigns (for slug form selector) ─────────── */
  async function loadCampaigns() {
    try {
      var res  = await apiFetch("/api/campaigns");
      var data = await res.json();
      campaigns = data.campaigns || [];
      buildWorkspaceList();      // PART 8 — populate workspace dropdown
      populateCampaignSelect();
    } catch (err) {
      if (err.message !== "401") console.warn("[panel] campaigns load failed");
    }
  }

  function populateCampaignSelect() {
    /* Only show active, non-test campaigns in the slug form selector.
       Respect workspace filter when a workspace is selected. */
    var active = campaigns.filter(function (c) {
      return c.isActive !== false &&
             !(c.name && c.name.startsWith("test-")) &&
             isCampaignInWorkspace(c);
    });
    if (active.length === 0) {
      elCampaignSelect.innerHTML =
        '<option value="" disabled selected>Select campaign</option>' +
        '<option value="__new__">+ Create new campaign</option>';
      return;
    }
    var byRecency = active.slice().sort(function (a, b) {
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    });
    // Restore last-used campaign from localStorage (Issue 27-1)
    var stored = "";
    try { stored = localStorage.getItem("_sp_last_campaign") || ""; } catch (_e) {}
    var validStored = stored && active.some(function (c) { return c.name === stored; });
    var defaultCampaign = validStored ? stored : byRecency[0].name;
    elCampaignSelect.innerHTML =
      active.map(function (c) {
        return '<option value="' + esc(c.name) + '">' + esc(c.name) + '</option>';
      }).join("") +
      '<option value="__new__">+ Create new campaign</option>';
    elCampaignSelect.value = defaultCampaign;
    suggestSlug();
  }

  /* ── Workspace helpers (PART 7+8) ───────────────────── */

  /** True when campaign c belongs to the currently selected workspace. */
  function isCampaignInWorkspace(c) {
    if (!selectedWorkspace) return true;   // "All" — no filter
    return (c.workspace || "default") === selectedWorkspace;
  }

  /** Lookup the workspace for a given campaign name from the campaigns array. */
  function getCampaignWorkspace(name) {
    for (var i = 0; i < campaigns.length; i++) {
      if (campaigns[i].name === name) return campaigns[i].workspace || "default";
    }
    return "default";
  }

  /** True when a campaign name belongs to the selected workspace (for analytics rows). */
  function isAnalyticsCampaignInWs(name) {
    if (!selectedWorkspace) return true;
    return getCampaignWorkspace(name) === selectedWorkspace;
  }

  /**
   * Build the workspace list from the loaded campaigns array and populate
   * the ws-select dropdown. Called after every loadCampaigns() response.
   */
  function buildWorkspaceList() {
    var seen = {};
    campaigns.forEach(function (c) {
      var ws = c.workspace || "default";
      seen[ws] = true;
    });
    workspaceList = Object.keys(seen).sort();
    if (workspaceList.indexOf("default") === -1) workspaceList.unshift("default");

    // Populate dropdown
    elWsSelect.innerHTML =
      '<option value="">All</option>' +
      workspaceList.map(function (ws) {
        return '<option value="' + esc(ws) + '"' + (ws === selectedWorkspace ? ' selected' : '') + '>' + esc(ws) + '</option>';
      }).join("");

    // Show the selector only when multiple workspaces exist (or always — user's choice)
    // Always show so the operator can see workspace context.
    if (elWsSelector) elWsSelector.style.display = "flex";
  }

  /* ── Campaign select interactions ────────────────────── */
  function onCampaignInteract() {
    if (!campaignInteracted) {
      campaignInteracted = true;
      elCampaignSelect.classList.remove("field-error", "shake");
      hide(elCampConfirmMsg);
    }
  }

  var elCampaignLabel = elForm.querySelector('label[for="f-campaign"]');
  if (elCampaignLabel) elCampaignLabel.addEventListener("click", onCampaignInteract);
  elCampaignSelect.addEventListener("click", onCampaignInteract);

  elCampaignSelect.addEventListener("change", function () {
    onCampaignInteract();
    if (elCampaignSelect.value === "__new__") {
      show(elNewCampWrap);
      elNewCampInput.focus();
      hideErr(elCampError);
    } else {
      hide(elNewCampWrap);
      hideErr(elCampError);
      // Persist selection so the form restores it on next page load (Issue 27-1)
      try { localStorage.setItem("_sp_last_campaign", elCampaignSelect.value); } catch (_e) {}
      suggestSlug();
    }
  });

  /* ── Create new campaign (from slug form) ──────────────── */
  elBtnCreateCamp.addEventListener("click", async function () {
    hideErr(elCampError);
    var name = elNewCampInput.value.trim().toLowerCase();
    if (!name) { showErr(elCampError, "Campaign name is required."); return; }
    if (name.length > 1 && !/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(name)) {
      showErr(elCampError, "Lowercase letters, numbers, hyphens (no leading/trailing hyphen).");
      return;
    }
    var campAlias = elNewCampAlias.value.trim().toLowerCase() || undefined;
    elBtnCreateCamp.disabled = true;
    elBtnCreateCamp.textContent = "Creating…";
    try {
      var createBody = { name: name };
      if (campAlias) createBody.alias = campAlias;
      // PART 8 — inherit selected workspace when creating inline
      if (selectedWorkspace) createBody.workspace = selectedWorkspace;
      var res  = await apiFetch("/api/campaign", {
        method: "POST", body: JSON.stringify(createBody)
      });
      var data = await res.json();
      if (!res.ok) { showErr(elCampError, data.error || "Failed."); return; }
      /* Show compile note if alias was saved */
      if (data.note) { showErr(elCampError, "✓ Campaign created. " + data.note); elCampError.className = "field-hint"; show(elCampError); }
      if (data.warning) { showErr(elCampError, "⚠ " + data.warning); }

      var newCamp = data.campaign || { name: name, alias: campAlias || null, isActive: true, createdAt: new Date().toISOString() };
      campaigns.push(newCamp);
      campaigns.sort(function (a, b) { return a.name.localeCompare(b.name); });
      elNewCampInput.value = "";

      populateCampaignSelect();
      hide(elNewCampWrap);
      elNewCampAlias.value = "";
      hide(elNewCampAliasStatus);
      elNewCampAliasStatus.textContent = "";
      campaignInteracted = true;
      elCampaignSelect.classList.remove("field-error", "shake");
      hide(elCampConfirmMsg);

      if (!slugTouched) {
        setTimeout(function () { elSlugInput.focus(); }, 50);
      }
      /* Refresh campaigns tab if it was already loaded.
         Also refresh slugCache so any slugs associated with this new
         campaign are visible in the defaultSlug selector (SECTION 1). */
      if (campaignsTabLoaded) {
        await loadSlugs();
        renderCampaignList();
      }
    } catch (err) {
      if (err.message !== "401") showErr(elCampError, "Request failed.");
    } finally {
      elBtnCreateCamp.disabled = false;
      elBtnCreateCamp.textContent = "Create";
    }
  });

  /* ── Slug suggestion ─────────────────────────────────── */
  function suggestSlug() {
    if (slugTouched || elEditMode.value === "edit") return;
    var campaign = elCampaignSelect.value;
    if (!campaign || campaign === "__new__") return;
    var suffix    = PRESET_SUFFIX[elPreset.value] || "";
    var raw       = suffix ? campaign + "-" + suffix : campaign;
    var suggested = raw.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    elSlugInput.value = suggested;
    var preset = PRESETS[elPreset.value] || {};
    var src    = (elPreset.value === "custom" && $("f-utm-source")) ? $("f-utm-source").value || preset.utm_source : preset.utm_source;
    var med    = (elPreset.value === "custom" && $("f-utm-medium")) ? $("f-utm-medium").value || preset.utm_medium : preset.utm_medium;
    if (campaign && (src || med)) {
      elSlugHint.textContent = "utm_campaign=" + campaign + (src ? " · source=" + src : "") + (med ? " · medium=" + med : "");
      show(elSlugHint);
    } else {
      hide(elSlugHint);
    }
  }

  /* Slug input: track custom value only; suggestSlug() not called here */
  elSlugInput.addEventListener("input", function () {
    if (elSlugInput.value === "") {
      slugTouched = false;
    } else {
      slugTouched = true;
      hide(elSlugHint);
    }
  });

  elPreset.addEventListener("change", function () {
    if (elPreset.value === "custom") show(elCustomUtm);
    else hide(elCustomUtm);
    suggestSlug();
  });

  /* ── Filters ─────────────────────────────────────────── */
  var searchTimer;
  function onFilterChange() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      renderList(elSearch.value.trim().toLowerCase(), elFilterSource.value, elFilterMedium.value);
    }, 200);
  }
  elSearch.addEventListener("input", onFilterChange);
  elFilterSource.addEventListener("change", onFilterChange);
  elFilterMedium.addEventListener("change", onFilterChange);
  elShowArchivedCampSlugs.addEventListener("change", function () {
    showArchivedCampaignSlugs = elShowArchivedCampSlugs.checked;
    onFilterChange();
  });
  if (elShowTestCampSlugs) {
    elShowTestCampSlugs.addEventListener("change", function () {
      showTestCampaignSlugs = elShowTestCampSlugs.checked;
      onFilterChange();
    });
  }
  elBtnResetFilters.addEventListener("click", function () {
    elSearch.value = ""; elFilterSource.value = ""; elFilterMedium.value = "";
    showArchivedCampaignSlugs = false;
    showTestCampaignSlugs     = false;
    elShowArchivedCampSlugs.checked = false;
    if (elShowTestCampSlugs) elShowTestCampSlugs.checked = false;
    renderList("", "", "");
  });

  function populateFilters() {
    var sources = new Set();
    var mediums = new Set();
    slugCache.forEach(function (s) {
      if (s.defaults) {
        if (s.defaults.utm_source) sources.add(s.defaults.utm_source);
        if (s.defaults.utm_medium) mediums.add(s.defaults.utm_medium);
      }
    });
    var curSrc = elFilterSource.value;
    var curMed = elFilterMedium.value;
    elFilterSource.innerHTML = '<option value="">All sources</option>' +
      Array.from(sources).sort().map(function (v) {
        return '<option value="' + esc(v) + '">' + esc(v) + '</option>';
      }).join("");
    elFilterMedium.innerHTML = '<option value="">All mediums</option>' +
      Array.from(mediums).sort().map(function (v) {
        return '<option value="' + esc(v) + '">' + esc(v) + '</option>';
      }).join("");
    if (curSrc && sources.has(curSrc)) elFilterSource.value = curSrc;
    if (curMed && mediums.has(curMed)) elFilterMedium.value = curMed;
  }

  /* ── Load slugs ──────────────────────────────────────── */
  async function loadSlugs() {
    try {
      var res  = await apiFetch("/api/slugs?limit=100");
      var data = await res.json();
      slugCache = data.slugs || [];
      populateFilters();
      renderList(elSearch.value.trim().toLowerCase(), elFilterSource.value, elFilterMedium.value);
    } catch (err) {
      if (err.message !== "401") {
        elSlugList.innerHTML = '<p class="empty-state error-text">Failed to load.</p>';
      }
    }
  }

  function renderList(query, srcFilter, medFilter) {
    // Build set of archived campaign names for slug filtering
    var archivedCampaignNames = new Set();
    if (!showArchivedCampaignSlugs && !showTestCampaignSlugs) {
      campaigns.forEach(function (c) {
        if (c.isActive === false) archivedCampaignNames.add(c.name);
      });
    }

    // Build set of test campaign names (campaign name starts with "test-")
    var testCampaignNames = new Set(
      campaigns
        .filter(function (c) { return c.name && c.name.startsWith("test-"); })
        .map(function (c) { return c.name; })
    );

    // PART 8 — Build set of campaign names in the selected workspace
    var wsCampaignNames = null;  // null = no filter (All workspaces)
    if (selectedWorkspace) {
      wsCampaignNames = new Set(
        campaigns
          .filter(function (c) { return isCampaignInWorkspace(c); })
          .map(function (c) { return c.name; })
      );
    }

    var items = slugCache.filter(function (s) {
      // PART 8 — workspace filter for slug list
      if (wsCampaignNames !== null && !wsCampaignNames.has(s.campaign)) return false;
      // PART 6: also match when slug itself starts with "test-" (campaign record may be absent)
      var isTest = testCampaignNames.has(s.campaign) ||
                   (s.campaign && s.campaign.startsWith("test-")) ||
                   (s.slug     && s.slug.startsWith("test-"));
      // Test filter: when enabled show ONLY test slugs; when disabled hide test slugs
      if (showTestCampaignSlugs) {
        if (!isTest) return false;
      } else {
        if (isTest) return false;
        if (archivedCampaignNames.has(s.campaign)) return false;
      }
      if (query && (!s.slug || s.slug.indexOf(query) === -1)) return false;
      if (srcFilter && (s.defaults || {}).utm_source !== srcFilter) return false;
      if (medFilter && (s.defaults || {}).utm_medium !== medFilter) return false;
      return true;
    });

    if (!items.length) {
      elSlugList.innerHTML = '<p class="empty-state">' +
        (query || srcFilter || medFilter ? "No matches." : "No campaign links yet.") + "</p>";
      return;
    }

    elSlugList.innerHTML = items.map(function (item) {
      var src      = (item.defaults && item.defaults.utm_source) || "—";
      var med      = (item.defaults && item.defaults.utm_medium) || "—";
      var campaign = item.campaign || "—";
      var isActive = item.isActive !== false;
      var inGrace  = isWithinGraceWindow(item.createdAt);
      var delAttrs = inGrace
        ? 'class="btn-danger btn-xs btn-del" data-slug="' + esc(item.slug) + '"'
        : 'class="btn-danger btn-xs btn-del" data-slug="' + esc(item.slug) + '" disabled title="Grace window expired"';
      var aliasBtn = item.alias
        ? '<a class="btn-ghost btn-xs slug-alias-link" href="/' + esc(item.alias) + '" ' +
            'target="_blank" rel="noopener noreferrer">' + esc(item.alias) + '</a>'
        : '';
      return (
        '<div class="slug-item' + (isActive ? "" : " slug-inactive") + '">' +
          '<div class="slug-info">' +
            '<a class="slug-name" href="/c/' + esc(item.slug) + '" ' +
               'target="_blank" rel="noopener noreferrer">/c/' + esc(item.slug) + '</a>' +
            '<span class="slug-meta">' + esc(campaign) + ' · ' + esc(src) + ' · ' + esc(med) +
              (!isActive ? ' · <span class="badge-inactive">disabled</span>' : '') +
            '</span>' +
          '</div>' +
          '<div class="slug-actions">' +
            aliasBtn +
            '<button class="btn-ghost btn-xs btn-edit" data-slug="' + esc(item.slug) + '">Edit</button>' +
            '<button class="btn-ghost btn-xs btn-toggle-slug" data-slug="' + esc(item.slug) + '" data-active="' + (isActive ? "1" : "0") + '">' +
              (isActive ? "Disable" : "Enable") +
            '</button>' +
            '<button ' + delAttrs + '>Delete</button>' +
          '</div>' +
        '</div>'
      );
    }).join("");

    elSlugList.querySelectorAll(".btn-edit").forEach(function (btn) {
      btn.addEventListener("click", function () { editSlug(btn.dataset.slug); });
    });
    elSlugList.querySelectorAll(".btn-toggle-slug").forEach(function (btn) {
      btn.addEventListener("click", function () {
        toggleSlugActive(btn.dataset.slug, btn.dataset.active === "0");
      });
    });
    elSlugList.querySelectorAll(".btn-del:not([disabled])").forEach(function (btn) {
      btn.addEventListener("click", function () { deleteSlug(btn.dataset.slug); });
    });
  }

  /* ── Toggle slug isActive ────────────────────────────── */
  async function toggleSlugActive(slug, newActive) {
    try {
      var res = await apiFetch("/api/slug/" + encodeURIComponent(slug), {
        method: "PATCH", body: JSON.stringify({ isActive: newActive })
      });
      if (!res.ok) { alert("Failed to update slug status."); return; }
      await loadSlugs();
    } catch (err) {
      if (err.message !== "401") alert("Request failed.");
    }
  }

  /* ── Links editor ────────────────────────────────────── */
  elBtnAddLink.addEventListener("click", function () { addLinkRow({}); });

  function makeLinkId(label) {
    return (label || "link").toLowerCase()
      .replace(/\s+/g, "_").replace(/[^a-z0-9_-]/g, "")
      .replace(/_{2,}/g, "_").replace(/^_|_$/g, "").slice(0, 50) || "link";
  }

  function addLinkRow(link) {
    var row = document.createElement("div");
    row.className = "link-row";
    row.innerHTML =
      '<div class="link-row-fields">' +
        '<input type="text" class="link-label" placeholder="Button label" value="' + esc(link.label || "") + '" />' +
        '<input type="url"  class="link-href"  placeholder="https://…"   value="' + esc(link.href  || "") + '" />' +
      '</div>' +
      '<div class="link-row-opts">' +
        '<input type="number" class="link-order" placeholder="order" value="' + (link.order !== undefined ? link.order : "") + '" style="width:5rem" />' +
        '<label class="checkbox-label"><input type="checkbox" class="link-noUtm"' + (link.noUtm ? " checked" : "") + ' /> No UTM</label>' +
        '<label class="checkbox-label"><input type="checkbox" class="link-active"' + (link.isActive === false ? "" : " checked") + ' /> Active</label>' +
        '<button type="button" class="btn-danger btn-xs link-remove" title="Remove">×</button>' +
      '</div>';
    row.querySelector(".link-remove").addEventListener("click", function () {
      elLinksEditor.removeChild(row);
    });
    elLinksEditor.appendChild(row);
  }

  function collectLinks() {
    var rows = elLinksEditor.querySelectorAll(".link-row");
    var links = [];
    rows.forEach(function (row, idx) {
      var label  = row.querySelector(".link-label").value.trim();
      var href   = normalizeUrl(row.querySelector(".link-href").value);
      var noUtm    = row.querySelector(".link-noUtm").checked;
      var active   = row.querySelector(".link-active").checked;
      var orderInp = row.querySelector(".link-order");
      var orderNum = orderInp && orderInp.value.trim() !== "" ? parseInt(orderInp.value, 10) : NaN;
      if (isNaN(orderNum)) orderNum = 100 + (idx * 10);
      if (!label || !href) return;
      var id = makeLinkId(label);
      links.push({ id: id, label: label, href: href, utmContent: id, noUtm: noUtm, order: orderNum, isActive: active });
    });
    return links;
  }

  function clearLinksEditor() {
    elLinksEditor.innerHTML = "";
  }

  /* ── Save form ───────────────────────────────────────── */
  elForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    hideErr(elFormError);
    hide(elGenWrap);

    var mode     = elEditMode.value;
    var slug     = elSlugInput.value.trim().toLowerCase();
    var campaign = elCampaignSelect.value;

    if (!slug) { showErr(elFormError, "Slug is required."); return; }
    if (slug.length > 1 && !/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) {
      showErr(elFormError, "Slug: lowercase letters, numbers, hyphens (no leading/trailing hyphen)."); return;
    }
    if (!campaign || campaign === "__new__") {
      showErr(elFormError, "Select a campaign first."); return;
    }

    var preset      = elPreset.value;
    var utmDefaults = Object.assign({}, PRESETS[preset] || {});
    if (preset === "custom") {
      var src = $("f-utm-source").value.trim();
      var med = $("f-utm-medium").value.trim();
      if (src) utmDefaults.utm_source = src;
      if (med) utmDefaults.utm_medium = med;
    }
    delete utmDefaults.utm_campaign;

    var langVal = $("f-lang").value.trim() || "en";
    var marketVal = $("f-market").value.trim() || "global";
    var cosWinVal = $("f-cos-win").value.trim() || "7";
    if (langVal) utmDefaults.lang = langVal;
    if (marketVal) utmDefaults.market = marketVal;
    if (cosWinVal) utmDefaults.cos_win = cosWinVal;

    var overrides = {};
    ["official","programs","release","newsletter"].forEach(function (key) {
      var urlEl    = $("f-dest-" + key + "-url");
      var orderEl  = $("f-dest-" + key + "-order");
      var activeEl = $("f-dest-" + key + "-active");
      var noUtmEl  = $("f-dest-" + key + "-noutm");
      if (!urlEl) return;
      var entry = {};
      var urlVal = normalizeUrl(urlEl.value);
      if (urlVal) entry.url = urlVal;
      var orderRaw = orderEl && orderEl.value.trim() !== "" ? parseInt(orderEl.value, 10) : NaN;
      if (!isNaN(orderRaw)) entry.order = orderRaw;
      if (activeEl && !activeEl.checked) entry.isActive = false;
      if (noUtmEl  && noUtmEl.checked)   entry.noUtm    = true;
      if (Object.keys(entry).length > 0) overrides[key] = entry;
    });

    var links = collectLinks();

    var customHeaderHtml = $("f-custom-header-html").value.trim() || null;
    var customFooterHtml = $("f-custom-footer-html").value.trim() || null;
    var customStyleCss   = $("f-custom-css").value.trim()         || null;

    var aliasVal = elSlugAlias.value.trim().toLowerCase() || null;

    var payload = {
      slug:      slug,
      campaign:  campaign,
      context:   "campaign",
      defaults:  utmDefaults,
      overrides: overrides,
      links:     links,
      alias:     aliasVal,
      customHeaderHtml: customHeaderHtml,
      customFooterHtml: customFooterHtml,
      customStyleCss:   customStyleCss,
    };

    elBtnSave.disabled    = true;
    elBtnSave.textContent = "Saving…";

    try {
      var res;
      if (mode === "create") {
        res = await apiFetch("/api/slug", { method: "POST", body: JSON.stringify(payload) });
      } else {
        res = await apiFetch("/api/slug/" + encodeURIComponent(slug), {
          method: "PUT", body: JSON.stringify(payload)
        });
      }
      var data = await res.json();
      if (!res.ok) { showErr(elFormError, data.error || "Save failed."); return; }

      elGenUrl.textContent = "/c/" + slug;
      show(elGenWrap);
      /* Show alias note or warning */
      if (data.warning) {
        showErr(elFormError, "⚠ " + data.warning);
        elFormError.className = "error";
        show(elFormError);
      } else if (data.note) {
        elFormError.textContent = "ℹ " + data.note;
        elFormError.className = "field-hint";
        show(elFormError);
      }
      await loadSlugs();
      if (mode === "create") resetForm();
    } catch (err) {
      if (err.message !== "401") showErr(elFormError, "Request failed. Check connection.");
    } finally {
      elBtnSave.disabled    = false;
      elBtnSave.textContent = mode === "create" ? "Save" : "Update";
    }
  });

  /* ── Edit slug ───────────────────────────────────────── */
  async function editSlug(slug) {
    try {
      var res  = await apiFetch("/api/slug/" + encodeURIComponent(slug));
      var data = await res.json();
      if (!res.ok || !data.slug) { alert("Could not load slug."); return; }

      /* Switch to slugs tab first */
      document.querySelector('.tab-btn[data-tab="slugs"]').click();

      elEditMode.value        = "edit";
      elFormTitle.textContent = "Edit: /c/" + data.slug;
      elSlugInput.value       = data.slug;
      elSlugInput.readOnly    = true;
      slugTouched             = true;
      campaignInteracted      = true;
      hide(elSlugHint);

      var grace = isWithinGraceWindow(data.createdAt);

      if (data.campaign) {
        /* Ensure option exists (in case it's an archived campaign) */
        if (!campaigns.some(function (c) { return c.name === data.campaign; })) {
          campaigns.push({ name: data.campaign, isActive: true });
          campaigns.sort(function (a, b) { return a.name.localeCompare(b.name); });
          populateCampaignSelect();
        }
        /* Add archived campaign to select if missing */
        var opt = elCampaignSelect.querySelector('option[value="' + data.campaign + '"]');
        if (!opt) {
          var newOpt = document.createElement("option");
          newOpt.value = data.campaign;
          newOpt.textContent = data.campaign + " (archived)";
          elCampaignSelect.insertBefore(newOpt, elCampaignSelect.firstChild);
        }
        elCampaignSelect.value    = data.campaign;
        elCampaignSelect.disabled = true;
        hide(elNewCampWrap);
      }

      var src = (data.defaults || {}).utm_source || "";
      var med = (data.defaults || {}).utm_medium || "";
      var det = "custom";
      Object.keys(PRESETS).forEach(function (k) {
        var p = PRESETS[k];
        if (p.utm_source === src && p.utm_medium === med) det = k;
      });
      elPreset.value    = det;
      elPreset.disabled = !grace;
      if (det === "custom") {
        show(elCustomUtm);
        $("f-utm-source").value    = src;
        $("f-utm-source").disabled = !grace;
        $("f-utm-medium").value    = med;
        $("f-utm-medium").disabled = !grace;
      } else {
        hide(elCustomUtm);
        $("f-utm-source").disabled = !grace;
        $("f-utm-medium").disabled = !grace;
      }

      var langVal = (data.defaults || {}).lang || "en";
      var marketVal = (data.defaults || {}).market || "global";
      var cosWinVal = (data.defaults || {}).cos_win || "7";
      $("f-lang").value = langVal;
      $("f-lang").disabled = !grace;
      $("f-market").value = marketVal;
      $("f-market").disabled = !grace;

      if ($("f-cos-win")) {
        $("f-cos-win").value = cosWinVal;
        $("f-cos-win").disabled = !grace;
      }

      var ovr = data.overrides || {};
      ["official","programs","release","newsletter"].forEach(function (k) {
        var urlEl    = $("f-dest-" + k + "-url");
        var orderEl  = $("f-dest-" + k + "-order");
        var activeEl = $("f-dest-" + k + "-active");
        var noUtmEl  = $("f-dest-" + k + "-noutm");
        if (!urlEl) return;
        var v = ovr[k];
        // Backward-compat: old format stored plain string, new format is object
        var ovrObj = !v ? {} : (typeof v === "string" ? { url: v } : v);
        urlEl.value = ovrObj.url || "";
        if (orderEl)  orderEl.value    = ovrObj.order !== undefined ? ovrObj.order : "";
        if (activeEl) activeEl.checked = ovrObj.isActive !== false;
        if (noUtmEl)  noUtmEl.checked  = !!ovrObj.noUtm;
      });

      /* Populate links editor */
      clearLinksEditor();
      var existingLinks = Array.isArray(data.links) ? data.links : [];
      existingLinks
        .slice()
        .sort(function (a, b) { return (a.order || 0) - (b.order || 0); })
        .forEach(function (l) { addLinkRow(l); });
      if (existingLinks.length > 0) {
        $("links-details").open = true;
      }

      /* Populate per-slug landing customization */
      $("f-custom-header-html").value = data.customHeaderHtml || "";
      $("f-custom-footer-html").value = data.customFooterHtml || "";
      $("f-custom-css").value         = data.customStyleCss   || "";
      if ($("f-engine-map-id")) {
        populateEngineMapSelect();
        $("f-engine-map-id").value = data.engineMapId || "";
      }

      /* Populate alias field */
      var loadedAlias = data.alias || "";
      elSlugAlias.value = loadedAlias;
      elSlugAlias.dataset.originalAlias = loadedAlias;
      if (loadedAlias) {
        elAliasStatus.textContent = "Current alias";
        elAliasStatus.className = "field-hint";
        show(elAliasStatus);
      } else {
        hide(elAliasStatus);
        elAliasStatus.textContent = "";
      }

      elGenUrl.textContent      = "/c/" + data.slug;
      show(elGenWrap);
      elBtnCancel.style.display = "";
      elBtnSave.textContent     = "Update";
      hideErr(elFormError);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      if (err.message !== "401") alert("Error loading slug.");
    }
  }

  elBtnCancel.addEventListener("click", resetForm);

  function resetForm() {
    elEditMode.value          = "create";
    elFormTitle.textContent   = "New Campaign Link";
    elForm.reset();
    elSlugInput.readOnly      = false;
    slugTouched               = false;
    campaignInteracted        = false;
    elBtnCancel.style.display = "none";
    elBtnSave.textContent     = "Save";
    elCampaignSelect.disabled  = false;
    elPreset.disabled          = false;
    $("f-utm-source").disabled = false;
    $("f-utm-medium").disabled = false;
    $("f-lang").disabled       = false;
    $("f-market").disabled     = false;
    if ($("f-cos-win")) $("f-cos-win").disabled = false;
    // reset defaults for lang/market/cos_win so they re-populate properly on clear
    $("f-lang").value          = "en";
    $("f-market").value        = "global";
    if ($("f-cos-win")) $("f-cos-win").value = "7";
    hide(elCustomUtm);
    hide(elGenWrap);
    hide(elNewCampWrap);
    hide(elSlugHint);
    hideErr(elFormError);
    hideErr(elCampError);
    hide(elCampConfirmMsg);
    elCampaignSelect.classList.remove("field-error", "shake");
    clearLinksEditor();
    /* Clear alias field */
    elSlugAlias.value = "";
    elSlugAlias.dataset.originalAlias = "";
    hide(elAliasStatus);
    elAliasStatus.textContent = "";
    /* Clear per-slug landing customization */
    $("f-custom-header-html").value = "";
    $("f-custom-footer-html").value = "";
    $("f-custom-css").value         = "";
    if ($("f-engine-map-id")) {
      populateEngineMapSelect();
      $("f-engine-map-id").value = "";
    }
    populateCampaignSelect();
  }

  function populateEngineMapSelect() {
    var sel = $("f-engine-map-id");
    if (!sel) return;
    sel.innerHTML = '<option value="">[Global Default Engine]</option>';
    var maps = engineStore.customMaps || {};
    Object.keys(maps).forEach(function(key) {
      var opt = document.createElement("option");
      opt.value = key;
      opt.textContent = maps[key].name || key;
      sel.appendChild(opt);
    });
  }

  /* ── Delete slug ─────────────────────────────────────── */
  async function deleteSlug(slug) {
    var record = slugCache.find(function (s) { return s.slug === slug; }) || {};
    if (!isWithinGraceWindow(record.createdAt)) {
      alert("This slug can no longer be deleted. Use the Disable button to hide it.");
      return;
    }
    if (!confirm("Have you used this link anywhere or allowed it to be tracked? This action cannot be undone.")) return;
    try {
      var res = await apiFetch("/api/slug/" + encodeURIComponent(slug), { method: "DELETE" });
      if (!res.ok) { alert("Delete failed."); return; }
      await loadSlugs();
      if (elSlugInput.value === slug) resetForm();
    } catch (err) {
      if (err.message !== "401") alert("Delete failed.");
    }
  }

  /* ── Campaigns tab ───────────────────────────────────── */
  elShowArchived.addEventListener("change", function () {
    showArchivedCampaigns = elShowArchived.checked;
    renderCampaignList();
  });
  if (elShowTestCampaigns) {
    elShowTestCampaigns.addEventListener("change", function () {
      showTestCampaigns = elShowTestCampaigns.checked;
      renderCampaignList();
    });
  }

  async function loadCampaignList() {
    try {
      // Prime slugCache for defaultSlug selector before rendering campaign list.
      // Without this, users who open the Campaigns tab before Campaign Links tab
      // see an empty selector (slugCache = []).
      if (slugCache.length === 0) await loadSlugs();
      var res  = await apiFetch("/api/campaigns");
      var data = await res.json();
      campaigns = data.campaigns || [];
      populateCampaignSelect();
      renderCampaignList();
    } catch (err) {
      if (err.message !== "401") {
        elCampaignList.innerHTML = '<p class="empty-state error-text">Failed to load.</p>';
      }
    }
  }

  function renderCampaignList() {
    var items = campaigns.filter(function (c) {
      if (!isCampaignInWorkspace(c)) return false;
      var isTest = c.name && c.name.startsWith("test-");
      if (showTestCampaigns) return isTest;
      if (isTest) return false;
      var active = c.isActive !== false;
      return showArchivedCampaigns ? !active : active;
    });

    if (!items.length) {
      var emptyMsg = showTestCampaigns ? "No test campaigns."
        : showArchivedCampaigns ? "No archived campaigns." : "No active campaigns.";
      elCampaignList.innerHTML = '<p class="empty-state">' + emptyMsg + "</p>";
      return;
    }

    elCampaignList.innerHTML = items.map(function (c) {
      var isActive   = c.isActive !== false;
      var createdFmt  = c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "—";
      var aliasText   = c.alias ? ' · alias: <code>' + esc(c.alias) + '</code>' : '';

      return (
        '<div class="campaign-item" id="camp-item-' + esc(c.name) + '" style="padding: 0.5rem 0; border-bottom: 1px solid var(--border);">' +
          '<div class="campaign-info" style="display: flex; flex-direction: column; gap: 0.15rem;">' +
            '<a class="campaign-name" href="#" data-name="' + esc(c.name) + '" style="font-weight:bold; color:var(--primary); text-decoration:none;">' + esc(c.name) + '</a>' +
            '<span class="campaign-meta" style="font-size: 0.75rem; color: var(--text-m);">' + createdFmt + aliasText +
              (!isActive ? ' · <span class="badge-inactive">archived</span>' : '') +
            '</span>' +
          '</div>' +
        '</div>'
      );
    }).join("");

    elCampaignList.querySelectorAll(".campaign-name").forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.preventDefault();
        selectCampaign(el.dataset.name);
      });
    });
  }

  async function setCampaignActive(name, isActive) {
    try {
      var res = await apiFetch("/api/campaign/" + encodeURIComponent(name), {
        method: "PATCH", body: JSON.stringify({ isActive: isActive })
      });
      if (!res.ok) { alert("Failed to update campaign."); return; }
      var idx = campaigns.findIndex(function (c) { return c.name === name; });
      if (idx !== -1) campaigns[idx].isActive = isActive;
      populateCampaignSelect();
      renderCampaignList();
    } catch (err) {
      if (err.message !== "401") alert("Request failed.");
    }
  }

  async function deleteCampaign(name) {
    var record = campaigns.find(function (c) { return c.name === name; }) || {};
    if (!isWithinGraceWindow(record.createdAt)) {
      alert("This campaign can no longer be deleted. Use Archive to hide it.");
      return;
    }
    if (!confirm('Delete campaign "' + name + '"? This cannot be undone.')) return;
    try {
      var res  = await apiFetch("/api/campaign/" + encodeURIComponent(name), { method: "DELETE" });
      var data = await res.json();
      if (!res.ok) {
        var errStr = data.error || "Delete failed.";
        alert(errStr);
        throw new Error(errStr);
      }

      // Remove cascade-deleted slugs from local cache
      var deletedSlugs = Array.isArray(data.deletedSlugs) ? data.deletedSlugs : [];
      if (deletedSlugs.length > 0) {
        var deletedSet = new Set(deletedSlugs);
        slugCache = slugCache.filter(function (s) { return !deletedSet.has(s.slug); });
        renderList(elSearch.value.trim().toLowerCase(), elFilterSource.value, elFilterMedium.value);
      }

      campaigns = campaigns.filter(function (c) { return c.name !== name; });
      populateCampaignSelect();
      renderCampaignList();
    } catch (err) {
      if (err.message !== "401") alert("Delete failed.");
    }
  }

  /* ── Config tab ──────────────────────────────────────── */
  async function loadConfig() {
    try {
      var res  = await apiFetch("/api/config");
      var data = await res.json();
      var cfg  = data.config || {};
      $("cfg-page-title").value  = cfg.pageTitle    || "";
      $("cfg-css").value         = cfg.themeCssUrl   || "";
      $("cfg-custom-css").value  = cfg.customStyleCss || "";
    } catch (err) {
      if (err.message !== "401") showErr(elConfigError, "Failed to load config.");
    }
  }

  elConfigForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    hideErr(elConfigError);
    hide(elConfigSuccess);
    elBtnSaveConfig.disabled    = true;
     elBtnSaveConfig.textContent = "Saving…";
    try {
      var payload = {
        pageTitle:      $("cfg-page-title").value.trim()   || null,
        themeCssUrl:    $("cfg-css").value.trim()          || null,
        customStyleCss: $("cfg-custom-css").value.trim()   || null,
      };
      var res  = await apiFetch("/api/config", { method: "PUT", body: JSON.stringify(payload) });
      var data = await res.json();
      if (!res.ok) { showErr(elConfigError, data.error || "Save failed."); return; }
      elConfigSuccess.textContent = "Saved.";
      show(elConfigSuccess);
      setTimeout(function () { hide(elConfigSuccess); }, 3000);
    } catch (err) {
      if (err.message !== "401") showErr(elConfigError, "Request failed.");
    } finally {
      elBtnSaveConfig.disabled    = false;
      elBtnSaveConfig.textContent = "Save Config";
    }
  });

  /* ── Components Tab Logic ───────────────────────────── */
  async function loadComponents() {
    try {
      var res  = await apiFetch("/api/admin/components");
      var data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to load components");
        return;
      }
      componentFamilies = data.families || [];
      componentVersions = data.versions || [];

      if (selectedFamilyId && !componentFamilies.some(function(f) { return f.family_id === selectedFamilyId; })) {
        selectedFamilyId = null;
        selectedVersionNumber = null;
      }

      renderComponentList();
      renderComponentEditor();

      // Initialize selected components for Page config if not editing
      if (!$("f-page-editing").value) {
        pageLayoutItems = getDefaultLayout();
      }
      populateLayoutComponentsDropdown();
      renderPageLayoutEditor();
    } catch (err) {
      if (err.message !== "401") {
        console.error("Failed to load components:", err);
      }
    }
  }

  function renderComponentList() {
    var tbody = document.getElementById("tbl-components-body");
    if (!tbody) return;

    var fActive = document.getElementById("comp-filter-active");
    var fInactive = document.getElementById("comp-filter-inactive");
    var fArchived = document.getElementById("comp-filter-archived");
    if (fActive && !fActive.dataset.bound) {
      fActive.dataset.bound = "true";
      fActive.addEventListener("change", renderComponentList);
      fInactive.addEventListener("change", renderComponentList);
      fArchived.addEventListener("change", renderComponentList);
    }

    var filterActive = fActive ? fActive.checked : true;
    var filterInactive = fInactive ? fInactive.checked : true;
    var filterArchived = fArchived ? fArchived.checked : false;

    var filteredFamilies = componentFamilies.filter(function(f) {
      if (f.status === "active") return filterActive;
      if (f.status === "inactive" || f.status === "draft") return filterInactive;
      if (f.status === "archived") return filterArchived;
      return true;
    });

    if (filteredFamilies.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No matching components found.</td></tr>';
      return;
    }

    tbody.innerHTML = "";
    filteredFamilies.forEach(function(family) {
      var familyVersions = componentVersions.filter(function(v) { return v.family_id === family.family_id; });

      var liveVerObj = familyVersions.find(function(v) { return v.is_live; });
      var liveVer = liveVerObj ? "v" + liveVerObj.version_number : '<span style="color:var(--text-m)">None</span>';

      var maxVer = 0;
      familyVersions.forEach(function(v) {
        if (v.version_number > maxVer) maxVer = v.version_number;
      });
      var latestVer = maxVer > 0 ? "v" + maxVer : "—";

      var modifiedDate = family.updated_at ? new Date(family.updated_at).toLocaleString("tr-TR") : "—";

      var statusBadge = "";
      if (family.status === "active") {
        statusBadge = '<span class="badge-active">active</span>';
      } else if (family.status === "inactive" || family.status === "draft") {
        statusBadge = '<span class="badge-draft" style="background:var(--border);color:var(--text-m);padding:2px 6px;border-radius:4px;font-size:0.75rem;">inactive</span>';
      } else {
        statusBadge = '<span class="badge-inactive">archived</span>';
      }

      var tr = document.createElement("tr");
      tr.style.cursor = "pointer";
      if (selectedFamilyId === family.family_id) {
        tr.style.background = "var(--bg)";
        tr.style.fontWeight = "600";
      }

      tr.innerHTML = '<td><div style="font-weight:600;">' + esc(family.family_name) + '</div>' +
                     '<div style="font-size:0.75rem;color:var(--text-m);font-family:monospace;">' + esc(family.family_key) + '</div></td>' +
                     '<td>' + liveVer + '</td>' +
                     '<td>' + latestVer + '</td>' +
                     '<td>' + statusBadge + '</td>' +
                     '<td style="font-size:0.8rem;white-space:nowrap;">' + modifiedDate + '</td>';

      tr.addEventListener("click", function() {
        selectedFamilyId = family.family_id;
        var liveV = familyVersions.find(function(v) { return v.is_live; });
        if (liveV) {
          selectedVersionNumber = liveV.version_number;
        } else if (familyVersions.length > 0) {
          selectedVersionNumber = Math.max.apply(null, familyVersions.map(function(v) { return v.version_number; }));
        } else {
          selectedVersionNumber = null;
        }
        renderComponentList();
        renderComponentEditor();
      });

      tbody.appendChild(tr);
    });
  }

  function renderComponentEditor() {
    var container = document.getElementById("component-editor-container");
    if (!container) return;

    // Wire up "New Family" button at the list top
    var btnNewFamily = document.getElementById("btn-new-family");
    if (btnNewFamily) {
      btnNewFamily.onclick = function() {
        selectedFamilyId = null;
        selectedVersionNumber = null;
        renderComponentList();
        renderComponentEditor();
      };
    }

    if (!selectedFamilyId) {
      container.innerHTML =
        '<p class="card-title">New Component Family</p>' +
        '<form id="comp-family-create-form" autocomplete="off">' +
          '<label for="c-family-key">Family Slug / Key <span class="req">*</span></label>' +
          '<input type="text" id="c-family-key" placeholder="e.g. footer, trust-badges" required pattern="[a-z0-9-_]+" />' +
          '<p class="hint" style="margin-top:-6px;margin-bottom:10px;font-size:0.75rem;">Lowercase letters, numbers, dashes and underscores only.</p>' +

          '<label for="c-family-name">Family Name <span class="req">*</span></label>' +
          '<input type="text" id="c-family-name" placeholder="e.g. Main Footer, Trust Signals" required />' +

          '<label for="c-family-status">Family Status</label>' +
          '<select id="c-family-status">' +
            '<option value="active">Active</option>' +
            '<option value="inactive">Inactive</option>' +
            '<option value="archived">Archived</option>' +
          '</select>' +

          '<hr style="margin:20px 0; border:0; border-top:1px solid var(--border);" />' +
          '<p class="card-title" style="font-size:13px; opacity:0.8; margin-bottom: 10px;">First Version (v1) Content</p>' +

          '<label for="c-version-title">Title (optional)</label>' +
          '<input type="text" id="c-version-title" placeholder="e.g. Sıkça Sorulan Sorular" />' +

          '<label for="c-version-body">Body / Content (HTML/Markdown/Text)</label>' +
          '<textarea id="c-version-body" rows="6" placeholder="Component content here..." style="font-family:monospace;"></textarea>' +

          '<label for="c-version-cta-label">CTA Label (optional)</label>' +
          '<input type="text" id="c-version-cta-label" placeholder="e.g. WhatsApp\\\'tan Yazın" />' +

          '<label for="c-version-cta-url">CTA URL (optional)</label>' +
          '<input type="url" id="c-version-cta-url" placeholder="e.g. https://wa.me/..." />' +

          '<label for="c-version-placement">Placement Hint <span class="hint-inline">(hero, trust, process, objection, cta, legal, footer, etc.)</span></label>' +
          '<input type="text" id="c-version-placement" placeholder="e.g. footer" />' +

          '<label for="c-version-priority">Priority / Order <span class="hint-inline">(lower priority runs first)</span></label>' +
          '<input type="number" id="c-version-priority" placeholder="0" value="0" />' +

          '<label for="c-version-notes">Notes (internal description)</label>' +
          '<textarea id="c-version-notes" rows="2" placeholder="Describe this version..."></textarea>' +

          '<p id="c-create-error" class="error hidden" style="margin-top: 10px;"></p>' +
          '<button type="submit" class="btn-primary" style="margin-top: 15px; width: 100%;">Create Component Family</button>' +
        '</form>';

      var form = document.getElementById("comp-family-create-form");
      form.addEventListener("submit", async function(e) {
        e.preventDefault();
        var errEl = document.getElementById("c-create-error");
        errEl.classList.add("hidden");

        var payload = {
          family_key: document.getElementById("c-family-key").value,
          family_name: document.getElementById("c-family-name").value,
          type: "block",
          status: document.getElementById("c-family-status").value,
          title: document.getElementById("c-version-title").value,
          body: document.getElementById("c-version-body").value,
          cta_label: document.getElementById("c-version-cta-label").value,
          cta_url: document.getElementById("c-version-cta-url").value,
          placement_hint: document.getElementById("c-version-placement").value,
          priority: parseInt(document.getElementById("c-version-priority").value) || 0,
          notes: document.getElementById("c-version-notes").value
        };

        try {
          var res = await apiFetch("/api/admin/components", {
            method: "POST",
            body: JSON.stringify(payload)
          });
          var data = await res.json();
          if (!res.ok) {
            errEl.textContent = data.error || "Failed to create component";
            errEl.classList.remove("hidden");
            return;
          }

          selectedFamilyId = data.family_id;
          selectedVersionNumber = 1;
          loadComponents();
        } catch (err) {
          errEl.textContent = "Request failed.";
          errEl.classList.remove("hidden");
        }
      });
      return;
    }

    var family = componentFamilies.find(function(f) { return f.family_id === selectedFamilyId; });
    if (!family) {
      selectedFamilyId = null;
      selectedVersionNumber = null;
      renderComponentEditor();
      return;
    }

    var familyVersions = componentVersions.filter(function(v) { return v.family_id === selectedFamilyId; });
    var version = familyVersions.find(function(v) { return v.version_number === selectedVersionNumber; });
    if (!version && familyVersions.length > 0) {
      version = familyVersions[familyVersions.length - 1];
      selectedVersionNumber = version.version_number;
    }

    var versionTabsHtml = "";
    familyVersions.forEach(function(v) {
      var isSelected = v.version_number === selectedVersionNumber;
      var isLive = v.is_live;
      var style = isSelected ? "background:var(--accent);color:var(--accent-t);font-weight:bold;" : "background:var(--bg);color:var(--text);";
      var liveBadge = isLive ? ' <span style="font-size:0.65rem;background:var(--success);color:white;padding:1px 4px;border-radius:3px;margin-left:4px;">LIVE</span>' : "";
      var statusBadge = v.status === "archived" ? ' <span style="font-size:0.65rem;opacity:0.6;">(archived)</span>' : ((v.status === "inactive" || v.status === "draft") ? ' <span style="font-size:0.65rem;opacity:0.6;">(inactive)</span>' : "");
      versionTabsHtml +=
        '<button type="button" class="btn-version-pill" data-ver="' + v.version_number + '" style="border:none;padding:6px 12px;border-radius:20px;font-size:0.8rem;cursor:pointer;display:inline-flex;align-items:center;' + style + '">' +
          'v' + v.version_number + liveBadge + statusBadge +
        '</button>';
    });

    var isVersionLive = version ? version.is_live : false;
    var isVersionArchived = version ? version.status === "archived" : false;

    container.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">' +
        '<p class="card-title" style="margin-bottom:0;">Edit Component Family</p>' +
        '<button type="button" id="btn-back-to-new" class="btn-ghost btn-sm" style="font-size:0.8rem;">+ New Family</button>' +
      '</div>' +

      '<form id="comp-family-edit-form" autocomplete="off" style="margin-bottom:20px;padding:15px;background:var(--bg);border-radius:var(--radius-sm);border:1px solid var(--border);">' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">' +
          '<div>' +
            '<label for="e-family-key" style="font-size:0.75rem;">Family Slug / Key</label>' +
            '<input type="text" id="e-family-key" value="' + esc(family.family_key) + '" required pattern="[a-z0-9-_]+" style="padding:6px;font-size:0.85rem;" />' +
          '</div>' +
          '<div>' +
            '<label for="e-family-name" style="font-size:0.75rem;">Family Name</label>' +
            '<input type="text" id="e-family-name" value="' + esc(family.family_name) + '" required style="padding:6px;font-size:0.85rem;" />' +
          '</div>' +
        '</div>' +
        '<div style="margin-top:10px;">' +
          '<label for="e-family-status" style="font-size:0.75rem;">Status</label>' +
          '<select id="e-family-status" style="padding:6px;font-size:0.85rem;width:100%;">' +
            '<option value="active" ' + (family.status === "active" ? "selected" : "") + '>Active</option>' +
            '<option value="inactive" ' + ((family.status === "inactive" || family.status === "draft") ? "selected" : "") + '>Inactive</option>' +
            '<option value="archived" ' + (family.status === "archived" ? "selected" : "") + '>Archived</option>' +
          '</select>' +
        '</div>' +
        '<p id="c-family-edit-error" class="error hidden" style="margin-top:10px;"></p>' +
        '<p id="c-family-edit-success" class="success hidden" style="margin-top:10px;"></p>' +
        '<div style="display:flex;gap:10px;margin-top:10px;">' +
          '<button type="submit" class="btn-ghost btn-sm" style="flex:1;background:var(--surface);">Update Family Details</button>' +
          '<button type="button" id="btn-delete-family" class="btn-ghost btn-sm" style="flex:1;color:var(--danger);border-color:var(--danger);background:transparent;">Delete Family</button>' +
        '</div>' +
      '</form>' +

      '<div style="margin-bottom:15px;">' +
        '<p class="card-title" style="font-size:0.85rem;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-m);">Versions</p>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
          versionTabsHtml +
        '</div>' +
      '</div>' +

      (version ?
        '<form id="comp-version-edit-form" autocomplete="off">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">' +
            '<p class="card-title" style="font-size:13px;opacity:0.8;margin-bottom:0;">Editing Version v' + version.version_number + '</p>' +
            '<span style="font-size:0.75rem;color:var(--text-m);">Created: ' + (version.created_at ? new Date(version.created_at).toLocaleString("tr-TR") : "—") + '</span>' +
          '</div>' +

          '<label for="c-ver-name">Version Name</label>' +
          '<input type="text" id="c-ver-name" value="' + esc(version.name) + '" required />' +

          '<label for="c-ver-status">Version Status</label>' +
          '<select id="c-ver-status">' +
            '<option value="active" ' + (version.status === "active" ? "selected" : "") + '>Active</option>' +
            '<option value="inactive" ' + ((version.status === "inactive" || version.status === "draft") ? "selected" : "") + '>Inactive</option>' +
            '<option value="archived" ' + (version.status === "archived" ? "selected" : "") + '>Archived</option>' +
          '</select>' +

          '<label for="c-ver-title">Title (optional)</label>' +
          '<input type="text" id="c-ver-title" value="' + esc(version.title || "") + '" />' +

          '<label for="c-ver-body">Body / Content (HTML/Markdown/Text)</label>' +
          '<textarea id="c-ver-body" rows="6" style="font-family:monospace;">' + esc(version.body || "") + '</textarea>' +

          '<label for="c-ver-cta-label">CTA Label (optional)</label>' +
          '<input type="text" id="c-ver-cta-label" value="' + esc(version.cta_label || "") + '" />' +

          '<label for="c-ver-cta-url">CTA URL (optional)</label>' +
          '<input type="text" id="c-ver-cta-url" value="' + esc(version.cta_url || "") + '" />' +

          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">' +
            '<div>' +
              '<label for="c-ver-placement" style="font-size:0.75rem;margin-bottom:4px;">Placement Hint</label>' +
              '<input type="text" id="c-ver-placement" value="' + esc(version.placement_hint || "") + '" style="padding:8px;font-size:0.85rem;" />' +
            '</div>' +
            '<div>' +
              '<label for="c-ver-priority" style="font-size:0.75rem;margin-bottom:4px;">Priority / Order</label>' +
              '<input type="number" id="c-ver-priority" value="' + (version.priority || 0) + '" style="padding:8px;font-size:0.85rem;" />' +
            '</div>' +
          '</div>' +

          '<label for="c-ver-notes">Notes (internal)</label>' +
          '<textarea id="c-ver-notes" rows="2">' + esc(version.notes || "") + '</textarea>' +

          '<p id="c-version-edit-error" class="error hidden" style="margin-top:10px;"></p>' +
          '<p id="c-version-edit-success" class="success hidden" style="margin-top:10px;"></p>' +

          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:15px;">' +
            '<button type="submit" class="btn-primary" style="grid-column: 1 / -1;">Save Version</button>' +
            '<button type="button" id="btn-duplicate-ver" class="btn-ghost btn-sm" style="background:var(--bg);flex:1;">Duplicate v' + version.version_number + ' → v' + (version.version_number + 1) + '</button>' +
            (!isVersionLive && !isVersionArchived ?
              '<button type="button" id="btn-set-live" class="btn-ghost btn-sm" style="color:var(--success);border-color:var(--success);background:transparent;flex:1;">Make Live/Default</button>' : "") +
            '<button type="button" id="btn-delete-ver" class="btn-ghost btn-sm" style="color:var(--danger);border-color:var(--danger);background:transparent;flex:1;grid-column:1/-1;">Delete Version v' + version.version_number + '</button>' +
          '</div>' +
        '</form>' : '<p class="hint">No version found.</p>');

    var btnBack = document.getElementById("btn-back-to-new");
    if (btnBack) {
      btnBack.addEventListener("click", function() {
        selectedFamilyId = null;
        selectedVersionNumber = null;
        renderComponentList();
        renderComponentEditor();
      });
    }

    container.querySelectorAll(".btn-version-pill").forEach(function(btn) {
      btn.addEventListener("click", function() {
        selectedVersionNumber = parseInt(btn.dataset.ver);
        renderComponentEditor();
      });
    });

    var familyForm = document.getElementById("comp-family-edit-form");
    if (familyForm) {
      familyForm.addEventListener("submit", async function(e) {
        e.preventDefault();
        var errEl = document.getElementById("c-family-edit-error");
        var succEl = document.getElementById("c-family-edit-success");
        errEl.classList.add("hidden");
        succEl.classList.add("hidden");

        var payload = {
          action: "update_family",
          family_id: selectedFamilyId,
          family_key: document.getElementById("e-family-key").value,
          family_name: document.getElementById("e-family-name").value,
          type: "block",
          status: document.getElementById("e-family-status").value
        };

        try {
          var res = await apiFetch("/api/admin/components", {
            method: "PUT",
            body: JSON.stringify(payload)
          });
          var data = await res.json();
          if (!res.ok) {
            errEl.textContent = data.error || "Update failed";
            errEl.classList.remove("hidden");
            return;
          }
          succEl.textContent = "Family updated.";
          succEl.classList.remove("hidden");
          setTimeout(function() { loadComponents(); }, 1000);
        } catch(err) {
          errEl.textContent = "Request failed.";
          errEl.classList.remove("hidden");
        }
      });
    }

    var versionForm = document.getElementById("comp-version-edit-form");
    if (versionForm && version) {
      versionForm.addEventListener("submit", async function(e) {
        e.preventDefault();
        var errEl = document.getElementById("c-version-edit-error");
        var succEl = document.getElementById("c-version-edit-success");
        errEl.classList.add("hidden");
        succEl.classList.add("hidden");

        var payload = {
          action: "update_version",
          family_id: selectedFamilyId,
          version_number: version.version_number,
          name: document.getElementById("c-ver-name").value,
          status: document.getElementById("c-ver-status").value,
          title: document.getElementById("c-ver-title").value,
          body: document.getElementById("c-ver-body").value,
          cta_label: document.getElementById("c-ver-cta-label").value,
          cta_url: document.getElementById("c-ver-cta-url").value,
          placement_hint: document.getElementById("c-ver-placement").value,
          priority: parseInt(document.getElementById("c-ver-priority").value) || 0,
          notes: document.getElementById("c-ver-notes").value
        };

        try {
          var res = await apiFetch("/api/admin/components", {
            method: "PUT",
            body: JSON.stringify(payload)
          });
          var data = await res.json();
          if (!res.ok) {
            errEl.textContent = data.error || "Update failed";
            errEl.classList.remove("hidden");
            return;
          }
          succEl.textContent = "Version updated.";
          succEl.classList.remove("hidden");
          setTimeout(function() { loadComponents(); }, 1000);
        } catch(err) {
          errEl.textContent = "Request failed.";
          errEl.classList.remove("hidden");
        }
      });

      var btnDuplicate = document.getElementById("btn-duplicate-ver");
      if (btnDuplicate) {
        btnDuplicate.addEventListener("click", async function() {
          var errEl = document.getElementById("c-version-edit-error");
          errEl.classList.add("hidden");

          try {
            var res = await apiFetch("/api/admin/components", {
              method: "PUT",
              body: JSON.stringify({
                action: "duplicate_version",
                family_id: selectedFamilyId,
                version_number: version.version_number
              })
            });
            var data = await res.json();
            if (!res.ok) {
              errEl.textContent = data.error || "Duplicate failed";
              errEl.classList.remove("hidden");
              return;
            }
            selectedVersionNumber = data.version_number;
            loadComponents();
          } catch(err) {
            errEl.textContent = "Request failed.";
            errEl.classList.remove("hidden");
          }
        });
      }

      var btnSetLive = document.getElementById("btn-set-live");
      if (btnSetLive) {
        btnSetLive.addEventListener("click", async function() {
          var errEl = document.getElementById("c-version-edit-error");
          errEl.classList.add("hidden");

          try {
            var res = await apiFetch("/api/admin/components", {
              method: "PUT",
              body: JSON.stringify({
                action: "set_live",
                family_id: selectedFamilyId,
                version_number: version.version_number
              })
            });
            var data = await res.json();
            if (!res.ok) {
              errEl.textContent = data.error || "Action failed";
              errEl.classList.remove("hidden");
              return;
            }
            loadComponents();
          } catch(err) {
            errEl.textContent = "Request failed.";
            errEl.classList.remove("hidden");
          }
        });
      }

      var btnDeleteFamily = document.getElementById("btn-delete-family");
      if (btnDeleteFamily) {
        btnDeleteFamily.addEventListener("click", async function() {
          var matchingPages = pagesStore.filter(function(p) {
            return Array.isArray(p.components) && p.components.indexOf(family.family_id) !== -1;
          }).map(function(p) { return p.id; });
          var matchingSlugs = slugCache.filter(function(s) {
            return Array.isArray(s.components) && s.components.indexOf(family.family_id) !== -1;
          }).map(function(s) { return s.slug; });

          var msg = "Are you sure you want to delete the component family '" + family.family_name + "'?\\nThis will hard-delete the family and all its versions.";
          var totalUsage = matchingPages.length + matchingSlugs.length;
          if (totalUsage > 0) {
            msg += "\\n\\nWARNING: This component is currently used by " + totalUsage + " layouts:\\n" +
                   (matchingPages.length ? "- Pages: " + matchingPages.join(", ") + "\\n" : "") +
                   (matchingSlugs.length ? "- Slugs: " + matchingSlugs.join(", ") : "");
          }

          if (!confirm(msg)) return;

          try {
            var res = await apiFetch("/api/admin/components?family_id=" + encodeURIComponent(family.family_id), {
              method: "DELETE"
            });
            var data = await res.json();
            if (!res.ok) {
              alert(data.error || "Delete failed");
              return;
            }
            selectedFamilyId = null;
            selectedVersionNumber = null;
            await loadPages();
            await loadSlugs();
            loadComponents();
          } catch(err) {
            alert("Request failed: " + err.message);
          }
        });
      }

      var btnDeleteVer = document.getElementById("btn-delete-ver");
      if (btnDeleteVer) {
        btnDeleteVer.addEventListener("click", async function() {
          var msg = "Are you sure you want to delete version v" + version.version_number + " of '" + family.family_name + "'?";
          if (familyVersions.length === 1) {
            msg += "\\nThis is the last version, so the entire component family will be deleted.";
          }
          if (!confirm(msg)) return;

          try {
            var res = await apiFetch("/api/admin/components?family_id=" + encodeURIComponent(family.family_id) + "&version_number=" + version.version_number, {
              method: "DELETE"
            });
            var data = await res.json();
            if (!res.ok) {
              alert(data.error || "Delete failed");
              return;
            }

            if (familyVersions.length === 1) {
              selectedFamilyId = null;
              selectedVersionNumber = null;
              await loadPages();
              await loadSlugs();
            } else {
              var remaining = familyVersions.filter(function(v) { return v.version_number !== version.version_number; });
              selectedVersionNumber = Math.max.apply(null, remaining.map(function(v) { return v.version_number; }));
            }
            loadComponents();
          } catch(err) {
            alert("Request failed: " + err.message);
          }
        });
      }
    }
  }

  /* ── Routing tab: Compile Routes ─────────────────────── */
  // silentCompile — fire-and-forget compile triggered automatically after any
  // routing mutation (A/B save, activate, rebalance, promote).  Uses a plain
  // fetch() with authHeaders() so 401 never calls showGate() mid-flow.
  function silentCompile() {
    fetch("/api/admin/compile-routes", {
      method:  "POST",
      headers: authHeaders(),
      body:    JSON.stringify({}),
    }).catch(function () {}); // result intentionally ignored
  }

  async function runCompile(dryRun) {
    hideErr(elCompileError);
    hide(elCompileResult);
    var btn = dryRun ? elBtnDryRun : elBtnCompileNow;
    btn.disabled = true;
    btn.textContent = dryRun ? "Running…" : "Compiling…";
    try {
      var res  = await apiFetch("/api/admin/compile-routes", {
        method: "POST",
        body:   JSON.stringify({ dryRun: dryRun })
      });
      var data = await res.json();
      if (!res.ok) {
        showErr(elCompileError, (data.error || "Compile failed.") +
          (data.errors && data.errors.length ? " Errors: " + data.errors.join("; ") : ""));
        return;
      }
      var stats   = data.stats || {};
      var errLen  = Array.isArray(data.errors)  ? data.errors.length  : 0;
      var skipLen = Array.isArray(data.skipped) ? data.skipped.length : 0;
      elCompileResultInner.innerHTML =
        '<table class="compile-table">' +
          '<tr><td>Result</td><td><strong>' + (data.ok ? "✓ Success" : "✗ Failed") + '</strong>' +
            (dryRun ? ' <span class="badge-inactive">dry run</span>' : '') + '</td></tr>' +
          '<tr><td>Routes compiled</td><td>' + (data.compiled || 0) + '</td></tr>' +
          '<tr><td>Routes written</td><td>' + (data.written  || 0) + '</td></tr>' +
          '<tr><td>Campaign aliases</td><td>' + (stats.campaign_aliases || 0) + '</td></tr>' +
          '<tr><td>Slug aliases</td><td>'     + (stats.slug_aliases     || 0) + '</td></tr>' +
          '<tr><td>Errors</td><td>' + errLen  + (errLen  ? ': ' + esc(data.errors.join(', '))  : '') + '</td></tr>' +
          '<tr><td>Skipped</td><td>' + skipLen + (skipLen ? ': ' + esc(data.skipped.join(', ')) : '') + '</td></tr>' +
          '<tr><td>Duration</td><td>' + (stats.duration_ms || '—') + ' ms</td></tr>' +
        '</table>' +
        (!dryRun && data.ok ? '<p class="compile-active-note">✓ Routing is now active.</p>' : '') +
        (dryRun ? '<p class="field-hint">This was a dry run — ROUTE_ALIAS was not changed.</p>' : '');
      show(elCompileResult);
      // After a real compile, refresh slugCache and re-render campaign list so
      // the defaultSlug selector reflects the current slug inventory (SECTION 3).
      if (!dryRun && data.ok && campaignsTabLoaded) {
        await loadSlugs();
        renderCampaignList();
      }
    } catch (err) {
      if (err.message !== "401") showErr(elCompileError, "Request failed. Check connection.");
    } finally {
      btn.disabled = false;
      btn.textContent = dryRun ? "Dry Run" : "Compile Now";
    }
  }

  if (elBtnDryRun)     elBtnDryRun.addEventListener("click",     function () { runCompile(true);  });
  if (elBtnCompileNow) elBtnCompileNow.addEventListener("click",  function () { runCompile(false); });

  /* ── Routing tab: Router Status ─────────────────────── */
  async function loadRouterStatus() {
    if (!elRouterStatusBody) return;
    elRouterStatusBody.innerHTML = '<p class="hint" style="margin:0">Loading...</p>';
    try {
      var res  = await apiFetch("/api/admin/compile-routes");
      var data = await res.json();
      if (!res.ok) {
        elRouterStatusBody.innerHTML = '<p class="hint" style="margin:0;color:var(--c-error,#b91c1c)">Failed to load status.</p>';
        return;
      }
      var active    = data.active ? '<span style="color:#1a7f37;font-weight:600">YES</span>' : '<span style="color:#b91c1c;font-weight:600">NO</span>';
      var lastCmp   = data.lastCompile ? new Date(data.lastCompile).toLocaleTimeString() : '—';
      var aliases   = data.aliases >= 0 ? data.aliases : '—';
      var routes    = data.routes  >= 0 ? data.routes  : '—';
      elRouterStatusBody.innerHTML =
        '<table class="compile-table" style="max-width:360px">' +
          '<tr><td>Registry aliases</td><td>' + aliases + '</td></tr>' +
          '<tr><td>Compiled routes</td><td>'  + routes  + '</td></tr>' +
          '<tr><td>Router active</td><td>'    + active  + '</td></tr>' +
          '<tr><td>Last compile</td><td>'     + esc(lastCmp) + '</td></tr>' +
        '</table>';
    } catch (err) {
      if (err.message !== "401") {
        elRouterStatusBody.innerHTML = '<p class="hint" style="margin:0;color:var(--c-error,#b91c1c)">Request failed.</p>';
      }
    }
  }

  if (elBtnRouterStatusRefresh) {
    elBtnRouterStatusRefresh.addEventListener("click", loadRouterStatus);
  }

  /* ── Routing tab: Load alias list for A/B + Experiment selectors ─── */
  // elAbAliasSelect  → /api/admin/aliases      (all campaign aliases)
  // elExpAliasSelect → /api/admin/experiments  (only AB-configured aliases — Prompt 68)
  //
  // IMPORTANT: Both fetches use a plain fetch() with the auth header — NOT apiFetch().
  // apiFetch() calls showGate() on 401, which would hide the admin panel and flash the
  // token gate whenever these optional dropdown-populate calls fail.  These calls are
  // UI conveniences (the user can always type the alias manually), so they must never
  // trigger session side-effects.  Any non-200 or network error falls through silently
  // to the catch fallback text.
  async function loadAbAliases() {
    try {
      var res = await fetch("/api/admin/aliases", { headers: authHeaders() });
      if (!res.ok) throw new Error("non-200");
      var data = await res.json();
      aliasCache = data.aliases || [];
      if (elAbAliasSelect) {
        elAbAliasSelect.innerHTML = '<option value="">Select alias...</option>';
        aliasCache.forEach(function (a) {
          var opt = document.createElement("option");
          opt.value = a;
          opt.textContent = a;
          elAbAliasSelect.appendChild(opt);
        });
      }
    } catch (_) {
      if (elAbAliasSelect) elAbAliasSelect.innerHTML = '<option value="">Type alias below...</option>';
    }
    /* Load experiment aliases (AB-configured only) for Experiment Results selector */
    try {
      var expRes = await fetch("/api/admin/experiments", { headers: authHeaders() });
      if (!expRes.ok) throw new Error("non-200");
      var expData = await expRes.json();
      if (elExpAliasSelect) {
        elExpAliasSelect.innerHTML = '<option value="">Select alias...</option>';
        (expData.experiments || []).forEach(function (exp) {
          var opt = document.createElement("option");
          opt.value = exp.alias;
          opt.textContent = exp.alias + " - " + (exp.state || "?");
          elExpAliasSelect.appendChild(opt);
        });
      }
    } catch (_) {
      if (elExpAliasSelect) elExpAliasSelect.innerHTML = '<option value="">Type alias below...</option>';
    }
  }

  /* ── Routing tab: A/B Config ─────────────────────────── */

  function abUpdateWeightTotal() {
    if (!elAbVariants || !elAbWeightTotal) return;
    var inputs = elAbVariants.querySelectorAll(".ab-weight-input");
    var total  = 0;
    inputs.forEach(function (inp) { total += parseInt(inp.value, 10) || 0; });
    elAbWeightTotal.textContent = "Total: " + total + " / 100";
    elAbWeightTotal.style.color = total === 100
      ? "var(--success,#1a7f37)"
      : "var(--c-error,#b91c1c)";
  }

  function abBuildSlugOptions(currentSlug) {
    var opts = '<option value="">Select slug...</option>';
    slugCache.forEach(function (s) {
      opts += '<option value="' + esc(s.slug) + '"' + (s.slug === currentSlug ? ' selected' : '') + '>' + esc(s.slug) + '</option>';
    });
    // If current slug not in cache (old/unknown), add it so the selection is preserved
    if (currentSlug && !slugCache.some(function (s) { return s.slug === currentSlug; })) {
      opts += '<option value="' + esc(currentSlug) + '" selected>' + esc(currentSlug) + '</option>';
    }
    return opts;
  }

  function abRefreshSlugOptions() {
    if (!elAbVariants) return;
    var rows   = elAbVariants.querySelectorAll(".ab-variant-row");
    var chosen = new Set();
    rows.forEach(function (r) {
      var v = r.querySelector(".ab-slug-input").value;
      if (v) chosen.add(v);
    });
    rows.forEach(function (r) {
      var sel     = r.querySelector(".ab-slug-input");
      var current = sel.value;
      Array.from(sel.options).forEach(function (opt) {
        if (!opt.value) return;   // keep placeholder enabled
        opt.disabled = (opt.value !== current && chosen.has(opt.value));
      });
    });
  }

  function abAddVariantRow(slug, weight) {
    if (!elAbVariants) return;
    var row = document.createElement("div");
    row.className = "ab-variant-row";
    row.innerHTML =
      '<select class="ab-slug-input">' + abBuildSlugOptions(slug || "") + '</select>' +
      '<input type="number" class="ab-weight-input" min="0" max="100" placeholder="50" value="' + (weight != null ? weight : "") + '" />' +
      '<button type="button" class="btn-ghost btn-sm ab-remove-row" title="Remove">✕</button>';
    row.querySelector(".ab-remove-row").addEventListener("click", function () {
      row.remove();
      abUpdateWeightTotal();
      abRefreshSlugOptions();
    });
    row.querySelector(".ab-weight-input").addEventListener("input", function () {
      // Auto-balance: when exactly 2 variants, editing one mirrors the other (A + B = 100)
      var allInputs = elAbVariants ? Array.from(elAbVariants.querySelectorAll(".ab-weight-input")) : [];
      if (allInputs.length === 2) {
        var raw = parseInt(this.value, 10);
        var val = isNaN(raw) ? 0 : Math.min(100, Math.max(0, raw));
        var other = allInputs.find(function (inp) { return inp !== this; }, this);
        if (other) other.value = 100 - val;
      }
      abUpdateWeightTotal();
    });
    row.querySelector(".ab-slug-input").addEventListener("change", abRefreshSlugOptions);
    elAbVariants.appendChild(row);
    abUpdateWeightTotal();
    abRefreshSlugOptions();
  }

  async function abLoadConfig() {
    var alias = elAbAliasSelect ? elAbAliasSelect.value.trim().toLowerCase() : "";
    if (!alias) { showErr(elAbError, "Select an alias."); return; }
    hide(elAbConfig);
    hide(elAbSuccess);
    hideErr(elAbError);
    elAbStatus.textContent = "Loading...";
    show(elAbStatus);
    try {
      var res  = await apiFetch("/api/ab?alias=" + encodeURIComponent(alias));
      var data = await res.json();
      hide(elAbStatus);
      if (res.status === 404) {
        elAbStatus.textContent = 'No A/B config for alias "' + esc(alias) + '". Start below.';
        show(elAbStatus);
        if (elAbVariants) elAbVariants.innerHTML = "";
        abAddVariantRow("", "");
        abAddVariantRow("", "");
        show(elAbConfig);
        return;
      }
      if (!res.ok) { showErr(elAbError, data.error || "Failed to load."); return; }
      var variants = data.variants || [];
      if (elAbVariants) elAbVariants.innerHTML = "";
      variants.forEach(function (v) { abAddVariantRow(v.slug, v.weight); });
      if (variants.length === 0) { abAddVariantRow("", ""); abAddVariantRow("", ""); }
      show(elAbConfig);
    } catch (err) {
      hide(elAbStatus);
      if (err.message !== "401") showErr(elAbError, "Request failed.");
    }
  }

  async function abSaveConfig() {
    var alias = elAbAliasSelect ? elAbAliasSelect.value.trim().toLowerCase() : "";
    if (!alias) { showErr(elAbError, "Select an alias."); return; }
    var rows     = elAbVariants ? elAbVariants.querySelectorAll(".ab-variant-row") : [];
    var variants = [];
    rows.forEach(function (row) {
      var s = (row.querySelector(".ab-slug-input").value   || "").trim().toLowerCase();
      var w = parseInt(row.querySelector(".ab-weight-input").value || "0", 10);
      if (s) variants.push({ slug: s, weight: w });
    });
    // Client-side weight validation before sending
    var total = variants.reduce(function (sum, v) { return sum + v.weight; }, 0);
    if (total !== 100) {
      showErr(elAbError, "Weights must sum to 100 (current: " + total + ").");
      return;
    }
    hideErr(elAbError);
    hide(elAbSuccess);
    elBtnAbSave.disabled    = true;
    elBtnAbSave.textContent = "Saving...";
    try {
      var res  = await apiFetch("/api/ab", {
        method: "PUT",
        body:   JSON.stringify({ alias: alias, variants: variants }),
      });
      var data = await res.json();
      if (!res.ok) {
        showErr(elAbError, (data.reason ? "Validation: " + data.reason : "") || data.error || "Save failed.");
        return;
      }
      elAbSuccess.textContent = "Config saved.";
      show(elAbSuccess);
      setTimeout(function () { hide(elAbSuccess); }, 3000);
      silentCompile(); // sync routing table immediately
    } catch (err) {
      if (err.message !== "401") showErr(elAbError, "Request failed.");
    } finally {
      elBtnAbSave.disabled    = false;
      elBtnAbSave.textContent = "Save Config";
    }
  }

  async function abDeleteConfig() {
    var alias = elAbAliasSelect ? elAbAliasSelect.value.trim().toLowerCase() : "";
    if (!alias) { showErr(elAbError, "Select an alias."); return; }
    hideErr(elAbError);
    hide(elAbSuccess);
    elBtnAbDelete.disabled    = true;
    elBtnAbDelete.textContent = "Deleting...";
    try {
      var res  = await apiFetch("/api/ab?alias=" + encodeURIComponent(alias), { method: "DELETE" });
      var data = await res.json();
      if (!res.ok) { showErr(elAbError, data.error || "Delete failed."); return; }
      elAbSuccess.textContent = "Config deleted.";
      show(elAbSuccess);
      hide(elAbConfig);
      if (elAbVariants)    elAbVariants.innerHTML = "";
      if (elAbAliasSelect) elAbAliasSelect.value  = "";
      setTimeout(function () { hide(elAbSuccess); }, 3000);
    } catch (err) {
      if (err.message !== "401") showErr(elAbError, "Request failed.");
    } finally {
      elBtnAbDelete.disabled    = false;
      elBtnAbDelete.textContent = "Delete Config";
    }
  }

  if (elBtnAbLoad)   elBtnAbLoad.addEventListener("click",   abLoadConfig);
  if (elBtnAbAddRow) elBtnAbAddRow.addEventListener("click", function () { abAddVariantRow("", ""); });
  if (elBtnAbSave)   elBtnAbSave.addEventListener("click",   abSaveConfig);
  if (elBtnAbDelete) elBtnAbDelete.addEventListener("click", abDeleteConfig);

  /* ── Diagnostics tab: A/B Diagnostics ───────────────── */
  async function abRunDiagnostics() {
    var alias = elAbdAliasInput ? elAbdAliasInput.value.trim().toLowerCase() : "";
    if (!alias) { showErr(elAbdError, "Enter an alias."); return; }
    hide(elAbdResult);
    hideErr(elAbdError);
    if (elAbdStatus) { elAbdStatus.textContent = "Testing..."; show(elAbdStatus); }
    if (elBtnAbdRun) elBtnAbdRun.disabled = true;
    try {
      var res  = await apiFetch("/api/ab-test?alias=" + encodeURIComponent(alias));
      var data = await res.json();
      if (elAbdStatus) hide(elAbdStatus);
      if (!res.ok) { showErr(elAbdError, data.error || "Test failed."); return; }
      if (elAbdResult) {
        elAbdResult.textContent = JSON.stringify(data, null, 2);
        show(elAbdResult);
      }
    } catch (err) {
      if (elAbdStatus) hide(elAbdStatus);
      if (err.message !== "401") showErr(elAbdError, "Request failed.");
    } finally {
      if (elBtnAbdRun) elBtnAbdRun.disabled = false;
    }
  }

  if (elBtnAbdRun) elBtnAbdRun.addEventListener("click", abRunDiagnostics);

  /* ── Routing tab: Experiment Results ─────────────────── */
  async function loadExpResults() {
    var alias = elExpAliasSelect ? elExpAliasSelect.value.trim().toLowerCase() : "";
    if (!alias) { showErr(elExpError, "Select an alias."); return; }
    hideErr(elExpError);
    hide(elExpResults);
    if (elExpWinner)     hide(elExpWinner);
    if (elExpAliasInfo)  hide(elExpAliasInfo);
    if (elExpWeightNote) elExpWeightNote.style.display = "none";
    if (elLnkOpenInLab)  hide(elLnkOpenInLab);
    if (elExpStatus) { elExpStatus.textContent = "Loading..."; show(elExpStatus); }
    if (elBtnExpLoad) elBtnExpLoad.disabled = true;
    try {
      var res  = await apiFetch("/api/experiments?alias=" + encodeURIComponent(alias));
      var data = await res.json();
      if (elExpStatus) hide(elExpStatus);
      if (!res.ok) {
        var errMsg = data.error || ("HTTP " + res.status);
        showErr(elExpError, errMsg === "no_ab_config" ? "No A/B config for this alias." : errMsg);
        return;
      }
      var variants = data.variants || [];
      if (!variants.length) { showErr(elExpError, "No data yet."); return; }

      if (elLnkOpenInLab) {
        elLnkOpenInLab.href = "/admin/experiments?alias=" + encodeURIComponent(alias);
        elLnkOpenInLab.style.display = "inline-flex";
        elLnkOpenInLab.classList.remove("hidden");
      }

      /* Alias info line — clickable hub link + state + routing note */
      if (elExpAliasInfo) {
        var stateIcon = '';
        if (data.state === 'DECIDED') stateIcon = '<span class="material-symbols-outlined" style="font-size:13px;vertical-align:middle;margin-right:2px;color:var(--success)">lock</span>';
        else if (data.state === 'RUNNING') stateIcon = '<span class="material-symbols-outlined" style="font-size:13px;vertical-align:middle;margin-right:2px;color:var(--warn)">play_arrow</span>';

        var stateLabel = data.state ? ' &nbsp;<span style="color:var(--text-m);font-weight:600;display:inline-flex;align-items:center">' + stateIcon + esc(data.state) + '</span>' : '';
        elExpAliasInfo.innerHTML =
          'Hub: <a href="/' + esc(alias) + '" target="_blank" rel="noopener" ' +
          'style="font-weight:600;text-decoration:underline">/' + esc(alias) + '</a>' + stateLabel;
        show(elExpAliasInfo);
      }

      /* Winner banner */
      if (elExpWinner) {
        if (data.winner) {
          elExpWinner.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;color:var(--warn);vertical-align:middle;margin-right:4px">workspace_premium</span>Provisional winner: <strong>' + esc(data.winner) + '</strong>';
          elExpWinner.style.display = "inline-flex";
          elExpWinner.style.alignItems = "center";
          elExpWinner.style.background = "rgba(180,83,9,0.08)";
          elExpWinner.style.padding = "0.4rem 0.75rem";
          elExpWinner.style.borderRadius = "var(--radius-sm)";
          show(elExpWinner);
        } else {
          hide(elExpWinner);
        }
      }

      /* Compute total exposures once for actual-share calculation */
      var totalExp = variants.reduce(function (s, v) { return s + (v.exposures || 0); }, 0);

      elExpRows.innerHTML = "";
      variants.forEach(function (v, i) {
        var ctrPct      = (v.ctr * 100).toFixed(1) + "%";
        var convRatePct = (v.conversion_rate * 100).toFixed(1) + "%";

        var liftVal  = (v.conversions > 0 || v.conversion_lift !== 0) ? v.conversion_lift : v.lift;
        var liftCell;
        if (i === 0) {
          liftCell = '<span style="color:var(--text-m,#888)">baseline</span>';
        } else if (liftVal === null) {
          liftCell = "-";
        } else if (liftVal >= 0) {
          liftCell = '<span style="color:var(--success,#1a7f37)">+' + (liftVal * 100).toFixed(1) + '%</span>';
        } else {
          liftCell = '<span style="color:var(--danger,#b91c1c)">' + (liftVal * 100).toFixed(1) + '%</span>';
        }

        var winnerBadge = v.winner
          ? ' <span class="badge badge-success" style="font-size:0.65rem;font-weight:700;display:inline-flex;align-items:center;gap:3px;margin-left:4px;padding:2px 6px"><span class="material-symbols-outlined" style="font-size:11px">workspace_premium</span>Winner</span>'
          : '';

        var wtDisplay = (v.weight != null) ? (v.weight + "%") : "-";
        var wtCell = '<span style="font-weight:500;color:var(--text-m)">' + wtDisplay + '</span>';

        var slugLink =
          '<a href="/' + esc(v.slug) + '" target="_blank" rel="noopener" ' +
          'style="color:inherit;text-decoration:none" title="Open /' + esc(v.slug) + '">' +
          '<code style="font-size:.78rem">' + esc(v.slug) + '</code></a>';

        var tr = document.createElement("tr");
        tr.innerHTML =
          '<td>' + slugLink + winnerBadge + '</td>' +
          '<td style="text-align:right">' + wtCell + '</td>' +
          '<td style="text-align:right">' + v.exposures + '</td>' +
          '<td style="text-align:right">' + v.clicks    + '</td>' +
          '<td style="text-align:right">' + ctrPct      + '</td>' +
          '<td style="text-align:right">' + v.conversions + '</td>' +
          '<td style="text-align:right"><strong>' + convRatePct + '</strong></td>' +
          '<td style="text-align:right">' + liftCell + '</td>';
        elExpRows.appendChild(tr);
      });

      /* Weight vs actual-share mismatch note */
      if (elExpWeightNote && totalExp > 0) {
        var hasMismatch = variants.some(function (v) {
          if (v.weight == null) return false;
          var actualShare = v.exposures / totalExp;
          var targetShare = v.weight / 100;
          return Math.abs(actualShare - targetShare) > 0.12; // > 12 pp difference
        });
        if (hasMismatch) {
          elExpWeightNote.textContent = "Distribution reflects live routing, not target weights — actual share may lag after a rebalance.";
          elExpWeightNote.style.display = "";
        } else {
          elExpWeightNote.style.display = "none";
        }
      }

      show(elExpResults);
    } catch (err) {
      if (elExpStatus) hide(elExpStatus);
      if (err.message !== "401") showErr(elExpError, "Request failed.");
    } finally {
      if (elBtnExpLoad) elBtnExpLoad.disabled = false;
    }
  }

  if (elBtnExpLoad) elBtnExpLoad.addEventListener("click", loadExpResults);

  /* ── Routing tab: Conversion Signals ─────────────────── */
  function genConvSnippet() {
    var evName = elConvEventName.value.trim().toLowerCase() || "purchase";
    var originUrl = window.location.origin;
    var sTop = String.fromCharCode(60) + "script" + String.fromCharCode(62);
    var sEnd = String.fromCharCode(60) + "/script" + String.fromCharCode(62);

    var snipLanding = "(function(){function p(n){return new URLSearchParams(window.location.search).get(n);}var e=p('cos_exp'),v=p('cos_var'),c=p('cos_cid'),w=p('cos_win');if(e||v||c){try{var dys=parseInt(w)||7;var t=Date.now()+(dys*86400000);localStorage.setItem('cos_data',JSON.stringify({exp:e||'',var:v||'',cid:c||'',expTime:t}));}catch(err){}}})();";

    var snipThankYou = "(function(){var d={exp:'organic',var:'direct',cid:''};try{var s=JSON.parse(localStorage.getItem('cos_data'));if(s&&s.exp&&s.expTime>Date.now())d=s;}catch(e){}var u='" + originUrl + "/t?e=conversion&ev=" + evName + "&exp='+encodeURIComponent(d.exp)+'&v='+encodeURIComponent(d.var)+'&cid='+encodeURIComponent(d.cid);fetch(u,{mode:'no-cors'});})();";

    elConvSnippet.textContent =
      "<!-- 1. KARTRA LANDING PAGE SCRIPT (Cross-Domain Tracker) -->\\n" +
      "<!-- Ilk inilen sayfanin <head> veya <body> kismina ekleyin -->\\n" +
      sTop + "\\n" + snipLanding + "\\n" + sEnd + "\\n\\n" +
      "<!-- 2. KARTRA THANK YOU PAGE SCRIPT (Conversion Firing) -->\\n" +
      "<!-- Satin alma sonrasi gosterilen tesekkur sayfasina ekleyin -->\\n" +
      sTop + "\\n" + snipThankYou + "\\n" + sEnd;

    show(elConvSnippetWrap);
  }

  if (elBtnConvGen) elBtnConvGen.addEventListener("click", genConvSnippet);

  if (elBtnConvCopy) {
    elBtnConvCopy.addEventListener("click", function() {
      var code = elConvSnippet.textContent;
      if (!code) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(function() {
          elBtnConvCopy.textContent = "Copied!";
          setTimeout(function() { elBtnConvCopy.textContent = "Copy Code"; }, 2000);
        });
      }
    });
  }

  /* ── Copy button ─────────────────────────────────────── */
  elBtnCopy.addEventListener("click", function () {
    var path = elGenUrl.textContent;
    if (!path) return;
    var fullUrl = window.location.origin + path;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(fullUrl).then(function () {
        elBtnCopy.textContent = "Copied!";
        setTimeout(function () { elBtnCopy.textContent = "Copy"; }, 2000);
      });
    } else {
      var ta = document.createElement("textarea");
      ta.value = fullUrl;
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (err2) {}
      document.body.removeChild(ta);
      elBtnCopy.textContent = "Copied!";
      setTimeout(function () { elBtnCopy.textContent = "Copy"; }, 2000);
    }
  });

  /* ── Funnel Overrides & Engine (UI & JSON) ────────────────────────────────────── */
  var funnelStore = {};
  var engineStore = {};
  var visualStore = {};

  async function loadKartra() {
    $("kartra-json").value = "Loading...";
    $("funnel-list-body").innerHTML = '<tr><td colspan="3" class="empty-state">Loading...</td></tr>';
    try {
      var res = await apiFetch("/api/admin/routes");
      if (res.ok) {
        var data = await res.json();
        funnelStore = data.routes || {};
        delete funnelStore.engine;  // Fix: Stop payload override bug!
        delete funnelStore.visuals;
        engineStore = data.engine || {};
        visualStore = data.visuals || {};

        $("kartra-json").value = JSON.stringify(funnelStore, null, 2);
        renderFunnelTable();
        populateEngineForm();
        if (typeof populateEngineMapSelect === "function") populateEngineMapSelect();
      } else {
        funnelStore = {}; engineStore = {};
        $("kartra-json").value = "{}";
        $("funnel-list-body").innerHTML = '<tr><td colspan="3" class="error">Failed to load rules.</td></tr>';
      }
    } catch (e) {
      funnelStore = {}; engineStore = {};
      $("kartra-json").value = "{}";
    }
  }

  function populateEngineForm() {
    var redirects = engineStore.redirects || {};
    var points = engineStore.points || {};
    var thresh = engineStore.thresholds || {};
    $("e-redir-hot").value = redirects.hot || "https://pages." + window.CUSTOM_DOMAIN + "/checkout";
    $("e-redir-conv").value = redirects.converted || "https://pages." + window.CUSTOM_DOMAIN + "/tesekkurler";
    $("e-thresh-hot").value = thresh.hot_engagement !== undefined ? thresh.hot_engagement : 60;
    $("e-pt-click-hard").value = points.click_hard !== undefined ? points.click_hard : 10;
    $("e-pt-click-soft").value = points.click_soft !== undefined ? points.click_soft : 2;

    // Time split loading logic (v2)
    var timing = engine.timing || {};
    $("e-freq-time-hard").value = timing.time_hard_freq || 10;
    $("e-pt-time-hard").value   = points.time_hard_pts !== undefined ? points.time_hard_pts : 5;
    $("e-freq-time-soft").value = timing.time_soft_freq || 30;
    $("e-pt-time-soft").value   = points.time_soft_pts !== undefined ? points.time_soft_pts : 2;
    renderCustomMaps();
  }

  function syncDOMToCustomMapsStore() {
    engineStore.customMaps = engineStore.customMaps || {};
    document.querySelectorAll(".map-card").forEach(function(card) {
      var id = card.dataset.id;
      if(engineStore.customMaps[id]) {
        var threshInput = card.querySelector(".map-thresh-hot").value;
        var ptHardInput = card.querySelector(".map-pt-hard").value;
        var ptSoftInput = card.querySelector(".map-pt-soft").value;

        var customPoints = {};
        var customThresh = {};
        if (threshInput !== "") customThresh.hot_engagement = parseInt(threshInput, 10);
        if (ptHardInput !== "") customPoints.click_hard = parseInt(ptHardInput, 10);
        if (ptSoftInput !== "") customPoints.click_soft = parseInt(ptSoftInput, 10);

        var rules = [];
        card.querySelectorAll(".map-rule-row").forEach(function(row) {
          var hs = row.querySelector(".rule-has").value.split(",").map(function(s){return s.trim()}).filter(Boolean);
          var ns = row.querySelector(".rule-not").value.split(",").map(function(s){return s.trim()}).filter(Boolean);
          rules.push({
            name: row.querySelector(".rule-name").value.trim(),
            hasTags: hs,
            notTags: ns,
            url: row.querySelector(".rule-url").value.trim()
          });
        });

        engineStore.customMaps[id] = {
          name: card.querySelector(".map-id-input").value.trim(),
          hot: card.querySelector(".map-hot-input").value.trim(),
          converted: card.querySelector(".map-conv-input").value.trim(),
          warm: card.querySelector(".map-warm-input").value.trim(),
          post: card.querySelector(".map-post-input").value.trim(),
          points: customPoints,
          thresholds: customThresh,
          rules: rules
        };
      }
    });
  }

  function renderCustomMaps() {
    var wrap = $("engine-custom-maps-wrap");
    if (!wrap) return;
    wrap.innerHTML = "";
    var maps = engineStore.customMaps || {};
    var keys = Object.keys(maps);
    if (keys.length === 0) {
      wrap.innerHTML = '<p class="empty-state" style="margin:0;">No custom maps defined. Click + New Map to create one.</p>';
      return;
    }
    keys.forEach(function(key) {
      var map = maps[key];
      var rulesHtml = '';
      if (Array.isArray(map.rules) && map.rules.length > 0) {
        map.rules.forEach(function(r) {
          rulesHtml +=
            '<div class="map-rule-row" style="display:flex; gap:0.5rem; margin-top:0.75rem; align-items:flex-end;">' +
              '<div style="flex:1;"><label style="font-size:0.75rem;">Rule Name</label><input type="text" class="rule-name" value="' + esc(r.name || "") + '" placeholder="e.g. VIP"></div>' +
              '<div style="flex:1;"><label style="font-size:0.75rem;">Has Tags</label><input type="text" class="rule-has" value="' + esc((r.hasTags || []).join(",")) + '" placeholder="e.g. music"></div>' +
              '<div style="flex:1;"><label style="font-size:0.75rem;">Not Tags</label><input type="text" class="rule-not" value="' + esc((r.notTags || []).join(",")) + '" placeholder="e.g. vip,post"></div>' +
              '<div style="flex:2;"><label style="font-size:0.75rem;">Target URL</label><input type="url" class="rule-url" value="' + esc(r.url || "") + '" placeholder="https://..."></div>' +
              '<button class="btn-ghost btn-sm btn-del-rule" style="color:var(--danger); margin-bottom:0.25rem;">✕</button>' +
            '</div>';
        });
      }

      var div = document.createElement("div");
      div.className = "dash-card map-card";
      div.style.padding = "1rem";
      div.dataset.id = key;
      div.innerHTML =
        '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">' +
          '<input type="text" class="map-id-input" placeholder="Map Display Name" style="font-weight:700; width:50%; margin:0; border:1px solid transparent; border-bottom:1px solid var(--border);" value="' + esc(map.name || key) + '">' +
          '<div>' +
            '<button class="btn-ghost btn-sm btn-visual-map" style="color:var(--accent); margin-right:8px;" data-id="' + esc(key) + '">⊞ Visual Map</button>' +
            '<button class="btn-ghost btn-sm btn-del-map" style="color:var(--danger)">Delete</button>' +
          '</div>' +
        '</div>' +
        '<div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">' +
          '<div style="display:flex; flex-direction:column;"><label>Hot Redirect</label><input type="url" class="map-hot-input" placeholder="https://..." value="' + esc(map.hot || "") + '"></div>' +
          '<div style="display:flex; flex-direction:column;"><label>Converted Redirect</label><input type="url" class="map-conv-input" placeholder="https://..." value="' + esc(map.converted || "") + '"></div>' +
          '<div style="display:flex; flex-direction:column;"><label>Warm / Nurture (Optional)</label><input type="url" class="map-warm-input" placeholder="https://..." value="' + esc(map.warm || "") + '"></div>' +
          '<div style="display:flex; flex-direction:column;"><label>Post / Upsell (Optional)</label><input type="url" class="map-post-input" placeholder="https://..." value="' + esc(map.post || "") + '"></div>' +
        '</div>' +
        '<div style="margin-top:1rem; border:1px solid var(--border); border-radius:var(--radius); padding:0.5rem 1rem;">' +
          '<div style="display:flex; justify-content:space-between; align-items:center;">' +
            '<span style="font-size:0.85rem; font-weight:600; color:var(--text);">⚡ Dynamic Routing Policies (Tags)</span>' +
            '<button type="button" class="btn-ghost btn-sm btn-add-rule" style="margin-top:-4px;">+ Add Policy</button>' +
          '</div>' +
          '<div class="map-rules-wrap">' +
            (rulesHtml || '<p style="font-size:0.75rem; color:var(--text-m); margin-top:0.5rem; margin-bottom:0;">No dynamic tag rules defined. Rules evaluate top-to-bottom.</p>') +
          '</div>' +
        '</div>' +
        '<details style="margin-top:1rem; border:1px solid var(--border); border-radius:var(--radius); padding:0.5rem 1rem;">' +
          '<summary style="cursor:pointer; font-size:0.85rem; font-weight:600; color:var(--text-m);">⚙️ Override Engagement Sensitivity</summary>' +
          '<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:1rem; margin-top:0.75rem;">' +
            '<div style="display:flex; flex-direction:column;"><label style="font-size:0.8rem;">Hot Threshold (Empty = Global)</label><input type="number" class="map-thresh-hot" placeholder="e.g. 60" value="' + (map.thresholds && map.thresholds.hot_engagement !== undefined ? map.thresholds.hot_engagement : "") + '"></div>' +
            '<div style="display:flex; flex-direction:column;"><label style="font-size:0.8rem;">Hard Click Points</label><input type="number" class="map-pt-hard" placeholder="e.g. 10" value="' + (map.points && map.points.click_hard !== undefined ? map.points.click_hard : "") + '"></div>' +
            '<div style="display:flex; flex-direction:column;"><label style="font-size:0.8rem;">Soft Click Points</label><input type="number" class="map-pt-soft" placeholder="e.g. 2" value="' + (map.points && map.points.click_soft !== undefined ? map.points.click_soft : "") + '"></div>' +
          '</div>' +
        '</details>';
      wrap.appendChild(div);

      div.querySelector(".btn-del-map").addEventListener("click", function() {
        if(confirm("Delete this Custom Map? Any campaigns using it will fallback to Global defaults.")) {
          delete engineStore.customMaps[key];
          delete visualStore[key];
          renderCustomMaps();
        }
      });
      div.querySelector(".btn-visual-map").addEventListener("click", function() {
        openVisualMapper(key);
      });
      div.querySelector(".btn-add-rule").addEventListener("click", function(e) {
        e.preventDefault();
        syncDOMToCustomMapsStore();
        if (!engineStore.customMaps[key].rules) engineStore.customMaps[key].rules = [];
        engineStore.customMaps[key].rules.push({ name: "", hasTags: [], notTags: [], url: "" });
        renderCustomMaps();
      });
      div.querySelectorAll(".btn-del-rule").forEach(function(btn, idx) {
        btn.addEventListener("click", function(e) {
          e.preventDefault();
          syncDOMToCustomMapsStore();
          engineStore.customMaps[key].rules.splice(idx, 1);
          renderCustomMaps();
        });
      });
    });
  }

  if ($("btn-add-engine-map")) {
    $("btn-add-engine-map").addEventListener("click", function() {
      engineStore.customMaps = engineStore.customMaps || {};
      var newId = "map_" + Date.now();
      engineStore.customMaps[newId] = { name: "New Map Profile", hot: "", converted: "" };
      renderCustomMaps();
    });
  }

  if ($("btn-global-visual-map")) {
    $("btn-global-visual-map").addEventListener("click", function() {
      openVisualMapper("global");
    });
  }

  if ($("btn-save-custom-maps")) {
    $("btn-save-custom-maps").addEventListener("click", async function() {
      var btn = $("btn-save-custom-maps");
      btn.disabled = true; btn.textContent = "Deploying Maps...";

      syncDOMToCustomMapsStore();

      await forceSyncFunnelStore();
      btn.disabled = false; btn.textContent = "Deploy Maps";
      $("custom-maps-status").textContent = "Custom Engine Maps successfully deployed.";
      $("custom-maps-status").classList.remove("hidden");
      $("custom-maps-status").classList.add("success");
      setTimeout(function() { $("custom-maps-status").classList.add("hidden"); $("custom-maps-status").classList.remove("success"); }, 4000);
    });
  }

  function openVisualMapper(mapId) {
    if (!visualStore[mapId]) visualStore[mapId] = {}; // Initialize if blank

    var activeDataObj = visualStore[mapId];
    var cmap = engineStore.customMaps[mapId];

    // Seed Algorithm for Custom Maps that are empty
    if (mapId !== "global" && (!activeDataObj.nodes || activeDataObj.nodes.length === 0) && cmap) {
      function shortUrl(u) {
        if (!u) return "";
        try { var p = new URL(u).pathname; return p === "/" ? u : p; }
        catch(e) { var s=u.indexOf(".com"); return s>-1 ? u.substring(s+4) : u; }
      }
      var h = shortUrl(cmap.hot) || "/hot";
      var c = shortUrl(cmap.converted) || "/conv";

      var tN = [
        {id:'n1', name:'Source', url:'*/*', type:'cold', goal:'Entry point', x:40, y:180, w:150, h:85},
        {id:'n2', name:'Router', url:'Edge', type:'support', goal:'Tag and decide route', x:260, y:180, w:150, h:85},
        {id:'n3', name:'Hot Traffic', url:h, type:'hot', goal:'Target for warm traffic', x:500, y:80, w:150, h:85},
        {id:'n4', name:'Converted', url:c, type:'conv', goal:'Target for buyers', x:500, y:280, w:150, h:85}
      ];
      var tE = [
        {from:'n1',to:'n2',label:'Clicks link'},
        {from:'n2',to:'n3',label:'Score < threshold'},
        {from:'n2',to:'n4',label:'Score >= threshold'}
      ];

      if (cmap.warm) {
        tN.push({id:'n5', name:'Nurture', url:shortUrl(cmap.warm), type:'warm', goal:'Opt-in or assist', x:500, y: -20, w:150, h:85});
        tE.push({from:'n2',to:'n5',label:'Cold fallback'});
      }
      if (cmap.post) {
        tN.push({id:'n6', name:'Post / Upsell', url:shortUrl(cmap.post), type:'post', goal:'Secondary pipeline', x:720, y:280, w:150, h:85});
        tE.push({from:'n4',to:'n6',label:'Post action'});
      }

      // Dynamic Tag Rules rendering
      if (Array.isArray(cmap.rules) && cmap.rules.length > 0) {
        var yOff = 380;
        var rIdx = 1;
        cmap.rules.forEach(function(r) {
          if (!r.url) return;
          var nId = 'n_rule_' + rIdx;
          tN.push({id: nId, name: (r.name || ('Policy ' + rIdx)), url: shortUrl(r.url), type: 'post', goal: 'Dynamic logic', x: 500, y: yOff, w: 150, h:85});

          var hasL = (r.hasTags && r.hasTags.length) ? '+[' + r.hasTags.join() + ']' : '';
          var notL = (r.notTags && r.notTags.length) ? '-[' + r.notTags.join() + ']' : '';
          var eLabel = [hasL, notL].filter(Boolean).join(" ");
          if (!eLabel) eLabel = "Tag Rule";
          if (r.hasTags && r.hasTags.length > 0) eLabel += " t:[" + r.hasTags.join(",") + "]";

          tE.push({from: 'n2', to: nId, label: eLabel});
          yOff += 100;
          rIdx++;
        });
      }
      activeDataObj = { nodes: tN, edges: tE };
    }

    // Create Modal Container
    var modal = document.createElement("div");
    modal.className = "visual-mapper-modal";
    modal.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:9999; background:var(--bg); display:flex; flex-direction:column;";

    // Create Header
    var header = document.createElement("div");
    header.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:12px 20px; background:var(--surface); border-bottom:1px solid var(--border);";

    var titleText = mapId === "global" ? "Decision Engine Logic" : ((cmap || {}).name || mapId);
    var title = document.createElement("div");
    title.innerHTML = "<h3 style='margin:0; font-size:16px;'><span style='color:var(--accent);margin-right:6px;'>⊞</span>Visual Planner: " + esc(titleText) + "</h3>";

    var closeBtn = document.createElement("button");
    closeBtn.textContent = "Close Planner (Discard unsaved)";
    closeBtn.className = "btn-ghost";
    closeBtn.addEventListener("click", function() {
      document.body.removeChild(modal);
    });

    header.appendChild(title);
    header.appendChild(closeBtn);
    modal.appendChild(header);

    // Create iframe
    var iframe = document.createElement("iframe");
    iframe.style.cssText = "flex:1; width:100%; height:100%; border:none;";

    // Replace script data with active map context
    var activeDataStr = JSON.stringify(activeDataObj);
    var blobHtml = window.VISUAL_MAPPER_HTML
      .replace(/runtime\.ekinyasa\.online/g, "${customDomain}")
      .replace(
        "<script>",
        "<script> window.INJECTED_MAP_DATA = " + activeDataStr + "; window.INJECTED_MAP_ID = '" + mapId + "';"
      );
    var blob = new Blob([blobHtml], { type: "text/html" });
    iframe.src = URL.createObjectURL(blob);
    modal.appendChild(iframe);

    document.body.appendChild(modal);
  }

  // Communication from Visual Mapper iframe
  window.addEventListener("message", async function(event) {
    if (event.data && event.data.type === "SAVE_VISUAL_MAP") {
      var mapId = event.data.mapId;
      if (!mapId) return;
      visualStore[mapId] = event.data.data;
      var currentCards = document.body.querySelector(".visual-mapper-modal");
      if (currentCards) document.body.removeChild(currentCards);

      var statusId = mapId === "global" ? "engine-status" : "custom-maps-status";

      await forceSyncFunnelStore();

      $(statusId).textContent = "Visual Canvas saved & Engine deployed.";
      $(statusId).classList.remove("hidden");
      $(statusId).classList.add("success");
      setTimeout(function() { $(statusId).classList.add("hidden"); $(statusId).classList.remove("success"); }, 4000);
    }
  });

  $("btn-save-engine").addEventListener("click", async function() {
    var btn = $("btn-save-engine");
    btn.disabled = true; btn.textContent = "Deploying...";

    engineStore.redirects = {
      hot: $("e-redir-hot").value.trim(),
      converted: $("e-redir-conv").value.trim()
    };
    engineStore.thresholds = {
      hot_engagement: parseInt($("e-thresh-hot").value) || 60
    };
    engineStore.points = {
      click_hard: parseInt($("e-pt-click-hard").value) || 10,
      click_soft: parseInt($("e-pt-click-soft").value) || 2,
      time_on_page: parseInt($("e-pt-time").value) || 2
    };

    engineStore.customMaps = engineStore.customMaps || {};

    await forceSyncFunnelStore();
    btn.disabled = false; btn.textContent = "Deploy Engine Rules";
    $("engine-status").textContent = "Engine rules successfully deployed globally.";
    $("engine-status").classList.remove("hidden");
    $("engine-status").classList.add("success");
    setTimeout(function() { $("engine-status").classList.add("hidden"); $("engine-status").classList.remove("success"); }, 4000);
  });

  function renderFunnelTable() {
    var tbody = $("funnel-list-body");
    tbody.innerHTML = "";
    var keys = Object.keys(funnelStore);
    if (keys.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="empty-state">No manual rules active. Engine runs on heuristics.</td></tr>';
      return;
    }
    keys.sort().forEach(function(url) {
      var conf = funnelStore[url];
      var tr = document.createElement("tr");
      var html = '<td style="font-family:ui-monospace,monospace;font-size:0.8rem;">' + esc(url) + '</td>';
      html += '<td><span style="background:var(--surface); border:1px solid var(--border); border-radius:4px; padding:2px 6px; font-size:0.75rem;">' + esc(conf.pageType || 'N/A') + '</span></td>';
      html += '<td><button class="btn-ghost btn-sm btn-edit-funnel" data-url="' + esc(url) + '">Edit</button> <button class="btn-ghost btn-sm btn-del-funnel" style="color:var(--danger);" data-url="' + esc(url) + '">Del</button></td>';
      tr.innerHTML = html;
      tbody.appendChild(tr);
    });

    document.querySelectorAll(".btn-edit-funnel").forEach(function(btn) {
      btn.addEventListener("click", function() { populateFunnelForm(btn.dataset.url); });
    });
    document.querySelectorAll(".btn-del-funnel").forEach(function(btn) {
      btn.addEventListener("click", async function() {
        if (!confirm("Delete rule for " + btn.dataset.url + "?")) return;
        delete funnelStore[btn.dataset.url];
        await forceSyncFunnelStore();
      });
    });
  }

  function populateFunnelForm(url) {
    if (!funnelStore[url]) return;
    $("f-funnel-url").value = url;
    $("f-funnel-type").value = funnelStore[url].pageType || "product";

    $("f-funnel-hardcta").value = "";
    $("f-funnel-softcta").value = "";
    if (funnelStore[url].selectors) {
      if (funnelStore[url].selectors.hardCta) $("f-funnel-hardcta").value = funnelStore[url].selectors.hardCta.join(", ");
      if (funnelStore[url].selectors.softCta) $("f-funnel-softcta").value = funnelStore[url].selectors.softCta.join(", ");
    }

    $("f-funnel-hot").value = "";
    if (funnelStore[url].redirects && funnelStore[url].redirects.hot) {
      $("f-funnel-hot").value = funnelStore[url].redirects.hot;
    }

    $("btn-cancel-funnel").classList.remove("hidden");
    $("f-funnel-url").focus();
  }

  $("btn-cancel-funnel").addEventListener("click", function() {
    $("funnel-form").reset();
    $("btn-cancel-funnel").classList.add("hidden");
    hideErr($("funnel-form-error"));
    hideErr($("funnel-form-success"));
  });

  $("funnel-form").addEventListener("submit", async function(e) {
    e.preventDefault();
    hideErr($("funnel-form-error"));
    hideErr($("funnel-form-success"));
    var btn = $("btn-save-funnel");

    var url = $("f-funnel-url").value.trim().toLowerCase();
    if (!url) { showErr($("funnel-form-error"), "URL is required."); return; }

    var pageType = $("f-funnel-type").value;
    var conf = { pageType: pageType };

    var hardCta = $("f-funnel-hardcta").value.trim();
    var softCta = $("f-funnel-softcta").value.trim();
    if (hardCta || softCta) conf.selectors = {};
    if (hardCta) conf.selectors.hardCta = hardCta.split(",").map(function(s) { return s.trim(); }).filter(Boolean);
    if (softCta) conf.selectors.softCta = softCta.split(",").map(function(s) { return s.trim(); }).filter(Boolean);

    var hRedirect = $("f-funnel-hot").value.trim();
    if (hRedirect) conf.redirects = { hot: hRedirect };

    funnelStore[url] = conf;

    btn.disabled = true;
    btn.textContent = "Deploying...";

    await forceSyncFunnelStore();

    $("funnel-form").reset();
    $("btn-cancel-funnel").classList.add("hidden");
    btn.disabled = false;
    btn.textContent = "Deploy Rule";
    showErr($("funnel-form-success"), "Rule deployed successfully!");
    $("funnel-form-success").classList.remove("error");
    $("funnel-form-success").classList.add("success");
    setTimeout(function(){ hideErr($("funnel-form-success")); }, 3000);
  });

  async function forceSyncFunnelStore() {
    try {
      var payload = { engine: engineStore, visuals: visualStore };
      Object.assign(payload, funnelStore);
      var res = await apiFetch("/api/admin/routes", { method: "PUT", body: JSON.stringify(payload) });
      if (res.ok) {
        $("kartra-json").value = JSON.stringify(funnelStore, null, 2);
        renderFunnelTable();
      } else {
        alert("Failed to sync to CDN.");
      }
    } catch(e) { alert("Network error syncing rules."); }
  }

  $("btn-funnel-refresh").addEventListener("click", loadKartra);
  $("btn-funnel-toggle-json").addEventListener("click", function() {
    $("funnel-json-wrap").classList.toggle("hidden");
  });

  /* JSON fallback functions */
  $("btn-kartra-format").addEventListener("click", function() {
    try {
      var val = JSON.parse($("kartra-json").value);
      $("kartra-json").value = JSON.stringify(val, null, 2);
      hideErr($("kartra-error"));
    } catch (e) {
      showErr($("kartra-error"), "Invalid JSON format.");
    }
  });

  $("btn-kartra-save").addEventListener("click", async function() {
    var btn = $("btn-kartra-save");
    btn.disabled = true; btn.textContent = "Syncing...";
    try {
      var payload = JSON.parse($("kartra-json").value);
      var res = await apiFetch("/api/admin/routes", { method: "PUT", body: JSON.stringify(payload) });
      if (res.ok) {
        funnelStore = payload;
        renderFunnelTable();
        alert("JSON Synced!");
      } else alert("Failed to save via JSON.");
    } catch (e) { alert("Invalid JSON."); }
    btn.disabled = false; btn.textContent = "Force Sync JSON";
  });

  /* ── Boot ────────────────────────────────────────────── */
  window.CUSTOM_DOMAIN = "${customDomain}";
  loadToken(); // Clears legacy token

  (async function initAuth() {
    try {
      // Validate session via protected endpoint silently (avoid apiFetch side effects on 401)
      var res = await fetch("/api/slugs?limit=1", { credentials: "same-origin" });
      if (res.ok) {
        token = "session";
        window.ADMIN_TOKEN = token; // Maintain global exposure for iframes
        showPanel();

        ();

  ;
  });

  /* ── Campaign Workspace Studio Mode ──────────────── */
  var currentSelectedCampaign = null;
  var studioCampaignConfig = null;
  var studioCurrentEditingLanding = null;

  async function selectCampaign(campaignName) {
    var previousSelectedLandingId = studioCurrentEditingLanding ? studioCurrentEditingLanding.id : null;
    currentSelectedCampaign = campaignName;
    document.getElementById("workspace-title").textContent = campaignName;
    document.getElementById("intent-workspace").style.display = "flex";


    } catch(e){}

    // Load campaign V2 config
    try {
      var res = await apiFetch("/api/admin/campaign_v2");
      var data = await res.json();
      var configs = data.campaigns || [];
      studioCampaignConfig = configs.find(function (c) { return c.slug === campaignName; }) || {
        slug: campaignName,
                landings: [],
        mainLandingId: ""
      };
      if (!studioCampaignConfig.landings) studioCampaignConfig.landings = [];

      // Set values
          } catch(e) {
      studioCampaignConfig = {
        slug: campaignName,
                landings: [],
        mainLandingId: ""
      };
    }

    // Set Campaign index metadata settings
    var campIndex = campaigns.find(function (c) { return c.name === campaignName; });
    document.getElementById("studio-campaign-alias").value = campIndex ? (campIndex.alias || "") : "";

    // Set Archive/Restore and Delete states
    var isActive = campIndex ? (campIndex.isActive !== false) : true;
    var archiveBtn = document.getElementById("btn-studio-archive-intent");
    if (archiveBtn) {
      archiveBtn.textContent = isActive ? "Archive" : "Restore";
    }

    // Load Slugs
    var slugsContainer = document.getElementById("studio-slug-list-container");
    slugsContainer.innerHTML = "";
    var newSlugBtn = document.getElementById("btn-studio-new-slug");
    if (newSlugBtn && !newSlugBtn.dataset.bound) {
      newSlugBtn.dataset.bound = "true";
      newSlugBtn.addEventListener("click", function() {
        if (typeof resetForm === "function") resetForm();
        var campSel = document.getElementById("f-campaign");
        if (campSel && studioCampaignConfig && studioCampaignConfig.name) {
           campSel.value = studioCampaignConfig.name;
        }
        var tabs = document.querySelectorAll(".tab-btn");
        for (var i = 0; i < tabs.length; i++) {
          if (tabs[i].dataset.tab === "slugs") tabs[i].click();
        }
      });
    }
    var campSlugs = slugCache.filter(function (s) {
      return s.campaign === campaignName && s.isActive !== false;
    });

    // Populate Default Slug drop down options
    var defSelect = document.getElementById("studio-default-slug-select");
    if (defSelect) {
      defSelect.innerHTML = '<option value="">(first active slug)</option>';
      campSlugs.forEach(function (s) {
        var opt = document.createElement("option");
        opt.value = s.slug;
        opt.textContent = s.slug;
        defSelect.appendChild(opt);
      });
      defSelect.value = campIndex ? (campIndex.defaultSlug || "") : "";
    }

    if (campSlugs.length === 0) {
      slugsContainer.innerHTML = '<p class="hint">No active slugs.</p>';
    } else {
      campSlugs.forEach(function (s) {
        var div = document.createElement("div");
        div.className = "version-item";
        div.innerHTML = '<div><strong>/c/' + esc(s.slug) + '</strong>' +
          '<div style="font-size: 0.7rem; color: var(--text-m);">' + esc([s.defaults?.utm_source, s.defaults?.utm_medium].filter(Boolean).join(" / ")) + '</div></div>';

        var actionsDiv = document.createElement("div");
        actionsDiv.style.display = "flex";
        actionsDiv.style.gap = "0.75rem";
        actionsDiv.style.alignItems = "center";

        var editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "btn-ghost btn-sm";
        editBtn.textContent = "Edit";
        editBtn.style.padding = "0.25rem 0.5rem";
        editBtn.style.fontSize = "0.75rem";
        editBtn.addEventListener("click", function() {
           editSlug(s.slug);
        });
        actionsDiv.appendChild(editBtn);

        var openLink = document.createElement("a");
        openLink.href = "/c/" + esc(s.slug);
        openLink.target = "_blank";
        openLink.style.color = "var(--accent)";
        openLink.style.fontSize = "0.75rem";
        openLink.innerHTML = "open &nearr;";
        actionsDiv.appendChild(openLink);

        div.appendChild(actionsDiv);
        slugsContainer.appendChild(div);
      });
    }

    // Select the landing version to edit (Selection persistence with safe fallbacks)
    var targetLanding = null;
    if (previousSelectedLandingId) {
      targetLanding = studioCampaignConfig.landings.find(function (l) { return l.id === previousSelectedLandingId; });
    }
    if (!targetLanding) {
      // Fallback 1: mainLandingId
      targetLanding = studioCampaignConfig.landings.find(function (l) { return l.id === studioCampaignConfig.mainLandingId; });
    }
    if (!targetLanding) {
      // Fallback 2: first non-archived version
      targetLanding = studioCampaignConfig.landings.find(function (l) { return l.status !== "archived"; });
    }
    if (!targetLanding) {
      // Fallback 3: first available version
      targetLanding = studioCampaignConfig.landings[0];
    }

    if (targetLanding) {
      editStudioLanding(targetLanding.id);
    } else {
      document.getElementById("studio-builder-panel").style.display = "none";
      studioCurrentEditingLanding = null;
    }

    renderStudioVersionsList();
  }

  function renderStudioVersionsList() {
    var container = document.getElementById("studio-version-list");
    container.innerHTML = "";
    if (studioCampaignConfig.landings.length === 0) {
      container.innerHTML = "<p style='color: var(--text-m); font-style: italic;'>No landing versions created yet.</p>";
      return;
    }

    studioCampaignConfig.landings.forEach(function (l) {
      // Fallback/migration mapping for legacy entries
      if (!l.displayName) l.displayName = l.id.replace("version-", "Version ");
      if (!l.status) l.status = "draft";
      if (!l.updatedAt) l.updatedAt = new Date().toISOString();

      var isMain = studioCampaignConfig.mainLandingId === l.id;
      var createdFmt = l.updatedAt ? new Date(l.updatedAt).toLocaleString() : "—";
      var div = document.createElement("div");
      div.className = "version-item";
      div.style = "padding: 0.75rem; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 0.35rem;";

      div.innerHTML =
        '<div style="display: flex; justify-content: space-between; align-items: flex-start;">' +
          '<div>' +
            '<div style="font-weight: bold; font-size: 0.95rem; color: var(--text);">' + esc(l.displayName) + '</div>' +
            '<div style="display: flex; gap: 0.35rem; align-items: center; margin-top: 0.15rem;">' +
              '<span class="badge" style="font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; background: var(--border); text-transform: capitalize;">' + esc(l.status) + '</span>' +
              (isMain ? '<span class="badge" style="font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; background: var(--success); color: white; font-weight: bold;">Main</span>' : '') +
            '</div>' +
            '<div style="font-size: 0.7rem; color: var(--text-m); margin-top: 0.25rem;">Last updated: ' + esc(createdFmt) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="version-actions" style="display: flex; gap: 0.35rem; flex-wrap: wrap; margin-top: 0.25rem;">' +
          '<button class="btn-ghost btn-xs" style="border: 1px solid var(--border);" onclick="editStudioLanding(\\x27' + esc(l.id) + '\\x27)">Edit</button>' +
          '<button class="btn-ghost btn-xs" style="border: 1px solid var(--border);" onclick="setStudioMainLanding(\\x27' + esc(l.id) + '\\x27)" ' + (isMain ? 'disabled' : '') + '>Set as Main</button>' +
          '<button class="btn-ghost btn-xs" style="border: 1px solid var(--border);" onclick="duplicateStudioLanding(\\x27' + esc(l.id) + '\\x27)">Duplicate</button>' +
          '<button class="btn-ghost btn-xs" style="border: 1px solid var(--border);" onclick="toggleArchiveStudioLanding(\\x27' + esc(l.id) + '\\x27)">' + (l.status === "archived" ? "Restore" : "Archive") + '</button>' +
          '<button class="btn-danger btn-xs" onclick="deleteStudioLanding(\\x27' + esc(l.id) + '\\x27)" ' + (isMain ? 'disabled title="Cannot delete main landing version"' : '') + '>Delete</button>' +
        '</div>';
      container.appendChild(div);
    });
  }

  window.setStudioMainLanding = function(id) {
    studioCampaignConfig.mainLandingId = id;
    renderStudioVersionsList();
  };

  window.editStudioLanding = function(id) {
    studioCurrentEditingLanding = studioCampaignConfig.landings.find(function (l) { return l.id === id; });
    if (!studioCurrentEditingLanding) return;

    if (!studioCurrentEditingLanding.displayName) {
      studioCurrentEditingLanding.displayName = studioCurrentEditingLanding.id.replace("version-", "Version ");
    }
    if (!studioCurrentEditingLanding.status) {
      studioCurrentEditingLanding.status = "draft";
    }

    document.getElementById("studio-builder-panel").style.display = "flex";
    document.getElementById("studio-current-edit-version-title").textContent = studioCurrentEditingLanding.displayName;
    document.getElementById("studio-version-display-name").value = studioCurrentEditingLanding.displayName;
    document.getElementById("studio-version-name").value = studioCurrentEditingLanding.id;
    document.getElementById("studio-version-status").value = studioCurrentEditingLanding.status;
    document.getElementById("studio-version-title").value = studioCurrentEditingLanding.headerInfo?.title || "";
    document.getElementById("studio-version-theme").value = studioCurrentEditingLanding.theme || "dark";
    document.getElementById("studio-version-css").value = studioCurrentEditingLanding.customStyleCss || "";
    document.getElementById("studio-version-js").value = studioCurrentEditingLanding.customScript || "";

    // Load Component options into builder selection
    var compSelect = document.getElementById("studio-comp-select");
    compSelect.innerHTML = '<option value="">+ Add Component...</option>';
    componentFamilies.forEach(function (f) {
      if (f.status !== "archived") {
        var opt = document.createElement("option");
        opt.value = f.family_id;
        opt.textContent = f.family_name;
        compSelect.appendChild(opt);
      }
    });

    renderStudioLayoutManager();
  };

  window.duplicateStudioLanding = function(id) {
    var original = studioCampaignConfig.landings.find(function (l) { return l.id === id; });
    if (!original) return;
    var copy = JSON.parse(JSON.stringify(original));
    copy.id = "version-" + Date.now();
    copy.displayName = (original.displayName || original.id.replace("version-", "Version ")) + " (Copy)";
    copy.status = "draft";
    copy.updatedAt = new Date().toISOString();
    studioCampaignConfig.landings.push(copy);
    renderStudioVersionsList();
    editStudioLanding(copy.id);
  };

  window.toggleArchiveStudioLanding = function(id) {
    var landing = studioCampaignConfig.landings.find(function (l) { return l.id === id; });
    if (!landing) return;
    var isMain = studioCampaignConfig.mainLandingId === id;
    if (isMain && landing.status !== "archived") {
      alert("Cannot archive the Main landing version. Set another version as Main first.");
      return;
    }
    landing.status = landing.status === "archived" ? "draft" : "archived";
    renderStudioVersionsList();
    if (studioCurrentEditingLanding?.id === id) {
      editStudioLanding(id);
    }
  };

  window.deleteStudioLanding = function(id) {
    var isMain = studioCampaignConfig.mainLandingId === id;
    if (isMain) {
      alert("Cannot delete the Main landing version. Set another version as Main first.");
      return;
    }
    if (!confirm("Are you sure you want to delete this version?")) return;
    studioCampaignConfig.landings = studioCampaignConfig.landings.filter(function (l) { return l.id !== id; });
    if (studioCurrentEditingLanding?.id === id) {
      document.getElementById("studio-builder-panel").style.display = "none";
      studioCurrentEditingLanding = null;
    }
    renderStudioVersionsList();
  };

  function renderStudioLayoutManager() {
    var container = document.getElementById("studio-layout-container");
    container.innerHTML = "";
    if (!studioCurrentEditingLanding.layout) studioCurrentEditingLanding.layout = [];

    studioCurrentEditingLanding.layout.forEach(function (item, idx) {
      var row = document.createElement("div");
      row.style = "display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: var(--bg); border: 1px solid var(--border); border-radius: 4px; gap: 0.5rem;";

      var labelText = item.type === "component" ? "Component: " + item.id : "Custom HTML";

      row.innerHTML = '<span style="font-size: 0.8rem; font-weight: bold; color: var(--text-m);">' + (idx + 1) + '. ' + esc(labelText) + '</span>' +
        '<div style="display: flex; gap: 0.25rem;">' +
          '<button class="btn-ghost btn-xs" style="padding: 2px 6px;" onclick="moveStudioItem(' + idx + ', -1)">&uarr;</button>' +
          '<button class="btn-ghost btn-xs" style="padding: 2px 6px;" onclick="moveStudioItem(' + idx + ', 1)">&darr;</button>' +
          '<button class="btn-danger btn-xs" onclick="removeStudioItem(' + idx + ')">&times;</button>' +
        '</div>';
      container.appendChild(row);
    });
  }

  window.moveStudioItem = function(idx, dir) {
    var layout = studioCurrentEditingLanding.layout;
    var target = idx + dir;
    if (target >= 0 && target < layout.length) {
      var temp = layout[idx];
      layout[idx] = layout[target];
      layout[target] = temp;
      renderStudioLayoutManager();
    }
  };

  window.removeStudioItem = function(idx) {
    studioCurrentEditingLanding.layout.splice(idx, 1);
    renderStudioLayoutManager();
  };

  function initCampaignWorkspaceListeners() {
    var addVersionBtn = document.getElementById("btn-studio-add-version");
    if (addVersionBtn && !addVersionBtn.dataset.wired) {
      addVersionBtn.dataset.wired = "1";
      addVersionBtn.addEventListener("click", function () {
        var id = "version-" + Date.now();
        var newL = {
          id: id,
          displayName: "Version " + new Date().toLocaleDateString(),
          status: "draft",
          updatedAt: new Date().toISOString(),
          theme: "dark",
          headerInfo: { title: "New Landing Page Version" },
          layout: [],
          components: [],
          customStyleCss: "",
          customScript: ""
        };
        studioCampaignConfig.landings.push(newL);
        if (!studioCampaignConfig.mainLandingId) studioCampaignConfig.mainLandingId = id;
        renderStudioVersionsList();
        editStudioLanding(id);
      });
    }

    var addHtmlBtn = document.getElementById("btn-studio-add-html");
    if (addHtmlBtn && !addHtmlBtn.dataset.wired) {
      addHtmlBtn.dataset.wired = "1";
      addHtmlBtn.addEventListener("click", function () {
        if (!studioCurrentEditingLanding) return;
        studioCurrentEditingLanding.layout.push({
          type: "custom_html",
          id: "html-" + Date.now(),
          name: "Custom HTML",
          content: ""
        });
        renderStudioLayoutManager();
      });
    }

    var compSelect = document.getElementById("studio-comp-select");
    if (compSelect && !compSelect.dataset.wired) {
      compSelect.dataset.wired = "1";
      compSelect.addEventListener("change", function (e) {
        if (!studioCurrentEditingLanding || !e.target.value) return;
        studioCurrentEditingLanding.layout.push({
          type: "component",
          id: e.target.value,
          name: e.target.value
        });
        e.target.value = "";
        renderStudioLayoutManager();
      });
    }

    // Dynamic field sync
    var fields = [
      { id: "studio-version-display-name", prop: "displayName", cb: function() {
          var titleEl = document.getElementById("studio-current-edit-version-title");
          if (titleEl && studioCurrentEditingLanding) {
            titleEl.textContent = studioCurrentEditingLanding.displayName;
          }
          renderStudioVersionsList();
        }
      },
      { id: "studio-version-status", prop: "status", cb: renderStudioVersionsList },
      { id: "studio-version-name", prop: "id", cb: renderStudioVersionsList },
      { id: "studio-version-title", prop: "title", nested: "headerInfo", cb: renderStudioVersionsList },
      { id: "studio-version-theme", prop: "theme" },
      { id: "studio-version-css", prop: "customStyleCss" },
      { id: "studio-version-js", prop: "customScript" }
    ];

    fields.forEach(function (f) {
      var el = document.getElementById(f.id);
      if (el && !el.dataset.wired) {
        el.dataset.wired = "1";
        el.addEventListener("input", function (e) {
          if (!studioCurrentEditingLanding) return;
          if (f.nested) {
            if (!studioCurrentEditingLanding[f.nested]) studioCurrentEditingLanding[f.nested] = {};
            studioCurrentEditingLanding[f.nested][f.prop] = e.target.value;
          } else {
            studioCurrentEditingLanding[f.prop] = e.target.value;
          }
          if (f.cb) f.cb();
        });
        el.addEventListener("change", function (e) {
          if (!studioCurrentEditingLanding) return;
          if (f.nested) {
            if (!studioCurrentEditingLanding[f.nested]) studioCurrentEditingLanding[f.nested] = {};
            studioCurrentEditingLanding[f.nested][f.prop] = e.target.value;
          } else {
            studioCurrentEditingLanding[f.prop] = e.target.value;
          }
          if (f.cb) f.cb();
        });
      }
    });

    var newIntentBtn = document.getElementById("btn-studio-new-intent");
    if (newIntentBtn && !newIntentBtn.dataset.wired) {
      newIntentBtn.dataset.wired = "1";
      newIntentBtn.addEventListener("click", async function () {
        var name = prompt("Enter new Intent / Campaign name (lowercase, numbers, hyphens):");
        if (!name) return;
        name = name.trim().toLowerCase();
        if (name.length > 1 && !/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(name)) {
          alert("Invalid name. Lowercase letters, numbers, hyphens (no leading/trailing hyphen).");
          return;
        }
        try {
          var createBody = { name: name, alias: name };
          if (selectedWorkspace) createBody.workspace = selectedWorkspace;
          var res = await apiFetch("/api/campaign", {
            method: "POST", body: JSON.stringify(createBody)
          });
          var data = await res.json();
          if (!res.ok) { alert(data.error || "Failed."); return; }

          var newCamp = data.campaign || { name: name, alias: name, isActive: true, createdAt: new Date().toISOString() };
          campaigns.push(newCamp);
          campaigns.sort(function (a, b) { return a.name.localeCompare(b.name); });
          populateCampaignSelect();
          renderCampaignList();
          selectCampaign(name);
        } catch (e) {
          alert("Error: " + e.toString());
        }
      });
    }

    var archiveIntentBtn = document.getElementById("btn-studio-archive-intent");
    if (archiveIntentBtn && !archiveIntentBtn.dataset.wired) {
      archiveIntentBtn.dataset.wired = "1";
      archiveIntentBtn.addEventListener("click", async function () {
        if (!currentSelectedCampaign) return;
        var campIndex = campaigns.find(function (c) { return c.name === currentSelectedCampaign; });
        var currentActiveState = campIndex ? (campIndex.isActive !== false) : true;
        var newActiveState = !currentActiveState;

        archiveIntentBtn.disabled = true;
        archiveIntentBtn.textContent = newActiveState ? "Restoring..." : "Archiving...";
        try {
          await setCampaignActive(currentSelectedCampaign, newActiveState);
          await loadCampaignList();
          await selectCampaign(currentSelectedCampaign);
        } catch(e) {
          alert("Failed: " + e.toString());
        } finally {
          archiveIntentBtn.disabled = false;
        }
      });
    }

    var deleteIntentBtn = document.getElementById("btn-studio-delete-intent");
    if (deleteIntentBtn && !deleteIntentBtn.dataset.wired) {
      deleteIntentBtn.dataset.wired = "1";
      deleteIntentBtn.addEventListener("click", async function () {
        if (!currentSelectedCampaign) return;
        if (!confirm("Are you sure you want to delete intent: " + currentSelectedCampaign + "?")) return;

        deleteIntentBtn.disabled = true;
        deleteIntentBtn.textContent = "Deleting...";
        try {
          await deleteCampaign(currentSelectedCampaign);
          document.getElementById("intent-workspace").style.display = "none";
          currentSelectedCampaign = null;
          await loadCampaignList();
        } catch(e) {
          alert("Failed to delete: " + e.toString());
        } finally {
          deleteIntentBtn.disabled = false;
        }
      });
    }

    var saveIntentBtn = document.getElementById("btn-studio-save-intent");
    if (saveIntentBtn && !saveIntentBtn.dataset.wired) {
      saveIntentBtn.dataset.wired = "1";
      saveIntentBtn.addEventListener("click", async function () {
        var alias = document.getElementById("studio-campaign-alias").value.trim();
                var defaultSlug = document.getElementById("studio-default-slug-select").value || null;


        try {
          saveIntentBtn.disabled = true;
          saveIntentBtn.textContent = "Saving...";

          // 1. Save Patch Campaign Index Metadata (Alias & defaultSlug)
          var patchRes = await apiFetch("/api/campaign/" + encodeURIComponent(currentSelectedCampaign), {
            method: "PATCH",
            body: JSON.stringify({ alias: alias || null, defaultSlug: defaultSlug })
          });

          // 2. Save V2 Configuration (Journey) - Optional Binding
          var v2Ok = true;
          var v2ErrMsg = "";

          if (studioCampaignConfig.slug && studioCampaignConfig.journeyId) {
            var v2Res = await apiFetch("/api/admin/campaign_v2", {
              method: "POST",
              body: JSON.stringify(studioCampaignConfig)
            });
            v2Ok = v2Res.ok;
            if (!v2Res.ok) {
              var err = await v2Res.json();
              v2ErrMsg = err.error || "Unknown error";
            }
          }

          if (patchRes.ok && v2Ok) {
            alert("Intent Settings Saved Successfully!");
            await loadCampaignList();
          } else if (patchRes.ok && !v2Ok) {
            alert("Intent metadata saved, but routing assignment failed: " + v2ErrMsg);
            await loadCampaignList();
          } else {
            alert("Error saving Intent Settings.");
          }
        } catch(e) {
          alert("Failed to save: " + e.toString());
        } finally {
          saveIntentBtn.disabled = false;
          saveIntentBtn.textContent = "Save Intent";
        }
      });
    }

    var saveVersionBtn = document.getElementById("btn-studio-save-version");
    if (saveVersionBtn && !saveVersionBtn.dataset.wired) {
      saveVersionBtn.dataset.wired = "1";
      saveVersionBtn.addEventListener("click", async function () {
        try {
          saveVersionBtn.disabled = true;
          saveVersionBtn.textContent = "Saving Version...";

          if (studioCurrentEditingLanding) {
            studioCurrentEditingLanding.updatedAt = new Date().toISOString();
          }

          // Save V2 Configuration (Landings layout updates)
          var v2Res = await apiFetch("/api/admin/campaign_v2", {
            method: "POST",
            body: JSON.stringify(studioCampaignConfig)
          });

          if (v2Res.ok) {
            alert("Landing Version Saved Successfully!");
            await loadCampaignList();
            renderStudioVersionsList();
          } else {
            var err = await v2Res.json();
            alert("Error saving: " + (err.error || "Unknown error"));
          }
        } catch(e) {
          alert("Failed to save version: " + e.toString());
        } finally {
          saveVersionBtn.disabled = false;
          saveVersionBtn.textContent = "Save Version";
        }
      });
    }
  }

  // Globally expose for inline event binding support
  window.selectCampaign = selectCampaign;

}());

  // 2. Mobile Drawer Logic (Tap to toggle header with dynamic height calculation)
  var drawerHandle = document.getElementById("mobile-drawer-handle");
  var mainTopbar = document.getElementById("main-topbar");

  if (drawerHandle && mainTopbar) {
    drawerHandle.addEventListener("click", function(e) {
      e.preventDefault();
      if (window.innerWidth > 800) return;

      var isCol = mainTopbar.classList.contains("collapsed");
      if (!isCol) {
        var h = mainTopbar.offsetHeight;
        mainTopbar.style.marginTop = "-" + h + "px";
        mainTopbar.classList.add("collapsed");
      } else {
        mainTopbar.style.marginTop = "0px";
        mainTopbar.classList.remove("collapsed");
      }
    });
  }

</script>
    <script>
          </script>
  </body>
</html>`;
}

/* ── Admin CSS ──────────────────────────────────────────────────── */
const ADMIN_CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#F4F4F2;--surface:#FFFFFF;--text:#111111;--text-m:#666666;
  --border:#E0E0DC;--accent:#111111;--accent-t:#FFFFFF;
  --danger:#C0392B;--danger-t:#FFFFFF;--success:#2D7D4F;
  --radius:.75rem;--radius-sm:.5rem;
  --font:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,Arial,sans-serif;
  --shadow:0 1px 3px rgba(0,0,0,.08),0 1px 2px rgba(0,0,0,.04);
}
@media(prefers-color-scheme:dark){
  :root{
    --bg:#111111;--surface:#1C1C1C;--text:#F0F0EE;--text-m:#888888;
    --border:#2E2E2E;--accent:#F0F0EE;--accent-t:#111111;
    --shadow:0 1px 3px rgba(0,0,0,.4);
  }
}
html,body{height:100%}
body{background:var(--bg);color:var(--text);font-family:var(--font);font-size:.9rem;-webkit-font-smoothing:antialiased}
.hidden{display:none!important;height:0!important;overflow:hidden!important}
.screen{min-height:100dvh;display:flex;flex-direction:column}
#panel.screen{min-height:auto}

/* ── Gate ─────────────────────────────────────────── */
.material-symbols-outlined {
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' -25, 'opsz' 24;
  vertical-align: middle; line-height: 1;
}
#sw-display-wrap{user-select:none}
#gate{display:flex;align-items:center;justify-content:center;padding:2rem 1.25rem}

/* ── Topbar ───────────────────────────────────────── */
.topbar{display:flex;align-items:center;justify-content:space-between;padding:.875rem 1.5rem;border-bottom:1px solid var(--border);background:var(--surface);gap:.75rem;min-height:64px}
.topbar-title{font-weight:600;font-size:.9375rem;flex-shrink:0}
.sw-toolbar{display:flex;align-items:center;gap:.35rem;margin:auto;}
.sw-display-oval{
  display:flex;align-items:center;gap:0.1rem;
  padding:.4rem 1rem;border:1.5px solid var(--border);border-radius:28px;
  cursor:pointer;user-select:none;transition:all .2s;
  color:var(--text-m);height:34px;
}
.sw-display-oval:hover{background:var(--bg);color:var(--text)}
.sw-display-oval.running{color:rgba(179, 34, 34, 0.75);border-color:rgba(179, 34, 34, 0.3)}
.sw-display-oval.running:hover{color:var(--text)}
.sw-time{font-variant-numeric:tabular-nums;font-size:.9rem;font-weight:600;min-width:4.5rem;letter-spacing:.02em;font-family:ui-monospace,monospace;pointer-events:none}
.sw-icon{font-size:20px;opacity:.8;pointer-events:none;padding-top:1.2px}
.ws-selector{display:flex;align-items:center;gap:.5rem;flex-shrink:0}
/* Prompt 68 — always hide workspace selector in topbar */
.topbar>#ws-selector{display:none!important}
.ws-label{font-size:.75rem;font-weight:500;color:var(--text-m);margin:0;white-space:nowrap}
.ws-select{width:auto;min-width:110px;padding:.3rem .6rem;font-size:.8rem;margin:0}
.btn-lab-link,#btn-sw-reset{color:var(--text-m)!important}
.btn-lab-link:hover,#btn-sw-reset:hover{color:var(--text)!important}

/* ── Tab bar ──────────────────────────────────────── */
.tab-bar{display:flex;gap:0;border-bottom:1px solid var(--border);background:var(--surface);padding:0 1.5rem;flex-wrap: wrap;}
.tab-btn{padding:.75rem 1rem;background:transparent;color:var(--text-m);border:none;border-bottom:2px solid transparent;font-family:var(--font);font-size:.875rem;font-weight:500;cursor:pointer;transition:color .12s,border-color .12s;margin-bottom:-1px;text-wrap-mode: nowrap;}
.tab-btn:hover{color:var(--text)}
.tab-btn.active{color:var(--text);border-bottom-color:var(--accent)}

/* ── Layout ───────────────────────────────────────── */
.layout{display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;padding:1.25rem;max-width:1200px;margin:0 auto}
@media(max-width:700px){.layout{grid-template-columns:1fr}}
.layout-single{padding:1.25rem;max-width:780px;margin:0 auto}

/* ── Pulse Layout Overhaul ───────────────────────── */
.pulse-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
  padding: 1.25rem;
  max-width: 1200px;
  margin: 0 auto;
}
.pulse-section-a, .pulse-section-d {
  grid-column: 1 / -1;
}
@media(max-width: 900px) {
  .pulse-grid {
    grid-template-columns: 1fr;
  }
}

/* ── Paths, Landings, Verify Grid Overhauls ──────── */
.paths-grid, .landings-grid, .verify-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
  padding: 1.25rem;
  max-width: 1200px;
  margin: 0 auto;
}
.paths-section-c {
  grid-column: 1 / -1;
}
@media(max-width: 900px) {
  .paths-grid, .landings-grid, .verify-grid {
    grid-template-columns: 1fr;
  }
}

/* ── Timer Selection Fix ──────────────────────────── */
.sw-time::selection { background: transparent; }
.sw-time::-moz-selection { background: transparent; }

/* ── Card ─────────────────────────────────────────── */
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:1.5rem;box-shadow:var(--shadow);position:relative}
.card.narrow{max-width:380px;width:100%}
.card-title{font-size:1rem;font-weight:600;margin-bottom:1.25rem}
.dash-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;margin-bottom:1.25rem}
.dash-card{background:var(--bg);padding:1rem;border-radius:10px;border:1px solid var(--border);display:flex;flex-direction:column;position:relative;overflow:hidden}
.dash-card-label{font-size:.7rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.025em;margin-bottom:0.25rem}
.dash-card-value{font-size:1.5rem;font-weight:700;color:var(--text);letter-spacing:-0.025em}
.dash-sparkline{position:absolute;bottom:0;left:0;right:0;width:100%;height:40px;opacity:0.6;pointer-events:none}
.dash-chart-container{margin-bottom:1.5rem;height:240px;width:100%;background:var(--bg);border-radius:10px;border:1px solid var(--border);padding:1rem;box-sizing:border-box}
.pagination{display:flex;justify-content:center;align-items:center;gap:0.75rem;margin-top:1rem}
.btn-exp-toggle{display:block;width:100%;padding:0.5rem;text-align:center;font-size:0.8rem;color:var(--accent);background:none;border:none;cursor:pointer;font-weight:600}
.btn-exp-toggle:hover{text-decoration:underline}
.hidden-exp{display:none}
.date-input-group{display:flex;gap:0.35rem;align-items:center;margin-left:0.55rem;border-left:1px solid var(--border);padding-left:0.5rem}
.date-input{font-size:.75rem;padding:0.2rem 0.4rem;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text);cursor:pointer}

/* ── Form elements ────────────────────────────────── */
label{display:block;font-size:.8125rem;font-weight:500;color:var(--text-m);margin-bottom:.3rem;margin-top:.875rem}
label:first-of-type{margin-top:0}
.req{color:var(--danger)}
input[type=text],input[type=url],input[type=password],input[type=search],input[type=number],select{
  width:100%;padding:.625rem .875rem;background:var(--bg);color:var(--text);
  border:1px solid var(--border);border-radius:var(--radius-sm);
  font-family:var(--font);font-size:.875rem;outline:none;transition:border-color .12s;
  -webkit-appearance:none;appearance:none;
}
input:focus,select:focus{border-color:var(--accent)}
select{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23888'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right .75rem center;padding-right:2rem}
.input-row{display:flex;align-items:center;border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden}
.input-row input{border:none;border-radius:0;flex:1;min-width:0}
.input-prefix{padding:.625rem .5rem .625rem .875rem;font-size:.75rem;color:var(--text-m);white-space:nowrap;background:var(--bg);border-right:1px solid var(--border);user-select:none}
.hint{font-size:.8125rem;color:var(--text-m);margin-bottom:1.25rem}
.hint-inline{font-size:.75rem;color:var(--text-m);font-weight:400}
.field-hint{font-size:.75rem;color:var(--text-m);margin-top:.3rem;font-family:ui-monospace,'SF Mono',monospace}

/* ── Campaign confirmation shake ──────────────────── */
@keyframes shake{
  0%,100%{transform:translateX(0)}
  20%{transform:translateX(-5px)}
  40%{transform:translateX(5px)}
  60%{transform:translateX(-3px)}
  80%{transform:translateX(3px)}
}
.shake{animation:shake .35s ease-in-out}
select.field-error{border-color:var(--danger)!important;box-shadow:0 0 0 2px rgba(192,57,43,.12)}

/* ── New campaign inline ──────────────────────────── */
.new-campaign-box{margin-top:.5rem;border:1px solid var(--border);border-radius:var(--radius-sm);padding:.75rem .875rem;background:var(--bg)}
.inline-row{display:flex;gap:.5rem;align-items:center}
.inline-row input{flex:1;min-width:0}

/* ── Overrides section ────────────────────────────── */
.overrides-section{margin-top:1rem;border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden}
.overrides-section summary{padding:.625rem .875rem;font-size:.8125rem;font-weight:500;cursor:pointer;list-style:none;user-select:none;background:var(--bg)}
.overrides-section summary::-webkit-details-marker{display:none}
.overrides-grid{padding:.75rem .875rem;display:flex;flex-direction:column}
.custom-utm-box{border:1px solid var(--border);border-radius:var(--radius-sm);padding:.875rem;margin-top:.625rem;background:var(--bg)}
.custom-utm-box label:first-child{margin-top:0}

/* ── Links editor ─────────────────────────────────── */
.links-section{margin-top:1rem;border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden}
.links-section summary{padding:.625rem .875rem;font-size:.8125rem;font-weight:500;cursor:pointer;list-style:none;user-select:none;background:var(--bg)}
.links-section summary::-webkit-details-marker{display:none}
.links-section > *:not(summary){padding:.5rem .875rem}
.links-editor-wrap{display:flex;flex-direction:column;gap:.5rem;margin-top:.25rem}
.link-row{border:1px solid var(--border);border-radius:var(--radius-sm);padding:.625rem;background:var(--surface);display:flex;flex-direction:column;gap:.375rem}
.link-row-fields{display:flex;gap:.375rem;flex-wrap:wrap}
.link-row-fields input{flex:1;min-width:120px}
.link-row-opts{display:flex;align-items:center;gap:.75rem;flex-wrap:wrap}
.checkbox-label{display:flex;align-items:center;gap:.3rem;font-size:.8125rem;color:var(--text-m);cursor:pointer;font-weight:400;margin-top:0}
.checkbox-label input{width:auto;margin:0;padding:0}
.link-remove{margin-left:auto}

/* ── Buttons ──────────────────────────────────────── */
.form-actions{margin-top:1.25rem;display:flex;gap:.625rem}
.btn-primary{padding:.75rem 1.25rem;background:var(--accent);color:var(--accent-t);border:none;border-radius:28px;font-family:var(--font);font-size:.875rem;font-weight:500;cursor:pointer;transition:opacity .12s;flex:1}
.btn-primary:hover{opacity:.85}
.btn-primary:disabled{opacity:.5;cursor:not-allowed}
.btn-ghost{padding:.625rem 1rem;background:transparent;color:var(--text);border:1px solid var(--border);border-radius:28px;font-family:var(--font);font-size:.875rem;font-weight:500;cursor:pointer;transition:background .12s}
.btn-ghost:hover{background:var(--border);color:var(--text)}
.btn-sm{padding:.375rem .75rem;font-size:.8125rem}
.btn-xs{padding:.25rem .625rem;font-size:.75rem}
.btn-danger{padding:.25rem .625rem;background:transparent;color:var(--danger);border:1px solid var(--danger);border-radius:28px;font-family:var(--font);font-size:.75rem;font-weight:500;cursor:pointer;transition:background .12s,color .12s}
.btn-danger:hover{background:var(--danger);color:var(--danger-t)}
.btn-danger:disabled{opacity:.4;cursor:not-allowed;pointer-events:none}

/* ── Generated link ───────────────────────────────── */
.generated-label{font-size:.75rem;font-weight:500;color:var(--text-m);margin-top:1.25rem;margin-bottom:.375rem}
.generated-row{display:flex;align-items:center;gap:.625rem;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:.625rem .875rem}
.generated-url{flex:1;font-size:.8125rem;font-family:ui-monospace,'SF Mono','Fira Code',monospace;word-break:break-all;color:var(--accent)}

/* ── Errors / success ─────────────────────────────── */
.error{margin-top:.75rem;font-size:.8125rem;color:var(--danger)}
.error-text{color:var(--danger)}
.success{margin-top:.75rem;font-size:.8125rem;color:var(--success)}

/* ── List card ────────────────────────────────────── */
.list-header{display:flex;flex-direction:column;gap:.625rem;margin-bottom:1rem}
.list-header .card-title{margin-bottom:0}
.filter-row{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap}
.filter-row select{flex:1;font-size:.8125rem;padding:.5rem .75rem;min-width: 49px;}
.filter-row .btn-ghost{flex-shrink:0;white-space:nowrap}
.toggle-label{display:flex;align-items:center;gap:.5rem;font-size:.875rem;cursor:pointer;font-weight:400;margin-top:0}
.toggle-label input{width:auto;margin:0;padding:0}

/* ── Slug items ───────────────────────────────────── */
.slug-item{display:flex;align-items:center;justify-content:space-between;padding:.75rem 0;border-bottom:1px solid var(--border);gap:.5rem}
.slug-item:last-child{border-bottom:none}
.slug-item.slug-inactive{opacity:.55}
.slug-info{display:flex;flex-direction:column;gap:.2rem;min-width:0}
a.slug-name{font-size:.875rem;font-weight:500;word-break:break-all;color:var(--accent);text-decoration:none}
a.slug-name:hover{text-decoration:underline}
.slug-meta{font-size:.75rem;color:var(--text-m)}
.slug-actions{display:flex;gap:.375rem;flex-shrink:0;flex-wrap:wrap}

/* ── Campaign items ───────────────────────────────── */
.campaign-item{display:flex;align-items:center;justify-content:space-between;padding:.75rem 0;border-bottom:1px solid var(--border);gap:.5rem}
.campaign-item:last-child{border-bottom:none}
.campaign-info{display:flex;flex-direction:column;gap:.2rem;min-width:0}
.campaign-name{font-size:.875rem;font-weight:500;word-break:break-all;color:inherit;text-decoration:none}
.campaign-name:hover{text-decoration:underline}
.campaign-meta{font-size:.75rem;color:var(--text-m)}
.campaign-actions{display:flex;gap:.375rem;flex-shrink:0}

/* ── Badges ───────────────────────────────────────── */
.badge-inactive{display:inline-block;background:var(--border);color:var(--text-m);font-size:.7rem;padding:.1rem .375rem;border-radius:.25rem;vertical-align:middle}

/* ── Alias/landing anchor links (styled like btn-ghost btn-xs) ── */
a.slug-alias-link,a.camp-link{
  display:inline-flex;align-items:center;
  font-size:.75rem;font-weight:500;font-family:var(--font);
  padding:.2rem .55rem;border:1px solid var(--border);border-radius:var(--radius-sm);
  color:var(--text);text-decoration:none;cursor:pointer;
  background:transparent;transition:background .1s ease,border-color .1s ease;
  flex-shrink:0;white-space:nowrap
}
a.slug-alias-link:hover,a.camp-link:hover{background:var(--border);border-color:var(--text-m)}

/* ── Overrides expanded ───────────────────────────── */
.override-row{margin-bottom:.875rem;padding-bottom:.875rem;border-bottom:1px solid var(--border)}
.override-row:last-child{margin-bottom:0;padding-bottom:0;border-bottom:none}
.override-dest-label{display:block;font-size:.8125rem;font-weight:500;color:var(--text-m);margin-bottom:.3rem}
.override-fields{display:flex;flex-wrap:wrap;gap:.375rem;align-items:center}
.override-url{flex:1!important;min-width:160px!important;width:auto!important}
.override-order{width:5.5rem!important;flex:none!important}

/* ── Textarea ─────────────────────────────────────── */
textarea{
  width:100%;padding:.625rem .875rem;background:var(--bg);color:var(--text);
  border:1px solid var(--border);border-radius:var(--radius-sm);
  font-family:ui-monospace,'SF Mono','Fira Code',monospace;font-size:.8125rem;
  outline:none;resize:vertical;transition:border-color .12s;
}
textarea:focus{border-color:var(--accent)}

/* ── Base links editor (Hub Config) ──────────────── */
.base-links-section{margin-top:1rem;border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden}
.base-links-section summary{padding:.625rem .875rem;font-size:.8125rem;font-weight:500;cursor:pointer;list-style:none;user-select:none;background:var(--bg)}
.base-links-section summary::-webkit-details-marker{display:none}
.base-links-grid{padding:.75rem .875rem;display:flex;flex-direction:column}

/* ── Landing customization (slug form) ───────────── */
.landing-section{margin-top:1rem;border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden}
.landing-section summary{padding:.625rem .875rem;font-size:.8125rem;font-weight:500;cursor:pointer;list-style:none;user-select:none;background:var(--bg)}
.landing-section summary::-webkit-details-marker{display:none}
.landing-fields{padding:.75rem .875rem}
.landing-fields label{margin-top:.625rem}
.landing-fields label:first-child{margin-top:0}

/* ── Empty state ──────────────────────────────────── */
.empty-state{font-size:.875rem;color:var(--text-m);text-align:center;padding:1.5rem 0}

/* ── Alias status ─────────────────────────────────── */
.alias-ok{color:var(--success)!important}
.alias-err{color:var(--danger)!important}

/* ── Campaign alias edit row ──────────────────────── */
.campaign-alias-edit{margin-top:.25rem}
.campaign-alias-edit .inline-row input{min-width:120px}

/* ── Inline alias row (campaign create box) ───────── */
.inline-alias-row{margin-top:.375rem}
.inline-alias-row input{width:100%;font-size:.8125rem;padding:.5rem .75rem;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:var(--radius-sm);outline:none;font-family:var(--font)}
.inline-alias-row input:focus{border-color:var(--accent)}

/* ── Campaign meta code ────────────────────────────── */
.campaign-meta code{font-family:ui-monospace,'SF Mono',monospace;font-size:.75rem;background:var(--bg);border:1px solid var(--border);border-radius:.25rem;padding:.05rem .3rem}

/* ── Routing tab ───────────────────────────────────── */
.routing-note{font-size:.8125rem;color:var(--danger);margin-bottom:1rem;font-weight:500}
.compile-actions{display:flex;gap:.75rem;margin-bottom:1rem;flex-wrap:wrap}
.compile-result-box{border:1px solid var(--border);border-radius:var(--radius-sm);padding:1rem;background:var(--bg);margin-top:.75rem}
.compile-table{width:100%;border-collapse:collapse;font-size:.8125rem}
.compile-table td{padding:.3rem .5rem;border-bottom:1px solid var(--border)}
.compile-table td:first-child{color:var(--text-m);width:50%}
.compile-table tr:last-child td{border-bottom:none}
.compile-active-note{margin-top:.75rem;font-size:.8125rem;color:var(--success);font-weight:500}
/* ── A/B routing rows ──────────────────────────────────────────────── */
.ab-variant-row{display:flex;gap:.375rem;align-items:center;margin-bottom:.375rem}
.ab-variant-row .ab-slug-input{flex:1 1 160px;min-width:100px}
.ab-variant-row .ab-weight-input{width:72px;flex:0 0 72px;text-align:right}

/* ── Analytics tab ──────────────────────────────────────────────── */
/* ── Analytics tab ──────────────────────────────────────────────── */
.analytics-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem;margin-bottom:.5rem}
.analytics-section-title{font-size:.75rem;font-weight:600;color:var(--text-m);text-transform:uppercase;letter-spacing:.05em;margin:1.25rem 0 .5rem 0}
.analytics-section-title:first-child{margin-top:0}
.analytics-table{width:100%;border-collapse:collapse;font-size:.8125rem;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden}
.analytics-table-full{min-width:600px}
.analytics-table th{text-align:left;padding:.4rem .6rem;font-size:.7rem;font-weight:600;color:var(--text-m);background:var(--bg);border-bottom:1px solid var(--border)}
.analytics-table td{padding:.4rem .6rem;border-bottom:1px solid var(--border);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px}
.analytics-table tr:last-child td{border-bottom:none}
.analytics-table td:last-child{text-align:right;font-weight:600;color:var(--text)}
.analytics-table td:first-child{font-family:ui-monospace,'SF Mono',monospace;font-size:.78rem}
.analytics-table-full td:first-child{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;font-size:.8125rem}

/* ── Dashboard V2 ── */
.dash-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem;gap:1rem;flex-wrap:wrap}
.filter-bar{display:flex;background:var(--bg);padding:.25rem;border-radius:var(--radius-sm);border:1px solid var(--border);gap:.125rem}
.filter-btn{padding:.375rem .875rem;border:none;background:transparent;color:var(--text-m);font-size:.75rem;font-weight:600;border-radius:calc(var(--radius-sm) - 2px);cursor:pointer;transition:all .12s}
.filter-btn:hover{color:var(--text)}
.filter-btn.active{background:var(--surface);color:var(--text);box-shadow:var(--shadow)}

.dash-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;margin-bottom:1.5rem}
.dash-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:1.125rem;display:flex;flex-direction:column;gap:.5rem;position:relative;overflow:hidden}
.dash-card-label{font-size:.7rem;font-weight:600;color:var(--text-m);text-transform:uppercase;letter-spacing:.02em}
.dash-card-value{font-size:1.5rem;font-weight:700;color:var(--text);line-height:1.1}
.dash-header-meta{position:absolute;top:.5rem;right:.75rem;font-size:0.65rem;color:var(--text-m);font-weight:600;font-family:ui-monospace,monospace}
.dash-chart-container{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:1rem;margin-bottom:1rem;min-height:200px}
.dash-sparkline{position:absolute;bottom:0;left:0;right:0;height:40px;opacity:.15;pointer-events:none}
.dash-sparkline path{fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}

.mini-pagination{display:flex;align-items:center;gap:.5rem;font-size:.7rem;color:var(--text-m);font-weight:600}
.mini-btn{width:20px;height:20px;border-radius:50%;border:1px solid var(--border);background:var(--surface);color:var(--text);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:.8rem;line-height:1;padding:0;transition:all .2s;vertical-align:middle}
.mini-btn:hover:not(:disabled){border-color:var(--accent);color:var(--accent)}
.mini-btn:disabled{opacity:.2;cursor:not-allowed}

.exp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem;margin-bottom:1.5rem}
.exp-card{border:1px solid var(--border);border-radius:var(--radius);padding:1rem;background:var(--surface);display:flex;flex-direction:column;gap:.75rem}
.btn-exp-toggle{background:var(--bg);border:1px solid var(--border);color:var(--accent);font-size:.7rem;font-weight:600;padding:.4rem .8rem;border-radius:20px;cursor:pointer;display:block;margin:.5rem auto 0;transition:all .2s}
.btn-exp-toggle:hover{border-color:var(--accent);background:rgba(59,130,246,.05)}

/* ── Mobile & Responsive Styling ── */
@media(max-width: 800px) {
  .tab-bar {
    display: flex;
    flex-wrap: nowrap;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    padding: 0 1rem;
    border-bottom: 1px solid var(--border);
  }
  .tab-btn {
    flex: 0 0 auto;
    padding: 0.6rem 0.8rem;
  }
  .topbar {
    padding: 0.5rem 1rem;
    flex-wrap: wrap;
    gap: 0.5rem;
    min-height: auto;
  }
  .topbar-title {
    font-size: 0.85rem;
    width: 100%;
    text-align: center;
  }
  .sw-toolbar {
    width: 100%;
    justify-content: center;
    margin-top: 0.25rem;
  }
  .btn-lab-link {
    padding: 0.4em 0.8em !important;
    font-size: 0.75rem !important;
  }
  .ws-selector {
    display: none !important;
  }
}

/* --- Mobile Fixes --- */
@media (max-width: 800px) {
  /* 2. Mobile Viewport & Inputs (prevent auto-zoom) */
  input, select, textarea {
    font-size: 16px !important;
  }

  .desktop-only { display: none !important; }
  .mobile-only { display: inline-block !important; }
  .date-input-group { flex-wrap: wrap; gap: 0.25rem; }

  /* 6. Campaign Links Mobile Stack */
  .version-item {
    flex-direction: column;
    align-items: flex-start !important;
    gap: 0.75rem;
  }
  .version-item > div:first-child {
    width: 100%;
    overflow-wrap: anywhere;
    word-break: normal;
  }
  .version-item > div:last-child {
    width: 100%;
    justify-content: flex-start;
  }

  .slug-item {
    flex-direction: column;
    align-items: flex-start !important;
  }
  .slug-info {
    width: 100%;
  }
  a.slug-name {
    word-break: normal;
    overflow-wrap: anywhere;
    white-space: normal;
  }
  .slug-actions {
    width: 100%;
    justify-content: flex-start;
    flex-wrap: wrap;
    margin-top: 0.5rem;
  }

  /* 7. Health Manual Validation overflow */
  #manual-result {
    max-width: 100%;
    overflow-x: auto;
  }
  .analytics-table {
    width: 100%;
    max-width: none !important;
  }
  pre, code {
    max-width: 100%;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-word;
  }

  /* 4. Intent Workspace Mobile Grid */
  #tab-campaigns .layout {
    grid-template-columns: 1fr !important;
  }
  #intent-workspace {
    width: 100%;
    min-width: 0;
    max-width: 100%;
  }
  #intent-workspace > div {
    min-width: 0;
  }
  .card {
    min-width: 0;
    max-width: 100%;
    overflow-x: hidden;
  }

  /* 5. Tab bar scrolling */
  .tab-bar {
    display: flex;
    flex-wrap: nowrap !important;
    overflow-x: auto;
    overflow-y: hidden;
    touch-action: pan-x;
    -webkit-overflow-scrolling: touch;
    white-space: nowrap;
    scrollbar-width: none;
  }
  .tab-bar::-webkit-scrollbar {
    display: none;
  }
}

/* 3. Pulse Responsive Overflow */
.dash-chart-container {
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
}
.dash-chart-container canvas {
  max-width: 100% !important;
  height: auto !important;
}
.pulse-section-b, .pulse-section-c, .pulse-section-d, .pulse-section-e, .pulse-section-f {
  max-width: 100%;
  overflow-x: auto;
}

/* 6. Header Collapse setup */
.header-container {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--bg);
}
.topbar {
  transition: margin-top 0.3s ease, opacity 0.3s ease;
  transform-origin: top;
}
.topbar.collapsed {

  opacity: 0;
  pointer-events: none;
}
/* Add a small handle to tab-bar for visibility */
@media (max-width: 800px) {
  .header-container::after {
    content: "";
    display: block;
    position: absolute;
    bottom: -8px;
    left: 50%;
    transform: translateX(-50%);
    width: 40px;
    height: 4px;
    background: var(--border);
    border-radius: 4px;
    opacity: 0.5;
  }
}
`;





