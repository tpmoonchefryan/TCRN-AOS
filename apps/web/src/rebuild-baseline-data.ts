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
  "/dependency-console.html"
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
  "[data-region='rebuild-checklist']",
  "[data-region='rebuild-boundaries']",
  "[data-region='rebuild-actions']"
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
  status: "retired" | "rebuild_queued";
  source: string;
  note: string;
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

export interface RebuildBaselineModel {
  currentAlias: string;
  currentAliasLabel: string;
  dsStandardIds: readonly string[];
  storybookIds: readonly string[];
  replacedFrontendScope: string[];
  survivingNonFrontendScope: string[];
  selectedRebuiltStartingSlice: string;
  cockpitStart: RebuildCockpitStartModel;
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
  row("operations-cockpit", "Operations Cockpit", "retired", "Transitional served frontend", "This former standalone page now resolves to the replacement workspace while the previous frontend is retired."),
  row("docs-readiness", "Docs Readiness", "retired", "Transitional served frontend", "This former standalone page now resolves to the replacement workspace while the previous frontend is retired."),
  row("product-design", "Product Design target set", "retired", "Transitional served frontend", "This former standalone page now resolves to the replacement workspace while the previous frontend is retired."),
  row("project-workspace", "Project Workspace", "retired", "Transitional served frontend", "This former standalone page now resolves to the replacement workspace while the previous frontend is retired."),
  row("initiative-detail", "Initiative Detail", "retired", "Transitional served frontend", "This former standalone page now resolves to the replacement workspace while the previous frontend is retired."),
  row("ai-employee", "AI Employee", "retired", "Transitional served frontend", "This former standalone page now resolves to the replacement workspace while the previous frontend is retired."),
  row("gate-queue", "Gate Queue", "retired", "Transitional served frontend", "This former standalone page now resolves to the replacement workspace while the previous frontend is retired."),
  row("conference", "Conference", "retired", "Transitional served frontend", "This former standalone page now resolves to the replacement workspace while the previous frontend is retired."),
  row("dependency-console", "Dependency Console", "retired", "Transitional served frontend", "This former standalone page now resolves to the replacement workspace while the previous frontend is retired."),
  row("resource-library", "Resource Library", "rebuild_queued", "Total-scope checklist", "Fresh rebuild surface not started yet."),
  row("knowledge-modules", "Knowledge Modules", "rebuild_queued", "Total-scope checklist", "Fresh rebuild surface not started yet."),
  row("admin-access", "Admin / Access", "rebuild_queued", "Total-scope checklist", "Fresh rebuild surface not started yet.")
];

export function createRebuildBaselineModel(currentAlias: string): RebuildBaselineModel {
  return {
    currentAlias,
    currentAliasLabel: presentAlias(currentAlias),
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
    selectedRebuiltStartingSlice: "storybook-first-replacement-workspace-shell",
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

function presentAlias(value: string): string {
  if (value === "/") return "Root workspace";
  if (value.includes("operations-cockpit")) return "Operations Cockpit";
  if (value.includes("docs-search-release-readiness")) return "Docs Readiness";
  if (value.includes("aos-wide-product-design")) return "Product Design target set";
  if (value.includes("project-workspace")) return "Project Workspace";
  if (value.includes("initiative-detail")) return "Initiative Detail";
  if (value.includes("ai-employee")) return "AI Employee";
  if (value.includes("gate-queue")) return "Gate Queue";
  if (value.includes("conference")) return "Conference";
  if (value.includes("dependency-console")) return "Dependency Console";
  return "Replacement workspace";
}
