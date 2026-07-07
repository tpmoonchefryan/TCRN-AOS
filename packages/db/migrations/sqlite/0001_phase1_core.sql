CREATE TABLE IF NOT EXISTS aos_schema_migrations (
  version TEXT PRIMARY KEY,
  digest TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS aos_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  registry_status TEXT NOT NULL CHECK (registry_status IN ('planned', 'active', 'archived', 'unknown')),
  status TEXT NOT NULL CHECK (status IN ('proposed', 'accepted', 'in_progress', 'blocked', 'in_review', 'verified', 'released', 'archived', 'superseded')),
  gate_state TEXT NOT NULL CHECK (gate_state IN ('proposed', 'pending_role', 'owner_intent_required', 'accepted', 'blocked', 'superseded')),
  record_json TEXT NOT NULL CHECK (json_valid(record_json)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS aos_ai_employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'owner_observer', 'owner_intent_submitter', 'admin', 'break_glass_admin', 'coordinator', 'product_strategy', 'architecture', 'implementation', 'verification', 'security', 'evidence', 'release', 'knowledge', 'registrar')),
  thread_id TEXT,
  lifecycle TEXT NOT NULL CHECK (lifecycle IN ('active', 'idle', 'blocked', 'archived')),
  source_digest TEXT,
  record_json TEXT NOT NULL CHECK (json_valid(record_json)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS aos_initiatives (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES aos_projects(id),
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('proposed', 'accepted', 'in_progress', 'blocked', 'in_review', 'verified', 'released', 'archived', 'superseded')),
  record_json TEXT NOT NULL CHECK (json_valid(record_json)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS aos_epics (
  id TEXT PRIMARY KEY,
  initiative_id TEXT NOT NULL REFERENCES aos_initiatives(id),
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('proposed', 'accepted', 'in_progress', 'blocked', 'in_review', 'verified', 'released', 'archived', 'superseded')),
  record_json TEXT NOT NULL CHECK (json_valid(record_json)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS aos_stories (
  id TEXT PRIMARY KEY,
  epic_id TEXT NOT NULL REFERENCES aos_epics(id),
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('proposed', 'accepted', 'in_progress', 'blocked', 'in_review', 'verified', 'released', 'archived', 'superseded')),
  record_json TEXT NOT NULL CHECK (json_valid(record_json)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS aos_subtasks (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES aos_stories(id),
  owner_role TEXT NOT NULL CHECK (owner_role IN ('owner', 'owner_observer', 'owner_intent_submitter', 'admin', 'break_glass_admin', 'coordinator', 'product_strategy', 'architecture', 'implementation', 'verification', 'security', 'evidence', 'release', 'knowledge', 'registrar')),
  status TEXT NOT NULL CHECK (status IN ('proposed', 'accepted', 'in_progress', 'blocked', 'in_review', 'verified', 'released', 'archived', 'superseded')),
  record_json TEXT NOT NULL CHECK (json_valid(record_json)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS aos_assignments (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES aos_ai_employees(id),
  target_id TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('story', 'gate', 'conference', 'project')),
  role TEXT NOT NULL CHECK (role IN ('owner', 'owner_observer', 'owner_intent_submitter', 'admin', 'break_glass_admin', 'coordinator', 'product_strategy', 'architecture', 'implementation', 'verification', 'security', 'evidence', 'release', 'knowledge', 'registrar')),
  status TEXT NOT NULL CHECK (status IN ('proposed', 'accepted', 'in_progress', 'blocked', 'in_review', 'verified', 'released', 'archived', 'superseded')),
  record_json TEXT NOT NULL CHECK (json_valid(record_json)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS aos_agent_runs (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES aos_assignments(id),
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'blocked', 'stale', 'interrupted', 'superseded')),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  record_json TEXT NOT NULL CHECK (json_valid(record_json)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS aos_gate_work_orders (
  id TEXT PRIMARY KEY,
  linked_ticket_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('product_strategy', 'architecture', 'security_license', 'evidence_proof', 'release_closeout', 'owner_intent')),
  owner_role TEXT NOT NULL CHECK (owner_role IN ('owner', 'owner_observer', 'owner_intent_submitter', 'admin', 'break_glass_admin', 'coordinator', 'product_strategy', 'architecture', 'implementation', 'verification', 'security', 'evidence', 'release', 'knowledge', 'registrar')),
  status TEXT NOT NULL CHECK (status IN ('proposed', 'pending_role', 'owner_intent_required', 'accepted', 'blocked', 'superseded')),
  record_json TEXT NOT NULL CHECK (json_valid(record_json)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS aos_evidence_links (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('local_path_reference', 'github_url', 'artifact_id', 'external_url')),
  target TEXT NOT NULL,
  digest TEXT,
  redaction_state TEXT NOT NULL CHECK (redaction_state IN ('metadata_only', 'redacted', 'restricted', 'public_reference')),
  record_json TEXT NOT NULL CHECK (json_valid(record_json)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS aos_audit_events (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  action TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('accepted', 'blocked', 'deduped', 'read')),
  actor_ref TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  record_json TEXT NOT NULL CHECK (json_valid(record_json))
);

CREATE INDEX IF NOT EXISTS idx_aos_initiatives_project ON aos_initiatives(project_id);
CREATE INDEX IF NOT EXISTS idx_aos_epics_initiative ON aos_epics(initiative_id);
CREATE INDEX IF NOT EXISTS idx_aos_stories_epic ON aos_stories(epic_id);
CREATE INDEX IF NOT EXISTS idx_aos_subtasks_story ON aos_subtasks(story_id);
CREATE INDEX IF NOT EXISTS idx_aos_assignments_target ON aos_assignments(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_aos_agent_runs_assignment ON aos_agent_runs(assignment_id);
CREATE INDEX IF NOT EXISTS idx_aos_gates_story ON aos_gate_work_orders(linked_ticket_id);
CREATE INDEX IF NOT EXISTS idx_aos_audit_target ON aos_audit_events(target_type, target_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_aos_ai_employees_unique_thread ON aos_ai_employees(thread_id) WHERE thread_id IS NOT NULL;

CREATE TRIGGER IF NOT EXISTS aos_audit_events_no_update
BEFORE UPDATE ON aos_audit_events
BEGIN
  SELECT RAISE(ABORT, 'aos_audit_events_append_only_update_denied');
END;

CREATE TRIGGER IF NOT EXISTS aos_audit_events_no_delete
BEFORE DELETE ON aos_audit_events
BEGIN
  SELECT RAISE(ABORT, 'aos_audit_events_append_only_delete_denied');
END;
