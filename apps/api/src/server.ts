import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { once } from "node:events";
import { createAppliedRuntimeFixture, type AosRuntimeFixture } from "../../../packages/db/src/index.js";
import { apiHealthReadback, createAosApiApp } from "./index.js";

export interface StartedAosLocalService {
  server: Server;
  url: string;
  close: () => Promise<{ stopped: true; runtimeReset: boolean }>;
}

export async function startAosLocalServiceProof(port = 0): Promise<StartedAosLocalService> {
  const runtime = await createAppliedRuntimeFixture();
  const app = createAosApiApp();
  const server = createServer((request, response) => {
    handleRequest(runtime, request, response, app);
  });
  server.listen(port, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to read local service address");
  }
  return {
    server,
    url: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
      const reset = await runtime.reset();
      return { stopped: true, runtimeReset: reset.ok };
    }
  };
}

function handleRequest(
  runtime: AosRuntimeFixture,
  request: IncomingMessage,
  response: ServerResponse,
  app: ReturnType<typeof createAosApiApp>
): void {
  if (request.method !== "GET" && request.method !== "HEAD") {
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return;
  }
  const url = parseRequestUrl(request);
  const path = url.pathname;
  const removedFrontendAliases = new Set([
    "/",
    "/cockpit",
    "/operations-cockpit",
    "/operations-cockpit.html",
    "/docs-readiness",
    "/docs-search-release-readiness",
    "/docs-search-release-readiness.html",
    "/aos-wide-product-design",
    "/aos-wide-product-design.html",
    "/project-workspace",
    "/project-workspace.html",
    "/initiative-detail",
    "/initiative-detail.html",
    "/ai-employee",
    "/ai-employee.html",
    "/gate-queue",
    "/gate-queue.html",
    "/conference",
    "/conference.html",
    "/gateway-adapter",
    "/gateway-adapter.html",
    "/dependency-console",
    "/dependency-console.html",
    "/resource-library",
    "/resource-library.html",
    "/knowledge-modules",
    "/knowledge-modules.html",
    "/admin-access",
    "/admin-access.html",
    "/github-release-linkage",
    "/github-release-linkage.html",
    "/api/cockpit"
  ]);

  if (removedFrontendAliases.has(path)) {
    sendJson(response, 410, createFrontendRemovedPayload(path));
    return;
  }
  if (path === "/health" || path === "/api/health") {
    const readback = runtime.readback();
    sendJson(response, 200, {
      ok: readback.ok,
      runtimeDatabase: "local_fixture",
      runtimeDataCommitted: false,
      externalQueue: "none",
      liveCodexDispatchAuthorized: false,
      copiedHelperExecution: false,
      projectCount: readback.projectCount,
      auditEventCount: readback.operationalRecordCounts.auditEvents
    });
    return;
  }
  if (path === "/readback" || path === "/api/readback") {
    sendJson(response, 200, runtime.readback());
    return;
  }
  if (path === "/policy" || path === "/api/policy") {
    sendJson(response, 200, {
      ...apiHealthReadback(app),
      runtimeServerStarted: true,
      serviceProofOnly: true
    });
    return;
  }
  sendJson(response, 404, { ok: false, error: "not_found" });
}

function createFrontendRemovedPayload(path: string) {
  return {
    ok: false,
    error: "aos_frontend_removed",
    path,
    frontendCodeDisposition: "removed_pending_owner_led_design_restart",
    ownerReviewRequired: true,
    replacementSurfaceAvailable: false,
    productUiAcceptance: false,
    releaseReadiness: false,
    liveDispatch: false
  };
}

function parseRequestUrl(request: IncomingMessage): URL {
  try {
    return new URL(request.url ?? "/", "http://127.0.0.1");
  } catch {
    return new URL("/", "http://127.0.0.1");
  }
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}
