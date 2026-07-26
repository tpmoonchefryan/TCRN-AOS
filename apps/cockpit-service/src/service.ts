import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
import {
  ChainClient,
  DomainStore,
  SafeWriteSurface,
  WriteRefused,
  type DomainPriority,
  type DomainRelationType
} from "../../../packages/projection/src/index.js";

/**
 * The cockpit's local service.
 *
 * It exists because the cockpit needs to write, and writing splits cleanly in
 * two: the cockpit's own domain data, which this process owns outright, and the
 * governed chain, which it is only allowed to ask the engine to change.
 *
 * The whole thing binds to loopback and nothing else. That is not a hardening
 * default, it is the shape of the ruling behind it: operator authority pins live
 * on this machine and never travel, so the only process that may hold them is
 * one that cannot be reached from anywhere else. A browser never holds them; the
 * mirror on the VM never holds them; a chain write is something this process
 * performs on the operator's behalf, at their keyboard.
 */

export interface CockpitServiceOptions {
  port?: number;
  /** Directory of built static assets to serve, if any. */
  staticRoot?: string;
  /** Where the precious domain database lives. */
  domainDatabasePath: string;
  /** Chain workspaces by partition id, for the write proxy. */
  workspaces: Readonly<Record<string, string>>;
  /** Omit to run read-only: without pins the engine refuses writes anyway. */
  authorityPins?: string;
  authorityPinsDigest?: string;
  actor?: string;
}

export interface StartedCockpitService {
  server: Server;
  url: string;
  close: () => Promise<void>;
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2"
};

export async function startCockpitService(options: CockpitServiceOptions): Promise<StartedCockpitService> {
  const migration = readFileSync(
    resolve(process.cwd(), "packages/db/migrations/domain/0001_cockpit_domain.sql"), "utf8");
  const domain = new DomainStore(options.domainDatabasePath, migration);

  // The chain client is created lazily and only when a write is actually
  // attempted: a read-only session should not spawn an engine process, and a
  // deployment without pins should fail at the write rather than at boot.
  let chain: ChainClient | null = null;
  let surfaces = new Map<string, SafeWriteSurface>();
  const actor = options.actor ?? "agent:fable";

  async function surfaceFor(partitionId: string): Promise<SafeWriteSurface> {
    const workspacePath = options.workspaces[partitionId];
    if (!workspacePath) throw new WriteRefused(`unknown partition ${partitionId}`, "UNKNOWN_PARTITION");
    if (!chain) {
      chain = new ChainClient({
        serverPath: resolve(homedir(), ".tcrn-workflow/tcrn-workflow/scripts/tcrn-workflow-mcp.mjs"),
        ...(options.authorityPins ? { authorityPins: options.authorityPins } : {}),
        ...(options.authorityPinsDigest ? { authorityPinsDigest: options.authorityPinsDigest } : {})
      });
      await chain.start();
    }
    let surface = surfaces.get(partitionId);
    if (!surface) {
      surface = new SafeWriteSurface(chain, { workspacePath, actor });
      surfaces.set(partitionId, surface);
    }
    return surface;
  }

  const server = createServer((request, response) => {
    handle(request, response, { domain, surfaceFor, options, actor }).catch((error: unknown) => {
      // Reason codes travel to the client unchanged. A refusal from the engine is
      // information the operator needs — "INVALID_TRANSITION" tells them the move
      // was wrong, where a flattened 500 would only say something broke.
      const refused = error instanceof WriteRefused;
      sendJson(response, refused ? 409 : 500, {
        ok: false,
        reasonCode: refused ? error.reasonCode : "SERVICE_ERROR",
        error: error instanceof Error ? error.message : String(error)
      });
    });
  });

  // Loopback only. See the note at the top of this file: this is the ruling, not
  // a default. Binding elsewhere would put a pins-holding process on a network.
  server.listen(options.port ?? 4318, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("service address unreadable");

  return {
    server,
    url: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise<void>((done, fail) => server.close((error) => error ? fail(error) : done()));
      if (chain) await chain.stop();
      surfaces = new Map();
      domain.close();
    }
  };
}

interface Context {
  domain: DomainStore;
  surfaceFor: (partitionId: string) => Promise<SafeWriteSurface>;
  options: CockpitServiceOptions;
  actor: string;
}

async function handle(request: IncomingMessage, response: ServerResponse, context: Context): Promise<void> {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  const path = url.pathname;

  if (path === "/api/health") {
    sendJson(response, 200, {
      ok: true,
      service: "tcrn-aos-cockpit",
      // Whether this instance can write to the chain at all, stated rather than
      // discovered at the first click.
      chainWriteAvailable: Boolean(context.options.authorityPins),
      partitions: Object.keys(context.options.workspaces),
      actor: context.actor
    });
    return;
  }

  if (path.startsWith("/api/domain/")) {
    await handleDomain(request, response, context, path.slice("/api/domain/".length), url);
    return;
  }

  if (path === "/api/chain/transition" && request.method === "POST") {
    const body = await readJson(request);
    const partitionId = requireString(body, "partitionId");
    const surface = await context.surfaceFor(partitionId);
    // The engine's state machine judges the move. Mirroring its rules here would
    // create a second opinion that can disagree with the authority.
    await surface.transition({ id: requireString(body, "recordId"), status: requireString(body, "status") });
    sendJson(response, 200, { ok: true, recordId: body.recordId, status: body.status });
    return;
  }

  if (request.method === "GET" || request.method === "HEAD") {
    await serveStatic(response, path, context.options.staticRoot);
    return;
  }

  sendJson(response, 404, { ok: false, error: "not_found" });
}

async function handleDomain(
  request: IncomingMessage,
  response: ServerResponse,
  context: Context,
  rest: string,
  url: URL
): Promise<void> {
  const { domain } = context;

  if (request.method === "GET") {
    // /api/domain/<partition>/<recordId> — everything the cockpit knows about
    // one chain record that the chain itself does not hold.
    const [partitionId, ...recordParts] = rest.split("/");
    const recordId = decodeURIComponent(recordParts.join("/"));
    if (!partitionId || !recordId) {
      // The un-scoped listing, used by list views to decorate many rows at once.
      sendJson(response, 200, {
        ok: true,
        annotations: domain.listAnnotations(
          url.searchParams.get("partition")
            ? { partitionId: url.searchParams.get("partition") as string }
            : {})
      });
      return;
    }
    const ref = { partitionId, recordId };
    sendJson(response, 200, {
      ok: true,
      annotation: domain.getAnnotation(ref) ?? null,
      comments: domain.listComments(ref),
      relations: domain.listRelations(ref)
    });
    return;
  }

  if (request.method === "PUT" && rest === "annotation") {
    const body = await readJson(request);
    const annotation = domain.setAnnotation({
      partitionId: requireString(body, "partitionId"),
      recordId: requireString(body, "recordId"),
      externalKey: typeof body.externalKey === "string" ? body.externalKey : null,
      ...(body.assignee !== undefined ? { assignee: body.assignee as string | null } : {}),
      ...(body.priority !== undefined ? { priority: body.priority as DomainPriority | null } : {}),
      ...(Array.isArray(body.labels) ? { labels: body.labels as string[] } : {}),
      updatedAt: instant(),
      updatedBy: context.actor
    });
    sendJson(response, 200, { ok: true, annotation });
    return;
  }

  if (request.method === "POST" && rest === "comment") {
    const body = await readJson(request);
    const comment = domain.addComment({
      id: `comment:${randomUUID()}`,
      partitionId: requireString(body, "partitionId"),
      recordId: requireString(body, "recordId"),
      author: context.actor,
      body: requireString(body, "body"),
      createdAt: instant()
    });
    sendJson(response, 200, { ok: true, comment });
    return;
  }

  if (request.method === "POST" && rest === "relation") {
    const body = await readJson(request);
    const relation = domain.addRelation({
      id: `relation:${randomUUID()}`,
      partitionId: requireString(body, "partitionId"),
      recordId: requireString(body, "recordId"),
      relation: requireString(body, "relation") as DomainRelationType,
      targetPartitionId: requireString(body, "targetPartitionId"),
      targetRecordId: requireString(body, "targetRecordId"),
      createdAt: instant(),
      createdBy: context.actor
    });
    sendJson(response, 200, { ok: true, relation });
    return;
  }

  if (request.method === "GET" && rest === "export") {
    sendJson(response, 200, { ok: true, ...domain.exportAll() });
    return;
  }

  sendJson(response, 404, { ok: false, error: "not_found" });
}

/**
 * Serve the built cockpit, with any unknown path falling back to the shell.
 *
 * The client renders from `window.location`, so a deep link has to reach the
 * same document; the fallback is what makes a bookmarked filter survive a
 * reload. Paths are normalised and confined to the root before touching disk.
 */
async function serveStatic(response: ServerResponse, path: string, staticRoot?: string): Promise<void> {
  if (!staticRoot) {
    sendJson(response, 404, { ok: false, error: "no_static_root" });
    return;
  }
  const relative = normalize(path).replace(/^(\.\.[/\\])+/u, "");
  const candidate = join(staticRoot, relative);
  const target = extname(candidate) && existsSync(candidate) ? candidate : join(staticRoot, "index.html");
  if (!target.startsWith(staticRoot)) {
    sendJson(response, 403, { ok: false, error: "outside_static_root" });
    return;
  }
  try {
    const body = await readFile(target);
    response.writeHead(200, { "content-type": MIME[extname(target)] ?? "application/octet-stream" });
    response.end(body);
  } catch {
    sendJson(response, 404, { ok: false, error: "not_found" });
  }
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) as Record<string, unknown> : {};
}

function requireString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new WriteRefused(`${key} is required`, "FIELD_REQUIRED");
  }
  return value;
}

/** Second precision, matching what the chain records and what the store stores. */
function instant(): string {
  return new Date().toISOString().replace(/\.\d+Z$/u, "Z");
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload)
  });
  response.end(payload);
}
