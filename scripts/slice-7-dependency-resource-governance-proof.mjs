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
  sessionId: "slice7-proof"
};

const dependencyStates = ["deprecated", "denied", "expired", "unapproved", "current", "historical", "removed", "unused"];
const resourceFindingTypes = ["approved_use", "deprecated", "revoked", "stale_version", "unused_materialized", "unregistered_local_asset", "blocked"];

const dependencyProof = proveDependencyGovernanceMatrix();
const resourceProof = proveResourceGovernanceMatrix();
const gatewayProof = proveGatewayGovernanceMethods();
const restrictedPayloadProof = proveRestrictedPayloadRejected();

const ok = dependencyProof.ok
  && resourceProof.ok
  && gatewayProof.ok
  && restrictedPayloadProof.ok;

console.log(JSON.stringify({
  ok,
  dependencyProof,
  resourceProof,
  gatewayProof,
  restrictedPayloadProof,
  d024Boundary: {
    localFirstStorage: true,
    runtimeOperationalDataCommittedToGit: false,
    gitTracksOnlySourceSchemasFixturesTestsScriptsDocsEvidence: true,
    packageMutationExecuted: false,
    resourceBinaryMaterializationExecuted: false,
    productRepoResourceWriteExecuted: false
  },
  noOverclaim: {
    dependencyCleanClaimed: false,
    legalCompletionClaimed: false,
    publicReadinessClaimed: false,
    releaseReadinessClaimed: false,
    scannerIngestionExecuted: false,
    resourceMaterializationExecuted: false,
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

function proveDependencyGovernanceMatrix() {
  const { store, story, evidence, gate } = createScenario("dependency_matrix");
  const dependencies = dependencyStates.map((state) => {
    const dependency = store.createDependencyRecord({
      projectId: "TCRN-AOS",
      ecosystem: "npm",
      packageName: `slice7-${state}`,
      versionRange: state === "removed" ? "removed" : "1.0.0",
      sourceSystem: "deterministic_fixture",
      projectUsage: state === "historical" ? "historical" : "development",
      ownerRole: "security",
      lifecycleState: state,
      artifactRef: `package:slice7-${state}@1.0.0`,
      licenseExpression: state === "denied" ? "GPL-3.0-only" : "MIT",
      declaredLicenseEvidence: `declared-${state}`,
      discoveredLicenseEvidence: `discovered-${state}`,
      evidenceArtifactRef: evidence.id,
      evidenceStatus: state === "unapproved" ? "evidence_missing" : "present",
      confidence: "high",
      policyClass: state === "denied" ? "denied" : state === "unapproved" ? "unknown" : "review_required",
      reviewerRole: "security",
      residualRisk: state === "denied" ? "blocked" : "low",
      nextAction: ["denied", "expired", "unapproved"].includes(state) ? "request_review" : "none",
      sbomNoticeObligation: state === "current" ? "none" : "review_required",
      posture: dependencyPostureForState(state),
      approvalOwnerRole: "security",
      linkedStoryIds: [story.id],
      linkedEvidenceIds: [evidence.id],
      releaseBlocker: ["denied", "expired", "unapproved"].includes(state),
      packageMutationExecuted: false
    }, actor);
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
    return dependency;
  });
  store.linkDependencyGate(dependencies.find((dependency) => dependency.lifecycleState === "denied").id, gate.id, actor);
  const index = store.createDependencyGovernanceIndex("TCRN-AOS");
  return {
    scenario: "dependency_license_governance_matrix",
    ok: index.dependencyIds.length === dependencyStates.length
      && index.detectionFindingIds.length === dependencyStates.length
      && dependencyStates.every((state) => index.stateCounts[state] >= 1)
      && index.blockedDependencyIds.length >= 3
      && index.releaseBlockerDependencyIds.length >= 3
      && index.sbomNoticeRequiredDependencyIds.length === 7
      && index.packageMutationAuthorized === false
      && index.remediationExecuted === false
      && index.dependencyCleanClaimed === false
      && index.legalCompletionClaimed === false
      && index.releaseReadinessClaimed === false,
    states: dependencyStates,
    dependencyCount: index.dependencyIds.length,
    detectionFindingCount: index.detectionFindingIds.length,
    blockedDependencyCount: index.blockedDependencyIds.length,
    releaseBlockerDependencyCount: index.releaseBlockerDependencyIds.length,
    sbomNoticeRequiredDependencyCount: index.sbomNoticeRequiredDependencyIds.length,
    linkedGateCount: index.linkedGateIds.length,
    linkedEvidenceCount: index.linkedEvidenceIds.length,
    stateCounts: index.stateCounts,
    noExecutionClaims: {
      packageMutationAuthorized: index.packageMutationAuthorized,
      remediationExecuted: index.remediationExecuted,
      dependencyCleanClaimed: index.dependencyCleanClaimed,
      legalCompletionClaimed: index.legalCompletionClaimed,
      releaseReadinessClaimed: index.releaseReadinessClaimed
    }
  };
}

function proveResourceGovernanceMatrix() {
  const { store, story, evidence, gate, ownerGate, releaseNote } = createScenario("resource_matrix");
  const approved = store.createResourceRecord(resourceInput({
    title: "Slice 7 approved metadata resource",
    lifecycleState: "approved",
    approvalState: "accepted_with_residual_risk",
    permissionState: "permitted",
    linkedStoryIds: [story.id],
    linkedReleaseNoteIds: [releaseNote.id],
    linkedEvidenceIds: [evidence.id]
  }));
  const blocked = store.createResourceRecord(resourceInput({
    title: "Slice 7 blocked external asset",
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
    requestedPurpose: "Owner-intent-gated metadata-only future materialization request.",
    status: "gate_required",
    linkedGateId: ownerGate.id,
    evidenceIds: [evidence.id]
  }, actor);
  const manifest = store.createProjectResourceManifest({
    projectId: "TCRN-AOS",
    resourceId: approved.id,
    resourceDigest: approved.digest,
    materializedCopyReference: "manifest-only:slice7-approved-metadata-resource",
    status: "approved_lineage_record",
    linkedStoryIds: [story.id],
    linkedReleaseNoteIds: [releaseNote.id],
    linkedEvidenceIds: [evidence.id]
  }, actor);
  for (const findingType of resourceFindingTypes) {
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
  const traceability = index.traceabilityRows.find((row) => row.resourceId === approved.id);
  return {
    scenario: "resource_library_governance_matrix",
    ok: index.resourceIds.length === 2
      && index.materializationRequestIds.includes(request.id)
      && index.manifestRecordIds.includes(manifest.id)
      && index.auditFindingIds.length === resourceFindingTypes.length
      && resourceFindingTypes.every((findingType) => index.findingCounts[findingType] === 1)
      && index.blockedResourceIds.includes(blocked.id)
      && index.releaseBlockerResourceIds.includes(blocked.id)
      && traceability?.linkedStoryIds.includes(story.id)
      && traceability?.linkedReleaseNoteIds.includes(releaseNote.id)
      && traceability?.linkedEvidenceIds.includes(evidence.id)
      && request.ownerIntentRequired === true
      && index.scannerIngestionExecuted === false
      && index.materializationExecuted === false
      && index.productRepoWriteExecuted === false
      && index.legalCompletionClaimed === false
      && index.publicReadinessClaimed === false
      && index.releaseReadinessClaimed === false,
    resourceCount: index.resourceIds.length,
    materializationRequestCount: index.materializationRequestIds.length,
    manifestRecordCount: index.manifestRecordIds.length,
    auditFindingCount: index.auditFindingIds.length,
    blockedResourceCount: index.blockedResourceIds.length,
    releaseBlockerResourceCount: index.releaseBlockerResourceIds.length,
    findingCounts: index.findingCounts,
    traceabilityRows: index.traceabilityRows.length,
    requestPosture: {
      ownerIntentRequired: request.ownerIntentRequired,
      materializationExecuted: request.materializationExecuted,
      productRepoWriteExecuted: request.productRepoWriteExecuted
    },
    noExecutionClaims: {
      scannerIngestionExecuted: index.scannerIngestionExecuted,
      materializationExecuted: index.materializationExecuted,
      productRepoWriteExecuted: index.productRepoWriteExecuted,
      legalCompletionClaimed: index.legalCompletionClaimed,
      publicReadinessClaimed: index.publicReadinessClaimed,
      releaseReadinessClaimed: index.releaseReadinessClaimed
    }
  };
}

function proveGatewayGovernanceMethods() {
  const { store, story, evidence, gate, ownerGate, releaseNote } = createScenario("gateway_methods");
  const gateway = new McpGateway(store);
  const dependency = gateway.handle({
    method: "aos.dependency.record.propose",
    actor,
    params: {
      projectId: "TCRN-AOS",
      ecosystem: "npm",
      packageName: "gateway-fixture",
      versionRange: "1.0.0",
      sourceSystem: "deterministic_fixture",
      projectUsage: "development",
      ownerRole: "security",
      lifecycleState: "unapproved",
      artifactRef: "package:gateway-fixture@1.0.0",
      licenseExpression: "MIT",
      declaredLicenseEvidence: "declared-gateway",
      discoveredLicenseEvidence: "discovered-gateway",
      evidenceArtifactRef: evidence.id,
      evidenceStatus: "evidence_missing",
      confidence: "medium",
      policyClass: "unknown",
      reviewerRole: "security",
      residualRisk: "medium",
      nextAction: "request_review",
      sbomNoticeObligation: "review_required",
      posture: "review_required",
      approvalOwnerRole: "security",
      linkedStoryIds: [story.id],
      linkedEvidenceIds: [evidence.id],
      releaseBlocker: true,
      packageMutationExecuted: false
    }
  });
  const dependencyFinding = gateway.handle({
    method: "aos.dependency.detection.record",
    actor,
    params: {
      projectId: "TCRN-AOS",
      dependencyId: dependency.result.id,
      state: "unapproved",
      sourceSystem: "deterministic_fixture",
      evidenceIds: [evidence.id],
      linkedGateIds: [gate.id],
      remediationExecuted: false,
      packageMutationExecuted: false,
      nextAction: "request_review"
    }
  });
  const dependencyIndex = gateway.handle({
    method: "aos.dependency.governance.read",
    actor,
    params: { projectId: "TCRN-AOS" }
  });
  const resource = gateway.handle({
    method: "aos.resource.record.propose",
    actor,
    params: resourceInput({
      title: "Gateway resource metadata",
      linkedStoryIds: [story.id],
      linkedReleaseNoteIds: [releaseNote.id],
      linkedEvidenceIds: [evidence.id]
    })
  });
  const materialization = gateway.handle({
    method: "aos.resource.materialization.request",
    actor,
    params: {
      projectId: "TCRN-AOS",
      resourceId: resource.result.id,
      targetProjectId: "TCRN-AOS",
      requestedPurpose: "Metadata-only gateway materialization request.",
      status: "gate_required",
      linkedGateId: ownerGate.id,
      evidenceIds: [evidence.id]
    }
  });
  const manifest = gateway.handle({
    method: "aos.resource.manifest.record",
    actor,
    params: {
      projectId: "TCRN-AOS",
      resourceId: resource.result.id,
      resourceDigest: resource.result.digest,
      materializedCopyReference: "manifest-only:gateway-resource-metadata",
      status: "approved_lineage_record",
      linkedStoryIds: [story.id],
      linkedReleaseNoteIds: [releaseNote.id],
      linkedEvidenceIds: [evidence.id]
    }
  });
  const finding = gateway.handle({
    method: "aos.resource.audit_finding.record",
    actor,
    params: {
      projectId: "TCRN-AOS",
      resourceId: resource.result.id,
      findingType: "stale_version",
      severity: "review_required",
      evidenceIds: [evidence.id],
      linkedGateIds: [gate.id]
    }
  });
  const resourceIndex = gateway.handle({
    method: "aos.resource.governance.read",
    actor,
    params: { projectId: "TCRN-AOS" }
  });
  return {
    scenario: "mcp_gateway_governance_methods",
    ok: dependency.ok
      && dependencyFinding.ok
      && dependencyIndex.status === "read"
      && resource.ok
      && materialization.ok
      && manifest.ok
      && finding.ok
      && resourceIndex.status === "read"
      && dependencyIndex.result.packageMutationAuthorized === false
      && resourceIndex.result.materializationExecuted === false
      && resourceIndex.result.productRepoWriteExecuted === false,
    statuses: {
      dependency: dependency.status,
      dependencyFinding: dependencyFinding.status,
      dependencyIndex: dependencyIndex.status,
      resource: resource.status,
      materialization: materialization.status,
      manifest: manifest.status,
      finding: finding.status,
      resourceIndex: resourceIndex.status
    },
    dependencyIndexCounts: dependencyIndex.ok ? {
      dependencies: dependencyIndex.result.dependencyIds.length,
      findings: dependencyIndex.result.detectionFindingIds.length,
      blockers: dependencyIndex.result.blockedDependencyIds.length
    } : {},
    resourceIndexCounts: resourceIndex.ok ? {
      resources: resourceIndex.result.resourceIds.length,
      requests: resourceIndex.result.materializationRequestIds.length,
      manifests: resourceIndex.result.manifestRecordIds.length,
      findings: resourceIndex.result.auditFindingIds.length
    } : {}
  };
}

function proveRestrictedPayloadRejected() {
  const { store } = createScenario("restricted_payload");
  const syntheticLocalPath = "/" + "Users/example/private-resource.png";
  let rejected = false;
  let message = "";
  try {
    store.createResourceRecord(resourceInput({
      title: "Rejected resource",
      storageReference: syntheticLocalPath
    }));
  } catch (error) {
    rejected = true;
    message = error instanceof Error ? error.message : String(error);
  }
  return {
    scenario: "restricted_governance_payload_rejected",
    ok: rejected && /machine_local_absolute_path/.test(message),
    rejected,
    reasonKind: /machine_local_absolute_path/.test(message) ? "machine_local_absolute_path" : "other"
  };
}

function createScenario(label) {
  const store = new AosStore(createDefaultSeed());
  const initiative = store.createInitiative({
    projectId: "TCRN-AOS",
    title: `Slice 7 ${label}`,
    status: "in_progress",
    problem: "Dependency and Resource Library governance need deterministic local proof.",
    expectedOutcome: "Local governance records expose obligations, blockers, requests, manifests, and findings without executing remediations."
  }, actor);
  const epic = store.createEpic({
    initiativeId: initiative.id,
    title: "Dependency license and resource governance",
    goal: "Local-first governance readback",
    status: "in_progress"
  }, actor);
  const story = store.createStory({
    epicId: epic.id,
    title: "Prove Slice 7 governance indexes",
    problem: "Reviewers need deterministic dependency/resource readbacks without scanner or materialization execution.",
    user: "security and evidence reviewer",
    expectedBehavior: "AOS stores metadata records and no-overclaim index readbacks locally.",
    acceptanceCriteria: ["dependency lifecycle matrix", "resource audit matrix", "no execution claims"],
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
    target: `slice-7-${label}-proof`,
    validity: "valid",
    producer: actor.employeeId,
    digest: `sha256:slice7-${label}`,
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
    id: createId("release_note", { label, storyId: story.id }),
    projectId: "TCRN-AOS",
    releaseLabel: `slice-7-${label}`,
    linkedStoryIds: [story.id],
    userFacingSummary: "Governance records remain local checkpoint metadata.",
    internalNotesSummary: "No package mutation, scanner ingestion, materialization, or release closeout executed.",
    riskNotesSummary: "Legal completion, public readiness, and release readiness remain unclaimed.",
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
    title: "Slice 7 resource fixture",
    owner: "TCRN",
    source: "product-local",
    version: "1.0.0",
    digest: "sha256:slice7-resource-fixture",
    storageReference: "resource-library/slice7-resource-fixture",
    classification: ["resource-library", "governance-proof"],
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
