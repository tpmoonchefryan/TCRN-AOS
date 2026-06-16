import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../packages/db/migrations/0001_operational_spine.sql", import.meta.url), "utf8");

const requiredTables = [
  "aos_projects",
  "aos_initiatives",
  "aos_epics",
  "aos_stories",
  "aos_subtasks",
  "aos_ai_employees",
  "aos_assignments",
  "aos_gate_work_orders",
  "aos_evidence_links",
  "aos_conferences",
  "aos_conference_positions",
  "aos_dependency_lifecycle_records",
  "aos_resource_registry_records",
  "aos_knowledge_entries",
  "aos_user_guide_page_drafts",
  "aos_release_notes",
  "aos_audit_events"
];

const missing = requiredTables.filter((table) => !new RegExp(`CREATE TABLE\\s+${table}\\b`, "i").test(sql));
const hasAppendOnlyTrigger = /CREATE TRIGGER\s+aos_audit_events_no_update/i.test(sql);
const hasRedisRuntime = /\b(redis|bullmq)\b/i.test(sql);

if (missing.length > 0 || !hasAppendOnlyTrigger || hasRedisRuntime) {
  console.error(JSON.stringify({
    ok: false,
    missing,
    hasAppendOnlyTrigger,
    hasRedisRuntime
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  requiredTables: requiredTables.length,
  hasAppendOnlyTrigger,
  runtimeDatabaseProof: "static_schema_validation_only"
}, null, 2));
