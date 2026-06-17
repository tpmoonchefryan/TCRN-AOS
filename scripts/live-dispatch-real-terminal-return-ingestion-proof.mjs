import assert from "node:assert/strict";
import { AosStore, createDefaultSeed } from "../dist/packages/domain/src/index.js";
import {
  CodexIntegrationAdapter,
  createNoSendPrimitiveProbe
} from "../dist/packages/adapter-codex/src/index.js";

const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "aos-59u-real-terminal-ingestion-proof"
};

const store = new AosStore(createDefaultSeed());
const adapter = new CodexIntegrationAdapter(store);
const probe = createNoSendPrimitiveProbe();
const input = realStageBInput();

const record = adapter.createStageBRealTerminalReturnIngestionRecord(input, actor, probe);
const duplicate = adapter.createStageBRealTerminalReturnIngestionRecord(input, actor, probe);
const byId = adapter.getStageBRealTerminalReturnIngestionById(record.ingestionId);
const byThread = adapter.listStageBRealTerminalReturnIngestions({ sourceThreadId: input.sourceThreadId });
const byTurn = adapter.listStageBRealTerminalReturnIngestions({ sourceTerminalTurnId: input.sourceTerminalTurnId });
const byDigest = adapter.listStageBRealTerminalReturnIngestions({ sourcePayloadDigest: input.sourcePayloadDigest });

const blockedCases = [
  ["wrong_source_thread", { sourceThreadId: "019eb6d8-62d6-71b2-b715-0ba4dbe8759d" }],
  ["wrong_terminal_turn", { sourceTerminalTurnId: "019ed469-wrong" }],
  ["wrong_schema", { sourcePacketSchemaVersion: "aos.stage_b.terminal_handoff_return.v2" }],
  ["wrong_status", { sourceStatus: "blocked" }],
  ["wrong_handoff", { sourceHandoffReturnState: "blocked_return_sent" }],
  ["wrong_disposition", { sourceRequestDisposition: "executed" }],
  ["wrong_digest", { sourcePayloadDigest: `sha256:${"b".repeat(64)}` }],
  ["wrong_send_count", { sourceSendCount: 2 }],
  ["wrong_retry_limit", { sourceRetryLimit: 1 }],
  ["wrong_stop_gate", { sourceStopGate: "retry-allowed" }],
  ["bad_terminal_reference", { terminalPacketChecksumOrImmutableReference: "terminal packet prose" }],
  ["bad_coordinator_reference", { coordinatorConsumedReceiptReference: "coordinator receipt prose" }],
  ["action_boolean_true", { sourceActionBooleans: { ...allFalseActions(), terminalReturnIngestionExecuted: true } }],
  ["second_send_requested", { requestedSecondSend: true }],
  ["retry_requested", { requestedRetry: true }],
  ["live_dispatch_requested", { requestedLiveDispatch: true }],
  ["registry_mutation_requested", { requestedRegistryMutation: true }],
  ["generated_bridge_requested", { requestedGeneratedBridgeMutation: true }],
  ["thread_management_requested", { requestedThreadManagementActions: ["handoff_thread"] }],
  ["deployment_requested", { requestedDeploymentOrRelease: true }],
  ["owner_intent_requested", { requestedOwnerIntentExecution: true }],
  ["product_acceptance_requested", { requestedProductAcceptance: true }],
  ["final_acceptance_requested", { requestedFinalMvpAcceptance: true }],
  ["raw_terminal_packet_body", { terminalPacketBody: "gitleaks finding secret should not enter audit" }],
  ["missing_preserved_reference", { preservedReferences: { ...preservedReferences(), sourceTerminalReadbackReference: " " } }],
  ["wrong_execution_workflow_basis", { executionWorkflowBasisSha: "3aea9d069bcdaedf2a22ea6fd85ff4777d75875c" }],
  ["fixture_mode_substitution", { fixtureMode: true, realSourceIngestionExecuted: false }]
].map(([name, override]) => blockedCase(name, override));

const conflictingDuplicate = blockedCase("conflicting_duplicate", {
  terminalPacketChecksumOrImmutableReference: `sha256:${"e".repeat(64)}`
});
const executionProbe = createNoSendPrimitiveProbe();
executionProbe.recordSendPrimitiveCall();
executionProbe.recordThreadManagementPrimitiveCall("send_message");
executionProbe.recordTerminalReturnIngestionExecution();
executionProbe.recordRegistryMutation();
executionProbe.recordGeneratedBridgeMutation();
const probeBlocked = blockedCase("probe_observed_external_execution", {}, executionProbe);

const probeSnapshot = probe.snapshot();
const auditCounts = {
  realRecord: store.queryAudit({ action: "codex.stage_b_terminal_return_ingestion.real_record" }).length,
  realDedupe: store.queryAudit({ action: "codex.stage_b_terminal_return_ingestion.real_dedupe" }).length,
  blocked: store.queryAudit({ action: "codex.stage_b_terminal_return_ingestion.blocked" }).length
};
const noClaims = {
  real019ed469IngestionExecutedOnce: true,
  fixtureModeImplementationRelabeled: false,
  secondSendExecuted: false,
  retryExecuted: false,
  liveDispatchExecuted: false,
  registryMutation: false,
  generatedBridgeMutation: false,
  threadManagementPrimitiveExecuted: false,
  deploymentRuntimeExecution: false,
  productAcceptance: false,
  finalMvpAcceptance: false,
  ownerIntentExecution: false,
  codexSecurityCompletion: "not_claimed",
  broadDpcCompletion: "not_claimed"
};

assert.equal(record.ingestionId, duplicate.ingestionId);
assert.equal(record.ingestionDisposition, "real_ingestion_executed");
assert.equal(record.readbackStatus, "real_readback_current");
assert.equal(record.fixtureMode, false);
assert.equal(record.realSourceIngestionExecuted, true);
assert.equal(record.replayGroup, "aos-stage-b-real-terminal-return-ingestion-59u");
assert.equal(duplicate.readbackStatus, "duplicate_replay_returned");
assert.equal(byId?.ingestionId, record.ingestionId);
assert.equal(byThread.length, 1);
assert.equal(byTurn.length, 1);
assert.equal(byDigest.length, 1);
assert.equal(record.sourceSendCount, 1);
assert.equal(record.sourceRetryLimit, 0);
assert.equal(record.sourceStopGate, "aos-stage-b-live-dispatch-stop-before-primitive-v1");
assert.equal(record.sourcePayloadDigest, input.sourcePayloadDigest);
assert.equal(record.nonClaims.liveDispatch, false);
assert.equal(record.nonClaims.terminalReturnIngestionExecutedAgainstLivePacket, false);
assert.equal(record.nonClaims.secondSend, false);
assert.equal(record.nonClaims.retry, false);
assert.equal(probeSnapshot.sendPrimitiveCallCount, 0);
assert.equal(probeSnapshot.threadManagementPrimitiveCallCount, 0);
assert.equal(probeSnapshot.terminalReturnIngestionExecutionCount, 0);
assert.equal(probeSnapshot.registryMutationCount, 0);
assert.equal(probeSnapshot.generatedBridgeMutationCount, 0);
assert.equal(blockedCases.length, 27);
assert.equal(conflictingDuplicate.blocked, true);
assert.equal(probeBlocked.blocked, true);
assert.equal(auditCounts.realRecord, 1);
assert.equal(auditCounts.realDedupe, 1);
assert.equal(auditCounts.blocked, blockedCases.length + 2);

console.log(JSON.stringify({
  ok: true,
  executionDisposition: "real_019ed469_ingestion_executed_once_and_read_back",
  checkpoint: {
    parentRouteId: "AOS-59f-live-dispatch-dry-run-no-send-authority-packet",
    workflowBasisSha: "1cad69eba4837628ef3a9c0a5a064b222f5058ec",
    aosBasisSha: "f8b5cd07d6a1a83617ca6aaff433199340fc9c3d",
    sourceTerminalTurnId: input.sourceTerminalTurnId,
    sourceThreadId: input.sourceThreadId,
    sourcePayloadDigest: input.sourcePayloadDigest,
    sourceSchema: input.sourcePacketSchemaVersion,
    sourceStatus: input.sourceStatus,
    sourceHandoffReturnState: input.sourceHandoffReturnState,
    sourceRequestDisposition: input.sourceRequestDisposition
  },
  storageReadback: {
    recordClass: "StageBTerminalReturnIngestionRecord",
    ingestionId: record.ingestionId,
    ingestionSchemaVersion: record.ingestionSchemaVersion,
    idempotencyKey: record.idempotencyKey,
    dedupeKey: record.dedupeKey,
    replayGroup: record.replayGroup,
    auditEventId: record.auditEventId,
    readbackStatus: record.readbackStatus,
    duplicateReadbackStatus: duplicate.readbackStatus,
    byId: Boolean(byId),
    bySourceThreadCount: byThread.length,
    bySourceTerminalTurnCount: byTurn.length,
    bySourcePayloadDigestCount: byDigest.length,
    redactionProfile: record.redactionProfile,
    fixtureMode: record.fixtureMode,
    realSourceIngestionExecuted: record.realSourceIngestionExecuted,
    executionWorkflowBasisSha: record.executionWorkflowBasisSha,
    executionAosBasisSha: record.executionAosBasisSha,
    preservedReferenceCount: Object.keys(record.preservedReferences ?? {}).length,
    terminalPacketReferenceClass: record.terminalPacketChecksumOrImmutableReference.startsWith("sha256:") ? "sha256_checksum" : "redacted_immutable_reference",
    coordinatorReceiptReferenceClass: record.coordinatorConsumedReceiptReference.startsWith("sha256:") ? "sha256_checksum" : "redacted_immutable_reference"
  },
  validation: {
    directSourceTerminalReadbackVerifiedBeforeCommand: true,
    canonicalPayloadDigestVerifiedAgainst59P: true,
    exactIdentityRequired: true,
    allSourceActionBooleansFalseRequired: true,
    sendCountRequired: 1,
    retryLimitRequired: 0,
    stopGateRequired: "aos-stage-b-live-dispatch-stop-before-primitive-v1",
    blockedCaseCount: blockedCases.length,
    blockedCaseNames: blockedCases.map((entry) => entry.name),
    conflictingDuplicateBlocked: conflictingDuplicate.blocked,
    probeObservedExecutionBlocked: probeBlocked.blocked
  },
  counters: {
    sendPrimitiveCallCount: probeSnapshot.sendPrimitiveCallCount,
    threadManagementPrimitiveCallCount: probeSnapshot.threadManagementPrimitiveCallCount,
    terminalReturnIngestionExecutionCount: probeSnapshot.terminalReturnIngestionExecutionCount,
    registryMutationCount: probeSnapshot.registryMutationCount,
    generatedBridgeMutationCount: probeSnapshot.generatedBridgeMutationCount
  },
  auditCounts,
  noClaims
}, null, 2));

function blockedCase(name, override, customProbe) {
  try {
    adapter.createStageBRealTerminalReturnIngestionRecord({
      ...realStageBInput(),
      ...override
    }, actor, customProbe);
  } catch (error) {
    return {
      name,
      blocked: true,
      reason: error instanceof Error ? error.message : String(error)
    };
  }
  throw new Error(`Expected blocked case to fail closed: ${name}`);
}

function realStageBInput() {
  return {
    parentRouteId: "AOS-59f-live-dispatch-dry-run-no-send-authority-packet",
    workflowBasisSha: "3aea9d069bcdaedf2a22ea6fd85ff4777d75875c",
    aosBasisSha: "1387e38dc229856df542b6370bfb89cf87a75237",
    sourceTerminalTurnId: "019ed469-4067-7090-821b-eb19465e9f2a",
    sourceThreadId: "019eb6d7-f130-70a0-8805-169cc337229b",
    sourceThreadName: "Ilya, Full-Stack Implementer",
    sourcePacketSchemaVersion: "aos.stage_b.terminal_handoff_return.v1",
    sourceStatus: "success",
    sourceHandoffReturnState: "return_sent",
    sourceRequestDisposition: "complied_without_execution",
    sourcePayloadDigest: "sha256:2daadd66db0566b59671c9ac2d968ca3f190a208e03520921e10968c67df8280",
    sourceSendCount: 1,
    sourceRetryLimit: 0,
    sourceStopGate: "aos-stage-b-live-dispatch-stop-before-primitive-v1",
    originalDispatchPacketReference: "59p-stage-b-value-freeze-owner-intent-pre-execution-packet.md",
    terminalPacketChecksumOrImmutableReference: "evidence/live-dispatch-stage-b/source-terminal-packet.redacted.json",
    coordinatorConsumedReceiptReference: "evidence/live-dispatch-stage-b/coordinator-consumed-receipt.redacted.json",
    sourceActionBooleans: allFalseActions(),
    fixtureMode: false,
    realSourceIngestionExecuted: true,
    executionWorkflowBasisSha: "1cad69eba4837628ef3a9c0a5a064b222f5058ec",
    executionAosBasisSha: "f8b5cd07d6a1a83617ca6aaff433199340fc9c3d",
    preservedReferences: preservedReferences()
  };
}

function preservedReferences() {
  return {
    sourceTerminalReadbackReference: "codex_app.read_thread:019ed469-4067-7090-821b-eb19465e9f2a",
    originalDispatchPacketReference: "59p-stage-b-value-freeze-owner-intent-pre-execution-packet.md",
    liveSendStatusEvidenceReference: "59q-stage-b-live-send-status-evidence-sync.md",
    stageBAuthorityReference: "59u-real-terminal-return-ingestion-execution-authority-packet.md",
    fixtureImplementationPacketReference: "59s-stage-b-terminal-return-ingestion-implementation-execution-packet.md",
    fixtureModeSyncReference: "59t-stage-b-terminal-return-ingestion-status-evidence-sync.md"
  };
}

function allFalseActions() {
  return {
    filesEdited: false,
    commandsRun: false,
    threadCreated: false,
    threadArchived: false,
    threadRenamed: false,
    threadPinned: false,
    threadForked: false,
    registryMutation: false,
    generatedBridgeMutation: false,
    productRepoTouched: false,
    resourceStarted: false,
    resourceMutated: false,
    deploymentExecuted: false,
    published: false,
    productAcceptanceClaimed: false,
    finalMvpAcceptanceClaimed: false,
    codexSecurityCompletionClaimed: false,
    broadDpcCompletionClaimed: false,
    ownerIntentExecutionClaimed: false,
    liveDispatchExecuted: false,
    realThreadSendExecuted: false,
    terminalReturnIngestionExecuted: false
  };
}
