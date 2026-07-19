import { verifyToken, unauthorized, jsonHeaders } from "../../_shared/auth.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await verifyToken(request, env))) return unauthorized();
  
  const results = [];
  if (env.APP_CONFIG) {
     let cursor;
     do {
       const page = await env.APP_CONFIG.list({ prefix: "journey:", cursor });
       for (const key of page.keys) {
         try {
           const data = await env.APP_CONFIG.get(key.name, { type: "json" });
           if (data) results.push({ id: key.name.replace("journey:", ""), ...data });
         } catch(e){}
       }
       cursor = page.list_complete ? undefined : page.cursor;
     } while(cursor);
  }
  return new Response(JSON.stringify({ journeys: results }), { status: 200, headers: jsonHeaders() });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await verifyToken(request, env))) return unauthorized();
  try {
    const data = await request.json();
    const id = data.id || "j-" + Date.now();
    data.id = id;
    if (env.APP_CONFIG) {
       await env.APP_CONFIG.put(`journey:${id}`, JSON.stringify(data));
    }
    return new Response(JSON.stringify({ success: true, id }), { status: 200, headers: jsonHeaders() });
  } catch(e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: jsonHeaders() });
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  if (!(await verifyToken(request, env))) return unauthorized();
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (id && env.APP_CONFIG) {
     await env.APP_CONFIG.delete(`journey:${id}`);
  }
  return new Response(JSON.stringify({ success: true }), { status: 200, headers: jsonHeaders() });
}
