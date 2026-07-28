import {
  Badge,
  Breadcrumb,
  EmptyState,
  Heading,
  InlineAlert,
  KeyValueList,
  MachineTokenCell,
  Surface,
  Text,
  WorkActivityFeed,
  WorkList,
  type WorkItemRowProps
} from "@tcrn/ui-react";
import type { TcrnLocale } from "@tcrn/ui-copy-state";

import { cockpitData } from "./cockpit-data.generated.js";
import {
  chainStatusBadge,
  chainStatusLabel,
  outcomeClassLabel,
  partitionDisplayName,
  workTitle,
  type CockpitWork
} from "./cockpit-types.js";
import { DomainPanel } from "./cockpit-domain-panel.js";
import { conferenceLink, hrefAttr, minutesLink, workItemLink } from "./cockpit-links.js";
import { format, joinNames, pick, type CopyEntry } from "./copy.js";

/**
 * Detail-view copy in all five locales.
 *
 * Two strings here carry more weight than their length suggests. "Chain fields, not
 * editable" is the only thing telling a reader which half of this screen is a
 * governance record — someone who cannot read it may try to correct a decision by
 * editing a label. And the activity panel's refusals ("not read, not inactive",
 * "that is the chain's answer, not a gap in the read") are the whole reason the
 * panel is trustworthy; in English on a Korean route they say nothing.
 */
const detailCopy = {
  kind: { "zh-CN": "类型", en: "Kind", ja: "種別", ko: "종류", fr: "Type" },
  status: { "zh-CN": "状态", en: "Status", ja: "ステータス", ko: "상태", fr: "Statut" },
  parent: { "zh-CN": "父级", en: "Parent", ja: "親", ko: "상위", fr: "Parent" },
  noParent: { "zh-CN": "无（树根）", en: "none (root)", ja: "なし（ルート）", ko: "없음(루트)", fr: "aucun (racine)" },
  releaseTrain: {
    "zh-CN": "发布列车",
    en: "Release train",
    ja: "リリーストレイン",
    ko: "릴리스 트레인",
    fr: "Train de publication"
  },
  notEnrolled: { "zh-CN": "未入列", en: "not enrolled", ja: "未登録", ko: "미등록", fr: "non inscrit" },
  decidedBy: { "zh-CN": "裁定源", en: "Decided by", ja: "裁定元", ko: "결정 근거", fr: "Décidé par" },
  revision: { "zh-CN": "修订", en: "Revision", ja: "改訂", ko: "개정", fr: "Révision" },
  fields: { "zh-CN": "字段", en: "Fields", ja: "フィールド", ko: "필드", fr: "Champs" },
  chainFieldsNote: {
    "zh-CN": "链上字段 · 不可编辑",
    en: "Chain fields, not editable",
    ja: "チェーン上のフィールド・編集不可",
    ko: "체인 상의 필드 · 편집 불가",
    fr: "Champs de la chaîne, non modifiables"
  },
  scope: { "zh-CN": "范围", en: "Scope", ja: "スコープ", ko: "범위", fr: "Périmètre" },
  noScope: {
    "zh-CN": "该记录没有范围注解——链上确实没有标题。",
    en: "No scope annotation; the chain genuinely holds no title for this record.",
    ja: "スコープ注釈がありません。チェーンはこのレコードの標題を実際に保持していません。",
    ko: "범위 주석이 없습니다. 체인은 이 레코드의 제목을 실제로 보유하지 않습니다.",
    fr: "Aucune annotation de périmètre ; la chaîne ne détient réellement aucun titre pour cet enregistrement."
  },
  children: { "zh-CN": "子项", en: "Children", ja: "子項目", ko: "하위 항목", fr: "Éléments enfants" },
  noChildren: {
    "zh-CN": "无子项。Subtask 按公约在开工时切分,不预造。",
    en: "No children. Subtasks are cut when work starts, never pre-created.",
    ja: "子項目はありません。Subtask は着手時に切り出す規約であり、事前に作成しません。",
    ko: "하위 항목이 없습니다. Subtask는 착수 시점에 나누며 미리 만들지 않습니다.",
    fr: "Aucun élément enfant. Les sous-tâches sont découpées au démarrage du travail, jamais créées à l'avance."
  },
  decisionsAndEvidence: {
    "zh-CN": "决策与证据",
    en: "Decisions and evidence",
    ja: "決定と証拠",
    ko: "결정과 증거",
    fr: "Décisions et preuves"
  },
  noGovernance: {
    "zh-CN": "该工作项尚无门、审议或裁定源。",
    en: "No gate, deliberation, or ruling is attached yet.",
    ja: "ゲート・審議・裁定はまだ紐付いていません。",
    ko: "게이트, 심의, 결정이 아직 연결되지 않았습니다.",
    fr: "Aucune porte, délibération ou décision n'est encore rattachée."
  },
  partialDecisionDetail: {
    "zh-CN": "该项目的立场与纪要未读取,决策详情不完整。",
    en: "Positions and minutes were not read for this project, so decision detail is incomplete.",
    ja: "このプロジェクトの立場と議事録は読み取られていないため、決定の詳細は不完全です。",
    ko: "이 프로젝트의 입장과 회의록을 읽지 못했으므로 결정 상세가 불완전합니다.",
    fr: "Les positions et les comptes rendus n'ont pas été lus pour ce projet, le détail des décisions est donc incomplet."
  },
  activity: { "zh-CN": "活动", en: "Activity", ja: "アクティビティ", ko: "활동", fr: "Activité" },
  breadcrumbLabel: {
    "zh-CN": "面包屑导航",
    en: "Breadcrumb",
    ja: "パンくずリスト",
    ko: "탐색 경로",
    fr: "Fil d'Ariane"
  },
  attestationNeverEnabled: {
    "zh-CN": "该链未启用 actor attestation,因此没有任何一条事件记录了执行者——这是链的事实,不是读取缺口。",
    en: "This chain has never enabled actor attestation, so not one of its events records who acted. That is the chain's answer, not a gap in the read.",
    ja: "このチェーンは actor attestation を有効にしたことがないため、どのイベントも実行者を記録していません。これはチェーンの事実であり、読み取りの欠落ではありません。",
    ko: "이 체인은 actor attestation을 활성화한 적이 없으므로 어떤 이벤트도 실행자를 기록하지 않습니다. 이는 체인의 사실이며 읽기 누락이 아닙니다.",
    fr: "Cette chaîne n'a jamais activé l'attestation d'actor, aucun de ses événements n'enregistre donc qui a agi. C'est la réponse de la chaîne, pas une lacune de lecture."
  },
  logNotRead: {
    "zh-CN": "该项目的事件日志未读取（链体量超出 export 上限,降级读面没有事件读法）。此处为未取,不是无活动。",
    en: "This project's event log was not read: the chain exceeds the export ceiling and the fallback read surface has no event verb. Not read, not inactive.",
    ja: "このプロジェクトのイベントログは読み取られていません（チェーンが export の上限を超え、縮退読み取り面にイベント用の verb がありません）。無活動ではなく未取得です。",
    ko: "이 프로젝트의 이벤트 로그를 읽지 못했습니다(체인이 export 상한을 초과하고 축소 읽기 표면에 이벤트 verb가 없습니다). 활동이 없는 것이 아니라 미조회입니다.",
    fr: "Le journal d'événements de ce projet n'a pas été lu : la chaîne dépasse le plafond d'export et la surface de repli n'a pas de verbe d'événement. Non lu, pas inactif."
  },
  noEvents: {
    "zh-CN": "该记录尚无事件。",
    en: "No event has touched this record yet.",
    ja: "このレコードに触れたイベントはまだありません。",
    ko: "이 레코드에 적용된 이벤트가 아직 없습니다.",
    fr: "Aucun événement n'a encore touché cet enregistrement."
  },
  notRecordedPredates: {
    "zh-CN": "未记录（早于 attestation）",
    en: "not recorded (predates attestation)",
    ja: "未記録（attestation より前）",
    ko: "미기록(attestation 이전)",
    fr: "non enregistré (antérieur à l'attestation)"
  },
  notRecordedDisabled: {
    "zh-CN": "未记录（该链未启用 attestation）",
    en: "not recorded (attestation not enabled)",
    ja: "未記録（このチェーンは attestation 未有効）",
    ko: "미기록(이 체인은 attestation 미활성)",
    fr: "non enregistré (attestation non activée)"
  }
} satisfies Record<string, CopyEntry>;

const detailCounted = {
  notFound: {
    "zh-CN": "未找到工作项 {0}",
    en: "No work item {0}",
    ja: "作業項目 {0} は見つかりません",
    ko: "작업 항목 {0}을(를) 찾을 수 없습니다",
    fr: "Aucun élément de travail {0}"
  },
  childrenCount: {
    "zh-CN": "子项（{0}）",
    en: "Children ({0})",
    ja: "子項目（{0}）",
    ko: "하위 항목({0})",
    fr: "Éléments enfants ({0})"
  },
  attestationFrom: {
    "zh-CN": "该链自序号 {0} 起记录执行者;更早的事件在该能力启用之前。",
    en: "This chain records the actor from sequence {0}; earlier events predate that capability.",
    ja: "このチェーンは序号 {0} 以降の実行者を記録します。それ以前のイベントはこの機能の有効化前です。",
    ko: "이 체인은 시퀀스 {0}부터 실행자를 기록합니다. 그 이전 이벤트는 이 기능 활성화 전입니다.",
    fr: "Cette chaîne enregistre l'actor à partir de la séquence {0} ; les événements antérieurs précèdent cette capacité."
  },
  chainSequence: {
    "zh-CN": "链序号 {0}",
    en: "chain sequence {0}",
    ja: "チェーン序号 {0}",
    ko: "체인 시퀀스 {0}",
    fr: "séquence de chaîne {0}"
  }
} satisfies Record<string, CopyEntry>;

/**
 * Work item detail — every field the chain holds, and nothing it does not.
 *
 * Fields come from two places and the difference is load-bearing, so the view
 * marks it rather than blending them: chain fields are governance record and can
 * never be edited here, while operational metadata is the cockpit's own and is
 * freely editable. A reader who cannot tell which is which will eventually try
 * to correct a decision by editing a label.
 */
export function WorkItemDetailView({
  locale,
  routeHref,
  itemKey
}: {
  locale: TcrnLocale;
  routeHref: (path: string) => string;
  itemKey: string;
}) {
  const item = cockpitData.work.find(
    (row) => row.externalKey === itemKey || row.id === itemKey);

  if (!item) {
    return (
      <div className="tcrn-aos-view" data-cockpit-view="work-item-detail">
        <EmptyState title={format(locale, detailCounted.notFound, itemKey)} />
      </div>
    );
  }

  const partition = cockpitData.partitions.find((entry) => entry.id === item.partitionId);
  const ancestors = ancestryOf(item);
  const parent = ancestors[ancestors.length - 1];
  const children = cockpitData.work.filter(
    (row) => row.partitionId === item.partitionId && row.parentId === item.id);
  const gates = cockpitData.gates.filter(
    (gate) => gate.partitionId === item.partitionId && gate.workId === item.id);
  const conferences = cockpitData.conferences.filter(
    (conference) => conference.partitionId === item.partitionId
      && conference.workIds.includes(item.id));
  const train = item.sprintWorkId
    ? cockpitData.work.find((row) => row.id === item.sprintWorkId)
    : undefined;

  const chainFields = [
    { key: "kind", label: pick(locale, detailCopy.kind), value: item.kind },
    { key: "status", label: pick(locale, detailCopy.status), value: chainStatusLabel(item.status, locale) },
    {
      key: "parent",
      label: pick(locale, detailCopy.parent),
      // The nearest ancestor is a work item with its own page, so it is a link
      // here as well as in the breadcrumb. `KeyValueItem.value` is a ReactNode
      // precisely so a field can be a reference rather than a spelling of one.
      value: parent
        ? <a href={workItemLink(parent, routeHref).href}>{workItemLink(parent, routeHref).label}</a>
        : pick(locale, detailCopy.noParent)
    },
    {
      key: "train",
      label: pick(locale, detailCopy.releaseTrain),
      value: train?.externalKey ?? pick(locale, detailCopy.notEnrolled)
    },
    {
      key: "decided-by",
      label: pick(locale, detailCopy.decidedBy),
      // The field row names the same minutes the side panel links, so it says the
      // same thing: the recovered key, not the digest. It stays text here — the
      // panel is where a reader follows the reference, and two links to one place
      // on one screen is noise.
      value: item.decidedBy.length > 0
        ? joinNames(item.decidedBy.map((minutesId) => minutesLink(minutesId, routeHref).label), locale)
        : "—"
    },
    { key: "revision", label: pick(locale, detailCopy.revision), value: `r${item.revision}` }
  ];

  return (
    <div className="tcrn-aos-view" data-cockpit-view="work-item-detail" data-work-item-key={item.externalKey ?? item.id}>
      {/* Every crumb but the last carries an href.
          This trail used to be inert text: it named the ancestors and offered no
          way to reach them, so the only route back out of a detail page was the
          browser's own back button — the defect INC-016 reports. The last crumb
          stays unlinked on purpose; it is where the reader already is. */}
      <Breadcrumb
        label={pick(locale, detailCopy.breadcrumbLabel)}
        items={[
          {
            id: "project",
            label: partition ? partitionDisplayName(partition, locale) : item.partitionId,
            href: routeHref(`/work-items?project=${item.partitionId}`)
          },
          ...ancestors.map((ancestor) => ({
            id: ancestor.id,
            label: ancestor.externalKey ?? ancestor.id,
            href: routeHref(`/work-items/${ancestor.externalKey ?? ancestor.id}`)
          })),
          { id: item.id, label: item.externalKey ?? item.id, selected: true }
        ]}
      />
      <Surface className="tcrn-aos-detail-head">
        <div className="tcrn-aos-detail-head__title">
          <MachineTokenCell token={item.externalKey ?? item.id} kind="work-item" copyable={false} />
          <Heading level={1} visualLevel={2}>
            {workTitle(item) ?? (item.externalKey ?? item.id)}
          </Heading>
        </div>
        <div className="tcrn-aos-detail-head__meta">
          <Badge tone="neutral">{item.kind}</Badge>
          <Badge tone={item.status === "blocked" ? "warning" : "neutral"}>{item.status}</Badge>
          {partition ? (
            <MachineTokenCell token={`v${partition.chainVersion}`} kind="generic" copyable={false} />
          ) : null}
        </div>
      </Surface>

      <div className="tcrn-aos-detail-grid">
        <div className="tcrn-aos-detail-main">
          <Surface className="tcrn-aos-band">
            <Heading level={2} visualLevel={3}>{pick(locale, detailCopy.fields)}</Heading>
            <div data-field-origin="chain">
              <Text>{pick(locale, detailCopy.chainFieldsNote)}</Text>
              <KeyValueList items={chainFields} />
            </div>
          </Surface>

          <Surface className="tcrn-aos-band">
            <Heading level={2} visualLevel={3}>{pick(locale, detailCopy.scope)}</Heading>
            {item.scope
              ? <Text className="tcrn-aos-prose">{item.scope}</Text>
              : <EmptyState title={pick(locale, detailCopy.noScope)} />}
          </Surface>

          <Surface className="tcrn-aos-band">
            <Heading level={2} visualLevel={3}>
              {format(locale, detailCounted.childrenCount, children.length)}
            </Heading>
            {children.length > 0
              ? (
                <WorkList
                  label={pick(locale, detailCopy.children)}
                  locale={locale}
                  rows={children.map((child) => childRow(child, locale, routeHref))}
                />
              )
              : <EmptyState title={pick(locale, detailCopy.noChildren)} />}
          </Surface>

          {/* The cockpit's own fields, which are the only editable ones here.
              They arrived with the domain store; before that this space held a
              list of empty placeholders marked "pending", which was honest but
              is now simply the panel. */}
          <DomainPanel
            locale={locale}
            partitionId={item.partitionId}
            recordId={item.id}
            externalKey={item.externalKey}
          />

          <ActivityPanel item={item} locale={locale} />
        </div>

        <div className="tcrn-aos-detail-side">
          {/* Everything on this panel is a reference, so everything on it is
              reachable. It used to be inert: a minutes id rendered as bare text,
              a gate and a deliberation as a title beside a badge, and a reader who
              wanted the thing behind any of them had to copy the id and hunt for
              it — the defect INC-018 reports, in the one panel where following a
              reference is the entire task. */}
          <Surface className="tcrn-aos-band" data-detail-panel="governance">
            <Heading level={2} visualLevel={3}>{pick(locale, detailCopy.decisionsAndEvidence)}</Heading>
            {gates.length === 0 && conferences.length === 0 && item.decidedBy.length === 0 ? (
              <EmptyState title={pick(locale, detailCopy.noGovernance)} />
            ) : (
              <>
                {item.decidedBy.length > 0 ? (
                  <div data-governance-link="decided-by">
                    <Text>{pick(locale, detailCopy.decidedBy)}</Text>
                    {item.decidedBy.map((minutesId) => {
                      // A ruling names minutes, and minutes are read in the
                      // deliberation that produced them — so the token shows the
                      // minutes key and links to that room. Two of the ids in the
                      // current projection name minutes whose conference was never
                      // read; those render as a token with no link rather than a
                      // link that goes nowhere.
                      const link = minutesLink(minutesId, routeHref);
                      return (
                        <MachineTokenCell
                          key={minutesId}
                          token={link.label}
                          kind="generic"
                          copyable={false}
                          {...hrefAttr(link)}
                        />
                      );
                    })}
                  </div>
                ) : null}
                {gates.map((gate) => (
                  // A gate has no page of its own and, in this projection, no
                  // recovered key either — so its title stays text. Linking it to
                  // the work item the reader is already on would be a link that
                  // costs a click and arrives nowhere.
                  <div key={gate.id} data-governance-link="gate">
                    <Badge tone={gate.status === "pending" ? "warning" : "neutral"}>
                      {outcomeClassLabel(gate.outcomeClass, locale)}
                    </Badge>
                    <Text>{gate.title ?? gate.externalKey ?? gate.id}</Text>
                  </div>
                ))}
                {conferences.map((conference) => {
                  const link = conferenceLink(conference, routeHref);
                  return (
                    <div key={conference.id} data-governance-link="conference">
                      <Badge tone={conference.status === "open" ? "warning" : "neutral"}>
                        {chainStatusLabel(conference.status, locale)}
                      </Badge>
                      <a href={link.href}>{link.label}</a>
                    </div>
                  );
                })}
              </>
            )}
          </Surface>

          {partition && partition.unavailable.length > 0 ? (
            <InlineAlert tone="warning" data-cockpit-notice="partial-projection">
              {pick(locale, detailCopy.partialDecisionDetail)}
            </InlineAlert>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * The work item's own history, straight from the chain's event log.
 *
 * Three things this panel refuses to do, each because the alternative would read
 * as fact: it never renders a before-and-after ("ready → active"), because the
 * event payload holds only the state after the write and the previous value
 * would have to be inferred; it never leaves the actor column blank, because a
 * blank reads as an oversight rather than as the chain's answer; and it never
 * shows an empty feed for a chain whose log was not read, because "nothing
 * happened" and "not read" are the same picture and opposite facts.
 */
function ActivityPanel({ item, locale }: { item: CockpitWork; locale: TcrnLocale }) {
  const partition = cockpitData.partitions.find((entry) => entry.id === item.partitionId);
  const entries = cockpitData.activityByWork[item.id] ?? [];
  const logUnavailable = partition?.unavailable.includes("events") ?? false;

  const attributionNote = partition?.attestationFromSequence === null
    ? pick(locale, detailCopy.attestationNeverEnabled)
    : format(locale, detailCounted.attestationFrom, partition?.attestationFromSequence ?? "—");

  return (
    <Surface className="tcrn-aos-band" data-detail-panel="activity">
      <Heading level={2} visualLevel={3}>{pick(locale, detailCopy.activity)}</Heading>
      {logUnavailable ? (
        <EmptyState title={pick(locale, detailCopy.logNotRead)} />
      ) : entries.length === 0 ? (
        <EmptyState title={pick(locale, detailCopy.noEvents)} />
      ) : (
        <>
          <Text>{attributionNote}</Text>
          <WorkActivityFeed
            label={pick(locale, detailCopy.activity)}
            locale={locale}
            items={entries.map((entry) => ({
              id: entry.id,
              actor: entry.actorId ?? pick(
                locale,
                entry.attribution === "predates-attestation"
                  ? detailCopy.notRecordedPredates
                  : detailCopy.notRecordedDisabled
              ),
              action: entry.operation,
              timestamp: entry.occurredAt,
              summary: format(locale, detailCounted.chainSequence, entry.sequence)
            }))}
          />
        </>
      )}
    </Surface>
  );
}

/** Walk parent links to the root, nearest ancestor last. */
function ancestryOf(item: CockpitWork): CockpitWork[] {
  const chain: CockpitWork[] = [];
  const seen = new Set<string>([item.id]);
  let current = item;
  while (current.parentId) {
    const parent = cockpitData.work.find(
      (row) => row.partitionId === current.partitionId && row.id === current.parentId);
    // A cycle cannot occur in a chain-enforced tree, but a partial projection can
    // hold a child whose parent was not read; stopping is better than looping.
    if (!parent || seen.has(parent.id)) break;
    seen.add(parent.id);
    chain.unshift(parent);
    current = parent;
  }
  return chain;
}

function childRow(row: CockpitWork, locale: TcrnLocale, routeHref: (path: string) => string): WorkItemRowProps {
  return {
    id: row.externalKey ?? row.id,
    title: workTitle(row) ?? (row.externalKey ?? row.id),
    state: chainStatusBadge(row.status, locale) as never,
    owner: row.kind,
    href: routeHref(`/work-items/${row.externalKey ?? row.id}`),
    fields: [{
      key: "status",
      label: pick(locale, detailCopy.status),
      value: chainStatusLabel(row.status, locale)
    }]
  };
}
