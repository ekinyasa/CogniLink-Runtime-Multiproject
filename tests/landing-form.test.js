import assert from "node:assert/strict";
import { onRequestPost, onRequestOptions } from "../functions/api/lead.js";

function createMockContext(body, cookieHeader = "") {
  const points = [];
  const req = new Request("https://example.com/api/lead", {
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
      AE_CONVERSION: {
        writeDataPoint(dp) { points.push(dp); }
      }
    },
    waitUntil(promise) {
      promise.catch(() => {});
    },
    points
  };
}

const tests = [
  ["onRequestOptions returns 204 with CORS headers", async () => {
    const req = new Request("https://example.com/api/lead", { method: "OPTIONS", headers: { Origin: "https://example.com" } });
    const res = onRequestOptions({ request: req });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get("Access-Control-Allow-Origin"), "https://example.com");
  }],
  ["onRequestPost rejects invalid email with 400", async () => {
    const ctx = createMockContext({ email: "invalid-email", name: "Test User" });
    const res = await onRequestPost(ctx);
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.error, "invalid_email");
  }],
  ["onRequestPost captures valid lead and updates user state cookie", async () => {
    const ctx = createMockContext({
      email: "jane@example.com",
      name: "Jane Doe",
      slug: "landing-test",
      form_id: "newsletter-1"
    });
    const res = await onRequestPost(ctx);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.ok, true);
    assert.equal(json.lead.email, "jane@example.com");
    assert.equal(json.state.c, 1);
    assert.ok(json.state.t.includes("lead_submitted"));
    assert.ok(res.headers.get("Set-Cookie").includes("cos_state="));
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
