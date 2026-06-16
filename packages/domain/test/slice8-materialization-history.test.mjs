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
  sessionId: "slice8-domain-test"
};

const estimate = {
  effortPoints: 5,
  complexity: "high",
  risk: "L3",
  verificationCost: "high",
  confidence: "medium"
};

test("Slice 8 materialization control records index history, update, rollback, replacement, retirement, and cleanup posture", () => {
  const {
    store,
    story,
    evidence,
    ownerGate,
    resource,
    replacementResource,
    request,
    manifest,
    previousManifest
  } = slice8Fixture();

  const history = store.createResourceMaterializationHistory({
    projectId: "TCRN-AOS",
    resourceId: resource.id,
    materializationRequestId: request.id,
    manifestId: manifest.id,
    targetProjectId: "TCRN-AOS",
    targetReference: manifest.materializedCopyReference,
    resourceDigest: resource.digest,
    actor,
    evidenceIds: [evidence.id],
    lifecycleState: "approved_metadata_only"
  }, actor);
  const updateRequest = store.createResourceUpdateRequest({
    projectId: "TCRN-AOS",
    resourceId: resource.id,
    manifestId: manifest.id,
    currentResourceVersion: resource.version,
    currentResourceDigest: resource.digest,
    proposedResourceVersion: "1.1.0",
    proposedResourceDigest: "sha256:resource-v1-1",
    status: "owner_intent_required",
    linkedGateId: ownerGate.id,
    evidenceIds: [evidence.id]
  }, actor);
  const replacementRequest = store.createResourceReplacementRequest({
    projectId: "TCRN-AOS",
    oldResourceId: resource.id,
    replacementResourceId: replacementResource.id,
    reason: "Metadata-only replacement control record for a revoked upstream asset.",
    copyrightStatus: "review_required",
    licensePosture: "review_required",
    residualRisk: "medium",
    status: "owner_intent_required",
    linkedGateIds: [ownerGate.id],
    evidenceIds: [evidence.id]
  }, actor);
  const rollbackRequest = store.createResourceRollbackRequest({
    projectId: "TCRN-AOS",
    resourceId: resource.id,
    manifestId: manifest.id,
    intendedPreviousManifestId: previousManifest.id,
    intendedPreviousDigest: previousManifest.resourceDigest,
    intendedPreviousReference: previousManifest.materializedCopyReference,
    reason: "Metadata-only rollback control; execution needs a later Owner Intent route.",
    status: "owner_intent_required",
    requiredGateId: ownerGate.id,
    evidenceIds: [evidence.id]
  }, actor);
  const rollbackPlan = store.createResourceRollbackPlan({
    projectId: "TCRN-AOS",
    rollbackRequestId: rollbackRequest.id,
    fallbackPath: "manifest-only:previous-local-template",
    expectedNoExecutionResult: "Rollback plan remains a control record; no file copy, delete, or product repo write is executed.",
    readbackCommand: "aos.resource.materialization_control.read",
    evidenceIds: [evidence.id]
  }, actor);
  const retirement = store.createResourceRetirementRecord({
    projectId: "TCRN-AOS",
    resourceId: resource.id,
    manifestId: manifest.id,
    reason: "Superseded metadata lineage should be retained until an Owner Intent cleanup route exists.",
    lifecycleState: "superseded",
    status: "recorded",
    evidenceIds: [evidence.id],
    cleanupRequired: true
  }, actor);
  const cleanup = store.createResourceCleanupReadback({
    projectId: "TCRN-AOS",
    targetType: "materialized_copy",
    targetId: manifest.id,
    cleanupNeeded: true,
    cleanupReason: "Future cleanup would require separate Owner Intent execution authority.",
    status: "blocked",
    evidenceIds: [evidence.id]
  }, actor);

  const index = store.createResourceMaterializationControlIndex("TCRN-AOS");
  assert.deepEqual(index.historyRecordIds, [history.id]);
  assert.deepEqual(index.updateRequestIds, [updateRequest.id]);
  assert.deepEqual(index.replacementRequestIds, [replacementRequest.id]);
  assert.deepEqual(index.rollbackRequestIds, [rollbackRequest.id]);
  assert.deepEqual(index.rollbackPlanIds, [rollbackPlan.id]);
  assert.deepEqual(index.retirementRecordIds, [retirement.id]);
  assert.deepEqual(index.cleanupReadbackIds, [cleanup.id]);
  assert.ok(index.unresolvedUpdateIds.includes(updateRequest.id));
  assert.ok(index.unresolvedReplacementIds.includes(replacementRequest.id));
  assert.ok(index.unresolvedRollbackIds.includes(rollbackRequest.id));
  assert.ok(index.cleanupBlockerIds.includes(retirement.id));
  assert.ok(index.cleanupBlockerIds.includes(cleanup.id));
  assert.ok(index.linkedGateIds.includes(ownerGate.id));
  assert.ok(index.linkedEvidenceIds.includes(evidence.id));
  assert.equal(index.localFirstStorage, true);
  assert.equal(index.materializationExecuted, false);
  assert.equal(index.updateExecuted, false);
  assert.equal(index.replacementExecuted, false);
  assert.equal(index.rollbackExecuted, false);
  assert.equal(index.cleanupExecuted, false);
  assert.equal(index.deleteExecuted, false);
  assert.equal(index.resourceBinaryTransferred, false);
  assert.equal(index.productRepoWriteExecuted, false);
  assert.equal(index.legalCompletionClaimed, false);
  assert.equal(index.publicReadinessClaimed, false);
  assert.equal(index.releaseReadinessClaimed, false);
  assert.equal(history.materializationExecuted, false);
  assert.equal(history.resourceBinaryTransferred, false);
  assert.equal(updateRequest.updateExecuted, false);
  assert.equal(replacementRequest.replacementExecuted, false);
  assert.equal(rollbackRequest.rollbackExecuted, false);
  assert.equal(rollbackPlan.rollbackExecuted, false);
  assert.equal(retirement.retirementCleanupExecuted, false);
  assert.equal(cleanup.cleanupExecuted, false);

  const auditActions = store.queryAudit().map((event) => event.action);
  for (const action of [
    "resource.materialization_history.record",
    "resource.update.request",
    "resource.replacement.request",
    "resource.rollback.request",
    "resource.rollback_plan.record",
    "resource.retirement.record",
    "resource.cleanup_readback.record"
  ]) {
    assert.ok(auditActions.includes(action), `${action} audit event missing`);
  }
  assert.ok(story.id);
});

test("Slice 8 materialization control records fail closed on execution, transfer, write, rollback, delete, and cleanup claims", () => {
  const { store, evidence, ownerGate, resource, replacementResource, request, manifest, previousManifest } = slice8Fixture();

  assert.throws(() => store.createResourceMaterializationHistory({
    ...historyInput({ resource, request, manifest, evidence }),
    materializationExecuted: true
  }, actor), /resource materialization history rejected execution claim materializationExecuted/);
  assert.throws(() => store.createResourceMaterializationHistory({
    ...historyInput({ resource, request, manifest, evidence }),
    resourceBinaryTransferred: true
  }, actor), /resource materialization history rejected execution claim resourceBinaryTransferred/);
  assert.throws(() => store.createResourceUpdateRequest({
    ...updateInput({ resource, manifest, evidence, ownerGate }),
    updateExecuted: true
  }, actor), /resource update request rejected execution claim updateExecuted/);
  assert.throws(() => store.createResourceReplacementRequest({
    ...replacementInput({ resource, replacementResource, evidence, ownerGate }),
    replacementExecuted: true
  }, actor), /resource replacement request rejected execution claim replacementExecuted/);
  assert.throws(() => store.createResourceRollbackRequest({
    ...rollbackInput({ resource, manifest, previousManifest, evidence, ownerGate }),
    rollbackExecuted: true
  }, actor), /resource rollback request rejected execution claim rollbackExecuted/);
  const rollbackRequest = store.createResourceRollbackRequest(rollbackInput({ resource, manifest, previousManifest, evidence, ownerGate }), actor);
  assert.throws(() => store.createResourceRollbackPlan({
    ...rollbackPlanInput({ rollbackRequest, evidence }),
    cleanupExecuted: true
  }, actor), /resource rollback plan rejected execution claim cleanupExecuted/);
  assert.throws(() => store.createResourceRetirementRecord({
    ...retirementInput({ resource, manifest, evidence }),
    productRepoDeleteExecuted: true
  }, actor), /resource retirement record rejected execution claim productRepoDeleteExecuted/);
  assert.throws(() => store.createResourceCleanupReadback({
    ...cleanupInput({ manifest, evidence }),
    deleteExecuted: true
  }, actor), /resource cleanup readback rejected execution claim deleteExecuted/);
});

test("Slice 8 materialization controls reject restricted local path payloads before storage", () => {
  const { store, evidence, ownerGate, resource, manifest, previousManifest } = slice8Fixture();
  const rollbackRequest = store.createResourceRollbackRequest(rollbackInput({ resource, manifest, previousManifest, evidence, ownerGate }), actor);
  const syntheticLocalPath = "/" + "Users/example/resource-rollback";
  assert.throws(() => store.createResourceRollbackPlan({
    ...rollbackPlanInput({ rollbackRequest, evidence }),
    fallbackPath: syntheticLocalPath
  }, actor), /restricted machine_local_absolute_path/);
});

function slice8Fixture() {
  const store = new AosStore(createDefaultSeed());
  const initiative = store.createInitiative({
    projectId: "TCRN-AOS",
    title: "Slice 8 materialization history controls",
    status: "in_progress",
    problem: "Resource materialization history and rollback records need local control-plane proof.",
    expectedOutcome: "Reviewers can inspect update, replacement, rollback, retirement, and cleanup posture without execution."
  }, actor);
  const epic = store.createEpic({
    initiativeId: initiative.id,
    title: "Resource materialization control records",
    goal: "Build local-first no-execution history and rollback readbacks.",
    status: "in_progress"
  }, actor);
  const story = store.createStory({
    epicId: epic.id,
    title: "Prove materialization history and rollback controls",
    problem: "AOS-S083 needs deterministic control records without binary transfer or product repo writes.",
    user: "security and evidence reviewer",
    expectedBehavior: "AOS records history/update/replacement/rollback/retirement/cleanup posture locally.",
    acceptanceCriteria: ["materialization history matrix", "rollback control readback", "no execution claims"],
    status: "in_progress",
    estimate,
    subTasks: []
  }, actor);
  const evidence = store.linkEvidence({
    type: "artifact_id",
    target: "slice-8-materialization-control-proof",
    validity: "valid",
    producer: actor.employeeId,
    digest: "sha256:slice8",
    redactionState: "metadata_only"
  }, actor);
  const ownerGate = store.requestGate({
    type: "owner_intent",
    linkedTicketId: story.id,
    inputEvidenceIds: [evidence.id]
  }, actor);
  const resource = store.createResourceRecord(resourceInput({
    title: "Approved metadata resource",
    lifecycleState: "approved",
    approvalState: "accepted_with_residual_risk",
    permissionState: "permitted",
    linkedStoryIds: [story.id],
    linkedEvidenceIds: [evidence.id]
  }), actor);
  const replacementResource = store.createResourceRecord(resourceInput({
    title: "Replacement metadata resource",
    version: "1.1.0",
    digest: "sha256:resource-replacement",
    storageReference: "resource-fixture-replacement-metadata",
    lifecycleState: "proposed",
    approvalState: "review_required",
    linkedStoryIds: [story.id],
    linkedEvidenceIds: [evidence.id]
  }), actor);
  const request = store.createResourceMaterializationRequest({
    projectId: "TCRN-AOS",
    resourceId: resource.id,
    targetProjectId: "TCRN-AOS",
    requestedBy: actor,
    requestedPurpose: "Metadata-only materialization control proof.",
    status: "gate_required",
    linkedGateId: ownerGate.id,
    evidenceIds: [evidence.id]
  }, actor);
  const previousManifest = store.createProjectResourceManifest({
    projectId: "TCRN-AOS",
    resourceId: resource.id,
    resourceDigest: "sha256:resource-v0",
    materializedCopyReference: "manifest-only:previous-local-template",
    status: "stale_version",
    linkedStoryIds: [story.id],
    linkedReleaseNoteIds: [],
    linkedEvidenceIds: [evidence.id]
  }, actor);
  const manifest = store.createProjectResourceManifest({
    projectId: "TCRN-AOS",
    resourceId: resource.id,
    resourceDigest: resource.digest,
    materializedCopyReference: "manifest-only:approved-local-template",
    status: "approved_lineage_record",
    linkedStoryIds: [story.id],
    linkedReleaseNoteIds: [],
    linkedEvidenceIds: [evidence.id]
  }, actor);
  return { store, story, evidence, ownerGate, resource, replacementResource, request, manifest, previousManifest };
}

function historyInput({ resource, request, manifest, evidence }) {
  return {
    projectId: "TCRN-AOS",
    resourceId: resource.id,
    materializationRequestId: request.id,
    manifestId: manifest.id,
    targetProjectId: "TCRN-AOS",
    targetReference: manifest.materializedCopyReference,
    resourceDigest: resource.digest,
    actor,
    evidenceIds: [evidence.id],
    lifecycleState: "approved_metadata_only"
  };
}

function updateInput({ resource, manifest, evidence, ownerGate }) {
  return {
    projectId: "TCRN-AOS",
    resourceId: resource.id,
    manifestId: manifest.id,
    currentResourceVersion: resource.version,
    currentResourceDigest: resource.digest,
    proposedResourceVersion: "1.1.0",
    proposedResourceDigest: "sha256:resource-v1-1",
    status: "owner_intent_required",
    linkedGateId: ownerGate.id,
    evidenceIds: [evidence.id]
  };
}

function replacementInput({ resource, replacementResource, evidence, ownerGate }) {
  return {
    projectId: "TCRN-AOS",
    oldResourceId: resource.id,
    replacementResourceId: replacementResource.id,
    reason: "Metadata-only replacement control record.",
    copyrightStatus: "review_required",
    licensePosture: "review_required",
    residualRisk: "medium",
    status: "owner_intent_required",
    linkedGateIds: [ownerGate.id],
    evidenceIds: [evidence.id]
  };
}

function rollbackInput({ resource, manifest, previousManifest, evidence, ownerGate }) {
  return {
    projectId: "TCRN-AOS",
    resourceId: resource.id,
    manifestId: manifest.id,
    intendedPreviousManifestId: previousManifest.id,
    intendedPreviousDigest: previousManifest.resourceDigest,
    intendedPreviousReference: previousManifest.materializedCopyReference,
    reason: "Metadata-only rollback control.",
    status: "owner_intent_required",
    requiredGateId: ownerGate.id,
    evidenceIds: [evidence.id]
  };
}

function rollbackPlanInput({ rollbackRequest, evidence }) {
  return {
    projectId: "TCRN-AOS",
    rollbackRequestId: rollbackRequest.id,
    fallbackPath: "manifest-only:previous-local-template",
    expectedNoExecutionResult: "No rollback execution occurs in Slice 8.",
    readbackCommand: "aos.resource.materialization_control.read",
    evidenceIds: [evidence.id]
  };
}

function retirementInput({ resource, manifest, evidence }) {
  return {
    projectId: "TCRN-AOS",
    resourceId: resource.id,
    manifestId: manifest.id,
    reason: "Metadata-only retirement record.",
    lifecycleState: "superseded",
    status: "recorded",
    evidenceIds: [evidence.id],
    cleanupRequired: true
  };
}

function cleanupInput({ manifest, evidence }) {
  return {
    projectId: "TCRN-AOS",
    targetType: "materialized_copy",
    targetId: manifest.id,
    cleanupNeeded: true,
    cleanupReason: "Future cleanup requires a separate Owner Intent route.",
    status: "blocked",
    evidenceIds: [evidence.id]
  };
}

function resourceInput(overrides = {}) {
  return {
    type: "template",
    projectId: "TCRN-AOS",
    title: "Slice 8 resource fixture",
    owner: "TCRN",
    source: "product-local",
    version: "1.0.0",
    digest: "sha256:resource-fixture",
    storageReference: "resource-fixture-metadata",
    classification: ["resource-library", "slice8-proof"],
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
