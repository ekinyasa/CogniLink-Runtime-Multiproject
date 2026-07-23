/**
 * functions/global-assets/main.js.js
 *
 * Serves the global custom script stored in LANDING_CONFIG KV as a native,
 * cacheable, and immutable JS file.
 */
export async function onRequestGet(context) {
  const { env } = context;
  
  let cfg = {};
  try {
    cfg = await env.LANDING_CONFIG.get("hub_config", { type: "json" }) || {};
  } catch (err) {
    console.error("Failed to read hub_config from KV:", err);
  }

  const js = cfg.customScript || "";

  return new Response(js, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
