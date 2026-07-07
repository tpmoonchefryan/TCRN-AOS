import test from "node:test";
import assert from "node:assert/strict";
import { AosStore, createDefaultSeed, createId } from "../../../dist/packages/domain/src/index.js";
import { McpGateway } from "../../../dist/packages/mcp-gateway/src/index.js";

const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "slice8-gateway-test"
};

const estimate = {
  effortPoints: 5,
  complexity: "high",
  risk: "L3",
  verificationCost: "high",
  confidence: "medium"
};

test("Slice 8 gateway records materialization control metadata and reads no-execution index", () => {
  const { gateway, evidenceId, ownerGateId, resource, replacementResource, request, manifest, previousManifest } = gatewayFixture();
  const history = gateway.handle({
    method: "aos.resource.materialization_history.record",
    actor,
    params: {
      projectId: "TCRN-AOS",
      resourceId: resource.id,
      materializationRequestId: request.id,
      manifestId: manifest.id,
      targetProjectId: "TCRN-AOS",
      targetReference: manifest.materializedCopyReference,
      resourceDigest: resource.digest,
      evidenceIds: [evidenceId],
      lifecycleState: "approved_metadata_only"
    },
    idempotencyKey: "slice8-history"
  });
  const duplicateHistory = gateway.handle({
    method: "aos.resource.materialization_history.record",
    actor,
    params: {
      projectId: "TCRN-AOS",
      resourceId: resource.id,
      materializationRequestId: request.id,
      manifestId: manifest.id,
      targetProjectId: "TCRN-AOS",
      targetReference: manifest.materializedCopyReference,
      resourceDigest: resource.digest,
      evidenceIds: [evidenceId],
      lifecycleState: "approved_metadata_only"
    },
    idempotencyKey: "slice8-history"
  });
  const update = gateway.handle({
    method: "aos.resource.update.request",
    actor,
    params: updateParams({ resource, manifest, evidenceId, ownerGateId })
  });
  const replacement = gateway.handle({
    method: "aos.resource.replacement.request",
    actor,
    params: replacementParams({ resource, replacementResource, evidenceId, ownerGateId })
  });
  const rollback = gateway.handle({
    method: "aos.resource.rollback.request",
    actor,
    params: rollbackParams({ resource, manifest, previousManifest, evidenceId, ownerGateId })
  });
  const plan = gateway.handle({
    method: "aos.resource.rollback_plan.record",
    actor,
    params: rollbackPlanParams({ rollbackRequestId: rollback.result.id, evidenceId })
  });
  const retirement = gateway.handle({
    method: "aos.resource.retirement.record",
    actor,
    params: retirementParams({ resource, manifest, evidenceId })
  });
  const cleanup = gateway.handle({
    method: "aos.resource.cleanup_readback.record",
    actor,
    params: cleanupParams({ manifest, evidenceId })
  });
  const index = gateway.handle({
    method: "aos.resource.materialization_control.read",
    actor,
    params: { projectId: "TCRN-AOS" }
  });

  assert.equal(history.ok, true);
  assert.equal(duplicateHistory.status, "deduped");
  assert.equal(update.ok, true);
  assert.equal(replacement.ok, true);
  assert.equal(rollback.ok, true);
  assert.equal(plan.ok, true);
  assert.equal(retirement.ok, true);
  assert.equal(cleanup.ok, true);
  assert.equal(index.status, "read");
  assert.deepEqual(index.result.historyRecordIds, [history.result.id]);
  assert.deepEqual(index.result.updateRequestIds, [update.result.id]);
  assert.deepEqual(index.result.replacementRequestIds, [replacement.result.id]);
  assert.deepEqual(index.result.rollbackRequestIds, [rollback.result.id]);
  assert.deepEqual(index.result.rollbackPlanIds, [plan.result.id]);
  assert.deepEqual(index.result.retirementRecordIds, [retirement.result.id]);
  assert.deepEqual(index.result.cleanupReadbackIds, [cleanup.result.id]);
  assert.equal(index.result.materializationExecuted, false);
  assert.equal(index.result.updateExecuted, false);
  assert.equal(index.result.replacementExecuted, false);
  assert.equal(index.result.rollbackExecuted, false);
  assert.equal(index.result.cleanupExecuted, false);
  assert.equal(index.result.deleteExecuted, false);
  assert.equal(index.result.resourceBinaryTransferred, false);
  assert.equal(index.result.productRepoWriteExecuted, false);
});

test("Slice 8 gateway blocks execution claims and restricted rollback payloads", () => {
  const { gateway, evidenceId, ownerGateId, resource, replacementResource, request, manifest, previousManifest } = gatewayFixture();
  const blockedHistory = gateway.handle({
    method: "aos.resource.materialization_history.record",
    actor,
    params: {
      projectId: "TCRN-AOS",
      resourceId: resource.id,
      materializationRequestId: request.id,
      manifestId: manifest.id,
      targetProjectId: "TCRN-AOS",
      targetReference: manifest.materializedCopyReference,
      resourceDigest: resource.digest,
      evidenceIds: [evidenceId],
      lifecycleState: "approved_metadata_only",
      resourceBinaryTransferred: true
    }
  });
  const blockedUpdate = gateway.handle({
    method: "aos.resource.update.request",
    actor,
    params: {
      ...updateParams({ resource, manifest, evidenceId, ownerGateId }),
      updateExecuted: true
    }
  });
  const blockedReplacement = gateway.handle({
    method: "aos.resource.replacement.request",
    actor,
    params: {
      ...replacementParams({ resource, replacementResource, evidenceId, ownerGateId }),
      productRepoWriteExecuted: true
    }
  });
  const blockedRollback = gateway.handle({
    method: "aos.resource.rollback.request",
    actor,
    params: {
      ...rollbackParams({ resource, manifest, previousManifest, evidenceId, ownerGateId }),
      rollbackExecuted: true
    }
  });
  const rollback = gateway.handle({
    method: "aos.resource.rollback.request",
    actor,
    params: rollbackParams({ resource, manifest, previousManifest, evidenceId, ownerGateId })
  });
  const syntheticLocalPath = "/" + "Users/example/rollback";
  const blockedPlan = gateway.handle({
    method: "aos.resource.rollback_plan.record",
    actor,
    params: {
      ...rollbackPlanParams({ rollbackRequestId: rollback.result.id, evidenceId }),
      fallbackPath: syntheticLocalPath
    }
  });
  const blockedCleanup = gateway.handle({
    method: "aos.resource.cleanup_readback.record",
    actor,
    params: {
      ...cleanupParams({ manifest, evidenceId }),
      deleteExecuted: true
    }
  });

  assert.equal(blockedHistory.ok, false);
  assert.match(blockedHistory.error, /resource materialization history rejected execution claim resourceBinaryTransferred/);
  assert.equal(blockedUpdate.ok, false);
  assert.match(blockedUpdate.error, /resource update request rejected execution claim updateExecuted/);
  assert.equal(blockedReplacement.ok, false);
  assert.match(blockedReplacement.error, /resource replacement request rejected execution claim productRepoWriteExecuted/);
  assert.equal(blockedRollback.ok, false);
  assert.match(blockedRollback.error, /resource rollback request rejected execution claim rollbackExecuted/);
  assert.equal(blockedPlan.ok, false);
  assert.match(blockedPlan.error, /restricted machine_local_absolute_path/);
  assert.equal(blockedCleanup.ok, false);
  assert.match(blockedCleanup.error, /resource cleanup readback rejected execution claim deleteExecuted/);
});

function gatewayFixture() {
  const store = new AosStore(createDefaultSeed());
  const gateway = new McpGateway(store);
  const initiative = store.createInitiative({
    projectId: "TCRN-AOS",
    title: "Slice 8 materialization gateway",
    status: "in_progress",
    problem: "Gateway methods need governed materialization control readbacks.",
    expectedOutcome: "Safe local methods write metadata control records and read no-execution indexes."
  }, actor);
  const epic = store.createEpic({
    initiativeId: initiative.id,
    title: "Materialization control MCP methods",
    goal: "Local no-execution materialization history contract",
    status: "in_progress"
  }, actor);
  const story = store.createStory({
    epicId: epic.id,
    title: "Prove materialization control gateway",
    problem: "AOS-S083 needs local metadata methods without resource execution.",
    user: "security owner",
    expectedBehavior: "Gateway accepts safe metadata, blocks restricted payloads, and exposes no-overclaim indexes.",
    acceptanceCriteria: ["authz", "dedupe", "redaction", "materialization control readback"],
    status: "in_progress",
    estimate,
    subTasks: []
  }, actor);
  const evidence = store.linkEvidence({
    type: "artifact_id",
    target: "slice-8-gateway-proof",
    validity: "valid",
    producer: actor.employeeId,
    digest: "sha256:slice8-gateway",
    redactionState: "metadata_only"
  }, actor);
  const ownerGate = store.requestGate({
    type: "owner_intent",
    linkedTicketId: story.id,
    inputEvidenceIds: [evidence.id]
  }, actor);
  const resource = store.createResourceRecord(resourceInput({
    title: "Gateway source resource",
    lifecycleState: "approved",
    approvalState: "accepted_with_residual_risk",
    permissionState: "permitted",
    linkedStoryIds: [story.id],
    linkedEvidenceIds: [evidence.id]
  }), actor);
  const replacementResource = store.createResourceRecord(resourceInput({
    title: "Gateway replacement resource",
    version: "1.1.0",
    digest: "sha256:gateway-resource-replacement",
    storageReference: "gateway-resource-replacement-metadata",
    linkedStoryIds: [story.id],
    linkedEvidenceIds: [evidence.id]
  }), actor);
  const request = store.createResourceMaterializationRequest({
    projectId: "TCRN-AOS",
    resourceId: resource.id,
    targetProjectId: "TCRN-AOS",
    requestedBy: actor,
    requestedPurpose: "Metadata-only gateway control proof.",
    status: "gate_required",
    linkedGateId: ownerGate.id,
    evidenceIds: [evidence.id]
  }, actor);
  const previousManifest = store.createProjectResourceManifest({
    projectId: "TCRN-AOS",
    resourceId: resource.id,
    resourceDigest: "sha256:gateway-resource-v0",
    materializedCopyReference: "manifest-only:gateway-previous-template",
    status: "stale_version",
    linkedStoryIds: [story.id],
    linkedReleaseNoteIds: [],
    linkedEvidenceIds: [evidence.id]
  }, actor);
  const manifest = store.createProjectResourceManifest({
    projectId: "TCRN-AOS",
    resourceId: resource.id,
    resourceDigest: resource.digest,
    materializedCopyReference: "manifest-only:gateway-approved-template",
    status: "approved_lineage_record",
    linkedStoryIds: [story.id],
    linkedReleaseNoteIds: [],
    linkedEvidenceIds: [evidence.id]
  }, actor);
  return {
    gateway,
    evidenceId: evidence.id,
    ownerGateId: ownerGate.id,
    resource,
    replacementResource,
    request,
    manifest,
    previousManifest
  };
}

function updateParams({ resource, manifest, evidenceId, ownerGateId }) {
  return {
    projectId: "TCRN-AOS",
    resourceId: resource.id,
    manifestId: manifest.id,
    currentResourceVersion: resource.version,
    currentResourceDigest: resource.digest,
    proposedResourceVersion: "1.1.0",
    proposedResourceDigest: "sha256:gateway-resource-v1-1",
    status: "owner_intent_required",
    linkedGateId: ownerGateId,
    evidenceIds: [evidenceId]
  };
}

function replacementParams({ resource, replacementResource, evidenceId, ownerGateId }) {
  return {
    projectId: "TCRN-AOS",
    oldResourceId: resource.id,
    replacementResourceId: replacementResource.id,
    reason: "Metadata-only replacement control record.",
    copyrightStatus: "review_required",
    licensePosture: "review_required",
    residualRisk: "medium",
    status: "owner_intent_required",
    linkedGateIds: [ownerGateId],
    evidenceIds: [evidenceId]
  };
}

function rollbackParams({ resource, manifest, previousManifest, evidenceId, ownerGateId }) {
  return {
    projectId: "TCRN-AOS",
    resourceId: resource.id,
    manifestId: manifest.id,
    intendedPreviousManifestId: previousManifest.id,
    intendedPreviousDigest: previousManifest.resourceDigest,
    intendedPreviousReference: previousManifest.materializedCopyReference,
    reason: "Metadata-only rollback control.",
    status: "owner_intent_required",
    requiredGateId: ownerGateId,
    evidenceIds: [evidenceId]
  };
}

function rollbackPlanParams({ rollbackRequestId, evidenceId }) {
  return {
    projectId: "TCRN-AOS",
    rollbackRequestId,
    fallbackPath: "manifest-only:gateway-previous-template",
    expectedNoExecutionResult: "No rollback execution occurs in Slice 8.",
    readbackCommand: "aos.resource.materialization_control.read",
    evidenceIds: [evidenceId]
  };
}

function retirementParams({ resource, manifest, evidenceId }) {
  return {
    projectId: "TCRN-AOS",
    resourceId: resource.id,
    manifestId: manifest.id,
    reason: "Metadata-only retirement record.",
    lifecycleState: "superseded",
    status: "recorded",
    evidenceIds: [evidenceId],
    cleanupRequired: true
  };
}

function cleanupParams({ manifest, evidenceId }) {
  return {
    projectId: "TCRN-AOS",
    targetType: "materialized_copy",
    targetId: manifest.id,
    cleanupNeeded: true,
    cleanupReason: "Future cleanup requires a separate Owner Intent route.",
    status: "blocked",
    evidenceIds: [evidenceId]
  };
}

function resourceInput(overrides = {}) {
  return {
    type: "template",
    projectId: "TCRN-AOS",
    title: "Gateway resource fixture",
    owner: "TCRN",
    source: "product-local",
    version: "1.0.0",
    digest: "sha256:gateway-resource-fixture",
    storageReference: "gateway-resource-fixture-metadata",
    classification: ["resource-library", "slice8-gateway-proof"],
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
