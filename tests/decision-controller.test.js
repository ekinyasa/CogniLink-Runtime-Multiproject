import assert from "node:assert/strict";
import { handleDecision } from "../functions/lib/decision-controller.js";

const request = {
  headers: { get: () => null }
};

const decision = await handleDecision(request, { ENV_NAME: "dev" }, {
  decisionRules: [{ id: "render_rule", condition: null, action: "render" }]
});

assert.equal(decision.action, "render");
assert.equal(decision.decisionId, "render_rule");
console.log("decision controller tests passed");
