#!/usr/bin/env node
// Validate the SQLite migrations by applying them to a real database.
//
// This replaces a checker that read one 535-line PostgreSQL file with regular
// expressions and reported `ok: true` when the table names it was looking for
// appeared as text. That file was never executed by anything: AOS has no `pg`
// dependency, no PostgreSQL client, no `DATABASE_URL`, and its only deployment
// manifest serves static files. The gate was green because the strings were
// there, which is the platform's worst failure mode — a gate only protects the
// bytes it actually reads (TCRN-AOS-INC-001).
//
// So this checker connects. Every assertion below is a statement about a
// database that exists at the moment the assertion runs:
//
//   - the migrations apply, in order, through the same runtime path the product
//     uses (AosSqliteRepository.applyMigrations, digest-journaled in
//     aos_schema_migrations);
//   - the tables and the FTS index are present in sqlite_master afterwards;
//   - the append-only audit triggers actually reject UPDATE and DELETE, proven
//     by issuing both against a real row and requiring both to be refused;
//   - re-running is a no-op rather than a re-apply, and a migration whose bytes
//     changed after being applied is refused instead of silently diverging.
//
// The last two are the ones a text scan can never make: a trigger that exists
// in the source is not a trigger that fires, and a journal that lists versions
// is not a journal that detects drift.
//
// Coverage is stated rather than implied. The domain schema
// (migrations/domain/0001_cockpit_domain.sql) is applied by DomainStore and is
// covered by that package's own tests; this script says so below instead of
// leaving the reader to assume "migrations" means all of them.

import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const repositoryRoot = resolve(import.meta.dirname, "..");
const sqliteMigrationsDir = join(repositoryRoot, "packages/db/migrations/sqlite");
const domainMigrationPath = join(repositoryRoot, "packages/db/migrations/domain/0001_cockpit_domain.sql");

// The runtime tables this cockpit actually reads and writes. Shorter than the
// list the old checker carried because the 22 tables it also demanded belonged
// to the resource-materialization and docs-pipeline families that MIN-003's
// layer A ruled deleted as never-executed dead code.
const requiredTables = [
  "aos_schema_migrations",
  "aos_projects",
  "aos_ai_employees",
  "aos_initiatives",
  "aos_epics",
  "aos_stories",
  "aos_subtasks",
  "aos_evidence_links",
  "aos_gate_work_orders",
  "aos_assignments",
  "aos_agent_runs",
  "aos_knowledge_entries",
  "aos_audit_events"
];

const workspace = await mkdtemp(join(tmpdir(), "tcrn-aos-migration-check-"));
const databasePath = join(workspace, "migration-check.db");

try {
  const { AosSqliteRepository } = await import(
    resolve(repositoryRoot, "dist/packages/db/src/index.js"));

  // 1. Apply through the product's own path, not a hand-rolled exec loop, so a
  //    break in that path fails here too.
  const repository = new AosSqliteRepository({ databasePath, migrationsDir: sqliteMigrationsDir });
  const applied = repository.applyMigrations();

  // 2. Re-apply. The journal should recognise every version and skip it.
  const reapplied = repository.applyMigrations();
  const reapplyIsNoop = reapplied.migrations.every((migration) => migration.applied === false);
  repository.close();

  // 3. Ask the database what it contains, rather than asking the source what it
  //    claims to create.
  const database = new DatabaseSync(databasePath);
  const observedTables = new Set(
    database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()
      .map((row) => row.name));
  const missingTables = requiredTables.filter((table) => !observedTables.has(table));
  const hasKnowledgeFts = observedTables.has("aos_knowledge_entries_fts");

  const observedTriggers = new Set(
    database.prepare("SELECT name FROM sqlite_master WHERE type = 'trigger'").all()
      .map((row) => row.name));

  // 4. Prove the append-only triggers fire. A row has to exist first — a
  //    trigger cannot reject an UPDATE that matches nothing, and a rejection
  //    that never had a row to reject proves nothing.
  database.exec(`
    INSERT INTO aos_audit_events(id, target_type, target_id, action, outcome, actor_ref, timestamp, record_json)
    VALUES ('audit-migration-check', 'migration_check', 'probe', 'migration.check.probe',
            'accepted', 'system:migration-check', '2026-01-01T00:00:00.000Z', json_object());
  `);
  const auditRowsBefore = database.prepare("SELECT count(*) AS n FROM aos_audit_events").get().n;
  const updateRejected = refuses(() => database.exec(
    "UPDATE aos_audit_events SET action = 'tampered' WHERE id = 'audit-migration-check'"));
  const deleteRejected = refuses(() => database.exec(
    "DELETE FROM aos_audit_events WHERE id = 'audit-migration-check'"));
  const auditRowsAfter = database.prepare("SELECT count(*) AS n FROM aos_audit_events").get().n;
  const auditRowSurvived = auditRowsBefore === auditRowsAfter;
  const actionUnchanged = database
    .prepare("SELECT action FROM aos_audit_events WHERE id = 'audit-migration-check'")
    .get().action === "migration.check.probe";
  database.close();

  // 5. Prove drift detection: a migration whose bytes changed after being
  //    applied must be refused, not quietly re-run or ignored.
  const driftRejected = await provesDriftRejected(databasePath);

  // 6. State what this run did not cover, so the reader is not left inferring
  //    that "migrations validated" means every migration in the tree.
  const domainSql = await readFile(domainMigrationPath, "utf8");
  const domainTableCount = (domainSql.match(/CREATE TABLE/gi) ?? []).length;

  const ok = missingTables.length === 0
    && hasKnowledgeFts
    && observedTriggers.has("aos_audit_events_no_update")
    && observedTriggers.has("aos_audit_events_no_delete")
    && updateRejected
    && deleteRejected
    && auditRowSurvived
    && actionUnchanged
    && reapplyIsNoop
    && driftRejected;

  const report = {
    ok,
    validationMode: "applied_to_a_real_database",
    migrationsApplied: applied.migrations.map(({ version, applied: wasApplied }) => ({ version, applied: wasApplied })),
    reapplyIsNoop,
    driftRejected,
    tables: {
      required: requiredTables.length,
      observed: observedTables.size,
      missing: missingTables
    },
    knowledgeFtsPresent: hasKnowledgeFts,
    appendOnlyAudit: {
      triggersPresent: observedTriggers.has("aos_audit_events_no_update")
        && observedTriggers.has("aos_audit_events_no_delete"),
      updateRejected,
      deleteRejected,
      rowSurvived: auditRowSurvived,
      actionUnchanged
    },
    notCovered: {
      "packages/db/migrations/domain/0001_cockpit_domain.sql":
        `applied by DomainStore, ${domainTableCount} tables; covered by packages/domain and packages/projection tests, not by this script`,
      postgresql:
        "none. The 535-line PostgreSQL spine this checker used to scan was deleted under TCRN-AOS-INC-001 — no pg dependency, client, or connection string exists in this repository"
    }
  };

  console.log(JSON.stringify(report, null, 2));
  if (!ok) {
    process.exitCode = 1;
  }
} finally {
  await rm(workspace, { recursive: true, force: true });
}

function refuses(fn) {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}

/**
 * Rewrite an applied migration's recorded digest and require the next apply to
 * refuse. Editing the journal rather than the file keeps the check honest about
 * what it is testing — the detection, not the filesystem — and leaves the
 * migration files untouched.
 */
async function provesDriftRejected(path) {
  const database = new DatabaseSync(path);
  // Read the version out of the journal rather than naming one. A hard-coded
  // "0001" silently stops testing anything the day a migration is renamed: the
  // UPDATE matches zero rows, no drift is introduced, and the check passes for
  // the wrong reason.
  const target = database
    .prepare("SELECT version FROM aos_schema_migrations ORDER BY version LIMIT 1")
    .get()?.version;
  if (!target) {
    database.close();
    return false;
  }
  const changed = database
    .prepare("UPDATE aos_schema_migrations SET digest = 'drifted' WHERE version = ?")
    .run(target).changes;
  database.close();
  if (changed !== 1) {
    return false;
  }

  const { AosSqliteRepository } = await import(
    resolve(repositoryRoot, "dist/packages/db/src/index.js"));
  const repository = new AosSqliteRepository({ databasePath: path, migrationsDir: sqliteMigrationsDir });
  try {
    repository.applyMigrations();
    return false;
  } catch (error) {
    return /digest changed/iu.test(error instanceof Error ? error.message : String(error));
  } finally {
    repository.close();
  }
}
