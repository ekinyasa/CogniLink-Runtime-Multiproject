/**
 * GET /api/admin/slugs?campaign=<name>
 *
 * Lists slug names from SLUG_LINKS, optionally filtered to those whose
 * record.campaign field exactly matches the given campaign name.
 *
 * Used by the Experiments page create form to populate the variant selector
 * (Prompt 67 Section 3).
 *
 * Filtering rule (Prompt 68 S1 fix):
 *   slug record is included when record.campaign === campaign (exact value match).
 *   This replaces the previous prefix-key approach which failed when the
 *   campaign name and alias differed (e.g. campaign "ab-rand-45" vs alias "abrand45").
 *
 * Example:
 *   GET /api/admin/slugs?campaign=ab-rand-45
 *   → ["ab-rand-45-igbio", "ab-rand-45-yt"]
 *
 * Authentication: Bearer <ADMIN_TOKEN>
 *
 * Response 200:
 *   { slugs: ["slug-a", "slug-b", …] }  // sorted alphabetically
 *
 * Prompt 67 — Section 3 | Prompt 68 — Section 1 (filtering fix)
 */

import { verifyToken, unauthorized, jsonHeaders } from "../../_shared/auth.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!verifyToken(request, env)) return unauthorized();

  const url      = new URL(request.url);
  const campaign = (url.searchParams.get("campaign") || "").toLowerCase().trim();

  const slugs = [];

  if (env.SLUG_LINKS) {
    try {
      if (!campaign) {
        // No filter — list all slug keys (no fetch needed, keys == slug names)
        let cursor;
        do {
          const opts = { limit: 1000 };
          if (cursor) opts.cursor = cursor;
          const page = await env.SLUG_LINKS.list(opts);
          for (const key of page.keys) slugs.push(key.name);
          cursor = page.list_complete ? undefined : page.cursor;
        } while (cursor);
      } else {
        // Campaign filter — must match record.campaign exactly (value-based).
        // Collect all keys first, then fetch + compare in batches of 25.
        // This is accurate regardless of how slug keys are named relative to
        // the campaign name (fixes prefix-assumption failure from Prompt 67).
        const allKeys = [];
        let cursor;
        do {
          const opts = { limit: 1000 };
          if (cursor) opts.cursor = cursor;
          const page = await env.SLUG_LINKS.list(opts);
          for (const key of page.keys) allKeys.push(key.name);
          cursor = page.list_complete ? undefined : page.cursor;
        } while (cursor);

        const BATCH = 25;
        for (let i = 0; i < allKeys.length; i += BATCH) {
          const batch = allKeys.slice(i, i + BATCH);
          const results = await Promise.all(
            batch.map(async (k) => {
              try {
                const rec = await env.SLUG_LINKS.get(k, { type: "json" });
                return rec && rec.campaign === campaign ? k : null;
              } catch (_) { return null; }
            })
          );
          for (const s of results) if (s) slugs.push(s);
        }
      }
    } catch (_) {
      // Non-fatal — return whatever was collected
    }
  }

  slugs.sort();

  return new Response(
    JSON.stringify({ slugs }),
    { status: 200, headers: jsonHeaders() }
  );
}
