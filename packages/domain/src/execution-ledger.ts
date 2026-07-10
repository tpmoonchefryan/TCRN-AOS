import { digest, stableStringify } from "./idempotency.js";
import { assertNoRestrictedContent } from "./security.js";
import { AosStore } from "./store.js";
import type { ActorIdentity, EpicRecord, InitiativeRecord, StoryRecord, WorkStatus } from "./types.js";

export const EXECUTION_LEDGER_SCHEMA_VERSION = "tcrn.aos.executionLedger.v1" as const;

export type ExecutionLedgerTargetType = "initiative" | "epic" | "story";
export type ExecutionLedgerEventType =
  | "route_sent"
  | "first_output"
  | "interrupted"
  | "recovery_started"
  | "blocked_owner_decision"
  | "in_review"
  | "verified"
  | "terminal_consumed";

export interface ExecutionLedgerOwnerMarker {
  profileId: string;
  routeId: string;
  runContext: string;
  owner: string;
}

export interface ExecutionLedgerEventInput {
  type: ExecutionLedgerEventType;
  eventKey: string;
  occurredAt: string;
  sourceEvidenceDigest: string;
}

export interface ExecutionLedgerCommand {
  schemaVersion: typeof EXECUTION_LEDGER_SCHEMA_VERSION;
  projectId: string;
  routeId: string;
  targetType: ExecutionLedgerTargetType;
  targetId: string;
  expectedStatus: WorkStatus;
  nextStatus: WorkStatus;
  actor: ActorIdentity;
  events: ExecutionLedgerEventInput[];
}

export interface ExecutionLedgerReadback {
  ok: true;
  schemaVersion: typeof EXECUTION_LEDGER_SCHEMA_VERSION;
  projectId: string;
  targetType: ExecutionLedgerTargetType;
  targetId: string;
  routeId: string;
  status: {
    before: WorkStatus;
    after: WorkStatus;
    transitionApplied: boolean;
    replayed: boolean;
  };
  eventReadbacks: Array<{
    eventType: ExecutionLedgerEventType;
    eventKey: string;
    auditEventId: string;
    commentId: string;
    replayed: boolean;
  }>;
  counts: {
    auditEventsForTarget: number;
    commentsForTarget: number;
  };
  ownerMarkerDigest: string;
}

export function deriveExecutionLedgerEventKey(input: {
  projectId: string;
  targetType: ExecutionLedgerTargetType;
  targetId: string;
  routeId: string;
  eventType: ExecutionLedgerEventType;
  sourceEvidenceDigest: string;
}): string {
  return `execution_ledger_${digest(input).slice(0, 20)}`;
}

export class ExecutionLedgerValidationError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "ExecutionLedgerValidationError";
  }
}

const eventTypes = new Set<ExecutionLedgerEventType>([
  "route_sent",
  "first_output",
  "interrupted",
  "recovery_started",
  "blocked_owner_decision",
  "in_review",
  "verified",
  "terminal_consumed"
]);

const permittedTransitions: Record<WorkStatus, WorkStatus[]> = {
  proposed: ["accepted", "in_progress", "blocked", "superseded", "archived"],
  accepted: ["in_progress", "blocked", "superseded", "archived"],
  in_progress: ["blocked", "in_review", "verified", "superseded", "archived"],
  blocked: ["proposed", "accepted", "in_progress", "superseded", "archived"],
  in_review: ["in_progress", "blocked", "verified", "superseded", "archived"],
  verified: ["released", "superseded", "archived"],
  released: ["archived"],
  archived: [],
  superseded: []
};

type ResolvedTarget =
  | { kind: "initiative"; record: InitiativeRecord; projectId: string; commentStoryId: string }
  | { kind: "epic"; record: EpicRecord; projectId: string; commentStoryId: string }
  | { kind: "story"; record: StoryRecord; projectId: string; commentStoryId: string };

export function applyExecutionLedgerCommand(
  store: AosStore,
  command: ExecutionLedgerCommand,
  ownerMarker: ExecutionLedgerOwnerMarker
): ExecutionLedgerReadback {
  validateCommand(command, ownerMarker);
  const target = resolveTarget(store, command.targetType, command.targetId);
  if (target.projectId !== command.projectId) {
    fail("execution_ledger_cross_project_target");
  }
  const employee = store.getEmployee(command.actor.employeeId);
  if (!employee || employee.role !== command.actor.role) {
    fail("execution_ledger_actor_untrusted");
  }

  const ownerMarkerDigest = digest(ownerMarker);
  const events = command.events.map((event) => inspectEvent(store, target, command, ownerMarkerDigest, event));
  const before = target.record.status;
  const replayed = events.every((event) => event.audit && event.comment) && before === command.nextStatus;
  if (!replayed) {
    if (before !== command.expectedStatus) {
      fail("execution_ledger_expected_status_stale");
    }
    if (!permittedTransitions[before].includes(command.nextStatus)) {
      fail("execution_ledger_transition_invalid");
    }
    persistStatus(store, target, command.nextStatus, command.actor);
  }

  const eventReadbacks = events.map((event) => {
    const audit = event.audit ?? store.appendAudit(
      command.actor,
      `execution_ledger.${event.input.type}`,
      command.targetType,
      command.targetId,
      "accepted",
      event.auditDetails
    );
    const comment = event.comment ?? store.addComment({
      ticketId: target.commentStoryId,
      type: "agent_observation",
      actor: command.actor,
      body: event.commentBody
    }, command.actor);
    return {
      eventType: event.input.type,
      eventKey: event.input.eventKey,
      auditEventId: audit.id,
      commentId: comment.id,
      replayed: Boolean(event.audit && event.comment)
    };
  });

  const after = resolveTarget(store, command.targetType, command.targetId);
  const commentStory = store.listStories().find((story) => story.id === after.commentStoryId);
  return {
    ok: true,
    schemaVersion: EXECUTION_LEDGER_SCHEMA_VERSION,
    projectId: command.projectId,
    targetType: command.targetType,
    targetId: command.targetId,
    routeId: command.routeId,
    status: {
      before,
      after: after.record.status,
      transitionApplied: !replayed,
      replayed
    },
    eventReadbacks,
    counts: {
      auditEventsForTarget: store.queryAudit({ targetId: command.targetId }).length,
      commentsForTarget: commentStory?.comments.length ?? 0
    },
    ownerMarkerDigest
  };
}

function validateCommand(command: ExecutionLedgerCommand, ownerMarker: ExecutionLedgerOwnerMarker): void {
  assertNoRestrictedContent(command, "execution ledger command");
  if (command.schemaVersion !== EXECUTION_LEDGER_SCHEMA_VERSION) {
    fail("execution_ledger_schema_invalid");
  }
  requireText(command.projectId, "project_invalid");
  requireText(command.routeId, "route_invalid");
  requireText(command.targetId, "target_invalid");
  if (!(["initiative", "epic", "story"] as string[]).includes(command.targetType)) {
    fail("execution_ledger_target_type_invalid");
  }
  if (!isStatus(command.expectedStatus) || !isStatus(command.nextStatus)) {
    fail("execution_ledger_status_invalid");
  }
  if (!command.actor?.employeeId || !command.actor.role || !command.actor.threadId || !command.actor.sessionId) {
    fail("execution_ledger_actor_invalid");
  }
  if (!ownerMarker.profileId || !ownerMarker.runContext || !ownerMarker.owner) {
    fail("execution_ledger_owner_marker_invalid");
  }
  if (ownerMarker.routeId !== command.routeId) {
    fail("execution_ledger_owner_marker_route_mismatch");
  }
  if (!Array.isArray(command.events) || command.events.length === 0) {
    fail("execution_ledger_events_required");
  }
  const eventKeys = new Set<string>();
  for (const event of command.events) {
    if (!eventTypes.has(event.type)) {
      fail("execution_ledger_event_type_invalid");
    }
    requireText(event.eventKey, "event_key_invalid");
    requireText(event.occurredAt, "occurred_at_invalid");
    if (!/^\d{4}-\d{2}-\d{2}T/.test(event.occurredAt) || Number.isNaN(Date.parse(event.occurredAt))) {
      fail("execution_ledger_occurred_at_invalid");
    }
    if (!/^[a-f0-9]{64}$/i.test(event.sourceEvidenceDigest)) {
      fail("execution_ledger_source_evidence_digest_invalid");
    }
    if (event.eventKey !== deriveExecutionLedgerEventKey({
      projectId: command.projectId,
      targetType: command.targetType,
      targetId: command.targetId,
      routeId: command.routeId,
      eventType: event.type,
      sourceEvidenceDigest: event.sourceEvidenceDigest
    })) {
      fail("execution_ledger_event_key_not_deterministic");
    }
    if (eventKeys.has(event.eventKey)) {
      fail("execution_ledger_duplicate_event_key");
    }
    eventKeys.add(event.eventKey);
  }
}

function resolveTarget(store: AosStore, type: ExecutionLedgerTargetType, id: string): ResolvedTarget {
  if (type === "initiative") {
    const record = store.listInitiatives().find((item) => item.id === id);
    if (!record) fail("execution_ledger_target_unknown");
    if (!record.storyIds[0]) fail("execution_ledger_comment_target_missing");
    return { kind: "initiative", record, projectId: record.projectId, commentStoryId: record.storyIds[0] };
  }
  if (type === "epic") {
    const record = store.listEpics().find((item) => item.id === id);
    if (!record) fail("execution_ledger_target_unknown");
    const initiative = store.listInitiatives().find((item) => item.id === record.initiativeId);
    if (!initiative) fail("execution_ledger_parent_unknown");
    if (!record.storyIds[0]) fail("execution_ledger_comment_target_missing");
    return { kind: "epic", record, projectId: initiative.projectId, commentStoryId: record.storyIds[0] };
  }
  const record = store.listStories().find((item) => item.id === id);
  if (!record) fail("execution_ledger_target_unknown");
  const epic = store.listEpics().find((item) => item.id === record.epicId);
  const initiative = epic ? store.listInitiatives().find((item) => item.id === epic.initiativeId) : undefined;
  if (!initiative) fail("execution_ledger_parent_unknown");
  return { kind: "story", record, projectId: initiative.projectId, commentStoryId: record.id };
}

function persistStatus(store: AosStore, target: ResolvedTarget, status: WorkStatus, actor: ActorIdentity): void {
  if (target.kind === "initiative") {
    const { epicIds, storyIds, gateIds, evidenceIds, decisionHistory, ...input } = target.record;
    store.upsertInitiative({ ...input, status }, actor);
    return;
  }
  if (target.kind === "epic") {
    const { storyIds, gateIds, evidenceIds, ...input } = target.record;
    store.upsertEpic({ ...input, status }, actor);
    return;
  }
  const { comments, links, gateIds, assignmentIds, evidenceIds, decisionHistory, ...input } = target.record;
  store.upsertStory({ ...input, status }, actor);
}

function inspectEvent(
  store: AosStore,
  target: ResolvedTarget,
  command: ExecutionLedgerCommand,
  ownerMarkerDigest: string,
  input: ExecutionLedgerEventInput
): {
  input: ExecutionLedgerEventInput;
  audit: ReturnType<AosStore["queryAudit"]>[number] | undefined;
  comment: StoryRecord["comments"][number] | undefined;
  auditDetails: Record<string, unknown>;
  commentBody: string;
} {
  const payload = {
    schemaVersion: EXECUTION_LEDGER_SCHEMA_VERSION,
    projectId: command.projectId,
    targetType: command.targetType,
    targetId: command.targetId,
    routeId: command.routeId,
    eventType: input.type,
    eventKey: input.eventKey,
    actor: command.actor,
    ownerMarkerDigest,
    occurredAt: input.occurredAt,
    sourceEvidenceDigest: input.sourceEvidenceDigest
  };
  const payloadDigest = digest(payload);
  const auditDetails = { ...payload, payloadDigest };
  const commentBody = stableStringify({ ...payload, payloadDigest });
  const audit = store.queryAudit({ targetId: command.targetId }).find((item) =>
    item.action === `execution_ledger.${input.type}` && item.details.eventKey === input.eventKey
  );
  if (audit && audit.details.payloadDigest !== payloadDigest) {
    fail("execution_ledger_event_key_conflict");
  }
  const commentStory = store.listStories().find((story) => story.id === target.commentStoryId);
  const comment = commentStory?.comments.find((item) => {
    try {
      const parsed = JSON.parse(item.body) as { eventKey?: string; payloadDigest?: string };
      if (parsed.eventKey !== input.eventKey) return false;
      if (parsed.payloadDigest !== payloadDigest) fail("execution_ledger_event_key_conflict");
      return true;
    } catch (error) {
      if (error instanceof ExecutionLedgerValidationError) throw error;
      return false;
    }
  });
  return { input, audit, comment, auditDetails, commentBody };
}

function isStatus(value: unknown): value is WorkStatus {
  return typeof value === "string" && Object.hasOwn(permittedTransitions, value);
}

function requireText(value: unknown, reason: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(`execution_ledger_${reason}`);
  }
}

function fail(code: string): never {
  throw new ExecutionLedgerValidationError(code);
}
