/**
 * GET /api/admin/check-alias?value=<alias>
 *
 * Check whether an alias value is available (globally unique) before saving.
 * Used by the admin panel to validate alias fields in real time.
 *
 * Checks both alias types in CAMPAIGN_AB_ALIAS_INDEX:
 *   alias:<value>       — campaign alias
 *   slug_alias:<value>  — direct slug alias
 *
 * Authentication: Bearer <ADMIN_TOKEN>
 *
 * Response 200 — available:
 *   { "available": true }
 *
 * Response 200 — conflict:
 *   { "available": false, "conflict": { "type": "campaign_alias", "resolves_to": "iki-uc" } }
 *   { "available": false, "conflict": { "type": "slug_alias",    "resolves_to": "iki-uc-igbio" } }
 *
 * Response 400 — invalid alias format:
 *   { "available": false, "reason": "invalid_alias_format" }
 */

import { verifyToken, unauthorized, jsonHeaders } from "../../_shared/auth.js";
import { validateAlias }                          from "../../_shared/validators.js";

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!(await verifyToken(request, env))) return unauthorized();

  const url   = new URL(request.url);
  const value = (url.searchParams.get("value") || "").toLowerCase().trim();

  if (!value || !validateAlias(value)) {
    return new Response(
      JSON.stringify({ available: false, reason: "invalid_alias_format" }),
      { status: 400, headers: jsonHeaders() }
    );
  }

  const AR = env.CAMPAIGN_AB_ALIAS_INDEX;
  if (!AR) {
    return new Response(
      JSON.stringify({ available: false, reason: "ALIAS_REGISTRY_not_bound" }),
      { status: 503, headers: jsonHeaders() }
    );
  }

  // Check both alias types in parallel
  const [campaignAlias, slugAlias] = await Promise.all([
    AR.get(`alias:${value}`,      { type: "text" }).catch(() => null),
    AR.get(`slug_alias:${value}`, { type: "text" }).catch(() => null),
  ]);

  if (campaignAlias !== null) {
    return new Response(
      JSON.stringify({ available: false, conflict: { type: "campaign_alias", resolves_to: campaignAlias } }),
      { status: 200, headers: jsonHeaders() }
    );
  }

  if (slugAlias !== null) {
    return new Response(
      JSON.stringify({ available: false, conflict: { type: "slug_alias", resolves_to: slugAlias } }),
      { status: 200, headers: jsonHeaders() }
    );
  }

  return new Response(
    JSON.stringify({ available: true }),
    { status: 200, headers: jsonHeaders() }
  );
}
