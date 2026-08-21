import { Type } from "@sinclair/typebox";
import type pg from "pg";
import { newId } from "../../../store/src/ids.js";
import { toQuery } from "../../../store/src/search-text.js";
import { changedFields, notifyWatchers, recordActivity, upsertSearchDoc, writeRevision } from "../audit.js";
import { fail } from "../errors.js";
import { decodeCursor, encodeCursor, enforceResponseBudget, filterDigest } from "../read.js";
import { defineOperation } from "../registry.js";

const KINDS = ["initiative", "epic", "story", "subtask", "review", "incident", "release"] as const;
const STATUSES = ["planned", "ready", "active", "blocked", "pending_acceptance", "done", "cancelled"] as const;
const RELATIONS = [
  "blocks", "blocked_by", "depends_on", "relates_to", "duplicates", "supersedes",
  "split_from", "caused_by", "implements", "verifies", "reviews", "refreshes",
] as const;

const LIST_SCHEMA_VERSION = "aos.work.list.v1";
const LIST_SORT_VERSION = "updated-desc-id-asc-v1";

const KindEnum = Type.Union(KINDS.map((kind) => Type.Literal(kind)));
const StatusEnum = Type.Union(STATUSES.map((status) => Type.Literal(status)));

const WorkItemShape = Type.Object({
  id: Type.String(),
  key: Type.String(),
  projectId: Type.String(),
  kind: Type.String(),
  parentId: Type.Union([Type.String(), Type.Null()]),
  title: Type.String(),
  bodyMd: Type.String(),
  status: Type.String(),
  assigneeId: Type.Union([Type.String(), Type.Null()]),
  assigneeHandle: Type.Union([Type.String(), Type.Null()]),
  reporterId: Type.Union([Type.String(), Type.Null()]),
  priority: Type.String(),
  labels: Type.Array(Type.String()),
  version: Type.Integer(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
  closedAt: Type.Union([Type.String(), Type.Null()]),
});

interface WorkRow {
  id: string;
  key: string;
  project_id: string;
  kind: string;
  parent_id: string | null;
  title: string;
  body_md: string;
  status: string;
  assignee_id: string | null;
  assignee_handle?: string | null;
  reporter_id: string | null;
  priority: string;
  version: number;
  created_at: Date;
  updated_at: Date;
  closed_at: Date | null;
  labels?: string[] | null;
}

function toShape(row: WorkRow): Record<string, unknown> {
  return {
    id: row.id,
    key: row.key,
    projectId: row.project_id,
    kind: row.kind,
    parentId: row.parent_id,
    title: row.title,
    bodyMd: row.body_md,
    status: row.status,
    assigneeId: row.assignee_id,
    assigneeHandle: row.assignee_handle ?? null,
    reporterId: row.reporter_id,
    priority: row.priority,
    labels: (row.labels ?? []).filter((label): label is string => typeof label === "string"),
    version: row.version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    closedAt: row.closed_at ? row.closed_at.toISOString() : null,
  };
}

const SELECT_WORK = `
  SELECT w.id, w.key, w.project_id, w.kind, w.parent_id, w.title, w.body_md, w.status,
         w.assignee_id, a.handle AS assignee_handle, w.reporter_id, w.priority,
         w.version, w.created_at, w.updated_at, w.closed_at,
         coalesce(array_agg(l.name) FILTER (WHERE l.name IS NOT NULL), '{}') AS labels
    FROM work_item w
    LEFT JOIN principal a ON a.id = w.assignee_id
    LEFT JOIN work_item_label wl ON wl.work_item_id = w.id
    LEFT JOIN label l ON l.id = wl.label_id
`;

async function loadWork(client: pg.PoolClient, idOrKey: string): Promise<WorkRow> {
  const result = await client.query<WorkRow>(
    `${SELECT_WORK} WHERE (w.id = $1 OR w.key = upper($1)) AND w.deleted_at IS NULL
      GROUP BY w.id, a.handle`,
    [idOrKey],
  );
  const row = result.rows[0];
  if (!row) fail("not_found", "No such work item", { ref: idOrKey });
  return row;
}

export const createWorkItem = defineOperation({
  id: "work_item.create",
  kind: "command",
  summary: "Create a work item",
  input: Type.Object({
    projectId: Type.String({ minLength: 1 }),
    kind: KindEnum,
    title: Type.String({ minLength: 1, maxLength: 400 }),
    bodyMd: Type.Optional(Type.String({ maxLength: 200_000, default: "" })),
    parentId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    status: Type.Optional(StatusEnum),
    priority: Type.Optional(Type.Union([
      Type.Literal("urgent"), Type.Literal("high"), Type.Literal("normal"), Type.Literal("low"),
    ])),
    assigneeId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  }),
  output: WorkItemShape,
  requires: { project: "contributor", from: "input" },
  http: { method: "POST", path: "/api/v1/work-items" },
  mcp: { tool: "aos_work_item_create" },
  ui: { route: "/work-items/new", control: "work_item.create" },
  handler: async ({ client, actor }, input) => {
    const projectResult = await client.query<{ key: string }>(
      "SELECT key FROM project WHERE id = $1 AND deleted_at IS NULL",
      [input.projectId],
    );
    const projectKey = projectResult.rows[0]?.key;
    if (!projectKey) fail("not_found", "No such project");

    if (input.parentId) {
      const parent = await client.query<{ project_id: string }>(
        "SELECT project_id FROM work_item WHERE id = $1 AND deleted_at IS NULL",
        [input.parentId],
      );
      const parentProject = parent.rows[0]?.project_id;
      if (!parentProject) fail("not_found", "No such parent work item");
      if (parentProject !== input.projectId) {
        fail("validation_failed", "A work item's parent must be in the same project");
      }
    }

    // Allocated inside this transaction, so two concurrent creates cannot mint the same
    // human-readable key.
    const seqResult = await client.query<{ next_seq: string }>(
      "UPDATE key_sequence SET next_seq = next_seq + 1 WHERE project_id = $1 RETURNING next_seq - 1 AS next_seq",
      [input.projectId],
    );
    const seq = Number(seqResult.rows[0]?.next_seq ?? 1);
    const id = newId("wi");
    const key = `${projectKey}-${seq}`;

    await client.query(
      `INSERT INTO work_item (id, project_id, seq, key, kind, parent_id, title, body_md, status, assignee_id, reporter_id, priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        id, input.projectId, seq, key, input.kind, input.parentId ?? null,
        input.title, input.bodyMd ?? "", input.status ?? "planned",
        input.assigneeId ?? null, actor.principalId, input.priority ?? "normal",
      ],
    );
    // The reporter watches what they created; otherwise nobody hears about their own item.
    await client.query(
      "INSERT INTO watcher (subject_type, subject_id, principal_id) VALUES ('work_item', $1, $2) ON CONFLICT DO NOTHING",
      [id, actor.principalId],
    );
    await recordActivity(client, actor, {
      action: "created",
      subjectType: "work_item",
      subjectId: id,
      projectId: input.projectId,
    });
    await upsertSearchDoc(client, {
      subjectType: "work_item",
      subjectId: id,
      projectId: input.projectId,
      title: `${key} ${input.title}`,
      body: input.bodyMd ?? "",
      key,
      status: input.status ?? "planned",
    });
    return toShape(await loadWork(client, id)) as never;
  },
});

export const getWorkItem = defineOperation({
  id: "work_item.get",
  kind: "query",
  summary: "Read one work item",
  input: Type.Object({ key: Type.String({ minLength: 1 }) }),
  output: Type.Intersect([
    WorkItemShape,
    Type.Object({
      ancestors: Type.Array(Type.Object({ key: Type.String(), title: Type.String() })),
      children: Type.Array(Type.Object({ key: Type.String(), title: Type.String(), status: Type.String(), kind: Type.String() })),
      relations: Type.Array(Type.Object({
        id: Type.String(),
        direction: Type.String(),
        relation: Type.String(),
        otherKey: Type.String(),
        otherTitle: Type.String(),
        otherStatus: Type.String(),
      })),
      openGates: Type.Array(Type.Object({ id: Type.String(), title: Type.String(), status: Type.String(), outcomeClass: Type.String() })),
    }),
  ]),
  requires: "authenticated",
  http: { method: "GET", path: "/api/v1/work-items/{key}" },
  mcp: { tool: "aos_work_item_get" },
  ui: { route: "/work-items/{key}", control: "work_item.get" },
  handler: async ({ client, actor }, input) => {
    const row = await loadWork(client, input.key);
    // Every sibling read scopes by membership; this one did not, so any signed-in
    // principal could read every work item in every project by guessing a key.
    requireProjectRole(actor, row.project_id, "viewer");

    const ancestors = await client.query<{ key: string; title: string }>(
      `WITH RECURSIVE up AS (
         SELECT id, parent_id, key, title, 0 AS depth FROM work_item WHERE id = $1
         UNION ALL
         SELECT w.id, w.parent_id, w.key, w.title, up.depth + 1
           FROM work_item w JOIN up ON w.id = up.parent_id WHERE up.depth < 12
       )
       SELECT key, title FROM up WHERE depth > 0 ORDER BY depth DESC`,
      [row.id],
    );

    const children = await client.query<{ key: string; title: string; status: string; kind: string }>(
      "SELECT key, title, status, kind FROM work_item WHERE parent_id = $1 AND deleted_at IS NULL ORDER BY seq",
      [row.id],
    );

    // Read from both ends. Showing only outbound links is how a blocked item comes to
    // look unblocked on its own page.
    const relations = await client.query(
      `SELECT r.id, 'outbound' AS direction, r.relation, o.key AS other_key, o.title AS other_title, o.status AS other_status
         FROM relation r JOIN work_item o ON o.id = r.to_id
        WHERE r.from_id = $1 AND o.deleted_at IS NULL
       UNION ALL
       SELECT r.id, 'inbound' AS direction, r.relation, o.key, o.title, o.status
         FROM relation r JOIN work_item o ON o.id = r.from_id
        WHERE r.to_id = $1 AND o.deleted_at IS NULL
       ORDER BY 2, 3`,
      [row.id],
    );

    const gates = await client.query(
      "SELECT id, title, status, outcome_class FROM gate WHERE work_item_id = $1 ORDER BY created_at",
      [row.id],
    );

    return {
      ...toShape(row),
      ancestors: ancestors.rows,
      children: children.rows,
      relations: relations.rows.map((r) => ({
        id: r.id,
        direction: r.direction,
        relation: r.relation,
        otherKey: r.other_key,
        otherTitle: r.other_title,
        otherStatus: r.other_status,
      })),
      openGates: gates.rows.map((g) => ({
        id: g.id, title: g.title, status: g.status, outcomeClass: g.outcome_class,
      })),
    } as never;
  },
});

export const listWorkItems = defineOperation({
  id: "work_item.list",
  kind: "query",
  summary: "List work items with filters",
  input: Type.Object({
    projectId: Type.Optional(Type.String()),
    kind: Type.Optional(KindEnum),
    status: Type.Optional(StatusEnum),
    assigneeId: Type.Optional(Type.String()),
    label: Type.Optional(Type.String()),
    priority: Type.Optional(Type.String()),
    parentId: Type.Optional(Type.String()),
    q: Type.Optional(Type.String({ maxLength: 200 })),
    open: Type.Optional(Type.Boolean()),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200, default: 50 })),
    cursor: Type.Optional(Type.String()),
  }),
  output: Type.Object({
    items: Type.Array(WorkItemShape),
    nextCursor: Type.Union([Type.String(), Type.Null()]),
    total: Type.Integer(),
    truncated: Type.Boolean(),
  }),
  requires: "authenticated",
  http: { method: "GET", path: "/api/v1/work-items" },
  mcp: { tool: "aos_work_item_list" },
  ui: { route: "/work-items", control: "work_item.list" },
  byteBudget: 1_048_576,
  handler: async ({ client, actor }, input) => {
    const limit = input.limit ?? 50;
    const filters = {
      projectId: input.projectId, kind: input.kind, status: input.status,
      assigneeId: input.assigneeId, label: input.label, priority: input.priority,
      parentId: input.parentId, q: input.q, open: input.open,
    };
    const digest = filterDigest(filters as Record<string, unknown>);

    const where: string[] = ["w.deleted_at IS NULL"];
    const params: unknown[] = [];
    const push = (value: unknown): string => {
      params.push(value);
      return `$${params.length}`;
    };

    // A viewer sees the projects they are a member of. An instance admin sees everything;
    // without that the person who can create a project cannot list what is in it.
    if (!actor.isInstanceAdmin) {
      where.push(
        `w.project_id IN (SELECT project_id FROM project_member WHERE principal_id = ${push(actor.principalId)})`,
      );
    }
    if (input.projectId) where.push(`w.project_id = ${push(input.projectId)}`);
    if (input.kind) where.push(`w.kind = ${push(input.kind)}`);
    if (input.status) where.push(`w.status = ${push(input.status)}`);
    if (input.assigneeId) where.push(`w.assignee_id = ${push(input.assigneeId)}`);
    if (input.priority) where.push(`w.priority = ${push(input.priority)}`);
    if (input.parentId) where.push(`w.parent_id = ${push(input.parentId)}`);
    if (input.open) where.push("w.status NOT IN ('done','cancelled')");
    if (input.label) {
      where.push(
        `EXISTS (SELECT 1 FROM work_item_label wl2 JOIN label l2 ON l2.id = wl2.label_id
                  WHERE wl2.work_item_id = w.id AND lower(l2.name) = lower(${push(input.label)}))`,
      );
    }
    if (input.q) {
      where.push(
        `EXISTS (SELECT 1 FROM search_doc sd WHERE sd.subject_type = 'work_item' AND sd.subject_id = w.id
                  AND sd.search_vec @@ to_tsquery('simple', ${push(cjkQuery(input.q))}))`,
      );
    }

    if (input.cursor) {
      const cursor = decodeCursor(input.cursor, {
        schemaVersion: LIST_SCHEMA_VERSION,
        sortVersion: LIST_SORT_VERSION,
        filterDigest: digest,
        limit,
      });
      // The sort is `updated_at DESC, id ASC`, so the next page is everything strictly
      // older, plus — among rows sharing the cursor's timestamp — those with a LARGER id.
      // A row-wise `(a, b) < (x, y)` compares BOTH columns ascending and silently drops
      // every tied row whose id sorts after the cursor's, which is most of them when a
      // transaction writes several rows with one `now()`.
      const cursorTime = push(cursor.last.sortKey);
      const cursorId = push(cursor.last.id);
      where.push(
        `(w.updated_at < ${cursorTime}::timestamptz OR (w.updated_at = ${cursorTime}::timestamptz AND w.id > ${cursorId}))`,
      );
    }

    const whereSql = where.join(" AND ");
    const totalResult = await client.query<{ count: string }>(
      `SELECT count(*) AS count FROM work_item w WHERE ${whereSql}`,
      params,
    );
    const total = Number(totalResult.rows[0]?.count ?? 0);

    const rows = await client.query<WorkRow>(
      `${SELECT_WORK} WHERE ${whereSql}
        GROUP BY w.id, a.handle
        ORDER BY w.updated_at DESC, w.id ASC
        LIMIT ${push(limit + 1)}`,
      params,
    );

    const page = rows.rows.slice(0, limit);
    const hasMore = rows.rows.length > limit;
    const last = page.at(-1);
    const nextCursor =
      hasMore && last
        ? encodeCursor({
            schemaVersion: LIST_SCHEMA_VERSION,
            sortVersion: LIST_SORT_VERSION,
            filterDigest: digest,
            limit,
            last: { sortKey: last.updated_at.toISOString(), id: last.id },
          })
        : null;

    const body = {
      items: page.map(toShape),
      nextCursor,
      total,
      // Stated, never silent. A list that shows fewer rows than exist says so.
      truncated: hasMore,
    };
    return enforceResponseBudget(body, 1_048_576, total) as never;
  },
});

/**
 * The same emitter the write path uses, so the index and the query can never drift.
 * A query that tokenises to nothing must match nothing — never everything.
 */
function cjkQuery(text: string): string {
  return toQuery(text) ?? "zzzz_no_such_lexeme_zzzz";
}

export const updateWorkItem = defineOperation({
  id: "work_item.update",
  kind: "command",
  summary: "Edit a work item's fields",
  input: Type.Object({
    key: Type.String({ minLength: 1 }),
    expectedVersion: Type.Integer({ minimum: 1 }),
    title: Type.Optional(Type.String({ minLength: 1, maxLength: 400 })),
    bodyMd: Type.Optional(Type.String({ maxLength: 200_000 })),
    assigneeId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    priority: Type.Optional(Type.String()),
    parentId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  }),
  output: WorkItemShape,
  requires: "authenticated",
  http: { method: "POST", path: "/api/v1/work-items/{key}/update" },
  mcp: { tool: "aos_work_item_update" },
  ui: { route: "/work-items/{key}", control: "work_item.update" },
  handler: async ({ client, actor }, input) => {
    const row = await loadWork(client, input.key);
    requireProjectRole(actor, row.project_id, "contributor");
    if (row.version !== input.expectedVersion) {
      fail("stale_version", "Someone else changed this item while you were editing", {
        currentVersion: row.version,
        yourVersion: input.expectedVersion,
      });
    }
    const before = {
      title: row.title, bodyMd: row.body_md, assigneeId: row.assignee_id,
      priority: row.priority, parentId: row.parent_id,
    };
    const after = {
      title: input.title ?? row.title,
      bodyMd: input.bodyMd ?? row.body_md,
      assigneeId: input.assigneeId === undefined ? row.assignee_id : input.assigneeId,
      priority: input.priority ?? row.priority,
      parentId: input.parentId === undefined ? row.parent_id : input.parentId,
    };
    if (after.parentId === row.id) fail("validation_failed", "A work item cannot be its own parent");

    const changed = changedFields(before, after);
    if (changed.length === 0) return toShape(row) as never;

    const revisionId = await writeRevision(
      client,
      { table: "work_item_revision", idColumn: "work_item_id" },
      row.id,
      row.version,
      before,
      actor,
    );
    await client.query(
      `UPDATE work_item SET title = $1, body_md = $2, assignee_id = $3, priority = $4, parent_id = $5,
              version = version + 1, updated_at = now()
        WHERE id = $6`,
      [after.title, after.bodyMd, after.assigneeId, after.priority, after.parentId, row.id],
    );
    await recordActivity(client, actor, {
      action: "updated",
      subjectType: "work_item",
      subjectId: row.id,
      projectId: row.project_id,
      fieldNames: changed,
      revisionRef: revisionId,
    });
    await upsertSearchDoc(client, {
      subjectType: "work_item",
      subjectId: row.id,
      projectId: row.project_id,
      title: `${row.key} ${after.title}`,
      body: after.bodyMd,
      key: row.key,
      status: row.status,
    });
    await notifyWatchers(client, actor, {
      subjectType: "work_item",
      subjectId: row.id,
      subjectLabel: `${row.key} ${after.title}`,
      kind: "work_item_updated",
      extraPrincipalIds: after.assigneeId && after.assigneeId !== before.assigneeId ? [after.assigneeId] : [],
    });
    return toShape(await loadWork(client, row.id)) as never;
  },
});

function requireProjectRole(
  actor: import("../actor.js").Actor,
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

export const transitionWorkItem = defineOperation({
  id: "work_item.transition",
  kind: "command",
  summary: "Move a work item to another status",
  input: Type.Object({
    key: Type.String({ minLength: 1 }),
    expectedVersion: Type.Integer({ minimum: 1 }),
    status: StatusEnum,
  }),
  output: WorkItemShape,
  requires: "authenticated",
  http: { method: "POST", path: "/api/v1/work-items/{key}/transition" },
  mcp: { tool: "aos_work_item_transition" },
  ui: { route: "/work-items/{key}", control: "work_item.transition" },
  handler: async ({ client, actor }, input) => {
    const row = await loadWork(client, input.key);
    requireProjectRole(actor, row.project_id, "contributor");
    if (row.version !== input.expectedVersion) {
      fail("stale_version", "Someone else changed this item while you were editing", {
        currentVersion: row.version,
      });
    }
    if (row.status === input.status) return toShape(row) as never;

    // The permitted set lives in data, and a project may narrow it.
    const permitted = await client.query(
      `SELECT 1 FROM status_transition
        WHERE from_status = $1 AND to_status = $2
          AND (project_id = $3 OR project_id IS NULL)
        LIMIT 1`,
      [row.status, input.status, row.project_id],
    );
    if (permitted.rowCount === 0) {
      const options = await client.query<{ to_status: string }>(
        `SELECT DISTINCT to_status FROM status_transition
          WHERE from_status = $1 AND (project_id = $2 OR project_id IS NULL) ORDER BY to_status`,
        [row.status, row.project_id],
      );
      fail("transition_not_permitted", `A ${row.status} item cannot move straight to ${input.status}`, {
        from: row.status,
        to: input.status,
        permitted: options.rows.map((option) => option.to_status),
      });
    }

    // A gate blocks the transition it names, and it says which gate and why.
    // Two shapes of gate, and both must bite: one anchored to this item, and one opened on
    // the project as a whole. `gate.create` offers the project-level form in its own summary,
    // and matching only on work_item_id meant that gate sat there pending and stopped nothing.
    const blocking = await client.query<{ id: string; title: string; scope: string }>(
      `SELECT id, title, CASE WHEN work_item_id IS NULL THEN 'project' ELSE 'item' END AS scope
         FROM gate
        WHERE status <> 'satisfied' AND blocks_status = $3
          AND (work_item_id = $1 OR (work_item_id IS NULL AND project_id = $2))`,
      [row.id, row.project_id, input.status],
    );
    if (blocking.rowCount && blocking.rowCount > 0) {
      fail("gate_pending", `This item cannot reach ${input.status} while a gate is unsatisfied`, {
        gates: blocking.rows.map((gate) => ({ id: gate.id, title: gate.title })),
      });
    }

    const revisionId = await writeRevision(
      client,
      { table: "work_item_revision", idColumn: "work_item_id" },
      row.id,
      row.version,
      { status: row.status },
      actor,
    );
    const closing = input.status === "done" || input.status === "cancelled";
    await client.query(
      `UPDATE work_item SET status = $1, closed_at = CASE WHEN $2 THEN now() ELSE NULL END,
              version = version + 1, updated_at = now()
        WHERE id = $3`,
      [input.status, closing, row.id],
    );
    await recordActivity(client, actor, {
      action: `status:${row.status}->${input.status}`,
      subjectType: "work_item",
      subjectId: row.id,
      projectId: row.project_id,
      fieldNames: ["status"],
      revisionRef: revisionId,
    });
    await client.query(
      "UPDATE search_doc SET status = $1 WHERE subject_type = 'work_item' AND subject_id = $2",
      [input.status, row.id],
    );
    await notifyWatchers(client, actor, {
      subjectType: "work_item",
      subjectId: row.id,
      subjectLabel: `${row.key} ${row.title}`,
      kind: "work_item_transitioned",
    });
    return toShape(await loadWork(client, row.id)) as never;
  },
});

export const relateWorkItem = defineOperation({
  id: "work_item.relate",
  kind: "command",
  summary: "Link two work items",
  input: Type.Object({
    key: Type.String({ minLength: 1 }),
    relation: Type.Union(RELATIONS.map((relation) => Type.Literal(relation))),
    otherKey: Type.String({ minLength: 1 }),
  }),
  output: Type.Object({ id: Type.String() }),
  requires: "authenticated",
  http: { method: "POST", path: "/api/v1/work-items/{key}/relations" },
  mcp: { tool: "aos_work_item_relate" },
  ui: { route: "/work-items/{key}", control: "work_item.relate" },
  handler: async ({ client, actor }, input) => {
    const from = await loadWork(client, input.key);
    requireProjectRole(actor, from.project_id, "contributor");
    const to = await loadWork(client, input.otherKey);
    if (from.id === to.id) fail("validation_failed", "A work item cannot relate to itself");
    const id = newId("rel");
    await client.query(
      `INSERT INTO relation (id, from_id, relation, to_id, created_by) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (from_id, relation, to_id) DO NOTHING`,
      [id, from.id, input.relation, to.id, actor.principalId],
    );
    await recordActivity(client, actor, {
      action: `related:${input.relation}`,
      subjectType: "work_item",
      subjectId: from.id,
      projectId: from.project_id,
      fieldNames: ["relations"],
    });
    return { id };
  },
});

export const unrelateWorkItem = defineOperation({
  id: "work_item.unrelate",
  kind: "command",
  summary: "Remove a link between two work items",
  input: Type.Object({ key: Type.String({ minLength: 1 }), relationId: Type.String({ minLength: 1 }) }),
  output: Type.Object({ ok: Type.Boolean() }),
  requires: "authenticated",
  http: { method: "POST", path: "/api/v1/work-items/{key}/relations/remove" },
  mcp: { tool: "aos_work_item_unrelate" },
  ui: { route: "/work-items/{key}", control: "work_item.unrelate" },
  handler: async ({ client, actor }, input) => {
    const from = await loadWork(client, input.key);
    requireProjectRole(actor, from.project_id, "contributor");
    const result = await client.query("DELETE FROM relation WHERE id = $1", [input.relationId]);
    if (result.rowCount === 0) fail("not_found", "No such relation");
    await recordActivity(client, actor, {
      action: "unrelated",
      subjectType: "work_item",
      subjectId: from.id,
      projectId: from.project_id,
      fieldNames: ["relations"],
    });
    return { ok: true };
  },
});

export const setLabels = defineOperation({
  id: "work_item.set_labels",
  kind: "command",
  summary: "Replace a work item's labels",
  input: Type.Object({
    key: Type.String({ minLength: 1 }),
    labels: Type.Array(Type.String({ minLength: 1, maxLength: 60 }), { maxItems: 30 }),
  }),
  output: Type.Object({ labels: Type.Array(Type.String()) }),
  requires: "authenticated",
  http: { method: "POST", path: "/api/v1/work-items/{key}/labels" },
  mcp: { tool: "aos_work_item_set_labels" },
  ui: { route: "/work-items/{key}", control: "work_item.set_labels" },
  handler: async ({ client, actor }, input) => {
    const row = await loadWork(client, input.key);
    requireProjectRole(actor, row.project_id, "contributor");
    const ids: string[] = [];
    for (const name of input.labels) {
      const existing = await client.query<{ id: string }>(
        "SELECT id FROM label WHERE project_id = $1 AND lower(name) = lower($2)",
        [row.project_id, name],
      );
      let labelId = existing.rows[0]?.id;
      if (!labelId) {
        labelId = newId("lb");
        await client.query("INSERT INTO label (id, project_id, name) VALUES ($1, $2, $3)", [
          labelId, row.project_id, name,
        ]);
      }
      ids.push(labelId);
    }
    await client.query("DELETE FROM work_item_label WHERE work_item_id = $1", [row.id]);
    for (const labelId of ids) {
      await client.query(
        "INSERT INTO work_item_label (work_item_id, label_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [row.id, labelId],
      );
    }
    await recordActivity(client, actor, {
      action: "labelled",
      subjectType: "work_item",
      subjectId: row.id,
      projectId: row.project_id,
      fieldNames: ["labels"],
    });
    return { labels: input.labels };
  },
});

export const deleteWorkItem = defineOperation({
  id: "work_item.delete",
  kind: "command",
  summary: "Move a work item to the trash",
  input: Type.Object({ key: Type.String({ minLength: 1 }) }),
  output: Type.Object({ ok: Type.Boolean() }),
  requires: "authenticated",
  http: { method: "POST", path: "/api/v1/work-items/{key}/delete" },
  mcp: { tool: "aos_work_item_delete" },
  ui: { route: "/work-items/{key}", control: "work_item.delete" },
  handler: async ({ client, actor }, input) => {
    const row = await loadWork(client, input.key);
    requireProjectRole(actor, row.project_id, "maintainer");
    // Soft. Thirty days in the trash, restorable, because a product whose delete is
    // irreversible teaches people to hoard.
    await client.query("UPDATE work_item SET deleted_at = now(), version = version + 1 WHERE id = $1", [row.id]);
    await client.query("DELETE FROM search_doc WHERE subject_type = 'work_item' AND subject_id = $1", [row.id]);
    await recordActivity(client, actor, {
      action: "deleted",
      subjectType: "work_item",
      subjectId: row.id,
      projectId: row.project_id,
    });
    return { ok: true };
  },
});

export const restoreWorkItem = defineOperation({
  id: "work_item.restore",
  kind: "command",
  summary: "Restore a work item from the trash",
  input: Type.Object({ key: Type.String({ minLength: 1 }) }),
  output: Type.Object({ ok: Type.Boolean() }),
  requires: "authenticated",
  http: { method: "POST", path: "/api/v1/work-items/{key}/restore" },
  mcp: { tool: "aos_work_item_restore" },
  ui: { route: "/trash", control: "work_item.restore" },
  handler: async ({ client, actor }, input) => {
    const result = await client.query<WorkRow>(
      "UPDATE work_item SET deleted_at = NULL, version = version + 1 WHERE (id = $1 OR key = upper($1)) AND deleted_at IS NOT NULL RETURNING id, project_id, key, title, body_md, status",
      [input.key],
    );
    const row = result.rows[0];
    if (!row) fail("not_found", "No deleted work item with that key");
    requireProjectRole(actor, row.project_id, "maintainer");
    await upsertSearchDoc(client, {
      subjectType: "work_item",
      subjectId: row.id,
      projectId: row.project_id,
      title: `${row.key} ${row.title}`,
      body: row.body_md,
      key: row.key,
      status: row.status,
    });
    await recordActivity(client, actor, {
      action: "restored",
      subjectType: "work_item",
      subjectId: row.id,
      projectId: row.project_id,
    });
    return { ok: true };
  },
});
