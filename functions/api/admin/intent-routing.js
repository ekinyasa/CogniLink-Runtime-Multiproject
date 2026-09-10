import { verifyToken, unauthorized, jsonHeaders } from "../../_shared/auth.js";
import { sanitizePageHead } from "../../_shared/hub-renderer.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await verifyToken(request, env))) return unauthorized();
  
  const results = [];
  if (env.APP_CONFIG) {
     let cursor;
     do {
       const page = await env.APP_CONFIG.list({ prefix: "campaign:", cursor });
       for (const key of page.keys) {
         try {
           const data = await env.APP_CONFIG.get(key.name, { type: "json" });
           if (data) results.push({ slug: key.name.replace("campaign:", ""), ...data });
         } catch(e){}
       }
       cursor = page.list_complete ? undefined : page.cursor;
     } while(cursor);
  }
  return new Response(JSON.stringify({ campaigns: results }), { status: 200, headers: jsonHeaders() });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await verifyToken(request, env))) return unauthorized();
  try {
    const data = await request.json(); // { slug, destinations, evaluation, rules, landings... }
    if (!data.slug) throw new Error("Missing slug");
    
    const slug = data.slug.toLowerCase().trim();

    if (Array.isArray(data.landings)) {
      for (const l of data.landings) {
        if (l && l.head !== undefined) {
          l.head = sanitizePageHead(l.head);
        }
      }
    }

    if (env.APP_CONFIG) {
       await env.APP_CONFIG.put(`campaign:${slug}`, JSON.stringify(data));
       
       // Record index entries for landing canonical slugs & aliases
       if (Array.isArray(data.landings)) {
         for (const l of data.landings) {
           const landingSlug = (l.slug || l.id || "").toLowerCase().trim().replace(/^\/+/, "");
           if (landingSlug) {
             await env.APP_CONFIG.put(`landing:${landingSlug}`, JSON.stringify({
               campaignId: slug,
               landingId: l.id
             }));
           }

           if (env.ROUTE_ALIAS) {
             const cleanAlias = (l.alias || "").toLowerCase().trim().replace(/^\/+/, "");
             if (cleanAlias) {
               if ((l.status || "draft").toLowerCase() === "published") {
                 // Route alias maps to canonical landing route
                 await env.ROUTE_ALIAS.put(`route:${cleanAlias}`, `/l/${landingSlug}`);
               } else {
                 // Delete route alias if not published
                 await env.ROUTE_ALIAS.delete(`route:${cleanAlias}`);
               }
             }
           }
         }
       }

       // Record campaign alias for routing
       if (env.ROUTE_ALIAS) {
          await env.ROUTE_ALIAS.put(slug, slug);
       }
    }
    return new Response(JSON.stringify({ success: true, slug }), { status: 200, headers: jsonHeaders() });
  } catch(e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: jsonHeaders() });
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  if (!(await verifyToken(request, env))) return unauthorized();
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  if (slug) {
     if (env.APP_CONFIG) await env.APP_CONFIG.delete(`campaign:${slug}`);
     if (env.ROUTE_ALIAS) await env.ROUTE_ALIAS.delete(slug);
  }
  return new Response(JSON.stringify({ success: true }), { status: 200, headers: jsonHeaders() });
}
