/**
 * functions/api/convert.js — Conversion event endpoint.
 *
 * POST /api/convert
 *
 * Receives a conversion event from a landing or checkout page and increments
 * the corresponding experiment variant conversion counter in ANALITICS_DATA.
 *
 * No authentication — this endpoint is intentionally public so landing pages
 * can call it from the browser without an admin token. Only experiment/variant
 * identifiers are accepted (no PII). Each request is validated against the
 * live A/B config so only known experiments and variants can be recorded.
 *
 * CORS headers are included so cross-origin landing pages can call this
 * endpoint directly from the browser.
 *
 * Accepted body (JSON):
 *   { event: string, experiment: string, variant: string, exp_token?: string,
 *     order_id?: string }
 *   event       — conversion event name (e.g. "signup", "purchase") — logged only
 *   experiment  — A/B alias (must exist in AB_INDEX)
 *   variant     — variant slug (must belong to the experiment)
 *   exp_token   — HMAC-signed exposure token from the hub page link (Prompt 52)
 *                 Required when EXPOSURE_TOKEN_SECRET is bound; ignored otherwise.
 *   order_id    — (optional) checkout order / transaction ID — logged only, not stored.
 *                 Prep for Kartra / checkout system integration (Prompt 67 S7).
 *
 * Token validation (when EXPOSURE_TOKEN_SECRET is bound):
 *   1. Parse exp_token from request body.
 *   2. Verify HMAC-SHA256 signature (constant-time via Web Crypto).
 *   3. Validate timestamp (max age: 24h; reject future timestamps within 5 min).
 *   4. Verify alias + variant match the conversion request fields.
 *   5. Replay protection: check/write "exp_used:<nonce>" in GUARD_CACHE (24h TTL).
 *
 * Returns 204 on success; 400/404 on validation failure.
 *
 * Integration snippet for landing pages (updated for Prompt 52):
 *
 *   var utmExperiment = new URLSearchParams(location.search).get("utm_experiment") || "";
 *   var utmVariant    = new URLSearchParams(location.search).get("utm_variant")    || "";
 *   var expToken      = new URLSearchParams(location.search).get("exp_token")      || "";
 *   if (utmExperiment && utmVariant) {
 *     fetch("https://links.niluferormanli.studio/api/convert", {
 *       method:  "POST",
 *       headers: { "Content-Type": "application/json" },
 *       body:    JSON.stringify({
 *         event:      "signup",
 *         experiment: utmExperiment,
 *         variant:    utmVariant,
 *         exp_token:  expToken,
 *       }),
 *     });
 *   }
 */

import { validateAlias }          from "../_shared/validators.js";
import { loadABConfig }           from "../_shared/ab-router.js";
import { incrementExpCounter }    from "../_shared/exp-counter.js";
import { verifyExposureToken }    from "../lib/exposure-token.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const JSON_HEADERS = {
  "Content-Type":           "application/json;charset=UTF-8",
  "Cache-Control":          "no-store",
  "X-Content-Type-Options": "nosniff",
  ...CORS_HEADERS,
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

// Handle CORS preflight
export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const {
    event      = "",
    experiment = "",
    variant    = "",
    exp_token  = "",
    order_id   = "",
    utm_source = "",
    utm_medium = "",
  } = body || {};

  const expAlias   = typeof experiment === "string" ? experiment.trim().toLowerCase() : "";
  const expVariant = typeof variant    === "string" ? variant.trim().toLowerCase()    : "";
  const expToken   = typeof exp_token  === "string" ? exp_token.trim()               : "";
  const utmSource  = typeof utm_source === "string" ? utm_source.trim()              : "";
  const utmMedium  = typeof utm_medium === "string" ? utm_medium.trim()              : "";

  if (!expAlias || !expVariant) {
    return json({ error: "missing_fields" }, 400);
  }

  // Validate alias format before touching KV
  if (!validateAlias(expAlias)) {
    return json({ error: "invalid_alias" }, 400);
  }

  // ── Experiment resolution ─────────────────────────────────────────────────
  // Step 1 — treat experiment param as an alias directly.
  // Step 2 — if not found, look up CAMPAIGN_INDEX by campaign name (O(1)).
  //   Campaign records carry an `alias` field written at creation time, giving
  //   a direct name → alias mapping with no KV scans or slug parsing.
  //   This lets callers send either the alias ("abrand45") or the campaign name
  //   ("ab-rand-45") and get the same result.
  let resolvedAlias = expAlias;
  let abConfig = await loadABConfig(expAlias, env);

  if (!abConfig && env.CAMPAIGN_INDEX) {
    try {
      const campaignRecord = await env.CAMPAIGN_INDEX.get(expAlias, { type: "json" });
      if (campaignRecord?.alias) {
        resolvedAlias = campaignRecord.alias;
        abConfig      = await loadABConfig(resolvedAlias, env);
      }
    } catch (_) {
      // CAMPAIGN_INDEX read failure is non-fatal — experiment_not_found below
    }
  }

  if (!abConfig) {
    return json({ error: "experiment_not_found" }, 404);
  }

  const validSlugs = abConfig.variants.map((v) => v.slug);
  // We'll perform final variant check after token validation.

  // ── Exposure token validation (Prompt 52) ─────────────────────────────────
  // Active when EXPOSURE_TOKEN_SECRET is bound.  Disabled (no-op) when absent
  // so existing deployments continue working before the secret is configured.
  if (env.EXPOSURE_TOKEN_SECRET) {
    // Token is required when the secret is configured
    if (!expToken) {
      return json({ error: "token_required" }, 400);
    }

    // Verify HMAC signature, timestamp, and alias/variant binding
    // If the client's variant param is mismatched (often happens with URL masking),
    // we use the variant from the signed token if it's valid.
    const verification = await verifyExposureToken(expToken, resolvedAlias, expVariant, env);
    
    // If the first attempt failed due to variant mismatch, try again with no variant check
    // to see if we can extract it from the token payload (Prompt 130).
    let finalVariant = expVariant;
    if (!verification.ok && verification.reason === "token_variant_mismatch") {
      try {
        const parts = expToken.split(".");
        const payload = JSON.parse(atob(parts[0].replace(/-/g, "+").replace(/_/g, "/")));
        if (payload.variant && validSlugs.includes(payload.variant)) {
          const retry = await verifyExposureToken(expToken, resolvedAlias, payload.variant, env);
          if (retry.ok) {
            verification.ok = true;
            verification.nonce = retry.nonce;
            finalVariant = payload.variant;
          }
        }
      } catch (_) {}
    }

    if (!verification.ok) {
      return json({ error: "token_invalid", reason: verification.reason }, 400);
    }
    
    // Update the variant to the one confirmed by the token
    body.variant = finalVariant; 
    
    // ── Replay protection ───────────────────────────────────────────────────
    // Each token carries a unique cryptographic nonce.  We write the nonce
    // to KV with the same TTL as the token max age (24h) and reject the
    // conversion if the nonce was already used.
    // Uses GUARD_CACHE — dedicated namespace for replay-protection keys.
    if (env.GUARD_CACHE) {
      const usedKey = "exp_used:" + verification.nonce;

      let alreadyUsed = false;
      try {
        alreadyUsed = (await env.GUARD_CACHE.get(usedKey)) !== null;
      } catch (_) {
        // KV read failure is non-fatal — allow conversion to proceed
        // (prefer accepting a potential replay over blocking a real conversion)
      }

      if (alreadyUsed) {
        return json({ error: "token_already_used" }, 400);
      }

      // Mark token nonce as used (fire-and-forget, does not block 204 response)
      context.waitUntil(
        env.GUARD_CACHE.put(usedKey, "1", { expirationTtl: 86400 }).catch(() => {}),
      );
    }
  }

  const actualVariant = body.variant || expVariant;
  if (!validSlugs.includes(actualVariant)) {
    return json({ error: "variant_not_found" }, 404);
  }

  const orderId = typeof order_id === "string" ? order_id.trim().slice(0, 128) : "";

  // Increment conversion counter — fire-and-forget, does not block response
  // Always write under resolvedAlias so the key matches the exposure counters.
  context.waitUntil(incrementExpCounter(env, resolvedAlias, actualVariant, "conversion", orderId, utmSource, utmMedium));
  console.log("[convert]", JSON.stringify({
    experiment:     resolvedAlias,
    ...(resolvedAlias !== expAlias ? { experiment_input: expAlias } : {}),
    variant:        expVariant,
    event:          typeof event === "string" ? event.slice(0, 64) : "",
    token_verified: !!env.EXPOSURE_TOKEN_SECRET,
    ...(orderId ? { order_id: orderId } : {}),
  }));

  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
