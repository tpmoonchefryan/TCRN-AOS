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
  /**
   * Attribution for every write this service performs, on the chain and in the
   * domain store alike. There is no default: an actor is a claim about who acted,
   * and a fallback value would let deployments record that claim without anyone
   * having made it (TCRN-AOS-STORY-112).
   */
  actor: string;
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

/**
 * The complete chain-write surface, by route segment under `/api/chain/`.
 *
 * This list is the routing table, not documentation of it: dispatch reads it, so
 * a verb absent here is a 404 and a verb added here must be handled. Everything
 * else the engine can do — conference, gate, knowledge, delete — stays off the
 * HTTP surface on purpose; see CEREMONIAL_WRITES in the projection package.
 */
export const CHAIN_WRITE_ROUTES = ["transition", "annotate", "work", "enrol"] as const;
type ChainWriteRoute = (typeof CHAIN_WRITE_ROUTES)[number];

export async function startCockpitService(options: CockpitServiceOptions): Promise<StartedCockpitService> {
  if (typeof options.actor !== "string" || options.actor.trim().length === 0) {
    throw new Error(
      "cockpit service refused to start: no actor configured. " +
      "Every write is attributed, so the deployment must say who is acting " +
      "(set AOS_ACTOR, or pass `actor` explicitly)."
    );
  }
  const migration = readFileSync(
    resolve(process.cwd(), "packages/db/migrations/domain/0001_cockpit_domain.sql"), "utf8");
  const domain = new DomainStore(options.domainDatabasePath, migration);

  // The chain client is created lazily and only when a write is actually
  // attempted: a read-only session should not spawn an engine process, and a
  // deployment without pins should fail at the write rather than at boot.
  let chain: ChainClient | null = null;
  let surfaces = new Map<string, SafeWriteSurface>();
  const actor = options.actor;

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

  if (path.startsWith("/api/chain/") && request.method === "POST") {
    const verb = path.slice("/api/chain/".length);
    if ((CHAIN_WRITE_ROUTES as readonly string[]).includes(verb)) {
      await handleChainWrite(request, response, context, verb as ChainWriteRoute);
      return;
    }
    // Anything else — the ceremonial verbs above all — is not a missing feature,
    // it is a boundary: those writes keep their explicit ceremony off HTTP.
    sendJson(response, 404, { ok: false, error: "not_found" });
    return;
  }

  if (request.method === "GET" || request.method === "HEAD") {
    await serveStatic(response, path, context.options.staticRoot);
    return;
  }

  sendJson(response, 404, { ok: false, error: "not_found" });
}

async function handleChainWrite(
  request: IncomingMessage,
  response: ServerResponse,
  context: Context,
  verb: ChainWriteRoute
): Promise<void> {
  const body = await readJson(request);
  // The whole input is validated before the surface (and with it the engine
  // process) is resolved: a malformed request is the caller's mistake and should
  // be named field-by-field, not converted into whatever the surface says first.
  const partitionId = requireString(body, "partitionId");

  switch (verb) {
    case "transition": {
      const input = { id: requireString(body, "recordId"), status: requireString(body, "status") };
      // The engine's state machine judges the move. Mirroring its rules here would
      // create a second opinion that can disagree with the authority.
      await (await context.surfaceFor(partitionId)).transition(input);
      sendJson(response, 200, { ok: true, recordId: input.id, status: input.status });
      return;
    }
    case "annotate": {
      // Scope is a full-value replacement in the engine; the caller sends the
      // entire text it wants on the record, not a delta (TCRN-AOS-INC-034).
      //
      // A field that is present but of the wrong type is refused by name here,
      // never silently dropped: an earlier shape of this route ignored a
      // non-string scope and a non-array decidedBy, which turned a caller's
      // type mistake into "annotation must set something" — or worse, into a
      // write that recorded less than the caller said.
      const id = requireString(body, "recordId");
      if (body.scope !== undefined && typeof body.scope !== "string") {
        throw new WriteRefused("scope must be a string when present", "FIELD_INVALID");
      }
      if (body.decidedBy !== undefined
        && (!Array.isArray(body.decidedBy) || body.decidedBy.some((entry: unknown) => typeof entry !== "string"))) {
        throw new WriteRefused("decidedBy must be an array of strings when present", "FIELD_INVALID");
      }
      if (body.scope === undefined && body.decidedBy === undefined) {
        // Refused at the route: an annotation that sets nothing is a malformed
        // request, and naming that here costs no engine spawn.
        throw new WriteRefused("annotate requires scope or decidedBy", "FIELD_REQUIRED");
      }
      const input = {
        id,
        ...(body.scope !== undefined ? { scope: body.scope as string } : {}),
        ...(body.decidedBy !== undefined ? { decidedBy: body.decidedBy as string[] } : {})
      };
      await (await context.surfaceFor(partitionId)).annotate(input);
      sendJson(response, 200, { ok: true, recordId: input.id });
      return;
    }
    case "work": {
      // parentId admits exactly three shapes: absent, null, or a non-empty
      // string. Anything else is the caller's mistake and is refused by name —
      // quietly reading a wrong-typed parent as "parentless" would create a
      // root-level record nobody asked for.
      if (body.parentId !== undefined && body.parentId !== null
        && (typeof body.parentId !== "string" || body.parentId.length === 0)) {
        throw new WriteRefused("parentId must be a non-empty string or null", "FIELD_INVALID");
      }
      const input = {
        projectId: requireString(body, "projectId"),
        externalKey: requireString(body, "externalKey"),
        kind: requireString(body, "kind"),
        parentId: typeof body.parentId === "string" ? body.parentId : null,
        title: requireString(body, "title")
      };
      const created = await (await context.surfaceFor(partitionId)).createWork(input);
      sendJson(response, 200, { ok: true, id: created.id, externalKey: input.externalKey });
      return;
    }
    case "enrol": {
      const input = {
        id: requireString(body, "recordId"),
        workspaceId: requireString(body, "workspaceId"),
        trainWorkId: requireString(body, "trainWorkId")
      };
      await (await context.surfaceFor(partitionId)).enrolInTrain(input);
      sendJson(response, 200, { ok: true, recordId: input.id, trainWorkId: input.trainWorkId });
      return;
    }
    default:
      // Exhaustiveness, enforced at compile time: adding a verb to
      // CHAIN_WRITE_ROUTES without a case above makes `verb` non-never here and
      // the build fails. At runtime the throw becomes a 500 through the shared
      // handler — a misconfigured route answers, it never leaves the request
      // hanging with no response at all.
      return unreachableRoute(verb);
  }
}

function unreachableRoute(verb: never): never {
  throw new Error(`unhandled chain write route: ${String(verb)}`);
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
