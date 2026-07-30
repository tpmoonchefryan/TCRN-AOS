// The real-filesystem half of the zero-artefact predicate (TCRN-AOS-STORY-133).
//
// This module OBSERVES; local-purity-predicates.mjs JUDGES. The split is deliberate
// and it is the reason the judgement can live in `pnpm test` at all: everything here
// needs a disk, a home directory and the governed engine, and none of that can be a
// literal in a test file.
//
// Two rules it holds to:
//   - the ENGINE decides what state an address is in. `relocationStateAt` is the
//     engine's own three-state discriminator and `readWorkspaceMetadataAt(root,
//     "any")` is the engine's own reader; this file calls both and re-implements
//     neither. A local re-derivation of "is this vacated" would be a second opinion
//     that drifts from the only one that matters;
//   - READ ONLY. Nothing here opens a workspace for writing, and the admission mode
//     passed to the reader is `"any"`, which is the mode that answers rather than
//     refuses. The three partitions still living on this machine are read exactly as
//     the AOS archive is read: their bytes are not touched.

import { readdirSync, readFileSync, existsSync, statSync, realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { pathToFileURL } from "node:url";
import {
  PARTITION_ROSTER, SCAN_CEILING, SCAN_PRUNE, SCAN_ROOTS, WORKSPACE_CONTAINER
} from "./topology.mjs";

const CONTROL_DIRECTORY = ".tcrn-workflow";
const LOCAL_ENGINE = process.env.TCRN_AOS_ENGINE_ROOT
  ?? resolve(homedir(), ".tcrn-workflow/tcrn-workflow");

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const runFile = promisify(execFile);

/**
 * The engine's own READ FACE at an address: `status`, read-only, exit code kept.
 *
 * This is the second, independent term of "is a workspace live here", and it is the
 * stronger one. `relocationStateAt` reads one file; `status` goes through
 * `resolveWorkspace`, which additionally requires the control subdirectories to be
 * present and every root of the ACTIVE binding to resolve, on this filesystem, to
 * exactly the stored canonical path and portable identity. So a tree the ledger calls
 * live but whose roots no longer exist is refused here — and, the direction that
 * matters for this story, the retained AOS archive is refused with the engine's own
 * `WORKSPACE_RELOCATION_VACATED` rather than with a claim this file makes about it.
 *
 * A non-zero exit is an ANSWER, not a failure: the reason code is the point.
 */
export async function probeReadFace(address, engineRoot = LOCAL_ENGINE) {
  const cli = join(engineRoot, "scripts/tcrn-workflow.mjs");
  try {
    const { stdout } = await runFile(process.execPath, [cli, "status", "--workspace", address],
      { cwd: engineRoot, maxBuffer: 16 * 1024 * 1024 });
    const json = JSON.parse(stdout);
    return { accepted: true, reasonCode: json.reasonCode ?? null, version: json.version ?? null };
  } catch (error) {
    const emitted = String(error?.stderr ?? "").trim() || String(error?.stdout ?? "").trim();
    let reasonCode = null;
    try { reasonCode = JSON.parse(emitted).reasonCode ?? null; } catch { reasonCode = null; }
    return {
      accepted: false,
      reasonCode: reasonCode ?? "NON_JSON_REFUSAL",
      detail: reasonCode === null ? emitted.slice(0, 200) : undefined
    };
  }
}

/** The engine's own workspace module, from the governed installed copy. */
export async function loadEngineJudges(engineRoot = LOCAL_ENGINE) {
  const workspace = await import(pathToFileURL(
    resolve(engineRoot, "dist/build/packages/core/src/workspace.js")).href);
  return {
    relocationStateAt: workspace.relocationStateAt,
    readWorkspaceMetadataAt: workspace.readWorkspaceMetadataAt,
    activeWorkspaceRoot: workspace.activeWorkspaceRoot,
    WORKSPACE_SCHEMA_VERSION: workspace.WORKSPACE_SCHEMA_VERSION,
    engineRoot
  };
}

/**
 * Every directory named `.tcrn-workflow` under `root`, to `depth` levels.
 *
 * A `.tcrn-workflow` directory is a CANDIDATE, not a finding: the framework root on
 * this machine is literally `~/.tcrn-workflow` and holds the engine checkout, not a
 * control tree. What makes a candidate a control tree is a readable `workspace.json`
 * carrying the workspace schema — the file the engine itself binds to. Candidates
 * that fail that test are reported rather than dropped, because "we looked here and
 * it was not a workspace" is part of the scope claim.
 */
export function findControlTreeCandidates({ path, depth }) {
  const found = [];
  const walk = (dir, level) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // unreadable directory: recorded by the caller as a root-level fact
    }
    for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      if (SCAN_PRUNE.includes(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.name === CONTROL_DIRECTORY) {
        found.push(full);
        continue; // never descend into a control tree
      }
      if (level < depth) walk(full, level + 1);
    }
  };
  if (!existsSync(path)) return found;
  walk(path, 1);
  return found;
}

/**
 * One candidate, turned into the row the predicate judges.
 *
 * `address` is the realpath of the WORKSPACE root (the parent of the control tree),
 * because that is the address the engine's discriminator compares against the
 * ledger's `canonicalPath` values. Passing the control directory instead — the level
 * that is easy to reach for — yields `foreign-address` for every tree on the disk,
 * which looks like a clean answer and is a wrong one.
 */
export async function observeControlTree(controlTreePath, judges) {
  const workspaceRoot = resolve(controlTreePath, "..");
  const metadataPath = join(controlTreePath, "workspace.json");
  const row = {
    controlTree: controlTreePath,
    address: workspaceRoot,
    isWorkspace: false,
    reason: null
  };
  if (!existsSync(metadataPath)) {
    return { ...row, reason: "NO_WORKSPACE_JSON" };
  }
  let bytes;
  try {
    bytes = readFileSync(metadataPath);
  } catch (error) {
    return { ...row, reason: `UNREADABLE: ${String(error?.code ?? error).slice(0, 40)}` };
  }
  let metadata;
  try {
    metadata = JSON.parse(bytes.toString("utf8"));
  } catch {
    return { ...row, reason: "WORKSPACE_JSON_NOT_JSON" };
  }
  if (metadata?.schemaVersion !== judges.WORKSPACE_SCHEMA_VERSION) {
    return { ...row, reason: `FOREIGN_SCHEMA: ${String(metadata?.schemaVersion).slice(0, 40)}` };
  }

  const address = realpathSync(workspaceRoot);
  const ledger = Array.isArray(metadata.relocations) ? metadata.relocations : [];
  const trailing = ledger[ledger.length - 1] ?? null;

  // The engine's discriminator: a pure function of (this file, this address).
  const engineState = judges.relocationStateAt(metadata, address);

  // The engine's metadata reader in the mode that ANSWERS rather than refuses.
  // `"any"` skips the relocation admission, so a refusal from here is about the
  // bytes — non-canonical JSON, or a shape `validateMetadata` rejects — and never
  // about the relocation stage. Recorded for completeness; the load-bearing second
  // term is the read face below.
  let metadataAdmitted = false;
  let metadataReasonCode = null;
  try {
    await judges.readWorkspaceMetadataAt(workspaceRoot, "any");
    metadataAdmitted = true;
  } catch (error) {
    metadataReasonCode = String(error?.reasonCode ?? error?.code ?? "REFUSED").slice(0, 60);
  }

  const readFace = await probeReadFace(workspaceRoot, judges.engineRoot);

  return {
    ...row,
    isWorkspace: true,
    address,
    workspaceJsonSha256: sha256(bytes),
    workspaceJsonBytes: bytes.length,
    externalKey: metadata.externalKey ?? null,
    workspaceId: metadata.workspaceId ?? null,
    storageVersion: metadata.storageVersion ?? null,
    relocationCount: ledger.length,
    lastStage: trailing?.stage ?? null,
    lastRelocationId: trailing?.relocationId ?? null,
    activeWorkspaceRoot: judges.activeWorkspaceRoot(metadata) ?? null,
    engineState,
    metadataAdmitted,
    metadataReasonCode,
    readFaceAccepted: readFace.accepted,
    readFaceReasonCode: readFace.reasonCode,
    readFaceVersion: readFace.version ?? null
  };
}

/**
 * The whole observation: roots walked, candidates found, control trees described.
 *
 * `partitionsFoundLive` is derived here rather than in the predicate because it is an
 * observation ("which partitions did the walk actually find live") and the predicate
 * must not be able to satisfy its own scope condition from its own output.
 */
export async function observeLocalHost({ roots = SCAN_ROOTS, judges } = {}) {
  const resolvedJudges = judges ?? await loadEngineJudges();
  const rootsWalked = [];
  const candidates = [];
  for (const root of roots) {
    const reachable = existsSync(root.path) && statSync(root.path).isDirectory();
    const hits = reachable ? findControlTreeCandidates(root) : [];
    rootsWalked.push({ id: root.id, depth: root.depth, reachable, candidates: hits.length, why: root.why });
    candidates.push(...hits);
  }

  // De-duplicated: two declared roots can overlap (the home root contains the
  // platform root on this machine), and the same tree counted twice would inflate
  // every count in the receipt without changing a single verdict.
  const rows = [];
  for (const candidate of [...new Set(candidates)].sort()) {
    rows.push(await observeControlTree(candidate, resolvedJudges));
  }

  const trees = rows.filter((row) => row.isWorkspace);
  const nonWorkspaceCandidates = rows.filter((row) => !row.isWorkspace);

  const partitionsFoundLive = [];
  for (const tree of trees) {
    if (tree.engineState !== "live" || tree.readFaceAccepted !== true) continue;
    const partition = PARTITION_ROSTER.find((entry) =>
      entry.externalKey === tree.externalKey && entry.workspaceId === tree.workspaceId);
    if (partition) partitionsFoundLive.push(partition.partitionId);
  }

  return {
    observedAt: new Date().toISOString().replace(/\.\d+Z$/u, "Z"),
    engineRoot: resolvedJudges.engineRoot,
    containerExists: existsSync(WORKSPACE_CONTAINER),
    rootsWalked,
    trees,
    nonWorkspaceCandidates,
    partitionsFoundLive,
    ceiling: SCAN_CEILING
  };
}
