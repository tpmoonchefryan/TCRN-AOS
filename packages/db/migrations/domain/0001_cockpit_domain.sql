-- TCRN-AOS-STORY-003 — the cockpit's own domain.
--
-- Everything the cockpit adds on top of the chain lives here: who is carrying a
-- ticket, what it is labelled, how urgent someone thinks it is, what people said
-- about it, and how records relate outside the chain's strict parent tree.
--
-- Two properties make this schema different from everything else the platform
-- stores, and both are load-bearing:
--
-- 1. It is the FIRST data that cannot be rebuilt from the chain. The projection
--    database is a derivative — delete it and re-running ingestion reproduces it
--    byte for byte, which is why it is never backed up. These rows have no such
--    source. That is why the two databases are separate files rather than two
--    table groups in one: "precious" and "disposable" becomes a property of the
--    filesystem instead of a rule someone has to remember.
--
-- 2. It never merges into a chain record. A row here points at one by qualified
--    ref (partition + record id) and stops there, which is the engine's own
--    projection-import-truth-ownership boundary. The chain stays the truth; this
--    is commentary attached to it.
--
-- It lives in its own migrations directory rather than beside the runtime ones
-- because it is a different database. The runtime repository applies everything
-- under migrations/sqlite to its own file; putting these tables there would have
-- put the precious data inside the disposable store, which is exactly the
-- distinction the separate file exists to make.
--
-- Dangling refs are allowed on purpose. A chain record can be tombstoned after
-- someone labelled it, and the honest response is to show the annotation with a
-- note that its subject is gone — not to delete a person's comment because a
-- foreign key said so.

CREATE TABLE IF NOT EXISTS aos_domain_annotation (
  -- Qualified ref: which chain, which record. Together these are the identity.
  partition_id TEXT NOT NULL,
  record_id TEXT NOT NULL,
  -- Human-facing key at the time of writing, kept for readability if the
  -- projection is unavailable. Never used for lookup: the record id is.
  external_key TEXT,
  assignee TEXT,
  priority TEXT CHECK (priority IS NULL OR priority IN ('urgent', 'high', 'normal', 'low')),
  -- JSON array. A join table would be tidier and would also mean three queries
  -- to render one row; labels are only ever read whole.
  labels TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(labels)),
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  PRIMARY KEY (partition_id, record_id)
);

CREATE INDEX IF NOT EXISTS aos_domain_annotation_assignee
  ON aos_domain_annotation (assignee);

CREATE TABLE IF NOT EXISTS aos_domain_comment (
  id TEXT PRIMARY KEY,
  partition_id TEXT NOT NULL,
  record_id TEXT NOT NULL,
  author TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  -- Comments are edited in place rather than appended to, because unlike the
  -- chain this store is not a governance record and does not claim to be one.
  -- The distinction is stated in the UI: a comment is discussion, a position is
  -- a governed artefact, and only one of them is evidence.
  edited_at TEXT
);

CREATE INDEX IF NOT EXISTS aos_domain_comment_record
  ON aos_domain_comment (partition_id, record_id, created_at);

CREATE TABLE IF NOT EXISTS aos_domain_relation (
  id TEXT PRIMARY KEY,
  -- The relation's own side.
  partition_id TEXT NOT NULL,
  record_id TEXT NOT NULL,
  -- The vocabulary is the design system's workRelationshipTypes, mirrored here
  -- so the database refuses a type the UI cannot render. Mirrored, not owned:
  -- if the two ever disagree the constraint is what surfaces it.
  relation TEXT NOT NULL CHECK (relation IN (
    'blocks', 'blocked_by', 'depends_on', 'relates_to', 'duplicates',
    'supersedes', 'split_from', 'caused_by', 'implements', 'verifies',
    'reviews', 'refreshes'
  )),
  target_partition_id TEXT NOT NULL,
  target_record_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  UNIQUE (partition_id, record_id, relation, target_partition_id, target_record_id)
);

CREATE INDEX IF NOT EXISTS aos_domain_relation_source
  ON aos_domain_relation (partition_id, record_id);
CREATE INDEX IF NOT EXISTS aos_domain_relation_target
  ON aos_domain_relation (target_partition_id, target_record_id);
