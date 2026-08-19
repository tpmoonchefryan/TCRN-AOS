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
  buildHref,
  h,
  rowsList,
  tone,
  type PageContext,
  type ReactNode,
} from "../ui-kit.js";
import { hrefResetConditions } from "../url.js";

/**
 * Instance administration, the trash, the audit stream, and the two project screens that
 * are not a list of work items.
 *
 * These sit in one module for the same reason the operations do: the trash and the stream
 * are how a mistake is found, erasure is the one door out of the append-only tables, and
 * accounts are who all of it is attributed to. Nothing here reads the database — every
 * screen goes through `ctx.call`, so a page can only ever show what the API would return.
 */

// ---------------------------------------------------------------------------
// Shapes, copied from the operations' declared outputs
// ---------------------------------------------------------------------------

interface AccountRow {
  principalId: string;
  handle: string;
  displayName: string;
  email: string | null;
  kind: string;
  isInstanceAdmin: boolean;
  mustChangePassword: boolean;
  disabledAt: string | null;
  version: number;
  createdAt: string;
}

interface AccountList {
  items: AccountRow[];
  nextCursor: string | null;
  total: number;
  truncated: boolean;
}

interface TrashRow {
  subjectType: string;
  subjectId: string;
  ref: string;
  title: string;
  projectId: string | null;
  deletedAt: string;
  deletedById: string | null;
  deletedByLabel: string;
  deletedByAttribution: string;
}

interface TrashList {
  items: TrashRow[];
  nextCursor: string | null;
  total: number;
  truncated: boolean;
}

interface ActivityRow {
  id: string;
  actorId: string | null;
  actorHandle: string | null;
  actorLabel: string;
  attribution: string;
  action: string;
  subjectType: string;
  subjectId: string;
  projectId: string | null;
  fieldNames: string[];
  revisionRef: string | null;
  occurredAt: string;
}

interface ActivityList {
  items: ActivityRow[];
  nextCursor: string | null;
  truncated: boolean;
}

interface ProjectRecord {
  id: string;
  key: string;
  name: string;
  descriptionMd: string;
  governanceEnabled: boolean;
  version: number;
  createdAt: string;
}

interface MemberRow {
  principalId: string;
  handle: string;
  displayName: string;
  kind: string;
  role: string;
}

interface CountOnly {
  total: number;
}

const ACCOUNT_KINDS = ["human", "agent", "service"] as const;
const PROJECT_ROLES = ["viewer", "contributor", "maintainer", "admin"] as const;

/** activity.list's subjectType enum, verbatim. A word not in it is refused as invalid. */
const SUBJECT_TYPES = [
  "work_item", "page", "project", "space", "gate",
  "deliberation", "decision", "release", "principal", "comment", "attachment",
] as const;

/** The three tables admin.purge_revisions will release. Nothing else is purgeable. */
const PURGEABLE_SUBJECTS = ["work_item", "comment", "page"] as const;

const ROLE_LABEL: Record<string, string> = {
  viewer: "viewer 只读",
  contributor: "contributor 参与",
  maintainer: "maintainer 维护",
  admin: "admin 管理",
};

const KIND_LABEL: Record<string, string> = {
  human: "human 人",
  agent: "agent 智能体",
  service: "service 服务",
};

const SUBJECT_LABEL: Record<string, string> = {
  work_item: "工作项",
  page: "页面",
  project: "项目",
  space: "知识空间",
  gate: "门",
  deliberation: "审议",
  decision: "决定",
  release: "发布",
  principal: "账户",
  comment: "评论",
  attachment: "附件",
};

// ---------------------------------------------------------------------------
// Small shared pieces
// ---------------------------------------------------------------------------

function stamp(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
}

function pathSegments(pathname: string): string[] {
  return pathname.split("/").filter((part) => part.length > 0);
}

function statusPill(status: string): ReactNode {
  const toneName = tone(status);
  const label = STATUS_LABEL[status] ?? status;
  // Pill's toneName is an optional string, and under exactOptionalPropertyTypes an
  // explicit undefined is not the same as an absent key.
  return toneName ? h(Pill, { toneName }, label) : h(Pill, {}, label);
}

/**
 * Read the message off whatever a refused call threw.
 *
 * A forbidden and a not-found are ordinary answers on these screens — a project you are
 * not a member of gives one of them — so they belong in the page, not in a 500.
 */
function refusal(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.length > 0) return message;
  }
  return "这次读取被拒绝了，没有更多说明。";
}

/**
 * Drop one condition AND the cursor together.
 *
 * `hrefWithout` cannot do this: a keyset cursor carries a digest of the filters it was
 * minted under, so a link that removes a filter but keeps the cursor produces
 * `cursor_filter_mismatch` instead of the unfiltered list the reader asked for.
 */
function dropCondition(pathname: string, search: URLSearchParams, key: string): string {
  return buildHref(pathname, search, { [key]: null, cursor: null });
}

function notAnAdmin(title: string): ReactNode {
  return h("div", null,
    h("h1", null, title),
    h("p", { className: "page-intro" }, "这一屏属于实例管理。"),
    h(Empty, {},
      "你的账户不是实例管理员，所以这里不显示账户、抹除或任何管理控件——" +
      "显示一个按下去必然被拒绝的按钮，不是权限提示，是浪费你一次点击。" +
      "需要访问，请让现有的实例管理员为你的账户打开管理员标记。"),
  );
}

/** The actor of a recorded act, in the operation's own three states. */
function actorOf(attribution: string, label: string): ReactNode {
  // "unknown" is the operation's word for "the stream carries no actor here". It is not a
  // name, so it must not be rendered as one.
  return attribution === "unknown"
    ? h(Attribution, { label: null })
    : h(Attribution, { label });
}

function resolveProjectId(ctx: PageContext, segment: string): string {
  if (segment === "") return "";
  const byId = ctx.projects.find((project) => project.id === segment);
  if (byId) return byId.id;
  // A person who types or shares `/projects/AOS` means the project keyed AOS. The
  // operation only accepts the internal id, so translate here rather than refusing.
  const byKey = ctx.projects.find((project) => project.key.toUpperCase() === segment.toUpperCase());
  return byKey ? byKey.id : segment;
}

// ---------------------------------------------------------------------------
// /admin/accounts
// ---------------------------------------------------------------------------

export async function AccountsPage(ctx: PageContext): Promise<ReactNode> {
  if (!ctx.actor.isInstanceAdmin) return notAnAdmin("账户");

  const search = ctx.search;
  const includeDisabled = search.get("includeDisabled") !== "false";
  const query = search.get("q") ?? "";
  const cursor = search.get("cursor");

  const list = await ctx.call<AccountList>("admin.list_accounts", {
    q: query === "" ? undefined : query,
    includeDisabled,
    limit: 50,
    cursor: cursor ?? undefined,
  });

  // The operation refuses to disable the last enabled instance administrator, because an
  // instance with none can never be administered again and nothing inside the product
  // undoes it. Work out whether this page is looking at that account, so the control is
  // absent with a stated reason rather than present and certain to fail.
  const enabledAdmins = list.items.filter((item) => item.isInstanceAdmin && item.disabledAt === null);
  const soleAdminId = !list.truncated && enabledAdmins.length === 1
    ? enabledAdmins[0]?.principalId ?? null
    : null;

  const viewLink = (value: boolean, label: string): ReactNode =>
    h("a", {
      key: label,
      href: buildHref("/admin/accounts", search, { includeDisabled: value ? null : "false", cursor: null }),
      "aria-current": includeDisabled === value ? "true" : undefined,
    }, label);

  const row = (account: AccountRow): ReactNode => {
    const disabled = account.disabledAt !== null;
    const isSelf = account.principalId === ctx.actor.principalId;
    const isSoleAdmin = soleAdminId !== null && soleAdminId === account.principalId;
    const detail = `/admin/accounts/${encodeURIComponent(account.principalId)}`;

    let control: ReactNode;
    if (isSelf) {
      control = h("span", { className: "reason" }, "不能在这里停用你自己：会话会立刻失效");
    } else if (isSoleAdmin && !disabled) {
      control = h("span", { className: "reason" }, "最后一个启用中的实例管理员，停用会被拒绝");
    } else {
      control = h(Form, { op: "admin.set_account_disabled", redirect: "/admin/accounts", csrf: ctx.csrf },
        h("input", { type: "hidden", name: "principalId", value: account.principalId }),
        h("input", { type: "hidden", name: "expectedVersion", value: String(account.version) }),
        h("input", { type: "hidden", name: "disabled", value: disabled ? "false" : "true" }),
        h("button", { type: "submit", "data-op": "admin.set_account_disabled" }, disabled ? "启用" : "停用"),
      );
    }

    return h("div", { key: account.principalId, className: "row" },
      h("span", { className: "row-key" }, account.handle),
      h("span", { className: "row-title" },
        h("a", { href: detail }, account.displayName),
      ),
      h("div", { className: "row-meta" },
        h(Pill, {}, KIND_LABEL[account.kind] ?? account.kind),
        account.isInstanceAdmin ? h(Pill, { toneName: "active" }, "实例管理员") : null,
        account.mustChangePassword ? h(Pill, {}, "待改口令") : null,
        disabled
          ? h(Pill, { toneName: "blocked" }, `已停用 ${stamp(account.disabledAt ?? "")}`)
          : h(Pill, {}, "启用中"),
        control,
      ),
    );
  };

  return h("div", null,
    h("h1", null, "账户"),
    h("p", { className: "page-intro" }, "这个实例上的全部账户。人、智能体、服务在同一份目录里，因为它们都会成为活动流里的执行者。"),
    h("div", { className: "filterface" },
      h("div", { className: "viewtabs" },
        viewLink(true, "全部"),
        viewLink(false, "仅启用中"),
      ),
      h("div", { className: "conditions" },
        h("form", { method: "GET", action: "/admin/accounts", className: "searchform" },
          ...[...search.entries()]
            .filter(([key]) => key !== "q" && key !== "cursor")
            .map(([key, value]) => h("input", { key, type: "hidden", name: key, value })),
          h("input", {
            type: "search",
            name: "q",
            placeholder: "检索账号、名称、邮箱",
            defaultValue: query,
            "data-set": query !== "" ? "true" : "false",
          }),
        ),
        h("div", { className: "vr" }),
        h("span", { className: "tally" }, h("b", null, String(list.items.length)), ` / ${list.total}`),
      ),
      query !== ""
        ? h("div", { className: "applied" },
            h("span", { className: "lead" }, "已应用"),
            h("a", { className: "chip", href: dropCondition("/admin/accounts", search, "q") },
              h("span", null, `检索 "${query}"`),
              h("span", { className: "x" }, "✕"),
            ),
            h("a", { className: "resetlink", href: hrefResetConditions("/admin/accounts", search) }, "重置视图"),
          )
        : null,
    ),
    list.items.length === 0
      ? h(Empty, {}, "没有匹配的账户。")
      : h("div", { className: "rows" }, ...list.items.map(row)),
    h(Truncation, {
      shown: list.items.length,
      total: list.total,
      nextHref: list.nextCursor ? buildHref("/admin/accounts", search, { cursor: list.nextCursor }) : null,
    }),
    h(Panel, { title: "新建账户" },
      h("p", { className: "reason" },
        "新账户一律带上「必须修改口令」：这里输入的口令是管理员知道的交接凭据，还不是本人自己的口令。" +
        "本人首次登录后会被要求改掉它。"),
      h(Form, { op: "admin.create_account", redirect: "/admin/accounts", csrf: ctx.csrf },
        h(Field, { label: "账号（handle，全实例唯一，不区分大小写）" },
          h("input", { type: "text", name: "handle", required: true, maxLength: 64 }),
        ),
        h(Field, { label: "显示名称" },
          h("input", { type: "text", name: "displayName", required: true, maxLength: 200 }),
        ),
        h(Field, { label: "类别", hint: "类别只是标签，它本身不授予任何权限。" },
          h("select", { name: "kind", defaultValue: "human" },
            ...ACCOUNT_KINDS.map((kind) => h("option", { key: kind, value: kind }, KIND_LABEL[kind] ?? kind)),
          ),
        ),
        h(Field, { label: "邮箱（可空）" },
          h("input", { type: "text", name: "email", maxLength: 320 }),
        ),
        h(Field, { label: "初始口令（至少 12 位）" },
          h("input", { type: "password", name: "password", required: true, minLength: 12 }),
        ),
        h("div", { className: "actions" },
          h("label", { style: { display: "inline-flex", gap: "6px", alignItems: "center" } },
            h("input", { type: "checkbox", name: "isInstanceAdmin", value: "true" }),
            "同时设为实例管理员",
          ),
          h("button", { type: "submit", "data-variant": "primary", "data-op": "admin.create_account" }, "创建账户"),
        ),
      ),
    ),
  );
}

// ---------------------------------------------------------------------------
// /admin/accounts/{principalId}
// ---------------------------------------------------------------------------

const SCAN_PAGE = 200;
const SCAN_PAGES = 20;

/**
 * Find one account by id.
 *
 * There is no `admin.get_account`, and `admin.list_accounts`'s `q` matches handle, display
 * name and email — never the id. So the only honest way to reach one account from its id
 * is to page the list. The bound is stated rather than infinite, and a scan that hits it
 * says so on the page instead of reporting "no such account".
 */
async function findAccount(
  ctx: PageContext,
  principalId: string,
): Promise<{ account: AccountRow | null; scanned: number; exhausted: boolean }> {
  let cursor: string | null = null;
  let scanned = 0;
  for (let page = 0; page < SCAN_PAGES; page += 1) {
    // Every page carries the same filters and the same limit: a cursor minted under one
    // set of filters is refused under another.
    // Annotated rather than inferred: `cursor` is assigned from this result and read back
    // into the next call's input, and TypeScript reads that round trip as circular.
    const result: AccountList = await ctx.call<AccountList>("admin.list_accounts", {
      includeDisabled: true,
      limit: SCAN_PAGE,
      cursor: cursor ?? undefined,
    });
    scanned += result.items.length;
    const found = result.items.find((item) => item.principalId === principalId);
    if (found) return { account: found, scanned, exhausted: false };
    if (!result.nextCursor) return { account: null, scanned, exhausted: false };
    cursor = result.nextCursor;
  }
  return { account: null, scanned, exhausted: true };
}

export async function AccountPage(ctx: PageContext): Promise<ReactNode> {
  if (!ctx.actor.isInstanceAdmin) return notAnAdmin("账户");

  const segments = pathSegments(ctx.pathname);
  const principalId = segments[2] ?? "";

  const crumb = breadcrumb([
    { href: "/admin/accounts", label: "账户" },
    { label: principalId === "" ? "（未指定）" : principalId },
  ]);

  if (principalId === "") {
    return h("div", null,
      crumb,
      h("h1", null, "账户"),
      h(Empty, {}, "这个地址没有带上账户 id。回到账户列表挑一个。"),
    );
  }

  const { account, scanned, exhausted } = await findAccount(ctx, principalId);

  if (!account) {
    return h("div", null,
      crumb,
      h("h1", null, "找不到这个账户"),
      h(Empty, {},
        exhausted
          ? `已经翻过 ${scanned} 个账户仍未命中，并且还有更多没翻完——这一屏按 id 找人只能靠翻页。` +
            "回列表用账号或名称检索会更快。"
          : `这个实例上的 ${scanned} 个账户里没有 id 为 ${principalId} 的一个。`),
      h("p", null, h("a", { href: "/admin/accounts" }, "回到账户列表")),
    );
  }

  const disabled = account.disabledAt !== null;
  const isSelf = account.principalId === ctx.actor.principalId;
  const detail = `/admin/accounts/${encodeURIComponent(account.principalId)}`;

  // A read that failed is not an empty list. Keeping the refusal lets the panel say which
  // of the two happened instead of showing "nothing here" for both.
  let activity: ActivityList | null = null;
  let activityRefused: string | null = null;
  try {
    activity = await ctx.call<ActivityList>("activity.list", {
      subjectType: "principal",
      subjectId: account.principalId,
      limit: 30,
    });
  } catch (error: unknown) {
    activityRefused = refusal(error);
  }

  // TypeScript does not carry a narrowing of a `let` into a closure, so the rows are
  // pinned to a const before the callback that reads them.
  const activityItems = activity?.items ?? [];

  return h("div", null,
    breadcrumb([
      { href: "/admin/accounts", label: "账户" },
      { label: account.handle },
    ]),
    h("h1", null, `${account.handle} · ${account.displayName}`),
    h("div", { className: "grid2" },
      h("div", null,
        h(Panel, { title: "这个账户" },
          h("dl", { className: "kv" },
            h("dt", null, "账号"), h("dd", null, account.handle),
            h("dt", null, "显示名称"), h("dd", null, account.displayName),
            h("dt", null, "邮箱"), h("dd", null, account.email ?? h("span", { className: "unread" }, "未填写")),
            h("dt", null, "类别"), h("dd", null, KIND_LABEL[account.kind] ?? account.kind),
            h("dt", null, "实例管理员"), h("dd", null, account.isInstanceAdmin ? "是" : "否"),
            h("dt", null, "必须改口令"), h("dd", null, account.mustChangePassword ? "是" : "否"),
            h("dt", null, "状态"), h("dd", null,
              disabled
                ? h(Pill, { toneName: "blocked" }, `已停用 ${stamp(account.disabledAt ?? "")}`)
                : h(Pill, {}, "启用中"),
            ),
            h("dt", null, "内部 id"), h("dd", null, account.principalId),
            h("dt", null, "修订"), h("dd", null, `r${account.version}`),
            h("dt", null, "创建于"), h("dd", null, stamp(account.createdAt)),
          ),
        ),
        h(Panel, { title: disabled ? "启用" : "停用" },
          h("p", { className: "reason" },
            "停用会立刻让这个账户的会话与登录失效，并把已经签发的会话一并吊销；账户本身永远不删除，" +
            "因为活动流里的历史不该随着访问权限一起消失。API 令牌是另一套凭据，停用不会碰它们。"),
          isSelf
            ? h("p", { className: "reason" },
                "这里不提供停用你自己的控件：它会吊销你当前用着的这个会话，而产品内没有任何路径能把它撤回。" +
                "确实要停用自己，请让另一位实例管理员来做。")
            : h(Form, { op: "admin.set_account_disabled", redirect: detail, csrf: ctx.csrf },
                h("input", { type: "hidden", name: "principalId", value: account.principalId }),
                h("input", { type: "hidden", name: "expectedVersion", value: String(account.version) }),
                h("input", { type: "hidden", name: "disabled", value: disabled ? "false" : "true" }),
                h("p", { className: "reason" },
                  `这次提交带着 r${account.version}。如果期间有别人改了这个账户，操作会被拒绝而不是覆盖对方。` +
                  (account.isInstanceAdmin && !disabled
                    ? "另外：如果它是最后一个启用中的实例管理员，操作也会被拒绝。"
                    : "")),
                h("div", { className: "actions" },
                  h("button", { type: "submit", "data-op": "admin.set_account_disabled" }, disabled ? "启用这个账户" : "停用这个账户"),
                ),
              ),
        ),
        h(Panel, { title: "重设口令" },
          h("p", { className: "reason" },
            "重设不带修订号：它整个覆盖凭据，不与并发编辑合并。重设之后这个账户的全部会话立即吊销，" +
            "并被要求下次登录改口令。API 令牌不受影响——要一次断掉全部访问，用停用。"),
          isSelf
            ? h("p", { className: "reason" },
                "改自己的口令走「账户」那一屏：那里会要求你输入当前口令，而这里的重设不会。",
                h("a", { href: "/account/password" }, "去修改我的口令"))
            : h(Form, { op: "admin.reset_password", redirect: detail, csrf: ctx.csrf },
                h("input", { type: "hidden", name: "principalId", value: account.principalId }),
                h(Field, { label: "新口令（至少 12 位）" },
                  h("input", { type: "password", name: "newPassword", required: true, minLength: 12 }),
                ),
                h("div", { className: "actions" },
                  h("button", { type: "submit", "data-op": "admin.reset_password" }, "重设口令"),
                ),
              ),
        ),
      ),
      h("div", null,
        h(Panel, { title: "这个账户的活动" },
          h("p", { className: "reason" }, "按序号倒序，最新在上。"),
          activityRefused !== null
            ? h("div", { className: "error" }, `读不到这个账户的活动：${activityRefused}`)
            : activityItems.length === 0
              ? h(Empty, {}, "还没有关于这个账户的记录。")
              : h("ul", { className: "feed" },
                  ...activityItems.map((event) =>
                    h("li", { key: event.id },
                      h("span", { className: "when" }, stamp(event.occurredAt)),
                      h("span", null,
                        actorOf(event.attribution, event.actorLabel),
                        ` · ${event.action}`,
                        event.fieldNames.length > 0
                          ? h("span", { className: "reason" }, ` (${event.fieldNames.join(", ")})`)
                          : null,
                      ),
                    ),
                  ),
                ),
          h("p", null,
            h("a", {
              href: buildHref("/activity", { subjectType: "principal", subjectId: account.principalId }),
            }, "在活动流里查看"),
          ),
        ),
      ),
    ),
  );
}

// ---------------------------------------------------------------------------
// /admin/erasure
// ---------------------------------------------------------------------------

export async function ErasurePage(ctx: PageContext): Promise<ReactNode> {
  if (!ctx.actor.isInstanceAdmin) return notAnAdmin("抹除");

  const search = ctx.search;
  const requestedType = search.get("subjectType") ?? "";
  // Only three subject types retain revisions at all. A link naming any other one falls
  // back to the first purgeable type rather than pre-selecting something that cannot be
  // purged.
  const subjectType = (PURGEABLE_SUBJECTS as readonly string[]).includes(requestedType)
    ? requestedType
    : "work_item";
  const subjectId = search.get("subjectId") ?? "";

  // A page is the one purgeable subject whose retained revisions can be counted before the
  // fact, so say how many are about to be destroyed. The other two have no such operation,
  // and inventing a number for them would be worse than saying nothing.
  let revisionNote: ReactNode = null;
  if (subjectType === "page" && subjectId !== "") {
    const counted = await ctx.call<CountOnly>("page.revisions", { pageId: subjectId, limit: 1 })
      .then((result) => `这个页面现在留有 ${result.total} 条历史版本，它们会全部消失。`)
      .catch((error: unknown) => `读不到这个页面的历史版本数：${refusal(error)}`);
    revisionNote = h("p", { className: "reason" }, counted);
  }

  return h("div", null,
    h("h1", null, "抹除"),
    h("p", { className: "page-intro" }, "这是本产品里唯一不可逆的操作。"),
    h("div", { className: "error" },
      h("p", { style: { margin: "0 0 6px" } },
        "抹除会删掉一个主体保留下来的全部历史版本。那是这些旧值仅存的一份副本——" +
        "没有回收站、没有备份入口、没有撤销，产品内没有任何路径能把它们找回来。"),
      h("p", { style: { margin: "0 0 6px" } },
        "不可变的活动流不会被动到：谁在什么时候改过什么，记录仍然完整地留着，" +
        "只是那些指向历史版本的指针从此指向不存在的行。" +
        "抹除这件事本身也会被记进一本不能被抹除的台账。"),
      h("p", { style: { margin: 0 } },
        "这个操作没有对应的 MCP 工具：它需要一个事后能被问「为什么」的人，而不是一个照着读到的指令行动的智能体。"),
    ),
    h(Panel, { title: "抹除一个主体的历史版本" },
      h("p", { className: "reason" },
        "只有三类主体保留历史版本，也就只有这三类能被抹除：工作项、评论、页面。" +
        "这里填的是记录的内部 id（形如 wi_…、cm_…、pg_…），不是 TCRN-123 这样的人读键——" +
        "抹除是按内部 id 定位历史版本行的。不知道 id，先去活动流里找。"),
      revisionNote,
      h(Form, { op: "admin.purge_revisions", redirect: "/admin/erasure", csrf: ctx.csrf },
        h(Field, { label: "主体类别" },
          h("select", { name: "subjectType", defaultValue: subjectType },
            ...PURGEABLE_SUBJECTS.map((value) =>
              h("option", { key: value, value }, SUBJECT_LABEL[value] ?? value)),
          ),
        ),
        h(Field, { label: "主体内部 id" },
          h("input", { type: "text", name: "subjectId", required: true, defaultValue: subjectId, placeholder: "wi_…" }),
        ),
        h(Field, {
          label: "理由（必填，会写进抹除台账）",
          hint: "台账上的理由是这件事留下的唯一解释，日后别人只能读到你现在写的这句。",
        },
          // Deliberately never prefilled from the URL. A reason that arrived in a link is
          // not a reason anybody typed, and this is the one operation where that matters.
          h("textarea", { name: "reason", required: true, maxLength: 2000, style: { minHeight: "90px" } }),
        ),
        h("div", { className: "actions" },
          h("button", { type: "submit", "data-op": "admin.purge_revisions" }, "永久抹除这些历史版本"),
        ),
      ),
    ),
    h(Panel, { title: "抹除之前" },
      h("p", { className: "reason" }, "先去看一眼将要失去什么，以及这条记录被谁改过。"),
      h("p", null,
        h("a", {
          href: subjectId === ""
            ? "/activity"
            : buildHref("/activity", { subjectType, subjectId }),
        }, "在活动流里查看这个主体"),
      ),
    ),
  );
}

// ---------------------------------------------------------------------------
// /trash
// ---------------------------------------------------------------------------

export async function TrashPage(ctx: PageContext): Promise<ReactNode> {
  const search = ctx.search;
  const projectId = search.get("project");
  const cursor = search.get("cursor");

  const list = await ctx.call<TrashList>("trash.list", {
    projectId: projectId ?? undefined,
    limit: 50,
    cursor: cursor ?? undefined,
  });

  const scopeLabel = projectId
    ? ctx.projects.find((project) => project.id === projectId)?.key ?? projectId
    : null;

  const row = (item: TrashRow): ReactNode => {
    const isWorkItem = item.subjectType === "work_item";
    return h("div", { key: `${item.subjectType}:${item.subjectId}`, className: "row" },
      h("span", { className: "row-key" }, item.ref),
      h("span", { className: "row-title" }, item.title),
      h("div", { className: "row-meta" },
        h(Pill, {}, SUBJECT_LABEL[item.subjectType] ?? item.subjectType),
        h(Pill, {}, `删除于 ${stamp(item.deletedAt)}`),
        h("span", { className: "reason" },
          "由 ", actorOf(item.deletedByAttribution, item.deletedByLabel), " 删除"),
        isWorkItem
          // Back to the first page, not to the cursor this row was read under: the restored
          // row leaves the list, so that window no longer starts where the reader left it.
          ? h(Form, { op: "work_item.restore", redirect: buildHref("/trash", search, { cursor: null }), csrf: ctx.csrf },
              h("input", { type: "hidden", name: "key", value: item.ref }),
              h("button", { type: "submit", "data-op": "work_item.restore" }, "恢复"),
            )
          // page.delete exists; a matching page restore does not. `page.restore_revision`
          // is a different act — it rolls a live page back to an older revision, and it
          // refuses a deleted page. So there is no control here to render, and saying that
          // is the honest thing to put in its place.
          : h("span", { className: "reason" }, "页面还不能从这里恢复：本产品尚未建成页面的恢复操作"),
      ),
    );
  };

  return h("div", null,
    h("h1", null, "回收站"),
    h("p", { className: "page-intro" },
      "删除是软的：工作项和页面都先落到这里，而不是当场消失——一个删除不可逆的产品，教会人囤积。" +
      "工作项可以从这里恢复；页面的恢复操作还没有建成，所以页面行上没有按钮。"),
    h("div", { className: "filterface" },
      h("div", { className: "conditions" },
        h("span", { className: "tally" }, h("b", null, String(list.items.length)), ` / ${list.total}`),
        h("div", { className: "vr" }),
        h("span", { className: "reason" },
          scopeLabel ? `范围：${scopeLabel}` : "范围：你能看到的全部项目（用顶栏的范围切换）"),
      ),
      scopeLabel
        ? h("div", { className: "applied" },
            h("span", { className: "lead" }, "已应用"),
            h("a", { className: "chip", href: dropCondition("/trash", search, "project") },
              h("span", null, `项目 ${scopeLabel}`),
              h("span", { className: "x" }, "✕"),
            ),
          )
        : null,
    ),
    list.items.length === 0
      ? h(Empty, {}, "回收站是空的。")
      : h("div", { className: "rows" }, ...list.items.map(row)),
    h(Truncation, {
      shown: list.items.length,
      total: list.total,
      nextHref: list.nextCursor ? buildHref("/trash", search, { cursor: list.nextCursor }) : null,
    }),
  );
}

// ---------------------------------------------------------------------------
// /activity
// ---------------------------------------------------------------------------

export async function ActivityPage(ctx: PageContext): Promise<ReactNode> {
  const search = ctx.search;
  const rawSubjectType = search.get("subjectType") ?? "";
  const rawSubjectId = search.get("subjectId") ?? "";
  const projectId = search.get("project");
  const cursor = search.get("cursor");

  // A URL is typed and pasted by people. A subjectType the operation's enum does not carry
  // is refused as invalid, so drop it here and say so, rather than turning a mistyped link
  // into an error screen.
  const knownType = (SUBJECT_TYPES as readonly string[]).includes(rawSubjectType);
  const subjectType = knownType ? rawSubjectType : "";
  const unknownType = rawSubjectType !== "" && !knownType;

  // The stream is indexed on the pair. A subject id with no type would scan the one table
  // here that never stops growing, so the operation refuses it — send only what it accepts
  // and say on the page why the other half was ignored.
  const subjectIdUsable = rawSubjectId !== "" && subjectType !== "";
  const orphanSubjectId = rawSubjectId !== "" && subjectType === "";

  const list = await ctx.call<ActivityList>("activity.list", {
    subjectType: subjectType === "" ? undefined : subjectType,
    subjectId: subjectIdUsable ? rawSubjectId : undefined,
    projectId: projectId ?? undefined,
    limit: 50,
    cursor: cursor ?? undefined,
  });

  const scopeLabel = projectId
    ? ctx.projects.find((project) => project.id === projectId)?.key ?? projectId
    : null;

  const typeDropdown = h("details", { className: "dropdown", "data-set": subjectType !== "" ? "true" : "false" },
    h("summary", null,
      h("span", { className: "label" }, "主体类别"),
      h("span", { className: "value" }, subjectType === "" ? "全部" : SUBJECT_LABEL[subjectType] ?? subjectType),
      h("span", { "aria-hidden": "true" }, "▾"),
    ),
    h("div", { className: "dropdown-menu" },
      h("a", {
        href: buildHref("/activity", search, { subjectType: null, subjectId: null, cursor: null }),
        "aria-current": subjectType === "" ? "true" : undefined,
      }, "全部类别"),
      h("hr", null),
      ...SUBJECT_TYPES.map((value) =>
        h("a", {
          key: value,
          href: buildHref("/activity", search, { subjectType: value, cursor: null }),
          "aria-current": subjectType === value ? "true" : undefined,
        }, SUBJECT_LABEL[value] ?? value),
      ),
    ),
  );

  const appliedChips: ReactNode[] = [];
  if (subjectType !== "") {
    appliedChips.push(
      h("a", { key: "subjectType", className: "chip", href: dropCondition("/activity", search, "subjectType") },
        h("span", null, `类别 ${SUBJECT_LABEL[subjectType] ?? subjectType}`),
        h("span", { className: "x" }, "✕"),
      ),
    );
  }
  if (rawSubjectId !== "") {
    appliedChips.push(
      h("a", { key: "subjectId", className: "chip", href: dropCondition("/activity", search, "subjectId") },
        h("span", null, `主体 ${rawSubjectId}`),
        h("span", { className: "x" }, "✕"),
      ),
    );
  }
  if (scopeLabel) {
    appliedChips.push(
      h("a", { key: "project", className: "chip", href: dropCondition("/activity", search, "project") },
        h("span", null, `项目 ${scopeLabel}`),
        h("span", { className: "x" }, "✕"),
      ),
    );
  }

  return h("div", null,
    h("h1", null, "活动"),
    h("p", { className: "page-intro" },
      "谁在什么时候做了什么。这份流是追加写的：记录只会新增，不会被改写。"),
    h("div", { className: "filterface" },
      h("div", { className: "conditions" },
        h("form", { method: "GET", action: "/activity", className: "searchform" },
          ...[...search.entries()]
            .filter(([key]) => key !== "subjectId" && key !== "cursor")
            .map(([key, value]) => h("input", { key, type: "hidden", name: key, value })),
          h("input", {
            type: "search",
            name: "subjectId",
            placeholder: "主体内部 id",
            defaultValue: rawSubjectId,
            "data-set": rawSubjectId !== "" ? "true" : "false",
          }),
        ),
        typeDropdown,
        h("div", { className: "vr" }),
        h("span", { className: "tally" }, h("b", null, String(list.items.length)), " 条"),
        h("div", { className: "spacer" }),
        h("span", { className: "reason" },
          scopeLabel ? `范围：${scopeLabel}` : "范围：你能看到的全部项目（用顶栏的范围切换）"),
      ),
      appliedChips.length > 0
        ? h("div", { className: "applied" },
            h("span", { className: "lead" }, "已应用"),
            ...appliedChips,
            h("a", { className: "resetlink", href: hrefResetConditions("/activity", search) }, "重置视图"),
          )
        : null,
    ),
    unknownType
      ? h("div", { className: "notice" },
          `地址里的主体类别 “${rawSubjectType}” 不是这条流认得的类别，已经忽略。认得的类别在上面的下拉里。`)
      : null,
    orphanSubjectId
      ? h("div", { className: "notice" },
          `主体 id ${rawSubjectId} 这次没有生效：按 id 过滤必须同时指定主体类别，否则要扫过整条流。先在上面选一个类别。`)
      : null,
    h("p", { className: "reason" },
      "按序号倒序，最新在最上面——不是按时间戳。同一毫秒内写入的两条记录，用时间排不出先后。"),
    list.items.length === 0
      ? h(Empty, {}, "这个范围里还没有活动记录。")
      : h("ul", { className: "feed" },
          ...list.items.map((event) =>
            h("li", { key: event.id },
              h("span", { className: "when" }, stamp(event.occurredAt)),
              h("span", null,
                actorOf(event.attribution, event.actorLabel),
                ` · ${event.action} · `,
                h("a", {
                  href: buildHref("/activity", { subjectType: event.subjectType, subjectId: event.subjectId }),
                }, `${SUBJECT_LABEL[event.subjectType] ?? event.subjectType} ${event.subjectId}`),
                event.fieldNames.length > 0
                  ? h("span", { className: "reason" }, ` (${event.fieldNames.join(", ")})`)
                  : null,
                ctx.actor.isInstanceAdmin && (PURGEABLE_SUBJECTS as readonly string[]).includes(event.subjectType)
                  ? h("a", {
                      className: "reason",
                      href: buildHref("/admin/erasure", { subjectType: event.subjectType, subjectId: event.subjectId }),
                    }, " 抹除历史版本")
                  : null,
              ),
            ),
          ),
        ),
    // No total, and none is invented: a count over an append-only stream grows without
    // bound and would cost more than the page it describes. `truncated` is the whole of
    // what the operation can honestly say.
    list.truncated
      ? h("p", { className: "truncation" },
          `这一页 ${list.items.length} 条，前面还有更早的记录。这条流不报总数——对一条只增不减的流做计数，代价比这一页本身还大。`,
          list.nextCursor
            ? h("a", { href: buildHref("/activity", search, { cursor: list.nextCursor }) }, " 更早一页")
            : null,
        )
      : null,
  );
}

// ---------------------------------------------------------------------------
// /projects/{projectId}/settings
// ---------------------------------------------------------------------------

export async function ProjectSettingsPage(ctx: PageContext): Promise<ReactNode> {
  const segments = pathSegments(ctx.pathname);
  const projectId = resolveProjectId(ctx, segments[1] ?? "");

  if (projectId === "") {
    return h("div", null,
      h("h1", null, "项目设置"),
      h(Empty, {}, "这个地址没有带上项目 id。"),
      h("p", null, h("a", { href: "/projects" }, "回到项目列表")),
    );
  }

  // Pinned to a const before anything closes over it: a `let` assigned inside a try loses
  // its definite-assignment proof the moment a callback reads it.
  let projectRead: ProjectRecord | null = null;
  let projectRefused: string | null = null;
  try {
    projectRead = await ctx.call<ProjectRecord>("project.get", { projectId });
  } catch (error: unknown) {
    projectRefused = refusal(error);
  }
  if (projectRead === null) {
    return h("div", null,
      breadcrumb([{ href: "/projects", label: "项目" }, { label: "设置" }]),
      h("h1", null, "项目设置"),
      h("div", { className: "error" }, projectRefused ?? "读不到这个项目。"),
    );
  }
  const project: ProjectRecord = projectRead;

  const overview = `/projects/${encodeURIComponent(project.id)}`;
  const settings = `${overview}/settings`;

  const summary = ctx.projects.find((candidate) => candidate.id === project.id);
  const role = summary?.role ?? null;
  // An instance admin holds every project role implicitly; that is how dispatch reads it,
  // so this screen has to read it the same way or it will hide controls that would work.
  const canAdminister = ctx.actor.isInstanceAdmin || role === "admin";

  let membersRead: MemberRow[] | null = null;
  let membersRefused: string | null = null;
  try {
    const result = await ctx.call<{ items: MemberRow[] }>("project.list_members", { projectId: project.id });
    membersRead = result.items;
  } catch (error: unknown) {
    membersRefused = refusal(error);
  }
  // Null and empty stay different all the way to the markup: `null` is "we did not read
  // it", `[]` is "there is nobody". Pinned to a const so the narrowing survives into the
  // callbacks below.
  const memberList: MemberRow[] | null = membersRead;

  const noAdminReason = h("p", { className: "reason" },
    `改名、说明、治理开关和成员都需要这个项目上的 admin 角色。你在这个项目上的角色是 ${role ?? "（不是成员）"}，` +
    "所以这里不显示那些控件——它们按下去只会被拒绝。需要改动，请找这个项目的管理员。");

  return h("div", null,
    breadcrumb([
      { href: "/projects", label: "项目" },
      { href: overview, label: `${project.key} ${project.name}` },
      { label: "设置" },
    ]),
    h("h1", null, `${project.key} 设置`),
    h("div", { className: "grid2" },
      h("div", null,
        h(Panel, { title: "项目" },
          canAdminister
            ? h(Form, { op: "project.update", redirect: settings, csrf: ctx.csrf },
                h("input", { type: "hidden", name: "projectId", value: project.id }),
                h("input", { type: "hidden", name: "expectedVersion", value: String(project.version) }),
                h(Field, { label: "名称" },
                  h("input", { type: "text", name: "name", defaultValue: project.name, required: true, maxLength: 200 }),
                ),
                h(Field, { label: "说明（Markdown）" },
                  h("textarea", { name: "descriptionMd", defaultValue: project.descriptionMd, maxLength: 20000 }),
                ),
                h(Field, {
                  label: "治理（门与审议）",
                  hint: "关闭治理不会删掉已经存在的门与审议，只是不再对新的流转要求它们。",
                },
                  // A checkbox cannot express this. An unchecked box sends nothing, and the
                  // operation reads an absent governanceEnabled as "leave it as it is" —
                  // so a checkbox could switch governance on but never off. A select always
                  // sends one of the two values.
                  h("select", { name: "governanceEnabled", defaultValue: String(project.governanceEnabled) },
                    h("option", { value: "true" }, "开启"),
                    h("option", { value: "false" }, "关闭"),
                  ),
                ),
                h("p", { className: "reason" },
                  `这次提交带着 r${project.version}。期间若有别人改过这个项目，操作会被拒绝，而不是覆盖对方的改动。`),
                h("div", { className: "actions" },
                  h("button", { type: "submit", "data-variant": "primary", "data-op": "project.update" }, "保存"),
                ),
              )
            : h("div", null,
                h("dl", { className: "kv" },
                  h("dt", null, "键"), h("dd", null, project.key),
                  h("dt", null, "名称"), h("dd", null, project.name),
                  h("dt", null, "治理"), h("dd", null, project.governanceEnabled ? "开启" : "关闭"),
                  h("dt", null, "修订"), h("dd", null, `r${project.version}`),
                ),
                project.descriptionMd !== ""
                  ? h("div", { className: "prose" }, project.descriptionMd)
                  : null,
                noAdminReason,
              ),
        ),
        h(Panel, { title: memberList === null ? "成员" : `成员 (${memberList.length})` },
          membersRefused !== null
            ? h("div", { className: "error" }, `读不到成员名单：${membersRefused}`)
            : memberList === null || memberList.length === 0
            ? h(Empty, {}, "这个项目还没有成员。")
            : h("div", { className: "rows" },
                ...memberList.map((member) =>
                  h("div", { key: member.principalId, className: "row" },
                    h("span", { className: "row-key" }, member.handle),
                    h("span", { className: "row-title" }, member.displayName),
                    h("div", { className: "row-meta" },
                      h(Pill, {}, KIND_LABEL[member.kind] ?? member.kind),
                      canAdminister
                        ? h(Form, { op: "project.add_member", redirect: settings, csrf: ctx.csrf, className: "actions" },
                            h("input", { type: "hidden", name: "projectId", value: project.id }),
                            h("input", { type: "hidden", name: "handle", value: member.handle }),
                            h("select", { name: "role", defaultValue: member.role, style: { width: "auto" } },
                              ...PROJECT_ROLES.map((value) =>
                                h("option", { key: value, value }, ROLE_LABEL[value] ?? value)),
                            ),
                            h("button", { type: "submit", "data-op": "project.add_member" }, "改角色"),
                          )
                        : h(Pill, {}, ROLE_LABEL[member.role] ?? member.role),
                    ),
                  ),
                ),
              ),
          h("p", { className: "reason" },
            "没有「移出成员」这个操作，所以这一屏也不放这个按钮。把角色降到 viewer，" +
            "或者停用那个账户，是目前仅有的两条路。"),
        ),
        canAdminister
          ? h(Panel, { title: "添加成员" },
              h(Form, { op: "project.add_member", redirect: settings, csrf: ctx.csrf },
                h("input", { type: "hidden", name: "projectId", value: project.id }),
                h(Field, { label: "账号（handle）", hint: "只能加启用中的账户；已停用的账户找不到。" },
                  h("input", { type: "text", name: "handle", required: true }),
                ),
                h(Field, { label: "角色" },
                  h("select", { name: "role", defaultValue: "contributor" },
                    ...PROJECT_ROLES.map((value) =>
                      h("option", { key: value, value }, ROLE_LABEL[value] ?? value)),
                  ),
                ),
                h("p", { className: "reason" }, "已经是成员的账户会被改成这里选的角色，而不是报错。"),
                h("div", { className: "actions" },
                  h("button", { type: "submit", "data-op": "project.add_member" }, "添加"),
                ),
              ),
            )
          : null,
      ),
      h("div", null,
        h(Panel, { title: "去别处" },
          h("ul", { className: "feed" },
            h("li", null, h("a", { href: overview }, "项目总览")),
            h("li", null, h("a", { href: buildHref("/work-items", { project: project.id }) }, "工作项")),
            h("li", null, h("a", { href: buildHref("/board", { project: project.id }) }, "看板")),
            h("li", null, h("a", { href: `${overview}/governance/gates` }, "门")),
            h("li", null, h("a", { href: buildHref("/activity", { project: project.id }) }, "活动")),
            h("li", null, h("a", { href: buildHref("/trash", { project: project.id }) }, "回收站")),
          ),
        ),
      ),
    ),
  );
}

// ---------------------------------------------------------------------------
// /projects/{projectId}
// ---------------------------------------------------------------------------

export async function ProjectOverviewPage(ctx: PageContext): Promise<ReactNode> {
  const segments = pathSegments(ctx.pathname);
  const projectId = resolveProjectId(ctx, segments[1] ?? "");

  if (projectId === "") {
    return h("div", null,
      h("h1", null, "项目"),
      h(Empty, {}, "这个地址没有带上项目 id。"),
      h("p", null, h("a", { href: "/projects" }, "回到项目列表")),
    );
  }

  // Pinned to a const before anything closes over it: a `let` assigned inside a try loses
  // its definite-assignment proof the moment a callback reads it.
  let projectRead: ProjectRecord | null = null;
  let projectRefused: string | null = null;
  try {
    projectRead = await ctx.call<ProjectRecord>("project.get", { projectId });
  } catch (error: unknown) {
    projectRefused = refusal(error);
  }
  if (projectRead === null) {
    return h("div", null,
      breadcrumb([{ href: "/projects", label: "项目" }, { label: projectId }]),
      h("h1", null, "项目"),
      h("div", { className: "error" }, projectRefused ?? "读不到这个项目。"),
    );
  }
  const project: ProjectRecord = projectRead;

  const overview = `/projects/${encodeURIComponent(project.id)}`;

  // One call per status, each asking for a single row and reading only `total`.
  // `work_item.list` is the only operation that counts work items, and it counts one
  // filter at a time — seven small reads is the honest way to get seven true numbers,
  // rather than one page of fifty rows tallied client-side and wrong past the fiftieth.
  const counts = await Promise.all(
    STATUSES.map(async (status) => {
      const result = await ctx.call<CountOnly>("work_item.list", {
        projectId: project.id,
        status,
        limit: 1,
      }).catch(() => ({ total: -1 }));
      return { status, total: result.total };
    }),
  );
  const countable = counts.filter((entry) => entry.total >= 0);
  const known = countable.reduce((sum, entry) => sum + entry.total, 0);
  const unreadable = counts.filter((entry) => entry.total < 0).map((entry) => entry.status);

  let activityRead: ActivityRow[] | null = null;
  let activityRefused: string | null = null;
  try {
    const stream = await ctx.call<ActivityList>("activity.list", { projectId: project.id, limit: 12 });
    activityRead = stream.items;
  } catch (error: unknown) {
    activityRefused = refusal(error);
  }

  let membersRead: MemberRow[] | null = null;
  let membersRefused: string | null = null;
  try {
    const result = await ctx.call<{ items: MemberRow[] }>("project.list_members", { projectId: project.id });
    membersRead = result.items;
  } catch (error: unknown) {
    membersRefused = refusal(error);
  }

  // Null and empty are different answers and stay different all the way to the markup:
  // these hold what was read, and `null` means it was not read at all. Pinned to consts so
  // the narrowing survives into the callbacks below.
  const activityList: ActivityRow[] | null = activityRead;
  const memberList: MemberRow[] | null = membersRead;
  const shownMembers = memberList === null ? [] : memberList.slice(0, 8);

  return h("div", null,
    breadcrumb([
      { href: "/projects", label: "项目" },
      { label: project.key },
    ]),
    h("h1", null, `${project.key} ${project.name}`),
    h("p", { className: "page-intro" },
      `${known} 个工作项 · ${memberList === null ? "成员数未读取" : `${memberList.length} 位成员`}` +
      ` · 治理${project.governanceEnabled ? "开启" : "关闭"}`),
    h("div", { className: "grid2" },
      h("div", null,
        h(Panel, { title: "按状态" },
          rowsList(countable.map((entry) => ({
            key: STATUS_LABEL[entry.status] ?? entry.status,
            href: buildHref("/work-items", { project: project.id, status: entry.status }),
            primary: statusPill(entry.status),
            meta: h("span", { className: "tally" }, h("b", null, String(entry.total)), " 条"),
          }))),
          unreadable.length > 0
            ? h("p", { className: "reason" },
                `这些状态的计数没读到，所以上面的总数不含它们：${unreadable.join("、")}。`)
            : null,
          h("p", { className: "reason" }, "七个词就是本产品全部的状态词汇，这里不会出现第八个。"),
        ),
        project.descriptionMd !== ""
          ? h(Panel, { title: "说明" },
              // Stored text is multi-line. Without pre-wrap every paragraph collapses into
              // one run and the author's structure is silently lost.
              h("div", { className: "prose" }, project.descriptionMd),
            )
          : null,
        h(Panel, { title: "最近活动" },
          h("p", { className: "reason" }, "按序号倒序，最新在上；同一毫秒写入的两条用时间排不出先后。"),
          activityRefused !== null
            ? h("div", { className: "error" }, `读不到这个项目的活动：${activityRefused}`)
            : activityList === null || activityList.length === 0
            ? h(Empty, {}, "这个项目还没有活动记录。")
            : h("ul", { className: "feed" },
                ...activityList.map((event) =>
                  h("li", { key: event.id },
                    h("span", { className: "when" }, stamp(event.occurredAt)),
                    h("span", null,
                      actorOf(event.attribution, event.actorLabel),
                      ` · ${event.action} · ${SUBJECT_LABEL[event.subjectType] ?? event.subjectType}`,
                      event.fieldNames.length > 0
                        ? h("span", { className: "reason" }, ` (${event.fieldNames.join(", ")})`)
                        : null,
                    ),
                  ),
                ),
              ),
          h("p", null,
            h("a", { href: buildHref("/activity", { project: project.id }) }, "查看这个项目的完整活动流"),
          ),
        ),
      ),
      h("div", null,
        h(Panel, { title: "这个项目" },
          h("dl", { className: "kv" },
            h("dt", null, "键"), h("dd", null, project.key),
            h("dt", null, "治理"), h("dd", null, project.governanceEnabled ? "开启" : "关闭"),
            h("dt", null, "修订"), h("dd", null, `r${project.version}`),
            h("dt", null, "创建于"), h("dd", null, stamp(project.createdAt)),
            h("dt", null, "内部 id"), h("dd", null, project.id),
          ),
        ),
        h(Panel, { title: "交付" },
          h("ul", { className: "feed" },
            h("li", null, h("a", { href: buildHref("/work-items", { project: project.id }) }, "工作项")),
            h("li", null, h("a", { href: buildHref("/work-items", { project: project.id, view: "open" }) }, "进行中的工作项")),
            h("li", null, h("a", { href: buildHref("/board", { project: project.id }) }, "看板")),
            h("li", null, h("a", { href: buildHref("/trash", { project: project.id }) }, "回收站")),
          ),
        ),
        h(Panel, { title: "治理" },
          project.governanceEnabled
            ? null
            : h("p", { className: "reason" },
                "这个项目的治理是关的：门不会拦住任何流转。下面的页面仍然可以打开，只是不会有东西要求你先过门。"),
          h("ul", { className: "feed" },
            h("li", null, h("a", { href: `${overview}/governance/gates` }, "门")),
            h("li", null, h("a", { href: `${overview}/governance/deliberations` }, "审议")),
            h("li", null, h("a", { href: `${overview}/governance/decisions` }, "决定")),
          ),
        ),
        h(Panel, { title: memberList === null ? "成员" : `成员 (${memberList.length})` },
          membersRefused !== null
            ? h("div", { className: "error" }, `读不到成员名单：${membersRefused}`)
            : shownMembers.length === 0
            ? h(Empty, {}, "这个项目还没有成员。")
            : h("ul", { className: "feed" },
                ...shownMembers.map((member) =>
                  h("li", { key: member.principalId },
                    h("span", null, `${member.handle} · ${ROLE_LABEL[member.role] ?? member.role}`),
                  ),
                ),
              ),
          h(Truncation, { shown: shownMembers.length, total: memberList === null ? 0 : memberList.length }),
          h("p", null, h("a", { href: `${overview}/settings` }, "项目设置与成员管理")),
        ),
      ),
    ),
  );
}
