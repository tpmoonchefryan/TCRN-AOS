import { createElement, Fragment, type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Badge,
  Button,
  DetailDrawer,
  EvidenceStrip,
  Field,
  FilterBar,
  Heading,
  KeyValueList,
  LinkButton,
  NavGroup,
  NavItem,
  ReadbackPanel,
  SearchInput,
  Select,
  SideNav,
  StateView,
  StatusBadge,
  Surface,
  TableShell,
  Text,
  TopBar,
  type KeyValueItem,
  type TableColumn
} from "@tcrn/ui-react";
import { aosDesignSystemConsumerBridge } from "./design-system-bridge.js";
import type { DocsSearchReleaseInspectionModel } from "./docs-readiness-view.js";

export const aosDocsReadinessUiReactRuntime = {
  packageName: "@tcrn/ui-react",
  packageSpecifier: aosDesignSystemConsumerBridge.uiReactPackageSpecifier,
  designSystemSourceHead: aosDesignSystemConsumerBridge.designSystemSourceHead,
  implementationKind: "docs_readiness_search_release_package_runtime_adoption",
  componentScope: [
    "Surface",
    "SideNav",
    "NavGroup",
    "NavItem",
    "LinkButton",
    "TopBar",
    "Field",
    "Select",
    "Button",
    "Badge",
    "StatusBadge",
    "EvidenceStrip",
    "ReadbackPanel",
    "Text",
    "Heading",
    "KeyValueList",
    "WorkIndex",
    "TableShell",
    "SearchInput",
    "FilterBar",
    "StateView",
    "DetailDrawer"
  ],
  packageBackedReactRuntimeRendering: true,
  docsReadinessPackageRuntimeRendering: true,
  aosWidePackageRuntimeRendering: false,
  productAcceptanceReady: false,
  finalMvpAcceptanceReady: false
} as const;

interface DocsRuntimeNavItem {
  active: boolean;
  disabledReason: string;
  href: string;
  label: string;
}

type RuntimeDataProps = Record<`data-${string}`, string | boolean | undefined>;

export function renderDocsReadinessRuntimeSurface(model: DocsSearchReleaseInspectionModel): string {
  const selectedRow = model.rows[0];
  if (!selectedRow) {
    throw new Error("Docs Readiness package runtime requires at least one inspection row.");
  }
  const tree = createElement(Surface, {
    className: "aos-shell",
    "data-region": "docs-surface-shell",
    "data-surface": "docs-search-release-readiness",
    "data-docs-search-release-surfaces-visible": model.context.docsSearchReleaseSurfacesVisible,
    "data-product-design-acceptance": "not_claimed",
    "data-design-system-consumer": aosDesignSystemConsumerBridge.adoptionPosture,
    "data-design-system-source-head": aosDesignSystemConsumerBridge.designSystemSourceHead,
    "data-design-system-tokens": aosDesignSystemConsumerBridge.tokenPackage,
    "data-design-system-copy-state": aosDesignSystemConsumerBridge.copyStatePackage,
    "data-design-system-certified-standard-id": aosDesignSystemConsumerBridge.servedSurfaceStandardIds.docsSearchReleaseReadiness,
    "data-design-system-exception-records": aosDesignSystemConsumerBridge.acceptedExceptionRecords.join(","),
    "data-package-backed-react-runtime-rendering": true,
    "data-package-runtime-component": "Surface",
    "data-package-runtime-component-scope": aosDocsReadinessUiReactRuntime.componentScope.join(","),
    "data-package-runtime-source": "@tcrn/ui-react",
    "data-package-runtime-surface": aosDocsReadinessUiReactRuntime.implementationKind,
    "data-tcrn-component": "Surface"
  } as ComponentProps<typeof Surface> & RuntimeDataProps,
    renderSidebar(),
    createElement("section", { className: "aos-main", id: "inspection" },
      renderTopbar(model),
      createElement("div", { className: "workspace" },
        renderHero(model),
        renderSummaryGrid(model),
        createElement("section", { className: "content-grid" },
          renderWorkIndex(model),
          renderDetailDrawer(model, selectedRow)
        )
      )
    )
  );

  return addDocsReadinessRuntimeAttributes(renderToStaticMarkup(tree, { identifierPrefix: "aos-docs-readiness-" }), model);
}

function renderSidebar(): ReactNode {
  const navItems: DocsRuntimeNavItem[] = [
    docsNavItem("Dashboard", false),
    docsNavItem("Cockpit", false),
    docsNavItem("Docs Readiness", true),
    docsNavItem("Evidence", false),
    docsNavItem("Release Linkage", false)
  ];

  return createElement(SideNav, {
    className: "aos-sidebar",
    "data-region": "sidebar-nav",
    "data-tcrn-component": "SideNav",
    "data-package-runtime-component": "SideNav",
    "data-package-runtime-source": "@tcrn/ui-react",
    "data-package-runtime-surface": "docs-readiness-shell",
    label: "AOS navigation"
  } as unknown as ComponentProps<typeof SideNav> & RuntimeDataProps,
    createElement(LinkButton, {
      "aria-label": "TCRN AOS",
      className: "brand-lockup",
      "data-region": "brand-lockup",
      "data-tcrn-component": "LinkButton",
      "data-package-runtime-component": "LinkButton",
      "data-package-runtime-source": "@tcrn/ui-react",
      "data-package-runtime-surface": "docs-readiness-shell",
      href: "#inspection",
      variant: "quiet"
    } as ComponentProps<typeof LinkButton> & RuntimeDataProps,
      createElement("span", { className: "brand-tcrn" }, "TCRN"),
      createElement("span", { className: "brand-aos" }, "AOS")
    ),
    createElement(NavGroup, {
      "aria-label": "Primary views",
      className: "nav-stack",
      "data-tcrn-component": "NavGroup",
      "data-package-runtime-component": "NavGroup",
      "data-package-runtime-source": "@tcrn/ui-react",
      "data-package-runtime-surface": "docs-readiness-shell",
      label: "Primary views"
    } as unknown as ComponentProps<typeof NavGroup> & RuntimeDataProps,
      navItems.map((item) => createElement(NavItem, {
        className: `nav-row${item.active ? " active" : ""}`,
        disabled: !item.active,
        disabledReason: item.active ? undefined : item.disabledReason,
        href: item.href,
        key: item.label,
        selected: item.active,
        "data-tcrn-component": "NavItem",
        "data-package-runtime-component": "NavItem",
        "data-package-runtime-source": "@tcrn/ui-react",
        "data-package-runtime-surface": "docs-readiness-shell"
      } as unknown as ComponentProps<typeof NavItem> & RuntimeDataProps, item.label))
    ),
    createElement("footer", { className: "sidebar-note" },
      createElement("span", { className: "state-dot state-current" }),
      createElement(Text, {
        "data-tcrn-component": "Text",
        "data-package-runtime-component": "Text",
        "data-package-runtime-source": "@tcrn/ui-react",
        "data-package-runtime-surface": "docs-readiness-shell"
      } as ComponentProps<typeof Text> & RuntimeDataProps, "Local readiness data")
    )
  );
}

function renderTopbar(model: DocsSearchReleaseInspectionModel): ReactNode {
  return createElement(TopBar, {
    productName: "TCRN AOS",
    moduleName: "Docs Readiness",
    actions: createElement(Fragment, null,
      createElement(Field, {
        label: "Project",
        children: createElement(Select, {
          "aria-label": "Project selector",
          "data-tcrn-component": "Select",
          "data-package-runtime-component": "Select",
          "data-package-runtime-source": "@tcrn/ui-react",
          defaultValue: model.context.projectId,
          id: "project-select",
          options: [{ label: model.context.projectId, value: model.context.projectId }]
        } as ComponentProps<typeof Select> & RuntimeDataProps)
      }),
      createElement(ReadbackPanel, {
        title: "Readiness status",
        children: [
          createElement("strong", { "data-local-status": true, key: "status" }, "Local docs workspace"),
          createElement(StatusBadge, {
            "data-tcrn-component": "StatusBadge",
            "data-package-runtime-component": "StatusBadge",
            "data-package-runtime-source": "@tcrn/ui-react",
            key: "freshness",
            state: { state: "local_only", label: "Current" }
          } as ComponentProps<typeof StatusBadge> & RuntimeDataProps & { key: string })
        ]
      }),
      createElement(Button, {
        className: "top-action",
        "data-tcrn-component": "Button",
        "data-package-runtime-component": "Button",
        "data-package-runtime-source": "@tcrn/ui-react",
        type: "button",
        variant: "secondary"
      } as ComponentProps<typeof Button> & RuntimeDataProps, "Refresh")
    )
  });
}

function renderHero(model: DocsSearchReleaseInspectionModel): ReactNode {
  return createElement("section", { className: "hero-row" },
    createElement("div", null,
      createElement(Text, {
        className: "eyebrow",
        "data-tcrn-component": "Text",
        "data-package-runtime-component": "Text",
        "data-package-runtime-source": "@tcrn/ui-react",
        "data-package-runtime-surface": "docs-readiness-hero"
      } as ComponentProps<typeof Text> & RuntimeDataProps, "Docs / Search / Release-Candidate"),
      createElement(Heading, {
        level: 1,
        "data-tcrn-component": "Heading",
        "data-package-runtime-component": "Heading",
        "data-package-runtime-source": "@tcrn/ui-react",
        "data-package-runtime-surface": "docs-readiness-hero"
      } as ComponentProps<typeof Heading> & RuntimeDataProps, "Docs Readiness")
    ),
    createElement(EvidenceStrip, {
      items: [
        "Drafts stay local",
        "Release actions disabled",
        "Review state visible"
      ]
    })
  );
}

function renderSummaryGrid(model: DocsSearchReleaseInspectionModel): ReactNode {
  return createElement("section", { className: "summary-grid" },
    renderSummaryPanel({
      ariaLabel: "Docs readiness board",
      badgeLabel: String(model.aggregateIndex.docsReadinessRecordIds.length),
      region: "docs-readiness-board",
      title: "Docs Readiness",
      rows: [
        { key: "state", label: "State", value: createElement(Fragment, null, createElement("span", { className: "state-dot state-review" }), copyPosture(model.docsReadiness.readinessState)) },
        { key: "freshness", label: "Freshness", value: copyPosture(model.docsReadiness.freshnessState) },
        { key: "blocker", label: "Blocker", value: model.docsReadiness.blockers[0] ?? "release review pending" },
        { key: "evidence", label: "Evidence", value: `${model.docsReadiness.linkedEvidenceIds.length} metadata link` }
      ]
    }),
    createElement(Surface, {
      "aria-label": "Search inspection",
      className: "panel",
      "data-region": "search-inspection",
      "data-tcrn-component": "Surface",
      "data-package-runtime-component": "Surface",
      "data-package-runtime-source": "@tcrn/ui-react",
      "data-package-runtime-surface": "docs-readiness-summary"
    } as ComponentProps<typeof Surface> & RuntimeDataProps,
      createElement("div", { className: "panel-head" },
        runtimeHeading("Search Inspection", 2),
        runtimeBadge("Local index", "Badge", "tag")
      ),
      createElement(Text, {
        className: "compact-copy",
        "data-tcrn-component": "Text",
        "data-package-runtime-component": "Text",
        "data-package-runtime-source": "@tcrn/ui-react"
      } as ComponentProps<typeof Text> & RuntimeDataProps, model.searchIndex.summary),
      createElement("div", { className: "term-list" },
        model.searchIndex.sanitizedTerms.map((term) => createElement(Badge, {
          "data-tcrn-component": "Badge",
          "data-package-runtime-component": "Badge",
          "data-package-runtime-source": "@tcrn/ui-react",
          key: term
        } as ComponentProps<typeof Badge> & RuntimeDataProps, term))
      )
    ),
    renderSummaryPanel({
      ariaLabel: "GitHub metadata and PR CI linkage",
      badgeLabel: copyPosture(model.githubMetadata.readbackState),
      badgeKind: "StatusBadge",
      region: "github-prci-linkage",
      title: "GitHub / PR CI",
      rows: [
        { key: "repo", label: "Repo", value: model.githubMetadata.repositoryName },
        { key: "pr", label: "PR", value: model.githubMetadata.pullRequestRefs[0] ?? "metadata missing" },
        { key: "ci", label: "CI", value: copyPosture(model.prCiReadiness.ciState) },
        { key: "actions", label: "Actions", value: "Read only" }
      ]
    }),
    renderSummaryPanel({
      ariaLabel: "Release-candidate linkage",
      badgeLabel: "review needed",
      badgeKind: "StatusBadge",
      badgeClassName: "state-chip release_proof_required",
      region: "release-candidate-linkage",
      runtimeComponent: "Surface",
      title: "Release Candidate",
      rows: [
        { key: "label", label: "Label", value: model.releaseCandidate.releaseCandidateLabel },
        { key: "dependencies", label: "Dependencies", value: `${model.releaseCandidate.dependencyBlockerIds.length} blocker` },
        { key: "resources", label: "Resources", value: `${model.releaseCandidate.resourceBlockerIds.length} blocker` },
        { key: "creation", label: "Creation", value: "Disabled" }
      ]
    })
  );
}

function renderWorkIndex(model: DocsSearchReleaseInspectionModel): ReactNode {
  const columns: TableColumn[] = [
    { key: "story", label: "Story" },
    { key: "surface", label: "Surface" },
    { key: "state", label: "State" },
    { key: "owner", label: "Owner" },
    { key: "blocker", label: "Blocker" },
    { key: "evidence", label: "Evidence" }
  ];
  const rows = model.rows.map((row) => ({
    story: row.storyId,
    surface: row.kind,
    state: copyPosture(row.status),
    owner: row.owner,
    blocker: row.blocker,
    evidence: `${row.linkedEvidenceCount} link`
  }));

  return createElement("section", {
    "aria-label": "Docs readiness work index",
    className: "work-index tcrn-surface",
    "data-region": "work-index",
    "data-tcrn-component": "WorkIndex",
    "data-package-runtime-component": "WorkIndex",
    "data-package-runtime-source": "@tcrn/ui-react",
    "data-package-runtime-surface": "docs-readiness-work-index"
  },
    createElement("header", { className: "work-index-head" },
      runtimeHeading("Inspection Rows", 2),
      createElement(Field, {
        label: "Search inspection rows",
        children: createElement(SearchInput, {
          "data-tcrn-component": "SearchInput",
          "data-package-runtime-component": "SearchInput",
          "data-package-runtime-source": "@tcrn/ui-react",
          id: "readiness-search",
          placeholder: "Filter docs, GitHub, candidate rows",
          shortcut: false
        } as ComponentProps<typeof SearchInput> & RuntimeDataProps)
      }),
      createElement(Button, {
        "data-tcrn-component": "Button",
        "data-package-runtime-component": "Button",
        "data-package-runtime-source": "@tcrn/ui-react",
        type: "button",
        variant: "secondary"
      } as ComponentProps<typeof Button> & RuntimeDataProps, "Columns")
    ),
    createElement(FilterBar, {
      label: "Local filters",
      children: [
        filterButton(`Project: ${model.context.projectId}`, "project"),
        filterButton("Scope: Docs readiness", "scope"),
        filterButton("Storage: local first", "storage")
      ]
    }),
    createElement(TableShell, {
      columns,
      label: "Docs readiness rows",
      rows,
      emptyState: "No local metadata rows match this filter."
    }),
    createElement("div", {
      "data-empty-state": true,
      "data-tcrn-component": "StateView",
      "data-package-runtime-component": "StateView",
      "data-package-runtime-source": "@tcrn/ui-react",
      hidden: true
    },
      createElement(StateView, {
        state: { state: "not_configured", label: "No local metadata rows" },
        title: "No local metadata rows match this filter."
      })
    )
  );
}

function renderDetailDrawer(model: DocsSearchReleaseInspectionModel, selectedRow: DocsSearchReleaseInspectionModel["rows"][number]): ReactNode {
  const detailItems: KeyValueItem[] = [
    { key: "story", label: "Story", value: createElement("span", { "data-detail-story": true }, selectedRow.storyId) },
    { key: "state", label: "State", value: createElement("span", { "data-detail-status": true }, copyPosture(selectedRow.status)) },
    { key: "blocker", label: "Blocker", value: createElement("span", { "data-detail-blocker": true }, selectedRow.blocker) },
    { key: "detail", label: "Detail", value: createElement("span", { "data-detail-copy": true }, selectedRow.detail) }
  ];

  return createElement(DetailDrawer, {
    open: true,
    title: selectedRow.title
  } as unknown as ComponentProps<typeof DetailDrawer>,
    createElement("div", { className: "drawer-head" },
      createElement(Badge, {
        "data-detail-kind": true,
        "data-tcrn-component": "Badge",
        "data-package-runtime-component": "Badge",
        "data-package-runtime-source": "@tcrn/ui-react"
      } as ComponentProps<typeof Badge> & RuntimeDataProps, selectedRow.kind),
      createElement(Button, {
        "aria-label": "Close detail",
        "data-tcrn-component": "Button",
        "data-package-runtime-component": "Button",
        "data-package-runtime-source": "@tcrn/ui-react",
        type: "button",
        variant: "quiet"
      } as ComponentProps<typeof Button> & RuntimeDataProps, "Close")
    ),
    createElement(KeyValueList, { items: detailItems }),
    createElement(ReadbackPanel, {
      title: "Readiness details",
      children: createElement(KeyValueList, {
        items: [
          { key: "scope", label: "Scope", value: "Docs and release readiness" },
          { key: "source", label: "Source", value: "Local metadata" },
          { key: "mode", label: "Mode", value: "Read only" },
          { key: "status", label: "Status", value: "Review active" }
        ]
      })
    })
  );
}

function renderSummaryPanel(options: {
  ariaLabel: string;
  badgeClassName?: string;
  badgeKind?: "Badge" | "StatusBadge";
  badgeLabel: string;
  region: string;
  rows: KeyValueItem[];
  runtimeComponent?: "Surface";
  title: string;
}): ReactNode {
  return createElement(Surface, {
    "aria-label": options.ariaLabel,
    className: "panel",
    "data-region": options.region,
    "data-tcrn-component": options.runtimeComponent ?? "Surface",
    "data-package-runtime-component": options.runtimeComponent ?? "Surface",
    "data-package-runtime-source": "@tcrn/ui-react",
    "data-package-runtime-surface": "docs-readiness-summary"
  } as ComponentProps<typeof Surface> & RuntimeDataProps,
    createElement("div", { className: "panel-head" },
      runtimeHeading(options.title, 2),
      options.badgeKind === "StatusBadge"
        ? createElement(StatusBadge, {
          className: options.badgeClassName ?? "state-chip",
          "data-tcrn-component": "StatusBadge",
          "data-package-runtime-component": "StatusBadge",
          "data-package-runtime-source": "@tcrn/ui-react",
          state: { state: options.badgeLabel === "review needed" ? "external_proof_needed" : "local_only", label: options.badgeLabel }
        } as ComponentProps<typeof StatusBadge> & RuntimeDataProps)
        : runtimeBadge(options.badgeLabel, "Badge", "count")
    ),
    createElement(KeyValueList, { items: options.rows })
  );
}

function filterButton(label: string, key: string): ReactNode {
  return createElement(Button, {
    "data-filter-key": key,
    "data-tcrn-component": "Button",
    "data-package-runtime-component": "Button",
    "data-package-runtime-source": "@tcrn/ui-react",
    key,
    type: "button",
    variant: "secondary"
  } as ComponentProps<typeof Button> & RuntimeDataProps & { key: string }, label);
}

function runtimeHeading(label: string, level: ComponentProps<typeof Heading>["level"]): ReactNode {
  return createElement(Heading, {
    "data-tcrn-component": "Heading",
    "data-package-runtime-component": "Heading",
    "data-package-runtime-source": "@tcrn/ui-react",
    level
  } as ComponentProps<typeof Heading> & RuntimeDataProps, label);
}

function runtimeBadge(label: string, component: "Badge", className?: string): ReactNode {
  return createElement(Badge, {
    className,
    "data-tcrn-component": component,
    "data-package-runtime-component": component,
    "data-package-runtime-source": "@tcrn/ui-react"
  } as ComponentProps<typeof Badge> & RuntimeDataProps, label);
}

function docsNavItem(label: string, active: boolean): DocsRuntimeNavItem {
  return {
    active,
    disabledReason: `${label} opens when that AOS workspace is available.`,
    href: "#docs-readiness",
    label
  };
}

function copyPosture(value: string): string {
  if (value === "needs_review") return "needs review";
  if (value === "review_due") return "review due";
  if (value === "fixture_readback") return "local evidence review";
  if (value === "metadata_only") return "metadata only";
  if (value === "not_ready_for_release") return "release review pending";
  if (value === "release_proof_required") return "review needed";
  if (value === "absent_acceptable") return "absent acceptable";
  if (value === "warning") return "warning";
  return value.replaceAll("_", " ");
}

function addDocsReadinessRuntimeAttributes(html: string, model: DocsSearchReleaseInspectionModel): string {
  let rowIndex = 0;
  let keyValueListIndex = 0;
  return html
    .replace("<section", "<main")
    .replace(/<\/section>$/, "</main>")
    .replace(
      /<header class="tcrn-top-bar">/,
      '<header class="topbar tcrn-top-bar" data-region="docs-topbar" data-tcrn-component="TopBar" data-package-runtime-component="TopBar" data-package-runtime-source="@tcrn/ui-react" data-package-runtime-surface="docs-readiness-topbar">'
    )
    .replace(
      /<label class="tcrn-field"/,
      '<label class="project-selector tcrn-field" data-region="project-selector" data-tcrn-component="Field" data-package-runtime-component="Field" data-package-runtime-source="@tcrn/ui-react"'
    )
    .replace(
      /<label class="tcrn-field"/,
      '<label class="search-box tcrn-field" data-tcrn-component="Field" data-package-runtime-component="Field" data-package-runtime-source="@tcrn/ui-react"'
    )
    .replace(
      /<section class="tcrn-surface tcrn-readback-panel">/,
      '<section class="checkpoint-strip tcrn-surface tcrn-readback-panel" data-region="checkpoint-strip" data-tcrn-component="ReadbackPanel" data-package-runtime-component="ReadbackPanel" data-package-runtime-source="@tcrn/ui-react" data-package-runtime-surface="docs-readiness-topbar" aria-label="Readiness status">'
    )
    .replace(
      /<div class="tcrn-evidence-strip">/,
      '<div class="claim-strip tcrn-evidence-strip" data-region="header-claim-strip" data-tcrn-component="EvidenceStrip" data-package-runtime-component="EvidenceStrip" data-package-runtime-source="@tcrn/ui-react" data-package-runtime-surface="docs-readiness-claim-strip" aria-label="Claim boundaries">'
    )
    .replace(
      /<section class="tcrn-filter-bar" aria-label="Local filters">/,
      '<section class="filter-row tcrn-filter-bar" data-tcrn-component="FilterBar" data-package-runtime-component="FilterBar" data-package-runtime-source="@tcrn/ui-react" aria-label="Local filters">'
    )
    .replace(
      /<span class="tcrn-search-input" data-search-input="true"/,
      '<span class="tcrn-search-input" data-search-input="true" data-tcrn-component="SearchInput" data-package-runtime-component="SearchInput" data-package-runtime-source="@tcrn/ui-react"'
    )
    .replace(
      /(<input\b(?=[^>]*id="readiness-search")(?=[^>]*class="[^"]*\btcrn-input\b)[^>]*?)(\s*\/?>)/,
      (_match, inputStart: string, close: string) => `${inputStart} data-package-runtime-subcomponent="SearchInput.control" data-package-runtime-source="@tcrn/ui-react"${close}`
    )
    .replace(
      /<div class="tcrn-table-shell" role="table"/,
      '<div class="readiness-table tcrn-table-shell" data-tcrn-component="TableShell" data-package-runtime-component="TableShell" data-package-runtime-source="@tcrn/ui-react" data-package-runtime-surface="docs-readiness-work-index" data-readiness-table role="table"'
    )
    .replace(
      /<div role="row" class="tcrn-table-shell__head">/,
      '<div role="row" class="readiness-row table-head tcrn-table-shell__head">'
    )
    .replace(/<div role="row" class="tcrn-table-shell__row">([\s\S]*?)<\/div>/g, (_match, cells: string) => {
      const row = model.rows[rowIndex];
      rowIndex += 1;
      if (!row) return _match;
      const searchText = [row.storyId, row.kind, row.title, row.status, row.owner, row.blocker, row.detail, ...row.terms].join(" ");
      return `<button class="readiness-row inspection-row tcrn-table-shell__row${rowIndex === 1 ? " active" : ""}" data-tcrn-component="TableShell" data-package-runtime-component="TableShell" data-package-runtime-source="@tcrn/ui-react" data-package-runtime-surface="docs-readiness-work-index" data-readiness-row data-story="${escapeAttribute(row.storyId)}" data-kind="${escapeAttribute(row.kind)}" data-title="${escapeAttribute(row.title)}" data-status="${escapeAttribute(copyPosture(row.status))}" data-blocker="${escapeAttribute(row.blocker)}" data-detail="${escapeAttribute(row.detail)}" data-search="${escapeAttribute(searchText.toLowerCase())}" type="button" role="row">${cells}</button>`;
    })
    .replace(
      /<aside class="tcrn-detail-drawer"/,
      '<aside class="detail-drawer tcrn-detail-drawer" data-region="detail-panel" data-tcrn-component="DetailDrawer" data-package-runtime-component="DetailDrawer" data-package-runtime-source="@tcrn/ui-react" data-package-runtime-surface="docs-readiness-detail"'
    )
    .replace(
      /(<aside class="detail-drawer[\s\S]*?<h3\b)([^>]*>)/,
      "$1 data-detail-title$2"
    )
    .replace(
      /<section class="tcrn-surface tcrn-readback-panel">/,
      '<section class="evidence-panel tcrn-surface tcrn-readback-panel" data-region="evidence-readback-panel" data-tcrn-component="ReadbackPanel" data-package-runtime-component="ReadbackPanel" data-package-runtime-source="@tcrn/ui-react" data-package-runtime-surface="docs-readiness-detail" aria-label="Evidence overview panel">'
    )
    .replace(/<dl class="tcrn-key-value-list">/g, () => {
      const className = keyValueListIndex < 3 ? "posture-list tcrn-key-value-list" : "detail-list tcrn-key-value-list";
      keyValueListIndex += 1;
      return `<dl class="${className}" data-tcrn-component="KeyValueList" data-package-runtime-component="KeyValueList" data-package-runtime-source="@tcrn/ui-react">`;
    });
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
