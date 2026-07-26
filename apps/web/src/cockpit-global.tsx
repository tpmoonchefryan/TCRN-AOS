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
import type { CockpitInboxItem, CockpitPartition } from "./cockpit-types.js";

interface ViewProps {
  locale: TcrnLocale;
  routeHref: (path: string) => string;
}

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
  const isZh = locale === "zh-CN";
  const gates = cockpitData.inbox.filter((item) => item.kind === "gate");
  const conferences = cockpitData.inbox.filter((item) => item.kind === "conference");
  const unresolved = cockpitData.inbox.filter((item) => item.kind === "unresolved");
  const ownerIntent = gates.filter((item) => item.severity === "owner-intent");
  const unread = cockpitData.partitions.filter((entry) => entry.unavailable.length > 0);

  return (
    <div className="tcrn-aos-view" data-cockpit-view="inbox">
      <WorkPageHeader
        title={isZh ? "收件箱" : "Inbox"}
        description={isZh
          ? `${cockpitData.inbox.length} 项待决 · 跨全部项目 · 按义务性质分带,不按项目分带`
          : `${cockpitData.inbox.length} awaiting a decision, across every project, banded by the kind of obligation rather than by project.`}
        meta={[
          <Badge key="owner" tone={ownerIntent.length > 0 ? "warning" : "neutral"}>
            {isZh ? `${ownerIntent.length} 项须 Owner 裁定` : `${ownerIntent.length} need the Owner`}
          </Badge>
        ]}
      />

      {unread.length > 0 ? (
        // Two of the four chains cannot supply minutes through the fallback read
        // path, so their open issues cannot appear here. An inbox that looks
        // complete but is not is worse than one that says where it stops: the
        // whole value of this screen is being able to trust "nothing left".
        <InlineAlert tone="warning" data-cockpit-notice="inbox-coverage">
          {isZh
            ? `覆盖不全:${unread.map((entry) => entry.labelZh).join("、")} 的纪要未读取,其未决项不在此列。此处的「已清空」只对已读取的链成立。`
            : `Partial coverage: minutes were not read for ${unread.map((entry) => entry.label).join(", ")}, so their open issues cannot appear here. "Nothing left" holds only for the chains that were read.`}
        </InlineAlert>
      ) : null}

      <InboxBand
        title={isZh ? `审批门（${gates.length}）` : `Approval gates (${gates.length})`}
        note={isZh
          ? "门是引擎的硬停:owner_intent_required 的门在具名裁定到达前不会放行。"
          : "A gate is the engine's hard stop: an owner_intent_required gate does not clear until the named actor rules."}
        empty={isZh ? "没有待批的门。" : "No gate is pending."}
        items={gates}
        locale={locale}
        routeHref={routeHref}
      />
      <InboxBand
        title={isZh ? `进行中的审议（${conferences.length}）` : `Open deliberations (${conferences.length})`}
        note={isZh
          ? "仍在收集立场;闭会才产出纪要与决策。"
          : "Still collecting positions; minutes and decisions come at close."}
        empty={isZh ? "没有进行中的审议。" : "No deliberation is open."}
        items={conferences}
        locale={locale}
        routeHref={routeHref}
      />
      <InboxBand
        title={isZh ? `未决项（${unresolved.length}）` : `Open issues (${unresolved.length})`}
        note={isZh
          ? "纪要里的未决项不可改;只有后续纪要能消解它。此处已扣除被消解的部分,是净值。"
          : "Open issues in minutes are immutable; only later minutes settle them. What is counted here is the net figure, with settled ones already removed."}
        empty={isZh ? "没有未消解的未决项。" : "No open issue is still live."}
        items={unresolved}
        locale={locale}
        routeHref={routeHref}
      />
    </div>
  );
}

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
  const isZh = locale === "zh-CN";
  return (
    <Surface className="tcrn-aos-band">
      <Heading level={2} visualLevel={3}>{title}</Heading>
      <Text>{note}</Text>
      {items.length === 0 ? <EmptyState title={empty} /> : (
        <WorkList
          label={title}
          rows={items.map((item): WorkItemRowProps => ({
            id: item.externalKey ?? item.recordId,
            title: item.title,
            state: (item.severity === "owner-intent"
              ? { state: "blocked", label: isZh ? "等你裁定" : "awaiting owner" }
              : { state: "review_required", label: isZh ? "待处理" : "attention" }) as never,
            owner: item.severity === "owner-intent" ? "owner:governance" : item.detail,
            // A deliberation opens in the room; anything else opens where it is
            // decided. Sending every row to the same place would make the list
            // one click longer for the items that matter most.
            href: item.kind === "conference"
              ? routeHref(`/deliberations/${item.externalKey ?? item.recordId}`)
              : routeHref(`/work-items?project=${item.partitionId}`),
            fields: [
              { key: "detail", label: isZh ? "说明" : "Detail", value: item.detail },
              {
                key: "project",
                label: isZh ? "项目" : "Project",
                value: partitionLabel(findPartition(item.partitionId), locale)
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
  const isZh = locale === "zh-CN";
  const statuses = ["planned", "ready", "active", "blocked", "done"] as const;

  return (
    <div className="tcrn-aos-view" data-cockpit-view="dashboard">
      <WorkPageHeader
        title={isZh ? "仪表盘" : "Dashboard"}
        description={isZh
          ? `四条受治链的当前状态 · ${cockpitData.work.length} 条工作记录 · 每个数字都注明它取自哪个链版本`
          : `Current state of four governed chains, ${cockpitData.work.length} work records, every figure carrying the chain version it was read at.`}
      />

      <Surface className="tcrn-aos-band">
        <Heading level={2} visualLevel={3}>{isZh ? "按状态" : "By status"}</Heading>
        <dl className="tcrn-aos-stats">
          {statuses.map((status) => (
            <div key={status} className="tcrn-aos-stat">
              <dt>{status}</dt>
              <dd>{cockpitData.work.filter((row) => row.status === status).length}</dd>
            </div>
          ))}
        </dl>
      </Surface>

      <Surface className="tcrn-aos-band">
        <Heading level={2} visualLevel={3}>{isZh ? "逐链" : "Per chain"}</Heading>
        <div className="tcrn-aos-project-grid">
          {cockpitData.partitions.map((partition) => {
            const work = cockpitData.work.filter((row) => row.partitionId === partition.id);
            const pending = cockpitData.gates.filter(
              (gate) => gate.partitionId === partition.id && gate.status === "pending");
            const open = cockpitData.conferences.filter(
              (conference) => conference.partitionId === partition.id && conference.status === "open");
            return (
              <Surface key={partition.id} className="tcrn-aos-project-card" data-partition-id={partition.id}>
                <Heading level={3} visualLevel={3}>{partitionLabel(partition, locale)}</Heading>
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
                    {partition.readVia === "export"
                      ? (isZh ? "全量读取" : "read in full")
                      : partition.readVia === "paginated-with-deliberations"
                        ? (isZh ? "分页读取 · 含审议" : "paginated, with deliberations")
                        : (isZh ? "降级分页读取" : "paginated fallback")}
                  </Badge>
                  {/* Only a chain read in full can answer this. The fallback
                      path cannot reach the event log at all, so its null means
                      "not read" — reporting that as "no actor recorded" would
                      state a fact about the chain that this projection never
                      looked at. */}
                  <Badge tone="neutral">
                    {partition.readVia !== "export"
                      ? (isZh ? "执行者归属未读取" : "attribution not read")
                      : partition.attestationFromSequence === null
                        ? (isZh ? "未记执行者" : "no actor recorded")
                        : (isZh
                          ? `执行者自 #${partition.attestationFromSequence} 起`
                          : `actor from #${partition.attestationFromSequence}`)}
                  </Badge>
                </div>
                <dl className="tcrn-aos-stats">
                  <Stat label={isZh ? "工作记录" : "Work"} value={work.length} />
                  <Stat label={isZh ? "进行中" : "Active"} value={work.filter((row) => row.status === "active").length} />
                  <Stat label={isZh ? "待批门" : "Pending gates"} value={pending.length} />
                  <Stat label={isZh ? "进行中审议" : "Open deliberations"} value={open.length} />
                </dl>
                <a className="tcrn-aos-project-card__link" href={routeHref(`/board?project=${partition.id}`)}>
                  {isZh ? "查看看板 →" : "Open board →"}
                </a>
              </Surface>
            );
          })}
        </div>
      </Surface>

      <Surface className="tcrn-aos-band" data-dashboard-panel="absent-by-design">
        <Heading level={2} visualLevel={3}>
          {isZh ? "这里没有燃尽图,是设计决定" : "There is no burndown here, by design"}
        </Heading>
        <Text>
          {isZh
            ? "发布列车不带时间盒:它是一次发布的成员清单,不是一个两周窗口。没有 sprint 结束日,燃尽、速度与周期时间就没有可测的终点,画出来的任何曲线都在度量一个不存在的期限。列车的进度以「成员是否全部就绪」呈现,见发布列车页。"
            : "A release train carries no time-box: it is the membership list of one release, not a two-week window. With no sprint end there is no endpoint for burndown, velocity, or cycle time, and any curve drawn here would be measuring a deadline that does not exist. Train progress is shown as whether its members are all ready — see the release trains page."}
        </Text>
        <a className="tcrn-aos-project-card__link" href={routeHref("/release-trains")}>
          {isZh ? "查看发布列车 →" : "Open release trains →"}
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

function partitionLabel(partition: CockpitPartition | undefined, locale: TcrnLocale): string {
  if (!partition) return "—";
  return locale === "zh-CN" ? partition.labelZh : partition.label;
}
