import { verifyToken, unauthorized, jsonHeaders } from "../_shared/auth.js";

const CONFIG_KEY = "hub_config";

const ALLOWED_STRING_KEYS = ["themeCssUrl", "headerHtml", "footerHtml", "customStyleCss", "pageTitle"];

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
  if (!verifyToken(request, env)) return unauthorized();

  let cfg = {};
  if (env.LANDING_CONFIG) {
    try {
      cfg = await env.LANDING_CONFIG.get(CONFIG_KEY, { type: "json" }) || {};
    } catch (_) {}
  }

  // Backward-compat: migrate old field names for response
  const out = { ...cfg };
  if (!out.headerHtml && out.headerText) { out.headerHtml = out.headerText; }
  if (!out.footerHtml && out.footerText) { out.footerHtml = out.footerText; }
  // Clean old names from response
  delete out.headerText;
  delete out.footerText;

  return new Response(JSON.stringify({ config: out }), { headers: jsonHeaders() });
}

/* ── PUT /api/config ──────────────────────────────────────────────── */
export async function onRequestPut(context) {
  const { request, env } = context;
  if (!verifyToken(request, env)) return unauthorized();

  let body;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400, headers: jsonHeaders(),
    });
  }

  let existing = {};
  if (env.LANDING_CONFIG) {
    try {
      existing = await env.LANDING_CONFIG.get(CONFIG_KEY, { type: "json" }) || {};
    } catch (_) {}
  }

  // Start from existing, remove old field names
  const updated = { ...existing };
  delete updated.headerText;
  delete updated.footerText;

  // Process known string keys
  for (const k of ALLOWED_STRING_KEYS) {
    if (k in (body || {})) {
      const v = body[k];
      if (v === null || v === "") {
        delete updated[k];
      } else if (typeof v === "string") {
        updated[k] = v.slice(0, 5000);
      }
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

  // Process baseLinks array
  if ("baseLinks" in (body || {})) {
    const bl = body.baseLinks;
    if (bl === null || !Array.isArray(bl)) {
      delete updated.baseLinks;
    } else {
      const sanitized = [];
      for (const entry of bl) {
        if (!entry || typeof entry !== "object") continue;
        const out = {};
        
        // Label is required for an item to be valid
        const label = (typeof entry.label === "string" ? entry.label.trim() : "").slice(0, 200);
        if (!label) continue;
        out.label = label;

        // URL is optional (empty URL means plain text)
        if (typeof entry.url === "string" && entry.url.trim()) {
          const normalized = normalizeUrl(entry.url);
          const urlErr = validateUrl(normalized);
          if (!urlErr) {
            out.url = normalized.slice(0, 2000);
          }
        }

        // Preserve ID if present (helps with React-like key matching or overrides)
        if (typeof entry.id === "string") out.id = entry.id.slice(0, 50);
        
        sanitized.push(out);
      }
      if (sanitized.length > 0) {
        updated.baseLinks = sanitized;
      } else {
        delete updated.baseLinks;
      }
    }
  }

  try {
    if (env.LANDING_CONFIG) {
      await env.LANDING_CONFIG.put(CONFIG_KEY, JSON.stringify(updated));
    }
    return new Response(JSON.stringify({ ok: true, config: updated }), { headers: jsonHeaders() });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Failed to save config." }), {
      status: 500, headers: jsonHeaders(),
    });
  }
}
