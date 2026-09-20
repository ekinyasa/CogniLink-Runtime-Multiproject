/**
 * functions/api/admin/site-routing.js
 *
 * Site Routing Settings Admin API.
 * Configures the canonical root domain homepage assignment.
 */

import { verifyToken, unauthorized, jsonHeaders } from "../../_shared/auth.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await verifyToken(request, env))) return unauthorized();

  let homepagePageId = "";
  let notFoundPageId = "";

  if (env.APP_CONFIG) {
    try {
      const routing = await env.APP_CONFIG.get("site:routing", { type: "json" });
      if (routing) {
        if (routing.homepagePageId) homepagePageId = routing.homepagePageId;
        if (routing.notFoundPageId) notFoundPageId = routing.notFoundPageId;
      }
    } catch (_) {}
  }

  if ((!homepagePageId || !notFoundPageId) && env.LANDING_CONFIG) {
    try {
      const cfg = await env.LANDING_CONFIG.get("hub_config", { type: "json" });
      if (cfg) {
        if (!homepagePageId && cfg.homepageStaticPageId) homepagePageId = cfg.homepageStaticPageId;
        if (!notFoundPageId && cfg.notFoundStaticPageId) notFoundPageId = cfg.notFoundStaticPageId;
      }
    } catch (_) {}
  }

  return new Response(JSON.stringify({ homepagePageId, notFoundPageId }), {
    status: 200,
    headers: jsonHeaders(),
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await verifyToken(request, env))) return unauthorized();

  try {
    const body = await request.json();
    const homepagePageId = body.homepagePageId !== undefined ? (body.homepagePageId || "").trim() : "";
    const notFoundPageId = body.notFoundPageId !== undefined ? (body.notFoundPageId || "").trim() : "";

    if (env.APP_CONFIG) {
      let routing = {};
      try {
        routing = (await env.APP_CONFIG.get("site:routing", { type: "json" })) || {};
      } catch (_) {}
      routing.homepagePageId = homepagePageId;
      routing.notFoundPageId = notFoundPageId;
      await env.APP_CONFIG.put("site:routing", JSON.stringify(routing));
    }

    if (env.LANDING_CONFIG) {
      const cfg = (await env.LANDING_CONFIG.get("hub_config", { type: "json" })) || {};
      cfg.homepageStaticPageId = homepagePageId;
      cfg.notFoundStaticPageId = notFoundPageId;
      await env.LANDING_CONFIG.put("hub_config", JSON.stringify(cfg));
    }

    return new Response(JSON.stringify({ success: true, homepagePageId, notFoundPageId }), {
      status: 200,
      headers: jsonHeaders(),
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 400,
      headers: jsonHeaders(),
    });
  }
}
