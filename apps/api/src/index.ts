import { AosStore, createDefaultSeed } from "../../../packages/domain/src/index.js";
import { McpGateway } from "../../../packages/mcp-gateway/src/index.js";

export interface AosApiApp {
  store: AosStore;
  gateway: McpGateway;
  posture: {
    runtimeServerStarted: false;
    liveCodexDispatchAuthorized: false;
    externalQueue: "none";
    payloadAdminBypass: false;
  };
}

export function createAosApiApp(): AosApiApp {
  const store = new AosStore(createDefaultSeed());
  return {
    store,
    gateway: new McpGateway(store),
    posture: {
      runtimeServerStarted: false,
      liveCodexDispatchAuthorized: false,
      externalQueue: "none",
      payloadAdminBypass: false
    }
  };
}

export function apiHealthReadback(app = createAosApiApp()) {
  return {
    ok: true,
    projectCount: app.store.listProjects().length,
    allowedRuntimeMutation: "mcp_gateway_only",
    liveSend: app.posture.liveCodexDispatchAuthorized,
    externalQueue: app.posture.externalQueue
  };
}
