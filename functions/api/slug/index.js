import { verifyToken, unauthorized, validateSlug, jsonHeaders } from "../../_shared/auth.js";
import { validateAlias }  from "../../_shared/validators.js";
import { compileRoutes }  from "../../_shared/route-compiler.js";

/**
 * POST /api/slug
 *
 * Creates a new campaign slug — v6.
 * Schema: { slug, campaign (required), context, defaults, overrides, links,
 *           alias, customHeaderHtml, customFooterHtml, customStyleCss }
 *
 * alias — optional slug alias (written to CAMPAIGN_AB_ALIAS_INDEX as slug_alias:<alias> → slug)
 *         must be globally unique across all alias types
 *         after saving, run POST /api/admin/compile-routes to activate routing
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!verifyToken(request, env)) return unauthorized();

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400,
      headers: jsonHeaders(),
    });
  }

  const {
    slug, campaign, context: ctx, defaults, overrides, links,
    alias, engineMapId,
    customHeaderHtml, customFooterHtml, customStyleCss,
  } = body || {};

  /* ── Validate slug ───────────────────────────────────────── */
  const slugErr = validateSlug(slug);
  if (slugErr) {
    return new Response(JSON.stringify({ error: slugErr }), {
      status: 400,
      headers: jsonHeaders(),
    });
  }

  /* ── Validate campaign (required) ───────────────────────── */
  if (!campaign || typeof campaign !== "string" || !campaign.trim()) {
    return new Response(
      JSON.stringify({ error: "campaign is required and must be a non-empty string." }),
      { status: 400, headers: jsonHeaders() }
    );
  }
  const campaignExists = await env.CAMPAIGN_INDEX.get(campaign.trim());
  if (campaignExists === null) {
    return new Response(
      JSON.stringify({ error: `Campaign "${campaign}" does not exist. Create it first via POST /api/campaign.` }),
      { status: 400, headers: jsonHeaders() }
    );
  }

  /* ── Check slug uniqueness ───────────────────────────────── */
  const existing = await env.SLUG_LINKS.get(slug);
  if (existing !== null) {
    return new Response(
      JSON.stringify({ error: `Slug "${slug}" already exists. Use PUT to update it.` }),
      { status: 409, headers: jsonHeaders() }
    );
  }

  /* ── Parse + validate alias (optional) ───────────────────── */
  const rawAlias = (alias || "").trim().toLowerCase() || null;

  if (rawAlias !== null && !validateAlias(rawAlias)) {
    return new Response(
      JSON.stringify({ error: "Alias must use lowercase letters, numbers, and hyphens only (max 48 chars)." }),
      { status: 400, headers: jsonHeaders() }
    );
  }

  /* ── Check alias global uniqueness ──────────────────────── */
  if (rawAlias !== null && env.CAMPAIGN_AB_ALIAS_INDEX) {
    const [existingCampaignAlias, existingSlugAlias] = await Promise.all([
      env.CAMPAIGN_AB_ALIAS_INDEX.get(`alias:${rawAlias}`,      { type: "text" }).catch(() => null),
      env.CAMPAIGN_AB_ALIAS_INDEX.get(`slug_alias:${rawAlias}`, { type: "text" }).catch(() => null),
    ]);
    if (existingCampaignAlias !== null || existingSlugAlias !== null) {
      return new Response(
        JSON.stringify({ error: `Alias "${rawAlias}" is already in use. Choose a different alias.` }),
        { status: 409, headers: jsonHeaders() }
      );
    }
  }

  /* ── Validate URLs — blocking (no silent drop) ───────────── */
  const linksResult = sanitizeLinks(links || []);
  if (!linksResult.ok) {
    return new Response(
      JSON.stringify({ ok: false, error: linksResult.error, field: linksResult.field }),
      { status: 400, headers: jsonHeaders() }
    );
  }
  const overridesResult = sanitizeDestinations(overrides || {});
  if (!overridesResult.ok) {
    return new Response(
      JSON.stringify({ ok: false, error: overridesResult.error, field: overridesResult.field }),
      { status: 400, headers: jsonHeaders() }
    );
  }

  /* ── Build and store record ──────────────────────────────── */
  const now    = new Date().toISOString();
  const record = {
    slug,
    campaign:         campaign.trim(),
    alias:            rawAlias,
    context:          ctx || "campaign",
    defaults:         sanitizeUtm(defaults || {}),
    overrides:        overridesResult.data,
    links:            linksResult.data,
    engineMapId:      typeof engineMapId === "string" && engineMapId.trim() ? engineMapId.trim() : null,
    customHeaderHtml: sanitizeHtmlField(customHeaderHtml),
    customFooterHtml: sanitizeHtmlField(customFooterHtml),
    customStyleCss:   sanitizeCssField(customStyleCss),
    isActive:         true,
    createdAt:        now,
    updatedAt:        now,
  };

  try {
    await env.SLUG_LINKS.put(slug, JSON.stringify(record));
  } catch (e) {
    console.error("[api/slug POST] KV write error:", e?.message);
    return new Response(JSON.stringify({ error: "Failed to save slug." }), {
      status: 500,
      headers: jsonHeaders(),
    });
  }

  /* ── Write alias to CAMPAIGN_AB_ALIAS_INDEX (if provided) ─────────── */
  if (rawAlias !== null && env.CAMPAIGN_AB_ALIAS_INDEX) {
    try {
      await env.CAMPAIGN_AB_ALIAS_INDEX.put(`slug_alias:${rawAlias}`, slug);
    } catch (e) {
      console.error("[api/slug POST] CAMPAIGN_AB_ALIAS_INDEX write error:", e?.message);
      // Non-fatal: slug is created. Alias write failed — user must retry.
      return new Response(
        JSON.stringify({
          ok: true, slug: record,
          warning: `Slug created but alias "${rawAlias}" could not be saved. Retry or add manually.`,
        }),
        { status: 201, headers: jsonHeaders() }
      );
    }
  }

  // Synchronously compile routes on every slug creation (SECTION 3).
  // Using await (not waitUntil) so the route table is valid before the client
  // receives the 201 response — no stale routes on first hit.
  //
  // FAST-PATH: Directly update ROUTE_ALIAS for the new alias to bypass KV.list() 
  // latency in compileRoutes(). This ensures 0-second availability.
  if (env.ROUTE_ALIAS) {
    if (rawAlias !== null) {
      await env.ROUTE_ALIAS.put(`route:${rawAlias}`, slug)
        .catch(e => console.warn("[api/slug POST] Fast-path ROUTE_ALIAS write failed:", e?.message));
    }
    
    // Trigger full background compile to ensure overall consistency
    await compileRoutes(env, { dryRun: false, invalidateCache: true })
      .catch(e => console.warn("[api/slug POST] auto-compile failed:", e?.message));
  }

  return new Response(
    JSON.stringify({ ok: true, slug: record }),
    { status: 201, headers: jsonHeaders() }
  );
}

/* ── Helpers ─────────────────────────────────────────────────── */

/**
 * Normalize a URL string:
 *  - trim whitespace
 *  - if not starting with http(s)://, mailto:, or tel: → prepend https://
 * Returns empty string for invalid input.
 */
function normalizeUrl(str) {
  if (!str || typeof str !== "string") return "";
  const trimmed = str.trim();
  if (!trimmed) return "";
  if (
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:")
  ) {
    return trimmed;
  }
  return "https://" + trimmed;
}

/**
 * Strict URL validation (backend is authoritative).
 * Returns empty string if valid, or an error message string if invalid.
 *
 * For non-mailto / non-tel URLs, rejects:
 *  - hostname === "localhost"
 *  - IPv4 or IPv6 literals
 *  - private IP ranges (127/8, 10/8, 192.168/16, 172.16–31/12)
 *  - hostnames without a valid TLD (no dot, or trailing dot)
 */
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
    if (u.protocol !== "https:" && u.protocol !== "http:") return "Invalid URL format.";
    const h = u.hostname;
    if (!h) return "Invalid URL format.";
    // Reject localhost
    if (h === "localhost") return "Invalid URL format.";
    // Reject IPv6 literals (URL parser strips brackets; colons remain in hostname)
    if (h.includes(":")) return "Invalid URL format.";
    // Reject IPv4 literals (dotted-decimal) — covers all private ranges implicitly
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return "Invalid URL format.";
    // Reject private IP ranges (belt-and-suspenders per spec)
    // 127.0.0.0/8, 10.0.0.0/8, 192.168.0.0/16, 172.16.0.0/12
    const ipParts = h.split(".");
    if (ipParts.length === 4 && ipParts.every((p) => /^\d+$/.test(p))) {
      const [a, b] = ipParts.map(Number);
      if (a === 127 || a === 10) return "Invalid URL format.";
      if (a === 192 && b === 168) return "Invalid URL format.";
      if (a === 172 && b >= 16 && b <= 31) return "Invalid URL format.";
    }
    // Must have a valid TLD: must contain a dot and must not end with a dot
    if (!h.includes(".") || h.endsWith(".")) return "Invalid URL format.";
    return "";
  } catch {
    return "Invalid URL format.";
  }
}

/** utm_source and utm_medium only. utm_campaign lives in record.campaign. */
function sanitizeUtm(obj) {
  const allowed = ["utm_source", "utm_medium", "utm_term"];
  const out = {};
  for (const k of allowed) {
    if (obj[k] && typeof obj[k] === "string") out[k] = obj[k].slice(0, 200);
  }
  return out;
}

/**
 * Sanitize per-slug custom link list with URL normalization.
 *
 * Returns { ok: true, data: [...] } on success.
 * Returns { ok: false, error, field } if ANY provided URL fails validation.
 * Order is always recalculated as 100 + (index * 10) — never reuses input values.
 */
function sanitizeLinks(arr) {
  if (!Array.isArray(arr)) return { ok: true, data: [] };
  const out = [];
  for (const item of arr.slice(0, 20)) {
    if (!item || typeof item !== "object") continue;
    const id    = typeof item.id    === "string" ? item.id.slice(0, 50).replace(/[^a-zA-Z0-9_-]/g, "") : "";
    const label = typeof item.label === "string" ? item.label.slice(0, 100) : "";
    const rawHref = typeof item.href === "string" ? normalizeUrl(item.href) : "";
    const href  = rawHref.slice(0, 2000);
    if (!id || !label || !href) continue;
    const urlErr = validateUrl(href);
    if (urlErr) {
      return { ok: false, error: "Invalid URL format", field: "links[].href" };
    }
    out.push({
      id,
      label,
      href,
      utmContent: typeof item.utmContent === "string" ? item.utmContent.slice(0, 100) : id,
      noUtm:      !!item.noUtm,
      order:      100 + (out.length * 10),
      isActive:   item.isActive === false ? false : true,
    });
  }
  return { ok: true, data: out };
}

/**
 * Sanitize per-base-link overrides with URL normalization.
 * Accepts both formats (backward-compat):
 *   - old string:  { official: "https://..." }             → stored as { url: "https://..." }
 *   - new object:  { official: { url, isActive, noUtm, order } }
 *
 * Returns { ok: true, data: {...} } on success.
 * Returns { ok: false, error, field } if ANY provided URL fails validation.
 */
function sanitizeDestinations(obj) {
  const allowed = ["official", "programs", "release", "newsletter"];
  const out = {};
  for (const k of allowed) {
    const v = obj[k];
    if (v === undefined || v === null) continue;

    // Old string format → normalise to { url }
    if (typeof v === "string") {
      const normalized = normalizeUrl(v);
      if (!normalized) continue;
      const urlErr = validateUrl(normalized);
      if (urlErr) {
        return { ok: false, error: "Invalid URL format", field: `overrides.${k}` };
      }
      out[k] = { url: normalized.slice(0, 2000) };
      continue;
    }

    // New object format
    if (typeof v === "object") {
      const entry = {};
      if (v.url !== undefined) {
        const normalized = normalizeUrl(v.url);
        if (normalized) {
          const urlErr = validateUrl(normalized);
          if (urlErr) {
            return { ok: false, error: "Invalid URL format", field: `overrides.${k}.url` };
          }
          entry.url = normalized.slice(0, 2000);
        }
      }
      if (v.isActive !== undefined) entry.isActive = v.isActive === false ? false : true;
      if (v.noUtm    !== undefined) entry.noUtm    = !!v.noUtm;
      if (v.order    !== undefined && typeof v.order === "number") entry.order = Math.round(v.order);
      if (Object.keys(entry).length > 0) out[k] = entry;
    }
  }
  return { ok: true, data: out };
}

/** Sanitize optional HTML field (header/footer) */
function sanitizeHtmlField(val) {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val !== "string") return null;
  return val.slice(0, 5000);
}

/** Sanitize optional CSS field */
function sanitizeCssField(val) {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val !== "string") return null;
  return val.slice(0, 10000);
}
