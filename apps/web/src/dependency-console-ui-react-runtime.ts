import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Badge,
  Button,
  DetailDrawer,
  EvidenceStrip,
  Heading,
  KeyValueList,
  LinkButton,
  NavGroup,
  NavItem,
  ReadbackPanel,
  Select,
  SideNav,
  StatusBadge,
  Surface,
  TableShell,
  Text,
  TopBar
} from "@tcrn/ui-react";
import type { DependencyConsoleModel } from "./dependency-console-data.js";
import { dependencyConsoleDsStandardIds, dependencyConsoleStorybookIds } from "./dependency-console-data.js";

const createElement = React.createElement as unknown as (type: unknown, props?: Record<string, unknown> | null, ...children: unknown[]) => React.ReactElement;

const packageAttrs = (component: string, extra: Record<string, unknown> = {}) => ({
  "data-tcrn-component": component,
  "data-package-runtime-component": component,
  "data-design-system-consumer": "tcrn-aos",
  ...extra
});

function copyStateFor(blocked: boolean) {
  return blocked ? { state: "blocked", label: "Blocked" } : { state: "local_only", label: "Current state" };
}

function renderKeyValueList(items: Array<{ key: string; label: string; value: React.ReactNode }>) {
  return createElement("div", packageAttrs("KeyValueList"), createElement(KeyValueList, { items }));
}

function renderSidebar() {
  const navItems = [
    { label: "Operations Cockpit", href: "/operations-cockpit.html", iconName: "panel-left-open" },
    { label: "Project Workspace", href: "/project-workspace.html", iconName: "home" },
    { label: "Initiative Detail", href: "/initiative-detail.html", iconName: "search" },
    { label: "AI Employee", href: "/ai-employee.html", iconName: "info" },
    { label: "Gate Queue", href: "/gate-queue.html", iconName: "check" },
    { label: "Conference", href: "/conference.html", iconName: "book-open" },
    { label: "Dependency Console", href: "/dependency-console.html", iconName: "package", selected: true },
    { label: "Docs Readiness", href: "/docs-search-release-readiness.html", iconName: "book-open" },
    { label: "Product Design", href: "/aos-wide-product-design.html", iconName: "package" }
  ];

  return createElement(
    SideNav,
    {
      ...packageAttrs("SideNav", {
        className: "dependency-console__nav",
        "data-region": "dependency-console-nav"
      }),
      label: "AOS product navigation"
    },
    createElement(
      LinkButton,
      {
        ...packageAttrs("LinkButton", {
          href: "/dependency-console.html",
          className: "dependency-console__brand",
          "data-region": "brand-lockup",
          "aria-label": "TCRN AOS Dependency Console"
        }),
        variant: "quiet"
      },
      createElement("span", { className: "dependency-console__brand-mark", "aria-hidden": "true" }, "AOS"),
      createElement(
        "span",
        { className: "dependency-console__brand-text" },
        createElement(Text, { ...packageAttrs("Text", { className: "dependency-console__brand-kicker" }) }, "TCRN"),
        createElement(Text, { ...packageAttrs("Text", { className: "dependency-console__brand-name" }) }, "Dependency Console")
      )
    ),
    createElement(
      NavGroup,
      { ...packageAttrs("NavGroup", { className: "dependency-console__nav-group" }), label: "AOS workspace pages" },
      navItems.map((item) =>
        createElement(
          NavItem,
          {
            ...packageAttrs("NavItem", {
              key: item.label,
              href: item.href,
              iconName: item.iconName,
              selected: item.selected,
              className: "dependency-console__nav-item"
            })
          },
          item.label
        )
      )
    ),
    createElement(
      Text,
      {
        ...packageAttrs("Text", {
          className: "dependency-console__nav-note",
          "data-region": "dependency-console-local-mode"
        })
      },
      "Local service preview"
    )
  );
}

function renderTopbar(model: DependencyConsoleModel) {
  return createElement(
    "header",
    packageAttrs("TopBar", {
      className: "dependency-console__topbar",
      "data-region": "dependency-console-topbar"
    }),
    createElement(TopBar, {
      productName: "TCRN AOS",
      moduleName: "Dependency Console",
      actions: createElement(
        "div",
        { className: "dependency-console__topbar-controls" },
        createElement(
          "label",
          { className: "dependency-console__select-field" },
          createElement(Text, { ...packageAttrs("Text", { className: "tcrn-text--muted dependency-console__field-label" }) }, "Project"),
          createElement(Select, {
            ...packageAttrs("Select", { id: "dependency-console-project-select", "aria-label": "Project" }),
            value: model.context.projectId,
            disabled: true,
            disabledReason: "Project switching is read-only in this local dependency preview.",
            options: [{ label: model.context.projectId, value: model.context.projectId }]
          })
        ),
        createElement(
          Button,
          {
            ...packageAttrs("Button"),
            variant: "secondary",
            disabled: true,
            disabledReason: "Refresh is available from the Operations Cockpit while this dependency page stays in local preview mode."
          },
          "Refresh"
        )
      )
    }),
    createElement(
      "div",
      { className: "dependency-console__topbar-copy" },
      createElement(Heading, { ...packageAttrs("Heading"), level: 1 }, "Dependency Console"),
      createElement(Text, { ...packageAttrs("Text", { className: "tcrn-text--muted" }) }, "Dependency lifecycle, license posture, evidence state, and blocked remediation from the local governance model.")
    )
  );
}

function renderSummary(model: DependencyConsoleModel) {
  return createElement(
    "section",
    { className: "dependency-console__summary", "data-region": "dependency-console-summary" },
    createElement(
      Surface,
      { ...packageAttrs("Surface", { className: "dependency-console__hero" }) },
      createElement(Badge, { ...packageAttrs("Badge"), tone: "warning" }, "Dependency Console"),
      createElement(Heading, { ...packageAttrs("Heading"), level: 2 }, model.targetSet.title),
      createElement(Text, { ...packageAttrs("Text", { className: "tcrn-text--muted" }) }, model.targetSet.detail),
      createElement(
        "div",
        packageAttrs("EvidenceStrip", { className: "dependency-console__evidence-strip" }),
        createElement(EvidenceStrip, {
          items: [
            `${model.summary.dependencyCount} dependency rows`,
            `${model.summary.blockedCount} blocked`,
            `${model.summary.releaseBlockerCount} release blockers`,
            "Live actions: Not enabled"
          ]
        })
      )
    ),
    createElement(
      Surface,
      { ...packageAttrs("Surface", { className: "dependency-console__status" }) },
      createElement(Heading, { ...packageAttrs("Heading"), level: 2 }, "Governance Status"),
      renderKeyValueList([
        { key: "source", label: "Source", value: "Local service preview" },
        { key: "blocked", label: "Blocked", value: String(model.summary.blockedCount) },
        { key: "release-blockers", label: "Release blockers", value: String(model.summary.releaseBlockerCount) },
        { key: "sbom", label: "SBOM notice", value: String(model.summary.sbomNoticeCount) },
        { key: "execution", label: "Execution", value: "Not enabled" }
      ])
    )
  );
}

function renderDependencyList(model: DependencyConsoleModel) {
  const rows = model.dependencies.map((dependency) => ({
    package: dependency.packageName,
    lifecycle: dependency.lifecycleLabel,
    posture: dependency.postureLabel,
    license: dependency.licenseExpression,
    nextAction: dependency.nextActionLabel,
    status: createElement(StatusBadge, { ...packageAttrs("StatusBadge"), state: copyStateFor(dependency.releaseBlocker) })
  }));

  return createElement(
    "section",
    { className: "dependency-console__list", "data-region": "dependency-console-list" },
    createElement(
      Surface,
      { ...packageAttrs("Surface") },
      createElement("div", { className: "dependency-console__section-heading" }, createElement(Heading, { ...packageAttrs("Heading"), level: 2 }, "Dependency List")),
      createElement(
        "div",
        packageAttrs("TableShell", { className: "dependency-console__table-shell" }),
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
          rows,
          emptyState: "No dependency governance rows are available from the local preview."
        })
      )
    )
  );
}

function renderDetail(model: DependencyConsoleModel) {
  const selected = model.selectedDependency;
  return createElement(
    "section",
    { className: "dependency-console__detail", "data-region": "dependency-console-detail" },
    createElement(
      "div",
      packageAttrs("DetailDrawer", { className: "dependency-console__detail-drawer" }),
      createElement(
        DetailDrawer,
        { title: "Selected Dependency", open: true },
        createElement(StatusBadge, { ...packageAttrs("StatusBadge"), state: copyStateFor(selected.releaseBlocker) }),
        createElement(Heading, { ...packageAttrs("Heading"), level: 2 }, selected.packageName),
        renderKeyValueList([
          { key: "lifecycle", label: "Lifecycle", value: selected.lifecycleLabel },
          { key: "posture", label: "Posture", value: selected.postureLabel },
          { key: "license", label: "License", value: selected.licenseExpression },
          { key: "sbom", label: "SBOM notice", value: selected.sbomLabel },
          { key: "evidence", label: "Evidence", value: selected.evidenceLabel },
          { key: "reviewer", label: "Reviewer", value: selected.reviewerLabel },
          { key: "risk", label: "Residual risk", value: selected.riskLabel },
          { key: "findings", label: "Finding states", value: selected.findingStates.join(", ") || "No finding state" }
        ])
      )
    ),
    createElement(
      "div",
      packageAttrs("ReadbackPanel", { className: "dependency-console__service", "data-region": "dependency-console-service" }),
      createElement(
        ReadbackPanel,
        { title: "Service Status" },
        renderKeyValueList(model.serviceOverview.map((item) => ({ key: item.label.toLowerCase().replace(/[^a-z0-9]+/g, "-"), label: item.label, value: item.value })))
      )
    )
  );
}

function renderUnavailableActions(model: DependencyConsoleModel) {
  return createElement(
    "section",
    { className: "dependency-console__actions", "data-region": "dependency-console-actions", "aria-label": "Unavailable dependency actions" },
    createElement(Heading, { ...packageAttrs("Heading"), level: 2 }, "Unavailable Actions"),
    createElement(
      "div",
      { className: "dependency-console__action-list" },
      model.unavailableActions.map((action) =>
        createElement(
          Button,
          {
            ...packageAttrs("Button", { key: action.label }),
            variant: "secondary",
            disabled: true,
            disabledReason: action.reason
          },
          action.label
        )
      )
    )
  );
}

export function renderDependencyConsoleRuntimeSurface(model: DependencyConsoleModel): string {
  return renderToStaticMarkup(
    createElement(
      "main",
      {
        className: "dependency-console",
        "data-surface": "dependency-console",
        "data-design-system-consumer": "tcrn-aos",
        "data-ds-standard-ids": dependencyConsoleDsStandardIds.join(" "),
        "data-ds-storybook-ids": dependencyConsoleStorybookIds.join(" "),
        "data-product-acceptance": "false",
        "data-final-mvp-acceptance": "false",
        "data-release-publication": "false",
        "data-owner-intent-execution": "false",
        "data-live-dispatch": "false",
        "data-parent-goal-completion": "false"
      },
      renderSidebar(),
      createElement(
        "div",
        { className: "dependency-console__content", "data-region": "dependency-console-shell" },
        renderTopbar(model),
        renderSummary(model),
        renderDependencyList(model),
        renderDetail(model),
        renderUnavailableActions(model)
      )
    )
  );
}
