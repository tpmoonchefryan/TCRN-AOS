import { AosStore, createDefaultSeed } from "../dist/packages/domain/src/index.js";
import { createOperationsCockpitReadModel, requiredCockpitRegionIds } from "../dist/apps/web/src/cockpit.js";

const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "slice-4-proof"
};

const estimate = {
  effortPoints: 3,
  complexity: "medium",
  risk: "L3",
  verificationCost: "medium",
  confidence: "medium"
};

const scenarios = ["moving", "blocked", "owner_intent_required"].map((scenario) => {
  const { store, initiative } = createScenario(scenario);
  const model = createOperationsCockpitReadModel({
    store,
    projectId: "TCRN-AOS",
    initiativeId: initiative.id,
    localCheckpoint: `slice-4-${scenario}`
  });
  return { scenario, model };
});

const requiredRegionsPresent = scenarios.every(({ model }) => requiredCockpitRegionIds.every((id) => model.navigation.some((item) => item.id === id)));
const ownerIntentSeparated = scenarios
  .find(({ scenario }) => scenario === "owner_intent_required")
  ?.model.ownerIntentQueue.every((gate) => gate.ownerIntent && gate.autoExecutable === false) ?? false;
const blockedVisible = scenarios
  .find(({ scenario }) => scenario === "blocked")
  ?.model.riskWarnings.some((warning) => warning.state === "blocked") ?? false;
const movingFresh = scenarios
  .find(({ scenario }) => scenario === "moving")
  ?.model.contextHeader.dataFreshness === "current";
const noOverclaim = scenarios.every(({ model }) => model.nonClaims.releaseReadinessClaim === "external_proof_required"
  && model.nonClaims.productDesignAcceptance === "not_claimed"
  && model.nonClaims.visualTarget === "visual_target_required_before_acceptance"
  && model.nonClaims.liveCodexDispatch === false
  && model.nonClaims.deployment === false
  && model.nonClaims.productAcceptance === false
  && model.nonClaims.runtimeDataCommittedToGit === false);
const productDesignBoundary = scenarios.every(({ model }) => model.productDesignStatus.brief === "accepted"
  && model.productDesignStatus.prototype === "not_applicable_to_this_packet"
  && model.productDesignStatus.uxLayoutVisualAcceptance === "not_claimed");
const dependencyResourceNoClaims = scenarios.every(({ model }) => model.dependencyInspection.every((item) => item.cleanClaim === false && item.legalCompletionClaim === false)
  && model.resourceInspection.every((item) => item.scannerIngestionClaim === false && item.materializationExecuted === false));

const ok = [
  requiredRegionsPresent,
  ownerIntentSeparated,
  blockedVisible,
  movingFresh,
  noOverclaim,
  productDesignBoundary,
  dependencyResourceNoClaims
].every(Boolean);

console.log(JSON.stringify({
  ok,
  scenarios: scenarios.map(({ scenario, model }) => ({
    scenario,
    navigationRegions: model.navigation.length,
    workstreamGroups: model.workstreams.length,
    stageMapItems: model.stageMap.length,
    roleGateQueue: model.roleGateQueue.length,
    ownerIntentQueue: model.ownerIntentQueue.length,
    conferences: model.conferences.length,
    evidenceReadbacks: model.evidenceReadbacks.length,
    riskWarnings: model.riskWarnings.length,
    dependencyInspection: model.dependencyInspection.length,
    resourceInspection: model.resourceInspection.length,
    freshness: model.contextHeader.dataFreshness
  })),
  proof: {
    requiredRegionsPresent,
    ownerIntentSeparated,
    blockedVisible,
    movingFresh,
    noOverclaim,
    productDesignBoundary,
    dependencyResourceNoClaims
  },
  noOverclaim: {
    visualAcceptance: false,
    productDesignAcceptance: false,
    liveCodexDispatch: false,
    deployment: false,
    productAcceptance: false,
    runtimeDataCommittedToGit: false,
    dependencyCleanClaim: false,
    resourceMaterialization: false
  }
}, null, 2));

if (!ok) {
  process.exit(1);
}

function createScenario(kind) {
  const store = new AosStore(createDefaultSeed());
  const initiative = store.createInitiative({
    projectId: "TCRN-AOS",
    title: `Slice 4 ${kind}`,
    status: kind === "blocked" ? "blocked" : "in_progress",
    problem: "AOS needs operations cockpit readbacks.",
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
        sessionId: "slice-4-proof"
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
  return { store, initiative };
}
