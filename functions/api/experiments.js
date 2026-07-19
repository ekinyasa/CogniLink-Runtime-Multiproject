/**
 * functions/api/experiments.js — Experiment analytics aggregation endpoint.
 *
 * GET /api/experiments?alias=<alias>
 *
 * Aggregates KV counter data for a given A/B experiment alias and returns
 * per-variant exposure counts, click counts, conversion counts, CTR,
 * conversion rate, lift values, and optional winner detection.
 *
 * Data source: ANALITICS_DATA KV counters written by exp-counter.js:
 *   exp:<alias>:<slug>:exposure    — one per A/B-routed page view
 *   exp:<alias>:<slug>:click       — one per outbound hub link click
 *   exp:<alias>:<slug>:conversion  — one per reported conversion (POST /api/convert)
 *
 * Authentication: Bearer <ADMIN_TOKEN>
 *
 * Response 200:
 *   {
 *     experiment: "abtest",
 *     state: "RUNNING" | "PAUSED" | "DECIDED" | "ARCHIVED",
 *     winner: "cd26-test-yt" | null,       // analytics-computed winner
 *     stored_winner: "cd26-test-yt" | null, // persisted in KV (source of truth for routing)
 *     variants: [ { slug, weight, exposures, clicks, conversions, ctr, conversion_rate,
 *                   lift, conversion_lift, winner? } ]
 *   }
 *
 *   lift              = (variantCTR - baselineCTR) / baselineCTR
 *   conversion_lift   = (variantConvRate - baselineConvRate) / baselineConvRate
 *   both are 0 for baseline, null when baseline denominator is 0
 *
 * Winner detection rules:
 *   • All variants must have ≥ MIN_EXPOSURE exposures (default 30)
 *   • Best variant = highest conversion_rate
 *   • Winner is declared only if best is not baseline AND
 *     (best.conversion_rate − baseline.conversion_rate) > WINNER_THRESHOLD (0.10 absolute)
 *   • This is a heuristic indicator — NOT statistical significance
 *
 * Auto-persistence (analytics → lifecycle bridge):
 *   When a winner is first detected AND the experiment is RUNNING or DECIDED
 *   AND no stored_winner exists yet, this handler fire-and-forgets a KV write:
 *     state → DECIDED, winner → slug, decided_at → unix timestamp
 *   This write is idempotent (skipped if stored_winner already set).
 *
 * Response 400: { error: "invalid_alias" }
 * Response 404: { error: "no_ab_config" }
 */

import { verifyToken, unauthorized, jsonHeaders }  from "../_shared/auth.js";
import { validateAlias }              from "../_shared/validators.js";
import { loadABConfig, getExpState }  from "../_shared/ab-router.js";

const MIN_EXPOSURE     = 30;   // minimum exposures per variant to attempt winner detection
const WINNER_THRESHOLD = 0.10; // minimum absolute conversion_rate advantage over baseline (10 pp)
const AE_CUTOFF_UNIX  = 1773942600; // 2026-03-19 17:50:00 UTC

/**
 * Execute a SQL query against Cloudflare Analytics Engine.
 */
async function aeQuery(accountId, apiToken, sql) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`;
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

const JSON_HEADERS = {
  "Content-Type":           "application/json;charset=UTF-8",
  "Cache-Control":          "no-store",
  "X-Content-Type-Options": "nosniff",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

// ── Auto-persist detected winner into KV ──────────────────────────────────────
//
// Called via context.waitUntil() — does NOT block the response.
// Does a fresh direct KV read to guard against the in-memory cache returning
// a stale record (the cache has a 60 s TTL).  Idempotent: exits silently
// when stored_winner is already set.
//
async function persistDetectedWinner(env, alias, winnerSlug) {
  if (!env?.AB_INDEX || !alias || !winnerSlug) return;
  try {
    // CAS guard: do a fresh direct KV read (bypasses the 60 s in-memory cache)
    // to get the latest stored state before deciding whether to write.
    const current = await env.AB_INDEX.get(`ab_config:${alias}`, { type: "json" });
    if (!current)       return; // config gone — nothing to update

    // CAS guard (Section 2 — Prompt 45):
    // Only write the winner if no stored_winner exists yet.
    // First writer wins — subsequent concurrent workers that also detected a
    // winner (possibly a different one) will skip the write here, ensuring
    // only one winner is ever persisted per experiment.
    if (current.winner) return; // stored_winner already set — skip, first writer wins

    const now     = Math.floor(Date.now() / 1000);
    const updated = {
      ...current,
      status:     "decided",   // simplified status field (Section 2 — Prompt 46)
      state:      "DECIDED",
      winner:     winnerSlug,
      decided_at: now,
      updatedAt:  new Date().toISOString(),
    };
    await env.AB_INDEX.put(`ab_config:${alias}`, JSON.stringify(updated));
  } catch (_) {
    // Silent failure — analytics continues to work without persistence
  }
}

/**
 * Load conversion breakdowns by variant/link via AE.
 */
async function loadAEBreakdowns(accountId, apiToken, alias, datasetEvt) {
  const sql = `
    SELECT blob2 as variant, blob5 as extra, SUM(_sample_interval) as count
    FROM ${datasetEvt}
    WHERE blob1 = '${alias.replace(/'/g, "''")}'
      AND index1 = 'conversion'
      AND toUnixTimestamp(timestamp) > ${AE_CUTOFF_UNIX}
    GROUP BY variant, extra
  `;
  try {
    const { data } = await aeQuery(accountId, apiToken, sql);
    // Format into internal link_conversions array (blob5 is linkId in writeClickEvent)
    const linkConv = (data || [])
      .filter(r => r.extra)
      .map(r => ({ name: r.extra, conversions: Number(r.count) }))
      .sort((a,b) => b.conversions - a.conversions);
    
    return { alias_conversions: [], link_conversions: linkConv };
  } catch (_) {
    return { alias_conversions: [], link_conversions: [] };
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function onRequestGet(context) {
  const { request, env } = context;
  try {
    if (!(await verifyToken(request, env))) return unauthorized();

    const url   = new URL(request.url);
    const alias = (url.searchParams.get("alias") || "").toLowerCase().trim();

    if (!alias || !validateAlias(alias)) return json({ error: "invalid_alias" }, 400);

    // Safeguard: trim credentials in case they have trailing newlines from paste
    const accountId = (env.CF_ACCOUNT_ID   || "").trim();
    const apiToken  = (env.CF_AE_API_TOKEN || "").trim();

    if (!accountId || !apiToken) {
      return json({ error: "ae_credentials_missing", hint: "Set CF_ACCOUNT_ID and CF_AE_API_TOKEN" }, 503);
    }

    const envName = (env.ENV_NAME || "dev").toLowerCase();
    const isProd = envName === "production";
    const datasetOps = isProd ? "cognilink_runtime_traffic_prod" : `ae_traffic_${envName}`;
    const datasetEvt = isProd ? "cognilink_runtime_conversion_prod" : `ae_conversion_${envName}`;

    // Load A/B config to get the ordered variant list (uses in-memory cache)
    const abConfig = await loadABConfig(alias, env);
    if (!abConfig) return json({ error: "no_ab_config" }, 404);

    const slugs = abConfig.variants.map((v) => v.slug);
    
    // ── Query AE for variant performance (Partitioned V4) ───────────────────────
    const sqlExp = `
      SELECT blob2 AS variant, SUM(_sample_interval) AS count
      FROM ${datasetOps}
      WHERE blob1 = '${alias.replace(/'/g, "''")}' AND index1 = 'ab_selected'
        AND toUnixTimestamp(timestamp) > 0
      GROUP BY blob2
    `;

    const sqlEvt = `
      SELECT index1 AS event_type, blob2 AS variant, SUM(_sample_interval) AS count
      FROM ${datasetEvt}
      WHERE blob1 = '${alias.replace(/'/g, "''")}' AND index1 IN ('click', 'conversion')
        AND toUnixTimestamp(timestamp) > 0
      GROUP BY index1, blob2
    `;

    const [aeResExp, aeResEvt, breakdowns] = await Promise.all([
      aeQuery(accountId, apiToken, sqlExp).catch(() => ({ data: [] })),
      aeQuery(accountId, apiToken, sqlEvt).catch(() => ({ data: [] })),
      loadAEBreakdowns(accountId, apiToken, alias, datasetEvt),
    ]);

    // Map flat AE data to variant performance map
    const statsMap = {};
    slugs.forEach(s => { statsMap[s] = { exposures: 0, clicks: 0, conversions: 0 }; });

    (aeResExp.data || []).forEach(row => {
      const v = row.variant || "";
      const count = Number(row.count) || 0;
      if (statsMap[v]) statsMap[v].exposures += count;
    });

    (aeResEvt.data || []).forEach(row => {
      const v = row.variant || "";
      const type = row.event_type;
      const count = Number(row.count) || 0;
      if (statsMap[v]) {
        if (type === "click") statsMap[v].clicks += count;
        else if (type === "conversion") statsMap[v].conversions += count;
      }
    });

    // Calculate rates for all variants

    // Calculate rates for all variants
    const raw = slugs.map(slug => {
      const s = statsMap[slug];
      const ctr = s.exposures > 0 ? Math.round((s.clicks / s.exposures) * 10000) / 10000 : 0;
      const conversion_rate = s.exposures > 0 ? Math.round((s.conversions / s.exposures) * 10000) / 10000 : 0;
      return { slug, ...s, ctr, conversion_rate };
    });

    // ── Lift calculations (baseline = first variant) ──────────────────────────
    const baselineCtr    = raw[0]?.ctr             ?? 0;
    const baselineConvR  = raw[0]?.conversion_rate ?? 0;

    // ── Winner detection ──────────────────────────────────────────────────────
    let winnerSlug = null;
    const allMeetThreshold = raw.length >= 2 && raw.every((v) => v.exposures >= MIN_EXPOSURE);
    if (allMeetThreshold) {
      let bestConvR = baselineConvR;
      let bestSlug  = raw[0]?.slug ?? null;
      for (let i = 1; i < raw.length; i++) {
        if (raw[i].conversion_rate > bestConvR) {
          bestConvR = raw[i].conversion_rate;
          bestSlug  = raw[i].slug;
        }
      }
      const baselineSlug = raw[0]?.slug ?? null;
      if (bestSlug !== baselineSlug && (bestConvR - baselineConvR) > WINNER_THRESHOLD) {
        winnerSlug = bestSlug;
      }
    }

    // ── Analytics → lifecycle bridge ──────────────────────────────────────────
    const currentStoredWinner = (typeof abConfig.winner === "string" && abConfig.winner)
      ? abConfig.winner : null;
    const stateFromKV = getExpState(abConfig);

    let effectiveStoredWinner = currentStoredWinner;
    if (winnerSlug && !currentStoredWinner
        && (stateFromKV === "RUNNING" || stateFromKV === "DECIDED")) {
      effectiveStoredWinner = winnerSlug;
      context.waitUntil(persistDetectedWinner(env, alias, winnerSlug));
    }

    // ── Assemble variant objects ──────────────────────────────────────────────
    const variants = raw.map((v, i) => {
      let lift;
      if (i === 0) {
        lift = 0;
      } else if (baselineCtr > 0) {
        lift = Math.round(((v.ctr - baselineCtr) / baselineCtr) * 10000) / 10000;
      } else {
        lift = null;
      }

      let conversion_lift;
      if (i === 0) {
        conversion_lift = 0;
      } else if (baselineConvR > 0) {
        conversion_lift = Math.round(((v.conversion_rate - baselineConvR) / baselineConvR) * 10000) / 10000;
      } else {
        conversion_lift = null;
      }

      return {
        slug:             v.slug,
        weight:           abConfig.variants[i]?.weight ?? null,
        exposures:        v.exposures,
        clicks:           v.clicks,
        conversions:      v.conversions,
        ctr:              v.ctr,
        conversion_rate:  v.conversion_rate,
        lift,
        conversion_lift,
        ...(v.slug === winnerSlug ? { winner: true } : {}),
      };
    });

    const effectiveState = effectiveStoredWinner && stateFromKV === "RUNNING"
      ? "DECIDED"
      : stateFromKV;

    const effectiveWinner = effectiveState === "DECIDED"
      ? (effectiveStoredWinner ?? winnerSlug)
      : winnerSlug;

    const createdAt = abConfig.created_at ?? abConfig.decided_at ?? null;
    const status = (effectiveState === "DECIDED" || effectiveState === "ARCHIVED")
      ? "decided" : "open";

    return json({
      experiment:    alias,
      state:         effectiveState,
      status,
      winner:        effectiveWinner,
      stored_winner: effectiveStoredWinner,
      shard_count:   abConfig.shard_count ?? 10,
      created_at:    createdAt,
      decided_at:    abConfig.decided_at  ?? null,
      archived_at:   abConfig.archived_at ?? null,
      variants,
      ...(abConfig.strategy != null ? { strategy: abConfig.strategy } : {}),
      ...(abConfig.epsilon  != null ? { epsilon:  abConfig.epsilon  } : {}),
      alias_conversions: breakdowns.alias_conversions,
      link_conversions:  breakdowns.link_conversions,
    });

  } catch (err) {
    console.error("[experiments-api] fatal error:", err);
    return json({ 
      error: "internal_server_error", 
      message: err.message,
      stack: err.stack ? err.stack.slice(0, 300) : null
    }, 500);
  }
}
