import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import {
  AosSqliteRepository,
  assertRouteOwnedSqliteRoot,
  phase1CoreTables,
  phase1ExcludedRuntimeTables,
  sha256
} from "../dist/packages/db/src/index.js";
import { AosStore, createDefaultSeed } from "../dist/packages/domain/src/index.js";
import { McpGateway } from "../dist/packages/mcp-gateway/src/index.js";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
// The thread registry this proof projected employees from lived in a sibling
// `TCRN Workflow` directory that was archived to a private Legacy repository and
// deleted on 2026-07-20 — deliberately, so that a second and older governance tree
// could not be read and acted on by mistake. It is not coming back, and cloning it
// to satisfy this script would reinstate exactly the hazard that deletion removed.
//
// Ten of this script's eleven receipts assert live database behaviour and need no
// registry at all; only thread-registry-seed-proof.json did. Reading a file that
// cannot exist killed the script at line 44 and took the other ten down with it
// (TCRN-AOS-INC-002). So the registry projection is now conditional on a registry
// being supplied, and its absence is recorded as an absence rather than passed off
// as a projection that ran. Supply one with
// TCRN_AOS_THREAD_REGISTRY=/path/to/long-lived-threads.json to exercise that path;
// packages/db/test/phase1-sqlite-repository.test.mjs covers projectThreadRegistryEmployees
// against a fixture regardless.
const threadRegistryPath = process.env.TCRN_AOS_THREAD_REGISTRY;
const migrationsDir = join(repoRoot, "packages/db/migrations/sqlite");
const evidenceRoot = join(repoRoot, "evidence/phase1-persistence");
const forbiddenPathPattern = /\/Users\/|\/tmp\/|\/private\/tmp\/|\/srv\/tcrn|file:\/\//;

if (process.argv[2] === "--lock-worker") {
  runLockWorker(process.argv[3], Number(process.argv[4]), Number(process.argv[5] ?? 10));
} else {
  await runProof();
}

async function runProof() {
  mkdirSync(evidenceRoot, { recursive: true });
  const tempRoot = await mkdtemp(join(tmpdir(), "tcrn-aos-phase1-"));
  const markerFile = ".tcrn-aos-phase1-root";
  writeFileSync(join(tempRoot, markerFile), "owned-by-phase1-proof\n", "utf8");
  const dbPath = join(tempRoot, "phase1.sqlite");
  const receiptPaths = [];
  try {
    const rootReadback = assertRouteOwnedSqliteRoot(tempRoot, repoRoot, markerFile);
    const repository = new AosSqliteRepository({ databasePath: dbPath, migrationsDir });
    const firstMigration = repository.applyMigrations();
    const secondMigration = repository.applyMigrations();
    const staticSeed = repository.seedAiEmployees(createDefaultSeed().employees, "aos-static-seed");
    const registrySeed = projectThreadRegistryIfSupplied(repository);
    seedProjects(repository);

    const migrationReceipt = {
      ok: firstMigration.ok && secondMigration.appliedCount === 0,
      migrationFiles: firstMigration.migrations.map((migration) => ({ version: migration.version, digest: migration.digest })),
      firstApply: { migrationCount: firstMigration.migrationCount, appliedCount: firstMigration.appliedCount },
      secondApply: { migrationCount: secondMigration.migrationCount, appliedCount: secondMigration.appliedCount },
      pragmas: firstMigration.pragmas,
      root: {
        routeOwned: true,
        outsideGit: true,
        markerFile,
        rootDigest: rootReadback.rootDigest,
        rawPathRecorded: false
      },
      idempotentNoop: secondMigration.appliedCount === 0
    };
    receiptPaths.push(writeReceipt("sqlite-migration-validation.json", migrationReceipt));

    const tables = repository.tableNames();
    const coreReceipt = {
      ok: phase1CoreTables.every((table) => tables.includes(table)) &&
        phase1ExcludedRuntimeTables.every((table) => !tables.includes(table)),
      persistedCoreTables: phase1CoreTables,
      allowedMetadataTables: ["aos_schema_migrations"],
      actualAosTables: tables,
      excludedRuntimeTablesAbsent: phase1ExcludedRuntimeTables.every((table) => !tables.includes(table)),
      broadStaticTablesPersisted: false,
      phase2TransportPersisted: false
    };
    receiptPaths.push(writeReceipt("core-table-contract.json", coreReceipt));

    const actor = {
      employeeId: "employee-ilya",
      role: "implementation",
      threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
      sessionId: "phase1-persistence-proof"
    };
    const store = new AosStore(createDefaultSeed(), { persistence: repository });
    const gateway = new McpGateway(store);
    const initiativeResponse = gateway.handle({
      method: "aos.ticket.propose",
      actor,
      params: {
        ticketType: "initiative",
        projectId: "TCRN-AOS",
        title: "Phase 1 SQLite Persistence",
        problem: "AOS core records need restart-safe local persistence.",
        expectedOutcome: "Core operational records hydrate from SQLite without live dispatch."
      },
      idempotencyKey: "phase1-init"
    });
    assert.equal(initiativeResponse.ok, true);
    const epicResponse = gateway.handle({
      method: "aos.ticket.propose",
      actor,
      params: {
        ticketType: "epic",
        initiativeId: initiativeResponse.result.id,
        title: "SQLite repository boundary",
        goal: "Persist the core 11 AOS tables only."
      },
      idempotencyKey: "phase1-epic"
    });
    assert.equal(epicResponse.ok, true);
    const storyResponse = gateway.handle({
      method: "aos.ticket.propose",
      actor,
      params: {
        ticketType: "story",
        epicId: epicResponse.result.id,
        title: "Restart-safe story traceability",
        problem: "In-memory stories cannot survive a local restart.",
        user: "AI implementation operator",
        expectedBehavior: "Story traceability survives restart from route-owned SQLite.",
        acceptanceCriteria: ["migration", "write-through", "hydrate", "traceability"],
        estimate: { effortPoints: 5, complexity: "high", risk: "L3", verificationCost: "high", confidence: "medium" },
        subTasks: []
      },
      idempotencyKey: "phase1-story"
    });
    assert.equal(storyResponse.ok, true);
    const story = storyResponse.result;
    const subtask = store.addSubTask(story.id, {
      id: "subtask-phase1-sqlite-proof",
      title: "Prove SQLite persistence",
      ownerRole: "implementation",
      status: "in_progress",
      dependencyIds: [],
      proofExpectation: "phase1:persistence-proof"
    }, actor);
    const assignment = store.createAssignment({
      employeeId: actor.employeeId,
      targetId: story.id,
      targetType: "story",
      role: "implementation",
      status: "in_progress",
      dueState: "none",
      proofExpectation: "phase1:persistence-proof"
    }, actor);
    const nonStoryAssignmentCollision = store.createAssignment({
      employeeId: actor.employeeId,
      targetId: story.id,
      targetType: "gate",
      role: "implementation",
      status: "in_progress",
      dueState: "none",
      proofExpectation: "phase1 trace collision exclusion"
    }, actor);
    const run = store.recordAgentRun({
      assignmentId: assignment.id,
      status: "success",
      startedAt: "2026-07-05T00:00:00.000Z",
      endedAt: "2026-07-05T00:01:00.000Z",
      readback: "phase1 metadata-only proof",
      outputSummary: "SQLite core write-through proof"
    }, actor);
    const evidenceResponse = gateway.handle({
      method: "aos.evidence.link",
      actor,
      params: {
        type: "artifact_id",
        target: "phase1-persistence-proof-summary",
        digest: "sha256:phase1-persistence-proof",
        redactionState: "metadata_only"
      },
      idempotencyKey: "phase1-evidence"
    });
    assert.equal(evidenceResponse.ok, true);
    const gateResponse = gateway.handle({
      method: "aos.gate.request",
      actor,
      params: {
        type: "evidence_proof",
        linkedTicketId: story.id,
        inputEvidenceIds: [evidenceResponse.result.id]
      },
      idempotencyKey: "phase1-gate"
    });
    assert.equal(gateResponse.ok, true);

    const schemaIntegrity = repository.schemaIntegrityReadback();
    receiptPaths.push(writeReceipt("sqlite-schema-integrity-proof.json", schemaIntegrity));

    const digestBeforeRestart = repository.databaseDigest();
    const countsBeforeRestart = repository.tableCounts();
    const appendOnly = repository.rejectAuditMutationForProof();
    receiptPaths.push(writeReceipt("audit-append-only-proof.json", {
      ok: appendOnly.updateRejected && appendOnly.deleteRejected && appendOnly.beforeDigest === appendOnly.afterDigest && appendOnly.beforeCount === appendOnly.afterCount,
      appLayerAppendOnly: true,
      sqliteTriggerUpdateRejected: appendOnly.updateRejected,
      sqliteTriggerDeleteRejected: appendOnly.deleteRejected,
      beforeCount: appendOnly.beforeCount,
      afterCount: appendOnly.afterCount,
      digestUnchanged: appendOnly.beforeDigest === appendOnly.afterDigest,
      rollbackEvidence: "failed mutation statement aborted by SQLite trigger"
    }));

    const trace = repository.traceStory(story.id);
    receiptPaths.push(writeReceipt("story-traceability-join-proof.json", {
      ok: trace.subtaskIds.includes(subtask.id) &&
        trace.assignmentIds.includes(assignment.id) &&
        !trace.assignmentIds.includes(nonStoryAssignmentCollision.id) &&
        trace.agentRunIds.includes(run.id) &&
        trace.evidenceIds.includes(evidenceResponse.result.id) &&
        trace.gateIds.includes(gateResponse.result.id) &&
        trace.auditEventIds.length > 0,
      storyId: story.id,
      collisionFixture: {
        nonStoryAssignmentId: nonStoryAssignmentCollision.id,
        targetIdSharedWithStory: true,
        targetType: nonStoryAssignmentCollision.targetType,
        excludedFromStoryTrace: !trace.assignmentIds.includes(nonStoryAssignmentCollision.id)
      },
      trace
    }));

    repository.close();
    const restarted = new AosSqliteRepository({ databasePath: dbPath, migrationsDir });
    restarted.applyMigrations();
    const restartedStore = new AosStore(createDefaultSeed(), { persistence: restarted });
    const digestAfterRestart = restarted.databaseDigest();
    const hydratedStory = restartedStore.listStories().find((item) => item.id === story.id);
    const hydratedTrace = restarted.traceStory(story.id);
    receiptPaths.push(writeReceipt("repository-write-through-hydrate-proof.json", {
      ok: Boolean(hydratedStory) &&
        digestBeforeRestart === digestAfterRestart &&
        hydratedTrace.assignmentIds.includes(assignment.id) &&
        hydratedTrace.agentRunIds.includes(run.id),
      createdIds: {
        initiativeId: initiativeResponse.result.id,
        epicId: epicResponse.result.id,
        storyId: story.id,
        subtaskId: subtask.id,
        assignmentId: assignment.id,
        agentRunId: run.id,
        evidenceId: evidenceResponse.result.id,
        gateId: gateResponse.result.id
      },
      countsBeforeRestart,
      countsAfterHydrate: restarted.tableCounts(),
      digestBeforeRestart,
      digestAfterRestart,
      gatewayVisibleWrites: ["aos.ticket.propose", "aos.evidence.link", "aos.gate.request"],
      domainWrites: ["addSubTask", "createAssignment", "recordAgentRun"]
    }));
    receiptPaths.push(writeReceipt("kill-restart-proof.json", {
      ok: digestBeforeRestart === digestAfterRestart && Boolean(hydratedStory),
      root: {
        routeOwned: true,
        outsideGit: true,
        markerFile,
        rootDigest: rootReadback.rootDigest,
        rawPathRecorded: false
      },
      preRestartDigest: digestBeforeRestart,
      postRestartDigest: digestAfterRestart,
      auditSurvived: restarted.tableCounts().aos_audit_events > 0,
      controlledStop: "repository.close",
      controlledRestart: "new AosSqliteRepository same route-owned db path",
      cleanupReadback: "pending_finally_cleanup"
    }));

    const contention = await runLockContention(dbPath);
    receiptPaths.push(writeReceipt("sqlite-lock-contention-proof.json", contention));

    receiptPaths.push(writeReceipt("thread-registry-seed-proof.json", {
      ...registrySeed,
      staticSeedRowCount: staticSeed.rowCount,
      workflowMutation: false,
      rawThreadMessagesStored: false,
      rawPromptsStored: false,
      localPathStored: false
    }));

    receiptPaths.push(writeReceipt("verify-fast-readback.json", {
      ok: true,
      command: "pnpm verify:fast",
      disposition: "route_validation_command_recorded_separately_after_phase1_persistence_proof",
      proofScript: "phase1:persistence-proof",
      routeValidationRequired: true,
      noAcceptanceClaim: true
    }));

    const receiptNames = [
      ...receiptPaths.map((receipt) => receipt.split("/").at(-1)),
      "phase1-persistence-proof-summary.json"
    ];
    restarted.close();
    const summary = {
      ok: receiptPaths.every((receipt) => JSON.parse(readFileSync(receipt, "utf8")).ok !== false),
      generatedAt: new Date().toISOString(),
      phase1PersistenceDisposition: "implemented_bounded_sqlite_core_persistence",
      coreTables: phase1CoreTables,
      excludedRuntimeTables: phase1ExcludedRuntimeTables,
      receiptCount: receiptNames.length,
      receipts: receiptNames,
      noOverclaim: {
        phase1AcceptanceClaimed: false,
        productAcceptanceClaimed: false,
        ownerAcceptanceClaimed: false,
        releasePublicationPushClaimed: false,
        liveDispatchClaimed: false,
        vmResourceMutationClaimed: false
      }
    };
    receiptPaths.push(writeReceipt("phase1-persistence-proof-summary.json", summary));

    const privacy = scanEvidencePrivacy();
    if (!privacy.ok) {
      throw new Error(`phase1_receipt_privacy_scan_failed:${privacy.matches.join(",")}`);
    }
    console.log(JSON.stringify({
      ok: true,
      receiptRoot: "evidence/phase1-persistence",
      receiptCount: receiptPaths.length,
      coreTables: phase1CoreTables.length,
      excludedRuntimeTablesAbsent: coreReceipt.excludedRuntimeTablesAbsent,
      databaseDigest: digestAfterRestart,
      contention: {
        attempted: contention.attemptedWrites,
        succeeded: contention.successfulWrites,
        unrecoverable: contention.unrecoverableErrors
      }
    }, null, 2));
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function seedProjects(repository) {
  for (const project of createDefaultSeed().projects) {
    repository.saveCoreRecord("project", project);
  }
}

async function runLockContention(dbPath) {
  const workerCount = 4;
  const writesPerWorker = 10;
  const workers = await Promise.all(Array.from({ length: workerCount }, (_, index) => spawnWorker(dbPath, index, writesPerWorker)));
  const attemptedWrites = workerCount * writesPerWorker;
  const successfulWrites = workers.reduce((sum, worker) => sum + worker.successfulWrites, 0);
  const retryableBusyErrors = workers.reduce((sum, worker) => sum + worker.retryableBusyErrors, 0);
  const unrecoverableErrors = workers.flatMap((worker) => worker.unrecoverableErrors);
  return {
    ok: successfulWrites === attemptedWrites && unrecoverableErrors.length === 0,
    mode: "child_process_multi_connection_wal_writers",
    workerCount,
    writesPerWorker,
    attemptedWrites,
    successfulWrites,
    retryableBusyErrors,
    unrecoverableErrors,
    zeroLostWrites: successfulWrites === attemptedWrites,
    terminalLockState: false,
    retryPolicy: "bounded retry on SQLITE_BUSY/database is locked"
  };
}

function spawnWorker(dbPath, workerIndex, writesPerWorker) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), "--lock-worker", dbPath, String(workerIndex), String(writesPerWorker)], {
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("exit", (code) => {
      if (code !== 0) {
        rejectPromise(new Error(`lock worker ${workerIndex} failed: ${stderr}`));
        return;
      }
      resolvePromise(JSON.parse(stdout));
    });
  });
}

function runLockWorker(dbPath, workerIndex, writesPerWorker) {
  const database = new DatabaseSync(dbPath);
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("PRAGMA journal_mode = WAL");
  database.exec("PRAGMA busy_timeout = 5000");
  let successfulWrites = 0;
  let retryableBusyErrors = 0;
  const unrecoverableErrors = [];
  for (let index = 0; index < writesPerWorker; index += 1) {
    const event = {
      id: `audit_lock_${workerIndex}_${index}_${process.pid}`,
      actor: { system: "phase1-lock-contention-proof" },
      action: "phase1.lock_contention.write",
      targetType: "lock_contention",
      targetId: `worker_${workerIndex}`,
      timestamp: new Date().toISOString(),
      outcome: "accepted",
      policyVersion: "phase1-proof",
      details: { workerIndex, index }
    };
    const written = retry(() => {
      database.prepare(`
        INSERT INTO aos_audit_events(id, target_type, target_id, action, outcome, actor_ref, timestamp, record_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(event.id, event.targetType, event.targetId, event.action, event.outcome, event.actor.system, event.timestamp, JSON.stringify(event));
    });
    if (written.ok) {
      successfulWrites += 1;
      retryableBusyErrors += written.retries;
    } else {
      unrecoverableErrors.push(written.error);
    }
  }
  database.close();
  process.stdout.write(JSON.stringify({ successfulWrites, retryableBusyErrors, unrecoverableErrors }));
}

function retry(operation) {
  let retries = 0;
  for (;;) {
    try {
      operation();
      return { ok: true, retries };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/SQLITE_BUSY|database is locked/i.test(message) || retries >= 20) {
        return { ok: false, retries, error: "retryable_lock_exhausted" };
      }
      retries += 1;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    }
  }
}

/**
 * Project a thread registry only if one was supplied. The registry that used to feed
 * this lived in the retired `TCRN Workflow` sibling; with no registry there is nothing
 * to project, and the receipt says so rather than reporting a projection of zero rows
 * as though the source had been read and found empty. Not-read and empty are different
 * facts, and the receipt has to be able to tell them apart.
 */
function projectThreadRegistryIfSupplied(repository) {
  if (!threadRegistryPath) {
    return {
      ok: true,
      registryRead: false,
      sourceTruth: "none — no thread registry supplied; the legacy sibling that held one was retired on 2026-07-20",
      disposition: "set TCRN_AOS_THREAD_REGISTRY to a long-lived-threads.json to exercise the projection",
      projectionPerformed: false,
      rowCount: 0,
      insertedCount: 0
    };
  }
  const registrySource = readFileSync(threadRegistryPath, "utf8");
  const registryDigest = sha256(registrySource);
  return {
    ...repository.projectThreadRegistryEmployees(JSON.parse(registrySource), registryDigest).readback,
    registryRead: true,
    sourceTruth: "Workflow registry read-only projection",
    projectionPerformed: true
  };
}

function writeReceipt(name, value) {
  const json = stableJson(value);
  if (forbiddenPathPattern.test(json)) {
    throw new Error(`receipt_contains_forbidden_local_path:${name}`);
  }
  const path = join(evidenceRoot, name);
  writeFileSync(path, `${json}\n`, "utf8");
  return path;
}

function scanEvidencePrivacy() {
  const matches = [];
  for (const name of [
    "sqlite-migration-validation.json",
    "core-table-contract.json",
    "audit-append-only-proof.json",
    "sqlite-schema-integrity-proof.json",
    "repository-write-through-hydrate-proof.json",
    "kill-restart-proof.json",
    "story-traceability-join-proof.json",
    "sqlite-lock-contention-proof.json",
    "thread-registry-seed-proof.json",
    "verify-fast-readback.json",
    "phase1-persistence-proof-summary.json"
  ]) {
    const text = readFileSync(join(evidenceRoot, name), "utf8");
    if (forbiddenPathPattern.test(text)) {
      matches.push(name);
    }
  }
  return { ok: matches.length === 0, matches };
}

function stableJson(value) {
  return JSON.stringify(value, Object.keys(flattenKeys(value)).sort(), 2);
}

function flattenKeys(value, keys = {}) {
  if (Array.isArray(value)) {
    value.forEach((item) => flattenKeys(item, keys));
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      keys[key] = true;
      flattenKeys(child, keys);
    }
  }
  return keys;
}
