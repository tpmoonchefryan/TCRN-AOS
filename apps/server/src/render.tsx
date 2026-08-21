import { createElement as h, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type pg from "pg";
import { dispatch, isAuthenticated, type Actor } from "../../../packages/kernel/src/index.js";
import { STYLESHEET } from "../../../apps/web/src/styles.js";
import { buildHref, hrefResetConditions, hrefWithout } from "../../../apps/web/src/url.js";
import { makeCall, type PageContext } from "../../../apps/web/src/ui-kit.js";
import { PageEditPage, PageNewPage, PageRevisionsPage, PageViewPage, SpacesPage } from "../../../apps/web/src/pages/knowledge.js";
import { DecisionsPage, DeliberationRoomPage, DeliberationsPage, GatesPage } from "../../../apps/web/src/pages/governance.js";
import { BoardPage, CommentPage, InboxPage, SavedViewsPage, SearchPage, SubjectCommentsPage, WatchingPage } from "../../../apps/web/src/pages/collab.js";
import { AccountPage, AccountsPage, ActivityPage, ErasurePage, ProjectOverviewPage, ProjectSettingsPage, TrashPage } from "../../../apps/web/src/pages/admin.js";

export interface RenderInput {
  readonly pool: pg.Pool;
  readonly actor: Actor;
  readonly csrfToken: string;
  readonly mustChangePassword: boolean;
  readonly pathname: string;
  readonly search: URLSearchParams;
  readonly version: string;
  readonly error?: { reasonCode: string; message: string; detail: Record<string, unknown> };
  /** Set when a command's own output is what the person needs to read. */
  readonly result?: { operationId: string; output: unknown };
}

export interface RenderOutput {
  readonly status: number;
  readonly body: string;
}

const STATUSES = ["planned", "ready", "active", "blocked", "pending_acceptance", "done", "cancelled"] as const;
const KINDS = ["initiative", "epic", "story", "subtask", "review", "incident", "release"] as const;

/** The seven words this product uses for state. Never another vocabulary's words. */
const STATUS_LABEL: Record<string, string> = {
  planned: "planned",
  ready: "ready",
  active: "active",
  blocked: "blocked",
  pending_acceptance: "pending acceptance",
  done: "done",
  cancelled: "cancelled",
};

function tone(status: string): string | undefined {
  if (status === "done") return "done";
  if (status === "active") return "active";
  if (status === "blocked") return "blocked";
  return undefined;
}

function html(body: ReactNode, title: string): string {
  return `<!doctype html>${renderToStaticMarkup(
    h("html", { lang: "zh-CN" },
      h("head", null,
        h("meta", { charSet: "utf-8" }),
        h("meta", { name: "viewport", content: "width=device-width, initial-scale=1" }),
        h("title", null, `${title} · TCRN AOS`),
        h("link", { rel: "stylesheet", href: "/assets/tokens.css" }),
        h("style", { dangerouslySetInnerHTML: { __html: STYLESHEET } }),
      ),
      h("body", null, body),
    ),
  )}`;
}

function Field(props: { label: string; hint?: string; children?: ReactNode }): ReactNode {
  return h("div", { className: "field" },
    h("label", null, props.label),
    props.children,
    props.hint ? h("p", { className: "reason" }, props.hint) : null,
  );
}

/** Every mutating control is a real form post. There is no other way to change anything. */
function Form(props: {
  op: string;
  redirect: string;
  csrf: string;
  children?: ReactNode;
  className?: string;
}): ReactNode {
  return h("form", { method: "POST", action: `/api/v1/commands/${props.op}`, className: props.className },
    h("input", { type: "hidden", name: "_csrf", value: props.csrf }),
    h("input", { type: "hidden", name: "_redirect", value: props.redirect }),
    props.children,
  );
}

function Shell(props: {
  actor: Actor;
  pathname: string;
  search: URLSearchParams;
  projects: Array<{ id: string; key: string; name: string; openCount: number; totalCount: number }>;
  unread: number;
  children?: ReactNode;
  csrf: string;
  mustChangePassword: boolean;
}): ReactNode {
  const currentProject = props.search.get("project");
  const scopeLabel = currentProject
    ? props.projects.find((project) => project.id === currentProject)?.key ?? currentProject
    : "全部项目";

  const nav = (href: string, label: string, count?: number): ReactNode =>
    h("a", {
      className: "navitem",
      href,
      // Exactly one signal. The stylesheet inks the fill; nothing adds a second layer.
      "aria-current": props.pathname === href.split("?")[0] ? "page" : undefined,
    },
      h("span", null, label),
      count === undefined ? null : h("span", { className: "count" }, String(count)),
    );

  const scopeHref = (projectId: string | null): string =>
    buildHref(props.pathname, props.search, { project: projectId, cursor: null });

  return h("div", { className: "layout" },
    h("nav", { className: "sidebar" },
      h("div", { className: "brand" }, "TCRN AOS"),
      h("div", { className: "navgroup" },
        nav("/", "我的工作"),
        nav("/inbox", "收件箱", props.unread),
      ),
      h("div", { className: "navgroup" },
        h("h2", null, "交付"),
        nav("/projects", "项目"),
        nav("/work-items", "工作项"),
        nav("/board", "看板"),
      ),
      h("div", { className: "navgroup" },
        h("h2", null, "知识"),
        nav("/spaces", "知识空间"),
      ),
      h("div", { className: "navgroup" },
        h("h2", null, "账户"),
        nav("/account", props.actor.handle),
      ),
    ),
    h("div", { className: "main" },
      h("header", { className: "topbar" },
        // The only project control in the whole product. Two controls writing one
        // parameter is the duplication this replaced.
        h("details", { className: "scope" },
          h("summary", null,
            h("span", { className: "label" }, "范围"),
            h("span", { className: "value" }, scopeLabel),
            h("span", { "aria-hidden": "true" }, "▾"),
          ),
          h("div", { className: "scope-menu" },
            h("a", { href: scopeHref(null), "aria-current": currentProject ? undefined : "true" },
              h("span", null, "全部项目"),
              h("span", { className: "count" }, `${props.projects.length} 个`),
            ),
            h("hr", null),
            ...props.projects.map((project) =>
              h("a", {
                key: project.id,
                href: scopeHref(project.id),
                "aria-current": currentProject === project.id ? "true" : undefined,
              },
                h("span", null, `${project.key} · ${project.name}`),
                h("span", { className: "count" }, `${project.openCount}/${project.totalCount}`),
              ),
            ),
          ),
        ),
        h("div", { className: "spacer" }),
        h("form", { method: "GET", action: "/search", className: "searchform", style: { maxWidth: "260px" } },
          h("input", { type: "search", name: "q", placeholder: "检索", defaultValue: "" }),
        ),
        h(Form, { op: "auth.logout", redirect: "/login", csrf: props.csrf },
          h("button", { type: "submit", "data-op": "auth.logout" }, "退出"),
        ),
      ),
      h("main", { className: "content" },
        props.mustChangePassword
          ? h("div", { className: "notice" },
              "这个账户仍在使用初始口令。",
              h("a", { href: "/account/password" }, "现在修改"),
            )
          : null,
        props.children,
      ),
    ),
  );
}

async function call<T>(input: RenderInput, op: string, args: Record<string, unknown>): Promise<T> {
  const result = await dispatch<T>(input.pool, op, args, input.actor);
  return result.output;
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

function LoginPage(input: RenderInput): RenderOutput {
  const body = h("div", { className: "login" },
    h("h1", null, "TCRN AOS"),
    h("p", { className: "page-intro" }, "登录以继续。"),
    input.error ? h("div", { className: "error" }, input.error.message) : null,
    h("form", { method: "POST", action: "/api/v1/commands/auth.login" },
      h("input", { type: "hidden", name: "_redirect", value: "/" }),
      h(Field, { label: "账号" }, h("input", { type: "text", name: "handle", autoFocus: true, required: true })),
      h(Field, { label: "口令" }, h("input", { type: "password", name: "password", required: true })),
      h("div", { className: "actions" }, h("button", { type: "submit", "data-variant": "primary", "data-op": "auth.login" }, "登录")),
    ),
  );
  return { status: 200, body: html(body, "登录") };
}

interface WorkItem {
  id: string; key: string; projectId: string; kind: string; title: string; status: string;
  priority: string; assigneeId: string | null; assigneeHandle: string | null;
  labels: string[]; version: number; updatedAt: string;
}

async function WorkItemsPage(input: RenderInput, shell: ShellData): Promise<RenderOutput> {
  const search = input.search;
  const view = search.get("view") ?? "all";

  // A named view expands to conditions on the server. The view is what lives in the URL;
  // the conditions it implies are not written there too, because one fact stated twice is
  // a fact that will eventually disagree with itself.
  const viewFilters: Record<string, Record<string, unknown>> = {
    all: {},
    open: { open: true },
    mine: { assigneeId: input.actor.principalId },
    needs_you: { status: "pending_acceptance" },
    blocked: { status: "blocked" },
  };
  const viewLabels: Array<[string, string]> = [
    ["all", "全部"],
    ["open", "进行中"],
    ["mine", "指派给我"],
    ["needs_you", "等你决定"],
    ["blocked", "阻塞"],
  ];

  const conditions: Record<string, unknown> = {
    projectId: search.get("project") ?? undefined,
    kind: search.get("kind") ?? undefined,
    status: search.get("status") ?? undefined,
    q: search.get("q") ?? undefined,
    ...viewFilters[view],
  };

  const list = await call<{ items: WorkItem[]; total: number; truncated: boolean; nextCursor: string | null }>(
    input, "work_item.list", { ...conditions, limit: 50 },
  );

  const appliedChips: Array<{ key: string; label: string }> = [];
  if (search.get("q")) appliedChips.push({ key: "q", label: `检索 "${search.get("q")}"` });
  if (search.get("kind")) appliedChips.push({ key: "kind", label: `类型 ${search.get("kind")}` });
  if (search.get("status")) appliedChips.push({ key: "status", label: `状态 ${STATUS_LABEL[search.get("status")!] ?? search.get("status")}` });

  const dropdown = (name: string, label: string, options: readonly string[], labelFor: (value: string) => string): ReactNode => {
    const value = search.get(name);
    return h("details", { className: "dropdown", "data-set": value ? "true" : "false" },
      h("summary", null,
        h("span", { className: "label" }, label),
        h("span", { className: "value" }, value ? labelFor(value) : "全部"),
        h("span", { "aria-hidden": "true" }, "▾"),
      ),
      h("div", { className: "dropdown-menu" },
        h("a", { href: buildHref("/work-items", search, { [name]: null, cursor: null }), "aria-current": value ? undefined : "true" }, `全部${label}`),
        h("hr", null),
        ...options.map((option) =>
          h("a", {
            key: option,
            href: buildHref("/work-items", search, { [name]: option, cursor: null }),
            "aria-current": value === option ? "true" : undefined,
          }, labelFor(option)),
        ),
      ),
    );
  };

  const body = h("div", null,
    h("h1", null, "工作项"),
    h("div", { className: "filterface" },
      h("div", { className: "viewtabs" },
        ...viewLabels.map(([id, label]) =>
          h("a", {
            key: id,
            href: buildHref("/work-items", search, { view: id === "all" ? null : id, cursor: null }),
            "aria-current": view === id ? "true" : undefined,
          }, label),
        ),
      ),
      h("div", { className: "conditions" },
        h("form", { method: "GET", action: "/work-items", className: "searchform" },
          ...[...search.entries()]
            .filter(([key]) => key !== "q" && key !== "cursor")
            .map(([key, value]) => h("input", { key, type: "hidden", name: key, value })),
          h("input", {
            type: "search", name: "q", placeholder: "检索工作项",
            defaultValue: search.get("q") ?? "",
            "data-set": search.get("q") ? "true" : "false",
            title: "逐字匹配：多个词须全部命中",
          }),
        ),
        dropdown("kind", "类型", KINDS, (value) => value),
        dropdown("status", "状态", STATUSES, (value) => STATUS_LABEL[value] ?? value),
        h("div", { className: "vr" }),
        h("span", { className: "tally" }, h("b", null, String(list.items.length)), ` / ${list.total}`),
        h("div", { className: "spacer" }),
        h("a", { href: buildHref("/work-items/new", { project: search.get("project") }) }, "新建"),
      ),
      appliedChips.length > 0
        ? h("div", { className: "applied" },
            h("span", { className: "lead" }, "已应用"),
            ...appliedChips.map((chip) =>
              h("a", { key: chip.key, className: "chip", href: hrefWithout("/work-items", search, chip.key) },
                h("span", null, chip.label),
                h("span", { className: "x" }, "✕"),
              ),
            ),
            h("a", { className: "resetlink", href: hrefResetConditions("/work-items", search) }, "重置视图"),
          )
        : null,
    ),
    list.items.length === 0
      ? h("p", { className: "empty" }, "没有匹配的工作项。")
      : h("div", { className: "rows" },
          ...list.items.map((item) =>
            // The row's href is always the detail page, so middle-click and open-in-new-tab
            // do the obvious thing at every width.
            h("a", { key: item.id, className: "row", href: `/work-items/${item.key}` },
              h("span", { className: "row-key" }, item.key),
              h("span", { className: "row-title" }, item.title),
              h("span", { className: "row-meta" },
                item.assigneeHandle
                  ? h("span", { className: "pill" }, item.assigneeHandle)
                  : h("span", { className: "pill" }, "未指派"),
                h("span", { className: "pill" }, item.kind),
                h("span", { className: "pill", "data-tone": tone(item.status) }, STATUS_LABEL[item.status] ?? item.status),
              ),
            ),
          ),
        ),
    list.truncated
      ? h("p", { className: "truncation" },
          `显示 ${list.items.length} 条，共 ${list.total} 条。`,
          h("a", { href: buildHref("/work-items", search, { cursor: list.nextCursor }) }, "下一页"),
        )
      : null,
  );
  return { status: 200, body: html(h(Shell, { ...shell, children: body }), "工作项") };
}

async function WorkItemDetailPage(input: RenderInput, shell: ShellData, key: string): Promise<RenderOutput> {
  const item = await call<WorkItem & {
    bodyMd: string;
    ancestors: Array<{ key: string; title: string }>;
    children: Array<{ key: string; title: string; status: string; kind: string }>;
    relations: Array<{ id: string; direction: string; relation: string; otherKey: string; otherTitle: string; otherStatus: string }>;
    openGates: Array<{ id: string; title: string; status: string; outcomeClass: string }>;
  }>(input, "work_item.get", { key });

  const activity = await call<{ items: Array<{ id: string; actorLabel: string; action: string; fieldNames: string[]; occurredAt: string }> }>(
    input, "activity.list", { subjectType: "work_item", subjectId: item.id, limit: 30 },
  ).catch(() => ({ items: [] }));

  // Assignment offers the project's members and nobody else: a person who cannot open the
  // item is not a person who can be given it.
  const memberList = await call<{ items: Array<{ principalId: string; handle: string; displayName: string }> }>(
    input, "project.list_members", { projectId: item.projectId },
  ).catch(() => ({ items: [] }));
  const members = memberList.items;

  const detail = `/work-items/${item.key}`;

  const body = h("div", null,
    item.ancestors.length > 0
      ? h("div", { className: "breadcrumb" },
          ...item.ancestors.flatMap((ancestor, index) => [
            index > 0 ? h("span", { key: `sep${index}` }, " › ") : null,
            h("a", { key: ancestor.key, href: `/work-items/${ancestor.key}` }, `${ancestor.key} ${ancestor.title}`),
          ]),
        )
      : null,
    h("h1", null, `${item.key} ${item.title}`),
    h("div", { className: "grid2" },
      h("div", null,
        h("div", { className: "panel" },
          h("h2", null, "编辑"),
          h(Form, { op: "work_item.update", redirect: detail, csrf: shell.csrf },
            h("input", { type: "hidden", name: "key", value: item.key }),
            h("input", { type: "hidden", name: "expectedVersion", value: String(item.version) }),
            h(Field, { label: "标题" }, h("input", { type: "text", name: "title", defaultValue: item.title, required: true })),
            h(Field, { label: "正文（Markdown）" }, h("textarea", { name: "bodyMd", defaultValue: item.bodyMd })),
            h(Field, { label: "优先级" },
              h("select", { name: "priority", defaultValue: item.priority },
                ...["urgent", "high", "normal", "low"].map((value) => h("option", { key: value, value }, value)),
              ),
            ),
            h(Field, { label: "负责人", hint: "留空表示不指派。这一格决定它是否出现在某个人的「我的工作」里。" },
              h("select", { name: "assigneeId", defaultValue: item.assigneeId ?? "" },
                h("option", { value: "" }, "未指派"),
                ...members.map((member) =>
                  h("option", { key: member.principalId, value: member.principalId },
                    `${member.handle} · ${member.displayName}`),
                ),
              ),
            ),
            h("div", { className: "actions" },
              h("button", { type: "submit", "data-variant": "primary", "data-op": "work_item.update" }, "保存"),
            ),
          ),
        ),
        item.children.length > 0
          ? h("div", { className: "panel" },
              h("h2", null, `子项 (${item.children.length})`),
              h("div", { className: "rows" },
                ...item.children.map((child) =>
                  h("a", { key: child.key, className: "row", href: `/work-items/${child.key}` },
                    h("span", { className: "row-key" }, child.key),
                    h("span", { className: "row-title" }, child.title),
                    h("span", { className: "row-meta" },
                      h("span", { className: "pill", "data-tone": tone(child.status) }, STATUS_LABEL[child.status] ?? child.status),
                    ),
                  ),
                ),
              ),
            )
          : null,
        h("div", { className: "panel" },
          h("h2", null, "标签"),
          h(Form, { op: "work_item.set_labels", redirect: detail, csrf: shell.csrf },
            h("input", { type: "hidden", name: "key", value: item.key }),
            h(Field, { label: "标签（一行一个，提交即替换整组）" },
              h("textarea", { name: "labels", defaultValue: item.labels.join("\n"), style: { minHeight: "70px" } }),
            ),
            h("div", { className: "actions" },
              h("button", { type: "submit", "data-op": "work_item.set_labels" }, "保存标签"),
            ),
          ),
        ),
        h("div", { className: "panel" },
          h("h2", null, "关联"),
          item.relations.length === 0
            ? h("p", { className: "empty" }, "还没有关联。")
            : h("ul", { className: "feed" },
                ...item.relations.map((relation) =>
                  h("li", { key: relation.id },
                    h("span", { className: "pill" }, relation.direction === "outbound" ? relation.relation : `← ${relation.relation}`),
                    h("a", { href: `/work-items/${relation.otherKey}` }, `${relation.otherKey} ${relation.otherTitle}`),
                    h(Form, { op: "work_item.unrelate", redirect: detail, csrf: shell.csrf },
                      h("input", { type: "hidden", name: "key", value: item.key }),
                      h("input", { type: "hidden", name: "relationId", value: relation.id }),
                      h("button", { type: "submit", "data-op": "work_item.unrelate" }, "移除"),
                    ),
                  ),
                ),
              ),
          h(Form, { op: "work_item.relate", redirect: detail, csrf: shell.csrf },
            h("input", { type: "hidden", name: "key", value: item.key }),
            h("div", { className: "actions" },
              h("select", { name: "relation", style: { width: "auto" } },
                ...["blocks", "blocked_by", "depends_on", "relates_to", "duplicates", "supersedes",
                    "split_from", "caused_by", "implements", "verifies", "reviews", "refreshes"]
                  .map((value) => h("option", { key: value, value }, value)),
              ),
              h("input", { type: "text", name: "otherKey", placeholder: "PROJ-123", style: { width: "auto" }, required: true }),
              h("button", { type: "submit", "data-op": "work_item.relate" }, "添加关联"),
            ),
          ),
        ),
      ),
      h("div", null,
        h("div", { className: "panel" },
          h("h2", null, "状态"),
          h("dl", { className: "kv" },
            h("dt", null, "当前"), h("dd", null, h("span", { className: "pill", "data-tone": tone(item.status) }, STATUS_LABEL[item.status] ?? item.status)),
            h("dt", null, "类型"), h("dd", null, item.kind),
            h("dt", null, "负责人"), h("dd", null, item.assigneeHandle ?? "未指派"),
            h("dt", null, "修订"), h("dd", null, `r${item.version}`),
          ),
          item.openGates.filter((gate) => gate.status !== "satisfied").length > 0
            ? h("p", { className: "reason" },
                `有 ${item.openGates.filter((gate) => gate.status !== "satisfied").length} 道未满足的门，done 会被拒绝。`)
            : null,
          h(Form, { op: "work_item.transition", redirect: detail, csrf: shell.csrf },
            h("input", { type: "hidden", name: "key", value: item.key }),
            h("input", { type: "hidden", name: "expectedVersion", value: String(item.version) }),
            h("div", { className: "actions" },
              h("select", { name: "status", defaultValue: item.status, style: { width: "auto" } },
                ...STATUSES.map((status) => h("option", { key: status, value: status }, STATUS_LABEL[status])),
              ),
              h("button", { type: "submit", "data-op": "work_item.transition" }, "流转"),
            ),
          ),
        ),
        h("div", { className: "panel" },
          h("h2", null, "移到回收站"),
          h("p", { className: "reason" }, "不是永久删除：条目进回收站，可以从那里还原。"),
          h(Form, { op: "work_item.delete", redirect: "/work-items", csrf: shell.csrf },
            h("input", { type: "hidden", name: "key", value: item.key }),
            h("div", { className: "actions" },
              h("button", { type: "submit", "data-op": "work_item.delete" }, "移到回收站"),
            ),
          ),
        ),
        h("div", { className: "panel" },
          h("h2", null, "活动"),
          activity.items.length === 0
            ? h("p", { className: "empty" }, "还没有活动记录。")
            : h("ul", { className: "feed" },
                ...activity.items.map((event) =>
                  h("li", { key: event.id },
                    h("span", { className: "when" }, event.occurredAt.slice(0, 16).replace("T", " ")),
                    h("span", null, `${event.actorLabel} · ${event.action}`,
                      event.fieldNames.length > 0 ? h("span", { className: "reason" }, ` (${event.fieldNames.join(", ")})`) : null),
                  ),
                ),
              ),
        ),
      ),
    ),
  );
  return { status: 200, body: html(h(Shell, { ...shell, children: body }), item.key) };
}

async function ProjectsPage(input: RenderInput, shell: ShellData): Promise<RenderOutput> {
  const body = h("div", null,
    h("h1", null, "项目"),
    h("div", { className: "rows" },
      ...shell.projects.map((project) =>
        h("a", { key: project.id, className: "row", href: buildHref("/work-items", { project: project.id }) },
          h("span", { className: "row-key" }, project.key),
          h("span", { className: "row-title" }, project.name),
          h("span", { className: "row-meta" },
            h("span", { className: "pill" }, `${project.openCount} 未完成`),
            h("span", { className: "pill" }, `${project.totalCount} 全部`),
          ),
        ),
      ),
    ),
    shell.projects.length === 0 ? h("p", { className: "empty" }, "还没有项目。新建一个开始。") : null,
    h("div", { className: "panel", style: { marginTop: "16px" } },
      h("h2", null, "新建项目"),
      h(Form, { op: "project.create", redirect: "/projects", csrf: shell.csrf },
        h(Field, { label: "键（字母开头，如 AOS）" }, h("input", { type: "text", name: "key", required: true, maxLength: 12 })),
        h(Field, { label: "名称" }, h("input", { type: "text", name: "name", required: true })),
        h(Field, { label: "说明" }, h("textarea", { name: "descriptionMd", style: { minHeight: "80px" } })),
        h("div", { className: "actions" },
          h("label", { style: { display: "inline-flex", gap: "6px", alignItems: "center" } },
            h("input", { type: "checkbox", name: "governanceEnabled", value: "true" }),
            "启用治理（门与审议）",
          ),
          h("button", { type: "submit", "data-variant": "primary", "data-op": "project.create" }, "创建"),
        ),
      ),
    ),
  );
  return { status: 200, body: html(h(Shell, { ...shell, children: body }), "项目") };
}

async function NewWorkItemPage(input: RenderInput, shell: ShellData): Promise<RenderOutput> {
  const projectId = input.search.get("project") ?? shell.projects[0]?.id ?? "";
  const body = h("div", null,
    h("h1", null, "新建工作项"),
    shell.projects.length === 0
      ? h("p", { className: "empty" }, "先创建一个项目。")
      : h("div", { className: "panel" },
          h(Form, { op: "work_item.create", redirect: "/work-items", csrf: shell.csrf },
            h(Field, { label: "项目" },
              h("select", { name: "projectId", defaultValue: projectId },
                ...shell.projects.map((project) => h("option", { key: project.id, value: project.id }, `${project.key} · ${project.name}`)),
              ),
            ),
            h(Field, { label: "类型" },
              h("select", { name: "kind", defaultValue: "story" },
                ...KINDS.map((kind) => h("option", { key: kind, value: kind }, kind)),
              ),
            ),
            h(Field, { label: "标题" }, h("input", { type: "text", name: "title", required: true, autoFocus: true })),
            h(Field, { label: "正文（Markdown）" }, h("textarea", { name: "bodyMd" })),
            h(Field, { label: "父项 id（可空）" }, h("input", { type: "text", name: "parentId" })),
            h("div", { className: "actions" },
              h("button", { type: "submit", "data-variant": "primary", "data-op": "work_item.create" }, "创建"),
            ),
          ),
        ),
  );
  return { status: 200, body: html(h(Shell, { ...shell, children: body }), "新建工作项") };
}

async function AccountPage2(input: RenderInput, shell: ShellData): Promise<RenderOutput> {
  const me = await call<{ handle: string; displayName: string; kind: string; isInstanceAdmin: boolean; credential: string }>(
    input, "auth.me", {},
  );
  const tokens = await call<{ items: Array<{ id: string; name: string; hint: string; createdAt: string; lastUsedAt: string | null; revokedAt: string | null }> }>(
    input, "auth.list_api_tokens", {},
  );

  const body = h("div", null,
    h("h1", null, "账户"),
    h("div", { className: "panel" },
      h("dl", { className: "kv" },
        h("dt", null, "账号"), h("dd", null, me.handle),
        h("dt", null, "名称"), h("dd", null, me.displayName),
        h("dt", null, "类别"), h("dd", null, me.kind),
        h("dt", null, "实例管理员"), h("dd", null, me.isInstanceAdmin ? "是" : "否"),
        h("dt", null, "本次凭据"), h("dd", null, me.credential === "session" ? "浏览器会话" : "访问令牌"),
      ),
    ),
    h("div", { className: "panel" },
      h("h2", null, "修改口令"),
      h("p", { className: "reason" }, "改口令会同时结束你其它所有会话。"),
      h(Form, { op: "auth.change_password", redirect: "/account", csrf: shell.csrf },
        h(Field, { label: "当前口令" }, h("input", { type: "password", name: "currentPassword", required: true })),
        h(Field, { label: "新口令（至少 12 位）" }, h("input", { type: "password", name: "newPassword", required: true, minLength: 12 })),
        h("div", { className: "actions" }, h("button", { type: "submit", "data-op": "auth.change_password" }, "修改口令")),
      ),
    ),
    h("div", { className: "panel" },
      h("h2", null, `访问令牌 (${tokens.items.filter((token) => !token.revokedAt).length} 个有效)`),
      h("p", { className: "reason" },
        "令牌用于 API 与 MCP。它只在创建时显示一次，之后库里只留摘要——所以创建后那一页是唯一能抄下它的地方。"),
      tokens.items.length === 0
        ? h("p", { className: "empty" }, "还没有令牌。")
        : h("div", { className: "rows" },
            ...tokens.items.map((token) =>
              h("div", { key: token.id, className: "row" },
                h("span", { className: "row-key" }, token.hint),
                h("span", { className: "row-title" }, token.name),
                h("span", { className: "row-meta" },
                  h("span", { className: "pill" }, token.lastUsedAt ? `最近使用 ${token.lastUsedAt.slice(0, 10)}` : "从未使用"),
                  token.revokedAt
                    ? h("span", { className: "pill", "data-tone": "blocked" }, "已吊销")
                    : h(Form, { op: "auth.revoke_api_token", redirect: "/account/tokens", csrf: shell.csrf },
                        h("input", { type: "hidden", name: "id", value: token.id }),
                        h("button", { type: "submit", "data-op": "auth.revoke_api_token" }, "吊销"),
                      ),
                ),
              ),
            ),
          ),
      // No _redirect: this command's output IS what the person needs, and redirecting past
      // it is what threw the only copy of the secret away.
      h("form", { method: "POST", action: "/api/v1/commands/auth.create_api_token", style: { marginTop: "12px" } },
        h("input", { type: "hidden", name: "_csrf", value: shell.csrf }),
        h(Field, { label: "新令牌的名称" }, h("input", { type: "text", name: "name", required: true })),
        h("div", { className: "actions" },
          h("button", { type: "submit", "data-variant": "primary", "data-op": "auth.create_api_token" }, "创建令牌"),
        ),
      ),
    ),
  );
  return { status: 200, body: html(h(Shell, { ...shell, children: body }), "账户") };
}

async function MyWorkPage(input: RenderInput, shell: ShellData): Promise<RenderOutput> {
  const mine = await call<{
    needsYou: WorkItem[]; inProgress: WorkItem[]; waiting: WorkItem[];
  }>(input, "work.mine", {}).catch(() => ({ needsYou: [], inProgress: [], waiting: [] }));

  const band = (title: string, items: WorkItem[]): ReactNode =>
    h("div", { className: "panel" },
      h("h2", null, `${title} (${items.length})`),
      items.length === 0
        ? h("p", { className: "empty" }, "没有。")
        : h("div", { className: "rows" },
            ...items.map((item) =>
              h("a", { key: item.id, className: "row", href: `/work-items/${item.key}` },
                h("span", { className: "row-key" }, item.key),
                h("span", { className: "row-title" }, item.title),
                h("span", { className: "row-meta" },
                  h("span", { className: "pill", "data-tone": tone(item.status) }, STATUS_LABEL[item.status] ?? item.status),
                ),
              ),
            ),
          ),
    );

  const body = h("div", null,
    h("h1", null, "我的工作"),
    band("等你决定", mine.needsYou),
    band("进行中", mine.inProgress),
    band("待办", mine.waiting),
  );
  return { status: 200, body: html(h(Shell, { ...shell, children: body }), "我的工作") };
}

function NotBuiltPage(shell: ShellData, title: string, note: string): RenderOutput {
  // A route that is not built says so. It does not 404, and it does not quietly render
  // some other screen — two navigation entries answering with the same view is how a
  // product comes to promise three screens and have two.
  const body = h("div", null,
    h("h1", null, title),
    h("p", { className: "empty" }, note),
  );
  return { status: 200, body: html(h(Shell, { ...shell, children: body }), title) };
}

interface ShellData {
  actor: Actor;
  pathname: string;
  search: URLSearchParams;
  projects: Array<{ id: string; key: string; name: string; openCount: number; totalCount: number }>;
  unread: number;
  csrf: string;
  mustChangePassword: boolean;
}

export async function renderPage(input: RenderInput): Promise<RenderOutput> {
  if (!isAuthenticated(input.actor)) {
    return LoginPage(input);
  }

  const projects = await call<{ items: Array<{ id: string; key: string; name: string; openCount: number; totalCount: number }> }>(
    input, "project.list", {},
  );
  const unreadResult = await call<{ unread: number }>(input, "notification.list", { limit: 1 }).catch(() => ({ unread: 0 }));

  const shell: ShellData = {
    actor: input.actor,
    pathname: input.pathname,
    search: input.search,
    projects: projects.items,
    unread: unreadResult.unread ?? 0,
    csrf: input.csrfToken,
    mustChangePassword: input.mustChangePassword,
  };

  const path = input.pathname.replace(/\/+$/, "") || "/";

  // Every screen receives the same context and reads only through `call`, so a page can
  // show exactly what the API would return and nothing else.
  const pageContext: PageContext = {
    pool: input.pool,
    actor: input.actor,
    csrf: input.csrfToken,
    pathname: path,
    search: input.search,
    projects: projects.items,
    call: makeCall(input.pool, input.actor),
  };
  const page = async (body: Promise<import("react").ReactNode>, title: string): Promise<RenderOutput> => ({
    status: 200,
    body: html(h(Shell, { ...shell, children: await body }), title),
  });

  // Signed in and asking for the login page: show where you already are rather than a
  // 404. A dead route on the one address everybody types is worse than a redundant one.
  if (path === "/login") {
    return { status: 200, body: html(h(Shell, { ...shell, children: h("div", null,
      h("h1", null, "已经登录"),
      h("p", { className: "page-intro" }, `当前身份：${input.actor.handle}。`),
      h("p", null, h("a", { href: "/" }, "进入我的工作")),
    ) }), "已登录") };
  }
  if (path === "/") return MyWorkPage(input, shell);
  if (path === "/projects") return ProjectsPage(input, shell);
  if (path === "/work-items") return WorkItemsPage(input, shell);
  if (path === "/work-items/new") return NewWorkItemPage(input, shell);
  if (path.startsWith("/work-items/")) {
    return WorkItemDetailPage(input, shell, decodeURIComponent(path.slice("/work-items/".length)));
  }
  if (path === "/account" || path === "/account/tokens" || path === "/account/password") {
    return AccountPage2(input, shell);
  }

  // Knowledge
  if (path === "/spaces" || path.startsWith("/spaces/")) return page(SpacesPage(pageContext), "知识空间");
  if (path === "/pages/new") return page(PageNewPage(pageContext), "新建页面");
  if (path.endsWith("/revisions") && path.startsWith("/pages/")) return page(PageRevisionsPage(pageContext), "版本历史");
  if (path.endsWith("/edit") && path.startsWith("/pages/")) return page(PageEditPage(pageContext), "编辑页面");
  if (path.startsWith("/pages/")) return page(PageViewPage(pageContext), "页面");

  // Governance
  if (path.endsWith("/governance/gates")) return page(GatesPage(pageContext), "门");
  if (path.endsWith("/governance/deliberations")) return page(DeliberationsPage(pageContext), "审议");
  if (path.endsWith("/governance/decisions")) return page(DecisionsPage(pageContext), "决定");
  if (path.startsWith("/governance/deliberations/")) return page(DeliberationRoomPage(pageContext), "审议室");

  // Collaboration
  if (path.startsWith("/subjects/")) return page(SubjectCommentsPage(pageContext), "讨论");
  if (path.startsWith("/comments/")) return page(CommentPage(pageContext), "评论");
  if (path === "/inbox") return page(InboxPage(pageContext), "收件箱");
  if (path === "/watching") return page(WatchingPage(pageContext), "我的关注");
  if (path === "/board") return page(BoardPage(pageContext), "看板");
  if (path === "/views") return page(SavedViewsPage(pageContext), "保存的视图");
  if (path === "/search") return page(SearchPage(pageContext), "检索");

  // Administration and the project screens
  if (path === "/admin/accounts") return page(AccountsPage(pageContext), "账户");
  if (path.startsWith("/admin/accounts/")) return page(AccountPage(pageContext), "账户");
  if (path === "/admin/erasure") return page(ErasurePage(pageContext), "抹除");
  if (path === "/trash") return page(TrashPage(pageContext), "回收站");
  if (path === "/activity") return page(ActivityPage(pageContext), "活动");
  if (path.endsWith("/settings") && path.startsWith("/projects/")) return page(ProjectSettingsPage(pageContext), "项目设置");
  if (path.startsWith("/projects/")) return page(ProjectOverviewPage(pageContext), "项目");

  // A command whose output is the point renders it here rather than redirecting past it.
  if (path === "/result" && input.result) {
    const output = input.result.output as Record<string, unknown>;
    const secret = typeof output?.token === "string" ? output.token : null;
    return {
      status: 200,
      body: html(h(Shell, { ...shell, children: h("div", null,
        h("h1", null, "已完成"),
        h("p", { className: "page-intro" }, `操作 ${input.result.operationId} 已执行。`),
        secret
          ? h("div", null,
              h("div", { className: "notice" },
                "这是这个令牌唯一一次显示。关掉这一页就再也取不回来了——只有它的摘要留在库里。"),
              h("div", { className: "panel" },
                h("h2", null, "访问令牌"),
                h("p", { className: "prose", style: { fontFamily: "var(--tcrn-font-family-mono, monospace)", wordBreak: "break-all" } }, secret),
              ),
            )
          : h("div", { className: "panel" },
              h("pre", { className: "prose" }, JSON.stringify(output, null, 2)),
            ),
        h("p", null, h("a", { href: "/account/tokens" }, "回到令牌列表")),
      ) }), "已完成"),
    };
  }

  if (path === "/error") {
    return {
      status: 500,
      body: html(h(Shell, { ...shell, children: h("div", { className: "error" }, input.error?.message ?? "出错了") }), "错误"),
    };
  }

  return {
    status: 404,
    body: html(h(Shell, { ...shell, children: h("p", { className: "empty" }, `没有这个页面：${path}`) }), "未找到"),
  };
}
