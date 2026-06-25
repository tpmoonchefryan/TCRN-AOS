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
import type { ConferenceModel } from "./conference-data.js";
import { conferenceDsStandardIds, conferenceStorybookIds } from "./conference-data.js";

const createElement = React.createElement as unknown as (type: unknown, props?: Record<string, unknown> | null, ...children: unknown[]) => React.ReactElement;

const packageAttrs = (component: string, extra: Record<string, unknown> = {}) => ({
  "data-tcrn-component": component,
  "data-package-runtime-component": component,
  "data-design-system-consumer": "tcrn-aos",
  ...extra
});

function copyStateFor(status: string) {
  if (status === "blocked") return { state: "blocked", label: "Blocked" };
  if (status === "collecting_positions" || status === "requested") return { state: "external_proof_needed", label: status === "requested" ? "Requested" : "Collecting positions" };
  if (status === "closed") return { state: "ready", label: "Closed locally" };
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
    { label: "Gate Queue", href: "/gate-queue.html", iconName: "check" },
    { label: "Conference", href: "/conference.html", iconName: "book-open", selected: true },
    { label: "Dependency Console", href: "/dependency-console.html", iconName: "package" },
    { label: "Docs Readiness", href: "/docs-search-release-readiness.html", iconName: "book-open" },
    { label: "Product Design", href: "/aos-wide-product-design.html", iconName: "package" }
  ];

  return createElement(
    SideNav,
    {
      ...packageAttrs("SideNav", {
        className: "conference__nav",
        "data-region": "conference-nav"
      }),
      label: "AOS product navigation"
    },
    createElement(
      LinkButton,
      {
        ...packageAttrs("LinkButton", {
          href: "/conference.html",
          className: "conference__brand",
          "data-region": "brand-lockup",
          "aria-label": "TCRN AOS Conference"
        }),
        variant: "quiet"
      },
      createElement("span", { className: "conference__brand-mark", "aria-hidden": "true" }, "AOS"),
      createElement(
        "span",
        { className: "conference__brand-text" },
        createElement(Text, { ...packageAttrs("Text", { className: "conference__brand-kicker" }) }, "TCRN"),
        createElement(Text, { ...packageAttrs("Text", { className: "conference__brand-name" }) }, "Conference")
      )
    ),
    createElement(
      NavGroup,
      { ...packageAttrs("NavGroup", { className: "conference__nav-group" }), label: "AOS workspace pages" },
      navItems.map((item) =>
        createElement(
          NavItem,
          {
            ...packageAttrs("NavItem", {
              key: item.label,
              href: item.href,
              iconName: item.iconName,
              selected: item.selected,
              className: "conference__nav-item"
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
          className: "conference__nav-note",
          "data-region": "conference-local-mode"
        })
      },
      "Local service preview"
    )
  );
}

function renderTopbar(model: ConferenceModel) {
  return createElement(
    "header",
    packageAttrs("TopBar", {
      className: "conference__topbar",
      "data-region": "conference-topbar"
    }),
    createElement(TopBar, {
      productName: "TCRN AOS",
      moduleName: "Conference",
      actions: createElement(
        "div",
        { className: "conference__topbar-controls" },
        createElement(
          "label",
          { className: "conference__select-field" },
          createElement(Text, { ...packageAttrs("Text", { className: "tcrn-text--muted conference__field-label" }) }, "Project"),
          createElement(Select, {
            ...packageAttrs("Select", { id: "conference-project-select", "aria-label": "Project" }),
            value: model.context.projectId,
            disabled: true,
            disabledReason: "Project switching is read-only in this local conference preview.",
            options: [{ label: model.context.projectId, value: model.context.projectId }]
          })
        ),
        createElement(
          Button,
          {
            ...packageAttrs("Button"),
            variant: "secondary",
            disabled: true,
            disabledReason: "Refresh is available from the Operations Cockpit while this conference page stays in local preview mode."
          },
          "Refresh"
        )
      )
    }),
    createElement(
      "div",
      { className: "conference__topbar-copy" },
      createElement(Heading, { ...packageAttrs("Heading"), level: 1 }, "Conference"),
      createElement(Text, { ...packageAttrs("Text", { className: "tcrn-text--muted" }) }, "Conference list, detail, agenda, and minutes posture from the local service model.")
    )
  );
}

function renderSummary(model: ConferenceModel) {
  return createElement(
    "section",
    { className: "conference__summary", "data-region": "conference-summary" },
    createElement(
      Surface,
      { ...packageAttrs("Surface", { className: "conference__hero" }) },
      createElement(Badge, { ...packageAttrs("Badge"), tone: "positive" }, "Conference"),
      createElement(Heading, { ...packageAttrs("Heading"), level: 2 }, model.selectedConference.title),
      createElement(Text, { ...packageAttrs("Text", { className: "tcrn-text--muted" }) }, model.targetSet.detail),
      createElement(
        "div",
        packageAttrs("EvidenceStrip", { className: "conference__evidence-strip" }),
        createElement(EvidenceStrip, {
          items: [
            `${model.summary.conferenceCount} conference rows`,
            `${model.summary.readyForMinutesCount} minutes-ready`,
            `${model.summary.linkedEvidenceCount} evidence links`,
            "Live actions: Not enabled"
          ]
        })
      )
    ),
    createElement(
      Surface,
      { ...packageAttrs("Surface", { className: "conference__status" }) },
      createElement(Heading, { ...packageAttrs("Heading"), level: 2 }, "Conference Status"),
      renderKeyValueList([
        { key: "source", label: "Source", value: "Local service preview" },
        { key: "schema", label: "Schema", value: model.context.sourceSchema },
        { key: "minutes-ready", label: "Minutes ready", value: String(model.summary.readyForMinutesCount) },
        { key: "missing-participants", label: "Missing participants", value: String(model.summary.missingParticipantCount) },
        { key: "execution", label: "Execution", value: "Not enabled" }
      ])
    )
  );
}

function renderConferenceList(model: ConferenceModel) {
  const rows = model.conferences.map((conference) => ({
    title: conference.title,
    initiator: conference.initiator,
    participants: `${conference.participants.length} total`,
    minutes: conference.minutesStatusLabel,
    state: createElement(StatusBadge, { ...packageAttrs("StatusBadge"), state: copyStateFor(conference.status) }),
    evidence: String(conference.linkedEvidenceIds.length)
  }));

  return createElement(
    "section",
    { className: "conference__list", "data-region": "conference-list" },
    createElement(
      Surface,
      { ...packageAttrs("Surface") },
      createElement("div", { className: "conference__section-heading" }, createElement(Heading, { ...packageAttrs("Heading"), level: 2 }, "Conference List")),
      createElement(
        "div",
        packageAttrs("TableShell", { className: "conference__table-shell" }),
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
          rows,
          emptyState: "No conference rows are available from the local service preview."
        })
      )
    )
  );
}

function renderDetail(model: ConferenceModel) {
  return createElement(
    "section",
    { className: "conference__detail", "data-region": "conference-detail" },
    createElement(
      "div",
      packageAttrs("DetailDrawer", { className: "conference__detail-drawer" }),
      createElement(
        DetailDrawer,
        { title: "Selected Conference", open: true },
        createElement(StatusBadge, { ...packageAttrs("StatusBadge"), state: copyStateFor(model.selectedConference.status) }),
        createElement(Heading, { ...packageAttrs("Heading"), level: 2 }, model.selectedConference.title),
        renderKeyValueList([
          { key: "initiator", label: "Initiator", value: model.selectedConference.initiator },
          { key: "participants", label: "Participants", value: model.selectedConference.participants.join(", ") || "No participants recorded" },
          { key: "missing", label: "Missing participants", value: model.selectedConference.missingParticipants.join(", ") || "None" },
          { key: "stories", label: "Linked stories", value: model.selectedConference.linkedStoryTitles.join(", ") || "No linked story" },
          { key: "minutes-status", label: "Minutes status", value: model.selectedConference.minutesStatusLabel },
          { key: "decision-class", label: "Decision class", value: model.selectedConference.decisionClassLabel },
          { key: "outcome", label: "Desired outcome", value: model.selectedConference.desiredOutcome },
          { key: "minutes-summary", label: "Minutes summary", value: model.selectedConference.minutesSummary }
        ])
      )
    ),
    createElement(
      "div",
      packageAttrs("ReadbackPanel", { className: "conference__service", "data-region": "conference-service" }),
      createElement(
        ReadbackPanel,
        { title: "Service Status" },
        renderKeyValueList(model.serviceOverview.map((item) => ({ key: item.label.toLowerCase().replace(/[^a-z0-9]+/g, "-"), label: item.label, value: item.value })))
      )
    )
  );
}

function renderUnavailableActions(model: ConferenceModel) {
  return createElement(
    "section",
    { className: "conference__actions", "data-region": "conference-actions", "aria-label": "Unavailable conference actions" },
    createElement(Heading, { ...packageAttrs("Heading"), level: 2 }, "Unavailable Actions"),
    createElement(
      "div",
      { className: "conference__action-list" },
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

export function renderConferenceRuntimeSurface(model: ConferenceModel): string {
  return renderToStaticMarkup(
    createElement(
      "main",
      {
        className: "conference",
        "data-surface": "conference",
        "data-design-system-consumer": "tcrn-aos",
        "data-ds-standard-ids": conferenceDsStandardIds.join(" "),
        "data-ds-storybook-ids": conferenceStorybookIds.join(" "),
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
        { className: "conference__content", "data-region": "conference-shell" },
        renderTopbar(model),
        renderSummary(model),
        renderConferenceList(model),
        renderDetail(model),
        renderUnavailableActions(model)
      )
    )
  );
}
