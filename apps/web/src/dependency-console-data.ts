import {
  AosStore,
  createDefaultSeed,
  createId,
  type ActorIdentity,
  type DependencyDetectionFinding,
  type DependencyGovernanceIndexReadback,
  type DependencyLifecycleRecord,
  type DependencyPosture,
  type Estimate
} from "../../../packages/domain/src/index.js";
import { createAOSWideProductDesignModel } from "./aos-wide-product-design-data.js";

export const dependencyConsoleSurfaceId = "dependency-console";
export const dependencyConsoleDsStandardIds = ["ds-aos-target-set-v1", "ds-aos-operations-cockpit-v1"] as const;
export const dependencyConsoleStorybookIds = [
  "tcrn-design-system-patterns--aos-product-design-target-set-standard",
  "tcrn-design-system-patterns--aos-operations-cockpit-standard"
] as const;

export const requiredDependencyConsoleSelectors = [
  "[data-surface='dependency-console']",
  "[data-region='dependency-console-shell']",
  "[data-region='dependency-console-nav']",
  "[data-region='dependency-console-topbar']",
  "[data-region='dependency-console-summary']",
  "[data-region='dependency-console-list']",
  "[data-region='dependency-console-detail']",
  "[data-region='dependency-console-service']",
  "[data-region='dependency-console-actions']"
] as const;

export const forbiddenDependencyConsoleVisibleCopy = [
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

const dependencyLifecycleStates = ["deprecated", "denied", "expired", "unapproved", "current", "historical", "removed", "unused"] as const;

export interface DependencyConsoleRow {
  id: string;
  packageName: string;
  lifecycleLabel: string;
  postureLabel: string;
  licenseExpression: string;
  sbomLabel: string;
  evidenceLabel: string;
  reviewerLabel: string;
  linkedGateCount: number;
  linkedEvidenceCount: number;
  releaseBlocker: boolean;
  nextActionLabel: string;
  riskLabel: string;
  findingStates: string[];
}

export interface DependencyConsoleModel {
  context: {
    projectId: string;
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
    dependencyCount: number;
    blockedCount: number;
    releaseBlockerCount: number;
    sbomNoticeCount: number;
    evidenceLinkedCount: number;
  };
  dependencies: DependencyConsoleRow[];
  selectedDependency: DependencyConsoleRow;
  governanceIndex: DependencyGovernanceIndexReadback;
  serviceOverview: Array<{ label: string; value: string }>;
  unavailableActions: Array<{ label: string; reason: string }>;
}

const actor: ActorIdentity = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "dependency-console-visible-slice"
};

const estimate: Estimate = {
  effortPoints: 3,
  complexity: "medium",
  risk: "L3",
  verificationCost: "medium",
  confidence: "medium"
};

export function createDependencyConsoleModel(): DependencyConsoleModel {
  const { store, story, evidence, gate } = governanceFixture();
  const dependencies = dependencyLifecycleStates.map((state) => store.createDependencyRecord({
    projectId: "TCRN-AOS",
    ecosystem: "npm",
    packageName: `fixture-${state}`,
    versionRange: state === "removed" ? "removed" : "1.0.0",
    sourceSystem: "deterministic_fixture",
    projectUsage: state === "historical" ? "historical" : "development",
    ownerRole: "security",
    lifecycleState: state,
    artifactRef: `package:fixture-${state}@1.0.0`,
    licenseExpression: state === "denied" ? "GPL-3.0-only" : "MIT",
    declaredLicenseEvidence: `declared-${state}`,
    discoveredLicenseEvidence: `discovered-${state}`,
    evidenceArtifactRef: evidence.id,
    evidenceStatus: state === "unapproved" ? "evidence_missing" : "present",
    confidence: "high",
    policyClass: state === "denied" ? "denied" : state === "unapproved" ? "unknown" : "review_required",
    reviewerRole: "security",
    residualRisk: state === "denied" ? "blocked" : "low",
    nextAction: state === "denied" ? "replace_dependency" : state === "unapproved" ? "request_review" : "none",
    sbomNoticeObligation: state === "current" ? "none" : "review_required",
    posture: dependencyPostureForState(state),
    approvalOwnerRole: "security",
    linkedStoryIds: [story.id],
    linkedEvidenceIds: [evidence.id],
    releaseBlocker: ["denied", "expired", "unapproved"].includes(state),
    packageMutationExecuted: false
  }, actor));

  for (const dependency of dependencies) {
    const state = dependency.lifecycleState ?? "current";
    store.createDependencyDetectionFinding({
      projectId: "TCRN-AOS",
      dependencyId: dependency.id,
      state,
      sourceSystem: "deterministic_fixture",
      evidenceIds: [evidence.id],
      linkedGateIds: [gate.id],
      remediationExecuted: false,
      packageMutationExecuted: false,
      nextAction: ["denied", "expired", "unapproved"].includes(state) ? "request_review" : "none"
    }, actor);
  }
  const blockedDependency = dependencies[1];
  if (!blockedDependency) {
    throw new Error("dependency_console_blocked_fixture_missing");
  }
  store.linkDependencyGate(blockedDependency.id, gate.id, actor);

  const governanceIndex = store.createDependencyGovernanceIndex("TCRN-AOS");
  const findingsByDependency = groupFindings(store.listDependencyFindings());
  const dependencyRows = store.listDependencies().map((dependency) => mapDependency(dependency, findingsByDependency.get(dependency.id) ?? []));
  const selectedDependency = dependencyRows.find((dependency) => dependency.releaseBlocker) ?? dependencyRows[0] ?? fallbackDependency();

  const targetSetModel = createAOSWideProductDesignModel();
  const targetSetRow = targetSetModel.surfaces.find((surface) => surface.id === "dependency-license");
  if (!targetSetRow) {
    throw new Error("dependency_console_target_set_surface_missing");
  }

  return {
    context: {
      projectId: "TCRN-AOS",
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
      dependencyCount: dependencyRows.length,
      blockedCount: governanceIndex.blockedDependencyIds.length,
      releaseBlockerCount: governanceIndex.releaseBlockerDependencyIds.length,
      sbomNoticeCount: governanceIndex.sbomNoticeRequiredDependencyIds.length,
      evidenceLinkedCount: governanceIndex.linkedEvidenceIds.length
    },
    dependencies: dependencyRows,
    selectedDependency,
    governanceIndex,
    serviceOverview: [
      { label: "Source", value: "Local service preview" },
      { label: "Project", value: "TCRN-AOS" },
      { label: "Dependency records", value: String(dependencyRows.length) },
      { label: "Findings", value: String(governanceIndex.detectionFindingIds.length) },
      { label: "Blocked dependencies", value: String(governanceIndex.blockedDependencyIds.length) },
      { label: "Release blockers", value: String(governanceIndex.releaseBlockerDependencyIds.length) }
    ],
    unavailableActions: [
      { label: "Approve dependency", reason: "Dependency approvals are not enabled from this local governance preview." },
      { label: "Replace dependency", reason: "Package mutation stays disabled in this local governance preview." },
      { label: "Export report", reason: "Export is not enabled from this local governance preview." },
      { label: "Send live update", reason: "Live updates are not enabled from this local governance preview." }
    ]
  };
}

function governanceFixture() {
  const store = new AosStore(createDefaultSeed());
  const initiative = store.createInitiative({
    projectId: "TCRN-AOS",
    title: "Dependency and resource governance",
    status: "in_progress",
    problem: "Release views need unresolved obligations without claiming completion.",
    expectedOutcome: "AOS records posture metadata, gates, evidence, and residual findings locally."
  }, actor);
  const epic = store.createEpic({
    initiativeId: initiative.id,
    title: "Dependency and resource governance",
    goal: "Build local-first index readbacks for license and resource posture.",
    status: "in_progress"
  }, actor);
  const story = store.createStory({
    epicId: epic.id,
    title: "Index dependency and resource governance",
    problem: "Release views need unresolved obligations without claiming completion.",
    user: "security and evidence reviewer",
    expectedBehavior: "AOS records posture metadata, gates, evidence, and residual findings locally.",
    acceptanceCriteria: ["dependency lifecycle matrix", "resource audit matrix", "materialization requests remain gated", "no legal completion claims"],
    status: "in_progress",
    estimate,
    subTasks: []
  }, actor);
  const evidence = store.linkEvidence({
    type: "artifact_id",
    target: "slice-7-governance-index-proof",
    validity: "valid",
    producer: actor.employeeId,
    digest: "sha256:slice7",
    redactionState: "metadata_only"
  }, actor);
  const gate = store.requestGate({
    type: "security_license",
    linkedTicketId: story.id,
    inputEvidenceIds: [evidence.id]
  }, actor);
  return { store, story, evidence, gate };
}

function mapDependency(dependency: DependencyLifecycleRecord, findings: DependencyDetectionFinding[]): DependencyConsoleRow {
  return {
    id: dependency.id,
    packageName: dependency.packageName,
    lifecycleLabel: presentLifecycle(dependency.lifecycleState ?? "current"),
    postureLabel: presentPosture(dependency.posture),
    licenseExpression: dependency.licenseExpression,
    sbomLabel: dependency.sbomNoticeObligation === "none" ? "None" : "Review required",
    evidenceLabel: dependency.evidenceStatus === "present" ? "Evidence linked" : dependency.evidenceStatus === "evidence_missing" ? "Evidence missing" : "Conflict",
    reviewerLabel: dependency.reviewerRole === "security" ? "Security review" : "Reviewer pending",
    linkedGateCount: dependency.linkedGateIds.length,
    linkedEvidenceCount: dependency.linkedEvidenceIds?.length ?? 0,
    releaseBlocker: dependency.releaseBlocker === true,
    nextActionLabel: presentNextAction(dependency.nextAction ?? "none"),
    riskLabel: presentRisk(dependency.residualRisk ?? "none"),
    findingStates: findings.map((finding) => presentLifecycle(finding.state))
  };
}

function dependencyPostureForState(state: (typeof dependencyLifecycleStates)[number]): DependencyPosture {
  if (state === "current" || state === "unapproved") {
    return "review_required";
  }
  if (state === "historical") {
    return "accepted_with_residual_risk";
  }
  if (state === "unused") {
    return "deprecated";
  }
  return state;
}

function groupFindings(findings: DependencyDetectionFinding[]) {
  const map = new Map<string, DependencyDetectionFinding[]>();
  for (const finding of findings) {
    const existing = map.get(finding.dependencyId) ?? [];
    existing.push(finding);
    map.set(finding.dependencyId, existing);
  }
  return map;
}

function presentLifecycle(state: string) {
  return state
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function presentPosture(state: string) {
  if (state === "review_required") return "Review required";
  if (state === "accepted_with_residual_risk") return "Residual risk accepted";
  if (state === "deprecated") return "Deprecated";
  if (state === "blocked") return "Blocked";
  return presentLifecycle(state);
}

function presentNextAction(action: string) {
  if (action === "none") return "None";
  if (action === "request_review") return "Request review";
  if (action === "replace_dependency") return "Replace dependency";
  if (action === "remove_dependency") return "Remove dependency";
  return "Owner action review";
}

function presentRisk(risk: string) {
  if (risk === "none") return "None";
  if (risk === "low") return "Low";
  if (risk === "medium") return "Medium";
  if (risk === "high") return "High";
  return "Blocked";
}

function fallbackDependency(): DependencyConsoleRow {
  return {
    id: "dependency-unavailable",
    packageName: "No dependency record",
    lifecycleLabel: "Unknown",
    postureLabel: "Unknown",
    licenseExpression: "UNKNOWN",
    sbomLabel: "Review required",
    evidenceLabel: "Evidence missing",
    reviewerLabel: "Security review",
    linkedGateCount: 0,
    linkedEvidenceCount: 0,
    releaseBlocker: true,
    nextActionLabel: "Request review",
    riskLabel: "Blocked",
    findingStates: []
  };
}
