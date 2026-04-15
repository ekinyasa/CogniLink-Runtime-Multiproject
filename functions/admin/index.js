/**
 * functions/admin/index.js — Studio admin panel.
 *
 * GET /admin
 *
 * Replaced the legacy /nilufer route (Prompt 41).
 * /nilufer now permanently redirects here.
 */
import { renderAdmin } from "../_shared/admin-renderer.js";

export async function onRequestGet({ env }) {
  return new Response(renderAdmin({
    branch: (env && env.CF_PAGES_BRANCH)     || "",
    sha:    (env && env.CF_PAGES_COMMIT_SHA) || "",
  }), {
    headers: {
      "Content-Type":           "text/html;charset=UTF-8",
      "Cache-Control":          "no-store",
      "X-Robots-Tag":           "noindex,nofollow,noarchive",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options":        "DENY",
      "Referrer-Policy":        "no-referrer",
    },
  });
}
