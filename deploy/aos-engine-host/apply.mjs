#!/usr/bin/env node
// TCRN AOS — controlled application of deploy/aos-engine-host/manifest.mjs.
//
// One run takes the VM from whatever state it is in to the manifest's state and
// proves it got there:
//
//   1. preflight  — the local governed copy really is the anchor the receipt
//                   will claim (the manifest's version, HEAD carries the
//                   manifest's tag, clean working tree); nothing moves until
//                   that holds. The version lives in the manifest, not here, so
//                   an engine upgrade is a one-file change;
//   2. converge   — rsync --archive --delete, so a re-run is idempotent and a
//                   hand-edited VM tree is overwritten, not accommodated;
//   3. verify     — full per-file sha256 ledger on both sides, compared
//                   value-for-value in both directions, plus a fileSetDigest in
//                   the export-manifest serialization;
//   4. red drill  — (--red-drill) flip one byte on the VM, watch step 3 fail on
//                   exactly that file, re-converge, watch it pass. A comparison
//                   that has never been seen red is not evidence of anything;
//   5. trust      — the VM copy answers `commands` with CLI_CATALOG_READY, the
//                   manifest's cli verb count, every verb the manifest names by
//                   name, and a package.json at the manifest's version. Because
//                   the VM has no node_modules, this same step is the proof
//                   that dist is self-sufficient;
//   6. statfs     — a disposable scratch workspace inits under /srv/tcrn
//                   (proving that filesystem is in the engine's pinned set),
//                   every mount on the VM is classified against the set, and a
//                   red init on an out-of-set mount is attempted where one
//                   exists (the engine's gate runs before any write, so the red
//                   probe writes nothing to that mount);
//   7. reclaim    — the scratch tree is removed, no engine process is left on
//                   the VM, the ssh ControlMaster this run used is closed, and
//                   a local pgrep confirms zero residue.
//
// The receipt lands in evidence/aos-engine-host-deploy.json. It never contains
// a local absolute path: the governed copy is named by the placeholder
// <local-governed-copy>, and the writer refuses to emit a receipt in which any
// home-directory path survived.

import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { manifest } from "./manifest.mjs";

const run = promisify(execFile);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const receiptPath = resolve(scriptDir, "..", "..", "evidence", "aos-engine-host-deploy.json");
const host = manifest.destination.sshHost;
const enginePath = manifest.destination.enginePath;
const sourceRoot = manifest.source.root;
const excludes = new Set(manifest.transfer.excludes);
const redDrillRequested = process.argv.includes("--red-drill");

// The engine's pinned local-filesystem set, duplicated from
// packages/core/src/workspace.ts (supportedFilesystemTypes). The duplicate is
// used only to CLASSIFY mounts and pick a red-probe target; the authoritative
// predicate in every proof below is the engine's own answer (init succeeding,
// or refusing with WORKSPACE_FILESYSTEM_UNSUPPORTED), so drift here can
// mis-pick a target but cannot fake a result.
const pinnedFilesystemMagics = new Set([0x1a, 0x482b, 0xef53, 0x58465342, 0x01021994, 0x794c7630, 0x9123683e, 0x2fc12fc1]);

const log = (line) => process.stderr.write(`${line}\n`);
const instant = () => new Date().toISOString().replace(/\.\d+Z$/u, "Z");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
// Export-manifest / paired-backup precedent: the set digest is over the exact
// "path sha256" lines, so anyone holding the files can recompute it with
// nothing but a shell.
const fileSetDigest = (files) => sha256(files.map((file) => `${file.path} ${file.sha256}`).join("\n"));

/** ssh with an argv command; refusals surface as exceptions unless allowFailure. */
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

/**
 * Run a node program ON the VM with the program text piped over stdin. Values
 * are baked into the text with JSON.stringify before sending, so nothing here
 * depends on how the remote shell would have tokenized an argument.
 */
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

/** The remote engine CLI, mapped exactly like scripts/inc-034-annotate-pair-proof.mjs maps the local one. */
async function engine(verb, args) {
  const result = await ssh(["node", `${enginePath}/scripts/tcrn-workflow.mjs`, verb, ...args], { allowFailure: true });
  const emitted = result.code === 0 ? result.stdout : (result.stderr.trim() || result.stdout.trim());
  let json;
  try { json = JSON.parse(emitted); } catch {
    throw new Error(`engine ${verb} emitted non-JSON (exit ${result.code}): ${emitted.slice(0, 500)}`);
  }
  return { accepted: result.code === 0, json };
}

/**
 * Walk a tree into a sorted {path, bytes, sha256} ledger. Exclusion is by name
 * at any depth — the same rule rsync applies — so the ledger and the transfer
 * cannot disagree about what the tree is. Anything that is neither a regular
 * file nor a directory fails the walk: a symlink smuggled into the set would
 * otherwise be hashed as its target and vouched for as a file.
 */
async function localLedger(root) {
  const files = [];
  async function walk(dir) {
    const entries = (await readdir(dir, { withFileTypes: true })).sort((a, b) => (a.name < b.name ? -1 : 1));
    for (const entry of entries) {
      if (excludes.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) files.push({ path: relative(root, full), bytes: 0, sha256: "" });
      else throw new Error(`unsupported entry kind in transfer set: ${relative(root, full)}`);
    }
  }
  await walk(root);
  for (const file of files) {
    const bytes = await readFile(join(root, file.path));
    file.bytes = bytes.length;
    file.sha256 = sha256(bytes);
  }
  files.sort((a, b) => (a.path < b.path ? -1 : 1));
  return files;
}

/** The same walk, executed on the VM by the VM's own node — the far side answers for its own bytes. */
async function remoteLedger() {
  const script = `
    const { createHash } = require("crypto");
    const fs = require("fs");
    const path = require("path");
    const root = ${JSON.stringify(enginePath)};
    const excludes = new Set(${JSON.stringify([...excludes])});
    const files = [];
    (function walk(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1));
      for (const entry of entries) {
        if (excludes.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.isFile()) files.push(full);
        else throw new Error("unsupported entry kind: " + full);
      }
    })(root);
    const ledger = files.map((full) => {
      const bytes = fs.readFileSync(full);
      return { path: path.relative(root, full), bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
    }).sort((a, b) => (a.path < b.path ? -1 : 1));
    process.stdout.write(JSON.stringify(ledger));
  `;
  return JSON.parse(await sshNode(script));
}

/** Full-value, both-direction comparison. Returns the discrepancy lists; empty lists are the green condition. */
function compareLedgers(local, remote) {
  const remoteByPath = new Map(remote.map((file) => [file.path, file]));
  const localPaths = new Set(local.map((file) => file.path));
  const missingOnVm = local.filter((file) => !remoteByPath.has(file.path)).map((file) => file.path);
  const extraOnVm = remote.filter((file) => !localPaths.has(file.path)).map((file) => file.path);
  const mismatched = local
    .filter((file) => remoteByPath.has(file.path) && remoteByPath.get(file.path).sha256 !== file.sha256)
    .map((file) => file.path);
  return { missingOnVm, extraOnVm, mismatched, ok: missingOnVm.length === 0 && extraOnVm.length === 0 && mismatched.length === 0 };
}

async function preflight() {
  const pkg = JSON.parse(await readFile(join(sourceRoot, "package.json"), "utf8"));
  if (pkg.version !== manifest.source.requiredVersion) {
    throw new Error(`local governed copy is ${pkg.version}, manifest requires ${manifest.source.requiredVersion}`);
  }
  const head = (await run("git", ["-C", sourceRoot, "rev-parse", "HEAD"])).stdout.trim();
  const tags = (await run("git", ["-C", sourceRoot, "tag", "--points-at", "HEAD"])).stdout.trim().split("\n");
  if (!tags.includes(manifest.source.requiredTag)) {
    throw new Error(`HEAD ${head} does not carry tag ${manifest.source.requiredTag}`);
  }
  const dirty = (await run("git", ["-C", sourceRoot, "status", "--porcelain"])).stdout.trim();
  if (dirty !== "") {
    throw new Error("local governed copy has a dirty working tree; the tag anchor claim would be false");
  }
  return { version: pkg.version, tag: manifest.source.requiredTag, commit: head, workingTreeClean: true };
}

async function converge() {
  await ssh(["mkdir", "-p", dirname(enginePath)]);
  const rsyncArgs = ["--archive", "--delete"];
  for (const name of excludes) rsyncArgs.push("--exclude", name);
  await run("rsync", [...rsyncArgs, `${sourceRoot}/`, `${host}:${enginePath}/`], { maxBuffer: 16 * 1024 * 1024 });
}

/**
 * Red drill for the digest predicate: corrupt exactly one deployed byte, watch
 * the comparison fail on exactly that path, then re-converge and watch it pass.
 * The drill never returns with the tree red — a failure to restore throws.
 */
async function redDrillDigestLedger(local) {
  const target = "README.md";
  await sshNode(`
    const fs = require("fs");
    const file = ${JSON.stringify(`${enginePath}/${target}`)};
    const bytes = fs.readFileSync(file);
    bytes[0] = bytes[0] ^ 0xff;
    fs.writeFileSync(file, bytes);
  `);
  const redComparison = compareLedgers(local, await remoteLedger());
  const wentRed = !redComparison.ok && redComparison.mismatched.length === 1 && redComparison.mismatched[0] === target;
  await converge();
  const restored = compareLedgers(local, await remoteLedger());
  if (!restored.ok) throw new Error("red drill could not restore the tree to green");
  if (!wentRed) throw new Error(`digest predicate failed to go red on a one-byte flip of ${target}`);
  return { predicate: "per-file sha256 comparison", flippedFile: target, wentRed, restoredGreen: true };
}

async function trustCheck() {
  const catalogRun = await ssh(["node", `${enginePath}/scripts/tcrn-workflow.mjs`, "commands"]);
  const catalog = JSON.parse(catalogRun.stdout);
  const cliVerbs = catalog.commands.filter((command) => command.availability === "cli").length;
  const fixtureOnlyVerbs = catalog.commands.filter((command) => command.availability === "fixture-only").length;
  if (catalog.reasonCode !== manifest.verification.catalogReasonCode) {
    throw new Error(`remote catalog answered ${catalog.reasonCode}`);
  }
  if (cliVerbs !== manifest.verification.cliVerbCount) {
    throw new Error(`remote catalog has ${cliVerbs} cli verbs, manifest requires ${manifest.verification.cliVerbCount}`);
  }
  // A count is satisfied by any set of that size. The verbs the manifest names
  // are checked by name, and their availability with them: a verb present in
  // the catalog as fixture-only is not a verb the VM can run.
  const requiredVerbs = manifest.verification.requiredVerbs ?? [];
  const missingVerbs = requiredVerbs.filter((name) =>
    !catalog.commands.some((command) => command.name === name && command.availability === "cli"));
  if (missingVerbs.length > 0) {
    throw new Error(`remote catalog lacks required cli verb(s): ${missingVerbs.join(", ")}`);
  }
  const remotePkg = JSON.parse(await sshNode(`process.stdout.write(require(${JSON.stringify(`${enginePath}/package.json`)}).version)`)
    .then((version) => JSON.stringify({ version })));
  if (remotePkg.version !== manifest.verification.remoteVersion) {
    throw new Error(`remote package.json says ${remotePkg.version}`);
  }
  return {
    catalogReasonCode: catalog.reasonCode,
    cliVerbs,
    fixtureOnlyVerbs,
    totalVerbs: catalog.commands.length,
    requiredVerbsPresent: requiredVerbs,
    remotePackageVersion: remotePkg.version,
    // The VM tree has no node_modules, so this green catalog answer doubles as
    // the standing proof that dist needs nothing beyond node: builtins.
    runsWithoutNodeModules: true,
  };
}

/** Every mount on the VM, classified against the pinned set by the VM's own statfs. */
async function scanMounts() {
  const script = `
    const fs = require("fs");
    const unescape = (s) => s.replace(/\\\\([0-7]{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
    const seen = new Set();
    const mounts = [];
    for (const line of fs.readFileSync("/proc/mounts", "utf8").trim().split("\\n")) {
      const [, rawPoint, fsName] = line.split(" ");
      const point = unescape(rawPoint);
      if (seen.has(point)) continue;
      seen.add(point);
      let magic = null, statfsError = null;
      try { magic = Number(fs.statfsSync(point).type); } catch (error) { statfsError = String(error.code ?? error); }
      mounts.push({ mountpoint: point, fsName, magic, statfsError });
    }
    process.stdout.write(JSON.stringify(mounts));
  `;
  const mounts = JSON.parse(await sshNode(script));
  for (const mount of mounts) {
    mount.inPinnedSet = mount.magic === null ? null : pinnedFilesystemMagics.has(mount.magic);
  }
  return mounts;
}

async function statfsProof() {
  const scratchRoot = `${manifest.destination.scratchParent}/scratch-s118-${Date.now()}`;
  const dirs = ["workspace", "transient", "evidence-locator", "release-trust"].map((name) => `${scratchRoot}/${name}`);
  await ssh(["mkdir", "-p", ...dirs]);
  const initArgs = (workspace) => [
    "--workspace", workspace,
    "--framework", enginePath,
    "--transient", `${scratchRoot}/transient`,
    "--evidence-locator", `${scratchRoot}/evidence-locator`,
    "--release-trust", `${scratchRoot}/release-trust`,
    "--at", instant(),
  ];

  // Green: a real (disposable) governed workspace on /srv/tcrn. Its succeeding
  // is the engine itself asserting this filesystem is in the pinned set.
  const green = await engine("init", [...initArgs(`${scratchRoot}/workspace`), "--external-key", "SCRATCH-S118-STATFS"]);
  if (!green.accepted || green.json.reasonCode !== "WORKSPACE_COMMAND_COMPLETED") {
    throw new Error(`scratch init did not complete: ${JSON.stringify(green.json)}`);
  }
  const dfLine = (await ssh(["df", "-T", manifest.destination.scratchParent])).stdout.trim().split("\n").pop();
  const parentMagic = JSON.parse(await sshNode(
    `process.stdout.write(JSON.stringify({ magic: Number(require("fs").statfsSync(${JSON.stringify(manifest.destination.scratchParent)}).type) }))`,
  )).magic;

  // Red: repeat the init on a mount outside the pinned set, if the VM has one.
  // The engine's filesystem gate runs before its first write, so the probe only
  // needs the mount root to exist as a readable directory — nothing is written
  // to it. Where no such mount exists, that is recorded, not simulated.
  const mounts = await scanMounts();
  const outside = mounts.filter((mount) => mount.inPinnedSet === false);
  let redProof;
  const target = outside.find((mount) => mount.mountpoint === "/sys/fs/pstore") ?? outside[0];
  if (!target) {
    redProof = { executed: false, reason: "no mount outside the pinned filesystem set exists on this host" };
  } else {
    const red = await engine("init", [...initArgs(target.mountpoint), "--external-key", "SCRATCH-S118-STATFS-RED"]);
    if (red.accepted || red.json.reasonCode !== "WORKSPACE_FILESYSTEM_UNSUPPORTED") {
      throw new Error(`red init on ${target.mountpoint} did not refuse as expected: ${JSON.stringify(red.json)}`);
    }
    redProof = {
      executed: true,
      mountpoint: target.mountpoint,
      fsName: target.fsName,
      magic: `0x${target.magic.toString(16)}`,
      reasonCode: red.json.reasonCode,
      error: red.json.error,
    };
  }

  // The scratch workspace is disposable by design (a one-off chain nobody will
  // read again), so plain removal is the correct disposal — and its absence is
  // verified, not assumed.
  await ssh(["rm", "-rf", scratchRoot]);
  const gone = (await ssh(["test", "!", "-e", scratchRoot], { allowFailure: true })).code === 0;
  if (!gone) throw new Error(`scratch root ${scratchRoot} still exists after cleanup`);

  return {
    scratchParent: {
      path: manifest.destination.scratchParent,
      dfLine,
      magic: `0x${parentMagic.toString(16)}`,
      inPinnedSet: pinnedFilesystemMagics.has(parentMagic),
    },
    scratchInit: {
      reasonCode: green.json.reasonCode,
      workspaceId: green.json.workspaceId,
      cleaned: true,
    },
    mounts: {
      scanned: mounts.length,
      outsidePinnedSet: outside.map((mount) => ({ mountpoint: mount.mountpoint, fsName: mount.fsName, magic: `0x${mount.magic.toString(16)}` })),
    },
    redProof,
  };
}

async function reclaim() {
  // Remote first (the check itself needs the connection), then the multiplexed
  // master, then the local process table — the pgrep at the end is the
  // verification, not the cleanup.
  const remoteEngine = await ssh(["pgrep", "-f", enginePath], { allowFailure: true });
  const remoteEngineProcesses = remoteEngine.code === 0 ? remoteEngine.stdout.trim().split("\n").length : 0;
  try { await run("ssh", ["-O", "exit", host]); } catch { /* no master running is already the goal */ }
  const localSsh = await run("pgrep", ["-f", "tcrn-platform-dev|192\\.168\\.51\\.249"]).then(
    (result) => result.stdout.trim().split("\n").filter(Boolean).length,
    () => 0,
  );
  return { remoteEngineProcesses, localSshProcesses: localSsh, controlMasterClosed: true };
}

/**
 * The receipt must not carry a local absolute path. Substitution is followed by
 * an assertion, so a path arriving through an unforeseen field (an error
 * message, a captured stderr) refuses to ship rather than shipping quietly.
 */
async function writeReceipt(receipt) {
  let text = `${JSON.stringify(receipt, null, 2)}\n`;
  text = text.split(sourceRoot).join("<local-governed-copy>");
  text = text.split(homedir()).join("<operator-home>");
  if (text.includes("/Users/")) throw new Error("a local absolute path survived receipt scrubbing; refusing to write");
  await mkdir(dirname(receiptPath), { recursive: true });
  await writeFile(receiptPath, text);
}

const startedAt = instant();
log(`[1/7] preflight against ${manifest.source.locator}`);
const source = await preflight();
log("[2/7] building local digest ledger");
const local = await localLedger(sourceRoot);
log(`[3/7] converging ${host}:${enginePath} (${local.length} files)`);
await converge();
log("[4/7] verifying far side, full-value, both directions");
const remote = await remoteLedger();
const comparison = compareLedgers(local, remote);
if (!comparison.ok) throw new Error(`transfer verification failed: ${JSON.stringify(comparison)}`);
let digestDrill = { executed: false, reason: "run with --red-drill to exercise the predicate" };
if (redDrillRequested) {
  log("[5/7] red drill: one flipped byte must turn step 4 red");
  digestDrill = { executed: true, ...(await redDrillDigestLedger(local)) };
} else {
  log("[5/7] red drill skipped (no --red-drill)");
}
log("[6/7] trust equivalence + filesystem proof");
const verification = await trustCheck();
const statfs = await statfsProof();
log("[7/7] reclaim");
const reclaimed = await reclaim();

const receipt = {
  schemaVersion: "aos.engine-host-deploy.v1",
  ruling: manifest.ruling,
  ok: true,
  startedAt,
  finishedAt: instant(),
  source: {
    locator: manifest.source.locator,
    version: source.version,
    tag: source.tag,
    commit: source.commit,
    workingTreeClean: source.workingTreeClean,
    // dist is gitignored in the governed copy, so the tag anchors the tracked
    // source only; dist rides on the digest ledger below. Saying so here keeps
    // the trust statement from quietly inflating.
    distCoveredByTag: false,
  },
  transfer: {
    method: manifest.transfer.method,
    excludes: [...excludes],
    destinationHost: host,
    enginePath,
    fileCount: local.length,
    totalBytes: local.reduce((sum, file) => sum + file.bytes, 0),
    // Both sides' set digests, derived independently (the remote one from the
    // VM's own hashes), alongside the per-file comparison that implies them.
    fileSetDigest: {
      local: fileSetDigest(local),
      remote: fileSetDigest(remote),
      match: fileSetDigest(local) === fileSetDigest(remote),
    },
    perFile: {
      compared: local.length,
      mismatched: comparison.mismatched.length,
      missingOnVm: comparison.missingOnVm.length,
      extraOnVm: comparison.extraOnVm.length,
    },
  },
  verification,
  trust: manifest.trust,
  predicateRedProofs: {
    digestLedger: digestDrill,
    filesystemGate: statfs.redProof,
  },
  statfs,
  reclaim: reclaimed,
};
await writeReceipt(receipt);
log(`receipt written to evidence/${receiptPath.split("/").pop()}`);
