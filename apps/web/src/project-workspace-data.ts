import type { FreshnessState, OperationsCockpitReadModel, WorkstreamStoryRow } from "./cockpit.js";
import { createAOSWideProductDesignModel } from "./aos-wide-product-design-data.js";
import { createSlice4bCockpitReadModel } from "./cockpit-view.js";

export const projectWorkspaceSurfaceId = "project-workspace";
export const projectWorkspaceDsStandardIds = ["ds-aos-target-set-v1", "ds-aos-operations-cockpit-v1"] as const;
export const projectWorkspaceStorybookIds = [
  "tcrn-design-system-patterns--aos-product-design-target-set-standard",
  "tcrn-design-system-patterns--aos-operations-cockpit-standard"
] as const;

export const requiredProjectWorkspaceSelectors = [
  "[data-surface='project-workspace']",
  "[data-region='project-workspace-shell']",
  "[data-region='project-workspace-nav']",
  "[data-region='project-workspace-topbar']",
  "[data-region='project-workspace-summary']",
  "[data-region='project-workspace-hierarchy']",
  "[data-region='project-workspace-index']",
  "[data-region='project-workspace-detail']",
  "[data-region='project-workspace-actions']"
] as const;

export const forbiddenProjectWorkspaceVisibleCopy = [
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

export interface ProjectWorkspaceStory {
  id: string;
  title: string;
  status: WorkstreamStoryRow["status"];
  owner: string;
  freshness: FreshnessState;
  blocker: string;
  linkedEvidenceCount: number;
  linkedGateCount: number;
}

export interface ProjectWorkspaceModel {
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
  };
  targetSet: {
    surfaceId: string;
    title: string;
    stage: string;
    state: string;
    detail: string;
  };
  hierarchy: {
    project: string;
    initiative: string;
    epic: string;
    storyCount: number;
    currentStoryCount: number;
    blockedStoryCount: number;
  };
  stageSummary: Array<{
    id: string;
    label: string;
    state: string;
    blockers: string[];
  }>;
  stories: ProjectWorkspaceStory[];
  selectedStory: ProjectWorkspaceStory;
  evidenceOverview: Array<{ label: string; value: string }>;
  unavailableActions: Array<{ label: string; reason: string }>;
}

function mapStory(row: WorkstreamStoryRow): ProjectWorkspaceStory {
  return {
    id: row.storyId,
    title: row.title,
    status: row.status,
    owner: presentOwnerRole(row.nextOwnerRole),
    freshness: row.freshness,
    blocker: row.blocker ?? "No blocker recorded",
    linkedEvidenceCount: row.linkedEvidenceIds.length,
    linkedGateCount: row.linkedGateIds.length
  };
}

function presentOwnerRole(role: string): string {
  const normalized = role.trim().toLowerCase();
  if (normalized === "implementation") return "Workspace team";
  if (normalized === "product") return "Product team";
  if (normalized === "design") return "Design team";
  if (normalized === "qa") return "Quality team";
  return role
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function presentStageLabel(label: string): string {
  const normalized = label.trim().toLowerCase();
  if (normalized === "implementation") return "Build";
  return label
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

export function createProjectWorkspaceModel(source: OperationsCockpitReadModel = createSlice4bCockpitReadModel()): ProjectWorkspaceModel {
  const targetSetModel = createAOSWideProductDesignModel();
  const projectDashboardTarget = targetSetModel.surfaces.find((surface) => surface.id === "project-hierarchy") ?? targetSetModel.surfaces[0];
  if (!projectDashboardTarget) {
    throw new Error("project_workspace_target_set_surface_missing");
  }
  const firstWorkstream = source.workstreams[0];
  const storyRows = source.workstreams.flatMap((group) => group.rows.map(mapStory));
  const selectedStory = storyRows[0] ?? {
    id: "story-unavailable",
    title: "Selected work",
    status: "blocked",
    owner: "Workspace team",
    freshness: "unknown",
    blocker: "No work item is available from the local service preview.",
    linkedEvidenceCount: 0,
    linkedGateCount: 0
  };

  return {
    context: {
      projectId: source.contextHeader.selectedProjectId,
      initiativeId: source.contextHeader.selectedInitiativeId,
      epicId: firstWorkstream?.epicId ?? "epic-unavailable",
      epicTitle: firstWorkstream?.epicTitle ?? "Project workspace",
      sourceSchema: "aos.cockpit.service_read_model.v1",
      sourceMode: "local_service_preview",
      runtimeDataCommitted: false,
      productAcceptance: false,
      finalMvpAcceptance: false,
      releasePublication: false,
      ownerIntentExecution: false,
      liveDispatch: false
    },
    targetSet: {
      surfaceId: projectDashboardTarget.id,
      title: projectDashboardTarget.title,
      stage: projectDashboardTarget.stage,
      state: projectDashboardTarget.state,
      detail: projectDashboardTarget.detail
    },
    hierarchy: {
      project: source.contextHeader.selectedProjectId,
      initiative: source.contextHeader.selectedInitiativeId,
      epic: firstWorkstream?.epicTitle ?? firstWorkstream?.epicId ?? "Project workspace",
      storyCount: storyRows.length,
      currentStoryCount: storyRows.filter((row) => ["accepted", "verified", "released"].includes(row.status)).length,
      blockedStoryCount: storyRows.filter((row) => row.status === "blocked").length
    },
    stageSummary: source.stageMap.map((stage) => ({
      id: stage.stageId,
      label: presentStageLabel(stage.label),
      state: stage.state,
      blockers: stage.blockers
    })),
    stories: storyRows,
    selectedStory,
    evidenceOverview: [
      { label: "Source", value: "Local service preview" },
      { label: "Schema", value: "aos.cockpit.service_read_model.v1" },
      { label: "Runtime data", value: "Local only" },
      { label: "Story rows", value: String(storyRows.length) },
      { label: "Gate links", value: String(storyRows.reduce((sum, row) => sum + row.linkedGateCount, 0)) },
      { label: "Evidence links", value: String(storyRows.reduce((sum, row) => sum + row.linkedEvidenceCount, 0)) }
    ],
    unavailableActions: [
      { label: "Switch project", reason: "Project switching is read-only in this local workspace preview." },
      { label: "Create initiative", reason: "Initiative creation is not enabled from this local workspace preview." },
      { label: "Send owner action", reason: "Owner actions are not enabled from the local workspace preview." },
      { label: "Publish workspace", reason: "Publishing is not enabled from this local workspace preview." }
    ]
  };
}
