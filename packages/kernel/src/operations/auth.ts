import { Type } from "@sinclair/typebox";
import { newId } from "../../../store/src/ids.js";
import { recordActivity } from "../audit.js";
import { authenticatePassword, hashPassword, issueSession, newOpaqueToken, revokeSessionById, sha256, verifyPassword } from "../auth.js";
import { fail } from "../errors.js";
import { defineOperation } from "../registry.js";

export const login = defineOperation({
  id: "auth.login",
  kind: "command",
  summary: "Sign in with a handle and password",
  input: Type.Object({
    handle: Type.String({ minLength: 1, maxLength: 64 }),
    password: Type.String({ minLength: 1, maxLength: 512 }),
  }),
  output: Type.Object({
    principalId: Type.String(),
    handle: Type.String(),
    displayName: Type.String(),
    sessionToken: Type.String(),
    csrfToken: Type.String(),
    mustChangePassword: Type.Boolean(),
  }),
  requires: "public",
  http: { method: "POST", path: "/api/v1/auth/login" },
  mcp: null,
  mcpExemptReason:
    "MCP clients present a personal access token. Exposing password login over MCP would create a second credential path to the same authority, and the weaker one would define the security of both.",
  ui: { route: "/login", control: "auth.login" },
  handler: async ({ client }, input) => {
    const actor = await authenticatePassword(client, input.handle, input.password);
    const session = await issueSession(client, actor.principalId);
    const row = await client.query<{ must_change_password: boolean }>(
      "SELECT must_change_password FROM principal WHERE id = $1",
      [actor.principalId],
    );
    await recordActivity(client, actor, {
      action: "signed_in",
      subjectType: "principal",
      subjectId: actor.principalId,
    });
    return {
      principalId: actor.principalId,
      handle: actor.handle,
      displayName: actor.displayName,
      sessionToken: session.token,
      csrfToken: session.csrfToken,
      mustChangePassword: row.rows[0]?.must_change_password ?? false,
    };
  },
});

export const logout = defineOperation({
  id: "auth.logout",
  kind: "command",
  summary: "Sign out of the current session",
  // Takes nothing. The session to end is the one the request arrived on, which the actor
  // already carries — asking the form to name it is what let a placeholder string be
  // submitted instead, revoking nothing while the browser dropped its cookie and everyone
  // believed they had signed out.
  input: Type.Object({}),
  output: Type.Object({ ok: Type.Boolean(), revoked: Type.Integer() }),
  requires: "authenticated",
  http: { method: "POST", path: "/api/v1/auth/logout" },
  mcp: null,
  mcpExemptReason: "Sessions are a browser concern; an MCP client revokes its token instead.",
  ui: { route: "/", control: "auth.logout" },
  handler: async ({ client, actor }) => {
    if (!actor.sessionId) {
      // A token-authenticated caller has no session to end. Say so rather than reporting
      // a success that did nothing.
      fail("validation_failed", "This credential is not a session; revoke the token instead");
    }
    const revoked = await revokeSessionById(client, actor.sessionId);
    return { ok: true, revoked };
  },
});

export const changePassword = defineOperation({
  id: "auth.change_password",
  kind: "command",
  summary: "Change your own password",
  input: Type.Object({
    currentPassword: Type.String({ minLength: 1, maxLength: 512 }),
    newPassword: Type.String({ minLength: 12, maxLength: 512 }),
  }),
  output: Type.Object({ ok: Type.Boolean() }),
  requires: "authenticated",
  http: { method: "POST", path: "/api/v1/auth/change-password" },
  mcp: null,
  mcpExemptReason: "A credential change is performed by the person who owns it, in the UI.",
  ui: { route: "/account/password", control: "auth.change_password" },
  handler: async ({ client, actor }, input) => {
    const row = await client.query<{ password_phc: string | null }>(
      "SELECT password_phc FROM principal WHERE id = $1",
      [actor.principalId],
    );
    const ok = await verifyPassword(input.currentPassword, row.rows[0]?.password_phc ?? null);
    if (!ok) fail("forbidden", "Your current password is not correct");
    const phc = await hashPassword(input.newPassword);
    await client.query(
      "UPDATE principal SET password_phc = $1, must_change_password = false, version = version + 1, updated_at = now() WHERE id = $2",
      [phc, actor.principalId],
    );
    // Every other session is dropped: a password change that leaves old sessions alive
    // does not actually end the access it was meant to end.
    await client.query(
      "UPDATE session SET revoked_at = now() WHERE principal_id = $1 AND revoked_at IS NULL",
      [actor.principalId],
    );
    await recordActivity(client, actor, {
      action: "changed_password",
      subjectType: "principal",
      subjectId: actor.principalId,
      fieldNames: ["password_phc"],
    });
    return { ok: true };
  },
});

export const whoAmI = defineOperation({
  id: "auth.me",
  kind: "query",
  summary: "Describe the signed-in principal",
  input: Type.Object({}),
  output: Type.Object({
    principalId: Type.String(),
    handle: Type.String(),
    displayName: Type.String(),
    kind: Type.String(),
    isInstanceAdmin: Type.Boolean(),
    credential: Type.String(),
    projects: Type.Array(Type.Object({ projectId: Type.String(), role: Type.String() })),
  }),
  requires: "authenticated",
  http: { method: "GET", path: "/api/v1/me" },
  mcp: { tool: "aos_whoami" },
  ui: { route: "/account", control: "auth.me" },
  handler: async ({ actor }) => ({
    principalId: actor.principalId,
    handle: actor.handle,
    displayName: actor.displayName,
    kind: actor.kind,
    isInstanceAdmin: actor.isInstanceAdmin,
    credential: actor.credential,
    projects: [...actor.roles.entries()].map(([projectId, role]) => ({ projectId, role })),
  }),
});

export const createApiToken = defineOperation({
  id: "auth.create_api_token",
  kind: "command",
  summary: "Mint a personal access token for API and MCP use",
  input: Type.Object({ name: Type.String({ minLength: 1, maxLength: 120 }) }),
  output: Type.Object({ id: Type.String(), token: Type.String(), hint: Type.String() }),
  requires: "authenticated",
  http: { method: "POST", path: "/api/v1/me/tokens" },
  mcp: null,
  mcpExemptReason:
    "A token cannot mint its own successor: that would let one leaked token become permanent access no revocation could reach.",
  ui: { route: "/account/tokens", control: "auth.create_api_token" },
  handler: async ({ client, actor }, input) => {
    const secret = `aos_pat_${newOpaqueToken()}`;
    const id = newId("tk");
    const hint = `${secret.slice(0, 12)}…${secret.slice(-4)}`;
    await client.query(
      "INSERT INTO api_token (id, principal_id, name, token_sha256, hint) VALUES ($1, $2, $3, $4, $5)",
      [id, actor.principalId, input.name, sha256(secret), hint],
    );
    await recordActivity(client, actor, {
      action: "created_api_token",
      subjectType: "principal",
      subjectId: actor.principalId,
    });
    // Returned once. Only its digest is stored, so this is the only moment it exists.
    return { id, token: secret, hint };
  },
});

export const listApiTokens = defineOperation({
  id: "auth.list_api_tokens",
  kind: "query",
  summary: "List your personal access tokens",
  input: Type.Object({}),
  output: Type.Object({
    items: Type.Array(
      Type.Object({
        id: Type.String(),
        name: Type.String(),
        hint: Type.String(),
        createdAt: Type.String(),
        lastUsedAt: Type.Union([Type.String(), Type.Null()]),
        revokedAt: Type.Union([Type.String(), Type.Null()]),
      }),
    ),
  }),
  requires: "authenticated",
  http: { method: "GET", path: "/api/v1/me/tokens" },
  mcp: { tool: "aos_list_api_tokens" },
  ui: { route: "/account/tokens", control: "auth.list_api_tokens" },
  handler: async ({ client, actor }) => {
    // Revoked tokens stay listed. A credential that vanishes when it is revoked leaves the
    // person wondering whether they revoked it or imagined it.
    const result = await client.query(
      `SELECT id, name, hint, created_at, last_used_at, revoked_at
         FROM api_token WHERE principal_id = $1 ORDER BY created_at DESC`,
      [actor.principalId],
    );
    return {
      items: result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        hint: row.hint,
        createdAt: row.created_at.toISOString(),
        lastUsedAt: row.last_used_at ? row.last_used_at.toISOString() : null,
        revokedAt: row.revoked_at ? row.revoked_at.toISOString() : null,
      })),
    };
  },
});

export const revokeApiToken = defineOperation({
  id: "auth.revoke_api_token",
  kind: "command",
  summary: "Revoke one of your personal access tokens",
  input: Type.Object({ id: Type.String({ minLength: 1 }) }),
  output: Type.Object({ ok: Type.Boolean() }),
  requires: "authenticated",
  http: { method: "POST", path: "/api/v1/me/tokens/revoke" },
  mcp: null,
  mcpExemptReason: "Paired with token creation, which is UI-only for the same reason.",
  ui: { route: "/account/tokens", control: "auth.revoke_api_token" },
  handler: async ({ client, actor }, input) => {
    const result = await client.query(
      "UPDATE api_token SET revoked_at = now() WHERE id = $1 AND principal_id = $2 AND revoked_at IS NULL",
      [input.id, actor.principalId],
    );
    if (result.rowCount === 0) fail("not_found", "No such active token");
    await recordActivity(client, actor, {
      action: "revoked_api_token",
      subjectType: "principal",
      subjectId: actor.principalId,
    });
    return { ok: true };
  },
});
