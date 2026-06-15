import {
  AosStore,
  createId,
  idempotencyKey,
  scanForRestrictedContent
} from "../../domain/src/index.js";
import type { ActorIdentity, AIEmployee, AuditEvent } from "../../domain/src/index.js";

export type DispatchKind = "assignment" | "gate_request" | "conference_invite";
export type DispatchStatus = "pending" | "sent" | "failed" | "retrying" | "expired" | "dry_run";
export type ThreadReturnStatus = "success" | "partial" | "blocked" | "changes_requested";

export interface CodexDispatchPayload {
  kind: DispatchKind;
  targetEmployeeId: string;
  linkedTicketIds: string[];
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
  result?: string;
  auditEventId: string;
}

export interface CodexReadback {
  dispatchId: string;
  observedStatus: "queued" | "running" | "completed" | "stale" | "blocked";
  observedAt: string;
  acceptanceInferred: false;
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
    this.assertSafePayload(payload);
    const target = this.requireDispatchableEmployee(payload.targetEmployeeId);
    const key = idempotencyKey("codex.dispatch", actor.employeeId, payload);
    const existing = [...this.outbox.values()].find((record) => record.idempotencyKey === key);
    if (existing) {
      this.store.appendAudit(actor, "codex.dispatch.dedupe", "dispatch", existing.id, "deduped", {
        targetEmployeeId: payload.targetEmployeeId
      });
      return existing;
    }
    const audit = this.store.appendAudit(actor, "codex.dispatch.dry_run", "dispatch", "pending", "accepted", {
      kind: payload.kind,
      targetEmployeeId: payload.targetEmployeeId,
      targetThreadId: target.threadIdentity.threadId
    });
    const record: CodexDispatchRecord = {
      id: createId("dispatch", { payload, actor: actor.employeeId }),
      targetThreadId: target.threadIdentity.threadId,
      targetEmployeeId: payload.targetEmployeeId,
      payload,
      status: "dry_run",
      attempts: 0,
      maxAttempts: this.retryPolicy.maxAttempts,
      idempotencyKey: key,
      createdAt: now(),
      auditEventId: audit.id
    };
    this.outbox.set(record.id, record);
    return record;
  }

  sendLive(): never {
    throw new Error("Live Codex thread dispatch is not authorized in Slice 1");
  }

  readback(dispatchId: string): CodexReadback {
    const record = this.requireDispatch(dispatchId);
    const observedStatus = record.status === "failed" || record.status === "expired" ? "blocked" : "queued";
    return {
      dispatchId,
      observedStatus,
      observedAt: now(),
      acceptanceInferred: false
    };
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
    record.status = parsed.status === "success" ? "sent" : "failed";
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
