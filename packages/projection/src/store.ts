import { DatabaseSync } from "node:sqlite";
import type {
  PartitionFreshness,
  PartitionProjection,
  ProjectedConference,
  ProjectedEvent,
  ProjectedGate,
  ProjectedMinutes,
  ProjectedPosition,
  ProjectedWork
} from "./types.js";

/**
 * The projection store: a derived, disposable mirror of the chains.
 *
 * Nothing here is a source of truth. Every row is keyed by the chain version it
 * was read at, and a partition is replaced wholesale when its chain moves —
 * there is no merge, no partial update, and no way for a stale row to survive a
 * refresh. If this database is deleted, re-running ingestion reproduces it
 * exactly; that property is what makes it safe to skip backing it up, and what
 * keeps the engine's `projection-import-truth-ownership` boundary honest.
 *
 * Full replacement rather than incremental patching is deliberate: the chain is
 * append-only and its whole state is cheap to read, so the simplest correct
 * thing is also fast enough, and it removes the class of bug where a projection
 * drifts because one update path forgot a field.
 */
export class ProjectionStore {
  private readonly db: DatabaseSync;

  constructor(databasePath = ":memory:") {
    this.db = new DatabaseSync(databasePath);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA foreign_keys = ON");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS partition_projection (
        partition_id TEXT PRIMARY KEY,
        chain_version INTEGER NOT NULL,
        verified_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS projected_work (
        partition_id TEXT NOT NULL,
        id TEXT NOT NULL,
        external_key TEXT,
        kind TEXT NOT NULL,
        status TEXT NOT NULL,
        parent_id TEXT,
        project_id TEXT NOT NULL,
        revision INTEGER NOT NULL,
        scope TEXT,
        decided_by TEXT NOT NULL,
        sprint_work_id TEXT,
        chain_version INTEGER NOT NULL,
        PRIMARY KEY (partition_id, id)
      );
      CREATE INDEX IF NOT EXISTS projected_work_parent ON projected_work (partition_id, parent_id);
      CREATE INDEX IF NOT EXISTS projected_work_kind_status ON projected_work (kind, status);
      CREATE TABLE IF NOT EXISTS projected_gate (
        partition_id TEXT NOT NULL,
        id TEXT NOT NULL,
        external_key TEXT,
        title TEXT,
        status TEXT NOT NULL,
        outcome_class TEXT NOT NULL,
        work_id TEXT,
        chain_version INTEGER NOT NULL,
        PRIMARY KEY (partition_id, id)
      );
      CREATE TABLE IF NOT EXISTS projected_conference (
        partition_id TEXT NOT NULL,
        id TEXT NOT NULL,
        external_key TEXT,
        title TEXT,
        type TEXT,
        status TEXT NOT NULL,
        work_ids TEXT NOT NULL,
        chain_version INTEGER NOT NULL,
        PRIMARY KEY (partition_id, id)
      );
      CREATE TABLE IF NOT EXISTS projected_position (
        partition_id TEXT NOT NULL,
        id TEXT NOT NULL,
        external_key TEXT,
        conference_id TEXT NOT NULL,
        actor_id TEXT,
        body TEXT NOT NULL,
        ordinal INTEGER NOT NULL,
        chain_version INTEGER NOT NULL,
        PRIMARY KEY (partition_id, id)
      );
      CREATE INDEX IF NOT EXISTS projected_position_conference
        ON projected_position (partition_id, conference_id, ordinal);
      CREATE TABLE IF NOT EXISTS projected_minutes (
        partition_id TEXT NOT NULL,
        id TEXT NOT NULL,
        external_key TEXT,
        conference_id TEXT NOT NULL,
        summary TEXT,
        outcome_class TEXT NOT NULL,
        decisions TEXT NOT NULL,
        unresolved_issues TEXT NOT NULL,
        chain_version INTEGER NOT NULL,
        PRIMARY KEY (partition_id, id)
      );
      CREATE TABLE IF NOT EXISTS projected_event (
        partition_id TEXT NOT NULL,
        id TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        occurred_at TEXT NOT NULL,
        operation TEXT NOT NULL,
        subject_id TEXT,
        actor_id TEXT,
        chain_version INTEGER NOT NULL,
        PRIMARY KEY (partition_id, id)
      );
      CREATE INDEX IF NOT EXISTS projected_event_subject
        ON projected_event (partition_id, subject_id, sequence);
      CREATE TABLE IF NOT EXISTS partition_attestation (
        partition_id TEXT PRIMARY KEY,
        from_sequence INTEGER
      );
    `);
    // Full-text search over the text a reader would actually search for: work
    // scope, conference titles, position bodies, minutes summaries. Contentless
    // FTS would need the same rebuild-on-replace handling with more moving parts,
    // so the index carries its own copy and is rebuilt with the partition.
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS projected_search USING fts5(
        partition_id UNINDEXED,
        record_id UNINDEXED,
        record_type UNINDEXED,
        external_key,
        body
      );
    `);
  }

  /**
   * Replace one partition's projection atomically.
   *
   * The delete-then-insert runs in a single transaction so a reader never sees a
   * half-replaced partition — mid-refresh, queries return the previous version
   * whole rather than a mixture of two.
   */
  replacePartition(projection: PartitionProjection): void {
    this.db.exec("BEGIN");
    try {
      const p = projection.partitionId;
      for (const table of [
        "projected_work", "projected_gate", "projected_conference",
        "projected_position", "projected_minutes", "projected_event"
      ]) {
        this.db.prepare(`DELETE FROM ${table} WHERE partition_id = ?`).run(p);
      }
      this.db.prepare("DELETE FROM projected_search WHERE partition_id = ?").run(p);

      const work = this.db.prepare(`INSERT INTO projected_work
        (partition_id,id,external_key,kind,status,parent_id,project_id,revision,scope,decided_by,sprint_work_id,chain_version)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
      for (const row of projection.work) {
        work.run(p, row.id, row.externalKey, row.kind, row.status, row.parentId,
          row.projectId, row.revision, row.scope, JSON.stringify(row.decidedBy),
          row.sprintWorkId, row.chainVersion);
      }

      const gate = this.db.prepare(`INSERT INTO projected_gate
        (partition_id,id,external_key,title,status,outcome_class,work_id,chain_version)
        VALUES (?,?,?,?,?,?,?,?)`);
      for (const row of projection.gates) {
        gate.run(p, row.id, row.externalKey, row.title, row.status, row.outcomeClass,
          row.workId, row.chainVersion);
      }

      const conference = this.db.prepare(`INSERT INTO projected_conference
        (partition_id,id,external_key,title,type,status,work_ids,chain_version)
        VALUES (?,?,?,?,?,?,?,?)`);
      for (const row of projection.conferences) {
        conference.run(p, row.id, row.externalKey, row.title, row.type, row.status,
          JSON.stringify(row.workIds), row.chainVersion);
      }

      const position = this.db.prepare(`INSERT INTO projected_position
        (partition_id,id,external_key,conference_id,actor_id,body,ordinal,chain_version)
        VALUES (?,?,?,?,?,?,?,?)`);
      for (const row of projection.positions) {
        position.run(p, row.id, row.externalKey, row.conferenceId, row.actorId,
          row.body, row.ordinal, row.chainVersion);
      }

      const minutes = this.db.prepare(`INSERT INTO projected_minutes
        (partition_id,id,external_key,conference_id,summary,outcome_class,decisions,unresolved_issues,chain_version)
        VALUES (?,?,?,?,?,?,?,?,?)`);
      for (const row of projection.minutes) {
        minutes.run(p, row.id, row.externalKey, row.conferenceId, row.summary,
          row.outcomeClass, JSON.stringify(row.decisions),
          JSON.stringify(row.unresolvedIssues), row.chainVersion);
      }

      const event = this.db.prepare(`INSERT INTO projected_event
        (partition_id,id,sequence,occurred_at,operation,subject_id,actor_id,chain_version)
        VALUES (?,?,?,?,?,?,?,?)`);
      for (const row of projection.events) {
        event.run(p, row.id, row.sequence, row.occurredAt, row.operation,
          row.subjectId, row.actorId, row.chainVersion);
      }
      // Recorded per partition rather than inferred from whether any event has an
      // actor: a chain with attestation enabled but no writes since would look
      // identical to one that never enabled it, and those are different facts.
      this.db.prepare(
        `INSERT INTO partition_attestation (partition_id,from_sequence) VALUES (?,?)
         ON CONFLICT(partition_id) DO UPDATE SET from_sequence = excluded.from_sequence`
      ).run(p, projection.actorAttestationFromSequence);

      const search = this.db.prepare(
        "INSERT INTO projected_search (partition_id,record_id,record_type,external_key,body) VALUES (?,?,?,?,?)"
      );
      for (const row of projection.work) {
        search.run(p, row.id, "work", row.externalKey ?? "", row.scope ?? "");
      }
      for (const row of projection.conferences) {
        search.run(p, row.id, "conference", row.externalKey ?? "", row.title ?? "");
      }
      for (const row of projection.positions) {
        search.run(p, row.id, "position", row.externalKey ?? "", row.body);
      }
      for (const row of projection.minutes) {
        search.run(p, row.id, "minutes", row.externalKey ?? "",
          [row.summary ?? "", ...row.decisions, ...row.unresolvedIssues].join("\n"));
      }

      this.db.prepare(
        `INSERT INTO partition_projection (partition_id,chain_version,verified_at) VALUES (?,?,?)
         ON CONFLICT(partition_id) DO UPDATE SET chain_version = excluded.chain_version, verified_at = excluded.verified_at`
      ).run(p, projection.chainVersion, projection.verifiedAt);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  /** The version this store holds for a partition, if it holds one at all. */
  heldVersion(partitionId: string): number | undefined {
    const row = this.db.prepare(
      "SELECT chain_version AS v FROM partition_projection WHERE partition_id = ?"
    ).get(partitionId) as { v?: number } | undefined;
    return typeof row?.v === "number" ? row.v : undefined;
  }

  /** Freshness for every projected partition, for the shell's as-of indicator. */
  freshness(): PartitionFreshness[] {
    const rows = this.db.prepare(
      "SELECT partition_id, chain_version, verified_at FROM partition_projection ORDER BY partition_id"
    ).all() as Array<{ partition_id: string; chain_version: number; verified_at: string }>;
    return rows.map((row) => ({
      partitionId: row.partition_id,
      projectedVersion: row.chain_version,
      chainVersion: row.chain_version,
      verifiedAt: row.verified_at,
      stale: false
    }));
  }

  listWork(filter: WorkFilter = {}): ProjectedWork[] {
    const where: string[] = [];
    const params: string[] = [];
    if (filter.partitionIds?.length) {
      where.push(`partition_id IN (${filter.partitionIds.map(() => "?").join(",")})`);
      params.push(...filter.partitionIds);
    }
    if (filter.kinds?.length) {
      where.push(`kind IN (${filter.kinds.map(() => "?").join(",")})`);
      params.push(...filter.kinds);
    }
    if (filter.statuses?.length) {
      where.push(`status IN (${filter.statuses.map(() => "?").join(",")})`);
      params.push(...filter.statuses);
    }
    if (filter.parentId !== undefined) {
      // `parentId: null` means "top of the tree", which is a real query, so the
      // null case gets its own clause rather than a bound null the driver rejects.
      if (filter.parentId === null) {
        where.push("parent_id IS NULL");
      } else {
        where.push("parent_id = ?");
        params.push(filter.parentId);
      }
    }
    const clause = where.length ? ` WHERE ${where.join(" AND ")}` : "";
    const limit = filter.limit ?? 200;
    const rows = this.db.prepare(
      `SELECT * FROM projected_work${clause} ORDER BY partition_id, external_key LIMIT ?`
    ).all(...params, limit) as Array<Record<string, unknown>>;
    return rows.map(toWork);
  }

  listGates(filter: { statuses?: readonly string[] } = {}): ProjectedGate[] {
    const clause = filter.statuses?.length
      ? ` WHERE status IN (${filter.statuses.map(() => "?").join(",")})`
      : "";
    const rows = this.db.prepare(
      `SELECT * FROM projected_gate${clause} ORDER BY partition_id, external_key`
    ).all(...(filter.statuses ?? [])) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      partitionId: String(row.partition_id),
      id: String(row.id),
      externalKey: (row.external_key as string) ?? null,
      title: (row.title as string) ?? null,
      status: row.status as ProjectedGate["status"],
      outcomeClass: row.outcome_class as ProjectedGate["outcomeClass"],
      workId: (row.work_id as string) ?? null,
      chainVersion: Number(row.chain_version)
    }));
  }

  listConferences(filter: { statuses?: readonly string[] } = {}): ProjectedConference[] {
    const clause = filter.statuses?.length
      ? ` WHERE status IN (${filter.statuses.map(() => "?").join(",")})`
      : "";
    const rows = this.db.prepare(
      `SELECT * FROM projected_conference${clause} ORDER BY partition_id, external_key`
    ).all(...(filter.statuses ?? [])) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      partitionId: String(row.partition_id),
      id: String(row.id),
      externalKey: (row.external_key as string) ?? null,
      title: (row.title as string) ?? null,
      type: (row.type as string) ?? null,
      status: row.status as ProjectedConference["status"],
      workIds: JSON.parse(String(row.work_ids)) as string[],
      chainVersion: Number(row.chain_version)
    }));
  }

  /** Positions of one conference in recorded order, ready for reassembly. */
  listPositions(partitionId: string, conferenceId: string): ProjectedPosition[] {
    const rows = this.db.prepare(
      "SELECT * FROM projected_position WHERE partition_id = ? AND conference_id = ? ORDER BY ordinal"
    ).all(partitionId, conferenceId) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      partitionId: String(row.partition_id),
      id: String(row.id),
      externalKey: (row.external_key as string) ?? null,
      conferenceId: String(row.conference_id),
      actorId: (row.actor_id as string) ?? null,
      body: String(row.body),
      ordinal: Number(row.ordinal),
      chainVersion: Number(row.chain_version)
    }));
  }

  listMinutes(filter: { conferenceId?: string } = {}): ProjectedMinutes[] {
    const clause = filter.conferenceId ? " WHERE conference_id = ?" : "";
    const rows = this.db.prepare(
      `SELECT * FROM projected_minutes${clause} ORDER BY partition_id, external_key`
    ).all(...(filter.conferenceId ? [filter.conferenceId] : [])) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      partitionId: String(row.partition_id),
      id: String(row.id),
      externalKey: (row.external_key as string) ?? null,
      conferenceId: String(row.conference_id),
      summary: (row.summary as string) ?? null,
      outcomeClass: row.outcome_class as ProjectedMinutes["outcomeClass"],
      decisions: JSON.parse(String(row.decisions)) as string[],
      unresolvedIssues: JSON.parse(String(row.unresolved_issues)) as string[],
      chainVersion: Number(row.chain_version)
    }));
  }

  /**
   * The event log, oldest first, optionally narrowed to one record.
   *
   * Ordered by sequence rather than `occurredAt` because the chain's timestamps
   * are second-precision and a burst of writes shares one: sequence is the only
   * ordering the chain actually guarantees.
   */
  listEvents(filter: { partitionId?: string; subjectId?: string } = {}): ProjectedEvent[] {
    const where: string[] = [];
    const params: string[] = [];
    if (filter.partitionId) {
      where.push("partition_id = ?");
      params.push(filter.partitionId);
    }
    if (filter.subjectId) {
      where.push("subject_id = ?");
      params.push(filter.subjectId);
    }
    const clause = where.length ? ` WHERE ${where.join(" AND ")}` : "";
    const rows = this.db.prepare(
      `SELECT * FROM projected_event${clause} ORDER BY partition_id, sequence`
    ).all(...params) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      partitionId: String(row.partition_id),
      id: String(row.id),
      sequence: Number(row.sequence),
      occurredAt: String(row.occurred_at),
      operation: String(row.operation),
      subjectId: (row.subject_id as string) ?? null,
      actorId: (row.actor_id as string) ?? null,
      chainVersion: Number(row.chain_version)
    }));
  }

  /**
   * Where a partition began attributing writes, or null if it never has.
   *
   * `undefined` means the partition is not in the store at all, which is a
   * different answer from "recorded, and the answer is never".
   */
  attestationFromSequence(partitionId: string): number | null | undefined {
    const row = this.db.prepare(
      "SELECT from_sequence AS s FROM partition_attestation WHERE partition_id = ?"
    ).get(partitionId) as { s?: number | null } | undefined;
    if (!row) return undefined;
    return typeof row.s === "number" ? row.s : null;
  }

  /** Full-text search across projected records. */
  search(query: string, limit = 40): SearchHit[] {
    if (!query.trim()) return [];
    const rows = this.db.prepare(
      `SELECT partition_id, record_id, record_type, external_key,
              snippet(projected_search, 4, '[', ']', '…', 12) AS excerpt
         FROM projected_search WHERE projected_search MATCH ? LIMIT ?`
    ).all(query, limit) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      partitionId: String(row.partition_id),
      recordId: String(row.record_id),
      recordType: String(row.record_type) as SearchHit["recordType"],
      externalKey: (row.external_key as string) || null,
      excerpt: String(row.excerpt ?? "")
    }));
  }

  close(): void {
    this.db.close();
  }
}

export interface WorkFilter {
  partitionIds?: readonly string[];
  kinds?: readonly string[];
  statuses?: readonly string[];
  parentId?: string | null;
  limit?: number;
}

export interface SearchHit {
  partitionId: string;
  recordId: string;
  recordType: "work" | "conference" | "position" | "minutes";
  externalKey: string | null;
  excerpt: string;
}

function toWork(row: Record<string, unknown>): ProjectedWork {
  return {
    partitionId: String(row.partition_id),
    id: String(row.id),
    externalKey: (row.external_key as string) ?? null,
    kind: row.kind as ProjectedWork["kind"],
    status: row.status as ProjectedWork["status"],
    parentId: (row.parent_id as string) ?? null,
    projectId: String(row.project_id),
    revision: Number(row.revision),
    scope: (row.scope as string) ?? null,
    decidedBy: JSON.parse(String(row.decided_by)) as string[],
    sprintWorkId: (row.sprint_work_id as string) ?? null,
    chainVersion: Number(row.chain_version)
  };
}
