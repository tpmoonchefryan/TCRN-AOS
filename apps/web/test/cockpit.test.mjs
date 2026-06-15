import test from "node:test";
import assert from "node:assert/strict";
import { AosStore, createDefaultSeed } from "../../../dist/packages/domain/src/index.js";
import { createCockpitSnapshot, initialNavigation } from "../../../dist/apps/web/src/cockpit.js";

const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "web-test"
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
