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
  type EvidenceAttachment,
  type GatePipelineGate,
  type KeyValueItem,
  type RelationshipChipProps,
  type WorkBoardLane,
  type WorkItemRowProps,
  type WorkHierarchyEdge,
  type WorkHierarchyNode
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

const relationRows = [
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

function workQuickFilters(pageId: WorkMockupPageId, locale: TcrnLocale, routeHref: (path: string) => string) {
  return [
    { id: "owner-feedback", label: translatePhrase("Owner Feedback", locale), value: "AOS-128", href: routeHref("/work/views/owner-feedback"), current: pageId === "ownerFeedbackView", count: 2 },
    { id: "blocked", label: locale === "zh-CN" ? "阻塞" : "Blocked", value: translatePhrase("PM freshness retry pending", locale), href: routeHref("/work/gates"), current: pageId === "gates", count: 2 },
    { id: "no-live", label: locale === "zh-CN" ? "边界" : "Boundary", value: locale === "zh-CN" ? "静态 / 无后端" : "Static / no backend", disabled: true, disabledReason: translatePhrase("Static mockup only; route actions are not wired", locale) },
    { id: "selected", label: locale === "zh-CN" ? "选中项" : "Selected", value: "AOS-128", href: routeHref("/work/items/AOS-128"), current: pageId === "detail" }
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
  return localized(page.title, locale);
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
      <Heading level={1} visualLevel={2} id="work-heading" className="tcrn-work-module-sr-only">
        {localized(page.title, locale)}
      </Heading>
      <WorkPageHeader
        title={localized(page.title, locale)}
        description={localized(page.description, locale)}
        breadcrumbs={[
          { id: "work", label: locale === "zh-CN" ? "工作" : "Work", href: routeHref("/work") },
          { id: page.id, label: localized(page.eyebrow, locale) }
        ]}
        meta={<MachineTokenCell token={page.path} label={locale === "zh-CN" ? "路由" : "Route"} kind="route" density="compact" />}
        actions={[
          {
            id: "route-action",
            label: locale === "zh-CN" ? "静态动作" : "Static action",
            disabledReason: translatePhrase("Static mockup only; route actions are not wired", locale)
          }
        ]}
        density="compact"
      />
      <WorkViewTabs
        label={locale === "zh-CN" ? "工作视图" : "Work views"}
        tabs={workSubnavItems(pageId, locale, routeHref)}
      />
      <WorkQuickFilters
        label={locale === "zh-CN" ? "工作快速过滤" : "Work quick filters"}
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
  const queueList = <WorkList rows={workListRows(locale, routeHref)} label={locale === "zh-CN" ? "优先工作列表" : "Priority work list"} density="compact" />;
  return (
    <>
      <section data-aos-work-module-entry="owner-quality-work-queue" data-owner-quality-work-queue="true">
        {showSplitInspector ? (
          <WorkSplitView
            label={locale === "zh-CN" ? "队列与详情预览" : "Queue and detail preview"}
            list={queueList}
            detail={<SelectedItemDetailPreview locale={locale} routeHref={routeHref} />}
            density="compact"
          />
        ) : queueList}
      </section>
      <div className="tcrn-work-module-secondary-grid">
        <WorkFieldPanel
          title={locale === "zh-CN" ? "阻塞链" : "Blocker chain"}
          items={blockerChainItems(locale)}
          density="compact"
        />
        <WorkFieldPanel
          title={locale === "zh-CN" ? "关系摘要" : "Relationship summary"}
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
          label={locale === "zh-CN" ? "工作看板" : "Work board"}
          lanes={workBoardLanes(locale)}
          density="compact"
          toolbar={<WorkQuickFilters label={locale === "zh-CN" ? "看板过滤" : "Board filters"} filters={workQuickFilters("board", locale, routeHref)} />}
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
            description={locale === "zh-CN" ? "静态规划分组，无后端写入。" : "Static planning group with no backend writes."}
            rows={backlogRowsForGroup(group, locale)}
            actions={[{ id: "route", label: locale === "zh-CN" ? "路由" : "Route", disabledReason: translatePhrase("Route action disabled in static fixture", locale) }]}
            inlineCreate={{
              label: locale === "zh-CN" ? "添加静态输入" : "Add static input",
              disabledReason: translatePhrase(group.rows[0]?.disabledAction ?? "Static mockup only; route actions are not wired", locale),
              hint: locale === "zh-CN" ? "仅展示布局，不创建后端记录。" : "Layout only; no backend record is created."
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
        title={`AOS-128 · ${locale === "zh-CN" ? "能力边界确认" : "Capability boundary confirmation"}`}
        summary={locale === "zh-CN"
          ? "该静态检查器在队列、看板和待整理页保持同一个选中工作项，并链接到完整详情页。"
          : "This static inspector keeps the selected work item visible across queue, board, and backlog routes and links to the full detail page."}
        state={{ state: "review_required" }}
        main={<WorkFieldPanel title={locale === "zh-CN" ? "摘要" : "Summary"} items={[
          { key: "selected", label: locale === "zh-CN" ? "选中项" : "Selected item", value: <LinkButton href={routeHref("/work/items/AOS-128")} variant="secondary">AOS-128</LinkButton> },
          { key: "mode", label: locale === "zh-CN" ? "模式" : "Mode", value: locale === "zh-CN" ? "桌面分栏；移动端详情路由" : "Desktop split; mobile detail route" },
          { key: "api", label: "API", value: locale === "zh-CN" ? "未接入" : "Not integrated" }
        ]} density="compact" />}
        metadata={<MetadataRail title={locale === "zh-CN" ? "元数据" : "Metadata"} items={detailMetadataItems(locale)} density="compact" />}
        activity={<WorkActivityFeed items={activityItems(locale).slice(0, 2)} density="compact" />}
        actions={[
          {
            id: "open-detail",
            label: locale === "zh-CN" ? "使用详情路由" : "Use detail route",
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

function KnowledgeManagementSupportSection({ locale, routeHref }: { locale: TcrnLocale; routeHref: (path: string) => string }) {
  const isZh = locale === "zh-CN";
  const labels = isZh
    ? ["静态", "DS 公开导出", "无后端"]
    : ["Static", "DS public exports", "No backend"];
  const pageTreeItems = [
    {
      id: "aos-work-runbook",
      title: isZh ? "AOS Work 检查运行手册" : "AOS Work inspection runbook",
      href: routeHref("/work/items/AOS-128"),
      current: true,
      state: { state: "review_required", label: isZh ? "PM freshness 重试待定" : "PM freshness retry pending" }
    },
    {
      id: "proof-receipts",
      title: isZh ? "证明读回" : "Proof readbacks",
      href: routeHref("/work/evidence"),
      state: { state: "local_only", label: isZh ? "静态 fixture" : "Static fixture" }
    },
    {
      id: "route-activity",
      title: isZh ? "Route 活动" : "Route activity",
      href: routeHref("/work/codex-activity")
    }
  ];
  const documentSections = [
    {
      id: "scope",
      heading: isZh ? "消费范围" : "Consumption scope",
      body: isZh
        ? "AOS 仅消费 Meridian / Knowledge Management 的公开 DS 导出，用于把工作项上下文、证明和静态知识说明放在同一个详情页。"
        : "AOS consumes Meridian / Knowledge Management public DS exports only, placing Work context, proof, and static knowledge notes in the same detail route."
    },
    {
      id: "boundary",
      heading: isZh ? "边界" : "Boundary",
      body: isZh
        ? "该区域不接入 Knowledge 后端、持久化、全局搜索、外部工作区或 live dispatch；Owner、Product、final MVP 与 release acceptance 均未声明。"
        : "This region wires no Knowledge backend, persistence, global search, external workspace, or live dispatch; owner, product, final MVP, and release acceptance are not claimed."
    },
    {
      id: "next-proof",
      heading: isZh ? "下一步证明" : "Next proof",
      body: isZh
        ? "下一步应由 Sable、Talia、Elara、Rowan 和 Verity 复核 AOS 消费结果，再由 Atlas 处理保留预览刷新。"
        : "Next review should route Sable, Talia, Elara, Rowan, and Verity over this AOS consumption result before Atlas handles retained preview refresh."
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
      body: isZh
        ? "使用公开 DS Knowledge 组件补齐工作项知识上下文，不复制 Storybook 文档壳。"
        : "Use public DS Knowledge components for Work-item knowledge context without copying Storybook doc-shell chrome.",
      timestamp: "2026-07-05",
      state: { state: "review_required", label: isZh ? "待复核" : "Review pending" }
    },
    {
      id: "knowledge-comment-2",
      author: "Sable",
      body: isZh
        ? "保持 clean-room 边界：无第三方品牌、资产、类名、截图或外部集成。"
        : "Keep the clean-room boundary: no third-party brand, assets, classes, screenshots, or external integration.",
      timestamp: "pending",
      state: { state: "not_claimed", label: isZh ? "未声明接受" : "Acceptance not claimed" }
    }
  ];
  const versions = [
    {
      id: "knowledge-v1",
      title: isZh ? "Meridian DS 知识组件消费" : "Meridian DS Knowledge component consumption",
      author: "Ilya",
      timestamp: "source repair",
      state: { state: "review_required", label: isZh ? "待评审" : "Review pending" }
    },
    {
      id: "knowledge-v0",
      title: isZh ? "Work 密度布局消费" : "Work density layout consumption",
      author: "Ilya",
      timestamp: "previous basis",
      state: { state: "local_only", label: isZh ? "仅本地证明" : "Local proof only" }
    }
  ];
  const searchResults = [
    {
      id: "knowledge-result-proof",
      title: isZh ? "证明与门禁读回" : "Proof and gate readback",
      href: routeHref("/work/evidence"),
      excerpt: isZh
        ? "静态结果引用 AOS Work 证明和门禁上下文，不连接产品级或外部搜索索引。"
        : "Static result references AOS Work proof and gate context without product-wide or external search indexing.",
      labels: [isZh ? "证明" : "Proof", isZh ? "静态" : "Static"],
      state: { state: "local_only", label: isZh ? "静态结果" : "Static result" }
    },
    {
      id: "knowledge-result-activity",
      title: isZh ? "执行活动说明" : "Execution activity notes",
      href: routeHref("/work/codex-activity"),
      excerpt: isZh
        ? "静态结果指向 route 活动说明；不会触发 live dispatch 或外部动作。"
        : "Static result links to route activity notes; it does not trigger live dispatch or external action.",
      labels: [isZh ? "活动" : "Activity", isZh ? "无 live" : "No live"],
      state: { state: "not_claimed", label: isZh ? "无外部动作" : "No external action" }
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
      <Heading level={2}>{isZh ? "Knowledge 支持包" : "Knowledge support packet"}</Heading>
      <Text>
        {isZh
          ? "该详情区域消费 DS Meridian / Knowledge Management 公开组件，把静态知识说明、门禁证明和工作项上下文放在一起；不声明 owner/product/release 接受。"
          : "This detail region consumes DS Meridian / Knowledge Management public components to place static knowledge notes, gate proof, and Work-item context together; it does not claim owner, product, or release acceptance."}
      </Text>
      <div className="tcrn-work-module-secondary-grid">
        <KnowledgePageTree
          label={isZh ? "知识页面树" : "Knowledge page tree"}
          items={pageTreeItems}
          density="compact"
        />
        <KnowledgeDocumentCanvas
          title={isZh ? "AOS-128 静态知识说明" : "AOS-128 static knowledge note"}
          summary={isZh
            ? "从 DS `d385428` 消费公开 Knowledge 组件；保留预览新鲜度仍由 Atlas/source marker 判定。"
            : "Consumes public Knowledge components from DS `d385428`; retained-preview freshness remains determined by Atlas/source markers."}
          labels={labels}
          meta={<MachineTokenCell token={knowledgeStorybookContractAnchors.dsBasis} label="DS" kind="commit" density="compact" />}
          sections={documentSections}
          density="compact"
        />
      </div>
      <div className="tcrn-work-module-secondary-grid">
        <KnowledgeTocRail label={isZh ? "本页目录" : "On this page"} items={tocItems} density="compact" />
        <KnowledgeMetadataRail
          title={isZh ? "知识元数据" : "Knowledge metadata"}
          labels={labels}
          items={[
            { key: "ds", label: "DS", value: <MachineTokenCell token={knowledgeStorybookContractAnchors.dsBasis} label="Knowledge" kind="commit" density="compact" /> },
            { key: "source", label: isZh ? "来源" : "Source", value: isZh ? "AOS 静态 fixture" : "AOS static fixture" },
            { key: "state", label: isZh ? "状态" : "State", value: translatePhrase("PM freshness retry pending", locale) },
            { key: "backend", label: isZh ? "后端" : "Backend", value: isZh ? "未接入" : "Not integrated" },
            { key: "acceptance", label: isZh ? "接受" : "Acceptance", value: isZh ? "未声明" : "Not claimed" }
          ]}
          actions={[
            {
              id: "route-review",
              label: isZh ? "路由复核" : "Route review",
              disabledReason: translatePhrase("Static mockup only; route actions are not wired", locale)
            }
          ]}
          density="compact"
        />
      </div>
      <div className="tcrn-work-module-secondary-grid">
        <KnowledgeInlineCommentList label={isZh ? "静态评论" : "Static comments"} comments={comments} density="compact" />
        <KnowledgeVersionHistory label={isZh ? "静态版本" : "Static versions"} versions={versions} density="compact" />
      </div>
      <div className="tcrn-work-module-secondary-grid">
        <KnowledgeSearchResults label={isZh ? "静态知识结果" : "Static knowledge results"} results={searchResults} density="compact" />
        <div
          data-registered-ds-knowledge-components="true"
          data-registered-ds-knowledge-components-implementation="package-consumed-public-exports"
          data-registered-ds-knowledge-components-count={registeredDsKnowledgeComponentRows.length}
        >
          <KnowledgeLabelSet labels={labels} label={isZh ? "知识标签" : "Knowledge labels"} density="compact" />
          <TableShell
            label={isZh ? "已消费的 DS Knowledge 组件" : "Consumed DS Knowledge components"}
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
      title={`AOS-128 · ${locale === "zh-CN" ? "移除顶栏全局搜索" : "Remove unsupported global search"}`}
      summary={locale === "zh-CN"
        ? "Owner 认可：AOS 没有真实全局搜索能力，不应展示顶栏搜索框或全局搜索快捷键。"
        : "Owner-approved scope: AOS has no real global search capability, so the shell must not render topbar search or a global search shortcut."}
      state={{ state: "blocked", label: translatePhrase("PM freshness retry pending", locale) }}
      main={<div className="tcrn-work-module-detail-stack">
        <WorkFieldPanel title={locale === "zh-CN" ? "层级" : "Hierarchy"} items={[
          { key: "initiative", label: "Initiative", value: "AOS product shell recovery" },
          { key: "epic", label: "Epic", value: "Product Shell Owner Feedback Recovery" },
          { key: "story", label: "Story", value: translatePhrase("Owner can inspect an AOS shell without fake global search", locale) },
          { key: "workItem", label: "Work Item", value: <MachineToken token="AOS-128" kind="work-item" /> }
        ]} density="compact" />
        <WorkFieldPanel title={locale === "zh-CN" ? "关系" : "Relationships"} items={inspectorRelationships(routeHref).map((relationship, index) => ({
          key: `${relationship.relation}-${index}`,
          label: relationship.relation,
          value: <RelationshipChip {...relationship} source={relationship.source ?? "AOS-128"} />
        }))} density="compact" />
        <GatePipelineCompact label={locale === "zh-CN" ? "门禁摘要" : "Gate summary"} gates={workGatePipeline(locale).slice(0, 5)} />
        <EvidenceAttachmentList label={locale === "zh-CN" ? "证据" : "Evidence"} items={evidenceAttachments(locale)} density="compact" />
        <KnowledgeManagementSupportSection locale={locale} routeHref={routeHref} />
      </div>}
      metadata={<MetadataRail title={locale === "zh-CN" ? "元数据" : "Metadata"} items={detailMetadataItems(locale)} density="compact" />}
      activity={<WorkActivityFeed label={locale === "zh-CN" ? "活动" : "Activity"} items={activityItems(locale)} density="compact" />}
      actions={[
        {
          id: "prepare-owner-package",
          label: locale === "zh-CN" ? "准备 Owner 检查包" : "Prepare owner inspection package",
          disabledReason: translatePhrase("PM freshness retry pending; owner and product acceptance are not claimed.", locale)
        }
      ]}
      density="compact"
    />
  );
}

function GatesPage({ locale }: { locale: TcrnLocale }) {
  return (
    <Surface data-work-gates-page="true">
      <Heading level={2}>{locale === "zh-CN" ? "门禁聚合" : "Gate aggregation"}</Heading>
      <GatePipelineCompact label={locale === "zh-CN" ? "门禁流水线" : "Gate pipeline"} gates={workGatePipeline(locale)} />
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
        density="compact"
      />
    </Surface>
  );
}

function CodexActivityPage({ locale }: { locale: TcrnLocale }) {
  return (
    <Surface data-work-codex-activity-page="true" data-work-codex-activity-contract="attached-execution-evidence-context">
      <Heading level={2}>{locale === "zh-CN" ? "Codex 活动附着在工作项下" : "Codex Activity attaches to Work Items"}</Heading>
      <Text>{locale === "zh-CN" ? "Codex Activity 是附着在 Work Item 下的执行/证据上下文，不替代 Story 或 Task / Work Item。" : "Codex Activity is execution/evidence context attached to Work Items, not a replacement for Story or Task / Work Item."}</Text>
      <WorkActivityFeed
        label="Codex Activity"
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
        <Heading level={2}>{locale === "zh-CN" ? "保存视图：Owner Feedback" : "Saved view: Owner Feedback"}</Heading>
        <WorkQuickFilters label={locale === "zh-CN" ? "保存视图过滤" : "Saved view filters"} filters={workQuickFilters("ownerFeedbackView", locale, routeHref)} />
        <WorkList
          label="Owner feedback saved view"
          rows={workListRows(locale, routeHref).filter((item) => item.id === "AOS-128" || item.id === "AOS-144")}
          density="compact"
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
      <WorkFieldPanel title={locale === "zh-CN" ? "关系词汇" : "Relationship vocabulary"} items={relationshipSummaryItems(locale)} density="compact" />
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

function workListRows(locale: TcrnLocale, routeHref: (path: string) => string): WorkItemRowProps[] {
  const isZh = locale === "zh-CN";
  return workItems.map((item, index) => {
    const row: WorkItemRowProps = {
      id: item.key,
      title: isZh ? translatePhrase(item.title, locale) : item.title,
      selected: item.key === "AOS-128",
      rank: `P${Math.min(index, 2)}`,
      priority: item.priority,
      owner: item.assignee,
      state: item.status === "Blocked" || item.status === "PM Changes Requested" || item.status === "PM Freshness Retry Pending"
        ? { state: "blocked", label: locale === "zh-CN" ? "已阻止" : "Blocked" }
        : item.status === "Done"
          ? { state: "local_only", label: locale === "zh-CN" ? "仅本地证明" : "Local proof only" }
          : { state: "review_required", label: locale === "zh-CN" ? "需要评审" : "Review required" },
      summary: translatePhrase(item.story, locale),
      fields: [
        { key: "status", label: translateColumn("status", locale), value: translatePhrase(item.status, locale) },
        { key: "gate", label: translateColumn("gate", locale), value: translatePhrase(item.gate, locale) },
        { key: "nextOwner", label: translateColumn("nextOwner", locale), value: item.nextOwner }
      ],
      relationships: item.key === "AOS-128"
        ? inspectorRelationships().slice(0, 2)
        : [{ relation: "relates_to", target: item.initiative }]
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

function detailMetadataItems(locale: TcrnLocale): KeyValueItem[] {
  return [
    { key: "aos", label: "AOS", value: <MachineTokenCell token={currentAosConsumptionBasis.aos} label="source" kind="generic" density="compact" /> },
    { key: "ds", label: "DS", value: <MachineTokenCell token={currentAosConsumptionBasis.ds} label="Storybook" kind="commit" density="compact" /> },
    { key: "workflow", label: "Workflow", value: <MachineTokenCell token={currentAosConsumptionBasis.workflow} label="plan" kind="commit" density="compact" /> },
    { key: "preview", label: "Preview", value: translatePhrase("Use Atlas/source markers for retained preview freshness; PM freshness retry pending.", locale) },
    { key: "ownerAcceptance", label: "Owner acceptance", value: "not claimed" },
    { key: "release", label: "Release readiness", value: "not claimed" }
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
      summary: locale === "zh-CN" ? "AOS 消费后仍需 clean-room 复审。" : "Clean-room re-review remains required after AOS consumption.",
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
  return [
    { key: "AOS-142", label: "AOS-142", value: `implements · ${translatePhrase("Story: PM can discuss Work flows", locale)}` },
    { key: "AOS-144", label: "AOS-144", value: `blocked_by · AOS-142` },
    { key: "owner-inspection", label: "Owner Inspection", value: `blocked_by · ${translatePhrase("Mara PM Readiness", locale)}` }
  ];
}

function relationshipSummaryItems(locale: TcrnLocale): KeyValueItem[] {
  return relationRows.map((row) => ({
    key: `${row.source}-${row.relation}-${row.target}`,
    label: row.relation,
    value: `${row.source} → ${row.target}: ${translatePhrase(row.note, locale)}`
  }));
}

function workIndexRows(locale: TcrnLocale) {
  const isZh = locale === "zh-CN";
  return workItems.map((item) => ({
    id: item.key,
    title: isZh ? translatePhrase(item.title, locale) : `${item.key} ${item.title}`,
    state: { state: item.status === "Blocked" || item.status === "PM Changes Requested" || item.status === "PM Freshness Retry Pending" ? "blocked" : item.status === "Done" ? "not_configured" : "review_required" },
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
    missingDecision: "缺少决策",
    name: "名称",
    next: "下一步",
    nextOwner: "下一 owner",
    note: "说明",
    order: "顺序",
    owner: "Owner",
    priority: "优先级",
    proof: "证明",
    purpose: "目的",
    rank: "排序",
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
    "Owner can inspect the shell capability boundary without fake controls": "Owner 可以检查没有虚假控件的壳层能力边界",
    "Rebuild Work routes with DS Work components": "用 DS Work 组件重建 Work 路由",
    "Static Work Management PRD mockups": "静态 Work Management PRD 示例",
    "ProductShell optional search contract": "ProductShell 可选搜索合同",
    "Owner inspection handoff package": "Owner 检查交接包",
    "PM Changes Requested": "PM 要求修改",
    "PM Freshness Retry Pending": "PM freshness 重试待完成",
    "PM freshness retry pending": "PM freshness 重试待完成",
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
    "No API integration": "未接 API",
    "Not integrated": "未接入",
    "Static filters": "静态过滤",
    "Static split inspector": "静态分栏检查器",
    "Full detail route remains canonical": "完整详情路由保持权威",
    "Static mockup only; route actions are not wired": "仅静态示例；route 动作未接线",
    "URL locale authority": "URL locale 权威",
    "DS contract accepted": "DS 合同已接受",
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
