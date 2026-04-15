/**
 * GET /api/admin/campaigns
 *
 * Lists all campaign names from CAMPAIGN_INDEX.
 * Used by the Experiments page create form to populate the campaign selector
 * so that slug filtering uses the correct campaign name (not the alias).
 *
 * Authentication: Bearer <ADMIN_TOKEN>
 *
 * Response 200:
 *   { campaigns: ["ab-rand-45", "a65-ab", …] }   // sorted alphabetically
 *
 * Prompt 68 — Section 1 (slug filtering fix)
 */

import { verifyToken, unauthorized, jsonHeaders } from "../../_shared/auth.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!verifyToken(request, env)) return unauthorized();

  const campaigns = [];

  if (env.CAMPAIGN_INDEX) {
    try {
      let cursor;
      do {
        const opts = { limit: 1000 };
        if (cursor) opts.cursor = cursor;
        const page = await env.CAMPAIGN_INDEX.list(opts);
        for (const key of page.keys) campaigns.push(key.name);
        cursor = page.list_complete ? undefined : page.cursor;
      } while (cursor);
    } catch (_) {
      // Non-fatal — return whatever was collected
    }
  }

  campaigns.sort();

  return new Response(
    JSON.stringify({ campaigns }),
    { status: 200, headers: jsonHeaders() }
  );
}
