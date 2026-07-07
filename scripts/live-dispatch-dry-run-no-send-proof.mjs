import assert from "node:assert/strict";
import { AosStore, createDefaultSeed } from "../dist/packages/domain/src/index.js";
import {
  CodexIntegrationAdapter,
  createNoSendPrimitiveProbe
} from "../dist/packages/adapter-codex/src/index.js";

const parentRouteId = "AOS-59f-live-dispatch-dry-run-no-send-authority-packet";
const aosBasisSha = "4cd40317c912fb1fb9974d1cdbfa865358988121";
const workflowBasisSha = "70386e8fa848e98d3d4a525d2a49f765fd0eecda";

const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "aos-59h-proof"
};

const store = new AosStore(createDefaultSeed());
const adapter = new CodexIntegrationAdapter(store);
const probe = createNoSendPrimitiveProbe();
const input = baseNoSendInput();

const accepted = adapter.createNoSendDispatchEnvelope(input, actor, probe);
const duplicate = adapter.createNoSendDispatchEnvelope(input, actor, probe);
const changedBasis = adapter.createNoSendDispatchEnvelope({
  ...input,
  aosBasisSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
}, actor, probe);
const activeSuccessor = adapter.createNoSendDispatchEnvelope({
  ...input,
  targetThreadState: "active_successor",
  successorConfirmed: true
}, actor, probe);
const temporaryLane = adapter.createNoSendDispatchEnvelope({
  ...input,
  targetThreadState: "temporary_lane",
  temporaryLaneAuthorized: true
}, actor, probe);

const blockedInputCases = [
  ["live_send_requested", { requestedLiveSend: true }],
  ["thread_management_requested", { requestedThreadManagementActions: ["send_message", "archive_thread"] }],
  ["dry_run_no_send_required", { dryRun: false }],
  ["raw_scanner_output", { readScope: ["semgrep scanner raw output vulnerability finding"] }],
  ["machine_local_absolute_path", { readScope: ["/" + "Users/example/private-evidence.json"] }],
  ["raw_secret_scan_output", { readScope: ["raw secret scan output"] }]
].map(([name, override]) => recordBlockedInput(name, override));

const blockedTargetStates = [
  "predecessor",
  "replaced_without_successor_confirmation",
  "stale",
  "archived",
  "unknown",
  "missing",
  "systemError",
  "no_return",
  "conflicting_status",
  "owner_human"
].map((targetThreadState) => recordBlockedInput(`target_${targetThreadState}`, { targetThreadState }));

const expected = expectedReturnContext(accepted);
const valid = adapter.validateTerminalReturnObservation(expected, validReturn(accepted));
const history = [{ dedupeKey: valid.dedupeKey, status: valid.status }];
const terminalCases = [
  ["valid_success", valid],
  ["duplicate_success", adapter.validateTerminalReturnObservation(expected, validReturn(accepted), history)],
  ["conflicting_status", adapter.validateTerminalReturnObservation(expected, {
    ...validReturn(accepted),
    status: "blocked",
    blockers: ["route blocked"],
    nextOwner: "Arturo",
    handoffReturnState: "blocked_return_sent"
  }, history)],
  ["missing_handoff_state", adapter.validateTerminalReturnObservation(expected, {
    ...validReturn(accepted),
    handoffReturnState: undefined
  })],
  ["coordinator_recovery_state", adapter.validateTerminalReturnObservation(expected, {
    ...validReturn(accepted),
    handoffReturnState: "return_gap_recovered"
  })],
  ["commentary_only", adapter.validateTerminalReturnObservation(expected, {
    ...validReturn(accepted),
    payloadKind: "commentary_only"
  })],
  ["system_error", adapter.validateTerminalReturnObservation(expected, {
    ...validReturn(accepted),
    payloadKind: "systemError"
  })],
  ["no_assistant_payload", adapter.validateTerminalReturnObservation(expected, {
    ...validReturn(accepted),
    payloadKind: "no_assistant_payload"
  })],
  ["stale_route", adapter.validateTerminalReturnObservation(expected, {
    ...validReturn(accepted),
    parentRouteId: "stale-route"
  })],
  ["stale_source_thread", adapter.validateTerminalReturnObservation(expected, {
    ...validReturn(accepted),
    sourceThreadId: "stale-thread"
  })],
  ["archived_target_state", adapter.validateTerminalReturnObservation(expected, {
    ...validReturn(accepted),
    targetThreadState: "archived"
  })],
  ["blocking_without_owner", adapter.validateTerminalReturnObservation(expected, {
    ...validReturn(accepted),
    status: "blocked",
    blockers: [],
    nextOwner: undefined,
    handoffReturnState: "blocked_return_sent"
  })],
  ["overclaim_product_acceptance", adapter.validateTerminalReturnObservation(expected, {
    ...validReturn(accepted),
    claims: { productAcceptance: true }
  })],
  ["restricted_private_evidence", adapter.validateTerminalReturnObservation(expected, {
    ...validReturn(accepted),
    summary: "private evidence payload"
  })],
  ["restricted_raw_scanner_output", adapter.validateTerminalReturnObservation(expected, {
    ...validReturn(accepted),
    summary: "npm audit scanner raw output vulnerability finding"
  })]
];

const auditCounts = {
  preview: store.queryAudit({ action: "codex.no_send.dispatch.preview" }).length,
  dedupe: store.queryAudit({ action: "codex.no_send.dispatch.dedupe" }).length,
  blocked: store.queryAudit({ action: "codex.no_send.dispatch.blocked" }).length
};
const probeSnapshot = probe.snapshot();
const noOverclaim = {
  liveDispatch: false,
  threadRegistryMutation: false,
  generatedBridgeMutation: false,
  sendMessagePrimitiveCalled: false,
  threadManagementPrimitiveCalled: false,
  ownerIntentExecution: false,
  deploymentProof: "not_claimed",
  productAcceptance: "not_claimed",
  finalMvpAcceptance: "not_claimed",
  releaseReadiness: "not_claimed",
  selenePush: "not_routed",
  githubMutation: false,
  codexSecurityScan: "not_run",
  defensiveProgrammingCalibration: "not_run"
};
const terminalSummary = terminalCases.reduce((acc, [, result]) => {
  acc[result.disposition] = (acc[result.disposition] ?? 0) + 1;
  return acc;
}, {});
const blockedReasons = [...blockedInputCases, ...blockedTargetStates].map(({ name, reason }) => ({ name, reason }));

assert.equal(accepted.dryRun, true);
assert.equal(accepted.noSend, true);
assert.equal(accepted.sendPrimitiveCallCount, 0);
assert.equal(accepted.threadManagementPrimitiveCallCount, 0);
assert.equal(duplicate.dispatchId, accepted.dispatchId);
assert.notEqual(changedBasis.dispatchId, accepted.dispatchId);
assert.equal(activeSuccessor.targetThreadState, "active_successor");
assert.equal(temporaryLane.targetThreadState, "temporary_lane");
assert.equal(probeSnapshot.sendPrimitiveCallCount, 0);
assert.equal(probeSnapshot.threadManagementPrimitiveCallCount, 0);
assert.equal(auditCounts.preview, 4);
assert.equal(auditCounts.dedupe, 1);
assert.equal(auditCounts.blocked, blockedInputCases.length + blockedTargetStates.length);
assert.equal(valid.disposition, "consumable");
assert.equal(terminalSummary.consumable, 1);
assert.equal(terminalSummary.duplicate, 1);
assert.equal(terminalSummary.conflicting, 1);
assert.equal(terminalSummary.blocked, 6);
assert.equal(terminalSummary.non_consumable, 6);
assert.deepEqual(Object.values(noOverclaim).filter((value) => value === true), []);

const receipt = {
  ok: true,
  checkpoint: {
    parentRouteId,
    aosBasisSha,
    workflowBasisSha,
    returnContractVersion: accepted.returnContractVersion,
    dispatchSchemaVersion: accepted.dispatchSchemaVersion
  },
  noSendEnvelope: {
    dispatchId: accepted.dispatchId,
    duplicateDispatchId: duplicate.dispatchId,
    changedBasisDispatchId: changedBasis.dispatchId,
    dryRun: accepted.dryRun,
    noSend: accepted.noSend,
    sendPrimitiveCallCount: accepted.sendPrimitiveCallCount,
    threadManagementPrimitiveCallCount: accepted.threadManagementPrimitiveCallCount,
    idempotencyKeyPresent: Boolean(accepted.idempotencyKey),
    dedupeKeyPresent: Boolean(accepted.dedupeKey),
    retainedRawPayload: false
  },
  targetStateProof: {
    acceptedStates: [accepted.targetThreadState, activeSuccessor.targetThreadState, temporaryLane.targetThreadState],
    blockedCount: blockedTargetStates.length,
    blockedStates: blockedTargetStates.map(({ name }) => name.replace("target_", ""))
  },
  terminalReturnValidation: {
    summary: terminalSummary,
    acceptedTerminalStates: ["return_sent", "partial_return_sent", "blocked_return_sent", "return_blocked"],
    coordinatorRecoveryStatesConsumable: false,
    cases: terminalCases.map(([name, result]) => ({
      name,
      disposition: result.disposition,
      reason: result.reason,
      blockerCount: result.blockerCount,
      overclaimCount: result.overclaimCount,
      restrictedFindingCount: result.restrictedFindingCount
    }))
  },
  idempotencyDedupeReplay: {
    deterministicDuplicate: duplicate.dispatchId === accepted.dispatchId,
    changedBasisCreatesNewDispatch: changedBasis.dispatchId !== accepted.dispatchId,
    duplicateTerminalReceiptDisposition: terminalCases.find(([name]) => name === "duplicate_success")?.[1].disposition,
    conflictingTerminalReceiptDisposition: terminalCases.find(([name]) => name === "conflicting_status")?.[1].disposition
  },
  restrictedPayloads: {
    blockedInputCaseCount: blockedInputCases.length,
    terminalRestrictedCaseCount: terminalCases.filter(([, result]) => result.reason === "restricted_payload").length,
    rawSecretScanOutputRejected: blockedInputCases.some(({ name }) => name === "raw_secret_scan_output"),
    rawScannerOutputRejected: blockedInputCases.some(({ name }) => name === "raw_scanner_output"),
    machineLocalPathRejected: blockedInputCases.some(({ name }) => name === "machine_local_absolute_path"),
    blockedReasons
  },
  audit: {
    ...auditCounts,
    redactedCountOnly: true,
    rawRestrictedPayloadStored: false
  },
  noOverclaim
};

console.log(JSON.stringify(receipt, null, 2));

function recordBlockedInput(name, override) {
  try {
    adapter.createNoSendDispatchEnvelope({
      ...baseNoSendInput(),
      ...override
    }, actor, probe);
  } catch (error) {
    return {
      name,
      reason: error instanceof Error ? error.message : String(error)
    };
  }
  throw new Error(`Expected no-send case to fail closed: ${name}`);
}

function baseNoSendInput() {
  return {
    parentRouteId,
    sourceProjectId: "TCRN-AOS",
    initiativeId: "tcrn-aos-product-foundation",
    aosBasisSha,
    workflowBasisSha,
    targetRole: "Ilya, Full-Stack Implementer",
    targetThreadId: "019eb6d7-f130-70a0-8805-169cc337229b",
    targetThreadState: "active",
    objective: "Implement local 59h dry-run no-send proof",
    executionMode: "pursue_goal_required",
    readScope: ["Workflow packet 59h", "adapter source", "thread handoff contract"],
    writeScope: ["TCRN-AOS adapter source", "TCRN-AOS tests", "TCRN-AOS evidence"],
    nonAuthorizations: [
      "no live dispatch",
      "no thread registry mutation",
      "no generated bridge mutation",
      "no deployment",
      "no product acceptance"
    ],
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
    summary: "Local no-send proof completed",
    blockers: [],
    handoffReturnState: "return_sent",
    payloadKind: "assistant_terminal",
    targetThreadState: "active",
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
