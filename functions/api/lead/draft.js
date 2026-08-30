import { readCookie, buildSetCookie } from "../../_shared/cookie-utils.js";
import { parseUserState, serializeUserState } from "../../_shared/user-state.js";

const ALLOWED_FIELDS = [
  "phone", "telefon", "tel", "cep",
  "email", "eposta", "e-posta",
  "name", "isim", "ad", "ad_soyad", "full_name",
  "tc", "tcValue", "tcKimlik", "tckn", "tc_kimlik", "tc_no", "tc-kimlik",
  "birth_date", "birthDate", "license_plate", "plate",
  "contact_preference", "iletisimTercihi", "situation", "custom_fields"
];

const getCorsHeaders = (request) => {
  const origin = request.headers.get("Origin");
  const host = request.headers.get("Host");
  const isSameOrigin = origin && host && origin.endsWith(host);

  let allowedOrigin = "";
  if (!origin) {
    allowedOrigin = "*";
  } else if (isSameOrigin || origin.startsWith("http://localhost:") || origin.endsWith(".pages.dev") || origin.endsWith(".ekinyasa.online")) {
    allowedOrigin = origin;
  } else {
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

async function hashToken(token) {
  if (!token) return "";
  const msgBuffer = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

export function onRequestOptions(context) {
  const headers = getCorsHeaders(context.request);
  headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
  headers["Access-Control-Allow-Headers"] = "Content-Type";
  return new Response(null, { status: 204, headers });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  try {
    if (!env.DB) {
      return new Response(JSON.stringify({ error: "Sistemsel yapılandırma hatası." }), {
        status: 500,
        headers: corsHeaders
      });
    }

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return new Response(JSON.stringify({ error: "Unsupported Content-Type" }), {
        status: 415,
        headers: corsHeaders
      });
    }

    let body;
    try {
      body = await request.json();
    } catch (_) {
      return new Response(JSON.stringify({ error: "Malformed JSON payload" }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const { slug, fields } = body;
    if (!slug || typeof slug !== "string" || !fields || typeof fields !== "object") {
      return new Response(JSON.stringify({ error: "Missing slug or fields" }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Filter fields by whitelist
    const cleanFields = {};
    let hasValue = false;
    for (const key of ALLOWED_FIELDS) {
      if (fields[key] !== undefined && fields[key] !== null) {
        const val = String(fields[key]).trim();
        if (val) {
          cleanFields[key] = val;
          hasValue = true;
        }
      }
    }

    // Do not create draft for untouched empty forms
    if (!hasValue) {
      return new Response(JSON.stringify({ ok: true, status: "empty_ignored" }), {
        status: 200,
        headers: corsHeaders
      });
    }

    // Payload size guard (e.g. max 50KB for JSON)
    const payloadStr = JSON.stringify(cleanFields);
    if (payloadStr.length > 50000) {
      return new Response(JSON.stringify({ error: "Payload exceeds size limit" }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const rawCookie = readCookie(request, "cos_state");
    let user = parseUserState(rawCookie);
    if (!user.uid) {
      user.uid = crypto.randomUUID();
    }

    // Resolve campaign context
    const cleanSlug = slug.trim().toLowerCase();
    let campaignId = null;
    let product = cleanSlug.split("-")[0] || "unknown";
    let intent = cleanSlug;

    try {
      let slugData = null;
      if (env.SLUG_LINKS) {
        slugData = await env.SLUG_LINKS.get(cleanSlug, { type: "json" });
      }
      if (!slugData && env.APP_CONFIG) {
        slugData = await env.APP_CONFIG.get(`hub:${cleanSlug}`, { type: "json" });
      }
      if (slugData) {
        campaignId = slugData.campaign || null;
        product = slugData.product || product;
        intent = slugData.intent || intent;
      }

      if (!campaignId && env.APP_CONFIG) {
        const landingPtr = await env.APP_CONFIG.get(`landing:${cleanSlug}`, { type: "json" });
        if (landingPtr && landingPtr.campaignId) {
          campaignId = landingPtr.campaignId;
        }
      }

      if (campaignId && env.APP_CONFIG) {
        const campRec = await env.APP_CONFIG.get(`campaign:${campaignId}`, { type: "json" });
        if (campRec) {
          product = campRec.product || product;
          intent = campRec.slug || campRec.alias || campaignId;
        }
      }
    } catch (_) {}

    // Extract phone/email from fields for standard columns
    const emailVal = cleanFields.email || cleanFields.eposta || cleanFields.emailVal;
    const phoneVal = cleanFields.phone || cleanFields.telefon || cleanFields.cep;
    const cleanEmail = emailVal ? String(emailVal).trim().toLowerCase() : null;
    const cleanPhone = phoneVal ? String(phoneVal).trim().slice(0, 30) : null;
    const cleanPref = cleanFields.contact_preference || null;

    let draftToken = readCookie(request, "cl_draft_token");
    let isNewToken = false;
    if (!draftToken) {
      draftToken = crypto.randomUUID();
      isNewToken = true;
    }

    const tokenHash = await hashToken(draftToken);
    const now = Math.floor(Date.now() / 1000);

    // Look up existing draft in D1 by token hash
    const existing = await env.DB.prepare(
      "SELECT id, created_at, working_payload_json FROM applications WHERE situation = ? AND status = 'draft' LIMIT 1"
    ).bind(tokenHash).first();

    let finalAppId;

    if (existing) {
      // Expiry check (30 days = 2592000 seconds)
      if (now - existing.created_at > 2592000) {
        // Expired. We treat as new draft
        finalAppId = crypto.randomUUID();
        const payloadJson = JSON.stringify(cleanFields);
        await env.DB.prepare(
          `INSERT INTO applications (
            id, created_at, updated_at, status, slug, campaign, source,
            product, intent, situation, contact_preference, phone, email,
            landing_version, original_payload_json, working_payload_json, visitor_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          finalAppId, now, now, "draft", cleanSlug, campaignId, "landing_form",
          product, intent, tokenHash, cleanPref, cleanPhone, cleanEmail,
          null, payloadJson, payloadJson, user.uid
        ).run();
      } else {
        // Merge working payload
        finalAppId = existing.id;
        let mergedPayload = {};
        try {
          mergedPayload = JSON.parse(existing.working_payload_json || "{}");
        } catch (_) {}

        Object.assign(mergedPayload, cleanFields);

        await env.DB.prepare(
          `UPDATE applications
           SET working_payload_json = ?, updated_at = ?, phone = ?, email = ?, contact_preference = ?
           WHERE id = ?`
        ).bind(
          JSON.stringify(mergedPayload), now, cleanPhone || null, cleanEmail || null, cleanPref, finalAppId
        ).run();
      }
    } else {
      // Create new draft row
      finalAppId = crypto.randomUUID();
      const payloadJson = JSON.stringify(cleanFields);
      await env.DB.prepare(
        `INSERT INTO applications (
          id, created_at, updated_at, status, slug, campaign, source,
          product, intent, situation, contact_preference, phone, email,
          landing_version, original_payload_json, working_payload_json, visitor_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        finalAppId, now, now, "draft", cleanSlug, campaignId, "landing_form",
        product, intent, tokenHash, cleanPref, cleanPhone, cleanEmail,
        null, payloadJson, payloadJson, user.uid
      ).run();
    }

    const response = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: corsHeaders
    });

    // Write draft cookie
    response.headers.append(
      "Set-Cookie",
      buildSetCookie("cl_draft_token", draftToken, {
        maxAge: 2592000, // 30 days
        path: "/",
        sameSite: "Lax",
        secure: request.url.startsWith("https:"),
        httpOnly: true
      })
    );

    // Also write updated cos_state if it's a new visitor (uid was newly initialized)
    if (!rawCookie) {
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
    }

    return response;
  } catch (e) {
    // Hide raw database/code errors from client
    console.error("Draft save error:", e);
    return new Response(JSON.stringify({ error: "Taslak kaydedilirken geçici bir hata oluştu." }), {
      status: 500,
      headers: corsHeaders
    });
  }
}
