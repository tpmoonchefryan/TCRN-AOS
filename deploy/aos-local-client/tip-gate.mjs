#!/usr/bin/env node
// TCRN-CROSS-INIT-020 INC-075 — single-truth tip gate. The machine form of the
// S190 tip-remeasure protocol: every registered local chain must answer a
// complete head (version + 64-hex headEventHash), and its event-list tail must
// identify the same head.
//
// The VM facade and SSH ceremony were retired by S199/S200. Live proof therefore
// uses the local engine CLI only. Fixture mode remains a hermetic three-path
// harness for the historical fork red leg; it never makes a live claim.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { localEngine } from "./local-engine-read.mjs";
import { PARTITION_ROSTER } from "./topology.mjs";

const PARTITIONS = PARTITION_ROSTER.map((entry) => entry.partitionId);
const EVENT_PAGE_SIZE = 200;
const EVENT_MAX_PAGES = 100;
const HEAD_HASH = /^[a-f0-9]{64}$/u;

async function readLocalEventTail(partition) {
  const first = await localEngine("event-list", partition);
  if (!first.accepted) return { error: first.reasonCode ?? first.exitCode };
  const firstBody = first.json ?? {};
  if (!Array.isArray(firstBody.records)) return { error: "event-list returned no records array" };
  const records = [...firstBody.records];
  const total = Number.isInteger(firstBody.total) ? firstBody.total : records.length;
  for (let page = 1; firstBody.truncated === true && records.length < total && page <= EVENT_MAX_PAGES; page += 1) {
    const offset = records.length;
    const next = await localEngine("event-list", partition, { limit: EVENT_PAGE_SIZE, offset });
    if (!next.accepted) return { error: next.reasonCode ?? next.exitCode };
    const body = next.json ?? {};
    if (!Array.isArray(body.records) || body.records.length === 0) return { error: `empty event-list page at offset ${offset}` };
    records.push(...body.records);
  }
  if (records.length !== total) return { error: `event-list returned ${records.length} of ${total} events` };
  const tail = records.reduce((current, event) => (
    current === null || event.sequence > current.sequence ? event : current
  ), null);
  return tail === null
    ? { error: "event-list returned no events" }
    : { head: { version: tail.sequence, headEventHash: tail.eventHash }, records: records.length };
}

function headReading(label, head) {
  return {
    pathway: label,
    version: head?.version ?? null,
    headEventHash: head?.headEventHash ?? null,
  };
}

function validHead(head) {
  return head !== null
    && Number.isSafeInteger(head.version)
    && HEAD_HASH.test(head.headEventHash ?? "");
}

function headsAgree(left, right) {
  return validHead(left) && validHead(right)
    && left.version === right.version
    && left.headEventHash === right.headEventHash;
}

function judgeFixturePartition(partition, fixtureRow) {
  const facadeHead = fixtureRow.version === undefined
    ? null
    : { version: fixtureRow.version, headEventHash: fixtureRow.headEventHash, workspaceId: "fixture" };
  const ceremonyHead = fixtureRow.ceremonyVersion === undefined
    ? null
    : { version: fixtureRow.ceremonyVersion, headEventHash: fixtureRow.ceremonyHeadEventHash, workspaceId: "fixture-b" };
  const fileTrack = fixtureRow.fileVersion === undefined ? null : {
    sealed: fixtureRow.fileSealed ?? false,
    head: { version: fixtureRow.fileVersion, headEventHash: fixtureRow.fileHeadEventHash, workspaceId: "fixture-c" },
  };
  const readingA = facadeHead === null
    ? { pathway: "facade-read(pg)", error: "no answer" }
    : headReading("facade-read(pg)", facadeHead);
  const readingB = ceremonyHead === null
    ? { pathway: "ceremony-read(pg)", error: "no answer" }
    : headReading("ceremony-read(pg)", ceremonyHead);
  const readingC = fileTrack?.head === null || fileTrack?.head === undefined
    ? { pathway: "file-track(ssh)", error: "no answer" }
    : headReading(`file-track(ssh)${fileTrack.sealed ? ",sealed" : ",unsealed"}`, fileTrack.head);
  const agreeFile = !headsAgree(facadeHead, ceremonyHead)
    ? false
    : fileTrack?.sealed === true
      ? true
      : fileTrack?.sealed === false && headsAgree(fileTrack.head, facadeHead);
  return {
    row: { partition, facade: readingA, ceremony: readingB, fileTrack: readingC },
    divergent: !headsAgree(facadeHead, ceremonyHead) || !agreeFile
      ? { partition, readingA, readingB, readingC, sealed: fileTrack?.sealed ?? false }
      : null,
  };
}

export async function judgeTip({ fixturePath = null, live = true } = {}) {
  let fixture = null;
  if (fixturePath !== null) {
    fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
    live = false;
  }
  const rows = [];
  const divergent = [];
  for (const partition of PARTITIONS) {
    if (!live) {
      const judged = judgeFixturePartition(partition, fixture?.[partition] ?? {});
      rows.push(judged.row);
      if (judged.divergent !== null) divergent.push(judged.divergent);
      continue;
    }

    const status = await localEngine("status", partition);
    const statusHead = status.accepted
      ? { version: status.json?.version, headEventHash: status.json?.headEventHash, workspaceId: status.json?.workspaceId }
      : null;
    const tail = await readLocalEventTail(partition);
    const eventHead = tail.head === undefined ? null : { ...tail.head, workspaceId: statusHead?.workspaceId };
    const readingA = validHead(statusHead)
      ? headReading("local-engine(status)", statusHead)
      : { pathway: "local-engine(status)", error: status.reasonCode ?? status.exitCode ?? "invalid head" };
    const readingB = validHead(eventHead)
      ? headReading("local-engine(event-list-tail)", eventHead)
      : { pathway: "local-engine(event-list-tail)", error: tail.error ?? "invalid event tail" };
    rows.push({ partition, localEngine: readingA, eventTail: { ...readingB, records: tail.records ?? null } });
    if (!headsAgree(statusHead, eventHead)) divergent.push({ partition, readingA, readingB });
  }
  return {
    ok: divergent.length === 0,
    reasonCode: divergent.length === 0 ? "TIP_SINGLE_TRUTH_VERIFIED" : "TIP_TRUTH_DIVERGED",
    partitions: PARTITIONS.length,
    pathways: live
      ? ["local-engine(status)", "local-engine(event-list-tail)"]
      : ["facade-read(pg)", "ceremony-read(pg)", "file-track(ssh)"],
    rows,
    divergent,
  };
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href || process.argv[1]?.endsWith("tip-gate.mjs")) {
  const fixturePath = process.argv.includes("--fixture")
    ? resolve(process.argv[process.argv.indexOf("--fixture") + 1])
    : null;
  const result = await judgeTip({ fixturePath });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  for (const entry of result.divergent ?? []) {
    process.stderr.write(`  DIVERGED ${entry.partition}: A=${JSON.stringify(entry.readingA)} B=${JSON.stringify(entry.readingB)}\n`);
  }
  if (!result.ok) process.exitCode = 1;
}
