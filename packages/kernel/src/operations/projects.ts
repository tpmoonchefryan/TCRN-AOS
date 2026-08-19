import { Type } from "@sinclair/typebox";
import { newId } from "../../../store/src/ids.js";
import { recordActivity, upsertSearchDoc } from "../audit.js";
import { fail } from "../errors.js";
import { defineOperation } from "../registry.js";

const ProjectShape = Type.Object({
  id: Type.String(),
  key: Type.String(),
  name: Type.String(),
  descriptionMd: Type.String(),
  governanceEnabled: Type.Boolean(),
  version: Type.Integer(),
  createdAt: Type.String(),
});

export const createProject = defineOperation({
  id: "project.create",
  kind: "command",
  summary: "Create a project",
  input: Type.Object({
    key: Type.String({ minLength: 1, maxLength: 12, pattern: "^[A-Za-z][A-Za-z0-9]*$" }),
    name: Type.String({ minLength: 1, maxLength: 200 }),
    descriptionMd: Type.Optional(Type.String({ maxLength: 20_000, default: "" })),
    governanceEnabled: Type.Optional(Type.Boolean({ default: false })),
  }),
  output: ProjectShape,
  requires: "authenticated",
  http: { method: "POST", path: "/api/v1/projects" },
  mcp: { tool: "aos_project_create" },
  ui: { route: "/projects", control: "project.create" },
  handler: async ({ client, actor }, input) => {
    const id = newId("pr");
    const key = input.key.toUpperCase();
    const result = await client.query<{ created_at: Date }>(
      `INSERT INTO project (id, key, name, description_md, settings)
       VALUES ($1, $2, $3, $4, $5) RETURNING created_at`,
      [id, key, input.name, input.descriptionMd ?? "", JSON.stringify({ governance: input.governanceEnabled ?? false })],
    );
    await client.query("INSERT INTO key_sequence (project_id, next_seq) VALUES ($1, 1)", [id]);
    // Whoever creates a project administers it. A project nobody can administer is a
    // project nobody can add anyone to.
    await client.query(
      "INSERT INTO project_member (project_id, principal_id, role) VALUES ($1, $2, 'admin')",
      [id, actor.principalId],
    );
    await recordActivity(client, actor, {
      action: "created",
      subjectType: "project",
      subjectId: id,
      projectId: id,
    });
    await upsertSearchDoc(client, {
      subjectType: "project",
      subjectId: id,
      projectId: id,
      title: `${key} ${input.name}`,
      body: input.descriptionMd ?? "",
      key,
    });
    return {
      id,
      key,
      name: input.name,
      descriptionMd: input.descriptionMd ?? "",
      governanceEnabled: input.governanceEnabled ?? false,
      version: 1,
      createdAt: result.rows[0]!.created_at.toISOString(),
    };
  },
});

export const listProjects = defineOperation({
  id: "project.list",
  kind: "query",
  summary: "List projects you can see",
  input: Type.Object({}),
  output: Type.Object({
    items: Type.Array(
      Type.Intersect([
        ProjectShape,
        Type.Object({
          role: Type.Union([Type.String(), Type.Null()]),
          openCount: Type.Integer(),
          totalCount: Type.Integer(),
        }),
      ]),
    ),
  }),
  requires: "authenticated",
  http: { method: "GET", path: "/api/v1/projects" },
  mcp: { tool: "aos_project_list" },
  ui: { route: "/projects", control: "project.list" },
  handler: async ({ client, actor }) => {
    const result = await client.query(
      `SELECT p.id, p.key, p.name, p.description_md, p.settings, p.version, p.created_at,
              m.role,
              count(w.id) FILTER (WHERE w.deleted_at IS NULL) AS total_count,
              count(w.id) FILTER (WHERE w.deleted_at IS NULL AND w.status NOT IN ('done','cancelled')) AS open_count
         FROM project p
         LEFT JOIN project_member m ON m.project_id = p.id AND m.principal_id = $1
         LEFT JOIN work_item w ON w.project_id = p.id
        WHERE p.deleted_at IS NULL AND ($2 OR m.principal_id IS NOT NULL)
        GROUP BY p.id, m.role
        ORDER BY p.key`,
      [actor.principalId, actor.isInstanceAdmin],
    );
    return {
      items: result.rows.map((row) => ({
        id: row.id,
        key: row.key,
        name: row.name,
        descriptionMd: row.description_md,
        governanceEnabled: Boolean(row.settings?.governance),
        version: row.version,
        createdAt: row.created_at.toISOString(),
        role: row.role ?? null,
        openCount: Number(row.open_count),
        totalCount: Number(row.total_count),
      })),
    };
  },
});

export const getProject = defineOperation({
  id: "project.get",
  kind: "query",
  summary: "Read one project",
  input: Type.Object({ projectId: Type.String({ minLength: 1 }) }),
  output: ProjectShape,
  requires: { project: "viewer", from: "input" },
  http: { method: "GET", path: "/api/v1/projects/{projectId}" },
  mcp: { tool: "aos_project_get" },
  ui: { route: "/projects/{projectId}", control: "project.get" },
  handler: async ({ client }, input) => {
    const result = await client.query(
      "SELECT id, key, name, description_md, settings, version, created_at FROM project WHERE id = $1 AND deleted_at IS NULL",
      [input.projectId],
    );
    const row = result.rows[0];
    if (!row) fail("not_found", "No such project");
    return {
      id: row.id,
      key: row.key,
      name: row.name,
      descriptionMd: row.description_md,
      governanceEnabled: Boolean(row.settings?.governance),
      version: row.version,
      createdAt: row.created_at.toISOString(),
    };
  },
});

export const updateProject = defineOperation({
  id: "project.update",
  kind: "command",
  summary: "Rename a project, edit its description, or switch governance on or off",
  input: Type.Object({
    projectId: Type.String({ minLength: 1 }),
    expectedVersion: Type.Integer({ minimum: 1 }),
    name: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
    descriptionMd: Type.Optional(Type.String({ maxLength: 20_000 })),
    governanceEnabled: Type.Optional(Type.Boolean()),
  }),
  output: ProjectShape,
  requires: { project: "admin", from: "input" },
  http: { method: "POST", path: "/api/v1/projects/{projectId}/update" },
  mcp: { tool: "aos_project_update" },
  ui: { route: "/projects/{projectId}/settings", control: "project.update" },
  handler: async ({ client, actor }, input) => {
    const current = await client.query(
      "SELECT id, key, name, description_md, settings, version, created_at FROM project WHERE id = $1 AND deleted_at IS NULL",
      [input.projectId],
    );
    const row = current.rows[0];
    if (!row) fail("not_found", "No such project");
    if (row.version !== input.expectedVersion) {
      fail("stale_version", "Someone else changed this project while you were editing", {
        currentVersion: row.version,
      });
    }
    const settings = { ...(row.settings ?? {}) };
    if (input.governanceEnabled !== undefined) settings.governance = input.governanceEnabled;
    const next = {
      name: input.name ?? row.name,
      description_md: input.descriptionMd ?? row.description_md,
      settings,
    };
    const changed: string[] = [];
    if (next.name !== row.name) changed.push("name");
    if (next.description_md !== row.description_md) changed.push("descriptionMd");
    if (JSON.stringify(settings) !== JSON.stringify(row.settings ?? {})) changed.push("governanceEnabled");

    const updated = await client.query<{ version: number }>(
      `UPDATE project SET name = $1, description_md = $2, settings = $3, version = version + 1, updated_at = now()
        WHERE id = $4 RETURNING version`,
      [next.name, next.description_md, JSON.stringify(settings), input.projectId],
    );
    await recordActivity(client, actor, {
      action: "updated",
      subjectType: "project",
      subjectId: input.projectId,
      projectId: input.projectId,
      fieldNames: changed,
    });
    await upsertSearchDoc(client, {
      subjectType: "project",
      subjectId: input.projectId,
      projectId: input.projectId,
      title: `${row.key} ${next.name}`,
      body: next.description_md,
      key: row.key,
    });
    return {
      id: row.id,
      key: row.key,
      name: next.name,
      descriptionMd: next.description_md,
      governanceEnabled: Boolean(settings.governance),
      version: updated.rows[0]!.version,
      createdAt: row.created_at.toISOString(),
    };
  },
});

export const addMember = defineOperation({
  id: "project.add_member",
  kind: "command",
  summary: "Give someone a role on a project",
  input: Type.Object({
    projectId: Type.String({ minLength: 1 }),
    handle: Type.String({ minLength: 1 }),
    role: Type.Union([
      Type.Literal("viewer"),
      Type.Literal("contributor"),
      Type.Literal("maintainer"),
      Type.Literal("admin"),
    ]),
  }),
  output: Type.Object({ principalId: Type.String(), role: Type.String() }),
  requires: { project: "admin", from: "input" },
  http: { method: "POST", path: "/api/v1/projects/{projectId}/members" },
  mcp: { tool: "aos_project_add_member" },
  ui: { route: "/projects/{projectId}/settings", control: "project.add_member" },
  handler: async ({ client, actor }, input) => {
    const found = await client.query<{ id: string }>(
      "SELECT id FROM principal WHERE lower(handle) = lower($1) AND disabled_at IS NULL",
      [input.handle],
    );
    const principalId = found.rows[0]?.id;
    if (!principalId) fail("not_found", "No such account");
    await client.query(
      `INSERT INTO project_member (project_id, principal_id, role) VALUES ($1, $2, $3)
       ON CONFLICT (project_id, principal_id) DO UPDATE SET role = EXCLUDED.role`,
      [input.projectId, principalId, input.role],
    );
    await recordActivity(client, actor, {
      action: "member_added",
      subjectType: "project",
      subjectId: input.projectId,
      projectId: input.projectId,
      fieldNames: ["members"],
    });
    return { principalId, role: input.role };
  },
});

export const listMembers = defineOperation({
  id: "project.list_members",
  kind: "query",
  summary: "List a project's members",
  input: Type.Object({ projectId: Type.String({ minLength: 1 }) }),
  output: Type.Object({
    items: Type.Array(
      Type.Object({
        principalId: Type.String(),
        handle: Type.String(),
        displayName: Type.String(),
        kind: Type.String(),
        role: Type.String(),
      }),
    ),
  }),
  requires: { project: "viewer", from: "input" },
  http: { method: "GET", path: "/api/v1/projects/{projectId}/members" },
  mcp: { tool: "aos_project_list_members" },
  ui: { route: "/projects/{projectId}/settings", control: "project.list_members" },
  handler: async ({ client }, input) => {
    const result = await client.query(
      `SELECT m.principal_id, m.role, p.handle, p.display_name, p.kind
         FROM project_member m JOIN principal p ON p.id = m.principal_id
        WHERE m.project_id = $1 ORDER BY p.handle`,
      [input.projectId],
    );
    return {
      items: result.rows.map((row) => ({
        principalId: row.principal_id,
        handle: row.handle,
        displayName: row.display_name,
        kind: row.kind,
        role: row.role,
      })),
    };
  },
});
