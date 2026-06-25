import { seedEmployees } from "../../../packages/domain/src/seed.js";
import type { AIEmployee } from "../../../packages/domain/src/types.js";
import type { ConferenceVisibilityItem, FreshnessState, OperationsCockpitReadModel, WorkstreamStoryRow } from "./cockpit.js";
import { createAOSWideProductDesignModel } from "./aos-wide-product-design-data.js";
import { createSlice4bCockpitReadModel } from "./cockpit-view.js";

export const aiEmployeeSurfaceId = "ai-employee";
export const aiEmployeeDsStandardIds = ["ds-aos-target-set-v1", "ds-aos-operations-cockpit-v1"] as const;
export const aiEmployeeStorybookIds = [
  "tcrn-design-system-patterns--aos-product-design-target-set-standard",
  "tcrn-design-system-patterns--aos-operations-cockpit-standard"
] as const;

export const requiredAiEmployeeSelectors = [
  "[data-surface='ai-employee']",
  "[data-region='ai-employee-shell']",
  "[data-region='ai-employee-nav']",
  "[data-region='ai-employee-topbar']",
  "[data-region='ai-employee-summary']",
  "[data-region='ai-employee-roster']",
  "[data-region='ai-employee-detail']",
  "[data-region='ai-employee-service']",
  "[data-region='ai-employee-actions']"
] as const;

export const forbiddenAiEmployeeVisibleCopy = [
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

export interface AIEmployeeRow {
  id: string;
  name: string;
  roleLabel: string;
  threadId: string;
  threadStatusLabel: string;
  lifecycleLabel: string;
  authoritySummary: string;
  contactWhen: string;
  linkedStoryIds: string[];
  linkedStoryTitles: string[];
  linkedConferenceIds: string[];
  linkedConferenceTitles: string[];
  assignmentCount: number;
  conferenceCount: number;
  activeWorkState: FreshnessState;
}

export interface AIEmployeeModel {
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
    employeeCount: number;
    activeThreadCount: number;
    assignmentCount: number;
    conferenceCount: number;
    blockedProfileCount: number;
  };
  employees: AIEmployeeRow[];
  selectedEmployee: AIEmployeeRow;
  serviceOverview: Array<{ label: string; value: string }>;
  unavailableActions: Array<{ label: string; reason: string }>;
}

export function createAiEmployeeModel(source: OperationsCockpitReadModel = createSlice4bCockpitReadModel()): AIEmployeeModel {
  const targetSetModel = createAOSWideProductDesignModel();
  const targetSetRow = targetSetModel.surfaces.find((surface) => surface.id === "ai-employee-profile");
  if (!targetSetRow) {
    throw new Error("ai_employee_target_set_surface_missing");
  }

  const rows = source.workstreams.flatMap((group) => group.rows);
  const employees = seedEmployees
    .map((employee) => mapEmployee(employee, rows, source.conferences))
    .sort((left, right) => {
      if (right.assignmentCount !== left.assignmentCount) return right.assignmentCount - left.assignmentCount;
      if (right.conferenceCount !== left.conferenceCount) return right.conferenceCount - left.conferenceCount;
      return left.name.localeCompare(right.name);
    });
  const selectedEmployee = employees[0] ?? fallbackEmployee();

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
      employeeCount: employees.length,
      activeThreadCount: employees.filter((employee) => employee.threadStatusLabel === "Active").length,
      assignmentCount: employees.reduce((sum, employee) => sum + employee.assignmentCount, 0),
      conferenceCount: employees.reduce((sum, employee) => sum + employee.conferenceCount, 0),
      blockedProfileCount: employees.filter((employee) => employee.activeWorkState === "blocked").length
    },
    employees,
    selectedEmployee,
    serviceOverview: [
      { label: "Source", value: "Local service preview" },
      { label: "Schema", value: "aos.cockpit.service_read_model.v1" },
      { label: "Project", value: source.contextHeader.selectedProjectId },
      { label: "Initiative", value: source.contextHeader.selectedInitiativeId },
      { label: "Profiles", value: String(employees.length) },
      { label: "Assignments", value: String(employees.reduce((sum, employee) => sum + employee.assignmentCount, 0)) }
    ],
    unavailableActions: [
      { label: "Open thread", reason: "Thread actions stay read-only in this local employee preview." },
      { label: "Reassign work", reason: "Assignment changes are not enabled from this local employee preview." },
      { label: "Archive profile", reason: "Employee lifecycle changes are not enabled from this local employee preview." },
      { label: "Send live update", reason: "Live updates are not enabled from this local employee preview." }
    ]
  };
}

function mapEmployee(employee: AIEmployee, rows: WorkstreamStoryRow[], conferences: ConferenceVisibilityItem[]): AIEmployeeRow {
  const linkedStories = rows.filter((row) => row.assignmentEmployeeIds.includes(employee.id));
  const linkedConferences = conferences.filter((conference) =>
    conference.initiatorEmployeeId === employee.id || conference.participantEmployeeIds.includes(employee.id)
  );

  return {
    id: employee.id,
    name: employee.name,
    roleLabel: presentRoleLabel(employee.role),
    threadId: employee.threadIdentity.threadId,
    threadStatusLabel: presentThreadStatus(employee.threadIdentity.status),
    lifecycleLabel: presentLifecycle(employee.lifecycle),
    authoritySummary: sanitizeProductCopy(employee.authoritySummary),
    contactWhen: sanitizeProductCopy(employee.contactWhen),
    linkedStoryIds: linkedStories.map((story) => story.storyId),
    linkedStoryTitles: linkedStories.map((story) => sanitizeProductCopy(story.title)),
    linkedConferenceIds: linkedConferences.map((conference) => conference.id),
    linkedConferenceTitles: linkedConferences.map((conference) => sanitizeProductCopy(conference.title)),
    assignmentCount: linkedStories.length,
    conferenceCount: linkedConferences.length,
    activeWorkState: deriveEmployeeState(linkedStories, linkedConferences)
  };
}

function deriveEmployeeState(stories: WorkstreamStoryRow[], conferences: ConferenceVisibilityItem[]): FreshnessState {
  if (stories.some((story) => story.status === "blocked") || conferences.some((conference) => conference.status === "blocked")) {
    return "blocked";
  }
  if (stories.length > 0 || conferences.length > 0) return "current";
  return "unknown";
}

function presentRoleLabel(role: string): string {
  const normalized = role.trim().toLowerCase();
  if (normalized === "implementation") return "Delivery engineer";
  if (normalized === "coordinator") return "Coordinator";
  if (normalized === "security") return "Security reviewer";
  return role
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function presentThreadStatus(status: string): string {
  if (status === "active") return "Active";
  if (status === "replaced") return "Replaced";
  if (status === "archived") return "Archived";
  if (status === "forked") return "Forked";
  return "Unknown";
}

function presentLifecycle(lifecycle: string): string {
  if (lifecycle === "active") return "Active";
  if (lifecycle === "idle") return "Idle";
  if (lifecycle === "blocked") return "Blocked";
  if (lifecycle === "archived") return "Archived";
  return "Unknown";
}

function sanitizeProductCopy(value: string): string {
  return value
    .replace(/\bimplementation\b/gi, "delivery")
    .replace(/\bslice\b/gi, "work")
    .replace(/\broute\b/gi, "coordinate")
    .replace(/\bworkflow\b/gi, "workspace");
}

function fallbackEmployee(): AIEmployeeRow {
  return {
    id: "employee-unavailable",
    name: "AI Employee",
    roleLabel: "Delivery engineer",
    threadId: "thread-unavailable",
    threadStatusLabel: "Unknown",
    lifecycleLabel: "Unknown",
    authoritySummary: "No employee profile is available from the local preview.",
    contactWhen: "No employee profile is available from the local preview.",
    linkedStoryIds: [],
    linkedStoryTitles: [],
    linkedConferenceIds: [],
    linkedConferenceTitles: [],
    assignmentCount: 0,
    conferenceCount: 0,
    activeWorkState: "unknown"
  };
}
