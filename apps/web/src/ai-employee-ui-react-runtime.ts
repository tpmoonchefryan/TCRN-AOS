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
import type { AIEmployeeModel } from "./ai-employee-data.js";
import { aiEmployeeDsStandardIds, aiEmployeeStorybookIds } from "./ai-employee-data.js";

const createElement = React.createElement as unknown as (type: unknown, props?: Record<string, unknown> | null, ...children: unknown[]) => React.ReactElement;

const packageAttrs = (component: string, extra: Record<string, unknown> = {}) => ({
  "data-tcrn-component": component,
  "data-package-runtime-component": component,
  "data-design-system-consumer": "tcrn-aos",
  ...extra
});

function copyStateFor(status: string) {
  if (status === "blocked") return { state: "blocked", label: "Blocked" };
  if (status === "current") return { state: "local_only", label: "Current state" };
  return { state: "unknown", label: "Unknown" };
}

function renderKeyValueList(items: Array<{ key: string; label: string; value: React.ReactNode }>) {
  return createElement("div", packageAttrs("KeyValueList"), createElement(KeyValueList, { items }));
}

function renderSidebar() {
  const navItems = [
    { label: "Operations Cockpit", href: "/operations-cockpit.html", iconName: "panel-left-open" },
    { label: "Project Workspace", href: "/project-workspace.html", iconName: "home" },
    { label: "Initiative Detail", href: "/initiative-detail.html", iconName: "search" },
    { label: "AI Employee", href: "/ai-employee.html", iconName: "info", selected: true },
    { label: "Gate Queue", href: "/gate-queue.html", iconName: "check" },
    { label: "Dependency Console", href: "/dependency-console.html", iconName: "package" },
    { label: "Docs Readiness", href: "/docs-search-release-readiness.html", iconName: "book-open" },
    { label: "Product Design", href: "/aos-wide-product-design.html", iconName: "package" }
  ];

  return createElement(
    SideNav,
    {
      ...packageAttrs("SideNav", {
        className: "ai-employee__nav",
        "data-region": "ai-employee-nav"
      }),
      label: "AOS product navigation"
    },
    createElement(
      LinkButton,
      {
        ...packageAttrs("LinkButton", {
          href: "/ai-employee.html",
          className: "ai-employee__brand",
          "data-region": "brand-lockup",
          "aria-label": "TCRN AOS AI Employee"
        }),
        variant: "quiet"
      },
      createElement("span", { className: "ai-employee__brand-mark", "aria-hidden": "true" }, "AOS"),
      createElement(
        "span",
        { className: "ai-employee__brand-text" },
        createElement(Text, { ...packageAttrs("Text", { className: "ai-employee__brand-kicker" }) }, "TCRN"),
        createElement(Text, { ...packageAttrs("Text", { className: "ai-employee__brand-name" }) }, "AI Employee")
      )
    ),
    createElement(
      NavGroup,
      { ...packageAttrs("NavGroup", { className: "ai-employee__nav-group" }), label: "AOS workspace pages" },
      navItems.map((item) =>
        createElement(
          NavItem,
          {
            ...packageAttrs("NavItem", {
              key: item.label,
              href: item.href,
              iconName: item.iconName,
              selected: item.selected,
              className: "ai-employee__nav-item"
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
          className: "ai-employee__nav-note",
          "data-region": "ai-employee-local-mode"
        })
      },
      "Local service preview"
    )
  );
}

function renderTopbar(model: AIEmployeeModel) {
  return createElement(
    "header",
    packageAttrs("TopBar", {
      className: "ai-employee__topbar",
      "data-region": "ai-employee-topbar"
    }),
    createElement(TopBar, {
      productName: "TCRN AOS",
      moduleName: "AI Employee",
      actions: createElement(
        "div",
        { className: "ai-employee__topbar-controls" },
        createElement(
          "label",
          { className: "ai-employee__select-field" },
          createElement(Text, { ...packageAttrs("Text", { className: "tcrn-text--muted ai-employee__field-label" }) }, "Project"),
          createElement(Select, {
            ...packageAttrs("Select", { id: "ai-employee-project-select", "aria-label": "Project" }),
            value: model.context.projectId,
            disabled: true,
            disabledReason: "Project switching is read-only in this local employee preview.",
            options: [{ label: model.context.projectId, value: model.context.projectId }]
          })
        ),
        createElement(
          Button,
          {
            ...packageAttrs("Button"),
            variant: "secondary",
            disabled: true,
            disabledReason: "Refresh is available from the Operations Cockpit while this employee page stays in local preview mode."
          },
          "Refresh"
        )
      )
    }),
    createElement(
      "div",
      { className: "ai-employee__topbar-copy" },
      createElement(Heading, { ...packageAttrs("Heading"), level: 1 }, "AI Employee"),
      createElement(Text, { ...packageAttrs("Text", { className: "tcrn-text--muted" }) }, "Role identity, thread status, assignments, and contact posture from the local service model.")
    )
  );
}

function renderSummary(model: AIEmployeeModel) {
  return createElement(
    "section",
    { className: "ai-employee__summary", "data-region": "ai-employee-summary" },
    createElement(
      Surface,
      { ...packageAttrs("Surface", { className: "ai-employee__hero" }) },
      createElement(Badge, { ...packageAttrs("Badge"), tone: "positive" }, "AI Employee"),
      createElement(Heading, { ...packageAttrs("Heading"), level: 2 }, model.selectedEmployee.name),
      createElement(Text, { ...packageAttrs("Text", { className: "tcrn-text--muted" }) }, model.targetSet.detail),
      createElement(
        "div",
        packageAttrs("EvidenceStrip", { className: "ai-employee__evidence-strip" }),
        createElement(EvidenceStrip, {
          items: [
            `${model.summary.employeeCount} profiles`,
            `${model.summary.assignmentCount} story links`,
            `${model.summary.conferenceCount} conference links`,
            "Live actions: Not enabled"
          ]
        })
      )
    ),
    createElement(
      Surface,
      { ...packageAttrs("Surface", { className: "ai-employee__status" }) },
      createElement(Heading, { ...packageAttrs("Heading"), level: 2 }, "Profile Status"),
      renderKeyValueList([
        { key: "source", label: "Source", value: "Local service preview" },
        { key: "schema", label: "Schema", value: model.context.sourceSchema },
        { key: "threads", label: "Active threads", value: String(model.summary.activeThreadCount) },
        { key: "blocked", label: "Needs review", value: String(model.summary.blockedProfileCount) },
        { key: "execution", label: "Execution", value: "Not enabled" }
      ])
    )
  );
}

function renderRoster(model: AIEmployeeModel) {
  const rows = model.employees.map((employee) => ({
    employee: employee.name,
    role: employee.roleLabel,
    thread: employee.threadId,
    stories: String(employee.assignmentCount),
    conferences: String(employee.conferenceCount),
    status: createElement(StatusBadge, { ...packageAttrs("StatusBadge"), state: copyStateFor(employee.activeWorkState) })
  }));

  return createElement(
    "section",
    { className: "ai-employee__roster", "data-region": "ai-employee-roster" },
    createElement(
      Surface,
      { ...packageAttrs("Surface") },
      createElement("div", { className: "ai-employee__section-heading" }, createElement(Heading, { ...packageAttrs("Heading"), level: 2 }, "Employee Roster")),
      createElement(
        "div",
        packageAttrs("TableShell", { className: "ai-employee__table-shell" }),
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
          rows,
          emptyState: "No AI employee profiles are available from the local service preview."
        })
      )
    )
  );
}

function renderDetail(model: AIEmployeeModel) {
  return createElement(
    "section",
    { className: "ai-employee__detail", "data-region": "ai-employee-detail" },
    createElement(
      "div",
      packageAttrs("DetailDrawer", { className: "ai-employee__detail-drawer" }),
      createElement(
        DetailDrawer,
        { title: "Selected Profile", open: true },
        createElement(StatusBadge, { ...packageAttrs("StatusBadge"), state: copyStateFor(model.selectedEmployee.activeWorkState) }),
        createElement(Heading, { ...packageAttrs("Heading"), level: 2 }, model.selectedEmployee.name),
        renderKeyValueList([
          { key: "role", label: "Role", value: model.selectedEmployee.roleLabel },
          { key: "lifecycle", label: "Lifecycle", value: model.selectedEmployee.lifecycleLabel },
          { key: "thread", label: "Thread ID", value: model.selectedEmployee.threadId },
          { key: "thread-state", label: "Thread state", value: model.selectedEmployee.threadStatusLabel },
          { key: "stories", label: "Linked stories", value: model.selectedEmployee.linkedStoryTitles.join(", ") || "No linked story" },
          { key: "conferences", label: "Conference activity", value: model.selectedEmployee.linkedConferenceTitles.join(", ") || "No linked conference" },
          { key: "authority", label: "Authority posture", value: model.selectedEmployee.authoritySummary },
          { key: "contact", label: "Contact when", value: model.selectedEmployee.contactWhen }
        ])
      )
    ),
    createElement(
      "div",
      packageAttrs("ReadbackPanel", { className: "ai-employee__service", "data-region": "ai-employee-service" }),
      createElement(
        ReadbackPanel,
        { title: "Service Status" },
        renderKeyValueList(model.serviceOverview.map((item) => ({ key: item.label.toLowerCase().replace(/[^a-z0-9]+/g, "-"), label: item.label, value: item.value })))
      )
    )
  );
}

function renderUnavailableActions(model: AIEmployeeModel) {
  return createElement(
    "section",
    { className: "ai-employee__actions", "data-region": "ai-employee-actions", "aria-label": "Unavailable employee actions" },
    createElement(Heading, { ...packageAttrs("Heading"), level: 2 }, "Unavailable Actions"),
    createElement(
      "div",
      { className: "ai-employee__action-list" },
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

export function renderAiEmployeeRuntimeSurface(model: AIEmployeeModel): string {
  return renderToStaticMarkup(
    createElement(
      "main",
      {
        className: "ai-employee",
        "data-surface": "ai-employee",
        "data-design-system-consumer": "tcrn-aos",
        "data-ds-standard-ids": aiEmployeeDsStandardIds.join(" "),
        "data-ds-storybook-ids": aiEmployeeStorybookIds.join(" "),
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
        { className: "ai-employee__content", "data-region": "ai-employee-shell" },
        renderTopbar(model),
        renderSummary(model),
        renderRoster(model),
        renderDetail(model),
        renderUnavailableActions(model)
      )
    )
  );
}
