import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type pg from "pg";
import { AosError, allOperations, dispatch, getOperation, type Actor } from "../../kernel/src/index.js";

/**
 * The MCP surface.
 *
 * Every tool is generated from the operation registry, so an operation cannot exist over
 * HTTP and be missing here — `parity:registry` asserts the two name sets are equal, in
 * both directions.
 *
 * The previous implementation was a newline-delimited JSON-RPC loop with no `initialize`,
 * no `tools/list` and no `tools/call`. It was called MCP but a real client failed at the
 * handshake, so this is a replacement rather than a port.
 */

export const SERVER_INFO = { name: "tcrn-aos", version: "0.2.0" } as const;

/** Tools carry the operation's own JSON Schema; there is no second schema to drift. */
export function toolDefinitions(): Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> {
  return allOperations()
    .filter((operation) => operation.mcp !== null)
    .map((operation) => ({
      name: operation.mcp!.tool,
      description: `${operation.summary} (operation ${operation.id})`,
      inputSchema: operation.input as unknown as Record<string, unknown>,
    }));
}

function operationForTool(toolName: string): string | null {
  for (const operation of allOperations()) {
    if (operation.mcp?.tool === toolName) return operation.id;
  }
  return null;
}

export function createMcpServer(pool: pg.Pool, resolveActor: () => Actor): Server {
  const server = new Server(SERVER_INFO, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolDefinitions(),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const operationId = operationForTool(request.params.name);
    if (!operationId) {
      return {
        isError: true,
        content: [{ type: "text" as const, text: JSON.stringify({ ok: false, reasonCode: "not_found", message: `No such tool: ${request.params.name}` }) }],
      };
    }
    try {
      const result = await dispatch(pool, operationId, request.params.arguments ?? {}, resolveActor());
      return { content: [{ type: "text" as const, text: JSON.stringify(result.output, null, 2) }] };
    } catch (error) {
      // A refusal reaches the client as its stable reason code, not as a stack trace and
      // not as a generic failure — an agent that cannot tell "not permitted" from
      // "try again" will do the wrong one.
      const payload =
        error instanceof AosError
          ? error.toPayload()
          : { ok: false as const, reasonCode: "internal_error", message: "The request could not be completed", detail: {} };
      return { isError: true, content: [{ type: "text" as const, text: JSON.stringify(payload) }] };
    }
  });

  return server;
}

export { getOperation };
