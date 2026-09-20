/**
 * functions/api/admin/consent.js
 *
 * Privacy & Consent Presentation Configuration Admin API.
 * Reads and persists panel-configurable consent copy and visual tokens.
 * Consent engine behavior (gating, categories, cookie rules) remains in shared runtime code.
 */

import { verifyToken, unauthorized, jsonHeaders } from "../../_shared/auth.js";
import { DEFAULT_CONSENT_CONFIG, DEFAULT_TR_CONSENT_CONTENT, resolveConsentConfig } from "../../_shared/hub-renderer.js";

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

function sanitizeContentBlock(input = {}, defaults = {}) {
  return {
    bannerTitle: sanitizeString(input.bannerTitle, defaults.bannerTitle, 200),
    bannerBody: sanitizeString(input.bannerBody, defaults.bannerBody, 2000),
    btnAcceptAll: sanitizeString(input.btnAcceptAll, defaults.btnAcceptAll, 100),
    btnRejectNonEssential: sanitizeString(input.btnRejectNonEssential, defaults.btnRejectNonEssential, 100),
    btnManagePreferences: sanitizeString(input.btnManagePreferences, defaults.btnManagePreferences, 100),
    modalTitle: sanitizeString(input.modalTitle, defaults.modalTitle, 200),
    modalDescription: sanitizeString(input.modalDescription, defaults.modalDescription, 2000),
    necessaryTitle: sanitizeString(input.necessaryTitle, defaults.necessaryTitle, 150),
    necessaryDescription: sanitizeString(input.necessaryDescription, defaults.necessaryDescription, 1000),
    necessaryBadge: sanitizeString(input.necessaryBadge, defaults.necessaryBadge, 80),
    analyticsTitle: sanitizeString(input.analyticsTitle, defaults.analyticsTitle, 150),
    analyticsDescription: sanitizeString(input.analyticsDescription, defaults.analyticsDescription, 1000),
    marketingTitle: sanitizeString(input.marketingTitle, defaults.marketingTitle, 150),
    marketingDescription: sanitizeString(input.marketingDescription, defaults.marketingDescription, 1000),
    btnSavePreferences: sanitizeString(input.btnSavePreferences, defaults.btnSavePreferences, 100),
    privacyPolicyLabel: sanitizeString(input.privacyPolicyLabel, defaults.privacyPolicyLabel, 100),
    privacyPolicyUrl: sanitizeString(input.privacyPolicyUrl, defaults.privacyPolicyUrl, 500),
    fallbackTriggerLabel: sanitizeString(input.fallbackTriggerLabel, defaults.fallbackTriggerLabel, 100)
  };
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
      raw: storedConsent || {},
      tr: storedConsent?.tr || DEFAULT_TR_CONSENT_CONTENT,
      en: storedConsent?.en || storedConsent?.content || DEFAULT_CONSENT_CONFIG.content,
      defaults: DEFAULT_CONSENT_CONFIG,
      trDefaults: DEFAULT_TR_CONSENT_CONTENT
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
  const inputEN = body?.en || inputContent;
  const inputTR = body?.tr || {};
  const inputVisual = body?.visual || {};

  const dC = DEFAULT_CONSENT_CONFIG.content;
  const dTR = DEFAULT_TR_CONSENT_CONTENT;
  const dV = DEFAULT_CONSENT_CONFIG.visual;

  // Strict whitelist sanitization: ONLY presentation and content tokens allowed.
  // Security/engine fields (categories, gating, IDs, cookie name/TTL) cannot be modified.
  const sanitized = {
    content: sanitizeContentBlock(inputContent, dC),
    en: sanitizeContentBlock(inputEN, dC),
    tr: sanitizeContentBlock(inputTR, dTR),
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

  if (body.tr && typeof body.tr === "object") sanitized.tr = body.tr;
  if (body.en && typeof body.en === "object") sanitized.en = body.en;
  if (body.locales && typeof body.locales === "object") sanitized.locales = body.locales;

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
