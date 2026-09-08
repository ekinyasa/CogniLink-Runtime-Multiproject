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
const PROBE_ALIAS = "yenile";   // known production alias used for router health check

// ── Helpers ────────────────────────────────────────────────────────────────────

function jsonHeaders() {
  return {
    "Content-Type":           "application/json;charset=UTF-8",
    "Cache-Control":          "no-store",
    "X-Content-Type-Options": "nosniff",
  };
}

async function checkRouter(baseUrl, env) {
  const isNilufer = env?.PROJECT_ID === "nilufer" || env?.ROOT_DOMAIN?.includes("niluferormanli");
  const probePath = isNilufer ? "coming-soon" : PROBE_ALIAS;
  try {
    const res = await fetch(`${baseUrl}/${probePath}`, { redirect: "follow" });
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
  const defaultProdDataset = (env.PROJECT_ID === "nilufer" || env.ROOT_DOMAIN?.includes("niluferormanli"))
    ? "cognilink_nilufer_traffic_prod"
    : "cognilink_runtime_traffic_prod";
  const dataset = isProd ? (env.AE_TRAFFIC_DATASET || defaultProdDataset) : `ae_traffic_${envName}`;

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

async function checkD1(env) {
  if (!env.DB || typeof env.DB.prepare !== "function") return "NOT AVAILABLE";
  try {
    const res = await env.DB.prepare("SELECT 1").first();
    return res ? "ok" : "error";
  } catch {
    return "error";
  }
}

async function checkKvStatus(ns) {
  if (!ns || typeof ns.list !== "function") return "NOT AVAILABLE";
  try {
    await ns.list({ limit: 1 });
    return "ok";
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
    checkRouter(baseUrl, env),
    checkKv(env),
    checkAnalytics(env),
  ]);

  const ok = router === "ok" && kv === "ok" && analytics === "ok";

  const d1Status = await checkD1(env);
  const kvBindings = [
    { name: "ROUTE_ALIAS", ns: env.ROUTE_ALIAS },
    { name: "LANDING_CONFIG", ns: env.LANDING_CONFIG },
    { name: "APP_CONFIG", ns: env.APP_CONFIG }
  ];

  const kvStatusObj = {};
  for (const item of kvBindings) {
    kvStatusObj[item.name] = await checkKvStatus(item.ns);
  }

  const gitCommit = env.CF_PAGES_COMMIT_SHA || "NOT AVAILABLE";
  const gitShort = gitCommit !== "NOT AVAILABLE" ? gitCommit.slice(0, 7) : "NOT AVAILABLE";

  const identity = {
    application: "CogniLink",
    environment: env.ENV_NAME || (env.CF_PAGES_COMMIT_SHA ? "production" : "local"),
    git_commit: gitCommit,
    git_short_sha: gitShort,
    branch: env.CF_PAGES_BRANCH || "NOT AVAILABLE",
    deployment_id: env.CF_DEPLOYMENT_ID || "NOT AVAILABLE",
    deployment_time: env.CF_PAGES_BUILD_TIMESTAMP || "NOT AVAILABLE",
    runtime_version: "NOT AVAILABLE",
    primary_runtime_domain: env.ROOT_DOMAIN || "trafik.teklifi.online",
    current_request_host: request.headers.get("Host") || request.headers.get("x-forwarded-host") || new URL(request.url).host || "NOT AVAILABLE",
    cloudflare_context: env.CF_PAGES_COMMIT_SHA ? "Pages" : "NOT AVAILABLE",
    database: {
      binding: "DB",
      status: d1Status
    },
    kv: kvStatusObj,
    router: router,
    analytics: analytics,
    build_schema_version: "NOT AVAILABLE",
    overall: ok ? "OK" : "DEGRADED"
  };

  const body = JSON.stringify({
    ok,
    router,
    kv,
    analytics,
    deployment,
    version:   deployment,
    timestamp: new Date().toISOString(),
    identity
  });

  return new Response(request.method === "HEAD" ? null : body, {
    status:  200,
    headers: jsonHeaders(),
  });
}
