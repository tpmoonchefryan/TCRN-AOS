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
  WorkList,
  type WorkItemRowProps
} from "@tcrn/ui-react";
import type { TcrnLocale } from "@tcrn/ui-copy-state";

import { cockpitData } from "./cockpit-data.generated.js";
import { workTitle, type CockpitWork } from "./cockpit-types.js";

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
  const isZh = locale === "zh-CN";
  const item = cockpitData.work.find(
    (row) => row.externalKey === itemKey || row.id === itemKey);

  if (!item) {
    return (
      <div className="tcrn-aos-view" data-cockpit-view="work-item-detail">
        <EmptyState title={isZh ? `未找到工作项 ${itemKey}` : `No work item ${itemKey}`} />
      </div>
    );
  }

  const partition = cockpitData.partitions.find((entry) => entry.id === item.partitionId);
  const ancestors = ancestryOf(item);
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
    { key: "kind", label: isZh ? "类型" : "Kind", value: item.kind },
    { key: "status", label: isZh ? "状态" : "Status", value: item.status },
    {
      key: "parent",
      label: isZh ? "父级" : "Parent",
      value: ancestors.length > 0
        ? (ancestors[ancestors.length - 1]?.externalKey ?? "—")
        : (isZh ? "无（树根）" : "none (root)")
    },
    {
      key: "train",
      label: isZh ? "发布列车" : "Release train",
      value: train?.externalKey ?? (isZh ? "未入列" : "not enrolled")
    },
    {
      key: "decided-by",
      label: isZh ? "裁定源" : "Decided by",
      value: item.decidedBy.length > 0 ? item.decidedBy.join(", ") : "—"
    },
    { key: "revision", label: isZh ? "修订" : "Revision", value: String(item.id) }
  ];

  // Operational fields the cockpit will own once the AOS domain lands. They are
  // listed now, empty and marked, because a field that exists but is unset reads
  // differently from a field the product does not have — and only one of those
  // is true here.
  const operationalFields = [
    { key: "assignee", label: isZh ? "负责人" : "Assignee", value: isZh ? "未指派" : "unassigned" },
    { key: "priority", label: isZh ? "优先级" : "Priority", value: "—" },
    { key: "labels", label: isZh ? "标签" : "Labels", value: "—" },
    { key: "due", label: isZh ? "截止日" : "Due date", value: "—" }
  ];

  return (
    <div className="tcrn-aos-view" data-cockpit-view="work-item-detail" data-work-item-key={item.externalKey ?? item.id}>
      <Breadcrumb
        items={[
          { id: "project", label: partition ? (isZh ? partition.labelZh : partition.label) : item.partitionId },
          ...ancestors.map((ancestor) => ({
            id: ancestor.id,
            label: ancestor.externalKey ?? ancestor.id
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
            <Heading level={2} visualLevel={3}>{isZh ? "字段" : "Fields"}</Heading>
            <div data-field-origin="chain">
              <Text>{isZh ? "链上字段 · 不可编辑" : "Chain fields, not editable"}</Text>
              <KeyValueList items={chainFields} />
            </div>
            <div data-field-origin="aos-domain">
              <Text>{isZh ? "AOS 域字段 · 可编辑（待 STORY-003 落地）" : "AOS domain fields, editable (pending STORY-003)"}</Text>
              <KeyValueList items={operationalFields} />
            </div>
          </Surface>

          <Surface className="tcrn-aos-band">
            <Heading level={2} visualLevel={3}>{isZh ? "范围" : "Scope"}</Heading>
            {item.scope
              ? <Text>{item.scope}</Text>
              : <EmptyState title={isZh ? "该记录没有范围注解——链上确实没有标题。" : "No scope annotation; the chain genuinely holds no title for this record."} />}
          </Surface>

          <Surface className="tcrn-aos-band">
            <Heading level={2} visualLevel={3}>{isZh ? `子项（${children.length}）` : `Children (${children.length})`}</Heading>
            {children.length > 0
              ? <WorkList label={isZh ? "子项" : "Children"} rows={children.map((child) => childRow(child, locale, routeHref))} />
              : <EmptyState title={isZh ? "无子项。Subtask 按公约在开工时切分,不预造。" : "No children. Subtasks are cut when work starts, never pre-created."} />}
          </Surface>
        </div>

        <div className="tcrn-aos-detail-side">
          <Surface className="tcrn-aos-band" data-detail-panel="governance">
            <Heading level={2} visualLevel={3}>{isZh ? "决策与证据" : "Decisions and evidence"}</Heading>
            {gates.length === 0 && conferences.length === 0 && item.decidedBy.length === 0 ? (
              <EmptyState title={isZh ? "该工作项尚无门、审议或裁定源。" : "No gate, deliberation, or ruling is attached yet."} />
            ) : (
              <>
                {item.decidedBy.length > 0 ? (
                  <div data-governance-link="decided-by">
                    <Text>{isZh ? "裁定源" : "Decided by"}</Text>
                    {item.decidedBy.map((minutesId) => (
                      <MachineTokenCell key={minutesId} token={minutesId} kind="generic" copyable={false} />
                    ))}
                  </div>
                ) : null}
                {gates.map((gate) => (
                  <div key={gate.id} data-governance-link="gate">
                    <Badge tone={gate.status === "pending" ? "warning" : "neutral"}>
                      {gate.outcomeClass}
                    </Badge>
                    <Text>{gate.title ?? gate.externalKey ?? gate.id}</Text>
                  </div>
                ))}
                {conferences.map((conference) => (
                  <div key={conference.id} data-governance-link="conference">
                    <Badge tone={conference.status === "open" ? "warning" : "neutral"}>
                      {conference.status}
                    </Badge>
                    <Text>{conference.title ?? conference.externalKey ?? conference.id}</Text>
                  </div>
                ))}
              </>
            )}
          </Surface>

          {partition && partition.unavailable.length > 0 ? (
            <InlineAlert tone="warning" data-cockpit-notice="partial-projection">
              {isZh
                ? "该项目的立场与纪要未读取,决策详情不完整。"
                : "Positions and minutes were not read for this project, so decision detail is incomplete."}
            </InlineAlert>
          ) : null}
        </div>
      </div>
    </div>
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
  const isZh = locale === "zh-CN";
  return {
    id: row.externalKey ?? row.id,
    title: workTitle(row) ?? (row.externalKey ?? row.id),
    state: { state: row.status === "done" ? "ready" : row.status === "blocked" ? "blocked" : "review_required" },
    owner: row.kind,
    href: routeHref(`/work-items/${row.externalKey ?? row.id}`),
    fields: [{ key: "status", label: isZh ? "状态" : "Status", value: row.status }]
  };
}
