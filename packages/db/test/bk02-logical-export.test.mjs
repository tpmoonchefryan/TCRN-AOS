import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AosSqliteRepository,
  createSqliteLogicalExport,
  importLogicalExportToScratchProfile,
  listBackupArtifacts,
  sha256
} from "../../../dist/packages/db/src/index.js";
import { AosStore, createDefaultSeed } from "../../../dist/packages/domain/src/index.js";
import { createRuntimeTransport } from "../../../dist/packages/mcp-server/src/index.js";
import { createWorkReadbackApiResponse } from "../../../dist/apps/api/src/work-readback.js";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const migrationsDir = fileURLToPath(new URL("../migrations/sqlite", import.meta.url));
const markerFile = ".tcrn-aos-phase1-root";
const route = "bk02-logical-export-test-route";
const profile = {
  route,
  markerVersion: "bk02-logical-export-test-profile.v1",
  purpose: "bk02_logical_export_test"
};
const ilyaActor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "bk02-logical-export-test"
};
const schedulerActor = {
  employeeId: "aos-service-scheduler",
  role: "owner_observer",
  threadId: "aos-service-scheduler-system",
  sessionId: "bk02-logical-export-test"
};

test("BK-02 logical exports use internal snapshots, round-trip into scratch profile, and expose bounded backup methods", async () => {
  const root = await mkdtemp(join(realpathSync(tmpdir()), "tcrn-aos-bk02-test-"));
  try {
    writeRuntimeMarker(root);
    const databasePath = join(root, "runtime.sqlite");
    const backupRoot = join(root, "backup");
    mkdirSync(backupRoot, { recursive: true });
    const repository = new AosSqliteRepository({ databasePath, migrationsDir });
    try {
      repository.applyMigrations();
      repository.seedAiEmployees(createDefaultSeed().employees, "bk02-test-seed");
      seedPopulatedProfile(repository);
      const sourceProfileDigest = repository.databaseDigest();
      const logical = createSqliteLogicalExport({
        sourceDatabasePath: databasePath,
        internalSnapshotPath: join(backupRoot, "bk02-test-internal-snapshot.sqlite"),
        exportDirectory: join(backupRoot, "logical-exports", "bk02-test-export"),
        exportId: "bk02-test-export",
        internalSnapshotId: "bk02-test-internal-snapshot",
        createdAt: "2026-07-08T00:00:00.000Z",
        purpose: "bk02_logical_export_test",
        sourceProfileDigest,
        routeId: route,
        profileId: "bk02-test-profile",
        forbiddenWorktreeRoots: [repoRoot]
      });
      assert.equal(logical.ok, true);
      assert.equal(logical.createdWith, "sqlite_vacuum_into_internal_snapshot");
      assert.equal(logical.liveDatabaseFileReadDirectly, false);
      assert.equal(logical.manifest.tableRowCounts.aos_stories > 0, true);

      const roundTrip = importLogicalExportToScratchProfile({
        exportDirectory: join(backupRoot, "logical-exports", "bk02-test-export"),
        manifestFileName: logical.manifest.manifestFileName,
        scratchDatabasePath: join(root, "scratch", "scratch.sqlite"),
        scratchProfileRoot: join(root, "scratch"),
        liveDatabasePath: databasePath,
        liveProfileRoot: root,
        migrationsDir,
        forbiddenWorktreeRoots: [repoRoot]
      });
      assert.equal(roundTrip.ok, true);
      assert.deepEqual(roundTrip.importedTableRowCounts, roundTrip.sourceTableRowCounts);
      assert.equal(Object.values(roundTrip.tableDigestMatches).every(Boolean), true);
    } finally {
      repository.close();
    }

    const schedulerRuntime = createRuntimeTransport(runtimeConfig(root, databasePath, schedulerActor));
    try {
      const policy = schedulerRuntime.transport.handleJsonRpc({ jsonrpc: "2.0", id: 1, method: "aos.policy.read", params: {} });
      assert.equal(policy.error, undefined);
      assert.equal(policy.result.transportAllowedMethods.includes("aos.backup.export.create"), true);
      assert.equal(policy.result.actorAuthoritySnapshot.canWrite, false);
      assert.equal(policy.result.actorAuthoritySnapshot.backupCreateAuthority, true);

      const snapshot = schedulerRuntime.transport.handleJsonRpc({
        jsonrpc: "2.0",
        id: 2,
        method: "aos.backup.snapshot.create",
        params: {
          snapshotId: "bk02-method-snapshot-test",
          createdAt: "2026-07-08T00:05:00.000Z",
          purpose: "bk02_method_surface_test",
          idempotencyKey: "bk02-method-snapshot-test"
        }
      });
      assert.equal(snapshot.error, undefined);
      assert.equal(snapshot.result.ok, true);
      assert.equal(snapshot.result.createdWith, "sqlite_vacuum_into");
      const snapshotReplay = schedulerRuntime.transport.handleJsonRpc({
        jsonrpc: "2.0",
        id: 3,
        method: "aos.backup.snapshot.create",
        params: {
          snapshotId: "bk02-method-snapshot-test",
          createdAt: "2026-07-08T00:05:00.000Z",
          purpose: "bk02_method_surface_test",
          idempotencyKey: "bk02-method-snapshot-test"
        }
      });
      assert.equal(snapshotReplay.result.status, "deduped");

      const exported = schedulerRuntime.transport.handleJsonRpc({
        jsonrpc: "2.0",
        id: 4,
        method: "aos.backup.export.create",
        params: {
          exportId: "bk02-method-export-test",
          createdAt: "2026-07-08T00:06:00.000Z",
          purpose: "bk02_method_surface_test",
          idempotencyKey: "bk02-method-export-test"
        }
      });
      assert.equal(exported.error, undefined);
      assert.equal(exported.result.ok, true);
      assert.equal(exported.result.liveDatabaseFileReadDirectly, false);

      const list = schedulerRuntime.transport.handleJsonRpc({ jsonrpc: "2.0", id: 5, method: "aos.backup.list", params: {} });
      assert.equal(list.error, undefined);
      assert.equal(list.result.ok, true);
      assert.equal(list.result.items.some((item) => item.id === "bk02-method-export-test" && item.kind === "logical_export"), true);
      assert.equal(JSON.stringify(list.result).includes(root), false);

      const schedulerTicketWrite = schedulerRuntime.transport.handleJsonRpc({
        jsonrpc: "2.0",
        id: 6,
        method: "aos.ticket.comment",
        params: { ticketId: "story-missing", type: "agent_observation", body: "not allowed" }
      });
      assert.equal(schedulerTicketWrite.result, undefined);
      assert.equal(schedulerTicketWrite.error.data.reason, "transport_actor_blocked_role");

      const readback = createWorkReadbackApiResponse(new AosStore(createDefaultSeed()), "/api/work/readback/backups", new URLSearchParams({ limit: "10" }), {
        backupListReadback: () => listBackupArtifacts({ backupDir: backupRoot, forbiddenWorktreeRoots: [repoRoot] })
      });
      assert.equal(readback.statusCode, 200);
      assert.equal(readback.body.ok, true);
      assert.equal(readback.body.method, "aos.backup.list");
      assert.equal(readback.body.items.some((item) => item.id === "bk02-method-export-test"), true);
      assert.equal(JSON.stringify(readback.body).includes(root), false);
    } finally {
      schedulerRuntime.close();
    }

    const ilyaRuntime = createRuntimeTransport(runtimeConfig(root, databasePath, ilyaActor));
    try {
      const denied = ilyaRuntime.transport.handleJsonRpc({
        jsonrpc: "2.0",
        id: 7,
        method: "aos.backup.export.create",
        params: { exportId: "bk02-denied-export", idempotencyKey: "bk02-denied-export" }
      });
      assert.equal(denied.result, undefined);
      assert.equal(denied.error.data.reason, "backup_create_actor_denied");
      const unknownBackupMethod = ilyaRuntime.transport.handleJsonRpc({ jsonrpc: "2.0", id: 8, method: "aos.backup.export.delete", params: {} });
      assert.equal(unknownBackupMethod.result, undefined);
      assert.equal(unknownBackupMethod.error.data.reason, "transport_method_unknown");
    } finally {
      ilyaRuntime.close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

function seedPopulatedProfile(repository) {
  const seed = createDefaultSeed();
  const store = new AosStore(seed, { persistence: repository });
  store.upsertProject(seed.projects.find((project) => project.id === "TCRN-AOS"), ilyaActor);
  const initiative = store.createInitiative({
    projectId: "TCRN-AOS",
    title: "BK-02 Logical Export Test",
    status: "in_progress",
    problem: "Logical backup export needs round-trip proof.",
    expectedOutcome: "JSONL rows can rebuild scratch profile digests."
  }, ilyaActor);
  const epic = store.createEpic({
    initiativeId: initiative.id,
    title: "BK-02",
    goal: "Prove logical export and import.",
    status: "in_progress"
  }, ilyaActor);
  const story = store.createStory({
    epicId: epic.id,
    title: "Round-trip logical export",
    problem: "Backups need logical portability proof.",
    user: "AOS operator",
    expectedBehavior: "Scratch import matches source table counts and digests.",
    acceptanceCriteria: ["internal snapshot", "jsonl export", "scratch import"],
    status: "in_progress",
    estimate: { effortPoints: 3, complexity: "medium", risk: "L3", verificationCost: "medium", confidence: "high" },
    subTasks: []
  }, ilyaActor);
  store.addComment({
    ticketId: story.id,
    type: "agent_observation",
    actor: ilyaActor,
    body: "BK-02 logical export test comment."
  }, ilyaActor);
}

function writeRuntimeMarker(root) {
  const marker = {
    ...profile,
    rootDigest: sha256(resolve(root))
  };
  writeFileSync(join(root, markerFile), `${JSON.stringify(marker, null, 2)}\n`, "utf8");
}

function runtimeConfig(root, databasePath, actor) {
  return {
    actor,
    databasePath,
    databaseRoot: root,
    repoRoot,
    routeOwnedMarkerFile: markerFile,
    runtimeProfileMarker: profile,
    migrationsDir,
    auditPageLimit: 5,
    maxResponseBytes: 16_384
  };
}
