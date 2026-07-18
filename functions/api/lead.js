import { readCookie, buildSetCookie } from "../_shared/cookie-utils.js";
import { parseUserState, serializeUserState, updateUserState } from "../_shared/user-state.js";
import { writeLandingSignalEvent } from "../_shared/analytics.js";

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

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: corsHeaders
    });
  }

  const { email, name, phone, slug, form_id, meta } = body || {};

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || typeof email !== "string" || !emailRegex.test(email.trim())) {
    return new Response(JSON.stringify({ error: "invalid_email" }), {
      status: 400,
      headers: corsHeaders
    });
  }

  // Sanitize lead inputs
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = typeof name === "string" ? name.trim().slice(0, 100) : "";
  const cleanPhone = typeof phone === "string" ? phone.trim().slice(0, 30) : "";
  const cleanSlug = typeof slug === "string" ? slug.trim() : "";
  const cleanFormId = typeof form_id === "string" ? form_id.trim() : "default_lead_form";

  // Parse and update user state cookie
  const rawCookie = readCookie(request, "cos_state");
  let user = parseUserState(rawCookie);

  if (!rawCookie) {
    user.uid = crypto.randomUUID();
    user.v = 1;
    user.c = 1; // Mark conversion on lead submit
    user.h = 0;
    user.e = 100;
    user.u = 0;
    user.t = ["lead_submitted"];
    user.ts = Math.floor(Date.now() / 1000);
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

  // Queue Analytics Engine telemetry write
  context.waitUntil(
    Promise.resolve().then(() =>
      writeLandingSignalEvent(env, {
        type: "conversion",
        meta: {
          campaign: meta?.campaign || cleanSlug || "",
          source: meta?.source || "landing_form",
          form_id: cleanFormId,
          email: cleanEmail
        }
      })
    )
  );

  const response = new Response(
    JSON.stringify({
      ok: true,
      message: "Lead captured successfully",
      lead: {
        email: cleanEmail,
        name: cleanName,
        form_id: cleanFormId,
        slug: cleanSlug
      },
      state: user
    }),
    {
      status: 200,
      headers: corsHeaders
    }
  );

  // Set updated user state cookie
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
