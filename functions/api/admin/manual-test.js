/**
 * /api/admin/manual-test — Layer 3: Deterministic Manual Validation
 *
 * POST → Timestamp-based analytics verification using an isolated test fixture.
 *   1. Creates (or reuses) a fixture: unique test alias + campaign
 *   2. Records test_start timestamp
 *   3. Fires a known click sequence (/test-{hex} ×2, /test-{hex}/offer, /test-{hex}/vsl)
 *   4. Uses retryWithBackoff (~95s) to query AE for events since test_start
 *   5. Filters by fixture alias + campaign for complete isolation
 *   6. Archives the fixture after the test
 *
 * GET ?action=link-check&alias={alias} → Hub link integrity check
 *   Fetches the hub page for the given alias and probes each external link.
 *
 * Authentication: Bearer <ADMIN_TOKEN>
 *
 * POST response shape:
 *   {
 *     ok: boolean,
 *     checks: {
 *       alias_delta_correct:     boolean,
 *       modifier_counts_correct: boolean,
 *       events_detected:         boolean
 *     },
 *     expected: { alias: 4, offer: 1, vsl: 1 },
 *     observed: { alias: number, offer: number, vsl: number },
 *     fixture:  { alias, campaign },
 *     duration_ms: number,
 *     warnings: string[]
 *   }
 *
 * GET link-check response shape:
 *   { ok: true, alias: string, links: [{ url, status, ok, state }] }
 *
 * AE ingestion latency note (measured 2026-03):
 *   Analytics Engine events appear 52–57 seconds after the router hit.
 *   retryWithBackoff provides a ~95s retry window to accommodate this.
 */

import { verifyToken, unauthorized, jsonHeaders } from "../../_shared/auth.js";
import { checkHubLinks }                          from "../../_shared/test-runner.js";
import { retryWithBackoff }                       from "../../_shared/retry.js";
import { createFixture, archiveFixture }          from "../../_shared/fixture.js";

const AE_SQL_BASE = "https://api.cloudflare.com/client/v4/accounts";
const DATASET     = "linkhub_ops_events";

// Expected minimums after the 4-click sequence
const EXPECTED = { alias: 4, offer: 1, vsl: 1 };

// ── Helpers ────────────────────────────────────────────────────────────────────

async function aePost(accountId, apiToken, sql) {
  const res = await fetch(
    `${AE_SQL_BASE}/${accountId}/analytics_engine/sql`,
    {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${apiToken}`,
        "Content-Type": "text/plain",
      },
      body: sql,
    }
  );
  if (!res.ok) {
    const hint = await res.text().catch(() => "");
    throw new Error(`AE ${res.status}: ${hint.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * Format a timestamp (ms) as 'YYYY-MM-DD HH:MM:SS' (UTC) for AE SQL comparisons.
 * ClickHouse / AE accepts this DateTime literal format.
 */
function fmtTs(ms) {
  return new Date(ms).toISOString().replace("T", " ").slice(0, 19);
}

/**
 * Query alias total clicks and modifier breakdown for events that occurred
 * at or after (testStartMs - 5 seconds) for the given fixture alias + campaign.
 *
 * The 5-second buffer protects against clock drift.
 * Filtering by both alias and campaign ensures complete isolation from
 * any production traffic that might share the alias in the future.
 *
 * Returns { total, offer, vsl } counts.
 */
async function queryEventsSince(accountId, apiToken, testStartMs, alias, campaign, env) {
  // Subtract 5 seconds to guard against clock drift (PART 3)
  const since = fmtTs(testStartMs - 5_000);

  const envName = (env.ENV_NAME || "dev").toLowerCase();
  const isProd = envName === "production";
  const dataset = isProd ? "cognilink_runtime_traffic_prod" : `ae_traffic_${envName}`;

  const [totalJson, modJson] = await Promise.all([
    aePost(accountId, apiToken,
      `SELECT COUNT() AS cnt
       FROM ${dataset}
       WHERE index1 = 'traffic_memory'
         AND blob1 = '${alias}'
         AND blob4 = '${campaign}'
         AND timestamp >= '${since}'`
    ),
    aePost(accountId, apiToken,
      `SELECT blob3 AS modifier, COUNT() AS cnt
       FROM ${dataset}
       WHERE index1 = 'traffic_memory'
         AND blob1 = '${alias}'
         AND blob4 = '${campaign}'
         AND blob3 != ''
         AND timestamp >= '${since}'
       GROUP BY blob3`
    ),
  ]);

  const total = Number(totalJson?.data?.[0]?.cnt ?? 0);
  const byMod = {};
  for (const row of (modJson?.data ?? [])) {
    byMod[row.modifier] = Number(row.cnt || 0);
  }

  return {
    total,
    offer: byMod["offer"] ?? 0,
    vsl:   byMod["vsl"]   ?? 0,
  };
}

/**
 * Fire the test click sequence for the given alias.
 * Each URL tagged with ?test_run=1 for log filtering.
 * 150ms pause between requests prevents AE event-collapse when all four
 * events land within the same millisecond bucket.
 * Returns { ok, failures }.
 */
async function fireClickSequence(baseUrl, alias) {
  const paths = [
    `/${alias}?test_run=1`,
    `/${alias}?test_run=1`,
    `/${alias}/offer?test_run=1`,
    `/${alias}/vsl?test_run=1`,
  ];

  const sleep    = (ms) => new Promise((r) => setTimeout(r, ms));
  const failures = [];
  for (let i = 0; i < paths.length; i++) {
    if (i > 0) await sleep(150);          // 150ms gap — guarantees distinct AE timestamps
    const path = paths[i];
    try {
      const res = await fetch(`${baseUrl}${path}`, { redirect: "follow" });
      if (res.status !== 200 && res.status !== 302) {
        failures.push(`${path} → HTTP ${res.status}`);
      }
    } catch (err) {
      failures.push(`${path} → ${err?.message ?? "network error"}`);
    }
  }
  return { ok: failures.length === 0, failures };
}

// ── Core validation logic (exported for use by system-test.js) ────────────────

/**
 * Run the manual deterministic validation.
 *
 * If a fixture is provided (by system-test.js), reuses it.
 * If no fixture is provided, creates one and archives it after the test.
 *
 * @param {object}  env     — Cloudflare Pages env bindings
 * @param {Request} request — Incoming request (used to derive base URL)
 * @param {object}  [fixture] — Optional pre-created fixture from system-test.js
 */
export async function runManualTest(env, request, fixture = null) {
  const t0       = Date.now();
  const warnings = [];
  const baseUrl  = new URL(request.url).origin;

  const accountId = env.CF_ACCOUNT_ID   || "";
  const apiToken  = env.CF_AE_API_TOKEN || "";

  if (!accountId || !apiToken) {
    return {
      ok:       false,
      error:    "not_configured",
      hint:     "Set CF_ACCOUNT_ID and CF_AE_API_TOKEN in Pages dashboard",
      duration_ms: Date.now() - t0,
    };
  }

  // ── 1. Fixture setup ───────────────────────────────────────────────────────
  let ownFixture  = null;       // fixture we created — our responsibility to archive
  let activeFixture = fixture;  // the fixture we'll actually use

  if (!activeFixture) {
    try {
      ownFixture = await createFixture(env);
      activeFixture = ownFixture;
    } catch (err) {
      warnings.push(`Fixture creation failed: ${err?.message ?? "unknown"}`);
      // Fallback to a hard-coded alias if fixture creation fails
      activeFixture = { alias: "nb", campaign: "new-beta" };
    }
  }

  const { alias, campaign } = activeFixture;

  // ── 2. Record test start timestamp ────────────────────────────────────────
  const testStartMs = Date.now();

  // ── 3. Fire click sequence ─────────────────────────────────────────────────
  const fireResult = await fireClickSequence(baseUrl, alias);
  if (!fireResult.ok) {
    warnings.push(`Some trigger requests failed: ${fireResult.failures.join("; ")}`);
  }

  // ── 4. Retry AE until expected events appear (timestamp-based) ────────────
  const aeResult = await retryWithBackoff(async () => {
    const { total, offer, vsl } = await queryEventsSince(
      accountId, apiToken, testStartMs, alias, campaign, env
    );
    const ok = total >= EXPECTED.alias && offer >= EXPECTED.offer && vsl >= EXPECTED.vsl;
    return { ok, total, offer, vsl };
  });

  if (!aeResult.ok) {
    warnings.push(
      "Manual validation timeout. Events may appear after the retry window " +
      "due to Analytics Engine ingestion delay."
    );
  }

  // ── 5. Validate results ────────────────────────────────────────────────────
  const observed = {
    alias: aeResult.total ?? 0,
    offer: aeResult.offer ?? 0,
    vsl:   aeResult.vsl   ?? 0,
  };

  const alias_delta_correct     = observed.alias >= EXPECTED.alias;
  const modifier_counts_correct = observed.offer >= EXPECTED.offer && observed.vsl >= EXPECTED.vsl;
  const events_detected         = observed.alias > 0;

  const ok = alias_delta_correct && modifier_counts_correct && events_detected;

  // ── 6. Archive own fixture (if we created it) ──────────────────────────────
  if (ownFixture) {
    await archiveFixture(env, ownFixture).catch(err => {
      warnings.push(`Fixture archival failed: ${err?.message ?? "unknown"}`);
    });
  }

  return {
    ok,
    checks: { alias_delta_correct, modifier_counts_correct, events_detected },
    expected: { alias: EXPECTED.alias, offer: EXPECTED.offer, vsl: EXPECTED.vsl },
    observed,
    fixture: { alias, campaign, slug: activeFixture.slug ?? null }, // PART 2: include slug directly
    duration_ms: Date.now() - t0,
    warnings,
  };
}

// ── Link check handler ─────────────────────────────────────────────────────────

async function handleLinkCheck(env, request) {
  const url   = new URL(request.url);
  const alias = (url.searchParams.get("alias") || "nb").trim().replace(/[^a-z0-9-]/gi, "");

  const baseUrl = url.origin;
  const links   = await checkHubLinks(baseUrl, alias);

  return { ok: true, alias, links };
}

// ── Entrypoint ─────────────────────────────────────────────────────────────────

export async function onRequest(context) {
  const { request, env } = context;

  if (!verifyToken(request, env)) return unauthorized();

  const method = request.method;

  // GET ?action=link-check&alias=nb
  if (method === "GET") {
    const url    = new URL(request.url);
    const action = url.searchParams.get("action");
    if (action === "link-check") {
      const result = await handleLinkCheck(env, request);
      return new Response(JSON.stringify(result), { status: 200, headers: jsonHeaders() });
    }
    return new Response(
      JSON.stringify({ ok: false, error: "unknown_action", hint: "Use ?action=link-check&alias=nb" }),
      { status: 400, headers: jsonHeaders() }
    );
  }

  // POST → fixture-based manual validation
  if (method === "POST") {
    const result = await runManualTest(env, request);
    return new Response(JSON.stringify(result), { status: 200, headers: jsonHeaders() });
  }

  return new Response(
    JSON.stringify({ ok: false, error: "method_not_allowed" }),
    { status: 405, headers: { ...jsonHeaders(), Allow: "GET, POST" } }
  );
}
