import {
  AosStore,
  POLICY_VERSION,
  canWrite,
  createId,
  idempotencyKey,
  redactForAudit,
  requiresOwnerIntent,
  scanForRestrictedContent
} from "../../domain/src/index.js";
import type {
  ActorIdentity,
  AuditEvent,
  AgentRun,
  DependencyDetectionFinding,
  DependencyLifecycleRecord,
  DocsReadinessRecord,
  GitHubMetadataReadback,
  EvidenceLink,
  GateWorkOrder,
  PrCiStoryReadinessLinkage,
  ProjectSearchIndexRecord,
  ProjectResourceManifestRecord,
  ReleaseCandidateLinkage,
  ResourceAuditFinding,
  ResourceCleanupReadback,
  ResourceMaterializationHistoryRecord,
  ResourceMaterializationRequest,
  ResourceReplacementRequest,
  ResourceRetirementRecord,
  ResourceRollbackPlan,
  ResourceRollbackRequest,
  ResourceRegistryRecord,
  ResourceUpdateRequest,
  StoryRecord,
  SubTask
} from "../../domain/src/index.js";

export const allowedMcpMethods = [
  "aos.ticket.propose",
  "aos.ticket.comment",
  "aos.run.summary.create",
  "aos.gate.request",
  "aos.evidence.link",
  "aos.policy.read",
  "aos.conference.request",
  "aos.conference.position.record",
  "aos.conference.minutes.record",
  "aos.work_index.drill_through.read",
  "aos.documentation.index.read",
  "aos.knowledge.entry.propose",
  "aos.guide.page.draft",
  "aos.release_note.item.draft",
  "aos.docs.readiness.record",
  "aos.docs.search.index",
  "aos.github.metadata.record",
  "aos.pr_ci.story_readiness.record",
  "aos.release_candidate.linkage.record",
  "aos.release_candidate.linkage.read",
  "aos.stage_map.read",
  "aos.dependency.record.propose",
  "aos.dependency.detection.record",
  "aos.dependency.governance.read",
  "aos.resource.record.propose",
  "aos.resource.materialization.request",
  "aos.resource.manifest.record",
  "aos.resource.audit_finding.record",
  "aos.resource.governance.read",
  "aos.resource.materialization_history.record",
  "aos.resource.update.request",
  "aos.resource.replacement.request",
  "aos.resource.rollback.request",
  "aos.resource.rollback_plan.record",
  "aos.resource.retirement.record",
  "aos.resource.cleanup_readback.record",
  "aos.resource.materialization_control.read",
  "aos.audit.query"
] as const;

export type AllowedMcpMethod = typeof allowedMcpMethods[number];

export interface McpRequest {
  method: string;
  actor: ActorIdentity;
  params: Record<string, unknown>;
  idempotencyKey?: string;
}

export interface McpResponse {
  ok: boolean;
  method: string;
  status: "accepted" | "blocked" | "deduped" | "read";
  result?: unknown;
  error?: string;
  auditEventId: string;
  idempotencyKey: string;
}

export class McpGateway {
  private readonly responsesByKey = new Map<string, McpResponse>();

  constructor(private readonly store: AosStore) {}

  handle(request: McpRequest): McpResponse {
    const key = request.idempotencyKey ?? idempotencyKey(request.method, request.actor.employeeId, request.params);
    const existing = this.responsesByKey.get(key);
    if (existing) {
      const audit = this.store.appendAudit(request.actor, "mcp.dedupe", "mcp_request", key, "deduped", {
        method: request.method,
        originalAuditEventId: existing.auditEventId
      });
      return { ...existing, status: "deduped", auditEventId: audit.id };
    }

    try {
      this.authenticate(request.actor);
      this.validateMethod(request.method);
      this.validatePayloadSafety(request.params);
      const method = request.method as AllowedMcpMethod;
      if (this.isWriteMethod(method) && !canWrite(request.actor)) {
        throw new Error(`Role ${request.actor.role} cannot write through MCP`);
      }
      const result = this.dispatch(method, request.actor, request.params);
      const audit = this.store.appendAudit(request.actor, `mcp.${method}`, "mcp_request", key, this.isReadMethod(method) ? "read" : "accepted", {
        method,
        resultType: resultType(result)
      });
      const response: McpResponse = {
        ok: true,
        method,
        status: audit.outcome === "read" ? "read" : "accepted",
        result,
        auditEventId: audit.id,
        idempotencyKey: key
      };
      this.responsesByKey.set(key, response);
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const audit = this.store.appendAudit(request.actor, "mcp.blocked", "mcp_request", key, "blocked", {
        method: request.method,
        error: message,
        params: redactForAudit(request.params)
      });
      const response: McpResponse = {
        ok: false,
        method: request.method,
        status: "blocked",
        error: message,
        auditEventId: audit.id,
        idempotencyKey: key
      };
      this.responsesByKey.set(key, response);
      return response;
    }
  }

  private dispatch(method: AllowedMcpMethod, actor: ActorIdentity, params: Record<string, unknown>): unknown {
    switch (method) {
      case "aos.ticket.propose":
        return this.proposeTicket(actor, params);
      case "aos.ticket.comment":
        return this.store.addComment({
          ticketId: requireString(params.ticketId, "ticketId"),
          type: requireString(params.type, "type") as never,
          actor,
          body: requireString(params.body, "body")
        }, actor);
      case "aos.run.summary.create":
        return this.recordRunSummary(actor, params);
      case "aos.gate.request":
        return this.requestGate(actor, params);
      case "aos.evidence.link":
        return this.linkEvidence(actor, params);
      case "aos.policy.read":
        return {
          policyVersion: POLICY_VERSION,
          allowedMethods: allowedMcpMethods,
          ownerIntentActionsRemainPending: true,
          actorAuthoritySnapshot: {
            employeeId: actor.employeeId,
            role: actor.role,
            threadId: actor.threadId,
            canWrite: canWrite(actor)
          },
          localOnly: true,
          liveDispatchAuthorized: false
        };
      case "aos.conference.request":
        return this.store.createConference({
          type: requireString(params.type, "type") as never,
          title: requireString(params.title, "title"),
          initiator: actor,
          participantEmployeeIds: requireStringArray(params.participantEmployeeIds, "participantEmployeeIds"),
          agenda: requireStringArray(params.agenda, "agenda"),
          linkedTicketIds: requireStringArray(params.linkedTicketIds, "linkedTicketIds"),
          desiredOutcome: requireString(params.desiredOutcome, "desiredOutcome")
        }, actor);
      case "aos.conference.position.record":
        return this.store.recordConferencePosition({
          conferenceId: requireString(params.conferenceId, "conferenceId"),
          actor,
          position: requireString(params.position, "position"),
          risks: requireStringArray(params.risks, "risks"),
          recommendations: requireStringArray(params.recommendations, "recommendations"),
          evidenceIds: requireStringArray(params.evidenceIds, "evidenceIds")
        }, actor);
      case "aos.conference.minutes.record":
        return this.recordConferenceMinutes(actor, params);
      case "aos.work_index.drill_through.read":
        return this.store.createWorkIndexDrillThrough(requireString(params.storyId, "storyId"));
      case "aos.documentation.index.read":
        return this.store.createDocumentationIndex(this.requireProjectScope(params.projectId));
      case "aos.knowledge.entry.propose":
        return this.proposeKnowledgeEntry(actor, params);
      case "aos.guide.page.draft":
        return this.draftGuidePage(actor, params);
      case "aos.release_note.item.draft":
        return this.draftReleaseNote(actor, params);
      case "aos.docs.readiness.record":
        this.requireProjectScope(params.projectId);
        return this.store.createDocsReadinessRecord(params as unknown as Omit<DocsReadinessRecord, "id" | "docsPublished" | "gitExportExecuted" | "canonicalKnowledgePromoted" | "publicReadinessClaimed" | "releaseReadyClaimed" | "localFirstStorage">, actor);
      case "aos.docs.search.index":
        this.requireProjectScope(params.projectId);
        return this.store.createProjectSearchIndexRecord(params as unknown as Omit<ProjectSearchIndexRecord, "id" | "visibility" | "rawPrivatePayloadIndexed" | "rawSourceIndexed" | "rawScannerOutputIndexed" | "localAbsolutePathIndexed" | "localFirstStorage">, actor);
      case "aos.github.metadata.record":
        this.requireProjectScope(params.projectId);
        return this.store.createGitHubMetadataReadback(params as unknown as Omit<GitHubMetadataReadback, "id" | "githubWriteExecuted" | "releaseCreated" | "ciStatusMutated" | "releaseReadyClaimed" | "localFirstStorage">, actor);
      case "aos.pr_ci.story_readiness.record":
        this.requireProjectScope(params.projectId);
        return this.store.createPrCiStoryReadiness(params as unknown as Omit<PrCiStoryReadinessLinkage, "id" | "githubWriteExecuted" | "ciStatusMutated" | "releaseReadyClaimed" | "localFirstStorage">, actor);
      case "aos.release_candidate.linkage.record":
        this.requireProjectScope(params.projectId);
        return this.store.createReleaseCandidateLinkage(params as unknown as Omit<ReleaseCandidateLinkage, "id" | "releaseCreated" | "githubWriteExecuted" | "deploymentExecuted" | "productAccepted" | "finalMvpAccepted" | "releaseReadyClaimed" | "publicReadinessClaimed" | "legalCompletionClaimed" | "dependencyCleanClaimed" | "localFirstStorage">, actor);
      case "aos.release_candidate.linkage.read":
        return this.store.createDocsSearchReleaseLinkageIndex(this.requireProjectScope(params.projectId));
      case "aos.stage_map.read":
        return this.store.deriveStageMap(this.requireProjectScope(params.projectId), requireString(params.initiativeId, "initiativeId"));
      case "aos.dependency.record.propose":
        this.requireProjectScope(params.projectId);
        return this.store.createDependencyRecord(params as unknown as Omit<DependencyLifecycleRecord, "id" | "linkedGateIds">, actor);
      case "aos.dependency.detection.record":
        this.requireProjectScope(params.projectId);
        return this.store.createDependencyDetectionFinding(params as unknown as Omit<DependencyDetectionFinding, "id">, actor);
      case "aos.dependency.governance.read":
        return this.store.createDependencyGovernanceIndex(this.requireProjectScope(params.projectId));
      case "aos.resource.record.propose":
        this.requireProjectScope(params.projectId);
        return this.store.createResourceRecord(params as unknown as Omit<ResourceRegistryRecord, "id" | "linkedGateIds" | "projectManifestRefs">, actor);
      case "aos.resource.materialization.request":
        this.requireProjectScope(params.projectId);
        this.requireProjectScope(params.targetProjectId);
        return this.store.createResourceMaterializationRequest({
          ...params,
          requestedBy: actor
        } as unknown as Omit<ResourceMaterializationRequest, "id" | "ownerIntentRequired" | "materializationExecuted" | "productRepoWriteExecuted">, actor);
      case "aos.resource.manifest.record":
        this.requireProjectScope(params.projectId);
        return this.store.createProjectResourceManifest(params as unknown as Omit<ProjectResourceManifestRecord, "id" | "sourceTruth" | "liveCopyCreated" | "productRepoWriteExecuted">, actor);
      case "aos.resource.audit_finding.record":
        this.requireProjectScope(params.projectId);
        return this.store.createResourceAuditFinding(params as unknown as Omit<ResourceAuditFinding, "id" | "scannerIngestionExecuted" | "materializationExecuted" | "productRepoMutationExecuted">, actor);
      case "aos.resource.governance.read":
        return this.store.createResourceGovernanceIndex(this.requireProjectScope(params.projectId));
      case "aos.resource.materialization_history.record":
        this.requireProjectScope(params.projectId);
        this.requireProjectScope(params.targetProjectId);
        return this.store.createResourceMaterializationHistory({
          ...params,
          actor
        } as unknown as Omit<ResourceMaterializationHistoryRecord, "id" | "recordedAt" | "materializationExecuted" | "resourceBinaryTransferred" | "productRepoWriteExecuted">, actor);
      case "aos.resource.update.request":
        this.requireProjectScope(params.projectId);
        return this.store.createResourceUpdateRequest(params as unknown as Omit<ResourceUpdateRequest, "id" | "ownerIntentRequired" | "updateExecuted" | "resourceBinaryTransferred" | "productRepoWriteExecuted">, actor);
      case "aos.resource.replacement.request":
        this.requireProjectScope(params.projectId);
        return this.store.createResourceReplacementRequest(params as unknown as Omit<ResourceReplacementRequest, "id" | "ownerIntentRequired" | "replacementExecuted" | "resourceBinaryTransferred" | "productRepoWriteExecuted">, actor);
      case "aos.resource.rollback.request":
        this.requireProjectScope(params.projectId);
        return this.store.createResourceRollbackRequest(params as unknown as Omit<ResourceRollbackRequest, "id" | "ownerIntentRequired" | "rollbackExecuted" | "cleanupExecuted" | "productRepoWriteExecuted">, actor);
      case "aos.resource.rollback_plan.record":
        this.requireProjectScope(params.projectId);
        return this.store.createResourceRollbackPlan(params as unknown as Omit<ResourceRollbackPlan, "id" | "ownerIntentRequired" | "rollbackExecuted" | "cleanupExecuted" | "productRepoWriteExecuted">, actor);
      case "aos.resource.retirement.record":
        this.requireProjectScope(params.projectId);
        return this.store.createResourceRetirementRecord(params as unknown as Omit<ResourceRetirementRecord, "id" | "ownerIntentRequired" | "retirementCleanupExecuted" | "productRepoDeleteExecuted">, actor);
      case "aos.resource.cleanup_readback.record":
        this.requireProjectScope(params.projectId);
        return this.store.createResourceCleanupReadback(params as unknown as Omit<ResourceCleanupReadback, "id" | "ownerIntentRequired" | "cleanupExecuted" | "deleteExecuted" | "productRepoWriteExecuted">, actor);
      case "aos.resource.materialization_control.read":
        return this.store.createResourceMaterializationControlIndex(this.requireProjectScope(params.projectId));
      case "aos.audit.query":
        return this.store.queryAudit(compactFilter({
          targetId: optionalString(params.targetId),
          action: optionalString(params.action),
          actorEmployeeId: optionalString(params.actorEmployeeId)
        }));
    }
  }

  private proposeTicket(actor: ActorIdentity, params: Record<string, unknown>): unknown {
    const ticketType = requireString(params.ticketType, "ticketType");
    if (ticketType === "initiative") {
      return this.store.createInitiative({
        projectId: this.requireProjectScope(params.projectId),
        title: requireString(params.title, "title"),
        status: "proposed",
        problem: requireString(params.problem, "problem"),
        expectedOutcome: requireString(params.expectedOutcome, "expectedOutcome")
      }, actor);
    }
    if (ticketType === "epic") {
      return this.store.createEpic({
        initiativeId: requireString(params.initiativeId, "initiativeId"),
        title: requireString(params.title, "title"),
        goal: requireString(params.goal, "goal"),
        status: "proposed"
      }, actor);
    }
    if (ticketType === "story") {
      return this.store.createStory({
        epicId: requireString(params.epicId, "epicId"),
        title: requireString(params.title, "title"),
        problem: requireString(params.problem, "problem"),
        user: requireString(params.user, "user"),
        expectedBehavior: requireString(params.expectedBehavior, "expectedBehavior"),
        acceptanceCriteria: requireStringArray(params.acceptanceCriteria, "acceptanceCriteria"),
        status: "proposed",
        estimate: params.estimate as StoryRecord["estimate"],
        subTasks: (params.subTasks ?? []) as SubTask[]
      }, actor);
    }
    throw new Error(`Unsupported ticketType: ${ticketType}`);
  }

  private requestGate(actor: ActorIdentity, params: Record<string, unknown>): GateWorkOrder {
    const type = requireString(params.type, "type") as GateWorkOrder["type"];
    if (requiresOwnerIntent(requireString(params.requestedAction ?? type, "requestedAction"))) {
      return this.store.requestGate({
        type: "owner_intent",
        linkedTicketId: requireString(params.linkedTicketId, "linkedTicketId"),
        inputEvidenceIds: requireStringArray(params.inputEvidenceIds, "inputEvidenceIds")
      }, actor);
    }
    return this.store.requestGate({
      type,
      linkedTicketId: requireString(params.linkedTicketId, "linkedTicketId"),
      inputEvidenceIds: requireStringArray(params.inputEvidenceIds, "inputEvidenceIds")
    }, actor);
  }

  private recordRunSummary(actor: ActorIdentity, params: Record<string, unknown>): AgentRun {
    const run: Omit<AgentRun, "id"> = {
      assignmentId: requireString(params.assignmentId, "assignmentId"),
      status: requireString(params.status, "status") as AgentRun["status"],
      startedAt: requireString(params.startedAt ?? new Date().toISOString(), "startedAt"),
      readback: requireString(params.readback ?? params.summary, "readback"),
      outputSummary: requireString(params.outputSummary ?? params.summary, "outputSummary")
    };
    const endedAt = optionalString(params.endedAt);
    if (endedAt) {
      run.endedAt = endedAt;
    }
    return this.store.recordAgentRun(run, actor);
  }

  private linkEvidence(actor: ActorIdentity, params: Record<string, unknown>): EvidenceLink {
    const evidence: Omit<EvidenceLink, "id" | "createdAt"> = {
      type: requireString(params.type, "type") as EvidenceLink["type"],
      target: requireString(params.target, "target"),
      validity: "unknown",
      producer: actor.employeeId,
      redactionState: requireString(params.redactionState, "redactionState") as EvidenceLink["redactionState"]
    };
    const digest = optionalString(params.digest);
    if (digest) {
      evidence.digest = digest;
    }
    return this.store.linkEvidence(evidence, actor);
  }

  private proposeKnowledgeEntry(actor: ActorIdentity, params: Record<string, unknown>): unknown {
    const projectId = this.requireProjectScope(params.projectId);
    return this.store.createKnowledgeEntry({
      id: createId("knowledge", { projectId, category: params.category, sourceIds: params.sourceIds }),
      projectId,
      category: requireString(params.category, "category") as never,
      status: requireString(params.status ?? "proposed", "status") as never,
      sourceKind: requireString(params.sourceKind, "sourceKind") as never,
      sourceIds: requireStringArray(params.sourceIds, "sourceIds"),
      linkedTicketIds: requireStringArray(params.linkedTicketIds, "linkedTicketIds"),
      linkedConferenceIds: requireStringArray(params.linkedConferenceIds ?? [], "linkedConferenceIds"),
      linkedEvidenceIds: requireStringArray(params.linkedEvidenceIds ?? [], "linkedEvidenceIds"),
      freshnessState: requireString(params.freshnessState ?? "fresh", "freshnessState") as never,
      rawPrivatePayloadStored: false,
      canonicalPromotionClaimed: false,
      localFirstStorage: true,
      defaultGitStorage: false,
      explicitExportRequired: true
    }, actor);
  }

  private draftGuidePage(actor: ActorIdentity, params: Record<string, unknown>): unknown {
    const projectId = this.requireProjectScope(params.projectId);
    return this.store.createUserGuideDraft({
      id: createId("guide", { projectId, audience: params.audience, versionLabel: params.versionLabel }),
      projectId,
      audience: requireString(params.audience, "audience") as never,
      versionLabel: requireString(params.versionLabel, "versionLabel"),
      status: requireString(params.status ?? "draft", "status") as never,
      linkedStoryIds: requireStringArray(params.linkedStoryIds, "linkedStoryIds"),
      linkedReleaseNoteItemIds: requireStringArray(params.linkedReleaseNoteItemIds ?? [], "linkedReleaseNoteItemIds"),
      linkedEvidenceIds: requireStringArray(params.linkedEvidenceIds ?? [], "linkedEvidenceIds"),
      publishedStateDistinctFromDraft: true,
      releaseCloseoutClaimed: false,
      defaultGitStorage: false
    }, actor);
  }

  private draftReleaseNote(actor: ActorIdentity, params: Record<string, unknown>): unknown {
    const projectId = this.requireProjectScope(params.projectId);
    return this.store.createReleaseNote({
      id: createId("release_note", { projectId, releaseLabel: params.releaseLabel, linkedStoryIds: params.linkedStoryIds }),
      projectId,
      releaseLabel: requireString(params.releaseLabel, "releaseLabel"),
      linkedStoryIds: requireStringArray(params.linkedStoryIds, "linkedStoryIds"),
      userFacingSummary: requireString(params.userFacingSummary, "userFacingSummary"),
      internalNotesSummary: requireString(params.internalNotesSummary, "internalNotesSummary"),
      riskNotesSummary: requireString(params.riskNotesSummary, "riskNotesSummary"),
      linkedEvidenceIds: requireStringArray(params.linkedEvidenceIds ?? [], "linkedEvidenceIds"),
      reviewState: requireString(params.reviewState ?? "draft", "reviewState") as never,
      gitExportAuthorized: false,
      releaseCloseoutClaimed: false
    }, actor);
  }

  private recordConferenceMinutes(actor: ActorIdentity, params: Record<string, unknown>): unknown {
    const conferenceId = requireString(params.conferenceId, "conferenceId");
    const outcomeClass = requireString(params.outcomeClass, "outcomeClass") as never;
    const evidenceIds = requireStringArray(params.evidenceIds, "evidenceIds");
    return this.store.recordConferenceMinutes({
      conferenceId,
      summary: requireString(params.summary, "summary"),
      outcomeClass,
      decisions: [{
        id: createId("decision", { conferenceId, outcomeClass, actor: actor.employeeId }),
        decisionClass: outcomeClass,
        actor,
        summary: requireString(params.decisionSummary ?? params.summary, "decisionSummary"),
        evidenceIds,
        createdAt: new Date().toISOString()
      }],
      unresolvedIssues: requireStringArray(params.unresolvedIssues ?? [], "unresolvedIssues"),
      actionItemIds: requireStringArray(params.actionItemIds ?? [], "actionItemIds")
    }, actor);
  }

  private authenticate(actor: ActorIdentity): void {
    const employee = this.store.getEmployee(actor.employeeId);
    if (!employee) {
      throw new Error(`Unknown employee: ${actor.employeeId}`);
    }
    if (employee.role !== actor.role) {
      throw new Error(`Role binding mismatch for ${actor.employeeId}`);
    }
    if (employee.threadIdentity.threadId !== actor.threadId || employee.threadIdentity.status !== "active") {
      throw new Error(`Thread binding is not active for ${actor.employeeId}`);
    }
  }

  private validateMethod(method: string): void {
    if (!allowedMcpMethods.includes(method as AllowedMcpMethod)) {
      throw new Error(`Unsupported MCP method: ${method}`);
    }
  }

  private validatePayloadSafety(params: Record<string, unknown>): void {
    const findings = scanForRestrictedContent(params);
    if (findings.length > 0) {
      const first = findings[0]!;
      throw new Error(`MCP payload rejected restricted ${first.kind} at ${first.path}`);
    }
  }

  private isWriteMethod(method: AllowedMcpMethod): boolean {
    return !this.isReadMethod(method);
  }

  private isReadMethod(method: AllowedMcpMethod): boolean {
    return ["aos.policy.read", "aos.stage_map.read", "aos.work_index.drill_through.read", "aos.documentation.index.read", "aos.release_candidate.linkage.read", "aos.dependency.governance.read", "aos.resource.governance.read", "aos.resource.materialization_control.read", "aos.audit.query"].includes(method);
  }

  private requireProjectScope(value: unknown): string {
    const projectId = requireString(value, "projectId");
    if (!this.store.getProject(projectId)) {
      throw new Error(`Unknown project scope: ${projectId}`);
    }
    return projectId;
  }
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing required string field: ${field}`);
  }
  return value;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function requireStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`Missing required string array field: ${field}`);
  }
  return value;
}

function resultType(value: unknown): string {
  if (Array.isArray(value)) {
    return "array";
  }
  if (value && typeof value === "object") {
    const id = "id" in value ? String((value as { id: unknown }).id) : "object";
    return id;
  }
  return typeof value;
}

function compactFilter(filter: {
  targetId: string | undefined;
  action: string | undefined;
  actorEmployeeId: string | undefined;
}): Partial<{ targetId: string; action: string; actorEmployeeId: string }> {
  const compact: Partial<{ targetId: string; action: string; actorEmployeeId: string }> = {};
  if (filter.targetId) {
    compact.targetId = filter.targetId;
  }
  if (filter.action) {
    compact.action = filter.action;
  }
  if (filter.actorEmployeeId) {
    compact.actorEmployeeId = filter.actorEmployeeId;
  }
  return compact;
}

export function createGatewayWithStore(store: AosStore): McpGateway {
  return new McpGateway(store);
}
