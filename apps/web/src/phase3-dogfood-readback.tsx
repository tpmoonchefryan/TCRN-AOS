import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  EnvironmentBanner,
  Heading,
  MachineTokenCell,
  MetadataRail,
  StatusBadge,
  Surface,
  Text,
  WorkActivityFeed,
  WorkList,
  WorkPageHeader,
  WorkQuickFilters,
  WorkViewTabs,
  type WorkActivityFeedItem,
  type WorkItemRowProps
} from "@tcrn/ui-react";
import type { TcrnLocale } from "@tcrn/ui-copy-state";

const ticketEndpoint = "/api/work/readback/tickets";
const auditEndpoint = "/api/work/readback/audit";
const policyEndpoint = "/api/work/readback/policy";
const ticketDefaultLimit = 10;
const ticketMaxLimit = 20;
const auditDefaultLimit = 5;

const ticketQueryPassThroughKeys = new Set([
  "initiativeId",
  "epicId",
  "storyId",
  "status",
  "assigneeEmployeeId",
  "limit",
  "cursor",
  "updatedSince",
  "employeeId",
  "actor",
  "role",
  "threadId",
  "sessionId",
  "clientEnv",
  "auth",
  "authorization",
  "method"
]);

interface Phase3DogfoodReadbackProps {
  locale: TcrnLocale;
  theme: "light" | "dark";
  routeHref: (path: string) => string;
}

interface TicketListReadback {
  ok: true;
  method: "aos.ticket.list";
  schemaVersion: "aos.ticket.list.v1";
  rowGrain: "story";
  rows: TicketListRow[];
  page: TicketPage;
}

interface TicketPage {
  limit: number;
  returnedCount: number;
  hasMore: boolean;
  nextCursor?: string | null;
  filterDigest?: string;
  sortVersion?: string;
}

interface TicketListRow {
  initiativeId?: string;
  initiativeTitle?: string;
  initiativeStatus?: string;
  epicId?: string;
  epicTitle?: string;
  epicStatus?: string;
  storyId: string;
  storyTitle: string;
  storyStatus?: string;
  safeUpdatedAt?: string;
  updatedAt?: string;
  subtaskSummaries?: Array<{ id: string; title: string; status?: string; ownerRole?: string }>;
  assignmentIds?: string[];
  assigneeEmployeeIds?: string[];
  runRefs?: Array<{ id: string; status?: string; startedAt?: string; endedAt?: string }>;
  latestGate?: { id?: string; type?: string; status?: string };
  latestEvidence?: { id?: string; type?: string; redactionState?: string; digest?: string; timestamp?: string };
  latestAudit?: { id?: string; action?: string; outcome?: string; timestamp?: string };
  auditCount?: number;
}

interface AuditReadback {
  ok: true;
  method: "aos.audit.query";
  items: AuditReadbackItem[];
  limit: number;
  returnedCount: number;
  hasMore: boolean;
  nextCursor?: string | null;
}

interface AuditReadbackItem {
  id: string;
  actorRef?: string;
  action: string;
  targetType: string;
  targetId: string;
  timestamp: string;
  outcome?: string;
  policyVersion?: string;
  details?: unknown;
}

interface PolicyReadback {
  ok: true;
  method: "aos.policy.read";
  readbackMethods: string[];
  fullGatewayMethodListExposed: boolean;
  responseBudgetBytes?: number;
}

interface ReadbackError {
  status: "error";
  statusCode?: number | undefined;
  reason: string;
  message: string;
}

type RemoteState<T> =
  | { status: "idle" | "loading" }
  | { status: "success"; data: T }
  | ReadbackError;

export function Phase3DogfoodReadback({ locale, theme, routeHref }: Phase3DogfoodReadbackProps) {
  const isZh = locale === "zh-CN";
  const [search, setSearch] = useState(() => readSearchParams());
  const [ticketsState, setTicketsState] = useState<RemoteState<TicketListReadback>>({ status: "loading" });
  const [auditState, setAuditState] = useState<RemoteState<AuditReadback>>({ status: "idle" });
  const [policyState, setPolicyState] = useState<RemoteState<PolicyReadback>>({ status: "loading" });

  useEffect(() => {
    const onPopState = () => setSearch(readSearchParams());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const ticketApiQuery = useMemo(() => ticketApiQueryFromSearch(search), [search]);
  const selectedStoryFromUrl = search.get("storyId") ?? undefined;

  useEffect(() => {
    let cancelled = false;
    setTicketsState({ status: "loading" });
    fetchReadback<TicketListReadback>(`${ticketEndpoint}${ticketApiQuery ? `?${ticketApiQuery}` : ""}`)
      .then((data) => {
        if (!cancelled) setTicketsState({ status: "success", data });
      })
      .catch((error: unknown) => {
        if (!cancelled) setTicketsState(toReadbackError(error));
      });
    return () => {
      cancelled = true;
    };
  }, [ticketApiQuery]);

  useEffect(() => {
    let cancelled = false;
    fetchReadback<PolicyReadback>(policyEndpoint)
      .then((data) => {
        if (!cancelled) setPolicyState({ status: "success", data });
      })
      .catch((error: unknown) => {
        if (!cancelled) setPolicyState(toReadbackError(error));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedStory = useMemo(() => {
    if (ticketsState.status !== "success") return undefined;
    return ticketsState.data.rows.find((row) => row.storyId === selectedStoryFromUrl) ?? ticketsState.data.rows[0];
  }, [selectedStoryFromUrl, ticketsState]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedStory) {
      setAuditState({ status: "idle" });
      return () => {
        cancelled = true;
      };
    }
    const auditQuery = new URLSearchParams();
    auditQuery.set("targetId", selectedStory.storyId);
    auditQuery.set("limit", String(auditDefaultLimit));
    setAuditState({ status: "loading" });
    fetchReadback<AuditReadback>(`${auditEndpoint}?${auditQuery.toString()}`)
      .then((data) => {
        if (!cancelled) setAuditState({ status: "success", data });
      })
      .catch((error: unknown) => {
        if (!cancelled) setAuditState(toReadbackError(error));
      });
    return () => {
      cancelled = true;
    };
  }, [selectedStory]);

  const ticketRows = ticketsState.status === "success"
    ? ticketsState.data.rows.map((row) => ticketRowForWorkList(row, selectedStory?.storyId, search, routeHref, locale))
    : [];
  const filters = filterItems(search, routeHref, locale);
  const selectedStoryTitle = selectedStory?.storyTitle ?? (isZh ? "等待选择故事" : "Waiting for story selection");
  const ticketError = ticketsState.status === "error" ? ticketsState : undefined;
  const auditError = auditState.status === "error" ? auditState : undefined;
  const policyMethods = policyState.status === "success" ? policyState.data.readbackMethods : ["aos.ticket.list", "aos.audit.query"];
  const page = ticketsState.status === "success" ? ticketsState.data.page : undefined;

  return (
    <div
      className="tcrn-phase3-readback"
      data-phase3-readback-surface="work-readback"
      data-readback-api-surface="work.readback"
      data-readback-api-tickets={ticketEndpoint}
      data-readback-api-audit={auditEndpoint}
      data-readback-api-policy={policyEndpoint}
      data-generic-mcp-facade="unused"
      data-generic-gateway-facade="unused"
      data-method-dispatch-facade="absent"
      data-product-shell-search-capability="absent"
      data-durable-runtime-db-activation="false"
      data-dogfood-runtime-readiness-claimed="false"
      data-owner-product-final-acceptance="not-claimed"
      data-release-publication-push="not-claimed"
      data-theme={theme}
    >
      <WorkPageHeader
        title={isZh ? "工作读回" : "Work readback"}
        description={isZh
          ? "只读服务证明视图，读取已接受的 /api/work/readback 票据与故事审计时间线。"
          : "Read-only service-proof view over the accepted /api/work/readback ticket list and story-scoped audit timeline."}
        breadcrumbs={[
          { id: "work", label: isZh ? "工作队列" : "Work queue", href: routeHref("/work") },
          { id: "readback", label: isZh ? "读回" : "Readback" }
        ]}
        meta={[
          <MachineTokenCell key="surface" token="work.readback" kind="generic" copyable={false} />,
          <StatusBadge key="status" state={{ state: "local_only" }} locale={locale} />,
          <Badge key="scope" tone="neutral">{isZh ? "无实时派发" : "No live dispatch"}</Badge>
        ]}
      />

      <WorkViewTabs
        label={isZh ? "工作读回视图" : "Work readback views"}
        tabs={[
          {
            id: "tickets",
            label: isZh ? "票据" : "Tickets",
            current: true,
            ...(typeof page?.returnedCount === "number" ? { count: page.returnedCount } : {})
          },
          { id: "audit", label: isZh ? "故事审计" : "Story audit", current: false, disabled: !selectedStory },
          { id: "ds-gaps", label: isZh ? "DS 差距" : "DS gaps", current: false, disabled: true }
        ]}
      />

      <Surface className="tcrn-phase3-readback__filter-band" data-phase3-readback-filter-band="true">
        <WorkQuickFilters label={isZh ? "故事状态过滤器" : "Story status filters"} filters={filters} />
        <div className="tcrn-phase3-readback__policy">
          <Text>{isZh ? "浏览器只使用读回方法：" : "Browser surface uses readback methods only:"}</Text>
          <div className="tcrn-phase3-readback__tokens">
            {policyMethods.map((method) => <MachineTokenCell key={method} token={method} kind="generic" copyable={false} />)}
          </div>
        </div>
      </Surface>

      {ticketError ? <ReadbackErrorPanel error={ticketError} locale={locale} endpoint={ticketEndpoint} /> : null}

      <section className="tcrn-phase3-readback__layout" aria-label={isZh ? "票据读回和审计时间线" : "Ticket readback and audit timeline"}>
        <Surface className="tcrn-phase3-readback__list" data-ticket-list-ui-proof="story-grain">
          <div className="tcrn-phase3-readback__section-heading">
            <Heading level={2}>{isZh ? "故事粒度票据" : "Story-grain tickets"}</Heading>
            <Text>{isZh ? "仅展示安全摘要字段、分页游标和筛选摘要。" : "Shows safe summary fields, page cursors, and filter metadata only."}</Text>
          </div>
          {ticketsState.status === "loading" ? (
            <StatusLine locale={locale} text={isZh ? "正在读取票据" : "Loading tickets"} />
          ) : ticketRows.length > 0 ? (
            <WorkList rows={ticketRows} label={isZh ? "故事票据读回" : "Story ticket readback"} />
          ) : (
            <EmptyState locale={locale} text={isZh ? "当前筛选没有故事行。" : "No story rows match the current filter."} />
          )}
          <PaginationControls page={page} search={search} routeHref={routeHref} locale={locale} />
        </Surface>

        <div className="tcrn-phase3-readback__detail" data-ticket-scoped-audit-proof="targetId-required">
          <Surface className="tcrn-phase3-readback__story-card">
            <div className="tcrn-phase3-readback__section-heading">
              <Heading level={2}>{selectedStoryTitle}</Heading>
              <Text>{isZh ? "故事级读回；审计时间线始终绑定所选 storyId。" : "Story-level readback; audit timeline is always bound to the selected storyId."}</Text>
            </div>
            {selectedStory ? <TicketSummary row={selectedStory} locale={locale} /> : <EmptyState locale={locale} text={isZh ? "选择故事后显示审计时间线。" : "Select a story to load its audit timeline."} />}
          </Surface>

          {auditError ? <ReadbackErrorPanel error={auditError} locale={locale} endpoint={auditEndpoint} /> : null}
          <Surface className="tcrn-phase3-readback__audit-card">
            <div className="tcrn-phase3-readback__section-heading">
              <Heading level={2}>{isZh ? "审计时间线" : "Audit timeline"}</Heading>
              <Text>{isZh ? "仅显示 redacted details 摘要，不显示原始审计详情。" : "Displays redacted detail summaries only, never raw audit details."}</Text>
            </div>
            {auditState.status === "loading" ? (
              <StatusLine locale={locale} text={isZh ? "正在读取故事审计" : "Loading story audit"} />
            ) : auditState.status === "success" ? (
              <WorkActivityFeed
                label={isZh ? "故事审计时间线" : "Story audit timeline"}
                items={auditItemsForFeed(auditState.data.items, locale)}
              />
            ) : (
              <EmptyState locale={locale} text={isZh ? "审计时间线等待故事选择。" : "Audit timeline waits for story selection."} />
            )}
          </Surface>
          <MetadataRail
            title={isZh ? "读回边界" : "Readback boundary"}
            items={metadataItems({
              locale,
              ticketsState,
              auditState,
              policyState,
              selectedStory,
              page
            })}
          />
        </div>
      </section>

      <EnvironmentBanner
        label={isZh ? "只读服务证明；未声明 readiness" : "Read-only service proof; readiness not claimed"}
        state={{ state: "local_only" }}
        locale={locale}
      />
    </div>
  );
}

function readSearchParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

function ticketApiQueryFromSearch(search: URLSearchParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of search.entries()) {
    if (ticketQueryPassThroughKeys.has(key)) {
      query.append(key, value);
    }
  }
  if (!query.has("limit")) {
    query.set("limit", String(ticketDefaultLimit));
  }
  return query.toString();
}

async function fetchReadback<T>(path: string): Promise<T> {
  const response = await fetch(path, { headers: { accept: "application/json" } });
  const body = await response.json().catch(() => ({ ok: false, reason: "invalid_json_response" }));
  if (!response.ok || body?.ok === false) {
    throw {
      statusCode: response.status,
      reason: typeof body?.reason === "string" ? body.reason : "work_readback_failed"
    };
  }
  return body as T;
}

function toReadbackError(error: unknown): ReadbackError {
  if (typeof error === "object" && error !== null && "reason" in error) {
    const reason = String((error as { reason: unknown }).reason);
    const statusCode = "statusCode" in error ? Number((error as { statusCode: unknown }).statusCode) : undefined;
    return { status: "error", ...(Number.isFinite(statusCode) ? { statusCode } : {}), reason, message: humanReason(reason) };
  }
  const reason = error instanceof Error ? error.message : "work_readback_failed";
  return { status: "error", reason, message: humanReason(reason) };
}

function humanReason(reason: string): string {
  const labels: Record<string, string> = {
    audit_scope_required: "Audit requires a selected story target.",
    unsupported_filter: "This filter is outside the readback allowlist.",
    client_authority_denied: "Browser-supplied authority fields are not accepted.",
    invalid_ticket_list_cursor: "The ticket cursor is invalid.",
    ticket_list_cursor_filter_mismatch: "The cursor does not match the current filter set.",
    ticket_list_limit_exceeded: "The ticket page limit exceeds the readback cap.",
    invalid_ticket_list_limit: "The ticket page limit is invalid.",
    invalid_audit_cursor: "The audit cursor is invalid.",
    audit_limit_exceeded: "The audit page limit exceeds the readback cap.",
    readback_response_budget_exceeded: "The response budget was exceeded; no partial data was shown."
  };
  return labels[reason] ?? "The readback request failed closed.";
}

function filterItems(search: URLSearchParams, routeHref: (path: string) => string, locale: TcrnLocale) {
  const isZh = locale === "zh-CN";
  const status = search.get("status") ?? "";
  const filters = [
    { id: "all", label: isZh ? "全部" : "All", status: "", value: isZh ? "故事" : "stories" },
    { id: "accepted", label: isZh ? "已接受" : "Accepted", status: "accepted" },
    { id: "in-progress", label: isZh ? "进行中" : "In progress", status: "in_progress" },
    { id: "blocked", label: isZh ? "已阻塞" : "Blocked", status: "blocked" }
  ];
  return filters.map((filter) => ({
    id: filter.id,
    label: filter.label,
    ...(filter.value ? { value: filter.value } : {}),
    current: filter.status === status,
    href: readbackHref(routeHref, new URLSearchParams(search), filter.status ? { status: filter.status, cursor: null } : { status: null, cursor: null })
  }));
}

function ticketRowForWorkList(
  row: TicketListRow,
  selectedStoryId: string | undefined,
  search: URLSearchParams,
  routeHref: (path: string) => string,
  locale: TcrnLocale
): WorkItemRowProps {
  const isZh = locale === "zh-CN";
  const owner = row.assigneeEmployeeIds?.length ? row.assigneeEmployeeIds.join(", ") : (isZh ? "未分配" : "unassigned");
  return {
    id: row.storyId,
    title: row.storyTitle,
    state: stateForStatus(row.storyStatus),
    owner,
    href: readbackHref(routeHref, new URLSearchParams(search), { storyId: row.storyId }),
    selected: selectedStoryId === row.storyId,
    summary: row.epicTitle ?? row.initiativeTitle ?? (isZh ? "故事级读回" : "Story-level readback"),
    fields: [
      { key: "initiative", label: isZh ? "事项" : "Initiative", value: row.initiativeTitle ?? row.initiativeId ?? "n/a" },
      { key: "epic", label: isZh ? "Epic" : "Epic", value: row.epicTitle ?? row.epicId ?? "n/a" },
      { key: "audit", label: isZh ? "审计" : "Audit", value: String(row.auditCount ?? 0) }
    ],
    relationships: [
      ...(row.latestGate?.id ? [{ relation: "reviews" as const, target: row.latestGate.id }] : []),
      ...(row.latestEvidence?.id ? [{ relation: "verifies" as const, target: row.latestEvidence.id }] : [])
    ]
  };
}

function stateForStatus(status: string | undefined) {
  switch (status) {
    case "accepted":
    case "done":
    case "complete":
      return { state: "accepted" as const };
    case "blocked":
      return { state: "blocked" as const };
    case "in_progress":
    case "in-review":
    case "in_review":
      return { state: "review_required" as const };
    default:
      return { state: "local_only" as const };
  }
}

function readbackHref(
  routeHref: (path: string) => string,
  params: URLSearchParams,
  updates: Record<string, string | null>
): string {
  for (const [key, value] of Object.entries(updates)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }
  const base = new URL(routeHref("/work/readback"), "http://tcrn.local");
  for (const [key, value] of params.entries()) {
    if (!["locale", "theme", "collapsed"].includes(key)) {
      base.searchParams.set(key, value);
    }
  }
  return `${base.pathname}?${base.searchParams.toString()}`;
}

function TicketSummary({ row, locale }: { row: TicketListRow; locale: TcrnLocale }) {
  const isZh = locale === "zh-CN";
  return (
    <div className="tcrn-phase3-readback__story-summary">
      <MetadataRail
        title={isZh ? "故事摘要" : "Story summary"}
        items={[
          { key: "story", label: "storyId", value: <MachineTokenCell token={row.storyId} kind="work-item" copyable={false} /> },
          { key: "initiative", label: isZh ? "事项" : "Initiative", value: row.initiativeTitle ?? row.initiativeId ?? "n/a" },
          { key: "epic", label: "Epic", value: row.epicTitle ?? row.epicId ?? "n/a" },
          { key: "status", label: isZh ? "状态" : "Status", value: <StatusBadge state={stateForStatus(row.storyStatus)} locale={locale} /> },
          { key: "evidence", label: isZh ? "最新证据" : "Latest evidence", value: latestEvidenceText(row, locale) },
          { key: "gate", label: isZh ? "最新门禁" : "Latest gate", value: row.latestGate?.id ?? "n/a" }
        ]}
      />
      <div className="tcrn-phase3-readback__subtasks" aria-label={isZh ? "子任务摘要" : "Subtask summaries"}>
        {(row.subtaskSummaries ?? []).slice(0, 4).map((subtask) => (
          <span key={subtask.id} className="tcrn-phase3-readback__subtask">
            <MachineTokenCell token={subtask.id} kind="work-item" copyable={false} />
            <span>{subtask.title}</span>
            <Badge tone="neutral">{subtask.ownerRole ?? (isZh ? "角色待定" : "role pending")}</Badge>
          </span>
        ))}
      </div>
    </div>
  );
}

function latestEvidenceText(row: TicketListRow, locale: TcrnLocale): string {
  const isZh = locale === "zh-CN";
  if (!row.latestEvidence?.id) return isZh ? "无" : "none";
  return `${row.latestEvidence.id} / ${row.latestEvidence.redactionState ?? "redacted"} / ${row.latestEvidence.digest ?? "digest"}`;
}

function auditItemsForFeed(items: AuditReadbackItem[], locale: TcrnLocale): WorkActivityFeedItem[] {
  const isZh = locale === "zh-CN";
  return items.map((item) => ({
    id: item.id,
    actor: item.actorRef ?? "system",
    action: item.action,
    timestamp: item.timestamp,
    state: stateForStatus(item.outcome),
    summary: `${isZh ? "目标" : "Target"} ${item.targetType}:${item.targetId}; ${isZh ? "详情" : "details"} ${detailsSummary(item.details, locale)}`
  }));
}

function detailsSummary(details: unknown, locale: TcrnLocale): string {
  const isZh = locale === "zh-CN";
  if (!details || typeof details !== "object") {
    return isZh ? "已删减" : "redacted";
  }
  const keys = Object.keys(details as Record<string, unknown>).filter((key) => !/(path|body|source|message|prompt|token|auth|secret)/i.test(key));
  return keys.length ? `${isZh ? "字段" : "fields"} ${keys.slice(0, 4).join(", ")}` : (isZh ? "已删减" : "redacted");
}

function metadataItems({
  locale,
  ticketsState,
  auditState,
  policyState,
  selectedStory,
  page
}: {
  locale: TcrnLocale;
  ticketsState: RemoteState<TicketListReadback>;
  auditState: RemoteState<AuditReadback>;
  policyState: RemoteState<PolicyReadback>;
  selectedStory?: TicketListRow | undefined;
  page?: TicketPage | undefined;
}) {
  const isZh = locale === "zh-CN";
  return [
    { key: "surface", label: isZh ? "界面" : "Surface", value: "work.readback" },
    { key: "method", label: isZh ? "票据方法" : "Ticket method", value: ticketsState.status === "success" ? ticketsState.data.method : "aos.ticket.list" },
    { key: "schema", label: isZh ? "Schema" : "Schema", value: ticketsState.status === "success" ? ticketsState.data.schemaVersion : "aos.ticket.list.v1" },
    { key: "grain", label: isZh ? "行粒度" : "Row grain", value: ticketsState.status === "success" ? ticketsState.data.rowGrain : "story" },
    { key: "story", label: isZh ? "所选故事" : "Selected story", value: selectedStory?.storyId ?? "none" },
    { key: "audit", label: isZh ? "审计方法" : "Audit method", value: auditState.status === "success" ? auditState.data.method : "aos.audit.query" },
    { key: "policy", label: isZh ? "策略" : "Policy", value: policyState.status === "success" && !policyState.data.fullGatewayMethodListExposed ? "filtered" : "pending" },
    { key: "page", label: isZh ? "分页" : "Page", value: `${page?.returnedCount ?? 0}/${page?.limit ?? ticketDefaultLimit}` },
    { key: "budget", label: isZh ? "响应预算" : "Response budget", value: "16384 bytes" },
    { key: "runtime", label: isZh ? "运行时激活" : "Runtime activation", value: isZh ? "未声明" : "not claimed" }
  ];
}

function PaginationControls({
  page,
  search,
  routeHref,
  locale
}: {
  page?: TicketPage | undefined;
  search: URLSearchParams;
  routeHref: (path: string) => string;
  locale: TcrnLocale;
}) {
  const isZh = locale === "zh-CN";
  const nextHref = page?.nextCursor
    ? readbackHref(routeHref, new URLSearchParams(search), { cursor: page.nextCursor })
    : undefined;
  return (
    <nav className="tcrn-phase3-readback__pagination" aria-label={isZh ? "票据分页" : "Ticket pagination"} data-cursor-pagination="ticket-list">
      <span>{isZh ? "默认 10，最大 20" : `Default ${ticketDefaultLimit}, max ${ticketMaxLimit}`}</span>
      <Button type="button" size="sm" disabled disabledReason={isZh ? "前页不在此证明路径" : "Previous page is not part of this proof path"}>
        {isZh ? "上一页" : "Previous"}
      </Button>
      {nextHref ? (
        <a className="tcrn-link-button tcrn-link-button--secondary" href={nextHref} data-ticket-next-cursor="true">
          {isZh ? "下一页" : "Next"}
        </a>
      ) : (
        <Button type="button" size="sm" disabled disabledReason={isZh ? "没有下一页" : "No next page"}>
          {isZh ? "下一页" : "Next"}
        </Button>
      )}
    </nav>
  );
}

function ReadbackErrorPanel({ error, locale, endpoint }: { error: ReadbackError; locale: TcrnLocale; endpoint: string }) {
  const isZh = locale === "zh-CN";
  return (
    <Surface
      className="tcrn-phase3-readback__error"
      data-readback-error-state={error.reason}
      data-readback-error-endpoint={endpoint}
      data-partial-row-data-shown="false"
    >
      <Heading level={2}>{isZh ? "读回失败关闭" : "Readback failed closed"}</Heading>
      <Text>{error.message}</Text>
      <MachineTokenCell token={error.reason} kind="generic" copyable={false} />
    </Surface>
  );
}

function StatusLine({ text, locale }: { text: string; locale: TcrnLocale }) {
  return (
    <div className="tcrn-phase3-readback__status-line" aria-live="polite">
      <StatusBadge state={{ state: "local_only" }} locale={locale} />
      <Text>{text}</Text>
    </div>
  );
}

function EmptyState({ text, locale }: { text: string; locale: TcrnLocale }) {
  return (
    <div className="tcrn-phase3-readback__empty">
      <StatusBadge state={{ state: "not_claimed" }} locale={locale} />
      <Text>{text}</Text>
    </div>
  );
}
