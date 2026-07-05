import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AosMcpTransport,
  transportMvpMethods
} from "../../../dist/packages/mcp-server/src/index.js";
import {
  AosSqliteRepository,
  assertRouteOwnedSqliteRoot
} from "../../../dist/packages/db/src/index.js";
import { AosStore, createDefaultSeed } from "../../../dist/packages/domain/src/index.js";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const migrationsDir = fileURLToPath(new URL("../../db/migrations/sqlite", import.meta.url));
const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "phase2-mcp-server-test"
};

test("Phase 2 stdio transport filters methods, refuses client authority, persists AgentRun, and paginates audit", async () => {
  const root = await mkdtemp(join(tmpdir(), "tcrn-aos-phase2-mcp-test-"));
  await writeFile(join(root, ".tcrn-aos-phase1-root"), "owned-by-phase2-mcp-test\n", "utf8");
  try {
    assert.equal(assertRouteOwnedSqliteRoot(root, repoRoot).ok, true);
    const repository = new AosSqliteRepository({ databasePath: join(root, "phase2.sqlite"), migrationsDir });
    repository.applyMigrations();
    repository.seedAiEmployees(createDefaultSeed().employees, "phase2-test-seed");
    const store = new AosStore(createDefaultSeed(), { persistence: repository });
    for (const project of createDefaultSeed().projects) {
      store.upsertProject(project, actor);
    }
    const initiative = store.createInitiative({
      projectId: "TCRN-AOS",
      title: "Phase 2 test initiative",
      status: "in_progress",
      problem: "MCP transport needs bounded proof.",
      expectedOutcome: "Transport writes through store boundaries."
    }, actor);
    const epic = store.createEpic({
      initiativeId: initiative.id,
      title: "MCP stdio",
      goal: "Use thin transport around gateway.",
      status: "in_progress"
    }, actor);
    const story = store.createStory({
      epicId: epic.id,
      title: "Transport persisted run",
      problem: "Run summaries must persist.",
      user: "AI operator",
      expectedBehavior: "AgentRun row survives restart.",
      acceptanceCriteria: ["stdio", "persistence", "audit"],
      status: "in_progress",
      estimate: { effortPoints: 3, complexity: "medium", risk: "L3", verificationCost: "medium", confidence: "medium" },
      subTasks: []
    }, actor);
    const assignment = store.createAssignment({
      employeeId: actor.employeeId,
      targetId: story.id,
      targetType: "story",
      role: "implementation",
      status: "in_progress",
      dueState: "none",
      proofExpectation: "phase2 mcp transport test"
    }, actor);
    const transport = new AosMcpTransport(store, { trustedActor: actor, auditPageLimit: 2 });

    const policy = transport.handleJsonRpc({ jsonrpc: "2.0", id: 1, method: "aos.policy.read", params: {} });
    assert.equal(policy.error, undefined);
    assert.deepEqual(policy.result.transportAllowedMethods, transportMvpMethods);
    assert.equal(policy.result.fullGatewayMethodListExposed, false);

    const forbiddenSlice = transport.handleJsonRpc({ jsonrpc: "2.0", id: 2, method: "aos.resource.record.propose", params: {} });
    assert.equal(forbiddenSlice.result, undefined);
    assert.equal(forbiddenSlice.error.data.reason, "transport_method_outside_mvp_allowlist");

    const clientActor = transport.handleJsonRpc({
      jsonrpc: "2.0",
      id: 3,
      method: "aos.ticket.comment",
      params: {
        actor,
        ticketId: story.id,
        type: "agent_observation",
        body: "client actor spoof"
      }
    });
    assert.equal(clientActor.result, undefined);
    assert.equal(clientActor.error.data.reason, "client_supplied_authority_denied");

    const run = transport.handleJsonRpc({
      jsonrpc: "2.0",
      id: 4,
      method: "aos.run.summary.create",
      params: {
        assignmentId: assignment.id,
        status: "success",
        startedAt: "2026-07-05T00:00:00.000Z",
        endedAt: "2026-07-05T00:01:00.000Z",
        readback: "metadata-only run readback",
        outputSummary: "Transport run summary",
        idempotencyKey: "phase2-test-run"
      }
    });
    assert.equal(run.error, undefined);
    assert.equal(run.result.ok, true);
    assert.equal(run.result.result.assignmentId, assignment.id);
    assert.equal(store.listRuns().length, 1);
    assert.equal(store.listAssignments().find((item) => item.id === assignment.id).runIds.includes(run.result.result.id), true);

    const replay = transport.handleJsonRpc({
      jsonrpc: "2.0",
      id: 5,
      method: "aos.run.summary.create",
      params: {
        assignmentId: assignment.id,
        status: "success",
        startedAt: "2026-07-05T00:00:00.000Z",
        endedAt: "2026-07-05T00:01:00.000Z",
        readback: "metadata-only run readback",
        outputSummary: "Transport run summary",
        idempotencyKey: "phase2-test-run"
      }
    });
    assert.equal(replay.result.status, "deduped");
    assert.equal(store.listRuns().length, 1);

    const audit = transport.handleJsonRpc({ jsonrpc: "2.0", id: 6, method: "aos.audit.query", params: { limit: 2 } });
    assert.equal(audit.error, undefined);
    assert.equal(audit.result.limit, 2);
    assert.equal(audit.result.returnedCount, 2);
    assert.equal(audit.result.hasMore, true);
    assert.equal(typeof audit.result.nextCursor, "string");

    repository.close();
    const restartedRepository = new AosSqliteRepository({ databasePath: join(root, "phase2.sqlite"), migrationsDir });
    restartedRepository.applyMigrations();
    const restartedStore = new AosStore(createDefaultSeed(), { persistence: restartedRepository });
    assert.equal(restartedStore.listRuns().some((item) => item.id === run.result.result.id), true);
    assert.equal(restartedStore.listAssignments().find((item) => item.id === assignment.id).runIds.includes(run.result.result.id), true);
    restartedRepository.close();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
