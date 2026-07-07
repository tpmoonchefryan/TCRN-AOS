import test from "node:test";
import assert from "node:assert/strict";
import { AosStore, createDefaultSeed } from "../../../dist/packages/domain/src/index.js";
import { createAppliedRuntimeFixture } from "../../../dist/packages/db/src/index.js";
import { McpGateway, allowedMcpMethods } from "../../../dist/packages/mcp-gateway/src/index.js";

const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "gateway-test"
};

const estimate = {
  effortPoints: 5,
  complexity: "high",
  risk: "L3",
  verificationCost: "high",
  confidence: "medium"
};

function gatewayFixture() {
  const store = new AosStore(createDefaultSeed());
  const gateway = new McpGateway(store);
  return { store, gateway };
}

test("gateway exposes only the accepted local MCP method families", () => {
  assert.deepEqual([...allowedMcpMethods].sort(), [
    "aos.assignment.claim",
    "aos.assignment.update",
    "aos.audit.query",
    "aos.conference.position.record",
    "aos.conference.minutes.record",
    "aos.conference.request",
    "aos.dependency.detection.record",
    "aos.dependency.governance.read",
    "aos.dependency.record.propose",
    "aos.docs.readiness.record",
    "aos.docs.search.index",
    "aos.documentation.index.read",
    "aos.evidence.link",
    "aos.gate.decision.record",
    "aos.gate.request",
    "aos.github.metadata.record",
    "aos.guide.page.draft",
    "aos.knowledge.entry.propose",
    "aos.policy.read",
    "aos.pr_ci.story_readiness.record",
    "aos.release_candidate.linkage.read",
    "aos.release_candidate.linkage.record",
    "aos.release_note.item.draft",
    "aos.resource.audit_finding.record",
    "aos.resource.cleanup_readback.record",
    "aos.resource.governance.read",
    "aos.resource.manifest.record",
    "aos.resource.materialization_control.read",
    "aos.resource.materialization_history.record",
    "aos.resource.materialization.request",
    "aos.resource.record.propose",
    "aos.resource.replacement.request",
    "aos.resource.retirement.record",
    "aos.resource.rollback.request",
    "aos.resource.rollback_plan.record",
    "aos.resource.update.request",
    "aos.run.summary.create",
    "aos.stage_map.read",
    "aos.ticket.comment",
    "aos.ticket.list",
    "aos.ticket.propose",
    "aos.work_index.drill_through.read"
  ].sort());
});

test("ticket proposal, idempotency, dedupe, comments, evidence, and audit work together", () => {
  const { gateway } = gatewayFixture();
  const initiative = gateway.handle({
    method: "aos.ticket.propose",
    actor,
    params: {
      ticketType: "initiative",
      projectId: "TCRN-AOS",
      title: "Operational Spine",
      problem: "No governed AOS operational state exists.",
      expectedOutcome: "Model-first records and gateway contracts exist."
    },
    idempotencyKey: "ticket-init-1"
  });
  const duplicate = gateway.handle({
    method: "aos.ticket.propose",
    actor,
    params: {
      ticketType: "initiative",
      projectId: "TCRN-AOS",
      title: "Operational Spine",
      problem: "No governed AOS operational state exists.",
      expectedOutcome: "Model-first records and gateway contracts exist."
    },
    idempotencyKey: "ticket-init-1"
  });
  assert.equal(initiative.ok, true);
  assert.equal(duplicate.status, "deduped");

  const epic = gateway.handle({
    method: "aos.ticket.propose",
    actor,
    params: {
      ticketType: "epic",
      initiativeId: initiative.result.id,
      title: "Governed writes",
      goal: "MCP Gateway accepts only safe writes."
    }
  });
  const story = gateway.handle({
    method: "aos.ticket.propose",
    actor,
    params: {
      ticketType: "story",
      epicId: epic.result.id,
      title: "Gateway contract",
      problem: "Agent writes need validation.",
      user: "AI employee",
      expectedBehavior: "Safe writes are audited.",
      acceptanceCriteria: ["authz", "dedupe", "audit"],
      estimate,
      subTasks: []
    }
  });
  const comment = gateway.handle({
    method: "aos.ticket.comment",
    actor,
    params: {
      ticketId: story.result.id,
      type: "agent_observation",
      body: "Gateway test comment"
    }
  });
  const evidence = gateway.handle({
    method: "aos.evidence.link",
    actor,
    params: {
      type: "artifact_id",
      target: "gateway-proof",
      digest: "sha256:123",
      redactionState: "metadata_only"
    }
  });
  const audit = gateway.handle({
    method: "aos.audit.query",
    actor,
    params: {
      targetId: story.result.id
    }
  });

  assert.equal(story.ok, true);
  assert.equal(comment.ok, true);
  assert.equal(evidence.ok, true);
  assert.equal(audit.status, "read");
  assert.ok(audit.result.length >= 1);
});

test("aos.ticket.list returns story-centric safe rows with opaque cursors", () => {
  const { store, gateway } = gatewayFixture();
  const initiative = gateway.handle({
    method: "aos.ticket.propose",
    actor,
    params: {
      ticketType: "initiative",
      projectId: "TCRN-AOS",
      title: "Phase 3 Ticket List",
      problem: "Dogfood needs persisted story-centric readback.",
      expectedOutcome: "Safe ticket-list rows are available."
    }
  });
  const epic = gateway.handle({
    method: "aos.ticket.propose",
    actor,
    params: {
      ticketType: "epic",
      initiativeId: initiative.result.id,
      title: "Ticket list readback",
      goal: "Expose safe story metadata only."
    }
  });
  const story = gateway.handle({
    method: "aos.ticket.propose",
    actor,
    params: {
      ticketType: "story",
      epicId: epic.result.id,
      title: "List story safely",
      problem: "phase3-forbidden-problem-value",
      user: "phase3-forbidden-user-value",
      expectedBehavior: "phase3-forbidden-expected-behavior-value",
      acceptanceCriteria: ["phase3-forbidden-acceptance-value"],
      estimate,
      subTasks: [{
        id: "subtask-phase3-safe",
        title: "Safe row metadata",
        ownerRole: "implementation",
        status: "in_progress",
        dependencyIds: [],
        proofExpectation: "phase3-forbidden-proof-expectation-value"
      }]
    }
  });
  const assignment = store.createAssignment({
    employeeId: actor.employeeId,
    targetId: story.result.id,
    targetType: "story",
    role: "implementation",
    status: "in_progress",
    dueState: "none",
    proofExpectation: "phase3 ticket list test"
  }, actor);
  store.recordAgentRun({
    assignmentId: assignment.id,
    status: "success",
    startedAt: "2026-07-05T20:00:00.000Z",
    endedAt: "2026-07-05T20:01:00.000Z",
    readback: "phase3-forbidden-run-readback-value",
    outputSummary: "phase3-forbidden-output-summary-value"
  }, actor);
  const evidence = gateway.handle({
    method: "aos.evidence.link",
    actor,
    params: {
      type: "artifact_id",
      target: "phase3-forbidden-evidence-target-value",
      digest: "sha256:phase3-ticket-list",
      redactionState: "metadata_only"
    }
  });
  gateway.handle({
    method: "aos.gate.request",
    actor,
    params: {
      type: "evidence_proof",
      linkedTicketId: story.result.id,
      inputEvidenceIds: [evidence.result.id]
    }
  });

  const page = gateway.handle({
    method: "aos.ticket.list",
    actor,
    params: { storyId: story.result.id, limit: 1 }
  });
  assert.equal(page.ok, true);
  assert.equal(page.status, "read");
  assert.equal(page.result.method, "aos.ticket.list");
  assert.equal(page.result.schemaVersion, "aos.ticket.list.v1");
  assert.equal(page.result.rowGrain, "story");
  assert.equal(page.result.rows.length, 1);
  const row = page.result.rows[0];
  assert.equal(row.storyId, story.result.id);
  assert.equal(row.storyTitle, "List story safely");
  assert.deepEqual(row.assignmentIds, [assignment.id]);
  assert.deepEqual(row.assigneeEmployeeIds, [actor.employeeId]);
  assert.equal(row.runReferences[0].status, "success");
  assert.equal(row.latestGate.type, "evidence_proof");
  assert.equal(row.latestEvidence.digest, "sha256:phase3-ticket-list");
  assert.equal(row.latestAudit.action.length > 0, true);
  const responseText = JSON.stringify(page.result);
  for (const forbidden of [
    "phase3-forbidden-problem-value",
    "phase3-forbidden-user-value",
    "phase3-forbidden-expected-behavior-value",
    "phase3-forbidden-acceptance-value",
    "phase3-forbidden-proof-expectation-value",
    "phase3-forbidden-run-readback-value",
    "phase3-forbidden-output-summary-value",
    "phase3-forbidden-evidence-target-value"
  ]) {
    assert.equal(responseText.includes(forbidden), false, forbidden);
  }

  const unsupported = gateway.handle({
    method: "aos.ticket.list",
    actor,
    params: { updatedSince: "2026-07-05T00:00:00.000Z" }
  });
  assert.equal(unsupported.ok, false);
  assert.match(unsupported.error, /unsupported_ticket_list_filter/);
});

test("authz, role-thread binding, owner intent separation, and restricted payload rejection fail closed", () => {
  const { gateway } = gatewayFixture();
  const wrongThread = gateway.handle({
    method: "aos.policy.read",
    actor: { ...actor, threadId: "wrong-thread" },
    params: {}
  });
  assert.equal(wrongThread.ok, false);
  assert.match(wrongThread.error, /Thread binding/);

  const localPath = "/" + "Users/example/.ssh/id_rsa";
  const restricted = gateway.handle({
    method: "aos.evidence.link",
    actor,
    params: {
      type: "local_path_reference",
      target: localPath,
      redactionState: "restricted"
    }
  });
  assert.equal(restricted.ok, false);
  assert.match(restricted.error, /restricted machine_local_absolute_path/);

  const initiative = gateway.handle({
    method: "aos.ticket.propose",
    actor,
    params: {
      ticketType: "initiative",
      projectId: "TCRN-AOS",
      title: "Owner gate",
      problem: "Remote action requires owner intent.",
      expectedOutcome: "Pending gate only."
    }
  });
  const epic = gateway.handle({
    method: "aos.ticket.propose",
    actor,
    params: {
      ticketType: "epic",
      initiativeId: initiative.result.id,
      title: "Release",
      goal: "Owner-gated release posture."
    }
  });
  const story = gateway.handle({
    method: "aos.ticket.propose",
    actor,
    params: {
      ticketType: "story",
      epicId: epic.result.id,
      title: "Do not publish",
      problem: "Publication must be owner-gated.",
      user: "release agent",
      expectedBehavior: "Gateway creates owner-intent gate.",
      acceptanceCriteria: ["no automatic operation"],
      estimate,
      subTasks: []
    }
  });
  const gate = gateway.handle({
    method: "aos.gate.request",
    actor,
    params: {
      type: "release_closeout",
      requestedAction: "remote_publication",
      linkedTicketId: story.result.id,
      inputEvidenceIds: []
    }
  });
  assert.equal(gate.ok, true);
  assert.equal(gate.result.type, "owner_intent");
  assert.equal(gate.result.status, "owner_intent_required");
});

test("runtime-backed gateway enforces project scope, read/write split, and records read audit", async () => {
  const fixture = await createAppliedRuntimeFixture();
  try {
    const store = fixture.getStore();
    const gateway = new McpGateway(store);
    const policy = gateway.handle({ method: "aos.policy.read", actor, params: {} });
    assert.equal(policy.ok, true);
    assert.equal(policy.status, "read");
    assert.equal(policy.result.actorAuthoritySnapshot.canWrite, true);
    assert.equal(policy.result.liveDispatchAuthorized, false);

    const unknownProject = gateway.handle({
      method: "aos.ticket.propose",
      actor,
      params: {
        ticketType: "initiative",
        projectId: "UNKNOWN",
        title: "Unknown project",
        problem: "Project scope must exist.",
        expectedOutcome: "Blocked."
      }
    });
    assert.equal(unknownProject.ok, false);
    assert.match(unknownProject.error, /Unknown project scope/);

    const observerSeed = createDefaultSeed();
    observerSeed.employees.push({
      id: "employee-observer",
      name: "Observer",
      role: "owner_observer",
      authoritySummary: "Read-only proof identity.",
      contactWhen: "Observation only.",
      lifecycle: "active",
      threadIdentity: {
        threadId: "observer-thread",
        status: "active",
        lifecycle: "ephemeral"
      },
      roleContractRefs: ["owner-observer"],
      skillRefs: []
    });
    const observerGateway = new McpGateway(new AosStore(observerSeed));
    const readOnlyActor = {
      employeeId: "employee-observer",
      role: "owner_observer",
      threadId: "observer-thread",
      sessionId: "gateway-test"
    };
    const readAllowed = observerGateway.handle({ method: "aos.policy.read", actor: readOnlyActor, params: {} });
    const writeBlocked = observerGateway.handle({
      method: "aos.ticket.propose",
      actor: readOnlyActor,
      params: {
        ticketType: "initiative",
        projectId: "TCRN-AOS",
        title: "Blocked write",
        problem: "Observers cannot write.",
        expectedOutcome: "Blocked."
      }
    });
    assert.equal(readAllowed.ok, true);
    assert.equal(readAllowed.result.actorAuthoritySnapshot.canWrite, false);
    assert.equal(writeBlocked.ok, false);
    assert.match(writeBlocked.error, /cannot write/);
    assert.ok(store.queryAudit({ action: "mcp.aos.policy.read" }).length >= 1);
  } finally {
    await fixture.reset();
  }
});

test("gateway rejects restricted content classes before runtime storage", () => {
  const { store, gateway } = gatewayFixture();
  const unsafeBodies = [
    ["raw_source", "diff --" + "git a/file b/file"],
    ["secret", "AKIA" + "1234567890ABCDEF"],
    ["private_key", "BEGIN " + "PRIVATE " + "KEY"],
    ["shell_history", "export " + "API_SECRET=value"],
    ["browser_or_keychain", "Key" + "chain"],
    ["raw_secret_scan_output", "git" + "leaks " + "finding " + "secret detector"],
    ["private_evidence_payload", "private " + "evidence payload"],
    ["machine_local_absolute_path", "/" + "Users/example/private.txt"]
  ];

  for (const [kind, body] of unsafeBodies) {
    const blocked = gateway.handle({
      method: "aos.evidence.link",
      actor,
      params: {
        type: "artifact_id",
        target: body,
        redactionState: "restricted"
      }
    });
    assert.equal(blocked.ok, false, kind);
    assert.match(blocked.error, new RegExp(kind), kind);
  }
  assert.equal(store.queryAudit({ action: "mcp.blocked" }).length, unsafeBodies.length);
});
