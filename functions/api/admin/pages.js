import { verifyToken, unauthorized, jsonHeaders } from "../../_shared/auth.js";

// Manages Page (Landing) configurations. For backward capability, Pages are stored as `hub:<id>` 
// just like legacy slugs, so the renderer natively supports them.
export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await verifyToken(request, env))) return unauthorized();
  
  const results = [];
  if (env.APP_CONFIG) {
     let cursor;
     do {
       const page = await env.APP_CONFIG.list({ prefix: "hub:", cursor });
       for (const key of page.keys) {
         try {
           const data = await env.APP_CONFIG.get(key.name, { type: "json" });
           if (data) results.push({ id: key.name.replace("hub:", ""), ...data });
         } catch(e){}
       }
       cursor = page.list_complete ? undefined : page.cursor;
     } while(cursor);
  }
  return new Response(JSON.stringify({ pages: results }), { status: 200, headers: jsonHeaders() });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await verifyToken(request, env))) return unauthorized();
  try {
    const data = await request.json(); 
    if (!data.id) throw new Error("Missing Page ID");
    
    if (env.APP_CONFIG) {
       await env.APP_CONFIG.put(`hub:${data.id}`, JSON.stringify(data));
    }
    return new Response(JSON.stringify({ success: true, id: data.id }), { status: 200, headers: jsonHeaders() });
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
     await env.APP_CONFIG.delete(`hub:${id}`);
  }
  return new Response(JSON.stringify({ success: true }), { status: 200, headers: jsonHeaders() });
}
