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
import type {
  RebuildGitHubReleaseLinkageModel,
  RebuildAdminAccessModel,
  RebuildResourceLibraryModel,
  RebuildKnowledgeModulesModel,
  RebuildGatewayAdapterModel,
  RebuildDependencyConsoleModel,
  RebuildConferenceModel,
  RebuildGateQueueModel,
  RebuildBaselineModel,
  RebuildAiEmployeeModel,
  RebuildCockpitStartModel,
  RebuildDocsStartModel,
  RebuildInitiativeDetailModel,
  RebuildProjectWorkspaceModel,
  RebuildTargetSetModel
} from "./rebuild-baseline-data.js";

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
  const rebuiltModuleNavItems = [
    { label: "Operations Cockpit", iconName: "home", anchor: "cockpit-start" },
    { label: "Docs Readiness", iconName: "book-open", anchor: "docs-start" },
    { label: "Product Design set", iconName: "package", anchor: "target-set-start", selectedLabels: ["Product Design target set", "Product Design set"] },
    { label: "Project Workspace", iconName: "package", anchor: "project-workspace-start" },
    { label: "Initiative Detail", iconName: "package", anchor: "initiative-detail-start" },
    { label: "AI Employee", iconName: "package", anchor: "ai-employee-start" },
    { label: "Gate Queue", iconName: "package", anchor: "gate-queue-start" },
    { label: "Conference", iconName: "package", anchor: "conference-start" },
    { label: "Gateway / Adapter", iconName: "package", anchor: "gateway-adapter-start" },
    { label: "Dependency Console", iconName: "package", anchor: "dependency-console-start" },
    { label: "Resource Library", iconName: "package", anchor: "resource-library-start" },
    { label: "Knowledge Modules", iconName: "package", anchor: "knowledge-modules-start" },
    { label: "Admin / Access", iconName: "package", anchor: "admin-access-start" },
    { label: "GitHub release linkage", iconName: "package", anchor: "github-release-linkage-start" }
  ];
  const legacyAliasNavItems = [
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
  const currentPathNavItems = model.currentEntryFocus
    ? [
        { label: model.currentEntryFocus.label, anchor: model.currentEntryFocus.anchor, selected: true },
        ...model.currentEntryFocus.relatedEntries.map((entry) => ({
          label: entry.label,
          anchor: entry.anchor,
          selected: false
        }))
      ]
    : [];

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
          "aria-label": "TCRN AOS Rebuild Workspace"
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
      { ...packageAttrs("NavGroup", { className: "rebuild-baseline__nav-group" }), label: "Current path" },
      currentPathNavItems.map((item) =>
        createElement(
          NavItem,
          {
            ...packageAttrs("NavItem", {
              key: item.anchor,
              iconName: "package",
              selected: item.selected,
              className: "rebuild-baseline__nav-item"
            }),
            href: `#${item.anchor}`
          },
          item.label
        )
      )
    ),
    createElement(
      NavGroup,
      { ...packageAttrs("NavGroup", { className: "rebuild-baseline__nav-group" }), label: "Rebuilt modules" },
      rebuiltModuleNavItems.map((item) =>
        createElement(
          NavItem,
          {
            ...packageAttrs("NavItem", {
              key: item.label,
              iconName: item.iconName,
              selected: "selectedLabels" in item
                ? item.selectedLabels.includes(model.currentAliasLabel)
                : model.currentAliasLabel === item.label,
              className: "rebuild-baseline__nav-item"
            }),
            href: `#${item.anchor}`
          },
          item.label
        )
      )
    ),
    createElement(
      NavGroup,
      { ...packageAttrs("NavGroup", { className: "rebuild-baseline__nav-group" }), label: "Legacy entry aliases" },
      legacyAliasNavItems.map((label) =>
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
            disabledReason: "This entry now opens the rebuilt workspace while the former standalone page stays retired."
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
      "Shared rebuilt workspace"
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
      moduleName: model.currentEntryFocus?.label ?? "Rebuild Workspace",
      actions: createElement(
        "div",
        { className: "rebuild-baseline__actions" },
        createElement(StatusBadge, {
          ...packageAttrs("StatusBadge"),
          state: { state: "local_only", label: "Current" }
        }),
        createElement(Badge, { ...packageAttrs("Badge"), tone: "neutral" }, "Local preview"),
        model.currentEntryFocus
          ? createElement(Badge, { ...packageAttrs("Badge"), tone: "neutral" }, model.currentEntryFocus.entryMode)
          : null,
        createElement(Button, {
          ...packageAttrs("Button"),
          disabled: true,
          disabledReason: "Publishing remains unavailable while the rebuilt workspace stays in local preview."
        }, "Publish")
      )
    }),
    createElement(
      "div",
      { className: "rebuild-baseline__topbar-copy" },
      createElement(Heading, { ...packageAttrs("Heading"), level: 1 }, "AOS Rebuild Workspace"),
      createElement(
        Text,
        { ...packageAttrs("Text", { className: "tcrn-text--muted" }) },
        model.currentEntryFocus
          ? `Shared rebuilt workspace opened through ${model.currentEntryFocus.label}.`
          : `Shared rebuilt workspace for ${model.currentAliasLabel}.`
      )
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
      createElement(Badge, { ...packageAttrs("Badge"), tone: "positive" }, model.currentEntryFocus ? "Current entry" : "Rebuilt workspace"),
      model.currentEntryFocus
        ? createElement(Badge, { ...packageAttrs("Badge"), tone: "neutral" }, model.currentEntryFocus.entryMode)
        : null,
      createElement(
        Heading,
        { ...packageAttrs("Heading"), level: 2 },
        model.currentEntryFocus ? `${model.currentEntryFocus.label} is foregrounded in the rebuilt workspace` : "AOS rebuilt workspace is active"
      ),
      createElement(
        Text,
        { ...packageAttrs("Text", { className: "tcrn-text--muted" }) },
        model.currentEntryFocus
          ? model.currentEntryFocus.summary
          : "These paths now open the shared rebuilt workspace while standalone surfaces remain retired."
      ),
      createElement(
        "div",
        packageAttrs("EvidenceStrip", { className: "rebuild-baseline__evidence-strip" }),
        createElement(EvidenceStrip, {
          items: [
            `Standards: ${model.dsStandardIds.length}`,
            "Single rebuilt shell",
            `Current entry: ${model.currentEntryFocus?.label ?? model.currentAliasLabel}`,
            `Shared modules: ${model.checklist.length}`,
            "Served UI: Local preview",
            "Backend service retained"
          ]
        })
      )
    ),
    createElement(
      "div",
      { className: "rebuild-baseline__status-stack" },
      createElement(
        "div",
        packageAttrs("ReadbackPanel", { className: "rebuild-baseline__status" }),
        createElement(ReadbackPanel, {
          title: "Workspace status"
        },
        renderKeyValueList([
          { key: "starting-module", label: "Shell state", value: "Rebuilt workspace active" },
          { key: "surface-state", label: "Served frontend", value: "Shared shell in local preview" },
          { key: "storyboard-source", label: "Design source", value: "Certified Storybook standards" },
          { key: "acceptance", label: "Acceptance", value: "Not enabled" }
        ]))
      ),
      model.currentEntryFocus
        ? createElement(
            "div",
            packageAttrs("ReadbackPanel", {
              className: "rebuild-baseline__status",
              "data-region": "current-entry-panel",
              "data-current-entry": model.currentEntryFocus.checklistId
            }),
            createElement(ReadbackPanel, { title: "Current module entry" },
              createElement(Text, { ...packageAttrs("Text", { className: "tcrn-text--muted" }) }, model.currentEntryFocus.summary),
              renderKeyValueList([
                { key: "entry-target", label: "Entry target", value: model.currentEntryFocus.label },
                { key: "entry-mode", label: "Entry mode", value: model.currentEntryFocus.entryMode },
                { key: "entry-anchor", label: "Focus anchor", value: `#${model.currentEntryFocus.anchor}` }
              ]),
              model.currentEntryFocus.relatedEntries.length > 0
                ? createElement(
                    "div",
                    packageAttrs("ReadbackPanel", { "data-region": "current-entry-related" }),
                    createElement(ReadbackPanel, { title: "Related rebuilt modules" },
                      createElement(
                        "div",
                        { className: "rebuild-baseline__entry-link" },
                        model.currentEntryFocus.relatedEntries.map((entry) =>
                          createElement(
                            LinkButton,
                            {
                              ...packageAttrs("LinkButton", {
                                key: entry.anchor,
                                href: `#${entry.anchor}`,
                                className: "rebuild-baseline__entry-button"
                              }),
                              variant: "quiet"
                            },
                            `Go to ${entry.label}`
                          )
                        )
                      )
                    )
                  )
                : null,
              createElement(
                "div",
                { className: "rebuild-baseline__entry-link" },
                createElement(
                  LinkButton,
                  {
                    ...packageAttrs("LinkButton", {
                      href: `#${model.currentEntryFocus.anchor}`,
                      className: "rebuild-baseline__entry-button"
                    }),
                    variant: "quiet"
                  },
                  `Jump to ${model.currentEntryFocus.label}`
                )
              )
            )
          )
        : null
    )
  );
}

const futureFreshSectionRenderers = [
  renderTargetSetStart,
  renderProjectWorkspaceStart,
  renderInitiativeDetailStart,
  renderAiEmployeeStart,
  renderGateQueueStart,
  renderConferenceStart,
  renderGatewayAdapterStart,
  renderDependencyConsoleStart,
  renderResourceLibraryStart,
  renderKnowledgeModulesStart,
  renderAdminAccessStart,
  renderGitHubReleaseLinkageStart
];
void futureFreshSectionRenderers;

function renderCockpitStart(model: RebuildCockpitStartModel) {
  return createElement(
    "section",
    { id: "cockpit-start", className: "rebuild-baseline__cockpit-start", "data-region": "cockpit-start" },
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
              state: item.state === "blocked"
                ? { state: "blocked" }
                : { state: "local_only", label: "Current state" },
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
    { id: "docs-start", className: "rebuild-baseline__docs-start", "data-region": "docs-start" },
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
                state: row.state === "blocked"
                  ? { state: "blocked" }
                  : { state: "local_only", label: "Current state" }
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

function renderTargetSetStart(model: RebuildTargetSetModel) {
  return createElement(
    "section",
    { id: "target-set-start", className: "rebuild-baseline__target-set-start", "data-region": "target-set-start" },
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
          { className: "rebuild-baseline__module-grid", "data-region": "target-set-modules" },
          model.cards.map((card) =>
            createElement(
              Surface,
              { ...packageAttrs("Surface", { key: card.id }) },
              createElement(Heading, { ...packageAttrs("Heading"), level: 3 }, card.title),
              createElement(Text, { ...packageAttrs("Text", { className: "tcrn-text--muted" }) }, card.detail),
              createElement(StatusBadge, {
                ...packageAttrs("StatusBadge"),
                state: card.state === "blocked"
                  ? { state: "blocked" }
                  : { state: "local_only", label: "Current state" }
              })
            )
          )
        ),
        createElement(
          "div",
          packageAttrs("WorkIndex"),
          createElement(WorkIndex, {
            rows: model.indexRows.map((row) => ({
              id: row.id,
              title: row.title,
              state: row.state === "blocked"
                ? { state: "blocked" }
                : { state: "local_only", label: "Current state" },
              owner: row.owner
            })),
            label: "AOS-wide surface index"
          })
        )
      ),
      createElement(
        "div",
        { className: "rebuild-baseline__cockpit-side" },
        createElement(
          "div",
          packageAttrs("ReadbackPanel"),
          createElement(ReadbackPanel, { title: "Target-set standard reference" },
            renderKeyValueList([
              { key: "standard", label: "Standard id", value: model.standardId },
              { key: "storybook", label: "Storybook id", value: model.storybookId },
              { key: "posture", label: "Workspace posture", value: "Presentation-only inspection" }
            ])
          )
        ),
        createElement(
          "div",
          packageAttrs("DetailDrawer", { "data-region": "target-set-detail" }),
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
              description: "Execution stays unavailable while the target-set surface remains inside the shared replacement workspace."
            }
          })
        )
      )
    )
  );
}

function renderProjectWorkspaceStart(model: RebuildProjectWorkspaceModel) {
  return createElement(
    "section",
    { id: "project-workspace-start", className: "rebuild-baseline__project-workspace-start", "data-region": "project-workspace-start" },
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
          { className: "rebuild-baseline__hierarchy-grid", "data-region": "project-workspace-hierarchy" },
          model.hierarchy.map((item) =>
            createElement(
              Surface,
              { ...packageAttrs("Surface", { key: item.key }) },
              createElement(Heading, { ...packageAttrs("Heading"), level: 3 }, item.label),
              createElement(Text, { ...packageAttrs("Text", { className: "rebuild-baseline__strong-text" }) }, item.value)
            )
          )
        ),
        createElement(
          "div",
          packageAttrs("WorkIndex"),
          createElement(WorkIndex, {
            rows: model.stories.map((story) => ({
              id: story.id,
              title: story.title,
              state: story.state === "blocked"
                ? { state: "blocked" }
                : { state: "local_only", label: "Current state" },
              owner: story.owner
            })),
            label: "Project workspace current work"
          })
        )
      ),
      createElement(
        "div",
        { className: "rebuild-baseline__cockpit-side" },
        createElement(
          "div",
          packageAttrs("ReadbackPanel"),
          createElement(ReadbackPanel, { title: "Project workspace standards" },
            renderKeyValueList([
              { key: "standard-1", label: "Standard id 1", value: model.standardIds[0] },
              { key: "standard-2", label: "Standard id 2", value: model.standardIds[1] },
              { key: "storybook-1", label: "Storybook id 1", value: model.storybookIds[0] },
              { key: "storybook-2", label: "Storybook id 2", value: model.storybookIds[1] }
            ])
          )
        ),
        createElement(
          "div",
          packageAttrs("DetailDrawer", { "data-region": "project-workspace-detail" }),
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
              description: "Owner actions stay unavailable while the project workspace surface remains inside the shared replacement shell."
            }
          })
        )
      )
    )
  );
}

function renderInitiativeDetailStart(model: RebuildInitiativeDetailModel) {
  return createElement(
    "section",
    { id: "initiative-detail-start", className: "rebuild-baseline__initiative-detail-start", "data-region": "initiative-detail-start" },
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
          packageAttrs("DetailDrawer", { "data-region": "initiative-detail-ticket" }),
          createElement(DetailDrawer, { title: "Selected ticket", open: true },
            renderKeyValueList(model.ticketItems.map((item) => ({
              key: item.key,
              label: item.label,
              value: item.value
            })))
          )
        ),
        createElement(
          "div",
          packageAttrs("TableShell", { "data-region": "initiative-detail-links" }),
          createElement(TableShell, {
            label: "Initiative detail linked records",
            columns: [
              { key: "type", label: "Type" },
              { key: "label", label: "Label" },
              { key: "target", label: "Target" },
              { key: "state", label: "State" }
            ],
            rows: model.links.map((link) => ({
              type: link.type,
              label: link.label,
              target: link.target,
              state: link.state
            }))
          })
        )
      ),
      createElement(
        "div",
        { className: "rebuild-baseline__cockpit-side", "data-region": "initiative-detail-activity" },
        createElement(
          "div",
          packageAttrs("ReadbackPanel"),
          createElement(ReadbackPanel, { title: "Decisions" },
            createElement(
              "div",
              { className: "rebuild-baseline__activity-list" },
              model.decisions.map((decision) =>
                createElement(
                  Surface,
                  { ...packageAttrs("Surface", { key: decision.label }) },
                  createElement(Badge, { ...packageAttrs("Badge"), tone: "neutral" }, decision.label),
                  createElement(Text, { ...packageAttrs("Text", { className: "rebuild-baseline__strong-text" }) }, decision.state),
                  createElement(Text, { ...packageAttrs("Text", { className: "tcrn-text--muted" }) }, decision.summary)
                )
              )
            )
          )
        ),
        createElement(
          "div",
          packageAttrs("ReadbackPanel"),
          createElement(ReadbackPanel, { title: "Activity Notes" },
            createElement(
              "div",
              { className: "rebuild-baseline__activity-list" },
              model.activity.map((item) =>
                createElement(
                  Surface,
                  { ...packageAttrs("Surface", { key: item.label }) },
                  createElement(Badge, { ...packageAttrs("Badge"), tone: "neutral" }, item.label),
                  createElement(Text, { ...packageAttrs("Text", { className: "tcrn-text--muted" }) }, item.summary)
                )
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
              description: "Owner actions stay unavailable while the initiative detail surface remains inside the shared replacement shell."
            }
          })
        ),
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
    )
  );
}

function renderAiEmployeeStart(model: RebuildAiEmployeeModel) {
  return createElement(
    "section",
    { id: "ai-employee-start", className: "rebuild-baseline__ai-employee-start", "data-region": "ai-employee-start" },
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
          packageAttrs("TableShell", { "data-region": "ai-employee-roster" }),
          createElement(TableShell, {
            label: "AI employee roster",
            columns: [
              { key: "employee", label: "Employee" },
              { key: "role", label: "Role" },
              { key: "thread", label: "Thread" },
              { key: "stories", label: "Stories" },
              { key: "conferences", label: "Conferences" },
              { key: "status", label: "Status" }
            ],
            rows: model.rows.map((row) => ({
              employee: row.name,
              role: row.role,
              thread: row.thread,
              stories: row.stories,
              conferences: row.conferences,
              status: createElement(StatusBadge, {
                ...packageAttrs("StatusBadge"),
                state: row.status === "blocked"
                  ? { state: "blocked" }
                  : { state: "local_only", label: "Current state" }
              })
            }))
          })
        )
      ),
      createElement(
        "div",
        { className: "rebuild-baseline__cockpit-side" },
        createElement(
          "div",
          packageAttrs("ReadbackPanel", { "data-region": "ai-employee-detail" }),
          createElement(ReadbackPanel, { title: model.detailTitle },
            renderKeyValueList(model.detailItems.map((item) => ({
              key: item.key,
              label: item.label,
              value: item.value
            })))
          )
        ),
        createElement(
          "div",
          packageAttrs("GateReadinessPanel"),
          createElement(GateReadinessPanel, {
            state: {
              state: "blocked",
              label: "Unavailable",
              description: "Employee updates stay unavailable while the AI employee surface remains inside the shared replacement shell."
            }
          })
        ),
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
    )
  );
}

function renderGateQueueStart(model: RebuildGateQueueModel) {
  return createElement(
    "section",
    { id: "gate-queue-start", className: "rebuild-baseline__gate-queue-start", "data-region": "gate-queue-start" },
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
          packageAttrs("TableShell", { "data-region": "gate-queue-list" }),
          createElement(TableShell, {
            label: "Gate queue rows",
            columns: [
              { key: "queue", label: "Queue" },
              { key: "gate", label: "Gate" },
              { key: "owner", label: "Owner" },
              { key: "work", label: "Work item" },
              { key: "state", label: "State" },
              { key: "evidence", label: "Evidence" }
            ],
            rows: model.rows.map((row) => ({
              queue: row.queue,
              gate: row.gate,
              owner: row.owner,
              work: row.work,
              state: createElement(StatusBadge, {
                ...packageAttrs("StatusBadge"),
                state: row.status === "blocked"
                  ? { state: "blocked" }
                  : { state: "local_only", label: "Current state" }
              }),
              evidence: row.evidence
            }))
          })
        )
      ),
      createElement(
        "div",
        { className: "rebuild-baseline__cockpit-side" },
        createElement(
          "div",
          packageAttrs("DetailDrawer", { "data-region": "gate-queue-detail" }),
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
              description: "Approvals stay unavailable while the gate queue surface remains inside the shared replacement shell."
            }
          })
        )
      )
    )
  );
}

function renderConferenceStart(model: RebuildConferenceModel) {
  return createElement(
    "section",
    { id: "conference-start", className: "rebuild-baseline__conference-start", "data-region": "conference-start" },
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
          packageAttrs("TableShell", { "data-region": "conference-list" }),
          createElement(TableShell, {
            label: "Conference list",
            columns: [
              { key: "title", label: "Conference" },
              { key: "initiator", label: "Initiator" },
              { key: "participants", label: "Participants" },
              { key: "minutes", label: "Minutes" },
              { key: "state", label: "State" },
              { key: "evidence", label: "Evidence" }
            ],
            rows: model.rows.map((row) => ({
              title: row.title,
              initiator: row.initiator,
              participants: row.participants,
              minutes: row.minutes,
              state: createElement(StatusBadge, {
                ...packageAttrs("StatusBadge"),
                state: row.status === "blocked"
                  ? { state: "blocked" }
                  : { state: "local_only", label: "Current state" }
              }),
              evidence: row.evidence
            }))
          })
        )
      ),
      createElement(
        "div",
        { className: "rebuild-baseline__cockpit-side" },
        createElement(
          "div",
          packageAttrs("DetailDrawer", { "data-region": "conference-detail" }),
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
              description: "Conference updates stay unavailable while the conference surface remains inside the shared replacement shell."
            }
          })
        )
      )
    )
  );
}

function renderGatewayAdapterStart(model: RebuildGatewayAdapterModel) {
  return createElement(
    "section",
    { id: "gateway-adapter-start", className: "rebuild-baseline__gateway-adapter-start", "data-region": "gateway-adapter-start" },
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
          packageAttrs("TableShell", { "data-region": "gateway-adapter-list" }),
          createElement(TableShell, {
            label: "Gateway and adapter rows",
            columns: [
              { key: "title", label: "Control area" },
              { key: "transport", label: "Transport" },
              { key: "posture", label: "Posture" },
              { key: "audit", label: "Audit" },
              { key: "nextAction", label: "Next action" },
              { key: "status", label: "Status" }
            ],
            rows: model.rows.map((row) => ({
              title: row.title,
              transport: row.transport,
              posture: row.posture,
              audit: row.audit,
              nextAction: row.nextAction,
              status: createElement(StatusBadge, {
                ...packageAttrs("StatusBadge"),
                state: row.status === "blocked"
                  ? { state: "blocked" }
                  : { state: "local_only", label: "Current state" }
              })
            }))
          })
        )
      ),
      createElement(
        "div",
        { className: "rebuild-baseline__cockpit-side" },
        createElement(
          "div",
          packageAttrs("DetailDrawer", { "data-region": "gateway-adapter-detail" }),
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
              description: "Live gateway, adapter, and dispatch actions stay unavailable while the gateway and adapter surface remains inside the shared replacement shell."
            }
          })
        )
      )
    )
  );
}

function renderDependencyConsoleStart(model: RebuildDependencyConsoleModel) {
  return createElement(
    "section",
    { id: "dependency-console-start", className: "rebuild-baseline__dependency-console-start", "data-region": "dependency-console-start" },
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
          packageAttrs("TableShell", { "data-region": "dependency-console-list" }),
          createElement(TableShell, {
            label: "Dependency governance rows",
            columns: [
              { key: "package", label: "Package" },
              { key: "lifecycle", label: "Lifecycle" },
              { key: "posture", label: "Posture" },
              { key: "license", label: "License" },
              { key: "nextAction", label: "Next action" },
              { key: "status", label: "Status" }
            ],
            rows: model.rows.map((row) => ({
              package: row.packageName,
              lifecycle: row.lifecycle,
              posture: row.posture,
              license: row.license,
              nextAction: row.nextAction,
              status: createElement(StatusBadge, {
                ...packageAttrs("StatusBadge"),
                state: row.status === "blocked"
                  ? { state: "blocked" }
                  : { state: "local_only", label: "Current state" }
              })
            }))
          })
        )
      ),
      createElement(
        "div",
        { className: "rebuild-baseline__cockpit-side" },
        createElement(
          "div",
          packageAttrs("DetailDrawer", { "data-region": "dependency-console-detail" }),
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
              description: "Dependency governance actions stay unavailable while the dependency console surface remains inside the shared replacement shell."
            }
          })
        )
      )
    )
  );
}

function renderResourceLibraryStart(model: RebuildResourceLibraryModel) {
  return createElement(
    "section",
    { id: "resource-library-start", className: "rebuild-baseline__resource-library-start", "data-region": "resource-library-start" },
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
          packageAttrs("TableShell", { "data-region": "resource-library-list" }),
          createElement(TableShell, {
            label: "Resource library rows",
            columns: [
              { key: "title", label: "Resource" },
              { key: "manifest", label: "Manifest" },
              { key: "traceability", label: "Traceability" },
              { key: "audit", label: "Audit" },
              { key: "nextAction", label: "Next action" },
              { key: "status", label: "Status" }
            ],
            rows: model.rows.map((row) => ({
              title: row.title,
              manifest: row.manifest,
              traceability: row.traceability,
              audit: row.audit,
              nextAction: row.nextAction,
              status: createElement(StatusBadge, {
                ...packageAttrs("StatusBadge"),
                state: row.status === "blocked"
                  ? { state: "blocked" }
                  : { state: "local_only", label: "Current state" }
              })
            }))
          })
        )
      ),
      createElement(
        "div",
        { className: "rebuild-baseline__cockpit-side" },
        createElement(
          "div",
          packageAttrs("DetailDrawer", { "data-region": "resource-library-detail" }),
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
              description: "Resource materialization stays unavailable while the resource library surface remains inside the shared replacement shell."
            }
          })
        )
      )
    )
  );
}

function renderKnowledgeModulesStart(model: RebuildKnowledgeModulesModel) {
  return createElement(
    "section",
    { id: "knowledge-modules-start", className: "rebuild-baseline__knowledge-modules-start", "data-region": "knowledge-modules-start" },
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
          packageAttrs("TableShell", { "data-region": "knowledge-modules-list" }),
          createElement(TableShell, {
            label: "Knowledge module rows",
            columns: [
              { key: "title", label: "Module" },
              { key: "scope", label: "Scope" },
              { key: "readiness", label: "Readiness" },
              { key: "posture", label: "Posture" },
              { key: "nextAction", label: "Next action" },
              { key: "status", label: "Status" }
            ],
            rows: model.rows.map((row) => ({
              title: row.title,
              scope: row.scope,
              readiness: row.readiness,
              posture: row.posture,
              nextAction: row.nextAction,
              status: createElement(StatusBadge, {
                ...packageAttrs("StatusBadge"),
                state: row.status === "blocked"
                  ? { state: "blocked" }
                  : { state: "local_only", label: "Current state" }
              })
            }))
          })
        )
      ),
      createElement(
        "div",
        { className: "rebuild-baseline__cockpit-side" },
        createElement(
          "div",
          packageAttrs("DetailDrawer", { "data-region": "knowledge-modules-detail" }),
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
              description: "Export and publish actions stay unavailable while the knowledge modules surface remains inside the shared replacement shell."
            }
          })
        )
      )
    )
  );
}

function renderAdminAccessStart(model: RebuildAdminAccessModel) {
  return createElement(
    "section",
    { id: "admin-access-start", className: "rebuild-baseline__admin-access-start", "data-region": "admin-access-start" },
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
          packageAttrs("TableShell", { "data-region": "admin-access-list" }),
          createElement(TableShell, {
            label: "Admin and access rows",
            columns: [
              { key: "title", label: "Control area" },
              { key: "permissions", label: "Permissions" },
              { key: "audit", label: "Audit" },
              { key: "posture", label: "Posture" },
              { key: "nextAction", label: "Next action" },
              { key: "status", label: "Status" }
            ],
            rows: model.rows.map((row) => ({
              title: row.title,
              permissions: row.permissions,
              audit: row.audit,
              posture: row.posture,
              nextAction: row.nextAction,
              status: createElement(StatusBadge, {
                ...packageAttrs("StatusBadge"),
                state: row.status === "blocked"
                  ? { state: "blocked" }
                  : { state: "local_only", label: "Current state" }
              })
            }))
          })
        )
      ),
      createElement(
        "div",
        { className: "rebuild-baseline__cockpit-side" },
        createElement(
          "div",
          packageAttrs("DetailDrawer", { "data-region": "admin-access-detail" }),
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
              description: "Mutable admin, audit, and break-glass actions stay unavailable while the admin and access surface remains inside the shared replacement shell."
            }
          })
        )
      )
    )
  );
}

function renderGitHubReleaseLinkageStart(model: RebuildGitHubReleaseLinkageModel) {
  return createElement(
    "section",
    { id: "github-release-linkage-start", className: "rebuild-baseline__github-release-linkage-start", "data-region": "github-release-linkage-start" },
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
          packageAttrs("TableShell", { "data-region": "github-release-linkage-list" }),
          createElement(TableShell, {
            label: "GitHub release linkage rows",
            columns: [
              { key: "title", label: "Linkage area" },
              { key: "repo", label: "Reference" },
              { key: "posture", label: "Posture" },
              { key: "blocker", label: "Blocker" },
              { key: "nextAction", label: "Next action" },
              { key: "status", label: "Status" }
            ],
            rows: model.rows.map((row) => ({
              title: row.title,
              repo: row.repo,
              posture: row.posture,
              blocker: row.blocker,
              nextAction: row.nextAction,
              status: createElement(StatusBadge, {
                ...packageAttrs("StatusBadge"),
                state: row.status === "blocked"
                  ? { state: "blocked" }
                  : { state: "local_only", label: "Current state" }
              })
            }))
          })
        )
      ),
      createElement(
        "div",
        { className: "rebuild-baseline__cockpit-side" },
        createElement(
          "div",
          packageAttrs("DetailDrawer", { "data-region": "github-release-linkage-detail" }),
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
              description: "GitHub mutation, release creation, and CI updates stay unavailable while the release linkage surface remains inside the shared replacement shell."
            }
          })
        )
      )
    )
  );
}

function renderChecklist(model: RebuildBaselineModel) {
  const relatedChecklistRows = model.currentEntryFocus
    ? model.currentEntryFocus.relatedEntries.flatMap((entry) => {
        const row = model.checklist.find((candidate) => candidate.id === entry.checklistId);
        return row ? [row] : [];
      })
    : [];
  const orderedChecklist = model.currentEntryFocus
    ? [
        ...model.checklist.filter((row) => row.id === model.currentEntryFocus?.checklistId),
        ...relatedChecklistRows,
        ...model.checklist.filter((row) => row.id !== model.currentEntryFocus?.checklistId)
          .filter((row) => !model.currentEntryFocus?.relatedEntries.some((entry) => entry.checklistId === row.id))
      ]
    : model.checklist;
  return createElement(
    "section",
    { className: "rebuild-baseline__checklist", "data-region": "rebuild-checklist" },
    createElement(
      Surface,
      { ...packageAttrs("Surface") },
      createElement(Heading, { ...packageAttrs("Heading"), level: 2 }, "Rebuilt module directory"),
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
          rows: orderedChecklist.map((row) => ({
            label: row.id === model.currentEntryFocus?.checklistId
              ? createElement(
                  "div",
                  {
                    className: "rebuild-baseline__current-label",
                    "data-current-entry-row": row.id
                  },
                  createElement("span", null, row.label),
                  createElement(Badge, { ...packageAttrs("Badge"), tone: "neutral" }, "Current entry")
                )
              : model.currentEntryFocus?.relatedEntries.some((entry) => entry.checklistId === row.id)
                ? createElement(
                    "div",
                    { className: "rebuild-baseline__current-label" },
                    createElement("span", null, row.label),
                    createElement(Badge, { ...packageAttrs("Badge"), tone: "neutral" }, "Related")
                  )
              : row.label,
            status: row.status === "workspace_active"
              ? createElement(Badge, { ...packageAttrs("Badge"), tone: "positive" }, "Active")
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
      createElement(Heading, { ...packageAttrs("Heading"), level: 2 }, "Legacy standalone scope"),
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
        ["Open live workspace", "Live workspace entry remains unavailable while the rebuilt workspace stays in local preview."],
        ["Start owner action", "Owner actions remain unavailable while the rebuilt workspace stays in local preview."],
        ["Publish module", "Publishing remains unavailable while the rebuilt workspace stays in local preview."]
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

function renderOrderedModuleSections(model: RebuildBaselineModel) {
  const sections = [
    { anchor: "cockpit-start", element: renderCockpitStart(model.cockpitStart) },
    { anchor: "docs-start", element: renderDocsStart(model.docsStart) },
    { anchor: "target-set-start", element: renderTargetSetStart(model.targetSetStart) },
    { anchor: "project-workspace-start", element: renderProjectWorkspaceStart(model.projectWorkspaceStart) },
    { anchor: "initiative-detail-start", element: renderInitiativeDetailStart(model.initiativeDetailStart) },
    { anchor: "ai-employee-start", element: renderAiEmployeeStart(model.aiEmployeeStart) },
    { anchor: "gate-queue-start", element: renderGateQueueStart(model.gateQueueStart) },
    { anchor: "conference-start", element: renderConferenceStart(model.conferenceStart) },
    { anchor: "gateway-adapter-start", element: renderGatewayAdapterStart(model.gatewayAdapterStart) },
    { anchor: "dependency-console-start", element: renderDependencyConsoleStart(model.dependencyConsoleStart) },
    { anchor: "resource-library-start", element: renderResourceLibraryStart(model.resourceLibraryStart) },
    { anchor: "knowledge-modules-start", element: renderKnowledgeModulesStart(model.knowledgeModulesStart) },
    { anchor: "admin-access-start", element: renderAdminAccessStart(model.adminAccessStart) },
    { anchor: "github-release-linkage-start", element: renderGitHubReleaseLinkageStart(model.githubReleaseLinkageStart) }
  ];
  if (!model.currentEntryFocus) return sections.map((section) => section.element);
  const selected = sections.find((section) => section.anchor === model.currentEntryFocus?.anchor);
  if (!selected) return sections.map((section) => section.element);
  const relatedAnchors = model.currentEntryFocus.relatedEntries.map((entry) => entry.anchor);
  const relatedSections = relatedAnchors.flatMap((anchor) => {
    const section = sections.find((candidate) => candidate.anchor === anchor);
    return section ? [section] : [];
  });
  const prioritizedAnchors = new Set([selected.anchor, ...relatedAnchors]);
  return [
    selected,
    ...relatedSections,
    ...sections.filter((section) => !prioritizedAnchors.has(section.anchor))
  ].map((section) => section.element);
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
        ...renderOrderedModuleSections(model),
        renderChecklist(model),
        renderBoundaries(model),
        renderActions()
      )
    )
  );
}
