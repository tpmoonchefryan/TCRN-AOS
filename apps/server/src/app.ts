import cookie from "@fastify/cookie";
import formbody from "@fastify/formbody";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import type pg from "pg";
import {
  ANONYMOUS,
  actorFromApiToken,
  actorFromSessionToken,
  allOperations,
  csrfOk,
  dispatch,
  getOperation,
  hostAllowed,
  newOpaqueToken,
  normaliseError,
  parseQuery,
  sameOrigin,
  SECURITY_HEADERS,
  type Actor,
} from "../../../packages/kernel/src/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "../../../packages/mcp/src/server.js";
import { buildOpenApi } from "./openapi.js";
import { renderPage } from "./render.js";
import { isLocalRedirect, LoginRateLimiter } from "./security.js";

export interface AppOptions {
  readonly pool: pg.Pool;
  readonly allowedHosts: readonly string[];
  readonly version: string;
  readonly secureCookies: boolean;
  /**
   * Supplied by the entrypoint rather than read here. The transport asking the store
   * directly would be a second path around `dispatch`, and the readiness probe is not a
   * good enough reason to open one.
   */
  readonly schemaStatus: () => Promise<{ applied: string | null; expected: string | null }>;
}

const SESSION_COOKIE = "aos_session";
const LOGIN_CSRF_COOKIE = "aos_login_csrf";
const loginRateLimiter = new LoginRateLimiter();

declare module "fastify" {
  interface FastifyRequest {
    actor: Actor;
    csrfSecret: string | null;
    loginCsrfSecret: string | null;
    mustChangePassword: boolean;
  }
}

function wantsHtml(request: FastifyRequest): boolean {
  const accept = request.headers.accept ?? "";
  return accept.includes("text/html");
}

export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: process.env.AOS_LOG_LEVEL ?? "info" },
    bodyLimit: 2 * 1024 * 1024,
    trustProxy: true,
  });

  await app.register(cookie);
  await app.register(formbody);

  // Fastify 5 refuses a shared reference as a request decorator default, because that
  // one object would be the SAME object on every request — which is exactly how one
  // caller's identity leaks into another's. Each decorator therefore gets a getter/setter
  // pair over per-request storage, with an anonymous default until authentication runs.
  const kActor = Symbol("aos.actor");
  const kCsrf = Symbol("aos.csrf");
  const kLoginCsrf = Symbol("aos.loginCsrf");
  const kMustChange = Symbol("aos.mustChangePassword");
  const slots = (request: unknown): Record<symbol, unknown> => request as Record<symbol, unknown>;
  app.decorateRequest("actor", {
    getter(this: FastifyRequest) { return (slots(this)[kActor] as Actor | undefined) ?? ANONYMOUS; },
    setter(this: FastifyRequest, value: Actor) { slots(this)[kActor] = value; },
  });
  app.decorateRequest("csrfSecret", {
    getter(this: FastifyRequest) { return (slots(this)[kCsrf] as string | null | undefined) ?? null; },
    setter(this: FastifyRequest, value: string | null) { slots(this)[kCsrf] = value; },
  });
  app.decorateRequest("loginCsrfSecret", {
    getter(this: FastifyRequest) { return (slots(this)[kLoginCsrf] as string | null | undefined) ?? null; },
    setter(this: FastifyRequest, value: string | null) { slots(this)[kLoginCsrf] = value; },
  });
  app.decorateRequest("mustChangePassword", {
    getter(this: FastifyRequest) { return (slots(this)[kMustChange] as boolean | undefined) ?? false; },
    setter(this: FastifyRequest, value: boolean) { slots(this)[kMustChange] = value; },
  });

  // Every response carries the same headers, including refusals. The previous tree had
  // two read faces that disagreed about this; one process cannot.
  app.addHook("onSend", async (_request, reply, payload) => {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) reply.header(name, value);
    return payload;
  });

  // Anti-DNS-rebinding, before routing. A rebinding request must not reach a route at all.
  app.addHook("onRequest", async (request, reply) => {
    if (!hostAllowed(request.headers.host, options.allowedHosts)) {
      await reply.status(403).send({
        ok: false,
        reasonCode: "forbidden",
        message: "That Host header is not on this instance's allow-list",
        detail: {},
      });
    }
  });

  // Identity comes from a credential, never from request content.
  app.addHook("preHandler", async (request, reply) => {
    request.actor = ANONYMOUS;
    request.csrfSecret = null;
    request.loginCsrfSecret = request.cookies[LOGIN_CSRF_COOKIE] ?? null;
    request.mustChangePassword = false;

    const authorization = request.headers.authorization;
    if (typeof authorization === "string" && authorization.startsWith("Bearer ")) {
      const actor = await actorFromApiToken(options.pool as never, authorization.slice(7).trim());
      if (actor) {
        request.actor = actor;
        return;
      }
    }
    const token = request.cookies[SESSION_COOKIE];
    if (token) {
      const resolved = await actorFromSessionToken(options.pool as never, token);
      if (resolved) {
        request.actor = resolved.actor;
        request.csrfSecret = resolved.csrfSecret;
        request.mustChangePassword = resolved.mustChangePassword;
      }
    }

    const path = new URL(request.url, "http://internal").pathname;
    if (request.method === "GET" && (path === "/login" || path === "/") && request.actor.principalId === "") {
      const token = request.loginCsrfSecret ?? newOpaqueToken();
      request.loginCsrfSecret = token;
      if (!request.cookies[LOGIN_CSRF_COOKIE]) {
        reply.setCookie(LOGIN_CSRF_COOKIE, token, {
          httpOnly: true,
          sameSite: "lax",
          secure: options.secureCookies,
          path: "/",
          maxAge: 10 * 60,
        });
      }
    }
  });

  app.get("/healthz", async () => ({ ok: true, version: options.version }));

  app.get("/readyz", async (_request, reply) => {
    try {
      await options.pool.query("SELECT 1");
      const { applied, expected } = await options.schemaStatus();
      if (applied !== expected) {
        return reply.status(503).send({
          ok: false,
          reasonCode: "schema_mismatch",
          applied,
          expected,
        });
      }
      return { ok: true, schemaVersion: applied, version: options.version };
    } catch (error) {
      return reply.status(503).send({ ok: false, reasonCode: "database_unreachable" });
    }
  });

  app.get("/api/v1/openapi.json", async () => buildOpenApi(options.version));

  // ---------------------------------------------------------------------------
  // MCP over streamable HTTP.
  //
  // A personal access token is the ONLY credential accepted here. That is what makes the
  // MCP surface structurally unable to exceed what its principal could already do through
  // the API — it is the same authorization check, reached through a different pipe.
  //
  // Stateless: a transport and server per request, closed when the response ends. There is
  // no session to resume, so there is no session to hijack.
  // ---------------------------------------------------------------------------
  app.post("/mcp", async (request, reply) => {
    if (request.actor.credential !== "api_token") {
      return reply.status(401).send({
        ok: false,
        reasonCode: "unauthenticated",
        message: "The MCP endpoint requires a personal access token in an Authorization: Bearer header",
        detail: {},
      });
    }
    const server = createMcpServer(options.pool, () => request.actor);
    // The SDK declares these optional properties without `| undefined`, which this
    // repository's exactOptionalPropertyTypes rejects. The cast is local to the two lines
    // that touch the SDK rather than relaxing the setting for the whole codebase.
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    } as unknown as ConstructorParameters<typeof StreamableHTTPServerTransport>[0]);
    reply.raw.on("close", () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport as unknown as Parameters<typeof server.connect>[0]);
    await transport.handleRequest(request.raw, reply.raw, request.body);
    return reply;
  });

  // ---------------------------------------------------------------------------
  // The one command endpoint. Every RESTful write path below is argument mapping
  // onto this, never a second implementation.
  // ---------------------------------------------------------------------------
  async function runCommand(
    request: FastifyRequest,
    reply: FastifyReply,
    operationId: string,
    input: Record<string, unknown>,
  ): Promise<unknown> {
    const operation = getOperation(operationId);
    if (!operation) {
      return reply.status(404).send({
        ok: false,
        reasonCode: "not_found",
        message: `No such operation: ${operationId}`,
        detail: {},
      });
    }

    const redirectTo = typeof input._redirect === "string" ? input._redirect : null;
    if (typeof input._redirect === "string" && !isLocalRedirect(input._redirect)) {
      return reply.status(400).send({
        ok: false,
        reasonCode: "validation_failed",
        message: "The redirect must be a local path",
        detail: { field: "_redirect" },
      });
    }

    // A browser form post must prove it came from our own page. An API caller presenting
    // a bearer token has no ambient credential to abuse, so CSRF does not apply to it.
    const isBrowserSession = request.actor.credential === "session" && request.actor.principalId !== "";
    const isBrowserLogin = operationId === "auth.login" && (
      wantsHtml(request)
      || String(request.headers["content-type"] ?? "").split(";", 1)[0] === "application/x-www-form-urlencoded"
    );
    if ((isBrowserSession || isBrowserLogin) && operation.kind === "command") {
      const submitted = (input._csrf ?? (request.body as Record<string, unknown> | undefined)?._csrf) as unknown;
      const secret = isBrowserLogin ? request.loginCsrfSecret : request.csrfSecret;
      if (!csrfOk(secret ?? "", submitted)) {
        return reply.status(403).send({
          ok: false,
          reasonCode: "csrf_failed",
          message: "That form submission could not be verified; reload the page and try again",
          detail: {},
        });
      }
      const origin = request.headers.origin;
      if (typeof origin === "string" && origin.length > 0) {
        if (!sameOrigin(origin, request.headers.host)) {
          return reply.status(403).send({
            ok: false,
            reasonCode: "csrf_failed",
            message: "That form was submitted from another origin",
            detail: {},
          });
        }
      }
    }

    const cleaned = { ...input };
    delete cleaned._csrf;
    delete cleaned._redirect;

    const idempotencyKey = request.headers["idempotency-key"];
    const loginContext = operationId === "auth.login" && typeof cleaned.handle === "string"
      ? { source: request.ip, handle: cleaned.handle }
      : null;
    if (loginContext && loginRateLimiter.isBlocked(loginContext.source, loginContext.handle)) {
      return reply.status(429).send({
        ok: false,
        reasonCode: "rate_limited",
        message: "Too many failed sign-in attempts; try again later",
        detail: {},
      });
    }

    let result;
    try {
      result = await dispatch(
        options.pool,
        operationId,
        cleaned,
        request.actor,
        typeof idempotencyKey === "string" ? { idempotencyKey } : {},
      );
    } catch (error) {
      if (loginContext && (error as { reasonCode?: string }).reasonCode === "unauthenticated") {
        loginRateLimiter.recordFailure(loginContext.source, loginContext.handle);
      }
      throw error;
    }
    if (loginContext) loginRateLimiter.recordSuccess(loginContext.source, loginContext.handle);

    // Login is the one command that mints a browser credential; the cookie is set here
    // rather than in the operation, which knows nothing about transports.
    if (operationId === "auth.login") {
      const output = result.output as { sessionToken: string };
      reply.setCookie(SESSION_COOKIE, output.sessionToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: options.secureCookies,
        path: "/",
        maxAge: 60 * 60 * 24 * 14,
      });
      reply.clearCookie(LOGIN_CSRF_COOKIE, { path: "/" });
    }
    if (operationId === "auth.logout") {
      reply.clearCookie(SESSION_COOKIE, { path: "/" });
    }

    if (wantsHtml(request) && redirectTo) {
      // Post/Redirect/Get. A browser that reloads after a write must not repeat it, and
      // every screen's state has to be reachable as a plain URL.
      return reply.status(303).header("location", redirectTo).send();
    }
    if (wantsHtml(request)) {
      // A form that names no redirect is saying its OUTPUT is the thing the person needs
      // to see. Redirecting anyway is what threw away the one-time access token: the row
      // was created, the browser was sent elsewhere, and the only copy of the secret was
      // discarded in between.
      const rendered = await renderPage({
        pool: options.pool,
        actor: request.actor,
        csrfToken: request.csrfSecret ?? "",
        loginCsrfToken: request.loginCsrfSecret ?? "",
        mustChangePassword: request.mustChangePassword,
        pathname: "/result",
        search: new URLSearchParams(),
        cookieHeader: request.headers.cookie,
        version: options.version,
        result: { operationId, output: result.output },
      });
      return reply.status(rendered.status).type("text/html; charset=utf-8").send(rendered.body);
    }
    return result.output;
  }

  app.post<{ Params: { operationId: string } }>("/api/v1/commands/:operationId", async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    return runCommand(request, reply, request.params.operationId, body);
  });

  // ---------------------------------------------------------------------------
  // Generated REST surface
  // ---------------------------------------------------------------------------
  for (const operation of allOperations()) {
    const fastifyPath = operation.http.path.replace(/\{([^}]+)\}/g, ":$1");
    if (operation.kind === "query") {
      app.get(fastifyPath, async (request, reply) => {
        const params = (request.params ?? {}) as Record<string, unknown>;
        const schema = operation.input as unknown as { properties?: Record<string, unknown> };
        const allowed = new Set(Object.keys(schema.properties ?? {}));
        // Validate the raw URL before dispatch cleans the object. In particular, do not
        // let Fastify/TypeBox erase a typo or an authority-shaped key into a green read.
        const query = Object.fromEntries(
          parseQuery(new URL(request.url, "http://internal").searchParams, allowed),
        );
        const result = await dispatch(options.pool, operation.id, { ...query, ...params }, request.actor);
        return reply.send(result.output);
      });
    } else {
      app.post(fastifyPath, async (request, reply) => {
        const params = (request.params ?? {}) as Record<string, unknown>;
        const body = (request.body ?? {}) as Record<string, unknown>;
        return runCommand(request, reply, operation.id, { ...body, ...params });
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Server-rendered UI
  // ---------------------------------------------------------------------------
  app.get("/*", async (request, reply) => {
    const url = new URL(request.url, "http://internal");
    if (url.pathname.startsWith("/api/")) {
      return reply.status(404).send({ ok: false, reasonCode: "not_found", message: "No such endpoint", detail: {} });
    }
    const html = await renderPage({
      pool: options.pool,
      actor: request.actor,
      csrfToken: request.csrfSecret ?? "",
      loginCsrfToken: request.loginCsrfSecret ?? "",
      mustChangePassword: request.mustChangePassword,
      pathname: url.pathname,
      search: url.searchParams,
      cookieHeader: request.headers.cookie,
      version: options.version,
    });
    return reply.status(html.status).type("text/html; charset=utf-8").send(html.body);
  });

  app.setErrorHandler(async (error, request, reply) => {
    const { status, payload } = normaliseError(error);
    if (wantsHtml(request) && status !== 401) {
      const html = await renderPage({
        pool: options.pool,
        actor: request.actor,
        csrfToken: request.csrfSecret ?? "",
        loginCsrfToken: request.loginCsrfSecret ?? "",
        mustChangePassword: request.mustChangePassword,
        pathname: "/error",
        search: new URLSearchParams(),
        cookieHeader: request.headers.cookie,
        version: options.version,
        error: payload,
      });
      return reply.status(status).type("text/html; charset=utf-8").send(html.body);
    }
    return reply.status(status).send(payload);
  });

  return app;
}
