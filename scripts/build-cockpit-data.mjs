#!/usr/bin/env node
// Project the five live chains into the data file the cockpit renders from.
//
// This replaced the hand-written seed that carried the shell through its first
// build: what the cockpit shows comes from the chains by way of the projection
// pipeline, and the only hand-written part is the partition list.
//
// It writes a generated module rather than fetching at runtime because the
// cockpit is still statically rendered. When the API serves the projection
// directly, this script becomes the thing that stops running rather than a thing
// that has to be unwound.
//
// S199/S200 returned all five chains to this machine. Projection is therefore a
// local read-only engine/MCP operation for every partition; the retired VM facade
// is not a fallback and is never contacted by this source-side build.
//
// Environment:
//   AOS_COCKPIT_DATA_OUT   absolute output path. `.ts` emits the repository's
//                          committed source flavour, `.js` the already-compiled
//                          shape a staged deployment drops into dist/.
//                          Default: apps/web/src/cockpit-data.generated.ts

import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";

import {
  aggregateCockpitData, renderCockpitDataModule, unavailableFamilies
} from "./lib/cockpit-data-aggregate.mjs";

const engine = resolve(homedir(), ".tcrn-workflow/tcrn-workflow");
const serverPath = resolve(engine, "scripts/tcrn-workflow-mcp.mjs");
const platform = resolve(process.cwd(), "..");
const outPath = process.env.AOS_COCKPIT_DATA_OUT
  ?? resolve(process.cwd(), "apps/web/src/cockpit-data.generated.ts");
const flavour = outPath.endsWith(".ts") ? "ts" : "js";

const library = await import("../dist/packages/projection/src/index.js");
const { ChainClient, ChainIngestor, ProjectionStore } = library;

/**
 * Where each chain is, and who reads it. The roster is the topology authority;
 * no VM path or facade connection is reconstructed here.
 */
import { PARTITION_ROSTER } from "../deploy/aos-local-client/topology.mjs";

const partitions = [
  { partitionId: "cross-project", label: "Platform governance", labelZh: "平台治理" },
  { partitionId: "TCRN-Design-System", label: "Design System", labelZh: "设计系统" },
  { partitionId: "TCRN-TMS", label: "TMS", labelZh: "TMS" },
  { partitionId: "TCRN-AOS", label: "AOS", labelZh: "AOS" },
  { partitionId: "Joi-Button", label: "Joi Button", labelZh: "Joi Button" }
].map((entry) => {
  const target = PARTITION_ROSTER.find((candidate) => candidate.partitionId === entry.partitionId);
  if (!target || target.home !== "local") {
    throw new Error(`projection partition ${entry.partitionId} is not rostered as local`);
  }
  return {
    ...entry,
    on: "local",
    host: "local",
    workspacePath: resolve(platform, target.liveAddress)
  };
});

const client = new ChainClient({ serverPath });
const store = new ProjectionStore();

try {
  await client.start();
  const ingestor = new ChainIngestor(client);
  const verifiedAt = new Date().toISOString().replace(/\.\d+Z$/, "Z");

  const projected = [];
  for (const source of partitions) {
    const { projection } = await ingestor.projectIfMoved(source, undefined, verifiedAt);
    if (projection) store.replacePartition(projection);
    projected.push({
      id: source.partitionId,
      label: source.label,
      labelZh: source.labelZh,
      chainVersion: projection?.chainVersion ?? 0,
      verifiedAt,
      readVia: projection?.readVia ?? "paginated",
      // Where this chain began recording who acted. Null means it never has, and
      // the detail view says so rather than leaving the actor column blank.
      attestationFromSequence: projection?.actorAttestationFromSequence ?? null,
      unavailable: unavailableFamilies(projection?.readVia)
    });
    process.stderr.write(`  ${source.partitionId} @ v${projection?.chainVersion ?? "?"} (${source.on})\n`);
  }

  const data = aggregateCockpitData({ library, store, projected, verifiedAt });
  const module = renderCockpitDataModule(data, {
    flavour,
    generator: "scripts/build-cockpit-data.mjs",
    note: "Projected from the five governed chains at the versions recorded below; "
      + "all five chains are read by the local engine."
  });

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, module);
  console.log(JSON.stringify({
    ok: true,
    out: outPath,
    flavour,
    partitions: projected.map((row) => `${row.id}@v${row.chainVersion}`),
    work: data.work.length,
    gates: data.gates.length,
    conferences: data.conferences.length,
    inbox: data.inbox.length,
    threads: Object.keys(data.threads).length,
    minutes: Object.keys(data.minutesByConference).length,
    activityForWorkItems: Object.keys(data.activityByWork).length
  }));
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: String(error?.message ?? error) }));
  process.exitCode = 1;
} finally {
  await client.stop();
  store.close();
}
