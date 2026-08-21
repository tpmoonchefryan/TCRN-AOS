import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type pg from "pg";
import { newId } from "../../store/src/ids.js";
import { ANONYMOUS, type Actor, type PrincipalKind, type ProjectRole } from "./actor.js";
import { fail } from "./errors.js";

// promisify's overload resolution picks the 3-argument form, which drops the cost
// parameters. Typed explicitly so N/r/p actually reach the KDF.
const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

// Chosen for a self-hosted single-node instance: ~64 MiB and ~100ms per verification on
// this class of machine. `scrypt` comes from the standard library, so the most sensitive
// path in the product carries no compiled native dependency and no supply chain of its
// own. argon2id is a deliberate deferral, not an oversight.
const SCRYPT_N = 1 << 15;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;

// Keep a real PHC for the missing-account branch. Passing null to verifyPassword used to
// return before scrypt ran, making account enumeration a timing oracle.
const DUMMY_PASSWORD_PHC =
  "scrypt$32768$8$1$YW9zLWR1bW15LXNhbHQtMQ==$15DrRliawxRUHymvhVA4rfuV2IjOFpvofocTakoeuZq7RQ1xs0MflgW2xLL51tr6lu8RqnG6wjJZC1IIIwBcJA==";

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 256 * 1024 * 1024,
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export async function verifyPassword(password: string, phc: string | null): Promise<boolean> {
  if (!phc) return false;
  const parts = phc.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  let derived: Buffer;
  try {
    derived = await scrypt(password, Buffer.from(saltB64!, "base64"), Buffer.from(hashB64!, "base64").length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 256 * 1024 * 1024,
    });
  } catch {
    return false;
  }
  const expected = Buffer.from(hashB64!, "base64");
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(expected, derived);
}

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function newOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export interface SessionIssue {
  readonly sessionId: string;
  readonly token: string;
  readonly csrfToken: string;
  readonly expiresAt: Date;
}

export async function issueSession(
  client: pg.PoolClient,
  principalId: string,
  options: { userAgent?: string; lifetimeHours?: number } = {},
): Promise<SessionIssue> {
  const token = newOpaqueToken();
  const csrfToken = newOpaqueToken();
  const id = newId("se");
  const expiresAt = new Date(Date.now() + (options.lifetimeHours ?? 24 * 14) * 3600 * 1000);
  await client.query(
    `INSERT INTO session (id, principal_id, token_sha256, csrf_secret, user_agent, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, principalId, sha256(token), csrfToken, options.userAgent ?? null, expiresAt],
  );
  return { sessionId: id, token, csrfToken, expiresAt };
}

export async function revokeSessionById(client: pg.PoolClient, sessionId: string): Promise<number> {
  const result = await client.query(
    "UPDATE session SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL",
    [sessionId],
  );
  return result.rowCount ?? 0;
}

interface PrincipalRow {
  id: string;
  handle: string;
  display_name: string;
  kind: PrincipalKind;
  is_instance_admin: boolean;
  disabled_at: Date | null;
  must_change_password: boolean;
}

async function loadRoles(
  queryable: Pick<pg.PoolClient, "query">,
  principalId: string,
): Promise<Map<string, ProjectRole>> {
  const result = await queryable.query<{ project_id: string; role: ProjectRole }>(
    "SELECT project_id, role FROM project_member WHERE principal_id = $1",
    [principalId],
  );
  return new Map(result.rows.map((row) => [row.project_id, row.role]));
}

function toActor(row: PrincipalRow, credential: Actor["credential"], roles: Map<string, ProjectRole>): Actor {
  return {
    principalId: row.id,
    handle: row.handle,
    displayName: row.display_name,
    kind: row.kind,
    isInstanceAdmin: row.is_instance_admin,
    credential,
    roles,
  };
}

/** Resolve a session cookie to an actor. Never reads identity from request content. */
export async function actorFromSessionToken(
  queryable: Pick<pg.PoolClient, "query">,
  token: string,
): Promise<{ actor: Actor; csrfSecret: string; mustChangePassword: boolean } | null> {
  const result = await queryable.query<PrincipalRow & { csrf_secret: string; session_id: string }>(
    `SELECT p.id, p.handle, p.display_name, p.kind, p.is_instance_admin, p.disabled_at,
            p.must_change_password, s.csrf_secret, s.id AS session_id
       FROM session s JOIN principal p ON p.id = s.principal_id
      WHERE s.token_sha256 = $1 AND s.revoked_at IS NULL AND s.expires_at > now()`,
    [sha256(token)],
  );
  const row = result.rows[0];
  if (!row || row.disabled_at) return null;
  const roles = await loadRoles(queryable, row.id);
  return {
    actor: { ...toActor(row, "session", roles), sessionId: row.session_id },
    csrfSecret: row.csrf_secret,
    mustChangePassword: row.must_change_password,
  };
}

/**
 * Resolve a personal access token to an actor.
 *
 * This is the only credential the MCP-over-HTTP surface accepts, which is what makes the
 * MCP face structurally unable to exceed what its principal could do through the API.
 */
export async function actorFromApiToken(
  queryable: Pick<pg.PoolClient, "query">,
  token: string,
): Promise<Actor | null> {
  const result = await queryable.query<PrincipalRow & { token_id: string }>(
    `SELECT p.id, p.handle, p.display_name, p.kind, p.is_instance_admin, p.disabled_at,
            p.must_change_password, t.id AS token_id
       FROM api_token t JOIN principal p ON p.id = t.principal_id
      WHERE t.token_sha256 = $1 AND t.revoked_at IS NULL
        AND (t.expires_at IS NULL OR t.expires_at > now())`,
    [sha256(token)],
  );
  const row = result.rows[0];
  if (!row || row.disabled_at) return null;
  await queryable.query("UPDATE api_token SET last_used_at = now() WHERE id = $1", [row.token_id]);
  const roles = await loadRoles(queryable, row.id);
  return toActor(row, "api_token", roles);
}

export async function authenticatePassword(
  client: pg.PoolClient,
  handle: string,
  password: string,
): Promise<Actor> {
  const result = await client.query<PrincipalRow & { password_phc: string | null }>(
    `SELECT id, handle, display_name, kind, is_instance_admin, disabled_at, must_change_password, password_phc
       FROM principal WHERE lower(handle) = lower($1)`,
    [handle],
  );
  const row = result.rows[0];
  // Verify against a fixed dummy hash when the account does not exist, so a missing account
  // and a wrong password take the same time to answer.
  const ok = await verifyPassword(password, row?.password_phc ?? DUMMY_PASSWORD_PHC);
  if (!row || !ok || row.disabled_at) {
    fail("unauthenticated", "That handle and password do not match an account");
  }
  const roles = await loadRoles(client, row.id);
  return toActor(row, "session", roles);
}

export { ANONYMOUS };

/** CSRF: the cookie's secret must match the form's hidden field, and Origin must agree. */
export function csrfOk(sessionSecret: string, submitted: unknown): boolean {
  if (typeof submitted !== "string" || submitted.length === 0) return false;
  const a = Buffer.from(sessionSecret);
  const b = Buffer.from(submitted);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
