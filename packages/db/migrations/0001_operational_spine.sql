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
  license_expression TEXT NOT NULL,
  evidence_status TEXT NOT NULL,
  sbom_notice_obligation TEXT NOT NULL,
  posture TEXT NOT NULL,
  approval_owner_role TEXT NOT NULL,
  linked_gate_ids JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE aos_resource_registry_records (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  owner TEXT NOT NULL,
  source TEXT NOT NULL,
  version TEXT NOT NULL,
  digest TEXT NOT NULL,
  storage_reference TEXT NOT NULL,
  classification JSONB NOT NULL,
  copyright_status TEXT NOT NULL,
  lifecycle_state TEXT NOT NULL,
  approval_state TEXT NOT NULL,
  project_manifest_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  linked_gate_ids JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE aos_knowledge_entries (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES aos_projects(id),
  category TEXT NOT NULL,
  status TEXT NOT NULL,
  source TEXT NOT NULL,
  freshness TEXT NOT NULL,
  linked_ticket_ids JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE aos_release_notes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES aos_projects(id),
  release TEXT NOT NULL,
  story_ids JSONB NOT NULL,
  user_facing_summary TEXT NOT NULL,
  internal_notes TEXT NOT NULL,
  risk_notes JSONB NOT NULL,
  status TEXT NOT NULL
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
