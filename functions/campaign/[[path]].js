/**
 * functions/campaign/[[path]].js — Campaign redirect catch-all router.
 *
 * URL grammar:
 *   /campaign/<alias>/<link-id>
 *
 *   alias   — campaign alias  (e.g. "spring-2026-youtube")
 *   link-id — link identifier (e.g. "official")
 *
 * KV lookup chain (SLUG_LINKS):
 *   alias:<alias>              → campaign id   (e.g. "spring-2026")
 *   link:<campaign>:<link-id>  → string URL  OR  JSON metadata object
 *
 * Link KV value formats (both supported):
 *   Plain string : "https://example.com"
 *   JSON object  : { "destination": "https://...", "utm": { source, medium, campaign }, "experiment": null }
 *
 * Responses:
 *   Both resolved           → 302 final URL (with UTM params if metadata present)
 *   path segments !== 2     → 400 "invalid route"
 *   alias not in KV         → 404 "alias not found"
 *   link not in KV          → 404 "link not found"
 */

export async function onRequest(context) {
  const { env, params } = context;

  // ── 1. Safe path parsing ────────────────────────────────────────────────────
  // context.params.path may be a string ("alias/link") or an array (["alias","link"])
  // depending on the Cloudflare Pages runtime version. Handle both defensively.
  const raw = context.params?.path;

  let segments;
  if (Array.isArray(raw)) {
    segments = raw;
  } else if (typeof raw === "string") {
    segments = raw.split("/").filter(Boolean);
  } else {
    segments = [];
  }

  if (segments.length !== 2) {
    return new Response("invalid route", { status: 400 });
  }

  const [alias, linkId] = segments;

  // ── 2. Alias lookup ─────────────────────────────────────────────────────────
  const campaign = await env.SLUG_LINKS.get(`alias:${alias}`);

  if (!campaign) {
    return new Response("alias not found", { status: 404 });
  }

  // ── 3. Link lookup ──────────────────────────────────────────────────────────
  const linkRaw = await env.SLUG_LINKS.get(`link:${campaign}:${linkId}`);

  if (!linkRaw) {
    return new Response("link not found", { status: 404 });
  }

  // ── 4. Backward-compatible destination resolution ───────────────────────────
  // KV value may be a plain string URL (legacy) or a JSON metadata object (new).
  // parsed is kept in outer scope so UTM orchestration (Step 5) can access it.
  let destination;
  let parsed = null;

  try {
    parsed = JSON.parse(linkRaw);

    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.destination === "string"
    ) {
      destination = parsed.destination;
    } else {
      // Valid JSON but not a recognised metadata shape — treat raw value as URL
      destination = linkRaw;
      parsed = null;
    }
  } catch {
    // Not JSON — plain string URL (legacy format)
    destination = linkRaw;
    parsed = null;
  }

  // ── 5. UTM orchestration ────────────────────────────────────────────────────
  // Append utm_source / utm_medium / utm_campaign when metadata contains a utm
  // object. Legacy string links (parsed === null) skip this step entirely.
  let finalUrl = destination;

  if (parsed && typeof parsed === "object" && parsed.utm) {
    const utm = parsed.utm;

    const utmParams = new URLSearchParams();

    if (utm.source)   utmParams.append("utm_source",   utm.source);
    if (utm.medium)   utmParams.append("utm_medium",   utm.medium);
    if (utm.campaign) utmParams.append("utm_campaign", utm.campaign);

    const query = utmParams.toString();

    if (query) {
      finalUrl += destination.includes("?") ? `&${query}` : `?${query}`;
    }
  }

  // ── 6. Telemetry (console only — no storage) ────────────────────────────────
  console.log(JSON.stringify({
    event:    "campaign_redirect",
    alias,
    campaign,
    linkId,
  }));

  // ── 7. Redirect ─────────────────────────────────────────────────────────────
  return Response.redirect(finalUrl, 302);
}
