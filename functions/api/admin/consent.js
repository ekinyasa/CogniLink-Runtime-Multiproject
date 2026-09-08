/**
 * functions/api/admin/consent.js
 *
 * Privacy & Consent Presentation Configuration Admin API.
 * Reads and persists panel-configurable consent copy and visual tokens.
 * Consent engine behavior (gating, categories, cookie rules) remains in shared runtime code.
 */

import { verifyToken, unauthorized, jsonHeaders } from "../../_shared/auth.js";
import { DEFAULT_CONSENT_CONFIG, resolveConsentConfig } from "../../_shared/hub-renderer.js";

const CONFIG_KEY = "hub_config";
const APP_CONSENT_KEY = "site:consent";

function sanitizeString(val, fallback, maxLen = 1000) {
  if (val == null) return fallback;
  const str = String(val).trim();
  if (!str) return fallback;
  // Strip script tags and unsafe event handlers for defense-in-depth
  const clean = str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\bon\w+\s*=/gi, "");
  return clean.slice(0, maxLen);
}

function sanitizeColorOrStyle(val, fallback, maxLen = 150) {
  if (val == null) return fallback;
  const str = String(val).trim();
  if (!str) return fallback;
  // Disallow semicolon, curly braces, quotes, url(), expression to prevent CSS injection
  if (/[;{}<>"']|url\(|expression\(/i.test(str)) return fallback;
  return str.slice(0, maxLen);
}

function sanitizeEnum(val, allowedArray, fallback) {
  if (val == null) return fallback;
  const str = String(val).trim().toLowerCase();
  return allowedArray.includes(str) ? str : fallback;
}

const DIMENSION_TOKEN_REGEX = /^(0|0px|\d+(\.\d+)?(px|rem|em|%|vh|vw))$/i;

function sanitizeDimension(val, fallback, { allowAuto = false, allowNone = false } = {}) {
  if (val == null) return fallback;
  const str = String(val).trim();
  if (!str) return fallback;

  if (allowAuto && str.toLowerCase() === "auto") return "auto";
  if (allowNone && str.toLowerCase() === "none") return "none";

  const tokens = str.split(/\s+/);
  if (tokens.length === 0 || tokens.length > 4) return fallback;

  for (const t of tokens) {
    if (!DIMENSION_TOKEN_REGEX.test(t)) return fallback;
  }
  return str;
}

function sanitizeOpacity(val, fallback) {
  if (val == null || val === "") return fallback;
  const num = parseFloat(val);
  if (isNaN(num)) return fallback;
  const clamped = Math.max(0, Math.min(1, num));
  return String(clamped);
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await verifyToken(request, env))) return unauthorized();

  let storedConsent = null;

  // 1. Try LANDING_CONFIG hub_config
  if (env.LANDING_CONFIG) {
    try {
      const hubCfg = await env.LANDING_CONFIG.get(CONFIG_KEY, { type: "json" });
      if (hubCfg && hubCfg.consent && typeof hubCfg.consent === "object") {
        storedConsent = hubCfg.consent;
      }
    } catch (_) {}
  }

  // 2. Fallback to APP_CONFIG site:consent
  if (!storedConsent && env.APP_CONFIG) {
    try {
      const appCfg = await env.APP_CONFIG.get(APP_CONSENT_KEY, { type: "json" });
      if (appCfg && typeof appCfg === "object") {
        storedConsent = appCfg;
      }
    } catch (_) {}
  }

  const resolved = resolveConsentConfig(storedConsent);

  return new Response(
    JSON.stringify({
      ok: true,
      consent: resolved,
      defaults: DEFAULT_CONSENT_CONFIG
    }),
    { status: 200, headers: jsonHeaders() }
  );
}

export async function onRequestPost(context) {
  return handleSave(context);
}

export async function onRequestPut(context) {
  return handleSave(context);
}

async function handleSave(context) {
  const { request, env } = context;
  if (!(await verifyToken(request, env))) return unauthorized();

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Invalid JSON payload." }), {
      status: 400,
      headers: jsonHeaders()
    });
  }

  const inputContent = body?.content || {};
  const inputVisual = body?.visual || {};
  const dC = DEFAULT_CONSENT_CONFIG.content;
  const dV = DEFAULT_CONSENT_CONFIG.visual;

  // Strict whitelist sanitization: ONLY presentation and content tokens allowed.
  // Security/engine fields (categories, gating, IDs, cookie name/TTL) cannot be modified.
  const sanitized = {
    content: {
      bannerTitle: sanitizeString(inputContent.bannerTitle, dC.bannerTitle, 200),
      bannerBody: sanitizeString(inputContent.bannerBody, dC.bannerBody, 2000),
      btnAcceptAll: sanitizeString(inputContent.btnAcceptAll, dC.btnAcceptAll, 100),
      btnRejectNonEssential: sanitizeString(inputContent.btnRejectNonEssential, dC.btnRejectNonEssential, 100),
      btnManagePreferences: sanitizeString(inputContent.btnManagePreferences, dC.btnManagePreferences, 100),
      modalTitle: sanitizeString(inputContent.modalTitle, dC.modalTitle, 200),
      modalDescription: sanitizeString(inputContent.modalDescription, dC.modalDescription, 2000),
      necessaryTitle: sanitizeString(inputContent.necessaryTitle, dC.necessaryTitle, 150),
      necessaryDescription: sanitizeString(inputContent.necessaryDescription, dC.necessaryDescription, 1000),
      necessaryBadge: sanitizeString(inputContent.necessaryBadge, dC.necessaryBadge, 80),
      analyticsTitle: sanitizeString(inputContent.analyticsTitle, dC.analyticsTitle, 150),
      analyticsDescription: sanitizeString(inputContent.analyticsDescription, dC.analyticsDescription, 1000),
      marketingTitle: sanitizeString(inputContent.marketingTitle, dC.marketingTitle, 150),
      marketingDescription: sanitizeString(inputContent.marketingDescription, dC.marketingDescription, 1000),
      btnSavePreferences: sanitizeString(inputContent.btnSavePreferences, dC.btnSavePreferences, 100),
      privacyPolicyLabel: sanitizeString(inputContent.privacyPolicyLabel, dC.privacyPolicyLabel, 100),
      privacyPolicyUrl: sanitizeString(inputContent.privacyPolicyUrl, dC.privacyPolicyUrl, 500),
      fallbackTriggerLabel: sanitizeString(inputContent.fallbackTriggerLabel, dC.fallbackTriggerLabel, 100)
    },
    visual: {
      bannerBg: sanitizeColorOrStyle(inputVisual.bannerBg, dV.bannerBg),
      textColor: sanitizeColorOrStyle(inputVisual.textColor, dV.textColor),
      secondaryTextColor: sanitizeColorOrStyle(inputVisual.secondaryTextColor, dV.secondaryTextColor),
      borderColor: sanitizeColorOrStyle(inputVisual.borderColor, dV.borderColor),
      backdropBlur: sanitizeDimension(inputVisual.backdropBlur, dV.backdropBlur),
      bannerRadius: sanitizeDimension(inputVisual.bannerRadius, dV.bannerRadius),
      paddingY: sanitizeDimension(inputVisual.paddingY, dV.paddingY),
      paddingX: sanitizeDimension(inputVisual.paddingX, dV.paddingX),
      maxWidth: sanitizeDimension(inputVisual.maxWidth, dV.maxWidth, { allowNone: true, allowAuto: true }),
      buttonRadius: sanitizeDimension(inputVisual.buttonRadius, dV.buttonRadius),
      btnPrimaryBg: sanitizeColorOrStyle(inputVisual.btnPrimaryBg, dV.btnPrimaryBg),
      btnPrimaryText: sanitizeColorOrStyle(inputVisual.btnPrimaryText, dV.btnPrimaryText),
      btnPrimaryBorder: sanitizeColorOrStyle(inputVisual.btnPrimaryBorder, dV.btnPrimaryBorder),
      btnSecondaryBg: sanitizeColorOrStyle(inputVisual.btnSecondaryBg, dV.btnSecondaryBg),
      btnSecondaryText: sanitizeColorOrStyle(inputVisual.btnSecondaryText, dV.btnSecondaryText),
      btnSecondaryBorder: sanitizeColorOrStyle(inputVisual.btnSecondaryBorder, dV.btnSecondaryBorder),
      linkColor: sanitizeColorOrStyle(inputVisual.linkColor, dV.linkColor),
      modalBg: sanitizeColorOrStyle(inputVisual.modalBg, dV.modalBg),
      modalBorder: sanitizeColorOrStyle(inputVisual.modalBorder, dV.modalBorder),
      modalRadius: sanitizeDimension(inputVisual.modalRadius, dV.modalRadius),
      overlayOpacity: sanitizeOpacity(inputVisual.overlayOpacity, dV.overlayOpacity),
      accentColor: sanitizeColorOrStyle(inputVisual.accentColor, dV.accentColor),
      fontFamily: sanitizeColorOrStyle(inputVisual.fontFamily, dV.fontFamily, 250),
      mobilePaddingY: sanitizeDimension(inputVisual.mobilePaddingY, dV.mobilePaddingY),
      mobilePaddingX: sanitizeDimension(inputVisual.mobilePaddingX, dV.mobilePaddingX),

      // Layout & Geometry
      bannerBottom: sanitizeDimension(inputVisual.bannerBottom, dV.bannerBottom),
      bannerBorderWidth: sanitizeDimension(inputVisual.bannerBorderWidth, dV.bannerBorderWidth),
      bannerAlignment: sanitizeEnum(inputVisual.bannerAlignment, ["left", "center"], dV.bannerAlignment),
      desktopActionLayout: sanitizeEnum(inputVisual.desktopActionLayout, ["horizontal", "stacked"], dV.desktopActionLayout),
      mobileActionLayout: sanitizeEnum(inputVisual.mobileActionLayout, ["horizontal", "stacked"], dV.mobileActionLayout),
      titleBodyGap: sanitizeDimension(inputVisual.titleBodyGap, dV.titleBodyGap),
      bodyActionsGap: sanitizeDimension(inputVisual.bodyActionsGap, dV.bodyActionsGap),
      actionGap: sanitizeDimension(inputVisual.actionGap, dV.actionGap),

      // Button Geometry
      btnPaddingX: sanitizeDimension(inputVisual.btnPaddingX, dV.btnPaddingX),
      btnPaddingY: sanitizeDimension(inputVisual.btnPaddingY, dV.btnPaddingY),
      btnMinHeight: sanitizeDimension(inputVisual.btnMinHeight, dV.btnMinHeight, { allowAuto: true }),

      // Modal Geometry
      modalMaxWidth: sanitizeDimension(inputVisual.modalMaxWidth, dV.modalMaxWidth),
      modalHeaderPadding: sanitizeDimension(inputVisual.modalHeaderPadding, dV.modalHeaderPadding),
      modalBodyPadding: sanitizeDimension(inputVisual.modalBodyPadding, dV.modalBodyPadding),
      modalFooterPadding: sanitizeDimension(inputVisual.modalFooterPadding, dV.modalFooterPadding),

      // Category Cards
      cardBg: sanitizeColorOrStyle(inputVisual.cardBg, dV.cardBg),
      cardBorderColor: sanitizeColorOrStyle(inputVisual.cardBorderColor, dV.cardBorderColor),
      cardBorderWidth: sanitizeDimension(inputVisual.cardBorderWidth, dV.cardBorderWidth),
      cardRadius: sanitizeDimension(inputVisual.cardRadius, dV.cardRadius),
      cardGap: sanitizeDimension(inputVisual.cardGap, dV.cardGap),
      cardPadding: sanitizeDimension(inputVisual.cardPadding, dV.cardPadding),

      // Overlay & Controls
      overlayColor: sanitizeColorOrStyle(inputVisual.overlayColor, dV.overlayColor),
      closeColor: sanitizeColorOrStyle(inputVisual.closeColor, dV.closeColor),
      closeSize: sanitizeDimension(inputVisual.closeSize, dV.closeSize),
      checkboxSize: sanitizeDimension(inputVisual.checkboxSize, dV.checkboxSize),
      mobileMaxWidth: sanitizeDimension(inputVisual.mobileMaxWidth, dV.mobileMaxWidth, { allowNone: true, allowAuto: true })
    }
  };

  try {
    // 1. Write to LANDING_CONFIG hub_config
    if (env.LANDING_CONFIG) {
      const existingHub = (await env.LANDING_CONFIG.get(CONFIG_KEY, { type: "json" })) || {};
      existingHub.consent = sanitized;
      await env.LANDING_CONFIG.put(CONFIG_KEY, JSON.stringify(existingHub));
    }

    // 2. Write to APP_CONFIG site:consent
    if (env.APP_CONFIG) {
      await env.APP_CONFIG.put(APP_CONSENT_KEY, JSON.stringify(sanitized));
    }

    return new Response(
      JSON.stringify({
        ok: true,
        success: true,
        consent: sanitized
      }),
      { status: 200, headers: jsonHeaders() }
    );
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message || "Failed to save consent config." }), {
      status: 500,
      headers: jsonHeaders()
    });
  }
}
