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
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

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

// The store this default points at may have been migrated to the VM
// (TCRN-AOS-STORY-132). The migration leaves the original in place as an archive
// — deliberately, because it is the one store here that cannot be rebuilt — and
// drops a sentinel beside it. Starting on the archive would not fail: it would
// succeed, accept writes, and produce a second lineage of assignees and comments
// that nothing reads and nobody would notice diverging. So the default is
// refused while the sentinel is there. An explicit AOS_DOMAIN_DB still works:
// this is a guard against the default, not a lock on the file.
if (process.env.AOS_DOMAIN_DB === undefined) {
  const sentinel = join(dirname(domainDatabasePath), "RELOCATED-TO-VM.json");
  if (existsSync(sentinel)) {
    let live = null;
    try { live = JSON.parse(readFileSync(sentinel, "utf8")).liveStore ?? null; } catch { live = null; }
    console.error(JSON.stringify({
      ok: false,
      error: "the local domain store is an archive: it was migrated to the resident VM cockpit "
        + "and writing to it here would fork the one store on this platform that cannot be rebuilt.",
      sentinel,
      liveStore: live,
      remedies: [
        "use the resident cockpit (systemctl status tcrn-aos-cockpit on the VM, reached through ssh -L)",
        "or state AOS_DOMAIN_DB explicitly to run against some other store on purpose"
      ]
    }));
    process.exit(1);
  }
}
await mkdir(dirname(domainDatabasePath), { recursive: true });

const authorityPins = process.env.AOS_AUTHORITY_PINS
  ?? resolve(homedir(), ".tcrn-workflow/live/tcrn-platform/authority/operator-authority-pins.json");
const authorityPinsDigest = process.env.TCRN_AUTHORITY_PINS_DIGEST
  ?? "d25ebfc1cb47310d27bdeba4749fe5728b089188a7338d6a89cfe86f1c5d5ce9";

// No default actor: attribution is a claim about who is acting, and a fallback
// would record that claim on every write without anyone having made it
// (TCRN-AOS-STORY-112). The deployment states it or the service does not start.
const actor = process.env.AOS_ACTOR;
if (!actor || actor.trim().length === 0) {
  console.error(JSON.stringify({
    ok: false,
    error: "AOS_ACTOR is not set. Every cockpit write is attributed to the configured actor; "
      + "start the service with AOS_ACTOR=<who-is-acting> (for example AOS_ACTOR=agent:fable)."
  }));
  process.exit(1);
}

// The governed engine's MCP facade this service lazily spawns for a chain write.
// Stated here (the local install path), never defaulted inside the service — the
// service refuses rather than aim at a hard-coded path (STORY-186).
const engineMcpPath = resolve(homedir(), ".tcrn-workflow/tcrn-workflow/scripts/tcrn-workflow-mcp.mjs");

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
  engineMcpPath,
  authorityPins,
  authorityPinsDigest,
  actor
});

console.log(JSON.stringify({
  ok: true,
  service: "tcrn-aos-cockpit",
  url: service.url,
  boundTo: "127.0.0.1",
  domainDatabasePath,
  actor,
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
