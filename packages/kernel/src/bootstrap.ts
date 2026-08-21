import { randomBytes } from "node:crypto";
import type pg from "pg";
import { newId } from "../../store/src/ids.js";
import { hashPassword } from "./auth.js";

/**
 * First boot on an empty database.
 *
 * There are no default credentials, ever. The first administrator comes from a Secret the
 * operator created, and if none was provided the password is generated and printed once
 * to stdout — retrievable with `kubectl logs`, which requires cluster access, which is
 * the same authority that installed the instance.
 *
 * The account is created with must_change_password set, so the printed password buys
 * exactly one sign-in.
 */
export async function bootstrapIfEmpty(pool: pg.Pool, instanceName: string): Promise<void> {
  const existing = await pool.query<{ bootstrap_completed_at: Date | null }>(
    "SELECT bootstrap_completed_at FROM instance_meta WHERE id = true",
  );
  if (existing.rows[0]?.bootstrap_completed_at) return;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO instance_meta (id, instance_name) VALUES (true, $1)
       ON CONFLICT (id) DO NOTHING`,
      [instanceName],
    );

    const already = await client.query<{ count: string }>("SELECT count(*) AS count FROM principal");
    if (Number(already.rows[0]?.count ?? 0) > 0) {
      await client.query("UPDATE instance_meta SET bootstrap_completed_at = now() WHERE id = true");
      await client.query("COMMIT");
      return;
    }

    const handle = process.env.AOS_BOOTSTRAP_ADMIN_USER ?? "admin";
    const provided = process.env.AOS_BOOTSTRAP_ADMIN_PASSWORD;
    // A supplied password that is too short used to be silently swapped for a random one
    // that was then never printed, because the log branch keyed off whether a password was
    // provided rather than whether it was USED. The operator was left with an instance
    // holding a credential nobody had ever seen. Now the substitution is stated, and the
    // password that actually works is always the one printed.
    const providedIsUsable = typeof provided === "string" && provided.length >= 12;
    const substituted = typeof provided === "string" && !providedIsUsable;
    const password = providedIsUsable ? provided : randomBytes(18).toString("base64url");
    const id = newId("pi");

    await client.query(
      `INSERT INTO principal (id, handle, display_name, kind, password_phc, must_change_password, is_instance_admin)
       VALUES ($1, $2, $3, 'human', $4, true, true)`,
      [id, handle, handle, await hashPassword(password)],
    );
    await client.query("UPDATE instance_meta SET bootstrap_completed_at = now() WHERE id = true");
    await client.query("COMMIT");

    if (!providedIsUsable) {
      // Printed once, never stored in the clear, and only readable by whoever can read
      // this pod's logs.
      console.log(
        JSON.stringify({
          level: "warn",
          at: "bootstrap",
          message: substituted
            ? "AOS_BOOTSTRAP_ADMIN_PASSWORD was shorter than the 12-character minimum and was NOT used. This generated password is the one that works, it is shown once, and it must be changed at first sign-in."
            : "Created the first administrator. This password is shown once and must be changed at first sign-in.",
          handle,
          password,
          ...(substituted ? { suppliedPasswordRejected: "shorter than 12 characters" } : {}),
        }),
      );
    } else {
      console.log(
        JSON.stringify({ level: "info", at: "bootstrap", message: "Created the first administrator from the configured secret", handle }),
      );
    }
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
