import { stdin as processStdin, stdout as processStdout } from "node:process";
import { createInterface } from "node:readline";
import { homedir } from "node:os";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { basename, dirname, join, parse, relative, resolve, sep } from "node:path";
import {
  AosStore,
  POLICY_VERSION,
  canWrite,
  digest,
  redactForAudit,
  summarizePayloadForAudit,
  type ActorIdentity,
  type ActorRole,
  type AgentRun,
  type AuditEvent
} from "../../domain/src/index.js";
import {
  AosSqliteRepository,
  knowledgeRetrievalFreshness,
  createSqliteLogicalExport,
  createSqlitePhysicalSnapshot,
  listBackupArtifacts,
  stableJson,
  KnowledgeRetrievalValidationError,
  type KnowledgeRetrievalEntryRecord,
  type KnowledgeRetrievalStatus
} from "../../db/src/index.js";
import { assertRouteOwnedSqliteRoot, digestFile, sha256 as sqliteSha256 } from "../../db/src/index.js";
import { McpGateway, type McpResponse } from "../../mcp-gateway/src/index.js";

export const transportMvpMethods = [
  "aos.ticket.propose",
  "aos.ticket.comment",
  "aos.ticket.list",
  "aos.assignment.claim",
  "aos.assignment.update",
  "aos.run.summary.create",
  "aos.evidence.link",
  "aos.backup.snapshot.create",
  "aos.backup.export.create",
  "aos.backup.list",
  "aos.knowledge.entry.propose",
  "aos.knowledge.entry.read",
  "aos.knowledge.search",
  "aos.gate.request",
  "aos.gate.decision.record",
  "aos.policy.read",
  "aos.stage_map.read",
  "aos.audit.query"
] as const;

export type TransportMvpMethod = typeof transportMvpMethods[number];

export const transportReadMethods: readonly TransportMvpMethod[] = [
  "aos.policy.read",
  "aos.ticket.list",
  "aos.backup.list",
  "aos.knowledge.entry.read",
  "aos.knowledge.search",
  "aos.stage_map.read",
  "aos.audit.query"
];

export interface AosMcpTransportConfig {
  trustedActor: ActorIdentity;
  auditPageLimit?: number;
  maxResponseBytes?: number;
  runtimeDatabase?: {
    databasePath: string;
    databaseRoot: string;
    rootDigest: string;
    backupDir: string;
    repoRoot: string;
    migrationsDir?: string;
  };
}

export interface AosMcpRuntimeConfig {
  actor: ActorIdentity;
  databasePath?: string;
  databaseRoot?: string;
  repoRoot?: string;
  migrationsDir?: string;
  routeOwnedMarkerFile?: string;
  runtimeProfileMarker?: {
    route: string;
    markerVersion: string;
    purpose?: string;
  };
  auditPageLimit?: number;
  maxResponseBytes?: number;
}

export interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: Record<string, unknown>;
  };
}

export interface RuntimeTransport {
  transport: AosMcpTransport;
  close(): void;
}

const DEFAULT_AUDIT_PAGE_LIMIT = 5;
const DEFAULT_MAX_RESPONSE_BYTES = 16_384;
const blockedTransportMethodPrefixes = [
  "aos.conference.",
  "aos.documentation.",
  "aos.knowledge.",
  "aos.guide.",
  "aos.release_note.",
  "aos.docs.",
  "aos.github.",
  "aos.pr_ci.",
  "aos.release_candidate.",
  "aos.dependency.",
  "aos.resource.",
  "aos.work_index."
];

function isBackupMethod(method: string): boolean {
  return method === "aos.backup.list" || isBackupCreateMethod(method);
}

function isBackupCreateMethod(method: string): boolean {
  return method === "aos.backup.snapshot.create" || method === "aos.backup.export.create";
}

function isKnowledgeMethod(method: string): boolean {
  return method === "aos.knowledge.entry.propose" ||
    method === "aos.knowledge.entry.read" ||
    method === "aos.knowledge.search";
}

function backupCreateActorAllowed(actor: ActorIdentity): boolean {
  return actor.employeeId === "employee-atlas" || actor.employeeId === "aos-service-scheduler";
}

export class AosMcpTransport {
  private readonly gateway: McpGateway;
  private readonly auditPageLimit: number;
  private readonly maxResponseBytes: number;
  private readonly replayByKey = new Map<string, unknown>();

  constructor(
    private readonly store: AosStore,
    private readonly config: AosMcpTransportConfig,
    private readonly repository?: AosSqliteRepository
  ) {
    this.gateway = new McpGateway(store);
    this.auditPageLimit = Math.max(1, Math.min(config.auditPageLimit ?? DEFAULT_AUDIT_PAGE_LIMIT, DEFAULT_AUDIT_PAGE_LIMIT));
    this.maxResponseBytes = Math.max(1_024, config.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES);
  }

  get trustedActor(): ActorIdentity {
    return this.config.trustedActor;
  }

  handleJsonRpc(input: JsonRpcRequest): JsonRpcResponse {
    const id = input.id ?? null;
    try {
      if (input.jsonrpc !== undefined && input.jsonrpc !== "2.0") {
        throw new TransportError("invalid_jsonrpc_version", "JSON-RPC version must be 2.0");
      }
      const method = requireMethod(input.method);
      const params = normalizeParams(input.params);
      const result = this.handleTransportRequest(method, params);
      return { jsonrpc: "2.0", id, result };
    } catch (error) {
      const reason = error instanceof TransportError ? error.reason : "transport_request_failed";
      const message = error instanceof Error ? error.message : String(error);
      this.auditRefusal(typeof input.method === "string" ? input.method : "malformed", reason, input.params);
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32000,
          message,
          data: { reason }
        }
      };
    }
  }

  handleTransportRequest(method: string, params: Record<string, unknown>): unknown {
    this.validateTransportMethod(method);
    this.rejectClientSuppliedAuthority(params);
    const actor = this.resolveTrustedActor(method);
    const typedMethod = method as TransportMvpMethod;
    if (!transportReadMethods.includes(typedMethod) && !isBackupCreateMethod(method) && !canWrite(actor)) {
      throw new TransportError("transport_actor_read_only", `Role ${actor.role} cannot write through MCP stdio transport`);
    }

    const replayKey = replayKeyFor(method, actor.employeeId, params);
    const replayed = this.replayByKey.get(replayKey);
    if (replayed) {
      return this.enforceBudget({
        ok: true,
        method,
        status: "deduped",
        replayScope: "process_local_only",
        result: replayed
      });
    }

    if (method === "aos.policy.read") {
      const result = this.policyRead(actor);
      this.store.appendAudit(actor, "mcp.transport.aos.policy.read", "mcp_request", replayKey, "read", {
        method,
        transportAllowedMethods: transportMvpMethods
      });
      return this.cacheBudgetedResult(replayKey, result);
    }
    if (method === "aos.audit.query") {
      const result = this.auditQuery(params);
      this.store.appendAudit(actor, "mcp.transport.aos.audit.query", "mcp_request", replayKey, "read", {
        method,
        returnedCount: result.returnedCount,
        hasMore: result.hasMore
      });
      return this.cacheBudgetedResult(replayKey, result);
    }
    if (method === "aos.backup.list") {
      const result = this.backupList();
      this.store.appendAudit(actor, "mcp.transport.aos.backup.list", "mcp_request", replayKey, "read", {
        method,
        returnedCount: result.returnedCount
      });
      return this.cacheBudgetedResult(replayKey, result);
    }
    if (isBackupCreateMethod(method)) {
      const result = this.backupCreate(actor, method, params);
      this.store.appendAudit(actor, `mcp.transport.${method}`, "mcp_request", replayKey, "accepted", {
        method,
        resultDigest: digest(result),
        backupCreateAuthority: true
      });
      return this.cacheBudgetedResult(replayKey, result);
    }
    if (isKnowledgeMethod(method)) {
      const result = this.knowledgeRequest(actor, method, params, replayKey);
      return this.cacheBudgetedResult(replayKey, result);
    }

    const response = this.gateway.handle({
      method,
      actor,
      params,
      idempotencyKey: typeof params.idempotencyKey === "string" ? params.idempotencyKey : replayKey
    });
    if (method === "aos.ticket.list" && response.ok) {
      return this.cacheBudgetedResult(replayKey, response.result);
    }
    const result = normalizeGatewayResponse(response);
    return this.cacheBudgetedResult(replayKey, result);
  }

  private resolveTrustedActor(method: string): ActorIdentity {
    const actor = this.config.trustedActor;
    const employee = this.store.getEmployee(actor.employeeId);
    if (!employee) {
      throw new TransportError("transport_actor_unknown", `Unknown transport actor employee: ${actor.employeeId}`);
    }
    if (employee.role !== actor.role) {
      throw new TransportError("transport_actor_role_mismatch", `Transport actor role mismatch for ${actor.employeeId}`);
    }
    if (employee.threadIdentity.threadId !== actor.threadId) {
      throw new TransportError("transport_actor_thread_mismatch", `Transport actor thread mismatch for ${actor.employeeId}`);
    }
    if (employee.threadIdentity.status !== "active") {
      throw new TransportError("transport_actor_thread_inactive", `Transport actor thread is not active for ${actor.employeeId}`);
    }
    if (employee.lifecycle !== "active") {
      throw new TransportError("transport_actor_lifecycle_inactive", `Transport actor lifecycle is not active for ${actor.employeeId}`);
    }
    if (!transportReadMethods.includes(method as TransportMvpMethod) && !isBackupMethod(method) && actor.role === "owner_observer") {
      throw new TransportError("transport_actor_blocked_role", `Role ${actor.role} is read-only for MCP stdio transport`);
    }
    return actor;
  }

  private validateTransportMethod(method: string): void {
    if (transportMvpMethods.includes(method as TransportMvpMethod)) {
      return;
    }
    if (blockedTransportMethodPrefixes.some((prefix) => method.startsWith(prefix))) {
      throw new TransportError("transport_method_outside_mvp_allowlist", `MCP stdio transport does not expose method: ${method}`);
    }
    throw new TransportError("transport_method_unknown", `Unsupported MCP stdio method: ${method}`);
  }

  private rejectClientSuppliedAuthority(params: Record<string, unknown>): void {
    const forbiddenAuthorityKeys = ["actor", "employeeId", "role", "threadId", "sessionId", "clientEnv", "auth", "authorization"];
    const supplied = forbiddenAuthorityKeys.filter((key) => params[key] !== undefined);
    if (supplied.length > 0) {
      throw new TransportError("client_supplied_authority_denied", `Client-supplied actor authority is not trusted: ${supplied.join(",")}`);
    }
  }

  private policyRead(actor: ActorIdentity): Record<string, unknown> {
    return {
      ok: true,
      policyVersion: POLICY_VERSION,
      transportAllowedMethods: transportMvpMethods,
      fullGatewayMethodListExposed: false,
      boundaries: {
        localOnly: true,
        stdioOnly: true,
        noNetworkListener: true,
        durableRuntimeActivation: false,
        liveDispatchAuthorized: false,
        ownerIntentExecutionAuthorized: false,
        retainedPreviewFreshnessClaimed: false,
        releasePublicationPushAuthorized: false,
        kr02KnowledgeMethodsRegisteredOnTransport: true,
        slices7To9RegisteredOnTransport: false
      },
      actorAuthoritySnapshot: {
        employeeId: actor.employeeId,
        role: actor.role,
        threadId: actor.threadId,
        canWrite: canWrite(actor),
        backupCreateAuthority: backupCreateActorAllowed(actor)
      },
      responseBudget: {
        maxResponseBytes: this.maxResponseBytes,
        auditPageLimit: this.auditPageLimit
      }
    };
  }

  private auditQuery(params: Record<string, unknown>): {
    ok: true;
    method: "aos.audit.query";
    items: Array<Record<string, unknown>>;
    limit: number;
    returnedCount: number;
    nextCursor: string | null;
    hasMore: boolean;
  } {
    const limit = clampLimit(params.limit, this.auditPageLimit);
    const offset = parseCursor(params.cursor);
    const filter: Partial<{ targetId: string; action: string; actorEmployeeId: string }> = {};
    const targetId = stringParam(params.targetId);
    const action = stringParam(params.action);
    const actorEmployeeId = stringParam(params.actorEmployeeId);
    if (targetId) {
      filter.targetId = targetId;
    }
    if (action) {
      filter.action = action;
    }
    if (actorEmployeeId) {
      filter.actorEmployeeId = actorEmployeeId;
    }
    const events = this.store.queryAudit(filter).sort((left, right) => left.timestamp.localeCompare(right.timestamp) || left.id.localeCompare(right.id));
    const page = events.slice(offset, offset + limit);
    const nextOffset = offset + page.length;
    return {
      ok: true,
      method: "aos.audit.query",
      items: page.map(redactAuditEventForTransport),
      limit,
      returnedCount: page.length,
      nextCursor: nextOffset < events.length ? encodeCursor(nextOffset) : null,
      hasMore: nextOffset < events.length
    };
  }

  private backupList() {
    const runtime = this.requireRuntimeDatabase();
    return listBackupArtifacts({
      backupDir: runtime.backupDir,
      forbiddenWorktreeRoots: [runtime.repoRoot]
    });
  }

  private backupCreate(actor: ActorIdentity, method: string, params: Record<string, unknown>): Record<string, unknown> {
    if (!backupCreateActorAllowed(actor)) {
      throw new TransportError("backup_create_actor_denied", `Actor ${actor.employeeId} is not allowed to create backup artifacts`);
    }
    const runtime = this.requireRuntimeDatabase();
    const createdAt = stringParam(params.createdAt) ?? new Date().toISOString();
    const purpose = stringParam(params.purpose) ?? method.replaceAll(".", "_");
    const profileId = stringParam(params.profileId) ?? "aos-runtime-profile";
    const sourceProfileDigest = sqliteSha256(`${runtime.rootDigest}:${digestFile(runtime.databasePath)}`);
    const idBase = sqliteSha256(JSON.stringify({
      method,
      actor: actor.employeeId,
      purpose,
      idempotencyKey: stringParam(params.idempotencyKey) ?? "",
      createdAt
    })).slice(0, 16);
    if (method === "aos.backup.snapshot.create") {
      const snapshotId = stringParam(params.snapshotId) ?? `bk02-method-snapshot-${idBase}`;
      const snapshot = createSqlitePhysicalSnapshot({
        sourceDatabasePath: runtime.databasePath,
        snapshotPath: join(runtime.backupDir, "bk02-method-physical-snapshots", `${snapshotId}.sqlite`),
        snapshotId,
        createdAt,
        purpose,
        sourceProfileDigest,
        routeId: "aos.backup.snapshot.create",
        profileId,
        forbiddenWorktreeRoots: [runtime.repoRoot]
      });
      return {
        ok: snapshot.ok,
        method,
        snapshotId: snapshot.snapshotId,
        createdWith: snapshot.createdWith,
        snapshotDigest: snapshot.snapshotDigest,
        manifestDigest: snapshot.manifestDigest,
        tableRowCounts: snapshot.manifest.tableRowCounts,
        liveDatabaseFileCopiedDirectly: snapshot.liveDatabaseFileCopiedDirectly,
        rawPathRecorded: false
      };
    }
    const exportId = stringParam(params.exportId) ?? `bk02-logical-export-${idBase}`;
    const logicalExport = createSqliteLogicalExport({
      sourceDatabasePath: runtime.databasePath,
      internalSnapshotPath: join(runtime.backupDir, "bk02-logical-export-internal-snapshots", `${exportId}.sqlite`),
      exportDirectory: join(runtime.backupDir, "bk02-logical-exports", exportId),
      exportId,
      internalSnapshotId: `${exportId}-internal-snapshot`,
      createdAt,
      purpose,
      sourceProfileDigest,
      routeId: "aos.backup.export.create",
      profileId,
      forbiddenWorktreeRoots: [runtime.repoRoot]
    });
    return {
      ok: logicalExport.ok,
      method,
      exportId: logicalExport.exportId,
      exportDigest: logicalExport.exportDigest,
      manifestDigest: logicalExport.manifestDigest,
      sourceSnapshotId: logicalExport.manifest.sourceSnapshotId,
      sourceSnapshotDigest: logicalExport.manifest.sourceSnapshotDigest,
      createdWith: logicalExport.createdWith,
      liveDatabaseFileReadDirectly: logicalExport.liveDatabaseFileReadDirectly,
      tableRowCounts: logicalExport.manifest.tableRowCounts,
      rawPathRecorded: false
    };
  }

  private knowledgeRequest(actor: ActorIdentity, method: string, params: Record<string, unknown>, replayKey: string): Record<string, unknown> {
    if (method === "aos.knowledge.entry.propose") {
      return this.knowledgePropose(actor, params, replayKey);
    }
    if (method === "aos.knowledge.entry.read") {
      return this.knowledgeRead(actor, params, replayKey);
    }
    return this.knowledgeSearch(actor, params, replayKey);
  }

  private knowledgePropose(actor: ActorIdentity, params: Record<string, unknown>, replayKey: string): Record<string, unknown> {
    const repository = this.requireKnowledgeRepository();
    const status = knowledgeStatusParam(params.status);
    const roleScope = stringParam(params.roleScope) ?? actor.role;
    if (roleScope !== actor.role) {
      throw new TransportError("knowledge_role_scope_mismatch", "Knowledge propose roleScope must match the trusted actor role");
    }
    if (status !== "draft") {
      throw new TransportError("knowledge_canonical_propose_deferred", "KR-02 public propose accepts draft knowledge only; canonical promotion is separately routed");
    }
    const proposedId = stringParam(params.id) ?? `knowledge_${sqliteSha256(stableJson({
      actor: actor.employeeId,
      title: stringParam(params.title),
      roleScope,
      project: stringParam(params.project),
      category: stringParam(params.category),
      knowledgeKind: stringParam(params.knowledgeKind),
      sourceDigest: stringParam(params.sourceDigest),
      sourceRefDigest: sqliteSha256(stringParam(params.sourceRef) ?? ""),
      tags: stringArrayParam(params.tags)
    })).slice(0, 20)}`;
    try {
      const entry = repository.createKnowledgeRetrievalEntry({
        id: proposedId,
        title: requireStringParam(params.title, "title"),
        roleScope,
        project: requireStringParam(params.project, "project"),
        category: requireStringParam(params.category, "category"),
        knowledgeKind: requireStringParam(params.knowledgeKind, "knowledgeKind"),
        status,
        lastVerified: requireStringParam(params.lastVerified, "lastVerified"),
        stalenessPolicy: requireStringParam(params.stalenessPolicy, "stalenessPolicy"),
        sourceRef: requireStringParam(params.sourceRef, "sourceRef"),
        sourceDigest: requireStringParam(params.sourceDigest, "sourceDigest"),
        tags: stringArrayParam(params.tags),
        summary: requireStringParam(params.summary, "summary"),
        body: requireStringParam(params.body, "body")
      });
      const audit = this.store.appendAudit(actor, "mcp.transport.aos.knowledge.entry.propose", "knowledge", entry.id, "accepted", {
        method: "aos.knowledge.entry.propose",
        replayKeyDigest: digest(replayKey),
        status: entry.status,
        canonicalPromotionDeferred: true,
        sourceDigest: entry.sourceDigest,
        sourceRefDigest: sqliteSha256(entry.sourceRef),
        tagsCount: entry.tags.length,
        bodyReturned: false,
        rawRecordJsonReturned: false
      });
      return {
        ok: true,
        method: "aos.knowledge.entry.propose",
        entry: knowledgeSnippet(entry),
        auditEventId: audit.id,
        idempotency: {
          idempotencyKey: stringParam(params.idempotencyKey) ?? null,
          deterministicEntryId: entry.id,
          processLocalReplayOnly: true
        },
        bodyReturned: false,
        rawRecordJsonReturned: false
      };
    } catch (error) {
      throw toKnowledgeTransportError(error);
    }
  }

  private knowledgeRead(actor: ActorIdentity, params: Record<string, unknown>, replayKey: string): Record<string, unknown> {
    const repository = this.requireKnowledgeRepository();
    const id = requireStringParam(params.id, "id");
    try {
      const existing = repository.requireKnowledgeRetrievalEntry(id);
      if (!actorCanReadKnowledgeEntry(actor, existing)) {
        throw new TransportError("knowledge_role_scope_mismatch", "Knowledge entry read roleScope does not match the trusted actor role");
      }
      const accessed = repository.recordKnowledgeRetrievalAccess(id, new Date().toISOString());
      const audit = this.store.appendAudit(actor, "mcp.transport.aos.knowledge.entry.read", "knowledge", accessed.id, "read", {
        method: "aos.knowledge.entry.read",
        replayKeyDigest: digest(replayKey),
        bodyReturned: true,
        bodyWordCount: countWords(accessed.body),
        sourceRefDigest: sqliteSha256(accessed.sourceRef),
        rawRecordJsonReturned: false
      });
      return {
        ok: true,
        method: "aos.knowledge.entry.read",
        entry: knowledgeDetails(accessed),
        auditEventId: audit.id,
        responseBudget: {
          maxResponseBytes: this.maxResponseBytes,
          bodyBudgetCappedByTransport: true
        },
        rawRecordJsonReturned: false
      };
    } catch (error) {
      throw toKnowledgeTransportError(error);
    }
  }

  private knowledgeSearch(actor: ActorIdentity, params: Record<string, unknown>, replayKey: string): Record<string, unknown> {
    const repository = this.requireKnowledgeRepository();
    const roleScope = stringParam(params.roleScope) ?? actor.role;
    if (roleScope !== actor.role) {
      throw new TransportError("knowledge_role_scope_mismatch", "Knowledge search role_scope must match the trusted actor role");
    }
    try {
      const searchParams: Parameters<AosSqliteRepository["searchKnowledgeRetrievalPage"]>[0] = {
        roleScope,
        includeDraft: booleanParam(params.includeDraft),
        includeStale: booleanParam(params.includeStale)
      };
      const query = stringParam(params.query);
      const project = stringParam(params.project);
      const category = stringParam(params.category);
      if (query !== undefined) searchParams.query = query;
      if (project !== undefined) searchParams.project = project;
      if (category !== undefined) searchParams.category = category;
      if (typeof params.limit === "number") searchParams.limit = params.limit;
      if (typeof params.cursor === "string") searchParams.cursor = params.cursor;
      const page = repository.searchKnowledgeRetrievalPage(searchParams);
      const accessedAt = new Date().toISOString();
      const accessedRows = page.rows.map((entry) => repository.recordKnowledgeRetrievalAccess(entry.id, accessedAt));
      const audit = this.store.appendAudit(actor, "mcp.transport.aos.knowledge.search", "knowledge_search", page.filterDigest, "read", {
        method: "aos.knowledge.search",
        replayKeyDigest: digest(replayKey),
        returnedCount: accessedRows.length,
        filterDigest: page.filterDigest,
        entryIdDigests: accessedRows.map((entry) => digest(entry.id)),
        defaultCanonicalFilterApplied: page.defaultCanonicalFilterApplied,
        defaultFreshnessFilterApplied: page.defaultFreshnessFilterApplied,
        includeDraft: booleanParam(params.includeDraft),
        includeStale: booleanParam(params.includeStale),
        bodyReturned: false,
        rawRecordJsonReturned: false
      });
      return {
        ok: true,
        method: "aos.knowledge.search",
        items: accessedRows.map(knowledgeSnippet),
        page: {
          limit: page.limit,
          returnedCount: page.returnedCount,
          nextCursor: page.nextCursor,
          hasMore: page.hasMore,
          filterDigest: page.filterDigest,
          searchMode: page.searchMode,
          defaultCanonicalFilterApplied: page.defaultCanonicalFilterApplied,
          defaultFreshnessFilterApplied: page.defaultFreshnessFilterApplied
        },
        auditEventId: audit.id,
        bodyReturned: false,
        rawRecordJsonReturned: false
      };
    } catch (error) {
      throw toKnowledgeTransportError(error);
    }
  }

  private requireRuntimeDatabase(): NonNullable<AosMcpTransportConfig["runtimeDatabase"]> {
    if (!this.config.runtimeDatabase) {
      throw new TransportError("backup_runtime_database_required", "Backup methods require a validated runtime database profile");
    }
    return this.config.runtimeDatabase;
  }

  private requireKnowledgeRepository(): AosSqliteRepository {
    if (!this.repository) {
      throw new TransportError("knowledge_runtime_database_required", "Knowledge methods require a validated runtime database profile");
    }
    return this.repository;
  }

  private auditRefusal(method: string, reason: string, params: unknown): void {
    try {
      this.store.appendAudit({ system: "aos-mcp-stdio-transport" }, "mcp.transport.refusal", "mcp_request", method, "blocked", {
        method,
        reason,
        paramSummary: summarizePayloadForAudit(params)
      });
    } catch {
      // Refusal audit must never convert a denial into an allowed transport response.
    }
  }

  private enforceBudget(value: unknown): unknown {
    const bytes = Buffer.byteLength(JSON.stringify(value), "utf8");
    if (bytes <= this.maxResponseBytes) {
      return value;
    }
    throw new TransportError("transport_response_budget_exceeded", `MCP stdio response exceeded ${this.maxResponseBytes} bytes`);
  }

  private cacheBudgetedResult(replayKey: string, value: unknown): unknown {
    const budgeted = this.enforceBudget(value);
    this.replayByKey.set(replayKey, budgeted);
    return budgeted;
  }
}

export function createRuntimeTransport(config: AosMcpRuntimeConfig): RuntimeTransport {
  const databaseReadback = validateRuntimeDatabaseConfig(config);
  const repository = new AosSqliteRepository(compactRepositoryOptions(databaseReadback.databasePath, config.migrationsDir));
  repository.applyMigrations();
  const store = new AosStore(undefined, { persistence: repository });
  const transport = new AosMcpTransport(store, compactTransportConfig(config, databaseReadback), repository);
  return {
    transport,
    close() {
      repository.close();
    }
  };
}

export async function runJsonLineStdioServer(transport: AosMcpTransport, input = processStdin, output = processStdout): Promise<void> {
  const lines = createInterface({ input, terminal: false });
  for await (const line of lines) {
    if (line.trim().length === 0) {
      continue;
    }
    const response = parseAndHandleLine(transport, line);
    output.write(`${JSON.stringify(response)}\n`);
  }
}

function parseAndHandleLine(transport: AosMcpTransport, line: string): JsonRpcResponse {
  try {
    return transport.handleJsonRpc(JSON.parse(line) as JsonRpcRequest);
  } catch (error) {
    return {
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32700,
        message: error instanceof Error ? error.message : "Invalid JSON",
        data: { reason: "invalid_json" }
      }
    };
  }
}

function normalizeGatewayResponse(response: McpResponse): Record<string, unknown> {
  return {
    ok: response.ok,
    method: response.method,
    status: response.status,
    result: response.result,
    error: response.error,
    auditEventId: response.auditEventId,
    idempotencyKey: response.idempotencyKey
  };
}

function compactRepositoryOptions(databasePath: string, migrationsDir: string | undefined): { databasePath: string; migrationsDir?: string } {
  return migrationsDir ? { databasePath, migrationsDir } : { databasePath };
}

function validateRuntimeDatabaseConfig(config: AosMcpRuntimeConfig): { databasePath: string; databaseRoot: string; rootDigest: string } {
  if (!config.databasePath) {
    throw new Error("transport_runtime_database_path_required");
  }
  if (!config.databaseRoot) {
    throw new Error("transport_runtime_database_root_required");
  }
  const databasePath = resolve(config.databasePath);
  const databaseRoot = resolve(config.databaseRoot);
  denyUnsafeRuntimePath(databasePath);
  denyUnsafeRuntimePath(databaseRoot);
  const repoRoot = config.repoRoot ? resolve(config.repoRoot) : process.cwd();
  denyWrongSiblingRuntimePath(databasePath, repoRoot);
  denyWrongSiblingRuntimePath(databaseRoot, repoRoot);
  const markerFile = config.routeOwnedMarkerFile ?? ".tcrn-aos-phase1-root";
  assertExistingPathSegmentsHaveNoSymlink(databaseRoot, "transport_runtime_database_root_symlink_ancestor_denied");
  const rootReadback = assertRouteOwnedSqliteRoot(databaseRoot, repoRoot, markerFile);
  validateRuntimeProfileMarker(databaseRoot, markerFile, config.runtimeProfileMarker);
  const relativeToRoot = relative(databaseRoot, databasePath);
  if (relativeToRoot.startsWith("..") || relativeToRoot === "" || relativeToRoot.split(sep).includes("..")) {
    throw new Error("transport_runtime_database_path_outside_route_owned_root");
  }
  if (dirname(databasePath) !== databaseRoot) {
    throw new Error("transport_runtime_database_nested_path_denied");
  }
  assertExistingPathSegmentsHaveNoSymlink(dirname(databasePath), "transport_runtime_database_path_symlink_ancestor_denied");
  if (existsSync(databasePath) && lstatSync(databasePath).isSymbolicLink()) {
    throw new Error("transport_runtime_database_file_symlink_denied");
  }
  const canonicalRoot = realpathSync(databaseRoot);
  const canonicalDatabaseParent = realpathSync(dirname(databasePath));
  const canonicalDatabasePath = resolve(canonicalDatabaseParent, basename(databasePath));
  const canonicalRelativeToRoot = relative(canonicalRoot, canonicalDatabasePath);
  if (canonicalDatabaseParent !== canonicalRoot || canonicalRelativeToRoot.startsWith("..") || canonicalRelativeToRoot.split(sep).includes("..")) {
    throw new Error("transport_runtime_database_canonical_path_outside_route_owned_root");
  }
  return { databasePath, databaseRoot, rootDigest: rootReadback.rootDigest };
}

function validateRuntimeProfileMarker(
  databaseRoot: string,
  markerFile: string,
  expected: AosMcpRuntimeConfig["runtimeProfileMarker"] | undefined
): void {
  const markerText = readFileSync(resolve(databaseRoot, markerFile), "utf8");
  const parsed = parseMarkerJson(markerText);
  if (!expected) {
    if (parsed && declaresRuntimeProfileMarker(parsed)) {
      throw new Error("transport_runtime_profile_marker_expectation_required");
    }
    return;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("transport_runtime_profile_marker_invalid");
  }
  const marker = parsed as Record<string, unknown>;
  const expectedRootDigest = sqliteSha256(resolve(databaseRoot));
  const purposeMatches = expected.purpose === undefined || marker.purpose === expected.purpose;
  if (
    marker.route !== expected.route ||
    marker.markerVersion !== expected.markerVersion ||
    marker.rootDigest !== expectedRootDigest ||
    !purposeMatches
  ) {
    throw new Error("transport_runtime_profile_marker_stale_or_mismatched");
  }
}

function parseMarkerJson(markerText: string): unknown | null {
  try {
    return JSON.parse(markerText);
  } catch {
    return null;
  }
}

function declaresRuntimeProfileMarker(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const marker = value as Record<string, unknown>;
  return marker.route !== undefined ||
    marker.markerVersion !== undefined ||
    marker.rootDigest !== undefined ||
    marker.purpose !== undefined;
}

function assertExistingPathSegmentsHaveNoSymlink(targetPath: string, reason: string): void {
  const resolvedPath = resolve(targetPath);
  const root = parse(resolvedPath).root;
  const parts = resolvedPath.slice(root.length).split(sep).filter(Boolean);
  let currentPath = root;
  for (const part of parts) {
    currentPath = currentPath === root ? `${root}${part}` : `${currentPath}${sep}${part}`;
    if (!existsSync(currentPath)) {
      return;
    }
    if (lstatSync(currentPath).isSymbolicLink()) {
      throw new Error(reason);
    }
  }
}

function denyUnsafeRuntimePath(path: string): void {
  const home = homedir();
  const normalized = path.split(sep).join("/");
  if (normalized.startsWith("/srv/") || normalized === "/srv") {
    throw new Error("transport_runtime_srv_path_denied");
  }
  if (normalized.includes("/.tcrn") || (home && normalized.startsWith(`${home}/.tcrn`))) {
    throw new Error("transport_runtime_durable_home_path_denied");
  }
  if (/retained|owner-trial|preview/i.test(normalized)) {
    throw new Error("transport_runtime_retained_or_owner_visible_path_denied");
  }
}

function denyWrongSiblingRuntimePath(path: string, repoRoot: string): void {
  const wrongSibling = resolve(dirname(dirname(repoRoot)), "TCRN-AOS");
  const normalized = resolve(path);
  if (normalized === wrongSibling || normalized.startsWith(`${wrongSibling}${sep}`)) {
    throw new Error("transport_runtime_wrong_sibling_path_denied");
  }
}

function compactTransportConfig(config: AosMcpRuntimeConfig, databaseReadback?: { databasePath: string; databaseRoot: string; rootDigest: string }): AosMcpTransportConfig {
  const transportConfig: AosMcpTransportConfig = { trustedActor: config.actor };
  if (config.auditPageLimit !== undefined) {
    transportConfig.auditPageLimit = config.auditPageLimit;
  }
  if (config.maxResponseBytes !== undefined) {
    transportConfig.maxResponseBytes = config.maxResponseBytes;
  }
  if (databaseReadback) {
    transportConfig.runtimeDatabase = compactRuntimeDatabaseConfig(config, databaseReadback);
  }
  return transportConfig;
}

function compactRuntimeDatabaseConfig(
  config: AosMcpRuntimeConfig,
  databaseReadback: { databasePath: string; databaseRoot: string; rootDigest: string }
): NonNullable<AosMcpTransportConfig["runtimeDatabase"]> {
  const runtimeDatabase: NonNullable<AosMcpTransportConfig["runtimeDatabase"]> = {
    databasePath: databaseReadback.databasePath,
    databaseRoot: databaseReadback.databaseRoot,
    rootDigest: databaseReadback.rootDigest,
    backupDir: join(databaseReadback.databaseRoot, "backup"),
    repoRoot: config.repoRoot ? resolve(config.repoRoot) : process.cwd()
  };
  if (config.migrationsDir !== undefined) {
    runtimeDatabase.migrationsDir = config.migrationsDir;
  }
  return runtimeDatabase;
}

function redactAuditEventForTransport(event: AuditEvent): Record<string, unknown> {
  const actorRef = "employeeId" in event.actor ? event.actor.employeeId : event.actor.system;
  return {
    id: event.id,
    actorRef,
    action: event.action,
    targetType: event.targetType,
    targetId: event.targetId,
    timestamp: event.timestamp,
    outcome: event.outcome,
    policyVersion: event.policyVersion,
    details: redactForAudit(event.details)
  };
}

function requireMethod(method: unknown): string {
  if (typeof method !== "string" || method.length === 0) {
    throw new TransportError("missing_method", "Missing JSON-RPC method");
  }
  return method;
}

function normalizeParams(params: unknown): Record<string, unknown> {
  if (params === undefined || params === null) {
    return {};
  }
  if (Array.isArray(params) || typeof params !== "object") {
    throw new TransportError("invalid_params", "MCP stdio params must be an object");
  }
  return params as Record<string, unknown>;
}

function stringParam(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function requireStringParam(value: unknown, field: string): string {
  const stringValue = stringParam(value);
  if (!stringValue) {
    throw new TransportError(`knowledge_${field}_required`, `Missing knowledge field: ${field}`);
  }
  return stringValue;
}

function stringArrayParam(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim().length === 0)) {
    throw new TransportError("knowledge_tags_required", "Knowledge tags must be a non-empty string array");
  }
  return [...new Set(value.map((item) => item.trim()))].sort();
}

function booleanParam(value: unknown): boolean {
  return value === true;
}

function knowledgeStatusParam(value: unknown): KnowledgeRetrievalStatus {
  if (value === "canonical" || value === "draft" || value === "deprecated") {
    return value;
  }
  throw new TransportError("knowledge_status_invalid", "Knowledge status must be canonical, draft, or deprecated");
}

function knowledgeSnippet(entry: KnowledgeRetrievalEntryRecord): Record<string, unknown> {
  const freshness = knowledgeRetrievalFreshness(entry);
  return {
    id: entry.id,
    title: entry.title,
    roleScope: entry.roleScope,
    project: entry.project,
    category: entry.category,
    knowledgeKind: entry.knowledgeKind,
    status: entry.status,
    stale: freshness.stale,
    freshness,
    lastVerified: entry.lastVerified,
    sourceDigest: entry.sourceDigest,
    sourceRefDigest: sqliteSha256(entry.sourceRef),
    tags: entry.tags,
    summary: entry.summary,
    snippet: entry.summary,
    accessCount: entry.accessCount,
    lastAccessed: entry.lastAccessed,
    bodyIncluded: false
  };
}

function knowledgeDetails(entry: KnowledgeRetrievalEntryRecord): Record<string, unknown> {
  return {
    ...knowledgeSnippet(entry),
    body: entry.body,
    bodyIncluded: true
  };
}

function actorCanReadKnowledgeEntry(actor: ActorIdentity, entry: KnowledgeRetrievalEntryRecord): boolean {
  return actor.role === "owner_observer" || actor.role === entry.roleScope;
}

function countWords(value: string): number {
  const trimmed = value.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

function toKnowledgeTransportError(error: unknown): TransportError {
  if (error instanceof TransportError) {
    return error;
  }
  if (error instanceof KnowledgeRetrievalValidationError) {
    return new TransportError(error.reason, error.message);
  }
  if (error instanceof Error && error.message.startsWith("knowledge_retrieval_entry_not_found")) {
    return new TransportError("knowledge_entry_not_found", "Knowledge entry was not found");
  }
  if (error instanceof Error && error.message.startsWith("knowledge_")) {
    return new TransportError(error.message, error.message);
  }
  return new TransportError("knowledge_request_failed", error instanceof Error ? error.message : String(error));
}

function clampLimit(value: unknown, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    return max;
  }
  return Math.min(value, max);
}

function encodeCursor(offset: number): string {
  return Buffer.from(`offset:${offset}`, "utf8").toString("base64url");
}

function parseCursor(value: unknown): number {
  if (value === undefined || value === null) {
    return 0;
  }
  if (typeof value !== "string") {
    throw new TransportError("invalid_cursor", "Cursor must be an opaque string");
  }
  const decoded = Buffer.from(value, "base64url").toString("utf8");
  const match = /^offset:(\d+)$/.exec(decoded);
  if (!match) {
    throw new TransportError("invalid_cursor", "Cursor is not a transport-issued cursor");
  }
  return Number(match[1]);
}

function replayKeyFor(method: string, actorId: string, params: Record<string, unknown>): string {
  const explicit = stringParam(params.idempotencyKey);
  return explicit ?? `${method}:${actorId}:${digest(params)}`;
}

export function isWriteTransportMethod(method: TransportMvpMethod): boolean {
  return !transportReadMethods.includes(method);
}

export function transportRoleCanWrite(role: ActorRole): boolean {
  return canWrite({
    employeeId: "transport-role-probe",
    role,
    threadId: "transport-role-probe",
    sessionId: "transport-role-probe"
  });
}

class TransportError extends Error {
  constructor(readonly reason: string, message: string) {
    super(message);
  }
}
