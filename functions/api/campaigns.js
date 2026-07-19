import { verifyToken, unauthorized, jsonHeaders } from "../_shared/auth.js";

/**
 * GET /api/campaigns
 *
 * Lists all campaign names from CAMPAIGN_INDEX, sorted alphabetically.
 * Returns: { campaigns: [{ name, createdAt }] }
 */
export async function onRequestGet(context) {
  const { request, env } = context;

  if (!(await verifyToken(request, env))) return unauthorized();

  try {
    if (!env.CAMPAIGN_INDEX) {
      return new Response(JSON.stringify({ campaigns: [], total: 0 }), { headers: jsonHeaders() });
    }

    const list = await env.CAMPAIGN_INDEX.list({ limit: 500 });

    const entries = await Promise.all(
      list.keys.map(async (k) => {
        try {
          const val = await env.CAMPAIGN_INDEX.get(k.name, { type: "json" });
          return val || { name: k.name };
        } catch {
          return { name: k.name };
        }
      })
    );

    // Sort alphabetically by name
    entries.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    return new Response(
      JSON.stringify({ campaigns: entries, total: entries.length }),
      { headers: jsonHeaders() }
    );
  } catch (e) {
    console.error("[api/campaigns] error:", e?.message);
    return new Response(
      JSON.stringify({ error: "Internal error listing campaigns." }),
      { status: 500, headers: jsonHeaders() }
    );
  }
}
