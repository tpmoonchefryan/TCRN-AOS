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

export const rebuildBaselineRoutes = [] as const;

export const requiredRebuildBaselineSelectors = [
  "[data-surface='aos-rebuild-workspace']",
  "[data-region='rebuild-shell']",
  "[data-region='rebuild-nav']",
  "[data-region='rebuild-topbar']",
  "[data-region='rebuild-summary']",
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
  status: "reset_started" | "rebuild_queued" | "standard_ready" | "reopened";
  source: string;
  note: string;
}

export interface RebuildBaselineModel {
  currentAlias: string;
  currentAliasLabel: string;
  dsStandardIds: readonly string[];
  storybookIds: readonly string[];
  replacedFrontendScope: string[];
  survivingNonFrontendScope: string[];
  selectedRebuiltStartingSlice: string;
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
  row("operations-cockpit", "Operations Cockpit", "reopened", "DS cockpit standard", "First rebuilt surface is active again from the reset baseline."),
  row("docs-readiness", "Docs Readiness", "reopened", "DS docs readiness standard", "Docs readiness is active again from the reset baseline."),
  row("product-design", "Product Design target set", "reopened", "DS target-set standard", "Product design target set is active again from the reset baseline."),
  row("project-workspace", "Project Workspace", "reopened", "DS project workspace standard", "Project workspace is active again from the reset baseline."),
  row("initiative-detail", "Initiative Detail", "reopened", "DS initiative detail standard", "Initiative detail is active again from the reset baseline."),
  row("ai-employee", "AI Employee", "reopened", "DS AI employee standard", "AI employee profiles are active again from the reset baseline."),
  row("gate-queue", "Gate Queue", "reopened", "DS gate queue standard", "Gate queue is active again from the reset baseline."),
  row("conference", "Conference", "reopened", "DS conference standard", "Conference list, detail, and minutes are active again from the reset baseline."),
  row("dependency-console", "Dependency Console", "reopened", "DS dependency console standard", "Dependency governance is active again from the reset baseline."),
  row("resource-library", "Resource Library", "rebuild_queued", "Total-scope checklist", "Resource audit and materialization will restart from the new baseline."),
  row("knowledge-modules", "Knowledge Modules", "rebuild_queued", "Total-scope checklist", "Knowledge, guide, and release-note modules will restart from the new baseline."),
  row("admin-access", "Admin / Access", "rebuild_queued", "Total-scope checklist", "Admin and access shell will restart from the new baseline.")
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
    selectedRebuiltStartingSlice: "storyboard-first-aos-rebuild-workspace-baseline",
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
  if (value.includes("operations-cockpit")) return "Operations Cockpit";
  if (value.includes("docs-search-release-readiness")) return "Docs Readiness";
  if (value.includes("aos-wide-product-design")) return "Product Design target set";
  if (value.includes("project-workspace")) return "Project Workspace";
  if (value.includes("initiative-detail")) return "Initiative Detail";
  if (value.includes("ai-employee")) return "AI Employee";
  if (value.includes("gate-queue")) return "Gate Queue";
  if (value.includes("conference")) return "Conference";
  if (value.includes("dependency-console")) return "Dependency Console";
  return "AOS Rebuild Workspace";
}
