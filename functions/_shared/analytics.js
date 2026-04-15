/**
 * Analytics Engine generic telemetry helper.
 * 
 * Unified Dataset Schema (AE_CONVERSION):
 *   indexes[0]  type          (exposure | click | conversion)
 *   blobs[0]    alias         campaign alias or test name
 *   blobs[1]    variant       variant slug or link_id
 *   blobs[2]    utm_source
 *   blobs[3]    utm_medium
 *   blobs[4]    dest_host     (only populated for outbound clicks)
 */
export function writeClickEvent(env, data) {
  try {
    if (!env?.AE_CONVERSION) return;
    
    // We prioritize experiment alias if available, else generic tracking.
    const campaignOrAlias = data.utm_experiment || data.utm_campaign || data.slug || "";
    const variantOrLinkId = data.utm_variant || data.link_id || "";

    env.AE_CONVERSION.writeDataPoint({
      indexes: ["click"],
      blobs:   [
        String(campaignOrAlias).slice(0, 200),
        String(variantOrLinkId).slice(0, 200),
        String(data.utm_source   || "").slice(0, 200),
        String(data.utm_medium   || "").slice(0, 200),
        String(data.dest_host    || "").slice(0, 500),
      ],
    });
  } catch (_e) {
    // Silent failure
  }
}

