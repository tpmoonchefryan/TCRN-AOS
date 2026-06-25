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
  "[data-region='docs-start']",
  "[data-region='docs-filter']",
  "[data-region='docs-detail']",
  "[data-region='target-set-start']",
  "[data-region='target-set-modules']",
  "[data-region='target-set-detail']",
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

export interface RebuildBaselineModel {
  currentAlias: string;
  currentAliasLabel: string;
  dsStandardIds: readonly string[];
  storybookIds: readonly string[];
  replacedFrontendScope: string[];
  survivingNonFrontendScope: string[];
  selectedRebuiltStartingSlice: string;
  cockpitStart: RebuildCockpitStartModel;
  docsStart: RebuildDocsStartModel;
  targetSetStart: RebuildTargetSetModel;
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
