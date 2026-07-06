import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
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
const secondImplementationActor = {
  employeeId: "employee-phase3-second-impl",
  role: "implementation",
  threadId: "phase3-second-implementation-thread",
  sessionId: "phase3-work-loop-method-test"
};
const sableActor = {
  employeeId: "employee-sable",
  role: "security",
  threadId: "sable-thread",
  sessionId: "phase3-work-loop-method-test"
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

test("Phase 3 work-loop stdio methods claim assignments, update assignee state, record gate decisions, and reject aliases", () => {
  const seed = createDefaultSeed();
  const store = new AosStore({
    ...seed,
    employees: [
      ...seed.employees,
      {
        id: secondImplementationActor.employeeId,
        name: "Second Implementation Fixture",
        role: "implementation",
        authoritySummary: "Fixture employee for same-role claim conflict proof.",
        contactWhen: "Phase 3 proof only.",
        lifecycle: "active",
        threadIdentity: {
          threadId: secondImplementationActor.threadId,
          status: "active",
          lifecycle: "ephemeral"
        },
        roleContractRefs: ["phase3-work-loop-fixture"],
        skillRefs: []
      }
    ]
  });
  const fixture = seedWorkLoopFixture(store);
  const transport = new AosMcpTransport(store, { trustedActor: actor, maxResponseBytes: 16_384 });
  const secondTransport = new AosMcpTransport(store, { trustedActor: secondImplementationActor, maxResponseBytes: 16_384 });
  const sableTransport = new AosMcpTransport(store, { trustedActor: sableActor, maxResponseBytes: 16_384 });

  const policy = transport.handleJsonRpc({ jsonrpc: "2.0", id: 1, method: "aos.policy.read", params: {} });
  assert.equal(policy.error, undefined);
  assert.equal(policy.result.transportAllowedMethods.includes("aos.assignment.claim"), true);
  assert.equal(policy.result.transportAllowedMethods.includes("aos.assignment.update"), true);
  assert.equal(policy.result.transportAllowedMethods.includes("aos.gate.decision.record"), true);
  assert.equal(policy.result.fullGatewayMethodListExposed, false);

  const claim = transport.handleJsonRpc({
    jsonrpc: "2.0",
    id: 2,
    method: "aos.assignment.claim",
    params: {
      targetType: "story",
      targetId: fixture.story.id,
      initiativeId: fixture.initiative.id,
      epicId: fixture.epic.id,
      idempotencyKey: "phase3-claim-first"
    }
  });
  assert.equal(claim.error, undefined);
  assert.equal(claim.result.ok, true);
  assert.equal(claim.result.result.assignment.status, "accepted");
  assert.equal(claim.result.result.assignment.targetType, "story");

  const stateReplay = transport.handleJsonRpc({
    jsonrpc: "2.0",
    id: 3,
    method: "aos.assignment.claim",
    params: {
      targetType: "story",
      targetId: fixture.story.id,
      initiativeId: fixture.initiative.id,
      epicId: fixture.epic.id,
      idempotencyKey: "phase3-claim-state-replay"
    }
  });
  assert.equal(stateReplay.result.ok, true);
  assert.equal(stateReplay.result.result.replayedByState, true);
  assert.equal(stateReplay.result.result.assignment.id, claim.result.result.assignment.id);

  const secondActorConflict = secondTransport.handleJsonRpc({
    jsonrpc: "2.0",
    id: 4,
    method: "aos.assignment.claim",
    params: {
      targetType: "story",
      targetId: fixture.story.id,
      initiativeId: fixture.initiative.id,
      epicId: fixture.epic.id
    }
  });
  assert.equal(secondActorConflict.result.ok, false);
  assert.match(secondActorConflict.result.error, /already_claimed/);

  const update = transport.handleJsonRpc({
    jsonrpc: "2.0",
    id: 5,
    method: "aos.assignment.update",
    params: {
      assignmentId: claim.result.result.assignment.id,
      priorStatus: "accepted",
      status: "in_progress",
      initiativeId: fixture.initiative.id,
      epicId: fixture.epic.id
    }
  });
  assert.equal(update.result.ok, true);
  assert.equal(update.result.result.assignment.status, "in_progress");

  const staleUpdate = transport.handleJsonRpc({
    jsonrpc: "2.0",
    id: 6,
    method: "aos.assignment.update",
    params: {
      assignmentId: claim.result.result.assignment.id,
      priorStatus: "accepted",
      status: "blocked",
      initiativeId: fixture.initiative.id,
      epicId: fixture.epic.id
    }
  });
  assert.equal(staleUpdate.result.ok, false);
  assert.match(staleUpdate.result.error, /assignment_update_stale_status/);

  const roleMismatchDecision = transport.handleJsonRpc({
    jsonrpc: "2.0",
    id: 7,
    method: "aos.gate.decision.record",
    params: {
      gateId: fixture.gate.id,
      priorStatus: "pending_role",
      decision: "accepted",
      initiativeId: fixture.initiative.id,
      epicId: fixture.epic.id,
      evidenceIds: [fixture.evidence.id]
    }
  });
  assert.equal(roleMismatchDecision.result.ok, false);
  assert.match(roleMismatchDecision.result.error, /gate_decision_role_mismatch/);

  const gateDecision = sableTransport.handleJsonRpc({
    jsonrpc: "2.0",
    id: 8,
    method: "aos.gate.decision.record",
    params: {
      gateId: fixture.gate.id,
      priorStatus: "pending_role",
      decision: "accepted",
      initiativeId: fixture.initiative.id,
      epicId: fixture.epic.id,
      evidenceIds: [fixture.evidence.id]
    }
  });
  assert.equal(gateDecision.result.ok, true);
  assert.equal(gateDecision.result.result.gate.status, "accepted");
  assert.equal(JSON.stringify(gateDecision.result).includes("phase3-work-loop-forbidden-evidence-target"), false);

  const negativeMethods = [
    "aos.gate.status.update",
    "aos.assignment.create",
    "aos.assignment.write",
    "aos.gate.write",
    "aos.work_index.drill_through.read",
    "aos.resource.record.propose",
    "aos.knowledge.entry.propose",
    "aos.unknown.method"
  ];
  for (const method of negativeMethods) {
    const denied = transport.handleJsonRpc({ jsonrpc: "2.0", id: method, method, params: {} });
    assert.equal(denied.result, undefined, method);
    assert.notEqual(denied.error, undefined, method);
  }

  const text = JSON.stringify({ claim, update, gateDecision });
  assert.equal(text.includes("proofExpectation"), false);
  assert.equal(text.includes("record_json"), false);
  assert.equal(text.includes("phase3-work-loop-forbidden"), false);
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

function seedWorkLoopFixture(store) {
  const initiative = store.createInitiative({
    projectId: "TCRN-AOS",
    title: "AOS human readback v1",
    status: "in_progress",
    problem: "Participating MCP-thread work loop needs selected methods.",
    expectedOutcome: "Assignment claim/update and decision-first gate recording."
  }, actor);
  const epic = store.createEpic({
    initiativeId: initiative.id,
    title: "Phase 3 selected work-loop methods",
    goal: "Prove bounded write methods.",
    status: "in_progress"
  }, actor);
  const story = store.createStory({
    epicId: epic.id,
    title: "Selected method scope story",
    problem: "phase3-work-loop-forbidden-problem",
    user: "phase3-work-loop-forbidden-user",
    expectedBehavior: "phase3-work-loop-forbidden-expected",
    acceptanceCriteria: ["phase3-work-loop-forbidden-criteria"],
    status: "in_progress",
    estimate: { effortPoints: 2, complexity: "medium", risk: "L3", verificationCost: "medium", confidence: "medium" },
    subTasks: []
  }, actor);
  const evidence = store.linkEvidence({
    type: "artifact_id",
    target: "phase3-work-loop-forbidden-evidence-target",
    validity: "valid",
    producer: sableActor.employeeId,
    digest: "sha256:phase3-work-loop-evidence",
    redactionState: "metadata_only"
  }, sableActor);
  const gate = store.requestGate({
    type: "security_license",
    linkedTicketId: story.id,
    inputEvidenceIds: [evidence.id]
  }, sableActor);
  return { initiative, epic, story, evidence, gate };
}

test("Phase 2 runtime transport requires route-owned persisted DB and persisted actor rows", async () => {
  assert.throws(() => createRuntimeTransport({ actor }), /transport_runtime_database_path_required/);

  const safeTmp = await realpath(tmpdir());
  const root = await mkdtemp(join(safeTmp, "tcrn-aos-phase2-runtime-empty-"));
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

test("Phase 2 runtime transport rejects DB file symlinks and symlink ancestors before SQLite opens", async () => {
  const markerFile = ".tcrn-aos-phase1-root";
  const safeTmp = await realpath(tmpdir());
  const dbSymlinkRoot = await mkdtemp(join(safeTmp, "tcrn-aos-phase2-runtime-db-symlink-"));
  const outsideRoot = await mkdtemp(join(safeTmp, "tcrn-aos-phase2-runtime-outside-"));
  await writeFile(join(dbSymlinkRoot, markerFile), "owned-by-phase2-runtime-symlink-test\n", "utf8");
  await writeFile(join(outsideRoot, "outside.sqlite"), "", "utf8");
  await symlink(join(outsideRoot, "outside.sqlite"), join(dbSymlinkRoot, "phase2.sqlite"));
  try {
    assert.throws(() => createRuntimeTransport({
      actor,
      databasePath: join(dbSymlinkRoot, "phase2.sqlite"),
      databaseRoot: dbSymlinkRoot,
      repoRoot,
      migrationsDir
    }), /transport_runtime_database_file_symlink_denied/);
  } finally {
    await rm(dbSymlinkRoot, { recursive: true, force: true });
    await rm(outsideRoot, { recursive: true, force: true });
  }

  const ancestorParent = await mkdtemp(join(safeTmp, "tcrn-aos-phase2-runtime-ancestor-"));
  const realParent = join(ancestorParent, "real-parent");
  const linkedParent = join(ancestorParent, "linked-parent");
  const linkedRouteRoot = join(linkedParent, "route-root");
  await mkdir(realParent, { recursive: true });
  await symlink(realParent, linkedParent, "dir");
  await mkdir(linkedRouteRoot, { recursive: true });
  await writeFile(join(linkedRouteRoot, markerFile), "owned-by-phase2-runtime-symlink-test\n", "utf8");
  try {
    assert.throws(() => createRuntimeTransport({
      actor,
      databasePath: join(linkedRouteRoot, "phase2.sqlite"),
      databaseRoot: linkedRouteRoot,
      repoRoot,
      migrationsDir
    }), /transport_runtime_database_root_symlink_ancestor_denied/);
  } finally {
    await rm(ancestorParent, { recursive: true, force: true });
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
