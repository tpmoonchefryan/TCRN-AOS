import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { once } from "node:events";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { createAppliedRuntimeFixture, type AosRuntimeFixture } from "../../../packages/db/src/index.js";
import { frontendShellRoutes } from "../../web/src/data.js";
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

  if (path.startsWith("/assets/")) {
    sendStaticAsset(request, response, path);
    return;
  }
  if (frontendShellRouteSet.has(path)) {
    sendShellHtml(request, response);
    return;
  }
  if (path === "/api/cockpit") {
    sendJson(response, 410, createCockpitApiDeferredPayload(path));
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

const frontendShellRouteSet = new Set<string>(frontendShellRoutes);

function createCockpitApiDeferredPayload(path: string) {
  return {
    ok: false,
    error: "aos_cockpit_api_deferred",
    path,
    frontendShellAvailable: true,
    dummyCockpitOnly: true,
    finalCockpitAggregationAvailable: false,
    backendReadbackRoutes: ["/api/health", "/api/readback", "/api/policy"],
    productUiAcceptance: false,
    releaseReadiness: false,
    liveDispatch: false
  };
}

function sendShellHtml(request: IncomingMessage, response: ServerResponse): void {
  const shellPath = join(process.cwd(), "apps/web/dist/index.html");
  if (!existsSync(shellPath)) {
    sendJson(response, 503, {
      ok: false,
      error: "aos_frontend_shell_not_built",
      expectedArtifact: "apps/web/dist/index.html",
      remediation: "run pnpm build"
    });
    return;
  }
  response.statusCode = 200;
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.end(request.method === "HEAD" ? undefined : readFileSync(shellPath));
}

function sendStaticAsset(request: IncomingMessage, response: ServerResponse, path: string): void {
  const assetRoot = join(process.cwd(), "apps/web/dist");
  const relativePath = normalize(decodeURIComponent(path).replace(/^\/+/, ""));
  if (relativePath.includes("..")) {
    sendJson(response, 400, { ok: false, error: "invalid_asset_path" });
    return;
  }
  const assetPath = join(assetRoot, relativePath);
  if (!assetPath.startsWith(assetRoot) || !existsSync(assetPath)) {
    sendJson(response, 404, { ok: false, error: "asset_not_found" });
    return;
  }
  response.statusCode = 200;
  response.setHeader("content-type", contentTypeForAsset(assetPath));
  response.setHeader("cache-control", "no-store");
  response.end(request.method === "HEAD" ? undefined : readFileSync(assetPath));
}

function contentTypeForAsset(path: string): string {
  switch (extname(path)) {
    case ".png":
      return "image/png";
    case ".ico":
      return "image/x-icon";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
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
