/**
 * functions/api/decision/signal.js — Decision feedback endpoint (v1).
 *
 * Receives behavior signals from the client (scroll, time, interaction)
 * and persists them into the 'cos_state' cookie for future routing decisions.
 *
 * Request Payload:
 *   {
 *     "type":  "engagement" | "click",
 *     "score": number,  (for engagement)
 *     "level": "soft" | "hard" (for click)
 *   }
 */

import { readCookie, buildSetCookie } from "../../_shared/cookie-utils.js";
import { parseUserState, serializeUserState, updateUserState } from "../../_shared/user-state.js";
import { writePageViewEvent, writeLandingSignalEvent } from "../../_shared/analytics.js";

const getCorsHeaders = (request) => {
  const origin = request.headers.get("Origin") || "*";
  return {
    "Content-Type": "application/json;charset=UTF-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true"
  };
};

export function onRequestOptions(context) {
  const headers = getCorsHeaders(context.request);
  headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
  headers["Access-Control-Allow-Headers"] = "Content-Type";

  return new Response(null, { status: 204, headers });
}

/**
 * Handle incoming signals and update the user state cookie.
 */
export async function onRequestPost(context) {
  const { request } = context;

  const rawCookie = readCookie(request, "cos_state");
  const corsHeaders = getCorsHeaders(request);

  let body;
  try {
    body = await request.json();
  } catch (_) {
    // For invalid json, fail gracefully to avoid breaking client trackers
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  let isLegacy = !body.meta;

  // Validation Gate: Missing source rejected immediately
  if (!isLegacy && (!body.meta || !body.meta.source)) {
    return new Response(JSON.stringify({ error: "missing_source" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  let user = parseUserState(rawCookie);
  let updated = false;

  // 1. COOKIE YOKSA STATE OLUŞTUR
  if (!rawCookie) {
    user.uid = crypto.randomUUID();
    user.v = 1;
    user.c = 0;
    user.h = 0;
    user.e = 0;
    user.u = 0;
    user.ts = Math.floor(Date.now() / 1000);
    updated = true; // Assure it gets written to Set-Cookie
  }

  let type = body.type || "";

  if (context.env.ENV_NAME !== "prod") {
    // meta.page_type included for enhanced future-ready debugging
    console.log("[signal-debug]", JSON.stringify({ type, isLegacy, meta: body.meta, score: body.score, level: body.level }));
  }

  // 1. Eski yapı desteği (Legacy)
  if (isLegacy) {
    if (type === "engagement") {
      const newScore = Math.min(100, Math.max(user.e, Number(body.score) || 0));
      if (newScore !== user.e) {
        user = updateUserState(user, { e: newScore });
        updated = true;
      }
    } else if (type === "click" && body.level === "hard") {
      if (user.h === 0) {
        user = updateUserState(user, { h: 1 });
        updated = true;
      }
    }
  }
  // 2. Yeni yapı desteği (Event Contract v3)
  else {

    const engine = (await context.env.LANDING_CONFIG.get("engine_config", { type: "json" })) || {};
    let points = engine.points || {};
    let thresholds = engine.thresholds || {};

    // 2a. Priority Custom Engine Score Config Mapping
    const mapId = body.meta ? body.meta.engineMapId : null;
    if (mapId && engine.customMaps && engine.customMaps[mapId]) {
      const customConfig = engine.customMaps[mapId];
      if (customConfig.points && Object.keys(customConfig.points).length > 0) points = { ...points, ...customConfig.points };
      if (customConfig.thresholds && Object.keys(customConfig.thresholds).length > 0) thresholds = { ...thresholds, ...customConfig.thresholds };
    }

    // 2b. Priority Intent Evaluation (Campaign V2)
    const campaignId = body.meta ? body.meta.campaign : null;
    if (campaignId && context.env.APP_CONFIG) {
      try {
        const intentData = await context.env.APP_CONFIG.get(`campaign:${campaignId}`, { type: "json" });
        const evalCfg = intentData?.evaluation || intentData?.routing?.evaluation;
        if (evalCfg) {
          if (evalCfg.hotThreshold !== undefined) thresholds.hot_engagement = Number(evalCfg.hotThreshold);
          if (evalCfg.hardClickPoints !== undefined) points.click_hard = evalCfg.hardClickPoints;
          if (evalCfg.softClickPoints !== undefined) points.click_soft = evalCfg.softClickPoints;
          // Semantic mismatch: Intent uses *Seconds, but signal expects *Pts. Mapping them as points directly.
          if (evalCfg.hardTimeSeconds !== undefined) points.time_hard_pts = evalCfg.hardTimeSeconds;
          if (evalCfg.softTimeSeconds !== undefined) points.time_soft_pts = evalCfg.softTimeSeconds;
        }
      } catch(e) {}
    }

    const HOT_LIMIT = thresholds.hot_engagement || 60;

    let bonus = 0;

    switch (type) {
      case "page_view":
        // No change
        break;

      case "engagement":
        if (body.score !== undefined) {
          const clientScore = Number(body.score) || 0;
          const newScore = Math.min(100, Math.max(user.e, clientScore));
          if (newScore !== user.e) {
            const updates = { e: newScore };
            if (user.h === 0 && newScore >= HOT_LIMIT) {
              updates.h = 1;
            }
            user = updateUserState(user, updates);
            updated = true;
          }
        }
        break;

      case "click_soft":
        bonus = points.click_soft !== undefined ? points.click_soft : 2;
        break;

      case "click_hard":
        bonus = points.click_hard !== undefined ? points.click_hard : 10;
        // Hard clicks immediately designate strong intent
        if (user.h === 0) {
          user = updateUserState(user, { h: 1 });
          updated = true;
        }
        break;

      case "checkout_start":
        bonus = points.checkout_start !== undefined ? points.checkout_start : 0;
        if (user.h === 0) {
          user = updateUserState(user, { h: 1 });
          updated = true;
        }
        break;

      case "newsletter_optin":
        bonus = points.newsletter_optin !== undefined ? points.newsletter_optin : 10;
        break;

      case "video_played":
        bonus = points.video_played !== undefined ? points.video_played : 10;
        break;

      case "time_on_page":
        {
          const isHardPage = body.meta && (body.meta.page_type === "checkout" || body.meta.page_type === "upsell" || body.meta.urgency === "hard");
          if (isHardPage) {
            bonus = points.time_hard_pts !== undefined ? points.time_hard_pts : 5;
          } else {
            bonus = points.time_soft_pts !== undefined ? points.time_soft_pts : 2;
          }
        }
        break;

      case "scroll_depth":
        bonus = points.scroll_depth !== undefined ? points.scroll_depth : 5;
        break;

      case "upsell_enter":
      case "upsell_accept":
      case "upsell_reject":
        // Only meaningful if user has already converted
        if (user.u === 0 && user.c === 1) {
          user = updateUserState(user, { u: 1 });
          updated = true;
        }
        break;

      case "conversion":
        if (user.c === 0 || user.h === 1) {
          // c=1 sets conversion. h=0 resets hot intent since transaction is done.
          user = updateUserState(user, { c: 1, h: 0 });
          updated = true;
        }
        break;

      case "tag_add":
        {
          const tAdd = body.meta && body.meta.tag;
          if (tAdd && Array.isArray(user.t) && !user.t.includes(tAdd)) {
            user = updateUserState(user, { t: [...user.t, tAdd] });
            updated = true;
          }
        }
        break;

      case "tag_remove":
        {
          const tRem = body.meta && body.meta.tag;
          if (tRem && Array.isArray(user.t) && user.t.includes(tRem)) {
            user = updateUserState(user, { t: user.t.filter(t => t !== tRem) });
            updated = true;
          }
        }
        break;

      default:
        // custom_* veya diğer eventler (Clamped weighting per contract v3)
        if (type.startsWith("custom_")) {
          if (body.meta.custom_weight !== undefined) {
            const rawBonus = Number(body.meta.custom_weight) || 0;
            bonus = Math.max(0, Math.min(20, rawBonus));
          }
        }
        break;
    }

    // Engagement Update Logic & Dynamic Threshold Check
    if (bonus > 0) {
      const newScore = Math.min(100, user.e + bonus);
      if (newScore !== user.e) {
        const updates = { e: newScore };
        if (user.h === 0 && newScore >= HOT_LIMIT) {
          updates.h = 1;
        }
        user = updateUserState(user, updates);
        updated = true;
      }
    }

    // --- Analytics Engine Bridge (Pulse Dashboard Restoration) ---
    try {
      if (type === "page_view") {
        writePageViewEvent(context.env, {
          utm_campaign: body.meta?.campaign || body.meta?.alias || "",
          utm_source: body.meta?.source || "",
          page_type: body.meta?.page_type || ""
        });
      } else {
        writeLandingSignalEvent(context.env, {
          type,
          meta: body.meta
        });
      }
    } catch (_e) { }
  }

  const res = new Response(JSON.stringify({ ok: true, state: user }), {
    status: 200,
    headers: corsHeaders,
  });

  // Echo the updated state back via Set-Cookie
  if (updated) {
    // Production Hardening: Absolute Cookie Policy
    res.headers.append("Set-Cookie", buildSetCookie(
      "cos_state",
      serializeUserState(user),
      {
        maxAge: 604800,
        path: "/",
        sameSite: "None",
        secure: true,
        httpOnly: true
      }
    ));
  }

  return res;
}
