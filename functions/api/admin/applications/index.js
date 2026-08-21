import { verifyToken, unauthorized } from "../../../_shared/auth.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await verifyToken(request, env))) return unauthorized();

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get("limit")) || 50;
  const offset = parseInt(url.searchParams.get("offset")) || 0;

  if (!env.DB) {
    return new Response(JSON.stringify({ error: "database_not_configured" }), { status: 500 });
  }

  try {
    const { results } = await env.DB.prepare(
      `SELECT id, created_at, status, phone, email, product, intent, situation, slug 
       FROM applications 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`
    ).bind(limit, offset).all();

    return new Response(JSON.stringify({ applications: results }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("D1 list error:", e);
    return new Response(JSON.stringify({ error: "database_error" }), { status: 500 });
  }
}
