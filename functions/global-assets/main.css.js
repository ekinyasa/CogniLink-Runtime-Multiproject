/**
 * functions/global-assets/main.css.js
 *
 * Serves the global custom CSS stored in LANDING_CONFIG KV as a native,
 * cacheable, and immutable CSS file.
 */
export async function onRequestGet(context) {
  const { env } = context;
  
  let cfg = {};
  try {
    cfg = await env.LANDING_CONFIG.get("hub_config", { type: "json" }) || {};
  } catch (err) {
    console.error("Failed to read hub_config from KV:", err);
  }

  const css = cfg.customStyleCss || "";

  return new Response(css, {
    headers: {
      "Content-Type": "text/css; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
