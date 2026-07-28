import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * The O3 row mirror (STORY-114, ruling MIN-007 T2: "O3 行镜像为矩阵仪器,
 * 明确不备" — minutes:a296b0542ddd66fcd0679d34): one row per chain event,
 * hash columns included, verified on ingest by the engine's own pure
 * validator, and append-only once written.
 *
 * What it is for: the switchover consistency matrix needs an instrument that
 * can answer "does the copy hold exactly the events the chain holds" at row
 * granularity. The projection store cannot answer that — it keeps derived
 * current state and replaces partitions wholesale. This table keeps the events
 * themselves, with their hash linkage, so a comparison is a byte comparison.
 *
 * What it deliberately is NOT:
 *
 * - NOT a second truth. Every row is derived from the governed read surface
 *   and re-derivable from it; the chain stays the only authority. That is why
 *   this table is EXCLUDED from the backup surface (the ruling's "明确不备"):
 *   backing it up would create a second restorable copy of chain history whose
 *   divergence from a restored chain nobody could adjudicate.
 * - NOT a second validator. Hash checking is done by importing the engine
 *   protocol's `validateEventChain` — a pure function, imported read-only from
 *   the governed copy's built output — never by reimplementing the canonical
 *   form here. The engine is the only judge of canonical bytes; this module
 *   only stores what the engine's own `canonicalJson` says the bytes are.
 * - NOT incremental-trusting. `validateEventChain` requires the full chain
 *   from sequence 1 (hash linkage cannot be checked from the middle), so
 *   ingest always takes the complete event list, verifies it whole, then
 *   appends only the rows past the stored head — after proving the overlap is
 *   byte-identical to what was stored before. A divergent overlap is refused,
 *   loudly: the mirror never repairs itself by overwriting, because a mirror
 *   that can be overwritten is not evidence of anything.
 */

/** The engine protocol surface this module consumes, structurally typed. */
export interface EngineProtocol {
  /** Validates a complete chain and returns it ordered by sequence; throws on any corruption. */
  validateEventChain(events: readonly unknown[]): readonly ChainEvent[];
  /** The engine's canonical serialization — the only source of "规范字节". */
  canonicalJson(value: unknown): string;
}

/** One chain event as the engine's export/validate surfaces shape it. */
export interface ChainEvent {
  readonly schemaVersion: string;
  readonly id: string;
  readonly streamId: string;
  readonly sequence: number;
  readonly occurredAt: string;
  readonly priorHash: string | null;
  readonly payload: unknown;
  readonly payloadHash: string;
  readonly eventHash: string;
}

export interface MirroredEventRow {
  partitionId: string;
  sequence: number;
  eventId: string;
  streamId: string;
  occurredAt: string;
  priorHash: string | null;
  payloadHash: string;
  eventHash: string;
  /** The engine's canonical serialization of the whole event record. */
  canonicalJson: string;
  /** Chain version at the ingest that appended this row. */
  chainVersion: number;
}

export class EventMirrorError extends Error {
  constructor(message: string, readonly reasonCode: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "EventMirrorError";
  }
}

/**
 * Import the engine protocol's pure functions from the governed copy, read-only.
 *
 * The path points at the governed installation's built output; nothing here
 * writes to it, spawns it, or holds a lease on it — this is a library import
 * of two pure functions, which is exactly what the O3 ruling permits
 * ("validateEventChain 复验+规范字节", read-only import from the governed
 * copy path). The default resolves the same installation root the cockpit
 * service already uses for the MCP facade.
 */
/** What loadEngineProtocol returns: the protocol plus the judge's identity. */
export interface LoadedEngineProtocol extends EngineProtocol {
  /**
   * The governed copy's own package.json version. Every hash verdict this
   * module reports is really that copy's verdict, so who the judge is must be
   * on record and checkable, not implicit in a filesystem path. `null` means
   * the copy's package.json was absent or unreadable — recorded honestly
   * rather than invented, and left to the caller to treat as the finding it is.
   */
  engineVersion: string | null;
}

export async function loadEngineProtocol(installRoot?: string): Promise<LoadedEngineProtocol> {
  const root = installRoot ?? resolve(homedir(), ".tcrn-workflow/tcrn-workflow");
  const modulePath = resolve(root, "dist/build/packages/protocol/src/index.js");
  let module: Partial<EngineProtocol>;
  try {
    module = await import(pathToFileURL(modulePath).href) as Partial<EngineProtocol>;
  } catch (error) {
    // A missing judge is a named failure, never a bare import error a caller
    // might mistake for a bug in this module. The cause rides along untouched.
    throw new EventMirrorError(
      `governed engine protocol could not be imported from ${modulePath}: ` +
      (error instanceof Error ? error.message : String(error)),
      "EVENT_MIRROR_PROTOCOL_UNAVAILABLE",
      { cause: error }
    );
  }
  if (typeof module.validateEventChain !== "function" || typeof module.canonicalJson !== "function") {
    throw new EventMirrorError(
      "governed engine protocol module lacks validateEventChain/canonicalJson",
      "EVENT_MIRROR_PROTOCOL_UNAVAILABLE"
    );
  }
  let engineVersion: string | null = null;
  try {
    const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as { version?: unknown };
    engineVersion = typeof manifest.version === "string" ? manifest.version : null;
  } catch {
    engineVersion = null;
  }
  return {
    validateEventChain: module.validateEventChain,
    canonicalJson: module.canonicalJson,
    engineVersion
  };
}

/**
 * The mirror store. Like the projection store it is derived and disposable —
 * give it its own database file, never the precious domain one, and never a
 * path a backup manifest covers.
 */
const APPEND_ONLY_TRIGGERS = ["aos_event_mirror_no_update", "aos_event_mirror_no_delete"] as const;

export class EventMirrorStore {
  private readonly db: DatabaseSync;
  /**
   * True when the database already carried the mirror table at open time but
   * was missing one or both append-only triggers — the signature of a handle
   * that DROPped them to rewrite rows. The constructor's `IF NOT EXISTS` DDL
   * restores the triggers going forward, so this pre-DDL observation is the
   * only place the tampering signature survives; `verify` turns it red.
   */
  private readonly triggersMissingOnOpen: boolean;

  constructor(databasePath = ":memory:") {
    this.db = new DatabaseSync(databasePath);
    this.db.exec("PRAGMA journal_mode = WAL");
    const preExisting = this.db.prepare(`SELECT
        (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'aos_event_mirror') AS tables,
        (SELECT COUNT(*) FROM sqlite_master WHERE type = 'trigger' AND name IN ('${APPEND_ONLY_TRIGGERS.join("','")}')) AS triggers
      `).get() as { tables: number; triggers: number };
    this.triggersMissingOnOpen = preExisting.tables > 0 && preExisting.triggers < APPEND_ONLY_TRIGGERS.length;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS aos_event_mirror (
        partition_id TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        event_id TEXT NOT NULL,
        stream_id TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        -- NULL exactly at sequence 1, mirroring the chain's own genesis rule.
        prior_hash TEXT,
        payload_hash TEXT NOT NULL,
        event_hash TEXT NOT NULL,
        -- The engine's canonical bytes for the whole event record, stored so a
        -- later verification can re-run validateEventChain from this table
        -- alone and compare digests without re-reading the chain.
        canonical_json TEXT NOT NULL CHECK (json_valid(canonical_json)),
        -- Version keying: which chain version's ingest appended this row.
        -- Rows are never rewritten at later versions — the chain is
        -- append-only, so a later version only ever adds rows after these.
        chain_version INTEGER NOT NULL,
        PRIMARY KEY (partition_id, sequence)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS aos_event_mirror_event_hash
        ON aos_event_mirror (partition_id, event_hash);
    `);
    // Append-only, same shape as the aos_audit_events / aos_chain_write_log
    // precedents: an instrument whose rows can be edited measures nothing.
    // Honest limit: these triggers stop ACCIDENTAL writes; they do not stop a
    // deliberate handle-holder who DROPs them first. Tamper-evidence for that
    // case is carried by `verify` (trigger-presence self-check plus the
    // engine's whole-chain re-validation) and by the cross-container
    // consistency matrix, never by the trigger itself.
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS aos_event_mirror_no_update
      BEFORE UPDATE ON aos_event_mirror
      BEGIN
        SELECT RAISE(ABORT, 'aos_event_mirror_append_only_update_denied');
      END;
      CREATE TRIGGER IF NOT EXISTS aos_event_mirror_no_delete
      BEFORE DELETE ON aos_event_mirror
      BEGIN
        SELECT RAISE(ABORT, 'aos_event_mirror_append_only_delete_denied');
      END;
    `);
  }

  /** Highest mirrored sequence for a partition, or 0 when none are held. */
  head(partitionId: string): number {
    const row = this.db.prepare(
      "SELECT MAX(sequence) AS s FROM aos_event_mirror WHERE partition_id = ?"
    ).get(partitionId) as { s?: number | null } | undefined;
    return typeof row?.s === "number" ? row.s : 0;
  }

  /**
   * Ingest the complete event list of one partition at one chain version.
   *
   * The whole list is validated by the engine's `validateEventChain` first —
   * hash linkage cannot be verified from the middle of a chain, so partial
   * input is refused rather than trusted. Then the overlap with already-held
   * rows is compared by event hash and canonical bytes; only rows past the
   * held head are appended. Returns how many rows were appended.
   */
  ingest(partitionId: string, chainVersion: number, events: readonly unknown[], protocol: EngineProtocol): number {
    // The engine judges the chain. Anything it refuses, this mirror refuses.
    const ordered = protocol.validateEventChain(events);

    const held = this.head(partitionId);
    if (ordered.length < held) {
      throw new EventMirrorError(
        `chain presented ${ordered.length} events but the mirror already holds ${held} — an append-only chain cannot shrink`,
        "EVENT_MIRROR_CHAIN_SHRANK"
      );
    }

    // Overlap check before any write: every already-held sequence must carry
    // the same event, byte for byte. A mismatch means one side's history is
    // not the other's, and that is a finding to report, never to overwrite.
    const heldRows = this.db.prepare(
      "SELECT sequence, event_hash, canonical_json FROM aos_event_mirror WHERE partition_id = ? ORDER BY sequence"
    ).all(partitionId) as Array<{ sequence: number; event_hash: string; canonical_json: string }>;
    for (const row of heldRows) {
      const incoming = ordered[row.sequence - 1];
      if (!incoming || incoming.eventHash !== row.event_hash
        || protocol.canonicalJson(incoming) !== row.canonical_json) {
        throw new EventMirrorError(
          `event at sequence ${row.sequence} diverges from the mirrored row`,
          "EVENT_MIRROR_DIVERGENCE"
        );
      }
    }

    const insert = this.db.prepare(`INSERT INTO aos_event_mirror
      (partition_id, sequence, event_id, stream_id, occurred_at, prior_hash, payload_hash, event_hash, canonical_json, chain_version)
      VALUES (?,?,?,?,?,?,?,?,?,?)`);
    this.db.exec("BEGIN");
    try {
      let appended = 0;
      for (const event of ordered.slice(held)) {
        insert.run(partitionId, event.sequence, event.id, event.streamId, event.occurredAt,
          event.priorHash, event.payloadHash, event.eventHash,
          protocol.canonicalJson(event), chainVersion);
        appended += 1;
      }
      this.db.exec("COMMIT");
      return appended;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  /** All mirrored rows of a partition, in sequence order. */
  listRows(partitionId: string): MirroredEventRow[] {
    return (this.db.prepare(
      "SELECT * FROM aos_event_mirror WHERE partition_id = ? ORDER BY sequence"
    ).all(partitionId) as Array<Record<string, unknown>>).map((row) => ({
      partitionId: String(row.partition_id),
      sequence: Number(row.sequence),
      eventId: String(row.event_id),
      streamId: String(row.stream_id),
      occurredAt: String(row.occurred_at),
      priorHash: (row.prior_hash as string) ?? null,
      payloadHash: String(row.payload_hash),
      eventHash: String(row.event_hash),
      canonicalJson: String(row.canonical_json),
      chainVersion: Number(row.chain_version)
    }));
  }

  /**
   * Re-verify the mirror from its own stored bytes: parse every canonical row
   * back into an event and run the engine's whole-chain validation again.
   * Green means "these stored rows still form the valid chain they claimed to
   * be"; any tampering with hashes or payloads turns it red via the engine's
   * own reason codes, not this module's opinion.
   */
  verify(partitionId: string, protocol: EngineProtocol): { ok: true; events: number } {
    // Trigger-presence self-check first: a mirror that arrived without its
    // append-only triggers (or lost them under this handle) has had its one
    // write protection removed, and that alone is a red — regardless of
    // whether the rows still validate.
    const triggersNow = this.db.prepare(
      `SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'trigger' AND name IN ('${APPEND_ONLY_TRIGGERS.join("','")}')`
    ).get() as { n: number };
    if (this.triggersMissingOnOpen || triggersNow.n < APPEND_ONLY_TRIGGERS.length) {
      throw new EventMirrorError(
        "append-only triggers were missing (dropped before this open, or under a live handle) — " +
        "triggers stop accidental writes only, not a deliberate DROP-then-rewrite; " +
        "tamper-evidence for that case rests on this check and the cross-container matrix comparison",
        "EVENT_MIRROR_TRIGGERS_MISSING"
      );
    }
    const rows = this.listRows(partitionId);
    const events = rows.map((row) => JSON.parse(row.canonicalJson) as unknown);
    const ordered = protocol.validateEventChain(events);
    for (const [index, event] of ordered.entries()) {
      const row = rows[index];
      if (!row || event.eventHash !== row.eventHash || protocol.canonicalJson(event) !== row.canonicalJson) {
        throw new EventMirrorError(
          `stored row at sequence ${row?.sequence ?? index + 1} does not match its own canonical bytes`,
          "EVENT_MIRROR_SELF_MISMATCH"
        );
      }
    }
    return { ok: true, events: ordered.length };
  }

  close(): void {
    this.db.close();
  }
}
