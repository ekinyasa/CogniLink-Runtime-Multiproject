/**
 * functions/lib/journey-router.js
 *
 * Implements the "journey-first" routing logic.
 * Parses a Journey map (nodes & edges) and evaluates visitor state to find the next destination Page.
 */

export async function resolveJourneyDestination(journey, userState) {
  if (!journey || !journey.mapData || !journey.mapData.nodes) return null;

  const { nodes, edges } = journey.mapData;

  // Identify entry node (cold). If multiple exist, prioritize by basic rules or first cold node.
  let currentNode = nodes.find(n => n.type === "cold") || nodes[0];
  if (!currentNode) return null;

  // Traverse the directed graph edges based on user state
  // Simple heuristic for POC:
  // - if userState.c === 1 (Converted), follow edge to "conv" or "post" nodes.
  // - if userState.h === 1 (Hot), follow edge to "hot" or "conv" nodes.
  // - if userState.v === 1 (Warm), follow edge to "warm" or "nurture" nodes.
  //
  // In a robust implementation, edges should contain rich semantic conditions
  // (e.g. `edge.conditions = [{tag: "VIP"}, {points: ">50"}]`).

  let targetNodeId = currentNode.id;

  // Let's find outbound edges from the cold node (or current node)
  const outboundEdges = edges.filter(e => e.from === currentNode.id);

  if (outboundEdges.length > 0) {
    // 1. Check explicit edge conditions
    for (const edge of outboundEdges) {
      const nextNode = nodes.find(n => n.id === edge.to);
      if (!nextNode) continue;

      if (edge.conditions && Array.isArray(edge.conditions) && edge.conditions.length > 0) {
        const matches = edge.conditions.every(cond => {
          const hasLegacySubmit = userState.c === 1 && Array.isArray(userState.t) && userState.t.includes("lead_submitted");
          const isConverted = userState.c === 1 && !hasLegacySubmit;
          if (cond.tag && Array.isArray(userState.t)) return userState.t.includes(cond.tag);
          if (cond.minScore !== undefined) return (userState.e || 0) >= cond.minScore;
          if (cond.converted !== undefined) return isConverted === Boolean(cond.converted);
          if (cond.hot !== undefined) return (userState.h === 1) === Boolean(cond.hot);
          return true;
        });
        if (matches) {
          targetNodeId = nextNode.id;
          break;
        }
      }
    }

    // 2. Default intent-prioritized fallback matching
    if (targetNodeId === currentNode.id) {
      const candidateNodes = outboundEdges
        .map(e => nodes.find(n => n.id === e.to))
        .filter(Boolean);

      let matchedNode = null;
      const hasLegacySubmit = userState.c === 1 && Array.isArray(userState.t) && userState.t.includes("lead_submitted");
      const isConverted = userState.c === 1 && !hasLegacySubmit;
      if (isConverted) {
        matchedNode = candidateNodes.find(n => n.type === "post" || n.type === "conv");
      }
      if (!matchedNode && userState.h === 1) {
        matchedNode = candidateNodes.find(n => n.type === "hot") || candidateNodes.find(n => n.type === "conv" || n.type === "warm");
      }
      if (!matchedNode && userState.v === 1) {
        matchedNode = candidateNodes.find(n => n.type === "warm");
      }

      if (matchedNode) {
        targetNodeId = matchedNode.id;
      }
    }
  }

  // Find the selected node
  const finalNode = nodes.find(n => n.id === targetNodeId) || currentNode;

  return {
    pageId: finalNode.id,      // e.g. "n2" -> mapped to APP_CONFIG "page:n2" / "hub:n2"
    url: finalNode.url,
    goal: finalNode.goal,
    type: finalNode.type
  };
}
