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
import { workTitle, type CockpitWork } from "./cockpit-types.js";

interface ViewProps {
  locale: TcrnLocale;
  routeHref: (path: string) => string;
}

/**
 * Release trains — batches of Initiatives that ship together.
 *
 * A train has no time box and no burndown, because the engine has no clock and
 * the batch is defined by membership rather than by a date. Departure is the
 * single publish stop, which is why the view names it rather than offering it as
 * a button.
 */
export function ReleaseTrainsView({ locale, routeHref }: ViewProps) {
  const isZh = locale === "zh-CN";
  const trains = cockpitData.work.filter((row) => row.kind === "Release");

  return (
    <div className="tcrn-aos-view" data-cockpit-view="release-trains">
      <Surface className="tcrn-aos-band">
        <Heading level={1} visualLevel={2}>{isZh ? "发布列车" : "Release trains"}</Heading>
        <Text>
          {isZh
            ? "一批 Initiative 打包发布。没有时间盒——引擎没有时钟,列车由成员定义而非由日期定义;发车是唯一的发布停点。"
            : "A batch of Initiatives that ships together. No time box: the engine has no clock, and a train is defined by its members rather than by a date. Departure is the single publish stop."}
        </Text>
      </Surface>

      {trains.length === 0 ? (
        <EmptyState title={isZh ? "尚无发布列车。" : "No release train has been formed yet."} />
      ) : (
        trains.map((train) => {
          const members = cockpitData.work.filter((row) => row.sprintWorkId === train.id);
          return (
            <Surface key={train.id} className="tcrn-aos-band" data-train-key={train.externalKey ?? train.id}>
              <div className="tcrn-aos-detail-head__meta">
                <MachineTokenCell token={train.externalKey ?? train.id} kind="work-item" copyable={false} />
                <Badge tone={train.status === "done" ? "neutral" : "warning"}>
                  {train.status === "done"
                    ? (isZh ? "已发车" : "departed")
                    : (isZh ? "编组中" : "forming")}
                </Badge>
              </div>
              <Heading level={2} visualLevel={3}>
                {workTitle(train) ?? (train.externalKey ?? train.id)}
              </Heading>
              {members.length > 0 ? (
                <WorkList
                  label={isZh ? "成员" : "Members"}
                  rows={members.map((member) => memberRow(member, locale, routeHref))}
                />
              ) : (
                <EmptyState title={isZh ? "该列车没有登记成员。" : "No member is enrolled on this train."} />
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
    fields: [{ key: "status", label: locale === "zh-CN" ? "状态" : "Status", value: row.status }]
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
export function AuditView({ locale }: ViewProps) {
  const isZh = locale === "zh-CN";

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
        <Heading level={1} visualLevel={2}>{isZh ? "审计视图" : "Audit"}</Heading>
        <Text>
          {isZh
            ? "链忠实记录,但记录不会告诉你它自己不合理。这里做的是外部读者才能做的检查。"
            : "A chain records faithfully; it cannot tell you when its own record is implausible. These are the checks only an outside reader can make."}
        </Text>
      </Surface>

      <Surface className="tcrn-aos-band">
        <Heading level={2} visualLevel={3}>{isZh ? "记录完整性" : "Record completeness"}</Heading>
        <Text>
          {isZh
            ? "未命名记录不是缺陷——它们的键不合命名公约,故此处如实留空而非编造。"
            : "Unnamed records are not a defect: their keys do not follow the naming convention, so they are left blank rather than invented."}
        </Text>
        {byPartition.map(({ partition, total, named, annotated, ruled }) => (
          <div key={partition.id} data-audit-partition={partition.id}>
            <Heading level={3} visualLevel={3}>
              {isZh ? partition.labelZh : partition.label}
            </Heading>
            <KeyValueList
              items={[
                { key: "total", label: isZh ? "工作记录" : "Work records", value: String(total) },
                { key: "named", label: isZh ? "已恢复键号" : "Keys recovered", value: `${named} / ${total}` },
                { key: "annotated", label: isZh ? "带范围注解" : "With scope", value: `${annotated} / ${total}` },
                { key: "ruled", label: isZh ? "带裁定源" : "With a ruling", value: `${ruled} / ${total}` },
                { key: "version", label: isZh ? "链版本" : "Chain version", value: `v${partition.chainVersion}` }
              ]}
            />
          </div>
        ))}
      </Surface>

      <Surface className="tcrn-aos-band">
        <Heading level={2} visualLevel={3}>{isZh ? "未决项净值" : "Effective open issues"}</Heading>
        <Text>
          {isZh
            ? "纪要的未决项不可变,消解靠后续纪要——裸读会高估未决量。"
            : "Recorded open issues are immutable and are settled by later minutes, so reading the field raw overstates what is actually open."}
        </Text>
        {cockpitData.effectiveUnresolved.length === 0 ? (
          <EmptyState title={isZh ? "没有仍然有效的未决项。" : "No open issue remains effective."} />
        ) : (
          cockpitData.effectiveUnresolved.map((entry) => (
            <div key={entry.minutesId} data-audit-unresolved={entry.externalKey ?? entry.minutesId}>
              <MachineTokenCell token={entry.externalKey ?? entry.minutesId} kind="generic" copyable={false} />
              <Text>
                {isZh
                  ? `表面 ${entry.surface.length} 条 → 有效 ${entry.effective.length} 条（已消解 ${entry.dissolvedCount}）`
                  : `${entry.surface.length} recorded → ${entry.effective.length} effective (${entry.dissolvedCount} settled)`}
              </Text>
              <ul>
                {entry.effective.map((issue, index) => <li key={index}>{issue}</li>)}
              </ul>
            </div>
          ))
        )}
      </Surface>

      <InlineAlert tone="neutral" data-cockpit-notice="audit-scope">
        {isZh
          ? "时间戳形状检查(整分边界聚集、段落盘时间对照)待事件级读面接入后加入;当前审计面基于记录而非事件。"
          : "Timestamp-shape checks need event-level reads, which the current surface does not provide; this audit works from records rather than events."}
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
  const isZh = locale === "zh-CN";
  return (
    <div className="tcrn-aos-view" data-cockpit-view="snapshots">
      <Surface className="tcrn-aos-band">
        <Heading level={1} visualLevel={2}>{isZh ? "快照健康" : "Snapshot health"}</Heading>
        <Text>
          {isZh
            ? "每个分区最后一次通过验证的快照,以及备份节奏是否被遵守。"
            : "The last verified snapshot per partition, and whether the backup cadence was honoured."}
        </Text>
      </Surface>
      <InlineAlert tone="warning" data-cockpit-notice="not-yet-observed">
        {isZh
          ? "快照收据尚未接入投影:快照是链外产物,需读取备份目录的清单而非链本身。此处如实显示为未观测,而不是显示为健康。"
          : "Snapshot receipts are not yet ingested: snapshots live outside the chain, so this needs the backup directory's manifests rather than the chain itself. Shown as not observed rather than as healthy."}
      </InlineAlert>
      <Surface className="tcrn-aos-band">
        <KeyValueList
          items={cockpitData.partitions.map((partition) => ({
            key: partition.id,
            label: isZh ? partition.labelZh : partition.label,
            value: isZh ? "未观测" : "not observed"
          }))}
        />
      </Surface>
    </div>
  );
}
