import assert from "node:assert/strict";
import { emitShadowTelemetry, SHADOW_EVENTS } from "../functions/_shared/shadow-telemetry.js";

async function runTests() {
  console.log("Starting Shadow Telemetry Tests...\n");
  let passed = 0; let failed = 0;

  async function test(name, fn) {
    try { await fn(); console.log(`✅ PASS: ${name}`); passed++; }
    catch (e) { console.error(`❌ FAIL: ${name}`); console.error(e); failed++; }
  }

  function createEnv(vars = {}, writes = []) {
    return {
      ...vars,
      AE_TRAFFIC: {
        writeDataPoint: (dp) => writes.push(dp)
      }
    };
  }

  function createPayload(diff = { identical: true }, uid = "u-123", exception = null) {
    return {
      slug: "test-slug",
      routeType: "c",
      runtimeContext: { render_mode: "canonical", metadata: { source_schema: "legacy" } },
      runtimeDiff: diff,
      ruleShadow: { source: "page_config" },
      decisionShadow: { matched_rule_id: "rule_1" },
      exception,
      request_id: "req-123",
      uid
    };
  }

  await test("1. flag false → write yok", async () => {
    const writes = [];
    const env = createEnv({ SHADOW_TELEMETRY_ENABLED: "false" }, writes);
    const meta = emitShadowTelemetry(env, {}, createPayload());
    assert.equal(meta.enabled, false);
    assert.equal(writes.length, 0);
  });

  await test("2. flag eksik → write yok", async () => {
    const writes = [];
    const env = createEnv({}, writes);
    const meta = emitShadowTelemetry(env, {}, createPayload());
    assert.equal(meta.enabled, false);
    assert.equal(writes.length, 0);
  });

  await test("3. flag true + sample rate 1 → bütün evaluation’lar yazılır", async () => {
    const writes = [];
    const env = createEnv({ SHADOW_TELEMETRY_ENABLED: "true", SHADOW_TELEMETRY_SAMPLE_RATE: "1" }, writes);
    const meta = emitShadowTelemetry(env, {}, createPayload());
    assert.equal(meta.enabled, true);
    assert.equal(meta.evaluation_sampled, true);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].indexes[0], SHADOW_EVENTS.EVALUATION);
  });

  await test("6. sample rate 0 → evaluation yok", async () => {
    const writes = [];
    const env = createEnv({ SHADOW_TELEMETRY_ENABLED: "true", SHADOW_TELEMETRY_SAMPLE_RATE: "0" }, writes);
    const meta = emitShadowTelemetry(env, {}, createPayload());
    assert.equal(meta.evaluation_sampled, false);
    assert.equal(writes.length, 0);
  });

  await test("8. invalid sample rate → güvenli fallback", async () => {
    const writes = [];
    const env = createEnv({ SHADOW_TELEMETRY_ENABLED: "true", SHADOW_TELEMETRY_SAMPLE_RATE: "invalid" }, writes);
    const meta = emitShadowTelemetry(env, {}, createPayload());
    assert.equal(meta.sample_rate, 0.1);
  });

  await test("9. identical:false → shadow_mismatch daima yazılır", async () => {
    const writes = [];
    const env = createEnv({ SHADOW_TELEMETRY_ENABLED: "true", SHADOW_TELEMETRY_SAMPLE_RATE: "0" }, writes);
    const payload = createPayload({ identical: false, items: [{ field: "pageContent.custom_css" }] });
    const meta = emitShadowTelemetry(env, {}, payload);
    assert.equal(meta.mismatch_detected, true);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].indexes[0], SHADOW_EVENTS.MISMATCH);
    const detail = JSON.parse(writes[0].blobs[3]);
    assert.deepEqual(detail.mismatch_categories, ["css"]);
  });

  await test("11. multiple diff item tek düşük hacimli event/category setine indirgenir", async () => {
    const writes = [];
    const env = createEnv({ SHADOW_TELEMETRY_ENABLED: "true", SHADOW_TELEMETRY_SAMPLE_RATE: "0" }, writes);
    const payload = createPayload({ 
      identical: false, 
      items: [
        { field: "pageContent.custom_css", type: "mismatch" },
        { field: "pageContent.components[0]", type: "mismatch" },
        { field: "pageContent.components[1]", type: "mismatch" }
      ]
    });
    const meta = emitShadowTelemetry(env, {}, payload);
    assert.deepEqual(meta.mismatch_categories.sort(), ["components", "css"].sort());
    const detail = JSON.parse(writes[0].blobs[3]);
    assert.equal(detail.mismatch_count, 3);
  });

  await test("12/13. CSS/HTML/rule body AE payload’una girmez", async () => {
    const writes = [];
    const env = createEnv({ SHADOW_TELEMETRY_ENABLED: "true", SHADOW_TELEMETRY_SAMPLE_RATE: "0" }, writes);
    const payload = createPayload({ 
      identical: false, 
      items: [{ field: "pageContent.custom_css", type: "mismatch", actual: "<style>BODY</style>" }] 
    });
    const meta = emitShadowTelemetry(env, {}, payload);
    const blobStr = writes[0].blobs.join(" ");
    assert.equal(blobStr.includes("<style>BODY</style>"), false);
  });

  await test("14/15/16. exceptions/failures produce mismatch", async () => {
    const writes = [];
    const env = createEnv({ SHADOW_TELEMETRY_ENABLED: "true", SHADOW_TELEMETRY_SAMPLE_RATE: "0" }, writes);
    const payload = createPayload(null, "u-1", new Error("repo fail"));
    const meta = emitShadowTelemetry(env, {}, payload);
    assert.equal(meta.mismatch_detected, true);
    assert.deepEqual(meta.mismatch_categories, ["exception"]);
    assert.equal(writes[0].indexes[0], SHADOW_EVENTS.MISMATCH);
  });

  await test("17. AE write exception safe", async () => {
    const writes = [];
    const env = createEnv({ SHADOW_TELEMETRY_ENABLED: "true", SHADOW_TELEMETRY_SAMPLE_RATE: "1" }, writes);
    env.AE_TRAFFIC.writeDataPoint = () => { throw new Error("AE BOOM") };
    // Should not throw
    const meta = emitShadowTelemetry(env, {}, createPayload());
    assert.equal(meta.enabled, true);
  });

  console.log("\n── Test Summary ──");
  console.log(`Passed: ${passed}`); console.log(`Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}
runTests();
