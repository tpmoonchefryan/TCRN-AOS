-- 0005 · unified search
--
-- The vector is built by the application, not by a Postgres text-search configuration,
-- and the reason is measurable: `to_tsvector('simple', …)` treats an unbroken run of
-- Chinese as ONE token, so a two-character query — the dominant Chinese word form —
-- matches nothing at all. The application emits overlapping bigrams for CJK runs and
-- ordinary lexemes for Latin, and runs the identical emitter on the query side, so the
-- two can never drift apart.
--
-- The escape hatch stays open: pgroonga, pg_bigm and zhparser are a CREATE EXTENSION
-- away in a custom image, and swapping the analyzer is a reindex rather than a rewrite.

CREATE TABLE search_doc (
  subject_type text        NOT NULL REFERENCES subject_type (name),
  subject_id   text        NOT NULL,
  project_id   text,
  space_id     text,
  title        text        NOT NULL,
  body_text    text        NOT NULL DEFAULT '',
  key          text,
  status       text,
  search_vec   tsvector    NOT NULL,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subject_type, subject_id)
);

CREATE INDEX search_doc_vec_idx ON search_doc USING GIN (search_vec);
CREATE INDEX search_doc_project_idx ON search_doc (project_id);

-- Access must never be recorded on a column that ordering depends on. Ranking by a
-- timestamp that reading bumps means opening an entry promotes it to the top of
-- everyone's results — the list reorders itself by who looked at it last.
CREATE TABLE search_access (
  subject_type   text        NOT NULL,
  subject_id     text        NOT NULL,
  last_read_at   timestamptz NOT NULL DEFAULT now(),
  read_count     bigint      NOT NULL DEFAULT 0,
  PRIMARY KEY (subject_type, subject_id)
);
