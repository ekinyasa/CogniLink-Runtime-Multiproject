/**
 * GET /api/admin/aliases — List campaign alias names from CAMPAIGN_AB_ALIAS_INDEX.
 *
 * Returns all `alias:*` keys (campaign aliases only — not slug_alias:*).
 * Used by the admin panel A/B routing card to populate the alias selector.
 *
 * Authentication: Bearer <ADMIN_TOKEN>
 *
 * Response 200:
 *   { aliases: ["ab26", "launch", "spring", …] }   // sorted alphabetically
 */

import { verifyToken, unauthorized, jsonHeaders } from "../../_shared/auth.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await verifyToken(request, env))) return unauthorized();

  const aliases = [];

  if (env.CAMPAIGN_AB_ALIAS_INDEX) {
    try {
      for (const prefix of ["alias:", "slug_alias:"]) {
        let cursor;
        do {
          const opts = { prefix, limit: 1000 };
          if (cursor) opts.cursor = cursor;
          const page = await env.CAMPAIGN_AB_ALIAS_INDEX.list(opts);
          for (const key of page.keys) {
            aliases.push(key.name.slice(prefix.length));
          }
          cursor = page.list_complete ? undefined : page.cursor;
        } while (cursor);
      }
    } catch (_) {
      // Non-fatal — return whatever was collected so far
    }
  }

  aliases.sort();

  return new Response(
    JSON.stringify({ aliases }),
    { status: 200, headers: jsonHeaders() }
  );
}
