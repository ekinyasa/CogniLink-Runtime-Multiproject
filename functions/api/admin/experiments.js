/**
 * GET /api/admin/experiments
 *
 * Lists all A/B experiment configs from AB_INDEX (ab_config:* keys).
 * Returns basic info needed to populate the Experiments dashboard selector
 * and the create-experiment campaign dropdown.
 *
 * Authentication: Bearer <ADMIN_TOKEN>
 *
 * Response 200:
 *   {
 *     experiments: [
 *       { alias, state, variants: [{ slug, weight }] }
 *     ]
 *   }   // sorted alphabetically by alias
 *
 * Prompt 67 — Section 1
 */

import { verifyToken, unauthorized, jsonHeaders } from "../../_shared/auth.js";
import { getExpState }                            from "../../_shared/ab-router.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await verifyToken(request, env))) return unauthorized();

  const experiments = [];

  if (env.AB_INDEX) {
    try {
      // 1. Paginate all ab_config:* key names
      const keys = [];
      let cursor;
      do {
        const opts = { prefix: "ab_config:", limit: 1000 };
        if (cursor) opts.cursor = cursor;
        const page = await env.AB_INDEX.list(opts);
        for (const key of page.keys) keys.push(key.name);
        cursor = page.list_complete ? undefined : page.cursor;
      } while (cursor);

      // 2. Fetch configs in parallel (batches of 25 to respect KV concurrency)
      const BATCH = 25;
      for (let i = 0; i < keys.length; i += BATCH) {
        const batch = keys.slice(i, i + BATCH);
        const rows = await Promise.all(
          batch.map(async (k) => {
            try {
              const cfg = await env.AB_INDEX.get(k, { type: "json" });
              if (!cfg) return null;
              return {
                alias:    k.slice("ab_config:".length),
                state:    getExpState(cfg),
                variants: (cfg.variants || []).map((v) => ({ slug: v.slug, weight: v.weight })),
              };
            } catch (_) { return null; }
          })
        );
        for (const r of rows) if (r) experiments.push(r);
      }
    } catch (_) {
      // Non-fatal — return whatever was collected
    }
  }

  experiments.sort((a, b) => a.alias.localeCompare(b.alias));

  return new Response(
    JSON.stringify({ experiments }),
    { status: 200, headers: jsonHeaders() }
  );
}
