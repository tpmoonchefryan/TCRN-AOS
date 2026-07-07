import {
  AosStore,
  createDefaultSeed,
  createId
} from "../dist/packages/domain/src/index.js";
import { McpGateway } from "../dist/packages/mcp-gateway/src/index.js";

const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "slice8-proof"
};

const controlProof = proveMaterializationControlRecords();
const gatewayProof = proveGatewayMaterializationControlMethods();
const restrictedPayloadProof = proveRestrictedPayloadRejected();
const executionClaimProof = proveExecutionClaimsFailClosed();

const ok = controlProof.ok
  && gatewayProof.ok
  && restrictedPayloadProof.ok
  && executionClaimProof.ok;

console.log(JSON.stringify({
  ok,
  controlProof,
  gatewayProof,
  restrictedPayloadProof,
  executionClaimProof,
  d024Boundary: {
    localFirstStorage: true,
    runtimeOperationalDataCommittedToGit: false,
    gitTracksOnlySourceSchemasFixturesTestsScriptsDocsEvidence: true,
    resourceBinaryMaterializationExecuted: false,
    productRepoResourceWriteExecuted: false,
    cleanupDeleteExecuted: false
  },
  noOverclaim: {
    dependencyCleanClaimed: false,
    legalCompletionClaimed: false,
    publicReadinessClaimed: false,
    releaseReadinessClaimed: false,
    scannerIngestionExecuted: false,
    resourceMaterializationExecuted: false,
    updateExecuted: false,
    replacementExecuted: false,
    rollbackExecuted: false,
    cleanupExecuted: false,
    liveCodexDispatch: false,
    productAcceptance: false,
    finalMvpAcceptance: false,
    selenePublication: false
  },
  productDesignStatus: {
    visibleUiChanged: false,
    finalUxLayoutVisualAcceptance: false,
    browserAcceptanceCloseout: false
  }
}, null, 2));

if (!ok) {
  process.exit(1);
}

function proveMaterializationControlRecords() {
  const scenario = createScenario("control_records");
  const records = createControlRecords(scenario);
  const index = scenario.store.createResourceMaterializationControlIndex("TCRN-AOS");
  const auditActions = scenario.store.queryAudit().map((event) => event.action);
  const requiredActions = [
    "resource.materialization_history.record",
    "resource.update.request",
    "resource.replacement.request",
    "resource.rollback.request",
    "resource.rollback_plan.record",
    "resource.retirement.record",
    "resource.cleanup_readback.record"
  ];
  return {
    scenario: "materialization_history_update_rollback_control_records",
    ok: index.historyRecordIds.length === 1
      && index.updateRequestIds.length === 1
      && index.replacementRequestIds.length === 1
      && index.rollbackRequestIds.length === 1
      && index.rollbackPlanIds.length === 1
      && index.retirementRecordIds.length === 1
      && index.cleanupReadbackIds.length === 1
      && index.unresolvedUpdateIds.includes(records.update.id)
      && index.unresolvedReplacementIds.includes(records.replacement.id)
      && index.unresolvedRollbackIds.includes(records.rollback.id)
      && index.cleanupBlockerIds.includes(records.retirement.id)
      && index.cleanupBlockerIds.includes(records.cleanup.id)
      && requiredActions.every((action) => auditActions.includes(action))
      && allNoExecution(index)
      && records.history.materializationExecuted === false
      && records.history.resourceBinaryTransferred === false
      && records.update.updateExecuted === false
      && records.replacement.replacementExecuted === false
      && records.rollback.rollbackExecuted === false
      && records.rollbackPlan.rollbackExecuted === false
      && records.retirement.retirementCleanupExecuted === false
      && records.cleanup.cleanupExecuted === false,
    counts: {
      history: index.historyRecordIds.length,
      updates: index.updateRequestIds.length,
      replacements: index.replacementRequestIds.length,
      rollbacks: index.rollbackRequestIds.length,
      rollbackPlans: index.rollbackPlanIds.length,
      retirements: index.retirementRecordIds.length,
      cleanupReadbacks: index.cleanupReadbackIds.length,
      cleanupBlockers: index.cleanupBlockerIds.length,
      linkedGates: index.linkedGateIds.length,
      linkedEvidence: index.linkedEvidenceIds.length
    },
    noExecutionClaims: noExecutionSummary(index)
  };
}

function proveGatewayMaterializationControlMethods() {
  const scenario = createScenario("gateway_control");
  const gateway = new McpGateway(scenario.store);
  const history = gateway.handle({
    method: "aos.resource.materialization_history.record",
    actor,
    params: historyInput(scenario),
    idempotencyKey: "slice8-proof-history"
  });
  const duplicateHistory = gateway.handle({
    method: "aos.resource.materialization_history.record",
    actor,
    params: historyInput(scenario),
    idempotencyKey: "slice8-proof-history"
  });
  const update = gateway.handle({
    method: "aos.resource.update.request",
    actor,
    params: updateInput(scenario)
  });
  const replacement = gateway.handle({
    method: "aos.resource.replacement.request",
    actor,
    params: replacementInput(scenario)
  });
  const rollback = gateway.handle({
    method: "aos.resource.rollback.request",
    actor,
    params: rollbackInput(scenario)
  });
  const rollbackPlan = gateway.handle({
    method: "aos.resource.rollback_plan.record",
    actor,
    params: rollbackPlanInput({ ...scenario, rollbackRequestId: rollback.result.id })
  });
  const retirement = gateway.handle({
    method: "aos.resource.retirement.record",
    actor,
    params: retirementInput(scenario)
  });
  const cleanup = gateway.handle({
    method: "aos.resource.cleanup_readback.record",
    actor,
    params: cleanupInput(scenario)
  });
  const index = gateway.handle({
    method: "aos.resource.materialization_control.read",
    actor,
    params: { projectId: "TCRN-AOS" }
  });
  return {
    scenario: "mcp_gateway_materialization_control_methods",
    ok: history.ok
      && duplicateHistory.status === "deduped"
      && update.ok
      && replacement.ok
      && rollback.ok
      && rollbackPlan.ok
      && retirement.ok
      && cleanup.ok
      && index.status === "read"
      && allNoExecution(index.result),
    statuses: {
      history: history.status,
      duplicateHistory: duplicateHistory.status,
      update: update.status,
      replacement: replacement.status,
      rollback: rollback.status,
      rollbackPlan: rollbackPlan.status,
      retirement: retirement.status,
      cleanup: cleanup.status,
      index: index.status
    },
    indexCounts: index.ok ? {
      history: index.result.historyRecordIds.length,
      updates: index.result.updateRequestIds.length,
      replacements: index.result.replacementRequestIds.length,
      rollbacks: index.result.rollbackRequestIds.length,
      cleanupBlockers: index.result.cleanupBlockerIds.length
    } : {}
  };
}

function proveRestrictedPayloadRejected() {
  const scenario = createScenario("restricted_payload");
  const rollback = scenario.store.createResourceRollbackRequest(rollbackInput(scenario), actor);
  const syntheticLocalPath = "/" + "Users/example/slice8-rollback";
  const result = expectRejected(
    () => scenario.store.createResourceRollbackPlan({
      ...rollbackPlanInput({ ...scenario, rollbackRequestId: rollback.id }),
      fallbackPath: syntheticLocalPath
    }, actor),
    /machine_local_absolute_path/
  );
  return {
    scenario: "restricted_materialization_control_payload_rejected",
    ok: result.ok,
    rejected: result.ok,
    reasonKind: result.ok ? "machine_local_absolute_path" : "other"
  };
}

function proveExecutionClaimsFailClosed() {
  const scenario = createScenario("execution_claims");
  const rollback = scenario.store.createResourceRollbackRequest(rollbackInput(scenario), actor);
  const checks = [
    expectRejected(
      () => scenario.store.createResourceMaterializationHistory({ ...historyInput(scenario), materializationExecuted: true }, actor),
      /materializationExecuted/
    ),
    expectRejected(
      () => scenario.store.createResourceUpdateRequest({ ...updateInput(scenario), updateExecuted: true }, actor),
      /updateExecuted/
    ),
    expectRejected(
      () => scenario.store.createResourceReplacementRequest({ ...replacementInput(scenario), replacementExecuted: true }, actor),
      /replacementExecuted/
    ),
    expectRejected(
      () => scenario.store.createResourceRollbackRequest({ ...rollbackInput(scenario), rollbackExecuted: true }, actor),
      /rollbackExecuted/
    ),
    expectRejected(
      () => scenario.store.createResourceRollbackPlan({ ...rollbackPlanInput({ ...scenario, rollbackRequestId: rollback.id }), cleanupExecuted: true }, actor),
      /cleanupExecuted/
    ),
    expectRejected(
      () => scenario.store.createResourceRetirementRecord({ ...retirementInput(scenario), productRepoDeleteExecuted: true }, actor),
      /productRepoDeleteExecuted/
    ),
    expectRejected(
      () => scenario.store.createResourceCleanupReadback({ ...cleanupInput(scenario), deleteExecuted: true }, actor),
      /deleteExecuted/
    )
  ];
  const gateway = new McpGateway(scenario.store);
  const gatewayRollback = gateway.handle({
    method: "aos.resource.rollback.request",
    actor,
    params: {
      ...rollbackInput(scenario),
      productRepoWriteExecuted: true
    }
  });
  return {
    scenario: "execution_claim_booleans_fail_closed",
    ok: checks.every((check) => check.ok)
      && gatewayRollback.ok === false
      && /productRepoWriteExecuted/.test(gatewayRollback.error ?? ""),
    rejectedClaimCount: checks.filter((check) => check.ok).length + (gatewayRollback.ok === false ? 1 : 0),
    rejectedClaimFields: [
      "materializationExecuted",
      "updateExecuted",
      "replacementExecuted",
      "rollbackExecuted",
      "cleanupExecuted",
      "productRepoDeleteExecuted",
      "deleteExecuted",
      "productRepoWriteExecuted"
    ],
    gatewayStatus: gatewayRollback.status
  };
}

function createControlRecords(scenario) {
  const history = scenario.store.createResourceMaterializationHistory(historyInput(scenario), actor);
  const update = scenario.store.createResourceUpdateRequest(updateInput(scenario), actor);
  const replacement = scenario.store.createResourceReplacementRequest(replacementInput(scenario), actor);
  const rollback = scenario.store.createResourceRollbackRequest(rollbackInput(scenario), actor);
  const rollbackPlan = scenario.store.createResourceRollbackPlan(rollbackPlanInput({ ...scenario, rollbackRequestId: rollback.id }), actor);
  const retirement = scenario.store.createResourceRetirementRecord(retirementInput(scenario), actor);
  const cleanup = scenario.store.createResourceCleanupReadback(cleanupInput(scenario), actor);
  return { history, update, replacement, rollback, rollbackPlan, retirement, cleanup };
}

function createScenario(label) {
  const store = new AosStore(createDefaultSeed());
  const initiative = store.createInitiative({
    projectId: "TCRN-AOS",
    title: `Slice 8 ${label}`,
    status: "in_progress",
    problem: "Resource materialization history and rollback controls need deterministic local proof.",
    expectedOutcome: "Local control records expose history, update, replacement, rollback, retirement, and cleanup posture without executing resource operations."
  }, actor);
  const epic = store.createEpic({
    initiativeId: initiative.id,
    title: "Resource materialization controls",
    goal: "Local-first no-execution materialization control readback",
    status: "in_progress"
  }, actor);
  const story = store.createStory({
    epicId: epic.id,
    title: "Prove Slice 8 materialization controls",
    problem: "Reviewers need deterministic AOS-S083 readbacks without binary transfer or product repo writes.",
    user: "security and evidence reviewer",
    expectedBehavior: "AOS stores metadata control records and no-overclaim index readbacks locally.",
    acceptanceCriteria: ["materialization history", "rollback plan", "no execution claims"],
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
  const evidence = store.linkEvidence({
    type: "artifact_id",
    target: `slice-8-${label}-proof`,
    validity: "valid",
    producer: actor.employeeId,
    digest: `sha256:slice8-${label}`,
    redactionState: "metadata_only"
  }, actor);
  const ownerGate = store.requestGate({
    type: "owner_intent",
    linkedTicketId: story.id,
    inputEvidenceIds: [evidence.id]
  }, actor);
  const resource = store.createResourceRecord(resourceInput({
    title: "Slice 8 source resource",
    lifecycleState: "approved",
    approvalState: "accepted_with_residual_risk",
    permissionState: "permitted",
    linkedStoryIds: [story.id],
    linkedEvidenceIds: [evidence.id]
  }), actor);
  const replacementResource = store.createResourceRecord(resourceInput({
    title: "Slice 8 replacement resource",
    version: "1.1.0",
    digest: "sha256:slice8-replacement-resource",
    storageReference: "slice8-replacement-resource-metadata",
    linkedStoryIds: [story.id],
    linkedEvidenceIds: [evidence.id]
  }), actor);
  const request = store.createResourceMaterializationRequest({
    projectId: "TCRN-AOS",
    resourceId: resource.id,
    targetProjectId: "TCRN-AOS",
    requestedBy: actor,
    requestedPurpose: "Metadata-only Slice 8 materialization control proof.",
    status: "gate_required",
    linkedGateId: ownerGate.id,
    evidenceIds: [evidence.id]
  }, actor);
  const previousManifest = store.createProjectResourceManifest({
    projectId: "TCRN-AOS",
    resourceId: resource.id,
    resourceDigest: "sha256:slice8-resource-v0",
    materializedCopyReference: "manifest-only:slice8-previous-resource",
    status: "stale_version",
    linkedStoryIds: [story.id],
    linkedReleaseNoteIds: [],
    linkedEvidenceIds: [evidence.id]
  }, actor);
  const manifest = store.createProjectResourceManifest({
    projectId: "TCRN-AOS",
    resourceId: resource.id,
    resourceDigest: resource.digest,
    materializedCopyReference: "manifest-only:slice8-current-resource",
    status: "approved_lineage_record",
    linkedStoryIds: [story.id],
    linkedReleaseNoteIds: [],
    linkedEvidenceIds: [evidence.id]
  }, actor);
  return { store, story, evidence, ownerGate, resource, replacementResource, request, manifest, previousManifest };
}

function historyInput(scenario) {
  return {
    projectId: "TCRN-AOS",
    resourceId: scenario.resource.id,
    materializationRequestId: scenario.request.id,
    manifestId: scenario.manifest.id,
    targetProjectId: "TCRN-AOS",
    targetReference: scenario.manifest.materializedCopyReference,
    resourceDigest: scenario.resource.digest,
    actor,
    evidenceIds: [scenario.evidence.id],
    lifecycleState: "approved_metadata_only"
  };
}

function updateInput(scenario) {
  return {
    projectId: "TCRN-AOS",
    resourceId: scenario.resource.id,
    manifestId: scenario.manifest.id,
    currentResourceVersion: scenario.resource.version,
    currentResourceDigest: scenario.resource.digest,
    proposedResourceVersion: "1.1.0",
    proposedResourceDigest: "sha256:slice8-resource-v1-1",
    status: "owner_intent_required",
    linkedGateId: scenario.ownerGate.id,
    evidenceIds: [scenario.evidence.id]
  };
}

function replacementInput(scenario) {
  return {
    projectId: "TCRN-AOS",
    oldResourceId: scenario.resource.id,
    replacementResourceId: scenario.replacementResource.id,
    reason: "Metadata-only replacement control record.",
    copyrightStatus: "review_required",
    licensePosture: "review_required",
    residualRisk: "medium",
    status: "owner_intent_required",
    linkedGateIds: [scenario.ownerGate.id],
    evidenceIds: [scenario.evidence.id]
  };
}

function rollbackInput(scenario) {
  return {
    projectId: "TCRN-AOS",
    resourceId: scenario.resource.id,
    manifestId: scenario.manifest.id,
    intendedPreviousManifestId: scenario.previousManifest.id,
    intendedPreviousDigest: scenario.previousManifest.resourceDigest,
    intendedPreviousReference: scenario.previousManifest.materializedCopyReference,
    reason: "Metadata-only rollback control.",
    status: "owner_intent_required",
    requiredGateId: scenario.ownerGate.id,
    evidenceIds: [scenario.evidence.id]
  };
}

function rollbackPlanInput({ rollbackRequestId, evidence }) {
  return {
    projectId: "TCRN-AOS",
    rollbackRequestId,
    fallbackPath: "manifest-only:slice8-previous-resource",
    expectedNoExecutionResult: "No rollback execution occurs in Slice 8.",
    readbackCommand: "aos.resource.materialization_control.read",
    evidenceIds: [evidence.id]
  };
}

function retirementInput(scenario) {
  return {
    projectId: "TCRN-AOS",
    resourceId: scenario.resource.id,
    manifestId: scenario.manifest.id,
    reason: "Metadata-only retirement record.",
    lifecycleState: "superseded",
    status: "recorded",
    evidenceIds: [scenario.evidence.id],
    cleanupRequired: true
  };
}

function cleanupInput(scenario) {
  return {
    projectId: "TCRN-AOS",
    targetType: "materialized_copy",
    targetId: scenario.manifest.id,
    cleanupNeeded: true,
    cleanupReason: "Future cleanup requires a separate Owner Intent route.",
    status: "blocked",
    evidenceIds: [scenario.evidence.id]
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
    digest: "sha256:slice8-resource-fixture",
    storageReference: "resource-library/slice8-resource-fixture",
    classification: ["resource-library", "materialization-control"],
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

function allNoExecution(index) {
  return index.materializationExecuted === false
    && index.updateExecuted === false
    && index.replacementExecuted === false
    && index.rollbackExecuted === false
    && index.cleanupExecuted === false
    && index.deleteExecuted === false
    && index.resourceBinaryTransferred === false
    && index.productRepoWriteExecuted === false
    && index.legalCompletionClaimed === false
    && index.publicReadinessClaimed === false
    && index.releaseReadinessClaimed === false;
}

function noExecutionSummary(index) {
  return {
    materializationExecuted: index.materializationExecuted,
    updateExecuted: index.updateExecuted,
    replacementExecuted: index.replacementExecuted,
    rollbackExecuted: index.rollbackExecuted,
    cleanupExecuted: index.cleanupExecuted,
    deleteExecuted: index.deleteExecuted,
    resourceBinaryTransferred: index.resourceBinaryTransferred,
    productRepoWriteExecuted: index.productRepoWriteExecuted,
    legalCompletionClaimed: index.legalCompletionClaimed,
    publicReadinessClaimed: index.publicReadinessClaimed,
    releaseReadinessClaimed: index.releaseReadinessClaimed
  };
}

function expectRejected(action, pattern) {
  try {
    action();
    return { ok: false, message: "" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: pattern.test(message), message };
  }
}
