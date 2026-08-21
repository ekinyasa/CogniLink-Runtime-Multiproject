
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
