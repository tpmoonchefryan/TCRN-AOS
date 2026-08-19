-- 0001 · identity, projects, membership
--
-- Every table here is tier 1: mutable, versioned, and its prior values are kept in a
-- revision row rather than in the record itself. `version` is the optimistic-concurrency
-- token; a write that does not carry the version it read is refused rather than merged.

CREATE TABLE instance_meta (
  id                     boolean PRIMARY KEY DEFAULT true CHECK (id),
  instance_name          text        NOT NULL,
  bootstrap_completed_at timestamptz,
  policy_version         integer     NOT NULL DEFAULT 1,
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE principal (
  id                   text        PRIMARY KEY,
  handle               text        NOT NULL,
  display_name         text        NOT NULL,
  email                text,
  -- kind is a display-and-audit label. It grants nothing: permissions come from
  -- project_member and is_instance_admin alone, so an agent can never hold authority
  -- a human in the same role would not have.
  kind                 text        NOT NULL CHECK (kind IN ('human', 'agent', 'service')),
  password_phc         text,
  must_change_password boolean     NOT NULL DEFAULT false,
  is_instance_admin    boolean     NOT NULL DEFAULT false,
  disabled_at          timestamptz,
  version              integer     NOT NULL DEFAULT 1,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- Handles are compared case-insensitively so "Ryan" and "ryan" cannot both exist.
CREATE UNIQUE INDEX principal_handle_key ON principal (lower(handle));
CREATE UNIQUE INDEX principal_email_key ON principal (lower(email)) WHERE email IS NOT NULL;

CREATE TABLE session (
  id           text        PRIMARY KEY,
  principal_id text        NOT NULL REFERENCES principal (id) ON DELETE CASCADE,
  token_sha256 text        NOT NULL UNIQUE,
  csrf_secret  text        NOT NULL,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz
);

CREATE INDEX session_principal_idx ON session (principal_id) WHERE revoked_at IS NULL;

CREATE TABLE api_token (
  id           text        PRIMARY KEY,
  principal_id text        NOT NULL REFERENCES principal (id) ON DELETE CASCADE,
  name         text        NOT NULL,
  token_sha256 text        NOT NULL UNIQUE,
  hint         text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz,
  revoked_at   timestamptz,
  last_used_at timestamptz
);

CREATE INDEX api_token_principal_idx ON api_token (principal_id);

CREATE TABLE project (
  id             text        PRIMARY KEY,
  key            text        NOT NULL,
  name           text        NOT NULL,
  description_md text        NOT NULL DEFAULT '',
  -- settings carries per-project switches; governance is opt-in and lives here.
  settings       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  version        integer     NOT NULL DEFAULT 1,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  archived_at    timestamptz,
  deleted_at     timestamptz
);

CREATE UNIQUE INDEX project_key_key ON project (upper(key));

CREATE TABLE project_member (
  project_id   text        NOT NULL REFERENCES project (id) ON DELETE CASCADE,
  principal_id text        NOT NULL REFERENCES principal (id) ON DELETE CASCADE,
  role         text        NOT NULL CHECK (role IN ('viewer', 'contributor', 'maintainer', 'admin')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, principal_id)
);

CREATE INDEX project_member_principal_idx ON project_member (principal_id);

-- The human-readable key (PROJ-123) is allocated from here inside the creating
-- transaction, so two concurrent creates cannot mint the same number.
CREATE TABLE key_sequence (
  project_id text   PRIMARY KEY REFERENCES project (id) ON DELETE CASCADE,
  next_seq   bigint NOT NULL DEFAULT 1
);
