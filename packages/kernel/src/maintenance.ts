import type pg from "pg";

export interface MaintenanceOutcome {
  readonly sessions: number;
  readonly idempotencyRecords: number;
  readonly notifications: number;
}

/**
 * Bound the three operational tables that are not audit history. Activity events remain
 * append-only by design; these rows are disposable delivery state and must not grow
 * without limit just because the instance has no separate scheduler.
 */
export async function pruneEphemeralState(pool: pg.Pool): Promise<MaintenanceOutcome> {
  const sessions = await pool.query(
    `DELETE FROM session
      WHERE (expires_at < now() AND expires_at < now() - interval '30 days')
         OR (revoked_at IS NOT NULL AND revoked_at < now() - interval '30 days')`,
  );
  const idempotencyRecords = await pool.query(
    "DELETE FROM idempotency_record WHERE created_at < now() - interval '7 days'",
  );
  const notifications = await pool.query(
    `DELETE FROM notification
      WHERE (read_at IS NOT NULL AND read_at < now() - interval '90 days')
         OR created_at < now() - interval '365 days'`,
  );
  return {
    sessions: sessions.rowCount ?? 0,
    idempotencyRecords: idempotencyRecords.rowCount ?? 0,
    notifications: notifications.rowCount ?? 0,
  };
}
