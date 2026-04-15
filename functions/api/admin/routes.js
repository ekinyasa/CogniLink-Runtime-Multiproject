import { verifyToken, unauthorized, jsonHeaders } from "../../_shared/auth.js";

const ROUTES_KEY = "kartra_routes";

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!verifyToken(request, env)) return unauthorized();

  const routes = await env.LANDING_CONFIG.get(ROUTES_KEY, { type: "json" }) || {};
  const engine = await env.LANDING_CONFIG.get("engine_config", { type: "json" }) || {};
  const visuals = await env.LANDING_CONFIG.get("engine_visuals", { type: "json" }) || {};
  return new Response(JSON.stringify({ routes, engine, visuals }), { headers: jsonHeaders() });
}

export async function onRequestPut(context) {
  const { request, env } = context;
  if (!verifyToken(request, env)) return unauthorized();

  let body;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: jsonHeaders() });
  }

  const sanitized = {};
  if (body && typeof body === "object" && !Array.isArray(body)) {
    for (const [path, conf] of Object.entries(body)) {
      if (typeof path === "string" && path.trim() && conf && typeof conf === "object") {
        sanitized[path.trim().toLowerCase()] = conf;
      }
    }
  }

  let engineSanitized = {};
  if (body.engine && typeof body.engine === "object") {
    engineSanitized = body.engine;
  }

  let visualsSanitized = {};
  if (body.visuals && typeof body.visuals === "object") {
    visualsSanitized = body.visuals;
  }

  await Promise.all([
    env.LANDING_CONFIG.put(ROUTES_KEY, JSON.stringify(sanitized)),
    env.LANDING_CONFIG.put("engine_config", JSON.stringify(engineSanitized)),
    env.LANDING_CONFIG.put("engine_visuals", JSON.stringify(visualsSanitized))
  ]);

  return new Response(JSON.stringify({ ok: true, routes: sanitized, engine: engineSanitized, visuals: visualsSanitized }), { headers: jsonHeaders() });
}
