import { createSessionCookie, jsonHeaders } from "../../_shared/auth.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const password = body.password || "";
    
    // Validate password
    const enc = new TextEncoder();
    const a = enc.encode(password);
    const b = enc.encode(env.ADMIN_TOKEN);
    let valid = false;
    if (a.byteLength === b.byteLength) {
      valid = await crypto.subtle.timingSafeEqual(a, b);
    }
    
    if (valid) {
      const cookieHeader = await createSessionCookie(env);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          ...jsonHeaders(),
          "Set-Cookie": cookieHeader
        }
      });
    } else {
      return new Response(JSON.stringify({ error: "Invalid password" }), {
        status: 401,
        headers: jsonHeaders()
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: "Bad request" }), {
      status: 400,
      headers: jsonHeaders()
    });
  }
}
