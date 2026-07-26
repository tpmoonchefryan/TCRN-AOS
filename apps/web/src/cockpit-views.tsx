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
import { workTitle, type CockpitInboxItem, type CockpitPartition, type CockpitWork } from "./cockpit-types.js";

interface ViewProps {
  locale: TcrnLocale;
  routeHref: (path: string) => string;
}

/** Chain status to the state vocabulary the design system's badges speak. */
function statusState(status: string): { state: string } {
  switch (status) {
    case "done": return { state: "ready" };
    case "active": return { state: "review_required" };
    case "blocked": return { state: "blocked" };
    case "cancelled": return { state: "not_claimed" };
    case "ready": return { state: "local_only" };
    default: return { state: "not_claimed" };
  }
}

function partitionLabel(partition: CockpitPartition | undefined, locale: TcrnLocale): string {
  if (!partition) return "—";
  return locale === "zh-CN" ? partition.labelZh : partition.label;
}

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
      <Text>{partitionLabel(partition, locale)}</Text>
    </span>
  );
}

/**
 * Sections a partition could not supply, stated plainly.
 *
 * Two chains exceed the read surface's export ceiling, so their deliberation
 * threads are not read at all. Saying so is the whole point: an unread section
 * and an empty one render identically unless the view refuses to conflate them.
 */
function UnavailableNotice({ locale }: { locale: TcrnLocale }) {
  const isZh = locale === "zh-CN";
  const affected = cockpitData.partitions.filter((entry) => entry.unavailable.length > 0);
  if (affected.length === 0) return null;
  return (
    <InlineAlert tone="warning" data-cockpit-notice="partial-projection">
      {isZh
        ? `以下项目的立场与纪要未读取（链体量超出读面上限）：${affected.map((entry) => entry.labelZh).join("、")}。此处显示为未取，而非为空。`
        : `Positions and minutes were not read for ${affected.map((entry) => entry.label).join(", ")} — those chains exceed the read surface ceiling. Shown as not read, not as empty.`}
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
  const isZh = locale === "zh-CN";
  const active = cockpitData.work.filter((row) => row.status === "active");
  const blocked = cockpitData.work.filter((row) => row.status === "blocked");
  const done = cockpitData.work.filter((row) => row.status === "done");

  return (
    <div className="tcrn-aos-view" data-cockpit-view="my-work">
      <WorkPageHeader
        title={isZh ? "我的工作" : "My work"}
        description={isZh
          ? `跨 ${cockpitData.partitions.length} 个项目 · ${cockpitData.work.length} 条工作记录 · 各项目新鲜度见每行徽记`
          : `Across ${cockpitData.partitions.length} projects, ${cockpitData.work.length} work records; per-row badges carry each project's freshness.`}
        meta={[
          <Badge key="inbox" tone={cockpitData.inbox.some((item) => item.severity === "owner-intent") ? "warning" : "neutral"}>
            {isZh ? `${cockpitData.inbox.length} 项等你决定` : `${cockpitData.inbox.length} awaiting you`}
          </Badge>
        ]}
      />
      <UnavailableNotice locale={locale} />

      <Band
        title={isZh ? "等你决定" : "Awaiting you"}
        empty={isZh ? "没有等待决定的项。" : "Nothing is waiting on a decision."}
        locale={locale}
        rows={cockpitData.inbox.map((item) => inboxRow(item, locale, routeHref))}
      />
      <Band
        title={isZh ? "进行中" : "In progress"}
        empty={isZh ? "没有进行中的工作项。" : "No work items are in progress."}
        locale={locale}
        rows={active.map((row) => workRow(row, locale, routeHref))}
      />
      {blocked.length > 0 ? (
        <Band
          title={isZh ? "阻塞" : "Blocked"}
          empty=""
          locale={locale}
          rows={blocked.map((row) => workRow(row, locale, routeHref))}
        />
      ) : null}
      <Band
        title={isZh ? `已完成（${done.length}）` : `Completed (${done.length})`}
        empty={isZh ? "尚无已完成项。" : "Nothing completed yet."}
        locale={locale}
        rows={done.slice(0, 12).map((row) => workRow(row, locale, routeHref))}
      />
    </div>
  );
}

function Band({
  title,
  empty,
  rows,
  locale
}: { title: string; empty: string; rows: WorkItemRowProps[]; locale: TcrnLocale }) {
  return (
    <Surface className="tcrn-aos-band">
      <Heading level={2} visualLevel={3}>{title}</Heading>
      {rows.length > 0
        ? <WorkList rows={rows} label={title} />
        : empty ? <EmptyState title={empty} /> : null}
    </Surface>
  );
}

function inboxRow(item: CockpitInboxItem, locale: TcrnLocale, routeHref: (path: string) => string): WorkItemRowProps {
  const isZh = locale === "zh-CN";
  const kindLabel = item.kind === "gate"
    ? (isZh ? "审批门" : "Approval gate")
    : item.kind === "conference"
      ? (isZh ? "审议" : "Deliberation")
      : (isZh ? "未决项" : "Open issues");
  return {
    id: item.externalKey ?? item.recordId,
    title: item.title,
    // Owner-intent items are the ones the engine will not clear without the
    // named actor, so they read as blocked rather than merely needing review.
    state: { state: item.severity === "owner-intent" ? "blocked" : "review_required" },
    owner: item.severity === "owner-intent" ? "owner:governance" : kindLabel,
    href: routeHref(`/work-items/${item.externalKey ?? item.recordId}`),
    fields: [
      { key: "kind", label: isZh ? "类型" : "Kind", value: kindLabel },
      { key: "detail", label: isZh ? "说明" : "Detail", value: item.detail },
      { key: "asof", label: isZh ? "数据截至" : "As of", value: <AsOfChip partitionId={item.partitionId} locale={locale} /> }
    ]
  };
}

function workRow(row: CockpitWork, locale: TcrnLocale, routeHref: (path: string) => string): WorkItemRowProps {
  const isZh = locale === "zh-CN";
  const title = workTitle(row);
  return {
    id: row.externalKey ?? row.id,
    // A record with no scope annotation has no title; showing its key is honest,
    // inventing prose for it would not be.
    title: title ?? (row.externalKey ?? row.id),
    state: statusState(row.status) as never,
    owner: row.kind,
    href: routeHref(`/work-items/${row.externalKey ?? row.id}`),
    fields: [
      { key: "status", label: isZh ? "状态" : "Status", value: row.status },
      ...(row.sprintWorkId
        ? [{ key: "train", label: isZh ? "发布列车" : "Release train", value: isZh ? "已入列" : "enrolled" }]
        : []),
      { key: "asof", label: isZh ? "数据截至" : "As of", value: <AsOfChip partitionId={row.partitionId} locale={locale} /> }
    ]
  };
}

/** Projects — one card per governed chain, each with its own version. */
export function ProjectsView({ locale, routeHref }: ViewProps) {
  const isZh = locale === "zh-CN";
  return (
    <div className="tcrn-aos-view" data-cockpit-view="projects">
      <WorkPageHeader
        title={isZh ? "项目" : "Projects"}
        description={isZh
          ? "每个受治分区是一个项目,各自持有独立的链与版本。"
          : "Each governed partition is a project holding its own chain and version."}
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
              <Heading level={2} visualLevel={3}>{partitionLabel(partition, locale)}</Heading>
              <div className="tcrn-aos-project-card__meta">
                <MachineTokenCell token={`v${partition.chainVersion}`} kind="generic" copyable={false} />
                <Text>{isZh ? `验证于 ${partition.verifiedAt}` : `verified ${partition.verifiedAt}`}</Text>
              </div>
              <dl className="tcrn-aos-stats">
                <Stat label={isZh ? "工作记录" : "Work records"} value={work.length} />
                <Stat label={isZh ? "Initiative" : "Initiatives"} value={work.filter((row) => row.kind === "Initiative").length} />
                <Stat label={isZh ? "待批门" : "Pending gates"} value={pendingGates.length} />
                <Stat label={isZh ? "进行中审议" : "Open deliberations"} value={openConferences.length} />
              </dl>
              <a className="tcrn-aos-project-card__link" href={routeHref(`/work-items?project=${partition.id}`)}>
                {isZh ? "查看工作项 →" : "View work items →"}
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
