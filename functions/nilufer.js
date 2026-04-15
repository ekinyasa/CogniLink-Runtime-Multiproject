/**
 * functions/nilufer.js — Legacy admin route.
 *
 * GET /nilufer → 308 Permanent Redirect → /admin
 *
 * Preserves compatibility with existing bookmarks (Prompt 41).
 * The admin panel now lives at /admin (functions/admin/index.js).
 */
export function onRequestGet() {
  return Response.redirect("/admin", 308);
}
