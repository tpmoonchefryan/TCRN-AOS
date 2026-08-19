import {
  Attribution,
  Empty,
  Field,
  Form,
  Panel,
  Pill,
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
 * Gates, deliberations and decisions.
 *
 * Governance is a per-project opt-in, and every operation behind these screens refuses on
 * a project that has not opted in — `forbidden`, never an empty list. So each screen asks
 * the project first and says "off" in words. An empty panel would be an answer about the
 * contents of tables this project has not agreed to have.
 *
 * One constraint shapes every form in this file. There is no script on the page, so an
 * optional text field is either filled in or submitted as the empty string, and the
 * operations reject "" on anything carrying `minLength: 1`, an enum, or a number. A form
 * offering an optional evidence id would therefore break the moment someone left it blank,
 * with a schema error instead of the refusal the operation actually wrote. Two consequences
 * run through the screens below:
 *
 *  - Where the choice can be split, it is split into forms whose every field is required.
 *    A gate is cleared or it is blocked; a gate hangs on one work item or on the project.
 *  - Where the field is an array — risks, unresolved issues, the decisions written into
 *    minutes — a flat form body cannot express it at all. Those are named on the page as
 *    gaps, rather than rendered as controls that refuse on submit.
 */

// ---------------------------------------------------------------------------
// Output shapes, as the operations return them
// ---------------------------------------------------------------------------

interface ProjectRecord {
  id: string;
  key: string;
  name: string;
  descriptionMd: string;
  governanceEnabled: boolean;
  version: number;
  createdAt: string;
}

interface ListEnvelope<T> {
  items: T[];
  nextCursor: string | null;
  total: number;
  truncated: boolean;
}

interface Gate {
  id: string;
  projectId: string;
  definitionId: string | null;
  workItemId: string | null;
  workItemKey: string | null;
  title: string;
  outcomeClass: string;
  status: string;
  blocksStatus: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface Deliberation {
  id: string;
  projectId: string;
  type: string;
  title: string;
  desiredOutcome: string;
  executionMode: string;
  status: string;
  createdBy: string | null;
  createdAt: string;
  closedAt: string | null;
  version: number;
}

interface Position {
  id: string;
  deliberationId: string;
  round: number;
  respondsToId: string | null;
  actorId: string | null;
  actorLabel: string;
  persona: string | null;
  bodyMd: string;
  risks: string[];
  recommendations: string[];
  supersedesId: string | null;
  supersededById: string | null;
  createdAt: string;
}

interface MinutesDecision {
  title: string;
  bodyMd: string;
  outcomeClass: string;
}

interface Minutes {
  id: string;
  deliberationId: string;
  summaryMd: string;
  outcomeClass: string;
  decisions: MinutesDecision[];
  unresolved: string[];
  authorLabel: string;
  supersedesId: string | null;
  createdAt: string;
}

interface DeliberationDetail extends Deliberation {
  positions: Position[];
  minutes: Minutes[];
}

interface DecisionRecord {
  id: string;
  projectId: string;
  title: string;
  bodyMd: string;
  outcomeClass: string;
  sourceKind: string | null;
  sourceId: string | null;
  decidedBy: string | null;
  deciderLabel: string;
  supersedesId: string | null;
  supersededById: string | null;
  decidedAt: string;
}

interface MemberList {
  items: Array<{ principalId: string; handle: string; displayName: string; kind: string; role: string }>;
}

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

const GATE_STATUS_LABEL: Record<string, string> = {
  pending: "待判定",
  satisfied: "已满足",
  blocked: "已阻塞",
};

const GATE_OUTCOME_LABEL: Record<string, string> = {
  role_decision: "角色裁定",
  owner_intent_required: "需 Owner 表态",
};

const EVIDENCE_KIND_LABEL: Record<string, string> = {
  minutes: "审议纪要",
  decision: "决议",
  work_item: "工作项",
};

const DELIBERATION_TYPE_LABEL: Record<string, string> = {
  strategy: "策略",
  architecture: "架构",
  risk: "风险",
  verification: "验证",
  release: "发布",
  incident: "事故",
  retrospective: "复盘",
};

const DELIBERATION_STATUS_LABEL: Record<string, string> = {
  open: "进行中",
  closed: "已关闭",
  cancelled: "已取消",
};

const OUTCOME_CLASS_LABEL: Record<string, string> = {
  discussion_only: "仅讨论",
  recommendation: "建议",
  role_decision: "角色裁定",
  blocked: "受阻",
  owner_intent_required: "需 Owner 表态",
};

const GATE_STATUS_OPTIONS: ReadonlyArray<readonly [string, string]> = [
  ["pending", "待判定"],
  ["satisfied", "已满足"],
  ["blocked", "已阻塞"],
];

const GATE_OUTCOME_OPTIONS: ReadonlyArray<readonly [string, string]> = [
  ["role_decision", "角色裁定"],
  ["owner_intent_required", "需 Owner 表态"],
];

const DELIBERATION_TYPE_OPTIONS: ReadonlyArray<readonly [string, string]> = [
  ["strategy", "策略"],
  ["architecture", "架构"],
  ["risk", "风险"],
  ["verification", "验证"],
  ["release", "发布"],
  ["incident", "事故"],
  ["retrospective", "复盘"],
];

const EXECUTION_MODE_OPTIONS: ReadonlyArray<readonly [string, string]> = [
  ["undeclared", "未声明"],
  ["synthesis_only", "单一综合"],
  ["multi_party", "多方"],
];

const OUTCOME_CLASS_OPTIONS: ReadonlyArray<readonly [string, string]> = [
  ["discussion_only", "仅讨论"],
  ["recommendation", "建议"],
  ["role_decision", "角色裁定"],
  ["blocked", "受阻"],
  ["owner_intent_required", "需 Owner 表态"],
];

const WORK_STATUS_OPTIONS = [
  "planned", "ready", "active", "blocked", "pending_acceptance", "done", "cancelled",
] as const;

type Role = "viewer" | "contributor" | "maintainer" | "admin";
const ROLE_RANK: Record<Role, number> = { viewer: 1, contributor: 2, maintainer: 3, admin: 4 };
const ROLE_LABEL: Record<Role, string> = {
  viewer: "viewer（只读）",
  contributor: "contributor（可参与）",
  maintainer: "maintainer（可裁定）",
  admin: "admin（可管理）",
};

type Section = "gates" | "deliberations" | "decisions";
const SECTION_LABEL: Record<Section, string> = { gates: "门", deliberations: "审议", decisions: "决议" };

// ---------------------------------------------------------------------------
// Small shared pieces
// ---------------------------------------------------------------------------

interface Refusal {
  reasonCode: string;
  message: string;
  detail: Record<string, unknown>;
}

type Read<T> = { ok: true; value: T } | { ok: false; refusal: Refusal };

/**
 * Read a refusal without depending on the error class.
 *
 * Only a refusal that named its own reason code has a message safe to show: an unexpected
 * error's message is the one string most likely to carry a connection string or a fragment
 * of somebody's data, so it is replaced rather than displayed.
 */
function refusalOf(error: unknown): Refusal {
  const raw = (error ?? {}) as { reasonCode?: unknown; message?: unknown; detail?: unknown };
  const reasonCode = typeof raw.reasonCode === "string" ? raw.reasonCode : null;
  if (reasonCode === null) {
    return { reasonCode: "internal_error", message: "这次读取没有完成。", detail: {} };
  }
  const detail = raw.detail;
  return {
    reasonCode,
    message: typeof raw.message === "string" ? raw.message : "这次读取被拒绝了。",
    detail: typeof detail === "object" && detail !== null ? (detail as Record<string, unknown>) : {},
  };
}

async function read<T>(ctx: PageContext, op: string, input: Record<string, unknown>): Promise<Read<T>> {
  try {
    return { ok: true, value: await ctx.call<T>(op, input) };
  } catch (error) {
    return { ok: false, refusal: refusalOf(error) };
  }
}

function param(search: URLSearchParams, name: string): string | undefined {
  const value = search.get(name);
  // A GET form submits an unfilled box as an empty string. Passing that on as a filter is
  // how a `minLength: 1` field turns a blank search into a schema error.
  return value === null || value === "" ? undefined : value;
}

function when(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
}

function pill(key: string, label: ReactNode, toneName?: string): ReactNode {
  return toneName === undefined ? h(Pill, { key }, label) : h(Pill, { key, toneName }, label);
}

function gateTone(status: string): string | undefined {
  if (status === "satisfied") return "done";
  if (status === "blocked") return "blocked";
  return undefined;
}

function deliberationTone(status: string): string | undefined {
  if (status === "closed") return "done";
  if (status === "open") return "active";
  return undefined;
}

/**
 * `undeclared` is rendered as unverified and never as multi-party.
 *
 * An omitted mode stores `undeclared`, which means nothing recorded how many voices this
 * ran with. Showing that as "multi-party" would manufacture the exact assurance the field
 * exists to withhold.
 */
function executionModePill(mode: string): ReactNode {
  if (mode === "multi_party") return pill("mode", "多方（multi_party）", "done");
  if (mode === "synthesis_only") return pill("mode", "单一综合（synthesis_only）");
  return pill("mode", "未声明（undeclared）· 未核验", "blocked");
}

function heldRole(ctx: PageContext, projectId: string): Role | null {
  const held = ctx.actor.roles.get(projectId);
  return held === undefined ? null : held;
}

function holdsRole(ctx: PageContext, projectId: string, required: Role): boolean {
  if (ctx.actor.isInstanceAdmin) return true;
  const held = heldRole(ctx, projectId);
  return held !== null && ROLE_RANK[held] >= ROLE_RANK[required];
}

/** A control the reader cannot use says why on the page, not in a tooltip nobody opens. */
function roleReason(ctx: PageContext, projectId: string, required: Role): ReactNode {
  const held = heldRole(ctx, projectId);
  return h("p", { className: "reason" },
    `这个动作需要 ${ROLE_LABEL[required]}；你在这个项目上${held === null ? "没有角色" : `是 ${ROLE_LABEL[held]}`}，所以按钮是停用的。要改权限，请项目管理员在项目设置里授予。`,
  );
}

function attributionOf(principalId: string | null, labels: Map<string, string>): ReactNode {
  if (principalId === null) return h(Attribution, { label: null });
  const label = labels.get(principalId);
  // We hold an id but no label for it — the member list did not resolve it, usually because
  // that account is no longer a member. "Not read" is not "nobody".
  return label === undefined ? h(Attribution, { read: false }) : h(Attribution, { label });
}

async function memberLabels(ctx: PageContext, projectId: string): Promise<Map<string, string>> {
  const labels = new Map<string, string>();
  const members = await read<MemberList>(ctx, "project.list_members", { projectId });
  if (!members.ok) return labels;
  for (const member of members.value.items) labels.set(member.principalId, `${member.kind}:${member.handle}`);
  return labels;
}

function sectionNav(projectId: string, current: Section): ReactNode {
  const entries: ReadonlyArray<readonly [Section, string]> = [
    ["gates", "门"],
    ["deliberations", "审议"],
    ["decisions", "决议"],
  ];
  return h("div", { className: "viewtabs" },
    ...entries.map(([id, label]) =>
      h("a", {
        key: id,
        href: `/projects/${encodeURIComponent(projectId)}/governance/${id}`,
        "aria-current": id === current ? "true" : undefined,
      }, label),
    ),
  );
}

function governanceCrumbs(projectId: string, project: ProjectRecord | null, section: Section): ReactNode {
  return breadcrumb([
    { href: "/projects", label: "项目" },
    {
      href: buildHref("/work-items", { project: projectId }),
      label: project === null ? projectId : `${project.key} ${project.name}`,
    },
    { label: `治理 · ${SECTION_LABEL[section]}` },
  ]);
}

function tabs(
  path: string,
  search: URLSearchParams,
  name: string,
  entries: ReadonlyArray<readonly [string | null, string]>,
): ReactNode {
  const current = search.get(name);
  return h("div", { className: "viewtabs" },
    ...entries.map(([value, label]) =>
      h("a", {
        key: label,
        // Any change of condition drops the cursor: a cursor carries the digest of the
        // filters it was minted under, and keeping it across a filter change is a refusal.
        href: buildHref(path, search, { [name]: value, cursor: null }),
        "aria-current": (current === null || current === "" ? null : current) === value ? "true" : undefined,
      }, label),
    ),
  );
}

function dropdown(
  path: string,
  search: URLSearchParams,
  name: string,
  label: string,
  options: ReadonlyArray<readonly [string, string]>,
): ReactNode {
  const value = param(search, name);
  const current = options.find(([option]) => option === value);
  return h("details", { className: "dropdown", "data-set": value === undefined ? "false" : "true" },
    h("summary", null,
      h("span", { className: "label" }, label),
      h("span", { className: "value" }, current === undefined ? "全部" : current[1]),
      h("span", { "aria-hidden": "true" }, "▾"),
    ),
    h("div", { className: "dropdown-menu" },
      h("a", {
        href: buildHref(path, search, { [name]: null, cursor: null }),
        "aria-current": value === undefined ? "true" : undefined,
      }, `全部${label}`),
      h("hr", null),
      ...options.map(([option, optionLabel]) =>
        h("a", {
          key: option,
          href: buildHref(path, search, { [name]: option, cursor: null }),
          "aria-current": value === option ? "true" : undefined,
        }, optionLabel),
      ),
    ),
  );
}

function appliedRow(
  path: string,
  search: URLSearchParams,
  chips: Array<{ key: string; label: string }>,
): ReactNode {
  if (chips.length === 0) return null;
  return h("div", { className: "applied" },
    h("span", { className: "lead" }, "已应用"),
    ...chips.map((chip) =>
      h("a", {
        key: chip.key,
        className: "chip",
        href: buildHref(path, search, { [chip.key]: null, cursor: null }),
      },
        h("span", null, chip.label),
        h("span", { className: "x" }, "✕"),
      ),
    ),
    h("a", { className: "resetlink", href: hrefResetConditions(path, search) }, "重置视图"),
  );
}

function carryHidden(search: URLSearchParams, ...omit: string[]): ReactNode[] {
  return [...search.entries()]
    .filter(([key]) => !omit.includes(key) && key !== "cursor")
    .map(([key, value]) => h("input", { key, type: "hidden", name: key, value }));
}

function refusalNotice(refusal: Refusal): ReactNode {
  const projectId = typeof refusal.detail.projectId === "string" ? refusal.detail.projectId : null;
  return h("div", { className: "error" },
    h("p", { className: "prose" }, refusal.message),
    h("p", { className: "reason" }, `拒绝原因码：${refusal.reasonCode}`),
    projectId === null
      ? null
      : h("p", null, h("a", { href: `/projects/${encodeURIComponent(projectId)}/settings` }, "打开项目设置")),
  );
}

function noProjectInPath(section: Section): ReactNode {
  return h("div", null,
    h("h1", null, `治理 · ${SECTION_LABEL[section]}`),
    h("p", { className: "empty" },
      "这个地址里没有项目 id。治理是按项目开关的，所以这三个页面都要走 /projects/{projectId}/governance/… 的地址。",
    ),
    h("p", null, h("a", { href: "/projects" }, "回到项目列表")),
  );
}

/**
 * The screen a project with governance switched off gets.
 *
 * Not an error and not an empty list: the operations refuse `forbidden` here, and a reader
 * who saw an empty panel would conclude this project has no gates, which is a claim about
 * contents rather than about the switch.
 */
function governanceOff(projectId: string, project: ProjectRecord, section: Section): ReactNode {
  return h("div", null,
    governanceCrumbs(projectId, project, section),
    h("h1", null, `治理 · ${SECTION_LABEL[section]}`),
    h("div", { className: "notice" },
      `${project.key} 没有开启治理，所以这个项目现在没有${SECTION_LABEL[section]}这回事。`,
    ),
    h("p", { className: "page-intro" },
      "治理是每个项目自己选择加入的。没开启时，门、审议与决议的接口一律拒绝，而不是返回空列表——这里也就没有可以显示的空面板。开启之后，这三个页面立刻可用，已有的工作项不受影响。",
    ),
    h("p", null,
      h("a", { href: `/projects/${encodeURIComponent(project.id)}/settings` }, "到项目设置里开启治理"),
    ),
  );
}

interface ProjectScope {
  project: ProjectRecord;
  projectId: string;
  path: string;
  here: string;
}

/**
 * Every project-scoped governance screen starts here: which project, and is governance on.
 */
async function enterProject(
  ctx: PageContext,
  section: Section,
): Promise<{ ok: true; scope: ProjectScope } | { ok: false; body: ReactNode }> {
  const path = ctx.pathname.replace(/\/+$/, "") || "/";
  const segments = path.split("/").filter((segment) => segment.length > 0);
  const projectId = segments[0] === "projects" && segments[1] !== undefined ? decodeURIComponent(segments[1]) : null;
  if (projectId === null) return { ok: false, body: noProjectInPath(section) };

  const project = await read<ProjectRecord>(ctx, "project.get", { projectId });
  if (!project.ok) {
    return {
      ok: false,
      body: h("div", null,
        governanceCrumbs(projectId, null, section),
        h("h1", null, `治理 · ${SECTION_LABEL[section]}`),
        refusalNotice(project.refusal),
      ),
    };
  }
  if (!project.value.governanceEnabled) {
    return { ok: false, body: governanceOff(projectId, project.value, section) };
  }
  return {
    ok: true,
    scope: { project: project.value, projectId, path, here: buildHref(path, ctx.search) },
  };
}

// ---------------------------------------------------------------------------
// /projects/{projectId}/governance/gates
// ---------------------------------------------------------------------------

function gateCreatePanel(ctx: PageContext, scope: ProjectScope): ReactNode {
  const canCreate = holdsRole(ctx, scope.projectId, "maintainer");
  const blocksField = (): ReactNode =>
    h(Field, { label: "挡住哪个状态", hint: "工作项要走到这个状态时，这道门必须先满足。缺省是 done。" },
      h("select", { name: "blocksStatus", defaultValue: "done" },
        ...WORK_STATUS_OPTIONS.map((status) =>
          h("option", { key: status, value: status }, STATUS_LABEL[status] ?? status),
        ),
      ),
    );
  const outcomeField = h(Field, { label: "结果类别" },
    h("select", { name: "outcomeClass", defaultValue: "role_decision" },
      ...GATE_OUTCOME_OPTIONS.map(([value, label]) => h("option", { key: value, value }, label)),
    ),
  );

  return h(Panel, { title: "新建门" },
    canCreate ? null : roleReason(ctx, scope.projectId, "maintainer"),
    h("p", { className: "reason" },
      "两张表单，因为这是两件事：一道门要么挂在某个工作项上，要么是整个项目的。空着的工作项 key 会被接口按“填了一个空字符串”拒绝，所以这里不放可空的那一格。",
    ),
    h(Form, { op: "gate.create", redirect: scope.here, csrf: ctx.csrf },
      h("input", { type: "hidden", name: "projectId", value: scope.project.id }),
      h(Field, { label: "标题" }, h("input", { type: "text", name: "title", required: true, maxLength: 400 })),
      outcomeField,
      blocksField(),
      h(Field, { label: "工作项 key", hint: "例如 AOS-12。门与它挡住的工作项必须在同一个项目里。" },
        h("input", { type: "text", name: "workItemKey", required: true }),
      ),
      h("div", { className: "actions" },
        h("button", {
          type: "submit",
          "data-variant": "primary",
          "data-op": "gate.create",
          disabled: !canCreate,
        }, "在这个工作项上开门"),
      ),
    ),
    h("hr", null),
    h(Form, { op: "gate.create", redirect: scope.here, csrf: ctx.csrf },
      h("input", { type: "hidden", name: "projectId", value: scope.project.id }),
      h(Field, { label: "标题（项目级门）" },
        h("input", { type: "text", name: "title", required: true, maxLength: 400 }),
      ),
      h(Field, { label: "结果类别" },
        h("select", { name: "outcomeClass", defaultValue: "role_decision" },
          ...GATE_OUTCOME_OPTIONS.map(([value, label]) => h("option", { key: value, value }, label)),
        ),
      ),
      blocksField(),
      h("div", { className: "actions" },
        h("button", {
          type: "submit",
          "data-op": "gate.create",
          disabled: !canCreate,
        }, "开一道项目级门"),
      ),
    ),
  );
}

function gateBlock(ctx: PageContext, scope: ProjectScope, gate: Gate, canDecide: boolean): ReactNode {
  const version = String(gate.version);
  const evidenceHint =
    "必填。gate.list 不返回这道门是否豁免证据，未挂门定义的门一律按“需要证据”处理，所以这里一律要求填写：空着提交会被接口拒绝。证据必须与门在同一项目；引用审议纪要时，那场审议必须已经关闭。";

  return h("div", { className: "panel", key: gate.id, id: `gate-${gate.id}` },
    h("h2", null, gate.title),
    h("dl", { className: "kv" },
      h("dt", null, "状态"),
      h("dd", null, pill("status", GATE_STATUS_LABEL[gate.status] ?? gate.status, gateTone(gate.status))),
      h("dt", null, "结果类别"),
      h("dd", null, pill("outcome", GATE_OUTCOME_LABEL[gate.outcomeClass] ?? gate.outcomeClass)),
      h("dt", null, "挡住"),
      h("dd", null,
        pill("blocks", STATUS_LABEL[gate.blocksStatus] ?? gate.blocksStatus, tone(gate.blocksStatus)),
      ),
      h("dt", null, "工作项"),
      h("dd", null,
        gate.workItemKey === null
          ? "项目级门，没有挂在某个工作项上"
          : h("a", { href: `/work-items/${encodeURIComponent(gate.workItemKey)}` }, gate.workItemKey),
      ),
      h("dt", null, "门定义"),
      h("dd", null, gate.definitionId ?? "无（这道门是单独开的）"),
      h("dt", null, "修订"),
      h("dd", null, `r${gate.version} · 更新于 ${when(gate.updatedAt)}`),
    ),
    canDecide ? null : roleReason(ctx, scope.projectId, "maintainer"),
    h("details", { open: gate.status === "pending" },
      h("summary", null, gate.status === "pending" ? "判定这道门" : "改判这道门（写一条新的判定）"),
      h("p", { className: "reason" },
        "判定是追加写的：新的一条不会改掉旧的一条，旧判定仍然留在记录里。此处不提供“取代某条旧判定”的入口——没有任何操作能列出一道门的历史判定，也就没有可以填的那个 id；要写取代关系，只能经 API 或 MCP。",
      ),
      h(Form, { op: "gate.decide", redirect: scope.here, csrf: ctx.csrf },
        h("input", { type: "hidden", name: "gateId", value: gate.id }),
        h("input", { type: "hidden", name: "decision", value: "satisfied" }),
        h("input", { type: "hidden", name: "expectedVersion", value: version }),
        h(Field, { label: "证据类别" },
          h("select", { name: "evidenceKind", defaultValue: "minutes" },
            ...Object.entries(EVIDENCE_KIND_LABEL).map(([value, label]) =>
              h("option", { key: value, value }, label),
            ),
          ),
        ),
        h(Field, { label: "证据 id", hint: evidenceHint },
          h("input", { type: "text", name: "evidenceId", required: true }),
        ),
        h(Field, { label: "理由（Markdown，可空）" },
          h("textarea", { name: "rationaleMd", style: { minHeight: "90px" } }),
        ),
        h("div", { className: "actions" },
          h("button", {
            type: "submit",
            "data-variant": "primary",
            "data-op": "gate.decide",
            disabled: !canDecide,
          }, "判定为 satisfied"),
        ),
      ),
      h(Form, { op: "gate.decide", redirect: scope.here, csrf: ctx.csrf },
        h("input", { type: "hidden", name: "gateId", value: gate.id }),
        h("input", { type: "hidden", name: "decision", value: "blocked" }),
        h("input", { type: "hidden", name: "expectedVersion", value: version }),
        h(Field, {
          label: "理由（Markdown，可空）",
          hint: "阻塞判定不要求证据，所以这张表单里没有证据格：一个空的证据格会被接口拒绝，而不是被当作“没有证据”。要给阻塞判定附证据，目前只能经 API 或 MCP。",
        },
          h("textarea", { name: "rationaleMd", style: { minHeight: "90px" } }),
        ),
        h("div", { className: "actions" },
          h("button", {
            type: "submit",
            "data-op": "gate.decide",
            disabled: !canDecide,
          }, "判定为 blocked"),
        ),
      ),
    ),
  );
}

export async function GatesPage(ctx: PageContext): Promise<ReactNode> {
  const entered = await enterProject(ctx, "gates");
  if (!entered.ok) return entered.body;
  const scope = entered.scope;
  const search = ctx.search;
  const path = scope.path;

  const view = search.get("view") ?? "all";
  const list = await read<ListEnvelope<Gate>>(ctx, "gate.list", {
    projectId: scope.project.id,
    status: param(search, "status"),
    outcomeClass: param(search, "outcome"),
    workItemKey: param(search, "item"),
    open: view === "open" ? true : undefined,
    cursor: param(search, "cursor"),
    limit: 50,
  });

  const chips: Array<{ key: string; label: string }> = [];
  const status = param(search, "status");
  const outcome = param(search, "outcome");
  const item = param(search, "item");
  if (status !== undefined) chips.push({ key: "status", label: `状态 ${GATE_STATUS_LABEL[status] ?? status}` });
  if (outcome !== undefined) chips.push({ key: "outcome", label: `类别 ${GATE_OUTCOME_LABEL[outcome] ?? outcome}` });
  if (item !== undefined) chips.push({ key: "item", label: `工作项 ${item}` });

  const canDecide = holdsRole(ctx, scope.projectId, "maintainer");

  const header = [
    governanceCrumbs(scope.projectId, scope.project, "gates"),
    h("h1", { key: "h1" }, "门"),
    h("p", { className: "page-intro", key: "intro" },
      "门是这个项目上必须先满足、否则不放行的判定。每一道都记着它挡住哪个状态、挡在哪个工作项上，以及是谁在什么证据上判的。",
    ),
    sectionNav(scope.projectId, "gates"),
  ];

  if (!list.ok) {
    return h("div", null,
      ...header,
      refusalNotice(list.refusal),
      gateCreatePanel(ctx, scope),
    );
  }

  const gates = list.value;
  return h("div", null,
    ...header,
    h("div", { className: "filterface" },
      tabs(path, search, "view", [[null, "全部"], ["open", "未满足"]]),
      h("div", { className: "conditions" },
        h("form", { method: "GET", action: path, className: "searchform" },
          ...carryHidden(search, "item"),
          h("input", {
            type: "search",
            name: "item",
            placeholder: "按工作项 key 过滤",
            defaultValue: item ?? "",
            "data-set": item === undefined ? "false" : "true",
          }),
        ),
        dropdown(path, search, "status", "状态", GATE_STATUS_OPTIONS),
        dropdown(path, search, "outcome", "类别", GATE_OUTCOME_OPTIONS),
        h("div", { className: "vr" }),
        h("span", { className: "tally" }, h("b", null, String(gates.items.length)), ` / ${gates.total}`),
      ),
      appliedRow(path, search, chips),
    ),
    gates.items.length === 0
      ? h(Empty, null, "没有匹配的门。")
      : h("div", null, ...gates.items.map((gate) => gateBlock(ctx, scope, gate, canDecide))),
    h(Truncation, {
      shown: gates.items.length,
      total: gates.total,
      nextHref: gates.nextCursor === null ? null : buildHref(path, search, { cursor: gates.nextCursor }),
    }),
    gateCreatePanel(ctx, scope),
  );
}

// ---------------------------------------------------------------------------
// /projects/{projectId}/governance/deliberations
// ---------------------------------------------------------------------------

export async function DeliberationsPage(ctx: PageContext): Promise<ReactNode> {
  const entered = await enterProject(ctx, "deliberations");
  if (!entered.ok) return entered.body;
  const scope = entered.scope;
  const search = ctx.search;
  const path = scope.path;

  const list = await read<ListEnvelope<Deliberation>>(ctx, "deliberation.list", {
    projectId: scope.project.id,
    type: param(search, "type"),
    status: param(search, "status"),
    executionMode: param(search, "mode"),
    cursor: param(search, "cursor"),
    limit: 50,
  });
  const labels = await memberLabels(ctx, scope.project.id);
  const canOpen = holdsRole(ctx, scope.projectId, "contributor");

  const openPanel = h(Panel, { title: "开一场审议" },
    canOpen ? null : roleReason(ctx, scope.projectId, "contributor"),
    h(Form, { op: "deliberation.open", redirect: scope.here, csrf: ctx.csrf },
      h("input", { type: "hidden", name: "projectId", value: scope.project.id }),
      h(Field, { label: "标题" }, h("input", { type: "text", name: "title", required: true, maxLength: 400 })),
      h(Field, { label: "类型" },
        h("select", { name: "type", defaultValue: "risk" },
          ...DELIBERATION_TYPE_OPTIONS.map(([value, label]) => h("option", { key: value, value }, label)),
        ),
      ),
      h(Field, {
        label: "执行方式",
        hint: "架构与策略两类必须声明执行方式：选“未声明”会被拒绝。选“单一综合”时，还必须在下面写清楚为什么一个声音就够——那也会被检查。",
      },
        h("select", { name: "executionMode", defaultValue: "undeclared" },
          ...EXECUTION_MODE_OPTIONS.map(([value, label]) => h("option", { key: value, value }, label)),
        ),
      ),
      h(Field, { label: "想要的结果（Markdown，可空）" }, h("textarea", { name: "desiredOutcome" })),
      h("div", { className: "actions" },
        h("button", {
          type: "submit",
          "data-variant": "primary",
          "data-op": "deliberation.open",
          disabled: !canOpen,
        }, "开始审议"),
      ),
    ),
  );

  const header = [
    governanceCrumbs(scope.projectId, scope.project, "deliberations"),
    h("h1", { key: "h1" }, "审议"),
    h("p", { className: "page-intro", key: "intro" },
      "审议是把一场争论留在记录里的地方：请求、各方立场、以及最后写成纪要的结论。被推翻的立场不会消失。",
    ),
    sectionNav(scope.projectId, "deliberations"),
  ];

  if (!list.ok) {
    return h("div", null, ...header, refusalNotice(list.refusal), openPanel);
  }

  const chips: Array<{ key: string; label: string }> = [];
  const type = param(search, "type");
  const mode = param(search, "mode");
  if (type !== undefined) chips.push({ key: "type", label: `类型 ${DELIBERATION_TYPE_LABEL[type] ?? type}` });
  if (mode !== undefined) {
    const modeLabel = EXECUTION_MODE_OPTIONS.find(([value]) => value === mode);
    chips.push({ key: "mode", label: `执行方式 ${modeLabel === undefined ? mode : modeLabel[1]}` });
  }

  const deliberations = list.value;
  return h("div", null,
    ...header,
    h("div", { className: "filterface" },
      tabs(path, search, "status", [
        [null, "全部"],
        ["open", "进行中"],
        ["closed", "已关闭"],
        ["cancelled", "已取消"],
      ]),
      h("div", { className: "conditions" },
        dropdown(path, search, "type", "类型", DELIBERATION_TYPE_OPTIONS),
        dropdown(path, search, "mode", "执行方式", EXECUTION_MODE_OPTIONS),
        h("div", { className: "vr" }),
        h("span", { className: "tally" },
          h("b", null, String(deliberations.items.length)), ` / ${deliberations.total}`,
        ),
      ),
      appliedRow(path, search, chips),
    ),
    deliberations.items.length === 0
      ? h(Empty, null, "还没有匹配的审议。")
      : rowsList(deliberations.items.map((item) => ({
          key: item.id,
          href: `/governance/deliberations/${encodeURIComponent(item.id)}`,
          primary: item.title,
          meta: [
            pill("type", DELIBERATION_TYPE_LABEL[item.type] ?? item.type),
            executionModePill(item.executionMode),
            pill(
              "status",
              DELIBERATION_STATUS_LABEL[item.status] ?? item.status,
              deliberationTone(item.status),
            ),
            h("span", { key: "who", className: "reason" }, attributionOf(item.createdBy, labels)),
          ],
        }))),
    h(Truncation, {
      shown: deliberations.items.length,
      total: deliberations.total,
      nextHref: deliberations.nextCursor === null
        ? null
        : buildHref(path, search, { cursor: deliberations.nextCursor }),
    }),
    openPanel,
  );
}

// ---------------------------------------------------------------------------
// /governance/deliberations/{deliberationId}
// ---------------------------------------------------------------------------

function positionBlock(
  ctx: PageContext,
  room: string,
  deliberation: DeliberationDetail,
  position: Position,
  canSpeak: boolean,
): ReactNode {
  const superseded = position.supersededById !== null;
  const body = h("div", { className: "prose" }, position.bodyMd);

  const bullets = (title: string, entries: string[], prefix: string): ReactNode =>
    entries.length === 0
      ? null
      : h("div", null,
          h("p", { className: "reason" }, title),
          h("ul", null,
            ...entries.map((entry, index) =>
              h("li", { key: `${prefix}${index}`, className: "prose" }, entry),
            ),
          ),
        );

  return h("div", { key: position.id, id: `position-${position.id}` },
    h("p", { className: "reason" },
      // The position carries its own written label, so it is read straight rather than
      // resolved through the member list: the label survives the account being removed,
      // which is exactly the case where a lookup would come back blank.
      h(Attribution, { label: position.actorLabel }),
      " · ",
      position.persona === null || position.persona === "" ? "未标注视角" : `视角：${position.persona}`,
      " · ",
      when(position.createdAt),
      position.respondsToId === null
        ? null
        : h("a", { href: `#position-${position.respondsToId}` }, " · 回应上面的一条"),
    ),
    // A superseded position stays on the record, struck through rather than removed. Reading
    // it back is what tells someone the argument happened at all.
    superseded ? h("del", null, body) : body,
    superseded
      ? h("p", { className: "reason" },
          "这条立场已被取代。",
          h("a", { href: `#position-${position.supersededById}` }, "看取代它的那条"),
        )
      : null,
    position.supersedesId === null
      ? null
      : h("p", { className: "reason" },
          "这条取代了更早的一条。",
          h("a", { href: `#position-${position.supersedesId}` }, "看被它取代的那条"),
        ),
    bullets("风险", position.risks, "risk"),
    bullets("建议", position.recommendations, "rec"),
    deliberation.status !== "open" || !canSpeak
      ? null
      : h("details", null,
          h("summary", null, "回应或取代这条"),
          h(Form, { op: "deliberation.add_position", redirect: room, csrf: ctx.csrf },
            h("input", { type: "hidden", name: "deliberationId", value: deliberation.id }),
            h("input", { type: "hidden", name: "round", value: String(position.round) }),
            h(Field, { label: "立场（Markdown）" },
              h("textarea", { name: "bodyMd", required: true }),
            ),
            h(Field, { label: "视角（可空）" },
              h("input", { type: "text", name: "persona", maxLength: 200 }),
            ),
            h("div", { className: "actions" },
              // Two submit buttons, one form: a browser sends only the clicked button's
              // name and value, so "回应" writes respondsToId and "取代" writes supersedesId
              // without either of them ever being submitted empty.
              h("button", {
                type: "submit",
                name: "respondsToId",
                value: position.id,
                "data-variant": "primary",
                "data-op": "deliberation.add_position",
              }, "回应这条"),
              h("button", {
                type: "submit",
                name: "supersedesId",
                value: position.id,
                "data-op": "deliberation.add_position",
              }, "取代这条"),
            ),
            h("p", { className: "reason" },
              `写下的这条会记在第 ${position.round} 轮。“取代”只是再写一条并把这条标为被取代，原文仍然留在页面上。`,
            ),
          ),
        ),
    h("hr", null),
  );
}

export async function DeliberationRoomPage(ctx: PageContext): Promise<ReactNode> {
  const path = ctx.pathname.replace(/\/+$/, "") || "/";
  const segments = path.split("/").filter((segment) => segment.length > 0);
  const deliberationId = segments[2] === undefined ? null : decodeURIComponent(segments[2]);
  if (deliberationId === null) {
    return h("div", null,
      h("h1", null, "审议"),
      h("p", { className: "empty" }, "这个地址里没有审议 id。审议室的地址是 /governance/deliberations/{deliberationId}。"),
    );
  }

  const found = await read<DeliberationDetail>(ctx, "deliberation.get", { deliberationId });
  if (!found.ok) {
    return h("div", null,
      breadcrumb([{ href: "/projects", label: "项目" }, { label: "审议" }]),
      h("h1", null, "审议"),
      refusalNotice(found.refusal),
      h("p", { className: "reason" },
        "如果这是因为项目没有开启治理：审议对未开启治理的项目一律拒绝，而不是显示成空的。开启开关之后这个地址就能读了。",
      ),
    );
  }

  const deliberation = found.value;
  const room = `/governance/deliberations/${encodeURIComponent(deliberation.id)}`;
  const project = await read<ProjectRecord>(ctx, "project.get", { projectId: deliberation.projectId });
  const labels = await memberLabels(ctx, deliberation.projectId);
  const canSpeak = holdsRole(ctx, deliberation.projectId, "contributor");
  const canClose = holdsRole(ctx, deliberation.projectId, "maintainer");
  const isOpen = deliberation.status === "open";

  const rounds: Array<{ round: number; positions: Position[] }> = [];
  for (const position of deliberation.positions) {
    const last = rounds.at(-1);
    if (last !== undefined && last.round === position.round) last.positions.push(position);
    else rounds.push({ round: position.round, positions: [position] });
  }
  const nextRound = (deliberation.positions.at(-1)?.round ?? 0) + 1;
  const roundOptions: number[] = [];
  for (const group of rounds) roundOptions.push(group.round);
  if (!roundOptions.includes(nextRound)) roundOptions.push(nextRound);

  return h("div", null,
    breadcrumb([
      { href: "/projects", label: "项目" },
      {
        href: `/projects/${encodeURIComponent(deliberation.projectId)}/governance/deliberations`,
        label: project.ok ? `${project.value.key} 的审议` : "这个项目的审议",
      },
      { label: DELIBERATION_TYPE_LABEL[deliberation.type] ?? deliberation.type },
    ]),
    h("h1", null, deliberation.title),

    h(Panel, { title: "请求" },
      h("dl", { className: "kv" },
        h("dt", null, "类型"),
        h("dd", null, pill("type", DELIBERATION_TYPE_LABEL[deliberation.type] ?? deliberation.type)),
        h("dt", null, "执行方式"),
        h("dd", null,
          executionModePill(deliberation.executionMode),
          deliberation.executionMode === "undeclared"
            ? h("p", { className: "reason" },
                "“未声明”不等于多方：没有任何记录说明这场审议是几个声音跑出来的，所以它只能按未核验读。架构与策略两类不允许停在这里。",
              )
            : null,
        ),
        h("dt", null, "状态"),
        h("dd", null,
          pill(
            "status",
            DELIBERATION_STATUS_LABEL[deliberation.status] ?? deliberation.status,
            deliberationTone(deliberation.status),
          ),
        ),
        h("dt", null, "发起人"),
        h("dd", null, attributionOf(deliberation.createdBy, labels)),
        h("dt", null, "开始于"),
        h("dd", null, when(deliberation.createdAt)),
        h("dt", null, "关闭于"),
        h("dd", null, deliberation.closedAt === null ? "尚未关闭" : when(deliberation.closedAt)),
        h("dt", null, "修订"),
        h("dd", null, `r${deliberation.version}`),
      ),
      h("p", { className: "reason" }, "想要的结果"),
      deliberation.desiredOutcome === ""
        ? h(Empty, null, "发起时没有写想要的结果。")
        : h("div", { className: "prose" }, deliberation.desiredOutcome),
    ),

    h(Panel, { title: `立场（${deliberation.positions.length} 条，分 ${rounds.length} 轮）` },
      deliberation.positions.length === 0
        ? h(Empty, null, "还没有人发表立场。")
        : h("div", null,
            ...rounds.map((group) =>
              h("div", { key: `round-${group.round}` },
                h("h2", null, `第 ${group.round} 轮 · ${group.positions.length} 条`),
                ...group.positions.map((position) =>
                  positionBlock(ctx, room, deliberation, position, canSpeak),
                ),
              ),
            ),
          ),
      isOpen
        ? null
        : h("p", { className: "reason" },
            `这场审议已经${DELIBERATION_STATUS_LABEL[deliberation.status] ?? deliberation.status}，不再接受新的立场，所以这里没有发言的表单。`,
          ),
      isOpen && !canSpeak ? roleReason(ctx, deliberation.projectId, "contributor") : null,
      isOpen && canSpeak
        ? h(Form, { op: "deliberation.add_position", redirect: room, csrf: ctx.csrf },
            h("input", { type: "hidden", name: "deliberationId", value: deliberation.id }),
            h(Field, { label: "新的立场（Markdown）" },
              h("textarea", { name: "bodyMd", required: true }),
            ),
            h(Field, { label: "轮次", hint: "只能选已有的轮次，或开新的一轮。轮次不会从正文里猜。" },
              h("select", { name: "round", defaultValue: String(rounds.at(-1)?.round ?? 1) },
                ...roundOptions.map((round) =>
                  h("option", { key: round, value: String(round) },
                    round === nextRound && rounds.length > 0 ? `第 ${round} 轮（新开一轮）` : `第 ${round} 轮`,
                  ),
                ),
              ),
            ),
            h(Field, { label: "视角（可空）" },
              h("input", { type: "text", name: "persona", maxLength: 200 }),
            ),
            h("div", { className: "actions" },
              h("button", {
                type: "submit",
                "data-variant": "primary",
                "data-op": "deliberation.add_position",
              }, "发表立场"),
            ),
            h("p", { className: "reason" },
              "这张表单写不了 risks 与 recommendations：它们是字符串数组，而没有脚本的表单里一个空文本框会发出空字符串，接口拒绝空字符串成员。这是一个已知缺口，风险与建议目前只能经 API 或 MCP 附上。要回应或取代某一条，用那条立场下面的按钮。",
            ),
          )
        : null,
    ),

    h(Panel, { title: `纪要（${deliberation.minutes.length} 份）` },
      deliberation.minutes.length === 0
        ? h(Empty, null, "还没有纪要。纪要在关闭这场审议时写下。")
        : h("div", null,
            ...deliberation.minutes.map((minutes) =>
              h("div", { key: minutes.id, id: `minutes-${minutes.id}` },
                h("p", { className: "reason" },
                  pill(
                    "outcome",
                    OUTCOME_CLASS_LABEL[minutes.outcomeClass] ?? minutes.outcomeClass,
                    minutes.outcomeClass === "blocked" ? "blocked" : undefined,
                  ),
                  " · ",
                  h(Attribution, { label: minutes.authorLabel }),
                  " · ",
                  when(minutes.createdAt),
                  minutes.supersedesId === null ? null : ` · 取代了纪要 ${minutes.supersedesId}`,
                ),
                h("div", { className: "prose" }, minutes.summaryMd),
                minutes.decisions.length === 0
                  ? h("p", { className: "reason" }, "这份纪要没有写下决议条目。")
                  : h("div", null,
                      h("p", { className: "reason" }, `决议 ${minutes.decisions.length} 条`),
                      h("ul", null,
                        ...minutes.decisions.map((entry, index) =>
                          h("li", { key: `d${index}` },
                            h("b", null, entry.title),
                            " ",
                            pill(`dc${index}`, OUTCOME_CLASS_LABEL[entry.outcomeClass] ?? entry.outcomeClass),
                            entry.bodyMd === "" ? null : h("div", { className: "prose" }, entry.bodyMd),
                          ),
                        ),
                      ),
                      h("p", null,
                        h("a", {
                          href: buildHref(
                            `/projects/${encodeURIComponent(deliberation.projectId)}/governance/decisions`,
                            { source: minutes.id },
                          ),
                        }, "在决议日志里看这份纪要产出的决议"),
                      ),
                    ),
                minutes.unresolved.length === 0
                  ? h("p", { className: "reason" }, "没有记下未决问题。")
                  : h("div", null,
                      h("p", { className: "reason" }, `未决问题 ${minutes.unresolved.length} 条`),
                      h("ul", null,
                        ...minutes.unresolved.map((entry, index) =>
                          h("li", { key: `u${index}`, className: "prose" }, entry),
                        ),
                      ),
                    ),
                h("hr", null),
              ),
            ),
          ),
      isOpen && !canClose ? roleReason(ctx, deliberation.projectId, "maintainer") : null,
      isOpen
        ? h(Form, { op: "deliberation.close", redirect: room, csrf: ctx.csrf },
            h("input", { type: "hidden", name: "deliberationId", value: deliberation.id }),
            h("input", { type: "hidden", name: "expectedVersion", value: String(deliberation.version) }),
            h(Field, { label: "纪要（Markdown）" },
              h("textarea", { name: "summaryMd", required: true }),
            ),
            h(Field, {
              label: "结果类别",
              hint: "这一格决定这份纪要在门那里算多重的证据，所以缺省取最弱的一档；要更重的分量，自己选。",
            },
              h("select", { name: "outcomeClass", defaultValue: "discussion_only" },
                ...OUTCOME_CLASS_OPTIONS.map(([value, label]) => h("option", { key: value, value }, label)),
              ),
            ),
            h("div", { className: "actions" },
              h("button", {
                type: "submit",
                "data-variant": "primary",
                "data-op": "deliberation.close",
                disabled: !canClose,
              }, "写下纪要并关闭"),
            ),
            h("p", { className: "reason" },
              "这张表单写不了 decisions 条目与 unresolved 列表：一个是对象数组、一个是字符串数组，而表单体是平的键值对，没有脚本的浏览器发不出它们。决议条目目前只能在关闭时经 API 或 MCP 写入——由于决议只由关闭审议产生，这意味着人手在这个界面上还建不出决议。这是缺口，写在这里而不是让它在提交时才炸。关闭是一次性的：纪要不可改，第二次解读要另写一份取代它的纪要。",
            ),
          )
        : null,
    ),
  );
}

// ---------------------------------------------------------------------------
// /projects/{projectId}/governance/decisions
// ---------------------------------------------------------------------------

export async function DecisionsPage(ctx: PageContext): Promise<ReactNode> {
  const entered = await enterProject(ctx, "decisions");
  if (!entered.ok) return entered.body;
  const scope = entered.scope;
  const search = ctx.search;
  const path = scope.path;

  const view = search.get("view") ?? "all";
  const list = await read<ListEnvelope<DecisionRecord>>(ctx, "decision.list", {
    projectId: scope.project.id,
    outcomeClass: param(search, "outcome"),
    sourceId: param(search, "source"),
    currentOnly: view === "current" ? true : undefined,
    cursor: param(search, "cursor"),
    limit: 50,
  });

  const header = [
    governanceCrumbs(scope.projectId, scope.project, "decisions"),
    h("h1", { key: "h1" }, "决议"),
    h("p", { className: "page-intro", key: "intro" },
      "决议日志，最新的在最前。被取代的决议仍然留在日志里——它是当时确实做出的决定，删掉它就等于说那次没发生过。",
    ),
    sectionNav(scope.projectId, "decisions"),
  ];

  if (!list.ok) {
    return h("div", null, ...header, refusalNotice(list.refusal));
  }

  const decisions = list.value;
  const onThisPage = new Set(decisions.items.map((decision) => decision.id));
  const chips: Array<{ key: string; label: string }> = [];
  const outcome = param(search, "outcome");
  const source = param(search, "source");
  if (outcome !== undefined) {
    chips.push({ key: "outcome", label: `类别 ${OUTCOME_CLASS_LABEL[outcome] ?? outcome}` });
  }
  if (source !== undefined) chips.push({ key: "source", label: `来源 ${source}` });

  /** A chain link only works if its other end is on this page; say so when it is not. */
  const chainLink = (id: string, lead: string): ReactNode =>
    onThisPage.has(id)
      ? h("p", { className: "reason" }, lead, h("a", { href: `#decision-${id}` }, id))
      : h("p", { className: "reason" }, `${lead}${id}（不在当前这一页上）`);

  return h("div", null,
    ...header,
    h("div", { className: "filterface" },
      tabs(path, search, "view", [[null, "全部"], ["current", "仅现行"]]),
      h("div", { className: "conditions" },
        dropdown(path, search, "outcome", "类别", OUTCOME_CLASS_OPTIONS),
        h("div", { className: "vr" }),
        h("span", { className: "tally" },
          h("b", null, String(decisions.items.length)), ` / ${decisions.total}`,
        ),
      ),
      appliedRow(path, search, chips),
    ),
    decisions.items.length === 0
      ? h(Empty, null, "还没有匹配的决议。")
      : h("div", null,
          ...decisions.items.map((decision) =>
            h("div", { className: "panel", key: decision.id, id: `decision-${decision.id}` },
              h("h2", null, decision.title),
              h("p", { className: "reason" },
                pill(
                  "outcome",
                  OUTCOME_CLASS_LABEL[decision.outcomeClass] ?? decision.outcomeClass,
                  decision.outcomeClass === "blocked" ? "blocked" : undefined,
                ),
                " · ",
                h(Attribution, { label: decision.deciderLabel }),
                " · ",
                when(decision.decidedAt),
                decision.supersededById === null ? null : " · 已被取代",
              ),
              decision.bodyMd === ""
                ? h("p", { className: "reason" }, "这条决议没有正文。")
                : h("div", { className: "prose" }, decision.bodyMd),
              h("dl", { className: "kv" },
                h("dt", null, "来源"),
                h("dd", null,
                  decision.sourceKind === null
                    ? "未记来源"
                    : `${decision.sourceKind === "deliberation_minutes" ? "审议纪要" : decision.sourceKind} ${decision.sourceId ?? ""}`,
                ),
                h("dt", null, "id"),
                h("dd", null, decision.id),
              ),
              decision.supersedesId === null ? null : chainLink(decision.supersedesId, "这条取代了 "),
              decision.supersededById === null ? null : chainLink(decision.supersededById, "这条已被取代于 "),
              decision.sourceId === null
                ? null
                : h("p", null,
                    h("a", { href: buildHref(path, search, { source: decision.sourceId, cursor: null }) },
                      "只看同一份纪要产出的决议",
                    ),
                  ),
            ),
          ),
        ),
    h(Truncation, {
      shown: decisions.items.length,
      total: decisions.total,
      nextHref: decisions.nextCursor === null
        ? null
        : buildHref(path, search, { cursor: decisions.nextCursor }),
    }),
    h(Panel, { title: "怎么写下一条决议" },
      h("p", { className: "reason" },
        "决议不是在这一页新建的，也没有单独的新建接口：它只在关闭一场审议、把结论写进纪要时产生。所以这一页是只读的，这是设计，不是尚未建成。",
      ),
      h("p", null,
        h("a", { href: `/projects/${encodeURIComponent(scope.projectId)}/governance/deliberations` },
          "到审议页开一场审议",
        ),
      ),
    ),
  );
}
