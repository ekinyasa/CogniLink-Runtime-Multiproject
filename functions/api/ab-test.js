/**
 * functions/api/ab-test.js — A/B routing diagnostic endpoint.
 *
 * GET /api/ab-test?alias=<alias>
 *
 * Simulates one A/B variant selection for the given alias using a fresh
 * random requestId. Returns routing details for debugging only.
 * This endpoint is read-only and has no side effects.
 *
 * Authentication: Bearer <ADMIN_TOKEN>
 *
 * Response 200:
 *   {
 *     alias:          "ab26",
 *     canonical_slug: "cd26-igbio",   // compiled route from ROUTE_ALIAS (null if not compiled)
 *     final_slug:     "cd26-yt",      // A/B selected variant for this simulated request
 *     variant:        "B",            // letter: first variant → A, second → B, …
 *     bucket:         73              // 0–99 bucket derived from simulated requestId
 *   }
 *
 * Response 404:
 *   { error: "no_ab_config" }        // no A/B config stored for this alias
 */

import { verifyToken, unauthorized }     from "../_shared/auth.js";
import { validateAlias }                 from "../_shared/validators.js";
import { loadABConfig, selectABVariant } from "../_shared/ab-router.js";

const JSON_HEADERS = {
  "Content-Type":           "application/json;charset=UTF-8",
  "Cache-Control":          "no-store",
  "X-Content-Type-Options": "nosniff",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await verifyToken(request, env))) return unauthorized();

  const url   = new URL(request.url);
  const alias = (url.searchParams.get("alias") || "").toLowerCase().trim();

  if (!alias || !validateAlias(alias)) return json({ error: "invalid_alias" }, 400);

  // Canonical slug: compiled route from ROUTE_ALIAS for this alias
  let canonicalSlug = null;
  try {
    if (env.ROUTE_ALIAS) {
      canonicalSlug = await env.ROUTE_ALIAS.get(`route:${alias}`, { type: "text" });
    }
  } catch (_) {}

  // Load A/B config (returns null when no config exists or config is invalid)
  const abConfig = await loadABConfig(alias, env);
  if (!abConfig) return json({ error: "no_ab_config" }, 404);

  // Simulate routing with a fresh random requestId
  const requestId = (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : Math.random().toString(16).slice(2);

  const finalSlug     = selectABVariant(abConfig, requestId);
  const variantIdx    = abConfig.variants.findIndex(v => v.slug === finalSlug);
  const variantLetter = variantIdx >= 0 ? String.fromCharCode(65 + variantIdx) : "?";

  // Bucket derivation mirrors selectABVariant internals for transparency
  const hex    = String(requestId).replace(/[^0-9a-f]/gi, "").slice(-8) || "0";
  const bucket = parseInt(hex, 16) % 100;

  return json({
    alias,
    canonical_slug: canonicalSlug ?? null,
    final_slug:     finalSlug,
    variant:        variantLetter,
    bucket,
  });
}
