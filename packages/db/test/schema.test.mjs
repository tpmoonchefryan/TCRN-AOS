import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

// This test used to assert that 27 table names appeared as text in a 535-line
// PostgreSQL file that nothing executed — the same false gate as
// scripts/validate-migrations.mjs, in a second copy (TCRN-AOS-INC-001). The
// second copy is the part worth naming: fixing one and leaving the other keeps
// the false assurance alive under a different name.
//
// Schema behaviour is now proven against a live database by
// scripts/validate-migrations.mjs (tables present, FTS present, triggers that
// actually reject an UPDATE and a DELETE, re-apply is a no-op, digest drift is
// refused). What stays here is what a text-level test can honestly assert: the
// migration set the runtime applies declares the tables the product uses, and no
// queue or cache runtime crept into it.
const migrationsDir = new URL("../migrations/sqlite/", import.meta.url);
const migrationFiles = readdirSync(migrationsDir).filter((file) => file.endsWith(".sql")).sort();
const sql = migrationFiles
  .map((file) => readFileSync(new URL(file, migrationsDir), "utf8"))
  .join("\n");
const seed = JSON.parse(readFileSync(new URL("../seed/aos-seed.json", import.meta.url), "utf8"));

test("the applied migration set declares the runtime tables and no queue runtime", () => {
  assert.ok(migrationFiles.length >= 2, "expected the phase-1 core and knowledge migrations");

  // Only the tables this cockpit reads and writes. The 22 resource-materialization
  // and docs-pipeline tables the old list demanded were ruled deleted dead code
  // by TCRN-AOS-MIN-003 layer A, and never existed in any database that ran.
  for (const table of [
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
  ]) {
    assert.match(sql, new RegExp(`CREATE TABLE (IF NOT EXISTS )?${table}\\b`));
  }

  assert.match(sql, /aos_audit_events_no_update/);
  assert.match(sql, /aos_audit_events_no_delete/);
  assert.doesNotMatch(sql, /\b(redis|bullmq)\b/i);
});

test("the deleted PostgreSQL spine leaves no file behind to be scanned again", () => {
  // A deletion is complete only when nothing can reach for it. Asserting the
  // absence beats trusting that the grep run at deletion time was total.
  const files = readdirSync(new URL("../migrations/", import.meta.url));
  assert.ok(
    !files.includes("0001_operational_spine.sql"),
    "the never-executed PostgreSQL spine was deleted under TCRN-AOS-INC-001");
});

test("seed data references TCRN-TMS and planned TCRN-AOS without production claims", () => {
  assert.equal(seed.projects.find((project) => project.id === "TCRN-AOS").registryStatus, "planned");
  assert.equal(seed.projects.find((project) => project.id === "TCRN-TMS").registryStatus, "active");
  assert.equal(seed.sampleRecords.releaseNoteStatus, "draft");
});
