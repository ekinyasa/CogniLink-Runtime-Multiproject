
window.openNewIntentModal = function(e) {
  if (e) e.preventDefault();
  var modal = document.getElementById('modal-new-intent');
  if (modal) {
    modal.style.display = 'flex';
    console.log("Modal opened");
  } else {
    alert("Modal element not found in DOM!");
  }
};
(function () {
  "use strict";

  /* ── State ──────────────────────────────────────────── */

  /* ── Applications Logic ──────────────────────────────────── */
  var btnRefreshApps = document.getElementById("btn-refresh-apps");
  var tblAppsBody = document.querySelector("#tbl-apps tbody");
  var appDetailCard = document.getElementById("app-detail-card");
  var appEditForm = document.getElementById("app-edit-form");

  function loadApplications() {
    apiFetch("/api/admin/applications?limit=50")
      .then(res => res.json())
      .then(data => {
        tblAppsBody.innerHTML = "";
        if (data && data.applications) {
          data.applications.forEach(function(app) {
            var tr = document.createElement("tr");
            tr.style.borderBottom = "1px solid var(--border)";
            tr.style.cursor = "pointer";
            tr.onclick = function() { window.editApp(app.id); };
            tr.onmouseover = function() { this.style.backgroundColor = "var(--surface)"; };
            tr.onmouseout = function() { this.style.backgroundColor = ""; };
            
            var d = new Date(app.created_at * 1000);
            var formattedDate = d.getDate() + "." + (d.getMonth() + 1) + "." + d.getFullYear() + " - " + String(d.getHours()).padStart(2, '0') + ":" + String(d.getMinutes()).padStart(2, '0');
            
            var contact = app.email || app.phone || "Unknown";
            var intentStr = app.intent ? (app.intent.charAt(0).toUpperCase() + "-" + (app.product || app.intent)) : (app.product || "-");
            
            tr.innerHTML = "<td>" + esc(formattedDate) + "</td>" +
                           "<td>" + esc(contact) + "</td>" +
                           "<td>" + esc(app.status) + "</td>" +
                           "<td>" + esc(intentStr) + "</td>";
            tblAppsBody.appendChild(tr);
          });
        }
      })
      .catch(err => console.error("Error loading apps:", err));
  }

  function renderRawData(payload) {
    if (!payload) return "-";
    var html = "";
    for (var key in payload) {
      if (payload.hasOwnProperty(key) && key !== "_redirect") {
        var displayKey = key.replace(/([A-Z])/g, " $1");
        displayKey = displayKey.charAt(0).toUpperCase() + displayKey.slice(1);
        if (key === "tcKimlik") displayKey = "Tc Kimlik";
        if (key === "dogumTarihi") displayKey = "Dogum Tarihi";
        
        var val = payload[key];
        if (key === "dogumTarihi" && typeof val === "string") {
          var parts = val.split("-");
          if (parts.length === 3) val = parts[2] + "." + parts[1] + "." + parts[0];
        }
        
        html += "<strong>" + esc(displayKey) + ":</strong> " + esc(String(val)) + "<br>";
      }
    }
    return html;
  }

  window.editApp = function(id) {
    apiFetch("/api/admin/applications/" + id)
      .then(res => res.json())
      .then(app => {
        document.getElementById("f-app-id").value = app.id;
        document.getElementById("f-app-status").value = app.status;
        document.getElementById("f-app-working-data").value = JSON.stringify(app.working_payload || {}, null, 2);
        
        document.getElementById("app-raw-data-panel").innerHTML = renderRawData(app.original_payload);
        
        var prov = "Slug: " + (app.slug || "-") + "\n" +
                   "Campaign: " + (app.campaign || "-") + "\n" +
                   "Version: " + (app.landing_version || "-") + "\n" +
                   "Intent: " + (app.intent || "-");
        document.getElementById("app-provenance").textContent = prov;
        
        appDetailCard.style.display = "block";
        document.getElementById("app-save-msg").textContent = "";
      })
      .catch(err => alert("Failed to load application"));
  };

  if (appEditForm) {
    appEditForm.addEventListener("submit", function(e) {
      e.preventDefault();
      var id = document.getElementById("f-app-id").value;
      var status = document.getElementById("f-app-status").value;
      var working_data_str = document.getElementById("f-app-working-data").value;
      
      var working_payload;
      try {
        working_payload = JSON.parse(working_data_str);
      } catch (err) {
        return alert("Invalid JSON in Working Data");
      }
      
      apiFetch("/api/admin/applications/" + id, {
        method: "PUT",
        body: JSON.stringify({ status: status, working_payload: working_payload })
      })
      .then(res => {
        if (!res.ok) throw new Error("API Error");
        document.getElementById("app-save-msg").textContent = "Saved!";
        setTimeout(function() { document.getElementById("app-save-msg").textContent = ""; }, 2000);
        loadApplications();
      })
      .catch(err => alert("Failed to save application: " + err));
    });
  }

  if (btnRefreshApps) {
    btnRefreshApps.addEventListener("click", loadApplications);
  }
  document.addEventListener("click", function(e) {
    if (e.target && e.target.classList.contains("tab-btn") && e.target.dataset.tab === "applications") {
      if (!window.applicationsTabLoaded) {
        window.applicationsTabLoaded = true;
        loadApplications();
      }
    }
  });
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
    loadComponents();
  }

  /* ── Tabs ────────────────────────────────────────────── */
  var pagesTabLoaded = false;
    // --- NEW INTENT MODAL LOGIC ---
    var newIntentBtn = document.getElementById("btn-studio-new-intent");
    var modal = document.getElementById("modal-new-intent");
    var cancelBtn = document.getElementById("btn-cancel-new-intent");
    var confirmBtn = document.getElementById("btn-confirm-new-intent");
    var idInput = document.getElementById("new-intent-id");
    var productInput = document.getElementById("new-intent-product");

    if (newIntentBtn && !newIntentBtn.dataset.wired) {
      newIntentBtn.dataset.wired = "1";
      
      newIntentBtn.addEventListener("click", function () {
        idInput.value = "";
        productInput.value = "";
        modal.style.display = "flex";
      });
      cancelBtn.addEventListener("click", function() {
        modal.style.display = "none";
      });
      confirmBtn.addEventListener("click", async function() {
        var name = idInput.value.trim().toLowerCase();
        var product = productInput.value.trim();
        if (!name) {
          alert("Intent Name is required.");
          return;
        }
        if (name.length > 1 && !/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(name)) {
          alert("Invalid name. Lowercase letters, numbers, hyphens (no leading/trailing hyphen).");
          return;
        }
        
        confirmBtn.disabled = true;
        confirmBtn.textContent = "Creating...";
        try {
          var createBody = { name: name, alias: name, product: product || null };
          if (typeof selectedWorkspace !== "undefined" && selectedWorkspace) createBody.workspace = selectedWorkspace;
          var res = await apiFetch("/api/campaign", {
            method: "POST", body: JSON.stringify(createBody)
          });
          var data = await res.json();
          if (res.ok) {
            modal.style.display = "none";
            if (typeof loadCampaignList === "function") await loadCampaignList();
            if (typeof selectCampaign === "function") selectCampaign(name);
            else if (typeof window.selectCampaign === "function") window.selectCampaign(name);
          } else {
            alert("Error: " + (data.error || "Failed to create intent"));
          }
        } catch (e) {
          alert("Failed to create intent: " + e.toString());
        } finally {
          confirmBtn.disabled = false;
          confirmBtn.textContent = "Create Intent";
        }
      });
    }
    // ------------------------------
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
      .replace(/s+/g, "_").replace(/[^a-z0-9_-]/g, "")
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
      
      // Collect unique products
      var productsSet = new Set();
      campaigns.forEach(function(c) {
        if (c.product) productsSet.add(c.product);
      });
      var products = Array.from(productsSet).sort();
      function esc(s) { return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
      
      var filterSelect = document.getElementById("filter-intent-product");
      if (filterSelect) {
        var currentFilterVal = filterSelect.value;
        filterSelect.innerHTML = '<option value="">All Products</option>';
        products.forEach(function(p) {
          filterSelect.innerHTML += '<option value="' + esc(p) + '">' + esc(p) + '</option>';
        });
        filterSelect.value = currentFilterVal;
      }
      
      var dataList = document.getElementById("intent-products-list");
      if (dataList) {
        dataList.innerHTML = "";
        products.forEach(function(p) {
          dataList.innerHTML += '<option value="' + esc(p) + '">';
        });
      }

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
            '<a class="campaign-name" href="#" data-name="' + esc(c.name) + '" style="font-weight:bold; color:var(--primary); text-decoration:none;">' + esc(c.name) + '</a> ' +
            (c.product ? ' <span style="font-size:0.7rem; color:var(--text-m); background:var(--bg); border: 1px solid var(--border); padding: 0.1rem 0.3rem; border-radius: 3px;">' + esc(c.product) + '</span>' : '') +
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
      $("cfg-custom-js").value   = cfg.customScript || "";
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
        customScript:   $("cfg-custom-js").value.trim()    || null,
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
          '<input type="text" id="c-version-cta-label" placeholder="e.g. WhatsApp\'tan Yazın" />' +

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

          var msg = "Are you sure you want to delete the component family '" + family.family_name + "'?\nThis will hard-delete the family and all its versions.";
          var totalUsage = matchingPages.length + matchingSlugs.length;
          if (totalUsage > 0) {
            msg += "\n\nWARNING: This component is currently used by " + totalUsage + " layouts:\n" +
                   (matchingPages.length ? "- Pages: " + matchingPages.join(", ") + "\n" : "") +
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
            msg += "\nThis is the last version, so the entire component family will be deleted.";
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
      "<!-- 1. KARTRA LANDING PAGE SCRIPT (Cross-Domain Tracker) -->\n" +
      "<!-- Ilk inilen sayfanin <head> veya <body> kismina ekleyin -->\n" +
      sTop + "\n" + snipLanding + "\n" + sEnd + "\n\n" +
      "<!-- 2. KARTRA THANK YOU PAGE SCRIPT (Conversion Firing) -->\n" +
      "<!-- Satin alma sonrasi gosterilen tesekkur sayfasina ekleyin -->\n" +
      sTop + "\n" + snipThankYou + "\n" + sEnd;

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

  /* ── Boot ────────────────────────────────────────────── */
  window.CUSTOM_DOMAIN = "runtime.ekinyasa.online";
  loadToken(); // Clears legacy token

  (async function initAuth() {
    try {
      // Validate session via protected endpoint silently (avoid apiFetch side effects on 401)
      var res = await fetch("/api/slugs?limit=1", { credentials: "same-origin" });
      if (res.ok) {
        token = "session";
        window.ADMIN_TOKEN = token; // Maintain global exposure for iframes
        showPanel();
      } else {
        showGate();
      }
    } catch (e) {
      showGate();
    }
  })();

  /* ── Campaign Workspace Studio Mode ──────────────── */
  var currentSelectedCampaign = null;
  var studioCampaignConfig = null;
  var studioCurrentEditingLanding = null;

  async function selectCampaign(campaignName) {
    var previousSelectedLandingId = studioCurrentEditingLanding ? studioCurrentEditingLanding.id : null;
    currentSelectedCampaign = campaignName;
    document.getElementById("workspace-title").textContent = campaignName;
    document.getElementById("intent-workspace").style.display = "flex";

    // Load campaign V2 config
    try {
      var res = await apiFetch("/api/admin/intent-routing");
      var data = await res.json();
      var configs = data.campaigns || [];
      studioCampaignConfig = configs.find(function (c) { return c.slug === campaignName; }) || {
        slug: campaignName,
        routing: null,
        landings: [],
        mainLandingId: ""
      };
      if (!studioCampaignConfig.landings) studioCampaignConfig.landings = [];

      var idemVal = document.getElementById("studio-intent-idem-val");
      var idemUnit = document.getElementById("studio-intent-idem-unit");
      if (idemVal && idemUnit) {
        if (studioCampaignConfig.idempotency) {
          idemVal.value = studioCampaignConfig.idempotency.val || "";
          idemUnit.value = studioCampaignConfig.idempotency.unit || "days";
        } else {
          idemVal.value = "30";
          idemUnit.value = "days";
        }
      }
      var routingEl = document.getElementById("studio-routing-config");
      if (routingEl) {
        if (studioCampaignConfig.routing && Object.keys(studioCampaignConfig.routing).length > 0) {
          routingEl.value = JSON.stringify(studioCampaignConfig.routing, null, 2);
        } else {
          routingEl.value = "";
        }
      }

      // Set values
    } catch(e) {
      studioCampaignConfig = {
        slug: campaignName,
        routing: null,
        landings: [],
        mainLandingId: ""
      };
      var idemVal = document.getElementById("studio-intent-idem-val");
      var idemUnit = document.getElementById("studio-intent-idem-unit");
      if (idemVal && idemUnit) {
        if (studioCampaignConfig.idempotency) {
          idemVal.value = studioCampaignConfig.idempotency.val || "";
          idemUnit.value = studioCampaignConfig.idempotency.unit || "days";
        } else {
          idemVal.value = "30";
          idemUnit.value = "days";
        }
      }
      var routingEl = document.getElementById("studio-routing-config");
      if (routingEl) routingEl.value = "";
    }

    // Set Campaign index metadata settings
    var campIndex = campaigns.find(function (c) { return c.name === campaignName; });
    document.getElementById("studio-campaign-alias").value = campIndex ? (campIndex.alias || "") : "";
    document.getElementById("studio-intent-product").value = campIndex ? (campIndex.product || "") : "";

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

    // removed obsolete default slug selector population

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

  function normalizeSlug(str) {
    if (!str) return "";
    return String(str)
      .toLowerCase()
      .trim()
      .replace(/^\/+|\/+$/g, "")
      .replace(/[^a-z0-9-_]/g, "-")
      .replace(/-+/g, "-");
  }

  function resolveBaseUrl() {
    var base = "";
    if (typeof window !== "undefined" && window.location) {
      base = window.location.origin;
    }
    if (!base && typeof window !== "undefined" && window.CUSTOM_DOMAIN) {
      base = "https://" + window.CUSTOM_DOMAIN;
    }
    if (!base) {
      base = "https://runtime.ekinyasa.online";
    }
    return base.replace(/\/+$/, "");
  }

  function buildLandingCanonicalUrl(slug) {
    var base = resolveBaseUrl();
    var clean = normalizeSlug(slug);
    return clean ? (base + "/l/" + clean) : "";
  }

  function buildLandingAliasUrl(alias) {
    if (!alias) return "";
    var base = resolveBaseUrl();
    var clean = normalizeSlug(alias);
    return clean ? (base + "/" + clean) : "";
  }

  function updateStudioUrlPreviews() {
    if (!studioCurrentEditingLanding) return;
    var slugVal = document.getElementById("studio-version-slug")?.value || studioCurrentEditingLanding.slug || studioCurrentEditingLanding.id;
    var aliasVal = document.getElementById("studio-version-alias")?.value || studioCurrentEditingLanding.alias || "";

    var cleanSlug = normalizeSlug(slugVal);
    var cleanAlias = aliasVal ? normalizeSlug(aliasVal) : "";

    var slugPreview = document.getElementById("studio-slug-preview");
    if (slugPreview) {
      slugPreview.textContent = cleanSlug ? buildLandingCanonicalUrl(cleanSlug) : "No slug set";
    }

    var aliasPreview = document.getElementById("studio-alias-preview");
    if (aliasPreview) {
      aliasPreview.textContent = cleanAlias ? buildLandingAliasUrl(cleanAlias) : "No alias set";
    }

    var isMain = studioCampaignConfig.mainLandingId === studioCurrentEditingLanding.id;
    var campSlugs = slugCache.filter(function (s) {
      return s.campaign === studioCampaignConfig.name && s.isActive !== false;
    });
    var slugForUrl = campSlugs.length > 0 ? campSlugs[0].slug : studioCampaignConfig.slug;
    var previewUrlPath = isMain ? ("/c/" + encodeURIComponent(slugForUrl)) : ("/l/" + encodeURIComponent(cleanSlug) + "?preview_version=" + encodeURIComponent(studioCurrentEditingLanding.id));
    var urlInput = document.getElementById("studio-version-url");
    if (urlInput) {
      urlInput.value = resolveBaseUrl() + previewUrlPath;
    }
  }

  function renderStudioVersionsList() {
    var container = document.getElementById("studio-version-list");
    var defSelect = document.getElementById("studio-default-version-select");

    if (defSelect) {
      defSelect.innerHTML = '';
      studioCampaignConfig.landings.forEach(function (l) {
        var opt = document.createElement("option");
        opt.value = l.id;
        var isPublished = (l.status || "draft").toLowerCase() === "published";
        opt.textContent = (l.displayName || l.id) + (l.id === studioCampaignConfig.mainLandingId ? " (Main)" : "") + (!isPublished ? " (" + (l.status || "draft") + ")" : "");
        defSelect.appendChild(opt);
      });
      defSelect.value = studioCampaignConfig.mainLandingId || "";
      defSelect.onchange = function(e) {
        setStudioMainLanding(e.target.value);
      };
    }

    container.innerHTML = "";
    if (studioCampaignConfig.landings.length === 0) {
      container.innerHTML = "<p style='color: var(--text-m); font-style: italic;'>No landing versions created yet.</p>";
      return;
    }

    studioCampaignConfig.landings.forEach(function (l) {
      // Fallback/migration mapping for legacy entries
      if (!l.displayName) l.displayName = l.id.replace("version-", "Version ");
      if (!l.slug) l.slug = l.id;
      if (!l.status) l.status = "draft";
      if (!l.updatedAt) l.updatedAt = new Date().toISOString();

      var isMain = studioCampaignConfig.mainLandingId === l.id;
      var createdFmt = l.updatedAt ? new Date(l.updatedAt).toLocaleString() : "—";
      var div = document.createElement("div");
      div.className = "version-item";
      div.style = "padding: 0.75rem; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 0.35rem;";

      // Status badge styling
      var statusLower = (l.status || "draft").toLowerCase();
      var statusBadgeHtml = "";
      if (statusLower === "published" || statusLower === "active") {
        statusBadgeHtml = '<span class="badge" style="font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; background: var(--success, #10b981); color: #ffffff; font-weight: 600; line-height: 1.2;">Published</span>';
      } else if (statusLower === "archived") {
        statusBadgeHtml = '<span class="badge" style="font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; background: var(--danger, #ef4444); color: #ffffff; font-weight: 600; line-height: 1.2;">Archived</span>';
      } else {
        // Draft / neutral styling - thin dashed border
        statusBadgeHtml = '<span class="badge" style="font-size: 0.7rem; padding: 1px 5px; border-radius: 4px; background: transparent; color: var(--text-m); border: 1px dashed var(--border); font-weight: 500; text-transform: capitalize; line-height: 1.2;">' + esc(l.status || "Draft") + '</span>';
      }

      // Main badge styling - accessible blue/indigo (independent of status)
      var mainBadgeHtml = isMain ? '<span class="badge" style="font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; background: #4f46e5; color: #ffffff; font-weight: 600; line-height: 1.2;">Main</span>' : '';

      // URL rows (Section 4)
      var canonicalUrl = buildLandingCanonicalUrl(l.slug || l.id);
      var aliasUrl = l.alias ? buildLandingAliasUrl(l.alias) : "";

      var canonicalRowHtml = "";
      var aliasRowHtml = "";

      if (statusLower === "published") {
        canonicalRowHtml = '<div style="font-size: 0.7rem; color: var(--text-m); margin-top: 0.25rem;">Canonical URL: <a href="' + esc(canonicalUrl) + '" target="_blank" rel="noopener noreferrer" style="color: var(--accent); font-family: monospace; text-decoration: none;">' + esc(canonicalUrl) + '</a></div>';
      } else if (statusLower === "archived") {
        canonicalRowHtml = '<div style="font-size: 0.7rem; color: var(--text-m); margin-top: 0.25rem;">Canonical URL: <span style="font-family: monospace;">' + esc(canonicalUrl) + '</span> <span style="color: var(--danger); font-style: italic;">(Archived - Not public)</span></div>';
      } else {
        // Draft
        canonicalRowHtml = '<div style="font-size: 0.7rem; color: var(--text-m); margin-top: 0.25rem;">Canonical URL: <span style="font-family: monospace;">' + esc(canonicalUrl) + '</span> <span style="font-style: italic;">(Draft - Not published)</span></div>';
      }

      if (l.alias) {
        if (statusLower === "published") {
          aliasRowHtml = '<div style="font-size: 0.7rem; color: var(--text-m); margin-top: 0.15rem;">Alias URL: <a href="' + esc(aliasUrl) + '" target="_blank" rel="noopener noreferrer" style="color: var(--accent); font-family: monospace; text-decoration: none;">' + esc(aliasUrl) + '</a></div>';
        } else {
          aliasRowHtml = '<div style="font-size: 0.7rem; color: var(--text-m); margin-top: 0.15rem;">Alias URL: <span style="font-family: monospace;">' + esc(aliasUrl) + '</span> <span style="font-style: italic;">(Inactive - ' + esc(l.status) + ')</span></div>';
        }
      } else {
        aliasRowHtml = '<div style="font-size: 0.7rem; color: var(--text-m); margin-top: 0.15rem;">Alias URL: <span style="font-style: italic;">—</span></div>';
      }

      div.innerHTML =
        '<div>' +
          '<div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">' +
            '<span style="font-weight: bold; font-size: 0.95rem; color: var(--text);">' + esc(l.displayName) + '</span>' +
            statusBadgeHtml +
            mainBadgeHtml +
          '</div>' +
          canonicalRowHtml +
          aliasRowHtml +
          '<div style="font-size: 0.7rem; color: var(--text-m); margin-top: 0.25rem;">Last updated: ' + esc(createdFmt) + '</div>' +
        '</div>' +
        '<div class="version-actions" style="display: flex; gap: 0.35rem; flex-wrap: wrap; margin-top: 0.25rem;">' +
          '<button class="btn-ghost btn-xs" style="border: 1px solid var(--border);" onclick="editStudioLanding(\x27' + esc(l.id) + '\x27)">Edit</button>' +
          '<button class="btn-ghost btn-xs" style="border: 1px solid var(--border);" onclick="previewStudioLanding(\x27' + esc(l.id) + '\x27)">Preview</button>' +
          '<button class="btn-ghost btn-xs" style="border: 1px solid var(--border);" onclick="setStudioMainLanding(\x27' + esc(l.id) + '\x27)" ' + (isMain ? 'disabled' : '') + '>Set as Main</button>' +
          '<button class="btn-ghost btn-xs" style="border: 1px solid var(--border);" onclick="duplicateStudioLanding(\x27' + esc(l.id) + '\x27)">Duplicate</button>' +
          '<button class="btn-ghost btn-xs" style="border: 1px solid var(--border);" onclick="toggleArchiveStudioLanding(\x27' + esc(l.id) + '\x27)">' + (l.status === "archived" ? "Restore" : "Archive") + '</button>' +
          '<button class="btn-danger btn-xs" onclick="deleteStudioLanding(\x27' + esc(l.id) + '\x27)" ' + (isMain ? 'disabled title="Cannot delete main landing version"' : '') + '>Delete</button>' +
        '</div>';
      container.appendChild(div);
    });
  }

  window.setStudioMainLanding = function(id) {
    var target = studioCampaignConfig.landings.find(function (l) { return l.id === id; });
    if (target && (target.status || "draft").toLowerCase() !== "published") {
      alert("Main landing version must be Published. Please publish this version before setting it as Main.");
      renderStudioVersionsList();
      return;
    }
    studioCampaignConfig.mainLandingId = id;
    renderStudioVersionsList();
  };

  window.previewStudioLanding = function(id) {
    if (!studioCampaignConfig) return;
    var campSlugs = slugCache.filter(function (s) {
      return s.campaign === studioCampaignConfig.name && s.isActive !== false;
    });
    var slug = campSlugs.length > 0 ? campSlugs[0].slug : studioCampaignConfig.slug;
    var isMain = studioCampaignConfig.mainLandingId === id;
    var url = "/c/" + encodeURIComponent(slug);
    if (!isMain) {
      url += "?preview_version=" + encodeURIComponent(id);
    }
    window.open(url, "_blank");
  };

  window.editStudioLanding = function(id) {
    studioCurrentEditingLanding = studioCampaignConfig.landings.find(function (l) { return l.id === id; });
    if (!studioCurrentEditingLanding) return;

    if (!studioCurrentEditingLanding.displayName) {
      studioCurrentEditingLanding.displayName = studioCurrentEditingLanding.id.replace("version-", "Version ");
    }
    if (!studioCurrentEditingLanding.slug) {
      studioCurrentEditingLanding.slug = studioCurrentEditingLanding.id;
    }
    if (!studioCurrentEditingLanding.status) {
      studioCurrentEditingLanding.status = "draft";
    }

    document.getElementById("studio-builder-panel").style.display = "flex";
    document.getElementById("studio-current-edit-version-title").textContent = studioCurrentEditingLanding.displayName;
    document.getElementById("studio-version-display-name").value = studioCurrentEditingLanding.displayName;
    document.getElementById("studio-version-name").value = studioCurrentEditingLanding.id;
    document.getElementById("studio-version-slug").value = studioCurrentEditingLanding.slug;
    document.getElementById("studio-version-alias").value = studioCurrentEditingLanding.alias || "";
    document.getElementById("studio-version-status").value = studioCurrentEditingLanding.status;
    document.getElementById("studio-version-title").value = studioCurrentEditingLanding.headerInfo?.title || "";
    document.getElementById("studio-version-theme").value = studioCurrentEditingLanding.theme || "dark";
    document.getElementById("studio-version-css").value = studioCurrentEditingLanding.customStyleCss || "";
    document.getElementById("studio-version-js").value = studioCurrentEditingLanding.customScript || "";

    updateStudioUrlPreviews();

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
      row.style = "display: flex; flex-direction: column; padding: 0.5rem; background: var(--bg); border: 1px solid var(--border); border-radius: 4px; gap: 0.5rem; margin-bottom: 0.5rem;";

      var labelText = item.type === "component" ? "Component: " + (item.family ? item.family + " v" + item.version : item.id) : "Custom HTML";

      var contentArea = "";
      if (item.type === "custom_html") {
        contentArea = '<div style="margin-top: 8px;"><textarea onchange="updateStudioHtmlContent(' + idx + ', this.value)" rows="5" placeholder="Enter custom HTML..." style="width:100%; font-family:monospace; font-size:12px; padding:6px; border:1px solid var(--border); background:var(--bg); color:var(--text); border-radius:4px; resize:vertical;">' + esc(item.content || "") + '</textarea><p style="margin:4px 0 0 0; font-size:11px; color:var(--text-m);">HTML content rendered in page order</p></div>';
      }

      row.innerHTML = '<div style="display: flex; justify-content: space-between; align-items: center;">' +
        '<span style="font-size: 0.8rem; font-weight: bold; color: var(--text-m);">' + (idx + 1) + '. ' + esc(labelText) + '</span>' +
        '<div style="display: flex; gap: 0.25rem;">' +
          '<button class="btn-ghost btn-xs" style="padding: 2px 6px;" onclick="moveStudioItem(' + idx + ', -1)">&uarr;</button>' +
          '<button class="btn-ghost btn-xs" style="padding: 2px 6px;" onclick="moveStudioItem(' + idx + ', 1)">&darr;</button>' +
          '<button class="btn-danger btn-xs" onclick="removeStudioItem(' + idx + ')">&times;</button>' +
        '</div>' +
      '</div>' + contentArea;
      
      container.appendChild(row);
    });
  }

  window.updateStudioHtmlContent = function(idx, val) {
    if (studioCurrentEditingLanding && studioCurrentEditingLanding.layout[idx]) {
      studioCurrentEditingLanding.layout[idx].content = val;
    }
  };

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

    var btnCopyUrl = document.getElementById("btn-studio-copy-url");
    if (btnCopyUrl && !btnCopyUrl.dataset.wired) {
      btnCopyUrl.dataset.wired = "1";
      btnCopyUrl.addEventListener("click", function () {
        var input = document.getElementById("studio-version-url");
        if (!input || !input.value) return;
        var ta = document.createElement("textarea");
        ta.value = input.value;
        document.body.appendChild(ta); ta.select();
        try { document.execCommand("copy"); } catch (e) {}
        document.body.removeChild(ta);
        btnCopyUrl.textContent = "Copied!";
        setTimeout(function () { btnCopyUrl.textContent = "Copy"; }, 2000);
      });
    }

    var btnOpenUrl = document.getElementById("btn-studio-open-url");
    if (btnOpenUrl && !btnOpenUrl.dataset.wired) {
      btnOpenUrl.dataset.wired = "1";
      btnOpenUrl.addEventListener("click", function () {
        var input = document.getElementById("studio-version-url");
        if (input && input.value) {
          window.open(input.value, "_blank");
        }
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
      { id: "studio-version-slug", prop: "slug", cb: function() {
          if (studioCurrentEditingLanding) {
            var raw = document.getElementById("studio-version-slug").value;
            studioCurrentEditingLanding.slug = normalizeSlug(raw);
          }
          updateStudioUrlPreviews();
          renderStudioVersionsList();
        }
      },
      { id: "studio-version-alias", prop: "alias", cb: function() {
          if (studioCurrentEditingLanding) {
            var raw = document.getElementById("studio-version-alias").value;
            studioCurrentEditingLanding.alias = raw ? normalizeSlug(raw) : "";
          }
          updateStudioUrlPreviews();
          renderStudioVersionsList();
        }
      },
      { id: "studio-version-status", prop: "status", cb: function() {
          if (studioCurrentEditingLanding && studioCampaignConfig) {
            var newStatus = (document.getElementById("studio-version-status").value || "draft").toLowerCase();
            var isMain = studioCampaignConfig.mainLandingId === studioCurrentEditingLanding.id;
            if (isMain && newStatus !== "published") {
              alert("The Main landing version must remain Published. Please set another version as Main before changing this version's status.");
              document.getElementById("studio-version-status").value = "published";
              studioCurrentEditingLanding.status = "published";
            }
          }
          renderStudioVersionsList();
        }
      },
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
        var product = document.getElementById("studio-intent-product").value.trim();
        var defaultSlug = null; // No longer used, handled by Intent mainLandingId

        var routingConfig = null;
        var rawRouting = document.getElementById("studio-routing-config") ? document.getElementById("studio-routing-config").value.trim() : "";
        if (rawRouting) {
          try {
            routingConfig = JSON.parse(rawRouting);
          } catch(e) {
            alert("Invalid JSON in Routing & Behavior Configuration: " + e.message);
            return;
          }
        }

        try {
          saveIntentBtn.disabled = true;
          saveIntentBtn.textContent = "Saving...";

          // 1. Save Patch Campaign Index Metadata (Alias, Product)
          var patchRes = await apiFetch("/api/campaign/" + encodeURIComponent(currentSelectedCampaign), {
            method: "PATCH",
            body: JSON.stringify({ alias: alias || null, product: product || null, defaultSlug: defaultSlug })
          });

          // 2. Save Routing Configuration
          var v2Ok = true;
          var v2ErrMsg = "";

          var idemValInput = document.getElementById("studio-intent-idem-val");
          var idemUnitInput = document.getElementById("studio-intent-idem-unit");
          if (idemValInput && idemValInput.value) {
            studioCampaignConfig.idempotency = {
              val: parseInt(idemValInput.value, 10),
              unit: idemUnitInput.value
            };
          } else {
            studioCampaignConfig.idempotency = null;
          }
          studioCampaignConfig.slug = currentSelectedCampaign;
          studioCampaignConfig.routing = routingConfig;

          var v2Res = await apiFetch("/api/admin/intent-routing", {
            method: "POST",
            body: JSON.stringify(studioCampaignConfig)
          });
          v2Ok = v2Res.ok;
          if (!v2Res.ok) {
            var err = await v2Res.json();
            v2ErrMsg = err.error || "Unknown error";
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
          var v2Res = await apiFetch("/api/admin/intent-routing", {
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

