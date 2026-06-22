import { createElement as createReactElement, type ReactNode } from "react";
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
  WorkIndex,
  type KeyValueItem,
  type TableColumn,
} from "@tcrn/ui-react";

import {
  aosDesignSystemConsumerBridge,
  presentAosCopyState,
} from "./design-system-bridge.js";
import type {
  AOSWideProductDesignModel,
  SurfaceRow,
} from "./aos-wide-product-design-data.js";

type RuntimeDataProps = Record<`data-${string}`, string | number | boolean | undefined>;

const createElement = (
  type: unknown,
  props?: Record<string, unknown> | null,
  ...children: ReactNode[]
): ReactNode => createReactElement(
  type as never,
  props,
  ...flattenReactChildren(children),
);

function flattenReactChildren(children: ReactNode[]): ReactNode[] {
  const flattened: ReactNode[] = [];
  for (const child of children) {
    if (Array.isArray(child)) {
      flattened.push(...flattenReactChildren(child));
    } else {
      flattened.push(child);
    }
  }
  return flattened;
}

const packageRuntimeSource = "@tcrn/ui-react";
const runtimeSurface = "aos_wide_product_design_target_set_package_runtime_adoption";

export const aosWideProductDesignUiReactRuntime = {
  packageName: aosDesignSystemConsumerBridge.uiReactPackage,
  packageSpecifier: packageRuntimeSource,
  sourceHead: aosDesignSystemConsumerBridge.designSystemSourceHead,
  implementationKind: runtimeSurface,
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
    "GateReadinessPanel",
    "ReadbackPanel",
    "Text",
    "Heading",
    "KeyValueList",
    "WorkIndex",
    "TableShell",
    "SearchInput",
    "FilterBar",
    "StateView",
    "DetailDrawer",
  ],
  packageBackedReactRuntimeRendering: true,
  docsReadinessPackageRuntimeRendering: true,
  aosWidePackageRuntimeRendering: true,
  productUiAcceptanceReady: false,
  aosWideProductDesignAccepted: false,
  productAcceptanceReady: false,
  finalMvpAcceptanceReady: false,
  releasePublicationReady: false,
  liveDispatchEnabled: false,
  ownerIntentActionEnabled: false,
} as const;

const runtimeScope =
  aosWideProductDesignUiReactRuntime.componentScope.join(",");

export function renderAOSWideProductDesignRuntimeSurface(
  model: AOSWideProductDesignModel,
): string {
  const tree = createElement(AOSWideProductDesignRuntimeSurface, { model });
  const html = renderToStaticMarkup(tree, {
    identifierPrefix: "aos-wide-product-design-",
  });

  return addAOSWideRuntimeAttributes(html, model);
}

function AOSWideProductDesignRuntimeSurface({
  model,
}: {
  model: AOSWideProductDesignModel;
}): ReactNode {
  return createElement(
    Surface,
    {
      className: "aos-shell",
      "data-region": "aos-wide-shell",
      "data-surface": "aos-wide-product-design",
      "data-product-design-status": model.requiredState.aosWideProductDesignAccepted
        ? "accepted"
        : "not_accepted",
      "data-aos-wide-product-design-accepted": String(
        model.requiredState.aosWideProductDesignAccepted,
      ),
      "data-design-system-consumer":
        aosDesignSystemConsumerBridge.adoptionPosture,
      "data-package-backed-react-runtime-rendering": "true",
      "data-package-runtime-component": "Surface",
      "data-package-runtime-component-scope": runtimeScope,
      "data-package-runtime-source": packageRuntimeSource,
      "data-package-runtime-surface": runtimeSurface,
      "data-tcrn-component": "Surface",
    },
    [
      renderSidebar(model),
      createElement(
        "section",
        { className: "aos-main", "aria-labelledby": "aos-wide-title" },
        [
          renderTopbar(model),
          renderHero(model),
          renderTargetPath(model),
          renderModuleGrid(model),
          renderSurfaceIndex(model),
          renderDetailDrawer(model),
          renderOperationalPosture(),
        ],
      ),
    ],
  );
}

function renderSidebar(model: AOSWideProductDesignModel): ReactNode {
  const disabledReason =
    "This workspace opens when the corresponding AOS module is available.";

  return createElement(
    SideNav,
    {
      className: "aos-sidebar tcrn-side-nav",
      label: "AOS-wide target-set navigation",
      "data-region": "sidebar-nav",
      "data-package-runtime-component": "SideNav",
      "data-package-runtime-source": packageRuntimeSource,
      "data-tcrn-component": "SideNav",
    },
    [
      createElement(
        LinkButton,
        {
          className: "brand-lockup",
          href: "#target-path-readback",
          variant: "secondary",
          "data-region": "brand-lockup",
          "data-package-runtime-component": "LinkButton",
          "data-package-runtime-source": packageRuntimeSource,
          "data-tcrn-component": "LinkButton",
        },
        [
          createElement("span", { className: "brand-mark", "aria-hidden": "true" }, "AOS"),
          createElement("span", { className: "brand-copy" }, [
            createElement("strong", {}, "AOS product design"),
            createElement("small", {}, "Product workspace"),
          ]),
        ],
      ),
      createElement(
        NavGroup,
        {
          className: "nav-stack tcrn-nav-group",
          label: "Target modules",
          "data-package-runtime-component": "NavGroup",
          "data-package-runtime-source": packageRuntimeSource,
          "data-tcrn-component": "NavGroup",
        },
        model.surfaces.map((surface, index) =>
          createElement(
            NavItem,
            {
              key: surface.id,
              className: "nav-row",
              href: index === 0 ? `#${surface.id}` : undefined,
              selected: index === 0,
              disabled: index !== 0,
              disabledReason: index === 0 ? undefined : disabledReason,
              "data-nav-surface": index === 0 ? surface.id : undefined,
              "data-package-runtime-component": "NavItem",
              "data-package-runtime-source": packageRuntimeSource,
              "data-tcrn-component": "NavItem",
            },
            surface.title,
          ),
        ),
      ),
      createElement(
        "footer",
        { className: "sidebar-note", "data-region": "local-posture" },
        createElement(
          Text,
          {
            size: "sm",
            "data-package-runtime-component": "Text",
            "data-package-runtime-source": packageRuntimeSource,
            "data-tcrn-component": "Text",
          },
          "Read-only product posture recorded",
        ),
      ),
    ],
  );
}

function renderTopbar(model: AOSWideProductDesignModel): ReactNode {
  const targetPathDisabledReason = "Target path is managed from project setup.";

  return createElement(TopBar, {
    productName: "AOS Product Design",
    moduleName: "Product workspace",
    actions: [
      createElement(
        Field,
        { key: "target", label: "Target path", hint: targetPathDisabledReason },
        createElement(
          Select,
          {
            id: "aos-wide-target-path",
            name: "target-path",
            value: model.targetPathReadback.aosWideTarget,
            disabled: true,
            title: targetPathDisabledReason,
            options: [
              {
                value: model.targetPathReadback.aosWideTarget,
                label: pathLabel(model.targetPathReadback.aosWideTarget),
              },
            ],
            "data-disabled-reason": targetPathDisabledReason,
            "data-package-runtime-component": "Select",
            "data-package-runtime-source": packageRuntimeSource,
            "data-tcrn-component": "Select",
          },
        ),
      ),
      createElement(ReadbackPanel, {
        key: "workspace",
        title: "Workspace",
        children: createElement(KeyValueList, {
          items: [
            { key: "surface", label: "Surface", value: "AOS product design" },
            { key: "mode", label: "Mode", value: "Read only" },
            { key: "status", label: "Status", value: "Design review active" },
          ],
        }),
      }),
      createElement(
        LinkButton,
        {
          key: "cockpit",
          href: "/operations-cockpit.html",
          variant: "secondary",
          "data-package-runtime-component": "LinkButton",
          "data-package-runtime-source": packageRuntimeSource,
          "data-tcrn-component": "LinkButton",
        },
        "Cockpit",
      ),
      createElement(
        LinkButton,
        {
          key: "docs",
          href: "/docs-readiness.html",
          variant: "secondary",
          "data-package-runtime-component": "LinkButton",
          "data-package-runtime-source": packageRuntimeSource,
          "data-tcrn-component": "LinkButton",
        },
        "Docs readiness",
      ),
    ],
  });
}

function renderHero(model: AOSWideProductDesignModel): ReactNode {
  return createElement("section", { className: "hero-panel" }, [
    createElement("div", { className: "title-row" }, [
      createElement(
        Text,
        {
          as: "p",
          className: "eyebrow",
          size: "sm",
          "data-package-runtime-component": "Text",
          "data-package-runtime-source": packageRuntimeSource,
          "data-tcrn-component": "Text",
        },
        "AOS product design",
      ),
      createElement(
        Heading,
        {
          id: "aos-wide-title",
          level: 1,
          "data-package-runtime-component": "Heading",
          "data-package-runtime-source": packageRuntimeSource,
          "data-tcrn-component": "Heading",
        },
        "Product workspace coverage",
      ),
      createElement(
        Text,
        {
          as: "p",
          className: "hero-copy",
          "data-package-runtime-component": "Text",
          "data-package-runtime-source": packageRuntimeSource,
          "data-tcrn-component": "Text",
        },
        "AOS-wide workspaces are organized for review with local data, disabled actions, and clear readiness state.",
      ),
    ]),
    createElement(EvidenceStrip, {
      items: [
        "Registered Design System UI",
        "Actions remain disabled",
        "Review state visible",
      ],
    }),
  ]);
}

function renderTargetPath(model: AOSWideProductDesignModel): ReactNode {
  const pathItems = [
    { index: "1", href: "/operations-cockpit.html", path: model.targetPathReadback.operationsCockpit },
    { index: "2", href: "/docs-search-release-readiness.html", path: model.targetPathReadback.docsSearchRelease },
    { index: "3", href: "/aos-wide-product-design.html", path: model.targetPathReadback.aosWideTarget },
  ];

  return createElement(
    Surface,
    {
      className: "path-grid",
      id: "target-path-readback",
      "data-region": "target-path-readback",
      "data-package-runtime-component": "Surface",
      "data-package-runtime-source": packageRuntimeSource,
      "data-tcrn-component": "Surface",
    },
    pathItems.map((item) =>
      createElement(
        "div",
        { className: "path-step", key: item.path },
        [
          createElement(
            Badge,
            {
              className: "step-index",
              "data-package-runtime-component": "Badge",
              "data-package-runtime-source": packageRuntimeSource,
              "data-tcrn-component": "Badge",
            },
            item.index,
          ),
          createElement(
            LinkButton,
            {
              href: item.href,
              className: "path-link",
              "data-package-runtime-component": "LinkButton",
              "data-package-runtime-source": packageRuntimeSource,
              "data-tcrn-component": "LinkButton",
            },
            pathLabel(item.path),
          ),
        ],
      ),
    ),
  );
}

function renderModuleGrid(model: AOSWideProductDesignModel): ReactNode {
  return createElement(
    "section",
    { className: "module-grid", "aria-label": "AOS-wide target modules" },
    model.surfaces.map((surface, index) => renderModuleCard(surface, index)),
  );
}

function renderModuleCard(surface: SurfaceRow, index: number): ReactNode {
  const items: KeyValueItem[] = surface.terms.slice(0, 3).map((term, i) => ({
    key: `${surface.id}-${i + 1}`,
    label: `Signal ${i + 1}`,
    value: term,
  }));

  return createElement(
    Surface,
    {
      key: surface.id,
      className: "module-card",
      id: surface.id,
      "data-region": surfaceRegionId(surface.id),
      "data-module-id": surface.id,
      "data-module-state": surface.state,
      "data-package-runtime-component": "Surface",
      "data-package-runtime-source": packageRuntimeSource,
      "data-tcrn-component": "Surface",
    },
    [
      createElement("div", { className: "module-card-head" }, [
        createElement(
          Heading,
          {
            level: 2,
            "data-package-runtime-component": "Heading",
            "data-package-runtime-source": packageRuntimeSource,
            "data-tcrn-component": "Heading",
          },
          surface.title,
        ),
        createElement(StatusBadge, {
          state: presentAosCopyState(surface.state),
          className: `state-chip ${surface.state}`,
          "data-package-runtime-component": "StatusBadge",
          "data-package-runtime-source": packageRuntimeSource,
          "data-tcrn-component": "StatusBadge",
        }),
      ]),
      createElement(
        Text,
        {
          as: "p",
          className: "module-label",
          "data-package-runtime-component": "Text",
          "data-package-runtime-source": packageRuntimeSource,
          "data-tcrn-component": "Text",
        },
        surface.surface,
      ),
      createElement(
        Text,
        {
          as: "p",
          className: "module-detail",
          "data-package-runtime-component": "Text",
          "data-package-runtime-source": packageRuntimeSource,
          "data-tcrn-component": "Text",
        },
        surface.detail,
      ),
      createElement(KeyValueList, { items }),
      createElement(
        Button,
        {
          type: "button",
          variant: index === 0 ? "primary" : "secondary",
          "data-select-surface": surface.id,
          "data-package-runtime-component": "Button",
          "data-package-runtime-source": packageRuntimeSource,
          "data-tcrn-component": "Button",
        },
        "Inspect workspace",
      ),
    ],
  );
}

function renderSurfaceIndex(model: AOSWideProductDesignModel): ReactNode {
  const columns: TableColumn[] = [
    { key: "title", label: "Target" },
    { key: "state", label: "State" },
    { key: "owner", label: "Owner" },
    { key: "guardrail", label: "Guardrail" },
    { key: "evidence", label: "Evidence" },
    { key: "action", label: "Action" },
  ];
  const rows: Record<string, ReactNode>[] = model.surfaces.map((surface) => ({
    id: surface.id,
    title: surface.title,
    state: presentAosCopyState(surface.state).label,
    owner: surface.owner,
    guardrail: surface.blocker,
    evidence: surface.evidence,
    action: "Inspect",
  }));

  return createElement(
    "section",
    {
      className: "surface-index",
      "data-region": "surface-index",
      "data-package-runtime-component": "WorkIndex",
      "data-package-runtime-source": packageRuntimeSource,
      "data-tcrn-component": "WorkIndex",
    },
    [
      createElement("div", { className: "surface-index-head" }, [
        createElement(
          Heading,
          {
            level: 2,
            "data-package-runtime-component": "Heading",
            "data-package-runtime-source": packageRuntimeSource,
            "data-tcrn-component": "Heading",
          },
          "Surface index",
        ),
        createElement(
          Field,
          { label: "Search targets" },
          createElement(SearchInput, {
            id: "surface-search",
            name: "surface-search",
            placeholder: "Search AOS-wide workspaces",
            "data-package-runtime-component": "SearchInput",
            "data-package-runtime-source": packageRuntimeSource,
            "data-tcrn-component": "SearchInput",
          }),
        ),
      createElement(FilterBar, {
        label: "Target filters",
        children: [
          createElement(Button, {
            key: "all",
            type: "button",
            "data-filter-state": "all",
          }, "All"),
          createElement(Button, {
            key: "current",
            type: "button",
            "data-filter-state": "current",
          }, "Current"),
          createElement(Button, {
            key: "review",
            type: "button",
            "data-filter-state": "review_required",
          }, "Review required"),
          createElement(Button, {
            key: "blocked",
            type: "button",
            "data-filter-state": "blocked",
          }, "Blocked"),
          createElement(Button, {
            key: "evidence-review",
            type: "button",
            "data-filter-state": "pending_external_proof",
          }, "Evidence review"),
        ],
      }),
      ]),
      createElement(TableShell, {
        label: "AOS-wide workspace rows",
        columns,
        rows,
        mobileLayout: "stacked-cards",
      }),
      createElement(StateView, {
        state: presentAosCopyState("not_configured"),
        title: "No targets match",
        action: createElement(
          Text,
          {
            as: "p",
            "data-package-runtime-component": "Text",
            "data-package-runtime-source": packageRuntimeSource,
            "data-tcrn-component": "Text",
          },
          "Clear the local filter to restore the workspace list.",
        ),
      }),
    ],
  );
}

function renderDetailDrawer(model: AOSWideProductDesignModel): ReactNode {
  const selected = model.surfaces[0];
  if (!selected) {
    throw new Error("missing required AOS-wide target-set detail row");
  }
  const disabledReason =
    "Product actions require approved workspace authority before they can run.";
  const detailItems: KeyValueItem[] = [
    { key: "target-id", label: "Target id", value: createElement("span", { "data-detail-id": true }, selected.id) },
    { key: "surface", label: "Surface", value: createElement("span", { "data-detail-surface": true }, selected.surface) },
    { key: "owner", label: "Owner", value: createElement("span", { "data-detail-owner": true }, selected.owner) },
    { key: "stage", label: "Stage", value: createElement("span", { "data-detail-stage": true }, selected.stage) },
    { key: "blocker", label: "Blocker", value: createElement("span", { "data-detail-blocker": true }, selected.blocker) },
    { key: "evidence", label: "Evidence", value: createElement("span", { "data-detail-evidence": true }, selected.evidence) },
    { key: "action", label: "Action", value: createElement("span", { "data-detail-action": true }, selected.disabledAction) },
    { key: "detail", label: "Detail", value: createElement("span", { "data-detail-copy": true }, selected.detail) },
  ];

  return createElement(
    DetailDrawer,
    {
      open: true,
      title: selected.title,
      "data-package-runtime-component": "DetailDrawer",
      "data-package-runtime-source": packageRuntimeSource,
      "data-tcrn-component": "DetailDrawer",
    },
    [
      createElement("div", { className: "drawer-head" }, [
        createElement(Badge, {
          className: `tag ${selected.state}`,
          "data-detail-state": true,
          "data-package-runtime-component": "Badge",
          "data-package-runtime-source": packageRuntimeSource,
          "data-tcrn-component": "Badge",
        }, presentAosCopyState(selected.state).label),
        createElement(
          Button,
          {
            type: "button",
            disabled: true,
            disabledReason: "Detail drawer close is disabled in this read-only product view.",
            "data-drawer-close": true,
            "data-package-runtime-component": "Button",
            "data-package-runtime-source": packageRuntimeSource,
            "data-tcrn-component": "Button",
          },
          "Close",
        ),
      ]),
      createElement(
        Text,
        {
          as: "p",
          className: "detail-summary",
          "data-detail-summary": true,
          "data-package-runtime-component": "Text",
          "data-package-runtime-source": packageRuntimeSource,
          "data-tcrn-component": "Text",
        },
        selected.detail,
      ),
      createElement(KeyValueList, { items: detailItems }),
      createElement(
        "div",
        { className: "detail-actions" },
        [
          createElement(GateReadinessPanel, {
            state: {
              ...presentAosCopyState("unavailable"),
              label: "Unavailable",
              description: "This action is disabled until the workspace is approved for execution.",
            },
          }),
          createElement(
            Button,
            {
              type: "button",
              disabled: true,
              disabledReason,
              "data-action": "owner-action-locked",
              "data-package-runtime-component": "Button",
              "data-package-runtime-source": packageRuntimeSource,
              "data-tcrn-component": "Button",
            },
            "Request approval",
          ),
          createElement(
            Button,
            {
              type: "button",
              disabled: true,
              disabledReason,
              "data-action": "live-dispatch-unavailable",
              "data-package-runtime-component": "Button",
              "data-package-runtime-source": packageRuntimeSource,
              "data-tcrn-component": "Button",
            },
            "Run live action",
          ),
          createElement(
            Button,
            {
              type: "button",
              disabled: true,
              disabledReason,
              "data-action": "external-proof-required",
              "data-package-runtime-component": "Button",
              "data-package-runtime-source": packageRuntimeSource,
              "data-tcrn-component": "Button",
            },
            "Open evidence review",
          ),
        ],
      ),
      createElement(ReadbackPanel, {
        title: "Review posture",
        children: createElement(KeyValueList, {
          items: [
            {
              key: "product-design",
              label: "Product design",
              value: "Review active",
            },
            { key: "mode", label: "Mode", value: "Read only" },
            { key: "release", label: "Release", value: "Disabled" },
            { key: "operations", label: "Live actions", value: "Disabled" },
          ],
        }),
      }),
    ],
  );
}

function renderOperationalPosture(): ReactNode {
  const entries = [
    ["Workspace", "Read only"],
    ["Release", "Disabled"],
    ["Live actions", "Disabled"],
    ["Approvals", "Required before execution"],
  ] as const;

  return createElement(
    "section",
    { className: "state-grid", "aria-label": "Operational posture" },
    entries.map(([label, value]) =>
      createElement(
        Badge,
        {
          key: label,
          className: "state-pill",
          "data-package-runtime-component": "Badge",
          "data-package-runtime-source": packageRuntimeSource,
          "data-tcrn-component": "Badge",
        },
        [
          createElement("dt", {}, label),
          createElement("dd", {}, String(value)),
        ],
      ),
    ),
  );
}

function addAOSWideRuntimeAttributes(
  html: string,
  model: AOSWideProductDesignModel,
): string {
  let output = html.replace("<section", "<main");
  output = output.replace(/<\/section>$/, "</main>");
  output = output.replace(
    "<main",
    `<main data-product-design-status="${model.context.productDesignStatus}"`,
  );

  output = output.replace(
    '<header class="tcrn-top-bar">',
    '<header class="topbar tcrn-top-bar" data-region="aos-wide-topbar" data-package-runtime-component="TopBar" data-package-runtime-source="@tcrn/ui-react" data-tcrn-component="TopBar">',
  );
  output = output.replace(
    '<label class="tcrn-field">',
    '<label class="project-selector tcrn-field" data-region="project-selector" data-package-runtime-component="Field" data-package-runtime-source="@tcrn/ui-react" data-tcrn-component="Field">',
  );
  output = output.replace(
    '<label class="tcrn-field">',
    '<label class="search-box tcrn-field" data-region="surface-search" data-package-runtime-component="Field" data-package-runtime-source="@tcrn/ui-react" data-tcrn-component="Field">',
  );
  output = output.replace(
    '<section class="tcrn-surface tcrn-readback-panel">',
    '<section class="checkpoint-card tcrn-surface tcrn-readback-panel" data-region="workspace-status" data-package-runtime-component="ReadbackPanel" data-package-runtime-source="@tcrn/ui-react" data-tcrn-component="ReadbackPanel">',
  );
  output = output.replace(
    '<div class="tcrn-evidence-strip">',
    '<div class="claim-strip tcrn-evidence-strip" data-region="claim-strip" data-package-runtime-component="EvidenceStrip" data-package-runtime-source="@tcrn/ui-react" data-tcrn-component="EvidenceStrip">',
  );
  output = output.replace(
    '<span class="tcrn-search-input"',
    '<span class="tcrn-search-input" data-package-runtime-subcomponent="SearchInput.control"',
  );
  output = output.replace(
    /<section class="tcrn-filter-bar"/g,
    '<section class="tcrn-filter-bar" data-package-runtime-component="FilterBar" data-package-runtime-source="@tcrn/ui-react" data-tcrn-component="FilterBar"',
  );
  output = output.replace(
    '<div class="tcrn-table-shell" role="table"',
    '<div class="surface-table tcrn-table-shell" role="table" data-package-runtime-component="TableShell" data-package-runtime-source="@tcrn/ui-react" data-tcrn-component="TableShell"',
  );
  output = output.replace(
    /<section class="tcrn-state-view([^"]*)"/,
    '<section class="empty-state tcrn-state-view$1" data-empty-state="true" hidden data-package-runtime-component="StateView" data-package-runtime-source="@tcrn/ui-react" data-tcrn-component="StateView"',
  );
  output = output.replace(
    '<aside class="tcrn-detail-drawer"',
    '<aside class="detail-drawer tcrn-detail-drawer" data-region="detail-panel" data-package-runtime-component="DetailDrawer" data-package-runtime-source="@tcrn/ui-react" data-tcrn-component="DetailDrawer"',
  );
  output = output.replace(
    /<h3 id="([^"]+)" class="tcrn-heading tcrn-heading--3">/,
    '<h3 id="$1" class="tcrn-heading tcrn-heading--3" data-detail-title="true">',
  );
  output = output.replace(
    /<section\b(?=[^>]*class="[^"]*tcrn-gate-readiness-panel[^"]*")/,
    '<section data-region="disabled-action-gate" data-package-runtime-component="GateReadinessPanel" data-package-runtime-source="@tcrn/ui-react" data-tcrn-component="GateReadinessPanel"',
  );
  output = output.replace(
    '<section class="tcrn-surface tcrn-readback-panel">',
    '<section class="evidence-panel tcrn-surface tcrn-readback-panel" id="evidence-readiness-panel" data-region="evidence-readiness-panel" data-package-runtime-component="ReadbackPanel" data-package-runtime-source="@tcrn/ui-react" data-tcrn-component="ReadbackPanel">',
  );

  let tableRowIndex = 0;
  output = output.replace(
    /<div role="row" class="tcrn-table-shell__row">([\s\S]*?)<\/div>/g,
    (_match, cells: string) => {
      const surface = model.surfaces[tableRowIndex++];
      if (!surface) {
        return `<div role="row" class="tcrn-table-shell__row">${cells}</div>`;
      }
      const terms = [
        surface.title,
        surface.surface,
        surface.owner,
        surface.state,
        surface.stage,
        surface.blocker,
        surface.detail,
        surface.disabledAction,
        ...surface.terms,
      ]
        .join(" ")
        .toLowerCase();
      return `<button type="button" role="row" class="surface-row tcrn-table-shell__row${tableRowIndex === 1 ? " active" : ""}" data-surface-row="${escapeAttribute(surface.id)}" data-row-id="${escapeAttribute(surface.id)}" data-state="${escapeAttribute(surface.state)}" data-title="${escapeAttribute(surface.title)}" data-surface="${escapeAttribute(surface.surface)}" data-owner="${escapeAttribute(surface.owner)}" data-stage="${escapeAttribute(surface.stage)}" data-blocker="${escapeAttribute(surface.blocker)}" data-evidence="${escapeAttribute(surface.evidence)}" data-action="${escapeAttribute(surface.disabledAction)}" data-detail="${escapeAttribute(surface.detail)}" data-search="${escapeAttribute(terms)}" data-package-runtime-component="TableShell" data-package-runtime-source="${packageRuntimeSource}" data-package-runtime-surface="${runtimeSurface}" data-tcrn-component="TableShell">${cells}</button>`;
    },
  );

  output = output.replace(
    /<dl class="tcrn-key-value-list">/g,
    '<dl class="tcrn-key-value-list" data-package-runtime-component="KeyValueList" data-package-runtime-source="@tcrn/ui-react" data-tcrn-component="KeyValueList">',
  );

  return output;
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function pathLabel(path: string): string {
  if (path.includes("operations-cockpit")) return "Operations Cockpit";
  if (path.includes("docs-search-release-readiness")) return "Docs Readiness";
  if (path.includes("aos-wide-product-design")) return "Product Design";
  return path;
}

function surfaceRegionId(surfaceId: string): string {
  const regionIds: Record<string, string> = {
    "admin-access-audit": "admin-access-audit-shell",
    "dependency-license": "dependency-governance-console",
    "gateway-adapter": "gateway-adapter-health",
    "gates-owner-intent": "gate-owner-intent",
    "knowledge-release": "knowledge-release-modules",
    "project-hierarchy": "project-dashboard-hierarchy",
    "resource-library": "resource-library-traceability",
    "ticket-drillthrough": "initiative-ticket-drillthrough",
  };
  return regionIds[surfaceId] ?? surfaceId;
}
