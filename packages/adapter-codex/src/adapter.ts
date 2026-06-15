import {
  AosStore,
  createId,
  idempotencyKey,
  scanForRestrictedContent
} from "../../domain/src/index.js";
import type { ActorIdentity, AIEmployee, AuditEvent } from "../../domain/src/index.js";

export type DispatchKind = "assignment" | "gate_request" | "conference_invite";
export type DispatchStatus = "pending" | "dry_run_ready" | "blocked" | "failed" | "retrying" | "expired" | "collected";
export type ThreadReturnStatus = "success" | "partial" | "blocked" | "changes_requested";

export interface CodexDispatchPayload {
  kind: DispatchKind;
  targetEmployeeId: string;
  linkedTicketIds: string[];
  linkedAssignmentId?: string;
  linkedGateId?: string;
  linkedConferenceId?: string;
  subject: string;
  body: string;
  expectedReturnFormat: string;
}

export interface CodexDispatchRecord {
  id: string;
  targetThreadId: string;
  targetEmployeeId: string;
  payload: CodexDispatchPayload;
  status: DispatchStatus;
  attempts: number;
  maxAttempts: number;
  idempotencyKey: string;
  createdAt: string;
  lastAttemptAt?: string;
  staleAt?: string;
  result?: string;
  auditEventId: string;
}

export interface CodexReadback {
  dispatchId: string;
  observedStatus: "queued" | "running" | "completed" | "stale" | "blocked";
  observedAt: string;
  acceptanceInferred: false;
  targetThreadId: string;
  targetEmployeeId: string;
  retryable: boolean;
}

export interface ParsedThreadReturn {
  status: ThreadReturnStatus;
  summary: string;
  blockers: string[];
  nextOwner?: string;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffSeconds: number[];
}

export class CodexIntegrationAdapter {
  private readonly outbox = new Map<string, CodexDispatchRecord>();

  constructor(
    private readonly store: AosStore,
    private readonly retryPolicy: RetryPolicy = { maxAttempts: 3, backoffSeconds: [5, 30, 120] }
  ) {}

  createDryRunDispatch(payload: CodexDispatchPayload, actor: ActorIdentity): CodexDispatchRecord {
    const key = idempotencyKey("codex.dispatch", actor.employeeId, payload);
    const existing = [...this.outbox.values()].find((record) => record.idempotencyKey === key);
    if (existing) {
      this.store.appendAudit(actor, "codex.dispatch.dedupe", "dispatch", existing.id, "deduped", {
        targetEmployeeId: payload.targetEmployeeId
      });
      return existing;
    }
    const id = createId("dispatch", { payload, actor: actor.employeeId });
    const target = this.validateDispatchRequest(payload, actor, id);
    const audit = this.store.appendAudit(actor, "codex.dispatch.dry_run", "dispatch", "pending", "accepted", {
      kind: payload.kind,
      targetEmployeeId: payload.targetEmployeeId,
      targetThreadId: target.threadIdentity.threadId
    });
    const record: CodexDispatchRecord = {
      id,
      targetThreadId: target.threadIdentity.threadId,
      targetEmployeeId: payload.targetEmployeeId,
      payload,
      status: "dry_run_ready",
      attempts: 0,
      maxAttempts: this.retryPolicy.maxAttempts,
      idempotencyKey: key,
      createdAt: now(),
      auditEventId: audit.id
    };
    this.outbox.set(record.id, record);
    try {
      if (payload.kind === "conference_invite" && payload.linkedConferenceId) {
        this.store.linkConferenceDispatch(payload.linkedConferenceId, record.id, actor);
      }
    } catch (error) {
      this.outbox.delete(record.id);
      throw error;
    }
    return record;
  }

  sendLive(): never {
    throw new Error("Live Codex thread dispatch is not authorized in local AOS MVP slices");
  }

  readback(dispatchId: string, actor?: ActorIdentity): CodexReadback {
    const record = this.requireDispatch(dispatchId);
    const observedStatus = record.status === "failed" || record.status === "expired" || record.status === "blocked"
      ? "blocked"
      : record.staleAt
        ? "stale"
      : record.status === "collected"
        ? "completed"
        : record.status === "retrying"
          ? "running"
          : "queued";
    if (actor) {
      this.store.appendAudit(actor, "codex.dispatch.readback", "dispatch", dispatchId, "read", {
        observedStatus,
        targetEmployeeId: record.targetEmployeeId
      });
    }
    const readback: CodexReadback = {
      dispatchId,
      observedStatus,
      observedAt: now(),
      acceptanceInferred: false,
      targetThreadId: record.targetThreadId,
      targetEmployeeId: record.targetEmployeeId,
      retryable: ["dry_run_ready", "retrying", "failed"].includes(record.status)
    };
    return readback;
  }

  parseThreadReturn(text: string): ParsedThreadReturn {
    this.assertSafePayload({ text });
    const status = extractTag(text, "status") as ThreadReturnStatus | undefined;
    if (!status || !["success", "partial", "blocked", "changes_requested"].includes(status)) {
      throw new Error("Thread return missing supported status");
    }
    const parsed: ParsedThreadReturn = {
      status,
      summary: extractTag(text, "summary") ?? "",
      blockers: extractAllTags(text, "blocker")
    };
    const nextOwner = extractTag(text, "next_owner");
    if (nextOwner) {
      parsed.nextOwner = nextOwner;
    }
    return parsed;
  }

  collectReturn(dispatchId: string, text: string, actor: ActorIdentity): ParsedThreadReturn {
    const record = this.requireDispatch(dispatchId);
    const parsed = this.parseThreadReturn(text);
    record.result = parsed.status;
    record.status = "collected";
    this.applyReturnSideEffects(record, parsed, actor);
    this.store.appendAudit(actor, "codex.return.collect", "dispatch", dispatchId, "accepted", {
      status: parsed.status,
      blockerCount: parsed.blockers.length
    });
    return parsed;
  }

  markRetry(dispatchId: string, actor: ActorIdentity): CodexDispatchRecord {
    const record = this.requireDispatch(dispatchId);
    if (record.attempts >= record.maxAttempts) {
      record.status = "expired";
      this.store.appendAudit(actor, "codex.dispatch.expire", "dispatch", dispatchId, "blocked", {
        attempts: record.attempts
      });
      return record;
    }
    record.status = "retrying";
    record.attempts += 1;
    record.lastAttemptAt = now();
    this.store.appendAudit(actor, "codex.dispatch.retry", "dispatch", dispatchId, "accepted", {
      attempts: record.attempts,
      nextBackoffSeconds: this.retryPolicy.backoffSeconds[Math.min(record.attempts - 1, this.retryPolicy.backoffSeconds.length - 1)]
    });
    return record;
  }

  markStale(dispatchId: string, actor: ActorIdentity): CodexDispatchRecord {
    const record = this.requireDispatch(dispatchId);
    record.staleAt = now();
    this.store.appendAudit(actor, "codex.dispatch.stale", "dispatch", dispatchId, "blocked", {
      targetEmployeeId: record.targetEmployeeId
    });
    return record;
  }

  listOutbox(): CodexDispatchRecord[] {
    return [...this.outbox.values()].map((record) => ({ ...record, payload: { ...record.payload } }));
  }

  private requireDispatch(dispatchId: string): CodexDispatchRecord {
    const record = this.outbox.get(dispatchId);
    if (!record) {
      throw new Error(`Unknown dispatch: ${dispatchId}`);
    }
    return record;
  }

  private validateDispatchRequest(payload: CodexDispatchPayload, actor: ActorIdentity, dispatchId: string): AIEmployee {
    try {
      this.assertSafePayload(payload);
      return this.requireDispatchableEmployee(payload.targetEmployeeId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.store.appendAudit(actor, "codex.dispatch.blocked", "dispatch", dispatchId, "blocked", {
        targetEmployeeId: payload.targetEmployeeId,
        reason: message,
        payload
      });
      throw error;
    }
  }

  private requireDispatchableEmployee(employeeId: string): AIEmployee {
    const employee = this.store.getEmployee(employeeId);
    if (!employee) {
      throw new Error(`Unknown employee: ${employeeId}`);
    }
    if (employee.threadIdentity.status !== "active") {
      throw new Error(`Refusing dispatch to ${employee.threadIdentity.status} thread`);
    }
    return employee;
  }

  private assertSafePayload(payload: unknown): void {
    const findings = scanForRestrictedContent(payload);
    if (findings.length > 0) {
      const first = findings[0]!;
      throw new Error(`Codex adapter rejected restricted ${first.kind} at ${first.path}`);
    }
  }

  private applyReturnSideEffects(record: CodexDispatchRecord, parsed: ParsedThreadReturn, actor: ActorIdentity): void {
    const summary = parsed.summary || parsed.status;
    if (record.payload.linkedAssignmentId) {
      this.store.recordAgentRun({
        assignmentId: record.payload.linkedAssignmentId,
        status: parsed.status === "changes_requested" ? "partial" : parsed.status,
        startedAt: record.createdAt,
        endedAt: now(),
        readback: parsed.status,
        outputSummary: summary
      }, actor);
    }
    if (record.payload.linkedGateId) {
      const gateStatus = parsed.status === "success" ? "accepted" : parsed.status === "partial" ? "pending_role" : "blocked";
      this.store.updateGateStatus(record.payload.linkedGateId, gateStatus, actor, parsed.blockers[0]);
    }
    if (record.payload.linkedConferenceId) {
      const conferenceStatus = parsed.status === "success" ? "closed" : parsed.status === "partial" ? "minutes_ready" : "blocked";
      this.store.updateConferenceStatus(record.payload.linkedConferenceId, conferenceStatus, actor);
    }
  }
}

function extractTag(text: string, tag: string): string | undefined {
  const match = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`).exec(text);
  return match?.[1]?.trim();
}

function extractAllTags(text: string, tag: string): string[] {
  return [...text.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "g"))].map((match) => match[1]?.trim() ?? "");
}

function now(): string {
  return new Date().toISOString();
}

export function createCodexAdapter(store: AosStore): CodexIntegrationAdapter {
  return new CodexIntegrationAdapter(store);
}
