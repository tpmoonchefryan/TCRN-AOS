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
  decisions: DecisionHistoryEntry[];
  unresolvedIssues: string[];
  actionItemIds: AosId[];
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
  licenseExpression: string;
  evidenceStatus: "present" | "evidence_missing" | "conflict" | "not_applicable";
  sbomNoticeObligation: "none" | "review_required" | "required";
  posture: DependencyPosture;
  approvalOwnerRole: ActorRole;
  linkedGateIds: AosId[];
}

export interface ResourceRegistryRecord {
  id: AosId;
  type: "image" | "icon" | "logo" | "font" | "copy" | "prompt_material" | "document" | "template" | "generated_artifact" | "dataset" | "code_adjacent_scaffold" | "external_reference";
  title: string;
  owner: string;
  source: string;
  version: string;
  digest: string;
  storageReference: string;
  classification: string[];
  copyrightStatus: ResourceRiskState;
  lifecycleState: "proposed" | "approved" | "materialized" | "deprecated" | "revoked" | "replaced" | "archived" | "denied";
  approvalState: "none" | "review_required" | "accepted" | "accepted_with_residual_risk" | "blocked";
  projectManifestRefs: string[];
  linkedGateIds: AosId[];
}

export interface KnowledgeEntry {
  id: AosId;
  projectId: ProjectId;
  category: "knowledge" | "user_guide" | "release_note";
  status: "proposed" | "draft" | "review" | "published" | "archived";
  source: "agent_proposed" | "workflow_indexed" | "github_linked";
  freshness: "current" | "stale" | "unknown";
  linkedTicketIds: AosId[];
}

export interface ReleaseNoteRecord {
  id: AosId;
  projectId: ProjectId;
  release: string;
  storyIds: AosId[];
  userFacingSummary: string;
  internalNotes: string;
  riskNotes: string[];
  status: "draft" | "review" | "published";
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
