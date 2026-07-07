-- TCRN-AOS Slice 1 operational spine schema.
-- Runtime database application is deferred; this migration is statically validated in the local checkpoint.

CREATE TABLE aos_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  registry_status TEXT NOT NULL,
  repo_registry_id TEXT NOT NULL,
  repo_path_reference TEXT NOT NULL,
  status TEXT NOT NULL,
  gate_state TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE aos_initiatives (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES aos_projects(id),
  title TEXT NOT NULL,
  problem TEXT NOT NULL,
  expected_outcome TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE aos_epics (
  id TEXT PRIMARY KEY,
  initiative_id TEXT NOT NULL REFERENCES aos_initiatives(id),
  title TEXT NOT NULL,
  goal TEXT NOT NULL,
  status TEXT NOT NULL,
  estimate JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE aos_stories (
  id TEXT PRIMARY KEY,
  epic_id TEXT NOT NULL REFERENCES aos_epics(id),
  title TEXT NOT NULL,
  problem TEXT NOT NULL,
  user_label TEXT NOT NULL,
  expected_behavior TEXT NOT NULL,
  acceptance_criteria JSONB NOT NULL,
  estimate JSONB NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE aos_subtasks (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES aos_stories(id),
  title TEXT NOT NULL,
  owner_role TEXT NOT NULL,
  status TEXT NOT NULL,
  dependency_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  proof_expectation TEXT NOT NULL
);

CREATE TABLE aos_ai_employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  authority_summary TEXT NOT NULL,
  contact_when TEXT NOT NULL,
  lifecycle TEXT NOT NULL,
  thread_identity JSONB NOT NULL,
  role_contract_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  skill_refs JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE aos_assignments (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES aos_ai_employees(id),
  target_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL,
  due_state TEXT NOT NULL,
  proof_expectation TEXT NOT NULL,
  run_ids JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE aos_gate_work_orders (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  owner_role TEXT NOT NULL,
  linked_ticket_id TEXT NOT NULL,
  input_evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL,
  decision JSONB,
  blocker TEXT
);

CREATE TABLE aos_evidence_links (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  target TEXT NOT NULL,
  validity TEXT NOT NULL,
  producer TEXT NOT NULL,
  digest TEXT,
  redaction_state TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE aos_conferences (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  initiator JSONB NOT NULL,
  participant_employee_ids JSONB NOT NULL,
  agenda JSONB NOT NULL,
  linked_ticket_ids JSONB NOT NULL,
  desired_outcome TEXT NOT NULL,
  status TEXT NOT NULL,
  minutes JSONB
);

CREATE TABLE aos_conference_positions (
  id TEXT PRIMARY KEY,
  conference_id TEXT NOT NULL REFERENCES aos_conferences(id),
  actor JSONB NOT NULL,
  position TEXT NOT NULL,
  risks JSONB NOT NULL,
  recommendations JSONB NOT NULL,
  evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE aos_dependency_lifecycle_records (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES aos_projects(id),
  ecosystem TEXT NOT NULL,
  package_name TEXT NOT NULL,
  version_range TEXT NOT NULL,
  resolved_artifact TEXT,
  source_system TEXT NOT NULL,
  project_usage TEXT NOT NULL,
  owner_role TEXT,
  lifecycle_state TEXT,
  artifact_ref TEXT,
  license_expression TEXT NOT NULL,
  declared_license_evidence TEXT,
  discovered_license_evidence TEXT,
  evidence_artifact_ref TEXT,
  evidence_status TEXT NOT NULL,
  confidence TEXT,
  policy_class TEXT,
  reviewer_role TEXT,
  residual_risk TEXT,
  next_action TEXT,
  sbom_notice_obligation TEXT NOT NULL,
  posture TEXT NOT NULL,
  approval_owner_role TEXT NOT NULL,
  linked_gate_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  linked_story_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  linked_evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  release_blocker BOOLEAN NOT NULL DEFAULT false,
  package_mutation_executed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE aos_dependency_detection_findings (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES aos_projects(id),
  dependency_id TEXT NOT NULL REFERENCES aos_dependency_lifecycle_records(id),
  state TEXT NOT NULL,
  source_system TEXT NOT NULL,
  evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  linked_gate_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  remediation_executed BOOLEAN NOT NULL DEFAULT false,
  package_mutation_executed BOOLEAN NOT NULL DEFAULT false,
  next_action TEXT NOT NULL
);

CREATE TABLE aos_resource_registry_records (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  project_id TEXT REFERENCES aos_projects(id),
  title TEXT NOT NULL,
  owner TEXT NOT NULL,
  source TEXT NOT NULL,
  version TEXT NOT NULL,
  digest TEXT NOT NULL,
  storage_reference TEXT NOT NULL,
  classification JSONB NOT NULL,
  permission_state TEXT,
  attribution_required BOOLEAN,
  derivative_allowed BOOLEAN,
  expires_at TIMESTAMPTZ,
  reviewer_role TEXT,
  residual_risk TEXT,
  copyright_status TEXT NOT NULL,
  lifecycle_state TEXT NOT NULL,
  approval_state TEXT NOT NULL,
  project_manifest_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  linked_gate_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  linked_story_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  linked_release_note_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  linked_evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  materialization_allowed BOOLEAN NOT NULL DEFAULT false,
  materialization_executed BOOLEAN NOT NULL DEFAULT false,
  product_repo_write_executed BOOLEAN NOT NULL DEFAULT false,
  release_blocker BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE aos_resource_materialization_requests (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES aos_projects(id),
  resource_id TEXT NOT NULL REFERENCES aos_resource_registry_records(id),
  target_project_id TEXT NOT NULL REFERENCES aos_projects(id),
  requested_by JSONB NOT NULL,
  requested_purpose TEXT NOT NULL,
  status TEXT NOT NULL,
  linked_gate_id TEXT,
  evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  owner_intent_required BOOLEAN NOT NULL DEFAULT true,
  materialization_executed BOOLEAN NOT NULL DEFAULT false,
  product_repo_write_executed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE aos_project_resource_manifests (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES aos_projects(id),
  resource_id TEXT NOT NULL REFERENCES aos_resource_registry_records(id),
  resource_digest TEXT NOT NULL,
  materialized_copy_reference TEXT NOT NULL,
  status TEXT NOT NULL,
  linked_story_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  linked_release_note_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  linked_evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_truth TEXT NOT NULL,
  live_copy_created BOOLEAN NOT NULL DEFAULT false,
  product_repo_write_executed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE aos_resource_audit_findings (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES aos_projects(id),
  resource_id TEXT REFERENCES aos_resource_registry_records(id),
  finding_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  linked_gate_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  scanner_ingestion_executed BOOLEAN NOT NULL DEFAULT false,
  materialization_executed BOOLEAN NOT NULL DEFAULT false,
  product_repo_mutation_executed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE aos_resource_materialization_history_records (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES aos_projects(id),
  resource_id TEXT NOT NULL REFERENCES aos_resource_registry_records(id),
  materialization_request_id TEXT NOT NULL REFERENCES aos_resource_materialization_requests(id),
  manifest_id TEXT NOT NULL REFERENCES aos_project_resource_manifests(id),
  target_project_id TEXT NOT NULL REFERENCES aos_projects(id),
  target_reference TEXT NOT NULL,
  resource_digest TEXT NOT NULL,
  actor JSONB NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  lifecycle_state TEXT NOT NULL,
  materialization_executed BOOLEAN NOT NULL DEFAULT false,
  resource_binary_transferred BOOLEAN NOT NULL DEFAULT false,
  product_repo_write_executed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE aos_resource_update_requests (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES aos_projects(id),
  resource_id TEXT NOT NULL REFERENCES aos_resource_registry_records(id),
  manifest_id TEXT NOT NULL REFERENCES aos_project_resource_manifests(id),
  current_resource_version TEXT NOT NULL,
  current_resource_digest TEXT NOT NULL,
  proposed_resource_version TEXT NOT NULL,
  proposed_resource_digest TEXT NOT NULL,
  status TEXT NOT NULL,
  linked_gate_id TEXT,
  evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  owner_intent_required BOOLEAN NOT NULL DEFAULT true,
  update_executed BOOLEAN NOT NULL DEFAULT false,
  resource_binary_transferred BOOLEAN NOT NULL DEFAULT false,
  product_repo_write_executed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE aos_resource_replacement_requests (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES aos_projects(id),
  old_resource_id TEXT NOT NULL REFERENCES aos_resource_registry_records(id),
  replacement_resource_id TEXT NOT NULL REFERENCES aos_resource_registry_records(id),
  reason TEXT NOT NULL,
  copyright_status TEXT NOT NULL,
  license_posture TEXT NOT NULL,
  residual_risk TEXT NOT NULL,
  status TEXT NOT NULL,
  linked_gate_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  owner_intent_required BOOLEAN NOT NULL DEFAULT true,
  replacement_executed BOOLEAN NOT NULL DEFAULT false,
  resource_binary_transferred BOOLEAN NOT NULL DEFAULT false,
  product_repo_write_executed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE aos_resource_rollback_requests (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES aos_projects(id),
  resource_id TEXT NOT NULL REFERENCES aos_resource_registry_records(id),
  manifest_id TEXT NOT NULL REFERENCES aos_project_resource_manifests(id),
  intended_previous_manifest_id TEXT REFERENCES aos_project_resource_manifests(id),
  intended_previous_digest TEXT NOT NULL,
  intended_previous_reference TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL,
  required_gate_id TEXT,
  evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  owner_intent_required BOOLEAN NOT NULL DEFAULT true,
  rollback_executed BOOLEAN NOT NULL DEFAULT false,
  cleanup_executed BOOLEAN NOT NULL DEFAULT false,
  product_repo_write_executed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE aos_resource_rollback_plans (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES aos_projects(id),
  rollback_request_id TEXT NOT NULL REFERENCES aos_resource_rollback_requests(id),
  fallback_path TEXT NOT NULL,
  expected_no_execution_result TEXT NOT NULL,
  readback_command TEXT NOT NULL,
  evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  owner_intent_required BOOLEAN NOT NULL DEFAULT true,
  rollback_executed BOOLEAN NOT NULL DEFAULT false,
  cleanup_executed BOOLEAN NOT NULL DEFAULT false,
  product_repo_write_executed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE aos_resource_retirement_records (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES aos_projects(id),
  resource_id TEXT NOT NULL REFERENCES aos_resource_registry_records(id),
  manifest_id TEXT REFERENCES aos_project_resource_manifests(id),
  reason TEXT NOT NULL,
  lifecycle_state TEXT NOT NULL,
  status TEXT NOT NULL,
  evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  cleanup_required BOOLEAN NOT NULL DEFAULT false,
  owner_intent_required BOOLEAN NOT NULL DEFAULT true,
  retirement_cleanup_executed BOOLEAN NOT NULL DEFAULT false,
  product_repo_delete_executed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE aos_resource_cleanup_readbacks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES aos_projects(id),
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  cleanup_needed BOOLEAN NOT NULL DEFAULT false,
  cleanup_reason TEXT NOT NULL,
  status TEXT NOT NULL,
  evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  owner_intent_required BOOLEAN NOT NULL DEFAULT true,
  cleanup_executed BOOLEAN NOT NULL DEFAULT false,
  delete_executed BOOLEAN NOT NULL DEFAULT false,
  product_repo_write_executed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE aos_knowledge_entries (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES aos_projects(id),
  category TEXT NOT NULL,
  status TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  source_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  freshness_state TEXT NOT NULL,
  linked_ticket_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  linked_conference_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  linked_evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw_private_payload_stored BOOLEAN NOT NULL DEFAULT false,
  canonical_promotion_claimed BOOLEAN NOT NULL DEFAULT false,
  local_first_storage BOOLEAN NOT NULL DEFAULT true,
  default_git_storage BOOLEAN NOT NULL DEFAULT false,
  explicit_export_required BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE aos_user_guide_page_drafts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES aos_projects(id),
  audience TEXT NOT NULL,
  version_label TEXT NOT NULL,
  status TEXT NOT NULL,
  linked_story_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  linked_release_note_item_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  linked_evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  published_state_distinct_from_draft BOOLEAN NOT NULL DEFAULT true,
  release_closeout_claimed BOOLEAN NOT NULL DEFAULT false,
  default_git_storage BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE aos_release_notes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES aos_projects(id),
  release_label TEXT NOT NULL,
  linked_story_ids JSONB NOT NULL,
  user_facing_summary TEXT NOT NULL,
  internal_notes_summary TEXT NOT NULL,
  risk_notes_summary TEXT NOT NULL,
  linked_evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  review_state TEXT NOT NULL,
  git_export_authorized BOOLEAN NOT NULL DEFAULT false,
  release_closeout_claimed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE aos_docs_readiness_records (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES aos_projects(id),
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  readiness_state TEXT NOT NULL,
  freshness_state TEXT NOT NULL,
  linked_story_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  linked_evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  linked_gate_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  stage_map_context JSONB NOT NULL,
  blockers JSONB NOT NULL DEFAULT '[]'::jsonb,
  docs_published BOOLEAN NOT NULL DEFAULT false,
  git_export_executed BOOLEAN NOT NULL DEFAULT false,
  canonical_knowledge_promoted BOOLEAN NOT NULL DEFAULT false,
  public_readiness_claimed BOOLEAN NOT NULL DEFAULT false,
  release_ready_claimed BOOLEAN NOT NULL DEFAULT false,
  local_first_storage BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE aos_project_search_index_records (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES aos_projects(id),
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  sanitized_terms JSONB NOT NULL DEFAULT '[]'::jsonb,
  linked_story_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  linked_evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  linked_gate_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  visibility TEXT NOT NULL DEFAULT 'metadata_only',
  raw_private_payload_indexed BOOLEAN NOT NULL DEFAULT false,
  raw_source_indexed BOOLEAN NOT NULL DEFAULT false,
  raw_scanner_output_indexed BOOLEAN NOT NULL DEFAULT false,
  local_absolute_path_indexed BOOLEAN NOT NULL DEFAULT false,
  local_first_storage BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE aos_github_metadata_readbacks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES aos_projects(id),
  repo_registry_id TEXT NOT NULL,
  repository_name TEXT NOT NULL,
  default_branch TEXT NOT NULL,
  branch_name TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  pull_request_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  ci_run_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  release_reference_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  readback_state TEXT NOT NULL,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  blockers JSONB NOT NULL DEFAULT '[]'::jsonb,
  github_write_executed BOOLEAN NOT NULL DEFAULT false,
  release_created BOOLEAN NOT NULL DEFAULT false,
  ci_status_mutated BOOLEAN NOT NULL DEFAULT false,
  release_ready_claimed BOOLEAN NOT NULL DEFAULT false,
  local_first_storage BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE aos_pr_ci_story_readiness_records (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES aos_projects(id),
  story_id TEXT NOT NULL REFERENCES aos_stories(id),
  github_metadata_id TEXT NOT NULL REFERENCES aos_github_metadata_readbacks(id),
  pull_request_state TEXT NOT NULL,
  ci_state TEXT NOT NULL,
  readiness_state TEXT NOT NULL,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  blockers JSONB NOT NULL DEFAULT '[]'::jsonb,
  linked_evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  github_write_executed BOOLEAN NOT NULL DEFAULT false,
  ci_status_mutated BOOLEAN NOT NULL DEFAULT false,
  release_ready_claimed BOOLEAN NOT NULL DEFAULT false,
  local_first_storage BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE aos_release_candidate_linkages (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES aos_projects(id),
  release_candidate_label TEXT NOT NULL,
  status TEXT NOT NULL,
  story_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  docs_readiness_record_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  release_note_item_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  dependency_blocker_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  resource_blocker_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  gate_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  github_metadata_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  pr_ci_readiness_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  residual_risks JSONB NOT NULL DEFAULT '[]'::jsonb,
  release_created BOOLEAN NOT NULL DEFAULT false,
  github_write_executed BOOLEAN NOT NULL DEFAULT false,
  deployment_executed BOOLEAN NOT NULL DEFAULT false,
  product_accepted BOOLEAN NOT NULL DEFAULT false,
  final_mvp_accepted BOOLEAN NOT NULL DEFAULT false,
  release_ready_claimed BOOLEAN NOT NULL DEFAULT false,
  public_readiness_claimed BOOLEAN NOT NULL DEFAULT false,
  legal_completion_claimed BOOLEAN NOT NULL DEFAULT false,
  dependency_clean_claimed BOOLEAN NOT NULL DEFAULT false,
  local_first_storage BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE aos_audit_events (
  id TEXT PRIMARY KEY,
  actor JSONB NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  outcome TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  details JSONB NOT NULL
);

CREATE OR REPLACE FUNCTION aos_audit_events_no_update_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'aos_audit_events is append-only';
END;
$$;

CREATE TRIGGER aos_audit_events_no_update
BEFORE UPDATE OR DELETE ON aos_audit_events
FOR EACH ROW EXECUTE FUNCTION aos_audit_events_no_update_delete();
