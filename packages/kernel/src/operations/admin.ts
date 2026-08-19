import { Type } from "@sinclair/typebox";
import type pg from "pg";
import { newId } from "../../../store/src/ids.js";
import { actorLabel, type Actor } from "../actor.js";
import { notifyWatchers, recordActivity, type PurgeTarget } from "../audit.js";
import { hashPassword } from "../auth.js";
import { fail } from "../errors.js";
import { decodeCursor, encodeCursor, enforceResponseBudget, filterDigest } from "../read.js";
import { defineOperation } from "../registry.js";

/**
 * Instance administration: accounts, the trash, erasure, and the activity stream.
 *
 * These four sit together because they are the operations that answer "who did this, and
 * can it be undone" — the trash and the stream are how a mistake is found, and erasure is
 * the one door out of the append-only tables. Nothing here is scoped to a project.
 */

const ACCOUNT_LIST_SCHEMA_VERSION = "aos.admin.accounts.v1";
const ACCOUNT_LIST_SORT_VERSION = "handle-asc-id-asc-v1";
const TRASH_LIST_SCHEMA_VERSION = "aos.trash.list.v1";
const TRASH_LIST_SORT_VERSION = "deleted-desc-id-desc-v1";
const ACTIVITY_LIST_SCHEMA_VERSION = "aos.activity.list.v1";
const ACTIVITY_LIST_SORT_VERSION = "id-desc-v1";

const LIST_BYTE_BUDGET = 512 * 1024;

const KINDS = ["human", "agent", "service"] as const;
const SUBJECT_TYPES = [
  "work_item", "page", "project", "space", "gate",
  "deliberation", "decision", "release", "principal", "comment", "attachment",
] as const;

const KindEnum = Type.Union(KINDS.map((kind) => Type.Literal(kind)));
const SubjectTypeEnum = Type.Union(SUBJECT_TYPES.map((name) => Type.Literal(name)));

const AccountShape = Type.Object({
  principalId: Type.String(),
  handle: Type.String(),
  displayName: Type.String(),
  email: Type.Union([Type.String(), Type.Null()]),
  kind: Type.String(),
  isInstanceAdmin: Type.Boolean(),
  mustChangePassword: Type.Boolean(),
  disabledAt: Type.Union([Type.String(), Type.Null()]),
  version: Type.Integer(),
  createdAt: Type.String(),
});

interface PrincipalRow {
  id: string;
  handle: string;
  display_name: string;
  email: string | null;
  kind: string;
  is_instance_admin: boolean;
  must_change_password: boolean;
  disabled_at: Date | null;
  version: number;
  created_at: Date;
}

// password_phc is absent from this projection on purpose: a column that is never selected
// cannot reach a response through a spread or a forgotten field in a later edit.
const SELECT_PRINCIPAL = `
  SELECT p.id, p.handle, p.display_name, p.email, p.kind, p.is_instance_admin,
         p.must_change_password, p.disabled_at, p.version, p.created_at
    FROM principal p
`;

function toAccount(row: PrincipalRow): Record<string, unknown> {
  return {
    principalId: row.id,
    handle: row.handle,
    displayName: row.display_name,
    email: row.email,
    kind: row.kind,
    isInstanceAdmin: row.is_instance_admin,
    mustChangePassword: row.must_change_password,
    disabledAt: row.disabled_at ? row.disabled_at.toISOString() : null,
    version: row.version,
    createdAt: row.created_at.toISOString(),
  };
}

async function loadPrincipal(client: pg.PoolClient, principalId: string): Promise<PrincipalRow> {
  const result = await client.query<PrincipalRow>(`${SELECT_PRINCIPAL} WHERE p.id = $1`, [principalId]);
  const row = result.rows[0];
  if (!row) fail("not_found", "No such account", { principalId });
  return row;
}

/**
 * Same shape as the work-item helper: the role is checked here, in the handler, because
 * dispatch can only read a project id the input literally carries and these operations
 * either carry it optionally or derive it from a subject.
 */
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

type Attribution = "principal" | "label_only" | "unknown";

/**
 * Three states, never a blank name.
 *
 * An id means the act is attributed to a principal — if the join beside it produced no
 * handle, that account is gone, which is a different fact from an unattributed act. A
 * label with no id is all that survives of an actor the directory no longer holds, and it
 * is shown as written. Neither is "unknown", said out loud rather than rendered as an
 * empty cell the reader has to guess at.
 */
function attribute(actorId: string | null, label: string | null): { attribution: Attribution; label: string } {
  if (actorId) return { attribution: "principal", label: label && label !== "" ? label : actorId };
  if (label && label !== "") return { attribution: "label_only", label };
  return { attribution: "unknown", label: "unknown" };
}

function toFieldNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((name): name is string => typeof name === "string");
}

export const createAccount = defineOperation({
  id: "admin.create_account",
  kind: "command",
  summary: "Create an account",
  input: Type.Object({
    handle: Type.String({ minLength: 1, maxLength: 64 }),
    displayName: Type.String({ minLength: 1, maxLength: 200 }),
    kind: KindEnum,
    email: Type.Optional(Type.Union([Type.String({ maxLength: 320 }), Type.Null()])),
    isInstanceAdmin: Type.Optional(Type.Boolean({ default: false })),
    password: Type.String({ minLength: 12, maxLength: 512 }),
  }),
  output: AccountShape,
  requires: "instance-admin",
  http: { method: "POST", path: "/api/v1/admin/accounts" },
  mcp: null,
  mcpExemptReason:
    "The request carries a plaintext password, and MCP payloads are transcribed into tool logs and conversation history by design. A token also must not be able to mint a second principal: that turns one leaked credential into permanent access no revocation reaches.",
  ui: { route: "/admin/accounts", control: "admin.create_account" },
  handler: async ({ client, actor }, input) => {
    const id = newId("pi");
    const phc = await hashPassword(input.password);
    // Handles are unique case-insensitively in the schema. Checking first and inserting
    // second is a race with a nicer error message; the constraint is the thing that is
    // actually true, so let it fire and be mapped to duplicate_key.
    const result = await client.query<PrincipalRow>(
      `INSERT INTO principal (id, handle, display_name, email, kind, password_phc, must_change_password, is_instance_admin)
       VALUES ($1, $2, $3, $4, $5, $6, true, $7)
       RETURNING id, handle, display_name, email, kind, is_instance_admin,
                 must_change_password, disabled_at, version, created_at`,
      [id, input.handle, input.displayName, input.email ?? null, input.kind, phc, input.isInstanceAdmin ?? false],
    );
    const row = result.rows[0]!;
    // must_change_password is set unconditionally: an administrator typed this password
    // and therefore knows it, so it is a handover credential, not yet the person's own.
    await recordActivity(client, actor, {
      action: "account_created",
      subjectType: "principal",
      subjectId: row.id,
    });
    // No search document. Nothing in this product indexes people, and a search_doc row
    // for a principal carries no project, so it would hand every handle, display name and
    // email to every signed-in user through the ordinary search box.
    return toAccount(row) as never;
  },
});

export const listAccounts = defineOperation({
  id: "admin.list_accounts",
  kind: "query",
  summary: "List accounts on this instance",
  input: Type.Object({
    q: Type.Optional(Type.String({ maxLength: 200 })),
    includeDisabled: Type.Optional(Type.Boolean({ default: true })),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200, default: 50 })),
    cursor: Type.Optional(Type.String()),
  }),
  output: Type.Object({
    items: Type.Array(AccountShape),
    nextCursor: Type.Union([Type.String(), Type.Null()]),
    total: Type.Integer(),
    truncated: Type.Boolean(),
  }),
  requires: "instance-admin",
  http: { method: "GET", path: "/api/v1/admin/accounts" },
  mcp: { tool: "aos_admin_list_accounts" },
  ui: { route: "/admin/accounts", control: "admin.list_accounts" },
  byteBudget: LIST_BYTE_BUDGET,
  handler: async ({ client }, input) => {
    const limit = input.limit ?? 50;
    const includeDisabled = input.includeDisabled ?? true;
    const digest = filterDigest({ q: input.q, includeDisabled });

    const where: string[] = [];
    const params: unknown[] = [];
    const push = (value: unknown): string => {
      params.push(value);
      return `$${params.length}`;
    };

    if (!includeDisabled) where.push("p.disabled_at IS NULL");
    if (input.q) {
      // A raw % or _ from the search box is a LIKE wildcard. An unescaped _ matches any
      // single character, so the search returns a different account and looks correct.
      const like = `%${input.q.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
      const value = push(like);
      where.push(`(p.handle ILIKE ${value} OR p.display_name ILIKE ${value} OR coalesce(p.email, '') ILIKE ${value})`);
    }

    // The count is taken over the filters ALONE. Folding the cursor predicate in as well
    // would make the total shrink as the caller pages through it, which reads as rows
    // disappearing rather than as a page boundary.
    const filterWhere = where.length > 0 ? where.join(" AND ") : "TRUE";
    const filterParams = params.slice();
    const totalResult = await client.query<{ count: string }>(
      `SELECT count(*) AS count FROM principal p WHERE ${filterWhere}`,
      filterParams,
    );
    const total = Number(totalResult.rows[0]?.count ?? 0);

    const pageWhere = where.slice();
    if (input.cursor) {
      const cursor = decodeCursor(input.cursor, {
        schemaVersion: ACCOUNT_LIST_SCHEMA_VERSION,
        sortVersion: ACCOUNT_LIST_SORT_VERSION,
        filterDigest: digest,
        limit,
      });
      pageWhere.push(`(lower(p.handle), p.id) > (${push(cursor.last.sortKey)}, ${push(cursor.last.id)})`);
    }

    // handle_key is selected rather than lowercased in JS: the cursor must be compared by
    // the same rule the ORDER BY uses, and Postgres's lower() and JavaScript's are not the
    // same function for every handle a person can type.
    const rows = await client.query<PrincipalRow & { handle_key: string }>(
      `SELECT p.id, p.handle, p.display_name, p.email, p.kind, p.is_instance_admin,
              p.must_change_password, p.disabled_at, p.version, p.created_at,
              lower(p.handle) AS handle_key
         FROM principal p
        WHERE ${pageWhere.length > 0 ? pageWhere.join(" AND ") : "TRUE"}
        ORDER BY lower(p.handle) ASC, p.id ASC
        LIMIT ${push(limit + 1)}`,
      params,
    );

    const page = rows.rows.slice(0, limit);
    const hasMore = rows.rows.length > limit;
    const last = page.at(-1);
    const nextCursor =
      hasMore && last
        ? encodeCursor({
            schemaVersion: ACCOUNT_LIST_SCHEMA_VERSION,
            sortVersion: ACCOUNT_LIST_SORT_VERSION,
            filterDigest: digest,
            limit,
            last: { sortKey: last.handle_key, id: last.id },
          })
        : null;

    const body = {
      items: page.map(toAccount),
      nextCursor,
      total,
      truncated: hasMore,
    };
    return enforceResponseBudget(body, LIST_BYTE_BUDGET, total) as never;
  },
});

export const setAccountDisabled = defineOperation({
  id: "admin.set_account_disabled",
  kind: "command",
  summary: "Disable or re-enable an account",
  input: Type.Object({
    principalId: Type.String({ minLength: 1 }),
    // principal is a versioned row, so the edit carries the version it read. Two admins
    // toggling at once otherwise resolve to whoever wrote last, and the losing intent —
    // "this person's access ends now" — vanishes without anything going red.
    expectedVersion: Type.Integer({ minimum: 1 }),
    disabled: Type.Boolean(),
  }),
  output: AccountShape,
  requires: "instance-admin",
  http: { method: "POST", path: "/api/v1/admin/accounts/{principalId}/disabled" },
  mcp: { tool: "aos_admin_set_account_disabled" },
  ui: { route: "/admin/accounts/{principalId}", control: "admin.set_account_disabled" },
  handler: async ({ client, actor }, input) => {
    const row = await loadPrincipal(client, input.principalId);
    if (row.version !== input.expectedVersion) {
      fail("stale_version", "Someone else changed this account while you were editing", {
        currentVersion: row.version,
        yourVersion: input.expectedVersion,
      });
    }
    const alreadyDisabled = row.disabled_at !== null;
    if (alreadyDisabled === input.disabled) return toAccount(row) as never;

    if (input.disabled && row.is_instance_admin) {
      const others = await client.query<{ count: string }>(
        "SELECT count(*) AS count FROM principal WHERE is_instance_admin AND disabled_at IS NULL AND id <> $1",
        [row.id],
      );
      // An instance whose last administrator is disabled can never be administered again,
      // and nothing inside the product can undo it.
      if (Number(others.rows[0]?.count ?? 0) === 0) {
        fail("conflict", "This is the last enabled instance administrator", { principalId: row.id });
      }
    }

    const updated = await client.query<PrincipalRow>(
      `UPDATE principal
          SET disabled_at = CASE WHEN $1 THEN now() ELSE NULL END,
              version = version + 1, updated_at = now()
        WHERE id = $2
       RETURNING id, handle, display_name, email, kind, is_instance_admin,
                 must_change_password, disabled_at, version, created_at`,
      [input.disabled, row.id],
    );
    // The account itself is never deleted. Activity rows carry actor_id, and a person's
    // history should not vanish from the record when their access does.
    //
    // Live sessions and tokens already stop working the moment disabled_at is set — both
    // resolvers refuse a disabled principal — so this sweep is not what ends the access.
    // It is what stops re-enabling the account from resurrecting sessions minted before
    // it was disabled.
    if (input.disabled) {
      await client.query(
        "UPDATE session SET revoked_at = now() WHERE principal_id = $1 AND revoked_at IS NULL",
        [row.id],
      );
    }
    // Field names here are the principal's own column names, matching what
    // auth.change_password already writes, so one query over the stream finds every
    // credential and access change rather than two spellings of them.
    await recordActivity(client, actor, {
      action: input.disabled ? "account_disabled" : "account_enabled",
      subjectType: "principal",
      subjectId: row.id,
      fieldNames: ["disabled_at"],
    });
    await notifyWatchers(client, actor, {
      subjectType: "principal",
      subjectId: row.id,
      subjectLabel: row.handle,
      kind: input.disabled ? "account_disabled" : "account_enabled",
      extraPrincipalIds: [row.id],
    });
    return toAccount(updated.rows[0]!) as never;
  },
});

export const resetPassword = defineOperation({
  id: "admin.reset_password",
  kind: "command",
  summary: "Set a new password on someone else's account",
  input: Type.Object({
    principalId: Type.String({ minLength: 1 }),
    newPassword: Type.String({ minLength: 12, maxLength: 512 }),
  }),
  output: Type.Object({ ok: Type.Boolean(), sessionsRevoked: Type.Integer() }),
  requires: "instance-admin",
  http: { method: "POST", path: "/api/v1/admin/accounts/{principalId}/reset-password" },
  mcp: null,
  mcpExemptReason:
    "The request carries a plaintext password, which MCP transports and their logs are the wrong place to put. It is exempt for the same reason auth.change_password is.",
  ui: { route: "/admin/accounts/{principalId}", control: "admin.reset_password" },
  handler: async ({ client, actor }, input) => {
    // No expectedVersion, unlike the disable toggle: a reset overwrites the credential
    // wholesale rather than merging with a concurrent edit, and auth.change_password
    // already sets that precedent for a credential write.
    const row = await loadPrincipal(client, input.principalId);
    const phc = await hashPassword(input.newPassword);
    await client.query(
      `UPDATE principal
          SET password_phc = $1, must_change_password = true, version = version + 1, updated_at = now()
        WHERE id = $2`,
      [phc, row.id],
    );
    // A reset that leaves old sessions alive has not ended the access it was meant to
    // end: whoever is already signed in stays signed in, and the new password changes
    // nothing for them.
    const revoked = await client.query(
      "UPDATE session SET revoked_at = now() WHERE principal_id = $1 AND revoked_at IS NULL",
      [row.id],
    );
    // API tokens are deliberately left alone. They are a separate credential with their
    // own revocation, and silently killing an agent's token because a human forgot a
    // password breaks integrations for a reason nobody can see. Ending all access is what
    // disabling the account is for.
    await recordActivity(client, actor, {
      action: "password_reset",
      subjectType: "principal",
      subjectId: row.id,
      fieldNames: ["password_phc", "must_change_password"],
    });
    await notifyWatchers(client, actor, {
      subjectType: "principal",
      subjectId: row.id,
      subjectLabel: row.handle,
      kind: "password_reset",
      extraPrincipalIds: [row.id],
    });
    return { ok: true, sessionsRevoked: revoked.rowCount ?? 0 };
  },
});

/**
 * Both halves of the trash in one ordering.
 *
 * deleted_at is the sort key for both entity kinds, and the ids are prefixed ULIDs, so
 * comparing (deleted_at, id) across the union is still a total order — which is what the
 * keyset cursor below needs to be correct.
 */
const TRASHED_CTE = `
  WITH trashed AS (
    SELECT 'work_item'::text AS subject_type, w.id, w.key AS ref, w.title, w.project_id, w.deleted_at
      FROM work_item w
     WHERE w.deleted_at IS NOT NULL
    UNION ALL
    SELECT 'page'::text AS subject_type, k.id, k.slug AS ref, k.title, s.project_id, k.deleted_at
      FROM page k JOIN space s ON s.id = k.space_id
     WHERE k.deleted_at IS NOT NULL
  )
`;

const TrashItemShape = Type.Object({
  subjectType: Type.String(),
  subjectId: Type.String(),
  ref: Type.String(),
  title: Type.String(),
  projectId: Type.Union([Type.String(), Type.Null()]),
  deletedAt: Type.String(),
  deletedById: Type.Union([Type.String(), Type.Null()]),
  deletedByLabel: Type.String(),
  deletedByAttribution: Type.String(),
});

interface TrashRow {
  subject_type: string;
  id: string;
  ref: string;
  title: string;
  project_id: string | null;
  deleted_at: Date;
  actor_id: string | null;
  actor_label: string | null;
}

export const listTrash = defineOperation({
  id: "trash.list",
  kind: "query",
  summary: "List deleted work items and pages, with who deleted them",
  input: Type.Object({
    projectId: Type.Optional(Type.String()),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200, default: 50 })),
    cursor: Type.Optional(Type.String()),
  }),
  output: Type.Object({
    items: Type.Array(TrashItemShape),
    nextCursor: Type.Union([Type.String(), Type.Null()]),
    total: Type.Integer(),
    truncated: Type.Boolean(),
  }),
  // Not the { project } form: projectId is optional here, and dispatch refuses an
  // operation that declares it and then does not carry one.
  requires: "authenticated",
  http: { method: "GET", path: "/api/v1/trash" },
  mcp: { tool: "aos_trash_list" },
  ui: { route: "/trash", control: "trash.list" },
  byteBudget: LIST_BYTE_BUDGET,
  handler: async ({ client, actor }, input) => {
    const limit = input.limit ?? 50;
    const digest = filterDigest({ projectId: input.projectId });

    const where: string[] = [];
    const params: unknown[] = [];
    const push = (value: unknown): string => {
      params.push(value);
      return `$${params.length}`;
    };

    if (input.projectId) {
      requireProjectRole(actor, input.projectId, "viewer");
      where.push(`t.project_id = ${push(input.projectId)}`);
    } else if (!actor.isInstanceAdmin) {
      // A work item always has a project; only a page in a space that belongs to none
      // lands here with a null. Such a space is instance-wide — that is the only reading
      // under which a project-less space is reachable at all — so its pages stay visible.
      const me = push(actor.principalId);
      where.push(
        `(t.project_id IN (SELECT project_id FROM project_member WHERE principal_id = ${me})
          OR t.project_id IS NULL)`,
      );
    }

    const filterWhere = where.length > 0 ? where.join(" AND ") : "TRUE";
    const filterParams = params.slice();
    const totalResult = await client.query<{ count: string }>(
      `${TRASHED_CTE} SELECT count(*) AS count FROM trashed t WHERE ${filterWhere}`,
      filterParams,
    );
    const total = Number(totalResult.rows[0]?.count ?? 0);

    const pageWhere = where.slice();
    if (input.cursor) {
      const cursor = decodeCursor(input.cursor, {
        schemaVersion: TRASH_LIST_SCHEMA_VERSION,
        sortVersion: TRASH_LIST_SORT_VERSION,
        filterDigest: digest,
        limit,
      });
      pageWhere.push(
        `(t.deleted_at, t.id) < (${push(cursor.last.sortKey)}::timestamptz, ${push(cursor.last.id)})`,
      );
    }

    // Who deleted it comes from the activity stream, not from a deleted_by column: the
    // stream is the record of who did what, and a second copy on the row is a second copy
    // to keep true. The latest matching event wins, ordered by id — two events in the
    // same millisecond have no defined order by timestamp.
    const rows = await client.query<TrashRow>(
      `${TRASHED_CTE}
       SELECT t.subject_type, t.id, t.ref, t.title, t.project_id, t.deleted_at,
              a.actor_id, a.actor_label
         FROM trashed t
         LEFT JOIN LATERAL (
           SELECT e.actor_id, e.actor_label
             FROM activity_event e
            WHERE e.subject_type = t.subject_type AND e.subject_id = t.id AND e.action = 'deleted'
            ORDER BY e.id DESC
            LIMIT 1
         ) a ON true
        WHERE ${pageWhere.length > 0 ? pageWhere.join(" AND ") : "TRUE"}
        ORDER BY t.deleted_at DESC, t.id DESC
        LIMIT ${push(limit + 1)}`,
      params,
    );

    const page = rows.rows.slice(0, limit);
    const hasMore = rows.rows.length > limit;
    const last = page.at(-1);
    const nextCursor =
      hasMore && last
        ? encodeCursor({
            schemaVersion: TRASH_LIST_SCHEMA_VERSION,
            sortVersion: TRASH_LIST_SORT_VERSION,
            filterDigest: digest,
            limit,
            last: { sortKey: last.deleted_at.toISOString(), id: last.id },
          })
        : null;

    const body = {
      items: page.map((row) => {
        const who = attribute(row.actor_id, row.actor_label);
        return {
          subjectType: row.subject_type,
          subjectId: row.id,
          ref: row.ref,
          title: row.title,
          projectId: row.project_id,
          deletedAt: row.deleted_at.toISOString(),
          deletedById: row.actor_id,
          deletedByLabel: who.label,
          deletedByAttribution: who.attribution,
        };
      }),
      nextCursor,
      total,
      truncated: hasMore,
    };
    return enforceResponseBudget(body, LIST_BYTE_BUDGET, total) as never;
  },
});

const PURGEABLE_SUBJECTS = ["work_item", "comment", "page"] as const;

/**
 * The three tables the purge trigger will release, and nothing else.
 *
 * A table name cannot be a bind parameter, so it has to be interpolated — which means it
 * has to come from a closed map keyed by the schema's own enum and never from the
 * request string.
 */
const PURGEABLE: Record<(typeof PURGEABLE_SUBJECTS)[number], PurgeTarget> = {
  work_item: { table: "work_item_revision", idColumn: "work_item_id" },
  comment: { table: "comment_revision", idColumn: "comment_id" },
  page: { table: "page_revision", idColumn: "page_id" },
};

export const purgeRevisions = defineOperation({
  id: "admin.purge_revisions",
  kind: "command",
  summary: "Erase the retained prior values of one subject",
  input: Type.Object({
    subjectType: Type.Union(PURGEABLE_SUBJECTS.map((name) => Type.Literal(name))),
    subjectId: Type.String({ minLength: 1 }),
    reason: Type.String({ minLength: 1, maxLength: 2000 }),
  }),
  output: Type.Object({
    rowsRemoved: Type.Integer(),
    journalId: Type.String(),
  }),
  requires: "instance-admin",
  http: { method: "POST", path: "/api/v1/admin/purge-revisions" },
  mcp: null,
  mcpExemptReason:
    "This is the one irreversible operation in the product: it destroys the only copy of prior values. It requires a person who can be asked why, not an agent acting on an instruction it read somewhere.",
  ui: { route: "/admin/erasure", control: "admin.purge_revisions" },
  handler: async ({ client, actor }, input) => {
    const target = PURGEABLE[input.subjectType];

    // `withPurgeTransaction` in the store package is this same act in the shape a caller
    // outside dispatch needs: open a transaction, set aos.purge, do the work. A handler is
    // already inside dispatch's transaction and is handed a client rather than a pool, so
    // calling it here would open a SECOND transaction on a SECOND connection — the delete
    // and its journal row would commit independently of the rest of this request, and the
    // two would contend for the same rows. The GUC is set on the ambient transaction
    // instead, which is the thing the trigger actually reads.
    await client.query("SET LOCAL aos.purge = 'on'");
    const removed = await client.query(
      `DELETE FROM ${target.table} WHERE ${target.idColumn} = $1`,
      [input.subjectId],
    );
    // Closed again immediately. Nothing later in this transaction — the idempotency
    // record, a retry, a future edit to this handler — inherits the exemption.
    await client.query("SET LOCAL aos.purge = 'off'");
    const rowsRemoved = removed.rowCount ?? 0;

    // purge_journal carries the unexempted trigger, so this row cannot itself be purged:
    // the erasure path is unable to erase its own trace. The activity events that pointed
    // at the deleted revisions keep pointing at ids that no longer resolve, and that is
    // the intended shape — the stream stays complete, the values are gone.
    const journal = await client.query<{ id: string }>(
      `INSERT INTO purge_journal (actor_label, reason, subject_type, subject_id, rows_removed)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [actorLabel(actor), input.reason, input.subjectType, input.subjectId, rowsRemoved],
    );
    await recordActivity(client, actor, {
      action: "revisions_purged",
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      fieldNames: ["revisions"],
    });
    return { rowsRemoved, journalId: String(journal.rows[0]!.id) };
  },
});

const ActivityShape = Type.Object({
  id: Type.String(),
  actorId: Type.Union([Type.String(), Type.Null()]),
  actorHandle: Type.Union([Type.String(), Type.Null()]),
  actorLabel: Type.String(),
  attribution: Type.Union([
    Type.Literal("principal"), Type.Literal("label_only"), Type.Literal("unknown"),
  ]),
  action: Type.String(),
  subjectType: Type.String(),
  subjectId: Type.String(),
  projectId: Type.Union([Type.String(), Type.Null()]),
  fieldNames: Type.Array(Type.String()),
  revisionRef: Type.Union([Type.String(), Type.Null()]),
  occurredAt: Type.String(),
});

interface ActivityRow {
  id: string;
  actor_id: string | null;
  actor_label: string | null;
  actor_handle: string | null;
  action: string;
  subject_type: string;
  subject_id: string;
  project_id: string | null;
  field_names: unknown;
  revision_ref: string | null;
  occurred_at: Date;
}

export const listActivity = defineOperation({
  id: "activity.list",
  kind: "query",
  summary: "Read the activity stream",
  input: Type.Object({
    subjectType: Type.Optional(SubjectTypeEnum),
    subjectId: Type.Optional(Type.String()),
    projectId: Type.Optional(Type.String()),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200, default: 50 })),
    cursor: Type.Optional(Type.String()),
  }),
  output: Type.Object({
    items: Type.Array(ActivityShape),
    nextCursor: Type.Union([Type.String(), Type.Null()]),
    truncated: Type.Boolean(),
  }),
  requires: "authenticated",
  http: { method: "GET", path: "/api/v1/activity" },
  mcp: { tool: "aos_activity_list" },
  ui: { route: "/activity", control: "activity.list" },
  byteBudget: LIST_BYTE_BUDGET,
  handler: async ({ client, actor }, input) => {
    const limit = input.limit ?? 50;
    if (input.subjectId && !input.subjectType) {
      // The index is on the pair. A subject id alone would scan the whole stream, and the
      // stream is the one table here that never stops growing.
      fail("validation_failed", "A subjectId filter must name its subjectType", {
        supported: ["subjectType + subjectId", "projectId"],
      });
    }
    const digest = filterDigest({
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      projectId: input.projectId,
    });

    const where: string[] = [];
    const params: unknown[] = [];
    const push = (value: unknown): string => {
      params.push(value);
      return `$${params.length}`;
    };

    if (input.projectId) {
      requireProjectRole(actor, input.projectId, "viewer");
      where.push(`a.project_id = ${push(input.projectId)}`);
    } else if (!actor.isInstanceAdmin) {
      // An event with no project is either instance administration or something about one
      // person — a sign-in, a password reset. The person it is about is the only
      // non-administrator who has any business reading it.
      const me = push(actor.principalId);
      where.push(
        `(a.project_id IN (SELECT project_id FROM project_member WHERE principal_id = ${me})
          OR a.actor_id = ${me}
          OR (a.subject_type = 'principal' AND a.subject_id = ${me}))`,
      );
    }
    if (input.subjectType) where.push(`a.subject_type = ${push(input.subjectType)}`);
    if (input.subjectId) where.push(`a.subject_id = ${push(input.subjectId)}`);

    if (input.cursor) {
      const cursor = decodeCursor(input.cursor, {
        schemaVersion: ACTIVITY_LIST_SCHEMA_VERSION,
        sortVersion: ACTIVITY_LIST_SORT_VERSION,
        filterDigest: digest,
        limit,
      });
      where.push(`a.id < ${push(cursor.last.id)}::bigint`);
    }

    // Ordered by id, never by occurred_at. The id is a monotonic sequence; two events
    // written in the same millisecond have no defined order by timestamp, and a keyset
    // page built on one would skip rows or repeat them.
    //
    // No total: a count over an append-only stream grows without bound and would cost
    // more than the page it describes. `truncated` still says whether more exists.
    const rows = await client.query<ActivityRow>(
      `SELECT a.id, a.actor_id, a.actor_label, p.handle AS actor_handle, a.action,
              a.subject_type, a.subject_id, a.project_id, a.field_names, a.revision_ref,
              a.occurred_at
         FROM activity_event a
         LEFT JOIN principal p ON p.id = a.actor_id
        WHERE ${where.length > 0 ? where.join(" AND ") : "TRUE"}
        ORDER BY a.id DESC
        LIMIT ${push(limit + 1)}`,
      params,
    );

    const page = rows.rows.slice(0, limit);
    const hasMore = rows.rows.length > limit;
    const last = page.at(-1);
    const nextCursor =
      hasMore && last
        ? encodeCursor({
            schemaVersion: ACTIVITY_LIST_SCHEMA_VERSION,
            sortVersion: ACTIVITY_LIST_SORT_VERSION,
            filterDigest: digest,
            limit,
            // The sequence is the whole sort key, so both cursor fields carry it.
            last: { sortKey: String(last.id), id: String(last.id) },
          })
        : null;

    const body = {
      items: page.map((row) => {
        const who = attribute(row.actor_id, row.actor_label);
        return {
          id: String(row.id),
          actorId: row.actor_id,
          actorHandle: row.actor_handle,
          actorLabel: who.label,
          attribution: who.attribution,
          action: row.action,
          subjectType: row.subject_type,
          subjectId: row.subject_id,
          projectId: row.project_id,
          fieldNames: toFieldNames(row.field_names),
          revisionRef: row.revision_ref,
          occurredAt: row.occurred_at.toISOString(),
        };
      }),
      nextCursor,
      truncated: hasMore,
    };
    return enforceResponseBudget(body, LIST_BYTE_BUDGET, page.length) as never;
  },
});
