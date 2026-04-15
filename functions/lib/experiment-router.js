/**
 * functions/lib/experiment-router.js — Experiment variant resolution.
 *
 * Extracted from [[path]].js (Prompt 51 — Experiment Router Extraction).
 *
 * Encapsulates all experiment routing responsibilities that previously lived
 * inline in the catch-all handler:
 *
 *   • Lifecycle state gating (DRAFT / RUNNING / PAUSED / DECIDED / ARCHIVED)
 *   • Cookie-based sticky bucketing  (exp_<alias>)
 *   • Deterministic weighted bucket selection via selectABVariant()
 *   • Exposure counter scheduling (returns a Promise for context.waitUntil)
 *   • AB_SELECTED ops telemetry
 *   • Exposure token generation (Prompt 52) — requires EXPOSURE_TOKEN_SECRET
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  Behavior is IDENTICAL to the inline A/B block previously in             │
 * │  [[path]].js.  No routing outcomes, cookies, counters, KV key formats,  │
 * │  or experiment states are changed.                                       │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Exported:
 *   resolveExperimentVariant(request, experimentConfig, env, opts)
 *
 * State machine handled here:
 *   DRAFT    → no-op; return canonical slug, abActive=false
 *   RUNNING  → sticky bucket + exposure counter increment + token
 *   PAUSED   → sticky bucket only; counter frozen; token
 *   DECIDED  → winner fast-path; no cookie; no counter; token
 *   ARCHIVED → winner fast-path; no cookie; no counter; token
 */

import { getExpState, selectABVariant } from "../_shared/ab-router.js";
import { incrementExpCounter }          from "../_shared/exp-counter.js";
import { readCookie, buildSetCookie }   from "../_shared/cookie-utils.js";
import { emitOps, OPS_EVENTS }          from "../_shared/ops-telemetry.js";
import { deriveCampaignFromSlug }       from "../_shared/slug-utils.js";
import { generateExposureToken }        from "./exposure-token.js";

/**
 * Resolve the experiment variant for a public alias request.
 *
 * Caller must have already verified that experimentConfig is non-null.
 * Callers that receive null from loadABConfig() must not invoke this function.
 *
 * @param {Request} request            — incoming HTTP request (for cookie read)
 * @param {object}  experimentConfig   — validated AB config (from loadABConfig); must be non-null
 * @param {object}  env                — Workers env (for KV writes + ops telemetry)
 * @param {object}  opts
 * @param {string}  opts.alias         — experiment alias (cookie naming + counter keys)
 * @param {string}  opts.canonicalSlug — base slug (fallback when no winner is stored)
 * @param {string}  opts.requestId     — cf-ray or crypto.randomUUID() fallback
 * @param {string|null} opts.modifier  — URL path modifier (ops telemetry only)
 *
 * @returns {Promise<{
 *   finalSlug:       string,           — slug to serve (variant or canonical)
 *   variantId:       string,           — selected variant identifier (= finalSlug in this system)
 *   isNewAssignment: boolean,          — true when a fresh variant was selected (cookie must be set)
 *   cookieToSet:     string|null,      — ready-to-use Set-Cookie header value, or null
 *   abActive:        boolean,          — true for non-DRAFT states (UTMs should be appended)
 *   counterPromise:  Promise<void>|null — pass to context.waitUntil(); null when no counter write
 *   expToken:        string|null,      — HMAC-signed exposure token; null when secret not bound
 * }>}
 */
export async function resolveExperimentVariant(request, experimentConfig, env, opts) {
  const { alias, canonicalSlug, requestId, modifier } = opts;
  const expState = getExpState(experimentConfig);

  // ── DRAFT: experiment configured but not yet activated ──────────────────────
  // DRAFT experiments receive no live traffic.  Serve the canonical slug
  // without any variant selection, counters, cookies, or tokens.
  // The config is deliberately ignored until activate() transitions to RUNNING.
  // abActive=false so UTMs are not set and TRAFFIC_MEMORY logs the base slug.
  if (expState === "DRAFT") {
    return {
      finalSlug:       canonicalSlug,
      variantId:       canonicalSlug,
      isNewAssignment: false,
      cookieToSet:     null,
      abActive:        false,
      counterPromise:  null,
      expToken:        null,
    };
  }

  // ── All non-DRAFT states: experiment is active in some form ─────────────────
  let finalSlug      = canonicalSlug;
  let isNewAssignment = false;
  let counterPromise  = null;

  if (expState === "ARCHIVED") {
    // ── ARCHIVED: bypass variant selection — always serve winner ──────────────
    // No counters recorded; cookie not updated.
    const archivedWinner = (typeof experimentConfig.winner === "string" && experimentConfig.winner)
      ? experimentConfig.winner : null;
    finalSlug       = archivedWinner ?? canonicalSlug;
    isNewAssignment = false;

  } else if (expState === "DECIDED") {
    // ── DECIDED fast-path ─────────────────────────────────────────────────────
    // Winner is fixed — bypass all variant selection, cookie, and counter writes.
    // Routing directly to stored winner removes unnecessary KV read-modify-write
    // operations on every request, reducing edge latency for concluded experiments.
    //
    // No counter increment: the experiment decision has already been made;
    // continuing to write exposure counters provides no analytical value and
    // adds hot-key write pressure from all post-decision traffic.
    //
    // Attribution UTMs (utm_experiment / utm_variant) are still appended so
    // downstream analytics can attribute conversions to the winning variant.
    const decidedWinner = (typeof experimentConfig.winner === "string" && experimentConfig.winner)
      ? experimentConfig.winner : null;
    finalSlug       = decidedWinner ?? canonicalSlug;
    isNewAssignment = false;

  } else {
    // ── RUNNING / PAUSED: normal sticky bucketing ─────────────────────────────
    const cookieName    = "exp_" + alias;
    const cookieVariant = readCookie(request, cookieName);
    const validSlugs    = experimentConfig.variants.map((v) => v.slug);

    if (cookieVariant && validSlugs.includes(cookieVariant)) {
      // Returning visitor — honour stored assignment (no new cookie needed)
      finalSlug       = cookieVariant;
      isNewAssignment = false;
    } else {
      // New visitor (or stale/invalid cookie) — pick variant by weight distribution
      finalSlug       = selectABVariant(experimentConfig, requestId);
      isNewAssignment = true;
    }

    // ── Fire-and-forget exposure telemetry (Prompt 56) ────────────────────────
    // Fires GET /t?e=exposure&exp=<alias>&v=<variant> without awaiting so that
    // routing latency is never affected.  keepalive lets the request survive
    // beyond the current fetch lifecycle.  Wrapped in try/catch — telemetry
    // must never throw or affect the caller.
    //
    // Only fires for RUNNING experiments (not PAUSED) to match the counter
    // increment gate below: paused experiments preserve stickiness but freeze
    // data collection.
    if (expState === "RUNNING") {
      try {
        const origin       = new URL(request.url).origin;
        const telemetryUrl = `${origin}/t?e=exposure`
          + `&exp=${encodeURIComponent(alias)}`
          + `&v=${encodeURIComponent(finalSlug)}`;
        fetch(telemetryUrl, { method: "GET", keepalive: true }).catch(() => {});
      } catch (_) { /* fail silently */ }
    }

    emitOps(env, OPS_EVENTS.AB_SELECTED, {
      alias,
      modifier:       modifier ?? "",
      canonical_slug: finalSlug,
      campaign:       deriveCampaignFromSlug(finalSlug),
      request_id:     requestId,
      detail: {
        base_slug:    canonicalSlug,
        variant_slug: finalSlug,
        sticky:       !isNewAssignment,
        state:        expState,
      },
    });

    // PAUSED: variant selection still runs so stickiness is preserved,
    // but exposure counters deliberately freeze (no new data while paused).
    if (expState !== "PAUSED") {
      counterPromise = incrementExpCounter(env, alias, finalSlug, "exposure");
    }
  }

  // Build the cookie header value now so [[path]].js does not need to import
  // cookie-utils — it simply checks cookieToSet !== null.
  const cookieToSet = isNewAssignment
    ? buildSetCookie("exp_" + alias, finalSlug)
    : null;

  // Conversion attribution cookies (Prompt 64).
  // cos_variant and cos_exp persist the active assignment so downstream
  // checkout pages (e.g. Kartra thank-you page) can fire the conversion
  // endpoint (/t?e=conversion) without needing to know the experiment alias.
  //
  // Set on every request when an experiment is active (not just new assignments)
  // so visitors who arrived before P64 also receive the cookies on their next visit.
  // max-age=86400 (24 h) — long enough to survive a typical checkout flow.
  const cosVariantCookie = buildSetCookie("cos_variant", finalSlug, { maxAge: 86400 });
  const cosExpCookie     = buildSetCookie("cos_exp",     alias,      { maxAge: 86400 });

  // Prompt 70 T1 — Experiment attribution cookie: experiment_<alias>
  // Stores { variant, exp, ts } as URI-encoded JSON so the conversion endpoint
  // can resolve the correct variant without the caller knowing it.
  // • httpOnly: false — client JS on thank-you pages must be able to read it.
  // • max-age: 604800 (7 days) — survives multi-day checkout flows.
  // • Do NOT overwrite if already present — preserves the original assignment
  //   even when the visitor returns before the cookie expires.
  const attrCookieName    = "experiment_" + alias;
  const attrCookieExists  = Boolean(readCookie(request, attrCookieName));
  const expAttributionCookie = attrCookieExists ? null : buildSetCookie(
    attrCookieName,
    encodeURIComponent(JSON.stringify({ variant: finalSlug, exp: alias, ts: Math.floor(Date.now() / 1000) })),
    { maxAge: 604800 },
  );

  // Generate an HMAC-signed exposure token (Prompt 52).
  // Token encodes alias + variant + timestamp + nonce; used by /api/convert
  // to verify the conversion originated from a real exposure.
  // Returns null when EXPOSURE_TOKEN_SECRET is not bound (graceful degradation).
  const expToken = await generateExposureToken(alias, finalSlug, env);

  return {
    finalSlug,
    variantId:       finalSlug,   // variant ID is the slug in this system
    isNewAssignment,
    cookieToSet,
    cosVariantCookie,              // cos_variant=<variant>; max-age=86400
    cosExpCookie,                  // cos_exp=<alias>;       max-age=86400
    expAttributionCookie,          // experiment_<alias>=<JSON>; max-age=604800; null when already present
    abActive:        true,
    counterPromise,
    expToken,
  };
}
