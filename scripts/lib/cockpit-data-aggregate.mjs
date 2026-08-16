// The cockpit's data aggregation, in one place.
//
// It was inline in scripts/build-cockpit-data.mjs while there was exactly one
// caller. The relocation produced a second one: the resident VM cockpit
// (TCRN-AOS-STORY-132) has to build the same document from the same projections,
// and a copied aggregation would drift from this one the first time either side
// gained a family. So the aggregation moved here and both callers import it.
//
// This module does no I/O and knows nothing about where a projection came from.
// That is what lets the source-side caller read all five chains through the
// local engine without either caller being able to change what the resulting
// document MEANS.

import { scrubHostPathsInText } from "./evidence-hygiene.mjs";

/**
 * Everything the cockpit renders, from a store already holding its projections.
 *
 * `projected` is the partition roster in the shape the views consume (id, label,
 * version, read path, which families that read path could not reach). It is the
 * caller's, because only the caller knows how each partition was read.
 */
export function aggregateCockpitData({ library, store, projected, verifiedAt }) {
  const { buildActivityFeed, buildInbox, computeEffectiveUnresolved, reassemblePositions } = library;

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
  // whose read path reached the log have one; the rest are marked unavailable in
  // the roster and the detail view says the log was not read rather than showing
  // a blank feed.
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

  return {
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
  };
}

/**
 * Which families a read path could not supply, named rather than inferred.
 *
 * Derived from the read path and never from empty arrays: "the fallback cannot
 * reach positions" and "this chain holds no positions" produce identical data,
 * and a view has to be able to tell a reader which one it is looking at.
 */
export function unavailableFamilies(readVia) {
  if (readVia === "export") return [];
  if (readVia === "paginated-with-deliberations") return ["events"];
  return ["positions", "minutes", "events"];
}

/**
 * The generated module, in the flavour its consumer compiles.
 *
 * `ts` is the repository's committed source, which the build compiles; `js` is
 * the already-compiled shape a staged deployment drops straight into `dist/`.
 * One renderer, because the DATA must be byte-identical in both and only the
 * wrapper differs.
 */
export function renderCockpitDataModule(data, { flavour, generator, note }) {
  // The projection contains chain-authored prose. A chain note can mention the
  // machine path that produced it, so scrub the generated published bytes at the
  // same boundary as receipts; checking only evidence/ would leave this typed
  // projection outside the privacy contract.
  const body = scrubHostPathsInText(JSON.stringify(data, null, 2));
  const header = `// GENERATED by ${generator} — do not edit.\n`
    + `// ${note}\n`;
  if (flavour === "ts") {
    return `${header}/* eslint-disable */\nimport type { CockpitData } from "./cockpit-types.js";\n\n`
      + `export const cockpitData: CockpitData = ${body};\n`;
  }
  if (flavour === "js") {
    return `${header}export const cockpitData = ${body};\n`;
  }
  throw new Error(`unknown generated-module flavour: ${String(flavour)}`);
}
