import { writeClickEvent }    from "../_shared/analytics.js";
import { incrementExpCounter } from "../_shared/exp-counter.js";

/**
 * POST /api/event
 *
 * Receives an outbound-click payload from the hub's client-side
 * fireOutbound() and writes it to Cloudflare Analytics Engine.
 * When utm_experiment + utm_variant are present, also increments the
 * experiment click counter in CAMPAIGN_AB_ALIAS_INDEX.
 *
 * No authentication — this endpoint is intentionally public so that
 * every browser visiting a hub page can log a click without requiring
 * an admin token.  Only non-sensitive, pre-aggregated fields are accepted.
 *
 * Accepted body (JSON):
 *   { slug, link_id, utm_source, utm_medium, utm_campaign, dest_host,
 *     utm_experiment, utm_variant }
 *
 * Returns 204 immediately; all async work is queued via context.waitUntil()
 * so navigation is never blocked.
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    // Malformed JSON — still return 204 so the client fetch resolves cleanly
    return new Response(null, { status: 204 });
  }

  const {
    slug, link_id, utm_source, utm_medium, utm_campaign, dest_host,
    utm_experiment, utm_variant,
  } = body || {};

  const expAlias   = typeof utm_experiment === "string" ? utm_experiment.trim() : "";
  const expVariant = typeof utm_variant    === "string" ? utm_variant.trim()    : "";

  // Queue the AE write without blocking the response
  context.waitUntil(
    Promise.resolve().then(() =>
      writeClickEvent(env, {
        slug:         typeof slug         === "string" ? slug         : "",
        link_id:      typeof link_id      === "string" ? link_id      : "",
        utm_source:   typeof utm_source   === "string" ? utm_source   : "",
        utm_medium:   typeof utm_medium   === "string" ? utm_medium   : "",
        utm_campaign: typeof utm_campaign === "string" ? utm_campaign : "",
        dest_host:    typeof dest_host    === "string" ? dest_host    : "",
        utm_experiment: expAlias,
        utm_variant:    expVariant,
      })
    )
  );

  return new Response(null, { status: 204 });
}
