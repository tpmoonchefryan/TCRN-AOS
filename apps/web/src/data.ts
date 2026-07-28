import type { TcrnLocale } from "@tcrn/ui-copy-state";
import { cockpitData } from "./cockpit-data.generated.js";

export const frontendShellRoutes = [
  "/",
  "/cockpit",
  "/work",
  // The eleven sidebar module routes (TCRN-AOS-INC-019). These are what
  // shellNavItems points at and what the client router already handles, but they
  // were absent from this list, so the server 404'd every one of them on a direct
  // request: refresh, bookmark, or shared deep link into the product's own primary
  // navigation. Clicking worked, which is why it went unnoticed — and why every
  // existing gate missed it, their assertion URLs being pinned to /cockpit and
  // /work, the two routes the sidebar never points at.
  "/my-work",
  "/inbox",
  "/dashboard",
  "/projects",
  "/work-items",
  "/board",
  "/release-trains",
  "/knowledge",
  "/deliberations",
  "/audit",
  "/snapshots",
  "/work/readback",
  "/work/board",
  "/work/backlog",
  "/work/items/AOS-128",
  "/work/gates",
  "/work/evidence",
  "/work/codex-activity",
  "/work/views/owner-feedback",
  "/work/initiatives/work-management-mvp",
  // `/operations-cockpit` is kept as the one alias in this table, because it is the
  // route four admitted visual-proof variants are named after
  // (`desktop-light-operations-cockpit`) and it resolves to the cockpit *by name*,
  // not by fallthrough.
  "/operations-cockpit",
  "/operations-cockpit.html"
  // TCRN-AOS-INC-021. Thirty-two further names stood here — /project-workspace,
  // /conference, /dependency-console, /settings, /ai-employee and the rest, each
  // with a .html twin. Every one answered 200 with bytes identical to /cockpit,
  // because `resolveCurrentRoute` falls back to the default nav item and
  // `resolveWorkMockupPageId` returns "queue" for anything it does not recognise.
  // Neither fallback errors, so a name nobody implemented resolved to a real page
  // with real markers — which is exactly what a marker gate reads as a pass.
  //
  // They were removed rather than implemented or 404'd, and the residual-
  // applicability question has an answer for each of the three groups they could
  // have fallen into:
  //   - not linked: zero references anywhere outside this table
  //   - not published: `build-mirror.mjs` writes the twelve real module routes and
  //     none of these, so no external URL contract ever included them
  //   - not designed: they entered in the 2026-06-29 placeholder shell slice, before
  //     the real IA existed, and the eleven sidebar modules that replaced them are
  //     the routes above
  // Two of the names describe surfaces that do exist under their real paths —
  // /conference is /deliberations, /knowledge-modules is /knowledge — so removing
  // the placeholder does not remove a capability. A path outside this table now
  // 404s, which is the honest answer for a page that was never built.
] as const;

/**
 * Modules that address one record by path — `/work-items/AOS-128` is an item,
 * `/work-items` is the list.
 *
 * These are the prefixes `app.tsx` parses a key out of. They are declared here
 * because the server has to admit them too, and admitting them was the second
 * half of TCRN-AOS-INC-019: adding the eleven module routes to the table above
 * fixed the module roots and left 424 dead link instances behind it, every one
 * of them a record link on a page whose whole job is to offer them. The two ends
 * of the app held two different matching rules — the client resolves by prefix
 * (`resolveCurrentRoute`, and `modulePath.startsWith(item.path + "/")`), the
 * server compared against an exact Set — so a link the client could render was
 * a link the server would not serve. One rule, declared once, is the fix; the
 * usability gate asserts this list still covers every prefix `app.tsx` parses.
 *
 * An unknown key is not an error here: the detail views render an EmptyState
 * naming the key they could not find, which is the honest answer to a stale
 * bookmark and a better one than a bare 404.
 */
export const recordAddressableModulePaths = ["/work-items", "/deliberations"] as const;

const frontendShellRouteSet = new Set<string>(frontendShellRoutes);

/**
 * Whether the server should render the shell for `path`.
 *
 * The one place this question is answered, so the server cannot drift from the
 * client router the way it did in INC-019.
 */
export function isFrontendShellRoute(path: string): boolean {
  if (frontendShellRouteSet.has(path)) return true;
  return recordAddressableModulePaths.some(
    (module) => path.startsWith(`${module}/`) && path.length > module.length + 1);
}

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
    productName: "TCRN AOS",
    moduleName: "運用コックピット",
    navLabel: "AOS 運用ナビゲーション",
    navGroupLabel: "運用モジュール",
    cockpitLabel: "運用コックピット",
    workLabel: "作業キュー",
    workReadbackLabel: "作業リードバック",
    currentLocation: "現在位置",
    contentLabel: "AOS 運用ワークスペース",
    skipLink: "運用コンテンツへスキップ",
    searchLabel: "AOS 運用を検索",
    shellSearch: "運用を検索",
    searchResults: "AOS 運用の検索結果",
    emptySearch: "一致する運用レコードはありません",
    localOnly: "読み取り専用プレビュー",
    dummyCockpit: "運用コックピット",
    workModule: "作業キュー",
    shellOverview: "AOS 運用コックピット",
    shellOverviewText: "現在の再構築作業、ゲート、証拠、決定、オーナー操作を、ライブディスパッチなしで確認します。",
    primaryTitle: "AOS 運用コックピット",
    primaryDescription: "現在の再構築作業、ゲート、証拠、決定、オーナー操作を、ライブディスパッチなしで確認します。",
    workTitle: "作業キュー",
    workIntro: "オーナー、ゲート、次の操作で現在の作業を確認します。",
    gateTitle: "ゲートと証拠",
    actionTitle: "オーナー操作",
    healthTitle: "サービス状態",
    activityTitle: "アクティビティ",
    activityText: "最近のアクティビティは DS ベースライン、AOS 実装、QA 証拠、PM 準備状況に集中しています。",
    disclosureTitle: "開発者向け詳細",
    boundary: "読み取り専用プレビュー",
    localProof: "ローカル証明のみ",
    noDispatch: "ライブディスパッチなし",
    developerDetailsText: "技術レシート、API サマリー、デバッグペイロードは二次開示に留め、オーナーの初期画面の主題にしてはなりません。",
    structuralPlaceholder: "レビュー待ち",
    fixtureRows: "合成運用データ行",
    localFixture: "読み取り専用サマリー",
    noLiveDispatch: "ライブディスパッチなし",
    backendReadback: "サービス状態",
    backendReadbackText: "API サマリーは二次的な開発者向け詳細に留め、一次的な生 JSON やデバッグ画面にはしません。",
    technicalPayload: "開発者ペイロード",
    registeredBoundary: "開発者向け詳細",
    visibleNavigation: "表示中の主ナビゲーション",
    futureModules: "将来のモジュール",
    rawPayload: "技術ペイロード",
    acceptance: "ゲート状態",
    cockpitAndWork: "運用コックピットと作業キュー",
    separateOwnerRoute: "別のオーナールートが必要",
    secondaryDisclosureOnly: "二次開示のみ",
    notClaimed: "未主張",
    externalQueue: "外部キュー",
    liveDispatch: "ライブディスパッチ",
    productAcceptance: "製品受け入れ",
    releaseReadiness: "リリース準備状況",
    none: "なし",
    notEnabled: "未有効",
    runtime: "ランタイム",
    stories: "ストーリー",
    gates: "ゲート",
    auditEvents: "監査イベント",
    finiteReadback: "有限リードバック",
    proofRequired: "レビューが必要",
    syntheticOnly: "合成データのみ",
    serviceProofOnly: "サービスサマリーのみ",
    readbackCounts: "リードバック件数",
    finiteLocalCounts: "有限ローカルサマリー",
    localFixtureState: "読み取り専用サマリー",
    project: "プロジェクト",
    initiative: "イニシアチブ",
    story: "ストーリー",
    gate: "ゲート",
    evidence: "証拠",
    decision: "決定",
    action: "操作",
    reason: "理由",
    api: "API",
    assignment: "割り当て",
    state: "状態",
    frontendRecovery: "AOS 再構築リカバリー",
    registeredShellSlice: "オーナー品質サーフェス",
    dsVisualInstance: "DS ビジュアルインスタンス",
    storybookParityProof: "オーナー品質ベースライン",
    cockpitStory: "運用コックピット",
    dummyCockpitOnly: "読み取り専用運用コックピット",
    deferredAggregation: "集計は後回し",
    productRoute: "製品ルート",
    runtimeReadbacks: "サービス状態",
    healthPolicyApi: "ヘルス、ポリシー、リードバック API",
    browserFetchFailClosed: "ブラウザ取得は fail-closed",
    noOverclaim: "読み取り専用のサンプルデータのみ。外部キュー、ライブディスパッチ、製品受け入れ、リリース準備状況はいずれも主張しません。"
  },
  ko: {
    productName: "TCRN AOS",
    moduleName: "운영 콕핏",
    navLabel: "AOS 운영 내비게이션",
    navGroupLabel: "운영 모듈",
    cockpitLabel: "운영 콕핏",
    workLabel: "작업 큐",
    workReadbackLabel: "작업 리드백",
    currentLocation: "현재 위치",
    contentLabel: "AOS 운영 작업 공간",
    skipLink: "운영 콘텐츠로 건너뛰기",
    searchLabel: "AOS 운영 검색",
    shellSearch: "운영 검색",
    searchResults: "AOS 운영 검색 결과",
    emptySearch: "일치하는 운영 레코드가 없습니다",
    localOnly: "읽기 전용 미리보기",
    dummyCockpit: "운영 콕핏",
    workModule: "작업 큐",
    shellOverview: "AOS 운영 콕핏",
    shellOverviewText: "현재 재구축 작업, 게이트, 증거, 결정, 오너 작업을 라이브 디스패치 없이 확인합니다.",
    primaryTitle: "AOS 운영 콕핏",
    primaryDescription: "현재 재구축 작업, 게이트, 증거, 결정, 오너 작업을 라이브 디스패치 없이 확인합니다.",
    workTitle: "작업 큐",
    workIntro: "오너, 게이트, 다음 작업 기준으로 현재 작업을 확인합니다.",
    gateTitle: "게이트와 증거",
    actionTitle: "오너 작업",
    healthTitle: "서비스 상태",
    activityTitle: "활동",
    activityText: "최근 활동은 DS 기준선, AOS 구현, QA 증거, PM 준비 상태에 집중되어 있습니다.",
    disclosureTitle: "개발자 세부 정보",
    boundary: "읽기 전용 미리보기",
    localProof: "로컬 증명만",
    noDispatch: "라이브 디스패치 없음",
    developerDetailsText: "기술 영수증, API 요약, 디버그 페이로드는 2차 공개에 두어야 하며 오너의 첫 화면 주제가 되어서는 안 됩니다.",
    structuralPlaceholder: "검토 대기",
    fixtureRows: "합성 운영 데이터 행",
    localFixture: "읽기 전용 요약",
    noLiveDispatch: "라이브 디스패치 없음",
    backendReadback: "서비스 상태",
    backendReadbackText: "API 요약은 2차 개발자 세부 정보에 두며, 1차 원시 JSON이나 디버그 화면으로 두지 않습니다.",
    technicalPayload: "개발자 페이로드",
    registeredBoundary: "개발자 세부 정보",
    visibleNavigation: "표시된 주 내비게이션",
    futureModules: "향후 모듈",
    rawPayload: "기술 페이로드",
    acceptance: "게이트 상태",
    cockpitAndWork: "운영 콕핏과 작업 큐",
    separateOwnerRoute: "별도의 오너 경로 필요",
    secondaryDisclosureOnly: "2차 공개만",
    notClaimed: "주장하지 않음",
    externalQueue: "외부 큐",
    liveDispatch: "라이브 디스패치",
    productAcceptance: "제품 수락",
    releaseReadiness: "릴리스 준비 상태",
    none: "없음",
    notEnabled: "활성화되지 않음",
    runtime: "런타임",
    stories: "스토리",
    gates: "게이트",
    auditEvents: "감사 이벤트",
    finiteReadback: "유한 리드백",
    proofRequired: "검토 필요",
    syntheticOnly: "합성 데이터만",
    serviceProofOnly: "서비스 요약만",
    readbackCounts: "리드백 건수",
    finiteLocalCounts: "유한 로컬 요약",
    localFixtureState: "읽기 전용 요약",
    project: "프로젝트",
    initiative: "이니셔티브",
    story: "스토리",
    gate: "게이트",
    evidence: "증거",
    decision: "결정",
    action: "작업",
    reason: "이유",
    api: "API",
    assignment: "할당",
    state: "상태",
    frontendRecovery: "AOS 재구축 복구",
    registeredShellSlice: "오너 품질 화면",
    dsVisualInstance: "DS 시각 인스턴스",
    storybookParityProof: "오너 품질 기준선",
    cockpitStory: "운영 콕핏",
    dummyCockpitOnly: "읽기 전용 운영 콕핏",
    deferredAggregation: "집계 연기",
    productRoute: "제품 경로",
    runtimeReadbacks: "서비스 상태",
    healthPolicyApi: "헬스, 정책, 리드백 API",
    browserFetchFailClosed: "브라우저 가져오기 fail-closed",
    noOverclaim: "읽기 전용 샘플 데이터만 사용하며, 외부 큐, 라이브 디스패치, 제품 수락, 릴리스 준비 상태는 어느 것도 주장하지 않습니다."
  },
  fr: {
    productName: "TCRN AOS",
    moduleName: "Cockpit opérations",
    navLabel: "Navigation opérations AOS",
    navGroupLabel: "Modules opérations",
    cockpitLabel: "Cockpit opérations",
    workLabel: "File de travail",
    workReadbackLabel: "Relecture du travail",
    currentLocation: "Emplacement actuel",
    contentLabel: "Espace de travail opérations AOS",
    skipLink: "Aller au contenu opérations",
    searchLabel: "Rechercher dans les opérations AOS",
    shellSearch: "Rechercher opérations",
    searchResults: "Résultats de recherche opérations AOS",
    emptySearch: "Aucun enregistrement opérations correspondant",
    localOnly: "Aperçu en lecture seule",
    dummyCockpit: "Cockpit opérations",
    workModule: "File de travail",
    shellOverview: "Cockpit opérations AOS",
    shellOverviewText: "Suivez le travail de reconstruction en cours, les portes, les preuves, les décisions et les actions du propriétaire, sans dispatch live.",
    primaryTitle: "Cockpit opérations AOS",
    primaryDescription: "Suivez le travail de reconstruction en cours, les portes, les preuves, les décisions et les actions du propriétaire, sans dispatch live.",
    workTitle: "File de travail",
    workIntro: "Parcourez le travail en cours par propriétaire, porte et action suivante.",
    gateTitle: "Portes et preuves",
    actionTitle: "Actions du propriétaire",
    healthTitle: "État du service",
    activityTitle: "Activité",
    activityText: "L'activité récente porte sur la référence DS, l'implémentation AOS, les preuves QA et la préparation PM.",
    disclosureTitle: "Détails développeur",
    boundary: "Aperçu en lecture seule",
    localProof: "Preuve locale seulement",
    noDispatch: "Aucun dispatch live",
    developerDetailsText: "Les reçus techniques, les résumés d'API et les charges de débogage restent en divulgation secondaire et ne doivent pas devenir le récit du premier écran du propriétaire.",
    structuralPlaceholder: "revue en attente",
    fixtureRows: "lignes opérations synthétiques",
    localFixture: "résumé en lecture seule",
    noLiveDispatch: "Aucun dispatch live",
    backendReadback: "État du service",
    backendReadbackText: "Les résumés d'API restent dans les détails développeur secondaires, jamais en surface primaire de JSON brut ou de débogage.",
    technicalPayload: "Charge développeur",
    registeredBoundary: "Détails développeur",
    visibleNavigation: "Navigation principale visible",
    futureModules: "Modules futurs",
    rawPayload: "Charge technique",
    acceptance: "État de la porte",
    cockpitAndWork: "Cockpit opérations et file de travail",
    separateOwnerRoute: "route propriétaire distincte requise",
    secondaryDisclosureOnly: "divulgation secondaire seulement",
    notClaimed: "non revendiqué",
    externalQueue: "File externe",
    liveDispatch: "Dispatch live",
    productAcceptance: "Acceptation produit",
    releaseReadiness: "Préparation de la publication",
    none: "aucun",
    notEnabled: "non activé",
    runtime: "Exécution",
    stories: "Stories",
    gates: "Portes",
    auditEvents: "Événements d'audit",
    finiteReadback: "relecture finie",
    proofRequired: "revue requise",
    syntheticOnly: "synthétique seulement",
    serviceProofOnly: "résumé de service seulement",
    readbackCounts: "Compteurs de relecture",
    finiteLocalCounts: "résumé local fini",
    localFixtureState: "résumé en lecture seule",
    project: "Projet",
    initiative: "Initiative",
    story: "Story",
    gate: "Porte",
    evidence: "Preuve",
    decision: "Décision",
    action: "Action",
    reason: "Raison",
    api: "API",
    assignment: "Affectation",
    state: "État",
    frontendRecovery: "Reprise de reconstruction AOS",
    registeredShellSlice: "Surface qualité propriétaire",
    dsVisualInstance: "Instance visuelle DS",
    storybookParityProof: "Référence qualité propriétaire",
    cockpitStory: "Cockpit opérations",
    dummyCockpitOnly: "Cockpit opérations en lecture seule",
    deferredAggregation: "Agrégation différée",
    productRoute: "Route produit",
    runtimeReadbacks: "État du service",
    healthPolicyApi: "API santé, politique, relecture",
    browserFetchFailClosed: "Récupération navigateur fail-closed",
    noOverclaim: "Données d'exemple en lecture seule uniquement ; aucune file externe, aucun dispatch live, aucune acceptation produit et aucun état de préparation de publication n'est revendiqué."
  }
};

/**
 * Nav labels in every locale AOS offers.
 *
 * `label` + `labelZh` was the highest-traffic instance of the bilingual shape in
 * the app: twelve sidebar entries and four section headings, on every screen, in
 * two languages, consumed by `currentLocale === "zh-CN" ? item.labelZh : item.label`.
 * A ja reader saw "My work", "Work items", "Release trains" — the product's own
 * primary navigation — in English, and no gate could catch it because the field
 * held exactly the two values it declared.
 *
 * `CopyEntry` here is the same shape as `copy.ts`, restated rather than imported
 * so `data.ts` keeps its one-way dependency (copy.ts imports nothing from data.ts
 * and vice versa); the type is structural, so the two are interchangeable at every
 * call site.
 */
export type NavCopy = Record<TcrnLocale, string>;

export interface ShellNavItem {
  id: string;
  label: NavCopy;
  path: string;
  description: string;
  /** Must be a name registered in @tcrn/ui-react tcrnIconNames. */
  icon: "home" | "database" | "layers" | "layout-grid" | "package" | "book-open" | "history" | "shield-check" | "settings" | "check";
  status: "active";
}

export interface ShellNavGroupDefinition {
  id: string;
  label: NavCopy;
  items: ShellNavItem[];
}

export const shellNavGroups: ShellNavGroupDefinition[] = [
  {
    id: "global",
    label: { "zh-CN": "全局", en: "Global", ja: "全体", ko: "전체", fr: "Global" },
    items: [
      {
        id: "my-work",
        label: { "zh-CN": "我的工作", en: "My work", ja: "自分の作業", ko: "내 작업", fr: "Mon travail" },
        path: "/my-work",
        description: "Everything waiting on you, in progress, and finished today across every project.",
        icon: "home",
        status: "active"
      },
      {
        id: "inbox",
        label: { "zh-CN": "收件箱", en: "Inbox", ja: "受信トレイ", ko: "받은 항목", fr: "Boîte de réception" },
        path: "/inbox",
        description: "Approval gates, open deliberations, and minutes awaiting a decision.",
        icon: "check",
        status: "active"
      },
      {
        id: "dashboard",
        label: { "zh-CN": "仪表盘", en: "Dashboard", ja: "ダッシュボード", ko: "대시보드", fr: "Tableau de bord" },
        path: "/dashboard",
        description: "Cross-project delivery and governance indicators.",
        icon: "layers",
        status: "active"
      }
    ]
  },
  {
    id: "delivery",
    label: { "zh-CN": "交付", en: "Delivery", ja: "デリバリー", ko: "인도", fr: "Livraison" },
    items: [
      {
        id: "projects",
        label: { "zh-CN": "项目", en: "Projects", ja: "プロジェクト", ko: "프로젝트", fr: "Projets" },
        path: "/projects",
        description: "One project per governed partition, each with its own chain version and as-of.",
        icon: "layers",
        status: "active"
      },
      {
        id: "work-items",
        label: { "zh-CN": "工作项", en: "Work items", ja: "作業項目", ko: "작업 항목", fr: "Éléments de travail" },
        path: "/work-items",
        description: "Search and manage every ticket; kind is a field, not a separate system.",
        icon: "database",
        status: "active"
      },
      {
        // The board sits under Delivery rather than in Global, and separately
        // from Dashboard, because they answer different questions: the board is
        // one project's work in the engine's own status columns, the dashboard
        // is every chain at once. They shared a route until a preview sweep
        // showed the Dashboard entry opening a board.
        id: "board",
        label: { "zh-CN": "看板", en: "Board", ja: "ボード", ko: "보드", fr: "Tableau" },
        path: "/board",
        description: "One project's work in the engine's own status columns, with permitted moves marked.",
        icon: "layout-grid",
        status: "active"
      },
      {
        id: "release-trains",
        label: { "zh-CN": "发布列车", en: "Release trains", ja: "リリーストレイン", ko: "릴리스 트레인", fr: "Trains de publication" },
        path: "/release-trains",
        description: "Initiatives packaged for release together; no time box.",
        icon: "package",
        status: "active"
      }
    ]
  },
  {
    id: "knowledge",
    label: { "zh-CN": "知识", en: "Knowledge", ja: "ナレッジ", ko: "지식", fr: "Connaissances" },
    items: [
      {
        id: "knowledge-space",
        label: { "zh-CN": "知识空间", en: "Knowledge space", ja: "ナレッジ空間", ko: "지식 공간", fr: "Espace de connaissances" },
        path: "/knowledge",
        description: "Conventions, curated cards, and minutes — rendered and searchable.",
        icon: "book-open",
        status: "active"
      }
    ]
  },
  {
    id: "governance",
    label: { "zh-CN": "治理", en: "Governance", ja: "ガバナンス", ko: "거버넌스", fr: "Gouvernance" },
    items: [
      {
        id: "deliberations",
        label: { "zh-CN": "审议", en: "Deliberations", ja: "審議", ko: "심의", fr: "Délibérations" },
        path: "/deliberations",
        description: "Position threads and minutes, with execution provenance shown as recorded.",
        icon: "history",
        status: "active"
      },
      {
        id: "audit",
        label: { "zh-CN": "审计视图", en: "Audit", ja: "監査", ko: "감사", fr: "Audit" },
        path: "/audit",
        description: "Timestamp shape, actor distribution, and chain version checks.",
        icon: "shield-check",
        status: "active"
      },
      {
        id: "snapshots",
        label: { "zh-CN": "快照健康", en: "Snapshot health", ja: "スナップショットの健全性", ko: "스냅샷 상태", fr: "Santé des instantanés" },
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
  /**
   * Fallback name only — the displayed one comes from `partitionDisplayName`.
   *
   * This interface used to carry `label` + `labelZh`, and the header, the board,
   * the governance view and four others all spent the pair as
   * `isZh ? labelZh : label`. Two fields cannot serve five locales, so every
   * project name in the product was English on the ja, ko and fr routes. The five
   * locales now live in one table in `cockpit-types.ts`; what remains here is the
   * projection's own name, used when a partition id is not registered there.
   */
  label: string;
  chainVersion: number;
  verifiedAt: string;
  workCount: number;
  initiatives: number;
  pendingGates: number;
  openConferences: number;
}

/**
 * The partitions the shell shows, derived from the projection rather than typed
 * out here.
 *
 * This used to be a hand-written seed carrying its own chain versions, which
 * drifted the moment the chains moved: the header offered "AOS v100" beside a
 * list built at v224. A freshness indicator that can be wrong about freshness is
 * worse than none, so the numbers now come from the same generated projection
 * the pages render from.
 */
export const chainPartitions: ChainPartitionSeed[] = cockpitData.partitions.map((partition) => {
  const work = cockpitData.work.filter((row) => row.partitionId === partition.id);
  return {
    id: partition.id,
    label: partition.label,
    chainVersion: partition.chainVersion,
    verifiedAt: partition.verifiedAt,
    workCount: work.length,
    initiatives: work.filter((row) => row.kind === "Initiative").length,
    pendingGates: cockpitData.gates.filter(
      (gate) => gate.partitionId === partition.id && gate.status === "pending").length,
    openConferences: cockpitData.conferences.filter(
      (conference) => conference.partitionId === partition.id && conference.status === "open").length
  };
});

