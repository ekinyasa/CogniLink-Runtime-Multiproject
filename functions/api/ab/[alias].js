/**
 * functions/api/ab/[alias].js — A/B routing config management API.
 *
 * GET    /api/ab/:alias  → return current A/B config (404 if none set)
 * PUT    /api/ab/:alias  → create or replace A/B config
 * DELETE /api/ab/:alias  → remove A/B config
 *
 * All endpoints require: Authorization: Bearer <ADMIN_TOKEN>
 *
 * Config storage: AB_INDEX["ab_config:<alias>"]
 *
 * PUT body (JSON):
 *   {
 *     "variants": [
 *       { "slug": "launch-youtube", "weight": 50 },
 *       { "slug": "launch-ig",      "weight": 50 }
 *     ]
 *   }
 *
 * Validation (enforced by validateABConfig):
 *   • variants: array, 2–10 elements
 *   • slug: /^[a-z0-9-]{1,200}$/
 *   • weight: integer >= 1
 *   • sum of weights must equal 100
 *
 * After a successful PUT or DELETE, the in-memory kv-cache entry for
 * this alias is invalidated so the next request reads the updated config.
 */

import { validateABConfig } from "../../_shared/ab-router.js";
import { validateAlias }    from "../../_shared/validators.js";
import { cacheDelete }      from "../../_shared/kv-cache.js";
import { compileRoutes }    from "../../_shared/route-compiler.js";
import { deriveCampaignFromSlug } from "../../_shared/slug-utils.js";

const JSON_HEADERS = {
  "Content-Type":           "application/json;charset=UTF-8",
  "Cache-Control":          "no-store",
  "X-Content-Type-Options": "nosniff",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function verifyAdmin(request, env) {
  if (!env.ADMIN_TOKEN) return false;
  const auth = (request.headers.get("Authorization") || "").trim();
  return auth.startsWith("Bearer ") && auth.slice(7) === env.ADMIN_TOKEN;
}

/** kv-cache key for this alias (must match AB_CACHE_PREFIX in ab-router.js). */
function abCacheKey(alias) {
  return `ab_cfg:${alias}`;
}

// ── GET /api/ab/:alias ─────────────────────────────────────────────────────────

export async function onRequestGet(context) {
  const { request, env, params } = context;

  if (!verifyAdmin(request, env)) return json({ error: "unauthorized" }, 401);

  const alias = (params.alias || "").toLowerCase().trim();
  if (!validateAlias(alias)) return json({ error: "invalid_alias" }, 400);

  if (!env.AB_INDEX) return json({ error: "CAMPAIGN_REGISTRY_not_bound" }, 503);

  let config = null;
  try {
    config = await env.AB_INDEX.get(`ab_config:${alias}`, { type: "json" });
  } catch (e) {
    return json({ error: "kv_read_error", detail: e?.message }, 500);
  }

  if (!config) return json({ error: "not_found" }, 404);

  return json({ alias, config });
}

// ── PUT /api/ab/:alias ─────────────────────────────────────────────────────────

export async function onRequestPut(context) {
  const { request, env, params } = context;

  if (!verifyAdmin(request, env)) return json({ error: "unauthorized" }, 401);

  const alias = (params.alias || "").toLowerCase().trim();
  if (!validateAlias(alias)) return json({ error: "invalid_alias" }, 400);

  if (!env.AB_INDEX) return json({ error: "CAMPAIGN_REGISTRY_not_bound" }, 503);

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: "invalid_json" }, 400);
  }

  const check = validateABConfig(body);
  if (!check.ok) return json({ error: "validation_failed", reason: check.reason }, 422);

  const config = {
    variants:  body.variants,
    updatedAt: new Date().toISOString(),
  };

  try {
    await env.AB_INDEX.put(`ab_config:${alias}`, JSON.stringify(config));
  } catch (e) {
    return json({ error: "kv_write_error", detail: e?.message }, 500);
  }

  // Invalidate in-memory cache so the next routing request reads the new config
  cacheDelete(abCacheKey(alias));

  // FAST-PATH: Ensure the alias is registered in the routing table (Prompt 130)
  // If it's a new alias (not in registry yet), auto-register it as a slug-alias
  // pointing to the first variant as the "base".
  if (env.CAMPAIGN_AB_ALIAS_INDEX) {
    const existing = await env.CAMPAIGN_AB_ALIAS_INDEX.get(`slug_alias:${alias}`).catch(() => null);
    const existingCamp = await env.CAMPAIGN_AB_ALIAS_INDEX.get(`alias:${alias}`).catch(() => null);
    
    if (!existing && !existingCamp) {
       // Register as a slug_alias pointing to variant 0 slug
       await env.CAMPAIGN_AB_ALIAS_INDEX.put(`slug_alias:${alias}`, body.variants[0].slug).catch(() => {});
    }
  }

  // Fast-path write to ROUTE_ALIAS for 0-second availability
  if (env.ROUTE_ALIAS) {
    await env.ROUTE_ALIAS.put(`route:${alias}`, body.variants[0].slug).catch(() => {});
  }

  // Trigger background re-compile to ensure overall consistency
  context.waitUntil(
    compileRoutes(env, { dryRun: false, invalidateCache: true })
      .catch(e => console.warn("[api/ab PUT] auto-compile failed:", e?.message))
  );

  return json({ ok: true, alias, config });
}

// ── DELETE /api/ab/:alias ──────────────────────────────────────────────────────

export async function onRequestDelete(context) {
  const { request, env, params } = context;

  if (!verifyAdmin(request, env)) return json({ error: "unauthorized" }, 401);

  const alias = (params.alias || "").toLowerCase().trim();
  if (!validateAlias(alias)) return json({ error: "invalid_alias" }, 400);

  if (!env.AB_INDEX) return json({ error: "CAMPAIGN_REGISTRY_not_bound" }, 503);

  try {
    await env.AB_INDEX.delete(`ab_config:${alias}`);
  } catch (e) {
    return json({ error: "kv_delete_error", detail: e?.message }, 500);
  }

  // Invalidate in-memory cache so the routing layer sees the deletion immediately
  cacheDelete(abCacheKey(alias));

  // Trigger background re-compile to update ROUTE_ALIAS
  if (env.ROUTE_ALIAS) {
    context.waitUntil(
      compileRoutes(env, { dryRun: false, invalidateCache: true })
        .catch(e => console.warn("[api/ab DELETE] auto-compile failed:", e?.message))
    );
  }

  return json({ ok: true, alias, deleted: true });
}
