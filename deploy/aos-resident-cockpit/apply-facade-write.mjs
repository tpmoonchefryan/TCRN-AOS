#!/usr/bin/env node
// STORY-184 — bring the facade WRITE service up on the VM.
//
// Mirrors apply-facade-read.mjs in shape: stage the facade service + runner + the
// modules they import, rsync to the VM runtime with a per-file sha256 ledger
// compared both ways, install the rendered unit (three-way: rendered == committed
// == installed), enable/start, and prove — health answers a WRITE face
// (readonly:false, chainWriteAvailable:true, noPins:true), and a DRY-RUN ceremony
// against the real TCRN-TMS chain plans and reads the live chain head WITHOUT
// sending (CEREMONY_PLANNED_ONLY, chain version unchanged). The real governed
// write is the STORY-184 proof itself, driven through the SSH tunnel afterwards;
// a deployment recipe must not perform one as a side effect of deploying.
//
// The proof asks the LIVE VM, not the source: the unit binds 127.0.0.1 behind the
// SSH tunnel (CONF-007 D7), so the probe goes through a tunnel to the loopback
// address.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, cpSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  FACADE_WRITE_ALLOWED_HOSTS, FACADE_WRITE_ACTOR, FACADE_WRITE_ENGINE, FACADE_WRITE_EVIDENCE,
  FACADE_WRITE_HOST, FACADE_WRITE_PORT, FACADE_WRITE_ROOT, FACADE_WRITE_RUNTIME,
  FACADE_WRITE_UNIT_NAME, FACADE_WRITE_UNIT_PATH, FACADE_WRITE_WORKSPACES,
  renderFacadeWriteUnit
} from "./facade-write-manifest.mjs";
import { VM_HOST } from "./manifest.mjs";
import {
  STATE_DIR, compareLedgers, instant, localLedger, remoteLedger, rsyncToVm, run,
  saveState, sha256Text, ssh, stepper, systemctl
} from "./resident-lib.mjs";
import { scrubHostPaths } from "../../scripts/lib/evidence-hygiene.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const COMMITTED_UNIT = join(REPO_ROOT, "deploy/aos-resident-cockpit/tcrn-aos-facade-write.service");
const STAGE = join(STATE_DIR, "facade-write-stage");
const DEPLOYMENT_MD = join(REPO_ROOT, "deploy/aos-resident-cockpit/facade-write-DEPLOYMENT.md");

const receipt = {
  schemaVersion: "aos.facade-write-apply.v1",
  story: "TCRN-CROSS-STORY-184",
  ok: false,
  startedAt: instant(),
  steps: []
};
const step = stepper("facade-write-apply", receipt, (partial) => saveState("facade-write-apply", scrubHostPaths(partial)));

/* ---- 0. preconditions ---------------------------------------------------- */

for (const [what, path] of [
  ["write service", join(REPO_ROOT, "deploy/aos-resident-cockpit/facade-write-service.mjs")],
  ["write runner", join(REPO_ROOT, "deploy/aos-resident-cockpit/facade-write-runner.mjs")],
  ["read service (runEngineCli)", join(REPO_ROOT, "deploy/aos-resident-cockpit/facade-read-service.mjs")],
  ["ceremony-plan", join(REPO_ROOT, "deploy/aos-local-client/ceremony-plan.mjs")],
  ["remote-read-mcp", join(REPO_ROOT, "deploy/aos-local-client/remote-read-mcp.mjs")],
  ["topology", join(REPO_ROOT, "deploy/aos-local-client/topology.mjs")],
  ["aos-partitions", join(REPO_ROOT, "deploy/aos-local-client/aos-partitions.mjs")],
  ["rehearsal-lib", join(REPO_ROOT, "deploy/switch-rehearsal/rehearsal-lib.mjs")],
  ["evidence-hygiene", join(REPO_ROOT, "scripts/lib/evidence-hygiene.mjs")]
]) {
  if (!existsSync(path)) {
    step("preconditions", { ok: false, reasonCode: "FACADE_WRITE_SOURCE_ABSENT", what, path });
  }
}
step("preconditions", {
  ok: true,
  reasonCode: "FACADE_WRITE_SOURCE_PRESENT",
  host: VM_HOST,
  bind: `${FACADE_WRITE_HOST}:${FACADE_WRITE_PORT}`,
  engine: FACADE_WRITE_ENGINE,
  partitions: Object.keys(FACADE_WRITE_WORKSPACES),
  readonly: false,
  chainWriteAvailable: true,
  noPins: "no pins / no authority argument; the only write path is the one ceremony endpoint (two-source derivation)"
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
await rsyncToVm(join(STAGE, "."), FACADE_WRITE_RUNTIME);

const localFiles = localLedger(join(STAGE, "."));
const remoteFiles = await remoteLedger(FACADE_WRITE_RUNTIME);
const comparison = compareLedgers(localFiles, remoteFiles);
step("runtime-transferred", {
  ok: comparison.ok,
  reasonCode: comparison.ok ? "FACADE_WRITE_RUNTIME_LEDGERS_EQUAL" : "FACADE_WRITE_RUNTIME_LEDGERS_DIVERGENT",
  compared: comparison.compared,
  fileSetDigest: comparison.fileSetDigest,
  mismatched: comparison.mismatched
});

/* ---- 2. the unit: rendered, committed, installed — three-way ------------- */

const rendered = renderFacadeWriteUnit();
const committed = existsSync(COMMITTED_UNIT) ? readFileSync(COMMITTED_UNIT, "utf8") : null;
if (committed === null || committed !== rendered) {
  step("committed-unit-matches-the-manifest", {
    ok: false,
    reasonCode: committed === null ? "FACADE_WRITE_UNIT_ABSENT" : "FACADE_WRITE_UNIT_DIFFERS_FROM_RENDERED",
    path: `deploy/aos-resident-cockpit/${FACADE_WRITE_UNIT_NAME}`,
    remedy: "write the rendered unit to deploy/aos-resident-cockpit/tcrn-aos-facade-write.service and commit it"
  });
}
await run("rsync", ["--archive", DEPLOYMENT_MD, `${VM_HOST}:${FACADE_WRITE_ROOT}/DEPLOYMENT.md`]);
await run("rsync", ["--archive", COMMITTED_UNIT, `${VM_HOST}:${FACADE_WRITE_UNIT_PATH}`]);
const installed = (await ssh(["cat", FACADE_WRITE_UNIT_PATH])).stdout;
step("unit-installed", {
  ok: installed === rendered,
  reasonCode: installed === rendered ? "FACADE_WRITE_UNIT_INSTALLED_IDENTICAL" : "FACADE_WRITE_UNIT_INSTALLED_DIFFERS",
  path: FACADE_WRITE_UNIT_PATH,
  unitSha256: sha256Text(rendered),
  binds: `${FACADE_WRITE_HOST}:${FACADE_WRITE_PORT}`
});

/* ---- 3. enable, start, and prove it -------------------------------------- */

await systemctl(ssh, ["daemon-reload"]);
await systemctl(ssh, ["enable", FACADE_WRITE_UNIT_NAME]);
await systemctl(ssh, ["restart", FACADE_WRITE_UNIT_NAME]);

// The facade binds loopback on the VM, so the deploy proof curls the loopback
// address FROM the VM's own shell (the unit answers there; the SSH tunnel is how
// a remote client reaches it, and proving the tunnel is a client-side concern).
let health = null;
for (let attempt = 0; attempt < 30 && health === null; attempt += 1) {
  const probe = await ssh(["curl", "-s", "-m", "2", `http://127.0.0.1:${FACADE_WRITE_PORT}/api/health`],
    { allowFailure: true });
  if (probe.code === 0 && probe.stdout.trim().startsWith("{")) health = JSON.parse(probe.stdout);
  else await new Promise((done) => setTimeout(done, 1000));
}

const isEnabled = await systemctl(ssh, ["is-enabled", FACADE_WRITE_UNIT_NAME]);
const isActive = await systemctl(ssh, ["is-active", FACADE_WRITE_UNIT_NAME]);

// A DRY-RUN ceremony against the real TCRN-TMS chain: plans and reads the live
// head, sends nothing, chain version unchanged. This proves the service drives
// the VM engine CLI and can plan a governed write against a real chain — the
// deployment proof, without performing a real write as a deploy side effect.
let dryRun = null;
if (health !== null) {
  const payload = {
    schemaVersion: "aos.local-client-ceremony.v1",
    story: "TCRN-CROSS-STORY-184",
    intent: "facade write deploy proof: dry-run plan against the real TCRN-TMS chain, sends nothing",
    steps: [{ verb: "work-annotate", flags: { id: "work:1a4aabcc5db3ae3735bc45f6", scope: "facade-write deploy dry-run (STORY-184)" } }],
    readback: [{ verb: "work-show", flags: { id: "work:1a4aabcc5db3ae3735bc45f6" }, recordFields: ["externalKey"] }]
  };
  const body = JSON.stringify({ partition: "TCRN-TMS", dryRun: true, payload });
  // The ssh helper joins argv with spaces and the remote shell tokenizes the
  // line, so a `sh -c` wrapper would hand `sh` only the first word; the curl is
  // passed as direct args with the JSON body single-quoted so it survives the
  // remote tokenizer.
  const probe = await ssh([
    "curl", "-s", "-m", "30", "-X", "POST", "-H", "content-type: application/json",
    "-d", `'${body}'`,
    `http://127.0.0.1:${FACADE_WRITE_PORT}/api/ceremony`,
  ], { allowFailure: true });
  try {
    dryRun = probe.code === 0 ? JSON.parse(probe.stdout) : null;
  } catch {
    dryRun = null;
  }
}

step("facade-enabled-and-answering", {
  ok: isEnabled.stdout === "enabled" && isActive.stdout === "active"
    && health?.ok === true && health.readonly === false && health.chainWriteAvailable === true
    && health.noPins === true
    && dryRun?.ok === true && dryRun?.reasonCode === "CEREMONY_PLANNED_ONLY"
    && dryRun?.receipt?.chainBefore?.version === dryRun?.receipt?.chainAfter?.version,
  reasonCode: "FACADE_WRITE_ANSWERS_ON_LOOPBACK",
  isEnabled: isEnabled.stdout,
  isActive: isActive.stdout,
  health,
  dryRunReasonCode: dryRun?.reasonCode,
  dryRunChainBefore: dryRun?.receipt?.chainBefore?.version,
  dryRunChainAfter: dryRun?.receipt?.chainAfter?.version
});

receipt.deployment = {
  host: VM_HOST,
  root: FACADE_WRITE_ROOT,
  runtime: FACADE_WRITE_RUNTIME,
  evidence: FACADE_WRITE_EVIDENCE,
  unit: FACADE_WRITE_UNIT_PATH,
  bind: `${FACADE_WRITE_HOST}:${FACADE_WRITE_PORT}`,
  engine: FACADE_WRITE_ENGINE,
  actor: FACADE_WRITE_ACTOR,
  partitions: Object.keys(FACADE_WRITE_WORKSPACES),
  writePath: "the ONE ceremony endpoint only — no pins, no authority argument, no per-verb write route"
};
receipt.notClaimed = [
  "this is the loopback write facade; it is reached through the SSH tunnel like the read face (CONF-007 D7)",
  "the real governed write (the STORY-184 proof) is driven separately through the tunnel, not by this recipe",
  "the STORY-188 window formalises the persistent production form of this unit"
];
receipt.ok = receipt.steps.every((entry) => entry.ok !== false);
receipt.finishedAt = instant();
saveState("facade-write-apply", scrubHostPaths(receipt));
console.log(JSON.stringify({
  ok: receipt.ok,
  reasonCodes: receipt.steps.map((entry) => entry.reasonCode),
  unit: FACADE_WRITE_UNIT_PATH,
  health,
  dryRunReasonCode: dryRun?.reasonCode
}, null, 2));
if (!receipt.ok) process.exitCode = 1;
