import type { Static, TSchema } from "@sinclair/typebox";
import type pg from "pg";
import type { Actor } from "./actor.js";

/**
 * The registry is the single declaration of what this product can do.
 *
 * Each entry states its schema, its HTTP route, its MCP tool name and its UI control in
 * one place, and the three surfaces are generated from it rather than written three
 * times. That is what makes "anything the API can do, a human can also do by hand" a
 * property the build can check instead of a promise someone has to keep.
 */

export type OperationKind = "command" | "query";

export interface ProjectRequirement {
  readonly project: "viewer" | "contributor" | "maintainer" | "admin";
  /** Where in the input the project is named. */
  readonly from: "input" | "subject" | "none";
}

export interface HttpBinding {
  readonly method: "GET" | "POST" | "PATCH" | "DELETE";
  readonly path: string;
}

export interface UiBinding {
  /** The server-rendered route where a human performs this operation. */
  readonly route: string;
  /** The control's data-op value on that page. */
  readonly control: string;
}

export interface OperationContext {
  readonly client: pg.PoolClient;
  readonly actor: Actor;
  readonly now: Date;
}

export interface OperationDefinition<TInput extends TSchema = TSchema, TOutput extends TSchema = TSchema> {
  readonly id: string;
  readonly kind: OperationKind;
  readonly summary: string;
  readonly input: TInput;
  readonly output: TOutput;
  readonly requires: ProjectRequirement | "authenticated" | "instance-admin" | "public";
  readonly http: HttpBinding;
  readonly mcp: { readonly tool: string } | null;
  readonly ui: UiBinding | null;
  /** Why this operation has no UI control. Required whenever `ui` is null. */
  readonly uiExemptReason?: string;
  /** Why this operation is not exposed over MCP. Required whenever `mcp` is null. */
  readonly mcpExemptReason?: string;
  readonly idempotent?: boolean;
  /** Response byte ceiling. Exceeding it is a refusal, never a silent truncation. */
  readonly byteBudget?: number;
  readonly handler: (context: OperationContext, input: Static<TInput>) => Promise<Static<TOutput>>;
}

/**
 * Handlers are stored with their schemas erased. A map keyed by a union of every
 * operation's exact types is unusable as a lookup table; the type safety that matters is
 * at `defineOperation`, where the handler and its schema are written together and the
 * input type is inferred from the schema rather than restated.
 */
export type AnyOperation = OperationDefinition<TSchema, TSchema>;

const registry = new Map<string, AnyOperation>();

export function defineOperation<TInput extends TSchema, TOutput extends TSchema>(
  definition: OperationDefinition<TInput, TOutput>,
): OperationDefinition<TInput, TOutput> {
  if (registry.has(definition.id)) {
    throw new Error(`AOS_REGISTRY_DUPLICATE: ${definition.id} is defined twice`);
  }
  if (definition.ui === null && !definition.uiExemptReason) {
    throw new Error(
      `AOS_REGISTRY_UNEXPLAINED_UI_EXEMPTION: ${definition.id} has no UI control and no stated reason`,
    );
  }
  if (definition.mcp === null && !definition.mcpExemptReason) {
    throw new Error(
      `AOS_REGISTRY_UNEXPLAINED_MCP_EXEMPTION: ${definition.id} is not exposed over MCP and no reason is stated`,
    );
  }
  registry.set(definition.id, definition as unknown as AnyOperation);
  return definition;
}

export function getOperation(id: string): AnyOperation | undefined {
  return registry.get(id);
}

export function allOperations(): AnyOperation[] {
  return [...registry.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function operationIds(): string[] {
  return allOperations().map((operation) => operation.id);
}

/** Reset between tests. Never called by the running server. */
export function clearRegistryForTest(): void {
  registry.clear();
}
