import fs from 'fs';
let code = fs.readFileSync('functions/lib/decision-controller.js', 'utf8');

const replacement = `
  const { source = "", medium = "", campaign = "", decisionRules = [], engineConfig = null, intentDestinations = null, intentEvaluation = null } = opts;
  const reqProd = opts.productSubdomain || (campaign ? campaign.split('-')[0] : null);

  // 1. Read existing state
  const rawState = readCookie(request, "cos_state");
  let userState  = parseUserState(rawState);
  let stateUpdate = false;
  const cookies   = [];

  // Get active product state
  const pState = (reqProd && userState.p && userState.p[reqProd]) ? userState.p[reqProd] : userState;
`;

code = code.replace(/const { source[\s\S]*?const cookies   = \[\];/m, replacement);

// Replace userState.c with pState.c, userState.h with pState.h, userState.v with pState.v, etc.
// But only inside the 3b block.
const blockRegex = /if \(userState\.c === 1\) \{[\s\S]*?\}\n  \}/;
const replacedBlock = `    if (pState.c === 1) {
      if (pState.u === 1 && effectiveDestinations.post) {
        decisionMatch = { action: "redirect", target: effectiveDestinations.post, id: "intent_post_override" };
      } else if (effectiveDestinations.converted) {
        decisionMatch = { action: "redirect", target: effectiveDestinations.converted, id: "intent_converted_override" };
      }
    } else if (pState.h === 1 && effectiveDestinations.hot) {
      decisionMatch = { action: "redirect", target: effectiveDestinations.hot, id: "intent_hot_override" };
    } else if (effectiveDestinations.warm) {
      // Intent warm destination check based on pState fields (v=1 or e>=20 or tags exist)
      if (pState.v === 1 || (pState.e || 0) >= 20 || (Array.isArray(userState.t) && userState.t.length > 0)) {
        decisionMatch = { action: "redirect", target: effectiveDestinations.warm, id: "intent_warm_override" };
      }
    }`;

code = code.replace(blockRegex, replacedBlock);

// Mark as visited logic
code = code.replace(/if \(userState\.v === 0\) \{/, 'if (pState.v === 0) {');
code = code.replace(/userState   = updateUserState\(userState, \{ v: 1 \}\);/, 'userState   = updateUserState(userState, { v: 1 }, reqProd);');

fs.writeFileSync('functions/lib/decision-controller.js', code);
console.log("Patched decision controller");
