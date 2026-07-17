export function createDecisionShadowContext(runtimeContext, inputs = {}) {
  const context = runtimeContext && typeof runtimeContext === "object" ? runtimeContext : {};
  const metadata = context.metadata && typeof context.metadata === "object" ? context.metadata : {};
  const userState = inputs.userState && typeof inputs.userState === "object" ? inputs.userState : {};

  return {
    ...context,
    metadata: {
      ...metadata,
      source: typeof inputs.source === "string" ? inputs.source : "",
      medium: typeof inputs.medium === "string" ? inputs.medium : "",
      campaign: typeof inputs.campaign === "string" ? inputs.campaign : ""
    },
    userState: { ...userState }
  };
}
