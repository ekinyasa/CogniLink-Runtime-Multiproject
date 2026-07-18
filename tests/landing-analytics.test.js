import assert from "node:assert/strict";
import { writeClickEvent, writePageViewEvent, writeLandingSignalEvent } from "../functions/_shared/analytics.js";

function createMockEnv() {
  const pointsConversion = [];
  const pointsTraffic = [];
  return {
    AE_CONVERSION: {
      writeDataPoint(dp) { pointsConversion.push(dp); }
    },
    AE_TRAFFIC: {
      writeDataPoint(dp) { pointsTraffic.push(dp); }
    },
    pointsConversion,
    pointsTraffic
  };
}

const tests = [
  ["writeClickEvent writes click datapoint to AE_CONVERSION", () => {
    const env = createMockEnv();
    writeClickEvent(env, {
      slug: "landing-1",
      link_id: "cta-1",
      utm_source: "google",
      utm_medium: "cpc",
      dest_host: "example.com"
    });
    assert.equal(env.pointsConversion.length, 1);
    assert.equal(env.pointsConversion[0].indexes[0], "click");
    assert.equal(env.pointsConversion[0].blobs[0], "landing-1");
    assert.equal(env.pointsConversion[0].blobs[1], "cta-1");
  }],
  ["writePageViewEvent writes traffic_memory datapoint to AE_TRAFFIC", () => {
    const env = createMockEnv();
    writePageViewEvent(env, {
      utm_campaign: "summer-sale",
      utm_source: "instagram",
      page_type: "checkout"
    });
    assert.equal(env.pointsTraffic.length, 1);
    assert.equal(env.pointsTraffic[0].indexes[0], "traffic_memory");
    assert.equal(env.pointsTraffic[0].blobs[0], "summer-sale");
    assert.equal(env.pointsTraffic[0].blobs[4], "instagram");
  }],
  ["writeLandingSignalEvent writes click or conversion datapoint", () => {
    const env = createMockEnv();
    writeLandingSignalEvent(env, {
      type: "click_hard",
      meta: { campaign: "campaign-a", source: "ig-bio" }
    });
    writeLandingSignalEvent(env, {
      type: "conversion",
      meta: { campaign: "campaign-a", source: "ig-bio" }
    });
    assert.equal(env.pointsConversion.length, 2);
    assert.equal(env.pointsConversion[0].indexes[0], "click");
    assert.equal(env.pointsConversion[1].indexes[0], "conversion");
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
