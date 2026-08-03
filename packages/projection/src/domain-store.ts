import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { requireDomainActor } from "./domain-actor.js";

/**
 * The cockpit's own store — the first data on this platform that cannot be
 * rebuilt from the chain.
 *
 * The projection store beside it is a derivative: delete it and re-running
 * ingestion reproduces it exactly, which is what makes it safe never to back up.
 * Nothing here has that property. An assignee, a label, a comment exists only
 * here, so this file is precious and the projection file is disposable, and they
 * are two files precisely so that distinction is a fact about the filesystem
 * rather than a rule someone has to remember at backup time.
 *
 * Nothing here merges into a chain record. Rows point at one by qualified ref —
 * partition plus record id — and stop, which is the engine's own
 * projection-import-truth-ownership boundary: the chain is the truth and this is
 * commentary attached to it. That is also why a ref is allowed to dangle. A
 * chain record can be tombstoned after someone labelled it, and the honest
 * response is to show the annotation and say its subject is gone, not to delete
 * a person's comment because a foreign key said so.
 */

export interface QualifiedRef {
  partitionId: string;
  recordId: string;
}

export type DomainPriority = "urgent" | "high" | "normal" | "low";

export interface DomainAnnotation extends QualifiedRef {
  externalKey: string | null;
  assignee: string | null;
  priority: DomainPriority | null;
  labels: readonly string[];
  updatedAt: string;
  updatedBy: string;
}

export interface DomainComment {
  id: string;
  partitionId: string;
  recordId: string;
  author: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
}

/** Mirrors the design system's `workRelationshipTypes`, in the same order. */
export const DOMAIN_RELATION_TYPES = [
  "blocks", "blocked_by", "depends_on", "relates_to", "duplicates", "supersedes",
  "split_from", "caused_by", "implements", "verifies", "reviews", "refreshes"
] as const;

export type DomainRelationType = (typeof DOMAIN_RELATION_TYPES)[number];

/**
 * One replayable chain write, as recorded by the write path (STORY-113).
 *
 * `argsJson` holds the wire arguments exactly as serialized at the moment of
 * sending — one serialization, stored byte-for-byte, never re-canonicalized.
 */
export interface ChainWriteLogEntry {
  seq: number;
  partitionId: string;
  verb: string;
  argsJson: string;
  recordId: string | null;
  chainVersion: number | null;
  headEventHash: string | null;
  at: string;
  /** Switchover anchor of the epoch the write belonged to; NULL before any anchor exists. */
  switchAnchor: string | null;
}

/**
 * Read every domain migration, in filename order, as one SQL script.
 *
 * The domain schema grew a second file (0002_chain_write_log.sql), and every
 * DomainStore construction site was loading 0001 by name — a shape where adding
 * a migration silently applies to none of them. This is the single loader they
 * all share instead.
 */
export function loadDomainMigrationSql(migrationsDir: string): string {
  const files = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort();
  if (files.length === 0) throw new Error(`no domain migrations found in ${migrationsDir}`);
  return files.map((name) => readFileSync(join(migrationsDir, name), "utf8")).join("\n");
}

export interface DomainRelation {
  id: string;
  partitionId: string;
  recordId: string;
  relation: DomainRelationType;
  targetPartitionId: string;
  targetRecordId: string;
  createdAt: string;
  createdBy: string;
}

export class DomainStore {
  private readonly db: DatabaseSync;

  /**
   * `readOnly` opens the precious store without write capability (STORY-138).
   * The read face must not be able to mutate the domain store any more than it
   * can write the chain; SQLite enforces it at the connection, so a code path
   * that never intended to write still cannot. In read-only mode the WAL pragma
   * and migrations are skipped: WAL is a write-time concern and the schema is
   * already applied by the writer.
   */
  constructor(databasePath: string, migrationSql: string, options: { readOnly?: boolean } = {}) {
    this.db = options.readOnly === true
      ? new DatabaseSync(databasePath, { readOnly: true })
      : new DatabaseSync(databasePath);
    if (options.readOnly !== true) {
      this.db.exec("PRAGMA journal_mode = WAL");
      this.db.exec("PRAGMA foreign_keys = ON");
      this.db.exec(migrationSql);
    }
  }

  /**
   * Set or clear operational metadata for one chain record.
   *
   * Upsert rather than insert-or-fail: the identity is the record being
   * annotated, not the annotation, so a second edit is the same row.
   * `updatedBy` is required because this store has no event log — the row is
   * the current state, and without an author the only thing it could say about
   * provenance is nothing.
   */
  setAnnotation(input: {
    partitionId: string;
    recordId: string;
    externalKey?: string | null;
    assignee?: string | null;
    priority?: DomainPriority | null;
    labels?: readonly string[];
    updatedAt: string;
    updatedBy: string;
  }): DomainAnnotation {
    requireDomainActor(input.updatedBy, "updatedBy");
    const existing = this.getAnnotation(input);
    const next: DomainAnnotation = {
      partitionId: input.partitionId,
      recordId: input.recordId,
      externalKey: input.externalKey ?? existing?.externalKey ?? null,
      assignee: input.assignee !== undefined ? input.assignee : existing?.assignee ?? null,
      priority: input.priority !== undefined ? input.priority : existing?.priority ?? null,
      labels: input.labels ?? existing?.labels ?? [],
      updatedAt: input.updatedAt,
      updatedBy: input.updatedBy
    };
    this.db.prepare(`INSERT INTO aos_domain_annotation
      (partition_id, record_id, external_key, assignee, priority, labels, updated_at, updated_by)
      VALUES (?,?,?,?,?,?,?,?)
      ON CONFLICT(partition_id, record_id) DO UPDATE SET
        external_key = excluded.external_key,
        assignee = excluded.assignee,
        priority = excluded.priority,
        labels = excluded.labels,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by`)
      .run(next.partitionId, next.recordId, next.externalKey, next.assignee,
        next.priority, JSON.stringify(next.labels), next.updatedAt, next.updatedBy);
    return next;
  }

  getAnnotation(ref: QualifiedRef): DomainAnnotation | undefined {
    const row = this.db.prepare(
      "SELECT * FROM aos_domain_annotation WHERE partition_id = ? AND record_id = ?"
    ).get(ref.partitionId, ref.recordId) as Record<string, unknown> | undefined;
    return row ? toAnnotation(row) : undefined;
  }

  listAnnotations(filter: { partitionId?: string; assignee?: string } = {}): DomainAnnotation[] {
    const where: string[] = [];
    const params: string[] = [];
    if (filter.partitionId) {
      where.push("partition_id = ?");
      params.push(filter.partitionId);
    }
    if (filter.assignee) {
      where.push("assignee = ?");
      params.push(filter.assignee);
    }
    const clause = where.length ? ` WHERE ${where.join(" AND ")}` : "";
    return (this.db.prepare(`SELECT * FROM aos_domain_annotation${clause}`)
      .all(...params) as Array<Record<string, unknown>>).map(toAnnotation);
  }

  addComment(input: {
    id: string;
    partitionId: string;
    recordId: string;
    author: string;
    body: string;
    createdAt: string;
  }): DomainComment {
    requireDomainActor(input.author, "author");
    this.db.prepare(`INSERT INTO aos_domain_comment
      (id, partition_id, record_id, author, body, created_at, edited_at)
      VALUES (?,?,?,?,?,?,NULL)`)
      .run(input.id, input.partitionId, input.recordId, input.author, input.body, input.createdAt);
    return { ...input, editedAt: null };
  }

  listComments(ref: QualifiedRef): DomainComment[] {
    return (this.db.prepare(
      `SELECT * FROM aos_domain_comment WHERE partition_id = ? AND record_id = ?
       ORDER BY created_at, id`
    ).all(ref.partitionId, ref.recordId) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      partitionId: String(row.partition_id),
      recordId: String(row.record_id),
      author: String(row.author),
      body: String(row.body),
      createdAt: String(row.created_at),
      editedAt: (row.edited_at as string) ?? null
    }));
  }

  /**
   * Link two records outside the chain's tree.
   *
   * The chain enforces a strict hierarchy — a Story has exactly one parent — so
   * "this blocks that" and "this duplicates that" have nowhere to live on it.
   * They live here, and stay visibly the cockpit's claim rather than the chain's.
   */
  addRelation(input: Omit<DomainRelation, "createdAt"> & { createdAt: string }): DomainRelation {
    requireDomainActor(input.createdBy, "createdBy");
    this.db.prepare(`INSERT OR IGNORE INTO aos_domain_relation
      (id, partition_id, record_id, relation, target_partition_id, target_record_id, created_at, created_by)
      VALUES (?,?,?,?,?,?,?,?)`)
      .run(input.id, input.partitionId, input.recordId, input.relation,
        input.targetPartitionId, input.targetRecordId, input.createdAt, input.createdBy);
    return input;
  }

  /**
   * Every relation touching a record, from either end.
   *
   * Reading only the rows a record owns would hide the half someone else
   * created: "A blocks B" is as much B's business as A's, and a detail view that
   * showed only outbound links would let a blocked item look unblocked.
   */
  listRelations(ref: QualifiedRef): Array<DomainRelation & { direction: "outbound" | "inbound" }> {
    const outbound = (this.db.prepare(
      "SELECT * FROM aos_domain_relation WHERE partition_id = ? AND record_id = ?"
    ).all(ref.partitionId, ref.recordId) as Array<Record<string, unknown>>)
      .map((row) => ({ ...toRelation(row), direction: "outbound" as const }));
    const inbound = (this.db.prepare(
      "SELECT * FROM aos_domain_relation WHERE target_partition_id = ? AND target_record_id = ?"
    ).all(ref.partitionId, ref.recordId) as Array<Record<string, unknown>>)
      .map((row) => ({ ...toRelation(row), direction: "inbound" as const }));
    return [...outbound, ...inbound];
  }

  listAllRelations(): DomainRelation[] {
    return (this.db.prepare("SELECT * FROM aos_domain_relation").all() as Array<Record<string, unknown>>)
      .map(toRelation);
  }

  /**
   * Append one chain write to the replayable log (STORY-113).
   *
   * The sequence is assigned here, by the database, so monotonicity is a fact
   * about the table rather than a promise by callers. The row is append-only:
   * the migration's triggers reject UPDATE and DELETE outright.
   */
  appendChainWrite(entry: Omit<ChainWriteLogEntry, "seq">): ChainWriteLogEntry {
    const result = this.db.prepare(`INSERT INTO aos_chain_write_log
      (partition_id, verb, args_json, record_id, chain_version, head_event_hash, at, switch_anchor)
      VALUES (?,?,?,?,?,?,?,?)`)
      .run(entry.partitionId, entry.verb, entry.argsJson, entry.recordId,
        entry.chainVersion, entry.headEventHash, entry.at, entry.switchAnchor);
    return { ...entry, seq: Number(result.lastInsertRowid) };
  }

  /** The write log in sequence order, optionally narrowed to one partition. */
  listChainWrites(filter: { partitionId?: string } = {}): ChainWriteLogEntry[] {
    const clause = filter.partitionId ? " WHERE partition_id = ?" : "";
    return (this.db.prepare(`SELECT * FROM aos_chain_write_log${clause} ORDER BY seq`)
      .all(...(filter.partitionId ? [filter.partitionId] : [])) as Array<Record<string, unknown>>)
      .map(toChainWrite);
  }

  /**
   * Restore path only: re-insert an exported log row with its original seq.
   *
   * The live write path never names a seq — this exists so the backup drill can
   * replay an export into a fresh store without renumbering history, which
   * would silently break every cross-reference into the log.
   */
  restoreChainWrite(entry: ChainWriteLogEntry): void {
    this.db.prepare(`INSERT INTO aos_chain_write_log
      (seq, partition_id, verb, args_json, record_id, chain_version, head_event_hash, at, switch_anchor)
      VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(entry.seq, entry.partitionId, entry.verb, entry.argsJson, entry.recordId,
        entry.chainVersion, entry.headEventHash, entry.at, entry.switchAnchor);
  }

  /**
   * A portable snapshot of everything in here.
   *
   * This exists because the store is precious and its backup obligation was a
   * condition of creating it: a plain SQLite copy is fine on the machine that
   * wrote it, and a JSON export is what survives a schema change, a different
   * SQLite build, or a restore onto something that is not this laptop.
   */
  exportAll(): {
    schemaVersion: string;
    annotations: DomainAnnotation[];
    comments: DomainComment[];
    relations: DomainRelation[];
    chainWriteLog: ChainWriteLogEntry[];
  } {
    const comments = (this.db.prepare("SELECT * FROM aos_domain_comment ORDER BY created_at, id")
      .all() as Array<Record<string, unknown>>).map((row) => ({
        id: String(row.id),
        partitionId: String(row.partition_id),
        recordId: String(row.record_id),
        author: String(row.author),
        body: String(row.body),
        createdAt: String(row.created_at),
        editedAt: (row.edited_at as string) ?? null
      }));
    return {
      // v2 = v1 plus chainWriteLog (STORY-113). Additive only: a v1 reader that
      // takes the three original families still reads a v2 export correctly.
      schemaVersion: "aos.domain.v2",
      annotations: this.listAnnotations(),
      comments,
      relations: this.listAllRelations(),
      chainWriteLog: this.listChainWrites()
    };
  }

  close(): void {
    this.db.close();
  }
}

function toAnnotation(row: Record<string, unknown>): DomainAnnotation {
  return {
    partitionId: String(row.partition_id),
    recordId: String(row.record_id),
    externalKey: (row.external_key as string) ?? null,
    assignee: (row.assignee as string) ?? null,
    priority: (row.priority as DomainPriority) ?? null,
    labels: JSON.parse(String(row.labels)) as string[],
    updatedAt: String(row.updated_at),
    updatedBy: String(row.updated_by)
  };
}

function toChainWrite(row: Record<string, unknown>): ChainWriteLogEntry {
  return {
    seq: Number(row.seq),
    partitionId: String(row.partition_id),
    verb: String(row.verb),
    argsJson: String(row.args_json),
    recordId: (row.record_id as string) ?? null,
    chainVersion: typeof row.chain_version === "number" ? row.chain_version : null,
    headEventHash: (row.head_event_hash as string) ?? null,
    at: String(row.at),
    switchAnchor: (row.switch_anchor as string) ?? null
  };
}

function toRelation(row: Record<string, unknown>): DomainRelation {
  return {
    id: String(row.id),
    partitionId: String(row.partition_id),
    recordId: String(row.record_id),
    relation: row.relation as DomainRelationType,
    targetPartitionId: String(row.target_partition_id),
    targetRecordId: String(row.target_record_id),
    createdAt: String(row.created_at),
    createdBy: String(row.created_by)
  };
}
