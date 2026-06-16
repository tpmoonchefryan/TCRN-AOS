export type ProjectId = string;
export type AosId = string;
export type ISODateTime = string;

export type WorkStatus =
  | "proposed"
  | "accepted"
  | "in_progress"
  | "blocked"
  | "in_review"
  | "verified"
  | "released"
  | "archived"
  | "superseded";

export type GateStatus =
  | "proposed"
  | "pending_role"
  | "owner_intent_required"
  | "accepted"
  | "blocked"
  | "superseded";

export type EvidenceRedactionState =
  | "metadata_only"
  | "redacted"
  | "restricted"
  | "public_reference";

export type DependencyPosture =
  | "proposed"
  | "allowed"
  | "review_required"
  | "evidence_missing"
  | "accepted_with_residual_risk"
  | "blocked"
  | "deprecated"
  | "denied"
  | "expired"
  | "replaced"
  | "removed";

export type ResourceRiskState =
  | "clear"
  | "review_required"
  | "blocked"
  | "approved_exception"
  | "expired"
  | "unknown_rights";

export type ActorRole =
  | "owner"
  | "owner_observer"
  | "owner_intent_submitter"
  | "admin"
  | "break_glass_admin"
  | "coordinator"
  | "product_strategy"
  | "architecture"
  | "implementation"
  | "verification"
  | "security"
  | "evidence"
  | "release"
  | "knowledge"
  | "registrar";

export interface ActorIdentity {
  employeeId: AosId;
  role: ActorRole;
  threadId: string;
  sessionId: string;
}

export interface Estimate {
  effortPoints: number;
  complexity: "low" | "medium" | "high";
  risk: "L0" | "L1" | "L2" | "L3";
  verificationCost: "low" | "medium" | "high";
  confidence: "low" | "medium" | "high";
  revisedBy?: AosId;
  revisedAt?: ISODateTime;
}

export interface SubTask {
  id: AosId;
  title: string;
  ownerRole: ActorRole;
  status: WorkStatus;
  dependencyIds: AosId[];
  proofExpectation: string;
}

export type CommentType =
  | "human_intent"
  | "agent_observation"
  | "agent_proposal"
  | "agent_decision"
  | "conference_minute"
  | "gate_result"
  | "evidence_note"
  | "release_note_draft";

export interface StructuredComment {
  id: AosId;
  ticketId: AosId;
  type: CommentType;
  actor: ActorIdentity;
  body: string;
  createdAt: ISODateTime;
  appendOnly: true;
}

export interface EvidenceLink {
  id: AosId;
  type: "local_path_reference" | "github_url" | "artifact_id" | "external_url";
  target: string;
  validity: "unknown" | "valid" | "broken" | "restricted";
  producer: AosId;
  digest?: string;
  redactionState: EvidenceRedactionState;
  createdAt: ISODateTime;
}

export interface DecisionHistoryEntry {
  id: AosId;
  decisionClass: "discussion_only" | "recommendation" | "role_decision" | "blocked" | "owner_intent_required";
  actor: ActorIdentity;
  summary: string;
  evidenceIds: AosId[];
  createdAt: ISODateTime;
}

export interface ProjectRecord {
  id: ProjectId;
  name: string;
  registryStatus: "planned" | "active" | "archived" | "unknown";
  repoRegistryId: string;
  repoPathReference: string;
  status: WorkStatus;
  gateState: GateStatus;
  evidenceIds: AosId[];
  decisionHistory: DecisionHistoryEntry[];
}

export interface InitiativeRecord {
  id: AosId;
  projectId: ProjectId;
  title: string;
  status: WorkStatus;
  problem: string;
  expectedOutcome: string;
  epicIds: AosId[];
  storyIds: AosId[];
  gateIds: AosId[];
  evidenceIds: AosId[];
  decisionHistory: DecisionHistoryEntry[];
}

export interface EpicRecord {
  id: AosId;
  initiativeId: AosId;
  title: string;
  goal: string;
  status: WorkStatus;
  storyIds: AosId[];
  estimate?: Estimate;
  gateIds: AosId[];
  evidenceIds: AosId[];
}

export interface StoryRecord {
  id: AosId;
  epicId: AosId;
  title: string;
  problem: string;
  user: string;
  expectedBehavior: string;
  acceptanceCriteria: string[];
  status: WorkStatus;
  estimate: Estimate;
  subTasks: SubTask[];
  comments: StructuredComment[];
  links: LinkRecord[];
  gateIds: AosId[];
  assignmentIds: AosId[];
  evidenceIds: AosId[];
  decisionHistory: DecisionHistoryEntry[];
}

export interface LinkRecord {
  id: AosId;
  type: "commit" | "pull_request" | "ci_run" | "evidence" | "conference" | "knowledge" | "release_note";
  targetSystem: "github" | "tcrn_workflow" | "aos" | "external";
  target: string;
  validity: "unknown" | "valid" | "broken";
}

export interface ThreadIdentity {
  threadId: string;
  status: "active" | "replaced" | "archived" | "forked";
  lifecycle: "persistent" | "ephemeral";
  replacementThreadId?: string;
  lastActivityAt?: ISODateTime;
}

export interface AIEmployee {
  id: AosId;
  name: string;
  role: ActorRole;
  authoritySummary: string;
  contactWhen: string;
  lifecycle: "active" | "idle" | "blocked" | "archived";
  threadIdentity: ThreadIdentity;
  roleContractRefs: string[];
  skillRefs: string[];
}

export interface Assignment {
  id: AosId;
  employeeId: AosId;
  targetId: AosId;
  targetType: "story" | "gate" | "conference" | "project";
  role: ActorRole;
  status: WorkStatus;
  dueState: "none" | "due_soon" | "overdue" | "timeout";
  proofExpectation: string;
  runIds: AosId[];
}

export interface AgentRun {
  id: AosId;
  assignmentId: AosId;
  status: "success" | "partial" | "blocked" | "stale" | "interrupted" | "superseded";
  startedAt: ISODateTime;
  endedAt?: ISODateTime;
  readback: string;
  outputSummary: string;
}

export interface GateWorkOrder {
  id: AosId;
  type:
    | "product_strategy"
    | "architecture"
    | "security_license"
    | "evidence_proof"
    | "release_closeout"
    | "owner_intent";
  ownerRole: ActorRole;
  linkedTicketId: AosId;
  inputEvidenceIds: AosId[];
  status: GateStatus;
  decision?: DecisionHistoryEntry;
  blocker?: string;
}

export interface OwnerIntent {
  id: AosId;
  action: "create" | "pause" | "resume" | "reprioritize" | "challenge" | "request_conference";
  summary: string;
  status: "captured" | "routed" | "owner_intent_required" | "closed";
  linkedGateId?: AosId;
  auditEventId: AosId;
}

export interface ConferenceRequest {
  id: AosId;
  type: "strategy" | "architecture" | "risk" | "verification" | "release" | "incident" | "retrospective";
  title: string;
  initiator: ActorIdentity;
  participantEmployeeIds: AosId[];
  inviteDispatchIds: AosId[];
  agenda: string[];
  linkedTicketIds: AosId[];
  desiredOutcome: string;
  status: "requested" | "collecting_positions" | "minutes_ready" | "blocked" | "closed";
  positions: ConferencePosition[];
  minutes?: ConferenceMinutes;
}

export interface ConferencePosition {
  id: AosId;
  conferenceId: AosId;
  actor: ActorIdentity;
  position: string;
  risks: string[];
  recommendations: string[];
  evidenceIds: AosId[];
}

export interface ConferenceMinutes {
  id: AosId;
  conferenceId: AosId;
  summary: string;
  outcomeClass: "discussion_only" | "recommendation" | "role_decision" | "blocked" | "owner_intent_required";
  decisions: DecisionHistoryEntry[];
  unresolvedIssues: string[];
  actionItemIds: AosId[];
}

export type LocalOperatingLoopAction =
  | "request_conference"
  | "record_participant_position"
  | "record_minutes"
  | "request_gate"
  | "submit_owner_intent"
  | "mark_route_stale"
  | "open_evidence_metadata";

export interface BlockedActionReason {
  action: LocalOperatingLoopAction;
  reason: string;
  ownerRole: ActorRole;
}

export interface WorkIndexDrillThrough {
  selectedStoryId: AosId;
  linkedAssignmentIds: AosId[];
  linkedGateIds: AosId[];
  linkedConferenceIds: AosId[];
  linkedEvidenceIds: AosId[];
  linkedAuditEventIds: AosId[];
  nextAllowedLocalActions: LocalOperatingLoopAction[];
  blockedActions: BlockedActionReason[];
}

export interface LocalConferenceOperatingLoop {
  conferenceId: AosId;
  linkedTicketIds: AosId[];
  initiatorEmployeeId: AosId;
  participantEmployeeIds: AosId[];
  inviteDispatchIds: AosId[];
  missingParticipantEmployeeIds: AosId[];
  participantPositionIds: AosId[];
  minutesStatus: "not_started" | "ready_for_draft" | "recorded" | "blocked";
  outcomeClass: "discussion_only" | "recommendation" | "role_decision" | "blocked" | "owner_intent_required";
  liveDispatchAuthorized: false;
  threadRegistryMutationAuthorized: false;
}

export interface StageDefinition {
  id: string;
  label: string;
  defaultOwnerRoles: ActorRole[];
  gateTypes: GateWorkOrder["type"][];
  evidenceExpectation: string;
}

export interface StageMapItem {
  projectId: ProjectId;
  initiativeId: AosId;
  stageId: string;
  state: "not_started" | "active" | "blocked" | "complete" | "release_proof_required";
  ownerRoles: ActorRole[];
  sourceStoryIds: AosId[];
  sourceGateIds: AosId[];
  evidenceIds: AosId[];
}

export interface DependencyLifecycleRecord {
  id: AosId;
  projectId: ProjectId;
  ecosystem: "npm" | "container" | "system" | "other";
  packageName: string;
  versionRange: string;
  resolvedArtifact?: string;
  sourceSystem: string;
  projectUsage: "runtime" | "development" | "tooling" | "historical";
  ownerRole?: ActorRole;
  lifecycleState?: "current" | "historical" | "deprecated" | "denied" | "expired" | "unapproved" | "removed" | "unused";
  artifactRef?: string;
  licenseExpression: string;
  declaredLicenseEvidence?: string;
  discoveredLicenseEvidence?: string;
  evidenceArtifactRef?: string;
  evidenceStatus: "present" | "evidence_missing" | "conflict" | "not_applicable";
  confidence?: "low" | "medium" | "high";
  policyClass?: "allowed" | "review_required" | "denied" | "unknown";
  reviewerRole?: ActorRole;
  residualRisk?: "none" | "low" | "medium" | "high" | "blocked";
  nextAction?: "none" | "collect_evidence" | "request_review" | "replace_dependency" | "remove_dependency" | "owner_intent_required";
  sbomNoticeObligation: "none" | "review_required" | "required";
  posture: DependencyPosture;
  approvalOwnerRole: ActorRole;
  linkedGateIds: AosId[];
  linkedStoryIds?: AosId[];
  linkedEvidenceIds?: AosId[];
  releaseBlocker?: boolean;
  packageMutationExecuted?: false;
}

export interface ResourceRegistryRecord {
  id: AosId;
  type: "image" | "icon" | "logo" | "font" | "copy" | "prompt_material" | "document" | "template" | "generated_artifact" | "dataset" | "code_adjacent_scaffold" | "external_reference";
  projectId?: ProjectId;
  title: string;
  owner: string;
  source: string;
  version: string;
  digest: string;
  storageReference: string;
  classification: string[];
  permissionState?: "unknown" | "permitted" | "permission_required" | "denied" | "expired";
  attributionRequired?: boolean;
  derivativeAllowed?: boolean;
  expiresAt?: ISODateTime;
  reviewerRole?: ActorRole;
  residualRisk?: "none" | "low" | "medium" | "high" | "blocked";
  copyrightStatus: ResourceRiskState;
  lifecycleState: "proposed" | "approved" | "materialized" | "deprecated" | "revoked" | "replaced" | "archived" | "denied";
  approvalState: "none" | "review_required" | "accepted" | "accepted_with_residual_risk" | "blocked";
  projectManifestRefs: string[];
  linkedGateIds: AosId[];
  linkedStoryIds?: AosId[];
  linkedReleaseNoteIds?: AosId[];
  linkedEvidenceIds?: AosId[];
  materializationAllowed?: boolean;
  materializationExecuted?: false;
  productRepoWriteExecuted?: false;
  releaseBlocker?: boolean;
}

export interface DependencyDetectionFinding {
  id: AosId;
  projectId: ProjectId;
  dependencyId: AosId;
  state: "deprecated" | "denied" | "expired" | "unapproved" | "current" | "historical" | "removed" | "unused";
  sourceSystem: "deterministic_fixture" | "manual_review" | "policy_readback";
  evidenceIds: AosId[];
  linkedGateIds: AosId[];
  remediationExecuted: false;
  packageMutationExecuted: false;
  nextAction: "none" | "collect_evidence" | "request_review" | "replace_dependency" | "remove_dependency" | "owner_intent_required";
}

export interface DependencyGovernanceIndexReadback {
  projectId: ProjectId;
  dependencyIds: AosId[];
  detectionFindingIds: AosId[];
  blockedDependencyIds: AosId[];
  releaseBlockerDependencyIds: AosId[];
  sbomNoticeRequiredDependencyIds: AosId[];
  linkedGateIds: AosId[];
  linkedEvidenceIds: AosId[];
  stateCounts: Record<string, number>;
  localFirstStorage: true;
  packageMutationAuthorized: false;
  remediationExecuted: false;
  dependencyCleanClaimed: false;
  legalCompletionClaimed: false;
  releaseReadinessClaimed: false;
}

export interface ResourceMaterializationRequest {
  id: AosId;
  projectId: ProjectId;
  resourceId: AosId;
  targetProjectId: ProjectId;
  requestedBy: ActorIdentity;
  requestedPurpose: string;
  status: "requested" | "gate_required" | "approved_metadata_only" | "blocked" | "superseded";
  linkedGateId?: AosId;
  evidenceIds: AosId[];
  ownerIntentRequired: true;
  materializationExecuted: false;
  productRepoWriteExecuted: false;
}

export interface ProjectResourceManifestRecord {
  id: AosId;
  projectId: ProjectId;
  resourceId: AosId;
  resourceDigest: string;
  materializedCopyReference: string;
  status: "approved_lineage_record" | "stale_version" | "revoked" | "blocked";
  linkedStoryIds: AosId[];
  linkedReleaseNoteIds: AosId[];
  linkedEvidenceIds: AosId[];
  sourceTruth: "resource_library";
  liveCopyCreated: false;
  productRepoWriteExecuted: false;
}

export interface ResourceAuditFinding {
  id: AosId;
  projectId: ProjectId;
  resourceId?: AosId;
  findingType: "approved_use" | "deprecated" | "revoked" | "stale_version" | "unused_materialized" | "unregistered_local_asset" | "blocked";
  severity: "info" | "review_required" | "blocked";
  evidenceIds: AosId[];
  linkedGateIds: AosId[];
  scannerIngestionExecuted: false;
  materializationExecuted: false;
  productRepoMutationExecuted: false;
}

export interface ResourceMaterializationHistoryRecord {
  id: AosId;
  projectId: ProjectId;
  resourceId: AosId;
  materializationRequestId: AosId;
  manifestId: AosId;
  targetProjectId: ProjectId;
  targetReference: string;
  resourceDigest: string;
  actor: ActorIdentity;
  recordedAt: ISODateTime;
  evidenceIds: AosId[];
  lifecycleState: "planned" | "approved_metadata_only" | "stale" | "superseded" | "blocked" | "rolled_back_metadata_only";
  materializationExecuted: false;
  resourceBinaryTransferred: false;
  productRepoWriteExecuted: false;
}

export interface ResourceUpdateRequest {
  id: AosId;
  projectId: ProjectId;
  resourceId: AosId;
  manifestId: AosId;
  currentResourceVersion: string;
  currentResourceDigest: string;
  proposedResourceVersion: string;
  proposedResourceDigest: string;
  status: "requested" | "dry_run_only" | "owner_intent_required" | "blocked" | "superseded";
  linkedGateId?: AosId;
  evidenceIds: AosId[];
  ownerIntentRequired: true;
  updateExecuted: false;
  resourceBinaryTransferred: false;
  productRepoWriteExecuted: false;
}

export interface ResourceReplacementRequest {
  id: AosId;
  projectId: ProjectId;
  oldResourceId: AosId;
  replacementResourceId: AosId;
  reason: string;
  copyrightStatus: ResourceRiskState;
  licensePosture: "review_required" | "accepted_with_residual_risk" | "blocked";
  residualRisk: "low" | "medium" | "high" | "blocked";
  status: "requested" | "owner_intent_required" | "blocked" | "superseded";
  linkedGateIds: AosId[];
  evidenceIds: AosId[];
  ownerIntentRequired: true;
  replacementExecuted: false;
  resourceBinaryTransferred: false;
  productRepoWriteExecuted: false;
}

export interface ResourceRollbackRequest {
  id: AosId;
  projectId: ProjectId;
  resourceId: AosId;
  manifestId: AosId;
  intendedPreviousManifestId?: AosId;
  intendedPreviousDigest: string;
  intendedPreviousReference: string;
  reason: string;
  status: "requested" | "owner_intent_required" | "blocked" | "superseded";
  requiredGateId?: AosId;
  evidenceIds: AosId[];
  ownerIntentRequired: true;
  rollbackExecuted: false;
  cleanupExecuted: false;
  productRepoWriteExecuted: false;
}

export interface ResourceRollbackPlan {
  id: AosId;
  projectId: ProjectId;
  rollbackRequestId: AosId;
  fallbackPath: string;
  expectedNoExecutionResult: string;
  readbackCommand: string;
  evidenceIds: AosId[];
  ownerIntentRequired: true;
  rollbackExecuted: false;
  cleanupExecuted: false;
  productRepoWriteExecuted: false;
}

export interface ResourceRetirementRecord {
  id: AosId;
  projectId: ProjectId;
  resourceId: AosId;
  manifestId?: AosId;
  reason: string;
  lifecycleState: "stale" | "revoked" | "superseded" | "blocked" | "retired_metadata_only";
  status: "recorded" | "blocked" | "superseded";
  evidenceIds: AosId[];
  cleanupRequired: boolean;
  ownerIntentRequired: true;
  retirementCleanupExecuted: false;
  productRepoDeleteExecuted: false;
}

export interface ResourceCleanupReadback {
  id: AosId;
  projectId: ProjectId;
  targetType: "resource" | "manifest" | "materialized_copy" | "runtime_reference";
  targetId: AosId;
  cleanupNeeded: boolean;
  cleanupReason: string;
  status: "identified" | "blocked" | "deferred" | "not_required";
  evidenceIds: AosId[];
  ownerIntentRequired: true;
  cleanupExecuted: false;
  deleteExecuted: false;
  productRepoWriteExecuted: false;
}

export interface ResourceTraceabilityRow {
  resourceId: AosId;
  linkedStoryIds: AosId[];
  linkedGateIds: AosId[];
  linkedReleaseNoteIds: AosId[];
  linkedEvidenceIds: AosId[];
  residualFindingIds: AosId[];
}

export interface ResourceGovernanceIndexReadback {
  projectId: ProjectId;
  resourceIds: AosId[];
  materializationRequestIds: AosId[];
  manifestRecordIds: AosId[];
  auditFindingIds: AosId[];
  blockedResourceIds: AosId[];
  releaseBlockerResourceIds: AosId[];
  linkedGateIds: AosId[];
  linkedEvidenceIds: AosId[];
  traceabilityRows: ResourceTraceabilityRow[];
  findingCounts: Record<string, number>;
  localFirstStorage: true;
  scannerIngestionExecuted: false;
  materializationExecuted: false;
  productRepoWriteExecuted: false;
  legalCompletionClaimed: false;
  publicReadinessClaimed: false;
  releaseReadinessClaimed: false;
}

export interface ResourceMaterializationControlIndexReadback {
  projectId: ProjectId;
  historyRecordIds: AosId[];
  updateRequestIds: AosId[];
  replacementRequestIds: AosId[];
  rollbackRequestIds: AosId[];
  rollbackPlanIds: AosId[];
  retirementRecordIds: AosId[];
  cleanupReadbackIds: AosId[];
  unresolvedUpdateIds: AosId[];
  unresolvedReplacementIds: AosId[];
  unresolvedRollbackIds: AosId[];
  cleanupBlockerIds: AosId[];
  linkedGateIds: AosId[];
  linkedEvidenceIds: AosId[];
  localFirstStorage: true;
  materializationExecuted: false;
  updateExecuted: false;
  replacementExecuted: false;
  rollbackExecuted: false;
  cleanupExecuted: false;
  deleteExecuted: false;
  resourceBinaryTransferred: false;
  productRepoWriteExecuted: false;
  legalCompletionClaimed: false;
  publicReadinessClaimed: false;
  releaseReadinessClaimed: false;
}

export type ProjectKnowledgeCategory =
  | "architecture"
  | "operations"
  | "workflow"
  | "user_guide"
  | "release"
  | "risk"
  | "decision";

export type ProjectDocumentationStatus =
  | "draft"
  | "proposed"
  | "review_required"
  | "accepted_local"
  | "superseded"
  | "blocked";

export type ProjectDocumentationFreshness =
  | "fresh"
  | "review_due"
  | "stale"
  | "blocked";

export interface KnowledgeEntry {
  id: AosId;
  projectId: ProjectId;
  category: ProjectKnowledgeCategory;
  status: ProjectDocumentationStatus;
  sourceKind: "story" | "conference" | "decision" | "evidence_link" | "manual_seed";
  sourceIds: AosId[];
  linkedTicketIds: AosId[];
  linkedConferenceIds: AosId[];
  linkedEvidenceIds: AosId[];
  freshnessState: ProjectDocumentationFreshness;
  rawPrivatePayloadStored: false;
  canonicalPromotionClaimed: false;
  localFirstStorage: true;
  defaultGitStorage: false;
  explicitExportRequired: true;
}

export interface UserGuidePageDraft {
  id: AosId;
  projectId: ProjectId;
  audience: "owner" | "operator" | "ai_employee" | "developer" | "release_reviewer";
  versionLabel: string;
  status: "draft" | "proposed" | "review_required" | "accepted_local" | "published_external_blocked";
  linkedStoryIds: AosId[];
  linkedReleaseNoteItemIds: AosId[];
  linkedEvidenceIds: AosId[];
  publishedStateDistinctFromDraft: true;
  releaseCloseoutClaimed: false;
  defaultGitStorage: false;
}

export interface ReleaseNoteRecord {
  id: AosId;
  projectId: ProjectId;
  releaseLabel: string;
  linkedStoryIds: AosId[];
  userFacingSummary: string;
  internalNotesSummary: string;
  riskNotesSummary: string;
  linkedEvidenceIds: AosId[];
  reviewState: "draft" | "proposed" | "review_required" | "accepted_local" | "publish_blocked";
  gitExportAuthorized: false;
  releaseCloseoutClaimed: false;
}

export interface ProjectDocumentationIndexReadback {
  projectId: ProjectId;
  knowledgeEntryIds: AosId[];
  guidePageIds: AosId[];
  releaseNoteItemIds: AosId[];
  staleItemIds: AosId[];
  blockedPublishItemIds: AosId[];
  linkedWorkItemIds: AosId[];
  linkedConferenceIds: AosId[];
  linkedEvidenceIds: AosId[];
  localFirstStorage: true;
  explicitExportRequired: true;
}

export interface DocumentationActionBlock {
  projectId: ProjectId;
  targetType: "knowledge" | "guide" | "release_note" | "documentation_index";
  targetId: AosId;
  action: "export" | "publish" | "canonical_promote" | "release_closeout";
  status: "blocked";
  reason: string;
  ownerIntentRequired: true;
  auditEventId: AosId;
}

export interface AuditEvent {
  id: AosId;
  actor: ActorIdentity | { system: string };
  action: string;
  targetType: string;
  targetId: string;
  timestamp: ISODateTime;
  outcome: "accepted" | "blocked" | "deduped" | "read";
  policyVersion: string;
  details: Record<string, unknown>;
}
