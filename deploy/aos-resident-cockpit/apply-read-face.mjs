#!/usr/bin/env node
// STORY-140 — bring the read-only LAN face up on the VM.
//
// Mirrors the resident cockpit's apply.mjs in shape, smaller in scope: the read
// face carries no authority and owns no store. Its deploy is three things —
// stage the read service + runner, install the unit, enable/start/prove — and
// the proof is the part that matters: bound to the LAN interface, answering
// readonly on /api/health, and refusing a chain write.

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  READ_DOMAIN_DB, READ_HOST, READ_PORT, READ_ROOT, READ_RUNTIME, READ_UNIT_NAME,
  READ_UNIT_PATH, VM_HOST, renderReadUnit
} from "./read-face-manifest.mjs";
import {
  STATE_DIR, compareLedgers, instant, localLedger, remoteLedger, rsyncToVm, run,
  saveState, shellQuote, sha256Text, ssh, stepper, systemctl
} from "./resident-lib.mjs";
import { scrubHostPaths } from "../../scripts/lib/evidence-hygiene.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const COMMITTED_UNIT = join(REPO_ROOT, "deploy/aos-resident-cockpit/tcrn-aos-read.service");
const STAGE = join(STATE_DIR, "read-stage");
const DEPLOYMENT_MD = join(REPO_ROOT, "deploy/aos-resident-cockpit/read-face-DEPLOYMENT.md");

const receipt = {
  schemaVersion: "aos.read-face-apply.v1",
  story: "TCRN-AOS-STORY-140",
  ruling: "MIN-014: 读面放整个 LAN、独立只读进程、写面维持 loopback+SSH",
  ok: false,
  startedAt: instant(),
  steps: []
};
const step = stepper("read-face-apply", receipt, (partial) => saveState("read-face-apply", scrubHostPaths(partial)));

/* ---- 0. preconditions ---------------------------------------------------- */

const readServiceLocal = join(REPO_ROOT, "dist/apps/cockpit-read/src/read-service.js");
step("preconditions", {
  ok: existsSync(readServiceLocal),
  reasonCode: "READ_FACE_BUILD_PRESENT",
  localReadService: readServiceLocal,
  host: VM_HOST,
  bind: `${READ_HOST}:${READ_PORT}`,
  readOnly: true,
  noWriteSurface: "no ChainClient / pins / /api/chain/* by construction (STORY-138, gated by read-face-gate)"
});

/* ---- 1. stage and transfer the read service + runner --------------------- */

rmSync(STAGE, { recursive: true, force: true });
mkdirSync(join(STAGE, "runtime"), { recursive: true });
cpSync(join(REPO_ROOT, "dist"), join(STAGE, "runtime/dist"), { recursive: true });
// The read service resolves the domain migrations from cwd; the precious store's
// schema loader needs them present on the VM (the resident apply does the same).
cpSync(join(REPO_ROOT, "packages/db/migrations/domain"),
  join(STAGE, "runtime/packages/db/migrations/domain"), { recursive: true });
cpSync(join(REPO_ROOT, "deploy/aos-resident-cockpit/read-face-runner.mjs"),
  join(STAGE, "runtime/read-face-runner.mjs"));
await rsyncToVm(join(STAGE, "runtime"), READ_RUNTIME);

const localFiles = localLedger(join(STAGE, "runtime"));
const remoteFiles = await remoteLedger(READ_RUNTIME);
const comparison = compareLedgers(localFiles, remoteFiles);
step("runtime-transferred", {
  ok: comparison.ok,
  reasonCode: comparison.ok ? "READ_RUNTIME_LEDGERS_EQUAL" : "READ_RUNTIME_LEDGERS_DIVERGENT",
  compared: comparison.compared,
  fileSetDigest: comparison.fileSetDigest,
  mismatched: comparison.mismatched,
  webServedFromResident: "AOS_STATIC_ROOT points at the resident cockpit's own web",
  domainReadFromResident: READ_DOMAIN_DB
});

/* ---- 2. the unit: rendered, committed, installed — three-way ------------- */

const rendered = renderReadUnit();
const committed = existsSync(COMMITTED_UNIT) ? readFileSync(COMMITTED_UNIT, "utf8") : null;
if (committed === null || committed !== rendered) {
  step("committed-unit-matches-the-manifest", {
    ok: false,
    reasonCode: committed === null ? "READ_UNIT_ABSENT" : "READ_UNIT_DIFFERS_FROM_RENDERED",
    path: `deploy/aos-resident-cockpit/${READ_UNIT_NAME}`,
    remedy: "write the rendered unit to deploy/aos-resident-cockpit/tcrn-aos-read.service and commit it"
  });
}
await run("rsync", ["--archive", DEPLOYMENT_MD, `${VM_HOST}:${READ_ROOT}/DEPLOYMENT.md`]);
await run("rsync", ["--archive", COMMITTED_UNIT, `${VM_HOST}:${READ_UNIT_PATH}`]);
const installed = (await ssh(["cat", READ_UNIT_PATH])).stdout;
step("unit-installed", {
  ok: installed === rendered,
  reasonCode: installed === rendered ? "READ_UNIT_INSTALLED_IDENTICAL" : "READ_UNIT_INSTALLED_DIFFERS",
  path: READ_UNIT_PATH,
  unitSha256: sha256Text(rendered),
  binds: `${READ_HOST}:${READ_PORT}`,
  allowedHosts: (installed.match(/AOS_ALLOWED_HOSTS=(.+)$/m) ?? [])[1] ?? null
});

/* ---- 3. enable, start, and prove it ------------------------------------- */

await systemctl(ssh, ["daemon-reload"]);
await systemctl(ssh, ["enable", READ_UNIT_NAME]);
await systemctl(ssh, ["restart", READ_UNIT_NAME]);

let health = null;
for (let attempt = 0; attempt < 30 && health === null; attempt += 1) {
  // Probe the LAN address itself (not loopback) — the whole point is that the
  // read face answers where the browser on the LAN will reach it.
  const probe = await ssh(["curl", "-s", "-m", "2", `http://${READ_HOST}:${READ_PORT}/api/health`],
    { allowFailure: true });
  if (probe.code === 0 && probe.stdout.trim().startsWith("{")) health = JSON.parse(probe.stdout);
  else await new Promise((done) => setTimeout(done, 1000));
}
const isEnabled = await systemctl(ssh, ["is-enabled", READ_UNIT_NAME]);
const isActive = await systemctl(ssh, ["is-active", READ_UNIT_NAME]);

// A write method against the read face must be refused — prove the surface is
// read-only on the live deployment, not just in the unit test. The curl needs
// its quoted args preserved, so it runs through `sh -c` as one remote script
// (array args to ssh are re-joined and re-tokenized by the remote shell).
const writeRefused = health === null ? null
  : (await ssh(["sh", "-c",
      `'curl -s -o /dev/null -w "%{http_code}" -X POST -H "content-type: application/json" `
      + `-d "{}" http://${READ_HOST}:${READ_PORT}/api/chain/work'`], { allowFailure: true })).stdout.trim();

step("read-face-enabled-and-answering", {
  ok: isEnabled.stdout === "enabled" && isActive.stdout === "active"
    && health?.ok === true && health.readonly === true
    && health.chainWriteAvailable === false
    && writeRefused !== null && (writeRefused === "404" || writeRefused === "405"),
  reasonCode: "READ_FACE_ANSWERS_ON_LAN_READONLY",
  isEnabled: isEnabled.stdout,
  isActive: isActive.stdout,
  health,
  writeRefusedStatus: writeRefused,
  lanProbe: `http://${READ_HOST}:${READ_PORT}/api/health`,
  boundTo: `${READ_HOST}:${READ_PORT}`
});

receipt.deployment = {
  host: VM_HOST,
  root: READ_ROOT,
  runtime: READ_RUNTIME,
  unit: READ_UNIT_PATH,
  bind: `${READ_HOST}:${READ_PORT}`,
  staticWeb: "resident cockpit's web (read)",
  domainStore: READ_DOMAIN_DB + " (SQLite read-only)",
  writeSurface: "none — no ChainClient, no pins, no /api/chain/*"
};
receipt.notClaimed = [
  "the write face is untouched: it stays on 127.0.0.1 behind SSH (verified by read-face-proof)",
  "this is a read-only LAN exposure by Owner decision (MIN-014): governance records are readable on the LAN, no per-viewer auth",
  "Host allow-list is the LAN IP; DNS-rebinding is refused by the service"
];
receipt.ok = receipt.steps.every((entry) => entry.ok !== false);
receipt.finishedAt = instant();
saveState("read-face-apply", scrubHostPaths(receipt));
console.log(JSON.stringify({
  ok: receipt.ok,
  reasonCodes: receipt.steps.map((entry) => entry.reasonCode),
  unit: READ_UNIT_PATH,
  health
}, null, 2));
if (!receipt.ok) process.exitCode = 1;
