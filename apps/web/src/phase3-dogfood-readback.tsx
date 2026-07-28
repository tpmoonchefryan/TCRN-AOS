import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  EnvironmentBanner,
  Heading,
  MachineTokenCell,
  MetadataRail,
  StatusBadge,
  Surface,
  Text,
  WorkActivityFeed,
  WorkList,
  WorkPageHeader,
  WorkQuickFilters,
  WorkViewTabs,
  type WorkActivityFeedItem,
  type WorkItemRowProps
} from "@tcrn/ui-react";
import type { TcrnLocale } from "@tcrn/ui-copy-state";

import { format, joinNames, pick, type CopyEntry } from "./copy.js";
import { localeCopy } from "./data.js";

const ticketEndpoint = "/api/work/readback/tickets";
const auditEndpoint = "/api/work/readback/audit";
const policyEndpoint = "/api/work/readback/policy";
const knowledgeSearchEndpoint = "/api/work/readback/knowledge/search";
const knowledgeEntryEndpoint = "/api/work/readback/knowledge/entry";
const ticketDefaultLimit = 10;
const ticketMaxLimit = 20;
/**
 * The documented default from `apps/api/src/work-readback.ts`, shown only until
 * the policy endpoint answers with the budget actually in force. The rail used
 * to print `16384 bytes` unconditionally, which would have kept asserting this
 * number after the service moved off it.
 */
const readbackResponseBudgetBytes = 16_384;
const auditDefaultLimit = 5;
const knowledgeDefaultLimit = 5;

const ticketQueryPassThroughKeys = new Set([
  "initiativeId",
  "epicId",
  "storyId",
  "status",
  "assigneeEmployeeId",
  "limit",
  "cursor",
  "updatedSince",
  "employeeId",
  "actor",
  "role",
  "threadId",
  "sessionId",
  "clientEnv",
  "auth",
  "authorization",
  "method"
]);

interface Phase3DogfoodReadbackProps {
  locale: TcrnLocale;
  theme: "light" | "dark";
  routeHref: (path: string) => string;
}

/**
 * Readback copy in all five locales.
 *
 * This view's whole claim is negative: it reads, it does not write, it shows
 * only the safe summary of each row, and it does not claim readiness. Every one
 * of those statements was a sentence in English or Chinese and nothing else —
 * "Displays redacted detail summaries only", "Read-only service proof;
 * readiness not claimed", "no live dispatch". On a ja, ko or fr route the
 * screen kept the data and dropped the disclaimers, which is the one direction
 * an honest surface must not fail in.
 *
 * Two strings are deliberately absent from this table. The page title and the
 * `/work` breadcrumb live in `localeCopy` (`workReadbackLabel`, `workLabel`),
 * already in five locales and already asserted by the zh branch of the readback
 * proof; a copy here would be a second source for a string under assertion.
 */
const readbackCopy = {
  readback: { "zh-CN": "读回", en: "Readback", ja: "リードバック", ko: "리드백", fr: "Relecture" },
  pageDescription: {
    "zh-CN": "只读服务证明视图，读取已接受的 /api/work/readback 票据与故事审计时间线。",
    en: "Read-only service-proof view over the accepted /api/work/readback ticket list and story-scoped audit timeline.",
    ja: "受理済みの /api/work/readback チケット一覧とストーリー単位の監査タイムラインを読む、読み取り専用のサービス証明ビューです。",
    ko: "수락된 /api/work/readback 티켓 목록과 스토리 단위 감사 타임라인을 읽는 읽기 전용 서비스 증명 화면입니다.",
    fr: "Vue de preuve de service en lecture seule sur la liste de tickets /api/work/readback acceptée et la chronologie d'audit propre à la story."
  },
  noLiveDispatch: {
    "zh-CN": "无实时派发",
    en: "No live dispatch",
    ja: "実時間ディスパッチなし",
    ko: "실시간 디스패치 없음",
    fr: "Aucune répartition en direct"
  },
  workReadbackViews: {
    "zh-CN": "工作读回视图",
    en: "Work readback views",
    ja: "作業リードバックのビュー",
    ko: "작업 리드백 보기",
    fr: "Vues de relecture du travail"
  },
  tickets: { "zh-CN": "票据", en: "Tickets", ja: "チケット", ko: "티켓", fr: "Tickets" },
  storyAudit: { "zh-CN": "故事审计", en: "Story audit", ja: "ストーリー監査", ko: "스토리 감사", fr: "Audit de story" },
  knowledge: { "zh-CN": "知识", en: "Knowledge", ja: "ナレッジ", ko: "지식", fr: "Connaissance" },
  dsGaps: { "zh-CN": "DS 差距", en: "DS gaps", ja: "DS のギャップ", ko: "DS 격차", fr: "Écarts DS" },
  storyStatusFilters: {
    "zh-CN": "故事状态过滤器",
    en: "Story status filters",
    ja: "ストーリー状態のフィルタ",
    ko: "스토리 상태 필터",
    fr: "Filtres d'état de story"
  },
  readbackMethodsOnly: {
    "zh-CN": "浏览器只使用读回方法：",
    en: "Browser surface uses readback methods only:",
    ja: "ブラウザ面はリードバック手法のみを使います：",
    ko: "브라우저 표면은 리드백 메서드만 사용합니다:",
    fr: "La surface navigateur n'utilise que des méthodes de relecture :"
  },
  ticketReadbackAndAudit: {
    "zh-CN": "票据读回和审计时间线",
    en: "Ticket readback and audit timeline",
    ja: "チケットのリードバックと監査タイムライン",
    ko: "티켓 리드백과 감사 타임라인",
    fr: "Relecture des tickets et chronologie d'audit"
  },
  storyGrainTickets: {
    "zh-CN": "故事粒度票据",
    en: "Story-grain tickets",
    ja: "ストーリー粒度のチケット",
    ko: "스토리 단위 티켓",
    fr: "Tickets au grain de la story"
  },
  safeSummaryFields: {
    "zh-CN": "仅展示安全摘要字段，分页游标和筛选摘要。",
    en: "Shows safe summary fields, page cursors, and filter metadata only.",
    ja: "安全なサマリ項目・ページカーソル・絞り込みメタデータのみを表示します。",
    ko: "안전한 요약 필드, 페이지 커서, 필터 메타데이터만 표시합니다.",
    fr: "N'affiche que les champs de résumé sûrs, les curseurs de page et les métadonnées de filtre."
  },
  loadingTickets: {
    "zh-CN": "正在读取票据",
    en: "Loading tickets",
    ja: "チケットを読み込んでいます",
    ko: "티켓을 불러오는 중",
    fr: "Chargement des tickets"
  },
  storyTicketReadback: {
    "zh-CN": "故事票据读回",
    en: "Story ticket readback",
    ja: "ストーリー・チケットのリードバック",
    ko: "스토리 티켓 리드백",
    fr: "Relecture des tickets de story"
  },
  noStoryRows: {
    "zh-CN": "当前筛选没有故事行。",
    en: "No story rows match the current filter.",
    ja: "現在の絞り込みに一致するストーリー行はありません。",
    ko: "현재 필터에 일치하는 스토리 행이 없습니다.",
    fr: "Aucune ligne de story ne correspond au filtre actuel."
  },
  waitingForStory: {
    "zh-CN": "等待选择故事",
    en: "Waiting for story selection",
    ja: "ストーリーの選択を待っています",
    ko: "스토리 선택을 기다리는 중",
    fr: "En attente de la sélection d'une story"
  },
  storyLevelReadbackNote: {
    "zh-CN": "故事级读回；审计时间线始终绑定所选 storyId。",
    en: "Story-level readback; audit timeline is always bound to the selected storyId.",
    ja: "ストーリー単位のリードバックです。監査タイムラインは常に選択中の storyId に束ねられます。",
    ko: "스토리 단위 리드백입니다. 감사 타임라인은 항상 선택한 storyId 에 묶여 있습니다.",
    fr: "Relecture au niveau de la story ; la chronologie d'audit est toujours liée au storyId sélectionné."
  },
  selectStoryForAudit: {
    "zh-CN": "选择故事后显示审计时间线。",
    en: "Select a story to load its audit timeline.",
    ja: "ストーリーを選ぶと監査タイムラインを読み込みます。",
    ko: "스토리를 선택하면 감사 타임라인을 불러옵니다.",
    fr: "Sélectionnez une story pour charger sa chronologie d'audit."
  },
  auditTimeline: {
    "zh-CN": "审计时间线",
    en: "Audit timeline",
    ja: "監査タイムライン",
    ko: "감사 타임라인",
    fr: "Chronologie d'audit"
  },
  redactedOnly: {
    "zh-CN": "仅显示 redacted details 摘要，不显示原始审计详情。",
    en: "Displays redacted detail summaries only, never raw audit details.",
    ja: "秘匿処理済みの詳細サマリのみを表示し、生の監査詳細は表示しません。",
    ko: "가려진 상세 요약만 표시하고 원본 감사 상세는 표시하지 않습니다.",
    fr: "N'affiche que des résumés de détails expurgés, jamais les détails d'audit bruts."
  },
  loadingStoryAudit: {
    "zh-CN": "正在读取故事审计",
    en: "Loading story audit",
    ja: "ストーリー監査を読み込んでいます",
    ko: "스토리 감사를 불러오는 중",
    fr: "Chargement de l'audit de la story"
  },
  storyAuditTimeline: {
    "zh-CN": "故事审计时间线",
    en: "Story audit timeline",
    ja: "ストーリー監査のタイムライン",
    ko: "스토리 감사 타임라인",
    fr: "Chronologie d'audit de la story"
  },
  auditWaitsForStory: {
    "zh-CN": "审计时间线等待故事选择。",
    en: "Audit timeline waits for story selection.",
    ja: "監査タイムラインはストーリーの選択を待ちます。",
    ko: "감사 타임라인은 스토리 선택을 기다립니다.",
    fr: "La chronologie d'audit attend la sélection d'une story."
  },
  readbackBoundary: {
    "zh-CN": "读回边界",
    en: "Readback boundary",
    ja: "リードバックの境界",
    ko: "리드백 경계",
    fr: "Limite de relecture"
  },
  knowledgeSearchAndDetail: {
    "zh-CN": "只读知识搜索和详情",
    en: "Read-only knowledge search and detail",
    ja: "読み取り専用のナレッジ検索と詳細",
    ko: "읽기 전용 지식 검색과 상세",
    fr: "Recherche et détail de connaissance en lecture seule"
  },
  knowledgeReadback: {
    "zh-CN": "知识读回",
    en: "Knowledge readback",
    ja: "ナレッジのリードバック",
    ko: "지식 리드백",
    fr: "Relecture de la connaissance"
  },
  knowledgeSearchIntro: {
    "zh-CN": "通过 /work/readback 只读门面搜索 KR-02 知识片段。",
    en: "Search KR-02 knowledge snippets through the read-only /work/readback facade.",
    ja: "読み取り専用の /work/readback ファサード経由で KR-02 のナレッジ断片を検索します。",
    ko: "읽기 전용 /work/readback 파사드를 통해 KR-02 지식 조각을 검색합니다.",
    fr: "Cherchez les extraits de connaissance KR-02 via la façade en lecture seule /work/readback."
  },
  searchKnowledge: {
    "zh-CN": "搜索知识",
    en: "Search knowledge",
    ja: "ナレッジを検索",
    ko: "지식 검색",
    fr: "Rechercher dans la connaissance"
  },
  search: { "zh-CN": "搜索", en: "Search", ja: "検索", ko: "검색", fr: "Rechercher" },
  searchingKnowledge: {
    "zh-CN": "正在搜索知识",
    en: "Searching knowledge",
    ja: "ナレッジを検索しています",
    ko: "지식을 검색하는 중",
    fr: "Recherche dans la connaissance"
  },
  noKnowledgeMatch: {
    "zh-CN": "没有匹配的知识片段。",
    en: "No knowledge snippets match the current query.",
    ja: "現在の検索語に一致するナレッジ断片はありません。",
    ko: "현재 검색어에 일치하는 지식 조각이 없습니다.",
    fr: "Aucun extrait de connaissance ne correspond à la requête actuelle."
  },
  knowledgeDetail: {
    "zh-CN": "知识详情",
    en: "Knowledge detail",
    ja: "ナレッジの詳細",
    ko: "지식 상세",
    fr: "Détail de connaissance"
  },
  knowledgeDetailIntro: {
    "zh-CN": "所选条目的正文，标签和验证元数据。",
    en: "Body, tags, and verification metadata for the selected entry.",
    ja: "選択中の項目の本文・タグ・検証メタデータです。",
    ko: "선택한 항목의 본문, 태그, 검증 메타데이터입니다.",
    fr: "Corps, étiquettes et métadonnées de vérification de l'entrée sélectionnée."
  },
  loadingKnowledgeDetail: {
    "zh-CN": "正在读取知识详情",
    en: "Loading knowledge detail",
    ja: "ナレッジ詳細を読み込んでいます",
    ko: "지식 상세를 불러오는 중",
    fr: "Chargement du détail de connaissance"
  },
  selectKnowledgeResult: {
    "zh-CN": "选择知识结果以读取详情。",
    en: "Select a knowledge result to read the entry detail.",
    ja: "検索結果を選ぶと項目の詳細を読み込みます。",
    ko: "검색 결과를 선택하면 항목 상세를 읽습니다.",
    fr: "Sélectionnez un résultat pour lire le détail de l'entrée."
  },
  readOnlyServiceProof: {
    "zh-CN": "只读服务证明；未声明 readiness",
    en: "Read-only service proof; readiness not claimed",
    ja: "読み取り専用のサービス証明。readiness は主張していません",
    ko: "읽기 전용 서비스 증명. readiness 는 주장하지 않습니다",
    fr: "Preuve de service en lecture seule ; readiness non revendiquée"
  },
  all: { "zh-CN": "全部", en: "All", ja: "すべて", ko: "전체", fr: "Tout" },
  stories: { "zh-CN": "故事", en: "stories", ja: "ストーリー", ko: "스토리", fr: "stories" },
  accepted: { "zh-CN": "已接受", en: "Accepted", ja: "受理済み", ko: "수락됨", fr: "Accepté" },
  inProgress: { "zh-CN": "进行中", en: "In progress", ja: "進行中", ko: "진행 중", fr: "En cours" },
  // "ブロック中" and "차단됨" are what `cockpit-board`, `cockpit-views` and DS's own
  // readiness vocabulary already use for this state; a second wording for the
  // same status would read as two different states to the same reader.
  blocked: { "zh-CN": "已阻塞", en: "Blocked", ja: "ブロック中", ko: "차단됨", fr: "Bloqué" },
  unassigned: { "zh-CN": "未分配", en: "unassigned", ja: "未割り当て", ko: "미배정", fr: "non attribué" },
  storyLevelReadback: {
    "zh-CN": "故事级读回",
    en: "Story-level readback",
    ja: "ストーリー単位のリードバック",
    ko: "스토리 단위 리드백",
    fr: "Relecture au niveau de la story"
  },
  initiative: { "zh-CN": "事项", en: "Initiative", ja: "イニシアチブ", ko: "이니셔티브", fr: "Initiative" },
  audit: { "zh-CN": "审计", en: "Audit", ja: "監査", ko: "감사", fr: "Audit" },
  storySummary: {
    "zh-CN": "故事摘要",
    en: "Story summary",
    ja: "ストーリーの要約",
    ko: "스토리 요약",
    fr: "Résumé de la story"
  },
  status: { "zh-CN": "状态", en: "Status", ja: "状態", ko: "상태", fr: "État" },
  latestEvidence: {
    "zh-CN": "最新证据",
    en: "Latest evidence",
    ja: "最新の証拠",
    ko: "최신 증거",
    fr: "Dernière preuve"
  },
  latestGate: { "zh-CN": "最新门禁", en: "Latest gate", ja: "最新のゲート", ko: "최신 게이트", fr: "Dernière porte" },
  subtaskSummaries: {
    "zh-CN": "子任务摘要",
    en: "Subtask summaries",
    ja: "サブタスクの要約",
    ko: "하위 작업 요약",
    fr: "Résumés des sous-tâches"
  },
  rolePending: {
    "zh-CN": "角色待定",
    en: "role pending",
    ja: "役割は未定",
    ko: "역할 미정",
    fr: "rôle en attente"
  },
  none: { "zh-CN": "无", en: "none", ja: "なし", ko: "없음", fr: "aucune" },
  target: { "zh-CN": "目标", en: "Target", ja: "対象", ko: "대상", fr: "Cible" },
  details: { "zh-CN": "详情", en: "details", ja: "詳細", ko: "상세", fr: "détails" },
  redacted: { "zh-CN": "已删减", en: "redacted", ja: "秘匿処理済み", ko: "가려짐", fr: "expurgé" },
  fields: { "zh-CN": "字段", en: "fields", ja: "項目", ko: "필드", fr: "champs" },
  surface: { "zh-CN": "界面", en: "Surface", ja: "面", ko: "표면", fr: "Surface" },
  ticketMethod: {
    "zh-CN": "票据方法",
    en: "Ticket method",
    ja: "チケット手法",
    ko: "티켓 메서드",
    fr: "Méthode de ticket"
  },
  rowGrain: { "zh-CN": "行粒度", en: "Row grain", ja: "行の粒度", ko: "행 단위", fr: "Grain de ligne" },
  selectedStory: {
    "zh-CN": "所选故事",
    en: "Selected story",
    ja: "選択中のストーリー",
    ko: "선택한 스토리",
    fr: "Story sélectionnée"
  },
  auditMethod: {
    "zh-CN": "审计方法",
    en: "Audit method",
    ja: "監査手法",
    ko: "감사 메서드",
    fr: "Méthode d'audit"
  },
  policy: { "zh-CN": "策略", en: "Policy", ja: "ポリシー", ko: "정책", fr: "Politique" },
  pageLabel: { "zh-CN": "分页", en: "Page", ja: "ページ", ko: "페이지", fr: "Page" },
  responseBudget: {
    "zh-CN": "响应预算",
    en: "Response budget",
    ja: "応答予算",
    ko: "응답 예산",
    fr: "Budget de réponse"
  },
  runtimeActivation: {
    "zh-CN": "运行时激活",
    en: "Runtime activation",
    ja: "ランタイムの有効化",
    ko: "런타임 활성화",
    fr: "Activation d'exécution"
  },
  notClaimed: { "zh-CN": "未声明", en: "not claimed", ja: "未主張", ko: "미주장", fr: "non revendiqué" },
  ticketPagination: {
    "zh-CN": "票据分页",
    en: "Ticket pagination",
    ja: "チケットのページ送り",
    ko: "티켓 페이지 나누기",
    fr: "Pagination des tickets"
  },
  previousNotInProof: {
    "zh-CN": "前页不在此证明路径",
    en: "Previous page is not part of this proof path",
    ja: "前ページはこの証明経路に含まれません",
    ko: "이전 페이지는 이 증명 경로에 포함되지 않습니다",
    fr: "La page précédente ne fait pas partie de ce chemin de preuve"
  },
  previous: { "zh-CN": "上一页", en: "Previous", ja: "前へ", ko: "이전", fr: "Précédent" },
  next: { "zh-CN": "下一页", en: "Next", ja: "次へ", ko: "다음", fr: "Suivant" },
  noNextPage: {
    "zh-CN": "没有下一页",
    en: "No next page",
    ja: "次のページはありません",
    ko: "다음 페이지가 없습니다",
    fr: "Pas de page suivante"
  },
  noSummary: { "zh-CN": "无摘要", en: "No summary", ja: "要約なし", ko: "요약 없음", fr: "Aucun résumé" },
  knowledgeRecord: {
    "zh-CN": "知识记录",
    en: "Knowledge record",
    ja: "ナレッジ記録",
    ko: "지식 기록",
    fr: "Enregistrement de connaissance"
  },
  readMethod: {
    "zh-CN": "读取方法",
    en: "Read method",
    ja: "読み取り手法",
    ko: "읽기 메서드",
    fr: "Méthode de lecture"
  },
  stale: { "zh-CN": "陈旧", en: "Stale", ja: "情報が古い", ko: "낡음", fr: "Périmé" },
  yes: { "zh-CN": "是", en: "yes", ja: "はい", ko: "예", fr: "oui" },
  no: { "zh-CN": "否", en: "no", ja: "いいえ", ko: "아니요", fr: "non" },
  sourceDigest: {
    "zh-CN": "来源摘要",
    en: "Source digest",
    ja: "出典ダイジェスト",
    ko: "출처 다이제스트",
    fr: "Empreinte de la source"
  },
  noBody: {
    "zh-CN": "没有正文。",
    en: "No body returned.",
    ja: "本文は返されていません。",
    ko: "본문이 반환되지 않았습니다.",
    fr: "Aucun corps renvoyé."
  },
  readOnly: { "zh-CN": "只读", en: "Read-only", ja: "読み取り専用", ko: "읽기 전용", fr: "Lecture seule" },
  serviceProof: {
    "zh-CN": "服务证明",
    en: "Service proof",
    ja: "サービス証明",
    ko: "서비스 증명",
    fr: "Preuve de service"
  },
  readbackFailedClosed: {
    "zh-CN": "读回失败关闭",
    en: "Readback failed closed",
    ja: "リードバックはフェイルクローズしました",
    ko: "리드백이 닫힌 상태로 실패했습니다",
    fr: "La relecture a échoué en se fermant"
  }
} satisfies Record<string, CopyEntry>;

const readbackCounted = {
  pageLimits: {
    "zh-CN": "默认 {0} 条，最多 {1} 条",
    en: "Default {0}, max {1}",
    ja: "既定 {0} 件・最大 {1} 件",
    ko: "기본 {0}건, 최대 {1}건",
    fr: "Par défaut {0}, au plus {1}"
  },
  auditSummary: {
    "zh-CN": "目标 {0}；详情 {1}",
    en: "Target {0}; details {1}",
    ja: "対象 {0}／詳細 {1}",
    ko: "대상 {0}, 상세 {1}",
    fr: "Cible {0} ; détails {1}"
  },
  detailFields: {
    "zh-CN": "字段 {0}",
    en: "fields {0}",
    ja: "項目 {0}",
    ko: "필드 {0}",
    fr: "champs {0}"
  },
  responseBudgetBytes: {
    "zh-CN": "{0} 字节",
    en: "{0} bytes",
    ja: "{0} バイト",
    ko: "{0}바이트",
    fr: "{0} octets"
  }
} satisfies Record<string, CopyEntry>;

/**
 * Why the request failed closed, in the reader's language.
 *
 * These nineteen sentences were English in both locales — the one surface where
 * that hurts most, because a reader only reads them when something has already
 * gone wrong and the sentence is the whole explanation. They are keyed by the
 * service's own reason code, which is what the machine token beside them shows,
 * so the code stays readable to an operator while the sentence follows the
 * reader.
 */
const readbackReasonCopy = {
  audit_scope_required: {
    "zh-CN": "审计需要先选定一个故事目标。",
    en: "Audit requires a selected story target.",
    ja: "監査には対象ストーリーの選択が必要です。",
    ko: "감사에는 대상 스토리 선택이 필요합니다.",
    fr: "L'audit exige une story cible sélectionnée."
  },
  unsupported_filter: {
    "zh-CN": "该过滤条件不在读回白名单内。",
    en: "This filter is outside the readback allowlist.",
    ja: "この絞り込みはリードバックの許可名簿の外です。",
    ko: "이 필터는 리드백 허용 목록 밖입니다.",
    fr: "Ce filtre est hors de la liste d'autorisation de relecture."
  },
  client_authority_denied: {
    "zh-CN": "不接受由浏览器提供的授权字段。",
    en: "Browser-supplied authority fields are not accepted.",
    ja: "ブラウザが与えた権限フィールドは受け付けません。",
    ko: "브라우저가 제공한 권한 필드는 받지 않습니다.",
    fr: "Les champs d'autorité fournis par le navigateur ne sont pas acceptés."
  },
  invalid_ticket_list_cursor: {
    "zh-CN": "票据游标无效。",
    en: "The ticket cursor is invalid.",
    ja: "チケットのカーソルが無効です。",
    ko: "티켓 커서가 유효하지 않습니다.",
    fr: "Le curseur de ticket est invalide."
  },
  ticket_list_cursor_filter_mismatch: {
    "zh-CN": "游标与当前的筛选集不匹配。",
    en: "The cursor does not match the current filter set.",
    ja: "カーソルが現在の絞り込み集合と一致しません。",
    ko: "커서가 현재 필터 집합과 일치하지 않습니다.",
    fr: "Le curseur ne correspond pas à l'ensemble de filtres actuel."
  },
  ticket_list_limit_exceeded: {
    "zh-CN": "票据分页上限超出读回上限。",
    en: "The ticket page limit exceeds the readback cap.",
    ja: "チケットのページ上限がリードバックの上限を超えています。",
    ko: "티켓 페이지 한도가 리드백 상한을 넘습니다.",
    fr: "La limite de page des tickets dépasse le plafond de relecture."
  },
  invalid_ticket_list_limit: {
    "zh-CN": "票据分页上限无效。",
    en: "The ticket page limit is invalid.",
    ja: "チケットのページ上限が無効です。",
    ko: "티켓 페이지 한도가 유효하지 않습니다.",
    fr: "La limite de page des tickets est invalide."
  },
  invalid_audit_cursor: {
    "zh-CN": "审计游标无效。",
    en: "The audit cursor is invalid.",
    ja: "監査のカーソルが無効です。",
    ko: "감사 커서가 유효하지 않습니다.",
    fr: "Le curseur d'audit est invalide."
  },
  audit_limit_exceeded: {
    "zh-CN": "审计分页上限超出读回上限。",
    en: "The audit page limit exceeds the readback cap.",
    ja: "監査のページ上限がリードバックの上限を超えています。",
    ko: "감사 페이지 한도가 리드백 상한을 넘습니다.",
    fr: "La limite de page d'audit dépasse le plafond de relecture."
  },
  invalid_knowledge_search_limit: {
    "zh-CN": "知识分页上限无效。",
    en: "The knowledge page limit is invalid.",
    ja: "ナレッジのページ上限が無効です。",
    ko: "지식 페이지 한도가 유효하지 않습니다.",
    fr: "La limite de page de connaissance est invalide."
  },
  invalid_knowledge_include_draft: {
    "zh-CN": "草稿包含标记无效。",
    en: "The draft include flag is invalid.",
    ja: "下書きを含めるフラグが無効です。",
    ko: "초안 포함 플래그가 유효하지 않습니다.",
    fr: "L'indicateur d'inclusion des brouillons est invalide."
  },
  invalid_knowledge_include_stale: {
    "zh-CN": "陈旧包含标记无效。",
    en: "The stale include flag is invalid.",
    ja: "古い項目を含めるフラグが無効です。",
    ko: "낡은 항목 포함 플래그가 유효하지 않습니다.",
    fr: "L'indicateur d'inclusion des entrées périmées est invalide."
  },
  knowledge_entry_id_required: {
    "zh-CN": "知识详情需要先选定一个条目 id。",
    en: "Knowledge detail requires a selected entry id.",
    ja: "ナレッジ詳細には項目 id の選択が必要です。",
    ko: "지식 상세에는 선택된 항목 id 가 필요합니다.",
    fr: "Le détail de connaissance exige un id d'entrée sélectionné."
  },
  knowledge_readback_unavailable: {
    "zh-CN": "该服务上没有知识读回。",
    en: "Knowledge readback is unavailable on this service.",
    ja: "このサービスではナレッジのリードバックを利用できません。",
    ko: "이 서비스에서는 지식 리드백을 사용할 수 없습니다.",
    fr: "La relecture de la connaissance n'est pas disponible sur ce service."
  },
  knowledge_role_scope_mismatch: {
    "zh-CN": "该受信主体不被允许读取那个知识范围。",
    en: "The trusted actor is not allowed to read that knowledge scope.",
    ja: "その受信主体はそのナレッジ範囲を読む権限がありません。",
    ko: "해당 신뢰 주체는 그 지식 범위를 읽을 수 없습니다.",
    fr: "L'acteur de confiance n'est pas autorisé à lire ce périmètre de connaissance."
  },
  knowledge_entry_not_found: {
    "zh-CN": "找不到所选的知识条目。",
    en: "The selected knowledge entry was not found.",
    ja: "選択されたナレッジ項目は見つかりませんでした。",
    ko: "선택한 지식 항목을 찾지 못했습니다.",
    fr: "L'entrée de connaissance sélectionnée n'a pas été trouvée."
  },
  knowledge_body_requires_entry_read: {
    "zh-CN": "知识正文只在显式读取条目详情时返回。",
    en: "Knowledge body text is only returned by explicit entry detail fetch.",
    ja: "ナレッジ本文は明示的な項目詳細の取得でのみ返されます。",
    ko: "지식 본문은 명시적인 항목 상세 조회에서만 반환됩니다.",
    fr: "Le corps de la connaissance n'est renvoyé que par une lecture explicite du détail."
  },
  readback_response_budget_exceeded: {
    "zh-CN": "超出响应预算；未展示任何部分数据。",
    en: "The response budget was exceeded; no partial data was shown.",
    ja: "応答予算を超えました。部分データは一切表示していません。",
    ko: "응답 예산을 넘었습니다. 부분 데이터는 표시하지 않았습니다.",
    fr: "Le budget de réponse a été dépassé ; aucune donnée partielle n'a été montrée."
  },
  work_readback_failed: {
    "zh-CN": "读回请求失败关闭。",
    en: "The readback request failed closed.",
    ja: "リードバック要求はフェイルクローズしました。",
    ko: "리드백 요청이 닫힌 상태로 실패했습니다.",
    fr: "La requête de relecture a échoué en se fermant."
  }
} satisfies Record<string, CopyEntry>;

/**
 * A chrome string shared with the shell, read from `localeCopy`.
 *
 * `localeCopy` is a `Record<TcrnLocale, Record<string, string>>`, so the index
 * is `string | undefined` under `noUncheckedIndexedAccess` even though every
 * locale carries every key. Falling back through English mirrors what the shell
 * does with the same table rather than inventing a different answer here.
 */
function shellCopy(locale: TcrnLocale, key: string, fallback: string): string {
  return localeCopy[locale]?.[key] ?? localeCopy.en[key] ?? fallback;
}

interface TicketListReadback {
  ok: true;
  method: "aos.ticket.list";
  schemaVersion: "aos.ticket.list.v1";
  rowGrain: "story";
  rows: TicketListRow[];
  page: TicketPage;
}

interface TicketPage {
  limit: number;
  returnedCount: number;
  hasMore: boolean;
  nextCursor?: string | null;
  filterDigest?: string;
  sortVersion?: string;
}

interface TicketListRow {
  initiativeId?: string;
  initiativeTitle?: string;
  initiativeStatus?: string;
  epicId?: string;
  epicTitle?: string;
  epicStatus?: string;
  storyId: string;
  storyTitle: string;
  storyStatus?: string;
  safeUpdatedAt?: string;
  updatedAt?: string;
  subtaskSummaries?: Array<{ id: string; title: string; status?: string; ownerRole?: string }>;
  assignmentIds?: string[];
  assigneeEmployeeIds?: string[];
  runRefs?: Array<{ id: string; status?: string; startedAt?: string; endedAt?: string }>;
  latestGate?: { id?: string; type?: string; status?: string };
  latestEvidence?: { id?: string; type?: string; redactionState?: string; digest?: string; timestamp?: string };
  latestAudit?: { id?: string; action?: string; outcome?: string; timestamp?: string };
  auditCount?: number;
}

interface AuditReadback {
  ok: true;
  method: "aos.audit.query";
  items: AuditReadbackItem[];
  limit: number;
  returnedCount: number;
  hasMore: boolean;
  nextCursor?: string | null;
}

interface AuditReadbackItem {
  id: string;
  actorRef?: string;
  action: string;
  targetType: string;
  targetId: string;
  timestamp: string;
  outcome?: string;
  policyVersion?: string;
  details?: unknown;
}

interface PolicyReadback {
  ok: true;
  method: "aos.policy.read";
  readbackMethods: string[];
  readbackEndpoints?: string[];
  fullGatewayMethodListExposed: boolean;
  responseBudgetBytes?: number;
}

interface KnowledgeSearchReadback {
  ok: true;
  method: "aos.knowledge.search";
  items: KnowledgeSearchItem[];
  page: KnowledgeSearchPage;
  auditEventId?: string;
  bodyReturned?: boolean;
  rawRecordJsonReturned?: boolean;
  bodyReturnedOnlyByExplicitEntryRead?: boolean;
}

interface KnowledgeEntryReadback {
  ok: true;
  method: "aos.knowledge.entry.read";
  entry: KnowledgeEntryDetail;
  auditEventId?: string;
  rawRecordJsonReturned?: boolean;
  bodyReturnedOnlyByExplicitEntryRead?: boolean;
}

interface KnowledgeSearchPage {
  limit: number;
  returnedCount: number;
  hasMore: boolean;
  nextCursor?: string | null;
  filterDigest?: string;
  searchMode?: string;
  defaultCanonicalFilterApplied?: boolean;
  defaultFreshnessFilterApplied?: boolean;
}

interface KnowledgeSearchItem {
  id: string;
  title: string;
  roleScope?: string;
  project?: string;
  category?: string;
  knowledgeKind?: string;
  status?: string;
  stale?: boolean;
  lastVerified?: string;
  sourceDigest?: string;
  sourceRefDigest?: string;
  tags?: string[];
  summary?: string;
  snippet?: string;
  accessCount?: number;
  bodyIncluded?: boolean;
}

interface KnowledgeEntryDetail extends KnowledgeSearchItem {
  body?: string;
  bodyIncluded?: boolean;
}

interface ReadbackError {
  status: "error";
  statusCode?: number | undefined;
  /** The service's own reason code; the sentence is chosen at render time. */
  reason: string;
}

type RemoteState<T> =
  | { status: "idle" | "loading" }
  | { status: "success"; data: T }
  | ReadbackError;

export function Phase3DogfoodReadback({ locale, theme, routeHref }: Phase3DogfoodReadbackProps) {
  const [search, setSearch] = useState(() => readSearchParams());
  const [ticketsState, setTicketsState] = useState<RemoteState<TicketListReadback>>({ status: "loading" });
  const [auditState, setAuditState] = useState<RemoteState<AuditReadback>>({ status: "idle" });
  const [policyState, setPolicyState] = useState<RemoteState<PolicyReadback>>({ status: "loading" });
  const [knowledgeSearchState, setKnowledgeSearchState] = useState<RemoteState<KnowledgeSearchReadback>>({ status: "loading" });
  const [knowledgeEntryState, setKnowledgeEntryState] = useState<RemoteState<KnowledgeEntryReadback>>({ status: "idle" });

  useEffect(() => {
    const onPopState = () => setSearch(readSearchParams());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const ticketApiQuery = useMemo(() => ticketApiQueryFromSearch(search), [search]);
  const knowledgeQuery = search.get("knowledgeQuery") || "KR03 readback";
  const knowledgeApiQuery = useMemo(() => knowledgeApiQueryFromSearch(search, knowledgeQuery), [knowledgeQuery, search]);
  const selectedStoryFromUrl = search.get("storyId") ?? undefined;
  const selectedKnowledgeIdFromUrl = search.get("knowledgeEntryId") ?? undefined;

  useEffect(() => {
    let cancelled = false;
    setTicketsState({ status: "loading" });
    fetchReadback<TicketListReadback>(`${ticketEndpoint}${ticketApiQuery ? `?${ticketApiQuery}` : ""}`)
      .then((data) => {
        if (!cancelled) setTicketsState({ status: "success", data });
      })
      .catch((error: unknown) => {
        if (!cancelled) setTicketsState(toReadbackError(error));
      });
    return () => {
      cancelled = true;
    };
  }, [ticketApiQuery]);

  useEffect(() => {
    let cancelled = false;
    fetchReadback<PolicyReadback>(policyEndpoint)
      .then((data) => {
        if (!cancelled) setPolicyState({ status: "success", data });
      })
      .catch((error: unknown) => {
        if (!cancelled) setPolicyState(toReadbackError(error));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setKnowledgeSearchState({ status: "loading" });
    fetchReadback<KnowledgeSearchReadback>(`${knowledgeSearchEndpoint}?${knowledgeApiQuery}`)
      .then((data) => {
        if (!cancelled) setKnowledgeSearchState({ status: "success", data });
      })
      .catch((error: unknown) => {
        if (!cancelled) setKnowledgeSearchState(toReadbackError(error));
      });
    return () => {
      cancelled = true;
    };
  }, [knowledgeApiQuery]);

  const selectedStory = useMemo(() => {
    if (ticketsState.status !== "success") return undefined;
    return ticketsState.data.rows.find((row) => row.storyId === selectedStoryFromUrl) ?? ticketsState.data.rows[0];
  }, [selectedStoryFromUrl, ticketsState]);
  const selectedKnowledge = useMemo(() => {
    if (knowledgeSearchState.status !== "success") return undefined;
    return knowledgeSearchState.data.items.find((item) => item.id === selectedKnowledgeIdFromUrl) ?? knowledgeSearchState.data.items[0];
  }, [knowledgeSearchState, selectedKnowledgeIdFromUrl]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedStory) {
      setAuditState({ status: "idle" });
      return () => {
        cancelled = true;
      };
    }
    const auditQuery = new URLSearchParams();
    auditQuery.set("targetId", selectedStory.storyId);
    auditQuery.set("limit", String(auditDefaultLimit));
    setAuditState({ status: "loading" });
    fetchReadback<AuditReadback>(`${auditEndpoint}?${auditQuery.toString()}`)
      .then((data) => {
        if (!cancelled) setAuditState({ status: "success", data });
      })
      .catch((error: unknown) => {
        if (!cancelled) setAuditState(toReadbackError(error));
      });
    return () => {
      cancelled = true;
    };
  }, [selectedStory]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedKnowledge) {
      setKnowledgeEntryState({ status: "idle" });
      return () => {
        cancelled = true;
      };
    }
    const entryQuery = new URLSearchParams();
    entryQuery.set("id", selectedKnowledge.id);
    setKnowledgeEntryState({ status: "loading" });
    fetchReadback<KnowledgeEntryReadback>(`${knowledgeEntryEndpoint}?${entryQuery.toString()}`)
      .then((data) => {
        if (!cancelled) setKnowledgeEntryState({ status: "success", data });
      })
      .catch((error: unknown) => {
        if (!cancelled) setKnowledgeEntryState(toReadbackError(error));
      });
    return () => {
      cancelled = true;
    };
  }, [selectedKnowledge]);

  const ticketRows = ticketsState.status === "success"
    ? ticketsState.data.rows.map((row) => ticketRowForWorkList(row, selectedStory?.storyId, search, routeHref, locale))
    : [];
  const filters = filterItems(search, routeHref, locale);
  const selectedStoryTitle = selectedStory?.storyTitle ?? pick(locale, readbackCopy.waitingForStory);
  const ticketError = ticketsState.status === "error" ? ticketsState : undefined;
  const auditError = auditState.status === "error" ? auditState : undefined;
  const knowledgeSearchError = knowledgeSearchState.status === "error" ? knowledgeSearchState : undefined;
  const knowledgeEntryError = knowledgeEntryState.status === "error" ? knowledgeEntryState : undefined;
  const policyMethods = policyState.status === "success" ? policyState.data.readbackMethods : ["aos.ticket.list", "aos.audit.query"];
  const page = ticketsState.status === "success" ? ticketsState.data.page : undefined;
  const knowledgePage = knowledgeSearchState.status === "success" ? knowledgeSearchState.data.page : undefined;
  const knowledgeRows = knowledgeSearchState.status === "success" ? knowledgeSearchState.data.items : [];

  return (
    <div
      className="tcrn-aos-phase3-readback"
      data-phase3-readback-surface="work-readback"
      data-readback-api-surface="work.readback"
      data-readback-api-tickets={ticketEndpoint}
      data-readback-api-audit={auditEndpoint}
      data-readback-api-knowledge-search={knowledgeSearchEndpoint}
      data-readback-api-knowledge-entry={knowledgeEntryEndpoint}
      data-readback-api-policy={policyEndpoint}
      data-kr03-readonly-knowledge-view="true"
      data-kr03-edit-affordances="absent"
      data-kr03-propose-affordance="absent"
      data-kr03-canonical-promotion-affordance="absent"
      data-generic-mcp-facade="unused"
      data-generic-gateway-facade="unused"
      data-method-dispatch-facade="absent"
      data-product-shell-search-capability="absent"
      data-durable-runtime-db-activation="false"
      data-dogfood-runtime-readiness-claimed="false"
      data-owner-product-final-acceptance="not-claimed"
      data-release-publication-push="not-claimed"
      data-theme={theme}
    >
      <WorkPageHeader
        // Title and breadcrumb come from `localeCopy`, the same table the shell
        // reads for this route's nav label, so the tab and the heading cannot
        // drift apart in one locale.
        title={shellCopy(locale, "workReadbackLabel", "Work readback")}
        description={pick(locale, readbackCopy.pageDescription)}
        breadcrumbs={[
          { id: "work", label: shellCopy(locale, "workLabel", "Work queue"), href: routeHref("/work") },
          { id: "readback", label: pick(locale, readbackCopy.readback) }
        ]}
        meta={[
          <MachineTokenCell key="surface" token="work.readback" kind="generic" copyable={false} />,
          <StatusBadge key="status" state={{ state: "local_only" }} locale={locale} />,
          <Badge key="scope" tone="neutral">{pick(locale, readbackCopy.noLiveDispatch)}</Badge>
        ]}
      />

      <WorkViewTabs
        label={pick(locale, readbackCopy.workReadbackViews)}
        tabs={[
          {
            id: "tickets",
            label: pick(locale, readbackCopy.tickets),
            current: true,
            ...(typeof page?.returnedCount === "number" ? { count: page.returnedCount } : {})
          },
          { id: "audit", label: pick(locale, readbackCopy.storyAudit), current: false, disabled: !selectedStory },
          {
            id: "knowledge",
            label: pick(locale, readbackCopy.knowledge),
            current: false,
            ...(typeof knowledgePage?.returnedCount === "number" ? { count: knowledgePage.returnedCount } : {})
          },
          { id: "ds-gaps", label: pick(locale, readbackCopy.dsGaps), current: false, disabled: true }
        ]}
      />

      <Surface className="tcrn-aos-phase3-readback__filter-band" data-phase3-readback-filter-band="true">
        <WorkQuickFilters label={pick(locale, readbackCopy.storyStatusFilters)} filters={filters} />
        <div className="tcrn-aos-phase3-readback__policy">
          <Text>{pick(locale, readbackCopy.readbackMethodsOnly)}</Text>
          <div className="tcrn-aos-phase3-readback__tokens">
            {policyMethods.map((method) => <MachineTokenCell key={method} token={method} kind="generic" copyable={false} />)}
          </div>
        </div>
      </Surface>

      {ticketError ? <ReadbackErrorPanel error={ticketError} locale={locale} endpoint={ticketEndpoint} /> : null}

      <section className="tcrn-aos-phase3-readback__layout" aria-label={pick(locale, readbackCopy.ticketReadbackAndAudit)}>
        <Surface className="tcrn-aos-phase3-readback__list" data-ticket-list-ui-proof="story-grain">
          <div className="tcrn-aos-phase3-readback__section-heading">
            <Heading level={2}>{pick(locale, readbackCopy.storyGrainTickets)}</Heading>
            <Text>{pick(locale, readbackCopy.safeSummaryFields)}</Text>
          </div>
          {ticketsState.status === "loading" ? (
            <StatusLine locale={locale} text={pick(locale, readbackCopy.loadingTickets)} />
          ) : ticketRows.length > 0 ? (
            // `locale` reaches `WorkList` so the row's own readiness badge speaks
            // the reader's language; without it DS falls back to English for the
            // eleven state labels regardless of what the shell is set to.
            <WorkList rows={ticketRows} label={pick(locale, readbackCopy.storyTicketReadback)} locale={locale} />
          ) : (
            <EmptyState locale={locale} text={pick(locale, readbackCopy.noStoryRows)} />
          )}
          <PaginationControls page={page} search={search} routeHref={routeHref} locale={locale} />
        </Surface>

        <div className="tcrn-aos-phase3-readback__detail" data-ticket-scoped-audit-proof="targetId-required">
          <Surface className="tcrn-aos-phase3-readback__story-card">
            <div className="tcrn-aos-phase3-readback__section-heading">
              <Heading level={2}>{selectedStoryTitle}</Heading>
              <Text>{pick(locale, readbackCopy.storyLevelReadbackNote)}</Text>
            </div>
            {selectedStory
              ? <TicketSummary row={selectedStory} locale={locale} />
              : <EmptyState locale={locale} text={pick(locale, readbackCopy.selectStoryForAudit)} />}
          </Surface>

          {auditError ? <ReadbackErrorPanel error={auditError} locale={locale} endpoint={auditEndpoint} /> : null}
          <Surface className="tcrn-aos-phase3-readback__audit-card">
            <div className="tcrn-aos-phase3-readback__section-heading">
              <Heading level={2}>{pick(locale, readbackCopy.auditTimeline)}</Heading>
              <Text>{pick(locale, readbackCopy.redactedOnly)}</Text>
            </div>
            {auditState.status === "loading" ? (
              <StatusLine locale={locale} text={pick(locale, readbackCopy.loadingStoryAudit)} />
            ) : auditState.status === "success" ? (
              <WorkActivityFeed
                label={pick(locale, readbackCopy.storyAuditTimeline)}
                items={auditItemsForFeed(auditState.data.items, locale)}
                locale={locale}
              />
            ) : (
              <EmptyState locale={locale} text={pick(locale, readbackCopy.auditWaitsForStory)} />
            )}
          </Surface>
          <MetadataRail
            title={pick(locale, readbackCopy.readbackBoundary)}
            items={metadataItems({
              locale,
              ticketsState,
              auditState,
              policyState,
              selectedStory,
              page
            })}
          />
        </div>
      </section>

      <section
        className="tcrn-aos-phase3-readback__knowledge"
        aria-label={pick(locale, readbackCopy.knowledgeSearchAndDetail)}
        data-kr03-knowledge-search-ui="true"
        data-kr03-knowledge-detail-ui="true"
        data-kr03-write-ui="absent"
        data-kr03-gateway-list-ui="absent"
      >
        <Surface className="tcrn-aos-phase3-readback__knowledge-search">
          <div className="tcrn-aos-phase3-readback__section-heading">
            <Heading level={2}>{pick(locale, readbackCopy.knowledgeReadback)}</Heading>
            <Text>{pick(locale, readbackCopy.knowledgeSearchIntro)}</Text>
          </div>
          <form className="tcrn-aos-phase3-readback__knowledge-form" method="get" action={routeHref("/work/readback")} role="search" data-kr03-search-form="read-only">
            <label className="tcrn-aos-phase3-readback__knowledge-label" htmlFor="knowledgeQuery">
              {pick(locale, readbackCopy.searchKnowledge)}
            </label>
            <input
              id="knowledgeQuery"
              className="tcrn-aos-phase3-readback__knowledge-input"
              name="knowledgeQuery"
              type="search"
              defaultValue={knowledgeQuery}
              autoComplete="off"
            />
            <Button type="submit" size="sm">{pick(locale, readbackCopy.search)}</Button>
          </form>
          {knowledgeSearchError ? <ReadbackErrorPanel error={knowledgeSearchError} locale={locale} endpoint={knowledgeSearchEndpoint} /> : null}
          {knowledgeSearchState.status === "loading" ? (
            <StatusLine locale={locale} text={pick(locale, readbackCopy.searchingKnowledge)} />
          ) : knowledgeRows.length > 0 ? (
            <KnowledgeResultList
              items={knowledgeRows}
              selectedId={selectedKnowledge?.id}
              search={search}
              routeHref={routeHref}
              locale={locale}
            />
          ) : (
            <EmptyState locale={locale} text={pick(locale, readbackCopy.noKnowledgeMatch)} />
          )}
        </Surface>

        <Surface className="tcrn-aos-phase3-readback__knowledge-detail" data-kr03-entry-detail-body="explicit-read-only-fetch">
          <div className="tcrn-aos-phase3-readback__section-heading">
            <Heading level={2}>{pick(locale, readbackCopy.knowledgeDetail)}</Heading>
            <Text>{pick(locale, readbackCopy.knowledgeDetailIntro)}</Text>
          </div>
          {knowledgeEntryError ? <ReadbackErrorPanel error={knowledgeEntryError} locale={locale} endpoint={knowledgeEntryEndpoint} /> : null}
          {knowledgeEntryState.status === "loading" ? (
            <StatusLine locale={locale} text={pick(locale, readbackCopy.loadingKnowledgeDetail)} />
          ) : knowledgeEntryState.status === "success" ? (
            <KnowledgeEntryDetailView readback={knowledgeEntryState.data} locale={locale} />
          ) : (
            <EmptyState locale={locale} text={pick(locale, readbackCopy.selectKnowledgeResult)} />
          )}
        </Surface>
      </section>

      <EnvironmentBanner
        label={pick(locale, readbackCopy.readOnlyServiceProof)}
        state={{ state: "local_only" }}
        locale={locale}
      />
    </div>
  );
}

function readSearchParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

function ticketApiQueryFromSearch(search: URLSearchParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of search.entries()) {
    if (ticketQueryPassThroughKeys.has(key)) {
      query.append(key, value);
    }
  }
  if (!query.has("limit")) {
    query.set("limit", String(ticketDefaultLimit));
  }
  return query.toString();
}

function knowledgeApiQueryFromSearch(search: URLSearchParams, knowledgeQuery: string): string {
  const query = new URLSearchParams();
  query.set("query", knowledgeQuery);
  query.set("project", "TCRN-AOS");
  query.set("limit", String(knowledgeDefaultLimit));
  const cursor = search.get("knowledgeCursor");
  if (cursor) {
    query.set("cursor", cursor);
  }
  if (search.get("includeDraft") === "true") {
    query.set("includeDraft", "true");
  }
  if (search.get("includeStale") === "true") {
    query.set("includeStale", "true");
  }
  return query.toString();
}

async function fetchReadback<T>(path: string): Promise<T> {
  const response = await fetch(path, { headers: { accept: "application/json" } });
  const body = await response.json().catch(() => ({ ok: false, reason: "invalid_json_response" }));
  if (!response.ok || body?.ok === false) {
    throw {
      statusCode: response.status,
      reason: typeof body?.reason === "string" ? body.reason : "work_readback_failed"
    };
  }
  return body as T;
}

/**
 * The failure, carrying its reason code rather than a rendered sentence.
 *
 * `message` used to be resolved here, which meant the sentence was chosen at
 * fetch time — outside the component, with no locale in scope, so it could only
 * ever be English. The code travels instead and the panel renders it, so the
 * same failure reads in whatever locale the reader is on when it is displayed.
 */
function toReadbackError(error: unknown): ReadbackError {
  if (typeof error === "object" && error !== null && "reason" in error) {
    const reason = String((error as { reason: unknown }).reason);
    const statusCode = "statusCode" in error ? Number((error as { statusCode: unknown }).statusCode) : undefined;
    return { status: "error", ...(Number.isFinite(statusCode) ? { statusCode } : {}), reason };
  }
  const reason = error instanceof Error ? error.message : "work_readback_failed";
  return { status: "error", reason };
}

/**
 * The sentence for a service reason code, in the reader's language.
 *
 * An unrecognised code answers with the generic failure sentence rather than
 * echoing the code: the machine token beside it already shows the code verbatim,
 * so the prose slot is where the reader is owed a sentence they can read.
 */
function humanReason(reason: string, locale: TcrnLocale): string {
  const entry = readbackReasonCopy[reason as keyof typeof readbackReasonCopy];
  return pick(locale, entry ?? readbackReasonCopy.work_readback_failed);
}

function filterItems(search: URLSearchParams, routeHref: (path: string) => string, locale: TcrnLocale) {
  const status = search.get("status") ?? "";
  const filters = [
    { id: "all", label: pick(locale, readbackCopy.all), status: "", value: pick(locale, readbackCopy.stories) },
    { id: "accepted", label: pick(locale, readbackCopy.accepted), status: "accepted" },
    { id: "in-progress", label: pick(locale, readbackCopy.inProgress), status: "in_progress" },
    { id: "blocked", label: pick(locale, readbackCopy.blocked), status: "blocked" }
  ];
  return filters.map((filter) => ({
    id: filter.id,
    label: filter.label,
    ...(filter.value ? { value: filter.value } : {}),
    current: filter.status === status,
    href: readbackHref(routeHref, new URLSearchParams(search), filter.status ? { status: filter.status, cursor: null } : { status: null, cursor: null })
  }));
}

function ticketRowForWorkList(
  row: TicketListRow,
  selectedStoryId: string | undefined,
  search: URLSearchParams,
  routeHref: (path: string) => string,
  locale: TcrnLocale
): WorkItemRowProps {
  const owner = row.assigneeEmployeeIds?.length
    ? joinNames(row.assigneeEmployeeIds, locale)
    : pick(locale, readbackCopy.unassigned);
  return {
    id: row.storyId,
    title: row.storyTitle,
    state: stateForStatus(row.storyStatus),
    owner,
    href: readbackHref(routeHref, new URLSearchParams(search), { storyId: row.storyId }),
    selected: selectedStoryId === row.storyId,
    summary: row.epicTitle ?? row.initiativeTitle ?? pick(locale, readbackCopy.storyLevelReadback),
    fields: [
      { key: "initiative", label: pick(locale, readbackCopy.initiative), value: row.initiativeTitle ?? row.initiativeId ?? "n/a" },
      // "Epic" is the same word in all five locales here — it is the chain's own
      // kind name, not a translated noun — so it is written once instead of as a
      // five-way entry that would only ever pick the same string.
      { key: "epic", label: "Epic", value: row.epicTitle ?? row.epicId ?? "n/a" },
      { key: "audit", label: pick(locale, readbackCopy.audit), value: String(row.auditCount ?? 0) }
    ],
    relationships: [
      ...(row.latestGate?.id ? [{ relation: "reviews" as const, target: row.latestGate.id }] : []),
      ...(row.latestEvidence?.id ? [{ relation: "verifies" as const, target: row.latestEvidence.id }] : [])
    ]
  };
}

function stateForStatus(status: string | undefined) {
  switch (status) {
    case "accepted":
    case "done":
    case "complete":
      return { state: "accepted" as const };
    case "blocked":
      return { state: "blocked" as const };
    case "in_progress":
    case "in-review":
    case "in_review":
      return { state: "review_required" as const };
    default:
      return { state: "local_only" as const };
  }
}

function readbackHref(
  routeHref: (path: string) => string,
  params: URLSearchParams,
  updates: Record<string, string | null>
): string {
  for (const [key, value] of Object.entries(updates)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }
  const base = new URL(routeHref("/work/readback"), "http://tcrn.local");
  for (const [key, value] of params.entries()) {
    if (!["locale", "theme", "collapsed"].includes(key)) {
      base.searchParams.set(key, value);
    }
  }
  return `${base.pathname}?${base.searchParams.toString()}`;
}

function TicketSummary({ row, locale }: { row: TicketListRow; locale: TcrnLocale }) {
  return (
    <div className="tcrn-aos-phase3-readback__story-summary">
      <MetadataRail
        title={pick(locale, readbackCopy.storySummary)}
        items={[
          { key: "story", label: "storyId", value: <MachineTokenCell token={row.storyId} kind="work-item" copyable={false} /> },
          { key: "initiative", label: pick(locale, readbackCopy.initiative), value: row.initiativeTitle ?? row.initiativeId ?? "n/a" },
          { key: "epic", label: "Epic", value: row.epicTitle ?? row.epicId ?? "n/a" },
          { key: "status", label: pick(locale, readbackCopy.status), value: <StatusBadge state={stateForStatus(row.storyStatus)} locale={locale} /> },
          { key: "evidence", label: pick(locale, readbackCopy.latestEvidence), value: latestEvidenceText(row, locale) },
          { key: "gate", label: pick(locale, readbackCopy.latestGate), value: row.latestGate?.id ?? "n/a" }
        ]}
      />
      <div className="tcrn-aos-phase3-readback__subtasks" aria-label={pick(locale, readbackCopy.subtaskSummaries)}>
        {(row.subtaskSummaries ?? []).slice(0, 4).map((subtask) => (
          <span key={subtask.id} className="tcrn-aos-phase3-readback__subtask">
            <MachineTokenCell token={subtask.id} kind="work-item" copyable={false} />
            <span>{subtask.title}</span>
            <Badge tone="neutral">{subtask.ownerRole ?? pick(locale, readbackCopy.rolePending)}</Badge>
          </span>
        ))}
      </div>
    </div>
  );
}

function latestEvidenceText(row: TicketListRow, locale: TcrnLocale): string {
  if (!row.latestEvidence?.id) return pick(locale, readbackCopy.none);
  return `${row.latestEvidence.id} / ${row.latestEvidence.redactionState ?? "redacted"} / ${row.latestEvidence.digest ?? "digest"}`;
}

function auditItemsForFeed(items: AuditReadbackItem[], locale: TcrnLocale): WorkActivityFeedItem[] {
  return items.map((item) => ({
    id: item.id,
    actor: item.actorRef ?? "system",
    action: item.action,
    timestamp: item.timestamp,
    state: stateForStatus(item.outcome),
    // A two-clause sentence with two substituted values, so `format` rather than
    // assembly: the label order that reads naturally in English puts both nouns
    // before their values, and the other four locales do not all agree with that.
    summary: format(
      locale,
      readbackCounted.auditSummary,
      `${item.targetType}:${item.targetId}`,
      detailsSummary(item.details, locale)
    )
  }));
}

function detailsSummary(details: unknown, locale: TcrnLocale): string {
  if (!details || typeof details !== "object") {
    return pick(locale, readbackCopy.redacted);
  }
  const keys = Object.keys(details as Record<string, unknown>).filter((key) => !/(path|body|source|message|prompt|token|auth|secret)/i.test(key));
  return keys.length
    ? format(locale, readbackCounted.detailFields, joinNames(keys.slice(0, 4), locale))
    : pick(locale, readbackCopy.redacted);
}

function metadataItems({
  locale,
  ticketsState,
  auditState,
  policyState,
  selectedStory,
  page
}: {
  locale: TcrnLocale;
  ticketsState: RemoteState<TicketListReadback>;
  auditState: RemoteState<AuditReadback>;
  policyState: RemoteState<PolicyReadback>;
  selectedStory?: TicketListRow | undefined;
  page?: TicketPage | undefined;
}) {
  return [
    { key: "surface", label: pick(locale, readbackCopy.surface), value: "work.readback" },
    { key: "method", label: pick(locale, readbackCopy.ticketMethod), value: ticketsState.status === "success" ? ticketsState.data.method : "aos.ticket.list" },
    // "Schema" was a two-branch ternary with the same word on both sides. It is
    // the wire term the value beside it names, so it is written once.
    { key: "schema", label: "Schema", value: ticketsState.status === "success" ? ticketsState.data.schemaVersion : "aos.ticket.list.v1" },
    { key: "grain", label: pick(locale, readbackCopy.rowGrain), value: ticketsState.status === "success" ? ticketsState.data.rowGrain : "story" },
    { key: "story", label: pick(locale, readbackCopy.selectedStory), value: selectedStory?.storyId ?? "none" },
    { key: "audit", label: pick(locale, readbackCopy.auditMethod), value: auditState.status === "success" ? auditState.data.method : "aos.audit.query" },
    { key: "policy", label: pick(locale, readbackCopy.policy), value: policyState.status === "success" && !policyState.data.fullGatewayMethodListExposed ? "filtered" : "pending" },
    { key: "page", label: pick(locale, readbackCopy.pageLabel), value: `${page?.returnedCount ?? 0}/${page?.limit ?? ticketDefaultLimit}` },
    {
      key: "budget",
      label: pick(locale, readbackCopy.responseBudget),
      // The number came from the service's own declared budget when it answered,
      // and only falls back to the documented cap before the first response — a
      // hard-coded "16384 bytes" would keep claiming that after the service
      // changed it.
      value: format(
        locale,
        readbackCounted.responseBudgetBytes,
        policyState.status === "success" ? policyState.data.responseBudgetBytes ?? readbackResponseBudgetBytes : readbackResponseBudgetBytes
      )
    },
    { key: "runtime", label: pick(locale, readbackCopy.runtimeActivation), value: pick(locale, readbackCopy.notClaimed) }
  ];
}

function PaginationControls({
  page,
  search,
  routeHref,
  locale
}: {
  page?: TicketPage | undefined;
  search: URLSearchParams;
  routeHref: (path: string) => string;
  locale: TcrnLocale;
}) {
  const nextHref = page?.nextCursor
    ? readbackHref(routeHref, new URLSearchParams(search), { cursor: page.nextCursor })
    : undefined;
  return (
    <nav className="tcrn-aos-phase3-readback__pagination" aria-label={pick(locale, readbackCopy.ticketPagination)} data-cursor-pagination="ticket-list">
      {/* The zh branch had the two limits written into the sentence as literal
          digits while the en branch interpolated the constants, so changing a
          limit would have silently left one locale claiming the old numbers.
          One template, both numbers substituted. */}
      <span>{format(locale, readbackCounted.pageLimits, ticketDefaultLimit, ticketMaxLimit)}</span>
      <Button type="button" size="sm" disabled disabledReason={pick(locale, readbackCopy.previousNotInProof)}>
        {pick(locale, readbackCopy.previous)}
      </Button>
      {nextHref ? (
        <a className="tcrn-link-button tcrn-link-button--secondary" href={nextHref} data-ticket-next-cursor="true">
          {pick(locale, readbackCopy.next)}
        </a>
      ) : (
        <Button type="button" size="sm" disabled disabledReason={pick(locale, readbackCopy.noNextPage)}>
          {pick(locale, readbackCopy.next)}
        </Button>
      )}
    </nav>
  );
}

function KnowledgeResultList({
  items,
  selectedId,
  search,
  routeHref,
  locale
}: {
  items: KnowledgeSearchItem[];
  selectedId?: string | undefined;
  search: URLSearchParams;
  routeHref: (path: string) => string;
  locale: TcrnLocale;
}) {
  return (
    <div className="tcrn-aos-phase3-readback__knowledge-results" data-kr03-result-list="snippet-grade">
      {items.map((item) => (
        <article
          key={item.id}
          className="tcrn-aos-phase3-readback__knowledge-result"
          data-kr03-result-selected={selectedId === item.id ? "true" : "false"}
          data-kr03-result-body-included={item.bodyIncluded === true ? "true" : "false"}
        >
          <div className="tcrn-aos-phase3-readback__knowledge-result-head">
            <a href={readbackHref(routeHref, new URLSearchParams(search), { knowledgeEntryId: item.id })}>
              {item.title}
            </a>
            <Badge tone={item.status === "canonical" ? "positive" : "neutral"}>{item.status ?? "unknown"}</Badge>
          </div>
          <Text>{item.snippet ?? item.summary ?? pick(locale, readbackCopy.noSummary)}</Text>
          <div className="tcrn-aos-phase3-readback__tokens">
            <MachineTokenCell token={item.id} kind="generic" copyable={false} />
            <MachineTokenCell token={item.category ?? "knowledge"} kind="generic" copyable={false} />
            {(item.tags ?? []).slice(0, 3).map((tag) => <Badge key={tag} tone="neutral">{tag}</Badge>)}
          </div>
        </article>
      ))}
    </div>
  );
}

function KnowledgeEntryDetailView({ readback, locale }: { readback: KnowledgeEntryReadback; locale: TcrnLocale }) {
  const entry = readback.entry;
  return (
    <div className="tcrn-aos-phase3-readback__knowledge-entry" data-kr03-entry-read-method={readback.method}>
      <MetadataRail
        title={pick(locale, readbackCopy.knowledgeRecord)}
        items={[
          { key: "entry", label: "entryId", value: <MachineTokenCell token={entry.id} kind="generic" copyable={false} /> },
          { key: "method", label: pick(locale, readbackCopy.readMethod), value: readback.method },
          { key: "scope", label: "roleScope", value: entry.roleScope ?? "trusted actor" },
          { key: "status", label: pick(locale, readbackCopy.status), value: <Badge tone={entry.status === "canonical" ? "positive" : "neutral"}>{entry.status ?? "unknown"}</Badge> },
          {
            key: "fresh",
            label: pick(locale, readbackCopy.stale),
            value: pick(locale, entry.stale ? readbackCopy.yes : readbackCopy.no)
          },
          { key: "source", label: pick(locale, readbackCopy.sourceDigest), value: entry.sourceDigest ?? "digest" },
          { key: "audit", label: "auditEventId", value: readback.auditEventId ?? "n/a" }
        ]}
      />
      <div className="tcrn-aos-phase3-readback__knowledge-body" data-kr03-entry-body-visible={entry.bodyIncluded === true ? "true" : "false"}>
        <Heading level={3}>{entry.title}</Heading>
        <Text>{entry.body ?? entry.summary ?? pick(locale, readbackCopy.noBody)}</Text>
      </div>
      <div className="tcrn-aos-phase3-readback__tokens" data-kr03-no-edit-affordances="true">
        <Badge tone="neutral">{pick(locale, readbackCopy.readOnly)}</Badge>
        <Badge tone="neutral">{pick(locale, readbackCopy.serviceProof)}</Badge>
        <Badge tone="neutral">KR-03</Badge>
      </div>
    </div>
  );
}

function ReadbackErrorPanel({ error, locale, endpoint }: { error: ReadbackError; locale: TcrnLocale; endpoint: string }) {
  return (
    <Surface
      className="tcrn-aos-phase3-readback__error"
      data-readback-error-state={error.reason}
      data-readback-error-endpoint={endpoint}
      data-partial-row-data-shown="false"
    >
      <Heading level={2}>{pick(locale, readbackCopy.readbackFailedClosed)}</Heading>
      <Text>{humanReason(error.reason, locale)}</Text>
      <MachineTokenCell token={error.reason} kind="generic" copyable={false} />
    </Surface>
  );
}

function StatusLine({ text, locale }: { text: string; locale: TcrnLocale }) {
  return (
    <div className="tcrn-aos-phase3-readback__status-line" aria-live="polite">
      <StatusBadge state={{ state: "local_only" }} locale={locale} />
      <Text>{text}</Text>
    </div>
  );
}

function EmptyState({ text, locale }: { text: string; locale: TcrnLocale }) {
  return (
    <div className="tcrn-aos-phase3-readback__empty">
      <StatusBadge state={{ state: "not_claimed" }} locale={locale} />
      <Text>{text}</Text>
    </div>
  );
}
