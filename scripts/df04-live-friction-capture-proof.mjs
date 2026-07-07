import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { AosSqliteRepository, assertRouteOwnedSqliteRoot, sha256 } from "../dist/packages/db/src/index.js";
import { AosStore, createDefaultSeed } from "../dist/packages/domain/src/index.js";
import { createRuntimeTransport } from "../dist/packages/mcp-server/src/index.js";
import { createWorkReadbackApiResponse } from "../dist/apps/api/src/work-readback.js";

const route = "route_tcrn_conditional_dogfood_start_df04_live_friction_capture_protocol_ilya_after_df03_pm_acceptance_77069c_1dcb12_20260707";
const workflowBasis = "1dcb1265ec3845feb9d51cd5f377ddce0a5aedb0";
const incomingAosBasis = "77069cdb15f2ff70304e18824f7674ae32b964d3";
const p1Route = "route_tcrn_conditional_dogfood_start_p1_durable_runtime_profile_root_migration_ilya_after_owner_decision_949a58_8aa904_20260707";
const df03Route = "route_tcrn_conditional_dogfood_start_df03_d5_status_migration_ilya_after_df02_checkpoint_1dcb12_937324_20260707";
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const evidenceRoot = join(repoRoot, "evidence/conditional-dogfood-start-df04-live-friction-capture");
const migrationsDir = join(repoRoot, "packages/db/migrations/sqlite");
const command = "pnpm --dir TCRN-AOS df04:live-friction-capture-proof";
const markerFile = ".tcrn-aos-phase1-root";
const ownerMarkerFile = ".aos-persistent-runtime-owner.json";
const markerPurpose = "p1-clean-start-durable-runtime-profile-root";
const markerVersion = "conditional-dogfood-start-p1-runtime-profile.v1";
const databaseFileName = "aos-p1-durable-runtime-profile.sqlite";
const summaryReceiptName = "df04-live-friction-capture-proof-summary.json";
const readbackReceiptName = "df04-live-friction-capture-readback.json";
const captureKey = "conditional-dogfood-start-df04-ilya-self-session-friction-v1";
const routingRoundCategory = "implementation-start routing round count";
const implementationStartRoutingRoundCount = 1;
const sourceFiles = [
  "package.json",
  "scripts/df04-live-friction-capture-proof.mjs",
  "scripts/df03-status-migration-proof.mjs",
  "packages/domain/src/store.ts",
  "packages/mcp-server/src/transport.ts",
  "apps/api/src/work-readback.ts"
];
const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "df04-live-friction-capture"
};
const ownerDecisionFields = {
  owner_accepts_packet: "accepted",
  p1_runtime_root_migration: "authorized",
  p1_data_disposition: "clean_start_declared",
  df02_crew_equivalence_accepted: "accepted",
  dogfood_start_after_p1_readback: "authorized_after_verified_persistent_root_readback"
};
const noOverclaimFlags = {
  df04CurrentRouteSelfSessionCaptureRecorded: true,
  df04FullyCompleteClaimed: false,
  universalNoFrictionClaimed: false,
  participantsFanoutComplete: false,
  p0P1ClassificationPerformed: false,
  frictionFixImplemented: false,
  p1DurableLocalProfileRootUsed: true,
  proofScriptMediatedD4FrictionNoneReused: false,
  workflowMutation: false,
  designSystemMutation: false,
  tmsMutation: false,
  activeCodexMutation: false,
  maintainedHookSourceMutation: false,
  registryDefaultMutation: false,
  generatedAgentMutation: false,
  df04CompletionClaimed: false,
  phase3AcceptanceOrReevaluationStarted: false,
  phase4BroadCloseoutClaimed: false,
  phase5Started: false,
  dogfoodRuntimeReadinessClaimed: false,
  productReadinessClaimed: false,
  releasePublicationPushClaimed: false,
  ownerFacingHandoffClaimed: false,
  ownerAcceptanceClaimed: false,
  cleanPlatformClaimed: false,
  liveDispatchAuthorized: false,
  ownerIntentExecutionAuthorized: false,
  hookBehaviorReliedOn: false,
  hookRetirementPerformed: false,
  broadActiveParityClaimed: false,
  broadCodexSecurityPluginScanClaimed: false
};
const frictionNoneBody = [
  "DF-04 live-thread friction capture: friction=none for Ilya current route session.",
  "Category: implementation-start routing round count.",
  "Counted rounds: 1 direct Arturo route from DF-03 PM/status acceptance to this Ilya DF-04 implementation/proof lane.",
  "Reason: no route-blocking blocker or awkward interaction occurred before implementation start or during this self-session capture.",
  "Participants beyond this Ilya session still require their own source-visible capture; no universal no-friction or DF-04 completion claim is made."
].join(" ");

mkdirSync(evidenceRoot, { recursive: true });
const source = sourceProvenance();
const selectedRoot = selectP1DurableRoot();
const databasePath = join(selectedRoot.root, databaseFileName);
const proof = runDf04Proof(selectedRoot.root, databasePath);
const privacy = privacyScan(proof);
const receipt = writeReceipt(readbackReceiptName, {
  ok: proof.ok && privacy.ok,
  source,
  selectedRoot: selectedRoot.readback,
  ownerDecisionFields,
  implementationReadback: proof.implementationReadback,
  frictionCaptureRecordReadback: proof.frictionCaptureRecordReadback,
  capturedFrictionTickets_or_none: proof.capturedFrictionTickets_or_none,
  routingRoundCountReadback: proof.routingRoundCountReadback,
  workReadbackTimelineVisibilityReadback: proof.workReadbackTimelineVisibilityReadback,
  idempotencyReplayReadback: proof.idempotencyReplayReadback,
  participantsStillNeeded: proof.participantsStillNeeded,
  privacyNoArtifactNoOverclaimReadback: proof.privacyNoArtifactNoOverclaimReadback,
  methodAuthorityBoundaryReadback: proof.methodAuthorityBoundaryReadback,
  localProfileRootPrivacyReadback: proof.localProfileRootPrivacyReadback,
  validation_readbacks: proof.validation_readbacks,
  privacyNoOverclaimScan: privacy,
  failures: [...proof.failures, ...privacy.findings.map((finding) => finding.kind)],
  negativeFailures: proof.negativeFailures,
  noOverclaimFlags
});
const summary = writeReceipt(summaryReceiptName, {
  ok: receipt.ok === true,
  source,
  ownerDecisionFields,
  receiptInventory: [readbackReceiptName],
  receiptCount: 1,
  allChildReceiptsOk: receipt.ok === true,
  missingReceipts: [],
  extraUnclassifiedReceipts: [],
  readbackReceiptDigest: sha256(JSON.stringify(receipt)),
  friction: receipt.capturedFrictionTickets_or_none.friction,
  commentId: receipt.frictionCaptureRecordReadback.commentId,
  auditEventId: receipt.frictionCaptureRecordReadback.auditEventId,
  implementationStartRoutingRoundCount,
  participantsStillNeededCount: receipt.participantsStillNeeded.length,
  noOverclaimFlags,
  failures: receipt.ok === true ? [] : ["df04_live_friction_capture_readback_not_ok"],
  negativeFailures: proof.negativeFailures
});

assert.equal(receipt.ok, true);
assert.equal(summary.ok, true);
console.log(JSON.stringify({
  ok: true,
  route,
  command,
  receipts: [summaryReceiptName, readbackReceiptName],
  storyId: proof.frictionCaptureRecordReadback.storyId,
  commentId: proof.frictionCaptureRecordReadback.commentId,
  auditEventId: proof.frictionCaptureRecordReadback.auditEventId,
  friction: proof.capturedFrictionTickets_or_none.friction,
  implementationStartRoutingRoundCount,
  participantsStillNeededCount: proof.participantsStillNeeded.length,
  workReadbackTimelineVisible: proof.workReadbackTimelineVisibilityReadback.ok,
  rawPathRecorded: false,
  df04CurrentRouteSelfSessionOnly: true
}, null, 2));

function runDf04Proof(root, databasePath) {
  validateP1DurableRoot(root, databasePath);
  const rootReadback = assertRouteOwnedSqliteRoot(root, repoRoot, markerFile);
  seedAuthorityRows(databasePath);

  const firstEnsure = ensureDf04CaptureRecord(root, databasePath);
  const secondEnsure = ensureDf04CaptureRecord(root, databasePath);
  const restart = readRestartReadback(databasePath, firstEnsure.storyId, firstEnsure.commentId, firstEnsure.auditEventId);
  const workReadback = createWorkReadbackVisibility(databasePath, firstEnsure.storyId, firstEnsure.auditEventId);
  const negative = proveNegativeAuthority(root, databasePath);
  const validation = validateReceiptsAndArtifacts(databasePath);
  const marker = markerReadback(root);
  const ok = firstEnsure.ok &&
    secondEnsure.ok &&
    restart.ok &&
    workReadback.ok &&
    secondEnsure.commentCount === firstEnsure.commentCount &&
    secondEnsure.frictionAuditCount === firstEnsure.frictionAuditCount &&
    negative.ok &&
    validation.noCommittedDbArtifacts &&
    marker.ok;
  const failures = [
    firstEnsure.ok ? null : "df04_first_capture_record_not_ok",
    secondEnsure.ok ? null : "df04_second_capture_record_not_ok",
    secondEnsure.commentCount === firstEnsure.commentCount ? null : "df04_comment_duplicate_on_replay",
    secondEnsure.frictionAuditCount === firstEnsure.frictionAuditCount ? null : "df04_audit_duplicate_on_replay",
    restart.ok ? null : "df04_restart_readback_not_ok",
    workReadback.ok ? null : "df04_work_readback_not_visible",
    negative.ok ? null : "df04_negative_authority_not_ok",
    validation.noCommittedDbArtifacts ? null : "df04_committed_db_artifact_found",
    marker.ok ? null : "df04_p1_marker_not_ok"
  ].filter(Boolean);

  return {
    ok,
    failures,
    negativeFailures: negative.negativeMethods.filter((item) => !item.rejected).map((item) => item.method),
    implementationReadback: {
      ok,
      route,
      sourceHead: source.sourceHead,
      workflowBasis,
      incomingAosBasis,
      command,
      implementationMode: "current_route_self_session_friction_none_comment_plus_target_scoped_audit",
      cleanStartProfileConsumed: true,
      p1DurableProfileRootUsed: true,
      scriptMediatedD4FrictionNoneReused: false,
      df04CompletionClaimed: false,
      workflowMutationPerformed: false,
      methodsExercised: ["aos.ticket.comment", "aos.ticket.list", "aos.audit.query"],
      storeAuditAction: "friction.capture.none",
      participantsFanoutRequiredForFullDf04: true
    },
    frictionCaptureRecordReadback: {
      ok: firstEnsure.ok && restart.ok,
      captureKey,
      initiativeId: firstEnsure.initiativeId,
      epicId: firstEnsure.epicId,
      storyId: firstEnsure.storyId,
      storyTitle: firstEnsure.storyTitle,
      commentId: firstEnsure.commentId,
      commentType: "agent_observation",
      commentBodyDigest: sha256(frictionNoneBody),
      commentAuditEventId: firstEnsure.commentAuditEventId,
      auditEventId: firstEnsure.auditEventId,
      auditAction: "friction.capture.none",
      auditOutcome: "accepted",
      commentAndAuditLinked: firstEnsure.commentId === restart.frictionAuditDetails.commentId,
      restartCommentPresent: restart.commentPresent,
      restartAuditPresent: restart.auditPresent,
      rawCommentBodyStoredInReceipt: false,
      rawAuditDetailsStoredInReceipt: false
    },
    capturedFrictionTickets_or_none: {
      friction: "none",
      reasonCode: "no_current_route_blocker_or_awkward_interaction",
      reasonDigest: sha256("no route-blocking blocker or awkward interaction occurred before implementation start or during this self-session capture"),
      capturedTicketIds: [],
      capturedTicketCount: 0,
      explicitNoneRecorded: true,
      appliesOnlyToThreadId: actor.threadId,
      appliesOnlyToRoute: route,
      universalNoFrictionClaimed: false,
      p0P1ClassificationPerformed: false,
      frictionFixImplemented: false
    },
    routingRoundCountReadback: {
      ok: true,
      category: routingRoundCategory,
      implementationStartRoutingRoundCount,
      countingRule: "count direct Arturo material-lane route from consumed DF-03 PM/status acceptance to this Ilya DF-04 route as one start-routing round",
      countedPath: [
        {
          order: 1,
          from: "DF-03 PM/status acceptance consumed by Arturo",
          to: "Ilya DF-04 live friction capture protocol route",
          route
        }
      ],
      inflatedOrInferredExtraRounds: false,
      sourceVisibleOnly: true
    },
    workReadbackTimelineVisibilityReadback: workReadback,
    idempotencyReplayReadback: {
      ok: secondEnsure.ok &&
        secondEnsure.commentId === firstEnsure.commentId &&
        secondEnsure.auditEventId === firstEnsure.auditEventId &&
        secondEnsure.commentCount === firstEnsure.commentCount &&
        secondEnsure.frictionAuditCount === firstEnsure.frictionAuditCount,
      firstCommentId: firstEnsure.commentId,
      secondCommentId: secondEnsure.commentId,
      firstAuditEventId: firstEnsure.auditEventId,
      secondAuditEventId: secondEnsure.auditEventId,
      firstCommentCount: firstEnsure.commentCount,
      secondCommentCount: secondEnsure.commentCount,
      firstFrictionAuditCount: firstEnsure.frictionAuditCount,
      secondFrictionAuditCount: secondEnsure.frictionAuditCount,
      secondEnsureNoop: secondEnsure.reusedExistingComment && secondEnsure.reusedExistingAudit
    },
    participantsStillNeeded: buildParticipantsStillNeeded(firstEnsure.storyId),
    privacyNoArtifactNoOverclaimReadback: {
      ok: validation.noCommittedDbArtifacts,
      rawPathRecorded: false,
      rawDbDumpRecorded: false,
      committedDbArtifacts: false,
      secretsOrPiiStored: false,
      privateOwnerPayloadStored: false,
      universalNoFrictionClaimed: false,
      df04CompletionClaimed: false,
      readinessClaimed: false,
      releasePublicationPushClaimed: false,
      ownerFacingAcceptanceClaimed: false
    },
    methodAuthorityBoundaryReadback: {
      ok: negative.ok,
      acceptedMethodsExercised: ["aos.ticket.comment", "aos.ticket.list", "aos.audit.query"],
      negativeMethods: negative.negativeMethods,
      broadGatewayExposureUsed: false,
      workIndexUsed: false,
      clientSuppliedAuthorityTrusted: false,
      liveDispatchAuthorized: false,
      ownerIntentExecutionAuthorized: false,
      hookBehaviorReliedOn: false,
      registryDefaultMutationPerformed: false
    },
    localProfileRootPrivacyReadback: {
      ok: marker.ok && validation.noCommittedDbArtifacts,
      profileRootClass: selectedRoot.readback.profileRootClass,
      selectedRootDigest: selectedRoot.readback.selectedRootDigest,
      sqliteRootDigest: rootReadback.rootDigest,
      marker,
      databaseFileName: basename(databasePath),
      databaseDigest: digestDatabaseFile(databasePath),
      databaseDirectChildOfRoot: dirname(databasePath) === root,
      rawPathRecorded: false,
      rawDbDumpRecorded: false,
      committedDbArtifacts: false,
      cleanupAttempted: false,
      cleanupDisposition: "p1_durable_profile_retained_for_owner_authorized_conditional_dogfood_start"
    },
    validation_readbacks: validation
  };
}

function ensureDf04CaptureRecord(root, databasePath) {
  const base = ensureDf04Containers(databasePath);
  const runtime = createRuntimeTransport(runtimeConfig(root, databasePath));
  try {
    const comment = ensureFrictionNoneComment(runtime.transport, databasePath, base.story.id);
    const audit = ensureFrictionNoneAudit(databasePath, base, comment);
    const counts = captureRecordCounts(databasePath, base.story.id, comment.commentId);
    return {
      ok: Boolean(base.ok && comment.ok && audit.ok && counts.commentCount === 1 && counts.frictionAuditCount === 1),
      initiativeId: base.initiative.id,
      epicId: base.epic.id,
      storyId: base.story.id,
      storyTitle: base.story.title,
      commentId: comment.commentId,
      commentAuditEventId: comment.commentAuditEventId,
      auditEventId: audit.auditEventId,
      commentCount: counts.commentCount,
      frictionAuditCount: counts.frictionAuditCount,
      reusedExistingComment: comment.reusedExistingComment,
      reusedExistingAudit: audit.reusedExistingAudit
    };
  } finally {
    runtime.close();
  }
}

function ensureDf04Containers(databasePath) {
  const session = openStore(databasePath);
  try {
    const seed = createDefaultSeed();
    const project = seed.projects.find((item) => item.id === "TCRN-AOS");
    session.store.upsertProject(project, actor);
    const initiative = session.store.listInitiatives().find((item) => item.title === "Conditional dogfood start") ??
      session.store.createInitiative({
        projectId: "TCRN-AOS",
        title: "Conditional dogfood start",
        status: "in_progress",
        problem: "Conditional dogfood start needs durable AOS records for live work and friction capture.",
        expectedOutcome: "Live thread friction capture is recorded as AOS comments and target-scoped audit events."
      }, actor);
    const epic = session.store.listEpics().find((item) => item.initiativeId === initiative.id && item.title === "DF-04 live friction capture") ??
      session.store.createEpic({
        initiativeId: initiative.id,
        title: "DF-04 live friction capture",
        goal: "Operate live-thread friction capture for conditional dogfood start without claiming universal no-friction.",
        status: "in_progress"
      }, actor);
    const story = session.store.listStories().find((item) => item.epicId === epic.id && item.title === "DF-04 Ilya self-session friction capture") ??
      session.store.createStory({
        epicId: epic.id,
        title: "DF-04 Ilya self-session friction capture",
        problem: "Live thread friction capture needs source-visible comment and audit records, not script-mediated protocol fixtures.",
        user: "participating dogfood-start threads and coordinator",
        expectedBehavior: "Each live participant records real friction or explicit none with reason and audit linkage.",
        acceptanceCriteria: [
          "current Ilya session records friction none with comment id",
          "current Ilya session records target-scoped audit event id",
          "implementation-start routing round count is recorded",
          "participants still needed are enumerated instead of proxy-captured"
        ],
        status: "in_progress",
        estimate: { effortPoints: 1, complexity: "low", risk: "L2", verificationCost: "medium", confidence: "medium" },
        subTasks: []
      }, actor);
    return { ok: true, initiative, epic, story };
  } finally {
    session.close();
  }
}

function ensureFrictionNoneComment(transport, databasePath, storyId) {
  const existing = findFrictionNoneComment(databasePath, storyId);
  if (existing) {
    return { ...existing, ok: true, reusedExistingComment: true };
  }
  const response = send(transport, "aos.ticket.comment", {
    ticketId: storyId,
    type: "agent_observation",
    body: frictionNoneBody,
    idempotencyKey: captureKey
  });
  const payload = responsePayload(response);
  const comment = payload.result;
  const persisted = findFrictionNoneComment(databasePath, storyId);
  return {
    ok: Boolean(payload.ok === true && comment?.id && persisted?.commentId === comment.id),
    commentId: comment.id,
    commentAuditEventId: persisted?.commentAuditEventId ?? null,
    reusedExistingComment: false
  };
}

function ensureFrictionNoneAudit(databasePath, base, comment) {
  const existing = findFrictionNoneAudit(databasePath, base.story.id, comment.commentId);
  if (existing) {
    return { ...existing, ok: true, reusedExistingAudit: true };
  }
  const session = openStore(databasePath);
  try {
    const audit = session.store.appendAudit(actor, "friction.capture.none", "story", base.story.id, "accepted", {
      captureKey,
      commentId: comment.commentId,
      commentAuditEventId: comment.commentAuditEventId,
      workflowBasis,
      route,
      relatedDf03Route: df03Route,
      category: routingRoundCategory,
      implementationStartRoutingRoundCount,
      frictionOutcome: "none",
      participantsFanoutStillNeeded: true,
      p0P1ClassificationPerformed: false,
      frictionFixImplemented: false,
      universalNoFrictionClaimed: false,
      rawPathRecorded: false
    });
    return {
      ok: audit.action === "friction.capture.none" && audit.targetId === base.story.id,
      auditEventId: audit.id,
      reusedExistingAudit: false
    };
  } finally {
    session.close();
  }
}

function findFrictionNoneComment(databasePath, storyId) {
  const session = openStore(databasePath);
  try {
    const story = session.store.listStories().find((item) => item.id === storyId);
    const comment = story?.comments.find((item) => sha256(item.body) === sha256(frictionNoneBody));
    if (!comment) return null;
    const commentAudit = session.store.queryAudit({ targetId: storyId, action: "comment.create" })
      .find((event) => event.details.commentId === comment.id);
    return {
      commentId: comment.id,
      commentAuditEventId: commentAudit?.id ?? null
    };
  } finally {
    session.close();
  }
}

function findFrictionNoneAudit(databasePath, storyId, commentId) {
  const session = openStore(databasePath);
  try {
    const audit = session.store.queryAudit({ targetId: storyId, action: "friction.capture.none" })
      .find((event) => event.details.commentId === commentId && event.details.captureKey === captureKey);
    return audit ? { auditEventId: audit.id } : null;
  } finally {
    session.close();
  }
}

function captureRecordCounts(databasePath, storyId, commentId) {
  const session = openStore(databasePath);
  try {
    const story = session.store.listStories().find((item) => item.id === storyId);
    return {
      commentCount: story?.comments.filter((item) => sha256(item.body) === sha256(frictionNoneBody)).length ?? 0,
      frictionAuditCount: session.store.queryAudit({ targetId: storyId, action: "friction.capture.none" })
        .filter((event) => event.details.commentId === commentId && event.details.captureKey === captureKey).length
    };
  } finally {
    session.close();
  }
}

function readRestartReadback(databasePath, storyId, commentId, auditEventId) {
  const session = openStore(databasePath);
  try {
    const story = session.store.listStories().find((item) => item.id === storyId);
    const comment = story?.comments.find((item) => item.id === commentId);
    const audit = session.store.queryAudit({ targetId: storyId, action: "friction.capture.none" })
      .find((event) => event.id === auditEventId);
    return {
      ok: Boolean(story && comment && audit),
      commentPresent: Boolean(comment),
      auditPresent: Boolean(audit),
      frictionAuditDetails: audit?.details ?? {}
    };
  } finally {
    session.close();
  }
}

function createWorkReadbackVisibility(databasePath, storyId, auditEventId) {
  const session = openStore(databasePath);
  try {
    const ticketResponse = createWorkReadbackApiResponse(
      session.store,
      "/api/work/readback/tickets",
      new URLSearchParams({ storyId, limit: "1" })
    );
    const auditResponse = createWorkReadbackApiResponse(
      session.store,
      "/api/work/readback/audit",
      new URLSearchParams({ targetId: storyId, limit: "5" })
    );
    const ticketBody = ticketResponse.body;
    const auditBody = auditResponse.body;
    const auditItems = Array.isArray(auditBody.items) ? auditBody.items : [];
    const statusItem = auditItems.find((item) => item.id === auditEventId);
    return {
      ok: ticketResponse.statusCode === 200 &&
        auditResponse.statusCode === 200 &&
        ticketBody.rows?.[0]?.storyId === storyId &&
        Boolean(statusItem),
      ticketEndpoint: {
        statusCode: ticketResponse.statusCode,
        method: ticketBody.method,
        schemaVersion: ticketBody.schemaVersion,
        rowGrain: ticketBody.rowGrain,
        returnedCount: ticketBody.page?.returnedCount,
        storyIds: ticketBody.rows?.map((row) => row.storyId) ?? [],
        latestAuditActionVisible: ticketBody.rows?.[0]?.latestAudit?.action ?? null,
        rawRowsStoredInReceipt: false
      },
      auditEndpoint: {
        statusCode: auditResponse.statusCode,
        method: auditBody.method,
        returnedCount: auditBody.returnedCount,
        targetScoped: true,
        frictionAuditEventIdVisible: Boolean(statusItem),
        frictionAuditAction: statusItem?.action ?? null,
        detailsRedacted: Boolean(statusItem?.details),
        rawAuditDetailsStoredInReceipt: false
      },
      workReadbackRoute: "/work/readback",
      backingApiRoutes: ["/api/work/readback/tickets", "/api/work/readback/audit"]
    };
  } finally {
    session.close();
  }
}

function proveNegativeAuthority(root, databasePath) {
  const runtime = createRuntimeTransport(runtimeConfig(root, databasePath));
  try {
    const cases = [
      ["aos.work_index.drill_through.read", "transport_method_outside_mvp_allowlist"],
      ["aos.gate.status.update", "transport_method_unknown"],
      ["aos.resource.record.propose", "transport_method_outside_mvp_allowlist"],
      ["aos.documentation.index.read", "transport_method_outside_mvp_allowlist"],
      ["aos.gateway.dump", "transport_method_unknown"]
    ];
    const negativeMethods = cases.map(([method, expectedReason]) => {
      const response = send(runtime.transport, method, {});
      const reason = responseReason(response);
      return { method, expectedReason, reason, rejected: reason === expectedReason };
    });
    return { ok: negativeMethods.every((item) => item.rejected), negativeMethods };
  } finally {
    runtime.close();
  }
}

function buildParticipantsStillNeeded(storyId) {
  const requiredFields = [
    "sourceThreadId",
    "routeOrSessionId",
    "frictionOutcome: actual|none",
    "reasonOrCategory",
    "implementationStartRoutingRoundCount when applicable",
    "commentId",
    "auditEventId",
    "capturedTicketIds if actual friction exists",
    "noP0P1ClassificationClaim",
    "noReadinessReleaseAcceptanceClaim"
  ];
  const prompt = `Record DF-04 live-thread friction capture for your own DF-01..DF-03 participation only. Use AOS ticket/comment/audit if available; return frictionOutcome actual or none, reason/category, implementationStartRoutingRoundCount when applicable, commentId, auditEventId, capturedTicketIds if any, and no P0/P1/readiness/release/acceptance claims. Target coordination story ${storyId}.`;
  return [
    {
      threadName: "Arturo, Thread Orchestrator",
      threadId: "019eb66e-00d1-7190-81d9-693895b32033",
      reason: "coordinator observed implementation-start routing path and can capture routing friction for DF-01..DF-03/DF-04 handoff sequencing",
      requiredFields,
      suggestedPrompt: prompt
    },
    {
      threadName: "Minerva, Workflow Architect",
      threadId: "019eb6d6-e2ed-71c2-a344-19ecce8f2990",
      reason: "participated in DF-01 hook divergence repair/status and DF-02/DF-03 status sequencing context",
      requiredFields,
      suggestedPrompt: prompt
    },
    {
      threadName: "Verity, Verification Engineer",
      threadId: "019f3a8d-5cd2-7922-b8e0-2e970f41c70e",
      reason: "participated in DF-01 verification and DF-03 proof/status acceptance chain",
      requiredFields,
      suggestedPrompt: prompt
    },
    {
      threadName: "Mara, Product Manager",
      threadId: "019f182a-910c-7822-b416-92c0cc773677",
      reason: "participated in DF-02 and DF-03 PM/status acceptance and later owns P0/P1 classification if real captured ticket ids exist",
      requiredFields,
      suggestedPrompt: prompt
    },
    {
      threadName: "Ariadne, Thread Registrar",
      threadId: "019eb677-9a03-7b60-8cb9-35cc7d5f48cb",
      reason: "participated in DF-02 registry/default-profile impact path feeding the accepted status basis",
      requiredFields,
      suggestedPrompt: prompt
    },
    {
      threadName: "Ilya, Full-Stack Implementer",
      threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
      reason: "current DF-04 route self-session is captured here; any retrospective DF-01/DF-03 session-specific friction should be routed explicitly instead of proxy-recorded",
      currentRouteCaptured: true,
      requiredFields,
      suggestedPrompt: prompt
    }
  ];
}

function seedAuthorityRows(databasePath) {
  const repository = new AosSqliteRepository({ databasePath, migrationsDir });
  try {
    repository.applyMigrations();
    const sourceDigest = sha256(JSON.stringify({
      workflowBasis,
      route,
      employeeCount: createDefaultSeed().employees.length
    }));
    repository.seedAiEmployees(createDefaultSeed().employees, sourceDigest);
  } finally {
    repository.close();
  }
}

function openStore(databasePath) {
  const repository = new AosSqliteRepository({ databasePath, migrationsDir });
  repository.applyMigrations();
  const store = new AosStore(undefined, { persistence: repository });
  return {
    repository,
    store,
    close() {
      repository.close();
    }
  };
}

function selectP1DurableRoot() {
  const explicit = process.env.TCRN_AOS_P1_DURABLE_RUNTIME_PROFILE_ROOT;
  const root = resolve(explicit || join(homedir(), "Library", "Application Support", "TCRN-AOS", "conditional-dogfood-start-p1-runtime-profile"));
  return {
    root,
    readback: {
      profileRootClass: explicit ? "explicit_owner_marker_durable_local_profile_root" : "owner_marker_durable_local_profile_root",
      explicitRootProvided: Boolean(explicit),
      selectedRootDigest: sha256(resolve(root)),
      rawPathRecorded: false,
      cleanStartDisposition: ownerDecisionFields.p1_data_disposition
    }
  };
}

function validateP1DurableRoot(root, databasePath) {
  denyUnsafeRuntimePath(root);
  assertExistingSegmentsHaveNoSymlink(root, "df04_p1_runtime_profile_root_symlink_ancestor_denied");
  if (!existsSync(root)) throw new Error("df04_p1_durable_profile_root_missing");
  if (lstatSync(root).isSymbolicLink()) throw new Error("df04_p1_durable_profile_root_symlink_denied");
  if (!existsSync(join(root, markerFile))) throw new Error("df04_p1_route_owned_marker_missing");
  if (!existsSync(join(root, ownerMarkerFile))) throw new Error("df04_p1_owner_marker_missing");
  assertRouteOwnedSqliteRoot(root, repoRoot, markerFile);
  const marker = markerReadback(root);
  if (!marker.ok) throw new Error("df04_p1_marker_mismatch");
  if (dirname(databasePath) !== root) throw new Error("df04_database_not_direct_child");
  if (existsSync(databasePath) && lstatSync(databasePath).isSymbolicLink()) {
    throw new Error("df04_database_symlink_denied");
  }
}

function markerReadback(root) {
  const routeMarker = JSON.parse(readFileSync(join(root, markerFile), "utf8"));
  const ownerMarker = JSON.parse(readFileSync(join(root, ownerMarkerFile), "utf8"));
  const expectedRouteMarker = {
    route: p1Route,
    markerVersion,
    rootDigest: sha256(resolve(root)),
    purpose: markerPurpose
  };
  const ok = routeMarker.route === expectedRouteMarker.route &&
    routeMarker.markerVersion === expectedRouteMarker.markerVersion &&
    routeMarker.rootDigest === expectedRouteMarker.rootDigest &&
    routeMarker.purpose === expectedRouteMarker.purpose &&
    ownerMarker.profileId === "conditional-dogfood-start-p1-clean-start-runtime-profile-v1" &&
    ownerMarker.routeId === p1Route &&
    ownerMarker.runContext === "conditional-dogfood-start-p1-clean-start-v1";
  return {
    ok,
    routeOwnedMarkerFile: markerFile,
    routeOwnedMarkerDigest: sha256(JSON.stringify(routeMarker)),
    ownerMarkerFile,
    ownerMarkerDigest: sha256(JSON.stringify(ownerMarker)),
    routeMatches: routeMarker.route === p1Route,
    markerVersionMatches: routeMarker.markerVersion === markerVersion,
    purposeMatches: routeMarker.purpose === markerPurpose,
    rootDigestMatches: routeMarker.rootDigest === expectedRouteMarker.rootDigest,
    ownerMarkerProfileMatches: ownerMarker.profileId === "conditional-dogfood-start-p1-clean-start-runtime-profile-v1",
    ownerMarkerRouteMatches: ownerMarker.routeId === p1Route,
    rawPathRecorded: false
  };
}

function runtimeConfig(root, databasePath) {
  return {
    actor,
    databasePath,
    databaseRoot: root,
    repoRoot,
    routeOwnedMarkerFile: markerFile,
    runtimeProfileMarker: {
      route: p1Route,
      markerVersion,
      purpose: markerPurpose
    },
    migrationsDir,
    auditPageLimit: 5,
    maxResponseBytes: 16_384
  };
}

function validateReceiptsAndArtifacts(databasePath) {
  const noCommittedDbArtifacts = noCommittedRuntimeDbArtifacts();
  const databaseDirectChild = dirname(databasePath) === selectedRoot.root;
  return {
    ok: noCommittedDbArtifacts && databaseDirectChild,
    noCommittedDbArtifacts,
    databaseDirectChild,
    workflowMutationPerformed: false,
    designSystemMutationPerformed: false,
    tmsMutationPerformed: false,
    activeCodexMutationPerformed: false,
    maintainedHookSourceMutationPerformed: false,
    rawPathRecorded: false
  };
}

function noCommittedRuntimeDbArtifacts() {
  const result = spawnSync("git", ["ls-files"], { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) return false;
  return !result.stdout.split("\n").some((file) => /\.(sqlite|sqlite3|db|db-shm|db-wal)$/.test(file) && !file.includes(".codegraph/"));
}

function privacyScan(proof) {
  const text = JSON.stringify(proof);
  const findings = [
    ["/Users/", "local_users_path"],
    ["/tmp/", "tmp_path"],
    ["/private/tmp/", "private_tmp_path"],
    ["record_json", "raw_db_row"],
    ["CREATE TABLE", "db_dump"],
    ["BEGIN " + "PRIVATE KEY", "secret_like"],
    ["owner acceptance", "acceptance_overclaim"],
    ["product acceptance", "acceptance_overclaim"],
    ["final MVP acceptance", "acceptance_overclaim"],
    ["dogfood runtime readiness", "readiness_overclaim"],
    ["release readiness", "release_overclaim"],
    ["phase 3 acceptance", "phase3_acceptance_overclaim"],
    ["phase 4 closeout", "phase4_closeout_overclaim"],
    ["universal no-friction", "universal_no_friction_overclaim"]
  ].filter(([needle]) => text.toLowerCase().includes(String(needle).toLowerCase()))
    .map(([, kind]) => ({ kind }));
  return {
    ok: findings.length === 0 &&
      proof.privacyNoArtifactNoOverclaimReadback.rawPathRecorded === false &&
      proof.localProfileRootPrivacyReadback.rawPathRecorded === false &&
      proof.capturedFrictionTickets_or_none.universalNoFrictionClaimed === false,
    findings,
    scannedSurface: "df04_live_friction_capture_receipt_payload",
    rawPathRecorded: false,
    rawDbDumpRecorded: false,
    rawClientEnvStored: false,
    privateOwnerPayloadStored: false,
    secretsOrPiiStored: false,
    broadCodexSecurityPluginScanClaimed: false,
    noOverclaimFlags
  };
}

function sourceProvenance() {
  const sourceHead = git(["rev-parse", "HEAD"]);
  const files = sourceFiles.map((file) => ({
    file,
    digest: sha256(readFileSync(join(repoRoot, file)))
  }));
  return {
    sourceHead,
    workflowBasis,
    incomingAosBasis,
    files,
    sourceContentDigest: sha256(JSON.stringify(files)),
    sourceGitStatusDigestOnly: sha256(git(["status", "--short", "--branch"])),
    sourceGitStatusStoredRaw: false
  };
}

function writeReceipt(name, body) {
  const receipt = {
    receiptName: name,
    ok: body.ok === true,
    route,
    command,
    generatedAt: new Date().toISOString(),
    sourceHead: body.source.sourceHead,
    sourceContentDigest: body.source.sourceContentDigest,
    sourceFiles: body.source.files,
    workflowBasis,
    aosBasis: body.source.sourceHead,
    incomingAosBasis,
    failures: body.failures ?? [],
    negativeFailures: body.negativeFailures ?? [],
    noOverclaimFlags,
    ...body
  };
  delete receipt.source;
  writeFileSync(join(evidenceRoot, name), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  return receipt;
}

function send(transport, method, params) {
  return transport.handleJsonRpc({ jsonrpc: "2.0", id: method, method, params });
}

function responsePayload(response) {
  assert.equal(response.error, undefined, JSON.stringify(response));
  return response.result;
}

function responseReason(response) {
  return response.error?.data?.reason ?? response.result?.error ?? null;
}

function digestDatabaseFile(databasePath) {
  return existsSync(databasePath) ? sha256(readFileSync(databasePath)) : null;
}

function denyUnsafeRuntimePath(path) {
  const normalized = resolve(path).split(sep).join("/");
  if (normalized.startsWith("/srv/") || normalized === "/srv") throw new Error("df04_runtime_srv_path_denied");
  if (/retained|owner-trial|preview/i.test(normalized)) throw new Error("df04_runtime_retained_or_owner_visible_path_denied");
}

function assertExistingSegmentsHaveNoSymlink(path, reason) {
  const absolute = resolve(path);
  let current = resolve(sep);
  for (const part of absolute.split(sep).filter(Boolean)) {
    current = join(current, part);
    if (!existsSync(current)) return;
    if (lstatSync(current).isSymbolicLink()) throw new Error(reason);
  }
}

function git(args) {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}
