/**
 * functions/api/admin/shadow-summary.js
 * 
 * GET /api/admin/shadow-summary?window=1h
 * 
 * Read-only admin endpoint that queries Cloudflare Analytics Engine
 * for shadow_evaluation and shadow_mismatch event counts.
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

  if (!verifyToken(request, env)) return unauthorized();

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
    // Query 1: Count evaluations and mismatches
    const sqlCounts = `
      SELECT index1 AS event_type, SUM(_sample_interval) AS count
      FROM ${dataset}
      WHERE index1 IN ('shadow_evaluation', 'shadow_mismatch')
        AND timestamp > now() - ${intervalStr}
      GROUP BY event_type
    `;

    // Query 2: Top mismatch categories (from blob4 detail JSON)
    // blob4 contains JSON with mismatch_categories array
    // AE SQL doesn't support JSON parsing, so we extract from blob2 (route_type)
    // and blob1 (slug) for grouping. For categories we query the raw mismatch events.
    const sqlMismatchBySlug = `
      SELECT blob1 AS slug, blob2 AS route_type, SUM(_sample_interval) AS count
      FROM ${dataset}
      WHERE index1 = 'shadow_mismatch'
        AND timestamp > now() - ${intervalStr}
      GROUP BY slug, route_type
      ORDER BY count DESC
      LIMIT 20
    `;

    const [countsRes, mismatchRes] = await Promise.allSettled([
      aeQuery(accountId, apiToken, sqlCounts),
      aeQuery(accountId, apiToken, sqlMismatchBySlug)
    ]);

    let evaluationCount = 0;
    let mismatchCount = 0;

    if (countsRes.status === "fulfilled" && Array.isArray(countsRes.value?.data)) {
      for (const row of countsRes.value.data) {
        const count = Number(row.count) || 0;
        if (row.event_type === "shadow_evaluation") evaluationCount = count;
        else if (row.event_type === "shadow_mismatch") mismatchCount = count;
      }
    }

    const mismatchRate = evaluationCount > 0
      ? mismatchCount / evaluationCount
      : (mismatchCount > 0 ? 1 : 0);

    const topMismatchSlugs = [];
    if (mismatchRes.status === "fulfilled" && Array.isArray(mismatchRes.value?.data)) {
      for (const row of mismatchRes.value.data) {
        topMismatchSlugs.push({
          slug: row.slug || "unknown",
          route_type: row.route_type || "unknown",
          count: Number(row.count) || 0
        });
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      evaluation_count: evaluationCount,
      mismatch_count: mismatchCount,
      mismatch_rate: Math.round(mismatchRate * 10000) / 10000,
      top_mismatch_slugs: topMismatchSlugs,
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
