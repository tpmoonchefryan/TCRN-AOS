import type { TcrnLocale } from "@tcrn/ui-copy-state";

export const frontendShellRoutes = [
  "/",
  "/cockpit",
  "/work",
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
    productName: "AOS 重建工作区",
    moduleName: "前端壳切片",
    brandCaption: "重建工作区",
    navLabel: "已注册 AOS 模块",
    navGroupLabel: "已注册壳入口",
    cockpitLabel: "驾驶舱",
    workLabel: "工作",
    currentLocation: "当前位置",
    contentLabel: "AOS 壳内容",
    skipLink: "跳转到壳内容",
    searchLabel: "搜索 AOS 壳",
    shellSearch: "搜索模块、工作项或证明",
    searchResults: "AOS 壳搜索结果",
    emptySearch: "没有本地样例结果",
    localOnly: "仅本地结构切片",
    dummyCockpit: "占位 Cockpit",
    workModule: "工作模块入口",
    shellOverview: "AOS 前端壳",
    shellOverviewText: "此产品界面消耗已接受的 DS Storybook 视觉实例：ProductShell 导航、紧凑壳控件、本地只读姿态、占位 Cockpit 和 Work 入口。",
    structuralPlaceholder: "结构占位",
    fixtureRows: "样例安全行",
    localFixture: "本地样例",
    noLiveDispatch: "无实时派发",
    backendReadback: "后端读回",
    backendReadbackText: "API 读回使用样例安全服务摘要，不是一级原始 JSON 或调试界面。",
    technicalPayload: "技术 API 载荷",
    registeredBoundary: "已注册切片边界",
    visibleNavigation: "可见主导航",
    futureModules: "未来模块",
    rawPayload: "原始技术载荷",
    acceptance: "验收",
    cockpitAndWork: "Cockpit 和 Work",
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
    proofRequired: "需要证明",
    syntheticOnly: "仅合成",
    serviceProofOnly: "仅服务证明",
    readbackCounts: "读回计数",
    finiteLocalCounts: "有限本地计数",
    localFixtureState: "本地样例",
    project: "项目",
    initiative: "事项",
    story: "故事",
    gate: "门禁",
    evidence: "证据",
    assignment: "分配",
    state: "状态",
    frontendRecovery: "前端壳恢复",
    registeredShellSlice: "已注册壳切片",
    dsVisualInstance: "DS 视觉实例",
    storybookParityProof: "Storybook 奇偶性证明",
    cockpitStory: "驾驶舱",
    dummyCockpitOnly: "仅 Dummy Cockpit",
    deferredAggregation: "聚合延后",
    productRoute: "产品路线",
    runtimeReadbacks: "运行时读回",
    healthPolicyApi: "健康、策略、读回 API",
    browserFetchFailClosed: "浏览器拉取失败关闭",
    noOverclaim: "本地示例数据；未接入外部队列、实时派发、产品验收或发布准备状态。"
  },
  en: {
    productName: "AOS Rebuild Workspace",
    moduleName: "Frontend shell slice",
    brandCaption: "Rebuild workspace",
    navLabel: "Registered AOS modules",
    navGroupLabel: "Registered shell entries",
    cockpitLabel: "Cockpit",
    workLabel: "Work",
    currentLocation: "Current location",
    contentLabel: "AOS shell content",
    skipLink: "Skip to shell content",
    searchLabel: "Search AOS shell",
    shellSearch: "Search modules, work items, or proof",
    searchResults: "AOS shell search results",
    emptySearch: "No local fixture results",
    localOnly: "Local structural slice only",
    dummyCockpit: "Dummy Cockpit",
    workModule: "Work module entry",
    shellOverview: "AOS frontend shell",
    shellOverviewText: "This product surface consumes the accepted DS Storybook visual instance: ProductShell navigation, compact shell controls, local-only readback posture, dummy Cockpit, and the Work entry.",
    structuralPlaceholder: "structural placeholder",
    fixtureRows: "fixture-safe rows",
    localFixture: "local fixture",
    noLiveDispatch: "no live dispatch",
    backendReadback: "Backend readback",
    backendReadbackText: "API readbacks use fixture-safe service summaries, not a primary raw JSON/debug surface.",
    technicalPayload: "Technical API payload",
    registeredBoundary: "Registered slice boundary",
    visibleNavigation: "Visible primary navigation",
    futureModules: "Future modules",
    rawPayload: "Raw technical payload",
    acceptance: "Acceptance",
    cockpitAndWork: "Cockpit and Work",
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
    proofRequired: "proof required",
    syntheticOnly: "synthetic only",
    serviceProofOnly: "service proof only",
    readbackCounts: "Readback counts",
    finiteLocalCounts: "finite local counts",
    localFixtureState: "local fixture",
    project: "Project",
    initiative: "Initiative",
    story: "Story",
    gate: "Gate",
    evidence: "Evidence",
    assignment: "Assignment",
    state: "State",
    frontendRecovery: "Frontend shell recovery",
    registeredShellSlice: "Registered shell slice",
    dsVisualInstance: "DS visual instance",
    storybookParityProof: "Storybook parity proof",
    cockpitStory: "Cockpit",
    dummyCockpitOnly: "Dummy Cockpit only",
    deferredAggregation: "Deferred aggregation",
    productRoute: "Product route",
    runtimeReadbacks: "Runtime readbacks",
    healthPolicyApi: "Health, policy, readback API",
    browserFetchFailClosed: "Browser fetch fail-closed",
    noOverclaim: "Local fixture data only; no external queue, live dispatch, product acceptance, or release-readiness state is claimed."
  },
  ja: {
    currentLocation: "現在位置",
    shellSearch: "モジュール、作業項目、証明を検索",
    localOnly: "ローカル構造スライスのみ",
    dummyCockpit: "仮 Cockpit",
    workModule: "作業モジュール入口",
    noOverclaim: "ローカルフィクスチャのみ。外部キュー、ライブディスパッチ、製品受け入れ、リリース準備は主張しません。"
  },
  ko: {
    currentLocation: "현재 위치",
    shellSearch: "모듈, 작업 항목 또는 증명 검색",
    localOnly: "로컬 구조 슬라이스 전용",
    dummyCockpit: "더미 Cockpit",
    workModule: "작업 모듈 진입점",
    noOverclaim: "로컬 픽스처 데이터만 사용하며 외부 큐, 라이브 디스패치, 제품 수락 또는 릴리스 준비 상태를 주장하지 않습니다."
  },
  fr: {
    currentLocation: "Emplacement actuel",
    shellSearch: "Rechercher modules, travaux ou preuves",
    localOnly: "Tranche structurelle locale seulement",
    dummyCockpit: "Cockpit factice",
    workModule: "Entrée module travail",
    noOverclaim: "Données de fixture locales seulement ; aucune file externe, dispatch live, acceptation produit ou préparation release n'est revendiquée."
  }
};

export interface ShellNavItem {
  id: string;
  label: string;
  path: string;
  description: string;
  icon: "home" | "database";
  status: "active";
}

export const shellNavItems: ShellNavItem[] = [
  {
    id: "cockpit",
    label: "Cockpit",
    path: "/cockpit",
    description: "Structural dashboard placeholder with backend readback counts.",
    icon: "home",
    status: "active"
  },
  {
    id: "work",
    label: "Work",
    path: "/work",
    description: "Jira-like project, initiative, story, gate, evidence, and assignment entry.",
    icon: "database",
    status: "active"
  }
];

export interface WorkModuleRow {
  key: string;
  project: string;
  initiative: string;
  story: string;
  gate: string;
  evidence: string;
  assignment: string;
  state: "fixture_only" | "local_only" | "proof_required";
}

export const workModuleRows: WorkModuleRow[] = [
  {
    key: "aos-shell",
    project: "TCRN-AOS",
    initiative: "AOS frontend shell",
    story: "First shell slice",
    gate: "DS Storybook contract consumed",
    evidence: "aos:frontend-shell-proof",
    assignment: "Ilya",
    state: "local_only"
  },
  {
    key: "cockpit-final",
    project: "TCRN-AOS",
    initiative: "Cockpit aggregation",
    story: "Final live cockpit deferred",
    gate: "Owner/Product route required",
    evidence: "not claimed in this slice",
    assignment: "Future implementation lane",
    state: "proof_required"
  },
  {
    key: "readback",
    project: "TCRN-AOS",
    initiative: "Runtime readbacks",
    story: "Health, policy, readback API",
    gate: "Browser fetch fail-closed",
    evidence: "/api/health /api/readback /api/policy",
    assignment: "Local service",
    state: "fixture_only"
  }
];

export const forbiddenHumanAiTopbarMarkers = [
  "ai-consumption-contract.json",
  "data-ai-contract-human-topbar-link",
  "AI JSON"
] as const;
