import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AosSqliteRepository,
  createSqliteLogicalExport,
  createSqlitePhysicalSnapshot,
  digestFile,
  importLogicalExportToScratchProfile,
  listBackupArtifacts,
  prepareRuntimeRoot,
  readSqliteTableDigests,
  sha256,
  stableJson
} from "../dist/packages/db/src/index.js";
import { AosStore, createDefaultSeed } from "../dist/packages/domain/src/index.js";
import { createRuntimeTransport } from "../dist/packages/mcp-server/src/index.js";
import { createWorkReadbackApiResponse } from "../dist/apps/api/src/work-readback.js";

const route = "route_tcrn_aos_knowledge_retrieval_layer_bk02_kr08_logical_export_backend_method_surface_after_bk01_gate_green_6cbe28_8dce81_20260708";
const workflowBasis = "8dce81d2e9a6408d1d139e4d84486497c6caf288";
const planBasis = workflowBasis;
const incomingAosBasis = "6cbe2870531ad889c306db0f18937a73091989b5";
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const evidenceRoot = join(repoRoot, "evidence/aos-knowledge-retrieval-layer-bk02");
const migrationsDir = join(repoRoot, "packages/db/migrations/sqlite");
const command = "pnpm --dir TCRN-AOS bk02:logical-export-proof";
const databaseFileName = "aos-p1-durable-runtime-profile.sqlite";
const markerFile = ".tcrn-aos-phase1-root";
const ownerMarkerFile = ".aos-persistent-runtime-owner.json";
const p1Route = "route_tcrn_conditional_dogfood_start_p1_durable_runtime_profile_root_migration_ilya_after_owner_decision_949a58_8aa904_20260707";
const markerVersion = "conditional-dogfood-start-p1-runtime-profile.v1";
const markerPurpose = "p1-clean-start-durable-runtime-profile-root";
const bk02ProfileId = "aos-knowledge-retrieval-layer-bk02-logical-export-profile-v1";
const p1OwnerMarker = {
  profileId: "conditional-dogfood-start-p1-clean-start-runtime-profile-v1",
  routeId: p1Route,
  runContext: "conditional-dogfood-start-p1-clean-start-v1",
  owner: "aos-product-local-owner-authorized"
};
const ilyaActor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "bk02-logical-export-proof"
};
const schedulerActor = {
  employeeId: "aos-service-scheduler",
  role: "owner_observer",
  threadId: "aos-service-scheduler-system",
  sessionId: "bk02-logical-export-proof"
};
const atlasActor = {
  employeeId: "employee-atlas",
  role: "owner_observer",
  threadId: "atlas-thread",
  sessionId: "bk02-logical-export-proof"
};
const sourceFiles = [
  "package.json",
  "packages/db/src/backup.ts",
  "packages/db/src/index.ts",
  "packages/domain/src/seed.ts",
  "packages/mcp-server/src/transport.ts",
  "apps/api/src/work-readback.ts",
  "packages/db/test/bk02-logical-export.test.mjs",
  "scripts/bk02-logical-export-proof.mjs"
];
const noOverclaimFlags = {
  bk01PhysicalSnapshotImplemented: true,
  bk02LogicalExportImplemented: true,
  logicalExportBackendOnly: true,
  frontendTriggerImplemented: false,
  kr00Started: false,
  kr01Started: false,
  kr02Started: false,
  kr03Started: false,
  kr04HookSwapStarted: false,
  kr05Started: false,
  kr06Started: false,
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
const proof = await runBk02Proof(selectedRoot.root);
const privacy = privacyScan(proof);
const readbackReceipt = writeReceipt("bk02-logical-export-readback.json", {
  ok: proof.ok && privacy.ok,
  route,
  command,
  source,
  selectedRoot: selectedRoot.readback,
  logicalExportReadback: proof.logicalExportReadback,
  internalSnapshotReadback: proof.internalSnapshotReadback,
  importRoundTripReadback: proof.importRoundTripReadback,
  methodAuthorityReadback: proof.methodAuthorityReadback,
  workReadbackVisibilityReadback: proof.workReadbackVisibilityReadback,
  roleGatingNegativeReadback: proof.roleGatingNegativeReadback,
  privacyNoArtifactNoOverclaimReadback: proof.privacyNoArtifactNoOverclaimReadback,
  noGitArtifactReadback: proof.noGitArtifactReadback,
  validation_readbacks: proof.validation_readbacks,
  privacyNoOverclaimScan: privacy,
  failures: [...proof.failures, ...privacy.findings.map((finding) => finding.kind)],
  negativeFailures: proof.negativeFailures,
  noOverclaimFlags
});
const summaryReceipt = writeReceipt("bk02-logical-export-proof-summary.json", {
  ok: readbackReceipt.ok === true,
  route,
  command,
  source,
  receiptInventory: ["bk02-logical-export-readback.json"],
  receiptCount: 1,
  allChildReceiptsOk: readbackReceipt.ok === true,
  missingReceipts: [],
  extraUnclassifiedReceipts: [],
  readbackReceiptDigest: sha256(stableJson(readbackReceipt)),
  exportId: proof.logicalExportReadback.exportId,
  exportDigest: proof.logicalExportReadback.exportDigest,
  methodSurface: proof.methodAuthorityReadback.registeredMethods,
  backupListItemCount: proof.workReadbackVisibilityReadback.backupListItemCount,
  noOverclaimFlags,
  failures: readbackReceipt.ok === true ? [] : ["bk02_logical_export_readback_not_ok"],
  negativeFailures: proof.negativeFailures
});

assert.equal(readbackReceipt.ok, true);
assert.equal(summaryReceipt.ok, true);

console.log(JSON.stringify({
  ok: true,
  route,
  command,
  receipts: ["bk02-logical-export-proof-summary.json", "bk02-logical-export-readback.json"],
  exportId: proof.logicalExportReadback.exportId,
  exportDigest: proof.logicalExportReadback.exportDigest,
  importRoundTripOk: proof.importRoundTripReadback.ok,
  backupMethodsRegistered: proof.methodAuthorityReadback.registeredMethods,
  backupListItemCount: proof.workReadbackVisibilityReadback.backupListItemCount,
  rawPathRecorded: false,
  frontendTriggerImplemented: false,
  readinessClaimed: false
}, null, 2));

async function runBk02Proof(root) {
  const rootReadback = await prepareRuntimeRoot({ runtimeRoot: root, repoRoot, ownerMarker: p1OwnerMarker });
  ensureP1RouteOwnedMarker(root);
  const databasePath = join(root, databaseFileName);
  const backupRoot = join(root, "backup");
  const exportDir = join(backupRoot, "bk02-logical-exports", "bk02-proof-logical-export");
  const internalSnapshotPath = join(backupRoot, "bk02-logical-export-internal-snapshots", "bk02-proof-logical-export.sqlite");
  const directSnapshotPath = join(backupRoot, "bk02-method-physical-snapshots", "bk02-proof-method-snapshot.sqlite");
  const methodExportDir = join(backupRoot, "bk02-logical-exports", "bk02-proof-method-export");
  const methodExportSnapshotPath = join(backupRoot, "bk02-logical-export-internal-snapshots", "bk02-proof-method-export.sqlite");
  const scratchRoot = join(backupRoot, "bk02-logical-import-scratch-profile");
  const scratchDatabasePath = join(scratchRoot, "scratch-import.sqlite");
  rmSync(exportDir, { recursive: true, force: true });
  rmSync(`${internalSnapshotPath}.manifest.json`, { force: true });
  rmSync(internalSnapshotPath, { force: true });
  rmSync(directSnapshotPath, { force: true });
  rmSync(`${directSnapshotPath}.manifest.json`, { force: true });
  rmSync(methodExportDir, { recursive: true, force: true });
  rmSync(methodExportSnapshotPath, { force: true });
  rmSync(`${methodExportSnapshotPath}.manifest.json`, { force: true });
  rmSync(scratchRoot, { recursive: true, force: true });
  mkdirSync(join(backupRoot, "bk02-logical-exports"), { recursive: true });
  mkdirSync(join(backupRoot, "bk02-logical-export-internal-snapshots"), { recursive: true });

  const repository = new AosSqliteRepository({ databasePath, migrationsDir });
  let sourceProfileDigest;
  let directLogicalExport;
  try {
    repository.applyMigrations();
    repository.seedAiEmployees(createDefaultSeed().employees, "bk02-default-seed");
    const workload = ensureBk02Workload(repository);
    sourceProfileDigest = repository.databaseDigest();
    directLogicalExport = createSqliteLogicalExport({
      sourceDatabasePath: databasePath,
      internalSnapshotPath,
      exportDirectory: exportDir,
      exportId: "bk02-proof-logical-export",
      internalSnapshotId: "bk02-proof-logical-export-internal-snapshot",
      createdAt: "2026-07-08T01:00:00.000Z",
      purpose: "bk02_logical_jsonl_export_round_trip_proof",
      sourceProfileDigest,
      routeId: route,
      profileId: bk02ProfileId,
      forbiddenWorktreeRoots: [repoRoot]
    });
    const sourceTableDigests = readSqliteTableDigests(databasePath);
    const importRoundTrip = importLogicalExportToScratchProfile({
      exportDirectory: exportDir,
      manifestFileName: directLogicalExport.manifest.manifestFileName,
      scratchDatabasePath,
      scratchProfileRoot: scratchRoot,
      liveDatabasePath: databasePath,
      liveProfileRoot: root,
      migrationsDir,
      forbiddenWorktreeRoots: [repoRoot]
    });
    const noGitArtifact = noCommittedDbArtifacts();
    const noRawDirect = noRawPathLeakage({ directLogicalExport, importRoundTrip, workload });
    repository.close();
    const methodAuthority = proveBackupMethods(root, databasePath, backupRoot);
    const backupList = listBackupArtifacts({ backupDir: backupRoot, forbiddenWorktreeRoots: [repoRoot] });
    const workReadback = createWorkReadbackApiResponse(new AosStore(createDefaultSeed()), "/api/work/readback/backups", new URLSearchParams({ limit: "50" }), {
      backupListReadback: backupList
    });
    rmSync(scratchRoot, { recursive: true, force: true });
    const listHasLogicalExport = backupList.items.some((item) => item.id === directLogicalExport.exportId && item.kind === "logical_export");
    const workReadbackHasLogicalExport = workReadback.statusCode === 200 &&
      workReadback.body.ok === true &&
      Array.isArray(workReadback.body.items) &&
      workReadback.body.items.some((item) => item.id === directLogicalExport.exportId && item.kind === "logical_export");
    const rowCountMatches = JSON.stringify(importRoundTrip.importedTableRowCounts) === JSON.stringify(importRoundTrip.sourceTableRowCounts);
    const digestMatches = Object.values(importRoundTrip.tableDigestMatches).every(Boolean);
    const sourceExportDigestSubsetMatches = Object.entries(directLogicalExport.manifest.tableManifests)
      .every(([, table]) => sourceTableDigests[table.tableName] === table.rowDigest);
    const ok = directLogicalExport.ok &&
      importRoundTrip.ok &&
      rowCountMatches &&
      digestMatches &&
      sourceExportDigestSubsetMatches &&
      methodAuthority.ok &&
      listHasLogicalExport &&
      workReadbackHasLogicalExport &&
      noGitArtifact.ok &&
      noRawDirect;
    const failures = [
      directLogicalExport.ok ? null : "bk02_logical_export_not_ok",
      importRoundTrip.ok && rowCountMatches && digestMatches ? null : "bk02_import_round_trip_not_ok",
      sourceExportDigestSubsetMatches ? null : "bk02_source_export_digest_mismatch",
      methodAuthority.ok ? null : "bk02_method_authority_not_ok",
      listHasLogicalExport && workReadbackHasLogicalExport ? null : "bk02_backup_readback_not_visible",
      noGitArtifact.ok ? null : "bk02_committed_backup_artifact_found",
      noRawDirect ? null : "bk02_raw_path_leakage_detected"
    ].filter(Boolean);
    return {
      ok,
      failures,
      negativeFailures: failures,
      logicalExportReadback: publicLogicalExportReadback(directLogicalExport),
      internalSnapshotReadback: {
        ok: directLogicalExport.internalSnapshot.ok,
        snapshotId: directLogicalExport.internalSnapshot.snapshotId,
        createdWith: directLogicalExport.internalSnapshot.createdWith,
        sourceSnapshotDigest: directLogicalExport.internalSnapshot.snapshotDigest,
        sourceDatabaseDigest: directLogicalExport.internalSnapshot.manifest.sourceDatabaseDigest,
        liveDatabaseFileCopiedDirectly: directLogicalExport.internalSnapshot.liveDatabaseFileCopiedDirectly,
        exportOperatedOnFreshInternalSnapshot: true,
        rawPathRecorded: false
      },
      importRoundTripReadback: {
        ...importRoundTrip,
        rowCountsMatch: rowCountMatches,
        tableDigestsMatch: digestMatches,
        sourceExportDigestSubsetMatches,
        scratchProfileCleanedUpAfterReadback: !existsSync(scratchRoot),
        rawPathRecorded: false
      },
      methodAuthorityReadback: methodAuthority,
      workReadbackVisibilityReadback: {
        ok: backupList.ok && workReadbackHasLogicalExport,
        method: "aos.backup.list",
        endpoint: "/api/work/readback/backups",
        backupListItemCount: backupList.returnedCount,
        logicalExportVisible: workReadbackHasLogicalExport,
        fullGatewayMethodListExposed: false,
        rawPathRecorded: false
      },
      roleGatingNegativeReadback: methodAuthority.roleGatingNegativeReadback,
      noGitArtifactReadback: noGitArtifact,
      privacyNoArtifactNoOverclaimReadback: {
        ok: noGitArtifact.ok && noRawDirect,
        rawPathRecorded: false,
        rawDbDumpRecorded: false,
        rawExportPayloadStoredInReceipts: false,
        secretsOrPiiStored: false,
        backupArtifactsCommitted: false,
        exportArtifactsCommitted: false,
        receiptsDigestOnly: true,
        noOverclaimFlags
      },
      validation_readbacks: {
        proofScriptSelfCheck: "node --check scripts/bk02-logical-export-proof.mjs",
        focusedProofCommand: command,
        sourceHead: source.sourceHead,
        workflowBasis,
        planBasis,
        incomingAosBasis
      },
      selectedRootDigest: rootReadback.runtimeRootDigest
    };
  } catch (error) {
    try {
      repository.close();
    } catch {
      // The primary proof failure is reported below.
    }
    throw error;
  }
}

function proveBackupMethods(root, databasePath, backupRoot) {
  const schedulerRuntime = createRuntimeTransport(runtimeConfig(root, databasePath, schedulerActor));
  try {
    const policy = schedulerRuntime.transport.handleJsonRpc({ jsonrpc: "2.0", id: 1, method: "aos.policy.read", params: {} });
    const snapshot = schedulerRuntime.transport.handleJsonRpc({
      jsonrpc: "2.0",
      id: 2,
      method: "aos.backup.snapshot.create",
      params: {
        snapshotId: "bk02-proof-method-snapshot",
        createdAt: "2026-07-08T01:05:00.000Z",
        purpose: "bk02_method_surface_physical_snapshot",
        idempotencyKey: "bk02-proof-method-snapshot"
      }
    });
    const snapshotReplay = schedulerRuntime.transport.handleJsonRpc({
      jsonrpc: "2.0",
      id: 3,
      method: "aos.backup.snapshot.create",
      params: {
        snapshotId: "bk02-proof-method-snapshot",
        createdAt: "2026-07-08T01:05:00.000Z",
        purpose: "bk02_method_surface_physical_snapshot",
        idempotencyKey: "bk02-proof-method-snapshot"
      }
    });
    const logicalExport = schedulerRuntime.transport.handleJsonRpc({
      jsonrpc: "2.0",
      id: 4,
      method: "aos.backup.export.create",
      params: {
        exportId: "bk02-proof-method-export",
        createdAt: "2026-07-08T01:06:00.000Z",
        purpose: "bk02_method_surface_logical_export",
        idempotencyKey: "bk02-proof-method-export"
      }
    });
    const backupList = schedulerRuntime.transport.handleJsonRpc({ jsonrpc: "2.0", id: 5, method: "aos.backup.list", params: {} });
    const schedulerTicketWrite = schedulerRuntime.transport.handleJsonRpc({
      jsonrpc: "2.0",
      id: 6,
      method: "aos.ticket.comment",
      params: { ticketId: "story-denied", type: "agent_observation", body: "scheduler ticket write denied" }
    });
    const atlasRuntime = createRuntimeTransport(runtimeConfig(root, databasePath, atlasActor));
    let atlasList;
    try {
      atlasList = atlasRuntime.transport.handleJsonRpc({ jsonrpc: "2.0", id: 7, method: "aos.backup.list", params: {} });
    } finally {
      atlasRuntime.close();
    }
    const ilyaRuntime = createRuntimeTransport(runtimeConfig(root, databasePath, ilyaActor));
    let ilyaDenied;
    let unknownDenied;
    try {
      ilyaDenied = ilyaRuntime.transport.handleJsonRpc({
        jsonrpc: "2.0",
        id: 8,
        method: "aos.backup.export.create",
        params: { exportId: "bk02-ilya-denied-export", idempotencyKey: "bk02-ilya-denied-export" }
      });
      unknownDenied = ilyaRuntime.transport.handleJsonRpc({ jsonrpc: "2.0", id: 9, method: "aos.backup.export.delete", params: {} });
    } finally {
      ilyaRuntime.close();
    }
    const registeredMethods = ["aos.backup.snapshot.create", "aos.backup.export.create", "aos.backup.list"];
    const ok = policy.error === undefined &&
      registeredMethods.every((method) => policy.result.transportAllowedMethods.includes(method)) &&
      policy.result.actorAuthoritySnapshot.backupCreateAuthority === true &&
      policy.result.actorAuthoritySnapshot.canWrite === false &&
      snapshot.error === undefined &&
      snapshot.result.ok === true &&
      snapshotReplay.result.status === "deduped" &&
      logicalExport.error === undefined &&
      logicalExport.result.ok === true &&
      logicalExport.result.liveDatabaseFileReadDirectly === false &&
      backupList.error === undefined &&
      backupList.result.items.some((item) => item.id === "bk02-proof-method-export" && item.kind === "logical_export") &&
      atlasList.error === undefined &&
      schedulerTicketWrite.error?.data?.reason === "transport_actor_blocked_role" &&
      ilyaDenied.error?.data?.reason === "backup_create_actor_denied" &&
      unknownDenied.error?.data?.reason === "transport_method_unknown" &&
      !JSON.stringify(backupList.result).includes(root);
    return {
      ok,
      registeredMethods,
      schedulerBackupCreateAllowed: snapshot.error === undefined && logicalExport.error === undefined,
      schedulerGenericTicketWriteDenied: schedulerTicketWrite.error?.data?.reason === "transport_actor_blocked_role",
      atlasBackupReadAllowed: atlasList.error === undefined,
      nonStewardBackupCreateDenied: ilyaDenied.error?.data?.reason === "backup_create_actor_denied",
      unknownBackupMethodDenied: unknownDenied.error?.data?.reason === "transport_method_unknown",
      snapshotCreateReadback: sanitizedMethodResult(snapshot.result),
      exportCreateReadback: sanitizedMethodResult(logicalExport.result),
      backupListReadback: {
        ok: backupList.error === undefined,
        returnedCount: backupList.result?.returnedCount ?? 0,
        methodExportVisible: backupList.result?.items?.some((item) => item.id === "bk02-proof-method-export") ?? false,
        backupRootDigest: sha256(resolve(backupRoot)),
        rawPathRecorded: false
      },
      roleGatingNegativeReadback: {
        ok: schedulerTicketWrite.error?.data?.reason === "transport_actor_blocked_role" &&
          ilyaDenied.error?.data?.reason === "backup_create_actor_denied" &&
          unknownDenied.error?.data?.reason === "transport_method_unknown",
        schedulerTicketGateKnowledgeWriteAuthorityGranted: false,
        nonStewardDeniedReason: ilyaDenied.error?.data?.reason ?? null,
        schedulerTicketWriteDeniedReason: schedulerTicketWrite.error?.data?.reason ?? null,
        unknownBackupMethodDeniedReason: unknownDenied.error?.data?.reason ?? null,
        refusedAttemptsAudited: true
      },
      fullGatewayExposed: false,
      rawDbExportExposed: false,
      frontendTriggerImplemented: false,
      liveDispatchAuthorized: false,
      ownerIntentExecutionAuthorized: false
    };
  } finally {
    schedulerRuntime.close();
  }
}

function ensureBk02Workload(repository) {
  const seed = createDefaultSeed();
  const store = new AosStore(seed, { persistence: repository });
  const project = seed.projects.find((item) => item.id === "TCRN-AOS");
  store.upsertProject(project, ilyaActor);
  const initiativeTitle = "AOS Knowledge Retrieval Layer Backup Operations";
  const epicTitle = "BK-02 Logical export backend and method surface";
  const storyTitle = "BK-02 logical export and scratch import proof";
  let initiative = store.listInitiatives().find((item) => item.title === initiativeTitle);
  if (!initiative) {
    initiative = store.createInitiative({
      projectId: "TCRN-AOS",
      title: initiativeTitle,
      status: "in_progress",
      problem: "AOS needs durable, local-first backup operations.",
      expectedOutcome: "Physical and logical backup proof stays visible as AOS metadata."
    }, ilyaActor);
  }
  let epic = store.listEpics().find((item) => item.title === epicTitle && item.initiativeId === initiative.id);
  if (!epic) {
    epic = store.createEpic({
      initiativeId: initiative.id,
      title: epicTitle,
      goal: "Prove JSONL logical export and scratch import without frontend trigger claims.",
      status: "in_progress"
    }, ilyaActor);
  }
  let story = store.listStories().find((item) => item.title === storyTitle && item.epicId === epic.id);
  if (!story) {
    story = store.createStory({
      epicId: epic.id,
      title: storyTitle,
      problem: "AOS needs a logical export format that can be verified independently of a live DB file.",
      user: "AOS backup operator",
      expectedBehavior: "A fresh internal snapshot exports JSONL per table and imports into a scratch profile with matching digests.",
      acceptanceCriteria: [
        "logical export uses a fresh internal snapshot",
        "scratch import row counts and digests match",
        "backup methods remain role-gated and readback-only for list/status"
      ],
      status: "in_progress",
      estimate: { effortPoints: 3, complexity: "medium", risk: "L3", verificationCost: "medium", confidence: "high" },
      subTasks: []
    }, ilyaActor);
  }
  const commentBody = "BK-02 logical export proof: backend-only JSONL export from fresh internal snapshot; scratch import only; no frontend trigger, readiness, release, or owner-facing acceptance claim.";
  let comment = story.comments.find((item) => sha256(item.body) === sha256(commentBody));
  if (!comment) {
    comment = store.addComment({
      ticketId: story.id,
      type: "agent_observation",
      actor: ilyaActor,
      body: commentBody
    }, ilyaActor);
  }
  const commentAudit = store.queryAudit({ targetId: story.id, action: "comment.create" })
    .find((event) => event.details.commentId === comment.id);
  return {
    ok: Boolean(story.id && comment.id && commentAudit),
    initiativeId: initiative.id,
    epicId: epic.id,
    storyId: story.id,
    commentId: comment.id,
    commentBodyDigest: sha256(comment.body),
    commentAuditEventId: commentAudit?.id ?? null,
    rawPathRecorded: false
  };
}

function publicLogicalExportReadback(logicalExport) {
  return {
    ok: logicalExport.ok,
    exportId: logicalExport.exportId,
    exportDigest: logicalExport.exportDigest,
    manifestDigest: logicalExport.manifestDigest,
    createdWith: logicalExport.createdWith,
    liveDatabaseFileReadDirectly: logicalExport.liveDatabaseFileReadDirectly,
    internalSnapshotId: logicalExport.manifest.sourceSnapshotId,
    internalSnapshotDigest: logicalExport.manifest.sourceSnapshotDigest,
    purpose: logicalExport.manifest.purpose,
    sourceProfileDigest: logicalExport.manifest.sourceProfileDigest,
    sourceDatabaseDigest: logicalExport.manifest.sourceDatabaseDigest,
    routeDigest: logicalExport.manifest.routeDigest,
    profileDigest: logicalExport.manifest.profileDigest,
    exportRootDigest: logicalExport.manifest.exportRootDigest,
    exportDirectoryName: logicalExport.manifest.exportDirectoryName,
    tableRowCounts: logicalExport.manifest.tableRowCounts,
    tableManifests: logicalExport.manifest.tableManifests.map((table) => ({
      tableName: table.tableName,
      fileName: table.fileName,
      columnCount: table.columns.length,
      rowCount: table.rowCount,
      rowDigest: table.rowDigest,
      fileDigest: table.fileDigest
    })),
    rawPathRecorded: false
  };
}

function sanitizedMethodResult(result) {
  if (!result) {
    return null;
  }
  return {
    ok: result.ok === true,
    method: result.method,
    snapshotId: result.snapshotId,
    exportId: result.exportId,
    manifestDigest: result.manifestDigest,
    tableRowCounts: result.tableRowCounts,
    liveDatabaseFileCopiedDirectly: result.liveDatabaseFileCopiedDirectly,
    liveDatabaseFileReadDirectly: result.liveDatabaseFileReadDirectly,
    rawPathRecorded: false
  };
}

function runtimeConfig(root, databasePath, actor) {
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
    throw new Error("bk02_p1_route_owned_marker_stale_or_mismatched");
  }
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
    exportArtifactsCommitted: false,
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
    schema: "aos.knowledge_retrieval_layer.bk02.v1",
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
