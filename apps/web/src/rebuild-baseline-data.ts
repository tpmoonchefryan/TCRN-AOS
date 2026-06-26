export const rebuildBaselineDsStandardIds = [
  "ds-aos-operations-cockpit-v1",
  "ds-aos-docs-readiness-v1",
  "ds-aos-target-set-v1"
] as const;

export const rebuildBaselineStorybookIds = [
  "tcrn-design-system-patterns--aos-operations-cockpit-standard",
  "tcrn-design-system-patterns--aos-docs-readiness-standard",
  "tcrn-design-system-patterns--aos-product-design-target-set-standard"
] as const;

export const rebuildBaselineRoutes = [
  "/operations-cockpit.html",
  "/docs-search-release-readiness.html",
  "/aos-wide-product-design.html",
  "/project-workspace.html",
  "/initiative-detail.html",
  "/ai-employee.html",
  "/gate-queue.html",
  "/conference.html",
  "/gateway-adapter.html",
  "/dependency-console.html",
  "/resource-library.html",
  "/knowledge-modules.html",
  "/admin-access.html",
  "/github-release-linkage.html"
] as const;

export const requiredRebuildBaselineSelectors = [
  "[data-surface='aos-rebuild-workspace']",
  "[data-region='rebuild-shell']",
  "[data-region='rebuild-nav']",
  "[data-region='rebuild-topbar']",
  "[data-region='rebuild-summary']",
  "[data-region='cockpit-start']",
  "[data-region='cockpit-work-index']",
  "[data-region='cockpit-detail']",
  "[data-region='docs-start']",
  "[data-region='docs-filter']",
  "[data-region='docs-detail']",
  "[data-region='target-set-start']",
  "[data-region='target-set-modules']",
  "[data-region='target-set-detail']",
  "[data-region='project-workspace-start']",
  "[data-region='project-workspace-hierarchy']",
  "[data-region='project-workspace-detail']",
  "[data-region='initiative-detail-start']",
  "[data-region='initiative-detail-ticket']",
  "[data-region='initiative-detail-links']",
  "[data-region='initiative-detail-activity']",
  "[data-region='ai-employee-start']",
  "[data-region='ai-employee-roster']",
  "[data-region='ai-employee-detail']",
  "[data-region='gate-queue-start']",
  "[data-region='gate-queue-list']",
  "[data-region='gate-queue-detail']",
  "[data-region='conference-start']",
  "[data-region='conference-list']",
  "[data-region='conference-detail']",
  "[data-region='gateway-adapter-start']",
  "[data-region='gateway-adapter-list']",
  "[data-region='gateway-adapter-detail']",
  "[data-region='dependency-console-start']",
  "[data-region='dependency-console-list']",
  "[data-region='dependency-console-detail']",
  "[data-region='resource-library-start']",
  "[data-region='resource-library-list']",
  "[data-region='resource-library-detail']",
  "[data-region='knowledge-modules-start']",
  "[data-region='knowledge-modules-list']",
  "[data-region='knowledge-modules-detail']",
  "[data-region='admin-access-start']",
  "[data-region='admin-access-list']",
  "[data-region='admin-access-detail']",
  "[data-region='github-release-linkage-start']",
  "[data-region='github-release-linkage-list']",
  "[data-region='github-release-linkage-detail']",
  "[data-region='rebuild-checklist']",
  "[data-region='rebuild-boundaries']",
  "[data-region='rebuild-actions']"
] as const;

export const forbiddenRebuildBaselineFreshSectionSelectors = [
] as const;

export const forbiddenRebuildBaselineVisibleCopy = [
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

export interface RebuildChecklistRow {
  id: string;
  label: string;
  status: "workspace_active" | "rebuild_queued";
  source: string;
  note: string;
}

export interface RebuildCurrentEntryFocus {
  label: string;
  anchor: string;
  checklistId: string;
  entryMode: string;
  summary: string;
}

export interface RebuildCockpitStartItem {
  id: string;
  title: string;
  state: "current" | "blocked";
  owner: string;
}

export interface RebuildCockpitStartDetailItem {
  key: string;
  label: string;
  value: string;
}

export interface RebuildCockpitStartAction {
  label: string;
  reason: string;
}

export interface RebuildCockpitStartModel {
  title: string;
  summary: string;
  standardId: string;
  storybookId: string;
  evidence: readonly string[];
  workItems: readonly RebuildCockpitStartItem[];
  detailTitle: string;
  detailItems: readonly RebuildCockpitStartDetailItem[];
  postureItems: readonly RebuildCockpitStartDetailItem[];
  actions: readonly RebuildCockpitStartAction[];
}

export interface RebuildDocsStartFilterOption {
  value: string;
  label: string;
}

export interface RebuildDocsStartRow {
  path: string;
  state: "current" | "blocked";
  linkage: string;
}

export interface RebuildDocsStartDetailItem {
  key: string;
  label: string;
  value: string;
}

export interface RebuildDocsStartAction {
  label: string;
  reason: string;
}

export interface RebuildDocsStartModel {
  title: string;
  summary: string;
  standardId: string;
  storybookId: string;
  evidence: readonly string[];
  searchPlaceholder: string;
  stateOptions: readonly RebuildDocsStartFilterOption[];
  rows: readonly RebuildDocsStartRow[];
  detailTitle: string;
  detailItems: readonly RebuildDocsStartDetailItem[];
  actions: readonly RebuildDocsStartAction[];
}

export interface RebuildTargetSetCard {
  id: string;
  title: string;
  state: "current" | "blocked";
  detail: string;
}

export interface RebuildTargetSetRow {
  id: string;
  title: string;
  state: "current" | "blocked";
  owner: string;
}

export interface RebuildTargetSetDetailItem {
  key: string;
  label: string;
  value: string;
}

export interface RebuildTargetSetAction {
  label: string;
  reason: string;
}

export interface RebuildTargetSetModel {
  title: string;
  summary: string;
  standardId: string;
  storybookId: string;
  evidence: readonly string[];
  cards: readonly RebuildTargetSetCard[];
  indexRows: readonly RebuildTargetSetRow[];
  detailTitle: string;
  detailItems: readonly RebuildTargetSetDetailItem[];
  actions: readonly RebuildTargetSetAction[];
}

export interface RebuildProjectWorkspaceHierarchyItem {
  key: string;
  label: string;
  value: string;
}

export interface RebuildProjectWorkspaceStory {
  id: string;
  title: string;
  state: "current" | "blocked";
  owner: string;
}

export interface RebuildProjectWorkspaceDetailItem {
  key: string;
  label: string;
  value: string;
}

export interface RebuildProjectWorkspaceAction {
  label: string;
  reason: string;
}

export interface RebuildProjectWorkspaceModel {
  title: string;
  summary: string;
  standardIds: readonly string[];
  storybookIds: readonly string[];
  evidence: readonly string[];
  hierarchy: readonly RebuildProjectWorkspaceHierarchyItem[];
  stories: readonly RebuildProjectWorkspaceStory[];
  detailTitle: string;
  detailItems: readonly RebuildProjectWorkspaceDetailItem[];
  actions: readonly RebuildProjectWorkspaceAction[];
}

export interface RebuildInitiativeDetailLink {
  type: string;
  label: string;
  target: string;
  state: string;
}

export interface RebuildInitiativeDecision {
  label: string;
  summary: string;
  state: string;
}

export interface RebuildInitiativeActivity {
  label: string;
  summary: string;
}

export interface RebuildInitiativeDetailModel {
  title: string;
  summary: string;
  standardIds: readonly string[];
  storybookIds: readonly string[];
  evidence: readonly string[];
  ticketItems: readonly RebuildProjectWorkspaceDetailItem[];
  links: readonly RebuildInitiativeDetailLink[];
  decisions: readonly RebuildInitiativeDecision[];
  activity: readonly RebuildInitiativeActivity[];
  actions: readonly RebuildProjectWorkspaceAction[];
}

export interface RebuildAiEmployeeRow {
  id: string;
  name: string;
  role: string;
  thread: string;
  stories: string;
  conferences: string;
  status: "current" | "blocked";
}

export interface RebuildAiEmployeeDetailItem {
  key: string;
  label: string;
  value: string;
}

export interface RebuildAiEmployeeModel {
  title: string;
  summary: string;
  standardIds: readonly string[];
  storybookIds: readonly string[];
  evidence: readonly string[];
  rows: readonly RebuildAiEmployeeRow[];
  detailTitle: string;
  detailItems: readonly RebuildAiEmployeeDetailItem[];
  actions: readonly RebuildProjectWorkspaceAction[];
}

export interface RebuildGateQueueRow {
  queue: string;
  gate: string;
  owner: string;
  work: string;
  evidence: string;
  status: "current" | "blocked";
}

export interface RebuildGateQueueDetailItem {
  key: string;
  label: string;
  value: string;
}

export interface RebuildGateQueueModel {
  title: string;
  summary: string;
  standardIds: readonly string[];
  storybookIds: readonly string[];
  evidence: readonly string[];
  rows: readonly RebuildGateQueueRow[];
  detailTitle: string;
  detailItems: readonly RebuildGateQueueDetailItem[];
  actions: readonly RebuildProjectWorkspaceAction[];
}

export interface RebuildConferenceRow {
  title: string;
  initiator: string;
  participants: string;
  minutes: string;
  evidence: string;
  status: "current" | "blocked";
}

export interface RebuildConferenceDetailItem {
  key: string;
  label: string;
  value: string;
}

export interface RebuildConferenceModel {
  title: string;
  summary: string;
  standardIds: readonly string[];
  storybookIds: readonly string[];
  evidence: readonly string[];
  rows: readonly RebuildConferenceRow[];
  detailTitle: string;
  detailItems: readonly RebuildConferenceDetailItem[];
  actions: readonly RebuildProjectWorkspaceAction[];
}

export interface RebuildGatewayAdapterRow {
  title: string;
  transport: string;
  posture: string;
  audit: string;
  nextAction: string;
  status: "current" | "blocked";
}

export interface RebuildGatewayAdapterDetailItem {
  key: string;
  label: string;
  value: string;
}

export interface RebuildGatewayAdapterModel {
  title: string;
  summary: string;
  standardIds: readonly string[];
  storybookIds: readonly string[];
  evidence: readonly string[];
  rows: readonly RebuildGatewayAdapterRow[];
  detailTitle: string;
  detailItems: readonly RebuildGatewayAdapterDetailItem[];
  actions: readonly RebuildProjectWorkspaceAction[];
}

export interface RebuildDependencyConsoleRow {
  packageName: string;
  lifecycle: string;
  posture: string;
  license: string;
  nextAction: string;
  status: "current" | "blocked";
}

export interface RebuildDependencyConsoleDetailItem {
  key: string;
  label: string;
  value: string;
}

export interface RebuildDependencyConsoleModel {
  title: string;
  summary: string;
  standardIds: readonly string[];
  storybookIds: readonly string[];
  evidence: readonly string[];
  rows: readonly RebuildDependencyConsoleRow[];
  detailTitle: string;
  detailItems: readonly RebuildDependencyConsoleDetailItem[];
  actions: readonly RebuildProjectWorkspaceAction[];
}

export interface RebuildResourceLibraryRow {
  title: string;
  manifest: string;
  traceability: string;
  audit: string;
  nextAction: string;
  status: "current" | "blocked";
}

export interface RebuildResourceLibraryDetailItem {
  key: string;
  label: string;
  value: string;
}

export interface RebuildResourceLibraryModel {
  title: string;
  summary: string;
  standardIds: readonly string[];
  storybookIds: readonly string[];
  evidence: readonly string[];
  rows: readonly RebuildResourceLibraryRow[];
  detailTitle: string;
  detailItems: readonly RebuildResourceLibraryDetailItem[];
  actions: readonly RebuildProjectWorkspaceAction[];
}

export interface RebuildKnowledgeModulesRow {
  title: string;
  scope: string;
  readiness: string;
  posture: string;
  nextAction: string;
  status: "current" | "blocked";
}

export interface RebuildKnowledgeModulesDetailItem {
  key: string;
  label: string;
  value: string;
}

export interface RebuildKnowledgeModulesModel {
  title: string;
  summary: string;
  standardIds: readonly string[];
  storybookIds: readonly string[];
  evidence: readonly string[];
  rows: readonly RebuildKnowledgeModulesRow[];
  detailTitle: string;
  detailItems: readonly RebuildKnowledgeModulesDetailItem[];
  actions: readonly RebuildProjectWorkspaceAction[];
}

export interface RebuildAdminAccessRow {
  title: string;
  permissions: string;
  audit: string;
  posture: string;
  nextAction: string;
  status: "current" | "blocked";
}

export interface RebuildAdminAccessDetailItem {
  key: string;
  label: string;
  value: string;
}

export interface RebuildAdminAccessModel {
  title: string;
  summary: string;
  standardIds: readonly string[];
  storybookIds: readonly string[];
  evidence: readonly string[];
  rows: readonly RebuildAdminAccessRow[];
  detailTitle: string;
  detailItems: readonly RebuildAdminAccessDetailItem[];
  actions: readonly RebuildProjectWorkspaceAction[];
}

export interface RebuildGitHubReleaseLinkageRow {
  title: string;
  repo: string;
  posture: string;
  blocker: string;
  nextAction: string;
  status: "current" | "blocked";
}

export interface RebuildGitHubReleaseLinkageDetailItem {
  key: string;
  label: string;
  value: string;
}

export interface RebuildGitHubReleaseLinkageModel {
  title: string;
  summary: string;
  standardIds: readonly string[];
  storybookIds: readonly string[];
  evidence: readonly string[];
  rows: readonly RebuildGitHubReleaseLinkageRow[];
  detailTitle: string;
  detailItems: readonly RebuildGitHubReleaseLinkageDetailItem[];
  actions: readonly RebuildProjectWorkspaceAction[];
}

export interface RebuildBaselineModel {
  currentAlias: string;
  currentAliasLabel: string;
  currentEntryFocus: RebuildCurrentEntryFocus | null;
  dsStandardIds: readonly string[];
  storybookIds: readonly string[];
  replacedFrontendScope: string[];
  survivingNonFrontendScope: string[];
  selectedRebuiltStartingSlice: string;
  cockpitStart: RebuildCockpitStartModel;
  docsStart: RebuildDocsStartModel;
  targetSetStart: RebuildTargetSetModel;
  projectWorkspaceStart: RebuildProjectWorkspaceModel;
  initiativeDetailStart: RebuildInitiativeDetailModel;
  aiEmployeeStart: RebuildAiEmployeeModel;
  gateQueueStart: RebuildGateQueueModel;
  conferenceStart: RebuildConferenceModel;
  gatewayAdapterStart: RebuildGatewayAdapterModel;
  dependencyConsoleStart: RebuildDependencyConsoleModel;
  resourceLibraryStart: RebuildResourceLibraryModel;
  knowledgeModulesStart: RebuildKnowledgeModulesModel;
  adminAccessStart: RebuildAdminAccessModel;
  githubReleaseLinkageStart: RebuildGitHubReleaseLinkageModel;
  checklist: RebuildChecklistRow[];
  noClaims: {
    productAcceptance: false;
    finalMvpAcceptance: false;
    releasePublication: false;
    ownerIntentExecution: false;
    liveDispatch: false;
    parentGoalCompletion: false;
  };
}

const checklistRows: RebuildChecklistRow[] = [
  row("operations-cockpit", "Operations Cockpit", "workspace_active", "Rebuilt workspace section", "Fresh rebuilt module is active in the shared workspace while the standalone page remains retired."),
  row("docs-readiness", "Docs Readiness", "workspace_active", "Rebuilt workspace section", "Fresh rebuilt module is active in the shared workspace while the standalone page remains retired."),
  row("product-design", "Product Design target set", "workspace_active", "Rebuilt workspace section", "Fresh rebuilt module is active in the shared workspace while the standalone page remains retired."),
  row("project-workspace", "Project Workspace", "workspace_active", "Rebuilt workspace section", "Fresh rebuilt module is active in the shared workspace while the standalone page remains retired."),
  row("initiative-detail", "Initiative Detail", "workspace_active", "Rebuilt workspace section", "Fresh rebuilt module is active in the shared workspace while the standalone page remains retired."),
  row("ai-employee", "AI Employee", "workspace_active", "Rebuilt workspace section", "Fresh rebuilt module is active in the shared workspace while the standalone page remains retired."),
  row("gate-queue", "Gate Queue", "workspace_active", "Rebuilt workspace section", "Fresh rebuilt module is active in the shared workspace while the standalone page remains retired."),
  row("conference", "Conference", "workspace_active", "Rebuilt workspace section", "Fresh rebuilt module is active in the shared workspace while the standalone page remains retired."),
  row("gateway-adapter", "Gateway / Adapter", "workspace_active", "Rebuilt workspace section", "Fresh rebuilt module is active in the shared workspace while the standalone page remains retired."),
  row("dependency-console", "Dependency Console", "workspace_active", "Rebuilt workspace section", "Fresh rebuilt module is active in the shared workspace while the standalone page remains retired."),
  row("resource-library", "Resource Library", "workspace_active", "Rebuilt workspace section", "Fresh rebuilt module is active in the shared workspace while the standalone page remains retired."),
  row("knowledge-modules", "Knowledge Modules", "workspace_active", "Rebuilt workspace section", "Fresh rebuilt module is active in the shared workspace while the standalone page remains retired."),
  row("admin-access", "Admin / Access", "workspace_active", "Rebuilt workspace section", "Fresh rebuilt module is active in the shared workspace while the standalone page remains retired."),
  row("github-release-linkage", "GitHub Release Linkage", "workspace_active", "Rebuilt workspace section", "Fresh rebuilt module is active in the shared workspace while the standalone page remains retired.")
];

export function createRebuildBaselineModel(currentAlias: string): RebuildBaselineModel {
  return {
    currentAlias,
    currentAliasLabel: presentAlias(currentAlias),
    currentEntryFocus: resolveCurrentEntryFocus(currentAlias),
    dsStandardIds: rebuildBaselineDsStandardIds,
    storybookIds: rebuildBaselineStorybookIds,
    replacedFrontendScope: [
      "Operations Cockpit",
      "Docs Readiness",
      "AOS-wide Product Design target set",
      "Project Workspace",
      "Initiative Detail",
      "AI Employee",
      "Gate Queue",
      "Conference",
      "Dependency Console"
    ],
    survivingNonFrontendScope: [
      "apps/api service host",
      "packages/domain read-model and governance logic",
      "packages/db runtime fixture and migrations",
      "local service policy, health, and service endpoints"
    ],
    selectedRebuiltStartingSlice: "fresh-cockpit-docs-target-set-project-workspace-initiative-detail-ai-employee-gate-queue-conference-gateway-adapter-dependency-console-resource-library-knowledge-modules-admin-access-github-workflow-sync-release-linkage-foundation",
    cockpitStart: {
      title: "Operations cockpit starting surface",
      summary: "The first fresh rebuilt surface starts here: a DS-aligned cockpit shell for local workspace status, work items, and unavailable action posture.",
      standardId: "ds-aos-operations-cockpit-v1",
      storybookId: "tcrn-design-system-patterns--aos-operations-cockpit-standard",
      evidence: [
        "Cockpit standard",
        "Local preview",
        "Service host retained"
      ],
      workItems: [
        {
          id: "cockpit-shell",
          title: "Cockpit shell and status lane",
          state: "current",
          owner: "Workspace team"
        },
        {
          id: "work-index",
          title: "Work queue and selected detail",
          state: "current",
          owner: "Product surface"
        },
        {
          id: "action-posture",
          title: "Unavailable action posture",
          state: "blocked",
          owner: "Local preview"
        }
      ],
      detailTitle: "Selected operation detail",
      detailItems: [
        { key: "selection", label: "Selection", value: "Cockpit shell and status lane" },
        { key: "standard", label: "Design standard", value: "AOS operations cockpit standard" },
        { key: "execution", label: "Execution", value: "Local preview only" },
        { key: "boundary", label: "Boundary", value: "Live actions remain disabled" }
      ],
      postureItems: [
        { key: "surface", label: "Fresh surface", value: "Operations Cockpit foundation" },
        { key: "design", label: "Storybook reference", value: "Cockpit standard v1" },
        { key: "release", label: "Release", value: "Not enabled" },
        { key: "live", label: "Live actions", value: "Not enabled" }
      ],
      actions: [
        {
          label: "Refresh workspace",
          reason: "Refresh stays disabled until the fresh cockpit surface is connected to its rebuilt data source."
        },
        {
          label: "Open work queue",
          reason: "Work queue drill-through opens after the fresh cockpit surface expands beyond this starting shell."
        },
        {
          label: "Run live action",
          reason: "Live actions stay disabled while the fresh cockpit surface remains in local preview."
        }
      ]
    },
    docsStart: {
      title: "Docs readiness starting surface",
      summary: "The next fresh rebuilt surface adds a DS-aligned inspection workspace for docs readiness, search state, and blocked publication posture.",
      standardId: "ds-aos-docs-readiness-v1",
      storybookId: "tcrn-design-system-patterns--aos-docs-readiness-standard",
      evidence: [
        "Docs standard",
        "Reference links",
        "No external mutation"
      ],
      searchPlaceholder: "Search local docs",
      stateOptions: [
        { value: "all", label: "All states" },
        { value: "blocked", label: "Blocked" }
      ],
      rows: [
        {
          path: "docs/readiness.md",
          state: "current",
          linkage: "PR reference only"
        },
        {
          path: "release-candidate.md",
          state: "blocked",
          linkage: "CI reference only"
        }
      ],
      detailTitle: "Selected docs readiness detail",
      detailItems: [
        { key: "path", label: "Path", value: "docs/readiness.md" },
        { key: "linkage", label: "Linkage", value: "Reference-only GitHub and CI metadata" },
        { key: "boundary", label: "Boundary", value: "Publishing remains unavailable" }
      ],
      actions: [
        {
          label: "Publish docs",
          reason: "Publishing remains unavailable while docs readiness stays inside the fresh replacement workspace."
        }
      ]
    },
    targetSetStart: {
      title: "Product design target-set starting surface",
      summary: "The next fresh rebuilt surface adds a DS-aligned target-set workspace for module cards, surface index, and blocked execution posture.",
      standardId: "ds-aos-target-set-v1",
      storybookId: "tcrn-design-system-patterns--aos-product-design-target-set-standard",
      evidence: [
        "Target-set standard",
        "Module cards",
        "Safe claim boundary"
      ],
      cards: [
        {
          id: "target-path",
          title: "Target path and module cards",
          state: "current",
          detail: "Cards outline product areas while standalone surfaces are rebuilt inside the shared workspace."
        },
        {
          id: "gate-panel",
          title: "Disabled gate panel",
          state: "blocked",
          detail: "Execution and publication controls remain disabled until later rebuilt surfaces are available."
        }
      ],
      indexRows: [
        {
          id: "target-index",
          title: "Target path and module cards",
          state: "current",
          owner: "Design standard"
        },
        {
          id: "target-gate",
          title: "Blocked execution panel",
          state: "blocked",
          owner: "Local preview"
        }
      ],
      detailTitle: "Product design inspection detail",
      detailItems: [
        { key: "target", label: "Target", value: "AOS-wide presentation standard" },
        { key: "gate", label: "Gate", value: "Execution remains unavailable" },
        { key: "evidence", label: "Evidence", value: "Registered components and synthetic rows only" }
      ],
      actions: [
        {
          label: "Edit target path",
          reason: "Target path editing remains unavailable while the target-set surface stays inside the shared replacement workspace."
        },
        {
          label: "Run product action",
          reason: "Execution remains unavailable while the target-set surface stays in local preview."
        }
      ]
    },
    projectWorkspaceStart: {
      title: "Project workspace starting surface",
      summary: "The next fresh rebuilt surface adds a DS-aligned project workspace for hierarchy, current work, and blocked owner actions inside the shared replacement shell.",
      standardIds: ["ds-aos-target-set-v1", "ds-aos-operations-cockpit-v1"],
      storybookIds: [
        "tcrn-design-system-patterns--aos-product-design-target-set-standard",
        "tcrn-design-system-patterns--aos-operations-cockpit-standard"
      ],
      evidence: [
        "Workspace hierarchy",
        "Current work",
        "Local preview only"
      ],
      hierarchy: [
        { key: "project", label: "Project", value: "TCRN-AOS" },
        { key: "initiative", label: "Initiative", value: "Frontend replacement" },
        { key: "epic", label: "Epic", value: "Workspace shell and current work" },
        { key: "stories", label: "Stories", value: "3 visible" }
      ],
      stories: [
        {
          id: "workspace-shell",
          title: "Workspace shell and hierarchy",
          state: "current",
          owner: "Workspace team"
        },
        {
          id: "selected-work",
          title: "Current work and blocked actions",
          state: "current",
          owner: "Product surface"
        },
        {
          id: "owner-action",
          title: "Owner action lane",
          state: "blocked",
          owner: "Local preview"
        }
      ],
      detailTitle: "Selected workspace detail",
      detailItems: [
        { key: "story", label: "Selected work", value: "Workspace shell and hierarchy" },
        { key: "owner", label: "Owner", value: "Workspace team" },
        { key: "freshness", label: "Freshness", value: "Local preview only" },
        { key: "boundary", label: "Boundary", value: "Owner actions remain disabled" }
      ],
      actions: [
        {
          label: "Switch project",
          reason: "Project switching remains unavailable while the workspace surface stays inside the shared replacement shell."
        },
        {
          label: "Create initiative",
          reason: "Initiative creation remains unavailable while the workspace surface stays inside the shared replacement shell."
        },
        {
          label: "Send owner action",
          reason: "Owner actions remain unavailable while the workspace surface stays in local preview."
        }
      ]
    },
    initiativeDetailStart: {
      title: "Initiative detail starting surface",
      summary: "The next fresh rebuilt surface adds a DS-aligned ticket drill-through for selected work, linked records, and activity notes inside the shared replacement shell.",
      standardIds: ["ds-aos-target-set-v1", "ds-aos-operations-cockpit-v1"],
      storybookIds: [
        "tcrn-design-system-patterns--aos-product-design-target-set-standard",
        "tcrn-design-system-patterns--aos-operations-cockpit-standard"
      ],
      evidence: [
        "Selected ticket",
        "Linked records",
        "Local preview only"
      ],
      ticketItems: [
        { key: "story", label: "Selected work", value: "Workspace shell and hierarchy" },
        { key: "owner", label: "Owner", value: "Workspace team" },
        { key: "freshness", label: "Freshness", value: "Local preview only" },
        { key: "blocker", label: "Blocker", value: "No blocker recorded" }
      ],
      links: [
        { type: "Gate", label: "Gate 1", target: "gate-work-order", state: "Linked" },
        { type: "Evidence", label: "Evidence 1", target: "service-status", state: "Metadata available" },
        { type: "Thread", label: "Thread 1", target: "workspace-team", state: "Local record" },
        { type: "History", label: "History 1", target: "history-entry", state: "Local event" }
      ],
      decisions: [
        {
          label: "Decision 1",
          summary: "Mutable ticket actions remain disabled while this drill-through stays in local preview.",
          state: "Action disabled"
        }
      ],
      activity: [
        {
          label: "Ticket note",
          summary: "No blocker recorded."
        },
        {
          label: "Linked records",
          summary: "1 gate, 1 evidence record, and 1 thread record are linked."
        },
        {
          label: "History",
          summary: "1 local history event is linked."
        }
      ],
      actions: [
        {
          label: "Edit ticket",
          reason: "Ticket editing remains unavailable while the initiative detail surface stays inside the shared replacement shell."
        },
        {
          label: "Request owner action",
          reason: "Owner actions remain unavailable while the initiative detail surface stays in local preview."
        },
        {
          label: "Publish update",
          reason: "Publishing remains unavailable while the initiative detail surface stays inside the shared replacement shell."
        }
      ]
    },
    aiEmployeeStart: {
      title: "AI employee starting surface",
      summary: "The next fresh rebuilt surface adds a DS-aligned employee roster and profile detail inside the shared replacement shell.",
      standardIds: ["ds-aos-target-set-v1", "ds-aos-operations-cockpit-v1"],
      storybookIds: [
        "tcrn-design-system-patterns--aos-product-design-target-set-standard",
        "tcrn-design-system-patterns--aos-operations-cockpit-standard"
      ],
      evidence: [
        "Employee roster",
        "Thread status",
        "Local preview only"
      ],
      rows: [
        {
          id: "employee-ilya",
          name: "Ilya",
          role: "Delivery engineer",
          thread: "workspace-owner",
          stories: "2",
          conferences: "1",
          status: "current"
        },
        {
          id: "employee-arturo",
          name: "Arturo",
          role: "Coordinator",
          thread: "workspace-coordinator",
          stories: "1",
          conferences: "1",
          status: "current"
        },
        {
          id: "employee-sable",
          name: "Sable",
          role: "Security reviewer",
          thread: "specialist-review",
          stories: "0",
          conferences: "1",
          status: "blocked"
        }
      ],
      detailTitle: "Selected profile",
      detailItems: [
        { key: "role", label: "Role", value: "Delivery engineer" },
        { key: "thread", label: "Thread", value: "workspace-owner" },
        { key: "authority", label: "Authority posture", value: "AOS source edits only" },
        { key: "contact", label: "Contact when", value: "Fresh rebuild work needs execution" }
      ],
      actions: [
        {
          label: "Open thread",
          reason: "Thread actions remain read-only while the AI employee surface stays inside the shared replacement shell."
        },
        {
          label: "Reassign work",
          reason: "Assignment changes remain unavailable while the AI employee surface stays in local preview."
        },
        {
          label: "Send live update",
          reason: "Live updates remain unavailable while the AI employee surface stays in local preview."
        }
      ]
    },
    gateQueueStart: {
      title: "Gate queue starting surface",
      summary: "The next fresh rebuilt surface adds a DS-aligned approvals workspace for action approvals, role reviews, and blocked execution posture inside the shared replacement shell.",
      standardIds: ["ds-aos-target-set-v1", "ds-aos-operations-cockpit-v1"],
      storybookIds: [
        "tcrn-design-system-patterns--aos-product-design-target-set-standard",
        "tcrn-design-system-patterns--aos-operations-cockpit-standard"
      ],
      evidence: [
        "Action approvals",
        "Role reviews",
        "Local preview only"
      ],
      rows: [
        {
          queue: "Action approvals",
          gate: "Action approval gate",
          owner: "Workspace owner",
          work: "Current work",
          evidence: "1",
          status: "blocked"
        },
        {
          queue: "Role reviews",
          gate: "Evidence review gate",
          owner: "Quality team",
          work: "Workspace shell and hierarchy",
          evidence: "1",
          status: "current"
        }
      ],
      detailTitle: "Selected gate",
      detailItems: [
        { key: "queue", label: "Queue", value: "Action approvals" },
        { key: "owner", label: "Owner", value: "Workspace owner" },
        { key: "work", label: "Linked work", value: "Current work" },
        { key: "blocker", label: "Blocker", value: "Action approval remains required before this gate can move." }
      ],
      actions: [
        {
          label: "Approve gate",
          reason: "Approvals remain unavailable while the gate queue surface stays inside the shared replacement shell."
        },
        {
          label: "Request owner action",
          reason: "Owner actions remain unavailable while the gate queue surface stays in local preview."
        },
        {
          label: "Release gate",
          reason: "Release actions remain unavailable while the gate queue surface stays in local preview."
        }
      ]
    },
    conferenceStart: {
      title: "Conference starting surface",
      summary: "The next fresh rebuilt surface adds a DS-aligned conference workspace for list, detail, agenda, and minutes posture inside the shared replacement shell.",
      standardIds: ["ds-aos-target-set-v1", "ds-aos-operations-cockpit-v1"],
      storybookIds: [
        "tcrn-design-system-patterns--aos-product-design-target-set-standard",
        "tcrn-design-system-patterns--aos-operations-cockpit-standard"
      ],
      evidence: [
        "Conference list",
        "Minutes posture",
        "Local preview only"
      ],
      rows: [
        {
          title: "Weekly rebuild coordination",
          initiator: "Arturo",
          participants: "3 total",
          minutes: "Ready for notes",
          evidence: "1",
          status: "current"
        },
        {
          title: "Design review handoff",
          initiator: "Ilya",
          participants: "2 total",
          minutes: "Blocked",
          evidence: "1",
          status: "blocked"
        }
      ],
      detailTitle: "Selected conference",
      detailItems: [
        { key: "initiator", label: "Initiator", value: "Arturo" },
        { key: "participants", label: "Participants", value: "Arturo, Ilya, Sable" },
        { key: "stories", label: "Linked stories", value: "Workspace shell and hierarchy" },
        { key: "minutes", label: "Minutes summary", value: "Minutes stay in draft-ready local preview until a reviewed note is recorded." }
      ],
      actions: [
        {
          label: "Send invite",
          reason: "Live invite sending remains unavailable while the conference surface stays inside the shared replacement shell."
        },
        {
          label: "Record position",
          reason: "Participant updates remain unavailable while the conference surface stays in local preview."
        },
        {
          label: "Record notes",
          reason: "Minutes updates remain unavailable while the conference surface stays in local preview."
        }
      ]
    },
    gatewayAdapterStart: {
      title: "Gateway and adapter starting surface",
      summary: "The next fresh rebuilt surface adds a DS-aligned control-plane workspace for gateway health, adapter dry-run outbox posture, and blocked live operations inside the shared replacement shell.",
      standardIds: ["ds-aos-target-set-v1", "ds-aos-operations-cockpit-v1"],
      storybookIds: [
        "tcrn-design-system-patterns--aos-product-design-target-set-standard",
        "tcrn-design-system-patterns--aos-operations-cockpit-standard"
      ],
      evidence: [
        "Gateway health",
        "Dry-run outbox",
        "Local preview only"
      ],
      rows: [
        {
          title: "Gateway health",
          transport: "Accepted method families visible",
          posture: "Read-only status",
          audit: "Audit metadata present",
          nextAction: "Inspect gateway detail",
          status: "current"
        },
        {
          title: "Adapter outbox",
          transport: "Dry-run records only",
          posture: "Live operations blocked",
          audit: "Retry and stale-state visible",
          nextAction: "Review blocked live actions",
          status: "blocked"
        }
      ],
      detailTitle: "Selected gateway detail",
      detailItems: [
        { key: "surface", label: "Surface", value: "Gateway health" },
        { key: "transport", label: "Transport", value: "Accepted method families visible" },
        { key: "outbox", label: "Adapter posture", value: "Dry-run outbox and return collection only" },
        { key: "boundary", label: "Boundary", value: "Live dispatch and thread actions remain unavailable" }
      ],
      actions: [
        {
          label: "Read gateway status",
          reason: "Gateway status refresh remains unavailable while the gateway and adapter surface stays inside the shared replacement shell."
        },
        {
          label: "Send live dispatch",
          reason: "Live dispatch remains unavailable while the gateway and adapter surface stays in local preview."
        },
        {
          label: "Retry outbox record",
          reason: "Outbox retry remains unavailable while the gateway and adapter surface stays in local preview."
        }
      ]
    },
    dependencyConsoleStart: {
      title: "Dependency console starting surface",
      summary: "The next fresh rebuilt surface adds a DS-aligned dependency governance workspace for lifecycle, posture, and blocked remediation inside the shared replacement shell.",
      standardIds: ["ds-aos-target-set-v1", "ds-aos-operations-cockpit-v1"],
      storybookIds: [
        "tcrn-design-system-patterns--aos-product-design-target-set-standard",
        "tcrn-design-system-patterns--aos-operations-cockpit-standard"
      ],
      evidence: [
        "Dependency governance",
        "Blocked remediation",
        "Local preview only"
      ],
      rows: [
        {
          packageName: "fixture-current",
          lifecycle: "Current",
          posture: "Review required",
          license: "MIT",
          nextAction: "None",
          status: "current"
        },
        {
          packageName: "fixture-denied",
          lifecycle: "Denied",
          posture: "Blocked",
          license: "GPL-3.0-only",
          nextAction: "Replace dependency",
          status: "blocked"
        }
      ],
      detailTitle: "Selected dependency",
      detailItems: [
        { key: "package", label: "Package", value: "fixture-denied" },
        { key: "lifecycle", label: "Lifecycle", value: "Denied" },
        { key: "license", label: "License", value: "GPL-3.0-only" },
        { key: "risk", label: "Residual risk", value: "Blocked until reviewed replacement work is available." }
      ],
      actions: [
        {
          label: "Approve dependency",
          reason: "Dependency approvals remain unavailable while the dependency console surface stays inside the shared replacement shell."
        },
        {
          label: "Replace dependency",
          reason: "Package mutation remains unavailable while the dependency console surface stays in local preview."
        },
        {
          label: "Export report",
          reason: "Export remains unavailable while the dependency console surface stays in local preview."
        }
      ]
    },
    resourceLibraryStart: {
      title: "Resource library starting surface",
      summary: "The next fresh rebuilt surface adds a DS-aligned resource library workspace for materialization records, manifests, audit posture, and blocked updates inside the shared replacement shell.",
      standardIds: ["ds-aos-target-set-v1", "ds-aos-operations-cockpit-v1"],
      storybookIds: [
        "tcrn-design-system-patterns--aos-product-design-target-set-standard",
        "tcrn-design-system-patterns--aos-operations-cockpit-standard"
      ],
      evidence: [
        "Resource records",
        "Traceability",
        "Local preview only"
      ],
      rows: [
        {
          title: "Owner-visible browser capture",
          manifest: "capture-manifest.json",
          traceability: "Owner preview trace linked",
          audit: "Audit metadata present",
          nextAction: "Materialize resource",
          status: "blocked"
        },
        {
          title: "Storybook baseline export",
          manifest: "storybook-baseline.json",
          traceability: "Manifest and screenshot linked",
          audit: "Audit metadata present",
          nextAction: "Inspect metadata",
          status: "current"
        }
      ],
      detailTitle: "Selected resource",
      detailItems: [
        { key: "resource", label: "Resource", value: "Owner-visible browser capture" },
        { key: "manifest", label: "Manifest", value: "capture-manifest.json" },
        { key: "traceability", label: "Traceability", value: "Owner preview trace linked" },
        { key: "boundary", label: "Boundary", value: "Materialization remains unavailable" }
      ],
      actions: [
        {
          label: "Materialize resource",
          reason: "Materialization remains unavailable while the resource library surface stays inside the shared replacement shell."
        },
        {
          label: "Rollback resource",
          reason: "Rollback remains unavailable while the resource library surface stays in local preview."
        },
        {
          label: "Export manifest",
          reason: "Export remains unavailable while the resource library surface stays in local preview."
        }
      ]
    },
    knowledgeModulesStart: {
      title: "Knowledge modules starting surface",
      summary: "The next fresh rebuilt surface adds a DS-aligned knowledge workspace for module indexes, readiness posture, and blocked export or publish actions inside the shared replacement shell.",
      standardIds: ["ds-aos-docs-readiness-v1", "ds-aos-target-set-v1"],
      storybookIds: [
        "tcrn-design-system-patterns--aos-docs-readiness-standard",
        "tcrn-design-system-patterns--aos-product-design-target-set-standard"
      ],
      evidence: [
        "Module indexes",
        "Readiness posture",
        "Local preview only"
      ],
      rows: [
        {
          title: "Knowledge Base",
          scope: "How-to indexes and local guidance",
          readiness: "Review in progress",
          posture: "Export disabled",
          nextAction: "Inspect module detail",
          status: "current"
        },
        {
          title: "Release Notes",
          scope: "Change summary and release narrative",
          readiness: "Blocked pending review",
          posture: "Publish disabled",
          nextAction: "Review blocked items",
          status: "blocked"
        }
      ],
      detailTitle: "Selected module",
      detailItems: [
        { key: "module", label: "Module", value: "Knowledge Base" },
        { key: "scope", label: "Scope", value: "How-to indexes and local guidance" },
        { key: "readiness", label: "Readiness", value: "Review in progress" },
        { key: "boundary", label: "Boundary", value: "Export and publish actions remain unavailable" }
      ],
      actions: [
        {
          label: "Export docs",
          reason: "Export remains unavailable while the knowledge modules surface stays inside the shared replacement shell."
        },
        {
          label: "Publish module",
          reason: "Publishing remains unavailable while the knowledge modules surface stays in local preview."
        },
        {
          label: "Open review proposal",
          reason: "Review proposal updates remain unavailable while the knowledge modules surface stays in local preview."
        }
      ]
    },
    adminAccessStart: {
      title: "Admin and access starting surface",
      summary: "The next fresh rebuilt surface adds a DS-aligned admin workspace for access posture, role permissions, audit trail visibility, and blocked break-glass actions inside the shared replacement shell.",
      standardIds: ["ds-aos-target-set-v1", "ds-aos-operations-cockpit-v1"],
      storybookIds: [
        "tcrn-design-system-patterns--aos-product-design-target-set-standard",
        "tcrn-design-system-patterns--aos-operations-cockpit-standard"
      ],
      evidence: [
        "Access posture",
        "Audit trail",
        "Local preview only"
      ],
      rows: [
        {
          title: "Role permissions",
          permissions: "Read-only shell access",
          audit: "Audit metadata present",
          posture: "Admin updates disabled",
          nextAction: "Inspect permission detail",
          status: "current"
        },
        {
          title: "Break-glass controls",
          permissions: "Owner-only boundary",
          audit: "Blocked escalation note",
          posture: "Break-glass unavailable",
          nextAction: "Review blocked controls",
          status: "blocked"
        }
      ],
      detailTitle: "Selected admin detail",
      detailItems: [
        { key: "surface", label: "Surface", value: "Role permissions" },
        { key: "permissions", label: "Permissions", value: "Read-only shell access" },
        { key: "audit", label: "Audit trail", value: "Audit metadata present" },
        { key: "boundary", label: "Boundary", value: "Mutable admin and break-glass actions remain unavailable" }
      ],
      actions: [
        {
          label: "Update role access",
          reason: "Admin updates remain unavailable while the admin and access surface stays inside the shared replacement shell."
        },
        {
          label: "Open break-glass path",
          reason: "Break-glass actions remain unavailable while the admin and access surface stays in local preview."
        },
        {
          label: "Export audit log",
          reason: "Audit export remains unavailable while the admin and access surface stays in local preview."
        }
      ]
    },
    githubReleaseLinkageStart: {
      title: "GitHub release linkage starting surface",
      summary: "The next fresh rebuilt surface adds a DS-aligned release-linkage workspace for repository metadata, PR and CI posture, and blocked release follow-through inside the shared replacement shell.",
      standardIds: ["ds-aos-docs-readiness-v1", "ds-aos-target-set-v1"],
      storybookIds: [
        "tcrn-design-system-patterns--aos-docs-readiness-standard",
        "tcrn-design-system-patterns--aos-product-design-target-set-standard"
      ],
      evidence: [
        "Repository metadata",
        "PR and CI posture",
        "Local preview only"
      ],
      rows: [
        {
          title: "Repository metadata",
          repo: "TCRN-AOS-local",
          posture: "Read-only linkage",
          blocker: "External review pending",
          nextAction: "Inspect metadata detail",
          status: "current"
        },
        {
          title: "Release candidate linkage",
          repo: "local-release-candidate",
          posture: "Release follow-through disabled",
          blocker: "Dependency and resource blockers",
          nextAction: "Review linked blockers",
          status: "blocked"
        }
      ],
      detailTitle: "Selected release linkage",
      detailItems: [
        { key: "repo", label: "Repository", value: "TCRN-AOS-local" },
        { key: "branch", label: "Branch", value: "main" },
        { key: "posture", label: "Posture", value: "Repository, PR, and CI references remain local metadata only" },
        { key: "boundary", label: "Boundary", value: "GitHub mutation and release creation remain unavailable" }
      ],
      actions: [
        {
          label: "Sync repository",
          reason: "Repository sync remains unavailable while the release linkage surface stays inside the shared replacement shell."
        },
        {
          label: "Create release",
          reason: "Release creation remains unavailable while the release linkage surface stays in local preview."
        },
        {
          label: "Update CI state",
          reason: "CI mutation remains unavailable while the release linkage surface stays in local preview."
        }
      ]
    },
    checklist: checklistRows,
    noClaims: {
      productAcceptance: false,
      finalMvpAcceptance: false,
      releasePublication: false,
      ownerIntentExecution: false,
      liveDispatch: false,
      parentGoalCompletion: false
    }
  };
}

function row(id: string, label: string, status: RebuildChecklistRow["status"], source: string, note: string): RebuildChecklistRow {
  return { id, label, status, source, note };
}

function resolveCurrentEntryFocus(value: string): RebuildCurrentEntryFocus | null {
  if (value === "/") {
    return {
      label: "Operations Cockpit",
      anchor: "cockpit-start",
      checklistId: "operations-cockpit",
      entryMode: "Workspace default",
      summary: "Root entry foregrounds the cockpit section while every rebuilt module remains available inside the same shared workspace."
    };
  }
  if (value === "/cockpit" || value.includes("operations-cockpit")) return legacyEntryFocus("Operations Cockpit", "cockpit-start", "operations-cockpit");
  if (value.includes("docs-readiness")) return legacyEntryFocus("Docs Readiness", "docs-start", "docs-readiness");
  if (value.includes("docs-search-release-readiness")) return legacyEntryFocus("Docs Readiness", "docs-start", "docs-readiness");
  if (value.includes("aos-wide-product-design")) return legacyEntryFocus("Product Design target set", "target-set-start", "product-design");
  if (value.includes("project-workspace")) return legacyEntryFocus("Project Workspace", "project-workspace-start", "project-workspace");
  if (value.includes("initiative-detail")) return legacyEntryFocus("Initiative Detail", "initiative-detail-start", "initiative-detail");
  if (value.includes("ai-employee")) return legacyEntryFocus("AI Employee", "ai-employee-start", "ai-employee");
  if (value.includes("gate-queue")) return legacyEntryFocus("Gate Queue", "gate-queue-start", "gate-queue");
  if (value.includes("conference")) return legacyEntryFocus("Conference", "conference-start", "conference");
  if (value.includes("gateway-adapter")) return directEntryFocus("Gateway / Adapter", "gateway-adapter-start", "gateway-adapter");
  if (value.includes("dependency-console")) return legacyEntryFocus("Dependency Console", "dependency-console-start", "dependency-console");
  if (value.includes("resource-library")) return directEntryFocus("Resource Library", "resource-library-start", "resource-library");
  if (value.includes("knowledge-modules")) return directEntryFocus("Knowledge Modules", "knowledge-modules-start", "knowledge-modules");
  if (value.includes("admin-access")) return directEntryFocus("Admin / Access", "admin-access-start", "admin-access");
  if (value.includes("github-release-linkage")) return directEntryFocus("GitHub Release Linkage", "github-release-linkage-start", "github-release-linkage");
  return null;
}

function legacyEntryFocus(label: string, anchor: string, checklistId: string): RebuildCurrentEntryFocus {
  return {
    label,
    anchor,
    checklistId,
    entryMode: "Legacy entry",
    summary: "This entry now foregrounds the rebuilt module section inside the shared workspace while the former standalone page stays retired."
  };
}

function directEntryFocus(label: string, anchor: string, checklistId: string): RebuildCurrentEntryFocus {
  return {
    label,
    anchor,
    checklistId,
    entryMode: "Direct entry",
    summary: "This entry now foregrounds the rebuilt module section directly inside the shared workspace."
  };
}

function presentAlias(value: string): string {
  if (value === "/") return "Root workspace";
  if (value === "/cockpit") return "Operations Cockpit";
  if (value.includes("operations-cockpit")) return "Operations Cockpit";
  if (value.includes("docs-readiness")) return "Docs Readiness";
  if (value.includes("docs-search-release-readiness")) return "Docs Readiness";
  if (value.includes("aos-wide-product-design")) return "Product Design target set";
  if (value.includes("project-workspace")) return "Project Workspace";
  if (value.includes("initiative-detail")) return "Initiative Detail";
  if (value.includes("ai-employee")) return "AI Employee";
  if (value.includes("gate-queue")) return "Gate Queue";
  if (value.includes("conference")) return "Conference";
  if (value.includes("gateway-adapter")) return "Gateway / Adapter";
  if (value.includes("dependency-console")) return "Dependency Console";
  if (value.includes("resource-library")) return "Resource Library";
  if (value.includes("knowledge-modules")) return "Knowledge Modules";
  if (value.includes("admin-access")) return "Admin / Access";
  if (value.includes("github-release-linkage")) return "GitHub Release Linkage";
  return "Replacement workspace";
}
