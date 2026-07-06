import { digest, redactForAudit, type AosStore, type AuditEvent, type TicketListParams } from "../../../packages/domain/src/index.js";

const WORK_READBACK_SURFACE = "work.readback";
const DEFAULT_RESPONSE_BUDGET_BYTES = 16_384;
const AUDIT_PAGE_LIMIT = 5;
const TICKET_READBACK_METHODS = ["aos.ticket.list", "aos.audit.query"] as const;

const noOverclaimFlags = {
  serviceProofOnly: true,
  runtimeDataCommitted: false,
  liveDispatchAuthorized: false,
  ownerIntentExecutionAuthorized: false,
  productAcceptanceClaimed: false,
  finalMvpAcceptanceClaimed: false,
  releasePublicationPushClaimed: false,
  durableRuntimeDbActivation: false,
  dogfoodRuntimeReadinessClaimed: false,
  ownerFacingHandoffClaimed: false
};

const commonEnvelope = {
  surface: WORK_READBACK_SURFACE,
  serviceProofOnly: true,
  runtimeDataCommitted: false,
  liveDispatchAuthorized: false,
  ownerIntentExecutionAuthorized: false,
  productAcceptanceClaimed: false,
  finalMvpAcceptanceClaimed: false,
  releasePublicationPushClaimed: false,
  noOverclaimFlags
};

const ticketQueryKeys = new Set([
  "initiativeId",
  "epicId",
  "storyId",
  "status",
  "assigneeEmployeeId",
  "limit",
  "cursor"
]);

const auditQueryKeys = new Set([
  "targetId",
  "action",
  "actorEmployeeId",
  "limit",
  "cursor"
]);

const forbiddenClientAuthorityKeys = new Set([
  "actor",
  "employeeid",
  "role",
  "threadid",
  "sessionid",
  "clientenv",
  "auth",
  "authorization",
  "bearer",
  "token",
  "cookie",
  "apikey",
  "api_key",
  "api-token",
  "api_token",
  "idempotencykey"
]);

export interface WorkReadbackApiResult {
  statusCode: number;
  body: Record<string, unknown>;
}

export interface WorkReadbackApiOptions {
  responseBudgetBytes?: number;
}

export function createWorkReadbackApiResponse(
  store: AosStore,
  path: string,
  query: URLSearchParams,
  options: WorkReadbackApiOptions = {}
): WorkReadbackApiResult {
  try {
    if (path === "/api/work/readback/tickets") {
      return enforceResponseBudget({
        statusCode: 200,
        body: {
          ...commonEnvelope,
          ...store.listTickets(ticketParamsFromQuery(query))
        }
      }, options.responseBudgetBytes);
    }
    if (path === "/api/work/readback/audit") {
      return enforceResponseBudget({
        statusCode: 200,
        body: {
          ...commonEnvelope,
          ...auditReadbackFromQuery(store, query)
        }
      }, options.responseBudgetBytes);
    }
    if (path === "/api/work/readback/policy") {
      rejectForbiddenClientAuthority(query);
      rejectUnsupportedQueryKeys(query, new Set<string>());
      return enforceResponseBudget({
        statusCode: 200,
        body: {
          ...commonEnvelope,
          ok: true,
          method: "aos.policy.read",
          readbackMethods: TICKET_READBACK_METHODS,
          optionalPolicyRead: true,
          fullGatewayMethodListExposed: false,
          responseBudgetBytes: options.responseBudgetBytes ?? DEFAULT_RESPONSE_BUDGET_BYTES
        }
      }, options.responseBudgetBytes);
    }
    return errorResponse(404, "not_found");
  } catch (error) {
    return normalizeWorkReadbackError(error);
  }
}

function ticketParamsFromQuery(query: URLSearchParams): TicketListParams {
  rejectForbiddenClientAuthority(query);
  rejectUnsupportedQueryKeys(query, ticketQueryKeys);
  const params: TicketListParams = {};
  for (const key of ["initiativeId", "epicId", "storyId", "status", "assigneeEmployeeId", "cursor"] as const) {
    const value = singleQueryValue(query, key);
    if (value !== undefined) {
      params[key] = value as never;
    }
  }
  const limit = singleQueryValue(query, "limit");
  if (limit !== undefined) {
    params.limit = parsePositiveInteger(limit, "invalid_ticket_list_limit");
  } else {
    params.limit = 10;
  }
  return params;
}

function auditReadbackFromQuery(store: AosStore, query: URLSearchParams): Record<string, unknown> {
  rejectForbiddenClientAuthority(query);
  rejectUnsupportedQueryKeys(query, auditQueryKeys);
  const targetId = singleQueryValue(query, "targetId");
  if (!targetId) {
    throw new WorkReadbackError("audit_scope_required");
  }
  const limit = parseAuditLimit(singleQueryValue(query, "limit"));
  const offset = parseAuditCursor(singleQueryValue(query, "cursor"));
  const filter: Partial<{ targetId: string; action: string; actorEmployeeId: string }> = { targetId };
  const action = singleQueryValue(query, "action");
  const actorEmployeeId = singleQueryValue(query, "actorEmployeeId");
  if (action) {
    filter.action = action;
  }
  if (actorEmployeeId) {
    filter.actorEmployeeId = actorEmployeeId;
  }
  const events = store.queryAudit(filter)
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp) || left.id.localeCompare(right.id));
  const page = events.slice(offset, offset + limit);
  const nextOffset = offset + page.length;
  return {
    ok: true,
    method: "aos.audit.query",
    items: page.map(redactAuditEventForBrowser),
    limit,
    returnedCount: page.length,
    nextCursor: nextOffset < events.length ? encodeAuditCursor(nextOffset) : null,
    hasMore: nextOffset < events.length
  };
}

function rejectForbiddenClientAuthority(query: URLSearchParams): void {
  const forbidden = [...query.keys()]
    .filter((key) => forbiddenClientAuthorityKeys.has(key.toLowerCase()))
    .sort((left, right) => left.localeCompare(right));
  if (forbidden.length > 0) {
    throw new WorkReadbackError("client_authority_denied", { forbiddenKeys: forbidden });
  }
}

function rejectUnsupportedQueryKeys(query: URLSearchParams, allowed: Set<string>): void {
  const unsupported = [...query.keys()]
    .filter((key) => !allowed.has(key))
    .sort((left, right) => left.localeCompare(right));
  if (unsupported.length > 0) {
    throw new WorkReadbackError("unsupported_filter", { unsupportedKeys: unsupported });
  }
}

function singleQueryValue(query: URLSearchParams, key: string): string | undefined {
  const values = query.getAll(key);
  if (values.length === 0) {
    return undefined;
  }
  if (values.length > 1 || values[0] === "") {
    throw new WorkReadbackError("unsupported_filter", { unsupportedKeys: [key] });
  }
  return values[0];
}

function parsePositiveInteger(value: string, reason: string): number {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new WorkReadbackError(reason);
  }
  return Number(value);
}

function parseAuditLimit(value: string | undefined): number {
  if (value === undefined) {
    return AUDIT_PAGE_LIMIT;
  }
  const parsed = parsePositiveInteger(value, "invalid_audit_limit");
  if (parsed > AUDIT_PAGE_LIMIT) {
    throw new WorkReadbackError("audit_limit_exceeded");
  }
  return parsed;
}

function encodeAuditCursor(offset: number): string {
  return Buffer.from(`offset:${offset}`, "utf8").toString("base64url");
}

function parseAuditCursor(value: string | undefined): number {
  if (value === undefined) {
    return 0;
  }
  let decoded = "";
  try {
    decoded = Buffer.from(value, "base64url").toString("utf8");
  } catch {
    throw new WorkReadbackError("invalid_audit_cursor");
  }
  const match = /^offset:(\d+)$/.exec(decoded);
  if (!match) {
    throw new WorkReadbackError("invalid_audit_cursor");
  }
  return Number(match[1]);
}

function redactAuditEventForBrowser(event: AuditEvent): Record<string, unknown> {
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

function enforceResponseBudget(result: WorkReadbackApiResult, budget = DEFAULT_RESPONSE_BUDGET_BYTES): WorkReadbackApiResult {
  const bytes = Buffer.byteLength(JSON.stringify(result.body), "utf8");
  if (bytes <= budget) {
    return result;
  }
  return errorResponse(413, "readback_response_budget_exceeded", { responseBudgetBytes: budget });
}

function normalizeWorkReadbackError(error: unknown): WorkReadbackApiResult {
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof WorkReadbackError) {
    return errorResponse(400, error.reason, error.details);
  }
  if (message.startsWith("unsupported_ticket_list_filter:")) {
    return errorResponse(400, "unsupported_filter", { sourceReason: message });
  }
  if (
    message === "invalid_ticket_list_cursor" ||
    message === "ticket_list_cursor_filter_mismatch" ||
    message === "invalid_ticket_list_limit" ||
    message === "ticket_list_limit_exceeded" ||
    message.startsWith("invalid_ticket_list_filter:")
  ) {
    return errorResponse(400, message.includes(":") ? message.split(":")[0]! : message);
  }
  return errorResponse(500, "work_readback_failed", { sourceDigest: digest({ message }) });
}

function errorResponse(statusCode: number, reason: string, details: Record<string, unknown> = {}): WorkReadbackApiResult {
  return {
    statusCode,
    body: {
      ...commonEnvelope,
      ok: false,
      reason,
      error: reason,
      ...details
    }
  };
}

class WorkReadbackError extends Error {
  constructor(readonly reason: string, readonly details: Record<string, unknown> = {}) {
    super(reason);
  }
}
