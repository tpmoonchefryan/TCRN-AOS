#!/usr/bin/env node
// STORY-140 — the process systemd runs for the read-only LAN face.
//
// It starts startCockpitReadService (apps/cockpit-read) pointed at the resident
// cockpit's web and domain store. Every value comes from the unit's environment;
// nothing is defaulted — a network-facing read face must not invent an address
// or a Host allow-list (MIN-014).

import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();

const REQUIRED = [
  ["AOS_READ_HOST", "the LAN interface to bind (a concrete address, never a wildcard)"],
  ["AOS_READ_PORT", "the port to answer on"],
  ["AOS_STATIC_ROOT", "the built web to serve (the resident cockpit's own build)"],
  ["AOS_DOMAIN_DB", "the precious domain store, opened read-only"],
  ["AOS_ALLOWED_HOSTS", "comma-separated Host allow-list (anti-DNS-rebinding)"]
];

const missing = REQUIRED.filter(([key]) => {
  const value = process.env[key];
  return typeof value !== "string" || value.trim().length === 0;
});
if (missing.length > 0) {
  console.error(JSON.stringify({
    ok: false,
    error: "the read face refuses to start: the unit did not state every required value",
    missing: missing.map(([key, why]) => ({ key, why }))
  }));
  process.exit(1);
}

const env = Object.fromEntries(REQUIRED.map(([key]) => [key, process.env[key]]));

const serviceEntry = join(root, "dist/apps/cockpit-read/src/read-service.js");
for (const [what, path] of [["read service", serviceEntry], ["static root", env.AOS_STATIC_ROOT],
  ["domain store", env.AOS_DOMAIN_DB]]) {
  if (!existsSync(path)) {
    console.error(JSON.stringify({ ok: false, error: `${what} is absent at ${path}`, cwd: root }));
    process.exit(1);
  }
}

const { startCockpitReadService } = await import(pathToFileURL(serviceEntry).href);

const service = await startCockpitReadService({
  port: Number.parseInt(env.AOS_READ_PORT, 10),
  host: env.AOS_READ_HOST,
  staticRoot: resolve(env.AOS_STATIC_ROOT),
  domainDatabasePath: resolve(env.AOS_DOMAIN_DB),
  allowedHosts: env.AOS_ALLOWED_HOSTS.split(",").map((entry) => entry.trim()).filter(Boolean)
});

console.log(JSON.stringify({
  ok: true,
  service: "tcrn-aos-read",
  url: service.url,
  boundTo: `${env.AOS_READ_HOST}:${env.AOS_READ_PORT}`,
  readonly: true,
  staticRoot: env.AOS_STATIC_ROOT,
  domainDatabasePath: env.AOS_DOMAIN_DB,
  allowedHosts: env.AOS_ALLOWED_HOSTS.split(",").map((entry) => entry.trim()).filter(Boolean),
  notClaimed: [
    "no chain write capability: no ChainClient, no pins, no /api/chain/* routes",
    "LAN-exposed by design (STORY-140); the write face remains loopback-only behind SSH"
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
