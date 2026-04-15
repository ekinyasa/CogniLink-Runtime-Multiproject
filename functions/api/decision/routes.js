const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json;charset=UTF-8",
  "Cache-Control": "public, max-age=60" 
};

export async function onRequestOptions() { 
  return new Response(null, { status: 204, headers: CORS_HEADERS }); 
}

export async function onRequestGet(context) {
  const [routes, engine] = await Promise.all([
    context.env.LANDING_CONFIG.get("kartra_routes", { type: "json" }),
    context.env.LANDING_CONFIG.get("engine_config", { type: "json" })
  ]);
  return new Response(JSON.stringify({ ok: true, routes: routes || {}, engine: engine || {} }), { headers: CORS_HEADERS });
}
