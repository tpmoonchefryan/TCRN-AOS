import {
  Attribution,
  Empty,
  Field,
  Form,
  Panel,
  Pill,
  STATUSES,
  STATUS_LABEL,
  Truncation,
  breadcrumb,
  h,
  rowsList,
  tone,
  type PageContext,
  type ReactNode,
} from "../ui-kit.js";
import { buildHref } from "../url.js";

/**
 * The collaboration screens: a thread on any subject, one comment, the inbox, watching,
 * the board, saved views, and search.
 *
 * Every one of them reads through `ctx.call`, so a screen can only show what the API
 * would return and can never show what it would refuse. Every state a reader can reach
 * is in the URL, so a view can be pasted to somebody else and open the same way.
 */

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/** The subject vocabulary from migration 0003. A comment may hang on any of them. */
const SUBJECT_TYPES = [
  "work_item", "page", "project", "space", "gate", "deliberation",
  "decision", "release", "principal", "comment", "attachment",
] as const;

type SubjectType = (typeof SUBJECT_TYPES)[number];

const SUBJECT_LABEL: Record<string, string> = {
  work_item: "工作项",
  page: "知识页",
  project: "项目",
  space: "知识空间",
  gate: "门",
  deliberation: "审议",
  decision: "裁决",
  release: "发布",
  principal: "账户",
  comment: "评论",
  attachment: "附件",
};

/**
 * The subjects `watch.add` accepts. `principal` and `attachment` hang off no project and
 * `release` is a kind of work item rather than a table, so the operation refuses all
 * three — offering them in the form would be offering a control that cannot work.
 */
const WATCHABLE_SUBJECTS = [
  "work_item", "page", "project", "space", "gate", "deliberation", "decision", "comment",
] as const;

/**
 * The eight comment types, which are the schema's CHECK constraint restated. They exist
 * so a reader can tell a person stating intent from an agent observing, proposing or
 * deciding without opening every body.
 */
const COMMENT_TYPES = [
  "human_intent", "agent_observation", "agent_proposal", "agent_decision",
  "conference_minute", "gate_result", "evidence_note", "release_note_draft",
] as const;

const COMMENT_TYPE_LABEL: Record<string, string> = {
  human_intent: "人的意图",
  agent_observation: "智能体观察",
  agent_proposal: "智能体提案",
  agent_decision: "智能体裁决",
  conference_minute: "会议纪要",
  gate_result: "门结论",
  evidence_note: "证据备注",
  release_note_draft: "发布说明草稿",
};

const NOTIFICATION_KIND_LABEL: Record<string, string> = {
  comment_created: "新评论",
  comment_updated: "评论被编辑",
  work_item_updated: "工作项被修改",
  work_item_transitioned: "工作项流转",
  page_updated: "知识页被修改",
  page_published: "知识页发布",
  page_verified: "知识页复核",
  page_restored: "知识页回滚",
  page_linked: "知识页关联",
  gate_opened: "门已开",
  gate_decided: "门已裁",
  deliberation_position_added: "审议新增立场",
  deliberation_closed: "审议关闭",
  password_reset: "口令被重置",
};

// ---------------------------------------------------------------------------
// Output shapes, mirrored from the operations these screens call
// ---------------------------------------------------------------------------

interface Comment {
  id: string;
  subjectType: string;
  subjectId: string;
  projectId: string | null;
  parentCommentId: string | null;
  type: string;
  authorId: string | null;
  authorHandle: string | null;
  authorDisplayName: string | null;
  bodyMd: string;
  mentions: string[];
  version: number;
  createdAt: string;
  editedAt: string | null;
  revisionCount: number;
  deleted: boolean;
}

interface CommentList {
  items: Comment[];
  nextCursor: string | null;
  total: number;
  truncated: boolean;
}

interface Notification {
  id: string;
  kind: string;
  subjectType: string;
  subjectId: string;
  subjectLabel: string;
  actorLabel: string;
  createdAt: string;
  readAt: string | null;
}

interface NotificationList {
  items: Notification[];
  unread: number;
  total: number;
  nextCursor: string | null;
  truncated: boolean;
}

interface BoardCard {
  id: string;
  key: string;
  title: string;
  kind: string;
  status: string;
  priority: string;
  assigneeHandle: string | null;
  labels: string[];
  rank: string;
  version: number;
}

interface BoardColumn {
  id: string | null;
  name: string;
  status: string;
  position: number;
  items: BoardCard[];
  total: number;
  truncated: boolean;
}

interface BoardView {
  boardId: string | null;
  projectId: string;
  name: string;
  synthesised: boolean;
  columns: BoardColumn[];
  truncated: boolean;
}

interface SavedView {
  id: string;
  projectId: string | null;
  ownerId: string | null;
  name: string;
  query: Record<string, unknown>;
  isShared: boolean;
  position: number;
  version: number;
  href: string;
  mine: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SavedViewList {
  items: SavedView[];
  nextCursor: string | null;
  total: number;
  truncated: boolean;
}

interface SearchHit {
  subjectType: string;
  subjectId: string;
  title: string;
  key: string | null;
  status: string | null;
  projectId: string | null;
  rank: number;
  snippet: string;
}

interface SearchResult {
  items: SearchHit[];
  total: number;
  truncated: boolean;
}

// ---------------------------------------------------------------------------
// Small shared helpers
// ---------------------------------------------------------------------------

function decodeSafe(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    // A malformed escape is somebody's typo in the address bar, not a reason to 500.
    return segment;
  }
}

function pathSegments(pathname: string): string[] {
  return pathname.split("/").filter((segment) => segment.length > 0).map(decodeSafe);
}

function isSubjectType(value: string): value is SubjectType {
  return (SUBJECT_TYPES as readonly string[]).includes(value);
}

function isWatchable(value: string): boolean {
  return (WATCHABLE_SUBJECTS as readonly string[]).includes(value);
}

function readInt(raw: string | null, fallback: number, max: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function when(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
}

interface Refusal {
  code: string;
  message: string;
}

/**
 * Read the refusal structurally rather than importing the error class: a page needs the
 * reason code to show it, not to depend on where it was minted.
 */
function refusalOf(error: unknown): Refusal {
  if (error !== null && typeof error === "object") {
    const record = error as { reasonCode?: unknown; message?: unknown };
    return {
      code: typeof record.reasonCode === "string" ? record.reasonCode : "internal_error",
      message: typeof record.message === "string" ? record.message : String(error),
    };
  }
  return { code: "internal_error", message: String(error) };
}

function refusalBox(refusal: Refusal): ReactNode {
  return h("div", { className: "error" }, `${refusal.message}（${refusal.code}）`);
}

/** The address of a subject's own screen. Never a dead link: unmapped types get the thread. */
function threadHref(subjectType: string, subjectId: string): string {
  return `/subjects/${encodeURIComponent(subjectType)}/${encodeURIComponent(subjectId)}`;
}

function subjectHref(
  subjectType: string,
  subjectId: string,
  hint: { key?: string | null; projectId?: string | null } = {},
): string {
  switch (subjectType) {
    // work_item.get resolves an id as readily as a key, so a notification that carries
    // only the id still opens the detail page rather than a search for it.
    case "work_item":
    case "release":
      return `/work-items/${encodeURIComponent(hint.key ?? subjectId)}`;
    case "page":
      return `/pages/${encodeURIComponent(subjectId)}`;
    case "project":
      return `/projects/${encodeURIComponent(subjectId)}`;
    case "space":
      return `/spaces/${encodeURIComponent(subjectId)}`;
    case "gate":
      return `/governance/gates/${encodeURIComponent(subjectId)}`;
    case "deliberation":
      return `/governance/deliberations/${encodeURIComponent(subjectId)}`;
    case "decision":
      return hint.projectId
        ? `/projects/${encodeURIComponent(hint.projectId)}/governance/decisions`
        : threadHref(subjectType, subjectId);
    case "comment":
      return `/comments/${encodeURIComponent(subjectId)}`;
    default:
      return threadHref(subjectType, subjectId);
  }
}

/**
 * Three states, never a blank.
 *
 * An author id with no handle behind it is not the same fact as no author at all: the
 * first is a principal row this query did not resolve, the second is a comment written by
 * nobody. Rendering them identically is a defect this product has already produced once.
 */
function authorAttribution(
  authorId: string | null,
  displayName: string | null,
  handle: string | null,
): ReactNode {
  if (authorId === null) return h(Attribution, { label: null });
  const label = displayName ?? handle;
  if (!label) return h(Attribution, { label: null, read: false });
  return h(Attribution, { label });
}

function typePill(type: string): ReactNode {
  return h(Pill, null, COMMENT_TYPE_LABEL[type] ?? type);
}

function subjectPill(subjectType: string): ReactNode {
  return h(Pill, null, SUBJECT_LABEL[subjectType] ?? subjectType);
}

function statusPill(status: string): ReactNode {
  const toneName = tone(status);
  const label = STATUS_LABEL[status] ?? status;
  return h(Pill, { toneName, state: status }, label);
}

/** This page's own address, conditions included, for a form's redirect target. */
function here(ctx: PageContext): string {
  return buildHref(ctx.pathname, ctx.search);
}

function commentTypeSelect(name: string, current: string): ReactNode {
  return h("select", { name, defaultValue: current },
    ...COMMENT_TYPES.map((type) => h("option", { key: type, value: type }, COMMENT_TYPE_LABEL[type] ?? type)),
  );
}

// ---------------------------------------------------------------------------
// /subjects/{subjectType}/{subjectId} — the thread
// ---------------------------------------------------------------------------

export async function SubjectCommentsPage(ctx: PageContext): Promise<ReactNode> {
  const segments = pathSegments(ctx.pathname);
  const subjectType = segments[1] ?? "";
  const subjectId = segments[2] ?? "";

  if (!isSubjectType(subjectType) || subjectId === "") {
    return h("div", null,
      h("h1", null, "讨论"),
      h(Empty, null,
        `这个地址不完整：讨论串的地址是 /subjects/{主体类型}/{主体 id}。主体类型必须是这 ${SUBJECT_TYPES.length} 个之一：${SUBJECT_TYPES.join("、")}。`,
      ),
    );
  }

  const limit = readInt(ctx.search.get("limit"), 100, 200);
  const cursor = ctx.search.get("cursor");
  const input: Record<string, unknown> = { subjectType, subjectId, limit };
  // The cursor encodes the limit it was minted with, so the two always travel together.
  if (cursor) input.cursor = cursor;

  let list: CommentList | null = null;
  let refusal: Refusal | null = null;
  try {
    list = await ctx.call<CommentList>("comment.list", input);
  } catch (error) {
    refusal = refusalOf(error);
  }

  const items = list?.items ?? [];
  const present = new Set(items.map((item) => item.id));
  const byParent = new Map<string, Comment[]>();
  const roots: Comment[] = [];
  for (const item of items) {
    const parent = item.parentCommentId;
    // A reply whose parent is on another page is shown at the top level rather than
    // dropped: an invisible comment is worse than one shown out of place, and the note
    // below says which it is.
    // `parent !== item.id` is a render guard, not a data expectation: nothing can write a
    // cycle today, and a page that hangs the server if something ever does is not worth
    // the two words it saves.
    if (parent !== null && parent !== item.id && present.has(parent)) {
      const siblings = byParent.get(parent);
      if (siblings) siblings.push(item);
      else byParent.set(parent, [item]);
    } else {
      roots.push(item);
    }
  }

  const redirect = here(ctx);

  const replyForm = (comment: Comment): ReactNode =>
    h("details", null,
      h("summary", null, "回复这条"),
      h(Form, { op: "comment.create", redirect, csrf: ctx.csrf },
        h("input", { type: "hidden", name: "subjectType", value: subjectType }),
        h("input", { type: "hidden", name: "subjectId", value: subjectId }),
        h("input", { type: "hidden", name: "parentCommentId", value: comment.id }),
        h(Field, { label: "回复正文（Markdown）", hint: "@handle 会通知那个人；不存在的 handle 只是普通文字。" },
          h("textarea", { name: "bodyMd", required: true }),
        ),
        h(Field, { label: "类型" }, commentTypeSelect("type", "human_intent")),
        h("div", { className: "actions" },
          h("button", { type: "submit", "data-op": "comment.create" }, "回复"),
        ),
      ),
    );

  const drawn = new Set<string>();
  const renderComment = (comment: Comment, depth: number): ReactNode => {
    drawn.add(comment.id);
    const children = (byParent.get(comment.id) ?? []).filter((child) => !drawn.has(child.id));
    const detached = comment.parentCommentId !== null && !present.has(comment.parentCommentId);
    return h("div", {
      key: comment.id,
      className: "panel",
      // Indentation is the whole of the nesting; capped so a long chain stays on screen.
      style: { marginLeft: `${Math.min(depth, 8) * 20}px` },
    },
      h("div", { className: "row-meta" },
        typePill(comment.type),
        h("span", null, authorAttribution(comment.authorId, comment.authorDisplayName, comment.authorHandle)),
        h("span", { className: "reason" }, when(comment.createdAt)),
        comment.editedAt
          ? h("span", { className: "reason" }, `已编辑 ${when(comment.editedAt)} · ${comment.revisionCount} 个修订`)
          : null,
        h("span", { className: "reason" }, `r${comment.version}`),
        h("a", { href: buildHref(`/comments/${encodeURIComponent(comment.id)}`, { subjectType, subjectId }) }, "固定链接"),
      ),
      detached
        ? h("p", { className: "reason" }, "它的父评论不在本页（分页把两者分开了），所以这里按顶层显示。")
        : null,
      comment.deleted
        // A tombstone keeps its place and its replies. Removing the row would orphan
        // everything under it, and a thread with a hole in it is not a thread.
        ? h("p", { className: "empty" }, "这条评论已删除。它的回复仍在下面。")
        : h("div", { className: "prose" }, comment.bodyMd),
      comment.mentions.length > 0
        ? h("p", { className: "reason" }, `提到：${comment.mentions.map((handle) => `@${handle}`).join(" ")}`)
        : null,
      replyForm(comment),
      ...children.map((child) => renderComment(child, depth + 1)),
    );
  };

  const subjectLink = subjectHref(subjectType, subjectId);

  return h("div", null,
    breadcrumb([
      { href: subjectLink, label: `${SUBJECT_LABEL[subjectType] ?? subjectType} ${subjectId}` },
      { label: "讨论" },
    ]),
    h("h1", null, `讨论 · ${SUBJECT_LABEL[subjectType] ?? subjectType}`),
    h("p", { className: "page-intro" },
      "任何主体都能被讨论：工作项、知识页、门、审议、裁决，乃至另一条评论。",
      h("a", { href: subjectLink }, " 打开这个主体"),
      h("a", { href: buildHref("/watching", { subjectType, subjectId }) }, " · 订阅它"),
    ),
    refusal ? refusalBox(refusal) : null,
    list === null
      ? null
      : items.length === 0
        ? h(Empty, null, "还没有人说过话。下面是第一条。")
        : h("div", null, ...roots.map((comment) => renderComment(comment, 0))),
    list
      ? h(Truncation, {
          shown: items.length,
          total: list.total,
          nextHref: list.nextCursor ? buildHref(ctx.pathname, ctx.search, { cursor: list.nextCursor }) : null,
        })
      : null,
    h(Panel, { title: "新的评论" },
      h(Form, { op: "comment.create", redirect, csrf: ctx.csrf },
        h("input", { type: "hidden", name: "subjectType", value: subjectType }),
        h("input", { type: "hidden", name: "subjectId", value: subjectId }),
        h(Field, {
          label: "正文（Markdown）",
          hint: "写下来就等于订阅了这个主体：之后的动静会进你的收件箱。",
        },
          h("textarea", { name: "bodyMd", required: true }),
        ),
        h(Field, { label: "类型", hint: "八种之一。选对了，别人不必打开正文就知道这是谁在说什么。" },
          commentTypeSelect("type", "human_intent"),
        ),
        h("div", { className: "actions" },
          h("button", { type: "submit", "data-variant": "primary", "data-op": "comment.create" }, "发表"),
        ),
      ),
    ),
  );
}

// ---------------------------------------------------------------------------
// /comments/{commentId} — one comment, with its edit and delete forms
// ---------------------------------------------------------------------------

/** How many pages of a thread this page will walk looking for one comment. */
const COMMENT_LOOKUP_PAGES = 5;
const COMMENT_LOOKUP_PAGE_SIZE = 200;

export async function CommentPage(ctx: PageContext): Promise<ReactNode> {
  const segments = pathSegments(ctx.pathname);
  const commentId = segments[1] ?? "";
  const subjectType = ctx.search.get("subjectType") ?? "";
  const subjectId = ctx.search.get("subjectId") ?? "";

  if (commentId === "") {
    return h("div", null,
      h("h1", null, "评论"),
      h(Empty, null, "这个地址不完整：单条评论的地址是 /comments/{评论 id}。"),
    );
  }

  let comment: Comment | null = null;
  let refusal: Refusal | null = null;
  let scanned = 0;
  let exhausted = false;

  // There is no `comment.get`: the API reads a comment only as part of its thread. So the
  // thread's coordinates are what this page needs, and the links that lead here carry
  // them. Without them the comment cannot be read — and the page says so instead of
  // guessing or 404ing.
  if (isSubjectType(subjectType) && subjectId !== "") {
    let cursor: string | null = null;
    try {
      for (let page = 0; page < COMMENT_LOOKUP_PAGES; page += 1) {
        const input: Record<string, unknown> = {
          subjectType, subjectId, limit: COMMENT_LOOKUP_PAGE_SIZE,
        };
        if (cursor) input.cursor = cursor;
        const list: CommentList = await ctx.call<CommentList>("comment.list", input);
        scanned += list.items.length;
        const found = list.items.find((item) => item.id === commentId);
        if (found) {
          comment = found;
          break;
        }
        cursor = list.nextCursor;
        if (!cursor) break;
        if (page === COMMENT_LOOKUP_PAGES - 1) exhausted = true;
      }
    } catch (error) {
      refusal = refusalOf(error);
    }
  }

  const threadLink = isSubjectType(subjectType) && subjectId !== ""
    ? threadHref(subjectType, subjectId)
    : null;
  const redirect = threadLink ?? here(ctx);

  const locator = h(Panel, { title: "这条评论挂在哪里" },
    h("p", { className: "reason" },
      "API 没有「按 id 读一条评论」的操作——评论只作为讨论串的一部分被读出。填入它所属的主体，本页就能显示正文与当前修订号。",
    ),
    h("form", { method: "GET", action: `/comments/${encodeURIComponent(commentId)}` },
      h(Field, { label: "主体类型" },
        h("select", { name: "subjectType", defaultValue: isSubjectType(subjectType) ? subjectType : "work_item" },
          ...SUBJECT_TYPES.map((type) => h("option", { key: type, value: type }, `${SUBJECT_LABEL[type] ?? type}（${type}）`)),
        ),
      ),
      h(Field, { label: "主体 id" },
        h("input", { type: "text", name: "subjectId", defaultValue: subjectId, required: true }),
      ),
      h("div", { className: "actions" }, h("button", { type: "submit" }, "定位")),
    ),
  );

  const body = comment
    ? h(Panel, { title: "正文" },
        h("div", { className: "row-meta" },
          typePill(comment.type),
          h("span", null, authorAttribution(comment.authorId, comment.authorDisplayName, comment.authorHandle)),
          h("span", { className: "reason" }, when(comment.createdAt)),
          comment.editedAt
            ? h("span", { className: "reason" }, `已编辑 ${when(comment.editedAt)} · ${comment.revisionCount} 个修订`)
            : h("span", { className: "reason" }, "未编辑过"),
        ),
        comment.deleted
          ? h("p", { className: "empty" }, "这条评论已删除。它在讨论串里仍是一块墓碑，回复照常可读。")
          : h("div", { className: "prose" }, comment.bodyMd),
        threadLink ? h("p", { className: "reason" }, h("a", { href: threadLink }, "回到讨论串")) : null,
      )
    : null;

  const notFoundNote = comment || refusal
    ? null
    : threadLink
      ? h(Empty, null,
          exhausted
            ? `在这个讨论串的前 ${scanned} 条里没有找到这条评论。本页最多翻 ${COMMENT_LOOKUP_PAGES} 页；如果讨论串更长，从讨论串里点它的固定链接过来。`
            : "这个讨论串里没有这条评论。可能主体填错了，或者它属于别的主体。",
        )
      : h(Empty, null,
          "这里没有显示正文，因为这个地址没有带上它所属的主体。下面的「定位」补上主体之后，正文与当前修订号就会显示出来；编辑与删除两个控件不依赖它，一直可用。",
        );

  const versionField = comment
    ? h("input", { type: "hidden", name: "expectedVersion", value: String(comment.version) })
    : h(Field, {
        label: "当前修订号",
        // Optimistic concurrency is not skipped just because this page could not read the
        // record: a wrong number is refused with stale_version, which is the right answer.
        hint: "本页没有读到这条评论，所以填不出它的修订号。在讨论串上它显示为 r3 这样的字样；填错会被 stale_version 拒绝，不会覆盖别人的修改。",
      },
        h("input", { type: "number", name: "expectedVersion", min: 1, required: true, defaultValue: "" }),
      );

  return h("div", null,
    breadcrumb([
      threadLink
        ? { href: threadLink, label: `${SUBJECT_LABEL[subjectType] ?? subjectType} 的讨论` }
        : { label: "讨论" },
      { label: "一条评论" },
    ]),
    h("h1", null, "评论"),
    h("p", { className: "page-intro" }, commentId),
    refusal ? refusalBox(refusal) : null,
    notFoundNote,
    body,
    locator,
    h(Panel, { title: "编辑" },
      h("p", { className: "reason" },
        "改的是自己的话。维护者为了治理也能改别人的——协作者不能，否则同事说过的话谁都能重写。",
      ),
      h(Form, { op: "comment.update", redirect, csrf: ctx.csrf },
        h("input", { type: "hidden", name: "commentId", value: commentId }),
        versionField,
        h(Field, { label: "正文（Markdown）" },
          h("textarea", { name: "bodyMd", defaultValue: comment?.bodyMd ?? "", required: true }),
        ),
        h(Field, { label: "类型" }, commentTypeSelect("type", comment?.type ?? "human_intent")),
        h("div", { className: "actions" },
          h("button", { type: "submit", "data-variant": "primary", "data-op": "comment.update" }, "保存"),
        ),
      ),
    ),
    h(Panel, { title: "删除" },
      h("p", { className: "reason" },
        "软删除：正文消失，位置留下，回复照旧可达。已经删过的再删一次不会记第二条活动。",
      ),
      h(Form, { op: "comment.delete", redirect, csrf: ctx.csrf },
        h("input", { type: "hidden", name: "commentId", value: commentId }),
        h("div", { className: "actions" },
          h("button", { type: "submit", "data-op": "comment.delete" }, "删除这条评论"),
        ),
      ),
    ),
  );
}

// ---------------------------------------------------------------------------
// /inbox
// ---------------------------------------------------------------------------

export async function InboxPage(ctx: PageContext): Promise<ReactNode> {
  const unreadOnly = ctx.search.get("unread") === "1";
  const limit = readInt(ctx.search.get("limit"), 50, 200);
  const cursor = ctx.search.get("cursor");

  const input: Record<string, unknown> = { limit };
  if (unreadOnly) input.unreadOnly = true;
  if (cursor) input.cursor = cursor;

  let list: NotificationList | null = null;
  let refusal: Refusal | null = null;
  try {
    list = await ctx.call<NotificationList>("notification.list", input);
  } catch (error) {
    refusal = refusalOf(error);
  }

  const redirect = here(ctx);
  const items = list?.items ?? [];

  const row = (item: Notification): ReactNode => {
    const href = subjectHref(item.subjectType, item.subjectId);
    return h("li", { key: item.id },
      h("span", { className: "when" }, when(item.createdAt)),
      h("div", null,
        h("div", { className: "row-meta" },
          item.readAt === null ? h(Pill, { toneName: "active" }, "未读") : h(Pill, null, "已读"),
          subjectPill(item.subjectType),
          h(Pill, null, NOTIFICATION_KIND_LABEL[item.kind] ?? item.kind),
          h("span", null, h(Attribution, { label: item.actorLabel })),
        ),
        h("a", { href }, item.subjectLabel),
        item.readAt === null
          ? h(Form, { op: "notification.mark_read", redirect, csrf: ctx.csrf, className: "actions" },
              h("input", { type: "hidden", name: "id", value: item.id }),
              h("button", { type: "submit", "data-op": "notification.mark_read" }, "标为已读"),
            )
          : h("p", { className: "reason" }, `已读于 ${when(item.readAt)}`),
      ),
    );
  };

  const tab = (label: string, on: boolean, href: string): ReactNode =>
    h("a", { key: label, href, "aria-current": on ? "true" : undefined }, label);

  return h("div", null,
    h("h1", null, "收件箱"),
    h("p", { className: "page-intro" },
      "未读排在前面，同一档内按时间倒序。这是你一个人的收件箱——没有「看谁的」这个筛选，因为筛选是调用方能改的东西。",
    ),
    h("div", { className: "filterface" },
      h("div", { className: "viewtabs" },
        tab("全部", !unreadOnly, buildHref("/inbox", ctx.search, { unread: null, cursor: null })),
        tab("仅未读", unreadOnly, buildHref("/inbox", ctx.search, { unread: "1", cursor: null })),
      ),
      h("div", { className: "conditions" },
        h("span", { className: "tally" },
          h("b", null, String(items.length)),
          ` / ${list?.total ?? 0} · 未读 ${list?.unread ?? 0}`,
        ),
        h("div", { className: "spacer" }),
        h(Form, { op: "notification.mark_all_read", redirect, csrf: ctx.csrf },
          h("button", { type: "submit", "data-op": "notification.mark_all_read" }, "全部标为已读"),
        ),
      ),
    ),
    refusal ? refusalBox(refusal) : null,
    items.length === 0
      ? h(Empty, null, unreadOnly ? "没有未读。" : "收件箱是空的。")
      : h("ul", { className: "feed" }, ...items.map(row)),
    list
      ? h(Truncation, {
          shown: items.length,
          total: list.total,
          nextHref: list.nextCursor ? buildHref("/inbox", ctx.search, { cursor: list.nextCursor }) : null,
        })
      : null,
  );
}

// ---------------------------------------------------------------------------
// /watching
// ---------------------------------------------------------------------------

export async function WatchingPage(ctx: PageContext): Promise<ReactNode> {
  const limit = readInt(ctx.search.get("limit"), 100, 200);
  const prefillType = ctx.search.get("subjectType") ?? "work_item";
  const prefillId = ctx.search.get("subjectId") ?? "";

  let list: NotificationList | null = null;
  let refusal: Refusal | null = null;
  try {
    list = await ctx.call<NotificationList>("notification.list", { limit });
  } catch (error) {
    refusal = refusalOf(error);
  }

  // The registry has watch.add and watch.remove and no read at all, so the subscription
  // list itself is not something any client can display — an agent over MCP cannot see it
  // either. What CAN be shown honestly is the subjects that recently reached this inbox,
  // which is where the reader's actual question ("stop telling me about this") starts.
  const seen = new Map<string, Notification>();
  for (const item of list?.items ?? []) {
    const key = `${item.subjectType}:${item.subjectId}`;
    if (!seen.has(key)) seen.set(key, item);
  }
  const subjects = [...seen.values()];

  const redirect = here(ctx);

  const row = (item: Notification): ReactNode => {
    const watchable = isWatchable(item.subjectType);
    return h("li", { key: `${item.subjectType}:${item.subjectId}` },
      h("span", { className: "when" }, when(item.createdAt)),
      h("div", null,
        h("div", { className: "row-meta" },
          subjectPill(item.subjectType),
          h("a", { href: subjectHref(item.subjectType, item.subjectId) }, item.subjectLabel),
          h("a", { href: threadHref(item.subjectType, item.subjectId) }, "讨论"),
        ),
        watchable
          ? h(Form, { op: "watch.remove", redirect, csrf: ctx.csrf, className: "actions" },
              h("input", { type: "hidden", name: "subjectType", value: item.subjectType }),
              h("input", { type: "hidden", name: "subjectId", value: item.subjectId }),
              h("button", { type: "submit", "data-op": "watch.remove" }, "取消订阅"),
            )
          : h("p", { className: "reason" },
              `${SUBJECT_LABEL[item.subjectType] ?? item.subjectType} 不在可订阅的八类里，watch.remove 会拒绝它——这类通知不是订阅带来的。`,
            ),
      ),
    );
  };

  const watchForm = (op: "watch.add" | "watch.remove", title: string, hint: string, action: string): ReactNode =>
    h(Panel, { title },
      h("p", { className: "reason" }, hint),
      h(Form, { op, redirect, csrf: ctx.csrf },
        h(Field, { label: "主体类型" },
          h("select", {
            name: "subjectType",
            defaultValue: isWatchable(prefillType) ? prefillType : "work_item",
          },
            ...WATCHABLE_SUBJECTS.map((type) =>
              h("option", { key: type, value: type }, `${SUBJECT_LABEL[type] ?? type}（${type}）`),
            ),
          ),
        ),
        h(Field, { label: "主体 id" },
          h("input", { type: "text", name: "subjectId", defaultValue: prefillId, required: true }),
        ),
        h("div", { className: "actions" },
          h("button", { type: "submit", "data-op": op }, action),
        ),
      ),
    );

  return h("div", null,
    h("h1", null, "订阅"),
    h("p", { className: "page-intro" },
      "订阅一个主体，它的动静就会进你的收件箱。在某个主体下发言，等于同时订阅了它。",
    ),
    h("div", { className: "notice" },
      "下面这份不是你的订阅清单。API 只有 watch.add 与 watch.remove，没有读订阅的操作——人在这里看不到的，智能体在 MCP 上也看不到。",
      "列出的是最近给你发过通知的主体，可以直接从这里退订。",
    ),
    refusal ? refusalBox(refusal) : null,
    subjects.length === 0
      ? h(Empty, null, "最近没有任何主体给你发过通知。")
      : h("ul", { className: "feed" }, ...subjects.map(row)),
    list
      ? h("p", { className: "truncation" },
          `取自收件箱最近 ${list.items.length} 条通知（共 ${list.total} 条），去重后 ${subjects.length} 个主体。更早订阅但最近没动静的主体不会出现在这里。`,
        )
      : null,
    watchForm(
      "watch.add",
      "订阅一个主体",
      "只有八类主体可订阅：账户与附件不挂在任何项目上，发布是工作项的一种类型而不是独立的表。",
      "订阅",
    ),
    watchForm(
      "watch.remove",
      "退订一个主体",
      "退订不检查角色、也不要求主体还在：失去角色或主体被删之后仍然要能把通知关掉。退订一个本来就没订阅的主体不是错误。",
      "退订",
    ),
  );
}

// ---------------------------------------------------------------------------
// /board
// ---------------------------------------------------------------------------

export async function BoardPage(ctx: PageContext): Promise<ReactNode> {
  const projectId = ctx.search.get("project");
  const boardId = ctx.search.get("board");
  const cardLimit = readInt(ctx.search.get("cards"), 50, 500);

  if (!projectId) {
    return h("div", null,
      h("h1", null, "看板"),
      h("p", { className: "page-intro" },
        "看板是某一个项目的状态投影，所以它必须先知道看哪个项目。用左上角的「范围」选一个，或者从下面直接进。",
      ),
      ctx.projects.length === 0
        ? h(Empty, null, "还没有项目。")
        : rowsList(ctx.projects.map((project) => ({
            key: project.key,
            href: buildHref("/board", ctx.search, { project: project.id }),
            primary: project.name,
            meta: h(Pill, null, `${project.openCount}/${project.totalCount}`),
          }))),
    );
  }

  const input: Record<string, unknown> = { projectId, cardLimit };
  if (boardId) input.boardId = boardId;

  let board: BoardView | null = null;
  let refusal: Refusal | null = null;
  try {
    board = await ctx.call<BoardView>("board.get", input);
  } catch (error) {
    refusal = refusalOf(error);
  }

  const redirect = here(ctx);
  const project = ctx.projects.find((candidate) => candidate.id === projectId);
  const role = project?.role ?? null;
  const mayCreateBoard = ctx.actor.isInstanceAdmin || role === "maintainer" || role === "admin";

  const card = (item: BoardCard): ReactNode =>
    h("li", { key: item.id },
      h("div", null,
        h("div", { className: "row-meta" },
          h("a", { href: `/work-items/${encodeURIComponent(item.key)}` }, `${item.key} ${item.title}`),
          h(Pill, null, item.kind),
          h(Pill, null, item.priority),
          h(Pill, null, item.assigneeHandle ?? "未指派"),
          ...item.labels.map((label) => h(Pill, { key: label }, label)),
        ),
        h(Form, { op: "board.move", redirect, csrf: ctx.csrf, className: "actions" },
          h("input", { type: "hidden", name: "key", value: item.key }),
          h("input", { type: "hidden", name: "expectedVersion", value: String(item.version) }),
          h("select", { name: "toStatus", defaultValue: item.status, style: { width: "auto" } },
            ...STATUSES.map((status) => h("option", { key: status, value: status }, STATUS_LABEL[status] ?? status)),
          ),
          h("input", {
            type: "text", name: "beforeKey", placeholder: "上邻卡（可空）",
            style: { width: "auto" }, title: "移动后落在这张卡下面；留空表示落到列首",
          }),
          h("input", {
            type: "text", name: "afterKey", placeholder: "下邻卡（可空）",
            style: { width: "auto" }, title: "移动后落在这张卡上面；留空表示落到列尾",
          }),
          h("button", { type: "submit", "data-op": "board.move" }, "移动"),
        ),
      ),
    );

  const column = (item: BoardColumn): ReactNode =>
    h(Panel, { key: item.status, title: `${item.name} · ${STATUS_LABEL[item.status] ?? item.status}（${item.total}）` },
      item.items.length === 0
        ? h(Empty, null, "这一列是空的。")
        : h("ul", { className: "feed" }, ...item.items.map(card)),
      item.truncated
        ? h("p", { className: "truncation" },
            `显示 ${item.items.length} 张，共 ${item.total} 张。`,
            h("a", { href: buildHref("/board", ctx.search, { cards: cardLimit + 50 }) }, " 多显示 50 张"),
          )
        : null,
    );

  return h("div", null,
    breadcrumb([
      { href: buildHref("/work-items", { project: projectId }), label: project ? `${project.key} ${project.name}` : projectId },
      { label: "看板" },
    ]),
    h("h1", null, board ? `看板 · ${board.name}` : "看板"),
    h("p", { className: "page-intro" },
      "这里没有拖拽——本产品的页面上没有任何脚本。每张卡片下方的下拉框加「移动」按钮走的是同一个 board.move 操作，做的事与拖拽完全相同：换列，并在列内定位。",
    ),
    h("p", { className: "reason" },
      "非法流转会被拒绝，理由与工作项详情页一模一样：status_transition 里没有这条边时是 transition_not_permitted，并附上从当前状态允许去的状态；有未满足的门挡着目标状态时是 gate_pending，并附上是哪几道门。看板不另立一套规则，否则人们会相信最后一次试出来的那套。",
    ),
    refusal ? refusalBox(refusal) : null,
    board?.synthesised
      ? h("div", { className: "notice" },
          "这个项目还没有存过看板，下面七列是按七个状态画出来的，不是读出来的。七个状态每个都画，因为漏掉一列就等于藏起停在那个状态里的所有条目，而读的人分不清「没有」和「没画」。",
        )
      : null,
    ...(board ? board.columns.map(column) : []),
    board?.truncated
      ? h("p", { className: "truncation" }, "至少有一列没有显示全部卡片，见各列末尾的说明。")
      : null,
    h(Panel, { title: "新建看板" },
      h("p", { className: "reason" },
        mayCreateBoard
          ? "存下来的看板可以改名；列仍然是七个状态各一列。"
          : `新建看板需要该项目的 maintainer 角色，你在这个项目上的角色是 ${role ?? "无"}，所以下面的按钮不可用。`,
      ),
      h(Form, { op: "board.create", redirect, csrf: ctx.csrf },
        h("input", { type: "hidden", name: "projectId", value: projectId }),
        h(Field, { label: "名称" },
          h("input", { type: "text", name: "name", required: true, defaultValue: project ? `${project.key} 看板` : "看板" }),
        ),
        h("div", { className: "actions" },
          h("button", {
            type: "submit",
            "data-op": "board.create",
            disabled: !mayCreateBoard,
          }, "新建"),
        ),
      ),
    ),
  );
}

// ---------------------------------------------------------------------------
// /views
// ---------------------------------------------------------------------------

/** The conditions a saved view carries that this product knows how to reopen. */
const VIEW_QUERY_KEYS = ["project", "kind", "status", "q", "view"] as const;

function scalarQueryEntries(query: Record<string, unknown>): {
  scalars: Array<[string, string]>;
  skipped: string[];
} {
  const scalars: Array<[string, string]> = [];
  const skipped: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      scalars.push([key, String(value)]);
    } else if (value !== null && value !== undefined) {
      skipped.push(key);
    }
  }
  return { scalars, skipped };
}

export async function SavedViewsPage(ctx: PageContext): Promise<ReactNode> {
  const projectId = ctx.search.get("project");
  const limit = readInt(ctx.search.get("limit"), 50, 200);
  const cursor = ctx.search.get("cursor");

  const input: Record<string, unknown> = { limit };
  if (projectId) input.projectId = projectId;
  if (cursor) input.cursor = cursor;

  let list: SavedViewList | null = null;
  let refusal: Refusal | null = null;
  try {
    list = await ctx.call<SavedViewList>("saved_view.list", input);
  } catch (error) {
    refusal = refusalOf(error);
  }

  const redirect = here(ctx);
  const items = list?.items ?? [];

  const row = (view: SavedView): ReactNode => {
    const { scalars, skipped } = scalarQueryEntries(view.query);
    const openHref = buildHref("/work-items", Object.fromEntries(scalars));
    const projectKey = view.projectId
      ? ctx.projects.find((project) => project.id === view.projectId)?.key ?? view.projectId
      : null;
    return h("li", { key: view.id },
      h("div", null,
        h("div", { className: "row-meta" },
          h("a", { href: openHref }, view.name),
          h(Pill, null, view.isShared ? "共享" : "私有"),
          h(Pill, null, projectKey ?? "跨全部项目"),
          view.mine ? h(Pill, null, "我的") : null,
          h("span", { className: "reason" }, `r${view.version} · ${when(view.updatedAt)}`),
        ),
        h("p", { className: "reason" },
          scalars.length === 0
            ? "这个视图没有存下任何条件，打开就是完整列表。"
            : `条件：${scalars.map(([key, value]) => `${key}=${value}`).join("，")}`,
          skipped.length > 0
            ? `。另有 ${skipped.length} 个非标量条件（${skipped.join("、")}）本页展不开，只有存它的客户端认得。`
            : "",
        ),
        h("p", { className: "reason" },
          `永久链接 ${view.href} 尚未建成；上面的名字直接把条件展开到工作项列表。`,
        ),
        h(Form, { op: "saved_view.delete", redirect, csrf: ctx.csrf, className: "actions" },
          h("input", { type: "hidden", name: "id", value: view.id }),
          h("button", { type: "submit", "data-op": "saved_view.delete" }, "删除"),
        ),
      ),
    );
  };

  // Prefilled from wherever the reader came from, so "save what I am looking at" is one
  // step rather than retyping the conditions.
  const seedQuery: Record<string, string> = {};
  for (const key of VIEW_QUERY_KEYS) {
    const value = ctx.search.get(key);
    if (value) seedQuery[key] = value;
  }

  return h("div", null,
    h("h1", null, "保存的视图"),
    h("p", { className: "page-intro" },
      "列出你自己的视图，加上别人共享给你的。别人未共享的私有视图任何人都看不到，实例管理员也不例外——那是个人的工作集，不是被治理的记录。",
    ),
    refusal ? refusalBox(refusal) : null,
    items.length === 0
      ? h(Empty, null, "还没有保存过视图。")
      : h("ul", { className: "feed" }, ...items.map(row)),
    list
      ? h(Truncation, {
          shown: items.length,
          total: list.total,
          nextHref: list.nextCursor ? buildHref("/views", ctx.search, { cursor: list.nextCursor }) : null,
        })
      : null,
    h(Panel, { title: "保存一个视图" },
      h("p", { className: "reason" },
        "视图存的是一组具名条件，不是一段自由 JSON——正因为如此，它才能从这张表单里保存出来。"),
      h(Form, { op: "saved_view.create", redirect, csrf: ctx.csrf },
        h(Field, { label: "名称" }, h("input", { type: "text", name: "name", required: true })),
        h(Field, { label: "项目", hint: "留空表示跨全部你能看到的项目。" },
          h("select", { name: "projectId", defaultValue: projectId ?? "" },
            h("option", { value: "" }, "跨全部项目"),
            ...ctx.projects.map((project) =>
              h("option", { key: project.id, value: project.id }, `${project.key} · ${project.name}`),
            ),
          ),
        ),
        h(Field, { label: "类型", hint: "留空表示不限。" },
          h("input", { type: "text", name: "kind", defaultValue: String(seedQuery.kind ?? "") }),
        ),
        h(Field, { label: "状态", hint: "留空表示不限。" },
          h("input", { type: "text", name: "status", defaultValue: String(seedQuery.status ?? "") }),
        ),
        h(Field, { label: "标签" },
          h("input", { type: "text", name: "label", defaultValue: String(seedQuery.label ?? "") }),
        ),
        h(Field, { label: "检索词" },
          h("input", { type: "text", name: "q", defaultValue: String(seedQuery.q ?? "") }),
        ),
        h("div", { className: "actions" },
          h("label", { style: { display: "inline-flex", gap: "6px", alignItems: "center" } },
            h("input", { type: "checkbox", name: "isShared", value: "true" }),
            "共享给项目里的其他人",
          ),
          h("button", { type: "submit", "data-variant": "primary", "data-op": "saved_view.create" }, "保存"),
        ),
      ),
    ),
  );
}

// ---------------------------------------------------------------------------
// /search
// ---------------------------------------------------------------------------

export async function SearchPage(ctx: PageContext): Promise<ReactNode> {
  const query = ctx.search.get("q") ?? "";
  const subjectType = ctx.search.get("subjectType");
  const projectId = ctx.search.get("project");
  const limit = readInt(ctx.search.get("limit"), 25, 100);

  let result: SearchResult | null = null;
  let refusal: Refusal | null = null;
  if (query.trim() !== "") {
    const input: Record<string, unknown> = { q: query, limit };
    if (subjectType) input.subjectType = subjectType;
    if (projectId) input.projectId = projectId;
    try {
      result = await ctx.call<SearchResult>("search.query", input);
    } catch (error) {
      refusal = refusalOf(error);
    }
  }

  const hit = (item: SearchHit): ReactNode => {
    const href = subjectHref(item.subjectType, item.subjectId, { key: item.key, projectId: item.projectId });
    const isComment = item.subjectType === "comment";
    return h("li", { key: `${item.subjectType}:${item.subjectId}` },
      h("span", { className: "when" }, item.rank.toFixed(3)),
      h("div", null,
        h("div", { className: "row-meta" },
          subjectPill(item.subjectType),
          h("a", { href }, item.key ? `${item.key} ${item.title}` : item.title),
          item.status
            ? (isComment ? typePill(item.status) : statusPill(item.status))
            : null,
        ),
        // Snippets arrive delimited by guillemets rather than markup: a snippet is
        // somebody's own text on its way into a page, and «» is punctuation everywhere
        // and markup nowhere.
        h("div", { className: "prose" }, item.snippet),
        isComment
          ? h("p", { className: "reason" },
              "评论命中打开的是这条评论自己的页面；它挂在哪个主体上要在那里补一次，因为检索结果里没有这个字段。",
            )
          : null,
      ),
    );
  };

  const typeLink = (value: string | null, label: string): ReactNode =>
    h("a", {
      key: label,
      href: buildHref("/search", ctx.search, { subjectType: value }),
      "aria-current": (subjectType ?? null) === value ? "true" : undefined,
    }, label);

  return h("div", null,
    h("h1", null, "检索"),
    h("p", { className: "page-intro" },
      "一次检索所有你能看到的东西：工作项、知识页、项目、空间、门、审议、裁决、评论。看不到的项目不会出现在结果里。",
    ),
    h("div", { className: "filterface" },
      h("form", { method: "GET", action: "/search", className: "searchform" },
        ...[...ctx.search.entries()]
          .filter(([key]) => key !== "q")
          .map(([key, value]) => h("input", { key, type: "hidden", name: key, value })),
        h("input", {
          type: "search", name: "q", placeholder: "检索全部",
          defaultValue: query,
          "data-set": query ? "true" : "false",
          autoFocus: true,
        }),
      ),
      h("div", { className: "viewtabs" },
        typeLink(null, "全部类型"),
        ...SUBJECT_TYPES.map((type) => typeLink(type, SUBJECT_LABEL[type] ?? type)),
      ),
      result
        ? h("div", { className: "conditions" },
            h("span", { className: "tally" }, h("b", null, String(result.items.length)), ` / ${result.total}`),
          )
        : null,
    ),
    h("p", { className: "reason" },
      "排序如实说明：按 ts_rank_cd 的相关度倒序，归一化除以文档长度（32），标题的权重高于正文；同分时按写入时间倒序，再按主体 id。这里没有「下一页」——名次是随索引变动的，续页会漏掉一些行又重复另一些，所以只说上限和总数。",
    ),
    h("p", { className: "reason" },
      "两个字的中文查得到：索引把中日韩连写切成重叠的二元组，写入端与查询端用的是同一个切分函数。多个词之间是「与」，都命中才算。",
    ),
    refusal ? refusalBox(refusal) : null,
    query.trim() === ""
      ? h(Empty, null, "输入要找的东西。")
      : result === null
        ? null
        : result.items.length === 0
          ? h(Empty, null, `没有匹配「${query}」的东西。`)
          : h("ul", { className: "feed" }, ...result.items.map(hit)),
    result
      ? h(Truncation, { shown: result.items.length, total: result.total })
      : null,
  );
}
