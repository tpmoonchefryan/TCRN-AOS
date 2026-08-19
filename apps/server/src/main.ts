import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { assertStatedBindHost, bootstrapIfEmpty } from "../../../packages/kernel/src/index.js";
import { configFromEnv, createPool } from "../../../packages/store/src/pool.js";
import { appliedSchemaVersion, expectedSchemaVersion, migrate } from "../../../packages/store/src/migrate.js";
import { buildApp } from "./app.js";

const require = createRequire(import.meta.url);

function version(): string {
  try {
    return (require("../../../../package.json") as { version: string }).version;
  } catch {
    return "0.0.0";
  }
}

async function main(): Promise<void> {
  const bindHost = assertStatedBindHost(process.env.AOS_BIND_HOST);
  const port = Number(process.env.AOS_PORT ?? 8080);
  const allowedHosts = (process.env.AOS_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim())
    .filter((host) => host.length > 0);

  const pool = createPool(configFromEnv());

  // Wait for the database rather than exiting.
  //
  // On a fresh cluster the app and Postgres start together, and the app wins. Crash-looping
  // until the database appears does eventually work, but it fills the events with Error and
  // BackOff and tells whoever is watching their install failed. Waiting says what is
  // happening instead.
  const startedWaiting = Date.now();
  const waitBudgetMs = Number(process.env.AOS_DB_WAIT_MS ?? 180_000);
  for (let attempt = 1; ; attempt += 1) {
    try {
      await pool.query("SELECT 1");
      break;
    } catch (error) {
      if (Date.now() - startedWaiting > waitBudgetMs) throw error;
      if (attempt === 1 || attempt % 5 === 0) {
        console.log(
          JSON.stringify({
            level: "info",
            at: "wait-for-database",
            attempt,
            waitedMs: Date.now() - startedWaiting,
            message: "the database is not accepting connections yet",
          }),
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  // Migrations run at boot, under an advisory lock, so two replicas starting together do
  // not race. The readiness probe compares the applied version against the one this image
  // carries, which is what keeps traffic off a pod whose schema is behind.
  const outcome = await migrate(pool);
  console.log(
    JSON.stringify({ level: "info", at: "migrate", applied: outcome.applied, schemaVersion: outcome.schemaVersion }),
  );

  await bootstrapIfEmpty(pool, process.env.AOS_INSTANCE_NAME ?? "aos");

  const app = await buildApp({
    pool,
    allowedHosts,
    version: version(),
    secureCookies: process.env.AOS_SECURE_COOKIES === "true",
    schemaStatus: async () => ({
      applied: await appliedSchemaVersion(pool),
      expected: expectedSchemaVersion(),
    }),
  });

  // Serve the design system's tokens from the installed package rather than a copy, so
  // there is no second file to drift.
  const tokensPath = require.resolve("@tcrn/ui-tokens/tokens.css");
  const tokensCss = readFileSync(tokensPath, "utf8");
  app.get("/assets/tokens.css", async (_request, reply) =>
    reply.type("text/css; charset=utf-8").header("cache-control", "public, max-age=3600").send(tokensCss),
  );

  await app.listen({ host: bindHost, port });
  console.log(JSON.stringify({ level: "info", at: "listen", host: bindHost, port }));

  const shutdown = async (signal: string): Promise<void> => {
    console.log(JSON.stringify({ level: "info", at: "shutdown", signal }));
    await app.close();
    await pool.end();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({ level: "fatal", message: (error as Error).message, stack: (error as Error).stack }));
  process.exit(1);
});
