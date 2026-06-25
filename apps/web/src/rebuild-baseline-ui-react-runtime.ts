import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Badge,
  Button,
  EvidenceStrip,
  Heading,
  KeyValueList,
  LinkButton,
  NavGroup,
  NavItem,
  ReadbackPanel,
  SideNav,
  StatusBadge,
  Surface,
  TableShell,
  Text,
  TopBar
} from "@tcrn/ui-react";
import type { RebuildBaselineModel } from "./rebuild-baseline-data.js";

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
  const standardNavItems = [
    { label: "Operations cockpit", href: "/operations-cockpit.html", iconName: "home", selected: model.currentAlias.includes("operations-cockpit") || model.currentAlias === "/" },
    { label: "Docs readiness", href: "/docs-search-release-readiness.html", iconName: "book-open", selected: model.currentAlias.includes("docs-search-release-readiness") },
    { label: "Product design target set", href: "/aos-wide-product-design.html", iconName: "package", selected: model.currentAlias.includes("aos-wide-product-design") }
  ];
  const rebuildNavItems = [
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
          href: "/operations-cockpit.html",
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
      { ...packageAttrs("NavGroup", { className: "rebuild-baseline__nav-group" }), label: "Certified standards" },
      standardNavItems.map((item) =>
        createElement(
          NavItem,
          {
            ...packageAttrs("NavItem", {
              key: item.label,
              href: item.href,
              iconName: item.iconName,
              selected: item.selected,
              className: "rebuild-baseline__nav-item"
            })
          },
          item.label
        )
      )
    ),
    createElement(
      NavGroup,
      { ...packageAttrs("NavGroup", { className: "rebuild-baseline__nav-group" }), label: "Queued rebuild modules" },
      rebuildNavItems.map((label) =>
        createElement(
          NavItem,
          {
            ...packageAttrs("NavItem", {
              key: label,
              iconName: "package",
              className: "rebuild-baseline__nav-item"
            }),
            disabled: true,
            disabledReason: "This module is being rebuilt from the Design System standards before it is reopened as a standalone surface."
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
      "Design System rebuild baseline"
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
      moduleName: "Rebuild Workspace",
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
          disabledReason: "Publishing is not enabled while the rebuild baseline is being established."
        }, "Publish")
      )
    }),
    createElement(
      "div",
      { className: "rebuild-baseline__topbar-copy" },
      createElement(Heading, { ...packageAttrs("Heading"), level: 1 }, "AOS Rebuild Workspace"),
      createElement(Text, { ...packageAttrs("Text", { className: "tcrn-text--muted" }) }, `Current module path: ${model.currentAliasLabel}`)
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
      createElement(Badge, { ...packageAttrs("Badge"), tone: "positive" }, "Design System baseline"),
      createElement(Heading, { ...packageAttrs("Heading"), level: 2 }, "Current AOS frontend is being replaced"),
      createElement(Text, { ...packageAttrs("Text", { className: "tcrn-text--muted" }) }, "The rebuild now starts from certified Storybook standards and package-backed components instead of preserving the previous frontend shape."),
      createElement(
        "div",
        packageAttrs("EvidenceStrip", { className: "rebuild-baseline__evidence-strip" }),
        createElement(EvidenceStrip, {
          items: [
            `Standards: ${model.dsStandardIds.length}`,
            `Active alias: ${model.currentAliasLabel}`,
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
        title: "Baseline status"
      },
      renderKeyValueList([
        { key: "starting-module", label: "Starting module", value: "Operations cockpit rebuild" },
        { key: "surface-state", label: "Surface state", value: "First rebuilt surface active" },
        { key: "storyboard-source", label: "Design source", value: "Certified Storybook standards" },
        { key: "acceptance", label: "Acceptance", value: "Not enabled" }
      ]))
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
      createElement(Heading, { ...packageAttrs("Heading"), level: 2 }, "Module rebuild checklist"),
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
            status: row.status === "reopened"
              ? createElement(Badge, { ...packageAttrs("Badge"), tone: "positive" }, "Active now")
              : row.status === "standard_ready"
              ? createElement(Badge, { ...packageAttrs("Badge"), tone: "positive" }, "Standard ready")
              : row.status === "reset_started"
                ? createElement(Badge, { ...packageAttrs("Badge"), tone: "warning" }, "Reset started")
                : createElement(Badge, { ...packageAttrs("Badge"), tone: "neutral" }, "Queued"),
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
      createElement(Heading, { ...packageAttrs("Heading"), level: 2 }, "Replaced frontend scope"),
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
        ["Start owner action", "Owner actions stay disabled until rebuilt product flows are explicitly reopened."],
        ["Publish module", "Publishing is not enabled during the rebuild reset."]
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
        renderChecklist(model),
        renderBoundaries(model),
        renderActions()
      )
    )
  );
}
