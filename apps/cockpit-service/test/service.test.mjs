import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startCockpitService, CHAIN_WRITE_ROUTES } from "../../../dist/apps/cockpit-service/src/service.js";
import { CEREMONIAL_WRITES, SafeWriteSurface } from "../../../dist/packages/projection/src/write-surface.js";

/**
 * The cockpit service's HTTP surface, tested without an engine.
 *
 * Every chain call here stops at the surface boundary — either a required field
 * is missing (409 FIELD_REQUIRED) or the partition is unknown (409
 * UNKNOWN_PARTITION, reached with an empty workspace map) — so no MCP facade is
 * spawned and no chain, live or scratch, is touched.
 */
async function withService(run, options = {}) {
  const scratch = await mkdtemp(join(tmpdir(), "aos-service-test-"));
  const service = await startCockpitService({
    port: 0,
    domainDatabasePath: join(scratch, "domain.db"),
    workspaces: {},
    actor: "agent:test",
    ...options
  });
  try {
    const post = async (path, body) => {
      const response = await fetch(`${service.url}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      return { status: response.status, json: await response.json() };
    };
    await run({ service, post });
  } finally {
    await service.close();
    await rm(scratch, { recursive: true, force: true });
  }
}

test("the chain write surface is exactly transition, annotate, work, enrol", async () => {
  // The roster is the routing table (dispatch reads it), so this assertion and
  // the behavioural ones below can only drift apart by editing the same line
  // this test pins.
  assert.deepEqual([...CHAIN_WRITE_ROUTES].sort(), ["annotate", "enrol", "transition", "work"]);

  await withService(async ({ post }) => {
    // Each declared route answers as a route: refused for a missing field,
    // never mistaken for a page that does not exist.
    for (const verb of CHAIN_WRITE_ROUTES) {
      const refused = await post(`/api/chain/${verb}`, {});
      assert.equal(refused.status, 409, `${verb} should exist and refuse an empty body`);
      assert.equal(refused.json.reasonCode, "FIELD_REQUIRED");
    }
  });
});

test("a fully valid chain-write body reaches the surface layer for every route", async () => {
  await withService(async ({ post }) => {
    // UNKNOWN_PARTITION comes from the write surface, after validation — so a
    // 409 with that code proves the whole request shape was accepted.
    const bodies = {
      transition: { partitionId: "nope", recordId: "work:x", status: "ready" },
      annotate: { partitionId: "nope", recordId: "work:x", scope: "full replacement text" },
      work: { partitionId: "nope", projectId: "project:x", externalKey: "K-1", kind: "Story", parentId: "work:p", title: "t" },
      enrol: { partitionId: "nope", recordId: "work:x", workspaceId: "workspace:x", trainWorkId: "work:t" }
    };
    // A verb-specific required field, dropped to show the predicate's other
    // side: the same body minus one field must stop at FIELD_REQUIRED instead.
    const dropped = { transition: "status", annotate: "recordId", work: "title", enrol: "trainWorkId" };
    for (const verb of CHAIN_WRITE_ROUTES) {
      const refused = await post(`/api/chain/${verb}`, bodies[verb]);
      assert.equal(refused.json.reasonCode, "UNKNOWN_PARTITION", `${verb} should pass validation`);

      const incomplete = { ...bodies[verb] };
      delete incomplete[dropped[verb]];
      const invalid = await post(`/api/chain/${verb}`, incomplete);
      assert.equal(invalid.json.reasonCode, "FIELD_REQUIRED", `${verb} should validate ${dropped[verb]}`);
    }
  });
});

test("wrong-typed chain-write fields are refused by name, never silently dropped", async () => {
  await withService(async ({ post }) => {
    // Every refusal below must arrive before the surface: with an empty
    // workspace map, anything that passed validation would say UNKNOWN_PARTITION
    // instead, so the codes asserted here prove the route (not the engine, not
    // the surface) did the refusing.
    const badScope = await post("/api/chain/annotate", { partitionId: "nope", recordId: "work:x", scope: 42 });
    assert.equal(badScope.status, 409);
    assert.equal(badScope.json.reasonCode, "FIELD_INVALID");
    assert.match(badScope.json.error, /scope/u);

    const badDecidedBy = await post("/api/chain/annotate",
      { partitionId: "nope", recordId: "work:x", decidedBy: "minutes:a" });
    assert.equal(badDecidedBy.json.reasonCode, "FIELD_INVALID");
    assert.match(badDecidedBy.json.error, /decidedBy/u);

    const mixedDecidedBy = await post("/api/chain/annotate",
      { partitionId: "nope", recordId: "work:x", decidedBy: ["minutes:a", 7] });
    assert.equal(mixedDecidedBy.json.reasonCode, "FIELD_INVALID");
    assert.match(mixedDecidedBy.json.error, /decidedBy/u);

    // Both advisory fields absent: refused at the route, without spawning an
    // engine to say the same thing more expensively.
    const neither = await post("/api/chain/annotate", { partitionId: "nope", recordId: "work:x" });
    assert.equal(neither.status, 409);
    assert.equal(neither.json.reasonCode, "FIELD_REQUIRED");
    assert.match(neither.json.error, /scope or decidedBy/u);

    // A wrong-typed parentId must not silently become "parentless".
    const badParent = await post("/api/chain/work",
      { partitionId: "nope", projectId: "project:x", externalKey: "K-1", kind: "Story", parentId: 42, title: "t" });
    assert.equal(badParent.json.reasonCode, "FIELD_INVALID");
    assert.match(badParent.json.error, /parentId/u);

    // The legal shapes of parentId still pass validation (proved by reaching
    // UNKNOWN_PARTITION): absent, null, and a non-empty string.
    for (const parentId of [undefined, null, "work:p"]) {
      const legal = await post("/api/chain/work",
        { partitionId: "nope", projectId: "project:x", externalKey: "K-1", kind: "Story",
          ...(parentId !== undefined ? { parentId } : {}), title: "t" });
      assert.equal(legal.json.reasonCode, "UNKNOWN_PARTITION", `parentId=${String(parentId)} must be legal`);
    }
  });
});

test("ceremonial verbs are not on the HTTP surface, and stay declared as ceremony", async () => {
  const ceremonialVerbs = CEREMONIAL_WRITES.map((entry) => entry.verb);
  // The declaration this boundary rests on: were a ceremony verb ever removed
  // from CEREMONIAL_WRITES, the complement check below would silently shrink.
  for (const verb of [
    "conference-open", "conference-append-position", "conference-close",
    "gate-transition", "attestation-enable", "work-delete"
  ]) {
    assert.ok(ceremonialVerbs.includes(verb), `${verb} must remain declared ceremonial`);
  }

  await withService(async ({ post }) => {
    // 404, not 409: a ceremony verb is not a route with a missing field, it is
    // not a route at all.
    for (const verb of [...ceremonialVerbs, "conference", "gate", "knowledge", "delete"]) {
      const missing = await post(`/api/chain/${verb}`, { partitionId: "TCRN-AOS" });
      assert.equal(missing.status, 404, `${verb} must not be an HTTP chain route`);
    }
  });
});

test("every work-graph write carries the head sentinel supplied by the surface base", async () => {
  // Observed through a recording stand-in client: the assertion is about the
  // bytes the engine would receive, and no engine is spawned to receive them.
  const calls = [];
  const recorder = {
    callTool: async (tool, args) => { calls.push({ tool, args }); return { record: { id: "work:x" } }; }
  };
  const surface = new SafeWriteSurface(recorder, { workspacePath: "/nowhere", actor: "agent:test" });
  await surface.createWork({ projectId: "project:p", externalKey: "K-1", kind: "Story", parentId: "work:p", title: "t" });
  await surface.transition({ id: "work:x", status: "ready" });
  await surface.annotate({ id: "work:x", scope: "s", decidedBy: ["minutes:a", "minutes:b"] });
  await surface.enrolInTrain({ id: "work:x", workspaceId: "workspace:w", trainWorkId: "work:t" });

  // createWork is two events (create + title annotation), so five calls in all —
  // and every one of them yields to the chain's head rather than pinning a
  // version the cockpit read earlier.
  assert.equal(calls.length, 5);
  for (const call of calls) {
    assert.equal(call.args["expected-version"], "head", `${call.tool} must use the head sentinel`);
    assert.equal(call.args.actor, "agent:test", `${call.tool} must carry the configured actor`);
  }

  // The wire bytes of the two advisory formats, asserted exactly. The sprint
  // reference is workspace:<id>#work:<id> — a comma once stood where the # is,
  // and the engine refused every enrolment until the first real call caught it
  // (TCRN-AOS-STORY-111) — and decided-by crosses the MCP facade as a real
  // array, because the facade's list arguments refuse the CLI's comma-joined
  // wire form (MCP_ARGUMENT_INVALID).
  const enrol = calls[4];
  assert.equal(enrol.tool, "tcrn_workflow_work_annotate");
  assert.equal(enrol.args.sprint, "workspace:w#work:t", "sprint must be the workspace:<id>#work:<id> wire form");
  const annotate = calls[3];
  assert.deepEqual(annotate.args["decided-by"], ["minutes:a", "minutes:b"],
    "decided-by must reach the facade as an array, not a joined string");
});

test("the service refuses to start without a configured actor", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "aos-service-test-"));
  // If the refusal ever regresses, the service has actually started — and a
  // started service holds the event loop open, so the failing test would hang
  // the whole run instead of reporting red. Capture and close it either way.
  let unexpectedlyStarted = null;
  try {
    await assert.rejects(
      async () => {
        unexpectedlyStarted = await startCockpitService(
          { port: 0, domainDatabasePath: join(scratch, "domain.db"), workspaces: {} });
      },
      /no actor configured/u
    );
  } finally {
    if (unexpectedlyStarted) await unexpectedlyStarted.close();
    await rm(scratch, { recursive: true, force: true });
  }
});

test("the configured actor is stated on health and stamped on domain writes", async () => {
  await withService(async ({ service, post }) => {
    const health = await (await fetch(`${service.url}/api/health`)).json();
    assert.equal(health.actor, "agent:custom");

    const put = await fetch(`${service.url}/api/domain/annotation`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ partitionId: "TCRN-AOS", recordId: "work:x", labels: ["l"] })
    });
    const annotated = await put.json();
    assert.equal(annotated.annotation.updatedBy, "agent:custom");

    const comment = await post("/api/domain/comment",
      { partitionId: "TCRN-AOS", recordId: "work:x", body: "attributed" });
    assert.equal(comment.json.comment.author, "agent:custom");
  }, { actor: "agent:custom" });
});
