#!/usr/bin/env node
// Alert when the newest paired backup is overdue (MIN-007 D9 「到期告警」).
//
// The freshness basis is the pair's OWN recorded instant — `pairedAt` inside
// `pair-manifest.json` — and never the directory mtime. This is the runbook's
// hard-won lesson written into a predicate: OneDrive rewrites mtime when it
// syncs, so mtime dates the sync, not the backup. An alert keyed on mtime would
// call a week-old backup fresh every time the sync daemon touched it.
//
// This is also the one script in the family where the wall clock is legitimately
// one side of the comparison: the question being asked IS "how old is the newest
// pair as of now". Everything it reads on the other side is a recorded instant
// that does not move.
//
// Exit codes, scheduler-shaped:
//   0  — a pair exists and is younger than interval + grace
//   1  — no pair at all, or the newest pair is older than interval + grace;
//        the remedy command is printed so the alert carries its own fix
//
// No scheduler is installed here. The Owner wires launchd/cron themselves if
// and when they want the alert unattended — see the runbook for a ready-to-use
// stanza. This script only answers the question.
//
// Environment:
//   AOS_PAIRED_BACKUP_DEST       pair directory root (same default as paired-backup.mjs)
//   AOS_BACKUP_INTERVAL_HOURS    expected cadence, default 24
//   AOS_BACKUP_DUE_GRACE_HOURS   slack past the interval before alerting, default 6
//                                (a laptop asleep overnight is late, not absent)

import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { AOS_PARTITIONS } from "../deploy/aos-local-client/aos-partitions.mjs";
import { PARTITION_ID } from "../deploy/aos-resident-cockpit/manifest.mjs";

const destinationRoot = process.env.AOS_PAIRED_BACKUP_DEST
  ?? resolve(homedir(), "OneDrive/Github/tcrn-aos-paired-backups");
const intervalHours = Number.parseFloat(process.env.AOS_BACKUP_INTERVAL_HOURS ?? "24");
const graceHours = Number.parseFloat(process.env.AOS_BACKUP_DUE_GRACE_HOURS ?? "6");
const remedy = "cd <TCRN-AOS repo> && pnpm paired:backup   (or: pnpm build && node scripts/paired-backup.mjs)";

/** Receipts may travel as evidence; local absolute paths do not. */
const maskHome = (text) => String(text).split(homedir()).join("~");

/**
 * Where a partition's off-site pairs live. This MIRRORS `offsiteRootFor` in
 * paired-backup.mjs — the historical partition keeps the flat root it already
 * filled, every later chain is namespaced — and the roster is imported rather
 * than typed, so a sixth chain cannot be backed up while this alert stays quiet
 * about it.
 */
const offsiteRootFor = (partitionId) =>
  (partitionId === PARTITION_ID ? destinationRoot : join(destinationRoot, partitionId));

/**
 * The newest real pair under a root, dated by its own recorded instant.
 *
 * A directory counts only if it holds a readable `pair-manifest.json`, which is
 * also what keeps a partition subdirectory from being mistaken for a pair inside
 * the flat root the two layouts share.
 */
async function newestPair(root) {
  if (!existsSync(root)) return { pairedAt: null, pairId: null };
  const names = (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse();
  for (const name of names) {
    try {
      const manifest = JSON.parse(await readFile(join(root, name, "pair-manifest.json"), "utf8"));
      if (typeof manifest.pairedAt === "string") return { pairedAt: manifest.pairedAt, pairId: name };
    } catch {
      // A directory without a readable pair manifest is not a pair; keep looking back.
    }
  }
  return { pairedAt: null, pairId: null };
}

const now = new Date();
const thresholdHours = intervalHours + graceHours;

// Every governed chain is measured, not just the one that used to be the only
// relocated partition. An alert that reads one root out of five reports a green
// it has no evidence for — the failure the backup cadence itself already had
// once, when a local-only sweep kept succeeding after the chain it swept moved
// away. The verdict is the WORST chain: one stale chain is an overdue backup set.
const partitions = [];
for (const partitionId of Object.keys(AOS_PARTITIONS).sort()) {
  const root = offsiteRootFor(partitionId);
  const { pairedAt, pairId } = await newestPair(root);
  const ageHours = pairedAt === null
    ? null
    : (now.getTime() - new Date(pairedAt).getTime()) / 3_600_000;
  const state = pairedAt === null ? "no_pair" : (ageHours > thresholdHours ? "overdue" : "fresh");
  partitions.push({
    partition: partitionId,
    root: maskHome(root),
    latestPairId: pairId,
    latestPairedAt: pairedAt,
    ageHours: ageHours === null ? null : Math.round(ageHours * 100) / 100,
    state,
    ok: state === "fresh"
  });
}

const failing = partitions.filter((entry) => !entry.ok);
const receipt = {
  schemaVersion: "aos.backup-due-alert.v2",
  ruling: "MIN-007 D9 (due alert on the paired-backup cadence); roster widened to five chains by TCRN-CROSS-STORY-128",
  checkedAt: now.toISOString().replace(/\.\d{3}Z$/u, "Z"),
  destinationRoot: maskHome(destinationRoot),
  intervalHours,
  graceHours,
  thresholdHours,
  freshnessBasis: "pairedAt from pair-manifest.json; directory mtime is never consulted (OneDrive rewrites it on sync)",
  rosterSource: "deploy/aos-local-client/aos-partitions.mjs (imported, never typed here)",
  partitions,
  partitionsChecked: partitions.length,
  failingPartitions: failing.map((entry) => entry.partition),
  state: failing.length === 0
    ? "fresh"
    : (failing.every((entry) => entry.state === "no_pair") ? "no_pair" : "overdue"),
  ok: failing.length === 0
};

console.log(JSON.stringify(receipt, null, 2));
if (!receipt.ok) {
  console.log(`REMEDY: ${remedy}`);
  process.exitCode = 1;
}
