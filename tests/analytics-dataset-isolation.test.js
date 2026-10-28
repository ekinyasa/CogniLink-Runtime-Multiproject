import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveProjectId,
  getAnalyticsDataset,
  getAnalyticsDatasets,
} from "../functions/_shared/analytics.js";
import { onRequestGet as handleAnalyticsGet } from "../functions/api/admin/analytics.js";

test("Analytics Dataset Isolation: resolveProjectId", async (t) => {
  await t.test("resolves nilufer project from PROJECT_ID", () => {
    const env = { PROJECT_ID: "nilufer", ENV_NAME: "production" };
    assert.equal(resolveProjectId(env), "nilufer");
  });

  await t.test("resolves nilufer project from ROOT_DOMAIN when PROJECT_ID omitted", () => {
    const env = { ROOT_DOMAIN: "niluferormanli.com", ENV_NAME: "production" };
    assert.equal(resolveProjectId(env), "nilufer");
  });

  await t.test("resolves nilufer project for subdomains of niluferormanli.com", () => {
    const env = { ROOT_DOMAIN: "hal.niluferormanli.com", ENV_NAME: "production" };
    assert.equal(resolveProjectId(env), "nilufer");
  });

  await t.test("resolves runtime project from PROJECT_ID", () => {
    const env = { PROJECT_ID: "runtime", ENV_NAME: "production" };
    assert.equal(resolveProjectId(env), "runtime");
  });

  await t.test("resolves runtime project from ROOT_DOMAIN", () => {
    const env = { ROOT_DOMAIN: "trafik.teklifi.online", ENV_NAME: "production" };
    assert.equal(resolveProjectId(env), "runtime");
  });

  await t.test("throws on contradictory PROJECT_ID and ROOT_DOMAIN", () => {
    const env = {
      PROJECT_ID: "nilufer",
      ROOT_DOMAIN: "trafik.teklifi.online",
      ENV_NAME: "production",
    };
    assert.throws(
      () => resolveProjectId(env),
      /Contradictory project configuration/
    );
  });

  await t.test("throws on unsupported PROJECT_ID in production", () => {
    const env = {
      PROJECT_ID: "some_random_project",
      ENV_NAME: "production",
    };
    assert.throws(
      () => resolveProjectId(env),
      /unsupported PROJECT_ID/i
    );
  });

  await t.test("throws on missing PROJECT_ID in production without inferrable ROOT_DOMAIN", () => {
    const env = {
      ENV_NAME: "production",
      ROOT_DOMAIN: "example.com",
    };
    assert.throws(
      () => resolveProjectId(env),
      /PROJECT_ID is not configured/
    );
  });

  await t.test("returns null in non-production when unspecified", () => {
    const env = { ENV_NAME: "dev" };
    assert.equal(resolveProjectId(env), null);
  });
});

test("Analytics Dataset Isolation: getAnalyticsDataset & getAnalyticsDatasets", async (t) => {
  await t.test("strictly returns nilufer datasets for Nilüfer production", () => {
    const env = { PROJECT_ID: "nilufer", ENV_NAME: "production" };
    const traffic = getAnalyticsDataset(env, "traffic");
    const conversion = getAnalyticsDataset(env, "conversion");
    const experiment = getAnalyticsDataset(env, "experiment");

    assert.equal(traffic, "cognilink_nilufer_traffic_prod");
    assert.equal(conversion, "cognilink_nilufer_conversion_prod");
    assert.equal(experiment, "cognilink_nilufer_experiment_prod");

    const all = getAnalyticsDatasets(env);
    assert.equal(all.traffic, "cognilink_nilufer_traffic_prod");
    assert.equal(all.conversion, "cognilink_nilufer_conversion_prod");
    assert.equal(all.experiment, "cognilink_nilufer_experiment_prod");
    assert.equal(all.datasetOps, "cognilink_nilufer_traffic_prod");
    assert.equal(all.datasetEvt, "cognilink_nilufer_conversion_prod");
    assert.equal(all.datasetExp, "cognilink_nilufer_experiment_prod");
  });

  await t.test("returns runtime datasets for Runtime production", () => {
    const env = { PROJECT_ID: "runtime", ENV_NAME: "production" };
    assert.equal(getAnalyticsDataset(env, "traffic"), "cognilink_runtime_traffic_prod");
    assert.equal(getAnalyticsDataset(env, "conversion"), "cognilink_runtime_conversion_prod");
    assert.equal(getAnalyticsDataset(env, "experiment"), "cognilink_runtime_experiment_prod");
  });

  await t.test("returns dev/preview dataset in non-production", () => {
    const env = { ENV_NAME: "staging" };
    assert.equal(getAnalyticsDataset(env, "traffic"), "ae_traffic_staging");
    assert.equal(getAnalyticsDataset(env, "conversion"), "ae_conversion_staging");
    assert.equal(getAnalyticsDataset(env, "experiment"), "ae_experiment_staging");
  });

  await t.test("rejects cross-project contamination override (runtime dataset in nilufer project)", () => {
    const env = {
      PROJECT_ID: "nilufer",
      ENV_NAME: "production",
      AE_TRAFFIC_DATASET: "cognilink_runtime_traffic_prod",
    };
    assert.throws(
      () => getAnalyticsDataset(env, "traffic"),
      /must explicitly belong to the nilufer project/
    );
  });

  await t.test("rejects cross-project contamination override (nilufer dataset in runtime project)", () => {
    const env = {
      PROJECT_ID: "runtime",
      ENV_NAME: "production",
      AE_TRAFFIC_DATASET: "cognilink_nilufer_traffic_prod",
    };
    assert.throws(
      () => getAnalyticsDataset(env, "traffic"),
      /must explicitly belong to the runtime project/
    );
  });

  await t.test("rejects invalid SQL identifier in dataset override", () => {
    const invalidNames = [
      "has-dashes-invalid",
      "has spaces invalid",
      "semi;colon",
      "1start_with_digit",
      "quotes'in'identifier",
      "a".repeat(65),
    ];
    for (const name of invalidNames) {
      assert.throws(
        () => getAnalyticsDataset({ PROJECT_ID: "nilufer", ENV_NAME: "production", AE_TRAFFIC_DATASET: name }, "traffic"),
        /Must be a valid SQL identifier/
      );
    }
  });

  await t.test("rejects override in production without explicit project ownership", () => {
    // In nilufer production, dataset must start with cognilink_nilufer_ or nilufer_
    const envNilufer = {
      PROJECT_ID: "nilufer",
      ENV_NAME: "production",
      AE_TRAFFIC_DATASET: "arbitrary_external_dataset",
    };
    assert.throws(
      () => getAnalyticsDataset(envNilufer, "traffic"),
      /must explicitly belong to the nilufer project/
    );

    // In runtime production, dataset must start with cognilink_runtime_ or runtime_
    const envRuntime = {
      PROJECT_ID: "runtime",
      ENV_NAME: "production",
      AE_TRAFFIC_DATASET: "arbitrary_external_dataset",
    };
    assert.throws(
      () => getAnalyticsDataset(envRuntime, "traffic"),
      /must explicitly belong to the runtime project/
    );
  });

  await t.test("rejects non-production environment targeting production datasets", () => {
    const env = {
      ENV_NAME: "staging",
      AE_TRAFFIC_DATASET: "cognilink_nilufer_traffic_prod",
    };
    assert.throws(
      () => getAnalyticsDataset(env, "traffic"),
      /Non-production environment 'staging' cannot target production datasets/
    );
  });

  await t.test("accepts valid custom override with explicit project ownership in production", () => {
    const env1 = {
      PROJECT_ID: "nilufer",
      ENV_NAME: "production",
      AE_TRAFFIC_DATASET: "cognilink_nilufer_traffic_v2",
    };
    assert.equal(getAnalyticsDataset(env1, "traffic"), "cognilink_nilufer_traffic_v2");

    const env2 = {
      PROJECT_ID: "nilufer",
      ENV_NAME: "production",
      AE_TRAFFIC_DATASET: "nilufer_traffic_v2",
    };
    assert.equal(getAnalyticsDataset(env2, "traffic"), "nilufer_traffic_v2");

    const envRuntime = {
      PROJECT_ID: "runtime",
      ENV_NAME: "production",
      AE_TRAFFIC_DATASET: "cognilink_runtime_traffic_v2",
    };
    assert.equal(getAnalyticsDataset(envRuntime, "traffic"), "cognilink_runtime_traffic_v2");
  });

  await t.test("accepts valid non-production override", () => {
    const env = {
      ENV_NAME: "staging",
      AE_TRAFFIC_DATASET: "ae_traffic_custom_staging",
    };
    assert.equal(getAnalyticsDataset(env, "traffic"), "ae_traffic_custom_staging");
  });
});

test("Pulse API: Query Error vs Zero Data Differentiation", async (t) => {
  const originalFetch = globalThis.fetch;

  t.afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  await t.test("production missing credentials returns HTTP 503 not_configured and no mock data", async () => {
    const req = new Request("https://niluferormanli.com/api/admin/analytics", {
      headers: { Authorization: "Bearer test-admin-token" },
    });
    const env = {
      ADMIN_TOKEN: "test-admin-token",
      ENV_NAME: "production",
      PROJECT_ID: "nilufer",
      // CF_ACCOUNT_ID and CF_AE_API_TOKEN intentionally missing
    };

    const res = await handleAnalyticsGet({ request: req, env });
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.equal(body.error, "not_configured");
    assert.equal(body.is_mock, false);
  });

  await t.test("configuration error in production returns HTTP 500 configuration_error", async () => {
    const req = new Request("https://niluferormanli.com/api/admin/analytics", {
      headers: { Authorization: "Bearer test-admin-token" },
    });
    const env = {
      ADMIN_TOKEN: "test-admin-token",
      ENV_NAME: "production",
      PROJECT_ID: "nilufer",
      ROOT_DOMAIN: "trafik.teklifi.online", // contradictory!
      CF_ACCOUNT_ID: "acc123",
      CF_AE_API_TOKEN: "tok123",
    };

    const res = await handleAnalyticsGet({ request: req, env });
    assert.equal(res.status, 500);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.equal(body.error, "configuration_error");
  });

  await t.test("total query failure returns HTTP 502 query_failed (never masqueraded as 0 traffic)", async () => {
    globalThis.fetch = async () => {
      return new Response("AE SQL service unavailable", { status: 500 });
    };

    const req = new Request("https://niluferormanli.com/api/admin/analytics", {
      headers: { Authorization: "Bearer test-admin-token" },
    });
    const env = {
      ADMIN_TOKEN: "test-admin-token",
      ENV_NAME: "production",
      PROJECT_ID: "nilufer",
      CF_ACCOUNT_ID: "acc123",
      CF_AE_API_TOKEN: "tok123",
    };

    const res = await handleAnalyticsGet({ request: req, env });
    assert.equal(res.status, 502);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.equal(body.error, "query_failed");
    assert.ok(Array.isArray(body.errors));
    assert.ok(body.errors.length > 0);
  });

  await t.test("partial query failure returns HTTP 200 with partial_error: true and errors array", async () => {
    let callCount = 0;
    globalThis.fetch = async (url, opts) => {
      callCount++;
      // Fail the 1st query (campaigns), succeed the others
      if (callCount === 1) {
        return new Response("Query 1 failed", { status: 500 });
      }
      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const req = new Request("https://niluferormanli.com/api/admin/analytics", {
      headers: { Authorization: "Bearer test-admin-token" },
    });
    const env = {
      ADMIN_TOKEN: "test-admin-token",
      ENV_NAME: "production",
      PROJECT_ID: "nilufer",
      CF_ACCOUNT_ID: "acc123",
      CF_AE_API_TOKEN: "tok123",
    };

    const res = await handleAnalyticsGet({ request: req, env });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.partial_error, true);
    assert.ok(Array.isArray(body.errors));
    assert.equal(body.errors.length, 1);
    assert.equal(body.errors[0].query, "campaigns");
  });

  await t.test("active experiment SQL failure reports partial_error and does not swallow error", async () => {
    // Mock AB_INDEX with an active experiment
    const mockABIndex = {
      list: async () => ({ keys: [{ name: "ab_config:test-experiment" }], list_complete: true }),
      get: async (k) => {
        if (k === "ab_config:test-experiment") {
          return { status: "running", state: "RUNNING", variants: [{ slug: "v1" }, { slug: "v2" }] };
        }
        return null;
      },
    };

    // Fail only the experiment SQL queries (which contain index1 = 'ab_selected')
    globalThis.fetch = async (url, opts) => {
      const body = typeof opts?.body === "string" ? opts.body : "";
      if (body.includes("ab_selected")) {
        return new Response("Experiment SQL service error", { status: 500 });
      }
      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const req = new Request("https://niluferormanli.com/api/admin/analytics", {
      headers: { Authorization: "Bearer test-admin-token" },
    });
    const env = {
      ADMIN_TOKEN: "test-admin-token",
      ENV_NAME: "production",
      PROJECT_ID: "nilufer",
      CF_ACCOUNT_ID: "acc123",
      CF_AE_API_TOKEN: "tok123",
      AB_INDEX: mockABIndex,
    };

    const res = await handleAnalyticsGet({ request: req, env });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.partial_error, true);
    assert.ok(Array.isArray(body.errors));
    assert.ok(body.errors.some((e) => e.query === "experiments"));
    assert.deepEqual(body.summary.active_experiments, []);
  });

  await t.test("9 main queries fail + 1 main query succeeds + experiment query fails preserves data and returns HTTP 200", async () => {
    const mockABIndex = {
      list: async () => ({ keys: [{ name: "ab_config:test-exp" }], list_complete: true }),
      get: async () => ({ status: "running", state: "RUNNING", variants: [{ slug: "v1" }] }),
    };

    // The 10 main queries:
    // 0: campaigns -> FAIL
    // 1: aliases -> FAIL
    // 2: slugs -> FAIL
    // 3: traffic_recent -> FAIL
    // 4: events_recent -> FAIL
    // 5: conversions -> FAIL
    // 6: series_clicks -> FAIL
    // 7: series_conversions -> FAIL
    // 8: source_clicks -> FAIL
    // 9: source_conversions -> SUCCEED with data!
    // And experiment query -> FAIL
    globalThis.fetch = async (url, opts) => {
      const body = typeof opts?.body === "string" ? opts.body : "";
      if (body.includes("blob3 AS source, SUM(_sample_interval) AS conversions")) {
        // Query 9: source_conversions succeeds
        return new Response(
          JSON.stringify({
            data: [{ source: "instagram", conversions: "42" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("Simulated AE failure", { status: 500 });
    };

    const req = new Request("https://niluferormanli.com/api/admin/analytics", {
      headers: { Authorization: "Bearer test-admin-token" },
    });
    const env = {
      ADMIN_TOKEN: "test-admin-token",
      ENV_NAME: "production",
      PROJECT_ID: "nilufer",
      CF_ACCOUNT_ID: "acc123",
      CF_AE_API_TOKEN: "tok123",
      AB_INDEX: mockABIndex,
    };

    const res = await handleAnalyticsGet({ request: req, env });
    assert.equal(res.status, 200, "Must return HTTP 200 when 1 main query succeeds despite 9 main failures + experiment failure");
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.partial_error, true);
    assert.equal(body.errors.length, 10, "9 main queries + 1 experiment query failed");
    assert.ok(body.summary.sources.length > 0, "Preserves successful source_conversions data");
    assert.equal(body.summary.sources[0].source, "instagram");
    assert.equal(body.summary.sources[0].conversions, 42);
  });

  await t.test("genuine zero data returns HTTP 200 with ok: true, partial_error: false, and no errors", async () => {
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const req = new Request("https://niluferormanli.com/api/admin/analytics", {
      headers: { Authorization: "Bearer test-admin-token" },
    });
    const env = {
      ADMIN_TOKEN: "test-admin-token",
      ENV_NAME: "production",
      PROJECT_ID: "nilufer",
      CF_ACCOUNT_ID: "acc123",
      CF_AE_API_TOKEN: "tok123",
    };

    const res = await handleAnalyticsGet({ request: req, env });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.partial_error, false);
    assert.equal(body.errors, undefined);
    assert.equal(body.summary.total_clicks, 0);
    assert.equal(body.summary.conversions, 0);
    assert.deepEqual(body.campaigns, []);
  });
});
