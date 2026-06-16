import {
  AosStore,
  createId,
  idempotencyKey,
  scanForRestrictedContent
} from "../../domain/src/index.js";
import type { ActorIdentity, AIEmployee, AuditEvent, SensitiveFinding } from "../../domain/src/index.js";

export type DispatchKind = "assignment" | "gate_request" | "conference_invite";
export type DispatchStatus = "pending" | "dry_run_ready" | "blocked" | "failed" | "retrying" | "expired" | "collected";
export type ThreadReturnStatus = "success" | "partial" | "blocked" | "changes_requested";
export type NoSendTargetThreadState =
  | "active"
  | "active_successor"
  | "predecessor"
  | "replaced_without_successor_confirmation"
  | "stale"
  | "archived"
  | "unknown"
  | "missing"
  | "systemError"
  | "no_return"
  | "conflicting_status"
  | "temporary_lane"
  | "owner_human";
export type ThreadManagementPrimitive =
  | "send_message"
  | "handoff_thread"
  | "create_thread"
  | "fork_thread"
  | "archive_thread"
  | "rename_thread"
  | "pin_thread"
  | "successor_registration";
export type HandoffReturnState = "return_sent" | "partial_return_sent" | "blocked_return_sent" | "return_blocked";
export type TerminalReturnValidationDisposition = "consumable" | "duplicate" | "conflicting" | "non_consumable" | "blocked";

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

export interface NoSendPrimitiveProbe {
  recordSendPrimitiveCall(): void;
  recordThreadManagementPrimitiveCall(action: ThreadManagementPrimitive): void;
  snapshot(): NoSendPrimitiveSnapshot;
}

export interface NoSendPrimitiveSnapshot {
  sendPrimitiveCallCount: number;
  threadManagementPrimitiveCallCount: number;
  threadManagementActions: ThreadManagementPrimitive[];
}

export interface NoSendDispatchInput {
  parentRouteId: string;
  sourceProjectId: "TCRN-AOS";
  initiativeId: "tcrn-aos-product-foundation";
  aosBasisSha: string;
  workflowBasisSha: string;
  targetRole: string;
  targetThreadId?: string;
  targetThreadState: NoSendTargetThreadState;
  successorConfirmed?: boolean;
  temporaryLaneAuthorized?: boolean;
  objective: string;
  executionMode: string;
  readScope: string[];
  writeScope: string[];
  nonAuthorizations: string[];
  requiredReturnFormat: string[];
  ownerIntentFlags: string[];
  returnContractVersion?: string;
  dispatchSchemaVersion?: string;
  replayWindow: string;
  dryRun: true;
  noSend: true;
  requestedLiveSend?: boolean;
  requestedThreadManagementActions?: ThreadManagementPrimitive[];
  auditRedactionProfile: "count_only_route_metadata" | "redacted_route_metadata";
}

export interface NoSendDispatchEnvelope {
  dispatchId: string;
  parentRouteId: string;
  sourceProjectId: "TCRN-AOS";
  initiativeId: "tcrn-aos-product-foundation";
  basisSha: {
    aos: string;
    workflow: string;
  };
  targetRole: string;
  targetThreadId?: string;
  targetThreadState: NoSendTargetThreadState;
  objective: string;
  executionMode: string;
  readScope: string[];
  writeScope: string[];
  nonAuthorizations: string[];
  requiredReturnFormat: string[];
  ownerIntentFlags: string[];
  idempotencyKey: string;
  dedupeKey: string;
  replayWindow: string;
  dryRun: true;
  noSend: true;
  sendPrimitiveCallCount: 0;
  threadManagementPrimitiveCallCount: 0;
  auditRedactionProfile: NoSendDispatchInput["auditRedactionProfile"];
  returnContractVersion: string;
  dispatchSchemaVersion: string;
  auditEventId: string;
}

export interface ExpectedTerminalReturnContext {
  parentRouteId: string;
  dispatchId: string;
  sourceThreadId: string;
  targetThreadId: string;
  coordinatorThreadId: string;
  targetThreadState: NoSendTargetThreadState;
  returnContractVersion?: string;
}

export interface TerminalReturnObservation {
  sourceThreadId?: string;
  targetThreadId?: string;
  coordinatorThreadId?: string;
  parentRouteId?: string;
  dispatchId?: string;
  status?: ThreadReturnStatus;
  summary?: string;
  blockers?: string[];
  nextOwner?: string;
  handoffReturnState?: HandoffReturnState | "return_gap_recovered" | "return_gap_blocked";
  payloadKind: "assistant_terminal" | "commentary_only" | "systemError" | "no_assistant_payload" | "user_only";
  targetThreadState?: NoSendTargetThreadState;
  claims?: Partial<Record<
    | "productAcceptance"
    | "finalMvpAcceptance"
    | "liveDispatch"
    | "deployment"
    | "releasePublication"
    | "push"
    | "ownerIntentExecuted"
    | "registryMutation"
    | "generatedBridgeMutation"
    | "codexSecurityScanCompleted",
    boolean
  >>;
}

export interface ValidatedTerminalReturnReceipt {
  dedupeKey: string;
  status: ThreadReturnStatus;
}

export interface TerminalReturnValidation {
  disposition: TerminalReturnValidationDisposition;
  consumableCandidate: boolean;
  reason: string;
  dedupeKey: string;
  status?: ThreadReturnStatus;
  handoffReturnState?: HandoffReturnState;
  blockerCount: number;
  overclaimCount: number;
  restrictedFindingCount: number;
}

export class CodexIntegrationAdapter {
  private readonly outbox = new Map<string, CodexDispatchRecord>();
  private readonly noSendEnvelopes = new Map<string, NoSendDispatchEnvelope>();

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

  createNoSendDispatchEnvelope(input: NoSendDispatchInput, actor: ActorIdentity, probe: NoSendPrimitiveProbe = createNoSendPrimitiveProbe()): NoSendDispatchEnvelope {
    this.assertNoSendDispatchInput(input, actor);
    const returnContractVersion = input.returnContractVersion ?? "thread-handoff-contract-v2";
    const dispatchSchemaVersion = input.dispatchSchemaVersion ?? "aos-live-dispatch-no-send-v1";
    const identitySeed = noSendDispatchIdentitySeed(input, returnContractVersion, dispatchSchemaVersion);
    const dispatchId = createId("aos_dispatch", identitySeed);
    const existing = this.noSendEnvelopes.get(dispatchId);
    if (existing) {
      this.store.appendAudit(actor, "codex.no_send.dispatch.dedupe", "dispatch", dispatchId, "deduped", {
        targetRole: input.targetRole,
        targetThreadState: input.targetThreadState,
        dryRun: true,
        noSend: true
      });
      return cloneNoSendEnvelope(existing);
    }
    const probeSnapshot = probe.snapshot();
    if (probeSnapshot.sendPrimitiveCallCount !== 0 || probeSnapshot.threadManagementPrimitiveCallCount !== 0) {
      this.store.appendAudit(actor, "codex.no_send.dispatch.blocked", "dispatch", dispatchId, "blocked", {
        reason: "probe_observed_external_primitive",
        sendPrimitiveCallCount: probeSnapshot.sendPrimitiveCallCount,
        threadManagementPrimitiveCallCount: probeSnapshot.threadManagementPrimitiveCallCount
      });
      throw new Error("No-send dispatch blocked because a primitive probe observed external calls");
    }
    const envelopeDraft: Omit<NoSendDispatchEnvelope, "auditEventId"> = {
      dispatchId,
      parentRouteId: input.parentRouteId,
      sourceProjectId: input.sourceProjectId,
      initiativeId: input.initiativeId,
      basisSha: {
        aos: input.aosBasisSha,
        workflow: input.workflowBasisSha
      },
      targetRole: input.targetRole,
      targetThreadState: input.targetThreadState,
      objective: input.objective,
      executionMode: input.executionMode,
      readScope: [...input.readScope],
      writeScope: [...input.writeScope],
      nonAuthorizations: [...input.nonAuthorizations],
      requiredReturnFormat: [...input.requiredReturnFormat],
      ownerIntentFlags: [...input.ownerIntentFlags],
      idempotencyKey: idempotencyKey("codex.no_send.dispatch", actor.employeeId, identitySeed),
      dedupeKey: idempotencyKey("codex.no_send.dispatch.dedupe", actor.employeeId, {
        dispatchId,
        returnContractVersion
      }),
      replayWindow: input.replayWindow,
      dryRun: true as const,
      noSend: true as const,
      sendPrimitiveCallCount: 0 as const,
      threadManagementPrimitiveCallCount: 0 as const,
      auditRedactionProfile: input.auditRedactionProfile,
      returnContractVersion,
      dispatchSchemaVersion,
      ...(input.targetThreadId ? { targetThreadId: input.targetThreadId } : {})
    };
    const audit = this.store.appendAudit(actor, "codex.no_send.dispatch.preview", "dispatch", dispatchId, "accepted", {
      parentRouteId: input.parentRouteId,
      targetRole: input.targetRole,
      targetThreadState: input.targetThreadState,
      dryRun: true,
      noSend: true,
      sendPrimitiveCallCount: 0,
      threadManagementPrimitiveCallCount: 0,
      readScopeCount: input.readScope.length,
      writeScopeCount: input.writeScope.length,
      nonAuthorizationCount: input.nonAuthorizations.length,
      ownerIntentFlagCount: input.ownerIntentFlags.length
    });
    const envelope: NoSendDispatchEnvelope = {
      ...envelopeDraft,
      auditEventId: audit.id
    };
    this.noSendEnvelopes.set(dispatchId, envelope);
    return cloneNoSendEnvelope(envelope);
  }

  listNoSendEnvelopes(): NoSendDispatchEnvelope[] {
    return [...this.noSendEnvelopes.values()].map(cloneNoSendEnvelope);
  }

  validateTerminalReturnObservation(
    expected: ExpectedTerminalReturnContext,
    observation: TerminalReturnObservation,
    history: ValidatedTerminalReturnReceipt[] = []
  ): TerminalReturnValidation {
    const returnContractVersion = expected.returnContractVersion ?? "thread-handoff-contract-v2";
    const dedupeKey = createId("return_dedupe", {
      dispatchId: expected.dispatchId,
      parentRouteId: expected.parentRouteId,
      sourceThreadId: expected.sourceThreadId,
      targetThreadId: expected.targetThreadId,
      returnContractVersion
    });
    const observedStatus = observation.status;
    const observedHandoffReturnState = isTargetHandoffReturnState(observation.handoffReturnState) ? observation.handoffReturnState : undefined;
    const base = {
      blockerCount: observation.blockers?.length ?? 0,
      overclaimCount: countOverclaims(observation.claims),
      restrictedFindingCount: scanNoSendRestrictedContent(observation).length
    };
    const result = (partial: Pick<TerminalReturnValidation, "disposition" | "consumableCandidate" | "reason">): TerminalReturnValidation => {
      return {
        ...partial,
        dedupeKey,
        ...base,
        ...(observedStatus ? { status: observedStatus } : {}),
        ...(observedHandoffReturnState ? { handoffReturnState: observedHandoffReturnState } : {})
      };
    };
    const duplicate = history.find((receipt) => receipt.dedupeKey === dedupeKey);
    if (duplicate) {
      return result({
        disposition: duplicate.status === observation.status ? "duplicate" : "conflicting",
        consumableCandidate: false,
        reason: duplicate.status === observation.status ? "duplicate_terminal_receipt" : "conflicting_terminal_receipt"
      });
    }
    if (base.restrictedFindingCount > 0) {
      return result({ disposition: "blocked", consumableCandidate: false, reason: "restricted_payload" });
    }
    if (observation.payloadKind !== "assistant_terminal") {
      return result({ disposition: "non_consumable", consumableCandidate: false, reason: observation.payloadKind });
    }
    if (observation.parentRouteId !== expected.parentRouteId || observation.dispatchId !== expected.dispatchId) {
      return result({ disposition: "blocked", consumableCandidate: false, reason: "route_or_dispatch_mismatch" });
    }
    if (observation.sourceThreadId !== expected.sourceThreadId || observation.targetThreadId !== expected.targetThreadId || observation.coordinatorThreadId !== expected.coordinatorThreadId) {
      return result({ disposition: "blocked", consumableCandidate: false, reason: "thread_identity_mismatch" });
    }
    if (observation.targetThreadState !== expected.targetThreadState || !targetStateAllowedForNoSend(expected.targetThreadState, true, true)) {
      return result({ disposition: "blocked", consumableCandidate: false, reason: "target_thread_state_not_usable" });
    }
    if (!observation.status || !["success", "partial", "blocked", "changes_requested"].includes(observation.status)) {
      return result({ disposition: "non_consumable", consumableCandidate: false, reason: "unsupported_or_missing_status" });
    }
    if (!isTargetHandoffReturnState(observation.handoffReturnState)) {
      return result({ disposition: "non_consumable", consumableCandidate: false, reason: observation.handoffReturnState?.startsWith("return_gap_") ? "coordinator_recovery_state_not_target_terminal" : "missing_or_invalid_handoff_return_state" });
    }
    if (observation.status === "partial" && !observation.nextOwner && base.blockerCount === 0) {
      return result({ disposition: "non_consumable", consumableCandidate: false, reason: "partial_return_missing_next_owner_or_blocker" });
    }
    if (["blocked", "changes_requested"].includes(observation.status) && (!observation.nextOwner || base.blockerCount === 0)) {
      return result({ disposition: "non_consumable", consumableCandidate: false, reason: "blocking_return_missing_next_owner_or_blocker" });
    }
    if (base.overclaimCount > 0) {
      return result({ disposition: "blocked", consumableCandidate: false, reason: "terminal_return_overclaims_authority" });
    }
    return result({ disposition: "consumable", consumableCandidate: true, reason: "contract_valid_terminal_return" });
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

  private assertNoSendDispatchInput(input: NoSendDispatchInput, actor: ActorIdentity): void {
    const dispatchId = createId("aos_dispatch", noSendDispatchIdentitySeed(input, input.returnContractVersion ?? "thread-handoff-contract-v2", input.dispatchSchemaVersion ?? "aos-live-dispatch-no-send-v1"));
    const restrictedFindings = scanNoSendRestrictedContent(input);
    if (restrictedFindings.length > 0) {
      this.store.appendAudit(actor, "codex.no_send.dispatch.blocked", "dispatch", dispatchId, "blocked", {
        reason: "restricted_payload",
        restrictedFindingCount: restrictedFindings.length,
        restrictedFindingKinds: [...new Set(restrictedFindings.map((finding) => finding.kind))]
      });
      throw new Error(`No-send dispatch rejected restricted ${restrictedFindings[0]!.kind}`);
    }
    if (input.sourceProjectId !== "TCRN-AOS" || input.initiativeId !== "tcrn-aos-product-foundation") {
      this.store.appendAudit(actor, "codex.no_send.dispatch.blocked", "dispatch", dispatchId, "blocked", { reason: "source_or_initiative_mismatch" });
      throw new Error("No-send dispatch requires TCRN-AOS and the AOS product foundation initiative");
    }
    if (input.dryRun !== true || input.noSend !== true) {
      this.store.appendAudit(actor, "codex.no_send.dispatch.blocked", "dispatch", dispatchId, "blocked", { reason: "dry_run_no_send_required" });
      throw new Error("No-send dispatch requires dry_run=true and no_send=true");
    }
    if (input.requestedLiveSend === true) {
      this.store.appendAudit(actor, "codex.no_send.dispatch.blocked", "dispatch", dispatchId, "blocked", { reason: "live_send_requested" });
      throw new Error("No-send dispatch rejects live-send requests");
    }
    if ((input.requestedThreadManagementActions?.length ?? 0) > 0) {
      this.store.appendAudit(actor, "codex.no_send.dispatch.blocked", "dispatch", dispatchId, "blocked", {
        reason: "thread_management_requested",
        threadManagementActionCount: input.requestedThreadManagementActions?.length ?? 0
      });
      throw new Error("No-send dispatch rejects thread-management primitive requests");
    }
    if (!targetStateAllowedForNoSend(input.targetThreadState, input.successorConfirmed === true, input.temporaryLaneAuthorized === true)) {
      this.store.appendAudit(actor, "codex.no_send.dispatch.blocked", "dispatch", dispatchId, "blocked", {
        reason: "target_state_fail_closed",
        targetThreadState: input.targetThreadState
      });
      throw new Error(`No-send dispatch blocked for ${input.targetThreadState} target`);
    }
    if ((input.targetThreadState === "active" || input.targetThreadState === "active_successor") && !input.targetThreadId) {
      this.store.appendAudit(actor, "codex.no_send.dispatch.blocked", "dispatch", dispatchId, "blocked", { reason: "target_thread_id_required" });
      throw new Error("No-send dispatch requires a target thread id for active targets");
    }
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

export function createNoSendPrimitiveProbe(): NoSendPrimitiveProbe {
  let sendPrimitiveCallCount = 0;
  const threadManagementActions: ThreadManagementPrimitive[] = [];
  return {
    recordSendPrimitiveCall() {
      sendPrimitiveCallCount += 1;
    },
    recordThreadManagementPrimitiveCall(action: ThreadManagementPrimitive) {
      threadManagementActions.push(action);
    },
    snapshot() {
      return {
        sendPrimitiveCallCount,
        threadManagementPrimitiveCallCount: threadManagementActions.length,
        threadManagementActions: [...threadManagementActions]
      };
    }
  };
}

function noSendDispatchIdentitySeed(input: NoSendDispatchInput, returnContractVersion: string, dispatchSchemaVersion: string): Record<string, unknown> {
  return {
    parentRouteId: input.parentRouteId,
    initiativeId: input.initiativeId,
    targetRole: input.targetRole,
    targetThreadIdOrRole: input.targetThreadId ?? input.targetRole,
    targetThreadState: input.targetThreadState,
    successorConfirmed: input.successorConfirmed === true,
    temporaryLaneAuthorized: input.temporaryLaneAuthorized === true,
    objective: input.objective,
    aosBasisSha: input.aosBasisSha,
    workflowBasisSha: input.workflowBasisSha,
    dryRun: input.dryRun,
    noSend: input.noSend,
    returnContractVersion,
    dispatchSchemaVersion
  };
}

function targetStateAllowedForNoSend(state: NoSendTargetThreadState, successorConfirmed: boolean, temporaryLaneAuthorized: boolean): boolean {
  if (state === "active") return true;
  if (state === "active_successor") return successorConfirmed;
  if (state === "temporary_lane") return temporaryLaneAuthorized;
  return false;
}

function isTargetHandoffReturnState(value: TerminalReturnObservation["handoffReturnState"]): value is HandoffReturnState {
  return value === "return_sent" || value === "partial_return_sent" || value === "blocked_return_sent" || value === "return_blocked";
}

function countOverclaims(claims: TerminalReturnObservation["claims"]): number {
  return Object.values(claims ?? {}).filter((value) => value === true).length;
}

function scanNoSendRestrictedContent(value: unknown): Array<Pick<SensitiveFinding, "kind" | "path"> | { kind: "raw_scanner_output"; path: string }> {
  const findings: Array<Pick<SensitiveFinding, "kind" | "path"> | { kind: "raw_scanner_output"; path: string }> = scanForRestrictedContent(value).map(({ kind, path }) => ({ kind, path }));
  walkStrings(value, "$", (path, text) => {
    if (/\braw secret scan output\b/i.test(text)) {
      findings.push({ kind: "raw_secret_scan_output", path });
    }
    if (/\b(?:semgrep|snyk|osv-scanner|npm audit|scanner)\b.*\b(?:finding|vulnerability|raw output|detector)\b/i.test(text)) {
      findings.push({ kind: "raw_scanner_output", path });
    }
  });
  return findings;
}

function walkStrings(value: unknown, path: string, visit: (path: string, text: string) => void): void {
  if (typeof value === "string") {
    visit(path, value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkStrings(item, `${path}[${index}]`, visit));
    return;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => walkStrings(item, `${path}.${key}`, visit));
  }
}

function cloneNoSendEnvelope(envelope: NoSendDispatchEnvelope): NoSendDispatchEnvelope {
  return {
    ...envelope,
    basisSha: { ...envelope.basisSha },
    readScope: [...envelope.readScope],
    writeScope: [...envelope.writeScope],
    nonAuthorizations: [...envelope.nonAuthorizations],
    requiredReturnFormat: [...envelope.requiredReturnFormat],
    ownerIntentFlags: [...envelope.ownerIntentFlags]
  };
}
