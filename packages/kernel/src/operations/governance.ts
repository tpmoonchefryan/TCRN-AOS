import { Type } from "@sinclair/typebox";
import type pg from "pg";
import { newId } from "../../../store/src/ids.js";
import { actorLabel, type Actor } from "../actor.js";
import { notifyWatchers, recordActivity, upsertSearchDoc } from "../audit.js";
import { fail } from "../errors.js";
import { decodeCursor, encodeCursor, enforceResponseBudget, filterDigest } from "../read.js";
import { defineOperation } from "../registry.js";

/**
 * Gates, deliberations and decisions.
 *
 * Per-project opt-in, and every operation here refuses on a project that has not opted
 * in. The refusal is `forbidden` rather than an empty list, because a project with
 * governance off must behave as if these tables do not exist and an empty list is an
 * answer about their contents.
 *
 * Everything written here is tier 3. The database refuses UPDATE and DELETE on
 * deliberation_position, deliberation_minutes, gate_decision and decision, so a
 * correction is a new row carrying supersedes_id and the superseded row stays readable.
 * None of them has a revision table and none needs one: the prior statement is still
 * there, in its own row, under its own author's name.
 */

const GATE_OUTCOME_CLASSES = ["role_decision", "owner_intent_required"] as const;
const GATE_STATUSES = ["pending", "satisfied", "blocked"] as const;
const GATE_DECISIONS = ["satisfied", "blocked"] as const;
const EVIDENCE_KINDS = ["minutes", "decision", "work_item"] as const;
const WORK_STATUSES = [
  "planned", "ready", "active", "blocked", "pending_acceptance", "done", "cancelled",
] as const;
const DELIBERATION_TYPES = [
  "strategy", "architecture", "risk", "verification", "release", "incident", "retrospective",
] as const;
const EXECUTION_MODES = ["undeclared", "synthesis_only", "multi_party"] as const;
const DELIBERATION_STATUSES = ["open", "closed", "cancelled"] as const;
const MINUTES_OUTCOME_CLASSES = [
  "discussion_only", "recommendation", "role_decision", "blocked", "owner_intent_required",
] as const;

/**
 * The two types where one voice is not enough on its own.
 *
 * An architecture or strategy call that turns out wrong is expensive to reverse, so those
 * are the two that must state their execution mode up front and must justify running
 * single-voice. Everywhere else an omitted mode stores `undeclared`, which reads as
 * unverified — never as multi-party.
 */
const MODE_MUST_BE_DECLARED = new Set<string>(["architecture", "strategy"]);

const GATE_LIST_SCHEMA_VERSION = "aos.gate.list.v1";
const GATE_LIST_SORT_VERSION = "created-desc-id-asc-v1";
const DELIBERATION_LIST_SCHEMA_VERSION = "aos.deliberation.list.v1";
const DELIBERATION_LIST_SORT_VERSION = "created-desc-id-asc-v1";
const DECISION_LIST_SCHEMA_VERSION = "aos.decision.list.v1";
const DECISION_LIST_SORT_VERSION = "decided-desc-id-asc-v1";

const LIST_BYTE_BUDGET = 1_048_576;

const GateOutcomeEnum = Type.Union(GATE_OUTCOME_CLASSES.map((value) => Type.Literal(value)));
const GateStatusEnum = Type.Union(GATE_STATUSES.map((value) => Type.Literal(value)));
const WorkStatusEnum = Type.Union(WORK_STATUSES.map((value) => Type.Literal(value)));
const DeliberationTypeEnum = Type.Union(DELIBERATION_TYPES.map((value) => Type.Literal(value)));
const ExecutionModeEnum = Type.Union(EXECUTION_MODES.map((value) => Type.Literal(value)));
const DeliberationStatusEnum = Type.Union(DELIBERATION_STATUSES.map((value) => Type.Literal(value)));
const MinutesOutcomeEnum = Type.Union(MINUTES_OUTCOME_CLASSES.map((value) => Type.Literal(value)));

// ---------------------------------------------------------------------------
// Shared guards
// ---------------------------------------------------------------------------

function requireProjectRole(
  actor: Actor,
  projectId: string,
  required: "viewer" | "contributor" | "maintainer" | "admin",
): void {
  if (actor.isInstanceAdmin) return;
  const rank = { viewer: 1, contributor: 2, maintainer: 3, admin: 4 };
  const held = actor.roles.get(projectId);
  if (!held || rank[held] < rank[required]) {
    fail("forbidden", `This action requires the ${required} role on that project`, { projectId });
  }
}

/**
 * Only a JSON `true` switches governance on.
 *
 * Compared as text against the exact string, so a `"yes"` or a `"true"` left in settings
 * by a hand edit does not enable a subsystem nobody chose through the product. Refusing
 * is the safe direction: the cost is one confused administrator, and the cost of the
 * other direction is a project acquiring blocking gates it never asked for.
 */
async function requireGovernance(client: pg.PoolClient, projectId: string): Promise<void> {
  const result = await client.query<{ governance: string | null }>(
    "SELECT settings->>'governance' AS governance FROM project WHERE id = $1 AND deleted_at IS NULL",
    [projectId],
  );
  const row = result.rows[0];
  if (!row) fail("not_found", "No such project");
  if (row.governance !== "true") {
    fail("forbidden", "Governance is not enabled on this project; switch it on in project settings first", {
      projectId,
    });
  }
}

// ---------------------------------------------------------------------------
// Gates
// ---------------------------------------------------------------------------

const GateShape = Type.Object({
  id: Type.String(),
  projectId: Type.String(),
  definitionId: Type.Union([Type.String(), Type.Null()]),
  workItemId: Type.Union([Type.String(), Type.Null()]),
  workItemKey: Type.Union([Type.String(), Type.Null()]),
  title: Type.String(),
  outcomeClass: Type.String(),
  status: Type.String(),
  blocksStatus: Type.String(),
  version: Type.Integer(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

interface GateRow {
  id: string;
  project_id: string;
  definition_id: string | null;
  work_item_id: string | null;
  work_item_key: string | null;
  title: string;
  outcome_class: string;
  status: string;
  blocks_status: string;
  version: number;
  created_at: Date;
  updated_at: Date;
  definition_requires_evidence: boolean | null;
}

const SELECT_GATE = `
  SELECT g.id, g.project_id, g.definition_id, g.work_item_id, w.key AS work_item_key,
         g.title, g.outcome_class, g.status, g.blocks_status, g.version, g.created_at, g.updated_at,
         d.requires_evidence AS definition_requires_evidence
    FROM gate g
    LEFT JOIN work_item w ON w.id = g.work_item_id
    LEFT JOIN gate_definition d ON d.id = g.definition_id
`;

function toGateShape(row: GateRow): Record<string, unknown> {
  return {
    id: row.id,
    projectId: row.project_id,
    definitionId: row.definition_id,
    workItemId: row.work_item_id,
    workItemKey: row.work_item_key,
    title: row.title,
    outcomeClass: row.outcome_class,
    status: row.status,
    blocksStatus: row.blocks_status,
    version: row.version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

async function loadGate(client: pg.PoolClient, gateId: string): Promise<GateRow> {
  const result = await client.query<GateRow>(`${SELECT_GATE} WHERE g.id = $1`, [gateId]);
  const row = result.rows[0];
  if (!row) fail("not_found", "No such gate", { gateId });
  return row;
}

export const createGate = defineOperation({
  id: "gate.create",
  kind: "command",
  summary: "Open a gate on a project or on one work item",
  input: Type.Object({
    projectId: Type.String({ minLength: 1 }),
    workItemKey: Type.Optional(Type.String({ minLength: 1 })),
    title: Type.String({ minLength: 1, maxLength: 400 }),
    outcomeClass: GateOutcomeEnum,
    blocksStatus: Type.Optional(WorkStatusEnum),
  }),
  output: GateShape,
  requires: { project: "maintainer", from: "input" },
  http: { method: "POST", path: "/api/v1/gates" },
  mcp: { tool: "aos_gate_create" },
  ui: { route: "/projects/{projectId}/governance/gates", control: "gate.create" },
  handler: async ({ client, actor }, input) => {
    await requireGovernance(client, input.projectId);

    let workItemId: string | null = null;
    let workItemKey: string | null = null;
    if (input.workItemKey) {
      const found = await client.query<{ id: string; key: string; project_id: string }>(
        "SELECT id, key, project_id FROM work_item WHERE (id = $1 OR key = upper($1)) AND deleted_at IS NULL",
        [input.workItemKey],
      );
      const item = found.rows[0];
      if (!item) fail("not_found", "No such work item", { ref: input.workItemKey });
      if (item.project_id !== input.projectId) {
        fail("validation_failed", "A gate and the work item it guards must be in the same project", {
          workItemKey: item.key,
        });
      }
      workItemId = item.id;
      workItemKey = item.key;
    }

    const id = newId("gt");
    const blocksStatus = input.blocksStatus ?? "done";
    await client.query(
      `INSERT INTO gate (id, project_id, work_item_id, title, outcome_class, blocks_status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, input.projectId, workItemId, input.title, input.outcomeClass, blocksStatus],
    );
    // Whoever raised the gate hears when it is decided; otherwise the only person who
    // knows the gate is still open is whoever is blocked by it.
    await client.query(
      "INSERT INTO watcher (subject_type, subject_id, principal_id) VALUES ('gate', $1, $2) ON CONFLICT DO NOTHING",
      [id, actor.principalId],
    );
    await recordActivity(client, actor, {
      action: "created",
      subjectType: "gate",
      subjectId: id,
      projectId: input.projectId,
    });
    await upsertSearchDoc(client, {
      subjectType: "gate",
      subjectId: id,
      projectId: input.projectId,
      title: input.title,
      body: "",
      key: workItemKey,
      status: "pending",
    });
    if (workItemId) {
      // News for whoever is watching the item, not for whoever is watching the gate: the
      // gate is one second old and nobody watches it yet.
      await notifyWatchers(client, actor, {
        subjectType: "work_item",
        subjectId: workItemId,
        subjectLabel: `${workItemKey ?? ""} ${input.title}`.trim(),
        kind: "gate_opened",
        extraPrincipalIds: [],
      });
    }
    return toGateShape(await loadGate(client, id)) as never;
  },
});

export const listGates = defineOperation({
  id: "gate.list",
  kind: "query",
  summary: "List a project's gates",
  input: Type.Object({
    // Required, not optional. Governance is a per-project opt-in and each project answers
    // differently, so there is no coherent cross-project gate list to return.
    projectId: Type.String({ minLength: 1 }),
    workItemKey: Type.Optional(Type.String({ minLength: 1 })),
    status: Type.Optional(GateStatusEnum),
    outcomeClass: Type.Optional(GateOutcomeEnum),
    open: Type.Optional(Type.Boolean()),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200, default: 50 })),
    cursor: Type.Optional(Type.String()),
  }),
  output: Type.Object({
    items: Type.Array(GateShape),
    nextCursor: Type.Union([Type.String(), Type.Null()]),
    total: Type.Integer(),
    truncated: Type.Boolean(),
  }),
  requires: { project: "viewer", from: "input" },
  http: { method: "GET", path: "/api/v1/gates" },
  mcp: { tool: "aos_gate_list" },
  ui: { route: "/projects/{projectId}/governance/gates", control: "gate.list" },
  byteBudget: LIST_BYTE_BUDGET,
  handler: async ({ client }, input) => {
    await requireGovernance(client, input.projectId);
    const limit = input.limit ?? 50;
    const digest = filterDigest({
      projectId: input.projectId, workItemKey: input.workItemKey, status: input.status,
      outcomeClass: input.outcomeClass, open: input.open,
    });

    const params: unknown[] = [];
    const push = (value: unknown): string => {
      params.push(value);
      return `$${params.length}`;
    };
    const where: string[] = [`g.project_id = ${push(input.projectId)}`];
    if (input.workItemKey) where.push(`w.key = upper(${push(input.workItemKey)})`);
    if (input.status) where.push(`g.status = ${push(input.status)}`);
    if (input.outcomeClass) where.push(`g.outcome_class = ${push(input.outcomeClass)}`);
    if (input.open) where.push("g.status <> 'satisfied'");

    if (input.cursor) {
      const cursor = decodeCursor(input.cursor, {
        schemaVersion: GATE_LIST_SCHEMA_VERSION,
        sortVersion: GATE_LIST_SORT_VERSION,
        filterDigest: digest,
        limit,
      });
      where.push(`(g.created_at, g.id) < (${push(cursor.last.sortKey)}::timestamptz, ${push(cursor.last.id)})`);
    }

    const whereSql = where.join(" AND ");
    const totalResult = await client.query<{ count: string }>(
      `SELECT count(*) AS count FROM gate g LEFT JOIN work_item w ON w.id = g.work_item_id WHERE ${whereSql}`,
      params,
    );
    const total = Number(totalResult.rows[0]?.count ?? 0);

    const rows = await client.query<GateRow>(
      `${SELECT_GATE} WHERE ${whereSql} ORDER BY g.created_at DESC, g.id ASC LIMIT ${push(limit + 1)}`,
      params,
    );

    const page = rows.rows.slice(0, limit);
    const hasMore = rows.rows.length > limit;
    const last = page.at(-1);
    const nextCursor =
      hasMore && last
        ? encodeCursor({
            schemaVersion: GATE_LIST_SCHEMA_VERSION,
            sortVersion: GATE_LIST_SORT_VERSION,
            filterDigest: digest,
            limit,
            last: { sortKey: last.created_at.toISOString(), id: last.id },
          })
        : null;

    return enforceResponseBudget(
      { items: page.map(toGateShape), nextCursor, total, truncated: hasMore },
      LIST_BYTE_BUDGET,
      total,
    ) as never;
  },
});

export const decideGate = defineOperation({
  id: "gate.decide",
  kind: "command",
  summary: "Record a decision on a gate and move the gate to match it",
  input: Type.Object({
    gateId: Type.String({ minLength: 1 }),
    decision: Type.Union(GATE_DECISIONS.map((value) => Type.Literal(value))),
    evidenceKind: Type.Optional(Type.Union(EVIDENCE_KINDS.map((value) => Type.Literal(value)))),
    evidenceId: Type.Optional(Type.String({ minLength: 1 })),
    rationaleMd: Type.Optional(Type.String({ maxLength: 100_000 })),
    supersedesId: Type.Optional(Type.String({ minLength: 1 })),
    // Optional because the decision itself is append-only and always lands; what this
    // guards is the gate row the decision projects onto. Supplied or not, the UPDATE is a
    // compare-and-swap on the version that was read, so two people deciding at once
    // cannot have one of them silently overwrite the other's status.
    expectedVersion: Type.Optional(Type.Integer({ minimum: 1 })),
  }),
  output: Type.Intersect([GateShape, Type.Object({ decisionId: Type.String() })]),
  requires: "authenticated",
  http: { method: "POST", path: "/api/v1/gates/{gateId}/decide" },
  mcp: { tool: "aos_gate_decide" },
  ui: { route: "/governance/gates/{gateId}", control: "gate.decide" },
  handler: async ({ client, actor }, input) => {
    const row = await loadGate(client, input.gateId);
    await requireGovernance(client, row.project_id);
    requireProjectRole(actor, row.project_id, "maintainer");

    if (input.expectedVersion !== undefined && row.version !== input.expectedVersion) {
      fail("stale_version", "Someone else decided this gate while you were deciding it", {
        currentVersion: row.version,
        yourVersion: input.expectedVersion,
      });
    }

    // The gate table carries no requires_evidence column of its own, so a gate raised
    // without a definition inherits the definition default rather than the weaker answer.
    // A gate that can be waved through by asserting it is satisfied is not a gate.
    const requiresEvidence = row.definition_requires_evidence ?? true;
    const evidenceKind = input.evidenceKind ?? "minutes";
    if (input.decision === "satisfied" && requiresEvidence && !input.evidenceId) {
      fail("validation_failed", "Clearing this gate requires evidence: name the record that cleared it", {
        gateId: row.id,
        missing: ["evidenceId"],
        expectedEvidenceKind: evidenceKind,
      });
    }

    if (input.evidenceId) {
      await assertEvidence(client, row.project_id, evidenceKind, input.evidenceId);
    }
    if (input.supersedesId) {
      const prior = await client.query(
        "SELECT 1 FROM gate_decision WHERE id = $1 AND gate_id = $2",
        [input.supersedesId, row.id],
      );
      if (prior.rowCount === 0) {
        fail("validation_failed", "A correction must supersede a decision on this same gate", {
          supersedesId: input.supersedesId,
        });
      }
    }

    // INSERT, never UPDATE: gate_decision is tier 3 and the database refuses to change a
    // decision after the fact. Reversing one means writing a new decision that supersedes it.
    const decisionId = newId("gd");
    await client.query(
      `INSERT INTO gate_decision
         (id, gate_id, decision, evidence_kind, evidence_id, rationale_md, decided_by, decider_label, supersedes_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        decisionId, row.id, input.decision, evidenceKind, input.evidenceId ?? null,
        input.rationaleMd ?? "", actor.principalId || null, actorLabel(actor), input.supersedesId ?? null,
      ],
    );

    const updated = await client.query(
      "UPDATE gate SET status = $1, version = version + 1, updated_at = now() WHERE id = $2 AND version = $3",
      [input.decision, row.id, row.version],
    );
    if (updated.rowCount === 0) {
      const current = await client.query<{ version: number }>("SELECT version FROM gate WHERE id = $1", [row.id]);
      fail("stale_version", "Someone else decided this gate while you were deciding it", {
        currentVersion: current.rows[0]?.version ?? null,
        yourVersion: row.version,
      });
    }

    await recordActivity(client, actor, {
      action: `gate:${input.decision}`,
      subjectType: "gate",
      subjectId: row.id,
      projectId: row.project_id,
      fieldNames: ["status"],
    });
    await client.query(
      "UPDATE search_doc SET status = $1 WHERE subject_type = 'gate' AND subject_id = $2",
      [input.decision, row.id],
    );

    // One notification per person. Whoever watches the blocked item cares as much as
    // whoever watches the gate, and two separate calls would send them both a copy.
    const itemWatchers: string[] = [];
    if (row.work_item_id) {
      const found = await client.query<{ principal_id: string }>(
        "SELECT principal_id FROM watcher WHERE subject_type = 'work_item' AND subject_id = $1",
        [row.work_item_id],
      );
      for (const watcher of found.rows) itemWatchers.push(watcher.principal_id);
    }
    await notifyWatchers(client, actor, {
      subjectType: "gate",
      subjectId: row.id,
      subjectLabel: `${row.work_item_key ?? ""} ${row.title}`.trim(),
      kind: "gate_decided",
      extraPrincipalIds: itemWatchers,
    });

    return { ...toGateShape(await loadGate(client, row.id)), decisionId } as never;
  },
});

/**
 * Evidence has to point at something real, in this project.
 *
 * Minutes are the normal case and carry the extra condition: minutes from a deliberation
 * still in progress are not a conclusion, so they cannot clear anything.
 */
async function assertEvidence(
  client: pg.PoolClient,
  projectId: string,
  kind: "minutes" | "decision" | "work_item",
  evidenceId: string,
): Promise<void> {
  if (kind === "minutes") {
    const found = await client.query<{ status: string; project_id: string }>(
      `SELECT d.status, d.project_id
         FROM deliberation_minutes m JOIN deliberation d ON d.id = m.deliberation_id
        WHERE m.id = $1`,
      [evidenceId],
    );
    const minutes = found.rows[0];
    if (!minutes) fail("validation_failed", "No such deliberation minutes", { evidenceId });
    if (minutes.project_id !== projectId) {
      fail("validation_failed", "Evidence must come from the same project as the gate", { evidenceId });
    }
    if (minutes.status !== "closed") {
      fail("validation_failed", "Those minutes belong to a deliberation that is still open", {
        evidenceId,
        deliberationStatus: minutes.status,
      });
    }
    return;
  }

  const found =
    kind === "decision"
      ? await client.query<{ project_id: string }>("SELECT project_id FROM decision WHERE id = $1", [evidenceId])
      : await client.query<{ project_id: string }>(
          "SELECT project_id FROM work_item WHERE id = $1 AND deleted_at IS NULL",
          [evidenceId],
        );
  const evidence = found.rows[0];
  if (!evidence) fail("validation_failed", `No such ${kind} to cite as evidence`, { evidenceId });
  if (evidence.project_id !== projectId) {
    fail("validation_failed", "Evidence must come from the same project as the gate", { evidenceId });
  }
}

// ---------------------------------------------------------------------------
// Deliberations
// ---------------------------------------------------------------------------

const DeliberationShape = Type.Object({
  id: Type.String(),
  projectId: Type.String(),
  type: Type.String(),
  title: Type.String(),
  desiredOutcome: Type.String(),
  executionMode: Type.String(),
  status: Type.String(),
  createdBy: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
  closedAt: Type.Union([Type.String(), Type.Null()]),
  version: Type.Integer(),
});

const PositionShape = Type.Object({
  id: Type.String(),
  deliberationId: Type.String(),
  round: Type.Integer(),
  respondsToId: Type.Union([Type.String(), Type.Null()]),
  actorId: Type.Union([Type.String(), Type.Null()]),
  actorLabel: Type.String(),
  persona: Type.Union([Type.String(), Type.Null()]),
  bodyMd: Type.String(),
  risks: Type.Array(Type.String()),
  recommendations: Type.Array(Type.String()),
  supersedesId: Type.Union([Type.String(), Type.Null()]),
  supersededById: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
});

const DecisionEntryShape = Type.Object({
  title: Type.String(),
  bodyMd: Type.String(),
  outcomeClass: Type.String(),
});

const MinutesShape = Type.Object({
  id: Type.String(),
  deliberationId: Type.String(),
  summaryMd: Type.String(),
  outcomeClass: Type.String(),
  decisions: Type.Array(DecisionEntryShape),
  unresolved: Type.Array(Type.String()),
  authorLabel: Type.String(),
  supersedesId: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
});

interface DeliberationRow {
  id: string;
  project_id: string;
  type: string;
  title: string;
  desired_outcome: string;
  execution_mode: string;
  status: string;
  created_by: string | null;
  created_at: Date;
  closed_at: Date | null;
  version: number;
}

interface PositionRow {
  id: string;
  deliberation_id: string;
  round: number;
  responds_to_id: string | null;
  actor_id: string | null;
  actor_label: string;
  persona: string | null;
  body_md: string;
  risks: unknown;
  recommendations: unknown;
  supersedes_id: string | null;
  superseded_by_id: string | null;
  created_at: Date;
}

interface MinutesRow {
  id: string;
  deliberation_id: string;
  summary_md: string;
  outcome_class: string;
  decisions: unknown;
  unresolved: unknown;
  author_label: string;
  supersedes_id: string | null;
  created_at: Date;
}

const SELECT_DELIBERATION = `
  SELECT id, project_id, type, title, desired_outcome, execution_mode, status,
         created_by, created_at, closed_at, version
    FROM deliberation
`;

function toDeliberationShape(row: DeliberationRow): Record<string, unknown> {
  return {
    id: row.id,
    projectId: row.project_id,
    type: row.type,
    title: row.title,
    desiredOutcome: row.desired_outcome,
    executionMode: row.execution_mode,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    closedAt: row.closed_at ? row.closed_at.toISOString() : null,
    version: row.version,
  };
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function decisionEntries(value: unknown): { title: string; bodyMd: string; outcomeClass: string }[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const record = (entry ?? {}) as Record<string, unknown>;
    return {
      title: typeof record.title === "string" ? record.title : "",
      bodyMd: typeof record.bodyMd === "string" ? record.bodyMd : "",
      outcomeClass: typeof record.outcomeClass === "string" ? record.outcomeClass : "",
    };
  });
}

function toPositionShape(row: PositionRow): Record<string, unknown> {
  return {
    id: row.id,
    deliberationId: row.deliberation_id,
    round: row.round,
    respondsToId: row.responds_to_id,
    actorId: row.actor_id,
    actorLabel: row.actor_label,
    persona: row.persona,
    bodyMd: row.body_md,
    risks: stringList(row.risks),
    recommendations: stringList(row.recommendations),
    supersedesId: row.supersedes_id,
    supersededById: row.superseded_by_id,
    createdAt: row.created_at.toISOString(),
  };
}

function toMinutesShape(row: MinutesRow): Record<string, unknown> {
  return {
    id: row.id,
    deliberationId: row.deliberation_id,
    summaryMd: row.summary_md,
    outcomeClass: row.outcome_class,
    decisions: decisionEntries(row.decisions),
    unresolved: stringList(row.unresolved),
    authorLabel: row.author_label,
    supersedesId: row.supersedes_id,
    createdAt: row.created_at.toISOString(),
  };
}

async function loadDeliberation(client: pg.PoolClient, id: string): Promise<DeliberationRow> {
  const result = await client.query<DeliberationRow>(`${SELECT_DELIBERATION} WHERE id = $1`, [id]);
  const row = result.rows[0];
  if (!row) fail("not_found", "No such deliberation", { deliberationId: id });
  return row;
}

/**
 * Rebuild the deliberation's search document from everything said in it.
 *
 * Indexing only the title makes a deliberation findable by someone who already knows it
 * exists, which is the one person who does not need to find it. This rewrites the whole
 * document on every position, which is deliberate: the alternative is a partial index
 * that quietly stops matching the argument it claims to cover.
 */
async function refreshDeliberationSearch(client: pg.PoolClient, deliberationId: string): Promise<void> {
  const row = await loadDeliberation(client, deliberationId);
  const positions = await client.query<{ body_md: string }>(
    "SELECT body_md FROM deliberation_position WHERE deliberation_id = $1 ORDER BY round, created_at",
    [deliberationId],
  );
  const minutes = await client.query<{ summary_md: string }>(
    "SELECT summary_md FROM deliberation_minutes WHERE deliberation_id = $1 ORDER BY created_at",
    [deliberationId],
  );
  const body = [
    row.desired_outcome,
    ...positions.rows.map((position) => position.body_md),
    ...minutes.rows.map((entry) => entry.summary_md),
  ].join("\n");
  await upsertSearchDoc(client, {
    subjectType: "deliberation",
    subjectId: row.id,
    projectId: row.project_id,
    title: row.title,
    body,
    key: null,
    status: row.status,
  });
}

export const openDeliberation = defineOperation({
  id: "deliberation.open",
  kind: "command",
  summary: "Open a deliberation",
  input: Type.Object({
    projectId: Type.String({ minLength: 1 }),
    type: DeliberationTypeEnum,
    title: Type.String({ minLength: 1, maxLength: 400 }),
    desiredOutcome: Type.Optional(Type.String({ maxLength: 20_000 })),
    executionMode: Type.Optional(ExecutionModeEnum),
  }),
  output: DeliberationShape,
  requires: { project: "contributor", from: "input" },
  http: { method: "POST", path: "/api/v1/deliberations" },
  mcp: { tool: "aos_deliberation_open" },
  ui: { route: "/projects/{projectId}/governance/deliberations", control: "deliberation.open" },
  handler: async ({ client, actor }, input) => {
    await requireGovernance(client, input.projectId);

    const executionMode = input.executionMode ?? "undeclared";
    const desiredOutcome = input.desiredOutcome ?? "";
    if (MODE_MUST_BE_DECLARED.has(input.type)) {
      if (executionMode === "undeclared") {
        fail("validation_failed", `A ${input.type} deliberation must declare its executionMode`, {
          type: input.type,
          missing: ["executionMode"],
          permitted: ["synthesis_only", "multi_party"],
        });
      }
      // Running one of these single-voice is allowed and sometimes right, but it is a
      // choice, and a choice nobody wrote down is indistinguishable from an oversight.
      if (executionMode === "synthesis_only" && desiredOutcome.trim() === "") {
        fail("validation_failed", `A synthesis-only ${input.type} deliberation must say why one voice is enough; put the reason in desiredOutcome`, {
          type: input.type,
          executionMode,
          missing: ["desiredOutcome"],
        });
      }
    }

    const id = newId("dl");
    await client.query(
      `INSERT INTO deliberation (id, project_id, type, title, desired_outcome, execution_mode, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, input.projectId, input.type, input.title, desiredOutcome, executionMode, actor.principalId || null],
    );
    await client.query(
      "INSERT INTO watcher (subject_type, subject_id, principal_id) VALUES ('deliberation', $1, $2) ON CONFLICT DO NOTHING",
      [id, actor.principalId],
    );
    await recordActivity(client, actor, {
      action: "opened",
      subjectType: "deliberation",
      subjectId: id,
      projectId: input.projectId,
    });
    await refreshDeliberationSearch(client, id);
    return toDeliberationShape(await loadDeliberation(client, id)) as never;
  },
});

/**
 * The successor is found by scalar subquery, not by a join.
 *
 * Two corrections can chase the same position, and a LEFT JOIN would then return that
 * position twice — the list would show a duplicate and nothing would say why.
 */
const SELECT_POSITION = `
  SELECT p.id, p.deliberation_id, p.round, p.responds_to_id, p.actor_id, p.actor_label,
         p.persona, p.body_md, p.risks, p.recommendations, p.supersedes_id, p.created_at,
         (SELECT s.id FROM deliberation_position s
           WHERE s.supersedes_id = p.id ORDER BY s.created_at, s.id LIMIT 1) AS superseded_by_id
    FROM deliberation_position p
`;

export const addPosition = defineOperation({
  id: "deliberation.add_position",
  kind: "command",
  summary: "Add a position to an open deliberation",
  input: Type.Object({
    deliberationId: Type.String({ minLength: 1 }),
    bodyMd: Type.String({ minLength: 1, maxLength: 200_000 }),
    round: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
    respondsToId: Type.Optional(Type.String({ minLength: 1 })),
    persona: Type.Optional(Type.String({ maxLength: 200 })),
    risks: Type.Optional(Type.Array(Type.String({ minLength: 1, maxLength: 2000 }), { maxItems: 50 })),
    recommendations: Type.Optional(
      Type.Array(Type.String({ minLength: 1, maxLength: 2000 }), { maxItems: 50 }),
    ),
    supersedesId: Type.Optional(Type.String({ minLength: 1 })),
  }),
  output: PositionShape,
  requires: "authenticated",
  http: { method: "POST", path: "/api/v1/deliberations/{deliberationId}/positions" },
  mcp: { tool: "aos_deliberation_add_position" },
  ui: { route: "/governance/deliberations/{deliberationId}", control: "deliberation.add_position" },
  handler: async ({ client, actor }, input) => {
    const row = await loadDeliberation(client, input.deliberationId);
    await requireGovernance(client, row.project_id);
    requireProjectRole(actor, row.project_id, "contributor");
    if (row.status !== "open") {
      fail("conflict", "A deliberation that is no longer open takes no further positions", {
        deliberationId: row.id,
        status: row.status,
      });
    }

    // The round comes from the caller or from the round its siblings are explicitly in.
    // It is never read out of the body: a heuristic over prose mis-files a position in a
    // round nobody put it in, and nothing about the record says that happened.
    const highest = await client.query<{ max_round: number | null }>(
      "SELECT max(round) AS max_round FROM deliberation_position WHERE deliberation_id = $1",
      [row.id],
    );
    const round = input.round ?? highest.rows[0]?.max_round ?? 1;

    let respondsToActor: string | null = null;
    if (input.respondsToId) {
      const parent = await client.query<{ actor_id: string | null }>(
        "SELECT actor_id FROM deliberation_position WHERE id = $1 AND deliberation_id = $2",
        [input.respondsToId, row.id],
      );
      if (parent.rowCount === 0) {
        fail("validation_failed", "A reply must answer a position in this same deliberation", {
          respondsToId: input.respondsToId,
        });
      }
      respondsToActor = parent.rows[0]?.actor_id ?? null;
    }
    if (input.supersedesId) {
      const prior = await client.query(
        "SELECT 1 FROM deliberation_position WHERE id = $1 AND deliberation_id = $2",
        [input.supersedesId, row.id],
      );
      if (prior.rowCount === 0) {
        fail("validation_failed", "A correction must supersede a position in this same deliberation", {
          supersedesId: input.supersedesId,
        });
      }
    }

    // The superseded row is left exactly as it was. A defeated position stays on the
    // record; reading it back is what tells someone the argument was had at all.
    const id = newId("dp");
    await client.query(
      `INSERT INTO deliberation_position
         (id, deliberation_id, round, responds_to_id, actor_id, actor_label, persona, body_md,
          risks, recommendations, supersedes_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        id, row.id, round, input.respondsToId ?? null, actor.principalId || null, actorLabel(actor),
        input.persona ?? null, input.bodyMd,
        JSON.stringify(input.risks ?? []), JSON.stringify(input.recommendations ?? []),
        input.supersedesId ?? null,
      ],
    );
    await recordActivity(client, actor, {
      action: "position_added",
      subjectType: "deliberation",
      subjectId: row.id,
      projectId: row.project_id,
      fieldNames: ["positions"],
    });
    await refreshDeliberationSearch(client, row.id);
    await notifyWatchers(client, actor, {
      subjectType: "deliberation",
      subjectId: row.id,
      subjectLabel: row.title,
      kind: "deliberation_position_added",
      // Whoever is being answered is told, whether or not they thought to watch the thread.
      extraPrincipalIds: respondsToActor ? [respondsToActor] : [],
    });

    const written = await client.query<PositionRow>(
      `${SELECT_POSITION} WHERE p.id = $1`,
      [id],
    );
    return toPositionShape(written.rows[0]!) as never;
  },
});

export const closeDeliberation = defineOperation({
  id: "deliberation.close",
  kind: "command",
  summary: "Close a deliberation with minutes and record its decisions",
  input: Type.Object({
    deliberationId: Type.String({ minLength: 1 }),
    summaryMd: Type.String({ minLength: 1, maxLength: 200_000 }),
    outcomeClass: MinutesOutcomeEnum,
    decisions: Type.Optional(
      Type.Array(
        Type.Object({
          title: Type.String({ minLength: 1, maxLength: 400 }),
          bodyMd: Type.Optional(Type.String({ maxLength: 100_000 })),
          outcomeClass: Type.Optional(MinutesOutcomeEnum),
        }),
        { maxItems: 50 },
      ),
    ),
    unresolved: Type.Optional(Type.Array(Type.String({ minLength: 1, maxLength: 2000 }), { maxItems: 50 })),
    expectedVersion: Type.Optional(Type.Integer({ minimum: 1 })),
  }),
  output: Type.Intersect([
    DeliberationShape,
    Type.Object({ minutesId: Type.String(), decisionIds: Type.Array(Type.String()) }),
  ]),
  requires: "authenticated",
  http: { method: "POST", path: "/api/v1/deliberations/{deliberationId}/close" },
  mcp: { tool: "aos_deliberation_close" },
  ui: { route: "/governance/deliberations/{deliberationId}", control: "deliberation.close" },
  handler: async ({ client, actor }, input) => {
    const row = await loadDeliberation(client, input.deliberationId);
    await requireGovernance(client, row.project_id);
    requireProjectRole(actor, row.project_id, "maintainer");
    if (row.status !== "open") {
      // Minutes are immutable, so closing twice cannot mean "replace what was written".
      // A second reading of the same deliberation is superseding minutes, which is a
      // different act with a different author and its own row.
      fail("conflict", "This deliberation is already closed", {
        deliberationId: row.id,
        status: row.status,
      });
    }
    if (input.expectedVersion !== undefined && row.version !== input.expectedVersion) {
      fail("stale_version", "Someone else changed this deliberation while you were closing it", {
        currentVersion: row.version,
        yourVersion: input.expectedVersion,
      });
    }

    const entries = (input.decisions ?? []).map((entry) => ({
      title: entry.title,
      bodyMd: entry.bodyMd ?? "",
      outcomeClass: entry.outcomeClass ?? input.outcomeClass,
    }));

    const minutesId = newId("dm");
    await client.query(
      `INSERT INTO deliberation_minutes
         (id, deliberation_id, summary_md, outcome_class, decisions, unresolved, author_label)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        minutesId, row.id, input.summaryMd, input.outcomeClass,
        JSON.stringify(entries), JSON.stringify(input.unresolved ?? []), actorLabel(actor),
      ],
    );

    const closed = await client.query(
      `UPDATE deliberation SET status = 'closed', closed_at = now(), version = version + 1
        WHERE id = $1 AND version = $2 AND status = 'open'`,
      [row.id, row.version],
    );
    if (closed.rowCount === 0) {
      const current = await client.query<{ version: number }>(
        "SELECT version FROM deliberation WHERE id = $1",
        [row.id],
      );
      fail("stale_version", "Someone else changed this deliberation while you were closing it", {
        currentVersion: current.rows[0]?.version ?? null,
        yourVersion: row.version,
      });
    }

    // Each decision also lands as its own row. A decision log that lives only inside the
    // minutes JSON is not a log; it is a document somebody has to parse to answer "what
    // did we decide", and every reader parses it differently.
    const decisionIds: string[] = [];
    for (const entry of entries) {
      const decisionId = newId("dc");
      await client.query(
        `INSERT INTO decision
           (id, project_id, title, body_md, outcome_class, source_kind, source_id, decided_by, decider_label)
         VALUES ($1, $2, $3, $4, $5, 'deliberation_minutes', $6, $7, $8)`,
        [
          decisionId, row.project_id, entry.title, entry.bodyMd, entry.outcomeClass,
          minutesId, actor.principalId || null, actorLabel(actor),
        ],
      );
      await recordActivity(client, actor, {
        action: "recorded",
        subjectType: "decision",
        subjectId: decisionId,
        projectId: row.project_id,
      });
      await upsertSearchDoc(client, {
        subjectType: "decision",
        subjectId: decisionId,
        projectId: row.project_id,
        title: entry.title,
        body: entry.bodyMd,
        key: null,
        status: entry.outcomeClass,
      });
      decisionIds.push(decisionId);
    }

    await recordActivity(client, actor, {
      action: "closed",
      subjectType: "deliberation",
      subjectId: row.id,
      projectId: row.project_id,
      fieldNames: ["status", "minutes"],
    });
    await refreshDeliberationSearch(client, row.id);

    // Everyone who argued hears how it landed, watching or not. Being told the outcome of
    // an argument you took part in is not a subscription you should have to remember.
    const speakers = await client.query<{ actor_id: string | null }>(
      "SELECT DISTINCT actor_id FROM deliberation_position WHERE deliberation_id = $1 AND actor_id IS NOT NULL",
      [row.id],
    );
    await notifyWatchers(client, actor, {
      subjectType: "deliberation",
      subjectId: row.id,
      subjectLabel: row.title,
      kind: "deliberation_closed",
      extraPrincipalIds: speakers.rows
        .map((speaker) => speaker.actor_id)
        .filter((id): id is string => typeof id === "string"),
    });

    return {
      ...toDeliberationShape(await loadDeliberation(client, row.id)),
      minutesId,
      decisionIds,
    } as never;
  },
});

export const getDeliberation = defineOperation({
  id: "deliberation.get",
  kind: "query",
  summary: "Read one deliberation with its positions and minutes",
  input: Type.Object({ deliberationId: Type.String({ minLength: 1 }) }),
  output: Type.Intersect([
    DeliberationShape,
    Type.Object({
      positions: Type.Array(PositionShape),
      minutes: Type.Array(MinutesShape),
    }),
  ]),
  requires: "authenticated",
  http: { method: "GET", path: "/api/v1/deliberations/{deliberationId}" },
  mcp: { tool: "aos_deliberation_get" },
  ui: { route: "/governance/deliberations/{deliberationId}", control: "deliberation.get" },
  byteBudget: LIST_BYTE_BUDGET,
  handler: async ({ client, actor }, input) => {
    const row = await loadDeliberation(client, input.deliberationId);
    await requireGovernance(client, row.project_id);
    requireProjectRole(actor, row.project_id, "viewer");

    // Superseded positions are returned too, flagged rather than filtered. Hiding them
    // leaves a reply chain answering statements the reader cannot see.
    const positions = await client.query<PositionRow>(
      `${SELECT_POSITION} WHERE p.deliberation_id = $1 ORDER BY p.round ASC, p.created_at ASC, p.id ASC`,
      [row.id],
    );
    const minutes = await client.query<MinutesRow>(
      `SELECT id, deliberation_id, summary_md, outcome_class, decisions, unresolved,
              author_label, supersedes_id, created_at
         FROM deliberation_minutes
        WHERE deliberation_id = $1
        ORDER BY created_at DESC, id DESC`,
      [row.id],
    );

    return enforceResponseBudget(
      {
        ...toDeliberationShape(row),
        positions: positions.rows.map(toPositionShape),
        minutes: minutes.rows.map(toMinutesShape),
      },
      LIST_BYTE_BUDGET,
      positions.rowCount ?? 0,
    ) as never;
  },
});

export const listDeliberations = defineOperation({
  id: "deliberation.list",
  kind: "query",
  summary: "List a project's deliberations",
  input: Type.Object({
    projectId: Type.String({ minLength: 1 }),
    type: Type.Optional(DeliberationTypeEnum),
    status: Type.Optional(DeliberationStatusEnum),
    executionMode: Type.Optional(ExecutionModeEnum),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200, default: 50 })),
    cursor: Type.Optional(Type.String()),
  }),
  output: Type.Object({
    items: Type.Array(DeliberationShape),
    nextCursor: Type.Union([Type.String(), Type.Null()]),
    total: Type.Integer(),
    truncated: Type.Boolean(),
  }),
  requires: { project: "viewer", from: "input" },
  http: { method: "GET", path: "/api/v1/deliberations" },
  mcp: { tool: "aos_deliberation_list" },
  ui: { route: "/projects/{projectId}/governance/deliberations", control: "deliberation.list" },
  byteBudget: LIST_BYTE_BUDGET,
  handler: async ({ client }, input) => {
    await requireGovernance(client, input.projectId);
    const limit = input.limit ?? 50;
    const digest = filterDigest({
      projectId: input.projectId, type: input.type, status: input.status,
      executionMode: input.executionMode,
    });

    const params: unknown[] = [];
    const push = (value: unknown): string => {
      params.push(value);
      return `$${params.length}`;
    };
    const where: string[] = [`project_id = ${push(input.projectId)}`];
    if (input.type) where.push(`type = ${push(input.type)}`);
    if (input.status) where.push(`status = ${push(input.status)}`);
    if (input.executionMode) where.push(`execution_mode = ${push(input.executionMode)}`);

    if (input.cursor) {
      const cursor = decodeCursor(input.cursor, {
        schemaVersion: DELIBERATION_LIST_SCHEMA_VERSION,
        sortVersion: DELIBERATION_LIST_SORT_VERSION,
        filterDigest: digest,
        limit,
      });
      where.push(`(created_at, id) < (${push(cursor.last.sortKey)}::timestamptz, ${push(cursor.last.id)})`);
    }

    const whereSql = where.join(" AND ");
    const totalResult = await client.query<{ count: string }>(
      `SELECT count(*) AS count FROM deliberation WHERE ${whereSql}`,
      params,
    );
    const total = Number(totalResult.rows[0]?.count ?? 0);

    const rows = await client.query<DeliberationRow>(
      `${SELECT_DELIBERATION} WHERE ${whereSql} ORDER BY created_at DESC, id ASC LIMIT ${push(limit + 1)}`,
      params,
    );

    const page = rows.rows.slice(0, limit);
    const hasMore = rows.rows.length > limit;
    const last = page.at(-1);
    const nextCursor =
      hasMore && last
        ? encodeCursor({
            schemaVersion: DELIBERATION_LIST_SCHEMA_VERSION,
            sortVersion: DELIBERATION_LIST_SORT_VERSION,
            filterDigest: digest,
            limit,
            last: { sortKey: last.created_at.toISOString(), id: last.id },
          })
        : null;

    return enforceResponseBudget(
      { items: page.map(toDeliberationShape), nextCursor, total, truncated: hasMore },
      LIST_BYTE_BUDGET,
      total,
    ) as never;
  },
});

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

const DecisionShape = Type.Object({
  id: Type.String(),
  projectId: Type.String(),
  title: Type.String(),
  bodyMd: Type.String(),
  outcomeClass: Type.String(),
  sourceKind: Type.Union([Type.String(), Type.Null()]),
  sourceId: Type.Union([Type.String(), Type.Null()]),
  decidedBy: Type.Union([Type.String(), Type.Null()]),
  deciderLabel: Type.String(),
  supersedesId: Type.Union([Type.String(), Type.Null()]),
  supersededById: Type.Union([Type.String(), Type.Null()]),
  decidedAt: Type.String(),
});

interface DecisionRow {
  id: string;
  project_id: string;
  title: string;
  body_md: string;
  outcome_class: string;
  source_kind: string | null;
  source_id: string | null;
  decided_by: string | null;
  decider_label: string;
  supersedes_id: string | null;
  superseded_by_id: string | null;
  decided_at: Date;
}

const SELECT_DECISION = `
  SELECT d.id, d.project_id, d.title, d.body_md, d.outcome_class, d.source_kind, d.source_id,
         d.decided_by, d.decider_label, d.supersedes_id, d.decided_at,
         (SELECT s.id FROM decision s WHERE s.supersedes_id = d.id ORDER BY s.decided_at, s.id LIMIT 1)
           AS superseded_by_id
    FROM decision d
`;

function toDecisionShape(row: DecisionRow): Record<string, unknown> {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    bodyMd: row.body_md,
    outcomeClass: row.outcome_class,
    sourceKind: row.source_kind,
    sourceId: row.source_id,
    decidedBy: row.decided_by,
    deciderLabel: row.decider_label,
    supersedesId: row.supersedes_id,
    supersededById: row.superseded_by_id,
    decidedAt: row.decided_at.toISOString(),
  };
}

export const listDecisions = defineOperation({
  id: "decision.list",
  kind: "query",
  summary: "List a project's decision log",
  input: Type.Object({
    projectId: Type.String({ minLength: 1 }),
    outcomeClass: Type.Optional(MinutesOutcomeEnum),
    sourceId: Type.Optional(Type.String({ minLength: 1 })),
    // A superseded decision is still what was decided at the time, so it stays in the log
    // by default and this narrows the list rather than defining it away.
    currentOnly: Type.Optional(Type.Boolean()),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200, default: 50 })),
    cursor: Type.Optional(Type.String()),
  }),
  output: Type.Object({
    items: Type.Array(DecisionShape),
    nextCursor: Type.Union([Type.String(), Type.Null()]),
    total: Type.Integer(),
    truncated: Type.Boolean(),
  }),
  requires: { project: "viewer", from: "input" },
  http: { method: "GET", path: "/api/v1/decisions" },
  mcp: { tool: "aos_decision_list" },
  ui: { route: "/projects/{projectId}/governance/decisions", control: "decision.list" },
  byteBudget: LIST_BYTE_BUDGET,
  handler: async ({ client }, input) => {
    await requireGovernance(client, input.projectId);
    const limit = input.limit ?? 50;
    const digest = filterDigest({
      projectId: input.projectId, outcomeClass: input.outcomeClass,
      sourceId: input.sourceId, currentOnly: input.currentOnly,
    });

    const params: unknown[] = [];
    const push = (value: unknown): string => {
      params.push(value);
      return `$${params.length}`;
    };
    const where: string[] = [`d.project_id = ${push(input.projectId)}`];
    if (input.outcomeClass) where.push(`d.outcome_class = ${push(input.outcomeClass)}`);
    if (input.sourceId) where.push(`d.source_id = ${push(input.sourceId)}`);
    if (input.currentOnly) {
      where.push("NOT EXISTS (SELECT 1 FROM decision s WHERE s.supersedes_id = d.id)");
    }

    if (input.cursor) {
      const cursor = decodeCursor(input.cursor, {
        schemaVersion: DECISION_LIST_SCHEMA_VERSION,
        sortVersion: DECISION_LIST_SORT_VERSION,
        filterDigest: digest,
        limit,
      });
      where.push(`(d.decided_at, d.id) < (${push(cursor.last.sortKey)}::timestamptz, ${push(cursor.last.id)})`);
    }

    const whereSql = where.join(" AND ");
    const totalResult = await client.query<{ count: string }>(
      `SELECT count(*) AS count FROM decision d WHERE ${whereSql}`,
      params,
    );
    const total = Number(totalResult.rows[0]?.count ?? 0);

    const rows = await client.query<DecisionRow>(
      `${SELECT_DECISION} WHERE ${whereSql} ORDER BY d.decided_at DESC, d.id ASC LIMIT ${push(limit + 1)}`,
      params,
    );

    const page = rows.rows.slice(0, limit);
    const hasMore = rows.rows.length > limit;
    const last = page.at(-1);
    const nextCursor =
      hasMore && last
        ? encodeCursor({
            schemaVersion: DECISION_LIST_SCHEMA_VERSION,
            sortVersion: DECISION_LIST_SORT_VERSION,
            filterDigest: digest,
            limit,
            last: { sortKey: last.decided_at.toISOString(), id: last.id },
          })
        : null;

    return enforceResponseBudget(
      { items: page.map(toDecisionShape), nextCursor, total, truncated: hasMore },
      LIST_BYTE_BUDGET,
      total,
    ) as never;
  },
});
