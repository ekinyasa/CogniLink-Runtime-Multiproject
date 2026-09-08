export const DEFAULT_CONSENT_CONFIG = {
  content: {
    bannerTitle: "Cookie Preferences",
    bannerBody: "We use necessary cookies to ensure our site works properly. With your consent, we also use optional analytics and marketing cookies to improve your experience and measure engagement. You can adjust your preferences anytime.",
    btnAcceptAll: "Accept all",
    btnRejectNonEssential: "Reject non-essential",
    btnManagePreferences: "Manage preferences",
    modalTitle: "Cookie Preferences",
    modalDescription: "When you visit our website, cookies may be stored on your device. You can customize which cookie categories you allow below.",
    necessaryTitle: "Necessary",
    necessaryDescription: "Required for basic site functionality, security, and session routing. Cannot be disabled.",
    necessaryBadge: "Always Active",
    analyticsTitle: "Analytics",
    analyticsDescription: "Helps us understand how visitors interact with the site to improve performance and user experience (e.g. Google Analytics 4).",
    marketingTitle: "Marketing",
    marketingDescription: "Used to deliver tailored content and measure the effectiveness of promotional campaigns (e.g. Meta Pixel).",
    btnSavePreferences: "Save preferences",
    privacyPolicyLabel: "Privacy Policy",
    privacyPolicyUrl: "https://app.kartra.com/redirect_to/?asset=page&id=ZHstCpwEU3rK",
    fallbackTriggerLabel: "Cookie Preferences"
  },
  visual: {
    bannerBg: "rgba(18, 18, 20, 0.96)",
    textColor: "#f3f4f6",
    secondaryTextColor: "#9ca3af",
    borderColor: "rgba(255, 255, 255, 0.12)",
    backdropBlur: "12px",
    bannerRadius: "0px",
    paddingY: "1rem",
    paddingX: "1.25rem",
    maxWidth: "1140px",
    buttonRadius: "6px",
    btnPrimaryBg: "#2563eb",
    btnPrimaryText: "#ffffff",
    btnPrimaryBorder: "#2563eb",
    btnSecondaryBg: "rgba(255, 255, 255, 0.08)",
    btnSecondaryText: "#e5e7eb",
    btnSecondaryBorder: "rgba(255, 255, 255, 0.15)",
    linkColor: "#60a5fa",
    modalBg: "#18181b",
    modalBorder: "rgba(255, 255, 255, 0.12)",
    modalRadius: "12px",
    overlayOpacity: "0.72",
    accentColor: "#2563eb",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
    mobilePaddingY: "0.75rem",
    mobilePaddingX: "1rem",

    // Layout & Geometry
    bannerBottom: "0px",
    bannerBorderWidth: "1px",
    bannerAlignment: "left",
    desktopActionLayout: "horizontal",
    mobileActionLayout: "stacked",
    titleBodyGap: "0.25rem",
    bodyActionsGap: "1.25rem",
    actionGap: "0.5rem",

    // Button Geometry
    btnPaddingX: "1rem",
    btnPaddingY: "0.55rem",
    btnMinHeight: "auto",

    // Modal Geometry
    modalMaxWidth: "540px",
    modalHeaderPadding: "1.25rem 1.5rem",
    modalBodyPadding: "1.25rem 1.5rem",
    modalFooterPadding: "1rem 1.5rem",

    // Category Cards
    cardBg: "rgba(255, 255, 255, 0.03)",
    cardBorderColor: "rgba(255, 255, 255, 0.06)",
    cardBorderWidth: "1px",
    cardRadius: "8px",
    cardGap: "0.75rem",
    cardPadding: "0.75rem 1rem",

    // Overlay & Controls
    overlayColor: "#000000",
    closeColor: "#9ca3af",
    closeSize: "1.5rem",
    checkboxSize: "1.25rem",
    mobileMaxWidth: "100%"
  }
};

export function formatOverlayBg(color, opacity) {
  const op = (opacity != null && opacity !== "" && !isNaN(parseFloat(opacity))) ? parseFloat(opacity) : 0.72;
  const col = String(color || "#000000").trim();
  if (col.startsWith("#")) {
    const hex = col.slice(1);
    let r = 0, g = 0, b = 0;
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16) || 0;
      g = parseInt(hex[1] + hex[1], 16) || 0;
      b = parseInt(hex[2] + hex[2], 16) || 0;
    } else if (hex.length === 6) {
      r = parseInt(hex.slice(0, 2), 16) || 0;
      g = parseInt(hex.slice(2, 4), 16) || 0;
      b = parseInt(hex.slice(4, 6), 16) || 0;
    }
    return `rgba(${r}, ${g}, ${b}, ${op})`;
  }
  if (col.startsWith("rgb(")) {
    const parts = col.replace(/[^\d,]/g, "").split(",");
    if (parts.length >= 3) {
      return `rgba(${parts[0].trim()}, ${parts[1].trim()}, ${parts[2].trim()}, ${op})`;
    }
  }
  if (col.startsWith("rgba(")) {
    return col;
  }
  return `rgba(0, 0, 0, ${op})`;
}

export function resolveConsentConfig(raw) {
  const c = raw?.content || {};
  const v = raw?.visual || {};
  const dC = DEFAULT_CONSENT_CONFIG.content;
  const dV = DEFAULT_CONSENT_CONFIG.visual;

  return {
    content: {
      bannerTitle: (c.bannerTitle != null && c.bannerTitle !== "") ? String(c.bannerTitle) : dC.bannerTitle,
      bannerBody: (c.bannerBody != null && c.bannerBody !== "") ? String(c.bannerBody) : dC.bannerBody,
      btnAcceptAll: (c.btnAcceptAll != null && c.btnAcceptAll !== "") ? String(c.btnAcceptAll) : dC.btnAcceptAll,
      btnRejectNonEssential: (c.btnRejectNonEssential != null && c.btnRejectNonEssential !== "") ? String(c.btnRejectNonEssential) : dC.btnRejectNonEssential,
      btnManagePreferences: (c.btnManagePreferences != null && c.btnManagePreferences !== "") ? String(c.btnManagePreferences) : dC.btnManagePreferences,
      modalTitle: (c.modalTitle != null && c.modalTitle !== "") ? String(c.modalTitle) : dC.modalTitle,
      modalDescription: (c.modalDescription != null && c.modalDescription !== "") ? String(c.modalDescription) : dC.modalDescription,
      necessaryTitle: (c.necessaryTitle != null && c.necessaryTitle !== "") ? String(c.necessaryTitle) : dC.necessaryTitle,
      necessaryDescription: (c.necessaryDescription != null && c.necessaryDescription !== "") ? String(c.necessaryDescription) : dC.necessaryDescription,
      necessaryBadge: (c.necessaryBadge != null && c.necessaryBadge !== "") ? String(c.necessaryBadge) : dC.necessaryBadge,
      analyticsTitle: (c.analyticsTitle != null && c.analyticsTitle !== "") ? String(c.analyticsTitle) : dC.analyticsTitle,
      analyticsDescription: (c.analyticsDescription != null && c.analyticsDescription !== "") ? String(c.analyticsDescription) : dC.analyticsDescription,
      marketingTitle: (c.marketingTitle != null && c.marketingTitle !== "") ? String(c.marketingTitle) : dC.marketingTitle,
      marketingDescription: (c.marketingDescription != null && c.marketingDescription !== "") ? String(c.marketingDescription) : dC.marketingDescription,
      btnSavePreferences: (c.btnSavePreferences != null && c.btnSavePreferences !== "") ? String(c.btnSavePreferences) : dC.btnSavePreferences,
      privacyPolicyLabel: (c.privacyPolicyLabel != null && c.privacyPolicyLabel !== "") ? String(c.privacyPolicyLabel) : dC.privacyPolicyLabel,
      privacyPolicyUrl: (c.privacyPolicyUrl != null && c.privacyPolicyUrl !== "") ? String(c.privacyPolicyUrl) : (raw?.privacyPolicyUrl || dC.privacyPolicyUrl),
      fallbackTriggerLabel: (c.fallbackTriggerLabel != null && c.fallbackTriggerLabel !== "") ? String(c.fallbackTriggerLabel) : dC.fallbackTriggerLabel
    },
    visual: {
      bannerBg: v.bannerBg || dV.bannerBg,
      textColor: v.textColor || dV.textColor,
      secondaryTextColor: v.secondaryTextColor || dV.secondaryTextColor,
      borderColor: v.borderColor || dV.borderColor,
      backdropBlur: v.backdropBlur || dV.backdropBlur,
      bannerRadius: v.bannerRadius || dV.bannerRadius,
      paddingY: v.paddingY || dV.paddingY,
      paddingX: v.paddingX || dV.paddingX,
      maxWidth: v.maxWidth || dV.maxWidth,
      buttonRadius: v.buttonRadius || dV.buttonRadius,
      btnPrimaryBg: v.btnPrimaryBg || dV.btnPrimaryBg,
      btnPrimaryText: v.btnPrimaryText || dV.btnPrimaryText,
      btnPrimaryBorder: v.btnPrimaryBorder || dV.btnPrimaryBorder,
      btnSecondaryBg: v.btnSecondaryBg || dV.btnSecondaryBg,
      btnSecondaryText: v.btnSecondaryText || dV.btnSecondaryText,
      btnSecondaryBorder: v.btnSecondaryBorder || dV.btnSecondaryBorder,
      linkColor: v.linkColor || dV.linkColor,
      modalBg: v.modalBg || dV.modalBg,
      modalBorder: v.modalBorder || dV.modalBorder,
      modalRadius: v.modalRadius || dV.modalRadius,
      overlayOpacity: (v.overlayOpacity != null && v.overlayOpacity !== "") ? v.overlayOpacity : dV.overlayOpacity,
      accentColor: v.accentColor || dV.accentColor,
      fontFamily: v.fontFamily || dV.fontFamily,
      mobilePaddingY: v.mobilePaddingY || dV.mobilePaddingY,
      mobilePaddingX: v.mobilePaddingX || dV.mobilePaddingX,

      bannerBottom: v.bannerBottom || dV.bannerBottom,
      bannerBorderWidth: v.bannerBorderWidth || dV.bannerBorderWidth,
      bannerAlignment: (v.bannerAlignment === "center") ? "center" : "left",
      desktopActionLayout: (v.desktopActionLayout === "stacked") ? "stacked" : "horizontal",
      mobileActionLayout: (v.mobileActionLayout === "horizontal") ? "horizontal" : "stacked",
      titleBodyGap: v.titleBodyGap || dV.titleBodyGap,
      bodyActionsGap: v.bodyActionsGap || dV.bodyActionsGap,
      actionGap: v.actionGap || dV.actionGap,
      btnPaddingX: v.btnPaddingX || dV.btnPaddingX,
      btnPaddingY: v.btnPaddingY || dV.btnPaddingY,
      btnMinHeight: v.btnMinHeight || dV.btnMinHeight,
      modalMaxWidth: v.modalMaxWidth || dV.modalMaxWidth,
      modalHeaderPadding: v.modalHeaderPadding || dV.modalHeaderPadding,
      modalBodyPadding: v.modalBodyPadding || dV.modalBodyPadding,
      modalFooterPadding: v.modalFooterPadding || dV.modalFooterPadding,
      cardBg: v.cardBg || dV.cardBg,
      cardBorderColor: v.cardBorderColor || dV.cardBorderColor,
      cardBorderWidth: v.cardBorderWidth || dV.cardBorderWidth,
      cardRadius: v.cardRadius || dV.cardRadius,
      cardGap: v.cardGap || dV.cardGap,
      cardPadding: v.cardPadding || dV.cardPadding,
      overlayColor: v.overlayColor || dV.overlayColor,
      closeColor: v.closeColor || dV.closeColor,
      closeSize: v.closeSize || dV.closeSize,
      checkboxSize: v.checkboxSize || dV.checkboxSize,
      mobileMaxWidth: v.mobileMaxWidth || dV.mobileMaxWidth
    }
  };
}

export function getConsentCssVariables(visual = {}) {
  const v = visual;
  const dV = DEFAULT_CONSENT_CONFIG.visual;

  const bannerAlignment = (v.bannerAlignment === "center") ? "center" : "left";
  const desktopActionLayout = (v.desktopActionLayout === "stacked") ? "column" : "row";
  const desktopActionAlign = (v.desktopActionLayout === "stacked") ? "stretch" : "center";
  const mobileActionLayout = (v.mobileActionLayout === "horizontal") ? "row" : "column";
  const mobileActionAlign = (v.mobileActionLayout === "horizontal") ? "center" : "stretch";
  const overlayColor = v.overlayColor || dV.overlayColor;
  const overlayOpacity = (v.overlayOpacity != null && v.overlayOpacity !== "") ? v.overlayOpacity : dV.overlayOpacity;
  const overlayBg = formatOverlayBg(overlayColor, overlayOpacity);

  return `
  --cl-consent-banner-bg: ${v.bannerBg || dV.bannerBg};
  --cl-consent-text-color: ${v.textColor || dV.textColor};
  --cl-consent-secondary-text: ${v.secondaryTextColor || dV.secondaryTextColor};
  --cl-consent-border-color: ${v.borderColor || dV.borderColor};
  --cl-consent-backdrop-blur: ${v.backdropBlur || dV.backdropBlur};
  --cl-consent-banner-radius: ${v.bannerRadius || dV.bannerRadius};
  --cl-consent-padding-y: ${v.paddingY || dV.paddingY};
  --cl-consent-padding-x: ${v.paddingX || dV.paddingX};
  --cl-consent-max-width: ${v.maxWidth || dV.maxWidth};
  --cl-consent-button-radius: ${v.buttonRadius || dV.buttonRadius};
  --cl-consent-btn-primary-bg: ${v.btnPrimaryBg || dV.btnPrimaryBg};
  --cl-consent-btn-primary-text: ${v.btnPrimaryText || dV.btnPrimaryText};
  --cl-consent-btn-primary-border: ${v.btnPrimaryBorder || dV.btnPrimaryBorder};
  --cl-consent-btn-secondary-bg: ${v.btnSecondaryBg || dV.btnSecondaryBg};
  --cl-consent-btn-secondary-text: ${v.btnSecondaryText || dV.btnSecondaryText};
  --cl-consent-btn-secondary-border: ${v.btnSecondaryBorder || dV.btnSecondaryBorder};
  --cl-consent-link-color: ${v.linkColor || dV.linkColor};
  --cl-consent-modal-bg: ${v.modalBg || dV.modalBg};
  --cl-consent-modal-border: ${v.modalBorder || dV.modalBorder};
  --cl-consent-modal-radius: ${v.modalRadius || dV.modalRadius};
  --cl-consent-overlay-opacity: ${overlayOpacity};
  --cl-consent-overlay-color: ${overlayColor};
  --cl-consent-overlay-bg: ${overlayBg};
  --cl-consent-accent-color: ${v.accentColor || dV.accentColor};
  --cl-consent-font-family: ${v.fontFamily || dV.fontFamily};
  --cl-consent-mobile-padding-y: ${v.mobilePaddingY || dV.mobilePaddingY};
  --cl-consent-mobile-padding-x: ${v.mobilePaddingX || dV.mobilePaddingX};

  --cl-consent-banner-bottom: ${v.bannerBottom || dV.bannerBottom};
  --cl-consent-banner-border-width: ${v.bannerBorderWidth || dV.bannerBorderWidth};
  --cl-consent-content-align: ${bannerAlignment};
  --cl-consent-desktop-action-direction: ${desktopActionLayout};
  --cl-consent-desktop-action-align: ${desktopActionAlign};
  --cl-consent-mobile-action-direction: ${mobileActionLayout};
  --cl-consent-mobile-action-align: ${mobileActionAlign};
  --cl-consent-title-body-gap: ${v.titleBodyGap || dV.titleBodyGap};
  --cl-consent-body-actions-gap: ${v.bodyActionsGap || dV.bodyActionsGap};
  --cl-consent-action-gap: ${v.actionGap || dV.actionGap};
  --cl-consent-btn-padding-x: ${v.btnPaddingX || dV.btnPaddingX};
  --cl-consent-btn-padding-y: ${v.btnPaddingY || dV.btnPaddingY};
  --cl-consent-btn-min-height: ${v.btnMinHeight || dV.btnMinHeight};
  --cl-consent-modal-max-width: ${v.modalMaxWidth || dV.modalMaxWidth};
  --cl-consent-modal-header-padding: ${v.modalHeaderPadding || dV.modalHeaderPadding};
  --cl-consent-modal-body-padding: ${v.modalBodyPadding || dV.modalBodyPadding};
  --cl-consent-modal-footer-padding: ${v.modalFooterPadding || dV.modalFooterPadding};
  --cl-consent-card-bg: ${v.cardBg || dV.cardBg};
  --cl-consent-card-border-color: ${v.cardBorderColor || dV.cardBorderColor};
  --cl-consent-card-border-width: ${v.cardBorderWidth || dV.cardBorderWidth};
  --cl-consent-card-radius: ${v.cardRadius || dV.cardRadius};
  --cl-consent-card-gap: ${v.cardGap || dV.cardGap};
  --cl-consent-card-padding: ${v.cardPadding || dV.cardPadding};
  --cl-consent-close-color: ${v.closeColor || dV.closeColor};
  --cl-consent-close-size: ${v.closeSize || dV.closeSize};
  --cl-consent-checkbox-size: ${v.checkboxSize || dV.checkboxSize};
  --cl-consent-mobile-max-width: ${v.mobileMaxWidth || dV.mobileMaxWidth};
  `;
}

export function renderConsentSnippet(rawConsent = {}, { isPreview = false } = {}) {
  const resolved = resolveConsentConfig(rawConsent);
  const c = resolved.content;
  const privacyPolicyUrl = c.privacyPolicyUrl || "/privacy-policy";

  const banner = `
<div id="cl-consent-banner" class="cl-consent-banner" style="${isPreview ? 'margin-bottom:1.5rem;' : 'display:none;'}" role="region" aria-label="Cookie and Privacy Notice">
  <div class="cl-consent-banner-inner">
    <div class="cl-consent-banner-text">
      <strong>${escHtml(c.bannerTitle)}</strong>
      <p>${escHtml(c.bannerBody)} ${privacyPolicyUrl ? `<a href="${escAttr(privacyPolicyUrl)}" target="_blank" rel="noopener">${escHtml(c.privacyPolicyLabel || "Privacy Policy")}</a>` : ""}</p>
    </div>
    <div class="cl-consent-banner-actions">
      <button type="button" class="cl-consent-btn cl-consent-btn-manage" onclick="window.__clConsent ? window.__clConsent.openPreferences() : null">${escHtml(c.btnManagePreferences)}</button>
      <button type="button" class="cl-consent-btn cl-consent-btn-reject" onclick="window.__clConsent ? window.__clConsent.set({nec:true,ana:false,mkt:false}) : null">${escHtml(c.btnRejectNonEssential)}</button>
      <button type="button" class="cl-consent-btn cl-consent-btn-accept" onclick="window.__clConsent ? window.__clConsent.set({nec:true,ana:true,mkt:true}) : null">${escHtml(c.btnAcceptAll)}</button>
    </div>
  </div>
</div>`;

  const modal = `
<div id="cl-consent-modal" class="cl-consent-modal-overlay" style="${isPreview ? '' : 'display:none;'}" role="dialog" aria-modal="true" aria-labelledby="cl-modal-title">
  <div class="cl-consent-modal">
    <div class="cl-consent-modal-header">
      <h3 id="cl-modal-title">${escHtml(c.modalTitle)}</h3>
      <button type="button" class="cl-consent-modal-close" onclick="window.__clConsent ? window.__clConsent.closePreferences() : null" aria-label="Close">&times;</button>
    </div>
    <div class="cl-consent-modal-body">
      <p class="cl-consent-modal-desc">${escHtml(c.modalDescription)}</p>

      <div class="cl-consent-pref-item">
        <div class="cl-consent-pref-info">
          <div class="cl-consent-pref-title">
            <span>${escHtml(c.necessaryTitle)}</span>
            <span class="cl-consent-badge">${escHtml(c.necessaryBadge)}</span>
          </div>
          <p>${escHtml(c.necessaryDescription)}</p>
        </div>
        <div class="cl-consent-pref-toggle">
          <input type="checkbox" checked disabled id="cl-pref-nec">
        </div>
      </div>

      <div class="cl-consent-pref-item">
        <div class="cl-consent-pref-info">
          <div class="cl-consent-pref-title">
            <label for="cl-pref-ana">${escHtml(c.analyticsTitle)}</label>
          </div>
          <p>${escHtml(c.analyticsDescription)}</p>
        </div>
        <div class="cl-consent-pref-toggle">
          <input type="checkbox" id="cl-pref-ana">
        </div>
      </div>

      <div class="cl-consent-pref-item">
        <div class="cl-consent-pref-info">
          <div class="cl-consent-pref-title">
            <label for="cl-pref-mkt">${escHtml(c.marketingTitle)}</label>
          </div>
          <p>${escHtml(c.marketingDescription)}</p>
        </div>
        <div class="cl-consent-pref-toggle">
          <input type="checkbox" id="cl-pref-mkt">
        </div>
      </div>
    </div>
    <div class="cl-consent-modal-footer">
      <button type="button" class="cl-consent-btn cl-consent-btn-reject" onclick="window.__clConsent ? window.__clConsent.set({nec:true,ana:false,mkt:false}) : null">${escHtml(c.btnRejectNonEssential)}</button>
      <button type="button" class="cl-consent-btn cl-consent-btn-manage" onclick="window.__clConsent ? window.__clConsent.saveFromModal() : null">${escHtml(c.btnSavePreferences)}</button>
      <button type="button" class="cl-consent-btn cl-consent-btn-accept" onclick="window.__clConsent ? window.__clConsent.set({nec:true,ana:true,mkt:true}) : null">${escHtml(c.btnAcceptAll)}</button>
    </div>
  </div>
</div>`;

  const trigger = `
<button type="button" id="cl-consent-fallback-trigger" class="cl-consent-fallback-trigger" style="display:none;" aria-label="${escAttr(c.fallbackTriggerLabel || 'Cookie Preferences')}">
  ${escHtml(c.fallbackTriggerLabel || "Cookie Preferences")}
</button>`;

  if (isPreview) {
    return `<div class="cl-consent-preview-stage">${banner}${modal}${trigger}</div>`;
  }
  return `${banner}\n${modal}\n${trigger}`;
}

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
  slugData = null, // full slug KV record
  productSubdomain = "",
  expToken = "",          // A/B exposure token (Prompt 130)
  utmVariant = "",          // A/B selected variant slug
  components = [],          // Live KV components (Prompt 140)
  isPreview = false,        // Admin preview mode flag
  intentConfig = {},        // Routing & Behavior JSON (Campaign V2)
  draftValues = {},         // ADDED: Prefilled values
  rootDomain = "",
  requestHost = "",
} = {}) {
  const cfg = config || {};

  // --- DEBUG INFO INJECTION ---
  const effectiveHost = (requestHost || rootDomain || cfg.rootDomain || "").trim();

  let pSub, dCamp, dMod, cUrl, aUrl;
  if (contextType === "static") {
    const host = effectiveHost || "localhost";
    pSub = productSubdomain || "static";
    dCamp = campaign || (slugData && (slugData.name || slugData.title)) || slug || "static";
    dMod = modifier || (slugData && (slugData.version_label || (slugData.version_number ? ("v" + slugData.version_number) : null))) || "live";
    const pathSlug = (slug === "home" || !slug) ? "" : "/" + slug;
    cUrl = "https://" + host + (pathSlug ? pathSlug : "/");
    const alias = slugData && slugData.alias ? slugData.alias : null;
    aUrl = alias ? ("https://" + host + "/" + alias) : "N/A";
  } else {
    pSub = productSubdomain || (slug ? slug.split('-')[0] : "unknown");
    dCamp = campaign || (slug ? slug.split('-')[1] : "unknown");
    dMod = modifier || (slug ? slug.split('-').slice(2).join('-') : "unknown");
    const domain = rootDomain || (effectiveHost ? effectiveHost.split('.').slice(-2).join('.') : "") || "teklifi.online";
    cUrl = "https://" + pSub + "." + domain + "/l/" + slug;
    const alias = slugData && slugData.alias ? slugData.alias : null;
    aUrl = alias ? "https://" + pSub + "." + domain + "/" + alias : "N/A";
  }

  const pSlug = "{" + slug + "}";
  const pTheme = (slugData && slugData.theme) ? slugData.theme : "Default";
  const pUpdate = (slugData && slugData.updatedAt) ? new Date(slugData.updatedAt).toLocaleString("tr-TR") : (slugData && slugData.updated_at ? new Date(slugData.updated_at).toLocaleString("tr-TR") : "Bilinmiyor");

  const debugString = `${pSub} | ${dCamp} | ${dMod} | C: ${cUrl} | A: ${aUrl} | ${pSlug} | ${pTheme} | Last updated: ${pUpdate}`;

  const debugHtml = `\n<!--\nRUNTIME DEBUG INFO:\n${debugString}\n-->\n<script>console.log("RUNTIME DEBUG INFO: %c" + ${JSON.stringify(debugString)}, "color:#0284c7; font-weight:bold;");</script>`;


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
                     (slugData?.title && String(slugData.title).trim()) ||
                     (slugData?.pageTitle && String(slugData.pageTitle).trim()) ||
                     (cfg.pageTitle && String(cfg.pageTitle).trim()) ||
                     "CogniLink";

  // Per-page header/footers only (global fallbacks headerHtml/footerHtml are removed)
  const headerRaw = hasCustomLayout ? "" : (slugData?.customHeaderHtml || "");
  const footerRaw = hasCustomLayout ? "" : (slugData?.customFooterHtml || "");

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
  const turnstileScript = cfg.turnstileSiteKey ? `\n<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"></script>` : "";
  const globalJsLink = `\n<script src="/global-assets/main.js?v=${escAttr(cfg.jsVersion || "1")}"></script>`;

  // Page-level Custom CSS block (unscoped)
  const slugId = slug || "";
  const pageCssRaw = slugData?.customStyleCss || "";
  let pageCssBlock = "";
  if (pageCssRaw) {
    pageCssBlock = `\n<style>\n${pageCssRaw}\n</style>`;
  }

  // Load old HUB_CSS conditionally (only when rendering link buttons)
  const consentResolved = resolveConsentConfig(cfg?.consent);
  const consentCssVars = `:root {\n${getConsentCssVariables(consentResolved.visual)}\n}`;
  const baseCssBlock = `<style>${BASE_CSS}\n${consentCssVars}</style>`;

  // Body tag: add id for CSS scoping on campaign pages
  const bodyTag = slugId ? `<body id="slug-${escAttr(slugId)}">` : "<body>";

  /* ── Consent & Tracking Gate System ──────────────────────────── */
  const consentBootstrapScript = `
  <script>
  (function() {
    var COOKIE_NAME = "cl_consent";
    var ROOT_DOMAIN = "${escJsString(rootDomain || "")}";

    function getCookieDomain() {
      if (ROOT_DOMAIN && ROOT_DOMAIN.indexOf(".") !== -1) {
        return "." + ROOT_DOMAIN.replace(/^\\.+/, "");
      }
      var h = window.location.hostname;
      return (h && h.indexOf(".") !== -1 && h !== "localhost") ? "." + h : "";
    }

    function readConsentCookie() {
      try {
        var match = document.cookie.match(new RegExp('(^|;\\\\s*)' + COOKIE_NAME + '=([^;]+)'));
        if (!match) return null;
        var parsed = JSON.parse(decodeURIComponent(match[2]));
        if (parsed && typeof parsed === "object" && parsed.v === 1) {
          return {
            v: 1,
            nec: true,
            ana: Boolean(parsed.ana),
            mkt: Boolean(parsed.mkt),
            ts: parsed.ts || 0
          };
        }
      } catch (_) {}
      return null;
    }

    var listeners = [];
    var currentConsent = readConsentCookie();
    var hasExplicitChoice = currentConsent !== null;
    if (!currentConsent) {
      currentConsent = { v: 1, nec: true, ana: false, mkt: false, ts: 0 };
    }

    window.__clConsent = {
      hasChoice: function() { return hasExplicitChoice; },
      get: function() { return Object.assign({}, currentConsent); },
      has: function(cat) {
        if (cat === "nec" || cat === "necessary") return true;
        if (cat === "ana" || cat === "analytics") return Boolean(currentConsent.ana);
        if (cat === "mkt" || cat === "marketing") return Boolean(currentConsent.mkt);
        return false;
      },
      onChange: function(fn) {
        if (typeof fn === "function") {
          listeners.push(fn);
        }
      },
      set: function(prefs) {
        var updated = {
          v: 1,
          nec: true,
          ana: Boolean(prefs && prefs.ana),
          mkt: Boolean(prefs && prefs.mkt),
          ts: Math.floor(Date.now() / 1000)
        };
        currentConsent = updated;
        hasExplicitChoice = true;

        var dom = getCookieDomain();
        var cookieStr = COOKIE_NAME + "=" + encodeURIComponent(JSON.stringify(updated)) + "; path=/; max-age=31536000; SameSite=Lax; Secure" + (dom ? "; domain=" + dom : "");
        document.cookie = cookieStr;

        ${ga4Id ? `
        window["ga-disable-${escJsString(ga4Id)}"] = !updated.ana;
        ` : ""}
        if (typeof window.gtag === "function") {
          window.gtag("consent", "update", {
            "analytics_storage": updated.ana ? "granted" : "denied",
            "ad_storage": updated.mkt ? "granted" : "denied",
            "ad_user_data": updated.mkt ? "granted" : "denied",
            "ad_personalization": updated.mkt ? "granted" : "denied"
          });
        }
        if (!updated.ana) {
          removeGaCookies();
        }

        for (var i = 0; i < listeners.length; i++) {
          try { listeners[i](updated); } catch(e) {}
        }
        try {
          window.dispatchEvent(new CustomEvent("cl_consent_updated", { detail: updated }));
        } catch(e) {}

        var banner = document.getElementById("cl-consent-banner");
        if (banner) banner.style.display = "none";
        var modal = document.getElementById("cl-consent-modal");
        if (modal) modal.style.display = "none";
        if (typeof window.__clConsentSync === "function") {
          try { window.__clConsentSync(); } catch(_) {}
        }
      },
      openPreferences: function() {
        var modal = document.getElementById("cl-consent-modal");
        if (!modal) return;
        var anaInput = document.getElementById("cl-pref-ana");
        var mktInput = document.getElementById("cl-pref-mkt");
        if (anaInput) anaInput.checked = Boolean(currentConsent && currentConsent.ana);
        if (mktInput) mktInput.checked = Boolean(currentConsent && currentConsent.mkt);
        modal.style.display = "flex";
      },
      closePreferences: function() {
        var modal = document.getElementById("cl-consent-modal");
        if (modal) modal.style.display = "none";
      },
      saveFromModal: function() {
        var anaInput = document.getElementById("cl-pref-ana");
        var mktInput = document.getElementById("cl-pref-mkt");
        window.__clConsent.set({
          nec: true,
          ana: Boolean(anaInput && anaInput.checked),
          mkt: Boolean(mktInput && mktInput.checked)
        });
        var modal = document.getElementById("cl-consent-modal");
        if (modal) modal.style.display = "none";
      }
    };

    function removeGaCookies() {
      try {
        var cookies = document.cookie.split(";");
        var host = window.location.hostname;
        var dom = getCookieDomain();
        var domains = ["", dom, host, "." + host];
        var paths = ["/", window.location.pathname];
        for (var i = 0; i < cookies.length; i++) {
          var eqPos = cookies[i].indexOf("=");
          var name = (eqPos > -1 ? cookies[i].substr(0, eqPos) : cookies[i]).trim();
          if (name === "_ga" || name === "_gid" || name.indexOf("_ga_") === 0 || name.indexOf("_gat") === 0) {
            for (var d = 0; d < domains.length; d++) {
              for (var p = 0; p < paths.length; p++) {
                var domPart = domains[d] ? "; domain=" + domains[d] : "";
                document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=" + paths[p] + domPart;
              }
            }
          }
        }
      } catch(_) {}
    }

    ${ga4Id ? `
    window.dataLayer = window.dataLayer || [];
    function gtag() {
      if (window.__clConsent && !window.__clConsent.has("analytics")) {
        var firstArg = arguments[0];
        if (firstArg !== "consent") return;
      }
      dataLayer.push(arguments);
    }
    window.gtag = gtag;
    gtag("consent", "default", {
      "analytics_storage": currentConsent.ana ? "granted" : "denied",
      "ad_storage": currentConsent.mkt ? "granted" : "denied",
      "ad_user_data": currentConsent.mkt ? "granted" : "denied",
      "ad_personalization": currentConsent.mkt ? "granted" : "denied",
      "wait_for_update": 500
    });
    window["ga-disable-${escJsString(ga4Id)}"] = !currentConsent.ana;
    ` : ""}
  })();
  </script>`;

  /* ── GA4 snippet (Strictly Gated Dynamic Loader & Session Lifecycle) ─ */
  const ga4Snippet = ga4Id ? `
  <script>
  (function() {
    var gaId = '${escJsString(ga4Id)}';
    var disableKey = 'ga-disable-' + gaId;
    var gaLoaded = false;

    function enableGA4() {
      window[disableKey] = false;
      if (!gaLoaded) {
        gaLoaded = true;
        var s = document.createElement("script");
        s.async = true;
        s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(gaId);
        var first = document.getElementsByTagName("script")[0];
        if (first && first.parentNode) {
          first.parentNode.insertBefore(s, first);
        } else {
          document.head.appendChild(s);
        }
        gtag('js', new Date());
        gtag('config', gaId, { send_page_view: true });
      }
    }

    function disableGA4() {
      window[disableKey] = true;
    }

    if (window.__clConsent && window.__clConsent.has('analytics')) {
      enableGA4();
    } else {
      disableGA4();
    }
    if (window.__clConsent) {
      window.__clConsent.onChange(function(c) {
        if (c && c.ana) {
          enableGA4();
        } else {
          disableGA4();
        }
      });
    }
  })();
  </script>` : "";

  /* ── Meta Pixel snippet (Strict Consent Gated) ──────────────────── */
  const pixelSnippet = metaPixelId ? `
  <script>
  (function() {
    var pixelLoaded = false;
    function initMetaPixel() {
      if (pixelLoaded) return;
      pixelLoaded = true;
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){
      n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;
      s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
      (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
      fbq('init','${escJsString(metaPixelId)}');
      fbq('track','PageView');
    }

    if (window.__clConsent && window.__clConsent.has('marketing')) {
      initMetaPixel();
    } else if (window.__clConsent) {
      window.__clConsent.onChange(function(c) {
        if (c && c.mkt) initMetaPixel();
      });
    }
  })();
  </script>` : "";

  const c = consentResolved.content;
  const privacyPolicyUrl = c.privacyPolicyUrl || "/privacy-policy";

  /* ── Consent Banner & Preferences Modal ────────────────────────── */
  const consentUiSnippet = !isPreview ? `
<div id="cl-consent-banner" class="cl-consent-banner" style="display:none;" role="region" aria-label="Cookie and Privacy Notice">
  <div class="cl-consent-banner-inner">
    <div class="cl-consent-banner-text">
      <strong>${escHtml(c.bannerTitle)}</strong>
      <p>${escHtml(c.bannerBody)} ${privacyPolicyUrl ? `<a href="${escAttr(privacyPolicyUrl)}" target="_blank" rel="noopener">${escHtml(c.privacyPolicyLabel || "Privacy Policy")}</a>` : ""}</p>
    </div>
    <div class="cl-consent-banner-actions">
      <button type="button" class="cl-consent-btn cl-consent-btn-manage" onclick="window.__clConsent ? window.__clConsent.openPreferences() : null">${escHtml(c.btnManagePreferences)}</button>
      <button type="button" class="cl-consent-btn cl-consent-btn-reject" onclick="window.__clConsent ? window.__clConsent.set({nec:true,ana:false,mkt:false}) : null">${escHtml(c.btnRejectNonEssential)}</button>
      <button type="button" class="cl-consent-btn cl-consent-btn-accept" onclick="window.__clConsent ? window.__clConsent.set({nec:true,ana:true,mkt:true}) : null">${escHtml(c.btnAcceptAll)}</button>
    </div>
  </div>
</div>

<div id="cl-consent-modal" class="cl-consent-modal-overlay" style="display:none;" role="dialog" aria-modal="true" aria-labelledby="cl-modal-title">
  <div class="cl-consent-modal">
    <div class="cl-consent-modal-header">
      <h3 id="cl-modal-title">${escHtml(c.modalTitle)}</h3>
      <button type="button" class="cl-consent-modal-close" onclick="window.__clConsent ? window.__clConsent.closePreferences() : null" aria-label="Close">&times;</button>
    </div>
    <div class="cl-consent-modal-body">
      <p class="cl-consent-modal-desc">${escHtml(c.modalDescription)}</p>

      <div class="cl-consent-pref-item">
        <div class="cl-consent-pref-info">
          <div class="cl-consent-pref-title">
            <span>${escHtml(c.necessaryTitle)}</span>
            <span class="cl-consent-badge">${escHtml(c.necessaryBadge)}</span>
          </div>
          <p>${escHtml(c.necessaryDescription)}</p>
        </div>
        <div class="cl-consent-pref-toggle">
          <input type="checkbox" checked disabled id="cl-pref-nec">
        </div>
      </div>

      <div class="cl-consent-pref-item">
        <div class="cl-consent-pref-info">
          <div class="cl-consent-pref-title">
            <label for="cl-pref-ana">${escHtml(c.analyticsTitle)}</label>
          </div>
          <p>${escHtml(c.analyticsDescription)}</p>
        </div>
        <div class="cl-consent-pref-toggle">
          <input type="checkbox" id="cl-pref-ana">
        </div>
      </div>

      <div class="cl-consent-pref-item">
        <div class="cl-consent-pref-info">
          <div class="cl-consent-pref-title">
            <label for="cl-pref-mkt">${escHtml(c.marketingTitle)}</label>
          </div>
          <p>${escHtml(c.marketingDescription)}</p>
        </div>
        <div class="cl-consent-pref-toggle">
          <input type="checkbox" id="cl-pref-mkt">
        </div>
      </div>
    </div>
    <div class="cl-consent-modal-footer">
      <button type="button" class="cl-consent-btn cl-consent-btn-reject" onclick="window.__clConsent ? window.__clConsent.set({nec:true,ana:false,mkt:false}) : null">${escHtml(c.btnRejectNonEssential)}</button>
      <button type="button" class="cl-consent-btn cl-consent-btn-manage" onclick="window.__clConsent ? window.__clConsent.saveFromModal() : null">${escHtml(c.btnSavePreferences)}</button>
      <button type="button" class="cl-consent-btn cl-consent-btn-accept" onclick="window.__clConsent ? window.__clConsent.set({nec:true,ana:true,mkt:true}) : null">${escHtml(c.btnAcceptAll)}</button>
    </div>
  </div>
</div>

<button type="button" id="cl-consent-fallback-trigger" class="cl-consent-fallback-trigger" style="display:none;" aria-label="${escAttr(c.fallbackTriggerLabel || 'Cookie Preferences')}">${escHtml(c.fallbackTriggerLabel || "Cookie Preferences")}</button>

<script>
(function() {
  function syncConsentTriggers() {
    if (!window.__clConsent) return;
    var hasChoice = window.__clConsent.hasChoice();
    var banner = document.getElementById("cl-consent-banner");
    if (banner) banner.style.display = hasChoice ? "none" : "block";

    var fallback = document.getElementById("cl-consent-fallback-trigger");
    if (fallback) {
      var footerTrigger = document.querySelector("footer [data-cl-consent-preferences], .coming-soon-footer [data-cl-consent-preferences], [data-cl-consent-preferences]:not(#cl-consent-fallback-trigger), .cl-consent-preferences-trigger:not(#cl-consent-fallback-trigger)");
      if (hasChoice && !footerTrigger) {
        fallback.style.display = "block";
      } else {
        fallback.style.display = "none";
      }
    }
  }

  window.__clConsentSync = syncConsentTriggers;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncConsentTriggers);
  } else {
    syncConsentTriggers();
  }

  if (window.__clConsent) {
    window.__clConsent.onChange(function() {
      syncConsentTriggers();
    });
  }

  document.addEventListener("click", function(e) {
    var t = e.target && e.target.closest && e.target.closest("[data-cl-consent-preferences], .cl-consent-preferences-trigger, #cl-consent-fallback-trigger");
    if (t && window.__clConsent) {
      e.preventDefault();
      window.__clConsent.openPreferences();
    }
  });
})();
</script>` : "";

  /* ── 404 variant ──────────────────────────────────────────────── */
  if (notFound) {
    return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${escHtml(finalTitle)}</title>
${debugHtml}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
${consentBootstrapScript}${ga4Snippet}${pixelSnippet}
${baseCssBlock}
${themeCssLink}
</style>
</head>
<body>
<div class="page-shell">
  <p class="not-found-msg" style="text-align:center;font-size:.9375rem;opacity:.55;margin:2.5rem 0;">Aradığınız sayfa aktif değil veya bulunamadı.</p>
</div>
${consentUiSnippet}
  <script>
    document.addEventListener("DOMContentLoaded", function() {
      try {
        var p = new URLSearchParams(window.location.search);
        var err = p.get("error");
        if (err) {
          var f = document.querySelector("form");
          if (f) {
            var d = document.createElement("div");
            d.className = "form-error-alert";
            d.style.cssText = "background:#fee2e2;color:#991b1b;padding:12px;border-radius:6px;border:1px solid #f87171;margin-bottom:16px;font-weight:500;text-align:center;font-size:14px;";
            d.textContent = err;
            f.insertBefore(d, f.firstChild);
            if(window.history && window.history.replaceState) {
              p.delete("error");
              var newUrl = window.location.pathname + (p.toString() ? "?" + p.toString() : "") + window.location.hash;
              window.history.replaceState({}, "", newUrl);
            }
          }
        }
      } catch(e) {}


      // Global Fetch Interceptor to inject Turnstile token for custom submit scripts
      (function() {
        if (typeof window === "undefined") return;
        var originalFetch = window.fetch;
        window.fetch = function(resource, config) {
          var urlStr = "";
          if (typeof resource === "string") {
            urlStr = resource;
          } else if (resource && resource.url) {
            urlStr = resource.url;
          }

          var isApiLead = false;
          try {
            var urlObj = new URL(urlStr, window.location.origin);
            isApiLead = (urlObj.pathname === "/api/lead" || urlObj.pathname === "/api/lead/");
          } catch(e) {}

          if (
            isApiLead &&
            config &&
            config.method === "POST" &&
            config.body
          ) {
            try {
              var bodyObj = JSON.parse(config.body);
              if (bodyObj && !bodyObj["cf-turnstile-response"] && typeof turnstile !== "undefined") {
                return new Promise(function(resolve) {
                  var tempDiv = document.createElement("div");
                  document.body.appendChild(tempDiv);
                  try {
                    var widgetId = turnstile.render(tempDiv, {
                      sitekey: "${escAttr(cfg.turnstileSiteKey || '')}",
                      size: "invisible",
                      execution: "execute",
                      callback: function(t) {
                        resolve(t);
                        try {
                          turnstile.remove(widgetId);
                          tempDiv.remove();
                        } catch(e){}
                      },
                      "error-callback": function() {
                        resolve(null);
                        try {
                          turnstile.remove(widgetId);
                          tempDiv.remove();
                        } catch(e){}
                      }
                    });
                    turnstile.execute(widgetId);
                  } catch (err) {
                    resolve(null);
                    try { tempDiv.remove(); } catch(e){}
                  }
                }).then(function(token) {
                  if (token) {
                    bodyObj["cf-turnstile-response"] = token;
                    config.body = JSON.stringify(bodyObj);
                  }
                  return originalFetch.call(window, resource, config);
                });
              }
            } catch (e) {
              console.error("Fetch intercept error:", e);
            }
          }
          return originalFetch.call(this, resource, config);
        };
      })();

      // Canonical Form Submit Handling
      // Restored from 4361888 with event isolation to coexist with Phase 2B main.js
      var turnstileSiteKey = "${escAttr(cfg.turnstileSiteKey || "")}";
      var forms = document.querySelectorAll("form:not([action]), form[action=''], form[action='/api/lead'], form[data-quote-form]");

      forms.forEach(function(f) {
        var turnstileWidgetId = null;
        if (turnstileSiteKey && typeof turnstile !== "undefined") {
          var tdiv = document.createElement("div");
          tdiv.className = "cf-turnstile";
          f.appendChild(tdiv);
          try {
            turnstileWidgetId = turnstile.render(tdiv, {
              sitekey: turnstileSiteKey,
              size: "invisible",
              execution: "execute",
              callback: function(token) {
                if (f.dataset.isSubmitting === "true") doSubmit(token);
              },
              "error-callback": function() {
                if (f.dataset.isSubmitting === "true") abortSubmit("Güvenlik doğrulaması tamamlanamadı. Lütfen tekrar deneyin.");
              }
            });
          } catch (e) {
            console.error("Turnstile pre-render error:", e);
          }
        }

        f.addEventListener("cognilink:form-valid", function(e) {
          e.stopImmediatePropagation(); // Prevent main.js from executing its tokenless fetch

          if (f.dataset.isSubmitting === "true") return;
          f.dataset.isSubmitting = "true";

          // CAPTURE IMMUTABLE SNAPSHOT OF VALIDATED PAYLOAD
          if (e.detail && e.detail.values) {
             f._validatedSnapshot = JSON.parse(JSON.stringify(e.detail.values));
          } else {
             // Fallback if somehow detail.values is missing
             f._validatedSnapshot = Object.fromEntries(new FormData(f).entries());
          }

          var submitBtn = f.querySelector("button[type='submit']") || f.querySelector("input[type='submit']");
          if (submitBtn) {
            f.dataset.originalBtnText = submitBtn.textContent || submitBtn.value || "";
            submitBtn.disabled = true;
            if (submitBtn.tagName === "BUTTON") submitBtn.textContent = "Lütfen Bekleyin...";
            else submitBtn.value = "Lütfen Bekleyin...";
          }

          if (turnstileWidgetId !== null && typeof turnstile !== "undefined") {
            try {
              turnstile.execute(turnstileWidgetId);
            } catch (err) {
              abortSubmit("Güvenlik sistemi başlatılamadı. Lütfen sayfayı yenileyin.");
            }
          } else {
            doSubmit(null);
          }
        });

        function abortSubmit(errMsg) {
          f.dataset.isSubmitting = "false";
          var existingAlert = f.querySelector(".form-error-alert");
          if (existingAlert) existingAlert.remove();

          var d = document.createElement("div");
          d.className = "form-error-alert";
          d.style.cssText = "background:#fee2e2;color:#991b1b;padding:12px;border-radius:6px;border:1px solid #f87171;margin-bottom:16px;font-weight:500;text-align:center;font-size:14px;";
          d.textContent = errMsg;
          f.insertBefore(d, f.firstChild);

          var submitBtn = f.querySelector("button[type='submit']") || f.querySelector("input[type='submit']");
          if (submitBtn) {
            submitBtn.disabled = false;
            var originalBtnText = f.dataset.originalBtnText || "";
            if (submitBtn.tagName === "BUTTON") submitBtn.textContent = originalBtnText;
            else submitBtn.value = originalBtnText;
          }
          if (turnstileWidgetId !== null && typeof turnstile !== "undefined") {
            try { turnstile.reset(turnstileWidgetId); } catch(e){}
          }
        }

        function doSubmit(turnstileToken) {
          var jsonBody = f._validatedSnapshot || {};

          if (turnstileToken) {
            jsonBody["cf-turnstile-response"] = turnstileToken;
          }

          fetch("/api/lead", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(jsonBody)
          })
          .then(async function(res) {
            if (res.ok) {
              var red = formData.get("_redirect");
              if (red) window.location.href = red;
              else alert("Talebiniz başarıyla alındı.");
            } else {
              var data = await res.json().catch(function(){ return {}; });
              abortSubmit(data.error || "Geçersiz bilgi girdiniz. Lütfen kontrol edin.");
            }
          }).catch(function(err) {
            abortSubmit("Bağlantı hatası oluştu. Lütfen tekrar deneyin.");
          });
        }
      });
    });
  </script>

${slugData?.signals?.conversionSelector ? `
<script>
(function(){
  var sel = "${escAttr(slugData.signals.conversionSelector)}";
  var el = document.querySelector(sel);
  if (el) {
    var handler = function() {
      fetch("/api/decision/signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "form_submit", meta: { product: "${escAttr(productSubdomain)}", slug: "${escAttr(slug)}", campaign: "${escAttr(campaign || '')}", source: "${escAttr(contextId)}" } })
      }).catch(function(){});
    };
    if (el.tagName && el.tagName.toLowerCase() === 'form') {
      el.addEventListener("submit", handler);
    } else {
      el.addEventListener("click", handler);
    }
  }
})();
</script>` : ""}
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
  let finalHtml = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${escHtml(finalTitle)}</title>
${debugHtml}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta name="exp_token" content="${escAttr(expToken || defaultUtms.exp_token || "")}">
<meta name="utm_variant" content="${escAttr(utmVariant || defaultUtms.utm_variant || "")}">
${consentBootstrapScript}${ga4Snippet}${pixelSnippet}
${baseCssBlock}
${themeCssLink}${globalCssLink}
${turnstileScript}${pageCssBlock}
</head>
${bodyTag}
${renderedContent}
${consentUiSnippet}

${slugData?.customScript && slugData.customScript.trim() ? `\n<script>\n${slugData.customScript.replace(/<\/script>/gi, "<\\/script>")}\n</script>` : ""}

<script>
(function () {
  "use strict";

  // Client-side Draft Auto-Save
  (function() {
    var allowedFields = [
      "phone", "telefon", "tel", "cep", "gsm",
      "email", "eposta", "e-posta",
      "name", "isim", "ad", "ad_soyad", "full_name",
      "tc", "tcValue", "tcKimlik", "tckn", "tc_kimlik", "tc_no", "tc-kimlik",
      "birth_date", "birthDate", "dogumTarihi", "license_plate", "plate", "plaka", "ruhsatSeriNo",
      "contact_preference", "iletisimTercihi", "situation", "custom_fields"
    ];
    var lastSent = {};
    var saveTimeout = null;
    var pendingFields = {};

    function sendDraft() {
      if (Object.keys(pendingFields).length === 0) return;
      var fieldsToPost = Object.assign({}, pendingFields);
      pendingFields = {};

      fetch("/api/lead/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: "${escAttr(slug)}",
          fields: fieldsToPost
        })
      }).catch(function(err) {
        console.error("Draft save failed:", err);
      });
    }

    function queueSave(name, value) {
      if (lastSent[name] === value) return;
      lastSent[name] = value;
      pendingFields[name] = value;

      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(sendDraft, 500); // 500ms debounce
    }

    document.addEventListener("change", function(e) {
      if (!e.target || !e.target.name) return;
      var name = e.target.name;
      if (allowedFields.indexOf(name) === -1) return;

      var value = e.target.value;
      if (e.target.type === "checkbox") {
        value = e.target.checked ? e.target.value || "on" : "";
      }
      queueSave(name, value);
    }, true);

    document.addEventListener("blur", function(e) {
      if (!e.target || !e.target.name) return;
      var name = e.target.name;
      if (allowedFields.indexOf(name) === -1) return;

      var value = e.target.value;
      if (e.target.type === "checkbox") {
        value = e.target.checked ? e.target.value || "on" : "";
      }
      queueSave(name, value);
    }, true);
  })();

  // If this page is explicitly marked as a conversion goal in the engine map or slug data, fire it now.
  var isConversionGoal = ${!!(slugData?.type === "conv" || slugData?.isConversion)};
  if (isConversionGoal) {
     fetch("/api/decision/signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          type: "form_submit",
          meta: {
                product: "${escAttr(productSubdomain)}",
                slug: "${escAttr(slug)}",
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
                product: "${escAttr(productSubdomain)}",
                slug: "${escAttr(slug)}",
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
                product: "${escAttr(productSubdomain)}",
                slug: "${escAttr(slug)}",
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
                product: "${escAttr(productSubdomain)}",
                slug: "${escAttr(slug)}",
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
  <script>
    document.addEventListener("DOMContentLoaded", function() {
      try {
        var p = new URLSearchParams(window.location.search);
        var err = p.get("error");
        if (err) {
          var f = document.querySelector("form");
          if (f) {
            var d = document.createElement("div");
            d.className = "form-error-alert";
            d.style.cssText = "background:#fee2e2;color:#991b1b;padding:12px;border-radius:6px;border:1px solid #f87171;margin-bottom:16px;font-weight:500;text-align:center;font-size:14px;";
            d.textContent = err;
            f.insertBefore(d, f.firstChild);
            if(window.history && window.history.replaceState) {
              p.delete("error");
              var newUrl = window.location.pathname + (p.toString() ? "?" + p.toString() : "") + window.location.hash;
              window.history.replaceState({}, "", newUrl);
            }
          }
        }
      } catch(e) {}

      // Global Fetch Interceptor to inject Turnstile token for custom submit scripts
      (function() {
        if (typeof window === "undefined") return;
        var originalFetch = window.fetch;
        window.fetch = function(resource, config) {
          var urlStr = "";
          if (typeof resource === "string") {
            urlStr = resource;
          } else if (resource && resource.url) {
            urlStr = resource.url;
          }

          var isApiLead = false;
          try {
            var urlObj = new URL(urlStr, window.location.origin);
            isApiLead = (urlObj.pathname === "/api/lead" || urlObj.pathname === "/api/lead/");
          } catch(e) {}

          if (
            isApiLead &&
            config &&
            config.method === "POST" &&
            config.body
          ) {
            try {
              var bodyObj = JSON.parse(config.body);
              if (bodyObj && !bodyObj["cf-turnstile-response"] && typeof turnstile !== "undefined") {
                return new Promise(function(resolve) {
                  var tempDiv = document.createElement("div");
                  document.body.appendChild(tempDiv);
                  try {
                    var widgetId = turnstile.render(tempDiv, {
                      sitekey: "${escAttr(cfg.turnstileSiteKey || '')}",
                      size: "invisible",
                      execution: "execute",
                      callback: function(t) {
                        resolve(t);
                        try {
                          turnstile.remove(widgetId);
                          tempDiv.remove();
                        } catch(e){}
                      },
                      "error-callback": function() {
                        resolve(null);
                        try {
                          turnstile.remove(widgetId);
                          tempDiv.remove();
                        } catch(e){}
                      }
                    });
                    turnstile.execute(widgetId);
                  } catch (err) {
                    resolve(null);
                    try { tempDiv.remove(); } catch(e){}
                  }
                }).then(function(token) {
                  if (token) {
                    bodyObj["cf-turnstile-response"] = token;
                    config.body = JSON.stringify(bodyObj);
                  }
                  return originalFetch.call(window, resource, config);
                });
              }
            } catch (e) {
              console.error("Fetch intercept error:", e);
            }
          }
          return originalFetch.call(this, resource, config);
        };
      })();

      // Canonical Form Submit Handling
      // Restored from 4361888 with event isolation to coexist with Phase 2B main.js
      var turnstileSiteKey = "${escAttr(cfg.turnstileSiteKey || "")}";
      var forms = document.querySelectorAll("form:not([action]), form[action=''], form[action='/api/lead'], form[data-quote-form]");

      forms.forEach(function(f) {
        var turnstileWidgetId = null;
        if (turnstileSiteKey && typeof turnstile !== "undefined") {
          var tdiv = document.createElement("div");
          tdiv.className = "cf-turnstile";
          f.appendChild(tdiv);
          try {
            turnstileWidgetId = turnstile.render(tdiv, {
              sitekey: turnstileSiteKey,
              size: "invisible",
              execution: "execute",
              callback: function(token) {
                if (f.dataset.isSubmitting === "true") doSubmit(token);
              },
              "error-callback": function() {
                if (f.dataset.isSubmitting === "true") abortSubmit("Güvenlik doğrulaması tamamlanamadı. Lütfen tekrar deneyin.");
              }
            });
          } catch (e) {
            console.error("Turnstile pre-render error:", e);
          }
        }

        f.addEventListener("cognilink:form-valid", function(e) {
          e.stopImmediatePropagation(); // Prevent main.js from executing its tokenless fetch

          if (f.dataset.isSubmitting === "true") return;
          f.dataset.isSubmitting = "true";

          // CAPTURE IMMUTABLE SNAPSHOT OF VALIDATED PAYLOAD
          if (e.detail && e.detail.values) {
            f._validatedSnapshot = Object.assign({}, e.detail.values);
          } else {
            f._validatedSnapshot = Object.fromEntries(new FormData(f).entries());
          }

          var submitBtn = f.querySelector("button[type='submit']") || f.querySelector("input[type='submit']");
          if (submitBtn) {
            f.dataset.originalBtnText = submitBtn.textContent || submitBtn.value || "";
            submitBtn.disabled = true;
            if (submitBtn.tagName === "BUTTON") submitBtn.textContent = "Lütfen Bekleyin...";
            else submitBtn.value = "Lütfen Bekleyin...";
          }

          if (turnstileWidgetId !== null && typeof turnstile !== "undefined") {
            try {
              turnstile.execute(turnstileWidgetId);
            } catch (err) {
              abortSubmit("Güvenlik sistemi başlatılamadı. Lütfen sayfayı yenileyin.");
            }
          } else {
            doSubmit(null);
          }
        });

        function abortSubmit(errMsg) {
          f.dataset.isSubmitting = "false";
          var existingAlert = f.querySelector(".form-error-alert");
          if (existingAlert) existingAlert.remove();

          var d = document.createElement("div");
          d.className = "form-error-alert";
          d.style.cssText = "background:#fee2e2;color:#991b1b;padding:12px;border-radius:6px;border:1px solid #f87171;margin-bottom:16px;font-weight:500;text-align:center;font-size:14px;";
          d.textContent = errMsg;
          f.insertBefore(d, f.firstChild);

          var submitBtn = f.querySelector("button[type='submit']") || f.querySelector("input[type='submit']");
          if (submitBtn) {
            submitBtn.disabled = false;
            var originalBtnText = f.dataset.originalBtnText || "";
            if (submitBtn.tagName === "BUTTON") submitBtn.textContent = originalBtnText;
            else submitBtn.value = originalBtnText;
          }
          if (turnstileWidgetId !== null && typeof turnstile !== "undefined") {
            try { turnstile.reset(turnstileWidgetId); } catch(e){}
          }
        }

        function doSubmit(turnstileToken) {
          // Copy snapshot to avoid mutation
          var jsonBody = Object.assign({}, f._validatedSnapshot || {});

          if (turnstileToken) {
            jsonBody["cf-turnstile-response"] = turnstileToken;
          }

          fetch("/api/lead", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(jsonBody)
          })
          .then(async function(res) {
            if (res.ok) {
              var red = jsonBody["_redirect"];
              if (red) window.location.href = red;
              else alert("Talebiniz başarıyla alındı.");
            } else {
              var data = await res.json().catch(function(){ return {}; });
              abortSubmit(data.error || "Geçersiz bilgi girdiniz. Lütfen kontrol edin.");
            }
          }).catch(function(err) {
            abortSubmit("Bağlantı hatası oluştu. Lütfen tekrar deneyin.");
          });
        }
      });
    });
  </script>
</body>
</html>`;
  const canonicalSlug = (slug || slugData?.slug || "").trim();
  if (canonicalSlug) {
    const thankYouTarget = `/l/${escAttr(canonicalSlug)}/thanks`;
    finalHtml = finalHtml.replace(/\/l\/(?:\{slug\}|slug)\/thanks/g, thankYouTarget);
  }
  return prefillFormHtml(finalHtml, draftValues);
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
export const CONSENT_CSS = `
/* ── Consent Banner & Modal Styles ── */
.cl-consent-banner{position:fixed;bottom:var(--cl-consent-banner-bottom,0px);left:0;right:0;z-index:999990;background:var(--cl-consent-banner-bg,rgba(18,18,20,0.96));backdrop-filter:blur(var(--cl-consent-backdrop-blur,12px));-webkit-backdrop-filter:blur(var(--cl-consent-backdrop-blur,12px));border-top:var(--cl-consent-banner-border-width,1px) solid var(--cl-consent-border-color,rgba(255,255,255,0.12));border-radius:var(--cl-consent-banner-radius,0px);color:var(--cl-consent-text-color,#f3f4f6);font-family:var(--cl-consent-font-family,-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif);padding:var(--cl-consent-padding-y,1rem) var(--cl-consent-padding-x,1.25rem);box-shadow:0 -4px 24px rgba(0,0,0,0.4)}
.cl-consent-banner-inner{max-width:var(--cl-consent-max-width,1140px);margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:var(--cl-consent-body-actions-gap,1.25rem);flex-wrap:wrap}
.cl-consent-banner-text{flex:1 1 480px;font-size:0.875rem;line-height:1.45;color:var(--cl-consent-text-color,#f3f4f6);text-align:var(--cl-consent-content-align,left)}
.cl-consent-banner-text strong{display:block;font-size:0.95rem;font-weight:600;margin-bottom:var(--cl-consent-title-body-gap,0.25rem);color:var(--cl-consent-text-color,#ffffff)}
.cl-consent-banner-text p{margin:0;color:var(--cl-consent-secondary-text,#9ca3af)}
.cl-consent-banner-text a{color:var(--cl-consent-link-color,#60a5fa);text-decoration:underline;text-underline-offset:2px}
.cl-consent-banner-actions{display:flex;flex-direction:var(--cl-consent-desktop-action-direction,row);align-items:var(--cl-consent-desktop-action-align,center);gap:var(--cl-consent-action-gap,0.5rem);flex-wrap:wrap}
.cl-consent-btn{display:inline-flex;align-items:center;justify-content:center;padding:var(--cl-consent-btn-padding-y,0.55rem) var(--cl-consent-btn-padding-x,1rem);min-height:var(--cl-consent-btn-min-height,auto);border-radius:var(--cl-consent-button-radius,6px);font-size:0.85rem;font-weight:500;cursor:pointer;transition:all .15s ease;border:1px solid transparent;white-space:nowrap;font-family:inherit;text-align:center}
.cl-consent-btn-accept{background:var(--cl-consent-btn-primary-bg,#2563eb);color:var(--cl-consent-btn-primary-text,#ffffff);border-color:var(--cl-consent-btn-primary-border,#2563eb)}
.cl-consent-btn-accept:hover{filter:brightness(1.1)}
.cl-consent-btn-reject{background:var(--cl-consent-btn-secondary-bg,rgba(255,255,255,0.08));color:var(--cl-consent-btn-secondary-text,#e5e7eb);border-color:var(--cl-consent-btn-secondary-border,rgba(255,255,255,0.15))}
.cl-consent-btn-reject:hover{filter:brightness(1.15)}
.cl-consent-btn-manage{background:transparent;color:var(--cl-consent-secondary-text,#9ca3af);border-color:transparent;text-decoration:underline}
.cl-consent-btn-manage:hover{color:var(--cl-consent-text-color,#ffffff)}

.cl-consent-modal-overlay{position:fixed;inset:0;z-index:999999;background:var(--cl-consent-overlay-bg,rgba(0,0,0,var(--cl-consent-overlay-opacity,0.72)));backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:1rem}
.cl-consent-modal{background:var(--cl-consent-modal-bg,#18181b);border:1px solid var(--cl-consent-modal-border,rgba(255,255,255,0.12));border-radius:var(--cl-consent-modal-radius,12px);width:100%;max-width:var(--cl-consent-modal-max-width,540px);max-height:90vh;overflow-y:auto;color:var(--cl-consent-text-color,#f3f4f6);font-family:var(--cl-consent-font-family,-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif);box-shadow:0 20px 40px rgba(0,0,0,0.6);display:flex;flex-direction:column}
.cl-consent-modal-header{display:flex;align-items:center;justify-content:space-between;padding:var(--cl-consent-modal-header-padding,1.25rem 1.5rem);border-bottom:1px solid var(--cl-consent-modal-border,rgba(255,255,255,0.08))}
.cl-consent-modal-header h3{margin:0;font-size:1.1rem;font-weight:600;color:var(--cl-consent-text-color,#ffffff)}
.cl-consent-modal-close{background:none;border:none;color:var(--cl-consent-close-color,#9ca3af);font-size:var(--cl-consent-close-size,1.5rem);cursor:pointer;line-height:1;padding:0;display:inline-flex;align-items:center;justify-content:center}
.cl-consent-modal-close:hover{color:var(--cl-consent-text-color,#fff)}
.cl-consent-modal-body{padding:var(--cl-consent-modal-body-padding,1.25rem 1.5rem);display:flex;flex-direction:column;gap:var(--cl-consent-card-gap,0.75rem)}
.cl-consent-modal-desc{margin:0 0 0.25rem 0;font-size:0.85rem;color:var(--cl-consent-secondary-text,#9ca3af);line-height:1.45}
.cl-consent-pref-item{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;padding:var(--cl-consent-card-padding,0.75rem 1rem);background:var(--cl-consent-card-bg,rgba(255,255,255,0.03));border:var(--cl-consent-card-border-width,1px) solid var(--cl-consent-card-border-color,rgba(255,255,255,0.06));border-radius:var(--cl-consent-card-radius,8px)}
.cl-consent-pref-info{flex:1}
.cl-consent-pref-title{display:flex;align-items:center;gap:0.5rem;font-weight:600;font-size:0.9rem;margin-bottom:0.25rem;color:var(--cl-consent-text-color,#f3f4f6)}
.cl-consent-pref-info p{margin:0;font-size:0.8rem;color:var(--cl-consent-secondary-text,#9ca3af);line-height:1.35}
.cl-consent-badge{font-size:0.7rem;font-weight:500;background:rgba(255,255,255,0.1);color:var(--cl-consent-secondary-text,#d1d5db);padding:0.15rem 0.4rem;border-radius:4px}
.cl-consent-pref-toggle input[type="checkbox"]{width:var(--cl-consent-checkbox-size,1.25rem);height:var(--cl-consent-checkbox-size,1.25rem);accent-color:var(--cl-consent-accent-color,#2563eb);cursor:pointer}
.cl-consent-modal-footer{display:flex;align-items:center;justify-content:flex-end;gap:var(--cl-consent-action-gap,0.5rem);padding:var(--cl-consent-modal-footer-padding,1rem 1.5rem);border-top:1px solid var(--cl-consent-modal-border,rgba(255,255,255,0.08));flex-wrap:wrap}

.cl-consent-fallback-trigger{position:fixed;bottom:1rem;left:1rem;z-index:999980;background:var(--cl-consent-banner-bg,rgba(18,18,20,0.92));color:var(--cl-consent-secondary-text,#9ca3af);border:1px solid var(--cl-consent-border-color,rgba(255,255,255,0.15));border-radius:var(--cl-consent-button-radius,6px);padding:0.4rem 0.75rem;font-size:0.75rem;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.3);backdrop-filter:blur(8px);transition:color .15s,border-color .15s;display:none;font-family:var(--cl-consent-font-family,-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif)}
.cl-consent-fallback-trigger:hover{color:var(--cl-consent-text-color,#ffffff);border-color:rgba(255,255,255,0.3)}

@media (max-width: 640px) {
  .cl-consent-banner{padding:var(--cl-consent-mobile-padding-y,0.75rem) var(--cl-consent-mobile-padding-x,1rem)}
  .cl-consent-banner-inner{max-width:var(--cl-consent-mobile-max-width,100%)}
  .cl-consent-banner-actions{width:100%;flex-direction:var(--cl-consent-mobile-action-direction,column);align-items:var(--cl-consent-mobile-action-align,stretch);justify-content:stretch}
  .cl-consent-banner-actions .cl-consent-btn{flex:1 1 100%;text-align:center}
}

/* Scoped preview stage overrides for Studio Panel */
.cl-consent-preview-stage{position:relative;width:100%;box-sizing:border-box}
.cl-consent-preview-stage .cl-consent-banner{position:relative!important;bottom:auto!important;left:auto!important;right:auto!important;margin:0 auto}
.cl-consent-preview-stage .cl-consent-modal-overlay{position:relative!important;inset:auto!important;padding:1.5rem!important;border-radius:8px!important;display:flex!important;margin:0 auto}
.cl-consent-preview-stage .cl-consent-modal{margin:0 auto!important}
.cl-consent-preview-stage.cl-is-mobile .cl-consent-banner{padding:var(--cl-consent-mobile-padding-y,0.75rem) var(--cl-consent-mobile-padding-x,1rem)}
.cl-consent-preview-stage.cl-is-mobile .cl-consent-banner-inner{max-width:var(--cl-consent-mobile-max-width,100%)}
.cl-consent-preview-stage.cl-is-mobile .cl-consent-banner-actions{width:100%;flex-direction:var(--cl-consent-mobile-action-direction,column);align-items:var(--cl-consent-mobile-action-align,stretch);justify-content:stretch}
.cl-consent-preview-stage.cl-is-mobile .cl-consent-banner-actions .cl-consent-btn{flex:1 1 100%;text-align:center}
`;

const BASE_CSS = `
*,*::before,*::after{box-sizing:border-box}
body{margin:0;min-height:100dvh;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,Arial,sans-serif;line-height:1.5;-webkit-font-smoothing:antialiased}
img,video{max-width:100%;height:auto}
button,input,select,textarea{font-family:inherit}
.page-shell{width:100%;max-width:none;margin:0;padding:0;display:block}
${CONSENT_CSS}
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

function prefillFormHtml(html, draftValues) {
  if (!draftValues || Object.keys(draftValues).length === 0) return html;

  const ALLOWED_FIELDS = [
    "phone", "telefon", "tel", "cep", "gsm",
    "email", "eposta", "e-posta",
    "name", "isim", "ad", "ad_soyad", "full_name",
    "tc", "tcValue", "tcKimlik", "tckn", "tc_kimlik", "tc_no", "tc-kimlik",
    "birth_date", "birthDate", "dogumTarihi", "license_plate", "plate", "plaka", "ruhsatSeriNo",
    "contact_preference", "iletisimTercihi", "situation", "custom_fields"
  ];

  // 1. Prefill inputs
  html = html.replace(/<input([^>]*?)>/gi, (match, attrs) => {
    const nameMatch = attrs.match(/name=["']?([^"'\s>]+)["']?/i);
    if (!nameMatch) return match;
    const name = nameMatch[1];
    if (!ALLOWED_FIELDS.includes(name)) return match;

    const val = draftValues[name];
    if (val === undefined || val === null) return match;

    const typeMatch = attrs.match(/type=["']?([^"'\s>]+)["']?/i);
    const type = typeMatch ? typeMatch[1].toLowerCase() : "text";
    if (type === "file") return match;

    let isSelfClosing = false;
    if (attrs.endsWith("/")) {
      attrs = attrs.slice(0, -1);
      isSelfClosing = true;
    }
    const suffix = isSelfClosing ? " />" : ">";

    if (type === "checkbox" || type === "radio") {
      const valueAttrMatch = attrs.match(/value=["']?([^"'\s>]+)["']?/i);
      const valAttr = valueAttrMatch ? valueAttrMatch[1] : "on";
      if (String(val) === String(valAttr)) {
        if (!/checked/i.test(attrs)) {
          return `<input${attrs} checked${suffix}`;
        }
      } else {
        return `<input${attrs.replace(/\s*checked/gi, "")}${suffix}`;
      }
      return `<input${attrs}${suffix}`;
    }

    const escapedVal = escAttr(val);
    if (/value=/i.test(attrs)) {
      return `<input${attrs.replace(/value=["']?[^"'\s>]*["']?/i, `value="${escapedVal}"`)}${suffix}`;
    } else {
      return `<input${attrs} value="${escapedVal}"${suffix}`;
    }
  });

  // 2. Prefill textareas
  html = html.replace(/<textarea([^>]*?)>([\s\S]*?)<\/textarea>/gi, (match, attrs, content) => {
    const nameMatch = attrs.match(/name=["']?([^"'\s>]+)["']?/i);
    if (!nameMatch) return match;
    const name = nameMatch[1];
    if (!ALLOWED_FIELDS.includes(name)) return match;

    const val = draftValues[name];
    if (val === undefined || val === null) return match;

    return `<textarea${attrs}>${escHtml(val)}</textarea>`;
  });

  // 3. Prefill select elements
  html = html.replace(/<select([^>]*?)>([\s\S]*?)<\/select>/gi, (match, attrs, content) => {
    const nameMatch = attrs.match(/name=["']?([^"'\s>]+)["']?/i);
    if (!nameMatch) return match;
    const name = nameMatch[1];
    if (!ALLOWED_FIELDS.includes(name)) return match;

    const val = draftValues[name];
    if (val === undefined || val === null) return match;

    const optionRegex = /<option([^>]*?)>/gi;
    const newContent = content.replace(optionRegex, (optMatch, optAttrs) => {
      const valAttrMatch = optAttrs.match(/value=["']?([^"'\s>]*?)["']?/i);
      const optVal = valAttrMatch ? valAttrMatch[1] : "";
      if (String(optVal) === String(val)) {
        if (!/selected/i.test(optAttrs)) {
          return `<option${optAttrs} selected>`;
        }
      } else {
        return `<option${optAttrs.replace(/\s*selected/gi, "")}>`;
      }
      return optMatch;
    });

    return `<select${attrs}>${newContent}</select>`;
  });

  return html;
}

export const renderLanding = renderHub;
