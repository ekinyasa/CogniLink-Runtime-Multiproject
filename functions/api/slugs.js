import { verifyToken, unauthorized, jsonHeaders } from "../_shared/auth.js";

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!verifyToken(request, env)) return unauthorized();

  const url    = new URL(request.url);
  const limit  = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200);
  const prefix = url.searchParams.get("prefix") || undefined;

  try {
    if (!env.SLUG_LINKS) {
      return new Response(JSON.stringify({ slugs: [], total: 0, truncated: false }), { headers: jsonHeaders() });
    }

    const listOpts = { limit };
    if (prefix) listOpts.prefix = prefix;

    const list = await env.SLUG_LINKS.list(listOpts);

    const slugKeys = list.keys.filter((k) => {
      const n = k.name;
      return !n.startsWith("count:") && !n.startsWith("webhook:");
    });

    const entries = await Promise.all(
      slugKeys.map(async (k) => {
        try {
          const val = await env.SLUG_LINKS.get(k.name, { type: "json" });
          return val || { slug: k.name };
        } catch (e) {
          return { slug: k.name };
        }
      })
    );

    entries.sort((a, b) => {
      const ta = a.updatedAt || a.createdAt || "";
      const tb = b.updatedAt || b.createdAt || "";
      return tb.localeCompare(ta);
    });

    return new Response(
      JSON.stringify({ slugs: entries, total: entries.length, truncated: list.list_complete === false }),
      { headers: jsonHeaders() }
    );
  } catch (e) {
    console.error("[api/slugs] error:", e?.message);
    return new Response(
      JSON.stringify({ error: "Internal error listing slugs." }),
      { status: 500, headers: jsonHeaders() }
    );
  }
}
