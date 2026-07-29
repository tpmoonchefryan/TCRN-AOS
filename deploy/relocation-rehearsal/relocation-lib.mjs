// Shared plumbing for the governed-relocation rehearsal (TCRN-AOS-STORY-130).
//
// The rehearsal walks the whole `relocation-plan → vacate → copy → adopt →
// two-sided inspect` arc, plus the `vacate → abort` recovery arc, on THROWAWAY
// chains. Nothing here touches `.tcrn-workspace/*`, and the containment
// predicate is asserted on every mutating call rather than trusted.
//
// Non-negotiables inherited from the platform's paid-for lessons:
//  - The engine is the only judge and the only byte author. Authority documents
//    are serialised by the engine's own `canonicalRelocationAuthority`, never by
//    a local JSON.stringify.
//  - Governed writes only ever land under the session scratchpad (Mac) or under
//    `/srv/tcrn/scratch-*` (VM).
//  - Transfers are proven by per-file sha256 ledgers computed independently on
//    both sides and compared at FULL value in both directions.
//  - Every refusal drill asserts the OTHER half too: a red that would be red for
//    an unrelated reason measures nothing.

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
export const VM_SCRATCH_PREFIX = "/srv/tcrn/scratch-relocation-";
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const LOCAL_ENGINE = process.env.TCRN_AOS_ENGINE_ROOT
  ?? resolve(homedir(), ".tcrn-workflow/tcrn-workflow");
export const SCRATCHPAD = process.env.TCRN_AOS_RELOCATION_SCRATCH ?? "";
export const ACTOR = "profile:tcrn-minerva-v1";

if (SCRATCHPAD === "") {
  throw new Error("TCRN_AOS_RELOCATION_SCRATCH must name this session's scratchpad");
}
export const STATE_DIR = join(SCRATCHPAD, "relocation-rehearsal-state");

export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
export const sha256Text = (text) => sha256(Buffer.from(text, "utf8"));
export const sha256File = (path) => sha256(readFileSync(path));
export const instant = () => new Date().toISOString().replace(/\.\d+Z$/u, "Z");
export const fileSetDigest = (files) =>
  sha256Text(files.map((file) => `${file.path} ${file.sha256}`).join("\n"));

/** The one predicate that keeps every governed write off the live chains. */
export function assertScratchWorkspace(workspacePath) {
  const p = resolve(workspacePath);
  const ok = p.startsWith(resolve(SCRATCHPAD) + "/") || p.startsWith(VM_SCRATCH_PREFIX);
  if (!ok) throw new Error(`refusing governed write outside scratch containment: ${p}`);
  return p;
}

// Read-only verbs may name any workspace; everything else must name a scratch one.
// `relocation-plan` and `relocation-inspect` are read-only per ADR 0003 and are
// listed as such, but this rehearsal never points them at a live chain either.
const READ_ONLY_VERBS = new Set([
  "status", "validate", "export", "snapshot-manifest", "snapshot-verify",
  "work-list", "work-show", "commands", "knowledge-list", "lease-inspect",
  "relocation-inspect", "relocation-plan"
]);

function parseEmitted(text) {
  try { return JSON.parse(text); } catch { return { raw: String(text).slice(0, 600) }; }
}

/** Local governed engine CLI. Mutating verbs must target a scratch workspace. */
export async function engineLocal(verb, args, { allowFailure = false } = {}) {
  if (!READ_ONLY_VERBS.has(verb)) {
    const wsIndex = args.indexOf("--workspace");
    if (wsIndex >= 0) assertScratchWorkspace(args[wsIndex + 1]);
  }
  try {
    const { stdout } = await runFile(process.execPath,
      [join(LOCAL_ENGINE, "scripts/tcrn-workflow.mjs"), verb, ...args],
      { cwd: LOCAL_ENGINE, maxBuffer: 64 * 1024 * 1024 });
    return { accepted: true, json: JSON.parse(stdout), raw: stdout };
  } catch (error) {
    const emitted = String(error.stderr ?? "").trim() || String(error.stdout ?? "").trim();
    const json = parseEmitted(emitted);
    if (allowFailure) return { accepted: false, json, raw: emitted };
    throw new Error(`engine ${verb} refused: ${emitted.slice(0, 600)}`);
  }
}

/** ssh with an argv command. `-n` so a remote command can never hold stdin open. */
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
 * Quote one argument for the remote shell: ssh re-joins remote argv with spaces
 * and hands the result to the remote login shell, so anything word-shaped only
 * by accident is re-parsed there.
 */
export const shellQuote = (value) => `'${String(value).split("'").join("'\\''")}'`;

/** VM governed engine CLI. Mutating verbs must target a /srv/tcrn/scratch-* workspace. */
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
  const json = parseEmitted(emitted);
  if (result.code !== 0 && !allowFailure) {
    throw new Error(`VM engine ${verb} refused: ${JSON.stringify(json).slice(0, 600)}`);
  }
  return { accepted: result.code === 0, json, raw: emitted };
}

/** Run a node program ON the VM, program text over stdin. */
export function sshNode(script, { module: asModule = false } = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const argv = asModule ? [VM_HOST, "node", "--input-type=module", "-"] : [VM_HOST, "node", "-"];
    const child = spawn("ssh", argv, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", rejectPromise);
    child.on("close", (code) => code === 0
      ? resolvePromise(stdout)
      : rejectPromise(new Error(`remote node exited ${code}: ${stderr.slice(0, 3000)}`)));
    child.stdin.end(script);
  });
}

/** Walk a local tree into a sorted {path, bytes, sha256} ledger. */
export function localLedger(root, { excludes = new Set() } = {}) {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
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
    comparedRemote: remote.length,
    missingOnVm, extraOnVm, mismatched,
    fileSetDigest: { local: fileSetDigest(local), remote: fileSetDigest(remote) },
    ok: missingOnVm.length === 0 && extraOnVm.length === 0 && mismatched.length === 0
      && fileSetDigest(local) === fileSetDigest(remote) && local.length === remote.length
  };
}

export async function rsyncToVm(localRoot, remoteRoot, { excludes = [] } = {}) {
  await ssh(["mkdir", "-p", remoteRoot]);
  const args = ["--archive", "--delete"];
  for (const name of excludes) args.push("--exclude", name);
  await runFile("rsync", [...args, `${localRoot}/`, `${VM_HOST}:${remoteRoot}/`], { maxBuffer: 16 * 1024 * 1024 });
}

/**
 * The four control-tree paths the snapshot manifest excludes by design and that
 * `relocation-adopt` refuses when they arrive at the destination
 * (WORKSPACE_RELOCATION_TRANSPORT_RESIDUE). Stated here as NAMES because rsync
 * excludes by name; the engine's own list is `CONTROL_TREE_TRANSPORT_RESIDUE_PATHS`.
 */
export const TRANSPORT_RESIDUE_EXCLUDES = Object.freeze([
  "lease", "lease-recovery.claim", "mutation.claim", "restore.claim"
]);

/**
 * Mint a relocation authority document IN THE ENGINE'S OWN CANONICAL BYTES.
 *
 * `canonicalRelocationAuthority` both validates and serialises, so a document
 * this function returns is one the reader will accept byte for byte — and a
 * malformed permit is refused here rather than at the verb.
 */
export async function mintAuthorityLocal(path, permits) {
  const module = await import(pathToFileURL(
    resolve(LOCAL_ENGINE, "dist/build/packages/core/src/workspace-relocation.js")).href);
  const bytes = module.canonicalRelocationAuthority({
    schemaVersion: "tcrn.workspace-relocation-authority.v1",
    permits
  });
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
  return { path, sha256: sha256Text(bytes), bytes: Buffer.byteLength(bytes, "utf8") };
}

/** Ask the ENGINE whether a document is well-formed, without writing it anywhere. */
export async function validateAuthorityLocal(document) {
  const module = await import(pathToFileURL(
    resolve(LOCAL_ENGINE, "dist/build/packages/core/src/workspace-relocation.js")).href);
  try {
    module.validateRelocationAuthorityDocument(document);
    return { accepted: true };
  } catch (error) {
    return { accepted: false, reasonCode: error?.reasonCode ?? null, message: String(error?.message ?? error).slice(0, 200) };
  }
}

/** Mint an authority document ON THE VM, in the VM engine's own canonical bytes. */
export async function mintAuthorityVm(path, permits) {
  const script = `
    import { pathToFileURL } from "node:url";
    import { writeFileSync, mkdirSync } from "node:fs";
    import { dirname, resolve } from "node:path";
    import { createHash } from "node:crypto";
    const engine = ${JSON.stringify(VM_ENGINE)};
    const target = ${JSON.stringify(path)};
    const permits = ${JSON.stringify(permits)};
    const module = await import(pathToFileURL(resolve(engine, "dist/build/packages/core/src/workspace-relocation.js")).href);
    const bytes = module.canonicalRelocationAuthority({ schemaVersion: "tcrn.workspace-relocation-authority.v1", permits });
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, bytes);
    process.stdout.write(JSON.stringify({
      path: target,
      sha256: createHash("sha256").update(bytes, "utf8").digest("hex"),
      bytes: Buffer.byteLength(bytes, "utf8"),
      byteAuthority: "VM engine canonicalRelocationAuthority"
    }));
  `;
  return JSON.parse(await sshNode(script, { module: true }));
}

/** The engine's own vacate-commitment arithmetic, applied to a ledger entry. */
export async function vacateCommitmentOf(entry) {
  const module = await import(pathToFileURL(
    resolve(LOCAL_ENGINE, "dist/build/packages/core/src/workspace-relocation.js")).href);
  return module.relocationVacateCommitment(entry);
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

/** Reason code out of any receipt shape the CLI emits. */
export const reasonOf = (result) =>
  result?.json?.reasonCode ?? result?.json?.result?.reasonCode ?? result?.json?.error ?? null;
