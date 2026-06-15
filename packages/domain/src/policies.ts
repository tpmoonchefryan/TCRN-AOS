import type { ActorIdentity, ActorRole, GateWorkOrder } from "./types.js";

const writeRoles: ActorRole[] = [
  "owner_intent_submitter",
  "admin",
  "break_glass_admin",
  "coordinator",
  "product_strategy",
  "architecture",
  "implementation",
  "verification",
  "security",
  "evidence",
  "release",
  "knowledge",
  "registrar"
];

export const POLICY_VERSION = "aos-slice-1-policy-2026-06-15";

export function canWrite(actor: ActorIdentity): boolean {
  return writeRoles.includes(actor.role);
}

export function canApproveGate(actor: ActorIdentity, gateType: GateWorkOrder["type"]): boolean {
  if (gateType === "owner_intent") {
    return actor.role === "owner";
  }
  return resolveGateOwner(gateType) === actor.role || actor.role === "break_glass_admin";
}

export function resolveGateOwner(gateType: GateWorkOrder["type"]): ActorRole {
  switch (gateType) {
    case "product_strategy":
      return "product_strategy";
    case "architecture":
      return "architecture";
    case "security_license":
      return "security";
    case "evidence_proof":
      return "verification";
    case "release_closeout":
      return "release";
    case "owner_intent":
      return "owner";
  }
}

export function requiresOwnerIntent(action: string): boolean {
  return [
    "remote_publication",
    "deployment",
    "repo_creation_remote",
    "authority_move",
    "root_cleanup",
    "delete_product_repo",
    "secret_export_exception",
    "legal_completion_claim"
  ].includes(action);
}
