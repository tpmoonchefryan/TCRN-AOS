#!/usr/bin/env node
// Prove write attribution is configured, not defaulted (TCRN-AOS-STORY-112).
//
// Two halves, both against the real service code and never against a live chain:
//
//   red   — starting the cockpit service without an actor must be refused at
//           boot, because an actor default would let every write carry an
//           attribution claim nobody made;
//   green — with an actor configured, the health surface states it, a domain
//           write records it, and the chain write surface sends exactly it to
//           the engine (observed through a recording stand-in client, so no
//           engine is spawned and no chain is touched).

import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const { startCockpitService } = await import(
  resolve(process.cwd(), "dist/apps/cockpit-service/src/service.js"));
const { SafeWriteSurface } = await import(
  resolve(process.cwd(), "dist/packages/projection/src/write-surface.js"));

const ACTOR = "agent:attribution-proof";
const scratch = await mkdtemp(join(tmpdir(), "aos-attribution-proof-"));

const receipt = {
  schemaVersion: "aos.write-attribution-proof.v1",
  ok: false,
  criteria: [],
  notClaimed: [
    "the actor is an attribution claim the engine records, not proof of identity",
    "no live chain was written; the chain-write half is observed through a recording client"
  ]
};
const criterion = (name, ok, detail) => receipt.criteria.push({ name, ok, ...detail });

try {
  // red — no actor configured: boot must refuse, and say why. If the refusal
  // ever regresses, the service has actually started, and a started service
  // holds the event loop open — this proof once reported its red and then hung
  // until the process group was killed. Capture and close it either way.
  let refusal = null;
  let unexpectedlyStarted = null;
  try {
    unexpectedlyStarted = await startCockpitService(
      { port: 0, domainDatabasePath: join(scratch, "unreachable.db"), workspaces: {} });
  } catch (error) {
    refusal = error instanceof Error ? error.message : String(error);
  } finally {
    if (unexpectedlyStarted) await unexpectedlyStarted.close();
  }
  criterion("unconfigured-start-refused", refusal !== null && refusal.includes("no actor configured"),
    { refusal });

  // green — configured: the service states the actor and stamps it on writes.
  const service = await startCockpitService({
    port: 0,
    domainDatabasePath: join(scratch, "domain.db"),
    workspaces: {},
    actor: ACTOR
  });
  try {
    const health = await (await fetch(`${service.url}/api/health`)).json();
    criterion("health-states-configured-actor", health.actor === ACTOR, { reported: health.actor });

    const annotated = await (await fetch(`${service.url}/api/domain/annotation`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ partitionId: "TCRN-AOS", recordId: "work:proof", labels: ["attribution"] })
    })).json();
    criterion("domain-write-attributed-to-configured-actor",
      annotated.annotation?.updatedBy === ACTOR, { updatedBy: annotated.annotation?.updatedBy ?? null });
  } finally {
    await service.close();
  }

  // green, chain half — the surface's engine calls carry the configured actor.
  // A recording stand-in replaces the MCP client, so the assertion is about what
  // would reach the engine, byte for byte, without touching any chain.
  const calls = [];
  const recorder = { callTool: async (tool, args) => { calls.push({ tool, args }); return { record: { id: "work:recorded" } }; } };
  const surface = new SafeWriteSurface(recorder, { workspacePath: join(scratch, "no-chain"), actor: ACTOR });
  await surface.transition({ id: "work:recorded", status: "ready" });
  await surface.annotate({ id: "work:recorded", scope: "attribution probe" });
  criterion("chain-write-surface-sends-configured-actor",
    calls.length === 2 && calls.every((call) => call.args.actor === ACTOR),
    { actorsSent: calls.map((call) => call.args.actor) });

  receipt.ok = receipt.criteria.every((entry) => entry.ok);
} finally {
  await rm(scratch, { recursive: true, force: true });
}

await mkdir("evidence", { recursive: true });
await writeFile("evidence/aos-write-attribution-proof.json", `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify({ ok: receipt.ok, criteria: receipt.criteria.map((c) => ({ [c.name]: c.ok })) }, null, 2));
if (!receipt.ok) process.exitCode = 1;
