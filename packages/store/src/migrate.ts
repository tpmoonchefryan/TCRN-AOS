import { createHash } from "node:crypto";
import type pg from "pg";
import { MIGRATIONS, type Migration } from "./migrations.generated.js";

// One fixed key for the whole schema. Two pods starting at once both try to migrate;
// the loser waits here rather than racing the winner statement by statement.
const ADVISORY_LOCK_KEY = 0xa05;

export interface MigrationOutcome {
  readonly applied: string[];
  readonly alreadyApplied: string[];
  readonly schemaVersion: string | null;
}

export function digestOf(sql: string): string {
  return createHash("sha256").update(sql, "utf8").digest("hex");
}

async function ensureJournal(client: pg.PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migration (
      version    text        PRIMARY KEY,
      digest     text        NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

/**
 * Apply every pending migration, in order, one transaction each.
 *
 * Postgres has transactional DDL, so a migration that fails half way leaves nothing
 * behind. There are no down-migrations: a mistake is corrected by a new forward
 * migration, because a down-migration is a second code path that only ever runs on the
 * worst day and is therefore the least tested code in the repository.
 */
export async function migrate(pool: pg.Pool): Promise<MigrationOutcome> {
  const client = await pool.connect();
  const applied: string[] = [];
  const alreadyApplied: string[] = [];
  try {
    await client.query("SELECT pg_advisory_lock($1)", [ADVISORY_LOCK_KEY]);
    await ensureJournal(client);

    const existing = await client.query<{ version: string; digest: string }>(
      "SELECT version, digest FROM schema_migration",
    );
    const seen = new Map(existing.rows.map((row) => [row.version, row.digest]));

    for (const migration of MIGRATIONS) {
      const recorded = seen.get(migration.version);
      if (recorded !== undefined) {
        // An already-applied migration whose bytes have since changed means the code and
        // the database disagree about what the schema IS. Refuse rather than guess.
        if (recorded !== migration.digest) {
          throw new Error(
            `AOS_MIGRATION_DIGEST_DRIFT: ${migration.version} was applied with digest ${recorded} but the shipped copy digests ${migration.digest}`,
          );
        }
        alreadyApplied.push(migration.version);
        continue;
      }
      await client.query("BEGIN");
      try {
        await client.query(migration.sql);
        await client.query("INSERT INTO schema_migration (version, digest) VALUES ($1, $2)", [
          migration.version,
          migration.digest,
        ]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(
          `AOS_MIGRATION_FAILED: ${migration.version}: ${(error as Error).message}`,
          { cause: error },
        );
      }
      applied.push(migration.version);
    }

    const last = MIGRATIONS.at(-1);
    return { applied, alreadyApplied, schemaVersion: last ? last.version : null };
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_KEY]).catch(() => undefined);
    client.release();
  }
}

/** What the running image believes the schema should be. Readiness compares against it. */
export function expectedSchemaVersion(): string | null {
  return MIGRATIONS.at(-1)?.version ?? null;
}

export async function appliedSchemaVersion(pool: pg.Pool): Promise<string | null> {
  const result = await pool.query<{ version: string }>(
    "SELECT version FROM schema_migration ORDER BY version DESC LIMIT 1",
  );
  return result.rows[0]?.version ?? null;
}

export type { Migration };
