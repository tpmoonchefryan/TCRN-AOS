import test from "node:test";
import assert from "node:assert/strict";
import { AosStore, createDefaultSeed, createId } from "../../../dist/packages/domain/src/index.js";

const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "slice5-domain-test"
};

const arturo = {
  employeeId: "employee-arturo",
  role: "coordinator",
  threadId: "019eb66e-00d1-7190-81d9-693895b32033",
  sessionId: "slice5-domain-test"
};

const estimate = {
  effortPoints: 5,
  complexity: "high",
  risk: "L3",
  verificationCost: "high",
  confidence: "medium"
};

test("Slice 5 domain drill-through links story assignment gate conference evidence and audit", () => {
  const { store, story, conference, evidence, ownerIntentGate } = createOperatingLoopFixture();
  store.linkConferenceDispatch(conference.id, "dispatch-arturo", actor);
  const position = store.recordConferencePosition({
    conferenceId: conference.id,
    actor: arturo,
    position: "Conference can proceed with missing security response surfaced separately.",
    risks: ["Security position still pending"],
    recommendations: ["Keep minutes draft local until Sable responds."],
    evidenceIds: [evidence.id]
  }, actor);

  const loop = store.deriveConferenceOperatingLoop(conference.id);
  const drillThrough = store.createWorkIndexDrillThrough(story.id);

  assert.deepEqual(loop.inviteDispatchIds, ["dispatch-arturo"]);
  assert.equal(loop.minutesStatus, "ready_for_draft");
  assert.deepEqual(loop.missingParticipantEmployeeIds, ["employee-sable"]);
  assert.deepEqual(loop.participantPositionIds, [position.id]);
  assert.equal(loop.liveDispatchAuthorized, false);
  assert.equal(loop.threadRegistryMutationAuthorized, false);
  assert.ok(drillThrough.linkedAssignmentIds.length >= 1);
  assert.deepEqual(drillThrough.linkedConferenceIds, [conference.id]);
  assert.ok(drillThrough.linkedGateIds.includes(ownerIntentGate.id));
  assert.ok(drillThrough.linkedEvidenceIds.includes(evidence.id));
  assert.ok(drillThrough.linkedAuditEventIds.length >= 1);
  assert.ok(drillThrough.nextAllowedLocalActions.includes("record_participant_position"));
  assert.ok(drillThrough.nextAllowedLocalActions.includes("record_minutes"));
  assert.ok(drillThrough.blockedActions.some((action) => action.action === "submit_owner_intent" && action.ownerRole === "owner"));
});

test("Slice 5 minutes metadata records outcome without action-item automation", () => {
  const { store, story, conference, evidence } = createOperatingLoopFixture();
  store.recordConferencePosition({
    conferenceId: conference.id,
    actor: arturo,
    position: "Recommend owner intent gate before external execution.",
    risks: ["Owner intent required"],
    recommendations: ["Keep action item automation deferred."],
    evidenceIds: [evidence.id]
  }, actor);
  const minutes = store.recordConferenceMinutes({
    conferenceId: conference.id,
    summary: "Conference outcome requires owner intent and local evidence repair only.",
    outcomeClass: "owner_intent_required",
    decisions: [{
      id: createId("decision", { storyId: story.id, outcome: "owner_intent_required" }),
      decisionClass: "owner_intent_required",
      actor,
      summary: "Owner intent remains pending; no action item automation created.",
      evidenceIds: [evidence.id],
      createdAt: new Date().toISOString()
    }],
    unresolvedIssues: ["Owner decision not captured"],
    actionItemIds: []
  }, actor);
  const loop = store.deriveConferenceOperatingLoop(conference.id);

  assert.equal(minutes.actionItemIds.length, 0);
  assert.equal(loop.minutesStatus, "recorded");
  assert.equal(loop.outcomeClass, "owner_intent_required");
  assert.ok(store.queryAudit({ action: "conference.minutes.record" }).some((event) => event.details.actionItemAutomation === false));
});

function createOperatingLoopFixture() {
  const store = new AosStore(createDefaultSeed());
  const initiative = store.createInitiative({
    projectId: "TCRN-AOS",
    title: "Slice 5 Conference Loop",
    status: "in_progress",
    problem: "AI employee work needs local conference drill-through.",
    expectedOutcome: "Conference, gates, evidence, and audit are inspectable without live dispatch."
  }, actor);
  const epic = store.createEpic({
    initiativeId: initiative.id,
    title: "Conference operating loop",
    goal: "Local-only operating loop readback.",
    status: "in_progress"
  }, actor);
  const story = store.createStory({
    epicId: epic.id,
    title: "Inspect conference operating loop",
    problem: "Work-index rows need drill-through into conference state.",
    user: "owner observer",
    expectedBehavior: "Story detail links assignment, gate, conference, evidence, and audit.",
    acceptanceCriteria: ["drill-through", "conference positions", "owner intent separation"],
    status: "in_progress",
    estimate,
    subTasks: []
  }, actor);
  store.createAssignment({
    employeeId: "employee-ilya",
    targetId: story.id,
    targetType: "story",
    role: "implementation",
    status: "in_progress",
    dueState: "none",
    proofExpectation: "slice5 operating loop"
  }, actor);
  const evidence = store.linkEvidence({
    type: "artifact_id",
    target: "slice5-operating-loop-proof",
    validity: "valid",
    producer: actor.employeeId,
    digest: "sha256:slice5",
    redactionState: "metadata_only"
  }, actor);
  store.requestGate({
    type: "evidence_proof",
    linkedTicketId: story.id,
    inputEvidenceIds: [evidence.id]
  }, actor);
  const ownerIntentGate = store.requestGate({
    type: "owner_intent",
    linkedTicketId: story.id,
    inputEvidenceIds: [evidence.id]
  }, actor);
  const conference = store.createConference({
    type: "verification",
    title: "Slice 5 local operating loop",
    initiator: actor,
    participantEmployeeIds: ["employee-arturo", "employee-sable"],
    agenda: ["Collect positions", "Record local minutes", "Preserve owner intent"],
    linkedTicketIds: [story.id],
    desiredOutcome: "Local decision metadata"
  }, actor);
  return { store, story, conference, evidence, ownerIntentGate };
}
