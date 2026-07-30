#!/usr/bin/env node
// TCRN-AOS-STORY-132 — the process systemd runs on the VM.
//
// It is the resident sibling of scripts/cockpit-service-start.mjs, and the
// differences are all consequences of the relocation rather than preferences:
//
//  - the truth root is on THIS machine now, so the workspace and its attestation
//    sidecar come from the environment the unit states, not from a platform root
//    computed relative to a repository checkout that does not exist here;
//  - the chain client is constructed HERE, pointed at the VM's own governed
//    engine copy and the VM-scoped minimal authority (safe write surface only:
//    work-create / work-transition / work-annotate). Constructing it here means
//    its facade process group is this runner's to reclaim on SIGTERM, which is
//    what makes `systemctl stop` leave nothing behind;
//  - nothing is defaulted. Every value is stated by the unit or the service does
//    not start. A default here would be a claim the deployment never made:
//    AOS_ACTOR is the STORY-112 case, and the others are the same argument
//    applied to the address of a chain and the location of a store that cannot
//    be rebuilt.
//
// What this runner cannot change, and does not try to: the service binds
// 127.0.0.1 and nothing else. That bind is hard-coded in service.ts, the ruling
// behind it is CONF-007 D7, and the tripwire for it lives on this host
// (deploy/aos-resident-cockpit/tripwire.mjs).

import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();

/** Every value the unit must state, with what it is for. No defaults. */
const REQUIRED = [
  ["AOS_ACTOR", "who every write is attributed to (TCRN-AOS-STORY-112)"],
  ["AOS_PORT", "the loopback port to answer on"],
  ["AOS_STATIC_ROOT", "the built cockpit this service serves"],
  ["AOS_DOMAIN_DB", "the precious domain store; it cannot be rebuilt from the chain"],
  ["AOS_WORKSPACE", "the governed chain's own directory at its relocated address"],
  ["AOS_ATTEST_DIR", "where the engine writes time-attestation receipts (outside the workspace root)"],
  ["AOS_ENGINE_MCP", "the governed engine's MCP facade on this host"],
  ["AOS_AUTHORITY_PINS", "the pinned operator authority that makes a chain write possible at all"],
  ["AOS_AUTHORITY_PINS_DIGEST", "the sha256 of those pins, so a swapped file fails closed"]
];

const missing = REQUIRED.filter(([key]) => {
  const value = process.env[key];
  return typeof value !== "string" || value.trim().length === 0;
});
if (missing.length > 0) {
  console.error(JSON.stringify({
    ok: false,
    error: "the resident cockpit refuses to start: the unit did not state every required value",
    missing: missing.map(([key, why]) => ({ key, why })),
    note: "no value here has a default; a fallback would record a claim nobody made"
  }));
  process.exit(1);
}

const env = Object.fromEntries(REQUIRED.map(([key]) => [key, process.env[key]]));

// The runner must be executing out of the tree the unit points at. A runtime
// assembled somewhere else — a half-finished transfer, a stale copy left behind
// by an earlier deployment — would otherwise serve whatever bytes it found.
const serviceEntry = join(root, "dist/apps/cockpit-service/src/service.js");
const migrations = join(root, "packages/db/migrations/domain");
for (const [what, path] of [["service", serviceEntry], ["domain migrations", migrations],
  ["static root", env.AOS_STATIC_ROOT], ["engine facade", env.AOS_ENGINE_MCP],
  ["authority pins", env.AOS_AUTHORITY_PINS]]) {
  if (!existsSync(path)) {
    console.error(JSON.stringify({ ok: false, error: `${what} is absent at ${path}`, cwd: root }));
    process.exit(1);
  }
}

const { startCockpitService } = await import(pathToFileURL(serviceEntry).href);
const { ChainClient } = await import(
  pathToFileURL(join(root, "dist/packages/projection/src/index.js")).href);

const client = new ChainClient({
  serverPath: env.AOS_ENGINE_MCP,
  authorityPins: env.AOS_AUTHORITY_PINS,
  authorityPinsDigest: env.AOS_AUTHORITY_PINS_DIGEST
});

const service = await startCockpitService({
  port: Number.parseInt(env.AOS_PORT, 10),
  staticRoot: resolve(env.AOS_STATIC_ROOT),
  domainDatabasePath: resolve(env.AOS_DOMAIN_DB),
  // One partition, stated honestly. The other three chains live on the operator's
  // machine and this host cannot reach them, so declaring them would produce a
  // write face that answers and then fails at the engine. A write aimed at them
  // gets UNKNOWN_PARTITION from the surface, which is the truth.
  workspaces: { "TCRN-AOS": resolve(env.AOS_WORKSPACE) },
  attestDir: resolve(env.AOS_ATTEST_DIR),
  // Stated in options as well as handed to the client, so /api/health reports
  // chainWriteAvailable truthfully; the lazy spawn path never runs because the
  // client is injected.
  authorityPins: env.AOS_AUTHORITY_PINS,
  authorityPinsDigest: env.AOS_AUTHORITY_PINS_DIGEST,
  actor: env.AOS_ACTOR,
  chainClient: client
});

console.log(JSON.stringify({
  ok: true,
  service: "tcrn-aos-cockpit",
  resident: true,
  url: service.url,
  boundTo: "127.0.0.1",
  actor: env.AOS_ACTOR,
  workspace: env.AOS_WORKSPACE,
  attestDir: env.AOS_ATTEST_DIR,
  domainDatabasePath: env.AOS_DOMAIN_DB,
  engine: env.AOS_ENGINE_MCP,
  authorityScope: "safe write surface only (work-create/work-transition/work-annotate)",
  notClaimed: [
    "reachable only from this host's loopback; every off-host path is an SSH tunnel (CONF-007 D7)",
    "the three partitions that remain on the operator's machine are not writable from here"
  ]
}));

let closing = false;
async function shutdown(signal) {
  if (closing) return;
  closing = true;
  await service.close();
  // The injected client is this runner's own; reclaim its facade process group
  // rather than leaving an engine reparented to init after `systemctl stop`.
  await client.stop();
  console.log(JSON.stringify({ ok: true, stopped: true, signal }));
  process.exit(0);
}
process.on("SIGINT", () => { void shutdown("SIGINT"); });
process.on("SIGTERM", () => { void shutdown("SIGTERM"); });
