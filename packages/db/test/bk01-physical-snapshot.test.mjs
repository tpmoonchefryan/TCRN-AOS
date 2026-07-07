import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AosSqliteRepository,
  applyDailyKeep3Retention,
  blockRestoreToLivePromotion,
  createSqlitePhysicalSnapshot,
  evaluateDailySnapshotCatchUp,
  restoreSnapshotToScratchProfile
} from "../../../dist/packages/db/src/index.js";
import { AosStore, createDefaultSeed } from "../../../dist/packages/domain/src/index.js";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const migrationsDir = fileURLToPath(new URL("../migrations/sqlite", import.meta.url));
const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "bk01-physical-snapshot-test"
};

test("BK-01 physical snapshots use VACUUM INTO, rotate daily_keep_3, and restore only to scratch", async () => {
  const root = await mkdtemp(join(tmpdir(), "tcrn-aos-bk01-test-"));
  const migrationRoot = await mkdtemp(join(tmpdir(), "tcrn-aos-bk01-migrations-"));
  try {
    const dbPath = join(root, "source.sqlite");
    const backupDir = join(root, "backup");
    const preMigrationBackupDir = join(root, "pre-migration-backup");
    const scratchRoot = join(root, "scratch-profile");
    const scratchDbPath = join(scratchRoot, "restore.sqlite");
    mkdirSync(backupDir, { recursive: true });
    mkdirSync(preMigrationBackupDir, { recursive: true });
    await writeFile(join(migrationRoot, "0001_phase1_core.sql"), await readFile(join(migrationsDir, "0001_phase1_core.sql"), "utf8"));
    await writeFile(join(migrationRoot, "0002_bk01_noop.sql"), "-- BK-01 no-op migration proof\nSELECT 1;\n");

    const repository = new AosSqliteRepository({ databasePath: dbPath, migrationsDir: migrationRoot });
    const preMigrationSnapshots = [];
    const migration = repository.applyMigrations({
      preMigrationSnapshot(input) {
        const snapshot = createSqlitePhysicalSnapshot({
          sourceDatabasePath: dbPath,
          snapshotPath: join(preMigrationBackupDir, `pre-${input.version}.sqlite`),
          snapshotId: `pre-${input.version}`,
          createdAt: `2026-07-0${input.pendingIndex}T00:00:00.000Z`,
          purpose: "bk01_pre_migration_snapshot_test",
          sourceProfileDigest: repository.databaseDigest(),
          routeId: "bk01-test-route",
          profileId: "bk01-test-profile",
          forbiddenWorktreeRoots: [repoRoot]
        });
        preMigrationSnapshots.push(snapshot);
        return { ok: snapshot.ok, snapshotId: snapshot.snapshotId, manifestDigest: snapshot.manifestDigest };
      }
    });
    assert.equal(migration.appliedCount, 2);
    assert.equal(migration.preMigrationSnapshots.length, 2);
    assert.equal(preMigrationSnapshots.every((snapshot) => snapshot.createdWith === "sqlite_vacuum_into"), true);

    const store = new AosStore(createDefaultSeed(), { persistence: repository });
    store.upsertProject(createDefaultSeed().projects.find((project) => project.id === "TCRN-AOS"), actor);
    const initiative = store.createInitiative({
      projectId: "TCRN-AOS",
      title: "BK-01 Snapshot Test",
      status: "in_progress",
      problem: "Physical snapshots need safe SQLite backup semantics.",
      expectedOutcome: "Daily snapshots can be restored to a scratch profile."
    }, actor);
    const epic = store.createEpic({ initiativeId: initiative.id, title: "BK-01", goal: "Snapshot and restore drill", status: "in_progress" }, actor);
    store.createStory({
      epicId: epic.id,
      title: "Run restore drill",
      problem: "Backups need practical restore proof.",
      user: "AOS operator",
      expectedBehavior: "Scratch restore succeeds without overwriting live profile.",
      acceptanceCriteria: ["snapshot", "integrity", "scratch restore"],
      status: "in_progress",
      estimate: { effortPoints: 2, complexity: "medium", risk: "L3", verificationCost: "medium", confidence: "high" },
      subTasks: []
    }, actor);

    const dailySnapshots = [];
    for (let day = 1; day <= 4; day += 1) {
      dailySnapshots.push(createSqlitePhysicalSnapshot({
        sourceDatabasePath: dbPath,
        snapshotPath: join(backupDir, `daily-2026-07-0${day}.sqlite`),
        snapshotId: `daily-2026-07-0${day}`,
        createdAt: `2026-07-0${day}T00:00:00.000Z`,
        purpose: "bk01_daily_snapshot_test",
        sourceProfileDigest: repository.databaseDigest(),
        routeId: "bk01-test-route",
        profileId: "bk01-test-profile",
        forbiddenWorktreeRoots: [repoRoot]
      }));
    }
    assert.equal(dailySnapshots.every((snapshot) => snapshot.ok), true);

    const retention = applyDailyKeep3Retention({ backupDir, forbiddenWorktreeRoots: [repoRoot] });
    assert.equal(retention.ok, true);
    assert.deepEqual(retention.evictedSnapshotIds, ["daily-2026-07-01"]);
    assert.deepEqual(retention.retainedSnapshotIds, ["daily-2026-07-02", "daily-2026-07-03", "daily-2026-07-04"]);
    assert.equal(existsSync(join(backupDir, "daily-2026-07-01.sqlite")), false);

    const restore = restoreSnapshotToScratchProfile({
      snapshotPath: join(backupDir, "daily-2026-07-04.sqlite"),
      scratchDatabasePath: scratchDbPath,
      scratchProfileRoot: scratchRoot,
      liveDatabasePath: dbPath,
      liveProfileRoot: root,
      snapshotId: "daily-2026-07-04",
      forbiddenWorktreeRoots: [repoRoot]
    });
    assert.equal(restore.ok, true);
    assert.equal(restore.restoredToScratchProfile, true);
    assert.equal(restore.liveProfileOverwritten, false);
    assert.deepEqual(restore.restoredTableRowCounts, dailySnapshots[3].manifest.tableRowCounts);
    assert.throws(() => blockRestoreToLivePromotion({
      targetDatabasePath: dbPath,
      targetProfileRoot: root,
      liveDatabasePath: dbPath,
      liveProfileRoot: root
    }), /restore_to_live_profile_requires_owner_intent_route/);

    assert.equal(evaluateDailySnapshotCatchUp({ latestSnapshotAt: null, now: "2026-07-01T00:00:00.000Z" }).due, true);
    assert.equal(evaluateDailySnapshotCatchUp({
      latestSnapshotAt: "2026-07-01T00:00:00.000Z",
      now: "2026-07-02T00:00:00.000Z"
    }).due, true);
    assert.equal(evaluateDailySnapshotCatchUp({
      latestSnapshotAt: "2026-07-02T00:00:00.000Z",
      now: "2026-07-02T12:00:00.000Z"
    }).due, false);
    repository.close();
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(migrationRoot, { recursive: true, force: true });
  }
});
