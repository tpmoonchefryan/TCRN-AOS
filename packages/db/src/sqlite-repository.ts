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
  "aos_knowledge_entries",
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
  pragmas: Record<string, unknown>;
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
  allowlistedFields: string[];
  secondSeedNoop: boolean;
}

export interface AosSqliteRepositoryOptions {
  databasePath: string;
  migrationsDir?: string;
}

const defaultMigrationsDir = new URL("../migrations/sqlite", import.meta.url);

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

  applyMigrations(): SqliteMigrationReadback {
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
    const migrations: SqliteMigrationReadback["migrations"] = [];
    let appliedCount = 0;
    for (const file of files) {
      const version = file.replace(/\.sql$/, "");
      const sql = readFileSync(join(this.migrationsDir, file), "utf8");
      const digest = sha256(sql);
      const existing = this.database.prepare("SELECT digest FROM aos_schema_migrations WHERE version = ?").get(version) as { digest: string } | undefined;
      if (existing && existing.digest !== digest) {
        throw new Error(`SQLite migration digest changed after apply: ${version}`);
      }
      if (!existing) {
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
        const existing = this.database.prepare("SELECT record_json, source_digest FROM aos_ai_employees WHERE id = ?").get(employee.id) as { record_json: string; source_digest: string | null } | undefined;
        const recordJson = stableJson(employee);
        if (existing && existing.record_json === recordJson && (sourceDigest === null || existing.source_digest === sourceDigest)) {
          continue;
        }
        this.saveEmployee(employee, sourceDigest);
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
    const first = this.seedAiEmployees(employees, sourceDigest);
    const second = this.seedAiEmployees(employees, sourceDigest);
    return {
      employees,
      readback: {
        ok: second.insertedCount === 0,
        sourceDigest,
        rowCount: first.rowCount,
        insertedCount: first.insertedCount,
        allowlistedFields: ["codexAgentSlug", "name", "jobTitle", "threadId", "status", "lifecycle", "contactWhen"],
        secondSeedNoop: second.insertedCount === 0
      }
    };
  }

  tableNames(): string[] {
    return (this.database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'aos_%' ORDER BY name").all() as Array<{ name: string }>).map((row) => row.name);
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
    const assignmentIds = this.selectIds("aos_assignments", "target_id", storyId);
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

  private selectIds(table: string, column: string, value: string): string[] {
    return (this.database.prepare(`SELECT id FROM ${table} WHERE ${column} = ? ORDER BY id`).all(value) as Array<{ id: string }>).map((row) => row.id);
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

function digestIdentityColumn(table: string): string {
  return table === "aos_schema_migrations" ? "version" : "id";
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
