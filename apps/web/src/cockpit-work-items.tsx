import { useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Button,
  Checkbox,
  EmptyState,
  Heading,
  MachineTokenCell,
  SearchableList,
  SearchInput,
  Surface,
  Text,
  WorkItemRow,
  WorkManagementSubnav,
  WorkPageHeader,
  WorkSplitView
} from "@tcrn/ui-react";
import type { TcrnLocale } from "@tcrn/ui-copy-state";

import { cockpitData } from "./cockpit-data.generated.js";
import { chainStatusBadge, workTitle, type CockpitPartition, type CockpitWork } from "./cockpit-types.js";

/**
 * Work items — one searchable, filterable, selectable index over every ticket
 * on the platform.
 *
 * The chain stores Initiative, Epic, Story, Subtask, Incident and Release in one
 * record shape, so this is one page with `kind` as a facet rather than six
 * pages. Four things make it usable at 402 records: saved views, search,
 * a split pane, and batch selection.
 *
 * Saved views live in the URL rather than in local storage. A view a person
 * cannot bookmark, share, or send to the Owner in a message is not a saved view,
 * it is a preference — and the whole point of this page is that two people can
 * look at the same list.
 */
export function WorkItemsView({
  locale,
  routeHref,
  search
}: {
  locale: TcrnLocale;
  routeHref: (path: string) => string;
  search?: URLSearchParams;
}) {
  const isZh = locale === "zh-CN";
  const projectFilter = search?.get("project") ?? undefined;
  const kindFilter = search?.get("kind") ?? undefined;
  const statusFilter = search?.get("status") ?? undefined;
  const viewFilter = search?.get("view") ?? undefined;

  // Server-rendered state comes from the URL so a link lands on the same screen
  // its author was looking at; from there the client owns it.
  const [query, setQuery] = useState(search?.get("q") ?? "");
  const [selectedId, setSelectedId] = useState<string | null>(search?.get("selected") ?? null);
  const [batchMode, setBatchMode] = useState(false);
  const [checked, setChecked] = useState<ReadonlySet<string>>(() => new Set());

  const faceted = useMemo(() => cockpitData.work.filter((row) =>
    (!projectFilter || row.partitionId === projectFilter)
    && (!kindFilter || row.kind === kindFilter)
    && (!statusFilter || row.status === statusFilter)
    && matchesView(row, viewFilter)), [projectFilter, kindFilter, statusFilter, viewFilter]);

  const rows = useMemo(() => faceted.filter((row) => matchesQuery(row, query)), [faceted, query]);
  const selected = rows.find((row) => (row.externalKey ?? row.id) === selectedId)
    ?? cockpitData.work.find((row) => (row.externalKey ?? row.id) === selectedId);

  const facetHref = (name: string, value: string | undefined) =>
    routeHref(`/work-items${buildQuery({
      project: projectFilter, kind: kindFilter, status: statusFilter, view: viewFilter,
      q: query || undefined, [name]: value
    })}`);
  // What is currently narrowing the list, each removable on its own. The screen
  // previously offered only a global reset, so taking one condition off meant
  // rebuilding the rest by hand.
  const applied = [
    query ? {
      id: "q",
      label: isZh ? "检索" : "Search",
      value: `“${query}”`,
      removeHref: facetHref("q", undefined)
    } : null,
    kindFilter ? {
      id: "kind",
      label: isZh ? "类型" : "Kind",
      value: kindFilter,
      removeHref: facetHref("kind", undefined)
    } : null,
    statusFilter ? {
      id: "status",
      label: isZh ? "状态" : "Status",
      value: statusFilter,
      removeHref: facetHref("status", undefined)
    } : null,
    viewFilter ? {
      id: "view",
      label: isZh ? "视图" : "View",
      value: viewFilter,
      removeHref: facetHref("view", undefined)
    } : null
    // Project is absent by design: it is the shell's scope, not this page's
    // filter, and stating it here would say the same thing in two places.
  ].filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  const shown = rows.slice(0, 120);
  const checkedRows = rows.filter((row) => checked.has(row.id));

  return (
    <div className="tcrn-aos-view" data-cockpit-view="work-items">
      <WorkPageHeader
        title={isZh ? "工作项" : "Work items"}
        description={isZh
          ? `${rows.length} / ${cockpitData.work.length} 条 · 类型只是字段,不是另一个系统`
          : `${rows.length} of ${cockpitData.work.length}; kind is a field, not a separate system.`}
      />

      {/* Three layers, in the order a person uses them: which named view, then
          which conditions, then what is currently applied. The screen used to
          lay every option of every dimension out at once — six rows and about
          340px of chrome above a list of 400 records — which is an enumeration
          rather than a filter, and it grew by one more chip for every project or
          kind the platform gained. Project is deliberately absent: it is the
          shell's scope control, and one idea gets one control. */}
      <Surface className="tcrn-aos-filters">
        <WorkManagementSubnav
          label={isZh ? "保存视图" : "Saved views"}
          items={savedViews(locale, routeHref, viewFilter, statusFilter)}
        />

        <div className="tcrn-aos-toolbar">
          <div className="tcrn-aos-searchbar">
            <SearchInput
              aria-label={isZh ? "检索工作项" : "Search work items"}
              placeholder={isZh ? "检索工作项" : "Search work items"}
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              data-cockpit-search="work-items"
            />
            {/* Named for what it does. The projection store carries an FTS5 index
                with stemming and snippets, but it lives behind the ingestion
                process and this build has no API to reach it, so what runs here
                is a literal match over the projected text. Calling it "full-text
                search" would promise a query language it does not implement. */}
            <span
              className="tcrn-aos-searchbar__note"
              title={isZh
                ? "逐字匹配:多个词须全部命中。投影层的 FTS5 索引在摄取进程之后,此构建没有 API 通道,故不称全文搜索。"
                : "Literal match; every term must hit. The projection's FTS5 index sits behind the ingestion process with no API to reach it, so this is not called full-text search."}
            >
              {isZh ? "逐字" : "literal"}
            </span>
          </div>

          <FilterMenu
            label={isZh ? "类型" : "Kind"}
            allLabel={isZh ? "全部类型" : "All kinds"}
            value={kindFilter}
            options={["Initiative", "Epic", "Story", "Subtask", "Incident", "Release"]
              .map((kind) => ({
                id: kind,
                label: kind,
                count: faceted.filter((row) => row.kind === kind).length
              }))}
            hrefFor={(value) => facetHref("kind", value)}
            locale={locale}
          />
          <FilterMenu
            label={isZh ? "状态" : "Status"}
            allLabel={isZh ? "全部状态" : "All statuses"}
            value={statusFilter}
            options={["planned", "ready", "active", "blocked", "done"].map((status) => ({
              id: status,
              label: status,
              count: faceted.filter((row) => row.status === status).length
            }))}
            hrefFor={(value) => facetHref("status", value)}
            locale={locale}
          />

          <span className="tcrn-aos-toolbar__rule" aria-hidden="true" />
          <span className="tcrn-aos-count">
            <strong>{rows.length}</strong> / {cockpitData.work.length}
          </span>

          <span className="tcrn-aos-toolbar__spacer" />
          <Button
            type="button"
            variant={batchMode ? "primary" : "secondary"}
            size="sm"
            aria-pressed={batchMode}
            onClick={() => {
              setBatchMode(!batchMode);
              if (batchMode) setChecked(new Set());
            }}
            data-cockpit-batch-toggle="true"
          >
            {isZh ? "批量选择" : "Select multiple"}
          </Button>
        </div>

        {/* Only when something is applied. A default view owes no chrome, and a
            reset link with nothing to reset is noise that trains people to
            ignore the row it sits in. */}
        {applied.length > 0 ? (
          <div className="tcrn-aos-applied" data-cockpit-applied="true">
            <span className="tcrn-aos-applied__label">{isZh ? "已应用" : "Applied"}</span>
            {applied.map((entry) => (
              <a key={entry.id} className="tcrn-aos-chip" href={entry.removeHref}
                data-applied-filter={entry.id}>
                {entry.label} <b>{entry.value}</b>
                <span className="tcrn-aos-chip__x" aria-hidden="true">✕</span>
                <span className="tcrn-sr-only">{isZh ? "移除" : "Remove"}</span>
              </a>
            ))}
            <a className="tcrn-aos-reset" href={routeHref("/work-items")}>
              {isZh ? "重置视图" : "Reset view"}
            </a>
          </div>
        ) : null}
      </Surface>

      {batchMode ? (
        <BatchBar
          locale={locale}
          rows={checkedRows}
          onClear={() => setChecked(new Set())}
          onSelectAllShown={() => setChecked(new Set(shown.map((row) => row.id)))}
        />
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          title={isZh
            ? "当前筛选与检索没有匹配的工作项。"
            : "No work item matches the current filters and search."}
        />
      ) : (
        <div data-cockpit-split="work-items" data-has-selection={selected ? "true" : "false"}>
        <WorkSplitView
          label={isZh ? "工作项列表与详情" : "Work items list and preview"}
          list={
            <section
              className="tcrn-aos-picker"
              aria-label={isZh ? "工作项" : "Work items"}
              data-work-management-pattern="work-list"
            >
              {shown.map((row) => {
                const key = row.externalKey ?? row.id;
                return (
                  <div
                    key={row.id}
                    className="tcrn-aos-picker-row"
                    data-select-key={key}
                    data-selected={key === selectedId ? "true" : undefined}
                  >
                    {batchMode ? (
                      <Checkbox
                        aria-label={isZh ? `选择 ${key}` : `Select ${key}`}
                        checked={checked.has(row.id)}
                        onChange={(event) => {
                          const next = new Set(checked);
                          if (event.currentTarget.checked) next.add(row.id);
                          else next.delete(row.id);
                          setChecked(next);
                        }}
                      />
                    ) : null}
                    {/* The row stays a real link to this same page with the item
                        selected, so it works with scripting off and can be
                        copied out of the address bar. With scripting on the
                        click is intercepted and only the pane changes, which is
                        the same destination reached without the reload. */}
                    <a
                      className="tcrn-aos-picker-row__link"
                      href={routeHref(`/work-items/${key}`)}
                      aria-current={key === selectedId ? "true" : undefined}
                      onClick={(event) => {
                        if (event.metaKey || event.ctrlKey || event.shiftKey) return;
                        // Only hijack the click while the preview pane is on
                        // screen; below that width the pane is hidden and the
                        // honest behaviour is the link's own: open the detail.
                        if (typeof window !== "undefined"
                          && !window.matchMedia("(min-width: 1101px)").matches) return;
                        event.preventDefault();
                        setSelectedId(key);
                      }}
                    >
                      <WorkItemRow
                        id={key}
                        title={workTitle(row) ?? key}
                        state={chainStatusBadge(row.status) as never}
                        owner={row.kind}
                        selected={key === selectedId}
                        fields={[
                          { key: "status", label: isZh ? "状态" : "Status", value: row.status },
                          {
                            key: "project",
                            label: isZh ? "项目" : "Project",
                            value: partitionLabel(findPartition(row.partitionId), locale)
                          }
                        ]}
                      />
                    </a>
                  </div>
                );
              })}
              {rows.length > shown.length ? (
                <Text>
                  {isZh
                    ? `显示前 ${shown.length} 条,共 ${rows.length} 条,请继续收窄筛选。`
                    : `Showing the first ${shown.length} of ${rows.length}; narrow the filters to see the rest.`}
                </Text>
              ) : null}
            </section>
          }
          detail={<PreviewPane item={selected} locale={locale} routeHref={routeHref} />}
        />
        </div>
      )}
    </div>
  );
}

/**
 * The right half of the split: enough to decide whether to open the item.
 *
 * Deliberately a preview and not a second detail page. Duplicating the full
 * detail view here would mean two places to keep honest about which fields the
 * chain holds, and the one that gets forgotten is the one that starts lying.
 */
function PreviewPane({
  item,
  locale,
  routeHref
}: {
  item: CockpitWork | undefined;
  locale: TcrnLocale;
  routeHref: (path: string) => string;
}) {
  const isZh = locale === "zh-CN";
  if (!item) {
    return (
      <EmptyState
        title={isZh ? "选择左侧任一条以在此预览。" : "Pick a row on the left to preview it here."}
      />
    );
  }
  const key = item.externalKey ?? item.id;
  const partition = findPartition(item.partitionId);
  const children = cockpitData.work.filter(
    (row) => row.partitionId === item.partitionId && row.parentId === item.id);
  const gates = cockpitData.gates.filter(
    (gate) => gate.partitionId === item.partitionId && gate.workId === item.id);
  const conferences = cockpitData.conferences.filter(
    (conference) => conference.partitionId === item.partitionId
      && conference.workIds.includes(item.id));

  return (
    <div className="tcrn-aos-preview" data-preview-key={key}>
      <div className="tcrn-aos-detail-head__meta">
        <MachineTokenCell token={key} kind="work-item" copyable={false} />
        <Badge tone="neutral">{item.kind}</Badge>
        <Badge tone={item.status === "blocked" ? "warning" : "neutral"}>{item.status}</Badge>
        {partition ? (
          <MachineTokenCell token={`v${partition.chainVersion}`} kind="generic" copyable={false} />
        ) : null}
      </div>
      <Heading level={2} visualLevel={3}>{workTitle(item) ?? key}</Heading>
      {item.scope
        ? <Text className="tcrn-aos-prose">{item.scope.length > 700 ? `${item.scope.slice(0, 700)}…` : item.scope}</Text>
        : (
          <Text>
            {isZh
              ? "该记录没有范围注解——链上确实没有标题。"
              : "No scope annotation; the chain genuinely holds no title for this record."}
          </Text>
        )}
      <div className="tcrn-aos-preview__counts">
        <Badge tone="neutral">{isZh ? `子项 ${children.length}` : `${children.length} children`}</Badge>
        <Badge tone={gates.some((gate) => gate.status === "pending") ? "warning" : "neutral"}>
          {isZh ? `门 ${gates.length}` : `${gates.length} gates`}
        </Badge>
        <Badge tone="neutral">
          {isZh ? `审议 ${conferences.length}` : `${conferences.length} deliberations`}
        </Badge>
      </div>
      <div className="tcrn-aos-preview__actions">
        <a className="tcrn-aos-preview__open" href={routeHref(`/work-items/${key}`)}>
          {isZh ? "打开完整详情 →" : "Open full detail →"}
        </a>
        {conferences.length > 0 ? (
          <a
            className="tcrn-aos-preview__open"
            href={routeHref(`/deliberations/${conferences[0]?.externalKey ?? conferences[0]?.id}`)}
          >
            {isZh ? "进入审议室 →" : "Open deliberation room →"}
          </a>
        ) : null}
      </div>
    </div>
  );
}

/**
 * What batch selection can honestly do from a statically built cockpit.
 *
 * Copy and export are real because they are client-side. Bulk transition is
 * shown and disabled with its reason, because every chain write goes through the
 * governed write surface with operator authority and a compare-and-swap on the
 * head version — there is no write channel from this build at all. Hiding the
 * action would leave a person hunting for it; offering it and failing at the
 * click would be worse.
 */
function BatchBar({
  locale,
  rows,
  onClear,
  onSelectAllShown
}: {
  locale: TcrnLocale;
  rows: readonly CockpitWork[];
  onClear: () => void;
  onSelectAllShown: () => void;
}) {
  const isZh = locale === "zh-CN";
  const keys = rows.map((row) => row.externalKey ?? row.id);

  return (
    <Surface className="tcrn-aos-batchbar" data-cockpit-batch-bar="true">
      <Text>{isZh ? `已选 ${rows.length} 条` : `${rows.length} selected`}</Text>
      <Button type="button" variant="quiet" size="sm" onClick={onSelectAllShown}>
        {isZh ? "全选本页" : "Select all shown"}
      </Button>
      <Button type="button" variant="quiet" size="sm" onClick={onClear} disabled={rows.length === 0}
        disabledReason={isZh ? "尚未选中任何条目" : "Nothing is selected"}>
        {isZh ? "清空选择" : "Clear selection"}
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={rows.length === 0}
        disabledReason={isZh ? "尚未选中任何条目" : "Nothing is selected"}
        onClick={() => { void copyToClipboard(keys.join("\n")); }}
      >
        {isZh ? "复制键号" : "Copy keys"}
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={rows.length === 0}
        disabledReason={isZh ? "尚未选中任何条目" : "Nothing is selected"}
        onClick={() => downloadJson(rows)}
      >
        {isZh ? "导出 JSON" : "Export JSON"}
      </Button>
      <Button
        type="button"
        variant="primary"
        size="sm"
        disabled
        disabledReason={isZh
          ? "链写入须经安全写面:operator 供权 + 对链头的 expected-version 比对。此构建为静态投影,没有写通道。"
          : "Chain writes go through the safe write surface: operator authority plus a compare-and-swap against the chain head. This build is a static projection with no write channel."}
      >
        {isZh ? "批量流转状态" : "Bulk transition"}
      </Button>
    </Surface>
  );
}

async function copyToClipboard(text: string): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.clipboard) return;
  await navigator.clipboard.writeText(text);
}

function downloadJson(rows: readonly CockpitWork[]): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const payload = JSON.stringify({
    // Stamped so an exported file can be told apart from a later one, and so a
    // reader knows which chain versions it reflects rather than assuming "now".
    generatedAt: cockpitData.generatedAt,
    partitions: cockpitData.partitions.map((entry) => ({
      id: entry.id, chainVersion: entry.chainVersion
    })),
    items: rows
  }, null, 2);
  const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "tcrn-work-items.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * The saved views, with live counts.
 *
 * Each one answers a question somebody actually asks. "Awaiting you" is the
 * operator inbox narrowed to work items; "no scope annotation" surfaces records
 * the chain holds no title for, which is the thing that makes a list of keys
 * unreadable and is otherwise invisible.
 */
function savedViews(
  locale: TcrnLocale,
  routeHref: (path: string) => string,
  viewFilter: string | undefined,
  statusFilter: string | undefined
) {
  const isZh = locale === "zh-CN";
  const count = (predicate: (row: CockpitWork) => boolean) =>
    cockpitData.work.filter(predicate).length;
  return [
    {
      id: "all",
      label: isZh ? "全部" : "All",
      href: routeHref("/work-items"),
      current: !viewFilter && !statusFilter,
      count: cockpitData.work.length
    },
    {
      id: "owner-intent",
      label: isZh ? "等你决定" : "Awaiting you",
      href: routeHref("/work-items?view=owner-intent"),
      current: viewFilter === "owner-intent",
      count: count((row) => matchesView(row, "owner-intent"))
    },
    {
      id: "active",
      label: isZh ? "进行中" : "In progress",
      href: routeHref("/work-items?status=active"),
      current: statusFilter === "active",
      count: count((row) => row.status === "active")
    },
    {
      id: "blocked",
      label: isZh ? "阻塞" : "Blocked",
      href: routeHref("/work-items?status=blocked"),
      current: statusFilter === "blocked",
      count: count((row) => row.status === "blocked")
    },
    {
      id: "enrolled",
      label: isZh ? "已入列车" : "On a train",
      href: routeHref("/work-items?view=enrolled"),
      current: viewFilter === "enrolled",
      count: count((row) => matchesView(row, "enrolled"))
    },
    {
      id: "untitled",
      label: isZh ? "无范围注解" : "No scope text",
      href: routeHref("/work-items?view=untitled"),
      current: viewFilter === "untitled",
      count: count((row) => matchesView(row, "untitled"))
    }
  ];
}

function matchesView(row: CockpitWork, view: string | undefined): boolean {
  switch (view) {
    case undefined:
      return true;
    case "owner-intent":
      return cockpitData.gates.some((gate) =>
        gate.workId === row.id
        && gate.status === "pending"
        && gate.outcomeClass === "owner_intent_required");
    case "enrolled":
      return row.sprintWorkId !== null;
    case "untitled":
      return workTitle(row) === null;
    default:
      // An unknown view name filters nothing rather than everything: a stale
      // bookmark should show the full list, not an empty page that reads as
      // "there is no work here".
      return true;
  }
}

/**
 * Every whitespace-separated term must appear somewhere in the record's text.
 *
 * AND rather than OR because the terms a person types are a narrowing: "TMS
 * blocked" means both, and an OR would answer with every TMS record plus every
 * blocked record — a longer list than they started with.
 */
function matchesQuery(row: CockpitWork, query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/u).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = [
    row.externalKey ?? row.id, row.kind, row.status, row.scope ?? ""
  ].join("\n").toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

function findPartition(id: string): CockpitPartition | undefined {
  return cockpitData.partitions.find((entry) => entry.id === id);
}

function partitionLabel(partition: CockpitPartition | undefined, locale: TcrnLocale): string {
  if (!partition) return "—";
  return locale === "zh-CN" ? partition.labelZh : partition.label;
}

function buildQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

/**
 * One filter dimension as a compact control: the current value on the button,
 * the options behind a disclosure.
 *
 * Every option of every dimension used to be on screen at once, which is an
 * enumeration rather than a filter — it cost about 340px of chrome above the
 * list, and it grew by one more chip each time the platform gained a kind or a
 * project. A control that shows its value and hides its options costs the same
 * at six options and at sixty.
 *
 * Options are real links, so the whole screen still works with scripting off:
 * the disclosure is native `details`, and each option is a URL that reproduces
 * the same page. Counts come from the already-faceted set, so a reader can see
 * what a choice will cost before making it.
 */
function FilterMenu({
  label,
  allLabel,
  value,
  options,
  hrefFor,
  locale
}: {
  label: string;
  allLabel: string;
  value: string | undefined;
  options: ReadonlyArray<{ id: string; label: string; count: number }>;
  hrefFor: (value: string | undefined) => string;
  locale: TcrnLocale;
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  // Close on outside click and Escape. Native details has neither, and a panel
  // that only closes by choosing forces a choice to get rid of it.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const close = (event: Event) => {
      const node = ref.current;
      if (!node?.open) return;
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape") node.open = false;
        return;
      }
      if (!node.contains(event.target as Node)) node.open = false;
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);

  return (
    <details className="tcrn-aos-menu" ref={ref} data-filter-menu={label} data-set={value ? "true" : undefined}>
      <summary className="tcrn-aos-menu__trigger" data-selected={value ? "true" : undefined}>
        <span className="tcrn-aos-menu__key">{label}</span>
        {value ? <b>{value}</b> : <span>{allLabel}</span>}
        <span className="tcrn-aos-menu__caret" aria-hidden="true">▾</span>
      </summary>
      <div className="tcrn-aos-menu__panel">
        <SearchableList
          label={label}
          locale={locale}
          selectedId={value ?? "__all__"}
          searchThreshold={12}
          items={[
            { id: "__all__", label: allLabel, href: hrefFor(undefined), pinned: true },
            ...options.map((option) => ({
              id: option.id,
              label: option.label,
              meta: String(option.count),
              href: hrefFor(option.id)
            }))
          ]}
        />
      </div>
    </details>
  );
}
