import { createElement, Fragment, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Badge,
  Button,
  DetailDrawer,
  EvidenceStrip,
  Field,
  FilterBar,
  GateReadinessPanel,
  Heading,
  IconButton,
  KeyValueList,
  NavItem,
  ReadbackPanel,
  SearchInput,
  Select,
  StatusBadge,
  Surface,
  StateView,
  Text,
  TopBar,
  WorkIndex,
  type KeyValueItem,
  type WorkIndexRow
} from "@tcrn/ui-react";
import { aosDesignSystemConsumerBridge } from "./design-system-bridge.js";

export const aosCockpitUiReactRuntime = {
  packageName: "@tcrn/ui-react",
  packageSpecifier: aosDesignSystemConsumerBridge.uiReactPackageSpecifier,
  designSystemSourceHead: aosDesignSystemConsumerBridge.designSystemSourceHead,
  implementationKind: "operations_cockpit_claim_risk_topbar_checkpoint_stage_phase_gate_readback_cards_package_runtime_expansion",
  componentScope: [
    "NavItem",
    "TopBar",
    "WorkIndex",
    "TableShell",
    "SearchInput",
    "Field",
    "Select",
    "FilterBar",
    "Button",
    "IconButton",
    "Badge",
    "StateView",
    "DetailDrawer",
    "KeyValueList",
    "Surface",
    "Heading",
    "Text",
    "StatusBadge",
    "GateReadinessPanel",
    "ReadbackPanel",
    "EvidenceStrip"
  ],
  packageBackedReactRuntimeRendering: true,
  broadUiReactMigration: false,
  productAcceptanceReady: false,
  finalMvpAcceptanceReady: false
} as const;

export interface CockpitRuntimeNavItem {
  active: boolean;
  disabledReason: string;
  href: string;
  label: string;
}

export interface CockpitRuntimeWorkIndexRow {
  active: boolean;
  evidenceLabel: string;
  gateLabel: string;
  owner: string;
  searchText: string;
  stateLabel: string;
  storyId: string;
  title: string;
}

export interface CockpitRuntimeWorkIndexOptions {
  columnsDisabledReason: string;
  filters: readonly CockpitRuntimeWorkIndexFilter[];
  rows: readonly CockpitRuntimeWorkIndexRow[];
}

export interface CockpitRuntimeWorkIndexFilter {
  label: string;
  tone?: ComponentProps<typeof Badge>["tone"];
}

export interface CockpitRuntimeDetailDrawerOptions {
  blockedActionLabel: string;
  closeLabel: string;
  detailRows: readonly CockpitRuntimeDetailRow[];
  noOverclaimSummary: string;
  operatingLoopSummary: string;
  primaryActionDisabledReason: string;
  primaryActionLabel: string;
  secondaryActionDisabledReason: string;
  secondaryActionLabel: string;
  selectedId: string;
  selectedTypeLabel: string;
  selectedType: string;
  statusLabel: string;
  title: string;
}

export interface CockpitRuntimeDetailRow {
  key: string;
  label: string;
  value: string;
}

export interface CockpitRuntimeGateWorkOrderOptions {
  count: number;
  disabledReason: string;
  gateModeLabel: string;
  gateOwnerRole: string;
  gateStatusLabel: string;
  gateSummary: string;
  gateTypeLabel: string;
}

export interface CockpitRuntimeReadbackPostureOptions {
  dependencyLabel: string;
  disabledReason: string;
  evidenceLabel: string;
  resourceLabel: string;
  runtimeFixtureLabel: string;
}

export interface CockpitRuntimeGateReadbackCardsOptions {
  gateWorkOrder: CockpitRuntimeGateWorkOrderOptions;
  readbackPosture: CockpitRuntimeReadbackPostureOptions;
}

export interface CockpitRuntimeStageMapItem {
  evidenceCount: number;
  freshnessLabel: string;
  index: number;
  label: string;
  ownerRoles: readonly string[];
  releaseReadinessLabel: string;
  sourceGateCount: number;
  stageId: string;
  state: string;
  stateLabel: string;
}

export interface CockpitRuntimeStagePhaseOptions {
  roleDetailDisabledReason: string;
  stageDetailDisabledReason: string;
  stages: readonly CockpitRuntimeStageMapItem[];
}

export interface CockpitRuntimeTopbarCheckpointOptions {
  checkpointLabel: string;
  checkpointValue: string;
  freshnessLabel: string;
  operatorLabel: string;
  projectId: string;
  projectOptions: readonly string[];
  refreshLabel: string;
  serviceReadbackLabel: string;
  serviceStatusLabel: string;
}

export interface CockpitRuntimeClaimItem {
  key: string;
  label: string;
  state: ComponentProps<typeof StatusBadge>["state"]["state"];
  variant: "status" | "badge";
}

export interface CockpitRuntimeRiskWarningItem {
  id: string;
  ownerRole: string;
  state: ComponentProps<typeof StatusBadge>["state"]["state"];
  stateLabel: string;
  summary: string;
  typeLabel: string;
}

export interface CockpitRuntimeClaimRiskStripsOptions {
  claims: readonly CockpitRuntimeClaimItem[];
  riskWarnings: readonly CockpitRuntimeRiskWarningItem[];
}

type RuntimeNavItemProps = ComponentProps<typeof NavItem> & {
  "data-tcrn-component": "NavItem";
  "data-package-runtime-component": "NavItem";
  "data-package-runtime-source": "@tcrn/ui-react";
  "data-package-runtime-surface": "operations-cockpit-sidebar";
};

type RuntimeDataProps = Record<`data-${string}`, string | boolean | undefined>;

export function renderCockpitRuntimeTopbarCheckpoint(options: CockpitRuntimeTopbarCheckpointOptions): string {
  const projectOptions = options.projectOptions.map((project) => ({
    label: project,
    value: project
  }));
  const tree = createElement(TopBar, {
    productName: "TCRN AOS",
    moduleName: "Operations Cockpit",
    actions: createElement(Fragment, null,
      createElement(Field, {
        label: "Project",
        children: createElement(Select, {
          "aria-label": "Project selector",
          "data-tcrn-component": "Select",
          "data-package-runtime-component": "Select",
          "data-package-runtime-source": "@tcrn/ui-react",
          defaultValue: options.projectId,
          id: "project-select",
          options: projectOptions
        } as ComponentProps<typeof Select> & RuntimeDataProps)
      }),
      createElement(ReadbackPanel, {
        title: options.checkpointLabel,
        children: [
          createElement("strong", {
            "data-local-checkpoint": true,
            key: "checkpoint-value"
          }, options.checkpointValue),
          createElement(StatusBadge, {
            "data-readback-freshness": true,
            "data-tcrn-component": "StatusBadge",
            "data-package-runtime-component": "StatusBadge",
            "data-package-runtime-source": "@tcrn/ui-react",
            key: "freshness",
            state: { state: "local_only", label: options.freshnessLabel }
          } as ComponentProps<typeof StatusBadge> & RuntimeDataProps & { key: string }),
          createElement(Badge, {
            className: "service-readback",
            "data-service-status": true,
            "data-tcrn-component": "Badge",
            "data-package-runtime-component": "Badge",
            "data-package-runtime-source": "@tcrn/ui-react",
            key: "service-status"
          } as ComponentProps<typeof Badge> & RuntimeDataProps & { key: string }, options.serviceStatusLabel),
          createElement(Badge, {
            className: "service-readback",
            "data-service-model-readback": true,
            "data-tcrn-component": "Badge",
            "data-package-runtime-component": "Badge",
            "data-package-runtime-source": "@tcrn/ui-react",
            key: "service-readback"
          } as ComponentProps<typeof Badge> & RuntimeDataProps & { key: string }, options.serviceReadbackLabel)
        ]
      } as ComponentProps<typeof ReadbackPanel>),
      createElement(Button, {
        className: "top-action",
        "data-refresh-readback": true,
        "data-tcrn-component": "Button",
        "data-package-runtime-component": "Button",
        "data-package-runtime-source": "@tcrn/ui-react",
        type: "button",
        variant: "secondary"
      } as ComponentProps<typeof Button> & RuntimeDataProps, options.refreshLabel),
      createElement(IconButton, {
        ariaLabel: "Current operator",
        className: "profile",
        "data-tcrn-component": "IconButton",
        "data-package-runtime-component": "IconButton",
        "data-package-runtime-source": "@tcrn/ui-react",
        type: "button"
      } as ComponentProps<typeof IconButton> & RuntimeDataProps, options.operatorLabel)
    )
  });

  return addAosTopbarCheckpointRuntimeAttributes(renderCockpitRuntimeMarkup(tree, "aos-topbar-checkpoint-"));
}

export function renderCockpitRuntimeClaimRiskStrips(options: CockpitRuntimeClaimRiskStripsOptions): string {
  return [
    renderCockpitRuntimeClaimStrip(options.claims),
    renderCockpitRuntimeRiskLane(options.riskWarnings)
  ].join("\n          ");
}

function renderCockpitRuntimeClaimStrip(claims: readonly CockpitRuntimeClaimItem[]): string {
  const childrenHtml = renderCockpitRuntimeMarkup(createElement(Fragment, null,
    claims.map((claim) => claim.variant === "status"
      ? createElement(StatusBadge, {
        "data-claim-key": claim.key,
        "data-tcrn-component": "StatusBadge",
        "data-package-runtime-component": "StatusBadge",
        "data-package-runtime-source": "@tcrn/ui-react",
        key: claim.key,
        state: { state: claim.state, label: claim.label }
      } as ComponentProps<typeof StatusBadge> & RuntimeDataProps & { key: string })
      : createElement(Badge, {
        "data-claim-key": claim.key,
        "data-tcrn-component": "Badge",
        "data-package-runtime-component": "Badge",
        "data-package-runtime-source": "@tcrn/ui-react",
        key: claim.key,
        tone: "neutral"
      } as ComponentProps<typeof Badge> & RuntimeDataProps & { key: string }, claim.label))
  ), "aos-claim-strip-items-");
  const shellHtml = renderCockpitRuntimeMarkup(createElement(EvidenceStrip, { items: [] }), "aos-claim-strip-");
  return addAosEvidenceStripRuntimeAttributes(shellHtml, {
    ariaLabel: "Claim boundaries",
    className: "claim-strip tcrn-evidence-strip",
    itemCount: claims.length,
    region: "claim-strip"
  }, childrenHtml);
}

function renderCockpitRuntimeRiskLane(riskWarnings: readonly CockpitRuntimeRiskWarningItem[]): string {
  const childrenHtml = renderCockpitRuntimeMarkup(createElement(Fragment, null,
    riskWarnings.map((warning) => createElement(StatusBadge, {
      "data-risk-id": warning.id,
      "data-risk-owner-role": warning.ownerRole,
      "data-risk-summary": warning.summary,
      "data-risk-type": warning.typeLabel,
      "data-tcrn-component": "StatusBadge",
      "data-package-runtime-component": "StatusBadge",
      "data-package-runtime-source": "@tcrn/ui-react",
      key: warning.id,
      state: { state: warning.state, label: `${warning.typeLabel}: ${warning.stateLabel}` },
      title: warning.summary
    } as ComponentProps<typeof StatusBadge> & RuntimeDataProps & { key: string }))
  ), "aos-risk-lane-items-");
  const shellHtml = renderCockpitRuntimeMarkup(createElement(EvidenceStrip, { items: [] }), "aos-risk-lane-");
  return addAosEvidenceStripRuntimeAttributes(shellHtml, {
    ariaLabel: "Risk and warning lane",
    className: "risk-lane tcrn-evidence-strip",
    itemCount: riskWarnings.length,
    region: "risk-lane"
  }, childrenHtml);
}

export function renderCockpitRuntimeNavItems(items: readonly CockpitRuntimeNavItem[]): string {
  return items.map((item, index) => renderCockpitRuntimeNavItem(item, `aos-nav-${index}-`)).join("\n          ");
}

export function renderCockpitRuntimeNavItem(item: CockpitRuntimeNavItem, identifierPrefix = "aos-nav-single-"): string {
  const props: RuntimeNavItemProps = {
    children: item.label,
    className: `nav-row${item.active ? " active" : ""}`,
    selected: item.active,
    href: item.href,
    "data-tcrn-component": "NavItem",
    "data-package-runtime-component": "NavItem",
    "data-package-runtime-source": "@tcrn/ui-react",
    "data-package-runtime-surface": "operations-cockpit-sidebar"
  };

  if (!item.active) {
    props.disabled = true;
    props.disabledReason = item.disabledReason;
  }

  return renderCockpitRuntimeMarkup(createElement(NavItem, props), identifierPrefix);
}

export function renderCockpitRuntimeWorkIndexCluster(options: CockpitRuntimeWorkIndexOptions): string {
  const workIndexRows: WorkIndexRow[] = options.rows.map((row) => ({
    id: row.storyId,
    title: row.title,
    state: { state: "local_only", label: row.stateLabel },
    owner: row.owner
  }));
  const filterButtons = options.filters.map((filter) => (
    createElement(Button, {
      "data-tcrn-component": "Button",
      "data-package-runtime-component": "Button",
      "data-package-runtime-source": "@tcrn/ui-react",
      key: filter.label,
      type: "button"
    } as ComponentProps<typeof Button> & RuntimeDataProps, createElement(Badge, {
      "data-tcrn-component": "Badge",
      "data-package-runtime-component": "Badge",
      "data-package-runtime-source": "@tcrn/ui-react",
      tone: filter.tone ?? "neutral"
    } as ComponentProps<typeof Badge> & RuntimeDataProps, filter.label))
  ));
  const tree = createElement("section", {
    "aria-label": "Work index",
    className: "work-index tcrn-surface",
    "data-region": "work-index",
    "data-tcrn-component": "WorkIndex",
    "data-package-runtime-component": "WorkIndex",
    "data-package-runtime-source": "@tcrn/ui-react",
    "data-package-runtime-surface": "operations-cockpit-work-index"
  },
    createElement("header", { className: "work-index-head" },
      createElement("h2", {
        className: "tcrn-heading tcrn-heading--2",
        "data-tcrn-component": "Heading"
      }, "Work Index"),
      createElement(Field, {
        label: "Search",
        children: createElement(SearchInput, {
          "data-work-search": true,
          id: "work-search",
          placeholder: "Filter service-backed rows",
          shortcut: false
        } as ComponentProps<typeof SearchInput> & RuntimeDataProps)
      }),
      createElement(Button, {
        disabled: true,
        disabledReason: options.columnsDisabledReason,
        "data-tcrn-component": "Button",
        "data-package-runtime-component": "Button",
        "data-package-runtime-source": "@tcrn/ui-react",
        type: "button"
      } as ComponentProps<typeof Button> & RuntimeDataProps, "Columns held")
    ),
    createElement(FilterBar, {
      label: "Service read-model filters",
      children: filterButtons
    }),
    createElement(WorkIndex, {
      label: "Service-backed Work Index",
      rows: workIndexRows
    }),
    createElement("div", {
      "data-empty-state": true,
      "data-tcrn-component": "StateView",
      "data-package-runtime-component": "StateView",
      "data-package-runtime-source": "@tcrn/ui-react",
      hidden: true
    }, createElement(StateView, {
      state: { state: "not_configured", label: "No matching service rows" },
      title: "No matching service rows"
    }))
  );
  return addAosWorkIndexRuntimeAttributes(renderCockpitRuntimeMarkup(tree, "aos-work-index-"), options.rows);
}

export function renderCockpitRuntimeDetailDrawer(options: CockpitRuntimeDetailDrawerOptions): string {
  const detailItems: KeyValueItem[] = options.detailRows.map((row) => ({
    key: row.key,
    label: row.label,
    value: row.value
  }));
  const detailChildren = [
    createElement("div", { className: "drawer-head", key: "drawer-head" },
      createElement(StatusBadge, {
        "data-tcrn-component": "StatusBadge",
        "data-package-runtime-component": "StatusBadge",
        "data-package-runtime-source": "@tcrn/ui-react",
        state: { state: "local_only", label: options.selectedTypeLabel }
      } as ComponentProps<typeof StatusBadge> & RuntimeDataProps),
      createElement(Button, {
        "aria-label": options.closeLabel,
        "data-close-detail": true,
        "data-tcrn-component": "Button",
        "data-package-runtime-component": "Button",
        "data-package-runtime-source": "@tcrn/ui-react",
        type: "button",
        variant: "quiet"
      } as ComponentProps<typeof Button> & RuntimeDataProps, options.closeLabel)
    ),
    createElement(KeyValueList, { items: detailItems, key: "detail-list" }),
    createElement(Surface, {
      "aria-label": "Selected work readback",
      className: "loop-card",
      "data-region": "conference-operating-loop",
      "data-tcrn-component": "Surface",
      "data-package-runtime-component": "Surface",
      "data-package-runtime-source": "@tcrn/ui-react",
      key: "selected-readback"
    } as ComponentProps<typeof Surface> & RuntimeDataProps & { key: string },
      createElement(Heading, {
        "data-tcrn-component": "Heading",
        "data-package-runtime-component": "Heading",
        "data-package-runtime-source": "@tcrn/ui-react",
        level: 3
      } as ComponentProps<typeof Heading> & RuntimeDataProps, "Selected Detail Readback"),
      createElement(Text, {
        "data-tcrn-component": "Text",
        "data-package-runtime-component": "Text",
        "data-package-runtime-source": "@tcrn/ui-react"
      } as ComponentProps<typeof Text> & RuntimeDataProps, options.operatingLoopSummary),
      createElement(Text, {
        "data-tcrn-component": "Text",
        "data-package-runtime-component": "Text",
        "data-package-runtime-source": "@tcrn/ui-react"
      } as ComponentProps<typeof Text> & RuntimeDataProps, options.noOverclaimSummary)
    ),
    createElement(Button, {
      disabled: true,
      disabledReason: options.primaryActionDisabledReason,
      "data-tcrn-component": "Button",
      "data-package-runtime-component": "Button",
      "data-package-runtime-source": "@tcrn/ui-react",
      type: "button",
      variant: "primary",
      key: "primary-action"
    } as ComponentProps<typeof Button> & RuntimeDataProps & { key: string }, options.primaryActionLabel),
    createElement(Button, {
      disabled: true,
      disabledReason: options.secondaryActionDisabledReason,
      "data-tcrn-component": "Button",
      "data-package-runtime-component": "Button",
      "data-package-runtime-source": "@tcrn/ui-react",
      type: "button",
      variant: "secondary",
      key: "secondary-action"
    } as ComponentProps<typeof Button> & RuntimeDataProps & { key: string }, options.secondaryActionLabel)
  ];
  const tree = createElement(DetailDrawer, {
    children: detailChildren,
    title: options.title,
    open: true
  } as ComponentProps<typeof DetailDrawer>);
  return addAosDetailDrawerRuntimeAttributes(renderCockpitRuntimeMarkup(tree, "aos-detail-drawer-"), options);
}

export function renderCockpitRuntimeGateReadbackCards(options: CockpitRuntimeGateReadbackCardsOptions): string {
  return [
    renderCockpitRuntimeGateWorkOrderCard(options.gateWorkOrder),
    renderCockpitRuntimeReadbackPostureCard(options.readbackPosture)
  ].join("\n            ");
}

export function renderCockpitRuntimeStagePhaseCards(options: CockpitRuntimeStagePhaseOptions): string {
  const stageMapCard = createElement(Surface, {
    "aria-label": "Development stage map",
    className: "panel stage-panel",
    "data-region": "stage-map",
    "data-tcrn-component": "Surface",
    "data-package-runtime-component": "Surface",
    "data-package-runtime-source": "@tcrn/ui-react",
    "data-package-runtime-surface": "operations-cockpit-stage-phase"
  } as ComponentProps<typeof Surface> & RuntimeDataProps,
    createElement("div", { className: "panel-head" },
      createElement(Heading, {
        className: "tcrn-heading",
        "data-tcrn-component": "Heading",
        "data-package-runtime-component": "Heading",
        "data-package-runtime-source": "@tcrn/ui-react",
        level: 2
      } as ComponentProps<typeof Heading> & RuntimeDataProps, "Stage Map"),
      createElement(Button, {
        className: "nav-disabled",
        disabled: true,
        disabledReason: options.stageDetailDisabledReason,
        "data-tcrn-component": "Button",
        "data-package-runtime-component": "Button",
        "data-package-runtime-source": "@tcrn/ui-react",
        "data-package-runtime-surface": "operations-cockpit-stage-phase",
        type: "button",
        variant: "secondary"
      } as ComponentProps<typeof Button> & RuntimeDataProps, "Stage detail held")
    ),
    createElement("ol", { className: "stage-line" },
      options.stages.map((stage) => createElement("li", {
        className: stage.state,
        "data-package-runtime-surface": "operations-cockpit-stage-phase",
        "data-stage-evidence-count": String(stage.evidenceCount),
        "data-stage-freshness": stage.freshnessLabel,
        "data-stage-gate-count": String(stage.sourceGateCount),
        "data-stage-id": stage.stageId,
        "data-stage-owner-count": String(stage.ownerRoles.length),
        "data-stage-release-readiness": stage.releaseReadinessLabel,
        "data-stage-state": stage.state,
        key: stage.stageId
      },
        createElement(Text, {
          className: "stage-label",
          "data-tcrn-component": "Text",
          "data-package-runtime-component": "Text",
          "data-package-runtime-source": "@tcrn/ui-react"
        } as ComponentProps<typeof Text> & RuntimeDataProps, stage.label),
        createElement(Badge, {
          className: "stage-number",
          "data-tcrn-component": "Badge",
          "data-package-runtime-component": "Badge",
          "data-package-runtime-source": "@tcrn/ui-react"
        } as ComponentProps<typeof Badge> & RuntimeDataProps, String(stage.index + 1)),
        createElement(StatusBadge, {
          className: `state-chip ${stage.state}`,
          "data-tcrn-component": "StatusBadge",
          "data-package-runtime-component": "StatusBadge",
          "data-package-runtime-source": "@tcrn/ui-react",
          state: cockpitStageStatusBadgeState(stage)
        } as ComponentProps<typeof StatusBadge> & RuntimeDataProps)
      ))
    )
  );

  const phaseCard = createElement(Surface, {
    "aria-label": "AI employee responsibility by phase",
    className: "panel",
    "data-region": "ai-employee-phase",
    "data-tcrn-component": "Surface",
    "data-package-runtime-component": "Surface",
    "data-package-runtime-source": "@tcrn/ui-react",
    "data-package-runtime-surface": "operations-cockpit-stage-phase"
  } as ComponentProps<typeof Surface> & RuntimeDataProps,
    createElement("div", { className: "panel-head" },
      createElement(Heading, {
        className: "tcrn-heading",
        "data-tcrn-component": "Heading",
        "data-package-runtime-component": "Heading",
        "data-package-runtime-source": "@tcrn/ui-react",
        level: 2
      } as ComponentProps<typeof Heading> & RuntimeDataProps, "AI Employee Phase"),
      createElement(Button, {
        className: "nav-disabled",
        disabled: true,
        disabledReason: options.roleDetailDisabledReason,
        "data-tcrn-component": "Button",
        "data-package-runtime-component": "Button",
        "data-package-runtime-source": "@tcrn/ui-react",
        "data-package-runtime-surface": "operations-cockpit-stage-phase",
        type: "button",
        variant: "secondary"
      } as ComponentProps<typeof Button> & RuntimeDataProps, "Role detail held")
    ),
    createElement("div", { className: "phase-list" },
      options.stages.map((stage) => createElement("div", {
        className: "phase-row",
        "data-package-runtime-surface": "operations-cockpit-stage-phase",
        "data-phase-stage-id": stage.stageId,
        "data-phase-state": stage.state,
        key: stage.stageId
      },
        createElement(Text, {
          className: "phase-label",
          "data-tcrn-component": "Text",
          "data-package-runtime-component": "Text",
          "data-package-runtime-source": "@tcrn/ui-react"
        } as ComponentProps<typeof Text> & RuntimeDataProps, stage.label),
        createElement("span", { className: "phase-owners" },
          stage.ownerRoles.map((role) => createElement(Badge, {
            className: "avatar",
            "data-owner-role": role,
            "data-tcrn-component": "Badge",
            "data-package-runtime-component": "Badge",
            "data-package-runtime-source": "@tcrn/ui-react",
            key: `${stage.stageId}-${role}`,
            title: role
          } as ComponentProps<typeof Badge> & RuntimeDataProps, role.slice(0, 2)))
        ),
        createElement(StatusBadge, {
          className: `state-chip ${stage.state}`,
          "data-tcrn-component": "StatusBadge",
          "data-package-runtime-component": "StatusBadge",
          "data-package-runtime-source": "@tcrn/ui-react",
          state: cockpitStageStatusBadgeState(stage)
        } as ComponentProps<typeof StatusBadge> & RuntimeDataProps)
      ))
    )
  );

  return renderCockpitRuntimeMarkup(createElement(Fragment, null, stageMapCard, phaseCard), "aos-stage-phase-");
}

export function renderCockpitRuntimeGateWorkOrderCard(options: CockpitRuntimeGateWorkOrderOptions): string {
  const state = {
    state: "proof_required",
    label: "Gate Work Order",
    description: options.gateSummary
  } as ComponentProps<typeof GateReadinessPanel>["state"];
  const heldButton = renderCockpitRuntimeMarkup(createElement(Button, {
    disabled: true,
    disabledReason: options.disabledReason,
    "data-tcrn-component": "Button",
    "data-package-runtime-component": "Button",
    "data-package-runtime-source": "@tcrn/ui-react",
    type: "button",
    variant: "secondary"
  } as ComponentProps<typeof Button> & RuntimeDataProps, "Gate request held"), "aos-gate-held-button-");
  const gateBlock = `<div class="gate-block tcrn-state-view" data-tcrn-component="StateView" data-package-runtime-component="StateView" data-package-runtime-source="@tcrn/ui-react" data-package-runtime-surface="operations-cockpit-gate-readback-cards"><span>${escapeAttribute(options.gateTypeLabel)}</span><strong>${escapeAttribute(options.gateOwnerRole)}</strong><span>${escapeAttribute(options.gateStatusLabel)}</span><span>${escapeAttribute(options.gateModeLabel)}</span></div>`;
  const card = renderCockpitRuntimeMarkup(createElement(GateReadinessPanel, {
    state
  }), "aos-gate-panel-");
  return addAosGateWorkOrderRuntimeAttributes(card, options, gateBlock, heldButton);
}

export function renderCockpitRuntimeReadbackPostureCard(options: CockpitRuntimeReadbackPostureOptions): string {
  const readbackItems: KeyValueItem[] = [
    { key: "runtime-fixture", label: "Runtime fixture", value: options.runtimeFixtureLabel },
    { key: "evidence", label: "Evidence", value: options.evidenceLabel },
    { key: "dependency", label: "Dependency", value: options.dependencyLabel },
    { key: "resource", label: "Resource", value: options.resourceLabel }
  ];
  const heldButton = createElement(Button, {
    disabled: true,
    disabledReason: options.disabledReason,
    "data-tcrn-component": "Button",
    "data-package-runtime-component": "Button",
    "data-package-runtime-source": "@tcrn/ui-react",
    key: "evidence-detail-held",
    type: "button",
    variant: "secondary"
  } as ComponentProps<typeof Button> & RuntimeDataProps & { key: string }, "Evidence detail held");
  const tree = createElement(ReadbackPanel, {
    title: "Readback Posture",
    children: [
      heldButton,
      createElement(KeyValueList, { items: readbackItems, key: "readback-list" })
    ]
  } as ComponentProps<typeof ReadbackPanel>);
  return addAosReadbackPostureRuntimeAttributes(renderCockpitRuntimeMarkup(tree, "aos-readback-panel-"));
}

function cockpitStageStatusBadgeState(stage: CockpitRuntimeStageMapItem): ComponentProps<typeof StatusBadge>["state"] {
  if (stage.state === "blocked") {
    return { state: "blocked", label: stage.stateLabel } as ComponentProps<typeof StatusBadge>["state"];
  }

  if (stage.state === "release_proof_required") {
    return { state: "external_proof_needed", label: stage.stateLabel } as ComponentProps<typeof StatusBadge>["state"];
  }

  if (stage.state === "not_started") {
    return { state: "not_configured", label: stage.stateLabel } as ComponentProps<typeof StatusBadge>["state"];
  }

  return { state: "local_only", label: stage.stateLabel } as ComponentProps<typeof StatusBadge>["state"];
}

function renderCockpitRuntimeMarkup(node: ReturnType<typeof createElement>, identifierPrefix: string): string {
  return renderToStaticMarkup(node, { identifierPrefix });
}

function addAosTopbarCheckpointRuntimeAttributes(html: string): string {
  return html
    .replace(
      /<header class="tcrn-top-bar">/,
      '<header class="topbar tcrn-top-bar" data-region="topbar-checkpoint" data-tcrn-component="TopBar" data-package-runtime-component="TopBar" data-package-runtime-source="@tcrn/ui-react" data-package-runtime-surface="operations-cockpit-topbar-checkpoint">'
    )
    .replace(
      /<div class="tcrn-top-bar__brand">/,
      '<div class="tcrn-top-bar__brand" data-package-runtime-subcomponent="TopBar.brand">'
    )
    .replace(
      /<div class="tcrn-top-bar__module">/,
      '<div class="tcrn-top-bar__module" data-package-runtime-subcomponent="TopBar.module">'
    )
    .replace(
      /<div class="tcrn-top-bar__actions">/,
      '<div class="tcrn-top-bar__actions" data-topbar-actions="true">'
    )
    .replace(
      /<label class="tcrn-field"/,
      '<label class="project-selector tcrn-field" data-region="project-selector" data-tcrn-component="Field" data-package-runtime-component="Field" data-package-runtime-source="@tcrn/ui-react"'
    )
    .replace(
      /<section class="tcrn-surface tcrn-readback-panel">/,
      '<section class="checkpoint-strip tcrn-surface tcrn-readback-panel" data-region="checkpoint-strip" data-tcrn-component="ReadbackPanel" data-package-runtime-component="ReadbackPanel" data-package-runtime-source="@tcrn/ui-react" data-package-runtime-surface="operations-cockpit-topbar-checkpoint" aria-label="Local checkpoint">'
    )
    .replace(
      /<h3 class="tcrn-heading tcrn-heading--3">/,
      '<h3 class="tcrn-heading tcrn-heading--3" data-tcrn-component="Heading" data-package-runtime-component="Heading" data-package-runtime-source="@tcrn/ui-react">'
    );
}

function addAosEvidenceStripRuntimeAttributes(
  html: string,
  options: {
    ariaLabel: string;
    className: string;
    itemCount: number;
    region: "claim-strip" | "risk-lane";
  },
  childrenHtml: string
): string {
  return html.replace(
    /<div class="tcrn-evidence-strip"><\/div>/,
    `<section class="${options.className}" data-region="${options.region}" data-tcrn-component="EvidenceStrip" data-package-runtime-component="EvidenceStrip" data-package-runtime-source="@tcrn/ui-react" data-package-runtime-surface="operations-cockpit-claim-risk-strips" data-package-runtime-item-count="${options.itemCount}" aria-label="${options.ariaLabel}">${childrenHtml}</section>`
  );
}

function addAosWorkIndexRuntimeAttributes(html: string, rows: readonly CockpitRuntimeWorkIndexRow[]): string {
  let rowIndex = 0;
  return html
    .replace(
      /<label class="tcrn-field"/,
      '<label class="search-box tcrn-field" data-tcrn-component="Field" data-package-runtime-component="Field" data-package-runtime-source="@tcrn/ui-react"'
    )
    .replace(
      /<span class="tcrn-search-input" data-search-input="true"/,
      '<span class="tcrn-search-input" data-search-input="true" data-tcrn-component="SearchInput" data-package-runtime-component="SearchInput" data-package-runtime-source="@tcrn/ui-react"'
    )
    .replace(
      /(<input\b(?=[^>]*id="work-search")(?=[^>]*class="[^"]*\btcrn-input\b)[^>]*?)(\s*\/?>)/,
      (_match, inputStart: string, close: string) => `${inputStart} data-package-runtime-subcomponent="SearchInput.control" data-package-runtime-source="@tcrn/ui-react"${close}`
    )
    .replace(
      /<section class="tcrn-filter-bar" aria-label="Service read-model filters">/,
      '<section class="filter-row tcrn-filter-bar" data-tcrn-component="FilterBar" data-package-runtime-component="FilterBar" data-package-runtime-source="@tcrn/ui-react" aria-label="Service read-model filters">'
    )
    .replace(
      /<div class="tcrn-table-shell" role="table"/,
      '<div class="work-table tcrn-table-shell" data-tcrn-component="TableShell" data-package-runtime-component="TableShell" data-package-runtime-source="@tcrn/ui-react" data-package-runtime-surface="operations-cockpit-work-index" data-work-table role="table"'
    )
    .replace(
      /<div role="row" class="tcrn-table-shell__head">/,
      '<div role="row" class="table-row table-head tcrn-table-shell__head">'
    )
    .replace(/<div role="row" class="tcrn-table-shell__row">([\s\S]*?)<\/div>/g, (_match, cells: string) => {
      const row = rows[rowIndex];
      rowIndex += 1;
      if (!row) return _match;
      return `<button class="table-row work-row tcrn-table-shell__row${row.active ? " active" : ""}" data-tcrn-component="TableShell" data-package-runtime-component="TableShell" data-package-runtime-source="@tcrn/ui-react" data-package-runtime-surface="operations-cockpit-work-index" data-work-row data-row-id="${escapeAttribute(row.storyId)}" data-title="${escapeAttribute(row.title)}" data-search="${escapeAttribute(row.searchText)}" data-evidence="${escapeAttribute(row.evidenceLabel)}" data-gate="${escapeAttribute(row.gateLabel)}" type="button" role="row">${cells}</button>`;
    });
}

function addAosDetailDrawerRuntimeAttributes(html: string, options: CockpitRuntimeDetailDrawerOptions): string {
  return html
    .replace(
      /<aside class="tcrn-detail-drawer"/,
      `<aside class="detail-drawer tcrn-detail-drawer" data-region="detail-drawer" data-slice5="work-index-drill-through" data-tcrn-component="DetailDrawer" data-package-runtime-component="DetailDrawer" data-package-runtime-source="@tcrn/ui-react" data-package-runtime-surface="operations-cockpit-detail-drawer" data-service-detail-id="${escapeAttribute(options.selectedId)}" data-service-detail-type="${escapeAttribute(options.selectedType)}" data-selected-story-id="${escapeAttribute(options.selectedId)}"`
    )
    .replace(
      /<h3 id="([^"]+)" class="tcrn-heading tcrn-heading--3">/,
      '<h3 id="$1" class="tcrn-heading tcrn-heading--3" data-drawer-title data-tcrn-component="Heading" data-package-runtime-component="Heading" data-package-runtime-source="@tcrn/ui-react">'
    )
    .replace(
      /<dl class="tcrn-key-value-list">/,
      '<dl class="detail-list tcrn-key-value-list" data-detail-list data-tcrn-component="KeyValueList" data-package-runtime-component="KeyValueList" data-package-runtime-source="@tcrn/ui-react">'
    );
}

function addAosGateWorkOrderRuntimeAttributes(
  html: string,
  options: CockpitRuntimeGateWorkOrderOptions,
  gateBlock: string,
  heldButton: string
): string {
  return html
    .replace(
      /<section data-state="([^"]+)" class="tcrn-surface tcrn-gate-readiness-panel">/,
      '<article class="panel tcrn-surface tcrn-gate-readiness-panel" data-state="$1" data-region="blocker-gate-card" data-tcrn-component="GateReadinessPanel" data-package-runtime-component="GateReadinessPanel" data-package-runtime-source="@tcrn/ui-react" data-package-runtime-surface="operations-cockpit-gate-readback-cards" aria-label="Blocker and gate posture">'
    )
    .replace(
      /<h3 class="tcrn-heading tcrn-heading--3">([\s\S]*?)<\/h3>/,
      `<div class="panel-head"><h2 class="tcrn-heading tcrn-heading--2" data-tcrn-component="Heading" data-package-runtime-component="Heading" data-package-runtime-source="@tcrn/ui-react">$1</h2><span class="count tcrn-badge tcrn-badge--danger" data-tcrn-component="Badge" data-package-runtime-component="Badge" data-package-runtime-source="@tcrn/ui-react">${options.count}</span></div>`
    )
    .replace(
      /<p class="tcrn-text">/,
      '<p class="tcrn-text" data-tcrn-component="Text" data-package-runtime-component="Text" data-package-runtime-source="@tcrn/ui-react">'
    )
    .replace(
      /<span data-state="([^"]+)" class="tcrn-badge/,
      '<span data-state="$1" data-tcrn-component="StatusBadge" data-package-runtime-component="StatusBadge" data-package-runtime-source="@tcrn/ui-react" class="tcrn-badge'
    )
    .replace(/<\/section>$/, `${gateBlock}${heldButton}</article>`);
}

function addAosReadbackPostureRuntimeAttributes(html: string): string {
  return html
    .replace(
      /<section class="tcrn-surface tcrn-readback-panel">/,
      '<article class="panel tcrn-surface tcrn-readback-panel" data-region="readback-posture-card" data-tcrn-component="ReadbackPanel" data-package-runtime-component="ReadbackPanel" data-package-runtime-source="@tcrn/ui-react" data-package-runtime-surface="operations-cockpit-gate-readback-cards" aria-label="Readback posture">'
    )
    .replace(
      /<h3 class="tcrn-heading tcrn-heading--3">Readback Posture<\/h3>(<button\b[\s\S]*?<\/button>)/,
      '<div class="panel-head"><h2 class="tcrn-heading tcrn-heading--2" data-tcrn-component="Heading" data-package-runtime-component="Heading" data-package-runtime-source="@tcrn/ui-react">Readback Posture</h2>$1</div>'
    )
    .replace(
      /<dl class="tcrn-key-value-list">/,
      '<dl class="posture-list tcrn-key-value-list" data-tcrn-component="KeyValueList" data-package-runtime-component="KeyValueList" data-package-runtime-source="@tcrn/ui-react" data-package-runtime-surface="operations-cockpit-gate-readback-cards">'
    )
    .replace(/<\/section>$/, "</article>");
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
