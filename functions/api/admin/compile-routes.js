/**
 * GET  /api/admin/compile-routes — Router status (aliases, routes, last compile)
 * POST /api/admin/compile-routes — Force-rebuild ROUTE_ALIAS from truth sources
 *
 * Authentication: Bearer <ADMIN_TOKEN>
 *
 * GET response 200:
 *   {
 *     "ok": true,
 *     "aliases": 12,              // current count of entries in CAMPAIGN_AB_ALIAS_INDEX
 *     "routes":  12,              // current count of route:* entries in ROUTE_ALIAS
 *     "active":  true,            // routes > 0
 *     "lastCompile": "ISO"        // timestamp of last successful compile (or null)
 *   }
 *
 * POST request body (optional JSON):
 *   { "dryRun": true }   — validate and count routes without writing
 *
 * POST response 200:
 *   {
 *     "ok": true,
 *     "written": 42,
 *     "compiled": 42,
 *     "skipped": [...],
 *     "errors": [],
 *     "dry_run": false,
 *     "duration_ms": 310
 *   }
 *
 * POST response 422 (validation errors):
 *   { "ok": false, "errors": ["..."], ... }
 *
 * After a successful POST compile, last compile metadata is persisted to
 * LANDING_CONFIG["_last_compile"] for the GET endpoint to read.
 *
 * Idempotent: safe to run multiple times. Each run overwrites existing
 * ROUTE_ALIAS entries deterministically from truth sources.
 */

import { verifyToken, unauthorized, jsonHeaders } from "../../_shared/auth.js";
import { compileRoutes }                          from "../../_shared/route-compiler.js";

// ── GET: router status ────────────────────────────────────────────────────────

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await verifyToken(request, env))) return unauthorized();

  // Read last compile metadata
  let lastMeta = null;
  try {
    if (env.LANDING_CONFIG) {
      lastMeta = await env.LANDING_CONFIG.get("_last_compile", { type: "json" });
    }
  } catch (_) {}

  // Count current CAMPAIGN_AB_ALIAS_INDEX entries
  let aliasCount = -1;
  try {
    if (env.CAMPAIGN_AB_ALIAS_INDEX) {
      let count = 0, cursor;
      do {
        const opts = { limit: 1000 };
        if (cursor) opts.cursor = cursor;
        const page = await env.CAMPAIGN_AB_ALIAS_INDEX.list(opts);
        count += page.keys.length;
        cursor = page.list_complete ? undefined : page.cursor;
      } while (cursor);
      aliasCount = count;
    }
  } catch (_) {}

  // Count current ROUTE_ALIAS route:* entries
  let routeCount = -1;
  try {
    if (env.ROUTE_ALIAS) {
      let count = 0, cursor;
      do {
        const opts = { prefix: "route:", limit: 1000 };
        if (cursor) opts.cursor = cursor;
        const page = await env.ROUTE_ALIAS.list(opts);
        count += page.keys.length;
        cursor = page.list_complete ? undefined : page.cursor;
      } while (cursor);
      routeCount = count;
    }
  } catch (_) {}

  return new Response(
    JSON.stringify({
      ok:          true,
      aliases:     aliasCount,
      routes:      routeCount,
      active:      routeCount > 0,
      lastCompile: lastMeta?.timestamp ?? null,
    }),
    { status: 200, headers: jsonHeaders() }
  );
}

// ── POST: force compile ───────────────────────────────────────────────────────

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!(await verifyToken(request, env))) return unauthorized();

  // Optional dryRun flag in request body
  let dryRun = false;
  try {
    const body = await request.json();
    if (body?.dryRun === true) dryRun = true;
  } catch (_) {
    // Empty body or non-JSON body is fine — defaults apply
  }

  const result = await compileRoutes(env, { dryRun, invalidateCache: true });

  // Persist last compile metadata for GET status endpoint (PART 7)
  if (!dryRun && result.ok && env.LANDING_CONFIG) {
    try {
      await env.LANDING_CONFIG.put("_last_compile", JSON.stringify({
        timestamp: new Date().toISOString(),
        routes:    result.written,
        aliases:   (result.stats?.campaign_aliases ?? 0) + (result.stats?.slug_aliases ?? 0),
      }));
    } catch (_) {}
  }

  return new Response(
    JSON.stringify({ ...result, dry_run: dryRun }),
    {
      status:  result.ok ? 200 : 422,
      headers: jsonHeaders(),
    }
  );
}
