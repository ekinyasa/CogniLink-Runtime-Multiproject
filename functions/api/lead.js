import { readCookie, buildSetCookie } from "../_shared/cookie-utils.js";
import { parseUserState, serializeUserState, updateUserState } from "../_shared/user-state.js";
import { writeLandingSignalEvent } from "../_shared/analytics.js";

async function hashToken(token) {
  if (!token) return "";
  const msgBuffer = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

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

function isValidTC(tc) {
  if (typeof tc !== "string" || tc.length !== 11 || /[^0-9]/.test(tc)) return false;
  if (tc[0] === "0") return false;
  let sumOdd = 0, sumEven = 0;
  for (let i = 0; i < 9; i++) {
    if (i % 2 === 0) sumOdd += parseInt(tc[i], 10);
    else sumEven += parseInt(tc[i], 10);
  }
  const tenth = ((sumOdd * 7) - sumEven) % 10;
  if (tenth !== parseInt(tc[9], 10)) return false;
  const totalSum = (sumOdd + sumEven + tenth) % 10;
  if (totalSum !== parseInt(tc[10], 10)) return false;
  return true;
}

function isValidPhone(phone) {
  const p = typeof phone === "string" ? phone.replace(/[^0-9]/g, "") : "";
  return p.length === 10 || p.length === 11;
}
export async function onRequestPost(context) {
  try {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  let body = {};
  const contentType = request.headers.get("content-type") || "";
  const isJsonReq = contentType.includes("application/json");
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
    return new Response(JSON.stringify({ error: "İstek formatı hatalı. Lütfen kontrol edip tekrar deneyin." }), {
      status: 400,
      headers: corsHeaders
    });
  }

  const email = body.email || body.eposta || body["e-posta"];
  const phone = body.phone || body.telefon || body.tel || body.cep || body.gsm;
  const name = body.name || body.isim || body.ad || body.ad_soyad;
  const tcValue = body.tc || body.tcKimlik || body.tckn || body.tc_kimlik || body.tc_no || body["tc-kimlik"];
  const referer = request.headers.get("referer");

  if (tcValue && !isValidTC(String(tcValue).trim())) {
    if (referer && !isJsonReq) {
      try {
        const redirectUrl = new URL(referer);
        redirectUrl.searchParams.set("error", "Geçersiz TC Kimlik No");
        return new Response(null, {
          status: 303,
          headers: {
            "Location": redirectUrl.toString(),
            ...corsHeaders
          }
        });
      } catch(e) {}
    }
    return new Response(JSON.stringify({ error: "Geçersiz TC Kimlik No" }), {
      status: 400,
      headers: corsHeaders
    });
  }
  if (phone && !isValidPhone(String(phone).trim())) {
    if (referer && !isJsonReq) {
      try {
        const redirectUrl = new URL(referer);
        redirectUrl.searchParams.set("error", "Geçersiz Telefon Numarası");
        return new Response(null, {
          status: 303,
          headers: {
            "Location": redirectUrl.toString(),
            ...corsHeaders
          }
        });
      } catch(e) {}
    }
    return new Response(JSON.stringify({ error: "Geçersiz Telefon Numarası" }), {
      status: 400,
      headers: corsHeaders
    });
  }

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
    return new Response(JSON.stringify({ error: "Lütfen geçerli bir telefon numarası veya e-posta adresi girin." }), {
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

  if (cleanSlug) {
    try {
      let slugData = null;
      // V1: Legacy SLUG_LINKS
      if (env.SLUG_LINKS) {
        slugData = await env.SLUG_LINKS.get(cleanSlug, { type: "json" });
      }

      // V2: Hub APP_CONFIG (if SLUG_LINKS missed)
      if (!slugData && env.APP_CONFIG) {
        slugData = await env.APP_CONFIG.get(`hub:${cleanSlug}`, { type: "json" });
      }

      if (slugData) {
        resolvedCampaign = slugData.campaign || null;
        resolvedProduct = slugData.product || null;
        resolvedIntent = slugData.intent || null;
        // The baseline configuration version, NOT the actual verifiable rendered A/B version.
        resolvedLandingVersion = (slugData.version || slugData.landing_version || "unknown") + "_BASELINE_UNVERIFIED";
      }

      // V2: Landing Pointer (If still no campaign/intent found)
      if (!resolvedCampaign && env.APP_CONFIG) {
        const landingPtr = await env.APP_CONFIG.get(`landing:${cleanSlug}`, { type: "json" });
        if (landingPtr && landingPtr.campaignId) {
          resolvedCampaign = landingPtr.campaignId;
          resolvedLandingVersion = landingPtr.landingId + "_BASELINE_UNVERIFIED";
          // We can also fetch the campaign itself to get product/intent
          const campRec = await env.APP_CONFIG.get(`campaign:${landingPtr.campaignId}`, { type: "json" });
          if (campRec) {
            resolvedProduct = campRec.product || null;
            resolvedIntent = campRec.slug || campRec.alias || landingPtr.campaignId;
          }
        }
      }
    } catch (e) {}
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ error: "Sistem yapılandırma hatası (DB bulunamadı).", details: "env.DB is undefined" }), {
      status: 500,
      headers: corsHeaders
    });
  }

  let idemSecs = 2592000; // default 30 days
  if (resolvedCampaign && env.APP_CONFIG) {
    try {
      const campConf = await env.APP_CONFIG.get(`campaign:${resolvedCampaign}`, { type: "json" });
      if (campConf && campConf.idempotency && campConf.idempotency.val) {
        const v = parseInt(campConf.idempotency.val, 10);
        const u = campConf.idempotency.unit === "hours" ? 3600 : 86400;
        if (!isNaN(v)) idemSecs = v * u;
      }
    } catch(e) {}
  }
  const now = Math.floor(Date.now() / 1000);
  let appId = crypto.randomUUID();
  const status = "new";

  const rawCookie = readCookie(request, "cos_state");
  let user = parseUserState(rawCookie);
  if (!user.uid) {
    user.uid = crypto.randomUUID();
    user.ts = now;
  }

  try {

  // ── Turnstile Verification ────────────────────────────────────────────────
  if (env.TURNSTILE_SECRET_KEY && body["cf-turnstile-response"]) {
    const turnstileToken = body["cf-turnstile-response"];
    try {
      const formData = new FormData();
      formData.append('secret', env.TURNSTILE_SECRET_KEY);
      formData.append('response', turnstileToken);
      formData.append('remoteip', request.headers.get('CF-Connecting-IP') || '');

      const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: formData
      });

      const outcome = await res.json();
      if (!outcome.success) {
        return new Response(JSON.stringify({ error: "Güvenlik doğrulaması başarısız oldu (Bot Şüphesi)." }), {
          status: 400,
          headers: corsHeaders
        });
      }
    } catch (e) {
      console.error("Turnstile error:", e);
    }
  } else if (env.TURNSTILE_SECRET_KEY && !body["cf-turnstile-response"]) {
    return new Response(JSON.stringify({ error: "Güvenlik doğrulaması eksik. Lütfen tekrar deneyin." }), {
      status: 400,
      headers: corsHeaders
    });
  }

  // Check if draft exists
  const draftToken = readCookie(request, "cl_draft_token");
  let draftRow = null;
  if (draftToken) {
    const tokenHash = await hashToken(draftToken);
    draftRow = await env.DB.prepare(
      "SELECT id, created_at FROM applications WHERE situation = ? AND status = 'draft' LIMIT 1"
    ).bind(tokenHash).first();
  }

  // 1. IDEMPOTENCY BUG FIX & SPAM PROTECTION (Roadmap V1)
    // Use TC Kimlik No for a 30-day window if available, otherwise fallback to 120-sec phone check
    const tcKimlik = typeof tcValue === "string" || typeof tcValue === "number" ? String(tcValue).trim() : "";
    let existing = null;

    if (tcKimlik) {
      const thirtyDaysAgo = now - idemSecs;
      // SQLite JSON extract syntax for D1
      existing = await env.DB.prepare(
        `SELECT id FROM applications WHERE slug = ? AND json_extract(working_payload_json, '$.tcKimlik') = ? AND created_at > ? LIMIT 1`
      ).bind(cleanSlug, tcKimlik, thirtyDaysAgo).first();
    }

    if (!existing) {
      const idempThreshold = now - idemSecs;
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

    const originalPayload = JSON.stringify(body);
    if (tcKimlik) body.tcKimlik = tcKimlik;
    const workingPayload = JSON.stringify(body);

    if (draftRow && (now - draftRow.created_at <= 2592000)) {
      appId = draftRow.id;
      await env.DB.prepare(
        `UPDATE applications
         SET status = 'new', situation = null, slug = ?, campaign = ?, source = ?,
             product = ?, intent = ?, contact_preference = ?, phone = ?, email = ?,
             landing_version = ?, original_payload_json = ?, working_payload_json = ?,
             visitor_id = ?, updated_at = ?
         WHERE id = ?`
      ).bind(
        cleanSlug, resolvedCampaign, resolvedSource, resolvedProduct, resolvedIntent,
        cleanPref, cleanPhone, cleanEmail, resolvedLandingVersion, originalPayload,
        workingPayload, user.uid, now, appId
      ).run();
    } else {
      if (existing) {
        appId = existing.id;
      } else {
        await env.DB.prepare(
          `INSERT INTO applications (
            id, created_at, updated_at, status, slug, campaign, source,
            product, intent, situation, contact_preference, phone, email,
            landing_version, original_payload_json, working_payload_json, visitor_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          appId, now, now, status, cleanSlug, resolvedCampaign, resolvedSource,
          resolvedProduct, resolvedIntent, null, cleanPref, cleanPhone, cleanEmail,
          resolvedLandingVersion, originalPayload, workingPayload, user.uid
        ).run();
      }
    }
  } catch (e) {
    console.error("Lead D1 insert error:", e);
    return new Response(JSON.stringify({ error: "Sistemsel bir hata oluştu, lütfen daha sonra tekrar deneyin.", details: e.message, stack: e.stack }), {
      status: 500,
      headers: corsHeaders
    });
  }

  const reqProd = resolvedProduct || (cleanSlug ? cleanSlug.split('-')[0] : null);
  const currentTags = Array.isArray(user.t) ? user.t : [];
  const newTags = currentTags.includes("lead_submitted")
    ? currentTags
    : [...currentTags, "lead_submitted"];

  const stateKey = resolvedIntent || reqProd;
  if (!rawCookie) {
    user = updateUserState(user, { v: 1, f: 1, c: 0, h: 0, e: 100, u: 0, t: newTags }, stateKey);
  } else {
    user = updateUserState(user, {
      f: 1,
      h: 0,
      e: Math.min(100, (user.e || 0) + 30),
      t: newTags
    }, stateKey);
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

  if (body._redirect && !isJsonReq) {
    const redirectUrl = new URL(body._redirect, request.url).toString();
    response = new Response(null, {
      status: 303,
      headers: {
        "Location": redirectUrl,
        ...corsHeaders
      }
    });
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

  response.headers.append(
    "Set-Cookie",
    buildSetCookie("cl_draft_token", "", {
      maxAge: 0,
      path: "/",
      sameSite: "Lax",
      secure: request.url.startsWith("https:"),
      httpOnly: true
    })
  );

  return response;
  } catch(globalErr) { return new Response(JSON.stringify({ error: "Beklenmeyen bir hata oluştu, lütfen daha sonra tekrar deneyin.", message: globalErr.message, stack: globalErr.stack }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }); }
}
