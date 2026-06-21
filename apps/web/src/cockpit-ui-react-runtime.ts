import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Badge,
  Button,
  DetailDrawer,
  Field,
  FilterBar,
  Heading,
  KeyValueList,
  NavItem,
  SearchInput,
  StatusBadge,
  Surface,
  StateView,
  Text,
  WorkIndex,
  type KeyValueItem,
  type WorkIndexRow
} from "@tcrn/ui-react";
import { aosDesignSystemConsumerBridge } from "./design-system-bridge.js";

export const aosCockpitUiReactRuntime = {
  packageName: "@tcrn/ui-react",
  packageSpecifier: aosDesignSystemConsumerBridge.uiReactPackageSpecifier,
  designSystemSourceHead: aosDesignSystemConsumerBridge.designSystemSourceHead,
  implementationKind: "operations_cockpit_selected_detail_package_runtime_expansion",
  componentScope: [
    "NavItem",
    "WorkIndex",
    "TableShell",
    "SearchInput",
    "Field",
    "FilterBar",
    "Button",
    "Badge",
    "StateView",
    "DetailDrawer",
    "KeyValueList",
    "Surface",
    "Heading",
    "Text",
    "StatusBadge"
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

type RuntimeNavItemProps = ComponentProps<typeof NavItem> & {
  "data-tcrn-component": "NavItem";
  "data-package-runtime-component": "NavItem";
  "data-package-runtime-source": "@tcrn/ui-react";
  "data-package-runtime-surface": "operations-cockpit-sidebar";
};

type RuntimeDataProps = Record<`data-${string}`, string | boolean | undefined>;

export function renderCockpitRuntimeNavItems(items: readonly CockpitRuntimeNavItem[]): string {
  return items.map((item) => renderCockpitRuntimeNavItem(item)).join("\n          ");
}

export function renderCockpitRuntimeNavItem(item: CockpitRuntimeNavItem): string {
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

  return renderToStaticMarkup(createElement(NavItem, props));
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
  return addAosWorkIndexRuntimeAttributes(renderToStaticMarkup(tree), options.rows);
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
  return addAosDetailDrawerRuntimeAttributes(renderToStaticMarkup(tree), options);
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

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
