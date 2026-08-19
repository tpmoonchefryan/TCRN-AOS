-- 0004 · knowledge spaces, pages, revisions, attachments
--
-- Knowledge is a page tree, not a work-item kind. A page and a ticket answer different
-- questions and have different lifetimes; folding pages into work_item would put a
-- status machine and a due date on a document that wants neither.

CREATE TABLE space (
  id             text        PRIMARY KEY,
  key            text        NOT NULL,
  name           text        NOT NULL,
  description_md text        NOT NULL DEFAULT '',
  project_id     text        REFERENCES project (id) ON DELETE SET NULL,
  version        integer     NOT NULL DEFAULT 1,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz
);

CREATE UNIQUE INDEX space_key_key ON space (upper(key));

CREATE TABLE page (
  id              text        PRIMARY KEY,
  space_id        text        NOT NULL REFERENCES space (id) ON DELETE CASCADE,
  parent_id       text        REFERENCES page (id) ON DELETE SET NULL,
  slug            text        NOT NULL,
  title           text        NOT NULL,
  body_md         text        NOT NULL DEFAULT '',
  status          text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  position        text        NOT NULL DEFAULT 'm',
  created_by      text        REFERENCES principal (id) ON DELETE SET NULL,
  updated_by      text        REFERENCES principal (id) ON DELETE SET NULL,
  -- Freshness is stated, never inferred. A page with no verification is "unknown",
  -- which is a different answer from "fresh" and must not be rendered as one.
  last_verified_at timestamptz,
  last_verified_by text       REFERENCES principal (id) ON DELETE SET NULL,
  staleness_days  integer,
  version         integer     NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE UNIQUE INDEX page_space_slug_key ON page (space_id, slug) WHERE deleted_at IS NULL;
CREATE INDEX page_parent_idx ON page (parent_id) WHERE deleted_at IS NULL;
CREATE INDEX page_space_idx ON page (space_id) WHERE deleted_at IS NULL;

CREATE TABLE page_revision (
  id         text        PRIMARY KEY,
  page_id    text        NOT NULL,
  revision   integer     NOT NULL,
  title      text        NOT NULL,
  body_md    text        NOT NULL,
  changed_by text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX page_revision_key ON page_revision (page_id, revision);

CREATE TABLE page_tag (
  page_id text NOT NULL REFERENCES page (id) ON DELETE CASCADE,
  tag     text NOT NULL,
  PRIMARY KEY (page_id, tag)
);

CREATE INDEX page_tag_tag_idx ON page_tag (tag);

-- A page/work-item link is rendered on BOTH records. One row, read from either end.
CREATE TABLE page_subject_link (
  page_id      text        NOT NULL REFERENCES page (id) ON DELETE CASCADE,
  subject_type text        NOT NULL REFERENCES subject_type (name),
  subject_id   text        NOT NULL,
  created_by   text        REFERENCES principal (id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (page_id, subject_type, subject_id)
);

CREATE INDEX page_subject_link_subject_idx ON page_subject_link (subject_type, subject_id);

-- Content-addressed: the same bytes uploaded twice are one blob with two links.
CREATE TABLE attachment (
  id         text        PRIMARY KEY,
  sha256     text        NOT NULL UNIQUE,
  byte_size  bigint      NOT NULL,
  media_type text        NOT NULL,
  filename   text        NOT NULL,
  created_by text        REFERENCES principal (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE attachment_link (
  attachment_id text        NOT NULL REFERENCES attachment (id) ON DELETE CASCADE,
  subject_type  text        NOT NULL REFERENCES subject_type (name),
  subject_id    text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (attachment_id, subject_type, subject_id)
);

CREATE INDEX attachment_link_subject_idx ON attachment_link (subject_type, subject_id);
