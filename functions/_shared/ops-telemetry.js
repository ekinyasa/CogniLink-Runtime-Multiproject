/**
 * ops-telemetry.js — Structured operational telemetry emitter.
 *
 * Writes to the AE_TRAFFIC Analytics Engine dataset.
 * This dataset is SEPARATE from the marketing clickstream (AE_CONVERSION).
 * These two datasets must NEVER be mixed.
 *
 * If AE_TRAFFIC is not bound (e.g. local dev / preview), all events are
 * still emitted as structured JSON via console.log / console.error for
 * Logpush-compatible capture.
 *
 * Required env binding (wrangler.toml):
 *   [[analytics_engine_datasets]]
 *   binding = "AE_TRAFFIC"
 *   dataset = "linkhub_ops_events"
 *
 * Analytics Engine layout:
 *   indexes[0]  = event name              (e.g. "route_resolved")
 *   blobs[0]    = alias                   (public URL segment)
 *   blobs[1]    = canonical_slug          (resolved identity)
 *   blobs[2]    = modifier                (public URL segment, if present)
 *   blobs[3]    = campaign                (derived from slug; for analytics grouping)
 *   blobs[4]    = reason                  (for ops failures — empty on success)
 *   blobs[5]    = request_id              (cf-ray or generated UUID)
 *   blobs[6]    = detail                  (JSON string of extra fields)
 *
 * Note: blobs[3] changed from "actor" to "campaign" in 08.md.
 *   Ops mutation events (ALIAS_ATTACH etc.) now store actor in blobs[6] detail.
 */

// ── Event name constants ──────────────────────────────────────────────────────

export const OPS_EVENTS = Object.freeze({
  // Routing outcomes
  ROUTE_SUCCESS:                    "route_success",
  ROUTE_RESOLVED:                   "route_resolved",
  ROUTE_FAIL_UNKNOWN_ALIAS:         "route_fail_unknown_alias",
  ROUTE_FAIL_UNKNOWN_MODIFIER:      "route_fail_unknown_modifier",
  ROUTE_FAIL_REGISTRY_INCONSISTENT: "route_fail_registry_inconsistent",

  // Click analytics (emitted on every successful alias resolution)
  ALIAS_CLICK:                      "alias_click",

  // Traffic memory — emitted in [[path]].js AFTER A/B variant selection so it
  // always records the final slug actually served (not the ROUTE_ALIAS base slug).
  // Separate event type so routing intelligence queries are isolated from ops events.
  // Fields: alias, modifier, canonical_slug (= final slug), campaign, request_id.
  // detail: { ab_base: baseSlug } present when A/B routing was active.
  // Queryable via: WHERE index1 = 'traffic_memory' AND blob1 = '<alias>'
  TRAFFIC_MEMORY:                   "traffic_memory",

  // A/B routing selection — emitted once per request when an alias has an active
  // A/B config. Records both the base slug (from ROUTE_ALIAS) and the variant
  // slug (selected by selectABVariant). Queryable for experiment analysis:
  //   WHERE index1 = 'ab_selected' AND blob1 = '<alias>'
  //   → GROUP BY blob2 to see variant distribution
  AB_SELECTED:                      "ab_selected",

  // Override / cache signals
  ALIAS_OVERRIDE_HIT:               "alias_override_hit",
  CACHE_HIT:                        "cache_hit",
  CACHE_MISS:                       "cache_miss",

  // Ops mutation events (emitted by /_ops/* endpoints if implemented)
  ALIAS_ATTACH:                     "alias_attach",
  ALIAS_DETACH:                     "alias_detach",
  ALIAS_REASSIGN:                   "alias_reassign_event",
  DEFAULT_CHANNEL_CHANGE:           "default_channel_change",
});

// ── Emitter ───────────────────────────────────────────────────────────────────

/**
 * Emit a structured ops telemetry event.
 *
 * Failures in this function must NEVER propagate — telemetry is best-effort.
 *
 * @param {object} env         — Workers env
 * @param {string} event       — one of OPS_EVENTS values
 * @param {object} [fields]
 * @param {string} [fields.alias]
 * @param {string} [fields.canonical_slug]
 * @param {string} [fields.modifier]
 * @param {string} [fields.campaign]       — blobs[3]: campaign derived from slug
 * @param {string} [fields.reason]
 * @param {string} [fields.request_id]
 * @param {object} [fields.detail]   — arbitrary extra data (serialised to JSON)
 */
export function emitOps(env, event, fields = {}) {
  const {
    alias          = "",
    canonical_slug = "",
    modifier       = "",
    campaign       = "",
    utm_source     = "",
    utm_medium     = "",
    reason         = "",
    request_id     = "",
    detail         = null,
    decision_v1    = "",
    decision_v2    = "",
  } = fields;

  // ── Structured console log (always; Logpush-compatible) ───────────────────
  const payload = {
    ops_event:  event,
    alias,
    canonical_slug,
    modifier,
    campaign,
    utm_source,
    utm_medium,
    reason,
    request_id,
    ts: new Date().toISOString(),
    ...(detail ? { detail } : {}),
  };

  const isError = (
    event === OPS_EVENTS.ROUTE_FAIL_UNKNOWN_ALIAS         ||
    event === OPS_EVENTS.ROUTE_FAIL_UNKNOWN_MODIFIER      ||
    event === OPS_EVENTS.ROUTE_FAIL_REGISTRY_INCONSISTENT
  );

  if (isError) {
    console.error("[ops]", JSON.stringify(payload));
  } else {
    console.log("[ops]", JSON.stringify(payload));
  }

  // ── Analytics Engine write (fire-and-forget) ──────────────────────────────
  try {
    if (!env?.AE_TRAFFIC) return;   // not bound in local/preview — that's ok
    env.AE_TRAFFIC.writeDataPoint({
      indexes: [String(event).slice(0, 200)],
      blobs: [
        String(alias).slice(0, 200),           // blob1: alias
        String(canonical_slug).slice(0, 200),  // blob2: canonical_slug
        String(modifier).slice(0, 200),        // blob3: modifier
        String(campaign).slice(0, 200),        // blob4: campaign
        String(utm_source).slice(0, 200),      // blob5: utm_source
        String(utm_medium).slice(0, 200),      // blob6: utm_medium
        String(request_id).slice(0, 200),      // blob7: request_id
        detail ? JSON.stringify(detail).slice(0, 1000) : (reason ? String(reason).slice(0, 500) : ""),  // blob8: detail/reason
        "",                                    // blob9: (reserved)
        "",                                    // blob10: (reserved)
        String(decision_v1).slice(0, 200),     // blob11: decision_v1
        String(decision_v2).slice(0, 200),     // blob12: decision_v2
      ],
    });
  } catch (_e) {
    // Telemetry errors must never affect routing — log for Logpush visibility (SECTION 4)
    console.error("[ops] writeDataPoint failed:", _e?.message);
  }
}
