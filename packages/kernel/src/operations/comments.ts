import { Type } from "@sinclair/typebox";
import type pg from "pg";
import { newId } from "../../../store/src/ids.js";
import {
  changedFields,
  notifyWatchers,
  recordActivity,
  removeSearchDoc,
  upsertSearchDoc,
  writeRevision,
  type SubjectType,
} from "../audit.js";
import { fail } from "../errors.js";
import { decodeCursor, encodeCursor, enforceResponseBudget, filterDigest } from "../read.js";
import { defineOperation } from "../registry.js";

const SUBJECTS = [
  "work_item", "page", "project", "space", "gate", "deliberation",
  "decision", "release", "principal", "comment", "attachment",
] as const satisfies readonly SubjectType[];

/**
 * Eight types, and the point of them is that a reader can tell a person stating intent
 * from an agent observing, proposing, or deciding without opening every body. They are
 * the schema's CHECK constraint restated; the database refuses anything else.
 */
const TYPES = [
  "human_intent", "agent_observation", "agent_proposal", "agent_decision",
  "conference_minute", "gate_result", "evidence_note", "release_note_draft",
] as const;

const LIST_SCHEMA_VERSION = "aos.comment.list.v1";
const LIST_SORT_VERSION = "created-asc-id-asc-v1";

const SubjectTypeEnum = Type.Union(SUBJECTS.map((name) => Type.Literal(name)));
const TypeEnum = Type.Union(TYPES.map((name) => Type.Literal(name)));

const CommentShape = Type.Object({
  id: Type.String(),
  subjectType: Type.String(),
  subjectId: Type.String(),
  projectId: Type.Union([Type.String(), Type.Null()]),
  parentCommentId: Type.Union([Type.String(), Type.Null()]),
  type: Type.String(),
  authorId: Type.Union([Type.String(), Type.Null()]),
  authorHandle: Type.Union([Type.String(), Type.Null()]),
  authorDisplayName: Type.Union([Type.String(), Type.Null()]),
  bodyMd: Type.String(),
  mentions: Type.Array(Type.String()),
  version: Type.Integer(),
  createdAt: Type.String(),
  editedAt: Type.Union([Type.String(), Type.Null()]),
  revisionCount: Type.Integer(),
  deleted: Type.Boolean(),
});

interface CommentRow {
  id: string;
  subject_type: SubjectType;
  subject_id: string;
  project_id: string | null;
  parent_comment_id: string | null;
  type: string;
  author_id: string | null;
  author_handle?: string | null;
  author_display_name?: string | null;
  body_md: string;
  version: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  revision_count?: string | number | null;
  mentions?: string[] | null;
}

function toShape(row: CommentRow): Record<string, unknown> {
  const deleted = row.deleted_at !== null;
  return {
    id: row.id,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    projectId: row.project_id,
    parentCommentId: row.parent_comment_id,
    type: row.type,
    authorId: row.author_id,
    authorHandle: row.author_handle ?? null,
    authorDisplayName: row.author_display_name ?? null,
    // A tombstone keeps its place in the thread but not its words.
    bodyMd: deleted ? "" : row.body_md,
    mentions: (row.mentions ?? []).filter((handle): handle is string => typeof handle === "string"),
    version: row.version,
    createdAt: row.created_at.toISOString(),
    editedAt:
      row.updated_at.getTime() === row.created_at.getTime() ? null : row.updated_at.toISOString(),
    revisionCount: Number(row.revision_count ?? 0),
    deleted,
  };
}

const SELECT_COMMENT = `
  SELECT c.id, c.subject_type, c.subject_id, c.project_id, c.parent_comment_id, c.type,
         c.author_id, a.handle AS author_handle, a.display_name AS author_display_name,
         c.body_md, c.version, c.created_at, c.updated_at, c.deleted_at,
         (SELECT count(*) FROM comment_revision r WHERE r.comment_id = c.id) AS revision_count,
         coalesce(array_agg(mp.handle) FILTER (WHERE mp.handle IS NOT NULL), '{}') AS mentions
    FROM comment c
    LEFT JOIN principal a ON a.id = c.author_id
    LEFT JOIN mention m ON m.comment_id = c.id
    LEFT JOIN principal mp ON mp.id = m.principal_id
`;

const GROUP_COMMENT = "GROUP BY c.id, a.handle, a.display_name";

/** Loads deleted rows too: editing or deleting one has to be able to say what it found. */
async function loadComment(client: pg.PoolClient, id: string): Promise<CommentRow> {
  const result = await client.query<CommentRow>(
    `${SELECT_COMMENT} WHERE c.id = $1 ${GROUP_COMMENT}`,
    [id],
  );
  const row = result.rows[0];
  if (!row) fail("not_found", "No such comment", { commentId: id });
  return row;
}

/**
 * Which table proves a subject exists is data, because the subject is polymorphic and
 * there is nothing to join to. A Record over every subject type rather than a partial
 * map, so adding a subject type to the vocabulary fails the build here instead of
 * silently accepting comments on something that was never checked.
 *
 * `release` has no table of its own — a release is a work_item with kind 'release'.
 */
const SUBJECT_EXISTS: Record<SubjectType, string> = {
  work_item: "SELECT 1 FROM work_item WHERE id = $1 AND deleted_at IS NULL",
  release: "SELECT 1 FROM work_item WHERE id = $1 AND deleted_at IS NULL",
  page: "SELECT 1 FROM page WHERE id = $1 AND deleted_at IS NULL",
  project: "SELECT 1 FROM project WHERE id = $1 AND deleted_at IS NULL",
  space: "SELECT 1 FROM space WHERE id = $1 AND deleted_at IS NULL",
  gate: "SELECT 1 FROM gate WHERE id = $1",
  deliberation: "SELECT 1 FROM deliberation WHERE id = $1",
  decision: "SELECT 1 FROM decision WHERE id = $1",
  principal: "SELECT 1 FROM principal WHERE id = $1",
  comment: "SELECT 1 FROM comment WHERE id = $1 AND deleted_at IS NULL",
  attachment: "SELECT 1 FROM attachment WHERE id = $1",
};

/**
 * Where the governing project is found, for the subject types that have one.
 *
 * A comment inherits its subject's access: a gate in a private project must not be
 * commentable by anyone who happens to be signed in. Three subject types — principal,
 * attachment, and a page in a space with no project — genuinely belong to no project,
 * and for those `authenticated` is the whole of the bar.
 */
const PROJECT_SOURCE: Partial<Record<SubjectType, string>> = {
  work_item: "SELECT project_id FROM work_item WHERE id = $1",
  release: "SELECT project_id FROM work_item WHERE id = $1",
  gate: "SELECT project_id FROM gate WHERE id = $1",
  deliberation: "SELECT project_id FROM deliberation WHERE id = $1",
  decision: "SELECT project_id FROM decision WHERE id = $1",
  project: "SELECT id AS project_id FROM project WHERE id = $1",
  space: "SELECT project_id FROM space WHERE id = $1",
  page: "SELECT s.project_id FROM page p JOIN space s ON s.id = p.space_id WHERE p.id = $1",
  comment: "SELECT project_id FROM comment WHERE id = $1",
};

async function assertSubjectExists(
  client: pg.PoolClient,
  subjectType: SubjectType,
  subjectId: string,
): Promise<void> {
  const result = await client.query(SUBJECT_EXISTS[subjectType], [subjectId]);
  if (result.rowCount === 0) {
    fail("not_found", "No such subject to comment on", { subjectType, subjectId });
  }
}

/**
 * Never fails on a missing subject. Update and delete call this, and a comment whose
 * subject was hard-deleted underneath it must still be removable.
 */
async function governingProject(
  client: pg.PoolClient,
  subjectType: SubjectType,
  subjectId: string,
): Promise<string | null> {
  const sql = PROJECT_SOURCE[subjectType];
  if (!sql) return null;
  const result = await client.query<{ project_id: string | null }>(sql, [subjectId]);
  return result.rows[0]?.project_id ?? null;
}

/** The line a notification shows. search_doc already holds the readable name of anything indexed. */
async function subjectLabel(
  client: pg.PoolClient,
  subjectType: SubjectType,
  subjectId: string,
): Promise<string> {
  const result = await client.query<{ title: string }>(
    "SELECT title FROM search_doc WHERE subject_type = $1 AND subject_id = $2",
    [subjectType, subjectId],
  );
  return result.rows[0]?.title ?? `${subjectType} ${subjectId}`;
}

/**
 * The character before @ must not be a word character, so an address in the body does not
 * read as a mention of its domain. A trailing full stop is trimmed because a handle at the
 * end of a sentence carries one.
 */
const MENTION_PATTERN = /(?:^|[^\w@/])@([A-Za-z0-9][A-Za-z0-9._-]{0,62})/g;

function parseMentionHandles(bodyMd: string): string[] {
  const handles = new Set<string>();
  for (const match of bodyMd.matchAll(MENTION_PATTERN)) {
    const raw = match[1];
    if (!raw) continue;
    const handle = raw.replace(/\.+$/, "").toLowerCase();
    if (handle.length > 0) handles.add(handle);
  }
  return [...handles];
}

/** A handle nobody holds is prose, not a failed request. */
async function resolveMentions(
  client: pg.PoolClient,
  handles: readonly string[],
): Promise<{ id: string; handle: string }[]> {
  if (handles.length === 0) return [];
  const found = await client.query<{ id: string; handle: string }>(
    "SELECT id, handle FROM principal WHERE lower(handle) = ANY($1::text[]) AND disabled_at IS NULL",
    [handles],
  );
  return found.rows;
}

/** New rows only. Removing a mention cannot take back the notification it already sent. */
async function linkMentions(
  client: pg.PoolClient,
  commentId: string,
  mentioned: readonly { id: string }[],
): Promise<void> {
  for (const person of mentioned) {
    await client.query(
      "INSERT INTO mention (comment_id, principal_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [commentId, person.id],
    );
  }
}

/** search_doc.title is NOT NULL and a comment has no title; its first line is what a person recognises. */
function searchTitle(bodyMd: string): string {
  const line = bodyMd
    .split("\n")
    .map((candidate) => candidate.trim())
    .find((candidate) => candidate.length > 0);
  return (line ?? "").slice(0, 200);
}

export const createComment = defineOperation({
  id: "comment.create",
  kind: "command",
  summary: "Comment on a subject",
  input: Type.Object({
    subjectType: SubjectTypeEnum,
    subjectId: Type.String({ minLength: 1 }),
    bodyMd: Type.String({ minLength: 1, maxLength: 100_000 }),
    parentCommentId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    type: Type.Optional(TypeEnum),
  }),
  output: CommentShape,
  // The project comes from the subject, not from the input, so dispatch cannot read it.
  requires: "authenticated",
  http: { method: "POST", path: "/api/v1/comments" },
  mcp: { tool: "aos_comment_create" },
  ui: { route: "/subjects/{subjectType}/{subjectId}", control: "comment.create" },
  handler: async ({ client, actor }, input) => {
    await assertSubjectExists(client, input.subjectType, input.subjectId);
    const project = await governingProject(client, input.subjectType, input.subjectId);
    if (project) requireProjectRole(actor, project, "contributor");

    if (input.parentCommentId) {
      const parent = await client.query<{ subject_type: string; subject_id: string }>(
        "SELECT subject_type, subject_id FROM comment WHERE id = $1",
        [input.parentCommentId],
      );
      const parentRow = parent.rows[0];
      if (!parentRow) fail("not_found", "No such parent comment");
      // A parent on another subject splices two threads together and neither page can
      // then render its own conversation.
      if (parentRow.subject_type !== input.subjectType || parentRow.subject_id !== input.subjectId) {
        fail("validation_failed", "A reply must sit on the same subject as the comment it answers");
      }
    }

    const id = newId("cm");
    const type = input.type ?? "human_intent";
    // The search index and authorization must agree for every subject type. Keeping the
    // resolved project on the comment avoids a NULL index row that only administrators can
    // ever see in a project-scoped search.
    const projectId = project;

    await client.query(
      `INSERT INTO comment (id, subject_type, subject_id, project_id, parent_comment_id, type, author_id, body_md)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id, input.subjectType, input.subjectId, projectId,
        input.parentCommentId ?? null, type, actor.principalId, input.bodyMd,
      ],
    );

    const mentioned = await resolveMentions(client, parseMentionHandles(input.bodyMd));
    await linkMentions(client, id, mentioned);

    // Saying something is how a person opts into hearing the answer.
    await client.query(
      "INSERT INTO watcher (subject_type, subject_id, principal_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
      [input.subjectType, input.subjectId, actor.principalId],
    );

    await recordActivity(client, actor, {
      action: "commented",
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      projectId: project,
      fieldNames: ["comment"],
    });
    await upsertSearchDoc(client, {
      subjectType: "comment",
      subjectId: id,
      projectId,
      title: searchTitle(input.bodyMd),
      body: input.bodyMd,
      status: type,
    });
    await notifyWatchers(client, actor, {
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      subjectLabel: await subjectLabel(client, input.subjectType, input.subjectId),
      kind: "comment_created",
      extraPrincipalIds: mentioned.map((person) => person.id),
    });
    return toShape(await loadComment(client, id)) as never;
  },
});

export const listComments = defineOperation({
  id: "comment.list",
  kind: "query",
  summary: "List the comments on a subject",
  input: Type.Object({
    subjectType: SubjectTypeEnum,
    subjectId: Type.String({ minLength: 1 }),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200, default: 50 })),
    cursor: Type.Optional(Type.String()),
  }),
  output: Type.Object({
    items: Type.Array(CommentShape),
    nextCursor: Type.Union([Type.String(), Type.Null()]),
    total: Type.Integer(),
    truncated: Type.Boolean(),
  }),
  requires: "authenticated",
  http: { method: "GET", path: "/api/v1/comments" },
  mcp: { tool: "aos_comment_list" },
  ui: { route: "/subjects/{subjectType}/{subjectId}", control: "comment.list" },
  byteBudget: 1_048_576,
  handler: async ({ client, actor }, input) => {
    const project = await governingProject(client, input.subjectType, input.subjectId);
    if (project) requireProjectRole(actor, project, "viewer");

    const limit = input.limit ?? 50;
    const digest = filterDigest({ subjectType: input.subjectType, subjectId: input.subjectId });

    const params: unknown[] = [];
    const push = (value: unknown): string => {
      params.push(value);
      return `$${params.length}`;
    };
    // Deleted comments stay in the list as tombstones. Dropping them orphans their
    // replies, and a thread with a hole in it is not a thread.
    const where: string[] = [
      `c.subject_type = ${push(input.subjectType)}`,
      `c.subject_id = ${push(input.subjectId)}`,
    ];

    const filterWhere = where.join(" AND ");
    const filterParams = params.slice();

    if (input.cursor) {
      const cursor = decodeCursor(input.cursor, {
        schemaVersion: LIST_SCHEMA_VERSION,
        sortVersion: LIST_SORT_VERSION,
        filterDigest: digest,
        limit,
      });
      where.push(
        `(c.created_at, c.id) > (${push(cursor.last.sortKey)}::timestamptz, ${push(cursor.last.id)})`,
      );
    }

    const whereSql = where.join(" AND ");
    const totalResult = await client.query<{ count: string }>(
      `SELECT count(*) AS count FROM comment c WHERE ${filterWhere}`,
      filterParams,
    );
    const total = Number(totalResult.rows[0]?.count ?? 0);

    const rows = await client.query<CommentRow>(
      `${SELECT_COMMENT} WHERE ${whereSql}
        ${GROUP_COMMENT}
        ORDER BY c.created_at ASC, c.id ASC
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
            last: { sortKey: last.created_at.toISOString(), id: last.id },
          })
        : null;

    // parentCommentId travels with every row and the nesting happens in the caller. A
    // server that nests has to pick a depth, and a reply below it disappears.
    const body = {
      items: page.map(toShape),
      nextCursor,
      total,
      truncated: hasMore,
    };
    return enforceResponseBudget(body, 1_048_576, total) as never;
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

/**
 * A comment is a person's own words, so editing and removing it is the author's right
 * first. A maintainer holds the same power for the sake of moderation — not a
 * contributor, who would then be able to rewrite what a colleague said. Where the subject
 * belongs to no project there is no moderator to appeal to, and the author is alone.
 */
async function requireAuthorOrMaintainer(
  client: pg.PoolClient,
  actor: import("../actor.js").Actor,
  row: CommentRow,
): Promise<void> {
  if (row.author_id !== null && row.author_id === actor.principalId) return;
  if (actor.isInstanceAdmin) return;
  const project = row.project_id ?? (await governingProject(client, row.subject_type, row.subject_id));
  if (!project) {
    fail("forbidden", "Only the author may edit a comment on a subject with no project", {
      commentId: row.id,
    });
  }
  requireProjectRole(actor, project, "maintainer");
}

export const updateComment = defineOperation({
  id: "comment.update",
  kind: "command",
  summary: "Edit a comment",
  input: Type.Object({
    commentId: Type.String({ minLength: 1 }),
    expectedVersion: Type.Integer({ minimum: 1 }),
    bodyMd: Type.Optional(Type.String({ minLength: 1, maxLength: 100_000 })),
    type: Type.Optional(TypeEnum),
  }),
  output: CommentShape,
  requires: "authenticated",
  http: { method: "POST", path: "/api/v1/comments/{commentId}/update" },
  mcp: { tool: "aos_comment_update" },
  // Every parameter in a route has to be fillable from this operation's own input, and an
  // edit knows only the comment's id — the thread it hangs in is something it looks up.
  ui: { route: "/comments/{commentId}", control: "comment.update" },
  handler: async ({ client, actor }, input) => {
    const row = await loadComment(client, input.commentId);
    if (row.deleted_at !== null) fail("not_found", "That comment was deleted", { commentId: row.id });
    await requireAuthorOrMaintainer(client, actor, row);
    if (row.version !== input.expectedVersion) {
      fail("stale_version", "Someone else changed this comment while you were editing", {
        currentVersion: row.version,
        yourVersion: input.expectedVersion,
      });
    }

    const before = { bodyMd: row.body_md, type: row.type };
    const after = { bodyMd: input.bodyMd ?? row.body_md, type: input.type ?? row.type };
    const changed = changedFields(before, after);
    if (changed.length === 0) return toShape(row) as never;

    const revisionId = await writeRevision(
      client,
      { table: "comment_revision", idColumn: "comment_id" },
      row.id,
      row.version,
      before,
      actor,
    );
    await client.query(
      `UPDATE comment SET body_md = $1, type = $2, version = version + 1, updated_at = now()
        WHERE id = $3`,
      [after.bodyMd, after.type, row.id],
    );

    // Re-read from the edited body: someone named in an edit has been named, and the
    // mention rows are what the thread renders from.
    const known = new Set((row.mentions ?? []).map((handle) => handle.toLowerCase()));
    const mentioned = await resolveMentions(client, parseMentionHandles(after.bodyMd));
    const added = mentioned.filter((person) => !known.has(person.handle.toLowerCase()));
    await linkMentions(client, row.id, added);

    await recordActivity(client, actor, {
      action: "comment_edited",
      subjectType: row.subject_type,
      subjectId: row.subject_id,
      projectId: row.project_id,
      fieldNames: changed,
      revisionRef: revisionId,
    });
    await upsertSearchDoc(client, {
      subjectType: "comment",
      subjectId: row.id,
      projectId: row.project_id,
      title: searchTitle(after.bodyMd),
      body: after.bodyMd,
      status: after.type,
    });
    await notifyWatchers(client, actor, {
      subjectType: row.subject_type,
      subjectId: row.subject_id,
      subjectLabel: await subjectLabel(client, row.subject_type, row.subject_id),
      kind: "comment_updated",
      extraPrincipalIds: added.map((person) => person.id),
    });
    return toShape(await loadComment(client, row.id)) as never;
  },
});

export const deleteComment = defineOperation({
  id: "comment.delete",
  kind: "command",
  summary: "Remove a comment",
  input: Type.Object({ commentId: Type.String({ minLength: 1 }) }),
  output: Type.Object({ ok: Type.Boolean() }),
  requires: "authenticated",
  http: { method: "POST", path: "/api/v1/comments/{commentId}/delete" },
  mcp: { tool: "aos_comment_delete" },
  ui: { route: "/comments/{commentId}", control: "comment.delete" },
  handler: async ({ client, actor }, input) => {
    const row = await loadComment(client, input.commentId);
    await requireAuthorOrMaintainer(client, actor, row);
    // A second delete is not a new fact, and recording it as one puts two removals of the
    // same comment in the activity stream.
    if (row.deleted_at !== null) return { ok: true };

    const revisionId = await writeRevision(
      client,
      { table: "comment_revision", idColumn: "comment_id" },
      row.id,
      row.version,
      { deletedAt: null },
      actor,
    );
    // Soft, and deliberately not cascaded. The schema's ON DELETE CASCADE only fires for a
    // hard delete; replies to this comment keep their parent id and stay reachable.
    await client.query(
      "UPDATE comment SET deleted_at = now(), version = version + 1 WHERE id = $1",
      [row.id],
    );
    await removeSearchDoc(client, "comment", row.id);
    await recordActivity(client, actor, {
      action: "comment_deleted",
      subjectType: row.subject_type,
      subjectId: row.subject_id,
      projectId: row.project_id,
      revisionRef: revisionId,
    });
    return { ok: true };
  },
});
