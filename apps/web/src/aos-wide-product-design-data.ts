export const slice10WorkflowPacketBasis = "bcff619a406f2028e6c70ea76a3ade1674e3ca21";
export const slice10PreImplementationBasis = "06cded11e97be6d4a738a21ae942128d5b4688cd";
export const slice10LocalCheckpoint = "slice-10-aos-wide-product-design-surface-set";

export const aosWideAcceptedAnchorTargets = [
  "apps/web/static/operations-cockpit.html",
  "apps/web/static/docs-search-release-readiness.html",
  "apps/web/static/aos-wide-product-design.html"
] as const;

export const requiredAosWideSelectors = [
  "[data-region='aos-wide-shell']",
  "[data-region='brand-lockup']",
  "[data-region='target-path-readback']",
  "[data-region='project-dashboard-hierarchy']",
  "[data-region='initiative-ticket-drillthrough']",
  "[data-region='ai-employee-profile']",
  "[data-region='gate-owner-intent']",
  "[data-region='conference-minutes']",
  "[data-region='gateway-adapter-health']",
  "[data-region='knowledge-release-modules']",
  "[data-region='dependency-governance-console']",
  "[data-region='resource-library-traceability']",
  "[data-region='admin-access-audit-shell']",
  "[data-region='surface-index']",
  "[data-region='detail-panel']",
  "[data-region='evidence-readiness-panel']"
] as const;

export const forbiddenAosWidePositiveCopy = [
  "AOS-wide Product Design accepted",
  "product accepted",
  "final MVP accepted",
  "deployment ready",
  "release ready",
  "public ready",
  "legal complete",
  "dependency clean",
  "docs published",
  "docs exported",
  "canonical knowledge promoted",
  "GitHub release created",
  "live dispatch enabled",
  "resource materialized",
  "product repo written",
  "Codex Security scan completed"
] as const;

export interface Slice10RequiredStateFields {
  productDesignStatus: "target_set_implemented_pending_review";
  aosWideProductDesignAccepted: false;
  deploymentProof: "not_claimed";
  liveDispatch: false;
  threadRegistryMutation: false;
  releaseReadiness: "not_claimed";
  productAcceptance: "not_claimed";
  finalMvpAcceptance: "not_claimed";
  docsExport: "not_executed";
  docsPublication: "not_claimed";
  canonicalPromotion: "not_claimed";
  githubMutation: false;
  scannerIngestion: false;
  materializationExecuted: false;
  productRepoWrite: false;
  codexSecurityScan: "not_run";
  externalProofRequired: true;
}

export interface SurfaceReadiness {
  desktopReadyForCapture: true;
  mobileReadyForCapture: true;
  bodyOverflowExpected: false;
  denseOverflowConfinedTo: "surface-index-table";
  consolePageErrorExpectation: "none_expected";
}

export interface SurfaceRow {
  id: string;
  title: string;
  surface: string;
  owner: string;
  state: "current" | "review_required" | "blocked" | "pending_external_proof";
  stage: string;
  blocker: string;
  evidence: string;
  detail: string;
  disabledAction: string;
  terms: string[];
}

export interface AOSWideProductDesignModel {
  context: {
    projectId: "TCRN-AOS";
    workflowPacketBasis: string;
    preImplementationBasis: string;
    localCheckpoint: string;
    productDesignStatus: Slice10RequiredStateFields["productDesignStatus"];
    acceptedAnchorTargets: readonly string[];
    targetSetImplemented: true;
  };
  requiredState: Slice10RequiredStateFields;
  surfaces: SurfaceRow[];
  evidenceReadiness: Record<string, SurfaceReadiness>;
  targetPathReadback: {
    operationsCockpit: string;
    docsSearchRelease: string;
    aosWideTarget: string;
  };
  d024Boundary: {
    localFirstOperationalData: true;
    gitTracksOnlySourceSchemasFixturesDocsScriptsTestsEvidence: true;
    runtimeOperationalDumpCommitted: false;
    rawPrivatePayloadStored: false;
  };
  restrictedPayloadPosture: {
    rawSourceStored: false;
    secretsStored: false;
    authStateStored: false;
    shellHistoryStored: false;
    browserKeychainStored: false;
    rawScannerOutputStored: false;
    localAbsolutePathStored: false;
  };
}

const defaultReadiness: SurfaceReadiness = {
  desktopReadyForCapture: true,
  mobileReadyForCapture: true,
  bodyOverflowExpected: false,
  denseOverflowConfinedTo: "surface-index-table",
  consolePageErrorExpectation: "none_expected"
};

export function createAOSWideProductDesignModel(): AOSWideProductDesignModel {
  const surfaces: SurfaceRow[] = [
    surfaceRow("project-hierarchy", "Project Dashboard", "Project dashboard and hierarchy", "Mara / Ilya", "current", "Project spine", "external proof required", "fresh local evidence", "Project header, initiative summary, hierarchy, stage ownership, blockers, and freshness are visible.", "project switch is readback only", ["project", "hierarchy", "initiative", "stage", "freshness"]),
    surfaceRow("ticket-drillthrough", "Initiative Detail", "Initiative and ticket drill-through", "Ilya", "review_required", "Ticket inspection", "gate evidence required", "linked metadata", "Epic, story, assignment, gates, evidence links, decisions, comments, and subtasks are inspectable.", "write action stays disabled", ["initiative", "ticket", "story", "assignment", "comment", "subtask"]),
    surfaceRow("ai-employee-profile", "AI Employee", "AI employee list and profile", "Ariadne / Ilya", "current", "Responsibility", "thread truth external", "role snapshot", "Role identity, thread identity, lifecycle, assignments, authority posture, and last readback are visible.", "thread mutation blocked", ["ai", "employee", "role", "thread", "assignment", "blocked"]),
    surfaceRow("gates-owner-intent", "Gate Queue", "Approvals, gates, and Owner Intent", "Verity / owner gate", "blocked", "Approvals", "Owner Intent required", "gate work order", "Role-owned gates and Owner Intent gates remain separate with required evidence and residual blockers.", "true-owner action disabled", ["gate", "approval", "owner intent", "evidence", "disabled"]),
    surfaceRow("conference-minutes", "Conference", "Conference list, detail, and minutes", "Arturo", "review_required", "Conference loop", "missing participant readback", "minutes metadata", "Conference metadata, participants, linked tickets, positions, outcomes, minutes, and residual actions are visible.", "live invite disabled", ["conference", "minutes", "position", "outcome", "dry-run"]),
    surfaceRow("gateway-adapter", "Gateway / Adapter", "MCP Gateway and Codex Adapter health", "Ilya / Sable", "current", "Control plane", "live dispatch blocked", "audit metadata", "Gateway status, adapter dry-run outbox, idempotency, role binding, audit, and redaction posture are visible.", "live dispatch disabled", ["mcp", "gateway", "adapter", "outbox", "dedupe", "redaction"]),
    surfaceRow("knowledge-release", "Knowledge Modules", "Knowledge Base, User Guide, Release Notes", "Mneme / Rowan", "pending_external_proof", "Docs readiness", "export proof required", "docs metadata", "Module indexes, local-first posture, proposals, readiness states, and blocked export/publish posture are visible.", "publish action disabled", ["knowledge", "guide", "release notes", "docs", "export"]),
    surfaceRow("dependency-license", "Dependency Console", "Dependency and license governance", "Sable", "blocked", "Governance", "review gate required", "license metadata", "Dependency lifecycle, license evidence, SBOM/NOTICE obligations, review gates, and residual risk are visible.", "legal completion unavailable", ["dependency", "license", "sbom", "notice", "risk"]),
    surfaceRow("resource-library", "Resource Library", "Resource materialization and traceability", "Sable / Atlas", "blocked", "Resource controls", "materialization not executed", "resource metadata", "Resource records, materialization requests/history, manifests, audit, update/rollback posture, and traceability are visible.", "materialize action disabled", ["resource", "materialization", "rollback", "manifest", "traceability"]),
    surfaceRow("admin-access-audit", "Admin / Access", "Minimal admin, access, and audit shell", "Sable / Ariadne", "blocked", "Access posture", "break-glass blocked", "audit metadata", "Read-only access posture, authz boundary, role permissions, audit trail status, and blocked break-glass posture are visible.", "admin mutation disabled", ["admin", "access", "authz", "audit", "break-glass"])
  ];

  return {
    context: {
      projectId: "TCRN-AOS",
      workflowPacketBasis: slice10WorkflowPacketBasis,
      preImplementationBasis: slice10PreImplementationBasis,
      localCheckpoint: slice10LocalCheckpoint,
      productDesignStatus: "target_set_implemented_pending_review",
      acceptedAnchorTargets: aosWideAcceptedAnchorTargets,
      targetSetImplemented: true
    },
    requiredState: {
      productDesignStatus: "target_set_implemented_pending_review",
      aosWideProductDesignAccepted: false,
      deploymentProof: "not_claimed",
      liveDispatch: false,
      threadRegistryMutation: false,
      releaseReadiness: "not_claimed",
      productAcceptance: "not_claimed",
      finalMvpAcceptance: "not_claimed",
      docsExport: "not_executed",
      docsPublication: "not_claimed",
      canonicalPromotion: "not_claimed",
      githubMutation: false,
      scannerIngestion: false,
      materializationExecuted: false,
      productRepoWrite: false,
      codexSecurityScan: "not_run",
      externalProofRequired: true
    },
    surfaces,
    evidenceReadiness: Object.fromEntries(surfaces.map((surface) => [surface.id, { ...defaultReadiness }])),
    targetPathReadback: {
      operationsCockpit: aosWideAcceptedAnchorTargets[0],
      docsSearchRelease: aosWideAcceptedAnchorTargets[1],
      aosWideTarget: aosWideAcceptedAnchorTargets[2]
    },
    d024Boundary: {
      localFirstOperationalData: true,
      gitTracksOnlySourceSchemasFixturesDocsScriptsTestsEvidence: true,
      runtimeOperationalDumpCommitted: false,
      rawPrivatePayloadStored: false
    },
    restrictedPayloadPosture: {
      rawSourceStored: false,
      secretsStored: false,
      authStateStored: false,
      shellHistoryStored: false,
      browserKeychainStored: false,
      rawScannerOutputStored: false,
      localAbsolutePathStored: false
    }
  };
}

function surfaceRow(id: string, title: string, surface: string, owner: string, state: SurfaceRow["state"], stage: string, blocker: string, evidence: string, detail: string, disabledAction: string, terms: string[]): SurfaceRow {
  return {
    id,
    title,
    surface,
    owner,
    state,
    stage,
    blocker,
    evidence,
    detail,
    disabledAction,
    terms
  };
}
