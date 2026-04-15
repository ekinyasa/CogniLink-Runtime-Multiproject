/**
 * functions/nilufer/campaign/[campaign].js — Legacy campaign landing route.
 *
 * GET /nilufer/campaign/:campaign → 308 Permanent Redirect → /admin/campaign/:campaign
 *
 * Preserves compatibility with existing bookmarks (Prompt 41).
 * The ?token= query param is forwarded so deep-links from old bookmarks still
 * authenticate correctly against the new /admin/campaign/:campaign handler.
 *
 * Original handler moved to functions/admin/campaign/[campaign].js.
 */
export function onRequestGet({ request, params }) {
  const campaignName = (params.campaign || "").toLowerCase().trim();
  const search       = new URL(request.url).search;   // forward ?token=... etc.
  return Response.redirect("/admin/campaign/" + encodeURIComponent(campaignName) + search, 308);
}
