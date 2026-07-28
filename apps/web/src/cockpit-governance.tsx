import {
  Badge,
  EmptyState,
  Heading,
  InlineAlert,
  KeyValueList,
  MachineTokenCell,
  Surface,
  Text,
  WorkList,
  type WorkItemRowProps
} from "@tcrn/ui-react";
import type { TcrnLocale } from "@tcrn/ui-copy-state";

import { cockpitData } from "./cockpit-data.generated.js";
import { hrefAttr, minutesLink } from "./cockpit-links.js";
import {
  chainStatusLabel,
  partitionDisplayName,
  workTitle,
  type CockpitWork
} from "./cockpit-types.js";
import { format, pick, type CopyEntry } from "./copy.js";

interface ViewProps {
  locale: TcrnLocale;
  routeHref: (path: string) => string;
}

/**
 * Release-train, audit, and snapshot copy in all five locales.
 *
 * The audit view carries the highest-stakes prose in the product: three paragraphs
 * that exist to stop a reader drawing a wrong conclusion from a correct number
 * ("unnamed records are not a defect", "reading the field raw overstates what is
 * open", "shown as not observed rather than as healthy"). A caveat that only three
 * of five readers can read is a caveat that is not doing its job.
 */
const governanceCopy = {
  releaseTrains: {
    "zh-CN": "发布列车",
    en: "Release trains",
    ja: "リリーストレイン",
    ko: "릴리스 트레인",
    fr: "Trains de publication"
  },
  releaseTrainsBody: {
    "zh-CN": "一批 Initiative 打包发布。没有时间盒——引擎没有时钟,列车由成员定义而非由日期定义;发车是唯一的发布停点。",
    en: "A batch of Initiatives that ships together. No time box: the engine has no clock, and a train is defined by its members rather than by a date. Departure is the single publish stop.",
    ja: "一群のイニシアチブをまとめて出荷します。タイムボックスはありません——エンジンに時計はなく、トレインは日付ではなく成員で定義されます。発車が唯一の公開停止点です。",
    ko: "여러 이니셔티브를 묶어 함께 출시합니다. 타임박스는 없습니다. 엔진에는 시계가 없고 트레인은 날짜가 아니라 구성원으로 정의됩니다. 발차가 유일한 공개 정지점입니다.",
    fr: "Un lot d'initiatives publiées ensemble. Pas de time-box : le moteur n'a pas d'horloge, et un train est défini par ses membres plutôt que par une date. Le départ est le seul point d'arrêt de publication."
  },
  noTrains: {
    "zh-CN": "尚无发布列车。",
    en: "No release train has been formed yet.",
    ja: "リリーストレインはまだ編成されていません。",
    ko: "아직 편성된 릴리스 트레인이 없습니다.",
    fr: "Aucun train de publication n'a encore été formé."
  },
  departed: { "zh-CN": "已发车", en: "departed", ja: "発車済み", ko: "발차됨", fr: "parti" },
  forming: { "zh-CN": "编组中", en: "forming", ja: "編成中", ko: "편성 중", fr: "en formation" },
  members: { "zh-CN": "成员", en: "Members", ja: "成員", ko: "구성원", fr: "Membres" },
  noMembers: {
    "zh-CN": "该列车没有登记成员。",
    en: "No member is enrolled on this train.",
    ja: "このトレインに登録された成員はありません。",
    ko: "이 트레인에 등록된 구성원이 없습니다.",
    fr: "Aucun membre n'est inscrit sur ce train."
  },
  status: { "zh-CN": "状态", en: "Status", ja: "ステータス", ko: "상태", fr: "Statut" },
  audit: { "zh-CN": "审计视图", en: "Audit", ja: "監査ビュー", ko: "감사 보기", fr: "Audit" },
  auditBody: {
    "zh-CN": "链忠实记录,但记录不会告诉你它自己不合理。这里做的是外部读者才能做的检查。",
    en: "A chain records faithfully; it cannot tell you when its own record is implausible. These are the checks only an outside reader can make.",
    ja: "チェーンは忠実に記録しますが、その記録自体が不合理であることは教えてくれません。ここで行うのは外部の読者にしかできない検査です。",
    ko: "체인은 충실히 기록하지만 그 기록 자체가 타당하지 않다는 것은 알려주지 않습니다. 여기서 하는 것은 외부 독자만이 할 수 있는 검사입니다.",
    fr: "Une chaîne enregistre fidèlement ; elle ne peut pas vous dire quand son propre enregistrement est invraisemblable. Ce sont les vérifications que seul un lecteur extérieur peut faire."
  },
  completeness: {
    "zh-CN": "记录完整性",
    en: "Record completeness",
    ja: "レコードの完全性",
    ko: "레코드 완전성",
    fr: "Complétude des enregistrements"
  },
  completenessBody: {
    "zh-CN": "未命名记录不是缺陷——它们的键不合命名公约,故此处如实留空而非编造。",
    en: "Unnamed records are not a defect: their keys do not follow the naming convention, so they are left blank rather than invented.",
    ja: "名前のないレコードは欠陥ではありません。キーが命名規約に従っていないため、捏造せずそのまま空欄にしています。",
    ko: "이름 없는 레코드는 결함이 아닙니다. 키가 명명 규약을 따르지 않으므로 만들어내지 않고 그대로 비워 둡니다.",
    fr: "Les enregistrements sans nom ne sont pas un défaut : leurs clés ne suivent pas la convention de nommage, ils sont donc laissés vides plutôt qu'inventés."
  },
  workRecords: {
    "zh-CN": "工作记录",
    en: "Work records",
    ja: "作業レコード",
    ko: "작업 레코드",
    fr: "Enregistrements de travail"
  },
  keysRecovered: {
    "zh-CN": "已恢复键号",
    en: "Keys recovered",
    ja: "復元済みキー",
    ko: "복원된 키",
    fr: "Clés récupérées"
  },
  withScope: { "zh-CN": "带范围注解", en: "With scope", ja: "スコープあり", ko: "범위 있음", fr: "Avec périmètre" },
  withRuling: { "zh-CN": "带裁定源", en: "With a ruling", ja: "裁定あり", ko: "결정 있음", fr: "Avec décision" },
  chainVersion: {
    "zh-CN": "链版本",
    en: "Chain version",
    ja: "チェーンバージョン",
    ko: "체인 버전",
    fr: "Version de chaîne"
  },
  effectiveOpen: {
    "zh-CN": "未决项净值",
    en: "Effective open issues",
    ja: "実効的な未解決事項",
    ko: "실효 미해결 사항",
    fr: "Points ouverts effectifs"
  },
  effectiveOpenBody: {
    "zh-CN": "纪要的未决项不可变,消解靠后续纪要——裸读会高估未决量。",
    en: "Recorded open issues are immutable and are settled by later minutes, so reading the field raw overstates what is actually open.",
    ja: "議事録の未解決事項は変更できず、解消は後続の議事録によります。フィールドをそのまま読むと未解決量を過大に見積もります。",
    ko: "회의록의 미해결 사항은 변경할 수 없고 이후 회의록으로 해소됩니다. 필드를 그대로 읽으면 미해결량을 과대평가합니다.",
    fr: "Les points ouverts enregistrés sont immuables et se règlent par des comptes rendus ultérieurs ; lire le champ brut surestime donc ce qui est réellement ouvert."
  },
  noEffectiveOpen: {
    "zh-CN": "没有仍然有效的未决项。",
    en: "No open issue remains effective.",
    ja: "実効的な未解決事項は残っていません。",
    ko: "실효 상태로 남은 미해결 사항이 없습니다.",
    fr: "Aucun point ouvert ne reste effectif."
  },
  auditScope: {
    "zh-CN": "时间戳形状检查(整分边界聚集、段落盘时间对照)待事件级读面接入后加入;当前审计面基于记录而非事件。",
    en: "Timestamp-shape checks need event-level reads, which the current surface does not provide; this audit works from records rather than events.",
    ja: "タイムスタンプ形状の検査にはイベント単位の読み取りが必要で、現在の読み取り面では提供されません。この監査はイベントではなくレコードに基づいています。",
    ko: "타임스탬프 형태 검사에는 이벤트 단위 읽기가 필요하지만 현재 읽기 표면은 이를 제공하지 않습니다. 이 감사는 이벤트가 아니라 레코드를 기준으로 합니다.",
    fr: "Les vérifications de forme d'horodatage nécessitent des lectures au niveau des événements, que la surface actuelle ne fournit pas ; cet audit travaille à partir des enregistrements plutôt que des événements."
  },
  snapshotHealth: {
    "zh-CN": "快照健康",
    en: "Snapshot health",
    ja: "スナップショットの健全性",
    ko: "스냅샷 상태",
    fr: "Santé des instantanés"
  },
  snapshotHealthBody: {
    "zh-CN": "每个分区最后一次通过验证的快照,以及备份节奏是否被遵守。",
    en: "The last verified snapshot per partition, and whether the backup cadence was honoured.",
    ja: "区画ごとの最後に検証されたスナップショットと、バックアップの間隔が守られたかどうか。",
    ko: "파티션별 마지막으로 검증된 스냅샷과 백업 주기가 지켜졌는지 여부.",
    fr: "Le dernier instantané vérifié par partition, et si la cadence de sauvegarde a été respectée."
  },
  snapshotNotIngested: {
    "zh-CN": "快照收据尚未接入投影:快照是链外产物,需读取备份目录的清单而非链本身。此处如实显示为未观测,而不是显示为健康。",
    en: "Snapshot receipts are not yet ingested: snapshots live outside the chain, so this needs the backup directory's manifests rather than the chain itself. Shown as not observed rather than as healthy.",
    ja: "スナップショットの受領記録はまだ投影に取り込まれていません。スナップショットはチェーン外の生成物であり、チェーン自体ではなくバックアップディレクトリのマニフェストを読む必要があります。健全としてではなく未観測として表示しています。",
    ko: "스냅샷 수령 기록은 아직 투영에 반영되지 않았습니다. 스냅샷은 체인 외부의 산출물이므로 체인 자체가 아니라 백업 디렉터리의 명세를 읽어야 합니다. 정상이 아니라 미관측으로 표시합니다.",
    fr: "Les reçus d'instantané ne sont pas encore ingérés : les instantanés vivent hors de la chaîne, ce qui exige les manifestes du répertoire de sauvegarde plutôt que la chaîne elle-même. Affiché comme non observé plutôt que comme sain."
  },
  notObserved: { "zh-CN": "未观测", en: "not observed", ja: "未観測", ko: "미관측", fr: "non observé" }
} satisfies Record<string, CopyEntry>;

const surfaceToEffective = {
  "zh-CN": "表面 {0} 条 → 有效 {1} 条（已消解 {2}）",
  en: "{0} recorded → {1} effective ({2} settled)",
  ja: "記録 {0} 件 → 実効 {1} 件（{2} 件解消済み）",
  ko: "기록 {0}건 → 실효 {1}건({2}건 해소됨)",
  fr: "{0} enregistrés → {1} effectifs ({2} réglés)"
} satisfies CopyEntry;

/**
 * Release trains — batches of Initiatives that ship together.
 *
 * A train has no time box and no burndown, because the engine has no clock and
 * the batch is defined by membership rather than by a date. Departure is the
 * single publish stop, which is why the view names it rather than offering it as
 * a button.
 */
export function ReleaseTrainsView({ locale, routeHref }: ViewProps) {
  const trains = cockpitData.work.filter((row) => row.kind === "Release");

  return (
    <div className="tcrn-aos-view" data-cockpit-view="release-trains">
      <Surface className="tcrn-aos-band">
        <Heading level={1} visualLevel={2}>{pick(locale, governanceCopy.releaseTrains)}</Heading>
        <Text>{pick(locale, governanceCopy.releaseTrainsBody)}</Text>
      </Surface>

      {trains.length === 0 ? (
        <EmptyState title={pick(locale, governanceCopy.noTrains)} />
      ) : (
        trains.map((train) => {
          const members = cockpitData.work.filter((row) => row.sprintWorkId === train.id);
          return (
            <Surface key={train.id} className="tcrn-aos-band" data-train-key={train.externalKey ?? train.id}>
              <div className="tcrn-aos-detail-head__meta">
                <MachineTokenCell token={train.externalKey ?? train.id} kind="work-item" copyable={false} />
                <Badge tone={train.status === "done" ? "neutral" : "warning"}>
                  {pick(locale, train.status === "done" ? governanceCopy.departed : governanceCopy.forming)}
                </Badge>
              </div>
              <Heading level={2} visualLevel={3}>
                {workTitle(train) ?? (train.externalKey ?? train.id)}
              </Heading>
              {members.length > 0 ? (
                <WorkList
                  label={pick(locale, governanceCopy.members)}
                  locale={locale}
                  rows={members.map((member) => memberRow(member, locale, routeHref))}
                />
              ) : (
                <EmptyState title={pick(locale, governanceCopy.noMembers)} />
              )}
            </Surface>
          );
        })
      )}
    </div>
  );
}

function memberRow(row: CockpitWork, locale: TcrnLocale, routeHref: (path: string) => string): WorkItemRowProps {
  return {
    id: row.externalKey ?? row.id,
    title: workTitle(row) ?? (row.externalKey ?? row.id),
    state: { state: row.status === "done" ? "ready" : "review_required" },
    owner: row.kind,
    href: routeHref(`/work-items/${row.externalKey ?? row.id}`),
    fields: [{
      key: "status",
      label: pick(locale, governanceCopy.status),
      value: chainStatusLabel(row.status, locale)
    }]
  };
}

/**
 * Audit — the checks that only an outside reader can perform.
 *
 * A chain records faithfully; it cannot notice that its own timestamps are
 * implausible. These views exist because a long agent-authored chain needs a
 * reader that is not the author, and the shapes here are the ones that caught a
 * real anomaly on this platform.
 */
export function AuditView({ locale, routeHref }: ViewProps) {
  const byPartition = cockpitData.partitions.map((partition) => {
    const work = cockpitData.work.filter((row) => row.partitionId === partition.id);
    const named = work.filter((row) => row.externalKey !== null).length;
    const annotated = work.filter((row) => row.scope !== null).length;
    const ruled = work.filter((row) => row.decidedBy.length > 0).length;
    return { partition, total: work.length, named, annotated, ruled };
  });

  return (
    <div className="tcrn-aos-view" data-cockpit-view="audit">
      <Surface className="tcrn-aos-band">
        <Heading level={1} visualLevel={2}>{pick(locale, governanceCopy.audit)}</Heading>
        <Text>{pick(locale, governanceCopy.auditBody)}</Text>
      </Surface>

      <Surface className="tcrn-aos-band">
        <Heading level={2} visualLevel={3}>{pick(locale, governanceCopy.completeness)}</Heading>
        <Text>{pick(locale, governanceCopy.completenessBody)}</Text>
        {byPartition.map(({ partition, total, named, annotated, ruled }) => (
          <div key={partition.id} data-audit-partition={partition.id}>
            <Heading level={3} visualLevel={3}>{partitionDisplayName(partition, locale)}</Heading>
            <KeyValueList
              items={[
                { key: "total", label: pick(locale, governanceCopy.workRecords), value: String(total) },
                { key: "named", label: pick(locale, governanceCopy.keysRecovered), value: `${named} / ${total}` },
                { key: "annotated", label: pick(locale, governanceCopy.withScope), value: `${annotated} / ${total}` },
                { key: "ruled", label: pick(locale, governanceCopy.withRuling), value: `${ruled} / ${total}` },
                {
                  key: "version",
                  label: pick(locale, governanceCopy.chainVersion),
                  value: `v${partition.chainVersion}`
                }
              ]}
            />
          </div>
        ))}
      </Surface>

      <Surface className="tcrn-aos-band">
        <Heading level={2} visualLevel={3}>{pick(locale, governanceCopy.effectiveOpen)}</Heading>
        <Text>{pick(locale, governanceCopy.effectiveOpenBody)}</Text>
        {cockpitData.effectiveUnresolved.length === 0 ? (
          <EmptyState title={pick(locale, governanceCopy.noEffectiveOpen)} />
        ) : (
          cockpitData.effectiveUnresolved.map((entry) => (
            <div key={entry.minutesId} data-audit-unresolved={entry.externalKey ?? entry.minutesId}>
              {/* This screen lists ninety-seven open issues and named each one by a
                  bare minutes token, which is the worst place in the product for
                  INC-018 to have survived: an audit reader's next move is always to
                  go read the ruling. All ninety-seven resolve to a conference, so
                  `minutesLink` returns an href for every one of them here — but the
                  helper still decides that per entry rather than this view assuming
                  it, because the projection's coverage is a fact about the export
                  ceiling and can change without this file changing. */}
              <MachineTokenCell
                token={entry.externalKey ?? entry.minutesId}
                kind="generic"
                copyable={false}
                {...hrefAttr(minutesLink(entry.minutesId, routeHref))}
              />
              <Text>
                {format(
                  locale,
                  surfaceToEffective,
                  entry.surface.length,
                  entry.effective.length,
                  entry.dissolvedCount
                )}
              </Text>
              <ul>
                {entry.effective.map((issue, index) => <li key={index}>{issue}</li>)}
              </ul>
            </div>
          ))
        )}
      </Surface>

      <InlineAlert tone="neutral" data-cockpit-notice="audit-scope">
        {pick(locale, governanceCopy.auditScope)}
      </InlineAlert>
    </div>
  );
}

/**
 * Snapshot health — whether each chain has a verified backup, and how recent.
 *
 * Backups are the one governance activity with no in-chain record of its own, so
 * this view reports what it can observe and says plainly what it cannot.
 */
export function SnapshotHealthView({ locale }: ViewProps) {
  return (
    <div className="tcrn-aos-view" data-cockpit-view="snapshots">
      <Surface className="tcrn-aos-band">
        <Heading level={1} visualLevel={2}>{pick(locale, governanceCopy.snapshotHealth)}</Heading>
        <Text>{pick(locale, governanceCopy.snapshotHealthBody)}</Text>
      </Surface>
      <InlineAlert tone="warning" data-cockpit-notice="not-yet-observed">
        {pick(locale, governanceCopy.snapshotNotIngested)}
      </InlineAlert>
      <Surface className="tcrn-aos-band">
        <KeyValueList
          items={cockpitData.partitions.map((partition) => ({
            key: partition.id,
            label: partitionDisplayName(partition, locale),
            value: pick(locale, governanceCopy.notObserved)
          }))}
        />
      </Surface>
    </div>
  );
}
