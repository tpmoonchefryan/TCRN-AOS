CREATE TABLE IF NOT EXISTS aos_schema_migrations (
  version TEXT PRIMARY KEY,
  digest TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS aos_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  registry_status TEXT NOT NULL,
  status TEXT NOT NULL,
  gate_state TEXT NOT NULL,
  record_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS aos_ai_employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  thread_id TEXT,
  lifecycle TEXT NOT NULL,
  source_digest TEXT,
  record_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS aos_initiatives (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES aos_projects(id),
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  record_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS aos_epics (
  id TEXT PRIMARY KEY,
  initiative_id TEXT NOT NULL REFERENCES aos_initiatives(id),
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  record_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS aos_stories (
  id TEXT PRIMARY KEY,
  epic_id TEXT NOT NULL REFERENCES aos_epics(id),
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  record_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS aos_subtasks (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES aos_stories(id),
  owner_role TEXT NOT NULL,
  status TEXT NOT NULL,
  record_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS aos_assignments (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES aos_ai_employees(id),
  target_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL,
  record_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS aos_agent_runs (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES aos_assignments(id),
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  record_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS aos_gate_work_orders (
  id TEXT PRIMARY KEY,
  linked_ticket_id TEXT NOT NULL,
  type TEXT NOT NULL,
  owner_role TEXT NOT NULL,
  status TEXT NOT NULL,
  record_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS aos_evidence_links (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  target TEXT NOT NULL,
  digest TEXT,
  redaction_state TEXT NOT NULL,
  record_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS aos_audit_events (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  action TEXT NOT NULL,
  outcome TEXT NOT NULL,
  actor_ref TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  record_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_aos_initiatives_project ON aos_initiatives(project_id);
CREATE INDEX IF NOT EXISTS idx_aos_epics_initiative ON aos_epics(initiative_id);
CREATE INDEX IF NOT EXISTS idx_aos_stories_epic ON aos_stories(epic_id);
CREATE INDEX IF NOT EXISTS idx_aos_subtasks_story ON aos_subtasks(story_id);
CREATE INDEX IF NOT EXISTS idx_aos_assignments_target ON aos_assignments(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_aos_agent_runs_assignment ON aos_agent_runs(assignment_id);
CREATE INDEX IF NOT EXISTS idx_aos_gates_story ON aos_gate_work_orders(linked_ticket_id);
CREATE INDEX IF NOT EXISTS idx_aos_audit_target ON aos_audit_events(target_type, target_id);

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
