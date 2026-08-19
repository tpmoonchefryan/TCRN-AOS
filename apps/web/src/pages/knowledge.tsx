import {
  Attribution,
  Empty,
  Field,
  Form,
  Panel,
  Pill,
  Truncation,
  breadcrumb,
  h,
  rowsList,
  type PageContext,
  type ReactNode,
} from "../ui-kit.js";
import { buildHref } from "../url.js";

/**
 * The knowledge screens: spaces, the page tree, one page, its editor, its revisions.
 *
 * Two decisions run through the whole file and are the reason it looks the way it does.
 *
 * 1. A page body is rendered as TEXT, never as markup. There is no sanitiser in this
 *    build, so turning stored Markdown into HTML would hand every author a script tag.
 *    The screens say so out loud rather than leaving a reader to wonder why their
 *    headings are not headings.
 *
 * 2. Where an operation's optional id field is left blank, the field is not rendered at
 *    all. A browser form has no way to send "absent" — a select or a text input always
 *    posts something, and an empty string reaching `space.create.projectId` or
 *    `page.create.parentId` is read as a real id and refused with "No such project". So
 *    the choice lives in the URL (the top bar's scope, or `?parent=`), and the hidden
 *    input exists only when there is something to put in it.
 */

// ---------------------------------------------------------------------------
// Shapes, as the operations actually return them
// ---------------------------------------------------------------------------

type Freshness = "fresh" | "stale" | "unknown";

interface ListEnvelope<T> {
  items: T[];
  nextCursor: string | null;
  total: number;
  truncated: boolean;
}

interface SpaceRow {
  id: string;
  key: string;
  name: string;
  descriptionMd: string;
  projectId: string | null;
  version: number;
  pageCount: number;
}

interface PageSummary {
  id: string;
  parentId: string | null;
  depth: number;
  slug: string;
  title: string;
  status: string;
  freshness: Freshness;
  version: number;
  updatedAt: string;
}

interface PageDetail {
  id: string;
  spaceId: string;
  spaceKey: string;
  parentId: string | null;
  slug: string;
  title: string;
  bodyMd: string;
  status: string;
  createdBy: string | null;
  updatedBy: string | null;
  lastVerifiedAt: string | null;
  lastVerifiedBy: string | null;
  lastVerifiedByHandle: string | null;
  stalenessDays: number | null;
  freshness: Freshness;
  version: number;
  createdAt: string;
  updatedAt: string;
  ancestors: Array<{ id: string; slug: string; title: string }>;
  children: Array<{ id: string; slug: string; title: string; status: string }>;
  links: Array<{ subjectType: string; subjectId: string; label: string; createdAt: string }>;
}

interface Revision {
  id: string;
  revision: number;
  title: string;
  bodyPreview: string;
  bodyChars: number;
  changedBy: string | null;
  changedByHandle: string | null;
  changedAt: string;
}

const PAGE_STATUS_LABEL: Record<string, string> = {
  draft: "草稿",
  published: "已发布",
  archived: "已归档",
};

/** published first: it is what the button is for most of the time. */
const PAGE_STATUSES = ["published", "draft", "archived"] as const;

const LINK_SUBJECTS: Array<[string, string]> = [
  ["work_item", "工作项"],
  ["page", "页面"],
  ["project", "项目"],
  ["decision", "决策"],
  ["deliberation", "审议"],
  ["gate", "门"],
];

const LINK_SUBJECT_LABEL: Record<string, string> = Object.fromEntries(LINK_SUBJECTS);

/** page.verify takes any 1..3650; a select can only carry the ones we name. */
const REVIEW_WINDOWS = [30, 90, 180, 365];

// ---------------------------------------------------------------------------
// Small shared pieces
// ---------------------------------------------------------------------------

function stamp(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
}

function segments(pathname: string): string[] {
  return pathname
    .replace(/\/+$/, "")
    .split("/")
    .filter((part) => part.length > 0)
    .map((part) => decodeURIComponent(part));
}

/** The record id sits at the same index on /pages/x, /pages/x/edit and /pages/x/revisions. */
function pageIdOf(ctx: PageContext): string {
  return segments(ctx.pathname)[1] ?? "";
}

/**
 * A link to another screen that carries the top bar's scope along.
 *
 * The scope is which workspace you are looking at, not a filter, so it survives every
 * move between screens; everything else about a view is stated by that view's own URL.
 */
function scopedHref(
  ctx: PageContext,
  pathname: string,
  changes: Record<string, string | null> = {},
): string {
  return buildHref(pathname, { project: ctx.search.get("project") }, changes);
}

function projectLabel(ctx: PageContext, projectId: string): string {
  return ctx.projects.find((project) => project.id === projectId)?.key ?? projectId;
}

/** A space is addressable by id or by key, the same two ways the operations accept it. */
function findSpace(rows: SpaceRow[], ref: string | null): SpaceRow | null {
  if (ref === null || ref === "") return null;
  const wanted = ref.toUpperCase();
  return rows.find((row) => row.id === ref || row.key.toUpperCase() === wanted) ?? null;
}

function freshnessPill(freshness: Freshness): ReactNode {
  if (freshness === "fresh") return h(Pill, { toneName: "done" }, "已复核");
  if (freshness === "stale") return h(Pill, { toneName: "blocked" }, "复核已过期");
  // Neutral, never green. "Nobody has checked this" is not a kind of fresh.
  return h(Pill, null, "从未复核");
}

function statusPill(status: string): ReactNode {
  const label = PAGE_STATUS_LABEL[status] ?? status;
  return status === "published" ? h(Pill, { toneName: "done" }, label) : h(Pill, null, label);
}

function missingIdBody(title: string): ReactNode {
  return h("div", null,
    h("h1", null, title),
    h(Empty, null, "地址里没有页面 id。页面的地址形如 /pages/pg_…，从知识空间的目录里点进来。"),
  );
}

/**
 * The space's page tree.
 *
 * `null` means the tree could not be read, which is a different answer from an empty
 * space and is said differently.
 */
function pageTree(
  ctx: PageContext,
  tree: ListEnvelope<PageSummary> | null,
  currentId: string | null,
  newChildSpace: string | null,
): ReactNode {
  if (tree === null) {
    return h("p", { className: "reason" }, "目录未读取：page.list 这次没有返回。这不代表这个空间没有页面。");
  }
  if (tree.items.length === 0) {
    return h(Empty, null, "这个空间还没有页面。");
  }
  return h("div", null,
    h("ul", { className: "feed" },
      ...tree.items.map((node) =>
        h("li", { key: node.id, style: { paddingLeft: `${(node.depth - 1) * 12}px` } },
          h("a", {
            href: scopedHref(ctx, `/pages/${node.id}`),
            "aria-current": node.id === currentId ? "true" : undefined,
          }, node.title),
          node.status === "published" ? null : h(Pill, null, PAGE_STATUS_LABEL[node.status] ?? node.status),
          node.freshness === "stale" ? h(Pill, { toneName: "blocked" }, "过期") : null,
          newChildSpace === null
            ? null
            : h("a", { href: scopedHref(ctx, "/pages/new", { space: newChildSpace, parent: node.id }) }, "＋子页"),
        ),
      ),
    ),
    h(Truncation, {
      shown: tree.items.length,
      total: tree.total,
      nextHref: tree.nextCursor ? buildHref(ctx.pathname, ctx.search, { cursor: tree.nextCursor }) : null,
    }),
    h("p", { className: "reason" },
      "目录只标出草稿、归档与过期。新鲜与未复核在这里不作区分 —— 要看一页的复核状态，打开那一页。"),
  );
}

// ---------------------------------------------------------------------------
// /spaces  and  /spaces/{spaceId}
// ---------------------------------------------------------------------------

/**
 * Two routes, one screen: the roster of spaces, and one space's page tree.
 *
 * They are the same screen because a space has nothing to show except its pages; a
 * separate detail page would be a heading and a list.
 */
export async function SpacesPage(ctx: PageContext): Promise<ReactNode> {
  const spaceRef = segments(ctx.pathname)[1] ?? "";
  return spaceRef === "" ? spaceRosterBody(ctx) : spaceTreeBody(ctx, spaceRef);
}

async function spaceRosterBody(ctx: PageContext): Promise<ReactNode> {
  const scopeId = ctx.search.get("project");
  const cursor = ctx.search.get("cursor");
  const spaces = await ctx.call<ListEnvelope<SpaceRow>>("space.list", {
    projectId: scopeId ?? undefined,
    cursor: cursor ?? undefined,
    limit: 50,
  });

  const scopeProject = scopeId ? ctx.projects.find((project) => project.id === scopeId) ?? null : null;

  return h("div", null,
    h("h1", null, "知识空间"),
    h("p", { className: "page-intro" },
      scopeProject
        ? `范围：${scopeProject.key}。只列这个项目的空间；实例级空间要把范围切回“全部项目”才看得到。`
        : "范围：全部项目。这里列出你能看到的每一个空间 —— 挂在项目下的，和面向整个实例的。"),

    spaces.items.length === 0
      ? h(Empty, null, "还没有空间。下面建一个，页面就有地方放了。")
      : rowsList(spaces.items.map((space) => ({
          key: space.key,
          href: scopedHref(ctx, `/spaces/${space.id}`),
          primary: space.name,
          meta: [
            h(Pill, { key: "pages" }, `${space.pageCount} 页`),
            space.projectId
              ? h(Pill, { key: "scope" }, projectLabel(ctx, space.projectId))
              : h(Pill, { key: "scope" }, "实例级"),
          ],
        }))),
    h(Truncation, {
      shown: spaces.items.length,
      total: spaces.total,
      nextHref: spaces.nextCursor ? buildHref("/spaces", ctx.search, { cursor: spaces.nextCursor }) : null,
    }),

    h(Panel, { title: "新建空间" },
      h(Form, { op: "space.create", redirect: scopedHref(ctx, "/spaces"), csrf: ctx.csrf },
        // Present only when there is a project to name. An empty projectId is not "no
        // project" to the operation — it is a project id that does not exist.
        scopeProject ? h("input", { type: "hidden", name: "projectId", value: scopeProject.id }) : null,
        h(Field, { label: "键（字母开头，字母数字，最多 12 位）" },
          h("input", {
            type: "text", name: "key", required: true, maxLength: 12,
            pattern: "[A-Za-z][A-Za-z0-9]*", placeholder: "HANDBOOK",
          }),
        ),
        h(Field, { label: "名称" }, h("input", { type: "text", name: "name", required: true, maxLength: 200 })),
        h(Field, { label: "说明（Markdown 原文，按纯文本保存）" }, h("textarea", { name: "descriptionMd" })),
        h("p", { className: "reason" },
          scopeProject
            ? `会挂在 ${scopeProject.key} 项目下，由这个项目的成员角色管辖，需要 maintainer。要建实例级空间，把顶栏范围切回“全部项目”。`
            : "会建成实例级空间：所有登录的人都看得到。要挂到某个项目下，先在顶栏把范围切到那个项目 —— 这个产品只有那一个项目开关。"),
        h("div", { className: "actions" },
          h("button", { type: "submit", "data-variant": "primary", "data-op": "space.create" }, "创建空间"),
        ),
      ),
    ),
  );
}

async function spaceTreeBody(ctx: PageContext, spaceRef: string): Promise<ReactNode> {
  // There is no space.get; the roster is the only place a space's name is readable, so
  // the name is looked up there and the lookup is allowed to come back empty.
  const roster = await ctx.call<ListEnvelope<SpaceRow>>("space.list", { limit: 200 }).catch(() => null);
  const space = roster === null ? null : findSpace(roster.items, spaceRef);

  const tree = await ctx.call<ListEnvelope<PageSummary>>("page.list", {
    spaceId: spaceRef,
    limit: 200,
    cursor: ctx.search.get("cursor") ?? undefined,
  });

  return h("div", null,
    breadcrumb([
      { href: scopedHref(ctx, "/spaces"), label: "知识空间" },
      { label: space ? space.key : spaceRef },
    ]),
    h("h1", null, space ? `${space.key} ${space.name}` : spaceRef),
    space === null
      ? h("p", { className: "reason" },
          roster === null
            ? "空间清单未读取，所以这里只有地址栏里的标识。目录本身是这个空间的真实内容。"
            : `没有在空间清单（共 ${roster.total} 个）里找到这个标识的名称。目录仍然是这个空间的。`)
      : null,
    space && space.descriptionMd.trim() !== ""
      ? h(Panel, { title: "说明" }, h("div", { className: "prose" }, space.descriptionMd))
      : null,

    h(Panel, { title: `目录（${tree.total} 页）` },
      pageTree(ctx, tree, null, spaceRef),
      h("div", { className: "actions" },
        h("a", { href: scopedHref(ctx, "/pages/new", { space: spaceRef }) }, "新建顶层页面"),
      ),
    ),
  );
}

// ---------------------------------------------------------------------------
// /pages/{pageId}
// ---------------------------------------------------------------------------

export async function PageViewPage(ctx: PageContext): Promise<ReactNode> {
  const pageId = pageIdOf(ctx);
  if (pageId === "") return missingIdBody("页面");

  const page = await ctx.call<PageDetail>("page.get", { pageId });
  const tree = await ctx.call<ListEnvelope<PageSummary>>("page.list", {
    spaceId: page.spaceId,
    limit: 100,
    cursor: ctx.search.get("cursor") ?? undefined,
  }).catch(() => null);

  const self = scopedHref(ctx, `/pages/${page.id}`);
  const verifierRead = page.lastVerifiedBy === null || page.lastVerifiedByHandle !== null;
  const windows = [...new Set(page.stalenessDays === null ? REVIEW_WINDOWS : [...REVIEW_WINDOWS, page.stalenessDays])]
    .sort((left, right) => left - right);
  const deleteBlocked = page.children.length > 0;

  const crumbs: Array<{ href?: string; label: string }> = [
    { href: scopedHref(ctx, "/spaces"), label: "知识空间" },
    { href: scopedHref(ctx, `/spaces/${page.spaceId}`), label: page.spaceKey },
  ];
  for (const ancestor of page.ancestors) {
    crumbs.push({ href: scopedHref(ctx, `/pages/${ancestor.id}`), label: ancestor.title });
  }

  return h("div", null,
    breadcrumb(crumbs),
    h("h1", null, page.title),

    h("div", { className: "grid2" },
      h("div", null,
        h(Panel, { title: "复核状态" },
          h("p", null,
            freshnessPill(page.freshness),
            " ",
            page.freshness === "fresh"
              ? "有人确认过这一页，而且还在有效期内。"
              : page.freshness === "stale"
                ? "上次复核距今已超过设定的有效期，内容可能已经不对了。"
                : "没有人确认过这一页的内容。这不等于“新鲜”，只等于“没查过”。",
          ),
          h("dl", { className: "kv" },
            h("dt", null, "复核人"),
            h("dd", null, h(Attribution, { label: page.lastVerifiedByHandle, read: verifierRead })),
            h("dt", null, "复核时间"),
            h("dd", null, page.lastVerifiedAt ? stamp(page.lastVerifiedAt) : "—"),
            h("dt", null, "有效期"),
            h("dd", null, page.stalenessDays === null ? "未设定（复核后不会自动过期）" : `${page.stalenessDays} 天`),
          ),
          h(Form, { op: "page.verify", redirect: self, csrf: ctx.csrf },
            h("input", { type: "hidden", name: "pageId", value: page.id }),
            h("input", { type: "hidden", name: "expectedVersion", value: String(page.version) }),
            h("div", { className: "actions" },
              h("button", { type: "submit", "data-op": "page.verify" }, "确认仍然正确"),
              h("span", { className: "reason" }, "记下“看过、没问题”，不动有效期。"),
            ),
          ),
          h(Form, { op: "page.verify", redirect: self, csrf: ctx.csrf },
            h("input", { type: "hidden", name: "pageId", value: page.id }),
            h("input", { type: "hidden", name: "expectedVersion", value: String(page.version) }),
            h("div", { className: "actions" },
              h("select", {
                name: "stalenessDays",
                defaultValue: String(page.stalenessDays ?? 180),
                style: { width: "auto" },
              }, ...windows.map((days) => h("option", { key: days, value: String(days) }, `${days} 天`))),
              h("button", { type: "submit", "data-op": "page.verify" }, "确认并设定有效期"),
            ),
          ),
          // Two forms rather than one with a blank field: a select always posts a value,
          // and page.verify's "keep the current window" is expressed by not sending the
          // field at all.
          h("p", { className: "reason" },
            "有效期只能设定，不能清空 —— page.verify 省略这个字段时保留原值，没有把它改回“不过期”的入口。"),
        ),

        h(Panel, { title: "正文" },
          page.bodyMd.trim() === ""
            ? h(Empty, null, "这一页还没有正文。")
            : h("div", { className: "prose" }, page.bodyMd),
          h("p", { className: "reason" },
            "正文按纯文本显示：这个版本不把 Markdown 渲染成 HTML。这里没有净化器，别人写的内容不能变成标记。"),
        ),

        page.children.length > 0
          ? h(Panel, { title: `子页面（${page.children.length}）` },
              rowsList(page.children.map((child) => ({
                key: child.slug,
                href: scopedHref(ctx, `/pages/${child.id}`),
                primary: child.title,
                meta: [h("span", { key: "status" }, statusPill(child.status))],
              }))),
            )
          : null,

        h(Panel, { title: `相关记录（${page.links.length}）` },
          page.links.length === 0
            ? h(Empty, null, "还没有关联任何记录。")
            : h("ul", { className: "feed" },
                ...page.links.map((link) =>
                  h("li", { key: `${link.subjectType}:${link.subjectId}` },
                    h("span", { className: "when" }, stamp(link.createdAt)),
                    h(Pill, null, LINK_SUBJECT_LABEL[link.subjectType] ?? link.subjectType),
                    linkTarget(ctx, link),
                  ),
                ),
              ),
          h(Form, { op: "page.link", redirect: self, csrf: ctx.csrf },
            h("input", { type: "hidden", name: "pageId", value: page.id }),
            h("div", { className: "actions" },
              h("select", { name: "subjectType", defaultValue: "work_item", style: { width: "auto" } },
                ...LINK_SUBJECTS.map(([value, label]) => h("option", { key: value, value }, label)),
              ),
              h("input", { type: "text", name: "subjectId", required: true, placeholder: "记录 id", style: { width: "auto" } }),
              h("button", { type: "submit", "data-op": "page.link" }, "建立关联"),
            ),
          ),
          h("p", { className: "reason" },
            "这里要填记录的内部 id：工作项也按 id 查，不是 TCRN-123 这样的键。解除关联的操作这个版本还没有 —— 建立之后只能留着。"),
        ),
      ),

      h("div", null,
        h(Panel, { title: "空间目录" },
          h("p", { className: "reason" },
            h("a", { href: scopedHref(ctx, `/spaces/${page.spaceId}`) }, page.spaceKey)),
          pageTree(ctx, tree, page.id, null),
        ),

        h(Panel, { title: "页面信息" },
          h("dl", { className: "kv" },
            h("dt", null, "状态"), h("dd", null, statusPill(page.status)),
            h("dt", null, "地址"), h("dd", null, page.slug),
            h("dt", null, "修订"), h("dd", null, `r${page.version}`),
            h("dt", null, "创建"), h("dd", null, stamp(page.createdAt)),
            h("dt", null, "更新"), h("dd", null, stamp(page.updatedAt)),
            h("dt", null, "创建者"), h("dd", null, h(Attribution, { label: page.createdBy, read: true })),
            h("dt", null, "更新者"), h("dd", null, h(Attribution, { label: page.updatedBy, read: true })),
          ),
          h("p", { className: "reason" },
            "创建者与更新者只有内部 id：page.get 没有把它们换成句柄，这里就不冒充一个。"),
          h("p", { className: "reason" },
            h("a", { href: scopedHref(ctx, `/pages/${page.id}/revisions`) }, "修订历史")),
        ),

        h(Panel, { title: "编辑" },
          h(Form, { op: "page.update", redirect: self, csrf: ctx.csrf },
            h("input", { type: "hidden", name: "pageId", value: page.id }),
            h("input", { type: "hidden", name: "expectedVersion", value: String(page.version) }),
            h(Field, { label: "标题", hint: "重命名不改地址：slug 在创建时定下，之后没有改它的操作。" },
              h("input", { type: "text", name: "title", defaultValue: page.title, required: true, maxLength: 400 }),
            ),
            h("div", { className: "actions" },
              h("button", { type: "submit", "data-op": "page.update" }, "重命名"),
              h("a", { href: scopedHref(ctx, `/pages/${page.id}/edit`) }, "编辑正文"),
            ),
          ),
        ),

        h(Panel, { title: "发布状态" },
          h(Form, { op: "page.publish", redirect: self, csrf: ctx.csrf },
            h("input", { type: "hidden", name: "pageId", value: page.id }),
            h("input", { type: "hidden", name: "expectedVersion", value: String(page.version) }),
            h("div", { className: "actions" },
              h("select", { name: "status", defaultValue: page.status, style: { width: "auto" } },
                ...PAGE_STATUSES.map((status) => h("option", { key: status, value: status }, PAGE_STATUS_LABEL[status] ?? status)),
              ),
              h("button", { type: "submit", "data-op": "page.publish" }, "设为此状态"),
            ),
          ),
          h("p", { className: "reason" },
            `本页所有带版本号的表单都指向 r${page.version}。提交其中一个之后页面会重新载入，其余表单随之更新；在那之前重复提交会被“版本已变”挡下。`),
        ),

        h(Panel, { title: "删除" },
          h("p", { className: "reason" }, "软删除：页面从目录和检索里消失，修订留在库里。"),
          deleteBlocked
            ? h("p", { className: "reason" },
                `这一页还有 ${page.children.length} 个子页面，删除会被拒绝 —— 软删除不级联，子页面会留在一棵谁也走不到的树上。先把它们删掉或另建。`)
            : null,
          h(Form, { op: "page.delete", redirect: scopedHref(ctx, `/spaces/${page.spaceId}`), csrf: ctx.csrf },
            h("input", { type: "hidden", name: "pageId", value: page.id }),
            h("div", { className: "actions" },
              h("button", { type: "submit", "data-op": "page.delete", disabled: deleteBlocked }, "删除这一页"),
            ),
          ),
        ),
      ),
    ),
  );
}

/**
 * Where a link points.
 *
 * `label` is resolved server-side and falls back to the raw id when the target row is
 * gone, so a label equal to the id means "we could not read it" — said, not hidden.
 */
function linkTarget(
  ctx: PageContext,
  link: { subjectType: string; subjectId: string; label: string },
): ReactNode {
  if (link.label === link.subjectId) {
    return h("span", { className: "unread" }, `${link.subjectId}（这条关联指向的记录已读不到）`);
  }
  if (link.subjectType === "work_item") {
    // The work-item screen is addressed by key, and the key is the label's first token.
    const key = link.label.split(" ")[0] ?? "";
    return key === ""
      ? h("span", null, link.label)
      : h("a", { href: scopedHref(ctx, `/work-items/${key}`) }, link.label);
  }
  if (link.subjectType === "page") {
    return h("a", { href: scopedHref(ctx, `/pages/${link.subjectId}`) }, link.label);
  }
  if (link.subjectType === "project") {
    return h("a", { href: buildHref("/work-items", { project: link.subjectId }) }, link.label);
  }
  return h("span", null, link.label, h("span", { className: "reason" }, "（这类记录还没有自己的页面）"));
}

// ---------------------------------------------------------------------------
// /pages/{pageId}/edit
// ---------------------------------------------------------------------------

export async function PageEditPage(ctx: PageContext): Promise<ReactNode> {
  const pageId = pageIdOf(ctx);
  if (pageId === "") return missingIdBody("编辑页面");

  const page = await ctx.call<PageDetail>("page.get", { pageId });
  const view = scopedHref(ctx, `/pages/${page.id}`);

  return h("div", null,
    breadcrumb([
      { href: scopedHref(ctx, "/spaces"), label: "知识空间" },
      { href: scopedHref(ctx, `/spaces/${page.spaceId}`), label: page.spaceKey },
      { href: view, label: page.title },
      { label: "编辑" },
    ]),
    h("h1", null, `编辑：${page.title}`),
    h("p", { className: "page-intro" },
      "这是纯文本 Markdown 编辑器：没有预览，没有自动保存，也不会把 Markdown 渲染成 HTML —— 保存之后正文仍按纯文本显示。"),

    h(Panel, { title: "标题与正文" },
      h(Form, { op: "page.update", redirect: view, csrf: ctx.csrf },
        h("input", { type: "hidden", name: "pageId", value: page.id }),
        h("input", { type: "hidden", name: "expectedVersion", value: String(page.version) }),
        h(Field, { label: "标题" },
          h("input", { type: "text", name: "title", defaultValue: page.title, required: true, maxLength: 400 }),
        ),
        h(Field, { label: "正文（Markdown 原文）", hint: "留空即清空正文；标题不能留空。" },
          h("textarea", { name: "bodyMd", defaultValue: page.bodyMd, style: { minHeight: "420px" } }),
        ),
        h("div", { className: "actions" },
          h("button", { type: "submit", "data-variant": "primary", "data-op": "page.update" }, "保存"),
          h("a", { href: view }, "放弃修改，回到正文页"),
        ),
      ),
    ),

    h(Panel, { title: "发布" },
      h(Form, { op: "page.publish", redirect: view, csrf: ctx.csrf },
        h("input", { type: "hidden", name: "pageId", value: page.id }),
        h("input", { type: "hidden", name: "expectedVersion", value: String(page.version) }),
        h(Field, { label: "状态" },
          h("select", { name: "status", defaultValue: page.status, style: { width: "auto" } },
            ...PAGE_STATUSES.map((status) => h("option", { key: status, value: status }, PAGE_STATUS_LABEL[status] ?? status)),
          ),
        ),
        h("div", { className: "actions" },
          h("button", { type: "submit", "data-op": "page.publish" }, "发布 / 改状态"),
        ),
      ),
      h("p", { className: "reason" },
        `保存和发布是两次提交，各自带着当前版本 r${page.version}。先提交哪一个，另一个就过期了 —— 提交后会回到正文页，需要发布再进来一次。这不是多余的一步：两次改动各自可以被人挡下。`),
    ),

    h(Panel, { title: "历史" },
      h("p", { className: "reason" },
        h("a", { href: scopedHref(ctx, `/pages/${page.id}/revisions`) }, "修订历史"),
        " —— 每次保存都会把改动前的正文留成一条修订，可以整条恢复。"),
    ),
  );
}

// ---------------------------------------------------------------------------
// /pages/new
// ---------------------------------------------------------------------------

export async function PageNewPage(ctx: PageContext): Promise<ReactNode> {
  const spaceRef = ctx.search.get("space");
  const parentRef = ctx.search.get("parent");

  const spaces = await ctx.call<ListEnvelope<SpaceRow>>("space.list", { limit: 200 });
  const chosen = findSpace(spaces.items, spaceRef);
  const parent = parentRef
    ? await ctx.call<PageDetail>("page.get", { pageId: parentRef }).catch(() => null)
    : null;

  if (spaces.items.length === 0) {
    return h("div", null,
      h("h1", null, "新建页面"),
      h(Empty, null, "还没有任何知识空间，页面没有地方可放。"),
      h("p", { className: "reason" }, h("a", { href: scopedHref(ctx, "/spaces") }, "先去建一个空间")),
    );
  }

  return h("div", null,
    breadcrumb([
      { href: scopedHref(ctx, "/spaces"), label: "知识空间" },
      ...(spaceRef ? [{ href: scopedHref(ctx, `/spaces/${encodeURIComponent(spaceRef)}`), label: chosen ? chosen.key : spaceRef }] : []),
      { label: "新建页面" },
    ]),
    h("h1", null, "新建页面"),

    h(Panel, { title: "内容" },
      h(Form, {
        op: "page.create",
        redirect: spaceRef ? scopedHref(ctx, `/spaces/${encodeURIComponent(spaceRef)}`) : scopedHref(ctx, "/spaces"),
        csrf: ctx.csrf,
      },
        spaceRef
          ? h(Field, { label: "空间" },
              h("input", { type: "hidden", name: "spaceId", value: spaceRef }),
              h("p", null, chosen ? `${chosen.key} ${chosen.name}` : spaceRef),
              chosen
                ? null
                : h("p", { className: "reason" }, "没有在空间清单里读到这个标识的名称；仍会按它创建。"),
            )
          : h(Field, { label: "空间" },
              h("select", { name: "spaceId", required: true },
                ...spaces.items.map((row) => h("option", { key: row.id, value: row.id }, `${row.key} · ${row.name}`)),
              ),
            ),
        spaceRef
          ? null
          : h(Truncation, { shown: spaces.items.length, total: spaces.total, nextHref: null }),

        // parentId is present only when there is a parent. An empty one is read as a real
        // page id and refused with "No such parent page".
        parentRef
          ? h(Field, { label: "父页面" },
              h("input", { type: "hidden", name: "parentId", value: parentRef }),
              h("p", null, parent ? parent.title : parentRef),
              parent
                ? null
                : h("p", { className: "reason" }, "父页面读不到（可能不可见或已删除）；创建会按这个 id 试，失败会有明确回话。"),
              h("p", { className: "reason" },
                h("a", { href: buildHref(ctx.pathname, ctx.search, { parent: null }) }, "改为顶层页面")),
            )
          : h(Field, { label: "父页面" },
              h("p", null, "无 —— 会建成顶层页面。"),
              h("p", { className: "reason" }, "要建子页，从空间目录里那一页后面的“＋子页”进来。"),
            ),

        h(Field, { label: "标题" },
          h("input", { type: "text", name: "title", required: true, maxLength: 400, autoFocus: true }),
        ),
        h(Field, { label: "正文（Markdown 原文）", hint: "按纯文本保存，也按纯文本显示。可以先留空。" },
          h("textarea", { name: "bodyMd" }),
        ),
        h("p", { className: "reason" },
          "地址（slug）由标题推出来，这里不填：中文标题推不出 ASCII 地址时，服务端用 id 的尾巴补上；重名也在那边化解。"),
        h("p", { className: "reason" },
          "新页面是草稿，会排在同级末尾。创建后回到空间目录 —— 这次提交不知道新页面的 id，所以落不到那一页上。"),
        h("div", { className: "actions" },
          h("button", { type: "submit", "data-variant": "primary", "data-op": "page.create" }, "创建页面"),
        ),
      ),
    ),
  );
}

// ---------------------------------------------------------------------------
// /pages/{pageId}/revisions
// ---------------------------------------------------------------------------

export async function PageRevisionsPage(ctx: PageContext): Promise<ReactNode> {
  const pageId = pageIdOf(ctx);
  if (pageId === "") return missingIdBody("修订历史");

  const page = await ctx.call<PageDetail>("page.get", { pageId });
  const revisions = await ctx.call<ListEnvelope<Revision>>("page.revisions", {
    pageId: page.id,
    limit: 50,
    cursor: ctx.search.get("cursor") ?? undefined,
  });

  const view = scopedHref(ctx, `/pages/${page.id}`);
  const self = scopedHref(ctx, `/pages/${page.id}/revisions`);

  return h("div", null,
    breadcrumb([
      { href: scopedHref(ctx, "/spaces"), label: "知识空间" },
      { href: scopedHref(ctx, `/spaces/${page.spaceId}`), label: page.spaceKey },
      { href: view, label: page.title },
      { label: "修订历史" },
    ]),
    h("h1", null, `修订历史：${page.title}`),
    h("p", { className: "page-intro" },
      `当前 r${page.version}。修订号取自内容被替换时的页面版本号，所以会跳号 —— 发布、归档、复核也让版本号 +1，但不写内容修订。r3 之后直接是 r6 是正常的，不是丢了三条。`),

    revisions.total === 0
      ? h(Empty, null, "这一页还没有内容修订。第一次保存改动之后才会出现第一条。")
      : h("div", null,
          ...revisions.items.map((revision) =>
            h(Panel, { key: revision.id, title: `r${revision.revision}　${revision.title}` },
              h("dl", { className: "kv" },
                h("dt", null, "改动者"),
                h("dd", null, h(Attribution, {
                  label: revision.changedByHandle,
                  read: revision.changedBy === null || revision.changedByHandle !== null,
                })),
                h("dt", null, "时间"),
                h("dd", null, stamp(revision.changedAt)),
                h("dt", null, "长度"),
                h("dd", null, `${revision.bodyChars} 字`),
              ),
              revision.bodyPreview.trim() === ""
                ? h(Empty, null, "这一版正文是空的。")
                : h("div", { className: "prose" }, revision.bodyPreview),
              // The list carries a preview, not the body: fifty copies of a long page is
              // megabytes of text nobody reads in this view.
              [...revision.bodyPreview].length < revision.bodyChars
                ? h("p", { className: "reason" },
                    `预览到此为止：这里显示 ${[...revision.bodyPreview].length} 字，这一版共 ${revision.bodyChars} 字。要看全文，先恢复它，或从正文页读现行版本。`)
                : null,
              h(Form, { op: "page.restore_revision", redirect: self, csrf: ctx.csrf },
                h("input", { type: "hidden", name: "pageId", value: page.id }),
                h("input", { type: "hidden", name: "revision", value: String(revision.revision) }),
                h("input", { type: "hidden", name: "expectedVersion", value: String(page.version) }),
                h("div", { className: "actions" },
                  h("button", { type: "submit", "data-op": "page.restore_revision" }, `恢复到 r${revision.revision}`),
                ),
              ),
            ),
          ),
        ),

    h(Truncation, {
      shown: revisions.items.length,
      total: revisions.total,
      // ctx.pathname, never `self`: `self` already carries the scope's query string, and
      // feeding a built href back in as a pathname is what produces a second `?`.
      nextHref: revisions.nextCursor ? buildHref(ctx.pathname, ctx.search, { cursor: revisions.nextCursor }) : null,
    }),
    revisions.total === 0
      ? null
      : h("p", { className: "reason" },
          `恢复是一次普通编辑：旧修订原样留着，当前内容也会先存成一条新修订，历史不会被改写。每个恢复按钮都带着 r${page.version}，恢复一次之后页面重新载入，其余按钮随之更新。`),
  );
}
