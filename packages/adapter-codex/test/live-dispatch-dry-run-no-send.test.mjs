import test from "node:test";
import assert from "node:assert/strict";
import { AosStore, createDefaultSeed } from "../../../dist/packages/domain/src/index.js";
import {
  CodexIntegrationAdapter,
  createNoSendPrimitiveProbe
} from "../../../dist/packages/adapter-codex/src/index.js";

const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "aos-59h-test"
};

test("59h no-send envelope is dry-run only, deterministic, audited, and uses zero primitives", () => {
  const store = new AosStore(createDefaultSeed());
  const adapter = new CodexIntegrationAdapter(store);
  const probe = createNoSendPrimitiveProbe();
  const input = baseNoSendInput();

  const envelope = adapter.createNoSendDispatchEnvelope(input, actor, probe);
  const duplicate = adapter.createNoSendDispatchEnvelope(input, actor, probe);
  const changedObjective = adapter.createNoSendDispatchEnvelope({
    ...input,
    objective: "Implement a different local-only proof objective"
  }, actor, probe);
  const changedBasis = adapter.createNoSendDispatchEnvelope({
    ...input,
    aosBasisSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  }, actor, probe);

  assert.equal(envelope.dryRun, true);
  assert.equal(envelope.noSend, true);
  assert.equal(envelope.sendPrimitiveCallCount, 0);
  assert.equal(envelope.threadManagementPrimitiveCallCount, 0);
  assert.equal(probe.snapshot().sendPrimitiveCallCount, 0);
  assert.equal(probe.snapshot().threadManagementPrimitiveCallCount, 0);
  assert.equal(duplicate.dispatchId, envelope.dispatchId);
  assert.notEqual(changedObjective.dispatchId, envelope.dispatchId);
  assert.notEqual(changedBasis.dispatchId, envelope.dispatchId);
  assert.equal(adapter.listNoSendEnvelopes().length, 3);
  assert.equal(store.queryAudit({ action: "codex.no_send.dispatch.preview" }).length, 3);
  assert.equal(store.queryAudit({ action: "codex.no_send.dispatch.dedupe" }).length, 1);
});

test("59h no-send envelope rejects live-send and thread-management misuse without primitive calls", () => {
  const store = new AosStore(createDefaultSeed());
  const adapter = new CodexIntegrationAdapter(store);
  const probe = createNoSendPrimitiveProbe();

  assert.throws(() => adapter.createNoSendDispatchEnvelope({
    ...baseNoSendInput(),
    dryRun: false,
    noSend: true
  }, actor, probe), /dry_run=true and no_send=true/);
  assert.throws(() => adapter.createNoSendDispatchEnvelope({
    ...baseNoSendInput(),
    requestedLiveSend: true
  }, actor, probe), /live-send/);
  assert.throws(() => adapter.createNoSendDispatchEnvelope({
    ...baseNoSendInput(),
    requestedThreadManagementActions: ["create_thread", "archive_thread"]
  }, actor, probe), /thread-management/);
  assert.throws(() => adapter.createNoSendDispatchEnvelope({
    ...baseNoSendInput(),
    readScope: ["semgrep scanner raw output vulnerability finding"]
  }, actor, probe), /restricted raw_scanner_output/);
  assert.throws(() => adapter.createNoSendDispatchEnvelope({
    ...baseNoSendInput(),
    readScope: ["raw secret scan output"]
  }, actor, probe), /restricted raw_secret_scan_output/);
  assert.throws(() => adapter.createNoSendDispatchEnvelope({
    ...baseNoSendInput(),
    readScope: ["/" + "Users/example/private-evidence.json"]
  }, actor, probe), /restricted machine_local_absolute_path/);

  assert.equal(probe.snapshot().sendPrimitiveCallCount, 0);
  assert.equal(probe.snapshot().threadManagementPrimitiveCallCount, 0);
  assert.equal(adapter.listNoSendEnvelopes().length, 0);
  assert.equal(store.queryAudit({ action: "codex.no_send.dispatch.blocked" }).length, 6);
});

test("59h no-send target state handling fails closed for stale, archived, missing, owner, and unconfirmed successor targets", () => {
  const store = new AosStore(createDefaultSeed());
  const adapter = new CodexIntegrationAdapter(store);
  const probe = createNoSendPrimitiveProbe();
  const blockedStates = ["predecessor", "replaced_without_successor_confirmation", "stale", "archived", "unknown", "missing", "systemError", "no_return", "conflicting_status", "owner_human"];

  for (const state of blockedStates) {
    assert.throws(() => adapter.createNoSendDispatchEnvelope({
      ...baseNoSendInput(),
      targetThreadState: state
    }, actor, probe), new RegExp(state));
  }
  assert.throws(() => adapter.createNoSendDispatchEnvelope({
    ...baseNoSendInput(),
    targetThreadState: "active_successor",
    successorConfirmed: false
  }, actor, probe), /active_successor/);
  const successor = adapter.createNoSendDispatchEnvelope({
    ...baseNoSendInput(),
    targetThreadState: "active_successor",
    successorConfirmed: true
  }, actor, probe);
  const temporaryLane = adapter.createNoSendDispatchEnvelope({
    ...baseNoSendInput(),
    targetThreadState: "temporary_lane",
    temporaryLaneAuthorized: true
  }, actor, probe);

  assert.equal(successor.targetThreadState, "active_successor");
  assert.equal(temporaryLane.targetThreadState, "temporary_lane");
  assert.equal(probe.snapshot().sendPrimitiveCallCount, 0);
  assert.equal(probe.snapshot().threadManagementPrimitiveCallCount, 0);
});

test("59h terminal-return validator accepts only contract-valid target receipts", () => {
  const store = new AosStore(createDefaultSeed());
  const adapter = new CodexIntegrationAdapter(store);
  const envelope = adapter.createNoSendDispatchEnvelope(baseNoSendInput(), actor, createNoSendPrimitiveProbe());
  const expected = expectedReturnContext(envelope);
  const valid = adapter.validateTerminalReturnObservation(expected, validReturn(envelope));
  const history = [{ dedupeKey: valid.dedupeKey, status: valid.status }];

  assert.equal(valid.disposition, "consumable");
  assert.equal(valid.consumableCandidate, true);
  assert.equal(valid.reason, "contract_valid_terminal_return");
  assert.equal(adapter.validateTerminalReturnObservation(expected, validReturn(envelope), history).disposition, "duplicate");
  assert.equal(adapter.validateTerminalReturnObservation(expected, { ...validReturn(envelope), status: "blocked", blockers: ["policy"], nextOwner: "Arturo", handoffReturnState: "blocked_return_sent" }, history).disposition, "conflicting");
  assert.equal(adapter.validateTerminalReturnObservation(expected, { ...validReturn(envelope), handoffReturnState: undefined }).reason, "missing_or_invalid_handoff_return_state");
  assert.equal(adapter.validateTerminalReturnObservation(expected, { ...validReturn(envelope), handoffReturnState: "return_gap_recovered" }).reason, "coordinator_recovery_state_not_target_terminal");
  assert.equal(adapter.validateTerminalReturnObservation(expected, { ...validReturn(envelope), payloadKind: "commentary_only" }).reason, "commentary_only");
  assert.equal(adapter.validateTerminalReturnObservation(expected, { ...validReturn(envelope), payloadKind: "systemError" }).reason, "systemError");
  assert.equal(adapter.validateTerminalReturnObservation(expected, { ...validReturn(envelope), sourceThreadId: "stale-thread" }).reason, "thread_identity_mismatch");
  assert.equal(adapter.validateTerminalReturnObservation(expected, { ...validReturn(envelope), parentRouteId: "stale-route" }).reason, "route_or_dispatch_mismatch");
  assert.equal(adapter.validateTerminalReturnObservation(expected, { ...validReturn(envelope), targetThreadState: "archived" }).reason, "target_thread_state_not_usable");
  assert.equal(adapter.validateTerminalReturnObservation(expected, { ...validReturn(envelope), status: "blocked", blockers: [], nextOwner: undefined, handoffReturnState: "blocked_return_sent" }).reason, "blocking_return_missing_next_owner_or_blocker");
  assert.equal(adapter.validateTerminalReturnObservation(expected, { ...validReturn(envelope), claims: { productAcceptance: true } }).reason, "terminal_return_overclaims_authority");
  assert.equal(adapter.validateTerminalReturnObservation(expected, { ...validReturn(envelope), summary: "private evidence payload" }).reason, "restricted_payload");
});

function baseNoSendInput() {
  return {
    parentRouteId: "AOS-59f-live-dispatch-dry-run-no-send-authority-packet",
    sourceProjectId: "TCRN-AOS",
    initiativeId: "tcrn-aos-product-foundation",
    aosBasisSha: "4cd40317c912fb1fb9974d1cdbfa865358988121",
    workflowBasisSha: "70386e8fa848e98d3d4a525d2a49f765fd0eecda",
    targetRole: "Ilya, Full-Stack Implementer",
    targetThreadId: "019eb6d7-f130-70a0-8805-169cc337229b",
    targetThreadState: "active",
    objective: "Implement local 59h dry-run no-send proof",
    executionMode: "pursue_goal_required",
    readScope: ["Workflow packet 59h", "adapter source", "thread handoff contract"],
    writeScope: ["TCRN-AOS adapter source", "TCRN-AOS tests", "TCRN-AOS evidence"],
    nonAuthorizations: ["no live dispatch", "no thread registry mutation", "no deployment"],
    requiredReturnFormat: ["status", "proof_summary", "handoff_return_state"],
    ownerIntentFlags: ["real dispatch requires Owner Intent", "thread management requires Owner Intent"],
    replayWindow: "route_basis_only",
    dryRun: true,
    noSend: true,
    auditRedactionProfile: "count_only_route_metadata"
  };
}

function expectedReturnContext(envelope) {
  return {
    parentRouteId: envelope.parentRouteId,
    dispatchId: envelope.dispatchId,
    sourceThreadId: envelope.targetThreadId,
    targetThreadId: "019eb66e-00d1-7190-81d9-693895b32033",
    coordinatorThreadId: "019eb66e-00d1-7190-81d9-693895b32033",
    targetThreadState: "active",
    returnContractVersion: envelope.returnContractVersion
  };
}

function validReturn(envelope) {
  return {
    sourceThreadId: envelope.targetThreadId,
    targetThreadId: "019eb66e-00d1-7190-81d9-693895b32033",
    coordinatorThreadId: "019eb66e-00d1-7190-81d9-693895b32033",
    parentRouteId: envelope.parentRouteId,
    dispatchId: envelope.dispatchId,
    status: "success",
    summary: "Local proof completed",
    blockers: [],
    handoffReturnState: "return_sent",
    payloadKind: "assistant_terminal",
    targetThreadState: "active",
    claims: {
      productAcceptance: false,
      finalMvpAcceptance: false,
      liveDispatch: false,
      deployment: false
    }
  };
}
