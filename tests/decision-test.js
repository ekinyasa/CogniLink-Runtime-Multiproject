import { evaluateRules } from "../functions/lib/decision-engine.js";

const mockUser = { v: 1, c: 0, e: 60, h: 0 };
const mockCtx = { source: "igstory", medium: "story" };

const rules = [
  {
    id: "hot_buyer",
    condition: { property: "user_visited", operator: "===", value: true },
    action: "redirect",
    target: "https://kartra.com/buy"
  },
  {
    id: "engaged_user",
    condition: { property: "user_engaged", operator: "===", value: true },
    action: "redirect",
    target: "https://kartra.com/checkout"
  }
];

const result = evaluateRules(mockUser, mockCtx, rules);
console.log("Match:", result?.id);

if (result?.id === "hot_buyer") {
  console.log("✅ Basic rule evaluation works.");
} else {
  console.log("❌ Rule evaluation failed.");
}

const coldUser = { v: 0, c: 0, e: 10, h: 0 };
const coldResult = evaluateRules(coldUser, mockCtx, rules);
console.log("Cold Match:", coldResult?.id);
if (!coldResult) {
  console.log("✅ Cold user doesn't match hot rules.");
}
