#!/usr/bin/env node
// Live proof for the projection pipeline (TCRN-AOS-STORY-001 / STORY-002).
//
// Runs the real client against the governed Workflow MCP facade over all four
// live chains, projects them into the store, exercises the read layers, and
// writes a receipt. It is a receipt-producing probe, not a gate: it cannot run
// where the governed copy is absent, so it stays out of `pnpm test`.
//
// What it is designed to catch: a projection that looks plausible but does not
// match the chain. Every count is cross-checked against the chain's own status
// version, and the run fails if the store's held version disagrees.

import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";

const engine = resolve(homedir(), ".tcrn-workflow/tcrn-workflow");
const serverPath = resolve(engine, "scripts/tcrn-workflow-mcp.mjs");
const platform = resolve(process.cwd(), "..");
const outPath = resolve(process.cwd(), "evidence/aos-projection-live-proof.json");

const { ChainClient, ChainIngestor, ProjectionStore, buildInbox, computeEffectiveUnresolved, reassemblePositions } =
  await import("../dist/packages/projection/src/index.js");

const partitions = [
  { partitionId: "cross-project", workspacePath: resolve(platform, ".tcrn-workspace/cross-project/workspace") },
  { partitionId: "TCRN-Design-System", workspacePath: resolve(platform, ".tcrn-workspace/TCRN-Design-System/workspace") },
  { partitionId: "TCRN-TMS", workspacePath: resolve(platform, ".tcrn-workspace/TCRN-TMS/workspace") },
  { partitionId: "TCRN-AOS", workspacePath: resolve(platform, ".tcrn-workspace/TCRN-AOS/workspace") }
];

const client = new ChainClient({ serverPath });
const store = new ProjectionStore();
const receipt = {
  schemaVersion: "aos.projection-live-proof.v1",
  ok: false,
  serverPath: serverPath.replace(homedir(), "<home>"),
  partitions: [],
  readLayers: {},
  notClaimed: [
    "no write to any chain is performed or claimed",
    "counts are this run's observation, not a stable property of the chains",
    "the projection is a derivative; the chain remains the truth"
  ]
};

try {
  await client.start();
  const ingestor = new ChainIngestor(client);
  const verifiedAt = new Date().toISOString().replace(/\.\d+Z$/, "Z");

  for (const source of partitions) {
    const started = process.hrtime.bigint();
    const { freshness, projection } = await ingestor.projectIfMoved(
      source, store.heldVersion(source.partitionId), verifiedAt);
    if (projection) store.replacePartition(projection);
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;

    // The store must agree with the chain it just read; a silent mismatch here
    // is exactly the "confidently wrong index" failure this pipeline must not have.
    const held = store.heldVersion(source.partitionId);
    if (held !== freshness.chainVersion) {
      throw new Error(`held ${String(held)} != chain ${freshness.chainVersion} for ${source.partitionId}`);
    }
    receipt.partitions.push({
      partitionId: source.partitionId,
      chainVersion: freshness.chainVersion,
      heldVersion: held,
      stale: freshness.stale,
      work: projection ? projection.work.length : null,
      gates: projection ? projection.gates.length : null,
      conferences: projection ? projection.conferences.length : null,
      positions: projection ? projection.positions.length : null,
      minutes: projection ? projection.minutes.length : null,
      elapsedMs: Math.round(elapsedMs)
    });
  }

  // Read layers, over the real records rather than fixtures.
  const allMinutes = store.listMinutes();
  const effective = computeEffectiveUnresolved(allMinutes);
  const inbox = buildInbox({
    gates: store.listGates(),
    conferences: store.listConferences(),
    effectiveUnresolved: effective,
    minutesById: new Map(allMinutes.map((entry) => [entry.id, {
      partitionId: entry.partitionId, externalKey: entry.externalKey, summary: entry.summary
    }]))
  });

  // Reassembly over the conference with the most positions: the platform's own
  // fragmented arguments are the hardest real case available.
  const conferences = store.listConferences();
  let widest = { conferenceId: null, partitionId: null, count: 0 };
  for (const conference of conferences) {
    const count = store.listPositions(conference.partitionId, conference.id).length;
    if (count > widest.count) {
      widest = { conferenceId: conference.id, partitionId: conference.partitionId, count };
    }
  }
  const reassembled = widest.conferenceId
    ? reassemblePositions(store.listPositions(widest.partitionId, widest.conferenceId))
    : [];

  receipt.readLayers = {
    minutesCount: allMinutes.length,
    surfaceUnresolved: effective.reduce((sum, entry) => sum + entry.surface.length, 0),
    effectiveUnresolved: effective.reduce((sum, entry) => sum + entry.effective.length, 0),
    inboxItems: inbox.length,
    ownerIntentItems: inbox.filter((item) => item.severity === "owner-intent").length,
    widestConferencePositions: widest.count,
    reassembledLogicalPositions: reassembled.length,
    largestFragmentRun: reassembled.reduce((max, entry) => Math.max(max, entry.fragmentCount), 0),
    searchHitsForGovernance: store.search("公约").length
  };

  const totalWork = receipt.partitions.reduce((sum, row) => sum + (row.work ?? 0), 0);
  if (totalWork === 0) throw new Error("projected zero work records across four live chains");

  receipt.ok = true;
  console.log(JSON.stringify({
    ok: true,
    partitions: receipt.partitions.map((row) => `${row.partitionId}@v${row.chainVersion}:${row.work}w/${row.elapsedMs}ms`),
    readLayers: receipt.readLayers
  }, null, 1));
} catch (error) {
  receipt.error = String(error?.message ?? error);
  console.error(JSON.stringify({ ok: false, error: receipt.error }));
  process.exitCode = 1;
} finally {
  await client.stop();
  store.close();
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(receipt, null, 2)}\n`);
}
