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
  sessionId: "aos-59s-stage-b-terminal-ingestion-test"
};

test("59S Stage B fixture records terminal-return ingestion readbacks without real ingestion or send execution", () => {
  const store = new AosStore(createDefaultSeed());
  const adapter = new CodexIntegrationAdapter(store);
  const probe = createNoSendPrimitiveProbe();
  const input = baseStageBInput();

  const record = adapter.createStageBTerminalReturnIngestionRecord(input, actor, probe);
  const duplicate = adapter.createStageBTerminalReturnIngestionRecord(input, actor, probe);
  const byId = adapter.getStageBTerminalReturnIngestionById(record.ingestionId);
  const byThread = adapter.listStageBTerminalReturnIngestions({ sourceThreadId: input.sourceThreadId });
  const byTurn = adapter.listStageBTerminalReturnIngestions({ sourceTerminalTurnId: input.sourceTerminalTurnId });
  const byDigest = adapter.listStageBTerminalReturnIngestions({ sourcePayloadDigest: input.sourcePayloadDigest.toUpperCase() });

  assert.equal(record.ingestionSchemaVersion, "aos.stage_b.terminal_return_ingestion_record.v1");
  assert.equal(record.sourceTerminalTurnId, "019ed469-4067-7090-821b-eb19465e9f2a");
  assert.equal(record.sourceThreadId, "019eb6d7-f130-70a0-8805-169cc337229b");
  assert.equal(record.sourcePayloadDigest, "sha256:2daadd66db0566b59671c9ac2d968ca3f190a208e03520921e10968c67df8280");
  assert.equal(record.sourceStatus, "success");
  assert.equal(record.sourceHandoffReturnState, "return_sent");
  assert.equal(record.sourceRequestDisposition, "complied_without_execution");
  assert.equal(record.sourceSendCount, 1);
  assert.equal(record.sourceRetryLimit, 0);
  assert.equal(record.sourceStopGate, "aos-stage-b-live-dispatch-stop-before-primitive-v1");
  assert.equal(record.workflowBasisSha, "3aea9d069bcdaedf2a22ea6fd85ff4777d75875c");
  assert.equal(record.aosBasisSha, "1387e38dc229856df542b6370bfb89cf87a75237");
  assert.equal(record.ingestionDisposition, "fixture_mode_readback_recorded");
  assert.equal(record.replayGroup, "aos-stage-b-terminal-return-ingestion-59s");
  assert.equal(record.readbackStatus, "fixture_readback_current");
  assert.equal(record.redactionProfile, "count_only_terminal_return_metadata");
  assert.equal(record.nonClaims.liveDispatch, false);
  assert.equal(record.nonClaims.terminalReturnIngestionExecutedAgainstLivePacket, false);
  assert.equal(record.nonClaims.productAcceptance, "not_claimed");
  assert.equal(duplicate.ingestionId, record.ingestionId);
  assert.equal(duplicate.readbackStatus, "duplicate_replay_returned");
  assert.equal(byId?.ingestionId, record.ingestionId);
  assert.equal(byThread.length, 1);
  assert.equal(byTurn.length, 1);
  assert.equal(byDigest.length, 1);
  assert.equal(store.queryAudit({ action: "codex.stage_b_terminal_return_ingestion.fixture_record" }).length, 1);
  assert.equal(store.queryAudit({ action: "codex.stage_b_terminal_return_ingestion.dedupe" }).length, 1);
  assert.equal(probe.snapshot().sendPrimitiveCallCount, 0);
  assert.equal(probe.snapshot().threadManagementPrimitiveCallCount, 0);
  assert.equal(probe.snapshot().terminalReturnIngestionExecutionCount, 0);
  assert.equal(probe.snapshot().registryMutationCount, 0);
  assert.equal(probe.snapshot().generatedBridgeMutationCount, 0);
});

test("59S Stage B fixture ingestion fails closed on substituted identity, overclaims, forbidden execution, and restricted payloads", () => {
  const store = new AosStore(createDefaultSeed());
  const adapter = new CodexIntegrationAdapter(store);
  const accepted = adapter.createStageBTerminalReturnIngestionRecord(baseStageBInput(), actor, createNoSendPrimitiveProbe());

  assert.throws(() => adapter.createStageBTerminalReturnIngestionRecord({
    ...baseStageBInput(),
    terminalPacketChecksumOrImmutableReference: `sha256:${"f".repeat(64)}`
  }, actor), /conflicting duplicate/);

  const blockedCases = [
    ["wrong_source_thread", { sourceThreadId: "019eb6d8-62d6-71b2-b715-0ba4dbe8759d" }, /source_thread_mismatch/],
    ["wrong_terminal_turn", { sourceTerminalTurnId: "019ed469-wrong" }, /source_terminal_turn_mismatch/],
    ["wrong_schema", { sourcePacketSchemaVersion: "aos.stage_b.terminal_handoff_return.v2" }, /source_schema_mismatch/],
    ["wrong_status", { sourceStatus: "blocked" }, /source_status_mismatch/],
    ["wrong_handoff", { sourceHandoffReturnState: "blocked_return_sent" }, /source_handoff_return_state_mismatch/],
    ["wrong_disposition", { sourceRequestDisposition: "executed" }, /source_request_disposition_mismatch/],
    ["wrong_digest", { sourcePayloadDigest: `sha256:${"b".repeat(64)}` }, /source_payload_digest_mismatch/],
    ["wrong_send_count", { sourceSendCount: 2 }, /source_send_count_mismatch/],
    ["wrong_retry_limit", { sourceRetryLimit: 1 }, /source_retry_limit_mismatch/],
    ["wrong_stop_gate", { sourceStopGate: "retry-allowed" }, /source_stop_gate_mismatch/],
    ["bad_terminal_reference", { terminalPacketChecksumOrImmutableReference: "terminal packet prose" }, /terminal packet checksum or immutable redacted reference/],
    ["bad_coordinator_reference", { coordinatorConsumedReceiptReference: "coordinator receipt prose" }, /coordinator receipt checksum or immutable redacted reference/],
    ["action_boolean_true", { sourceActionBooleans: { ...allFalseActions(), liveDispatchExecuted: true } }, /action booleans false/],
    ["second_send_requested", { requestedSecondSend: true }, /blocks execution/],
    ["retry_requested", { requestedRetry: true }, /blocks execution/],
    ["live_dispatch_requested", { requestedLiveDispatch: true }, /blocks execution/],
    ["registry_mutation_requested", { requestedRegistryMutation: true }, /blocks execution/],
    ["generated_bridge_requested", { requestedGeneratedBridgeMutation: true }, /blocks execution/],
    ["thread_management_requested", { requestedThreadManagementActions: ["handoff_thread"] }, /blocks execution/],
    ["deployment_requested", { requestedDeploymentOrRelease: true }, /blocks execution/],
    ["owner_intent_requested", { requestedOwnerIntentExecution: true }, /blocks execution/],
    ["product_acceptance_requested", { requestedProductAcceptance: true }, /blocks execution/],
    ["final_acceptance_requested", { requestedFinalMvpAcceptance: true }, /blocks execution/],
    ["raw_terminal_packet_body", { terminalPacketBody: "-----BEGIN PRIVATE KEY-----\nredacted\n-----END PRIVATE KEY-----" }, /restricted private_key/],
    ["raw_coordinator_receipt_body", { coordinatorReceiptBody: "raw secret scan output" }, /restricted raw_secret_scan_output/]
  ];

  for (const [name, override, pattern] of blockedCases) {
    assert.throws(() => adapter.createStageBTerminalReturnIngestionRecord({
      ...baseStageBInput(),
      ...override
    }, actor), pattern, name);
  }
  assert.equal(adapter.listStageBTerminalReturnIngestions().length, 1);
  assert.equal(adapter.getStageBTerminalReturnIngestionById(accepted.ingestionId)?.ingestionId, accepted.ingestionId);
});

test("59S Stage B fixture ingestion blocks if primitive probes observed execution", () => {
  const store = new AosStore(createDefaultSeed());
  const adapter = new CodexIntegrationAdapter(store);
  const probe = createNoSendPrimitiveProbe();

  probe.recordSendPrimitiveCall();
  probe.recordThreadManagementPrimitiveCall("send_message");
  probe.recordTerminalReturnIngestionExecution();
  probe.recordRegistryMutation();
  probe.recordGeneratedBridgeMutation();

  assert.throws(() => adapter.createStageBTerminalReturnIngestionRecord(baseStageBInput(), actor, probe), /probe observed execution/);
  assert.equal(store.queryAudit({ action: "codex.stage_b_terminal_return_ingestion.blocked" }).length, 1);
});

function baseStageBInput() {
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
    fixtureMode: true,
    realSourceIngestionExecuted: false
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
