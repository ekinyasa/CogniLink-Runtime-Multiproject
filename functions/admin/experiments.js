/**
 * functions/admin/experiments.js — Experiment Analytics Dashboard.
 *
 * Route: GET /admin/experiments
 *
 * Standalone client-rendered dashboard for A/B experiment analytics.
 * Auth is client-side (localStorage "admin_token"), same pattern as /admin.
 *
 * Layout (four layers):
 *   1 — Status card  : instant experiment state (EARLY / RUNNING / DECIDED)
 *   2 — Variant table: per-variant performance comparison
 *   3 — Bar chart    : conversion rate + CTR by variant (Chart.js)
 *   4 — Advanced     : expandable breakdowns (placeholder for future metrics)
 *
 * Data source:  GET /api/experiments?alias=<alias>   (Bearer token)
 * Experiments:  GET /api/admin/experiments           (Bearer token)
 * Campaigns:    GET /api/admin/campaigns             (Bearer token — create form campaigns)
 * Slug list:    GET /api/admin/slugs?campaign=<c>    (Bearer token — create form variants)
 */

// ── Inline chart library CDN ──────────────────────────────────────────────────
const CHARTJS_CDN = "https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js";

// ── Full page HTML ────────────────────────────────────────────────────────────
// Built per-request so branch/sha can be injected from CF Pages env vars,
// matching the same pattern used by admin-renderer.js renderAdmin().
function buildPage(branch, sha) {
  var vMatch    = (branch || "").match(/v(\d+)/);
  var vTag      = vMatch ? "v" + vMatch[1] : "v9";
  // Prompt 69 — CogniLink branding: shaShort = first 2 + . + last 1
  var shaShort  = sha ? sha.slice(0, 2) + "." + sha.slice(-1) : "";
  var shaTag    = sha ? " \u00b7 " + shaShort : "";
  var panelLogo = "CogniLink Lab";
  var panelTitle = shaTag;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
<title>${panelLogo}${panelTitle}</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>
:root{
  --bg:#F4F4F2;--surface:#FFFFFF;--text:#111111;--text-m:#666666;
  --border:#E0E0DC;--accent:#111111;--accent-t:#FFFFFF;
  --danger:#C0392B;--danger-t:#FFFFFF;--success:#2D7D4F;
  --warn:#B45309;
  --font:system-ui,-apple-system,'Segoe UI',sans-serif;
  --radius:28px;--radius-sm:28px;--shadow:0 1px 3px rgba(0,0,0,.06);
}
@media(prefers-color-scheme:dark){
  :root{
    --bg:#111111;--surface:#1C1C1C;--text:#F0F0EE;--text-m:#888888;
    --border:#2E2E2E;--accent:#F0F0EE;--accent-t:#111111;
    --danger:#E55245;--danger-t:#FFFFFF;--success:#3DBA6E;--warn:#E8A020;
  }
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:var(--font);font-size:.9rem;-webkit-font-smoothing:antialiased;min-height:100vh}
.hidden{display:none!important}

/* ── Gate ─────────────────────────────────────────────────────── */
#gate{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem 1.25rem}
.gate-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:2rem;width:100%;max-width:360px;box-shadow:var(--shadow)}
.gate-title{font-weight:600;font-size:1.05rem;margin-bottom:.375rem}
.gate-hint{font-size:.8125rem;color:var(--text-m);margin-bottom:1.25rem}

/* ── Topbar ───────────────────────────────────────── */
.topbar{display:flex;align-items:center;justify-content:space-between;padding:.875rem 1.5rem;border-bottom:1px solid var(--border);background:var(--surface);gap:.75rem;position:sticky;top:0;z-index:10;min-height:64px}
.topbar-title{font-weight:600;font-size:.9375rem;flex-shrink:0}
.topbar-right{display:flex;align-items:center;gap:.55rem}
.btn-round{border-radius:50%;display:flex;align-items:center;justify-content:center;padding:0}
.btn-oval{border-radius:28px}

/* ── Alias bar ────────────────────────────────────────────────── */
.alias-bar{padding:.875rem 1.5rem;background:var(--surface);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:.625rem;flex-wrap:wrap}

/* ── Content ──────────────────────────────────────────────────── */
.content{padding:1.5rem;max-width:960px;margin:0 auto;display:flex;flex-direction:column;gap:1.25rem}

/* ── Status card ──────────────────────────────────────────────── */
.status-card{border-radius:var(--radius);padding:1.375rem 1.5rem;border:2px solid var(--border);position:relative;transition:border-color .2s,background .2s}
.status-card.sc-early{background:var(--bg);border-color:var(--border)}
.status-card.sc-running{background:#FFF8F0;border-color:#F5A623}
.status-card.sc-decided{background:#F0FBF4;border-color:var(--success)}
@media(prefers-color-scheme:dark){
  .status-card.sc-running{background:#2A1E0A;border-color:#F5A623}
  .status-card.sc-decided{background:#0A2518;border-color:var(--success)}
}
.sc-badge{position:absolute;top:1rem;right:1rem;font-size:.7rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:.2rem .6rem;border-radius:.25rem}
.sc-badge.b-early{background:var(--border);color:var(--text-m)}
.sc-badge.b-running{background:#F5A623;color:#fff}
.sc-badge.b-decided{background:var(--success);color:#fff}
.sc-badge.b-paused{background:#6B7280;color:#fff}
.sc-badge.b-archived{background:#B91C1C;color:#fff}
.sc-badge.b-draft{background:#6366F1;color:#fff}
@media(prefers-color-scheme:dark){
  .sc-badge.b-paused{background:#4B5563}
  .sc-badge.b-archived{background:#991B1B}
  .sc-badge.b-draft{background:#4F46E5}
}
.status-card.sc-paused{background:#F9FAFB;border-color:#9CA3AF}
.status-card.sc-archived{background:#F3F4F6;border-color:#6B7280;opacity:.85}
.status-card.sc-draft{background:#F5F3FF;border-color:#6366F1}
@media(prefers-color-scheme:dark){
  .status-card.sc-paused{background:#1A1F2A;border-color:#4B5563}
  .status-card.sc-archived{background:#0F1117;border-color:#374151}
  .status-card.sc-draft{background:#1E1B3A;border-color:#6366F1}
}
.sc-experiment{font-size:1.25rem;font-weight:700;margin-bottom:.875rem;padding-right:6rem;word-break:break-all}
.sc-rows{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.5rem}
.sc-row{background:rgba(0,0,0,.04);border-radius:.35rem;padding:.5rem .75rem}
@media(prefers-color-scheme:dark){.sc-row{background:rgba(255,255,255,.06)}}
.sc-row-label{font-size:.68rem;text-transform:uppercase;letter-spacing:.05em;color:var(--text-m);font-weight:600;margin-bottom:.15rem}
.sc-row-value{font-size:.9375rem;font-weight:700}

/* ── Card ─────────────────────────────────────────────────────── */
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:1.25rem 1.5rem;box-shadow:var(--shadow)}
.card-title{font-weight:600;font-size:.9375rem;margin-bottom:1rem}

/* ── Variant table ────────────────────────────────────────────── */
.exp-table{width:100%;border-collapse:collapse;font-size:.8125rem}
.exp-table th{text-align:left;padding:.45rem .625rem;font-size:.695rem;font-weight:600;color:var(--text-m);text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid var(--border);white-space:nowrap}
.exp-table td{padding:.5rem .625rem;border-bottom:1px solid var(--border);white-space:nowrap}
.exp-table tr.row-winner td{background:#F0FBF4;font-weight:600}
.exp-table tr.row-winner td:first-child{border-left:3px solid var(--success)}
@media(prefers-color-scheme:dark){.exp-table tr.row-winner td{background:#0A2518}}
.exp-table tr.row-baseline td{opacity:.85}
.exp-table tr.row-losing td{opacity:.6}
.winner-pill{display:inline-block;font-size:.63rem;font-weight:700;background:var(--success);color:#fff;border-radius:.2rem;padding:.05rem .3rem;vertical-align:middle;margin-left:.35rem;letter-spacing:.04em;text-transform:uppercase}

/* ── Chart ────────────────────────────────────────────────────── */
.chart-wrap{height:220px;position:relative}

/* ── Advanced section ─────────────────────────────────────────── */
.advanced-section{margin:0}
.advanced-section summary{font-size:.875rem;font-weight:500;cursor:pointer;user-select:none;display:flex;align-items:center;gap:.4rem;list-style:none;padding:.25rem 0}
.advanced-section summary::-webkit-details-marker{display:none}
.advanced-section summary::before{content:"\u25B6";font-size:.65rem;color:var(--text-m);transition:transform .18s;flex-shrink:0}
.advanced-section[open] summary::before{transform:rotate(90deg)}
.adv-body{margin-top:.875rem;padding-top:.875rem;border-top:1px solid var(--border)}
.adv-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.75rem}
.adv-tile{background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:.75rem}
.adv-tile-label{font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-m);margin-bottom:.25rem}
.adv-tile-value{font-size:.8125rem;color:var(--text-m);font-style:italic}

/* ── Lifecycle controls ───────────────────────────────────────── */
.lc-bar{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap}
.lc-msg{font-size:.8125rem;margin-top:.625rem}
.lc-msg.ok{color:var(--success)}
.lc-msg.err{color:var(--danger)}
.btn-lc-pause,.btn-lc-resume,.btn-lc-archive{padding:.5rem .875rem;background:transparent;color:var(--text);border:1px solid var(--border);border-radius:var(--radius-sm);font-family:var(--font);font-size:.8125rem;font-weight:500;cursor:pointer;white-space:nowrap}
.btn-lc-pause:hover,.btn-lc-resume:hover,.btn-lc-archive:hover{background:var(--border)}
.btn-lc-promote{padding:.5rem .875rem;background:var(--success);color:#fff;border:none;border-radius:var(--radius-sm);font-family:var(--font);font-size:.8125rem;font-weight:600;cursor:pointer;white-space:nowrap}
.btn-lc-promote:hover{opacity:.88}
.btn-lc-unarchive{padding:.5rem .875rem;background:transparent;color:var(--text);border:1px solid var(--border);border-radius:var(--radius-sm);font-family:var(--font);font-size:.8125rem;font-weight:500;cursor:pointer;white-space:nowrap}
.btn-lc-unarchive:hover{background:var(--border)}
.btn-lc-activate{padding:.5rem .875rem;background:#6366F1;color:#fff;border:none;border-radius:var(--radius-sm);font-family:var(--font);font-size:.8125rem;font-weight:600;cursor:pointer;white-space:nowrap}
.btn-lc-activate:hover{opacity:.88}
.btn-lc-bandit{padding:.5rem .875rem;background:transparent;color:var(--text);border:1px solid var(--border);border-radius:var(--radius-sm);font-family:var(--font);font-size:.8125rem;font-weight:500;cursor:pointer;white-space:nowrap}
.btn-lc-bandit:hover{background:var(--border)}
.btn-lc-pause:disabled,.btn-lc-resume:disabled,.btn-lc-promote:disabled,.btn-lc-archive:disabled,.btn-lc-unarchive:disabled,.btn-lc-activate:disabled,.btn-lc-bandit:disabled{opacity:.45;cursor:not-allowed}

/* ── Shared form ──────────────────────────────────────────────── */
input,select{padding:.625rem .875rem;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:var(--radius-sm);font-family:var(--font);font-size:.875rem;outline:none}
input:focus,select:focus{border-color:var(--accent)}
.btn-primary{padding:.625rem 1.25rem;background:var(--accent);color:var(--accent-t);border:none;border-radius:var(--radius-sm);font-family:var(--font);font-size:.875rem;font-weight:500;cursor:pointer;white-space:nowrap}
.btn-primary:disabled{opacity:.55;cursor:not-allowed}
.btn-ghost{padding:.5rem .875rem;background:transparent;color:var(--text);border:1px solid var(--border);border-radius:var(--radius-sm);font-family:var(--font);font-size:.8125rem;font-weight:500;cursor:pointer;white-space:nowrap}
.btn-ghost:hover{background:var(--border)}
.err{font-size:.8125rem;color:var(--danger)}
.hint{font-size:.8125rem;color:var(--text-m)}

/* ── Traffic Distribution card ────────────────────────────────── */
.dist-row{display:flex;align-items:center;gap:.625rem;margin-bottom:.5rem}
.dist-row:last-of-type{margin-bottom:0}
.dist-label{font-size:.8125rem;font-weight:500;width:150px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:ui-monospace,'SF Mono',monospace}
.dist-bar-wrap{flex:1;background:var(--border);border-radius:.2rem;height:7px;overflow:hidden;min-width:60px}
.dist-bar{height:100%;border-radius:.2rem;background:var(--accent);transition:width .35s ease}
.dist-pct{font-size:.8125rem;font-weight:600;width:3.5rem;text-align:right;flex-shrink:0;font-variant-numeric:tabular-nums}
.dist-expected{font-size:.75rem;color:var(--text-m);width:5rem;text-align:right;flex-shrink:0}
.dist-row.dist-imbalance .dist-pct{color:var(--warn)}
.dist-row.dist-imbalance .dist-bar{background:var(--warn)}
.dist-warning{font-size:.8rem;color:var(--warn);margin-top:.875rem;padding:.5rem .75rem;background:rgba(180,83,9,.07);border-radius:.3rem;border-left:3px solid var(--warn)}
@media(prefers-color-scheme:dark){.dist-warning{background:rgba(232,160,32,.07)}}

/* ── Health card ──────────────────────────────────────────────── */
.health-item{display:flex;align-items:flex-start;gap:.5rem;padding:.375rem 0;border-bottom:1px solid var(--border);font-size:.8125rem;line-height:1.4}
.health-item:last-child{border-bottom:none}
.health-item.h-warn{color:var(--warn)}
.health-item.h-info{color:var(--success)}
.health-item.h-ok{color:var(--success);font-weight:500}
.health-icon{flex-shrink:0;width:1.1rem;text-align:center}

/* ── Operator Breakdown card ──────────────────────────────────── */
.op-table{width:100%;border-collapse:collapse;font-size:.8125rem}
.op-table th{text-align:left;padding:.4rem .6rem;font-size:.685rem;font-weight:600;color:var(--text-m);text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid var(--border);white-space:nowrap}
.op-table td{padding:.45rem .6rem;border-bottom:1px solid var(--border);white-space:nowrap;font-variant-numeric:tabular-nums}
.op-table tr:last-child td{border-bottom:none}
.op-source{font-size:.75rem;color:var(--text-m);font-style:italic}
.op-note{font-size:.775rem;color:var(--text-m);margin-top:.75rem;padding:.4rem .65rem;background:rgba(0,0,0,.03);border-radius:.3rem}
@media(prefers-color-scheme:dark){.op-note{background:rgba(255,255,255,.04)}}

/* ── Conversion Breakdown panels (Prompt 65) ──────────────────── */
.brk-table{width:100%;border-collapse:collapse;font-size:.8125rem}
.brk-table th{text-align:left;padding:.4rem .6rem;font-size:.685rem;font-weight:600;color:var(--text-m);text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid var(--border);white-space:nowrap}
.brk-table td{padding:.45rem .6rem;border-bottom:1px solid var(--border);white-space:nowrap;font-variant-numeric:tabular-nums}
.brk-table tr:last-child td{border-bottom:none}
.brk-table td.brk-count{text-align:right;font-weight:600}
.brk-name{font-family:ui-monospace,'SF Mono',monospace;font-size:.8rem}
.brk-empty{font-size:.8125rem;color:var(--text-m);font-style:italic;padding:.5rem .6rem}
.brk-note{font-size:.775rem;color:var(--text-m);margin-top:.75rem;padding:.4rem .65rem;background:rgba(0,0,0,.03);border-radius:.3rem}
@media(prefers-color-scheme:dark){.brk-note{background:rgba(255,255,255,.04)}}

/* ── Create Experiment form (Prompt 67 S2+S3) ─────────────────── */
.create-panel{background:var(--surface);border-bottom:1px solid var(--border);padding:.875rem 1.5rem}
.create-panel-header{display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none;gap:.5rem}
.create-panel-title{font-weight:600;font-size:.9375rem}
.create-panel-icon{font-size:.65rem;color:var(--text-m);transition:transform .18s;flex-shrink:0}
.create-form-body{margin-top:1rem;display:flex;flex-direction:column;gap:.875rem}
.cf-row{display:flex;align-items:flex-end;gap:.75rem;flex-wrap:wrap}
.cf-field{display:flex;flex-direction:column;flex:1;min-width:140px}
.cf-field label{font-size:.75rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:var(--text-m);margin-bottom:.3rem;display:block}
.cf-field input,.cf-field select{width:100%}
.cf-weight-row{display:flex;align-items:center;gap:.5rem;font-size:.8125rem}
.cf-weight-row input[type=number]{width:4.5rem}
.create-msg{font-size:.8125rem}.create-msg.ok{color:var(--success)}.create-msg.err{color:var(--danger)}

/* ── Add Variant button (Prompt 68 S2) ────────────────────────── */
.btn-add-variant{padding:.375rem .75rem;background:transparent;color:var(--text-m);border:1px dashed var(--border);border-radius:var(--radius-sm);font-family:var(--font);font-size:.8125rem;cursor:pointer;margin-top:.25rem}
.btn-add-variant:hover{background:var(--border)}
.cf-variant-row{display:flex;align-items:flex-end;gap:.625rem;flex-wrap:wrap}
.btn-remove-variant{padding:.2rem .5rem;background:transparent;color:var(--danger);border:1px solid var(--border);border-radius:.2rem;font-family:var(--font);font-size:.75rem;cursor:pointer;flex-shrink:0;margin-bottom:.625rem}
.btn-remove-variant:hover{background:var(--danger);color:#fff;border-color:var(--danger)}

/* ── Rebalance + Settings cards (Prompt 68 S3+S4) ─────────────── */
.rbl-row{display:flex;align-items:center;gap:.625rem;margin-bottom:.5rem}
.rbl-label{font-size:.8125rem;font-weight:500;width:180px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:ui-monospace,'SF Mono',monospace}
.rbl-input{width:4.5rem}
.rbl-pct{font-size:.8125rem;color:var(--text-m);width:1.5rem}
.rbl-total{font-size:.8125rem;margin-top:.375rem;font-weight:600}
.rbl-total.ok{color:var(--success)}.rbl-total.err{color:var(--danger)}

/* ── Set Winner button (Prompt 68 S5) ─────────────────────────── */
.btn-set-winner{padding:.15rem .45rem;background:transparent;color:var(--text-m);border:1px solid var(--border);border-radius:.2rem;font-family:var(--font);font-size:.68rem;font-weight:500;cursor:pointer;white-space:nowrap;margin-left:.4rem;vertical-align:middle}
.material-symbols-outlined {
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' -25, 'opsz' 24;
  vertical-align: middle; line-height: 1;
}
</style>
</head>
<body>

<!-- ── Token Gate ───────────────────────────────────────────────── -->
<div id="gate">
  <div class="gate-card">
    <p class="gate-title">CogniLink</p>
    <p class="gate-hint">Enter your access token to continue.</p>
    <form id="gate-form" autocomplete="off">
      <input id="token-input" type="password" placeholder="Access token"
        autocomplete="current-password" required style="width:100%;margin-bottom:.75rem" />
      <p id="gate-error" class="err hidden" style="margin-bottom:.625rem"></p>
      <button type="submit" class="btn-primary" style="width:100%">Continue</button>
    </form>
  </div>
</div>

<!-- ── Dashboard ────────────────────────────────────────────────── -->
<div id="dash" class="hidden">

  <!-- Topbar -->
  <div class="topbar">
    <span class="topbar-title">${panelLogo}<small> <span style="color: var(--text-m)">${panelTitle}</span></small></span>
    <div class="topbar-right">
      <a href="/admin" class="btn-ghost btn-sm btn-oval" style="padding: 0.6em 1.3em; text-decoration: none; color: var(--text-m);"><small>&larr;&nbsp;</small>Core</a>
      <button id="btn-logout" class="btn-ghost btn-sm btn-round" style="padding: 1px; width: 34px; height: 34px;">
        <svg class="" xmlns="http://www.w3.org/2000/svg" fill="none" viewbox="0 0 22 22" style="width: 20px; height: 18px;"><path stroke="var(--text-m)" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12h-9.5m7.5 3 3-3-3-3m-5-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5a2 2 0 0 0 2-2v-1"></path></svg>
      </button>
    </div>
  </div>

  <!-- Alias selector bar -->
  <div class="alias-bar">
    <select id="alias-select" style="min-width:160px">
      <option value="">Select experiment\u2026</option>
    </select>
    <button id="btn-load" class="btn-primary">Load</button>
    <p id="load-error" class="err hidden"></p>
  </div>

  <!-- Create Experiment panel (Prompt 67 S2+S3) -->
  <div class="create-panel" id="create-panel">
    <div class="create-panel-header" id="create-toggle">
      <span class="create-panel-title">+ Create Experiment</span>
      <span class="create-panel-icon" id="create-icon">\u25BC</span>
    </div>
    <div id="create-form-body" class="create-form-body" style="display:none">
      <form id="create-form" autocomplete="off">
        <div class="cf-row">
          <div class="cf-field">
            <label>Experiment Alias</label>
            <input type="text" id="cf-alias" placeholder="e.g. abrand45" required>
          </div>
          <div class="cf-field">
            <label>Campaign</label>
            <select id="cf-campaign">
              <option value="">Select campaign\u2026</option>
            </select>
          </div>
        </div>
        <!-- Dynamic variant rows (Prompt 68 S2 — supports 2-10 variants) -->
        <div id="cf-variant-list"></div>
        <button type="button" id="cf-add-variant" class="btn-add-variant" disabled>+ Add Variant</button>
        <div class="cf-row" style="margin-top:.875rem">
          <div class="cf-field" style="flex:0;align-self:flex-end">
            <button type="submit" id="cf-submit" class="btn-primary">Create</button>
          </div>
          <p id="cf-weights-total" class="rbl-total" style="align-self:flex-end"></p>
        </div>
        <p id="create-msg" class="create-msg hidden"></p>
      </form>
    </div>
  </div>

  <!-- Four-layer dashboard (hidden until first load) -->
  <div class="content" id="dashboard-content" style="display:none">

    <!-- LAYER 1 — Status Card -->
    <div id="status-card" class="status-card sc-early">
      <span id="sc-badge" class="sc-badge b-early">EARLY</span>
      <div id="sc-experiment" class="sc-experiment">\u2014</div>
      <div class="sc-rows">
        <div class="sc-row">
          <div class="sc-row-label">Traffic</div>
          <div id="stat-traffic" class="sc-row-value">\u2014</div>
        </div>
        <div class="sc-row">
          <div class="sc-row-label">Winner</div>
          <div id="stat-winner" class="sc-row-value">\u2014</div>
        </div>
        <div class="sc-row">
          <div class="sc-row-label">Confidence</div>
          <div id="stat-confidence" class="sc-row-value">\u2014</div>
        </div>
        <div class="sc-row">
          <div class="sc-row-label">Variants</div>
          <div id="stat-variants" class="sc-row-value">\u2014</div>
        </div>
      </div>
    </div>

    <!-- Lifecycle Controls -->
    <div class="card" id="lc-card" style="display:none">
      <div class="lc-bar">
        <button id="btn-lc-activate"   class="btn-lc-activate   hidden"><span class="material-symbols-outlined">play_arrow</span> Activate</button>
        <button id="btn-lc-pause"      class="btn-lc-pause      hidden"><span class="material-symbols-outlined">pause</span> Pause</button>
        <button id="btn-lc-resume"     class="btn-lc-resume     hidden"><span class="material-symbols-outlined">play_arrow</span> Resume</button>
        <button id="btn-lc-promote"    class="btn-lc-promote    hidden"><span class="material-symbols-outlined">workspace_premium</span> Promote Winner</button>
        <button id="btn-lc-archive"    class="btn-lc-archive    hidden"><span class="material-symbols-outlined">archive</span> Archive</button>
        <button id="btn-lc-unarchive"  class="btn-lc-unarchive  hidden"><span class="material-symbols-outlined">unarchive</span> Unarchive</button>
        <button id="btn-lc-bandit"     class="btn-lc-bandit     hidden"><span class="material-symbols-outlined">cached</span> Update Bandit Weights</button>
      </div>
      <p id="lc-msg" class="lc-msg hidden"></p>
    </div>

    <!-- Health Card -->
    <div class="card" id="health-card" style="display:none">
      <p class="card-title">Experiment Health</p>
      <div id="health-checks"></div>
    </div>

    <!-- LAYER 2 — Variant Performance Table -->
    <div class="card">
      <p class="card-title">Variant Performance</p>
      <div style="overflow-x:auto">
        <table class="exp-table">
          <thead>
            <tr>
              <th>Variant</th>
              <th>Weight</th>
              <th>Share</th>
              <th>Traffic</th>
              <th>Clicks</th>
              <th>Conv.</th>
              <th>Conv. Rate</th>
              <th>Lift vs Baseline</th>
            </tr>
          </thead>
          <tbody id="variant-tbody"></tbody>
        </table>
      </div>
    </div>

    <!-- Rebalance Traffic (Prompt 68 S3) -->
    <div class="card" id="rebalance-card" style="display:none">
      <p class="card-title">Rebalance Traffic</p>
      <p class="hint" style="margin-bottom:.75rem">Adjust variant weights. Must sum to 100. Routing updates within 60 s.</p>
      <div id="rebalance-rows"></div>
      <p id="rbl-total" class="rbl-total"></p>
      <div style="margin-top:.875rem;display:flex;align-items:center;gap:.75rem;flex-wrap:wrap">
        <button id="btn-rebalance" class="btn-primary">Save Weights</button>
        <p id="rebalance-msg" class="lc-msg hidden"></p>
      </div>
    </div>

    <!-- Experiment Settings (Prompt 68 S4) -->
    <div class="card" id="settings-card" style="display:none">
      <p class="card-title">Experiment Settings</p>
      <div class="cf-row" style="margin-bottom:.75rem">
        <div class="cf-field" style="max-width:240px">
          <label>Routing Strategy</label>
          <select id="settings-strategy">
            <option value="">weighted (default)</option>
            <option value="epsilon_greedy">epsilon_greedy</option>
          </select>
        </div>
        <div class="cf-field" id="eps-field" style="max-width:200px;display:none">
          <label>Epsilon (0\u20131)</label>
          <input type="number" id="settings-epsilon" value="0.1" min="0" max="1" step="0.01" style="width:100%">
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap">
        <button id="btn-save-settings" class="btn-primary">Save Settings</button>
        <p id="settings-msg" class="lc-msg hidden"></p>
      </div>
    </div>

    <!-- LAYER 2.5 — Traffic Distribution (diagnostics) -->
    <div class="card" id="distribution-card" style="display:none">
      <p class="card-title">Traffic Distribution</p>
      <div id="dist-header" style="display:flex;gap:0;margin-bottom:.625rem">
        <span style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-m);width:150px;flex-shrink:0">Variant</span>
        <span style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-m);flex:1;min-width:60px"></span>
        <span style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-m);width:3.5rem;text-align:right;flex-shrink:0">Share</span>
        <span style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-m);width:5rem;text-align:right;flex-shrink:0">Target</span>
      </div>
      <div id="dist-rows"></div>
      <p id="dist-warning" class="dist-warning hidden"></p>
    </div>

    <!-- LAYER 3 — Conversion Rate Chart -->
    <div class="card">
      <p class="card-title">Conversion Rate by Variant</p>
      <div id="chart-wrap" class="chart-wrap">
        <canvas id="exp-chart"></canvas>
      </div>
      <p id="chart-no-data" class="hint hidden"
        style="text-align:center;padding:2.5rem 0">Not enough data yet</p>
    </div>

    <!-- LAYER 3.5 — Operator Breakdown -->
    <div class="card" id="operator-card" style="display:none">
      <p class="card-title">Operator Breakdown</p>
      <div style="overflow-x:auto">
        <table class="op-table">
          <thead>
            <tr>
              <th>Variant</th>
              <th>Source</th>
              <th>Exposures</th>
              <th>Clicks</th>
              <th>Conv.</th>
            </tr>
          </thead>
          <tbody id="operator-tbody"></tbody>
        </table>
      </div>
      <p class="op-note"><span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;margin-right:4px">info</span>Source-level breakdown requires per-source instrumentation. Showing aggregate totals per variant.</p>
    </div>

    <!-- LAYER 3.6 — Conversion by Alias (Prompt 65) -->
    <div class="card" id="conv-alias-card" style="display:none">
      <p class="card-title">Conversion by Alias</p>
      <p class="hint" style="margin-bottom:.75rem">Which public entry links generate conversions for this experiment.</p>
      <div style="overflow-x:auto">
        <table class="brk-table">
          <thead>
            <tr>
              <th>Alias</th>
              <th style="text-align:right">Conversions</th>
            </tr>
          </thead>
          <tbody id="conv-alias-tbody"></tbody>
        </table>
      </div>
      <p class="brk-note"><span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;margin-right:4px">info</span>Populated when the conversion endpoint is called with <code>alias=&lt;alias&gt;</code>. Requires checkout pages to pass the cookie value.</p>
    </div>

    <!-- LAYER 3.7 — Conversion by Hub Link (Prompt 65) -->
    <div class="card" id="conv-link-card" style="display:none">
      <p class="card-title">Conversion by Hub Link</p>
      <p class="hint" style="margin-bottom:.75rem">Which hub buttons drive purchases for this experiment.</p>
      <div style="overflow-x:auto">
        <table class="brk-table">
          <thead>
            <tr>
              <th>Link</th>
              <th style="text-align:right">Conversions</th>
            </tr>
          </thead>
          <tbody id="conv-link-tbody"></tbody>
        </table>
      </div>
      <p class="brk-note"><span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;margin-right:4px">info</span>Populated when the conversion endpoint is called with <code>link_id=&lt;id&gt;</code>. Hub pages pass this automatically when a tracked button is clicked.</p>
    </div>

    <!-- LAYER 4 — Advanced Analytics (collapsed) -->
    <div class="card">
      <details class="advanced-section" id="adv-section">
        <summary>Advanced Analytics</summary>
        <div class="adv-body">
          <p class="hint" style="margin-bottom:.875rem">
            Per-variant breakdowns. Additional dimensions can be added to the
            experiment engine without structural changes.
          </p>
          <div class="adv-grid" id="adv-grid">
            <div class="adv-tile">
              <div class="adv-tile-label">Device</div>
              <div class="adv-tile-value" id="adv-device">Not collected yet</div>
            </div>
            <div class="adv-tile">
              <div class="adv-tile-label">Screen Size</div>
              <div class="adv-tile-value" id="adv-screen">Not collected yet</div>
            </div>
            <div class="adv-tile">
              <div class="adv-tile-label">Referrer</div>
              <div class="adv-tile-value" id="adv-referrer">Not collected yet</div>
            </div>
            <div class="adv-tile">
              <div class="adv-tile-label">Country</div>
              <div class="adv-tile-value" id="adv-country">Not collected yet</div>
            </div>
            <div class="adv-tile">
              <div class="adv-tile-label">Campaign Origin</div>
              <div class="adv-tile-value" id="adv-campaign">Not collected yet</div>
            </div>
          </div>
        </div>
      </details>
    </div>

  </div><!-- /content -->
</div><!-- /dash -->

<script src="${CHARTJS_CDN}"></script>
<script>
(function(){
'use strict';
var TOKEN_KEY    = 'admin_token';
var MIN_EXPOSURE = 30;   // chart threshold
var MIN_SAMPLE   = 50;   // health guard: minimum exposures per variant for reliable conclusions

/* ── DOM refs ──────────────────────────────────────────────────── */
var elGate       = document.getElementById('gate');
var elGateForm   = document.getElementById('gate-form');
var elTokenInput = document.getElementById('token-input');
var elGateError  = document.getElementById('gate-error');
var elDash       = document.getElementById('dash');
var elBtnLogout  = document.getElementById('btn-logout');
var elAliasSel   = document.getElementById('alias-select');
var elBtnLoad    = document.getElementById('btn-load');
var elLoadError  = document.getElementById('load-error');
var elContent    = document.getElementById('dashboard-content');
var elScCard     = document.getElementById('status-card');
var elScBadge    = document.getElementById('sc-badge');
var elScExp      = document.getElementById('sc-experiment');
var elStatTraf   = document.getElementById('stat-traffic');
var elStatWin    = document.getElementById('stat-winner');
var elStatConf   = document.getElementById('stat-confidence');
var elStatVar    = document.getElementById('stat-variants');
var elTbody      = document.getElementById('variant-tbody');
var elChartWrap  = document.getElementById('chart-wrap');
var elChartCanvas= document.getElementById('exp-chart');
var elChartNone  = document.getElementById('chart-no-data');
var elLcCard     = document.getElementById('lc-card');
var elBtnActivate  = document.getElementById('btn-lc-activate');
var elBtnPause     = document.getElementById('btn-lc-pause');
var elBtnResume    = document.getElementById('btn-lc-resume');
var elBtnPromote   = document.getElementById('btn-lc-promote');
var elBtnArchive   = document.getElementById('btn-lc-archive');
var elBtnUnarchive = document.getElementById('btn-lc-unarchive');
var elBtnBandit    = document.getElementById('btn-lc-bandit');
var elLcMsg        = document.getElementById('lc-msg');
var elDistCard     = document.getElementById('distribution-card');
var elDistRows     = document.getElementById('dist-rows');
var elDistWarning  = document.getElementById('dist-warning');
var elHealthCard    = document.getElementById('health-card');
var elHealthChecks  = document.getElementById('health-checks');
var elOperatorCard  = document.getElementById('operator-card');
var elOperatorTbody = document.getElementById('operator-tbody');
/* Conversion breakdown panels (Prompt 65) */
var elConvAliasCard  = document.getElementById('conv-alias-card');
var elConvAliasTbody = document.getElementById('conv-alias-tbody');
var elConvLinkCard   = document.getElementById('conv-link-card');
var elConvLinkTbody  = document.getElementById('conv-link-tbody');
/* Create Experiment form (Prompt 67 S2+S3, Prompt 68 S1+S2) */
var elCreateToggle    = document.getElementById('create-toggle');
var elCreateFormBody  = document.getElementById('create-form-body');
var elCreateIcon      = document.getElementById('create-icon');
var elCfAlias         = document.getElementById('cf-alias');
var elCfCampaign      = document.getElementById('cf-campaign');
var elCfVariantList   = document.getElementById('cf-variant-list');
var elCfAddVariant    = document.getElementById('cf-add-variant');
var elCfWeightsTotal  = document.getElementById('cf-weights-total');
var elCfSubmit        = document.getElementById('cf-submit');
var elCreateMsg       = document.getElementById('create-msg');
/* Rebalance card (Prompt 68 S3) */
var elRebalanceCard  = document.getElementById('rebalance-card');
var elRebalanceRows  = document.getElementById('rebalance-rows');
var elRblTotal       = document.getElementById('rbl-total');
var elBtnRebalance   = document.getElementById('btn-rebalance');
var elRebalanceMsg   = document.getElementById('rebalance-msg');
/* Settings card (Prompt 68 S4) */
var elSettingsCard    = document.getElementById('settings-card');
var elSettingsStrat   = document.getElementById('settings-strategy');
var elEpsField        = document.getElementById('eps-field');
var elSettingsEps     = document.getElementById('settings-epsilon');
var elBtnSaveSettings = document.getElementById('btn-save-settings');
var elSettingsMsg     = document.getElementById('settings-msg');
var chartInst        = null;
var currentAlias    = '';   // alias currently loaded — used by lifecycle actions
var currentVariants = [];   // [{slug, weight}] — used by rebalance + settings save
var currentStrategy = '';   // epsilon_greedy | '' — used by settings save
var currentEpsilon  = null; // number 0-1 | null

/* ── Helpers ───────────────────────────────────────────────────── */
function tok()       { return localStorage.getItem(TOKEN_KEY) || ''; }
function show(el)    { el.classList.remove('hidden'); }
function hide(el)    { el.classList.add('hidden'); }
function esc(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function authFetch(url){
  return fetch(url, { headers: { 'Authorization': 'Bearer ' + tok() } });
}
/* silentCompile — fire-and-forget route compile after any routing mutation.
 * Result is intentionally ignored; the operator can press "Compile Now" in
 * the Routing tab to see detailed output if needed.                        */
function silentCompile(){
  fetch('/api/admin/compile-routes', {
    method:  'POST',
    headers: { 'Authorization': 'Bearer ' + tok(), 'Content-Type': 'application/json' },
    body:    JSON.stringify({}),
  }).catch(function(){}); // fire-and-forget
}

/* ── Boot ──────────────────────────────────────────────────────── */
if (tok()) { showDash(); }
else       { show(elGate); }

/* ── Token gate ────────────────────────────────────────────────── */
// Validates against /api/slugs — same endpoint as the main admin panel
// so both panels use identical token-check logic.
elGateForm.addEventListener('submit', function(e){
  e.preventDefault();
  var entered = elTokenInput.value.trim();
  if (!entered) return;
  fetch('/api/slugs', { headers: { 'Authorization': 'Bearer ' + entered } })
    .then(function(r){
      if (r.ok){
        localStorage.setItem(TOKEN_KEY, entered);
        hide(elGateError);
        showDash();
      } else {
        elGateError.textContent = 'Invalid token (HTTP ' + r.status + ').';
        show(elGateError);
      }
    })
    .catch(function(){
      elGateError.textContent = 'Network error. Please retry.';
      show(elGateError);
    });
});

/* ── Sign out ──────────────────────────────────────────────────── */
elBtnLogout.addEventListener('click', function(){
  localStorage.removeItem(TOKEN_KEY);
  location.reload();
});

/* ── Show dashboard ────────────────────────────────────────────── */
function showDash(){
  hide(elGate);
  show(elDash);
  
  // Custom hook: Load aliases list first
  authFetch('/api/admin/experiments')
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(data){
      if (!data || !Array.isArray(data.experiments)) return;
      var prev = elAliasSel.value;
      elAliasSel.innerHTML = '<option value="">Select experiment\u2026</option>';
      data.experiments.forEach(function(exp){
        var opt = document.createElement('option');
        opt.value = exp.alias;
        opt.textContent = exp.alias + ' \u2014 ' + (exp.state || '?');
        elAliasSel.appendChild(opt);
      });
      if (prev) elAliasSel.value = prev;

      // Auto-load query param alias if present
      var paramAlias = new URLSearchParams(window.location.search).get('alias') || new URLSearchParams(window.location.search).get('experimentId');
      if (paramAlias) {
        elAliasSel.value = paramAlias.trim().toLowerCase();
        if (elAliasSel.value !== paramAlias.trim().toLowerCase()) {
          var opt = document.createElement('option');
          opt.value = paramAlias.trim().toLowerCase();
          opt.textContent = paramAlias.trim().toLowerCase() + ' (auto-loaded)';
          elAliasSel.appendChild(opt);
          elAliasSel.value = paramAlias.trim().toLowerCase();
        }
        loadExperiment();
      }
    })
    .catch(function(){});

  loadCampaigns();
}

/* ── Load experiments list (Prompt 67 S1) ──────────────────────── */
// Reads from /api/admin/experiments → AB_INDEX ab_config:* keys.
// Only real experiments appear in the selector (no raw campaign aliases).
function loadAliases(){
  authFetch('/api/admin/experiments')
    .then(function(r){
      // On 401 / any error: silently return null.
      // Do NOT clear the token or reload — that would destroy the session.
      // If the token is truly invalid, the user will see 401 errors on load actions
      // and can sign out explicitly via the "Sign out" button.
      if (!r.ok) return null;
      return r.json();
    })
    .then(function(data){
      if (!data || !Array.isArray(data.experiments)) return;
      var prev = elAliasSel.value;
      elAliasSel.innerHTML = '<option value="">Select experiment\u2026</option>';
      data.experiments.forEach(function(exp){
        var opt = document.createElement('option');
        opt.value = exp.alias;
        opt.textContent = exp.alias + ' \u2014 ' + (exp.state || '?');
        elAliasSel.appendChild(opt);
      });
      // Restore previous selection after a create-refresh
      if (prev) elAliasSel.value = prev;
    })
    .catch(function(){});
}

/* ── Load campaign list for create form (Prompt 68 S1 fix) ─────── */
// Now calls /api/admin/campaigns (CAMPAIGN_INDEX names) instead of
// /api/admin/aliases so that campaign-scoped slug filtering works correctly
// regardless of whether the alias and campaign name differ.
function loadCampaigns(){
  if (!elCfCampaign) return;
  authFetch('/api/admin/campaigns')
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(data){
      if (!data || !Array.isArray(data.campaigns)) return;
      elCfCampaign.innerHTML = '<option value="">Select campaign\u2026</option>';
      data.campaigns.forEach(function(c){
        var opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        elCfCampaign.appendChild(opt);
      });
    })
    .catch(function(){});
}

/* ── Load variant slugs for selected campaign (Prompt 67 S3, Prompt 68 S1) ─
   Now uses value-based filtering (record.campaign === campaign) on the backend,
   so naming-convention mismatches between alias and campaign name no longer
   cause empty slug lists.
*/
function loadSlugsForCampaign(campaign){
  if (!elCfVariantList) return;
  cfSlugOptions = [];
  /* Disable all existing variant selects while loading */
  var selects = elCfVariantList.querySelectorAll('.cf-vs-input');
  selects.forEach(function(s){ s.disabled = true; s.innerHTML = '<option value="">Loading\u2026</option>'; });

  if (!campaign){
    selects.forEach(function(s){ s.innerHTML = '<option value="">Select campaign first\u2026</option>'; });
    elCfAddVariant.disabled = true;
    return;
  }

  authFetch('/api/admin/slugs?campaign=' + encodeURIComponent(campaign))
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(data){
      cfSlugOptions = (data && Array.isArray(data.slugs)) ? data.slugs : [];
      if (cfSlugOptions.length === 0){
        var msg = '<option value="">No slugs for "' + esc(campaign) + '"</option>';
        selects.forEach(function(s){ s.innerHTML = msg; });
        return;
      }
      cfRefreshSlugSelects();
      elCfAddVariant.disabled = false;
    })
    .catch(function(){
      selects.forEach(function(s){ s.innerHTML = '<option value="">Error loading slugs</option>'; });
    });
}

/* ── Load + render experiment ──────────────────────────────────── */
elBtnLoad.addEventListener('click', loadExperiment);
elAliasSel.addEventListener('change', function(){
  if (elAliasSel.value) loadExperiment();
});

function loadExperiment(){
  var alias = elAliasSel.value.trim();
  hide(elLoadError);
  if (!alias){
    elLoadError.textContent = 'Select an experiment first.';
    show(elLoadError);
    return;
  }
  elBtnLoad.disabled = true;
  elBtnLoad.textContent = 'Loading\u2026';
  authFetch('/api/experiments?alias=' + encodeURIComponent(alias))
    .then(function(r){
      if (!r.ok){
        // Do NOT clear the token or reload on 401 — that would destroy the session.
        // Show the error inline so the user can sign out explicitly if needed.
        return r.json().then(function(e){ throw new Error(e.error || ('HTTP ' + r.status)); });
      }
      return r.json();
    })
    .then(function(data){
      renderDashboard(data);
      elContent.style.display = '';
      hide(elLoadError);
    })
    .catch(function(err){
      elLoadError.textContent = 'Error: ' + (err && err.message ? err.message : String(err));
      show(elLoadError);
    })
    .then(function(){
      elBtnLoad.disabled = false;
      elBtnLoad.textContent = 'Load';
    });
}

/* ── Lifecycle actions ─────────────────────────────────────────── */
function lifecycleAction(endpoint){
  if (!currentAlias) return;
  var allBtns = [elBtnActivate, elBtnPause, elBtnResume, elBtnPromote, elBtnArchive, elBtnUnarchive, elBtnBandit];
  allBtns.forEach(function(b){ b.disabled = true; });
  elLcMsg.textContent = '';
  hide(elLcMsg);

  fetch('/api/experiment/' + endpoint, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + tok(),
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ alias: currentAlias }),
  })
  .then(function(r){ return r.json().then(function(d){ return { ok: r.ok, data: d }; }); })
  .then(function(res){
    if (res.ok){
      elLcMsg.className   = 'lc-msg ok';
      elLcMsg.textContent = 'Done \u2014 state: ' + res.data.state;
      show(elLcMsg);
      silentCompile(); // auto-compile so alias resolves without manual Compile Now
      /* Reload experiment data to refresh all four layers + controls */
      setTimeout(loadExperiment, 600);
    } else {
      var errMsg = res.data.error || 'Error';
      if (res.data.detail) errMsg += ' (' + res.data.detail + ')';
      elLcMsg.className   = 'lc-msg err';
      elLcMsg.textContent = errMsg;
      show(elLcMsg);
      allBtns.forEach(function(b){ b.disabled = false; });
    }
  })
  .catch(function(){
    elLcMsg.className   = 'lc-msg err';
    elLcMsg.textContent = 'Network error. Please retry.';
    show(elLcMsg);
    allBtns.forEach(function(b){ b.disabled = false; });
  });
}

elBtnPause.addEventListener('click',   function(){ lifecycleAction('pause'); });
elBtnResume.addEventListener('click',  function(){ lifecycleAction('resume'); });
elBtnPromote.addEventListener('click', function(){
  if (!confirm('Promote winner to canonical route and archive this experiment?')) return;
  lifecycleAction('promote');
});
elBtnArchive.addEventListener('click', function(){
  if (!confirm('Archive this experiment? (No routing changes \u2014 use Promote to route to winner)')) return;
  lifecycleAction('archive');
});
elBtnUnarchive.addEventListener('click', function(){
  if (!confirm('Unarchive this experiment? It will return to PAUSED state. Counters are unchanged.')) return;
  lifecycleAction('unarchive');
});
elBtnActivate.addEventListener('click', function(){
  if (!confirm('Activate this experiment? It will transition from DRAFT to RUNNING and begin receiving live traffic.')) return;
  lifecycleAction('activate');
});
elBtnBandit.addEventListener('click', function(){
  lifecycleAction('bandit-update');
});

/* ── Create Experiment form (Prompt 67 S2+S3, Prompt 68 S1+S2) ──── */

elCreateToggle.addEventListener('click', function(){
  var open = elCreateFormBody.style.display !== 'none';
  elCreateFormBody.style.display = open ? 'none' : '';
  elCreateIcon.style.transform   = open ? ''      : 'rotate(180deg)';
});

/* ── Dynamic variant rows for create form (Prompt 68 S2) ─────────
   Supports 2-10 variants with per-row weight inputs.
   Slugs are loaded after a campaign is selected.
*/
var cfSlugOptions = [];   // current slug options for this campaign (strings)

function cfUpdateWeightsTotal(){
  if (!elCfWeightsTotal || !elCfVariantList) return;
  var inputs = elCfVariantList.querySelectorAll('.cf-vw-input');
  var total  = 0;
  inputs.forEach(function(inp){ total += parseInt(inp.value, 10) || 0; });
  elCfWeightsTotal.textContent = 'Total: ' + total + ' / 100';
  elCfWeightsTotal.className   = 'rbl-total ' + (total === 100 ? 'ok' : 'err');
}

function cfBuildSlugSelect(selectedSlug){
  var html = '<option value="">Select slug\u2026</option>';
  cfSlugOptions.forEach(function(s){
    html += '<option value="' + esc(s) + '"' + (s === selectedSlug ? ' selected' : '') + '>' + esc(s) + '</option>';
  });
  return html;
}

function cfAddVariantRow(slug, weight, removable){
  if (!elCfVariantList) return;
  var idx   = elCfVariantList.querySelectorAll('.cf-variant-row').length;
  var label = idx === 0 ? 'Variant 1 (Baseline)' : ('Variant ' + (idx + 1));
  var row   = document.createElement('div');
  row.className = 'cf-variant-row cf-row';
  row.innerHTML =
    '<div class="cf-field">' +
      '<label>' + esc(label) + '</label>' +
      '<select class="cf-vs-input" ' + (cfSlugOptions.length === 0 ? 'disabled' : '') + '>' +
        cfBuildSlugSelect(slug || '') +
      '</select>' +
    '</div>' +
    '<div class="cf-field" style="max-width:90px">' +
      '<label>Weight (%)</label>' +
      '<input type="number" class="cf-vw-input" value="' + (weight || 50) + '" min="1" max="98" step="1">' +
    '</div>' +
    (removable
      ? '<button type="button" class="btn-remove-variant" title="Remove">\u00d7</button>'
      : '<span style="width:1.75rem"></span>') +
    '';
  row.querySelector('.cf-vw-input').addEventListener('input', cfUpdateWeightsTotal);
  if (removable){
    row.querySelector('.btn-remove-variant').addEventListener('click', function(){
      row.parentNode.removeChild(row);
      /* Re-label remaining rows */
      var rows = elCfVariantList.querySelectorAll('.cf-variant-row');
      rows.forEach(function(r, i){
        var lbl = r.querySelector('label');
        if (lbl) lbl.textContent = i === 0 ? 'Variant 1 (Baseline)' : ('Variant ' + (i + 1));
        /* first row is never removable — but removing others might leave only 2; keep remove on 3+ */
        var rm = r.querySelector('.btn-remove-variant');
        if (i === 0 && rm) rm.style.display = 'none';
        if (rows.length <= 2 && rm) rm.style.display = 'none';
      });
      elCfAddVariant.disabled = rows.length >= 10;
      cfUpdateWeightsTotal();
    });
  }
  elCfVariantList.appendChild(row);
  elCfAddVariant.disabled = elCfVariantList.querySelectorAll('.cf-variant-row').length >= 10;
  cfUpdateWeightsTotal();
}

function cfInitVariantRows(){
  if (!elCfVariantList) return;
  elCfVariantList.innerHTML = '';
  cfAddVariantRow('', 50, false);   // row 1 — baseline, not removable
  cfAddVariantRow('', 50, false);   // row 2 — always start with 2 variants
  elCfAddVariant.disabled = false;
}

function cfRefreshSlugSelects(){
  if (!elCfVariantList) return;
  var selects = elCfVariantList.querySelectorAll('.cf-vs-input');
  selects.forEach(function(sel){
    var current = sel.value;
    sel.innerHTML = cfBuildSlugSelect(current);
    sel.disabled  = cfSlugOptions.length === 0;
  });
}

elCfCampaign.addEventListener('change', function(){
  var campaign = elCfCampaign.value;
  /* Auto-suggest alias from campaign name if alias field is still empty */
  if (!elCfAlias.value && campaign) elCfAlias.value = campaign;
  /* Load slugs for this campaign and refresh all variant selects */
  loadSlugsForCampaign(campaign);
});

elCfAddVariant.addEventListener('click', function(){
  var rows = elCfVariantList.querySelectorAll('.cf-variant-row');
  if (rows.length >= 10) return;
  cfAddVariantRow('', Math.floor(100 / (rows.length + 1)), true);
  /* make previously non-removable row 2 removable now that we have 3+ rows */
  rows.forEach(function(r, i){
    if (i > 0) {
      var rm = r.querySelector('.btn-remove-variant');
      if (rm) rm.style.display = '';
    }
  });
});

/* Init rows on page load */
cfInitVariantRows();

document.getElementById('create-form').addEventListener('submit', function(e){
  e.preventDefault();
  var alias    = (elCfAlias.value    || '').trim().toLowerCase();
  var campaign = (elCfCampaign ? elCfCampaign.value : '').trim();

  elCreateMsg.className = 'create-msg hidden';
  hide(elCreateMsg);

  if (!alias){
    elCreateMsg.textContent = 'Enter an experiment alias.';
    elCreateMsg.className = 'create-msg err'; show(elCreateMsg); return;
  }
  if (!campaign){
    elCreateMsg.textContent = 'Select a campaign first.';
    elCreateMsg.className = 'create-msg err'; show(elCreateMsg); return;
  }

  /* Collect variant rows */
  var rows      = elCfVariantList ? elCfVariantList.querySelectorAll('.cf-variant-row') : [];
  var variants  = [];
  var slugsSeen = new Set();
  var weightTotal = 0;

  for (var i = 0; i < rows.length; i++){
    var slug = rows[i].querySelector('.cf-vs-input').value;
    var w    = parseInt(rows[i].querySelector('.cf-vw-input').value, 10);
    if (!slug){
      elCreateMsg.textContent = 'Select a slug for each variant row.';
      elCreateMsg.className = 'create-msg err'; show(elCreateMsg); return;
    }
    if (slugsSeen.has(slug)){
      elCreateMsg.textContent = 'Each variant must have a unique slug.';
      elCreateMsg.className = 'create-msg err'; show(elCreateMsg); return;
    }
    slugsSeen.add(slug);
    if (isNaN(w) || w < 1){
      elCreateMsg.textContent = 'Each variant weight must be a positive integer.';
      elCreateMsg.className = 'create-msg err'; show(elCreateMsg); return;
    }
    weightTotal += w;
    variants.push({ slug: slug, weight: w });
  }

  if (variants.length < 2){
    elCreateMsg.textContent = 'An experiment needs at least 2 variants.';
    elCreateMsg.className = 'create-msg err'; show(elCreateMsg); return;
  }
  if (weightTotal !== 100){
    elCreateMsg.textContent = 'Weights must sum to 100 (currently ' + weightTotal + ').';
    elCreateMsg.className = 'create-msg err'; show(elCreateMsg); return;
  }

  elCfSubmit.disabled = true;
  elCfSubmit.textContent = 'Creating\u2026';

  fetch('/api/ab', {
    method: 'PUT',
    headers: { 'Authorization': 'Bearer ' + tok(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ alias: alias, campaign: campaign, variants: variants }),
  })
  .then(function(r){ return r.json().then(function(d){ return { ok: r.ok, data: d }; }); })
  .then(function(res){
    if (res.ok){
      elCreateMsg.textContent = '\u2713 Experiment "' + esc(alias) + '" created (DRAFT \u2014 activate to start)';
      elCreateMsg.className = 'create-msg ok';
      show(elCreateMsg);
      silentCompile(); // alias now exists in CAMPAIGN_AB_ALIAS_INDEX — compile immediately
      loadAliases();
      setTimeout(function(){
        elAliasSel.value = alias;
        loadExperiment();
      }, 350);
    } else {
      elCreateMsg.textContent = 'Error: ' + esc(res.data.error || res.data.reason || 'unknown');
      elCreateMsg.className = 'create-msg err';
      show(elCreateMsg);
    }
  })
  .catch(function(){
    elCreateMsg.textContent = 'Network error \u2014 retry.';
    elCreateMsg.className = 'create-msg err';
    show(elCreateMsg);
  })
  .then(function(){
    elCfSubmit.disabled = false;
    elCfSubmit.textContent = 'Create';
  });
});

/* ── Rebalance Traffic (Prompt 68 S3) ──────────────────────────── */
function renderRebalance(variants, lifecycleState){
  if (!elRebalanceCard || !elRebalanceRows) return;
  /* Hide for terminal / non-running states */
  if (lifecycleState === 'ARCHIVED' || lifecycleState === 'DRAFT' || lifecycleState === 'DECIDED'){
    elRebalanceCard.style.display = 'none';
    return;
  }
  elRebalanceCard.style.display = '';
  elRebalanceRows.innerHTML = '';
  variants.forEach(function(v){
    var row = document.createElement('div');
    row.className = 'rbl-row';
    row.innerHTML =
      '<span class="rbl-label" title="' + esc(v.slug) + '">' + esc(v.slug) + '</span>' +
      '<input type="number" class="rbl-input" data-slug="' + esc(v.slug) + '" ' +
        'value="' + (v.weight != null ? v.weight : 50) + '" min="1" max="98" step="1"> ' +
      '<span class="rbl-pct">%</span>';
    row.querySelector('.rbl-input').addEventListener('input', updateRblTotal);
    elRebalanceRows.appendChild(row);
  });
  updateRblTotal();
}

function updateRblTotal(){
  if (!elRblTotal || !elRebalanceRows) return;
  var inputs = elRebalanceRows.querySelectorAll('.rbl-input');
  var total  = 0;
  inputs.forEach(function(inp){ total += parseInt(inp.value, 10) || 0; });
  elRblTotal.textContent  = 'Total: ' + total + ' / 100';
  elRblTotal.className    = 'rbl-total ' + (total === 100 ? 'ok' : 'err');
}

elBtnRebalance.addEventListener('click', function(){
  if (!currentAlias || !elRebalanceRows) return;
  var inputs = elRebalanceRows.querySelectorAll('.rbl-input');
  var newVariants = [];
  var total = 0;
  inputs.forEach(function(inp){
    var w = parseInt(inp.value, 10);
    newVariants.push({ slug: inp.dataset.slug, weight: w });
    total += isNaN(w) ? 0 : w;
  });
  if (total !== 100){
    showRblMsg('err', 'Weights must sum to 100 (currently ' + total + ').');
    return;
  }
  for (var i = 0; i < newVariants.length; i++){
    if (!newVariants[i].weight || newVariants[i].weight < 1){
      showRblMsg('err', 'Each weight must be a positive integer.'); return;
    }
  }
  elBtnRebalance.disabled = true;
  elBtnRebalance.textContent = 'Saving\u2026';
  var payload = { alias: currentAlias, variants: newVariants };
  if (currentStrategy) payload.strategy = currentStrategy;
  if (currentEpsilon != null) payload.epsilon = currentEpsilon;
  fetch('/api/ab', {
    method: 'PUT',
    headers: { 'Authorization': 'Bearer ' + tok(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  .then(function(r){ return r.json().then(function(d){ return { ok: r.ok, data: d }; }); })
  .then(function(res){
    if (res.ok){
      currentVariants = newVariants;
      showRblMsg('ok', '\u2713 Weights saved.');
      silentCompile(); // push new weights into ROUTE_ALIAS immediately
      setTimeout(loadExperiment, 800);
    } else {
      showRblMsg('err', 'Error: ' + esc(res.data.error || res.data.reason || 'unknown'));
    }
  })
  .catch(function(){ showRblMsg('err', 'Network error \u2014 retry.'); })
  .then(function(){
    elBtnRebalance.disabled = false;
    elBtnRebalance.textContent = 'Save Weights';
  });
});

function showRblMsg(type, msg){
  elRebalanceMsg.className = 'lc-msg ' + type;
  elRebalanceMsg.textContent = msg;
  show(elRebalanceMsg);
}

/* ── Experiment Settings (Prompt 68 S4) ────────────────────────── */
function renderSettings(strategy, epsilon){
  if (!elSettingsCard) return;
  elSettingsCard.style.display = '';
  elSettingsStrat.value = strategy || '';
  elEpsField.style.display = (strategy === 'epsilon_greedy') ? '' : 'none';
  if (epsilon != null) elSettingsEps.value = epsilon;
}

elSettingsStrat.addEventListener('change', function(){
  if (!elEpsField) return;
  elEpsField.style.display = (elSettingsStrat.value === 'epsilon_greedy') ? '' : 'none';
});

elBtnSaveSettings.addEventListener('click', function(){
  if (!currentAlias || !currentVariants.length) return;
  var strategy = elSettingsStrat.value;
  var epsilon  = null;
  if (strategy === 'epsilon_greedy'){
    epsilon = parseFloat(elSettingsEps.value);
    if (isNaN(epsilon) || epsilon < 0 || epsilon > 1){
      showSettingsMsg('err', 'Epsilon must be between 0 and 1.'); return;
    }
  }
  elBtnSaveSettings.disabled = true;
  elBtnSaveSettings.textContent = 'Saving\u2026';
  var payload = { alias: currentAlias, variants: currentVariants };
  if (strategy) payload.strategy = strategy;
  if (epsilon != null) payload.epsilon = epsilon;
  fetch('/api/ab', {
    method: 'PUT',
    headers: { 'Authorization': 'Bearer ' + tok(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  .then(function(r){ return r.json().then(function(d){ return { ok: r.ok, data: d }; }); })
  .then(function(res){
    if (res.ok){
      currentStrategy = strategy;
      currentEpsilon  = epsilon;
      showSettingsMsg('ok', '\u2713 Settings saved.');
    } else {
      showSettingsMsg('err', 'Error: ' + esc(res.data.error || res.data.reason || 'unknown'));
    }
  })
  .catch(function(){ showSettingsMsg('err', 'Network error \u2014 retry.'); })
  .then(function(){
    elBtnSaveSettings.disabled = false;
    elBtnSaveSettings.textContent = 'Save Settings';
  });
});

function showSettingsMsg(type, msg){
  elSettingsMsg.className = 'lc-msg ' + type;
  elSettingsMsg.textContent = msg;
  show(elSettingsMsg);
}

/* ── Set Winner (Prompt 68 S5) — event delegation on variant tbody ── */
elTbody.addEventListener('click', function(e){
  if (!e.target || !e.target.classList.contains('btn-set-winner')) return;
  var slug = e.target.dataset.slug;
  if (!slug || !currentAlias) return;
  if (!confirm(
    'Declare \u201c' + slug + '\u201d as winner?\\n\\n' +
    'The experiment will transition to DECIDED state and all traffic will route to this variant.'
  )) return;
  fetch('/api/experiment/decide', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + tok(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ alias: currentAlias, winner: slug }),
  })
  .then(function(r){ return r.json().then(function(d){ return { ok: r.ok, data: d }; }); })
  .then(function(res){
    if (res.ok){
      elLcMsg.className   = 'lc-msg ok';
      elLcMsg.textContent = '\u2713 Winner declared: \u201c' + esc(slug) + '\u201d \u2014 state: LOCKED';
      show(elLcMsg);
      setTimeout(loadExperiment, 600);
    } else {
      elLcMsg.className   = 'lc-msg err';
      elLcMsg.textContent = 'Error: ' + esc(res.data.error || 'unknown');
      show(elLcMsg);
    }
  })
  .catch(function(){
    elLcMsg.className   = 'lc-msg err';
    elLcMsg.textContent = 'Network error \u2014 retry.';
    show(elLcMsg);
  });
});

/* ── Render all four layers ────────────────────────────────────── */
function renderDashboard(data){
  var variants      = Array.isArray(data.variants) ? data.variants : [];
  var winnerSlug    = data.winner || null;
  var storedWinner  = data.stored_winner || null;
  var lifecycleState = (typeof data.state === 'string' && data.state) ? data.state : 'RUNNING';

  currentAlias    = data.experiment || '';
  currentVariants = variants.map(function(v){ return { slug: v.slug, weight: v.weight }; });
  currentStrategy = data.strategy || '';
  currentEpsilon  = (data.epsilon != null) ? data.epsilon : null;

  /* ─ Layer 1: Status card ─────────────────────────────────────── */
  var totalExp = variants.reduce(function(s,v){ return s + v.exposures; }, 0);
  var anyBelow = variants.some(function(v){ return v.exposures < MIN_EXPOSURE; });

  /* Display state:
     DRAFT/PAUSED/ARCHIVED/DECIDED → trust KV lifecycle state directly
     RUNNING (KV)                  → compute from analytics (EARLY or RUNNING) */
  var displayState;
  if (lifecycleState === 'DRAFT' || lifecycleState === 'PAUSED' ||
      lifecycleState === 'ARCHIVED' || lifecycleState === 'DECIDED'){
    displayState = lifecycleState;
  } else {
    displayState = anyBelow ? 'LEARNING' : 'OPTIMIZING';
  }

  /* Card class */
  elScCard.className = 'status-card sc-' + (displayState === 'LEARNING' ? 'early' : (displayState === 'OPTIMIZING' ? 'running' : displayState.toLowerCase()));

  /* Badge */
  var badgeClass = {
    LEARNING:'b-early', OPTIMIZING:'b-running', DECIDED:'b-decided',
    PAUSED:'b-paused', ARCHIVED:'b-archived', DRAFT:'b-draft'
  };
  var badgeLabel = { ARCHIVED: 'EXPERIMENT CLOSED', DRAFT: 'DRAFT \u2014 NOT LIVE', DECIDED: 'LOCKED' };
  elScBadge.className   = 'sc-badge ' + (badgeClass[displayState] || 'b-early');
  elScBadge.textContent = badgeLabel[displayState] || displayState;

  /* Stats */
  elScExp.textContent    = data.experiment || '\u2014';
  elStatTraf.textContent = totalExp.toLocaleString();
  /* Lock icon when stored winner is known */
  var winnerLabel = storedWinner
    ? '<span class="material-symbols-outlined" style="font-size:15px;vertical-align:middle;margin-right:2px;color:var(--success)">lock</span>' + storedWinner
    : (winnerSlug ? '<span class="material-symbols-outlined" style="font-size:15px;vertical-align:middle;margin-right:2px;color:var(--warn)">help</span>' + winnerSlug : 'none');
  elStatWin.innerHTML  = winnerLabel;
  elStatVar.textContent  = variants.length;

  var conf = 'low';
  if (!anyBelow){ conf = (winnerSlug || storedWinner) ? 'high' : 'medium'; }
  if (lifecycleState === 'ARCHIVED' || lifecycleState === 'DRAFT') conf = '\u2014';
  elStatConf.textContent = conf;

  /* ─ Lifecycle controls ───────────────────────────────────────── */
  /* Clear previous message */
  elLcMsg.textContent = '';
  hide(elLcMsg);
  /* Hide all buttons first */
  [elBtnActivate, elBtnPause, elBtnResume, elBtnPromote, elBtnArchive, elBtnUnarchive, elBtnBandit].forEach(hide);

  elLcCard.style.display = '';   /* Always show the card; buttons control what's visible */

  if (lifecycleState === 'DRAFT'){
    /* DRAFT → only Activate available */
    show(elBtnActivate);
  } else if (lifecycleState === 'ARCHIVED'){
    /* ARCHIVED → only Unarchive available */
    show(elBtnUnarchive);
  } else if (lifecycleState === 'PAUSED'){
    show(elBtnResume);
    show(elBtnArchive);
  } else if (lifecycleState === 'DECIDED'){
    /* DECIDED → Promote only when stored_winner is set (spec requirement) */
    show(elBtnPause);
    if (storedWinner) show(elBtnPromote);
    show(elBtnArchive);
  } else {
    /* RUNNING / EARLY */
    show(elBtnPause);
    show(elBtnArchive);
    /* Bandit Update: lets admin recompute weights from latest counter data */
    show(elBtnBandit);
  }

  /* ─ Layer 2: Variant table (Prompt 67 S4 — Weight + Share cols,
                               Prompt 68 S5 — Set Winner button) ─ */
  elTbody.innerHTML = '';
  var totalExpForShare = variants.reduce(function(s,v){ return s + v.exposures; }, 0);
  /* Set Winner button visible when experiment is in a decidable state */
  var canSetWinner = (lifecycleState === 'RUNNING' || lifecycleState === 'PAUSED');
  variants.forEach(function(v, i){
    var isWinner   = (v.slug === winnerSlug);
    var isBaseline = (i === 0);
    var rowCls     = isWinner ? 'row-winner' : (isBaseline ? 'row-baseline' : 'row-losing');

    /* Prefer conversion_lift; fall back to CTR lift */
    var liftVal = (v.conversion_lift !== null && v.conversion_lift !== undefined)
      ? v.conversion_lift : v.lift;

    var liftHtml;
    if (isBaseline){
      liftHtml = '<span style="color:var(--text-m)">baseline</span>';
    } else if (liftVal === null || liftVal === undefined){
      liftHtml = '<span style="color:var(--text-m)">\u2014</span>';
    } else if (liftVal >= 0){
      liftHtml = '<span style="color:var(--success)">+' + (liftVal * 100).toFixed(1) + '%</span>';
    } else {
      liftHtml = '<span style="color:var(--danger)">'  + (liftVal * 100).toFixed(1) + '%</span>';
    }

    var winnerPill = isWinner
      ? ' <span class="winner-pill"><span class="material-symbols-outlined" style="font-size:11px;vertical-align:text-bottom">workspace_premium</span> Winner</span>' : '';

    /* Set Winner button (Prompt 68 S5) */
    var setWinnerBtn = (!isWinner && canSetWinner)
      ? '<button class="btn-set-winner" data-slug="' + esc(v.slug) + '"><span class="material-symbols-outlined" style="font-size:13px">lock</span> Set Winner</button>'
      : '';

    /* Weight (configured) + Share (actual from traffic) */
    var weightStr = v.weight != null ? v.weight + '%' : '\u2014';
    var shareStr  = totalExpForShare > 0
      ? (v.exposures / totalExpForShare * 100).toFixed(1) + '%'
      : '\u2014';

    var tr = document.createElement('tr');
    tr.className = rowCls;
    tr.innerHTML =
      '<td>' + esc(v.slug) + winnerPill + setWinnerBtn + '</td>' +
      '<td style="color:var(--text-m)">' + weightStr + '</td>' +
      '<td style="color:var(--text-m)">' + shareStr  + '</td>' +
      '<td>' + v.exposures.toLocaleString() + '</td>' +
      '<td>' + v.clicks.toLocaleString() + '</td>' +
      '<td>' + v.conversions.toLocaleString() + '</td>' +
      '<td>' + (v.conversion_rate * 100).toFixed(2) + '%</td>' +
      '<td>' + liftHtml + '</td>';
    elTbody.appendChild(tr);
  });

  /* ─ Rebalance Traffic (Prompt 68 S3) ────────────────────────── */
  renderRebalance(variants, lifecycleState);

  /* ─ Experiment Settings (Prompt 68 S4) ──────────────────────── */
  renderSettings(currentStrategy, currentEpsilon);

  /* ─ Health card ──────────────────────────────────────────────── */
  renderHealth(variants, lifecycleState, storedWinner);

  /* ─ Layer 2.5: Traffic Distribution ─────────────────────────── */
  renderDistribution(variants, lifecycleState);

  /* ─ Layer 3: Chart ───────────────────────────────────────────── */
  var hasEnoughData = variants.some(function(v){ return v.exposures >= MIN_EXPOSURE; });
  if (!hasEnoughData || typeof Chart === 'undefined'){
    elChartWrap.style.display = 'none';
    show(elChartNone);
  } else {
    elChartWrap.style.display = '';
    hide(elChartNone);
    renderChart(variants, winnerSlug);
  }

  /* ─ Layer 3.5: Operator Breakdown ───────────────────────────── */
  renderOperatorBreakdown(variants);

  /* ─ Layer 3.6 + 3.7: Conversion breakdowns (Prompt 65) ──────── */
  var aliasConv = Array.isArray(data.alias_conversions) ? data.alias_conversions : [];
  var linkConv  = Array.isArray(data.link_conversions)  ? data.link_conversions  : [];
  renderConvBreakdown(elConvAliasCard, elConvAliasTbody, aliasConv, 'alias');
  renderConvBreakdown(elConvLinkCard,  elConvLinkTbody,  linkConv,  'link');

  /* ─ Layer 4: Advanced placeholder ───────────────────────────── */
  /* Breakdowns are not yet stored in KV — tiles show "not collected yet". */
}

/* ── Experiment Health ─────────────────────────────────────────── */
function renderHealth(variants, lifecycleState, storedWinner){
  if (!elHealthCard || !elHealthChecks) return;

  var totalExp      = variants.reduce(function(s,v){ return s + v.exposures; }, 0);
  var winnerRouting = (lifecycleState === 'DECIDED' || lifecycleState === 'ARCHIVED');

  /* 1.1 Adaptive sample size: max(50, 5% of total exposures).
     Prevents large-traffic experiments from validating winners against a fixed
     small threshold that becomes negligible at scale. */
  var adaptiveMin = Math.max(MIN_SAMPLE, Math.floor(totalExp * 0.05));
  var warnings    = [];

  /* 1.2 Inactive variant — only flag once experiment has received traffic.
     Suppresses false warnings for brand-new experiments with 0 total exposures. */
  if (totalExp > 0){
    variants.forEach(function(v){
      if (v.exposures === 0){
        warnings.push({ type: 'warn', icon: 'warning', text: 'Variant inactive \u2014 ' + v.slug + ' has received no traffic' });
      }
    });
  }

  /* 2. Sample size guard — variants with traffic but below adaptive threshold */
  var belowSample = variants.filter(function(v){ return v.exposures > 0 && v.exposures < adaptiveMin; });
  if (belowSample.length){
    warnings.push({ type: 'warn', icon: 'warning', text: 'Sample size too small \u2014 need \u2265\u202f' + adaptiveMin + ' exposures per variant; winner conclusions may be unreliable' });
  }

  /* 1.3 Traffic imbalance — skip in winner-routing states AND before minimum
     sample size is reached (early low-traffic skew causes false positives). */
  if (!winnerRouting && totalExp >= adaptiveMin){
    var imbalanced = variants.some(function(v){
      if (v.weight == null) return false;
      return Math.abs((v.exposures / totalExp * 100) - v.weight) > 10;
    });
    if (imbalanced){
      warnings.push({ type: 'warn', icon: 'warning', text: 'Traffic imbalance \u2014 actual distribution differs from configured weights by >10 pp' });
    }
  }

  /* 4. Winner mode indicator */
  if (winnerRouting && storedWinner){
    warnings.push({ type: 'info', icon: 'workspace_premium', text: 'Winner mode active \u2014 traffic routed to \u201c' + storedWinner + '\u201d' });
  }

  elHealthChecks.innerHTML = '';
  if (warnings.length === 0){
    var ok = document.createElement('div');
    ok.className = 'health-item h-ok';
    ok.innerHTML = '<span class="health-icon"><span class="material-symbols-outlined" style="font-size:16px">check_circle</span></span><span>Experiment healthy</span>';
    elHealthChecks.appendChild(ok);
  } else {
    warnings.forEach(function(w){
      var item = document.createElement('div');
      item.className = 'health-item h-' + w.type;
      item.innerHTML = '<span class="health-icon"><span class="material-symbols-outlined" style="font-size:16px">' + w.icon + '</span></span><span>' + esc(w.text) + '</span>';
      elHealthChecks.appendChild(item);
    });
  }

  elHealthCard.style.display = '';
}

/* ── Traffic Distribution ──────────────────────────────────────── */
function renderDistribution(variants, lifecycleState){
  if (!elDistCard || !elDistRows) return;

  var totalExp = variants.reduce(function(s,v){ return s + v.exposures; }, 0);
  if (totalExp === 0){
    elDistCard.style.display = 'none';
    return;
  }
  elDistCard.style.display = '';
  elDistRows.innerHTML = '';

  /* In winner-routing states (DECIDED/ARCHIVED) the distribution legitimately
     diverges from configured weights — suppress the imbalance warning and show
     an informational note instead (this is expected behaviour, not a bug). */
  var winnerRouting = (lifecycleState === 'DECIDED' || lifecycleState === 'ARCHIVED');
  var imbalanceFound = false;

  variants.forEach(function(v){
    var actualPct   = Math.round((v.exposures / totalExp) * 1000) / 10;  // 1 dp
    var expectedPct = (v.weight != null) ? v.weight : null;
    var diff        = (expectedPct != null) ? Math.abs(actualPct - expectedPct) : 0;
    /* Only flag as imbalance when NOT in winner-routing mode */
    var isImbalance = !winnerRouting && (expectedPct != null) && diff > 10;
    if (isImbalance) imbalanceFound = true;

    var row = document.createElement('div');
    row.className = 'dist-row' + (isImbalance ? ' dist-imbalance' : '');
    row.innerHTML =
      '<span class="dist-label" title="' + esc(v.slug) + '">' + esc(v.slug) + '</span>' +
      '<div class="dist-bar-wrap"><div class="dist-bar" style="width:' + Math.min(100, actualPct) + '%"></div></div>' +
      '<span class="dist-pct">'     + actualPct.toFixed(1) + '%</span>' +
      '<span class="dist-expected">' + (expectedPct != null ? 'w:&nbsp;' + expectedPct + '%' : '&mdash;') + '</span>';
    elDistRows.appendChild(row);
  });

  if (winnerRouting){
    elDistWarning.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;margin-right:4px">info</span> Winner routing active \u2014 distribution reflects winner enforcement, not configured weights.';
    show(elDistWarning);
  } else if (imbalanceFound){
    elDistWarning.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;margin-right:4px">warning</span> Traffic imbalance \u2014 actual distribution differs from configured weights by >10 pp for one or more variants.';
    show(elDistWarning);
  } else {
    hide(elDistWarning);
  }
}

/* ── Operator Breakdown ────────────────────────────────────────── */
// Variant × source dimension foundation.
// Displays per-variant aggregate totals as the "source: (aggregate)" row.
// Per-source rows will be added once source-level counter instrumentation
// is in place (future prompt).
function renderOperatorBreakdown(variants){
  if (!elOperatorCard || !elOperatorTbody) return;

  var totalExp = variants.reduce(function(s,v){ return s + v.exposures; }, 0);
  if (totalExp === 0){
    elOperatorCard.style.display = 'none';
    return;
  }
  elOperatorCard.style.display = '';
  elOperatorTbody.innerHTML = '';

  variants.forEach(function(v){
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + esc(v.slug) + '</td>' +
      '<td><span class="op-source">(aggregate)</span></td>' +
      '<td>' + v.exposures.toLocaleString() + '</td>' +
      '<td>' + v.clicks.toLocaleString() + '</td>' +
      '<td>' + v.conversions.toLocaleString() + '</td>';
    elOperatorTbody.appendChild(tr);
  });
}

/* ── Conversion Breakdown (Prompt 65) ──────────────────────────── */
// Generic renderer for both "Conversion by Alias" and "Conversion by Hub Link".
// rows: [{ name: string, conversions: number }] — already sorted desc by API.
function renderConvBreakdown(card, tbody, rows, type){
  if (!card || !tbody) return;

  tbody.innerHTML = '';

  if (!rows || rows.length === 0){
    card.style.display = 'none';
    return;
  }

  card.style.display = '';

  var total = rows.reduce(function(s, r){ return s + r.conversions; }, 0);

  rows.forEach(function(row){
    var pct = total > 0 ? Math.round((row.conversions / total) * 100) : 0;
    var tr  = document.createElement('tr');
    tr.innerHTML =
      '<td><span class="brk-name">' + esc(row.name) + '</span>' +
        '<span style="font-size:.74rem;color:var(--text-m);margin-left:.5rem">' + pct + '%</span>' +
      '</td>' +
      '<td class="brk-count">' + row.conversions.toLocaleString() + '</td>';
    tbody.appendChild(tr);
  });
}

/* ── Chart.js bar chart ────────────────────────────────────────── */
function renderChart(variants, winnerSlug){
  var dark = window.matchMedia('(prefers-color-scheme:dark)').matches;

  var labels    = variants.map(function(v){ return v.slug; });
  var convRates = variants.map(function(v){
    return parseFloat((v.conversion_rate * 100).toFixed(2));
  });
  var ctrRates  = variants.map(function(v){
    return parseFloat((v.ctr * 100).toFixed(2));
  });

  var convColors  = variants.map(function(v){
    return v.slug === winnerSlug
      ? (dark ? 'rgba(61,186,110,.85)'  : 'rgba(45,125,79,.78)')
      : (dark ? 'rgba(255,255,255,.22)' : 'rgba(17,17,17,.16)');
  });
  var convBorders = variants.map(function(v){
    return v.slug === winnerSlug
      ? (dark ? '#3DBA6E' : '#2D7D4F')
      : (dark ? 'rgba(255,255,255,.35)' : 'rgba(17,17,17,.28)');
  });
  var tickColor = dark ? '#888888' : '#666666';
  var gridColor = dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.05)';

  if (chartInst){ chartInst.destroy(); chartInst = null; }

  chartInst = new Chart(elChartCanvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Conv. Rate (%)',
          data:  convRates,
          backgroundColor: convColors,
          borderColor:     convBorders,
          borderWidth: 1.5,
          borderRadius: 4,
          order: 1,
        },
        {
          label: 'CTR (%)',
          data:  ctrRates,
          backgroundColor: dark ? 'rgba(255,255,255,.09)' : 'rgba(17,17,17,.07)',
          borderColor:     dark ? 'rgba(255,255,255,.22)' : 'rgba(17,17,17,.16)',
          borderWidth: 1,
          borderRadius: 4,
          order: 2,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: tickColor, font: { size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: function(ctx){
              return ctx.dataset.label + ': ' + ctx.raw + '%';
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: tickColor, font: { size: 11 } },
          grid:  { color: gridColor }
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: tickColor,
            font: { size: 11 },
            callback: function(v){ return v + '%'; }
          },
          grid: { color: gridColor }
        }
      }
    }
  });
}

})();
</script>
</body>
</html>`;
} // end buildPage()

// ── Route handler ─────────────────────────────────────────────────────────────

export async function onRequestGet(context) {
  const env    = context?.env ?? {};
  const branch = env.CF_PAGES_BRANCH     || "";
  const sha    = env.CF_PAGES_COMMIT_SHA || "";
  return new Response(buildPage(branch, sha), {
    status:  200,
    headers: {
      "Content-Type":           "text/html;charset=UTF-8",
      "Cache-Control":          "no-store",
      "X-Robots-Tag":           "noindex,nofollow",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy":        "no-referrer",
    },
  });
}
