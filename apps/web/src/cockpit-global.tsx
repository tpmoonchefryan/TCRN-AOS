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
import type { TcrnLocale } from "@tcrn/ui-copy-state";

import { cockpitData } from "./cockpit-data.generated.js";
import { hrefAttr, inboxLink } from "./cockpit-links.js";
import {
  chainStatusLabel,
  inboxDetailText,
  inboxSeverityBadge,
  partitionDisplayName,
  type CockpitInboxItem,
  type CockpitPartition
} from "./cockpit-types.js";
import { format, joinNames, pick, type CopyEntry } from "./copy.js";

interface ViewProps {
  locale: TcrnLocale;
  routeHref: (path: string) => string;
}

/**
 * Inbox and dashboard copy in all five locales.
 *
 * Both screens are read cross-project and both were entirely bilingual, including
 * the two paragraphs that exist to prevent a wrong conclusion — the partial-coverage
 * warning and the "no burndown, by design" note. Those are the strings where an
 * English fallback costs the most: a reader who cannot read them does not get a
 * degraded explanation, they get a screen that looks complete and is not.
 */
const globalCopy = {
  inbox: { "zh-CN": "收件箱", en: "Inbox", ja: "受信トレイ", ko: "받은 항목", fr: "Boîte de réception" },
  gateNote: {
    "zh-CN": "门是引擎的硬停:owner_intent_required 的门在具名裁定到达前不会放行。",
    en: "A gate is the engine's hard stop: an owner_intent_required gate does not clear until the named actor rules.",
    ja: "ゲートはエンジンの強制停止です。owner_intent_required のゲートは、指名された actor の裁定が届くまで解放されません。",
    ko: "게이트는 엔진의 강제 정지입니다. owner_intent_required 게이트는 지명된 actor의 결정이 도착하기 전까지 해제되지 않습니다.",
    fr: "Une porte est l'arrêt dur du moteur : une porte owner_intent_required ne s'ouvre pas avant la décision de l'actor désigné."
  },
  gatesEmpty: {
    "zh-CN": "没有待批的门。",
    en: "No gate is pending.",
    ja: "承認待ちのゲートはありません。",
    ko: "대기 중인 게이트가 없습니다.",
    fr: "Aucune porte n'est en attente."
  },
  conferenceNote: {
    "zh-CN": "仍在收集立场;闭会才产出纪要与决策。",
    en: "Still collecting positions; minutes and decisions come at close.",
    ja: "まだ立場を収集中です。議事録と決定は閉会時に生成されます。",
    ko: "아직 입장을 수집하는 중입니다. 회의록과 결정은 폐회 시 생성됩니다.",
    fr: "Collecte des positions en cours ; les comptes rendus et les décisions arrivent à la clôture."
  },
  conferencesEmpty: {
    "zh-CN": "没有进行中的审议。",
    en: "No deliberation is open.",
    ja: "進行中の審議はありません。",
    ko: "진행 중인 심의가 없습니다.",
    fr: "Aucune délibération n'est en cours."
  },
  unresolvedNote: {
    "zh-CN": "纪要里的未决项不可改;只有后续纪要能消解它。此处已扣除被消解的部分,是净值。",
    en: "Open issues in minutes are immutable; only later minutes settle them. What is counted here is the net figure, with settled ones already removed.",
    ja: "議事録の未解決事項は変更できません。後続の議事録のみがそれを解消します。ここでの計数は解消済みを差し引いた純値です。",
    ko: "회의록의 미해결 사항은 변경할 수 없습니다. 이후 회의록만이 이를 해소합니다. 여기의 수치는 해소된 항목을 제외한 순값입니다.",
    fr: "Les points ouverts d'un compte rendu sont immuables ; seuls des comptes rendus ultérieurs les règlent. Le chiffre indiqué est net, les points réglés étant déjà retirés."
  },
  unresolvedEmpty: {
    "zh-CN": "没有未消解的未决项。",
    en: "No open issue is still live.",
    ja: "未解消の未解決事項はありません。",
    ko: "해소되지 않은 미해결 사항이 없습니다.",
    fr: "Aucun point ouvert n'est encore actif."
  },
  detail: { "zh-CN": "说明", en: "Detail", ja: "詳細", ko: "설명", fr: "Détail" },
  project: { "zh-CN": "项目", en: "Project", ja: "プロジェクト", ko: "프로젝트", fr: "Projet" },
  dashboard: { "zh-CN": "仪表盘", en: "Dashboard", ja: "ダッシュボード", ko: "대시보드", fr: "Tableau de bord" },
  byStatus: { "zh-CN": "按状态", en: "By status", ja: "ステータス別", ko: "상태별", fr: "Par statut" },
  perChain: { "zh-CN": "逐链", en: "Per chain", ja: "チェーン別", ko: "체인별", fr: "Par chaîne" },
  readInFull: { "zh-CN": "全量读取", en: "read in full", ja: "全量読み取り", ko: "전체 읽기", fr: "lu intégralement" },
  paginatedWithDeliberations: {
    "zh-CN": "分页读取 · 含审议",
    en: "paginated, with deliberations",
    ja: "分割読み取り・審議あり",
    ko: "페이지 읽기 · 심의 포함",
    fr: "paginé, avec délibérations"
  },
  paginatedFallback: {
    "zh-CN": "降级分页读取",
    en: "paginated fallback",
    ja: "縮退分割読み取り",
    ko: "축소 페이지 읽기",
    fr: "repli paginé"
  },
  attributionNotRead: {
    "zh-CN": "执行者归属未读取",
    en: "attribution not read",
    ja: "実行者の帰属は未読み取り",
    ko: "실행자 귀속 미조회",
    fr: "attribution non lue"
  },
  noActorRecorded: {
    "zh-CN": "未记执行者",
    en: "no actor recorded",
    ja: "実行者の記録なし",
    ko: "실행자 기록 없음",
    fr: "aucun actor enregistré"
  },
  work: { "zh-CN": "工作记录", en: "Work", ja: "作業", ko: "작업", fr: "Travail" },
  active: { "zh-CN": "进行中", en: "Active", ja: "進行中", ko: "진행 중", fr: "En cours" },
  pendingGates: { "zh-CN": "待批门", en: "Pending gates", ja: "承認待ちゲート", ko: "대기 중인 게이트", fr: "Portes en attente" },
  openDeliberations: {
    "zh-CN": "进行中审议",
    en: "Open deliberations",
    ja: "進行中の審議",
    ko: "진행 중인 심의",
    fr: "Délibérations en cours"
  },
  openBoard: { "zh-CN": "查看看板 →", en: "Open board →", ja: "ボードを開く →", ko: "보드 열기 →", fr: "Ouvrir le tableau →" },
  noBurndownTitle: {
    "zh-CN": "这里没有燃尽图,是设计决定",
    en: "There is no burndown here, by design",
    ja: "ここにバーンダウンチャートはありません（設計上の判断）",
    ko: "여기에 번다운 차트는 없습니다(설계상의 결정)",
    fr: "Il n'y a pas de burndown ici, par choix de conception"
  },
  noBurndownBody: {
    "zh-CN": "发布列车不带时间盒:它是一次发布的成员清单,不是一个两周窗口。没有 sprint 结束日,燃尽、速度与周期时间就没有可测的终点,画出来的任何曲线都在度量一个不存在的期限。列车的进度以「成员是否全部就绪」呈现,见发布列车页。",
    en: "A release train carries no time-box: it is the membership list of one release, not a two-week window. With no sprint end there is no endpoint for burndown, velocity, or cycle time, and any curve drawn here would be measuring a deadline that does not exist. Train progress is shown as whether its members are all ready — see the release trains page.",
    ja: "リリーストレインはタイムボックスを持ちません。1 回のリリースの成員リストであり、2 週間の窓ではありません。スプリント終了日がなければバーンダウン・ベロシティ・サイクルタイムに測れる終点はなく、ここに描く曲線は存在しない期限を測ることになります。トレインの進捗は「成員が全員準備完了か」として示されます（リリーストレインのページを参照）。",
    ko: "릴리스 트레인에는 타임박스가 없습니다. 한 번의 릴리스에 대한 구성원 목록이며 2주 창이 아닙니다. 스프린트 종료일이 없으면 번다운, 속도, 사이클 타임에 측정 가능한 종점이 없고, 여기에 그린 어떤 곡선도 존재하지 않는 기한을 측정하게 됩니다. 트레인 진행은 '구성원이 모두 준비되었는지'로 표시됩니다. 릴리스 트레인 페이지를 참조하세요.",
    fr: "Un train de publication ne porte pas de time-box : c'est la liste des membres d'une publication, pas une fenêtre de deux semaines. Sans fin de sprint, il n'y a pas de point d'arrivée pour un burndown, une vélocité ou un temps de cycle, et toute courbe tracée ici mesurerait une échéance qui n'existe pas. L'avancement d'un train s'affiche comme le fait que ses membres soient tous prêts — voir la page des trains de publication."
  },
  openReleaseTrains: {
    "zh-CN": "查看发布列车 →",
    en: "Open release trains →",
    ja: "リリーストレインを開く →",
    ko: "릴리스 트레인 열기 →",
    fr: "Ouvrir les trains de publication →"
  }
} satisfies Record<string, CopyEntry>;

const globalCounted = {
  inboxDescription: {
    "zh-CN": "{0} 项待决 · 跨全部项目 · 按义务性质分带,不按项目分带",
    en: "{0} awaiting a decision, across every project, banded by the kind of obligation rather than by project.",
    ja: "{0} 件が決定待ち。全プロジェクト横断で、プロジェクト別ではなく義務の性質別に区分しています。",
    ko: "{0}건이 결정 대기 중입니다. 전체 프로젝트에 걸쳐 프로젝트별이 아니라 의무의 성격별로 묶었습니다.",
    fr: "{0} en attente d'une décision, sur l'ensemble des projets, regroupés par nature d'obligation plutôt que par projet."
  },
  needOwner: {
    "zh-CN": "{0} 项须 Owner 裁定",
    en: "{0} need the Owner",
    ja: "{0} 件が Owner の裁定を要します",
    ko: "{0}건이 Owner의 결정을 필요로 합니다",
    fr: "{0} nécessitent le propriétaire"
  },
  partialCoverage: {
    "zh-CN": "覆盖不全:{0} 的纪要未读取,其未决项不在此列。此处的「已清空」只对已读取的链成立。",
    en: "Partial coverage: minutes were not read for {0}, so their open issues cannot appear here. \"Nothing left\" holds only for the chains that were read.",
    ja: "カバレッジ不足：{0} の議事録は読み取られていないため、その未解決事項はここに現れません。「残りなし」は読み取れたチェーンについてのみ成立します。",
    ko: "커버리지 부족: {0}의 회의록을 읽지 못했으므로 해당 미해결 사항은 여기에 나타나지 않습니다. '남은 것 없음'은 읽어낸 체인에 대해서만 성립합니다.",
    fr: "Couverture partielle : les comptes rendus de {0} n'ont pas été lus, leurs points ouverts ne peuvent donc pas figurer ici. « Rien ne reste » ne vaut que pour les chaînes lues."
  },
  approvalGatesCount: {
    "zh-CN": "审批门（{0}）",
    en: "Approval gates ({0})",
    ja: "承認ゲート（{0}）",
    ko: "승인 게이트({0})",
    fr: "Portes d'approbation ({0})"
  },
  openDeliberationsCount: {
    "zh-CN": "进行中的审议（{0}）",
    en: "Open deliberations ({0})",
    ja: "進行中の審議（{0}）",
    ko: "진행 중인 심의({0})",
    fr: "Délibérations en cours ({0})"
  },
  openIssuesCount: {
    "zh-CN": "未决项（{0}）",
    en: "Open issues ({0})",
    ja: "未解決事項（{0}）",
    ko: "미해결 사항({0})",
    fr: "Points ouverts ({0})"
  },
  dashboardDescription: {
    "zh-CN": "四条受治链的当前状态 · {0} 条工作记录 · 每个数字都注明它取自哪个链版本",
    en: "Current state of four governed chains, {0} work records, every figure carrying the chain version it was read at.",
    ja: "4 本のガバナンス対象チェーンの現況・{0} 件の作業レコード。各数値は読み取り時のチェーンバージョンを併記しています。",
    ko: "거버넌스 대상 체인 4개의 현재 상태 · 작업 레코드 {0}건. 각 수치는 읽은 시점의 체인 버전을 함께 표시합니다.",
    fr: "État actuel de quatre chaînes gouvernées, {0} enregistrements de travail, chaque chiffre portant la version de chaîne à laquelle il a été lu."
  },
  actorFrom: {
    "zh-CN": "执行者自 #{0} 起",
    en: "actor from #{0}",
    ja: "実行者は #{0} から",
    ko: "실행자는 #{0}부터",
    fr: "actor à partir de #{0}"
  }
} satisfies Record<string, CopyEntry>;

/**
 * The inbox — everything across every chain that is waiting on a decision.
 *
 * This is a different screen from "my work", not a filter of it, and the
 * difference is the point: my work is what I am carrying, the inbox is what is
 * carrying nothing until I act. Three sources feed it and they are genuinely
 * different obligations, so they are banded rather than blended — an owner-intent
 * gate has the engine stopped behind it, while an open deliberation is merely
 * still collecting.
 *
 * Banding them in one place is the product form of the standing stop budget:
 * these are meant to be cleared in one sitting rather than each interrupting the
 * work separately.
 */
export function InboxView({ locale, routeHref }: ViewProps) {
  const gates = cockpitData.inbox.filter((item) => item.kind === "gate");
  const conferences = cockpitData.inbox.filter((item) => item.kind === "conference");
  const unresolved = cockpitData.inbox.filter((item) => item.kind === "unresolved");
  const ownerIntent = gates.filter((item) => item.severity === "owner-intent");
  const unread = cockpitData.partitions.filter((entry) => entry.unavailable.length > 0);

  return (
    <div className="tcrn-aos-view" data-cockpit-view="inbox">
      <WorkPageHeader
        title={pick(locale, globalCopy.inbox)}
        description={format(locale, globalCounted.inboxDescription, cockpitData.inbox.length)}
        meta={[
          <Badge key="owner" tone={ownerIntent.length > 0 ? "warning" : "neutral"}>
            {format(locale, globalCounted.needOwner, ownerIntent.length)}
          </Badge>
        ]}
      />

      {unread.length > 0 ? (
        // Two of the four chains cannot supply minutes through the fallback read
        // path, so their open issues cannot appear here. An inbox that looks
        // complete but is not is worse than one that says where it stops: the
        // whole value of this screen is being able to trust "nothing left".
        <InlineAlert tone="warning" data-cockpit-notice="inbox-coverage">
          {format(
            locale,
            globalCounted.partialCoverage,
            joinNames(unread.map((entry) => partitionDisplayName(entry, locale)), locale)
          )}
        </InlineAlert>
      ) : null}

      <InboxBand
        title={format(locale, globalCounted.approvalGatesCount, gates.length)}
        note={pick(locale, globalCopy.gateNote)}
        empty={pick(locale, globalCopy.gatesEmpty)}
        items={gates}
        locale={locale}
        routeHref={routeHref}
      />
      <InboxBand
        title={format(locale, globalCounted.openDeliberationsCount, conferences.length)}
        note={pick(locale, globalCopy.conferenceNote)}
        empty={pick(locale, globalCopy.conferencesEmpty)}
        items={conferences}
        locale={locale}
        routeHref={routeHref}
      />
      <InboxBand
        title={format(locale, globalCounted.openIssuesCount, unresolved.length)}
        note={pick(locale, globalCopy.unresolvedNote)}
        empty={pick(locale, globalCopy.unresolvedEmpty)}
        items={unresolved}
        locale={locale}
        routeHref={routeHref}
      />
    </div>
  );
}

/**
 * One band of the inbox: a heading, the sentence that keeps the band from being
 * misread, and the rows.
 *
 * Where a row goes is `inboxLink`'s answer, not this component's. It used to be
 * decided here, in a module-private copy, while `cockpit-views.tsx` answered the same
 * question its own way and got it wrong for every minutes reference — see the
 * resolver's own comment in cockpit-links.ts for why that split was the defect.
 */
function InboxBand({
  title,
  note,
  empty,
  items,
  locale,
  routeHref
}: {
  title: string;
  note: string;
  empty: string;
  items: readonly CockpitInboxItem[];
  locale: TcrnLocale;
  routeHref: (path: string) => string;
}) {
  return (
    <Surface className="tcrn-aos-band">
      <Heading level={2} visualLevel={3}>{title}</Heading>
      <Text>{note}</Text>
      {items.length === 0 ? <EmptyState title={empty} /> : (
        <WorkList
          label={title}
          locale={locale}
          rows={items.map((item): WorkItemRowProps => ({
            id: item.externalKey ?? item.recordId,
            title: item.title,
            state: inboxSeverityBadge(item.severity, locale) as never,
            owner: item.severity === "owner-intent" ? "owner:governance" : inboxDetailText(item.detail, locale),
            // The `unresolved` rows are ninety-seven of the ninety-eight here, and their
            // recordId is a minutes id, so they used to land on /work-items?project=… —
            // a filtered list that does not contain the ruling they name. The row was a
            // link, which is why INC-018's first pass read this file as already done: the
            // defect was not a missing link, it was a link to the wrong place.
            ...hrefAttr(inboxLink(item, routeHref)),
            fields: [
              { key: "detail", label: pick(locale, globalCopy.detail), value: inboxDetailText(item.detail, locale) },
              {
                key: "project",
                label: pick(locale, globalCopy.project),
                value: partitionDisplayName(findPartition(item.partitionId), locale)
              }
            ]
          }))}
        />
      )}
    </Surface>
  );
}

/**
 * The dashboard — what is true across all four chains right now.
 *
 * What it deliberately does not show: burndown, velocity, and cycle time. A Jira
 * user expects those and their absence is a design decision, not an omission —
 * the release train carries no time-box, so there is no sprint end to burn down
 * to, and any curve drawn here would be measuring a deadline that does not
 * exist. The screen says so rather than leaving a person to wonder where the
 * chart went.
 */
export function DashboardView({ locale, routeHref }: ViewProps) {
  const statuses = ["planned", "ready", "active", "blocked", "done"] as const;

  return (
    <div className="tcrn-aos-view" data-cockpit-view="dashboard">
      <WorkPageHeader
        title={pick(locale, globalCopy.dashboard)}
        description={format(locale, globalCounted.dashboardDescription, cockpitData.work.length)}
      />

      <Surface className="tcrn-aos-band">
        <Heading level={2} visualLevel={3}>{pick(locale, globalCopy.byStatus)}</Heading>
        <dl className="tcrn-aos-stats">
          {statuses.map((status) => (
            <div key={status} className="tcrn-aos-stat">
              {/* The chain's own word, said in the reader's language. This row used
                  to print the raw token, so the one panel on the dashboard that
                  names the state machine was English in all five locales. */}
              <dt>{chainStatusLabel(status, locale)}</dt>
              <dd>{cockpitData.work.filter((row) => row.status === status).length}</dd>
            </div>
          ))}
        </dl>
      </Surface>

      <Surface className="tcrn-aos-band">
        <Heading level={2} visualLevel={3}>{pick(locale, globalCopy.perChain)}</Heading>
        <div className="tcrn-aos-project-grid">
          {cockpitData.partitions.map((partition) => {
            const work = cockpitData.work.filter((row) => row.partitionId === partition.id);
            const pending = cockpitData.gates.filter(
              (gate) => gate.partitionId === partition.id && gate.status === "pending");
            const open = cockpitData.conferences.filter(
              (conference) => conference.partitionId === partition.id && conference.status === "open");
            return (
              <Surface key={partition.id} className="tcrn-aos-project-card" data-partition-id={partition.id}>
                <Heading level={3} visualLevel={3}>{partitionDisplayName(partition, locale)}</Heading>
                <div className="tcrn-aos-project-card__meta">
                  <MachineTokenCell token={`v${partition.chainVersion}`} kind="generic" copyable={false} />
                  {/* How a chain was read decides what this dashboard can even
                      count for it, so it is stated on the card rather than left
                      to be discovered on a screen that comes up empty. */}
                  {/* Three read paths, not two. The middle one reaches
                      deliberations and only misses the event log, which is a
                      materially different answer from the old fallback that
                      could reach neither. */}
                  <Badge tone={partition.readVia === "paginated" ? "warning" : "neutral"}>
                    {pick(
                      locale,
                      partition.readVia === "export"
                        ? globalCopy.readInFull
                        : partition.readVia === "paginated-with-deliberations"
                          ? globalCopy.paginatedWithDeliberations
                          : globalCopy.paginatedFallback
                    )}
                  </Badge>
                  {/* Only a chain read in full can answer this. The fallback
                      path cannot reach the event log at all, so its null means
                      "not read" — reporting that as "no actor recorded" would
                      state a fact about the chain that this projection never
                      looked at. */}
                  <Badge tone="neutral">
                    {partition.readVia !== "export"
                      ? pick(locale, globalCopy.attributionNotRead)
                      : partition.attestationFromSequence === null
                        ? pick(locale, globalCopy.noActorRecorded)
                        : format(locale, globalCounted.actorFrom, partition.attestationFromSequence)}
                  </Badge>
                </div>
                <dl className="tcrn-aos-stats">
                  <Stat label={pick(locale, globalCopy.work)} value={work.length} />
                  <Stat
                    label={pick(locale, globalCopy.active)}
                    value={work.filter((row) => row.status === "active").length}
                  />
                  <Stat label={pick(locale, globalCopy.pendingGates)} value={pending.length} />
                  <Stat label={pick(locale, globalCopy.openDeliberations)} value={open.length} />
                </dl>
                <a className="tcrn-aos-project-card__link" href={routeHref(`/board?project=${partition.id}`)}>
                  {pick(locale, globalCopy.openBoard)}
                </a>
              </Surface>
            );
          })}
        </div>
      </Surface>

      <Surface className="tcrn-aos-band" data-dashboard-panel="absent-by-design">
        <Heading level={2} visualLevel={3}>{pick(locale, globalCopy.noBurndownTitle)}</Heading>
        <Text>{pick(locale, globalCopy.noBurndownBody)}</Text>
        <a className="tcrn-aos-project-card__link" href={routeHref("/release-trains")}>
          {pick(locale, globalCopy.openReleaseTrains)}
        </a>
      </Surface>
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

function findPartition(id: string): CockpitPartition | undefined {
  return cockpitData.partitions.find((entry) => entry.id === id);
}
