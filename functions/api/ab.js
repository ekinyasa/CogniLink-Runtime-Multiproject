/**
 * functions/api/ab.js — A/B routing config management (flat query-param API).
 *
 * GET    /api/ab?alias=<alias>  → return current config or 404
 * PUT    /api/ab                → create/replace config (body: {alias, variants})
 * DELETE /api/ab?alias=<alias>  → remove config
 *
 * All endpoints require: Authorization: Bearer <ADMIN_TOKEN>
 *
 * Stricter validation vs. the legacy path-param api/ab/[alias].js:
 *   • alias must exist in CAMPAIGN_AB_ALIAS_INDEX
 *   • each variant slug must exist in SLUG_LINKS
 *
 * KV key: AB_INDEX["ab_config:<alias>"]
 *
 * GET 200 response:
 *   { alias, variants: [{slug, weight}, …], updatedAt }
 *
 * GET 404 response:
 *   { error: "no_ab_config" }
 *
 * PUT body:
 *   { alias, variants: [{slug, weight}, …] }
 *
 * PUT validation errors (422):
 *   alias_not_found / slug_not_found / validation_failed
 */

import { verifyToken, unauthorized }    from "../_shared/auth.js";
import { validateABConfig }             from "../_shared/ab-router.js";
import { validateAlias }                from "../_shared/validators.js";
import { cacheDelete }                  from "../_shared/kv-cache.js";
import { compileRoutes }                from "../_shared/route-compiler.js";
import { NUM_SHARDS }                   from "../_shared/exp-counter.js";

const AB_CACHE_PREFIX = "ab_cfg:";

const JSON_HEADERS = {
  "Content-Type":           "application/json;charset=UTF-8",
  "Cache-Control":          "no-store",
  "X-Content-Type-Options": "nosniff",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

// ── GET /api/ab?alias=<alias> ─────────────────────────────────────────────────

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await verifyToken(request, env))) return unauthorized();

  const url   = new URL(request.url);
  const alias = (url.searchParams.get("alias") || "").toLowerCase().trim();

  if (!alias || !validateAlias(alias)) return json({ error: "invalid_alias" }, 400);
  if (!env.AB_INDEX) return json({ error: "CAMPAIGN_REGISTRY_not_bound" }, 503);

  let config = null;
  try {
    config = await env.AB_INDEX.get(`ab_config:${alias}`, { type: "json" });
  } catch (e) {
    return json({ error: "kv_read_error", detail: e?.message }, 500);
  }

  if (!config) return json({ error: "no_ab_config" }, 404);

  return json({ alias, variants: config.variants, updatedAt: config.updatedAt });
}

// ── PUT /api/ab ───────────────────────────────────────────────────────────────

export async function onRequestPut(context) {
  const { request, env } = context;
  if (!(await verifyToken(request, env))) return unauthorized();

  if (!env.CAMPAIGN_AB_ALIAS_INDEX)    return json({ error: "ALIAS_REGISTRY_not_bound" },    503);
  if (!env.AB_INDEX) return json({ error: "CAMPAIGN_REGISTRY_not_bound" }, 503);

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: "invalid_json" }, 400);
  }

  const alias = typeof body.alias === "string" ? body.alias.toLowerCase().trim() : "";
  if (!alias || !validateAlias(alias)) return json({ error: "invalid_alias" }, 400);

  // Ensure alias exists in registry (Phase 1: campaign or slug alias)
  let aliasExists = false;
  try {
    const [asCamp, asSlug] = await Promise.all([
      env.CAMPAIGN_AB_ALIAS_INDEX.get(`alias:${alias}`,      { type: "text" }).catch(() => null),
      env.CAMPAIGN_AB_ALIAS_INDEX.get(`slug_alias:${alias}`, { type: "text" }).catch(() => null),
    ]);
    aliasExists = (asCamp !== null || asSlug !== null);
  } catch (_) {}

  if (!aliasExists) {
    const campaign = typeof body.campaign === "string" ? body.campaign.trim() : "";
    // If not found and no campaign hint, auto-register as slug_alias pointing to variant 0
    try {
      if (campaign) {
        await env.CAMPAIGN_AB_ALIAS_INDEX.put(`alias:${alias}`, campaign);
      } else {
        await env.CAMPAIGN_AB_ALIAS_INDEX.put(`slug_alias:${alias}`, body.variants[0].slug);
      }
    } catch (e) {
      return json({ error: "alias_create_failed", detail: e?.message }, 500);
    }
  }

  // Validate A/B config structure: variant count, slug format, weight sum
  const check = validateABConfig(body);
  if (!check.ok) return json({ error: "validation_failed", reason: check.reason }, 422);

  // Validate each variant slug exists in SLUG_LINKS
  if (env.SLUG_LINKS) {
    for (const v of body.variants) {
      let exists = false;
      try {
        exists = (await env.SLUG_LINKS.get(v.slug, { type: "json" })) !== null;
      } catch (_) {}
      if (!exists) return json({ error: "slug_not_found", slug: v.slug }, 422);
    }
  }

  // Preserve created_at on update; stamp it on first creation
  let existingConfig = null;
  try {
    existingConfig = await env.AB_INDEX.get(`ab_config:${alias}`, { type: "json" });
  } catch (_) {}

  const now = Math.floor(Date.now() / 1000);
  const config = {
    variants:    body.variants,
    // Lifecycle state:
    //   New experiments start as DRAFT — they receive no live traffic until
    //   explicitly activated via POST /api/experiment/activate (DRAFT → RUNNING).
    //   Existing experiments preserve their current state on update so a
    //   RUNNING experiment is not accidentally reset to DRAFT.
    //   Old records without a state field default to "RUNNING" via getExpState()
    //   at read time; persisting "RUNNING" here makes that explicit on next write.
    state:       existingConfig ? (existingConfig.state ?? "RUNNING") : "DRAFT",
    // status: simplified two-state lifecycle (open / decided).
    // Preserved on update so a decided experiment is not accidentally re-opened.
    status:      existingConfig?.status      ?? "open",
    shard_count: existingConfig?.shard_count ?? NUM_SHARDS,
    created_at:  existingConfig?.created_at  ?? now,
    updatedAt:   new Date().toISOString(),
    // Epsilon-greedy / strategy fields (Prompt 67 S5 — optional, ignored by routing).
    // Preserved across updates so existing values are not silently dropped.
    ...(body.epsilon  != null ? { epsilon:  body.epsilon  }
        : existingConfig?.epsilon  != null ? { epsilon:  existingConfig.epsilon  } : {}),
    ...(body.strategy != null ? { strategy: body.strategy }
        : existingConfig?.strategy != null ? { strategy: existingConfig.strategy } : {}),
  };

  try {
    await env.AB_INDEX.put(`ab_config:${alias}`, JSON.stringify(config));
  } catch (e) {
    return json({ error: "kv_write_error", detail: e?.message }, 500);
  }

  // Invalidate in-memory cache so next routing request reads the new config
  cacheDelete(`${AB_CACHE_PREFIX}${alias}`);

  // Fast-path write to ROUTE_ALIAS for 0-second availability (Prompt 130)
  if (env.ROUTE_ALIAS) {
    await env.ROUTE_ALIAS.put(`route:${alias}`, body.variants[0].slug).catch(() => {});
  }

  // Trigger background re-compile to ensure overall consistency
  context.waitUntil(
    compileRoutes(env, { dryRun: false, invalidateCache: true })
      .catch(e => console.warn("[api/ab PUT] auto-compile failed:", e?.message))
  );

  return json({ ok: true, alias, variants: config.variants, updatedAt: config.updatedAt });
}

// ── DELETE /api/ab?alias=<alias> ─────────────────────────────────────────────

export async function onRequestDelete(context) {
  const { request, env } = context;
  if (!(await verifyToken(request, env))) return unauthorized();

  const url   = new URL(request.url);
  const alias = (url.searchParams.get("alias") || "").toLowerCase().trim();

  if (!alias || !validateAlias(alias)) return json({ error: "invalid_alias" }, 400);
  if (!env.AB_INDEX) return json({ error: "CAMPAIGN_REGISTRY_not_bound" }, 503);

  try {
    await env.AB_INDEX.delete(`ab_config:${alias}`);
  } catch (e) {
    return json({ error: "kv_delete_error", detail: e?.message }, 500);
  }

  // Invalidate in-memory cache so routing layer sees the deletion immediately
  cacheDelete(`${AB_CACHE_PREFIX}${alias}`);

  // Trigger background re-compile to update ROUTE_ALIAS
  if (env.ROUTE_ALIAS) {
    context.waitUntil(
      compileRoutes(env, { dryRun: false, invalidateCache: true })
        .catch(e => console.warn("[api/ab DELETE] auto-compile failed:", e?.message))
    );
  }

  return json({ ok: true, alias, deleted: true });
}
