import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRuntimeTransport, transportMvpMethods } from "../../../dist/packages/mcp-server/src/index.js";
import { AosSqliteRepository } from "../../../dist/packages/db/src/index.js";
import { createDefaultSeed } from "../../../dist/packages/domain/src/index.js";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const platformRoot = fileURLToPath(new URL("../../../..", import.meta.url));
const migrationsDir = fileURLToPath(new URL("../../db/migrations/sqlite", import.meta.url));

const ilyaActor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "kr02-method-surface-test"
};

const atlasActor = {
  employeeId: "employee-atlas",
  role: "owner_observer",
  threadId: "atlas-thread",
  sessionId: "kr02-method-surface-test"
};

test("KR-02 transport exposes bounded knowledge propose/read/search with filters, access audit, replay, and refusal", async () => {
  const tmpRoot = join(platformRoot, "tmp");
  await mkdir(tmpRoot, { recursive: true });
  const root = await mkdtemp(join(tmpRoot, "tcrn-aos-kr02-method-test-"));
  const databasePath = join(root, "kr02.sqlite");
  await writeFile(join(root, ".tcrn-aos-phase1-root"), "owned-by-kr02-method-test\n", "utf8");
  try {
    await seedEmployeesAndCanonicalKnowledge(databasePath);
    const runtime = createRuntimeTransport({ actor: ilyaActor, databasePath, databaseRoot: root, repoRoot, migrationsDir });
    try {
      assert.deepEqual(transportMvpMethods.filter((method) => method.startsWith("aos.knowledge.")).sort(), [
        "aos.knowledge.entry.propose",
        "aos.knowledge.entry.read",
        "aos.knowledge.search"
      ]);

      const draft = runtime.transport.handleJsonRpc({
        jsonrpc: "2.0",
        id: 1,
        method: "aos.knowledge.entry.propose",
        params: knowledgePayload({
          id: "knowledge-kr02-draft",
          title: "KR02 draft runbook",
          status: "draft",
          summary: "Draft KR02 runbook snippet excluded by default.",
          body: "Draft KR02 body."
        })
      });
      assert.equal(draft.error, undefined);
      assert.equal(draft.result.ok, true);
      assert.equal(draft.result.entry.id, "knowledge-kr02-draft");
      assert.equal(draft.result.entry.status, "draft");
      assert.equal(draft.result.entry.bodyIncluded, false);
      assert.equal(Object.hasOwn(draft.result.entry, "body"), false);

      const replay = runtime.transport.handleJsonRpc({
        jsonrpc: "2.0",
        id: 2,
        method: "aos.knowledge.entry.propose",
        params: knowledgePayload({
          id: "knowledge-kr02-draft",
          title: "KR02 draft runbook",
          status: "draft",
          summary: "Draft KR02 runbook snippet excluded by default.",
          body: "Draft KR02 body."
        })
      });
      assert.equal(replay.error, undefined);
      assert.equal(replay.result.status, "deduped");
      assert.equal(replay.result.result.entry.id, "knowledge-kr02-draft");

      const proposeRoleMismatch = runtime.transport.handleJsonRpc({
        jsonrpc: "2.0",
        id: 3,
        method: "aos.knowledge.entry.propose",
        params: knowledgePayload({
          id: "knowledge-kr02-role-mismatch",
          roleScope: "security",
          status: "draft",
          idempotencyKey: "kr02-role-mismatch-propose"
        })
      });
      assert.equal(proposeRoleMismatch.result, undefined);
      assert.equal(proposeRoleMismatch.error.data.reason, "knowledge_role_scope_mismatch");

      const fakeCanonicalGate = runtime.transport.handleJsonRpc({
        jsonrpc: "2.0",
        id: 4,
        method: "aos.knowledge.entry.propose",
        params: knowledgePayload({
          id: "knowledge-kr02-fake-canonical",
          status: "canonical",
          canonicalGateDecisionId: "fake-gate-decision",
          idempotencyKey: "kr02-fake-canonical-propose"
        })
      });
      assert.equal(fakeCanonicalGate.result, undefined);
      assert.equal(fakeCanonicalGate.error.data.reason, "knowledge_canonical_propose_deferred");

      const defaultSearch = runtime.transport.handleJsonRpc({
        jsonrpc: "2.0",
        id: 5,
        method: "aos.knowledge.search",
        params: { query: "KR02 runbook", project: "TCRN-AOS", limit: 1 }
      });
      assert.equal(defaultSearch.error, undefined);
      assert.equal(defaultSearch.result.ok, true);
      assert.equal(defaultSearch.result.page.defaultCanonicalFilterApplied, true);
      assert.equal(defaultSearch.result.page.defaultFreshnessFilterApplied, true);
      assert.equal(defaultSearch.result.items.length, 1);
      assert.equal(defaultSearch.result.items[0].status, "canonical");
      assert.equal(defaultSearch.result.items[0].stale, false);
      assert.equal(Object.hasOwn(defaultSearch.result.items[0], "body"), false);
      assert.equal(defaultSearch.result.page.hasMore, true);
      assert.equal(typeof defaultSearch.result.page.nextCursor, "string");

      const nextPage = runtime.transport.handleJsonRpc({
        jsonrpc: "2.0",
        id: 6,
        method: "aos.knowledge.search",
        params: { query: "KR02 runbook", project: "TCRN-AOS", limit: 1, cursor: defaultSearch.result.page.nextCursor }
      });
      assert.equal(nextPage.error, undefined);
      assert.equal(nextPage.result.items.length, 1);
      assert.notEqual(nextPage.result.items[0].id, defaultSearch.result.items[0].id);

      const includeDraft = runtime.transport.handleJsonRpc({
        jsonrpc: "2.0",
        id: 7,
        method: "aos.knowledge.search",
        params: { query: "draft", project: "TCRN-AOS", includeDraft: true }
      });
      assert.equal(includeDraft.error, undefined);
      assert.deepEqual(includeDraft.result.items.map((item) => item.id), ["knowledge-kr02-draft"]);

      const includeStale = runtime.transport.handleJsonRpc({
        jsonrpc: "2.0",
        id: 8,
        method: "aos.knowledge.search",
        params: { query: "stale", project: "TCRN-AOS", includeStale: true }
      });
      assert.equal(includeStale.error, undefined);
      assert.deepEqual(includeStale.result.items.map((item) => item.id), ["knowledge-kr02-stale"]);
      assert.equal(includeStale.result.items[0].stale, true);

      const byId = runtime.transport.handleJsonRpc({
        jsonrpc: "2.0",
        id: 9,
        method: "aos.knowledge.entry.read",
        params: { id: "knowledge-kr02-canonical" }
      });
      assert.equal(byId.error, undefined);
      assert.equal(byId.result.entry.body, "Canonical KR02 body visible only through by-id read.");
      assert.equal(byId.result.entry.bodyIncluded, true);
      assert.equal(byId.result.entry.accessCount >= 2, true);

      const oversized = runtime.transport.handleJsonRpc({
        jsonrpc: "2.0",
        id: 10,
        method: "aos.knowledge.entry.propose",
        params: knowledgePayload({
          id: "knowledge-kr02-oversized",
          title: "KR02 oversized body",
          body: words(1501),
          status: "draft",
          idempotencyKey: "kr02-oversized-propose"
        })
      });
      assert.equal(oversized.result, undefined);
      assert.equal(oversized.error.data.reason, "knowledge_body_word_limit_exceeded");

      const roleMismatch = runtime.transport.handleJsonRpc({
        jsonrpc: "2.0",
        id: 11,
        method: "aos.knowledge.search",
        params: { query: "KR02", roleScope: "security" }
      });
      assert.equal(roleMismatch.result, undefined);
      assert.equal(roleMismatch.error.data.reason, "knowledge_role_scope_mismatch");

      const crossRoleRead = runtime.transport.handleJsonRpc({
        jsonrpc: "2.0",
        id: 12,
        method: "aos.knowledge.entry.read",
        params: { id: "knowledge-kr02-security" }
      });
      assert.equal(crossRoleRead.result, undefined);
      assert.equal(crossRoleRead.error.data.reason, "knowledge_role_scope_mismatch");

      const unknownKnowledge = runtime.transport.handleJsonRpc({
        jsonrpc: "2.0",
        id: 13,
        method: "aos.knowledge.entry.delete",
        params: { id: "knowledge-kr02-canonical" }
      });
      assert.equal(unknownKnowledge.result, undefined);
      assert.equal(unknownKnowledge.error.data.reason, "transport_method_outside_mvp_allowlist");

      const forbiddenSlice = runtime.transport.handleJsonRpc({
        jsonrpc: "2.0",
        id: 14,
        method: "aos.resource.governance.read",
        params: {}
      });
      assert.equal(forbiddenSlice.result, undefined);
      assert.equal(forbiddenSlice.error.data.reason, "transport_method_outside_mvp_allowlist");
    } finally {
      runtime.close();
    }

    const atlasRuntime = createRuntimeTransport({ actor: atlasActor, databasePath, databaseRoot: root, repoRoot, migrationsDir });
    try {
      const blockedWrite = atlasRuntime.transport.handleJsonRpc({
        jsonrpc: "2.0",
        id: 15,
        method: "aos.knowledge.entry.propose",
        params: knowledgePayload({ id: "knowledge-kr02-blocked-owner", status: "draft" })
      });
      assert.equal(blockedWrite.result, undefined);
      assert.equal(blockedWrite.error.data.reason, "transport_actor_blocked_role");

      const ownerRead = atlasRuntime.transport.handleJsonRpc({
        jsonrpc: "2.0",
        id: 16,
        method: "aos.knowledge.entry.read",
        params: { id: "knowledge-kr02-security" }
      });
      assert.equal(ownerRead.error, undefined);
      assert.equal(ownerRead.result.entry.id, "knowledge-kr02-security");
    } finally {
      atlasRuntime.close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function seedEmployeesAndCanonicalKnowledge(databasePath) {
  const repository = new AosSqliteRepository({ databasePath, migrationsDir });
  repository.applyMigrations();
  repository.seedAiEmployees(createDefaultSeed().employees, "kr02-method-surface-test-seed");
  repository.createKnowledgeRetrievalEntry(knowledgePayload({
    id: "knowledge-kr02-canonical",
    title: "KR02 canonical operator runbook",
    summary: "Canonical KR02 runbook snippet for local operator retrieval.",
    body: "Canonical KR02 body visible only through by-id read.",
    status: "canonical",
    idempotencyKey: undefined
  }));
  repository.createKnowledgeRetrievalEntry(knowledgePayload({
    id: "knowledge-kr02-second",
    title: "KR02 canonical paging runbook",
    summary: "Second canonical KR02 runbook snippet for cursor proof.",
    body: "Second canonical KR02 body.",
    status: "canonical",
    idempotencyKey: undefined
  }));
  repository.createKnowledgeRetrievalEntry(knowledgePayload({
    id: "knowledge-kr02-stale",
    title: "KR02 stale runbook",
    summary: "Stale KR02 runbook snippet excluded by default.",
    body: "Stale KR02 body.",
    status: "canonical",
    lastVerified: "2026-01-01",
    stalenessPolicy: "review_after_1_days",
    idempotencyKey: undefined
  }));
  repository.createKnowledgeRetrievalEntry(knowledgePayload({
    id: "knowledge-kr02-security",
    title: "KR02 security scoped runbook",
    roleScope: "security",
    summary: "Security scoped KR02 runbook must not be readable by implementation.",
    body: "Security scoped KR02 body.",
    status: "canonical",
    idempotencyKey: undefined
  }));
  repository.close();
}

function knowledgePayload(overrides = {}) {
  return {
    id: "knowledge-kr02-fixture",
    title: "KR02 knowledge fixture",
    roleScope: "implementation",
    project: "TCRN-AOS",
    category: "knowledge-retrieval",
    knowledgeKind: "runbook_fact",
    status: "draft",
    lastVerified: "2026-07-08",
    stalenessPolicy: "review_after_30_days",
    sourceRef: "workflow-plan-digest-reference",
    sourceDigest: "sha256:kr02-fixture-source",
    tags: ["kr02", "mcp", "knowledge"],
    summary: "KR02 fixture for method surface proof.",
    body: "KR02 fixture body for by-id fetch.",
    canonicalGateDecisionId: "gate-decision-kr02-default",
    idempotencyKey: "kr02-fixture-propose",
    ...overrides
  };
}

function words(count) {
  return Array.from({ length: count }, (_, index) => `word${index}`).join(" ");
}
