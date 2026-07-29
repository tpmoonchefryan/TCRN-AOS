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

const destinationRoot = process.env.AOS_PAIRED_BACKUP_DEST
  ?? resolve(homedir(), "OneDrive/Github/tcrn-aos-paired-backups");
const intervalHours = Number.parseFloat(process.env.AOS_BACKUP_INTERVAL_HOURS ?? "24");
const graceHours = Number.parseFloat(process.env.AOS_BACKUP_DUE_GRACE_HOURS ?? "6");
const remedy = "cd <TCRN-AOS repo> && pnpm paired:backup   (or: pnpm build && node scripts/paired-backup.mjs)";

/** Receipts may travel as evidence; local absolute paths do not. */
const maskHome = (text) => String(text).split(homedir()).join("~");

const now = new Date();
let latestPairedAt = null;
let latestPairId = null;
if (existsSync(destinationRoot)) {
  const names = (await readdir(destinationRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse();
  for (const name of names) {
    try {
      const manifest = JSON.parse(await readFile(
        join(destinationRoot, name, "pair-manifest.json"), "utf8"));
      if (typeof manifest.pairedAt === "string") {
        latestPairedAt = manifest.pairedAt;
        latestPairId = name;
        break;
      }
    } catch {
      // A directory without a readable pair manifest is not a pair; keep looking back.
    }
  }
}

const ageHours = latestPairedAt === null
  ? null
  : (now.getTime() - new Date(latestPairedAt).getTime()) / 3_600_000;
const thresholdHours = intervalHours + graceHours;
const state = latestPairedAt === null
  ? "no_pair"
  : (ageHours > thresholdHours ? "overdue" : "fresh");

const receipt = {
  schemaVersion: "aos.backup-due-alert.v1",
  ruling: "MIN-007 D9 (due alert on the paired-backup cadence)",
  checkedAt: now.toISOString().replace(/\.\d{3}Z$/u, "Z"),
  destinationRoot: maskHome(destinationRoot),
  latestPairId,
  latestPairedAt,
  ageHours: ageHours === null ? null : Math.round(ageHours * 100) / 100,
  intervalHours,
  graceHours,
  thresholdHours,
  freshnessBasis: "pairedAt from pair-manifest.json; directory mtime is never consulted (OneDrive rewrites it on sync)",
  state,
  ok: state === "fresh"
};

console.log(JSON.stringify(receipt, null, 2));
if (!receipt.ok) {
  console.log(`REMEDY: ${remedy}`);
  process.exitCode = 1;
}
