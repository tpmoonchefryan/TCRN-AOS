import { seedEmployees } from "../../../packages/domain/src/seed.js";
import type { ConferenceVisibilityItem, OperationsCockpitReadModel } from "./cockpit.js";
import { createAOSWideProductDesignModel } from "./aos-wide-product-design-data.js";
import { createSlice4bCockpitReadModel } from "./cockpit-view.js";

export const conferenceSurfaceId = "conference";
export const conferenceDsStandardIds = ["ds-aos-target-set-v1", "ds-aos-operations-cockpit-v1"] as const;
export const conferenceStorybookIds = [
  "tcrn-design-system-patterns--aos-product-design-target-set-standard",
  "tcrn-design-system-patterns--aos-operations-cockpit-standard"
] as const;

export const requiredConferenceSelectors = [
  "[data-surface='conference']",
  "[data-region='conference-shell']",
  "[data-region='conference-nav']",
  "[data-region='conference-topbar']",
  "[data-region='conference-summary']",
  "[data-region='conference-list']",
  "[data-region='conference-detail']",
  "[data-region='conference-service']",
  "[data-region='conference-actions']"
] as const;

export const forbiddenConferenceVisibleCopy = [
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

export interface ConferenceRow {
  id: string;
  title: string;
  initiator: string;
  participants: string[];
  missingParticipants: string[];
  linkedStoryIds: string[];
  linkedStoryTitles: string[];
  linkedEvidenceIds: string[];
  status: ConferenceVisibilityItem["status"];
  statusLabel: string;
  minutesStatus: ConferenceVisibilityItem["minutesStatus"];
  minutesStatusLabel: string;
  decisionClassLabel: string;
  desiredOutcome: string;
  agenda: string[];
  inviteDispatchCount: number;
  minutesSummary: string;
}

export interface ConferenceModel {
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
    conferenceCount: number;
    readyForMinutesCount: number;
    missingParticipantCount: number;
    linkedEvidenceCount: number;
  };
  conferences: ConferenceRow[];
  selectedConference: ConferenceRow;
  serviceOverview: Array<{ label: string; value: string }>;
  unavailableActions: Array<{ label: string; reason: string }>;
}

export function createConferenceModel(source: OperationsCockpitReadModel = createSlice4bCockpitReadModel()): ConferenceModel {
  const targetSetModel = createAOSWideProductDesignModel();
  const targetSetRow = targetSetModel.surfaces.find((surface) => surface.id === "conference-minutes");
  if (!targetSetRow) {
    throw new Error("conference_target_set_surface_missing");
  }

  const linkedStories = new Map(source.workstreams.flatMap((group) => group.rows.map((row) => [row.storyId, row.title])));
  const conferences = source.conferences.map((conference) => mapConference(conference, linkedStories));
  const selectedConference = conferences[0] ?? fallbackConference();

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
      conferenceCount: conferences.length,
      readyForMinutesCount: conferences.filter((conference) => conference.minutesStatus === "ready_for_draft" || conference.minutesStatus === "recorded").length,
      missingParticipantCount: conferences.reduce((sum, conference) => sum + conference.missingParticipants.length, 0),
      linkedEvidenceCount: conferences.reduce((sum, conference) => sum + conference.linkedEvidenceIds.length, 0)
    },
    conferences,
    selectedConference,
    serviceOverview: [
      { label: "Source", value: "Local service preview" },
      { label: "Schema", value: "aos.cockpit.service_read_model.v1" },
      { label: "Project", value: source.contextHeader.selectedProjectId },
      { label: "Initiative", value: source.contextHeader.selectedInitiativeId },
      { label: "Conferences", value: String(conferences.length) },
      { label: "Evidence links", value: String(conferences.reduce((sum, conference) => sum + conference.linkedEvidenceIds.length, 0)) }
    ],
    unavailableActions: [
      { label: "Send invite", reason: "Live invite sending is not enabled from this local conference preview." },
      { label: "Record position", reason: "Participant updates are not enabled from this local conference preview." },
      { label: "Record minutes", reason: "Minutes updates are not enabled from this local conference preview." },
      { label: "Send live update", reason: "Live updates are not enabled from this local conference preview." }
    ]
  };
}

function mapConference(conference: ConferenceVisibilityItem, linkedStories: Map<string, string>): ConferenceRow {
  return {
    id: conference.id,
    title: sanitizeProductCopy(conference.title),
    initiator: presentEmployee(conference.initiatorEmployeeId),
    participants: conference.participantEmployeeIds.map(presentEmployee),
    missingParticipants: conference.missingParticipantEmployeeIds.map(presentEmployee),
    linkedStoryIds: conference.linkedTicketIds,
    linkedStoryTitles: conference.linkedTicketIds.map((id) => sanitizeProductCopy(linkedStories.get(id) ?? id)),
    linkedEvidenceIds: conference.linkedEvidenceIds,
    status: conference.status,
    statusLabel: presentConferenceStatus(conference.status),
    minutesStatus: conference.minutesStatus,
    minutesStatusLabel: presentMinutesStatus(conference.minutesStatus),
    decisionClassLabel: presentDecisionClass(conference.decisionClass),
    desiredOutcome: sanitizeProductCopy(conference.desiredOutcome),
    agenda: conference.agenda.map(sanitizeProductCopy),
    inviteDispatchCount: conference.inviteDispatchIds.length,
    minutesSummary: sanitizeProductCopy(conference.minutesSummary ?? "Minutes stay in draft-ready local preview until a reviewed note is recorded.")
  };
}

function presentEmployee(employeeId: string): string {
  return seedEmployees.find((employee) => employee.id === employeeId)?.name ?? employeeId;
}

function presentConferenceStatus(status: string): string {
  if (status === "requested") return "Requested";
  if (status === "collecting_positions") return "Collecting positions";
  if (status === "blocked") return "Blocked";
  if (status === "closed") return "Closed locally";
  return "Unknown";
}

function presentMinutesStatus(status: string): string {
  if (status === "ready_for_draft") return "Ready for draft";
  if (status === "recorded") return "Recorded locally";
  if (status === "blocked") return "Blocked";
  if (status === "not_started") return "Not started";
  return "Unknown";
}

function presentDecisionClass(value: string): string {
  if (value === "discussion_only") return "Discussion only";
  if (value === "recommendation") return "Recommendation";
  if (value === "role_decision") return "Role decision";
  if (value === "blocked") return "Blocked";
  return "Action approval review";
}

function sanitizeProductCopy(value: string): string {
  return value
    .replace(/\bslice\b/gi, "work")
    .replace(/\bimplementation\b/gi, "delivery")
    .replace(/\bproof\b/gi, "review")
    .replace(/\bworkflow\b/gi, "workspace")
    .replace(/\broute\b/gi, "coordination path")
    .replace(/\bowner intent\b/gi, "owner action");
}

function fallbackConference(): ConferenceRow {
  return {
    id: "conference-unavailable",
    title: "Conference",
    initiator: "Coordinator",
    participants: [],
    missingParticipants: [],
    linkedStoryIds: [],
    linkedStoryTitles: [],
    linkedEvidenceIds: [],
    status: "blocked",
    statusLabel: "Blocked",
    minutesStatus: "not_started",
    minutesStatusLabel: "Not started",
    decisionClassLabel: "Recommendation",
    desiredOutcome: "No conference record is available from the local preview.",
    agenda: ["No conference record is available from the local preview."],
    inviteDispatchCount: 0,
    minutesSummary: "No conference record is available from the local preview."
  };
}
