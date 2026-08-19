import { Type } from "@sinclair/typebox";
import type pg from "pg";
import { toQuery } from "../../../store/src/search-text.js";
import type { Actor } from "../actor.js";
import { recordActivity, type SubjectType } from "../audit.js";
import { fail } from "../errors.js";
import { decodeCursor, encodeCursor, enforceResponseBudget, filterDigest } from "../read.js";
import { defineOperation } from "../registry.js";

/** The vocabulary declared in 0003. search_doc.subject_type is a foreign key into it. */
const SUBJECT_TYPES = [
  "work_item", "page", "project", "space", "gate",
  "deliberation", "decision", "release", "principal", "comment", "attachment",
] as const;

const INBOX_SCHEMA_VERSION = "aos.notification.list.v1";
const INBOX_SORT_VERSION = "unread-first-created-desc-id-asc-v1";

/**
 * Membership is the only visibility mechanism this schema has.
 *
 * A row whose project_id is NULL therefore falls outside it, and that is deliberate rather
 * than an oversight to paper over: `space.project_id` is ON DELETE SET NULL, so deleting a
 * project turns its spaces project-less. Treating NULL as "belongs to everyone" would mean
 * deleting a project WIDENS access to the knowledge that was in it.
 */
function visibleProjectsClause(
  actor: Actor,
  column: string,
  push: (value: unknown) => string,
): string | null {
  if (actor.isInstanceAdmin) return null;
  return `${column} IN (SELECT project_id FROM project_member WHERE principal_id = ${push(actor.principalId)})`;
}

function requireProjectRole(
  actor: Actor,
  projectId: string | null,
  required: "viewer" | "contributor" | "maintainer" | "admin",
): void {
  if (actor.isInstanceAdmin) return;
  if (projectId === null) {
    fail("forbidden", "That subject belongs to no project, so no role can be checked against it", {});
  }
  const rank = { viewer: 1, contributor: 2, maintainer: 3, admin: 4 };
  const held = actor.roles.get(projectId);
  if (!held || rank[held] < rank[required]) {
    fail("forbidden", `This action requires the ${required} role on that project`, { projectId });
  }
}

// ---------------------------------------------------------------------------
// Unified search
// ---------------------------------------------------------------------------

const SearchHit = Type.Object({
  subjectType: Type.String(),
  subjectId: Type.String(),
  title: Type.String(),
  key: Type.Union([Type.String(), Type.Null()]),
  status: Type.Union([Type.String(), Type.Null()]),
  projectId: Type.Union([Type.String(), Type.Null()]),
  rank: Type.Number(),
  snippet: Type.String(),
});

interface SearchRow {
  subject_type: string;
  subject_id: string;
  title: string;
  key: string | null;
  status: string | null;
  project_id: string | null;
  rank_score: number;
  snippet: string;
  total_count: string;
}

/**
 * The delimiters must be inert in every surface that renders a snippet.
 *
 * ts_headline's default is `<b>`, and a snippet is somebody's own text on its way into an
 * HTML page: emitting markup around it means the highlight and an injection attempt are
 * the same shape. Guillemets are punctuation everywhere and markup nowhere.
 */
const HEADLINE_OPTIONS = "StartSel=«, StopSel=», MaxWords=32, MinWords=12, ShortWord=2";

export const searchQuery = defineOperation({
  id: "search.query",
  kind: "query",
  summary: "Search everything you can see",
  input: Type.Object({
    q: Type.String({ minLength: 1, maxLength: 200 }),
    subjectType: Type.Optional(Type.Union(SUBJECT_TYPES.map((name) => Type.Literal(name)))),
    projectId: Type.Optional(Type.String()),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 25 })),
  }),
  output: Type.Object({
    items: Type.Array(SearchHit),
    total: Type.Integer(),
    truncated: Type.Boolean(),
  }),
  // Not the { project } form, even though the input names a project: dispatch reads that
  // field as MANDATORY and refuses the request when it is absent, which would make an
  // instance-wide search impossible to express. projectId here is a filter, and the
  // visibility rule below is what actually holds.
  requires: "authenticated",
  http: { method: "GET", path: "/api/v1/search" },
  mcp: { tool: "aos_search_query" },
  ui: { route: "/search", control: "search.query" },
  byteBudget: 524_288,
  handler: async ({ client, actor }, input) => {
    const limit = input.limit ?? 25;

    // The same emitter the write path uses, so the index and the query cannot drift.
    const query = toQuery(input.q);
    if (query === null) {
      // A query that tokenises to nothing matches nothing. Returning early is the only
      // form of that promise which does not depend on a sentinel lexeme staying absent
      // from every document forever.
      return { items: [], total: 0, truncated: false };
    }

    const params: unknown[] = [];
    const push = (value: unknown): string => {
      params.push(value);
      return `$${params.length}`;
    };

    const where: string[] = [`sd.search_vec @@ q.query`];
    const visible = visibleProjectsClause(actor, "sd.project_id", push);
    if (visible) where.push(visible);
    if (input.subjectType) where.push(`sd.subject_type = ${push(input.subjectType)}`);
    if (input.projectId) where.push(`sd.project_id = ${push(input.projectId)}`);

    const rows = await client.query<SearchRow>(
      `WITH q AS (SELECT to_tsquery('simple', ${push(query)}) AS query)
       SELECT sd.subject_type, sd.subject_id, sd.title, sd.key, sd.status, sd.project_id,
              ts_rank_cd(sd.search_vec, q.query, 32) AS rank_score,
              ts_headline('simple', coalesce(nullif(sd.body_text, ''), sd.title), q.query,
                          '${HEADLINE_OPTIONS}') AS snippet,
              count(*) OVER () AS total_count
         FROM search_doc sd CROSS JOIN q
        WHERE ${where.join(" AND ")}
        -- Relevance first. A timestamp as the primary key of the ordering turns a search
        -- box into a recency feed, and the timestamp available here is a WRITE time: read
        -- time lives in search_access precisely so that opening an entry cannot reorder
        -- everyone else's results.
        ORDER BY rank_score DESC, sd.updated_at DESC, sd.subject_id ASC
        LIMIT ${push(limit)}`,
      params,
    );

    const total = Number(rows.rows[0]?.total_count ?? 0);
    const body = {
      items: rows.rows.map((row) => ({
        subjectType: row.subject_type,
        subjectId: row.subject_id,
        title: row.title,
        key: row.key,
        status: row.status,
        projectId: row.project_id,
        // 32 normalises into 0..1, so a caller can threshold a rank without knowing how
        // long the document was.
        rank: row.rank_score,
        snippet: row.snippet,
      })),
      total,
      // No cursor: the sort key is a rank recomputed against an index that changes under
      // the reader, so "resume after rank 0.41" can skip rows and repeat others. A search
      // states its ceiling and the count it would have returned instead.
      truncated: total > rows.rows.length,
    };
    return enforceResponseBudget(body, 524_288, total) as never;
  },
});

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

const NotificationShape = Type.Object({
  id: Type.String(),
  kind: Type.String(),
  subjectType: Type.String(),
  subjectId: Type.String(),
  subjectLabel: Type.String(),
  actorLabel: Type.String(),
  createdAt: Type.String(),
  readAt: Type.Union([Type.String(), Type.Null()]),
});

interface NotificationRow {
  id: string;
  kind: string;
  subject_type: string;
  subject_id: string;
  subject_label: string;
  actor_label: string;
  created_at: Date;
  read_at: Date | null;
}

/** Unread-first is a band, so the cursor carries the band alongside the timestamp. */
function packInboxSortKey(row: NotificationRow): string {
  return `${row.read_at === null ? "1" : "0"}|${row.created_at.toISOString()}`;
}

function unpackInboxSortKey(sortKey: string): { unread: string; createdAt: string } {
  const separator = sortKey.indexOf("|");
  const unread = sortKey.slice(0, separator);
  const createdAt = sortKey.slice(separator + 1);
  if ((unread !== "0" && unread !== "1") || createdAt === "") {
    fail("validation_failed", "That cursor is not readable", { cursor: "malformed" });
  }
  return { unread, createdAt };
}

export const listNotifications = defineOperation({
  id: "notification.list",
  kind: "query",
  summary: "Read your inbox, unread first",
  input: Type.Object({
    unreadOnly: Type.Optional(Type.Boolean()),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200, default: 50 })),
    cursor: Type.Optional(Type.String()),
  }),
  output: Type.Object({
    items: Type.Array(NotificationShape),
    /** The whole inbox's unread count, not this page's. */
    unread: Type.Integer(),
    total: Type.Integer(),
    nextCursor: Type.Union([Type.String(), Type.Null()]),
    truncated: Type.Boolean(),
  }),
  requires: "authenticated",
  http: { method: "GET", path: "/api/v1/notifications" },
  mcp: { tool: "aos_notification_list" },
  ui: { route: "/inbox", control: "notification.list" },
  byteBudget: 524_288,
  handler: async ({ client, actor }, input) => {
    const limit = input.limit ?? 50;
    const digest = filterDigest({ unreadOnly: input.unreadOnly } as Record<string, unknown>);

    const params: unknown[] = [];
    const push = (value: unknown): string => {
      params.push(value);
      return `$${params.length}`;
    };

    // An inbox is one person's. There is no filter for whose it is, because a filter is
    // something a caller can change.
    const where: string[] = [`n.principal_id = ${push(actor.principalId)}`];
    if (input.unreadOnly) where.push("n.read_at IS NULL");

    if (input.cursor) {
      const cursor = decodeCursor(input.cursor, {
        schemaVersion: INBOX_SCHEMA_VERSION,
        sortVersion: INBOX_SORT_VERSION,
        filterDigest: digest,
        limit,
      });
      const last = unpackInboxSortKey(cursor.last.sortKey);
      // The third column sorts the other way, so this cannot be one row comparison.
      // Marking something read while paging moves it between bands and a row can be
      // missed; ordering purely by time instead would bury the unread items under
      // everything already dealt with, which is the failure people actually notice.
      const unread = push(last.unread);
      const createdAt = push(last.createdAt);
      const id = push(cursor.last.id);
      where.push(
        `(((n.read_at IS NULL)::int, n.created_at) < (${unread}::int, ${createdAt}::timestamptz)
          OR ((n.read_at IS NULL)::int = ${unread}::int AND n.created_at = ${createdAt}::timestamptz AND n.id > ${id}))`,
      );
    }

    const rows = await client.query<NotificationRow>(
      `SELECT n.id, n.kind, n.subject_type, n.subject_id, n.subject_label, n.actor_label,
              n.created_at, n.read_at
         FROM notification n
        WHERE ${where.join(" AND ")}
        ORDER BY (n.read_at IS NULL) DESC, n.created_at DESC, n.id ASC
        LIMIT ${push(limit + 1)}`,
      params,
    );

    // Counted without the keyset predicate: these describe the inbox, not the page.
    const counts = await client.query<{ total: string; unread: string }>(
      `SELECT count(*) FILTER (WHERE $2::boolean IS NOT TRUE OR read_at IS NULL) AS total,
              count(*) FILTER (WHERE read_at IS NULL) AS unread
         FROM notification WHERE principal_id = $1`,
      [actor.principalId, input.unreadOnly ?? false],
    );

    const page = rows.rows.slice(0, limit);
    const hasMore = rows.rows.length > limit;
    const last = page.at(-1);
    const nextCursor =
      hasMore && last
        ? encodeCursor({
            schemaVersion: INBOX_SCHEMA_VERSION,
            sortVersion: INBOX_SORT_VERSION,
            filterDigest: digest,
            limit,
            last: { sortKey: packInboxSortKey(last), id: last.id },
          })
        : null;

    const total = Number(counts.rows[0]?.total ?? 0);
    const body = {
      items: page.map((row) => ({
        id: row.id,
        kind: row.kind,
        subjectType: row.subject_type,
        subjectId: row.subject_id,
        subjectLabel: row.subject_label,
        actorLabel: row.actor_label,
        createdAt: row.created_at.toISOString(),
        readAt: row.read_at ? row.read_at.toISOString() : null,
      })),
      unread: Number(counts.rows[0]?.unread ?? 0),
      total,
      nextCursor,
      truncated: hasMore,
    };
    return enforceResponseBudget(body, 524_288, total) as never;
  },
});

export const markNotificationRead = defineOperation({
  id: "notification.mark_read",
  kind: "command",
  summary: "Mark one notification read",
  input: Type.Object({ id: Type.String({ minLength: 1 }) }),
  output: Type.Object({ id: Type.String(), readAt: Type.String() }),
  requires: "authenticated",
  http: { method: "POST", path: "/api/v1/notifications/{id}/read" },
  mcp: { tool: "aos_notification_mark_read" },
  ui: { route: "/inbox", control: "notification.mark_read" },
  idempotent: true,
  handler: async ({ client, actor }, input) => {
    const updated = await client.query<{ read_at: Date }>(
      `UPDATE notification SET read_at = now()
        WHERE id = $1 AND principal_id = $2 AND read_at IS NULL
        RETURNING read_at`,
      [input.id, actor.principalId],
    );
    const readAt = updated.rows[0]?.read_at;
    if (!readAt) {
      const existing = await client.query<{ read_at: Date | null }>(
        "SELECT read_at FROM notification WHERE id = $1 AND principal_id = $2",
        [input.id, actor.principalId],
      );
      const already = existing.rows[0]?.read_at;
      // Reading something twice is not an error, and a second click must not answer 404.
      if (already) return { id: input.id, readAt: already.toISOString() };
      // Someone else's notification answers exactly as a missing one does. "That exists
      // but is not yours" is itself a disclosure about a stranger's inbox.
      fail("not_found", "No such notification in your inbox");
    }
    // The subject vocabulary in 0003 has no 'notification' member and activity_event's
    // subject_type is a foreign key into it, so the audited subject is the person whose
    // inbox changed.
    await recordActivity(client, actor, {
      action: "notification_read",
      subjectType: "principal",
      subjectId: actor.principalId,
      fieldNames: ["readAt"],
    });
    return { id: input.id, readAt: readAt.toISOString() };
  },
});

export const markAllNotificationsRead = defineOperation({
  id: "notification.mark_all_read",
  kind: "command",
  summary: "Mark your whole inbox read",
  input: Type.Object({}),
  output: Type.Object({ markedCount: Type.Integer() }),
  requires: "authenticated",
  http: { method: "POST", path: "/api/v1/notifications/read-all" },
  mcp: { tool: "aos_notification_mark_all_read" },
  ui: { route: "/inbox", control: "notification.mark_all_read" },
  idempotent: true,
  handler: async ({ client, actor }) => {
    const result = await client.query(
      "UPDATE notification SET read_at = now() WHERE principal_id = $1 AND read_at IS NULL",
      [actor.principalId],
    );
    const markedCount = result.rowCount ?? 0;
    // One activity row for the act, not one per notification: activity_event is
    // append-only with no purge exemption, so a row per item would make the size of
    // somebody's backlog a permanent record.
    if (markedCount > 0) {
      await recordActivity(client, actor, {
        action: "notifications_all_read",
        subjectType: "principal",
        subjectId: actor.principalId,
        fieldNames: ["readAt"],
      });
    }
    return { markedCount };
  },
});

// ---------------------------------------------------------------------------
// Watchers
// ---------------------------------------------------------------------------

/**
 * The subjects a person can watch: those whose project can be resolved and therefore
 * checked. 'principal' and 'attachment' hang off no project, and 'release' names a kind of
 * work_item rather than a table of its own — a release is watched as the work item it is.
 */
const WATCHABLE = [
  "work_item", "page", "project", "space", "gate", "deliberation", "decision", "comment",
] as const satisfies readonly SubjectType[];

type WatchableSubject = (typeof WATCHABLE)[number];

const SUBJECT_LOOKUP: Readonly<Record<WatchableSubject, string>> = {
  work_item: "SELECT project_id FROM work_item WHERE id = $1 AND deleted_at IS NULL",
  page: `SELECT s.project_id FROM page p JOIN space s ON s.id = p.space_id
          WHERE p.id = $1 AND p.deleted_at IS NULL`,
  project: "SELECT id AS project_id FROM project WHERE id = $1 AND deleted_at IS NULL",
  space: "SELECT project_id FROM space WHERE id = $1 AND deleted_at IS NULL",
  gate: "SELECT project_id FROM gate WHERE id = $1",
  deliberation: "SELECT project_id FROM deliberation WHERE id = $1",
  decision: "SELECT project_id FROM decision WHERE id = $1",
  comment: "SELECT project_id FROM comment WHERE id = $1 AND deleted_at IS NULL",
};

async function subjectProjectId(
  client: pg.PoolClient,
  subjectType: WatchableSubject,
  subjectId: string,
): Promise<string | null> {
  const result = await client.query<{ project_id: string | null }>(
    SUBJECT_LOOKUP[subjectType],
    [subjectId],
  );
  const row = result.rows[0];
  if (!row) fail("not_found", "No such subject", { subjectType, subjectId });
  return row.project_id;
}

const WatchInput = Type.Object({
  subjectType: Type.Union(WATCHABLE.map((name) => Type.Literal(name))),
  subjectId: Type.String({ minLength: 1 }),
});

export const addWatch = defineOperation({
  id: "watch.add",
  kind: "command",
  summary: "Watch a subject, so its changes reach your inbox",
  input: WatchInput,
  output: Type.Object({ watching: Type.Boolean() }),
  // The project comes from the subject, not from the input, so dispatch cannot read it.
  requires: "authenticated",
  http: { method: "POST", path: "/api/v1/watchers" },
  mcp: { tool: "aos_watch_add" },
  ui: { route: "/watching", control: "watch.add" },
  idempotent: true,
  handler: async ({ client, actor }, input) => {
    const subjectType = input.subjectType as WatchableSubject;
    const projectId = await subjectProjectId(client, subjectType, input.subjectId);
    requireProjectRole(actor, projectId, "viewer");

    const result = await client.query(
      `INSERT INTO watcher (subject_type, subject_id, principal_id) VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [subjectType, input.subjectId, actor.principalId],
    );
    // Watching something already watched changes nothing, so it records nothing.
    if ((result.rowCount ?? 0) > 0) {
      await recordActivity(client, actor, {
        action: "watch_added",
        subjectType,
        subjectId: input.subjectId,
        projectId,
        fieldNames: ["watchers"],
      });
    }
    return { watching: true };
  },
});

export const removeWatch = defineOperation({
  id: "watch.remove",
  kind: "command",
  summary: "Stop watching a subject",
  input: WatchInput,
  output: Type.Object({ watching: Type.Boolean() }),
  requires: "authenticated",
  http: { method: "POST", path: "/api/v1/watchers/remove" },
  mcp: { tool: "aos_watch_remove" },
  ui: { route: "/watching", control: "watch.remove" },
  idempotent: true,
  handler: async ({ client, actor }, input) => {
    const subjectType = input.subjectType as WatchableSubject;
    // Deliberately no role check and no subject lookup. This deletes the actor's own row
    // from their own watch list; requiring a role on the subject's project would trap
    // whoever lost that role with notifications they cannot switch off, and requiring the
    // subject to still exist would do the same after a delete.
    const result = await client.query(
      "DELETE FROM watcher WHERE subject_type = $1 AND subject_id = $2 AND principal_id = $3",
      [subjectType, input.subjectId, actor.principalId],
    );
    if ((result.rowCount ?? 0) > 0) {
      await recordActivity(client, actor, {
        action: "watch_removed",
        subjectType,
        subjectId: input.subjectId,
        fieldNames: ["watchers"],
      });
    }
    // Unwatching something you were not watching is the state you asked for, not a 404.
    return { watching: false };
  },
});

// ---------------------------------------------------------------------------
// The personal work view
// ---------------------------------------------------------------------------

type BandName = "needsYou" | "inProgress" | "waiting";

/** The seven words for state, from 0002. The band map may name no others. */
type WorkStatus =
  | "planned" | "ready" | "active" | "blocked" | "pending_acceptance" | "done" | "cancelled";

/**
 * Three bands, defined once. The SQL CASE below is generated from this object so the
 * bands the database sorts into and the keys the response carries cannot drift apart.
 * Everything the actor is assigned outside these five statuses is finished, and finished
 * work is not what a morning screen is for.
 */
const MINE_BANDS: Readonly<Record<BandName, readonly WorkStatus[]>> = {
  needsYou: ["pending_acceptance", "blocked"],
  inProgress: ["active", "ready"],
  waiting: ["planned"],
};

// Interpolated, not parameterised: every value here is a module constant declared above,
// and none of it is reachable from a request.
const BAND_CASE = Object.entries(MINE_BANDS)
  .map(([band, statuses]) => `WHEN w.status IN (${statuses.map((s) => `'${s}'`).join(", ")}) THEN '${band}'`)
  .join(" ");

const MineItem = Type.Object({
  id: Type.String(),
  key: Type.String(),
  projectId: Type.String(),
  projectKey: Type.String(),
  kind: Type.String(),
  title: Type.String(),
  status: Type.String(),
  priority: Type.String(),
  dueAt: Type.Union([Type.String(), Type.Null()]),
  version: Type.Integer(),
  updatedAt: Type.String(),
});

interface MineRow {
  id: string;
  key: string;
  project_id: string;
  project_key: string;
  kind: string;
  title: string;
  status: string;
  priority: string;
  due_at: Date | null;
  version: number;
  updated_at: Date;
  band: string;
  band_total: string;
}

export const myWork = defineOperation({
  id: "work.mine",
  kind: "query",
  summary: "The work assigned to you, in three bands",
  input: Type.Object({
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200, default: 50 })),
  }),
  output: Type.Object({
    needsYou: Type.Array(MineItem),
    needsYouCount: Type.Integer(),
    inProgress: Type.Array(MineItem),
    inProgressCount: Type.Integer(),
    waiting: Type.Array(MineItem),
    waitingCount: Type.Integer(),
    truncated: Type.Boolean(),
  }),
  requires: "authenticated",
  http: { method: "GET", path: "/api/v1/me/work" },
  mcp: { tool: "aos_work_mine" },
  ui: { route: "/", control: "work.mine" },
  byteBudget: 524_288,
  handler: async ({ client, actor }, input) => {
    const limit = input.limit ?? 50;
    const params: unknown[] = [];
    const push = (value: unknown): string => {
      params.push(value);
      return `$${params.length}`;
    };

    const where: string[] = [
      `w.assignee_id = ${push(actor.principalId)}`,
      "w.deleted_at IS NULL",
    ];
    // Being the assignee is not membership. Removing someone from a project leaves their
    // assignment rows behind, and those titles must not outlive the removal on the one
    // screen they look at every morning.
    const visible = visibleProjectsClause(actor, "w.project_id", push);
    if (visible) where.push(visible);

    const rows = await client.query<MineRow>(
      `WITH mine AS (
         SELECT w.id, w.key, w.project_id, p.key AS project_key, w.kind, w.title, w.status,
                w.priority, w.due_at, w.version, w.updated_at,
                CASE ${BAND_CASE} END AS band
           FROM work_item w
           JOIN project p ON p.id = w.project_id AND p.deleted_at IS NULL
          WHERE ${where.join(" AND ")}
       ),
       ranked AS (
         SELECT mine.*,
                count(*) OVER (PARTITION BY band) AS band_total,
                row_number() OVER (
                  PARTITION BY band
                  -- Ordering on the priority column itself sorts low above normal, because
                  -- the column holds words. The ranking is stated here instead.
                  ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
                           due_at ASC NULLS LAST, updated_at DESC, id ASC
                ) AS rn
           FROM mine
          WHERE band IS NOT NULL
       )
       SELECT * FROM ranked WHERE rn <= ${push(limit)} ORDER BY band, rn`,
      params,
    );

    const bands: Record<BandName, { items: unknown[]; count: number }> = {
      needsYou: { items: [], count: 0 },
      inProgress: { items: [], count: 0 },
      waiting: { items: [], count: 0 },
    };
    for (const row of rows.rows) {
      const band = bands[row.band as BandName];
      if (!band) continue;
      band.items.push({
        id: row.id,
        key: row.key,
        projectId: row.project_id,
        projectKey: row.project_key,
        kind: row.kind,
        title: row.title,
        status: row.status,
        priority: row.priority,
        dueAt: row.due_at ? row.due_at.toISOString() : null,
        version: row.version,
        updatedAt: row.updated_at.toISOString(),
      });
      // The band's own count, taken over the whole band rather than the rows returned:
      // a screen that says "3" because it fetched 3 of 40 is worse than no number.
      band.count = Number(row.band_total);
    }

    const total = bands.needsYou.count + bands.inProgress.count + bands.waiting.count;
    const body = {
      needsYou: bands.needsYou.items,
      needsYouCount: bands.needsYou.count,
      inProgress: bands.inProgress.items,
      inProgressCount: bands.inProgress.count,
      waiting: bands.waiting.items,
      waitingCount: bands.waiting.count,
      // Stated, never silent. A band that shows fewer rows than it counted says so.
      truncated: (Object.keys(MINE_BANDS) as BandName[]).some(
        (band) => bands[band].count > bands[band].items.length,
      ),
    };
    return enforceResponseBudget(body, 524_288, total) as never;
  },
});
