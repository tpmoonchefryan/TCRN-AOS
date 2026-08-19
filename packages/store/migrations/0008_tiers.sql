-- 0008 · releases, idempotency, and the tier enforcement itself
--
-- Tiers 2 and 3 are enforced by the database, not by discipline in the application. An
-- append-only table that is only append-only because every current call site happens to
-- INSERT is not append-only; it is a convention waiting for the first exception.

CREATE TABLE release_member (
  release_id   text        NOT NULL REFERENCES work_item (id) ON DELETE CASCADE,
  work_item_id text        NOT NULL REFERENCES work_item (id) ON DELETE CASCADE,
  added_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (release_id, work_item_id),
  CHECK (release_id <> work_item_id)
);

CREATE INDEX release_member_item_idx ON release_member (work_item_id);

-- Only successful responses are replayed. Caching a refusal turns a transient failure
-- into a permanent one: the retry that would have succeeded gets handed the old error
-- forever.
CREATE TABLE idempotency_record (
  key            text        NOT NULL,
  principal_id   text        NOT NULL,
  request_digest text        NOT NULL,
  status_code    integer     NOT NULL,
  response_json  jsonb       NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (key, principal_id)
);

CREATE INDEX idempotency_created_idx ON idempotency_record (created_at);

-- ---------------------------------------------------------------------------
-- Tier 2 — append-only, with one named exemption for erasure.
-- ---------------------------------------------------------------------------

CREATE FUNCTION aos_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'AOS_APPEND_ONLY: % is append-only; % is not permitted', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

-- Revision rows hold the only copy of prior values, so erasure has to be able to reach
-- them. It reaches them through one door: a transaction that has explicitly set
-- aos.purge and that writes a purge_journal row for what it did.
CREATE FUNCTION aos_append_only_purgeable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('aos.purge', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'AOS_APPEND_ONLY: % is append-only; % is not permitted', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER activity_event_append_only
  BEFORE UPDATE OR DELETE ON activity_event
  FOR EACH ROW EXECUTE FUNCTION aos_append_only();

-- purge_journal deliberately gets the UNEXEMPTED function: the record that a purge
-- happened must not itself be purgeable, or the erasure path can erase its own trace.
CREATE TRIGGER purge_journal_append_only
  BEFORE UPDATE OR DELETE ON purge_journal
  FOR EACH ROW EXECUTE FUNCTION aos_append_only();

CREATE TRIGGER work_item_revision_append_only
  BEFORE UPDATE OR DELETE ON work_item_revision
  FOR EACH ROW EXECUTE FUNCTION aos_append_only_purgeable();

CREATE TRIGGER comment_revision_append_only
  BEFORE UPDATE OR DELETE ON comment_revision
  FOR EACH ROW EXECUTE FUNCTION aos_append_only_purgeable();

CREATE TRIGGER page_revision_append_only
  BEFORE UPDATE OR DELETE ON page_revision
  FOR EACH ROW EXECUTE FUNCTION aos_append_only_purgeable();

-- ---------------------------------------------------------------------------
-- Tier 3 — immutable, corrected only by writing a successor that supersedes.
-- ---------------------------------------------------------------------------

CREATE TRIGGER deliberation_position_immutable
  BEFORE UPDATE OR DELETE ON deliberation_position
  FOR EACH ROW EXECUTE FUNCTION aos_append_only();

CREATE TRIGGER deliberation_minutes_immutable
  BEFORE UPDATE OR DELETE ON deliberation_minutes
  FOR EACH ROW EXECUTE FUNCTION aos_append_only();

CREATE TRIGGER gate_decision_immutable
  BEFORE UPDATE OR DELETE ON gate_decision
  FOR EACH ROW EXECUTE FUNCTION aos_append_only();

CREATE TRIGGER decision_immutable
  BEFORE UPDATE OR DELETE ON decision
  FOR EACH ROW EXECUTE FUNCTION aos_append_only();
