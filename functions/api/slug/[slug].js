import { verifyToken, unauthorized, validateSlug, jsonHeaders } from "../../_shared/auth.js";
import { validateAlias }  from "../../_shared/validators.js";
import { compileRoutes }  from "../../_shared/route-compiler.js";

/* ── GET /api/slug/:slug ────────────────────────────────────────── */
export async function onRequestGet(context) {
  const { request, env, params } = context;
  if (!verifyToken(request, env)) return unauthorized();
  const slug = params.slug || "";
  const slugErr = validateSlug(slug);
  if (slugErr) return new Response(JSON.stringify({ error: slugErr }), { status: 400, headers: jsonHeaders() });
  const record = await env.SLUG_LINKS.get(slug, { type: "json" });
  if (!record) return new Response(JSON.stringify({ error: `Slug "${slug}" not found.` }), { status: 404, headers: jsonHeaders() });
  return new Response(JSON.stringify(record), { headers: jsonHeaders() });
}

/* ── PUT /api/slug/:slug ────────────────────────────────────────── */
export async function onRequestPut(context) {
  const { request, env, params } = context;
  if (!verifyToken(request, env)) return unauthorized();
  const slug = params.slug || "";
  const slugErr = validateSlug(slug);
  if (slugErr) return new Response(JSON.stringify({ error: slugErr }), { status: 400, headers: jsonHeaders() });

  let body;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), { status: 400, headers: jsonHeaders() });
  }

  const existing = await env.SLUG_LINKS.get(slug, { type: "json" });
  if (!existing) return new Response(
    JSON.stringify({ error: `Slug "${slug}" not found. Use POST to create it.` }),
    { status: 404, headers: jsonHeaders() }
  );

  const {
    campaign, context: ctx, defaults, overrides, links,
    alias, engineMapId,
    customHeaderHtml, customFooterHtml, customStyleCss,
  } = body || {};

  /* ── Parse + validate alias if provided ─────────────────── */
  // Treat undefined (not in body) as "no change"; null or "" clears the alias.
  const aliasInBody = "alias" in (body || {});
  const rawAlias    = aliasInBody
    ? ((alias || "").trim().toLowerCase() || null)
    : undefined; // undefined = no change

  if (rawAlias !== undefined && rawAlias !== null && !validateAlias(rawAlias)) {
    return new Response(
      JSON.stringify({ error: "Alias must use lowercase letters, numbers, and hyphens only (max 48 chars)." }),
      { status: 400, headers: jsonHeaders() }
    );
  }

  /* ── Check alias global uniqueness (skip if unchanged) ──── */
  if (rawAlias !== undefined && rawAlias !== null && rawAlias !== existing.alias && env.CAMPAIGN_AB_ALIAS_INDEX) {
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

  /* ── Validate campaign if provided ──────────────────────── */
  let resolvedCampaign = existing.campaign;
  if (campaign !== undefined) {
    if (!campaign || typeof campaign !== "string" || !campaign.trim()) {
      return new Response(
        JSON.stringify({ error: "campaign must be a non-empty string." }),
        { status: 400, headers: jsonHeaders() }
      );
    }
    const campaignExists = await env.CAMPAIGN_INDEX.get(campaign.trim());
    if (campaignExists === null) {
      return new Response(
        JSON.stringify({ error: `Campaign "${campaign}" does not exist.` }),
        { status: 400, headers: jsonHeaders() }
      );
    }
    resolvedCampaign = campaign.trim();
  }

  /* ── Validate URLs — blocking (no silent drop) ───────────── */
  const linksResult = sanitizeLinks(links ?? existing.links ?? []);
  if (!linksResult.ok) {
    return new Response(
      JSON.stringify({ ok: false, error: linksResult.error, field: linksResult.field }),
      { status: 400, headers: jsonHeaders() }
    );
  }
  const overridesResult = sanitizeDestinations(overrides ?? existing.overrides ?? {});
  if (!overridesResult.ok) {
    return new Response(
      JSON.stringify({ ok: false, error: overridesResult.error, field: overridesResult.field }),
      { status: 400, headers: jsonHeaders() }
    );
  }

  const updated = {
    ...existing,
    campaign:         resolvedCampaign,
    alias:            rawAlias !== undefined ? rawAlias : (existing.alias ?? null),
    context:          ctx ?? existing.context,
    defaults:         sanitizeUtm(defaults  ?? existing.defaults  ?? {}),
    overrides:        overridesResult.data,
    links:            linksResult.data,
    engineMapId:      "engineMapId" in (body || {}) ? (typeof engineMapId === "string" && engineMapId.trim() ? engineMapId.trim() : null) : (existing.engineMapId ?? null),
    customHeaderHtml: "customHeaderHtml" in (body || {}) ? sanitizeHtmlField(customHeaderHtml) : (existing.customHeaderHtml ?? null),
    customFooterHtml: "customFooterHtml" in (body || {}) ? sanitizeHtmlField(customFooterHtml) : (existing.customFooterHtml ?? null),
    customStyleCss:   "customStyleCss"   in (body || {}) ? sanitizeCssField(customStyleCss)    : (existing.customStyleCss   ?? null),
    updatedAt:        new Date().toISOString(),
  };
  // Never carry forward a stale destinations field
  delete updated.destinations;

  try {
    await env.SLUG_LINKS.put(slug, JSON.stringify(updated));
  } catch (e) {
    return new Response(JSON.stringify({ error: "Failed to update slug." }), { status: 500, headers: jsonHeaders() });
  }

  /* ── Manage alias transitions in CAMPAIGN_AB_ALIAS_INDEX ──────────── */
  let aliasNote;
  if (rawAlias !== undefined && env.CAMPAIGN_AB_ALIAS_INDEX) {
    const oldAlias = existing.alias || null;
    // Delete old alias entry if alias changed
    if (oldAlias && oldAlias !== rawAlias) {
      await env.CAMPAIGN_AB_ALIAS_INDEX.delete(`slug_alias:${oldAlias}`).catch(() => {});
    }
    // Write new alias entry if alias set and changed
    if (rawAlias && rawAlias !== oldAlias) {
      try {
        await env.CAMPAIGN_AB_ALIAS_INDEX.put(`slug_alias:${rawAlias}`, slug);
        aliasNote = "Alias saved. Run POST /api/admin/compile-routes to activate routing.";
      } catch (e) {
        console.error("[api/slug PUT] CAMPAIGN_AB_ALIAS_INDEX write error:", e?.message);
        return new Response(
          JSON.stringify({ ok: true, slug: updated, warning: `Slug updated but alias "${rawAlias}" could not be saved. Retry or add manually.` }),
          { headers: jsonHeaders() }
        );
      }
    }
    // Clear alias: remove entry from CAMPAIGN_AB_ALIAS_INDEX if alias explicitly cleared
    if (rawAlias === null && oldAlias) {
      await env.CAMPAIGN_AB_ALIAS_INDEX.delete(`slug_alias:${oldAlias}`).catch(() => {});
      aliasNote = "Alias removed. Run POST /api/admin/compile-routes to update routing.";
    }
  }

  // Synchronously compile routes on every slug creation (SECTION 3).
  // Using await (not waitUntil) so the route table is valid before the client
  // receives the 201 response — no stale routes on first hit.
  //
  // FAST-PATH: Directly update ROUTE_ALIAS for the new alias to bypass KV.list() 
  // latency in compileRoutes(). This ensures 0-second availability.
  if (rawAlias !== undefined && env.ROUTE_ALIAS) {
    const oldAlias = existing.alias || null;
    
    // Fast-path: delete old route entry if alias changed or was cleared
    if (oldAlias && oldAlias !== rawAlias) {
      await env.ROUTE_ALIAS.delete(`route:${oldAlias}`).catch(() => {});
    }
    
    // Fast-path: write new route entry if alias set and changed
    if (rawAlias && rawAlias !== oldAlias) {
      await env.ROUTE_ALIAS.put(`route:${rawAlias}`, slug).catch(() => {});
    }

    // Trigger full background compile to ensure overall consistency
    context.waitUntil(
      compileRoutes(env, { dryRun: false, invalidateCache: true })
        .catch(e => console.warn("[api/slug PUT] auto-compile failed:", e?.message))
    );
  }

  return new Response(
    JSON.stringify({ ok: true, slug: updated }),
    { headers: jsonHeaders() }
  );
}

/* ── PATCH /api/slug/:slug ──────────────────────────────────────── */
export async function onRequestPatch(context) {
  const { request, env, params } = context;
  if (!verifyToken(request, env)) return unauthorized();
  const slug = params.slug || "";
  const slugErr = validateSlug(slug);
  if (slugErr) return new Response(JSON.stringify({ error: slugErr }), { status: 400, headers: jsonHeaders() });

  let body;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), { status: 400, headers: jsonHeaders() });
  }

  if (typeof body?.isActive !== "boolean") {
    return new Response(JSON.stringify({ error: "isActive must be a boolean." }), { status: 400, headers: jsonHeaders() });
  }

  const existing = await env.SLUG_LINKS.get(slug, { type: "json" });
  if (!existing) return new Response(JSON.stringify({ error: `Slug "${slug}" not found.` }), { status: 404, headers: jsonHeaders() });

  const updated = { ...existing, isActive: body.isActive, updatedAt: new Date().toISOString() };

  try {
    await env.SLUG_LINKS.put(slug, JSON.stringify(updated));
    return new Response(JSON.stringify({ ok: true, slug: updated }), { headers: jsonHeaders() });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Failed to update slug." }), { status: 500, headers: jsonHeaders() });
  }
}

/* ── DELETE /api/slug/:slug ─────────────────────────────────────── */
export async function onRequestDelete(context) {
  const { request, env, params } = context;
  if (!verifyToken(request, env)) return unauthorized();

  const slug = params.slug || "";
  const slugErr = validateSlug(slug);
  if (slugErr) {
    return new Response(JSON.stringify({ error: slugErr }), { status: 400, headers: jsonHeaders() });
  }

  const record = await env.SLUG_LINKS.get(slug, { type: "json" });
  if (!record) {
    return new Response(JSON.stringify({ error: `Slug "${slug}" not found.` }), { status: 404, headers: jsonHeaders() });
  }

  const GRACE_WINDOW_MS = 5 * 60 * 1000;

  if (!record.createdAt) {
    return new Response(JSON.stringify({
      error: "Grace window expired."
    }), { status: 403, headers: jsonHeaders() });
  }

  const created = new Date(record.createdAt).getTime();
  if (isNaN(created) || Date.now() - created > GRACE_WINDOW_MS) {
    return new Response(JSON.stringify({
      error: "Grace window expired."
    }), { status: 403, headers: jsonHeaders() });
  }

  await env.SLUG_LINKS.delete(slug);

  // Synchronously clean up routing on delete (PART 1)
  if (env.ROUTE_ALIAS) {
    // Fast-path delete
    if (record.alias) {
      await env.ROUTE_ALIAS.delete(`route:${record.alias}`).catch(() => {});
    }
    
    // Trigger background re-compile
    context.waitUntil(
      compileRoutes(env, { dryRun: false, invalidateCache: true })
        .catch(e => console.warn("[api/slug DELETE] auto-compile failed:", e?.message))
    );
  }

  return new Response(JSON.stringify({ ok: true, deleted: slug }), { headers: jsonHeaders() });
}

/* ── Helpers ──────────────────────────────────────────────────────── */

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

/**
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

/** utm_source, utm_medium, utm_id, cid, etc. utm_campaign often lives in record.campaign but can be in defaults. */
function sanitizeUtm(obj) {
  const allowed = [
    "utm_source", "utm_medium", "utm_campaign", "utm_id", "utm_term", "utm_content",
    "cid", "lang", "market", "cos_win"
  ];
  const out = {};
  for (const k of allowed) {
    if (obj[k] && typeof obj[k] === "string") out[k] = obj[k].slice(0, 200);
  }
  return out;
}

/**
 * Sanitize per-base-link overrides with URL normalization.
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

function sanitizeHtmlField(val) {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val !== "string") return null;
  return val.slice(0, 5000);
}

function sanitizeCssField(val) {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val !== "string") return null;
  return val.slice(0, 10000);
}
