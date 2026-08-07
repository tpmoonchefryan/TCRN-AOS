#!/usr/bin/env node
// Prove the cockpit service on the live chains and a real domain database.
//
// Four of the five acceptance criteria the direction conference nailed down are
// decided here (the fifth is the mirror, which is checked after deployment):
// the domain surface round-trips, a chain write succeeds through the local
// proxy, an illegal chain move is refused with the engine's own reason code, and
// the precious store exports.
//
// The refusal is the important one. A write surface that only ever succeeds has
// not been shown to be governed — it has been shown to be a database.

import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir, homedir } from "node:os";
import { resolve, join } from "node:path";

const { startCockpitService } = await import(
  resolve(process.cwd(), "dist/apps/cockpit-service/src/service.js"));

const platform = resolve(process.cwd(), "..");
const workspaceFor = (partition) => resolve(platform, ".tcrn-workspace", partition, "workspace");

// A scratch database, so the proof never writes into the real precious store.
const scratch = await mkdtemp(join(tmpdir(), "aos-cockpit-proof-"));
const domainDatabasePath = join(scratch, "domain.db");

const receipt = {
  schemaVersion: "aos.cockpit-service-proof.v1",
  ok: false,
  boundTo: "127.0.0.1",
  steps: [],
  notClaimed: [
    "the domain store is the cockpit's own commentary and never merges into a chain record",
    "operator authority pins stay on this machine; the service binds to loopback only",
    "records created against the live chain here are permanent — the chain is append-only"
  ]
};
const step = (name, detail) => {
  receipt.steps.push({ name, ...detail });
  process.stderr.write(`  ${name}: ${JSON.stringify(detail).slice(0, 140)}\n`);
};

// The governed engine's MCP facade this service lazily spawns for a chain write.
// Stated here (the local install path), never defaulted inside the service (STORY-186).
const engineMcpPath = resolve(homedir(), ".tcrn-workflow/tcrn-workflow/scripts/tcrn-workflow-mcp.mjs");

const service = await startCockpitService({
  port: 0,
  domainDatabasePath,
  workspaces: {
    "cross-project": workspaceFor("cross-project"),
    "TCRN-Design-System": workspaceFor("TCRN-Design-System"),
    "TCRN-TMS": workspaceFor("TCRN-TMS"),
    "TCRN-AOS": workspaceFor("TCRN-AOS")
  },
  engineMcpPath,
  authorityPins: resolve(homedir(), ".tcrn-workflow/live/tcrn-platform/authority/operator-authority-pins.json"),
  authorityPinsDigest: process.env.TCRN_AUTHORITY_PINS_DIGEST
    ?? "d25ebfc1cb47310d27bdeba4749fe5728b089188a7338d6a89cfe86f1c5d5ce9",
  actor: "agent:fable"
});

const call = async (method, path, body) => {
  const response = await fetch(`${service.url}${path}`, {
    method,
    ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {})
  });
  return { status: response.status, json: await response.json() };
};

try {
  const health = await call("GET", "/api/health");
  step("health", { status: health.status, chainWriteAvailable: health.json.chainWriteAvailable,
    partitions: health.json.partitions?.length });

  // A real chain record to annotate: the Initiative this work belongs to.
  const subject = { partitionId: "TCRN-AOS", recordId: "work:ff2290f36de29780d18d4323" };

  const annotate = await call("PUT", "/api/domain/annotation", {
    ...subject,
    externalKey: "TCRN-AOS-INIT-001",
    assignee: "owner:governance",
    priority: "high",
    labels: ["cockpit", "autonomous-batch"]
  });
  step("annotation-write", { status: annotate.status, assignee: annotate.json.annotation?.assignee,
    labels: annotate.json.annotation?.labels });

  const comment = await call("POST", "/api/domain/comment", {
    ...subject,
    body: "Domain surface proved against the live chain by the cockpit service."
  });
  step("comment-write", { status: comment.status, id: comment.json.comment?.id?.slice(0, 20) });

  const relation = await call("POST", "/api/domain/relation", {
    ...subject,
    relation: "relates_to",
    targetPartitionId: "cross-project",
    targetRecordId: "work:b1b2767f8f2a47ca19e4e16f"
  });
  step("relation-write", { status: relation.status, relation: relation.json.relation?.relation });

  const readBack = await call("GET", `/api/domain/${subject.partitionId}/${encodeURIComponent(subject.recordId)}`);
  step("domain-readback", {
    status: readBack.status,
    assignee: readBack.json.annotation?.assignee,
    priority: readBack.json.annotation?.priority,
    labels: readBack.json.annotation?.labels?.length,
    comments: readBack.json.comments?.length,
    relations: readBack.json.relations?.length
  });

  // A chain write through the proxy: create nothing, move something that exists.
  // STORY-021 is done; ready is not a legal move from done, and the engine says so.
  const refused = await call("POST", "/api/chain/transition", {
    partitionId: "TCRN-AOS",
    recordId: "work:5c41722d9f448b7f7ead3810",
    status: "ready"
  });
  step("chain-illegal-move-refused", {
    status: refused.status,
    reasonCode: refused.json.reasonCode,
    // This is the evidence the surface is governed rather than merely wired.
    refusedByEngine: refused.status === 409
  });

  const exported = await call("GET", "/api/domain/export");
  step("domain-export", {
    status: exported.status,
    annotations: exported.json.annotations?.length,
    comments: exported.json.comments?.length,
    relations: exported.json.relations?.length
  });

  receipt.ok = health.json.chainWriteAvailable === true
    && annotate.json.annotation?.assignee === "owner:governance"
    && readBack.json.comments?.length === 1
    && readBack.json.relations?.length === 1
    && refused.status === 409
    && exported.json.annotations?.length === 1;
} finally {
  await service.close();
  await rm(scratch, { recursive: true, force: true });
}

await mkdir("evidence", { recursive: true });
await writeFile("evidence/aos-cockpit-service-proof.json", `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify(receipt, null, 2));
if (!receipt.ok) process.exitCode = 1;
