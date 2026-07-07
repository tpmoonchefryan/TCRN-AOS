import { createHash } from "node:crypto";
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { phase1CoreTables, AosSqliteRepository } from "./sqlite-repository.js";
import { sha256, stableJson } from "./sqlite-repository.js";

export const BK01_SNAPSHOT_MANIFEST_SCHEMA = "aos.bk01.physical_snapshot_manifest.v1";
export const BK02_LOGICAL_EXPORT_MANIFEST_SCHEMA = "aos.bk02.logical_export_manifest.v1";

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

export interface LogicalExportTableManifest {
  tableName: string;
  fileName: string;
  columns: string[];
  rowCount: number;
  rowDigest: string;
  fileDigest: string;
}

export interface SqliteLogicalExportManifest {
  schemaVersion: typeof BK02_LOGICAL_EXPORT_MANIFEST_SCHEMA;
  exportId: string;
  createdAt: string;
  purpose: string;
  sourceSnapshotId: string;
  sourceSnapshotDigest: string;
  sourceProfileDigest: string;
  sourceDatabaseDigest: string;
  exportDigest: string;
  routeDigest: string;
  profileDigest: string;
  exportRootDigest: string;
  exportDirectoryName: string;
  manifestFileName: string;
  snapshotCreatedWith: "sqlite_vacuum_into";
  liveDatabaseReadDirectly: false;
  tableRowCounts: Record<string, number>;
  tableManifests: LogicalExportTableManifest[];
  rawPathRecorded: false;
}

export interface SqliteLogicalExportReadback {
  ok: boolean;
  exportId: string;
  exportDigest: string;
  manifestDigest: string;
  manifest: SqliteLogicalExportManifest;
  internalSnapshot: SqlitePhysicalSnapshotReadback;
  createdWith: "sqlite_vacuum_into_internal_snapshot";
  liveDatabaseFileReadDirectly: false;
}

export interface LogicalImportRoundTripReadback {
  ok: boolean;
  exportId: string;
  importedToScratchProfile: true;
  liveProfileOverwritten: false;
  sourceTableRowCounts: Record<string, number>;
  importedTableRowCounts: Record<string, number>;
  tableDigestMatches: Record<string, boolean>;
  importedTableDigests: Record<string, string>;
  exportedTableDigests: Record<string, string>;
  importedIntegrityCheck: SqliteIntegrityReadback;
  scratchProfileDigest: string;
  rawPathRecorded: false;
}

export interface BackupListItem {
  id: string;
  kind: "physical_snapshot" | "logical_export";
  createdAt: string;
  purpose: string;
  digest: string;
  manifestDigest: string;
  tableRowCounts: Record<string, number>;
  rawPathRecorded: false;
}

export interface BackupListReadback {
  ok: boolean;
  method: "aos.backup.list";
  items: BackupListItem[];
  returnedCount: number;
  fullGatewayMethodListExposed: false;
  rawPathRecorded: false;
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

export function createSqliteLogicalExport(input: {
  sourceDatabasePath: string;
  internalSnapshotPath: string;
  exportDirectory: string;
  exportId: string;
  internalSnapshotId: string;
  createdAt: string;
  purpose: string;
  sourceProfileDigest: string;
  routeId: string;
  profileId: string;
  forbiddenWorktreeRoots: string[];
}): SqliteLogicalExportReadback {
  const exportDirectory = resolve(input.exportDirectory);
  const manifestPath = join(exportDirectory, `${input.exportId}.manifest.json`);
  assertNotInsideAnyWorktree(exportDirectory, input.forbiddenWorktreeRoots, "backup_logical_export_inside_git_worktree_denied");
  assertNotInsideAnyWorktree(manifestPath, input.forbiddenWorktreeRoots, "backup_logical_export_manifest_inside_git_worktree_denied");
  assertNoExistingSymlink(exportDirectory, "backup_logical_export_symlink_denied");
  assertNoExistingSymlink(manifestPath, "backup_logical_export_manifest_symlink_denied");
  if (existsSync(exportDirectory) || existsSync(manifestPath)) {
    throw new Error("backup_logical_export_target_exists");
  }
  mkdirSync(exportDirectory, { recursive: true });

  const internalSnapshot = createSqlitePhysicalSnapshot({
    sourceDatabasePath: input.sourceDatabasePath,
    snapshotPath: input.internalSnapshotPath,
    snapshotId: input.internalSnapshotId,
    createdAt: input.createdAt,
    purpose: "bk02_internal_snapshot_for_logical_export",
    sourceProfileDigest: input.sourceProfileDigest,
    routeId: input.routeId,
    profileId: input.profileId,
    forbiddenWorktreeRoots: input.forbiddenWorktreeRoots
  });
  const tableManifests = exportLogicalTables({
    snapshotDatabasePath: input.internalSnapshotPath,
    exportDirectory,
    forbiddenWorktreeRoots: input.forbiddenWorktreeRoots
  });
  const exportDigest = sha256(stableJson(tableManifests.map((table) => ({
    tableName: table.tableName,
    rowCount: table.rowCount,
    rowDigest: table.rowDigest,
    fileDigest: table.fileDigest
  }))));
  const manifest: SqliteLogicalExportManifest = {
    schemaVersion: BK02_LOGICAL_EXPORT_MANIFEST_SCHEMA,
    exportId: input.exportId,
    createdAt: input.createdAt,
    purpose: input.purpose,
    sourceSnapshotId: input.internalSnapshotId,
    sourceSnapshotDigest: internalSnapshot.snapshotDigest,
    sourceProfileDigest: input.sourceProfileDigest,
    sourceDatabaseDigest: internalSnapshot.manifest.sourceDatabaseDigest,
    exportDigest,
    routeDigest: sha256(input.routeId),
    profileDigest: sha256(input.profileId),
    exportRootDigest: sha256(exportDirectory),
    exportDirectoryName: basename(exportDirectory),
    manifestFileName: basename(manifestPath),
    snapshotCreatedWith: internalSnapshot.createdWith,
    liveDatabaseReadDirectly: false,
    tableRowCounts: Object.fromEntries(tableManifests.map((table) => [table.tableName, table.rowCount])),
    tableManifests,
    rawPathRecorded: false
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return {
    ok: internalSnapshot.ok && tableManifests.every((table) => table.rowCount >= 0),
    exportId: input.exportId,
    exportDigest,
    manifestDigest: sha256(stableJson(manifest)),
    manifest,
    internalSnapshot,
    createdWith: "sqlite_vacuum_into_internal_snapshot",
    liveDatabaseFileReadDirectly: false
  };
}

export function importLogicalExportToScratchProfile(input: {
  exportDirectory: string;
  manifestFileName: string;
  scratchDatabasePath: string;
  scratchProfileRoot: string;
  liveDatabasePath: string;
  liveProfileRoot: string;
  migrationsDir?: string;
  forbiddenWorktreeRoots: string[];
}): LogicalImportRoundTripReadback {
  const exportDirectory = resolve(input.exportDirectory);
  const manifest = readLogicalExportManifest(join(exportDirectory, input.manifestFileName));
  blockRestoreToLivePromotion({
    targetDatabasePath: input.scratchDatabasePath,
    targetProfileRoot: input.scratchProfileRoot,
    liveDatabasePath: input.liveDatabasePath,
    liveProfileRoot: input.liveProfileRoot
  });
  assertNotInsideAnyWorktree(input.scratchDatabasePath, input.forbiddenWorktreeRoots, "backup_logical_import_scratch_inside_git_worktree_denied");
  mkdirSync(dirname(input.scratchDatabasePath), { recursive: true });
  rmSync(input.scratchDatabasePath, { force: true });

  const repositoryOptions = input.migrationsDir
    ? { databasePath: input.scratchDatabasePath, migrationsDir: input.migrationsDir }
    : { databasePath: input.scratchDatabasePath };
  const repository = new AosSqliteRepository(repositoryOptions);
  try {
    repository.applyMigrations();
  } finally {
    repository.close();
  }

  const db = new DatabaseSync(resolve(input.scratchDatabasePath));
  try {
    db.exec("BEGIN IMMEDIATE");
    for (const table of orderedTableManifests(manifest.tableManifests)) {
      const filePath = join(exportDirectory, table.fileName);
      const lines = readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean);
      if (lines.length !== table.rowCount) {
        throw new Error(`backup_logical_import_row_count_mismatch:${table.tableName}`);
      }
      const columns = table.columns.map(quoteIdentifier).join(", ");
      const placeholders = table.columns.map(() => "?").join(", ");
      const statement = db.prepare(`INSERT INTO ${quoteIdentifier(table.tableName)} (${columns}) VALUES (${placeholders})`);
      for (const line of lines) {
        const row = JSON.parse(line) as Record<string, unknown>;
        statement.run(...table.columns.map((column) => sqliteValue(row[column])));
      }
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally {
    db.close();
  }

  const importedIntegrityCheck = sqliteIntegrityCheck(input.scratchDatabasePath);
  const importedTableDigests = readSqliteTableDigests(input.scratchDatabasePath);
  const exportedTableDigests = Object.fromEntries(manifest.tableManifests.map((table) => [table.tableName, table.rowDigest]));
  const tableDigestMatches = Object.fromEntries(Object.entries(exportedTableDigests).map(([table, digest]) => [table, importedTableDigests[table] === digest]));
  const importedTableRowCounts = filterTableCounts(readSqliteTableCounts(input.scratchDatabasePath), Object.keys(manifest.tableRowCounts));
  const countsMatch = Object.entries(manifest.tableRowCounts).every(([table, count]) => importedTableRowCounts[table] === count);
  return {
    ok: importedIntegrityCheck.ok && countsMatch && Object.values(tableDigestMatches).every(Boolean),
    exportId: manifest.exportId,
    importedToScratchProfile: true,
    liveProfileOverwritten: false,
    sourceTableRowCounts: manifest.tableRowCounts,
    importedTableRowCounts,
    tableDigestMatches,
    importedTableDigests,
    exportedTableDigests,
    importedIntegrityCheck,
    scratchProfileDigest: sha256(resolve(input.scratchProfileRoot)),
    rawPathRecorded: false
  };
}

export function listBackupArtifacts(input: {
  backupDir: string;
  forbiddenWorktreeRoots: string[];
}): BackupListReadback {
  const backupDir = resolve(input.backupDir);
  assertNotInsideAnyWorktree(backupDir, input.forbiddenWorktreeRoots, "backup_list_inside_git_worktree_denied");
  if (!existsSync(backupDir)) {
    return {
      ok: true,
      method: "aos.backup.list",
      items: [],
      returnedCount: 0,
      fullGatewayMethodListExposed: false,
      rawPathRecorded: false
    };
  }
  const manifests = readManifestFilesRecursively(backupDir)
    .map(readBackupListItem)
    .filter((item): item is BackupListItem => item !== null)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
  return {
    ok: true,
    method: "aos.backup.list",
    items: manifests,
    returnedCount: manifests.length,
    fullGatewayMethodListExposed: false,
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

export function readSqliteTableDigests(databasePath: string): Record<string, string> {
  const db = new DatabaseSync(resolve(databasePath));
  try {
    return Object.fromEntries(readAosTableNames(db).map((table) => [table, digestRows(db, table).rowDigest]));
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

function readLogicalExportManifest(manifestPath: string): SqliteLogicalExportManifest {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as SqliteLogicalExportManifest;
  if (manifest.schemaVersion !== BK02_LOGICAL_EXPORT_MANIFEST_SCHEMA) {
    throw new Error("backup_logical_export_manifest_schema_mismatch");
  }
  return manifest;
}

function exportLogicalTables(input: {
  snapshotDatabasePath: string;
  exportDirectory: string;
  forbiddenWorktreeRoots: string[];
}): LogicalExportTableManifest[] {
  const db = new DatabaseSync(resolve(input.snapshotDatabasePath));
  try {
    return readAosTableNames(db).map((tableName) => {
      const fileName = `${tableName}.jsonl`;
      const filePath = join(input.exportDirectory, fileName);
      assertNotInsideAnyWorktree(filePath, input.forbiddenWorktreeRoots, "backup_logical_export_file_inside_git_worktree_denied");
      assertNoExistingSymlink(filePath, "backup_logical_export_file_symlink_denied");
      const { lines, columns, rowDigest } = digestRows(db, tableName);
      writeFileSync(filePath, lines.length > 0 ? `${lines.join("\n")}\n` : "", "utf8");
      return {
        tableName,
        fileName,
        columns,
        rowCount: lines.length,
        rowDigest,
        fileDigest: digestFile(filePath)
      };
    });
  } finally {
    db.close();
  }
}

function readAosTableNames(db: DatabaseSync): string[] {
  return (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'aos_%' AND name != 'aos_schema_migrations' ORDER BY name").all() as Array<{ name: string }>).map((row) => row.name);
}

function digestRows(db: DatabaseSync, tableName: string): { lines: string[]; columns: string[]; rowDigest: string } {
  const columns = readTableColumns(db, tableName);
  const orderColumn = columns.includes("id") ? "id" : columns[0] ?? "rowid";
  const rows = db.prepare(`SELECT * FROM ${quoteIdentifier(tableName)} ORDER BY ${quoteIdentifier(orderColumn)}`).all() as Record<string, unknown>[];
  const lines = rows.map((row) => stableJson(normalizeSqliteRow(row, columns)));
  return {
    lines,
    columns,
    rowDigest: sha256(lines.join("\n"))
  };
}

function readTableColumns(db: DatabaseSync, tableName: string): string[] {
  return (db.prepare(`PRAGMA table_info(${quoteIdentifier(tableName)})`).all() as Array<{ name: string }>).map((row) => row.name);
}

function normalizeSqliteRow(row: Record<string, unknown>, columns: string[]): Record<string, unknown> {
  return Object.fromEntries(columns.map((column) => [column, normalizeSqliteValue(row[column])]));
}

function normalizeSqliteValue(value: unknown): unknown {
  if (Buffer.isBuffer(value)) {
    return value.toString("base64");
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  return value;
}

function sqliteValue(value: unknown): string | number | bigint | null | Buffer {
  if (value === undefined) {
    return null;
  }
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "bigint" || Buffer.isBuffer(value)) {
    return value;
  }
  return stableJson(value);
}

function orderedTableManifests(tables: LogicalExportTableManifest[]): LogicalExportTableManifest[] {
  const order = new Map<string, number>(phase1CoreTables.map((table, index) => [table, index]));
  return [...tables].sort((left, right) => (order.get(left.tableName) ?? Number.MAX_SAFE_INTEGER) - (order.get(right.tableName) ?? Number.MAX_SAFE_INTEGER) || left.tableName.localeCompare(right.tableName));
}

function filterTableCounts(counts: Record<string, number>, tables: string[]): Record<string, number> {
  return Object.fromEntries(tables.map((table) => [table, counts[table] ?? 0]));
}

function readManifestFilesRecursively(root: string): string[] {
  const paths: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      paths.push(...readManifestFilesRecursively(path));
    } else if (entry.isFile() && entry.name.endsWith(".manifest.json")) {
      paths.push(path);
    }
  }
  return paths;
}

function readBackupListItem(manifestPath: string): BackupListItem | null {
  const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
  if (parsed.schemaVersion === BK01_SNAPSHOT_MANIFEST_SCHEMA) {
    const manifest = parsed as unknown as SqliteSnapshotManifest;
    return {
      id: manifest.snapshotId,
      kind: "physical_snapshot",
      createdAt: manifest.createdAt,
      purpose: manifest.purpose,
      digest: manifest.snapshotDigest,
      manifestDigest: sha256(stableJson(manifest)),
      tableRowCounts: manifest.tableRowCounts,
      rawPathRecorded: false
    };
  }
  if (parsed.schemaVersion === BK02_LOGICAL_EXPORT_MANIFEST_SCHEMA) {
    const manifest = parsed as unknown as SqliteLogicalExportManifest;
    return {
      id: manifest.exportId,
      kind: "logical_export",
      createdAt: manifest.createdAt,
      purpose: manifest.purpose,
      digest: manifest.exportDigest,
      manifestDigest: sha256(stableJson(manifest)),
      tableRowCounts: manifest.tableRowCounts,
      rawPathRecorded: false
    };
  }
  return null;
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

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll("\"", "\"\"")}"`;
}
