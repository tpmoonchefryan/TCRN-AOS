import type { ReactNode } from "react";
import {
  Badge,
  Button,
  EvidenceAttachmentList,
  GatePipelineCompact,
  Heading,
  KnowledgeDocumentCanvas,
  KnowledgeInlineCommentList,
  KnowledgeLabelSet,
  KnowledgeMetadataRail,
  KnowledgePageTree,
  KnowledgeSearchResults,
  KnowledgeTocRail,
  KnowledgeVersionHistory,
  LinkButton,
  MachineToken,
  MachineTokenCell,
  MetadataRail,
  RelationshipChip,
  StatusBadge,
  Surface,
  TableShell,
  Text,
  WorkBoardView,
  WorkBacklogGroup,
  WorkDetailLayout,
  WorkActivityFeed,
  WorkFieldPanel,
  WorkHierarchy,
  WorkList,
  WorkPageHeader,
  WorkQuickFilters,
  WorkSplitView,
  WorkViewTabs,
  knowledgeManagementPatternRegistry,
  workManagementPatternRegistry,
  workRelationshipLabel,
  type EvidenceAttachment,
  type GatePipelineGate,
  Stamp,
  StampRule,
  type KeyValueItem,
  type RelationshipChipProps,
  type WorkBoardLane,
  type WorkItemRowProps,
  type WorkHierarchyEdge,
  type WorkHierarchyNode,
  type WorkRelationshipType
} from "@tcrn/ui-react";
import type { TcrnLocale } from "@tcrn/ui-copy-state";

import { format, pick, type CopyEntry } from "./copy.js";

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
  // `CopyEntry`, not the `Record<"en" | "zh-CN", string>` these three fields used
  // to be. The old type was the defect stated as a type: nine pages × three
  // fields, and the shape made two languages the most a page could hold, so the
  // ja, ko and fr routes rendered English titles no matter what the caller did.
  // Widening the type turns each missing locale into a compile error at the line
  // that writes the page.
  title: CopyEntry;
  eyebrow: CopyEntry;
  description: CopyEntry;
}

interface WorkManagementMockupsProps {
  path: string;
  locale: TcrnLocale;
  theme: "light" | "dark";
  collapsed: boolean;
  variant: string;
  viewport: "desktop" | "mobile";
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

interface RegisteredDsKnowledgeComponentFixture {
  componentName: string;
  candidateId: string;
  purpose: string;
  whereUsed: string;
  consumptionDisposition: string;
  dsLevel: "primitive" | "pattern" | "composite";
}

const workStorybookContractAnchors = {
  componentsRoute: "components.html#work-management-components-spec",
  patternsRoute: "patterns.html#work-management-patterns",
  componentsStoryId: "tcrn-design-system-components--work-management-components-spec",
  patternsStoryId: "tcrn-design-system-patterns--work-management-patterns",
  aiContractVersion: "ai_consumption_contract_v1",
  foundationRegistryId: "foundation-visual-standards-v1",
  consumerVisualStyleContract: "consumerVisualStyleContract",
  docShellOracle: "original-storybook-doc-shell-v1",
  staticAuthorityDisposition: "aos_static_work_mockup_consumes_storybook_ds_work_management_contract"
} as const;

const knowledgeStorybookContractAnchors = {
  componentsRoute: "components.html#knowledge-management-components-spec",
  componentsStoryId: "tcrn-design-system-components--knowledge-management-components-spec",
  aiContractVersion: "ai_consumption_contract_v1",
  foundationRegistryId: "foundation-visual-standards-v1",
  consumerVisualStyleContract: "consumerVisualStyleContract",
  docShellOracle: "original-storybook-doc-shell-v1",
  staticAuthorityDisposition: "aos_static_knowledge_mockup_consumes_meridian_ds_knowledge_management_contract",
  dsBasis: "d385428"
} as const;

const exactWorkRouteProofTargets = [
  "/work",
  "/work/board",
  "/work/backlog",
  "/work/items/AOS-128",
  "/work/views/owner-feedback",
  "/work/gates",
  "/work/evidence",
  "/work/codex-activity",
  "/work/initiatives/work-management-mvp"
];

const mobileWorkRouteProofTargets = [
  "/work/backlog?locale=zh-CN&theme=dark",
  "/work/items/AOS-128?locale=zh-CN&theme=dark",
  "/work/initiatives/work-management-mvp?locale=zh-CN&theme=dark"
];

const currentAosConsumptionBasis = {
  aos: "meridian-knowledge-source",
  ds: "d385428",
  workflow: "fce130df"
} as const;

const workPages: WorkMockupPage[] = [
  {
    id: "queue",
    path: "/work",
    title: {
      "zh-CN": "工作队列", en: "Work queue", ja: "作業キュー", ko: "작업 대기열", fr: "File de travail"
    },
    eyebrow: {
      "zh-CN": "当前工作", en: "Current work", ja: "現在の作業", ko: "현재 작업", fr: "Travail en cours"
    },
    description: {
      "zh-CN": "按 owner 反馈、实现、门禁、证据和 PM readiness 聚合的优先工作项。",
      en: "Prioritized work items across owner feedback, implementation, gates, evidence, and PM readiness.",
      ja: "owner フィードバック・実装・ゲート・証拠・PM readiness を横断して優先順位づけした作業項目。",
      ko: "owner 피드백, 구현, 게이트, 증거, PM readiness를 아우르는 우선순위 작업 항목.",
      fr: "Éléments de travail priorisés couvrant retours owner, implémentation, portes, preuves et PM readiness."
    }
  },
  {
    id: "board",
    path: "/work/board",
    title: {
      "zh-CN": "工作看板", en: "Work Board", ja: "作業ボード", ko: "작업 보드", fr: "Tableau de travail"
    },
    eyebrow: {
      "zh-CN": "生命周期视图", en: "Lifecycle view", ja: "ライフサイクル表示", ko: "생애주기 보기", fr: "Vue du cycle de vie"
    },
    description: {
      "zh-CN": "静态看板将工作状态与门禁状态分离，保留被 supersede 的证据脉络。",
      en: "Static board lanes separate work status from gate status so superseded evidence stays visible.",
      ja: "静的なボードのレーンは作業状態とゲート状態を分けるので、置き換えられた証拠も見え続けます。",
      ko: "정적 보드 레인은 작업 상태와 게이트 상태를 분리하므로 대체된 증거도 계속 보입니다.",
      fr: "Les couloirs du tableau statique séparent l'état du travail de l'état des portes, laissant visibles les preuves remplacées."
    }
  },
  {
    id: "backlog",
    path: "/work/backlog",
    title: { "zh-CN": "待整理", en: "Backlog", ja: "バックログ", ko: "백로그", fr: "Backlog" },
    eyebrow: {
      "zh-CN": "待整理输入", en: "Unshaped input", ja: "未整理の入力", ko: "정리되지 않은 입력", fr: "Entrées non cadrées"
    },
    description: {
      "zh-CN": "等待 PM 收敛的 owner 反馈与 route return，尚未成为可执行工作项。",
      en: "Owner feedback and route returns waiting for PM shaping before they become executable Work Items.",
      ja: "PM による整理を待っている owner フィードバックと route return。まだ実行可能な作業項目ではありません。",
      ko: "PM 정리를 기다리는 owner 피드백과 route return. 아직 실행 가능한 작업 항목이 아닙니다.",
      fr: "Retours owner et retours de route en attente de cadrage PM avant de devenir des éléments de travail exécutables."
    }
  },
  {
    id: "detail",
    path: "/work/items/AOS-128",
    title: {
      "zh-CN": "AOS-128 工作项详情",
      en: "AOS-128 Work Item Detail",
      ja: "AOS-128 作業項目の詳細",
      ko: "AOS-128 작업 항목 상세",
      fr: "Détail de l'élément de travail AOS-128"
    },
    eyebrow: {
      "zh-CN": "Owner 反馈工作项",
      en: "Owner feedback item",
      ja: "owner フィードバックの項目",
      ko: "owner 피드백 항목",
      fr: "Élément de retour owner"
    },
    description: {
      "zh-CN": "单个工作项串联层级、门禁、证据、Codex route、阻塞项和 no-overclaim 标记。",
      en: "A single Work Item keeps hierarchy, gates, evidence, Codex routes, blockers, and no-overclaim flags together.",
      ja: "一つの作業項目が階層・ゲート・証拠・Codex route・阻害要因・no-overclaim 標記をまとめて保ちます。",
      ko: "하나의 작업 항목이 계층, 게이트, 증거, Codex route, 차단 요소, no-overclaim 표시를 함께 유지합니다.",
      fr: "Un seul élément de travail réunit hiérarchie, portes, preuves, routes Codex, bloqueurs et marqueurs no-overclaim."
    }
  },
  {
    id: "gates",
    path: "/work/gates",
    title: { "zh-CN": "门禁聚合", en: "Gates", ja: "ゲート", ko: "게이트", fr: "Portes" },
    eyebrow: {
      "zh-CN": "评审准备度", en: "Review readiness", ja: "レビュー準備状況", ko: "검토 준비도", fr: "Préparation à la revue"
    },
    description: {
      "zh-CN": "门禁行展示通过项、阻塞项，以及 owner inspection 仍不可用的原因。",
      en: "Gate rows show what passed, what is blocked, and why owner inspection stays unavailable.",
      ja: "ゲートの行は、何が通過し、何が阻まれ、なぜ owner inspection が利用できないままなのかを示します。",
      ko: "게이트 행은 무엇이 통과했고 무엇이 막혔으며 owner inspection이 왜 여전히 불가능한지 보여줍니다.",
      fr: "Les lignes de porte montrent ce qui est passé, ce qui est bloqué et pourquoi l'inspection owner reste indisponible."
    }
  },
  {
    id: "evidence",
    path: "/work/evidence",
    title: { "zh-CN": "证据中心", en: "Evidence", ja: "証拠", ko: "증거", fr: "Preuves" },
    eyebrow: {
      "zh-CN": "证明库", en: "Proof library", ja: "証明のライブラリ", ko: "증명 라이브러리", fr: "Bibliothèque de preuves"
    },
    description: {
      "zh-CN": "截图、artifact 目录、QA 摘要、API 读回、commit 和 preview 链接都挂接到工作项。",
      en: "Screenshots, artifact directories, QA summaries, API readbacks, commits, and preview links attached to Work Items.",
      ja: "スクリーンショット・artifact ディレクトリ・QA サマリー・API 読み戻し・commit・preview リンクを作業項目に紐づけます。",
      ko: "스크린샷, artifact 디렉터리, QA 요약, API 읽기 확인, commit, preview 링크를 작업 항목에 연결합니다.",
      fr: "Captures d'écran, répertoires d'artefacts, résumés QA, relectures API, commits et liens d'aperçu rattachés aux éléments de travail."
    }
  },
  {
    id: "codexActivity",
    path: "/work/codex-activity",
    title: {
      "zh-CN": "Codex 活动", en: "Codex Activity", ja: "Codex の活動", ko: "Codex 활동", fr: "Activité Codex"
    },
    eyebrow: {
      "zh-CN": "执行记录", en: "Execution records", ja: "実行記録", ko: "실행 기록", fr: "Registres d'exécution"
    },
    description: {
      "zh-CN": "Route、线程、handoff return、监控和下一 owner 是挂在工作项下的执行记录。",
      en: "Routes, threads, handoff returns, monitors, and next owners are execution records attached to Work Items.",
      ja: "route・スレッド・handoff return・監視・次の owner は、作業項目に紐づく実行記録です。",
      ko: "route, 스레드, handoff return, 모니터, 다음 owner는 작업 항목에 붙는 실행 기록입니다.",
      fr: "Routes, fils, retours de passation, moniteurs et owners suivants sont des registres d'exécution rattachés aux éléments de travail."
    }
  },
  {
    id: "ownerFeedbackView",
    path: "/work/views/owner-feedback",
    title: {
      "zh-CN": "Owner 反馈视图",
      en: "Owner Feedback View",
      ja: "owner フィードバックのビュー",
      ko: "owner 피드백 보기",
      fr: "Vue des retours owner"
    },
    eyebrow: {
      "zh-CN": "保存视图", en: "Saved view", ja: "保存したビュー", ko: "저장된 보기", fr: "Vue enregistrée"
    },
    description: {
      "zh-CN": "保存过滤 owner 反馈、QA blocker、被 supersede 的证据和 PM readiness 阻塞项。",
      en: "A saved filter for owner feedback, QA blockers, superseded evidence, and PM readiness blockers.",
      ja: "owner フィードバック・QA blocker・置き換えられた証拠・PM readiness の阻害要因を絞り込む保存済みフィルター。",
      ko: "owner 피드백, QA blocker, 대체된 증거, PM readiness 차단 요소를 걸러내는 저장된 필터.",
      fr: "Un filtre enregistré pour les retours owner, les bloqueurs QA, les preuves remplacées et les bloqueurs PM readiness."
    }
  },
  {
    id: "initiativeGraph",
    path: "/work/initiatives/work-management-mvp",
    title: {
      "zh-CN": "Work Management MVP 图谱",
      en: "Work Management MVP Graph",
      ja: "Work Management MVP のグラフ",
      ko: "Work Management MVP 그래프",
      fr: "Graphe du MVP Work Management"
    },
    eyebrow: {
      "zh-CN": "层级与关系", en: "Hierarchy and links", ja: "階層と関係", ko: "계층과 관계", fr: "Hiérarchie et liens"
    },
    description: {
      "zh-CN": "在一张静态图里展示 Initiative、Epic、Story、Work Item、Subtask、Evidence Task 与关系词汇。",
      en: "Initiative, Epics, Stories, Work Items, Subtasks, Evidence Tasks, and relationship vocabulary in one static graph.",
      ja: "Initiative・Epic・Story・Work Item・Subtask・Evidence Task と関係語彙を一枚の静的なグラフに示します。",
      ko: "Initiative, Epic, Story, Work Item, Subtask, Evidence Task와 관계 어휘를 하나의 정적 그래프에 담습니다.",
      fr: "Initiative, Epics, Stories, éléments de travail, sous-tâches, tâches de preuve et vocabulaire de relation dans un seul graphe statique."
    }
  }
];

const workItems: WorkItemFixture[] = [
  {
    key: "AOS-128",
    title: "Remove unsupported global search",
    type: "Owner Feedback",
    status: "PM Freshness Retry Pending",
    priority: "High",
    product: "AOS",
    module: "Shell",
    initiative: "AOS product shell recovery",
    epic: "Product Shell Owner Feedback Recovery",
    epicKind: "Workstream Epic",
    story: "Owner can inspect the shell capability boundary without fake controls",
    owner: "Mara",
    assignee: "Ilya",
    nextOwner: "Ilya",
    gate: "PM freshness retry pending",
    blocker: "PM freshness retry pending; owner and product acceptance are not claimed.",
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
    status: "PM Freshness Retry Pending",
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
    gate: "PM freshness retry pending",
    blocker: "PM freshness retry pending; owner and product acceptance are not claimed.",
    updated: "2026-07-01"
  }
];

/**
 * The relations fixture, typed so the verb is DS vocabulary rather than a string.
 *
 * `relation` used to be inferred as `string`, which is why the two places that
 * rendered it could get away with printing the raw token: nothing connected these
 * twelve values to the table DS keeps five locales in. Typing it as
 * `WorkRelationshipType` makes a typo a compile error and makes
 * `workRelationshipLabel` reachable without a cast.
 */
const relationRows: Array<{
  relation: WorkRelationshipType;
  source: string;
  target: string;
  state: string;
  note: string;
}> = [
  { relation: "blocks", source: "AOS-144", target: "Owner Inspection Readiness", state: "active", note: "PM freshness retry remains required before inspection readiness." },
  { relation: "blocked_by", source: "AOS-144", target: "AOS-142", state: "active", note: "Static discussion surface must be reviewed first." },
  { relation: "depends_on", source: "AOS-142", target: "DS-88", state: "resolved", note: "Uses DS optional-search contract." },
  { relation: "relates_to", source: "AOS-142", target: "Registered DS Work components", state: "active", note: "Consumes the admitted DS Work Management package patterns without API integration." },
  { relation: "duplicates", source: "Owner note: fake search", target: "AOS-128", state: "resolved", note: "Duplicate owner feedback merges into the no-global-search item." },
  { relation: "implements", source: "AOS-142", target: "Story: PM can discuss Work flows", state: "active", note: "Static routes implement the discussion surface only." },
  { relation: "verifies", source: "EVD-41", target: "AOS-128", state: "resolved", note: "AOS proof verifies no global search and URL locale." },
  { relation: "reviews", source: "ELR-23", target: "AOS-142", state: "resolved", note: "AOS consumption review accepted before retained refresh." },
  { relation: "refreshes", source: "ATL-31", target: "AOS-142", state: "resolved", note: "Retained 4317 refreshed to the reviewed AOS consumption basis." },
  { relation: "supersedes", source: "AOS-128", target: "previous capability claim", state: "resolved", note: "Unsupported route claim replaced by no-search boundary." },
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
  { gate: "Implementation Proof", owner: "Ilya", state: "accepted", evidence: "Static route proof, screenshots, no API fixture", next: "Copy-state repair proof in progress" },
  { gate: "Atlas Refresh", owner: "Atlas", state: "accepted", evidence: "Retained 4317 refreshed to reviewed basis", next: "PM freshness retry pending; no owner or product acceptance claimed" },
  { gate: "Elara Rendered Review", owner: "Elara", state: "accepted", evidence: "Owner-eye review of compact Work mockups", next: "Focused review on copy-state repair if routed" },
  { gate: "Rowan QA", owner: "Rowan", state: "accepted", evidence: "Browser matrix, mobile, no-overclaim proof", next: "Focused QA on copy-state repair if routed" },
  { gate: "Mara PM Readiness", owner: "Mara", state: "changes_requested", evidence: "PM freshness retry pending after copy repair", next: "Retry after source repair and retained refresh" },
  { gate: "Owner Inspection Readiness", owner: "Mara", state: "not_started", evidence: "Bounded package draft only", next: "Only after PM freshness/readiness permits" }
];

const evidenceRows = [
  { id: "EVD-41", type: "Command proof", item: "AOS-128", source: "Ilya", artifact: "pnpm aos:frontend-shell-proof", status: "current" },
  { id: "EVD-42", type: "Screenshot", item: "AOS-142", source: "Ilya", artifact: "non-retained QA screenshot capture", status: "proof artifact target" },
  { id: "EVD-43", type: "QA summary", item: "AOS-144", source: "Rowan", artifact: "summary-final.json", status: "superseded by new scope" },
  { id: "EVD-44", type: "API readback", item: "AOS-128", source: "Atlas", artifact: "/api/cockpit 410 deferred", status: "current no-live posture" },
  { id: "EVD-45", type: "Commit", item: "DS-88", source: "Ilya", artifact: "33222fa", status: "current" },
  { id: "EVD-46", type: "Preview link", item: "AOS-142", source: "Atlas", artifact: "http://127.0.0.1:4317/", status: "PM freshness retry pending; use Atlas markers for freshness" }
];

const registeredDsWorkComponentRows: RegisteredDsWorkComponentFixture[] = workManagementPatternRegistry.map((item) => {
  const routeUse: Record<string, { whereUsed: string; consumptionDisposition: string }> = {
    WorkPageHeader: {
      whereUsed: "/work route set",
      consumptionDisposition: "Consumes package WorkPageHeader for compact route context above operational content."
    },
    WorkViewTabs: {
      whereUsed: "/work route set",
      consumptionDisposition: "Consumes package WorkViewTabs for local Work route navigation instead of a duplicated chip band."
    },
    WorkQuickFilters: {
      whereUsed: "/work, /work/board, /work/backlog, /work/views/owner-feedback",
      consumptionDisposition: "Consumes package WorkQuickFilters for fixture-only Work controls without ProductShell global search."
    },
    WorkItemRow: {
      whereUsed: "/work, /work/backlog, /work/views/owner-feedback",
      consumptionDisposition: "Consumes package WorkItemRow for dense owner-feedback and Work rows."
    },
    WorkList: {
      whereUsed: "/work, /work/backlog, /work/views/owner-feedback",
      consumptionDisposition: "Consumes package WorkList as the repeated dense list surface."
    },
    WorkSplitView: {
      whereUsed: "/work, /work/board, /work/backlog",
      consumptionDisposition: "Consumes package WorkSplitView for desktop list/detail composition while mobile uses full detail routes."
    },
    WorkBacklogGroup: {
      whereUsed: "/work/backlog",
      consumptionDisposition: "Consumes package WorkBacklogGroup for shaped and unshaped static planning groups."
    },
    WorkInlineCreateStatic: {
      whereUsed: "/work/backlog",
      consumptionDisposition: "Consumes package WorkInlineCreateStatic for disabled no-backend create affordances."
    },
    WorkBoardView: {
      whereUsed: "/work/board",
      consumptionDisposition: "Consumes package WorkBoardView compact board composition instead of local lane/card CSS."
    },
    WorkDetailLayout: {
      whereUsed: "/work/items/AOS-128 and split preview rails",
      consumptionDisposition: "Consumes package WorkDetailLayout for main content plus metadata rail."
    },
    MetadataRail: {
      whereUsed: "/work/items/AOS-128 and split preview rails",
      consumptionDisposition: "Consumes package MetadataRail for compact owner/gate/basis metadata."
    },
    WorkFieldPanel: {
      whereUsed: "/work/items/AOS-128, /work/gates, /work/evidence",
      consumptionDisposition: "Consumes package WorkFieldPanel for dense field groups and summaries."
    },
    WorkActivityFeed: {
      whereUsed: "/work/items/AOS-128, /work/codex-activity",
      consumptionDisposition: "Consumes package WorkActivityFeed for route and review activity."
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
    GatePipelineCompact: {
      whereUsed: "/work/gates and /work/items/AOS-128",
      consumptionDisposition: "Consumes package GatePipelineCompact for compact gate summaries."
    },
    EvidenceAttachmentList: {
      whereUsed: "/work/evidence and /work/items/AOS-128",
      consumptionDisposition: "Consumes package EvidenceAttachmentList for screenshots, artifacts, QA summaries, API readbacks, commits, and previews."
    },
    MachineToken: {
      whereUsed: "/work/codex-activity, /work/evidence, and graph fallback",
      consumptionDisposition: "Consumes package MachineToken for long route, thread, commit, artifact, and work-item identifiers."
    },
    MachineTokenCell: {
      whereUsed: "/work/codex-activity, /work/evidence, detail metadata, and compact rows",
      consumptionDisposition: "Consumes package MachineTokenCell for dense contained machine identifiers."
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

const consumedKnowledgeComponentNames = [
  "KnowledgePageTree",
  "KnowledgeDocumentCanvas",
  "KnowledgeTocRail",
  "KnowledgeInlineCommentList",
  "KnowledgeMetadataRail",
  "KnowledgeLabelSet",
  "KnowledgeVersionHistory",
  "KnowledgeSearchResults"
] as const;

const registeredDsKnowledgeComponentRows: RegisteredDsKnowledgeComponentFixture[] = knowledgeManagementPatternRegistry
  .filter((item) => consumedKnowledgeComponentNames.includes(item.componentName as typeof consumedKnowledgeComponentNames[number]))
  .map((item) => {
    const routeUse: Record<string, { whereUsed: string; consumptionDisposition: string }> = {
      KnowledgePageTree: {
        whereUsed: "/work/items/AOS-128 knowledge support packet",
        consumptionDisposition: "Consumes package KnowledgePageTree for static page context beside the Work detail."
      },
      KnowledgeDocumentCanvas: {
        whereUsed: "/work/items/AOS-128 knowledge support packet",
        consumptionDisposition: "Consumes package KnowledgeDocumentCanvas for source-bounded runbook content."
      },
      KnowledgeTocRail: {
        whereUsed: "/work/items/AOS-128 knowledge support packet",
        consumptionDisposition: "Consumes package KnowledgeTocRail for local document section navigation."
      },
      KnowledgeInlineCommentList: {
        whereUsed: "/work/items/AOS-128 knowledge support packet",
        consumptionDisposition: "Consumes package KnowledgeInlineCommentList for static review notes without collaboration claims."
      },
      KnowledgeMetadataRail: {
        whereUsed: "/work/items/AOS-128 knowledge support packet",
        consumptionDisposition: "Consumes package KnowledgeMetadataRail for DS basis, owner state, and no-live policy metadata."
      },
      KnowledgeLabelSet: {
        whereUsed: "/work/items/AOS-128 knowledge support packet",
        consumptionDisposition: "Consumes package KnowledgeLabelSet for compact topic and policy labels."
      },
      KnowledgeVersionHistory: {
        whereUsed: "/work/items/AOS-128 knowledge support packet",
        consumptionDisposition: "Consumes package KnowledgeVersionHistory for static version readbacks without publishing claims."
      },
      KnowledgeSearchResults: {
        whereUsed: "/work/items/AOS-128 knowledge support packet",
        consumptionDisposition: "Consumes package KnowledgeSearchResults as local fixture results only, not ProductShell/global search."
      }
    };
    const route = routeUse[item.componentName] ?? {
      whereUsed: "/work/items/AOS-128",
      consumptionDisposition: "Consumed from the registered DS Knowledge Management package registry."
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

const backlogGroups = [
  {
    id: "shaped",
    title: "Shaped for design confirmation",
    rows: [
      {
        input: "AOS-142 Work module route matrix",
        type: "Shaped Work Item",
        rank: "P0",
        order: "1",
        missingDecision: "Review only; no backend API",
        suggestedOwner: "Elara",
        disabledAction: "Promote blocked until rendered DS review accepts"
      },
      {
        input: "AOS-128 capability boundary detail",
        type: "Shaped Work Item",
        rank: "P0",
        order: "2",
        missingDecision: "Keep no-search proof visible without claiming readiness",
        suggestedOwner: "Rowan",
        disabledAction: "Route action disabled in static fixture"
      }
    ]
  },
  {
    id: "unshaped",
    title: "Unshaped owner inputs",
    rows: [
      {
        input: "Work item numbering policy",
        type: "Open Question",
        rank: "P1",
        order: "3",
        missingDecision: "Global or product-scoped key",
        suggestedOwner: "Mara",
        disabledAction: "Promote blocked until PM shapes numbering scope"
      },
      {
        input: "Owner visibility policy for Work items",
        type: "Open Question",
        rank: "P1",
        order: "4",
        missingDecision: "Which evidence can enter an owner handoff",
        suggestedOwner: "Mara",
        disabledAction: "Route action disabled; no owner handoff in this route"
      }
    ]
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
    label: pick(locale, page.title),
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
          meta: translatePhrase("PM freshness retry pending", locale),
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
          meta: translatePhrase("PM freshness retry pending", locale),
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
      ? { state: "local_only", label: pick(locale, workChromeCopy.accepted) }
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
      ? { state: "local_only", label: pick(locale, workChromeCopy.current) }
      : row.status === "pending refresh"
        ? { state: "blocked" }
        : { state: "review_required", label: translatePhrase(row.status, locale) }
  }));
}

function inspectorRelationships(locale: TcrnLocale, routeHref?: (path: string) => string): RelationshipChipProps[] {
  // The relation verb is DS copy and DS carries all five locales for it; the only
  // way to reach them is `locale`, so a chip built without one renders the
  // fallback verb ("blocks", "blocked by") on a translated page.
  const blockedBy: RelationshipChipProps = { relation: "blocked_by", target: "AOS-142", source: "AOS-144", locale };
  if (routeHref) {
    blockedBy.href = routeHref("/work/items/AOS-128");
  }
  return [
    { relation: "blocks", target: "Owner Inspection Handoff", source: "AOS-144", locale },
    blockedBy,
    { relation: "verifies", target: "EVD-41", source: "AOS-128", locale },
    { relation: "depends_on", target: "DS-88", source: "AOS-142", locale }
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

/**
 * The rest of this surface's chrome, in all five locales.
 *
 * `mockupChromeCopy` above is keyed by English phrase because `translatePhrase`
 * looks fixture strings up by their own text. These are different: they are
 * written directly at the call site, so they are keyed by what they label. Both
 * tables are `CopyEntry`, so neither can hold a string in fewer than five
 * languages; the split is about how the string is reached, not how complete it
 * has to be.
 */
const workChromeCopy = {
  accepted: { "zh-CN": "已接受", en: "Accepted", ja: "受理済み", ko: "수락됨", fr: "Accepté" },
  current: { "zh-CN": "当前", en: "Current", ja: "現行", ko: "현재", fr: "Actuel" },
  passed: { "zh-CN": "已通过", en: "Passed", ja: "通過", ko: "통과", fr: "Passé" },
  blocked: { "zh-CN": "阻塞", en: "Blocked", ja: "停止中", ko: "차단됨", fr: "Bloqué" },
  boundary: { "zh-CN": "边界", en: "Boundary", ja: "境界", ko: "경계", fr: "Frontière" },
  staticNoBackend: {
    "zh-CN": "静态 / 无后端",
    en: "Static / no backend",
    ja: "静的 / バックエンドなし",
    ko: "정적 / 백엔드 없음",
    fr: "Statique / aucun backend"
  },
  selected: { "zh-CN": "选中项", en: "Selected", ja: "選択中", ko: "선택됨", fr: "Sélectionné" },
  work: { "zh-CN": "工作", en: "Work", ja: "作業", ko: "작업", fr: "Travail" },
  route: { "zh-CN": "路由", en: "Route", ja: "ルート", ko: "라우트", fr: "Route" },
  staticAction: {
    "zh-CN": "静态动作",
    en: "Static action",
    ja: "静的な動作",
    ko: "정적 동작",
    fr: "Action statique"
  },
  workViews: {
    "zh-CN": "工作视图", en: "Work views", ja: "作業のビュー", ko: "작업 보기", fr: "Vues de travail"
  },
  workQuickFilters: {
    "zh-CN": "工作快速过滤",
    en: "Work quick filters",
    ja: "作業のクイックフィルター",
    ko: "작업 빠른 필터",
    fr: "Filtres rapides de travail"
  },
  priorityList: {
    "zh-CN": "优先工作列表",
    en: "Priority work list",
    ja: "優先作業リスト",
    ko: "우선 작업 목록",
    fr: "Liste de travail prioritaire"
  },
  queueAndPreview: {
    "zh-CN": "队列与详情预览",
    en: "Queue and detail preview",
    ja: "キューと詳細プレビュー",
    ko: "대기열과 상세 미리보기",
    fr: "File et aperçu du détail"
  },
  blockerChain: {
    "zh-CN": "阻塞链",
    en: "Blocker chain",
    ja: "阻害要因の連鎖",
    ko: "차단 요소 사슬",
    fr: "Chaîne de bloqueurs"
  },
  relationshipSummary: {
    "zh-CN": "关系摘要",
    en: "Relationship summary",
    ja: "関係の要約",
    ko: "관계 요약",
    fr: "Résumé des relations"
  },
  workBoard: {
    "zh-CN": "工作看板", en: "Work board", ja: "作業ボード", ko: "작업 보드", fr: "Tableau de travail"
  },
  boardFilters: {
    "zh-CN": "看板过滤",
    en: "Board filters",
    ja: "ボードのフィルター",
    ko: "보드 필터",
    fr: "Filtres du tableau"
  },
  staticGroupNote: {
    "zh-CN": "静态规划分组，无后端写入。",
    en: "Static planning group with no backend writes.",
    ja: "静的な計画グループで、バックエンドへの書き込みはありません。",
    ko: "백엔드 쓰기가 없는 정적 계획 그룹입니다.",
    fr: "Groupe de planification statique, sans écriture backend."
  },
  addStaticInput: {
    "zh-CN": "添加静态输入",
    en: "Add static input",
    ja: "静的な入力を追加",
    ko: "정적 입력 추가",
    fr: "Ajouter une entrée statique"
  },
  layoutOnlyHint: {
    "zh-CN": "仅展示布局，不创建后端记录。",
    en: "Layout only; no backend record is created.",
    ja: "レイアウトのみで、バックエンドの記録は作成されません。",
    ko: "레이아웃만 보여주며 백엔드 기록은 만들지 않습니다.",
    fr: "Mise en page seulement ; aucun enregistrement backend n'est créé."
  },
  boundaryConfirmation: {
    "zh-CN": "能力边界确认",
    en: "Capability boundary confirmation",
    ja: "能力境界の確認",
    ko: "역량 경계 확인",
    fr: "Confirmation de la frontière de capacité"
  },
  inspectorSummary: {
    "zh-CN": "该静态检查器在队列、看板和待整理页保持同一个选中工作项，并链接到完整详情页。",
    en: "This static inspector keeps the selected work item visible across queue, board, and backlog routes and links to the full detail page.",
    ja: "この静的なインスペクタは、キュー・ボード・バックログの各ルートで同じ選択中の作業項目を見せ続け、完全な詳細ページに繋ぎます。",
    ko: "이 정적 검사기는 대기열, 보드, 백로그 경로에서 선택된 작업 항목을 계속 보여주고 전체 상세 페이지로 연결합니다.",
    fr: "Cet inspecteur statique garde l'élément de travail sélectionné visible sur les routes file, tableau et backlog, et renvoie à la page de détail complète."
  },
  summary: { "zh-CN": "摘要", en: "Summary", ja: "要約", ko: "요약", fr: "Résumé" },
  selectedItem: {
    "zh-CN": "选中项", en: "Selected item", ja: "選択中の項目", ko: "선택된 항목", fr: "Élément sélectionné"
  },
  mode: { "zh-CN": "模式", en: "Mode", ja: "モード", ko: "모드", fr: "Mode" },
  modeValue: {
    "zh-CN": "桌面分栏；移动端详情路由",
    en: "Desktop split; mobile detail route",
    ja: "デスクトップは分割表示、モバイルは詳細ルート",
    ko: "데스크톱은 분할 표시, 모바일은 상세 경로",
    fr: "Écran partagé sur ordinateur ; route de détail sur mobile"
  },
  notIntegrated: {
    "zh-CN": "未接入", en: "Not integrated", ja: "未連携", ko: "미연동", fr: "Non intégré"
  },
  metadata: { "zh-CN": "元数据", en: "Metadata", ja: "メタデータ", ko: "메타데이터", fr: "Métadonnées" },
  useDetailRoute: {
    "zh-CN": "使用详情路由",
    en: "Use detail route",
    ja: "詳細ルートを使う",
    ko: "상세 경로 사용",
    fr: "Utiliser la route de détail"
  },
  consumedWorkComponents: {
    "zh-CN": "已消费的 DS Work 组件 / 模式",
    en: "Consumed DS Work components / patterns",
    ja: "消費した DS Work コンポーネント / パターン",
    ko: "소비한 DS Work 구성 요소 / 패턴",
    fr: "Composants / motifs DS Work consommés"
  },
  consumedWorkComponentsTable: {
    "zh-CN": "已消费的 DS Work 组件与模式",
    en: "Consumed DS Work components and patterns",
    ja: "消費した DS Work コンポーネントとパターン",
    ko: "소비한 DS Work 구성 요소와 패턴",
    fr: "Composants et motifs DS Work consommés"
  },
  consumedWorkIntro: {
    "zh-CN": "新版 Storybook 已正式收录 Work Management 组件。AOS 当前 Work 路由只消费公开 DS package API,不复制 Storybook 文档壳或自建可复用视觉系统。",
    en: "The new Storybook formally admits Work Management components. Current AOS Work routes consume public DS package APIs only; they do not copy Storybook doc-shell chrome or invent reusable local visual systems.",
    ja: "新しい Storybook は Work Management コンポーネントを正式に収録しました。現在の AOS Work ルートは公開 DS package API のみを消費し、Storybook のドキュメント外枠を複製したり、再利用可能な独自視覚系を作ったりはしません。",
    ko: "새 Storybook은 Work Management 구성 요소를 정식으로 수록했습니다. 현재 AOS Work 경로는 공개 DS package API만 소비하며, Storybook 문서 셸 크롬을 복제하거나 재사용 가능한 자체 시각 체계를 만들지 않습니다.",
    fr: "Le nouveau Storybook admet officiellement les composants Work Management. Les routes Work d'AOS ne consomment que les API publiques du package DS ; elles ne copient pas l'habillage du doc-shell Storybook et n'inventent pas de système visuel local réutilisable."
  },
  removeGlobalSearch: {
    "zh-CN": "移除顶栏全局搜索",
    en: "Remove unsupported global search",
    ja: "未対応の全体検索を取り除く",
    ko: "지원되지 않는 전역 검색 제거",
    fr: "Retirer la recherche globale non prise en charge"
  },
  hierarchy: { "zh-CN": "层级", en: "Hierarchy", ja: "階層", ko: "계층", fr: "Hiérarchie" },
  relationships: { "zh-CN": "关系", en: "Relationships", ja: "関係", ko: "관계", fr: "Relations" },
  gateSummary: {
    "zh-CN": "门禁摘要",
    en: "Gate summary",
    ja: "ゲートの要約",
    ko: "게이트 요약",
    fr: "Résumé des portes"
  },
  evidence: { "zh-CN": "证据", en: "Evidence", ja: "証拠", ko: "증거", fr: "Preuves" },
  activity: { "zh-CN": "活动", en: "Activity", ja: "活動", ko: "활동", fr: "Activité" },
  prepareInspection: {
    "zh-CN": "准备 Owner 检查包",
    en: "Prepare owner inspection package",
    ja: "owner 検査パッケージを用意する",
    ko: "owner 점검 패키지 준비",
    fr: "Préparer le dossier d'inspection owner"
  },
  gateAggregation: {
    "zh-CN": "门禁聚合",
    en: "Gate aggregation",
    ja: "ゲートの集約",
    ko: "게이트 집계",
    fr: "Agrégation des portes"
  },
  gatePipeline: {
    "zh-CN": "门禁流水线",
    en: "Gate pipeline",
    ja: "ゲートのパイプライン",
    ko: "게이트 파이프라인",
    fr: "Pipeline de portes"
  },
  evidenceCenter: {
    "zh-CN": "证据中心",
    en: "Evidence Center",
    ja: "証拠センター",
    ko: "증거 센터",
    fr: "Centre de preuves"
  },
  evidenceAttachments: {
    "zh-CN": "证据附件",
    en: "Evidence attachments",
    ja: "証拠の添付",
    ko: "증거 첨부",
    fr: "Pièces jointes de preuve"
  },
  codexActivityHeading: {
    "zh-CN": "Codex 活动附着在工作项下",
    en: "Codex Activity attaches to Work Items",
    ja: "Codex の活動は作業項目に紐づきます",
    ko: "Codex 활동은 작업 항목에 붙습니다",
    fr: "L'activité Codex se rattache aux éléments de travail"
  },
  savedViewHeading: {
    "zh-CN": "保存视图：Owner Feedback",
    en: "Saved view: Owner Feedback",
    ja: "保存したビュー：owner フィードバック",
    ko: "저장된 보기: owner 피드백",
    fr: "Vue enregistrée : retours owner"
  },
  savedViewFilters: {
    "zh-CN": "保存视图过滤",
    en: "Saved view filters",
    ja: "保存したビューのフィルター",
    ko: "저장된 보기 필터",
    fr: "Filtres de la vue enregistrée"
  },
  nextActions: {
    "zh-CN": "下一步动作", en: "Next actions", ja: "次の動作", ko: "다음 동작", fr: "Actions suivantes"
  },
  routeToIlya: {
    "zh-CN": "路由给 Ilya",
    en: "Route to Ilya",
    ja: "Ilya に回す",
    ko: "Ilya에게 전달",
    fr: "Router vers Ilya"
  },
  requestQa: {
    "zh-CN": "请求 QA", en: "Request QA", ja: "QA を依頼", ko: "QA 요청", fr: "Demander le QA"
  },
  viewGates: {
    "zh-CN": "查看门禁", en: "View gates", ja: "ゲートを見る", ko: "게이트 보기", fr: "Voir les portes"
  },
  workHierarchy: {
    "zh-CN": "工作层级", en: "Work hierarchy", ja: "作業の階層", ko: "작업 계층", fr: "Hiérarchie de travail"
  },
  relationshipVocabulary: {
    "zh-CN": "关系词汇",
    en: "Relationship vocabulary",
    ja: "関係の語彙",
    ko: "관계 어휘",
    fr: "Vocabulaire des relations"
  },
  prdHierarchy: {
    "zh-CN": "PRD 层级定义",
    en: "PRD hierarchy contract",
    ja: "PRD の階層定義",
    ko: "PRD 계층 정의",
    fr: "Contrat de hiérarchie PRD"
  },
  prdHierarchyIntro: {
    "zh-CN": "这些定义让静态示例区分可验收结果、可执行工作单和执行证据。",
    en: "These definitions keep acceptable outcomes, executable tickets, and execution evidence separate in the static mockups.",
    ja: "これらの定義は、受け入れ可能な成果・実行可能な作業票・実行の証拠を静的な見本の中で分けて保ちます。",
    ko: "이 정의들은 정적 목업 안에서 수락 가능한 결과, 실행 가능한 티켓, 실행 증거를 구분해 둡니다.",
    fr: "Ces définitions maintiennent séparés, dans les maquettes statiques, les résultats acceptables, les tickets exécutables et les preuves d'exécution."
  },
  hierarchyDefinitions: {
    "zh-CN": "层级定义",
    en: "Hierarchy definitions",
    ja: "階層の定義",
    ko: "계층 정의",
    fr: "Définitions de hiérarchie"
  },
  relations: { "zh-CN": "关系", en: "Relations", ja: "関係", ko: "관계", fr: "Relations" },
  codexActivityNote: {
    "zh-CN": "Codex Activity 是附着在 Work Item 下的执行/证据上下文，不替代 Story 或 Task / Work Item。",
    en: "Codex Activity is execution/evidence context attached to Work Items, not a replacement for Story or Task / Work Item.",
    ja: "Codex Activity は Work Item に紐づく実行／証拠の文脈であり、Story や Task / Work Item の代わりではありません。",
    ko: "Codex Activity는 Work Item에 붙는 실행/증거 문맥이며 Story나 Task / Work Item을 대신하지 않습니다.",
    fr: "Codex Activity est un contexte d'exécution/de preuve rattaché aux éléments de travail, non un remplacement de Story ou Task / Work Item."
  },
  cleanRoomReReview: {
    "zh-CN": "AOS 消费后仍需 clean-room 复审。",
    en: "Clean-room re-review remains required after AOS consumption.",
    ja: "AOS の消費後もクリーンルーム再レビューは必要です。",
    ko: "AOS 소비 후에도 클린룸 재검토가 필요합니다.",
    fr: "Une nouvelle revue en salle blanche reste requise après la consommation par AOS."
  }
} satisfies Record<string, CopyEntry>;

/**
 * The one counted sentence on this surface.
 *
 * Separate from `workChromeCopy` because it is a template, not a label: the count
 * lands at `{0}`, which is where each language actually puts it.
 */
const workChromeCounted = {
  sampleGatesClosed: {
    "zh-CN": "样本门已闭合 · {0}",
    en: "Sample gates closed · {0}",
    ja: "閉じた見本ゲート · {0}",
    ko: "닫힌 표본 게이트 · {0}",
    fr: "Portes d'exemple closes · {0}"
  }
} satisfies Record<string, CopyEntry>;

function workQuickFilters(pageId: WorkMockupPageId, locale: TcrnLocale, routeHref: (path: string) => string) {
  return [
    { id: "owner-feedback", label: translatePhrase("Owner Feedback", locale), value: "AOS-128", href: routeHref("/work/views/owner-feedback"), current: pageId === "ownerFeedbackView", count: 2 },
    { id: "blocked", label: pick(locale, workChromeCopy.blocked), value: translatePhrase("PM freshness retry pending", locale), href: routeHref("/work/gates"), current: pageId === "gates", count: 2 },
    { id: "no-live", label: pick(locale, workChromeCopy.boundary), value: pick(locale, workChromeCopy.staticNoBackend), disabled: true, disabledReason: translatePhrase("Static mockup only; route actions are not wired", locale) },
    { id: "selected", label: pick(locale, workChromeCopy.selected), value: "AOS-128", href: routeHref("/work/items/AOS-128"), current: pageId === "detail" }
  ];
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
  return pick(locale, page.title);
}

export function WorkManagementMockups({ path, locale, theme, collapsed, variant, viewport, routeHref }: WorkManagementMockupsProps) {
  const page = getWorkMockupPage(resolveWorkMockupPageId(path));
  const pageId = page.id;
  const showSplitInspector = viewport === "desktop";
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
      data-ds-work-components-anchor={workStorybookContractAnchors.componentsRoute}
      data-ds-work-patterns-anchor={workStorybookContractAnchors.patternsRoute}
      data-storybook-components-story-id={workStorybookContractAnchors.componentsStoryId}
      data-storybook-patterns-story-id={workStorybookContractAnchors.patternsStoryId}
      data-ai-consumption-contract-version={workStorybookContractAnchors.aiContractVersion}
      data-foundation-visual-standards-registry={workStorybookContractAnchors.foundationRegistryId}
      data-consumer-visual-style-contract={workStorybookContractAnchors.consumerVisualStyleContract}
      data-storybook-doc-shell-oracle={workStorybookContractAnchors.docShellOracle}
      data-work-static-authority-disposition={workStorybookContractAnchors.staticAuthorityDisposition}
      data-ds-knowledge-components-anchor={knowledgeStorybookContractAnchors.componentsRoute}
      data-storybook-knowledge-components-story-id={knowledgeStorybookContractAnchors.componentsStoryId}
      data-knowledge-static-authority-disposition={knowledgeStorybookContractAnchors.staticAuthorityDisposition}
      data-knowledge-management-ds-basis={knowledgeStorybookContractAnchors.dsBasis}
      data-design-system-knowledge-components="registered-package-components"
      data-product-local-knowledge-component-clones="absent"
      data-work-route-proof-targets={exactWorkRouteProofTargets.join(" ")}
      data-work-mobile-proof-targets={mobileWorkRouteProofTargets.join(" ")}
      data-work-clean-room-layout="tcrn-clean-room-work-layout-no-third-party-assets"
      data-design-system-work-components="registered-package-components"
      data-product-local-work-component-clones="absent"
      data-work-route-acceptance-target={page.path}
      data-work-management-page={pageId}
      data-work-management-route={page.path}
      data-visual-instance-variant-readback={variant}
      data-visual-instance-theme-readback={theme}
      data-visual-instance-collapsed-readback={collapsed ? "true" : "false"}
      data-work-split-inspector-viewport-policy={showSplitInspector ? "desktop-split" : "mobile-detail-route"}
    >
      <WorkRouteChrome page={page} pageId={pageId} locale={locale} routeHref={routeHref} />
      {renderWorkMockupPage(pageId, locale, routeHref, showSplitInspector)}
    </div>
  );
}

function WorkRouteChrome({
  page,
  pageId,
  locale,
  routeHref
}: {
  page: WorkMockupPage;
  pageId: WorkMockupPageId;
  locale: TcrnLocale;
  routeHref: (path: string) => string;
}) {
  return (
    <section data-work-route-chrome="compact-ds-public-exports" data-owner-quality-first-viewport="work-operational">
      <Heading level={1} visualLevel={2} id="work-heading" className="tcrn-aos-work-module-sr-only">
        {pick(locale, page.title)}
      </Heading>
      <WorkPageHeader
        title={pick(locale, page.title)}
        description={pick(locale, page.description)}
        breadcrumbs={[
          { id: "work", label: pick(locale, workChromeCopy.work), href: routeHref("/work") },
          { id: page.id, label: pick(locale, page.eyebrow) }
        ]}
        meta={<MachineTokenCell token={page.path} label={pick(locale, workChromeCopy.route)} kind="route" density="compact" />}
        actions={[
          {
            id: "route-action",
            label: pick(locale, workChromeCopy.staticAction),
            disabledReason: translatePhrase("Static mockup only; route actions are not wired", locale)
          }
        ]}
        density="compact"
      />
      <WorkViewTabs
        label={pick(locale, workChromeCopy.workViews)}
        tabs={workSubnavItems(pageId, locale, routeHref)}
      />
      <WorkQuickFilters
        label={pick(locale, workChromeCopy.workQuickFilters)}
        filters={workQuickFilters(pageId, locale, routeHref)}
      />
    </section>
  );
}

function renderWorkMockupPage(pageId: WorkMockupPageId, locale: TcrnLocale, routeHref: (path: string) => string, showSplitInspector: boolean) {
  switch (pageId) {
    case "board":
      return <BoardPage locale={locale} routeHref={routeHref} showSplitInspector={showSplitInspector} />;
    case "backlog":
      return <BacklogPage locale={locale} routeHref={routeHref} showSplitInspector={showSplitInspector} />;
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
      return <QueuePage locale={locale} routeHref={routeHref} showSplitInspector={showSplitInspector} />;
  }
}

function QueuePage({ locale, routeHref, showSplitInspector }: { locale: TcrnLocale; routeHref: (path: string) => string; showSplitInspector: boolean }) {
  const queueList = <WorkList rows={workListRows(locale, routeHref)} label={pick(locale, workChromeCopy.priorityList)} locale={locale} density="compact" />;
  return (
    <>
      <section data-aos-work-module-entry="owner-quality-work-queue" data-owner-quality-work-queue="true">
        {showSplitInspector ? (
          <WorkSplitView
            label={pick(locale, workChromeCopy.queueAndPreview)}
            list={queueList}
            detail={<SelectedItemDetailPreview locale={locale} routeHref={routeHref} />}
            density="compact"
          />
        ) : queueList}
      </section>
      <div className="tcrn-aos-work-module-secondary-grid">
        <WorkFieldPanel
          title={pick(locale, workChromeCopy.blockerChain)}
          items={blockerChainItems(locale)}
          density="compact"
        />
        <WorkFieldPanel
          title={pick(locale, workChromeCopy.relationshipSummary)}
          items={relationshipSummaryItems(locale).slice(0, 4)}
          density="compact"
        />
      </div>
    </>
  );
}

function BoardPage({ locale, routeHref, showSplitInspector }: { locale: TcrnLocale; routeHref: (path: string) => string; showSplitInspector: boolean }) {
  return (
    <>
      <section data-aos-work-module-entry="registered-ds-work-board">
        <WorkBoardView
          label={pick(locale, workChromeCopy.workBoard)}
          locale={locale}
          lanes={workBoardLanes(locale)}
          density="compact"
          toolbar={<WorkQuickFilters label={pick(locale, workChromeCopy.boardFilters)} filters={workQuickFilters("board", locale, routeHref)} />}
        />
      </section>
      {showSplitInspector ? <SelectedItemDetailPreview locale={locale} routeHref={routeHref} /> : null}
    </>
  );
}

function BacklogPage({ locale, routeHref, showSplitInspector }: { locale: TcrnLocale; routeHref: (path: string) => string; showSplitInspector: boolean }) {
  return (
    <>
      <BacklogGroupSections locale={locale} />
      {showSplitInspector ? <SelectedItemDetailPreview locale={locale} routeHref={routeHref} /> : null}
      <RegisteredDsWorkComponentsSection locale={locale} />
    </>
  );
}

function BacklogGroupSections({ locale }: { locale: TcrnLocale }) {
  return (
    <div className="tcrn-product-shell-section-grid" data-work-backlog-groups="shaped-unshaped">
      {backlogGroups.map((group) => (
        <div key={group.id} data-work-backlog-group={group.id}>
          <WorkBacklogGroup
            title={translatePhrase(group.title, locale)}
            locale={locale}
            description={pick(locale, workChromeCopy.staticGroupNote)}
            rows={backlogRowsForGroup(group, locale)}
            actions={[{ id: "route", label: pick(locale, workChromeCopy.route), disabledReason: translatePhrase("Route action disabled in static fixture", locale) }]}
            inlineCreate={{
              label: pick(locale, workChromeCopy.addStaticInput),
              disabledReason: translatePhrase(group.rows[0]?.disabledAction ?? "Static mockup only; route actions are not wired", locale),
              hint: pick(locale, workChromeCopy.layoutOnlyHint)
            }}
            density="compact"
          />
        </div>
      ))}
    </div>
  );
}

function SelectedItemDetailPreview({ locale, routeHref }: { locale: TcrnLocale; routeHref: (path: string) => string }) {
  return (
    <div data-work-split-inspector="AOS-128" data-work-split-inspector-mode="desktop-split-mobile-full-route">
      <WorkDetailLayout
        title={`AOS-128 · ${pick(locale, workChromeCopy.boundaryConfirmation)}`}
        summary={locale === "zh-CN"
          ? "该静态检查器在队列、看板和待整理页保持同一个选中工作项，并链接到完整详情页。"
          : "This static inspector keeps the selected work item visible across queue, board, and backlog routes and links to the full detail page."}
        state={{ state: "review_required" }}
        locale={locale}
        main={<WorkFieldPanel title={pick(locale, workChromeCopy.summary)} items={[
          { key: "selected", label: pick(locale, workChromeCopy.selectedItem), value: <LinkButton href={routeHref("/work/items/AOS-128")} variant="secondary">AOS-128</LinkButton> },
          { key: "mode", label: pick(locale, workChromeCopy.mode), value: pick(locale, workChromeCopy.modeValue) },
          { key: "api", label: "API", value: pick(locale, workChromeCopy.notIntegrated) }
        ]} density="compact" />}
        metadata={<MetadataRail title={pick(locale, workChromeCopy.metadata)} items={detailMetadataItems(locale)} density="compact" />}
        activity={<WorkActivityFeed locale={locale} items={activityItems(locale).slice(0, 2)} density="compact" />}
        actions={[
          {
            id: "open-detail",
            label: pick(locale, workChromeCopy.useDetailRoute),
            disabledReason: translatePhrase("Static mockup only; route actions are not wired", locale)
          }
        ]}
        density="compact"
      />
    </div>
  );
}

function RegisteredDsWorkComponentsSection({ locale }: { locale: TcrnLocale }) {
  return (
    <Surface
      data-registered-ds-work-components="true"
      data-registered-ds-work-components-implementation="package-consumed-storybook-first"
      data-registered-ds-work-components-count={registeredDsWorkComponentRows.length}
    >
      <Heading level={2}>{pick(locale, workChromeCopy.consumedWorkComponents)}</Heading>
      <Text>
        {locale === "zh-CN"
          ? "新版 Storybook 已正式收录 Work Management 组件。AOS 当前 Work 路由只消费公开 DS package API，不复制 Storybook 文档壳或自建可复用视觉系统。"
          : "The new Storybook formally admits Work Management components. Current AOS Work routes consume public DS package APIs only; they do not copy Storybook doc-shell chrome or invent reusable local visual systems."}
      </Text>
      <TableShell
        label={pick(locale, workChromeCopy.consumedWorkComponentsTable)}
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

/**
 * Knowledge-packet copy in all five locales.
 *
 * This section is the file's largest single concentration of chrome: labels,
 * headings, and state words on eleven DS Knowledge components. Every one of them
 * was a two-branch ternary, and three carry the packet's refusals — no backend,
 * no persistence, no live dispatch, nothing claimed about acceptance. Those are
 * the sentences that keep a static fixture from reading as a working feature, so
 * they are exactly the ones that must not be English on a ja, ko or fr route.
 */
const knowledgePacketCopy = {
  static: { "zh-CN": "静态", en: "Static", ja: "静的", ko: "정적", fr: "Statique" },
  dsPublicExports: {
    "zh-CN": "DS 公开导出",
    en: "DS public exports",
    ja: "DS の公開エクスポート",
    ko: "DS 공개 내보내기",
    fr: "Exports publics DS"
  },
  noBackend: {
    "zh-CN": "无后端",
    en: "No backend",
    ja: "バックエンドなし",
    ko: "백엔드 없음",
    fr: "Aucun backend"
  },
  runbookTitle: {
    "zh-CN": "AOS Work 检查运行手册",
    en: "AOS Work inspection runbook",
    ja: "AOS Work 検査の運用手順書",
    ko: "AOS Work 점검 런북",
    fr: "Manuel d'inspection AOS Work"
  },
  proofReadbacks: {
    "zh-CN": "证明读回",
    en: "Proof readbacks",
    ja: "証明の読み戻し",
    ko: "증명 읽기 확인",
    fr: "Relectures de preuve"
  },
  staticFixture: {
    "zh-CN": "静态 fixture",
    en: "Static fixture",
    ja: "静的 fixture",
    ko: "정적 fixture",
    fr: "Fixture statique"
  },
  routeActivity: {
    "zh-CN": "Route 活动",
    en: "Route activity",
    ja: "Route の活動",
    ko: "Route 활동",
    fr: "Activité de route"
  },
  scopeHeading: {
    "zh-CN": "消费范围",
    en: "Consumption scope",
    ja: "消費の範囲",
    ko: "소비 범위",
    fr: "Périmètre de consommation"
  },
  scopeBody: {
    "zh-CN": "AOS 仅消费 Meridian / Knowledge Management 的公开 DS 导出，用于把工作项上下文、证明和静态知识说明放在同一个详情页。",
    en: "AOS consumes Meridian / Knowledge Management public DS exports only, placing Work context, proof, and static knowledge notes in the same detail route.",
    ja: "AOS は Meridian / Knowledge Management の公開 DS エクスポートのみを消費し、作業項目の文脈・証明・静的なナレッジ注記を同一の詳細ルートに置きます。",
    ko: "AOS는 Meridian / Knowledge Management의 공개 DS 내보내기만 소비하여 작업 항목 문맥, 증명, 정적 지식 노트를 같은 상세 경로에 놓습니다.",
    fr: "AOS ne consomme que les exports DS publics de Meridian / Knowledge Management, réunissant le contexte de travail, la preuve et les notes de connaissance statiques sur la même route de détail."
  },
  boundaryHeading: { "zh-CN": "边界", en: "Boundary", ja: "境界", ko: "경계", fr: "Frontière" },
  boundaryBody: {
    "zh-CN": "该区域不接入 Knowledge 后端、持久化、全局搜索、外部工作区或 live dispatch；Owner、Product、final MVP 与 release acceptance 均未声明。",
    en: "This region wires no Knowledge backend, persistence, global search, external workspace, or live dispatch; owner, product, final MVP, and release acceptance are not claimed.",
    ja: "この領域は Knowledge のバックエンド・永続化・全体検索・外部ワークスペース・実時間ディスパッチのいずれも接続しません。owner・product・final MVP・release acceptance はいずれも宣言しません。",
    ko: "이 영역은 Knowledge 백엔드, 영속화, 전역 검색, 외부 워크스페이스, 실시간 디스패치를 모두 연결하지 않습니다. owner, product, final MVP, release acceptance는 어느 것도 선언하지 않습니다.",
    fr: "Cette zone ne raccorde ni backend Knowledge, ni persistance, ni recherche globale, ni espace de travail externe, ni répartition en direct ; ni owner, ni product, ni final MVP, ni release acceptance ne sont revendiqués."
  },
  nextProofHeading: {
    "zh-CN": "下一步证明",
    en: "Next proof",
    ja: "次の証明",
    ko: "다음 증명",
    fr: "Preuve suivante"
  },
  nextProofBody: {
    "zh-CN": "下一步应由 Sable、Talia、Elara、Rowan 和 Verity 复核 AOS 消费结果，再由 Atlas 处理保留预览刷新。",
    en: "Next review should route Sable, Talia, Elara, Rowan, and Verity over this AOS consumption result before Atlas handles retained preview refresh.",
    ja: "次のレビューでは Sable・Talia・Elara・Rowan・Verity がこの AOS 消費結果を確認し、その後 Atlas が保持プレビューの更新を扱います。",
    ko: "다음 검토에서는 Sable, Talia, Elara, Rowan, Verity가 이 AOS 소비 결과를 확인하고, 그다음 Atlas가 보존된 미리보기 갱신을 처리합니다.",
    fr: "La prochaine revue doit faire passer Sable, Talia, Elara, Rowan et Verity sur ce résultat de consommation AOS, avant qu'Atlas ne traite l'actualisation de l'aperçu conservé."
  },
  reviewPending: {
    "zh-CN": "待复核",
    en: "Review pending",
    ja: "レビュー待ち",
    ko: "검토 대기",
    fr: "Revue en attente"
  },
  acceptanceNotClaimed: {
    "zh-CN": "未声明接受",
    en: "Acceptance not claimed",
    ja: "受理は宣言されていません",
    ko: "수락은 선언되지 않음",
    fr: "Acceptation non revendiquée"
  },
  commentOne: {
    "zh-CN": "使用公开 DS Knowledge 组件补齐工作项知识上下文，不复制 Storybook 文档壳。",
    en: "Use public DS Knowledge components for Work-item knowledge context without copying Storybook doc-shell chrome.",
    ja: "作業項目のナレッジ文脈には公開 DS Knowledge コンポーネントを使い、Storybook のドキュメント外枠は複製しません。",
    ko: "작업 항목의 지식 문맥에는 공개 DS Knowledge 구성 요소를 사용하고 Storybook 문서 셸 크롬은 복제하지 않습니다.",
    fr: "Utiliser les composants publics DS Knowledge pour le contexte de connaissance d'un élément de travail, sans copier l'habillage du doc-shell Storybook."
  },
  commentTwo: {
    "zh-CN": "保持 clean-room 边界：无第三方品牌、资产、类名、截图或外部集成。",
    en: "Keep the clean-room boundary: no third-party brand, assets, classes, screenshots, or external integration.",
    ja: "クリーンルームの境界を保ちます：第三者のブランド・資産・クラス名・スクリーンショット・外部連携はいずれもありません。",
    ko: "클린룸 경계를 유지합니다. 제3자 브랜드, 자산, 클래스명, 스크린샷, 외부 연동은 없습니다.",
    fr: "Conserver la frontière en salle blanche : aucune marque, ressource, classe, capture d'écran ni intégration externe de tiers."
  },
  versionOne: {
    "zh-CN": "Meridian DS 知识组件消费",
    en: "Meridian DS Knowledge component consumption",
    ja: "Meridian DS ナレッジ・コンポーネントの消費",
    ko: "Meridian DS 지식 구성 요소 소비",
    fr: "Consommation des composants Knowledge DS Meridian"
  },
  versionZero: {
    "zh-CN": "Work 密度布局消费",
    en: "Work density layout consumption",
    ja: "Work 密度レイアウトの消費",
    ko: "Work 밀도 레이아웃 소비",
    fr: "Consommation de la mise en page dense Work"
  },
  localProofOnly: {
    "zh-CN": "仅本地证明",
    en: "Local proof only",
    ja: "ローカル証明のみ",
    ko: "로컬 증명만",
    fr: "Preuve locale seulement"
  },
  resultProofTitle: {
    "zh-CN": "证明与门禁读回",
    en: "Proof and gate readback",
    ja: "証明とゲートの読み戻し",
    ko: "증명과 게이트 읽기 확인",
    fr: "Relecture de la preuve et des portes"
  },
  resultProofExcerpt: {
    "zh-CN": "静态结果引用 AOS Work 证明和门禁上下文，不连接产品级或外部搜索索引。",
    en: "Static result references AOS Work proof and gate context without product-wide or external search indexing.",
    ja: "静的な結果は AOS Work の証明とゲート文脈を参照しますが、製品全体や外部の検索索引には接続しません。",
    ko: "정적 결과는 AOS Work 증명과 게이트 문맥을 참조하지만 제품 전체나 외부 검색 색인에는 연결하지 않습니다.",
    fr: "Le résultat statique référence la preuve et le contexte de porte AOS Work, sans indexation de recherche à l'échelle du produit ni externe."
  },
  proof: { "zh-CN": "证明", en: "Proof", ja: "証明", ko: "증명", fr: "Preuve" },
  staticResult: {
    "zh-CN": "静态结果",
    en: "Static result",
    ja: "静的な結果",
    ko: "정적 결과",
    fr: "Résultat statique"
  },
  resultActivityTitle: {
    "zh-CN": "执行活动说明",
    en: "Execution activity notes",
    ja: "実行活動の注記",
    ko: "실행 활동 노트",
    fr: "Notes d'activité d'exécution"
  },
  resultActivityExcerpt: {
    "zh-CN": "静态结果指向 route 活动说明；不会触发 live dispatch 或外部动作。",
    en: "Static result links to route activity notes; it does not trigger live dispatch or external action.",
    ja: "静的な結果は route の活動注記に繋がるだけで、実時間ディスパッチや外部動作は起こしません。",
    ko: "정적 결과는 route 활동 노트로 연결될 뿐 실시간 디스패치나 외부 동작을 일으키지 않습니다.",
    fr: "Le résultat statique renvoie aux notes d'activité de route ; il ne déclenche ni répartition en direct ni action externe."
  },
  activity: { "zh-CN": "活动", en: "Activity", ja: "活動", ko: "활동", fr: "Activité" },
  noLive: {
    "zh-CN": "无 live",
    en: "No live",
    ja: "live なし",
    ko: "live 없음",
    fr: "Aucun direct"
  },
  noExternalAction: {
    "zh-CN": "无外部动作",
    en: "No external action",
    ja: "外部動作なし",
    ko: "외부 동작 없음",
    fr: "Aucune action externe"
  },
  packetHeading: {
    "zh-CN": "Knowledge 支持包",
    en: "Knowledge support packet",
    ja: "Knowledge 支援パケット",
    ko: "Knowledge 지원 패킷",
    fr: "Dossier de soutien Knowledge"
  },
  packetIntro: {
    "zh-CN": "该详情区域消费 DS Meridian / Knowledge Management 公开组件，把静态知识说明、门禁证明和工作项上下文放在一起；不声明 owner/product/release 接受。",
    en: "This detail region consumes DS Meridian / Knowledge Management public components to place static knowledge notes, gate proof, and Work-item context together; it does not claim owner, product, or release acceptance.",
    ja: "この詳細領域は DS Meridian / Knowledge Management の公開コンポーネントを消費し、静的なナレッジ注記・ゲート証明・作業項目の文脈をまとめて置きます。owner・product・release の受理は宣言しません。",
    ko: "이 상세 영역은 DS Meridian / Knowledge Management 공개 구성 요소를 소비하여 정적 지식 노트, 게이트 증명, 작업 항목 문맥을 함께 놓습니다. owner, product, release 수락은 선언하지 않습니다.",
    fr: "Cette zone de détail consomme les composants publics DS Meridian / Knowledge Management pour réunir notes de connaissance statiques, preuve de porte et contexte d'élément de travail ; elle ne revendique ni acceptation owner, ni product, ni release."
  },
  pageTree: {
    "zh-CN": "知识页面树",
    en: "Knowledge page tree",
    ja: "ナレッジのページツリー",
    ko: "지식 페이지 트리",
    fr: "Arbre des pages Knowledge"
  },
  noteTitle: {
    "zh-CN": "AOS-128 静态知识说明",
    en: "AOS-128 static knowledge note",
    ja: "AOS-128 静的ナレッジ注記",
    ko: "AOS-128 정적 지식 노트",
    fr: "Note de connaissance statique AOS-128"
  },
  noteSummary: {
    "zh-CN": "从 DS `d385428` 消费公开 Knowledge 组件；保留预览新鲜度仍由 Atlas/source marker 判定。",
    en: "Consumes public Knowledge components from DS `d385428`; retained-preview freshness remains determined by Atlas/source markers.",
    ja: "DS `d385428` の公開 Knowledge コンポーネントを消費します。保持プレビューの鮮度は依然として Atlas/source marker が判定します。",
    ko: "DS `d385428`의 공개 Knowledge 구성 요소를 소비합니다. 보존된 미리보기의 신선도는 여전히 Atlas/source marker가 판정합니다.",
    fr: "Consomme les composants Knowledge publics de DS `d385428` ; la fraîcheur de l'aperçu conservé reste déterminée par les marqueurs Atlas/source."
  },
  onThisPage: {
    "zh-CN": "本页目录",
    en: "On this page",
    ja: "このページの目次",
    ko: "이 페이지 목차",
    fr: "Sur cette page"
  },
  metadataTitle: {
    "zh-CN": "知识元数据",
    en: "Knowledge metadata",
    ja: "ナレッジのメタデータ",
    ko: "지식 메타데이터",
    fr: "Métadonnées Knowledge"
  },
  source: { "zh-CN": "来源", en: "Source", ja: "出典", ko: "출처", fr: "Source" },
  sourceValue: {
    "zh-CN": "AOS 静态 fixture",
    en: "AOS static fixture",
    ja: "AOS の静的 fixture",
    ko: "AOS 정적 fixture",
    fr: "Fixture statique AOS"
  },
  state: { "zh-CN": "状态", en: "State", ja: "状態", ko: "상태", fr: "État" },
  backend: { "zh-CN": "后端", en: "Backend", ja: "バックエンド", ko: "백엔드", fr: "Backend" },
  notIntegrated: {
    "zh-CN": "未接入",
    en: "Not integrated",
    ja: "未連携",
    ko: "미연동",
    fr: "Non intégré"
  },
  acceptance: { "zh-CN": "接受", en: "Acceptance", ja: "受理", ko: "수락", fr: "Acceptation" },
  notClaimed: {
    "zh-CN": "未声明",
    en: "Not claimed",
    ja: "宣言なし",
    ko: "선언 없음",
    fr: "Non revendiqué"
  },
  routeReview: {
    "zh-CN": "路由复核",
    en: "Route review",
    ja: "ルートの再確認",
    ko: "라우트 재검토",
    fr: "Revue de route"
  },
  staticComments: {
    "zh-CN": "静态评论",
    en: "Static comments",
    ja: "静的なコメント",
    ko: "정적 댓글",
    fr: "Commentaires statiques"
  },
  staticVersions: {
    "zh-CN": "静态版本",
    en: "Static versions",
    ja: "静的な版",
    ko: "정적 버전",
    fr: "Versions statiques"
  },
  staticResults: {
    "zh-CN": "静态知识结果",
    en: "Static knowledge results",
    ja: "静的なナレッジ検索結果",
    ko: "정적 지식 결과",
    fr: "Résultats Knowledge statiques"
  },
  knowledgeLabels: {
    "zh-CN": "知识标签",
    en: "Knowledge labels",
    ja: "ナレッジのラベル",
    ko: "지식 레이블",
    fr: "Étiquettes Knowledge"
  },
  consumedComponents: {
    "zh-CN": "已消费的 DS Knowledge 组件",
    en: "Consumed DS Knowledge components",
    ja: "消費した DS Knowledge コンポーネント",
    ko: "소비한 DS Knowledge 구성 요소",
    fr: "Composants Knowledge DS consommés"
  }
} satisfies Record<string, CopyEntry>;

function KnowledgeManagementSupportSection({ locale, routeHref }: { locale: TcrnLocale; routeHref: (path: string) => string }) {
  const labels = [
    pick(locale, knowledgePacketCopy.static),
    pick(locale, knowledgePacketCopy.dsPublicExports),
    pick(locale, knowledgePacketCopy.noBackend)
  ];
  const pageTreeItems = [
    {
      id: "aos-work-runbook",
      title: pick(locale, knowledgePacketCopy.runbookTitle),
      href: routeHref("/work/items/AOS-128"),
      current: true,
      // The state label goes through `translatePhrase`, not a local entry: this
      // exact gate name is asserted by the shell proof and already lives in
      // `mockupChromeCopy`, so a second copy of it here would be two sources for
      // one string and only one of them would get the next correction.
      state: { state: "review_required", label: translatePhrase("PM freshness retry pending", locale) }
    },
    {
      id: "proof-receipts",
      title: pick(locale, knowledgePacketCopy.proofReadbacks),
      href: routeHref("/work/evidence"),
      state: { state: "local_only", label: pick(locale, knowledgePacketCopy.staticFixture) }
    },
    {
      id: "route-activity",
      title: pick(locale, knowledgePacketCopy.routeActivity),
      href: routeHref("/work/codex-activity")
    }
  ];
  const documentSections = [
    {
      id: "scope",
      heading: pick(locale, knowledgePacketCopy.scopeHeading),
      body: pick(locale, knowledgePacketCopy.scopeBody)
    },
    {
      id: "boundary",
      heading: pick(locale, knowledgePacketCopy.boundaryHeading),
      body: pick(locale, knowledgePacketCopy.boundaryBody)
    },
    {
      id: "next-proof",
      heading: pick(locale, knowledgePacketCopy.nextProofHeading),
      body: pick(locale, knowledgePacketCopy.nextProofBody)
    }
  ];
  const tocItems = documentSections.map((section, index) => ({
    id: section.id,
    label: section.heading,
    href: `#${section.id}`,
    current: index === 0
  }));
  const comments = [
    {
      id: "knowledge-comment-1",
      author: "Ilya",
      body: pick(locale, knowledgePacketCopy.commentOne),
      timestamp: "2026-07-05",
      state: { state: "review_required", label: pick(locale, knowledgePacketCopy.reviewPending) }
    },
    {
      id: "knowledge-comment-2",
      author: "Sable",
      body: pick(locale, knowledgePacketCopy.commentTwo),
      timestamp: "pending",
      state: { state: "not_claimed", label: pick(locale, knowledgePacketCopy.acceptanceNotClaimed) }
    }
  ];
  const versions = [
    {
      id: "knowledge-v1",
      title: pick(locale, knowledgePacketCopy.versionOne),
      author: "Ilya",
      timestamp: "source repair",
      state: { state: "review_required", label: pick(locale, knowledgePacketCopy.reviewPending) }
    },
    {
      id: "knowledge-v0",
      title: pick(locale, knowledgePacketCopy.versionZero),
      author: "Ilya",
      timestamp: "previous basis",
      state: { state: "local_only", label: pick(locale, knowledgePacketCopy.localProofOnly) }
    }
  ];
  const searchResults = [
    {
      id: "knowledge-result-proof",
      title: pick(locale, knowledgePacketCopy.resultProofTitle),
      href: routeHref("/work/evidence"),
      excerpt: pick(locale, knowledgePacketCopy.resultProofExcerpt),
      labels: [pick(locale, knowledgePacketCopy.proof), pick(locale, knowledgePacketCopy.static)],
      state: { state: "local_only", label: pick(locale, knowledgePacketCopy.staticResult) }
    },
    {
      id: "knowledge-result-activity",
      title: pick(locale, knowledgePacketCopy.resultActivityTitle),
      href: routeHref("/work/codex-activity"),
      excerpt: pick(locale, knowledgePacketCopy.resultActivityExcerpt),
      labels: [pick(locale, knowledgePacketCopy.activity), pick(locale, knowledgePacketCopy.noLive)],
      state: { state: "not_claimed", label: pick(locale, knowledgePacketCopy.noExternalAction) }
    }
  ];

  return (
    <Surface
      data-aos-knowledge-management-consumption="public-ds-exports-v1"
      data-knowledge-management-api-integration="absent"
      data-knowledge-management-live-dispatch="not-enabled"
      data-knowledge-management-backend-persistence="absent"
      data-knowledge-management-global-search="not-rendered"
      data-knowledge-management-external-integration="absent"
      data-knowledge-management-ds-basis={knowledgeStorybookContractAnchors.dsBasis}
      data-ds-knowledge-components-anchor={knowledgeStorybookContractAnchors.componentsRoute}
      data-storybook-knowledge-components-story-id={knowledgeStorybookContractAnchors.componentsStoryId}
      data-knowledge-static-authority-disposition={knowledgeStorybookContractAnchors.staticAuthorityDisposition}
      data-registered-ds-knowledge-components-count={registeredDsKnowledgeComponentRows.length}
      data-registered-ds-knowledge-components={registeredDsKnowledgeComponentRows.map((row) => row.componentName).join(" ")}
      data-product-local-knowledge-component-clones="absent"
      data-clean-room-knowledge-boundary="tcrn-clean-room-knowledge-no-third-party-assets"
    >
      <Heading level={2}>{pick(locale, knowledgePacketCopy.packetHeading)}</Heading>
      <Text>{pick(locale, knowledgePacketCopy.packetIntro)}</Text>
      <div className="tcrn-aos-work-module-secondary-grid">
        <KnowledgePageTree
          label={pick(locale, knowledgePacketCopy.pageTree)}
          items={pageTreeItems}
          density="compact"
        />
        <KnowledgeDocumentCanvas
          title={pick(locale, knowledgePacketCopy.noteTitle)}
          summary={pick(locale, knowledgePacketCopy.noteSummary)}
          labels={labels}
          meta={<MachineTokenCell token={knowledgeStorybookContractAnchors.dsBasis} label="DS" kind="commit" density="compact" />}
          sections={documentSections}
          density="compact"
        />
      </div>
      <div className="tcrn-aos-work-module-secondary-grid">
        <KnowledgeTocRail label={pick(locale, knowledgePacketCopy.onThisPage)} items={tocItems} density="compact" />
        <KnowledgeMetadataRail
          title={pick(locale, knowledgePacketCopy.metadataTitle)}
          labels={labels}
          items={[
            { key: "ds", label: "DS", value: <MachineTokenCell token={knowledgeStorybookContractAnchors.dsBasis} label="Knowledge" kind="commit" density="compact" /> },
            { key: "source", label: pick(locale, knowledgePacketCopy.source), value: pick(locale, knowledgePacketCopy.sourceValue) },
            { key: "state", label: pick(locale, knowledgePacketCopy.state), value: translatePhrase("PM freshness retry pending", locale) },
            { key: "backend", label: pick(locale, knowledgePacketCopy.backend), value: pick(locale, knowledgePacketCopy.notIntegrated) },
            { key: "acceptance", label: pick(locale, knowledgePacketCopy.acceptance), value: pick(locale, knowledgePacketCopy.notClaimed) }
          ]}
          actions={[
            {
              id: "route-review",
              label: pick(locale, knowledgePacketCopy.routeReview),
              disabledReason: translatePhrase("Static mockup only; route actions are not wired", locale)
            }
          ]}
          density="compact"
        />
      </div>
      <div className="tcrn-aos-work-module-secondary-grid">
        <KnowledgeInlineCommentList label={pick(locale, knowledgePacketCopy.staticComments)} comments={comments} density="compact" />
        <KnowledgeVersionHistory label={pick(locale, knowledgePacketCopy.staticVersions)} versions={versions} density="compact" />
      </div>
      <div className="tcrn-aos-work-module-secondary-grid">
        <KnowledgeSearchResults label={pick(locale, knowledgePacketCopy.staticResults)} results={searchResults} density="compact" />
        <div
          data-registered-ds-knowledge-components="true"
          data-registered-ds-knowledge-components-implementation="package-consumed-public-exports"
          data-registered-ds-knowledge-components-count={registeredDsKnowledgeComponentRows.length}
        >
          <KnowledgeLabelSet labels={labels} label={pick(locale, knowledgePacketCopy.knowledgeLabels)} density="compact" />
          <TableShell
            label={pick(locale, knowledgePacketCopy.consumedComponents)}
            columns={columns(locale, ["name", "whereUsed", "consumptionDisposition", "dsLevel"])}
            rows={registeredDsKnowledgeComponentRows.map((row) => ({
              name: <RegisteredDsKnowledgeComponentNameCell item={row} />,
              whereUsed: row.whereUsed,
              consumptionDisposition: translatePhrase(row.consumptionDisposition, locale),
              dsLevel: row.dsLevel
            }))}
          />
        </div>
      </div>
    </Surface>
  );
}

function RegisteredDsKnowledgeComponentNameCell({ item }: { item: RegisteredDsKnowledgeComponentFixture }) {
  return (
    <span
      data-registered-ds-knowledge-component-item="true"
      data-registered-ds-knowledge-component-name={item.componentName}
      data-registered-ds-knowledge-component-candidate-id={item.candidateId}
      data-registered-ds-knowledge-component-purpose={item.purpose}
      data-registered-ds-knowledge-component-where-used={item.whereUsed}
      data-registered-ds-knowledge-component-disposition={item.consumptionDisposition}
      data-registered-ds-knowledge-component-level={item.dsLevel}
    >
      {item.componentName}
    </span>
  );
}

function DetailPage({ locale, routeHref }: { locale: TcrnLocale; routeHref: (path: string) => string }) {
  return (
    <WorkDetailLayout
      title={`AOS-128 · ${pick(locale, workChromeCopy.removeGlobalSearch)}`}
      summary={locale === "zh-CN"
        ? "Owner 认可：AOS 没有真实全局搜索能力，不应展示顶栏搜索框或全局搜索快捷键。"
        : "Owner-approved scope: AOS has no real global search capability, so the shell must not render topbar search or a global search shortcut."}
      state={{ state: "blocked", label: translatePhrase("PM freshness retry pending", locale) }}
      main={<div className="tcrn-aos-work-module-detail-stack">
        <WorkFieldPanel title={pick(locale, workChromeCopy.hierarchy)} items={[
          // `Initiative`, `Epic` and `Story` are the governance model's own record
          // kinds and stay Latin here for the same reason the real modules leave
          // them Latin: they are the names of chain record types, not descriptions
          // of them. `Work Item` is the exception — the real work-items module says
          // 工作项 / 作業項目, so a mockup that says "Work Item" beside them is the
          // odd one out rather than the consistent one.
          { key: "initiative", label: "Initiative", value: "AOS product shell recovery" },
          { key: "epic", label: "Epic", value: "Product Shell Owner Feedback Recovery" },
          { key: "story", label: "Story", value: translatePhrase("Owner can inspect an AOS shell without fake global search", locale) },
          { key: "workItem", label: translatePhrase("Work Item", locale), value: <MachineToken token="AOS-128" kind="work-item" /> }
        ]} density="compact" />
        <WorkFieldPanel title={pick(locale, workChromeCopy.relationships)} items={inspectorRelationships(locale, routeHref).map((relationship, index) => ({
          key: `${relationship.relation}-${index}`,
          label: relationship.relation,
          value: <RelationshipChip locale={locale} {...relationship} source={relationship.source ?? "AOS-128"} />
        }))} density="compact" />
        <GatePipelineCompact label={pick(locale, workChromeCopy.gateSummary)} locale={locale} gates={workGatePipeline(locale).slice(0, 5)} />
        <EvidenceAttachmentList label={pick(locale, workChromeCopy.evidence)} locale={locale} items={evidenceAttachments(locale)} density="compact" />
        <KnowledgeManagementSupportSection locale={locale} routeHref={routeHref} />
      </div>}
      metadata={<MetadataRail title={pick(locale, workChromeCopy.metadata)} items={detailMetadataItems(locale)} density="compact" />}
      activity={<WorkActivityFeed label={pick(locale, workChromeCopy.activity)} locale={locale} items={activityItems(locale)} density="compact" />}
      actions={[
        {
          id: "prepare-owner-package",
          label: pick(locale, workChromeCopy.prepareInspection),
          disabledReason: translatePhrase("PM freshness retry pending; owner and product acceptance are not claimed.", locale)
        }
      ]}
      density="compact"
    />
  );
}

function GatesPage({ locale }: { locale: TcrnLocale }) {
  // Design-system Stamp adoption at the gate-close identity moment. These are sample
  // gates that reached their reviewed terminal state; the stamp gives that moment the
  // identity treatment the design system reserves for it, at the same claim strength
  // as the local_only "Accepted" badge the pipeline already renders. It asserts no
  // real product acceptance or release state — the page stays inside AOS's
  // read-only sample-data frame, and the release moment is deliberately not used.
  const closedSampleGateCount = gateRows.filter((row) => row.state === "accepted").length;
  return (
    <Surface data-work-gates-page="true">
      <Heading level={2}>{pick(locale, workChromeCopy.gateAggregation)}</Heading>
      <div data-work-gate-stamp="gate-close">
        <Stamp moment="gate-close">
          {/* A counted sentence, so `format` rather than `pick`: the number sits
              before the noun in some of these languages and after it in others,
              and a template built by concatenation can only put it in one place. */}
          {format(locale, workChromeCounted.sampleGatesClosed, closedSampleGateCount)}
        </Stamp>
        <StampRule />
      </div>
      <GatePipelineCompact label={pick(locale, workChromeCopy.gatePipeline)} locale={locale} gates={workGatePipeline(locale)} />
    </Surface>
  );
}

function EvidencePage({ locale }: { locale: TcrnLocale }) {
  return (
    <Surface data-work-evidence-page="true">
      <Heading level={2}>{pick(locale, workChromeCopy.evidenceCenter)}</Heading>
      <EvidenceAttachmentList
        label={pick(locale, workChromeCopy.evidenceAttachments)}
        locale={locale}
        items={evidenceAttachments(locale)}
        density="compact"
      />
    </Surface>
  );
}

function CodexActivityPage({ locale }: { locale: TcrnLocale }) {
  return (
    <Surface data-work-codex-activity-page="true" data-work-codex-activity-contract="attached-execution-evidence-context">
      <Heading level={2}>{pick(locale, workChromeCopy.codexActivityHeading)}</Heading>
      <Text>{pick(locale, workChromeCopy.codexActivityNote)}</Text>
      <WorkActivityFeed
        label="Codex Activity"
        locale={locale}
        items={codexActivityItems(locale)}
        density="compact"
      />
    </Surface>
  );
}

function SavedViewPage({ locale, routeHref }: { locale: TcrnLocale; routeHref: (path: string) => string }) {
  return (
    <>
      <Surface data-work-saved-view="owner-feedback">
        <Heading level={2}>{pick(locale, workChromeCopy.savedViewHeading)}</Heading>
        <WorkQuickFilters label={pick(locale, workChromeCopy.savedViewFilters)} filters={workQuickFilters("ownerFeedbackView", locale, routeHref)} />
        <WorkList
          label="Owner feedback saved view"
          locale={locale}
          rows={workListRows(locale, routeHref).filter((item) => item.id === "AOS-128" || item.id === "AOS-144")}
          density="compact"
        />
      </Surface>
      <Surface>
        <Heading level={2}>{pick(locale, workChromeCopy.nextActions)}</Heading>
        <div data-work-action-row="true">
          <Button disabled disabledReason={translatePhrase("Static mockup only; route actions are not wired", locale)}>{pick(locale, workChromeCopy.routeToIlya)}</Button>
          <Button disabled disabledReason={translatePhrase("Static mockup only; no external action", locale)}>{pick(locale, workChromeCopy.requestQa)}</Button>
          <LinkButton href={routeHref("/work/gates")} variant="secondary">{pick(locale, workChromeCopy.viewGates)}</LinkButton>
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
          label={pick(locale, workChromeCopy.workHierarchy)}
          locale={locale}
          nodes={workHierarchyNodes(locale)}
          edges={workHierarchyEdges()}
        />
      </Surface>
      <HierarchyDefinitionSummary locale={locale} />
      <WorkFieldPanel title={pick(locale, workChromeCopy.relationshipVocabulary)} items={relationshipSummaryItems(locale)} density="compact" />
    </>
  );
}

function HierarchyDefinitionSummary({ locale }: { locale: TcrnLocale }) {
  return (
    <Surface data-work-hierarchy-definitions="prd-content-contract">
      <Heading level={2}>{pick(locale, workChromeCopy.prdHierarchy)}</Heading>
      <Text>{pick(locale, workChromeCopy.prdHierarchyIntro)}</Text>
      <TableShell
        label={pick(locale, workChromeCopy.hierarchyDefinitions)}
        columns={columns(locale, ["layer", "definition", "boundary"])}
        rows={hierarchyDefinitionRows.map((row) => localizeRow(row, locale))}
      />
    </Surface>
  );
}

function RelationshipTable({ locale, rows }: { locale: TcrnLocale; rows: typeof relationRows }) {
  return (
    <TableShell
      label={pick(locale, workChromeCopy.relations)}
      columns={columns(locale, ["relation", "source", "target", "state", "note"])}
      rows={rows.map((row) => ({
        ...localizeRow(row, locale),
        // The relation cell held the raw token: `localizeRow` routes strings
        // through the zh-only phrase table, which has no relation verbs in it, so
        // every locale showed `blocks`. DS owns this vocabulary in five locales.
        relation: workRelationshipLabel(row.relation, locale),
        state: relationState(row.state, locale)
      }))}
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

function workListRows(locale: TcrnLocale, routeHref: (path: string) => string): WorkItemRowProps[] {
  return workItems.map((item, index) => {
    const row: WorkItemRowProps = {
      id: item.key,
      // `translatePhrase` unconditionally, where an `isZh` guard used to stand.
      // The guard was the reason a ja, ko or fr reader could never reach the
      // five-locale chrome tier: it short-circuited to the raw English title
      // before the lookup happened. `translatePhrase` already returns its input
      // unchanged for a phrase in neither table, so the guard bought nothing and
      // cost three locales.
      title: translatePhrase(item.title, locale),
      selected: item.key === "AOS-128",
      rank: `P${Math.min(index, 2)}`,
      priority: item.priority,
      owner: item.assignee,
      // No `label` override: DS carries all eleven readiness states in five
      // locales, and a caller-supplied label replaces that table wholesale.
      // These three overrode it with a bilingual ternary, which is how a
      // five-locale page ended up showing "Blocked" and "Review required".
      state: item.status === "Blocked" || item.status === "PM Changes Requested" || item.status === "PM Freshness Retry Pending"
        ? { state: "blocked" }
        : item.status === "Done"
          ? { state: "local_only" }
          : { state: "review_required" },
      summary: translatePhrase(item.story, locale),
      fields: [
        { key: "status", label: translateColumn("status", locale), value: translatePhrase(item.status, locale) },
        { key: "gate", label: translateColumn("gate", locale), value: translatePhrase(item.gate, locale) },
        { key: "nextOwner", label: translateColumn("nextOwner", locale), value: item.nextOwner }
      ],
      relationships: item.key === "AOS-128"
        ? inspectorRelationships(locale).slice(0, 2)
        : [{ relation: "relates_to", target: item.initiative, locale }]
    };
    return row;
  });
}

function backlogRowsForGroup(group: typeof backlogGroups[number], locale: TcrnLocale): WorkItemRowProps[] {
  return group.rows.map((row) => ({
    id: `${group.id}-${row.order}`,
    title: translatePhrase(row.input, locale),
    rank: `${row.rank} / #${row.order}`,
    priority: translatePhrase(row.type, locale),
    owner: row.suggestedOwner,
    state: { state: "review_required" },
    summary: translatePhrase(row.missingDecision, locale),
    fields: [
      { key: "missingDecision", label: translateColumn("missingDecision", locale), value: translatePhrase(row.missingDecision, locale) },
      { key: "suggestedOwner", label: translateColumn("suggestedOwner", locale), value: row.suggestedOwner },
      { key: "action", label: translateColumn("action", locale), value: translatePhrase(row.disabledAction, locale) }
    ]
  }));
}

/**
 * The two acceptance rows, in every locale.
 *
 * These three phrases — "Owner acceptance", "Release readiness", "not claimed" —
 * were plain literals with no ternary at all, so they read as English on every
 * route including zh-CN. They are the no-overclaim vocabulary and they say the
 * most load-bearing thing on the page ("nobody has accepted this"), which is
 * exactly the sentence a reader must not have to read in a second language.
 */
const acceptanceCopy: Record<"ownerAcceptance" | "release" | "notClaimed", CopyEntry> = {
  ownerAcceptance: { "zh-CN": "Owner 接受", en: "Owner acceptance", ja: "オーナー受理", ko: "오너 수락", fr: "Acceptation du propriétaire" },
  release: { "zh-CN": "发布就绪度", en: "Release readiness", ja: "リリース準備状況", ko: "릴리스 준비도", fr: "Préparation à la publication" },
  notClaimed: { "zh-CN": "未声明", en: "not claimed", ja: "未主張", ko: "미주장", fr: "non revendiqué" }
};

function detailMetadataItems(locale: TcrnLocale): KeyValueItem[] {
  return [
    { key: "aos", label: "AOS", value: <MachineTokenCell token={currentAosConsumptionBasis.aos} label="source" kind="generic" density="compact" /> },
    { key: "ds", label: "DS", value: <MachineTokenCell token={currentAosConsumptionBasis.ds} label="Storybook" kind="commit" density="compact" /> },
    { key: "workflow", label: "Workflow", value: <MachineTokenCell token={currentAosConsumptionBasis.workflow} label="plan" kind="commit" density="compact" /> },
    { key: "preview", label: "Preview", value: translatePhrase("Use Atlas/source markers for retained preview freshness; PM freshness retry pending.", locale) },
    { key: "ownerAcceptance", label: pick(locale, acceptanceCopy.ownerAcceptance), value: pick(locale, acceptanceCopy.notClaimed) },
    { key: "release", label: pick(locale, acceptanceCopy.release), value: pick(locale, acceptanceCopy.notClaimed) }
  ];
}

function activityItems(locale: TcrnLocale) {
  return [
    {
      id: "aos-consumption",
      actor: "Ilya",
      action: translatePhrase("AOS consumes DS Work density exports", locale),
      timestamp: "2026-07-05",
      summary: translatePhrase("AOS uses public DS APIs; retained preview freshness is read from Atlas/source markers, and PM freshness retry remains pending.", locale),
      state: { state: "review_required" }
    },
    {
      id: "sable-required",
      actor: "Sable",
      action: translatePhrase("Post-consumption clean-room re-review required", locale),
      timestamp: "pending",
      summary: pick(locale, workChromeCopy.cleanRoomReReview),
      state: { state: "blocked" }
    },
    {
      id: "owner-visible-held",
      actor: "Arturo",
      action: translatePhrase("PM freshness retry pending", locale),
      timestamp: "pending",
      summary: translatePhrase("PM freshness retry pending; owner and product acceptance remain unclaimed.", locale),
      state: { state: "not_claimed" }
    }
  ];
}

function codexActivityItems(locale: TcrnLocale) {
  return codexRows.map((row) => ({
    id: row.item,
    actor: row.thread,
    action: translatePhrase(row.routeLabel, locale),
    timestamp: translatePhrase(row.status, locale),
    summary: <MachineToken token={row.route} label={translatePhrase(row.routeLabel, locale)} kind="route" />,
    state: { state: row.status === "success" ? "local_only" : row.status === "superseded" ? "not_claimed" : "review_required" }
  }));
}

function blockerChainItems(locale: TcrnLocale): KeyValueItem[] {
  // The verbs were hard-coded in their wire form (`implements`, `blocked_by`),
  // which is neither English prose nor any other language — the same vocabulary
  // the relations table gets from DS, spelled by hand here.
  const implementsVerb = workRelationshipLabel("implements", locale);
  const blockedByVerb = workRelationshipLabel("blocked_by", locale);
  return [
    { key: "AOS-142", label: "AOS-142", value: `${implementsVerb} · ${translatePhrase("Story: PM can discuss Work flows", locale)}` },
    { key: "AOS-144", label: "AOS-144", value: `${blockedByVerb} · AOS-142` },
    { key: "owner-inspection", label: "Owner Inspection", value: `${blockedByVerb} · ${translatePhrase("Mara PM Readiness", locale)}` }
  ];
}

function relationshipSummaryItems(locale: TcrnLocale): KeyValueItem[] {
  return relationRows.map((row) => ({
    key: `${row.source}-${row.relation}-${row.target}`,
    // The relation verb is DS vocabulary and DS carries all five locales for it.
    // This rendered the raw token — `blocks`, `blocked_by` — because the only way
    // to reach those locales used to be rendering a whole RelationshipChip, and
    // this is a KeyValue label with no room for a chip. DS now exports the
    // accessor, so the layout no longer decides the language.
    label: workRelationshipLabel(row.relation, locale),
    value: `${row.source} → ${row.target}: ${translatePhrase(row.note, locale)}`
  }));
}

function workIndexRows(locale: TcrnLocale) {
  return workItems.map((item) => ({
    id: item.key,
    // The key prefix used to appear only on the non-zh branch, which made the
    // language decide whether a row showed its identifier — two unrelated
    // choices riding one condition. The prefix is about what the row shows, so it
    // is unconditional now, and the title goes through `translatePhrase` in every
    // locale rather than only in zh-CN.
    title: `${item.key} ${translatePhrase(item.title, locale)}`,
    state: { state: item.status === "Blocked" || item.status === "PM Changes Requested" || item.status === "PM Freshness Retry Pending" ? "blocked" : item.status === "Done" ? "not_configured" : "review_required" },
    owner: item.assignee
  }));
}

function columns(locale: TcrnLocale, keys: string[]) {
  return keys.map((key) => ({ key, label: translateColumn(key, locale) }));
}

function badge(state: GateState | string, locale: TcrnLocale): ReactNode {
  if (state === "passed" || state === "accepted" || state === "resolved" || state === "current") {
    return <StatusBadge state={{ state: "local_only", label: pick(locale, workChromeCopy.passed) }} locale={locale} />;
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

// `localized` is gone: it took a two-locale record and answered English for
// everything that was not zh-CN, so it could not have served a fifth locale even
// if the data had one. Its six callers now use `pick`, which reads a `CopyEntry`.

function localizeRow<T extends Record<string, ReactNode>>(row: T, locale: TcrnLocale): T {
  if (locale !== "zh-CN") return row;
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [
    key,
    typeof value === "string" ? translatePhrase(value, locale) : value
  ])) as T;
}

/**
 * Table column headers, in every locale.
 *
 * The old shape was the pass-through again, with a twist that made it look
 * deliberate: the non-zh branch de-camelCased the key (`whereUsed` → "Where
 * Used") and title-cased it, so ja, ko, and fr got a plausible-looking English
 * header rather than an obvious hole. A header generated from an identifier reads
 * as a header, which is exactly why nobody noticed it was never translated.
 *
 * These are column names on a governance surface — "证据", "门禁", "下一 owner" —
 * so they are the product's vocabulary, not the tenant's data.
 */
const columnLabels: Record<string, CopyEntry> = {
  action: { "zh-CN": "动作", en: "Action", ja: "操作", ko: "동작", fr: "Action" },
  artifact: { "zh-CN": "材料", en: "Artifact", ja: "成果物", ko: "산출물", fr: "Artefact" },
  assignee: { "zh-CN": "执行人", en: "Assignee", ja: "担当者", ko: "담당자", fr: "Assigné" },
  blocker: { "zh-CN": "阻塞", en: "Blocker", ja: "ブロッカー", ko: "차단 요인", fr: "Blocage" },
  boundary: { "zh-CN": "边界", en: "Boundary", ja: "境界", ko: "경계", fr: "Limite" },
  consumptionDisposition: { "zh-CN": "消费方式", en: "Consumption disposition", ja: "消費方針", ko: "소비 방식", fr: "Mode de consommation" },
  definition: { "zh-CN": "定义", en: "Definition", ja: "定義", ko: "정의", fr: "Définition" },
  dsLevel: { "zh-CN": "DS 层级", en: "DS level", ja: "DS レベル", ko: "DS 레벨", fr: "Niveau DS" },
  evidence: { "zh-CN": "证据", en: "Evidence", ja: "証拠", ko: "증거", fr: "Preuve" },
  gate: { "zh-CN": "门禁", en: "Gate", ja: "ゲート", ko: "게이트", fr: "Porte" },
  id: { "zh-CN": "编号", en: "Id", ja: "ID", ko: "ID", fr: "Identifiant" },
  input: { "zh-CN": "输入", en: "Input", ja: "入力", ko: "입력", fr: "Entrée" },
  item: { "zh-CN": "工作项", en: "Item", ja: "作業項目", ko: "작업 항목", fr: "Élément" },
  key: { "zh-CN": "编号", en: "Key", ja: "キー", ko: "키", fr: "Clé" },
  layer: { "zh-CN": "层级", en: "Layer", ja: "階層", ko: "계층", fr: "Niveau" },
  missing: { "zh-CN": "缺口", en: "Missing", ja: "不足", ko: "누락", fr: "Manquant" },
  missingDecision: { "zh-CN": "缺少决策", en: "Missing decision", ja: "未決定事項", ko: "누락된 결정", fr: "Décision manquante" },
  name: { "zh-CN": "名称", en: "Name", ja: "名称", ko: "이름", fr: "Nom" },
  next: { "zh-CN": "下一步", en: "Next", ja: "次", ko: "다음", fr: "Suivant" },
  nextOwner: { "zh-CN": "下一 owner", en: "Next owner", ja: "次のオーナー", ko: "다음 오너", fr: "Propriétaire suivant" },
  note: { "zh-CN": "说明", en: "Note", ja: "備考", ko: "비고", fr: "Note" },
  order: { "zh-CN": "顺序", en: "Order", ja: "順序", ko: "순서", fr: "Ordre" },
  owner: { "zh-CN": "Owner", en: "Owner", ja: "オーナー", ko: "오너", fr: "Propriétaire" },
  priority: { "zh-CN": "优先级", en: "Priority", ja: "優先度", ko: "우선순위", fr: "Priorité" },
  proof: { "zh-CN": "证明", en: "Proof", ja: "証明", ko: "증명", fr: "Preuve" },
  purpose: { "zh-CN": "目的", en: "Purpose", ja: "目的", ko: "목적", fr: "Objectif" },
  rank: { "zh-CN": "排序", en: "Rank", ja: "順位", ko: "순위", fr: "Rang" },
  relation: { "zh-CN": "关系", en: "Relation", ja: "関係", ko: "관계", fr: "Relation" },
  route: { "zh-CN": "Route", en: "Route", ja: "ルート", ko: "경로", fr: "Route" },
  source: { "zh-CN": "来源", en: "Source", ja: "ソース", ko: "출처", fr: "Source" },
  state: { "zh-CN": "状态", en: "State", ja: "状態", ko: "상태", fr: "État" },
  status: { "zh-CN": "状态", en: "Status", ja: "ステータス", ko: "상태", fr: "Statut" },
  suggestedOwner: { "zh-CN": "建议 owner", en: "Suggested owner", ja: "推奨オーナー", ko: "권장 오너", fr: "Propriétaire suggéré" },
  target: { "zh-CN": "目标", en: "Target", ja: "対象", ko: "대상", fr: "Cible" },
  task: { "zh-CN": "任务", en: "Task", ja: "タスク", ko: "작업", fr: "Tâche" },
  thread: { "zh-CN": "线程", en: "Thread", ja: "スレッド", ko: "스레드", fr: "Fil" },
  title: { "zh-CN": "标题", en: "Title", ja: "タイトル", ko: "제목", fr: "Titre" },
  type: { "zh-CN": "类型", en: "Type", ja: "種別", ko: "유형", fr: "Type" },
  whereUsed: { "zh-CN": "使用位置", en: "Where used", ja: "使用箇所", ko: "사용 위치", fr: "Utilisé où" }
};

function translateColumn(key: string, locale: TcrnLocale): string {
  const entry = columnLabels[key];
  // An unregistered key still de-camelCases rather than printing the raw
  // identifier — but it now does so for every locale equally, so the gap shows up
  // as the same defect on en as on fr instead of hiding behind a tidy heading.
  if (!entry) return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
  return pick(locale, entry);
}

function translateLane(value: string, locale: TcrnLocale): string {
  return translatePhrase(value, locale);
}

/**
 * Product vocabulary on this surface, in every locale AOS offers.
 *
 * These are the words the product says about itself — gate names, lane names,
 * relation states, evidence kinds — as distinct from the fixture prose below,
 * which is the tenant's content. They were in a zh-only table, which is a
 * fallback wearing a translation's clothes: `translatePhrase` opens with
 * `if (locale !== "zh-CN") return value` and closes with `phrases[value] ?? value`,
 * so on ja, ko, and fr every one of them rendered its English source string and
 * nothing recorded that as a miss. Two of them — "Static proof required" and
 * "Post-consumption clean-room re-review required" — were not even in the zh
 * table, so they read English on all five routes including the one the table was
 * written for.
 *
 * `CopyEntry` is `Record<TcrnLocale, string>`, so a new gate name cannot be added
 * here in two languages: the missing locale is a compile error at the line that
 * writes the string. That is the difference between this table and the one below.
 */
const mockupChromeCopy: Record<string, CopyEntry> = {
  "Static proof required": {
    "zh-CN": "需静态证明", en: "Static proof required", ja: "静的証明が必要", ko: "정적 증명 필요", fr: "Preuve statique requise"
  },
  "Post-consumption clean-room re-review required": {
    "zh-CN": "消费后须 clean-room 复审",
    en: "Post-consumption clean-room re-review required",
    ja: "消費後のクリーンルーム再レビューが必要",
    ko: "소비 후 클린룸 재검토 필요",
    fr: "Nouvelle revue en salle blanche requise après consommation"
  },
  "PM freshness retry pending": {
    "zh-CN": "PM freshness 重试待完成", en: "PM freshness retry pending", ja: "PM freshness の再試行が保留中", ko: "PM freshness 재시도 대기", fr: "Nouvelle tentative PM freshness en attente"
  },
  "PM Freshness Retry Pending": {
    "zh-CN": "PM freshness 重试待完成", en: "PM Freshness Retry Pending", ja: "PM freshness の再試行が保留中", ko: "PM freshness 재시도 대기", fr: "Nouvelle tentative PM freshness en attente"
  },
  "PM Changes Requested": {
    "zh-CN": "PM 要求修改", en: "PM Changes Requested", ja: "PM が修正を要求", ko: "PM 수정 요청", fr: "Modifications demandées par le PM"
  },
  "DS contract accepted": {
    "zh-CN": "DS 合同已接受", en: "DS contract accepted", ja: "DS 契約を受理", ko: "DS 계약 수락됨", fr: "Contrat DS accepté"
  },
  "Blocked until gates pass": {
    "zh-CN": "门禁通过前阻塞", en: "Blocked until gates pass", ja: "ゲート通過まで停止", ko: "게이트 통과까지 차단", fr: "Bloqué jusqu'au passage des portes"
  },
  changes_requested: {
    "zh-CN": "需要修改", en: "changes requested", ja: "修正が必要", ko: "수정 요청됨", fr: "modifications demandées"
  },
  resolved: { "zh-CN": "已解决", en: "resolved", ja: "解決済み", ko: "해결됨", fr: "résolu" },
  active: { "zh-CN": "进行中", en: "active", ja: "進行中", ko: "진행 중", fr: "en cours" },
  superseded: { "zh-CN": "已替代", en: "superseded", ja: "置き換え済み", ko: "대체됨", fr: "remplacé" },
  pending: { "zh-CN": "待处理", en: "pending", ja: "保留中", ko: "대기 중", fr: "en attente" },
  "pending refresh": { "zh-CN": "等待刷新", en: "pending refresh", ja: "更新待ち", ko: "갱신 대기", fr: "actualisation en attente" },
  "superseded by new scope": {
    "zh-CN": "已被新范围替代", en: "superseded by new scope", ja: "新しいスコープに置き換え", ko: "새 범위로 대체됨", fr: "remplacé par une nouvelle portée"
  },
  "proof artifact target": {
    "zh-CN": "证明 artifact 目标", en: "proof artifact target", ja: "証明 artifact の対象", ko: "증명 artifact 대상", fr: "cible d'artefact de preuve"
  },
  Backlog: { "zh-CN": "待整理", en: "Backlog", ja: "バックログ", ko: "백로그", fr: "Backlog" },
  "In Progress": { "zh-CN": "进行中", en: "In Progress", ja: "進行中", ko: "진행 중", fr: "En cours" },
  Review: { "zh-CN": "评审", en: "Review", ja: "レビュー", ko: "검토", fr: "Revue" },
  QA: { "zh-CN": "QA", en: "QA", ja: "QA", ko: "QA", fr: "QA" },
  "PM Readiness": { "zh-CN": "PM 准备度", en: "PM Readiness", ja: "PM 準備状況", ko: "PM 준비도", fr: "Préparation PM" },
  "Owner Inspection": { "zh-CN": "Owner 检查", en: "Owner Inspection", ja: "オーナー検査", ko: "오너 점검", fr: "Inspection du propriétaire" },
  "Owner Feedback": { "zh-CN": "Owner 反馈", en: "Owner Feedback", ja: "オーナーからの反映", ko: "오너 피드백", fr: "Retour du propriétaire" },
  "Open Question": { "zh-CN": "待确认问题", en: "Open Question", ja: "未解決の質問", ko: "미해결 질문", fr: "Question ouverte" },
  "Professional QA": { "zh-CN": "专业 QA", en: "Professional QA", ja: "専門 QA", ko: "전문 QA", fr: "QA professionnelle" },
  "Command proof": { "zh-CN": "命令证明", en: "Command proof", ja: "コマンド証明", ko: "명령 증명", fr: "Preuve de commande" },
  Screenshot: { "zh-CN": "截图", en: "Screenshot", ja: "スクリーンショット", ko: "스크린샷", fr: "Capture d'écran" },
  "QA summary": { "zh-CN": "QA 摘要", en: "QA summary", ja: "QA サマリー", ko: "QA 요약", fr: "Résumé QA" },
  "API readback": { "zh-CN": "API 读回", en: "API readback", ja: "API 読み戻し", ko: "API 읽기 확인", fr: "Relecture API" },
  Commit: { "zh-CN": "Commit", en: "Commit", ja: "コミット", ko: "커밋", fr: "Commit" },
  "Preview link": { "zh-CN": "预览链接", en: "Preview link", ja: "プレビューリンク", ko: "미리보기 링크", fr: "Lien d'aperçu" },
  "No API integration": { "zh-CN": "未接 API", en: "No API integration", ja: "API 未連携", ko: "API 미연동", fr: "Aucune intégration API" },
  "Not integrated": { "zh-CN": "未接入", en: "Not integrated", ja: "未連携", ko: "미연동", fr: "Non intégré" },
  "Static filters": { "zh-CN": "静态过滤", en: "Static filters", ja: "静的フィルター", ko: "정적 필터", fr: "Filtres statiques" },
  // Matches what the real work-items module already says for this record kind, so
  // the mockup and the live view name the same thing the same way.
  "Work Item": { "zh-CN": "工作项", en: "Work Item", ja: "作業項目", ko: "작업 항목", fr: "Élément de travail" },
  // Why a disabled control is disabled is the product explaining itself, so both
  // of these belong in the chrome tier. They were split across the two tiers by
  // accident: one sat in the zh-only debt table and rendered English on ja, ko and
  // fr, and its sibling was in neither table and rendered English everywhere. A
  // reader who cannot act on a control and cannot read why it is disabled has been
  // told nothing.
  "Static mockup only; route actions are not wired": {
    "zh-CN": "仅静态示例；route 动作未接线",
    en: "Static mockup only; route actions are not wired",
    ja: "静的モックのみ。route アクションは未接続です",
    ko: "정적 목업 전용, route 동작은 연결되지 않았습니다",
    fr: "Maquette statique uniquement ; les actions de route ne sont pas câblées"
  },
  "Static mockup only; no external action": {
    "zh-CN": "仅静态示例；无外部动作",
    en: "Static mockup only; no external action",
    ja: "静的モックのみ。外部アクションはありません",
    ko: "정적 목업 전용, 외부 동작 없음",
    fr: "Maquette statique uniquement ; aucune action externe"
  }
};

/**
 * A phrase on this surface in the reader's language.
 *
 * Two tiers, deliberately unequal. Product vocabulary goes through
 * `mockupChromeCopy`, which cannot be written in fewer than five locales. Fixture
 * prose — the tenant's story titles, notes, and purposes that this static surface
 * carries as sample content — falls through to the zh-only table below, which is
 * audited debt in the same sense as the Design System's `translationDebtAllowlist`:
 * a bounded list of strings that are not the product's own words, not a place to
 * put a new one. A phrase in neither table renders as written, which is why the
 * chrome tier has to be the one a new gate name lands in.
 */
function translatePhrase(value: string, locale: TcrnLocale): string {
  const chrome = mockupChromeCopy[value];
  if (chrome) return pick(locale, chrome);
  if (locale !== "zh-CN") return value;
  const phrases: Record<string, string> = {
    "AOS-128 Remove unsupported global search": "AOS-128 移除不支持的全局搜索",
    "Remove unsupported global search": "移除不支持的全局搜索",
    "Owner can inspect the shell capability boundary without fake controls": "Owner 可以检查没有虚假控件的壳层能力边界",
    "Rebuild Work routes with DS Work components": "用 DS Work 组件重建 Work 路由",
    "Static Work Management PRD mockups": "静态 Work Management PRD 示例",
    "ProductShell optional search contract": "ProductShell 可选搜索合同",
    "Owner inspection handoff package": "Owner 检查交接包",
    "PM freshness retry pending; owner and product acceptance are not claimed.": "PM freshness 重试待完成；不声明 owner 或 product acceptance。",
    "Owner request: Work visibility": "Owner 请求：Work 可视化",
    "DS component gap list": "DS 组件缺口列表",
    "Registered DS Work components": "已注册 DS Work 组件",
    "AOS-142 Static Work mockups": "AOS-142 静态 Work 示例",
    "AOS source-visible freshness check": "AOS 源码可见新鲜度检查",
    "DS-88 Optional search contract": "DS-88 可选搜索合同",
    "Mobile zh-CN no-overflow regression": "移动端 zh-CN 无溢出回归",
    "AOS-128 No global search": "AOS-128 无全局搜索",
    "Work Management subnav/tabs pattern": "Work Management 子导航 / 标签模式",
    "Work Board / compact lane composite": "Work Board / 紧凑泳道组合",
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
    "Consumes package SavedViewToolbar for saved views and local filters without a topbar search capability.": "消费 package SavedViewToolbar 展示保存视图与本地过滤，不引入顶栏搜索能力。",
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
    "Static split inspector": "静态分栏检查器",
    "Full detail route remains canonical": "完整详情路由保持权威",
    // "Static mockup only; route actions are not wired" moved up to the chrome
    // tier with all five locales. Leaving it here too would be two sources for one
    // string, and the chrome tier is consulted first, so this copy would be dead.
    "URL locale authority": "URL locale 权威",
    "Accepted on the AOS rebuild basis": "AOS 重建 basis 已接受",
    "Return AOS consumption proof to Arturo": "将 AOS 消费证明返回 Arturo",
    "Retained 4317 refreshed to reviewed basis": "4317 保留预览已刷新到已评审 basis",
    "PM freshness retry pending; no owner or product acceptance claimed": "PM freshness 重试待完成；不声明 owner 或 product acceptance",
    "Review compact DS-consumed Work routes": "评审紧凑 DS 消费 Work 路由",
    "QA after Elara and Sable accept": "Elara 和 Sable 接受后进入 QA",
    "PM freshness retry pending after copy repair": "copy 修复后等待 PM freshness 重试",
    "Retry after source repair and retained refresh": "source 修复和保留预览刷新后重试",
    "Only after PM freshness/readiness permits": "仅在 PM freshness/readiness 允许后进行",
    "No owner handoff yet": "尚无 owner handoff",
    "No downstream claim": "不声明下游通过",
    "Remove unsupported topbar search prop": "移除不支持的顶栏搜索属性",
    "URL locale canonicalization": "URL locale 规范化",
    "Refresh 4317 preview": "刷新 4317 预览",
    "Retained 4317 refresh": "4317 保留预览刷新",
    "PM freshness basis copy repair": "PM freshness basis 文案修复",
    "Use Atlas/source markers for retained preview freshness; PM freshness retry pending.": "使用 Atlas/source marker 确认保留预览 freshness；PM freshness 重试待完成。",
    "AOS uses public DS APIs; retained preview freshness is read from Atlas/source markers, and PM freshness retry remains pending.": "AOS 使用公开 DS API；保留预览 freshness 由 Atlas/source marker 读回确认，PM freshness 重试仍待完成。",
    "PM freshness retry pending; owner and product acceptance remain unclaimed.": "PM freshness 重试待完成；仍不声明 owner 或 product acceptance。",
    "PM freshness retry pending; use Atlas markers for freshness": "PM freshness 重试待完成；使用 Atlas marker 确认 freshness",
    "Shaped for design confirmation": "已收敛用于设计确认",
    "Unshaped owner inputs": "待收敛 owner 输入",
    "AOS-142 Work module route matrix": "AOS-142 Work 模块路由矩阵",
    "AOS-128 capability boundary detail": "AOS-128 能力边界详情",
    "Owner visibility policy for Work items": "Work 项 owner 可见性策略",
    "Shaped Work Item": "已收敛工作项",
    "Review only; no backend API": "仅供评审；无后端 API",
    "Keep no-search proof visible without claiming readiness": "保留无搜索证明，但不声明 readiness",
    "Which evidence can enter an owner handoff": "哪些证据可进入 owner 交接",
    "Promote blocked until rendered DS review accepts": "等待渲染 DS 评审接受后才能提升",
    "Route action disabled in static fixture": "静态示例中 route 动作禁用",
    "Promote blocked until PM shapes numbering scope": "等待 PM 收敛编号范围后才能提升",
    "Route action disabled; no owner handoff in this route": "route 动作禁用；本路由不进行 owner 交接",
    "PM freshness retry remains required before inspection readiness.": "inspection readiness 前仍需 PM freshness 重试。",
    "AOS consumption review accepted before retained refresh.": "AOS 消费评审已在保留预览刷新前接受。",
    "Retained 4317 refreshed to the reviewed AOS consumption basis.": "4317 保留预览已刷新到已评审的 AOS 消费 basis。",
    "Scope already approved": "范围已批准",
    "Global or product-scoped key": "全局或按产品编号",
    "Visibility policy": "可见性策略",
    Ilya: "Ilya",
    Mara: "Mara"
  };
  return phrases[value] ?? value;
}
