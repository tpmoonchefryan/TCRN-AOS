#!/usr/bin/env node
// STORY-122, act one: the scratch full-green arc.
//
// The verification SHAPE of the switchover ceremony (MIN-007: 矩阵双跑 →
// owner 门 → 切换 → 降级归档), walked end to end on a chain nobody has to
// protect: build a governed scratch chain locally (attestation enabled, with
// an attest-dir sidecar), mirror-ingest it into an EventMirrorStore A side,
// run the 5×4 consistency matrix to green on BOTH containers, take the
// chain-side anchor (snapshot-manifest + baseline byte archive +
// snapshot-verify), transfer the five-piece set plus sidecar to the VM with
// per-file sha256 reconciliation in both directions, and have the VM's OWN
// engine re-answer validate + snapshot-verify green.
//
// 矩阵在暂存侧双跑 + 传输字节对账 + 落地侧引擎复验 —— 这就是切换仪式的
// 验证形状;本脚本产出该形状的一次完整实走,不产出任何切换授权。

import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  ACTOR, LOCAL_ENGINE, PARTITION_ID, REPO_ROOT, SCRATCHPAD, VM_ENGINE, VM_SCRATCH_PREFIX,
  assertScratchWorkspace, compareLedgers, engineLocal, engineVm, instant, localLedger,
  placeOnVm, remoteLedger, rsyncToVm, saveState, sha256File, sha256Text
} from "./rehearsal-lib.mjs";

const stamp = new Date().toISOString().replace(/[:.]/gu, "-").replace(/-\d{3}Z$/u, "Z");
const localRoot = join(SCRATCHPAD, `switch-rehearsal-${stamp}`);
const vmRoot = `${VM_SCRATCH_PREFIX}${stamp}`;
const workspace = join(localRoot, "workspace");
const attestDir = join(localRoot, "attest");
const receipt = {
  stage: "act1-scratch-arc",
  startedAt: instant(),
  localRoot, vmRoot,
  steps: []
};
const step = (name, value) => {
  receipt.steps.push({ name, ...value });
  process.stderr.write(`[act1] ${name}: ${value.reasonCode ?? (value.ok ? "ok" : "FAILED")}\n`);
  if (value.ok === false) {
    receipt.ok = false;
    saveState("act1", receipt);
    throw new Error(`act1 step failed: ${name}`);
  }
};

// ---- 1. build the scratch governed chain (writes: scratch only) -----------
assertScratchWorkspace(workspace);
for (const dir of ["workspace", "transient", "evidence-locator", "release-trust", "attest", "anchor", "baseline"]) {
  mkdirSync(join(localRoot, dir), { recursive: true });
}
const at = (minute) => `2026-07-29T00:${String(minute).padStart(2, "0")}:00Z`;
const initArgs = ["--workspace", workspace, "--framework", LOCAL_ENGINE,
  "--transient", join(localRoot, "transient"),
  "--evidence-locator", join(localRoot, "evidence-locator"),
  "--release-trust", join(localRoot, "release-trust")];
await engineLocal("init", [...initArgs, "--external-key", "SR-WORKSPACE-001", "--at", at(0)]);
const project = (await engineLocal("project-create", ["--workspace", workspace,
  "--expected-version", "0", "--at", at(1),
  "--external-key", "SR-PROJ-001", "--name", "Switch rehearsal scratch"])).json;
await engineLocal("attestation-enable", ["--workspace", workspace,
  "--expected-version", "1", "--at", at(2), "--actor", ACTOR, "--attest-dir", attestDir]);
const initiative = (await engineLocal("work-create", ["--workspace", workspace,
  "--expected-version", "2", "--at", at(3), "--project-id", project.record.id,
  "--external-key", "SR-INIT-001", "--kind", "Initiative",
  "--actor", ACTOR, "--attest-dir", attestDir])).json;
await engineLocal("work-transition", ["--workspace", workspace,
  "--expected-version", "3", "--at", at(4), "--id", initiative.record.id,
  "--status", "ready", "--actor", ACTOR, "--attest-dir", attestDir]);
await engineLocal("work-annotate", ["--workspace", workspace,
  "--expected-version", "4", "--at", at(5), "--id", initiative.record.id,
  "--scope", "Switch rehearsal fixture initiative", "--actor", ACTOR, "--attest-dir", attestDir]);
const train = (await engineLocal("work-create", ["--workspace", workspace,
  "--expected-version", "5", "--at", at(6), "--project-id", project.record.id,
  "--external-key", "SR-TRAIN-001", "--kind", "Release", "--parent-id", "-",
  "--actor", ACTOR, "--attest-dir", attestDir])).json;
// knowledge store LAST so the high-water mark equals the head (the lockstep
// precondition both snapshot-manifest and the matrix check before anchoring).
await engineLocal("knowledge-init", ["--workspace", workspace, "--acknowledge-disposable", "true"]);
const status = (await engineLocal("status", ["--workspace", workspace])).json;
const exported = (await engineLocal("export", ["--workspace", workspace])).json;
step("build-scratch-chain", {
  ok: status.version === 6,
  reasonCode: "WORKSPACE_COMMAND_COMPLETED",
  headEventHash: status.headEventHash,
  version: status.version,
  workspaceId: status.workspaceId,
  records: { project: project.record.id, initiative: initiative.record.id, train: train.record.id },
  attestationEnabled: true
});

// ---- 2. mirror ingest (the A side), sidecar migrated as bytes -------------
const { EventMirrorStore } = await import(pathToFileURL(
  resolve(REPO_ROOT, "dist/packages/projection/src/index.js")).href);
const { loadJudges, runMatrix } = await import(pathToFileURL(
  resolve(REPO_ROOT, "scripts/consistency-matrix/run-matrix.mjs")).href);
const judges = await loadJudges(LOCAL_ENGINE);
const mirrorPath = join(localRoot, "mirror.db");
const store = new EventMirrorStore(mirrorPath);
const appended = store.ingest(PARTITION_ID, status.version, exported.events, judges);
store.close();
const migratedAttest = join(localRoot, "attest-migrated");
cpSync(attestDir, migratedAttest, { recursive: true });
step("mirror-ingest", {
  ok: appended === exported.events.length && exported.events.length > 0,
  reasonCode: "EVENT_MIRROR_INGESTED", appended, chainEvents: exported.events.length
});

// ---- 3. the consistency matrix, both containers, all applicable cells green
const matrix = await runMatrix({
  fWorkspace: workspace,
  aDatabasePath: mirrorPath,
  partitionId: PARTITION_ID,
  fAttestDir: attestDir,
  aAttestDir: migratedAttest,
  engineRoot: LOCAL_ENGINE,
  mirrorModulePath: resolve(REPO_ROOT, "dist/packages/projection/src/index.js"),
  whitelistPath: resolve(REPO_ROOT, "scripts/consistency-matrix/na-whitelist.json"),
  labels: { f: "rehearsal-file-container", a: "rehearsal-event-row-mirror" }
});
step("matrix-double-run", {
  ok: matrix.ok === true,
  reasonCode: matrix.ok ? "MATRIX_ALL_APPLICABLE_EQUAL" : matrix.reasonCode,
  summary: matrix.summary,
  anchorStable: matrix.anchorStability?.stable,
  headAgreement: matrix.mutualReference?.chainHeadEventHash
});
receipt.matrix = {
  summary: matrix.summary,
  engineVersion: matrix.engineVersion,
  anchor: matrix.anchor,
  mutualReference: matrix.mutualReference,
  whitelist: matrix.whitelist
};

// ---- 4. chain-side anchor: manifest + baseline byte archive + verify ------
// keep the engine's own emitted bytes, not a re-serialization
const anchorAt = instant();
const { execFile } = await import("node:child_process");
const { promisify } = await import("node:util");
const manifestRaw = (await promisify(execFile)(process.execPath,
  [join(LOCAL_ENGINE, "scripts/tcrn-workflow.mjs"), "snapshot-manifest", "--workspace", workspace, "--at", anchorAt],
  { cwd: LOCAL_ENGINE, maxBuffer: 64 * 1024 * 1024 })).stdout;
const manifest = { json: JSON.parse(manifestRaw) };
const manifestPath = join(localRoot, "anchor", "chain-snapshot-manifest.json");
writeFileSync(manifestPath, manifestRaw);
cpSync(join(workspace, ".tcrn-workflow"), join(localRoot, "baseline", ".tcrn-workflow"),
  { recursive: true, verbatimSymlinks: true });
const verifyLocal = await engineLocal("snapshot-verify",
  ["--root", join(localRoot, "baseline"), "--manifest", manifestPath]);
step("anchor", {
  ok: (verifyLocal.json.reasonCode ?? verifyLocal.json.result?.reasonCode) === "SNAPSHOT_VERIFIED",
  reasonCode: verifyLocal.json.reasonCode ?? verifyLocal.json.result?.reasonCode,
  anchorAt,
  anchorHeadEventHash: manifest.json.headEventHash ?? manifest.json.result?.headEventHash ?? null,
  anchorVersion: manifest.json.version ?? manifest.json.result?.version ?? null,
  manifestDigest: sha256Text(manifestRaw)
});
receipt.anchor = {
  at: anchorAt,
  headEventHash: status.headEventHash,
  version: status.version,
  manifestDigest: sha256Text(manifestRaw)
};

// ---- 5. transfer the five-piece set + sidecar, ledger both directions -----
// 五件套按 CONF-002 权威列举(append-only 记录流/规范字节/哈希链/可回放/
// attestation)——其字节容器=workspace 控制树整体;随行:sidecar(attest/)、
// A 侧镜像(mirror.db)、锚(anchor/)、基线归档(baseline/)。
const transferExcludes = new Set(["attest-migrated"]);
const localFiles = localLedger(localRoot, { excludes: transferExcludes });
await rsyncToVm(localRoot, vmRoot, { excludes: [...transferExcludes] });
const remoteFiles = await remoteLedger(vmRoot, { excludes: [...transferExcludes] });
const comparison = compareLedgers(localFiles, remoteFiles);
step("transfer-reconciliation", {
  ok: comparison.ok,
  reasonCode: comparison.ok ? "TRANSFER_LEDGERS_EQUAL" : "TRANSFER_LEDGERS_DIVERGENT",
  compared: comparison.compared,
  missingOnVm: comparison.missingOnVm.length,
  extraOnVm: comparison.extraOnVm.length,
  mismatched: comparison.mismatched.length,
  fileSetDigest: comparison.fileSetDigest
});
receipt.transfer = {
  pieces: ["workspace (chain control tree: R1-R4 的字节容器)", "attest/ (R5 sidecar)",
    "mirror.db (A 容器)", "anchor/ (链侧锚)", "baseline/ (锚时字节基线归档)"],
  fileCount: localFiles.length,
  totalBytes: localFiles.reduce((sum, file) => sum + file.bytes, 0),
  fileSetDigest: comparison.fileSetDigest
};

// ---- 6. far-side engine re-verification -----------------------------------
// snapshot-verify FIRST (bytes as transferred), then placement (the one
// metadata rewrite a transplanted workspace needs), then validate.
const vmVerify = await engineVm("snapshot-verify",
  ["--root", `${vmRoot}/baseline`, "--manifest", `${vmRoot}/anchor/chain-snapshot-manifest.json`]);
step("vm-snapshot-verify", {
  ok: (vmVerify.json.reasonCode ?? vmVerify.json.result?.reasonCode) === "SNAPSHOT_VERIFIED",
  reasonCode: vmVerify.json.reasonCode ?? vmVerify.json.result?.reasonCode
});
const placement = await placeOnVm(vmRoot, "workspace");
step("vm-placement", {
  ok: placement.placed === true,
  reasonCode: "WORKSPACE_ROOTS_REPLACED_CANONICAL",
  ...placement,
  finding: "引擎将工作区绑定于五个绝对根路径且无搬迁动词;字节迁移后须以引擎自身的 canonicalJson+assertDistinctRoots 重写 workspace.json 根记录方可通过 validate——真切换仪式需要一个受治 placement 步骤,本演练在一次性副本上实施并记录前后摘要"
});
const vmValidate = await engineVm("validate", ["--workspace", `${vmRoot}/workspace`]);
const vmStatus = await engineVm("status", ["--workspace", `${vmRoot}/workspace`]);
step("vm-validate", {
  ok: vmValidate.json.reasonCode === "WORKSPACE_COMMAND_COMPLETED"
    && vmStatus.json.headEventHash === status.headEventHash
    && vmStatus.json.version === status.version,
  reasonCode: vmValidate.json.reasonCode,
  vmHeadEventHash: vmStatus.json.headEventHash,
  vmVersion: vmStatus.json.version,
  headFullValueEqualsLocalAnchor: vmStatus.json.headEventHash === status.headEventHash
});

receipt.ok = true;
receipt.finishedAt = instant();
receipt.verificationShape = "矩阵在暂存侧双跑 + 传输字节对账(双向全值) + 落地侧引擎复验(snapshot-verify 先于 placement,validate 于 placement 后)——即切换仪式的验证形状";
receipt.chain = {
  workspaceId: status.workspaceId,
  headEventHash: status.headEventHash,
  version: status.version,
  records: { project: project.record.id, initiative: initiative.record.id, train: train.record.id }
};
receipt.attestSidecarSetDigest = sha256Text(
  localLedger(attestDir).map((f) => `${f.path} ${f.sha256}`).join("\n"));
saveState("act1", receipt);
console.log(JSON.stringify({ ok: true, localRoot, vmRoot, head: status.headEventHash, version: status.version, matrix: matrix.summary }, null, 2));
