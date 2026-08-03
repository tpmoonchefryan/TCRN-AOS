import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DomainStore, loadDomainMigrationSql } from "../../../dist/packages/projection/src/index.js";
import { isDomainActor, isAgentActor, isPersonActor, requireDomainActor } from "../../../dist/packages/projection/src/domain-actor.js";

/**
 * EPIC-041 STORY-143 — the domain store's actor is a person/agent dual-class.
 *
 * Every annotation, comment and relation carries who wrote it. Before EPIC-041
 * that was a single opaque string (always `agent:fable`); the collaboration
 * model (MIN-013 A2) requires distinguishing a person from an agent. The store
 * now refuses an anonymous write, so "no author" is structurally impossible.
 */

const migrationSql = loadDomainMigrationSql(resolve(process.cwd(), "packages/db/migrations/domain"));

async function withStore(run) {
  const scratch = await mkdtemp(join(tmpdir(), "aos-actor-test-"));
  const store = new DomainStore(join(scratch, "domain.db"), migrationSql);
  try {
    await run(store);
  } finally {
    store.close();
    await rm(scratch, { recursive: true, force: true });
  }
}

test("the actor classifier admits agent and person, refuses everything else", () => {
  assert.equal(isDomainActor("agent:fable"), true);
  assert.equal(isDomainActor("person:owner:governance"), true);
  assert.equal(isDomainActor("agent:"), false, "an empty model is not an actor");
  assert.equal(isDomainActor("person:"), false);
  assert.equal(isDomainActor(""), false, "empty string is anonymous");
  assert.equal(isDomainActor("owner:governance"), false, "a bare role without a class is anonymous");
  assert.equal(isDomainActor("fable"), false, "a bare name is anonymous");
  assert.equal(isDomainActor(undefined), false);
  assert.equal(isDomainActor(null), false);

  assert.equal(isAgentActor("agent:fable"), true);
  assert.equal(isAgentActor("person:owner"), false);
  assert.equal(isPersonActor("person:owner"), true);
  assert.equal(isPersonActor("agent:fable"), false);
});

test("requireDomainActor throws on an anonymous actor and returns a legal one", () => {
  for (const bad of ["", "fable", "owner:governance", "agent:", null, undefined]) {
    assert.throws(() => requireDomainActor(bad, "updatedBy"), /attributed actor/u);
  }
  assert.equal(requireDomainActor("person:owner:governance", "updatedBy"), "person:owner:governance");
  assert.equal(requireDomainActor("agent:fable", "author"), "agent:fable");
});

test("setAnnotation records a person or agent actor and refuses an anonymous one", () => {
  return withStore(async (store) => {
    const agent = store.setAnnotation({
      partitionId: "TCRN-AOS", recordId: "work:x", labels: ["a"],
      updatedAt: "2026-08-03T00:00:00Z", updatedBy: "agent:fable"
    });
    assert.equal(agent.updatedBy, "agent:fable");

    const person = store.setAnnotation({
      partitionId: "TCRN-AOS", recordId: "work:x", labels: ["b"],
      updatedAt: "2026-08-03T00:00:01Z", updatedBy: "person:owner:governance"
    });
    assert.equal(person.updatedBy, "person:owner:governance");

    assert.throws(
      () => store.setAnnotation({
        partitionId: "TCRN-AOS", recordId: "work:x", labels: ["c"],
        updatedAt: "2026-08-03T00:00:02Z", updatedBy: "nobody"
      }),
      /attributed actor/u,
      "an anonymous annotation must be refused"
    );
  });
});

test("addComment records a person or agent author and refuses an anonymous one", () => {
  return withStore(async (store) => {
    const comment = store.addComment({
      id: "comment:1", partitionId: "TCRN-AOS", recordId: "work:x",
      author: "person:owner:governance", body: "approved", createdAt: "2026-08-03T00:00:00Z"
    });
    assert.equal(comment.author, "person:owner:governance");

    assert.throws(
      () => store.addComment({
        id: "comment:2", partitionId: "TCRN-AOS", recordId: "work:x",
        author: "", body: "anon", createdAt: "2026-08-03T00:00:01Z"
      }),
      /attributed actor/u,
      "an anonymous comment must be refused"
    );
  });
});

test("addRelation records a person or agent creator and refuses an anonymous one", () => {
  return withStore(async (store) => {
    const rel = store.addRelation({
      id: "relation:1", partitionId: "TCRN-AOS", recordId: "work:a",
      relation: "blocks", targetPartitionId: "TCRN-AOS", targetRecordId: "work:b",
      createdAt: "2026-08-03T00:00:00Z", createdBy: "agent:fable"
    });
    assert.equal(rel.createdBy, "agent:fable");

    assert.throws(
      () => store.addRelation({
        id: "relation:2", partitionId: "TCRN-AOS", recordId: "work:a",
        relation: "blocks", targetPartitionId: "TCRN-AOS", targetRecordId: "work:b",
        createdAt: "2026-08-03T00:00:01Z", createdBy: null
      }),
      /attributed actor/u,
      "an anonymous relation must be refused"
    );
  });
});
