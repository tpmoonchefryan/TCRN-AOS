import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { once } from "node:events";
import { createAppliedRuntimeFixture, type AosRuntimeFixture } from "../../../packages/db/src/index.js";
import { createOperationsCockpitReadModel, type CockpitDetailPanel } from "../../web/src/cockpit.js";
import { renderAOSWideProductDesignHtml } from "../../web/src/aos-wide-product-design-view.js";
import { renderOperationsCockpitHtml } from "../../web/src/cockpit-view.js";
import { renderDocsSearchReleaseReadinessHtml } from "../../web/src/docs-readiness-view.js";
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

  if (path === "/" || path === "/cockpit" || path === "/operations-cockpit" || path === "/operations-cockpit.html" || path === "/apps/web/static/operations-cockpit.html") {
    sendHtml(request, response, renderOperationsCockpitHtml(createServiceCockpitReadModel(runtime), {
      serviceBacked: true,
      cockpitApiPath: "/api/cockpit"
    }));
    return;
  }
  if (path === "/docs-readiness" || path === "/docs-search-release-readiness" || path === "/docs-search-release-readiness.html" || path === "/apps/web/static/docs-search-release-readiness.html") {
    sendHtml(request, response, renderDocsSearchReleaseReadinessHtml());
    return;
  }
  if (path === "/aos-wide-product-design" || path === "/aos-wide-product-design.html" || path === "/apps/web/static/aos-wide-product-design.html") {
    sendHtml(request, response, renderAOSWideProductDesignHtml());
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
  if (path === "/api/cockpit") {
    sendJson(response, 200, createCockpitServicePayload(runtime, url));
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

function createCockpitServicePayload(runtime: AosRuntimeFixture, url: URL) {
  const model = createServiceCockpitReadModel(runtime, url);
  const readback = runtime.readback();
  return {
    ok: readback.ok,
    serviceBacked: true,
    generatedAt: new Date().toISOString(),
    runtimeDatabase: "local_fixture",
    runtimeDataCommitted: false,
    externalQueue: "none",
    liveCodexDispatchAuthorized: false,
    model,
    readback,
    boundaries: {
      serviceProofOnly: true,
      productAcceptance: false,
      finalMvpAcceptance: false,
      githubPush: false,
      releasePublication: false,
      batchPushGate: false,
      ownerIntentExecution: false,
      liveDispatch: false,
      registryMutation: false
    }
  };
}

function createServiceCockpitReadModel(runtime: AosRuntimeFixture, url?: URL) {
  const readback = runtime.readback();
  const representativeIds = readback.representativeIds;
  const selectedId = url?.searchParams.get("selectedId") ?? representativeIds?.storyId;
  const selectedTypeParam = url?.searchParams.get("selectedType");
  const selectedType = isCockpitDetailType(selectedTypeParam) ? selectedTypeParam : "story";
  if (!representativeIds?.initiativeId) {
    throw new Error("AOS service cockpit requires representative runtime records");
  }
  const cockpitInput: Parameters<typeof createOperationsCockpitReadModel>[0] = {
    store: runtime.getStore(),
    projectId: "TCRN-AOS",
    initiativeId: representativeIds.initiativeId,
    localCheckpoint: "owner-trial-service-readback"
  };
  if (selectedId) {
    cockpitInput.selectedDetail = { id: selectedId, type: selectedType };
  }
  return createOperationsCockpitReadModel(cockpitInput);
}

function isCockpitDetailType(value: string | null | undefined): value is CockpitDetailPanel["selectedType"] {
  return value === "story"
    || value === "gate"
    || value === "conference"
    || value === "evidence"
    || value === "dependency"
    || value === "resource"
    || value === "stage";
}

function parseRequestUrl(request: IncomingMessage): URL {
  try {
    return new URL(request.url ?? "/", "http://127.0.0.1");
  } catch {
    return new URL("/", "http://127.0.0.1");
  }
}

function sendHtml(request: IncomingMessage, response: ServerResponse, html: string): void {
  response.statusCode = 200;
  response.setHeader("content-type", "text/html; charset=utf-8");
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  response.end(html);
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}
