import type { TcrnLocale } from "@tcrn/ui-copy-state";

export const frontendShellRoutes = [
  "/",
  "/cockpit",
  "/work",
  "/work/readback",
  "/work/board",
  "/work/backlog",
  "/work/items/AOS-128",
  "/work/gates",
  "/work/evidence",
  "/work/codex-activity",
  "/work/views/owner-feedback",
  "/work/initiatives/work-management-mvp",
  "/operations-cockpit",
  "/operations-cockpit.html",
  "/project-workspace",
  "/project-workspace.html",
  "/initiative-detail",
  "/initiative-detail.html",
  "/conference",
  "/conference.html",
  "/dependency",
  "/dependency-console",
  "/dependency-console.html",
  "/resource",
  "/resource-library",
  "/resource-library.html",
  "/docs",
  "/docs-readiness",
  "/docs-search-release-readiness",
  "/docs-search-release-readiness.html",
  "/dispatch",
  "/gateway-adapter",
  "/gateway-adapter.html",
  "/settings",
  "/admin-access",
  "/admin-access.html",
  "/aos-wide-product-design",
  "/aos-wide-product-design.html",
  "/ai-employee",
  "/ai-employee.html",
  "/gate-queue",
  "/gate-queue.html",
  "/github-release-linkage",
  "/github-release-linkage.html",
  "/knowledge-modules",
  "/knowledge-modules.html"
] as const;

export const localeCopy: Record<TcrnLocale, Record<string, string>> = {
  "zh-CN": {
    productName: "TCRN AOS",
    moduleName: "运营驾驶舱",
    navLabel: "AOS 运营导航",
    navGroupLabel: "运营模块",
    cockpitLabel: "运营驾驶舱",
    workLabel: "工作队列",
    workReadbackLabel: "工作读回",
    currentLocation: "当前位置",
    contentLabel: "AOS 运营工作区",
    skipLink: "跳转到运营内容",
    searchLabel: "搜索 AOS 运营",
    shellSearch: "搜索运营",
    searchResults: "AOS 运营搜索结果",
    emptySearch: "没有匹配的运营记录",
    localOnly: "只读预览",
    dummyCockpit: "运营驾驶舱",
    workModule: "工作队列",
    shellOverview: "AOS 运营驾驶舱",
    shellOverviewText: "查看当前重建工作、门禁、证据、决策和 owner 动作，不执行实时派发。",
    primaryTitle: "AOS 运营驾驶舱",
    primaryDescription: "查看当前重建工作、门禁、证据、决策和 owner 动作，不执行实时派发。",
    workTitle: "工作队列",
    workIntro: "按 owner、门禁和下一步查看当前工作。",
    gateTitle: "门禁与证据",
    actionTitle: "Owner 动作",
    healthTitle: "服务健康",
    activityTitle: "活动",
    activityText: "最近活动聚焦于 DS 基准、AOS 实现、QA 证据和 PM readiness。",
    disclosureTitle: "开发者细节",
    boundary: "只读预览",
    localProof: "仅本地证明",
    noDispatch: "无实时派发",
    developerDetailsText: "技术收据、API 摘要和调试载荷必须留在二级披露中，不能成为 owner 首屏故事。",
    structuralPlaceholder: "等待评审",
    fixtureRows: "合成运营数据",
    localFixture: "只读摘要",
    noLiveDispatch: "无实时派发",
    backendReadback: "服务健康",
    backendReadbackText: "API 摘要留在二级开发者细节中，不作为一级原始 JSON 或调试界面。",
    technicalPayload: "开发者载荷",
    registeredBoundary: "开发者细节",
    visibleNavigation: "可见主导航",
    futureModules: "未来模块",
    rawPayload: "技术载荷",
    acceptance: "门禁状态",
    cockpitAndWork: "运营驾驶舱和工作队列",
    separateOwnerRoute: "需要单独 owner route",
    secondaryDisclosureOnly: "仅二级披露",
    notClaimed: "未声明",
    externalQueue: "外部队列",
    liveDispatch: "实时派发",
    productAcceptance: "产品验收",
    releaseReadiness: "发布就绪",
    none: "无",
    notEnabled: "未启用",
    runtime: "运行时",
    stories: "故事",
    gates: "门禁",
    auditEvents: "审计事件",
    finiteReadback: "有限读回",
    proofRequired: "需要评审",
    syntheticOnly: "仅合成",
    serviceProofOnly: "仅服务摘要",
    readbackCounts: "读回计数",
    finiteLocalCounts: "有限本地摘要",
    localFixtureState: "只读摘要",
    project: "项目",
    initiative: "事项",
    story: "故事",
    gate: "门禁",
    evidence: "证据",
    decision: "决策",
    action: "动作",
    reason: "原因",
    api: "API",
    assignment: "分配",
    state: "状态",
    frontendRecovery: "AOS 重建恢复",
    registeredShellSlice: "Owner 质量界面",
    dsVisualInstance: "DS 视觉实例",
    storybookParityProof: "Owner 质量基准",
    cockpitStory: "运营驾驶舱",
    dummyCockpitOnly: "只读运营驾驶舱",
    deferredAggregation: "聚合延后",
    productRoute: "产品路线",
    runtimeReadbacks: "服务健康",
    healthPolicyApi: "健康、策略、读回 API",
    browserFetchFailClosed: "浏览器拉取失败关闭",
    noOverclaim: "只读示例数据；未接入外部队列、实时派发、产品验收或发布准备状态。"
  },
  en: {
    productName: "TCRN AOS",
    moduleName: "Operations Cockpit",
    navLabel: "AOS operations navigation",
    navGroupLabel: "Operations modules",
    cockpitLabel: "Operations Cockpit",
    workLabel: "Work queue",
    workReadbackLabel: "Work readback",
    currentLocation: "Current location",
    contentLabel: "AOS operations workspace",
    skipLink: "Skip to operations content",
    searchLabel: "Search AOS operations",
    shellSearch: "Search operations",
    searchResults: "AOS operations search results",
    emptySearch: "No matching operations records",
    localOnly: "Read-only preview",
    dummyCockpit: "Operations Cockpit",
    workModule: "Work queue",
    shellOverview: "AOS Operations Cockpit",
    shellOverviewText: "Track current rebuild work, gates, evidence, decisions, and owner actions without live dispatch.",
    primaryTitle: "AOS Operations Cockpit",
    primaryDescription: "Track current rebuild work, gates, evidence, decisions, and owner actions without live dispatch.",
    workTitle: "Work queue",
    workIntro: "Scan current work by owner, gate, and next action.",
    gateTitle: "Gates and evidence",
    actionTitle: "Owner actions",
    healthTitle: "Service health",
    activityTitle: "Activity",
    activityText: "Recent activity focuses on the DS baseline, AOS implementation, QA evidence, and PM readiness.",
    disclosureTitle: "Developer details",
    boundary: "Read-only preview",
    localProof: "Local proof only",
    noDispatch: "No live dispatch",
    developerDetailsText: "Technical receipts, API summaries, and debug payloads stay in secondary disclosure and must not become the owner first-viewport story.",
    structuralPlaceholder: "review queued",
    fixtureRows: "synthetic operations rows",
    localFixture: "read-only summary",
    noLiveDispatch: "No live dispatch",
    backendReadback: "Service health",
    backendReadbackText: "API summaries stay in secondary developer details, not a primary raw JSON/debug surface.",
    technicalPayload: "Developer payload",
    registeredBoundary: "Developer details",
    visibleNavigation: "Visible primary navigation",
    futureModules: "Future modules",
    rawPayload: "Technical payload",
    acceptance: "Gate status",
    cockpitAndWork: "Operations Cockpit and Work queue",
    separateOwnerRoute: "require separate owner route",
    secondaryDisclosureOnly: "secondary disclosure only",
    notClaimed: "not claimed",
    externalQueue: "External queue",
    liveDispatch: "Live dispatch",
    productAcceptance: "Product acceptance",
    releaseReadiness: "Release readiness",
    none: "none",
    notEnabled: "not enabled",
    runtime: "Runtime",
    stories: "Stories",
    gates: "Gates",
    auditEvents: "Audit events",
    finiteReadback: "finite readback",
    proofRequired: "review required",
    syntheticOnly: "synthetic only",
    serviceProofOnly: "service summary only",
    readbackCounts: "Readback counts",
    finiteLocalCounts: "finite local summary",
    localFixtureState: "read-only summary",
    project: "Project",
    initiative: "Initiative",
    story: "Story",
    gate: "Gate",
    evidence: "Evidence",
    decision: "Decision",
    action: "Action",
    reason: "Reason",
    api: "API",
    assignment: "Assignment",
    state: "State",
    frontendRecovery: "AOS rebuild recovery",
    registeredShellSlice: "Owner-quality surface",
    dsVisualInstance: "DS visual instance",
    storybookParityProof: "Owner-quality baseline",
    cockpitStory: "Operations Cockpit",
    dummyCockpitOnly: "Read-only Operations Cockpit",
    deferredAggregation: "Deferred aggregation",
    productRoute: "Product route",
    runtimeReadbacks: "Service health",
    healthPolicyApi: "Health, policy, readback API",
    browserFetchFailClosed: "Browser fetch fail-closed",
    noOverclaim: "Read-only sample data only; no external queue, live dispatch, product acceptance, or release-readiness state is claimed."
  },
  ja: {
    currentLocation: "現在位置",
    shellSearch: "運用を検索",
    localOnly: "読み取り専用プレビュー",
    dummyCockpit: "運用 Cockpit",
    workModule: "作業キュー",
    noOverclaim: "ローカルフィクスチャのみ。外部キュー、ライブディスパッチ、製品受け入れ、リリース準備は主張しません。"
  },
  ko: {
    currentLocation: "현재 위치",
    shellSearch: "운영 검색",
    localOnly: "읽기 전용 미리보기",
    dummyCockpit: "운영 Cockpit",
    workModule: "작업 큐",
    noOverclaim: "로컬 픽스처 데이터만 사용하며 외부 큐, 라이브 디스패치, 제품 수락 또는 릴리스 준비 상태를 주장하지 않습니다."
  },
  fr: {
    currentLocation: "Emplacement actuel",
    shellSearch: "Rechercher opérations",
    localOnly: "Aperçu en lecture seule",
    dummyCockpit: "Cockpit opérations",
    workModule: "File de travail",
    noOverclaim: "Données de fixture locales seulement ; aucune file externe, dispatch live, acceptation produit ou préparation release n'est revendiquée."
  }
};

export interface ShellNavItem {
  id: string;
  label: string;
  labelZh: string;
  path: string;
  description: string;
  /** Must be a name registered in @tcrn/ui-react tcrnIconNames. */
  icon: "home" | "database" | "layers" | "layout-grid" | "package" | "book-open" | "history" | "shield-check" | "settings" | "check";
  status: "active";
}

export interface ShellNavGroupDefinition {
  id: string;
  label: string;
  labelZh: string;
  items: ShellNavItem[];
}

export const shellNavGroups: ShellNavGroupDefinition[] = [
  {
    id: "global",
    label: "Global",
    labelZh: "全局",
    items: [
      {
        id: "my-work",
        label: "My work",
        labelZh: "我的工作",
        path: "/my-work",
        description: "Everything waiting on you, in progress, and finished today across every project.",
        icon: "home",
        status: "active"
      },
      {
        id: "inbox",
        label: "Inbox",
        labelZh: "收件箱",
        path: "/inbox",
        description: "Approval gates, open deliberations, and minutes awaiting a decision.",
        icon: "check",
        status: "active"
      },
      {
        id: "dashboard",
        label: "Dashboard",
        labelZh: "仪表盘",
        path: "/dashboard",
        description: "Cross-project delivery and governance indicators.",
        icon: "layout-grid",
        status: "active"
      }
    ]
  },
  {
    id: "delivery",
    label: "Delivery",
    labelZh: "交付",
    items: [
      {
        id: "projects",
        label: "Projects",
        labelZh: "项目",
        path: "/projects",
        description: "One project per governed partition, each with its own chain version and as-of.",
        icon: "layers",
        status: "active"
      },
      {
        id: "work-items",
        label: "Work items",
        labelZh: "工作项",
        path: "/work-items",
        description: "Search and manage every ticket; kind is a field, not a separate system.",
        icon: "database",
        status: "active"
      },
      {
        id: "release-trains",
        label: "Release trains",
        labelZh: "发布列车",
        path: "/release-trains",
        description: "Initiatives packaged for release together; no time box.",
        icon: "package",
        status: "active"
      }
    ]
  },
  {
    id: "knowledge",
    label: "Knowledge",
    labelZh: "知识",
    items: [
      {
        id: "knowledge-space",
        label: "Knowledge space",
        labelZh: "知识空间",
        path: "/knowledge",
        description: "Conventions, curated cards, and minutes — rendered and searchable.",
        icon: "book-open",
        status: "active"
      }
    ]
  },
  {
    id: "governance",
    label: "Governance",
    labelZh: "治理",
    items: [
      {
        id: "deliberations",
        label: "Deliberations",
        labelZh: "审议",
        path: "/deliberations",
        description: "Position threads and minutes, with execution provenance shown as recorded.",
        icon: "history",
        status: "active"
      },
      {
        id: "audit",
        label: "Audit",
        labelZh: "审计视图",
        path: "/audit",
        description: "Timestamp shape, actor distribution, and chain version checks.",
        icon: "shield-check",
        status: "active"
      },
      {
        id: "snapshots",
        label: "Snapshot health",
        labelZh: "快照健康",
        path: "/snapshots",
        description: "Last verified snapshot per partition and cadence adherence.",
        icon: "settings",
        status: "active"
      }
    ]
  }
];

/** Flattened for route resolution; the shell renders groups, routing needs items. */
export const shellNavItems: ShellNavItem[] = shellNavGroups.flatMap((group) => group.items);

export interface WorkModuleRow {
  key: string;
  project: string;
  initiative: string;
  story: string;
  gate: string;
  evidence: string;
  assignment: string;
  state: "review_required" | "blocked" | "not_configured";
}

export const workModuleRows: WorkModuleRow[] = [
  {
    key: "aos-shell",
    project: "TCRN-AOS",
    initiative: "AOS rebuild recovery",
    story: "Owner-quality visual baseline",
    gate: "DS owner-quality oracle",
    evidence: "Storybook owner-quality instance",
    assignment: "Elara",
    state: "review_required"
  },
  {
    key: "cockpit-final",
    project: "TCRN-AOS",
    initiative: "AOS first viewport",
    story: "Operations Cockpit remediation",
    gate: "Rendered owner-eye review",
    evidence: "current route implementation",
    assignment: "Ilya",
    state: "blocked"
  },
  {
    key: "readback",
    project: "TCRN-AOS",
    initiative: "Professional QA",
    story: "Evidence packet",
    gate: "QA route pending",
    evidence: "Rowan review required",
    assignment: "Rowan",
    state: "not_configured"
  }
];

export const forbiddenHumanAiTopbarMarkers = [
  "ai-consumption-contract.json",
  "data-ai-contract-human-topbar-link",
  "AI JSON"
] as const;


/**
 * The four governed chains this cockpit reads, with the version and verification
 * moment each was last projected at.
 *
 * These values are a build-time snapshot of the live chains. They exist so the
 * shell's as-of contract is exercised against real numbers before the ingestion
 * pipeline (TCRN-AOS-STORY-001/002) can supply them at runtime; once it does,
 * this constant is replaced by its output rather than edited.
 */
export interface ChainPartitionSeed {
  id: string;
  label: string;
  labelZh: string;
  chainVersion: number;
  verifiedAt: string;
  workCount: number;
  initiatives: number;
  pendingGates: number;
  openConferences: number;
}

export const chainPartitions: ChainPartitionSeed[] = [
  {
    id: "cross-project",
    label: "Platform governance",
    labelZh: "平台治理",
    chainVersion: 1254,
    verifiedAt: "2026-07-26T13:20:00Z",
    workCount: 177,
    initiatives: 12,
    pendingGates: 0,
    openConferences: 0
  },
  {
    id: "TCRN-Design-System",
    label: "Design System",
    labelZh: "设计系统",
    chainVersion: 924,
    verifiedAt: "2026-07-26T13:20:00Z",
    workCount: 153,
    initiatives: 12,
    pendingGates: 0,
    openConferences: 0
  },
  {
    id: "TCRN-TMS",
    label: "TMS",
    labelZh: "TMS",
    chainVersion: 228,
    verifiedAt: "2026-07-26T13:20:00Z",
    workCount: 39,
    initiatives: 2,
    pendingGates: 1,
    openConferences: 0
  },
  {
    id: "TCRN-AOS",
    label: "AOS",
    labelZh: "AOS",
    chainVersion: 100,
    verifiedAt: "2026-07-26T13:20:00Z",
    workCount: 30,
    initiatives: 1,
    pendingGates: 0,
    openConferences: 0
  }
];
