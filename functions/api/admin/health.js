/**
 * /api/admin/health — Lightweight operational health endpoint.
 *
 * Designed for monitoring tools and uptime checks.
 * No authentication required — safe to expose publicly (no sensitive data).
 *
 * Checks performed (all quick — no retry loops):
 *   router    — single GET probe on a known alias (fast, 1 attempt)
 *   kv        — .list({limit:1}) on ROUTE_ALIAS + LANDING_CONFIG
 *   analytics — single AE SQL query (no retry, no wait)
 *
 * Response shape:
 *   {
 *     ok:         boolean,
 *     router:     "ok"|"error",
 *     kv:         "ok"|"error",
 *     analytics:  "ok"|"error",
 *     deployment: string,   // CF_PAGES_COMMIT_SHA or "dev"
 *     version:    string,   // same as deployment
 *     timestamp:  string    // server ISO time
 *   }
 *
 * HTTP 200 always — ok field carries the health signal.
 * Callers should alert when ok is false.
 */

const AE_SQL_BASE = "https://api.cloudflare.com/client/v4/accounts";
const DATASET     = "linkhub_ops_events";
const PROBE_ALIAS = "nb";   // known production alias used for router health check

// ── Helpers ────────────────────────────────────────────────────────────────────

function jsonHeaders() {
  return {
    "Content-Type":           "application/json;charset=UTF-8",
    "Cache-Control":          "no-store",
    "X-Content-Type-Options": "nosniff",
  };
}

async function checkRouter(baseUrl) {
  try {
    const res = await fetch(`${baseUrl}/${PROBE_ALIAS}`, { redirect: "follow" });
    return res.status === 200 || res.status === 302 ? "ok" : "error";
  } catch {
    return "error";
  }
}

async function checkKv(env) {
  const namespaces = [
    { key: "ROUTE_ALIAS",   ns: env.ROUTE_ALIAS   },
    { key: "LANDING_CONFIG", ns: env.LANDING_CONFIG },
  ];
  for (const { ns } of namespaces) {
    if (!ns || typeof ns.list !== "function") return "error";
    try {
      await ns.list({ limit: 1 });
    } catch {
      return "error";
    }
  }
  return "ok";
}

async function checkAnalytics(env) {
  const accountId = env.CF_ACCOUNT_ID   || "";
  const apiToken  = env.CF_AE_API_TOKEN || "";
  if (!accountId || !apiToken) return "error";

  const envName = (env.ENV_NAME || "dev").toLowerCase();
  const isProd = envName === "production";
  const dataset = isProd ? "cognilink_runtime_traffic_prod" : `ae_traffic_${envName}`;

  try {
    const res = await fetch(
      `${AE_SQL_BASE}/${accountId}/analytics_engine/sql`,
      {
        method:  "POST",
        headers: {
          Authorization:  `Bearer ${apiToken}`,
          "Content-Type": "text/plain",
        },
        body: `SELECT COUNT() AS cnt FROM ${dataset} WHERE timestamp > now() - INTERVAL '1' MINUTE`,
      }
    );
    return res.ok ? "ok" : "error";
  } catch {
    return "error";
  }
}

// ── Entrypoint ─────────────────────────────────────────────────────────────────

export async function onRequest(context) {
  const { request, env } = context;

  // Only GET and HEAD are meaningful for health checks
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(
      JSON.stringify({ ok: false, error: "method_not_allowed" }),
      { status: 405, headers: { ...jsonHeaders(), Allow: "GET, HEAD" } }
    );
  }

  const baseUrl    = new URL(request.url).origin;
  const deployment = env.CF_PAGES_COMMIT_SHA || env.CF_DEPLOYMENT_ID || "dev";

  // Run all checks in parallel for minimal latency
  const [router, kv, analytics] = await Promise.all([
    checkRouter(baseUrl),
    checkKv(env),
    checkAnalytics(env),
  ]);

  const ok = router === "ok" && kv === "ok" && analytics === "ok";

  const body = JSON.stringify({
    ok,
    router,
    kv,
    analytics,
    deployment,
    version:   deployment,
    timestamp: new Date().toISOString(),
  });

  return new Response(request.method === "HEAD" ? null : body, {
    status:  200,
    headers: jsonHeaders(),
  });
}
