// Shared plumbing for the switch rehearsal arc (STORY-122 / STORY-125 /
// STORY-123, ruling MIN-007: 切换仪式=矩阵双跑→owner 门→切换→降级归档,
// 演练义务含语义漂移红路径).
//
// Non-negotiables, inherited from the platform's paid-for lessons:
//  - The engine is the only judge. Chain verdicts route through the governed
//    copy's CLI verbs or its exported pure functions; placement bytes are
//    produced by the engine's own canonicalJson + assertDistinctRoots.
//  - Governed writes are allowed ONLY against scratch chains: every mutating
//    call asserts the workspace lives under the session scratchpad or under
//    the VM's /srv/tcrn/scratch-* prefix. The live chains are read-only here.
//  - Transfers are proven by per-file sha256 ledgers computed independently on
//    both sides and compared full-value in both directions (S118 precedent).
//  - Background loads carry their reclaim in the same flow, and reclaim is
//    verified by pgrep, not assumed.

import { createHash } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const runFile = promisify(execFile);

export const VM_HOST = "tcrn-platform-dev";
export const VM_ENGINE = "/srv/tcrn/engine/tcrn-workflow";
export const VM_SCRATCH_PREFIX = "/srv/tcrn/scratch-rehearsal-";
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const PLATFORM_ROOT = resolve(REPO_ROOT, "..");
export const LOCAL_ENGINE = process.env.TCRN_AOS_ENGINE_ROOT
  ?? resolve(homedir(), ".tcrn-workflow/tcrn-workflow");
export const SCRATCHPAD = process.env.TCRN_AOS_REHEARSAL_SCRATCH
  ?? "/private/tmp/claude-501/-Users-ryanlan-Code-TCRN-Platform/f97f8267-7c7f-4936-b1b5-7ad9e00cb90a/scratchpad";
export const STATE_DIR = join(SCRATCHPAD, "switch-rehearsal-state");
export const PARTITION_ID = "SCRATCH-REHEARSAL";
export const ACTOR = "profile:tcrn-minerva-v1";

export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
export const sha256Text = (text) => sha256(Buffer.from(text, "utf8"));
export const sha256File = (path) => sha256(readFileSync(path));
export const instant = () => new Date().toISOString().replace(/\.\d+Z$/u, "Z");
export const fileSetDigest = (files) =>
  sha256Text(files.map((file) => `${file.path} ${file.sha256}`).join("\n"));

/** Scratch containment: the one predicate that keeps every write off the live chains. */
export function assertScratchWorkspace(workspacePath) {
  const p = resolve(workspacePath);
  const ok = p.startsWith(resolve(SCRATCHPAD) + "/") || p.startsWith(VM_SCRATCH_PREFIX);
  if (!ok) {
    throw new Error(`refusing governed write outside scratch containment: ${p}`);
  }
  return p;
}

/** Local engine CLI. Mutating verbs must target a scratch workspace. */
const READ_ONLY_VERBS = new Set(["status", "validate", "export", "snapshot-manifest",
  "snapshot-verify", "work-list", "work-show", "commands", "knowledge-list"]);
export async function engineLocal(verb, args, { allowFailure = false } = {}) {
  if (!READ_ONLY_VERBS.has(verb)) {
    const wsIndex = args.indexOf("--workspace");
    if (wsIndex >= 0) assertScratchWorkspace(args[wsIndex + 1]);
  }
  try {
    const { stdout } = await runFile(process.execPath,
      [join(LOCAL_ENGINE, "scripts/tcrn-workflow.mjs"), verb, ...args],
      { cwd: LOCAL_ENGINE, maxBuffer: 64 * 1024 * 1024 });
    return { accepted: true, json: JSON.parse(stdout) };
  } catch (error) {
    const emitted = String(error.stderr ?? "").trim() || String(error.stdout ?? "").trim();
    let json;
    try { json = JSON.parse(emitted); } catch { json = { raw: emitted.slice(0, 500) }; }
    if (allowFailure) return { accepted: false, json };
    throw new Error(`engine ${verb} refused: ${emitted.slice(0, 500)}`);
  }
}

/**
 * ssh with an argv command; refusals surface as exceptions unless allowFailure.
 *
 * `-n` (stdin from /dev/null) is not cosmetic: without it a remote command that
 * spawns a background process can leave the session's stdin channel referenced,
 * and ssh then waits for a channel nobody will ever close. That is exactly how
 * the first walkthrough attempt hung — the start command never returned, the
 * harness killed the run, and the service it had already started was left
 * behind on the VM with nothing owning the record of it.
 */
export async function ssh(args, { allowFailure = false } = {}) {
  try {
    const { stdout, stderr } = await runFile("ssh", ["-n", VM_HOST, ...args], { maxBuffer: 64 * 1024 * 1024 });
    return { code: 0, stdout, stderr };
  } catch (error) {
    if (allowFailure && typeof error.code === "number") {
      return { code: error.code, stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
    }
    throw error;
  }
}

/**
 * Count the rehearsal's own long-lived processes on the VM.
 *
 * The pattern carries a bracket class so the pgrep command line cannot match
 * itself — the self-match is not a nuisance here, it is a correctness bug: a
 * reclaim loop that reads its own command line as a survivor will kill its own
 * process group, and a residue check that counts itself can never reach zero.
 */
export async function vmProcessResidue() {
  const probe = await ssh(["sh", "-c",
    "'pgrep -f \"node vm-cockpit-runn[e]r\" | wc -l; pgrep -f \"tcrn-workflow-mc[p]\" | wc -l'"],
    { allowFailure: true });
  const [runners, facades] = probe.stdout.trim().split(/\s+/u).map((n) => Number.parseInt(n, 10) || 0);
  return { runners: runners ?? 0, facades: facades ?? 0, total: (runners ?? 0) + (facades ?? 0) };
}

/**
 * Start the rehearsal cockpit on the VM, detached, and return its pid.
 *
 * The remote command produces no stdout of its own (the pid goes to a file that
 * a second, ordinary ssh call reads): a start command that must also carry its
 * own output back is the shape that hangs.
 */
export async function startVmService(runtimeDir, env) {
  if (!runtimeDir.startsWith(VM_SCRATCH_PREFIX)) {
    throw new Error(`refusing to start a service outside ${VM_SCRATCH_PREFIX}*: ${runtimeDir}`);
  }
  const envText = Object.entries(env).map(([key, value]) => `${key}=${value}`).join(" ");
  await ssh(["sh", "-c", `'cd ${runtimeDir} && rm -f service.pid && `
    + `{ setsid env ${envText} nohup node vm-cockpit-runner.mjs > service.log 2>&1 < /dev/null & `
    + `echo $! > service.pid ; } > /dev/null 2>&1'`]);
  const pidOut = await ssh(["cat", `${runtimeDir}/service.pid`]);
  return Number.parseInt(pidOut.stdout.trim(), 10);
}

/**
 * Reclaim the local `ssh -L` tunnel, and prove the PORT is free.
 *
 * Killing the `ssh -N -L` client is not enough here, and the reason is worth
 * keeping: this host is configured with `ControlMaster auto` +
 * `ControlPersist 10m`, so the client does not own the forward — it asks the
 * multiplexed master to open one, and the master keeps it after the client
 * exits. A run that killed its client and then counted `ssh -N -L` processes
 * saw zero and called the tunnel reclaimed while the master went on listening
 * on the port; that is exactly what was found still listening at cleanup, from
 * a master that had been up since before the run began.
 *
 * So the reclaim asks the master to cancel the forward (`ssh -O cancel`), and
 * the predicate is the LISTENER, not the process count: the question is "is
 * anything still accepting on this port", and only the socket can answer it.
 */
export async function reclaimLocalTunnel({ tunnelPort, vmPort, tunnelPid }) {
  if (tunnelPid) {
    try { process.kill(-tunnelPid, "SIGTERM"); } catch { /* group already gone */ }
    try { process.kill(tunnelPid, "SIGTERM"); } catch { /* already gone */ }
  }
  const cancel = await runFile("ssh",
    ["-O", "cancel", "-L", `${tunnelPort}:127.0.0.1:${vmPort}`, VM_HOST])
    .then(() => "cancelled", (error) => `refused: ${String(error.stderr ?? error.message).trim().slice(0, 120)}`);
  await new Promise((r) => setTimeout(r, 800));
  const listeners = await runFile("lsof", ["-nP", `-iTCP:${tunnelPort}`, "-sTCP:LISTEN"])
    .then((result) => result.stdout.trim().split("\n").filter((line) => line && !line.startsWith("COMMAND")).length,
      () => 0);
  const clients = await runFile("pgrep", ["-f", `ssh -N -L ${tunnelPort}`])
    .then((result) => result.stdout.trim().split("\n").filter(Boolean).length, () => 0);
  return {
    ok: listeners === 0 && clients === 0,
    masterForwardCancel: cancel,
    listenersOnPort: listeners,
    clientProcesses: clients,
    predicate: "端口上还有没有监听者(socket 自己回答),不是「有没有 ssh -N -L 进程」——后者在 ControlMaster 下会在转发仍在时读到零"
  };
}

/**
 * Reclaim the rehearsal cockpit: kill the PROCESS GROUP (the runner spawns an
 * engine facade of its own, and killing only the direct child leaves the facade
 * reparented and alive), then verify with an independent residue count.
 */
export async function reclaimVmService(runtimeDir) {
  const before = await vmProcessResidue();
  await ssh(["sh", "-c",
    `'p=$(cat ${runtimeDir}/service.pid 2>/dev/null); `
    + "if [ -n \"$p\" ]; then g=$(ps -o pgid= -p $p 2>/dev/null | tr -d \" \"); "
    + "[ -n \"$g\" ] && kill -TERM -$g 2>/dev/null; fi; "
    + "for q in $(pgrep -f \"node vm-cockpit-runn[e]r\"); do kill -TERM $q 2>/dev/null; done; "
    + "sleep 2; "
    + "for q in $(pgrep -f \"node vm-cockpit-runn[e]r\"); do kill -KILL $q 2>/dev/null; done; "
    + "exit 0'"], { allowFailure: true });
  await new Promise((r) => setTimeout(r, 1500));
  const after = await vmProcessResidue();
  const listener = await ssh(["sh", "-c", "'ss -ltn 2>/dev/null | grep -c 14318 || true'"], { allowFailure: true });
  return {
    reclaimed: true,
    residueBefore: before,
    residueAfter: after,
    listenersAfter: Number.parseInt(listener.stdout.trim(), 10) || 0,
    ok: after.total === 0 && (Number.parseInt(listener.stdout.trim(), 10) || 0) === 0
  };
}

/** Run a node program ON the VM, program text over stdin (S118 precedent). */
export function sshNode(script) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn("ssh", [VM_HOST, "node", "-"], { stdio: ["pipe", "pipe", "pipe"] });
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

/**
 * Quote one argument for the remote shell.
 *
 * ssh re-joins its remote argv with spaces and hands the result to the remote
 * login shell, so an argument that survived local argv (`--scope Rehearsal
 * walkthrough epic (S125)`) is re-parsed there and the parentheses become a
 * syntax error. Every remote argument is quoted at the boundary rather than
 * hoping values stay word-shaped.
 */
export const shellQuote = (value) => `'${String(value).split("'").join("'\\''")}'`;

/** The VM engine CLI. Mutating verbs must target a /srv/tcrn/scratch-* workspace. */
export async function engineVm(verb, args, { allowFailure = false } = {}) {
  if (!READ_ONLY_VERBS.has(verb)) {
    const wsIndex = args.indexOf("--workspace");
    if (wsIndex >= 0 && !String(args[wsIndex + 1]).startsWith(VM_SCRATCH_PREFIX)) {
      throw new Error(`refusing VM governed write outside ${VM_SCRATCH_PREFIX}*: ${args[wsIndex + 1]}`);
    }
  }
  const remote = ["node", `${VM_ENGINE}/scripts/tcrn-workflow.mjs`, verb, ...args]
    .map(shellQuote).join(" ");
  const result = await ssh([remote], { allowFailure: true });
  const emitted = result.code === 0 ? result.stdout : (result.stderr.trim() || result.stdout.trim());
  let json;
  try { json = JSON.parse(emitted); } catch {
    throw new Error(`VM engine ${verb} emitted non-JSON (exit ${result.code}): ${emitted.slice(0, 500)}`);
  }
  if (result.code !== 0 && !allowFailure) {
    throw new Error(`VM engine ${verb} refused: ${JSON.stringify(json).slice(0, 500)}`);
  }
  return { accepted: result.code === 0, json };
}

/** Walk a local tree into a sorted {path, bytes, sha256} ledger (S118 shape). */
export function localLedger(root, { excludes = new Set() } = {}) {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (excludes.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) {
        const bytes = readFileSync(full);
        files.push({ path: relative(root, full), bytes: bytes.length, sha256: sha256(bytes) });
      } else if (entry.isSymbolicLink()) {
        throw new Error(`symlink in transfer set: ${relative(root, full)}`);
      }
    }
  };
  walk(root);
  files.sort((a, b) => (a.path < b.path ? -1 : 1));
  return files;
}

/** The same walk on the VM, by the VM's own node — the far side answers for its own bytes. */
export async function remoteLedger(root, { excludes = [] } = {}) {
  const script = `
    const { createHash } = require("crypto");
    const fs = require("fs");
    const path = require("path");
    const root = ${JSON.stringify(root)};
    const excludes = new Set(${JSON.stringify(excludes)});
    const files = [];
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
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

/** Full-value, both-direction comparison; empty discrepancy lists are the green condition. */
export function compareLedgers(local, remote) {
  const remoteByPath = new Map(remote.map((file) => [file.path, file]));
  const localPaths = new Set(local.map((file) => file.path));
  const missingOnVm = local.filter((file) => !remoteByPath.has(file.path)).map((file) => file.path);
  const extraOnVm = remote.filter((file) => !localPaths.has(file.path)).map((file) => file.path);
  const mismatched = local
    .filter((file) => remoteByPath.has(file.path) && remoteByPath.get(file.path).sha256 !== file.sha256)
    .map((file) => file.path);
  return {
    compared: local.length,
    missingOnVm, extraOnVm, mismatched,
    fileSetDigest: { local: fileSetDigest(local), remote: fileSetDigest(remote) },
    ok: missingOnVm.length === 0 && extraOnVm.length === 0 && mismatched.length === 0
      && fileSetDigest(local) === fileSetDigest(remote)
  };
}

export async function rsyncToVm(localRoot, remoteRoot, { excludes = [] } = {}) {
  await ssh(["mkdir", "-p", remoteRoot]);
  const args = ["--archive", "--delete"];
  for (const name of excludes) args.push("--exclude", name);
  await runFile("rsync", [...args, `${localRoot}/`, `${VM_HOST}:${remoteRoot}/`], { maxBuffer: 16 * 1024 * 1024 });
}

/**
 * Placement: rewrite a transplanted workspace's stored roots to the paths it
 * now lives at, in the ENGINE's canonical byte form, using the engine's own
 * assertDistinctRoots + canonicalJson (never a re-implementation).
 *
 * Named finding of this rehearsal rather than a convenience: the engine binds
 * a workspace to five absolute root paths and ships no relocation verb, so a
 * byte-moved chain cannot answer `validate` until its metadata is re-placed.
 * The real switchover ceremony needs a governed placement step (or verb); this
 * rehearsal performs it only on disposable copies, and records before/after
 * digests of the one file it touches.
 */
export function placementScriptText({ engineRoot, rehearsalRoot, workspaceDirName }) {
  return `
    import { pathToFileURL } from "node:url";
    import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
    import { resolve, join } from "node:path";
    import { createHash } from "node:crypto";
    const eng = ${JSON.stringify(engineRoot)};
    const root = ${JSON.stringify(rehearsalRoot)};
    const { assertDistinctRoots } = await import(pathToFileURL(resolve(eng, "dist/build/packages/core/src/root-identity.js")).href);
    const { canonicalJson, assertCanonicalJson } = await import(pathToFileURL(resolve(eng, "dist/build/packages/protocol/src/index.js")).href);
    for (const name of ["transient", "evidence-locator", "release-trust"]) {
      mkdirSync(join(root, name), { recursive: true });
    }
    const wsPath = join(root, ${JSON.stringify(workspaceDirName)});
    const metaPath = join(wsPath, ".tcrn-workflow/workspace.json");
    const before = readFileSync(metaPath);
    const meta = JSON.parse(before.toString("utf8"));
    const newRoots = await assertDistinctRoots([
      { kind: "framework", path: eng },
      { kind: "workspace", path: wsPath },
      { kind: "transient", path: join(root, "transient") },
      { kind: "evidence-locator", path: join(root, "evidence-locator") },
      { kind: "release-trust", path: join(root, "release-trust") }
    ]);
    const byKind = new Map(newRoots.map((r) => [r.kind, r]));
    meta.roots = meta.roots.map((r) => byKind.get(r.kind));
    const bytes = canonicalJson(meta);
    assertCanonicalJson(bytes);
    writeFileSync(metaPath, bytes);
    const sha = (b) => createHash("sha256").update(b).digest("hex");
    process.stdout.write(JSON.stringify({
      placed: true,
      file: "workspace.json",
      byteAuthority: "engine canonicalJson + assertDistinctRoots",
      sha256Before: sha(before),
      sha256After: sha(readFileSync(metaPath))
    }));
  `;
}

/** Placement on the VM (workspace under the rehearsal root, engine = VM copy). */
export async function placeOnVm(rehearsalRoot, workspaceDirName) {
  if (!rehearsalRoot.startsWith(VM_SCRATCH_PREFIX)) {
    throw new Error(`placement refused outside ${VM_SCRATCH_PREFIX}*: ${rehearsalRoot}`);
  }
  const text = placementScriptText({ engineRoot: VM_ENGINE, rehearsalRoot, workspaceDirName });
  const out = await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn("ssh", [VM_HOST, "node", "--input-type=module", "-"], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", (c) => { stdout += c; });
    child.stderr.on("data", (c) => { stderr += c; });
    child.on("error", rejectPromise);
    child.on("close", (code) => code === 0
      ? resolvePromise(stdout)
      : rejectPromise(new Error(`vm placement exited ${code}: ${stderr.slice(0, 1500)}`)));
    child.stdin.end(text);
  });
  return JSON.parse(out);
}

/** Placement locally (disposable copies under the scratchpad only). */
export async function placeLocally(rehearsalRoot, workspaceDirName) {
  assertScratchWorkspace(join(rehearsalRoot, workspaceDirName));
  const text = placementScriptText({ engineRoot: LOCAL_ENGINE, rehearsalRoot, workspaceDirName });
  const { stdout } = await runFile(process.execPath, ["--input-type=module", "-e", text],
    { maxBuffer: 4 * 1024 * 1024 });
  return JSON.parse(stdout);
}

export function saveState(name, value) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(join(STATE_DIR, `${name}.json`), `${JSON.stringify(value, null, 2)}\n`);
}
export function loadState(name) {
  return JSON.parse(readFileSync(join(STATE_DIR, `${name}.json`), "utf8"));
}
export function hasState(name) {
  return existsSync(join(STATE_DIR, `${name}.json`));
}

/** Local judges = the governed engine's pure functions (run-matrix precedent). */
export async function loadLocalJudges() {
  const protocol = await import(pathToFileURL(
    resolve(LOCAL_ENGINE, "dist/build/packages/protocol/src/index.js")).href);
  return {
    validateEventChain: protocol.validateEventChain,
    canonicalJson: protocol.canonicalJson,
    assertCanonicalJson: protocol.assertCanonicalJson
  };
}
