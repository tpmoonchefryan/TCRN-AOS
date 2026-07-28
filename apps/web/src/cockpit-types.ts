/**
 * The shape the cockpit renders from.
 *
 * Deliberately flat and serialisable: it is produced by the projection pipeline
 * and consumed by the views, with no behaviour in between. Anything that needs
 * computing — freshness, reassembly, effective open issues — is computed in the
 * projection package and arrives here already decided, so a view never has to
 * re-derive a governance judgement while rendering.
 */
import type { TcrnLocale } from "@tcrn/ui-copy-state";

import { format, pick } from "./copy.js";

export interface CockpitPartition {
  id: string;
  label: string;
  labelZh: string;
  chainVersion: number;
  verifiedAt: string;
  /**
   * Record families this partition could not supply, named rather than omitted.
   *
   * Two of the four chains exceed the read surface's one-MiB export ceiling and
   * fall back to a paginated path that cannot reach positions or minutes. A view
   * over such a partition must say "not read here" — an empty deliberation and
   * an unread one look identical, and only one of them is true.
   */
  unavailable: readonly string[];
  /**
   * Which read path produced this partition; decides what `unavailable` holds.
   *
   * `paginated-with-deliberations` is the fallback on a Workflow v0.7.0 engine,
   * where positions and minutes have their own paginated reads and only the
   * event log is still out of reach. Naming the three states apart matters:
   * a chain read this way has real deliberation threads, and one read by the
   * older fallback has none that anyone could see.
   */
  readVia: "export" | "paginated" | "paginated-with-deliberations";
  /**
   * Chain sequence from which writes name who made them, or null if this chain
   * has never enabled actor attestation.
   */
  attestationFromSequence: number | null;
}

/**
 * One line of a work item's history.
 *
 * `attribution` carries why an actor is missing, because the two reasons are
 * different facts a reader acts on differently: a chain that never enabled
 * attestation will never name anyone, while an event that merely predates
 * enablement sits in a log whose later entries do.
 */
export interface CockpitActivityEntry {
  id: string;
  sequence: number;
  occurredAt: string;
  operation: string;
  actorId: string | null;
  attribution: "recorded" | "predates-attestation" | "not-enabled";
}

export interface CockpitWork {
  partitionId: string;
  id: string;
  /** Null when the key could not be recovered; views then show the id. */
  externalKey: string | null;
  kind: string;
  status: string;
  parentId: string | null;
  /** How many times the chain has revised this record. */
  revision: number;
  /** The chain has no title field; scope is where a work item states its intent. */
  scope: string | null;
  decidedBy: readonly string[];
  sprintWorkId: string | null;
}

export interface CockpitGate {
  partitionId: string;
  id: string;
  externalKey: string | null;
  title: string | null;
  status: string;
  outcomeClass: string;
  workId: string | null;
}

export interface CockpitConference {
  partitionId: string;
  id: string;
  externalKey: string | null;
  title: string | null;
  type: string | null;
  status: string;
  workIds: readonly string[];
}

/**
 * Why a row is in the inbox, as facts rather than as a sentence.
 *
 * Mirrors `InboxDetail` in the projection package. The projection used to hand
 * over `detail` already written — "collecting positions", "3 open of 4 recorded"
 * — which is English assembled where no locale is in scope, so every locale
 * showed the English. See the type's own comment there for why the fix is to move
 * the decision rather than translate the output.
 */
export type CockpitInboxDetail =
  | { reason: "gate-outcome"; outcomeClass: string }
  | { reason: "collecting-positions" }
  | { reason: "open-issues"; open: number; recorded: number };

export interface CockpitInboxItem {
  kind: "gate" | "conference" | "unresolved";
  partitionId: string;
  recordId: string;
  externalKey: string | null;
  title: string;
  detail: CockpitInboxDetail;
  severity: "owner-intent" | "attention";
}

export interface CockpitEffectiveUnresolved {
  minutesId: string;
  externalKey: string | null;
  surface: readonly string[];
  effective: readonly string[];
  dissolvedCount: number;
}

/**
 * One logical position, already reassembled from however many fragments the
 * byte budget forced it into.
 *
 * The budget constrains storage; a reader should see the argument, so the
 * cockpit renders the whole and keeps the fragment ids for anyone who needs to
 * reach the individual records.
 */
export interface CockpitPosition {
  conferenceId: string;
  actorId: string | null;
  fragmentIds: readonly string[];
  externalKeys: readonly string[];
  body: string;
  fragmentCount: number;
}

export interface CockpitMinutes {
  id: string;
  externalKey: string | null;
  summary: string | null;
  outcomeClass: string;
  decisions: readonly string[];
  /** Everything recorded as open when these minutes closed. */
  unresolvedIssues: readonly string[];
  /** What later minutes have not since settled. */
  effective: readonly string[];
}

export interface CockpitData {
  generatedAt: string;
  partitions: readonly CockpitPartition[];
  work: readonly CockpitWork[];
  gates: readonly CockpitGate[];
  conferences: readonly CockpitConference[];
  inbox: readonly CockpitInboxItem[];
  effectiveUnresolved: readonly CockpitEffectiveUnresolved[];
  /** Reassembled position threads, keyed by conference id. */
  threads: Readonly<Record<string, readonly CockpitPosition[]>>;
  minutesByConference: Readonly<Record<string, CockpitMinutes>>;
  /** Event history keyed by work record id; absent for chains read by fallback. */
  activityByWork: Readonly<Record<string, readonly CockpitActivityEntry[]>>;
}

/**
 * The chain's own status vocabulary, in every locale AOS offers.
 *
 * These are the nine values the four chains actually carry. They are the chain's
 * words, not the DS readiness vocabulary — that distinction is the reason
 * `chainStatusBadge` overrides the label at all, and it survives here. What did
 * not survive is shipping those words in English to five locales: the label was
 * `status` verbatim, so a zh-CN reader saw `done` and `blocked` beside fully
 * translated chrome.
 *
 * `TcrnLocale`-keyed rather than `isZh`-ternary for the reason recorded in
 * `copy.ts`: a ternary has nowhere to put the third locale, so it cannot be the
 * shape a five-locale rule is written in.
 */
const chainStatusLabels: Record<string, Record<TcrnLocale, string>> = {
  done: { "zh-CN": "已完成", en: "done", ja: "完了", ko: "완료", fr: "terminé" },
  closed: { "zh-CN": "已闭合", en: "closed", ja: "クローズ", ko: "종료", fr: "clos" },
  planned: { "zh-CN": "已排期", en: "planned", ja: "計画済み", ko: "계획됨", fr: "planifié" },
  satisfied: { "zh-CN": "已满足", en: "satisfied", ja: "充足", ko: "충족됨", fr: "satisfait" },
  active: { "zh-CN": "进行中", en: "active", ja: "進行中", ko: "진행 중", fr: "en cours" },
  blocked: { "zh-CN": "已阻塞", en: "blocked", ja: "ブロック中", ko: "차단됨", fr: "bloqué" },
  ready: { "zh-CN": "就绪", en: "ready", ja: "準備完了", ko: "준비됨", fr: "prêt" },
  pending: { "zh-CN": "待处理", en: "pending", ja: "保留中", ko: "대기 중", fr: "en attente" },
  cancelled: { "zh-CN": "已取消", en: "cancelled", ja: "取消", ko: "취소됨", fr: "annulé" }
};

/**
 * A chain status said in the reader's language, for the places that render the
 * bare value rather than a badge — detail-page metadata rows, table cells.
 *
 * An unmapped status falls back to the raw token, which is what every one of
 * these sites used to show unconditionally.
 */
export function chainStatusLabel(status: string, locale: TcrnLocale): string {
  return chainStatusLabels[status]?.[locale] ?? status;
}

/**
 * Chain work status → StatusBadge input, in the reader's locale.
 *
 * The label is still the chain's own word, now said in the reader's language.
 * The DS copy-state vocabulary was written for verification claims — "Ready for
 * local use", "Review required" — and mapping work statuses onto it made every
 * active row claim it needed review while its own Status field said otherwise:
 * two labels on one row, contradicting each other. `CopyStateInput.label` exists
 * exactly so a product can keep the DS tone scale while speaking its own
 * vocabulary; the state token here picks nothing but the tone.
 */
export function chainStatusBadge(status: string, locale: TcrnLocale = "en"): { state: string; label: string } {
  const tone = status === "done"
    ? "ready" // positive
    : status === "active"
      ? "review_required" // warning: the eye should land on what is in flight
      : status === "blocked"
        ? "blocked" // danger
        : "not_claimed"; // neutral: planned, ready, cancelled — the label tells them apart
  return { state: tone, label: chainStatusLabels[status]?.[locale] ?? status };
}

/**
 * What an inbox row owes the reader, in every locale AOS offers.
 *
 * A deliberate override of the DS readiness label rather than a workaround for
 * a missing one: "Review required" names a verification claim, and an
 * owner-intent gate names a different obligation — the engine will not clear it
 * without the named actor, whatever anyone reviewed. Keeping our own word means
 * carrying our own five locales for it, which is what the two bilingual
 * ternaries this replaces did not do.
 */
const inboxSeverityLabels: Record<CockpitInboxItem["severity"], Record<TcrnLocale, string>> = {
  "owner-intent": { "zh-CN": "等你裁定", en: "awaiting owner", ja: "承認待ち", ko: "결정 대기", fr: "en attente du propriétaire" },
  attention: { "zh-CN": "待处理", en: "attention", ja: "対応が必要", ko: "조치 필요", fr: "à traiter" }
};

export function inboxSeverityBadge(
  severity: CockpitInboxItem["severity"],
  locale: TcrnLocale
): { state: string; label: string } {
  return {
    state: severity === "owner-intent" ? "blocked" : "review_required",
    label: inboxSeverityLabels[severity][locale]
  };
}

/**
 * A gate's or minutes' outcome class, said in the reader's language.
 *
 * The chain carries three: a decision the engine will not make without the named
 * actor, a decision inside a role's mandate, and a recommendation that binds
 * nobody. Every site that showed one — the inbox row, the work-item gate badge,
 * the deliberation room's minutes badge — printed the raw token, so a reader
 * outside this platform's working vocabulary saw `owner_intent_required` and had
 * to guess which of the three it was.
 *
 * The token itself is not thrown away: `inboxDetailText` shows the sentence and
 * the machine token stays available wherever a reader needs to match it against
 * the chain. An unmapped class falls back to the raw value, which is what all
 * three sites used to show unconditionally.
 */
const outcomeClassLabels: Record<string, Record<TcrnLocale, string>> = {
  owner_intent_required: {
    "zh-CN": "需要 Owner 裁定",
    en: "owner intent required",
    ja: "オーナーの裁定が必要",
    ko: "오너 결정 필요",
    fr: "décision du propriétaire requise"
  },
  role_decision: {
    "zh-CN": "角色裁定",
    en: "role decision",
    ja: "ロールによる裁定",
    ko: "역할 결정",
    fr: "décision de rôle"
  },
  recommendation: {
    "zh-CN": "建议",
    en: "recommendation",
    ja: "推奨",
    ko: "권고",
    fr: "recommandation"
  }
};

export function outcomeClassLabel(outcomeClass: string, locale: TcrnLocale): string {
  return outcomeClassLabels[outcomeClass]?.[locale] ?? outcomeClass;
}

/**
 * What an inbox row's detail cell says, built here rather than in the projection.
 *
 * The projection hands over facts (`CockpitInboxDetail`) and this turns them into
 * a sentence in the reader's language. Two of the three cases are counted, so they
 * are `format` templates rather than concatenation: Chinese puts the number before
 * a measure word and Korean puts it after the noun, and no amount of string
 * joining in code produces both orders.
 */
const inboxDetailCopy = {
  collectingPositions: {
    "zh-CN": "正在收集立场",
    en: "collecting positions",
    ja: "立場を収集中",
    ko: "입장 수집 중",
    fr: "collecte des positions"
  },
  openIssues: {
    "zh-CN": "已记录 {1} 项，其中 {0} 项未决",
    en: "{0} open of {1} recorded",
    ja: "記録 {1} 件のうち未解決 {0} 件",
    ko: "기록 {1}건 중 미해결 {0}건",
    fr: "{0} en cours sur {1} enregistrés"
  }
} satisfies Record<string, Record<TcrnLocale, string>>;

export function inboxDetailText(detail: CockpitInboxDetail, locale: TcrnLocale): string {
  if (detail.reason === "gate-outcome") return outcomeClassLabel(detail.outcomeClass, locale);
  if (detail.reason === "collecting-positions") return pick(locale, inboxDetailCopy.collectingPositions);
  return format(locale, inboxDetailCopy.openIssues, detail.open, detail.recorded);
}

/**
 * What each governed chain is called, in every locale AOS offers.
 *
 * The projection carries `label` + `labelZh` per partition, and nine call sites
 * across seven files spent that pair the same way: `isZh ? labelZh : label`. It is
 * the same defect as the nav — a field that holds exactly two values cannot serve
 * five locales, and nothing turns red when it doesn't, because both values are
 * present and correct.
 *
 * Keyed by partition id rather than read from the projection because the display
 * name is AOS's copy, not the chain's data: the chain knows it is
 * `TCRN-Design-System`, and what a reader should be shown for that is a product
 * decision this repository owns. `data.ts` already hand-wrote the English and
 * Chinese here for exactly that reason; this is the same table with the three
 * missing languages and one home instead of two.
 *
 * `TMS` and `AOS` are identical in all five: an acronym is not untranslated copy.
 */
const partitionDisplayNames: Record<string, Record<TcrnLocale, string>> = {
  "cross-project": {
    "zh-CN": "平台治理",
    en: "Platform governance",
    ja: "プラットフォームガバナンス",
    ko: "플랫폼 거버넌스",
    fr: "Gouvernance de la plateforme"
  },
  "TCRN-Design-System": {
    "zh-CN": "设计系统",
    en: "Design System",
    ja: "デザインシステム",
    ko: "디자인 시스템",
    fr: "Système de design"
  },
  "TCRN-TMS": { "zh-CN": "TMS", en: "TMS", ja: "TMS", ko: "TMS", fr: "TMS" },
  "TCRN-AOS": { "zh-CN": "AOS", en: "AOS", ja: "AOS", ko: "AOS", fr: "AOS" }
};

/**
 * A partition's display name in the reader's language.
 *
 * An unregistered partition id falls back to the projection's own `label`, which
 * is the chain's directory name — honest about being unnamed rather than blank.
 * Callers pass the partition when they hold one; the id alone is enough when they
 * only have that.
 */
export function partitionDisplayName(
  partition: CockpitPartition | { id: string; label: string } | undefined,
  locale: TcrnLocale
): string {
  if (!partition) return "—";
  return partitionDisplayNames[partition.id]?.[locale] ?? partition.label;
}

/**
 * First line of a work item's scope, for use as a list label.
 *
 * A work item with no scope annotation genuinely has no title, so the caller is
 * given null and shows the key instead of inventing prose for it.
 */
export function workTitle(work: CockpitWork): string | null {
  if (!work.scope) return null;
  const firstLine = work.scope.split("\n")[0]?.trim() ?? "";
  if (!firstLine) return null;
  // Scope annotations often open with a full sentence; a list needs a label, so
  // the first clause is taken and the rest stays available in the detail view.
  const clause = firstLine.split(/[。;；]/u)[0]?.trim() ?? firstLine;
  return clause.length > 72 ? `${clause.slice(0, 72)}…` : clause;
}
