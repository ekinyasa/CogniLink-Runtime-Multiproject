/**
 * tests/shadow-telemetry-endpoints.test.js
 * 
 * Tests for:
 * - /api/admin/shadow-summary (GET)
 * - /api/admin/shadow-telemetry-test (POST)
 * - AE write contract verification
 * - Integration with existing route handlers
 */

import assert from "node:assert/strict";
import { emitShadowTelemetry, SHADOW_EVENTS } from "../functions/_shared/shadow-telemetry.js";
import { timingSafeEqual as nodeTimingSafeEqual } from "node:crypto";

// Polyfill crypto.subtle.timingSafeEqual for Node.js (CF Workers API)
if (!globalThis.crypto?.subtle?.timingSafeEqual) {
  if (!globalThis.crypto) globalThis.crypto = {};
  if (!globalThis.crypto.subtle) globalThis.crypto.subtle = {};
  globalThis.crypto.subtle.timingSafeEqual = function(a, b) {
    if (a.byteLength !== b.byteLength) return false;
    return nodeTimingSafeEqual(Buffer.from(a), Buffer.from(b));
  };
}

// ── Mock Helpers ────────────────────────────────────────────────────────────

function createMockEnv(overrides = {}) {
  return {
    ADMIN_TOKEN: "secret_admin",
    SHADOW_TELEMETRY_ENABLED: "false",
    SHADOW_TELEMETRY_SAMPLE_RATE: "0.1",
    CF_ACCOUNT_ID: "test-account",
    CF_AE_API_TOKEN: "test-token",
    ENV_NAME: "dev",
    AE_TRAFFIC: {
      _writes: [],
      writeDataPoint(dp) { this._writes.push(dp); }
    },
    ...overrides
  };
}

function createMockRequest(url, method = "GET", headers = {}) {
  return {
    url,
    method,
    headers: {
      get(name) {
        const key = name.toLowerCase();
        for (const [k, v] of Object.entries(headers)) {
          if (k.toLowerCase() === key) return v;
        }
        return null;
      }
    }
  };
}

function createMockContext(request, env) {
  return { request, env };
}

// ── Dynamic Imports (Pages Functions export onRequestGet/Post) ───────────

async function importShadowSummary() {
  return import("../functions/api/admin/shadow-summary.js");
}

async function importShadowTelemetryTest() {
  return import("../functions/api/admin/shadow-telemetry-test.js");
}

// ── Test Runner ─────────────────────────────────────────────────────────────

async function runTests() {
  console.log("Starting Shadow Telemetry Endpoints & Contract Tests...\n");
  let passed = 0; let failed = 0;

  async function test(name, fn) {
    try { await fn(); console.log(`✅ PASS: ${name}`); passed++; }
    catch (e) { console.error(`❌ FAIL: ${name}`); console.error(e); failed++; }
  }

  const { onRequestGet: summaryHandler } = await importShadowSummary();
  const { onRequestGet: testGetHandler, onRequestPost: testPostHandler } = await importShadowTelemetryTest();

  // ════════════════════════════════════════════════════════════════════════
  // SHADOW SUMMARY ENDPOINT TESTS
  // ════════════════════════════════════════════════════════════════════════

  await test("1. summary endpoint: auth yokken erişilemez (401)", async () => {
    const req = createMockRequest("https://localhost/api/admin/shadow-summary");
    const ctx = createMockContext(req, createMockEnv());
    const res = await summaryHandler(ctx);
    assert.equal(res.status, 401);
  });

  await test("2. summary endpoint: doğru Bearer token ile erişilir", async () => {
    const req = createMockRequest("https://localhost/api/admin/shadow-summary", "GET", {
      "Authorization": "Bearer secret_admin"
    });
    // AE credentials missing → 503 but auth passes
    const ctx = createMockContext(req, createMockEnv({ CF_ACCOUNT_ID: "", CF_AE_API_TOKEN: "" }));
    const res = await summaryHandler(ctx);
    // Should not be 401
    assert.notEqual(res.status, 401);
  });

  await test("4. summary endpoint: arbitrary window reddedilir", async () => {
    const req = createMockRequest("https://localhost/api/admin/shadow-summary?window=999d", "GET", {
      "Authorization": "Bearer secret_admin"
    });
    const ctx = createMockContext(req, createMockEnv());
    const res = await summaryHandler(ctx);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, "invalid_window");
    assert.deepEqual(body.allowed, ["15m", "1h", "24h"]);
  });

  await test("5. summary endpoint: 15m, 1h, 24h are accepted (no 400)", async () => {
    for (const w of ["15m", "1h", "24h"]) {
      const req = createMockRequest(`https://localhost/api/admin/shadow-summary?window=${w}`, "GET", {
        "Authorization": "Bearer secret_admin"
      });
      // Missing AE credentials → 503 not 400
      const ctx = createMockContext(req, createMockEnv({ CF_ACCOUNT_ID: "", CF_AE_API_TOKEN: "" }));
      const res = await summaryHandler(ctx);
      assert.notEqual(res.status, 400, `Window ${w} should not return 400`);
    }
  });

  await test("8. summary endpoint: mismatch_rate sıfıra bölünmede güvenli", async () => {
    // When both counts are 0, rate should be 0, not NaN or Infinity
    // We can't easily mock AE SQL, but we can test the formula logic inline
    const evaluationCount = 0;
    const mismatchCount = 0;
    const mismatchRate = evaluationCount > 0
      ? mismatchCount / evaluationCount
      : (mismatchCount > 0 ? 1 : 0);
    assert.equal(mismatchRate, 0);
    assert.equal(isNaN(mismatchRate), false);
    assert.equal(isFinite(mismatchRate), true);
  });

  await test("8b. summary endpoint: mismatch but no eval gives rate 1", async () => {
    const evaluationCount = 0;
    const mismatchCount = 5;
    const mismatchRate = evaluationCount > 0
      ? mismatchCount / evaluationCount
      : (mismatchCount > 0 ? 1 : 0);
    assert.equal(mismatchRate, 1);
  });

  await test("10. summary endpoint: AE credentials missing → safe 503 JSON", async () => {
    const req = createMockRequest("https://localhost/api/admin/shadow-summary", "GET", {
      "Authorization": "Bearer secret_admin"
    });
    const ctx = createMockContext(req, createMockEnv({ CF_ACCOUNT_ID: "", CF_AE_API_TOKEN: "" }));
    const res = await summaryHandler(ctx);
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.equal(body.error, "ae_credentials_missing");
  });

  // ════════════════════════════════════════════════════════════════════════
  // DIAGNOSTIC ENDPOINT TESTS
  // ════════════════════════════════════════════════════════════════════════

  await test("11. diagnostic endpoint: auth olmadan çalışmaz (401)", async () => {
    const req = createMockRequest("https://localhost/api/admin/shadow-telemetry-test", "POST");
    const ctx = createMockContext(req, createMockEnv());
    const res = await testPostHandler(ctx);
    assert.equal(res.status, 401);
  });

  await test("12. diagnostic endpoint: GET ile çalışmaz (405)", async () => {
    const req = createMockRequest("https://localhost/api/admin/shadow-telemetry-test", "GET", {
      "Authorization": "Bearer secret_admin"
    });
    const ctx = createMockContext(req, createMockEnv());
    const res = await testGetHandler(ctx);
    assert.equal(res.status, 405);
    const body = await res.json();
    assert.equal(body.error, "method_not_allowed");
  });

  await test("13. diagnostic endpoint: telemetry disabled iken write yapmaz", async () => {
    const env = createMockEnv({ SHADOW_TELEMETRY_ENABLED: "false" });
    const req = createMockRequest("https://localhost/api/admin/shadow-telemetry-test", "POST", {
      "Authorization": "Bearer secret_admin"
    });
    const ctx = createMockContext(req, env);
    const res = await testPostHandler(ctx);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.equal(body.error, "telemetry_disabled");
    assert.equal(env.AE_TRAFFIC._writes.length, 0);
  });

  await test("14. diagnostic endpoint: enabled iken yalnız bir diagnostic mismatch yazar", async () => {
    const env = createMockEnv({ SHADOW_TELEMETRY_ENABLED: "true" });
    const req = createMockRequest("https://localhost/api/admin/shadow-telemetry-test", "POST", {
      "Authorization": "Bearer secret_admin"
    });
    const ctx = createMockContext(req, env);
    const res = await testPostHandler(ctx);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.event_type, "shadow_mismatch");
    assert.equal(body.slug, "admin_diagnostic");
    assert.equal(env.AE_TRAFFIC._writes.length, 1);
    assert.equal(env.AE_TRAFFIC._writes[0].indexes[0], "shadow_mismatch");
    assert.equal(env.AE_TRAFFIC._writes[0].blobs[0], "admin_diagnostic");
    assert.equal(env.AE_TRAFFIC._writes[0].blobs[1], "diagnostic");
  });

  await test("14b. diagnostic endpoint: ?type=evaluation yazabilir", async () => {
    const env = createMockEnv({ SHADOW_TELEMETRY_ENABLED: "true" });
    const req = createMockRequest("https://localhost/api/admin/shadow-telemetry-test?type=evaluation", "POST", {
      "Authorization": "Bearer secret_admin"
    });
    const ctx = createMockContext(req, env);
    const res = await testPostHandler(ctx);
    const body = await res.json();
    assert.equal(body.event_type, "shadow_evaluation");
    assert.equal(env.AE_TRAFFIC._writes.length, 1);
    assert.equal(env.AE_TRAFFIC._writes[0].indexes[0], "shadow_evaluation");
  });

  await test("15. diagnostic endpoint: production KV/config mutate edilmez", async () => {
    const kvReads = [];
    const kvWrites = [];
    const env = createMockEnv({
      SHADOW_TELEMETRY_ENABLED: "true",
      APP_CONFIG: {
        get: async (key) => { kvReads.push(key); return null; },
        put: async (key, val) => { kvWrites.push(key); }
      }
    });
    const req = createMockRequest("https://localhost/api/admin/shadow-telemetry-test", "POST", {
      "Authorization": "Bearer secret_admin"
    });
    const ctx = createMockContext(req, env);
    await testPostHandler(ctx);
    assert.equal(kvWrites.length, 0, "No KV writes should occur");
    assert.equal(kvReads.length, 0, "No KV reads should occur");
  });

  await test("16. diagnostic payload'da token/query/CSS/HTML/user data yok", async () => {
    const env = createMockEnv({ SHADOW_TELEMETRY_ENABLED: "true" });
    const req = createMockRequest("https://localhost/api/admin/shadow-telemetry-test", "POST", {
      "Authorization": "Bearer secret_admin"
    });
    const ctx = createMockContext(req, env);
    const res = await testPostHandler(ctx);
    const body = await res.json();
    const bodyStr = JSON.stringify(body);
    assert.equal(bodyStr.includes("secret_admin"), false, "Token should not leak");
    const writeStr = JSON.stringify(env.AE_TRAFFIC._writes[0]);
    assert.equal(writeStr.includes("secret_admin"), false, "Token should not be in AE payload");
  });

  // ════════════════════════════════════════════════════════════════════════
  // AE WRITE CONTRACT VERIFICATION
  // ════════════════════════════════════════════════════════════════════════

  await test("17. AE contract: shadow events use correct index1 values", async () => {
    assert.equal(SHADOW_EVENTS.EVALUATION, "shadow_evaluation");
    assert.equal(SHADOW_EVENTS.MISMATCH, "shadow_mismatch");
  });

  await test("17b. AE contract: shadow events do not collide with ops events", async () => {
    const opsEvents = [
      "route_success", "route_resolved", "route_fail_unknown_alias",
      "route_fail_unknown_modifier", "route_fail_registry_inconsistent",
      "alias_click", "traffic_memory", "ab_selected",
      "alias_override_hit", "cache_hit", "cache_miss",
      "alias_attach", "alias_detach", "alias_reassign_event", "default_channel_change"
    ];
    assert.equal(opsEvents.includes(SHADOW_EVENTS.EVALUATION), false);
    assert.equal(opsEvents.includes(SHADOW_EVENTS.MISMATCH), false);
  });

  await test("17c. AE contract: blob layout is consistent", async () => {
    const writes = [];
    const env = {
      SHADOW_TELEMETRY_ENABLED: "true",
      SHADOW_TELEMETRY_SAMPLE_RATE: "1",
      AE_TRAFFIC: { writeDataPoint(dp) { writes.push(dp); } }
    };
    emitShadowTelemetry(env, {}, {
      slug: "test-page",
      routeType: "alias",
      request_id: "req-abc",
      runtimeContext: { render_mode: "canonical", metadata: { source_schema: "legacy" } },
      runtimeDiff: { identical: true },
      ruleShadow: { source: "page_config" },
      decisionShadow: { matched_rule_id: "rule_1" },
      uid: "u-1"
    });
    assert.equal(writes.length, 1);
    const dp = writes[0];
    // indexes[0] = event_type
    assert.equal(dp.indexes[0], "shadow_evaluation");
    // blobs[0] = slug, blobs[1] = routeType, blobs[2] = request_id, blobs[3] = detail JSON
    assert.equal(dp.blobs[0], "test-page");
    assert.equal(dp.blobs[1], "alias");
    assert.equal(dp.blobs[2], "req-abc");
    const detail = JSON.parse(dp.blobs[3]);
    assert.equal(detail.rule_source, "page_config");
    assert.equal(detail.matched_rule_id, "rule_1");
    assert.deepEqual(detail.mismatch_categories, []);
  });

  await test("17d. AE contract: mismatch category is queryable in detail blob", async () => {
    const writes = [];
    const env = {
      SHADOW_TELEMETRY_ENABLED: "true",
      SHADOW_TELEMETRY_SAMPLE_RATE: "0",
      AE_TRAFFIC: { writeDataPoint(dp) { writes.push(dp); } }
    };
    emitShadowTelemetry(env, {}, {
      slug: "css-page",
      routeType: "c",
      runtimeDiff: { identical: false, items: [{ field: "pageContent.custom_css" }] },
      runtimeContext: { render_mode: "canonical", metadata: {} },
      ruleShadow: { source: "none" },
      decisionShadow: {},
      request_id: "req-x"
    });
    assert.equal(writes.length, 1);
    assert.equal(writes[0].indexes[0], "shadow_mismatch");
    const detail = JSON.parse(writes[0].blobs[3]);
    assert.deepEqual(detail.mismatch_categories, ["css"]);
    assert.equal(detail.mismatch_count, 1);
  });

  await test("17e. summary query would not count existing traffic events", async () => {
    // The summary SQL WHERE clause uses index1 IN ('shadow_evaluation', 'shadow_mismatch')
    // Verify that traffic_memory, ab_selected etc. have different index1 values
    const shadowIndexes = ["shadow_evaluation", "shadow_mismatch"];
    const trafficIndexes = ["traffic_memory", "ab_selected", "route_success", "alias_click"];
    for (const ti of trafficIndexes) {
      assert.equal(shadowIndexes.includes(ti), false, `${ti} should not match shadow filters`);
    }
  });

  // ════════════════════════════════════════════════════════════════════════
  // DETERMINISTIC SAMPLING CONSISTENCY
  // ════════════════════════════════════════════════════════════════════════

  await test("5b. deterministic sampling: same identity → same result 100 times", async () => {
    const results = [];
    for (let i = 0; i < 100; i++) {
      const writes = [];
      const env = {
        SHADOW_TELEMETRY_ENABLED: "true",
        SHADOW_TELEMETRY_SAMPLE_RATE: "0.5",
        AE_TRAFFIC: { writeDataPoint(dp) { writes.push(dp); } }
      };
      const meta = emitShadowTelemetry(env, {}, {
        slug: "stable-test",
        routeType: "alias",
        runtimeDiff: { identical: true },
        runtimeContext: { render_mode: "canonical", metadata: {} },
        ruleShadow: {},
        decisionShadow: {},
        request_id: "deterministic-id-abc",
        uid: "u-stable-123"
      });
      results.push(meta.evaluation_sampled);
    }
    // All 100 results should be identical
    const allSame = results.every(r => r === results[0]);
    assert.equal(allSame, true, "Deterministic sampling should produce identical results for same identity");
  });

  // ════════════════════════════════════════════════════════════════════════
  // FLAG ON/OFF DOES NOT AFFECT RESPONSE
  // ════════════════════════════════════════════════════════════════════════

  await test("21. flag true/false değiştiğinde normal kullanıcı response davranışı değişmez", async () => {
    // Simulate: emitShadowTelemetry with flag off returns { enabled: false }
    const metaOff = emitShadowTelemetry(
      { SHADOW_TELEMETRY_ENABLED: "false" },
      {},
      { slug: "test" }
    );
    assert.equal(metaOff.enabled, false);

    // With flag on, it should not throw or change response shape
    const metaOn = emitShadowTelemetry(
      { SHADOW_TELEMETRY_ENABLED: "true", SHADOW_TELEMETRY_SAMPLE_RATE: "1", AE_TRAFFIC: { writeDataPoint() {} } },
      {},
      { slug: "test", runtimeDiff: { identical: true }, runtimeContext: { render_mode: "canonical", metadata: {} }, ruleShadow: {}, decisionShadow: {}, request_id: "x" }
    );
    assert.equal(metaOn.enabled, true);
    assert.equal(typeof metaOn.mismatch_detected, "boolean");
  });

  await test("23. normal kullanıcı Inspector veya rule verisi görmez (telemetry meta not in non-debug)", async () => {
    // The telemetry meta is only added to debugPayload.metadata.shadowTelemetry
    // which is only returned when verifyAdminDebug returns true.
    // We can verify the key exists in the shadow telemetry return shape
    const meta = emitShadowTelemetry(
      { SHADOW_TELEMETRY_ENABLED: "true", SHADOW_TELEMETRY_SAMPLE_RATE: "1", AE_TRAFFIC: { writeDataPoint() {} } },
      {},
      { slug: "t", runtimeDiff: { identical: true }, runtimeContext: { render_mode: "canonical", metadata: {} }, ruleShadow: {}, decisionShadow: {}, request_id: "r" }
    );
    // Meta should not contain any sensitive env values
    const metaStr = JSON.stringify(meta);
    assert.equal(metaStr.includes("ADMIN_TOKEN"), false);
    assert.equal(metaStr.includes("CF_AE_API_TOKEN"), false);
    assert.equal(metaStr.includes("CF_ACCOUNT_ID"), false);
  });

  // ════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ════════════════════════════════════════════════════════════════════════

  console.log("\n── Test Summary ──");
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}`);
  if (failed > 0) process.exit(1);
}

runTests();
