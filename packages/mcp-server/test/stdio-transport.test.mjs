import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AosMcpTransport,
  createRuntimeTransport,
  transportMvpMethods
} from "../../../dist/packages/mcp-server/src/index.js";
import {
  AosSqliteRepository,
  assertRouteOwnedSqliteRoot
} from "../../../dist/packages/db/src/index.js";
import { AosStore, createDefaultSeed } from "../../../dist/packages/domain/src/index.js";
import { McpGateway } from "../../../dist/packages/mcp-gateway/src/index.js";

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

test("Phase 2 transport does not cache over-budget responses for replay bypass", async () => {
  const store = new AosStore(createDefaultSeed());
  const transport = new AosMcpTransport(store, { trustedActor: actor, maxResponseBytes: 1024 });
  store.appendAudit(actor, "phase2.large.audit", "proof", "budget", "accepted", {
    volume: "x".repeat(5000)
  });

  const first = transport.handleJsonRpc({ jsonrpc: "2.0", id: 1, method: "aos.audit.query", params: { action: "phase2.large.audit" } });
  const replay = transport.handleJsonRpc({ jsonrpc: "2.0", id: 2, method: "aos.audit.query", params: { action: "phase2.large.audit" } });

  assert.equal(first.result, undefined);
  assert.equal(first.error.data.reason, "transport_response_budget_exceeded");
  assert.equal(replay.result, undefined);
  assert.equal(replay.error.data.reason, "transport_response_budget_exceeded");
});

test("Phase 3 ticket list stdio method is read-only, cursor-bound, policy-visible, and budget-safe", () => {
  const store = new AosStore(createDefaultSeed());
  const { storyIds, assignmentId } = seedTicketListFixture(store);
  const transport = new AosMcpTransport(store, { trustedActor: actor, maxResponseBytes: 16_384 });

  const policy = transport.handleJsonRpc({ jsonrpc: "2.0", id: 1, method: "aos.policy.read", params: {} });
  assert.equal(policy.error, undefined);
  assert.equal(policy.result.transportAllowedMethods.includes("aos.ticket.list"), true);

  const firstPage = transport.handleJsonRpc({ jsonrpc: "2.0", id: 2, method: "aos.ticket.list", params: { limit: 1 } });
  assert.equal(firstPage.error, undefined);
  assert.equal(firstPage.result.ok, true);
  assert.equal(firstPage.result.method, "aos.ticket.list");
  assert.equal(firstPage.result.rowGrain, "story");
  assert.equal(firstPage.result.rows.length, 1);
  assert.equal(typeof firstPage.result.page.nextCursor, "string");
  assert.equal(JSON.stringify(firstPage.result).includes("phase3-forbidden-problem-value"), false);
  assert.equal(JSON.stringify(firstPage.result).includes("phase3-forbidden-run-readback-value"), false);

  const secondPage = transport.handleJsonRpc({
    jsonrpc: "2.0",
    id: 3,
    method: "aos.ticket.list",
    params: { limit: 1, cursor: firstPage.result.page.nextCursor }
  });
  assert.equal(secondPage.error, undefined);
  assert.equal(secondPage.result.rows.length, 1);
  assert.notEqual(secondPage.result.rows[0].storyId, firstPage.result.rows[0].storyId);

  const filterMismatch = transport.handleJsonRpc({
    jsonrpc: "2.0",
    id: 4,
    method: "aos.ticket.list",
    params: { limit: 1, status: "blocked", cursor: firstPage.result.page.nextCursor }
  });
  assert.equal(filterMismatch.error, undefined);
  assert.equal(filterMismatch.result.ok, false);
  assert.match(filterMismatch.result.error, /ticket_list_cursor_filter_mismatch/);

  const overMax = transport.handleJsonRpc({ jsonrpc: "2.0", id: 5, method: "aos.ticket.list", params: { limit: 21 } });
  assert.equal(overMax.error, undefined);
  assert.equal(overMax.result.ok, false);
  assert.match(overMax.result.error, /ticket_list_limit_exceeded/);

  const replayOne = transport.handleJsonRpc({
    jsonrpc: "2.0",
    id: 6,
    method: "aos.ticket.list",
    params: { storyId: storyIds[0], idempotencyKey: "phase3-ticket-list-replay" }
  });
  const replayTwo = transport.handleJsonRpc({
    jsonrpc: "2.0",
    id: 7,
    method: "aos.ticket.list",
    params: { storyId: storyIds[0], idempotencyKey: "phase3-ticket-list-replay" }
  });
  assert.equal(replayOne.error, undefined);
  assert.equal(replayTwo.result.status, "deduped");
  assert.equal(replayTwo.result.replayScope, "process_local_only");

  const negativeMethods = [
    ["aos.work_index.drill_through.read", "transport_method_outside_mvp_allowlist"],
    ["aos.work_index.any", "transport_method_outside_mvp_allowlist"],
    ["aos.resource.record.propose", "transport_method_outside_mvp_allowlist"],
    ["aos.knowledge.entry.propose", "transport_method_outside_mvp_allowlist"],
    ["aos.ticket.archive", "transport_method_unknown"],
    ["aos.unsupported.method", "transport_method_unknown"]
  ];
  for (const [method, reason] of negativeMethods) {
    const denied = transport.handleJsonRpc({ jsonrpc: "2.0", id: method, method, params: {} });
    assert.equal(denied.result, undefined, method);
    assert.equal(denied.error.data.reason, reason, method);
  }

  const budgetStore = new AosStore(createDefaultSeed());
  seedTicketListFixture(budgetStore, { storyTitleLength: 900, count: 4 });
  const budgetTransport = new AosMcpTransport(budgetStore, { trustedActor: actor, maxResponseBytes: 1024 });
  const budgetFirst = budgetTransport.handleJsonRpc({ jsonrpc: "2.0", id: 8, method: "aos.ticket.list", params: { limit: 4 } });
  const budgetReplay = budgetTransport.handleJsonRpc({ jsonrpc: "2.0", id: 9, method: "aos.ticket.list", params: { limit: 4 } });
  assert.equal(budgetFirst.result, undefined);
  assert.equal(budgetFirst.error.data.reason, "transport_response_budget_exceeded");
  assert.equal(budgetReplay.result, undefined);
  assert.equal(budgetReplay.error.data.reason, "transport_response_budget_exceeded");
  assert.equal(store.listAssignments().find((item) => item.id === assignmentId).targetType, "story");
});

function seedTicketListFixture(store, options = {}) {
  const count = options.count ?? 3;
  const titlePad = "x".repeat(options.storyTitleLength ?? 0);
  const initiative = store.createInitiative({
    projectId: "TCRN-AOS",
    title: "Phase 3 ticket list fixture",
    status: "in_progress",
    problem: "Ticket list needs persisted readback.",
    expectedOutcome: "Story-centric rows."
  }, actor);
  const epic = store.createEpic({
    initiativeId: initiative.id,
    title: "Ticket list epic",
    goal: "Read safe persisted story rows.",
    status: "in_progress"
  }, actor);
  const storyIds = [];
  let assignmentId = "";
  for (let index = 0; index < count; index += 1) {
    const story = store.createStory({
      epicId: epic.id,
      title: `Ticket list story ${index} ${titlePad}`,
      problem: `phase3-forbidden-problem-value-${index}`,
      user: `phase3-forbidden-user-value-${index}`,
      expectedBehavior: `phase3-forbidden-expected-value-${index}`,
      acceptanceCriteria: [`phase3-forbidden-acceptance-value-${index}`],
      status: index === 2 ? "blocked" : "in_progress",
      estimate: { effortPoints: 2, complexity: "medium", risk: "L3", verificationCost: "medium", confidence: "medium" },
      subTasks: [{
        id: `subtask-phase3-${index}`,
        title: `Ticket subtask ${index}`,
        ownerRole: "implementation",
        status: "in_progress",
        dependencyIds: [],
        proofExpectation: `phase3-forbidden-proof-expectation-value-${index}`
      }]
    }, actor);
    const assignment = store.createAssignment({
      employeeId: actor.employeeId,
      targetId: story.id,
      targetType: "story",
      role: "implementation",
      status: "in_progress",
      dueState: "none",
      proofExpectation: "phase3 ticket list stdio test"
    }, actor);
    if (index === 0) {
      assignmentId = assignment.id;
    }
    store.recordAgentRun({
      assignmentId: assignment.id,
      status: "success",
      startedAt: `2026-07-05T20:0${index}:00.000Z`,
      endedAt: `2026-07-05T20:0${index}:30.000Z`,
      readback: `phase3-forbidden-run-readback-value-${index}`,
      outputSummary: `phase3-forbidden-output-summary-value-${index}`
    }, actor);
    const evidence = store.linkEvidence({
      type: "artifact_id",
      target: `phase3-forbidden-evidence-target-${index}`,
      validity: "valid",
      producer: actor.employeeId,
      digest: `sha256:phase3-ticket-list-${index}`,
      redactionState: "metadata_only"
    }, actor);
    store.requestGate({
      type: "evidence_proof",
      linkedTicketId: story.id,
      inputEvidenceIds: [evidence.id]
    }, actor);
    storyIds.push(story.id);
  }
  return { storyIds, assignmentId };
}

test("Phase 2 runtime transport requires route-owned persisted DB and persisted actor rows", async () => {
  assert.throws(() => createRuntimeTransport({ actor }), /transport_runtime_database_path_required/);

  const root = await mkdtemp(join(tmpdir(), "tcrn-aos-phase2-runtime-empty-"));
  await writeFile(join(root, ".tcrn-aos-phase1-root"), "owned-by-phase2-runtime-test\n", "utf8");
  try {
    const repository = new AosSqliteRepository({ databasePath: join(root, "phase2-empty.sqlite"), migrationsDir });
    repository.applyMigrations();
    repository.close();
    const runtime = createRuntimeTransport({
      actor,
      databasePath: join(root, "phase2-empty.sqlite"),
      databaseRoot: root,
      repoRoot,
      migrationsDir
    });
    try {
      const policy = runtime.transport.handleJsonRpc({ jsonrpc: "2.0", id: 1, method: "aos.policy.read", params: {} });
      assert.equal(policy.result, undefined);
      assert.equal(policy.error.data.reason, "transport_actor_unknown");
    } finally {
      runtime.close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Phase 2 denied stdio transport requests persist metadata-only refusal audit details", () => {
  const rawValues = [
    "Bearer phase2-sensitive-authorization-value",
    "phase2-sensitive-auth-token",
    "phase2-sensitive-client-env-value",
    "phase2-sensitive-body-value",
    "phase2-sensitive-readback-value",
    "phase2-sensitive-output-summary-value",
    "phase2-sensitive-message-value",
    "phase2-sensitive-source-value",
    ["/", "Users", "phase2-sensitive-path-value"].join("/")
  ];
  const store = new AosStore(createDefaultSeed());
  const transport = new AosMcpTransport(store, { trustedActor: actor });
  const response = transport.handleJsonRpc({
    jsonrpc: "2.0",
    id: 1,
    method: "aos.ticket.comment",
    params: {
      authorization: rawValues[0],
      auth: { token: rawValues[1] },
      clientEnv: { HOME: rawValues[2] },
      ticketId: "story-phase2-sensitive-denial",
      type: "agent_observation",
      body: rawValues[3],
      readback: rawValues[4],
      outputSummary: rawValues[5],
      messages: [rawValues[6]],
      source: rawValues[7],
      path: rawValues[8]
    }
  });

  assert.equal(response.result, undefined);
  assert.equal(response.error.data.reason, "client_supplied_authority_denied");
  assertNoRawValues(response, rawValues);
  const refusal = store.queryAudit({ action: "mcp.transport.refusal" }).at(-1);
  assert.equal(refusal.details.paramSummary.rawValuesStored, false);
  assert.deepEqual(refusal.details.paramSummary.sensitiveKeys.sort(), [
    "auth",
    "authorization",
    "body",
    "clientEnv",
    "messages",
    "outputSummary",
    "path",
    "readback",
    "source"
  ].sort());
  assertNoRawValues(refusal.details, rawValues);
});

test("Phase 2 gateway blocked requests persist metadata-only blocked audit details", () => {
  const rawValues = [
    "phase2-sensitive-blocked-body-value",
    "phase2-sensitive-blocked-readback-value",
    "phase2-sensitive-blocked-source-value",
    ["/", "Users", "phase2-sensitive-blocked-path-value"].join("/")
  ];
  const store = new AosStore(createDefaultSeed());
  const gateway = new McpGateway(store);
  const response = gateway.handle({
    method: "aos.ticket.comment",
    actor,
    params: {
      type: "agent_observation",
      body: rawValues[0],
      readback: rawValues[1],
      source: rawValues[2],
      path: rawValues[3]
    },
    idempotencyKey: "phase2-sensitive-gateway-blocked"
  });

  assert.equal(response.ok, false);
  assert.equal(response.status, "blocked");
  assertNoRawValues(response, rawValues);
  const blocked = store.queryAudit({ action: "mcp.blocked" }).at(-1);
  assert.equal(blocked.details.paramSummary.rawValuesStored, false);
  assert.deepEqual(blocked.details.paramSummary.sensitiveKeys.sort(), [
    "body",
    "path",
    "readback",
    "source"
  ].sort());
  assertNoRawValues(blocked.details, rawValues);
});

function assertNoRawValues(value, rawValues) {
  const text = JSON.stringify(value);
  for (const raw of rawValues) {
    assert.equal(text.includes(raw), false, `raw sensitive value leaked: ${raw}`);
  }
}
