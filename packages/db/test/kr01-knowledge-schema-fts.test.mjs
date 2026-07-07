import test from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AosSqliteRepository,
  KnowledgeRetrievalValidationError,
  createSqlitePhysicalSnapshot,
  probeSqliteFts5Availability,
  sha256
} from "../../../dist/packages/db/src/index.js";
import { transportMvpMethods } from "../../../dist/packages/mcp-server/src/index.js";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const migrationsDir = fileURLToPath(new URL("../migrations/sqlite", import.meta.url));

test("KR-01 applies additive knowledge schema with FTS5, body caps, durable-copy snapshot, and restart persistence", async () => {
  const root = await mkdtemp(join(tmpdir(), "tcrn-aos-kr01-test-"));
  const oldMigrationRoot = await mkdtemp(join(tmpdir(), "tcrn-aos-kr01-old-migrations-"));
  try {
    const ftsProbe = probeSqliteFts5Availability();
    assert.equal(ftsProbe.ok, true);
    assert.equal(ftsProbe.fts5Available, true);

    const freshDbPath = join(root, "fresh", "kr01-fresh.sqlite");
    const freshRepository = new AosSqliteRepository({ databasePath: freshDbPath, migrationsDir });
    const freshMigration = freshRepository.applyMigrations();
    assert.equal(freshMigration.ok, true);
    assert.equal(freshMigration.appliedCount, 2);
    const freshSchema = freshRepository.knowledgeRetrievalSchemaReadback();
    assert.equal(freshSchema.ok, true);
    assert.equal(freshSchema.fts5Available, true);
    assert.equal(freshSchema.searchMode, "fts5");
    assert.deepEqual(freshSchema.missingColumns, []);

    const accepted = freshRepository.createKnowledgeRetrievalEntry(knowledgeEntry({
      id: "knowledge-kr01-accepted",
      title: "KR-01 SQLite FTS restart proof",
      body: words(1500)
    }));
    assert.equal(accepted.id, "knowledge-kr01-accepted");
    assert.equal(accepted.body.split(/\s+/).length, 1500);
    assert.throws(() => freshRepository.createKnowledgeRetrievalEntry(knowledgeEntry({
      id: "knowledge-kr01-body-too-large",
      title: "Oversized knowledge body",
      body: words(1501)
    })), (error) => error instanceof KnowledgeRetrievalValidationError &&
      error.reason === "knowledge_body_word_limit_exceeded" &&
      error.field === "body" &&
      error.limit === 1500 &&
      error.actual === 1501);

    const search = freshRepository.searchKnowledgeRetrievalEntries({ query: "restart proof", roleScope: "implementation", project: "TCRN-AOS" });
    assert.deepEqual(search.map((entry) => entry.id), ["knowledge-kr01-accepted"]);
    const accessed = freshRepository.recordKnowledgeRetrievalAccess("knowledge-kr01-accepted", "2026-07-08T00:00:00.000Z");
    assert.equal(accessed.accessCount, 1);
    freshRepository.close();

    const restarted = new AosSqliteRepository({ databasePath: freshDbPath, migrationsDir });
    restarted.applyMigrations();
    const restartedSearch = restarted.searchKnowledgeRetrievalEntries({ query: "restart proof", roleScope: "implementation", project: "TCRN-AOS" });
    assert.deepEqual(restartedSearch.map((entry) => entry.id), ["knowledge-kr01-accepted"]);
    assert.equal(restarted.requireKnowledgeRetrievalEntry("knowledge-kr01-accepted").accessCount, 1);
    restarted.close();

    await writeFile(join(oldMigrationRoot, "0001_phase1_core.sql"), await readFile(join(migrationsDir, "0001_phase1_core.sql"), "utf8"));
    const sourceDurablePath = join(root, "durable-source", "durable.sqlite");
    const oldRepository = new AosSqliteRepository({ databasePath: sourceDurablePath, migrationsDir: oldMigrationRoot });
    const oldMigration = oldRepository.applyMigrations();
    assert.equal(oldMigration.appliedCount, 1);
    const sourceDigestBeforeCopy = oldRepository.databaseDigest();
    oldRepository.close();

    const copiedDurablePath = join(root, "durable-copy", "durable-copy.sqlite");
    mkdirSync(join(root, "durable-copy"), { recursive: true });
    copyFileSync(sourceDurablePath, copiedDurablePath);
    const preMigrationSnapshotRoot = join(root, "pre-migration-snapshots");
    mkdirSync(preMigrationSnapshotRoot, { recursive: true });
    const copiedRepository = new AosSqliteRepository({ databasePath: copiedDurablePath, migrationsDir });
    const copiedMigration = copiedRepository.applyMigrations({
      preMigrationSnapshot(input) {
        const snapshot = createSqlitePhysicalSnapshot({
          sourceDatabasePath: copiedDurablePath,
          snapshotPath: join(preMigrationSnapshotRoot, `pre-${input.version}.sqlite`),
          snapshotId: `pre-${input.version}`,
          createdAt: "2026-07-08T00:01:00.000Z",
          purpose: "kr01_pre_migration_snapshot_test",
          sourceProfileDigest: sha256(`${sourceDigestBeforeCopy}:${input.digest}`),
          routeId: "kr01-schema-fts-test",
          profileId: "kr01-durable-copy-test",
          forbiddenWorktreeRoots: [repoRoot]
        });
        return { ok: snapshot.ok, snapshotId: snapshot.snapshotId, manifestDigest: snapshot.manifestDigest };
      }
    });
    assert.equal(copiedMigration.appliedCount, 1);
    assert.deepEqual(copiedMigration.preMigrationSnapshots.map((item) => item.version), ["0002_knowledge_retrieval"]);
    assert.equal(copiedRepository.knowledgeRetrievalSchemaReadback().ok, true);
    copiedRepository.close();

    const sourceAfterCopy = new AosSqliteRepository({ databasePath: sourceDurablePath, migrationsDir: oldMigrationRoot });
    sourceAfterCopy.applyMigrations();
    assert.equal(sourceAfterCopy.databaseDigest(), sourceDigestBeforeCopy);
    assert.equal(sourceAfterCopy.tableNames().includes("aos_knowledge_entries"), false);
    sourceAfterCopy.close();

    assert.equal(transportMvpMethods.some((method) => method.startsWith("aos.knowledge.")), false);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(oldMigrationRoot, { recursive: true, force: true });
  }
});

function knowledgeEntry(overrides = {}) {
  return {
    id: "knowledge-kr01-fixture",
    title: "KR-01 knowledge fixture",
    roleScope: "implementation",
    project: "TCRN-AOS",
    category: "knowledge-retrieval",
    knowledgeKind: "runbook_fact",
    status: "canonical",
    lastVerified: "2026-07-08",
    stalenessPolicy: "review_after_30_days",
    sourceRef: "workflow-plan-digest-reference",
    sourceDigest: "sha256:kr01-fixture-source",
    tags: ["kr01", "sqlite", "fts"],
    summary: "KR-01 fixture for schema and FTS persistence proof.",
    body: "KR-01 fixture body proves restart persistence.",
    ...overrides
  };
}

function words(count) {
  return Array.from({ length: count }, (_, index) => `word${index}`).join(" ");
}
