#!/usr/bin/env node
// Project the four live chains into the data file the cockpit renders from.
//
// This replaces the hand-written seed that carried the shell through its first
// build: from here on, what the cockpit shows comes from the chains by way of
// the projection pipeline, and the only hand-written part is the partition list.
//
// It writes a generated module rather than fetching at runtime because the
// cockpit is still statically rendered. When the API serves the projection
// directly, this script becomes the thing that stops running rather than a thing
// that has to be unwound.

import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";

const engine = resolve(homedir(), ".tcrn-workflow/tcrn-workflow");
const serverPath = resolve(engine, "scripts/tcrn-workflow-mcp.mjs");
const platform = resolve(process.cwd(), "..");
const outPath = resolve(process.cwd(), "apps/web/src/cockpit-data.generated.ts");

const {
  ChainClient, ChainIngestor, ProjectionStore,
  buildActivityFeed, buildInbox, computeEffectiveUnresolved, reassemblePositions
} = await import("../dist/packages/projection/src/index.js");

const partitions = [
  { partitionId: "cross-project", label: "Platform governance", labelZh: "平台治理" },
  { partitionId: "TCRN-Design-System", label: "Design System", labelZh: "设计系统" },
  { partitionId: "TCRN-TMS", label: "TMS", labelZh: "TMS" },
  { partitionId: "TCRN-AOS", label: "AOS", labelZh: "AOS" }
].map((entry) => ({
  ...entry,
  workspacePath: resolve(platform, ".tcrn-workspace", entry.partitionId, "workspace")
}));

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
      // Sections a partition could not supply are named, so a view can say
      // "not read here" instead of rendering a confident empty list. Derived
      // from the read path rather than from empty arrays: the fallback cannot
      // reach these families at all, which is a different fact from a chain
      // that happens to hold none of them.
      unavailable: projection?.readVia === "paginated"
        ? ["positions", "minutes", "events"]
        : []
    });
    process.stderr.write(`  ${source.partitionId} @ v${projection?.chainVersion ?? "?"}\n`);
  }

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

  const work = store.listWork({ limit: 5000 });
  const conferences = store.listConferences();
  const gates = store.listGates();

  // Position threads, reassembled at build time so the view renders arguments
  // rather than fragments. Only the partitions whose threads were readable
  // contribute; the rest are marked unavailable and the view says so.
  const threads = {};
  for (const conference of conferences) {
    const positions = store.listPositions(conference.partitionId, conference.id);
    if (positions.length === 0) continue;
    threads[conference.id] = reassemblePositions(positions).map((entry) => ({
      conferenceId: entry.conferenceId,
      actorId: entry.actorId,
      fragmentIds: entry.fragmentIds,
      externalKeys: entry.externalKeys.filter(Boolean),
      body: entry.body,
      fragmentCount: entry.fragmentCount
    }));
  }
  const minutesByConference = {};
  for (const entry of allMinutes) {
    minutesByConference[entry.conferenceId] = {
      id: entry.id,
      externalKey: entry.externalKey,
      summary: entry.summary,
      outcomeClass: entry.outcomeClass,
      decisions: entry.decisions,
      unresolvedIssues: entry.unresolvedIssues,
      effective: effective.find((row) => row.minutesId === entry.id)?.effective ?? entry.unresolvedIssues
    };
  }

  // A work item's own history, from the chain's event log. Only the partitions
  // read through `export` have one; the rest are marked unavailable above and
  // the detail view says the log was not read rather than showing a blank feed.
  const activityByWork = {};
  for (const item of work) {
    const events = store.listEvents({ partitionId: item.partitionId, subjectId: item.id });
    if (events.length === 0) continue;
    activityByWork[item.id] = buildActivityFeed(
      events, store.attestationFromSequence(item.partitionId) ?? null
    ).map((entry) => ({
      id: entry.id,
      sequence: entry.sequence,
      occurredAt: entry.occurredAt,
      operation: entry.operation,
      actorId: entry.actorId,
      attribution: entry.attribution
    }));
  }

  const module = `// GENERATED by scripts/build-cockpit-data.mjs — do not edit.
// Projected from the four governed chains at the versions recorded below.
/* eslint-disable */
import type { CockpitData } from "./cockpit-types.js";

export const cockpitData: CockpitData = ${JSON.stringify({
    generatedAt: verifiedAt,
    partitions: projected,
    work: work.map((row) => ({
      partitionId: row.partitionId,
      id: row.id,
      externalKey: row.externalKey,
      kind: row.kind,
      status: row.status,
      parentId: row.parentId,
      revision: row.revision,
      scope: row.scope,
      decidedBy: row.decidedBy,
      sprintWorkId: row.sprintWorkId
    })),
    gates: gates.map((row) => ({
      partitionId: row.partitionId,
      id: row.id,
      externalKey: row.externalKey,
      title: row.title,
      status: row.status,
      outcomeClass: row.outcomeClass,
      workId: row.workId
    })),
    conferences: conferences.map((row) => ({
      partitionId: row.partitionId,
      id: row.id,
      externalKey: row.externalKey,
      title: row.title,
      type: row.type,
      status: row.status,
      workIds: row.workIds
    })),
    inbox,
    effectiveUnresolved: effective.filter((entry) => entry.effective.length > 0),
    threads,
    minutesByConference,
    activityByWork
  }, null, 2)};
`;

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, module);
  console.log(JSON.stringify({
    ok: true,
    partitions: projected.map((row) => `${row.id}@v${row.chainVersion}`),
    work: work.length,
    gates: gates.length,
    conferences: conferences.length,
    inbox: inbox.length,
    threads: Object.keys(threads).length,
    minutes: Object.keys(minutesByConference).length,
    activityForWorkItems: Object.keys(activityByWork).length
  }));
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: String(error?.message ?? error) }));
  process.exitCode = 1;
} finally {
  await client.stop();
  store.close();
}
