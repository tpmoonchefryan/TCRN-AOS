import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AosSqliteRepository,
  KnowledgeRetrievalValidationError,
  createSqlitePhysicalSnapshot,
  digestFile,
  probeSqliteFts5Availability,
  sha256,
  stableJson
} from "../dist/packages/db/src/index.js";
import { AosStore, createDefaultSeed } from "../dist/packages/domain/src/index.js";
import { transportMvpMethods } from "../dist/packages/mcp-server/src/index.js";

/**
 * PRECONDITION (declared per TCRN-AOS-INC-010): the durable-profile section of
 * this proof reads migration state from the durable runtime profile root, so it
 * shares p1's clean-start requirement and fails on residue for the same reason.
 * Archive a dirty root aside explicitly with `pnpm reset:durable-profile -- --yes`
 * (renames, never deletes) before running on a machine that carries one.
 */
const route = "route_tcrn_aos_knowledge_retrieval_layer_kr01_schema_fts_migration_after_kr00_gate_green_1d6076_8dce81_20260708";
const workflowBasis = "1d60763f3c0c3eae0fb5465fb50189c4951c48df";
const ownerDecisionWorkflowBasis = "8dce81d2e9a6408d1d139e4d84486497c6caf288";
const planBasis = ownerDecisionWorkflowBasis;
const incomingAosBasis = "a21e007ce84b5815e004bfd8a036b3553a0e8507";
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const evidenceRoot = join(repoRoot, "evidence/aos-knowledge-retrieval-layer-kr01");
const migrationsDir = join(repoRoot, "packages/db/migrations/sqlite");
const command = "pnpm --dir TCRN-AOS kr01:knowledge-schema-fts-proof";
const durableDatabaseFileName = "aos-p1-durable-runtime-profile.sqlite";
const durableRoot = resolve(process.env.TCRN_AOS_P1_DURABLE_RUNTIME_PROFILE_ROOT || join(homedir(), "Library", "Application Support", "TCRN-AOS", "conditional-dogfood-start-p1-runtime-profile"));
const durableDatabasePath = join(durableRoot, durableDatabaseFileName);
const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "kr01-knowledge-schema-fts-proof"
};
const sourceFiles = [
  "package.json",
  "packages/db/migrations/sqlite/0002_knowledge_retrieval.sql",
  "packages/db/src/backup.ts",
  "packages/db/src/index.ts",
  "packages/db/src/sqlite-repository.ts",
  "packages/db/test/kr01-knowledge-schema-fts.test.mjs",
  "packages/db/test/phase1-sqlite-repository.test.mjs",
  "scripts/kr01-knowledge-schema-fts-proof.mjs"
];
const noOverclaimFlags = {
  kr01SchemaFtsImplemented: true,
  kr02MethodSurfaceStarted: false,
  kr03ReadbackUiStarted: false,
  kr04HookSwapStarted: false,
  kr05SeedEntriesStarted: false,
  kr06KpiStarted: false,
  frontendTriggerImplemented: false,
  dogfood02TmsMutation: false,
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
  liveDurableProfileOverwritePerformed: false,
  broadCodexSecurityPluginScanClaimed: false,
  liveDispatchAuthorized: false,
  ownerIntentExecutionAuthorized: false
};

mkdirSync(evidenceRoot, { recursive: true });

const source = sourceProvenance();
const scratchRoot = await mkdtemp(join(tmpdir(), "tcrn-aos-kr01-proof-"));
try {
  const proof = runKr01Proof(scratchRoot);
  const privacy = privacyScan(proof);
  const readbackReceipt = writeReceipt("kr01-schema-fts-readback.json", {
    ok: proof.ok && privacy.ok,
    route,
    command,
    source,
    ftsDriverReadback: proof.ftsDriverReadback,
    freshProfileMigrationReadback: proof.freshProfileMigrationReadback,
    durableCopyMigrationReadback: proof.durableCopyMigrationReadback,
    preMigrationSnapshotReadback: proof.preMigrationSnapshotReadback,
    schemaReadback: proof.schemaReadback,
    bodyCapReadback: proof.bodyCapReadback,
    restartPersistenceReadback: proof.restartPersistenceReadback,
    internalRepositoryReadback: proof.internalRepositoryReadback,
    workItemEvidenceReadback: proof.workItemEvidenceReadback,
    methodSurfaceBoundaryReadback: proof.methodSurfaceBoundaryReadback,
    noGitArtifactReadback: proof.noGitArtifactReadback,
    privacyNoArtifactNoOverclaimReadback: proof.privacyNoArtifactNoOverclaimReadback,
    validation_readbacks: proof.validation_readbacks,
    privacyNoOverclaimScan: privacy,
    failures: [...proof.failures, ...privacy.findings.map((finding) => finding.kind)],
    negativeFailures: proof.negativeFailures,
    noOverclaimFlags
  });
  const summaryReceipt = writeReceipt("kr01-schema-fts-proof-summary.json", {
    ok: readbackReceipt.ok === true,
    route,
    command,
    source,
    receiptInventory: ["kr01-schema-fts-readback.json"],
    receiptCount: 1,
    allChildReceiptsOk: readbackReceipt.ok === true,
    missingReceipts: [],
    extraUnclassifiedReceipts: [],
    readbackReceiptDigest: sha256(stableJson(readbackReceipt)),
    fts5Available: proof.ftsDriverReadback.fts5Available,
    searchMode: proof.schemaReadback.searchMode,
    durableCopyAppliedMigrations: proof.durableCopyMigrationReadback.appliedMigrations,
    preMigrationSnapshotCount: proof.preMigrationSnapshotReadback.preMigrationSnapshots.length,
    acceptedEntryId: proof.internalRepositoryReadback.acceptedEntryId,
    workItemStoryId: proof.workItemEvidenceReadback.storyId,
    noOverclaimFlags,
    failures: readbackReceipt.ok === true ? [] : ["kr01_schema_fts_readback_not_ok"],
    negativeFailures: proof.negativeFailures
  });

  assert.equal(readbackReceipt.ok, true);
  assert.equal(summaryReceipt.ok, true);

  console.log(JSON.stringify({
    ok: true,
    route,
    command,
    receipts: ["kr01-schema-fts-proof-summary.json", "kr01-schema-fts-readback.json"],
    fts5Available: proof.ftsDriverReadback.fts5Available,
    searchMode: proof.schemaReadback.searchMode,
    durableCopyAppliedMigrations: proof.durableCopyMigrationReadback.appliedMigrations,
    preMigrationSnapshotCount: proof.preMigrationSnapshotReadback.preMigrationSnapshots.length,
    acceptedEntryId: proof.internalRepositoryReadback.acceptedEntryId,
    bodyCapRejected: proof.bodyCapReadback.rejected1501WordBody,
    restartPersistenceOk: proof.restartPersistenceReadback.ok,
    rawPathRecorded: false,
    kr02MethodSurfaceStarted: false,
    liveDurableProfileOverwritePerformed: false,
    readinessClaimed: false
  }, null, 2));
} finally {
  await rm(scratchRoot, { recursive: true, force: true });
}

function runKr01Proof(root) {
  if (!existsSync(durableDatabasePath)) {
    throw new Error("kr01_durable_profile_database_missing");
  }
  const ftsDriverReadback = probeSqliteFts5Availability();
  const freshProfileMigrationReadback = proveFreshProfileMigration(root);
  const durableProof = proveDurableCopyMigration(root);
  const repositoryProof = proveInternalRepository(root);
  const noGitArtifactReadback = noCommittedArtifacts();
  const privacyNoArtifactNoOverclaimReadback = {
    rawPathRecorded: false,
    rawDbDumpRecorded: false,
    secretsOrPiiStored: false,
    committedDbArtifacts: noGitArtifactReadback.trackedDbArtifactCount,
    backupOrExportArtifactsCommitted: noGitArtifactReadback.trackedBackupArtifactCount,
    releaseReadinessClaimed: false,
    ownerFacingAcceptanceClaimed: false,
    finalAcceptanceClaimed: false,
    kr02MethodSurfaceStarted: false,
    kr04HookSwapStarted: false
  };
  const failures = [];
  if (!ftsDriverReadback.fts5Available) failures.push("fts5_unavailable");
  if (!freshProfileMigrationReadback.ok) failures.push("fresh_profile_migration_failed");
  if (!durableProof.durableCopyMigrationReadback.ok) failures.push("durable_copy_migration_failed");
  if (!repositoryProof.schemaReadback.ok) failures.push("knowledge_schema_readback_failed");
  if (!repositoryProof.bodyCapReadback.rejected1501WordBody) failures.push("body_cap_not_rejected");
  if (!repositoryProof.restartPersistenceReadback.ok) failures.push("restart_persistence_failed");
  if (!repositoryProof.methodSurfaceBoundaryReadback.ok) failures.push("kr02_method_surface_boundary_failed");
  if (!noGitArtifactReadback.ok) failures.push("committed_artifacts_detected");
  if (JSON.stringify({ durableProof, repositoryProof, privacyNoArtifactNoOverclaimReadback }).includes(repoRoot)) {
    failures.push("raw_repo_path_leaked");
  }
  return {
    ok: failures.length === 0,
    ftsDriverReadback,
    freshProfileMigrationReadback,
    ...durableProof,
    ...repositoryProof,
    noGitArtifactReadback,
    privacyNoArtifactNoOverclaimReadback,
    validation_readbacks: {
      proofCommand: command,
      proofScriptSyntaxExpected: "node --check scripts/kr01-knowledge-schema-fts-proof.mjs",
      targetedTestExpected: "node --test packages/db/test/kr01-knowledge-schema-fts.test.mjs",
      verifyFastExpected: "pnpm --dir TCRN-AOS verify:fast",
      receiptAssertionsEmbedded: true
    },
    failures,
    negativeFailures: []
  };
}

function proveFreshProfileMigration(root) {
  const databasePath = join(root, "fresh-profile", "kr01-fresh.sqlite");
  const repository = new AosSqliteRepository({ databasePath, migrationsDir });
  try {
    const migration = repository.applyMigrations();
    const schema = repository.knowledgeRetrievalSchemaReadback();
    return {
      ok: migration.ok && migration.appliedCount === migration.migrationCount && schema.ok,
      migrationCount: migration.migrationCount,
      appliedCount: migration.appliedCount,
      appliedMigrations: migration.migrations.filter((item) => item.applied).map((item) => item.version),
      schemaOk: schema.ok,
      fts5Available: schema.fts5Available,
      searchMode: schema.searchMode,
      rawPathRecorded: false
    };
  } finally {
    repository.close();
  }
}

function proveDurableCopyMigration(root) {
  const copyRoot = join(root, "durable-copy-profile");
  const copiedDatabasePath = join(copyRoot, "durable-copy.sqlite");
  const preMigrationRoot = join(root, "pre-migration-snapshots");
  mkdirSync(dirname(copiedDatabasePath), { recursive: true });
  mkdirSync(preMigrationRoot, { recursive: true });
  const liveDigestBefore = digestFile(durableDatabasePath);
  const sourceSnapshot = createSqlitePhysicalSnapshot({
    sourceDatabasePath: durableDatabasePath,
    snapshotPath: copiedDatabasePath,
    snapshotId: "kr01-durable-profile-copy-before-migration",
    createdAt: "2026-07-08T00:10:00.000Z",
    purpose: "kr01_durable_profile_copy_for_schema_migration",
    sourceProfileDigest: sha256(`${sha256(durableRoot)}:${liveDigestBefore}`),
    routeId: route,
    profileId: "kr01-durable-copy-profile",
    forbiddenWorktreeRoots: [repoRoot]
  });
  const repository = new AosSqliteRepository({ databasePath: copiedDatabasePath, migrationsDir });
  try {
    const migration = repository.applyMigrations({
      preMigrationSnapshot(input) {
        const snapshot = createSqlitePhysicalSnapshot({
          sourceDatabasePath: copiedDatabasePath,
          snapshotPath: join(preMigrationRoot, `pre-${input.version}.sqlite`),
          snapshotId: `kr01-pre-${input.version}`,
          createdAt: "2026-07-08T00:11:00.000Z",
          purpose: "kr01_pre_migration_snapshot_on_durable_copy",
          sourceProfileDigest: repository.databaseDigest(),
          routeId: route,
          profileId: "kr01-durable-copy-profile",
          forbiddenWorktreeRoots: [repoRoot]
        });
        return { ok: snapshot.ok, snapshotId: snapshot.snapshotId, manifestDigest: snapshot.manifestDigest };
      }
    });
    const schema = repository.knowledgeRetrievalSchemaReadback();
    const liveDigestAfter = digestFile(durableDatabasePath);
    return {
      durableCopyMigrationReadback: {
        ok: sourceSnapshot.ok &&
          migration.ok &&
          migration.appliedCount === 1 &&
          migration.migrations.some((item) => item.version === "0002_knowledge_retrieval" && item.applied) &&
          schema.ok &&
          liveDigestBefore === liveDigestAfter,
        copiedFromFreshInternalSnapshot: true,
        sourceSnapshotId: sourceSnapshot.snapshotId,
        sourceSnapshotDigest: sourceSnapshot.snapshotDigest,
        sourceSnapshotManifestDigest: sourceSnapshot.manifestDigest,
        appliedCount: migration.appliedCount,
        appliedMigrations: migration.migrations.filter((item) => item.applied).map((item) => item.version),
        liveDurableProfileOverwritePerformed: false,
        liveDurableDatabaseDigestBefore: liveDigestBefore,
        liveDurableDatabaseDigestAfter: liveDigestAfter,
        rawPathRecorded: false
      },
      preMigrationSnapshotReadback: {
        ok: migration.preMigrationSnapshots.length === 1 && migration.preMigrationSnapshots.every((item) => item.ok),
        hookUsed: true,
        preMigrationSnapshots: migration.preMigrationSnapshots,
        rawPathRecorded: false
      }
    };
  } finally {
    repository.close();
  }
}

function proveInternalRepository(root) {
  const databasePath = join(root, "repository-profile", "repository.sqlite");
  const repository = new AosSqliteRepository({ databasePath, migrationsDir });
  try {
    repository.applyMigrations();
    const schemaReadback = repository.knowledgeRetrievalSchemaReadback();
    const accepted = repository.createKnowledgeRetrievalEntry(knowledgeEntry({
      id: "knowledge-kr01-proof-entry",
      title: "KR-01 schema FTS proof entry",
      body: words(1500)
    }));
    let bodyCapError = null;
    try {
      repository.createKnowledgeRetrievalEntry(knowledgeEntry({
        id: "knowledge-kr01-body-cap-negative",
        title: "KR-01 body cap negative",
        body: words(1501)
      }));
    } catch (error) {
      bodyCapError = error;
    }
    const search = repository.searchKnowledgeRetrievalEntries({ query: "schema proof", roleScope: "implementation", project: "TCRN-AOS" });
    const accessed = repository.recordKnowledgeRetrievalAccess(accepted.id, "2026-07-08T00:12:00.000Z");
    const workItemEvidenceReadback = ensureKr01WorkItem(repository);
    const digestBeforeClose = repository.databaseDigest();
    repository.close();
    const restarted = new AosSqliteRepository({ databasePath, migrationsDir });
    try {
      restarted.applyMigrations();
      const restartedSearch = restarted.searchKnowledgeRetrievalEntries({ query: "schema proof", roleScope: "implementation", project: "TCRN-AOS" });
      return {
        schemaReadback,
        bodyCapReadback: {
          ok: bodyCapError instanceof KnowledgeRetrievalValidationError,
          rejected1501WordBody: bodyCapError instanceof KnowledgeRetrievalValidationError,
          structuredError: bodyCapError instanceof KnowledgeRetrievalValidationError ? {
            reason: bodyCapError.reason,
            field: bodyCapError.field,
            limit: bodyCapError.limit,
            actual: bodyCapError.actual
          } : null,
          accepted1500WordBody: accepted.body.split(/\s+/).length === 1500,
          rawPathRecorded: false
        },
        restartPersistenceReadback: {
          ok: restarted.databaseDigest() === digestBeforeClose &&
            restartedSearch.some((entry) => entry.id === accepted.id) &&
            restarted.requireKnowledgeRetrievalEntry(accepted.id).accessCount === 1,
          insertedEntryPersisted: restartedSearch.some((entry) => entry.id === accepted.id),
          accessMetadataPersisted: restarted.requireKnowledgeRetrievalEntry(accepted.id).accessCount === 1,
          ftsSearchPersisted: restartedSearch.some((entry) => entry.id === accepted.id),
          rawPathRecorded: false
        },
        internalRepositoryReadback: {
          ok: schemaReadback.ok && search.some((entry) => entry.id === accepted.id) && accessed.accessCount === 1,
          acceptedEntryId: accepted.id,
          sourceDigest: accepted.sourceDigest,
          tags: accepted.tags,
          returnedByFtsSearch: search.some((entry) => entry.id === accepted.id),
          accessCountAfterRecord: accessed.accessCount,
          bodyWordLimit: 1500,
          summaryWordLimit: 120,
          rawPathRecorded: false
        },
        workItemEvidenceReadback,
        methodSurfaceBoundaryReadback: {
          ok: !transportMvpMethods.some((method) => method.startsWith("aos.knowledge.")),
          kr02KnowledgeTransportMethodsRegistered: transportMvpMethods.filter((method) => method.startsWith("aos.knowledge.")),
          transportMethodCount: transportMvpMethods.length,
          noGatewayOrTransportExpansionFromKr01: true,
          rawPathRecorded: false
        }
      };
    } finally {
      restarted.close();
    }
  } finally {
    try {
      repository.close();
    } catch {
      // The repository is closed during the restart proof.
    }
  }
}

function ensureKr01WorkItem(repository) {
  const seed = createDefaultSeed();
  const store = new AosStore(seed, { persistence: repository });
  const project = seed.projects.find((item) => item.id === "TCRN-AOS");
  store.upsertProject(project, actor);
  const initiativeTitle = "AOS Knowledge Retrieval Layer";
  const epicTitle = "KR-01 Schema and FTS migration";
  const storyTitle = "KR-01 additive knowledge schema and FTS proof";
  let initiative = store.listInitiatives().find((item) => item.title === initiativeTitle);
  if (!initiative) {
    initiative = store.createInitiative({
      projectId: "TCRN-AOS",
      title: initiativeTitle,
      status: "in_progress",
      problem: "AOS needs local-first knowledge retrieval storage.",
      expectedOutcome: "Knowledge entries are stored with taxonomy, FTS search, and bounded body size."
    }, actor);
  }
  let epic = store.listEpics().find((item) => item.title === epicTitle && item.initiativeId === initiative.id);
  if (!epic) {
    epic = store.createEpic({
      initiativeId: initiative.id,
      title: epicTitle,
      goal: "Prove additive schema, FTS search, durable-copy migration, and restart persistence.",
      status: "in_progress"
    }, actor);
  }
  let story = store.listStories().find((item) => item.title === storyTitle && item.epicId === epic.id);
  if (!story) {
    story = store.createStory({
      epicId: epic.id,
      title: storyTitle,
      problem: "Knowledge entries need a durable schema before method exposure.",
      user: "AOS knowledge operator",
      expectedBehavior: "Internal repository writes/searches entries without exposing KR-02 methods.",
      acceptanceCriteria: [
        "migration applies to fresh and copied durable profiles",
        "FTS5 or fallback search is available behind one repository interface",
        "1,501-word body is rejected with a structured error"
      ],
      status: "in_progress",
      estimate: { effortPoints: 3, complexity: "medium", risk: "L3", verificationCost: "medium", confidence: "high" },
      subTasks: []
    }, actor);
  }
  const commentBody = "KR-01 schema and FTS proof: additive SQLite repository layer only; no KR-02 method surface, frontend trigger, readiness, release, or owner-facing acceptance claim.";
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
  return {
    ok: Boolean(story.id && comment.id && commentAudit),
    profileScope: "proof_scratch_profile_no_live_durable_overwrite",
    initiativeId: initiative.id,
    epicId: epic.id,
    storyId: story.id,
    commentId: comment.id,
    commentBodyDigest: sha256(comment.body),
    commentAuditEventId: commentAudit?.id ?? null,
    rawPathRecorded: false
  };
}

function knowledgeEntry(overrides = {}) {
  return {
    id: "knowledge-kr01-proof-entry",
    title: "KR-01 knowledge proof entry",
    roleScope: "implementation",
    project: "TCRN-AOS",
    category: "knowledge-retrieval",
    knowledgeKind: "runbook_fact",
    status: "canonical",
    lastVerified: "2026-07-08",
    stalenessPolicy: "review_after_30_days",
    sourceRef: "workflow-plan-digest-reference",
    sourceDigest: "sha256:kr01-proof-source",
    tags: ["kr01", "sqlite", "fts"],
    summary: "KR-01 proof entry for schema, FTS, and restart persistence.",
    body: "KR-01 proof body.",
    ...overrides
  };
}

function words(count) {
  return Array.from({ length: count }, (_, index) => `word${index}`).join(" ");
}

function noCommittedArtifacts() {
  const result = spawnSync("git", ["-C", repoRoot, "ls-files"], { encoding: "utf8" });
  const tracked = result.stdout.split(/\r?\n/).filter(Boolean);
  const dbArtifacts = tracked.filter((file) => /\.(sqlite|sqlite3|db|db-wal|db-shm)$/i.test(file) && !file.startsWith(".codegraph/"));
  const backupArtifacts = tracked.filter((file) => /\.(jsonl|bak|backup)$/i.test(file));
  return {
    ok: result.status === 0 && dbArtifacts.length === 0 && backupArtifacts.length === 0,
    trackedDbArtifactCount: dbArtifacts.length,
    trackedBackupArtifactCount: backupArtifacts.length,
    excludedCodegraphOnly: true,
    rawPathRecorded: false
  };
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
  if (new RegExp(`${"rawDbDumpRecorded"}":true`).test(text)) {
    findings.push({ kind: "raw_db_dump_marker" });
  }
  const overclaimPattern = new RegExp(["readinessClaimed", "releaseReadinessClaimed", "ownerFacingAcceptanceClaimed"].map((key) => `${key}":true`).join("|"));
  if (overclaimPattern.test(text)) {
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
    schema: "aos.knowledge_retrieval_layer.kr01.v1",
    receiptName: name,
    ok: value.ok === true,
    generatedAt: "2026-07-08T00:00:00.000Z",
    route,
    workflowBasis,
    ownerDecisionWorkflowBasis,
    planBasis,
    incomingAosBasis,
    aosBasis: source.sourceHead,
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
    ownerDecisionWorkflowBasis,
    planBasis,
    sourceFiles,
    sourceContentDigest: sha256(stableJson(fileDigests)),
    fileDigests,
    command,
    durableProfileReadback: {
      profileRootClass: "owner_marker_durable_local_profile_root_copy_only",
      selectedRootDigest: sha256(durableRoot),
      databaseFileName: basename(durableDatabasePath),
      rawPathRecorded: false
    }
  };
}

function git(args) {
  const result = spawnSync("git", ["-C", repoRoot, ...args], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git_${args.join("_")}_failed`);
  }
  return result.stdout.trim();
}
