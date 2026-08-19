-- 0002 · work items, the status machine, relations, labels
--
-- One table holds every kind. Kind is a column, not a separate system, which is what
-- lets every screen treat them all as tickets and what lets a new kind arrive without
-- a new table, a new interface, and a new set of parent arrays to keep in sync.

CREATE TABLE work_item (
  id          text        PRIMARY KEY,
  project_id  text        NOT NULL REFERENCES project (id) ON DELETE CASCADE,
  seq         bigint      NOT NULL,
  key         text        NOT NULL,
  kind        text        NOT NULL CHECK (kind IN ('initiative', 'epic', 'story', 'subtask', 'review', 'incident', 'release')),
  parent_id   text        REFERENCES work_item (id) ON DELETE SET NULL,
  title       text        NOT NULL,
  body_md     text        NOT NULL DEFAULT '',
  status      text        NOT NULL CHECK (status IN ('planned', 'ready', 'active', 'blocked', 'pending_acceptance', 'done', 'cancelled')),
  assignee_id text        REFERENCES principal (id) ON DELETE SET NULL,
  reporter_id text        REFERENCES principal (id) ON DELETE SET NULL,
  priority    text        NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
  estimate    jsonb,
  due_at      timestamptz,
  -- Lexicographic rank so a board reorder touches one row rather than renumbering a column.
  rank        text        NOT NULL DEFAULT 'm',
  version     integer     NOT NULL DEFAULT 1,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  closed_at   timestamptz,
  deleted_at  timestamptz
);

CREATE UNIQUE INDEX work_item_key_key ON work_item (key);
CREATE UNIQUE INDEX work_item_project_seq_key ON work_item (project_id, seq);
CREATE INDEX work_item_project_status_idx ON work_item (project_id, status) WHERE deleted_at IS NULL;
CREATE INDEX work_item_assignee_idx ON work_item (assignee_id) WHERE deleted_at IS NULL;
CREATE INDEX work_item_parent_idx ON work_item (parent_id) WHERE deleted_at IS NULL;
CREATE INDEX work_item_updated_idx ON work_item (updated_at DESC);

-- The state machine lives in data, not in a switch statement, so a project can be shown
-- its own transitions and so the set can be read by a test without parsing code.
-- project_id NULL is the instance-wide default.
CREATE TABLE status_transition (
  project_id  text REFERENCES project (id) ON DELETE CASCADE,
  from_status text NOT NULL,
  to_status   text NOT NULL
);

CREATE UNIQUE INDEX status_transition_default_key
  ON status_transition (from_status, to_status) WHERE project_id IS NULL;
CREATE UNIQUE INDEX status_transition_project_key
  ON status_transition (project_id, from_status, to_status) WHERE project_id IS NOT NULL;

-- Reopen is ordinary: done -> active and cancelled -> planned are permitted transitions,
-- not exceptions. A product whose terminal states are truly terminal is a ledger, and
-- people do not run projects out of a ledger.
INSERT INTO status_transition (project_id, from_status, to_status) VALUES
  (NULL, 'planned', 'ready'),
  (NULL, 'planned', 'active'),
  (NULL, 'planned', 'cancelled'),
  (NULL, 'ready', 'active'),
  (NULL, 'ready', 'planned'),
  (NULL, 'ready', 'blocked'),
  (NULL, 'ready', 'cancelled'),
  (NULL, 'active', 'blocked'),
  (NULL, 'active', 'pending_acceptance'),
  (NULL, 'active', 'done'),
  (NULL, 'active', 'ready'),
  (NULL, 'active', 'cancelled'),
  (NULL, 'blocked', 'active'),
  (NULL, 'blocked', 'ready'),
  (NULL, 'blocked', 'cancelled'),
  (NULL, 'pending_acceptance', 'active'),
  (NULL, 'pending_acceptance', 'done'),
  (NULL, 'pending_acceptance', 'cancelled'),
  (NULL, 'done', 'active'),
  (NULL, 'cancelled', 'planned');

-- Before-image: the row holds what the record looked like BEFORE the change it records.
-- Values live here and nowhere else in the audit path, which is what makes erasure
-- possible without breaking the append-only chain.
CREATE TABLE work_item_revision (
  id            text        PRIMARY KEY,
  work_item_id  text        NOT NULL,
  revision      integer     NOT NULL,
  prev          jsonb       NOT NULL,
  changed_by    text,
  changed_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX work_item_revision_key ON work_item_revision (work_item_id, revision);

CREATE TABLE relation (
  id           text        PRIMARY KEY,
  from_id      text        NOT NULL REFERENCES work_item (id) ON DELETE CASCADE,
  relation     text        NOT NULL CHECK (relation IN (
                             'blocks', 'blocked_by', 'depends_on', 'relates_to',
                             'duplicates', 'supersedes', 'split_from', 'caused_by',
                             'implements', 'verifies', 'reviews', 'refreshes')),
  to_id        text        NOT NULL REFERENCES work_item (id) ON DELETE CASCADE,
  created_by   text        REFERENCES principal (id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (from_id <> to_id)
);

CREATE UNIQUE INDEX relation_triple_key ON relation (from_id, relation, to_id);
-- Both directions are indexed because a relation is always read from both ends:
-- showing only outbound links is how a blocked item comes to look unblocked.
CREATE INDEX relation_to_idx ON relation (to_id);

CREATE TABLE label (
  id         text        PRIMARY KEY,
  project_id text        NOT NULL REFERENCES project (id) ON DELETE CASCADE,
  name       text        NOT NULL,
  color      text        NOT NULL DEFAULT 'neutral',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX label_project_name_key ON label (project_id, lower(name));

CREATE TABLE work_item_label (
  work_item_id text NOT NULL REFERENCES work_item (id) ON DELETE CASCADE,
  label_id     text NOT NULL REFERENCES label (id) ON DELETE CASCADE,
  PRIMARY KEY (work_item_id, label_id)
);

CREATE INDEX work_item_label_label_idx ON work_item_label (label_id);
