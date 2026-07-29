#!/usr/bin/env node
// STORY-122, act two: the real-chain F-side arc.
//
// The live AOS chain is read here and only read. A byte copy (proven to share
// no inode with the source) is placed in the session scratchpad; every
// governed verb below runs against that disposable copy. The copy answers
// validate + snapshot green, the consistency matrix runs with the A side
// declared absent and comes out in the HONEST pre-instantiation shape —
// R1/R3 A-side cells acceptance-gate-pending, overall not-ok (the state the
// acceptance gates exist to hold open until a production A container exists)
// — and the copy is then transferred to the VM, re-answered by the VM's own
// engine (validate green: the real chain replays on the VM engine), and
// DELETED from the VM with the deletion verified. The authority never moves;
// the VM never keeps a second copy of the truth shape.
//
// Two copy-only governed writes are performed on the DISPOSABLE copy and
// recorded by name, never on the authority:
//   1. placement (workspace.json roots rewritten in engine-canonical bytes —
//      the transplant step act one names as a ceremony finding);
//   2. knowledge-rebase (the live chain's knowledge high-water mark trails
//      its head, which fails the lockstep precondition of snapshot-manifest
//      and of the matrix; the remedy is a governed write, so it is performed
//      on the copy only). The event stream is byte-identical to the live
//      chain throughout — both writes touch metadata beside it, and the
//      receipt records the head/version equality that proves it.

import { cpSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  LOCAL_ENGINE, PLATFORM_ROOT, REPO_ROOT, SCRATCHPAD,
  compareLedgers, engineLocal, engineVm, instant, loadState, localLedger,
  placeLocally, placeOnVm, remoteLedger, rsyncToVm, saveState, sha256Text, ssh
} from "./rehearsal-lib.mjs";

const act1 = loadState("act1");
const vmRealRoot = `${act1.vmRoot}/real-chain`;
const localRoot = join(SCRATCHPAD, "switch-rehearsal-real-copy");
const liveWorkspace = resolve(PLATFORM_ROOT, ".tcrn-workspace", "TCRN-AOS", "workspace");
const liveAttestDir = resolve(PLATFORM_ROOT, ".tcrn-workspace", "TCRN-AOS", "attestations");

const receipt = { stage: "act2-real-chain-arc", startedAt: instant(), localRoot, vmRealRoot, steps: [] };
const step = (name, value) => {
  receipt.steps.push({ name, ...value });
  process.stderr.write(`[act2] ${name}: ${value.reasonCode ?? (value.ok ? "ok" : "FAILED")}\n`);
  if (value.ok === false) {
    receipt.ok = false;
    saveState("act2", receipt);
    throw new Error(`act2 step failed: ${name}`);
  }
};

// ---- 1. read-only copy with a distinct-inode proof ------------------------
const liveHeadBefore = (await engineLocal("status", ["--workspace", liveWorkspace])).json;
rmSync(localRoot, { recursive: true, force: true });
mkdirSync(localRoot, { recursive: true });
cpSync(liveWorkspace, join(localRoot, "workspace"), { recursive: true, verbatimSymlinks: true });
// Prove the copy shares no inode with the source, file by file over the whole
// control tree — a predicate whose two sides CAN collide (a hard-linked copy
// would), so a green here is a judgement, not a tautology of directory kinds.
const inodeOf = (path) => { const s = statSync(path); return `${s.st_dev ?? s.dev}:${s.ino}`; };
const sourceFiles = localLedger(join(liveWorkspace, ".tcrn-workflow"));
let inodeCollisions = 0;
for (const file of sourceFiles) {
  const src = statSync(join(liveWorkspace, ".tcrn-workflow", file.path));
  const dst = statSync(join(localRoot, "workspace", ".tcrn-workflow", file.path));
  if (src.dev === dst.dev && src.ino === dst.ino) inodeCollisions += 1;
}
step("read-only-copy-distinct-inode", {
  ok: inodeCollisions === 0 && sourceFiles.length > 0,
  reasonCode: "COPY_SHARES_NO_INODE_WITH_AUTHORITY",
  filesCompared: sourceFiles.length,
  inodeCollisions,
  sampleSourceInode: inodeOf(join(liveWorkspace, ".tcrn-workflow/workspace.json")),
  sampleCopyInode: inodeOf(join(localRoot, "workspace/.tcrn-workflow/workspace.json"))
});

// ---- 2. placement + validate green on the copy ----------------------------
const placementLocal = await placeLocally(localRoot, "workspace");
const copyValidate = await engineLocal("validate", ["--workspace", join(localRoot, "workspace")]);
const copyStatus = (await engineLocal("status", ["--workspace", join(localRoot, "workspace")])).json;
step("copy-placement-validate", {
  ok: copyValidate.json.reasonCode === "WORKSPACE_COMMAND_COMPLETED"
    && copyStatus.headEventHash === liveHeadBefore.headEventHash
    && copyStatus.version === liveHeadBefore.version,
  reasonCode: copyValidate.json.reasonCode,
  placement: placementLocal,
  copyHeadEventHash: copyStatus.headEventHash,
  copyVersion: copyStatus.version
});

// ---- 3. knowledge-rebase on the COPY only (lockstep precondition) ---------
const { readFileSync } = await import("node:fs");
const markerBefore = JSON.parse(readFileSync(
  join(localRoot, "workspace/.tcrn-workflow/knowledge/store.json"), "utf8"));
const rebase = await engineLocal("knowledge-rebase", ["--workspace", join(localRoot, "workspace"),
  "--expected-version", String(markerBefore.version), "--at", instant()]);
const statusAfterRebase = (await engineLocal("status", ["--workspace", join(localRoot, "workspace")])).json;
step("copy-knowledge-rebase", {
  ok: rebase.json.reasonCode === "KNOWLEDGE_STORE_REBASED"
    && statusAfterRebase.headEventHash === liveHeadBefore.headEventHash
    && statusAfterRebase.version === liveHeadBefore.version,
  reasonCode: rebase.json.reasonCode,
  markerBefore: markerBefore.eventHighWaterDigest,
  markerAfter: rebase.json.eventHighWaterDigest,
  eventStreamUntouched: statusAfterRebase.headEventHash === liveHeadBefore.headEventHash,
  performedOn: "the disposable copy only; the authority chain was not written"
});

// ---- 4. F-side snapshot green on the copy ---------------------------------
const anchorAt = instant();
const { execFile } = await import("node:child_process");
const { promisify } = await import("node:util");
const manifestRaw = (await promisify(execFile)(process.execPath,
  [join(LOCAL_ENGINE, "scripts/tcrn-workflow.mjs"), "snapshot-manifest",
    "--workspace", join(localRoot, "workspace"), "--at", anchorAt],
  { cwd: LOCAL_ENGINE, maxBuffer: 64 * 1024 * 1024 })).stdout;
const manifestPath = join(localRoot, "chain-snapshot-manifest.json");
writeFileSync(manifestPath, manifestRaw);
const verifyCopy = await engineLocal("snapshot-verify",
  ["--root", join(localRoot, "workspace"), "--manifest", manifestPath]);
step("copy-snapshot-manifest-verify", {
  ok: (verifyCopy.json.reasonCode ?? verifyCopy.json.result?.reasonCode) === "SNAPSHOT_VERIFIED",
  reasonCode: verifyCopy.json.reasonCode ?? verifyCopy.json.result?.reasonCode,
  manifestDigest: sha256Text(manifestRaw)
});

// ---- 5. the matrix in its honest pre-instantiation shape ------------------
const { runMatrix } = await import(pathToFileURL(
  resolve(REPO_ROOT, "scripts/consistency-matrix/run-matrix.mjs")).href);
const matrix = await runMatrix({
  fWorkspace: join(localRoot, "workspace"),
  aAbsent: { reason: "A 容器尚未在任何活分区实例化(INC-035 之前的真实状态)" },
  partitionId: "TCRN-AOS",
  fAttestDir: liveAttestDir,
  engineRoot: LOCAL_ENGINE,
  whitelistPath: resolve(REPO_ROOT, "scripts/consistency-matrix/na-whitelist.json"),
  labels: { f: "live-chain-read-only-copy", a: "declared-absent" }
});
const pendingCells = (matrix.cells ?? []).filter((cell) => cell.verdict === "acceptance-gate-pending").map((cell) => cell.cell);
const expectedPending = ["R1C1", "R1C2", "R1C3", "R1C4", "R3C1", "R3C2", "R3C3", "R3C4"];
step("matrix-honest-shape", {
  ok: matrix.ok === false
    && matrix.reasonCode === "A_SIDE_ABSENT_DECLARED"
    && expectedPending.every((cell) => pendingCells.includes(cell))
    && pendingCells.length === expectedPending.length
    && (matrix.summary?.mismatch ?? -1) === 0,
  reasonCode: "A_SIDE_ABSENT_DECLARED",
  summary: matrix.summary,
  acceptanceGatePendingCells: pendingCells,
  honestReading: "R1/R3 的 A 侧格是 MIN-003 验收门;A 容器缺席时它们如实记 pending 而非授权 n/a,整跑不通过——这就是 INC-035 落地前活分区的真实形状"
});
receipt.matrixHonestShape = { summary: matrix.summary, reasonCode: matrix.reasonCode, lockstep: matrix.lockstep, anchor: matrix.anchor };

// ---- 6. transfer to VM, far-side verify, replayability proof --------------
const localFiles = localLedger(localRoot);
await rsyncToVm(localRoot, vmRealRoot);
const remoteFiles = await remoteLedger(vmRealRoot);
const comparison = compareLedgers(localFiles, remoteFiles);
step("real-copy-transfer-reconciliation", {
  ok: comparison.ok,
  reasonCode: comparison.ok ? "TRANSFER_LEDGERS_EQUAL" : "TRANSFER_LEDGERS_DIVERGENT",
  compared: comparison.compared,
  fileSetDigest: comparison.fileSetDigest
});

const vmVerify = await engineVm("snapshot-verify",
  ["--root", `${vmRealRoot}/workspace`, "--manifest", `${vmRealRoot}/chain-snapshot-manifest.json`]);
step("vm-real-copy-snapshot-verify", {
  ok: (vmVerify.json.reasonCode ?? vmVerify.json.result?.reasonCode) === "SNAPSHOT_VERIFIED",
  reasonCode: vmVerify.json.reasonCode ?? vmVerify.json.result?.reasonCode
});
const placementVm = await placeOnVm(vmRealRoot, "workspace");
const vmValidate = await engineVm("validate", ["--workspace", `${vmRealRoot}/workspace`]);
const vmStatus = await engineVm("status", ["--workspace", `${vmRealRoot}/workspace`]);
step("vm-real-chain-replays", {
  ok: vmValidate.json.reasonCode === "WORKSPACE_COMMAND_COMPLETED"
    && vmStatus.json.headEventHash === liveHeadBefore.headEventHash
    && vmStatus.json.version === liveHeadBefore.version,
  reasonCode: vmValidate.json.reasonCode,
  placement: placementVm,
  vmHeadEventHash: vmStatus.json.headEventHash,
  vmVersion: vmStatus.json.version,
  meaning: "真链(副本)在 VM 引擎下全量回放并通过 validate;headEventHash 与本机权威全值相等"
});

// ---- 7. delete the VM truth-shape copy, verify gone; same locally ---------
await ssh(["rm", "-rf", vmRealRoot]);
const vmGone = (await ssh(["test", "!", "-e", vmRealRoot], { allowFailure: true })).code === 0;
step("vm-real-copy-deleted", {
  ok: vmGone,
  reasonCode: "VM_TRUTH_COPY_REMOVED_VERIFIED",
  principle: "权威不动、命名诚实——演练毕 VM 不得存第二份真值形状"
});
rmSync(localRoot, { recursive: true, force: true });
step("local-real-copy-deleted", {
  ok: !existsSync(localRoot),
  reasonCode: "LOCAL_TRUTH_COPY_REMOVED_VERIFIED"
});

// ---- 8. the authority was only read ---------------------------------------
const liveHeadAfter = (await engineLocal("status", ["--workspace", liveWorkspace])).json;
step("authority-untouched", {
  ok: liveHeadAfter.headEventHash === liveHeadBefore.headEventHash
    && liveHeadAfter.version === liveHeadBefore.version,
  reasonCode: "AUTHORITY_READ_ONLY_HELD",
  liveHeadEventHash: liveHeadAfter.headEventHash,
  liveVersion: liveHeadAfter.version
});

receipt.ok = true;
receipt.finishedAt = instant();
receipt.liveChain = { headEventHash: liveHeadBefore.headEventHash, version: liveHeadBefore.version };
saveState("act2", receipt);
console.log(JSON.stringify({
  ok: true,
  liveHead: liveHeadBefore.headEventHash, liveVersion: liveHeadBefore.version,
  matrixHonestShape: matrix.summary,
  vmCopyDeleted: vmGone
}, null, 2));
