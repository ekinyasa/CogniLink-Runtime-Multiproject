import { verifyToken, unauthorized } from "../../_shared/auth.js";

const JSON_HEADERS = {
  "Content-Type": "application/json;charset=UTF-8",
  "Cache-Control": "no-store", // Admin API calls should always be fresh
};

/**
 * GET /api/analytics/report
 * 
 * Queries Cloudflare Analytics Engine via the SQL API to retrieve telemetry.
 * Groups exposures, clicks, and conversions by alias -> variant -> source.
 * 
 * Query string:
 *  ?alias=spring2026 (optional filter to limit query scan depth)
 *  ?days=7          (optional lookback window, defaults to 30)
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  
  if (!verifyToken(request, env)) return unauthorized();

  const accountId = env.CF_ACCOUNT_ID;
  const apiToken  = env.CF_AE_API_TOKEN;

  // Safeguard: User must set these environment variables in project settings
  if (!accountId || !apiToken) {
    return new Response(JSON.stringify({ 
      error: "Analytics API credentials not configured", 
      details: "Please set CF_ACCOUNT_ID and CF_AE_API_TOKEN in the Cloudflare Dashboard." 
    }), { status: 503, headers: JSON_HEADERS });
  }

  const url = new URL(request.url);
  const alias = (url.searchParams.get("alias") || "").replace(/'/g, "''").trim();
  const days  = parseInt(url.searchParams.get("days") || "30", 10);

  // Build the AE SQL Query
  // Note: linkhub_events is the dataset specified in wrangler.toml
  // index1 = event_type, blob1 = alias, blob2 = variant, blob3 = utm_source, blob4 = utm_medium
  const AE_CUTOFF = "2026-03-19 17:50:00"; 
  let sql = `
    SELECT 
      index1 as event_type, 
      blob1 as alias, 
      blob2 as variant, 
      blob3 as utm_source, 
      blob4 as utm_medium, 
      SUM(_sample_interval) as count
    FROM linkhub_events
    WHERE timestamp >= NOW() - INTERVAL '${days}' DAY
      AND timestamp > toDateTime('${AE_CUTOFF}')
  `;

  if (alias) {
    sql += ` AND blob1 = '${alias}'`;
  }
  
  sql += ` GROUP BY event_type, alias, variant, utm_source, utm_medium`;

  const queryUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`;
  
  try {
    const response = await fetch(queryUrl, {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiToken}` },
      body: sql
    });

    if (!response.ok) {
      const err = await response.text();
      return new Response(JSON.stringify({ error: "Cloudflare API Error", message: err }), { status: 502, headers: JSON_HEADERS });
    }

    const { data } = await response.json();
    
    // Process AE flat rows into a rich hierarchy: Alias -> Variant -> Source
    const report = {
      query_alias: alias || "all",
      lookback_days: days,
      freshness_warning: "Data is aggregated by Cloudflare Analytics Engine and may be delayed by 3-5 minutes.",
      fetched_at: new Date().toISOString(),
      summary: {}
    };
    
    // Grouping
    (data || []).forEach(row => {
      const a = row.alias || "unknown";
      const v = row.variant || "unknown";
      const s = row.utm_source || "direct";
      const type = row.event_type; // "click", "exposure", "conversion"
      const count = Number(row.count) || 0;

      if (!report.summary[a]) {
        report.summary[a] = { total_exposures: 0, total_clicks: 0, total_conversions: 0, variants: {} };
      }
      if (!report.summary[a].variants[v]) {
        report.summary[a].variants[v] = { exposures: 0, clicks: 0, conversions: 0, sources: {} };
      }
      if (!report.summary[a].variants[v].sources[s]) {
        report.summary[a].variants[v].sources[s] = { clicks: 0, conversions: 0 };
      }

      if (type === "exposure") {
        report.summary[a].total_exposures += count;
        report.summary[a].variants[v].exposures   += count;
      } else if (type === "click") {
        report.summary[a].total_clicks    += count;
        report.summary[a].variants[v].clicks      += count;
        report.summary[a].variants[v].sources[s].clicks += count;
      } else if (type === "conversion") {
        report.summary[a].total_conversions += count;
        report.summary[a].variants[v].conversions += count;
        report.summary[a].variants[v].sources[s].conversions += count;
      }
    });

    // Calculate Conv Rates at root and variant levels
    Object.keys(report.summary).forEach(a => {
      const aliasData = report.summary[a];
      aliasData.conversion_rate = aliasData.total_clicks > 0 
        ? Math.round((aliasData.total_conversions / aliasData.total_clicks) * 10000) / 10000 // e.g. 0.1250 = 12.5%
        : 0;
      
      Object.keys(aliasData.variants).forEach(v => {
        const variantData = aliasData.variants[v];
        variantData.conversion_rate = variantData.clicks > 0
          ? Math.round((variantData.conversions / variantData.clicks) * 10000) / 10000
          : 0;
      });
    });

    return new Response(JSON.stringify(report), { headers: JSON_HEADERS });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Failed to fetch analytics", details: error.message }), { status: 500, headers: JSON_HEADERS });
  }
}
