import type pg from "pg";
import { newId } from "../../store/src/ids.js";
import { analyze } from "../../store/src/search-text.js";
import { actorLabel, type Actor } from "./actor.js";

/**
 * A mutation is never one statement. It is the row, the before-image that says what the
 * row used to be, the activity entry that says who changed which fields, and the search
 * document that keeps the record findable. All four, in one transaction, or none.
 */

export type SubjectType =
  | "work_item" | "page" | "project" | "space" | "gate"
  | "deliberation" | "decision" | "release" | "principal"
  | "comment" | "attachment";

/**
 * Which revision table receives the before-image.
 *
 * `page_revision` is deliberately NOT here. It stores `title` and `body_md` as real
 * columns rather than a `prev` jsonb blob, so this generic writer would insert into a
 * column that does not exist — a runtime failure a type would otherwise have implied was
 * safe. Pages write their own before-image; see the knowledge operations.
 */
export interface RevisionTarget {
  readonly table: "work_item_revision" | "comment_revision";
  readonly idColumn: "work_item_id" | "comment_id";
}

/**
 * Every revision table, for the erasure path.
 *
 * Deleting from `page_revision` is perfectly valid — it is only WRITING to it through the
 * generic before-image writer that is not, because its columns differ. Two jobs, two
 * types: one type covering both is how `page_revision` came to look like a legal write
 * target in the first place.
 */
export interface PurgeTarget {
  readonly table: "work_item_revision" | "comment_revision" | "page_revision";
  readonly idColumn: "work_item_id" | "comment_id" | "page_id";
}

/** Field names whose values must never be written into a revision row. */
const NEVER_RETAINED = new Set(["password_phc", "token_sha256", "csrf_secret"]);

export function changedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): string[] {
  const names: string[] = [];
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const a = before[key];
    const b = after[key];
    if (a instanceof Date || b instanceof Date) {
      if (String(a) !== String(b)) names.push(key);
      continue;
    }
    if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) names.push(key);
  }
  return names.sort();
}

export async function writeRevision(
  client: pg.PoolClient,
  target: RevisionTarget,
  subjectId: string,
  revision: number,
  previous: Record<string, unknown>,
  actor: Actor,
): Promise<string> {
  const id = newId("rv");
  const retained: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(previous)) {
    if (!NEVER_RETAINED.has(key)) retained[key] = value;
  }
  await client.query(
    `INSERT INTO ${target.table} (id, ${target.idColumn}, revision, prev, changed_by)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, subjectId, revision, JSON.stringify(retained), actor.principalId || null],
  );
  return id;
}

export interface ActivityInput {
  readonly action: string;
  readonly subjectType: SubjectType;
  readonly subjectId: string;
  readonly projectId?: string | null;
  readonly fieldNames?: readonly string[];
  readonly revisionRef?: string | null;
}

/**
 * Record that something happened.
 *
 * Field NAMES go here; field VALUES do not. The values live only in the revision row
 * this points at, which is the split that lets an erasure request delete the values
 * while the immutable stream stays complete. An audit trail that stores the values
 * cannot answer an erasure request without breaking itself.
 */
export async function recordActivity(
  client: pg.PoolClient,
  actor: Actor,
  input: ActivityInput,
): Promise<void> {
  await client.query(
    `INSERT INTO activity_event
       (actor_id, actor_label, action, subject_type, subject_id, project_id, field_names, revision_ref, policy_version)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, (SELECT policy_version FROM instance_meta WHERE id = true))`,
    [
      actor.principalId || null,
      actorLabel(actor),
      input.action,
      input.subjectType,
      input.subjectId,
      input.projectId ?? null,
      JSON.stringify(input.fieldNames ?? []),
      input.revisionRef ?? null,
    ],
  );
}

export interface SearchDocInput {
  readonly subjectType: SubjectType;
  readonly subjectId: string;
  readonly projectId?: string | null;
  readonly spaceId?: string | null;
  readonly title: string;
  readonly body: string;
  readonly key?: string | null;
  readonly status?: string | null;
}

/** Title tokens weigh A and body tokens B, so a title match outranks a buried one. */
export async function upsertSearchDoc(client: pg.PoolClient, input: SearchDocInput): Promise<void> {
  const titleTokens = analyze(input.title).join(" ");
  const bodyTokens = analyze(input.body).join(" ");
  await client.query(
    `INSERT INTO search_doc (subject_type, subject_id, project_id, space_id, title, body_text, key, status, search_vec, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
             setweight(to_tsvector('simple', $9), 'A') || setweight(to_tsvector('simple', $10), 'B'),
             now())
     ON CONFLICT (subject_type, subject_id) DO UPDATE SET
       project_id = EXCLUDED.project_id,
       space_id   = EXCLUDED.space_id,
       title      = EXCLUDED.title,
       body_text  = EXCLUDED.body_text,
       key        = EXCLUDED.key,
       status     = EXCLUDED.status,
       search_vec = EXCLUDED.search_vec,
       updated_at = now()`,
    [
      input.subjectType,
      input.subjectId,
      input.projectId ?? null,
      input.spaceId ?? null,
      input.title,
      input.body,
      input.key ?? null,
      input.status ?? null,
      titleTokens,
      bodyTokens,
    ],
  );
}

export async function removeSearchDoc(
  client: pg.PoolClient,
  subjectType: SubjectType,
  subjectId: string,
): Promise<void> {
  await client.query("DELETE FROM search_doc WHERE subject_type = $1 AND subject_id = $2", [
    subjectType,
    subjectId,
  ]);
}

/**
 * Notify watchers of a subject, excluding whoever caused the event.
 *
 * Telling people about their own actions trains them to ignore the inbox, which costs
 * more than the notification was worth.
 */
export async function notifyWatchers(
  client: pg.PoolClient,
  actor: Actor,
  input: {
    readonly subjectType: SubjectType;
    readonly subjectId: string;
    readonly subjectLabel: string;
    readonly kind: string;
    readonly extraPrincipalIds?: readonly string[];
  },
): Promise<void> {
  const watchers = await client.query<{ principal_id: string }>(
    "SELECT principal_id FROM watcher WHERE subject_type = $1 AND subject_id = $2",
    [input.subjectType, input.subjectId],
  );
  const recipients = new Set<string>(watchers.rows.map((row) => row.principal_id));
  for (const id of input.extraPrincipalIds ?? []) recipients.add(id);
  recipients.delete(actor.principalId);
  if (recipients.size === 0) return;

  const values: unknown[] = [];
  const tuples: string[] = [];
  let index = 1;
  for (const principalId of recipients) {
    tuples.push(
      `($${index}, $${index + 1}, $${index + 2}, $${index + 3}, $${index + 4}, $${index + 5}, $${index + 6})`,
    );
    values.push(newId("nt"), principalId, input.kind, input.subjectType, input.subjectId, input.subjectLabel, actorLabel(actor));
    index += 7;
  }
  await client.query(
    `INSERT INTO notification (id, principal_id, kind, subject_type, subject_id, subject_label, actor_label)
     VALUES ${tuples.join(", ")}`,
    values,
  );
}
