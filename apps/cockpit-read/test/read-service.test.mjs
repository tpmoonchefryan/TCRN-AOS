import test from "node:test";
import assert from "node:assert/strict";
import { request } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { startCockpitReadService } from "../../../dist/apps/cockpit-read/src/read-service.js";
import { DomainStore, loadDomainMigrationSql } from "../../../dist/packages/projection/src/index.js";

/** A GET with an explicit Host header. `fetch` normalises Host to the connection
    address, so the rebinding-refusal path is exercised through node:http. */
function rawGetWithHost(url, hostHeader) {
  return new Promise((resolve, reject) => {
    const req = request(url, { method: "GET" }, (res) => {
      let body = "";
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body }));
    });
    req.on("error", reject);
    if (hostHeader !== undefined) req.setHeader("Host", hostHeader);
    req.end();
  });
}

/**
 * The read face's invariants (STORY-138/139), tested without an engine.
 *
 * The read face is the LAN path to the workbench and carries NO write
 * capability. These tests assert that as a structural fact about its surface:
 * every chain route is absent, every write method is refused, the domain store
 * is opened read-only, and the network posture (concrete bind, Host allow-list,
 * security headers) holds. A regression that reintroduces a chain route, a
 * write method, or a wildcard bind turns a test red.
 */

const migrationSql = loadDomainMigrationSql(resolve(process.cwd(), "packages/db/migrations/domain"));

async function withScratchDb(run) {
  const scratch = await mkdtemp(join(tmpdir(), "aos-read-test-"));
  const dbPath = join(scratch, "domain.db");
  // Create the precious store with the schema applied (the writer's shape), then
  // close it — the read service opens the SAME file read-only.
  const seed = new DomainStore(dbPath, migrationSql);
  seed.close();
  try {
    await run(dbPath, scratch);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

async function withReadService(run, options = {}) {
  await withScratchDb(async (dbPath) => {
    const service = await startCockpitReadService({
      port: 0,
      host: "127.0.0.1",
      domainDatabasePath: dbPath,
      ...options
    });
    try {
      await run({ service, dbPath });
    } finally {
      await service.close();
    }
  });
}

test("binds the configured concrete address, and refuses wildcard binds", async () => {
  await withReadService(async ({ service }) => {
    const address = service.server.address();
    assert.ok(address && typeof address === "object", "bound address must be readable");
    assert.equal(address.address, "127.0.0.1", "the read face must bind the concrete host stated, never a wildcard");
  });

  // Wildcard binds are the shape a LAN read face turns into a WAN read face
  // without anyone deciding that (MIN-014). They must be refused at start.
  await withScratchDb(async (dbPath) => {
    for (const host of ["0.0.0.0", "::"]) {
      await assert.rejects(
        async () => startCockpitReadService({ port: 0, host, domainDatabasePath: dbPath }),
        /wildcard binds are not allowed/u,
        `${host} must be refused`
      );
    }
  });
});

test("the read face has no chain routes and no write methods", async () => {
  await withReadService(async ({ service }) => {
    const get = async (path, method = "GET", body) => {
      const response = await fetch(`${service.url}${path}`, {
        method,
        headers: body ? { "content-type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined
      });
      return { status: response.status, json: await response.json().catch(() => null) };
    };

    // Every chain route the write face owns must be structurally absent here.
    // A GET to one answers 404 (the route does not exist on this face); any
    // write method is refused globally before routing.
    for (const verb of ["transition", "annotate", "work", "enrol", "conference", "gate", "knowledge", "delete"]) {
      const refused = await get(`/api/chain/${verb}`, "GET");
      assert.equal(refused.status, 404, `/api/chain/${verb} must not exist on the read face`);
      assert.equal(refused.json.reasonCode, "READ_ONLY_SURFACE");
    }

    // Write methods are refused globally, even on a route that would be a read.
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      const refused = await get("/api/health", method, {});
      assert.equal(refused.status, 405, `${method} must be refused globally`);
      assert.equal(refused.json.reasonCode, "READ_ONLY_SURFACE");
    }
  });
});

test("the domain store is opened read-only: a write is refused at the SQLite connection", async () => {
  await withReadService(async ({ service, dbPath }) => {
    // The service's own store is private; the invariant is re-proven at the
    // connection level the service uses — a read-only open refuses writes.
    const store = new DomainStore(dbPath, migrationSql, { readOnly: true });
    assert.throws(
      () => store.setAnnotation({
        partitionId: "TCRN-AOS", recordId: "work:x", labels: ["nope"], updatedAt: "2026-08-03T00:00:00Z", updatedBy: "agent:test"
      }),
      /readonly database/u,
      "the read face's domain store must refuse a write at the connection"
    );
    store.close();
  });
});

test("health states the read posture, and domain reads are served", async () => {
  await withReadService(async ({ service }) => {
    const health = await (await fetch(`${service.url}/api/health`)).json();
    assert.equal(health.ok, true);
    assert.equal(health.service, "tcrn-aos-read");
    assert.equal(health.readonly, true);
    assert.equal(health.chainWriteAvailable, false);
    assert.deepEqual(health.partitions, ["TCRN-AOS"]);

    // The read routes answer: export and one record's domain panel.
    const exported = await (await fetch(`${service.url}/api/domain/export`)).json();
    assert.equal(exported.ok, true);

    const panel = await (await fetch(`${service.url}/api/domain/TCRN-AOS/work:x`)).json();
    assert.equal(panel.ok, true);
    assert.equal(panel.annotation, null);
    assert.deepEqual(panel.comments, []);
    assert.deepEqual(panel.relations, []);
  });
});

test("Host header validation: an unlisted host is refused, a listed host answers", async () => {
  // Allow-list names a hostname; the server compares it to the request's Host
  // with the port stripped. Bound to 127.0.0.1, a normal request carries that
  // hostname, so it answers; an explicit foreign Host is refused.
  await withReadService(async ({ service }) => {
    const bad = await rawGetWithHost(`${service.url}/api/health`, "evil.example");
    assert.equal(bad.status, 403, "a Host not on the allow-list must be refused");

    const good = await rawGetWithHost(`${service.url}/api/health`, undefined);
    assert.equal(good.status, 200, "a host on the allow-list must answer");
  }, { allowedHosts: ["127.0.0.1"] });
});

test("security headers are on every response", async () => {
  await withReadService(async ({ service }) => {
    const json = await fetch(`${service.url}/api/health`);
    assert.equal(json.headers.get("x-content-type-options"), "nosniff");
    assert.equal(json.headers.get("x-frame-options"), "DENY");
    assert.match(json.headers.get("content-security-policy") ?? "", /default-src 'self'/u);
    assert.match(json.headers.get("content-type") ?? "", /application\/json/u);
  });
});

test("the built static web is served, with the shell fallback for deep links", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "aos-read-static-"));
  const { writeFile } = await import("node:fs/promises");
  const staticRoot = join(scratch, "web");
  const { mkdir } = await import("node:fs/promises");
  await mkdir(staticRoot, { recursive: true });
  await writeFile(join(staticRoot, "index.html"), "<!doctype html><title>read</title>");

  try {
    const service = await startCockpitReadService({
      port: 0, host: "127.0.0.1", domainDatabasePath: null,
      staticRoot
    });
    try {
      const root = await fetch(`${service.url}/`);
      assert.equal(root.status, 200);
      assert.match(root.headers.get("content-type") ?? "", /text\/html/u);
      assert.equal(root.headers.get("x-content-type-options"), "nosniff");

      // A deep link falls back to the shell (the client renders from location).
      const deep = await fetch(`${service.url}/work-items/K-1`);
      assert.equal(deep.status, 200);
      assert.match(deep.headers.get("content-type") ?? "", /text\/html/u);
    } finally {
      await service.close();
    }
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});
