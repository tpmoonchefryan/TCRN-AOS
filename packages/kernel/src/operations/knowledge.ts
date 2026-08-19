import { Type } from "@sinclair/typebox";
import type pg from "pg";
import { newId, rankBetween } from "../../../store/src/ids.js";
import type { Actor } from "../actor.js";
import {
  changedFields,
  notifyWatchers,
  recordActivity,
  removeSearchDoc,
  upsertSearchDoc,
} from "../audit.js";
import { fail } from "../errors.js";
import {
  DEFAULT_RESPONSE_BUDGET_BYTES,
  decodeCursor,
  encodeCursor,
  enforceResponseBudget,
  filterDigest,
} from "../read.js";
import { defineOperation } from "../registry.js";

const PAGE_STATUSES = ["draft", "published", "archived"] as const;

/** Which records a page may be linked to. Closed on purpose: see SUBJECT_LOOKUP. */
const LINKABLE_SUBJECTS = ["work_item", "page", "project", "decision", "deliberation", "gate"] as const;

const SPACE_LIST_SCHEMA_VERSION = "aos.space.list.v1";
const SPACE_LIST_SORT_VERSION = "key-asc-id-asc-v1";
const PAGE_LIST_SCHEMA_VERSION = "aos.page.list.v1";
const PAGE_LIST_SORT_VERSION = "tree-path-asc-id-asc-v1";
const REVISION_LIST_SCHEMA_VERSION = "aos.page.revisions.v1";
const REVISION_LIST_SORT_VERSION = "revision-desc-v1";

const MS_PER_DAY = 86_400_000;
const REVISION_PREVIEW_CHARS = 400;
const SLUG_MAX_CHARS = 80;

const PageStatusEnum = Type.Union(PAGE_STATUSES.map((status) => Type.Literal(status)));
const SubjectTypeEnum = Type.Union(LINKABLE_SUBJECTS.map((subject) => Type.Literal(subject)));
const FreshnessEnum = Type.Union([
  Type.Literal("fresh"),
  Type.Literal("stale"),
  Type.Literal("unknown"),
]);

type Freshness = "fresh" | "stale" | "unknown";
type LinkableSubject = (typeof LINKABLE_SUBJECTS)[number];

const SpaceShape = Type.Object({
  id: Type.String(),
  key: Type.String(),
  name: Type.String(),
  descriptionMd: Type.String(),
  projectId: Type.Union([Type.String(), Type.Null()]),
  version: Type.Integer(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

const PageShape = Type.Object({
  id: Type.String(),
  spaceId: Type.String(),
  spaceKey: Type.String(),
  parentId: Type.Union([Type.String(), Type.Null()]),
  slug: Type.String(),
  title: Type.String(),
  bodyMd: Type.String(),
  status: Type.String(),
  position: Type.String(),
  createdBy: Type.Union([Type.String(), Type.Null()]),
  updatedBy: Type.Union([Type.String(), Type.Null()]),
  lastVerifiedAt: Type.Union([Type.String(), Type.Null()]),
  lastVerifiedBy: Type.Union([Type.String(), Type.Null()]),
  lastVerifiedByHandle: Type.Union([Type.String(), Type.Null()]),
  stalenessDays: Type.Union([Type.Integer(), Type.Null()]),
  freshness: FreshnessEnum,
  version: Type.Integer(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

/** A tree row. The body is deliberately absent: fifty pages of Markdown is not a list. */
const PageSummaryShape = Type.Object({
  id: Type.String(),
  parentId: Type.Union([Type.String(), Type.Null()]),
  depth: Type.Integer(),
  slug: Type.String(),
  title: Type.String(),
  status: Type.String(),
  position: Type.String(),
  freshness: FreshnessEnum,
  version: Type.Integer(),
  updatedAt: Type.String(),
});

interface SpaceRow {
  id: string;
  key: string;
  name: string;
  description_md: string;
  project_id: string | null;
  version: number;
  created_at: Date;
  updated_at: Date;
}

interface PageRow {
  id: string;
  space_id: string;
  space_key: string;
  space_project_id: string | null;
  parent_id: string | null;
  slug: string;
  title: string;
  body_md: string;
  status: string;
  position: string;
  created_by: string | null;
  updated_by: string | null;
  last_verified_at: Date | null;
  last_verified_by: string | null;
  last_verified_by_handle: string | null;
  staleness_days: number | null;
  version: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * Stated, never inferred.
 *
 * A page nobody has verified is "unknown", and that is a different answer from "fresh" —
 * rendering the two the same is how a document that has never been checked comes to look
 * checked. A verified page with no review window stated does not expire, because the
 * window is somebody's judgement and this code does not have one to offer.
 */
function freshnessOf(lastVerifiedAt: Date | null, stalenessDays: number | null, now: Date): Freshness {
  if (lastVerifiedAt === null) return "unknown";
  if (stalenessDays === null) return "fresh";
  return now.getTime() > lastVerifiedAt.getTime() + stalenessDays * MS_PER_DAY ? "stale" : "fresh";
}

function toSpaceShape(row: SpaceRow): Record<string, unknown> {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    descriptionMd: row.description_md,
    projectId: row.project_id,
    version: row.version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toPageShape(row: PageRow, now: Date): Record<string, unknown> {
  return {
    id: row.id,
    spaceId: row.space_id,
    spaceKey: row.space_key,
    parentId: row.parent_id,
    slug: row.slug,
    title: row.title,
    bodyMd: row.body_md,
    status: row.status,
    position: row.position,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    lastVerifiedAt: row.last_verified_at ? row.last_verified_at.toISOString() : null,
    lastVerifiedBy: row.last_verified_by,
    lastVerifiedByHandle: row.last_verified_by_handle,
    stalenessDays: row.staleness_days,
    freshness: freshnessOf(row.last_verified_at, row.staleness_days, now),
    version: row.version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const SELECT_SPACE = `
  SELECT id, key, name, description_md, project_id, version, created_at, updated_at
    FROM space
`;

const SELECT_PAGE = `
  SELECT p.id, p.space_id, s.key AS space_key, s.project_id AS space_project_id,
         p.parent_id, p.slug, p.title, p.body_md, p.status, p.position,
         p.created_by, p.updated_by, p.last_verified_at, p.last_verified_by,
         v.handle AS last_verified_by_handle, p.staleness_days,
         p.version, p.created_at, p.updated_at
    FROM page p
    JOIN space s ON s.id = p.space_id
    LEFT JOIN principal v ON v.id = p.last_verified_by
`;

async function loadSpace(client: pg.PoolClient, idOrKey: string): Promise<SpaceRow> {
  const result = await client.query<SpaceRow>(
    `${SELECT_SPACE} WHERE (id = $1 OR upper(key) = upper($1)) AND deleted_at IS NULL`,
    [idOrKey],
  );
  const row = result.rows[0];
  if (!row) fail("not_found", "No such space", { ref: idOrKey });
  return row;
}

async function loadPage(client: pg.PoolClient, pageId: string): Promise<PageRow> {
  const result = await client.query<PageRow>(
    `${SELECT_PAGE} WHERE p.id = $1 AND p.deleted_at IS NULL`,
    [pageId],
  );
  const row = result.rows[0];
  if (!row) fail("not_found", "No such page", { ref: pageId });
  return row;
}

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
 * A space either belongs to a project, whose roles then govern it, or it belongs to the
 * instance. There is no third place to look: an unattached space has no project_member
 * rows anywhere, so demanding a project role on one would leave an instance-wide handbook
 * editable by nobody, including whoever wrote it.
 */
function requireSpaceRole(
  actor: Actor,
  projectId: string | null,
  required: "viewer" | "contributor" | "maintainer" | "admin",
): void {
  if (projectId === null) return;
  requireProjectRole(actor, projectId, required);
}

/**
 * page_revision keeps title and body_md as real columns, not a json blob, so the shared
 * writeRevision — which inserts a `prev` jsonb — does not fit this table and would fail on
 * an undefined column. Revision N holds the content that stood while the page was at
 * version N, which is exactly what restore reads back.
 */
async function insertPageRevision(client: pg.PoolClient, row: PageRow, actor: Actor): Promise<string> {
  const id = newId("rv");
  await client.query(
    `INSERT INTO page_revision (id, page_id, revision, title, body_md, changed_by)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, row.id, row.version, row.title, row.body_md, actor.principalId || null],
  );
  return id;
}

async function refreshPageSearchDoc(client: pg.PoolClient, row: PageRow): Promise<void> {
  await upsertSearchDoc(client, {
    subjectType: "page",
    subjectId: row.id,
    projectId: row.space_project_id,
    spaceId: row.space_id,
    title: row.title,
    body: row.body_md,
    key: row.slug,
    status: row.status,
  });
}

function deriveSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX_CHARS)
    .replace(/-+$/g, "");
}

async function slugTaken(client: pg.PoolClient, spaceId: string, slug: string): Promise<boolean> {
  // Matches the partial unique index: a deleted page releases its slug.
  const result = await client.query(
    "SELECT 1 FROM page WHERE space_id = $1 AND slug = $2 AND deleted_at IS NULL",
    [spaceId, slug],
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * The index is the authority; these checks exist to answer with something better than a
 * constraint name, and to make the two cases behave differently. A slug the caller typed
 * is a request, so a collision is refused. A slug this code derived is a convenience, so a
 * collision is resolved rather than thrown back at someone who never asked for one.
 */
async function resolveSlug(
  client: pg.PoolClient,
  spaceId: string,
  pageId: string,
  title: string,
  explicit: string | undefined,
): Promise<string> {
  const suffix = pageId.slice(-8).toLowerCase();
  if (explicit !== undefined) {
    const wanted = deriveSlug(explicit);
    if (wanted === "") {
      fail("validation_failed", "That slug has no characters a URL can carry", { slug: explicit });
    }
    if (await slugTaken(client, spaceId, wanted)) {
      fail("duplicate_key", "Another page in this space already uses that slug", { slug: wanted });
    }
    return wanted;
  }
  // A Chinese title reduces to nothing under an ASCII slug rule. Refusing there would make
  // the product unusable in Chinese, so the id's tail stands in for a word the URL cannot
  // spell.
  const base = deriveSlug(title);
  if (base === "") return `p-${suffix}`;
  return (await slugTaken(client, spaceId, base)) ? `${base}-${suffix}` : base;
}

/** Append after the last sibling. One row written, no column renumbered. */
async function appendPosition(
  client: pg.PoolClient,
  spaceId: string,
  parentId: string | null,
): Promise<string> {
  const last = await client.query<{ position: string }>(
    `SELECT position FROM page
      WHERE space_id = $1 AND parent_id IS NOT DISTINCT FROM $2 AND deleted_at IS NULL
      ORDER BY position DESC LIMIT 1`,
    [spaceId, parentId],
  );
  return rankBetween(last.rows[0]?.position ?? null, null);
}

/**
 * One statement per linkable type, written out rather than assembled from the subject_type
 * string, because a table name interpolated from input is a table name the caller chose.
 * Each returns the project the subject belongs to, so linking cannot be used to probe for
 * records in projects the caller cannot open.
 */
const SUBJECT_LOOKUP: Record<LinkableSubject, string> = {
  work_item: "SELECT project_id FROM work_item WHERE id = $1 AND deleted_at IS NULL",
  page: `SELECT s.project_id FROM page p JOIN space s ON s.id = p.space_id
          WHERE p.id = $1 AND p.deleted_at IS NULL`,
  project: "SELECT id AS project_id FROM project WHERE id = $1 AND deleted_at IS NULL",
  decision: "SELECT project_id FROM decision WHERE id = $1",
  deliberation: "SELECT project_id FROM deliberation WHERE id = $1",
  gate: "SELECT project_id FROM gate WHERE id = $1",
};

export const createSpace = defineOperation({
  id: "space.create",
  kind: "command",
  summary: "Create a knowledge space",
  input: Type.Object({
    key: Type.String({ minLength: 1, maxLength: 12, pattern: "^[A-Za-z][A-Za-z0-9]*$" }),
    name: Type.String({ minLength: 1, maxLength: 200 }),
    descriptionMd: Type.Optional(Type.String({ maxLength: 20_000, default: "" })),
    projectId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  }),
  output: SpaceShape,
  // Not the { project } form: projectId is optional here, and dispatch's from:"input"
  // refuses a request that names no project — which would make an instance-wide space
  // impossible to create at all.
  requires: "authenticated",
  http: { method: "POST", path: "/api/v1/spaces" },
  mcp: { tool: "aos_space_create" },
  ui: { route: "/spaces", control: "space.create" },
  handler: async ({ client, actor }, input) => {
    const projectId = input.projectId ?? null;
    if (projectId !== null) {
      const project = await client.query(
        "SELECT 1 FROM project WHERE id = $1 AND deleted_at IS NULL",
        [projectId],
      );
      if (project.rowCount === 0) fail("not_found", "No such project");
      requireProjectRole(actor, projectId, "maintainer");
    }

    const id = newId("sp");
    const key = input.key.toUpperCase();
    const result = await client.query<{ created_at: Date; updated_at: Date }>(
      `INSERT INTO space (id, key, name, description_md, project_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING created_at, updated_at`,
      [id, key, input.name, input.descriptionMd ?? "", projectId],
    );
    await recordActivity(client, actor, {
      action: "created",
      subjectType: "space",
      subjectId: id,
      projectId,
    });
    await upsertSearchDoc(client, {
      subjectType: "space",
      subjectId: id,
      projectId,
      spaceId: id,
      title: `${key} ${input.name}`,
      body: input.descriptionMd ?? "",
      key,
    });
    return {
      id,
      key,
      name: input.name,
      descriptionMd: input.descriptionMd ?? "",
      projectId,
      version: 1,
      createdAt: result.rows[0]!.created_at.toISOString(),
      updatedAt: result.rows[0]!.updated_at.toISOString(),
    };
  },
});

export const listSpaces = defineOperation({
  id: "space.list",
  kind: "query",
  summary: "List knowledge spaces you can see",
  input: Type.Object({
    projectId: Type.Optional(Type.String()),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200, default: 50 })),
    cursor: Type.Optional(Type.String()),
  }),
  output: Type.Object({
    items: Type.Array(Type.Intersect([SpaceShape, Type.Object({ pageCount: Type.Integer() })])),
    nextCursor: Type.Union([Type.String(), Type.Null()]),
    total: Type.Integer(),
    truncated: Type.Boolean(),
  }),
  requires: "authenticated",
  http: { method: "GET", path: "/api/v1/spaces" },
  mcp: { tool: "aos_space_list" },
  ui: { route: "/spaces", control: "space.list" },
  byteBudget: DEFAULT_RESPONSE_BUDGET_BYTES,
  handler: async ({ client, actor }, input) => {
    const limit = input.limit ?? 50;
    const digest = filterDigest({ projectId: input.projectId });

    const where: string[] = ["s.deleted_at IS NULL"];
    const params: unknown[] = [];
    const push = (value: unknown): string => {
      params.push(value);
      return `$${params.length}`;
    };

    // An unattached space is instance-wide and everyone signed in sees it; a project's
    // space follows that project's membership.
    if (!actor.isInstanceAdmin) {
      where.push(
        `(s.project_id IS NULL OR s.project_id IN
            (SELECT project_id FROM project_member WHERE principal_id = ${push(actor.principalId)}))`,
      );
    }
    if (input.projectId) where.push(`s.project_id = ${push(input.projectId)}`);

    const whereSql = where.join(" AND ");
    const totalResult = await client.query<{ count: string }>(
      `SELECT count(*) AS count FROM space s WHERE ${whereSql}`,
      [...params],
    );
    const total = Number(totalResult.rows[0]?.count ?? 0);

    if (input.cursor) {
      const cursor = decodeCursor(input.cursor, {
        schemaVersion: SPACE_LIST_SCHEMA_VERSION,
        sortVersion: SPACE_LIST_SORT_VERSION,
        filterDigest: digest,
        limit,
      });
      where.push(`(s.key, s.id) > (${push(cursor.last.sortKey)}, ${push(cursor.last.id)})`);
    }

    const rows = await client.query<SpaceRow & { page_count: string }>(
      `SELECT s.id, s.key, s.name, s.description_md, s.project_id, s.version,
              s.created_at, s.updated_at,
              (SELECT count(*) FROM page p WHERE p.space_id = s.id AND p.deleted_at IS NULL) AS page_count
         FROM space s
        WHERE ${where.join(" AND ")}
        ORDER BY s.key ASC, s.id ASC
        LIMIT ${push(limit + 1)}`,
      params,
    );

    const page = rows.rows.slice(0, limit);
    const hasMore = rows.rows.length > limit;
    const last = page.at(-1);
    const nextCursor =
      hasMore && last
        ? encodeCursor({
            schemaVersion: SPACE_LIST_SCHEMA_VERSION,
            sortVersion: SPACE_LIST_SORT_VERSION,
            filterDigest: digest,
            limit,
            last: { sortKey: last.key, id: last.id },
          })
        : null;

    const body = {
      items: page.map((row) => ({ ...toSpaceShape(row), pageCount: Number(row.page_count) })),
      nextCursor,
      total,
      truncated: hasMore,
    };
    return enforceResponseBudget(body, DEFAULT_RESPONSE_BUDGET_BYTES, total) as never;
  },
});

export const createPage = defineOperation({
  id: "page.create",
  kind: "command",
  summary: "Create a page in a space",
  input: Type.Object({
    spaceId: Type.String({ minLength: 1 }),
    title: Type.String({ minLength: 1, maxLength: 400 }),
    bodyMd: Type.Optional(Type.String({ maxLength: 400_000, default: "" })),
    parentId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    slug: Type.Optional(Type.String({ minLength: 1, maxLength: 120 })),
  }),
  output: PageShape,
  requires: "authenticated",
  http: { method: "POST", path: "/api/v1/pages" },
  mcp: { tool: "aos_page_create" },
  ui: { route: "/pages/new", control: "page.create" },
  handler: async ({ client, actor, now }, input) => {
    const space = await loadSpace(client, input.spaceId);
    requireSpaceRole(actor, space.project_id, "contributor");

    const parentId = input.parentId ?? null;
    if (parentId !== null) {
      const parent = await client.query<{ space_id: string }>(
        "SELECT space_id FROM page WHERE id = $1 AND deleted_at IS NULL",
        [parentId],
      );
      const parentSpace = parent.rows[0]?.space_id;
      if (!parentSpace) fail("not_found", "No such parent page");
      if (parentSpace !== space.id) {
        fail("validation_failed", "A page's parent must be in the same space");
      }
    }

    const id = newId("pg");
    const slug = await resolveSlug(client, space.id, id, input.title, input.slug);
    const position = await appendPosition(client, space.id, parentId);

    await client.query(
      `INSERT INTO page (id, space_id, parent_id, slug, title, body_md, position, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
      [id, space.id, parentId, slug, input.title, input.bodyMd ?? "", position, actor.principalId],
    );
    // The author watches what they wrote; otherwise nobody hears when their own page is
    // edited out from under them.
    await client.query(
      "INSERT INTO watcher (subject_type, subject_id, principal_id) VALUES ('page', $1, $2) ON CONFLICT DO NOTHING",
      [id, actor.principalId],
    );
    await recordActivity(client, actor, {
      action: "created",
      subjectType: "page",
      subjectId: id,
      projectId: space.project_id,
    });
    const row = await loadPage(client, id);
    await refreshPageSearchDoc(client, row);
    return toPageShape(row, now) as never;
  },
});

export const getPage = defineOperation({
  id: "page.get",
  kind: "query",
  summary: "Read one page with its freshness, breadcrumb and links",
  input: Type.Object({ pageId: Type.String({ minLength: 1 }) }),
  output: Type.Intersect([
    PageShape,
    Type.Object({
      ancestors: Type.Array(Type.Object({ id: Type.String(), slug: Type.String(), title: Type.String() })),
      children: Type.Array(
        Type.Object({ id: Type.String(), slug: Type.String(), title: Type.String(), status: Type.String() }),
      ),
      links: Type.Array(
        Type.Object({
          subjectType: Type.String(),
          subjectId: Type.String(),
          label: Type.String(),
          createdAt: Type.String(),
        }),
      ),
    }),
  ]),
  requires: "authenticated",
  http: { method: "GET", path: "/api/v1/pages/{pageId}" },
  mcp: { tool: "aos_page_get" },
  ui: { route: "/pages/{pageId}", control: "page.get" },
  handler: async ({ client, actor, now }, input) => {
    const row = await loadPage(client, input.pageId);
    requireSpaceRole(actor, row.space_project_id, "viewer");

    const ancestors = await client.query<{ id: string; slug: string; title: string }>(
      `WITH RECURSIVE up AS (
         SELECT id, parent_id, slug, title, 0 AS depth FROM page WHERE id = $1
         UNION ALL
         SELECT p.id, p.parent_id, p.slug, p.title, up.depth + 1
           FROM page p JOIN up ON p.id = up.parent_id WHERE up.depth < 24
       )
       SELECT id, slug, title FROM up WHERE depth > 0 ORDER BY depth DESC`,
      [row.id],
    );

    const children = await client.query<{ id: string; slug: string; title: string; status: string }>(
      "SELECT id, slug, title, status FROM page WHERE parent_id = $1 AND deleted_at IS NULL ORDER BY position, id",
      [row.id],
    );

    // One row, read from either end: the work-item side reads this same table, so a link
    // made here shows up there without a second record to keep in step.
    const links = await client.query<{
      subject_type: string;
      subject_id: string;
      label: string;
      created_at: Date;
    }>(
      `SELECT l.subject_type, l.subject_id, l.created_at,
              coalesce(w.key || ' ' || w.title, other.title, pr.key || ' ' || pr.name,
                       d.title, dl.title, g.title, l.subject_id) AS label
         FROM page_subject_link l
         LEFT JOIN work_item w ON l.subject_type = 'work_item' AND w.id = l.subject_id
         LEFT JOIN page other ON l.subject_type = 'page' AND other.id = l.subject_id
         LEFT JOIN project pr ON l.subject_type = 'project' AND pr.id = l.subject_id
         LEFT JOIN decision d ON l.subject_type = 'decision' AND d.id = l.subject_id
         LEFT JOIN deliberation dl ON l.subject_type = 'deliberation' AND dl.id = l.subject_id
         LEFT JOIN gate g ON l.subject_type = 'gate' AND g.id = l.subject_id
        WHERE l.page_id = $1
        ORDER BY l.created_at, l.subject_id`,
      [row.id],
    );

    return {
      ...toPageShape(row, now),
      ancestors: ancestors.rows,
      children: children.rows,
      links: links.rows.map((link) => ({
        subjectType: link.subject_type,
        subjectId: link.subject_id,
        label: link.label,
        createdAt: link.created_at.toISOString(),
      })),
    } as never;
  },
});

export const listPages = defineOperation({
  id: "page.list",
  kind: "query",
  summary: "List a space's pages in tree order",
  input: Type.Object({
    spaceId: Type.String({ minLength: 1 }),
    parentId: Type.Optional(Type.String()),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 500, default: 100 })),
    cursor: Type.Optional(Type.String()),
  }),
  output: Type.Object({
    items: Type.Array(PageSummaryShape),
    nextCursor: Type.Union([Type.String(), Type.Null()]),
    total: Type.Integer(),
    truncated: Type.Boolean(),
  }),
  requires: "authenticated",
  http: { method: "GET", path: "/api/v1/pages" },
  mcp: { tool: "aos_page_list" },
  ui: { route: "/spaces/{spaceId}", control: "page.list" },
  byteBudget: DEFAULT_RESPONSE_BUDGET_BYTES,
  handler: async ({ client, actor, now }, input) => {
    const space = await loadSpace(client, input.spaceId);
    requireSpaceRole(actor, space.project_id, "viewer");

    const limit = input.limit ?? 100;
    const digest = filterDigest({ spaceId: space.id, parentId: input.parentId });

    const params: unknown[] = [];
    const push = (value: unknown): string => {
      params.push(value);
      return `$${params.length}`;
    };
    const spaceParam = push(space.id);
    const root = input.parentId ? `p.parent_id = ${push(input.parentId)}` : "p.parent_id IS NULL";

    // The path is the chain of sibling ranks, joined by a character that sorts below every
    // rank character, so a parent sorts immediately before its own subtree and a subtree
    // never interleaves with an uncle. The recursion needs no depth guard: parent_id is
    // assigned at create and never re-pointed, so every edge runs from a newer page to an
    // older one and a cycle cannot exist.
    const treeSql = `
      WITH RECURSIVE tree AS (
        SELECT p.id, p.parent_id, p.slug, p.title, p.status, p.position, p.version,
               p.last_verified_at, p.staleness_days, p.updated_at,
               1 AS depth, p.position AS path
          FROM page p
         WHERE p.space_id = ${spaceParam} AND p.deleted_at IS NULL AND ${root}
        UNION ALL
        SELECT c.id, c.parent_id, c.slug, c.title, c.status, c.position, c.version,
               c.last_verified_at, c.staleness_days, c.updated_at,
               t.depth + 1, t.path || '/' || c.position
          FROM page c JOIN tree t ON c.parent_id = t.id
         WHERE c.deleted_at IS NULL AND c.space_id = ${spaceParam}
      )`;

    const totalResult = await client.query<{ count: string }>(
      `${treeSql} SELECT count(*) AS count FROM tree`,
      [...params],
    );
    const total = Number(totalResult.rows[0]?.count ?? 0);

    let keyset = "";
    if (input.cursor) {
      const cursor = decodeCursor(input.cursor, {
        schemaVersion: PAGE_LIST_SCHEMA_VERSION,
        sortVersion: PAGE_LIST_SORT_VERSION,
        filterDigest: digest,
        limit,
      });
      keyset = `WHERE (path, id) > (${push(cursor.last.sortKey)}, ${push(cursor.last.id)})`;
    }

    const rows = await client.query<{
      id: string;
      parent_id: string | null;
      slug: string;
      title: string;
      status: string;
      position: string;
      version: number;
      last_verified_at: Date | null;
      staleness_days: number | null;
      updated_at: Date;
      depth: number;
      path: string;
    }>(
      `${treeSql}
       SELECT id, parent_id, slug, title, status, position, version,
              last_verified_at, staleness_days, updated_at, depth, path
         FROM tree ${keyset}
        ORDER BY path ASC, id ASC
        LIMIT ${push(limit + 1)}`,
      params,
    );

    const page = rows.rows.slice(0, limit);
    const hasMore = rows.rows.length > limit;
    const last = page.at(-1);
    const nextCursor =
      hasMore && last
        ? encodeCursor({
            schemaVersion: PAGE_LIST_SCHEMA_VERSION,
            sortVersion: PAGE_LIST_SORT_VERSION,
            filterDigest: digest,
            limit,
            last: { sortKey: last.path, id: last.id },
          })
        : null;

    const body = {
      items: page.map((row) => ({
        id: row.id,
        parentId: row.parent_id,
        depth: Number(row.depth),
        slug: row.slug,
        title: row.title,
        status: row.status,
        position: row.position,
        freshness: freshnessOf(row.last_verified_at, row.staleness_days, now),
        version: row.version,
        updatedAt: row.updated_at.toISOString(),
      })),
      nextCursor,
      total,
      truncated: hasMore,
    };
    return enforceResponseBudget(body, DEFAULT_RESPONSE_BUDGET_BYTES, total) as never;
  },
});

export const updatePage = defineOperation({
  id: "page.update",
  kind: "command",
  summary: "Edit a page's title or body",
  input: Type.Object({
    pageId: Type.String({ minLength: 1 }),
    expectedVersion: Type.Integer({ minimum: 1 }),
    title: Type.Optional(Type.String({ minLength: 1, maxLength: 400 })),
    bodyMd: Type.Optional(Type.String({ maxLength: 400_000 })),
  }),
  output: PageShape,
  requires: "authenticated",
  http: { method: "POST", path: "/api/v1/pages/{pageId}/update" },
  mcp: { tool: "aos_page_update" },
  ui: { route: "/pages/{pageId}", control: "page.update" },
  handler: async ({ client, actor, now }, input) => {
    const row = await loadPage(client, input.pageId);
    requireSpaceRole(actor, row.space_project_id, "contributor");
    if (row.version !== input.expectedVersion) {
      fail("stale_version", "Someone else changed this page while you were editing", {
        currentVersion: row.version,
        yourVersion: input.expectedVersion,
      });
    }

    const before = { title: row.title, bodyMd: row.body_md };
    const after = { title: input.title ?? row.title, bodyMd: input.bodyMd ?? row.body_md };
    const changed = changedFields(before, after);
    if (changed.length === 0) return toPageShape(row, now) as never;

    const revisionId = await insertPageRevision(client, row, actor);
    await client.query(
      `UPDATE page SET title = $1, body_md = $2, updated_by = $3,
              version = version + 1, updated_at = now()
        WHERE id = $4`,
      [after.title, after.bodyMd, actor.principalId, row.id],
    );
    await recordActivity(client, actor, {
      action: "updated",
      subjectType: "page",
      subjectId: row.id,
      projectId: row.space_project_id,
      fieldNames: changed,
      revisionRef: revisionId,
    });
    const updated = await loadPage(client, row.id);
    await refreshPageSearchDoc(client, updated);
    await notifyWatchers(client, actor, {
      subjectType: "page",
      subjectId: row.id,
      subjectLabel: updated.title,
      kind: "page_updated",
    });
    return toPageShape(updated, now) as never;
  },
});

export const publishPage = defineOperation({
  id: "page.publish",
  kind: "command",
  summary: "Publish a page, return it to draft, or archive it",
  input: Type.Object({
    pageId: Type.String({ minLength: 1 }),
    expectedVersion: Type.Integer({ minimum: 1 }),
    // The column allows three states and no other operation in this module reaches the
    // other two, so publish carries the whole move rather than leaving a third of the
    // column unreachable from the API.
    status: Type.Optional(PageStatusEnum),
  }),
  output: PageShape,
  requires: "authenticated",
  http: { method: "POST", path: "/api/v1/pages/{pageId}/publish" },
  mcp: { tool: "aos_page_publish" },
  ui: { route: "/pages/{pageId}", control: "page.publish" },
  handler: async ({ client, actor, now }, input) => {
    const row = await loadPage(client, input.pageId);
    requireSpaceRole(actor, row.space_project_id, "contributor");
    if (row.version !== input.expectedVersion) {
      fail("stale_version", "Someone else changed this page while you were editing", {
        currentVersion: row.version,
        yourVersion: input.expectedVersion,
      });
    }
    const status = input.status ?? "published";
    if (row.status === status) return toPageShape(row, now) as never;

    // No before-image: page_revision has columns for title and body only, so a row written
    // here would record no part of what changed and would sit in the revision list as a
    // second copy of the text above it. What changed is in the activity entry.
    await client.query(
      "UPDATE page SET status = $1, updated_by = $2, version = version + 1, updated_at = now() WHERE id = $3",
      [status, actor.principalId, row.id],
    );
    await recordActivity(client, actor, {
      action: `status:${row.status}->${status}`,
      subjectType: "page",
      subjectId: row.id,
      projectId: row.space_project_id,
      fieldNames: ["status"],
    });
    await client.query(
      "UPDATE search_doc SET status = $1 WHERE subject_type = 'page' AND subject_id = $2",
      [status, row.id],
    );
    await notifyWatchers(client, actor, {
      subjectType: "page",
      subjectId: row.id,
      subjectLabel: row.title,
      kind: "page_published",
    });
    return toPageShape(await loadPage(client, row.id), now) as never;
  },
});

export const verifyPage = defineOperation({
  id: "page.verify",
  kind: "command",
  summary: "Record that someone checked this page and it is still correct",
  input: Type.Object({
    pageId: Type.String({ minLength: 1 }),
    expectedVersion: Type.Integer({ minimum: 1 }),
    stalenessDays: Type.Optional(Type.Integer({ minimum: 1, maximum: 3650 })),
  }),
  output: PageShape,
  requires: "authenticated",
  http: { method: "POST", path: "/api/v1/pages/{pageId}/verify" },
  mcp: { tool: "aos_page_verify" },
  ui: { route: "/pages/{pageId}", control: "page.verify" },
  handler: async ({ client, actor, now }, input) => {
    const row = await loadPage(client, input.pageId);
    requireSpaceRole(actor, row.space_project_id, "contributor");
    if (row.version !== input.expectedVersion) {
      fail("stale_version", "Someone else changed this page while you were editing", {
        currentVersion: row.version,
        yourVersion: input.expectedVersion,
      });
    }

    const fieldNames = ["lastVerifiedAt", "lastVerifiedBy"];
    if (input.stalenessDays !== undefined) fieldNames.push("stalenessDays");
    // An omitted window leaves the existing one alone. Verification is an assertion about
    // the text; how long that assertion should hold is a separate judgement, and stamping
    // one automatically is the inference this column exists to prevent.
    await client.query(
      `UPDATE page SET last_verified_at = now(), last_verified_by = $1,
              staleness_days = coalesce($2, staleness_days),
              version = version + 1, updated_at = now()
        WHERE id = $3`,
      [actor.principalId, input.stalenessDays ?? null, row.id],
    );
    await recordActivity(client, actor, {
      action: "verified",
      subjectType: "page",
      subjectId: row.id,
      projectId: row.space_project_id,
      fieldNames,
    });
    await notifyWatchers(client, actor, {
      subjectType: "page",
      subjectId: row.id,
      subjectLabel: row.title,
      kind: "page_verified",
    });
    return toPageShape(await loadPage(client, row.id), now) as never;
  },
});

export const listPageRevisions = defineOperation({
  id: "page.revisions",
  kind: "query",
  summary: "List a page's revisions, newest first",
  input: Type.Object({
    pageId: Type.String({ minLength: 1 }),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200, default: 50 })),
    cursor: Type.Optional(Type.String()),
  }),
  output: Type.Object({
    items: Type.Array(
      Type.Object({
        id: Type.String(),
        revision: Type.Integer(),
        title: Type.String(),
        bodyPreview: Type.String(),
        bodyChars: Type.Integer(),
        changedBy: Type.Union([Type.String(), Type.Null()]),
        changedByHandle: Type.Union([Type.String(), Type.Null()]),
        changedAt: Type.String(),
      }),
    ),
    nextCursor: Type.Union([Type.String(), Type.Null()]),
    total: Type.Integer(),
    truncated: Type.Boolean(),
  }),
  requires: "authenticated",
  http: { method: "GET", path: "/api/v1/pages/{pageId}/revisions" },
  mcp: { tool: "aos_page_revisions" },
  ui: { route: "/pages/{pageId}/revisions", control: "page.revisions" },
  byteBudget: DEFAULT_RESPONSE_BUDGET_BYTES,
  handler: async ({ client, actor }, input) => {
    const row = await loadPage(client, input.pageId);
    requireSpaceRole(actor, row.space_project_id, "viewer");

    const limit = input.limit ?? 50;
    const digest = filterDigest({ pageId: row.id });
    const params: unknown[] = [row.id];
    const push = (value: unknown): string => {
      params.push(value);
      return `$${params.length}`;
    };

    const totalResult = await client.query<{ count: string }>(
      "SELECT count(*) AS count FROM page_revision WHERE page_id = $1",
      [row.id],
    );
    const total = Number(totalResult.rows[0]?.count ?? 0);

    let keyset = "";
    if (input.cursor) {
      const cursor = decodeCursor(input.cursor, {
        schemaVersion: REVISION_LIST_SCHEMA_VERSION,
        sortVersion: REVISION_LIST_SORT_VERSION,
        filterDigest: digest,
        limit,
      });
      const at = Number(cursor.last.sortKey);
      if (!Number.isInteger(at)) fail("validation_failed", "That cursor is not readable", { cursor: "malformed" });
      // (page_id, revision) is unique, so the revision number alone is a complete keyset.
      keyset = `AND r.revision < ${push(at)}`;
    }

    // The bodies stay on the server. A revision list exists to choose one, and fifty
    // copies of a long page is megabytes spent on text nobody reads in this view.
    const rows = await client.query<{
      id: string;
      revision: number;
      title: string;
      body_preview: string;
      body_chars: number;
      changed_by: string | null;
      changed_by_handle: string | null;
      changed_at: Date;
    }>(
      `SELECT r.id, r.revision, r.title,
              left(r.body_md, ${REVISION_PREVIEW_CHARS}) AS body_preview,
              length(r.body_md) AS body_chars,
              r.changed_by, pc.handle AS changed_by_handle, r.changed_at
         FROM page_revision r
         LEFT JOIN principal pc ON pc.id = r.changed_by
        WHERE r.page_id = $1 ${keyset}
        ORDER BY r.revision DESC
        LIMIT ${push(limit + 1)}`,
      params,
    );

    const page = rows.rows.slice(0, limit);
    const hasMore = rows.rows.length > limit;
    const last = page.at(-1);
    const nextCursor =
      hasMore && last
        ? encodeCursor({
            schemaVersion: REVISION_LIST_SCHEMA_VERSION,
            sortVersion: REVISION_LIST_SORT_VERSION,
            filterDigest: digest,
            limit,
            last: { sortKey: String(last.revision), id: last.id },
          })
        : null;

    const body = {
      items: page.map((revision) => ({
        id: revision.id,
        revision: revision.revision,
        title: revision.title,
        bodyPreview: revision.body_preview,
        bodyChars: Number(revision.body_chars),
        changedBy: revision.changed_by,
        changedByHandle: revision.changed_by_handle,
        changedAt: revision.changed_at.toISOString(),
      })),
      nextCursor,
      total,
      truncated: hasMore,
    };
    return enforceResponseBudget(body, DEFAULT_RESPONSE_BUDGET_BYTES, total) as never;
  },
});

export const restorePageRevision = defineOperation({
  id: "page.restore_revision",
  kind: "command",
  summary: "Put an earlier revision's content back as a new edit",
  input: Type.Object({
    pageId: Type.String({ minLength: 1 }),
    revision: Type.Integer({ minimum: 1 }),
    expectedVersion: Type.Integer({ minimum: 1 }),
  }),
  output: PageShape,
  requires: "authenticated",
  http: { method: "POST", path: "/api/v1/pages/{pageId}/restore-revision" },
  mcp: { tool: "aos_page_restore_revision" },
  ui: { route: "/pages/{pageId}/revisions", control: "page.restore_revision" },
  handler: async ({ client, actor, now }, input) => {
    const row = await loadPage(client, input.pageId);
    requireSpaceRole(actor, row.space_project_id, "contributor");
    if (row.version !== input.expectedVersion) {
      fail("stale_version", "Someone else changed this page while you were editing", {
        currentVersion: row.version,
        yourVersion: input.expectedVersion,
      });
    }

    const found = await client.query<{ title: string; body_md: string }>(
      "SELECT title, body_md FROM page_revision WHERE page_id = $1 AND revision = $2",
      [row.id, input.revision],
    );
    const target = found.rows[0];
    if (!target) fail("not_found", "This page has no such revision", { revision: input.revision });

    const before = { title: row.title, bodyMd: row.body_md };
    const after = { title: target.title, bodyMd: target.body_md };
    const changed = changedFields(before, after);
    if (changed.length === 0) return toPageShape(row, now) as never;

    // A restore is an ordinary edit whose text happens to come from an old row. The old
    // revision is left exactly as it stands and a fresh before-image is written for the
    // version being replaced; rewriting history so the page looks like it was never wrong
    // destroys the record of what people were reading last week.
    const revisionId = await insertPageRevision(client, row, actor);
    await client.query(
      `UPDATE page SET title = $1, body_md = $2, updated_by = $3,
              version = version + 1, updated_at = now()
        WHERE id = $4`,
      [after.title, after.bodyMd, actor.principalId, row.id],
    );
    await recordActivity(client, actor, {
      action: `restored:${input.revision}`,
      subjectType: "page",
      subjectId: row.id,
      projectId: row.space_project_id,
      fieldNames: changed,
      revisionRef: revisionId,
    });
    const updated = await loadPage(client, row.id);
    await refreshPageSearchDoc(client, updated);
    await notifyWatchers(client, actor, {
      subjectType: "page",
      subjectId: row.id,
      subjectLabel: updated.title,
      kind: "page_restored",
    });
    return toPageShape(updated, now) as never;
  },
});

export const linkPage = defineOperation({
  id: "page.link",
  kind: "command",
  summary: "Link a page to a work item or another record",
  input: Type.Object({
    pageId: Type.String({ minLength: 1 }),
    subjectType: SubjectTypeEnum,
    subjectId: Type.String({ minLength: 1 }),
  }),
  output: Type.Object({ ok: Type.Boolean() }),
  requires: "authenticated",
  http: { method: "POST", path: "/api/v1/pages/{pageId}/links" },
  mcp: { tool: "aos_page_link" },
  ui: { route: "/pages/{pageId}", control: "page.link" },
  handler: async ({ client, actor }, input) => {
    const row = await loadPage(client, input.pageId);
    requireSpaceRole(actor, row.space_project_id, "contributor");
    if (input.subjectType === "page" && input.subjectId === row.id) {
      fail("validation_failed", "A page cannot link to itself");
    }

    const subject = await client.query<{ project_id: string | null }>(
      SUBJECT_LOOKUP[input.subjectType],
      [input.subjectId],
    );
    const found = subject.rows[0];
    if (!found) fail("not_found", "No such record to link to", { subjectType: input.subjectType });
    // Otherwise linking answers "does this id exist" for projects the caller cannot open.
    if (found.project_id !== null) requireProjectRole(actor, found.project_id, "viewer");

    await client.query(
      `INSERT INTO page_subject_link (page_id, subject_type, subject_id, created_by)
       VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [row.id, input.subjectType, input.subjectId, actor.principalId],
    );
    await recordActivity(client, actor, {
      action: `linked:${input.subjectType}`,
      subjectType: "page",
      subjectId: row.id,
      projectId: row.space_project_id,
      fieldNames: ["links"],
    });
    // The news is at the other end. Whoever is watching the ticket wants to know a page
    // now documents it; the person who made the link already knows.
    await notifyWatchers(client, actor, {
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      subjectLabel: row.title,
      kind: "page_linked",
    });
    return { ok: true };
  },
});

export const deletePage = defineOperation({
  id: "page.delete",
  kind: "command",
  summary: "Move a page to the trash",
  input: Type.Object({ pageId: Type.String({ minLength: 1 }) }),
  output: Type.Object({ ok: Type.Boolean() }),
  requires: "authenticated",
  http: { method: "POST", path: "/api/v1/pages/{pageId}/delete" },
  mcp: { tool: "aos_page_delete" },
  ui: { route: "/pages/{pageId}", control: "page.delete" },
  handler: async ({ client, actor }, input) => {
    const row = await loadPage(client, input.pageId);
    requireSpaceRole(actor, row.space_project_id, "maintainer");

    // A soft delete does not cascade, so deleting a parent would leave its children rooted
    // at a page the tree query can no longer reach — present in the table, absent from
    // every list, and findable only by search. Say so instead, and name them.
    const children = await client.query<{ id: string; title: string }>(
      "SELECT id, title FROM page WHERE parent_id = $1 AND deleted_at IS NULL ORDER BY position, id",
      [row.id],
    );
    if (children.rows.length > 0) {
      fail("conflict", "This page still has child pages; move or delete them first", {
        children: children.rows.map((child) => ({ id: child.id, title: child.title })),
      });
    }

    await client.query(
      "UPDATE page SET deleted_at = now(), version = version + 1 WHERE id = $1",
      [row.id],
    );
    await removeSearchDoc(client, "page", row.id);
    await recordActivity(client, actor, {
      action: "deleted",
      subjectType: "page",
      subjectId: row.id,
      projectId: row.space_project_id,
    });
    return { ok: true };
  },
});
