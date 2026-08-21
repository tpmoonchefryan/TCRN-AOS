import pg from "pg";

export type Queryable = Pick<pg.PoolClient, "query">;

export interface StoreConfig {
  readonly connectionString: string;
  readonly maxConnections: number;
  readonly statementTimeoutMs: number;
}

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): StoreConfig {
  const connectionString =
    env.AOS_DATABASE_URL ??
    (env.PGHOST
      ? `postgres://${env.PGUSER ?? "postgres"}:${encodeURIComponent(env.PGPASSWORD ?? "")}@${env.PGHOST}:${env.PGPORT ?? "5432"}/${env.PGDATABASE ?? "aos"}`
      : undefined) ??
    "";
  if (!connectionString) {
    throw new Error("AOS_DATABASE_URL is not set and no PGHOST fallback is available");
  }
  return {
    connectionString,
    maxConnections: Number(env.AOS_DB_POOL_MAX ?? 10),
    statementTimeoutMs: Number(env.AOS_DB_STATEMENT_TIMEOUT_MS ?? 15_000),
  };
}

export function createPool(config: StoreConfig): pg.Pool {
  const pool = new pg.Pool({
    connectionString: config.connectionString,
    max: config.maxConnections,
    statement_timeout: config.statementTimeoutMs,
    application_name: "aos",
  });
  // A pool that throws on an idle client's error takes the process down for something
  // the request path never saw. Log it and let the pool replace the client.
  pool.on("error", (error) => {
    console.error(JSON.stringify({ level: "error", at: "pg.pool.idle", message: error.message }));
  });
  return pool;
}

/** Migrations use their own single connection without the request-pool statement timeout. */
export function createMigrationPool(config: StoreConfig): pg.Pool {
  return new pg.Pool({
    connectionString: config.connectionString,
    max: 1,
    application_name: "aos-migrations",
  });
}

/**
 * Run a unit of work in one transaction.
 *
 * Every mutation goes through here, because a mutation is never one statement: it is the
 * row, its before-image revision row, its activity event, and its search-document
 * refresh, and a partial one of those is worse than none.
 */
export async function withTransaction<T>(
  pool: pg.Pool,
  work: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // The rollback failing means the connection is already gone; the original error
      // is the one worth reporting.
    }
    throw error;
  } finally {
    client.release();
  }
}

/** A transaction permitted to delete revision rows. See `aos_append_only_purgeable`. */
export async function withPurgeTransaction<T>(
  pool: pg.Pool,
  work: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  return withTransaction(pool, async (client) => {
    await client.query("SET LOCAL aos.purge = 'on'");
    return work(client);
  });
}
