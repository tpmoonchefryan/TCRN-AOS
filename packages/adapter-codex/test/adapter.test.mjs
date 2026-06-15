import test from "node:test";
import assert from "node:assert/strict";
import { AosStore, createDefaultSeed } from "../../../dist/packages/domain/src/index.js";
import { CodexIntegrationAdapter } from "../../../dist/packages/adapter-codex/src/index.js";

const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "adapter-test"
};

test("Codex adapter creates dry-run dispatches and refuses live send", () => {
  const store = new AosStore(createDefaultSeed());
  const adapter = new CodexIntegrationAdapter(store);
  const payload = {
    kind: "gate_request",
    targetEmployeeId: "employee-sable",
    linkedTicketIds: ["story-security"],
    linkedGateId: "gate-security",
    subject: "Review AOS Slice 1 security posture",
    body: "Please review the metadata-only proof package.",
    expectedReturnFormat: "status, findings, blockers, next_owner"
  };
  const dispatch = adapter.createDryRunDispatch(payload, actor);
  const duplicate = adapter.createDryRunDispatch(payload, actor);
  const readback = adapter.readback(dispatch.id, actor);

  assert.equal(dispatch.status, "dry_run_ready");
  assert.equal(dispatch.targetThreadId, "sable-thread");
  assert.equal(duplicate.id, dispatch.id);
  assert.equal(readback.acceptanceInferred, false);
  assert.equal(readback.targetEmployeeId, "employee-sable");
  assert.throws(() => adapter.sendLive(), /not authorized/);
});

test("Codex adapter parses returns and records retry/dedupe policy without live transport", () => {
  const store = new AosStore(createDefaultSeed());
  const adapter = new CodexIntegrationAdapter(store, { maxAttempts: 1, backoffSeconds: [1] });
  const dispatch = adapter.createDryRunDispatch({
    kind: "assignment",
    targetEmployeeId: "employee-ilya",
    linkedTicketIds: ["story-implementation"],
    subject: "Implement local slice",
    body: "Local-only dry run.",
    expectedReturnFormat: "xml-like status block"
  }, actor);
  const parsed = adapter.collectReturn(dispatch.id, "<status>blocked</status><summary>Need review</summary><blocker>policy</blocker><next_owner>Arturo</next_owner>", actor);
  const retry = adapter.markRetry(dispatch.id, actor);
  assert.equal(retry.status, "retrying");
  const expired = adapter.markRetry(dispatch.id, actor);

  assert.equal(parsed.status, "blocked");
  assert.deepEqual(parsed.blockers, ["policy"]);
  assert.equal(expired.status, "expired");
});

test("Codex adapter rejects restricted payloads before outbox storage", () => {
  const store = new AosStore(createDefaultSeed());
  const adapter = new CodexIntegrationAdapter(store);
  const privateEvidence = "private " + "evidence payload";
  assert.throws(() => adapter.createDryRunDispatch({
    kind: "conference_invite",
    targetEmployeeId: "employee-sable",
    linkedTicketIds: ["story-risk"],
    subject: "Unsafe payload",
    body: privateEvidence,
    expectedReturnFormat: "status"
  }, actor), /restricted private_evidence_payload/);
});

test("Codex adapter dry-run outbox updates assignment, gate, and conference records from returns", () => {
  const store = new AosStore(createDefaultSeed());
  const adapter = new CodexIntegrationAdapter(store);
  const { assignment, gate, conference } = createLinkedOperationalRecords(store);

  const assignmentDispatch = adapter.createDryRunDispatch({
    kind: "assignment",
    targetEmployeeId: "employee-ilya",
    linkedTicketIds: [assignment.targetId],
    linkedAssignmentId: assignment.id,
    subject: "Implement local assignment",
    body: "Dry-run assignment payload.",
    expectedReturnFormat: "status summary blockers next_owner"
  }, actor);
  const gateDispatch = adapter.createDryRunDispatch({
    kind: "gate_request",
    targetEmployeeId: "employee-sable",
    linkedTicketIds: [assignment.targetId],
    linkedGateId: gate.id,
    subject: "Review security gate",
    body: "Dry-run gate payload.",
    expectedReturnFormat: "status summary blockers next_owner"
  }, actor);
  const conferenceDispatch = adapter.createDryRunDispatch({
    kind: "conference_invite",
    targetEmployeeId: "employee-arturo",
    linkedTicketIds: [assignment.targetId],
    linkedConferenceId: conference.id,
    subject: "Collect conference position",
    body: "Dry-run conference invitation.",
    expectedReturnFormat: "status summary blockers next_owner"
  }, actor);

  assert.equal(adapter.listOutbox().length, 3);
  assert.deepEqual(store.deriveConferenceOperatingLoop(conference.id).inviteDispatchIds, [conferenceDispatch.id]);
  assert.equal(adapter.readback(assignmentDispatch.id, actor).observedStatus, "queued");

  adapter.collectReturn(assignmentDispatch.id, "<status>success</status><summary>Implemented</summary>", actor);
  adapter.collectReturn(gateDispatch.id, "<status>changes_requested</status><summary>Need evidence repair</summary><blocker>evidence</blocker>", actor);
  adapter.collectReturn(conferenceDispatch.id, "<status>partial</status><summary>Minutes pending</summary>", actor);

  assert.equal(adapter.readback(assignmentDispatch.id, actor).observedStatus, "completed");
  assert.equal(store.queryAudit({ action: "agent_run.record" }).length, 1);
  assert.equal(store.queryAudit({ action: "gate.status.update" }).at(-1).outcome, "blocked");
  assert.equal(store.queryAudit({ action: "conference.status.update" }).at(-1).outcome, "accepted");
  assert.equal(store.queryAudit({ action: "codex.return.collect" }).length, 3);
});

test("Codex adapter audits blocked dispatch, stale readback, retry, and expiry without live transport", () => {
  const store = new AosStore(createDefaultSeed());
  const adapter = new CodexIntegrationAdapter(store, { maxAttempts: 1, backoffSeconds: [1] });
  const blockedBody = "private " + "evidence payload";
  assert.throws(() => adapter.createDryRunDispatch({
    kind: "assignment",
    targetEmployeeId: "employee-ilya",
    linkedTicketIds: ["story-unsafe"],
    subject: "Unsafe",
    body: blockedBody,
    expectedReturnFormat: "status"
  }, actor), /restricted private_evidence_payload/);
  assert.equal(store.queryAudit({ action: "codex.dispatch.blocked" }).length, 1);

  const dispatch = adapter.createDryRunDispatch({
    kind: "assignment",
    targetEmployeeId: "employee-ilya",
    linkedTicketIds: ["story-safe"],
    subject: "Retry route",
    body: "Dry-run only.",
    expectedReturnFormat: "status"
  }, actor);
  adapter.markStale(dispatch.id, actor);
  adapter.markRetry(dispatch.id, actor);
  const expired = adapter.markRetry(dispatch.id, actor);
  assert.equal(expired.status, "expired");
  assert.equal(adapter.readback(dispatch.id, actor).observedStatus, "blocked");
  assert.equal(store.queryAudit({ action: "codex.dispatch.stale" }).length, 1);
  assert.equal(store.queryAudit({ action: "codex.dispatch.retry" }).length, 1);
  assert.equal(store.queryAudit({ action: "codex.dispatch.expire" }).length, 1);
});

function createLinkedOperationalRecords(store) {
  const initiative = store.createInitiative({
    projectId: "TCRN-AOS",
    title: "Slice 3 Gateway Proof",
    status: "in_progress",
    problem: "Gateway and adapter need runtime side effects.",
    expectedOutcome: "Dry-run outbox updates local operational state."
  }, actor);
  const epic = store.createEpic({
    initiativeId: initiative.id,
    title: "Adapter returns",
    goal: "Collect returns without live dispatch.",
    status: "in_progress"
  }, actor);
  const story = store.createStory({
    epicId: epic.id,
    title: "Collect dry-run return",
    problem: "Returned thread status must update local records only.",
    user: "proof owner",
    expectedBehavior: "Local records update and audit entries append.",
    acceptanceCriteria: ["assignment run", "gate status", "conference status"],
    status: "in_progress",
    estimate: {
      effortPoints: 3,
      complexity: "medium",
      risk: "L3",
      verificationCost: "medium",
      confidence: "medium"
    },
    subTasks: []
  }, actor);
  const assignment = store.createAssignment({
    employeeId: "employee-ilya",
    targetId: story.id,
    targetType: "story",
    role: "implementation",
    status: "in_progress",
    dueState: "none",
    proofExpectation: "adapter dry-run return proof"
  }, actor);
  const gate = store.requestGate({
    type: "security_license",
    linkedTicketId: story.id,
    inputEvidenceIds: []
  }, actor);
  const conference = store.createConference({
    type: "verification",
    title: "Slice 3 dry-run conference",
    initiator: actor,
    participantEmployeeIds: ["employee-arturo"],
    agenda: ["Read return"],
    linkedTicketIds: [story.id],
    desiredOutcome: "Local return collection only."
  }, actor);
  return { assignment, gate, conference };
}
