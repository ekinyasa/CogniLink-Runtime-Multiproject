import { verifyToken, unauthorized } from "../../../_shared/auth.js";

const ALLOWED_STATUSES = ['new', 'contacted', 'converted', 'rejected'];

export async function onRequestGet(context) {
  const { request, env, params } = context;
  if (!(await verifyToken(request, env))) return unauthorized();

  const id = params.id;
  if (!env.DB) return new Response(JSON.stringify({ error: "DB not configured" }), { status: 500 });

  try {
    const record = await env.DB.prepare(
      `SELECT * FROM applications WHERE id = ?`
    ).bind(id).first();

    if (!record) {
      return new Response(JSON.stringify({ error: "not_found" }), { status: 404 });
    }

    try {
      record.original_payload = JSON.parse(record.original_payload_json);
      record.working_payload = JSON.parse(record.working_payload_json);
    } catch(e) {}
    
    delete record.original_payload_json;
    delete record.working_payload_json;

    return new Response(JSON.stringify(record), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("D1 read error:", e);
    return new Response(JSON.stringify({ error: "database_error" }), { status: 500 });
  }
}

export async function onRequestPut(context) {
  const { request, env, params } = context;
  if (!(await verifyToken(request, env))) return unauthorized();

  const id = params.id;
  if (!env.DB) return new Response(JSON.stringify({ error: "DB not configured" }), { status: 500 });

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400 });
  }

  const { status, working_payload } = body;
  if (!status || !working_payload) {
    return new Response(JSON.stringify({ error: "missing_fields" }), { status: 400 });
  }

  if (!ALLOWED_STATUSES.includes(status)) {
    return new Response(JSON.stringify({ error: "invalid_status", allowed: ALLOWED_STATUSES }), { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);
  const workingPayloadStr = JSON.stringify(working_payload);

  try {
    const result = await env.DB.prepare(
      `UPDATE applications 
       SET status = ?, working_payload_json = ?, updated_at = ? 
       WHERE id = ?`
    ).bind(status, workingPayloadStr, now, id).run();

    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: "not_found" }), { status: 404 });
    }

    return new Response(JSON.stringify({ ok: true, id }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("D1 update error:", e);
    return new Response(JSON.stringify({ error: "database_error" }), { status: 500 });
  }
}
