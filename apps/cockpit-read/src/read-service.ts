import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { DomainStore, loadDomainMigrationSql } from "../../../packages/projection/src/index.js";

/**
 * The read-only face of the cockpit (STORY-138).
 *
 * It exists to give humans on the LAN a browser path to the workbench WITHOUT
 * any write capability. It shares the write face's static build and reads the
 * same domain store, but it is structurally incapable of a chain write:
 *
 *   - it has no chain client and no pins — there is no code path that could
 *     hold operator authority, so "never holds pins" is a fact about its shape,
 *     not a discipline;
 *   - every `/api/chain/*` route is absent, and write methods (POST/PUT/DELETE)
 *     are refused globally — there is no route to a chain write, not a route
 *     that is merely unauthorised;
 *   - the domain store is opened read-only at the SQLite connection, so even a
 *     bug that reaches for the store cannot mutate it (MIN-014: read face never
 *     writes the store any more than the chain);
 *   - it binds an EXPLICIT LAN address and refuses wildcard binds (0.0.0.0/::),
 *     validates the Host header (anti-DNS-rebinding), and carries security
 *     headers on every response.
 *
 * The bind address and Host allow-list are the deployment's to state; nothing
 * here defaults a network-facing address, for the same reason the write face
 * refuses to default an actor.
 */

export interface CockpitReadOptions {
  port: number;
  /**
   * The interface to bind. MUST be a concrete LAN address — wildcard binds
   * (0.0.0.0, ::) are refused here because the read face must not appear on
   * every interface (MIN-014; a wildcard bind is how a LAN read face becomes a
   * WAN read face without anyone deciding that).
   */
  host: string;
  /** Directory of built static assets to serve, if any. */
  staticRoot?: string;
  /** The precious domain database, opened read-only. Omit for a static-only read face. */
  domainDatabasePath?: string;
  /**
   * Allowed Host header values, for DNS-rebinding protection. When non-empty,
   * a request whose Host is not in the set is refused before any route runs.
   * When empty, Host is not checked — but an empty allow-list is a deployment
   * choice, not a default this code makes for it.
   */
  allowedHosts?: readonly string[];
}

export interface StartedCockpitReadService {
  server: Server;
  url: string;
  close: () => Promise<void>;
}

const WILDCARD_BINDS = new Set(["0.0.0.0", "::", "*"]);

function assertConcreteHost(host: string): string {
  if (typeof host !== "string" || host.trim().length === 0) {
    throw new Error("cockpit-read refused to start: no bind host stated. A network-facing read face must bind an explicit interface.");
  }
  if (WILDCARD_BINDS.has(host)) {
    throw new Error(
      `cockpit-read refused to bind ${host}: wildcard binds are not allowed on the read face. `
      + "State a concrete LAN interface (MIN-014: bind a dedicated interface, never 0.0.0.0)."
    );
  }
  return host;
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

/** Security headers the read face sends on every response (MIN-014 content safety). */
function securityHeaders(): Record<string, string> {
  return {
    "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer"
  };
}

export async function startCockpitReadService(options: CockpitReadOptions): Promise<StartedCockpitReadService> {
  const host = assertConcreteHost(options.host);
  const allowedHosts = options.allowedHosts ?? [];

  const migration = loadDomainMigrationSql(resolve(process.cwd(), "packages/db/migrations/domain"));
  const domain = options.domainDatabasePath
    ? new DomainStore(options.domainDatabasePath, migration, { readOnly: true })
    : null;

  const server = createServer((request, response) => {
    const context: Context = {
      domain,
      allowedHosts,
      actor: null,
      ...(options.staticRoot ? { staticRoot: options.staticRoot } : {})
    };
    void handle(request, response, context)
      .catch((error: unknown) => {
        sendJson(response, 500, { ok: false, reasonCode: "SERVICE_ERROR", error: error instanceof Error ? error.message : String(error) });
      });
  });

  server.listen(options.port, host);
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("service address unreadable");

  return {
    server,
    url: `http://${host}:${address.port}`,
    close: async () => {
      await new Promise<void>((done, fail) => server.close((error) => error ? fail(error) : done()));
      domain?.close();
    }
  };
}

interface Context {
  domain: DomainStore | null;
  staticRoot?: string;
  allowedHosts: readonly string[];
  actor: null;
}

/** Write methods are refused before any routing: the read face has no write routes at all. */
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);

async function handle(request: IncomingMessage, response: ServerResponse, context: Context): Promise<void> {
  // Host validation first — a rebinding request must not even reach routing.
  // Compare the hostname without the port: an allow-list names a host, and the
  // port a request happens to carry is not part of identity (DNS rebinding
  // protection cares which host the browser resolved, not which ephemeral port).
  const hostHeader = request.headers.host;
  if (context.allowedHosts.length > 0) {
    const host = typeof hostHeader === "string" ? (hostHeader.split(":")[0] ?? "") : "";
    if (!context.allowedHosts.includes(host)) {
      sendJson(response, 403, { ok: false, reasonCode: "HOST_NOT_ALLOWED", error: "Host is not on the read face allow-list" });
      return;
    }
  }

  if (WRITE_METHODS.has(request.method ?? "")) {
    sendJson(response, 405, { ok: false, reasonCode: "READ_ONLY_SURFACE", error: "the read face accepts no write methods" });
    return;
  }

  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  const path = url.pathname;

  if (path === "/api/health") {
    sendJson(response, 200, {
      ok: true,
      service: "tcrn-aos-read",
      readonly: true,
      // Stated rather than discovered: this process has no chain client and no
      // pins, so the answer is structural, not a runtime probe.
      chainWriteAvailable: false,
      partitions: ["TCRN-AOS"],
      security: {
        contentSecurityPolicy: true,
        nosniff: true,
        hostAllowList: context.allowedHosts.length > 0
      }
    });
    return;
  }

  if (path.startsWith("/api/domain/")) {
    await handleDomainRead(request, response, context, path.slice("/api/domain/".length), url);
    return;
  }

  // /api/chain/* is not a missing route — it is the boundary. The write face's
  // chain routes are structurally absent here, and anything under /api/chain
  // answers 404 so a caller can tell the surface exists but this face is read-only.
  if (path.startsWith("/api/chain/")) {
    sendJson(response, 404, { ok: false, reasonCode: "READ_ONLY_SURFACE", error: "the read face has no chain routes" });
    return;
  }

  if (request.method === "GET" || request.method === "HEAD") {
    await serveStatic(response, path, context.staticRoot);
    return;
  }

  sendJson(response, 404, { ok: false, error: "not_found" });
}

/**
 * The read-only domain surface: export, a scoped listing, and one record's
 * annotation/comments/relations. Mirrors the write face's read routes exactly,
 * so a reader sees the same domain data — the write routes (annotation PUT,
 * comment POST, relation POST) are the boundary and stay absent.
 */
async function handleDomainRead(
  request: IncomingMessage,
  response: ServerResponse,
  context: Context,
  rest: string,
  url: URL
): Promise<void> {
  const { domain } = context;
  if (!domain) {
    sendJson(response, 503, { ok: false, reasonCode: "DOMAIN_STORE_UNAVAILABLE", error: "this read face has no domain store" });
    return;
  }

  if (request.method === "GET" && rest === "export") {
    sendJson(response, 200, { ok: true, ...domain.exportAll() });
    return;
  }

  if (request.method === "GET" && rest.length === 0) {
    sendJson(response, 200, {
      ok: true,
      annotations: domain.listAnnotations(
        url.searchParams.get("partition")
          ? { partitionId: url.searchParams.get("partition") as string }
          : {})
    });
    return;
  }

  if (request.method === "GET") {
    const [partitionId, ...recordParts] = rest.split("/");
    const recordId = decodeURIComponent(recordParts.join("/"));
    if (!partitionId || !recordId) {
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

  sendJson(response, 404, { ok: false, error: "not_found" });
}

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
    response.writeHead(200, {
      "content-type": MIME[extname(target)] ?? "application/octet-stream",
      ...securityHeaders()
    });
    response.end(body);
  } catch {
    sendJson(response, 404, { ok: false, error: "not_found" });
  }
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    ...securityHeaders()
  });
  response.end(payload);
}
