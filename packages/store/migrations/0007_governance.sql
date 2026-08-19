-- 0007 · governance: gates, deliberations, decisions (tier 3)
--
-- Per-project opt-in. A project with governance off never sees any of this, and its
-- behaviour must be byte-identical to a build that lacks these tables.
--
-- Everything here is tier 3: immutable, corrected by supersession. The whole value of
-- these records is that a named person said a specific thing at a specific time, so a
-- correction is a NEW row pointing at what it supersedes, and the superseded row stays
-- readable with a line through it. A defeated position remains on the record.

CREATE TABLE gate_definition (
  id            text        PRIMARY KEY,
  project_id    text        NOT NULL REFERENCES project (id) ON DELETE CASCADE,
  title         text        NOT NULL,
  outcome_class text        NOT NULL CHECK (outcome_class IN ('role_decision', 'owner_intent_required')),
  -- Which status transition this gate guards. Default: nothing reaches done past an
  -- unsatisfied gate.
  blocks_status text        NOT NULL DEFAULT 'done',
  requires_evidence boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX gate_definition_project_idx ON gate_definition (project_id);

CREATE TABLE gate (
  id            text        PRIMARY KEY,
  project_id    text        NOT NULL REFERENCES project (id) ON DELETE CASCADE,
  definition_id text        REFERENCES gate_definition (id) ON DELETE SET NULL,
  work_item_id  text        REFERENCES work_item (id) ON DELETE CASCADE,
  title         text        NOT NULL,
  outcome_class text        NOT NULL CHECK (outcome_class IN ('role_decision', 'owner_intent_required')),
  status        text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'satisfied', 'blocked')),
  blocks_status text        NOT NULL DEFAULT 'done',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  version       integer     NOT NULL DEFAULT 1
);

CREATE INDEX gate_work_item_idx ON gate (work_item_id) WHERE status <> 'satisfied';
CREATE INDEX gate_project_idx ON gate (project_id);

CREATE TABLE deliberation (
  id              text        PRIMARY KEY,
  project_id      text        NOT NULL REFERENCES project (id) ON DELETE CASCADE,
  type            text        NOT NULL CHECK (type IN ('strategy', 'architecture', 'risk', 'verification', 'release', 'incident', 'retrospective')),
  title           text        NOT NULL,
  desired_outcome text        NOT NULL DEFAULT '',
  -- Declared up front. An undeclared execution mode reads as unverified, never as
  -- multi-party.
  execution_mode  text        NOT NULL DEFAULT 'undeclared' CHECK (execution_mode IN ('undeclared', 'synthesis_only', 'multi_party')),
  status          text        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'cancelled')),
  created_by      text        REFERENCES principal (id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  closed_at       timestamptz,
  version         integer     NOT NULL DEFAULT 1
);

CREATE INDEX deliberation_project_idx ON deliberation (project_id, created_at DESC);

CREATE TABLE deliberation_link (
  deliberation_id text NOT NULL REFERENCES deliberation (id) ON DELETE CASCADE,
  subject_type    text NOT NULL REFERENCES subject_type (name),
  subject_id      text NOT NULL,
  PRIMARY KEY (deliberation_id, subject_type, subject_id)
);

CREATE INDEX deliberation_link_subject_idx ON deliberation_link (subject_type, subject_id);

-- Round and reply are explicit columns. Inferring them from prose in the first line is
-- a heuristic over free text, and it silently mis-attributes who answered whom.
CREATE TABLE deliberation_position (
  id              text        PRIMARY KEY,
  deliberation_id text        NOT NULL REFERENCES deliberation (id) ON DELETE CASCADE,
  round           integer     NOT NULL DEFAULT 1,
  responds_to_id  text        REFERENCES deliberation_position (id) ON DELETE SET NULL,
  actor_id        text        REFERENCES principal (id) ON DELETE SET NULL,
  actor_label     text        NOT NULL,
  persona         text,
  body_md         text        NOT NULL,
  risks           jsonb       NOT NULL DEFAULT '[]'::jsonb,
  recommendations jsonb       NOT NULL DEFAULT '[]'::jsonb,
  supersedes_id   text        REFERENCES deliberation_position (id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX deliberation_position_idx ON deliberation_position (deliberation_id, round, created_at);

CREATE TABLE deliberation_minutes (
  id              text        PRIMARY KEY,
  deliberation_id text        NOT NULL REFERENCES deliberation (id) ON DELETE CASCADE,
  summary_md      text        NOT NULL,
  outcome_class   text        NOT NULL CHECK (outcome_class IN ('discussion_only', 'recommendation', 'role_decision', 'blocked', 'owner_intent_required')),
  decisions       jsonb       NOT NULL DEFAULT '[]'::jsonb,
  unresolved      jsonb       NOT NULL DEFAULT '[]'::jsonb,
  author_label    text        NOT NULL,
  supersedes_id   text        REFERENCES deliberation_minutes (id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX deliberation_minutes_idx ON deliberation_minutes (deliberation_id, created_at DESC);

-- Clearing a gate cites the minutes that cleared it. Without the citation the gate
-- stays pending, and the transition it guards is refused with that reason stated.
CREATE TABLE gate_decision (
  id            text        PRIMARY KEY,
  gate_id       text        NOT NULL REFERENCES gate (id) ON DELETE CASCADE,
  decision      text        NOT NULL CHECK (decision IN ('satisfied', 'blocked')),
  evidence_kind text        NOT NULL DEFAULT 'minutes',
  evidence_id   text,
  rationale_md  text        NOT NULL DEFAULT '',
  decided_by    text        REFERENCES principal (id) ON DELETE SET NULL,
  decider_label text        NOT NULL,
  supersedes_id text        REFERENCES gate_decision (id) ON DELETE SET NULL,
  decided_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX gate_decision_gate_idx ON gate_decision (gate_id, decided_at DESC);

CREATE TABLE decision (
  id            text        PRIMARY KEY,
  project_id    text        NOT NULL REFERENCES project (id) ON DELETE CASCADE,
  title         text        NOT NULL,
  body_md       text        NOT NULL DEFAULT '',
  outcome_class text        NOT NULL CHECK (outcome_class IN ('discussion_only', 'recommendation', 'role_decision', 'blocked', 'owner_intent_required')),
  source_kind   text,
  source_id     text,
  decided_by    text        REFERENCES principal (id) ON DELETE SET NULL,
  decider_label text        NOT NULL,
  supersedes_id text        REFERENCES decision (id) ON DELETE SET NULL,
  decided_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX decision_project_idx ON decision (project_id, decided_at DESC);
