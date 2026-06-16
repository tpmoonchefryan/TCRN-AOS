import test from "node:test";
import assert from "node:assert/strict";
import { AosStore, createDefaultSeed, createId } from "../../../dist/packages/domain/src/index.js";
import { McpGateway } from "../../../dist/packages/mcp-gateway/src/index.js";

const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "slice7-gateway-test"
};

const estimate = {
  effortPoints: 3,
  complexity: "medium",
  risk: "L3",
  verificationCost: "medium",
  confidence: "medium"
};

test("Slice 7 gateway records dependency governance metadata and reads index without package mutation", () => {
  const { gateway, storyId, evidenceId, gateId } = gatewayFixture();
  const dependency = gateway.handle({
    method: "aos.dependency.record.propose",
    actor,
    params: {
      projectId: "TCRN-AOS",
      ecosystem: "npm",
      packageName: "fixture-unapproved",
      versionRange: "1.0.0",
      sourceSystem: "deterministic_fixture",
      projectUsage: "development",
      ownerRole: "security",
      lifecycleState: "unapproved",
      artifactRef: "package:fixture-unapproved@1.0.0",
      licenseExpression: "MIT",
      declaredLicenseEvidence: "declared-fixture",
      discoveredLicenseEvidence: "discovered-fixture",
      evidenceArtifactRef: evidenceId,
      evidenceStatus: "evidence_missing",
      confidence: "medium",
      policyClass: "unknown",
      reviewerRole: "security",
      residualRisk: "medium",
      nextAction: "request_review",
      sbomNoticeObligation: "review_required",
      posture: "review_required",
      approvalOwnerRole: "security",
      linkedStoryIds: [storyId],
      linkedEvidenceIds: [evidenceId],
      releaseBlocker: true,
      packageMutationExecuted: false
    },
    idempotencyKey: "slice7-dependency-record"
  });
  const finding = gateway.handle({
    method: "aos.dependency.detection.record",
    actor,
    params: {
      projectId: "TCRN-AOS",
      dependencyId: dependency.result.id,
      state: "unapproved",
      sourceSystem: "deterministic_fixture",
      evidenceIds: [evidenceId],
      linkedGateIds: [gateId],
      remediationExecuted: false,
      packageMutationExecuted: false,
      nextAction: "request_review"
    }
  });
  const index = gateway.handle({
    method: "aos.dependency.governance.read",
    actor,
    params: { projectId: "TCRN-AOS" }
  });
  const dedupe = gateway.handle({
    method: "aos.dependency.governance.read",
    actor,
    params: { projectId: "TCRN-AOS" },
    idempotencyKey: index.idempotencyKey
  });

  assert.equal(dependency.ok, true);
  assert.equal(finding.ok, true);
  assert.equal(index.status, "read");
  assert.equal(dedupe.status, "deduped");
  assert.deepEqual(index.result.dependencyIds, [dependency.result.id]);
  assert.deepEqual(index.result.detectionFindingIds, [finding.result.id]);
  assert.ok(index.result.blockedDependencyIds.includes(dependency.result.id));
  assert.ok(index.result.releaseBlockerDependencyIds.includes(dependency.result.id));
  assert.equal(index.result.packageMutationAuthorized, false);
  assert.equal(index.result.remediationExecuted, false);
  assert.equal(index.result.dependencyCleanClaimed, false);
});

test("Slice 7 gateway records Resource Library requests, manifests, findings, and no materialization", () => {
  const { gateway, storyId, releaseNoteId, evidenceId, gateId, ownerGateId } = gatewayFixture();
  const resource = gateway.handle({
    method: "aos.resource.record.propose",
    actor,
    params: {
      type: "image",
      projectId: "TCRN-AOS",
      title: "Local checkpoint illustration",
      owner: "TCRN",
      source: "product-local",
      version: "1.0.0",
      digest: "sha256:slice7-resource",
      storageReference: "resource-library/local-checkpoint-illustration",
      classification: ["resource-library", "checkpoint"],
      permissionState: "permission_required",
      attributionRequired: true,
      derivativeAllowed: false,
      reviewerRole: "security",
      residualRisk: "medium",
      copyrightStatus: "review_required",
      lifecycleState: "proposed",
      approvalState: "review_required",
      linkedStoryIds: [storyId],
      linkedReleaseNoteIds: [releaseNoteId],
      linkedEvidenceIds: [evidenceId],
      materializationAllowed: false,
      materializationExecuted: false,
      productRepoWriteExecuted: false,
      releaseBlocker: false
    }
  });
  const request = gateway.handle({
    method: "aos.resource.materialization.request",
    actor,
    params: {
      projectId: "TCRN-AOS",
      resourceId: resource.result.id,
      targetProjectId: "TCRN-AOS",
      requestedPurpose: "Metadata-only future materialization request.",
      status: "gate_required",
      linkedGateId: ownerGateId,
      evidenceIds: [evidenceId]
    }
  });
  const manifest = gateway.handle({
    method: "aos.resource.manifest.record",
    actor,
    params: {
      projectId: "TCRN-AOS",
      resourceId: resource.result.id,
      resourceDigest: resource.result.digest,
      materializedCopyReference: "manifest-only:local-checkpoint-illustration",
      status: "approved_lineage_record",
      linkedStoryIds: [storyId],
      linkedReleaseNoteIds: [releaseNoteId],
      linkedEvidenceIds: [evidenceId]
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
      evidenceIds: [evidenceId],
      linkedGateIds: [gateId]
    }
  });
  const index = gateway.handle({
    method: "aos.resource.governance.read",
    actor,
    params: { projectId: "TCRN-AOS" }
  });

  assert.equal(resource.ok, true);
  assert.equal(request.result.ownerIntentRequired, true);
  assert.equal(request.result.materializationExecuted, false);
  assert.equal(request.result.productRepoWriteExecuted, false);
  assert.equal(manifest.result.liveCopyCreated, false);
  assert.equal(finding.result.scannerIngestionExecuted, false);
  assert.equal(index.status, "read");
  assert.deepEqual(index.result.resourceIds, [resource.result.id]);
  assert.deepEqual(index.result.materializationRequestIds, [request.result.id]);
  assert.deepEqual(index.result.manifestRecordIds, [manifest.result.id]);
  assert.deepEqual(index.result.auditFindingIds, [finding.result.id]);
  assert.equal(index.result.materializationExecuted, false);
  assert.equal(index.result.productRepoWriteExecuted, false);
  assert.equal(index.result.legalCompletionClaimed, false);
  assert.equal(index.result.publicReadinessClaimed, false);
});

test("Slice 7 gateway rejects restricted governance payloads before storage", () => {
  const { gateway } = gatewayFixture();
  const syntheticLocalPath = "/" + "Users/example/private-resource.png";
  const rejected = gateway.handle({
    method: "aos.resource.record.propose",
    actor,
    params: {
      type: "image",
      projectId: "TCRN-AOS",
      title: "Rejected resource",
      owner: "TCRN",
      source: "product-local",
      version: "1.0.0",
      digest: "sha256:rejected",
      storageReference: syntheticLocalPath,
      classification: ["resource-library"],
      copyrightStatus: "review_required",
      lifecycleState: "proposed",
      approvalState: "review_required"
    }
  });
  assert.equal(rejected.ok, false);
  assert.match(rejected.error, /restricted machine_local_absolute_path/);
});

function gatewayFixture() {
  const store = new AosStore(createDefaultSeed());
  const gateway = new McpGateway(store);
  const initiative = store.createInitiative({
    projectId: "TCRN-AOS",
    title: "Slice 7 governance gateway",
    status: "in_progress",
    problem: "Gateway methods need governed dependency and resource readbacks.",
    expectedOutcome: "Safe local methods write metadata records and read governance indexes."
  }, actor);
  const epic = store.createEpic({
    initiativeId: initiative.id,
    title: "Governance MCP methods",
    goal: "Local governance write/read contract",
    status: "in_progress"
  }, actor);
  const story = store.createStory({
    epicId: epic.id,
    title: "Prove governance gateway",
    problem: "Dependency and resource records need governed creation and readback.",
    user: "security owner",
    expectedBehavior: "Gateway accepts safe metadata, blocks restricted payloads, and exposes no-overclaim indexes.",
    acceptanceCriteria: ["authz", "dedupe", "redaction", "governance index readback"],
    status: "in_progress",
    estimate,
    subTasks: []
  }, actor);
  const evidence = store.linkEvidence({
    type: "artifact_id",
    target: "slice-7-gateway-proof",
    validity: "valid",
    producer: actor.employeeId,
    digest: "sha256:slice7-gateway",
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
    id: createId("release_note", { storyId: story.id, releaseLabel: "slice-7-gateway" }),
    projectId: "TCRN-AOS",
    releaseLabel: "slice-7-gateway",
    linkedStoryIds: [story.id],
    userFacingSummary: "Governance records remain local and unreleased.",
    internalNotesSummary: "No materialization or package mutation executed.",
    riskNotesSummary: "Legal/public readiness remains unclaimed.",
    linkedEvidenceIds: [evidence.id],
    reviewState: "publish_blocked",
    gitExportAuthorized: false,
    releaseCloseoutClaimed: false
  }, actor);
  return {
    gateway,
    storyId: story.id,
    releaseNoteId: releaseNote.id,
    evidenceId: evidence.id,
    gateId: gate.id,
    ownerGateId: ownerGate.id
  };
}
