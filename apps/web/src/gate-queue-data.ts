import type { FreshnessState, GateQueueItem, OperationsCockpitReadModel, WorkstreamStoryRow } from "./cockpit.js";
import { createAOSWideProductDesignModel } from "./aos-wide-product-design-data.js";
import { createSlice4bCockpitReadModel } from "./cockpit-view.js";

export const gateQueueSurfaceId = "gate-queue";
export const gateQueueDsStandardIds = ["ds-aos-target-set-v1", "ds-aos-operations-cockpit-v1"] as const;
export const gateQueueStorybookIds = [
  "tcrn-design-system-patterns--aos-product-design-target-set-standard",
  "tcrn-design-system-patterns--aos-operations-cockpit-standard"
] as const;

export const requiredGateQueueSelectors = [
  "[data-surface='gate-queue']",
  "[data-region='gate-queue-shell']",
  "[data-region='gate-queue-nav']",
  "[data-region='gate-queue-topbar']",
  "[data-region='gate-queue-summary']",
  "[data-region='gate-queue-list']",
  "[data-region='gate-queue-detail']",
  "[data-region='gate-queue-service']",
  "[data-region='gate-queue-actions']"
] as const;

export const forbiddenGateQueueVisibleCopy = [
  "readback",
  "checkpoint",
  "route",
  "slice",
  "implementation",
  "workflow",
  "proof",
  "proof required",
  "external proof required",
  "package-runtime",
  "package runtime",
  "functional contract",
  "held for later",
  "unavailable in this route",
  "not claimed",
  "not_claimed",
  "owner intent",
  "owner_intent_required"
] as const;

export interface GateQueueRecord {
  id: string;
  queueLabel: string;
  gateLabel: string;
  owner: string;
  status: GateQueueItem["status"];
  statusLabel: string;
  linkedStoryId: string;
  linkedStoryTitle: string;
  linkedStoryFreshness: FreshnessState;
  linkedEvidenceCount: number;
  blocker: string;
  modeLabel: string;
}

export interface GateQueueModel {
  context: {
    projectId: string;
    initiativeId: string;
    sourceSchema: "aos.cockpit.service_read_model.v1";
    sourceMode: "local_service_preview";
    runtimeDataCommitted: false;
    productAcceptance: false;
    finalMvpAcceptance: false;
    releasePublication: false;
    ownerIntentExecution: false;
    liveDispatch: false;
    parentGoalCompletion: false;
  };
  targetSet: {
    surfaceId: string;
    title: string;
    stage: string;
    state: string;
    detail: string;
  };
  summary: {
    totalGates: number;
    actionApprovalCount: number;
    roleReviewCount: number;
    blockedCount: number;
    linkedEvidenceCount: number;
  };
  gates: GateQueueRecord[];
  selectedGate: GateQueueRecord;
  serviceOverview: Array<{ label: string; value: string }>;
  unavailableActions: Array<{ label: string; reason: string }>;
}

const fallbackStory: WorkstreamStoryRow = {
  storyId: "story-unavailable",
  title: "Selected work",
  status: "blocked",
  nextOwnerRole: "implementation",
  linkedGateIds: [],
  linkedConferenceIds: [],
  linkedEvidenceIds: [],
  linkedAuditEventIds: [],
  assignmentEmployeeIds: [],
  nextAllowedLocalActions: [],
  blockedActions: [],
  freshness: "unknown",
  blocker: "No linked work item is available from the local service preview."
};

export function createGateQueueModel(source: OperationsCockpitReadModel = createSlice4bCockpitReadModel()): GateQueueModel {
  const targetSetModel = createAOSWideProductDesignModel();
  const targetSetRow = targetSetModel.surfaces.find((surface) => surface.id === "gates-owner-intent");
  if (!targetSetRow) {
    throw new Error("gate_queue_target_set_surface_missing");
  }

  const rows = source.workstreams.flatMap((group) => group.rows);
  const gates = [...source.ownerIntentQueue, ...source.roleGateQueue].map((gate) => mapGate(gate, rows));
  const selectedGate = gates[0] ?? fallbackGateRecord();

  return {
    context: {
      projectId: source.contextHeader.selectedProjectId,
      initiativeId: source.contextHeader.selectedInitiativeId,
      sourceSchema: "aos.cockpit.service_read_model.v1",
      sourceMode: "local_service_preview",
      runtimeDataCommitted: false,
      productAcceptance: false,
      finalMvpAcceptance: false,
      releasePublication: false,
      ownerIntentExecution: false,
      liveDispatch: false,
      parentGoalCompletion: false
    },
    targetSet: {
      surfaceId: targetSetRow.id,
      title: targetSetRow.title,
      stage: targetSetRow.stage,
      state: targetSetRow.state,
      detail: targetSetRow.detail
    },
    summary: {
      totalGates: gates.length,
      actionApprovalCount: gates.filter((gate) => gate.queueLabel === "Action approvals").length,
      roleReviewCount: gates.filter((gate) => gate.queueLabel === "Role reviews").length,
      blockedCount: gates.filter((gate) => gate.status === "blocked" || gate.status === "owner_intent_required").length,
      linkedEvidenceCount: gates.reduce((sum, gate) => sum + gate.linkedEvidenceCount, 0)
    },
    gates,
    selectedGate,
    serviceOverview: [
      { label: "Source", value: "Local service preview" },
      { label: "Schema", value: "aos.cockpit.service_read_model.v1" },
      { label: "Project", value: source.contextHeader.selectedProjectId },
      { label: "Initiative", value: source.contextHeader.selectedInitiativeId },
      { label: "Freshness", value: presentFreshness(source.contextHeader.dataFreshness) },
      { label: "Gate rows", value: String(gates.length) }
    ],
    unavailableActions: [
      { label: "Approve gate", reason: "Approvals require separate workspace authority and are not enabled from this local queue preview." },
      { label: "Request owner action", reason: "Owner actions are not enabled from this local queue preview." },
      { label: "Release gate", reason: "Release actions are not enabled from this local queue preview." },
      { label: "Send live update", reason: "Live updates are not enabled from this local queue preview." }
    ]
  };
}

function mapGate(gate: GateQueueItem, rows: WorkstreamStoryRow[]): GateQueueRecord {
  const linkedStory = rows.find((row) => row.storyId === gate.linkedTicketId) ?? fallbackStory;
  return {
    id: gate.id,
    queueLabel: gate.ownerIntent ? "Action approvals" : "Role reviews",
    gateLabel: presentGateType(gate.type),
    owner: presentOwnerRole(gate.ownerRole),
    status: gate.status,
    statusLabel: presentGateStatus(gate.status),
    linkedStoryId: linkedStory.storyId,
    linkedStoryTitle: linkedStory.title,
    linkedStoryFreshness: linkedStory.freshness,
    linkedEvidenceCount: gate.linkedEvidenceIds.length,
    blocker: sanitizeProductCopy(gate.blocker ?? defaultGateBlocker(gate)),
    modeLabel: gate.ownerIntent ? "Action approval separated" : "Role review pending"
  };
}

function fallbackGateRecord(): GateQueueRecord {
  return {
    id: "gate-unavailable",
    queueLabel: "Action approvals",
    gateLabel: "Action approval gate",
    owner: "Workspace owner",
    status: "blocked",
    statusLabel: "Blocked",
    linkedStoryId: "story-unavailable",
    linkedStoryTitle: "Selected work",
    linkedStoryFreshness: "unknown",
    linkedEvidenceCount: 0,
    blocker: "No gate rows are available from the local service preview.",
    modeLabel: "Action approval separated"
  };
}

function defaultGateBlocker(gate: GateQueueItem): string {
  return gate.ownerIntent
    ? "Owner action remains required before this gate can move."
    : "Role review remains required before this gate can move.";
}

function presentGateType(type: string): string {
  if (type === "owner_intent") return "Action approval gate";
  if (type === "evidence_proof") return "Evidence review gate";
  return type
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function presentGateStatus(status: string): string {
  if (status === "owner_intent_required") return "Action approval required";
  if (status === "pending_role") return "Role review pending";
  if (status === "accepted") return "Accepted locally";
  if (status === "blocked") return "Blocked";
  if (status === "proposed") return "Proposed";
  if (status === "superseded") return "Superseded";
  return status
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function presentOwnerRole(role: string): string {
  const normalized = role.trim().toLowerCase();
  if (normalized === "implementation") return "Workspace team";
  if (normalized === "owner") return "Workspace owner";
  if (normalized === "verification") return "Quality team";
  if (normalized === "security") return "Security review";
  if (normalized === "release") return "Release review";
  if (normalized === "coordinator") return "Coordinator";
  return role
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function presentFreshness(freshness: FreshnessState): string {
  if (freshness === "current") return "Current state";
  if (freshness === "stale") return "Review needed";
  if (freshness === "blocked") return "Blocked";
  return "Unknown";
}

function sanitizeProductCopy(value: string): string {
  return value
    .replace(/\bOwner Intent\b/g, "Owner action")
    .replace(/\bworkflow\b/gi, "workspace")
    .replace(/\broute\b/gi, "workspace path")
    .replace(/\bimplementation\b/gi, "build");
}
