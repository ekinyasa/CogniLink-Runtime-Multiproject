import assert from "node:assert/strict";
import { isSafeRedirectTarget, buildRedirectResponse } from "../functions/_shared/redirect-runtime.js";

const tests = [
  ["isSafeRedirectTarget validates http/https and relative paths", () => {
    assert.equal(isSafeRedirectTarget("https://example.com/checkout"), true);
    assert.equal(isSafeRedirectTarget("http://example.com/checkout"), true);
    assert.equal(isSafeRedirectTarget("/c/my-slug"), true);
    assert.equal(isSafeRedirectTarget("javascript:alert(1)"), false);
    assert.equal(isSafeRedirectTarget("//malicious.com"), false);
    assert.equal(isSafeRedirectTarget(null), false);
  }],
  ["buildRedirectResponse constructs valid redirect response", () => {
    const res = buildRedirectResponse("https://example.com/dest", { statusCode: 301 });
    assert.equal(res.status, 301);
    assert.equal(res.headers.get("Location"), "https://example.com/dest");
    assert.equal(res.headers.get("X-Robots-Tag"), "noindex,nofollow");
  }],
  ["buildRedirectResponse preserves utm search parameters when enabled", () => {
    const inbound = "https://runtime.example/c/slug?utm_source=ig&utm_medium=bio&other=1";
    const res = buildRedirectResponse("https://dest.example/page", {
      preserveUtm: true,
      requestUrl: inbound
    });
    assert.equal(res.status, 302);
    const location = res.headers.get("Location");
    assert.ok(location.includes("utm_source=ig"));
    assert.ok(location.includes("utm_medium=bio"));
    assert.ok(!location.includes("other=1")); // non-utm ignored
  }],
  ["buildRedirectResponse rejects unsafe redirect target with 400", () => {
    const res = buildRedirectResponse("javascript:alert(1)");
    assert.equal(res.status, 400);
  }]
];

let failures = 0;
for (const [name, run] of tests) {
  try {
    run();
    console.log(`PASS: ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL: ${name}`);
    console.error(error);
  }
}

if (failures > 0) process.exit(1);
