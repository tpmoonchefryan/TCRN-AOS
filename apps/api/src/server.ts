import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { once } from "node:events";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";
import { createAppliedRuntimeFixture, AosSqliteRepository, type AosRuntimeFixture } from "../../../packages/db/src/index.js";
import { createDefaultSeed, type ActorIdentity } from "../../../packages/domain/src/index.js";
import { createRuntimeTransport, type RuntimeTransport } from "../../../packages/mcp-server/src/index.js";
import { renderAosShellHtml } from "../../web/src/app.js";
import { frontendShellRoutes } from "../../web/src/data.js";
import { apiHealthReadback, createAosApiApp } from "./index.js";
import { createWorkReadbackApiResponse, type KnowledgeReadbackProvider } from "./work-readback.js";

export interface StartedAosLocalService {
  server: Server;
  url: string;
  close: () => Promise<{ stopped: true; runtimeReset: boolean }>;
}

export async function startAosLocalServiceProof(port = 0): Promise<StartedAosLocalService> {
  const runtime = await createAppliedRuntimeFixture();
  const knowledgeFixture = await createKr03KnowledgeReadbackFixture();
  const app = createAosApiApp();
  const server = createServer((request, response) => {
    handleRequest(runtime, request, response, app, knowledgeFixture.provider);
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
      await knowledgeFixture.close();
      return { stopped: true, runtimeReset: reset.ok };
    }
  };
}

function handleRequest(
  runtime: AosRuntimeFixture,
  request: IncomingMessage,
  response: ServerResponse,
  app: ReturnType<typeof createAosApiApp>,
  knowledgeReadback?: KnowledgeReadbackProvider
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
    sendShellHtml(request, response, url);
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
  if (path.startsWith("/api/work/readback/")) {
    const result = createWorkReadbackApiResponse(
      runtime.getStore(),
      path,
      url.searchParams,
      knowledgeReadback ? { knowledgeReadback } : {}
    );
    sendJson(response, result.statusCode, result.body);
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

function sendShellHtml(request: IncomingMessage, response: ServerResponse, url: URL): void {
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
  response.end(request.method === "HEAD" ? undefined : renderAosShellHtml({ path: url.pathname, search: url.search }));
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
    case ".js":
      return "text/javascript";
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

interface Kr03KnowledgeReadbackFixture {
  provider: KnowledgeReadbackProvider;
  close: () => Promise<void>;
}

const kr03ReadbackActor: ActorIdentity = {
  employeeId: "employee-atlas",
  role: "owner_observer",
  threadId: "atlas-thread",
  sessionId: "kr03-readback-ui-service-proof"
};

async function createKr03KnowledgeReadbackFixture(): Promise<Kr03KnowledgeReadbackFixture> {
  const root = await mkdtemp(join(realpathSync(tmpdir()), "tcrn-aos-kr03-readback-"));
  await writeFile(join(root, ".tcrn-aos-phase1-root"), "owned-by-kr03-readback-ui\n", "utf8");
  const databasePath = join(root, "kr03-readback.sqlite");
  const repoRoot = process.cwd();
  const migrationsDir = join(repoRoot, "packages/db/migrations/sqlite");
  seedKr03KnowledgeEntries(databasePath, migrationsDir);
  const runtime = createRuntimeTransport({
    actor: kr03ReadbackActor,
    databasePath,
    databaseRoot: root,
    repoRoot,
    migrationsDir,
    maxResponseBytes: 16_384
  });
  return {
    provider: createTransportKnowledgeReadbackProvider(runtime),
    close: async () => {
      runtime.close();
      await rm(root, { recursive: true, force: true });
    }
  };
}

function createTransportKnowledgeReadbackProvider(runtime: RuntimeTransport): KnowledgeReadbackProvider {
  return {
    search(params) {
      return callKnowledgeRuntime(runtime, "aos.knowledge.search", params);
    },
    read(params) {
      return callKnowledgeRuntime(runtime, "aos.knowledge.entry.read", params);
    }
  };
}

function callKnowledgeRuntime(runtime: RuntimeTransport, method: "aos.knowledge.search" | "aos.knowledge.entry.read", params: Record<string, unknown>): Record<string, unknown> {
  const response = runtime.transport.handleJsonRpc({ jsonrpc: "2.0", id: method, method, params });
  if (response.error) {
    const reason = typeof response.error.data?.reason === "string" ? response.error.data.reason : "knowledge_readback_failed";
    const error = new Error(reason) as Error & { reason?: string };
    error.reason = reason;
    throw error;
  }
  return response.result as Record<string, unknown>;
}

function seedKr03KnowledgeEntries(databasePath: string, migrationsDir: string): void {
  const repository = new AosSqliteRepository({ databasePath, migrationsDir });
  try {
    repository.applyMigrations();
    repository.seedAiEmployees(createDefaultSeed().employees, "kr03-readback-ui-seed");
    repository.createKnowledgeRetrievalEntry({
      id: "knowledge-kr03-readback-canonical",
      title: "KR03 readback knowledge view",
      roleScope: "owner_observer",
      project: "TCRN-AOS",
      category: "knowledge-retrieval",
      knowledgeKind: "runbook_fact",
      status: "canonical",
      lastVerified: "2026-07-08",
      stalenessPolicy: "review_after_30_days",
      sourceRef: "kr03-readback-ui-proof-source",
      sourceDigest: "sha256:kr03-readback-ui-proof-source",
      tags: ["kr03", "readback", "knowledge"],
      summary: "KR03 proves the read-only Work readback view can search knowledge and open an explicit entry detail.",
      body: "KR03 entry detail is returned only by the explicit read endpoint. The browser surface stays read-only and exposes no propose, edit, canonical promotion, gateway, live dispatch, or Owner Intent execution affordance."
    });
    repository.createKnowledgeRetrievalEntry({
      id: "knowledge-kr03-readback-second",
      title: "KR03 knowledge cursor proof",
      roleScope: "owner_observer",
      project: "TCRN-AOS",
      category: "knowledge-retrieval",
      knowledgeKind: "runbook_fact",
      status: "canonical",
      lastVerified: "2026-07-08",
      stalenessPolicy: "review_after_30_days",
      sourceRef: "kr03-readback-ui-proof-source",
      sourceDigest: "sha256:kr03-readback-ui-proof-source",
      tags: ["kr03", "cursor", "readback"],
      summary: "Second KR03 result keeps pagination and result-list rendering source-visible.",
      body: "Second KR03 body remains available only from the explicit entry detail endpoint."
    });
  } finally {
    repository.close();
  }
}
