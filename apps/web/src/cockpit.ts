import type {
  AuditEvent,
  DependencyLifecycleRecord,
  GateWorkOrder,
  ProjectRecord,
  ResourceRegistryRecord,
  StageMapItem
} from "../../../packages/domain/src/index.js";

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
