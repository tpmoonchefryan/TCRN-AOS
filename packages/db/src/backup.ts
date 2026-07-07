import { createHash } from "node:crypto";
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { sha256, stableJson } from "./sqlite-repository.js";

export const BK01_SNAPSHOT_MANIFEST_SCHEMA = "aos.bk01.physical_snapshot_manifest.v1";

export interface SqliteSnapshotManifest {
  schemaVersion: typeof BK01_SNAPSHOT_MANIFEST_SCHEMA;
  snapshotId: string;
  createdAt: string;
  purpose: string;
  sourceProfileDigest: string;
  sourceDatabaseDigest: string;
  snapshotDigest: string;
  routeDigest: string;
  profileDigest: string;
  snapshotPathDigest: string;
  snapshotFileName: string;
  manifestFileName: string;
  tableRowCounts: Record<string, number>;
  integrityCheck: SqliteIntegrityReadback;
  rawPathRecorded: false;
}

export interface SqlitePhysicalSnapshotReadback {
  ok: boolean;
  snapshotId: string;
  snapshotDigest: string;
  manifestDigest: string;
  manifest: SqliteSnapshotManifest;
  createdWith: "sqlite_vacuum_into";
  liveDatabaseFileCopiedDirectly: false;
}

export interface SqliteIntegrityReadback {
  ok: boolean;
  result: string;
}

export interface DailyRetentionReadback {
  ok: boolean;
  policy: "daily_keep_3";
  keepDaily: 3;
  retainedSnapshotIds: string[];
  evictedSnapshotIds: string[];
  retainedCount: number;
  evictedCount: number;
}

export interface RestoreDrillReadback {
  ok: boolean;
  restoredToScratchProfile: true;
  liveProfileOverwritten: false;
  snapshotId: string;
  restoredDatabaseDigest: string;
  restoredIntegrityCheck: SqliteIntegrityReadback;
  restoredTableRowCounts: Record<string, number>;
  scratchProfileDigest: string;
  rawPathRecorded: false;
}

export interface DailySnapshotCatchUpReadback {
  ok: boolean;
  due: boolean;
  reason: "no_prior_snapshot" | "latest_snapshot_older_than_interval" | "latest_snapshot_within_interval";
  intervalHours: number;
}

export function createSqlitePhysicalSnapshot(input: {
  sourceDatabasePath: string;
  snapshotPath: string;
  snapshotId: string;
  createdAt: string;
  purpose: string;
  sourceProfileDigest: string;
  routeId: string;
  profileId: string;
  forbiddenWorktreeRoots: string[];
}): SqlitePhysicalSnapshotReadback {
  const snapshotPath = resolve(input.snapshotPath);
  const sourceDatabasePath = resolve(input.sourceDatabasePath);
  const manifestPath = `${snapshotPath}.manifest.json`;
  assertNotInsideAnyWorktree(snapshotPath, input.forbiddenWorktreeRoots, "backup_snapshot_inside_git_worktree_denied");
  assertNotInsideAnyWorktree(manifestPath, input.forbiddenWorktreeRoots, "backup_manifest_inside_git_worktree_denied");
  assertNoExistingSymlink(snapshotPath, "backup_snapshot_symlink_denied");
  assertNoExistingSymlink(manifestPath, "backup_manifest_symlink_denied");
  if (existsSync(snapshotPath) || existsSync(manifestPath)) {
    throw new Error("backup_snapshot_target_exists");
  }
  mkdirSync(dirname(snapshotPath), { recursive: true });

  const source = new DatabaseSync(sourceDatabasePath);
  try {
    source.exec(`VACUUM INTO ${sqliteStringLiteral(snapshotPath)}`);
  } finally {
    source.close();
  }

  const integrityCheck = sqliteIntegrityCheck(snapshotPath);
  const manifest: SqliteSnapshotManifest = {
    schemaVersion: BK01_SNAPSHOT_MANIFEST_SCHEMA,
    snapshotId: input.snapshotId,
    createdAt: input.createdAt,
    purpose: input.purpose,
    sourceProfileDigest: input.sourceProfileDigest,
    sourceDatabaseDigest: digestFile(sourceDatabasePath),
    snapshotDigest: digestFile(snapshotPath),
    routeDigest: sha256(input.routeId),
    profileDigest: sha256(input.profileId),
    snapshotPathDigest: sha256(snapshotPath),
    snapshotFileName: basename(snapshotPath),
    manifestFileName: basename(manifestPath),
    tableRowCounts: readSqliteTableCounts(snapshotPath),
    integrityCheck,
    rawPathRecorded: false
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return {
    ok: integrityCheck.ok,
    snapshotId: input.snapshotId,
    snapshotDigest: manifest.snapshotDigest,
    manifestDigest: sha256(stableJson(manifest)),
    manifest,
    createdWith: "sqlite_vacuum_into",
    liveDatabaseFileCopiedDirectly: false
  };
}

export function applyDailyKeep3Retention(input: {
  backupDir: string;
  forbiddenWorktreeRoots: string[];
}): DailyRetentionReadback {
  const backupDir = resolve(input.backupDir);
  assertNotInsideAnyWorktree(backupDir, input.forbiddenWorktreeRoots, "backup_retention_inside_git_worktree_denied");
  if (!existsSync(backupDir)) {
    return {
      ok: true,
      policy: "daily_keep_3",
      keepDaily: 3,
      retainedSnapshotIds: [],
      evictedSnapshotIds: [],
      retainedCount: 0,
      evictedCount: 0
    };
  }
  const manifests = readdirSync(backupDir)
    .filter((name) => name.endsWith(".manifest.json"))
    .map((name) => readManifest(join(backupDir, name)))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.snapshotId.localeCompare(right.snapshotId));
  const evicted = manifests.slice(0, Math.max(0, manifests.length - 3));
  const retained = manifests.slice(Math.max(0, manifests.length - 3));
  for (const manifest of evicted) {
    const snapshotPath = join(backupDir, manifest.snapshotFileName);
    const manifestPath = join(backupDir, manifest.manifestFileName);
    rmSync(snapshotPath, { force: true });
    rmSync(manifestPath, { force: true });
  }
  return {
    ok: retained.length <= 3 && evicted.every((manifest) => !existsSync(join(backupDir, manifest.snapshotFileName))),
    policy: "daily_keep_3",
    keepDaily: 3,
    retainedSnapshotIds: retained.map((manifest) => manifest.snapshotId),
    evictedSnapshotIds: evicted.map((manifest) => manifest.snapshotId),
    retainedCount: retained.length,
    evictedCount: evicted.length
  };
}

export function restoreSnapshotToScratchProfile(input: {
  snapshotPath: string;
  scratchDatabasePath: string;
  scratchProfileRoot: string;
  liveDatabasePath: string;
  liveProfileRoot: string;
  snapshotId: string;
  forbiddenWorktreeRoots: string[];
}): RestoreDrillReadback {
  blockRestoreToLivePromotion({
    targetDatabasePath: input.scratchDatabasePath,
    targetProfileRoot: input.scratchProfileRoot,
    liveDatabasePath: input.liveDatabasePath,
    liveProfileRoot: input.liveProfileRoot
  });
  assertNotInsideAnyWorktree(input.scratchDatabasePath, input.forbiddenWorktreeRoots, "backup_restore_scratch_inside_git_worktree_denied");
  mkdirSync(dirname(input.scratchDatabasePath), { recursive: true });
  rmSync(input.scratchDatabasePath, { force: true });
  copyFileSync(input.snapshotPath, input.scratchDatabasePath);
  const restoredIntegrityCheck = sqliteIntegrityCheck(input.scratchDatabasePath);
  return {
    ok: restoredIntegrityCheck.ok,
    restoredToScratchProfile: true,
    liveProfileOverwritten: false,
    snapshotId: input.snapshotId,
    restoredDatabaseDigest: digestFile(input.scratchDatabasePath),
    restoredIntegrityCheck,
    restoredTableRowCounts: readSqliteTableCounts(input.scratchDatabasePath),
    scratchProfileDigest: sha256(resolve(input.scratchProfileRoot)),
    rawPathRecorded: false
  };
}

export function blockRestoreToLivePromotion(input: {
  targetDatabasePath: string;
  targetProfileRoot: string;
  liveDatabasePath: string;
  liveProfileRoot: string;
}): { ok: true; reason: "restore_to_live_profile_requires_owner_intent_route" } {
  const targetDatabasePath = resolve(input.targetDatabasePath);
  const targetProfileRoot = resolve(input.targetProfileRoot);
  const liveDatabasePath = resolve(input.liveDatabasePath);
  const liveProfileRoot = resolve(input.liveProfileRoot);
  if (targetDatabasePath === liveDatabasePath || targetProfileRoot === liveProfileRoot) {
    throw new Error("restore_to_live_profile_requires_owner_intent_route");
  }
  return { ok: true, reason: "restore_to_live_profile_requires_owner_intent_route" };
}

export function sqliteIntegrityCheck(databasePath: string): SqliteIntegrityReadback {
  const db = new DatabaseSync(resolve(databasePath));
  try {
    const row = db.prepare("PRAGMA integrity_check").get() as Record<string, unknown> | undefined;
    const result = row ? String(Object.values(row)[0]) : "missing_result";
    return { ok: result === "ok", result };
  } finally {
    db.close();
  }
}

export function readSqliteTableCounts(databasePath: string): Record<string, number> {
  const db = new DatabaseSync(resolve(databasePath));
  try {
    const tableNames = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'aos_%' ORDER BY name").all() as Array<{ name: string }>).map((row) => row.name);
    return Object.fromEntries(tableNames.map((table) => {
      const row = db.prepare(`SELECT count(*) as count FROM ${table}`).get() as { count: number };
      return [table, Number(row.count)];
    }));
  } finally {
    db.close();
  }
}

export function evaluateDailySnapshotCatchUp(input: {
  latestSnapshotAt: string | null;
  now: string;
  intervalHours?: number;
}): DailySnapshotCatchUpReadback {
  const intervalHours = input.intervalHours ?? 24;
  if (input.latestSnapshotAt === null) {
    return { ok: true, due: true, reason: "no_prior_snapshot", intervalHours };
  }
  const ageMs = Date.parse(input.now) - Date.parse(input.latestSnapshotAt);
  const due = ageMs >= intervalHours * 60 * 60 * 1000;
  return {
    ok: true,
    due,
    reason: due ? "latest_snapshot_older_than_interval" : "latest_snapshot_within_interval",
    intervalHours
  };
}

export function digestFile(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function readManifest(manifestPath: string): SqliteSnapshotManifest {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as SqliteSnapshotManifest;
  if (manifest.schemaVersion !== BK01_SNAPSHOT_MANIFEST_SCHEMA) {
    throw new Error("backup_manifest_schema_mismatch");
  }
  return manifest;
}

function assertNotInsideAnyWorktree(targetPath: string, roots: string[], reason: string): void {
  const target = resolve(targetPath);
  const existingAncestor = existingAncestorPath(target);
  const canonicalTargetParent = realpathSync(existingAncestor);
  const relativeFromAncestor = relative(existingAncestor, target).split(sep).filter(Boolean);
  const canonicalTarget = resolve(canonicalTargetParent, ...relativeFromAncestor);
  for (const root of roots) {
    const canonicalRoot = realpathSync(resolve(root));
    const relativeToRoot = relative(canonicalRoot, canonicalTarget);
    if (relativeToRoot === "" || (!relativeToRoot.startsWith("..") && !relativeToRoot.split(sep).includes(".."))) {
      throw new Error(reason);
    }
  }
}

function existingAncestorPath(targetPath: string): string {
  let current = resolve(targetPath);
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) {
      return current;
    }
    current = parent;
  }
  return current;
}

function assertNoExistingSymlink(path: string, reason: string): void {
  if (existsSync(path) && lstatSync(path).isSymbolicLink()) {
    throw new Error(reason);
  }
}

function sqliteStringLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
