import { assertNoRestrictedContent, redactForAudit } from "./security.js";
import { createId } from "./idempotency.js";
import { POLICY_VERSION, resolveGateOwner } from "./policies.js";
import type {
  AIEmployee,
  ActorIdentity,
  AgentRun,
  Assignment,
  AuditEvent,
  ConferencePosition,
  ConferenceRequest,
  DependencyLifecycleRecord,
  EpicRecord,
  EvidenceLink,
  GateWorkOrder,
  InitiativeRecord,
  KnowledgeEntry,
  OwnerIntent,
  ProjectId,
  ProjectRecord,
  ReleaseNoteRecord,
  ResourceRegistryRecord,
  StageDefinition,
  StageMapItem,
  StoryRecord,
  StructuredComment,
  SubTask
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
  private resources = new Map<string, ResourceRegistryRecord>();
  private knowledge = new Map<string, KnowledgeEntry>();
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

  createConference(input: Omit<ConferenceRequest, "id" | "status" | "positions">, actor: ActorIdentity): ConferenceRequest {
    this.ensureSafe(input, "conference");
    const conference: ConferenceRequest = {
      ...input,
      id: createId("conference", input),
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

  createDependencyRecord(input: Omit<DependencyLifecycleRecord, "id" | "linkedGateIds">, actor: ActorIdentity): DependencyLifecycleRecord {
    this.ensureSafe(input, "dependency");
    const dependency: DependencyLifecycleRecord = {
      ...input,
      id: createId("dependency", input),
      linkedGateIds: []
    };
    this.dependencies.set(dependency.id, dependency);
    this.appendAudit(actor, "dependency.record.propose", "dependency", dependency.id, "accepted", {
      posture: dependency.posture,
      evidenceStatus: dependency.evidenceStatus
    });
    return dependency;
  }

  createResourceRecord(input: Omit<ResourceRegistryRecord, "id" | "linkedGateIds" | "projectManifestRefs">, actor: ActorIdentity): ResourceRegistryRecord {
    this.ensureSafe(input, "resource");
    const resource: ResourceRegistryRecord = {
      ...input,
      id: createId("resource", input),
      projectManifestRefs: [],
      linkedGateIds: []
    };
    this.resources.set(resource.id, resource);
    this.appendAudit(actor, "resource.record.propose", "resource", resource.id, "accepted", {
      copyrightStatus: resource.copyrightStatus,
      approvalState: resource.approvalState
    });
    return resource;
  }

  createKnowledgeEntry(entry: KnowledgeEntry, actor: ActorIdentity): KnowledgeEntry {
    this.ensureSafe(entry, "knowledge");
    this.knowledge.set(entry.id, entry);
    this.appendAudit(actor, "knowledge.propose", "knowledge", entry.id, "accepted", {
      category: entry.category,
      freshness: entry.freshness
    });
    return entry;
  }

  createReleaseNote(note: ReleaseNoteRecord, actor: ActorIdentity): ReleaseNoteRecord {
    this.ensureSafe(note, "releaseNote");
    this.releaseNotes.set(note.id, note);
    this.appendAudit(actor, "release_note.draft", "release_note", note.id, "accepted", {
      release: note.release,
      status: note.status
    });
    return note;
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
