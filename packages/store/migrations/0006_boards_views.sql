-- 0006 · boards, saved views
--
-- A saved view that cannot be bookmarked, shared, or pasted to a colleague is not a
-- saved view. The query lives in a row and is addressable by id; the URL carries the
-- id, so the same link opens the same list for whoever follows it.

CREATE TABLE board (
  id         text        PRIMARY KEY,
  project_id text        NOT NULL REFERENCES project (id) ON DELETE CASCADE,
  name       text        NOT NULL,
  version    integer     NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX board_project_idx ON board (project_id);

CREATE TABLE board_column (
  id       text    PRIMARY KEY,
  board_id text    NOT NULL REFERENCES board (id) ON DELETE CASCADE,
  name     text    NOT NULL,
  status   text    NOT NULL,
  position integer NOT NULL
);

CREATE UNIQUE INDEX board_column_position_key ON board_column (board_id, position);
CREATE INDEX board_column_board_idx ON board_column (board_id);

CREATE TABLE saved_view (
  id           text        PRIMARY KEY,
  project_id   text        REFERENCES project (id) ON DELETE CASCADE,
  owner_id     text        REFERENCES principal (id) ON DELETE CASCADE,
  name         text        NOT NULL,
  query        jsonb       NOT NULL,
  is_shared    boolean     NOT NULL DEFAULT false,
  position     integer     NOT NULL DEFAULT 0,
  version      integer     NOT NULL DEFAULT 1,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX saved_view_scope_idx ON saved_view (project_id, owner_id);
