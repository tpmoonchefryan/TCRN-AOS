import { assertNoRestrictedContent, redactForAudit } from "./security.js";
import { createId } from "./idempotency.js";
import { POLICY_VERSION, resolveGateOwner } from "./policies.js";
import type {
  AIEmployee,
  ActorIdentity,
  AgentRun,
  Assignment,
  AuditEvent,
  ConferenceMinutes,
  ConferencePosition,
  ConferenceRequest,
  DependencyDetectionFinding,
  DependencyGovernanceIndexReadback,
  DependencyLifecycleRecord,
  DocumentationActionBlock,
  EpicRecord,
  EvidenceLink,
  GateWorkOrder,
  InitiativeRecord,
  KnowledgeEntry,
  LocalConferenceOperatingLoop,
  OwnerIntent,
  ProjectId,
  ProjectDocumentationIndexReadback,
  ProjectRecord,
  ProjectResourceManifestRecord,
  ReleaseNoteRecord,
  ResourceAuditFinding,
  ResourceGovernanceIndexReadback,
  ResourceMaterializationRequest,
  ResourceRegistryRecord,
  StageDefinition,
  StageMapItem,
  StoryRecord,
  StructuredComment,
  SubTask,
  UserGuidePageDraft,
  WorkIndexDrillThrough
} from "./types.js";

export interface AosSeed {
  projects: ProjectRecord[];
  employees: AIEmployee[];
  stageDefinitions: StageDefinition[];
}

export class AosStore {
  private projects = new Map<ProjectId, ProjectRecord>();
  private initiatives = new Map<string, InitiativeRecord>();
  private epics = new Map<string, EpicRecord>();
  private stories = new Map<string, StoryRecord>();
  private employees = new Map<string, AIEmployee>();
  private assignments = new Map<string, Assignment>();
  private runs = new Map<string, AgentRun>();
  private gates = new Map<string, GateWorkOrder>();
  private evidence = new Map<string, EvidenceLink>();
  private conferences = new Map<string, ConferenceRequest>();
  private dependencies = new Map<string, DependencyLifecycleRecord>();
  private dependencyFindings = new Map<string, DependencyDetectionFinding>();
  private resources = new Map<string, ResourceRegistryRecord>();
  private materializationRequests = new Map<string, ResourceMaterializationRequest>();
  private resourceManifests = new Map<string, ProjectResourceManifestRecord>();
  private resourceFindings = new Map<string, ResourceAuditFinding>();
  private knowledge = new Map<string, KnowledgeEntry>();
  private userGuideDrafts = new Map<string, UserGuidePageDraft>();
  private releaseNotes = new Map<string, ReleaseNoteRecord>();
  private ownerIntents = new Map<string, OwnerIntent>();
  private stageDefinitions = new Map<string, StageDefinition>();
  private auditEvents: AuditEvent[] = [];

  constructor(seed?: AosSeed) {
    seed?.projects.forEach((project) => this.projects.set(project.id, project));
    seed?.employees.forEach((employee) => this.employees.set(employee.id, employee));
    seed?.stageDefinitions.forEach((stage) => this.stageDefinitions.set(stage.id, stage));
  }

  getEmployee(employeeId: string): AIEmployee | undefined {
    return this.employees.get(employeeId);
  }

  listProjects(): ProjectRecord[] {
    return [...this.projects.values()];
  }

  listEmployees(): AIEmployee[] {
    return [...this.employees.values()];
  }

  listInitiatives(): InitiativeRecord[] {
    return [...this.initiatives.values()];
  }

  listEpics(): EpicRecord[] {
    return [...this.epics.values()];
  }

  listStories(): StoryRecord[] {
    return [...this.stories.values()];
  }

  listAssignments(): Assignment[] {
    return [...this.assignments.values()];
  }

  listRuns(): AgentRun[] {
    return [...this.runs.values()];
  }

  listGates(): GateWorkOrder[] {
    return [...this.gates.values()];
  }

  listEvidence(): EvidenceLink[] {
    return [...this.evidence.values()];
  }

  listConferences(): ConferenceRequest[] {
    return [...this.conferences.values()];
  }

  listDependencies(): DependencyLifecycleRecord[] {
    return [...this.dependencies.values()];
  }

  listDependencyFindings(): DependencyDetectionFinding[] {
    return [...this.dependencyFindings.values()];
  }

  listResources(): ResourceRegistryRecord[] {
    return [...this.resources.values()];
  }

  listMaterializationRequests(): ResourceMaterializationRequest[] {
    return [...this.materializationRequests.values()];
  }

  listResourceManifests(): ProjectResourceManifestRecord[] {
    return [...this.resourceManifests.values()];
  }

  listResourceFindings(): ResourceAuditFinding[] {
    return [...this.resourceFindings.values()];
  }

  listKnowledge(): KnowledgeEntry[] {
    return [...this.knowledge.values()];
  }

  listUserGuideDrafts(): UserGuidePageDraft[] {
    return [...this.userGuideDrafts.values()];
  }

  listReleaseNotes(): ReleaseNoteRecord[] {
    return [...this.releaseNotes.values()];
  }

  getProject(projectId: ProjectId): ProjectRecord | undefined {
    return this.projects.get(projectId);
  }

  upsertProject(project: ProjectRecord, actor: ActorIdentity): ProjectRecord {
    this.ensureSafe(project, "project");
    this.projects.set(project.id, project);
    this.appendAudit(actor, "project.upsert", "project", project.id, "accepted", { status: project.status });
    return project;
  }

  createInitiative(input: Omit<InitiativeRecord, "id" | "epicIds" | "storyIds" | "gateIds" | "evidenceIds" | "decisionHistory">, actor: ActorIdentity): InitiativeRecord {
    this.ensureSafe(input, "initiative");
    const initiative: InitiativeRecord = {
      ...input,
      id: createId("init", input),
      epicIds: [],
      storyIds: [],
      gateIds: [],
      evidenceIds: [],
      decisionHistory: []
    };
    this.initiatives.set(initiative.id, initiative);
    this.appendAudit(actor, "initiative.create", "initiative", initiative.id, "accepted", { projectId: initiative.projectId });
    return initiative;
  }

  createEpic(input: Omit<EpicRecord, "id" | "storyIds" | "gateIds" | "evidenceIds">, actor: ActorIdentity): EpicRecord {
    this.ensureSafe(input, "epic");
    const epic: EpicRecord = {
      ...input,
      id: createId("epic", input),
      storyIds: [],
      gateIds: [],
      evidenceIds: []
    };
    this.epics.set(epic.id, epic);
    const initiative = this.initiatives.get(epic.initiativeId);
    initiative?.epicIds.push(epic.id);
    this.appendAudit(actor, "epic.create", "epic", epic.id, "accepted", { initiativeId: epic.initiativeId });
    return epic;
  }

  createStory(input: Omit<StoryRecord, "id" | "comments" | "links" | "gateIds" | "assignmentIds" | "evidenceIds" | "decisionHistory">, actor: ActorIdentity): StoryRecord {
    this.ensureSafe(input, "story");
    const story: StoryRecord = {
      ...input,
      id: createId("story", input),
      comments: [],
      links: [],
      gateIds: [],
      assignmentIds: [],
      evidenceIds: [],
      decisionHistory: []
    };
    this.stories.set(story.id, story);
    const epic = this.epics.get(story.epicId);
    epic?.storyIds.push(story.id);
    const initiative = epic ? this.initiatives.get(epic.initiativeId) : undefined;
    initiative?.storyIds.push(story.id);
    this.appendAudit(actor, "story.create", "story", story.id, "accepted", { epicId: story.epicId });
    return story;
  }

  createAssignment(input: Omit<Assignment, "id" | "runIds">, actor: ActorIdentity): Assignment {
    this.ensureSafe(input, "assignment");
    if (!this.employees.has(input.employeeId)) {
      throw new Error(`Unknown employee: ${input.employeeId}`);
    }
    if (input.targetType === "story") {
      this.requireStory(input.targetId);
    }
    const assignment: Assignment = {
      ...input,
      id: createId("assignment", input),
      runIds: []
    };
    this.assignments.set(assignment.id, assignment);
    const story = input.targetType === "story" ? this.stories.get(input.targetId) : undefined;
    story?.assignmentIds.push(assignment.id);
    this.appendAudit(actor, "assignment.create", "assignment", assignment.id, "accepted", {
      employeeId: assignment.employeeId,
      targetType: assignment.targetType,
      targetId: assignment.targetId
    });
    return assignment;
  }

  recordAgentRun(input: Omit<AgentRun, "id">, actor: ActorIdentity): AgentRun {
    this.ensureSafe(input, "agentRun");
    const assignment = this.assignments.get(input.assignmentId);
    if (!assignment) {
      throw new Error(`Unknown assignment: ${input.assignmentId}`);
    }
    const run: AgentRun = {
      ...input,
      id: createId("run", input)
    };
    this.runs.set(run.id, run);
    assignment.runIds.push(run.id);
    assignment.status = run.status === "success" ? "verified" : run.status === "blocked" ? "blocked" : "in_review";
    this.appendAudit(actor, "agent_run.record", "run", run.id, "accepted", {
      assignmentId: run.assignmentId,
      status: run.status
    });
    return run;
  }

  updateGateStatus(gateId: string, status: GateWorkOrder["status"], actor: ActorIdentity, blocker?: string): GateWorkOrder {
    const gate = this.gates.get(gateId);
    if (!gate) {
      throw new Error(`Unknown gate: ${gateId}`);
    }
    gate.status = status;
    if (blocker) {
      gate.blocker = blocker;
    }
    this.appendAudit(actor, "gate.status.update", "gate", gate.id, status === "blocked" ? "blocked" : "accepted", {
      status,
      blocker: blocker ?? null
    });
    return gate;
  }

  updateConferenceStatus(conferenceId: string, status: ConferenceRequest["status"], actor: ActorIdentity): ConferenceRequest {
    const conference = this.conferences.get(conferenceId);
    if (!conference) {
      throw new Error(`Unknown conference: ${conferenceId}`);
    }
    conference.status = status;
    this.appendAudit(actor, "conference.status.update", "conference", conference.id, status === "blocked" ? "blocked" : "accepted", {
      status
    });
    return conference;
  }

  addSubTask(storyId: string, subTask: SubTask, actor: ActorIdentity): SubTask {
    this.ensureSafe(subTask, "subTask");
    const story = this.requireStory(storyId);
    story.subTasks.push(subTask);
    this.appendAudit(actor, "story.subtask.add", "story", storyId, "accepted", { subTaskId: subTask.id });
    return subTask;
  }

  addComment(input: Omit<StructuredComment, "id" | "createdAt" | "appendOnly">, actor: ActorIdentity): StructuredComment {
    this.ensureSafe(input, "comment");
    const story = this.requireStory(input.ticketId);
    const comment: StructuredComment = {
      ...input,
      id: createId("comment", input),
      createdAt: now(),
      appendOnly: true
    };
    story.comments.push(comment);
    this.appendAudit(actor, "comment.create", "story", story.id, "accepted", { commentId: comment.id, type: comment.type });
    return comment;
  }

  linkEvidence(input: Omit<EvidenceLink, "id" | "createdAt">, actor: ActorIdentity): EvidenceLink {
    this.ensureSafe(input, "evidence");
    const evidence: EvidenceLink = {
      ...input,
      id: createId("evidence", input),
      createdAt: now()
    };
    this.evidence.set(evidence.id, evidence);
    this.appendAudit(actor, "evidence.link", "evidence", evidence.id, "accepted", {
      type: evidence.type,
      redactionState: evidence.redactionState
    });
    return evidence;
  }

  requestGate(input: Omit<GateWorkOrder, "id" | "ownerRole" | "status">, actor: ActorIdentity): GateWorkOrder {
    this.ensureSafe(input, "gate");
    const ownerRole = resolveGateOwner(input.type);
    const gate: GateWorkOrder = {
      ...input,
      id: createId("gate", input),
      ownerRole,
      status: input.type === "owner_intent" ? "owner_intent_required" : "pending_role"
    };
    this.gates.set(gate.id, gate);
    const story = this.stories.get(gate.linkedTicketId);
    story?.gateIds.push(gate.id);
    this.appendAudit(actor, "gate.request", "gate", gate.id, "accepted", {
      type: gate.type,
      ownerRole,
      status: gate.status
    });
    return gate;
  }

  captureOwnerIntent(input: Omit<OwnerIntent, "id" | "status" | "auditEventId">, actor: ActorIdentity): OwnerIntent {
    this.ensureSafe(input, "ownerIntent");
    const audit = this.appendAudit(actor, "owner_intent.capture", "owner_intent", "pending", "accepted", {
      action: input.action
    });
    const intent: OwnerIntent = {
      ...input,
      id: createId("owner_intent", input),
      status: "captured",
      auditEventId: audit.id
    };
    this.ownerIntents.set(intent.id, intent);
    return intent;
  }

  createConference(input: Omit<ConferenceRequest, "id" | "inviteDispatchIds" | "status" | "positions">, actor: ActorIdentity): ConferenceRequest {
    this.ensureSafe(input, "conference");
    const conference: ConferenceRequest = {
      ...input,
      id: createId("conference", input),
      inviteDispatchIds: [],
      status: "requested",
      positions: []
    };
    this.conferences.set(conference.id, conference);
    this.appendAudit(actor, "conference.request", "conference", conference.id, "accepted", {
      type: conference.type,
      participants: conference.participantEmployeeIds.length
    });
    return conference;
  }

  recordConferencePosition(input: Omit<ConferencePosition, "id">, actor: ActorIdentity): ConferencePosition {
    this.ensureSafe(input, "conferencePosition");
    const conference = this.conferences.get(input.conferenceId);
    if (!conference) {
      throw new Error(`Unknown conference: ${input.conferenceId}`);
    }
    const position: ConferencePosition = {
      ...input,
      id: createId("conference_position", input)
    };
    conference.positions.push(position);
    conference.status = "collecting_positions";
    this.appendAudit(actor, "conference.position.record", "conference", conference.id, "accepted", {
      positionId: position.id
    });
    return position;
  }

  recordConferenceMinutes(input: Omit<ConferenceMinutes, "id">, actor: ActorIdentity): ConferenceMinutes {
    this.ensureSafe(input, "conferenceMinutes");
    const conference = this.conferences.get(input.conferenceId);
    if (!conference) {
      throw new Error(`Unknown conference: ${input.conferenceId}`);
    }
    const minutes: ConferenceMinutes = {
      ...input,
      id: createId("conference_minutes", input)
    };
    conference.minutes = minutes;
    conference.status = input.outcomeClass === "blocked" ? "blocked" : "closed";
    this.appendAudit(actor, "conference.minutes.record", "conference", conference.id, input.outcomeClass === "blocked" ? "blocked" : "accepted", {
      minutesId: minutes.id,
      outcomeClass: minutes.outcomeClass,
      actionItemAutomation: false
    });
    return minutes;
  }

  linkConferenceDispatch(conferenceId: string, dispatchId: string, actor: ActorIdentity): ConferenceRequest {
    const conference = this.conferences.get(conferenceId);
    if (!conference) {
      throw new Error(`Unknown conference: ${conferenceId}`);
    }
    if (!conference.inviteDispatchIds.includes(dispatchId)) {
      conference.inviteDispatchIds.push(dispatchId);
      this.appendAudit(actor, "conference.dispatch.link", "conference", conference.id, "accepted", {
        dispatchId,
        liveDispatchAuthorized: false
      });
    }
    return conference;
  }

  createWorkIndexDrillThrough(storyId: string): WorkIndexDrillThrough {
    const story = this.requireStory(storyId);
    const assignments = [...this.assignments.values()].filter((assignment) => story.assignmentIds.includes(assignment.id) || assignment.targetId === story.id);
    const gates = [...this.gates.values()].filter((gate) => story.gateIds.includes(gate.id) || gate.linkedTicketId === story.id);
    const conferences = [...this.conferences.values()].filter((conference) => conference.linkedTicketIds.includes(story.id));
    const linkedEvidenceIds = new Set<string>([
      ...story.evidenceIds,
      ...gates.flatMap((gate) => gate.inputEvidenceIds),
      ...conferences.flatMap((conference) => conference.positions.flatMap((position) => position.evidenceIds))
    ]);
    const targetIds = new Set<string>([
      story.id,
      ...assignments.map((assignment) => assignment.id),
      ...gates.map((gate) => gate.id),
      ...conferences.map((conference) => conference.id),
      ...linkedEvidenceIds
    ]);
    const nextAllowedLocalActions = new Set<WorkIndexDrillThrough["nextAllowedLocalActions"][number]>(["open_evidence_metadata"]);
    if (conferences.length === 0) {
      nextAllowedLocalActions.add("request_conference");
    }
    if (conferences.some((conference) => this.deriveConferenceOperatingLoop(conference.id).missingParticipantEmployeeIds.length > 0)) {
      nextAllowedLocalActions.add("record_participant_position");
    }
    if (conferences.some((conference) => this.deriveConferenceOperatingLoop(conference.id).minutesStatus === "ready_for_draft")) {
      nextAllowedLocalActions.add("record_minutes");
    }
    if (gates.length === 0) {
      nextAllowedLocalActions.add("request_gate");
    }
    if (assignments.some((assignment) => assignment.dueState === "timeout")) {
      nextAllowedLocalActions.add("mark_route_stale");
    }
    const blockedActions: WorkIndexDrillThrough["blockedActions"] = [];
    if (gates.some((gate) => gate.type === "owner_intent" || gate.status === "owner_intent_required")) {
      blockedActions.push({
        action: "submit_owner_intent",
        reason: "Owner Intent remains a pending human gate and cannot be auto-executed by the local operating loop.",
        ownerRole: "owner"
      });
    }
    if (story.status === "blocked" || gates.some((gate) => gate.status === "blocked")) {
      blockedActions.push({
        action: "record_minutes",
        reason: "Blocked work can keep metadata but cannot be advanced as accepted minutes without a role/owner disposition.",
        ownerRole: "verification"
      });
    }
    return {
      selectedStoryId: story.id,
      linkedAssignmentIds: assignments.map((assignment) => assignment.id),
      linkedGateIds: gates.map((gate) => gate.id),
      linkedConferenceIds: conferences.map((conference) => conference.id),
      linkedEvidenceIds: [...linkedEvidenceIds],
      linkedAuditEventIds: this.auditEvents.filter((event) => targetIds.has(event.targetId)).map((event) => event.id),
      nextAllowedLocalActions: [...nextAllowedLocalActions],
      blockedActions
    };
  }

  deriveConferenceOperatingLoop(conferenceId: string): LocalConferenceOperatingLoop {
    const conference = this.conferences.get(conferenceId);
    if (!conference) {
      throw new Error(`Unknown conference: ${conferenceId}`);
    }
    const respondingEmployeeIds = new Set(conference.positions.map((position) => position.actor.employeeId));
    const missingParticipantEmployeeIds = conference.participantEmployeeIds.filter((id) => !respondingEmployeeIds.has(id));
    const minutesStatus: LocalConferenceOperatingLoop["minutesStatus"] = conference.status === "blocked"
      ? "blocked"
      : conference.minutes
        ? "recorded"
        : conference.positions.length > 0
          ? "ready_for_draft"
          : "not_started";
    const outcomeClass: LocalConferenceOperatingLoop["outcomeClass"] = conference.minutes?.outcomeClass
      ?? (conference.status === "blocked" ? "blocked" : conference.positions.length > 0 ? "recommendation" : "discussion_only");
    return {
      conferenceId: conference.id,
      linkedTicketIds: conference.linkedTicketIds,
      initiatorEmployeeId: conference.initiator.employeeId,
      participantEmployeeIds: conference.participantEmployeeIds,
      inviteDispatchIds: conference.inviteDispatchIds,
      missingParticipantEmployeeIds,
      participantPositionIds: conference.positions.map((position) => position.id),
      minutesStatus,
      outcomeClass,
      liveDispatchAuthorized: false,
      threadRegistryMutationAuthorized: false
    };
  }

  createDependencyRecord(input: Omit<DependencyLifecycleRecord, "id" | "linkedGateIds">, actor: ActorIdentity): DependencyLifecycleRecord {
    this.ensureSafe(input, "dependency");
    this.requireProject(input.projectId);
    const dependency: DependencyLifecycleRecord = {
      ...input,
      id: createId("dependency", input),
      linkedGateIds: []
    };
    this.dependencies.set(dependency.id, dependency);
    this.appendAudit(actor, "dependency.record.propose", "dependency", dependency.id, "accepted", {
      posture: dependency.posture,
      evidenceStatus: dependency.evidenceStatus,
      lifecycleState: dependency.lifecycleState ?? "current",
      policyClass: dependency.policyClass ?? "review_required",
      packageMutationExecuted: dependency.packageMutationExecuted ?? false
    });
    return dependency;
  }

  createResourceRecord(input: Omit<ResourceRegistryRecord, "id" | "linkedGateIds" | "projectManifestRefs">, actor: ActorIdentity): ResourceRegistryRecord {
    this.ensureSafe(input, "resource");
    if (input.projectId) {
      this.requireProject(input.projectId);
    }
    const resource: ResourceRegistryRecord = {
      ...input,
      id: createId("resource", input),
      projectManifestRefs: [],
      linkedGateIds: []
    };
    this.resources.set(resource.id, resource);
    this.appendAudit(actor, "resource.record.propose", "resource", resource.id, "accepted", {
      copyrightStatus: resource.copyrightStatus,
      approvalState: resource.approvalState,
      permissionState: resource.permissionState ?? "unknown",
      materializationExecuted: resource.materializationExecuted ?? false,
      productRepoWriteExecuted: resource.productRepoWriteExecuted ?? false
    });
    return resource;
  }

  createDependencyDetectionFinding(input: Omit<DependencyDetectionFinding, "id">, actor: ActorIdentity): DependencyDetectionFinding {
    this.ensureSafe(input, "dependencyFinding");
    this.requireProject(input.projectId);
    this.requireDependency(input.dependencyId);
    const finding: DependencyDetectionFinding = {
      ...input,
      id: createId("dependency_finding", input)
    };
    this.dependencyFindings.set(finding.id, finding);
    this.appendAudit(actor, "dependency.detection.record", "dependency_finding", finding.id, finding.state === "denied" ? "blocked" : "accepted", {
      dependencyId: finding.dependencyId,
      state: finding.state,
      remediationExecuted: finding.remediationExecuted,
      packageMutationExecuted: finding.packageMutationExecuted
    });
    return finding;
  }

  createDependencyGovernanceIndex(projectId: ProjectId): DependencyGovernanceIndexReadback {
    this.requireProject(projectId);
    const dependencies = [...this.dependencies.values()].filter((dependency) => dependency.projectId === projectId);
    const findings = [...this.dependencyFindings.values()].filter((finding) => finding.projectId === projectId);
    const blockedDependencyIds = unique([
      ...dependencies.filter((dependency) => dependency.posture === "blocked" || dependency.policyClass === "denied" || dependency.evidenceStatus === "conflict").map((dependency) => dependency.id),
      ...findings.filter((finding) => ["denied", "expired", "unapproved"].includes(finding.state)).map((finding) => finding.dependencyId)
    ]);
    return {
      projectId,
      dependencyIds: dependencies.map((dependency) => dependency.id),
      detectionFindingIds: findings.map((finding) => finding.id),
      blockedDependencyIds,
      releaseBlockerDependencyIds: dependencies.filter((dependency) => dependency.releaseBlocker || dependency.policyClass === "denied" || dependency.evidenceStatus === "evidence_missing" || ["blocked", "denied", "expired", "evidence_missing"].includes(dependency.posture)).map((dependency) => dependency.id),
      sbomNoticeRequiredDependencyIds: dependencies.filter((dependency) => dependency.sbomNoticeObligation !== "none").map((dependency) => dependency.id),
      linkedGateIds: unique([
        ...dependencies.flatMap((dependency) => dependency.linkedGateIds),
        ...findings.flatMap((finding) => finding.linkedGateIds)
      ]),
      linkedEvidenceIds: unique([
        ...dependencies.flatMap((dependency) => dependency.linkedEvidenceIds ?? []),
        ...findings.flatMap((finding) => finding.evidenceIds)
      ]),
      stateCounts: countBy([
        ...dependencies.map((dependency) => dependency.lifecycleState ?? "current"),
        ...findings.map((finding) => finding.state)
      ]),
      localFirstStorage: true,
      packageMutationAuthorized: false,
      remediationExecuted: false,
      dependencyCleanClaimed: false,
      legalCompletionClaimed: false,
      releaseReadinessClaimed: false
    };
  }

  createResourceMaterializationRequest(input: Omit<ResourceMaterializationRequest, "id" | "ownerIntentRequired" | "materializationExecuted" | "productRepoWriteExecuted">, actor: ActorIdentity): ResourceMaterializationRequest {
    this.ensureSafe(input, "resourceMaterializationRequest");
    this.requireProject(input.projectId);
    this.requireProject(input.targetProjectId);
    this.requireResource(input.resourceId);
    const request: ResourceMaterializationRequest = {
      ...input,
      id: createId("resource_materialization_request", input),
      ownerIntentRequired: true,
      materializationExecuted: false,
      productRepoWriteExecuted: false
    };
    this.materializationRequests.set(request.id, request);
    this.appendAudit(actor, "resource.materialization.request", "resource_materialization_request", request.id, request.status === "blocked" ? "blocked" : "accepted", {
      resourceId: request.resourceId,
      targetProjectId: request.targetProjectId,
      ownerIntentRequired: request.ownerIntentRequired,
      materializationExecuted: request.materializationExecuted,
      productRepoWriteExecuted: request.productRepoWriteExecuted
    });
    return request;
  }

  createProjectResourceManifest(input: Omit<ProjectResourceManifestRecord, "id" | "sourceTruth" | "liveCopyCreated" | "productRepoWriteExecuted">, actor: ActorIdentity): ProjectResourceManifestRecord {
    this.ensureSafe(input, "projectResourceManifest");
    this.requireProject(input.projectId);
    this.requireResource(input.resourceId);
    const manifest: ProjectResourceManifestRecord = {
      ...input,
      id: createId("resource_manifest", input),
      sourceTruth: "resource_library",
      liveCopyCreated: false,
      productRepoWriteExecuted: false
    };
    this.resourceManifests.set(manifest.id, manifest);
    const resource = this.resources.get(manifest.resourceId);
    if (resource && !resource.projectManifestRefs.includes(manifest.id)) {
      resource.projectManifestRefs.push(manifest.id);
    }
    this.appendAudit(actor, "resource.manifest.record", "resource_manifest", manifest.id, manifest.status === "blocked" ? "blocked" : "accepted", {
      resourceId: manifest.resourceId,
      status: manifest.status,
      liveCopyCreated: manifest.liveCopyCreated,
      productRepoWriteExecuted: manifest.productRepoWriteExecuted
    });
    return manifest;
  }

  createResourceAuditFinding(input: Omit<ResourceAuditFinding, "id" | "scannerIngestionExecuted" | "materializationExecuted" | "productRepoMutationExecuted">, actor: ActorIdentity): ResourceAuditFinding {
    this.ensureSafe(input, "resourceAuditFinding");
    this.requireProject(input.projectId);
    if (input.resourceId) {
      this.requireResource(input.resourceId);
    }
    const finding: ResourceAuditFinding = {
      ...input,
      id: createId("resource_finding", input),
      scannerIngestionExecuted: false,
      materializationExecuted: false,
      productRepoMutationExecuted: false
    };
    this.resourceFindings.set(finding.id, finding);
    this.appendAudit(actor, "resource.audit_finding.record", "resource_finding", finding.id, finding.severity === "blocked" ? "blocked" : "accepted", {
      findingType: finding.findingType,
      severity: finding.severity,
      scannerIngestionExecuted: finding.scannerIngestionExecuted,
      materializationExecuted: finding.materializationExecuted,
      productRepoMutationExecuted: finding.productRepoMutationExecuted
    });
    return finding;
  }

  createResourceGovernanceIndex(projectId: ProjectId): ResourceGovernanceIndexReadback {
    this.requireProject(projectId);
    const resources = [...this.resources.values()].filter((resource) => !resource.projectId || resource.projectId === projectId);
    const requests = [...this.materializationRequests.values()].filter((request) => request.projectId === projectId || request.targetProjectId === projectId);
    const manifests = [...this.resourceManifests.values()].filter((manifest) => manifest.projectId === projectId);
    const findings = [...this.resourceFindings.values()].filter((finding) => finding.projectId === projectId);
    const blockedResourceIds = unique([
      ...resources.filter((resource) => resource.approvalState === "blocked" || resource.copyrightStatus === "blocked" || resource.lifecycleState === "denied" || resource.lifecycleState === "revoked").map((resource) => resource.id),
      ...findings.filter((finding) => finding.severity === "blocked").flatMap((finding) => finding.resourceId ? [finding.resourceId] : [])
    ]);
    return {
      projectId,
      resourceIds: resources.map((resource) => resource.id),
      materializationRequestIds: requests.map((request) => request.id),
      manifestRecordIds: manifests.map((manifest) => manifest.id),
      auditFindingIds: findings.map((finding) => finding.id),
      blockedResourceIds,
      releaseBlockerResourceIds: resources.filter((resource) => resource.releaseBlocker || resource.approvalState === "blocked" || resource.copyrightStatus === "blocked" || resource.permissionState === "denied" || resource.permissionState === "expired").map((resource) => resource.id),
      linkedGateIds: unique([
        ...resources.flatMap((resource) => resource.linkedGateIds),
        ...requests.flatMap((request) => request.linkedGateId ? [request.linkedGateId] : []),
        ...findings.flatMap((finding) => finding.linkedGateIds)
      ]),
      linkedEvidenceIds: unique([
        ...resources.flatMap((resource) => resource.linkedEvidenceIds ?? []),
        ...requests.flatMap((request) => request.evidenceIds),
        ...manifests.flatMap((manifest) => manifest.linkedEvidenceIds),
        ...findings.flatMap((finding) => finding.evidenceIds)
      ]),
      traceabilityRows: resources.map((resource) => ({
        resourceId: resource.id,
        linkedStoryIds: unique([
          ...(resource.linkedStoryIds ?? []),
          ...manifests.filter((manifest) => manifest.resourceId === resource.id).flatMap((manifest) => manifest.linkedStoryIds)
        ]),
        linkedGateIds: resource.linkedGateIds,
        linkedReleaseNoteIds: unique([
          ...(resource.linkedReleaseNoteIds ?? []),
          ...manifests.filter((manifest) => manifest.resourceId === resource.id).flatMap((manifest) => manifest.linkedReleaseNoteIds)
        ]),
        linkedEvidenceIds: unique([
          ...(resource.linkedEvidenceIds ?? []),
          ...manifests.filter((manifest) => manifest.resourceId === resource.id).flatMap((manifest) => manifest.linkedEvidenceIds),
          ...findings.filter((finding) => finding.resourceId === resource.id).flatMap((finding) => finding.evidenceIds)
        ]),
        residualFindingIds: findings.filter((finding) => finding.resourceId === resource.id && finding.severity !== "info").map((finding) => finding.id)
      })),
      findingCounts: countBy(findings.map((finding) => finding.findingType)),
      localFirstStorage: true,
      scannerIngestionExecuted: false,
      materializationExecuted: false,
      productRepoWriteExecuted: false,
      legalCompletionClaimed: false,
      publicReadinessClaimed: false,
      releaseReadinessClaimed: false
    };
  }

  linkDependencyGate(dependencyId: string, gateId: string, actor: ActorIdentity): DependencyLifecycleRecord {
    const dependency = this.requireDependency(dependencyId);
    this.requireGate(gateId);
    if (!dependency.linkedGateIds.includes(gateId)) {
      dependency.linkedGateIds.push(gateId);
    }
    this.appendAudit(actor, "dependency.gate.link", "dependency", dependency.id, "accepted", {
      gateId,
      packageMutationExecuted: false
    });
    return dependency;
  }

  linkResourceGate(resourceId: string, gateId: string, actor: ActorIdentity): ResourceRegistryRecord {
    const resource = this.requireResource(resourceId);
    this.requireGate(gateId);
    if (!resource.linkedGateIds.includes(gateId)) {
      resource.linkedGateIds.push(gateId);
    }
    this.appendAudit(actor, "resource.gate.link", "resource", resource.id, "accepted", {
      gateId,
      materializationExecuted: false,
      productRepoWriteExecuted: false
    });
    return resource;
  }

  createKnowledgeEntry(entry: KnowledgeEntry, actor: ActorIdentity): KnowledgeEntry {
    this.ensureSafe(entry, "knowledge");
    this.requireProject(entry.projectId);
    this.knowledge.set(entry.id, entry);
    this.appendAudit(actor, "knowledge.propose", "knowledge", entry.id, "accepted", {
      category: entry.category,
      freshnessState: entry.freshnessState,
      canonicalPromotionClaimed: entry.canonicalPromotionClaimed,
      explicitExportRequired: entry.explicitExportRequired
    });
    return entry;
  }

  createUserGuideDraft(guide: UserGuidePageDraft, actor: ActorIdentity): UserGuidePageDraft {
    this.ensureSafe(guide, "userGuideDraft");
    this.requireProject(guide.projectId);
    this.userGuideDrafts.set(guide.id, guide);
    this.appendAudit(actor, "guide.page.draft", "guide", guide.id, "accepted", {
      audience: guide.audience,
      versionLabel: guide.versionLabel,
      publishedStateDistinctFromDraft: guide.publishedStateDistinctFromDraft,
      defaultGitStorage: guide.defaultGitStorage
    });
    return guide;
  }

  createReleaseNote(note: ReleaseNoteRecord, actor: ActorIdentity): ReleaseNoteRecord {
    this.ensureSafe(note, "releaseNote");
    this.requireProject(note.projectId);
    this.releaseNotes.set(note.id, note);
    this.appendAudit(actor, "release_note.draft", "release_note", note.id, "accepted", {
      releaseLabel: note.releaseLabel,
      reviewState: note.reviewState,
      gitExportAuthorized: note.gitExportAuthorized,
      releaseCloseoutClaimed: note.releaseCloseoutClaimed
    });
    return note;
  }

  createDocumentationIndex(projectId: ProjectId): ProjectDocumentationIndexReadback {
    this.requireProject(projectId);
    const knowledge = [...this.knowledge.values()].filter((entry) => entry.projectId === projectId);
    const guides = [...this.userGuideDrafts.values()].filter((guide) => guide.projectId === projectId);
    const releases = [...this.releaseNotes.values()].filter((note) => note.projectId === projectId);
    const staleItemIds = new Set<string>([
      ...knowledge.filter((entry) => ["review_due", "stale", "blocked"].includes(entry.freshnessState)).map((entry) => entry.id),
      ...guides.filter((guide) => ["review_required", "published_external_blocked"].includes(guide.status)).map((guide) => guide.id),
      ...releases.filter((note) => ["review_required", "publish_blocked"].includes(note.reviewState)).map((note) => note.id)
    ]);
    const blockedPublishItemIds = new Set<string>([
      ...knowledge.filter((entry) => entry.status === "blocked" || entry.explicitExportRequired).map((entry) => entry.id),
      ...guides.filter((guide) => guide.status === "published_external_blocked").map((guide) => guide.id),
      ...releases.filter((note) => note.reviewState === "publish_blocked" || !note.gitExportAuthorized).map((note) => note.id)
    ]);
    return {
      projectId,
      knowledgeEntryIds: knowledge.map((entry) => entry.id),
      guidePageIds: guides.map((guide) => guide.id),
      releaseNoteItemIds: releases.map((note) => note.id),
      staleItemIds: [...staleItemIds],
      blockedPublishItemIds: [...blockedPublishItemIds],
      linkedWorkItemIds: unique([
        ...knowledge.flatMap((entry) => entry.linkedTicketIds),
        ...guides.flatMap((guide) => guide.linkedStoryIds),
        ...releases.flatMap((note) => note.linkedStoryIds)
      ]),
      linkedConferenceIds: unique(knowledge.flatMap((entry) => entry.linkedConferenceIds)),
      linkedEvidenceIds: unique([
        ...knowledge.flatMap((entry) => entry.linkedEvidenceIds),
        ...guides.flatMap((guide) => guide.linkedEvidenceIds),
        ...releases.flatMap((note) => note.linkedEvidenceIds)
      ]),
      localFirstStorage: true,
      explicitExportRequired: true
    };
  }

  blockDocumentationAction(input: Omit<DocumentationActionBlock, "status" | "reason" | "ownerIntentRequired" | "auditEventId">, actor: ActorIdentity): DocumentationActionBlock {
    this.ensureSafe(input, "documentationActionBlock");
    this.requireProject(input.projectId);
    const audit = this.appendAudit(actor, `documentation.${input.action}.blocked`, input.targetType, input.targetId, "blocked", {
      projectId: input.projectId,
      ownerIntentRequired: true,
      localFirstStorage: true
    });
    return {
      ...input,
      status: "blocked",
      reason: "Documentation export, publication, canonical promotion, and release closeout require a separately routed Owner Intent/export packet.",
      ownerIntentRequired: true,
      auditEventId: audit.id
    };
  }

  deriveStageMap(projectId: ProjectId, initiativeId: string): StageMapItem[] {
    const initiative = this.initiatives.get(initiativeId);
    if (!initiative || initiative.projectId !== projectId) {
      return [];
    }
    const stories = initiative.storyIds.map((id) => this.stories.get(id)).filter((story): story is StoryRecord => Boolean(story));
    const storyIds = stories.map((story) => story.id);
    const gateIds = [...new Set(stories.flatMap((story) => story.gateIds))];
    return [...this.stageDefinitions.values()].map((stage) => {
      const relevantGates = gateIds
        .map((id) => this.gates.get(id))
        .filter((gate): gate is GateWorkOrder => gate !== undefined)
        .filter((gate) => stage.gateTypes.includes(gate.type));
      const blocked = stories.some((story) => story.status === "blocked") || relevantGates.some((gate) => gate.status === "blocked");
      const complete = stories.length > 0 && stories.every((story) => ["verified", "released"].includes(story.status));
      return {
        projectId,
        initiativeId,
        stageId: stage.id,
        state: blocked ? "blocked" : complete && stage.id !== "release" ? "complete" : stage.id === "release" ? "release_proof_required" : "active",
        ownerRoles: stage.defaultOwnerRoles,
        sourceStoryIds: storyIds,
        sourceGateIds: relevantGates.map((gate) => gate.id),
        evidenceIds: initiative.evidenceIds
      };
    });
  }

  queryAudit(filter: Partial<{ targetId: string; action: string; actorEmployeeId: string }> = {}): AuditEvent[] {
    return this.auditEvents.filter((event) => {
      const actorEmployeeId = "employeeId" in event.actor ? event.actor.employeeId : event.actor.system;
      return (!filter.targetId || event.targetId === filter.targetId)
        && (!filter.action || event.action === filter.action)
        && (!filter.actorEmployeeId || actorEmployeeId === filter.actorEmployeeId);
    }).map((event) => ({ ...event, details: { ...event.details } }));
  }

  private requireStory(storyId: string): StoryRecord {
    const story = this.stories.get(storyId);
    if (!story) {
      throw new Error(`Unknown story: ${storyId}`);
    }
    return story;
  }

  private requireProject(projectId: ProjectId): ProjectRecord {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Unknown project: ${projectId}`);
    }
    return project;
  }

  private requireGate(gateId: string): GateWorkOrder {
    const gate = this.gates.get(gateId);
    if (!gate) {
      throw new Error(`Unknown gate: ${gateId}`);
    }
    return gate;
  }

  private requireDependency(dependencyId: string): DependencyLifecycleRecord {
    const dependency = this.dependencies.get(dependencyId);
    if (!dependency) {
      throw new Error(`Unknown dependency: ${dependencyId}`);
    }
    return dependency;
  }

  private requireResource(resourceId: string): ResourceRegistryRecord {
    const resource = this.resources.get(resourceId);
    if (!resource) {
      throw new Error(`Unknown resource: ${resourceId}`);
    }
    return resource;
  }

  private ensureSafe(value: unknown, context: string): void {
    assertNoRestrictedContent(value, context);
  }

  appendAudit(actor: ActorIdentity | { system: string }, action: string, targetType: string, targetId: string, outcome: AuditEvent["outcome"], details: Record<string, unknown>): AuditEvent {
    const event: AuditEvent = {
      id: createId("audit", { action, targetType, targetId, at: now(), actor }),
      actor,
      action,
      targetType,
      targetId,
      timestamp: now(),
      outcome,
      policyVersion: POLICY_VERSION,
      details: redactForAudit(details) as Record<string, unknown>
    };
    this.auditEvents.push(Object.freeze(event));
    return event;
  }
}

export function now(): string {
  return new Date().toISOString();
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}
