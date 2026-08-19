-- 0003 · the polymorphic subject convention, comments, watchers, activity
--
-- Everything that can be commented on, watched, attached to, searched, or audited is
-- addressed as (subject_type, subject_id). The vocabulary is declared here ONCE, against
-- every entity that will ever exist rather than only the ones that exist today, because
-- widening it later means migrating five tables at once and rewriting every query that
-- joins them.

CREATE TABLE subject_type (
  name text PRIMARY KEY
);

INSERT INTO subject_type (name) VALUES
  ('work_item'), ('page'), ('project'), ('space'),
  ('gate'), ('deliberation'), ('decision'), ('release'),
  ('principal'), ('comment'), ('attachment');

CREATE TABLE comment (
  id                text        PRIMARY KEY,
  subject_type      text        NOT NULL REFERENCES subject_type (name),
  subject_id        text        NOT NULL,
  project_id        text        REFERENCES project (id) ON DELETE CASCADE,
  parent_comment_id text        REFERENCES comment (id) ON DELETE CASCADE,
  -- The taxonomy distinguishes a person stating intent from an agent observing,
  -- proposing, or deciding. It is what lets a reader see who is asking and who is
  -- answering without reading every body.
  type              text        NOT NULL DEFAULT 'human_intent' CHECK (type IN (
                                  'human_intent', 'agent_observation', 'agent_proposal',
                                  'agent_decision', 'conference_minute', 'gate_result',
                                  'evidence_note', 'release_note_draft')),
  author_id         text        REFERENCES principal (id) ON DELETE SET NULL,
  body_md           text        NOT NULL,
  version           integer     NOT NULL DEFAULT 1,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);

CREATE INDEX comment_subject_idx ON comment (subject_type, subject_id, created_at);
CREATE INDEX comment_thread_idx ON comment (parent_comment_id) WHERE parent_comment_id IS NOT NULL;
CREATE INDEX comment_author_idx ON comment (author_id);

CREATE TABLE comment_revision (
  id         text        PRIMARY KEY,
  comment_id text        NOT NULL,
  revision   integer     NOT NULL,
  prev       jsonb       NOT NULL,
  changed_by text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX comment_revision_key ON comment_revision (comment_id, revision);

CREATE TABLE mention (
  comment_id   text NOT NULL REFERENCES comment (id) ON DELETE CASCADE,
  principal_id text NOT NULL REFERENCES principal (id) ON DELETE CASCADE,
  PRIMARY KEY (comment_id, principal_id)
);

CREATE TABLE watcher (
  subject_type text        NOT NULL REFERENCES subject_type (name),
  subject_id   text        NOT NULL,
  principal_id text        NOT NULL REFERENCES principal (id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subject_type, subject_id, principal_id)
);

CREATE INDEX watcher_principal_idx ON watcher (principal_id);

-- Tier 2. The activity stream records THAT a field changed and points at the revision
-- row holding what it used to say; it never stores the value itself. That split is what
-- lets a purge remove personal data from the revision rows while the immutable stream
-- stays complete and unbroken.
CREATE TABLE activity_event (
  id             bigserial   PRIMARY KEY,
  actor_id       text,
  actor_label    text        NOT NULL,
  action         text        NOT NULL,
  subject_type   text        NOT NULL REFERENCES subject_type (name),
  subject_id     text        NOT NULL,
  project_id     text,
  field_names    jsonb       NOT NULL DEFAULT '[]'::jsonb,
  revision_ref   text,
  policy_version integer     NOT NULL DEFAULT 1,
  occurred_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX activity_subject_idx ON activity_event (subject_type, subject_id, id DESC);
CREATE INDEX activity_project_idx ON activity_event (project_id, id DESC);
CREATE INDEX activity_actor_idx ON activity_event (actor_id, id DESC);

CREATE TABLE notification (
  id           text        PRIMARY KEY,
  principal_id text        NOT NULL REFERENCES principal (id) ON DELETE CASCADE,
  kind         text        NOT NULL,
  subject_type text        NOT NULL REFERENCES subject_type (name),
  subject_id   text        NOT NULL,
  subject_label text       NOT NULL DEFAULT '',
  actor_label  text        NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now(),
  read_at      timestamptz
);

CREATE INDEX notification_inbox_idx ON notification (principal_id, created_at DESC);
CREATE INDEX notification_unread_idx ON notification (principal_id) WHERE read_at IS NULL;

-- Tier 2. A purge is a named, journalled act. The journal's own trigger has no
-- exemption, so the record that a purge happened cannot itself be purged.
CREATE TABLE purge_journal (
  id           bigserial   PRIMARY KEY,
  actor_label  text        NOT NULL,
  reason       text        NOT NULL,
  subject_type text        NOT NULL,
  subject_id   text        NOT NULL,
  rows_removed integer     NOT NULL DEFAULT 0,
  purged_at    timestamptz NOT NULL DEFAULT now()
);
