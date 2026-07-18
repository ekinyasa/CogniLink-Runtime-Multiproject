import assert from "node:assert/strict";
import { resolveJourneyDestination } from "../functions/lib/journey-router.js";

const sampleJourney = {
  mapData: {
    nodes: [
      { id: "n1", type: "cold", goal: "welcome", url: "/p/welcome" },
      { id: "n2", type: "warm", goal: "nurture", url: "/p/nurture" },
      { id: "n3", type: "hot", goal: "checkout", url: "/p/checkout" },
      { id: "n4", type: "conv", goal: "thankyou", url: "/p/thankyou" }
    ],
    edges: [
      { from: "n1", to: "n2" },
      { from: "n1", to: "n3" },
      { from: "n1", to: "n4" }
    ]
  }
};

const customEdgeJourney = {
  mapData: {
    nodes: [
      { id: "n1", type: "cold", url: "/p/cold" },
      { id: "n2", type: "vip_offer", url: "/p/vip" }
    ],
    edges: [
      {
        from: "n1",
        to: "n2",
        conditions: [{ tag: "VIP" }, { minScore: 50 }]
      }
    ]
  }
};

const tests = [
  ["resolveJourneyDestination returns cold entry node for new user", async () => {
    const dest = await resolveJourneyDestination(sampleJourney, { v: 0, c: 0, h: 0, e: 0, t: [] });
    assert.equal(dest.pageId, "n1");
    assert.equal(dest.type, "cold");
  }],
  ["resolveJourneyDestination traverses to hot checkout node for hot visitor", async () => {
    const dest = await resolveJourneyDestination(sampleJourney, { v: 1, c: 0, h: 1, e: 70, t: [] });
    assert.equal(dest.type, "hot");
  }],
  ["resolveJourneyDestination evaluates edge conditions correctly", async () => {
    const destVip = await resolveJourneyDestination(customEdgeJourney, { v: 1, c: 0, h: 0, e: 60, t: ["VIP"] });
    assert.equal(destVip.pageId, "n2");

    const destNonVip = await resolveJourneyDestination(customEdgeJourney, { v: 1, c: 0, h: 0, e: 60, t: ["REGULAR"] });
    assert.equal(destNonVip.pageId, "n1");
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
