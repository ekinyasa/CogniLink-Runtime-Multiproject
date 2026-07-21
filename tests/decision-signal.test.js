import assert from "node:assert/strict";
import { onRequestPost } from "../functions/api/decision/signal.js";

function createMockContext(body, cookieHeader = "") {
  const req = new Request("https://example.com/api/decision/signal", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Origin": "https://example.com",
      "Cookie": cookieHeader
    },
    body: JSON.stringify(body)
  });

  return {
    request: req,
    env: {
      ENV_NAME: "dev",
      LANDING_CONFIG: {
        async get(key, opts) {
          if (key === "engine_config") {
            return {
              points: { click_soft: 2, click_hard: 10 },
              thresholds: { hot_engagement: 60 }
            };
          }
          return null;
        }
      },
      AE_CONVERSION: {
        writeDataPoint() {}
      }
    }
  };
}

const tests = [
  ["onRequestPost handles engagement score signals and transitions to hot intent", async () => {
    const ctx = createMockContext({
      type: "engagement",
      score: 65,
      meta: { source: "landing-page", campaign: "test-campaign" }
    });
    const res = await onRequestPost(ctx);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.ok, true);
    assert.equal(json.state.e, 65);
    assert.equal(json.state.h, 1); // e >= 60 triggers hot transition
  }],
  ["onRequestPost processes click_hard and marks intent as hot", async () => {
    const ctx = createMockContext({
      type: "click_hard",
      meta: { source: "landing-page", campaign: "test-campaign" }
    });
    const res = await onRequestPost(ctx);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.ok, true);
    assert.equal(json.state.h, 1);
  }],
  ["onRequestPost processes time_signal for warm and hot thresholds", async () => {
    const warmCtx = createMockContext({
      type: "time_signal",
      name: "warm",
      seconds: 8,
      meta: { source: "landing-page", campaign: "test-campaign" }
    });
    const warmRes = await onRequestPost(warmCtx);
    assert.equal(warmRes.status, 200);
    const warmJson = await warmRes.json();
    assert.equal(warmJson.ok, true);
    assert.equal(warmJson.state.e >= 35, true);

    const hotCtx = createMockContext({
      type: "time_signal",
      name: "hot",
      seconds: 20,
      meta: { source: "landing-page", campaign: "test-campaign" }
    });
    const hotRes = await onRequestPost(hotCtx);
    assert.equal(hotRes.status, 200);
    const hotJson = await hotRes.json();
    assert.equal(hotJson.ok, true);
    assert.equal(hotJson.state.h, 1);
  }]
];

let failures = 0;
for (const [name, run] of tests) {
  try {
    await run();
    console.log(`PASS: ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL: ${name}`);
    console.error(error);
  }
}

if (failures > 0) process.exit(1);
