import React from "react";
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
  WorkIndex
} from "@tcrn/ui-react";
import type { RebuildBaselineModel, RebuildCockpitStartModel, RebuildDocsStartModel } from "./rebuild-baseline-data.js";

const createElement = React.createElement as unknown as (type: unknown, props?: Record<string, unknown> | null, ...children: unknown[]) => React.ReactElement;

const packageAttrs = (component: string, extra: Record<string, unknown> = {}) => ({
  "data-tcrn-component": component,
  "data-package-runtime-component": component,
  "data-design-system-consumer": "tcrn-aos",
  ...extra
});

function renderKeyValueList(items: Array<{ key: string; label: string; value: React.ReactNode }>) {
  return createElement("div", packageAttrs("KeyValueList"), createElement(KeyValueList, { items }));
}

function renderSidebar(model: RebuildBaselineModel) {
  const referenceNavItems = [
    { label: "Cockpit standard", iconName: "home" },
    { label: "Docs standard", iconName: "book-open" },
    { label: "Target-set standard", iconName: "package" }
  ];
  const retiredAliasNavItems = [
    "Operations Cockpit",
    "Docs Readiness",
    "Product Design set",
    "Project Workspace",
    "Initiative Detail",
    "AI Employee",
    "Gate Queue",
    "Conference",
    "Dependency Console",
    "Resource Library",
    "Knowledge Modules",
    "Admin / Access"
  ];

  return createElement(
    SideNav,
    {
      ...packageAttrs("SideNav", {
        className: "rebuild-baseline__nav",
        "data-region": "rebuild-nav"
      }),
      label: "AOS rebuild navigation"
    },
    createElement(
      LinkButton,
      {
        ...packageAttrs("LinkButton", {
          href: "/",
          className: "rebuild-baseline__brand",
          "data-region": "brand-lockup",
          "aria-label": "TCRN AOS Frontend Replacement Workspace"
        }),
        variant: "quiet"
      },
      createElement("span", { className: "rebuild-baseline__brand-mark", "aria-hidden": "true" }, "AOS"),
      createElement(
        "span",
        { className: "rebuild-baseline__brand-text" },
        createElement(Text, { ...packageAttrs("Text", { className: "rebuild-baseline__brand-kicker" }) }, "TCRN"),
        createElement(Text, { ...packageAttrs("Text", { className: "rebuild-baseline__brand-name" }) }, "Rebuild Workspace")
      )
    ),
    createElement(
      NavGroup,
      { ...packageAttrs("NavGroup", { className: "rebuild-baseline__nav-group" }), label: "Certified Storybook references" },
      referenceNavItems.map((item) =>
        createElement(
          NavItem,
          {
            ...packageAttrs("NavItem", {
              key: item.label,
              iconName: item.iconName,
              className: "rebuild-baseline__nav-item"
            }),
            disabled: true,
            disabledReason: "These Design System standards are reference material while the replacement workspace is established."
          },
          item.label
        )
      )
    ),
    createElement(
      NavGroup,
      { ...packageAttrs("NavGroup", { className: "rebuild-baseline__nav-group" }), label: "Retired served aliases" },
      retiredAliasNavItems.map((label) =>
        createElement(
          NavItem,
          {
            ...packageAttrs("NavItem", {
              key: label,
              iconName: "package",
              selected: model.currentAliasLabel === label,
              className: "rebuild-baseline__nav-item"
            }),
            disabled: true,
            disabledReason: "This served alias now resolves to the replacement workspace while the previous frontend is retired."
          },
          label
        )
      )
    ),
    createElement(
      Text,
      {
        ...packageAttrs("Text", {
          className: "rebuild-baseline__nav-note",
          "data-region": "rebuild-local-mode"
        })
      },
      "Storybook-first replacement workspace"
    )
  );
}

function renderTopbar(model: RebuildBaselineModel) {
  return createElement(
    "header",
    packageAttrs("TopBar", {
      className: "rebuild-baseline__topbar",
      "data-region": "rebuild-topbar"
    }),
    createElement(TopBar, {
      productName: "TCRN AOS",
      moduleName: "Replacement Workspace",
      actions: createElement(
        "div",
        { className: "rebuild-baseline__actions" },
        createElement(StatusBadge, {
          ...packageAttrs("StatusBadge"),
          state: { state: "ready" }
        }),
        createElement(Badge, { ...packageAttrs("Badge"), tone: "neutral" }, "Local preview"),
        createElement(Button, {
          ...packageAttrs("Button"),
          disabled: true,
          disabledReason: "Publishing is not enabled while the replacement workspace is rebuilt from Design System standards."
        }, "Publish")
      )
    }),
    createElement(
      "div",
      { className: "rebuild-baseline__topbar-copy" },
      createElement(Heading, { ...packageAttrs("Heading"), level: 1 }, "AOS Frontend Replacement Workspace"),
      createElement(Text, { ...packageAttrs("Text", { className: "tcrn-text--muted" }) }, `Requested alias retired to: ${model.currentAliasLabel}`)
    )
  );
}

function renderSummary(model: RebuildBaselineModel) {
  return createElement(
    "section",
    { className: "rebuild-baseline__summary", "data-region": "rebuild-summary" },
    createElement(
      Surface,
      { ...packageAttrs("Surface", { className: "rebuild-baseline__hero" }) },
      createElement(Badge, { ...packageAttrs("Badge"), tone: "warning" }, "Transitional frontend retired"),
      createElement(Heading, { ...packageAttrs("Heading"), level: 2 }, "Current served frontend has been retired"),
      createElement(Text, { ...packageAttrs("Text", { className: "tcrn-text--muted" }) }, "Every previously reopened surface now resolves to one Storybook-first replacement workspace. The earlier multi-surface frontend remains disposable source material while the fresh rebuild restarts from certified standards."),
      createElement(
        "div",
        packageAttrs("EvidenceStrip", { className: "rebuild-baseline__evidence-strip" }),
        createElement(EvidenceStrip, {
          items: [
            `Standards: ${model.dsStandardIds.length}`,
            "Retired aliases: 9",
            `Requested alias: ${model.currentAliasLabel}`,
            "Live actions: Not enabled",
            "Backend service retained"
          ]
        })
      )
    ),
    createElement(
      "div",
      packageAttrs("ReadbackPanel", { className: "rebuild-baseline__status" }),
      createElement(ReadbackPanel, {
        title: "Replacement status"
      },
      renderKeyValueList([
        { key: "starting-module", label: "Starting surface", value: "Fresh replacement workspace shell" },
        { key: "surface-state", label: "Served frontend", value: "Retired to one workspace" },
        { key: "storyboard-source", label: "Design source", value: "Certified Storybook standards" },
        { key: "acceptance", label: "Acceptance", value: "Not enabled" }
      ]))
    )
  );
}

function renderCockpitStart(model: RebuildCockpitStartModel) {
  return createElement(
    "section",
    { className: "rebuild-baseline__cockpit-start", "data-region": "cockpit-start" },
    createElement(
      "div",
      { className: "rebuild-baseline__cockpit-grid" },
      createElement(
        Surface,
        { ...packageAttrs("Surface", { className: "rebuild-baseline__cockpit-surface" }) },
        createElement(Badge, { ...packageAttrs("Badge"), tone: "positive" }, "First fresh surface"),
        createElement(Heading, { ...packageAttrs("Heading"), level: 2 }, model.title),
        createElement(Text, { ...packageAttrs("Text", { className: "tcrn-text--muted" }) }, model.summary),
        createElement(
          "div",
          packageAttrs("EvidenceStrip", { className: "rebuild-baseline__evidence-strip" }),
          createElement(EvidenceStrip, { items: [...model.evidence] })
        ),
        createElement(
          "div",
          packageAttrs("WorkIndex", { "data-region": "cockpit-work-index" }),
          createElement(WorkIndex, {
            rows: model.workItems.map((item) => ({
              id: item.id,
              title: item.title,
              state: { state: item.state },
              owner: item.owner
            })),
            label: "Operations cockpit starting work"
          })
        )
      ),
      createElement(
        "div",
        { className: "rebuild-baseline__cockpit-side" },
        createElement(
          "div",
          packageAttrs("ReadbackPanel"),
          createElement(ReadbackPanel, { title: "Cockpit standard reference" },
            renderKeyValueList([
              { key: "standard", label: "Standard id", value: model.standardId },
              { key: "storybook", label: "Storybook id", value: model.storybookId },
              { key: "posture", label: "Workspace posture", value: "Local preview" }
            ])
          )
        ),
        createElement(
          "div",
          packageAttrs("DetailDrawer", { "data-region": "cockpit-detail" }),
          createElement(DetailDrawer, { title: model.detailTitle, open: true },
            renderKeyValueList(model.detailItems.map((item) => ({
              key: item.key,
              label: item.label,
              value: item.value
            }))),
            createElement(
              "div",
              { className: "rebuild-baseline__action-list" },
              model.actions.map((action) =>
                createElement(Button, {
                  ...packageAttrs("Button", { key: action.label }),
                  disabled: true,
                  disabledReason: action.reason
                }, action.label)
              )
            )
          )
        ),
        createElement(
          "div",
          packageAttrs("GateReadinessPanel"),
          createElement(GateReadinessPanel, {
            state: {
              state: "blocked",
              label: "Unavailable",
              description: "Live execution remains unavailable while the fresh cockpit surface is rebuilt inside the replacement workspace."
            }
          })
        ),
        createElement(
          "div",
          packageAttrs("ReadbackPanel"),
          createElement(ReadbackPanel, { title: "Cockpit posture" },
            renderKeyValueList(model.postureItems.map((item) => ({
              key: item.key,
              label: item.label,
              value: item.value
            })))
          )
        )
      )
    )
  );
}

function renderDocsStart(model: RebuildDocsStartModel) {
  return createElement(
    "section",
    { className: "rebuild-baseline__docs-start", "data-region": "docs-start" },
    createElement(
      "div",
      { className: "rebuild-baseline__cockpit-grid" },
      createElement(
        Surface,
        { ...packageAttrs("Surface", { className: "rebuild-baseline__cockpit-surface" }) },
        createElement(Badge, { ...packageAttrs("Badge"), tone: "positive" }, "Next fresh surface"),
        createElement(Heading, { ...packageAttrs("Heading"), level: 2 }, model.title),
        createElement(Text, { ...packageAttrs("Text", { className: "tcrn-text--muted" }) }, model.summary),
        createElement(
          "div",
          packageAttrs("EvidenceStrip", { className: "rebuild-baseline__evidence-strip" }),
          createElement(EvidenceStrip, { items: [...model.evidence] })
        ),
        createElement(
          "div",
          packageAttrs("FilterBar", { "data-region": "docs-filter" }),
          createElement(FilterBar, { label: "Docs readiness filters" },
            createElement(Field, { label: "Search" },
              createElement(SearchInput, { placeholder: model.searchPlaceholder })
            ),
            createElement(Field, { label: "State" },
              createElement(Select, {
                defaultValue: model.stateOptions[0]?.value,
                options: [...model.stateOptions]
              })
            )
          )
        ),
        createElement(
          "div",
          packageAttrs("TableShell"),
          createElement(TableShell, {
            label: "Docs inspection rows",
            columns: [
              { key: "path", label: "Repo path" },
              { key: "state", label: "State" },
              { key: "linkage", label: "Linkage" }
            ],
            rows: model.rows.map((row) => ({
              path: row.path,
              state: createElement(StatusBadge, {
                ...packageAttrs("StatusBadge"),
                state: { state: row.state }
              }),
              linkage: row.linkage
            })),
            emptyState: createElement(StateView, {
              state: { state: "not_configured" },
              title: "No docs match"
            })
          })
        )
      ),
      createElement(
        "div",
        { className: "rebuild-baseline__cockpit-side" },
        createElement(
          "div",
          packageAttrs("ReadbackPanel"),
          createElement(ReadbackPanel, { title: "Docs readiness standard reference" },
            renderKeyValueList([
              { key: "standard", label: "Standard id", value: model.standardId },
              { key: "storybook", label: "Storybook id", value: model.storybookId },
              { key: "posture", label: "Workspace posture", value: "Reference-only inspection" }
            ])
          )
        ),
        createElement(
          "div",
          packageAttrs("DetailDrawer", { "data-region": "docs-detail" }),
          createElement(DetailDrawer, { title: model.detailTitle, open: true },
            renderKeyValueList(model.detailItems.map((item) => ({
              key: item.key,
              label: item.label,
              value: item.value
            }))),
            createElement(
              "div",
              { className: "rebuild-baseline__action-list" },
              model.actions.map((action) =>
                createElement(Button, {
                  ...packageAttrs("Button", { key: action.label }),
                  disabled: true,
                  disabledReason: action.reason
                }, action.label)
              )
            )
          )
        ),
        createElement(
          "div",
          packageAttrs("GateReadinessPanel"),
          createElement(GateReadinessPanel, {
            state: {
              state: "blocked",
              label: "Unavailable",
              description: "External publication stays unavailable while docs readiness remains inside the fresh replacement workspace."
            }
          })
        )
      )
    )
  );
}

function renderChecklist(model: RebuildBaselineModel) {
  return createElement(
    "section",
    { className: "rebuild-baseline__checklist", "data-region": "rebuild-checklist" },
    createElement(
      Surface,
      { ...packageAttrs("Surface") },
      createElement(Heading, { ...packageAttrs("Heading"), level: 2 }, "Retired frontend inventory"),
      createElement(
        "div",
        packageAttrs("TableShell"),
        createElement(TableShell, {
          label: "AOS rebuild checklist",
          columns: [
            { key: "label", label: "Module" },
            { key: "status", label: "Status" },
            { key: "source", label: "Source" },
            { key: "note", label: "Note" }
          ],
          rows: model.checklist.map((row) => ({
            label: row.label,
            status: row.status === "retired"
              ? createElement(Badge, { ...packageAttrs("Badge"), tone: "neutral" }, "Retired")
              : createElement(Badge, { ...packageAttrs("Badge"), tone: "warning" }, "Queued"),
            source: row.source,
            note: row.note
          }))
        })
      )
    )
  );
}

function renderBoundaries(model: RebuildBaselineModel) {
  return createElement(
    "section",
    { className: "rebuild-baseline__boundaries", "data-region": "rebuild-boundaries" },
    createElement(
      Surface,
      { ...packageAttrs("Surface") },
      createElement(Heading, { ...packageAttrs("Heading"), level: 2 }, "Retired served scope"),
      renderKeyValueList(model.replacedFrontendScope.map((label, index) => ({
          key: `replaced-${index}`,
          label: `Surface ${index + 1}`,
          value: label
        })))
    ),
    createElement(
      "div",
      packageAttrs("ReadbackPanel"),
      createElement(ReadbackPanel, { title: "Surviving product scope" },
        renderKeyValueList(model.survivingNonFrontendScope.map((label, index) => ({
            key: `surviving-${index}`,
            label: `Boundary ${index + 1}`,
            value: label
          })))
      )
    )
  );
}

function renderActions() {
  return createElement(
    "section",
    { className: "rebuild-baseline__action-lane", "data-region": "rebuild-actions", "aria-label": "Unavailable rebuild actions" },
    createElement(Heading, { ...packageAttrs("Heading"), level: 2 }, "Unavailable actions"),
    createElement(
      "div",
      { className: "rebuild-baseline__action-list" },
      [
        ["Open live workspace", "Live workspace entry is not enabled during the rebuild reset."],
        ["Start owner action", "Owner actions stay disabled while the replacement workspace is rebuilt from Design System standards."],
        ["Publish module", "Publishing is not enabled while the replacement workspace is rebuilt from Design System standards."]
      ].map(([label, reason]) =>
        createElement(Button, {
          ...packageAttrs("Button", { key: String(label) }),
          disabled: true,
          disabledReason: String(reason)
        }, label)
      )
    )
  );
}

export function renderRebuildBaselineRuntimeSurface(model: RebuildBaselineModel): string {
  return renderToStaticMarkup(
    createElement(
      "main",
      {
        className: "rebuild-baseline",
        "data-surface": "aos-rebuild-workspace",
        "data-design-system-consumer": "tcrn-aos",
        "data-ds-standard-ids": model.dsStandardIds.join(" "),
        "data-ds-storybook-ids": model.storybookIds.join(" "),
        "data-product-acceptance": "false",
        "data-final-mvp-acceptance": "false",
        "data-release-publication": "false",
        "data-owner-intent-execution": "false",
        "data-live-dispatch": "false",
        "data-parent-goal-completion": "false"
      },
      renderSidebar(model),
      createElement(
        "div",
        { className: "rebuild-baseline__content", "data-region": "rebuild-shell" },
        renderTopbar(model),
        renderSummary(model),
        renderCockpitStart(model.cockpitStart),
        renderDocsStart(model.docsStart),
        renderChecklist(model),
        renderBoundaries(model),
        renderActions()
      )
    )
  );
}
