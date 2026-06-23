import type { CockpitDetailPanel, FreshnessState, OperationsCockpitReadModel, WorkstreamStoryRow } from "./cockpit.js";
import { createAOSWideProductDesignModel } from "./aos-wide-product-design-data.js";
import { createSlice4bCockpitReadModel } from "./cockpit-view.js";

export const initiativeDetailSurfaceId = "initiative-detail";
export const initiativeDetailDsStandardIds = ["ds-aos-target-set-v1", "ds-aos-operations-cockpit-v1"] as const;
export const initiativeDetailStorybookIds = [
  "tcrn-design-system-patterns--aos-product-design-target-set-standard",
  "tcrn-design-system-patterns--aos-operations-cockpit-standard"
] as const;

export const requiredInitiativeDetailSelectors = [
  "[data-surface='initiative-detail']",
  "[data-region='initiative-detail-shell']",
  "[data-region='initiative-detail-nav']",
  "[data-region='initiative-detail-topbar']",
  "[data-region='initiative-detail-summary']",
  "[data-region='initiative-detail-ticket']",
  "[data-region='initiative-detail-links']",
  "[data-region='initiative-detail-activity']",
  "[data-region='initiative-detail-actions']"
] as const;

export const forbiddenInitiativeDetailVisibleCopy = [
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
  "not_claimed"
] as const;

export interface InitiativeDetailLink {
  type: "Gate" | "Evidence" | "Thread" | "History";
  label: string;
  target: string;
  state: string;
}

export interface InitiativeDetailModel {
  context: {
    projectId: string;
    initiativeId: string;
    epicId: string;
    epicTitle: string;
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
  ticket: {
    storyId: string;
    title: string;
    status: WorkstreamStoryRow["status"];
    owner: string;
    thread: string;
    freshness: FreshnessState;
    blocker: string;
    gateCount: number;
    evidenceCount: number;
    threadCount: number;
    historyCount: number;
  };
  links: InitiativeDetailLink[];
  decisions: Array<{ label: string; summary: string; state: string }>;
  activity: Array<{ label: string; summary: string }>;
  serviceOverview: Array<{ label: string; value: string }>;
  unavailableActions: Array<{ label: string; reason: string }>;
}

const fallbackStory: WorkstreamStoryRow = {
  storyId: "story-unavailable",
  title: "Selected ticket",
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
  blocker: "No ticket is available from the local service preview."
};

export function createInitiativeDetailModel(source: OperationsCockpitReadModel = createSlice4bCockpitReadModel()): InitiativeDetailModel {
  const targetSetModel = createAOSWideProductDesignModel();
  const targetSetRow = targetSetModel.surfaces.find((surface) => surface.id === "ticket-drillthrough");
  if (!targetSetRow) {
    throw new Error("initiative_detail_target_set_surface_missing");
  }

  const workstreams = source.workstreams;
  const rows = workstreams.flatMap((group) => group.rows);
  const selectedRow = rows.find((row) => row.storyId === source.detailPanel?.selectedId) ?? rows[0] ?? fallbackStory;
  const selectedWorkstream = workstreams.find((group) => group.rows.some((row) => row.storyId === selectedRow.storyId)) ?? workstreams[0];
  const detail = source.detailPanel?.selectedId === selectedRow.storyId ? source.detailPanel : undefined;
  const gateIds = detail?.linkedGateIds ?? selectedRow.linkedGateIds;
  const evidenceIds = detail?.linkedEvidenceIds ?? selectedRow.linkedEvidenceIds;
  const threadIds = detail?.linkedConferenceIds ?? selectedRow.linkedConferenceIds;
  const historyIds = detail?.auditEventIds ?? selectedRow.linkedAuditEventIds;
  const owner = presentOwnerRole(selectedRow.nextOwnerRole);
  const thread = selectedRow.assignmentEmployeeIds.length > 0
    ? `${selectedRow.assignmentEmployeeIds.length} assigned local role${selectedRow.assignmentEmployeeIds.length === 1 ? "" : "s"}`
    : "Workspace team";

  return {
    context: {
      projectId: source.contextHeader.selectedProjectId,
      initiativeId: source.contextHeader.selectedInitiativeId,
      epicId: selectedWorkstream?.epicId ?? "epic-unavailable",
      epicTitle: selectedWorkstream?.epicTitle ?? "Initiative detail",
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
    ticket: {
      storyId: selectedRow.storyId,
      title: selectedRow.title,
      status: selectedRow.status,
      owner,
      thread,
      freshness: selectedRow.freshness,
      blocker: selectedRow.blocker ?? "No blocker recorded",
      gateCount: gateIds.length,
      evidenceCount: evidenceIds.length,
      threadCount: threadIds.length,
      historyCount: historyIds.length
    },
    links: createLinkRows(gateIds, evidenceIds, threadIds, historyIds),
    decisions: createDecisionRows(selectedRow, detail),
    activity: createActivityRows(selectedRow, detail),
    serviceOverview: [
      { label: "Source", value: "Local service preview" },
      { label: "Schema", value: "aos.cockpit.service_read_model.v1" },
      { label: "Initiative", value: source.contextHeader.selectedInitiativeId },
      { label: "Epic", value: selectedWorkstream?.epicTitle ?? "Initiative detail" },
      { label: "Gate links", value: String(gateIds.length) },
      { label: "Evidence links", value: String(evidenceIds.length) }
    ],
    unavailableActions: [
      { label: "Edit ticket", reason: "Ticket editing is not enabled from this local detail preview." },
      { label: "Request owner action", reason: "Owner actions require separate workspace authority and are not enabled here." },
      { label: "Publish update", reason: "Publishing is not enabled from this local detail preview." },
      { label: "Send live update", reason: "Live updates are not enabled from this local detail preview." }
    ]
  };
}

function createLinkRows(gateIds: string[], evidenceIds: string[], threadIds: string[], historyIds: string[]): InitiativeDetailLink[] {
  const rows: InitiativeDetailLink[] = [
    ...gateIds.map((id, index) => ({ type: "Gate" as const, label: `Gate ${index + 1}`, target: id, state: "Linked" })),
    ...evidenceIds.map((id, index) => ({ type: "Evidence" as const, label: `Evidence ${index + 1}`, target: id, state: "Metadata available" })),
    ...threadIds.map((id, index) => ({ type: "Thread" as const, label: `Thread ${index + 1}`, target: id, state: "Local record" })),
    ...historyIds.map((id, index) => ({ type: "History" as const, label: `History ${index + 1}`, target: id, state: "Local event" }))
  ];
  if (rows.length > 0) return rows;
  return [{ type: "History", label: "History", target: "No linked records", state: "Local preview" }];
}

function createDecisionRows(row: WorkstreamStoryRow, detail: CockpitDetailPanel | undefined): InitiativeDetailModel["decisions"] {
  const blocked = detail?.blockedActions ?? row.blockedActions;
  if (blocked.length > 0) {
    return blocked.map((action, index) => ({
      label: `Decision ${index + 1}`,
      summary: sanitizeProductCopy(action.reason),
      state: "Action disabled"
    }));
  }
  return [
    {
      label: "Decision 1",
      summary: "Mutable ticket actions remain disabled while this detail view runs as a local preview.",
      state: "Local preview"
    }
  ];
}

function createActivityRows(row: WorkstreamStoryRow, detail: CockpitDetailPanel | undefined): InitiativeDetailModel["activity"] {
  return [
    { label: "Ticket note", summary: row.blocker ?? "No blocker recorded" },
    { label: "Linked records", summary: `${row.linkedGateIds.length} gates, ${row.linkedEvidenceIds.length} evidence records, and ${row.linkedConferenceIds.length} thread records.` },
    { label: "History", summary: `${detail?.auditEventIds.length ?? row.linkedAuditEventIds.length} local history event${(detail?.auditEventIds.length ?? row.linkedAuditEventIds.length) === 1 ? "" : "s"} linked.` }
  ];
}

function sanitizeProductCopy(value: string): string {
  return value
    .replace(/\bOwner Intent\b/g, "Owner action")
    .replace(/\broute\b/gi, "workspace path")
    .replace(/\bworkflow\b/gi, "workspace");
}

function presentOwnerRole(role: string): string {
  const normalized = role.trim().toLowerCase();
  if (normalized === "implementation") return "Workspace team";
  if (normalized === "product") return "Product team";
  if (normalized === "design") return "Design team";
  if (normalized === "qa") return "Quality team";
  if (normalized === "verification") return "Quality team";
  return role
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}
