import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AosSqliteRepository,
  assertRouteOwnedSqliteRoot,
  phase1CoreTables,
  phase1ExcludedRuntimeTables
} from "../../../dist/packages/db/src/index.js";
import { AosStore, createDefaultSeed } from "../../../dist/packages/domain/src/index.js";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const migrationsDir = fileURLToPath(new URL("../migrations/sqlite", import.meta.url));
const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "phase1-db-test"
};

test("Phase 1 SQLite repository applies core migrations, persists store writes, hydrates, and blocks audit mutation", async () => {
  const root = await mkdtemp(join(tmpdir(), "tcrn-aos-phase1-test-"));
  await writeFile(join(root, ".tcrn-aos-phase1-root"), "owned-by-test\n", "utf8");
  try {
    const rootReadback = assertRouteOwnedSqliteRoot(root, repoRoot);
    assert.equal(rootReadback.ok, true);
    const repository = new AosSqliteRepository({ databasePath: join(root, "phase1.sqlite"), migrationsDir });
    const migration = repository.applyMigrations();
    assert.equal(migration.ok, true);
    assert.equal(migration.migrationCount, 2);
    assert.equal(repository.applyMigrations().appliedCount, 0);
    assert.deepEqual(phase1CoreTables.every((table) => repository.tableNames().includes(table)), true);
    assert.equal(repository.tableNames().includes("aos_knowledge_entries"), true);
    assert.deepEqual(phase1ExcludedRuntimeTables.some((table) => repository.tableNames().includes(table)), false);
    repository.seedAiEmployees(createDefaultSeed().employees, "test-seed");
    const registryProjection = repository.projectThreadRegistryEmployees({
      threads: [
        {
          codexAgentSlug: "tcrn-thread-ilya-full-stack-implementer",
          name: "Ilya, Full-Stack Implementer",
          jobTitle: "Full-Stack Implementer",
          threadId: actor.threadId,
          status: "active",
          lifecycle: "persistent",
          contactWhen: "Narrow implementation route is ready."
        }
      ]
    }, "test-registry-digest").readback;
    assert.equal(registryProjection.canonicalMergeCount, 1);
    assert.equal(registryProjection.duplicateNonNullThreadIdCount, 0);
    assert.equal(registryProjection.secondSeedNoop, true);
    assert.equal(registryProjection.registryJobTitlePreserved, true);

    const store = new AosStore(createDefaultSeed(), { persistence: repository });
    store.upsertProject(createDefaultSeed().projects.find((project) => project.id === "TCRN-AOS"), actor);
    const initiative = store.createInitiative({
      projectId: "TCRN-AOS",
      title: "Phase 1 Test Initiative",
      status: "in_progress",
      problem: "Core records need SQLite persistence.",
      expectedOutcome: "Store writes hydrate after restart."
    }, actor);
    const epic = store.createEpic({ initiativeId: initiative.id, title: "SQLite core", goal: "Persist core records", status: "in_progress" }, actor);
    const story = store.createStory({
      epicId: epic.id,
      title: "Persist story",
      problem: "In-memory records vanish.",
      user: "AI operator",
      expectedBehavior: "Story survives restart.",
      acceptanceCriteria: ["write-through", "hydrate"],
      status: "in_progress",
      estimate: { effortPoints: 3, complexity: "medium", risk: "L3", verificationCost: "medium", confidence: "medium" },
      subTasks: []
    }, actor);
    const comment = store.addComment({
      ticketId: story.id,
      type: "agent_observation",
      actor,
      body: "Phase 1 persistence test comment."
    }, actor);
    store.addSubTask(story.id, {
      id: "subtask-phase1-test",
      title: "Persist subtask",
      ownerRole: "implementation",
      status: "in_progress",
      dependencyIds: [],
      proofExpectation: "phase1-sqlite-repository.test"
    }, actor);
    const assignment = store.createAssignment({
      employeeId: actor.employeeId,
      targetId: story.id,
      targetType: "story",
      role: "implementation",
      status: "in_progress",
      dueState: "none",
      proofExpectation: "phase1 persistence test"
    }, actor);
    const nonStoryAssignmentCollision = store.createAssignment({
      employeeId: actor.employeeId,
      targetId: story.id,
      targetType: "gate",
      role: "implementation",
      status: "in_progress",
      dueState: "none",
      proofExpectation: "trace collision exclusion"
    }, actor);
    store.recordAgentRun({
      assignmentId: assignment.id,
      status: "success",
      startedAt: "2026-07-05T00:00:00.000Z",
      endedAt: "2026-07-05T00:01:00.000Z",
      readback: "metadata-only",
      outputSummary: "Phase 1 test run"
    }, actor);
    const evidence = store.linkEvidence({
      type: "artifact_id",
      target: "phase1-test-evidence",
      validity: "valid",
      producer: actor.employeeId,
      digest: "sha256:phase1-test",
      redactionState: "metadata_only"
    }, actor);
    store.requestGate({ type: "evidence_proof", linkedTicketId: story.id, inputEvidenceIds: [evidence.id] }, actor);

    const schemaIntegrity = repository.schemaIntegrityReadback();
    assert.equal(schemaIntegrity.ok, true);
    assert.deepEqual(schemaIntegrity.missingJsonCheckTables, []);
    assert.equal(schemaIntegrity.jsonCheckTables.length, phase1CoreTables.length);
    assert.equal(Object.values(schemaIntegrity.invalidJsonRejected).every(Boolean), true);
    assert.equal(Object.values(schemaIntegrity.invalidEnumRejected).every(Boolean), true);

    const trace = repository.traceStory(story.id);
    assert.equal(trace.assignmentIds.includes(assignment.id), true);
    assert.equal(trace.assignmentIds.includes(nonStoryAssignmentCollision.id), false);

    const digestBefore = repository.databaseDigest();
    const audit = repository.rejectAuditMutationForProof();
    assert.equal(audit.updateRejected, true);
    assert.equal(audit.deleteRejected, true);
    assert.equal(audit.beforeDigest, audit.afterDigest);

    repository.close();
    const restarted = new AosSqliteRepository({ databasePath: join(root, "phase1.sqlite"), migrationsDir });
    restarted.applyMigrations();
    const hydrated = new AosStore(createDefaultSeed(), { persistence: restarted });
    assert.equal(restarted.databaseDigest(), digestBefore);
    const hydratedStory = hydrated.listStories().find((item) => item.id === story.id);
    assert.equal(Boolean(hydratedStory), true);
    assert.equal(hydratedStory.comments.some((item) => item.id === comment.id), true);
    assert.deepEqual(restarted.traceStory(story.id).assignmentIds, [assignment.id]);
    restarted.close();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
