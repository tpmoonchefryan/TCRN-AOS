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
import type { ProjectWorkspaceModel } from "./project-workspace-data.js";
import { projectWorkspaceDsStandardIds, projectWorkspaceStorybookIds } from "./project-workspace-data.js";
import { aosDesignSystemConsumerBridge, presentAosCopyState } from "./design-system-bridge.js";

const createElement = React.createElement as unknown as (type: unknown, props?: Record<string, unknown> | null, ...children: unknown[]) => React.ReactElement;

export const projectWorkspaceRuntimeScope = {
  route: "project-workspace",
  publicPackage: "@tcrn/ui-react",
  standards: projectWorkspaceDsStandardIds,
  storybookIds: projectWorkspaceStorybookIds,
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
  if (status === "review_required" || status === "in_review") return { state: "external_proof_needed", label: presentAosCopyState(status).label };
  if (status === "pending_external_proof") return { state: "external_proof_needed", label: "Needs review" };
  if (status === "done" || status === "complete" || status === "current" || status === "accepted" || status === "verified" || status === "released") return { state: "ready", label: presentAosCopyState(status).label };
  if (status === "active" || status === "in_progress" || status === "proposed") return { state: "local_only", label: presentAosCopyState(status).label };
  return { state: "unknown", label: presentAosCopyState(status).label };
}

function renderKeyValueList(items: Array<{ key: string; label: string; value: React.ReactNode }>) {
  return createElement("div", packageAttrs("KeyValueList"), createElement(KeyValueList, { items }));
}

function renderSidebar() {
  const navItems = [
    { label: "Operations Cockpit", href: "/operations-cockpit.html", iconName: "panel-left-open" },
    { label: "Project Workspace", href: "/project-workspace.html", iconName: "home", selected: true },
    { label: "Docs Readiness", href: "/docs-search-release-readiness.html", iconName: "book-open" },
    { label: "Product Design", href: "/aos-wide-product-design.html", iconName: "package" }
  ];

  return createElement(
    SideNav,
    {
      ...packageAttrs("SideNav", {
        className: "project-workspace__nav",
        "data-region": "project-workspace-nav"
      }),
      label: "AOS product navigation"
    },
    createElement(
      LinkButton,
      {
        ...packageAttrs("LinkButton", {
          href: "/project-workspace.html",
          className: "project-workspace__brand",
          "data-region": "brand-lockup",
          "aria-label": "TCRN AOS Project Workspace"
        }),
        variant: "quiet"
      },
      createElement("span", { className: "project-workspace__brand-mark", "aria-hidden": "true" }, "AOS"),
      createElement(
        "span",
        { className: "project-workspace__brand-text" },
        createElement(Text, { ...packageAttrs("Text", { className: "project-workspace__brand-kicker" }) }, "TCRN"),
        createElement(Text, { ...packageAttrs("Text", { className: "project-workspace__brand-name" }) }, "Project Workspace")
      )
    ),
    createElement(
      NavGroup,
      { ...packageAttrs("NavGroup", { className: "project-workspace__nav-group" }), label: "AOS workspace pages" },
      navItems.map((item) =>
        createElement(
          NavItem,
          {
            ...packageAttrs("NavItem", {
              key: item.label,
              href: item.href,
              iconName: item.iconName,
              selected: item.selected,
              className: "project-workspace__nav-item"
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
          className: "project-workspace__nav-note",
          "data-region": "project-workspace-local-mode"
        }),
        className: "project-workspace__nav-note tcrn-text--muted"
      },
      "Local service preview"
    )
  );
}

function renderTopbar(model: ProjectWorkspaceModel) {
  return createElement(
    "header",
    packageAttrs("TopBar", {
      className: "project-workspace__topbar",
      "data-region": "project-workspace-topbar"
    }),
    createElement(TopBar, {
      productName: "TCRN AOS",
      moduleName: "Project Workspace",
      actions: createElement(
        "div",
        { className: "project-workspace__topbar-controls" },
        createElement(
          "label",
          { className: "project-workspace__select-field" },
          createElement(Text, { ...packageAttrs("Text", { className: "tcrn-text--muted project-workspace__field-label" }) }, "Project"),
          createElement(Select, {
            ...packageAttrs("Select", { id: "project-workspace-project-select", "aria-label": "Project" }),
            value: model.context.projectId,
            disabled: true,
            disabledReason: "Project switching is read-only in this local workspace preview.",
            options: [{ label: model.context.projectId, value: model.context.projectId }]
          })
        ),
        createElement(
          Button,
          {
            ...packageAttrs("Button"),
            variant: "secondary",
            disabled: true,
            disabledReason: "Refresh is available from the Operations Cockpit while this workspace stays in local preview mode."
          },
          "Refresh"
        )
      )
    }),
    createElement(
      "div",
      { className: "project-workspace__topbar-copy" },
      createElement(Heading, { ...packageAttrs("Heading"), level: 1 }, "Project Workspace"),
      createElement(Text, { ...packageAttrs("Text", { className: "tcrn-text--muted" }) }, "Project dashboard, hierarchy, and current work from the local service model.")
    )
  );
}

function renderSummary(model: ProjectWorkspaceModel) {
  return createElement(
    "section",
    { className: "project-workspace__summary", "data-region": "project-workspace-summary" },
    createElement(
      Surface,
      { ...packageAttrs("Surface", { className: "project-workspace__hero" }) },
      createElement(Badge, { ...packageAttrs("Badge"), tone: "positive" }, "Project Dashboard"),
      createElement(Heading, { ...packageAttrs("Heading"), level: 2 }, model.hierarchy.project),
      createElement(Text, { ...packageAttrs("Text", { className: "tcrn-text--muted" }) }, model.targetSet.detail),
      createElement(
        "div",
        packageAttrs("EvidenceStrip", { className: "project-workspace__evidence-strip" }),
        createElement(EvidenceStrip, { items: ["Service model: Local preview", "Runtime data: Local only", "Live actions: Not enabled"] })
      )
    ),
    createElement(
      Surface,
      { ...packageAttrs("Surface", { className: "project-workspace__status" }) },
      createElement(Heading, { ...packageAttrs("Heading"), level: 2 }, "Workspace Status"),
      renderKeyValueList([
        { key: "source", label: "Source", value: model.context.sourceMode === "local_service_preview" ? "Local service preview" : model.context.sourceMode },
        { key: "schema", label: "Schema", value: model.context.sourceSchema },
        { key: "stories", label: "Stories", value: String(model.hierarchy.storyCount) },
        { key: "blocked", label: "Blocked", value: String(model.hierarchy.blockedStoryCount) },
        { key: "publication", label: "Publication", value: "Not enabled" }
      ])
    )
  );
}

function renderHierarchy(model: ProjectWorkspaceModel) {
  return createElement(
    "section",
    { className: "project-workspace__hierarchy", "data-region": "project-workspace-hierarchy" },
    createElement(
      Surface,
      { ...packageAttrs("Surface") },
      createElement("div", { className: "project-workspace__section-heading" }, createElement(Heading, { ...packageAttrs("Heading"), level: 2 }, "Project Hierarchy")),
      createElement(
        "ol",
        { className: "project-workspace__hierarchy-list" },
        [
          ["Project", model.hierarchy.project],
          ["Initiative", model.hierarchy.initiative],
          ["Epic", model.hierarchy.epic],
          ["Stories", `${model.hierarchy.storyCount} visible`]
        ].map(([label, value]) =>
          createElement(
            "li",
            { key: label, className: "project-workspace__hierarchy-node" },
            createElement(Badge, { ...packageAttrs("Badge"), tone: "neutral" }, label),
            createElement(Text, { ...packageAttrs("Text", { className: "project-workspace__strong" }) }, value)
          )
        )
      )
    ),
    createElement(
      Surface,
      { ...packageAttrs("Surface") },
      createElement(Heading, { ...packageAttrs("Heading"), level: 2 }, "Stage Overview"),
      createElement(
        "div",
        { className: "project-workspace__stage-list" },
        model.stageSummary.map((stage) =>
          createElement(
            "article",
            { key: stage.id, className: "project-workspace__stage-item" },
            createElement(Text, { ...packageAttrs("Text", { className: "project-workspace__strong" }) }, stage.label),
            createElement(StatusBadge, { ...packageAttrs("StatusBadge"), state: copyStateFor(stage.state) }),
            createElement(Text, { ...packageAttrs("Text", { className: "tcrn-text--muted" }) }, stage.blockers.length > 0 ? stage.blockers.join("; ") : "No blocker recorded")
          )
        )
      )
    )
  );
}

function renderWorkIndex(model: ProjectWorkspaceModel) {
  const rows = model.stories.map((story) => ({
    story: story.title,
    state: createElement(StatusBadge, { ...packageAttrs("StatusBadge"), state: copyStateFor(story.status) }),
    owner: story.owner,
    blocker: story.blocker,
    evidence: String(story.linkedEvidenceCount)
  }));

  return createElement(
    "section",
    { className: "project-workspace__index", "data-region": "project-workspace-index" },
    createElement(
      Surface,
      { ...packageAttrs("Surface") },
      createElement("div", { className: "project-workspace__section-heading" }, createElement(Heading, { ...packageAttrs("Heading"), level: 2 }, "Work Index")),
      createElement(
        "div",
        packageAttrs("TableShell", { className: "project-workspace__table-shell" }),
        createElement(TableShell, {
          label: "Project workspace work index",
          columns: [
            { key: "story", label: "Story" },
            { key: "state", label: "State" },
            { key: "owner", label: "Owner" },
            { key: "blocker", label: "Blocker" },
            { key: "evidence", label: "Evidence" }
          ],
          rows,
          emptyState: "No work items are available from the local service preview."
        })
      )
    )
  );
}

function renderDetail(model: ProjectWorkspaceModel) {
  return createElement(
    "section",
    { className: "project-workspace__detail", "data-region": "project-workspace-detail" },
    createElement(
      "div",
      packageAttrs("DetailDrawer", { className: "project-workspace__detail-drawer" }),
      createElement(
        DetailDrawer,
        { title: "Selected Work", open: true },
        createElement(StatusBadge, { ...packageAttrs("StatusBadge"), state: copyStateFor(model.selectedStory.status) }),
        createElement(Heading, { ...packageAttrs("Heading"), level: 2 }, model.selectedStory.title),
        renderKeyValueList([
          { key: "story", label: "Story", value: model.selectedStory.id },
          { key: "owner", label: "Owner", value: model.selectedStory.owner },
          { key: "freshness", label: "Freshness", value: presentAosCopyState(model.selectedStory.freshness).label },
          { key: "gate-links", label: "Gate links", value: String(model.selectedStory.linkedGateCount) },
          { key: "evidence-links", label: "Evidence links", value: String(model.selectedStory.linkedEvidenceCount) },
          { key: "blocker", label: "Blocker", value: model.selectedStory.blocker }
        ])
      )
    ),
    createElement(
      "div",
      packageAttrs("ReadbackPanel", { className: "project-workspace__readiness" }),
      createElement(
        ReadbackPanel,
        { title: "Service Status" },
        renderKeyValueList(model.evidenceOverview.map((item) => ({ key: item.label.toLowerCase().replace(/[^a-z0-9]+/g, "-"), label: item.label, value: item.value })))
      )
    )
  );
}

function renderUnavailableActions(model: ProjectWorkspaceModel) {
  return createElement(
    "section",
    { className: "project-workspace__actions", "data-region": "project-workspace-actions", "aria-label": "Unavailable workspace actions" },
    createElement(Heading, { ...packageAttrs("Heading"), level: 2 }, "Unavailable Actions"),
    createElement(
      "div",
      { className: "project-workspace__action-list" },
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

export function renderProjectWorkspaceRuntimeSurface(model: ProjectWorkspaceModel): string {
  return renderToStaticMarkup(
    createElement(
      "main",
      {
        className: "project-workspace",
        "data-surface": "project-workspace",
        "data-design-system-consumer": "tcrn-aos",
        "data-ds-standard-ids": projectWorkspaceDsStandardIds.join(" "),
        "data-ds-storybook-ids": projectWorkspaceStorybookIds.join(" "),
        "data-product-acceptance": "false",
        "data-final-mvp-acceptance": "false",
        "data-release-publication": "false",
        "data-owner-intent-execution": "false",
        "data-live-dispatch": "false"
      },
      renderSidebar(),
      createElement(
        "div",
        { className: "project-workspace__content", "data-region": "project-workspace-shell" },
        renderTopbar(model),
        renderSummary(model),
        renderHierarchy(model),
        renderWorkIndex(model),
        renderDetail(model),
        renderUnavailableActions(model)
      )
    )
  );
}
