import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  AIEmployee,
  AgentRun,
  AosCorePersistenceSnapshot,
  AosPersistenceRepository,
  Assignment,
  AuditEvent,
  EpicRecord,
  EvidenceLink,
  GateWorkOrder,
  InitiativeRecord,
  ProjectRecord,
  StoryRecord,
  SubTask
} from "../../domain/src/index.js";

export const phase1CoreTables = [
  "aos_projects",
  "aos_initiatives",
  "aos_epics",
  "aos_stories",
  "aos_subtasks",
  "aos_ai_employees",
  "aos_assignments",
  "aos_gate_work_orders",
  "aos_evidence_links",
  "aos_audit_events",
  "aos_agent_runs"
] as const;

export const phase1ExcludedRuntimeTables = [
  "aos_conferences",
  "aos_conference_positions",
  "aos_dependency_lifecycle_records",
  "aos_dependency_detection_findings",
  "aos_resource_registry_records",
  "aos_resource_materialization_requests",
  "aos_project_resource_manifests",
  "aos_resource_audit_findings",
  "aos_resource_materialization_history_records",
  "aos_resource_update_requests",
  "aos_resource_replacement_requests",
  "aos_resource_rollback_requests",
  "aos_resource_rollback_plans",
  "aos_resource_retirement_records",
  "aos_resource_cleanup_readbacks",
  "aos_user_guide_page_drafts",
  "aos_release_notes",
  "aos_docs_readiness_records",
  "aos_project_search_index_records",
  "aos_github_metadata_readbacks",
  "aos_pr_ci_story_readiness_records",
  "aos_release_candidate_linkages"
] as const;

export interface SqliteMigrationReadback {
  ok: boolean;
  migrationCount: number;
  appliedCount: number;
  migrations: Array<{ version: string; digest: string; applied: boolean }>;
  preMigrationSnapshots: Array<{ version: string; digest: string; ok: boolean; snapshotId: string | null; manifestDigest: string | null }>;
  pragmas: Record<string, unknown>;
}

export interface SqlitePreMigrationSnapshotInput {
  version: string;
  digest: string;
  fileName: string;
  pendingIndex: number;
  pendingMigrationCount: number;
}

export interface SqlitePreMigrationSnapshotReadback {
  ok: boolean;
  snapshotId: string;
  manifestDigest: string;
}

export interface SqliteMigrationOptions {
  preMigrationSnapshot?: (input: SqlitePreMigrationSnapshotInput) => SqlitePreMigrationSnapshotReadback;
}

export interface StoryTraceabilityReadback {
  storyId: string;
  subtaskIds: string[];
  assignmentIds: string[];
  agentRunIds: string[];
  evidenceIds: string[];
  gateIds: string[];
  auditEventIds: string[];
}

export interface ThreadRegistryProjectionReadback {
  ok: boolean;
  sourceDigest: string;
  rowCount: number;
  insertedCount: number;
  canonicalMergeCount: number;
  duplicateNonNullThreadIdCount: number;
  allowlistedFields: string[];
  secondSeedNoop: boolean;
  registryJobTitlePreserved: boolean;
  staticAliasDisposition: string;
}

export interface SchemaIntegrityReadback {
  ok: boolean;
  jsonCheckTables: string[];
  missingJsonCheckTables: string[];
  enumCheckColumns: string[];
  invalidJsonRejected: Record<string, boolean>;
  invalidEnumRejected: Record<string, boolean>;
}

export type KnowledgeRetrievalStatus = "canonical" | "draft" | "deprecated";

export interface KnowledgeRetrievalEntryInput {
  id: string;
  title: string;
  roleScope: string;
  project: string;
  category: string;
  knowledgeKind: string;
  status: KnowledgeRetrievalStatus;
  lastVerified: string;
  stalenessPolicy: string;
  sourceRef: string;
  sourceDigest: string;
  tags: string[];
  summary: string;
  body: string;
  accessCount?: number;
  lastAccessed?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface KnowledgeRetrievalEntryRecord {
  id: string;
  title: string;
  roleScope: string;
  project: string;
  category: string;
  knowledgeKind: string;
  status: KnowledgeRetrievalStatus;
  lastVerified: string;
  stalenessPolicy: string;
  sourceRef: string;
  sourceDigest: string;
  tags: string[];
  summary: string;
  body: string;
  accessCount: number;
  lastAccessed: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeRetrievalSearchParams {
  query?: string;
  roleScope?: string;
  project?: string;
  category?: string;
  status?: KnowledgeRetrievalStatus;
  includeDraft?: boolean;
  includeStale?: boolean;
  limit?: number;
  cursor?: string | null;
}

export interface KnowledgeRetrievalFreshnessReadback {
  stale: boolean;
  stalenessPolicy: string;
  lastVerified: string;
  staleAfterDays: number | null;
}

export interface KnowledgeRetrievalSearchPage {
  rows: KnowledgeRetrievalEntryRecord[];
  limit: number;
  returnedCount: number;
  nextCursor: string | null;
  hasMore: boolean;
  filterDigest: string;
  searchMode: "fts5" | "like_tokenized";
  defaultCanonicalFilterApplied: boolean;
  defaultFreshnessFilterApplied: boolean;
}

export interface KnowledgeRetrievalSchemaReadback {
  ok: boolean;
  tableName: "aos_knowledge_entries";
  ftsTableName: "aos_knowledge_entries_fts";
  requiredColumns: string[];
  presentColumns: string[];
  missingColumns: string[];
  fts5Available: boolean;
  searchMode: "fts5" | "like_tokenized";
  statusCheckPresent: boolean;
  bodyWordLimit: 1500;
  summaryWordLimit: 120;
  accessMetadataColumns: string[];
}

export class KnowledgeRetrievalValidationError extends Error {
  constructor(
    readonly reason: string,
    readonly field: string,
    readonly limit: number,
    readonly actual: number
  ) {
    super(reason);
  }
}

export interface AosSqliteRepositoryOptions {
  databasePath: string;
  migrationsDir?: string;
}

const defaultMigrationsDir = new URL("../migrations/sqlite", import.meta.url);

type SqlProbeValue = string | number | bigint | null | Buffer;

export class AosSqliteRepository implements AosPersistenceRepository {
  private readonly database: DatabaseSync;
  private readonly migrationsDir: string;
  private transactionDepth = 0;

  constructor(options: AosSqliteRepositoryOptions) {
    mkdirSync(dirname(options.databasePath), { recursive: true });
    this.database = new DatabaseSync(options.databasePath);
    this.migrationsDir = options.migrationsDir ?? defaultMigrationsDir.pathname;
    this.configureConnection();
  }

  close(): void {
    this.database.close();
  }

  applyMigrations(options: SqliteMigrationOptions = {}): SqliteMigrationReadback {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS aos_schema_migrations (
        version TEXT PRIMARY KEY,
        digest TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )
    `);
    const files = readdirSync(this.migrationsDir)
      .filter((name) => /^\d+.*\.sql$/.test(name))
      .sort();
    const migrationFiles = files.map((file) => {
      const version = file.replace(/\.sql$/, "");
      const sql = readFileSync(join(this.migrationsDir, file), "utf8");
      return { file, version, sql, digest: sha256(sql) };
    });
    const pendingVersions = migrationFiles.filter(({ version, digest }) => {
      const existing = this.database.prepare("SELECT digest FROM aos_schema_migrations WHERE version = ?").get(version) as { digest: string } | undefined;
      if (existing && existing.digest !== digest) {
        throw new Error(`SQLite migration digest changed after apply: ${version}`);
      }
      return !existing;
    }).map(({ version }) => version);
    const migrations: SqliteMigrationReadback["migrations"] = [];
    const preMigrationSnapshots: SqliteMigrationReadback["preMigrationSnapshots"] = [];
    let appliedCount = 0;
    let pendingIndex = 0;
    for (const { file, version, sql, digest } of migrationFiles) {
      const existing = this.database.prepare("SELECT digest FROM aos_schema_migrations WHERE version = ?").get(version) as { digest: string } | undefined;
      if (!existing) {
        let preMigrationSnapshot: SqlitePreMigrationSnapshotReadback | null = null;
        if (options.preMigrationSnapshot) {
          pendingIndex += 1;
          preMigrationSnapshot = options.preMigrationSnapshot({
            version,
            digest,
            fileName: file,
            pendingIndex,
            pendingMigrationCount: pendingVersions.length
          });
          if (!preMigrationSnapshot.ok) {
            throw new Error(`SQLite pre-migration snapshot failed: ${version}`);
          }
          preMigrationSnapshots.push({
            version,
            digest,
            ok: preMigrationSnapshot.ok,
            snapshotId: preMigrationSnapshot.snapshotId,
            manifestDigest: preMigrationSnapshot.manifestDigest
          });
        }
        this.runInTransaction(() => {
          this.database.exec(sql);
          const result = this.database.prepare("INSERT OR IGNORE INTO aos_schema_migrations(version, digest) VALUES (?, ?)").run(version, digest);
          appliedCount += Number(result.changes ?? 0);
        });
        migrations.push({ version, digest, applied: true });
      } else {
        migrations.push({ version, digest, applied: false });
      }
    }
    return {
      ok: true,
      migrationCount: files.length,
      appliedCount,
      migrations,
      preMigrationSnapshots,
      pragmas: this.pragmaReadback()
    };
  }

  hydrateCore(): Partial<AosCorePersistenceSnapshot> {
    if (!this.hasTable("aos_projects")) {
      return {};
    }
    return {
      projects: this.readJsonRows<ProjectRecord>("aos_projects"),
      employees: this.readJsonRows<AIEmployee>("aos_ai_employees"),
      initiatives: this.readJsonRows<InitiativeRecord>("aos_initiatives"),
      epics: this.readJsonRows<EpicRecord>("aos_epics"),
      stories: this.readJsonRows<StoryRecord>("aos_stories"),
      assignments: this.readJsonRows<Assignment>("aos_assignments"),
      runs: this.readJsonRows<AgentRun>("aos_agent_runs"),
      gates: this.readJsonRows<GateWorkOrder>("aos_gate_work_orders"),
      evidence: this.readJsonRows<EvidenceLink>("aos_evidence_links"),
      auditEvents: this.readJsonRows<AuditEvent>("aos_audit_events")
    };
  }

  runInTransaction<T>(operation: () => T): T {
    if (this.transactionDepth > 0) {
      this.transactionDepth += 1;
      try {
        return operation();
      } finally {
        this.transactionDepth -= 1;
      }
    }
    this.database.exec("BEGIN IMMEDIATE");
    this.transactionDepth = 1;
    try {
      const result = operation();
      this.database.exec("COMMIT");
      return result;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    } finally {
      this.transactionDepth = 0;
    }
  }

  saveCoreRecord(kind: string, record: unknown): void {
    switch (kind) {
      case "project":
        this.saveProject(record as ProjectRecord);
        return;
      case "employee":
        this.saveEmployee(record as AIEmployee, null);
        return;
      case "initiative":
        this.saveInitiative(record as InitiativeRecord);
        return;
      case "epic":
        this.saveEpic(record as EpicRecord);
        return;
      case "story":
        this.saveStory(record as StoryRecord);
        return;
      case "subtask":
        this.saveSubtask(record as SubTask & { storyId: string });
        return;
      case "assignment":
        this.saveAssignment(record as Assignment);
        return;
      case "agentRun":
        this.saveAgentRun(record as AgentRun);
        return;
      case "gate":
        this.saveGate(record as GateWorkOrder);
        return;
      case "evidence":
        this.saveEvidence(record as EvidenceLink);
        return;
      case "audit":
        this.appendAuditEvent(record as AuditEvent);
        return;
      default:
        return;
    }
  }

  appendAuditEvent(event: AuditEvent): void {
    this.database.prepare(`
      INSERT OR IGNORE INTO aos_audit_events(id, target_type, target_id, action, outcome, actor_ref, timestamp, record_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(event.id, event.targetType, event.targetId, event.action, event.outcome, actorRef(event.actor), event.timestamp, stableJson(event));
  }

  seedAiEmployees(employees: AIEmployee[], sourceDigest: string | null = null): { insertedCount: number; rowCount: number } {
    let insertedCount = 0;
    this.runInTransaction(() => {
      for (const employee of employees) {
        const canonicalEmployee = this.canonicalEmployee(employee);
        const existing = this.database.prepare("SELECT record_json, source_digest FROM aos_ai_employees WHERE id = ?").get(canonicalEmployee.id) as { record_json: string; source_digest: string | null } | undefined;
        const recordJson = stableJson(canonicalEmployee);
        if (existing && existing.record_json === recordJson && (sourceDigest === null || existing.source_digest === sourceDigest)) {
          continue;
        }
        this.saveEmployee(canonicalEmployee, sourceDigest);
        if (!existing) {
          insertedCount += 1;
        }
      }
    });
    return { insertedCount, rowCount: this.tableCount("aos_ai_employees") };
  }

  projectThreadRegistryEmployees(registry: unknown, sourceDigest: string): { employees: AIEmployee[]; readback: ThreadRegistryProjectionReadback } {
    const rows = Array.isArray(registry)
      ? registry
      : typeof registry === "object" && registry && Array.isArray((registry as { threads?: unknown[] }).threads)
        ? (registry as { threads: unknown[] }).threads
        : [];
    const employees = rows.map((row, index) => projectThreadRow(row as Record<string, unknown>, index));
    const canonicalMergeCount = employees.filter((employee) => {
      const existing = this.employeeByThreadId(employee.threadIdentity.threadId);
      return existing && existing.id !== employee.id;
    }).length;
    const first = this.seedAiEmployees(employees, sourceDigest);
    const second = this.seedAiEmployees(employees, sourceDigest);
    const canonicality = this.employeeCanonicalityReadback();
    return {
      employees,
      readback: {
        ok: second.insertedCount === 0 && canonicality.duplicateNonNullThreadIdCount === 0,
        sourceDigest,
        rowCount: first.rowCount,
        insertedCount: first.insertedCount,
        canonicalMergeCount,
        duplicateNonNullThreadIdCount: canonicality.duplicateNonNullThreadIdCount,
        allowlistedFields: ["codexAgentSlug", "name", "jobTitle", "threadId", "status", "lifecycle", "contactWhen"],
        secondSeedNoop: second.insertedCount === 0,
        registryJobTitlePreserved: employees.every((employee) => employee.authoritySummary.startsWith("Workflow registry projection for ")),
        staticAliasDisposition: "static employees sharing canonical registry thread ids are merged into the existing canonical row; non-registry fixture aliases remain separate only when their thread id is unique"
      }
    };
  }

  schemaIntegrityReadback(): SchemaIntegrityReadback {
    const createSqlByTable = Object.fromEntries((this.database.prepare(`
      SELECT name, sql FROM sqlite_master
      WHERE type = 'table' AND name LIKE 'aos_%'
      ORDER BY name
    `).all() as Array<{ name: string; sql: string }>).map((row) => [row.name, row.sql]));
    const jsonCheckTables = phase1CoreTables.filter((table) => /\bCHECK\s*\(\s*json_valid\s*\(\s*record_json\s*\)\s*\)/i.test(createSqlByTable[table] ?? ""));
    const missingJsonCheckTables = phase1CoreTables.filter((table) => !jsonCheckTables.includes(table));
    const enumChecks: Array<[string, string]> = [
      ["aos_projects", "registry_status"],
      ["aos_projects", "status"],
      ["aos_projects", "gate_state"],
      ["aos_ai_employees", "role"],
      ["aos_ai_employees", "lifecycle"],
      ["aos_initiatives", "status"],
      ["aos_epics", "status"],
      ["aos_stories", "status"],
      ["aos_subtasks", "owner_role"],
      ["aos_subtasks", "status"],
      ["aos_assignments", "target_type"],
      ["aos_assignments", "role"],
      ["aos_assignments", "status"],
      ["aos_agent_runs", "status"],
      ["aos_gate_work_orders", "type"],
      ["aos_gate_work_orders", "owner_role"],
      ["aos_gate_work_orders", "status"],
      ["aos_evidence_links", "type"],
      ["aos_evidence_links", "redaction_state"],
      ["aos_audit_events", "outcome"]
    ];
    const enumCheckColumns = enumChecks
      .filter(([table, column]) => new RegExp(`\\b${column}\\b[^,]*CHECK\\s*\\(`, "i").test(createSqlByTable[table] ?? ""))
      .map(([table, column]) => `${table}.${column}`);
    const invalidJsonRejected = Object.fromEntries(phase1CoreTables.map((table) => [table, this.rejectInvalidJsonForTable(table)]));
    const invalidEnumRejected = {
      "aos_projects.status": this.rejectProbe("INSERT INTO aos_projects(id, name, registry_status, status, gate_state, record_json) VALUES ('probe-project-enum', 'Probe', 'planned', 'invalid_status', 'pending_role', '{}')"),
      "aos_assignments.target_type": this.rejectProbe("INSERT INTO aos_assignments(id, employee_id, target_id, target_type, role, status, record_json) VALUES ('probe-assignment-enum', ?, ?, 'invalid_target', 'implementation', 'in_progress', '{}')", this.firstEmployeeId(), this.firstStoryId()),
      "aos_audit_events.outcome": this.rejectProbe("INSERT INTO aos_audit_events(id, target_type, target_id, action, outcome, actor_ref, timestamp, record_json) VALUES ('probe-audit-enum', 'probe', 'probe', 'probe', 'invalid_outcome', 'system', '2026-07-05T00:00:00.000Z', '{}')")
    };
    return {
      ok: missingJsonCheckTables.length === 0 &&
        enumCheckColumns.length === enumChecks.length &&
        Object.values(invalidJsonRejected).every(Boolean) &&
        Object.values(invalidEnumRejected).every(Boolean),
      jsonCheckTables,
      missingJsonCheckTables,
      enumCheckColumns,
      invalidJsonRejected,
      invalidEnumRejected
    };
  }

  createKnowledgeRetrievalEntry(input: KnowledgeRetrievalEntryInput): KnowledgeRetrievalEntryRecord {
    const entry = normalizeKnowledgeRetrievalEntry(input);
    this.database.prepare(`
      INSERT INTO aos_knowledge_entries(
        id,
        title,
        role_scope,
        project,
        category,
        knowledge_kind,
        status,
        last_verified,
        staleness_policy,
        source_ref,
        source_digest,
        tags,
        summary,
        body,
        access_count,
        last_accessed,
        record_json,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        role_scope = excluded.role_scope,
        project = excluded.project,
        category = excluded.category,
        knowledge_kind = excluded.knowledge_kind,
        status = excluded.status,
        last_verified = excluded.last_verified,
        staleness_policy = excluded.staleness_policy,
        source_ref = excluded.source_ref,
        source_digest = excluded.source_digest,
        tags = excluded.tags,
        summary = excluded.summary,
        body = excluded.body,
        access_count = excluded.access_count,
        last_accessed = excluded.last_accessed,
        record_json = excluded.record_json,
        updated_at = excluded.updated_at
    `).run(
      entry.id,
      entry.title,
      entry.roleScope,
      entry.project,
      entry.category,
      entry.knowledgeKind,
      entry.status,
      entry.lastVerified,
      entry.stalenessPolicy,
      entry.sourceRef,
      entry.sourceDigest,
      JSON.stringify(entry.tags),
      entry.summary,
      entry.body,
      entry.accessCount,
      entry.lastAccessed,
      stableJson(entry),
      entry.createdAt,
      entry.updatedAt
    );
    return this.requireKnowledgeRetrievalEntry(entry.id);
  }

  requireKnowledgeRetrievalEntry(id: string): KnowledgeRetrievalEntryRecord {
    const row = this.database.prepare("SELECT * FROM aos_knowledge_entries WHERE id = ?").get(id) as KnowledgeRetrievalRow | undefined;
    if (!row) {
      throw new Error(`knowledge_retrieval_entry_not_found:${id}`);
    }
    return rowToKnowledgeRetrievalEntry(row);
  }

  searchKnowledgeRetrievalEntries(params: KnowledgeRetrievalSearchParams = {}): KnowledgeRetrievalEntryRecord[] {
    return this.searchKnowledgeRetrievalPage(params).rows;
  }

  searchKnowledgeRetrievalPage(params: KnowledgeRetrievalSearchParams = {}): KnowledgeRetrievalSearchPage {
    const limit = Math.max(1, Math.min(Math.trunc(params.limit ?? 10), 20));
    const offset = parseKnowledgeRetrievalCursor(params.cursor);
    const values: SqlProbeValue[] = [];
    const filters: string[] = [];
    if (params.roleScope) {
      filters.push("e.role_scope = ?");
      values.push(params.roleScope);
    }
    if (params.project) {
      filters.push("e.project = ?");
      values.push(params.project);
    }
    if (params.category) {
      filters.push("e.category = ?");
      values.push(params.category);
    }
    const defaultCanonicalFilterApplied = params.status === undefined && !params.includeDraft;
    const defaultFreshnessFilterApplied = !params.includeStale;
    if (params.status) {
      filters.push("e.status = ?");
      values.push(params.status);
    } else if (params.includeDraft) {
      filters.push("e.status IN ('canonical', 'draft')");
    } else {
      filters.push("e.status = 'canonical'");
    }

    const queryTerms = tokenizeSearchQuery(params.query ?? "");
    let from = "aos_knowledge_entries e";
    let searchMode: "fts5" | "like_tokenized" = "like_tokenized";
    if (queryTerms.length > 0) {
      if (this.knowledgeRetrievalFts5Available()) {
        searchMode = "fts5";
        from = "aos_knowledge_entries e JOIN aos_knowledge_entries_fts ON aos_knowledge_entries_fts.rowid = e.rowid";
        filters.push("aos_knowledge_entries_fts MATCH ?");
        values.push(queryTerms.map((term) => `${term}*`).join(" AND "));
      } else {
        filters.push(`(${["e.title", "e.summary", "e.tags", "e.body"].map((column) => `${column} LIKE ?`).join(" OR ")})`);
        values.push(...Array.from({ length: 4 }, () => `%${queryTerms.join("%")}%`));
      }
    }
    const where = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
    const rows = this.database.prepare(`
      SELECT e.*
      FROM ${from}
      ${where}
      ORDER BY e.updated_at DESC, e.id
      LIMIT ?
    `).all(...values, 200) as unknown as KnowledgeRetrievalRow[];
    const filteredRows = rows
      .map(rowToKnowledgeRetrievalEntry)
      .filter((entry) => params.includeStale || !knowledgeRetrievalFreshness(entry).stale);
    const pageRows = filteredRows.slice(offset, offset + limit);
    const nextOffset = offset + pageRows.length;
    return {
      rows: pageRows,
      limit,
      returnedCount: pageRows.length,
      nextCursor: nextOffset < filteredRows.length ? encodeKnowledgeRetrievalCursor(nextOffset) : null,
      hasMore: nextOffset < filteredRows.length,
      filterDigest: sha256(stableJson({
        query: params.query ?? null,
        roleScope: params.roleScope ?? null,
        project: params.project ?? null,
        category: params.category ?? null,
        status: params.status ?? null,
        includeDraft: Boolean(params.includeDraft),
        includeStale: Boolean(params.includeStale)
      })),
      searchMode,
      defaultCanonicalFilterApplied,
      defaultFreshnessFilterApplied
    };
  }

  recordKnowledgeRetrievalAccess(id: string, accessedAt: string): KnowledgeRetrievalEntryRecord {
    this.database.prepare(`
      UPDATE aos_knowledge_entries
      SET access_count = access_count + 1,
          last_accessed = ?,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = ?
    `).run(accessedAt, id);
    return this.requireKnowledgeRetrievalEntry(id);
  }

  knowledgeRetrievalSchemaReadback(): KnowledgeRetrievalSchemaReadback {
    const requiredColumns = [
      "id",
      "title",
      "role_scope",
      "project",
      "category",
      "knowledge_kind",
      "status",
      "last_verified",
      "staleness_policy",
      "source_ref",
      "source_digest",
      "tags",
      "summary",
      "body",
      "access_count",
      "last_accessed",
      "record_json",
      "created_at",
      "updated_at"
    ];
    const presentColumns = this.columnNames("aos_knowledge_entries");
    const missingColumns = requiredColumns.filter((column) => !presentColumns.includes(column));
    const createSql = this.tableSql("aos_knowledge_entries");
    const fts5Available = this.knowledgeRetrievalFts5Available();
    const statusCheckPresent = /status\s+TEXT\s+NOT NULL\s+CHECK\s*\(\s*status\s+IN\s*\('canonical',\s*'draft',\s*'deprecated'\)\s*\)/i.test(createSql);
    return {
      ok: missingColumns.length === 0 && statusCheckPresent && fts5Available,
      tableName: "aos_knowledge_entries",
      ftsTableName: "aos_knowledge_entries_fts",
      requiredColumns,
      presentColumns,
      missingColumns,
      fts5Available,
      searchMode: fts5Available ? "fts5" : "like_tokenized",
      statusCheckPresent,
      bodyWordLimit: 1500,
      summaryWordLimit: 120,
      accessMetadataColumns: presentColumns.filter((column) => ["access_count", "last_accessed"].includes(column))
    };
  }

  tableNames(): string[] {
    return (this.database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'aos_%' ORDER BY name").all() as Array<{ name: string }>).map((row) => row.name).filter(isPublicAosDataTable);
  }

  tableCounts(): Record<string, number> {
    return Object.fromEntries(this.tableNames().map((table) => [table, this.tableCount(table)]));
  }

  databaseDigest(): string {
    const rows = this.tableNames().map((table) => ({
      table,
      count: this.tableCount(table),
      ids: (this.database.prepare(`SELECT ${digestIdentityColumn(table)} as id FROM ${table} WHERE ${digestIdentityColumn(table)} IS NOT NULL ORDER BY ${digestIdentityColumn(table)}`).all() as Array<{ id: string }>).map((row) => row.id)
    }));
    return sha256(stableJson(rows));
  }

  traceStory(storyId: string): StoryTraceabilityReadback {
    const subtaskIds = this.selectIds("aos_subtasks", "story_id", storyId);
    const assignmentIds = (this.database.prepare("SELECT id FROM aos_assignments WHERE target_type = 'story' AND target_id = ? ORDER BY id").all(storyId) as Array<{ id: string }>).map((row) => row.id);
    const agentRunIds = assignmentIds.flatMap((assignmentId) => this.selectIds("aos_agent_runs", "assignment_id", assignmentId));
    const gateIds = this.selectIds("aos_gate_work_orders", "linked_ticket_id", storyId);
    const gateEvidence = gateIds.flatMap((gateId) => {
      const row = this.database.prepare("SELECT record_json FROM aos_gate_work_orders WHERE id = ?").get(gateId) as { record_json: string } | undefined;
      return row ? (JSON.parse(row.record_json) as GateWorkOrder).inputEvidenceIds : [];
    });
    const auditEventIds = (this.database.prepare(`
      SELECT id FROM aos_audit_events
      WHERE target_id = ? OR target_id IN (${placeholders([...assignmentIds, ...agentRunIds, ...gateIds, ...gateEvidence].length)})
      ORDER BY timestamp, id
    `).all(storyId, ...assignmentIds, ...agentRunIds, ...gateIds, ...gateEvidence) as Array<{ id: string }>).map((row) => row.id);
    return {
      storyId,
      subtaskIds,
      assignmentIds,
      agentRunIds,
      evidenceIds: [...new Set(gateEvidence)],
      gateIds,
      auditEventIds
    };
  }

  rejectAuditMutationForProof(): { updateRejected: boolean; deleteRejected: boolean; beforeDigest: string; afterDigest: string; beforeCount: number; afterCount: number } {
    const beforeDigest = this.databaseDigest();
    const beforeCount = this.tableCount("aos_audit_events");
    const first = this.database.prepare("SELECT id FROM aos_audit_events ORDER BY timestamp, id LIMIT 1").get() as { id: string } | undefined;
    let updateRejected = true;
    let deleteRejected = true;
    if (first) {
      updateRejected = rejects(() => this.database.prepare("UPDATE aos_audit_events SET action = 'tamper' WHERE id = ?").run(first.id));
      deleteRejected = rejects(() => this.database.prepare("DELETE FROM aos_audit_events WHERE id = ?").run(first.id));
    }
    return {
      updateRejected,
      deleteRejected,
      beforeDigest,
      afterDigest: this.databaseDigest(),
      beforeCount,
      afterCount: this.tableCount("aos_audit_events")
    };
  }

  pragmaReadback(): Record<string, unknown> {
    return {
      foreign_keys: this.pragmaValue("foreign_keys"),
      journal_mode: this.pragmaValue("journal_mode"),
      busy_timeout: this.pragmaValue("busy_timeout"),
      synchronous: this.pragmaValue("synchronous")
    };
  }

  private configureConnection(): void {
    this.database.exec("PRAGMA foreign_keys = ON");
    this.database.exec("PRAGMA journal_mode = WAL");
    this.database.exec("PRAGMA busy_timeout = 5000");
    this.database.exec("PRAGMA synchronous = NORMAL");
  }

  private saveProject(project: ProjectRecord): void {
    this.database.prepare(`
      INSERT INTO aos_projects(id, name, registry_status, status, gate_state, record_json)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, registry_status = excluded.registry_status, status = excluded.status, gate_state = excluded.gate_state, record_json = excluded.record_json, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    `).run(project.id, project.name, project.registryStatus, project.status, project.gateState, stableJson(project));
  }

  private saveEmployee(employee: AIEmployee, sourceDigest: string | null): number {
    const result = this.database.prepare(`
      INSERT INTO aos_ai_employees(id, name, role, thread_id, lifecycle, source_digest, record_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, role = excluded.role, thread_id = excluded.thread_id, lifecycle = excluded.lifecycle, source_digest = coalesce(excluded.source_digest, aos_ai_employees.source_digest), record_json = excluded.record_json, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    `).run(employee.id, employee.name, employee.role, employee.threadIdentity.threadId, employee.lifecycle, sourceDigest, stableJson(employee));
    return Number(result.changes ?? 0);
  }

  private canonicalEmployee(employee: AIEmployee): AIEmployee {
    const existing = this.employeeByThreadId(employee.threadIdentity.threadId);
    return existing && existing.id !== employee.id ? { ...employee, id: existing.id } : employee;
  }

  private saveInitiative(record: InitiativeRecord): void {
    this.database.prepare(`
      INSERT INTO aos_initiatives(id, project_id, title, status, record_json)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET project_id = excluded.project_id, title = excluded.title, status = excluded.status, record_json = excluded.record_json, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    `).run(record.id, record.projectId, record.title, record.status, stableJson(record));
  }

  private saveEpic(record: EpicRecord): void {
    this.database.prepare(`
      INSERT INTO aos_epics(id, initiative_id, title, status, record_json)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET initiative_id = excluded.initiative_id, title = excluded.title, status = excluded.status, record_json = excluded.record_json, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    `).run(record.id, record.initiativeId, record.title, record.status, stableJson(record));
  }

  private saveStory(record: StoryRecord): void {
    this.database.prepare(`
      INSERT INTO aos_stories(id, epic_id, title, status, record_json)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET epic_id = excluded.epic_id, title = excluded.title, status = excluded.status, record_json = excluded.record_json, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    `).run(record.id, record.epicId, record.title, record.status, stableJson(record));
  }

  private saveSubtask(record: SubTask & { storyId: string }): void {
    this.database.prepare(`
      INSERT INTO aos_subtasks(id, story_id, owner_role, status, record_json)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET story_id = excluded.story_id, owner_role = excluded.owner_role, status = excluded.status, record_json = excluded.record_json, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    `).run(record.id, record.storyId, record.ownerRole, record.status, stableJson(record));
  }

  private saveAssignment(record: Assignment): void {
    this.database.prepare(`
      INSERT INTO aos_assignments(id, employee_id, target_id, target_type, role, status, record_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET employee_id = excluded.employee_id, target_id = excluded.target_id, target_type = excluded.target_type, role = excluded.role, status = excluded.status, record_json = excluded.record_json, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    `).run(record.id, record.employeeId, record.targetId, record.targetType, record.role, record.status, stableJson(record));
  }

  private saveAgentRun(record: AgentRun): void {
    this.database.prepare(`
      INSERT INTO aos_agent_runs(id, assignment_id, status, started_at, ended_at, record_json)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET assignment_id = excluded.assignment_id, status = excluded.status, started_at = excluded.started_at, ended_at = excluded.ended_at, record_json = excluded.record_json, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    `).run(record.id, record.assignmentId, record.status, record.startedAt, record.endedAt ?? null, stableJson(record));
  }

  private saveGate(record: GateWorkOrder): void {
    this.database.prepare(`
      INSERT INTO aos_gate_work_orders(id, linked_ticket_id, type, owner_role, status, record_json)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET linked_ticket_id = excluded.linked_ticket_id, type = excluded.type, owner_role = excluded.owner_role, status = excluded.status, record_json = excluded.record_json, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    `).run(record.id, record.linkedTicketId, record.type, record.ownerRole, record.status, stableJson(record));
  }

  private saveEvidence(record: EvidenceLink): void {
    this.database.prepare(`
      INSERT INTO aos_evidence_links(id, type, target, digest, redaction_state, record_json)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET type = excluded.type, target = excluded.target, digest = excluded.digest, redaction_state = excluded.redaction_state, record_json = excluded.record_json, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    `).run(record.id, record.type, record.target, record.digest ?? null, record.redactionState, stableJson(record));
  }

  private readJsonRows<T>(table: string): T[] {
    return (this.database.prepare(`SELECT record_json FROM ${table} ORDER BY id`).all() as Array<{ record_json: string }>).map((row) => JSON.parse(row.record_json) as T);
  }

  private hasTable(table: string): boolean {
    return Boolean(this.database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
  }

  private tableCount(table: string): number {
    const row = this.database.prepare(`SELECT count(*) as count FROM ${table}`).get() as { count: number };
    return Number(row.count);
  }

  private knowledgeRetrievalFts5Available(): boolean {
    if (!this.hasTable("aos_knowledge_entries_fts")) {
      return false;
    }
    try {
      this.database.prepare("SELECT rowid FROM aos_knowledge_entries_fts WHERE aos_knowledge_entries_fts MATCH ? LIMIT 1").all("unlikely_probe_token");
      return true;
    } catch {
      return false;
    }
  }

  private columnNames(table: string): string[] {
    return (this.database.prepare(`PRAGMA table_info(${quoteIdentifier(table)})`).all() as Array<{ name: string }>).map((row) => row.name);
  }

  private tableSql(table: string): string {
    const row = this.database.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?").get(table) as { sql: string } | undefined;
    return row?.sql ?? "";
  }

  private selectIds(table: string, column: string, value: string): string[] {
    return (this.database.prepare(`SELECT id FROM ${table} WHERE ${column} = ? ORDER BY id`).all(value) as Array<{ id: string }>).map((row) => row.id);
  }

  private employeeByThreadId(threadId: string): { id: string; record_json: string; source_digest: string | null } | undefined {
    return this.database.prepare("SELECT id, record_json, source_digest FROM aos_ai_employees WHERE thread_id = ?").get(threadId) as { id: string; record_json: string; source_digest: string | null } | undefined;
  }

  private employeeCanonicalityReadback(): { duplicateNonNullThreadIdCount: number } {
    const rows = this.database.prepare(`
      SELECT thread_id, count(*) as count
      FROM aos_ai_employees
      WHERE thread_id IS NOT NULL
      GROUP BY thread_id
      HAVING count(*) > 1
    `).all() as Array<{ thread_id: string; count: number }>;
    return { duplicateNonNullThreadIdCount: rows.length };
  }

  private firstEmployeeId(): string {
    const row = this.database.prepare("SELECT id FROM aos_ai_employees ORDER BY id LIMIT 1").get() as { id: string } | undefined;
    if (!row) {
      throw new Error("phase1_schema_integrity_probe_missing_employee");
    }
    return row.id;
  }

  private firstStoryId(): string {
    const row = this.database.prepare("SELECT id FROM aos_stories ORDER BY id LIMIT 1").get() as { id: string } | undefined;
    if (!row) {
      throw new Error("phase1_schema_integrity_probe_missing_story");
    }
    return row.id;
  }

  private firstInitiativeId(): string {
    const row = this.database.prepare("SELECT id FROM aos_initiatives ORDER BY id LIMIT 1").get() as { id: string } | undefined;
    if (!row) {
      throw new Error("phase1_schema_integrity_probe_missing_initiative");
    }
    return row.id;
  }

  private firstEpicId(): string {
    const row = this.database.prepare("SELECT id FROM aos_epics ORDER BY id LIMIT 1").get() as { id: string } | undefined;
    if (!row) {
      throw new Error("phase1_schema_integrity_probe_missing_epic");
    }
    return row.id;
  }

  private firstAssignmentId(): string {
    const row = this.database.prepare("SELECT id FROM aos_assignments ORDER BY id LIMIT 1").get() as { id: string } | undefined;
    if (!row) {
      throw new Error("phase1_schema_integrity_probe_missing_assignment");
    }
    return row.id;
  }

  private rejectInvalidJsonForTable(table: string): boolean {
    const invalidJson = "{invalid-json";
    switch (table) {
      case "aos_projects":
        return this.rejectProbe("INSERT INTO aos_projects(id, name, registry_status, status, gate_state, record_json) VALUES ('probe-project-json', 'Probe', 'planned', 'proposed', 'pending_role', ?)", invalidJson);
      case "aos_ai_employees":
        return this.rejectProbe("INSERT INTO aos_ai_employees(id, name, role, thread_id, lifecycle, source_digest, record_json) VALUES ('probe-employee-json', 'Probe', 'implementation', 'probe-thread-json', 'active', 'probe', ?)", invalidJson);
      case "aos_initiatives":
        return this.rejectProbe("INSERT INTO aos_initiatives(id, project_id, title, status, record_json) VALUES ('probe-initiative-json', 'TCRN-AOS', 'Probe', 'proposed', ?)", invalidJson);
      case "aos_epics":
        return this.rejectProbe("INSERT INTO aos_epics(id, initiative_id, title, status, record_json) VALUES ('probe-epic-json', ?, 'Probe', 'proposed', ?)", this.firstInitiativeId(), invalidJson);
      case "aos_stories":
        return this.rejectProbe("INSERT INTO aos_stories(id, epic_id, title, status, record_json) VALUES ('probe-story-json', ?, 'Probe', 'proposed', ?)", this.firstEpicId(), invalidJson);
      case "aos_subtasks":
        return this.rejectProbe("INSERT INTO aos_subtasks(id, story_id, owner_role, status, record_json) VALUES ('probe-subtask-json', ?, 'implementation', 'proposed', ?)", this.firstStoryId(), invalidJson);
      case "aos_assignments":
        return this.rejectProbe("INSERT INTO aos_assignments(id, employee_id, target_id, target_type, role, status, record_json) VALUES ('probe-assignment-json', ?, ?, 'story', 'implementation', 'proposed', ?)", this.firstEmployeeId(), this.firstStoryId(), invalidJson);
      case "aos_agent_runs":
        return this.rejectProbe("INSERT INTO aos_agent_runs(id, assignment_id, status, started_at, ended_at, record_json) VALUES ('probe-run-json', ?, 'success', '2026-07-05T00:00:00.000Z', NULL, ?)", this.firstAssignmentId(), invalidJson);
      case "aos_gate_work_orders":
        return this.rejectProbe("INSERT INTO aos_gate_work_orders(id, linked_ticket_id, type, owner_role, status, record_json) VALUES ('probe-gate-json', ?, 'evidence_proof', 'evidence', 'pending_role', ?)", this.firstStoryId(), invalidJson);
      case "aos_evidence_links":
        return this.rejectProbe("INSERT INTO aos_evidence_links(id, type, target, digest, redaction_state, record_json) VALUES ('probe-evidence-json', 'artifact_id', 'probe-artifact', NULL, 'metadata_only', ?)", invalidJson);
      case "aos_audit_events":
        return this.rejectProbe("INSERT INTO aos_audit_events(id, target_type, target_id, action, outcome, actor_ref, timestamp, record_json) VALUES ('probe-audit-json', 'probe', 'probe', 'probe', 'accepted', 'system', '2026-07-05T00:00:00.000Z', ?)", invalidJson);
      default:
        return false;
    }
  }

  private rejectProbe(sql: string, ...values: SqlProbeValue[]): boolean {
    const savepoint = `phase1_probe_${Math.random().toString(16).slice(2)}`;
    this.database.exec(`SAVEPOINT ${savepoint}`);
    try {
      this.database.prepare(sql).run(...values);
      return false;
    } catch {
      return true;
    } finally {
      this.database.exec(`ROLLBACK TO ${savepoint}`);
      this.database.exec(`RELEASE ${savepoint}`);
    }
  }

  private pragmaValue(name: string): unknown {
    const row = this.database.prepare(`PRAGMA ${name}`).get() as Record<string, unknown> | undefined;
    return row ? Object.values(row)[0] : null;
  }
}

export function assertRouteOwnedSqliteRoot(root: string, repoRoot: string, markerFile = ".tcrn-aos-phase1-root"): { ok: true; rootDigest: string } {
  mkdirSync(root, { recursive: true });
  if (lstatSync(root).isSymbolicLink()) {
    throw new Error("phase1_sqlite_root_symlink_denied");
  }
  const canonicalRoot = realpathSync(root);
  const canonicalRepo = realpathSync(repoRoot);
  if (canonicalRoot === canonicalRepo || canonicalRoot.startsWith(canonicalRepo + sep)) {
    throw new Error("phase1_sqlite_root_inside_git_repo_denied");
  }
  const markerPath = join(canonicalRoot, markerFile);
  if (!existsSync(markerPath) || !lstatSync(markerPath).isFile()) {
    throw new Error("phase1_sqlite_root_marker_missing");
  }
  return {
    ok: true,
    rootDigest: sha256(stableJson({ markerFile, relativeToRepo: relative(dirname(canonicalRepo), canonicalRoot).replaceAll(sep, "/") }))
  };
}

function projectThreadRow(row: Record<string, unknown>, index: number): AIEmployee {
  const slug = stringField(row.codexAgentSlug) || `thread-${index}`;
  const name = stringField(row.name) || slug;
  const jobTitle = stringField(row.jobTitle) || "Workflow Role";
  const role = inferActorRole(`${slug} ${name} ${jobTitle}`);
  return {
    id: `employee-registry-${slug.replace(/^tcrn-thread-/, "")}`,
    name: name.split(",")[0] ?? name,
    role,
    authoritySummary: `Workflow registry projection for ${jobTitle}.`,
    contactWhen: stringField(row.contactWhen) || "Route by Workflow registry policy.",
    lifecycle: row.status === "archived" ? "archived" : "active",
    threadIdentity: {
      threadId: stringField(row.threadId) || slug,
      status: row.status === "archived" ? "archived" : "active",
      lifecycle: row.lifecycle === "ephemeral" ? "ephemeral" : "persistent"
    },
    roleContractRefs: [slug],
    skillRefs: ["workflow-registry-projection"]
  };
}

function inferActorRole(value: string): AIEmployee["role"] {
  const lower = value.toLowerCase();
  if (/owner/.test(lower)) return "owner_observer";
  if (/registrar/.test(lower)) return "registrar";
  if (/knowledge/.test(lower)) return "knowledge";
  if (/security|privacy|sable/.test(lower)) return "security";
  if (/evidence|qa|rowan/.test(lower)) return "evidence";
  if (/verity|verification/.test(lower)) return "verification";
  if (/release|selene/.test(lower)) return "release";
  if (/product|mara|talia/.test(lower)) return "product_strategy";
  if (/architect|daedalus|opal|backend/.test(lower)) return "architecture";
  if (/orchestrator|arturo|coordinator/.test(lower)) return "coordinator";
  return "implementation";
}

function actorRef(actor: AuditEvent["actor"]): string {
  return "employeeId" in actor ? actor.employeeId : actor.system;
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function placeholders(count: number): string {
  return count > 0 ? Array.from({ length: count }, () => "?").join(", ") : "NULL";
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll("\"", "\"\"")}"`;
}

function digestIdentityColumn(table: string): string {
  return table === "aos_schema_migrations" ? "version" : "id";
}

interface KnowledgeRetrievalRow {
  id: string;
  title: string;
  role_scope: string;
  project: string;
  category: string;
  knowledge_kind: string;
  status: KnowledgeRetrievalStatus;
  last_verified: string;
  staleness_policy: string;
  source_ref: string;
  source_digest: string;
  tags: string;
  summary: string;
  body: string;
  access_count: number;
  last_accessed: string | null;
  created_at: string;
  updated_at: string;
}

function normalizeKnowledgeRetrievalEntry(input: KnowledgeRetrievalEntryInput): KnowledgeRetrievalEntryRecord {
  const tags = normalizeTags(input.tags);
  const now = new Date().toISOString();
  const entry: KnowledgeRetrievalEntryRecord = {
    id: requireNonEmpty(input.id, "id"),
    title: requireNonEmpty(input.title, "title"),
    roleScope: requireNonEmpty(input.roleScope, "roleScope"),
    project: requireNonEmpty(input.project, "project"),
    category: requireNonEmpty(input.category, "category"),
    knowledgeKind: requireNonEmpty(input.knowledgeKind, "knowledgeKind"),
    status: validateKnowledgeStatus(input.status),
    lastVerified: requireIsoDate(input.lastVerified),
    stalenessPolicy: requireNonEmpty(input.stalenessPolicy, "stalenessPolicy"),
    sourceRef: requireNonEmpty(input.sourceRef, "sourceRef"),
    sourceDigest: requireNonEmpty(input.sourceDigest, "sourceDigest"),
    tags,
    summary: validateWordLimit(input.summary, "summary", 120),
    body: validateWordLimit(input.body, "body", 1500),
    accessCount: Math.max(0, Math.trunc(input.accessCount ?? 0)),
    lastAccessed: input.lastAccessed ?? null,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now
  };
  return entry;
}

function rowToKnowledgeRetrievalEntry(row: KnowledgeRetrievalRow): KnowledgeRetrievalEntryRecord {
  return {
    id: row.id,
    title: row.title,
    roleScope: row.role_scope,
    project: row.project,
    category: row.category,
    knowledgeKind: row.knowledge_kind,
    status: row.status,
    lastVerified: row.last_verified,
    stalenessPolicy: row.staleness_policy,
    sourceRef: row.source_ref,
    sourceDigest: row.source_digest,
    tags: normalizeTags(JSON.parse(row.tags) as unknown),
    summary: row.summary,
    body: row.body,
    accessCount: Number(row.access_count),
    lastAccessed: row.last_accessed,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function knowledgeRetrievalFreshness(
  entry: Pick<KnowledgeRetrievalEntryRecord, "lastVerified" | "stalenessPolicy">,
  now: Date = new Date()
): KnowledgeRetrievalFreshnessReadback {
  const staleAfterDays = parseStalenessPolicyDays(entry.stalenessPolicy);
  if (staleAfterDays === null) {
    return {
      stale: false,
      stalenessPolicy: entry.stalenessPolicy,
      lastVerified: entry.lastVerified,
      staleAfterDays
    };
  }
  const verifiedAt = Date.parse(entry.lastVerified);
  if (!Number.isFinite(verifiedAt)) {
    return {
      stale: true,
      stalenessPolicy: entry.stalenessPolicy,
      lastVerified: entry.lastVerified,
      staleAfterDays
    };
  }
  const staleAt = verifiedAt + staleAfterDays * 24 * 60 * 60 * 1000;
  return {
    stale: staleAt < now.getTime(),
    stalenessPolicy: entry.stalenessPolicy,
    lastVerified: entry.lastVerified,
    staleAfterDays
  };
}

function parseStalenessPolicyDays(policy: string): number | null {
  const normalized = policy.trim().toLowerCase();
  if (["none", "never", "manual", "no_expiry"].includes(normalized)) {
    return null;
  }
  const match = /(?:review_after|stale_after|after)[_-]?(\d+)[_-]?days?/.exec(normalized);
  if (!match?.[1]) {
    return null;
  }
  return Math.max(0, Number(match[1]));
}

function encodeKnowledgeRetrievalCursor(offset: number): string {
  return Buffer.from(`kr02-offset:${offset}`, "utf8").toString("base64url");
}

function parseKnowledgeRetrievalCursor(value: unknown): number {
  if (value === undefined || value === null) {
    return 0;
  }
  if (typeof value !== "string") {
    throw new Error("knowledge_search_cursor_invalid");
  }
  const decoded = Buffer.from(value, "base64url").toString("utf8");
  const match = /^kr02-offset:(\d+)$/.exec(decoded);
  if (!match?.[1]) {
    throw new Error("knowledge_search_cursor_invalid");
  }
  return Number(match[1]);
}

function validateKnowledgeStatus(status: KnowledgeRetrievalStatus): KnowledgeRetrievalStatus {
  if (["canonical", "draft", "deprecated"].includes(status)) {
    return status;
  }
  throw new Error("knowledge_status_invalid");
}

function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags) || tags.some((tag) => typeof tag !== "string" || tag.trim().length === 0)) {
    throw new Error("knowledge_tags_must_be_non_empty_string_array");
  }
  return [...new Set(tags.map((tag) => tag.trim()))].sort();
}

function requireIsoDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) {
    throw new Error("knowledge_last_verified_iso_date_required");
  }
  return value;
}

function requireNonEmpty(value: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`knowledge_${field}_required`);
  }
  return value.trim();
}

function validateWordLimit(value: string, field: string, limit: number): string {
  const actual = countWords(value);
  if (actual > limit) {
    throw new KnowledgeRetrievalValidationError(`knowledge_${field}_word_limit_exceeded`, field, limit, actual);
  }
  return value.trim();
}

function countWords(value: string): number {
  const trimmed = value.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

function tokenizeSearchQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9_:-]+/i)
    .map((term) => term.replace(/[^a-z0-9_:-]/gi, ""))
    .filter((term) => term.length > 0)
    .slice(0, 8);
}

function isPublicAosDataTable(table: string): boolean {
  return !isAosFtsInternalTable(table);
}

function isAosFtsInternalTable(table: string): boolean {
  return /^aos_.*_fts(?:_|$)/.test(table);
}

export function probeSqliteFts5Availability(): { ok: boolean; fts5Available: boolean; errorReason: string | null } {
  const database = new DatabaseSync(":memory:");
  try {
    database.exec("CREATE VIRTUAL TABLE kr01_fts_probe USING fts5(value)");
    database.prepare("INSERT INTO kr01_fts_probe(value) VALUES (?)").run("probe value");
    const row = database.prepare("SELECT rowid FROM kr01_fts_probe WHERE kr01_fts_probe MATCH ?").get("probe") as { rowid: number } | undefined;
    return { ok: Boolean(row), fts5Available: Boolean(row), errorReason: null };
  } catch (error) {
    return { ok: true, fts5Available: false, errorReason: error instanceof Error ? error.message : String(error) };
  } finally {
    database.close();
  }
}

function rejects(operation: () => unknown): boolean {
  try {
    operation();
    return false;
  } catch {
    return true;
  }
}

export function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function stableJson(value: unknown): string {
  return JSON.stringify(value, Object.keys(flattenKeys(value)).sort());
}

function flattenKeys(value: unknown, keys: Record<string, true> = {}): Record<string, true> {
  if (Array.isArray(value)) {
    value.forEach((item) => flattenKeys(item, keys));
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      keys[key] = true;
      flattenKeys(child, keys);
    }
  }
  return keys;
}
