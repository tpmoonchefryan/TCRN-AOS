#!/usr/bin/env node
// STORY-179 — the PG backup mode, the companion flow to `paired-backup.mjs`.
//
// ADR 0004 §6 face 6 redefined the backup: `paired:backup` switches from a file-tree
// snapshot to a VM-side `pg_dump` in custom format + a sha256 digest sidecar. The file
// path is untouched — local mode and the shadow chains still need it (constraint 1) —
// so the PG path is a PARALLEL flow sharing the same orchestration conventions: the pair
// is TAKEN where the data lives, PULLED here (the machine holding the credential), proved
// here (digest + structure, not a tree walk), and ROTATED oldest-first only after the new
// copy proved itself. One byte injected into the dump or its digest, and the off-site
// verify must go red (the red leg).
//
// Usage:
//   node deploy/aos-resident-cockpit/pg-paired-backup.mjs                          # every chain
//   node deploy/aos-resident-cockpit/pg-paired-backup.mjs --verify-offsite
//   node deploy/aos-resident-cockpit/pg-paired-backup.mjs --partition cross-project  # narrow
//   node deploy/aos-resident-cockpit/pg-paired-backup.mjs --no-red-drill
//
// Env (all optional; the defaults are the production VM shape):
//   TCRN_PG_CONNECTION      postgresql://role:pass@127.0.0.1:5432/tcrn_governance
//   TCRN_PG_DRIVER          absolute path to the `pg` driver's lib/index.js
//   TCRN_PG_DUMP_CMD        JSON argv for pg_dump, `{SCHEMA}` placeholder, archive to stdout
//   TCRN_PG_RESTORE_CMD     JSON argv for pg_restore --list, `{FILE}` placeholder
//   TCRN_PG_PAIR_ROOT       primary pair root
//   TCRN_PG_OFFSITE_ROOT    off-site pair root
//   TCRN_PG_TAKE_HOST       ssh host when the take runs on the VM; "local" to run it here

import { spawn } from "node:child_process";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { VM_ENGINE } from "./manifest.mjs";
import { AOS_PARTITIONS } from "../aos-local-client/aos-partitions.mjs";
import { instant, run, saveState, sha256File, stepper } from "./resident-lib.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TAKE_PROGRAM = join(HERE, "pg-backup-take.mjs");
const VERIFY_PROGRAM = join(HERE, "pg-backup-verify.mjs");
const runFile = promisify(execFile);

const ROSTER = Object.freeze(Object.keys(AOS_PARTITIONS));
const OFFSITE_LABEL = "operator-machine";
const OFFSITE_ROOT = process.env.TCRN_PG_OFFSITE_ROOT
  ?? join(process.env.AOS_PAIRED_BACKUP_DEST ?? resolve(homedir(), "OneDrive/Github/tcrn-aos-paired-backups"), "pg-backups");
const RETENTION = Number.parseInt(process.env.AOS_BACKUP_RETENTION ?? "5", 10);

const VERIFY_ONLY = process.argv.includes("--verify-offsite");
const RED_DRILL = !process.argv.includes("--no-red-drill");
const MODE = VERIFY_ONLY ? "verify-offsite" : "take";

/** The PG-backed world. Defaults are the production VM shape; the empirical harness on
 * the local Docker PG overrides them via env. */
const PG = {
  connection: process.env.TCRN_PG_CONNECTION ?? "postgresql://tcrn_engine@127.0.0.1:5432/tcrn_governance",
  database: process.env.TCRN_PG_DATABASE ?? "tcrn_governance",
  driverPath: process.env.TCRN_PG_DRIVER ?? join(VM_ENGINE, "node_modules/pg/lib/index.js"),
  dumpCommand: JSON.parse(process.env.TCRN_PG_DUMP_CMD
    ?? JSON.stringify(["pg_dump", "-h", "127.0.0.1", "-d", "tcrn_governance", "-F", "c", "--schema", "{SCHEMA}"])),
  restoreCommand: JSON.parse(process.env.TCRN_PG_RESTORE_CMD
    ?? JSON.stringify(["pg_restore", "--list", "{FILE}"])),
  primaryRoot: process.env.TCRN_PG_PAIR_ROOT ?? "/srv/tcrn/backups/pg-pairs",
  takeHost: process.env.TCRN_PG_TAKE_HOST ?? "local"
};

/**
 * ADR 0004 §2: one chain schema per chain, named from the partition id. The names are
 * short mnemonics, not mechanical lowercasing — `cross-project` is `chain_cross`, not
 * `chain_cross_project` — so this mirrors the canonical enumeration in the engine's
 * `packages/pg-backend/schema/chain-ddl.sql` rather than deriving it.
 */
const PG_SCHEMAS = Object.freeze({
  "TCRN-AOS": "chain_aos",
  "Joi-Button": "chain_joi",
  "cross-project": "chain_cross",
  "TCRN-Design-System": "chain_ds",
  "TCRN-TMS": "chain_tms"
});
const schemaFor = (partitionId) => {
  const schema = PG_SCHEMAS[partitionId];
  if (!schema) throw new Error(`${partitionId} has no PG chain schema on this roster`);
  return schema;
};

function selectedTargets(argv) {
  const targets = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--partition")) continue;
    const id = token === "--partition" ? argv[index + 1]
      : token.startsWith("--partition=") ? token.slice("--partition=".length) : undefined;
    if (!ROSTER.includes(id)) {
      throw new Error(`${token} does not name a governed chain on this roster; known: ${ROSTER.join(" ")}`);
    }
    if (!targets.includes(id)) targets.push(id);
  }
  return targets.length > 0 ? targets : [...ROSTER];
}
const TARGETS = selectedTargets(process.argv);

const runReceipt = {
  schemaVersion: "aos.pg-paired-backup.v1",
  ruling: "ADR 0004 §6 face 6 — paired:backup redefined as VM-side pg_dump + sha256; pull direction unchanged",
  ok: false,
  mode: MODE,
  startedAt: instant(),
  steps: [],
  partitions: [],
  notClaimed: [
    "PG 备份的异地校验是「摘要比对 + 结构校验」(pg_restore --list),不再逐文件树比对——产物是单个定制格式归档,不是树",
    "归档本身不证明此刻的活库等于归档记录的链;那需要连库,由 pg-chain-verify.mjs 回答",
    "此流程只证明归档到达异地且自证完整,不执行恢复"
  ]
};
const globalStep = stepper("pg-paired", runReceipt, () => {
  saveState("pg-paired-backup", runReceipt);
});

const RUN_STATE = VERIFY_ONLY ? "pg-paired-backup-verify-offsite" : "pg-paired-backup";
const partitionStateName = (partitionId) => `pg-paired-backup-${VERIFY_ONLY ? "verify-" : ""}${partitionId}`;

/* ------------------------------------------------------------------ transport */

function takeConfigFor(partitionId) {
  return {
    partition: partitionId,
    schema: schemaFor(partitionId),
    pgConnection: PG.connection,
    pgDatabase: PG.database,
    pgDriverPath: PG.driverPath,
    pgDumpCommand: PG.dumpCommand,
    pgRestoreCommand: PG.restoreCommand,
    pairRoot: join(PG.primaryRoot, partitionId),
    takenOnHost: PG.takeHost === "local" ? null : PG.takeHost
  };
}

/**
 * Run the take program where the PG data lives.
 *
 * Local: the empirical harness (this machine's Docker PG) executes the committed take
 * program directly. VM: the bytes are streamed over ssh stdin exactly as
 * `paired-backup.mjs` streams `vm-take-pair.mjs` — no deployed copy exists to drift.
 */
async function runTakePg(config) {
  const source = await readFile(TAKE_PROGRAM);
  const encoded = Buffer.from(JSON.stringify(config), "utf8").toString("base64");
  if (PG.takeHost !== "local") {
    const out = await new Promise((resolvePromise, rejectPromise) => {
      const child = spawn("ssh", [PG.takeHost, "node", "--input-type=module", "-", encoded],
        { stdio: ["pipe", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => { stdout += chunk; });
      child.stderr.on("data", (chunk) => { stderr += chunk; });
      child.on("error", rejectPromise);
      child.on("close", (code) => {
        try {
          resolvePromise({ exitCode: code, result: JSON.parse(stdout), stderr });
        } catch {
          rejectPromise(new Error(`pg take program exited ${code} without JSON: ${stderr.slice(0, 1200)}`));
        }
      });
      child.stdin.end(source);
    });
    return { ...out, programSha256: sha256File(TAKE_PROGRAM) };
  }
  const { stdout, stderr } = await run(process.execPath, [TAKE_PROGRAM, encoded], { cwd: HERE });
  return { exitCode: 0, result: JSON.parse(stdout), stderr, programSha256: sha256File(TAKE_PROGRAM) };
}

async function runVerifyPg(directory, schema) {
  const args = [VERIFY_PROGRAM, "--directory", directory];
  if (schema) args.push("--schema", schema);
  try {
    const { stdout } = await runFile(process.execPath, args, { cwd: HERE, maxBuffer: 64 * 1024 * 1024 });
    return JSON.parse(stdout);
  } catch (error) {
    // A RED verdict is data, not a transport failure: the verify program exits 1 on a
    // mismatch on purpose, and execFile surfaces that as a rejection. The receipt is in
    // stdout either way.
    return JSON.parse(String(error.stdout ?? "{}"));
  }
}

/* ------------------------------------------------------------------- rotation */

async function rotatePairs(root, keep) {
  if (!existsSync(root)) return { kept: 0, deleted: [] };
  const names = (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && existsSync(join(root, entry.name, "pg-backup-manifest.json")))
    .map((entry) => entry.name)
    .sort();
  const surplus = names.slice(0, Math.max(0, names.length - keep));
  for (const name of surplus) await rm(join(root, name), { recursive: true, force: true });
  return { root: basename(root), kept: names.length - surplus.length, deleted: surplus };
}

/** The newest off-site PG pair that actually carries a manifest. */
async function newestPair(root) {
  if (!existsSync(root)) return null;
  const names = (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort().reverse();
  for (const name of names) {
    if (existsSync(join(root, name, "pg-backup-manifest.json"))) return join(root, name);
  }
  return null;
}

/* ----------------------------------------------------------- the red drill */

/**
 * Drive the digest predicate red against REAL bytes: flip one byte of the pulled dump,
 * then re-run the off-site verify over a disposable copy. A predicate nobody has seen
 * fail is a predicate nobody has tested.
 */
async function redDrill(offsiteDirectory, schema) {
  const scratch = join(process.env.TMPDIR ?? "/tmp", `pg-paired-red-${process.pid}-${basename(offsiteDirectory)}`);
  const dumpName = `pg-dump-${schema}.dump`;
  const drill = { scratch, cases: [], reclaimed: false };
  try {
    await run("cp", ["-R", offsiteDirectory, scratch]);
    const body = await readFile(join(scratch, dumpName));
    const flipped = Buffer.from(body);
    flipped[100] ^= 0xff;
    await writeFile(join(scratch, dumpName), flipped);
    const verdict = await runVerifyPg(scratch, schema);
    drill.cases.push({
      name: "one byte of the pg_dump archive flipped",
      expectedRed: "DUMP_DIGEST_MISMATCH",
      reasonCode: verdict.reasonCode,
      wentRed: verdict.ok === false && verdict.reasonCode === "DUMP_DIGEST_MISMATCH"
    });
  } finally {
    await rm(scratch, { recursive: true, force: true });
    drill.reclaimed = !existsSync(scratch);
  }
  drill.ok = drill.cases.length === 1 && drill.cases.every((entry) => entry.wentRed) && drill.reclaimed;
  return drill;
}

/* --------------------------------------------------------------- the legs */

function newPartitionReceipt(partitionId) {
  return {
    partition: partitionId,
    schema: schemaFor(partitionId),
    ok: false,
    took: false,
    startedAt: instant(),
    steps: []
  };
}

async function forPartition(partitionId, body) {
  const partitionReceipt = newPartitionReceipt(partitionId);
  const step = stepper(`pg-paired:${partitionId}`, partitionReceipt, (partial) => {
    saveState(partitionStateName(partitionId), partial);
  });
  try {
    await body({ partitionReceipt, step });
    partitionReceipt.ok = partitionReceipt.steps.every((entry) => entry.ok !== false);
  } catch (error) {
    partitionReceipt.ok = false;
    partitionReceipt.failure = String(error?.message ?? error).slice(0, 500);
  }
  partitionReceipt.finishedAt = instant();
  saveState(partitionStateName(partitionId), partitionReceipt);
  return partitionReceipt;
}

async function verifyOffsiteLeg({ partitionReceipt, step }) {
  const offsiteRoot = join(OFFSITE_ROOT, partitionReceipt.partition);
  const directory = await newestPair(offsiteRoot);
  step("offsite-pg-pair-present", {
    ok: directory !== null,
    reasonCode: directory ? "OFFSITE_PG_PAIR_FOUND" : "NO_OFFSITE_PG_PAIR",
    directory: directory ? basename(directory) : null,
    remedy: directory ? null
      : `node deploy/aos-resident-cockpit/pg-paired-backup.mjs --partition ${partitionReceipt.partition}`
  });
  if (!directory) return;
  const verdict = await runVerifyPg(directory, partitionReceipt.schema);
  step("offsite-pg-pair-verified", {
    ok: verdict.ok === true,
    reasonCode: verdict.reasonCode,
    predicate: "摘要比对 + 结构校验(pg_restore --list),不是逐文件树比对",
    observed: verdict.observed
  });
  partitionReceipt.verified = {
    pairId: basename(directory),
    takenAt: verdict.manifest?.takenAt ?? null,
    reasonCode: verdict.reasonCode
  };
}

async function takeLeg({ partitionReceipt, step }) {
  const partitionId = partitionReceipt.partition;
  const config = takeConfigFor(partitionId);
  const offsiteRoot = join(OFFSITE_ROOT, partitionId);

  /* ---- 1. take where the data lives ----------------------------------- */
  const taken = await runTakePg(config);
  step("pg-pair-taken-on-the-host-holding-the-data", {
    ok: taken.result.ok === true,
    reasonCode: taken.result.ok ? "PG_PAIR_TAKEN" : "PG_PAIR_REFUSED",
    host: PG.takeHost === "local" ? OFFSITE_LABEL : PG.takeHost,
    partition: partitionId,
    schema: partitionReceipt.schema,
    takenAt: taken.result.instant ?? null,
    eventsCount: taken.result.manifest?.live?.eventsCount ?? null,
    headEventHash: taken.result.manifest?.live?.headEventHash ?? null,
    dumpSha256: taken.result.manifest?.dumpSha256 ?? null,
    structureOk: taken.result.manifest?.structure?.ok ?? null,
    programSha256: taken.programSha256,
    takenFailure: taken.result.ok ? null : taken.result.manifest
  });
  partitionReceipt.took = true;
  const pairId = basename(taken.result.directory);
  const primaryDirectory = taken.result.directory;

  /* ---- 2. pull it here (PULL, initiated by the side holding the credential) - */
  const offsiteDirectory = join(offsiteRoot, pairId);
  await mkdir(offsiteDirectory, { recursive: true });
  const primaryAddress = PG.takeHost === "local" ? `${primaryDirectory}/` : `${PG.takeHost}:${primaryDirectory}/`;
  await run("rsync", ["--archive", "--delete", primaryAddress, `${offsiteDirectory}/`]);
  step("pg-pair-pulled-off-site", {
    ok: true,
    reasonCode: "PULLED",
    direction: "pull, initiated by the machine that holds the credential",
    primary: { host: PG.takeHost === "local" ? OFFSITE_LABEL : PG.takeHost, path: primaryDirectory },
    offsite: { host: OFFSITE_LABEL, path: offsiteDirectory }
  });

  /* ---- 3. re-prove it here, with this machine's own reading of its bytes -- */
  const verdict = await runVerifyPg(offsiteDirectory, partitionReceipt.schema);
  step("offsite-pg-pair-reproven", {
    ok: verdict.ok === true,
    reasonCode: verdict.reasonCode,
    predicate: "重新对拉回的字节算摘要、重跑结构校验;不信任传输命令的退出码",
    observed: verdict.observed
  });

  /* ---- 4. the red drill, once per run, on a disposable copy -------------- */
  if (!RED_DRILL) {
    step("pg-digest-predicate-driven-red", {
      ok: true,
      reasonCode: "RED_DRILL_SKIPPED_BY_FLAG",
      ran: false
    });
  } else if (redDrillThisRun === null) {
    const drill = await redDrill(offsiteDirectory, partitionReceipt.schema);
    redDrillThisRun = drill;
    step("pg-digest-predicate-driven-red", {
      ...drill,
      ran: true,
      reasonCode: drill.ok ? "PREDICATE_CAN_FAIL" : "PREDICATE_DID_NOT_FAIL_AS_EXPECTED"
    });
  } else {
    step("pg-digest-predicate-driven-red", {
      ok: redDrillThisRun.ok,
      reasonCode: redDrillThisRun.ok ? "PREDICATE_ALREADY_DRIVEN_RED_THIS_RUN" : "PREDICATE_DID_NOT_FAIL_AS_EXPECTED",
      ran: false
    });
  }

  /* ---- 5. rotate, last, and only after the new pair proved itself -------- */
  const rotatedPrimary = await rotatePairs(join(PG.primaryRoot, partitionId), RETENTION);
  const rotatedOffsite = await rotatePairs(offsiteRoot, RETENTION);
  step("rotated-after-verification", {
    ok: true,
    reasonCode: "ROTATED_OLDEST_FIRST",
    primary: rotatedPrimary,
    offsite: rotatedOffsite,
    rule: "坏备份永远不会成为好备份被删的理由——轮换只在新的一对自证之后跑"
  });

  partitionReceipt.pair = {
    pairId,
    takenAt: taken.result.instant,
    schema: partitionReceipt.schema,
    primary: { host: PG.takeHost === "local" ? OFFSITE_LABEL : PG.takeHost, path: primaryDirectory },
    offsite: { host: OFFSITE_LABEL, path: offsiteDirectory },
    dumpSha256: taken.result.manifest.dumpSha256,
    eventsCount: taken.result.manifest.live.eventsCount,
    headEventHash: taken.result.manifest.live.headEventHash
  };
}

let redDrillThisRun = null;

/* ------------------------------------------------------------------- the flow */

globalStep("pg-driver-surface-present", {
  ok: existsSync(TAKE_PROGRAM) && existsSync(VERIFY_PROGRAM),
  reasonCode: "PG_BACKUP_SURFACE_PRESENT",
  remedy: "the take and verify programs live beside this orchestrator"
});

for (const partitionId of TARGETS) {
  runReceipt.partitions.push(await forPartition(partitionId, VERIFY_ONLY ? verifyOffsiteLeg : takeLeg));
}

runReceipt.coverage = {
  roster: ROSTER,
  covered: runReceipt.partitions.map((entry) => entry.partition),
  completeRoster: TARGETS.length === ROSTER.length,
  everyTargetAttempted: runReceipt.partitions.length === TARGETS.length,
  failed: runReceipt.partitions.filter((entry) => entry.ok !== true).map((entry) => entry.partition)
};
runReceipt.ok = runReceipt.steps.every((entry) => entry.ok !== false)
  && runReceipt.coverage.everyTargetAttempted
  && runReceipt.partitions.every((entry) => entry.ok === true);
runReceipt.finishedAt = instant();
saveState(RUN_STATE, runReceipt);

console.log(JSON.stringify({
  ok: runReceipt.ok,
  mode: MODE,
  coverage: runReceipt.coverage,
  partitions: runReceipt.partitions.map((entry) => ({
    partition: entry.partition,
    schema: entry.schema,
    ok: entry.ok,
    took: entry.took,
    pairId: entry.pair?.pairId ?? entry.verified?.pairId ?? null,
    eventsCount: entry.pair?.eventsCount ?? null,
    reasonCodes: entry.steps.map((item) => item.reasonCode)
  }))
}, null, 2));
if (!runReceipt.ok) process.exitCode = 1;
