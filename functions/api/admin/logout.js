import { jsonHeaders } from "../../_shared/auth.js";

export async function onRequestPost() {
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      ...jsonHeaders(),
      "Set-Cookie": "admin_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0"
    }
  });
}
