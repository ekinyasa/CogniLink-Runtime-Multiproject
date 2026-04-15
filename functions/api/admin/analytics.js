import { verifyToken, unauthorized, jsonHeaders } from "../../_shared/auth.js";
import { getExpState } from "../../_shared/ab-router.js";

const AE_SQL_BASE = "https://api.cloudflare.com/client/v4/accounts";

// Datasets are resolved dynamically per environment in handled functions.
// DATASET_OPS (ae_traffic_${envName})
// DATASET_EVT (ae_conversion_${envName})

/**
 * Execute a SQL query against Cloudflare Analytics Engine.
 */
async function aeQuery(accountId, apiToken, sql) {
  const url = `${AE_SQL_BASE}/${accountId}/analytics_engine/sql`;
  const res = await fetch(url, {
    method:  "POST",
    headers: {
      "Authorization": `Bearer ${apiToken}`,
      "Content-Type":  "text/plain",
    },
    body: sql,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AE SQL error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function rows(aeResponse) {
  return Array.isArray(aeResponse?.data) ? aeResponse.data : [];
}

/**
 * Fetch a summary of active/decided A/B experiments and their performance.
 */
async function fetchActiveExperiments(env, accountId, apiToken, interval, unit, cutoff) {
  if (!env.AB_INDEX) return [];
  
  // 1. Paginate all ab_config:* key names (Cursored V4)
  const keys = [];
  let cursor;
  do {
    const opts = { prefix: "ab_config:", limit: 1000 };
    if (cursor) opts.cursor = cursor;
    const page = await env.AB_INDEX.list(opts);
    for (const key of page.keys) keys.push(key.name);
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  const activeConfigs = [];
  const BATCH = 25;
  for (let i = 0; i < keys.length; i += BATCH) {
    const batch = keys.slice(i, i + BATCH);
    const rows = await Promise.all(
      batch.map(async (k) => {
        try {
          const cfg = await env.AB_INDEX.get(k, { type: "json" });
          if (!cfg) return null;
          const state = getExpState(cfg);
          if (state === "RUNNING" || state === "DECIDED") {
            return { alias: k.replace("ab_config:", ""), state, ...cfg };
          }
        } catch (e) {
          console.error(`[ae-debug] Error reading ${k}:`, e?.message);
        }
        return null;
      })
    );
    for (const r of rows) if (r) activeConfigs.push(r);
  }
  
  if (activeConfigs.length === 0) return [];

  const envName = (env.ENV_NAME || "dev").toLowerCase();
  const isProd = envName === "production";
  const datasetEvt = isProd ? "cognilink_conversion_prod" : `ae_conversion_${envName}`;
  const datasetOps = isProd ? "cognilink_traffic_prod" : `ae_traffic_${envName}`;

  const aliases = activeConfigs.map(c => `'${c.alias.replace(/'/g, "''")}'`).join(",");
  
  const intervalStr = `INTERVAL '${interval}' ${unit}`;
  
  // Query 1: Exposures from datasetOps (ab_selected)
  const sqlExp = `
    SELECT blob1 AS alias, blob2 AS variant, SUM(_sample_interval) AS count
    FROM ${datasetOps}
    WHERE blob1 IN (${aliases}) AND index1 = 'ab_selected'
      AND timestamp > now() - ${intervalStr}
    GROUP BY blob1, blob2
  `;

  // Query 2: Clicks and Conversions from datasetEvt
  const sqlEvt = `
    SELECT blob1 AS alias, index1 AS event_type, blob2 AS variant, SUM(_sample_interval) AS count
    FROM ${datasetEvt}
    WHERE blob1 IN (${aliases}) AND index1 IN ('click', 'conversion')
      AND timestamp > now() - ${intervalStr}
    GROUP BY blob1, index1, blob2
  `;

  const [resExp, resEvt] = await Promise.all([
    aeQuery(accountId, apiToken, sqlExp).catch(() => ({ data: [] })),
    aeQuery(accountId, apiToken, sqlEvt).catch(() => ({ data: [] })),
  ]);

  const statsMap = {};
  (resExp.data || []).forEach(row => {
    const a = row.alias || "";
    const v = row.variant || "";
    const count = Number(row.count) || 0;
    if (!statsMap[a]) statsMap[a] = {};
    if (!statsMap[a][v]) statsMap[a][v] = { exposures: 0, clicks: 0, conversions: 0 };
    statsMap[a][v].exposures += count;
  });

  (resEvt.data || []).forEach(row => {
    const a = row.alias || "";
    const v = row.variant || "";
    const type = row.event_type;
    const count = Number(row.count) || 0;
    if (!statsMap[a]) statsMap[a] = {};
    if (!statsMap[a][v]) statsMap[a][v] = { exposures: 0, clicks: 0, conversions: 0 };
    if (type === "click") statsMap[a][v].clicks += count;
    else if (type === "conversion") statsMap[a][v].conversions += count;
  });

  return activeConfigs.map(c => {
    const s = statsMap[c.alias] || {};
    const variants = (c.variants || []).map(v => {
      const vs = s[v.slug] || { exposures: 0, clicks: 0, conversions: 0 };
      const ctr = vs.exposures > 0 ? vs.clicks / vs.exposures : 0;
      const convR = vs.exposures > 0 ? vs.conversions / vs.exposures : 0;
      return { slug: v.slug, ...vs, ctr, conversion_rate: convR };
    });
    
    let leader = null;
    let maxConvR = -1;
    variants.forEach(v => {
      if (v.conversion_rate > maxConvR) {
        maxConvR = v.conversion_rate;
        leader = v.slug;
      }
    });
    const totalExposures = variants.reduce((sum, v) => sum + v.exposures, 0);
    const totalConversions = variants.reduce((sum, v) => sum + v.conversions, 0);

    return {
      alias: c.alias,
      state: c.state,
      leader,
      clicks: totalExposures, // Map exposures to 'clicks' for dashboard label consistency
      conversions: totalConversions,
      conversion_rate: totalExposures > 0 ? totalConversions / totalExposures : 0,
      created_at: c.created_at || 0
    };
  }).sort((a, b) => (b.created_at || 0) - (a.created_at || 0)).slice(0, 100);
}

export async function onRequestGet(context) {
  try {
    return await handleGet(context);
  } catch (err) {
    console.error("[Analytics API] Crash:", err);
    return new Response(JSON.stringify({ 
      ok: false, 
      error: "internal_error", 
      hint: err.message 
    }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}

async function handleGet(context) {
  const { request, env } = context;

  if (request.method !== "GET") {
    return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
      status: 405,
      headers: { ...jsonHeaders(), Allow: "GET" },
    });
  }

  if (!verifyToken(request, env)) return unauthorized();

  const accountId = (env.CF_ACCOUNT_ID   || "").trim();
  const apiToken  = (env.CF_AE_API_TOKEN || "").trim();

  const url = new URL(request.url);
  const windowParam = url.searchParams.get("window") || "24h";
  const startParam  = (url.searchParams.get("start") || "").trim();
  const endParam    = (url.searchParams.get("end") || "").trim();
  const showTest    = url.searchParams.get("test") === "true";

  // MOCK MODE for local testing if credentials are missing
  if (!accountId || !apiToken) {
    return new Response(JSON.stringify(getMockData(windowParam, showTest)), {
      status: 200, headers: jsonHeaders()
    });
  }

  let intervalVal = 24;
  let unit = "HOUR";
  if (windowParam === "1h")  { intervalVal = 1;  unit = "HOUR"; }
  if (windowParam === "7d")  { intervalVal = 7;  unit = "DAY";  }
  if (windowParam === "30d") { intervalVal = 30; unit = "DAY";  }

  let timeFilter = `timestamp > now() - INTERVAL '${intervalVal}' ${unit}`;
  if (startParam !== "") {
    timeFilter = `timestamp >= toDateTime('${startParam} 00:00:00')`;
    if (endParam !== "") {
      timeFilter += ` AND timestamp <= toDateTime('${endParam} 23:59:59')`;
    }
  }

  const isLargeWindow = windowParam === "7d" || windowParam === "30d" || (startParam !== "" && endParam !== "");
  const chartInterval = isLargeWindow ? "'1' DAY" : "'1' HOUR";

  const t0 = Date.now();

  const clickEvents = "'traffic_memory'";
  const envName = (env.ENV_NAME || "dev").toLowerCase();
  const isProd = envName === "production";
  const DATASET_OPS = isProd ? "cognilink_traffic_prod" : `ae_traffic_${envName}`;
  const DATASET_EVT = isProd ? "cognilink_conversion_prod" : `ae_conversion_${envName}`;

  try {
    const [
      campRes, aliasRes, slugRes, trafficRecentRes, eventsRecentRes, convRes, expSummary,
      seriesClicksRes, seriesConvsRes, sourceClicksRes, sourceConvsRes
    ] = await Promise.allSettled([
      aeQuery(accountId, apiToken,
        `SELECT blob4 AS campaign, SUM(_sample_interval) AS clicks FROM ${DATASET_OPS}
         WHERE index1 IN (${clickEvents}) AND ${timeFilter}
         GROUP BY campaign ORDER BY clicks DESC LIMIT 50`),
      aeQuery(accountId, apiToken,
        `SELECT blob1 AS alias, SUM(_sample_interval) AS clicks FROM ${DATASET_OPS}
         WHERE index1 IN (${clickEvents}) AND ${timeFilter}
         GROUP BY alias ORDER BY clicks DESC LIMIT 50`),
      aeQuery(accountId, apiToken,
        `SELECT blob2 AS slug, SUM(_sample_interval) AS clicks FROM ${DATASET_OPS}
         WHERE index1 IN (${clickEvents}) AND ${timeFilter}
         GROUP BY slug ORDER BY clicks DESC LIMIT 50`),
      aeQuery(accountId, apiToken,
        `SELECT timestamp, blob1 AS alias, blob2 AS slug, blob4 AS campaign, blob5 AS source, 'traffic' AS event_type 
         FROM ${DATASET_OPS}
         WHERE index1 IN (${clickEvents}) AND ${timeFilter}
         ORDER BY timestamp DESC LIMIT 50`),
      aeQuery(accountId, apiToken,
        `SELECT timestamp, blob1 AS alias, blob2 AS slug, blob3 AS source, index1 AS event_type 
         FROM ${DATASET_EVT}
         WHERE index1 IN ('click', 'conversion') AND ${timeFilter}
         ORDER BY timestamp DESC LIMIT 50`),
      aeQuery(accountId, apiToken,
        `SELECT blob1 AS campaign, blob5 AS event_name, SUM(_sample_interval) AS conversions FROM ${DATASET_EVT}
         WHERE index1 = 'conversion' AND ${timeFilter}
         GROUP BY campaign, event_name`),
      fetchActiveExperiments(env, accountId, apiToken, intervalVal, unit, null),
      // Time-series: Clicks
      aeQuery(accountId, apiToken,
        `SELECT toStartOfInterval(timestamp, INTERVAL ${chartInterval}) AS t, SUM(_sample_interval) AS clicks
         FROM ${DATASET_OPS} WHERE index1 IN (${clickEvents}) AND ${timeFilter}
         GROUP BY t ORDER BY t ASC`),
      // Time-series: Conversions
      aeQuery(accountId, apiToken,
        `SELECT toStartOfInterval(timestamp, INTERVAL ${chartInterval}) AS t, SUM(_sample_interval) AS conversions
         FROM ${DATASET_EVT} WHERE index1 = 'conversion' AND ${timeFilter}
         GROUP BY t ORDER BY t ASC`),
      // Sources: Clicks
      aeQuery(accountId, apiToken,
        `SELECT blob5 AS source, SUM(_sample_interval) AS clicks
         FROM ${DATASET_OPS} WHERE index1 IN (${clickEvents}) AND ${timeFilter}
         GROUP BY source ORDER BY clicks DESC LIMIT 50`),
      // Sources: Conversions
      aeQuery(accountId, apiToken,
        `SELECT blob3 AS source, SUM(_sample_interval) AS conversions
         FROM ${DATASET_EVT} WHERE index1 = 'conversion' AND ${timeFilter}
         GROUP BY source ORDER BY conversions DESC LIMIT 50`)
    ]);

    // Diagnostic logging
    const errors = [];
    const results = [
      campRes, aliasRes, slugRes, trafficRecentRes, eventsRecentRes, convRes, expSummary,
      seriesClicksRes, seriesConvsRes, sourceClicksRes, sourceConvsRes
    ];
    results.forEach((r, idx) => {
      if (r.status === "rejected") {
        console.error(`[Analytics API] Query ${idx} failed:`, r.reason);
        errors.push({ query: idx, error: String(r.reason) });
      }
    });

    const getRows = (res) => (res.status === "fulfilled" ? rows(res.value) : []);
    const isTest = (s) => typeof s === "string" && s.startsWith("test-");

    // Filter function for rows based on campaign/alias/slug
    const filterData = (arr, key) => arr.filter(r => showTest ? isTest(r[key]) : !isTest(r[key]));

    const rawCampaigns = getRows(campRes).map(r => ({ ...r, clicks: Number(r.clicks) }));
    const rawConvs     = getRows(convRes);
    
    const fCampaigns = filterData(rawCampaigns, "campaign");
    const fConversions = rawConvs
      .filter(r => showTest ? isTest(r.campaign) : !isTest(r.campaign))
      .reduce((sum, r) => sum + Number(r.conversions), 0);

    // Merge Time-Series Data
    const chartMap = {};
    getRows(seriesClicksRes).forEach(r => {
      chartMap[r.t] = { t: r.t, clicks: Number(r.clicks), conversions: 0 };
    });
    getRows(seriesConvsRes).forEach(r => {
      if (!chartMap[r.t]) chartMap[r.t] = { t: r.t, clicks: 0, conversions: 0 };
      chartMap[r.t].conversions += Number(r.conversions);
    });
    const chart = Object.values(chartMap).sort((a, b) => a.t.localeCompare(b.t));

    // Merge Sources Data
    const srcMap = {};
    getRows(sourceClicksRes).forEach(r => {
      const src = r.source || "direct";
      srcMap[src] = { source: src, clicks: Number(r.clicks), conversions: 0 };
    });
    getRows(sourceConvsRes).forEach(r => {
      const src = r.source || "direct";
      if (!srcMap[src]) srcMap[src] = { source: src, clicks: 0, conversions: 0 };
      srcMap[src].conversions += Number(r.conversions);
    });
    
    const sources = Object.values(srcMap)
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 10);

    const fRecent = [
      ...getRows(trafficRecentRes),
      ...getRows(eventsRecentRes)
    ].filter(r => showTest ? (isTest(r.campaign) || isTest(r.alias) || isTest(r.slug)) : (!isTest(r.campaign) && !isTest(r.alias) && !isTest(r.slug)))
     .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
     .slice(0, 100)
     .map(r => {
        const type = r.event_type || "click";
        const source = r.source || "";
        return {
          ...r,
          campaign: r.campaign || r.alias || "—",
          modifier: source ? `${type} · ${source}` : type
        };
      });

    return new Response(JSON.stringify({
      ok: true,
      campaigns: fCampaigns,
      aliases:   filterData(getRows(aliasRes).map(r => ({ ...r, clicks: Number(r.clicks) })), "alias"),
      slugs:     filterData(getRows(slugRes).map(r => ({ ...r, clicks: Number(r.clicks) })), "slug"),
      recent:    fRecent,
      summary: {
        conversions: fConversions,
        total_clicks: fCampaigns.reduce((s, c) => s + c.clicks, 0),
        active_experiments: expSummary.status === "fulfilled" ? expSummary.value : [],
        chart,
        sources
      },
      duration_ms: Date.now() - t0,
      errors: errors.length > 0 ? errors : undefined,
      generated_at: new Date().toISOString()
    }), { headers: jsonHeaders() });

  } catch (err) {
    throw err;
  }
}

/** Realistic Mock Data for Local Development. */
function getMockData(windowParam, showTest) {
  const isLarge = windowParam === "7d" || windowParam === "30d";
  const numPoints = isLarge ? 7 : 24;
  const labels = [];
  const start = new Date();
  for (let i = 0; i < numPoints; i++) {
    const d = new Date(start.getTime() - (numPoints - i) * (isLarge ? 86400000 : 3600000));
    labels.push(d.getFullYear() + "-" + (d.getMonth() + 1).toString().padStart(2, '0') + "-" + d.getDate().toString().padStart(2, '0') + (isLarge ? "" : " " + d.getHours().toString().padStart(2, '0') + ":00"));
  }

  const chart = labels.map(t => ({ 
    t, 
    clicks: Math.floor(Math.random() * 500) + 200, 
    conversions: Math.floor(Math.random() * 20) + 5 
  }));

  const prefix = showTest ? "test-" : "";
  const campaigns = [
    { campaign: prefix + "summer-sale", clicks: 12450 },
    { campaign: prefix + "flash-deal",  clicks: 8320 },
    { campaign: prefix + "newsletter",  clicks: 4500 }
  ];

  const recent = Array.from({ length: 15 }).map((_, i) => ({
    timestamp: new Date(Date.now() - i * 600000).toISOString(),
    alias: prefix + "alias-" + (i % 3),
    slug: "product-" + (i % 5),
    campaign: prefix + "campaign-" + (i % 2),
    modifier: i % 2 === 0 ? "ig" : null
  }));

  return {
    ok: true,
    campaigns,
    aliases: campaigns.map(c => ({ alias: c.campaign + "-link", clicks: Math.floor(c.clicks * 0.8) })),
    slugs: Array.from({ length: 5 }).map((_, i) => ({ slug: "product-" + i, clicks: 1000 - i * 100 })),
    recent,
    summary: {
      conversions: 222,
      total_clicks: campaigns.reduce((s, c) => s + c.clicks, 0),
      active_experiments: [],
      chart,
      sources: [
        { source: "google", clicks: 5000, conversions: 120 },
        { source: "instagram", clicks: 3500, conversions: 85 },
        { source: "facebook", clicks: 2000, conversions: 40 },
        { source: "direct", clicks: 1500, conversions: 15 }
      ]
    },
    generated_at: new Date().toISOString(),
    is_mock: true
  };
}
