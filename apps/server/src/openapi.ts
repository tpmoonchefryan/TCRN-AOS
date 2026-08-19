import type { TSchema } from "@sinclair/typebox";
import { allOperations } from "../../../packages/kernel/src/index.js";

/**
 * The OpenAPI document is generated from the registry, never hand-written.
 *
 * A hand-written spec is a second declaration of the same surface, and the two diverge
 * the first time someone is in a hurry. `gate:openapi` regenerates this and byte-compares
 * it against the committed copy, so a change to an operation that is not reflected in the
 * document fails the build rather than shipping a lie.
 */

function toParameterName(segment: string): string | null {
  const match = /^\{(.+)\}$/.exec(segment);
  return match ? match[1]! : null;
}

function pathParameters(path: string): string[] {
  return path
    .split("/")
    .map(toParameterName)
    .filter((name): name is string => name !== null);
}

function stripPathProperties(schema: TSchema, pathParams: string[]): TSchema {
  if (pathParams.length === 0) return schema;
  const object = schema as unknown as { type?: string; properties?: Record<string, unknown>; required?: string[] };
  if (object.type !== "object" || !object.properties) return schema;
  const properties: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(object.properties)) {
    if (!pathParams.includes(key)) properties[key] = value;
  }
  return {
    ...(schema as unknown as Record<string, unknown>),
    properties,
    required: (object.required ?? []).filter((name) => !pathParams.includes(name)),
  } as unknown as TSchema;
}

export interface OpenApiDocument {
  openapi: string;
  info: { title: string; version: string; description: string };
  paths: Record<string, Record<string, unknown>>;
  components: { schemas: Record<string, unknown>; securitySchemes: Record<string, unknown> };
}

export function buildOpenApi(version: string): OpenApiDocument {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const operation of allOperations()) {
    const params = pathParameters(operation.http.path);
    const method = operation.http.method.toLowerCase();
    const entry = (paths[operation.http.path] ??= {});

    const parameters: unknown[] = params.map((name) => ({
      name,
      in: "path",
      required: true,
      schema: { type: "string" },
    }));

    if (operation.kind === "query") {
      const object = operation.input as unknown as {
        properties?: Record<string, unknown>;
        required?: string[];
      };
      for (const [key, schema] of Object.entries(object.properties ?? {})) {
        if (params.includes(key)) continue;
        parameters.push({
          name: key,
          in: "query",
          required: (object.required ?? []).includes(key),
          schema,
        });
      }
    }

    entry[method] = {
      operationId: operation.id,
      summary: operation.summary,
      tags: [operation.id.split(".")[0]],
      parameters,
      ...(operation.kind === "command"
        ? {
            requestBody: {
              required: true,
              content: {
                "application/json": { schema: stripPathProperties(operation.input, params) },
                "application/x-www-form-urlencoded": {
                  schema: stripPathProperties(operation.input, params),
                },
              },
            },
          }
        : {}),
      responses: {
        "200": {
          description: "Success",
          content: { "application/json": { schema: operation.output } },
        },
        "400": { description: "The request was refused; the body names a stable reasonCode", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        "401": { description: "Not signed in", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        "403": { description: "Not permitted", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        "404": { description: "No such record", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        "409": { description: "Conflict, stale version, refused transition, or pending gate", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        "413": { description: "The response exceeds this endpoint's byte budget", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
      },
      security: operation.requires === "public" ? [] : [{ sessionCookie: [] }, { bearerToken: [] }],
    };
  }

  // The generic command endpoint. Every command is reachable here by id, and the RESTful
  // paths above are argument mapping over the same dispatch — never a second implementation.
  paths["/api/v1/commands/{operationId}"] = {
    post: {
      operationId: "commands.dispatch",
      summary: "Run any command by its registry id",
      description:
        "The server-rendered UI posts here. Content negotiation decides the reply: an Accept of text/html gets a 303 to the _redirect target, anything else gets the operation's JSON output.",
      parameters: [{ name: "operationId", in: "path", required: true, schema: { type: "string" } }],
      requestBody: {
        required: true,
        content: {
          "application/json": { schema: { type: "object", additionalProperties: true } },
          "application/x-www-form-urlencoded": { schema: { type: "object", additionalProperties: true } },
        },
      },
      responses: {
        "200": { description: "Success" },
        "303": { description: "Browser form post; follow Location" },
      },
      security: [{ sessionCookie: [] }, { bearerToken: [] }],
    },
  };

  return {
    openapi: "3.1.0",
    info: {
      title: "TCRN AOS",
      version,
      description:
        "Work item and knowledge management. Every operation in this document is also reachable over MCP and has a control in the server-rendered UI; the parity gates fail the build when that stops being true.",
    },
    paths,
    components: {
      schemas: {
        Error: {
          type: "object",
          required: ["ok", "reasonCode", "message"],
          properties: {
            ok: { type: "boolean", enum: [false] },
            reasonCode: { type: "string" },
            message: { type: "string" },
            detail: { type: "object", additionalProperties: true },
          },
        },
      },
      securitySchemes: {
        sessionCookie: { type: "apiKey", in: "cookie", name: "aos_session" },
        bearerToken: { type: "http", scheme: "bearer", description: "A personal access token, prefix aos_pat_" },
      },
    },
  };
}
