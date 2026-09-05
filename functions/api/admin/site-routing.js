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

  if (env.APP_CONFIG) {
    try {
      const routing = await env.APP_CONFIG.get("site:routing", { type: "json" });
      if (routing && routing.homepagePageId) {
        homepagePageId = routing.homepagePageId;
      }
    } catch (_) {}
  }

  if (!homepagePageId && env.LANDING_CONFIG) {
    try {
      const cfg = await env.LANDING_CONFIG.get("hub_config", { type: "json" });
      if (cfg && cfg.homepageStaticPageId) {
        homepagePageId = cfg.homepageStaticPageId;
      }
    } catch (_) {}
  }

  return new Response(JSON.stringify({ homepagePageId }), {
    status: 200,
    headers: jsonHeaders(),
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await verifyToken(request, env))) return unauthorized();

  try {
    const body = await request.json();
    const homepagePageId = (body.homepagePageId || "").trim();

    if (env.APP_CONFIG) {
      await env.APP_CONFIG.put("site:routing", JSON.stringify({ homepagePageId }));
    }

    if (env.LANDING_CONFIG) {
      const cfg = (await env.LANDING_CONFIG.get("hub_config", { type: "json" })) || {};
      cfg.homepageStaticPageId = homepagePageId;
      await env.LANDING_CONFIG.put("hub_config", JSON.stringify(cfg));
    }

    return new Response(JSON.stringify({ success: true, homepagePageId }), {
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
