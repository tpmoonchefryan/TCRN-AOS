import type { AIEmployee, ProjectRecord, StageDefinition } from "./types.js";

export const seedProjects: ProjectRecord[] = [
  {
    id: "TCRN-TMS",
    name: "TCRN Transportation Management System",
    registryStatus: "active",
    repoRegistryId: "TCRN-TMS",
    repoPathReference: "../TCRN-TMS",
    status: "in_progress",
    gateState: "pending_role",
    evidenceIds: [],
    decisionHistory: []
  },
  {
    id: "TCRN-AOS",
    name: "TCRN Agent Operations System",
    registryStatus: "planned",
    repoRegistryId: "TCRN-AOS",
    repoPathReference: "../TCRN-AOS",
    status: "proposed",
    gateState: "pending_role",
    evidenceIds: [],
    decisionHistory: []
  }
];

export const seedEmployees: AIEmployee[] = [
  {
    id: "employee-arturo",
    name: "Arturo",
    role: "coordinator",
    authoritySummary: "Thread orchestration and route coordination.",
    contactWhen: "Route implementation, review, and release owners.",
    lifecycle: "active",
    threadIdentity: {
      threadId: "019eb66e-00d1-7190-81d9-693895b32033",
      status: "active",
      lifecycle: "persistent"
    },
    roleContractRefs: ["thread-orchestrator"],
    skillRefs: ["handoff-routing"]
  },
  {
    id: "employee-ilya",
    name: "Ilya",
    role: "implementation",
    authoritySummary: "Scoped full-stack implementation with explicit write scope.",
    contactWhen: "Narrowed feature slice is implementation-ready.",
    lifecycle: "active",
    threadIdentity: {
      threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
      status: "active",
      lifecycle: "persistent"
    },
    roleContractRefs: ["full-stack-implementer"],
    skillRefs: ["minimal-change-engineer"]
  },
  {
    id: "employee-sable",
    name: "Sable",
    role: "security",
    authoritySummary: "Security, privacy, license, and export posture review.",
    contactWhen: "Security, license, or product-boundary risk appears.",
    lifecycle: "active",
    threadIdentity: {
      threadId: "sable-thread",
      status: "active",
      lifecycle: "persistent"
    },
    roleContractRefs: ["security-review"],
    skillRefs: ["risk-boundary"]
  },
  {
    id: "employee-atlas",
    name: "Atlas",
    role: "owner_observer",
    authoritySummary: "Environment Resource Steward; backup-create authority is method-scoped by AOS transport.",
    contactWhen: "Route owner-authorized local backup and restore proof work.",
    lifecycle: "active",
    threadIdentity: {
      threadId: "atlas-thread",
      status: "active",
      lifecycle: "persistent"
    },
    roleContractRefs: ["environment-resource-steward"],
    skillRefs: ["backup-restore-governance"]
  },
  {
    id: "aos-service-scheduler",
    name: "AOS Service Scheduler",
    role: "owner_observer",
    authoritySummary: "System actor with backup-create authority only; no ticket, gate, or knowledge write authority.",
    contactWhen: "Backend-only backup scheduler execution.",
    lifecycle: "active",
    threadIdentity: {
      threadId: "aos-service-scheduler-system",
      status: "active",
      lifecycle: "persistent"
    },
    roleContractRefs: ["aos-service-scheduler"],
    skillRefs: ["backup-scheduler"]
  }
];

export const seedStages: StageDefinition[] = [
  {
    id: "intake",
    label: "Intake",
    defaultOwnerRoles: ["coordinator", "product_strategy"],
    gateTypes: ["product_strategy"],
    evidenceExpectation: "Intent and scope are captured."
  },
  {
    id: "architecture",
    label: "Architecture",
    defaultOwnerRoles: ["architecture", "security"],
    gateTypes: ["architecture", "security_license"],
    evidenceExpectation: "Topology and security conditions are accepted."
  },
  {
    id: "implementation",
    label: "Implementation",
    defaultOwnerRoles: ["implementation"],
    gateTypes: ["evidence_proof"],
    evidenceExpectation: "Implementation proof is linked."
  },
  {
    id: "release",
    label: "Release",
    defaultOwnerRoles: ["release"],
    gateTypes: ["release_closeout"],
    evidenceExpectation: "External release proof is required before readiness claims."
  }
];

export function createDefaultSeed() {
  return {
    projects: seedProjects,
    employees: seedEmployees,
    stageDefinitions: seedStages
  };
}
