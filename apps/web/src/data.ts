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
    currentLocation: "当前位置",
    shellSearch: "搜索模块、工作项或证明",
    localOnly: "仅本地结构切片",
    dummyCockpit: "占位 Cockpit",
    workModule: "工作模块入口",
    noOverclaim: "本地示例数据；未接入外部队列、实时派发、产品验收或发布准备状态。"
  },
  en: {
    currentLocation: "Current location",
    shellSearch: "Search modules, work items, or proof",
    localOnly: "Local structural slice only",
    dummyCockpit: "Dummy Cockpit",
    workModule: "Work module entry",
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
  icon: "home" | "database" | "book-open" | "settings" | "package";
  status: "active" | "placeholder";
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
  },
  {
    id: "conference",
    label: "Conference",
    path: "/conference",
    description: "Local operating-loop placeholder; no external meeting queue.",
    icon: "package",
    status: "placeholder"
  },
  {
    id: "dependency",
    label: "Dependency",
    path: "/dependency",
    description: "Dependency console placeholder with local proof posture.",
    icon: "package",
    status: "placeholder"
  },
  {
    id: "resource",
    label: "Resource",
    path: "/resource",
    description: "Resource library placeholder; no materialization claim.",
    icon: "book-open",
    status: "placeholder"
  },
  {
    id: "docs",
    label: "Docs / Search / Release Linkage",
    path: "/docs",
    description: "Readiness linkage placeholder; no docs publication or release-ready claim.",
    icon: "book-open",
    status: "placeholder"
  },
  {
    id: "dispatch",
    label: "Dispatch Readback",
    path: "/dispatch",
    description: "Read-only dispatch posture placeholder; no live dispatch.",
    icon: "database",
    status: "placeholder"
  },
  {
    id: "settings",
    label: "Settings / Admin",
    path: "/settings",
    description: "Access and policy placeholder for future admin surfaces.",
    icon: "settings",
    status: "placeholder"
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
