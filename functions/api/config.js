import { verifyToken, unauthorized, jsonHeaders } from "../_shared/auth.js";

const CONFIG_KEY = "hub_config";

const ALLOWED_STRING_KEYS = ["themeCssUrl", "customStyleCss", "pageTitle", "customScript"];

/* ── URL helpers ─────────────────────────────────────────────────── */
function normalizeUrl(str) {
  if (!str || typeof str !== "string") return "";
  const trimmed = str.trim();
  if (!trimmed) return "";
  if (
    trimmed.startsWith("https://") || trimmed.startsWith("http://") ||
    trimmed.startsWith("mailto:") || trimmed.startsWith("tel:")
  ) return trimmed;
  return "https://" + trimmed;
}

function validateUrl(s) {
  if (!s) return "URL is empty.";
  if (s.startsWith("mailto:")) {
    return /^mailto:[^@]+@[^@]+\.[^@]+$/.test(s) ? "" : "Invalid mailto URL format.";
  }
  if (s.startsWith("tel:")) {
    return /^tel:\+?[0-9]+$/.test(s) ? "" : "Invalid tel URL format.";
  }
  try {
    const u = new URL(s);
    if ((u.protocol === "https:" || u.protocol === "http:") && u.hostname && u.hostname.includes(".")) return "";
    return "Invalid URL format.";
  } catch {
    return "Invalid URL format.";
  }
}
const BASE_LINK_IDS = ["official", "programs", "release", "newsletter"];

/* ── GET /api/config ──────────────────────────────────────────────── */
export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await verifyToken(request, env))) return unauthorized();

  const cfg = await env.LANDING_CONFIG.get(CONFIG_KEY, { type: "json" }) || {};

  // Backward-compat: migrate old field names for response
  const out = { ...cfg };
  delete out.headerText;
  delete out.footerText;
  delete out.headerHtml;
  delete out.footerHtml;
  delete out.baseLinks;

  return new Response(JSON.stringify({ config: out }), { headers: jsonHeaders() });
}

/* ── PUT /api/config ──────────────────────────────────────────────── */
export async function onRequestPut(context) {
  const { request, env } = context;
  if (!(await verifyToken(request, env))) return unauthorized();

  let body;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400, headers: jsonHeaders(),
    });
  }

  const existing = await env.LANDING_CONFIG.get(CONFIG_KEY, { type: "json" }) || {};

  // Start from existing, remove old field names
  const updated = { ...existing };
  delete updated.headerText;
  delete updated.footerText;
  delete updated.headerHtml;
  delete updated.footerHtml;
  delete updated.baseLinks;

  // Process known string keys
  for (const k of ALLOWED_STRING_KEYS) {
    if (k in (body || {})) {
      const v = body[k];
      if (v === null || v === "") {
        delete updated[k];
      } else if (typeof v === "string") {
        if (k === "customStyleCss" || k === "customScript") {
          updated[k] = v; // Remove character limit on global CSS/JS
        } else {
          updated[k] = v.slice(0, 5000);
        }
      }
    }
  }

  // Update cssVersion for cache busting when customStyleCss changes
  if ("customStyleCss" in (body || {})) {
    if (body.customStyleCss !== existing.customStyleCss) {
      updated.cssVersion = Date.now().toString();
    }
  }

  // Update jsVersion for cache busting when customScript changes
  if ("customScript" in (body || {})) {
    if (body.customScript !== existing.customScript) {
      updated.jsVersion = Date.now().toString();
    }
  }

  // themeCssUrl must be a valid http/https URL
  if (updated.themeCssUrl) {
    const cssUrlErr = validateUrl(updated.themeCssUrl);
    if (cssUrlErr || (!updated.themeCssUrl.startsWith("https://") && !updated.themeCssUrl.startsWith("http://"))) {
      return new Response(JSON.stringify({ error: "themeCssUrl must be a valid http/https URL." }), {
        status: 400, headers: jsonHeaders(),
      });
    }
  }

  try {
    if (env.LANDING_CONFIG) {
      await env.LANDING_CONFIG.put(CONFIG_KEY, JSON.stringify(updated));
    }
    return new Response(JSON.stringify({ ok: true, config: updated }), { headers: jsonHeaders() });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Failed to save config in KV." }), {
      status: 500, headers: jsonHeaders(),
    });
  }
}
