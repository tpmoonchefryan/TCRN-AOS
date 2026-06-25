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
import type { GateQueueModel } from "./gate-queue-data.js";
import { gateQueueDsStandardIds, gateQueueStorybookIds } from "./gate-queue-data.js";

const createElement = React.createElement as unknown as (type: unknown, props?: Record<string, unknown> | null, ...children: unknown[]) => React.ReactElement;

const packageAttrs = (component: string, extra: Record<string, unknown> = {}) => ({
  "data-tcrn-component": component,
  "data-package-runtime-component": component,
  "data-design-system-consumer": "tcrn-aos",
  ...extra
});

function copyStateFor(status: string) {
  if (status === "blocked") return { state: "blocked", label: "Blocked" };
  if (status === "owner_intent_required" || status === "pending_role") return { state: "external_proof_needed", label: status === "owner_intent_required" ? "Action approval required" : "Role review pending" };
  if (status === "accepted") return { state: "ready", label: "Accepted locally" };
  if (status === "proposed") return { state: "local_only", label: "Proposed" };
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
    { label: "AI Employee", href: "/ai-employee.html", iconName: "info" },
    { label: "Gate Queue", href: "/gate-queue.html", iconName: "check", selected: true },
    { label: "Dependency Console", href: "/dependency-console.html", iconName: "package" },
    { label: "Docs Readiness", href: "/docs-search-release-readiness.html", iconName: "book-open" },
    { label: "Product Design", href: "/aos-wide-product-design.html", iconName: "package" }
  ];

  return createElement(
    SideNav,
    {
      ...packageAttrs("SideNav", {
        className: "gate-queue__nav",
        "data-region": "gate-queue-nav"
      }),
      label: "AOS product navigation"
    },
    createElement(
      LinkButton,
      {
        ...packageAttrs("LinkButton", {
          href: "/gate-queue.html",
          className: "gate-queue__brand",
          "data-region": "brand-lockup",
          "aria-label": "TCRN AOS Gate Queue"
        }),
        variant: "quiet"
      },
      createElement("span", { className: "gate-queue__brand-mark", "aria-hidden": "true" }, "AOS"),
      createElement(
        "span",
        { className: "gate-queue__brand-text" },
        createElement(Text, { ...packageAttrs("Text", { className: "gate-queue__brand-kicker" }) }, "TCRN"),
        createElement(Text, { ...packageAttrs("Text", { className: "gate-queue__brand-name" }) }, "Gate Queue")
      )
    ),
    createElement(
      NavGroup,
      { ...packageAttrs("NavGroup", { className: "gate-queue__nav-group" }), label: "AOS workspace pages" },
      navItems.map((item) =>
        createElement(
          NavItem,
          {
            ...packageAttrs("NavItem", {
              key: item.label,
              href: item.href,
              iconName: item.iconName,
              selected: item.selected,
              className: "gate-queue__nav-item"
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
          className: "gate-queue__nav-note",
          "data-region": "gate-queue-local-mode"
        })
      },
      "Local service preview"
    )
  );
}

function renderTopbar(model: GateQueueModel) {
  return createElement(
    "header",
    packageAttrs("TopBar", {
      className: "gate-queue__topbar",
      "data-region": "gate-queue-topbar"
    }),
    createElement(TopBar, {
      productName: "TCRN AOS",
      moduleName: "Gate Queue",
      actions: createElement(
        "div",
        { className: "gate-queue__topbar-controls" },
        createElement(
          "label",
          { className: "gate-queue__select-field" },
          createElement(Text, { ...packageAttrs("Text", { className: "tcrn-text--muted gate-queue__field-label" }) }, "Project"),
          createElement(Select, {
            ...packageAttrs("Select", { id: "gate-queue-project-select", "aria-label": "Project" }),
            value: model.context.projectId,
            disabled: true,
            disabledReason: "Project switching is read-only in this local queue preview.",
            options: [{ label: model.context.projectId, value: model.context.projectId }]
          })
        ),
        createElement(
          Button,
          {
            ...packageAttrs("Button"),
            variant: "secondary",
            disabled: true,
            disabledReason: "Refresh is available from the Operations Cockpit while this queue stays in local preview mode."
          },
          "Refresh"
        )
      )
    }),
    createElement(
      "div",
      { className: "gate-queue__topbar-copy" },
      createElement(Heading, { ...packageAttrs("Heading"), level: 1 }, "Gate Queue"),
      createElement(Text, { ...packageAttrs("Text", { className: "tcrn-text--muted" }) }, "Action approvals and role reviews from the local service model.")
    )
  );
}

function renderSummary(model: GateQueueModel) {
  return createElement(
    "section",
    { className: "gate-queue__summary", "data-region": "gate-queue-summary" },
    createElement(
      Surface,
      { ...packageAttrs("Surface", { className: "gate-queue__hero" }) },
      createElement(Badge, { ...packageAttrs("Badge"), tone: "warning" }, "Gate Queue"),
      createElement(Heading, { ...packageAttrs("Heading"), level: 2 }, "Approvals stay visible and non-executing"),
      createElement(Text, { ...packageAttrs("Text", { className: "tcrn-text--muted" }) }, model.targetSet.detail),
      createElement(
        "div",
        packageAttrs("EvidenceStrip", { className: "gate-queue__evidence-strip" }),
        createElement(EvidenceStrip, {
          items: [
            `${model.summary.totalGates} local gates`,
            `${model.summary.actionApprovalCount} action approvals`,
            `${model.summary.roleReviewCount} role reviews`,
            "Live actions: Not enabled"
          ]
        })
      )
    ),
    createElement(
      Surface,
      { ...packageAttrs("Surface", { className: "gate-queue__status" }) },
      createElement(Heading, { ...packageAttrs("Heading"), level: 2 }, "Queue Status"),
      renderKeyValueList([
        { key: "source", label: "Source", value: "Local service preview" },
        { key: "schema", label: "Schema", value: model.context.sourceSchema },
        { key: "blocked", label: "Needs review", value: String(model.summary.blockedCount) },
        { key: "evidence", label: "Evidence links", value: String(model.summary.linkedEvidenceCount) },
        { key: "execution", label: "Execution", value: "Not enabled" }
      ])
    )
  );
}

function renderGateList(model: GateQueueModel) {
  const rows = model.gates.map((gate) => ({
    queue: gate.queueLabel,
    gate: gate.gateLabel,
    owner: gate.owner,
    work: gate.linkedStoryTitle,
    state: createElement(StatusBadge, { ...packageAttrs("StatusBadge"), state: copyStateFor(gate.status) }),
    evidence: String(gate.linkedEvidenceCount)
  }));

  return createElement(
    "section",
    { className: "gate-queue__list", "data-region": "gate-queue-list" },
    createElement(
      Surface,
      { ...packageAttrs("Surface") },
      createElement("div", { className: "gate-queue__section-heading" }, createElement(Heading, { ...packageAttrs("Heading"), level: 2 }, "Queue Rows")),
      createElement(
        "div",
        packageAttrs("TableShell", { className: "gate-queue__table-shell" }),
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
          rows,
          emptyState: "No gate rows are available from the local service preview."
        })
      )
    )
  );
}

function renderDetail(model: GateQueueModel) {
  return createElement(
    "section",
    { className: "gate-queue__detail", "data-region": "gate-queue-detail" },
    createElement(
      "div",
      packageAttrs("DetailDrawer", { className: "gate-queue__detail-drawer" }),
      createElement(
        DetailDrawer,
        { title: "Selected Gate", open: true },
        createElement(StatusBadge, { ...packageAttrs("StatusBadge"), state: copyStateFor(model.selectedGate.status) }),
        createElement(Heading, { ...packageAttrs("Heading"), level: 2 }, model.selectedGate.gateLabel),
        renderKeyValueList([
          { key: "gate-id", label: "Gate ID", value: model.selectedGate.id },
          { key: "queue", label: "Queue", value: model.selectedGate.queueLabel },
          { key: "owner", label: "Owner", value: model.selectedGate.owner },
          { key: "mode", label: "Mode", value: model.selectedGate.modeLabel },
          { key: "work", label: "Linked work", value: model.selectedGate.linkedStoryTitle },
          { key: "freshness", label: "Work freshness", value: model.selectedGate.linkedStoryFreshness === "current" ? "Current state" : model.selectedGate.linkedStoryFreshness === "blocked" ? "Blocked" : "Review needed" },
          { key: "evidence", label: "Evidence links", value: String(model.selectedGate.linkedEvidenceCount) },
          { key: "blocker", label: "Blocker", value: model.selectedGate.blocker }
        ])
      )
    ),
    createElement(
      "div",
      packageAttrs("ReadbackPanel", { className: "gate-queue__service", "data-region": "gate-queue-service" }),
      createElement(
        ReadbackPanel,
        { title: "Service Status" },
        renderKeyValueList(model.serviceOverview.map((item) => ({ key: item.label.toLowerCase().replace(/[^a-z0-9]+/g, "-"), label: item.label, value: item.value })))
      )
    )
  );
}

function renderUnavailableActions(model: GateQueueModel) {
  return createElement(
    "section",
    { className: "gate-queue__actions", "data-region": "gate-queue-actions", "aria-label": "Unavailable gate actions" },
    createElement(Heading, { ...packageAttrs("Heading"), level: 2 }, "Unavailable Actions"),
    createElement(
      "div",
      { className: "gate-queue__action-list" },
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

export function renderGateQueueRuntimeSurface(model: GateQueueModel): string {
  return renderToStaticMarkup(
    createElement(
      "main",
      {
        className: "gate-queue",
        "data-surface": "gate-queue",
        "data-design-system-consumer": "tcrn-aos",
        "data-ds-standard-ids": gateQueueDsStandardIds.join(" "),
        "data-ds-storybook-ids": gateQueueStorybookIds.join(" "),
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
        { className: "gate-queue__content", "data-region": "gate-queue-shell" },
        renderTopbar(model),
        renderSummary(model),
        renderGateList(model),
        renderDetail(model),
        renderUnavailableActions(model)
      )
    )
  );
}
