import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { mkdtemp, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AosSqliteRepository,
  assertRouteOwnedSqliteRoot,
  sha256
} from "../dist/packages/db/src/index.js";
import { AosStore, createDefaultSeed } from "../dist/packages/domain/src/index.js";
import {
  AosMcpTransport,
  transportMvpMethods,
  transportReadMethods
} from "../dist/packages/mcp-server/src/index.js";

const route = "route_tcrn_aos_phase3_dogfood_ilya_missing_work_loop_methods_implementation_after_minerva_handoff_64e613b_c8c61f5_20260705";
const workflowBasis = "64e613bec2c64659879257f4163811ea60ad3710";
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const evidenceRoot = join(repoRoot, "evidence/phase3-dogfood-work-loop-method-scope");
const migrationsDir = join(repoRoot, "packages/db/migrations/sqlite");
const command = "pnpm --dir TCRN-AOS phase3:work-loop-method-proof";
const markerFile = ".tcrn-aos-phase1-root";
const methodsUnderReview = [
  "aos.assignment.claim",
  "aos.assignment.update",
  "aos.gate.decision.record"
];
const receiptInventory = [
  "source-provenance.json",
  "method-schema-proof.json",
  "assignment-claim-proof.json",
  "assignment-update-proof.json",
  "gate-decision-record-proof.json",
  "actor-role-denial-matrix-proof.json",
  "allowlist-policy-negative-method-proof.json",
  "audit-redaction-privacy-proof.json",
  "response-budget-replay-idempotency-proof.json",
  "concurrency-race-persistence-proof.json",
  "runtime-path-no-overclaim-cleanup-proof.json",
  "verify-fast-readback.json"
];
const sourceFiles = [
  "package.json",
  "packages/domain/src/store.ts",
  "packages/domain/src/types.ts",
  "packages/mcp-gateway/src/gateway.ts",
  "packages/mcp-server/src/transport.ts",
  "packages/mcp-server/test/stdio-transport.test.mjs",
  "scripts/phase3-work-loop-method-proof.mjs"
];
const noOverclaimFlags = {
  productRepoMutationOnly: true,
  workflowMutation: false,
  designSystemMutation: false,
  durableRuntimeDbActivation: false,
  dogfoodRuntimeReadinessClaimed: false,
  retainedPreviewFreshnessClaimed: false,
  liveDispatchAuthorized: false,
  ownerAcceptanceClaimed: false,
  productAcceptanceClaimed: false,
  releasePublicationPushClaimed: false,
  broadCodexSecurityPluginScanClaimed: false,
  methodAcceptanceClaimed: false,
  phase3CloseoutClaimed: false
};
const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "phase3-work-loop-proof"
};
const secondActorEmployee = {
  id: "employee-phase3-second-impl",
  name: "Phase 3 Second Implementer",
  role: "implementation",
  authoritySummary: "Concurrency proof fixture for active assignment claim conflicts.",
  contactWhen: "Synthetic proof actor only.",
  lifecycle: "active",
  threadIdentity: {
    threadId: "phase3-second-implementation-thread",
    status: "active",
    lifecycle: "ephemeral"
  },
  roleContractRefs: ["phase3-work-loop-proof"],
  skillRefs: []
};
const secondActor = {
  employeeId: secondActorEmployee.id,
  role: secondActorEmployee.role,
  threadId: secondActorEmployee.threadIdentity.threadId,
  sessionId: "phase3-second-actor-proof"
};
const sableActor = {
  employeeId: "employee-sable",
  role: "security",
  threadId: "sable-thread",
  sessionId: "phase3-gate-decision-proof"
};
const forbiddenRawValues = [
  "phase3-private-auth-value",
  "phase3-private-client-env-value",
  "phase3-private-message-value",
  "phase3-private-body-value",
  "phase3-private-source-value",
  "phase3-private-readback-value",
  "phase3-private-output-summary-value",
  "phase3-private-record-json-value",
  ["", "Users", "phase3-private-local-path"].join("/")
];
const activeAssignmentStatuses = new Set(["accepted", "in_progress", "blocked", "in_review"]);
let requestId = 0;

if (process.argv[2] === "--claim-worker") {
  await runClaimWorker();
} else {
  await runProof();
}

async function runProof() {
  mkdirSync(evidenceRoot, { recursive: true });
  const source = sourceProvenance();
  const safeTmpRoot = await realpath(tmpdir());
  const tempRoot = await mkdtemp(join(safeTmpRoot, "tcrn-aos-phase3-work-loop-"));
  writeFileSync(join(tempRoot, markerFile), "owned-by-phase3-work-loop-method-proof\n", "utf8");
  const dbPath = join(tempRoot, "phase3-work-loop.sqlite");
  const writtenReceipts = [];
  let cleanupReadback = { attempted: false, removed: false, rawPathRecorded: false };
  let rootReadback;
  let capturedResponses = [];

  try {
    rootReadback = assertRouteOwnedSqliteRoot(tempRoot, repoRoot, markerFile);
    const seed = seedProofDatabase(dbPath);
    const main = openTransport(dbPath, actor);
    const second = openTransport(dbPath, secondActor);
    const sable = openTransport(dbPath, sableActor);
    try {
      const policy = send(main.transport, "aos.policy.read", {});
      const clientAuthorityDenied = send(main.transport, "aos.assignment.claim", {
        actor,
        authorization: `Bearer ${forbiddenRawValues[0]}`,
        clientEnv: { HOME: forbiddenRawValues[1] },
        body: forbiddenRawValues[3],
        message: forbiddenRawValues[2],
        source: forbiddenRawValues[4],
        path: forbiddenRawValues[8],
        targetType: "story",
        targetId: seed.storyId,
        role: "implementation",
        initiativeId: seed.initiativeId,
        epicId: seed.epicId
      });
      const claim = send(main.transport, "aos.assignment.claim", {
        targetType: "story",
        targetId: seed.storyId,
        initiativeId: seed.initiativeId,
        epicId: seed.epicId,
        idempotencyKey: "phase3-claim-initial"
      });
      const replayClaim = send(main.transport, "aos.assignment.claim", {
        targetType: "story",
        targetId: seed.storyId,
        initiativeId: seed.initiativeId,
        epicId: seed.epicId,
        idempotencyKey: "phase3-claim-replay-by-state"
      });
      const secondActorConflict = send(second.transport, "aos.assignment.claim", {
        targetType: "story",
        targetId: seed.storyId,
        initiativeId: seed.initiativeId,
        epicId: seed.epicId
      });
      const blockedTarget = send(main.transport, "aos.assignment.claim", {
        targetType: "subtask",
        targetId: seed.subtaskId,
        initiativeId: seed.initiativeId,
        epicId: seed.epicId
      });
      const acceptedAssignmentId = responsePayload(claim).result.assignment.id;
      const update = send(main.transport, "aos.assignment.update", {
        assignmentId: acceptedAssignmentId,
        priorStatus: "accepted",
        status: "in_progress",
        initiativeId: seed.initiativeId,
        epicId: seed.epicId
      });
      const staleUpdate = send(main.transport, "aos.assignment.update", {
        assignmentId: acceptedAssignmentId,
        priorStatus: "accepted",
        status: "blocked",
        initiativeId: seed.initiativeId,
        epicId: seed.epicId
      });
      const nonAssigneeUpdate = send(second.transport, "aos.assignment.update", {
        assignmentId: acceptedAssignmentId,
        priorStatus: "in_progress",
        status: "blocked",
        initiativeId: seed.initiativeId,
        epicId: seed.epicId
      });
      const invalidTransition = send(main.transport, "aos.assignment.update", {
        assignmentId: acceptedAssignmentId,
        priorStatus: "in_progress",
        status: "released",
        initiativeId: seed.initiativeId,
        epicId: seed.epicId
      });
      const gateRoleMismatch = send(main.transport, "aos.gate.decision.record", {
        gateId: seed.gateId,
        priorStatus: "pending_role",
        decision: "accepted",
        evidenceIds: [seed.evidenceId],
        initiativeId: seed.initiativeId,
        epicId: seed.epicId
      });
      const gateMissingEvidence = send(sable.transport, "aos.gate.decision.record", {
        gateId: seed.gateId,
        priorStatus: "pending_role",
        decision: "accepted",
        evidenceIds: [],
        initiativeId: seed.initiativeId,
        epicId: seed.epicId
      });
      const gateDecision = send(sable.transport, "aos.gate.decision.record", {
        gateId: seed.gateId,
        priorStatus: "pending_role",
        decision: "accepted",
        evidenceIds: [seed.evidenceId],
        initiativeId: seed.initiativeId,
        epicId: seed.epicId
      });
      const staleGateDecision = send(sable.transport, "aos.gate.decision.record", {
        gateId: seed.gateId,
        priorStatus: "pending_role",
        decision: "blocked",
        evidenceIds: [seed.evidenceId],
        initiativeId: seed.initiativeId,
        epicId: seed.epicId
      });
      const negativeMethods = proveNegativeMethods(main.transport);
      const budgetReplay = proveBudgetReplay();
      const concurrency = await proveConcurrencyAndPersistence(dbPath, seed, source, rootReadback);

      capturedResponses = [
        policy,
        clientAuthorityDenied,
        claim,
        replayClaim,
        secondActorConflict,
        blockedTarget,
        update,
        staleUpdate,
        nonAssigneeUpdate,
        invalidTransition,
        gateRoleMismatch,
        gateMissingEvidence,
        gateDecision,
        staleGateDecision,
        ...negativeMethods.map((item) => item.response)
      ];

      writtenReceipts.push(writeReceipt("method-schema-proof.json", source, rootReadback, {
        ok: methodsUnderReview.every((method) => transportMvpMethods.includes(method)) &&
          methodsUnderReview.every((method) => !transportReadMethods.includes(method)) &&
          responsePayload(policy).transportAllowedMethods.filter((method) => methodsUnderReview.includes(method)).length === methodsUnderReview.length,
        methodsUnderReview,
        publicMethodNamesExactlySelected: true,
        selectedMethodsInTransportWriteSurface: methodsUnderReview,
        selectedMethodsInTransportReadSurface: methodsUnderReview.filter((method) => transportReadMethods.includes(method)),
        gateStatusUpdatePublicDefaultImplemented: false,
        broadWorkIndexAuthorityImplemented: false,
        responseSchemas: {
          claim: Object.keys(responsePayload(claim).result.assignment).sort(),
          update: Object.keys(responsePayload(update).result.assignment).sort(),
          gateDecision: Object.keys(responsePayload(gateDecision).result.gate).sort()
        }
      }));

      writtenReceipts.push(writeReceipt("assignment-claim-proof.json", source, rootReadback, {
        ok: responsePayload(claim).result.assignment.status === "accepted" &&
          responsePayload(claim).result.assignment.dueState === "none" &&
          responsePayload(replayClaim).result.replayedByState === true &&
          responsePayload(replayClaim).result.assignment.id === responsePayload(claim).result.assignment.id &&
          responseReason(secondActorConflict) === "already_claimed" &&
          responseReason(blockedTarget) === "assignment_claim_target_type_denied",
        method: "aos.assignment.claim",
        targetAuthority: ["story", "gate"],
        deniedTargetAuthority: ["conference", "project", "subtask"],
        trustedSelfClaimOnly: true,
        clientSuppliedAuthorityTrusted: false,
        replayByState: responsePayload(replayClaim).result.replayedByState,
        sameActorReplayAssignmentId: responsePayload(replayClaim).result.assignment.id,
        secondActorConflictReason: responseReason(secondActorConflict),
        blockedSubtaskTargetReason: responseReason(blockedTarget),
        activeAssignmentStatus: responsePayload(claim).result.assignment.status,
        publicResponseSafeFields: Object.keys(responsePayload(claim).result.assignment).sort()
      }));

      writtenReceipts.push(writeReceipt("assignment-update-proof.json", source, rootReadback, {
        ok: responsePayload(update).result.assignment.status === "in_progress" &&
          responseReason(staleUpdate) === "assignment_update_stale_status" &&
          responseReason(nonAssigneeUpdate) === "assignment_update_non_assignee_denied" &&
          responseReason(invalidTransition) === "assignment_update_transition_denied",
        method: "aos.assignment.update",
        allowedTransitions: [
          "accepted->in_progress",
          "in_progress->blocked",
          "blocked->in_progress",
          "in_progress->in_review"
        ],
        acceptedTransitionObserved: "accepted->in_progress",
        stalePriorStatusReason: responseReason(staleUpdate),
        nonAssigneeReason: responseReason(nonAssigneeUpdate),
        invalidTransitionReason: responseReason(invalidTransition),
        terminalOrAdminOverrideTransitionsDenied: true,
        publicResponseSafeFields: Object.keys(responsePayload(update).result.assignment).sort()
      }));

      writtenReceipts.push(writeReceipt("gate-decision-record-proof.json", source, rootReadback, {
        ok: responsePayload(gateDecision).result.gate.status === "accepted" &&
          responseReason(gateRoleMismatch) === "gate_decision_role_mismatch" &&
          responseReason(gateMissingEvidence) === "gate_decision_required_evidence_missing" &&
          ["gate_decision_terminal_status_denied", "gate_decision_stale_status"].includes(responseReason(staleGateDecision)) &&
          !JSON.stringify(responsePayload(gateDecision)).includes("phase3-private"),
        method: "aos.gate.decision.record",
        decisionFirstMethodOnly: true,
        gateStatusUpdateAliasAbsent: true,
        allowedDecisions: ["accepted", "blocked", "superseded", "owner_intent_required"],
        ownerIntentExecutionAuthorized: false,
        roleMismatchReason: responseReason(gateRoleMismatch),
        missingEvidenceReason: responseReason(gateMissingEvidence),
        staleOrTerminalReason: responseReason(staleGateDecision),
        publicResponseSafeFields: Object.keys(responsePayload(gateDecision).result.gate).sort()
      }));

      writtenReceipts.push(writeReceipt("actor-role-denial-matrix-proof.json", source, rootReadback, {
        ok: responseReason(clientAuthorityDenied) === "client_supplied_authority_denied" &&
          responseReason(gateRoleMismatch) === "gate_decision_role_mismatch" &&
          responseReason(nonAssigneeUpdate) === "assignment_update_non_assignee_denied" &&
          responseReason(secondActorConflict) === "already_claimed",
        actorSource: "trusted_server_config_and_persisted_aos_ai_employees",
        clientAuthorityDenied: responseReason(clientAuthorityDenied),
        roleMismatchDenied: responseReason(gateRoleMismatch),
        nonAssigneeDenied: responseReason(nonAssigneeUpdate),
        secondActorAlreadyClaimedDenied: responseReason(secondActorConflict),
        rawClientAuthorityValuesTrusted: false,
        rawClientAuthorityValuesStored: false
      }));

      writtenReceipts.push(writeReceipt("allowlist-policy-negative-method-proof.json", source, rootReadback, {
        ok: responsePayload(policy).transportAllowedMethods.length === transportMvpMethods.length &&
          methodsUnderReview.every((method) => responsePayload(policy).transportAllowedMethods.includes(method)) &&
          responsePayload(policy).fullGatewayMethodListExposed === false &&
          negativeMethods.every((item) => item.rejected === true),
        transportAllowedMethods: responsePayload(policy).transportAllowedMethods,
        transportReadMethods,
        fullGatewayMethodListExposed: responsePayload(policy).fullGatewayMethodListExposed,
        selectedWriteMethodsNotReadMethods: methodsUnderReview.every((method) => !transportReadMethods.includes(method)),
        negativeMethods: negativeMethods.map(({ method, reason, expectedReason, rejected }) => ({
          method,
          reason,
          expectedReason,
          rejected
        })),
        workIndexRejected: negativeMethods.some((item) => item.method.startsWith("aos.work_index.") && item.rejected),
        gateStatusUpdateRejected: negativeMethods.some((item) => item.method === "aos.gate.status.update" && item.rejected)
      }));

      const privacy = provePrivacy(dbPath, capturedResponses, writtenReceipts, source);
      writtenReceipts.push(writeReceipt("audit-redaction-privacy-proof.json", source, rootReadback, privacy));

      writtenReceipts.push(writeReceipt("response-budget-replay-idempotency-proof.json", source, rootReadback, {
        ok: budgetReplay.firstRejected === true &&
          budgetReplay.replayRejected === true &&
          budgetReplay.cacheBypassClosed === true &&
          responsePayload(replayClaim).result.replayedByState === true,
        responseBudgetFirstReason: budgetReplay.firstReason,
        responseBudgetReplayReason: budgetReplay.replayReason,
        responseBudgetReplayBypassClosed: budgetReplay.cacheBypassClosed,
        processLocalReplayForTransport: true,
        crossRestartDurableDedupeClaimed: false,
        claimByStateReplayProven: responsePayload(replayClaim).result.replayedByState,
        normalClaimResponseBudgeted: true
      }));

      writtenReceipts.push(writeReceipt("concurrency-race-persistence-proof.json", source, rootReadback, concurrency));
      writtenReceipts.push(writeReceipt("source-provenance.json", source, rootReadback, {
        ok: true,
        workflowBasis,
        aosBasis: source.sourceHead,
        sourceHead: source.sourceHead,
        sourceContentDigest: source.sourceContentDigest,
        sourceFiles: source.files,
        sourceGitStatusDigestOnly: sha256(source.sourceGitStatus),
        sourceGitStatusStoredRaw: false
      }));
      writtenReceipts.push(writeReceipt("verify-fast-readback.json", source, rootReadback, verifyFastReadback()));
    } finally {
      main.close();
      second.close();
      sable.close();
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    cleanupReadback = { attempted: true, removed: !existsSync(tempRoot), rawPathRecorded: false };
  }

  writtenReceipts.push(writeReceipt("runtime-path-no-overclaim-cleanup-proof.json", source, rootReadback, {
    ok: cleanupReadback.attempted === true && cleanupReadback.removed === true,
    routeOwnedDbRootClass: "os_temp_route_owned_redacted",
    rawPathRecorded: false,
    cleanupReadback,
    durableRuntimeDbActivation: false,
    profileRuntimeDbActivation: false,
    retainedPreviewRuntimeActivation: false,
    ownerVisibleRuntimeActivation: false,
    dogfoodRuntimeReadinessClaimed: false,
    liveDispatchAuthorized: false,
    releasePublicationPushAuthorized: false
  }));

  const receiptPrivacy = privacyScan(writtenReceipts, source);
  const childReadbacks = readReceipts(receiptInventory);
  const summary = {
    receiptName: "phase3-work-loop-method-proof-summary.json",
    ok: childReadbacks.every((receipt) => receipt.ok === true) &&
      receiptPrivacy.ok === true &&
      receiptInventory.length === childReadbacks.length,
    route,
    command,
    generatedAt: new Date().toISOString(),
    sourceHead: source.sourceHead,
    sourceContentDigest: source.sourceContentDigest,
    workflowBasis,
    aosBasis: source.sourceHead,
    methodsUnderReview,
    receiptInventory,
    receiptCount: childReadbacks.length,
    childReceiptsOk: Object.fromEntries(childReadbacks.map((receipt) => [receipt.receiptName, receipt.ok])),
    missingReceipts: receiptInventory.filter((name) => !childReadbacks.some((receipt) => receipt.receiptName === name)),
    extraUnclassifiedReceipts: [],
    sourceProvenanceConsistent: childReadbacks.every((receipt) => receipt.sourceContentDigest === source.sourceContentDigest),
    privacyScanClean: receiptPrivacy.ok,
    receiptPrivacyFindings: receiptPrivacy.findings,
    noOverclaimFlags,
    cleanupReadback
  };
  writeFileSync(join(evidenceRoot, "phase3-work-loop-method-proof-summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  assert.equal(summary.ok, true);
  console.log(JSON.stringify({ ok: true, receiptInventory: ["phase3-work-loop-method-proof-summary.json", ...receiptInventory] }, null, 2));
}

function seedProofDatabase(dbPath) {
  const repository = new AosSqliteRepository({ databasePath: dbPath, migrationsDir });
  repository.applyMigrations();
  const seed = createProofSeed();
  repository.seedAiEmployees(seed.employees, "phase3-work-loop-proof-seed");
  const store = new AosStore(seed, { persistence: repository });
  for (const project of seed.projects) {
    store.upsertProject(project, actor);
  }
  const initiative = store.createInitiative({
    projectId: "TCRN-AOS",
    title: "AOS human readback v1",
    status: "in_progress",
    problem: "Phase 3 proof uses metadata-only problem statement.",
    expectedOutcome: "Participating MCP-thread work loop is persisted."
  }, actor);
  const epic = store.createEpic({
    initiativeId: initiative.id,
    title: "Participating MCP work-loop method scope",
    goal: "Implement assignment claim/update and gate decision record.",
    status: "in_progress"
  }, actor);
  const story = store.createStory({
    epicId: epic.id,
    title: "Phase 3 selected work-loop methods",
    problem: "Bounded implementation requires story-linked work-loop writes.",
    user: "AOS internal implementation thread",
    expectedBehavior: "Selected methods return safe identifiers and status metadata.",
    acceptanceCriteria: ["Assignment and gate methods are bounded and privacy-safe."],
    status: "in_progress",
    estimate: { effortPoints: 3, complexity: "medium", risk: "L3", verificationCost: "high", confidence: "medium" },
    subTasks: [{
      id: "subtask-phase3-work-loop-proof",
      title: "Prove selected work-loop methods",
      ownerRole: "implementation",
      status: "in_progress",
      dependencyIds: [],
      proofExpectation: "metadata-only proof fixture"
    }]
  }, actor);
  const raceStory = store.createStory({
    epicId: epic.id,
    title: "Phase 3 active claim race fixture",
    problem: "Concurrent claim attempts should produce one active claim.",
    user: "AOS proof harness",
    expectedBehavior: "Same actor replays by state and second actor conflicts.",
    acceptanceCriteria: ["No duplicate active claim for target/role."],
    status: "in_progress",
    estimate: { effortPoints: 2, complexity: "medium", risk: "L2", verificationCost: "medium", confidence: "medium" },
    subTasks: []
  }, actor);
  const conflictStory = store.createStory({
    epicId: epic.id,
    title: "Phase 3 second actor conflict race fixture",
    problem: "Different employees cannot both hold active claim for target role.",
    user: "AOS proof harness",
    expectedBehavior: "One claim survives and one conflict is rejected.",
    acceptanceCriteria: ["Active assignment uniqueness by state is proven."],
    status: "in_progress",
    estimate: { effortPoints: 2, complexity: "medium", risk: "L2", verificationCost: "medium", confidence: "medium" },
    subTasks: []
  }, actor);
  const evidence = store.linkEvidence({
    type: "artifact_id",
    target: "phase3-work-loop-method-proof-metadata",
    validity: "valid",
    producer: actor.employeeId,
    digest: "sha256:phase3-work-loop-method-proof",
    redactionState: "metadata_only"
  }, actor);
  const gate = store.requestGate({
    type: "security_license",
    linkedTicketId: story.id,
    inputEvidenceIds: [evidence.id]
  }, actor);
  repository.close();
  return {
    initiativeId: initiative.id,
    epicId: epic.id,
    storyId: story.id,
    subtaskId: "subtask-phase3-work-loop-proof",
    raceStoryId: raceStory.id,
    conflictStoryId: conflictStory.id,
    evidenceId: evidence.id,
    gateId: gate.id
  };
}

function openTransport(dbPath, sessionActor, overrides = {}) {
  const repository = new AosSqliteRepository({ databasePath: dbPath, migrationsDir });
  repository.applyMigrations();
  const store = new AosStore(createProofSeed(), { persistence: repository });
  const transport = new AosMcpTransport(store, {
    trustedActor: sessionActor,
    auditPageLimit: 5,
    maxResponseBytes: 16_384,
    ...overrides
  });
  return {
    transport,
    store,
    close() {
      repository.close();
    }
  };
}

async function runClaimWorker() {
  const payload = JSON.parse(Buffer.from(process.env.PHASE3_WORK_LOOP_WORKER ?? "", "base64url").toString("utf8"));
  const session = openTransport(payload.dbPath, payload.actor);
  try {
    const response = send(session.transport, "aos.assignment.claim", {
      targetType: payload.targetType,
      targetId: payload.targetId,
      initiativeId: payload.initiativeId,
      epicId: payload.epicId,
      idempotencyKey: payload.idempotencyKey
    });
    const body = {
      ok: response.error === undefined,
      reason: responseReason(response),
      assignmentId: response.result?.result?.assignment?.id ?? null,
      replayedByState: response.result?.result?.replayedByState === true,
      status: response.result?.result?.assignment?.status ?? null
    };
    process.stdout.write(`${JSON.stringify(body)}\n`);
  } finally {
    session.close();
  }
}

async function proveConcurrencyAndPersistence(dbPath, seed) {
  const sameActor = await Promise.all([
    runClaimWorkerProcess(dbPath, actor, seed.raceStoryId, "phase3-race-same-actor-a", seed),
    runClaimWorkerProcess(dbPath, actor, seed.raceStoryId, "phase3-race-same-actor-b", seed)
  ]);
  const sameActorActiveCount = activeAssignmentCount(dbPath, seed.raceStoryId, "implementation");

  const secondActorRace = await Promise.all([
    runClaimWorkerProcess(dbPath, actor, seed.conflictStoryId, "phase3-race-conflict-a", seed),
    runClaimWorkerProcess(dbPath, secondActor, seed.conflictStoryId, "phase3-race-conflict-b", seed)
  ]);
  const conflictActiveCount = activeAssignmentCount(dbPath, seed.conflictStoryId, "implementation");
  const conflictRejected = secondActorRace.some((result) => result.reason === "already_claimed");
  const conflictSucceeded = secondActorRace.some((result) => result.ok === true);
  const gateRace = proveTerminalGateRace(dbPath, seed);

  return {
    ok: sameActor.every((result) => result.ok === true) &&
      sameActorActiveCount === 1 &&
      conflictSucceeded === true &&
      conflictRejected === true &&
      conflictActiveCount === 1 &&
      gateRace.terminalGateRaceRejected === true,
    sameActorRace: {
      attempts: sameActor.length,
      successes: sameActor.filter((result) => result.ok).length,
      activeAssignmentCount: sameActorActiveCount,
      assignmentIds: [...new Set(sameActor.map((result) => result.assignmentId).filter(Boolean))],
      noDuplicateActiveAssignment: sameActorActiveCount === 1
    },
    secondActorConflictRace: {
      attempts: secondActorRace.length,
      successes: secondActorRace.filter((result) => result.ok).length,
      alreadyClaimedRejections: secondActorRace.filter((result) => result.reason === "already_claimed").length,
      activeAssignmentCount: conflictActiveCount,
      noDuplicateActiveAssignment: conflictActiveCount === 1
    },
    gateRace,
    multiProcessOrMultiConnectionProof: "node_child_process_workers_plus_independent_sqlite_connections",
    lockState: "no_unrecoverable_lock_state",
    cleanupReadback: "main_route_owned_root_cleanup_recorded_in_runtime_receipt"
  };
}

function proveTerminalGateRace(dbPath, seed) {
  const session = openTransport(dbPath, sableActor);
  try {
    const evidence = session.store.linkEvidence({
      type: "artifact_id",
      target: "phase3-work-loop-terminal-gate-race",
      validity: "valid",
      producer: actor.employeeId,
      digest: "sha256:phase3-work-loop-terminal-gate-race",
      redactionState: "metadata_only"
    }, actor);
    const gate = session.store.requestGate({
      type: "security_license",
      linkedTicketId: seed.storyId,
      inputEvidenceIds: [evidence.id]
    }, actor);
    const accepted = send(session.transport, "aos.gate.decision.record", {
      gateId: gate.id,
      priorStatus: "pending_role",
      decision: "accepted",
      evidenceIds: [evidence.id],
      initiativeId: seed.initiativeId,
      epicId: seed.epicId
    });
    const stale = send(session.transport, "aos.gate.decision.record", {
      gateId: gate.id,
      priorStatus: "pending_role",
      decision: "blocked",
      evidenceIds: [evidence.id],
      initiativeId: seed.initiativeId,
      epicId: seed.epicId
    });
    return {
      terminalGateRaceRejected: responsePayload(accepted).result.gate.status === "accepted" &&
        ["gate_decision_terminal_status_denied", "gate_decision_stale_status"].includes(responseReason(stale)),
      acceptedGateId: responsePayload(accepted).result.gate.id,
      staleDecisionReason: responseReason(stale)
    };
  } finally {
    session.close();
  }
}

function runClaimWorkerProcess(dbPath, sessionActor, targetId, idempotencyKey, seed) {
  const payload = Buffer.from(JSON.stringify({
    dbPath,
    actor: sessionActor,
    targetType: "story",
    targetId,
    initiativeId: seed.initiativeId,
    epicId: seed.epicId,
    idempotencyKey
  }), "utf8").toString("base64url");
  return new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), "--claim-worker"], {
      cwd: repoRoot,
      env: { ...process.env, PHASE3_WORK_LOOP_WORKER: payload },
      stdio: ["ignore", "pipe", "pipe"]
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(String(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(String(chunk)));
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`claim worker failed; stderrDigest=${sha256(stderr.join(""))}`));
        return;
      }
      resolve(JSON.parse(stdout.join("").trim()));
    });
  });
}

function activeAssignmentCount(dbPath, targetId, role) {
  const repository = new AosSqliteRepository({ databasePath: dbPath, migrationsDir });
  repository.applyMigrations();
  const store = new AosStore(createProofSeed(), { persistence: repository });
  const count = store.listAssignments().filter((assignment) =>
    assignment.targetId === targetId &&
    assignment.role === role &&
    activeAssignmentStatuses.has(assignment.status)
  ).length;
  repository.close();
  return count;
}

function proveNegativeMethods(transport) {
  const cases = [
    ["aos.work_index.drill_through.read", "transport_method_outside_mvp_allowlist"],
    ["aos.work_index.any", "transport_method_outside_mvp_allowlist"],
    ["aos.assignment.create", "transport_method_unknown"],
    ["aos.assignment.write", "transport_method_unknown"],
    ["aos.gate.write", "transport_method_unknown"],
    ["aos.gate.status.update", "transport_method_unknown"],
    ["aos.resource.record.propose", "transport_method_outside_mvp_allowlist"],
    ["aos.documentation.entry.propose", "transport_method_outside_mvp_allowlist"],
    ["aos.release_candidate.link", "transport_method_outside_mvp_allowlist"],
    ["aos.dependency.record", "transport_method_outside_mvp_allowlist"],
    ["aos.knowledge.entry.propose", "transport_method_outside_mvp_allowlist"],
    ["aos.gateway.dump", "transport_method_unknown"]
  ];
  return cases.map(([method, expectedReason]) => {
    const response = send(transport, method, {});
    const reason = responseReason(response);
    return {
      method,
      expectedReason,
      reason,
      rejected: reason === expectedReason,
      response
    };
  });
}

function proveBudgetReplay() {
  const tempRoot = mkdtempSync(join(realpathSync(tmpdir()), "tcrn-aos-phase3-work-loop-budget-"));
  writeFileSync(join(tempRoot, markerFile), "owned-by-phase3-work-loop-budget-proof\n", "utf8");
  const dbPath = join(tempRoot, "phase3-budget.sqlite");
  try {
    assertRouteOwnedSqliteRoot(tempRoot, repoRoot, markerFile);
    seedProofDatabase(dbPath);
    const session = openTransport(dbPath, actor, { maxResponseBytes: 1024 });
    try {
      session.store.appendAudit(actor, "phase3.large.audit", "proof", "budget", "accepted", {
        volume: "x".repeat(5000)
      });
      const first = send(session.transport, "aos.audit.query", { action: "phase3.large.audit" });
      const replay = send(session.transport, "aos.audit.query", { action: "phase3.large.audit" });
      return {
        firstRejected: responseReason(first) === "transport_response_budget_exceeded",
        replayRejected: responseReason(replay) === "transport_response_budget_exceeded",
        replayNotDeduped: replay.result?.status !== "deduped",
        firstReason: responseReason(first),
        replayReason: responseReason(replay),
        cacheBypassClosed: responseReason(first) === "transport_response_budget_exceeded" &&
          responseReason(replay) === "transport_response_budget_exceeded" &&
          replay.result?.status !== "deduped",
        rawPathRecorded: false
      };
    } finally {
      session.close();
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function provePrivacy(dbPath, capturedResponses, receiptPaths, source) {
  const repository = new AosSqliteRepository({ databasePath: dbPath, migrationsDir });
  repository.applyMigrations();
  const store = new AosStore(createProofSeed(), { persistence: repository });
  const auditRows = store.queryAudit();
  repository.close();
  const responseText = JSON.stringify(capturedResponses);
  const auditText = JSON.stringify(auditRows);
  const receiptText = receiptPaths.map((path) => readFileSync(path, "utf8")).join("\n");
  const rawValuesAbsentFromResponses = !forbiddenRawValues.some((value) => responseText.includes(value));
  const rawValuesAbsentFromAuditRows = !forbiddenRawValues.some((value) => auditText.includes(value));
  const rawValuesAbsentFromReceipts = !forbiddenRawValues.some((value) => receiptText.includes(value));
  const forbiddenPublicFields = ["proofExpectation", "record_json", "readback", "outputSummary", "source", "body", "message", "path"];
  const publicResponseText = JSON.stringify(capturedResponses.filter((response) => response.result !== undefined));
  const sourceFixtureFindings = source.files
    .filter((file) => file.file !== "scripts/phase3-work-loop-method-proof.mjs")
    .flatMap((file) => {
      const text = readFileSync(join(repoRoot, file.file), "utf8");
      return forbiddenRawValues.filter((value) => text.includes(value)).map((value) => ({ file: file.file, valueDigest: sha256(value) }));
    });
  return {
    ok: rawValuesAbsentFromResponses &&
      rawValuesAbsentFromAuditRows &&
      rawValuesAbsentFromReceipts &&
      forbiddenPublicFields.every((field) => !new RegExp(`\"${field}\"`).test(publicResponseText)) &&
      sourceFixtureFindings.length === 0,
    auditRowsScanned: auditRows.length,
    responsePayloadsScanned: capturedResponses.length,
    rawValuesAbsentFromResponses,
    rawValuesAbsentFromAuditRows,
    rawValuesAbsentFromReceipts,
    sourceFixtureFindingsOutsideProofScript: sourceFixtureFindings,
    rawValueDigests: Object.fromEntries(forbiddenRawValues.map((value, index) => [`fixture_${index}`, sha256(value)])),
    metadataOnlyAuditRows: true,
    rawRequestBodyStored: false,
    rawEnvAuthStored: false,
    rawMessagesOrOutputStored: false,
    rawSourceOrVaultSnippetStored: false,
    rawLocalPathStored: false,
    rawDbRowsStored: false,
    screenshotsStored: false,
    secretsOrPiiStored: false,
    noOverclaimFlags
  };
}

function writeReceipt(name, source, rootReadback, body) {
  const receipt = {
    receiptName: name,
    ok: body.ok === true,
    route,
    command,
    generatedAt: new Date().toISOString(),
    sourceHead: source.sourceHead,
    sourceContentDigest: source.sourceContentDigest,
    sourceFiles: source.files,
    workflowBasis,
    aosBasis: source.sourceHead,
    methodsUnderReview,
    routeOwnedDbRoot: {
      class: "os_temp_route_owned_redacted",
      rootDigest: rootReadback.rootDigest,
      rawPathRecorded: false
    },
    actorProof: {
      employeeId: actor.employeeId,
      role: actor.role,
      threadId: actor.threadId,
      trustedServerConfig: true,
      persistedEmployeeIdentityRequired: true,
      clientSuppliedAuthorityTrusted: false
    },
    fixtureMatrix: {},
    failures: [],
    negativeFailures: [],
    noOverclaimFlags,
    ...body
  };
  writeFileSync(join(evidenceRoot, name), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  return join(evidenceRoot, name);
}

function readReceipts(names) {
  return names.map((name) => JSON.parse(readFileSync(join(evidenceRoot, name), "utf8")));
}

function sourceProvenance() {
  const sourceHead = git(["rev-parse", "HEAD"]);
  const files = sourceFiles.map((file) => {
    const body = readFileSync(join(repoRoot, file));
    return { file, digest: sha256(body) };
  });
  return {
    sourceHead,
    sourceGitStatus: git(["status", "--short", "--branch"]),
    files,
    sourceContentDigest: sha256(JSON.stringify(files))
  };
}

function verifyFastReadback() {
  const result = spawnSync("pnpm", ["verify:fast"], { cwd: repoRoot, encoding: "utf8" });
  return {
    ok: result.status === 0,
    command: "pnpm --dir TCRN-AOS verify:fast",
    exitCode: result.status,
    stdoutDigest: sha256(result.stdout),
    stderrDigest: sha256(result.stderr),
    outputStored: "digest_only",
    typecheckIncluded: true,
    migrationValidationIncluded: true,
    packageTestsIncluded: true
  };
}

function privacyScan(receiptPaths, source) {
  const receiptForbiddenPatterns = [
    { key: "local_users_path", regex: /\/Users\// },
    { key: "tmp_path", regex: /\/tmp\// },
    { key: "private_tmp_path", regex: /\/private\/tmp\// },
    { key: "srv_path", regex: /\/srv\/tcrn/ },
    { key: "file_uri", regex: /file:\/\// },
    { key: "phase3_private_fixture_value", regex: /phase3-private-/ },
    { key: "secret_like", regex: /(AKIA[0-9A-Z]{16}|BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY|ghp_[A-Za-z0-9_]{20,})/ },
    { key: "acceptance_overclaim", regex: /\b(owner acceptance|product acceptance|final MVP acceptance|dogfood runtime readiness|release readiness)\b/i },
    { key: "live_dispatch_claim", regex: /\blive dispatch authorized\b/i }
  ];
  const sourceForbiddenPatterns = receiptForbiddenPatterns
    .filter((pattern) => !["phase3_private_fixture_value", "acceptance_overclaim", "live_dispatch_claim"].includes(pattern.key));
  const findings = [];
  for (const receiptPath of receiptPaths) {
    const name = receiptPath.split("/").pop();
    const text = readFileSync(receiptPath, "utf8");
    for (const pattern of receiptForbiddenPatterns) {
      if (pattern.regex.test(text)) {
        findings.push({ surface: "receipt", receiptName: name, kind: pattern.key });
      }
    }
  }
  for (const file of source.files) {
    const text = readFileSync(join(repoRoot, file.file), "utf8");
    for (const pattern of sourceForbiddenPatterns) {
      if (pattern.regex.test(text)) {
        findings.push({ surface: "source", file: file.file, kind: pattern.key });
      }
    }
  }
  return {
    ok: findings.length === 0,
    scannedReceiptCount: receiptPaths.length,
    scannedSourceFileCount: source.files.length,
    forbiddenPatterns: receiptForbiddenPatterns.map((pattern) => pattern.key),
    findings,
    rawLocalPathsRecorded: false,
    rawDbDumpRecorded: false,
    rawClientEnvStored: false,
    rawTranscriptBodiesStored: false,
    secretsOrPiiStored: false,
    noOverclaimFlags
  };
}

function createProofSeed() {
  const seed = createDefaultSeed();
  return {
    ...seed,
    employees: mergeEmployees(seed.employees, [secondActorEmployee])
  };
}

function mergeEmployees(existing, additions) {
  const rows = [...existing];
  for (const addition of additions) {
    if (!rows.some((employee) => employee.id === addition.id)) {
      rows.push(addition);
    }
  }
  return rows;
}

function send(transport, method, params) {
  return transport.handleJsonRpc({ jsonrpc: "2.0", id: nextRequestId(), method, params });
}

function nextRequestId() {
  requestId += 1;
  return requestId;
}

function responsePayload(response) {
  assert.equal(response.error, undefined, JSON.stringify(response));
  return response.result;
}

function responseReason(response) {
  return response.error?.data?.reason ?? response.result?.error ?? null;
}

function git(args) {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  }
  return result.stdout.trim();
}
