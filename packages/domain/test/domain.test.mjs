import test from "node:test";
import assert from "node:assert/strict";
import {
  AosStore,
  createDefaultSeed,
  scanForRestrictedContent
} from "../../../dist/packages/domain/src/index.js";

const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "domain-test"
};

const estimate = {
  effortPoints: 3,
  complexity: "medium",
  risk: "L3",
  verificationCost: "medium",
  confidence: "medium"
};

test("domain models create project initiative epic story gates comments evidence and stage map", () => {
  const store = new AosStore(createDefaultSeed());
  const initiative = store.createInitiative({
    projectId: "TCRN-AOS",
    title: "Operational Spine",
    status: "proposed",
    problem: "AOS needs governed operational state.",
    expectedOutcome: "Agents can propose tickets and request gates safely."
  }, actor);
  const epic = store.createEpic({
    initiativeId: initiative.id,
    title: "MCP Gateway",
    goal: "Governed write path",
    status: "proposed"
  }, actor);
  const story = store.createStory({
    epicId: epic.id,
    title: "Propose governed story",
    problem: "Agents need safe ticket proposals.",
    user: "implementation agent",
    expectedBehavior: "The story is proposed and audited.",
    acceptanceCriteria: ["structured fields", "gate state", "audit event"],
    status: "proposed",
    estimate,
    subTasks: []
  }, actor);
  const subTask = store.addSubTask(story.id, {
    id: "subtask-verify",
    title: "Verify authz and audit",
    ownerRole: "verification",
    status: "proposed",
    dependencyIds: [],
    proofExpectation: "unit tests"
  }, actor);
  const comment = store.addComment({
    ticketId: story.id,
    type: "agent_observation",
    actor,
    body: "Model-first spine is ready for local proof."
  }, actor);
  const evidence = store.linkEvidence({
    type: "artifact_id",
    target: "aos-local-proof-001",
    validity: "unknown",
    producer: actor.employeeId,
    digest: "sha256:abc",
    redactionState: "metadata_only"
  }, actor);
  const gate = store.requestGate({
    type: "evidence_proof",
    linkedTicketId: story.id,
    inputEvidenceIds: [evidence.id]
  }, actor);
  const stageMap = store.deriveStageMap("TCRN-AOS", initiative.id);

  assert.equal(subTask.status, "proposed");
  assert.equal(comment.appendOnly, true);
  assert.equal(gate.ownerRole, "verification");
  assert.equal(gate.status, "pending_role");
  assert.equal(stageMap.length, 4);
  assert.equal(stageMap.find((stage) => stage.stageId === "release").state, "release_proof_required");
  assert.ok(store.queryAudit({ targetId: story.id }).some((event) => event.action === "story.create"));
});

test("owner intent is captured separately from ordinary role approval", () => {
  const store = new AosStore(createDefaultSeed());
  const intent = store.captureOwnerIntent({
    action: "reprioritize",
    summary: "Prioritize Slice 1 local checkpoint."
  }, actor);
  assert.equal(intent.status, "captured");
  assert.match(intent.auditEventId, /^audit_/);
});

test("dependency and resource posture avoid clean/legal completion claims", () => {
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
    type: "template",
    title: "AOS proof note template",
    owner: "TCRN",
    source: "product-local",
    version: "0.1.0",
    digest: "sha256:def",
    storageReference: "resource-template-001",
    classification: ["document", "proof"],
    copyrightStatus: "review_required",
    lifecycleState: "proposed",
    approvalState: "review_required"
  }, actor);

  assert.equal(dependency.posture, "review_required");
  assert.equal(resource.approvalState, "review_required");
});

test("restricted local paths and raw source payloads are detected before storage", () => {
  const localPath = "/" + "Users/example/private.env";
  const findings = scanForRestrictedContent({ localPath, raw: "diff --git a/file b/file" });
  assert.equal(findings.some((finding) => finding.kind === "machine_local_absolute_path"), true);
  assert.equal(findings.some((finding) => finding.kind === "raw_source"), true);

  const store = new AosStore(createDefaultSeed());
  assert.throws(() => store.linkEvidence({
    type: "local_path_reference",
    target: localPath,
    validity: "unknown",
    producer: actor.employeeId,
    redactionState: "restricted"
  }, actor), /restricted machine_local_absolute_path/);
});
