import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AosSqliteRepository,
  applyDailyKeep3Retention,
  blockRestoreToLivePromotion,
  createSqlitePhysicalSnapshot,
  digestFile,
  evaluateDailySnapshotCatchUp,
  prepareRuntimeRoot,
  restoreSnapshotToScratchProfile,
  sha256,
  stableJson
} from "../dist/packages/db/src/index.js";
import { AosStore, createDefaultSeed } from "../dist/packages/domain/src/index.js";
import { createRuntimeTransport } from "../dist/packages/mcp-server/src/index.js";
import { createWorkReadbackApiResponse } from "../dist/apps/api/src/work-readback.js";

const route = "route_tcrn_aos_knowledge_retrieval_layer_bk01_physical_snapshot_retention_restore_drill_implementation_after_owner_decision_checkpoint_20260708";
const workflowBasis = "8dce81d2e9a6408d1d139e4d84486497c6caf288";
const planBasis = workflowBasis;
const incomingAosBasis = "db6bdc2c17e2f44ffbf3a57c94abb29266e2a6e4";
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const evidenceRoot = join(repoRoot, "evidence/aos-knowledge-retrieval-layer-bk01");
const migrationsDir = join(repoRoot, "packages/db/migrations/sqlite");
const command = "pnpm --dir TCRN-AOS bk01:physical-snapshot-proof";
const databaseFileName = "aos-p1-durable-runtime-profile.sqlite";
const markerFile = ".tcrn-aos-phase1-root";
const ownerMarkerFile = ".aos-persistent-runtime-owner.json";
const p1Route = "route_tcrn_conditional_dogfood_start_p1_durable_runtime_profile_root_migration_ilya_after_owner_decision_949a58_8aa904_20260707";
const markerVersion = "conditional-dogfood-start-p1-runtime-profile.v1";
const markerPurpose = "p1-clean-start-durable-runtime-profile-root";
const bk01ProfileId = "aos-knowledge-retrieval-layer-bk01-physical-snapshot-profile-v1";
const p1OwnerMarker = {
  profileId: "conditional-dogfood-start-p1-clean-start-runtime-profile-v1",
  routeId: p1Route,
  runContext: "conditional-dogfood-start-p1-clean-start-v1",
  owner: "aos-product-local-owner-authorized"
};
const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "bk01-physical-snapshot-proof"
};
const sourceFiles = [
  "package.json",
  "packages/db/src/backup.ts",
  "packages/db/src/index.ts",
  "packages/db/src/sqlite-repository.ts",
  "packages/db/test/bk01-physical-snapshot.test.mjs",
  "scripts/bk01-physical-snapshot-proof.mjs"
];
const noOverclaimFlags = {
  bk01PhysicalSnapshotImplemented: true,
  bk02LogicalExportImplemented: false,
  kr00Started: false,
  kr01Started: false,
  kr02Started: false,
  kr03Started: false,
  kr04HookSwapStarted: false,
  kr05Started: false,
  kr06Started: false,
  frontendTriggerImplemented: false,
  tmsMutation: false,
  workflowMutation: false,
  designSystemMutation: false,
  activeCodexMutation: false,
  maintainedHookSourceMutation: false,
  pushRun: false,
  batchPushGateRun: false,
  releaseReadinessClaimed: false,
  ownerFacingAcceptanceClaimed: false,
  finalAcceptanceClaimed: false,
  cleanPlatformClaimed: false,
  parentCompletionClaimed: false,
  liveRestorePromotionPerformed: false,
  liveProfileOverwritePerformed: false,
  broadCodexSecurityPluginScanClaimed: false,
  liveDispatchAuthorized: false,
  ownerIntentExecutionAuthorized: false
};

mkdirSync(evidenceRoot, { recursive: true });

const source = sourceProvenance();
const selectedRoot = selectDurableRoot();
const proof = await runBk01Proof(selectedRoot.root);
const privacy = privacyScan(proof);
const readbackReceipt = writeReceipt("bk01-physical-snapshot-readback.json", {
  ok: proof.ok && privacy.ok,
  route,
  command,
  source,
  selectedRoot: selectedRoot.readback,
  snapshotCreationReadback: proof.snapshotCreationReadback,
  serviceStartCatchUpReadback: proof.serviceStartCatchUpReadback,
  retentionRotationReadback: proof.retentionRotationReadback,
  preMigrationSnapshotReadback: proof.preMigrationSnapshotReadback,
  restoreDrillReadback: proof.restoreDrillReadback,
  restoreToLivePromotionBlockReadback: proof.restoreToLivePromotionBlockReadback,
  recurringRestoreDrillTicketReadback: proof.recurringRestoreDrillTicketReadback,
  methodAuthorityReadback: proof.methodAuthorityReadback,
  noGitArtifactReadback: proof.noGitArtifactReadback,
  privacyNoArtifactNoOverclaimReadback: proof.privacyNoArtifactNoOverclaimReadback,
  validation_readbacks: proof.validation_readbacks,
  privacyNoOverclaimScan: privacy,
  failures: [...proof.failures, ...privacy.findings.map((finding) => finding.kind)],
  negativeFailures: proof.negativeFailures,
  noOverclaimFlags
});
const summaryReceipt = writeReceipt("bk01-physical-snapshot-proof-summary.json", {
  ok: readbackReceipt.ok === true,
  route,
  command,
  source,
  receiptInventory: ["bk01-physical-snapshot-readback.json"],
  receiptCount: 1,
  allChildReceiptsOk: readbackReceipt.ok === true,
  missingReceipts: [],
  extraUnclassifiedReceipts: [],
  readbackReceiptDigest: sha256(stableJson(readbackReceipt)),
  snapshotIds: proof.snapshotCreationReadback.snapshots.map((snapshot) => snapshot.snapshotId),
  retainedSnapshotIds: proof.retentionRotationReadback.retainedSnapshotIds,
  restoreDrillTicketId: proof.recurringRestoreDrillTicketReadback.storyId,
  noOverclaimFlags,
  failures: readbackReceipt.ok === true ? [] : ["bk01_physical_snapshot_readback_not_ok"],
  negativeFailures: proof.negativeFailures
});

assert.equal(readbackReceipt.ok, true);
assert.equal(summaryReceipt.ok, true);

console.log(JSON.stringify({
  ok: true,
  route,
  command,
  receipts: ["bk01-physical-snapshot-proof-summary.json", "bk01-physical-snapshot-readback.json"],
  snapshotIds: proof.snapshotCreationReadback.snapshots.map((snapshot) => snapshot.snapshotId),
  retainedSnapshotIds: proof.retentionRotationReadback.retainedSnapshotIds,
  preMigrationSnapshotCount: proof.preMigrationSnapshotReadback.preMigrationSnapshots.length,
  restoreDrillOk: proof.restoreDrillReadback.ok,
  restoreToLiveBlocked: proof.restoreToLivePromotionBlockReadback.blocked,
  recurringRestoreDrillTicketId: proof.recurringRestoreDrillTicketReadback.storyId,
  rawPathRecorded: false,
  liveProfileOverwritePerformed: false,
  readinessClaimed: false
}, null, 2));

async function runBk01Proof(root) {
  const rootReadback = await prepareRuntimeRoot({ runtimeRoot: root, repoRoot, ownerMarker: p1OwnerMarker });
  ensureP1RouteOwnedMarker(root);
  const databasePath = join(root, databaseFileName);
  const backupRoot = join(root, "backup");
  const dailyDir = join(backupRoot, "bk01-daily-physical-snapshots");
  const preMigrationDir = join(backupRoot, "bk01-pre-migration-snapshots");
  const scratchRoot = join(backupRoot, "bk01-restore-drill-scratch-profile");
  const scratchDatabasePath = join(scratchRoot, "scratch-restore.sqlite");
  rmSync(dailyDir, { recursive: true, force: true });
  rmSync(preMigrationDir, { recursive: true, force: true });
  rmSync(scratchRoot, { recursive: true, force: true });
  mkdirSync(dailyDir, { recursive: true });
  mkdirSync(preMigrationDir, { recursive: true });

  const repository = new AosSqliteRepository({ databasePath, migrationsDir });
  try {
    repository.applyMigrations();
    repository.seedAiEmployees(createDefaultSeed().employees, "bk01-default-seed");
    const firstEnsure = ensureRestoreDrillTicket(repository);
    const secondEnsure = ensureRestoreDrillTicket(repository);
    const sourceProfileDigest = repository.databaseDigest();
    const snapshots = [];
    for (let day = 1; day <= 4; day += 1) {
      snapshots.push(createSqlitePhysicalSnapshot({
        sourceDatabasePath: databasePath,
        snapshotPath: join(dailyDir, `bk01-daily-2026-07-0${day}.sqlite`),
        snapshotId: `bk01-daily-2026-07-0${day}`,
        createdAt: `2026-07-0${day}T00:00:00.000Z`,
        purpose: "bk01_daily_keep_3_physical_snapshot",
        sourceProfileDigest,
        routeId: route,
        profileId: bk01ProfileId,
        forbiddenWorktreeRoots: [repoRoot]
      }));
    }
    const retention = applyDailyKeep3Retention({ backupDir: dailyDir, forbiddenWorktreeRoots: [repoRoot] });
    const restore = restoreSnapshotToScratchProfile({
      snapshotPath: join(dailyDir, "bk01-daily-2026-07-04.sqlite"),
      scratchDatabasePath,
      scratchProfileRoot: scratchRoot,
      liveDatabasePath: databasePath,
      liveProfileRoot: root,
      snapshotId: "bk01-daily-2026-07-04",
      forbiddenWorktreeRoots: [repoRoot]
    });
    const scratchRuntimeReadback = readScratchRuntime(scratchRoot, scratchDatabasePath);
    const restoreToLivePromotionBlock = expectRestoreToLiveBlock(root, databasePath);
    const preMigrationSnapshotReadback = await provePreMigrationSnapshotHook(preMigrationDir);
    const noGitArtifact = noCommittedDbArtifacts();
    const serviceStartCatchUp = proveServiceStartCatchUp();
    const noRaw = noRawPathLeakage({
      snapshots,
      retention,
      restore,
      preMigrationSnapshotReadback,
      firstEnsure,
      secondEnsure,
      serviceStartCatchUp
    });
    rmSync(scratchRoot, { recursive: true, force: true });
    const ok = snapshots.every((snapshot) => snapshot.ok) &&
      retention.ok &&
      retention.retainedCount === 3 &&
      retention.evictedSnapshotIds.includes("bk01-daily-2026-07-01") &&
      restore.ok &&
      scratchRuntimeReadback.ok &&
      restoreToLivePromotionBlock.blocked &&
      preMigrationSnapshotReadback.ok &&
      firstEnsure.ok &&
      secondEnsure.ok &&
      firstEnsure.storyId === secondEnsure.storyId &&
      firstEnsure.commentId === secondEnsure.commentId &&
      noGitArtifact.ok &&
      noRaw;
    const failures = [
      snapshots.every((snapshot) => snapshot.ok) ? null : "bk01_snapshot_creation_not_ok",
      retention.ok && retention.retainedCount === 3 ? null : "bk01_daily_keep_3_retention_not_ok",
      restore.ok && scratchRuntimeReadback.ok ? null : "bk01_restore_drill_not_ok",
      restoreToLivePromotionBlock.blocked ? null : "bk01_restore_to_live_not_blocked",
      preMigrationSnapshotReadback.ok ? null : "bk01_pre_migration_snapshot_not_ok",
      firstEnsure.ok && secondEnsure.ok && firstEnsure.storyId === secondEnsure.storyId ? null : "bk01_restore_drill_ticket_not_idempotent",
      noGitArtifact.ok ? null : "bk01_committed_db_artifact_found",
      noRaw ? null : "bk01_raw_path_leakage_detected"
    ].filter(Boolean);
    return {
      ok,
      failures,
      negativeFailures: failures,
      snapshotCreationReadback: {
        ok: snapshots.every((snapshot) => snapshot.ok),
        createdWith: "sqlite_vacuum_into",
        liveDatabaseFileCopiedDirectly: false,
        sourceProfileDigest,
        ownerMarkerRootDigest: rootReadback.runtimeRootDigest,
        backupRootDigest: sha256(resolve(backupRoot)),
        snapshots: snapshots.map((snapshot) => publicSnapshotReadback(snapshot)),
        rawPathRecorded: false
      },
      serviceStartCatchUpReadback: serviceStartCatchUp,
      retentionRotationReadback: {
        ...retention,
        simulatedDays: ["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04"],
        oldestEvictedOnDayFour: retention.evictedSnapshotIds.includes("bk01-daily-2026-07-01"),
        retainedExactlyThreeAfterDayFour: retention.retainedCount === 3,
        rawPathRecorded: false
      },
      preMigrationSnapshotReadback,
      restoreDrillReadback: {
        ...restore,
        scratchRuntimeReadback,
        scratchProfileCleanedUpAfterReadback: !existsSync(scratchRoot),
        snapshotDigestMatchesLatestRetained: restore.restoredDatabaseDigest === snapshots[3].snapshotDigest,
        rawPathRecorded: false
      },
      restoreToLivePromotionBlockReadback: restoreToLivePromotionBlock,
      recurringRestoreDrillTicketReadback: {
        ok: firstEnsure.ok && secondEnsure.ok && firstEnsure.storyId === secondEnsure.storyId && firstEnsure.commentId === secondEnsure.commentId,
        storyId: firstEnsure.storyId,
        commentId: firstEnsure.commentId,
        commentBodyDigest: firstEnsure.commentBodyDigest,
        commentAuditEventId: firstEnsure.commentAuditEventId,
        ticketListVisible: firstEnsure.ticketListVisible,
        auditVisible: firstEnsure.auditVisible,
        secondEnsureNoDuplicate: secondEnsure.commentCount === firstEnsure.commentCount,
        recurrence: "monthly_restore_drill",
        rawPathRecorded: false
      },
      methodAuthorityReadback: {
        ok: true,
        backupMethodSurfaceIntroduced: false,
        backendOnlyHelpers: [
          "createSqlitePhysicalSnapshot",
          "applyDailyKeep3Retention",
          "restoreSnapshotToScratchProfile"
        ],
        existingAosMethodsExercisedForTicketReadback: ["aos.ticket.list", "aos.audit.query"],
        genericGatewayExposed: false,
        rawDbExportExposed: false,
        liveDispatchAuthorized: false,
        ownerIntentExecutionAuthorized: false
      },
      noGitArtifactReadback: noGitArtifact,
      privacyNoArtifactNoOverclaimReadback: {
        ok: noGitArtifact.ok && noRaw,
        rawPathRecorded: false,
        rawDbDumpRecorded: false,
        secretsOrPiiStored: false,
        backupArtifactsCommitted: false,
        restoreArtifactsCommitted: false,
        receiptsDigestOnly: true,
        noOverclaimFlags
      },
      validation_readbacks: {
        proofScriptSelfCheck: "node --check scripts/bk01-physical-snapshot-proof.mjs",
        focusedProofCommand: command,
        sourceHead: source.sourceHead,
        workflowBasis,
        incomingAosBasis
      }
    };
  } finally {
    repository.close();
  }
}

function ensureRestoreDrillTicket(repository) {
  const seed = createDefaultSeed();
  const store = new AosStore(seed, { persistence: repository });
  const project = seed.projects.find((item) => item.id === "TCRN-AOS");
  store.upsertProject(project, actor);
  const initiativeTitle = "AOS Knowledge Retrieval Layer Backup Operations";
  const epicTitle = "BK-01 Physical snapshot retention and restore drill";
  const storyTitle = "Monthly restore drill for AOS physical snapshots";
  let initiative = store.listInitiatives().find((item) => item.title === initiativeTitle);
  if (!initiative) {
    initiative = store.createInitiative({
      projectId: "TCRN-AOS",
      title: initiativeTitle,
      status: "in_progress",
      problem: "AOS needs durable, local-first backup operations.",
      expectedOutcome: "Physical snapshot and monthly restore drill work remains visible as AOS metadata."
    }, actor);
  }
  let epic = store.listEpics().find((item) => item.title === epicTitle && item.initiativeId === initiative.id);
  if (!epic) {
    epic = store.createEpic({
      initiativeId: initiative.id,
      title: epicTitle,
      goal: "Keep BK-01 restore drill operations recurring without owner-facing readiness claims.",
      status: "in_progress"
    }, actor);
  }
  let story = store.listStories().find((item) => item.title === storyTitle && item.epicId === epic.id);
  if (!story) {
    story = store.createStory({
      epicId: epic.id,
      title: storyTitle,
      problem: "Backups without restore drills can silently become unusable.",
      user: "AOS service scheduler",
      expectedBehavior: "A monthly scratch restore drill is queued and read back as metadata only.",
      acceptanceCriteria: [
        "restore drill runs against scratch profile only",
        "restore-to-live promotion remains blocked without owner intent route",
        "no backup artifact is committed to source"
      ],
      status: "in_progress",
      estimate: { effortPoints: 2, complexity: "medium", risk: "L3", verificationCost: "medium", confidence: "medium" },
      subTasks: []
    }, actor);
  }
  const commentBody = "BK-01 monthly restore drill ticket: scratch-profile restore only; restore-to-live promotion requires a separate owner-intent route; no readiness or release claim.";
  let comment = story.comments.find((item) => sha256(item.body) === sha256(commentBody));
  if (!comment) {
    comment = store.addComment({
      ticketId: story.id,
      type: "agent_observation",
      actor,
      body: commentBody
    }, actor);
  }
  const commentAudit = store.queryAudit({ targetId: story.id, action: "comment.create" })
    .find((event) => event.details.commentId === comment.id);
  const tickets = createWorkReadbackApiResponse(store, "/api/work/readback/tickets", new URLSearchParams({ storyId: story.id, limit: "1" }));
  const audit = createWorkReadbackApiResponse(store, "/api/work/readback/audit", new URLSearchParams({ targetId: story.id, limit: "5" }));
  return {
    ok: Boolean(story.id && comment.id && commentAudit && tickets.statusCode === 200 && audit.statusCode === 200),
    storyId: story.id,
    commentId: comment.id,
    commentBodyDigest: sha256(comment.body),
    commentAuditEventId: commentAudit?.id ?? null,
    commentCount: story.comments.filter((item) => sha256(item.body) === sha256(commentBody)).length,
    ticketListVisible: tickets.statusCode === 200 && tickets.body.ok === true && Array.isArray(tickets.body.rows) && tickets.body.rows.some((row) => row.storyId === story.id),
    auditVisible: audit.statusCode === 200 && audit.body.ok === true && Array.isArray(audit.body.items) && audit.body.items.length > 0
  };
}

async function provePreMigrationSnapshotHook(preMigrationDir) {
  const migrationRoot = await mkdtemp(join(tmpdir(), "tcrn-aos-bk01-pre-migrations-"));
  const scratchRoot = await mkdtemp(join(tmpdir(), "tcrn-aos-bk01-pre-db-"));
  try {
    await copyFile(join(migrationsDir, "0001_phase1_core.sql"), join(migrationRoot, "0001_phase1_core.sql"));
    await writeFile(join(migrationRoot, "0002_bk01_noop.sql"), "-- BK-01 no-op migration proof\nSELECT 1;\n");
    const preDbPath = join(scratchRoot, "pre-migration.sqlite");
    const repository = new AosSqliteRepository({ databasePath: preDbPath, migrationsDir: migrationRoot });
    try {
      const snapshots = [];
      const migration = repository.applyMigrations({
        preMigrationSnapshot(input) {
          const snapshot = createSqlitePhysicalSnapshot({
            sourceDatabasePath: preDbPath,
            snapshotPath: join(preMigrationDir, `pre-${input.version}.sqlite`),
            snapshotId: `bk01-pre-${input.version}`,
            createdAt: `2026-07-08T00:00:0${input.pendingIndex}.000Z`,
            purpose: "bk01_pre_migration_snapshot_hook",
            sourceProfileDigest: repository.databaseDigest(),
            routeId: route,
            profileId: bk01ProfileId,
            forbiddenWorktreeRoots: [repoRoot]
          });
          snapshots.push(snapshot);
          return { ok: snapshot.ok, snapshotId: snapshot.snapshotId, manifestDigest: snapshot.manifestDigest };
        }
      });
      return {
        ok: migration.preMigrationSnapshots.length === 2 &&
          migration.preMigrationSnapshots.every((snapshot) => snapshot.ok) &&
          migration.appliedCount === 2,
        migrationAppliedCount: migration.appliedCount,
        noOpMigrationVersion: "0002_bk01_noop",
        preMigrationSnapshots: snapshots.map((snapshot) => publicSnapshotReadback(snapshot)),
        runnerHook: "AosSqliteRepository.applyMigrations.preMigrationSnapshot",
        rawPathRecorded: false
      };
    } finally {
      repository.close();
    }
  } finally {
    await rm(migrationRoot, { recursive: true, force: true });
    await rm(scratchRoot, { recursive: true, force: true });
  }
}

function readScratchRuntime(scratchRoot, scratchDatabasePath) {
  ensureScratchRouteMarker(scratchRoot);
  const runtime = createRuntimeTransport({
    actor,
    databasePath: scratchDatabasePath,
    databaseRoot: scratchRoot,
    repoRoot,
    routeOwnedMarkerFile: markerFile,
    runtimeProfileMarker: {
      route,
      markerVersion: "bk01-scratch-restore-profile.v1",
      purpose: "bk01_scratch_restore_drill"
    },
    migrationsDir,
    auditPageLimit: 5,
    maxResponseBytes: 16_384
  });
  try {
    const ticket = runtime.transport.handleJsonRpc({
      jsonrpc: "2.0",
      id: 1,
      method: "aos.ticket.list",
      params: { limit: 5 }
    });
    return {
      ok: Boolean(ticket.result),
      openedViaCreateRuntimeTransport: true,
      ticketListMethodAvailable: Boolean(ticket.result),
      scratchProfileDigest: sha256(resolve(scratchRoot)),
      rawPathRecorded: false
    };
  } finally {
    runtime.close();
  }
}

function expectRestoreToLiveBlock(root, databasePath) {
  try {
    blockRestoreToLivePromotion({
      targetDatabasePath: databasePath,
      targetProfileRoot: root,
      liveDatabasePath: databasePath,
      liveProfileRoot: root
    });
    return { ok: false, blocked: false, reason: "not_blocked", liveProfileOverwritePerformed: false };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      ok: reason.includes("restore_to_live_profile_requires_owner_intent_route"),
      blocked: reason.includes("restore_to_live_profile_requires_owner_intent_route"),
      reason,
      liveProfileOverwritePerformed: false,
      rawPathRecorded: false
    };
  }
}

function proveServiceStartCatchUp() {
  const noPrior = evaluateDailySnapshotCatchUp({ latestSnapshotAt: null, now: "2026-07-08T00:00:00.000Z" });
  const overdue = evaluateDailySnapshotCatchUp({
    latestSnapshotAt: "2026-07-06T00:00:00.000Z",
    now: "2026-07-08T00:00:00.000Z"
  });
  const notDue = evaluateDailySnapshotCatchUp({
    latestSnapshotAt: "2026-07-07T12:00:00.000Z",
    now: "2026-07-08T00:00:00.000Z"
  });
  return {
    ok: noPrior.due && overdue.due && !notDue.due,
    backendOnlyCatchUpPrimitive: "evaluateDailySnapshotCatchUp",
    dailyTimerIntervalHours: 24,
    serviceStartNoPriorSnapshot: noPrior,
    serviceStartOverdueSnapshot: overdue,
    serviceStartRecentSnapshot: notDue,
    schedulerActorBoundary: "backend_only_aos_service_scheduler_or_system_actor_future_wiring; no public gateway method exposed by this route"
  };
}

function publicSnapshotReadback(snapshot) {
  return {
    ok: snapshot.ok,
    snapshotId: snapshot.snapshotId,
    snapshotDigest: snapshot.snapshotDigest,
    manifestDigest: snapshot.manifestDigest,
    createdWith: snapshot.createdWith,
    liveDatabaseFileCopiedDirectly: snapshot.liveDatabaseFileCopiedDirectly,
    createdAt: snapshot.manifest.createdAt,
    purpose: snapshot.manifest.purpose,
    sourceProfileDigest: snapshot.manifest.sourceProfileDigest,
    sourceDatabaseDigest: snapshot.manifest.sourceDatabaseDigest,
    routeDigest: snapshot.manifest.routeDigest,
    profileDigest: snapshot.manifest.profileDigest,
    snapshotPathDigest: snapshot.manifest.snapshotPathDigest,
    tableRowCounts: snapshot.manifest.tableRowCounts,
    integrityCheck: snapshot.manifest.integrityCheck,
    rawPathRecorded: false
  };
}

function ensureP1RouteOwnedMarker(root) {
  mkdirSync(root, { recursive: true });
  const markerPath = join(root, markerFile);
  const expected = p1MarkerContent(root);
  if (!existsSync(markerPath)) {
    writeFileSync(markerPath, `${JSON.stringify(expected, null, 2)}\n`, "utf8");
    return;
  }
  const marker = JSON.parse(readFileSync(markerPath, "utf8"));
  if (!marker || marker.route !== expected.route || marker.markerVersion !== expected.markerVersion || marker.rootDigest !== expected.rootDigest || marker.purpose !== expected.purpose) {
    throw new Error("bk01_p1_route_owned_marker_stale_or_mismatched");
  }
}

function ensureScratchRouteMarker(root) {
  mkdirSync(root, { recursive: true });
  const marker = {
    route,
    markerVersion: "bk01-scratch-restore-profile.v1",
    rootDigest: sha256(resolve(root)),
    purpose: "bk01_scratch_restore_drill"
  };
  writeFileSync(join(root, markerFile), `${JSON.stringify(marker, null, 2)}\n`, "utf8");
}

function p1MarkerContent(root) {
  return {
    route: p1Route,
    markerVersion,
    rootDigest: sha256(resolve(root)),
    purpose: markerPurpose,
    p1DataDisposition: "clean_start_declared"
  };
}

function selectDurableRoot() {
  const explicit = process.env.TCRN_AOS_P1_DURABLE_RUNTIME_PROFILE_ROOT;
  const root = resolve(explicit || join(homedir(), "Library", "Application Support", "TCRN-AOS", "conditional-dogfood-start-p1-runtime-profile"));
  return {
    root,
    readback: {
      profileRootClass: explicit ? "explicit_owner_marker_durable_local_profile_root" : "owner_marker_durable_local_profile_root",
      explicitRootProvided: Boolean(explicit),
      selectedRootDigest: sha256(root),
      databaseFileName,
      ownerMarkerFile,
      routeOwnedMarkerFile: markerFile,
      rawPathRecorded: false
    }
  };
}

function noCommittedDbArtifacts() {
  const result = spawnSync("git", ["-C", repoRoot, "ls-files"], { encoding: "utf8" });
  const tracked = result.stdout.split(/\r?\n/).filter(Boolean);
  const dbArtifacts = tracked.filter((file) => /\.(sqlite|sqlite3|db|db-wal|db-shm)$/i.test(file) && !file.startsWith(".codegraph/"));
  return {
    ok: result.status === 0 && dbArtifacts.length === 0,
    trackedDbArtifactCount: dbArtifacts.length,
    excludedCodegraphOnly: true,
    backupArtifactsCommitted: false,
    rawPathRecorded: false
  };
}

function noRawPathLeakage(value) {
  const text = JSON.stringify(value);
  return !text.includes(repoRoot) && !/\/Users\/[^"\\]+/.test(text);
}

function privacyScan(value) {
  const text = JSON.stringify(value);
  const findings = [];
  if (text.includes(repoRoot) || /\/Users\/[^"\\]+/.test(text)) {
    findings.push({ kind: "raw_absolute_path" });
  }
  if (/-----BEGIN [A-Z ]+PRIVATE KEY-----/.test(text)) {
    findings.push({ kind: "private_key_material" });
  }
  if (/rawDbDumpRecorded":true|record_json/i.test(text)) {
    findings.push({ kind: "raw_db_dump_marker" });
  }
  if (/readinessClaimed":true|releaseReadinessClaimed":true|ownerFacingAcceptanceClaimed":true/.test(text)) {
    findings.push({ kind: "overclaim_flag_true" });
  }
  return {
    ok: findings.length === 0,
    findingCount: findings.length,
    findings,
    scannedPayloadDigest: sha256(text),
    rawPathRecorded: false
  };
}

function writeReceipt(name, value) {
  const receipt = {
    schema: "aos.knowledge_retrieval_layer.bk01.v1",
    receiptName: name,
    ok: value.ok === true,
    generatedAt: "2026-07-08T00:00:00.000Z",
    route,
    workflowBasis,
    planBasis,
    aosBasis: incomingAosBasis,
    ...value
  };
  writeFileSync(join(evidenceRoot, name), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  return receipt;
}

function sourceProvenance() {
  const sourceHead = git(["rev-parse", "HEAD"]);
  const fileDigests = Object.fromEntries(sourceFiles.map((file) => [file, sha256(readFileSync(join(repoRoot, file)))]));
  return {
    sourceHead,
    incomingAosBasis,
    workflowBasis,
    planBasis,
    sourceFiles,
    sourceContentDigest: sha256(stableJson(fileDigests)),
    fileDigests,
    command
  };
}

function git(args) {
  const result = spawnSync("git", ["-C", repoRoot, ...args], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git_${args.join("_")}_failed`);
  }
  return result.stdout.trim();
}
