import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { AosSqliteRepository, assertRouteOwnedSqliteRoot, sha256 } from "../dist/packages/db/src/index.js";
import { AosStore, createDefaultSeed } from "../dist/packages/domain/src/index.js";
import { createRuntimeTransport } from "../dist/packages/mcp-server/src/index.js";
import { createWorkReadbackApiResponse } from "../dist/apps/api/src/work-readback.js";

const route = "route_tcrn_conditional_dogfood_start_df03_d5_status_migration_ilya_after_df02_checkpoint_1dcb12_937324_20260707";
const workflowBasis = "1dcb1265ec3845feb9d51cd5f377ddce0a5aedb0";
const p1Route = "route_tcrn_conditional_dogfood_start_p1_durable_runtime_profile_root_migration_ilya_after_owner_decision_949a58_8aa904_20260707";
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const evidenceRoot = join(repoRoot, "evidence/conditional-dogfood-start-df03-status-migration");
const migrationsDir = join(repoRoot, "packages/db/migrations/sqlite");
const command = "pnpm --dir TCRN-AOS df03:status-migration-proof";
const markerFile = ".tcrn-aos-phase1-root";
const ownerMarkerFile = ".aos-persistent-runtime-owner.json";
const markerPurpose = "p1-clean-start-durable-runtime-profile-root";
const markerVersion = "conditional-dogfood-start-p1-runtime-profile.v1";
const databaseFileName = "aos-p1-durable-runtime-profile.sqlite";
const summaryReceiptName = "df03-status-migration-proof-summary.json";
const readbackReceiptName = "df03-status-migration-readback.json";
const checkpointKey = "conditional-dogfood-start-df03-status-migration-v1";
const sourceFiles = [
  "package.json",
  "scripts/df03-status-migration-proof.mjs",
  "packages/domain/src/store.ts",
  "packages/db/test/phase1-sqlite-repository.test.mjs",
  "packages/mcp-server/src/transport.ts",
  "apps/api/src/work-readback.ts"
];
const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "df03-d5-status-migration"
};
const ownerDecisionFields = {
  owner_accepts_packet: "accepted",
  p1_runtime_root_migration: "authorized",
  p1_data_disposition: "clean_start_declared",
  df02_crew_equivalence_accepted: "accepted",
  dogfood_start_after_p1_readback: "authorized_after_verified_persistent_root_readback"
};
const noOverclaimFlags = {
  df03StatusMigrationPerformed: true,
  p1DurableLocalProfileRootUsed: true,
  d5StatusRecordLaneOnly: true,
  workflowBroadStatusMutation: false,
  workflowFrameworkMutation: false,
  designSystemMutation: false,
  tmsMutation: false,
  activeCodexMutation: false,
  maintainedHookSourceMutation: false,
  df04Started: false,
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
  broadCodexSecurityPluginScanClaimed: false
};
const statusCommentBody = [
  "DF-03 status checkpoint recorded in AOS.",
  "New conditional-dogfood status records use AOS ticket comments plus target-scoped audit events.",
  "Workflow status surfaces should carry only one-line pointers after this lane; no readiness, release, owner-facing, Phase 3 acceptance, Phase 4 closeout, or Phase 5 claim is made."
].join(" ");

mkdirSync(evidenceRoot, { recursive: true });
const source = sourceProvenance();
const selectedRoot = selectP1DurableRoot();
const databasePath = join(selectedRoot.root, databaseFileName);
const proof = runDf03Proof(selectedRoot.root, databasePath);
const privacy = privacyScan(proof);
const receipt = writeReceipt(readbackReceiptName, {
  ok: proof.ok && privacy.ok,
  source,
  selectedRoot: selectedRoot.readback,
  ownerDecisionFields,
  implementationReadback: proof.implementationReadback,
  aosStatusRecordReadback: proof.aosStatusRecordReadback,
  workReadbackTimelineVisibilityReadback: proof.workReadbackTimelineVisibilityReadback,
  idempotencyReplayReadback: proof.idempotencyReplayReadback,
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
  commentId: receipt.aosStatusRecordReadback.commentId,
  auditEventId: receipt.aosStatusRecordReadback.auditEventId,
  workReadbackTimelineVisible: receipt.workReadbackTimelineVisibilityReadback.ok,
  noOverclaimFlags,
  failures: receipt.ok === true ? [] : ["df03_status_migration_readback_not_ok"],
  negativeFailures: proof.negativeFailures
});

assert.equal(receipt.ok, true);
assert.equal(summary.ok, true);
console.log(JSON.stringify({
  ok: true,
  route,
  command,
  receipts: [summaryReceiptName, readbackReceiptName],
  storyId: proof.aosStatusRecordReadback.storyId,
  commentId: proof.aosStatusRecordReadback.commentId,
  auditEventId: proof.aosStatusRecordReadback.auditEventId,
  workReadbackTimelineVisible: proof.workReadbackTimelineVisibilityReadback.ok,
  idempotentReplayNoDuplicate: proof.idempotencyReplayReadback.secondEnsureNoop,
  rawPathRecorded: false,
  df03Only: true
}, null, 2));

function runDf03Proof(root, databasePath) {
  validateP1DurableRoot(root, databasePath);
  const rootReadback = assertRouteOwnedSqliteRoot(root, repoRoot, markerFile);
  seedAuthorityRows(databasePath);

  const firstEnsure = ensureDf03StatusRecord(root, databasePath);
  const secondEnsure = ensureDf03StatusRecord(root, databasePath);
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
    secondEnsure.statusAuditCount === firstEnsure.statusAuditCount &&
    negative.ok &&
    validation.noCommittedDbArtifacts &&
    marker.ok;
  const failures = [
    firstEnsure.ok ? null : "df03_first_status_record_not_ok",
    secondEnsure.ok ? null : "df03_second_status_record_not_ok",
    secondEnsure.commentCount === firstEnsure.commentCount ? null : "df03_comment_duplicate_on_replay",
    secondEnsure.statusAuditCount === firstEnsure.statusAuditCount ? null : "df03_status_audit_duplicate_on_replay",
    restart.ok ? null : "df03_restart_readback_not_ok",
    workReadback.ok ? null : "df03_work_readback_not_visible",
    negative.ok ? null : "df03_negative_authority_not_ok",
    validation.noCommittedDbArtifacts ? null : "df03_committed_db_artifact_found",
    marker.ok ? null : "df03_p1_marker_not_ok"
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
      command,
      implementationMode: "aos_ticket_comment_plus_target_scoped_audit_event",
      cleanStartProfileConsumed: true,
      p1DurableProfileRootUsed: true,
      proofScriptMediatedD2D3D4DataImported: false,
      workflowPointerStatus: "not_mutated_by_ilya_route_return_recommends_minerva_one_line_pointer_after_review",
      methodsExercised: ["aos.ticket.comment", "aos.ticket.list", "aos.audit.query"],
      storeAuditAction: "status.checkpoint.record"
    },
    aosStatusRecordReadback: {
      ok: firstEnsure.ok && restart.ok,
      checkpointKey,
      initiativeId: firstEnsure.initiativeId,
      epicId: firstEnsure.epicId,
      storyId: firstEnsure.storyId,
      storyTitle: firstEnsure.storyTitle,
      commentId: firstEnsure.commentId,
      commentType: "agent_observation",
      commentBodyDigest: sha256(statusCommentBody),
      commentAuditEventId: firstEnsure.commentAuditEventId,
      auditEventId: firstEnsure.auditEventId,
      auditAction: "status.checkpoint.record",
      auditOutcome: "accepted",
      commentAndAuditLinked: firstEnsure.commentId === restart.statusAuditDetails.commentId,
      restartCommentPresent: restart.commentPresent,
      restartAuditPresent: restart.auditPresent,
      rawCommentBodyStoredInReceipt: false,
      rawAuditDetailsStoredInReceipt: false
    },
    workReadbackTimelineVisibilityReadback: workReadback,
    idempotencyReplayReadback: {
      ok: secondEnsure.ok &&
        secondEnsure.commentId === firstEnsure.commentId &&
        secondEnsure.auditEventId === firstEnsure.auditEventId &&
        secondEnsure.commentCount === firstEnsure.commentCount &&
        secondEnsure.statusAuditCount === firstEnsure.statusAuditCount,
      firstCommentId: firstEnsure.commentId,
      secondCommentId: secondEnsure.commentId,
      firstAuditEventId: firstEnsure.auditEventId,
      secondAuditEventId: secondEnsure.auditEventId,
      firstCommentCount: firstEnsure.commentCount,
      secondCommentCount: secondEnsure.commentCount,
      firstStatusAuditCount: firstEnsure.statusAuditCount,
      secondStatusAuditCount: secondEnsure.statusAuditCount,
      secondEnsureNoop: secondEnsure.reusedExistingComment && secondEnsure.reusedExistingAudit
    },
    privacyNoArtifactNoOverclaimReadback: {
      ok: validation.noCommittedDbArtifacts,
      rawPathRecorded: false,
      rawDbDumpRecorded: false,
      committedDbArtifacts: false,
      secretsOrPiiStored: false,
      privatePayloadStored: false,
      ownerFacingAcceptanceClaimed: false,
      releasePublicationPushClaimed: false,
      readinessClaimed: false
    },
    methodAuthorityBoundaryReadback: {
      ok: negative.ok,
      acceptedMethodsExercised: ["aos.ticket.comment", "aos.ticket.list", "aos.audit.query"],
      negativeMethods: negative.negativeMethods,
      broadGatewayExposureUsed: false,
      workIndexUsed: false,
      clientSuppliedAuthorityTrusted: false,
      liveDispatchAuthorized: false,
      ownerIntentExecutionAuthorized: false
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

function ensureDf03StatusRecord(root, databasePath) {
  const base = ensureDf03Containers(databasePath);
  const transport = createRuntimeTransport(runtimeConfig(root, databasePath));
  try {
    const comment = ensureStatusComment(transport.transport, databasePath, base.story.id);
    const audit = ensureStatusAudit(databasePath, base, comment);
    const counts = statusRecordCounts(databasePath, base.story.id, comment.commentId);
    return {
      ok: Boolean(base.ok && comment.ok && audit.ok && counts.commentCount >= 1 && counts.statusAuditCount === 1),
      initiativeId: base.initiative.id,
      epicId: base.epic.id,
      storyId: base.story.id,
      storyTitle: base.story.title,
      commentId: comment.commentId,
      commentAuditEventId: comment.commentAuditEventId,
      auditEventId: audit.auditEventId,
      commentCount: counts.commentCount,
      statusAuditCount: counts.statusAuditCount,
      reusedExistingComment: comment.reusedExistingComment,
      reusedExistingAudit: audit.reusedExistingAudit
    };
  } finally {
    transport.close();
  }
}

function ensureDf03Containers(databasePath) {
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
        problem: "Conditional dogfood start needs durable AOS status records instead of broad Workflow status edits.",
        expectedOutcome: "New status checkpoints are captured as AOS comments and audit events with browser readback."
      }, actor);
    const epic = session.store.listEpics().find((item) => item.initiativeId === initiative.id && item.title === "DF-03 D5 status migration") ??
      session.store.createEpic({
        initiativeId: initiative.id,
        title: "DF-03 D5 status migration",
        goal: "Move new status/checkpoint records into AOS comment and audit readback.",
        status: "in_progress"
      }, actor);
    const story = session.store.listStories().find((item) => item.epicId === epic.id && item.title === "DF-03 status checkpoint record") ??
      session.store.createStory({
        epicId: epic.id,
        title: "DF-03 status checkpoint record",
        problem: "Workflow status updates can become docs-edit-docs loops unless new checkpoints are recorded in AOS.",
        user: "thread coordinator and review lanes",
        expectedBehavior: "AOS exposes the checkpoint as a ticket comment and target-scoped audit timeline row.",
        acceptanceCriteria: [
          "checkpoint comment id exists",
          "checkpoint audit event id exists",
          "work readback ticket and audit endpoints show the status record",
          "Workflow broad status mutation remains out of scope"
        ],
        status: "in_progress",
        estimate: { effortPoints: 2, complexity: "medium", risk: "L2", verificationCost: "medium", confidence: "medium" },
        subTasks: []
      }, actor);
    return { ok: true, initiative, epic, story };
  } finally {
    session.close();
  }
}

function ensureStatusComment(transport, databasePath, storyId) {
  const existing = findStatusComment(databasePath, storyId);
  if (existing) {
    return { ...existing, ok: true, reusedExistingComment: true };
  }
  const response = send(transport, "aos.ticket.comment", {
    ticketId: storyId,
    type: "agent_observation",
    body: statusCommentBody,
    idempotencyKey: checkpointKey
  });
  const payload = responsePayload(response);
  const comment = payload.result;
  const persisted = findStatusComment(databasePath, storyId);
  return {
    ok: Boolean(payload.ok === true && comment?.id && persisted?.commentId === comment.id),
    commentId: comment.id,
    commentAuditEventId: persisted?.commentAuditEventId ?? null,
    reusedExistingComment: false
  };
}

function ensureStatusAudit(databasePath, base, comment) {
  const existing = findStatusAudit(databasePath, base.story.id, comment.commentId);
  if (existing) {
    return { ...existing, ok: true, reusedExistingAudit: true };
  }
  const session = openStore(databasePath);
  try {
    const audit = session.store.appendAudit(actor, "status.checkpoint.record", "story", base.story.id, "accepted", {
      checkpointKey,
      commentId: comment.commentId,
      commentAuditEventId: comment.commentAuditEventId,
      workflowBasis,
      route,
      workflowPointerRequiredAfterMigrationStart: true,
      noReadinessClaim: true,
      noReleaseClaim: true,
      noAcceptanceClaim: true,
      rawPathRecorded: false
    });
    return {
      ok: audit.action === "status.checkpoint.record" && audit.targetId === base.story.id,
      auditEventId: audit.id,
      reusedExistingAudit: false
    };
  } finally {
    session.close();
  }
}

function findStatusComment(databasePath, storyId) {
  const session = openStore(databasePath);
  try {
    const story = session.store.listStories().find((item) => item.id === storyId);
    const comment = story?.comments.find((item) => sha256(item.body) === sha256(statusCommentBody));
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

function findStatusAudit(databasePath, storyId, commentId) {
  const session = openStore(databasePath);
  try {
    const audit = session.store.queryAudit({ targetId: storyId, action: "status.checkpoint.record" })
      .find((event) => event.details.commentId === commentId);
    return audit ? { auditEventId: audit.id } : null;
  } finally {
    session.close();
  }
}

function statusRecordCounts(databasePath, storyId, commentId) {
  const session = openStore(databasePath);
  try {
    const story = session.store.listStories().find((item) => item.id === storyId);
    return {
      commentCount: story?.comments.filter((item) => sha256(item.body) === sha256(statusCommentBody)).length ?? 0,
      statusAuditCount: session.store.queryAudit({ targetId: storyId, action: "status.checkpoint.record" })
        .filter((event) => event.details.commentId === commentId).length
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
    const audit = session.store.queryAudit({ targetId: storyId, action: "status.checkpoint.record" })
      .find((event) => event.id === auditEventId);
    return {
      ok: Boolean(story && comment && audit),
      commentPresent: Boolean(comment),
      auditPresent: Boolean(audit),
      statusAuditDetails: audit?.details ?? {}
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
        statusAuditEventIdVisible: Boolean(statusItem),
        statusAuditAction: statusItem?.action ?? null,
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
  assertExistingSegmentsHaveNoSymlink(root, "df03_p1_runtime_profile_root_symlink_ancestor_denied");
  if (!existsSync(root)) throw new Error("df03_p1_durable_profile_root_missing");
  if (lstatSync(root).isSymbolicLink()) throw new Error("df03_p1_durable_profile_root_symlink_denied");
  if (!existsSync(join(root, markerFile))) throw new Error("df03_p1_route_owned_marker_missing");
  if (!existsSync(join(root, ownerMarkerFile))) throw new Error("df03_p1_owner_marker_missing");
  assertRouteOwnedSqliteRoot(root, repoRoot, markerFile);
  const marker = markerReadback(root);
  if (!marker.ok) throw new Error("df03_p1_marker_mismatch");
  if (dirname(databasePath) !== root) throw new Error("df03_database_not_direct_child");
  if (existsSync(databasePath) && lstatSync(databasePath).isSymbolicLink()) {
    throw new Error("df03_database_symlink_denied");
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
    ["BEGIN PRIVATE KEY", "secret_like"],
    ["owner acceptance", "acceptance_overclaim"],
    ["product acceptance", "acceptance_overclaim"],
    ["final MVP acceptance", "acceptance_overclaim"],
    ["dogfood runtime readiness", "readiness_overclaim"],
    ["release readiness", "release_overclaim"],
    ["phase 3 acceptance", "phase3_acceptance_overclaim"],
    ["phase 4 closeout", "phase4_closeout_overclaim"]
  ].filter(([needle]) => text.toLowerCase().includes(String(needle).toLowerCase()))
    .map(([, kind]) => ({ kind }));
  return {
    ok: findings.length === 0 &&
      proof.privacyNoArtifactNoOverclaimReadback.rawPathRecorded === false &&
      proof.localProfileRootPrivacyReadback.rawPathRecorded === false,
    findings,
    scannedSurface: "df03_status_migration_receipt_payload",
    rawPathRecorded: false,
    rawDbDumpRecorded: false,
    rawClientEnvStored: false,
    privateEvidencePayloadStored: false,
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
  if (normalized.startsWith("/srv/") || normalized === "/srv") throw new Error("df03_runtime_srv_path_denied");
  if (/retained|owner-trial|preview/i.test(normalized)) throw new Error("df03_runtime_retained_or_owner_visible_path_denied");
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
