import test from "node:test";
import assert from "node:assert/strict";
import { AosStore, createDefaultSeed } from "../../../dist/packages/domain/src/index.js";
import {
  conferenceStates,
  createCockpitServiceReadback,
  createCockpitSnapshot,
  createOperationsCockpitReadModel,
  freshnessStates,
  gateStates,
  initialNavigation,
  requiredCockpitRegionIds,
  riskStates,
  stageStates
} from "../../../dist/apps/web/src/cockpit.js";

const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "web-test"
};

const estimate = {
  effortPoints: 3,
  complexity: "medium",
  risk: "L3",
  verificationCost: "medium",
  confidence: "medium"
};

test("cockpit snapshot exposes operational inspection without release readiness overclaim", () => {
  const store = new AosStore(createDefaultSeed());
  const dependency = store.createDependencyRecord({
    projectId: "TCRN-AOS",
    ecosystem: "npm",
    packageName: "typescript",
    versionRange: "5.8.3",
    sourceSystem: "package.json",
    projectUsage: "development",
    licenseExpression: "Apache-2.0",
    evidenceStatus: "present",
    sbomNoticeObligation: "none",
    posture: "review_required",
    approvalOwnerRole: "security"
  }, actor);
  const resource = store.createResourceRecord({
    type: "document",
    title: "Proof note",
    owner: "TCRN",
    source: "product-local",
    version: "0.1.0",
    digest: "sha256:resource",
    storageReference: "resource-proof-note",
    classification: ["proof"],
    copyrightStatus: "review_required",
    lifecycleState: "proposed",
    approvalState: "review_required"
  }, actor);
  const snapshot = createCockpitSnapshot({
    projects: store.listProjects(),
    gates: [],
    stageMap: [],
    dependencies: [dependency],
    resources: [resource],
    audit: store.queryAudit()
  });

  assert.ok(initialNavigation.includes("Approvals/Gates"));
  assert.ok(initialNavigation.includes("Audit"));
  assert.equal(snapshot.dependencyPosture[0].posture, "review_required");
  assert.equal(snapshot.resourcePosture[0].approvalState, "review_required");
  assert.equal(snapshot.releaseReadinessClaim, "external_proof_required");
});

test("operations cockpit read model exposes required regions, states, and Product Design boundaries", () => {
  const { store, initiative, story } = createScenario("moving");
  const model = createOperationsCockpitReadModel({
    store,
    projectId: "TCRN-AOS",
    initiativeId: initiative.id,
    localCheckpoint: "slice-4-local",
    selectedDetail: { id: story.id, type: "story" }
  });

  assert.deepEqual(model.navigation.map((item) => item.id), requiredCockpitRegionIds);
  assert.deepEqual([...stageStates], ["not_started", "active", "blocked", "complete", "release_proof_required"]);
  assert.deepEqual([...gateStates], ["proposed", "pending_role", "owner_intent_required", "accepted", "blocked", "superseded"]);
  assert.deepEqual([...conferenceStates], ["requested", "collecting_positions", "minutes_ready", "blocked", "closed"]);
  assert.deepEqual([...freshnessStates], ["current", "stale", "unknown", "blocked"]);
  assert.deepEqual([...riskStates], ["review_required", "evidence_missing", "accepted_with_residual_risk", "blocked", "not_applicable"]);
  assert.equal(model.productDesignStatus.brief, "accepted");
  assert.equal(model.productDesignStatus.prototype, "not_applicable_to_this_packet");
  assert.equal(model.productDesignStatus.uxLayoutVisualAcceptance, "not_claimed");
  assert.equal(model.nonClaims.visualTarget, "visual_target_required_before_acceptance");
  assert.equal(model.nonClaims.runtimeDataCommittedToGit, false);
  assert.equal(model.detailPanel?.rawSourceDisplayed, false);
  assert.equal(model.detailPanel?.privateEvidenceDisplayed, false);

  const serviceReadback = createCockpitServiceReadback(model, { serviceBacked: true });
  assert.equal(serviceReadback.schemaVersion, "aos.cockpit.service_read_model.v1");
  assert.equal(serviceReadback.slice, "slice_2_service_read_model_stabilization");
  assert.equal(serviceReadback.source, "service_api_read");
  assert.equal(serviceReadback.surfaces.cockpit.localCheckpoint, "slice-4-local");
  assert.equal(serviceReadback.surfaces.workIndex.rowCount, 1);
  assert.equal(serviceReadback.surfaces.workIndex.selectedStoryId, story.id);
  assert.equal(serviceReadback.surfaces.detail.selectedId, story.id);
  assert.equal(serviceReadback.surfaces.detail.rawSourceDisplayed, false);
  assert.equal(serviceReadback.surfaces.detail.privateEvidenceDisplayed, false);
  assert.equal(serviceReadback.surfaces.gate.autoExecutableCount, 0);
  assert.equal(serviceReadback.surfaces.readback.productAcceptance, false);
  assert.equal(serviceReadback.surfaces.readback.finalMvpAcceptance, false);
  assert.equal(serviceReadback.noClaims.broadUiReactMigration, false);
});

test("operations cockpit moving scenario shows workstream, gate, conference, evidence, dependency, and resource readbacks", () => {
  const { store, initiative } = createScenario("moving");
  const model = createOperationsCockpitReadModel({
    store,
    projectId: "TCRN-AOS",
    initiativeId: initiative.id,
    localCheckpoint: "slice-4-moving"
  });

  assert.equal(model.contextHeader.dataFreshness, "current");
  assert.equal(model.workstreams.length, 1);
  assert.equal(model.workstreams[0].rows[0].status, "in_progress");
  assert.equal(model.stageMap.length, 4);
  assert.equal(model.stageMap.some((stage) => stage.manualReadinessOverrideAllowed), false);
  assert.equal(model.roleGateQueue.length, 1);
  assert.equal(model.ownerIntentQueue.length, 0);
  assert.equal(model.conferences[0].missingParticipantEmployeeIds.length, 0);
  assert.equal(model.evidenceReadbacks[0].freshness, "current");
  assert.equal(model.dependencyInspection[0].cleanClaim, false);
  assert.equal(model.resourceInspection[0].materializationExecuted, false);
});

test("operations cockpit blocked scenario surfaces blockers without readiness overclaim", () => {
  const { store, initiative } = createScenario("blocked");
  const model = createOperationsCockpitReadModel({
    store,
    projectId: "TCRN-AOS",
    initiativeId: initiative.id,
    localCheckpoint: "slice-4-blocked"
  });

  assert.equal(model.contextHeader.dataFreshness, "blocked");
  assert.equal(model.stageMap.some((stage) => stage.state === "blocked"), true);
  assert.equal(model.roleGateQueue.some((gate) => gate.status === "blocked"), true);
  assert.equal(model.riskWarnings.some((warning) => warning.state === "blocked"), true);
  assert.equal(model.dependencyInspection[0].legalCompletionClaim, false);
  assert.equal(model.resourceInspection[0].scannerIngestionClaim, false);
  assert.equal(model.nonClaims.releaseReadinessClaim, "external_proof_required");
});

test("operations cockpit owner-intent scenario separates owner gates from ordinary role gates", () => {
  const { store, initiative } = createScenario("owner_intent_required");
  const model = createOperationsCockpitReadModel({
    store,
    projectId: "TCRN-AOS",
    initiativeId: initiative.id,
    localCheckpoint: "slice-4-owner-intent"
  });

  assert.equal(model.roleGateQueue.length, 1);
  assert.equal(model.ownerIntentQueue.length, 1);
  assert.equal(model.ownerIntentQueue[0].status, "owner_intent_required");
  assert.equal(model.ownerIntentQueue[0].autoExecutable, false);
  assert.equal(model.riskWarnings.some((warning) => warning.type === "route" && warning.state === "review_required"), true);
  assert.equal(model.nonClaims.liveCodexDispatch, false);
  assert.equal(model.nonClaims.deployment, false);
  assert.equal(model.nonClaims.productAcceptance, false);
});

function createScenario(kind) {
  const store = new AosStore(createDefaultSeed());
  const initiative = store.createInitiative({
    projectId: "TCRN-AOS",
    title: `Slice 4 ${kind}`,
    status: kind === "blocked" ? "blocked" : "in_progress",
    problem: "AOS needs non-visual operations cockpit readbacks.",
    expectedOutcome: "Functional contract shows work, gates, conferences, evidence, and risk."
  }, actor);
  const epic = store.createEpic({
    initiativeId: initiative.id,
    title: "Operations Cockpit Contract",
    goal: "Expose deterministic read models.",
    status: kind === "blocked" ? "blocked" : "in_progress"
  }, actor);
  const story = store.createStory({
    epicId: epic.id,
    title: "Inspect operations state",
    problem: "Owner needs to understand AI employee work without direct CRUD.",
    user: "owner observer",
    expectedBehavior: "Read model separates movement, blockers, evidence, and owner intent.",
    acceptanceCriteria: ["required regions", "stage map", "gate queues", "conference visibility", "no-overclaim"],
    status: kind === "blocked" ? "blocked" : "in_progress",
    estimate,
    subTasks: []
  }, actor);
  const evidence = store.linkEvidence({
    type: "artifact_id",
    target: `slice-4-${kind}-proof`,
    validity: kind === "blocked" ? "broken" : "valid",
    producer: actor.employeeId,
    digest: `sha256:slice-4-${kind}`,
    redactionState: "metadata_only"
  }, actor);
  const roleGate = store.requestGate({
    type: kind === "blocked" ? "security_license" : "evidence_proof",
    linkedTicketId: story.id,
    inputEvidenceIds: [evidence.id]
  }, actor);
  if (kind === "blocked") {
    store.updateGateStatus(roleGate.id, "blocked", actor, "Security proof is blocked.");
  }
  if (kind === "owner_intent_required") {
    store.requestGate({
      type: "owner_intent",
      linkedTicketId: story.id,
      inputEvidenceIds: [evidence.id]
    }, actor);
  }
  const conference = store.createConference({
    type: "verification",
    title: `Slice 4 ${kind} conference`,
    initiator: actor,
    participantEmployeeIds: ["employee-arturo"],
    agenda: ["Inspect cockpit read model"],
    linkedTicketIds: [story.id],
    desiredOutcome: "Functional readback"
  }, actor);
  if (kind === "moving") {
    store.recordConferencePosition({
      conferenceId: conference.id,
      actor: {
        employeeId: "employee-arturo",
        role: "coordinator",
        threadId: "019eb66e-00d1-7190-81d9-693895b32033",
        sessionId: "web-test"
      },
      position: "Proceed with functional contract proof.",
      risks: [],
      recommendations: ["Keep visual acceptance out of scope."],
      evidenceIds: [evidence.id]
    }, actor);
    store.updateConferenceStatus(conference.id, "minutes_ready", actor);
  } else if (kind === "blocked") {
    store.updateConferenceStatus(conference.id, "blocked", actor);
  }
  store.createAssignment({
    employeeId: "employee-ilya",
    targetId: story.id,
    targetType: "story",
    role: "implementation",
    status: kind === "blocked" ? "blocked" : "in_progress",
    dueState: kind === "blocked" ? "timeout" : "none",
    proofExpectation: "slice-4-proof"
  }, actor);
  store.createDependencyRecord({
    projectId: "TCRN-AOS",
    ecosystem: "npm",
    packageName: kind === "blocked" ? "blocked-package" : "typescript",
    versionRange: kind === "blocked" ? "0.0.0" : "5.8.3",
    sourceSystem: "package.json",
    projectUsage: kind === "blocked" ? "runtime" : "development",
    licenseExpression: kind === "blocked" ? "UNKNOWN" : "Apache-2.0",
    evidenceStatus: kind === "blocked" ? "evidence_missing" : "present",
    sbomNoticeObligation: kind === "blocked" ? "review_required" : "none",
    posture: kind === "blocked" ? "blocked" : "review_required",
    approvalOwnerRole: "security"
  }, actor);
  store.createResourceRecord({
    type: "document",
    title: kind === "blocked" ? "Unreviewed resource" : "Operations cockpit proof note",
    owner: "TCRN",
    source: "product-local",
    version: "0.1.0",
    digest: `sha256:resource-${kind}`,
    storageReference: `resource-${kind}`,
    classification: ["proof"],
    copyrightStatus: kind === "blocked" ? "blocked" : "review_required",
    lifecycleState: kind === "blocked" ? "proposed" : "approved",
    approvalState: kind === "blocked" ? "blocked" : "review_required"
  }, actor);

  return { store, initiative, story };
}
