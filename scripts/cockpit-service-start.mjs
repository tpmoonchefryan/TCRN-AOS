#!/usr/bin/env node
// Start the cockpit's local read-write service.
//
// This is the process the ruling put on this machine and only this machine: it
// holds the operator authority pins, so it binds to loopback and a browser or a
// mirror can never be the thing performing a chain write.
//
// It serves the built cockpit too, so one command gives a working product
// rather than a static build plus a separate API to remember.

import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";

const { startCockpitService } = await import(
  resolve(process.cwd(), "dist/apps/cockpit-service/src/service.js"));

const platform = resolve(process.cwd(), "..");
const workspaceFor = (partition) =>
  resolve(platform, ".tcrn-workspace", partition, "workspace");

// The precious database lives beside the chains rather than inside the repo:
// it is data, not source, and a `git clean` must not be able to destroy the one
// store on this platform that cannot be rebuilt.
const domainDatabasePath = process.env.AOS_DOMAIN_DB
  ?? resolve(homedir(), ".tcrn-aos/domain.db");
await mkdir(dirname(domainDatabasePath), { recursive: true });

const authorityPins = process.env.AOS_AUTHORITY_PINS
  ?? resolve(homedir(), ".tcrn-workflow/live/tcrn-platform/authority/operator-authority-pins.json");
const authorityPinsDigest = process.env.TCRN_AUTHORITY_PINS_DIGEST
  ?? "d25ebfc1cb47310d27bdeba4749fe5728b089188a7338d6a89cfe86f1c5d5ce9";

const service = await startCockpitService({
  port: Number.parseInt(process.env.AOS_PORT ?? "4318", 10),
  staticRoot: resolve(process.cwd(), "apps/web/dist"),
  domainDatabasePath,
  workspaces: {
    "cross-project": workspaceFor("cross-project"),
    "TCRN-Design-System": workspaceFor("TCRN-Design-System"),
    "TCRN-TMS": workspaceFor("TCRN-TMS"),
    "TCRN-AOS": workspaceFor("TCRN-AOS")
  },
  authorityPins,
  authorityPinsDigest,
  actor: process.env.AOS_ACTOR ?? "agent:fable"
});

console.log(JSON.stringify({
  ok: true,
  service: "tcrn-aos-cockpit",
  url: service.url,
  boundTo: "127.0.0.1",
  domainDatabasePath,
  chainWriteAvailable: true,
  notClaimed: [
    "this service is reachable only from this machine by design; the VM mirror is read-only",
    "the domain database is the one store here that cannot be rebuilt from the chain"
  ]
}, null, 2));

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
