import type {
  AosStore,
  AuditEvent,
  ConferenceRequest,
  DependencyLifecycleRecord,
  EvidenceLink,
  GateWorkOrder,
  InitiativeRecord,
  LocalOperatingLoopAction,
  ProjectRecord,
  ResourceRegistryRecord,
  StageMapItem,
  StoryRecord
} from "../../../packages/domain/src/index.js";

export type CockpitRegionId =
  | "context_header"
  | "stage_map"
  | "workstream_overview"
  | "gate_queue"
  | "conference_visibility"
  | "evidence_readback"
  | "risk_warning"
  | "dependency_resource"
  | "detail_panel";

export type FreshnessState = "current" | "stale" | "unknown" | "blocked";
export type RiskState = "review_required" | "evidence_missing" | "accepted_with_residual_risk" | "blocked" | "not_applicable";

export interface NavigationItem {
  id: CockpitRegionId;
  label: string;
  enabled: boolean;
  productDesignAccepted: false;
}

export interface ContextHeaderReadModel {
  selectedProjectId: string;
  selectedInitiativeId: string;
  localCheckpoint: string;
  dataFreshness: FreshnessState;
  acceptedResiduals: string[];
  nonClaimBadges: string[];
}

export interface WorkstreamStoryRow {
  storyId: string;
  title: string;
  status: StoryRecord["status"];
  blocker?: string | undefined;
  nextOwnerRole: string;
  linkedGateIds: string[];
  linkedConferenceIds: string[];
  linkedEvidenceIds: string[];
  linkedAuditEventIds: string[];
  assignmentEmployeeIds: string[];
  nextAllowedLocalActions: LocalOperatingLoopAction[];
  blockedActions: Array<{ action: LocalOperatingLoopAction; reason: string; ownerRole: string }>;
  freshness: FreshnessState;
}

export interface WorkstreamGroup {
  projectId: string;
  initiativeId: string;
  epicId: string;
  status: string;
  rows: WorkstreamStoryRow[];
}

export interface StageMapReadModel extends StageMapItem {
  label: string;
  freshness: FreshnessState;
  blockers: string[];
  manualReadinessOverrideAllowed: false;
  releaseReadinessClaim: "external_proof_required";
}

export interface GateQueueItem {
  id: string;
  type: GateWorkOrder["type"];
  ownerRole: GateWorkOrder["ownerRole"];
  status: GateWorkOrder["status"];
  linkedTicketId: string;
  linkedEvidenceIds: string[];
  blocker?: string | undefined;
  ownerIntent: boolean;
  autoExecutable: false;
}

export interface ConferenceVisibilityItem {
  id: string;
  title: string;
  initiatorEmployeeId: string;
  participantEmployeeIds: string[];
  inviteDispatchIds: string[];
  missingParticipantEmployeeIds: string[];
  participantPositionIds: string[];
  agenda: string[];
  linkedTicketIds: string[];
  linkedEvidenceIds: string[];
  desiredOutcome: string;
  status: ConferenceRequest["status"];
  minutesStatus: "not_started" | "ready_for_draft" | "recorded" | "blocked";
  decisionClass: "discussion_only" | "recommendation" | "role_decision" | "blocked" | "owner_intent_required";
  liveDispatchAuthorized: false;
  threadRegistryMutationAuthorized: false;
  minutesSummary?: string | undefined;
}

export interface EvidenceReadbackItem {
  id: string;
  type: EvidenceLink["type"];
  target: string;
  validity: EvidenceLink["validity"];
  freshness: FreshnessState;
  redactionState: EvidenceLink["redactionState"];
  digest?: string | undefined;
  rawBodyAvailable: false;
}

export interface RiskWarningItem {
  id: string;
  type: "security" | "license" | "dependency" | "resource" | "proof" | "route" | "release" | "product_design" | "d024";
  state: RiskState;
  ownerRole: string;
  summary: string;
  linkedGateIds: string[];
  linkedEvidenceIds: string[];
}

export interface DependencyInspectionItem {
  id: string;
  packageName: string;
  projectId: string;
  posture: DependencyLifecycleRecord["posture"];
  evidenceStatus: DependencyLifecycleRecord["evidenceStatus"];
  licenseExpression: string;
  sbomNoticeObligation: DependencyLifecycleRecord["sbomNoticeObligation"];
  linkedGateIds: string[];
  cleanClaim: false;
  legalCompletionClaim: false;
}

export interface ResourceInspectionItem {
  id: string;
  title: string;
  type: ResourceRegistryRecord["type"];
  copyrightStatus: ResourceRegistryRecord["copyrightStatus"];
  lifecycleState: ResourceRegistryRecord["lifecycleState"];
  approvalState: ResourceRegistryRecord["approvalState"];
  projectManifestRefs: string[];
  linkedGateIds: string[];
  scannerIngestionClaim: false;
  materializationExecuted: false;
}

export interface CockpitDetailPanel {
  selectedId: string;
  selectedType: "story" | "gate" | "conference" | "evidence" | "dependency" | "resource" | "stage";
  linkedStoryIds: string[];
  linkedGateIds: string[];
  linkedConferenceIds: string[];
  linkedEvidenceIds: string[];
  auditEventIds: string[];
  nextAllowedLocalActions: LocalOperatingLoopAction[];
  blockedActions: Array<{ action: LocalOperatingLoopAction; reason: string; ownerRole: string }>;
  operatingLoopSummary: string;
  noOverclaimSummary: string;
  rawSourceDisplayed: false;
  privateEvidenceDisplayed: false;
}

export interface NoOverclaimState {
  releaseReadinessClaim: "external_proof_required";
  productDesignAcceptance: "not_claimed";
  visualTarget: "visual_target_required_before_acceptance";
  liveCodexDispatch: false;
  deployment: false;
  productAcceptance: false;
  runtimeDataCommittedToGit: false;
}

export interface ProductDesignProofState {
  brief: "accepted";
  visualIdeation: "not_required_before_slice_4_functional_contract_implementation";
  prototype: "not_applicable_to_this_packet";
  browserVisualAcceptance: "not_claimed";
  uxLayoutVisualAcceptance: "not_claimed";
  laterGate: "exactly_three_product_design_visual_options_required_before_visual_target_selection_or_polished_ux_acceptance";
}

export interface OperationsCockpitReadModel {
  contextHeader: ContextHeaderReadModel;
  navigation: NavigationItem[];
  workstreams: WorkstreamGroup[];
  stageMap: StageMapReadModel[];
  roleGateQueue: GateQueueItem[];
  ownerIntentQueue: GateQueueItem[];
  conferences: ConferenceVisibilityItem[];
  evidenceReadbacks: EvidenceReadbackItem[];
  riskWarnings: RiskWarningItem[];
  dependencyInspection: DependencyInspectionItem[];
  resourceInspection: ResourceInspectionItem[];
  detailPanel?: CockpitDetailPanel | undefined;
  nonClaims: NoOverclaimState;
  productDesignStatus: ProductDesignProofState;
}

export interface CockpitServiceReadModelReadback {
  schemaVersion: "aos.cockpit.service_read_model.v1";
  slice: "slice_2_service_read_model_stabilization";
  source: "service_api_read" | "static_fixture";
  surfaces: {
    cockpit: {
      selectedProjectId: string;
      selectedInitiativeId: string;
      localCheckpoint: string;
      dataFreshness: FreshnessState;
      serviceBacked: boolean;
    };
    workIndex: {
      rowCount: number;
      firstStoryId: string;
      selectedStoryId: string;
      linkedGateCount: number;
      linkedConferenceCount: number;
      linkedEvidenceCount: number;
      nextLocalActionCount: number;
      blockedActionCount: number;
    };
    detail: {
      selectedId: string;
      selectedType: CockpitDetailPanel["selectedType"];
      linkedGateCount: number;
      linkedConferenceCount: number;
      linkedEvidenceCount: number;
      auditEventCount: number;
      rawSourceDisplayed: false;
      privateEvidenceDisplayed: false;
    };
    gate: {
      roleGateCount: number;
      ownerIntentGateCount: number;
      autoExecutableCount: number;
      unavailableReason: string;
    };
    readback: {
      evidenceReadbackCount: number;
      riskWarningCount: number;
      dependencyCount: number;
      resourceCount: number;
      productAcceptance: false;
      finalMvpAcceptance: false;
      releaseReadinessClaim: "external_proof_required";
      runtimeDataCommittedToGit: false;
    };
  };
  noClaims: {
    productAcceptance: false;
    finalMvpAcceptance: false;
    releasePublication: false;
    ownerIntentExecution: false;
    liveDispatch: false;
    broadUiReactMigration: false;
  };
}

export const requiredCockpitRegionIds: CockpitRegionId[] = [
  "context_header",
  "stage_map",
  "workstream_overview",
  "gate_queue",
  "conference_visibility",
  "evidence_readback",
  "risk_warning",
  "dependency_resource",
  "detail_panel"
];

export const stageStates = ["not_started", "active", "blocked", "complete", "release_proof_required"] as const;
export const gateStates = ["proposed", "pending_role", "owner_intent_required", "accepted", "blocked", "superseded"] as const;
export const conferenceStates = ["requested", "collecting_positions", "minutes_ready", "blocked", "closed"] as const;
export const freshnessStates = ["current", "stale", "unknown", "blocked"] as const;
export const riskStates = ["review_required", "evidence_missing", "accepted_with_residual_risk", "blocked", "not_applicable"] as const;

export const productDesignProofState: ProductDesignProofState = {
  brief: "accepted",
  visualIdeation: "not_required_before_slice_4_functional_contract_implementation",
  prototype: "not_applicable_to_this_packet",
  browserVisualAcceptance: "not_claimed",
  uxLayoutVisualAcceptance: "not_claimed",
  laterGate: "exactly_three_product_design_visual_options_required_before_visual_target_selection_or_polished_ux_acceptance"
};

export const noOverclaimState: NoOverclaimState = {
  releaseReadinessClaim: "external_proof_required",
  productDesignAcceptance: "not_claimed",
  visualTarget: "visual_target_required_before_acceptance",
  liveCodexDispatch: false,
  deployment: false,
  productAcceptance: false,
  runtimeDataCommittedToGit: false
};

export const initialNavigation = [
  "Projects",
  "Tickets",
  "Employees",
  "Conferences",
  "Stage Map",
  "Approvals/Gates",
  "Knowledge",
  "User Guides",
  "Release Notes",
  "Integrations",
  "Audit"
] as const;

export interface CockpitSnapshot {
  projects: Array<Pick<ProjectRecord, "id" | "name" | "registryStatus" | "status" | "gateState">>;
  gates: Array<Pick<GateWorkOrder, "id" | "type" | "ownerRole" | "status" | "linkedTicketId">>;
  stageMap: StageMapItem[];
  dependencyPosture: Array<Pick<DependencyLifecycleRecord, "id" | "projectId" | "packageName" | "posture" | "evidenceStatus">>;
  resourcePosture: Array<Pick<ResourceRegistryRecord, "id" | "title" | "copyrightStatus" | "approvalState" | "lifecycleState">>;
  audit: Array<Pick<AuditEvent, "id" | "action" | "targetType" | "targetId" | "outcome" | "policyVersion">>;
  releaseReadinessClaim: "external_proof_required";
}

export function createCockpitSnapshot(input: {
  projects: ProjectRecord[];
  gates: GateWorkOrder[];
  stageMap: StageMapItem[];
  dependencies: DependencyLifecycleRecord[];
  resources: ResourceRegistryRecord[];
  audit: AuditEvent[];
}): CockpitSnapshot {
  return {
    projects: input.projects.map(({ id, name, registryStatus, status, gateState }) => ({ id, name, registryStatus, status, gateState })),
    gates: input.gates.map(({ id, type, ownerRole, status, linkedTicketId }) => ({ id, type, ownerRole, status, linkedTicketId })),
    stageMap: input.stageMap,
    dependencyPosture: input.dependencies.map(({ id, projectId, packageName, posture, evidenceStatus }) => ({ id, projectId, packageName, posture, evidenceStatus })),
    resourcePosture: input.resources.map(({ id, title, copyrightStatus, approvalState, lifecycleState }) => ({ id, title, copyrightStatus, approvalState, lifecycleState })),
    audit: input.audit.map(({ id, action, targetType, targetId, outcome, policyVersion }) => ({ id, action, targetType, targetId, outcome, policyVersion })),
    releaseReadinessClaim: "external_proof_required"
  };
}

export function createOperationsCockpitReadModel(input: {
  store: AosStore;
  projectId: string;
  initiativeId: string;
  localCheckpoint: string;
  selectedDetail?: { id: string; type: CockpitDetailPanel["selectedType"] };
}): OperationsCockpitReadModel {
  const project = input.store.getProject(input.projectId);
  if (!project) {
    throw new Error(`Unknown project: ${input.projectId}`);
  }
  const initiatives = input.store.listInitiatives();
  const initiative = initiatives.find((item) => item.id === input.initiativeId);
  if (!initiative || initiative.projectId !== input.projectId) {
    throw new Error(`Unknown initiative for project: ${input.initiativeId}`);
  }
  const stories = input.store.listStories();
  const gates = input.store.listGates();
  const evidence = input.store.listEvidence();
  const dependencies = input.store.listDependencies();
  const resources = input.store.listResources();
  const conferences = input.store.listConferences();
  const audit = input.store.queryAudit();
  const stageMap = input.store.deriveStageMap(input.projectId, input.initiativeId);
  const dataFreshness = deriveAggregateFreshness(evidence, gates);

  return {
    contextHeader: {
      selectedProjectId: project.id,
      selectedInitiativeId: initiative.id,
      localCheckpoint: input.localCheckpoint,
      dataFreshness,
      acceptedResiduals: ["local_functional_contract_only", "product_design_visual_target_pending", "external_release_proof_required"],
      nonClaimBadges: ["no_live_dispatch", "no_deployment", "no_product_acceptance", "no_dependency_clean_claim"]
    },
    navigation: requiredCockpitRegionIds.map((id) => ({
      id,
      label: labelForRegion(id),
      enabled: true,
      productDesignAccepted: false
    })),
    workstreams: createWorkstreams(input.store, initiative, stories, gates),
    stageMap: createStageMapReadModel(stageMap, gates, evidence),
    roleGateQueue: gates.filter((gate) => !isOwnerIntentGate(gate)).map(toGateQueueItem),
    ownerIntentQueue: gates.filter(isOwnerIntentGate).map(toGateQueueItem),
    conferences: conferences.map((conference) => toConferenceVisibilityItem(conference)),
    evidenceReadbacks: evidence.map(toEvidenceReadbackItem),
    riskWarnings: createRiskWarnings(gates, dependencies, resources, evidence),
    dependencyInspection: dependencies.map(toDependencyInspectionItem),
    resourceInspection: resources.map(toResourceInspectionItem),
    detailPanel: input.selectedDetail ? createDetailPanel(input.selectedDetail, input.store, stories, gates, conferences, evidence, dependencies, resources, audit) : undefined,
    nonClaims: noOverclaimState,
    productDesignStatus: productDesignProofState
  };
}

export function createCockpitServiceReadback(
  model: OperationsCockpitReadModel,
  options: { serviceBacked?: boolean } = {}
): CockpitServiceReadModelReadback {
  const workRows = model.workstreams.flatMap((group) => group.rows);
  const firstRow = workRows[0];
  const selectedRow = workRows.find((row) => row.storyId === model.detailPanel?.selectedId) ?? firstRow;
  const detail = model.detailPanel;
  return {
    schemaVersion: "aos.cockpit.service_read_model.v1",
    slice: "slice_2_service_read_model_stabilization",
    source: options.serviceBacked === true ? "service_api_read" : "static_fixture",
    surfaces: {
      cockpit: {
        selectedProjectId: model.contextHeader.selectedProjectId,
        selectedInitiativeId: model.contextHeader.selectedInitiativeId,
        localCheckpoint: model.contextHeader.localCheckpoint,
        dataFreshness: model.contextHeader.dataFreshness,
        serviceBacked: options.serviceBacked === true
      },
      workIndex: {
        rowCount: workRows.length,
        firstStoryId: firstRow?.storyId ?? "",
        selectedStoryId: selectedRow?.storyId ?? detail?.selectedId ?? "",
        linkedGateCount: selectedRow?.linkedGateIds.length ?? detail?.linkedGateIds.length ?? 0,
        linkedConferenceCount: selectedRow?.linkedConferenceIds.length ?? detail?.linkedConferenceIds.length ?? 0,
        linkedEvidenceCount: selectedRow?.linkedEvidenceIds.length ?? detail?.linkedEvidenceIds.length ?? 0,
        nextLocalActionCount: selectedRow?.nextAllowedLocalActions.length ?? detail?.nextAllowedLocalActions.length ?? 0,
        blockedActionCount: selectedRow?.blockedActions.length ?? detail?.blockedActions.length ?? 0
      },
      detail: {
        selectedId: detail?.selectedId ?? selectedRow?.storyId ?? "",
        selectedType: detail?.selectedType ?? "story",
        linkedGateCount: detail?.linkedGateIds.length ?? selectedRow?.linkedGateIds.length ?? 0,
        linkedConferenceCount: detail?.linkedConferenceIds.length ?? selectedRow?.linkedConferenceIds.length ?? 0,
        linkedEvidenceCount: detail?.linkedEvidenceIds.length ?? selectedRow?.linkedEvidenceIds.length ?? 0,
        auditEventCount: detail?.auditEventIds.length ?? selectedRow?.linkedAuditEventIds.length ?? 0,
        rawSourceDisplayed: false,
        privateEvidenceDisplayed: false
      },
      gate: {
        roleGateCount: model.roleGateQueue.length,
        ownerIntentGateCount: model.ownerIntentQueue.length,
        autoExecutableCount: [...model.roleGateQueue, ...model.ownerIntentQueue].filter((gate) => gate.autoExecutable).length,
        unavailableReason: "Gate and deferred route actions remain held; Slice 2 proves service read-model mapping only."
      },
      readback: {
        evidenceReadbackCount: model.evidenceReadbacks.length,
        riskWarningCount: model.riskWarnings.length,
        dependencyCount: model.dependencyInspection.length,
        resourceCount: model.resourceInspection.length,
        productAcceptance: false,
        finalMvpAcceptance: false,
        releaseReadinessClaim: model.nonClaims.releaseReadinessClaim,
        runtimeDataCommittedToGit: false
      }
    },
    noClaims: {
      productAcceptance: false,
      finalMvpAcceptance: false,
      releasePublication: false,
      ownerIntentExecution: false,
      liveDispatch: false,
      broadUiReactMigration: false
    }
  };
}

function createWorkstreams(store: AosStore, initiative: InitiativeRecord, stories: StoryRecord[], gates: GateWorkOrder[]): WorkstreamGroup[] {
  const assignments = store.listAssignments();
  const epics = store.listEpics().filter((epic) => epic.initiativeId === initiative.id);
  return epics.map((epic) => {
    const rows = stories
      .filter((story) => story.epicId === epic.id)
      .map((story) => {
        const storyGates = gates.filter((gate) => story.gateIds.includes(gate.id));
        const drillThrough = store.createWorkIndexDrillThrough(story.id);
        const blockedGate = storyGates.find((gate) => gate.status === "blocked");
        const storyAssignments = assignments.filter((assignment) => story.assignmentIds.includes(assignment.id));
        return {
          storyId: story.id,
          title: story.title,
          status: story.status,
          blocker: blockedGate?.blocker,
          nextOwnerRole: blockedGate?.ownerRole ?? storyAssignments[0]?.role ?? "implementation",
          linkedGateIds: drillThrough.linkedGateIds,
          linkedConferenceIds: drillThrough.linkedConferenceIds,
          linkedEvidenceIds: drillThrough.linkedEvidenceIds,
          linkedAuditEventIds: drillThrough.linkedAuditEventIds,
          assignmentEmployeeIds: storyAssignments.map((assignment) => assignment.employeeId),
          nextAllowedLocalActions: drillThrough.nextAllowedLocalActions,
          blockedActions: drillThrough.blockedActions,
          freshness: story.evidenceIds.length > 0 ? "current" : "unknown"
        } satisfies WorkstreamStoryRow;
      });
    return {
      projectId: initiative.projectId,
      initiativeId: initiative.id,
      epicId: epic.id,
      status: rows.some((row) => row.status === "blocked") ? "blocked" : epic.status,
      rows
    };
  });
}

function createStageMapReadModel(stageMap: StageMapItem[], gates: GateWorkOrder[], evidence: EvidenceLink[]): StageMapReadModel[] {
  return stageMap.map((stage) => {
    const stageGates = gates.filter((gate) => stage.sourceGateIds.includes(gate.id));
    const stageEvidence = evidence.filter((item) => stage.evidenceIds.includes(item.id));
    return {
      ...stage,
      label: stage.stageId,
      freshness: deriveFreshness(stageEvidence),
      blockers: stageGates.filter((gate) => gate.status === "blocked").map((gate) => gate.blocker ?? `${gate.type} blocked`),
      manualReadinessOverrideAllowed: false,
      releaseReadinessClaim: "external_proof_required"
    };
  });
}

function createRiskWarnings(
  gates: GateWorkOrder[],
  dependencies: DependencyLifecycleRecord[],
  resources: ResourceRegistryRecord[],
  evidence: EvidenceLink[]
): RiskWarningItem[] {
  const gateWarnings = gates
    .filter((gate) => gate.status === "blocked" || gate.status === "owner_intent_required")
    .map((gate) => ({
      id: `risk-${gate.id}`,
      type: gate.type === "owner_intent" ? "route" : "proof",
      state: gate.status === "blocked" ? "blocked" : "review_required",
      ownerRole: gate.ownerRole,
      summary: gate.blocker ?? `${gate.type} requires explicit review`,
      linkedGateIds: [gate.id],
      linkedEvidenceIds: gate.inputEvidenceIds
    } satisfies RiskWarningItem));
  const dependencyWarnings = dependencies
    .filter((dependency) => ["review_required", "evidence_missing", "accepted_with_residual_risk", "blocked"].includes(dependency.posture))
    .map((dependency) => ({
      id: `risk-${dependency.id}`,
      type: "dependency",
      state: dependency.posture === "evidence_missing" ? "evidence_missing" : dependency.posture === "blocked" ? "blocked" : dependency.posture === "accepted_with_residual_risk" ? "accepted_with_residual_risk" : "review_required",
      ownerRole: dependency.approvalOwnerRole,
      summary: `${dependency.packageName} posture is ${dependency.posture}`,
      linkedGateIds: dependency.linkedGateIds,
      linkedEvidenceIds: []
    } satisfies RiskWarningItem));
  const resourceWarnings = resources
    .filter((resource) => ["review_required", "accepted_with_residual_risk", "blocked"].includes(resource.approvalState))
    .map((resource) => ({
      id: `risk-${resource.id}`,
      type: "resource",
      state: resource.approvalState === "blocked" ? "blocked" : resource.approvalState === "accepted_with_residual_risk" ? "accepted_with_residual_risk" : "review_required",
      ownerRole: "security",
      summary: `${resource.title} resource approval is ${resource.approvalState}`,
      linkedGateIds: resource.linkedGateIds,
      linkedEvidenceIds: []
    } satisfies RiskWarningItem));
  const evidenceWarnings = evidence
    .filter((item) => item.validity === "broken" || item.validity === "restricted")
    .map((item) => ({
      id: `risk-${item.id}`,
      type: "proof",
      state: "blocked",
      ownerRole: "evidence",
      summary: `${item.type} evidence is ${item.validity}`,
      linkedGateIds: [],
      linkedEvidenceIds: [item.id]
    } satisfies RiskWarningItem));
  return [
    ...gateWarnings,
    ...dependencyWarnings,
    ...resourceWarnings,
    ...evidenceWarnings,
    {
      id: "risk-product-design-visual-target",
      type: "product_design",
      state: "review_required",
      ownerRole: "product_strategy",
      summary: "Product Design brief is accepted, but visual target selection still requires exactly three options before visual acceptance.",
      linkedGateIds: [],
      linkedEvidenceIds: []
    },
    {
      id: "risk-d024-local-first",
      type: "d024",
      state: "not_applicable",
      ownerRole: "architecture",
      summary: "D-024 boundary is preserved: runtime operational data is not committed to Git.",
      linkedGateIds: [],
      linkedEvidenceIds: []
    }
  ];
}

function createDetailPanel(
  selected: { id: string; type: CockpitDetailPanel["selectedType"] },
  store: AosStore,
  stories: StoryRecord[],
  gates: GateWorkOrder[],
  conferences: ConferenceRequest[],
  evidence: EvidenceLink[],
  dependencies: DependencyLifecycleRecord[],
  resources: ResourceRegistryRecord[],
  audit: AuditEvent[]
): CockpitDetailPanel {
  const linkedStoryIds = selected.type === "story" ? [selected.id] : [];
  const drillThrough = selected.type === "story" ? store.createWorkIndexDrillThrough(selected.id) : undefined;
  const linkedGateIds = selected.type === "gate" ? [selected.id] : selected.type === "story"
    ? drillThrough?.linkedGateIds ?? gates.filter((gate) => gate.linkedTicketId === selected.id).map((gate) => gate.id)
    : [];
  const linkedConferenceIds = selected.type === "conference" ? [selected.id] : conferences
    .filter((conference) => conference.linkedTicketIds.includes(selected.id))
    .map((conference) => conference.id);
  const linkedEvidenceIds = selected.type === "evidence" ? [selected.id] : [
    ...stories.filter((story) => story.id === selected.id).flatMap((story) => story.evidenceIds),
    ...gates.filter((gate) => linkedGateIds.includes(gate.id)).flatMap((gate) => gate.inputEvidenceIds),
    ...conferences.filter((conference) => linkedConferenceIds.includes(conference.id)).flatMap((conference) => conference.positions.flatMap((position) => position.evidenceIds)),
    ...dependencies.filter((dependency) => dependency.id === selected.id).flatMap(() => []),
    ...resources.filter((resource) => resource.id === selected.id).flatMap(() => [])
  ];
  return {
    selectedId: selected.id,
    selectedType: selected.type,
    linkedStoryIds,
    linkedGateIds,
    linkedConferenceIds: drillThrough?.linkedConferenceIds ?? linkedConferenceIds,
    linkedEvidenceIds: drillThrough?.linkedEvidenceIds ?? [...new Set(linkedEvidenceIds)],
    auditEventIds: drillThrough?.linkedAuditEventIds ?? audit.filter((event) => event.targetId === selected.id || linkedGateIds.includes(event.targetId)).map((event) => event.id),
    nextAllowedLocalActions: drillThrough?.nextAllowedLocalActions ?? ["open_evidence_metadata"],
    blockedActions: drillThrough?.blockedActions ?? [],
    operatingLoopSummary: drillThrough
      ? `${drillThrough.linkedConferenceIds.length} conference links, ${drillThrough.linkedGateIds.length} gate links, ${drillThrough.nextAllowedLocalActions.length} local actions`
      : "Metadata-only drill-through; no operating-loop mutation.",
    noOverclaimSummary: "Release and live operations remain disabled in this workspace.",
    rawSourceDisplayed: false,
    privateEvidenceDisplayed: false
  };
}

function toGateQueueItem(gate: GateWorkOrder): GateQueueItem {
  return {
    id: gate.id,
    type: gate.type,
    ownerRole: gate.ownerRole,
    status: gate.status,
    linkedTicketId: gate.linkedTicketId,
    linkedEvidenceIds: gate.inputEvidenceIds,
    blocker: gate.blocker,
    ownerIntent: isOwnerIntentGate(gate),
    autoExecutable: false
  };
}

function toConferenceVisibilityItem(conference: ConferenceRequest): ConferenceVisibilityItem {
  const respondingEmployeeIds = new Set(conference.positions.map((position) => position.actor.employeeId));
  const minutesStatus = conference.status === "blocked"
    ? "blocked"
    : conference.minutes
      ? "recorded"
      : conference.positions.length > 0
        ? "ready_for_draft"
        : "not_started";
  return {
    id: conference.id,
    title: conference.title,
    initiatorEmployeeId: conference.initiator.employeeId,
    participantEmployeeIds: conference.participantEmployeeIds,
    inviteDispatchIds: conference.inviteDispatchIds,
    missingParticipantEmployeeIds: conference.participantEmployeeIds.filter((id) => !respondingEmployeeIds.has(id)),
    participantPositionIds: conference.positions.map((position) => position.id),
    agenda: conference.agenda,
    linkedTicketIds: conference.linkedTicketIds,
    linkedEvidenceIds: conference.positions.flatMap((position) => position.evidenceIds),
    desiredOutcome: conference.desiredOutcome,
    status: conference.status,
    minutesStatus,
    decisionClass: conference.minutes?.outcomeClass ?? conference.minutes?.decisions[0]?.decisionClass ?? (conference.status === "blocked" ? "blocked" : "recommendation"),
    liveDispatchAuthorized: false,
    threadRegistryMutationAuthorized: false,
    minutesSummary: conference.minutes?.summary
  };
}

function toEvidenceReadbackItem(evidence: EvidenceLink): EvidenceReadbackItem {
  return {
    id: evidence.id,
    type: evidence.type,
    target: evidence.target,
    validity: evidence.validity,
    freshness: evidence.validity === "valid" ? "current" : evidence.validity === "broken" || evidence.validity === "restricted" ? "blocked" : "unknown",
    redactionState: evidence.redactionState,
    digest: evidence.digest,
    rawBodyAvailable: false
  };
}

function toDependencyInspectionItem(dependency: DependencyLifecycleRecord): DependencyInspectionItem {
  return {
    id: dependency.id,
    packageName: dependency.packageName,
    projectId: dependency.projectId,
    posture: dependency.posture,
    evidenceStatus: dependency.evidenceStatus,
    licenseExpression: dependency.licenseExpression,
    sbomNoticeObligation: dependency.sbomNoticeObligation,
    linkedGateIds: dependency.linkedGateIds,
    cleanClaim: false,
    legalCompletionClaim: false
  };
}

function toResourceInspectionItem(resource: ResourceRegistryRecord): ResourceInspectionItem {
  return {
    id: resource.id,
    title: resource.title,
    type: resource.type,
    copyrightStatus: resource.copyrightStatus,
    lifecycleState: resource.lifecycleState,
    approvalState: resource.approvalState,
    projectManifestRefs: resource.projectManifestRefs,
    linkedGateIds: resource.linkedGateIds,
    scannerIngestionClaim: false,
    materializationExecuted: false
  };
}

function isOwnerIntentGate(gate: GateWorkOrder): boolean {
  return gate.type === "owner_intent" || gate.status === "owner_intent_required";
}

function deriveAggregateFreshness(evidence: EvidenceLink[], gates: GateWorkOrder[]): FreshnessState {
  if (evidence.some((item) => item.validity === "broken" || item.validity === "restricted") || gates.some((gate) => gate.status === "blocked")) {
    return "blocked";
  }
  if (evidence.some((item) => item.validity === "valid")) {
    return "current";
  }
  return evidence.length > 0 ? "unknown" : "stale";
}

function deriveFreshness(evidence: EvidenceLink[]): FreshnessState {
  if (evidence.some((item) => item.validity === "broken" || item.validity === "restricted")) {
    return "blocked";
  }
  if (evidence.some((item) => item.validity === "valid")) {
    return "current";
  }
  return evidence.length > 0 ? "unknown" : "stale";
}

function labelForRegion(id: CockpitRegionId): string {
  return id.split("_").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");
}
