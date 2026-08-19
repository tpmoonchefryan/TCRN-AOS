import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { actorFromApiToken, ANONYMOUS, type Actor } from "../../kernel/src/index.js";
import { configFromEnv, createPool } from "../../store/src/pool.js";
import { createMcpServer } from "./server.js";

/**
 * The stdio entrypoint, for a client that launches AOS as a subprocess.
 *
 * It authenticates the same way the HTTP surface does — with a personal access token —
 * because a transport that skipped authentication would be a way to hold more authority
 * by choosing a different pipe.
 */
async function main(): Promise<void> {
  const token = process.env.AOS_API_TOKEN;
  if (!token) {
    console.error("AOS_API_TOKEN is required: the MCP surface authenticates as a principal, never anonymously.");
    process.exit(2);
  }
  const pool = createPool(configFromEnv());
  const actor: Actor | null = await actorFromApiToken(pool as never, token);
  if (!actor) {
    console.error("That token is not valid, has been revoked, or has expired.");
    process.exit(3);
  }

  const server = createMcpServer(pool, () => actor);
  const transport = new StdioServerTransport();
  await server.connect(transport);

  const shutdown = async (): Promise<void> => {
    await server.close();
    await pool.end();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown());
  process.on("SIGINT", () => void shutdown());
}

main().catch((error: unknown) => {
  console.error((error as Error).message);
  process.exit(1);
});
