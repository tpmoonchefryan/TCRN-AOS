CREATE TABLE IF NOT EXISTS aos_knowledge_entries (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  role_scope TEXT NOT NULL,
  project TEXT NOT NULL,
  category TEXT NOT NULL,
  knowledge_kind TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('canonical', 'draft', 'deprecated')),
  last_verified TEXT NOT NULL CHECK (last_verified GLOB '????-??-??' OR last_verified GLOB '????-??-??T*'),
  staleness_policy TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  source_digest TEXT NOT NULL,
  tags TEXT NOT NULL CHECK (json_valid(tags) AND json_type(tags) = 'array'),
  summary TEXT NOT NULL,
  body TEXT NOT NULL,
  access_count INTEGER NOT NULL DEFAULT 0 CHECK (access_count >= 0),
  last_accessed TEXT,
  record_json TEXT NOT NULL CHECK (json_valid(record_json)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_aos_knowledge_entries_role_scope ON aos_knowledge_entries(role_scope);
CREATE INDEX IF NOT EXISTS idx_aos_knowledge_entries_project ON aos_knowledge_entries(project);
CREATE INDEX IF NOT EXISTS idx_aos_knowledge_entries_category ON aos_knowledge_entries(category);
CREATE INDEX IF NOT EXISTS idx_aos_knowledge_entries_status ON aos_knowledge_entries(status);
CREATE INDEX IF NOT EXISTS idx_aos_knowledge_entries_last_verified ON aos_knowledge_entries(last_verified);
CREATE INDEX IF NOT EXISTS idx_aos_knowledge_entries_source_digest ON aos_knowledge_entries(source_digest);

CREATE VIRTUAL TABLE IF NOT EXISTS aos_knowledge_entries_fts
USING fts5(title, summary, tags, body, content = 'aos_knowledge_entries', content_rowid = 'rowid');

CREATE TRIGGER IF NOT EXISTS aos_knowledge_entries_fts_insert
AFTER INSERT ON aos_knowledge_entries
BEGIN
  INSERT INTO aos_knowledge_entries_fts(rowid, title, summary, tags, body)
  VALUES (new.rowid, new.title, new.summary, new.tags, new.body);
END;

CREATE TRIGGER IF NOT EXISTS aos_knowledge_entries_fts_delete
AFTER DELETE ON aos_knowledge_entries
BEGIN
  INSERT INTO aos_knowledge_entries_fts(aos_knowledge_entries_fts, rowid, title, summary, tags, body)
  VALUES ('delete', old.rowid, old.title, old.summary, old.tags, old.body);
END;

CREATE TRIGGER IF NOT EXISTS aos_knowledge_entries_fts_update
AFTER UPDATE ON aos_knowledge_entries
BEGIN
  INSERT INTO aos_knowledge_entries_fts(aos_knowledge_entries_fts, rowid, title, summary, tags, body)
  VALUES ('delete', old.rowid, old.title, old.summary, old.tags, old.body);
  INSERT INTO aos_knowledge_entries_fts(rowid, title, summary, tags, body)
  VALUES (new.rowid, new.title, new.summary, new.tags, new.body);
END;
