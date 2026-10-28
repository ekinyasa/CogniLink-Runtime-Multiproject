import { verifyToken, unauthorized, jsonHeaders } from "../../_shared/auth.js";
import { getExpState } from "../../_shared/ab-router.js";
import { getAnalyticsDatasets } from "../../_shared/analytics.js";

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
 * Validates that a string is a strictly valid YYYY-MM-DD calendar date.
 */
function isValidCalendarDate(str) {
  if (typeof str !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return false;
  }
  const [y, m, d] = str.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) {
    return false;
  }
  const daysInMonth = [0, 31, (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d <= daysInMonth[m];
}

/**
 * Calculates the next calendar day string (YYYY-MM-DD) in UTC.
 */
function getNextDayStr(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const nextDate = new Date(Date.UTC(y, m - 1, d + 1));
  const ny = nextDate.getUTCFullYear();
  const nm = String(nextDate.getUTCMonth() + 1).padStart(2, "0");
  const nd = String(nextDate.getUTCDate()).padStart(2, "0");
  return `${ny}-${nm}-${nd}`;
}

/**
 * Normalizes an interval bucket string returned by AE (or mock)
 * into an unambiguous ISO-8601 string with Europe/Istanbul offset (+03:00).
 */
function normalizeIstanbulBucket(raw) {
  if (!raw) return "";
  const s = String(raw).trim();
  if (/(?:[zZ]|[+-](?:0[0-9]|1[0-4]):?[0-5][0-9])$/.test(s)) {
    return s.includes(" ") ? s.replace(" ", "T") : s;
  }
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
    return s.replace(" ", "T") + "+03:00";
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return `${s}T00:00:00+03:00`;
  }
  return s;
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

  const { datasetOps, datasetEvt } = getAnalyticsDatasets(env);

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
    aeQuery(accountId, apiToken, sqlExp),
    aeQuery(accountId, apiToken, sqlEvt),
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

  if (!(await verifyToken(request, env))) return unauthorized();

  const accountId = (env.CF_ACCOUNT_ID   || "").trim();
  const apiToken  = (env.CF_AE_API_TOKEN || "").trim();

  const url = new URL(request.url);
  const windowParam = url.searchParams.get("window") || "24h";
  const startParam  = (url.searchParams.get("start") || "").trim();
  const endParam    = (url.searchParams.get("end") || "").trim();
  const showTest    = url.searchParams.get("test") === "true";

  const envName = (env.ENV_NAME || "dev").toLowerCase();
  const isProd = envName === "production" || envName === "prod";

  // MOCK MODE for local testing if credentials are missing
  if (!accountId || !apiToken) {
    if (isProd) {
      return new Response(JSON.stringify({
        ok: false,
        error: "not_configured",
        hint: "Analytics credentials (CF_ACCOUNT_ID, CF_AE_API_TOKEN) not configured in production.",
        is_mock: false
      }), {
        status: 503, headers: jsonHeaders()
      });
    }
    return new Response(JSON.stringify(getMockData(windowParam, showTest)), {
      status: 200, headers: jsonHeaders()
    });
  }

  let DATASET_OPS, DATASET_EVT;
  try {
    const ds = getAnalyticsDatasets(env);
    DATASET_OPS = ds.datasetOps;
    DATASET_EVT = ds.datasetEvt;
  } catch (err) {
    return new Response(JSON.stringify({
      ok: false,
      error: "configuration_error",
      hint: err.message
    }), {
      status: 500, headers: jsonHeaders()
    });
  }

  let intervalVal = 24;
  let unit = "HOUR";
  if (windowParam === "1h")  { intervalVal = 1;  unit = "HOUR"; }
  if (windowParam === "7d")  { intervalVal = 7;  unit = "DAY";  }
  if (windowParam === "30d") { intervalVal = 30; unit = "DAY";  }

  const hasStart = startParam !== "";
  const hasEnd   = endParam !== "";

  if (hasStart || hasEnd) {
    if ((hasStart && !isValidCalendarDate(startParam)) || (hasEnd && !isValidCalendarDate(endParam))) {
      return new Response(JSON.stringify({
        ok: false,
        error: "invalid_date_range",
        hint: "Invalid calendar date format. Expected valid YYYY-MM-DD."
      }), {
        status: 400,
        headers: jsonHeaders()
      });
    }
    if (hasStart && hasEnd && startParam > endParam) {
      return new Response(JSON.stringify({
        ok: false,
        error: "invalid_date_range",
        hint: "Start date cannot be after end date."
      }), {
        status: 400,
        headers: jsonHeaders()
      });
    }
  }

  let timeFilter = `timestamp > now() - INTERVAL '${intervalVal}' ${unit}`;
  if (hasStart || hasEnd) {
    const filters = [];
    if (hasStart) {
      filters.push(`timestamp >= toDateTime('${startParam} 00:00:00', 'Europe/Istanbul')`);
    }
    if (hasEnd) {
      const nextDay = getNextDayStr(endParam);
      filters.push(`timestamp < toDateTime('${nextDay} 00:00:00', 'Europe/Istanbul')`);
    }
    timeFilter = filters.join(" AND ");
  }

  const isLargeWindow = windowParam === "7d" || windowParam === "30d" || (hasStart && hasEnd);
  const chartInterval = isLargeWindow ? "'1' DAY" : "'1' HOUR";

  const opsTestFilter = showTest
    ? "(blob4 LIKE 'test-%' OR blob1 LIKE 'test-%' OR blob2 LIKE 'test-%')"
    : "(blob4 NOT LIKE 'test-%' AND blob1 NOT LIKE 'test-%' AND blob2 NOT LIKE 'test-%')";

  const evtTestFilter = showTest
    ? "(blob1 LIKE 'test-%' OR blob2 LIKE 'test-%')"
    : "(blob1 NOT LIKE 'test-%' AND blob2 NOT LIKE 'test-%')";

  const t0 = Date.now();

  const clickEvents = "'traffic_memory'";

  try {
    const [
      campRes, aliasRes, slugRes, trafficRecentRes, eventsRecentRes, convRes, expSummary,
      seriesClicksRes, seriesConvsRes, sourceClicksRes, sourceConvsRes
    ] = await Promise.allSettled([
      aeQuery(accountId, apiToken,
        `SELECT blob4 AS campaign, SUM(_sample_interval) AS clicks FROM ${DATASET_OPS}
         WHERE index1 IN (${clickEvents}) AND ${timeFilter} AND ${opsTestFilter}
         GROUP BY campaign ORDER BY clicks DESC LIMIT 50`),
      aeQuery(accountId, apiToken,
        `SELECT blob1 AS alias, SUM(_sample_interval) AS clicks FROM ${DATASET_OPS}
         WHERE index1 IN (${clickEvents}) AND ${timeFilter} AND ${opsTestFilter}
         GROUP BY alias ORDER BY clicks DESC LIMIT 50`),
      aeQuery(accountId, apiToken,
        `SELECT blob2 AS slug, SUM(_sample_interval) AS clicks FROM ${DATASET_OPS}
         WHERE index1 IN (${clickEvents}) AND ${timeFilter} AND ${opsTestFilter}
         GROUP BY slug ORDER BY clicks DESC LIMIT 50`),
      aeQuery(accountId, apiToken,
        `SELECT timestamp, blob1 AS alias, blob2 AS slug, blob4 AS campaign, blob5 AS source, index1 AS event_type
         FROM ${DATASET_OPS}
         WHERE index1 IN ('traffic_memory', 'route_redirect') AND ${timeFilter} AND ${opsTestFilter}
         ORDER BY timestamp DESC LIMIT 50`),
      aeQuery(accountId, apiToken,
        `SELECT timestamp, blob1 AS alias, blob2 AS slug, blob3 AS source, index1 AS event_type 
         FROM ${DATASET_EVT}
         WHERE index1 IN ('click', 'conversion', 'signal') AND ${timeFilter} AND ${evtTestFilter}
         ORDER BY timestamp DESC LIMIT 50`),
      aeQuery(accountId, apiToken,
        `SELECT blob1 AS campaign, blob5 AS event_name, SUM(_sample_interval) AS conversions FROM ${DATASET_EVT}
         WHERE index1 = 'conversion' AND ${timeFilter} AND ${evtTestFilter}
         GROUP BY campaign, event_name`),
      fetchActiveExperiments(env, accountId, apiToken, intervalVal, unit, null),
      // Time-series: Clicks
      aeQuery(accountId, apiToken,
        `SELECT toStartOfInterval(timestamp, INTERVAL ${chartInterval}, 'Europe/Istanbul') AS t, SUM(_sample_interval) AS clicks
         FROM ${DATASET_OPS} WHERE index1 IN (${clickEvents}) AND ${timeFilter} AND ${opsTestFilter}
         GROUP BY t ORDER BY t ASC`),
      // Time-series: Conversions
      aeQuery(accountId, apiToken,
        `SELECT toStartOfInterval(timestamp, INTERVAL ${chartInterval}, 'Europe/Istanbul') AS t, SUM(_sample_interval) AS conversions
         FROM ${DATASET_EVT} WHERE index1 = 'conversion' AND ${timeFilter} AND ${evtTestFilter}
         GROUP BY t ORDER BY t ASC`),
      // Sources: Clicks
      aeQuery(accountId, apiToken,
        `SELECT blob5 AS source, SUM(_sample_interval) AS clicks
         FROM ${DATASET_OPS} WHERE index1 IN (${clickEvents}) AND ${timeFilter} AND ${opsTestFilter}
         GROUP BY source ORDER BY clicks DESC LIMIT 50`),
      // Sources: Conversions
      aeQuery(accountId, apiToken,
        `SELECT blob3 AS source, SUM(_sample_interval) AS conversions
         FROM ${DATASET_EVT} WHERE index1 = 'conversion' AND ${timeFilter} AND ${evtTestFilter}
         GROUP BY source ORDER BY conversions DESC LIMIT 50`)
    ]);

    // Diagnostic logging
    const aeQueryResults = [
      { name: "campaigns", res: campRes },
      { name: "aliases", res: aliasRes },
      { name: "slugs", res: slugRes },
      { name: "traffic_recent", res: trafficRecentRes },
      { name: "events_recent", res: eventsRecentRes },
      { name: "conversions", res: convRes },
      { name: "series_clicks", res: seriesClicksRes },
      { name: "series_conversions", res: seriesConvsRes },
      { name: "source_clicks", res: sourceClicksRes },
      { name: "source_conversions", res: sourceConvsRes },
    ];

    const errors = [];
    let mainFailedCount = 0;
    aeQueryResults.forEach(({ name, res }) => {
      if (res.status === "rejected") {
        mainFailedCount++;
        console.error(`[Analytics API] Query ${name} failed:`, res.reason);
        errors.push({ query: name, error: String(res.reason?.message || res.reason) });
      }
    });

    if (expSummary.status === "rejected") {
      console.error(`[Analytics API] Experiment summary failed:`, expSummary.reason);
      errors.push({ query: "experiments", error: String(expSummary.reason?.message || expSummary.reason) });
    }

    // Only return 502 if ALL main AE queries failed.
    // If at least one main query succeeded, preserve the partial successful data.
    if (mainFailedCount === aeQueryResults.length) {
      return new Response(JSON.stringify({
        ok: false,
        error: "query_failed",
        hint: errors[0]?.error || "All analytics queries failed.",
        errors
      }), {
        status: 502,
        headers: jsonHeaders()
      });
    }

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

    // Merge Time-Series Data (normalized to explicit Europe/Istanbul ISO-8601 with +03:00)
    const chartMap = {};
    getRows(seriesClicksRes).forEach(r => {
      const bucket = normalizeIstanbulBucket(r.t);
      chartMap[bucket] = { t: bucket, clicks: Number(r.clicks), conversions: 0 };
    });
    getRows(seriesConvsRes).forEach(r => {
      const bucket = normalizeIstanbulBucket(r.t);
      if (!chartMap[bucket]) chartMap[bucket] = { t: bucket, clicks: 0, conversions: 0 };
      chartMap[bucket].conversions += Number(r.conversions);
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
        let type = r.event_type || "view";
        if (r.event_type === "traffic_memory" || r.event_type === "traffic") {
          type = "view";
        } else if (r.event_type === "route_redirect") {
          type = "redirect";
        } else if (r.event_type === "signal" || r.slug === "engagement" || r.slug === "time_signal" || r.slug === "scroll" || r.slug === "form_submit") {
          type = "signal";
        }
        const source = r.source || "";
        return {
          ...r,
          event_type: type,
          campaign: r.campaign || r.alias || "—",
          modifier: source ? `${type} · ${source}` : type
        };
      });

    return new Response(JSON.stringify({
      ok: true,
      partial_error: errors.length > 0 ? true : false,
      campaigns: fCampaigns,
      aliases:   filterData(getRows(aliasRes).map(r => ({ ...r, clicks: Number(r.clicks) })), "alias"),
      slugs:     filterData(getRows(slugRes).map(r => ({ ...r, clicks: Number(r.clicks) })), "slug"),
      recent:    fRecent,
      summary: {
        conversions: fConversions,
        total_clicks: fCampaigns.reduce((s, c) => s + c.clicks, 0),
        total_views: fCampaigns.reduce((s, c) => s + c.clicks, 0),
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
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
  for (let i = 0; i < numPoints; i++) {
    const d = new Date(start.getTime() - (numPoints - i) * (isLarge ? 86400000 : 3600000));
    if (isLarge) {
      const parts = dtf.formatToParts(d);
      const y = parts.find(p => p.type === "year").value;
      const m = parts.find(p => p.type === "month").value;
      const day = parts.find(p => p.type === "day").value;
      labels.push(`${y}-${m}-${day}T00:00:00+03:00`);
    } else {
      labels.push(dtf.format(d).replace(", ", "T") + "+03:00");
    }
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
      total_views: campaigns.reduce((s, c) => s + c.clicks, 0),
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
