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
  // Disallow semicolon or curly braces breaking CSS injection
  const clean = str.replace(/[;{}]/g, "");
  return clean.slice(0, maxLen);
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
      backdropBlur: sanitizeColorOrStyle(inputVisual.backdropBlur, dV.backdropBlur),
      bannerRadius: sanitizeColorOrStyle(inputVisual.bannerRadius, dV.bannerRadius),
      paddingY: sanitizeColorOrStyle(inputVisual.paddingY, dV.paddingY),
      paddingX: sanitizeColorOrStyle(inputVisual.paddingX, dV.paddingX),
      maxWidth: sanitizeColorOrStyle(inputVisual.maxWidth, dV.maxWidth),
      buttonRadius: sanitizeColorOrStyle(inputVisual.buttonRadius, dV.buttonRadius),
      btnPrimaryBg: sanitizeColorOrStyle(inputVisual.btnPrimaryBg, dV.btnPrimaryBg),
      btnPrimaryText: sanitizeColorOrStyle(inputVisual.btnPrimaryText, dV.btnPrimaryText),
      btnPrimaryBorder: sanitizeColorOrStyle(inputVisual.btnPrimaryBorder, dV.btnPrimaryBorder),
      btnSecondaryBg: sanitizeColorOrStyle(inputVisual.btnSecondaryBg, dV.btnSecondaryBg),
      btnSecondaryText: sanitizeColorOrStyle(inputVisual.btnSecondaryText, dV.btnSecondaryText),
      btnSecondaryBorder: sanitizeColorOrStyle(inputVisual.btnSecondaryBorder, dV.btnSecondaryBorder),
      linkColor: sanitizeColorOrStyle(inputVisual.linkColor, dV.linkColor),
      modalBg: sanitizeColorOrStyle(inputVisual.modalBg, dV.modalBg),
      modalBorder: sanitizeColorOrStyle(inputVisual.modalBorder, dV.modalBorder),
      modalRadius: sanitizeColorOrStyle(inputVisual.modalRadius, dV.modalRadius),
      overlayOpacity: sanitizeColorOrStyle(inputVisual.overlayOpacity, dV.overlayOpacity),
      accentColor: sanitizeColorOrStyle(inputVisual.accentColor, dV.accentColor),
      fontFamily: sanitizeColorOrStyle(inputVisual.fontFamily, dV.fontFamily),
      mobilePaddingY: sanitizeColorOrStyle(inputVisual.mobilePaddingY, dV.mobilePaddingY),
      mobilePaddingX: sanitizeColorOrStyle(inputVisual.mobilePaddingX, dV.mobilePaddingX)
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
