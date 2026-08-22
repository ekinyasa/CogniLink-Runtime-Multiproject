/**
 * Renders the complete hub page HTML — v6.
 *
 * @param {object}  opts
 * @param {'route'|'campaign'} opts.contextType
 * @param {string}  opts.contextId      – 'ig' | 'youtube' | 'spotify' | slug
 * @param {string}  [opts.campaign]     – campaign name; sets utm_campaign and always wins
 *                                        over inbound params. Empty for route pages.
 * @param {object}  opts.defaultUtms    – route/campaign defaults (source + medium only)
 * @param {Array}   opts.links          – resolved link objects from resolveLinks()
 * @param {string}  [opts.ga4Id]
 * @param {string}  [opts.metaPixelId]
 * @param {boolean} [opts.notFound]
 * @param {object}  [opts.config]       – LANDING_CONFIG: { themeCssUrl, headerHtml, footerHtml, customStyleCss, baseLinks }
 * @param {string}  [opts.slug]         – slug name (for CSS scoping; empty for route pages)
 * @param {object}  [opts.slugData]     – full slug record (for per-slug landing customization)
 */
export function renderHub({
  contextType = "route",
  contextId = "ig",
  campaign = "",          // drives utm_campaign, always wins
  modifier = "",          // public URL modifier segment (/alias/<modifier>) — available in client JS
  defaultUtms = {},          // utm_source + utm_medium only; no utm_campaign here
  links = [],
  ga4Id = "",
  metaPixelId = "",
  notFound = false,
  config = {},          // LANDING_CONFIG
  slug = "",          // slug name for CSS scoping
  slugData = null,        // full slug KV record
  expToken = "",          // A/B exposure token (Prompt 130)
  utmVariant = "",          // A/B selected variant slug
  components = [],          // Live KV components (Prompt 140)
  isPreview = false,        // Admin preview mode flag
  intentConfig = {},        // Routing & Behavior JSON (Campaign V2)
} = {}) {
  const cfg = config || {};

  const utmsJson = JSON.stringify(defaultUtms);
  const intentConfigJson = JSON.stringify(intentConfig || {});
  const campaignJson = JSON.stringify(campaign || "");
  const modifierJson = JSON.stringify(modifier || "");
  const ctxTypeEsc = JSON.stringify(contextType);
  const ctxIdEsc = JSON.stringify(contextId);
  const signalsData = slugData?.signals || intentConfig?.signals || cfg?.signals || { time: [], clicks: { soft: [], hard: [] } };
  const signalsJson = JSON.stringify(signalsData);

  // Compile component HTML sections (Prompt 140 / User Request)
  var allowedComps = (components || []);
  var enabledSet = null;

  if (slugData && Array.isArray(slugData.components) && slugData.components.length > 0) {
    enabledSet = {};
    slugData.components.forEach(function (fid) { if (fid) enabledSet[fid] = true; });
  } else if (slugData && Array.isArray(slugData.layout)) {
    var compIdsFromLayout = slugData.layout
      .filter(function (x) { return x && x.type === "component" && x.id; })
      .map(function (x) { return x.id; });
    if (compIdsFromLayout.length > 0) {
      enabledSet = {};
      compIdsFromLayout.forEach(function (fid) { if (fid) enabledSet[fid] = true; });
    }
  }

  if (enabledSet) {
    allowedComps = allowedComps.filter(function (c) {
      return enabledSet[c.family_id] || enabledSet[c.family_key] || enabledSet[c.component_id];
    });
  } else {
    allowedComps = allowedComps.filter(function (c) {
      return c.family_status === "active" || c.status === "active";
    });
  }
  var placementOrder = { "hero": 1, "trust": 2, "process": 3, "objection": 4, "faq": 4, "cta": 5, "legal": 6, "footer": 7 };
  allowedComps.sort(function (a, b) {
    var pA = placementOrder[(a.placement_hint || a.type || "").toLowerCase()] || 99;
    var pB = placementOrder[(b.placement_hint || b.type || "").toLowerCase()] || 99;
    if (pA !== pB) return pA - pB;
    return (a.priority || 0) - (b.priority || 0);
  });

  var layoutHtml = "";
  const hasCustomLayout = !!(slugData && Array.isArray(slugData.layout));
  
  var renderComponentHtml = function (c) {
    var titleHtml = c.title ? '<h3 class="comp-title">' + escHtml(c.title) + '</h3>' : '';
    var ctaHtml = (c.cta_label && c.cta_url) ? '<div class="comp-cta"><a href="' + escAttr(c.cta_url) + '" class="comp-cta-btn">' + escHtml(c.cta_label) + '</a></div>' : '';
    return '<div class="comp-item comp-type-' + escAttr(c.type || "block") + ' comp-placement-' + escAttr(c.placement_hint || c.type || "block") + '" id="comp-' + escAttr(c.component_id) + '">' +
      titleHtml +
      '<div class="comp-body">' + (c.body || '') + '</div>' +
      ctaHtml +
      '</div>';
  };

  if (hasCustomLayout) {
    slugData.layout.forEach(function (item) {
      if (item.type === "component") {
        var c = allowedComps.find(function (x) { return x.family_id === item.id || x.family_key === item.id || x.component_id === item.id; });
        if (c) {
          layoutHtml += renderComponentHtml(c);
        } else if (isPreview) {
          layoutHtml += '<div style="border:1px dashed #ff4444; padding:15px; margin: 10px 0; background:rgba(255,0,0,0.05); color:#ff4444; text-align:center; font-family:monospace; font-size:12px; border-radius:4px;">[Preview Mode] Component Not Found or Inactive: ' + escHtml(item.id) + '</div>';
        }
      } else if (item.type === "custom_html") {
        layoutHtml += item.content || item.body || "";
      }
    });
  }

  var compsHtml = { hero: "", body: "", legal: "", footer: "" };
  allowedComps.forEach(function (c) {
    var p = (c.placement_hint || c.type || "").toLowerCase();
    var html = renderComponentHtml(c);
    if (p === "hero") compsHtml.hero += html;
    else if (p === "legal") compsHtml.legal += html;
    else if (p === "footer") compsHtml.footer += html;
    else compsHtml.body += html;
  });

  // Config-driven extras
  const themeCssLink = cfg.themeCssUrl
    ? `<link rel="stylesheet" href="${escAttr(cfg.themeCssUrl)}">`
    : "";

  // Title resolution order
  const finalTitle = (slugData?.headerInfo?.title && String(slugData.headerInfo.title).trim()) || 
                     (cfg.pageTitle && String(cfg.pageTitle).trim()) || 
                     "CogniLink";

  // Per-page header/footers only (global fallbacks headerHtml/footerHtml are removed)
  const headerRaw = slugData?.customHeaderHtml || "";
  const footerRaw = slugData?.customFooterHtml || "";

  // Raw HTML injection (no escaping)
  const headerHtml = headerRaw
    ? `<div class="hub-header">${headerRaw}</div>`
    : "";
  const footerHtml = footerRaw
    ? `<div class="hub-footer">${footerRaw}</div>`
    : "";

  // Global Custom CSS block as a natively-hosted external stylesheet with cache busting
  const globalCssLink = cfg.customStyleCss
    ? `\n<link rel="stylesheet" href="/global-assets/main.css?v=${escAttr(cfg.cssVersion || "1")}">`
    : "";

  // Global Custom JS block as a natively-hosted external script with cache busting
  const globalJsLink = cfg.customScript
    ? `\n<script src="/global-assets/main.js?v=${escAttr(cfg.jsVersion || "1")}"></script>`
    : "";

  // Page-level Custom CSS block (unscoped)
  const slugId = slug || "";
  const pageCssRaw = slugData?.customStyleCss || "";
  let pageCssBlock = "";
  if (pageCssRaw) {
    pageCssBlock = `\n<style>\n${pageCssRaw}\n</style>`;
  }

  // Load old HUB_CSS conditionally (only when rendering link buttons)
  const baseCssBlock = `<style>${BASE_CSS}</style>`;

  // Body tag: add id for CSS scoping on campaign pages
  const bodyTag = slugId ? `<body id="slug-${escAttr(slugId)}">` : "<body>";

  /* ── GA4 snippet ──────────────────────────────────────────────── */
  const ga4Snippet = ga4Id ? `
  <script async src="https://www.googletagmanager.com/gtag/js?id=${ga4Id}"></script>
  <script>
    window.dataLayer=window.dataLayer||[];
    function gtag(){dataLayer.push(arguments);}
    gtag('js',new Date());
    gtag('config','${ga4Id}',{send_page_view:true});
  </script>` : "";

  /* ── Meta Pixel snippet ───────────────────────────────────────── */
  const pixelSnippet = metaPixelId ? `
  <script>
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){
    n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;
    s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
    (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq('init','${metaPixelId}');
    fbq('track','PageView');
  </script>
  <noscript><img height="1" width="1" style="display:none"
    src="https://www.facebook.com/tr?id=${metaPixelId}&ev=PageView&noscript=1"/></noscript>` : "";

  /* ── 404 variant ──────────────────────────────────────────────── */
  if (notFound) {
    return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${escHtml(finalTitle)}</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
${ga4Snippet}${pixelSnippet}
${baseCssBlock}
${themeCssLink}
</style>
</head>
<body>
<div class="page-shell">
  <p class="not-found-msg" style="text-align:center;font-size:.9375rem;opacity:.55;margin:2.5rem 0;">Aradığınız sayfa aktif değil veya bulunamadı.</p>
</div>
</body>
</html>`;
  }

  // ----------------------------------------------------
  // V1 POST-SUBMIT ARCHITECTURE: DYNAMIC THANK YOU PAGES
  // ----------------------------------------------------
  let finalBodyContent = "";
  if (modifier === "thanks") {
    // Override the normal layout/components with a clean, inherited Thank You component.
    finalBodyContent = `
      <section style="min-height: 50vh; display: flex; align-items: center; justify-content: center; text-align: center; padding: 4rem 1rem;">
        <div style="max-width: 500px; background: var(--surface); padding: 3rem 2rem; border-radius: 12px; border: 1px solid var(--border); box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
          <div style="width: 64px; height: 64px; background: var(--primary, #1a7f37); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 32px; margin: 0 auto 1.5rem auto;">✓</div>
          <h1 style="font-size: 2rem; font-weight: 700; margin-bottom: 1rem; color: var(--text-primary);">Talebiniz Alındı!</h1>
          <p style="font-size: 1.1rem; color: var(--text-secondary); margin-bottom: 2rem; line-height: 1.6;">
            Bilgileriniz sistemimize başarıyla kaydedildi. En kısa sürede sizinle iletişime geçeceğiz.
          </p>
          <a href="/" style="display: inline-block; padding: 0.875rem 2rem; background: var(--primary, #1a7f37); color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 1rem;">Ana Sayfaya Dön</a>
        </div>
      </section>
    `;
  } else {
    if (hasCustomLayout) {
      finalBodyContent = layoutHtml;
    } else {
      const customBody = slugData?.customBodyHtml || slugData?.custom_html || "";
      finalBodyContent = `
    ${compsHtml.hero}
    ${compsHtml.body}
    ${customBody ? `<div class="hub-custom-body">${customBody}</div>` : ""}
    ${compsHtml.legal}
    ${compsHtml.footer}`;
    }
  }
  // ----------------------------------------------------

  /* ── Normal page layout and wrapping ──────────────────────────── */
  const wrapperClass = "page-shell";

  const renderedContent = (headerHtml || finalBodyContent.trim() || footerHtml)
    ? `<div class="${wrapperClass}">
  ${modifier === "thanks" ? "" : headerHtml}
  ${finalBodyContent}
  ${modifier === "thanks" ? "" : footerHtml}
</div>`
    : "";

  /* ── Normal hub ───────────────────────────────────────────────── */
  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${escHtml(finalTitle)}</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta name="exp_token" content="${escAttr(expToken || defaultUtms.exp_token || "")}">
<meta name="utm_variant" content="${escAttr(utmVariant || defaultUtms.utm_variant || "")}">
${ga4Snippet}${pixelSnippet}
${baseCssBlock}
${themeCssLink}${globalCssLink}${pageCssBlock}
</head>
${bodyTag}
${renderedContent}

${slugData?.customScript && slugData.customScript.trim() ? `\n<script>\n${slugData.customScript.replace(/<\/script>/gi, "<\\/script>")}\n</script>` : ""}

<script>
(function () {
  "use strict";

  // If this page is explicitly marked as a conversion goal in the engine map or slug data, fire it now.
  var isConversionGoal = ${!!(slugData?.type === "conv" || slugData?.isConversion)};
  if (isConversionGoal) {
     fetch("/api/decision/signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({ 
          type: "conversion", 
          meta: {
            source: ${JSON.stringify(contextId)},
            campaign: ${JSON.stringify(campaign || "")},
          }
        })
      }).catch(function() {});
  }

  /* ── Config injected server-side ──────────────────────── */
  var UTM_DEFAULTS   = JSON.parse('${escJsString(utmsJson)}');
  var INTENT_CONFIG  = JSON.parse('${escJsString(intentConfigJson)}');
  var CAMPAIGN       = JSON.parse('${escJsString(campaignJson)}');
  var MODIFIER       = JSON.parse('${escJsString(modifierJson)}');
  var LINKS_META     = JSON.parse('${escJsString(JSON.stringify(links || []))}');
  var CONTEXT_TYPE   = JSON.parse('${escJsString(ctxTypeEsc)}');
  var CONTEXT_ID     = JSON.parse('${escJsString(ctxIdEsc)}');
  var SIGNALS_CONFIG = JSON.parse('${escJsString(signalsJson)}');
  var EXP_TOKEN      = ${JSON.stringify(expToken || defaultUtms.exp_token || "")};
  var UTM_VARIANT    = ${JSON.stringify(utmVariant || defaultUtms.utm_variant || "")};
  var TRACKING_KEYS  = [
    "utm_source","utm_medium","utm_campaign","utm_content","utm_term","utm_id",
    "cid","gclid","fbclid","ttclid","msclkid"
  ];

  /* 1. Read inbound tracking params from URL */
  var inbound = {};
  try {
    var sp = new URLSearchParams(window.location.search);
    sp.forEach(function (val, key) {
      if (TRACKING_KEYS.indexOf(key) !== -1 || key.indexOf("utm_") === 0) {
        inbound[key] = val;
      }
    });
  } catch (e) {}

  /* 2. Persist inbound to sessionStorage */
  try {
    sessionStorage.setItem("tracking_context", JSON.stringify(inbound));
  } catch (e) {}

  /* 3. Build merged tracking context
   *    Priority (highest → lowest):
   *      a) CAMPAIGN (record.campaign) — always wins on campaign pages
   *      b) inbound URL params          — win over route defaults
   *      c) UTM_DEFAULTS                — fallback
   *    utm_content is always overridden per-link below.
   */
  function getMerged() {
    var stored = {};
    try {
      stored = JSON.parse(sessionStorage.getItem("tracking_context") || "{}");
    } catch (e) {}
    var merged = Object.assign({}, UTM_DEFAULTS, stored);
    // Campaign pages: utm_campaign is authoritative from the record, not from URL
    if (CAMPAIGN) merged.utm_campaign = CAMPAIGN;
    return merged;
  }

  /* 4. Build final href with UTM params appended */
  function buildHref(baseHref, utmContent, noUtm) {
    if (noUtm || !baseHref || baseHref.indexOf("mailto:") === 0 || baseHref.indexOf("tel:") === 0) return baseHref;
    try {
      var url    = new URL(baseHref, window.location.origin);

      /* ── Canonical UTM cleanup ───────────────────────────────
       * Strip all utm_* params already on the destination URL so
       * stale or conflicting attribution from the link href never
       * leaks through.  Exception: if the destination already carries
       * its own utm_source (e.g. affiliate / partner links), preserve
       * it so we don't overwrite their source attribution — our merged
       * utm_source will then be skipped by the has(k) guard below.
       */
      var preservedSource = url.searchParams.get("utm_source") || null;
      var toDelete = [];
      url.searchParams.forEach(function (val, key) {
        if (key.indexOf("utm_") === 0) toDelete.push(key);
      });
      toDelete.forEach(function (k) { url.searchParams.delete(k); });
      if (preservedSource) url.searchParams.set("utm_source", preservedSource);

      var merged = getMerged();
      // utm_content is always driven by the link's own ID
      merged.utm_content = utmContent;
      Object.keys(merged).forEach(function (k) {
        var v = merged[k];
        if (v && !url.searchParams.has(k)) {
          url.searchParams.set(k, String(v));
        }
      });
      return url.toString();
    } catch (e) {
      return baseHref;
    }
  }

  /* 5. Fire analytics event */
  function fireOutbound(linkId, resolvedHref) {
    var host = "";
    try { host = new URL(resolvedHref).hostname; } catch (e) {}
    var payload = {
      context_type:     CONTEXT_TYPE,
      context_id:       CONTEXT_ID,
      link_id:          linkId,
      destination_host: host
    };
    try { if (typeof gtag === "function") gtag("event", "outbound_click", payload); } catch (e) {}
    try { if (typeof fbq  === "function") fbq("trackCustom", "OutboundClick", payload); } catch (e) {}

    /* ── Analytics Engine (server-side, fire-and-forget) ──────
     * POST /api/event with non-sensitive click fields only.
     * keepalive ensures the request survives page navigation.
     * .catch() swallows any network error so navigation is never
     * blocked and no console noise is produced on failure.
     */
    try {
      var merged = getMerged();
      fetch("/api/event", {
        method:    "POST",
        headers:   { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          slug:           CONTEXT_TYPE === "campaign" ? CONTEXT_ID : "",
          link_id:        linkId,
          utm_source:     merged.utm_source     || "",
          utm_medium:     merged.utm_medium     || "",
          utm_campaign:   CAMPAIGN || merged.utm_campaign || "",
          utm_experiment: merged.utm_experiment || "",
          utm_variant:    merged.utm_variant    || "",
          dest_host:      host,
        }),
      }).catch(function () {});
    } catch (e) {}
  }

  /* ── 8. Expose A/B info in global so tracking can pick it up ──
   * EXP_TOKEN logic handles exposure mapping if there is an active A/B testing token.
   * If not explicitly provided by the runtime injection, it defaults to the legacy
   * UTM_DEFAULTS (i.e. the hub page is part of a running experiment).
   */
  window.__COGNILINK_AB_INFO = (function() {
    var exp = UTM_DEFAULTS.utm_experiment;
    var v   = UTM_DEFAULTS.utm_variant;
    if (EXP_TOKEN && UTM_VARIANT) {
      exp = EXP_TOKEN;
      v = UTM_VARIANT;
    }
    return { experiment: exp, variant: v };
  })();

  /* 6. Experiment click telemetry beacon ──────────────────────────────────
   * Fires GET /t?e=click&exp=<utm_experiment>&v=<utm_variant> on every
   * outbound link click.  Uses navigator.sendBeacon when available so the
   * ping survives page navigation.  Falls back to fetch + keepalive.
   * Only fires when both utm_experiment and utm_variant are present in
   * UTM_DEFAULTS (i.e. the hub page is part of a running experiment).
   * Wrapped in try/catch — telemetry must never throw or block navigation.
   */
  function fireTelemetryClick() {
    var exp = UTM_DEFAULTS.utm_experiment;
    var v   = UTM_DEFAULTS.utm_variant;
    if (!exp || !v) return;
    var url = "/t?e=click"
      + "&exp=" + encodeURIComponent(exp)
      + "&v="   + encodeURIComponent(v);
    try {
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon(url);
      } else {
        fetch(url, { method: "GET", keepalive: true }).catch(function () {});
      }
    } catch (e) {}
  }

  /* 7. Wire up all links (Outbound & Telemetry) */
  LINKS_META.forEach(function (meta) {
    var el = document.getElementById("link-" + meta.id);
    if (!el) return;
    el.href = buildHref(meta.href, meta.utmContent, meta.noUtm);
    el.addEventListener("click", function () {
      var resolved = buildHref(meta.href, meta.utmContent, meta.noUtm);
      el.href = resolved;
      fireOutbound(meta.id, resolved);
      fireTelemetryClick();
    });
  });

  /* 8. Declarative Signal Architecture (Rule A, B, C, D, E, F) ───────────────
   * - Strict event delegation for [data-cos-signal-name]
   * - Single physical click guarantee & bubbling protection (__cos_handled)
   * - Ignores non-clickable / decorative / body / unlisted elements (0 points)
   * - Ignores disabled / aria-disabled elements
   * - Evaluates time signals by real seconds (afterSeconds per Landing Version)
   */
  (function initDeclarativeSignals() {
    var softClicks = (SIGNALS_CONFIG && SIGNALS_CONFIG.clicks && Array.isArray(SIGNALS_CONFIG.clicks.soft)) ? SIGNALS_CONFIG.clicks.soft : [];
    var hardClicks = (SIGNALS_CONFIG && SIGNALS_CONFIG.clicks && Array.isArray(SIGNALS_CONFIG.clicks.hard)) ? SIGNALS_CONFIG.clicks.hard : [];
    var timeSignals = (SIGNALS_CONFIG && Array.isArray(SIGNALS_CONFIG.time)) ? SIGNALS_CONFIG.time : [];

    // Global Delegated Click Listener
    document.addEventListener("click", function (evt) {
      if (!evt) return;
      if (evt.__cos_handled) return;

      var el = evt.target ? evt.target.closest("[data-cos-signal-name]") : null;
      if (!el) return;

      // Ignore disabled elements
      if (el.disabled || el.getAttribute("aria-disabled") === "true" || el.classList.contains("disabled")) {
        return;
      }

      var signalName = (el.getAttribute("data-cos-signal-name") || "").trim();
      if (!signalName) return;

      evt.__cos_handled = true;

      var isHard = hardClicks.indexOf(signalName) !== -1;
      var isSoft = softClicks.indexOf(signalName) !== -1;

      // Rule B & F: Unconfigured signal names generate ZERO points / NO request
      if (!isHard && !isSoft) return;

      fetch("/api/decision/signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          type: isHard ? "click_hard" : "click_soft",
          signal_name: signalName,
          meta: {
            source: CONTEXT_ID,
            campaign: CAMPAIGN || getMerged().utm_campaign || ""
          }
        })
      }).catch(function () {});
    }, true);

    // Rule C: Time Signals in real seconds per Landing Version
    if (Array.isArray(timeSignals)) {
      timeSignals.forEach(function (ts) {
        if (!ts || !ts.name || typeof ts.afterSeconds !== "number" || ts.afterSeconds <= 0) return;
        setTimeout(function () {
          fetch("/api/decision/signal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            keepalive: true,
            body: JSON.stringify({
              type: "time_signal",
              name: ts.name,
              seconds: ts.afterSeconds,
              meta: {
                source: CONTEXT_ID,
                campaign: CAMPAIGN || getMerged().utm_campaign || ""
              }
            })
          }).catch(function () {});
        }, ts.afterSeconds * 1000);
      });
    }
  })();

  /* 8. Engagement & Scroll Tracking (Phase 3) ─────────────────────────
   * Calculates a "Warmth" score based on scroll depth and time.
   * Reports to /api/decision/signal.
   */
  var start = Date.now();
  var maxScroll = 0;
  var signalSent = false;

  window.addEventListener("scroll", function() {
    var h = document.documentElement, 
        b = document.body,
        st = 'scrollTop',
        sh = 'scrollHeight';
    var percent = (h[st]||b[st]) / ((h[sh]||b[sh]) - h.clientHeight) * 100;
    if (percent > maxScroll) maxScroll = percent;
  }, { passive: true });

  // Periodically send engagement updates
  var engagementInterval = setInterval(function() {
    var elapsed = (Date.now() - start) / 1000;
    // Score Formula: (Scroll % * 0.4) + Time-based points (full weight only if scroll >= 15% to prevent idle bounce tab hot trigger)
    var timeWeight = maxScroll >= 15 ? Math.min(elapsed, 60) : Math.min(elapsed, 60) * 0.2;
    var score = Math.min(100, Math.floor((maxScroll * 0.4) + timeWeight));
    
    if (score > 10) { // Only report if there is some activity
      fetch("/api/decision/signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({ 
          type: "engagement", 
          score: score,
          meta: {
            source: CONTEXT_ID,
            campaign: CAMPAIGN || getMerged().utm_campaign || ""
          }
        })
      }).catch(function() {});
    }
    
    // Stop reporting after 2 minutes or once maxed out
    if (elapsed > 120 || score >= 100) clearInterval(engagementInterval);
  }, 10000); // Every 10s

}());
</script>
${globalJsLink}
</body>
</html>`;
}

/* ── CSS scoping helper ────────────────────────────────────────── */
/**
 * Prefix every CSS selector with #slug-{slugId} for isolation.
 * Simple transformation: splits by } and prepends selectors.
 * Skips @-rules (media, keyframes, etc.) and empty blocks.
 */
function scopeCSS(css, slugId) {
  if (!css || !slugId) return css || "";
  const prefix = `#slug-${slugId}`;
  return css
    .split("}")
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      const braceIdx = trimmed.indexOf("{");
      if (braceIdx === -1) return trimmed;

      const selector = trimmed.substring(0, braceIdx).trim();
      const body = trimmed.substring(braceIdx);

      // Skip @-rules (media queries, keyframes, etc.)
      if (selector.startsWith("@")) return selector + body + "}";

      // Prefix each comma-separated selector
      const prefixed = selector
        .split(",")
        .map((s) => {
          s = s.trim();
          if (!s) return s;
          return `${prefix} ${s}`;
        })
        .join(", ");

      return prefixed + " " + body + "}";
    })
    .join("\n");
}

/* ── Escape helpers ─────────────────────────────────────────────── */
function escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function escAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

/**
 * Escape a JSON string for safe embedding inside a JS single-quoted string literal.
 * Prevents context-breaking injection when using JSON.parse('...') in <script> blocks.
 *
 * Escape order matters: backslashes must be escaped first.
 *   1. \  → \\   (backslash — must come first)
 *   2. '  → \'   (single-quote string delimiter)
 *   3. \r → \r   (carriage return)
 *   4. \n → \n   (newline)
 *   5. </ → <\/  (prevents </script> from ending the script block)
 */
function escJsString(jsonStr) {
  return String(jsonStr)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/<\//g, "<\\/");
}

/* ── CSS ────────────────────────────────────────────────────────── */
const BASE_CSS = `
*,*::before,*::after{box-sizing:border-box}
body{margin:0;min-height:100dvh;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,Arial,sans-serif;line-height:1.5;-webkit-font-smoothing:antialiased}
img,video{max-width:100%;height:auto}
button,input,select,textarea{font-family:inherit}
.page-shell{width:100%;max-width:none;margin:0;padding:0;display:block}
`;

const HUB_CSS = `
:root{
  --bg:#F8F8F6;--text:#111111;
  --btn-bg:#111111;--btn-text:#F8F8F6;
  --link:#0f62fe;--link-hover:#0043ce;
  --radius:.875rem;
  --font:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,Arial,sans-serif;
}
@media(prefers-color-scheme:dark){
  :root{
    --bg:#111111;--text:#F8F8F6;--btn-bg:#F8F8F6;--btn-text:#111111;
    --link:#78a9ff;--link-hover:#a6c8ff;
  }
}
html{height:100%}
body{
  background:var(--bg);color:var(--text);font-family:var(--font);
  min-height:100dvh;display:flex;align-items:center;justify-content:center;
  padding:2.5rem 1.25rem;-webkit-font-smoothing:antialiased;
}
a:not(.link-btn):not(.comp-cta-btn){
  color:var(--link);
  text-decoration:underline;
  text-underline-offset:3px;
  text-decoration-thickness:1.5px;
  text-decoration-color:rgba(15,98,254,0.3);
  transition:color .12s ease,text-decoration-color .12s ease;
}
@media(prefers-color-scheme:dark){
  a:not(.link-btn):not(.comp-cta-btn){
    text-decoration-color:rgba(120,169,255,0.35);
  }
}
a:not(.link-btn):not(.comp-cta-btn):hover{
  color:var(--link-hover);
  text-decoration-color:var(--link-hover);
}
.container{width:100%;max-width:1000px;margin:0 auto;padding:0 20px;box-sizing:border-box;display:flex;flex-direction:column}
.name{
  text-align:center;font-size:1.0625rem;font-weight:600;
  letter-spacing:.01em;margin-bottom:1.75rem;opacity:.9;
}
#links-wrap{display:flex;flex-direction:column;gap:.625rem}
.link-btn{
  display:block;width:100%;padding:1.0625rem 1.5rem;
  background:var(--btn-bg);color:var(--btn-text);
  border:none;border-radius:var(--radius);
  font-family:var(--font);font-size:.9375rem;font-weight:500;
  letter-spacing:.01em;text-align:center;text-decoration:none;
  cursor:pointer;transition:opacity .12s ease;
  -webkit-tap-highlight-color:transparent;user-select:none;
}
.link-btn:hover{opacity:.83}
.link-btn:active{opacity:.65}
.link-text{
  text-align:center;font-size:1.0625rem;font-weight:600;
  letter-spacing:.01em;margin-bottom:0.75rem;margin-top:0.5rem;opacity:.9;
}
.not-found-msg{text-align:center;font-size:.9375rem;opacity:.55;margin-bottom:1.5rem}
.hub-header{text-align:center;font-size:.875rem;opacity:.6;margin-bottom:1rem}
.hub-footer{text-align:center;font-size:.8125rem;opacity:.45;margin-top:1.25rem}

/* Dynamic Components Styles */
.comp-item{
  margin:1.25rem 0;padding:1.25rem;
  background:rgba(0,0,0,0.02);border:1px solid rgba(0,0,0,0.05);
  border-radius:var(--radius);
}
@media(prefers-color-scheme:dark){
  .comp-item{
    background:rgba(255,255,255,0.03);border-color:rgba(255,255,255,0.07);
  }
}
.comp-title{font-size:1.05rem;font-weight:600;margin-bottom:0.5rem;}
.comp-body{font-size:0.875rem;line-height:1.45;opacity:0.9;}
.comp-cta{margin-top:0.75rem;}
.comp-cta-btn{
  display:inline-block;padding:0.5rem 1rem;
  background:var(--btn-bg);color:var(--btn-text);
  border-radius:var(--radius);text-decoration:none;
  font-size:0.85rem;font-weight:500;
  transition:opacity 0.15s;
}
.comp-cta-btn:hover{opacity:0.85;}
.comp-placement-legal,.comp-placement-footer{
  background:transparent;border:none;padding:0.5rem 0;
  font-size:0.8rem;text-align:center;margin:0.5rem 0;
}
.comp-placement-legal .comp-body,.comp-placement-footer .comp-body{
  font-size:0.8rem;opacity:0.6;
}
`;

export const renderLanding = renderHub;
