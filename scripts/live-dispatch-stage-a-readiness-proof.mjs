import assert from "node:assert/strict";
import { AosStore, createDefaultSeed } from "../dist/packages/domain/src/index.js";
import {
  CodexIntegrationAdapter,
  createNoSendPrimitiveProbe
} from "../dist/packages/adapter-codex/src/index.js";

const parentRouteId = "AOS-59f-live-dispatch-dry-run-no-send-authority-packet";
const aosBasisSha = "e2e856ad6d57f06f4c8ff32dc33d83a92b5ca989";
const workflowBasisSha = "e3a0c96ed322c7f9110f7494934c63fe0c85de4e";
const workflowPacketPath = "vault/initiatives/cross-project/active/tcrn-aos-product-foundation/59k-real-live-dispatch-terminal-return-implementation-execution-packet.md";

const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "aos-59k-stage-a-proof"
};

const store = new AosStore(createDefaultSeed());
const adapter = new CodexIntegrationAdapter(store);
const probe = createNoSendPrimitiveProbe();
const input = baseInput();

const active = adapter.createLiveDispatchReadinessEnvelope(input, actor, probe);
const duplicate = adapter.createLiveDispatchReadinessEnvelope(input, actor, probe);
const changedRoute = adapter.createLiveDispatchReadinessEnvelope({
  ...input,
  parentRouteId: "AOS-59k-changed-route",
  sourceAosRecordId: "dispatch-request-changed-route"
}, actor, probe);
const changedTarget = adapter.createLiveDispatchReadinessEnvelope({
  ...input,
  sourceAosRecordId: "dispatch-request-changed-target",
  targetRoleId: "sable-security-reviewer",
  targetReadback: {
    ...targetReadback(),
    roleId: "sable-security-reviewer",
    canonicalThreadName: "Sable, Security & Privacy Reviewer",
    threadId: "019eb6d8-62d6-71b2-b715-0ba4dbe8759d"
  }
}, actor, probe);
const changedPayload = adapter.createLiveDispatchReadinessEnvelope({
  ...input,
  sourceAosRecordId: "dispatch-request-changed-payload",
  payloadDigest: "sha256:changed-payload"
}, actor, probe);
const changedBasis = adapter.createLiveDispatchReadinessEnvelope({
  ...input,
  sourceAosRecordId: "dispatch-request-changed-basis",
  sourceAosBasisSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
}, actor, probe);
const changedSchema = adapter.createLiveDispatchReadinessEnvelope({
  ...input,
  sourceAosRecordId: "dispatch-request-changed-schema",
  schemaVersion: "aos-real-live-dispatch-stage-a-v2"
}, actor, probe);
const successor = adapter.createLiveDispatchReadinessEnvelope({
  ...input,
  sourceAosRecordId: "dispatch-request-successor",
  targetReadback: {
    ...targetReadback(),
    state: "active_successor",
    threadId: "019ed2-active-successor",
    successorConfirmed: true
  }
}, actor, probe);
const temporaryLane = adapter.createLiveDispatchReadinessEnvelope({
  ...input,
  sourceAosRecordId: "dispatch-request-temporary-lane",
  targetReadback: {
    ...targetReadback(),
    state: "temporary_lane",
    threadId: "019ed2-temporary-lane",
    temporaryLaneAuthorized: true
  }
}, actor, probe);

const blockedTargetStates = [
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
].map((state) => blockedCase(`target_${state}`, {
  sourceAosRecordId: `dispatch-request-target-${state}`,
  targetReadback: {
    ...targetReadback(),
    state
  }
}));

const blockedExecutionCases = [
  ["live_send", { dispatchMode: "live_send", requestedSend: true }],
  ["terminal_ingestion_execution", { requestedTerminalReturnIngestion: true }],
  ["registry_mutation", { requestedRegistryMutation: true }],
  ["generated_bridge_mutation", { requestedGeneratedBridgeMutation: true }],
  ["thread_management", { requestedThreadManagementActions: ["handoff_thread"] }],
  ["raw_source", { readScope: ["diff --git a/private b/private\n@@ -1 +1 @@\n-secret\n+redacted"] }],
  ["raw_scanner_output", { readScope: ["semgrep scanner raw output vulnerability finding"] }],
  ["raw_secret_scan_output", { readScope: ["raw secret scan output"] }],
  ["private_evidence", { readScope: ["private evidence payload"] }]
].map(([name, override]) => blockedCase(name, override));

const expected = expectedReturnContext(active);
const valid = adapter.validateLiveDispatchTerminalReturnReadiness(expected, terminalReturn(active));
const history = [{ dedupeKey: valid.dedupeKey, status: valid.status }];
const terminalCases = [
  ["success", valid],
  ["partial", adapter.validateLiveDispatchTerminalReturnReadiness(expected, {
    ...terminalReturn(active),
    status: "partial",
    blockers: ["Sable review pending"],
    nextOwner: "Arturo",
    handoffReturnState: "partial_return_sent"
  })],
  ["blocked", adapter.validateLiveDispatchTerminalReturnReadiness(expected, {
    ...terminalReturn(active),
    status: "blocked",
    blockers: ["Owner Intent absent"],
    nextOwner: "Arturo",
    handoffReturnState: "blocked_return_sent"
  })],
  ["changes_requested", adapter.validateLiveDispatchTerminalReturnReadiness(expected, {
    ...terminalReturn(active),
    status: "changes_requested",
    blockers: ["receipt gap"],
    nextOwner: "Ilya",
    handoffReturnState: "blocked_return_sent"
  })],
  ["return_blocked", adapter.validateLiveDispatchTerminalReturnReadiness(expected, {
    ...terminalReturn(active),
    status: "blocked",
    blockers: ["cannot consume"],
    nextOwner: "Arturo",
    handoffReturnState: "return_blocked"
  })],
  ["duplicate", adapter.validateLiveDispatchTerminalReturnReadiness(expected, terminalReturn(active), history)],
  ["conflicting", adapter.validateLiveDispatchTerminalReturnReadiness(expected, {
    ...terminalReturn(active),
    status: "blocked",
    blockers: ["changed status"],
    nextOwner: "Arturo",
    handoffReturnState: "blocked_return_sent"
  }, history)],
  ["commentary_only", adapter.validateLiveDispatchTerminalReturnReadiness(expected, { ...terminalReturn(active), payloadKind: "commentary_only" })],
  ["systemError", adapter.validateLiveDispatchTerminalReturnReadiness(expected, { ...terminalReturn(active), payloadKind: "systemError" })],
  ["no_assistant_payload", adapter.validateLiveDispatchTerminalReturnReadiness(expected, { ...terminalReturn(active), payloadKind: "no_assistant_payload" })],
  ["user_only", adapter.validateLiveDispatchTerminalReturnReadiness(expected, { ...terminalReturn(active), payloadKind: "user_only" })],
  ["no_return", adapter.validateLiveDispatchTerminalReturnReadiness(expected, { ...terminalReturn(active), targetThreadState: "no_return" })],
  ["missing_handoff", adapter.validateLiveDispatchTerminalReturnReadiness(expected, { ...terminalReturn(active), handoffReturnState: undefined })],
  ["missing_terminal_turn", adapter.validateLiveDispatchTerminalReturnReadiness(expected, { ...terminalReturn(active), terminalTurnId: undefined })],
  ["missing_original_packet", adapter.validateLiveDispatchTerminalReturnReadiness(expected, { ...terminalReturn(active), originalTerminalPacketReference: undefined })],
  ["missing_coordinator_receipt", adapter.validateLiveDispatchTerminalReturnReadiness(expected, { ...terminalReturn(active), coordinatorConsumedReceiptReference: undefined })],
  ["stale_source", adapter.validateLiveDispatchTerminalReturnReadiness(expected, { ...terminalReturn(active), sourceThreadId: "stale-thread" })],
  ["stale_route", adapter.validateLiveDispatchTerminalReturnReadiness(expected, { ...terminalReturn(active), parentRouteId: "stale-route" })],
  ["archived_target", adapter.validateLiveDispatchTerminalReturnReadiness(expected, { ...terminalReturn(active), targetThreadState: "archived" })],
  ["overclaim", adapter.validateLiveDispatchTerminalReturnReadiness(expected, { ...terminalReturn(active), claims: { productAcceptance: true } })],
  ["ingestion_execution_requested", adapter.validateLiveDispatchTerminalReturnReadiness(expected, { ...terminalReturn(active), terminalIngestionExecutionRequested: true })]
];

const duplicateProbe = createNoSendPrimitiveProbe();
duplicateProbe.recordSendPrimitiveCall();
duplicateProbe.recordThreadManagementPrimitiveCall("send_message");
duplicateProbe.recordTerminalReturnIngestionExecution();
duplicateProbe.recordRegistryMutation();
duplicateProbe.recordGeneratedBridgeMutation();
const replayLinked = adapter.createLiveDispatchReadinessEnvelope(input, actor, duplicateProbe);
const auditCounts = {
  readiness: store.queryAudit({ action: "codex.live_dispatch.readiness" }).length,
  duplicatePrevented: store.queryAudit({ action: "codex.live_dispatch.duplicate_prevented" }).length,
  blocked: store.queryAudit({ action: "codex.live_dispatch.blocked" }).length
};
const probeSnapshot = probe.snapshot();
const terminalSummary = terminalCases.reduce((acc, [, result]) => {
  acc[result.disposition] = (acc[result.disposition] ?? 0) + 1;
  return acc;
}, {});
const noClaims = {
  realLiveDispatchExecuted: false,
  externalThreadMessageCreated: false,
  terminalReturnIngestionExecuted: false,
  registryMutation: false,
  generatedBridgeMutation: false,
  threadManagementPrimitiveExecuted: false,
  deploymentRuntimeExecution: false,
  productAcceptance: false,
  finalMvpAcceptance: false,
  ownerIntentExecution: false,
  codexSecurityScan: "not_run",
  defensiveProgrammingCalibration: "triggered_followup_required"
};

assert.equal(active.sendPrimitiveCallCount, 0);
assert.equal(active.threadManagementPrimitiveCallCount, 0);
assert.equal(active.terminalReturnIngestionExecutionCount, 0);
assert.equal(active.registryMutationCount, 0);
assert.equal(active.generatedBridgeMutationCount, 0);
assert.equal(duplicate.envelopeId, active.envelopeId);
assert.equal(replayLinked.envelopeId, active.envelopeId);
assert.notEqual(changedRoute.envelopeId, active.envelopeId);
assert.notEqual(changedTarget.envelopeId, active.envelopeId);
assert.notEqual(changedPayload.envelopeId, active.envelopeId);
assert.notEqual(changedBasis.envelopeId, active.envelopeId);
assert.notEqual(changedSchema.envelopeId, active.envelopeId);
assert.equal(successor.targetReadback.state, "active_successor");
assert.equal(temporaryLane.targetReadback.state, "temporary_lane");
assert.equal(probeSnapshot.sendPrimitiveCallCount, 0);
assert.equal(probeSnapshot.threadManagementPrimitiveCallCount, 0);
assert.equal(probeSnapshot.terminalReturnIngestionExecutionCount, 0);
assert.equal(probeSnapshot.registryMutationCount, 0);
assert.equal(probeSnapshot.generatedBridgeMutationCount, 0);
assert.equal(terminalSummary.consumable, 5);
assert.equal(terminalSummary.duplicate, 1);
assert.equal(terminalSummary.conflicting, 1);
assert.equal(terminalSummary.non_consumable, 8);
assert.equal(terminalSummary.blocked, 6);
assert.equal(auditCounts.readiness, 8);
assert.equal(auditCounts.duplicatePrevented, 2);
assert.equal(auditCounts.blocked, blockedTargetStates.length + blockedExecutionCases.length);
assert.deepEqual(Object.values(noClaims).filter((value) => value === true), []);

console.log(JSON.stringify({
  ok: true,
  checkpoint: {
    parentRouteId,
    aosBasisSha,
    workflowBasisSha,
    workflowPacketPath,
    schemaVersion: active.schemaVersion,
    returnContractVersion: active.returnContractVersion
  },
  envelope: {
    envelopeId: active.envelopeId,
    duplicateEnvelopeId: duplicate.envelopeId,
    replayLinkedEnvelopeId: replayLinked.envelopeId,
    changedRouteEnvelopeId: changedRoute.envelopeId,
    changedTargetEnvelopeId: changedTarget.envelopeId,
    changedPayloadEnvelopeId: changedPayload.envelopeId,
    changedBasisEnvelopeId: changedBasis.envelopeId,
    changedSchemaEnvelopeId: changedSchema.envelopeId,
    sendPrimitiveEligibilityState: active.sendPrimitiveEligibilityState,
    retryLimit: active.retryLimit,
    idempotencyKeyPresent: Boolean(active.idempotencyKey),
    dedupeKeyPresent: Boolean(active.dedupeKey),
    replayGroupPresent: Boolean(active.replayGroup)
  },
  counters: {
    sendPrimitiveCallCount: active.sendPrimitiveCallCount,
    threadManagementPrimitiveCallCount: active.threadManagementPrimitiveCallCount,
    terminalReturnIngestionExecutionCount: active.terminalReturnIngestionExecutionCount,
    registryMutationCount: active.registryMutationCount,
    generatedBridgeMutationCount: active.generatedBridgeMutationCount
  },
  targetReadback: {
    acceptedStates: [active.targetReadback.state, successor.targetReadback.state, temporaryLane.targetReadback.state],
    blockedStates: blockedTargetStates.map(({ name }) => name.replace("target_", "")),
    blockedCount: blockedTargetStates.length
  },
  terminalReturns: {
    summary: terminalSummary,
    acceptedHandoffReturnStates: active.expectedHandoffReturnStates,
    coordinatorRecoveryStatesConsumable: false,
    receiptReferencesRequired: true,
    terminalIngestionExecutionCount: 0,
    cases: terminalCases.map(([name, result]) => ({
      name,
      disposition: result.disposition,
      reason: result.reason,
      blockerCount: result.blockerCount,
      overclaimCount: result.overclaimCount,
      restrictedFindingCount: result.restrictedFindingCount
    }))
  },
  duplicateReplay: {
    duplicateSendPreventedBeforePrimitiveEligibility: true,
    retryLimitPreventsDuplicateLiveMessage: active.retryLimit === 0,
    restartResumeReplayLinkedToPriorAudit: replayLinked.envelopeId === active.envelopeId,
    coordinatorRecoveryStatesBlocked: terminalCases.some(([name, result]) => name === "no_return" && result.reason === "target_thread_state_not_usable")
  },
  auditRedaction: {
    ...auditCounts,
    redactedCountOnly: true,
    originalTerminalPacketReference: terminalReturn(active).originalTerminalPacketReference,
    coordinatorConsumedReceiptReference: terminalReturn(active).coordinatorConsumedReceiptReference,
    rawRestrictedPayloadStored: false,
    blockedExecutionCases: blockedExecutionCases.map(({ name, reason }) => ({ name, reason }))
  },
  noClaims
}, null, 2));

function blockedCase(name, override) {
  try {
    adapter.createLiveDispatchReadinessEnvelope({
      ...baseInput(),
      sourceAosRecordId: `dispatch-request-blocked-${name}`,
      ...override
    }, actor, probe);
  } catch (error) {
    return { name, reason: error instanceof Error ? error.message : String(error) };
  }
  throw new Error(`Expected Stage A blocked case: ${name}`);
}

function baseInput() {
  return {
    parentRouteId,
    sourceProjectId: "TCRN-AOS",
    initiativeId: "tcrn-aos-product-foundation",
    sourceAosRecordId: "dispatch-request-stage-a-001",
    sourceRecordClass: "dispatch_request",
    sourceAosBasisSha: aosBasisSha,
    workflowBasisSha,
    workflowPacketPath,
    targetRoleId: "ilya-full-stack-implementer",
    targetReadback: targetReadback(),
    dispatchMode: "implementation_readiness",
    payloadClass: "terminal_return_request",
    payloadDigest: "sha256:stage-a-redacted-payload",
    redactionProfile: "count_only_route_metadata",
    ownerIntent: {
      required: true,
      proofState: "not_granted"
    },
    retryLimit: 0,
    receiptReferenceExpectation: "required_before_ingestion"
  };
}

function targetReadback() {
  return {
    state: "active",
    readAt: "2026-06-17T00:00:00.000Z",
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

function terminalReturn(envelope) {
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
    originalTerminalPacketChecksum: "sha256:original-terminal-packet",
    coordinatorConsumedReceiptReference: "evidence/live-dispatch-stage-a/coordinator-consumed-receipt.redacted.json",
    coordinatorConsumedReceiptChecksum: "sha256:coordinator-consumed-receipt",
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
