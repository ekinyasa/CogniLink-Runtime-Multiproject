import { readCookie, buildSetCookie } from "../_shared/cookie-utils.js";
import { parseUserState, serializeUserState, updateUserState } from "../_shared/user-state.js";
import { writeLandingSignalEvent } from "../_shared/analytics.js";

const getCorsHeaders = (request) => {
  const origin = request.headers.get("Origin");
  const host = request.headers.get("Host");
  const isSameOrigin = origin && host && origin.endsWith(host);
  
  // Allow same-origin, localhost dev, or pages.dev previews.
  // External domains calling this API will need to be explicitly whitelisted if required.
  let allowedOrigin = "";
  if (!origin) {
    allowedOrigin = "*"; // Not a CORS request
  } else if (isSameOrigin || origin.startsWith("http://localhost:") || origin.endsWith(".pages.dev") || origin.endsWith(".ekinyasa.online")) {
    allowedOrigin = origin;
  } else {
    // Rejected arbitrary origin. Prevent wide reflection.
    allowedOrigin = "https://runtime.ekinyasa.online"; 
  }

  return {
    "Content-Type": "application/json;charset=UTF-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Credentials": "true"
  };
};

export function onRequestOptions(context) {
  const headers = getCorsHeaders(context.request);
  headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
  headers["Access-Control-Allow-Headers"] = "Content-Type";
  return new Response(null, { status: 204, headers });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  let body = {};
  const contentType = request.headers.get("content-type") || "";
  try {
    if (contentType.includes("application/json")) {
      body = await request.json();
    } else if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      formData.forEach((value, key) => {
        body[key] = value;
      });
    } else {
      // Fallback
      body = await request.json();
    }
  } catch (_) {
    return new Response(JSON.stringify({ error: "invalid_format" }), {
      status: 400,
      headers: corsHeaders
    });
  }

  const email = body.email || body.eposta || body["e-posta"];
  const phone = body.phone || body.telefon || body.tel || body.cep;
  const name = body.name || body.isim || body.ad || body.ad_soyad;
  
  let slug = body.slug;
  if (!slug) {
    const referer = request.headers.get("referer");
    if (referer) {
      try {
        const url = new URL(referer);
        if (url.pathname.startsWith("/l/")) {
          slug = url.pathname.replace("/l/", "").split("/")[0];
        }
      } catch (e) {}
    }
  }
  
  const form_id = body.form_id;
  const contact_preference = body.contact_preference || body.iletisimTercihi;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isEmailValid = email && typeof email === "string" && emailRegex.test(email.trim());
  const cleanPhone = typeof phone === "string" ? phone.trim().slice(0, 30) : "";
  
  if (!isEmailValid && !cleanPhone) {
    return new Response(JSON.stringify({ error: "missing_contact_info" }), {
      status: 400,
      headers: corsHeaders
    });
  }

  const cleanEmail = isEmailValid ? email.trim().toLowerCase() : "";
  const cleanName = typeof name === "string" ? name.trim().slice(0, 100) : "";
  const cleanSlug = typeof slug === "string" ? slug.trim() : "";
  const cleanFormId = typeof form_id === "string" ? form_id.trim() : "default_lead_form";
  const cleanPref = typeof contact_preference === "string" ? contact_preference.trim() : null;

  // 2. SOURCE / SLUG PROVENANCE
  // Source is purely server-defined. Meta source is discarded.
  const resolvedSource = "landing_form";
  
  // Gap Report on Slug Spoofing:
  // We cannot robustly verify `cleanSlug` against the requested URL without a KV lookup on ROUTE_ALIAS.
  // Therefore, a client could spoof a valid `cleanSlug` of another campaign.

  let resolvedCampaign = null;
  let resolvedProduct = null;
  let resolvedIntent = null;
  let resolvedLandingVersion = null; // 3. LANDING VERSION PROVENANCE: NOT FULLY VALIDATED
  
  if (cleanSlug && env.SLUG_LINKS) {
    try {
      const slugData = await env.SLUG_LINKS.get(cleanSlug, { type: "json" });
      if (slugData) {
        resolvedCampaign = slugData.campaign || null;
        resolvedProduct = slugData.product || null;
        resolvedIntent = slugData.intent || null;
        // The baseline configuration version, NOT the actual verifiable rendered A/B version.
        resolvedLandingVersion = (slugData.version || slugData.landing_version || "unknown") + "_BASELINE_UNVERIFIED";
      }
    } catch (e) {}
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ error: "database_not_configured", details: "env.DB is undefined" }), {
      status: 500,
      headers: corsHeaders
    });
  }

  const now = Math.floor(Date.now() / 1000);
  let appId = crypto.randomUUID();
  const status = "new";

  try {
    // 1. IDEMPOTENCY BUG FIX & SPAM PROTECTION (Roadmap V1)
    // Use TC Kimlik No for a 30-day window if available, otherwise fallback to 120-sec phone check
    const tcKimlik = typeof body.tcKimlik === "string" ? body.tcKimlik.trim() : "";
    let existing = null;
    
    if (tcKimlik) {
      const thirtyDaysAgo = now - 2592000;
      // SQLite JSON extract syntax for D1
      existing = await env.DB.prepare(
        `SELECT id FROM applications WHERE slug = ? AND json_extract(working_payload_json, '$.tcKimlik') = ? AND created_at > ? LIMIT 1`
      ).bind(cleanSlug, tcKimlik, thirtyDaysAgo).first();
    } 
    
    if (!existing) {
      const idempThreshold = now - 120; // Double-submit fallback
      if (cleanEmail) {
        existing = await env.DB.prepare(
          `SELECT id FROM applications WHERE slug = ? AND email = ? AND created_at > ? LIMIT 1`
        ).bind(cleanSlug, cleanEmail, idempThreshold).first();
      } else if (cleanPhone) {
        existing = await env.DB.prepare(
          `SELECT id FROM applications WHERE slug = ? AND phone = ? AND created_at > ? LIMIT 1`
        ).bind(cleanSlug, cleanPhone, idempThreshold).first();
      }
    }

    if (existing) {
      appId = existing.id;
    } else {
      const originalPayload = JSON.stringify(body);
      const workingPayload = JSON.stringify(body);

      await env.DB.prepare(
        `INSERT INTO applications (
          id, created_at, updated_at, status, slug, campaign, source, 
          product, intent, situation, contact_preference, phone, email, 
          landing_version, original_payload_json, working_payload_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        appId, now, now, status, cleanSlug, resolvedCampaign, resolvedSource,
        resolvedProduct, resolvedIntent, null, cleanPref, cleanPhone, cleanEmail,
        resolvedLandingVersion, originalPayload, workingPayload
      ).run();
    }
  } catch (e) {
    console.error("Lead D1 insert error:", e);
    return new Response(JSON.stringify({ error: "database_error", details: e.message, stack: e.stack }), {
      status: 500,
      headers: corsHeaders
    });
  }

  const rawCookie = readCookie(request, "cos_state");
  let user = parseUserState(rawCookie);

  if (!rawCookie) {
    user.uid = crypto.randomUUID();
    user.v = 1;
    user.c = 1; 
    user.h = 0;
    user.e = 100;
    user.u = 0;
    user.t = ["lead_submitted"];
    user.ts = now;
  } else {
    const currentTags = Array.isArray(user.t) ? user.t : [];
    const newTags = currentTags.includes("lead_submitted")
      ? currentTags
      : [...currentTags, "lead_submitted"];
    
    user = updateUserState(user, {
      c: 1,
      h: 0,
      e: Math.min(100, (user.e || 0) + 30),
      t: newTags
    });
  }

  context.waitUntil(
    Promise.resolve().then(() =>
      writeLandingSignalEvent(env, {
        type: "conversion",
        meta: {
          application_id: appId,
          campaign: resolvedCampaign || cleanSlug || "",
          source: resolvedSource,
          form_id: cleanFormId
        }
      })
    )
  );

  let response;
  const isJsonReq = request.headers.get("content-type")?.includes("application/json");

  if (body._redirect && !isJsonReq) {
    const redirectUrl = new URL(body._redirect, request.url).toString();
    response = Response.redirect(redirectUrl, 303);
    Object.entries(corsHeaders).forEach(([k, v]) => response.headers.set(k, v));
  } else {
    response = new Response(
      JSON.stringify({
        ok: true,
        message: "Lead captured successfully",
        application_id: appId,
        state: user
      }),
      {
        status: 200,
        headers: corsHeaders
      }
    );
  }

  response.headers.append(
    "Set-Cookie",
    buildSetCookie("cos_state", serializeUserState(user), {
      maxAge: 604800,
      path: "/",
      sameSite: "None",
      secure: true,
      httpOnly: true
    })
  );

  return response;
}
