#!/usr/bin/env node
// The paired backup ceremony, re-wired for the topology both halves now live in
// (TCRN-AOS-INC-045) and extended to every governed chain (TCRN-CROSS-STORY-128).
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
// WHY EVERY CHAIN, AND WHY ONLY NOW. INC-045 rewired this flow while `TCRN-AOS`
// was the only partition whose chain had reached the VM. On 2026-08-03 the other
// four followed (TCRN-CROSS-INIT-017), and from that moment the platform's real
// position was: one chain backed up, four backed up by NOTHING, and not one run
// that said so. That is the same shape as the gap S020 found — a missing backup
// produces no failing run, only an absence — which is why the chain half is now
// driven off the PARTITION ROSTER rather than a constant, and why a partition that
// refuses is recorded and the loop continues: one chain fail-closing (a knowledge
// marker behind its head is the normal state after any governed write) must never
// be the reason the other four go unbacked.
//
// WHAT A PER-CHAIN PAIR IS AND IS NOT. The domain half is NOT per-partition,
// because the store is not: one `domain.db` serves every partition and its rows
// carry a `partitionId`. So each pair carries a full snapshot of the shared store
// beside one chain. That buys the property the pairing predicate is about — each
// pair is internally co-instant and self-proving — and it does not buy a partition
// boundary. Restoring one pair restores that chain plus a SUPERSET domain half,
// and any annotation naming a record in one of the other four chains dangles until
// that chain is restored too. Stated in the receipt (`notClaimed`) rather than
// left implied, because the previous incident here was a topology fact that no
// artifact recorded.
//
// Usage:
//   node deploy/aos-resident-cockpit/paired-backup.mjs                # every chain: take, pull, prove, rotate
//   node deploy/aos-resident-cockpit/paired-backup.mjs --if-due       # only the chains whose off-site copy is stale
//   node deploy/aos-resident-cockpit/paired-backup.mjs --verify-offsite
//   node deploy/aos-resident-cockpit/paired-backup.mjs --partition TCRN-TMS   # narrow to one chain (repeatable)
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
import { AOS_PARTITIONS } from "../aos-local-client/aos-partitions.mjs";
import {
  judgeOffsiteCopy, judgePairing, judgeUnpairedDisciplineRetired
} from "./resident-predicates.mjs";
import {
  STATE_DIR, compareLedgers, hasState, instant, loadState, localLedger, remoteLedger, run,
  saveState, sha256File, sha256Text, ssh, sshNode, stepper
} from "./resident-lib.mjs";
import { findHostPaths, scrubHostPaths, scrubHostPathsInText } from "../../scripts/lib/evidence-hygiene.mjs";

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
const MODE = VERIFY_ONLY ? "verify-offsite" : (IF_DUE ? "take-if-due" : "take");

/* ------------------------------------------------------------------ the chains */

/** Every governed chain this flow covers, in roster order. */
const ROSTER = Object.freeze(Object.keys(AOS_PARTITIONS));

/**
 * Which chains THIS run covers: all of them unless `--partition` narrows it.
 *
 * The narrowing exists for the retry, not for the cadence. A single chain
 * fail-closing on its knowledge marker is the ordinary case, and re-taking the
 * other four pairs to retry one of them costs five snapshots to fix one. An
 * unknown id is refused here rather than silently skipped: a typo that quietly
 * backed up nothing would be the exact failure this story exists to end.
 *
 * BOTH spellings are parsed, and the reason is a failure this flow had for one
 * review cycle: matching only the literal `--partition` meant `--partition=X` was
 * not the flag, so the loop skipped it, `targets` stayed empty and the function
 * returned the WHOLE roster. A flag whose only purpose is narrowing silently
 * widened to five chains — five VACUUM INTOs of the live store, five chain-tree
 * copies, five pulls and a red drill nobody asked for. So the test is now "does
 * this token look like the flag", and any token that looks like it and does not
 * resolve to a rostered id is a loud refusal rather than a silent full run.
 */
function selectedTargets(argv) {
  const targets = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--partition")) continue;
    const id = token === "--partition" ? argv[index + 1]
      : token.startsWith("--partition=") ? token.slice("--partition=".length)
        : undefined;
    if (!ROSTER.includes(id)) {
      throw new Error(`${token}${token === "--partition" ? ` ${id ?? "(missing)"}` : ""}`
        + " does not name a governed chain on this roster;"
        + ` known: ${ROSTER.join(" ")}`);
    }
    if (!targets.includes(id)) targets.push(id);
  }
  return targets.length > 0 ? targets : [...ROSTER];
}
const TARGETS = selectedTargets(process.argv);

/**
 * Where a partition's pairs live, on the primary side and off-site.
 *
 * `PARTITION_ID` — the one partition this flow served while it was the only
 * relocated chain — KEEPS the historical flat root; the four chains that arrived
 * on 2026-08-03 each get a namespaced subdirectory. That asymmetry is deliberate
 * and it is about existing bytes, not taste: the pairs already sitting in both
 * flat roots are that partition's pairs, and re-rooting it would strand them
 * outside rotation (kept forever, by nobody's decision) while its first new run
 * looked from the outside like the old backups had been lost. It also keeps the
 * one existing consumer of the flat root — `scripts/backup-due-alert.mjs`, which
 * reads the newest `pair-manifest.json` directly under it — measuring what it
 * measured yesterday instead of reporting permanently overdue on a fresh set.
 *
 * The mixed listing is safe because of a filter both rotations already apply: a
 * directory only counts as a pair if it CONTAINS `pair-manifest.json`, and a
 * partition subdirectory does not. So no rotation can reach another partition's
 * subtree, and no pair can be confused with one — an ISO instant and a partition
 * id are never mistaken for each other.
 */
const vmPairRootFor = (partitionId) =>
  (partitionId === PARTITION_ID ? VM_PAIR_ROOT : `${VM_PAIR_ROOT}/${partitionId}`);
const offsiteRootFor = (partitionId) =>
  (partitionId === PARTITION_ID ? OFFSITE_ROOT : join(OFFSITE_ROOT, partitionId));

/**
 * The config handed to the take program, per chain.
 *
 * The chain half is the partition's own; the domain half, the engine and the
 * runtime are shared, because on this host they are one of each. The forbidden
 * roots are derived from the partition's OWN workspace — the governance container
 * two levels up — so a partition sited somewhere else would carry its own
 * containment rather than inherit another partition's.
 */
function configFor(partitionId) {
  const { workspace, attestDir } = AOS_PARTITIONS[partitionId];
  return {
    workspace,
    attestDir,
    engine: VM_ENGINE,
    runtime: VM_RUNTIME,
    domainDb: VM_DOMAIN_DB,
    pairRoot: vmPairRootFor(partitionId),
    partition: partitionId,
    // Nothing may write a snapshot inside the control tree, the engine, or the
    // deployed runtime. The engine's own guard enforces it when handed these roots.
    forbiddenRoots: [dirname(dirname(workspace)), VM_ENGINE, VM_RUNTIME, VM_ROOT]
  };
}

/**
 * Do the two committed statements of the AOS chain's address still agree?
 *
 * This flow now reads the roster (`aos-local-client/aos-partitions.mjs`) for every
 * chain, while the resident cockpit's manifest states the same address for its own
 * partition and is what the live systemd unit was rendered from. Two files stating
 * one fact is the platform's most-repeated wound, and here it fails in the quiet
 * direction: a roster whose `TCRN-AOS` entry drifted would take a pair of a chain
 * the cockpit is not writing, prove it green, and rotate the real one away.
 *
 * Both sides can genuinely differ — they are separate files edited by separate
 * stories — so this is a predicate, not a formality.
 */
function judgeRosterAgreesWithManifest() {
  const entry = AOS_PARTITIONS[PARTITION_ID] ?? null;
  const reasonCode = ROSTER.length === 0 ? "ROSTER_EMPTY"
    : entry === null ? "COCKPIT_PARTITION_ABSENT_FROM_ROSTER"
      : (entry.workspace !== VM_WORKSPACE || entry.attestDir !== VM_ATTEST_DIR)
        ? "ROSTER_DISAGREES_WITH_COCKPIT_MANIFEST"
        : "ROSTER_AGREES_WITH_THE_COCKPIT_MANIFEST";
  return {
    ok: reasonCode === "ROSTER_AGREES_WITH_THE_COCKPIT_MANIFEST",
    reasonCode,
    chains: ROSTER,
    covering: TARGETS,
    compared: {
      partition: PARTITION_ID,
      roster: entry === null ? null : { workspace: entry.workspace, attestDir: entry.attestDir },
      cockpitManifest: { workspace: VM_WORKSPACE, attestDir: VM_ATTEST_DIR }
    },
    notClaimed: "这道判据只比对本仓两处对同一地址的陈述;分区名册是否覆盖平台全部受治链,由 doc-topology:proof 判"
  };
}

/* ------------------------------------------------------------------ the receipt */

const runReceipt = {
  // v2 extends v1 additively: every field a v1 reader knew still exists, and the
  // per-partition entries under `partitions` carry the v1 receipt shape verbatim
  // (topology / steps / ok / pair). What moved is scope — v1 described ONE chain
  // per run because there was one; v2's top-level `steps` holds the checks that
  // are not per-chain, and the per-chain work is one entry each.
  schemaVersion: "aos.paired-backup-new-topology.v2",
  supersedes: "aos.paired-backup-new-topology.v1 (one chain per run — TCRN-AOS only)",
  incident: "TCRN-AOS-INC-045",
  extendedBy: "TCRN-CROSS-STORY-128 (every governed chain, after the 2026-08-03 full migration)",
  ok: false,
  mode: MODE,
  startedAt: instant(),
  topology: {
    // The shared halves. A partition's own chain address lives in its entry below.
    domainStore: {
      host: VM_HOST,
      path: VM_DOMAIN_DB,
      shared: "one store serves every partition (its rows carry partitionId); each pair carries a full snapshot of it"
    },
    engine: { host: VM_HOST, path: VM_ENGINE },
    primaryPairRoot: { host: VM_HOST, path: VM_PAIR_ROOT },
    offsitePairRoot: { host: OFFSITE_LABEL, hostDigest: OFFSITE_HOST_DIGEST, path: OFFSITE_ROOT },
    chains: ROSTER.map((partitionId) => ({
      partition: partitionId,
      chain: { host: VM_HOST, path: AOS_PARTITIONS[partitionId].workspace },
      attestations: {
        host: VM_HOST,
        path: AOS_PARTITIONS[partitionId].attestDir,
        relation: "sibling of the workspace root, never inside it"
      },
      primaryPairs: { host: VM_HOST, path: vmPairRootFor(partitionId) },
      offsitePairs: { host: OFFSITE_LABEL, hostDigest: OFFSITE_HOST_DIGEST, path: offsiteRootFor(partitionId) }
    }))
  },
  steps: [],
  partitions: [],
  notClaimed: [
    "每一对都含共享域库的完整快照:恢复单独一对得到的是「那条链 + 全量域库」,指向其余四条链记录的注解在那些链也被恢复之前是悬空的",
    // The sharper fact, and the one an operator restoring the platform needs.
    // `snapshotDomain` runs once per leg, so a five-chain run takes FIVE snapshots
    // of ONE live store at five different instants, while the resident cockpit is
    // writing it (`liveStoreBytes.unchangedAcrossThisRun` is reported, never
    // enforced, for exactly that reason). The five domain halves therefore disagree
    // with one another; they are not five copies of one snapshot.
    "五条链的五对里有五份共享域库快照,是在五个不同瞬刻、对一个座舱正在写的活库分别取的——它们彼此不一致。"
      + "全平台恢复必须只选其中一份域库半边(规则见手册「恢复」一节:域库半边取全部配对中最新的那一份,链半边各取各链自己那一对),"
      + "不可把五份域库半边当成同一份",
    "本流程只证明每一半可恢复(链侧 SNAPSHOT_VERIFIED、域库侧重放演练),不执行恢复",
    // Recorded because the alternative is the failure this story was opened to end:
    // an absence that produces no failing run. This is a stopgap note, not a fix —
    // the fix belongs in the alert itself (see the runbook's 到期告警 caveat).
    "到期告警(scripts/backup-due-alert.mjs)只读异地平根下直属的 pair-manifest.json,"
      + `因此它今天只测量 ${PARTITION_ID} 这一条链;其余四条链的配对在 <root>/<partition>/<instant>/ 深一层,`
      + "告警看不见它们,也不会因它们过期而变红。在告警按分区名册逐链判之前,「fresh」只是关于一条链的陈述"
  ]
};

/** Run-level state, kept apart from a take receipt so a verify run cannot clobber it. */
const RUN_STATE = VERIFY_ONLY ? "paired-backup-verify-offsite" : "paired-backup";
const partitionStateName = (partitionId) =>
  `paired-backup-${VERIFY_ONLY ? "verify-" : ""}${partitionId}`;
/**
 * A refusal is kept in its OWN state file, and never cleared by a later success.
 *
 * The reds this flow produces are the interesting part of its record — a
 * fail-closed refusal names a real precondition — and the run that then satisfies
 * the precondition would otherwise erase the only artifact saying it happened.
 * Namespaced per chain since STORY-128: five chains sharing one refusal file would
 * mean the fifth chain's outcome silently overwrote the first chain's refusal,
 * which is the same class of erasure this file exists to prevent.
 *
 * And namespaced per MODE for the same reason, which the per-chain fix alone did
 * not cover: `--verify-offsite` is the CHEAP command an operator runs repeatedly,
 * and its commonest red (`NO_OFFSITE_PAIR`) carries almost no information, while a
 * take refusal (`knowledge_high_water_behind_chain_head`, together with the
 * `knowledge-rebase` command the operator actually needs) is the expensive,
 * information-bearing one. Sharing a path meant the cheap mode routinely erased the
 * expensive mode's record — the exact erasure the paragraph above exists to prevent,
 * arriving through the other axis. `take` and `take-if-due` share a discriminator
 * because they are the same work under two cadences.
 *
 * The rename orphans any `paired-backup-last-refusal[-<partition>].json` left by an
 * earlier run. That is state under tmpdir, not evidence, so it is left where it is.
 */
const modeDiscriminator = VERIFY_ONLY ? "verify" : "take";
const refusalStateName = (partitionId, mode = modeDiscriminator) =>
  `paired-backup-last-refusal-${mode}-${partitionId}`;
const runRefusalStateName = (mode = modeDiscriminator) => `paired-backup-last-refusal-run-${mode}`;

/**
 * Both modes' last refusal for one subject, so neither can hide the other.
 *
 * A receipt that showed only the current mode's refusal would be the erasure
 * problem again, one step further out: the file would survive and the reader would
 * still never see it.
 */
function bothModeRefusals(nameFor) {
  const read = (mode) => (hasState(nameFor(mode)) ? loadState(nameFor(mode)) : null);
  const take = read("take");
  const verifyOffsite = read("verify");
  if (take === null && verifyOffsite === null) return null;
  return { take, verifyOffsite, note: REFUSAL_NOTE };
}

function archiveRefusal(name, mode, partial) {
  const red = partial.steps.find((entry) => entry.ok === false);
  if (!red) return;
  saveState(name, {
    observedAt: partial.startedAt,
    mode,
    partition: partial.partition ?? null,
    step: red.name,
    reasonCode: red.reasonCode,
    lockstep: red.lockstep ?? null,
    remedy: red.remedy ?? null
  });
}

const REFUSAL_NOTE = "上一次 fail-closed 拒绝,连同它当时给出的补救;成功的运行不清除它。"
  + "最常见的一种是知识库高水位落后于链头——每次受治写入之后的常态,补救是一次受治写入,本流程不代做";

const globalStep = stepper("paired", runReceipt, (partial) => {
  saveState(RUN_STATE, partial);
  archiveRefusal(runRefusalStateName(), MODE, partial);
});

const runRefusals = bothModeRefusals(runRefusalStateName);
if (runRefusals !== null) runReceipt.lastRefusalThisFlowProduced = runRefusals;

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
  // either place is a file some later step has to remember to remove. The pair id
  // is part of the name because five chains are drilled in one run and two probes
  // sharing a path would be one drill reading the other's bytes.
  const scratchDir = join(process.env.TMPDIR ?? "/tmp",
    `aos-pair-drill-${process.pid}-${basename(directory)}`);
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
 * The copy lives under `/srv/tcrn/scratch-inc045-red-<pid>-<partition>` and its
 * removal is written in the same function that creates it, verified by asking
 * whether the path still exists.
 */
async function redDrill(pairDirectory, config, partitionId) {
  const scratch = `/srv/tcrn/scratch-inc045-red-${process.pid}-${partitionId}`;
  const drill = { scratch, partition: partitionId, cases: [], reclaimed: false };
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
    const tampered = await runTakeProgram({ ...config, mode: "observe", pairDir: `${scratch}/tampered` });
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
    const split = await runTakeProgram({ ...config, mode: "observe", pairDir: `${scratch}/split-hosts` });
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

/**
 * The tamper drill is a property of the PREDICATE, not of a chain.
 *
 * `judgePairing` is one pure function judging all five pairs, so driving it red
 * once per run establishes exactly what it established when there was one chain —
 * and doing it five times would copy five chain trees twice each on the VM to
 * re-learn the same fact. The verdict is shared: if the predicate could NOT be
 * driven red, no chain's green means anything this run, so every later partition
 * inherits the red rather than quietly passing.
 */
let redDrillThisRun = null;

/* -------------------------------------------------------------------- rotation */

async function rotateOffsite(offsiteRoot, keep) {
  if (!existsSync(offsiteRoot)) return { kept: 0, deleted: [] };
  const names = (await readdir(offsiteRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && existsSync(join(offsiteRoot, entry.name, "pair-manifest.json")))
    .map((entry) => entry.name)
    .sort();
  const surplus = names.slice(0, Math.max(0, names.length - keep));
  for (const name of surplus) await rm(join(offsiteRoot, name), { recursive: true, force: true });
  return { root: basename(offsiteRoot), kept: names.length - surplus.length, deleted: surplus };
}

/** The newest off-site pair that actually carries a manifest. */
async function newestOffsitePair(offsiteRoot) {
  if (!existsSync(offsiteRoot)) return null;
  const names = (await readdir(offsiteRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse();
  for (const name of names) {
    if (existsSync(join(offsiteRoot, name, "pair-manifest.json"))) return join(offsiteRoot, name);
  }
  return null;
}

/* ------------------------------------------------- the per-chain scaffolding */

function newPartitionReceipt(partitionId) {
  const { workspace, attestDir } = AOS_PARTITIONS[partitionId];
  const partitionReceipt = {
    partition: partitionId,
    ok: false,
    took: false,
    startedAt: instant(),
    topology: {
      chain: { host: VM_HOST, path: workspace },
      attestations: { host: VM_HOST, path: attestDir, relation: "sibling of the workspace root, never inside it" },
      domainStore: { host: VM_HOST, path: VM_DOMAIN_DB },
      engine: { host: VM_HOST, path: VM_ENGINE },
      primaryPairs: { host: VM_HOST, path: vmPairRootFor(partitionId) },
      offsitePairs: { host: OFFSITE_LABEL, hostDigest: OFFSITE_HOST_DIGEST, path: offsiteRootFor(partitionId) }
    },
    steps: []
  };
  // Both modes, always — see `bothModeRefusals`. A take refusal must stay visible
  // in a verify run's receipt and the other way round.
  const refusals = bothModeRefusals((mode) => refusalStateName(partitionId, mode));
  if (refusals !== null) partitionReceipt.lastRefusalThisFlowProduced = refusals;
  return partitionReceipt;
}

/**
 * An error message fit for a COMMITTED artifact, or the shape of one instead.
 *
 * Raw error text is exactly where an unscrubbable host path leaks, and `scrubHostPaths`
 * cannot be the whole answer here: two `HOST_PATH_RULES` are `detectOnly` and have no
 * rewrite — `home-directory-dash-encoded` (`-Users-<name>`, the encoding a Claude Code
 * session directory uses, found by STORY-133) and `platform-root-foreign-mount`. The
 * scrubber SKIPS those rules, so they pass through verbatim while `findHostPaths` still
 * flags them. An ENOENT raised anywhere under such a path would therefore have carried
 * the operator's account name into `evidence/` — the leak INC-037 cost 93 rewritten
 * commits to remove — and turned `pnpm test` red on the way.
 *
 * So the check runs on the EXACT bytes that will be stored, after scrubbing and after
 * truncation, and a string that still carries a host path is replaced by its shape: the
 * error's class, which rules fired, and how many times. That is the same choice
 * `deploy/aos-local-client/red-proof.mjs` makes when it reports `<scratch>/…` rather
 * than an address. The verbatim text goes to stderr, which is not committed.
 */
function safeFailureText(error) {
  const stored = scrubHostPathsInText(String(error?.message ?? error)).slice(0, 600);
  const hits = findHostPaths(stored);
  if (hits.length === 0) return { message: stored };
  return {
    message: "<redacted: carried a host path this scrubber cannot rewrite>",
    redactedRules: [...new Set(hits.map((hit) => hit.rule))].sort(),
    redactedHits: hits.length,
    why: "错误原文里带着 scrubber 无法改写的宿主路径形状(detectOnly 规则),故只留形状不留地址;原文在 stderr"
  };
}

/**
 * Run one chain's leg, and let it fail without taking the others down with it.
 *
 * The stepper throws on the first red — which is what keeps a later step from
 * reporting against half-applied state — so the catch is what turns "this run is
 * over" into "this CHAIN is over". Four chains going unbacked because the first
 * one's knowledge marker trails its head would reproduce, at five times the size,
 * exactly the absence this story was opened to end.
 */
async function forPartition(partitionId, body) {
  const partitionReceipt = newPartitionReceipt(partitionId);
  const step = stepper(`paired:${partitionId}`, partitionReceipt, (partial) => {
    saveState(partitionStateName(partitionId), partial);
    archiveRefusal(refusalStateName(partitionId), MODE, partial);
  });
  try {
    await body({
      partitionReceipt,
      step,
      config: configFor(partitionId),
      offsiteRoot: offsiteRootFor(partitionId)
    });
    partitionReceipt.ok = partitionReceipt.steps.every((entry) => entry.ok !== false);
  } catch (error) {
    partitionReceipt.ok = false;
    // Verbatim, once, to stderr — where the operator reads it and nothing commits it.
    process.stderr.write(`[paired:${partitionId}] leg failed: ${String(error?.stack ?? error)}\n`);
    partitionReceipt.failure = {
      failedStep: partitionReceipt.steps.find((entry) => entry.ok === false)?.name ?? null,
      reasonCode: partitionReceipt.steps.find((entry) => entry.ok === false)?.reasonCode ?? null,
      errorName: error?.name ?? "Error",
      ...safeFailureText(error)
    };
  }
  partitionReceipt.finishedAt = instant();
  saveState(partitionStateName(partitionId), partitionReceipt);
  return partitionReceipt;
}

/* ------------------------------------------------------------------- the flow */

/* ---- 0a. the roster and the cockpit manifest must still agree ------------- */
globalStep("partition-roster-agrees-with-the-cockpit-manifest", judgeRosterAgreesWithManifest());

/* ---- 0. this machine must be able to judge what it pulls ------------------ */
// The off-site side re-proves the pair with its own engine and its own build of
// the domain store. Saying so up front fails closed rather than producing a
// module-not-found after the bytes have already travelled.
globalStep("local-judging-surface-present", {
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
globalStep("the-retired-local-take-refuses", {
  ok: retired.exitCode !== 0 && retiredVerdict.reason === "topology_relocated_this_mode_is_retired",
  reasonCode: retiredVerdict.reason ?? "RETIRED_PATH_DID_NOT_REFUSE",
  exitCode: retired.exitCode,
  chainEngineReasonCode: retiredVerdict.topology?.chain?.engineReasonCode ?? null,
  domainArchiveSentinelPresent: retiredVerdict.topology?.domain?.archiveSentinelPresent ?? null,
  remedyItNames: retiredVerdict.remedy ?? null,
  why: "本机两半都还在原地(链已 vacated、库有归档哨兵),所以旧路径若不拒绝,就会产出一对每个文件都完好、两半都已死的「配对」"
});

/* ---- the per-chain legs -------------------------------------------------- */

/**
 * Re-prove one chain's newest off-site pair, with this machine's own engine.
 *
 * Every chain is asked, not just the one that used to be alone here: a mode that
 * verified a single chain while four others sat unverified would answer "the
 * off-site copy is sound" about one fifth of the platform.
 */
async function verifyOffsiteLeg({ partitionReceipt, step, offsiteRoot }) {
  const directory = await newestOffsitePair(offsiteRoot);
  step("offsite-pair-present", {
    ok: directory !== null,
    reasonCode: directory ? "OFFSITE_PAIR_FOUND" : "NO_OFFSITE_PAIR",
    directory: directory ? basename(directory) : null,
    remedy: directory ? null
      : `node deploy/aos-resident-cockpit/paired-backup.mjs --partition ${partitionReceipt.partition}`
  });
  const { pairManifest, observed, localDrill } = await observePairLocally(directory);
  const verdict = judgePairing({ pairManifest, observed });
  step("offsite-pair-reproven", { ...verdict, pairedAt: pairManifest.pairedAt, localDrill });
  partitionReceipt.verified = {
    pairId: basename(directory),
    pairedAt: pairManifest.pairedAt,
    reasonCode: verdict.reasonCode
  };
}

/** Take one chain's pair on the VM, pull it here, prove it twice, then rotate. */
async function takeLeg({ partitionReceipt, step, config, offsiteRoot }) {
  const partitionId = partitionReceipt.partition;

  /* ---- 1. the due gate, measured on the OFF-SITE copy --------------------- */
  // The off-site copy is what a lost VM would be restored from, so its age is the
  // number that matters. `backup-due-alert.mjs` watches the same value. Measured
  // per chain: chains are written at different rates, and one chain's fresh copy
  // says nothing about another's.
  if (IF_DUE) {
    const newest = await newestOffsitePair(offsiteRoot);
    const latest = newest
      ? JSON.parse(await readFile(join(newest, "pair-manifest.json"), "utf8")).pairedAt
      : null;
    const due = evaluateDailySnapshotCatchUp({
      latestSnapshotAt: latest, now: instant(), intervalHours: INTERVAL_HOURS
    });
    partitionReceipt.due = due;
    partitionReceipt.latestPairedAt = latest;
    if (!due.due) {
      // "Not due" is a correct outcome, and a scheduler that read it as failure
      // would alert on every run between backups.
      partitionReceipt.took = false;
      partitionReceipt.skipped = "not_due";
      return;
    }
  }

  /* ---- 2. take the pair where both halves live --------------------------- */
  const taken = await runTakeProgram({ ...config, mode: "take" });
  step("pair-taken-on-the-host-holding-both-halves", {
    ok: taken.result.ok === true,
    reasonCode: taken.result.ok ? "PAIR_TAKEN_ON_ONE_HOST" : (taken.result.reason ?? "PAIR_REFUSED"),
    host: VM_HOST,
    partition: partitionId,
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
  partitionReceipt.took = true;
  const pairDirectory = taken.result.directory;
  const pairId = basename(pairDirectory);

  /* ---- 3. the primary's own judgement, from a second reading of its bytes - */
  const primaryObservation = await runTakeProgram({ ...config, mode: "observe", pairDir: pairDirectory });
  const primaryVerdict = judgePairing(primaryObservation.result);
  step("primary-pair-judged-on-the-vm", {
    ...primaryVerdict,
    readTwice: "the take wrote the digests; this step recomputed them from the bytes on disk and re-ran snapshot-verify",
    chainVerifyReasonCode: primaryObservation.result.observed?.chainVerifyReasonCode ?? null
  });

  /* ---- 4. the off-site copy: this machine pulls it ----------------------- */
  // `rsync` is invoked HERE, so the connection is opened by the side holding the
  // credential. Nothing is placed on the VM and the VM initiates nothing.
  const offsiteDirectory = join(offsiteRoot, pairId);
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

  /* ---- 5. and re-proves it, with its own engine -------------------------- */
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

  /* ---- 6. the red drill, on a disposable copy ---------------------------- */
  if (!RED_DRILL) {
    step("pairing-predicate-driven-red", {
      ok: true,
      reasonCode: "RED_DRILL_SKIPPED_BY_FLAG",
      ran: false,
      why: "--no-red-drill 明示跳过;记成一步而不是省略,因为回执里「没有的那一步」不可见"
    });
  } else if (redDrillThisRun === null) {
    const drill = await redDrill(pairDirectory, config, partitionId);
    redDrillThisRun = drill;
    step("pairing-predicate-driven-red", {
      ...drill,
      ran: true,
      reasonCode: drill.ok ? "PREDICATE_CAN_FAIL" : "PREDICATE_DID_NOT_FAIL_AS_EXPECTED",
      why: "没人见过它红过的判据等于没测过的判据;两类红各一次,收尾以路径是否还存在验证回收"
    });
  } else {
    step("pairing-predicate-driven-red", {
      ok: redDrillThisRun.ok,
      reasonCode: redDrillThisRun.ok ? "PREDICATE_ALREADY_DRIVEN_RED_THIS_RUN" : "PREDICATE_DID_NOT_FAIL_AS_EXPECTED",
      ran: false,
      drivenRedOn: redDrillThisRun.partition,
      cases: redDrillThisRun.cases,
      why: "judgePairing 是一个纯函数判所有五对,故每次运行驱红一次即可;它若驱不红,本次运行没有任何一条链的绿是有意义的"
    });
  }

  /* ---- 6b. the interim discipline INC-045 imposed, and its release -------- */
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
    evaluatedFor: partitionId,
    effect: "此后取的每一对都是真配对,不再需要标注;INC-045 之前取的那些标注保持原样——它们当时是对的"
  });

  /* ---- 7. rotation, last, and only after the new pair proved itself ------ */
  const rotatedPrimary = await runTakeProgram({ ...config, mode: "rotate", keep: RETENTION });
  const rotatedOffsite = await rotateOffsite(offsiteRoot, RETENTION);
  step("rotated-after-verification", {
    ok: true,
    reasonCode: "ROTATED_OLDEST_FIRST",
    primary: rotatedPrimary.result.rotated,
    offsite: rotatedOffsite,
    scope: "只在这条链自己的配对根下轮换;另一条链的子目录不含 pair-manifest.json,故连候选都不是",
    rule: "坏备份永远不会成为好备份被删的理由——轮换只在新的一对自证之后跑,且只删它指名的那些"
  });

  partitionReceipt.pair = {
    pairId,
    pairedAt: taken.result.instant,
    primary: { host: VM_HOST, path: pairDirectory },
    offsite: { host: OFFSITE_LABEL, hostDigest: OFFSITE_HOST_DIGEST, path: offsiteDirectory },
    pairing: taken.result.pair.pairing,
    fileCount: taken.result.export.fileCount,
    totalBytes: taken.result.export.totalBytes,
    fileSetDigest: taken.result.export.fileSetDigest
  };
}

// Imported once, and only when the due gate is actually consulted: the module is
// this repository's compiled build, and step 0 is what proves it is present.
const evaluateDailySnapshotCatchUp = IF_DUE
  ? (await import(join(REPO_ROOT, "dist/packages/db/src/index.js"))).evaluateDailySnapshotCatchUp
  : null;

for (const partitionId of TARGETS) {
  runReceipt.partitions.push(await forPartition(partitionId, VERIFY_ONLY ? verifyOffsiteLeg : takeLeg));
}

/* ------------------------------------------------------------------ the verdict */

// Coverage is recorded rather than assumed. `completeRoster` is the fact that
// matters after STORY-128 — a run that covered four of five chains is the state
// this story ended — and it is reported separately from `ok` so a deliberate
// single-chain retry is not forced to call itself a failure.
runReceipt.coverage = {
  roster: ROSTER,
  covered: runReceipt.partitions.map((entry) => entry.partition),
  completeRoster: TARGETS.length === ROSTER.length,
  everyTargetAttempted: runReceipt.partitions.length === TARGETS.length,
  failed: runReceipt.partitions.filter((entry) => entry.ok !== true).map((entry) => entry.partition),
  skipped: runReceipt.partitions.filter((entry) => entry.skipped).map((entry) => entry.partition)
};
runReceipt.ok = runReceipt.steps.every((entry) => entry.ok !== false)
  && runReceipt.coverage.everyTargetAttempted
  && runReceipt.partitions.every((entry) => entry.ok === true);
runReceipt.finishedAt = instant();
saveState(RUN_STATE, runReceipt);

/* ------------------------------------------------ the committed artifact */

/**
 * Which runs may REPLACE the committed receipt.
 *
 * The receipt keeps its v1 path — the runbook names it, and a second evidence file
 * carrying the same run would be two statements of one fact — but v1 got its
 * protection by accident: it called `process.exit` in the verify branch and in the
 * not-due branch, and it died on the stepper's uncaught throw, so the only run that
 * ever reached the write was a complete, green, fully-proven take. v2 turned those
 * exits into ordinary control flow (that is what lets one chain's refusal leave the
 * other four running), and with them went the accident. Three ordinary runs would
 * then have overwritten a five-chain proof with something that proves less:
 *
 *   - `--if-due` with the chains fresh — the documented scheduler cadence, i.e. MOST
 *     runs — writing five entries of `steps:0, took:false, skipped:not_due` and not
 *     one `chainHeadEventHash`, and dirtying a tracked file every time;
 *   - a run where the takes refused — and a knowledge marker behind its chain head is
 *     the NORMAL state after any governed write, so this is the ordinary case, not the
 *     rare one — replacing five proofs with five reason codes;
 *   - `--partition <one chain>`, the retry the flag exists for, deleting the other
 *     four chains' proofs to record the one it re-took.
 *
 * So the write is now a judgement with its own name. A run replaces the artifact only
 * when it covers the WHOLE roster, skipped nothing, and actually took at least one
 * pair. `not_due` is called out separately from a refusal on purpose: a refusal is
 * information (a reason code and the remedy that clears it) and belongs in the record,
 * while `not_due` is the absence of work and proves nothing about that chain.
 *
 * A run that does not qualify is not silent — silence is how the previous version of
 * this hazard survived review. It says so on stdout, with the reason, and names where
 * its own full receipt did land: `saveState` above always writes it, under `STATE_DIR`,
 * which is not evidence and not tracked.
 */
const notDue = runReceipt.partitions.filter((entry) => entry.skipped === "not_due");
const tookSomething = runReceipt.partitions.some((entry) => entry.took === true);
const evidenceWritten = {
  path: "evidence/aos-paired-backup-new-topology.json",
  written: false,
  reason: VERIFY_ONLY ? "VERIFY_ONLY_RUN_PROVES_NO_NEW_PAIR"
    : !runReceipt.coverage.completeRoster ? "PARTIAL_ROSTER_RUN_MUST_NOT_REPLACE_A_WHOLE_ROSTER_RECEIPT"
      : notDue.length > 0 ? "SOME_CHAINS_WERE_NOT_DUE_SO_THIS_RUN_PROVES_LESS_THAN_THE_LAST"
        : !tookSomething ? "NO_PAIR_WAS_TAKEN_THIS_RUN"
          : "WHOLE_ROSTER_RUN_WITH_REAL_TAKES",
  fullReceiptKeptAt: { stateDir: scrubHostPathsInText(STATE_DIR), name: `${RUN_STATE}.json` },
  notDue: notDue.map((entry) => entry.partition),
  rule: "只有覆盖全名册、无一条被跳过、且确实取到过配对的运行才可替换这份已提交回执;"
    + "证得更少的运行不得覆盖证得更多的那一份"
};

if (evidenceWritten.reason === "WHOLE_ROSTER_RUN_WITH_REAL_TAKES") {
  const body = `${JSON.stringify(maskOffsiteHost(scrubHostPaths(runReceipt)), null, 2)}\n`;
  // The last line of defence, over the bytes about to be committed rather than over
  // any one field: `scrubHostPaths` cannot rewrite the `detectOnly` shapes, so a
  // string nobody thought of can still carry an address here. Refusing to write is
  // the fail-closed choice — a missing receipt is recoverable, a committed home
  // directory is what INC-037 spent 93 rewritten commits undoing. Rule ids and lines
  // go to stdout; the matched text itself goes to stderr and nowhere else.
  const leaks = findHostPaths(body);
  if (leaks.length > 0) {
    evidenceWritten.reason = "REFUSED_RECEIPT_STILL_CARRIED_A_HOST_PATH";
    evidenceWritten.leakedRules = [...new Set(leaks.map((hit) => hit.rule))].sort();
    evidenceWritten.leakedHits = leaks.length;
    process.stderr.write(`[paired] receipt withheld; unscrubbable host paths at lines `
      + `${[...new Set(leaks.map((hit) => hit.line))].join(",")}: `
      + `${leaks.map((hit) => hit.sample).join(" | ")}\n`);
    process.exitCode = 1;
  } else {
    await writeFile(join(REPO_ROOT, evidenceWritten.path), body);
    evidenceWritten.written = true;
  }
}

console.log(JSON.stringify({
  ok: runReceipt.ok,
  mode: MODE,
  evidenceWritten,
  coverage: runReceipt.coverage,
  partitions: runReceipt.partitions.map((entry) => ({
    partition: entry.partition,
    ok: entry.ok,
    took: entry.took,
    skipped: entry.skipped,
    pairId: entry.pair?.pairId ?? entry.verified?.pairId ?? null,
    pairedAt: entry.pair?.pairedAt ?? entry.verified?.pairedAt ?? null,
    due: entry.due,
    failure: entry.failure?.message,
    reasonCodes: entry.steps.map((item) => item.reasonCode)
  }))
}, null, 2));
if (!runReceipt.ok) process.exitCode = 1;
