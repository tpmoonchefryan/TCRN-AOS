#!/usr/bin/env node
// STORY-181 — bring the facade read service up on the VM.
//
// Mirrors apply-read-face.mjs in shape: stage the facade service + runner + the
// modules they import, rsync to the VM runtime with a per-file sha256 ledger
// compared both ways, install the rendered unit (three-way: rendered == committed
// == installed), enable/start, and prove — health answers readonly, a read verb
// answers with the engine's own reason code, and a mutating verb is refused with
// the MCP_REMOTE_WRITE_REFUSED family reason code.
//
// The proof is the part that matters, and it asks the LIVE VM, not the source:
// the unit binds 127.0.0.1 behind the SSH tunnel (CONF-007 D7), so the probe
// goes through a tunnel to the loopback address.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, cpSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  FACADE_ALLOWED_HOSTS, FACADE_ENGINE, FACADE_HOST, FACADE_PORT, FACADE_ROOT, FACADE_RUNTIME,
  FACADE_UNIT_NAME, FACADE_UNIT_PATH, FACADE_WORKSPACES, renderFacadeUnit
} from "./facade-read-manifest.mjs";
import { VM_HOST } from "./manifest.mjs";
import {
  STATE_DIR, compareLedgers, instant, localLedger, remoteLedger, rsyncToVm, run,
  saveState, shellQuote, sha256Text, ssh, stepper, systemctl
} from "./resident-lib.mjs";
import { scrubHostPaths } from "../../scripts/lib/evidence-hygiene.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const COMMITTED_UNIT = join(REPO_ROOT, "deploy/aos-resident-cockpit/tcrn-aos-facade-read.service");
const STAGE = join(STATE_DIR, "facade-read-stage");
const DEPLOYMENT_MD = join(REPO_ROOT, "deploy/aos-resident-cockpit/facade-read-DEPLOYMENT.md");

const receipt = {
  schemaVersion: "aos.facade-read-apply.v1",
  story: "TCRN-CROSS-STORY-181",
  ok: false,
  startedAt: instant(),
  steps: []
};
const step = stepper("facade-read-apply", receipt, (partial) => saveState("facade-read-apply", scrubHostPaths(partial)));

/* ---- 0. preconditions ---------------------------------------------------- */

for (const [what, path] of [
  ["facade service", join(REPO_ROOT, "deploy/aos-resident-cockpit/facade-read-service.mjs")],
  ["facade runner", join(REPO_ROOT, "deploy/aos-resident-cockpit/facade-read-runner.mjs")],
  ["remote-read-mcp", join(REPO_ROOT, "deploy/aos-local-client/remote-read-mcp.mjs")],
  ["rehearsal-lib", join(REPO_ROOT, "deploy/switch-rehearsal/rehearsal-lib.mjs")],
  ["evidence-hygiene", join(REPO_ROOT, "scripts/lib/evidence-hygiene.mjs")]
]) {
  if (!existsSync(path)) {
    step("preconditions", { ok: false, reasonCode: "FACADE_SOURCE_ABSENT", what, path });
  }
}
step("preconditions", {
  ok: true,
  reasonCode: "FACADE_SOURCE_PRESENT",
  host: VM_HOST,
  bind: `${FACADE_HOST}:${FACADE_PORT}`,
  engine: FACADE_ENGINE,
  partitions: Object.keys(FACADE_WORKSPACES),
  readonly: true,
  noWriteSurface: "no pins / ChainClient / mutating verb route by two-source derivation (gated by read-face-gate)"
});

/* ---- 1. stage and transfer the facade tree -------------------------------- */

rmSync(STAGE, { recursive: true, force: true });
mkdirSync(join(STAGE, "deploy"), { recursive: true });
cpSync(join(REPO_ROOT, "deploy/aos-local-client"), join(STAGE, "deploy/aos-local-client"), { recursive: true });
cpSync(join(REPO_ROOT, "deploy/aos-resident-cockpit"), join(STAGE, "deploy/aos-resident-cockpit"), { recursive: true });
// remote-read-mcp.mjs (which supplies the facade's two-source derivation) imports
// the switch-rehearsal library at module load for LOCAL_ENGINE; stage it so the
// facade tree is self-contained on the VM.
cpSync(join(REPO_ROOT, "deploy/switch-rehearsal"), join(STAGE, "deploy/switch-rehearsal"), { recursive: true });
mkdirSync(join(STAGE, "scripts/lib"), { recursive: true });
cpSync(join(REPO_ROOT, "scripts/lib/evidence-hygiene.mjs"), join(STAGE, "scripts/lib/evidence-hygiene.mjs"));
await rsyncToVm(join(STAGE, "."), FACADE_RUNTIME);

const localFiles = localLedger(join(STAGE, "."));
const remoteFiles = await remoteLedger(FACADE_RUNTIME);
const comparison = compareLedgers(localFiles, remoteFiles);
step("runtime-transferred", {
  ok: comparison.ok,
  reasonCode: comparison.ok ? "FACADE_RUNTIME_LEDGERS_EQUAL" : "FACADE_RUNTIME_LEDGERS_DIVERGENT",
  compared: comparison.compared,
  fileSetDigest: comparison.fileSetDigest,
  mismatched: comparison.mismatched
});

/* ---- 2. the unit: rendered, committed, installed — three-way ------------- */

const rendered = renderFacadeUnit();
const committed = existsSync(COMMITTED_UNIT) ? readFileSync(COMMITTED_UNIT, "utf8") : null;
if (committed === null || committed !== rendered) {
  step("committed-unit-matches-the-manifest", {
    ok: false,
    reasonCode: committed === null ? "FACADE_UNIT_ABSENT" : "FACADE_UNIT_DIFFERS_FROM_RENDERED",
    path: `deploy/aos-resident-cockpit/${FACADE_UNIT_NAME}`,
    remedy: "write the rendered unit to deploy/aos-resident-cockpit/tcrn-aos-facade-read.service and commit it"
  });
}
await run("rsync", ["--archive", DEPLOYMENT_MD, `${VM_HOST}:${FACADE_ROOT}/DEPLOYMENT.md`]);
await run("rsync", ["--archive", COMMITTED_UNIT, `${VM_HOST}:${FACADE_UNIT_PATH}`]);
const installed = (await ssh(["cat", FACADE_UNIT_PATH])).stdout;
step("unit-installed", {
  ok: installed === rendered,
  reasonCode: installed === rendered ? "FACADE_UNIT_INSTALLED_IDENTICAL" : "FACADE_UNIT_INSTALLED_DIFFERS",
  path: FACADE_UNIT_PATH,
  unitSha256: sha256Text(rendered),
  binds: `${FACADE_HOST}:${FACADE_PORT}`
});

/* ---- 3. enable, start, and prove it -------------------------------------- */

await systemctl(ssh, ["daemon-reload"]);
await systemctl(ssh, ["enable", FACADE_UNIT_NAME]);
await systemctl(ssh, ["restart", FACADE_UNIT_NAME]);

// The facade binds loopback on the VM, so the deploy proof curls the loopback
// address FROM the VM's own shell (the unit answers there; the SSH tunnel is how
// a remote client reaches it, and proving the tunnel is a client-side concern).
let health = null;
for (let attempt = 0; attempt < 30 && health === null; attempt += 1) {
  const probe = await ssh(["curl", "-s", "-m", "2", `http://127.0.0.1:${FACADE_PORT}/api/health`],
    { allowFailure: true });
  if (probe.code === 0 && probe.stdout.trim().startsWith("{")) health = JSON.parse(probe.stdout);
  else await new Promise((done) => setTimeout(done, 1000));
}

const isEnabled = await systemctl(ssh, ["is-enabled", FACADE_UNIT_NAME]);
const isActive = await systemctl(ssh, ["is-active", FACADE_UNIT_NAME]);

// A mutating verb against the read face must be refused with the reason code.
// The ssh helper joins argv with spaces and the remote shell tokenizes the
// line, so a `sh -c` wrapper would hand `sh` only the first word; the curl is
// passed as direct args with the JSON body single-quoted so it survives the
// remote tokenizer.
const mutationRefused = health === null ? null
  : (await ssh([
      "curl", "-s", "-X", "POST", "-H", "content-type: application/json",
      "-d", `'{"partition":"TCRN-AOS","arguments":{}}'`,
      `http://127.0.0.1:${FACADE_PORT}/api/engine/work-transition`,
    ], { allowFailure: true })).stdout.includes("MCP_REMOTE_WRITE_REFUSED") ? "409" : null;

step("facade-enabled-and-answering", {
  ok: isEnabled.stdout === "enabled" && isActive.stdout === "active"
    && health?.ok === true && health.readonly === true && health.chainWriteAvailable === false
    && mutationRefused !== null && mutationRefused === "409",
  reasonCode: "FACADE_ANSWERS_READONLY_ON_LOOPBACK",
  isEnabled: isEnabled.stdout,
  isActive: isActive.stdout,
  health,
  mutationRefusedStatus: mutationRefused
});

receipt.deployment = {
  host: VM_HOST,
  root: FACADE_ROOT,
  runtime: FACADE_RUNTIME,
  unit: FACADE_UNIT_PATH,
  bind: `${FACADE_HOST}:${FACADE_PORT}`,
  engine: FACADE_ENGINE,
  partitions: Object.keys(FACADE_WORKSPACES),
  writeSurface: "none — no pins, no ChainClient, no mutating verb route"
};
receipt.notClaimed = [
  "this is the loopback read face; it is reached through the SSH tunnel like the write face (CONF-007 D7)",
  "the LAN read face (cockpit-read) is untouched: it serves the web + domain store on the LAN",
  "VM deployment of the real five-partition chains is the STORY-188 window's job; until then this service runs the file backend"
];
receipt.ok = receipt.steps.every((entry) => entry.ok !== false);
receipt.finishedAt = instant();
saveState("facade-read-apply", scrubHostPaths(receipt));
console.log(JSON.stringify({
  ok: receipt.ok,
  reasonCodes: receipt.steps.map((entry) => entry.reasonCode),
  unit: FACADE_UNIT_PATH,
  health
}, null, 2));
if (!receipt.ok) process.exitCode = 1;
