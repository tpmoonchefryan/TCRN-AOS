#!/usr/bin/env node
// TCRN-AOS-STORY-132 — bring the resident cockpit up on the VM.
//
// One command, declarative in the sense that matters: every path, every
// environment value and the whole unit text come from manifest.mjs, and this file
// only carries the ORDER — which is itself a set of findings rather than taste.
//
//   0. preconditions. The engine on the VM is the version the chain was
//      relocated under, the chain answers `status` at its new address, and this
//      repository has a fresh build to stage.
//   1. authority. The VM's minimal safe-write bundle travels byte-unchanged; its
//      PINS are re-minted for the VM path. Pins bind trust to an absolute path by
//      design, so a new placement mints new pins — the MIN-007 D4 re-signing
//      clause, and the reason a copied pins file would fail closed rather than
//      work insecurely. The byte authority is the engine's own canonicalJson and
//      canonicalSha256; no serializer of ours.
//   2. runtime, pass one: compiled code and the domain migrations. This pass has
//      to precede the data build, because the AOS partition is now projected ON
//      the VM by the VM's own copy of that compiled projection code.
//   3. the precious store, through its own recipe, with its own receipt.
//   4. the cockpit web, built from the four chains as they now stand — AOS read
//      on the VM, the other three read locally, read-only.
//   5. runtime, pass two: the built web, then a per-file sha256 ledger computed
//      independently on both sides and compared full-value in both directions.
//   6. the unit. Rendered, checked against the copy committed in this repository,
//      installed, and read back — three-way, because any two-way check leaves one
//      pair free to differ.
//   7. enable, start, and prove it: enabled for boot, active now, answering on
//      the VM's loopback, and saying on /api/health what it is actually holding.
//
// The service is left RUNNING. It is the deliverable.

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  ACTOR, MODULE_VIEWS, PARTITION_ID, PORT, UNIT_NAME, UNIT_PATH,
  VM_ATTEST_DIR, VM_AUTHORITY_DIR, VM_AUTHORITY_PINS,
  VM_DOMAIN_DB, VM_ENGINE, VM_ENGINE_MCP, VM_ROOT, VM_RUNTIME, VM_WEB, VM_WORKSPACE,
  renderUnit, unitEnvironment
} from "./manifest.mjs";
import { resignPinsForVm } from "./authority.mjs";
import { judgeUnitBytes } from "./resident-predicates.mjs";
import {
  STATE_DIR, VM_HOST, compareLedgers, instant, localLedger, remoteLedger, run,
  rsyncToVm, saveState, sha256Text, shellQuote, ssh, stepper, systemctl
} from "./resident-lib.mjs";
import { scrubHostPaths } from "../../scripts/lib/evidence-hygiene.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const COMMITTED_UNIT = join(REPO_ROOT, "deploy/aos-resident-cockpit", UNIT_NAME);
const STAGE = join(STATE_DIR, "stage");
const EXPECTED_ENGINE_VERSION = "0.9.0";

const receipt = {
  schemaVersion: "aos.resident-cockpit-apply.v1",
  story: "TCRN-AOS-STORY-132",
  ruling: "Owner: 座舱常驻(A 模式的核心即此 UI);拓扑=TCRN-AOS-STORY-131 迁置后的 VM 真值根;访问形态=CONF-007 D7",
  ok: false,
  startedAt: instant(),
  steps: []
};
const step = stepper("apply", receipt, (partial) => saveState("apply", scrubHostPaths(partial)));

/* ---- 0. preconditions ---------------------------------------------------- */

const engineVersion = (await ssh(["cat", `${VM_ENGINE}/package.json`])).stdout;
const vmEngineVersion = JSON.parse(engineVersion).version;
const chainStatus = JSON.parse((await ssh([
  ["node", `${VM_ENGINE}/scripts/tcrn-workflow.mjs`, "status", "--workspace", VM_WORKSPACE]
    .map(shellQuote).join(" ")
])).stdout);
step("preconditions", {
  ok: vmEngineVersion === EXPECTED_ENGINE_VERSION
    && chainStatus.reasonCode === "WORKSPACE_COMMAND_COMPLETED"
    && existsSync(join(REPO_ROOT, "dist/apps/cockpit-service/src/service.js")),
  reasonCode: "VM_ENGINE_AND_CHAIN_READABLE",
  vmEngineVersion,
  expectedEngineVersion: EXPECTED_ENGINE_VERSION,
  chain: {
    workspaceId: chainStatus.workspaceId,
    version: chainStatus.version,
    headEventHash: chainStatus.headEventHash,
    work: chainStatus.work
  },
  localBuildPresent: true,
  verbsRunAgainstTheChain: ["status (read-only)"]
});

/* ---- 1. authority: bundle travels, pins are re-minted for the VM path ---- */

rmSync(STAGE, { recursive: true, force: true });
const staged = await resignPinsForVm(join(STAGE, "authority"));
const pinsFileDigest = staged.pinsFileDigest;
step("pins-resigned-for-the-vm-path", {
  ok: staged.bundleUnchanged
    && staged.pinsDigestAfter !== staged.pinsDigestBefore
    && staged.pathAfter !== staged.pathBefore
    && staged.bundle.mcp.writeCommands.length === 3,
  reasonCode: "OPERATOR_PINS_RESIGNED_FOR_VM_PATH",
  clause: "MIN-007 D4 既有条款:pins 按绝对路径签,换址即重签;bundle 字节不变故 authorityFileSha256 两侧全值相等",
  authorityId: staged.bundle.authorityId,
  generation: staged.bundle.generation,
  expiresAt: staged.bundle.expiresAt,
  writeCommands: staged.bundle.mcp.writeCommands,
  authorityOutputCommands: staged.bundle.mcp.authorityOutputCommands,
  bundleFileSha256: staged.bundleFileSha256,
  bundleFileSha256UnchangedFromSource: staged.bundleUnchanged,
  pathBefore: staged.pathBefore,
  pathAfter: staged.pathAfter,
  pinsDigestBefore: staged.pinsDigestBefore,
  pinsDigestAfter: staged.pinsDigestAfter,
  pinsFileSha256: pinsFileDigest,
  byteAuthority: staged.byteAuthority
});

await ssh(["mkdir", "-p", VM_AUTHORITY_DIR]);
await run("rsync", ["--archive",
  `${join(STAGE, "authority")}/`, `${VM_HOST}:${VM_AUTHORITY_DIR}/`]);
// chmod as its own step: this host's rsync is openrsync (2.6.9-compatible) and
// has no --chmod, so a permission asserted through the transfer flags would be
// asserted through a flag that was silently not applied.
await ssh(["chmod", "600", VM_AUTHORITY_PINS, `${VM_AUTHORITY_DIR}/operator-authority.json`]);
// Quoted at the boundary: ssh re-joins its remote argv with spaces and the
// remote shell re-tokenizes, so `%a %n` arrives as two arguments and `stat` reads
// the second as a filename.
const authorityModes = (await ssh([["stat", "-c", "%a %n",
  `${VM_AUTHORITY_DIR}/operator-authority.json`, VM_AUTHORITY_PINS].map(shellQuote).join(" ")]))
  .stdout.trim();
const placedPinsSha = (await ssh(["sha256sum", VM_AUTHORITY_PINS])).stdout.trim().split(/\s+/u)[0];
step("authority-placed", {
  ok: placedPinsSha === pinsFileDigest && authorityModes.split("\n").every((line) => line.startsWith("600 ")),
  reasonCode: "AUTHORITY_PLACED_MODE_0600",
  modes: authorityModes.split("\n"),
  pinsShaOnVm: placedPinsSha
});

/* ---- 2. runtime, pass one: the compiled code the VM needs to read a chain */

mkdirSync(join(STAGE, "runtime"), { recursive: true });
cpSync(join(REPO_ROOT, "dist"), join(STAGE, "runtime/dist"), { recursive: true });
cpSync(join(REPO_ROOT, "packages/db/migrations/domain"),
  join(STAGE, "runtime/packages/db/migrations/domain"), { recursive: true });
cpSync(join(REPO_ROOT, "deploy/aos-resident-cockpit/vm-resident-runner.mjs"),
  join(STAGE, "runtime/vm-resident-runner.mjs"));
await rsyncToVm(join(STAGE, "runtime"), VM_RUNTIME, { excludes: ["web"] });
step("runtime-pass-one", {
  ok: (await ssh(["test", "-f", `${VM_RUNTIME}/dist/packages/projection/src/index.js`],
    { allowFailure: true })).code === 0,
  reasonCode: "RUNTIME_CODE_ON_VM",
  why: "先码后数据:AOS 分区的投影现在由 VM 自己这份编译后的 projection 代码产出,所以它必须先到"
});

/* ---- 3. the precious store ---------------------------------------------- */

// A store already on the VM is the LIVE one by then. Re-transferring the archive
// over it would silently discard every write made since the migration, so a
// redeploy re-verifies instead of moving. Which mode ran is recorded, never
// implied: the two carry different reason codes and different strengths.
const storeAlreadyMigrated = (await ssh(["test", "-e", VM_DOMAIN_DB], { allowFailure: true })).code === 0;
const migrationOut = await run(process.execPath,
  [join(REPO_ROOT, "deploy/aos-resident-cockpit/migrate-domain-store.mjs"),
    ...(storeAlreadyMigrated ? ["--verify-only"] : [])],
  { cwd: REPO_ROOT, env: { ...process.env, TCRN_AOS_RESIDENT_STATE: STATE_DIR } });
const migration = JSON.parse(migrationOut.stdout);
step("domain-store-migrated", {
  ok: migration.ok === true,
  reasonCode: migration.reasonCodes?.at(-2) ?? (migration.ok ? "DOMAIN_STORE_OK" : "DOMAIN_STORE_MIGRATION_FAILED"),
  mode: storeAlreadyMigrated ? "verify (the store was already there and is the live one)" : "transfer",
  counts: migration.counts,
  remoteSqlCounts: migration.remoteSqlCounts,
  receipt: "deploy/aos-resident-cockpit/migrate-domain-store.mjs (own receipt, folded into the evidence)"
});

/* ---- 4. the cockpit web, from the chains as they now stand --------------- */

const dataOut = join(STAGE, "runtime/dist/apps/web/src/cockpit-data.generated.js");
const built = await run(process.execPath, [join(REPO_ROOT, "scripts/build-cockpit-data.mjs")],
  { cwd: REPO_ROOT, env: { ...process.env, AOS_COCKPIT_DATA_OUT: dataOut } });
const dataReceipt = JSON.parse(built.stdout);
const aosPartitionLine = dataReceipt.partitions.find((entry) => entry.startsWith(`${PARTITION_ID}@`));
step("cockpit-data-projected", {
  ok: dataReceipt.ok === true
    && aosPartitionLine === `${PARTITION_ID}@v${chainStatus.version}`,
  reasonCode: "COCKPIT_DATA_PROJECTED_FROM_LIVE_CHAINS",
  partitions: dataReceipt.partitions,
  aosReadOnTheVm: true,
  aosChainVersion: chainStatus.version,
  work: dataReceipt.work,
  gates: dataReceipt.gates,
  conferences: dataReceipt.conferences,
  note: "AOS 分区由 VM 自己的引擎投影(本机那条地址已 vacated,任何读面只会答 WORKSPACE_RELOCATION_VACATED);另三个分区在本机只读"
});

// esbuild is the only staged step needing this repository's dependencies; the
// symlink points OUT of the staging tree into the checkout rather than copying
// node_modules, and nothing is created inside the repository.
if (!existsSync(join(STAGE, "node_modules"))) {
  symlinkSync(join(REPO_ROOT, "node_modules"), join(STAGE, "node_modules"));
}
const webRoot = join(STAGE, "runtime/web");
mkdirSync(join(webRoot, "assets"), { recursive: true });
const { renderAosShellHtml } = await import(pathToFileURL(
  join(STAGE, "runtime/dist/apps/web/src/app.js")).href);
// `/` explicitly: called with no argument the renderer answers for `/cockpit`,
// which is the product shell and emits no `data-cockpit-view` at all.
writeFileSync(join(webRoot, "index.html"), renderAosShellHtml({ path: "/" }));
for (const [route] of MODULE_VIEWS) {
  mkdirSync(join(webRoot, route.slice(1)), { recursive: true });
  writeFileSync(join(webRoot, route.slice(1), "index.html"), renderAosShellHtml({ path: route }));
}
const esbuild = await import("esbuild");
await esbuild.build({
  entryPoints: [join(STAGE, "runtime/dist/apps/web/src/client.js")],
  outfile: join(webRoot, "assets/aos-client.js"),
  bundle: true, format: "esm", platform: "browser", target: "es2022",
  sourcemap: false, logLevel: "silent"
});
cpSync(join(REPO_ROOT, "apps/web/dist/assets/tcrn-brand-mark.svg"), join(webRoot, "assets/tcrn-brand-mark.svg"));
step("web-built", {
  ok: existsSync(join(webRoot, "assets/aos-client.js")),
  reasonCode: "WEB_SSR_AND_BUNDLE_BUILT",
  routes: MODULE_VIEWS.length + 1
});

/* ---- 5. runtime, pass two, with a both-direction ledger ----------------- */

await rsyncToVm(join(STAGE, "runtime"), VM_RUNTIME);
const localFiles = localLedger(join(STAGE, "runtime"));
const remoteFiles = await remoteLedger(VM_RUNTIME);
const comparison = compareLedgers(localFiles, remoteFiles);
step("runtime-transfer-reconciled", {
  ok: comparison.ok,
  reasonCode: comparison.ok ? "TRANSFER_LEDGERS_EQUAL" : "TRANSFER_LEDGERS_DIVERGENT",
  compared: comparison.compared,
  missingOnVm: comparison.missingOnVm,
  extraOnVm: comparison.extraOnVm,
  mismatched: comparison.mismatched,
  fileSetDigest: comparison.fileSetDigest,
  bothSidesComputedTheirOwn: "每一侧用自己的 node 走自己的树;比较全值且双向(缺与多都查),不是计数比对",
  preciousStoreOutsideThisTree: !VM_DOMAIN_DB.startsWith(`${VM_RUNTIME}/`)
});

/* ---- 6. the unit: rendered, committed, installed — three-way ------------ */

const rendered = renderUnit({ pinsFileDigest });
// Read, never written here. apply.mjs is one of the three parties this check
// compares; a party that authors one of the other two cannot judge them.
const committed = existsSync(COMMITTED_UNIT) ? readFileSync(COMMITTED_UNIT, "utf8") : null;
if (committed === null || committed !== rendered) {
  step("committed-unit-matches-the-manifest", {
    ok: false,
    reasonCode: committed === null ? "COMMITTED_UNIT_ABSENT" : "COMMITTED_UNIT_DIFFERS_FROM_RENDERED",
    path: `deploy/aos-resident-cockpit/${UNIT_NAME}`,
    remedy: "node deploy/aos-resident-cockpit/emit-unit.mjs, then review and commit the result"
  });
}
await ssh(["mkdir", "-p", VM_ROOT]);
// The unit's Documentation= points at this file, so the deployment carries the
// reasoning for its own shape instead of leaving it in a checkout the VM has no
// copy of.
await run("rsync", ["--archive", join(REPO_ROOT, "deploy/aos-resident-cockpit/README.md"),
  `${VM_HOST}:${VM_ROOT}/DEPLOYMENT.md`]);
await run("rsync", ["--archive", COMMITTED_UNIT, `${VM_HOST}:${UNIT_PATH}`]);
const installed = (await ssh(["cat", UNIT_PATH])).stdout;
const environment = unitEnvironment(installed);
const unitVerdict = judgeUnitBytes({
  rendered,
  committed: readFileSync(COMMITTED_UNIT, "utf8"),
  installed,
  requiredEnvKeys: ["AOS_ACTOR", "AOS_PORT", "AOS_STATIC_ROOT", "AOS_DOMAIN_DB", "AOS_WORKSPACE",
    "AOS_ATTEST_DIR", "AOS_ENGINE_MCP", "AOS_AUTHORITY_PINS", "AOS_AUTHORITY_PINS_DIGEST"],
  environment
});
step("unit-installed", {
  ...unitVerdict,
  path: UNIT_PATH,
  unitSha256: sha256Text(rendered),
  environment,
  actorIsExplicit: environment.AOS_ACTOR === ACTOR,
  pinsPointAtTheVmCopy: environment.AOS_AUTHORITY_PINS === VM_AUTHORITY_PINS,
  attestDirIsSiblingOfWorkspace: environment.AOS_ATTEST_DIR === VM_ATTEST_DIR
    && !VM_ATTEST_DIR.startsWith(`${VM_WORKSPACE}/`)
});

/* ---- 7. enable, start, and prove it ------------------------------------ */

await systemctl(ssh, ["daemon-reload"]);
await systemctl(ssh, ["enable", UNIT_NAME]);
await systemctl(ssh, ["restart", UNIT_NAME]);

let health = null;
for (let attempt = 0; attempt < 30 && health === null; attempt += 1) {
  const probe = await ssh(["curl", "-s", "-m", "2", `http://127.0.0.1:${PORT}/api/health`], { allowFailure: true });
  if (probe.code === 0 && probe.stdout.trim().startsWith("{")) health = JSON.parse(probe.stdout);
  else await new Promise((done) => setTimeout(done, 1000));
}
const isEnabled = await systemctl(ssh, ["is-enabled", UNIT_NAME]);
const isActive = await systemctl(ssh, ["is-active", UNIT_NAME]);
const mainPid = (await systemctl(ssh, ["show", "-p", "MainPID", "--value", UNIT_NAME])).stdout;
const journal = (await ssh(["journalctl", "-u", UNIT_NAME, "-n", "40", "--no-pager", "-o", "cat"],
  { allowFailure: true })).stdout;
if (health === null) receipt.journalOnFailure = journal.slice(-3000);
step("unit-enabled-and-active", {
  ok: isEnabled.stdout === "enabled" && isActive.stdout === "active"
    && health?.ok === true && health.actor === ACTOR
    && health.chainWriteAvailable === true && health.attestationReceiptsEnabled === true
    && health.partitions.length === 1 && health.partitions[0] === PARTITION_ID,
  reasonCode: "RESIDENT_SERVICE_ENABLED_AND_ANSWERING",
  isEnabled: isEnabled.stdout,
  isActive: isActive.stdout,
  mainPid: Number.parseInt(mainPid, 10) || null,
  startsAtBoot: isEnabled.stdout === "enabled",
  health,
  journalCarriesTheStartupLine: journal.includes("\"resident\": true") || journal.includes("tcrn-aos-cockpit"),
  observability: `journalctl -u ${UNIT_NAME}`
});

receipt.deployment = {
  host: VM_HOST,
  root: VM_ROOT,
  runtime: VM_RUNTIME,
  web: VM_WEB,
  domainDatabase: VM_DOMAIN_DB,
  authority: VM_AUTHORITY_DIR,
  unit: UNIT_PATH,
  engine: VM_ENGINE_MCP,
  workspace: VM_WORKSPACE,
  attestDir: VM_ATTEST_DIR,
  boundTo: `127.0.0.1:${PORT}`
};
receipt.notClaimed = [
  "本文不含任何发布、切换或迁置授权;它记录一次已裁定方向下的常驻部署",
  "服务只绑 127.0.0.1;任何非本机的到达都是 ssh -L(CONF-007 D7),本次未在任何非回环地址暴露写面",
  "写面供权仅安全写面三动词;仪式动词(conference/gate/attestation/delete)不在 HTTP 面上",
  "留在本机的三个分区从 VM 不可写:写面对它们答 UNKNOWN_PARTITION",
  "unit 以 root 运行,因为 /srv/tcrn/governance 是 0700 root:root——改所有权是关于真值根围栏的裁定,不是部署配方的顺手事"
];
receipt.ok = receipt.steps.every((entry) => entry.ok !== false);
receipt.finishedAt = instant();
saveState("apply", scrubHostPaths(receipt));
console.log(JSON.stringify({
  ok: receipt.ok,
  reasonCodes: receipt.steps.map((entry) => entry.reasonCode),
  unit: UNIT_PATH,
  health
}, null, 2));
if (!receipt.ok) process.exitCode = 1;
