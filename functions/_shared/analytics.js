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
    const alias = data.alias || data.utm_campaign || data.slug || "";
    const slug = data.slug || data.canonical_slug || data.page_type || "";
    const modifier = data.modifier || "";
    const campaign = data.campaign || data.utm_campaign || data.slug || "";
    const source = data.utm_source || data.source || "";
    const medium = data.utm_medium || data.medium || "";
    const requestId = data.request_id || "";

    env.AE_TRAFFIC.writeDataPoint({
      indexes: ["traffic_memory"],
      blobs: [
        String(alias).slice(0, 200),          // blob1: alias
        String(slug).slice(0, 200),           // blob2: canonical_slug
        String(modifier).slice(0, 200),       // blob3: modifier
        String(campaign).slice(0, 200),       // blob4: campaign
        String(source).slice(0, 200),         // blob5: utm_source
        String(medium).slice(0, 200),         // blob6: utm_medium
        String(requestId).slice(0, 200)       // blob7: request_id
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
    const pageType = String(data.meta?.page_type || data.meta?.form_id || "");

    if (type === "conversion") {
      env.AE_CONVERSION.writeDataPoint({
        indexes: ["conversion"],
        blobs: [campaignAlias, pageType, sourceData, "", ""]
      });
    } else if (type === "click" || type.startsWith("click")) {
      env.AE_CONVERSION.writeDataPoint({
        indexes: ["click"],
        blobs: [campaignAlias, pageType || type, sourceData, "", ""]
      });
    } else {
      // Behavioral signals: "engagement", "time_signal", "scroll", "form_submit", etc.
      // Must NOT be stored with index1 = "click" or index1 = "conversion".
      env.AE_CONVERSION.writeDataPoint({
        indexes: ["signal"],
        blobs: [campaignAlias, type, sourceData, "", ""]
      });
    }
  } catch (_e) {
    // Silent failure
  }
}

/**
 * Supported production dataset names per project.
 */
export const PROJECT_AE_DATASETS = {
  nilufer: {
    traffic: "cognilink_nilufer_traffic_prod",
    conversion: "cognilink_nilufer_conversion_prod",
    experiment: "cognilink_nilufer_experiment_prod",
  },
  runtime: {
    traffic: "cognilink_runtime_traffic_prod",
    conversion: "cognilink_runtime_conversion_prod",
    experiment: "cognilink_runtime_experiment_prod",
  },
};

/**
 * Resolves project identity based on env.PROJECT_ID and env.ROOT_DOMAIN.
 * Throws explicit errors on missing or contradictory configuration.
 */
export function resolveProjectId(env = {}) {
  const envName = (env.ENV_NAME || "dev").toLowerCase();
  const isProd = envName === "production" || envName === "prod";

  const rawProjectId = typeof env.PROJECT_ID === "string" ? env.PROJECT_ID.trim().toLowerCase() : "";
  const rawDomain = typeof env.ROOT_DOMAIN === "string" ? env.ROOT_DOMAIN.trim().toLowerCase() : "";

  if (rawProjectId) {
    if (rawProjectId === "nilufer") {
      if (rawDomain && !rawDomain.includes("nilufer") && (rawDomain.includes("teklifi") || rawDomain.includes("runtime"))) {
        throw new Error(`Contradictory project configuration: PROJECT_ID is 'nilufer' but ROOT_DOMAIN is '${env.ROOT_DOMAIN}'`);
      }
      return "nilufer";
    }
    if (rawProjectId === "runtime") {
      if (rawDomain && rawDomain.includes("nilufer")) {
        throw new Error(`Contradictory project configuration: PROJECT_ID is 'runtime' but ROOT_DOMAIN is '${env.ROOT_DOMAIN}'`);
      }
      return "runtime";
    }
    throw new Error(`Unknown or unsupported PROJECT_ID: '${env.PROJECT_ID}'`);
  }

  // If PROJECT_ID not explicitly provided, try to infer safely from ROOT_DOMAIN
  if (rawDomain.includes("nilufer")) {
    return "nilufer";
  }
  if (rawDomain.includes("teklifi")) {
    return "runtime";
  }

  if (isProd) {
    throw new Error("Missing project configuration: PROJECT_ID is not configured for production environment");
  }

  return null;
}

/**
 * Validates a dataset override:
 * 1. Valid SQL identifier syntax (1-64 chars, alphanumeric + underscores, cannot start with a digit).
 * 2. Explicit project ownership in production (nilufer -> 'cognilink_nilufer_' or 'nilufer_'; runtime -> 'cognilink_runtime_' or 'runtime_').
 * 3. Environment isolation (non-production environments cannot target production _prod datasets).
 */
export function validateDatasetOverride(overrideVal, projectId, isProd, envName) {
  if (!overrideVal || typeof overrideVal !== "string") {
    throw new Error("Dataset override must be a non-empty string");
  }

  // 1. Valid SQL identifier syntax
  if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/.test(overrideVal)) {
    throw new Error(
      `Invalid dataset identifier '${overrideVal}': Must be a valid SQL identifier (1-64 characters, letters/digits/underscores only, cannot start with a digit)`
    );
  }

  // 2. Explicit project ownership in production
  if (isProd) {
    if (projectId === "nilufer") {
      const isNilufer = overrideVal.startsWith("cognilink_nilufer_") || overrideVal.startsWith("nilufer_");
      if (!isNilufer) {
        throw new Error(
          `Invalid dataset override '${overrideVal}': Dataset override for production project 'nilufer' must explicitly belong to the nilufer project (prefix: 'cognilink_nilufer_' or 'nilufer_')`
        );
      }
    } else if (projectId === "runtime") {
      const isRuntime = overrideVal.startsWith("cognilink_runtime_") || overrideVal.startsWith("runtime_");
      if (!isRuntime) {
        throw new Error(
          `Invalid dataset override '${overrideVal}': Dataset override for production project 'runtime' must explicitly belong to the runtime project (prefix: 'cognilink_runtime_' or 'runtime_')`
        );
      }
    } else {
      throw new Error(`Cannot override dataset for unsupported production project: '${projectId}'`);
    }
  } else {
    // 3. Environment isolation for non-production
    if (overrideVal.endsWith("_prod") || overrideVal.includes("_prod_")) {
      throw new Error(
        `Invalid dataset override '${overrideVal}': Non-production environment '${envName}' cannot target production datasets`
      );
    }
    if (projectId === "nilufer" && (overrideVal.includes("runtime") || overrideVal.includes("teklifi"))) {
      throw new Error(
        `Cross-project dataset contamination: Cannot use runtime dataset '${overrideVal}' in nilufer project`
      );
    }
    if (projectId === "runtime" && overrideVal.includes("nilufer")) {
      throw new Error(
        `Cross-project dataset contamination: Cannot use nilufer dataset '${overrideVal}' in runtime project`
      );
    }
  }

  return true;
}

/**
 * Resolves the active Analytics Engine dataset name for a given env and dataset type.
 *
 * Types:
 * - 'traffic' (or 'ops')
 * - 'conversion' (or 'evt', 'events')
 * - 'experiment' (or 'exp')
 *
 * Enforces:
 * - Explicit override check (AE_TRAFFIC_DATASET, AE_CONVERSION_DATASET, AE_EXPERIMENT_DATASET)
 * - Strict SQL identifier and project/environment ownership validation
 * - Strict cross-project contamination prevention
 * - Explicit errors on missing or contradictory configuration
 */
export function getAnalyticsDataset(env = {}, type = "traffic") {
  const normType = String(type).trim().toLowerCase();
  let canonicalType;
  if (normType === "traffic" || normType === "ops") {
    canonicalType = "traffic";
  } else if (normType === "conversion" || normType === "evt" || normType === "events") {
    canonicalType = "conversion";
  } else if (normType === "experiment" || normType === "exp") {
    canonicalType = "experiment";
  } else {
    throw new Error(`Invalid analytics dataset type: '${type}'`);
  }

  const envName = (env.ENV_NAME || "dev").toLowerCase();
  const isProd = envName === "production" || envName === "prod";
  const projectId = resolveProjectId(env);

  // Check type-specific override
  const overrideKeyMap = {
    traffic: "AE_TRAFFIC_DATASET",
    conversion: "AE_CONVERSION_DATASET",
    experiment: "AE_EXPERIMENT_DATASET",
  };
  const overrideKey = overrideKeyMap[canonicalType];
  const overrideVal = typeof env[overrideKey] === "string" ? env[overrideKey].trim() : "";

  if (overrideVal) {
    validateDatasetOverride(overrideVal, projectId, isProd, envName);
    return overrideVal;
  }

  if (isProd) {
    if (!projectId || !PROJECT_AE_DATASETS[projectId]) {
      throw new Error(`Missing or unsupported production project configuration: '${projectId}'`);
    }
    return PROJECT_AE_DATASETS[projectId][canonicalType];
  }

  // Non-production fallback (dev, staging, test, etc.)
  return `ae_${canonicalType}_${envName || "dev"}`;
}

/**
 * Convenience helper returning all standard dataset names for the active environment.
 */
export function getAnalyticsDatasets(env = {}) {
  const traffic = getAnalyticsDataset(env, "traffic");
  const conversion = getAnalyticsDataset(env, "conversion");
  const experiment = getAnalyticsDataset(env, "experiment");

  return {
    traffic,
    conversion,
    experiment,
    datasetOps: traffic,
    datasetEvt: conversion,
    datasetExp: experiment,
  };
}

