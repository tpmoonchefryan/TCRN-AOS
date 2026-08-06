#!/usr/bin/env node
// STORY-184 — the process systemd runs for the facade WRITE service.
//
// It starts startFacadeWriteService (deploy/aos-resident-cockpit/facade-write-service.mjs)
// pointed at the engine copy, the partition workspaces + attestation sidecars and
// the evidence root the unit states. Every value comes from the unit's
// environment; nothing is defaulted — a network-facing write process must not
// invent an address, an engine, a workspace path, an attestation sidecar, or an
// actor.
//
// The process performs no chain write of its own: the only write path is the
// service's one POST /api/ceremony endpoint, which drives the engine CLI
// in-process (the engine is the only writer). It holds no pins and accepts no
// authority argument (the source gate asserts both at the bytes).

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Resolve the facade service from THIS file's own location, so the runtime needs
// no particular working directory — the sibling modules it imports (ceremony-plan,
// remote-read-mcp, evidence-hygiene) travel in the same deploy tree.
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");

const REQUIRED = [
  ["FACADE_WRITE_ENGINE", "the installed engine copy whose commands catalogue drives the write whitelist"],
  ["FACADE_WRITE_HOST", "the address to bind (a concrete address, never a wildcard)"],
  ["FACADE_WRITE_PORT", "the port to answer on"],
  ["FACADE_WRITE_ROOT", "deployment root; also the parent of the evidence root (INC-042: receipts land, scrubbed, uncommitted)"],
  ["FACADE_WRITE_EVIDENCE", "tool-owned evidence root where payloads and receipts are materialised"],
  ["FACADE_WRITE_WORKSPACES", "JSON object of partitionId -> workspace path (CockpitServiceOptions.workspaces seam)"],
  ["FACADE_WRITE_ATTEST_DIRS", "JSON object of partitionId -> attestation sidecar path (never inside the workspace)"],
  ["FACADE_WRITE_ALLOWED_HOSTS", "comma-separated Host allow-list (anti-DNS-rebinding)"],
  ["FACADE_WRITE_ACTOR", "default attributed ceremony actor (EPIC-041: agent:<model> or person:<id>)"]
];

const missing = REQUIRED.filter(([key]) => {
  const value = process.env[key];
  return typeof value !== "string" || value.trim().length === 0;
});
if (missing.length > 0) {
  console.error(JSON.stringify({
    ok: false,
    error: "the facade write service refuses to start: the unit did not state every required value",
    missing: missing.map(([key, why]) => ({ key, why }))
  }));
  process.exit(1);
}

const env = Object.fromEntries(REQUIRED.map(([key]) => [key, process.env[key]]));

// The unit renders JSON records through systemdJsonEnv (escaped inner quotes),
// which systemd unescapes on the way in, so the runner JSON.parses the value
// directly.
function parseJsonRecord(name, raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error(JSON.stringify({ ok: false, error: `${name} is not valid JSON` }));
    process.exit(1);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)
    || Object.keys(parsed).length === 0) {
    console.error(JSON.stringify({ ok: false, error: `${name} must be a non-empty JSON object` }));
    process.exit(1);
  }
  return parsed;
}

const workspaces = parseJsonRecord("FACADE_WRITE_WORKSPACES", env.FACADE_WRITE_WORKSPACES);
const attestDirs = parseJsonRecord("FACADE_WRITE_ATTEST_DIRS", env.FACADE_WRITE_ATTEST_DIRS);
const missingSidecars = Object.keys(workspaces).filter((id) => typeof attestDirs[id] !== "string"
  || attestDirs[id].trim().length === 0);
if (missingSidecars.length > 0) {
  console.error(JSON.stringify({
    ok: false,
    error: "the facade write service refuses to start: partitions missing an attestation sidecar",
    missing: missingSidecars
  }));
  process.exit(1);
}

// STORY-189 switch window: when the unit states the PG schema map and a
// connection, the write facade drives the engine CLI against the PG-backed
// chain (as the PG peer-auth role with TCRN_PG_SCHEMA set). Absent, it writes
// the file tree exactly as before the switch.
let pgSchemas;
const rawSchemas = process.env.FACADE_PG_SCHEMAS;
if (typeof rawSchemas === "string" && rawSchemas.trim().length > 0) {
  pgSchemas = parseJsonRecord("FACADE_PG_SCHEMAS", rawSchemas);
}

const serviceEntry = join(HERE, "facade-write-service.mjs");
const engineCli = join(resolve(env.FACADE_WRITE_ENGINE), "scripts/tcrn-workflow.mjs");
for (const [what, path] of [["facade service", serviceEntry], ["engine CLI", engineCli]]) {
  if (!existsSync(path)) {
    console.error(JSON.stringify({ ok: false, error: `${what} is absent at ${path}`, repoRoot: REPO_ROOT }));
    process.exit(1);
  }
}

const { startFacadeWriteService } = await import(pathToFileURL(serviceEntry).href);

const service = await startFacadeWriteService({
  port: Number.parseInt(env.FACADE_WRITE_PORT, 10),
  host: env.FACADE_WRITE_HOST,
  engineRoot: resolve(env.FACADE_WRITE_ENGINE),
  workspaces,
  attestDirs,
  writeRoot: resolve(env.FACADE_WRITE_EVIDENCE),
  allowedHosts: env.FACADE_WRITE_ALLOWED_HOSTS.split(",").map((entry) => entry.trim()).filter(Boolean),
  actor: env.FACADE_WRITE_ACTOR,
  pgSchemas,
  pgConnection: process.env.FACADE_PG_CONNECTION,
});

console.log(JSON.stringify({
  ok: true,
  service: "tcrn-aos-facade-write",
  url: service.url,
  boundTo: `${env.FACADE_WRITE_HOST}:${env.FACADE_WRITE_PORT}`,
  readonly: false,
  chainWriteAvailable: true,
  noPins: true,
  partitions: Object.keys(workspaces),
  engine: env.FACADE_WRITE_ENGINE,
  evidence: env.FACADE_WRITE_EVIDENCE,
  notClaimed: [
    "performs no chain write of its own: the only write path is the one ceremony endpoint, driving the engine CLI",
    "receipts are scrubbed of host paths and materialised under the evidence root, uncommitted until closeout (INC-042)"
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
