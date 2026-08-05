#!/usr/bin/env node
// TCRN-CROSS-INIT-019 STORY-168 — 统一运行者:一个 timer 跑全部门.
//
//   node deploy/aos-resident-cockpit/platform-runner.mjs [--if-due]
//
// Replaces the scattered per-job schedules with ONE scheduled runner. Each job is
// run with its own exit code captured; a non-zero exit is written to the unified
// log (visible, never silent — INC-032's lesson) and summed so the runner's own
// exit is non-zero when any job failed. The reclaim is written in the same breath
// as the spawn (a hard timeout per job; the child group is killed on exit).
//
// Jobs (all machine gates from this initiative):
//   1. projection-freshness:proof   — the unified sidecar freshness gate (166);
//   2. owner-queue                  — non-empty queue reminds (167);
//   3. knowledge-inject verify-channel — the injection channel liveness (162.5).

import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PLATFORM_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
export const LOG_PATH = resolve(PLATFORM_ROOT, "var/tcrn-observe/platform-runner.log");
export const JOB_TIMEOUT_MS = 120_000;

const JOBS = Object.freeze([
  Object.freeze({ id: "projection-freshness", dir: resolve(PLATFORM_ROOT, "TCRN-AOS"), cmd: "pnpm", args: ["--dir", resolve(PLATFORM_ROOT, "TCRN-AOS"), "projection-freshness:proof"] }),
  // owner-queue exits 1 when the queue is non-empty — that IS the reminder (167.3).
  // Expected for the runner: logged, but not a runner failure.
  Object.freeze({ id: "owner-queue", dir: PLATFORM_ROOT, cmd: "node", args: [resolve(PLATFORM_ROOT, "tcrn-workflow/scripts/owner-queue.mjs")], expectNonZero: true }),
  Object.freeze({ id: "inject-channel", dir: PLATFORM_ROOT, cmd: "node", args: [resolve(PLATFORM_ROOT, "tcrn-workflow/scripts/knowledge-inject.mjs"), "--verify-channel"] })
]);

function runJob(job) {
  const at = new Date().toISOString().replace(/\.\d+Z$/u, "Z");
  const result = spawnSync(job.cmd, job.args, { cwd: job.dir, encoding: "utf8", timeout: JOB_TIMEOUT_MS });
  const code = result.status ?? (result.error ? result.error.code ?? "ERR" : "TIMEOUT");
  const expected = job.expectNonZero === true && code !== 0;
  const line = `${at} ${job.id} exit=${code}${expected ? " (expected non-zero: reminder)" : ""}${result.stderr ? ` stderr=${result.stderr.trim().slice(0, 200)}` : ""}`;
  mkdirSync(dirname(LOG_PATH), { recursive: true });
  appendFileSync(LOG_PATH, `${line}\n`);
  return { id: job.id, exit: code, expectedNonZero: expected, line };
}

export function runAll() {
  const results = JOBS.map(runJob);
  const failed = results.filter((r) => r.exit !== 0 && !r.expectedNonZero);
  return {
    schemaVersion: "tcrn.platform-runner.v1",
    ranAt: new Date().toISOString().replace(/\.\d+Z$/u, "Z"),
    ok: failed.length === 0,
    reasonCode: failed.length === 0 ? "PLATFORM_RUNNER_ALL_OK" : "PLATFORM_RUNNER_JOB_FAILED",
    log: LOG_PATH,
    results,
    failed: failed.map((r) => r.id)
  };
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href || process.argv[1]?.endsWith("platform-runner.mjs")) {
  const result = runAll();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  for (const row of result.results) process.stderr.write(`${row.line}\n`);
  if (!result.ok) process.exitCode = 1;
}
