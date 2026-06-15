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
  if (request.method !== "GET") {
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return;
  }
  if (request.url === "/health") {
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
  if (request.url === "/readback") {
    sendJson(response, 200, runtime.readback());
    return;
  }
  if (request.url === "/policy") {
    sendJson(response, 200, {
      ...apiHealthReadback(app),
      runtimeServerStarted: true,
      serviceProofOnly: true
    });
    return;
  }
  sendJson(response, 404, { ok: false, error: "not_found" });
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}
