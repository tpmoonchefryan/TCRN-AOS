import test from "node:test";
import assert from "node:assert/strict";
import { AosStore, createDefaultSeed } from "../../../dist/packages/domain/src/index.js";
import { CodexIntegrationAdapter } from "../../../dist/packages/adapter-codex/src/index.js";

const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "adapter-test"
};

test("Codex adapter creates dry-run dispatches and refuses live send", () => {
  const store = new AosStore(createDefaultSeed());
  const adapter = new CodexIntegrationAdapter(store);
  const payload = {
    kind: "gate_request",
    targetEmployeeId: "employee-sable",
    linkedTicketIds: ["story-security"],
    linkedGateId: "gate-security",
    subject: "Review AOS Slice 1 security posture",
    body: "Please review the metadata-only proof package.",
    expectedReturnFormat: "status, findings, blockers, next_owner"
  };
  const dispatch = adapter.createDryRunDispatch(payload, actor);
  const duplicate = adapter.createDryRunDispatch(payload, actor);
  const readback = adapter.readback(dispatch.id);

  assert.equal(dispatch.status, "dry_run");
  assert.equal(dispatch.targetThreadId, "sable-thread");
  assert.equal(duplicate.id, dispatch.id);
  assert.equal(readback.acceptanceInferred, false);
  assert.throws(() => adapter.sendLive(), /not authorized/);
});

test("Codex adapter parses returns and records retry/dedupe policy without live transport", () => {
  const store = new AosStore(createDefaultSeed());
  const adapter = new CodexIntegrationAdapter(store, { maxAttempts: 1, backoffSeconds: [1] });
  const dispatch = adapter.createDryRunDispatch({
    kind: "assignment",
    targetEmployeeId: "employee-ilya",
    linkedTicketIds: ["story-implementation"],
    subject: "Implement local slice",
    body: "Local-only dry run.",
    expectedReturnFormat: "xml-like status block"
  }, actor);
  const parsed = adapter.collectReturn(dispatch.id, "<status>blocked</status><summary>Need review</summary><blocker>policy</blocker><next_owner>Arturo</next_owner>", actor);
  const retry = adapter.markRetry(dispatch.id, actor);
  assert.equal(retry.status, "retrying");
  const expired = adapter.markRetry(dispatch.id, actor);

  assert.equal(parsed.status, "blocked");
  assert.deepEqual(parsed.blockers, ["policy"]);
  assert.equal(expired.status, "expired");
});

test("Codex adapter rejects restricted payloads before outbox storage", () => {
  const store = new AosStore(createDefaultSeed());
  const adapter = new CodexIntegrationAdapter(store);
  const privateEvidence = "private evidence payload";
  assert.throws(() => adapter.createDryRunDispatch({
    kind: "conference_invite",
    targetEmployeeId: "employee-sable",
    linkedTicketIds: ["story-risk"],
    subject: "Unsafe payload",
    body: privateEvidence,
    expectedReturnFormat: "status"
  }, actor), /restricted private_evidence_payload/);
});
