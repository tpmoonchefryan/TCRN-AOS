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
import type { InitiativeDetailModel } from "./initiative-detail-data.js";
import { initiativeDetailDsStandardIds, initiativeDetailStorybookIds } from "./initiative-detail-data.js";
import { aosDesignSystemConsumerBridge, presentAosCopyState } from "./design-system-bridge.js";

const createElement = React.createElement as unknown as (type: unknown, props?: Record<string, unknown> | null, ...children: unknown[]) => React.ReactElement;

export const initiativeDetailRuntimeScope = {
  route: "initiative-detail",
  publicPackage: "@tcrn/ui-react",
  standards: initiativeDetailDsStandardIds,
  storybookIds: initiativeDetailStorybookIds,
  componentScope: [
    "Surface",
    "SideNav",
    "NavGroup",
    "NavItem",
    "LinkButton",
    "TopBar",
    "Select",
    "Button",
    "Badge",
    "StatusBadge",
    "EvidenceStrip",
    "ReadbackPanel",
    "Text",
    "Heading",
    "KeyValueList",
    "TableShell",
    "DetailDrawer"
  ] as const,
  packageImport: true,
  designSystemHead: aosDesignSystemConsumerBridge.designSystemSourceHead,
  exceptionRecords: aosDesignSystemConsumerBridge.acceptedExceptionRecords
} as const;

const packageAttrs = (component: string, extra: Record<string, unknown> = {}) => ({
  "data-tcrn-component": component,
  "data-package-runtime-component": component,
  "data-design-system-consumer": "tcrn-aos",
  ...extra
});

function copyStateFor(status: string) {
  if (status === "blocked") return { state: "blocked", label: presentAosCopyState(status).label };
  if (status === "review_required" || status === "in_review") return { state: "proof_required", label: "Review needed" };
  if (status === "pending_external_proof") return { state: "proof_required", label: "Review pending" };
  if (status === "accepted" || status === "verified" || status === "released") return { state: "ready", label: presentAosCopyState(status).label };
  if (status === "active" || status === "in_progress" || status === "proposed" || status === "current") return { state: "local_only", label: presentAosCopyState(status).label };
  return { state: "unknown", label: presentAosCopyState(status).label };
}

function renderKeyValueList(items: Array<{ key: string; label: string; value: React.ReactNode }>) {
  return createElement("div", packageAttrs("KeyValueList"), createElement(KeyValueList, { items }));
}

function renderSidebar() {
  const navItems = [
    { label: "Operations Cockpit", href: "/operations-cockpit.html", iconName: "panel-left-open" },
    { label: "Project Workspace", href: "/project-workspace.html", iconName: "home" },
    { label: "Initiative Detail", href: "/initiative-detail.html", iconName: "search", selected: true },
    { label: "AI Employee", href: "/ai-employee.html", iconName: "info" },
    { label: "Gate Queue", href: "/gate-queue.html", iconName: "check" },
    { label: "Dependency Console", href: "/dependency-console.html", iconName: "package" },
    { label: "Docs Readiness", href: "/docs-search-release-readiness.html", iconName: "book-open" },
    { label: "Product Design", href: "/aos-wide-product-design.html", iconName: "package" }
  ];

  return createElement(
    SideNav,
    {
      ...packageAttrs("SideNav", {
        className: "initiative-detail__nav",
        "data-region": "initiative-detail-nav"
      }),
      label: "AOS product navigation"
    },
    createElement(
      LinkButton,
      {
        ...packageAttrs("LinkButton", {
          href: "/initiative-detail.html",
          className: "initiative-detail__brand",
          "data-region": "brand-lockup",
          "aria-label": "TCRN AOS Initiative Detail"
        }),
        variant: "quiet"
      },
      createElement("span", { className: "initiative-detail__brand-mark", "aria-hidden": "true" }, "AOS"),
      createElement(
        "span",
        { className: "initiative-detail__brand-text" },
        createElement(Text, { ...packageAttrs("Text", { className: "initiative-detail__brand-kicker" }) }, "TCRN"),
        createElement(Text, { ...packageAttrs("Text", { className: "initiative-detail__brand-name" }) }, "Initiative Detail")
      )
    ),
    createElement(
      NavGroup,
      { ...packageAttrs("NavGroup", { className: "initiative-detail__nav-group" }), label: "AOS workspace pages" },
      navItems.map((item) =>
        createElement(
          NavItem,
          {
            ...packageAttrs("NavItem", {
              key: item.label,
              href: item.href,
              iconName: item.iconName,
              selected: item.selected,
              className: "initiative-detail__nav-item"
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
          className: "initiative-detail__nav-note",
          "data-region": "initiative-detail-local-mode"
        }),
        className: "initiative-detail__nav-note tcrn-text--muted"
      },
      "Local service preview"
    )
  );
}

function renderTopbar(model: InitiativeDetailModel) {
  return createElement(
    "header",
    packageAttrs("TopBar", {
      className: "initiative-detail__topbar",
      "data-region": "initiative-detail-topbar"
    }),
    createElement(TopBar, {
      productName: "TCRN AOS",
      moduleName: "Initiative Detail",
      actions: createElement(
        "div",
        { className: "initiative-detail__topbar-controls" },
        createElement(
          "label",
          { className: "initiative-detail__select-field" },
          createElement(Text, { ...packageAttrs("Text", { className: "tcrn-text--muted initiative-detail__field-label" }) }, "Project"),
          createElement(Select, {
            ...packageAttrs("Select", { id: "initiative-detail-project-select", "aria-label": "Project" }),
            value: model.context.projectId,
            disabled: true,
            disabledReason: "Project switching is read-only in this local detail preview.",
            options: [{ label: model.context.projectId, value: model.context.projectId }]
          })
        ),
        createElement(
          Button,
          {
            ...packageAttrs("Button"),
            variant: "secondary",
            disabled: true,
            disabledReason: "Refresh is available from the Operations Cockpit while this detail page stays in local preview mode."
          },
          "Refresh"
        )
      )
    }),
    createElement(
      "div",
      { className: "initiative-detail__topbar-copy" },
      createElement(Heading, { ...packageAttrs("Heading"), level: 1 }, "Initiative Detail"),
      createElement(Text, { ...packageAttrs("Text", { className: "tcrn-text--muted" }) }, "Ticket state, assignee context, linked records, decisions, and activity from the local service model.")
    )
  );
}

function renderSummary(model: InitiativeDetailModel) {
  return createElement(
    "section",
    { className: "initiative-detail__summary", "data-region": "initiative-detail-summary" },
    createElement(
      Surface,
      { ...packageAttrs("Surface", { className: "initiative-detail__hero" }) },
      createElement(Badge, { ...packageAttrs("Badge"), tone: "positive" }, "Ticket Drill-through"),
      createElement(Heading, { ...packageAttrs("Heading"), level: 2 }, model.ticket.title),
      createElement(Text, { ...packageAttrs("Text", { className: "tcrn-text--muted" }) }, model.targetSet.detail),
      createElement(
        "div",
        packageAttrs("EvidenceStrip", { className: "initiative-detail__evidence-strip" }),
        createElement(EvidenceStrip, {
          items: [
            "Service model: Local preview",
            `Gate links: ${model.ticket.gateCount}`,
            `Evidence links: ${model.ticket.evidenceCount}`,
            "Live actions: Not enabled"
          ]
        })
      )
    ),
    createElement(
      Surface,
      { ...packageAttrs("Surface", { className: "initiative-detail__status" }) },
      createElement(Heading, { ...packageAttrs("Heading"), level: 2 }, "Detail Status"),
      renderKeyValueList([
        { key: "source", label: "Source", value: "Local service preview" },
        { key: "schema", label: "Schema", value: model.context.sourceSchema },
        { key: "ticket-state", label: "Ticket state", value: createElement(StatusBadge, { ...packageAttrs("StatusBadge"), state: copyStateFor(model.ticket.status) }) },
        { key: "owner", label: "Owner", value: model.ticket.owner },
        { key: "publication", label: "Publication", value: "Not enabled" }
      ])
    )
  );
}

function renderTicket(model: InitiativeDetailModel) {
  return createElement(
    "section",
    { className: "initiative-detail__ticket", "data-region": "initiative-detail-ticket" },
    createElement(
      "div",
      packageAttrs("DetailDrawer", { className: "initiative-detail__detail-drawer" }),
      createElement(
        DetailDrawer,
        { title: "Selected Ticket", open: true },
        createElement(StatusBadge, { ...packageAttrs("StatusBadge"), state: copyStateFor(model.ticket.status) }),
        createElement(Heading, { ...packageAttrs("Heading"), level: 2 }, model.ticket.title),
        renderKeyValueList([
          { key: "story", label: "Story", value: model.ticket.storyId },
          { key: "initiative", label: "Initiative", value: model.context.initiativeId },
          { key: "epic", label: "Epic", value: model.context.epicTitle },
          { key: "owner", label: "Owner", value: model.ticket.owner },
          { key: "thread", label: "Thread", value: model.ticket.thread },
          { key: "freshness", label: "Freshness", value: presentAosCopyState(model.ticket.freshness).label },
          { key: "blocker", label: "Blocker", value: model.ticket.blocker }
        ])
      )
    ),
    createElement(
      "div",
      packageAttrs("ReadbackPanel", { className: "initiative-detail__service-panel" }),
      createElement(
        ReadbackPanel,
        { title: "Service Status" },
        renderKeyValueList(model.serviceOverview.map((item) => ({ key: item.label.toLowerCase().replace(/[^a-z0-9]+/g, "-"), label: item.label, value: item.value })))
      )
    )
  );
}

function renderLinks(model: InitiativeDetailModel) {
  const rows = model.links.map((link) => ({
    type: link.type,
    label: link.label,
    target: link.target,
    state: link.state
  }));

  return createElement(
    "section",
    { className: "initiative-detail__links", "data-region": "initiative-detail-links" },
    createElement(
      Surface,
      { ...packageAttrs("Surface") },
      createElement("div", { className: "initiative-detail__section-heading" }, createElement(Heading, { ...packageAttrs("Heading"), level: 2 }, "Linked Records")),
      createElement(
        "div",
        packageAttrs("TableShell", { className: "initiative-detail__table-shell" }),
        createElement(TableShell, {
          label: "Initiative detail linked records",
          columns: [
            { key: "type", label: "Type" },
            { key: "label", label: "Label" },
            { key: "target", label: "Target" },
            { key: "state", label: "State" }
          ],
          rows,
          emptyState: "No linked records are available from the local service preview."
        })
      )
    )
  );
}

function renderActivity(model: InitiativeDetailModel) {
  return createElement(
    "section",
    { className: "initiative-detail__activity", "data-region": "initiative-detail-activity" },
    createElement(
      Surface,
      { ...packageAttrs("Surface") },
      createElement(Heading, { ...packageAttrs("Heading"), level: 2 }, "Decisions"),
      createElement(
        "div",
        { className: "initiative-detail__activity-list" },
        model.decisions.map((decision) =>
          createElement(
            "article",
            { key: decision.label, className: "initiative-detail__activity-item" },
            createElement(Badge, { ...packageAttrs("Badge"), tone: "neutral" }, decision.label),
            createElement(Text, { ...packageAttrs("Text", { className: "initiative-detail__strong" }) }, decision.state),
            createElement(Text, { ...packageAttrs("Text", { className: "tcrn-text--muted" }) }, decision.summary)
          )
        )
      )
    ),
    createElement(
      Surface,
      { ...packageAttrs("Surface") },
      createElement(Heading, { ...packageAttrs("Heading"), level: 2 }, "Activity Notes"),
      createElement(
        "div",
        { className: "initiative-detail__activity-list" },
        model.activity.map((item) =>
          createElement(
            "article",
            { key: item.label, className: "initiative-detail__activity-item" },
            createElement(Badge, { ...packageAttrs("Badge"), tone: "neutral" }, item.label),
            createElement(Text, { ...packageAttrs("Text", { className: "tcrn-text--muted" }) }, item.summary)
          )
        )
      )
    )
  );
}

function renderUnavailableActions(model: InitiativeDetailModel) {
  return createElement(
    "section",
    { className: "initiative-detail__actions", "data-region": "initiative-detail-actions", "aria-label": "Unavailable ticket actions" },
    createElement(Heading, { ...packageAttrs("Heading"), level: 2 }, "Unavailable Actions"),
    createElement(
      "div",
      { className: "initiative-detail__action-list" },
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

export function renderInitiativeDetailRuntimeSurface(model: InitiativeDetailModel): string {
  return renderToStaticMarkup(
    createElement(
      "main",
      {
        className: "initiative-detail",
        "data-surface": "initiative-detail",
        "data-design-system-consumer": "tcrn-aos",
        "data-ds-standard-ids": initiativeDetailDsStandardIds.join(" "),
        "data-ds-storybook-ids": initiativeDetailStorybookIds.join(" "),
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
        { className: "initiative-detail__content", "data-region": "initiative-detail-shell" },
        renderTopbar(model),
        renderSummary(model),
        renderTicket(model),
        renderLinks(model),
        renderActivity(model),
        renderUnavailableActions(model)
      )
    )
  );
}
