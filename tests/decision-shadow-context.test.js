import assert from "node:assert/strict";
import { createDecisionShadowContext } from "../functions/_shared/decision-shadow-context.js";

const runtimeContext = {
  pageContent: { id: "page-1" },
  metadata: { source_schema: "v2", source: "stale" }
};
const userState = { v: 1, c: 0, t: ["vip"] };

const context = createDecisionShadowContext(runtimeContext, {
  source: "instagram",
  medium: "bio",
  campaign: "spring",
  userState
});

assert.equal(context.pageContent.id, "page-1");
assert.deepEqual(context.metadata, {
  source_schema: "v2",
  source: "instagram",
  medium: "bio",
  campaign: "spring"
});
assert.deepEqual(context.userState, userState);
assert.notEqual(context.userState, userState);
assert.equal(runtimeContext.metadata.source, "stale");
console.log("decision shadow context tests passed");
