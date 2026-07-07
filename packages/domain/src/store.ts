import { assertNoRestrictedContent, redactForAudit } from "./security.js";
import { createId, digest } from "./idempotency.js";
import { POLICY_VERSION, canApproveGate, resolveGateOwner } from "./policies.js";
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
  DocsReadinessRecord,
  DocsSearchReleaseLinkageIndexReadback,
  EpicRecord,
  EvidenceLink,
  GateWorkOrder,
  GitHubMetadataReadback,
  InitiativeRecord,
  KnowledgeEntry,
  LocalConferenceOperatingLoop,
  OwnerIntent,
  PrCiStoryReadinessLinkage,
  ProjectId,
  ProjectDocumentationIndexReadback,
  ProjectSearchIndexRecord,
  ProjectRecord,
  ProjectResourceManifestRecord,
  ReleaseNoteRecord,
  ReleaseCandidateLinkage,
  ResourceAuditFinding,
  ResourceGovernanceIndexReadback,
  ResourceCleanupReadback,
  ResourceMaterializationControlIndexReadback,
  ResourceMaterializationHistoryRecord,
  ResourceMaterializationRequest,
  ResourceReplacementRequest,
  ResourceRetirementRecord,
  ResourceRollbackPlan,
  ResourceRollbackRequest,
  ResourceRegistryRecord,
  ResourceUpdateRequest,
  StageDefinition,
  StageMapItem,
  StoryRecord,
  StructuredComment,
  SubTask,
  TicketListParams,
  TicketListReadback,
  TicketListRow,
  UserGuidePageDraft,
  WorkIndexDrillThrough
} from "./types.js";

export interface AosSeed {
  projects: ProjectRecord[];
  employees: AIEmployee[];
  stageDefinitions: StageDefinition[];
}

export type AosCorePersistenceKind =
  | "project"
  | "initiative"
  | "epic"
  | "story"
  | "subtask"
  | "employee"
  | "assignment"
  | "gate"
  | "evidence"
  | "audit"
  | "agentRun";

export interface AosCorePersistenceSnapshot {
  projects: ProjectRecord[];
  employees: AIEmployee[];
  initiatives: InitiativeRecord[];
  epics: EpicRecord[];
  stories: StoryRecord[];
  assignments: Assignment[];
  runs: AgentRun[];
  gates: GateWorkOrder[];
  evidence: EvidenceLink[];
  auditEvents: AuditEvent[];
}

export interface AosPersistenceRepository {
  hydrateCore(): Partial<AosCorePersistenceSnapshot>;
  runInTransaction<T>(operation: () => T): T;
  saveCoreRecord(kind: AosCorePersistenceKind, record: unknown): void;
  appendAuditEvent(event: AuditEvent): void;
}

export interface AosStoreOptions {
  persistence?: AosPersistenceRepository;
  hydrate?: boolean;
}

type WorkLoopScopeInput = {
  initiativeId: string;
  epicId: string;
};

type AssignmentClaimInput = WorkLoopScopeInput & {
  targetType: "story" | "gate";
  targetId: string;
};

type AssignmentUpdateInput = WorkLoopScopeInput & {
  assignmentId: string;
  priorStatus: Assignment["status"];
  status: Assignment["status"];
  runId?: string;
  evidenceId?: string;
};

type GateDecisionRecordInput = WorkLoopScopeInput & {
  gateId: string;
  priorStatus: GateWorkOrder["status"];
  decision: "accepted" | "blocked" | "superseded" | "owner_intent_required";
  evidenceIds?: string[];
};

const activeAssignmentStatuses: Assignment["status"][] = ["accepted", "in_progress", "blocked", "in_review"];
const terminalAssignmentStatuses: Assignment["status"][] = ["verified", "released", "archived", "superseded"];
const terminalGateStatuses: GateWorkOrder["status"][] = ["accepted", "blocked", "superseded"];
const assignmentStatusTransitions = new Set([
  "accepted->in_progress",
  "in_progress->blocked",
  "blocked->in_progress",
  "in_progress->in_review"
]);

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
  private resourceMaterializationHistory = new Map<string, ResourceMaterializationHistoryRecord>();
  private resourceUpdateRequests = new Map<string, ResourceUpdateRequest>();
  private resourceReplacementRequests = new Map<string, ResourceReplacementRequest>();
  private resourceRollbackRequests = new Map<string, ResourceRollbackRequest>();
  private resourceRollbackPlans = new Map<string, ResourceRollbackPlan>();
  private resourceRetirements = new Map<string, ResourceRetirementRecord>();
  private resourceCleanupReadbacks = new Map<string, ResourceCleanupReadback>();
  private knowledge = new Map<string, KnowledgeEntry>();
  private userGuideDrafts = new Map<string, UserGuidePageDraft>();
  private releaseNotes = new Map<string, ReleaseNoteRecord>();
  private docsReadiness = new Map<string, DocsReadinessRecord>();
  private searchIndexRecords = new Map<string, ProjectSearchIndexRecord>();
  private githubMetadata = new Map<string, GitHubMetadataReadback>();
  private prCiReadiness = new Map<string, PrCiStoryReadinessLinkage>();
  private releaseCandidates = new Map<string, ReleaseCandidateLinkage>();
  private ownerIntents = new Map<string, OwnerIntent>();
  private stageDefinitions = new Map<string, StageDefinition>();
  private auditEvents: AuditEvent[] = [];
  private readonly persistence: AosPersistenceRepository | undefined;

  constructor(seed?: AosSeed, options: AosStoreOptions = {}) {
    this.persistence = options.persistence;
    seed?.projects.forEach((project) => this.projects.set(project.id, project));
    seed?.employees.forEach((employee) => this.employees.set(employee.id, employee));
    seed?.stageDefinitions.forEach((stage) => this.stageDefinitions.set(stage.id, stage));
    if (options.hydrate !== false) {
      this.hydrateFromPersistence();
    }
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

  listResourceMaterializationHistory(): ResourceMaterializationHistoryRecord[] {
    return [...this.resourceMaterializationHistory.values()];
  }

  listResourceUpdateRequests(): ResourceUpdateRequest[] {
    return [...this.resourceUpdateRequests.values()];
  }

  listResourceReplacementRequests(): ResourceReplacementRequest[] {
    return [...this.resourceReplacementRequests.values()];
  }

  listResourceRollbackRequests(): ResourceRollbackRequest[] {
    return [...this.resourceRollbackRequests.values()];
  }

  listResourceRollbackPlans(): ResourceRollbackPlan[] {
    return [...this.resourceRollbackPlans.values()];
  }

  listResourceRetirements(): ResourceRetirementRecord[] {
    return [...this.resourceRetirements.values()];
  }

  listResourceCleanupReadbacks(): ResourceCleanupReadback[] {
    return [...this.resourceCleanupReadbacks.values()];
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

  listDocsReadinessRecords(): DocsReadinessRecord[] {
    return [...this.docsReadiness.values()];
  }

  listSearchIndexRecords(): ProjectSearchIndexRecord[] {
    return [...this.searchIndexRecords.values()];
  }

  listGitHubMetadataReadbacks(): GitHubMetadataReadback[] {
    return [...this.githubMetadata.values()];
  }

  listPrCiStoryReadiness(): PrCiStoryReadinessLinkage[] {
    return [...this.prCiReadiness.values()];
  }

  listReleaseCandidateLinkages(): ReleaseCandidateLinkage[] {
    return [...this.releaseCandidates.values()];
  }

  getProject(projectId: ProjectId): ProjectRecord | undefined {
    return this.projects.get(projectId);
  }

  upsertProject(project: ProjectRecord, actor: ActorIdentity): ProjectRecord {
    return this.withPersistenceTransaction(() => {
      this.ensureSafe(project, "project");
      this.projects.set(project.id, project);
      this.persistCoreRecord("project", project);
      this.appendAudit(actor, "project.upsert", "project", project.id, "accepted", { status: project.status });
      return project;
    });
  }

  createInitiative(input: Omit<InitiativeRecord, "id" | "epicIds" | "storyIds" | "gateIds" | "evidenceIds" | "decisionHistory">, actor: ActorIdentity): InitiativeRecord {
    return this.withPersistenceTransaction(() => {
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
      this.persistCoreRecord("initiative", initiative);
      this.appendAudit(actor, "initiative.create", "initiative", initiative.id, "accepted", { projectId: initiative.projectId });
      return initiative;
    });
  }

  createEpic(input: Omit<EpicRecord, "id" | "storyIds" | "gateIds" | "evidenceIds">, actor: ActorIdentity): EpicRecord {
    return this.withPersistenceTransaction(() => {
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
      if (initiative) {
        this.persistCoreRecord("initiative", initiative);
      }
      this.persistCoreRecord("epic", epic);
      this.appendAudit(actor, "epic.create", "epic", epic.id, "accepted", { initiativeId: epic.initiativeId });
      return epic;
    });
  }

  createStory(input: Omit<StoryRecord, "id" | "comments" | "links" | "gateIds" | "assignmentIds" | "evidenceIds" | "decisionHistory">, actor: ActorIdentity): StoryRecord {
    return this.withPersistenceTransaction(() => {
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
      if (epic) {
        this.persistCoreRecord("epic", epic);
      }
      if (initiative) {
        this.persistCoreRecord("initiative", initiative);
      }
      this.persistCoreRecord("story", story);
      this.appendAudit(actor, "story.create", "story", story.id, "accepted", { epicId: story.epicId });
      return story;
    });
  }

  createAssignment(input: Omit<Assignment, "id" | "runIds">, actor: ActorIdentity): Assignment {
    return this.withPersistenceTransaction(() => {
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
      if (story) {
        this.persistCoreRecord("story", story);
      }
      this.persistCoreRecord("assignment", assignment);
      this.appendAudit(actor, "assignment.create", "assignment", assignment.id, "accepted", {
        employeeId: assignment.employeeId,
        targetType: assignment.targetType,
        targetId: assignment.targetId
      });
      return assignment;
    });
  }

  claimAssignment(input: AssignmentClaimInput, actor: ActorIdentity): { assignment: Assignment; replayedByState: boolean; auditEventId: string | null; scope: { initiativeId: string; epicId: string; storyId: string } } {
    return this.withPersistenceTransaction(() => {
      this.hydrateFromPersistence();
      this.ensureSafe(input, "assignmentClaim");
      if (!["story", "gate"].includes(input.targetType)) {
        throw new Error("assignment_claim_target_type_denied");
      }
      const story = this.resolveWorkLoopStory(input.targetType, input.targetId);
      const scope = this.requireWorkLoopScope(story, input);
      const existing = this.findActiveAssignment(input.targetType, input.targetId, actor.role);
      if (existing) {
        if (existing.employeeId === actor.employeeId) {
          return { assignment: { ...existing, runIds: [...existing.runIds] }, replayedByState: true, auditEventId: null, scope };
        }
        throw new Error("already_claimed");
      }
      if (!this.employees.has(actor.employeeId)) {
        throw new Error(`Unknown employee: ${actor.employeeId}`);
      }
      const assignment: Assignment = {
        id: createId("assignment", {
          targetType: input.targetType,
          targetId: input.targetId,
          role: actor.role,
          employeeId: actor.employeeId
        }),
        employeeId: actor.employeeId,
        targetId: input.targetId,
        targetType: input.targetType,
        role: actor.role,
        status: "accepted",
        dueState: "none",
        proofExpectation: "phase3_work_loop_assignment_claim_metadata_only",
        runIds: []
      };
      this.assignments.set(assignment.id, assignment);
      if (input.targetType === "story" && !story.assignmentIds.includes(assignment.id)) {
        story.assignmentIds.push(assignment.id);
        this.persistCoreRecord("story", story);
      }
      this.persistCoreRecord("assignment", assignment);
      const audit = this.appendAudit(actor, "assignment.claim", "assignment", assignment.id, "accepted", {
        targetType: assignment.targetType,
        targetId: assignment.targetId,
        role: assignment.role,
        replayedByState: false
      });
      return { assignment: { ...assignment, runIds: [] }, replayedByState: false, auditEventId: audit.id, scope };
    });
  }

  updateAssignment(input: AssignmentUpdateInput, actor: ActorIdentity): { assignment: Assignment; auditEventId: string; scope: { initiativeId: string; epicId: string; storyId: string } } {
    return this.withPersistenceTransaction(() => {
      this.hydrateFromPersistence();
      this.ensureSafe(input, "assignmentUpdate");
      const assignment = this.assignments.get(input.assignmentId);
      if (!assignment) {
        throw new Error("assignment_update_unknown_assignment");
      }
      if (assignment.employeeId !== actor.employeeId) {
        throw new Error("assignment_update_non_assignee_denied");
      }
      if (terminalAssignmentStatuses.includes(assignment.status) || !activeAssignmentStatuses.includes(assignment.status)) {
        throw new Error("assignment_update_terminal_or_inactive_status_denied");
      }
      if (assignment.status !== input.priorStatus) {
        throw new Error("assignment_update_stale_status");
      }
      if (!assignmentStatusTransitions.has(`${assignment.status}->${input.status}`)) {
        throw new Error("assignment_update_transition_denied");
      }
      if (assignment.targetType !== "story" && assignment.targetType !== "gate") {
        throw new Error("assignment_update_target_type_denied");
      }
      const story = this.resolveWorkLoopStory(assignment.targetType, assignment.targetId);
      const scope = this.requireWorkLoopScope(story, input);
      if (input.runId && !assignment.runIds.includes(input.runId)) {
        throw new Error("assignment_update_run_reference_not_in_assignment");
      }
      if (input.evidenceId && !this.evidenceBelongsToStory(input.evidenceId, story)) {
        throw new Error("assignment_update_evidence_reference_not_in_scope");
      }
      assignment.status = input.status;
      this.persistCoreRecord("assignment", assignment);
      const audit = this.appendAudit(actor, "assignment.update", "assignment", assignment.id, input.status === "blocked" ? "blocked" : "accepted", {
        fromStatus: input.priorStatus,
        toStatus: input.status,
        hasRunReference: Boolean(input.runId),
        hasEvidenceReference: Boolean(input.evidenceId)
      });
      return { assignment: { ...assignment, runIds: [...assignment.runIds] }, auditEventId: audit.id, scope };
    });
  }

  recordAgentRun(input: Omit<AgentRun, "id">, actor: ActorIdentity): AgentRun {
    return this.withPersistenceTransaction(() => {
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
      this.persistCoreRecord("assignment", assignment);
      this.persistCoreRecord("agentRun", run);
      this.appendAudit(actor, "agent_run.record", "run", run.id, "accepted", {
        assignmentId: run.assignmentId,
        status: run.status
      });
      return run;
    });
  }

  updateGateStatus(gateId: string, status: GateWorkOrder["status"], actor: ActorIdentity, blocker?: string): GateWorkOrder {
    return this.withPersistenceTransaction(() => {
      const gate = this.gates.get(gateId);
      if (!gate) {
        throw new Error(`Unknown gate: ${gateId}`);
      }
      gate.status = status;
      if (blocker) {
        gate.blocker = blocker;
      }
      this.persistCoreRecord("gate", gate);
      this.appendAudit(actor, "gate.status.update", "gate", gate.id, status === "blocked" ? "blocked" : "accepted", {
        status,
        blocker: blocker ?? null
      });
      return gate;
    });
  }

  recordGateDecision(input: GateDecisionRecordInput, actor: ActorIdentity): { gate: GateWorkOrder; auditEventId: string; scope: { initiativeId: string; epicId: string; storyId: string } } {
    return this.withPersistenceTransaction(() => {
      this.hydrateFromPersistence();
      this.ensureSafe(input, "gateDecisionRecord");
      const gate = this.gates.get(input.gateId);
      if (!gate) {
        throw new Error("gate_decision_unknown_gate");
      }
      const story = this.requireStory(gate.linkedTicketId);
      const scope = this.requireWorkLoopScope(story, input);
      if (terminalGateStatuses.includes(gate.status)) {
        throw new Error("gate_decision_terminal_status_denied");
      }
      if (gate.status !== input.priorStatus) {
        throw new Error("gate_decision_stale_status");
      }
      if (!this.canRecordGateDecision(actor, gate, input.decision)) {
        throw new Error("gate_decision_role_mismatch");
      }
      const evidenceIds = input.evidenceIds ?? [];
      this.assertGateDecisionEvidence(gate, input.decision, evidenceIds);
      const decision: NonNullable<GateWorkOrder["decision"]> = {
        id: createId("decision", {
          gateId: gate.id,
          decision: input.decision,
          actor: actor.employeeId,
          evidenceIds
        }),
        decisionClass: input.decision === "blocked"
          ? "blocked"
          : input.decision === "owner_intent_required"
            ? "owner_intent_required"
            : "role_decision",
        actor,
        summary: `phase3_gate_decision:${input.decision}`,
        evidenceIds,
        createdAt: now()
      };
      gate.status = input.decision;
      gate.decision = decision;
      if (input.decision === "blocked") {
        gate.blocker = "phase3_gate_decision:blocked";
      }
      this.persistCoreRecord("gate", gate);
      const audit = this.appendAudit(actor, "gate.decision.record", "gate", gate.id, input.decision === "blocked" ? "blocked" : "accepted", {
        gateType: gate.type,
        decision: input.decision,
        evidenceCount: evidenceIds.length,
        ownerIntentExecution: false,
        liveDispatchAuthorized: false
      });
      return { gate: { ...gate, inputEvidenceIds: [...gate.inputEvidenceIds] }, auditEventId: audit.id, scope };
    });
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
    return this.withPersistenceTransaction(() => {
      this.ensureSafe(subTask, "subTask");
      const story = this.requireStory(storyId);
      story.subTasks.push(subTask);
      this.persistCoreRecord("story", story);
      this.persistCoreRecord("subtask", { ...subTask, storyId });
      this.appendAudit(actor, "story.subtask.add", "story", storyId, "accepted", { subTaskId: subTask.id });
      return subTask;
    });
  }

  addComment(input: Omit<StructuredComment, "id" | "createdAt" | "appendOnly">, actor: ActorIdentity): StructuredComment {
    return this.withPersistenceTransaction(() => {
      this.ensureSafe(input, "comment");
      const story = this.requireStory(input.ticketId);
      const comment: StructuredComment = {
        ...input,
        id: createId("comment", input),
        createdAt: now(),
        appendOnly: true
      };
      story.comments.push(comment);
      this.persistCoreRecord("story", story);
      this.appendAudit(actor, "comment.create", "story", story.id, "accepted", { commentId: comment.id, type: comment.type });
      return comment;
    });
  }

  linkEvidence(input: Omit<EvidenceLink, "id" | "createdAt">, actor: ActorIdentity): EvidenceLink {
    return this.withPersistenceTransaction(() => {
      this.ensureSafe(input, "evidence");
      const evidence: EvidenceLink = {
        ...input,
        id: createId("evidence", input),
        createdAt: now()
      };
      this.evidence.set(evidence.id, evidence);
      this.persistCoreRecord("evidence", evidence);
      this.appendAudit(actor, "evidence.link", "evidence", evidence.id, "accepted", {
        type: evidence.type,
        redactionState: evidence.redactionState
      });
      return evidence;
    });
  }

  requestGate(input: Omit<GateWorkOrder, "id" | "ownerRole" | "status">, actor: ActorIdentity): GateWorkOrder {
    return this.withPersistenceTransaction(() => {
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
      if (story) {
        this.persistCoreRecord("story", story);
      }
      this.persistCoreRecord("gate", gate);
      this.appendAudit(actor, "gate.request", "gate", gate.id, "accepted", {
        type: gate.type,
        ownerRole,
        status: gate.status
      });
      return gate;
    });
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

  listTickets(params: TicketListParams = {}): TicketListReadback {
    const query = normalizeTicketListParams(params);
    const cursor = decodeTicketListCursor(query.cursor, query.filterDigest, query.limit);
    const rows = this.listStories()
      .map((story) => this.createTicketListRow(story))
      .filter((row) => ticketListRowMatches(row, query.filters))
      .sort(compareTicketListRows);
    const cursorFiltered = cursor
      ? rows.filter((row) => row.updatedAt < cursor.last.updatedAt || (row.updatedAt === cursor.last.updatedAt && row.storyId > cursor.last.storyId))
      : rows;
    const pageRows = cursorFiltered.slice(0, query.limit);
    const hasMore = cursorFiltered.length > query.limit;
    return {
      ok: true,
      method: "aos.ticket.list",
      schemaVersion: TICKET_LIST_SCHEMA_VERSION,
      rowGrain: TICKET_LIST_ROW_GRAIN,
      rows: pageRows,
      page: {
        limit: query.limit,
        returnedCount: pageRows.length,
        hasMore,
        nextCursor: hasMore && pageRows.length > 0
          ? encodeTicketListCursor(pageRows[pageRows.length - 1]!, query.filterDigest, query.limit)
          : null,
        filterDigest: query.filterDigest,
        sortVersion: TICKET_LIST_SORT_VERSION
      }
    };
  }

  private createTicketListRow(story: StoryRecord): TicketListRow {
    const epic = this.epics.get(story.epicId);
    if (!epic) {
      throw new Error(`ticket_list_missing_epic:${story.epicId}`);
    }
    const initiative = this.initiatives.get(epic.initiativeId);
    if (!initiative) {
      throw new Error(`ticket_list_missing_initiative:${epic.initiativeId}`);
    }
    const assignments = [...this.assignments.values()]
      .filter((assignment) => assignment.targetType === "story" && assignment.targetId === story.id)
      .sort((left, right) => left.id.localeCompare(right.id));
    const assignmentIds = assignments.map((assignment) => assignment.id);
    const assignmentIdSet = new Set(assignmentIds);
    const runs = [...this.runs.values()]
      .filter((run) => assignmentIdSet.has(run.assignmentId))
      .sort((left, right) => (right.endedAt ?? right.startedAt).localeCompare(left.endedAt ?? left.startedAt) || left.id.localeCompare(right.id));
    const gates = [...this.gates.values()]
      .filter((gate) => gate.linkedTicketId === story.id)
      .sort((left, right) => {
        const leftAudit = latestByTimestamp(this.auditEvents.filter((event) => event.targetId === left.id));
        const rightAudit = latestByTimestamp(this.auditEvents.filter((event) => event.targetId === right.id));
        return (rightAudit?.timestamp ?? "").localeCompare(leftAudit?.timestamp ?? "") || left.id.localeCompare(right.id);
      });
    const evidenceIds = new Set<string>([
      ...story.evidenceIds,
      ...gates.flatMap((gate) => gate.inputEvidenceIds)
    ]);
    const evidence = [...evidenceIds]
      .map((evidenceId) => this.evidence.get(evidenceId))
      .filter((item): item is EvidenceLink => Boolean(item))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id));
    const targetIds = new Set<string>([
      story.id,
      ...assignmentIds,
      ...runs.map((run) => run.id),
      ...gates.map((gate) => gate.id),
      ...evidence.map((item) => item.id)
    ]);
    const auditEvents = this.auditEvents
      .filter((event) => targetIds.has(event.targetId))
      .sort((left, right) => right.timestamp.localeCompare(left.timestamp) || left.id.localeCompare(right.id));
    const latestAudit = auditEvents[0] ?? null;
    const latestGate = gates[0] ?? null;
    const latestEvidence = evidence[0] ?? null;
    const updatedAt = latestTimestamp([
      latestAudit?.timestamp,
      latestEvidence?.createdAt,
      ...runs.map((run) => run.endedAt ?? run.startedAt)
    ]);
    return {
      initiativeId: initiative.id,
      initiativeTitle: initiative.title,
      initiativeStatus: initiative.status,
      epicId: epic.id,
      epicTitle: epic.title,
      epicStatus: epic.status,
      storyId: story.id,
      storyTitle: story.title,
      storyStatus: story.status,
      updatedAt,
      subtaskSummaries: story.subTasks.map((subtask) => ({
        id: subtask.id,
        title: subtask.title,
        status: subtask.status,
        ownerRole: subtask.ownerRole
      })),
      assignmentIds,
      assigneeEmployeeIds: unique(assignments.map((assignment) => assignment.employeeId)).sort((left, right) => left.localeCompare(right)),
      runReferences: runs.map((run) => compactRunReference(run)),
      latestGate: latestGate
        ? {
            id: latestGate.id,
            type: latestGate.type,
            status: latestGate.status,
            auditTimestamp: latestByTimestamp(auditEvents.filter((event) => event.targetId === latestGate.id))?.timestamp ?? null
          }
        : null,
      latestEvidence: latestEvidence
        ? {
            id: latestEvidence.id,
            type: latestEvidence.type,
            redactionState: latestEvidence.redactionState,
            ...(latestEvidence.digest ? { digest: latestEvidence.digest } : {}),
            timestamp: latestEvidence.createdAt
          }
        : null,
      latestAudit: latestAudit
        ? {
            id: latestAudit.id,
            action: latestAudit.action,
            outcome: latestAudit.outcome,
            timestamp: latestAudit.timestamp
          }
        : null,
      auditCount: auditEvents.length
    };
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
    rejectExecutionClaims(input as Record<string, unknown>, ["packageMutationExecuted"], "dependency record");
    this.requireProject(input.projectId);
    const dependency: DependencyLifecycleRecord = {
      ...input,
      id: createId("dependency", input),
      linkedGateIds: [],
      packageMutationExecuted: false
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
    rejectExecutionClaims(input as Record<string, unknown>, ["materializationExecuted", "productRepoWriteExecuted"], "resource record");
    if (input.projectId) {
      this.requireProject(input.projectId);
    }
    const resource: ResourceRegistryRecord = {
      ...input,
      id: createId("resource", input),
      projectManifestRefs: [],
      linkedGateIds: [],
      materializationExecuted: false,
      productRepoWriteExecuted: false
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
    rejectExecutionClaims(input as Record<string, unknown>, ["remediationExecuted", "packageMutationExecuted"], "dependency detection finding");
    this.requireProject(input.projectId);
    this.requireDependency(input.dependencyId);
    const finding: DependencyDetectionFinding = {
      ...input,
      id: createId("dependency_finding", input),
      remediationExecuted: false,
      packageMutationExecuted: false
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
    rejectExecutionClaims(input as Record<string, unknown>, ["materializationExecuted", "productRepoWriteExecuted"], "resource materialization request");
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
    rejectExecutionClaims(input as Record<string, unknown>, ["liveCopyCreated", "productRepoWriteExecuted"], "project resource manifest");
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
    rejectExecutionClaims(input as Record<string, unknown>, ["scannerIngestionExecuted", "materializationExecuted", "productRepoMutationExecuted"], "resource audit finding");
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

  createResourceMaterializationHistory(input: Omit<ResourceMaterializationHistoryRecord, "id" | "recordedAt" | "materializationExecuted" | "resourceBinaryTransferred" | "productRepoWriteExecuted">, actor: ActorIdentity): ResourceMaterializationHistoryRecord {
    this.ensureSafe(input, "resourceMaterializationHistory");
    rejectExecutionClaims(input as Record<string, unknown>, ["materializationExecuted", "resourceBinaryTransferred", "productRepoWriteExecuted"], "resource materialization history");
    this.requireProject(input.projectId);
    this.requireProject(input.targetProjectId);
    this.requireResource(input.resourceId);
    this.requireMaterializationRequest(input.materializationRequestId);
    this.requireResourceManifest(input.manifestId);
    const history: ResourceMaterializationHistoryRecord = {
      ...input,
      id: createId("resource_materialization_history", input),
      recordedAt: now(),
      materializationExecuted: false,
      resourceBinaryTransferred: false,
      productRepoWriteExecuted: false
    };
    this.resourceMaterializationHistory.set(history.id, history);
    this.appendAudit(actor, "resource.materialization_history.record", "resource_materialization_history", history.id, history.lifecycleState === "blocked" ? "blocked" : "accepted", {
      resourceId: history.resourceId,
      manifestId: history.manifestId,
      lifecycleState: history.lifecycleState,
      materializationExecuted: history.materializationExecuted,
      resourceBinaryTransferred: history.resourceBinaryTransferred,
      productRepoWriteExecuted: history.productRepoWriteExecuted
    });
    return history;
  }

  createResourceUpdateRequest(input: Omit<ResourceUpdateRequest, "id" | "ownerIntentRequired" | "updateExecuted" | "resourceBinaryTransferred" | "productRepoWriteExecuted">, actor: ActorIdentity): ResourceUpdateRequest {
    this.ensureSafe(input, "resourceUpdateRequest");
    rejectExecutionClaims(input as Record<string, unknown>, ["updateExecuted", "resourceBinaryTransferred", "productRepoWriteExecuted"], "resource update request");
    this.requireProject(input.projectId);
    this.requireResource(input.resourceId);
    this.requireResourceManifest(input.manifestId);
    if (input.linkedGateId) {
      this.requireGate(input.linkedGateId);
    }
    const request: ResourceUpdateRequest = {
      ...input,
      id: createId("resource_update_request", input),
      ownerIntentRequired: true,
      updateExecuted: false,
      resourceBinaryTransferred: false,
      productRepoWriteExecuted: false
    };
    this.resourceUpdateRequests.set(request.id, request);
    this.appendAudit(actor, "resource.update.request", "resource_update_request", request.id, request.status === "blocked" ? "blocked" : "accepted", {
      resourceId: request.resourceId,
      manifestId: request.manifestId,
      status: request.status,
      ownerIntentRequired: request.ownerIntentRequired,
      updateExecuted: request.updateExecuted,
      resourceBinaryTransferred: request.resourceBinaryTransferred,
      productRepoWriteExecuted: request.productRepoWriteExecuted
    });
    return request;
  }

  createResourceReplacementRequest(input: Omit<ResourceReplacementRequest, "id" | "ownerIntentRequired" | "replacementExecuted" | "resourceBinaryTransferred" | "productRepoWriteExecuted">, actor: ActorIdentity): ResourceReplacementRequest {
    this.ensureSafe(input, "resourceReplacementRequest");
    rejectExecutionClaims(input as Record<string, unknown>, ["replacementExecuted", "resourceBinaryTransferred", "productRepoWriteExecuted"], "resource replacement request");
    this.requireProject(input.projectId);
    this.requireResource(input.oldResourceId);
    this.requireResource(input.replacementResourceId);
    input.linkedGateIds.forEach((gateId) => this.requireGate(gateId));
    const request: ResourceReplacementRequest = {
      ...input,
      id: createId("resource_replacement_request", input),
      ownerIntentRequired: true,
      replacementExecuted: false,
      resourceBinaryTransferred: false,
      productRepoWriteExecuted: false
    };
    this.resourceReplacementRequests.set(request.id, request);
    this.appendAudit(actor, "resource.replacement.request", "resource_replacement_request", request.id, request.status === "blocked" ? "blocked" : "accepted", {
      oldResourceId: request.oldResourceId,
      replacementResourceId: request.replacementResourceId,
      status: request.status,
      ownerIntentRequired: request.ownerIntentRequired,
      replacementExecuted: request.replacementExecuted,
      resourceBinaryTransferred: request.resourceBinaryTransferred,
      productRepoWriteExecuted: request.productRepoWriteExecuted
    });
    return request;
  }

  createResourceRollbackRequest(input: Omit<ResourceRollbackRequest, "id" | "ownerIntentRequired" | "rollbackExecuted" | "cleanupExecuted" | "productRepoWriteExecuted">, actor: ActorIdentity): ResourceRollbackRequest {
    this.ensureSafe(input, "resourceRollbackRequest");
    rejectExecutionClaims(input as Record<string, unknown>, ["rollbackExecuted", "cleanupExecuted", "productRepoWriteExecuted"], "resource rollback request");
    this.requireProject(input.projectId);
    this.requireResource(input.resourceId);
    this.requireResourceManifest(input.manifestId);
    if (input.intendedPreviousManifestId) {
      this.requireResourceManifest(input.intendedPreviousManifestId);
    }
    if (input.requiredGateId) {
      this.requireGate(input.requiredGateId);
    }
    const request: ResourceRollbackRequest = {
      ...input,
      id: createId("resource_rollback_request", input),
      ownerIntentRequired: true,
      rollbackExecuted: false,
      cleanupExecuted: false,
      productRepoWriteExecuted: false
    };
    this.resourceRollbackRequests.set(request.id, request);
    this.appendAudit(actor, "resource.rollback.request", "resource_rollback_request", request.id, request.status === "blocked" ? "blocked" : "accepted", {
      resourceId: request.resourceId,
      manifestId: request.manifestId,
      status: request.status,
      ownerIntentRequired: request.ownerIntentRequired,
      rollbackExecuted: request.rollbackExecuted,
      cleanupExecuted: request.cleanupExecuted,
      productRepoWriteExecuted: request.productRepoWriteExecuted
    });
    return request;
  }

  createResourceRollbackPlan(input: Omit<ResourceRollbackPlan, "id" | "ownerIntentRequired" | "rollbackExecuted" | "cleanupExecuted" | "productRepoWriteExecuted">, actor: ActorIdentity): ResourceRollbackPlan {
    this.ensureSafe(input, "resourceRollbackPlan");
    rejectExecutionClaims(input as Record<string, unknown>, ["rollbackExecuted", "cleanupExecuted", "productRepoWriteExecuted"], "resource rollback plan");
    this.requireProject(input.projectId);
    this.requireResourceRollbackRequest(input.rollbackRequestId);
    const plan: ResourceRollbackPlan = {
      ...input,
      id: createId("resource_rollback_plan", input),
      ownerIntentRequired: true,
      rollbackExecuted: false,
      cleanupExecuted: false,
      productRepoWriteExecuted: false
    };
    this.resourceRollbackPlans.set(plan.id, plan);
    this.appendAudit(actor, "resource.rollback_plan.record", "resource_rollback_plan", plan.id, "accepted", {
      rollbackRequestId: plan.rollbackRequestId,
      ownerIntentRequired: plan.ownerIntentRequired,
      rollbackExecuted: plan.rollbackExecuted,
      cleanupExecuted: plan.cleanupExecuted,
      productRepoWriteExecuted: plan.productRepoWriteExecuted
    });
    return plan;
  }

  createResourceRetirementRecord(input: Omit<ResourceRetirementRecord, "id" | "ownerIntentRequired" | "retirementCleanupExecuted" | "productRepoDeleteExecuted">, actor: ActorIdentity): ResourceRetirementRecord {
    this.ensureSafe(input, "resourceRetirementRecord");
    rejectExecutionClaims(input as Record<string, unknown>, ["retirementCleanupExecuted", "productRepoDeleteExecuted"], "resource retirement record");
    this.requireProject(input.projectId);
    this.requireResource(input.resourceId);
    if (input.manifestId) {
      this.requireResourceManifest(input.manifestId);
    }
    const retirement: ResourceRetirementRecord = {
      ...input,
      id: createId("resource_retirement", input),
      ownerIntentRequired: true,
      retirementCleanupExecuted: false,
      productRepoDeleteExecuted: false
    };
    this.resourceRetirements.set(retirement.id, retirement);
    this.appendAudit(actor, "resource.retirement.record", "resource_retirement", retirement.id, retirement.status === "blocked" ? "blocked" : "accepted", {
      resourceId: retirement.resourceId,
      status: retirement.status,
      cleanupRequired: retirement.cleanupRequired,
      ownerIntentRequired: retirement.ownerIntentRequired,
      retirementCleanupExecuted: retirement.retirementCleanupExecuted,
      productRepoDeleteExecuted: retirement.productRepoDeleteExecuted
    });
    return retirement;
  }

  createResourceCleanupReadback(input: Omit<ResourceCleanupReadback, "id" | "ownerIntentRequired" | "cleanupExecuted" | "deleteExecuted" | "productRepoWriteExecuted">, actor: ActorIdentity): ResourceCleanupReadback {
    this.ensureSafe(input, "resourceCleanupReadback");
    rejectExecutionClaims(input as Record<string, unknown>, ["cleanupExecuted", "deleteExecuted", "productRepoWriteExecuted"], "resource cleanup readback");
    this.requireProject(input.projectId);
    const readback: ResourceCleanupReadback = {
      ...input,
      id: createId("resource_cleanup_readback", input),
      ownerIntentRequired: true,
      cleanupExecuted: false,
      deleteExecuted: false,
      productRepoWriteExecuted: false
    };
    this.resourceCleanupReadbacks.set(readback.id, readback);
    this.appendAudit(actor, "resource.cleanup_readback.record", "resource_cleanup_readback", readback.id, readback.status === "blocked" ? "blocked" : "accepted", {
      targetType: readback.targetType,
      targetId: readback.targetId,
      cleanupNeeded: readback.cleanupNeeded,
      status: readback.status,
      ownerIntentRequired: readback.ownerIntentRequired,
      cleanupExecuted: readback.cleanupExecuted,
      deleteExecuted: readback.deleteExecuted,
      productRepoWriteExecuted: readback.productRepoWriteExecuted
    });
    return readback;
  }

  createResourceMaterializationControlIndex(projectId: ProjectId): ResourceMaterializationControlIndexReadback {
    this.requireProject(projectId);
    const histories = [...this.resourceMaterializationHistory.values()].filter((record) => record.projectId === projectId || record.targetProjectId === projectId);
    const updates = [...this.resourceUpdateRequests.values()].filter((request) => request.projectId === projectId);
    const replacements = [...this.resourceReplacementRequests.values()].filter((request) => request.projectId === projectId);
    const rollbacks = [...this.resourceRollbackRequests.values()].filter((request) => request.projectId === projectId);
    const plans = [...this.resourceRollbackPlans.values()].filter((plan) => plan.projectId === projectId);
    const retirements = [...this.resourceRetirements.values()].filter((record) => record.projectId === projectId);
    const cleanupReadbacks = [...this.resourceCleanupReadbacks.values()].filter((readback) => readback.projectId === projectId);
    return {
      projectId,
      historyRecordIds: histories.map((record) => record.id),
      updateRequestIds: updates.map((request) => request.id),
      replacementRequestIds: replacements.map((request) => request.id),
      rollbackRequestIds: rollbacks.map((request) => request.id),
      rollbackPlanIds: plans.map((plan) => plan.id),
      retirementRecordIds: retirements.map((record) => record.id),
      cleanupReadbackIds: cleanupReadbacks.map((readback) => readback.id),
      unresolvedUpdateIds: updates.filter((request) => request.status !== "superseded").map((request) => request.id),
      unresolvedReplacementIds: replacements.filter((request) => request.status !== "superseded").map((request) => request.id),
      unresolvedRollbackIds: rollbacks.filter((request) => request.status !== "superseded").map((request) => request.id),
      cleanupBlockerIds: unique([
        ...retirements.filter((record) => record.cleanupRequired || record.status === "blocked").map((record) => record.id),
        ...cleanupReadbacks.filter((readback) => readback.cleanupNeeded || readback.status === "blocked").map((readback) => readback.id)
      ]),
      linkedGateIds: unique([
        ...updates.flatMap((request) => request.linkedGateId ? [request.linkedGateId] : []),
        ...replacements.flatMap((request) => request.linkedGateIds),
        ...rollbacks.flatMap((request) => request.requiredGateId ? [request.requiredGateId] : [])
      ]),
      linkedEvidenceIds: unique([
        ...histories.flatMap((record) => record.evidenceIds),
        ...updates.flatMap((request) => request.evidenceIds),
        ...replacements.flatMap((request) => request.evidenceIds),
        ...rollbacks.flatMap((request) => request.evidenceIds),
        ...plans.flatMap((plan) => plan.evidenceIds),
        ...retirements.flatMap((record) => record.evidenceIds),
        ...cleanupReadbacks.flatMap((readback) => readback.evidenceIds)
      ]),
      localFirstStorage: true,
      materializationExecuted: false,
      updateExecuted: false,
      replacementExecuted: false,
      rollbackExecuted: false,
      cleanupExecuted: false,
      deleteExecuted: false,
      resourceBinaryTransferred: false,
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

  createDocsReadinessRecord(input: Omit<DocsReadinessRecord, "id" | "docsPublished" | "gitExportExecuted" | "canonicalKnowledgePromoted" | "publicReadinessClaimed" | "releaseReadyClaimed" | "localFirstStorage">, actor: ActorIdentity): DocsReadinessRecord {
    this.ensureSafe(input, "docsReadiness");
    rejectExecutionClaims(input as Record<string, unknown>, ["docsPublished", "gitExportExecuted", "canonicalKnowledgePromoted", "publicReadinessClaimed", "releaseReadyClaimed"], "docs readiness record");
    this.requireProject(input.projectId);
    this.requireDocumentationTarget(input.targetType, input.targetId, input.projectId);
    input.linkedStoryIds.forEach((storyId) => this.requireStory(storyId));
    input.linkedGateIds.forEach((gateId) => this.requireGate(gateId));
    input.linkedEvidenceIds.forEach((evidenceId) => this.requireEvidence(evidenceId));
    if (!this.initiatives.has(input.stageMapContext.initiativeId)) {
      throw new Error(`Unknown initiative: ${input.stageMapContext.initiativeId}`);
    }
    const record: DocsReadinessRecord = {
      ...input,
      id: createId("docs_readiness", input),
      docsPublished: false,
      gitExportExecuted: false,
      canonicalKnowledgePromoted: false,
      publicReadinessClaimed: false,
      releaseReadyClaimed: false,
      localFirstStorage: true
    };
    this.docsReadiness.set(record.id, record);
    this.appendAudit(actor, "docs.readiness.record", "docs_readiness", record.id, record.readinessState === "blocked" ? "blocked" : "accepted", {
      projectId: record.projectId,
      targetType: record.targetType,
      readinessState: record.readinessState,
      blockerCount: record.blockers.length,
      docsPublished: record.docsPublished,
      releaseReadyClaimed: record.releaseReadyClaimed
    });
    return record;
  }

  createProjectSearchIndexRecord(input: Omit<ProjectSearchIndexRecord, "id" | "visibility" | "rawPrivatePayloadIndexed" | "rawSourceIndexed" | "rawScannerOutputIndexed" | "localAbsolutePathIndexed" | "localFirstStorage">, actor: ActorIdentity): ProjectSearchIndexRecord {
    this.ensureSafe(input, "projectSearchIndex");
    rejectExecutionClaims(input as Record<string, unknown>, ["rawPrivatePayloadIndexed", "rawSourceIndexed", "rawScannerOutputIndexed", "localAbsolutePathIndexed"], "project search index record");
    this.requireProject(input.projectId);
    this.requireSearchSource(input.sourceType, input.sourceId);
    input.linkedStoryIds.forEach((storyId) => this.requireStory(storyId));
    input.linkedGateIds.forEach((gateId) => this.requireGate(gateId));
    input.linkedEvidenceIds.forEach((evidenceId) => this.requireEvidence(evidenceId));
    const record: ProjectSearchIndexRecord = {
      ...input,
      id: createId("project_search_index", input),
      visibility: "metadata_only",
      rawPrivatePayloadIndexed: false,
      rawSourceIndexed: false,
      rawScannerOutputIndexed: false,
      localAbsolutePathIndexed: false,
      localFirstStorage: true
    };
    this.searchIndexRecords.set(record.id, record);
    this.appendAudit(actor, "docs.search.index", "project_search_index", record.id, "accepted", {
      projectId: record.projectId,
      sourceType: record.sourceType,
      termCount: record.sanitizedTerms.length,
      visibility: record.visibility,
      rawSourceIndexed: record.rawSourceIndexed
    });
    return record;
  }

  createGitHubMetadataReadback(input: Omit<GitHubMetadataReadback, "id" | "githubWriteExecuted" | "releaseCreated" | "ciStatusMutated" | "releaseReadyClaimed" | "localFirstStorage">, actor: ActorIdentity): GitHubMetadataReadback {
    this.ensureSafe(input, "githubMetadataReadback");
    rejectExecutionClaims(input as Record<string, unknown>, ["githubWriteExecuted", "releaseCreated", "ciStatusMutated", "releaseReadyClaimed"], "github metadata readback");
    this.requireProject(input.projectId);
    const readback: GitHubMetadataReadback = {
      ...input,
      id: createId("github_metadata", input),
      githubWriteExecuted: false,
      releaseCreated: false,
      ciStatusMutated: false,
      releaseReadyClaimed: false,
      localFirstStorage: true
    };
    this.githubMetadata.set(readback.id, readback);
    this.appendAudit(actor, "github.metadata.record", "github_metadata", readback.id, readback.readbackState === "blocked" ? "blocked" : "accepted", {
      projectId: readback.projectId,
      repositoryName: readback.repositoryName,
      readbackState: readback.readbackState,
      githubWriteExecuted: readback.githubWriteExecuted,
      releaseCreated: readback.releaseCreated
    });
    return readback;
  }

  createPrCiStoryReadiness(input: Omit<PrCiStoryReadinessLinkage, "id" | "githubWriteExecuted" | "ciStatusMutated" | "releaseReadyClaimed" | "localFirstStorage">, actor: ActorIdentity): PrCiStoryReadinessLinkage {
    this.ensureSafe(input, "prCiStoryReadiness");
    rejectExecutionClaims(input as Record<string, unknown>, ["githubWriteExecuted", "ciStatusMutated", "releaseReadyClaimed"], "PR/CI story readiness linkage");
    this.requireProject(input.projectId);
    this.requireStory(input.storyId);
    this.requireGitHubMetadata(input.githubMetadataId);
    input.linkedEvidenceIds.forEach((evidenceId) => this.requireEvidence(evidenceId));
    const linkage: PrCiStoryReadinessLinkage = {
      ...input,
      id: createId("pr_ci_story_readiness", input),
      githubWriteExecuted: false,
      ciStatusMutated: false,
      releaseReadyClaimed: false,
      localFirstStorage: true
    };
    this.prCiReadiness.set(linkage.id, linkage);
    this.appendAudit(actor, "pr_ci.story_readiness.record", "pr_ci_story_readiness", linkage.id, linkage.readinessState === "blocked" ? "blocked" : "accepted", {
      projectId: linkage.projectId,
      storyId: linkage.storyId,
      pullRequestState: linkage.pullRequestState,
      ciState: linkage.ciState,
      releaseReadyClaimed: linkage.releaseReadyClaimed
    });
    return linkage;
  }

  createReleaseCandidateLinkage(input: Omit<ReleaseCandidateLinkage, "id" | "releaseCreated" | "githubWriteExecuted" | "deploymentExecuted" | "productAccepted" | "finalMvpAccepted" | "releaseReadyClaimed" | "publicReadinessClaimed" | "legalCompletionClaimed" | "dependencyCleanClaimed" | "localFirstStorage">, actor: ActorIdentity): ReleaseCandidateLinkage {
    this.ensureSafe(input, "releaseCandidateLinkage");
    rejectExecutionClaims(input as Record<string, unknown>, ["releaseCreated", "githubWriteExecuted", "deploymentExecuted", "productAccepted", "finalMvpAccepted", "releaseReadyClaimed", "publicReadinessClaimed", "legalCompletionClaimed", "dependencyCleanClaimed"], "release candidate linkage");
    this.requireProject(input.projectId);
    input.storyIds.forEach((storyId) => this.requireStory(storyId));
    input.docsReadinessRecordIds.forEach((readinessId) => this.requireDocsReadinessRecord(readinessId));
    input.releaseNoteItemIds.forEach((releaseNoteId) => this.requireReleaseNote(releaseNoteId));
    input.evidenceIds.forEach((evidenceId) => this.requireEvidence(evidenceId));
    input.dependencyBlockerIds.forEach((dependencyId) => this.requireDependency(dependencyId));
    input.resourceBlockerIds.forEach((resourceId) => this.requireResource(resourceId));
    input.gateIds.forEach((gateId) => this.requireGate(gateId));
    input.githubMetadataIds.forEach((metadataId) => this.requireGitHubMetadata(metadataId));
    input.prCiReadinessIds.forEach((readinessId) => this.requirePrCiReadiness(readinessId));
    const linkage: ReleaseCandidateLinkage = {
      ...input,
      id: createId("release_candidate_linkage", input),
      releaseCreated: false,
      githubWriteExecuted: false,
      deploymentExecuted: false,
      productAccepted: false,
      finalMvpAccepted: false,
      releaseReadyClaimed: false,
      publicReadinessClaimed: false,
      legalCompletionClaimed: false,
      dependencyCleanClaimed: false,
      localFirstStorage: true
    };
    this.releaseCandidates.set(linkage.id, linkage);
    this.appendAudit(actor, "release_candidate.linkage.record", "release_candidate", linkage.id, linkage.status === "blocked" || linkage.status === "not_ready_for_release" ? "blocked" : "accepted", {
      projectId: linkage.projectId,
      releaseCandidateLabel: linkage.releaseCandidateLabel,
      status: linkage.status,
      releaseCreated: linkage.releaseCreated,
      releaseReadyClaimed: linkage.releaseReadyClaimed,
      blockerCount: linkage.dependencyBlockerIds.length + linkage.resourceBlockerIds.length
    });
    return linkage;
  }

  createDocsSearchReleaseLinkageIndex(projectId: ProjectId): DocsSearchReleaseLinkageIndexReadback {
    this.requireProject(projectId);
    const readiness = [...this.docsReadiness.values()].filter((record) => record.projectId === projectId);
    const search = [...this.searchIndexRecords.values()].filter((record) => record.projectId === projectId);
    const github = [...this.githubMetadata.values()].filter((record) => record.projectId === projectId);
    const prci = [...this.prCiReadiness.values()].filter((record) => record.projectId === projectId);
    const candidates = [...this.releaseCandidates.values()].filter((record) => record.projectId === projectId);
    return {
      projectId,
      docsReadinessRecordIds: readiness.map((record) => record.id),
      searchIndexRecordIds: search.map((record) => record.id),
      githubMetadataIds: github.map((record) => record.id),
      prCiReadinessIds: prci.map((record) => record.id),
      releaseCandidateIds: candidates.map((record) => record.id),
      blockedReadinessIds: readiness.filter((record) => record.readinessState === "blocked" || record.blockers.length > 0).map((record) => record.id),
      blockedPrCiIds: prci.filter((record) => record.readinessState === "blocked" || record.blockers.length > 0 || record.pullRequestState === "blocked" || record.ciState === "blocked").map((record) => record.id),
      blockedReleaseCandidateIds: candidates.filter((record) => record.status === "blocked" || record.status === "not_ready_for_release" || record.dependencyBlockerIds.length > 0 || record.resourceBlockerIds.length > 0 || record.residualRisks.length > 0).map((record) => record.id),
      linkedStoryIds: unique([
        ...readiness.flatMap((record) => record.linkedStoryIds),
        ...search.flatMap((record) => record.linkedStoryIds),
        ...prci.map((record) => record.storyId),
        ...candidates.flatMap((record) => record.storyIds)
      ]),
      linkedEvidenceIds: unique([
        ...readiness.flatMap((record) => record.linkedEvidenceIds),
        ...search.flatMap((record) => record.linkedEvidenceIds),
        ...prci.flatMap((record) => record.linkedEvidenceIds),
        ...candidates.flatMap((record) => record.evidenceIds)
      ]),
      linkedGateIds: unique([
        ...readiness.flatMap((record) => record.linkedGateIds),
        ...search.flatMap((record) => record.linkedGateIds),
        ...candidates.flatMap((record) => record.gateIds)
      ]),
      stateCounts: countBy([
        ...readiness.map((record) => record.readinessState),
        ...prci.map((record) => record.readinessState),
        ...candidates.map((record) => record.status)
      ]),
      localFirstStorage: true,
      docsPublished: false,
      gitExportExecuted: false,
      canonicalKnowledgePromoted: false,
      githubWriteExecuted: false,
      releaseCreated: false,
      ciStatusMutated: false,
      releaseReadyClaimed: false,
      publicReadinessClaimed: false,
      deploymentExecuted: false,
      productAccepted: false,
      finalMvpAccepted: false,
      legalCompletionClaimed: false,
      dependencyCleanClaimed: false
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

  private resolveWorkLoopStory(targetType: "story" | "gate", targetId: string): StoryRecord {
    if (targetType === "story") {
      return this.requireStory(targetId);
    }
    const gate = this.requireGate(targetId);
    return this.requireStory(gate.linkedTicketId);
  }

  private requireWorkLoopScope(story: StoryRecord, input: WorkLoopScopeInput): { initiativeId: string; epicId: string; storyId: string } {
    const epic = this.epics.get(story.epicId);
    if (!epic) {
      throw new Error("work_loop_missing_epic");
    }
    const initiative = this.initiatives.get(epic.initiativeId);
    if (!initiative) {
      throw new Error("work_loop_missing_initiative");
    }
    if (epic.id !== input.epicId || initiative.id !== input.initiativeId || initiative.projectId !== "TCRN-AOS") {
      throw new Error("work_loop_scope_mismatch");
    }
    return { initiativeId: initiative.id, epicId: epic.id, storyId: story.id };
  }

  private findActiveAssignment(targetType: Assignment["targetType"], targetId: string, role: Assignment["role"]): Assignment | undefined {
    return [...this.assignments.values()].find((assignment) =>
      assignment.targetType === targetType
      && assignment.targetId === targetId
      && assignment.role === role
      && activeAssignmentStatuses.includes(assignment.status)
    );
  }

  private evidenceBelongsToStory(evidenceId: string, story: StoryRecord): boolean {
    this.requireEvidence(evidenceId);
    return story.evidenceIds.includes(evidenceId)
      || story.gateIds
        .map((gateId) => this.gates.get(gateId))
        .filter((gate): gate is GateWorkOrder => gate !== undefined)
        .some((gate) => gate.inputEvidenceIds.includes(evidenceId));
  }

  private canRecordGateDecision(actor: ActorIdentity, gate: GateWorkOrder, decision: GateDecisionRecordInput["decision"]): boolean {
    if (decision === "owner_intent_required") {
      return gate.type === "owner_intent" && actor.role === "owner_intent_submitter";
    }
    return canApproveGate(actor, gate.type) || actor.role === gate.ownerRole;
  }

  private assertGateDecisionEvidence(gate: GateWorkOrder, decision: GateDecisionRecordInput["decision"], evidenceIds: string[]): void {
    if (decision === "owner_intent_required" && gate.type !== "owner_intent") {
      throw new Error("gate_decision_owner_intent_requirement_incompatible");
    }
    for (const evidenceId of evidenceIds) {
      const evidence = this.requireEvidence(evidenceId);
      if (!gate.inputEvidenceIds.includes(evidenceId) || evidence.validity !== "valid" || evidence.redactionState === "restricted") {
        throw new Error("gate_decision_incompatible_evidence");
      }
    }
    if (decision === "accepted" && gate.inputEvidenceIds.length > 0 && !gate.inputEvidenceIds.every((evidenceId) => evidenceIds.includes(evidenceId))) {
      throw new Error("gate_decision_required_evidence_missing");
    }
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

  private requireMaterializationRequest(requestId: string): ResourceMaterializationRequest {
    const request = this.materializationRequests.get(requestId);
    if (!request) {
      throw new Error(`Unknown materialization request: ${requestId}`);
    }
    return request;
  }

  private requireResourceManifest(manifestId: string): ProjectResourceManifestRecord {
    const manifest = this.resourceManifests.get(manifestId);
    if (!manifest) {
      throw new Error(`Unknown resource manifest: ${manifestId}`);
    }
    return manifest;
  }

  private requireResourceRollbackRequest(requestId: string): ResourceRollbackRequest {
    const request = this.resourceRollbackRequests.get(requestId);
    if (!request) {
      throw new Error(`Unknown rollback request: ${requestId}`);
    }
    return request;
  }

  private requireEvidence(evidenceId: string): EvidenceLink {
    const evidence = this.evidence.get(evidenceId);
    if (!evidence) {
      throw new Error(`Unknown evidence: ${evidenceId}`);
    }
    return evidence;
  }

  private requireKnowledgeEntry(entryId: string): KnowledgeEntry {
    const entry = this.knowledge.get(entryId);
    if (!entry) {
      throw new Error(`Unknown knowledge entry: ${entryId}`);
    }
    return entry;
  }

  private requireUserGuideDraft(guideId: string): UserGuidePageDraft {
    const guide = this.userGuideDrafts.get(guideId);
    if (!guide) {
      throw new Error(`Unknown guide draft: ${guideId}`);
    }
    return guide;
  }

  private requireReleaseNote(releaseNoteId: string): ReleaseNoteRecord {
    const note = this.releaseNotes.get(releaseNoteId);
    if (!note) {
      throw new Error(`Unknown release note: ${releaseNoteId}`);
    }
    return note;
  }

  private requireDocsReadinessRecord(readinessId: string): DocsReadinessRecord {
    const record = this.docsReadiness.get(readinessId);
    if (!record) {
      throw new Error(`Unknown docs readiness record: ${readinessId}`);
    }
    return record;
  }

  private requireGitHubMetadata(metadataId: string): GitHubMetadataReadback {
    const metadata = this.githubMetadata.get(metadataId);
    if (!metadata) {
      throw new Error(`Unknown GitHub metadata readback: ${metadataId}`);
    }
    return metadata;
  }

  private requirePrCiReadiness(readinessId: string): PrCiStoryReadinessLinkage {
    const record = this.prCiReadiness.get(readinessId);
    if (!record) {
      throw new Error(`Unknown PR/CI readiness record: ${readinessId}`);
    }
    return record;
  }

  private requireDocumentationTarget(targetType: DocsReadinessRecord["targetType"], targetId: string, projectId: ProjectId): void {
    if (targetType === "knowledge") {
      this.requireKnowledgeEntry(targetId);
      return;
    }
    if (targetType === "guide") {
      this.requireUserGuideDraft(targetId);
      return;
    }
    if (targetType === "release_note") {
      this.requireReleaseNote(targetId);
      return;
    }
    if (targetType === "documentation_index" && targetId === projectId) {
      return;
    }
    throw new Error(`Unknown documentation target: ${targetType}:${targetId}`);
  }

  private requireSearchSource(sourceType: ProjectSearchIndexRecord["sourceType"], sourceId: string): void {
    if (sourceType === "knowledge") {
      this.requireKnowledgeEntry(sourceId);
      return;
    }
    if (sourceType === "guide") {
      this.requireUserGuideDraft(sourceId);
      return;
    }
    if (sourceType === "release_note") {
      this.requireReleaseNote(sourceId);
      return;
    }
    if (sourceType === "evidence") {
      this.requireEvidence(sourceId);
      return;
    }
    if (sourceType === "gate") {
      this.requireGate(sourceId);
      return;
    }
    if (sourceType === "story") {
      this.requireStory(sourceId);
      return;
    }
    if (sourceType === "github_metadata") {
      this.requireGitHubMetadata(sourceId);
      return;
    }
    if (sourceType === "release_candidate") {
      const candidate = this.releaseCandidates.get(sourceId);
      if (candidate) {
        return;
      }
    }
    throw new Error(`Unknown search source: ${sourceType}:${sourceId}`);
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
    this.persistence?.appendAuditEvent(event);
    return event;
  }

  private hydrateFromPersistence(): void {
    const snapshot = this.persistence?.hydrateCore();
    if (!snapshot) {
      return;
    }
    snapshot.projects?.forEach((project) => this.projects.set(project.id, project));
    snapshot.employees?.forEach((employee) => this.employees.set(employee.id, employee));
    snapshot.initiatives?.forEach((initiative) => this.initiatives.set(initiative.id, initiative));
    snapshot.epics?.forEach((epic) => this.epics.set(epic.id, epic));
    snapshot.stories?.forEach((story) => this.stories.set(story.id, story));
    snapshot.assignments?.forEach((assignment) => this.assignments.set(assignment.id, assignment));
    snapshot.runs?.forEach((run) => this.runs.set(run.id, run));
    snapshot.gates?.forEach((gate) => this.gates.set(gate.id, gate));
    snapshot.evidence?.forEach((evidence) => this.evidence.set(evidence.id, evidence));
    if (snapshot.auditEvents) {
      this.auditEvents = snapshot.auditEvents.map((event) => Object.freeze(event));
    }
  }

  private withPersistenceTransaction<T>(operation: () => T): T {
    return this.persistence ? this.persistence.runInTransaction(operation) : operation();
  }

  private persistCoreRecord(kind: AosCorePersistenceKind, record: unknown): void {
    this.persistence?.saveCoreRecord(kind, record);
  }
}

export function now(): string {
  return new Date().toISOString();
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

const TICKET_LIST_SCHEMA_VERSION = "aos.ticket.list.v1";
const TICKET_LIST_ROW_GRAIN = "story";
const TICKET_LIST_SORT_VERSION = "updated-desc-story-id-asc-v1";
const TICKET_LIST_DEFAULT_LIMIT = 5;
const TICKET_LIST_MAX_LIMIT = 20;
const ticketListAllowedKeys = new Set([
  "initiativeId",
  "epicId",
  "storyId",
  "status",
  "assigneeEmployeeId",
  "limit",
  "cursor",
  "idempotencyKey"
]);
const workStatuses = new Set([
  "proposed",
  "accepted",
  "in_progress",
  "blocked",
  "in_review",
  "verified",
  "released",
  "archived",
  "superseded"
]);

interface NormalizedTicketListParams {
  filters: {
    initiativeId?: string | undefined;
    epicId?: string | undefined;
    storyId?: string | undefined;
    status?: TicketListParams["status"] | undefined;
    assigneeEmployeeId?: string | undefined;
  };
  limit: number;
  cursor?: string | undefined;
  filterDigest: string;
}

interface DecodedTicketListCursor {
  schemaVersion: typeof TICKET_LIST_SCHEMA_VERSION;
  rowGrain: typeof TICKET_LIST_ROW_GRAIN;
  sortVersion: typeof TICKET_LIST_SORT_VERSION;
  filterDigest: string;
  limit: number;
  last: {
    updatedAt: string;
    storyId: string;
  };
}

function normalizeTicketListParams(params: TicketListParams): NormalizedTicketListParams {
  const unsupported = Object.keys(params)
    .filter((key) => !ticketListAllowedKeys.has(key) && (params as Record<string, unknown>)[key] !== undefined)
    .sort((left, right) => left.localeCompare(right));
  if (unsupported.length > 0) {
    throw new Error(`unsupported_ticket_list_filter:${unsupported.join(",")}`);
  }
  const status = optionalTicketFilter(params.status, "status") as TicketListParams["status"] | undefined;
  if (status && !workStatuses.has(status)) {
    throw new Error("invalid_ticket_list_filter:status");
  }
  const filters = compactTicketListFilters({
    initiativeId: optionalTicketFilter(params.initiativeId, "initiativeId"),
    epicId: optionalTicketFilter(params.epicId, "epicId"),
    storyId: optionalTicketFilter(params.storyId, "storyId"),
    status,
    assigneeEmployeeId: optionalTicketFilter(params.assigneeEmployeeId, "assigneeEmployeeId")
  });
  const limit = normalizeTicketListLimit(params.limit);
  const cursor = params.cursor === undefined || params.cursor === null
    ? undefined
    : optionalTicketFilter(params.cursor, "cursor");
  return {
    filters,
    limit,
    cursor,
    filterDigest: digest(filters)
  };
}

function optionalTicketFilter(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`invalid_ticket_list_filter:${field}`);
  }
  return value;
}

function normalizeTicketListLimit(value: unknown): number {
  if (value === undefined || value === null) {
    return TICKET_LIST_DEFAULT_LIMIT;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error("invalid_ticket_list_limit");
  }
  if (value > TICKET_LIST_MAX_LIMIT) {
    throw new Error("ticket_list_limit_exceeded");
  }
  return value;
}

function compactTicketListFilters(filters: NormalizedTicketListParams["filters"]): NormalizedTicketListParams["filters"] {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined)) as NormalizedTicketListParams["filters"];
}

function decodeTicketListCursor(value: string | undefined, expectedFilterDigest: string, expectedLimit: number): DecodedTicketListCursor | null {
  if (!value) {
    return null;
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    throw new Error("invalid_ticket_list_cursor");
  }
  if (!isTicketListCursor(decoded)) {
    throw new Error("invalid_ticket_list_cursor");
  }
  if (decoded.filterDigest !== expectedFilterDigest || decoded.limit !== expectedLimit) {
    throw new Error("ticket_list_cursor_filter_mismatch");
  }
  return decoded;
}

function isTicketListCursor(value: unknown): value is DecodedTicketListCursor {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as DecodedTicketListCursor;
  return candidate.schemaVersion === TICKET_LIST_SCHEMA_VERSION &&
    candidate.rowGrain === TICKET_LIST_ROW_GRAIN &&
    candidate.sortVersion === TICKET_LIST_SORT_VERSION &&
    typeof candidate.filterDigest === "string" &&
    typeof candidate.limit === "number" &&
    Boolean(candidate.last) &&
    typeof candidate.last.updatedAt === "string" &&
    typeof candidate.last.storyId === "string";
}

function encodeTicketListCursor(row: TicketListRow, filterDigest: string, limit: number): string {
  return Buffer.from(JSON.stringify({
    schemaVersion: TICKET_LIST_SCHEMA_VERSION,
    rowGrain: TICKET_LIST_ROW_GRAIN,
    sortVersion: TICKET_LIST_SORT_VERSION,
    filterDigest,
    limit,
    last: {
      updatedAt: row.updatedAt,
      storyId: row.storyId
    }
  }), "utf8").toString("base64url");
}

function ticketListRowMatches(row: TicketListRow, filters: NormalizedTicketListParams["filters"]): boolean {
  return (!filters.initiativeId || row.initiativeId === filters.initiativeId) &&
    (!filters.epicId || row.epicId === filters.epicId) &&
    (!filters.storyId || row.storyId === filters.storyId) &&
    (!filters.status || row.storyStatus === filters.status) &&
    (!filters.assigneeEmployeeId || row.assigneeEmployeeIds.includes(filters.assigneeEmployeeId));
}

function compareTicketListRows(left: TicketListRow, right: TicketListRow): number {
  return right.updatedAt.localeCompare(left.updatedAt) || left.storyId.localeCompare(right.storyId);
}

function compactRunReference(run: AgentRun): TicketListRow["runReferences"][number] {
  return {
    id: run.id,
    status: run.status,
    startedAt: run.startedAt,
    ...(run.endedAt ? { endedAt: run.endedAt } : {})
  };
}

function latestTimestamp(values: Array<string | undefined>): string {
  return values.filter((value): value is string => Boolean(value)).sort((left, right) => right.localeCompare(left))[0] ?? "1970-01-01T00:00:00.000Z";
}

function latestByTimestamp<T extends { timestamp: string; id: string }>(items: T[]): T | undefined {
  return [...items].sort((left, right) => right.timestamp.localeCompare(left.timestamp) || left.id.localeCompare(right.id))[0];
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function rejectExecutionClaims(value: Record<string, unknown>, fields: string[], context: string): void {
  for (const field of fields) {
    const claim = value[field];
    if (claim !== undefined && claim !== false) {
      throw new Error(`${context} rejected execution claim ${field}; value must be false or omitted`);
    }
  }
}
