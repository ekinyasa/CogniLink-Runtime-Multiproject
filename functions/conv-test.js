/**
 * functions/conv-test.js — Conversion testing helper endpoint.
 *
 * GET /conv-test
 *
 * Reads cos_exp and cos_variant cookies (set by the experiment router on
 * variant assignment) and redirects to the telemetry endpoint with those
 * values pre-populated as a conversion event.
 *
 * This allows manual end-to-end testing of the conversion pipeline directly
 * from the browser without waiting for a real purchase on Kartra:
 *
 *   1. Open experiment alias URL  →  cookie cos_exp + cos_variant are written
 *   2. Open /conv-test            →  redirects to /t?e=conversion&exp=…&v=…
 *   3. /t records the conversion  →  admin panel counter increments
 *
 * Prompt 67 S6 — Cookie resolution guard:
 *   If cos_exp OR cos_variant cookie is absent, returns a 200 "no attribution"
 *   page rather than firing an empty conversion event.  This prevents false
 *   attribution when the page is opened without an active experiment session.
 *
 *   Optional utm_campaign and utm_content URL params are forwarded to /t so
 *   future analytics can attribute conversions to campaign/content dimensions.
 *
 * Prompt 64 — Task 4 | Prompt 67 — Section 6.
 */

export async function onRequestGet(context) {
  const { request } = context;

  // ── Read cos_exp and cos_variant from Cookie header ────────────────────────
  const cookieHeader = request.headers.get("Cookie") || "";

  /**
   * Minimal inline cookie reader — avoids importing cookie-utils for this
   * single-purpose endpoint.
   *
   * @param {string} name
   * @returns {string|null}
   */
  const getCookie = (name) => {
    const match = cookieHeader.match(
      new RegExp(`(?:^|;\\s*)${name}=([^;]*)`)
    );
    return match ? decodeURIComponent(match[1]) : null;
  };

  const cosExp     = getCookie("cos_exp");
  const cosVariant = getCookie("cos_variant");

  // ── Guard: require both cookies (Prompt 67 S6) ────────────────────────────
  // If either is absent there is no valid attribution context.
  // Return a 200 informational response instead of firing a spurious event.
  if (!cosExp || !cosVariant) {
    return new Response(
      "No attribution cookies found (cos_exp / cos_variant). Open an experiment URL first.",
      {
        status:  200,
        headers: { "Content-Type": "text/plain;charset=UTF-8", "Cache-Control": "no-store" },
      }
    );
  }

  // ── Build telemetry redirect URL ───────────────────────────────────────────
  const reqUrl = new URL(request.url);

  let telemetryUrl = "/t?e=conversion";
  telemetryUrl += `&exp=${encodeURIComponent(cosExp)}`;
  telemetryUrl += `&v=${encodeURIComponent(cosVariant)}`;

  // Forward optional utm_campaign / utm_content from the request URL params
  // (future: these will also be readable from cookies set by the hub router)
  const utmCampaign = reqUrl.searchParams.get("utm_campaign");
  const utmContent  = reqUrl.searchParams.get("utm_content");
  if (utmCampaign) telemetryUrl += `&campaign=${encodeURIComponent(utmCampaign)}`;
  if (utmContent)  telemetryUrl += `&content=${encodeURIComponent(utmContent)}`;

  // Resolve to an absolute URL so Response.redirect() works in all runtimes
  const absolute = new URL(telemetryUrl, request.url).href;

  return Response.redirect(absolute, 302);
}
