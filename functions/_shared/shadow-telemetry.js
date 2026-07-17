/**
 * shadow-telemetry.js — Structured Shadow Validation Telemetry
 * 
 * Writes shadow pipeline evaluation results to AE_TRAFFIC to compute
 * the mismatch rate without affecting production performance.
 */

export const SHADOW_EVENTS = Object.freeze({
  EVALUATION: "shadow_evaluation",
  MISMATCH:   "shadow_mismatch"
});

/**
 * Fast deterministic string hash
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
  }
  return Math.abs(hash);
}

/**
 * Emits shadow telemetry events to AE_TRAFFIC.
 */
export function emitShadowTelemetry(env, request, payloadData) {
  // 1. Feature Flag Checks
  const enabled = String(env.SHADOW_TELEMETRY_ENABLED) === "true";
  if (!enabled) return { enabled: false };

  let sampleRate = 0.1;
  if (env.SHADOW_TELEMETRY_SAMPLE_RATE !== undefined) {
    const parsed = parseFloat(env.SHADOW_TELEMETRY_SAMPLE_RATE);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
      sampleRate = parsed;
    }
  }

  const {
    slug = "",
    routeType = "",
    runtimeContext = null,
    runtimeDiff = null,
    ruleShadow = null,
    decisionShadow = null,
    exception = null,
    request_id = "",
    uid = ""
  } = payloadData;

  // 2. Mismatch Detection
  let isMismatch = false;
  const mismatchCategories = new Set();
  
  if (exception) {
    isMismatch = true;
    mismatchCategories.add("exception");
  } else if (!runtimeContext) {
    isMismatch = true;
    mismatchCategories.add("context_failure");
  } else if (runtimeDiff && runtimeDiff.identical === false) {
    isMismatch = true;
    // Extract canonical categories from diff items
    if (Array.isArray(runtimeDiff.items)) {
      for (const item of runtimeDiff.items) {
        if (!item.field) continue;
        const field = item.field;
        if (field === "pageContent.id") mismatchCategories.add("identity");
        else if (field === "pageContent.custom_html") mismatchCategories.add("html");
        else if (field === "pageContent.custom_css" || field === "pageContent.custom_font") mismatchCategories.add("css");
        else if (field === "pageContent.layout") mismatchCategories.add("layout");
        else if (field.startsWith("pageContent.components")) mismatchCategories.add("components");
        else if (field === "activeLinks") mismatchCategories.add("links");
        else if (field === "campaignContext.name") mismatchCategories.add("campaign");
        else if (field.startsWith("metadata")) mismatchCategories.add("metadata");
        else mismatchCategories.add("unknown");
      }
    } else {
      mismatchCategories.add("unknown");
    }
  }

  // 3. Deterministic Sampling
  // Use UID if available, else request_id
  const identity = uid || request_id || "unknown";
  const hashVal = hashString(identity);
  // Max 32-bit int is 2147483647
  const hashRate = hashVal / 2147483647;
  const isSampled = hashRate <= sampleRate || sampleRate === 1;

  // 4. Prepare Event Emission
  const eventsToEmit = [];
  
  // Mismatch is ALWAYS emitted if enabled
  if (isMismatch) {
    eventsToEmit.push(SHADOW_EVENTS.MISMATCH);
  }
  
  // Evaluation is emitted if sampled
  if (isSampled) {
    eventsToEmit.push(SHADOW_EVENTS.EVALUATION);
  }

  const resultMeta = {
    enabled: true,
    sample_rate: sampleRate,
    evaluation_sampled: isSampled,
    mismatch_detected: isMismatch,
    mismatch_categories: Array.from(mismatchCategories)
  };

  if (eventsToEmit.length === 0) {
    return resultMeta;
  }

  // 5. Fire-and-forget Write
  try {
    const detail = {
      mismatch_count: runtimeDiff?.items?.length || 0,
      mismatch_categories: resultMeta.mismatch_categories,
      rule_source: ruleShadow?.source || "none",
      matched_rule_id: decisionShadow?.matched_rule_id || "none",
      source_schema: runtimeContext?.metadata?.source_schema || "unknown",
      runtime_version: "adapter",
      render_mode: runtimeContext?.render_mode || "canonical"
    };

    const dataset = env.AE_TRAFFIC || env.AE_SHADOW_LOGS;
    if (dataset) {
      for (const ev of eventsToEmit) {
        dataset.writeDataPoint({
          indexes: [ev],
          blobs: [
            slug.slice(0, 200),
            routeType.slice(0, 200),
            request_id.slice(0, 200),
            JSON.stringify(detail).slice(0, 1000)
          ]
        });
      }
    } else {
      // Logpush fallback
      for (const ev of eventsToEmit) {
        console.log(`[shadow-telemetry] ${ev}:`, JSON.stringify({ slug, routeType, request_id, detail }));
      }
    }
  } catch (e) {
    console.error("[shadow-telemetry] Emission error:", e);
  }

  return resultMeta;
}
