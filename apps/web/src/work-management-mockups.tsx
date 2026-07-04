import type { ReactNode } from "react";
import {
  Badge,
  Button,
  EvidenceAttachmentList,
  EvidenceStrip,
  GatePipeline,
  Heading,
  LinkButton,
  MachineToken,
  RelationshipChip,
  SavedViewToolbar,
  StatusBadge,
  Surface,
  TableShell,
  Text,
  WorkBoard,
  WorkHierarchy,
  WorkIndex,
  WorkItemInspector,
  WorkManagementSubnav,
  workManagementPatternRegistry,
  type EvidenceAttachment,
  type GatePipelineGate,
  type RelationshipChipProps,
  type SavedViewToolbarFilter,
  type WorkBoardLane,
  type WorkHierarchyEdge,
  type WorkHierarchyNode,
  type WorkIndexRow
} from "@tcrn/ui-react";
import type { TcrnLocale } from "@tcrn/ui-copy-state";

type WorkMockupPageId =
  | "queue"
  | "board"
  | "backlog"
  | "detail"
  | "gates"
  | "evidence"
  | "codexActivity"
  | "ownerFeedbackView"
  | "initiativeGraph";

interface WorkMockupPage {
  id: WorkMockupPageId;
  path: string;
  title: Record<"en" | "zh-CN", string>;
  eyebrow: Record<"en" | "zh-CN", string>;
  description: Record<"en" | "zh-CN", string>;
}

interface WorkManagementMockupsProps {
  path: string;
  locale: TcrnLocale;
  theme: "light" | "dark";
  collapsed: boolean;
  variant: string;
  routeHref: (path: string) => string;
}

type GateState = "pending" | "passed" | "changes_requested" | "blocked" | "accepted" | "not_started";

interface WorkItemFixture {
  key: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  product: string;
  module: string;
  initiative: string;
  epic: string;
  epicKind: "Capability Epic" | "Workstream Epic";
  story: string;
  owner: string;
  assignee: string;
  nextOwner: string;
  gate: string;
  blocker: string;
  updated: string;
}

interface RegisteredDsWorkComponentFixture {
  componentName: string;
  candidateId: string;
  purpose: string;
  whereUsed: string;
  consumptionDisposition: string;
  dsLevel: "primitive" | "pattern" | "composite";
}

const workPages: WorkMockupPage[] = [
  {
    id: "queue",
    path: "/work",
    title: { en: "Work queue", "zh-CN": "工作队列" },
    eyebrow: { en: "Current work", "zh-CN": "当前工作" },
    description: {
      en: "Prioritized work items across owner feedback, implementation, gates, evidence, and PM readiness.",
      "zh-CN": "按 owner 反馈、实现、门禁、证据和 PM readiness 聚合的优先工作项。"
    }
  },
  {
    id: "board",
    path: "/work/board",
    title: { en: "Work Board", "zh-CN": "工作看板" },
    eyebrow: { en: "Lifecycle view", "zh-CN": "生命周期视图" },
    description: {
      en: "Static board lanes separate work status from gate status so superseded evidence stays visible.",
      "zh-CN": "静态看板将工作状态与门禁状态分离，保留被 supersede 的证据脉络。"
    }
  },
  {
    id: "backlog",
    path: "/work/backlog",
    title: { en: "Backlog", "zh-CN": "待整理" },
    eyebrow: { en: "Unshaped input", "zh-CN": "待整理输入" },
    description: {
      en: "Owner feedback and route returns waiting for PM shaping before they become executable Work Items.",
      "zh-CN": "等待 PM 收敛的 owner 反馈与 route return，尚未成为可执行工作项。"
    }
  },
  {
    id: "detail",
    path: "/work/items/AOS-128",
    title: { en: "AOS-128 Work Item Detail", "zh-CN": "AOS-128 工作项详情" },
    eyebrow: { en: "Owner feedback item", "zh-CN": "Owner 反馈工作项" },
    description: {
      en: "A single Work Item keeps hierarchy, gates, evidence, Codex routes, blockers, and no-overclaim flags together.",
      "zh-CN": "单个工作项串联层级、门禁、证据、Codex route、阻塞项和 no-overclaim 标记。"
    }
  },
  {
    id: "gates",
    path: "/work/gates",
    title: { en: "Gates", "zh-CN": "门禁聚合" },
    eyebrow: { en: "Review readiness", "zh-CN": "评审准备度" },
    description: {
      en: "Gate rows show what passed, what is blocked, and why owner inspection stays unavailable.",
      "zh-CN": "门禁行展示通过项、阻塞项，以及 owner inspection 仍不可用的原因。"
    }
  },
  {
    id: "evidence",
    path: "/work/evidence",
    title: { en: "Evidence", "zh-CN": "证据中心" },
    eyebrow: { en: "Proof library", "zh-CN": "证明库" },
    description: {
      en: "Screenshots, artifact directories, QA summaries, API readbacks, commits, and preview links attached to Work Items.",
      "zh-CN": "截图、artifact 目录、QA 摘要、API 读回、commit 和 preview 链接都挂接到工作项。"
    }
  },
  {
    id: "codexActivity",
    path: "/work/codex-activity",
    title: { en: "Codex Activity", "zh-CN": "Codex 活动" },
    eyebrow: { en: "Execution records", "zh-CN": "执行记录" },
    description: {
      en: "Routes, threads, handoff returns, monitors, and next owners are execution records attached to Work Items.",
      "zh-CN": "Route、线程、handoff return、监控和下一 owner 是挂在工作项下的执行记录。"
    }
  },
  {
    id: "ownerFeedbackView",
    path: "/work/views/owner-feedback",
    title: { en: "Owner Feedback View", "zh-CN": "Owner 反馈视图" },
    eyebrow: { en: "Saved view", "zh-CN": "保存视图" },
    description: {
      en: "A saved filter for owner feedback, QA blockers, superseded evidence, and PM readiness blockers.",
      "zh-CN": "保存过滤 owner 反馈、QA blocker、被 supersede 的证据和 PM readiness 阻塞项。"
    }
  },
  {
    id: "initiativeGraph",
    path: "/work/initiatives/work-management-mvp",
    title: { en: "Work Management MVP Graph", "zh-CN": "Work Management MVP 图谱" },
    eyebrow: { en: "Hierarchy and links", "zh-CN": "层级与关系" },
    description: {
      en: "Initiative, Epics, Stories, Work Items, Subtasks, Evidence Tasks, and relationship vocabulary in one static graph.",
      "zh-CN": "在一张静态图里展示 Initiative、Epic、Story、Work Item、Subtask、Evidence Task 与关系词汇。"
    }
  }
];

const workItems: WorkItemFixture[] = [
  {
    key: "AOS-128",
    title: "Remove unsupported global search",
    type: "Owner Feedback",
    status: "PM Changes Requested",
    priority: "High",
    product: "AOS",
    module: "Shell",
    initiative: "AOS product shell recovery",
    epic: "Product Shell Owner Feedback Recovery",
    epicKind: "Workstream Epic",
    story: "Owner can inspect an AOS shell without fake global search",
    owner: "Mara",
    assignee: "Ilya",
    nextOwner: "Ilya",
    gate: "PM freshness changes requested",
    blocker: "Stale basis/posture copy on refreshed retained preview",
    updated: "2026-07-01"
  },
  {
    key: "AOS-142",
    title: "Static Work Management PRD mockups",
    type: "Feature",
    status: "In Progress",
    priority: "High",
    product: "AOS",
    module: "Work",
    initiative: "Work Management MVP",
    epic: "Work Item Lifecycle",
    epicKind: "Capability Epic",
    story: "PM can discuss Work flows before API planning",
    owner: "Mara",
    assignee: "Ilya",
    nextOwner: "Elara",
    gate: "Static proof required",
    blocker: "No API integration by design",
    updated: "2026-07-01"
  },
  {
    key: "DS-88",
    title: "ProductShell optional search contract",
    type: "Design Review",
    status: "Done",
    priority: "Medium",
    product: "DS",
    module: "ProductShell",
    initiative: "AOS product shell recovery",
    epic: "Reusable Shell Standards",
    epicKind: "Capability Epic",
    story: "Products can omit topbar search when capability is absent",
    owner: "Elara",
    assignee: "Ilya",
    nextOwner: "AOS consumer",
    gate: "DS contract accepted",
    blocker: "None",
    updated: "2026-07-01"
  },
  {
    key: "AOS-144",
    title: "Owner inspection handoff package",
    type: "Release Gate",
    status: "PM Changes Requested",
    priority: "High",
    product: "AOS",
    module: "Owner Inspection",
    initiative: "AOS product shell recovery",
    epic: "Owner Inspection Package",
    epicKind: "Capability Epic",
    story: "Mara can prepare a bounded owner inspection package",
    owner: "Mara",
    assignee: "Mara",
    nextOwner: "Mara",
    gate: "PM freshness changes requested",
    blocker: "Retained 4317 is refreshed, but Mara requested a basis/posture copy repair before owner handoff.",
    updated: "2026-07-01"
  }
];

const relationRows = [
  { relation: "blocks", source: "AOS-144", target: "Owner Inspection Handoff", state: "active", note: "PM freshness is changes_requested after retained 4317 refresh; no owner handoff yet." },
  { relation: "blocked_by", source: "AOS-144", target: "AOS-142", state: "active", note: "Static discussion surface must be reviewed first." },
  { relation: "depends_on", source: "AOS-142", target: "DS-88", state: "resolved", note: "Uses DS optional-search contract." },
  { relation: "relates_to", source: "AOS-142", target: "Registered DS Work components", state: "active", note: "Consumes the admitted DS Work Management package patterns without API integration." },
  { relation: "duplicates", source: "Owner note: fake search", target: "AOS-128", state: "resolved", note: "Duplicate owner feedback merges into the no-global-search item." },
  { relation: "implements", source: "AOS-142", target: "Story: PM can discuss Work flows", state: "active", note: "Static routes implement the discussion surface only." },
  { relation: "verifies", source: "EVD-41", target: "AOS-128", state: "resolved", note: "AOS proof verifies no global search and URL locale." },
  { relation: "reviews", source: "ELR-23", target: "AOS-142", state: "resolved", note: "Elara rendered/DS review passed before the retained refresh." },
  { relation: "refreshes", source: "ATL-31", target: "AOS-142", state: "resolved", note: "Retained 4317 preview was refreshed to AOS cae4d52 before Mara PM freshness." },
  { relation: "supersedes", source: "AOS-128", target: "previous search-results claim", state: "resolved", note: "Fake search route claim replaced by no-search boundary." },
  { relation: "split_from", source: "AOS-142", target: "Work Management MVP", state: "active", note: "Static mockup slice split from full implementation planning." },
  { relation: "caused_by", source: "AOS-128", target: "Owner feedback: no fake search", state: "resolved", note: "Owner-approved scope change." }
];

const hierarchyDefinitionRows = [
  { layer: "Initiative", definition: "Initiative is the complete objective and why.", boundary: "Highest product/work goal." },
  { layer: "Epic", definition: "Epic is a larger deliverable work package.", boundary: "Capability Epic or Workstream Epic." },
  { layer: "Story", definition: "Story is the smallest acceptable human/business/workflow result.", boundary: "Not the execution ticket." },
  { layer: "Task / Work Item", definition: "Task / Work Item is the smallest executable ticket/task unit.", boundary: "Executable owner, proof, and gate unit." },
  { layer: "Subtask / Evidence Task", definition: "Subtask / Evidence Task is execution/proof detail.", boundary: "Supports a Work Item." },
  { layer: "Codex Activity", definition: "Codex Activity is execution/evidence context attached to Work Items, not a replacement for Story or Task / Work Item.", boundary: "Routes, threads, handoff returns, commits, proof, and blockers." }
];

const gateRows = [
  { gate: "DS Review", owner: "Elara", state: "accepted", evidence: "ProductShell optional search contract", next: "Accepted on the AOS rebuild basis" },
  { gate: "Implementation Proof", owner: "Ilya", state: "accepted", evidence: "Static route proof, screenshots, no API fixture", next: "Repair stale basis copy and return to Arturo" },
  { gate: "Atlas Refresh", owner: "Atlas", state: "accepted", evidence: "Retained 4317 preview route/API readback", next: "Refresh again only after this repair/review/QA pass" },
  { gate: "Elara Rendered Review", owner: "Elara", state: "accepted", evidence: "Owner-eye review of static Work mockups", next: "Re-review this focused basis copy repair" },
  { gate: "Rowan QA", owner: "Rowan", state: "accepted", evidence: "Browser matrix, mobile, no-overclaim proof", next: "QA retry after Elara accepts the repair" },
  { gate: "Mara PM Readiness", owner: "Mara", state: "changes_requested", evidence: "Retained 4317 PM freshness check", next: "Pending this focused source repair and next Atlas refresh" },
  { gate: "Owner Inspection Handoff", owner: "Mara", state: "not_started", evidence: "Bounded package draft only", next: "No owner handoff before PM freshness acceptance" }
];

const evidenceRows = [
  { id: "EVD-41", type: "Command proof", item: "AOS-128", source: "Ilya", artifact: "pnpm aos:frontend-shell-proof", status: "current" },
  { id: "EVD-42", type: "Screenshot", item: "AOS-142", source: "Ilya", artifact: "/tmp/tcrn-aos-shell-qa/work-*.png", status: "proof artifact target" },
  { id: "EVD-43", type: "QA summary", item: "AOS-144", source: "Rowan", artifact: "summary-final.json", status: "superseded by new scope" },
  { id: "EVD-44", type: "API readback", item: "AOS-128", source: "Atlas", artifact: "/api/cockpit 410 deferred", status: "current no-live posture" },
  { id: "EVD-45", type: "Commit", item: "DS-88", source: "Ilya", artifact: "01714b9", status: "current" },
  { id: "EVD-46", type: "Preview link", item: "AOS-142", source: "Atlas", artifact: "http://127.0.0.1:4317/", status: "retained refreshed; PM changes requested" }
];

const registeredDsWorkComponentRows: RegisteredDsWorkComponentFixture[] = workManagementPatternRegistry.map((item) => {
  const routeUse: Record<string, { whereUsed: string; consumptionDisposition: string }> = {
    WorkManagementSubnav: {
      whereUsed: "/work route set",
      consumptionDisposition: "Replaces local LinkButton route switcher with package WorkManagementSubnav."
    },
    WorkBoard: {
      whereUsed: "/work/board",
      consumptionDisposition: "Consumes package WorkBoard lanes and relationship chips instead of local Surface lane CSS."
    },
    WorkHierarchy: {
      whereUsed: "/work/initiatives/work-management-mvp",
      consumptionDisposition: "Consumes package WorkHierarchy graph/table fallback for Initiative to Evidence Task hierarchy."
    },
    RelationshipChip: {
      whereUsed: "/work, /work/items/AOS-128, /work/initiatives/work-management-mvp",
      consumptionDisposition: "Consumes package RelationshipChip for blocks, depends_on, verifies, reviews, refreshes, and related edges."
    },
    GatePipeline: {
      whereUsed: "/work/gates",
      consumptionDisposition: "Consumes package GatePipeline for review/readiness sequence without claiming PM or owner acceptance."
    },
    EvidenceAttachmentList: {
      whereUsed: "/work/evidence and /work/items/AOS-128",
      consumptionDisposition: "Consumes package EvidenceAttachmentList for screenshots, artifacts, QA summaries, API readbacks, commits, and previews."
    },
    WorkItemInspector: {
      whereUsed: "/work/items/AOS-128",
      consumptionDisposition: "Consumes package WorkItemInspector for hierarchy, status, subtasks, evidence tasks, and guarded actions."
    },
    SavedViewToolbar: {
      whereUsed: "/work/views/owner-feedback",
      consumptionDisposition: "Consumes package SavedViewToolbar for saved views and local filters without ProductShell global search."
    },
    MachineToken: {
      whereUsed: "/work/codex-activity, /work/evidence, and graph fallback",
      consumptionDisposition: "Consumes package MachineToken for long route, thread, commit, artifact, and work-item identifiers."
    }
  };
  const route = routeUse[item.componentName] ?? {
    whereUsed: "/work",
    consumptionDisposition: "Consumed from the registered DS Work Management package registry."
  };
  return {
    componentName: item.componentName,
    candidateId: item.candidateId,
    purpose: item.purpose,
    whereUsed: route.whereUsed,
    consumptionDisposition: route.consumptionDisposition,
    dsLevel: item.level
  };
});

const codexRows = [
  {
    route: "route_tcrn_aos_no_global_search_url_locale_ilya_implementation_after_owner_approval",
    routeLabel: "No global search + URL locale",
    routeToken: "route_tcrn_aos_no_global_search_url_locale",
    item: "AOS-128",
    thread: "Ilya",
    status: "success",
    next: "Atlas refresh"
  },
  {
    route: "route_tcrn_aos_work_management_static_mockups_ilya_after_owner_prd_review_4802c19",
    routeLabel: "Static Work mockups",
    routeToken: "route_tcrn_aos_work_management_mockups",
    item: "AOS-142",
    thread: "Ilya",
    status: "in progress",
    next: "Implementation return"
  },
  {
    route: "route_tcrn_aos_owner_topbar_utility_alignment_rowan_qa_retry_after_elara_acceptance",
    routeLabel: "Topbar utility QA retry",
    routeToken: "route_tcrn_aos_topbar_alignment_qa_retry",
    item: "AOS-144",
    thread: "Rowan",
    status: "superseded",
    next: "New QA required after mockups"
  }
];

function workSubnavItems(pageId: WorkMockupPageId, locale: TcrnLocale, routeHref: (path: string) => string) {
  const counts: Record<WorkMockupPageId, number> = {
    queue: 4,
    board: 6,
    backlog: 3,
    detail: 1,
    gates: 7,
    evidence: 6,
    codexActivity: 3,
    ownerFeedbackView: 2,
    initiativeGraph: 6
  };
  return workPages.map((page) => ({
    id: page.id,
    label: localized(page.title, locale),
    href: routeHref(page.path),
    current: page.id === pageId,
    count: counts[page.id]
  }));
}

function workBoardLanes(locale: TcrnLocale): WorkBoardLane[] {
  const lanes: WorkBoardLane[] = [
    {
      id: "backlog",
      title: "Backlog",
      cards: [
        {
          id: "AOS-142",
          title: "Rebuild Work routes with DS Work components",
          state: { state: "review_required" },
          owner: "Ilya",
          meta: translatePhrase("No API integration", locale),
          relationships: [{ relation: "implements", target: "Work Management MVP" }]
        },
        {
          id: "AOS-144",
          title: "Owner inspection handoff package",
          state: { state: "blocked" },
          owner: "Mara",
          meta: translatePhrase("PM freshness changes requested", locale),
          relationships: [{ relation: "blocked_by", target: "Mara PM Readiness" }]
        }
      ]
    },
    {
      id: "in-progress",
      title: "In Progress",
      cards: [
        {
          id: "AOS-128",
          title: "Remove unsupported global search",
          state: { state: "local_only" },
          owner: "Ilya",
          meta: translatePhrase("URL locale authority", locale),
          relationships: [{ relation: "verifies", target: "no-global-search" }]
        }
      ]
    },
    {
      id: "review",
      title: "Review",
      cards: [
        {
          id: "DS-88",
          title: "ProductShell optional search contract",
          state: { state: "local_only" },
          owner: "Elara",
          meta: translatePhrase("DS contract accepted", locale),
          relationships: [{ relation: "depends_on", target: "ProductShell" }]
        }
      ]
    },
    {
      id: "pm-readiness",
      title: "PM Readiness",
      cards: [
        {
          id: "PM-17",
          title: "AOS source-visible freshness check",
          state: { state: "blocked" },
          owner: "Mara",
          meta: translatePhrase("PM freshness changes requested", locale),
          relationships: [{ relation: "blocked_by", target: "Ilya basis repair" }]
        }
      ]
    }
  ];

  return lanes.map((lane) => ({
    ...lane,
    title: translateLane(lane.title, locale),
    cards: lane.cards.map((card) => ({
      ...card,
      title: translatePhrase(card.title, locale)
    }))
  }));
}

function workGatePipeline(locale: TcrnLocale): GatePipelineGate[] {
  return gateRows.map((row) => ({
    id: row.gate.toLowerCase().replace(/\s+/g, "-"),
    label: translatePhrase(row.gate, locale),
    owner: row.owner,
    state: row.state === "accepted"
      ? { state: "local_only", label: locale === "zh-CN" ? "已接受" : "Accepted" }
      : row.state === "blocked" || row.state === "changes_requested"
        ? { state: "blocked" }
        : row.state === "not_started"
          ? { state: "not_claimed" }
          : { state: "review_required", label: translatePhrase(row.state, locale) },
    evidence: [translatePhrase(row.evidence, locale)],
    nextAction: translatePhrase(row.next, locale)
  }));
}

function evidenceAttachments(locale: TcrnLocale): EvidenceAttachment[] {
  return evidenceRows.map((row) => ({
    id: row.id,
    type: row.type === "Screenshot"
      ? "screenshot"
      : row.type === "QA summary"
        ? "qa_summary"
        : row.type === "API readback"
          ? "api_readback"
          : row.type === "Commit"
            ? "commit"
            : row.type === "Preview link"
              ? "preview"
              : "artifact_dir",
    label: translatePhrase(row.type, locale),
    reference: row.artifact,
    state: row.status === "current"
      ? { state: "local_only", label: locale === "zh-CN" ? "当前" : "Current" }
      : row.status === "pending refresh"
        ? { state: "blocked" }
        : { state: "review_required", label: translatePhrase(row.status, locale) }
  }));
}

function inspectorRelationships(routeHref?: (path: string) => string): RelationshipChipProps[] {
  const blockedBy: RelationshipChipProps = { relation: "blocked_by", target: "AOS-142", source: "AOS-144" };
  if (routeHref) {
    blockedBy.href = routeHref("/work/items/AOS-128");
  }
  return [
    { relation: "blocks", target: "Owner Inspection Handoff", source: "AOS-144" },
    blockedBy,
    { relation: "verifies", target: "EVD-41", source: "AOS-128" },
    { relation: "depends_on", target: "DS-88", source: "AOS-142" }
  ];
}

function workHierarchyNodes(locale: TcrnLocale): WorkHierarchyNode[] {
  const nodes: WorkHierarchyNode[] = [
    { id: "INIT-WORK-MGMT", level: "Initiative", title: "Work Management MVP", owner: "Mara", state: { state: "review_required" } },
    { id: "EPIC-LIFECYCLE", level: "Epic", title: "Work Item Lifecycle", owner: "Mara", parentId: "INIT-WORK-MGMT" },
    { id: "EPIC-EVIDENCE", level: "Epic", title: "Evidence and Gates", owner: "Rowan", parentId: "INIT-WORK-MGMT" },
    { id: "STORY-PM-DISCUSS", level: "Story", title: "PM can discuss Work flows before API planning", owner: "Mara", parentId: "EPIC-LIFECYCLE" },
    { id: "AOS-142", level: "Task / Work Item", title: "Static Work Management DS consumption", owner: "Ilya", parentId: "STORY-PM-DISCUSS", state: { state: "review_required" } },
    { id: "EVD-42", level: "Subtask / Evidence Task", title: "Rendered static Work proof", owner: "Ilya", parentId: "AOS-142", state: { state: "review_required" } }
  ];
  return nodes.map((node) => ({ ...node, title: translatePhrase(node.title, locale) }));
}

function workHierarchyEdges(): WorkHierarchyEdge[] {
  return [
    { from: "EPIC-LIFECYCLE", to: "INIT-WORK-MGMT", relation: "split_from" },
    { from: "EPIC-EVIDENCE", to: "INIT-WORK-MGMT", relation: "relates_to" },
    { from: "STORY-PM-DISCUSS", to: "EPIC-LIFECYCLE", relation: "implements" },
    { from: "AOS-142", to: "STORY-PM-DISCUSS", relation: "implements" },
    { from: "EVD-42", to: "AOS-142", relation: "verifies" },
    { from: "AOS-144", to: "AOS-142", relation: "blocked_by" }
  ];
}

function savedViewFilters(locale: TcrnLocale): SavedViewToolbarFilter[] {
  return [
    { id: "owner-feedback", label: "Type", value: translatePhrase("Owner Feedback", locale) },
    { id: "qa-blocked", label: "Gate", value: locale === "zh-CN" ? "QA 阻塞" : "QA blocked" },
    { id: "no-overclaim", label: "Boundary", value: locale === "zh-CN" ? "无 readiness 声明" : "No readiness claim" }
  ].map((filter) => ({ ...filter, label: translateColumn(filter.label.toLowerCase(), locale) }));
}

export function resolveWorkMockupPageId(path: string): WorkMockupPageId {
  if (path === "/work/board") return "board";
  if (path === "/work/backlog") return "backlog";
  if (path === "/work/items/AOS-128") return "detail";
  if (path === "/work/gates") return "gates";
  if (path === "/work/evidence") return "evidence";
  if (path === "/work/codex-activity") return "codexActivity";
  if (path === "/work/views/owner-feedback") return "ownerFeedbackView";
  if (path === "/work/initiatives/work-management-mvp") return "initiativeGraph";
  return "queue";
}

export function getWorkMockupPageTitle(path: string, locale: TcrnLocale): string {
  const page = getWorkMockupPage(resolveWorkMockupPageId(path));
  return localized(page.title, locale);
}

export function WorkManagementMockups({ path, locale, theme, collapsed, variant, routeHref }: WorkManagementMockupsProps) {
  const page = getWorkMockupPage(resolveWorkMockupPageId(path));
  const pageId = page.id;
  return (
    <div
      className="tcrn-product-shell-content-stack"
      data-package-owned-spacing-rhythm="product-shell-content-stack"
      data-work-management-mockup="storybook-ds-work-management-v1"
      data-work-management-static-fixture="true"
      data-work-management-api-integration="absent"
      data-work-management-live-dispatch="not-enabled"
      data-work-management-hierarchy="initiative-epic-story-work-item-subtask-evidence-task"
      data-work-management-ds-standard="work-management-components-spec"
      data-design-system-work-components="registered-package-components"
      data-product-local-work-component-clones="absent"
      data-work-management-page={pageId}
      data-work-management-route={page.path}
      data-visual-instance-variant-readback={variant}
      data-visual-instance-theme-readback={theme}
      data-visual-instance-collapsed-readback={collapsed ? "true" : "false"}
    >
      <Surface data-owner-quality-primary-heading="true" data-owner-quality-first-viewport="product-led">
        <Text data-work-page-eyebrow="true">{localized(page.eyebrow, locale)}</Text>
        <Heading level={1} visualLevel={2} id="work-heading">
          {localized(page.title, locale)}
        </Heading>
        <Text>{localized(page.description, locale)}</Text>
        <EvidenceStrip items={[
          locale === "zh-CN" ? "静态示例数据" : "Static fixture data",
          locale === "zh-CN" ? "未接 API" : "No API integration",
          locale === "zh-CN" ? "无实时派发" : "No live dispatch"
        ]} />
      </Surface>
      <WorkMockupSubnav pageId={pageId} locale={locale} routeHref={routeHref} />
      {renderWorkMockupPage(pageId, locale, routeHref)}
    </div>
  );
}

function WorkMockupSubnav({ pageId, locale, routeHref }: { pageId: WorkMockupPageId; locale: TcrnLocale; routeHref: (path: string) => string }) {
  return (
    <div data-work-mockup-nav="package-work-management-subnav">
      <WorkManagementSubnav
        label={locale === "zh-CN" ? "工作管理页面" : "Work management pages"}
        items={workSubnavItems(pageId, locale, routeHref)}
      />
    </div>
  );
}

function renderWorkMockupPage(pageId: WorkMockupPageId, locale: TcrnLocale, routeHref: (path: string) => string) {
  switch (pageId) {
    case "board":
      return <BoardPage locale={locale} routeHref={routeHref} />;
    case "backlog":
      return <BacklogPage locale={locale} />;
    case "detail":
      return <DetailPage locale={locale} routeHref={routeHref} />;
    case "gates":
      return <GatesPage locale={locale} />;
    case "evidence":
      return <EvidencePage locale={locale} />;
    case "codexActivity":
      return <CodexActivityPage locale={locale} />;
    case "ownerFeedbackView":
      return <SavedViewPage locale={locale} routeHref={routeHref} />;
    case "initiativeGraph":
      return <InitiativeGraphPage locale={locale} />;
    default:
      return <QueuePage locale={locale} routeHref={routeHref} />;
  }
}

function QueuePage({ locale, routeHref }: { locale: TcrnLocale; routeHref: (path: string) => string }) {
  return (
    <>
      <div className="tcrn-product-shell-section-grid" data-package-owned-section-rhythm="work-gates" data-work-page-grid="queue">
        <Surface data-aos-work-module-entry="owner-quality-work-queue" data-owner-quality-work-queue="true">
          <Heading level={2}>{locale === "zh-CN" ? "优先队列" : "Priority queue"}</Heading>
          <WorkIndex rows={workIndexRows(locale)} label={locale === "zh-CN" ? "工作项" : "Work items"} locale={locale} />
        </Surface>
        <Surface data-work-dependency-chain="true">
          <Heading level={2}>{locale === "zh-CN" ? "阻塞链" : "Blocker chain"}</Heading>
          <WorkChain rows={[
            ["AOS-142", "implements", "Story: discuss Work flows"],
            ["AOS-144", "blocked_by", "AOS-142"],
            ["Owner Inspection", "blocked_by", "Mara PM Readiness"]
          ]} />
        </Surface>
      </div>
      <HierarchyDefinitionSummary locale={locale} />
      <Surface>
        <Heading level={2}>{locale === "zh-CN" ? "关系摘要" : "Relationship summary"}</Heading>
        <RelationshipTable locale={locale} rows={relationRows.slice(0, 8)} />
        <LinkButton href={routeHref("/work/items/AOS-128")} variant="secondary">{locale === "zh-CN" ? "查看 AOS-128 详情" : "Open AOS-128 detail"}</LinkButton>
      </Surface>
    </>
  );
}

function BoardPage({ locale, routeHref }: { locale: TcrnLocale; routeHref: (path: string) => string }) {
  return (
    <Surface data-aos-work-module-entry="registered-ds-work-board">
      <Heading level={2}>{locale === "zh-CN" ? "DS 注册 WorkBoard" : "Registered DS WorkBoard"}</Heading>
      <WorkBoard
        label={locale === "zh-CN" ? "工作看板" : "Work board"}
        lanes={workBoardLanes(locale)}
      />
      <div data-work-action-row="true">
        <LinkButton href={routeHref("/work/items/AOS-128")} variant="secondary">{locale === "zh-CN" ? "打开工作项" : "Open item"}</LinkButton>
      </div>
    </Surface>
  );
}

function BacklogPage({ locale }: { locale: TcrnLocale }) {
  return (
    <>
      <Surface>
        <Heading level={2}>{locale === "zh-CN" ? "待收敛输入" : "Inputs needing shaping"}</Heading>
        <TableShell
          label={locale === "zh-CN" ? "待整理" : "Backlog"}
          columns={columns(locale, ["input", "type", "missing", "suggestedOwner"])}
          rows={[
            { input: "Owner: search should not exist", type: "Owner Feedback", missing: "Scope already approved", suggestedOwner: "Ilya" },
            { input: "Work item numbering policy", type: "Open Question", missing: "Global or product-scoped key", suggestedOwner: "Mara" },
            { input: "Owner can see Work Item?", type: "Open Question", missing: "Visibility policy", suggestedOwner: "Mara" }
          ].map((row) => localizeRow(row, locale))}
        />
      </Surface>
      <RegisteredDsWorkComponentsSection locale={locale} />
    </>
  );
}

function RegisteredDsWorkComponentsSection({ locale }: { locale: TcrnLocale }) {
  return (
    <Surface
      data-registered-ds-work-components="true"
      data-registered-ds-work-components-implementation="package-consumed-storybook-first"
      data-registered-ds-work-components-count={registeredDsWorkComponentRows.length}
    >
      <Heading level={2}>{locale === "zh-CN" ? "已消费的 DS Work 组件 / 模式" : "Consumed DS Work components / patterns"}</Heading>
      <Text>
        {locale === "zh-CN"
          ? "新版 Storybook 已正式收录 Work Management 组件。AOS 当前 Work 路由只消费公开 DS package API，不复制 Storybook 文档壳或自建可复用视觉系统。"
          : "The new Storybook formally admits Work Management components. Current AOS Work routes consume public DS package APIs only; they do not copy Storybook doc-shell chrome or invent reusable local visual systems."}
      </Text>
      <TableShell
        label={locale === "zh-CN" ? "已消费的 DS Work 组件 / 模式" : "Consumed DS Work components and patterns"}
        columns={columns(locale, ["name", "purpose", "whereUsed", "consumptionDisposition", "dsLevel"])}
        rows={registeredDsWorkComponentRows.map((row) => ({
          name: <RegisteredDsWorkComponentNameCell item={row} />,
          purpose: translatePhrase(row.purpose, locale),
          whereUsed: row.whereUsed,
          consumptionDisposition: translatePhrase(row.consumptionDisposition, locale),
          dsLevel: row.dsLevel
        }))}
      />
    </Surface>
  );
}

function RegisteredDsWorkComponentNameCell({ item }: { item: RegisteredDsWorkComponentFixture }) {
  return (
    <span
      data-registered-ds-work-component-item="true"
      data-registered-ds-work-component-name={item.componentName}
      data-registered-ds-work-component-candidate-id={item.candidateId}
      data-registered-ds-work-component-purpose={item.purpose}
      data-registered-ds-work-component-where-used={item.whereUsed}
      data-registered-ds-work-component-disposition={item.consumptionDisposition}
      data-registered-ds-work-component-level={item.dsLevel}
    >
      {item.componentName}
    </span>
  );
}

function DetailPage({ locale, routeHref }: { locale: TcrnLocale; routeHref: (path: string) => string }) {
  return (
    <WorkItemInspector
      title={`AOS-128 · ${locale === "zh-CN" ? "移除顶栏全局搜索" : "Remove unsupported global search"}`}
      summary={locale === "zh-CN"
        ? "Owner 认可：AOS 没有真实全局搜索能力，不应展示顶栏搜索框或全局搜索快捷键。"
        : "Owner-approved scope: AOS has no real global search capability, so the shell must not render topbar search or a global search shortcut."}
      hierarchy={[
        { key: "initiative", label: "Initiative", value: "AOS product shell recovery" },
        { key: "epic", label: "Epic", value: "Product Shell Owner Feedback Recovery" },
        { key: "story", label: "Story", value: "Owner can inspect an AOS shell without fake global search" },
        { key: "workItem", label: "Work Item", value: <MachineToken token="AOS-128" kind="work-item" /> }
      ]}
      details={[
        { key: "aos", label: "AOS", value: <MachineToken token="cae4d52" label="HEAD" kind="commit" /> },
        { key: "ds", label: "DS", value: <MachineToken token="01714b9" label="Storybook" kind="commit" /> },
        { key: "workflow", label: "Workflow", value: <MachineToken token="380232c" label="retained-basis" kind="commit" /> },
        { key: "preview", label: "Preview", value: translatePhrase("4317 retained preview refreshed; PM freshness retry pending", locale) },
        { key: "ownerAcceptance", label: "Owner acceptance", value: "not claimed" },
        { key: "release", label: "Release readiness", value: "not claimed" }
      ]}
      relationships={inspectorRelationships(routeHref)}
      subtasks={[
        { id: "remove-search", title: translatePhrase("Remove ProductShellSearch prop", locale), state: { state: "local_only", label: locale === "zh-CN" ? "已通过" : "Passed" }, owner: "Ilya" },
        { id: "url-locale", title: translatePhrase("URL locale canonicalization", locale), state: { state: "local_only", label: locale === "zh-CN" ? "已通过" : "Passed" }, owner: "Ilya" },
        { id: "refresh-preview", title: translatePhrase("Retained 4317 refresh", locale), state: { state: "local_only", label: locale === "zh-CN" ? "已刷新" : "Refreshed" }, owner: "Atlas" },
        { id: "professional-qa", title: translatePhrase("Professional QA", locale), state: { state: "local_only", label: locale === "zh-CN" ? "已通过" : "Passed" }, owner: "Rowan" },
        { id: "pm-freshness-copy-repair", title: translatePhrase("PM freshness basis copy repair", locale), state: { state: "blocked", label: locale === "zh-CN" ? "需要修改" : "Changes requested" }, owner: "Ilya" }
      ]}
      evidence={evidenceAttachments(locale)}
      actions={[
        {
          id: "prepare-owner-package",
          label: locale === "zh-CN" ? "准备 Owner 检查包" : "Prepare owner inspection package",
          disabledReason: translatePhrase("Owner inspection package remains blocked until PM freshness accepts the repaired retained basis.", locale)
        }
      ]}
    />
  );
}

function GatesPage({ locale }: { locale: TcrnLocale }) {
  return (
    <Surface data-work-gates-page="true">
      <Heading level={2}>{locale === "zh-CN" ? "门禁聚合" : "Gate aggregation"}</Heading>
      <GatePipeline label={locale === "zh-CN" ? "门禁流水线" : "Gate pipeline"} gates={workGatePipeline(locale)} />
    </Surface>
  );
}

function EvidencePage({ locale }: { locale: TcrnLocale }) {
  return (
    <Surface data-work-evidence-page="true">
      <Heading level={2}>{locale === "zh-CN" ? "证据中心" : "Evidence Center"}</Heading>
      <EvidenceAttachmentList
        label={locale === "zh-CN" ? "证据附件" : "Evidence attachments"}
        items={evidenceAttachments(locale)}
      />
    </Surface>
  );
}

function CodexActivityPage({ locale }: { locale: TcrnLocale }) {
  return (
    <Surface data-work-codex-activity-page="true" data-work-codex-activity-contract="attached-execution-evidence-context">
      <Heading level={2}>{locale === "zh-CN" ? "Codex 活动附着在工作项下" : "Codex Activity attaches to Work Items"}</Heading>
      <Text>{locale === "zh-CN" ? "Codex Activity 是附着在 Work Item 下的执行/证据上下文，不替代 Story 或 Task / Work Item。" : "Codex Activity is execution/evidence context attached to Work Items, not a replacement for Story or Task / Work Item."}</Text>
      <EvidenceStrip items={[
        locale === "zh-CN" ? "附着到 Work Item" : "Attached to Work Item",
        locale === "zh-CN" ? "证据上下文" : "Evidence context",
        locale === "zh-CN" ? "不替代 Story" : "Not a Story replacement",
        locale === "zh-CN" ? "不替代 Task / Work Item" : "Not a Task / Work Item replacement"
      ]} />
      <TableShell
        label="Codex Activity"
        columns={columns(locale, ["route", "item", "thread", "status", "next"])}
        rows={codexRows.map((row) => ({
          route: <MachineToken token={row.route} label={translatePhrase(row.routeLabel, locale)} kind="route" />,
          item: row.item,
          thread: row.thread,
          status: translatePhrase(row.status, locale),
          next: translatePhrase(row.next, locale)
        }))}
      />
    </Surface>
  );
}

function SavedViewPage({ locale, routeHref }: { locale: TcrnLocale; routeHref: (path: string) => string }) {
  return (
    <>
      <Surface data-work-saved-view="owner-feedback">
        <Heading level={2}>{locale === "zh-CN" ? "保存视图：Owner Feedback" : "Saved view: Owner Feedback"}</Heading>
        <SavedViewToolbar
          label={locale === "zh-CN" ? "保存 Work 视图" : "Saved Work views"}
          views={workSubnavItems("ownerFeedbackView", locale, routeHref).filter((item) => ["queue", "ownerFeedbackView", "gates"].includes(item.id))}
          filters={savedViewFilters(locale)}
          resetLabel={locale === "zh-CN" ? "重置视图" : "Reset view"}
        />
        <TableShell
          label="Owner feedback saved view"
          columns={columns(locale, ["key", "title", "status", "gate", "nextOwner", "blocker"])}
          rows={workItems.filter((item) => item.type === "Owner Feedback" || item.status === "Blocked").map((item) => ({
            key: item.key,
            title: item.title,
            status: item.status,
            gate: item.gate,
            nextOwner: item.nextOwner,
            blocker: item.blocker
          }))}
        />
      </Surface>
      <Surface>
        <Heading level={2}>{locale === "zh-CN" ? "下一步动作" : "Next actions"}</Heading>
        <div data-work-action-row="true">
          <Button disabled disabledReason="Static mockup only; route actions are not wired">{locale === "zh-CN" ? "路由给 Ilya" : "Route to Ilya"}</Button>
          <Button disabled disabledReason="Static mockup only; no external action">{locale === "zh-CN" ? "请求 QA" : "Request QA"}</Button>
          <LinkButton href={routeHref("/work/gates")} variant="secondary">{locale === "zh-CN" ? "查看门禁" : "View gates"}</LinkButton>
        </div>
      </Surface>
    </>
  );
}

function InitiativeGraphPage({ locale }: { locale: TcrnLocale }) {
  return (
    <>
      <Surface data-work-initiative-graph="true">
        <Heading level={2}>Initiative → Epic → Story → Work Item → Evidence Task</Heading>
        <WorkHierarchy
          label={locale === "zh-CN" ? "工作层级" : "Work hierarchy"}
          nodes={workHierarchyNodes(locale)}
          edges={workHierarchyEdges()}
        />
      </Surface>
      <HierarchyDefinitionSummary locale={locale} />
      <Surface>
        <Heading level={2}>{locale === "zh-CN" ? "关系词汇" : "Relationship vocabulary"}</Heading>
        <RelationshipTable locale={locale} rows={relationRows} />
      </Surface>
    </>
  );
}

function HierarchyDefinitionSummary({ locale }: { locale: TcrnLocale }) {
  return (
    <Surface data-work-hierarchy-definitions="prd-content-contract">
      <Heading level={2}>{locale === "zh-CN" ? "PRD 层级定义" : "PRD hierarchy contract"}</Heading>
      <Text>{locale === "zh-CN" ? "这些定义让静态示例区分可验收结果、可执行工作单和执行证据。" : "These definitions keep acceptable outcomes, executable tickets, and execution evidence separate in the static mockups."}</Text>
      <TableShell
        label={locale === "zh-CN" ? "层级定义" : "Hierarchy definitions"}
        columns={columns(locale, ["layer", "definition", "boundary"])}
        rows={hierarchyDefinitionRows.map((row) => localizeRow(row, locale))}
      />
    </Surface>
  );
}

function RelationshipTable({ locale, rows }: { locale: TcrnLocale; rows: typeof relationRows }) {
  return (
    <TableShell
      label={locale === "zh-CN" ? "关系" : "Relations"}
      columns={columns(locale, ["relation", "source", "target", "state", "note"])}
      rows={rows.map((row) => ({ ...localizeRow(row, locale), state: relationState(row.state, locale) }))}
    />
  );
}

function WorkChain({ rows }: { rows: Array<[string, string, string]> }) {
  return (
    <ol data-work-chain="true">
      {rows.map(([source, relation, target]) => (
        <li key={`${source}-${relation}-${target}`}>
          <strong>{source}</strong> <span>{relation}</span> <span>{target}</span>
        </li>
      ))}
    </ol>
  );
}

function workIndexRows(locale: TcrnLocale): WorkIndexRow[] {
  const isZh = locale === "zh-CN";
  return workItems.map((item) => ({
    id: item.key,
    title: isZh ? translatePhrase(item.title, locale) : `${item.key} ${item.title}`,
    state: { state: item.status === "Blocked" || item.status === "PM Changes Requested" ? "blocked" : item.status === "Done" ? "not_configured" : "review_required" },
    owner: item.assignee
  }));
}

function columns(locale: TcrnLocale, keys: string[]) {
  return keys.map((key) => ({ key, label: translateColumn(key, locale) }));
}

function badge(state: GateState | string, locale: TcrnLocale): ReactNode {
  if (state === "passed" || state === "accepted" || state === "resolved" || state === "current") {
    return <StatusBadge state={{ state: "local_only", label: locale === "zh-CN" ? "已通过" : "Passed" }} locale={locale} />;
  }
  if (state === "blocked" || state === "changes_requested") {
    return <StatusBadge state={{ state: "blocked" }} locale={locale} />;
  }
  if (state === "not_started") {
    return <StatusBadge state={{ state: "not_claimed" }} locale={locale} />;
  }
  return <StatusBadge state={{ state: "review_required" }} locale={locale} />;
}

function relationState(state: string, locale: TcrnLocale) {
  const tone = state === "resolved" ? "positive" : state === "superseded" ? "neutral" : "warning";
  return <Badge tone={tone}>{translatePhrase(state, locale)}</Badge>;
}

function getWorkMockupPage(id: WorkMockupPageId): WorkMockupPage {
  return workPages.find((page) => page.id === id) ?? workPages[0]!;
}

function localized(value: Record<"en" | "zh-CN", string>, locale: TcrnLocale): string {
  return locale === "zh-CN" ? value["zh-CN"] : value.en;
}

function localizeRow<T extends Record<string, ReactNode>>(row: T, locale: TcrnLocale): T {
  if (locale !== "zh-CN") return row;
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [
    key,
    typeof value === "string" ? translatePhrase(value, locale) : value
  ])) as T;
}

function translateColumn(key: string, locale: TcrnLocale): string {
  if (locale !== "zh-CN") return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
  const labels: Record<string, string> = {
    action: "动作",
    artifact: "材料",
    assignee: "执行人",
    blocker: "阻塞",
    boundary: "边界",
    consumptionDisposition: "消费方式",
    evidence: "证据",
    gate: "门禁",
    id: "编号",
    input: "输入",
    item: "工作项",
    key: "编号",
    layer: "层级",
    missing: "缺口",
    name: "名称",
    next: "下一步",
    nextOwner: "下一 owner",
    note: "说明",
    owner: "Owner",
    priority: "优先级",
    proof: "证明",
    purpose: "目的",
    relation: "关系",
    route: "Route",
    source: "来源",
    state: "状态",
    status: "状态",
    suggestedOwner: "建议 owner",
    target: "目标",
    task: "任务",
    thread: "线程",
    title: "标题",
    type: "类型",
    whereUsed: "使用位置",
    dsLevel: "DS 层级"
  };
  return labels[key] ?? key;
}

function translateLane(value: string, locale: TcrnLocale): string {
  return translatePhrase(value, locale);
}

function translatePhrase(value: string, locale: TcrnLocale): string {
  if (locale !== "zh-CN") return value;
  const phrases: Record<string, string> = {
    "AOS-128 Remove unsupported global search": "AOS-128 移除不支持的全局搜索",
    "Remove unsupported global search": "移除不支持的全局搜索",
    "Rebuild Work routes with DS Work components": "用 DS Work 组件重建 Work 路由",
    "Static Work Management PRD mockups": "静态 Work Management PRD 示例",
    "ProductShell optional search contract": "ProductShell 可选搜索合同",
    "Owner inspection handoff package": "Owner 检查交接包",
    "PM Changes Requested": "PM 要求修改",
    "PM freshness changes requested": "PM freshness 要求修改",
    "Stale basis/posture copy on refreshed retained preview": "已刷新保留预览里仍有过期 basis / 姿态文案",
    "Retained 4317 is refreshed, but Mara requested a basis/posture copy repair before owner handoff.": "4317 保留预览已刷新，但 Mara 要求先修复 basis / 姿态文案后再进入 owner handoff。",
    "Owner request: Work visibility": "Owner 请求：Work 可视化",
    "DS component gap list": "DS 组件缺口列表",
    "Registered DS Work components": "已注册 DS Work 组件",
    "AOS-142 Static Work mockups": "AOS-142 静态 Work 示例",
    "AOS source-visible freshness check": "AOS 源码可见新鲜度检查",
    "DS-88 Optional search contract": "DS-88 可选搜索合同",
    "Mobile zh-CN no-overflow regression": "移动端 zh-CN 无溢出回归",
    "AOS-128 No global search": "AOS-128 无全局搜索",
    "Work Management subnav/tabs pattern": "Work Management 子导航 / 标签模式",
    "Work Board / Kanban lane composite": "Work Board / 看板泳道组合",
    "Work hierarchy graph / dependency map composite": "工作层级图 / 依赖地图组合",
    "Relationship chip/link primitive": "关系标签 / 链接基础组件",
    "Gate pipeline / compliance table pattern": "门禁流水线 / 合规表模式",
    "Evidence attachment gallery/list composite": "证据附件图库 / 列表组合",
    "Work Item detail / inspector layout pattern": "工作项详情 / 检查器布局模式",
    "Saved view / filter toolbar pattern": "保存视图 / 过滤工具栏模式",
    "Machine-token / execution-record cell pattern": "机器标识 / 执行记录单元格模式",
    "Dense in-module navigation for Work Management pages without global search.": "用于 Work Management 页面的紧凑模块内导航，不依赖全局搜索。",
    "Read-only work board lanes with status counts and local overflow containment.": "只读工作看板泳道，包含状态计数和局部溢出控制。",
    "Initiative, Epic, Story, Work Item, and Evidence Task hierarchy with table fallback.": "Initiative、Epic、Story、Work Item 与 Evidence Task 的层级视图，并提供表格回退。",
    "Relationship vocabulary display for blocks, depends_on, verifies, reviews, refreshes, and related edges.": "展示 blocks、depends_on、verifies、reviews、refreshes 等关系词汇。",
    "Gate sequence status, owner, evidence, and next-action scanning without readiness overclaim.": "扫描门禁顺序、状态、owner、证据与下一步动作，不夸大 readiness。",
    "Compact evidence references for screenshots, artifact directories, QA summaries, API readbacks, commits, and previews.": "紧凑展示截图、artifact 目录、QA 摘要、API 读回、commit 与预览证据。",
    "Structured Work Item detail surface with hierarchy, status, subtasks, evidence tasks, and guarded actions.": "结构化工作项详情，包含层级、状态、子任务、证据任务和受保护动作。",
    "Saved Work views and local filter chips without ProductShell global search.": "保存 Work 视图与局部过滤标签，不引入 ProductShell 全局搜索。",
    "Readable route, thread, commit, and artifact tokens that preserve full values while preventing cell overlap.": "可读展示 route、thread、commit 与 artifact 标识，保留完整值并避免单元格重叠。",
    "Replaces local LinkButton route switcher with package WorkManagementSubnav.": "用 package WorkManagementSubnav 替换本地 LinkButton 路由切换器。",
    "Consumes package WorkBoard lanes and relationship chips instead of local Surface lane CSS.": "消费 package WorkBoard 泳道与关系标签，而不是本地 Surface 泳道 CSS。",
    "Consumes package WorkHierarchy graph/table fallback for Initiative to Evidence Task hierarchy.": "消费 package WorkHierarchy 图谱/表格回退，展示 Initiative 到 Evidence Task 的层级。",
    "Consumes package RelationshipChip for blocks, depends_on, verifies, reviews, refreshes, and related edges.": "消费 package RelationshipChip 展示 blocks、depends_on、verifies、reviews、refreshes 与相关边。",
    "Consumes package GatePipeline for review/readiness sequence without claiming PM or owner acceptance.": "消费 package GatePipeline 展示评审/readiness 顺序，但不声明 PM 或 owner acceptance。",
    "Consumes package EvidenceAttachmentList for screenshots, artifacts, QA summaries, API readbacks, commits, and previews.": "消费 package EvidenceAttachmentList 展示截图、artifact、QA 摘要、API 读回、commit 与预览。",
    "Consumes package WorkItemInspector for hierarchy, status, subtasks, evidence tasks, and guarded actions.": "消费 package WorkItemInspector 展示层级、状态、子任务、证据任务和受保护动作。",
    "Consumes package SavedViewToolbar for saved views and local filters without ProductShell global search.": "消费 package SavedViewToolbar 展示保存视图与本地过滤，不引入 ProductShell 全局搜索。",
    "Consumes package MachineToken for long route, thread, commit, artifact, and work-item identifiers.": "消费 package MachineToken 展示长 route、thread、commit、artifact 与工作项标识。",
    "Initiative is the complete objective and why.": "Initiative 是完整目标与原因。",
    "Epic is a larger deliverable work package.": "Epic 是较大的交付工作包。",
    "Story is the smallest acceptable human/business/workflow result.": "Story 是最小可验收的人类、业务或工作流结果。",
    "Task / Work Item is the smallest executable ticket/task unit.": "Task / Work Item 是最小可执行任务单元。",
    "Subtask / Evidence Task is execution/proof detail.": "Subtask / Evidence Task 是执行或证明细节。",
    "Codex Activity is execution/evidence context attached to Work Items, not a replacement for Story or Task / Work Item.": "Codex Activity 是附着在 Work Item 下的执行/证据上下文，不替代 Story 或 Task / Work Item。",
    "Highest product/work goal.": "最高层产品/工作目标。",
    "Capability Epic or Workstream Epic.": "Capability Epic 或 Workstream Epic。",
    "Not the execution ticket.": "不是执行任务单。",
    "Executable owner, proof, and gate unit.": "可执行 owner、证明与门禁单元。",
    "Supports a Work Item.": "支撑一个 Work Item。",
    "Routes, threads, handoff returns, commits, proof, and blockers.": "Route、线程、handoff return、commit、证明与 blocker。",
    "No API integration": "未接 API",
    "URL locale authority": "URL locale 权威",
    "DS contract accepted": "DS 合同已接受",
    "Accepted on the AOS rebuild basis": "AOS 重建 basis 已接受",
    "Repair stale basis copy and return to Arturo": "修复过期 basis 文案并返回 Arturo",
    "Retained 4317 preview route/API readback": "4317 保留预览 route/API 读回",
    "Refresh again only after this repair/review/QA pass": "仅在本次修复、评审和 QA 通过后再次刷新",
    "Re-review this focused basis copy repair": "复审本次聚焦 basis 文案修复",
    "QA retry after Elara accepts the repair": "Elara 接受修复后重跑 QA",
    "Retained 4317 PM freshness check": "4317 保留预览 PM freshness 检查",
    "Pending this focused source repair and next Atlas refresh": "等待本次聚焦源码修复和下一轮 Atlas 刷新",
    "No owner handoff before PM freshness acceptance": "PM freshness 接受前不进行 owner handoff",
    "No owner handoff yet": "尚无 owner handoff",
    "No downstream claim": "不声明下游通过",
    "Remove ProductShellSearch prop": "移除 ProductShellSearch 属性",
    "URL locale canonicalization": "URL locale 规范化",
    "Refresh 4317 preview": "刷新 4317 预览",
    "Retained 4317 refresh": "4317 保留预览刷新",
    "PM freshness basis copy repair": "PM freshness basis 文案修复",
    "4317 retained preview refreshed; PM freshness retry pending": "4317 保留预览已刷新；等待 PM freshness 重试",
    "Owner inspection package remains blocked until PM freshness accepts the repaired retained basis.": "Owner 检查包仍保持阻塞，直到 PM freshness 接受修复后的保留预览 basis。",
    "Professional QA": "专业 QA",
    "Command proof": "命令证明",
    "Screenshot": "截图",
    "QA summary": "QA 摘要",
    "API readback": "API 读回",
    "Commit": "Commit",
    "Preview link": "预览链接",
    "proof artifact target": "证明 artifact 目标",
    "superseded by new scope": "已被新范围替代",
    "pending refresh": "等待刷新",
    "retained refreshed; PM changes requested": "保留预览已刷新；PM 要求修改",
    changes_requested: "需要修改",
    "Blocked until gates pass": "门禁通过前阻塞",
    Backlog: "待整理",
    "In Progress": "进行中",
    Review: "评审",
    QA: "QA",
    "PM Readiness": "PM 准备度",
    "Owner Inspection": "Owner 检查",
    resolved: "已解决",
    active: "进行中",
    superseded: "已替代",
    pending: "待处理",
    "Owner Feedback": "Owner 反馈",
    "Open Question": "待确认问题",
    "Scope already approved": "范围已批准",
    "Global or product-scoped key": "全局或按产品编号",
    "Visibility policy": "可见性策略",
    Ilya: "Ilya",
    Mara: "Mara"
  };
  return phrases[value] ?? value;
}
