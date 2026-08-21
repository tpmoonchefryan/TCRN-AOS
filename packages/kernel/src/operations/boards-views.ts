import { Type } from "@sinclair/typebox";
import type pg from "pg";
import { newId, rankBetween } from "../../../store/src/ids.js";
import { changedFields, notifyWatchers, recordActivity, writeRevision } from "../audit.js";
import { fail } from "../errors.js";
import { decodeCursor, encodeCursor, enforceResponseBudget, filterDigest } from "../read.js";
import { defineOperation } from "../registry.js";

/**
 * A board is a projection of the status column, not a second place work lives. Every card
 * on it is a work_item row, every move through it is the same transition the detail page
 * performs, and nothing here can put an item in a state the rest of the product would
 * refuse.
 *
 * Boards, saved views and labels have no entry in `subject_type`, so none of them can be
 * the subject of an activity row, a watcher, or a search document. Activity for them is
 * recorded against the project that owns them — or against the principal, for a personal
 * view that belongs to no project.
 */

const BOARD_STATUSES = [
  "planned", "ready", "active", "blocked", "pending_acceptance", "done", "cancelled",
] as const;

type BoardStatus = (typeof BOARD_STATUSES)[number];

const COLUMN_NAMES: Record<BoardStatus, string> = {
  planned: "Planned",
  ready: "Ready",
  active: "Active",
  blocked: "Blocked",
  pending_acceptance: "Pending acceptance",
  done: "Done",
  cancelled: "Cancelled",
};

const StatusEnum = Type.Union(BOARD_STATUSES.map((status) => Type.Literal(status)));

const SAVED_VIEW_SCHEMA_VERSION = "aos.saved_view.list.v1";
const SAVED_VIEW_SORT_VERSION = "position-asc-id-asc-v1";
const LABEL_SCHEMA_VERSION = "aos.label.list.v1";
const LABEL_SORT_VERSION = "name-asc-id-asc-v1";

/** How many cards a single column returns before it says it is holding some back. */
const DEFAULT_CARD_LIMIT = 200;

const BoardCardShape = Type.Object({
  id: Type.String(),
  key: Type.String(),
  title: Type.String(),
  kind: Type.String(),
  status: Type.String(),
  priority: Type.String(),
  assigneeHandle: Type.Union([Type.String(), Type.Null()]),
  labels: Type.Array(Type.String()),
  rank: Type.String(),
  version: Type.Integer(),
});

const BoardColumnShape = Type.Object({
  /** Null on a synthesised column: it is drawn, not stored. */
  id: Type.Union([Type.String(), Type.Null()]),
  name: Type.String(),
  status: Type.String(),
  position: Type.Integer(),
  items: Type.Array(BoardCardShape),
  total: Type.Integer(),
  truncated: Type.Boolean(),
});

const SavedViewShape = Type.Object({
  id: Type.String(),
  projectId: Type.Union([Type.String(), Type.Null()]),
  ownerId: Type.Union([Type.String(), Type.Null()]),
  name: Type.String(),
  isShared: Type.Boolean(),
  position: Type.Integer(),
  version: Type.Integer(),
  /** The permalink. A view whose address is its id opens the same list for whoever follows it. */
  href: Type.String(),
  mine: Type.Boolean(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

interface CardRow {
  id: string;
  key: string;
  project_id: string;
  title: string;
  kind: string;
  status: string;
  priority: string;
  rank: string;
  version: number;
  assignee_handle: string | null;
  labels: string[] | null;
}

interface SavedViewRow {
  id: string;
  project_id: string | null;
  owner_id: string | null;
  name: string;
  query: Record<string, unknown>;
  is_shared: boolean;
  position: number;
  version: number;
  created_at: Date;
  updated_at: Date;
}

const SELECT_CARD = `
  SELECT w.id, w.key, w.project_id, w.title, w.kind, w.status, w.priority, w.rank, w.version,
         a.handle AS assignee_handle,
         coalesce(array_agg(l.name) FILTER (WHERE l.name IS NOT NULL), '{}') AS labels
    FROM work_item w
    LEFT JOIN principal a ON a.id = w.assignee_id
    LEFT JOIN work_item_label wl ON wl.work_item_id = w.id
    LEFT JOIN label l ON l.id = wl.label_id
`;

function toCard(row: CardRow): Record<string, unknown> {
  return {
    id: row.id,
    key: row.key,
    title: row.title,
    kind: row.kind,
    status: row.status,
    priority: row.priority,
    assigneeHandle: row.assignee_handle ?? null,
    labels: (row.labels ?? []).filter((label): label is string => typeof label === "string"),
    rank: row.rank,
    version: row.version,
  };
}

async function loadCard(client: pg.PoolClient, idOrKey: string): Promise<CardRow> {
  const result = await client.query<CardRow>(
    `${SELECT_CARD} WHERE (w.id = $1 OR w.key = upper($1)) AND w.deleted_at IS NULL
      GROUP BY w.id, a.handle`,
    [idOrKey],
  );
  const row = result.rows[0];
  if (!row) fail("not_found", "No such card", { ref: idOrKey });
  return row;
}

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

export const createBoard = defineOperation({
  id: "board.create",
  kind: "command",
  summary: "Create a board for a project",
  input: Type.Object({
    projectId: Type.String({ minLength: 1 }),
    name: Type.String({ minLength: 1, maxLength: 200 }),
  }),
  output: Type.Object({
    id: Type.String(),
    projectId: Type.String(),
    name: Type.String(),
    columns: Type.Array(
      Type.Object({
        id: Type.String(),
        name: Type.String(),
        status: Type.String(),
        position: Type.Integer(),
      }),
    ),
  }),
  requires: { project: "maintainer", from: "input" },
  http: { method: "POST", path: "/api/v1/boards" },
  mcp: { tool: "aos_board_create" },
  ui: { route: "/board", control: "board.create" },
  handler: async ({ client, actor }, input) => {
    const project = await client.query<{ id: string }>(
      "SELECT id FROM project WHERE id = $1 AND deleted_at IS NULL",
      [input.projectId],
    );
    if (!project.rows[0]) fail("not_found", "No such project");

    const boardId = newId("bd");
    await client.query("INSERT INTO board (id, project_id, name) VALUES ($1, $2, $3)", [
      boardId, input.projectId, input.name,
    ]);

    // One column per status, in the order the statuses are declared. A board that omits a
    // status hides every item sitting in it, and the person reading the board has no way
    // to tell the difference between "none" and "not drawn".
    const columns: { id: string; name: string; status: string; position: number }[] = [];
    for (const [position, status] of BOARD_STATUSES.entries()) {
      const columnId = newId("bc");
      await client.query(
        "INSERT INTO board_column (id, board_id, name, status, position) VALUES ($1, $2, $3, $4, $5)",
        [columnId, boardId, COLUMN_NAMES[status], status, position],
      );
      columns.push({ id: columnId, name: COLUMN_NAMES[status], status, position });
    }

    await recordActivity(client, actor, {
      action: "board_created",
      subjectType: "project",
      subjectId: input.projectId,
      projectId: input.projectId,
      fieldNames: ["boards"],
    });
    return { id: boardId, projectId: input.projectId, name: input.name, columns };
  },
});

export const getBoard = defineOperation({
  id: "board.get",
  kind: "query",
  summary: "Read a project's board with its cards",
  input: Type.Object({
    projectId: Type.String({ minLength: 1 }),
    boardId: Type.Optional(Type.String()),
    cardLimit: Type.Optional(Type.Integer({ minimum: 1, maximum: 500, default: DEFAULT_CARD_LIMIT })),
  }),
  output: Type.Object({
    boardId: Type.Union([Type.String(), Type.Null()]),
    projectId: Type.String(),
    name: Type.String(),
    /** True when the columns were drawn from the default statuses rather than read from a row. */
    synthesised: Type.Boolean(),
    columns: Type.Array(BoardColumnShape),
    truncated: Type.Boolean(),
  }),
  requires: { project: "viewer", from: "input" },
  http: { method: "GET", path: "/api/v1/projects/{projectId}/board" },
  mcp: { tool: "aos_board_get" },
  ui: { route: "/board", control: "board.get" },
  byteBudget: 1_048_576,
  handler: async ({ client }, input) => {
    const cardLimit = input.cardLimit ?? DEFAULT_CARD_LIMIT;

    let boardId: string | null = null;
    let name = "Board";
    if (input.boardId) {
      const found = await client.query<{ id: string; name: string; project_id: string }>(
        "SELECT id, name, project_id FROM board WHERE id = $1",
        [input.boardId],
      );
      const row = found.rows[0];
      if (!row) fail("not_found", "No such board");
      // The role was checked against projectId. A board id belonging to another project
      // would otherwise read that project's columns on this project's authority.
      if (row.project_id !== input.projectId) fail("not_found", "No such board on that project");
      boardId = row.id;
      name = row.name;
    } else {
      const found = await client.query<{ id: string; name: string }>(
        "SELECT id, name FROM board WHERE project_id = $1 ORDER BY created_at, id LIMIT 1",
        [input.projectId],
      );
      const row = found.rows[0];
      if (row) {
        boardId = row.id;
        name = row.name;
      }
    }

    let columns: { id: string | null; name: string; status: string; position: number }[] = [];
    if (boardId) {
      const stored = await client.query<{ id: string; name: string; status: string; position: number }>(
        "SELECT id, name, status, position FROM board_column WHERE board_id = $1 ORDER BY position",
        [boardId],
      );
      columns = stored.rows.map((row) => ({ ...row }));
    }

    // A project should not need setup before its board works, so an absent board is
    // answered with the default shape rather than a refusal. Nothing is written here: the
    // first drag is soon enough to persist one.
    const synthesised = columns.length === 0;
    if (synthesised) {
      columns = BOARD_STATUSES.map((status, position) => ({
        id: null,
        name: COLUMN_NAMES[status],
        status,
        position,
      }));
    }

    const statuses = [...new Set(columns.map((column) => column.status))];
    // One query for the whole board, capped per column by the window function rather than
    // by a LIMIT that would spend the whole budget on the first column.
    const cards = await client.query<CardRow & { status_total: string }>(
      `WITH card AS (
         SELECT w.id, w.key, w.project_id, w.title, w.kind, w.status, w.priority, w.rank, w.version,
                a.handle AS assignee_handle,
                coalesce(array_agg(l.name) FILTER (WHERE l.name IS NOT NULL), '{}') AS labels
           FROM work_item w
           LEFT JOIN principal a ON a.id = w.assignee_id
           LEFT JOIN work_item_label wl ON wl.work_item_id = w.id
           LEFT JOIN label l ON l.id = wl.label_id
          WHERE w.project_id = $1 AND w.deleted_at IS NULL AND w.status = ANY($2::text[])
          GROUP BY w.id, a.handle
       ), ranked AS (
         SELECT card.*,
                row_number() OVER (PARTITION BY card.status ORDER BY card.rank, card.id) AS rn,
                count(*) OVER (PARTITION BY card.status) AS status_total
           FROM card
       )
       SELECT * FROM ranked WHERE rn <= $3 ORDER BY status, rn`,
      [input.projectId, statuses, cardLimit],
    );

    const byStatus = new Map<string, CardRow[]>();
    const totals = new Map<string, number>();
    for (const row of cards.rows) {
      const bucket = byStatus.get(row.status);
      if (bucket) bucket.push(row);
      else byStatus.set(row.status, [row]);
      totals.set(row.status, Number(row.status_total));
    }

    let truncated = false;
    const rendered = columns.map((column) => {
      const items = byStatus.get(column.status) ?? [];
      const total = totals.get(column.status) ?? 0;
      const short = items.length < total;
      if (short) truncated = true;
      return {
        id: column.id,
        name: column.name,
        status: column.status,
        position: column.position,
        items: items.map(toCard),
        total,
        // Stated, never silent. A column that is holding cards back says how many exist.
        truncated: short,
      };
    });

    const body = {
      boardId,
      projectId: input.projectId,
      name,
      synthesised,
      columns: rendered,
      truncated,
    };
    return enforceResponseBudget(body, 1_048_576, cards.rows.length) as never;
  },
});

export const moveBoardCard = defineOperation({
  id: "board.move",
  kind: "command",
  summary: "Move a card to another column and rank it against its neighbours",
  input: Type.Object({
    key: Type.String({ minLength: 1 }),
    expectedVersion: Type.Integer({ minimum: 1 }),
    toStatus: StatusEnum,
    /** The card the moved one lands below. Absent means the top of the column. */
    beforeKey: Type.Optional(Type.String()),
    /** The card the moved one lands above. Absent means the bottom of the column. */
    afterKey: Type.Optional(Type.String()),
  }),
  output: BoardCardShape,
  requires: "authenticated",
  http: { method: "POST", path: "/api/v1/boards/move" },
  mcp: { tool: "aos_board_move" },
  ui: { route: "/board", control: "board.move" },
  handler: async ({ client, actor }, input) => {
    const row = await loadCard(client, input.key);
    requireProjectRole(actor, row.project_id, "contributor");
    if (row.version !== input.expectedVersion) {
      fail("stale_version", "Someone else changed this card while you were dragging it", {
        currentVersion: row.version,
        yourVersion: input.expectedVersion,
      });
    }

    const statusChanged = row.status !== input.toStatus;
    if (statusChanged) {
      // The same two checks work_item.transition makes, in the same order, with the same
      // reason codes. A drag that can reach a status the detail page refuses is two rules
      // for one thing, and the one people trust is whichever they tried last.
      const permitted = await client.query(
        `SELECT 1 FROM status_transition
          WHERE from_status = $1 AND to_status = $2
            AND (project_id = $3 OR project_id IS NULL)
          LIMIT 1`,
        [row.status, input.toStatus, row.project_id],
      );
      if (permitted.rowCount === 0) {
        const options = await client.query<{ to_status: string }>(
          `SELECT DISTINCT to_status FROM status_transition
            WHERE from_status = $1 AND (project_id = $2 OR project_id IS NULL) ORDER BY to_status`,
          [row.status, row.project_id],
        );
        fail("transition_not_permitted", `A ${row.status} item cannot move straight to ${input.toStatus}`, {
          from: row.status,
          to: input.toStatus,
          permitted: options.rows.map((option) => option.to_status),
        });
      }

      // Same two shapes as the detail page: an item's own gate and the project's. A board
      // that can reach a status the detail page refuses is two rules for one thing, and the
      // one people find is whichever they tried first.
      const blocking = await client.query<{ id: string; title: string }>(
        `SELECT id, title FROM gate
          WHERE status <> 'satisfied' AND blocks_status = $3
            AND (work_item_id = $1 OR (work_item_id IS NULL AND project_id = $2))`,
        [row.id, row.project_id, input.toStatus],
      );
      if (blocking.rowCount && blocking.rowCount > 0) {
        fail("gate_pending", `This item cannot reach ${input.toStatus} while a gate is unsatisfied`, {
          gates: blocking.rows.map((gate) => ({ id: gate.id, title: gate.title })),
        });
      }
    }

    let above = await neighbourRank(client, row, input.beforeKey);
    let below = await neighbourRank(client, row, input.afterKey);
    if (above !== null && below !== null && above >= below) {
      // Old fixtures and imports can leave adjacent cards with the same rank. Normalize
      // the target column once before asking rankBetween for a slot; otherwise the fallback
      // appends a suffix and the card silently lands at the end.
      await rebalanceColumn(client, row.project_id, input.toStatus);
      above = await neighbourRank(client, row, input.beforeKey);
      below = await neighbourRank(client, row, input.afterKey);
    }
    const rank = rankBetween(above, below);

    const before = { status: row.status, rank: row.rank };
    const after = { status: input.toStatus, rank };
    const changed = changedFields(before, after);
    if (changed.length === 0) return toCard(row) as never;

    const revisionId = await writeRevision(
      client,
      { table: "work_item_revision", idColumn: "work_item_id" },
      row.id,
      row.version,
      before,
      actor,
    );
    if (statusChanged) {
      const closing = input.toStatus === "done" || input.toStatus === "cancelled";
      await client.query(
        `UPDATE work_item SET status = $1, rank = $2, closed_at = CASE WHEN $3 THEN now() ELSE NULL END,
                version = version + 1, updated_at = now()
          WHERE id = $4`,
        [input.toStatus, rank, closing, row.id],
      );
    } else {
      // A reorder inside a column must not restamp closed_at. When an item closed is a
      // fact about the item, not about the last time somebody tidied the Done column.
      await client.query(
        "UPDATE work_item SET rank = $1, version = version + 1, updated_at = now() WHERE id = $2",
        [rank, row.id],
      );
    }

    await recordActivity(client, actor, {
      action: statusChanged ? `status:${row.status}->${input.toStatus}` : "reranked",
      subjectType: "work_item",
      subjectId: row.id,
      projectId: row.project_id,
      fieldNames: changed,
      revisionRef: revisionId,
    });

    if (statusChanged) {
      await client.query(
        "UPDATE search_doc SET status = $1 WHERE subject_type = 'work_item' AND subject_id = $2",
        [input.toStatus, row.id],
      );
      // A status change is news. A nudge up or down a column is not, and sending it
      // teaches people to ignore the ones that were.
      await notifyWatchers(client, actor, {
        subjectType: "work_item",
        subjectId: row.id,
        subjectLabel: `${row.key} ${row.title}`,
        kind: "work_item_transitioned",
      });
    }

    return toCard(await loadCard(client, row.id)) as never;
  },
});

/**
 * A rank is only meaningful against the ranks it was minted between, and those are the
 * ranks of the same project's items. A neighbour from somewhere else produces a string
 * that sorts against nothing and quietly puts the card in an arbitrary place.
 */
async function neighbourRank(
  client: pg.PoolClient,
  moving: CardRow,
  key: string | undefined,
): Promise<string | null> {
  if (key === undefined || key === "") return null;
  const result = await client.query<{ id: string; rank: string; project_id: string }>(
    "SELECT id, rank, project_id FROM work_item WHERE (id = $1 OR key = upper($1)) AND deleted_at IS NULL",
    [key],
  );
  const row = result.rows[0];
  if (!row) fail("not_found", "No such neighbouring card", { ref: key });
  if (row.project_id !== moving.project_id) {
    fail("validation_failed", "A card can only be ranked against a neighbour in the same project", { ref: key });
  }
  if (row.id === moving.id) {
    fail("validation_failed", "A card cannot be ranked against itself", { ref: key });
  }
  return row.rank;
}

async function rebalanceColumn(client: pg.PoolClient, projectId: string, status: BoardStatus): Promise<void> {
  const rows = await client.query<{ id: string; rank: string }>(
    `SELECT id, rank FROM work_item
      WHERE project_id = $1 AND status = $2 AND deleted_at IS NULL
      ORDER BY rank ASC, id ASC
      FOR UPDATE`,
    [projectId, status],
  );
  for (const [index, row] of rows.rows.entries()) {
    const rank = String(index + 1).padStart(12, "0");
    if (row.rank !== rank) {
      await client.query("UPDATE work_item SET rank = $1 WHERE id = $2", [rank, row.id]);
    }
  }
}

function toSavedView(row: SavedViewRow, principalId: string): Record<string, unknown> {
  return {
    id: row.id,
    projectId: row.project_id,
    ownerId: row.owner_id,
    name: row.name,
    query: row.query ?? {},
    isShared: row.is_shared,
    position: row.position,
    version: row.version,
    href: `/views/${row.id}`,
    mine: row.owner_id !== null && row.owner_id === principalId,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export const createSavedView = defineOperation({
  id: "saved_view.create",
  kind: "command",
  summary: "Save a list's filters as a named, linkable view",
  // Named filters, not an arbitrary object.
  //
  // A saved view IS a set of filters, and typing it as one is what lets a person save one
  // from a form. As a free-form object it could only ever be posted by an API client, so
  // the control on /views refused every submission a human could produce — while the gate
  // that replays forms scored the refusal as "reached validation" and stayed green.
  input: Type.Object({
    projectId: Type.Optional(Type.String()),
    name: Type.String({ minLength: 1, maxLength: 200 }),
    project: Type.Optional(Type.String({ maxLength: 64 })),
    kind: Type.Optional(Type.String({ maxLength: 32 })),
    status: Type.Optional(Type.String({ maxLength: 32 })),
    assignee: Type.Optional(Type.String({ maxLength: 64 })),
    label: Type.Optional(Type.String({ maxLength: 64 })),
    q: Type.Optional(Type.String({ maxLength: 200 })),
    isShared: Type.Optional(Type.Boolean({ default: false })),
  }),
  output: SavedViewShape,
  // projectId is optional here — a view can span every project the reader can see — and
  // dispatch's { project, from: "input" } form refuses an input that does not name one.
  // So the role is checked below, where "is there a project at all" is answerable.
  requires: "authenticated",
  http: { method: "POST", path: "/api/v1/saved-views" },
  mcp: { tool: "aos_saved_view_create" },
  ui: { route: "/views", control: "saved_view.create" },
  handler: async ({ client, actor }, input) => {
    const isShared = input.isShared ?? false;
    if (input.projectId) {
      const project = await client.query<{ id: string }>(
        "SELECT id FROM project WHERE id = $1 AND deleted_at IS NULL",
        [input.projectId],
      );
      if (!project.rows[0]) fail("not_found", "No such project");
      // Saving a view for yourself is a reading act; publishing one to everyone on the
      // project is not.
      requireProjectRole(actor, input.projectId, isShared ? "contributor" : "viewer");
    } else if (isShared && !actor.isInstanceAdmin) {
      fail("forbidden", "A view shared across every project is created by an instance administrator");
    }

    const id = newId("sv");
    const result = await client.query<SavedViewRow>(
      `INSERT INTO saved_view (id, project_id, owner_id, name, query, is_shared)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)
       RETURNING id, project_id, owner_id, name, query, is_shared, position, version, created_at, updated_at`,
      [
        id,
        input.projectId ?? null,
        actor.principalId,
        input.name,
        JSON.stringify(
          Object.fromEntries(
            (["project", "kind", "status", "assignee", "label", "q"] as const)
              .map((key) => [key, input[key]])
              .filter(([, value]) => value !== undefined && value !== ""),
          ),
        ),
        isShared,
      ],
    );
    const row = result.rows[0]!;

    // saved_view is not a subject_type, so the act is recorded against the thing that
    // owns the view: the project, or the person when the view belongs to no project.
    await recordActivity(client, actor, {
      action: "saved_view_created",
      subjectType: input.projectId ? "project" : "principal",
      subjectId: input.projectId ?? actor.principalId,
      projectId: input.projectId ?? null,
      fieldNames: ["savedViews"],
    });
    return toSavedView(row, actor.principalId) as never;
  },
});

export const listSavedViews = defineOperation({
  id: "saved_view.list",
  kind: "query",
  summary: "List your saved views and the shared ones",
  input: Type.Object({
    projectId: Type.Optional(Type.String()),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200, default: 50 })),
    cursor: Type.Optional(Type.String()),
  }),
  output: Type.Object({
    items: Type.Array(SavedViewShape),
    nextCursor: Type.Union([Type.String(), Type.Null()]),
    total: Type.Integer(),
    truncated: Type.Boolean(),
  }),
  requires: "authenticated",
  http: { method: "GET", path: "/api/v1/saved-views" },
  mcp: { tool: "aos_saved_view_list" },
  ui: { route: "/views", control: "saved_view.list" },
  byteBudget: 524_288,
  handler: async ({ client, actor }, input) => {
    const limit = input.limit ?? 50;
    const digest = filterDigest({ projectId: input.projectId });

    const params: unknown[] = [];
    const push = (value: unknown): string => {
      params.push(value);
      return `$${params.length}`;
    };

    // Yours, plus what has been shared with you. An unshared view of somebody else's is
    // never listed, and instance admin does not widen that: it is a private working set,
    // not a governed record.
    const me = push(actor.principalId);
    const where: string[] = [
      `(sv.owner_id = ${me}
        OR (sv.is_shared AND (sv.project_id IS NULL
                              OR ${push(actor.isInstanceAdmin)}
                              OR sv.project_id IN (SELECT project_id FROM project_member WHERE principal_id = ${me}))))`,
    ];
    if (input.projectId) where.push(`sv.project_id = ${push(input.projectId)}`);

    const filterWhere = where.join(" AND ");
    const filterParams = params.slice();

    if (input.cursor) {
      const cursor = decodeCursor(input.cursor, {
        schemaVersion: SAVED_VIEW_SCHEMA_VERSION,
        sortVersion: SAVED_VIEW_SORT_VERSION,
        filterDigest: digest,
        limit,
      });
      where.push(`(sv.position, sv.id) > (${push(Number(cursor.last.sortKey))}::integer, ${push(cursor.last.id)})`);
    }

    const whereSql = where.join(" AND ");
    const totalResult = await client.query<{ count: string }>(
      `SELECT count(*) AS count FROM saved_view sv WHERE ${filterWhere}`,
      filterParams,
    );
    const total = Number(totalResult.rows[0]?.count ?? 0);

    const rows = await client.query<SavedViewRow>(
      `SELECT sv.id, sv.project_id, sv.owner_id, sv.name, sv.query, sv.is_shared,
              sv.position, sv.version, sv.created_at, sv.updated_at
         FROM saved_view sv
        WHERE ${whereSql}
        ORDER BY sv.position ASC, sv.id ASC
        LIMIT ${push(limit + 1)}`,
      params,
    );

    const page = rows.rows.slice(0, limit);
    const hasMore = rows.rows.length > limit;
    const last = page.at(-1);
    const nextCursor =
      hasMore && last
        ? encodeCursor({
            schemaVersion: SAVED_VIEW_SCHEMA_VERSION,
            sortVersion: SAVED_VIEW_SORT_VERSION,
            filterDigest: digest,
            limit,
            last: { sortKey: String(last.position), id: last.id },
          })
        : null;

    const body = {
      items: page.map((row) => toSavedView(row, actor.principalId)),
      nextCursor,
      total,
      truncated: hasMore,
    };
    return enforceResponseBudget(body, 524_288, total) as never;
  },
});

export const deleteSavedView = defineOperation({
  id: "saved_view.delete",
  kind: "command",
  summary: "Delete a saved view",
  input: Type.Object({ id: Type.String({ minLength: 1 }) }),
  output: Type.Object({ ok: Type.Boolean() }),
  requires: "authenticated",
  http: { method: "POST", path: "/api/v1/saved-views/{id}/delete" },
  mcp: { tool: "aos_saved_view_delete" },
  ui: { route: "/views", control: "saved_view.delete" },
  handler: async ({ client, actor }, input) => {
    const found = await client.query<{
      id: string; project_id: string | null; owner_id: string | null; is_shared: boolean;
    }>(
      "SELECT id, project_id, owner_id, is_shared FROM saved_view WHERE id = $1",
      [input.id],
    );
    const row = found.rows[0];
    if (!row) fail("not_found", "No such saved view");

    const mine = row.owner_id !== null && row.owner_id === actor.principalId;
    if (!mine) {
      if (row.is_shared && row.project_id !== null) {
        // A shared project view is project furniture; a maintainer may take it down.
        requireProjectRole(actor, row.project_id, "maintainer");
      } else if (!actor.isInstanceAdmin) {
        // Someone else's private view. Refusing with not_found rather than forbidden is
        // deliberate: a refusal that distinguishes the two confirms the view exists.
        fail("not_found", "No such saved view");
      }
    }

    // Hard delete. saved_view carries no deleted_at, and a saved list holds no record
    // anybody needs back — the query it stores is a preference, not a fact.
    await client.query("DELETE FROM saved_view WHERE id = $1", [row.id]);
    await recordActivity(client, actor, {
      action: "saved_view_deleted",
      subjectType: row.project_id ? "project" : "principal",
      subjectId: row.project_id ?? row.owner_id ?? actor.principalId,
      projectId: row.project_id,
      fieldNames: ["savedViews"],
    });
    return { ok: true };
  },
});

export const listLabels = defineOperation({
  id: "label.list",
  kind: "query",
  summary: "List a project's labels with how many items carry each",
  input: Type.Object({
    projectId: Type.String({ minLength: 1 }),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 500, default: 200 })),
    cursor: Type.Optional(Type.String()),
  }),
  output: Type.Object({
    items: Type.Array(
      Type.Object({
        id: Type.String(),
        name: Type.String(),
        color: Type.String(),
        usageCount: Type.Integer(),
      }),
    ),
    nextCursor: Type.Union([Type.String(), Type.Null()]),
    total: Type.Integer(),
    truncated: Type.Boolean(),
  }),
  requires: { project: "viewer", from: "input" },
  http: { method: "GET", path: "/api/v1/projects/{projectId}/labels" },
  mcp: { tool: "aos_label_list" },
  ui: { route: "/work-items", control: "label.list" },
  byteBudget: 524_288,
  handler: async ({ client }, input) => {
    const limit = input.limit ?? 200;
    const digest = filterDigest({ projectId: input.projectId });

    const params: unknown[] = [];
    const push = (value: unknown): string => {
      params.push(value);
      return `$${params.length}`;
    };
    const where: string[] = [`l.project_id = ${push(input.projectId)}`];

    const filterWhere = where.join(" AND ");
    const filterParams = params.slice();

    if (input.cursor) {
      const cursor = decodeCursor(input.cursor, {
        schemaVersion: LABEL_SCHEMA_VERSION,
        sortVersion: LABEL_SORT_VERSION,
        filterDigest: digest,
        limit,
      });
      where.push(`(l.name, l.id) > (${push(cursor.last.sortKey)}, ${push(cursor.last.id)})`);
    }

    const whereSql = where.join(" AND ");
    const totalResult = await client.query<{ count: string }>(
      `SELECT count(*) AS count FROM label l WHERE ${filterWhere}`,
      filterParams,
    );
    const total = Number(totalResult.rows[0]?.count ?? 0);

    // Trashed items do not count. A label whose only holders are in the trash reads as
    // in use, and nobody can find the items that would explain the number.
    const rows = await client.query<{ id: string; name: string; color: string; usage_count: string }>(
      `SELECT l.id, l.name, l.color,
              count(wl.work_item_id) FILTER (WHERE w.deleted_at IS NULL) AS usage_count
         FROM label l
         LEFT JOIN work_item_label wl ON wl.label_id = l.id
         LEFT JOIN work_item w ON w.id = wl.work_item_id
        WHERE ${whereSql}
        GROUP BY l.id
        ORDER BY l.name ASC, l.id ASC
        LIMIT ${push(limit + 1)}`,
      params,
    );

    const page = rows.rows.slice(0, limit);
    const hasMore = rows.rows.length > limit;
    const last = page.at(-1);
    const nextCursor =
      hasMore && last
        ? encodeCursor({
            schemaVersion: LABEL_SCHEMA_VERSION,
            sortVersion: LABEL_SORT_VERSION,
            filterDigest: digest,
            limit,
            last: { sortKey: last.name, id: last.id },
          })
        : null;

    const body = {
      items: page.map((row) => ({
        id: row.id,
        name: row.name,
        color: row.color,
        usageCount: Number(row.usage_count),
      })),
      nextCursor,
      total,
      truncated: hasMore,
    };
    return enforceResponseBudget(body, 524_288, total) as never;
  },
});
