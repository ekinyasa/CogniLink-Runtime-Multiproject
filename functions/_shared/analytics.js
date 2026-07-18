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

export function writePageViewEvent(env, data) {
  try {
    if (!env?.AE_TRAFFIC) return;
    const campaignOrAlias = data.utm_campaign || data.slug || "";
    const source = data.utm_source || "";
    const pageType = data.page_type || "";

    env.AE_TRAFFIC.writeDataPoint({
      indexes: ["traffic_memory"],
      blobs: [
        String(campaignOrAlias).slice(0, 200),
        String(pageType).slice(0, 200),
        "",
        String(campaignOrAlias).slice(0, 200),
        String(source).slice(0, 200)
      ]
    });
  } catch (_e) {
    // Silent failure
  }
}

export function writeLandingSignalEvent(env, data) {
  try {
    if (!env?.AE_CONVERSION) return;
    const type = data.type || "signal";
    const campaignAlias = String(data.meta?.campaign || data.meta?.alias || "");
    const sourceData = String(data.meta?.source || "");
    const pageType = String(data.meta?.page_type || "");

    if (type === "conversion") {
      env.AE_CONVERSION.writeDataPoint({
        indexes: ["conversion"],
        blobs: [campaignAlias, pageType, sourceData, "", ""]
      });
    } else {
      env.AE_CONVERSION.writeDataPoint({
        indexes: ["click"],
        blobs: [campaignAlias, type, sourceData, "", ""]
      });
    }
  } catch (_e) {
    // Silent failure
  }
}

