/**
 * functions/global-assets/main.js.js
 *
 * Serves the global custom script stored in LANDING_CONFIG KV as a native,
 * cacheable, and immutable JS file.
 */
import { DEFAULT_CUSTOM_SCRIPT } from "./default-script.js";

export async function onRequestGet(context) {
  const { env } = context;
  
  let cfg = {};
  try {
    cfg = await env.LANDING_CONFIG.get("hub_config", { type: "json" }) || {};
  } catch (err) {
    console.error("Failed to read hub_config from KV:", err);
  }

  let js = DEFAULT_CUSTOM_SCRIPT;

  // If customScript contains non-legacy/additional scripts, append it.
  // We identify the legacy validator by the presence of key validation variables.
  if (cfg.customScript && typeof cfg.customScript === "string") {
    const trimmed = cfg.customScript.trim();
    const isLegacy = trimmed.includes("FORM_SELECTOR") && trimmed.includes("CogniLinkForms");
    if (!isLegacy && trimmed) {
      js += "\n" + trimmed;
    }
  }

  return new Response(js, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
