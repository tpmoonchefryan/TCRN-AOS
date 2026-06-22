import {
  AosStore,
  createDefaultSeed,
  createId
} from "../dist/packages/domain/src/index.js";
import { CodexIntegrationAdapter } from "../dist/packages/adapter-codex/src/index.js";
import { McpGateway } from "../dist/packages/mcp-gateway/src/index.js";
import {
  forbiddenProductionCopy,
  renderOperationsCockpitHtml
} from "../dist/apps/web/src/cockpit-view.js";

const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "slice5-proof"
};

const arturo = {
  employeeId: "employee-arturo",
  role: "coordinator",
  threadId: "019eb66e-00d1-7190-81d9-693895b32033",
  sessionId: "slice5-proof"
};

const sable = {
  employeeId: "employee-sable",
  role: "security",
  threadId: "sable-thread",
  sessionId: "slice5-proof"
};

const scenarioProofs = [
  proveConferenceRequested(),
  provePositionsCollecting(),
  proveMinutesRecorded(),
  proveOwnerIntentRequired(),
  proveStaleRouteFollowup()
];

const gatewayProof = proveGatewayMethods();
const html = renderOperationsCockpitHtml();
const staticProof = {
  workIndexDrillThroughMarker: html.includes('data-slice5="work-index-drill-through"'),
  conferenceLoopRegion: html.includes('data-region="conference-operating-loop"'),
  forbiddenProductionCopyHits: forbiddenProductionCopy.filter((phrase) => html.toLowerCase().includes(phrase.toLowerCase())),
  actionPostureCopyPresent: html.includes("Release and live operations remain disabled in this workspace.")
};

const ok = scenarioProofs.every((scenario) => scenario.ok)
  && gatewayProof.ok
  && staticProof.workIndexDrillThroughMarker
  && staticProof.conferenceLoopRegion
  && staticProof.forbiddenProductionCopyHits.length === 0
  && staticProof.actionPostureCopyPresent;

console.log(JSON.stringify({
  ok,
  scenarios: scenarioProofs,
  gatewayProof,
  staticProof,
  noOverclaim: {
    liveCodexDispatch: false,
    threadRegistryMutation: false,
    deployment: false,
    productDesignFinalAcceptance: false,
    browserAcceptanceCloseout: false,
    productAcceptance: false,
    finalMvpAcceptance: false,
    actionItemAutomation: false,
    runtimeDataCommittedToGit: false
  },
  productDesignStatus: {
    brief: "accepted",
    ownerStyleBaseline: "accepted_for_now_from_slice_4b",
    visualIdeation: "not_required_for_local_operating_loop_drill_through",
    prototype: "not_claimed",
    browserVisualAcceptance: "not_claimed",
    uxLayoutVisualAcceptance: "not_claimed"
  }
}, null, 2));

if (!ok) {
  process.exit(1);
}

function proveConferenceRequested() {
  const { store, conference, story } = createScenario("conference_requested");
  const adapter = new CodexIntegrationAdapter(store);
  for (const employeeId of conference.participantEmployeeIds) {
    adapter.createDryRunDispatch({
      kind: "conference_invite",
      targetEmployeeId: employeeId,
      linkedTicketIds: [story.id],
      linkedConferenceId: conference.id,
      subject: "Slice 5 local conference position",
      body: "Dry-run invite only; no live Codex dispatch.",
      expectedReturnFormat: "status summary blockers next_owner"
    }, actor);
  }
  const loop = store.deriveConferenceOperatingLoop(conference.id);
  const drillThrough = store.createWorkIndexDrillThrough(story.id);
  return {
    scenario: "conference_requested",
    ok: loop.inviteDispatchIds.length === 2
      && loop.minutesStatus === "not_started"
      && loop.missingParticipantEmployeeIds.length === 2
      && drillThrough.linkedConferenceIds.includes(conference.id)
      && drillThrough.nextAllowedLocalActions.includes("record_participant_position"),
    inviteDispatches: loop.inviteDispatchIds.length,
    missingParticipants: loop.missingParticipantEmployeeIds.length,
    nextAllowedLocalActions: drillThrough.nextAllowedLocalActions
  };
}

function provePositionsCollecting() {
  const { store, conference, story, evidence } = createScenario("positions_collecting");
  store.recordConferencePosition({
    conferenceId: conference.id,
    actor: arturo,
    position: "Proceed with local conference metadata; security response remains pending.",
    risks: ["Missing security position"],
    recommendations: ["Surface missing readback without failure inference."],
    evidenceIds: [evidence.id]
  }, actor);
  const loop = store.deriveConferenceOperatingLoop(conference.id);
  const drillThrough = store.createWorkIndexDrillThrough(story.id);
  return {
    scenario: "positions_collecting",
    ok: loop.minutesStatus === "ready_for_draft"
      && loop.participantPositionIds.length === 1
      && loop.missingParticipantEmployeeIds.includes("employee-sable")
      && drillThrough.nextAllowedLocalActions.includes("record_minutes"),
    participantPositions: loop.participantPositionIds.length,
    missingParticipants: loop.missingParticipantEmployeeIds
  };
}

function proveMinutesRecorded() {
  const { store, conference, evidence } = createScenario("minutes_recorded");
  recordBothPositions(store, conference.id, evidence.id);
  const minutes = store.recordConferenceMinutes({
    conferenceId: conference.id,
    summary: "Conference minutes recorded as local recommendation metadata.",
    outcomeClass: "recommendation",
    decisions: [decision("recommendation", "Review lanes can inspect the Slice 5 proof.", evidence.id)],
    unresolvedIssues: [],
    actionItemIds: []
  }, actor);
  const loop = store.deriveConferenceOperatingLoop(conference.id);
  return {
    scenario: "minutes_recorded",
    ok: loop.minutesStatus === "recorded"
      && loop.outcomeClass === "recommendation"
      && minutes.actionItemIds.length === 0
      && store.queryAudit({ action: "conference.minutes.record" }).length === 1,
    outcomeClass: loop.outcomeClass,
    actionItemAutomation: false
  };
}

function proveOwnerIntentRequired() {
  const { store, conference, story, evidence } = createScenario("owner_intent_required", { ownerIntentGate: true });
  recordBothPositions(store, conference.id, evidence.id);
  store.recordConferenceMinutes({
    conferenceId: conference.id,
    summary: "Conference outcome requires owner intent before any external operation.",
    outcomeClass: "owner_intent_required",
    decisions: [decision("owner_intent_required", "Owner Intent stays pending and cannot auto-execute.", evidence.id)],
    unresolvedIssues: ["Owner decision not captured"],
    actionItemIds: []
  }, actor);
  const loop = store.deriveConferenceOperatingLoop(conference.id);
  const drillThrough = store.createWorkIndexDrillThrough(story.id);
  return {
    scenario: "owner_intent_required",
    ok: loop.outcomeClass === "owner_intent_required"
      && drillThrough.blockedActions.some((item) => item.action === "submit_owner_intent")
      && drillThrough.blockedActions.every((item) => item.ownerRole === "owner" || item.ownerRole === "verification"),
    blockedActions: drillThrough.blockedActions.map((item) => item.action)
  };
}

function proveStaleRouteFollowup() {
  const { store, conference, story } = createScenario("stale_route_followup", { assignmentDueState: "timeout" });
  const adapter = new CodexIntegrationAdapter(store, { maxAttempts: 1, backoffSeconds: [1] });
  const dispatch = adapter.createDryRunDispatch({
    kind: "conference_invite",
    targetEmployeeId: "employee-arturo",
    linkedTicketIds: [story.id],
    linkedConferenceId: conference.id,
    subject: "Stale conference invite",
    body: "Dry-run invite only; stale readback must stay local.",
    expectedReturnFormat: "status summary blockers next_owner"
  }, actor);
  adapter.markStale(dispatch.id, actor);
  const drillThrough = store.createWorkIndexDrillThrough(story.id);
  const readback = adapter.readback(dispatch.id, actor);
  return {
    scenario: "stale_route_followup",
    ok: drillThrough.nextAllowedLocalActions.includes("mark_route_stale")
      && readback.observedStatus === "stale"
      && store.queryAudit({ action: "codex.dispatch.stale" }).length === 1,
    nextAllowedLocalActions: drillThrough.nextAllowedLocalActions,
    readbackStatus: readback.observedStatus
  };
}

function proveGatewayMethods() {
  const { store, story, conference, evidence } = createScenario("gateway_methods");
  const gateway = new McpGateway(store);
  const minutes = gateway.handle({
    method: "aos.conference.minutes.record",
    actor,
    params: {
      conferenceId: conference.id,
      summary: "Gateway minutes record remains local.",
      outcomeClass: "recommendation",
      decisionSummary: "Proceed with local proof review.",
      evidenceIds: [evidence.id],
      unresolvedIssues: [],
      actionItemIds: []
    }
  });
  const drillThrough = gateway.handle({
    method: "aos.work_index.drill_through.read",
    actor,
    params: { storyId: story.id }
  });
  return {
    ok: minutes.ok === true
      && minutes.result.actionItemIds.length === 0
      && drillThrough.status === "read"
      && drillThrough.result.linkedConferenceIds.includes(conference.id),
    minutesStatus: minutes.status,
    drillThroughStatus: drillThrough.status
  };
}

function createScenario(label, options = {}) {
  const store = new AosStore(createDefaultSeed());
  const initiative = store.createInitiative({
    projectId: "TCRN-AOS",
    title: `Slice 5 ${label}`,
    status: "in_progress",
    problem: "Conference and AI operating-loop state needs local drill-through.",
    expectedOutcome: "Local records expose conference, gates, dispatch, evidence, and audit without live operations."
  }, actor);
  const epic = store.createEpic({
    initiativeId: initiative.id,
    title: "Conference and AI operating loop",
    goal: "Local-only conference operating loop.",
    status: "in_progress"
  }, actor);
  const story = store.createStory({
    epicId: epic.id,
    title: `Inspect ${label}`,
    problem: "Owner needs drill-through into AI employee work.",
    user: "owner observer",
    expectedBehavior: "Work index links story, assignment, gate, conference, evidence, and audit.",
    acceptanceCriteria: ["conference loop", "dry-run invite", "owner intent", "audit"],
    status: "in_progress",
    estimate: {
      effortPoints: 5,
      complexity: "high",
      risk: "L3",
      verificationCost: "high",
      confidence: "medium"
    },
    subTasks: []
  }, actor);
  store.createAssignment({
    employeeId: "employee-ilya",
    targetId: story.id,
    targetType: "story",
    role: "implementation",
    status: options.assignmentDueState === "timeout" ? "blocked" : "in_progress",
    dueState: options.assignmentDueState ?? "none",
    proofExpectation: "slice5 operating loop proof"
  }, actor);
  const evidence = store.linkEvidence({
    type: "artifact_id",
    target: `slice5-${label}-proof`,
    validity: "valid",
    producer: actor.employeeId,
    digest: `sha256:slice5-${label}`,
    redactionState: "metadata_only"
  }, actor);
  store.requestGate({
    type: "evidence_proof",
    linkedTicketId: story.id,
    inputEvidenceIds: [evidence.id]
  }, actor);
  if (options.ownerIntentGate) {
    store.requestGate({
      type: "owner_intent",
      linkedTicketId: story.id,
      inputEvidenceIds: [evidence.id]
    }, actor);
  }
  const conference = store.createConference({
    type: "verification",
    title: `Slice 5 ${label} conference`,
    initiator: actor,
    participantEmployeeIds: ["employee-arturo", "employee-sable"],
    agenda: ["Collect positions", "Record minutes", "Preserve boundaries"],
    linkedTicketIds: [story.id],
    desiredOutcome: "Local operating-loop metadata"
  }, actor);
  return { store, story, conference, evidence };
}

function recordBothPositions(store, conferenceId, evidenceId) {
  store.recordConferencePosition({
    conferenceId,
    actor: arturo,
    position: "Coordinator position recorded locally.",
    risks: [],
    recommendations: ["Proceed with review lane proof."],
    evidenceIds: [evidenceId]
  }, actor);
  store.recordConferencePosition({
    conferenceId,
    actor: sable,
    position: "Security posture remains no-live-dispatch.",
    risks: ["No final product acceptance"],
    recommendations: ["Keep restricted payload rejection active."],
    evidenceIds: [evidenceId]
  }, actor);
}

function decision(decisionClass, summary, evidenceId) {
  return {
    id: createId("decision", { decisionClass, summary }),
    decisionClass,
    actor,
    summary,
    evidenceIds: [evidenceId],
    createdAt: new Date().toISOString()
  };
}
