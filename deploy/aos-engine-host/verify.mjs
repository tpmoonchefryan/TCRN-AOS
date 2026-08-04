#!/usr/bin/env node
// Is the engine on the AOS host still the pinned release? (TCRN-CROSS-STORY-131)
//
//   node deploy/aos-engine-host/verify.mjs      # read-only; moves no byte
//
// WHY THIS EXISTS SEPARATELY FROM apply.mjs. `apply.mjs` answers the same question
// but answers it by CONVERGING first — it rsyncs with `--delete` and then proves the
// two sides agree. That is the right shape for a deployment and the wrong shape for a
// question: run it to check, and a drifted VM is silently repaired before you learn it
// had drifted. The interesting fact — *something changed the engine on the host* — is
// destroyed by the act of asking.
//
// So this program never writes. It builds the same per-file sha256 ledger on both
// sides, compares full value in both directions, asks the far engine what version and
// catalogue it is serving, and reports. A governed session that is about to drive the
// VM engine can run it first and know what it is driving.
//
// WHAT IT DOES NOT CLAIM. Byte-identity with the LOCAL GOVERNED COPY, and nothing
// beyond that comparison — the same ceiling `manifest.trust.statement` states for the
// deployment. It is not provenance: it proves the two copies agree, not that either is
// the release its tag names. The local half of that is `verify-installed-copy`'s job
// (which reads the installed SKILL copy, not this engine tree — a distinction that has
// already cost one wrong diagnosis), and the two together are what "the engine I am
// driving is the pinned release" actually rests on.
//
// The exit code is the answer: 0 identical, 1 drifted or unreachable. A run that could
// not reach the host reports `probed: false` and exits 1 rather than passing quietly —
// a check that cannot run must not be spelled the same way as a check that passed.

import { spawn } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, relative } from "node:path";
import { manifest } from "./manifest.mjs";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sourceRoot = manifest.source.root;
const enginePath = manifest.destination.enginePath;
const sshHost = manifest.destination.sshHost;
const excludes = new Set(manifest.transfer.excludes);

/**
 * Run a node program ON the VM with the text piped over stdin — mirroring apply.mjs.
 *
 * Streamed rather than passed as an argument because ssh re-joins its remote argv with
 * spaces and the remote shell re-tokenizes it, so a script containing quotes arrives as
 * something else.
 *
 * It must be `spawn` with an explicit `stdin.end()`: the async `execFile` has no `input`
 * option (that belongs to `execFileSync` / `spawnSync`), so passing one writes nothing,
 * `node -` waits on a stdin that is never closed, and the call hangs forever with both
 * processes idle. Measured: 40 minutes at 0.11s of CPU before it was killed.
 */
function sshNode(script) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn("ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=10", sshHost, "node", "-"],
      { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code === 0) resolvePromise(stdout);
      else rejectPromise(new Error(`remote node exited ${code}: ${stderr.slice(0, 500)}`));
    });
    child.stdin.end(script);
  });
}

async function localLedger(root) {
  const files = [];
  async function walk(dir) {
    const entries = (await readdir(dir, { withFileTypes: true })).sort((a, b) => (a.name < b.name ? -1 : 1));
    for (const entry of entries) {
      if (excludes.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) files.push(relative(root, full));
    }
  }
  await walk(root);
  const ledger = [];
  for (const path of files) {
    const bytes = await readFile(join(root, path));
    ledger.push({ path, bytes: bytes.length, sha256: sha256(bytes) });
  }
  return ledger.sort((a, b) => (a.path < b.path ? -1 : 1));
}

async function remoteLedger() {
  const script = `
    const { createHash } = require("crypto");
    const fs = require("fs");
    const path = require("path");
    const root = ${JSON.stringify(enginePath)};
    const excludes = new Set(${JSON.stringify([...excludes])});
    const files = [];
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
        if (excludes.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.isFile()) files.push(full);
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

function compareLedgers(local, remote) {
  const remoteByPath = new Map(remote.map((file) => [file.path, file]));
  const localPaths = new Set(local.map((file) => file.path));
  return {
    missingOnVm: local.filter((file) => !remoteByPath.has(file.path)).map((file) => file.path),
    extraOnVm: remote.filter((file) => !localPaths.has(file.path)).map((file) => file.path),
    mismatched: local
      .filter((file) => remoteByPath.has(file.path) && remoteByPath.get(file.path).sha256 !== file.sha256)
      .map((file) => file.path)
  };
}

async function main() {
  const receipt = {
    schemaVersion: "aos.engine-host-verify.v1",
    ruling: "TCRN-CROSS-STORY-131 — a read-only answer to 'which engine is the AOS host serving'",
    checkedAt: new Date().toISOString().replace(/\.\d{3}Z$/u, "Z"),
    host: sshHost,
    enginePath,
    expected: { version: manifest.source.requiredVersion, tag: manifest.source.requiredTag },
    probed: false,
    writesPerformed: false
  };

  let local;
  try {
    local = await localLedger(sourceRoot);
  } catch (error) {
    receipt.reasonCode = "LOCAL_GOVERNED_COPY_UNREADABLE";
    receipt.error = String(error?.message ?? error).slice(0, 300);
    console.log(JSON.stringify(receipt, null, 2));
    process.exitCode = 1;
    return;
  }

  let remote;
  let remoteVersion = null;
  try {
    remote = await remoteLedger();
    remoteVersion = JSON.parse(await sshNode(
      `process.stdout.write(JSON.stringify({ version: require(${JSON.stringify(join(enginePath, "package.json"))}).version }))`
    )).version;
  } catch (error) {
    // Unreachable is NOT a pass. Say which half failed and stop.
    receipt.reasonCode = "AOS_HOST_UNREACHABLE";
    receipt.error = String(error?.message ?? error).slice(0, 300);
    receipt.note = "probed:false — this run did not observe the far engine, and a check that could not run is not a check that passed";
    console.log(JSON.stringify(receipt, null, 2));
    process.exitCode = 1;
    return;
  }

  receipt.probed = true;
  const diff = compareLedgers(local, remote);
  const identical = diff.missingOnVm.length === 0 && diff.extraOnVm.length === 0 && diff.mismatched.length === 0;
  const versionAgrees = remoteVersion === manifest.source.requiredVersion;

  receipt.observed = { remoteVersion, files: { local: local.length, remote: remote.length } };
  receipt.diff = diff;
  receipt.reasonCode = !versionAgrees
    ? "AOS_HOST_ENGINE_VERSION_DIFFERS"
    : identical ? "AOS_HOST_ENGINE_MATCHES_GOVERNED_COPY" : "AOS_HOST_ENGINE_DRIFTED";
  receipt.ok = identical && versionAgrees;
  receipt.claim = manifest.trust.statement;

  console.log(JSON.stringify(receipt, null, 2));
  if (!receipt.ok) process.exitCode = 1;
}

await main();
