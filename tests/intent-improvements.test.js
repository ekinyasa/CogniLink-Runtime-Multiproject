import assert from "node:assert/strict";
import { calculateVisitorIntentLevel, getVisitorIntentSummary } from "../functions/_shared/user-state.js";

const tests = [
  ["calculateVisitorIntentLevel identifies cold visitors", () => {
    assert.equal(calculateVisitorIntentLevel({ v: 0, c: 0, h: 0, e: 0, t: [] }), "cold");
  }],
  ["calculateVisitorIntentLevel identifies warm visitors from visits or tags", () => {
    assert.equal(calculateVisitorIntentLevel({ v: 1, c: 0, h: 0, e: 0, t: [] }), "warm");
    assert.equal(calculateVisitorIntentLevel({ v: 0, c: 0, h: 0, e: 25, t: [] }), "warm");
    assert.equal(calculateVisitorIntentLevel({ v: 0, c: 0, h: 0, e: 0, t: ["vip"] }), "warm");
  }],
  ["calculateVisitorIntentLevel identifies hot visitors from CTA clicks or engagement", () => {
    assert.equal(calculateVisitorIntentLevel({ v: 1, c: 0, h: 1, e: 0, t: [] }), "hot");
    assert.equal(calculateVisitorIntentLevel({ v: 0, c: 0, h: 0, e: 70, t: [] }), "hot");
  }],
  ["calculateVisitorIntentLevel identifies converted visitors", () => {
    assert.equal(calculateVisitorIntentLevel({ v: 1, c: 1, h: 1, e: 100, t: [] }), "converted");
  }],
  ["getVisitorIntentSummary returns complete summary object", () => {
    const summary = getVisitorIntentSummary({ v: 1, c: 0, h: 1, e: 80, t: ["promo"], ts: 1700000000 });
    assert.equal(summary.tier, "hot");
    assert.equal(summary.score, 80);
    assert.equal(summary.isReturning, true);
    assert.equal(summary.hasConverted, false);
    assert.equal(summary.isHot, true);
    assert.deepEqual(summary.tags, ["promo"]);
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
