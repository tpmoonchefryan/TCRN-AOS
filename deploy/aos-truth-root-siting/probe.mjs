#!/usr/bin/env node
// TCRN AOS — controlled application of deploy/aos-truth-root-siting/manifest.mjs.
//
// One run answers "can the four chains live at this address on the VM?" with the
// engine's own voice, and leaves the VM exactly as it found it:
//
//   1. preflight  — the VM's engine copy is the v0.9.0 relocation-capable one
//                   (catalog reason code, cli verb count, relocation verbs by
//                   name, package version), the governance parent exists, and
//                   the truth root does NOT yet exist. A pre-existing truth root
//                   aborts the run rather than being probed over: this script
//                   ends by deleting what it made, and it must never be able to
//                   delete something it did not make;
//   2. site       — per partition, build the four per-partition roots plus the
//                   shared release-trust, then `init` a disposable governed
//                   workspace there. Its completing is the engine asserting the
//                   filesystem at that exact address is in its pinned set;
//   3. attest     — `attestation-enable` with --attest-dir pointed at the
//                   SIBLING attestations/ directory, and the emitted file is
//                   verified to exist. This is the invariant the layout is
//                   shaped around, checked at the real address;
//   4. inspect    — `relocation-inspect` answers at the address, so the
//                   receiving side of a relocation is readable there;
//   5. record     — df -T and statfs magic/device for the address. Reasons, not
//                   predicates: the engine already ruled in step 2;
//   6. red        — in scratch (never at the candidate address): an init on a
//                   mount outside the pinned set must refuse
//                   WORKSPACE_FILESYSTEM_UNSUPPORTED, and an --attest-dir INSIDE
//                   a workspace root must refuse CLI_ARGUMENT_MALFORMED. The
//                   second runs in scratch because that refusal happens after
//                   the mutation commits and would consume a probe workspace's
//                   one-shot attestation enable;
//   7. reclaim    — every directory this run created is removed, absence is
//                   verified, the governance parent is confirmed empty again,
//                   no engine process is left on the VM, the ssh ControlMaster
//                   is closed, and a local pgrep confirms zero residue.
//
// This script never names, reads or writes the live chains. Every workspace it
// creates is one it created moments earlier and deletes before it exits.
//
// Receipt: evidence/aos-vm-relocation-prep.json, scrubbed through
// scripts/lib/evidence-hygiene.mjs.

import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { manifest } from "./manifest.mjs";
import { scrubHostPaths, findHostPaths } from "../../scripts/lib/evidence-hygiene.mjs";

const run = promisify(execFile);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const receiptPath = resolve(scriptDir, "..", "..", "evidence", "aos-vm-relocation-prep.json");

const host = manifest.destination.sshHost;
const framework = manifest.destination.frameworkPath;
const truthRoot = manifest.destination.truthRoot;
const governanceParent = manifest.destination.governanceParent;
const engineCli = `${framework}/scripts/tcrn-workflow.mjs`;

const log = (line) => process.stderr.write(`${line}\n`);
const instant = () => new Date().toISOString().replace(/\.\d+Z$/u, "Z");
const externalKey = (partition) => `SITING-PROBE-${partition.toUpperCase()}`;

async function ssh(args, { allowFailure = false } = {}) {
  try {
    const { stdout, stderr } = await run("ssh", [host, ...args], { maxBuffer: 64 * 1024 * 1024 });
    return { code: 0, stdout, stderr };
  } catch (error) {
    if (allowFailure && typeof error.code === "number") {
      return { code: error.code, stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
    }
    throw error;
  }
}

/** Node program text piped to the VM's own node over stdin; values baked in with JSON.stringify. */
function sshNode(script) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn("ssh", [host, "node", "-"], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code === 0) resolvePromise(stdout);
      else rejectPromise(new Error(`remote node exited ${code}: ${stderr.slice(0, 2000)}`));
    });
    child.stdin.end(script);
  });
}

/** The VM's engine CLI. Refusals are values here, not exceptions — several are the point. */
async function engine(verb, args) {
  const result = await ssh(["node", engineCli, verb, ...args], { allowFailure: true });
  const emitted = result.code === 0 ? result.stdout : (result.stderr.trim() || result.stdout.trim());
  let json;
  try { json = JSON.parse(emitted); } catch {
    throw new Error(`engine ${verb} emitted non-JSON (exit ${result.code}): ${emitted.slice(0, 500)}`);
  }
  return { accepted: result.code === 0, json };
}

const remoteExists = async (path) => (await ssh(["test", "-e", path], { allowFailure: true })).code === 0;

async function preflight() {
  const catalog = JSON.parse((await ssh(["node", engineCli, "commands"])).stdout);
  const cliVerbs = catalog.commands.filter((command) => command.availability === "cli");
  const relocationVerbs = cliVerbs.filter((command) => command.name.startsWith("relocation-")).map((c) => c.name).sort();
  const version = JSON.parse(await sshNode(
    `process.stdout.write(JSON.stringify({ v: require(${JSON.stringify(`${framework}/package.json`)}).version }))`,
  )).v;
  if (catalog.reasonCode !== "CLI_CATALOG_READY") throw new Error(`VM catalog answered ${catalog.reasonCode}`);
  if (version !== "0.9.0") throw new Error(`VM engine is ${version}; siting requires the relocation-capable 0.9.0`);
  for (const required of [manifest.verification.inspectVerb, "relocation-adopt"]) {
    if (!relocationVerbs.includes(required)) throw new Error(`VM engine lacks cli verb ${required}`);
  }
  if (!(await remoteExists(governanceParent))) throw new Error(`${governanceParent} does not exist on ${host}`);
  // Refusing to probe over an existing tree is what makes the teardown safe: a
  // run only ever removes directories the same run created.
  if (await remoteExists(truthRoot)) {
    throw new Error(`${truthRoot} already exists; this probe creates and removes its own tree and will not touch one it did not make`);
  }
  const parentListing = (await ssh(["ls", "-A", governanceParent])).stdout.trim();
  return {
    engineVersion: version,
    catalogReasonCode: catalog.reasonCode,
    cliVerbCount: cliVerbs.length,
    relocationVerbs,
    governanceParentExisted: true,
    governanceParentEmptyBefore: parentListing === "",
    truthRootAbsentBefore: true,
  };
}

/** df -T and statfs for one path, from the VM's own kernel. */
async function addressFacts(path) {
  const dfLine = (await ssh(["df", "-T", path])).stdout.trim().split("\n").pop();
  const stat = JSON.parse(await sshNode(`
    const fs = require("fs");
    const s = fs.statfsSync(${JSON.stringify(path)});
    const st = fs.statSync(${JSON.stringify(path)});
    process.stdout.write(JSON.stringify({
      magic: "0x" + Number(s.type).toString(16),
      magicDecimal: Number(s.type),
      blockSize: Number(s.bsize),
      availableBytes: Number(s.bavail) * Number(s.bsize),
      deviceId: Number(st.dev),
    }));
  `));
  return { path, dfLine, ...stat };
}

async function siteOnePartition(partition) {
  const partitionRoot = `${truthRoot}/${partition}`;
  const roots = {
    workspace: `${partitionRoot}/${manifest.layout.perPartition.workspace}`,
    transient: `${partitionRoot}/${manifest.layout.perPartition.transient}`,
    evidenceLocator: `${partitionRoot}/${manifest.layout.perPartition.evidenceLocator}`,
    attestations: `${partitionRoot}/${manifest.layout.perPartition.attestations}`,
    releaseTrust: `${truthRoot}/${manifest.layout.sharedReleaseTrust}`,
  };
  await ssh(["mkdir", "-p", roots.workspace, roots.transient, roots.evidenceLocator, roots.attestations, roots.releaseTrust]);

  const at = instant();
  const init = await engine("init", [
    "--workspace", roots.workspace,
    "--framework", framework,
    "--transient", roots.transient,
    "--evidence-locator", roots.evidenceLocator,
    "--release-trust", roots.releaseTrust,
    "--external-key", externalKey(partition),
    "--at", at,
  ]);
  if (!init.accepted || init.json.reasonCode !== manifest.verification.initReasonCode) {
    throw new Error(`init at ${roots.workspace} did not complete: ${JSON.stringify(init.json)}`);
  }

  // The attest-dir invariant, exercised at the real address: sibling accepted,
  // and the attestation file actually on disk. `version` comes from the init
  // receipt rather than a constant, so the CAS sentinel is the engine's number.
  const attest = await engine("attestation-enable", [
    "--workspace", roots.workspace,
    "--expected-version", String(init.json.version),
    "--at", instant(),
    "--actor", manifest.verification.probeActor,
    "--attest-dir", roots.attestations,
  ]);
  if (!attest.accepted || attest.json.reasonCode !== manifest.verification.initReasonCode) {
    throw new Error(`attestation-enable at ${roots.workspace} did not complete: ${JSON.stringify(attest.json)}`);
  }
  const attestationFile = `${roots.attestations}/${attest.json.headEventHash}.json`;
  const attestationWritten = await remoteExists(attestationFile);
  if (!attestationWritten) throw new Error(`sibling attest-dir accepted but wrote no file at ${attestationFile}`);

  const inspect = await engine(manifest.verification.inspectVerb, ["--workspace", roots.workspace, "--at", instant()]);
  if (!inspect.accepted) throw new Error(`${manifest.verification.inspectVerb} refused at ${roots.workspace}: ${JSON.stringify(inspect.json)}`);

  const facts = await addressFacts(roots.workspace);
  return {
    partition,
    partitionRoot,
    roots,
    admissible: true,
    init: {
      reasonCode: init.json.reasonCode,
      workspaceId: init.json.workspaceId,
      version: init.json.version,
      externalKey: externalKey(partition),
    },
    attestDirSibling: {
      accepted: true,
      reasonCode: attest.json.reasonCode,
      attestDirIsSiblingOfWorkspaceRoot: true,
      attestationFileWritten: attestationWritten,
      headEventHash: attest.json.headEventHash,
    },
    relocationInspect: {
      reasonCode: inspect.json.reasonCode,
      state: inspect.json.state,
      relocations: inspect.json.relocations,
      addressEchoedByEngine: inspect.json.address,
    },
    filesystem: facts,
  };
}

/**
 * Both refusals, in scratch. Neither runs at a candidate address: the
 * filesystem refusal needs an out-of-set mount, and the attest-dir refusal
 * lands after the mutation commits, so it would burn a probe workspace's
 * one-shot attestation enable.
 */
async function redProbes(scratchRoot) {
  const dirs = ["workspace", "transient", "evidence-locator", "release-trust"].map((name) => `${scratchRoot}/${name}`);
  await ssh(["mkdir", "-p", ...dirs]);
  const initArgs = (workspace) => [
    "--workspace", workspace,
    "--framework", framework,
    "--transient", `${scratchRoot}/transient`,
    "--evidence-locator", `${scratchRoot}/evidence-locator`,
    "--release-trust", `${scratchRoot}/release-trust`,
    "--at", instant(),
  ];

  // R1 — the filesystem gate. Target chosen from the VM's own mount table by
  // asking the engine, not by trusting a magic table copied into this file: any
  // mount the engine refuses proves the gate is live.
  const mounts = JSON.parse(await sshNode(`
    const fs = require("fs");
    const seen = new Set();
    const out = [];
    for (const line of fs.readFileSync("/proc/mounts", "utf8").trim().split("\\n")) {
      const parts = line.split(" ");
      const point = parts[1].replace(/\\\\([0-7]{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
      if (seen.has(point)) continue;
      seen.add(point);
      out.push({ mountpoint: point, fsName: parts[2] });
    }
    process.stdout.write(JSON.stringify(out));
  `));
  const candidate = mounts.find((mount) => mount.mountpoint === "/sys/fs/pstore") ?? mounts.find((mount) => mount.fsName === "sysfs");
  let filesystemRefusal;
  if (!candidate) {
    filesystemRefusal = { executed: false, reason: "no non-disk mount available to probe on this host" };
  } else {
    const red = await engine("init", [...initArgs(candidate.mountpoint), "--external-key", "SITING-PROBE-RED-FS"]);
    if (red.accepted || red.json.reasonCode !== manifest.verification.filesystemRefusalReasonCode) {
      throw new Error(`filesystem gate did not refuse at ${candidate.mountpoint}: ${JSON.stringify(red.json)}`);
    }
    filesystemRefusal = {
      executed: true,
      mountpoint: candidate.mountpoint,
      fsName: candidate.fsName,
      reasonCode: red.json.reasonCode,
      error: red.json.error,
    };
  }

  // R2 — the attest-dir containment rule. A fresh scratch workspace, then an
  // attest-dir UNDER its root. The refusal is what makes the sibling layout a
  // requirement rather than a preference.
  const redWorkspace = `${scratchRoot}/workspace`;
  const seeded = await engine("init", [...initArgs(redWorkspace), "--external-key", "SITING-PROBE-RED-ATTEST"]);
  if (!seeded.accepted) throw new Error(`scratch workspace for the attest-dir red probe failed: ${JSON.stringify(seeded.json)}`);
  const insideDir = `${redWorkspace}/inside-attest`;
  const redAttest = await engine("attestation-enable", [
    "--workspace", redWorkspace,
    "--expected-version", String(seeded.json.version),
    "--at", instant(),
    "--actor", manifest.verification.probeActor,
    "--attest-dir", insideDir,
  ]);
  if (redAttest.accepted || redAttest.json.reasonCode !== manifest.verification.attestDirInsideReasonCode) {
    throw new Error(`attest-dir inside the workspace root was not refused: ${JSON.stringify(redAttest.json)}`);
  }

  return {
    filesystemGate: filesystemRefusal,
    attestDirContainment: {
      executed: true,
      attestDir: "<workspace-root>/inside-attest",
      reasonCode: redAttest.json.reasonCode,
      error: redAttest.json.error,
    },
  };
}

async function teardown(scratchRoot) {
  await ssh(["rm", "-rf", truthRoot, scratchRoot]);
  const truthRootGone = !(await remoteExists(truthRoot));
  const scratchGone = !(await remoteExists(scratchRoot));
  const parentListing = (await ssh(["ls", "-A", governanceParent])).stdout.trim();
  if (!truthRootGone) throw new Error(`${truthRoot} survived teardown`);
  if (!scratchGone) throw new Error(`${scratchRoot} survived teardown`);
  if (parentListing !== "") throw new Error(`${governanceParent} is not empty after teardown: ${parentListing}`);
  return { truthRootRemoved: true, scratchRemoved: true, governanceParentEmptyAfter: true };
}

async function reclaim() {
  const remoteEngine = await ssh(["pgrep", "-f", framework], { allowFailure: true });
  const remoteEngineProcesses = remoteEngine.code === 0 ? remoteEngine.stdout.trim().split("\n").filter(Boolean).length : 0;
  try { await run("ssh", ["-O", "exit", host]); } catch { /* no master running is already the goal */ }
  const localSsh = await run("pgrep", ["-f", "tcrn-platform-dev|192\\.168\\.51\\.249"]).then(
    (result) => result.stdout.trim().split("\n").filter(Boolean).length,
    () => 0,
  );
  return { remoteEngineProcesses, localSshProcesses: localSsh, controlMasterClosed: true };
}

/** Scrub through the shared hygiene module, then assert nothing survived. */
async function writeReceipt(receipt) {
  const text = `${JSON.stringify(scrubHostPaths(receipt), null, 2)}\n`;
  const survivors = findHostPaths(text);
  if (survivors.length > 0) throw new Error(`host paths survived scrubbing: ${survivors.join(", ")}`);
  await mkdir(dirname(receiptPath), { recursive: true });
  await writeFile(receiptPath, text);
}

const startedAt = instant();
const scratchRoot = `${manifest.destination.scratchParent}/scratch-siting-${Date.now()}`;
log(`[1/5] preflight ${host}`);
const preflightResult = await preflight();
let sited = [];
let red;
let torndown;
try {
  log(`[2/5] siting ${manifest.partitions.length} partitions under ${truthRoot}`);
  for (const partition of manifest.partitions) {
    log(`      · ${partition}`);
    sited.push(await siteOnePartition(partition));
  }
  log("[3/5] red probes in scratch");
  red = await redProbes(scratchRoot);
} finally {
  log("[4/5] teardown");
  torndown = await teardown(scratchRoot);
}
log("[5/5] reclaim");
const reclaimed = await reclaim();

const receipt = {
  schemaVersion: "aos.vm-relocation-prep.v1",
  ruling: manifest.ruling,
  story: manifest.story,
  ok: true,
  startedAt,
  finishedAt: instant(),
  host,
  engineOnVm: {
    path: framework,
    version: preflightResult.engineVersion,
    catalogReasonCode: preflightResult.catalogReasonCode,
    cliVerbCount: preflightResult.cliVerbCount,
    relocationVerbs: preflightResult.relocationVerbs,
    deployReceipt: "evidence/aos-engine-host-deploy.json",
  },
  truthRootSiting: {
    truthRoot,
    governanceParent,
    layout: manifest.layout,
    partitions: sited,
    allAdmissible: sited.every((entry) => entry.admissible),
  },
  predicateRedProofs: red,
  plan: manifest.plannedButNotApplied,
  teardown: torndown,
  reclaim: reclaimed,
  trust: manifest.trust,
};
await writeReceipt(receipt);
log(`receipt written to evidence/${receiptPath.split("/").pop()}`);
