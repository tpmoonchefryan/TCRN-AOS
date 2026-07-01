import type { ReactNode } from "react";
import {
  Badge,
  Button,
  EvidenceStrip,
  Heading,
  KeyValueList,
  LinkButton,
  StatusBadge,
  Surface,
  TableShell,
  Text,
  WorkIndex,
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
    status: "PM Readiness",
    priority: "High",
    product: "AOS",
    module: "Shell",
    initiative: "AOS frontend shell recovery",
    epic: "Product Shell Owner Feedback Recovery",
    epicKind: "Workstream Epic",
    story: "Owner can inspect an AOS shell without fake global search",
    owner: "Mara",
    assignee: "Ilya",
    nextOwner: "Atlas",
    gate: "Implementation Proof passed",
    blocker: "Refresh/review pending",
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
    initiative: "AOS frontend shell recovery",
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
    status: "Blocked",
    priority: "High",
    product: "AOS",
    module: "Owner Inspection",
    initiative: "AOS frontend shell recovery",
    epic: "Owner Inspection Package",
    epicKind: "Capability Epic",
    story: "Mara can prepare a bounded owner inspection package",
    owner: "Mara",
    assignee: "Mara",
    nextOwner: "Mara",
    gate: "PM Readiness pending",
    blocker: "Elara/Rowan gates must pass on fresh preview",
    updated: "2026-07-01"
  }
];

const relationRows = [
  { relation: "blocks", source: "AOS-144", target: "Owner Inspection Handoff", state: "active", note: "PM readiness is blocked until review and QA pass." },
  { relation: "blocked_by", source: "AOS-144", target: "AOS-142", state: "active", note: "Static discussion surface must be reviewed first." },
  { relation: "depends_on", source: "AOS-142", target: "DS-88", state: "resolved", note: "Uses DS optional-search contract." },
  { relation: "relates_to", source: "AOS-142", target: "DS component gap list", state: "active", note: "Related discussion without ordering or blocking." },
  { relation: "duplicates", source: "Owner note: fake search", target: "AOS-128", state: "resolved", note: "Duplicate owner feedback merges into the no-global-search item." },
  { relation: "implements", source: "AOS-142", target: "Story: PM can discuss Work flows", state: "active", note: "Static routes implement the discussion surface only." },
  { relation: "verifies", source: "EVD-41", target: "AOS-128", state: "resolved", note: "AOS proof verifies no global search and URL locale." },
  { relation: "reviews", source: "ELR-23", target: "AOS-142", state: "pending", note: "Elara review after Atlas refresh." },
  { relation: "refreshes", source: "ATL-31", target: "AOS-142", state: "pending", note: "Retained 4317 preview refresh is downstream." },
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
  { gate: "DS Review", owner: "Elara", state: "accepted", evidence: "ProductShell optional search contract", next: "AOS consumes DS package behavior" },
  { gate: "Implementation Proof", owner: "Ilya", state: "pending", evidence: "Static route proof, screenshots, no API fixture", next: "Commit and return to Arturo" },
  { gate: "Atlas Refresh", owner: "Atlas", state: "pending", evidence: "Retained 4317 preview route/API readback", next: "Refresh after implementation" },
  { gate: "Elara Rendered Review", owner: "Elara", state: "pending", evidence: "Owner-eye review of static Work mockups", next: "Review DS usage and visual quality" },
  { gate: "Rowan QA", owner: "Rowan", state: "pending", evidence: "Browser matrix, mobile, no-overclaim proof", next: "QA after Elara acceptance" },
  { gate: "Mara PM Readiness", owner: "Mara", state: "blocked", evidence: "Needs Elara + Rowan pass", next: "No owner handoff yet" },
  { gate: "Owner Inspection Handoff", owner: "Mara", state: "not_started", evidence: "Bounded package draft only", next: "Blocked until PM readiness" }
];

const evidenceRows = [
  { id: "EVD-41", type: "Command proof", item: "AOS-128", source: "Ilya", artifact: "pnpm aos:frontend-shell-proof", status: "current" },
  { id: "EVD-42", type: "Screenshot", item: "AOS-142", source: "Ilya", artifact: "/tmp/tcrn-aos-shell-qa/work-*.png", status: "proof artifact target" },
  { id: "EVD-43", type: "QA summary", item: "AOS-144", source: "Rowan", artifact: "summary-final.json", status: "superseded by new scope" },
  { id: "EVD-44", type: "API readback", item: "AOS-128", source: "Atlas", artifact: "/api/cockpit 410 deferred", status: "current no-live posture" },
  { id: "EVD-45", type: "Commit", item: "DS-88", source: "Ilya", artifact: "94dea5d", status: "current" },
  { id: "EVD-46", type: "Preview link", item: "AOS-142", source: "Atlas", artifact: "http://127.0.0.1:4317/", status: "pending refresh" }
];

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
      data-work-management-mockup="static-prd-v0.1"
      data-work-management-static-fixture="true"
      data-work-management-api-integration="absent"
      data-work-management-live-dispatch="not-enabled"
      data-work-management-hierarchy="initiative-epic-story-work-item-subtask-evidence-task"
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
    <nav data-work-mockup-nav="true" aria-label={locale === "zh-CN" ? "工作管理页面" : "Work management pages"}>
      {workPages.map((page) => (
        <LinkButton
          key={page.id}
          href={routeHref(page.path)}
          variant={page.id === pageId ? "primary" : "secondary"}
          aria-current={page.id === pageId ? "page" : undefined}
          data-work-mockup-nav-item={page.id}
        >
          {localized(page.title, locale)}
        </LinkButton>
      ))}
    </nav>
  );
}

function renderWorkMockupPage(pageId: WorkMockupPageId, locale: TcrnLocale, routeHref: (path: string) => string) {
  switch (pageId) {
    case "board":
      return <BoardPage locale={locale} routeHref={routeHref} />;
    case "backlog":
      return <BacklogPage locale={locale} />;
    case "detail":
      return <DetailPage locale={locale} />;
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
  const lanes = [
    { lane: "Backlog", items: ["Owner request: Work visibility", "DS component gap list"] },
    { lane: "In Progress", items: ["AOS-142 Static Work mockups"] },
    { lane: "Review", items: ["DS-88 Optional search contract"] },
    { lane: "QA", items: ["Mobile zh-CN no-overflow regression"] },
    { lane: "PM Readiness", items: ["AOS-128 No global search"] },
    { lane: "Owner Inspection", items: ["Blocked until gates pass"] }
  ];
  return (
    <div data-work-board="static-lanes">
      {lanes.map((lane) => (
        <Surface key={lane.lane} data-work-board-lane={lane.lane}>
          <Heading level={2} visualLevel={3}>{translateLane(lane.lane, locale)}</Heading>
          <ul data-work-list="compact">
            {lane.items.map((item) => <li key={item}>{translatePhrase(item, locale)}</li>)}
          </ul>
          {lane.lane === "In Progress" ? (
            <LinkButton href={routeHref("/work/items/AOS-128")} variant="secondary">{locale === "zh-CN" ? "打开工作项" : "Open item"}</LinkButton>
          ) : null}
        </Surface>
      ))}
    </div>
  );
}

function BacklogPage({ locale }: { locale: TcrnLocale }) {
  return (
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
  );
}

function DetailPage({ locale }: { locale: TcrnLocale }) {
  return (
    <div data-work-detail-layout="true">
      <Surface data-work-item-detail="AOS-128">
        <Heading level={2}>AOS-128 · {locale === "zh-CN" ? "移除顶栏全局搜索" : "Remove unsupported global search"}</Heading>
        <Text>{locale === "zh-CN" ? "Owner 认可：AOS 没有真实全局搜索能力，不应展示顶栏搜索框或全局搜索快捷键。" : "Owner-approved scope: AOS has no real global search capability, so the shell must not render topbar search or a global search shortcut."}</Text>
        <EvidenceStrip items={["Owner Feedback", "Implementation Proof", "No API integration", "URL locale authority"]} />
        <KeyValueList items={[
          { key: "hierarchy", label: "Hierarchy", value: "Initiative > Workstream Epic > Story > Work Item > Evidence Task" },
          { key: "status", label: "Status", value: <StatusBadge state={{ state: "review_required" }} locale={locale} /> },
          { key: "nextOwner", label: "Next owner", value: "Atlas" },
          { key: "blocker", label: "Owner inspection", value: locale === "zh-CN" ? "刷新、评审、QA、PM 之前阻塞" : "Blocked until refresh, review, QA, and PM readiness" }
        ]} />
        <Heading level={3}>{locale === "zh-CN" ? "子任务 / 证据任务" : "Subtasks / Evidence Tasks"}</Heading>
        <TableShell
          label="Subtasks"
          columns={columns(locale, ["task", "owner", "proof", "state"])}
          rows={[
            { task: "Remove ProductShellSearch prop", owner: "Ilya", proof: "service:smoke", state: badge("passed", locale) },
            { task: "URL locale canonicalization", owner: "Ilya", proof: "browser proof", state: badge("passed", locale) },
            { task: "Refresh 4317 preview", owner: "Atlas", proof: "route/API readback", state: badge("pending", locale) },
            { task: "Professional QA", owner: "Rowan", proof: "artifact dir", state: badge("pending", locale) }
          ]}
        />
      </Surface>
      <Surface>
        <Heading level={2}>{locale === "zh-CN" ? "右侧状态栏" : "Status sidebar"}</Heading>
        <KeyValueList items={[
          { key: "aos", label: "AOS", value: "996295f" },
          { key: "ds", label: "DS", value: "94dea5d" },
          { key: "workflow", label: "Workflow", value: "4802c19" },
          { key: "preview", label: "Preview", value: "pending Atlas refresh" },
          { key: "ownerAcceptance", label: "Owner acceptance", value: "not claimed" },
          { key: "release", label: "Release readiness", value: "not claimed" }
        ]} />
        <Button disabled disabledReason="Owner inspection package is blocked until gates pass">{locale === "zh-CN" ? "准备 Owner 检查包" : "Prepare owner inspection package"}</Button>
      </Surface>
    </div>
  );
}

function GatesPage({ locale }: { locale: TcrnLocale }) {
  return (
    <Surface data-work-gates-page="true">
      <Heading level={2}>{locale === "zh-CN" ? "门禁聚合" : "Gate aggregation"}</Heading>
      <TableShell
        label={locale === "zh-CN" ? "门禁" : "Gates"}
        columns={columns(locale, ["gate", "owner", "state", "evidence", "next"])}
        rows={gateRows.map((row) => ({ ...localizeRow(row, locale), state: badge(row.state, locale) }))}
      />
    </Surface>
  );
}

function EvidencePage({ locale }: { locale: TcrnLocale }) {
  return (
    <Surface data-work-evidence-page="true">
      <Heading level={2}>{locale === "zh-CN" ? "证据中心" : "Evidence Center"}</Heading>
      <TableShell
        label={locale === "zh-CN" ? "证据" : "Evidence"}
        columns={columns(locale, ["id", "type", "item", "source", "artifact", "status"])}
        rows={evidenceRows.map((row) => localizeRow(row, locale))}
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
          route: <RouteIdCell route={row.route} label={translatePhrase(row.routeLabel, locale)} token={row.routeToken} />,
          item: row.item,
          thread: row.thread,
          status: translatePhrase(row.status, locale),
          next: translatePhrase(row.next, locale)
        }))}
      />
    </Surface>
  );
}

function RouteIdCell({ route, label, token }: { route: string; label: string; token: string }) {
  return (
    <span
      data-work-route-summary="true"
      data-full-route-id={route}
      title={route}
      aria-label={`${label}: ${route}`}
      style={{ display: "grid", gap: "2px", minWidth: 0 }}
    >
      <strong data-work-route-label="true">{label}</strong>
      <code
        data-work-route-id-token="true"
        style={{
          display: "block",
          maxWidth: "100%",
          overflowWrap: "anywhere",
          wordBreak: "break-word",
          whiteSpace: "normal",
          fontSize: "11px",
          lineHeight: 1.35
        }}
      >
        {token}
      </code>
    </span>
  );
}

function SavedViewPage({ locale, routeHref }: { locale: TcrnLocale; routeHref: (path: string) => string }) {
  return (
    <>
      <Surface data-work-saved-view="owner-feedback">
        <Heading level={2}>{locale === "zh-CN" ? "保存视图：Owner Feedback" : "Saved view: Owner Feedback"}</Heading>
        <EvidenceStrip items={["Owner Feedback", "QA Blocked", "Waiting for Atlas", "Ready for PM", "Superseded"]} />
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
        <div data-work-graph="true">
          <GraphColumn title="Initiative" items={["Work Management MVP"]} />
          <GraphColumn title="Capability Epics" items={["Work Item Lifecycle", "Work Graph and Dependencies", "Evidence and Gates"]} />
          <GraphColumn title="Workstream Epic" items={["AOS Static Mockup Implementation"]} />
          <GraphColumn title="Stories" items={["PM can create work from owner feedback", "PM can see blockers between work items", "Reviewer can verify gates with evidence"]} />
          <GraphColumn title="Work Items" items={["AOS-142", "AOS-128", "DS-88", "AOS-144"]} />
          <GraphColumn title="Subtasks / Evidence Tasks" items={["Screenshot proof", "QA summary", "API readback", "Commit readback"]} />
        </div>
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

function GraphColumn({ title, items }: { title: string; items: string[] }) {
  return (
    <div data-work-graph-column={title}>
      <strong>{title}</strong>
      <ul data-work-list="compact">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
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
    state: { state: item.status === "Blocked" ? "blocked" : item.status === "Done" ? "not_configured" : "review_required" },
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
    evidence: "证据",
    gate: "门禁",
    id: "编号",
    input: "输入",
    item: "工作项",
    key: "编号",
    layer: "层级",
    missing: "缺口",
    next: "下一步",
    nextOwner: "下一 owner",
    note: "说明",
    owner: "Owner",
    priority: "优先级",
    proof: "证明",
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
    type: "类型"
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
    "Static Work Management PRD mockups": "静态 Work Management PRD 示例",
    "ProductShell optional search contract": "ProductShell 可选搜索合同",
    "Owner inspection handoff package": "Owner 检查交接包",
    "Owner request: Work visibility": "Owner 请求：Work 可视化",
    "DS component gap list": "DS 组件缺口列表",
    "AOS-142 Static Work mockups": "AOS-142 静态 Work 示例",
    "DS-88 Optional search contract": "DS-88 可选搜索合同",
    "Mobile zh-CN no-overflow regression": "移动端 zh-CN 无溢出回归",
    "AOS-128 No global search": "AOS-128 无全局搜索",
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
