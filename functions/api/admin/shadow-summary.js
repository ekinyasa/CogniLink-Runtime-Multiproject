/**
 * functions/api/admin/shadow-summary.js
 * 
 * GET /api/admin/shadow-summary?window=1h
 * 
 * Read-only admin endpoint that queries Cloudflare Analytics Engine
 * for shadow_evaluation and shadow_mismatch event counts, and aggregates them.
 * 
 * Uses the same AE SQL API pattern as analytics.js.
 * 
 * Supported windows: 15m, 1h, 24h
 * 
 * Requires: CF_ACCOUNT_ID, CF_AE_API_TOKEN (secrets), ADMIN_TOKEN (secret)
 */

import { verifyToken, unauthorized } from "../../_shared/auth.js";

const AE_SQL_BASE = "https://api.cloudflare.com/client/v4/accounts";

const ALLOWED_WINDOWS = {
  "15m": { interval: 15, unit: "MINUTE" },
  "1h":  { interval: 1,  unit: "HOUR"   },
  "24h": { interval: 24, unit: "HOUR"   }
};

async function aeQuery(accountId, apiToken, sql) {
  const url = `${AE_SQL_BASE}/${accountId}/analytics_engine/sql`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiToken}`,
      "Content-Type": "text/plain",
    },
    body: sql,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AE SQL error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!(await verifyToken(request, env))) return unauthorized();

  const url = new URL(request.url);
  const windowParam = url.searchParams.get("window") || "1h";

  const headers = {
    "Content-Type": "application/json;charset=UTF-8",
    "Cache-Control": "no-store, private",
    "X-Content-Type-Options": "nosniff"
  };

  // Validate window
  const windowDef = ALLOWED_WINDOWS[windowParam];
  if (!windowDef) {
    return new Response(JSON.stringify({
      ok: false,
      error: "invalid_window",
      allowed: Object.keys(ALLOWED_WINDOWS)
    }), { status: 400, headers });
  }

  const accountId = (env.CF_ACCOUNT_ID || "").trim();
  const apiToken = (env.CF_AE_API_TOKEN || "").trim();

  if (!accountId || !apiToken) {
    return new Response(JSON.stringify({
      ok: false,
      error: "ae_credentials_missing",
      hint: "CF_ACCOUNT_ID and CF_AE_API_TOKEN must be set as secrets."
    }), { status: 503, headers });
  }

  const envName = (env.ENV_NAME || "dev").toLowerCase();
  const isProd = envName === "production";
  const dataset = isProd ? "cognilink_runtime_traffic_prod" : `ae_traffic_${envName}`;

  const intervalStr = `INTERVAL '${windowDef.interval}' ${windowDef.unit}`;

  try {
    // Query raw dataset grouped by event type, slug, route_type, and details JSON to compile metrics in JS
    const sqlQuery = `
      SELECT index1 AS event_type, blob1 AS slug, blob2 AS route_type, blob4 AS detail, SUM(_sample_interval) AS count
      FROM ${dataset}
      WHERE index1 IN ('shadow_evaluation', 'shadow_mismatch')
        AND timestamp > now() - ${intervalStr}
      GROUP BY event_type, slug, route_type, detail
      LIMIT 10000
    `;

    const aeResponse = await aeQuery(accountId, apiToken, sqlQuery);
    const rows = Array.isArray(aeResponse?.data) ? aeResponse.data : [];

    let evaluationCount = 0;
    let comparableCount = 0;
    let notComparableCount = 0;
    let mismatchCount = 0;
    let failureCount = 0;
    let diagnosticMismatchCount = 0;

    const routeMismatches = {};
    const ruleMismatches = {};

    for (const row of rows) {
      const eventType = row.event_type;
      const slug = row.slug || "";
      const routeType = row.route_type || "";
      const detailStr = row.detail || "";
      const count = Number(row.count) || 0;

      let detail = {};
      try {
        if (detailStr) {
          detail = JSON.parse(detailStr) || {};
        }
      } catch (e) {
        // Fallback for non-JSON or corrupted payloads
      }

      const isDiag = slug === "admin_diagnostic" || routeType === "diagnostic" || detail.mismatch_categories?.includes("diagnostic");

      if (isDiag) {
        if (eventType === "shadow_mismatch") {
          diagnosticMismatchCount += count;
        }
      } else {
        if (eventType === "shadow_evaluation") {
          evaluationCount += count;
          if (detail.comparable === true) {
            comparableCount += count;
          } else if (detail.comparable === false) {
            notComparableCount += count;
          }
        } else if (eventType === "shadow_mismatch") {
          mismatchCount += count;
          
          if (detail.mismatch_categories?.includes("exception") || detail.mismatch_categories?.includes("context_failure")) {
            failureCount += count;
          }

          // Accumulate route/rule mismatches
          if (routeType) {
            routeMismatches[routeType] = (routeMismatches[routeType] || 0) + count;
          }
          if (detail.matched_rule_id && detail.matched_rule_id !== "none") {
            ruleMismatches[detail.matched_rule_id] = (ruleMismatches[detail.matched_rule_id] || 0) + count;
          }
        }
      }
    }

    const mismatchRate = comparableCount > 0
      ? mismatchCount / comparableCount
      : 0;

    return new Response(JSON.stringify({
      ok: true,
      evaluation_count: evaluationCount,
      comparable_count: comparableCount,
      not_comparable_count: notComparableCount,
      mismatch_count: mismatchCount,
      mismatch_rate: Math.round(mismatchRate * 10000) / 10000,
      failure_count: failureCount,
      diagnostic_mismatch_count: diagnosticMismatchCount,
      top_mismatch_routes: Object.entries(routeMismatches)
        .map(([route, count]) => ({ route, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      top_mismatch_rules: Object.entries(ruleMismatches)
        .map(([rule_id, count]) => ({ rule_id, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      window: windowParam,
      dataset,
      generated_at: new Date().toISOString()
    }), { status: 200, headers });

  } catch (err) {
    console.error("[shadow-summary] Query error:", err);
    return new Response(JSON.stringify({
      ok: false,
      error: "query_failed",
      hint: err.message?.slice(0, 200) || "Unknown error"
    }), { status: 502, headers });
  }
}
