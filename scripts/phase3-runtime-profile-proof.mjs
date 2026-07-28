import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { createInterface } from "node:readline";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AosSqliteRepository,
  assertRouteOwnedSqliteRoot,
  sha256
} from "../dist/packages/db/src/index.js";
import { createWorkReadbackApiResponse } from "../dist/apps/api/src/work-readback.js";
import { renderAosShellHtml } from "../dist/apps/web/src/app.js";
import { AosStore, createDefaultSeed } from "../dist/packages/domain/src/index.js";
import { createRuntimeTransport, transportMvpMethods } from "../dist/packages/mcp-server/src/index.js";

const defaultRoute = "route_tcrn_aos_phase3_dogfood_ilya_runtime_profile_implementation_proof_after_minerva_status_sync_f5dc8b1_6deeb08_20260705";
const defaultWorkflowBasis = "f5dc8b1c57ea07ea89d40043be420cd349e90d22";
const proofMode = process.env.TCRN_AOS_PHASE3_RUNTIME_PROFILE_MODE ?? "runtime-profile";
const isDogfoodExecutionProof = proofMode === "dogfood-execution-runtime-profile";
const route = process.env.TCRN_AOS_PHASE3_RUNTIME_PROFILE_ROUTE ?? defaultRoute;
const workflowBasis = process.env.TCRN_AOS_PHASE3_RUNTIME_PROFILE_WORKFLOW_BASIS ?? defaultWorkflowBasis;
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const evidenceRoot = join(repoRoot, process.env.TCRN_AOS_PHASE3_RUNTIME_PROFILE_EVIDENCE_DIR ?? "evidence/phase3-runtime-profile-dogfood");
const migrationsDir = join(repoRoot, "packages/db/migrations/sqlite");
const serverEntrypoint = join(repoRoot, "dist/packages/mcp-server/src/stdio-server.js");
const command = process.env.TCRN_AOS_PHASE3_RUNTIME_PROFILE_COMMAND ?? "pnpm --dir TCRN-AOS phase3:runtime-profile-proof";
const markerFile = ".tcrn-aos-phase1-root";
const markerPurpose = isDogfoodExecutionProof
  ? "route-owned-temp-dogfood-execution-runtime-profile-proof"
  : "route-owned-temp-runtime-profile-proof";
const runtimeProfileMethodsUnderReview = [
  "aos.assignment.claim",
  "aos.assignment.update",
  "aos.gate.decision.record",
  "aos.ticket.list",
  "aos.audit.query"
];
const dogfoodExecutionMethodsUnderReview = [
  "aos.assignment.claim",
  "aos.assignment.update",
  "aos.run.summary.create",
  "aos.evidence.link",
  "aos.gate.decision.record",
  "aos.ticket.list",
  "aos.audit.query",
  "aos.policy.read"
];
const methodsUnderReview = isDogfoodExecutionProof ? dogfoodExecutionMethodsUnderReview : runtimeProfileMethodsUnderReview;
const selectedWriteMethods = [
  "aos.assignment.claim",
  "aos.assignment.update",
  "aos.gate.decision.record"
];
const baseReceiptInventory = [
  "source-provenance.json",
  "runtime-root-path-proof.json",
  "runtime-config-actor-binding-proof.json",
  "one-initiative-one-epic-data-binding-proof.json",
  "mcp-method-participation-proof.json",
  "policy-allowlist-negative-authority-proof.json",
  "audit-ticket-list-readback-proof.json",
  "response-budget-cursor-replay-idempotency-proof.json",
  "concurrency-lock-restart-proof.json",
  "cleanup-retention-no-artifact-proof.json",
  "privacy-no-overclaim-scan.json",
  "verify-fast-readback.json"
];
const dogfoodExecutionReceiptInventory = [
  "run-evidence-gate-traceability-proof.json",
  "ticket-list-frontend-readback-proof.json",
  "selected-story-audit-proof.json"
];
const receiptInventory = isDogfoodExecutionProof
  ? [...baseReceiptInventory, ...dogfoodExecutionReceiptInventory]
  : baseReceiptInventory;
const summaryReceiptName = isDogfoodExecutionProof
  ? "phase3-dogfood-execution-runtime-profile-proof-summary.json"
  : "runtime-profile-proof-summary.json";
const baseSourceFiles = [
  "package.json",
  "packages/domain/src/store.ts",
  "packages/db/src/sqlite-repository.ts",
  "packages/mcp-gateway/src/gateway.ts",
  "packages/mcp-server/src/transport.ts",
  "packages/mcp-server/src/stdio-server.ts",
  "packages/mcp-server/test/stdio-transport.test.mjs",
  "scripts/phase3-runtime-profile-proof.mjs"
];
const dogfoodExecutionSourceFiles = [
  "apps/api/src/work-readback.ts",
  "apps/web/src/app.tsx",
  "apps/web/src/phase3-dogfood-readback.tsx"
];
const sourceFiles = isDogfoodExecutionProof
  ? [...baseSourceFiles, ...dogfoodExecutionSourceFiles]
  : baseSourceFiles;
const noOverclaimFlags = {
  productRepoMutationOnly: true,
  workflowMutation: false,
  designSystemMutation: false,
  durableRuntimeDbActivation: false,
  defaultRuntimeDbActivation: false,
  dogfoodRuntimeReadinessClaimed: false,
  retainedPreviewRuntimeActivation: false,
  retainedPreviewFreshnessClaimed: false,
  ownerVisibleRuntimeDbActivated: false,
  liveDispatchAuthorized: false,
  ownerIntentExecutionAuthorized: false,
  ownerAcceptanceClaimed: false,
  productAcceptanceClaimed: false,
  releasePublicationPushClaimed: false,
  broadCodexSecurityPluginScanClaimed: false,
  janusReadinessClaimed: false,
  phase3CloseoutClaimed: false
};
const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "phase3-runtime-profile-proof"
};
const sableActor = {
  employeeId: "employee-sable",
  role: "security",
  threadId: "sable-thread",
  sessionId: "phase3-runtime-profile-proof"
};
const observerEmployee = {
  id: "employee-phase3-runtime-observer",
  name: "Phase 3 Runtime Observer",
  role: "owner_observer",
  authoritySummary: "Read-only runtime profile proof fixture.",
  contactWhen: "Proof-only observer.",
  lifecycle: "active",
  threadIdentity: {
    threadId: "phase3-runtime-observer-thread",
    status: "active",
    lifecycle: "ephemeral"
  },
  roleContractRefs: ["phase3-runtime-profile-proof"],
  skillRefs: []
};
const observerActor = {
  employeeId: observerEmployee.id,
  role: observerEmployee.role,
  threadId: observerEmployee.threadIdentity.threadId,
  sessionId: "phase3-runtime-observer-proof"
};
const inactiveEmployee = {
  id: "employee-phase3-runtime-inactive",
  name: "Phase 3 Runtime Inactive",
  role: "implementation",
  authoritySummary: "Inactive runtime profile proof fixture.",
  contactWhen: "Proof-only inactive actor.",
  lifecycle: "blocked",
  threadIdentity: {
    threadId: "phase3-runtime-inactive-thread",
    status: "active",
    lifecycle: "ephemeral"
  },
  roleContractRefs: ["phase3-runtime-profile-proof"],
  skillRefs: []
};
const inactiveActor = {
  employeeId: inactiveEmployee.id,
  role: inactiveEmployee.role,
  threadId: inactiveEmployee.threadIdentity.threadId,
  sessionId: "phase3-runtime-inactive-proof"
};
const archivedThreadEmployee = {
  id: "employee-phase3-runtime-archived-thread",
  name: "Phase 3 Runtime Archived Thread",
  role: "implementation",
  authoritySummary: "Archived-thread runtime profile proof fixture.",
  contactWhen: "Proof-only archived actor.",
  lifecycle: "active",
  threadIdentity: {
    threadId: "phase3-runtime-archived-thread",
    status: "archived",
    lifecycle: "ephemeral"
  },
  roleContractRefs: ["phase3-runtime-profile-proof"],
  skillRefs: []
};
const archivedThreadActor = {
  employeeId: archivedThreadEmployee.id,
  role: archivedThreadEmployee.role,
  threadId: archivedThreadEmployee.threadIdentity.threadId,
  sessionId: "phase3-runtime-archived-thread-proof"
};
const forbiddenRawValues = [
  "phase3-runtime-private-auth-value",
  "phase3-runtime-private-env-value",
  "phase3-runtime-private-message-value",
  "phase3-runtime-private-body-value",
  "phase3-runtime-private-source-value",
  "phase3-runtime-private-readback-value",
  "phase3-runtime-private-output-summary-value",
  "phase3-runtime-private-record-json-value",
  ["/", "Users", "phase3-runtime-private-local-path"].join("/")
];
const activeAssignmentStatuses = new Set(["accepted", "in_progress", "blocked", "in_review"]);
let requestId = 0;

if (process.argv[2] === "--claim-worker") {
  runClaimWorker();
} else {
  await runProof();
}

async function runProof() {
  mkdirSync(evidenceRoot, { recursive: true });
  const source = sourceProvenance();
  const safeTmpRoot = realpathSync(tmpdir());
  const runtimeRoot = mkdtempSync(join(safeTmpRoot, "tcrn-aos-phase3-runtime-profile-"));
  const dbPath = join(runtimeRoot, "runtime-profile.sqlite");
  const writtenReceipts = [];
  let cleanupReadback = { attempted: false, removed: false, rawPathRecorded: false };
  let rootReadback;

  try {
    writeProfileMarker(runtimeRoot);
    rootReadback = assertRouteOwnedSqliteRoot(runtimeRoot, repoRoot, markerFile);
    const seed = seedRuntimeProfileDatabase(dbPath);
    const rootProof = proveRuntimeRootPath(runtimeRoot, dbPath, rootReadback);

    const main = await startClientSession(dbPath, actor);
    let sable;
    let auditSession;
    let observer;
    let capturedResponses = [];
    try {
      const policy = await main.send("aos.policy.read", {});
      const firstPage = await main.send("aos.ticket.list", { limit: 1 });
      const secondPage = await main.send("aos.ticket.list", { limit: 1, cursor: responsePayload(firstPage).page.nextCursor });
      const invalidCursor = await main.send("aos.ticket.list", { cursor: "not-a-ticket-list-cursor" });
      const claim = await main.send("aos.assignment.claim", {
        targetType: "story",
        targetId: seed.storyId,
        initiativeId: seed.initiativeId,
        epicId: seed.epicId,
        idempotencyKey: "runtime-profile-claim-initial"
      });
      const stateReplay = await main.send("aos.assignment.claim", {
        targetType: "story",
        targetId: seed.storyId,
        initiativeId: seed.initiativeId,
        epicId: seed.epicId,
        idempotencyKey: "runtime-profile-claim-state-replay"
      });
      const assignmentId = responsePayload(claim).result.assignment.id;
      const update = await main.send("aos.assignment.update", {
        assignmentId,
        priorStatus: "accepted",
        status: "in_progress",
        initiativeId: seed.initiativeId,
        epicId: seed.epicId
      });
      const run = await main.send("aos.run.summary.create", {
        assignmentId,
        status: "success",
        startedAt: "2026-07-06T09:00:00.000Z",
        endedAt: "2026-07-06T09:02:00.000Z",
        readback: "metadata-only Phase 3 dogfood execution runtime profile proof",
        outputSummary: "Bounded local runtime profile persisted AgentRun",
        idempotencyKey: "phase3-dogfood-execution-run"
      });
      const runReplay = await main.send("aos.run.summary.create", {
        assignmentId,
        status: "success",
        startedAt: "2026-07-06T09:00:00.000Z",
        endedAt: "2026-07-06T09:02:00.000Z",
        readback: "metadata-only Phase 3 dogfood execution runtime profile proof",
        outputSummary: "Bounded local runtime profile persisted AgentRun",
        idempotencyKey: "phase3-dogfood-execution-run"
      });
      const evidence = await main.send("aos.evidence.link", {
        type: "artifact_id",
        target: "phase3-runtime-profile-participation-proof",
        digest: "sha256:phase3-runtime-profile-participation-proof",
        redactionState: "metadata_only"
      });
      await main.stop();

      sable = await startClientSession(dbPath, sableActor);
      const gate = await sable.send("aos.gate.decision.record", {
        gateId: seed.gateId,
        priorStatus: "pending_role",
        decision: "accepted",
        evidenceIds: [seed.evidenceId],
        initiativeId: seed.initiativeId,
        epicId: seed.epicId
      });
      const staleGate = await sable.send("aos.gate.decision.record", {
        gateId: seed.gateId,
        priorStatus: "pending_role",
        decision: "blocked",
        evidenceIds: [seed.evidenceId],
        initiativeId: seed.initiativeId,
        epicId: seed.epicId
      });
      await sable.stop();

      auditSession = await startClientSession(dbPath, actor);
      const audit = await auditSession.send("aos.audit.query", { limit: 5 });
      const auditNext = await auditSession.send("aos.audit.query", { limit: 2, cursor: responsePayload(audit).nextCursor ?? undefined });
      const finalTicketReadback = await auditSession.send("aos.ticket.list", { storyId: seed.storyId, limit: 1 });
      const selectedStoryAuditReadback = await auditSession.send("aos.audit.query", { targetId: seed.storyId, limit: 5 });
      const clientAuthorityDenied = await auditSession.send("aos.assignment.claim", {
        actor,
        authorization: `Bearer ${forbiddenRawValues[0]}`,
        clientEnv: { HOME: forbiddenRawValues[1] },
        body: forbiddenRawValues[3],
        message: forbiddenRawValues[2],
        source: forbiddenRawValues[4],
        path: forbiddenRawValues[8],
        targetType: "story",
        targetId: seed.storyId,
        initiativeId: seed.initiativeId,
        epicId: seed.epicId
      });
      observer = await startClientSession(dbPath, observerActor);
      const observerWriteDenied = await observer.send("aos.assignment.claim", {
        targetType: "story",
        targetId: seed.storyId,
        initiativeId: seed.initiativeId,
        epicId: seed.epicId
      });
      const negativeMethods = await proveNegativeMethods(auditSession);
      const actorBinding = await proveActorBinding(dbPath);
      const responseBudget = await proveResponseBudgetReplay();
      const concurrency = await proveConcurrencyAndRestart(dbPath, seed);

      capturedResponses = [
        policy,
        firstPage,
        secondPage,
        invalidCursor,
        claim,
        stateReplay,
        update,
        run,
        runReplay,
        evidence,
        gate,
        staleGate,
        audit,
        auditNext,
        finalTicketReadback,
        selectedStoryAuditReadback,
        clientAuthorityDenied,
        observerWriteDenied,
        ...negativeMethods.map((item) => item.response)
      ];

      writtenReceipts.push(writeReceipt("runtime-root-path-proof.json", source, rootReadback, {
        ok: rootProof.ok,
        ...rootProof
      }));

      writtenReceipts.push(writeReceipt("runtime-config-actor-binding-proof.json", source, rootReadback, {
        ok: actorBinding.ok &&
          responseReason(clientAuthorityDenied) === "client_supplied_authority_denied" &&
          responseReason(observerWriteDenied) === "transport_actor_blocked_role",
        configB64RetainedRaw: false,
        configDigest: main.configDigest,
        configKeySet: main.configKeySet,
        persistedActorIdentityRequired: true,
        trustedActor: publicActor(actor),
        participatingActors: [publicActor(actor), publicActor(sableActor), publicActor(observerActor)],
        clientSuppliedAuthorityDenied: responseReason(clientAuthorityDenied),
        observerWriteDenied: responseReason(observerWriteDenied),
        actorBinding
      }));

      const dataBinding = proveOneInitiativeOneEpicBinding(dbPath, seed, [firstPage, secondPage]);
      writtenReceipts.push(writeReceipt("one-initiative-one-epic-data-binding-proof.json", source, rootReadback, dataBinding));

      writtenReceipts.push(writeReceipt("mcp-method-participation-proof.json", source, rootReadback, {
        ok: responsePayload(claim).result.assignment.status === "accepted" &&
          responsePayload(stateReplay).result.replayedByState === true &&
          responsePayload(update).result.assignment.status === "in_progress" &&
          responsePayload(gate).result.gate.status === "accepted" &&
          ["gate_decision_terminal_status_denied", "gate_decision_stale_status"].includes(responseReason(staleGate)),
        selectedWriteMethods,
        selectedReadbackMethods: ["aos.ticket.list", "aos.audit.query", "aos.policy.read"],
        claimAssignmentId: responsePayload(claim).result.assignment.id,
        claimReplayByState: responsePayload(stateReplay).result.replayedByState,
        updateStatus: responsePayload(update).result.assignment.status,
        gateDecisionStatus: responsePayload(gate).result.gate.status,
        staleGateRaceReason: responseReason(staleGate),
        persistedAgentRunMethodUsed: responsePayload(run).method === "aos.run.summary.create",
        runReplayStatus: responsePayload(runReplay).status,
        liveDispatchAuthorized: false,
        ownerIntentExecutionAuthorized: false,
        runtimeActivationClaimed: false
      }));

      writtenReceipts.push(writeReceipt("policy-allowlist-negative-authority-proof.json", source, rootReadback, {
        ok: responsePayload(policy).fullGatewayMethodListExposed === false &&
          selectedWriteMethods.every((method) => responsePayload(policy).transportAllowedMethods.includes(method)) &&
          negativeMethods.every((item) => item.rejected),
        transportAllowedMethods: responsePayload(policy).transportAllowedMethods,
        fullGatewayMethodListExposed: responsePayload(policy).fullGatewayMethodListExposed,
        selectedWriteMethods,
        negativeMethods: negativeMethods.map(({ method, reason, expectedReason, rejected }) => ({
          method,
          reason,
          expectedReason,
          rejected
        })),
        gateStatusUpdateRejected: negativeMethods.some((item) => item.method === "aos.gate.status.update" && item.rejected),
        workIndexRejected: negativeMethods.some((item) => item.method.startsWith("aos.work_index.") && item.rejected)
      }));

      writtenReceipts.push(writeReceipt("audit-ticket-list-readback-proof.json", source, rootReadback, {
        ok: responsePayload(firstPage).rows.length === 1 &&
          responsePayload(secondPage).rows.length >= 1 &&
          responsePayload(audit).returnedCount > 0 &&
          responseReason(invalidCursor) === "invalid_ticket_list_cursor",
        ticketListSchemaVersion: responsePayload(firstPage).schemaVersion,
        ticketListRowGrain: responsePayload(firstPage).rowGrain,
        firstPageReturnedCount: responsePayload(firstPage).page.returnedCount,
        nextCursorPresent: typeof responsePayload(firstPage).page.nextCursor === "string",
        invalidCursorReason: responseReason(invalidCursor),
        auditReturnedCount: responsePayload(audit).returnedCount,
        auditHasMore: responsePayload(audit).hasMore,
        auditNextReturnedCount: responsePayload(auditNext).returnedCount ?? 0,
        rawAuditDetailsReturned: false,
        rawDbRowsReturned: false
      }));

      if (isDogfoodExecutionProof) {
        writtenReceipts.push(writeReceipt("run-evidence-gate-traceability-proof.json", source, rootReadback, proveRunEvidenceGateTraceability(dbPath, seed, {
          claim,
          update,
          run,
          runReplay,
          evidence,
          gate,
          staleGate,
          finalTicketReadback
        })));
        writtenReceipts.push(writeReceipt("ticket-list-frontend-readback-proof.json", source, rootReadback, proveTicketListFrontendReadback(dbPath, seed)));
        writtenReceipts.push(writeReceipt("selected-story-audit-proof.json", source, rootReadback, proveSelectedStoryAudit(dbPath, seed, selectedStoryAuditReadback)));
      }

      writtenReceipts.push(writeReceipt("response-budget-cursor-replay-idempotency-proof.json", source, rootReadback, {
        ok: responseBudget.ok &&
          typeof responsePayload(firstPage).page.nextCursor === "string" &&
          responseReason(invalidCursor) === "invalid_ticket_list_cursor" &&
          responsePayload(stateReplay).result.replayedByState === true,
        cursorPagination: {
          nextCursorPresent: typeof responsePayload(firstPage).page.nextCursor === "string",
          invalidCursorReason: responseReason(invalidCursor)
        },
        processLocalReplay: responseBudget.processLocalReplay,
        responseBudget,
        claimByStateReplayProven: responsePayload(stateReplay).result.replayedByState,
        durableCrossRestartDedupeClaimed: false
      }));

      writtenReceipts.push(writeReceipt("concurrency-lock-restart-proof.json", source, rootReadback, concurrency));

      const privacy = provePrivacy(dbPath, capturedResponses, writtenReceipts, source);
      writtenReceipts.push(writeReceipt("privacy-no-overclaim-scan.json", source, rootReadback, privacy));
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
      await main.stop();
      if (sable) {
        await sable.stop();
      }
      if (auditSession) {
        await auditSession.stop();
      }
      if (observer) {
        await observer.stop();
      }
    }
  } finally {
    rmSync(runtimeRoot, { recursive: true, force: true });
    cleanupReadback = { attempted: true, removed: !existsSync(runtimeRoot), rawPathRecorded: false };
  }

  writtenReceipts.push(writeReceipt("cleanup-retention-no-artifact-proof.json", source, rootReadback, {
    ok: cleanupReadback.attempted === true && cleanupReadback.removed === true && noCommittedDbArtifacts(),
    cleanupReadback,
    retainedResourcePolicy: "none_created_for_this_route",
    committedDbArtifacts: false,
    routeOwnedTempRootRemoved: cleanupReadback.removed,
    rawPathRecorded: false,
    runtimeActivationClaimed: false,
    dogfoodRuntimeReadinessClaimed: false,
    retainedPreviewRuntimeRefresh: false
  }));

  const childReadbacks = readReceipts(receiptInventory);
  const summary = {
    receiptName: summaryReceiptName,
    ok: childReadbacks.every((receipt) => receipt.ok === true) &&
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
    noOverclaimFlags,
    cleanupReadback
  };
  writeFileSync(join(evidenceRoot, summaryReceiptName), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  assert.equal(summary.ok, true);
  console.log(JSON.stringify({ ok: true, receiptInventory: [summaryReceiptName, ...receiptInventory] }, null, 2));
}

function seedRuntimeProfileDatabase(dbPath, options = {}) {
  const repository = new AosSqliteRepository({ databasePath: dbPath, migrationsDir });
  repository.applyMigrations();
  const seed = createProofSeed();
  repository.seedAiEmployees(seed.employees, "phase3-runtime-profile-seed");
  const store = new AosStore(seed, { persistence: repository });
  for (const project of seed.projects) {
    store.upsertProject(project, actor);
  }
  const initiative = store.createInitiative({
    projectId: "TCRN-AOS",
    title: "AOS human readback v1",
    status: "in_progress",
    problem: "Phase 3 runtime profile participation needs persisted-spine proof.",
    expectedOutcome: "Local stdio profile participates through bounded AOS methods."
  }, actor);
  const epic = store.createEpic({
    initiativeId: initiative.id,
    title: "Dogfood runtime profile participation",
    goal: "Bind participating MCP-thread actors to one AOS initiative and epic.",
    status: "in_progress"
  }, actor);
  const titlePad = "x".repeat(options.storyTitleLength ?? 0);
  const story = store.createStory({
    epicId: epic.id,
    title: `Runtime profile participation story ${titlePad}`,
    problem: "Runtime profile proof uses metadata-only operational fields.",
    user: "AOS implementation thread",
    expectedBehavior: "Local stdio runtime profile writes and reads safe metadata.",
    acceptanceCriteria: ["Bounded methods participate through persisted SQLite only."],
    status: "in_progress",
    estimate: { effortPoints: 3, complexity: "medium", risk: "L3", verificationCost: "high", confidence: "medium" },
    subTasks: [{
      id: "subtask-phase3-runtime-profile",
      title: "Prove runtime profile participation",
      ownerRole: "implementation",
      status: "in_progress",
      dependencyIds: [],
      proofExpectation: "metadata-only runtime profile proof"
    }]
  }, actor);
  const componentGapStory = store.createStory({
    epicId: epic.id,
    title: "Linked DS component-gap story",
    problem: "AOS runtime profile should read linked component-gap story metadata when present.",
    user: "AOS implementation thread",
    expectedBehavior: "Ticket list readback stays story-centric and safe.",
    acceptanceCriteria: ["Linked story appears only as safe ticket metadata."],
    status: "in_progress",
    estimate: { effortPoints: 2, complexity: "medium", risk: "L2", verificationCost: "medium", confidence: "medium" },
    subTasks: []
  }, actor);
  const raceStory = store.createStory({
    epicId: epic.id,
    title: "Runtime profile claim race story",
    problem: "Concurrent profile claims should not duplicate active assignments.",
    user: "AOS proof harness",
    expectedBehavior: "One active assignment remains after concurrent claims.",
    acceptanceCriteria: ["Race proof leaves one active assignment."],
    status: "in_progress",
    estimate: { effortPoints: 2, complexity: "medium", risk: "L2", verificationCost: "medium", confidence: "medium" },
    subTasks: []
  }, actor);
  const evidence = store.linkEvidence({
    type: "artifact_id",
    target: "phase3-runtime-profile-proof-metadata",
    validity: "valid",
    producer: sableActor.employeeId,
    digest: "sha256:phase3-runtime-profile-proof",
    redactionState: "metadata_only"
  }, sableActor);
  const gate = store.requestGate({
    type: "security_license",
    linkedTicketId: story.id,
    inputEvidenceIds: [evidence.id]
  }, sableActor);
  repository.close();
  return {
    initiativeId: initiative.id,
    initiativeTitle: initiative.title,
    epicId: epic.id,
    epicTitle: epic.title,
    storyId: story.id,
    componentGapStoryId: componentGapStory.id,
    raceStoryId: raceStory.id,
    evidenceId: evidence.id,
    gateId: gate.id
  };
}

async function startClientSession(dbPath, sessionActor, overrides = {}) {
  const configObject = {
    actor: sessionActor,
    databasePath: dbPath,
    databaseRoot: dirname(dbPath),
    repoRoot,
    routeOwnedMarkerFile: markerFile,
    runtimeProfileMarker: runtimeProfileMarkerExpectation(),
    migrationsDir,
    auditPageLimit: 5,
    maxResponseBytes: 16_384,
    ...overrides
  };
  const configJson = JSON.stringify(configObject);
  const encoded = Buffer.from(configJson, "utf8").toString("base64url");
  const child = spawn(process.execPath, [serverEntrypoint], {
    cwd: repoRoot,
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, AOS_MCP_TRANSPORT_CONFIG_B64: encoded }
  });
  const lines = createInterface({ input: child.stdout, terminal: false });
  const iterator = lines[Symbol.asyncIterator]();
  let stopped = false;
  const stderr = [];
  child.stderr.on("data", (chunk) => stderr.push(String(chunk)));
  child.on("exit", () => {
    stopped = true;
  });
  return {
    configDigest: sha256(encoded),
    configKeySet: Object.keys(configObject).sort(),
    async send(method, params) {
      const id = nextRequestId();
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
      const result = await iterator.next();
      if (result.done) {
        throw new Error(`stdio server closed before response; stderrDigest=${sha256(stderr.join(""))}`);
      }
      return JSON.parse(result.value);
    },
    async stop() {
      if (stopped) {
        return;
      }
      child.stdin.end();
      await new Promise((resolveExit) => child.once("exit", resolveExit));
      lines.close();
    }
  };
}

function proveRuntimeRootPath(runtimeRoot, dbPath, rootReadback) {
  const staleMarkerReadback = proveStaleMarkerRejected();
  const cases = {
    routeOwnedPositive: true,
    canonicalDirectChild: dirname(dbPath) === runtimeRoot,
    rootDigestRecorded: typeof rootReadback.rootDigest === "string" && rootReadback.rootDigest.length > 0,
    missingDatabasePathRejected: expectCreateRuntimeReject({ actor, databaseRoot: runtimeRoot, repoRoot, migrationsDir }, "transport_runtime_database_path_required"),
    missingDatabaseRootRejected: expectCreateRuntimeReject({ actor, databasePath: dbPath, repoRoot, migrationsDir }, "transport_runtime_database_root_required"),
    srvPathRejected: expectCreateRuntimeReject({
      actor,
      databasePath: join("/srv", "tcrn", "aos.sqlite"),
      databaseRoot: join("/srv", "tcrn"),
      repoRoot,
      migrationsDir
    }, "transport_runtime_srv_path_denied"),
    durableHomeRejected: expectCreateRuntimeReject({
      actor,
      databasePath: join(homedir(), ".tcrn", "aos.sqlite"),
      databaseRoot: join(homedir(), ".tcrn"),
      repoRoot,
      migrationsDir
    }, "transport_runtime_durable_home_path_denied"),
    retainedPreviewOwnerVisibleRejected: expectCreateRuntimeReject({
      actor,
      databasePath: join(realpathSync(tmpdir()), "retained-preview-owner-visible", "aos.sqlite"),
      databaseRoot: join(realpathSync(tmpdir()), "retained-preview-owner-visible"),
      repoRoot,
      migrationsDir
    }, "transport_runtime_retained_or_owner_visible_path_denied"),
    repoTreeRejected: expectCreateRuntimeReject({
      actor,
      databasePath: join(repoRoot, "runtime-profile.sqlite"),
      databaseRoot: repoRoot,
      repoRoot,
      migrationsDir
    }, "phase1_sqlite_root_inside_git_repo_denied"),
    wrongSiblingRejected: expectCreateRuntimeReject({
      actor,
      databasePath: join(repoRoot, "..", "..", "TCRN-AOS", "runtime-profile", "runtime.sqlite"),
      databaseRoot: join(repoRoot, "..", "..", "TCRN-AOS", "runtime-profile"),
      repoRoot,
      migrationsDir
    }, "transport_runtime_wrong_sibling_path_denied"),
    missingMarkerRejected: proveMissingMarkerRejected(),
    staleMarkerRejected: staleMarkerReadback.rejected === true && staleMarkerReadback.databaseFileCreated === false,
    symlinkRootRejected: proveSymlinkRootRejected(),
    symlinkAncestorRejected: proveSymlinkAncestorRejected(),
    dbFileSymlinkRejected: proveDbFileSymlinkRejected(),
    nestedDbPathRejected: expectCreateRuntimeReject({
      actor,
      databasePath: join(runtimeRoot, "nested", "runtime.sqlite"),
      databaseRoot: runtimeRoot,
      repoRoot,
      routeOwnedMarkerFile: markerFile,
      runtimeProfileMarker: runtimeProfileMarkerExpectation(),
      migrationsDir
    }, "transport_runtime_database_nested_path_denied"),
    outsideDbPathRejected: expectCreateRuntimeReject({
      actor,
      databasePath: join(dirname(runtimeRoot), "outside-runtime.sqlite"),
      databaseRoot: runtimeRoot,
      repoRoot,
      routeOwnedMarkerFile: markerFile,
      runtimeProfileMarker: runtimeProfileMarkerExpectation(),
      migrationsDir
    }, "transport_runtime_database_path_outside_route_owned_root")
  };
  return {
    ok: Object.values(cases).every(Boolean),
    ...cases,
    canonicalDatabasePathInsideRouteOwnedRoot: true,
    staleMarkerRuntimeRejection: staleMarkerReadback,
    rawPathRecorded: false,
    committedDbArtifact: false,
    activationClaimed: false,
    failures: Object.entries(cases).filter(([, ok]) => ok !== true).map(([name]) => name)
  };
}

async function proveActorBinding(dbPath) {
  const cases = {};
  cases.unknownEmployeeDenied = await expectRuntimeSessionReason(dbPath, {
    employeeId: "employee-phase3-runtime-unknown",
    role: "implementation",
    threadId: "phase3-runtime-unknown-thread",
    sessionId: "phase3-runtime-unknown"
  }, "transport_actor_unknown");
  cases.wrongRoleDenied = await expectRuntimeSessionReason(dbPath, {
    ...actor,
    role: "security"
  }, "transport_actor_role_mismatch");
  cases.wrongThreadDenied = await expectRuntimeSessionReason(dbPath, {
    ...actor,
    threadId: "wrong-thread"
  }, "transport_actor_thread_mismatch");
  cases.inactiveLifecycleDenied = await expectRuntimeSessionReason(dbPath, inactiveActor, "transport_actor_lifecycle_inactive");
  cases.archivedThreadDenied = await expectRuntimeSessionReason(dbPath, archivedThreadActor, "transport_actor_thread_inactive");
  return {
    ok: Object.values(cases).every(Boolean),
    ...cases,
    trustedConfigSource: "server_config_only",
    arbitraryClientAuthorityTrusted: false
  };
}

async function expectRuntimeSessionReason(dbPath, sessionActor, expectedReason) {
  const session = await startClientSession(dbPath, sessionActor);
  try {
    const policy = await session.send("aos.policy.read", {});
    return responseReason(policy) === expectedReason;
  } finally {
    await session.stop();
  }
}

function proveOneInitiativeOneEpicBinding(dbPath, seed, pages) {
  const repository = new AosSqliteRepository({ databasePath: dbPath, migrationsDir });
  repository.applyMigrations();
  const store = new AosStore(createProofSeed(), { persistence: repository });
  const initiatives = store.listInitiatives().filter((initiative) => initiative.title === "AOS human readback v1");
  const epics = store.listEpics().filter((epic) => epic.initiativeId === seed.initiativeId);
  const stories = store.listStories().filter((story) => story.epicId === seed.epicId);
  const gates = store.listGates().filter((gate) => stories.some((story) => story.id === gate.linkedTicketId));
  repository.close();
  const rowText = JSON.stringify(pages.map((page) => responsePayload(page)));
  return {
    ok: initiatives.length === 1 &&
      epics.length === 1 &&
      stories.length >= 2 &&
      gates.length >= 1 &&
      rowText.includes(seed.initiativeId) &&
      rowText.includes(seed.epicId),
    initiativeTitle: "AOS human readback v1",
    initiativeCount: initiatives.length,
    epicCount: epics.length,
    storyCount: stories.length,
    gateCount: gates.length,
    componentGapStoryPresent: stories.some((story) => story.id === seed.componentGapStoryId),
    ticketListRowsBoundToInitiative: rowText.includes(seed.initiativeId),
    ticketListRowsBoundToEpic: rowText.includes(seed.epicId),
    rawDbRowsReturned: false
  };
}

function proveRunEvidenceGateTraceability(dbPath, seed, responses) {
  const repository = new AosSqliteRepository({ databasePath: dbPath, migrationsDir });
  repository.applyMigrations();
  const store = new AosStore(createProofSeed(), { persistence: repository });
  const story = store.listStories().find((row) => row.id === seed.storyId);
  const assignments = store.listAssignments().filter((assignment) => assignment.targetType === "story" && assignment.targetId === seed.storyId);
  const assignmentIds = new Set(assignments.map((assignment) => assignment.id));
  const runs = store.listRuns().filter((run) => assignmentIds.has(run.assignmentId));
  const gates = store.listGates().filter((gate) => gate.linkedTicketId === seed.storyId);
  const gateEvidenceIds = new Set(gates.flatMap((gate) => gate.inputEvidenceIds));
  const linkedEvidenceId = responsePayload(responses.evidence).result.id;
  const evidence = store.listEvidence().filter((row) => gateEvidenceIds.has(row.id) || row.id === linkedEvidenceId);
  const tracedTargetIds = new Set([
    seed.storyId,
    ...assignmentIds,
    ...runs.map((run) => run.id),
    ...gates.map((gate) => gate.id),
    ...evidence.map((row) => row.id)
  ]);
  const auditRows = store.queryAudit().filter((event) => tracedTargetIds.has(event.targetId));
  const ticketRow = store.listTickets({ storyId: seed.storyId, limit: 1 }).rows[0] ?? null;
  repository.close();

  const claimPayload = responsePayload(responses.claim);
  const updatePayload = responsePayload(responses.update);
  const runPayload = responsePayload(responses.run);
  const runReplayPayload = responsePayload(responses.runReplay);
  const gatePayload = responsePayload(responses.gate);
  const finalTicketPayload = responsePayload(responses.finalTicketReadback);
  const runId = runPayload.result.id;
  const gateId = gatePayload.result.gate.id;
  const assignmentId = claimPayload.result.assignment.id;
  const auditActions = [...new Set(auditRows.map((event) => event.action))].sort((left, right) => left.localeCompare(right));
  const finalTicketRow = finalTicketPayload.rows[0] ?? ticketRow;
  const ok = Boolean(story) &&
    assignmentIds.has(assignmentId) &&
    runs.some((run) => run.id === runId) &&
    evidence.some((row) => row.id === seed.evidenceId) &&
    evidence.some((row) => row.id === linkedEvidenceId) &&
    gates.some((gate) => gate.id === gateId && gate.status === "accepted") &&
    finalTicketRow?.runReferences?.some((run) => run.id === runId) === true &&
    finalTicketRow?.latestGate?.id === gateId &&
    finalTicketRow?.latestEvidence?.id === seed.evidenceId &&
    auditActions.includes("agent_run.record") &&
    auditActions.includes("gate.decision.record");

  return {
    ok,
    storyId: seed.storyId,
    assignmentId,
    assignmentInitialStatus: claimPayload.result.assignment.status,
    assignmentUpdatedStatus: updatePayload.result.assignment.status,
    persistedRunId: runId,
    runStatus: runPayload.result.status,
    runReplayStatus: runReplayPayload.status,
    linkedEvidenceIds: [seed.evidenceId, linkedEvidenceId].sort((left, right) => left.localeCompare(right)),
    gateId,
    gateDecisionStatus: gatePayload.result.gate.status,
    gateRequestSource: "route_owned_seeded_gate_work_order",
    ticketListRunReferencePresent: finalTicketRow?.runReferences?.some((run) => run.id === runId) === true,
    ticketListLatestGatePresent: finalTicketRow?.latestGate?.id === gateId,
    ticketListLatestEvidencePresent: finalTicketRow?.latestEvidence?.id === seed.evidenceId,
    tracedAuditActionSet: auditActions,
    traceTargetCounts: {
      assignments: assignments.length,
      runs: runs.length,
      evidence: evidence.length,
      gates: gates.length,
      auditEvents: auditRows.length
    },
    rawRunReadbackReturned: false,
    rawEvidenceTargetReturned: false,
    rawAuditDetailsReturned: false,
    rawDbRowsReturned: false
  };
}

function proveTicketListFrontendReadback(dbPath, seed) {
  const repository = new AosSqliteRepository({ databasePath: dbPath, migrationsDir });
  repository.applyMigrations();
  const store = new AosStore(createProofSeed(), { persistence: repository });
  const ticketResponse = createWorkReadbackApiResponse(
    store,
    "/api/work/readback/tickets",
    new URLSearchParams({ storyId: seed.storyId, limit: "10" })
  );
  const auditResponse = createWorkReadbackApiResponse(
    store,
    "/api/work/readback/audit",
    new URLSearchParams({ targetId: seed.storyId, limit: "5" })
  );
  const policyResponse = createWorkReadbackApiResponse(
    store,
    "/api/work/readback/policy",
    new URLSearchParams()
  );
  repository.close();

  const html = renderAosShellHtml({ path: "/work/readback", search: "?locale=en&theme=light" });
  const row = Array.isArray(ticketResponse.body.rows) ? ticketResponse.body.rows[0] : null;
  const endpoints = [
    "/api/work/readback/tickets",
    "/api/work/readback/audit",
    "/api/work/readback/policy"
  ];
  const htmlEndpointBounded = endpoints.every((endpoint) => html.includes(endpoint)) &&
    html.includes('data-generic-mcp-facade="unused"') &&
    html.includes('data-generic-gateway-facade="unused"') &&
    html.includes('data-method-dispatch-facade="absent"');
  const policyMethods = Array.isArray(policyResponse.body.readbackMethods) ? policyResponse.body.readbackMethods : [];
  const ok = ticketResponse.statusCode === 200 &&
    auditResponse.statusCode === 200 &&
    policyResponse.statusCode === 200 &&
    ticketResponse.body.method === "aos.ticket.list" &&
    ticketResponse.body.schemaVersion === "aos.ticket.list.v1" &&
    ticketResponse.body.rowGrain === "story" &&
    row?.initiativeId === seed.initiativeId &&
    row?.epicId === seed.epicId &&
    row?.storyId === seed.storyId &&
    auditResponse.body.method === "aos.audit.query" &&
    policyMethods.includes("aos.ticket.list") &&
    policyMethods.includes("aos.audit.query") &&
    policyResponse.body.fullGatewayMethodListExposed === false &&
    htmlEndpointBounded;

  return {
    ok,
    frontendRoute: "/work/readback",
    frontendHtmlDigest: sha256(html),
    frontendHtmlStoredRaw: false,
    htmlEndpointBounded,
    apiSurface: "work.readback",
    ticketEndpointStatus: ticketResponse.statusCode,
    ticketMethod: ticketResponse.body.method,
    ticketSchemaVersion: ticketResponse.body.schemaVersion,
    ticketRowGrain: ticketResponse.body.rowGrain,
    ticketRowBoundToInitiative: row?.initiativeId === seed.initiativeId,
    ticketRowBoundToEpic: row?.epicId === seed.epicId,
    ticketRowBoundToStory: row?.storyId === seed.storyId,
    latestEvidenceSummaryOnly: Boolean(row?.latestEvidence?.id && row?.latestEvidence?.redactionState),
    runReferencesSummaryOnly: Array.isArray(row?.runReferences),
    auditEndpointStatus: auditResponse.statusCode,
    auditTargetScoped: Array.isArray(auditResponse.body.items) &&
      auditResponse.body.items.every((item) => item.targetId === seed.storyId),
    policyEndpointStatus: policyResponse.statusCode,
    policyReadbackMethods: policyMethods,
    fullGatewayMethodListExposed: policyResponse.body.fullGatewayMethodListExposed,
    genericMcpGatewayMethodDispatchUsed: false,
    rawDbRowsReturned: false,
    rawRecordJsonReturned: false,
    ownerVisiblePreviewClaimed: false
  };
}

function proveSelectedStoryAudit(dbPath, seed, selectedStoryAuditReadback) {
  const repository = new AosSqliteRepository({ databasePath: dbPath, migrationsDir });
  repository.applyMigrations();
  const store = new AosStore(createProofSeed(), { persistence: repository });
  const targeted = createWorkReadbackApiResponse(
    store,
    "/api/work/readback/audit",
    new URLSearchParams({ targetId: seed.storyId, limit: "5" })
  );
  const unscoped = createWorkReadbackApiResponse(store, "/api/work/readback/audit", new URLSearchParams());
  const invalidCursor = createWorkReadbackApiResponse(
    store,
    "/api/work/readback/audit",
    new URLSearchParams({ targetId: seed.storyId, cursor: "not-a-valid-audit-cursor" })
  );
  repository.close();

  const transportPayload = responsePayload(selectedStoryAuditReadback);
  const targetedItems = Array.isArray(targeted.body.items) ? targeted.body.items : [];
  const transportItems = Array.isArray(transportPayload.items) ? transportPayload.items : [];
  const ok = targeted.statusCode === 200 &&
    targetedItems.length > 0 &&
    targetedItems.every((item) => item.targetId === seed.storyId) &&
    unscoped.statusCode === 400 &&
    unscoped.body.reason === "audit_scope_required" &&
    invalidCursor.statusCode === 400 &&
    invalidCursor.body.reason === "invalid_audit_cursor" &&
    transportItems.every((item) => item.targetId === seed.storyId);

  return {
    ok,
    targetId: seed.storyId,
    browserFacadeAuditStatus: targeted.statusCode,
    browserFacadeReturnedCount: targeted.body.returnedCount,
    transportAuditReturnedCount: transportPayload.returnedCount,
    allBrowserItemsTargetScoped: targetedItems.every((item) => item.targetId === seed.storyId),
    allTransportItemsTargetScoped: transportItems.every((item) => item.targetId === seed.storyId),
    unscopedAuditRejected: unscoped.body.reason,
    invalidAuditCursorRejected: invalidCursor.body.reason,
    globalAllWorkTimelineExposed: false,
    rawAuditDetailsReturned: false,
    rawDbRowsReturned: false
  };
}

async function proveNegativeMethods(session) {
  const cases = [
    ["aos.gate.status.update", "transport_method_unknown"],
    ["aos.work_index.drill_through.read", "transport_method_outside_mvp_allowlist"],
    ["aos.work_index.any", "transport_method_outside_mvp_allowlist"],
    ["aos.assignment.create", "transport_method_unknown"],
    ["aos.assignment.write", "transport_method_unknown"],
    ["aos.gate.write", "transport_method_unknown"],
    ["aos.resource.record.propose", "transport_method_outside_mvp_allowlist"],
    ["aos.documentation.entry.propose", "transport_method_outside_mvp_allowlist"],
    ["aos.release_candidate.link", "transport_method_outside_mvp_allowlist"],
    ["aos.dependency.record", "transport_method_outside_mvp_allowlist"],
    ["aos.raw_db.export", "transport_method_unknown"],
    ["aos.owner_intent.execute", "transport_method_unknown"]
  ];
  const results = [];
  for (const [method, expectedReason] of cases) {
    const response = await session.send(method, {});
    const reason = responseReason(response);
    results.push({
      method,
      expectedReason,
      reason,
      rejected: reason === expectedReason,
      response
    });
  }
  return results;
}

async function proveResponseBudgetReplay() {
  const root = mkdtempSync(join(realpathSync(tmpdir()), "tcrn-aos-phase3-runtime-budget-"));
  const dbPath = join(root, "runtime-budget.sqlite");
  try {
    writeProfileMarker(root);
    assertRouteOwnedSqliteRoot(root, repoRoot, markerFile);
    seedRuntimeProfileDatabase(dbPath, { storyTitleLength: 900 });
    const session = await startClientSession(dbPath, actor, { maxResponseBytes: 1024 });
    try {
      const first = await session.send("aos.ticket.list", { limit: 3 });
      const replay = await session.send("aos.ticket.list", { limit: 3 });
      return {
        ok: responseReason(first) === "transport_response_budget_exceeded" &&
          responseReason(replay) === "transport_response_budget_exceeded" &&
          replay.result?.status !== "deduped",
        firstRejected: responseReason(first) === "transport_response_budget_exceeded",
        replayRejected: responseReason(replay) === "transport_response_budget_exceeded",
        firstReason: responseReason(first),
        replayReason: responseReason(replay),
        processLocalReplay: "over_budget_response_not_cached",
        cacheBypassClosed: responseReason(first) === "transport_response_budget_exceeded" &&
          responseReason(replay) === "transport_response_budget_exceeded",
        rawPathRecorded: false
      };
    } finally {
      await session.stop();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

async function proveConcurrencyAndRestart(dbPath, seed) {
  const sameActor = await Promise.all([
    runClaimWorkerProcess(dbPath, actor, seed.raceStoryId, "runtime-profile-race-a", seed),
    runClaimWorkerProcess(dbPath, actor, seed.raceStoryId, "runtime-profile-race-b", seed)
  ]);
  const activeCount = activeAssignmentCount(dbPath, seed.raceStoryId, "implementation");
  const restart = await startClientSession(dbPath, actor);
  try {
    const ticket = await restart.send("aos.ticket.list", { storyId: seed.storyId });
    const audit = await restart.send("aos.audit.query", { limit: 5 });
    return {
      ok: sameActor.every((result) => result.ok === true) &&
        activeCount === 1 &&
        responsePayload(ticket).rows.length === 1 &&
        responsePayload(audit).returnedCount > 0,
      multiProcessClaimRace: {
        attempts: sameActor.length,
        successes: sameActor.filter((result) => result.ok).length,
        activeAssignmentCount: activeCount,
        assignmentIds: [...new Set(sameActor.map((result) => result.assignmentId).filter(Boolean))],
        noDuplicateActiveAssignment: activeCount === 1
      },
      restartReadback: {
        childProcessRestarted: true,
        ticketReadbackOk: responsePayload(ticket).rows.length === 1,
        auditReadbackOk: responsePayload(audit).returnedCount > 0
      },
      lockState: "no_unrecoverable_lock_state",
      durableCrossRestartDedupeClaimed: false
    };
  } finally {
    await restart.stop();
  }
}

function runClaimWorker() {
  const payload = JSON.parse(Buffer.from(process.env.PHASE3_RUNTIME_PROFILE_WORKER ?? "", "base64url").toString("utf8"));
  const runtime = createRuntimeTransport({
    actor: payload.actor,
    databasePath: payload.dbPath,
    databaseRoot: dirname(payload.dbPath),
    repoRoot,
    routeOwnedMarkerFile: markerFile,
    runtimeProfileMarker: runtimeProfileMarkerExpectation(),
    migrationsDir,
    maxResponseBytes: 16_384
  });
  try {
    const response = runtime.transport.handleJsonRpc({
      jsonrpc: "2.0",
      id: 1,
      method: "aos.assignment.claim",
      params: {
        targetType: "story",
        targetId: payload.targetId,
        initiativeId: payload.initiativeId,
        epicId: payload.epicId,
        idempotencyKey: payload.idempotencyKey
      }
    });
    process.stdout.write(`${JSON.stringify({
      ok: response.error === undefined,
      reason: responseReason(response),
      assignmentId: response.result?.result?.assignment?.id ?? null,
      replayedByState: response.result?.result?.replayedByState === true,
      status: response.result?.result?.assignment?.status ?? null
    })}\n`);
  } finally {
    runtime.close();
  }
}

function runClaimWorkerProcess(dbPath, sessionActor, targetId, idempotencyKey, seed) {
  const payload = Buffer.from(JSON.stringify({
    dbPath,
    actor: sessionActor,
    targetId,
    initiativeId: seed.initiativeId,
    epicId: seed.epicId,
    idempotencyKey
  }), "utf8").toString("base64url");
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), "--claim-worker"], {
      cwd: repoRoot,
      env: { ...process.env, PHASE3_RUNTIME_PROFILE_WORKER: payload },
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
      resolvePromise(JSON.parse(stdout.join("").trim()));
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
  const receiptScan = scanTextForPrivacy(receiptText);
  const responseScan = scanTextForPrivacy(responseText);
  const auditScan = scanTextForPrivacy(auditText);
  const sourceScan = source.files.flatMap((file) => {
    const text = readFileSync(join(repoRoot, file.file), "utf8");
    return scanTextForPrivacy(text)
      .filter((finding) => !(file.file === "scripts/phase3-runtime-profile-proof.mjs" && finding.allowedNegativeContext === true))
      .filter((finding) => finding.kind !== "db_dump")
      .map((finding) => ({ ...finding, file: file.file }));
  });
  return {
    ok: rawValuesAbsentFromResponses &&
      rawValuesAbsentFromAuditRows &&
      rawValuesAbsentFromReceipts &&
      receiptScan.length === 0 &&
      responseScan.length === 0 &&
      auditScan.length === 0 &&
      sourceScan.length === 0,
    rawValuesAbsentFromResponses,
    rawValuesAbsentFromAuditRows,
    rawValuesAbsentFromReceipts,
    responsePayloadsScanned: capturedResponses.length,
    auditRowsScanned: auditRows.length,
    receiptFilesScanned: receiptPaths.length,
    sourceFilesScanned: source.files.length,
    receiptFindings: receiptScan,
    responseFindings: responseScan,
    auditFindings: auditScan,
    sourceFindings: sourceScan,
    rawValueDigests: Object.fromEntries(forbiddenRawValues.map((value, index) => [`fixture_${index}`, sha256(value)])),
    rawPathRecorded: false,
    rawDbDumpRecorded: false,
    rawClientEnvStored: false,
    rawTranscriptBodiesStored: false,
    secretsOrPiiStored: false,
    overclaimLanguagePresent: false,
    noOverclaimFlags
  };
}

function scanTextForPrivacy(text) {
  const patterns = [
    { kind: "local_users_path", regex: /\/Users\// },
    { kind: "tmp_path", regex: /\/tmp\// },
    { kind: "private_tmp_path", regex: /\/private\/tmp\// },
    { kind: "file_uri", regex: /file:\/\// },
    { kind: "raw_private_fixture", regex: /phase3-runtime-private-/ },
    { kind: "db_dump", regex: /record_json|CREATE TABLE|INSERT INTO/i },
    { kind: "secret_like", regex: /(AKIA[0-9A-Z]{16}|BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY|ghp_[A-Za-z0-9_]{20,})/ },
    { kind: "acceptance_overclaim", regex: /\b(owner acceptance|product acceptance|final MVP acceptance|dogfood runtime readiness|release readiness)\b/i },
    { kind: "live_dispatch_claim", regex: /\blive dispatch authorized\b/i }
  ];
  const findings = [];
  for (const pattern of patterns) {
    if (pattern.regex.test(text)) {
      findings.push({
        kind: pattern.kind,
        allowedNegativeContext: pattern.kind === "raw_private_fixture" || pattern.kind === "acceptance_overclaim" || pattern.kind === "live_dispatch_claim"
      });
    }
  }
  return findings;
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
    routeOwnedProfileRoot: {
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

function createProofSeed() {
  const seed = createDefaultSeed();
  return {
    ...seed,
    employees: mergeEmployees(seed.employees, [observerEmployee, inactiveEmployee, archivedThreadEmployee])
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

function writeProfileMarker(root, content = profileMarkerContent(root)) {
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, markerFile), JSON.stringify(content), "utf8");
}

function profileMarkerContent(root) {
  return {
    route,
    markerVersion: "phase3-runtime-profile.v1",
    rootDigest: sha256(resolve(root)),
    purpose: markerPurpose
  };
}

function runtimeProfileMarkerExpectation() {
  return {
    route,
    markerVersion: "phase3-runtime-profile.v1",
    purpose: markerPurpose
  };
}

function proveMissingMarkerRejected() {
  const root = mkdtempSync(join(realpathSync(tmpdir()), "tcrn-aos-phase3-runtime-missing-marker-"));
  try {
    return expectCreateRuntimeReject({
      actor,
      databasePath: join(root, "runtime.sqlite"),
      databaseRoot: root,
      repoRoot,
      routeOwnedMarkerFile: markerFile,
      migrationsDir
    }, "phase1_sqlite_root_marker_missing");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function proveStaleMarkerRejected() {
  const root = mkdtempSync(join(realpathSync(tmpdir()), "tcrn-aos-phase3-runtime-stale-marker-"));
  const dbPath = join(root, "runtime.sqlite");
  try {
    writeProfileMarker(root, { route: "stale-route", markerVersion: "phase3-runtime-profile.v1", rootDigest: "stale" });
    const rejection = expectCreateRuntimeRejectReadback({
      actor,
      databasePath: dbPath,
      databaseRoot: root,
      repoRoot,
      routeOwnedMarkerFile: markerFile,
      runtimeProfileMarker: runtimeProfileMarkerExpectation(),
      migrationsDir
    }, "transport_runtime_profile_marker_stale_or_mismatched");
    return {
      rejected: rejection.rejected,
      reason: rejection.reason,
      runtimeValidationPath: "createRuntimeTransport",
      localFreshnessHelperOnly: false,
      databaseFileCreated: existsSync(dbPath)
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function proveSymlinkRootRejected() {
  const parent = mkdtempSync(join(realpathSync(tmpdir()), "tcrn-aos-phase3-runtime-symlink-root-"));
  try {
    const realRoot = join(parent, "real-root");
    const linkedRoot = join(parent, "linked-root");
    mkdirSync(realRoot, { recursive: true });
    writeProfileMarker(realRoot);
    symlinkSync(realRoot, linkedRoot, "dir");
    return expectCreateRuntimeReject({
      actor,
      databasePath: join(linkedRoot, "runtime.sqlite"),
      databaseRoot: linkedRoot,
      repoRoot,
      routeOwnedMarkerFile: markerFile,
      migrationsDir
    }, "transport_runtime_database_root_symlink_ancestor_denied");
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
}

function proveSymlinkAncestorRejected() {
  const parent = mkdtempSync(join(realpathSync(tmpdir()), "tcrn-aos-phase3-runtime-symlink-ancestor-"));
  try {
    const realParent = join(parent, "real-parent");
    const linkedParent = join(parent, "linked-parent");
    const linkedRoot = join(linkedParent, "runtime-root");
    mkdirSync(realParent, { recursive: true });
    symlinkSync(realParent, linkedParent, "dir");
    mkdirSync(linkedRoot, { recursive: true });
    writeProfileMarker(linkedRoot);
    return expectCreateRuntimeReject({
      actor,
      databasePath: join(linkedRoot, "runtime.sqlite"),
      databaseRoot: linkedRoot,
      repoRoot,
      routeOwnedMarkerFile: markerFile,
      migrationsDir
    }, "transport_runtime_database_root_symlink_ancestor_denied");
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
}

function proveDbFileSymlinkRejected() {
  const root = mkdtempSync(join(realpathSync(tmpdir()), "tcrn-aos-phase3-runtime-db-symlink-"));
  const outsideRoot = mkdtempSync(join(realpathSync(tmpdir()), "tcrn-aos-phase3-runtime-outside-"));
  try {
    writeProfileMarker(root);
    const outsideDb = join(outsideRoot, "outside.sqlite");
    writeFileSync(outsideDb, "", "utf8");
    symlinkSync(outsideDb, join(root, "runtime.sqlite"));
    return expectCreateRuntimeReject({
      actor,
      databasePath: join(root, "runtime.sqlite"),
      databaseRoot: root,
      repoRoot,
      routeOwnedMarkerFile: markerFile,
      runtimeProfileMarker: runtimeProfileMarkerExpectation(),
      migrationsDir
    }, "transport_runtime_database_file_symlink_denied");
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outsideRoot, { recursive: true, force: true });
  }
}

function expectCreateRuntimeReject(config, expectedReason) {
  return expectCreateRuntimeRejectReadback(config, expectedReason).rejected;
}

function expectCreateRuntimeRejectReadback(config, expectedReason) {
  try {
    const runtime = createRuntimeTransport(config);
    runtime.close();
    return { rejected: false, reason: null, expectedReason };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { rejected: reason.includes(expectedReason), reason, expectedReason };
  }
}

function noCommittedDbArtifacts() {
  const result = spawnSync("git", ["ls-files"], { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) {
    return false;
  }
  return !result.stdout.split("\n").some((file) => /\.(sqlite|sqlite3|db|db-shm|db-wal)$/.test(file));
}

function publicActor(value) {
  return {
    employeeId: value.employeeId,
    role: value.role,
    threadId: value.threadId
  };
}

function responsePayload(response) {
  assert.equal(response.error, undefined, JSON.stringify(response));
  return response.result;
}

function responseReason(response) {
  return response.error?.data?.reason ?? response.result?.error ?? null;
}

function nextRequestId() {
  requestId += 1;
  return requestId;
}

function git(args) {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  }
  return result.stdout.trim();
}
