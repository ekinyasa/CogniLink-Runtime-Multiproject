/**
 * GET /api/admin/nuke
 * 
 * DANGER: This endpoint irreversibly deletes ALL data in ALL bound KV namespaces.
 * It is used exactly once to wipe test data before Staging/Production launch.
 * 
 * Authentication: Bearer <ADMIN_TOKEN>
 */

import { verifyToken, unauthorized, jsonHeaders } from "../../_shared/auth.js";

async function clearNamespace(ns) {
  if (!ns) return 0;
  let deletedCount = 0;
  let cursor;
  do {
    const page = await ns.list({ limit: 1000, cursor });
    const keys = page.keys;
    
    // Workers KV requires keys to be deleted individually inside the Worker runtime
    await Promise.all(keys.map(k => ns.delete(k.name)));
    
    deletedCount += keys.length;
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return deletedCount;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  
  const url = new URL(request.url);
  const tokenQuery = url.searchParams.get("token");
  
  // Allow token via query param (easy browser access) or standard Bearer header
  if (tokenQuery) {
    if (tokenQuery !== env.ADMIN_TOKEN) return unauthorized();
  } else {
    if (!verifyToken(request, env)) return unauthorized();
  }

  const results = {};
  
  // Define all namespaces that might hold test data
  const namespaces = {
    SLUG_LINKS: env.SLUG_LINKS,
    CAMPAIGN_INDEX: env.CAMPAIGN_INDEX,
    LANDING_CONFIG: env.LANDING_CONFIG,
    CAMPAIGN_AB_ALIAS_INDEX: env.CAMPAIGN_AB_ALIAS_INDEX,
    AB_INDEX: env.AB_INDEX,
    ROUTE_ALIAS: env.ROUTE_ALIAS,
    APP_CONFIG: env.APP_CONFIG,
    ANALITICS_DATA: env.ANALITICS_DATA,
    GUARD_CACHE: env.GUARD_CACHE
  };

  try {
    for (const [name, ns] of Object.entries(namespaces)) {
      if (ns) {
        const count = await clearNamespace(ns);
        results[name] = `Deleted ${count} keys`;
      } else {
        results[name] = "Binding not found";
      }
    }

    return new Response(JSON.stringify({ 
      ok: true, 
      message: "NUKE COMPLETE: All test data has been eradicated.", 
      results 
    }), {
      status: 200,
      headers: jsonHeaders()
    });
  } catch (err) {
    return new Response(JSON.stringify({ 
      ok: false, 
      error: err.message, 
      results 
    }), {
      status: 500,
      headers: jsonHeaders()
    });
  }
}
