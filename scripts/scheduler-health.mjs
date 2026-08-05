#!/usr/bin/env node
// TCRN-CROSS-INC-032 — do this machine's scheduled agents actually run?
//
// WHY THIS EXISTS. Three launchd agents shared one defect: they ran
// `/bin/sh -lc … pnpm …`, and a login `sh` under launchd does not source the file
// that puts the nvm-managed pnpm on PATH. Every fire died at exit 127. The
// read-face refresh had therefore NEVER succeeded from the day it was installed —
// the one page update anyone saw came from a hand-run apply — and the paired
// backup was in the same state. It ran unseen for a day because
// `grep -rn launchctl` over this repository returned nothing: no gate anywhere
// read a scheduler's exit status. A schedule that fails silently is worse than
// no schedule, because the calendar entry is mistaken for the work.
//
// WHAT IT ASSERTS, both directions:
//   - every agent this repository ships a template for is LOADED, and
//   - each one's LAST EXIT STATUS is 0.
// A non-zero status, or a template with no loaded agent, is red.
//
// THE ROSTER IS DERIVED, NOT TYPED. Expected labels come from the `Label` key of
// the committed plist templates beside this repository's deploy recipes, so
// adding an agent to the repository adds it to this check with no second edit —
// the same "state topology once" discipline as topology.mjs.
//
//   node scripts/scheduler-health.mjs
//   TCRN_SCHEDULER_PROBE=<file> node scripts/scheduler-health.mjs   # test double
//
// The probe file carries `launchctl list` output verbatim, which is how the red
// side is exercised without breaking a real agent to watch it fail.

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = resolve(HERE, "../deploy/aos-resident-cockpit");

/** Labels this repository ships a launchd template for. */
export function expectedLabels(templateDir = TEMPLATE_DIR) {
  const labels = [];
  for (const name of readdirSync(templateDir).sort()) {
    if (!name.endsWith(".plist")) continue;
    const text = readFileSync(join(templateDir, name), "utf8");
    const match = /<key>Label<\/key>\s*<string>([^<]+)<\/string>/u.exec(text);
    if (match) labels.push(match[1]);
  }
  return labels;
}

/**
 * `launchctl list` prints `PID<TAB>STATUS<TAB>LABEL`; PID is `-` when the agent
 * is not currently running, which is the normal state for a scheduled job.
 * STATUS is the exit status of its LAST run — the field nothing was reading.
 */
export function parseLaunchctlList(text) {
  const rows = new Map();
  for (const line of text.split("\n")) {
    const parts = line.split("\t");
    if (parts.length < 3) continue;
    const [pid, status, label] = [parts[0].trim(), parts[1].trim(), parts.slice(2).join("\t").trim()];
    if (label === "Label" || !label) continue;
    rows.set(label, { running: pid !== "-", pid, lastExit: Number.parseInt(status, 10) });
  }
  return rows;
}

export function judge({ expected, rows }) {
  const agents = expected.map((label) => {
    const row = rows.get(label);
    if (!row) return { label, loaded: false, ok: false, reason: "SCHEDULER_AGENT_NOT_LOADED" };
    // A running agent has not produced this run's status yet; its previous one
    // still stands, so it is judged the same way rather than skipped.
    const ok = Number.isInteger(row.lastExit) && row.lastExit === 0;
    return {
      label, loaded: true, running: row.running, lastExit: row.lastExit, ok,
      reason: ok ? "SCHEDULER_AGENT_LAST_RUN_CLEAN" : "SCHEDULER_AGENT_LAST_RUN_FAILED",
      ...(row.lastExit === 127 ? { hint: "127 is command-not-found: the agent's PATH does not reach pnpm/node (INC-032)" } : {})
    };
  });
  const failed = agents.filter((a) => !a.ok);
  return {
    ok: failed.length === 0,
    reasonCode: failed.length === 0
      ? "SCHEDULER_AGENTS_HEALTHY"
      : (failed.some((a) => !a.loaded) ? "SCHEDULER_AGENT_NOT_LOADED" : "SCHEDULER_AGENT_LAST_RUN_FAILED"),
    gate: "tcrn-scheduler-health",
    invariants: [
      "every launchd template shipped by this repository has a loaded agent",
      "each loaded agent's last run exited 0"
    ],
    agents,
    failed: failed.map((a) => a.label)
  };
}

function main() {
  const probe = process.env.TCRN_SCHEDULER_PROBE;
  const listing = probe
    ? readFileSync(probe, "utf8")
    : execFileSync("launchctl", ["list"], { encoding: "utf8" });
  const verdict = judge({ expected: expectedLabels(), rows: parseLaunchctlList(listing) });
  process.stdout.write(`${JSON.stringify(verdict, null, 2)}\n`);
  process.exit(verdict.ok ? 0 : 1);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
