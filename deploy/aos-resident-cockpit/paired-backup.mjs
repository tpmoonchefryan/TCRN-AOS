#!/usr/bin/env node
// The paired backup ceremony, re-wired for the topology both halves now live in
// (TCRN-AOS-INC-045).
//
// WHAT BROKE. The pairing rule never changed: `domain.db` holds annotations keyed
// by chain record id and the chain holds the records those keys point at, so a
// domain snapshot restored beside a chain snapshot from an hour earlier produces
// annotations hanging off record ids the restored chain never heard of — which
// reads as data corruption, not as a mismatched pair. What broke was the
// assumption underneath the old path: that both halves are on the machine running
// the script. STORY-131 moved the chain to the VM, STORY-132 moved the store after
// it, and in the window between them a "pair" was not merely awkward to take, it
// was impossible: two halves read across a network at two different moments are
// two snapshots sharing a directory.
//
// WHO INITIATES, AND WHY. Two separate questions, with two different answers.
//
//   The pair is TAKEN on the VM. Both halves live there, and both proofs need
//   something that lives there with them — `snapshot-verify` needs the engine, the
//   restore drill needs the domain runtime. This is the standing use MIN-011 kept
//   the VM engine in service for: remote restorability is self-provable, so the
//   proof happens where the bytes are instead of being asserted from a distance.
//   Reading a live SQLite file across a network would also be exactly the torn-page
//   hazard the runbook already forbids.
//
//   The ceremony is INITIATED here, from the operator's machine, and so is the
//   off-site copy. The credential asymmetry is the security property and it has not
//   moved: this machine holds the key, the VM holds `authorized_keys` and nothing
//   that can reach back. Whoever holds the credential initiates. While the truth
//   was local that meant push; now that the truth is remote the same invariant
//   means PULL. Nothing new is placed on the VM either way.
//
// Usage:
//   node deploy/aos-resident-cockpit/paired-backup.mjs                # take, pull, prove, rotate
//   node deploy/aos-resident-cockpit/paired-backup.mjs --if-due       # only when the off-site copy is stale
//   node deploy/aos-resident-cockpit/paired-backup.mjs --verify-offsite
//   node deploy/aos-resident-cockpit/paired-backup.mjs --no-red-drill # skip the tamper drill only

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, hostname } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  PARTITION_ID, VM_ATTEST_DIR, VM_DOMAIN_DB, VM_ENGINE, VM_HOST, VM_PAIR_ROOT, VM_ROOT,
  VM_RUNTIME, VM_WORKSPACE
} from "./manifest.mjs";
import {
  judgeOffsiteCopy, judgePairing, judgeUnpairedDisciplineRetired
} from "./resident-predicates.mjs";
import {
  compareLedgers, hasState, instant, loadState, localLedger, remoteLedger, run, saveState,
  sha256File, sha256Text, ssh, sshNode, stepper
} from "./resident-lib.mjs";
import { scrubHostPaths } from "../../scripts/lib/evidence-hygiene.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");
const PLATFORM_ROOT = resolve(REPO_ROOT, "..");
const LOCAL_ENGINE = join(PLATFORM_ROOT, "tcrn-workflow");
const TAKE_PROGRAM = join(HERE, "vm-take-pair.mjs");

/**
 * The off-site host, as it appears in a committed receipt.
 *
 * The comparison that matters — is the off-site copy on a DIFFERENT machine from
 * the truth — runs on the real hostnames. But this repository is public, and a
 * laptop's hostname is usually a person's name; publishing it is the same class of
 * drift as publishing a home directory, which this platform already paid to remove
 * from 93 commits (TCRN-AOS-INC-037). So the receipt carries a deterministic
 * pseudonym plus the digest of the real name: a later run can still prove it is
 * the same machine, and nobody's name ships.
 */
const OFFSITE_HOST = hostname();
const OFFSITE_LABEL = "operator-machine";
const OFFSITE_HOST_DIGEST = sha256Text(OFFSITE_HOST);
const maskOffsiteHost = (value) => {
  if (typeof value === "string") return value.split(OFFSITE_HOST).join(OFFSITE_LABEL);
  if (Array.isArray(value)) return value.map(maskOffsiteHost);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .map(([key, entry]) => [maskOffsiteHost(key), maskOffsiteHost(entry)]));
  }
  return value;
};

/** The off-site root. Unchanged from the old path, deliberately — see the runbook. */
const OFFSITE_ROOT = process.env.AOS_PAIRED_BACKUP_DEST
  ?? resolve(homedir(), "OneDrive/Github/tcrn-aos-paired-backups");
const RETENTION = Number.parseInt(process.env.AOS_BACKUP_RETENTION ?? "5", 10);
const INTERVAL_HOURS = Number.parseInt(process.env.AOS_BACKUP_INTERVAL_HOURS ?? "24", 10);

const IF_DUE = process.argv.includes("--if-due");
const VERIFY_ONLY = process.argv.includes("--verify-offsite");
const RED_DRILL = !process.argv.includes("--no-red-drill");

const receipt = {
  schemaVersion: "aos.paired-backup-new-topology.v1",
  incident: "TCRN-AOS-INC-045",
  ok: false,
  startedAt: instant(),
  topology: {
    chain: { host: VM_HOST, path: VM_WORKSPACE },
    attestations: { host: VM_HOST, path: VM_ATTEST_DIR, relation: "sibling of the workspace root, never inside it" },
    domainStore: { host: VM_HOST, path: VM_DOMAIN_DB },
    engine: { host: VM_HOST, path: VM_ENGINE },
    primaryPairs: { host: VM_HOST, path: VM_PAIR_ROOT },
    offsitePairs: { host: OFFSITE_LABEL, hostDigest: OFFSITE_HOST_DIGEST, path: OFFSITE_ROOT }
  },
  steps: []
};
const step = stepper("paired", receipt, (partial) => {
  saveState("paired-backup", partial);
  // A refusal is kept in its OWN state file, and never cleared by a later success.
  // The reds this flow produces are the interesting part of its record — a
  // fail-closed refusal names a real precondition — and the run that then satisfies
  // the precondition would otherwise erase the only artifact saying it happened.
  const red = partial.steps.find((entry) => entry.ok === false);
  if (red) {
    saveState("paired-backup-last-refusal", {
      observedAt: partial.startedAt,
      step: red.name,
      reasonCode: red.reasonCode,
      lockstep: red.lockstep ?? null,
      remedy: red.remedy ?? null
    });
  }
});

if (hasState("paired-backup-last-refusal")) {
  receipt.lastRefusalThisFlowProduced = {
    ...loadState("paired-backup-last-refusal"),
    note: "上一次 fail-closed 拒绝,连同它当时给出的补救;成功的运行不清除它。"
      + "最常见的一种是知识库高水位落后于链头——每次受治写入之后的常态,补救是一次受治写入,本流程不代做"
  };
}

/* ------------------------------------------------------------------ transport */

/**
 * Run the committed take program ON the VM by streaming its bytes over ssh stdin.
 *
 * Streamed rather than deployed: the bytes that execute are the bytes in the
 * repository, so there is no installed second copy to drift from this one and no
 * rsync step whose `--delete` could remove it. The digest of what was sent is
 * recorded, which is the only sense in which "what ran there" is checkable from
 * here.
 */
async function runTakeProgram(config) {
  const source = await readFile(TAKE_PROGRAM);
  const out = await new Promise((resolvePromise, rejectPromise) => {
    // base64, because ssh hands the remote argv to the remote LOGIN SHELL after
    // joining it with spaces: a JSON argument gets brace-expanded and dequoted
    // there, and the program receives fragments of its own config.
    const child = spawn("ssh", [VM_HOST, "node", "--input-type=module", "-",
      Buffer.from(JSON.stringify(config), "utf8").toString("base64")],
    { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      // A non-zero exit here is usually a REFUSAL carrying JSON, not a crash: the
      // program exits 1 whenever its own verdict is red. Parse first, and only
      // treat unparseable output as a failure of the run itself.
      try {
        resolvePromise({ exitCode: code, result: JSON.parse(stdout), stderr });
      } catch {
        rejectPromise(new Error(`vm take program exited ${code} without JSON: ${stderr.slice(0, 1500)}`));
      }
    });
    child.stdin.end(source);
  });
  return { ...out, programSha256: sha256File(TAKE_PROGRAM) };
}

const baseConfig = {
  workspace: VM_WORKSPACE,
  attestDir: VM_ATTEST_DIR,
  engine: VM_ENGINE,
  runtime: VM_RUNTIME,
  domainDb: VM_DOMAIN_DB,
  pairRoot: VM_PAIR_ROOT,
  partition: PARTITION_ID,
  // Nothing may write a snapshot inside the control tree, the engine, or the
  // deployed runtime. The engine's own guard enforces it when handed these roots.
  forbiddenRoots: [dirname(dirname(VM_WORKSPACE)), VM_ENGINE, VM_RUNTIME, VM_ROOT]
};

/* --------------------------------------------------- the local re-observation */

/**
 * Recompute, on THIS machine, every fact the pairing judgement needs — from the
 * bytes of the pulled copy, with this machine's own engine and its own runtime.
 *
 * This is the point of pulling rather than trusting a report. The VM said the pair
 * was sound; that claim is re-derived here by a second engine over a second copy
 * of the bytes, and the two verdicts are recorded separately. A single host
 * agreeing with itself is one reading, not two.
 */
async function observePairLocally(directory) {
  const pairManifest = JSON.parse(await readFile(join(directory, "pair-manifest.json"), "utf8"));
  const chainManifestBody = await readFile(join(directory, "chain-snapshot-manifest.json"), "utf8");
  const chainManifest = JSON.parse(chainManifestBody);
  const domainManifest = JSON.parse(await readFile(join(directory, "domain", "domain.db.manifest.json"), "utf8"));

  const chainVerify = await run(process.execPath,
    [join(LOCAL_ENGINE, "scripts/tcrn-workflow.mjs"), "snapshot-verify",
      "--root", join(directory, "chain"), "--manifest", join(directory, "chain-snapshot-manifest.json")],
    { cwd: LOCAL_ENGINE }).then(
    (result) => JSON.parse(result.stdout),
    (error) => { try { return JSON.parse(error.stdout ?? "{}"); } catch { return {}; } });

  // The attestation set digest, recomputed from the copied receipts rather than
  // read back out of the manifest that claims it.
  const attestationDir = join(directory, "attestations");
  const receipts = [];
  if (existsSync(attestationDir)) {
    for (const name of (await readdir(attestationDir)).sort()) {
      receipts.push({ name, sha256: sha256File(join(attestationDir, name)) });
    }
  }

  const drill = await drillLocally(directory);
  return {
    pairManifest,
    observed: {
      domainSnapshotSha256: sha256File(join(directory, "domain", "domain.db")),
      domainExportSha256: sha256File(join(directory, "domain", "domain-export.json")),
      chainManifestSha256: sha256Text(chainManifestBody),
      chainManifestHeadEventHash: chainManifest.headEventHash ?? null,
      chainManifestVersion: chainManifest.version ?? null,
      domainSnapshotManifestCreatedAt: domainManifest.createdAt ?? null,
      domainSnapshotManifestSnapshotDigest: domainManifest.snapshotDigest ?? null,
      attestationSetDigest: sha256Text(receipts.map((item) => `${item.name} ${item.sha256}`).join("\n")),
      chainVerifyReasonCode: chainVerify.reasonCode ?? chainVerify.result?.reasonCode ?? null,
      restoreDrillOk: drill.ok
    },
    localDrill: drill
  };
}

/** The restore drill again, here, with this repository's own build of the store. */
async function drillLocally(directory) {
  const { DomainStore, loadDomainMigrationSql } = await import(
    join(REPO_ROOT, "dist/packages/projection/src/index.js"));
  const { DatabaseSync } = await import("node:sqlite");
  const migration = loadDomainMigrationSql(join(REPO_ROOT, "packages/db/migrations/domain"));
  const exported = JSON.parse(await readFile(join(directory, "domain", "domain-export.json"), "utf8"));

  // Never inside the pair, and never inside the repository: a probe database in
  // either place is a file some later step has to remember to remove.
  const scratchDir = join(process.env.TMPDIR ?? "/tmp", `aos-pair-drill-${process.pid}`);
  await mkdir(scratchDir, { recursive: true });
  const scratch = join(scratchDir, "probe.db");
  const store = new DomainStore(scratch, migration);
  let restored;
  const families = [
    ["annotations", "aos_domain_annotation"],
    ["comments", "aos_domain_comment"],
    ["relations", "aos_domain_relation"],
    ["chainWriteLog", "aos_chain_write_log"]
  ];
  const sqlCounts = {};
  try {
    for (const annotation of exported.annotations) {
      store.setAnnotation({
        partitionId: annotation.partitionId, recordId: annotation.recordId,
        externalKey: annotation.externalKey, assignee: annotation.assignee,
        priority: annotation.priority, labels: annotation.labels,
        updatedAt: annotation.updatedAt, updatedBy: annotation.updatedBy
      });
    }
    for (const comment of exported.comments) store.addComment(comment);
    for (const relation of exported.relations) store.addRelation(relation);
    for (const entry of exported.chainWriteLog ?? []) store.restoreChainWrite(entry);
    restored = store.exportAll();
  } finally {
    store.close();
  }
  const probe = new DatabaseSync(scratch);
  try {
    for (const [family, table] of families) {
      sqlCounts[family] = Number(probe.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n);
    }
  } finally {
    probe.close();
    await rm(scratchDir, { recursive: true, force: true });
  }
  const counts = Object.fromEntries(families.map(([family]) => [family, {
    exported: (exported[family] ?? []).length,
    restored: restored[family].length,
    restoredSqlCount: sqlCounts[family]
  }]));
  return {
    ok: Object.values(counts).every((row) =>
      row.exported === row.restored && row.exported === row.restoredSqlCount),
    counts,
    judges: ["this repository's DomainStore re-read", "raw COUNT(*) per table on the rebuilt file"]
  };
}

/* ------------------------------------------------------------------ the drill */

/**
 * Drive the pairing predicate red against REAL bytes, on a disposable copy.
 *
 * A judgement nobody has seen fail is a judgement nobody has tested. Two reds, one
 * per class of thing this predicate is for: a digest that no longer matches the
 * bytes, and the INC-045 condition itself — a manifest that says its two halves
 * were read on two different machines, with every file in the directory intact.
 *
 * The copy lives under `/srv/tcrn/scratch-inc045-red-<pid>` and its removal is
 * written in the same function that creates it, verified by asking whether the
 * path still exists.
 */
async function redDrill(pairDirectory) {
  const scratch = `/srv/tcrn/scratch-inc045-red-${process.pid}`;
  const drill = { scratch, cases: [], reclaimed: false };
  // Every remote mutation below goes through `node -` rather than a shell command,
  // for the reason this run already paid for once: ssh joins the remote argv with
  // spaces and hands it to the remote LOGIN SHELL, so a quoted string is re-parsed
  // there. A drill whose tampering step is silently mangled by shell quoting would
  // report a green predicate as red, or worse, a red one as green.
  const remoteEdit = (body) => sshNode(`const fs = require("fs");\n${body}\nprocess.stdout.write("ok");`);
  try {
    await ssh(["rm", "-rf", scratch]);
    await ssh(["mkdir", "-p", scratch]);
    await ssh(["cp", "-a", pairDirectory, `${scratch}/tampered`]);

    // Case 1: one byte of the domain snapshot changes. Nothing else is touched, and
    // the file's length does not change either — this is substitution, not truncation.
    await remoteEdit(`const fd = fs.openSync(${JSON.stringify(`${scratch}/tampered/domain/domain.db`)}, "r+");
      const previous = Buffer.alloc(1);
      fs.readSync(fd, previous, 0, 1, 100);
      fs.writeSync(fd, Buffer.from([previous[0] ^ 0xff]), 0, 1, 100);
      fs.closeSync(fd);`);
    const tampered = await runTakeProgram({ ...baseConfig, mode: "observe", pairDir: `${scratch}/tampered` });
    const tamperedVerdict = judgePairing(tampered.result);
    drill.cases.push({
      name: "one byte of the domain snapshot flipped",
      expectedRed: "PAIR_DOMAIN_DIGEST_MISMATCH",
      reasonCode: tamperedVerdict.reasonCode,
      wentRed: tamperedVerdict.ok === false && tamperedVerdict.reasonCode === "PAIR_DOMAIN_DIGEST_MISMATCH"
    });

    // Case 2: the incident's own condition. The pair manifest is rewritten to say
    // its domain half was read on the operator's laptop while the chain half was
    // read here — which is precisely the state that made a pair impossible — and
    // every file in the directory still matches its digest.
    await ssh(["cp", "-a", pairDirectory, `${scratch}/split-hosts`]);
    await remoteEdit(`const p = ${JSON.stringify(`${scratch}/split-hosts/pair-manifest.json`)};
      const d = JSON.parse(fs.readFileSync(p, "utf8"));
      d.halves.domain.host = "operator-laptop";
      fs.writeFileSync(p, JSON.stringify(d, null, 2) + "\\n");`);
    const split = await runTakeProgram({ ...baseConfig, mode: "observe", pairDir: `${scratch}/split-hosts` });
    const splitVerdict = judgePairing(split.result);
    drill.cases.push({
      name: "the manifest says the two halves were read on two different hosts (the INC-045 condition)",
      expectedRed: "PAIR_HALVES_ON_DIFFERENT_HOSTS",
      reasonCode: splitVerdict.reasonCode,
      wentRed: splitVerdict.ok === false && splitVerdict.reasonCode === "PAIR_HALVES_ON_DIFFERENT_HOSTS"
    });
  } finally {
    await ssh(["rm", "-rf", scratch], { allowFailure: true });
    // The predicate is whether the path still exists, asked of the filesystem —
    // not whether the removal command exited 0.
    const left = await ssh(["test", "-e", scratch], { allowFailure: true });
    drill.reclaimed = left.code !== 0;
  }
  drill.ok = drill.cases.length === 2 && drill.cases.every((entry) => entry.wentRed) && drill.reclaimed;
  return drill;
}

/* -------------------------------------------------------------------- rotation */

async function rotateOffsite(keep) {
  if (!existsSync(OFFSITE_ROOT)) return { kept: 0, deleted: [] };
  const names = (await readdir(OFFSITE_ROOT, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && existsSync(join(OFFSITE_ROOT, entry.name, "pair-manifest.json")))
    .map((entry) => entry.name)
    .sort();
  const surplus = names.slice(0, Math.max(0, names.length - keep));
  for (const name of surplus) await rm(join(OFFSITE_ROOT, name), { recursive: true, force: true });
  return { kept: names.length - surplus.length, deleted: surplus };
}

/** The newest off-site pair that actually carries a manifest. */
async function newestOffsitePair() {
  if (!existsSync(OFFSITE_ROOT)) return null;
  const names = (await readdir(OFFSITE_ROOT, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse();
  for (const name of names) {
    if (existsSync(join(OFFSITE_ROOT, name, "pair-manifest.json"))) return join(OFFSITE_ROOT, name);
  }
  return null;
}

/* ------------------------------------------------------------------- the flow */

/* ---- 0. this machine must be able to judge what it pulls ------------------ */
// The off-site side re-proves the pair with its own engine and its own build of
// the domain store. Saying so up front fails closed rather than producing a
// module-not-found after the bytes have already travelled.
step("local-judging-surface-present", {
  ok: existsSync(join(REPO_ROOT, "dist/packages/projection/src/index.js"))
    && existsSync(join(LOCAL_ENGINE, "scripts/tcrn-workflow.mjs")),
  reasonCode: "OFFSITE_HOST_CAN_JUDGE",
  engine: LOCAL_ENGINE,
  remedy: "pnpm build (the off-site re-proof needs this repository's compiled DomainStore)"
});

/* ---- 0b. the retired local path must refuse, and it is asked every run ---- */
// The failure this whole incident is about would not have announced itself. Both
// halves still exist on this machine — a vacated workspace the engine refuses, and
// an archived store beside its sentinel — so the old command could have gone on
// producing pairs that were green in every file and dead in both halves, and
// rotation would then have deleted the last live pair to make room. Asking the old
// path to refuse is therefore part of the ceremony, not a one-off check: a guard
// nobody exercises is a guard nobody notices losing.
const retired = await run(process.execPath, [join(REPO_ROOT, "scripts/paired-backup.mjs")], { cwd: REPO_ROOT })
  .then((result) => ({ exitCode: 0, body: result.stdout }),
    (error) => ({ exitCode: error.code ?? 1, body: String(error.stdout ?? "") }));
const retiredVerdict = (() => { try { return JSON.parse(retired.body); } catch { return {}; } })();
step("the-retired-local-take-refuses", {
  ok: retired.exitCode !== 0 && retiredVerdict.reason === "topology_relocated_this_mode_is_retired",
  reasonCode: retiredVerdict.reason ?? "RETIRED_PATH_DID_NOT_REFUSE",
  exitCode: retired.exitCode,
  chainEngineReasonCode: retiredVerdict.topology?.chain?.engineReasonCode ?? null,
  domainArchiveSentinelPresent: retiredVerdict.topology?.domain?.archiveSentinelPresent ?? null,
  remedyItNames: retiredVerdict.remedy ?? null,
  why: "本机两半都还在原地(链已 vacated、库有归档哨兵),所以旧路径若不拒绝,就会产出一对每个文件都完好、两半都已死的「配对」"
});

if (VERIFY_ONLY) {
  const directory = await newestOffsitePair();
  step("offsite-pair-present", {
    ok: directory !== null,
    reasonCode: directory ? "OFFSITE_PAIR_FOUND" : "NO_OFFSITE_PAIR",
    directory: directory ? basename(directory) : null
  });
  const { pairManifest, observed, localDrill } = await observePairLocally(directory);
  const verdict = judgePairing({ pairManifest, observed });
  step("offsite-pair-reproven", { ...verdict, pairedAt: pairManifest.pairedAt, localDrill });
  receipt.ok = verdict.ok;
  receipt.finishedAt = instant();
  console.log(JSON.stringify({ ok: receipt.ok, mode: "verify-offsite", verdict }, null, 2));
  process.exit(receipt.ok ? 0 : 1);
}

/* ---- 1. the due gate, measured on the OFF-SITE copy ---------------------- */
// The off-site copy is what a lost VM would be restored from, so its age is the
// number that matters. `backup-due-alert.mjs` watches the same value.
if (IF_DUE) {
  const { evaluateDailySnapshotCatchUp } = await import(join(REPO_ROOT, "dist/packages/db/src/index.js"));
  const newest = await newestOffsitePair();
  const latest = newest
    ? JSON.parse(await readFile(join(newest, "pair-manifest.json"), "utf8")).pairedAt
    : null;
  const due = evaluateDailySnapshotCatchUp({ latestSnapshotAt: latest, now: instant(), intervalHours: INTERVAL_HOURS });
  if (!due.due) {
    // Exit 0. "Not due" is a correct outcome, and a scheduler that read it as
    // failure would alert on every run between backups.
    console.log(JSON.stringify({ ok: true, took: false, due, latestPairedAt: latest }, null, 2));
    process.exit(0);
  }
}

/* ---- 2. take the pair where both halves live ----------------------------- */
const taken = await runTakeProgram({ ...baseConfig, mode: "take" });
step("pair-taken-on-the-host-holding-both-halves", {
  ok: taken.result.ok === true,
  reasonCode: taken.result.ok ? "PAIR_TAKEN_ON_ONE_HOST" : (taken.result.reason ?? "PAIR_REFUSED"),
  host: VM_HOST,
  pairedAt: taken.result.instant ?? null,
  pairDirectory: taken.result.directory ?? null,
  programSha256: taken.programSha256,
  programRanAs: "bytes streamed over ssh stdin; no deployed copy exists to drift from the committed file",
  lockstep: taken.result.pair?.lockstep ?? taken.result.lockstep ?? null,
  halves: taken.result.pair?.halves ?? taken.result.halves ?? null,
  chainReasonCode: taken.result.pair?.chain?.reasonCode ?? null,
  domainIntegrityCheck: taken.result.pair?.domain?.integrityCheck ?? null,
  liveStoreIntegrityCheck: taken.result.pair?.domain?.liveIntegrityCheck ?? null,
  liveStoreBytes: taken.result.pair?.domain?.liveStoreBytes ?? null,
  counts: taken.result.pair?.domain?.counts ?? null,
  restoreDrill: taken.result.pair?.restoreDrill ?? null,
  remedy: taken.result.reason === "knowledge_high_water_behind_chain_head"
    ? taken.result.lockstep?.remedy : undefined
});
const pairDirectory = taken.result.directory;
const pairId = basename(pairDirectory);

/* ---- 3. the primary's own judgement, from a second reading of its bytes --- */
const primaryObservation = await runTakeProgram({ ...baseConfig, mode: "observe", pairDir: pairDirectory });
const primaryVerdict = judgePairing(primaryObservation.result);
step("primary-pair-judged-on-the-vm", {
  ...primaryVerdict,
  readTwice: "the take wrote the digests; this step recomputed them from the bytes on disk and re-ran snapshot-verify",
  chainVerifyReasonCode: primaryObservation.result.observed?.chainVerifyReasonCode ?? null
});

/* ---- 4. the off-site copy: this machine pulls it ------------------------- */
// `rsync` is invoked HERE, so the connection is opened by the side holding the
// credential. Nothing is placed on the VM and the VM initiates nothing.
const offsiteDirectory = join(OFFSITE_ROOT, pairId);
await mkdir(offsiteDirectory, { recursive: true });
await run("rsync", ["--archive", "--delete", `${VM_HOST}:${pairDirectory}/`, `${offsiteDirectory}/`]);

// The PRIMARY ledger is the left-hand side, so the discrepancy lists read in the
// direction that matters here: what the truth host has and the off-site copy does
// not. `.DS_Store` is excluded from the local walk because Finder writes one into
// any folder it displays and OneDrive syncs it — it is not part of the pair, and
// `rsync --delete` removes it on the next run anyway.
const primaryLedger = await remoteLedger(pairDirectory);
const offsiteLedger = localLedger(offsiteDirectory, { excludes: new Set([".DS_Store"]) });
const ledger = compareLedgers(primaryLedger, offsiteLedger);
step("offsite-copy-arrived-whole", {
  ok: ledger.ok,
  reasonCode: ledger.ok ? "OFFSITE_FILE_SET_EQUAL" : "OFFSITE_FILE_SET_DIVERGENT",
  compared: ledger.compared,
  fileSetDigest: { primary: ledger.fileSetDigest.local, offsite: ledger.fileSetDigest.remote },
  missingFromOffsite: ledger.missingOnVm,
  extraOnOffsite: ledger.extraOnVm,
  mismatched: ledger.mismatched,
  predicate: "两侧各用自己的工具对自己的字节算摘要,逐路径全值双向比对;不是「传输命令退出 0」"
});

/* ---- 5. and re-proves it, with its own engine ---------------------------- */
const offsite = await observePairLocally(offsiteDirectory);
const offsiteVerdict = judgePairing(offsite);
step("offsite-pair-reproven-by-a-second-engine", {
  ...offsiteVerdict,
  localDrill: offsite.localDrill,
  chainVerifyReasonCode: offsite.observed.chainVerifyReasonCode,
  why: "远端说它成对是一次读数;本机用自己的引擎与自己的 DomainStore 在自己那份字节上重新判一次,才是第二次"
});

// The pre-existing verifier, unchanged, run on the pulled copy. It is the one mode
// of the old path whose premise never depended on where the halves lived, and this
// is the residual-applicability claim being demonstrated rather than asserted.
const legacyVerify = await run(process.execPath,
  [join(REPO_ROOT, "scripts/paired-backup.mjs"), "--verify", offsiteDirectory], { cwd: REPO_ROOT })
  .then((result) => JSON.parse(result.stdout), (error) => {
    try { return JSON.parse(error.stdout ?? "{}"); } catch { return { ok: false }; }
  });
step("the-unchanged-verifier-still-passes-on-the-pulled-copy", {
  ok: legacyVerify.ok === true,
  reasonCode: legacyVerify.ok ? "LEGACY_VERIFY_STILL_APPLICABLE" : "LEGACY_VERIFY_FAILED",
  digestsMatch: legacyVerify.digestsMatch ?? null,
  chainReasonCode: legacyVerify.chainReasonCode ?? null,
  restoreDrillOk: legacyVerify.restoreDrill?.ok ?? null,
  residualApplicability: "scripts/paired-backup.mjs --verify 读的是一个配对目录,与两半住在哪台机器无关——故逐字保留"
});

const offsiteLeg = judgeOffsiteCopy({
  primaryHost: taken.result.pair?.takenOn?.host ?? null,
  offsiteHost: OFFSITE_HOST,
  ledger,
  offsitePairVerdict: offsiteVerdict
});
step("offsite-leg-judged", {
  ...offsiteLeg,
  direction: "pull, initiated by the machine that holds the credential",
  credentialAsymmetry: "unchanged: the VM holds authorized_keys and nothing that can reach this machine"
});

/* ---- 6. the red drill, on a disposable copy ------------------------------ */
if (RED_DRILL) {
  const drill = await redDrill(pairDirectory);
  step("pairing-predicate-driven-red", {
    ...drill,
    reasonCode: drill.ok ? "PREDICATE_CAN_FAIL" : "PREDICATE_DID_NOT_FAIL_AS_EXPECTED",
    why: "没人见过它红过的判据等于没测过的判据;两类红各一次,收尾以路径是否还存在验证回收"
  });
}

/* ---- 6b. the interim discipline INC-045 imposed, and its release --------- */
const disciplineVerdict = judgeUnpairedDisciplineRetired({
  halvesShareOneHost: primaryVerdict.checks.oneHost,
  pairVerdict: offsiteVerdict,
  offsiteVerdict: offsiteLeg,
  restoreDrillOk: offsite.localDrill.ok && taken.result.pair.restoreDrill.ok
});
step("unpaired-marking-discipline-released", {
  ok: disciplineVerdict.retired,
  ...disciplineVerdict,
  imposedBy: "TCRN-AOS-INC-045 scope: 「在此之前每次备份须如实标注「非配对」」",
  criterionText: "域库随 S132 的 VM 常驻座舱迁至 VM、配对备份在新拓扑下重新接线并实证一次同刻配对与恢复演练",
  soFrom: taken.result.instant,
  effect: "此后取的每一对都是真配对,不再需要标注;INC-045 之前取的那些标注保持原样——它们当时是对的"
});

/* ---- 7. rotation, last, and only after the new pair proved itself -------- */
const rotatedPrimary = await runTakeProgram({ ...baseConfig, mode: "rotate", keep: RETENTION });
const rotatedOffsite = await rotateOffsite(RETENTION);
step("rotated-after-verification", {
  ok: true,
  reasonCode: "ROTATED_OLDEST_FIRST",
  primary: rotatedPrimary.result.rotated,
  offsite: rotatedOffsite,
  rule: "坏备份永远不会成为好备份被删的理由——轮换只在新的一对自证之后跑,且只删它指名的那些"
});

receipt.ok = receipt.steps.every((entry) => entry.ok !== false);
receipt.finishedAt = instant();
receipt.pair = {
  pairId,
  pairedAt: taken.result.instant,
  primary: { host: VM_HOST, path: pairDirectory },
  offsite: { host: OFFSITE_LABEL, hostDigest: OFFSITE_HOST_DIGEST, path: offsiteDirectory },
  pairing: taken.result.pair.pairing,
  fileCount: taken.result.export.fileCount,
  totalBytes: taken.result.export.totalBytes,
  fileSetDigest: taken.result.export.fileSetDigest
};
saveState("paired-backup", receipt);
await writeFile(join(REPO_ROOT, "evidence/aos-paired-backup-new-topology.json"),
  `${JSON.stringify(maskOffsiteHost(scrubHostPaths(receipt)), null, 2)}\n`);
console.log(JSON.stringify({
  ok: receipt.ok,
  pairId,
  pairedAt: taken.result.instant,
  reasonCodes: receipt.steps.map((entry) => entry.reasonCode)
}, null, 2));
if (!receipt.ok) process.exitCode = 1;
