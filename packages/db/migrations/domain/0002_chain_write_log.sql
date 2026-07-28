-- TCRN-AOS-STORY-113 — the replayable, ordered log of every chain write this
-- cockpit performs (ruling: MIN-007 T6, "写日志前置与矩阵同级" —
-- minutes:a296b0542ddd66fcd0679d34).
--
-- Why it lives in the DOMAIN database rather than the projection one: the log
-- is not derivable. A projection row can be rebuilt from the chain; the exact
-- wire bytes this service sent, in the order it sent them, exist nowhere else
-- once the process exits. Precious data goes in the precious file, and the
-- precious file is the one BK01 (physical snapshot) and BK02 (logical export)
-- already cover — landing here makes backup coverage a property of the
-- filesystem again instead of a new obligation.
--
-- One row per engine-acknowledged write. The unit is the engine call, not the
-- HTTP route: "create work with a title" is two chain events (create + scope
-- annotation) and therefore two rows, because replay re-issues engine calls
-- and a log that merged them could not be replayed faithfully.
--
-- `args_json` is the wire form, serialized once at the moment of sending and
-- stored byte-for-byte. Nothing here re-orders keys, canonicalizes, or
-- prettifies: the engine is the only judge of canonical form, and a second
-- normalization layer in this table would be a second opinion that can drift
-- (the same reasoning that keeps transition rules out of the routes).

CREATE TABLE IF NOT EXISTS aos_chain_write_log (
  -- Monotonic ordinal. AUTOINCREMENT (not bare rowid) so a sequence value is
  -- never reused even across restarts; together with the append-only triggers
  -- below this makes "ordered" a property the database enforces, not a habit.
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  -- Which chain the write targeted.
  partition_id TEXT NOT NULL,
  -- The engine facade tool name (e.g. tcrn_workflow_work_transition).
  verb TEXT NOT NULL,
  -- The wire arguments exactly as serialized for the facade call, stored as
  -- the bytes of that one serialization. Replay = re-issue verb(args) in seq
  -- order against an engine; equality checks compare these bytes directly.
  args_json TEXT NOT NULL CHECK (json_valid(args_json)),
  -- Engine receipt essentials. Nullable because they record what the receipt
  -- actually said, and a receipt that omitted a field must not be logged as
  -- having claimed one.
  record_id TEXT,
  chain_version INTEGER,
  head_event_hash TEXT,
  -- When this service performed the write (second precision, matching the
  -- chain's own instants).
  at TEXT NOT NULL,
  -- Switchover anchor reference (MIN-007 T2/T6). NULL today, by design: the
  -- anchor is minted by the switchover ceremony and does not exist before it.
  -- Backfill semantics — stated here because the append-only triggers make
  -- the obvious alternative impossible: rows are NEVER updated to receive an
  -- anchor later. Instead the value is epoch-scoped: once a switchover
  -- ceremony records its anchor, the service is configured with it and every
  -- subsequent row carries it at insert time. A NULL therefore permanently
  -- reads as "written before any switchover anchor existed", which is a fact
  -- about the row, not a gap to be repaired.
  switch_anchor TEXT
);

CREATE INDEX IF NOT EXISTS aos_chain_write_log_partition
  ON aos_chain_write_log (partition_id, seq);

-- Append-only, following the aos_audit_events precedent in
-- migrations/sqlite/0001_phase1_core.sql: a replay log that can be edited
-- afterwards is testimony, not a log.
CREATE TRIGGER IF NOT EXISTS aos_chain_write_log_no_update
BEFORE UPDATE ON aos_chain_write_log
BEGIN
  SELECT RAISE(ABORT, 'aos_chain_write_log_append_only_update_denied');
END;

CREATE TRIGGER IF NOT EXISTS aos_chain_write_log_no_delete
BEFORE DELETE ON aos_chain_write_log
BEGIN
  SELECT RAISE(ABORT, 'aos_chain_write_log_append_only_delete_denied');
END;
