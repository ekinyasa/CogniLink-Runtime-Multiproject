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
    for (const edge of outboundEdges) {
      const nextNode = nodes.find(n => n.id === edge.to);
      if (!nextNode) continue;

      if (userState.c === 1 && (nextNode.type === "post" || nextNode.type === "conv")) {
        targetNodeId = nextNode.id;
        break;
      }
      if (userState.h === 1 && (nextNode.type === "hot" || nextNode.type === "conv" || nextNode.type === "warm")) {
        targetNodeId = nextNode.id;
        break;
      }
      // Warm condition
      if (userState.v === 1 && userState.h !== 1 && userState.c !== 1 && nextNode.type === "warm") {
         targetNodeId = nextNode.id;
         break;
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
