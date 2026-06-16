import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../migrations/0001_operational_spine.sql", import.meta.url), "utf8");
const seed = JSON.parse(readFileSync(new URL("../seed/aos-seed.json", import.meta.url), "utf8"));

test("schema includes core operational tables and append-only audit trigger", () => {
  for (const table of [
    "aos_projects",
    "aos_stories",
    "aos_gate_work_orders",
    "aos_ai_employees",
    "aos_conferences",
    "aos_dependency_lifecycle_records",
    "aos_dependency_detection_findings",
    "aos_resource_registry_records",
    "aos_resource_materialization_requests",
    "aos_project_resource_manifests",
    "aos_resource_audit_findings",
    "aos_resource_materialization_history_records",
    "aos_resource_update_requests",
    "aos_resource_replacement_requests",
    "aos_resource_rollback_requests",
    "aos_resource_rollback_plans",
    "aos_resource_retirement_records",
    "aos_resource_cleanup_readbacks",
    "aos_knowledge_entries",
    "aos_user_guide_page_drafts",
    "aos_release_notes",
    "aos_docs_readiness_records",
    "aos_project_search_index_records",
    "aos_github_metadata_readbacks",
    "aos_pr_ci_story_readiness_records",
    "aos_release_candidate_linkages",
    "aos_audit_events"
  ]) {
    assert.match(sql, new RegExp(`CREATE TABLE ${table}\\b`));
  }
  assert.match(sql, /aos_audit_events_no_update/);
  assert.doesNotMatch(sql, /\b(redis|bullmq)\b/i);
});

test("seed data references TCRN-TMS and planned TCRN-AOS without production claims", () => {
  assert.equal(seed.projects.find((project) => project.id === "TCRN-AOS").registryStatus, "planned");
  assert.equal(seed.projects.find((project) => project.id === "TCRN-TMS").registryStatus, "active");
  assert.equal(seed.sampleRecords.releaseNoteStatus, "draft");
});
