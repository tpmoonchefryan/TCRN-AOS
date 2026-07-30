import {
  Badge,
  EmptyState,
  Heading,
  InlineAlert,
  MachineTokenCell,
  Surface,
  Text,
  WorkList,
  WorkPageHeader,
  type WorkItemRowProps
} from "@tcrn/ui-react";
import type { ReactNode } from "react";
import type { TcrnLocale } from "@tcrn/ui-copy-state";

import { cockpitData } from "./cockpit-data.generated.js";
import {
  chainStatusBadge,
  chainStatusLabel,
  inboxDetailText,
  deliberationContentRead,
  inboxSeverityBadge,
  partitionDisplayName,
  workTitle,
  type CockpitInboxItem,
  type CockpitPartition,
  type CockpitWork
} from "./cockpit-types.js";
import { hrefAttr, inboxLink } from "./cockpit-links.js";
import { format, joinNames, pick, type CopyEntry } from "./copy.js";

interface ViewProps {
  locale: TcrnLocale;
  routeHref: (path: string) => string;
}

/**
 * Landing-view copy in all five locales.
 *
 * `/` is the app's most-read route, and every string on it was an `isZh` ternary —
 * so a ja, ko, or fr reader landed on an English page with a translated nav. These
 * are the band headings, the field labels, and the two inbox kind words; the
 * counted sentences below build on them with `count(...)` because a number in the
 * middle of a sentence sits in a different place in each language.
 */
const viewCopy = {
  myWork: { "zh-CN": "我的工作", en: "My work", ja: "自分の作業", ko: "내 작업", fr: "Mon travail" },
  awaitingYou: { "zh-CN": "等你决定", en: "Awaiting you", ja: "あなたの対応待ち", ko: "귀하의 결정 대기", fr: "En attente de vous" },
  awaitingEmpty: {
    "zh-CN": "没有等待决定的项。",
    en: "Nothing is waiting on a decision.",
    ja: "決定待ちの項目はありません。",
    ko: "결정을 기다리는 항목이 없습니다.",
    fr: "Rien n'attend de décision."
  },
  inProgress: { "zh-CN": "进行中", en: "In progress", ja: "進行中", ko: "진행 중", fr: "En cours" },
  inProgressEmpty: {
    "zh-CN": "没有进行中的工作项。",
    en: "No work items are in progress.",
    ja: "進行中の作業項目はありません。",
    ko: "진행 중인 작업 항목이 없습니다.",
    fr: "Aucun élément de travail en cours."
  },
  blocked: { "zh-CN": "阻塞", en: "Blocked", ja: "ブロック中", ko: "차단됨", fr: "Bloqué" },
  completedEmpty: {
    "zh-CN": "尚无已完成项。",
    en: "Nothing completed yet.",
    ja: "完了した項目はまだありません。",
    ko: "아직 완료된 항목이 없습니다.",
    fr: "Rien n'est encore terminé."
  },
  seeAll: {
    "zh-CN": "在工作项页查看全部 →",
    en: "See all in Work items →",
    ja: "作業項目ページですべて表示 →",
    ko: "작업 항목 페이지에서 전체 보기 →",
    fr: "Tout voir dans Éléments de travail →"
  },
  approvalGate: { "zh-CN": "审批门", en: "Approval gate", ja: "承認ゲート", ko: "승인 게이트", fr: "Porte d'approbation" },
  deliberation: { "zh-CN": "审议", en: "Deliberation", ja: "審議", ko: "심의", fr: "Délibération" },
  openIssues: { "zh-CN": "未决项", en: "Open issues", ja: "未解決事項", ko: "미해결 사항", fr: "Points ouverts" },
  kind: { "zh-CN": "类型", en: "Kind", ja: "種別", ko: "종류", fr: "Type" },
  detail: { "zh-CN": "说明", en: "Detail", ja: "詳細", ko: "설명", fr: "Détail" },
  asOf: { "zh-CN": "数据截至", en: "As of", ja: "データ基準", ko: "데이터 기준", fr: "Données au" },
  status: { "zh-CN": "状态", en: "Status", ja: "ステータス", ko: "상태", fr: "Statut" },
  releaseTrain: { "zh-CN": "发布列车", en: "Release train", ja: "リリーストレイン", ko: "릴리스 트레인", fr: "Train de publication" },
  enrolled: { "zh-CN": "已入列", en: "enrolled", ja: "登録済み", ko: "등록됨", fr: "inscrit" },
  projects: { "zh-CN": "项目", en: "Projects", ja: "プロジェクト", ko: "프로젝트", fr: "Projets" },
  projectsDescription: {
    "zh-CN": "每个受治分区是一个项目,各自持有独立的链与版本。",
    en: "Each governed partition is a project holding its own chain and version.",
    ja: "各ガバナンス区画が 1 つのプロジェクトであり、それぞれ独自のチェーンとバージョンを持ちます。",
    ko: "각 거버넌스 파티션이 하나의 프로젝트이며 각자 고유한 체인과 버전을 보유합니다.",
    fr: "Chaque partition gouvernée est un projet portant sa propre chaîne et sa propre version."
  },
  workRecords: { "zh-CN": "工作记录", en: "Work records", ja: "作業レコード", ko: "작업 레코드", fr: "Enregistrements de travail" },
  initiatives: { "zh-CN": "Initiative", en: "Initiatives", ja: "イニシアチブ", ko: "이니셔티브", fr: "Initiatives" },
  pendingGates: { "zh-CN": "待批门", en: "Pending gates", ja: "承認待ちゲート", ko: "대기 중인 게이트", fr: "Portes en attente" },
  openDeliberations: {
    "zh-CN": "进行中审议",
    en: "Open deliberations",
    ja: "進行中の審議",
    ko: "진행 중인 심의",
    fr: "Délibérations en cours"
  },
  viewWorkItems: {
    "zh-CN": "查看工作项 →",
    en: "View work items →",
    ja: "作業項目を表示 →",
    ko: "작업 항목 보기 →",
    fr: "Voir les éléments de travail →"
  }
} satisfies Record<string, CopyEntry>;

/**
 * Sentences with a count in them — see `format` in `copy.ts` for why these are
 * per-locale templates rather than concatenation.
 */
const countedCopy = {
  myWorkDescription: {
    "zh-CN": "跨 {0} 个项目 · {1} 条工作记录 · 各项目新鲜度见每行徽记",
    en: "Across {0} projects, {1} work records; per-row badges carry each project's freshness.",
    ja: "{0} プロジェクト・{1} 件の作業レコード。各行の徽章が対象プロジェクトの鮮度を示します。",
    ko: "{0}개 프로젝트 · 작업 레코드 {1}건. 각 행의 배지가 해당 프로젝트의 최신성을 나타냅니다.",
    fr: "Sur {0} projets, {1} enregistrements de travail ; les badges de chaque ligne portent la fraîcheur du projet."
  },
  awaitingCount: {
    "zh-CN": "{0} 项等你决定",
    en: "{0} awaiting you",
    ja: "{0} 件が対応待ち",
    ko: "{0}건이 대기 중",
    fr: "{0} en attente de vous"
  },
  completedCount: {
    "zh-CN": "已完成（{0}）",
    en: "Completed ({0})",
    ja: "完了（{0}）",
    ko: "완료({0})",
    fr: "Terminés ({0})"
  },
  showingOf: {
    "zh-CN": "显示最近 {0} 条,共 {1} 条 · ",
    en: "Showing {0} of {1}. ",
    ja: "{1} 件のうち {0} 件を表示。",
    ko: "{1}건 중 {0}건 표시. ",
    fr: "{0} sur {1} affichés. "
  },
  verifiedAt: {
    "zh-CN": "验证于 {0}",
    en: "verified {0}",
    ja: "{0} に検証",
    ko: "{0}에 검증",
    fr: "vérifié le {0}"
  },
  /**
   * Names the fact, not a cause it cannot observe.
   *
   * It used to end "those chains exceed the read surface ceiling". Chain size was
   * never the operative cause — it was the absence of a paged read for positions,
   * and when Workflow v0.7.0 supplied one nothing about the chains' size changed
   * and the gap closed. Stating a cause the view cannot see is also what let this
   * sentence go unchallenged for four days after it became false: nobody reopens a
   * question whose stated answer is a law of nature (TCRN-AOS-STORY-134).
   */
  unreadPartitions: {
    "zh-CN": "以下项目的立场与纪要未读取（投影的读取尝试被拒）：{0}。此处显示为未取，而非为空。",
    en: "Positions and minutes were not read for {0} — the projection's read of them was refused. Shown as not read, not as empty.",
    ja: "次のプロジェクトの立場と議事録は読み取られていません（投影による読み取りが拒否されました）：{0}。空ではなく未取得として表示しています。",
    ko: "다음 프로젝트의 입장과 회의록은 읽지 못했습니다(투영의 읽기 시도가 거부되었습니다). {0}. 비어 있음이 아니라 미조회로 표시합니다.",
    fr: "Les positions et les comptes rendus n'ont pas été lus pour {0} — la lecture par la projection a été refusée. Affiché comme non lu, non comme vide."
  }
} satisfies Record<string, CopyEntry>;

function findPartition(id: string): CockpitPartition | undefined {
  return cockpitData.partitions.find((entry) => entry.id === id);
}

/**
 * Freshness for one partition, shown wherever that partition's data appears.
 *
 * Repeated per row rather than stated once for the page because the cockpit
 * aggregates four independent chains: one banner would have to pick a version,
 * and any single number it picked would be wrong for three of them.
 */
function AsOfChip({ partitionId, locale }: { partitionId: string; locale: TcrnLocale }) {
  const partition = findPartition(partitionId);
  if (!partition) return null;
  return (
    <span className="tcrn-aos-row-asof" data-partition-id={partitionId}>
      <MachineTokenCell token={`v${partition.chainVersion}`} kind="generic" copyable={false} />
      <Text>{partitionDisplayName(partition, locale)}</Text>
    </span>
  );
}


/**
 * Partitions whose deliberation content this page could not read, stated plainly.
 *
 * Saying so is the whole point: an unread section and an empty one render
 * identically unless the view refuses to conflate them.
 *
 * The filter asks for the families this sentence NAMES. It used to ask whether
 * the partition was missing anything at all, and that is a different question:
 * once positions and minutes became readable and only the event log stayed out
 * of reach, this alert went on telling the Owner that positions and minutes were
 * not read on chains that held 138, 85 and 42 of them (TCRN-AOS-STORY-134). The
 * event-log gap is stated where it is true — the work item's activity panel —
 * rather than under a sentence about something else.
 */
function UnavailableNotice({ locale }: { locale: TcrnLocale }) {
  const affected = cockpitData.partitions.filter((entry) => !deliberationContentRead(entry));
  if (affected.length === 0) return null;
  const names = joinNames(affected.map((entry) => partitionDisplayName(entry, locale)), locale);
  return (
    <InlineAlert tone="warning" data-cockpit-notice="partial-projection">
      {format(locale, countedCopy.unreadPartitions, names)}
    </InlineAlert>
  );
}

/**
 * My work — the landing view.
 *
 * Three bands in the order a person asks about them: what is waiting on me, what
 * is moving, what closed. Everything is cross-project, and every row names the
 * chain it came from.
 */
export function MyWorkView({ locale, routeHref }: ViewProps) {
  const active = cockpitData.work.filter((row) => row.status === "active");
  const blocked = cockpitData.work.filter((row) => row.status === "blocked");
  const done = cockpitData.work.filter((row) => row.status === "done");

  return (
    <div className="tcrn-aos-view" data-cockpit-view="my-work">
      <WorkPageHeader
        title={pick(locale, viewCopy.myWork)}
        description={format(
          locale,
          countedCopy.myWorkDescription,
          cockpitData.partitions.length,
          cockpitData.work.length
        )}
        meta={[
          <Badge key="inbox" tone={cockpitData.inbox.some((item) => item.severity === "owner-intent") ? "warning" : "neutral"}>
            {format(locale, countedCopy.awaitingCount, cockpitData.inbox.length)}
          </Badge>
        ]}
      />
      <UnavailableNotice locale={locale} />

      <Band
        title={pick(locale, viewCopy.awaitingYou)}
        empty={pick(locale, viewCopy.awaitingEmpty)}
        locale={locale}
        rows={cockpitData.inbox.map((item) => inboxRow(item, locale, routeHref))}
      />
      <Band
        title={pick(locale, viewCopy.inProgress)}
        empty={pick(locale, viewCopy.inProgressEmpty)}
        locale={locale}
        rows={active.map((row) => workRow(row, locale, routeHref))}
      />
      {blocked.length > 0 ? (
        <Band
          title={pick(locale, viewCopy.blocked)}
          empty=""
          locale={locale}
          rows={blocked.map((row) => workRow(row, locale, routeHref))}
        />
      ) : null}
      <Band
        title={format(locale, countedCopy.completedCount, done.length)}
        empty={pick(locale, viewCopy.completedEmpty)}
        locale={locale}
        rows={done.slice(0, 12).map((row) => workRow(row, locale, routeHref))}
        footer={done.length > 12 ? (
          <Text>
            {format(locale, countedCopy.showingOf, 12, done.length)}
            <a href={routeHref("/work-items?status=done")}>{pick(locale, viewCopy.seeAll)}</a>
          </Text>
        ) : undefined}
      />
    </div>
  );
}

function Band({
  title,
  empty,
  rows,
  locale,
  footer
}: { title: string; empty: string; rows: WorkItemRowProps[]; locale: TcrnLocale; footer?: ReactNode }) {
  return (
    <Surface className="tcrn-aos-band">
      <Heading level={2} visualLevel={3}>{title}</Heading>
      {rows.length > 0
        // `locale` was declared here and never read — a dead prop, so every row
        // inside rendered its badge in the DS fallback locale no matter what the
        // page was set to.
        ? <WorkList rows={rows} label={title} locale={locale} />
        : empty ? <EmptyState title={empty} /> : null}
      {footer ?? null}
    </Surface>
  );
}

function inboxRow(item: CockpitInboxItem, locale: TcrnLocale, routeHref: (path: string) => string): WorkItemRowProps {
  const kindLabel = pick(
    locale,
    item.kind === "gate"
      ? viewCopy.approvalGate
      : item.kind === "conference"
        ? viewCopy.deliberation
        : viewCopy.openIssues
  );
  return {
    id: item.externalKey ?? item.recordId,
    title: item.title,
    state: inboxSeverityBadge(item.severity, locale) as never,
    owner: item.severity === "owner-intent" ? "owner:governance" : kindLabel,
    // Resolved by record kind, not assumed to be a work item. This was
    // `/work-items/${recordId}` for every inbox row, which is right for work records
    // and wrong for the twenty-two minutes references on this page and on `/`: it sent
    // them to a detail route that cannot display a minutes record.
    ...hrefAttr(inboxLink(item, routeHref)),
    fields: [
      { key: "kind", label: pick(locale, viewCopy.kind), value: kindLabel },
      { key: "detail", label: pick(locale, viewCopy.detail), value: inboxDetailText(item.detail, locale) },
      {
        key: "asof",
        label: pick(locale, viewCopy.asOf),
        value: <AsOfChip partitionId={item.partitionId} locale={locale} />
      }
    ]
  };
}

function workRow(row: CockpitWork, locale: TcrnLocale, routeHref: (path: string) => string): WorkItemRowProps {
  const title = workTitle(row);
  return {
    id: row.externalKey ?? row.id,
    // A record with no scope annotation has no title; showing its key is honest,
    // inventing prose for it would not be.
    title: title ?? (row.externalKey ?? row.id),
    state: chainStatusBadge(row.status, locale) as never,
    owner: row.kind,
    href: routeHref(`/work-items/${row.externalKey ?? row.id}`),
    fields: [
      { key: "status", label: pick(locale, viewCopy.status), value: chainStatusLabel(row.status, locale) },
      ...(row.sprintWorkId
        ? [{
            key: "train",
            label: pick(locale, viewCopy.releaseTrain),
            value: pick(locale, viewCopy.enrolled)
          }]
        : []),
      {
        key: "asof",
        label: pick(locale, viewCopy.asOf),
        value: <AsOfChip partitionId={row.partitionId} locale={locale} />
      }
    ]
  };
}

/** Projects — one card per governed chain, each with its own version. */
export function ProjectsView({ locale, routeHref }: ViewProps) {
  return (
    <div className="tcrn-aos-view" data-cockpit-view="projects">
      <WorkPageHeader
        title={pick(locale, viewCopy.projects)}
        description={pick(locale, viewCopy.projectsDescription)}
      />
      <div className="tcrn-aos-project-grid">
        {cockpitData.partitions.map((partition) => {
          const work = cockpitData.work.filter((row) => row.partitionId === partition.id);
          const pendingGates = cockpitData.gates.filter(
            (gate) => gate.partitionId === partition.id && gate.status === "pending");
          const openConferences = cockpitData.conferences.filter(
            (conference) => conference.partitionId === partition.id && conference.status === "open");
          return (
            <Surface key={partition.id} className="tcrn-aos-project-card" data-partition-id={partition.id}>
              <Heading level={2} visualLevel={3}>{partitionDisplayName(partition, locale)}</Heading>
              <div className="tcrn-aos-project-card__meta">
                <MachineTokenCell token={`v${partition.chainVersion}`} kind="generic" copyable={false} />
                <Text>{format(locale, countedCopy.verifiedAt, partition.verifiedAt)}</Text>
              </div>
              <dl className="tcrn-aos-stats">
                <Stat label={pick(locale, viewCopy.workRecords)} value={work.length} />
                <Stat
                  label={pick(locale, viewCopy.initiatives)}
                  value={work.filter((row) => row.kind === "Initiative").length}
                />
                <Stat label={pick(locale, viewCopy.pendingGates)} value={pendingGates.length} />
                <Stat label={pick(locale, viewCopy.openDeliberations)} value={openConferences.length} />
              </dl>
              <a className="tcrn-aos-project-card__link" href={routeHref(`/work-items?project=${partition.id}`)}>
                {pick(locale, viewCopy.viewWorkItems)}
              </a>
            </Surface>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="tcrn-aos-stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
