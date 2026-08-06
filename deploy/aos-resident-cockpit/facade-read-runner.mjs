#!/usr/bin/env node
// STORY-181 — the process systemd runs for the facade read service.
//
// It starts startFacadeReadService (deploy/aos-resident-cockpit/facade-read-service.mjs)
// pointed at the engine copy and the partition workspaces the unit states. Every
// value comes from the unit's environment; nothing is defaulted — a network-facing
// read process must not invent an address, an engine, or a workspace path.
//
// The process is read-only by shape: it forwards only verbs the two-source
// derivation proved read-only, holds no pins, and binds the concrete address the
// unit states (loopback behind SSH on the VM, CONF-007 D7).

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Resolve the facade service from THIS file's own location, so the runtime needs
// no particular working directory — the sibling modules it imports (remote-read-mcp,
// evidence-hygiene) travel in the same deploy tree.
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");

const REQUIRED = [
  ["FACADE_ENGINE", "the installed engine copy whose commands catalogue drives the tool table"],
  ["FACADE_HOST", "the address to bind (a concrete address, never a wildcard)"],
  ["FACADE_PORT", "the port to answer on"],
  ["FACADE_WORKSPACES", "JSON object of partitionId -> workspace path (CockpitServiceOptions.workspaces seam)"],
  ["FACADE_ALLOWED_HOSTS", "comma-separated Host allow-list (anti-DNS-rebinding)"]
];

const missing = REQUIRED.filter(([key]) => {
  const value = process.env[key];
  return typeof value !== "string" || value.trim().length === 0;
});
if (missing.length > 0) {
  console.error(JSON.stringify({
    ok: false,
    error: "the facade read service refuses to start: the unit did not state every required value",
    missing: missing.map(([key, why]) => ({ key, why }))
  }));
  process.exit(1);
}

const env = Object.fromEntries(REQUIRED.map(([key]) => [key, process.env[key]]));

let workspaces;
try {
  workspaces = JSON.parse(env.FACADE_WORKSPACES);
} catch {
  console.error(JSON.stringify({ ok: false, error: "FACADE_WORKSPACES is not valid JSON" }));
  process.exit(1);
}
if (typeof workspaces !== "object" || workspaces === null || Array.isArray(workspaces)
  || Object.keys(workspaces).length === 0) {
  console.error(JSON.stringify({ ok: false, error: "FACADE_WORKSPACES must be a non-empty JSON object of partitionId -> workspace path" }));
  process.exit(1);
}

const serviceEntry = join(HERE, "facade-read-service.mjs");
const engineCli = join(resolve(env.FACADE_ENGINE), "scripts/tcrn-workflow.mjs");
for (const [what, path] of [["facade service", serviceEntry], ["engine CLI", engineCli]]) {
  if (!existsSync(path)) {
    console.error(JSON.stringify({ ok: false, error: `${what} is absent at ${path}`, repoRoot: REPO_ROOT }));
    process.exit(1);
  }
}

const { startFacadeReadService } = await import(pathToFileURL(serviceEntry).href);

// STORY-189 switch window: when the unit states the PG schema map and a
// connection, the facade serves the five chains from Postgres (each read verb
// runs the engine CLI as the PG peer-auth role with TCRN_PG_SCHEMA set). When
// absent, the facade serves the file tree exactly as before the switch.
let pgSchemas;
const rawSchemas = process.env.FACADE_PG_SCHEMAS;
if (typeof rawSchemas === "string" && rawSchemas.trim().length > 0) {
  try {
    pgSchemas = JSON.parse(rawSchemas);
  } catch {
    console.error(JSON.stringify({ ok: false, error: "FACADE_PG_SCHEMAS is not valid JSON" }));
    process.exit(1);
  }
  if (typeof pgSchemas !== "object" || pgSchemas === null || Array.isArray(pgSchemas)) {
    console.error(JSON.stringify({ ok: false, error: "FACADE_PG_SCHEMAS must be a JSON object of partitionId -> chain schema" }));
    process.exit(1);
  }
}

const service = await startFacadeReadService({
  port: Number.parseInt(env.FACADE_PORT, 10),
  host: env.FACADE_HOST,
  engineRoot: resolve(env.FACADE_ENGINE),
  workspaces,
  allowedHosts: env.FACADE_ALLOWED_HOSTS.split(",").map((entry) => entry.trim()).filter(Boolean),
  pgSchemas,
  pgConnection: process.env.FACADE_PG_CONNECTION,
});

console.log(JSON.stringify({
  ok: true,
  service: "tcrn-aos-facade-read",
  url: service.url,
  boundTo: `${env.FACADE_HOST}:${env.FACADE_PORT}`,
  readonly: true,
  partitions: Object.keys(workspaces),
  engine: env.FACADE_ENGINE,
  notClaimed: [
    "no chain write capability: no pins, no chain client, no mutating verb route (two-source derivation)",
    "forwards only engine read verbs; reason codes are the engine's own, unaltered"
  ]
}));

let closing = false;
async function shutdown(signal) {
  if (closing) return;
  closing = true;
  await service.close();
  console.log(JSON.stringify({ ok: true, stopped: true, signal }));
  process.exit(0);
}
process.on("SIGINT", () => { void shutdown("SIGINT"); });
process.on("SIGTERM", () => { void shutdown("SIGTERM"); });
