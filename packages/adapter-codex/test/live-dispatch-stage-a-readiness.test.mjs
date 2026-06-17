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
  sessionId: "aos-59k-stage-a-test"
};
const PAYLOAD_DIGEST = `sha256:${"a".repeat(64)}`;
const CHANGED_PAYLOAD_DIGEST = `sha256:${"b".repeat(64)}`;
const ORIGINAL_TERMINAL_PACKET_CHECKSUM = `sha256:${"c".repeat(64)}`;
const COORDINATOR_RECEIPT_CHECKSUM = `sha256:${"d".repeat(64)}`;

test("59k Stage A creates execution-readiness envelopes without send, ingestion, registry, or bridge execution", () => {
  const store = new AosStore(createDefaultSeed());
  const adapter = new CodexIntegrationAdapter(store);
  const probe = createNoSendPrimitiveProbe();
  const input = baseLiveDispatchInput();

  const envelope = adapter.createLiveDispatchReadinessEnvelope(input, actor, probe);
  const duplicate = adapter.createLiveDispatchReadinessEnvelope(input, actor, probe);
  const changedBasis = adapter.createLiveDispatchReadinessEnvelope({
    ...input,
    sourceAosBasisSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  }, actor, probe);
  const changedPayload = adapter.createLiveDispatchReadinessEnvelope({
    ...input,
    payloadDigest: CHANGED_PAYLOAD_DIGEST
  }, actor, probe);
  const changedSchema = adapter.createLiveDispatchReadinessEnvelope({
    ...input,
    schemaVersion: "aos-real-live-dispatch-stage-a-v2"
  }, actor, probe);

  assert.equal(envelope.dispatchMode, "implementation_readiness");
  assert.equal(envelope.sendPrimitiveEligibilityState, "blocked_owner_intent_required");
  assert.equal(envelope.sendPrimitiveCallCount, 0);
  assert.equal(envelope.threadManagementPrimitiveCallCount, 0);
  assert.equal(envelope.terminalReturnIngestionExecutionCount, 0);
  assert.equal(envelope.registryMutationCount, 0);
  assert.equal(envelope.generatedBridgeMutationCount, 0);
  assert.equal(duplicate.envelopeId, envelope.envelopeId);
  assert.notEqual(changedBasis.envelopeId, envelope.envelopeId);
  assert.notEqual(changedPayload.envelopeId, envelope.envelopeId);
  assert.notEqual(changedSchema.envelopeId, envelope.envelopeId);
  assert.equal(adapter.listLiveDispatchReadinessEnvelopes().length, 4);
  assert.equal(store.queryAudit({ action: "codex.live_dispatch.readiness" }).length, 4);
  assert.equal(store.queryAudit({ action: "codex.live_dispatch.duplicate_prevented" }).length, 1);
  assert.equal(probe.snapshot().sendPrimitiveCallCount, 0);
  assert.equal(probe.snapshot().threadManagementPrimitiveCallCount, 0);
  assert.equal(probe.snapshot().terminalReturnIngestionExecutionCount, 0);
  assert.equal(probe.snapshot().registryMutationCount, 0);
  assert.equal(probe.snapshot().generatedBridgeMutationCount, 0);
});

test("59k Stage A target readback and execution requests fail closed", () => {
  const store = new AosStore(createDefaultSeed());
  const adapter = new CodexIntegrationAdapter(store);
  const probe = createNoSendPrimitiveProbe();
  const blockedStates = [
    "predecessor",
    "replacement_named",
    "successor_unresolved",
    "replaced_without_successor_confirmation",
    "stale",
    "archived",
    "unknown",
    "missing",
    "systemError",
    "no_return",
    "commentary_only",
    "conflicting_status",
    "owner_human",
    "malformed_target_state"
  ];

  const active = adapter.createLiveDispatchReadinessEnvelope(baseLiveDispatchInput(), actor, probe);
  const successor = adapter.createLiveDispatchReadinessEnvelope({
    ...baseLiveDispatchInput(),
    sourceAosRecordId: "dispatch-request-successor",
    targetReadback: {
      ...baseTargetReadback(),
      state: "active_successor",
      threadId: "019ed2-successor",
      successorConfirmed: true
    }
  }, actor, probe);
  const temporaryLane = adapter.createLiveDispatchReadinessEnvelope({
    ...baseLiveDispatchInput(),
    sourceAosRecordId: "dispatch-request-temporary-lane",
    targetReadback: {
      ...baseTargetReadback(),
      state: "temporary_lane",
      threadId: "019ed2-temporary-lane",
      temporaryLaneAuthorized: true
    }
  }, actor, probe);

  assert.equal(active.targetReadback.state, "active");
  assert.equal(successor.targetReadback.state, "active_successor");
  assert.equal(temporaryLane.targetReadback.state, "temporary_lane");
  for (const state of blockedStates) {
    assert.throws(() => adapter.createLiveDispatchReadinessEnvelope({
      ...baseLiveDispatchInput(),
      sourceAosRecordId: `dispatch-request-${state}`,
      targetReadback: {
        ...baseTargetReadback(),
        state
      }
    }, actor, probe), new RegExp(state));
  }
  assert.throws(() => adapter.createLiveDispatchReadinessEnvelope({
    ...baseLiveDispatchInput(),
    sourceAosRecordId: "dispatch-request-unconfirmed-successor",
    targetReadback: {
      ...baseTargetReadback(),
      state: "active_successor",
      successorConfirmed: false
    }
  }, actor, probe), /active_successor/);
  assert.throws(() => adapter.createLiveDispatchReadinessEnvelope({
    ...baseLiveDispatchInput(),
    sourceAosRecordId: "dispatch-request-role-mismatch",
    targetReadback: {
      ...baseTargetReadback(),
      roleId: "sable-security-reviewer"
    }
  }, actor, probe), /target_role_mismatch/);
  assert.throws(() => adapter.createLiveDispatchReadinessEnvelope({
    ...baseLiveDispatchInput(),
    sourceAosRecordId: "dispatch-request-missing-read-at",
    targetReadback: {
      ...baseTargetReadback(),
      readAt: " "
    }
  }, actor, probe), /missing_registry_readback_timestamp/);
  assert.throws(() => adapter.createLiveDispatchReadinessEnvelope({
    ...baseLiveDispatchInput(),
    sourceAosRecordId: "dispatch-request-stale-read-at",
    targetReadback: {
      ...baseTargetReadback(),
      readAt: "2026-01-01T00:00:00.000Z"
    }
  }, actor, probe), /stale_registry_readback/);
  assert.throws(() => adapter.createLiveDispatchReadinessEnvelope({
    ...baseLiveDispatchInput(),
    sourceAosRecordId: "dispatch-request-missing-canonical-name",
    targetReadback: {
      ...baseTargetReadback(),
      canonicalThreadName: ""
    }
  }, actor, probe), /missing_canonical_thread_name/);
  assert.throws(() => adapter.createLiveDispatchReadinessEnvelope({
    ...baseLiveDispatchInput(),
    sourceAosRecordId: "dispatch-request-prose-digest",
    payloadDigest: "redacted payload summary without digest syntax"
  }, actor, probe), /payloadDigest/);
  assert.throws(() => adapter.createLiveDispatchReadinessEnvelope({
    ...baseLiveDispatchInput(),
    dispatchMode: "live_send",
    requestedSend: true
  }, actor, probe), /Owner Intent/);
  assert.throws(() => adapter.createLiveDispatchReadinessEnvelope({
    ...baseLiveDispatchInput(),
    requestedTerminalReturnIngestion: true
  }, actor, probe), /terminal-return ingestion execution/);
  assert.throws(() => adapter.createLiveDispatchReadinessEnvelope({
    ...baseLiveDispatchInput(),
    requestedRegistryMutation: true
  }, actor, probe), /registry or generated bridge/);
  assert.throws(() => adapter.createLiveDispatchReadinessEnvelope({
    ...baseLiveDispatchInput(),
    requestedGeneratedBridgeMutation: true
  }, actor, probe), /registry or generated bridge/);
  assert.throws(() => adapter.createLiveDispatchReadinessEnvelope({
    ...baseLiveDispatchInput(),
    requestedThreadManagementActions: ["fork_thread"]
  }, actor, probe), /thread-management/);
  assert.throws(() => adapter.createLiveDispatchReadinessEnvelope({
    ...baseLiveDispatchInput(),
    readScope: ["diff --git a/private b/private\n@@ -1 +1 @@\n-secret\n+redacted"]
  }, actor, probe), /restricted raw_source/);

  assert.equal(probe.snapshot().sendPrimitiveCallCount, 0);
  assert.equal(probe.snapshot().threadManagementPrimitiveCallCount, 0);
  assert.equal(probe.snapshot().terminalReturnIngestionExecutionCount, 0);
  assert.equal(probe.snapshot().registryMutationCount, 0);
  assert.equal(probe.snapshot().generatedBridgeMutationCount, 0);
});

test("59k Stage A terminal returns require append-only receipt references before ingestion eligibility", () => {
  const store = new AosStore(createDefaultSeed());
  const adapter = new CodexIntegrationAdapter(store);
  const envelope = adapter.createLiveDispatchReadinessEnvelope(baseLiveDispatchInput(), actor, createNoSendPrimitiveProbe());
  const expected = expectedReturnContext(envelope);
  const valid = adapter.validateLiveDispatchTerminalReturnReadiness(expected, validReturn(envelope));
  const partial = adapter.validateLiveDispatchTerminalReturnReadiness(expected, {
    ...validReturn(envelope),
    status: "partial",
    blockers: ["Sable review pending"],
    nextOwner: "Arturo",
    handoffReturnState: "partial_return_sent"
  });
  const blocked = adapter.validateLiveDispatchTerminalReturnReadiness(expected, {
    ...validReturn(envelope),
    status: "blocked",
    blockers: ["Owner Intent absent"],
    nextOwner: "Arturo",
    handoffReturnState: "blocked_return_sent"
  });
  const changesRequested = adapter.validateLiveDispatchTerminalReturnReadiness(expected, {
    ...validReturn(envelope),
    status: "changes_requested",
    blockers: ["receipt gap"],
    nextOwner: "Ilya",
    handoffReturnState: "blocked_return_sent"
  });
  const returnBlocked = adapter.validateLiveDispatchTerminalReturnReadiness(expected, {
    ...validReturn(envelope),
    status: "blocked",
    blockers: ["cannot consume"],
    nextOwner: "Arturo",
    handoffReturnState: "return_blocked"
  });
  const history = [{ dedupeKey: valid.dedupeKey, status: valid.status }];

  assert.equal(valid.reason, "contract_valid_terminal_return_with_append_only_receipts");
  assert.equal(partial.disposition, "consumable");
  assert.equal(blocked.disposition, "consumable");
  assert.equal(changesRequested.disposition, "consumable");
  assert.equal(returnBlocked.disposition, "consumable");
  assert.equal(adapter.validateLiveDispatchTerminalReturnReadiness(expected, validReturn(envelope), history).disposition, "duplicate");
  assert.equal(adapter.validateLiveDispatchTerminalReturnReadiness(expected, {
    ...validReturn(envelope),
    status: "blocked",
    blockers: ["changed"],
    nextOwner: "Arturo",
    handoffReturnState: "blocked_return_sent"
  }, history).disposition, "conflicting");
  assert.equal(adapter.validateLiveDispatchTerminalReturnReadiness(expected, {
    ...validReturn(envelope),
    terminalTurnId: undefined
  }).reason, "missing_terminal_turn_id");
  assert.equal(adapter.validateLiveDispatchTerminalReturnReadiness(expected, {
    ...validReturn(envelope),
    originalTerminalPacketReference: undefined
  }).reason, "missing_original_terminal_packet_reference");
  assert.equal(adapter.validateLiveDispatchTerminalReturnReadiness(expected, {
    ...validReturn(envelope),
    originalTerminalPacketChecksum: "checksum prose"
  }).reason, "invalid_original_terminal_packet_checksum");
  assert.equal(adapter.validateLiveDispatchTerminalReturnReadiness(expected, {
    ...validReturn(envelope),
    coordinatorConsumedReceiptReference: undefined
  }).reason, "missing_coordinator_consumed_receipt_reference");
  assert.equal(adapter.validateLiveDispatchTerminalReturnReadiness(expected, {
    ...validReturn(envelope),
    coordinatorConsumedReceiptChecksum: "receipt checksum prose"
  }).reason, "invalid_coordinator_consumed_receipt_checksum");
  assert.equal(adapter.validateLiveDispatchTerminalReturnReadiness(expected, {
    ...validReturn(envelope),
    terminalIngestionExecutionRequested: true
  }).reason, "terminal_return_ingestion_execution_not_authorized");
  assert.equal(adapter.validateLiveDispatchTerminalReturnReadiness(expected, {
    ...validReturn(envelope),
    payloadKind: "commentary_only"
  }).reason, "commentary_only");
  assert.equal(adapter.validateLiveDispatchTerminalReturnReadiness(expected, {
    ...validReturn(envelope),
    payloadKind: "systemError"
  }).reason, "systemError");
  assert.equal(adapter.validateLiveDispatchTerminalReturnReadiness(expected, {
    ...validReturn(envelope),
    payloadKind: "no_assistant_payload"
  }).reason, "no_assistant_payload");
  assert.equal(adapter.validateLiveDispatchTerminalReturnReadiness(expected, {
    ...validReturn(envelope),
    payloadKind: "user_only"
  }).reason, "user_only");
  assert.equal(adapter.validateLiveDispatchTerminalReturnReadiness(expected, {
    ...validReturn(envelope),
    targetThreadState: "no_return"
  }).reason, "target_thread_state_not_usable");
  assert.equal(adapter.validateLiveDispatchTerminalReturnReadiness(expected, {
    ...validReturn(envelope),
    handoffReturnState: undefined
  }).reason, "missing_or_invalid_handoff_return_state");
  assert.equal(adapter.validateLiveDispatchTerminalReturnReadiness(expected, {
    ...validReturn(envelope),
    handoffReturnState: "return_gap_blocked"
  }).reason, "coordinator_recovery_state_not_target_terminal");
  assert.equal(adapter.validateLiveDispatchTerminalReturnReadiness(expected, {
    ...validReturn(envelope),
    sourceThreadId: "stale-thread"
  }).reason, "thread_identity_mismatch");
  assert.equal(adapter.validateLiveDispatchTerminalReturnReadiness(expected, {
    ...validReturn(envelope),
    parentRouteId: "stale-route"
  }).reason, "route_or_dispatch_mismatch");
  assert.equal(adapter.validateLiveDispatchTerminalReturnReadiness(expected, {
    ...validReturn(envelope),
    targetThreadState: "archived"
  }).reason, "target_thread_state_not_usable");
  assert.equal(adapter.validateLiveDispatchTerminalReturnReadiness(expected, {
    ...validReturn(envelope),
    status: "blocked",
    blockers: [],
    nextOwner: undefined,
    handoffReturnState: "blocked_return_sent"
  }).reason, "blocking_return_missing_next_owner_or_blocker");
  assert.equal(adapter.validateLiveDispatchTerminalReturnReadiness(expected, {
    ...validReturn(envelope),
    claims: { liveDispatch: true }
  }).reason, "terminal_return_overclaims_authority");
});

test("59k Stage A duplicate-send prevention precedes future primitive eligibility checks", () => {
  const store = new AosStore(createDefaultSeed());
  const adapter = new CodexIntegrationAdapter(store);
  const input = baseLiveDispatchInput();
  const firstProbe = createNoSendPrimitiveProbe();
  const secondProbe = createNoSendPrimitiveProbe();
  const executionProbe = createNoSendPrimitiveProbe();
  const envelope = adapter.createLiveDispatchReadinessEnvelope(input, actor, firstProbe);

  secondProbe.recordSendPrimitiveCall();
  secondProbe.recordThreadManagementPrimitiveCall("send_message");
  secondProbe.recordTerminalReturnIngestionExecution();
  secondProbe.recordRegistryMutation();
  secondProbe.recordGeneratedBridgeMutation();
  const duplicate = adapter.createLiveDispatchReadinessEnvelope(input, actor, secondProbe);
  executionProbe.recordSendPrimitiveCall();

  assert.equal(duplicate.envelopeId, envelope.envelopeId);
  assert.equal(store.queryAudit({ action: "codex.live_dispatch.duplicate_prevented" }).length, 1);
  assert.throws(() => adapter.createLiveDispatchReadinessEnvelope({
    ...input,
    sourceAosRecordId: "dispatch-request-execution-observed"
  }, actor, executionProbe), /probe observed execution/);
});

function baseLiveDispatchInput() {
  return {
    parentRouteId: "AOS-59f-live-dispatch-dry-run-no-send-authority-packet",
    sourceProjectId: "TCRN-AOS",
    initiativeId: "tcrn-aos-product-foundation",
    sourceAosRecordId: "dispatch-request-stage-a-001",
    sourceRecordClass: "dispatch_request",
    sourceAosBasisSha: "e2e856ad6d57f06f4c8ff32dc33d83a92b5ca989",
    workflowBasisSha: "e3a0c96ed322c7f9110f7494934c63fe0c85de4e",
    workflowPacketPath: "vault/initiatives/cross-project/active/tcrn-aos-product-foundation/59k-real-live-dispatch-terminal-return-implementation-execution-packet.md",
    targetRoleId: "ilya-full-stack-implementer",
    targetReadback: baseTargetReadback(),
    dispatchMode: "implementation_readiness",
    payloadClass: "terminal_return_request",
    payloadDigest: PAYLOAD_DIGEST,
    redactionProfile: "count_only_route_metadata",
    ownerIntent: {
      required: true,
      proofState: "not_granted"
    },
    retryLimit: 0,
    receiptReferenceExpectation: "required_before_ingestion"
  };
}

function baseTargetReadback() {
  return {
    state: "active",
    readAt: new Date().toISOString(),
    canonicalThreadName: "Ilya, Full-Stack Implementer",
    roleId: "ilya-full-stack-implementer",
    threadId: "019eb6d7-f130-70a0-8805-169cc337229b"
  };
}

function expectedReturnContext(envelope) {
  return {
    parentRouteId: envelope.parentRouteId,
    dispatchId: envelope.envelopeId,
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
    terminalTurnId: "019ed2-terminal-stage-a",
    parentRouteId: envelope.parentRouteId,
    dispatchId: envelope.envelopeId,
    status: "success",
    summary: "Stage A local validation only",
    blockers: [],
    handoffReturnState: "return_sent",
    payloadKind: "assistant_terminal",
    targetThreadState: "active",
    originalTerminalPacketReference: "evidence/live-dispatch-stage-a/original-terminal-packet.redacted.json",
    originalTerminalPacketChecksum: ORIGINAL_TERMINAL_PACKET_CHECKSUM,
    coordinatorConsumedReceiptReference: "evidence/live-dispatch-stage-a/coordinator-consumed-receipt.redacted.json",
    coordinatorConsumedReceiptChecksum: COORDINATOR_RECEIPT_CHECKSUM,
    terminalIngestionExecutionRequested: false,
    claims: {
      productAcceptance: false,
      finalMvpAcceptance: false,
      liveDispatch: false,
      deployment: false,
      push: false,
      ownerIntentExecuted: false,
      registryMutation: false,
      generatedBridgeMutation: false,
      codexSecurityScanCompleted: false
    }
  };
}
