#!/usr/bin/env node
// STORY-125: the cockpit service, run ON the VM against the rehearsal scratch
// chain. Executed with cwd = <rehearsal-root>/runtime (the transferred,
// self-contained runtime tree).
//
// Shape rulings this keeps intact, deliberately:
//  - the service binds 127.0.0.1 and nothing else (the bind is hard-coded in
//    service.ts; this runner could not change it if it wanted to) — off-host
//    callers arrive exclusively through `ssh -L` (CONF-007 D7);
//  - no default actor: AOS_ACTOR is stated by the deployment or the service
//    does not start (STORY-112);
//  - the chain client is constructed HERE, pointed at the VM's own governed
//    engine copy and at the rehearsal-scoped operator authority (safe write
//    surface only: work-create / work-transition / work-annotate), so the
//    injected client's lifecycle — including the facade process group — is
//    this runner's to reclaim on SIGTERM.

import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const rehearsalRoot = resolve(root, "..");
if (!rehearsalRoot.startsWith("/srv/tcrn/scratch-rehearsal-")) {
  console.error(JSON.stringify({ ok: false, error: "runner must execute inside /srv/tcrn/scratch-rehearsal-*/runtime" }));
  process.exit(1);
}
const actor = process.env.AOS_ACTOR;
if (!actor || actor.trim().length === 0) {
  console.error(JSON.stringify({ ok: false, error: "AOS_ACTOR is not set; every write is attributed, so the deployment must say who is acting" }));
  process.exit(1);
}
const pinsDigest = process.env.AOS_AUTHORITY_PINS_DIGEST;
if (!pinsDigest) {
  console.error(JSON.stringify({ ok: false, error: "AOS_AUTHORITY_PINS_DIGEST is not set" }));
  process.exit(1);
}

const { startCockpitService } = await import(pathToFileURL(join(root, "dist/apps/cockpit-service/src/service.js")).href);
const { ChainClient } = await import(pathToFileURL(join(root, "dist/packages/projection/src/index.js")).href);

const authorityPins = join(root, "authority/operator-authority-pins.json");
const client = new ChainClient({
  serverPath: "/srv/tcrn/engine/tcrn-workflow/scripts/tcrn-workflow-mcp.mjs",
  authorityPins,
  authorityPinsDigest: pinsDigest
});

const service = await startCockpitService({
  port: Number.parseInt(process.env.AOS_PORT ?? "14318", 10),
  staticRoot: join(root, "web"),
  domainDatabasePath: join(root, "domain.db"),
  workspaces: { "SCRATCH-REHEARSAL": join(rehearsalRoot, "workspace") },
  // Stated in options too, so /api/health reports chainWriteAvailable
  // truthfully; the spawn path never runs because chainClient is injected.
  authorityPins,
  authorityPinsDigest: pinsDigest,
  actor,
  chainClient: client
});

console.log(JSON.stringify({
  ok: true,
  service: "tcrn-aos-cockpit-rehearsal",
  url: service.url,
  boundTo: "127.0.0.1",
  actor,
  partition: "SCRATCH-REHEARSAL",
  workspace: join(rehearsalRoot, "workspace"),
  domainDatabasePath: join(root, "domain.db"),
  engine: "/srv/tcrn/engine/tcrn-workflow",
  authorityScope: "safe write surface only (work-create/work-transition/work-annotate)"
}));

let closing = false;
async function shutdown(signal) {
  if (closing) return;
  closing = true;
  await service.close();
  // The injected client is this runner's own; reclaim its facade process group.
  await client.stop();
  console.log(JSON.stringify({ ok: true, stopped: true, signal }));
  process.exit(0);
}
process.on("SIGINT", () => { void shutdown("SIGINT"); });
process.on("SIGTERM", () => { void shutdown("SIGTERM"); });
