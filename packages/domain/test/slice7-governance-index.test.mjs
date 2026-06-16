import test from "node:test";
import assert from "node:assert/strict";
import {
  AosStore,
  createDefaultSeed,
  createId
} from "../../../dist/packages/domain/src/index.js";

const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "slice7-domain-test"
};

const estimate = {
  effortPoints: 3,
  complexity: "medium",
  risk: "L3",
  verificationCost: "medium",
  confidence: "medium"
};

test("Slice 7 dependency governance indexes lifecycle, license posture, blockers, and no-overclaim state", () => {
  const { store, story, evidence, gate } = governanceFixture();
  const states = ["deprecated", "denied", "expired", "unapproved", "current", "historical", "removed", "unused"];
  const dependencies = states.map((state) => store.createDependencyRecord({
    projectId: "TCRN-AOS",
    ecosystem: "npm",
    packageName: `fixture-${state}`,
    versionRange: state === "removed" ? "removed" : "1.0.0",
    sourceSystem: "deterministic_fixture",
    projectUsage: state === "historical" ? "historical" : "development",
    ownerRole: "security",
    lifecycleState: state,
    artifactRef: `package:fixture-${state}@1.0.0`,
    licenseExpression: state === "denied" ? "GPL-3.0-only" : "MIT",
    declaredLicenseEvidence: `declared-${state}`,
    discoveredLicenseEvidence: `discovered-${state}`,
    evidenceArtifactRef: evidence.id,
    evidenceStatus: state === "unapproved" ? "evidence_missing" : "present",
    confidence: "high",
    policyClass: state === "denied" ? "denied" : state === "unapproved" ? "unknown" : "review_required",
    reviewerRole: "security",
    residualRisk: state === "denied" ? "blocked" : "low",
    nextAction: state === "denied" ? "replace_dependency" : state === "unapproved" ? "request_review" : "none",
    sbomNoticeObligation: state === "current" ? "none" : "review_required",
    posture: dependencyPostureForState(state),
    approvalOwnerRole: "security",
    linkedStoryIds: [story.id],
    linkedEvidenceIds: [evidence.id],
    releaseBlocker: ["denied", "expired", "unapproved"].includes(state),
    packageMutationExecuted: false
  }, actor));

  for (const dependency of dependencies) {
    const state = dependency.lifecycleState;
    store.createDependencyDetectionFinding({
      projectId: "TCRN-AOS",
      dependencyId: dependency.id,
      state,
      sourceSystem: "deterministic_fixture",
      evidenceIds: [evidence.id],
      linkedGateIds: [gate.id],
      remediationExecuted: false,
      packageMutationExecuted: false,
      nextAction: ["denied", "expired", "unapproved"].includes(state) ? "request_review" : "none"
    }, actor);
  }
  store.linkDependencyGate(dependencies[1].id, gate.id, actor);

  const index = store.createDependencyGovernanceIndex("TCRN-AOS");
  assert.equal(index.dependencyIds.length, 8);
  assert.equal(index.detectionFindingIds.length, 8);
  assert.ok(index.blockedDependencyIds.includes(dependencies[1].id));
  assert.ok(index.blockedDependencyIds.includes(dependencies[2].id));
  assert.ok(index.blockedDependencyIds.includes(dependencies[3].id));
  assert.ok(index.releaseBlockerDependencyIds.includes(dependencies[1].id));
  assert.ok(index.sbomNoticeRequiredDependencyIds.includes(dependencies[0].id));
  assert.ok(index.linkedGateIds.includes(gate.id));
  assert.ok(index.linkedEvidenceIds.includes(evidence.id));
  assert.equal(index.stateCounts.denied, 2);
  assert.equal(index.localFirstStorage, true);
  assert.equal(index.packageMutationAuthorized, false);
  assert.equal(index.remediationExecuted, false);
  assert.equal(index.dependencyCleanClaimed, false);
  assert.equal(index.legalCompletionClaimed, false);
  assert.equal(index.releaseReadinessClaimed, false);
});

test("Slice 7 Resource Library indexes copyright, materialization requests, manifests, audit findings, and traceability", () => {
  const { store, story, evidence, gate, ownerGate, releaseNote } = governanceFixture();
  const approved = store.createResourceRecord(resourceInput({
    title: "Approved local proof template",
    lifecycleState: "approved",
    approvalState: "accepted_with_residual_risk",
    permissionState: "permitted",
    linkedStoryIds: [story.id],
    linkedReleaseNoteIds: [releaseNote.id],
    linkedEvidenceIds: [evidence.id]
  }));
  const blocked = store.createResourceRecord(resourceInput({
    title: "Blocked external logo",
    lifecycleState: "denied",
    approvalState: "blocked",
    permissionState: "denied",
    copyrightStatus: "blocked",
    residualRisk: "blocked",
    releaseBlocker: true
  }));

  const request = store.createResourceMaterializationRequest({
    projectId: "TCRN-AOS",
    resourceId: approved.id,
    targetProjectId: "TCRN-AOS",
    requestedBy: actor,
    requestedPurpose: "Metadata-only approval request for a future resource copy.",
    status: "gate_required",
    linkedGateId: ownerGate.id,
    evidenceIds: [evidence.id]
  }, actor);
  const manifest = store.createProjectResourceManifest({
    projectId: "TCRN-AOS",
    resourceId: approved.id,
    resourceDigest: approved.digest,
    materializedCopyReference: "manifest-only:approved-local-proof-template",
    status: "approved_lineage_record",
    linkedStoryIds: [story.id],
    linkedReleaseNoteIds: [releaseNote.id],
    linkedEvidenceIds: [evidence.id]
  }, actor);
  for (const findingType of ["approved_use", "deprecated", "revoked", "stale_version", "unused_materialized", "unregistered_local_asset", "blocked"]) {
    store.createResourceAuditFinding({
      projectId: "TCRN-AOS",
      resourceId: findingType === "unregistered_local_asset" ? undefined : findingType === "blocked" ? blocked.id : approved.id,
      findingType,
      severity: findingType === "blocked" ? "blocked" : findingType === "approved_use" ? "info" : "review_required",
      evidenceIds: [evidence.id],
      linkedGateIds: [gate.id]
    }, actor);
  }
  store.linkResourceGate(approved.id, gate.id, actor);

  const index = store.createResourceGovernanceIndex("TCRN-AOS");
  const approvedRow = index.traceabilityRows.find((row) => row.resourceId === approved.id);
  assert.ok(index.resourceIds.includes(approved.id));
  assert.ok(index.resourceIds.includes(blocked.id));
  assert.deepEqual(index.materializationRequestIds, [request.id]);
  assert.deepEqual(index.manifestRecordIds, [manifest.id]);
  assert.equal(index.auditFindingIds.length, 7);
  assert.ok(index.blockedResourceIds.includes(blocked.id));
  assert.ok(index.releaseBlockerResourceIds.includes(blocked.id));
  assert.ok(index.linkedGateIds.includes(gate.id));
  assert.ok(index.linkedGateIds.includes(ownerGate.id));
  assert.ok(index.linkedEvidenceIds.includes(evidence.id));
  assert.ok(approvedRow.linkedStoryIds.includes(story.id));
  assert.ok(approvedRow.linkedReleaseNoteIds.includes(releaseNote.id));
  assert.ok(approvedRow.linkedEvidenceIds.includes(evidence.id));
  assert.equal(index.findingCounts.blocked, 1);
  assert.equal(index.findingCounts.unregistered_local_asset, 1);
  assert.equal(request.ownerIntentRequired, true);
  assert.equal(request.materializationExecuted, false);
  assert.equal(request.productRepoWriteExecuted, false);
  assert.equal(index.localFirstStorage, true);
  assert.equal(index.scannerIngestionExecuted, false);
  assert.equal(index.materializationExecuted, false);
  assert.equal(index.productRepoWriteExecuted, false);
  assert.equal(index.legalCompletionClaimed, false);
  assert.equal(index.publicReadinessClaimed, false);
  assert.equal(index.releaseReadinessClaimed, false);
});

test("Slice 7 governance records reject restricted local path payloads before storage", () => {
  const { store } = governanceFixture();
  const syntheticLocalPath = "/" + "Users/example/private-resource.png";
  assert.throws(() => store.createResourceRecord(resourceInput({
    title: "Rejected resource",
    storageReference: syntheticLocalPath
  })), /restricted machine_local_absolute_path/);
});

test("Slice 7 governance records fail closed on execution claim booleans", () => {
  const { store, evidence, gate } = governanceFixture();
  assert.throws(() => store.createDependencyRecord(dependencyInput({
    packageMutationExecuted: true
  }), actor), /dependency record rejected execution claim packageMutationExecuted/);
  const dependency = store.createDependencyRecord(dependencyInput({
    evidenceArtifactRef: evidence.id,
    linkedEvidenceIds: [evidence.id],
    packageMutationExecuted: undefined
  }), actor);
  assert.equal(dependency.packageMutationExecuted, false);

  const findingInput = {
    projectId: "TCRN-AOS",
    dependencyId: dependency.id,
    state: "unapproved",
    sourceSystem: "deterministic_fixture",
    evidenceIds: [evidence.id],
    linkedGateIds: [gate.id],
    remediationExecuted: false,
    packageMutationExecuted: false,
    nextAction: "request_review"
  };
  assert.throws(() => store.createDependencyDetectionFinding({
    ...findingInput,
    remediationExecuted: true
  }, actor), /dependency detection finding rejected execution claim remediationExecuted/);
  assert.throws(() => store.createDependencyDetectionFinding({
    ...findingInput,
    packageMutationExecuted: true
  }, actor), /dependency detection finding rejected execution claim packageMutationExecuted/);
  const finding = store.createDependencyDetectionFinding(findingInput, actor);
  assert.equal(finding.remediationExecuted, false);
  assert.equal(finding.packageMutationExecuted, false);

  assert.throws(() => store.createResourceRecord(resourceInput({
    materializationExecuted: true
  }), actor), /resource record rejected execution claim materializationExecuted/);
  assert.throws(() => store.createResourceRecord(resourceInput({
    productRepoWriteExecuted: true
  }), actor), /resource record rejected execution claim productRepoWriteExecuted/);
  const resource = store.createResourceRecord(resourceInput({
    materializationExecuted: undefined,
    productRepoWriteExecuted: undefined
  }), actor);
  assert.equal(resource.materializationExecuted, false);
  assert.equal(resource.productRepoWriteExecuted, false);
});

function governanceFixture() {
  const store = new AosStore(createDefaultSeed());
  const initiative = store.createInitiative({
    projectId: "TCRN-AOS",
    title: "Slice 7 governance foundation",
    status: "in_progress",
    problem: "Dependency and Resource Library posture needs deterministic local governance records.",
    expectedOutcome: "Reviewers can inspect obligations, blockers, requests, manifests, and findings without scanner ingestion or materialization."
  }, actor);
  const epic = store.createEpic({
    initiativeId: initiative.id,
    title: "Dependency and resource governance",
    goal: "Build local-first index readbacks for license and resource posture.",
    status: "in_progress"
  }, actor);
  const story = store.createStory({
    epicId: epic.id,
    title: "Index dependency and resource governance",
    problem: "Release views need unresolved obligations without claiming completion.",
    user: "security and evidence reviewer",
    expectedBehavior: "AOS records posture metadata, gates, evidence, and residual findings locally.",
    acceptanceCriteria: ["dependency lifecycle matrix", "resource audit matrix", "materialization requests remain gated", "no legal completion claims"],
    status: "in_progress",
    estimate,
    subTasks: []
  }, actor);
  const evidence = store.linkEvidence({
    type: "artifact_id",
    target: "slice-7-governance-index-proof",
    validity: "valid",
    producer: actor.employeeId,
    digest: "sha256:slice7",
    redactionState: "metadata_only"
  }, actor);
  const gate = store.requestGate({
    type: "security_license",
    linkedTicketId: story.id,
    inputEvidenceIds: [evidence.id]
  }, actor);
  const ownerGate = store.requestGate({
    type: "owner_intent",
    linkedTicketId: story.id,
    inputEvidenceIds: [evidence.id]
  }, actor);
  const releaseNote = store.createReleaseNote({
    id: createId("release_note", { storyId: story.id, releaseLabel: "slice-7-local" }),
    projectId: "TCRN-AOS",
    releaseLabel: "slice-7-local",
    linkedStoryIds: [story.id],
    userFacingSummary: "Dependency and Resource Library governance remain local metadata.",
    internalNotesSummary: "No scanner ingestion, materialization, or release readiness claim.",
    riskNotesSummary: "Legal completion and public readiness remain blocked until separate proof.",
    linkedEvidenceIds: [evidence.id],
    reviewState: "publish_blocked",
    gitExportAuthorized: false,
    releaseCloseoutClaimed: false
  }, actor);
  return { store, story, evidence, gate, ownerGate, releaseNote };
}

function resourceInput(overrides = {}) {
  return {
    type: "template",
    projectId: "TCRN-AOS",
    title: "Resource fixture",
    owner: "TCRN",
    source: "product-local",
    version: "1.0.0",
    digest: "sha256:resource-fixture",
    storageReference: "resource-fixture-metadata",
    classification: ["resource-library", "proof"],
    permissionState: "permission_required",
    attributionRequired: true,
    derivativeAllowed: false,
    reviewerRole: "security",
    residualRisk: "low",
    copyrightStatus: "review_required",
    lifecycleState: "proposed",
    approvalState: "review_required",
    linkedStoryIds: [],
    linkedReleaseNoteIds: [],
    linkedEvidenceIds: [],
    materializationAllowed: false,
    materializationExecuted: false,
    productRepoWriteExecuted: false,
    releaseBlocker: false,
    ...overrides
  };
}

function dependencyInput(overrides = {}) {
  return {
    projectId: "TCRN-AOS",
    ecosystem: "npm",
    packageName: "fixture-execution-claim",
    versionRange: "1.0.0",
    sourceSystem: "deterministic_fixture",
    projectUsage: "development",
    ownerRole: "security",
    lifecycleState: "unapproved",
    artifactRef: "package:fixture-execution-claim@1.0.0",
    licenseExpression: "MIT",
    declaredLicenseEvidence: "declared-execution-claim",
    discoveredLicenseEvidence: "discovered-execution-claim",
    evidenceArtifactRef: "evidence-execution-claim",
    evidenceStatus: "evidence_missing",
    confidence: "medium",
    policyClass: "unknown",
    reviewerRole: "security",
    residualRisk: "medium",
    nextAction: "request_review",
    sbomNoticeObligation: "review_required",
    posture: "review_required",
    approvalOwnerRole: "security",
    linkedStoryIds: [],
    linkedEvidenceIds: [],
    releaseBlocker: true,
    packageMutationExecuted: false,
    ...overrides
  };
}

function dependencyPostureForState(state) {
  if (state === "current" || state === "unapproved") {
    return "review_required";
  }
  if (state === "historical") {
    return "accepted_with_residual_risk";
  }
  if (state === "unused") {
    return "deprecated";
  }
  return state;
}
