#!/usr/bin/env node
// Take the domain store and the governed chain as ONE backup, at one instant, each
// naming the other.
//
// Why this exists as a separate path from `domain-backup.mjs`: those two stores are
// only useful together. `domain.db` holds annotations keyed by chain record id, and
// the chain holds the records those keys point at. Restore a domain snapshot beside a
// chain snapshot taken an hour earlier and you get annotations hanging off record ids
// that the restored chain has never heard of — a dangling reference set that reads as
// data corruption rather than as a mismatched pair. The ruling
// (`minutes:3a0d27be789cadb0ccb353c1`) is that the two are paired at one instant with
// a qualified cross-reference, and this is that path.
//
// The cross-reference is the point, not the timestamp. Two files written in the same
// second still do not prove they belong together, so each manifest here carries the
// other's digest: the pair manifest names both, and refuses to report `ok` unless
// both halves verified in the same run. A restore reads the pair manifest first and
// knows, by digest, which chain snapshot this domain snapshot was taken against.
//
// What this does NOT do, stated because a backup script that overstates is worse than
// none: it does not restore anything. It proves each half restores (the domain half by
// replaying its export into a fresh store; the chain half by `snapshot-verify`
// reporting SNAPSHOT_VERIFIED against a byte copy), which is a drill, not a restore.
// The restore procedure stays operator-driven and same-path-only, per the engine's own
// runbook (`tcrn-workflow/docs/architecture/backup-restore-runbook.md`).
//
// Usage:
//   node scripts/paired-backup.mjs                    # take a paired snapshot
//   node scripts/paired-backup.mjs --verify <pairDir>  # re-prove an existing pair
//   node scripts/paired-backup.mjs --push-vm           # push the newest pair to the VM (MIN-007 D9)
//   node scripts/paired-backup.mjs --verify-remote     # compare the VM copy against local records

import { copyFile, cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

const platformRoot = resolve(process.cwd(), "..");
const partition = process.env.AOS_CHAIN_PARTITION ?? "TCRN-AOS";
const partitionRoot = resolve(platformRoot, ".tcrn-workspace", partition);
const workspaceRoot = join(partitionRoot, "workspace");
// The attestation directory is a sibling of the control tree, and required to be: the
// engine refuses an `--attest-dir` that resolves inside the workspace root, precisely so
// these receipts can never be mistaken for attested in-workspace artifacts. Its own
// snapshot therefore never sees them, which is why the ruling folded them into the
// partition backup separately -- left out, a restored chain keeps its events and loses
// every local-clock reading taken alongside them.
//
// What they are, stated at their real strength: `tcrn.time-attestation.v1` is ADVISORY
// and unauthenticated, written best-effort after a successful mutation, deliberately
// outside the workspace trust boundary, and the engine ships no verifier for it. Each
// receipt says "at observedAt, this machine's clock read this while committing the event
// with this hash". It is corroboration of ordering, not proof that a claimed instant was
// witnessed by anyone -- an unauthenticated local clock reading cannot be that. Backing
// them up preserves corroboration; it does not upgrade it.
const attestationRoot = join(partitionRoot, "attestations");
const domainDatabasePath = process.env.AOS_DOMAIN_DB ?? resolve(homedir(), ".tcrn-aos/domain.db");
const destinationRoot = process.env.AOS_PAIRED_BACKUP_DEST
  ?? resolve(homedir(), "OneDrive/Github/tcrn-aos-paired-backups");
const retention = Number.parseInt(process.env.AOS_BACKUP_RETENTION ?? "5", 10);

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
const sha256Text = (text) => sha256(Buffer.from(text, "utf8"));

// The engine's bin is a script inside its own package, and `pnpm exec tcrn-workflow`
// does not resolve it from that package's own root -- it exits 1 with
// `Command "tcrn-workflow" not found`, which reads exactly like a broken invocation
// rather than a missing self-link. Call the script by path.
const engineRoot = resolve(platformRoot, "tcrn-workflow");
const engineCli = join(engineRoot, "scripts/tcrn-workflow.mjs");

/** Run a governed engine command. Read-only verbs only -- this script never writes the chain. */
async function engine(...args) {
  const { stdout } = await run(process.execPath, [engineCli, ...args], {
    cwd: engineRoot,
    maxBuffer: 64 * 1024 * 1024
  });
  return stdout;
}

async function loadDomainStore(path) {
  const { DomainStore, loadDomainMigrationSql } = await import(
    resolve(process.cwd(), "dist/packages/projection/src/index.js"));
  // The whole domain migrations directory, so a schema addition (0002 chain
  // write log) is covered here the day it lands.
  const migration = loadDomainMigrationSql(resolve(process.cwd(), "packages/db/migrations/domain"));
  return new DomainStore(path, migration);
}

/**
 * The domain half. The physical copy goes through the engine-owned snapshot path
 * (`VACUUM INTO` + `PRAGMA integrity_check`) rather than a file copy, because copying
 * a live SQLite file can capture a torn page set that only fails at read time -- long
 * after the run that produced it reported success.
 */
async function snapshotDomain(directory, instant) {
  const { createSqlitePhysicalSnapshot, sqliteIntegrityCheck } = await import(
    resolve(process.cwd(), "dist/packages/db/src/index.js"));

  const store = await loadDomainStore(domainDatabasePath);
  let exported;
  try {
    exported = store.exportAll();
  } finally {
    store.close();
  }
  const exportBody = `${JSON.stringify(exported, null, 2)}\n`;
  await writeFile(join(directory, "domain-export.json"), exportBody);

  const snapshotPath = join(directory, "domain.db");
  const physical = createSqlitePhysicalSnapshot({
    sourceDatabasePath: domainDatabasePath,
    snapshotPath,
    snapshotId: `domain-${instant}`,
    createdAt: instant,
    purpose: "paired-domain-and-chain-backup",
    sourceProfileDigest: sha256Text(domainDatabasePath),
    routeId: "route_tcrn_aos_story_020_paired_backup",
    profileId: "profile_tcrn_aos_domain",
    // Never let a snapshot land inside a git worktree: committed backup bytes are a
    // privacy leak that no later deletion undoes.
    forbiddenWorktreeRoots: [resolve(process.cwd()), platformRoot]
  });

  return {
    ok: physical.ok,
    createdWith: physical.createdWith,
    integrityCheck: physical.manifest.integrityCheck,
    snapshotDigest: physical.snapshotDigest,
    manifestDigest: physical.manifestDigest,
    tableRowCounts: physical.manifest.tableRowCounts,
    exportDigest: sha256Text(exportBody),
    counts: {
      annotations: exported.annotations.length,
      comments: exported.comments.length,
      relations: exported.relations.length,
      chainWriteLog: exported.chainWriteLog.length
    },
    liveIntegrityCheck: sqliteIntegrityCheck(domainDatabasePath)
  };
}

/**
 * The chain half. `snapshot-manifest` is taken first, then the tree is copied, then
 * `snapshot-verify` proves the copy byte-identical -- the order the engine's runbook
 * requires, because the manifest excludes the held lease subtree and only matches a
 * copy taken after the lease is released.
 */
async function snapshotChain(directory, instant) {
  const manifestBody = await engine("snapshot-manifest", "--workspace", workspaceRoot, "--at", instant);
  const manifestPath = join(directory, "chain-snapshot-manifest.json");
  await writeFile(manifestPath, manifestBody);

  await cp(join(workspaceRoot, ".tcrn-workflow"), join(directory, "chain", ".tcrn-workflow"), {
    recursive: true, verbatimSymlinks: true
  });

  let verified = null;
  let verifyError = null;
  try {
    verified = JSON.parse(await engine(
      "snapshot-verify", "--root", join(directory, "chain"), "--manifest", manifestPath));
  } catch (error) {
    verifyError = String(error.stderr ?? error.message ?? error).trim().slice(0, 400);
  }

  // The attestation sibling: copied as bytes and digested as a set, so a restore can
  // tell a complete witness set from a partial one.
  //
  // Each receipt is also checked for the one property that can be checked locally --
  // that its `eventHash` names an event actually present in the chain being snapshotted.
  // A receipt whose hash matches nothing is not evidence about this chain; it is a file
  // that survives a restore looking like evidence. The engine has no verifier for these,
  // so if this correspondence is not checked here it is checked nowhere.
  const eventHashes = new Set();
  for (const name of (await readdir(join(workspaceRoot, ".tcrn-workflow/events"))).sort()) {
    const segment = JSON.parse(await readFile(
      join(workspaceRoot, ".tcrn-workflow/events", name), "utf8"));
    for (const event of (Array.isArray(segment) ? segment : segment.events ?? [])) {
      if (typeof event?.eventHash === "string") eventHashes.add(event.eventHash);
    }
  }

  const attestations = [];
  let orphanReceipts = 0;
  let filenameMismatches = 0;
  if (existsSync(attestationRoot)) {
    await mkdir(join(directory, "attestations"), { recursive: true });
    for (const name of (await readdir(attestationRoot)).sort()) {
      const body = await readFile(join(attestationRoot, name));
      await copyFile(join(attestationRoot, name), join(directory, "attestations", name));
      let receipt = null;
      try {
        receipt = JSON.parse(body.toString("utf8"));
      } catch {
        receipt = null;
      }
      if (receipt?.eventHash !== `${name}`.replace(/\.json$/u, "")) filenameMismatches += 1;
      if (!eventHashes.has(receipt?.eventHash)) orphanReceipts += 1;
      attestations.push({ name, sha256: sha256(body) });
    }
  }

  const manifest = JSON.parse(manifestBody);
  const reasonCode = verified?.reasonCode ?? verified?.result?.reasonCode ?? null;
  return {
    ok: reasonCode === "SNAPSHOT_VERIFIED",
    reasonCode,
    verifyError,
    workspaceRoot,
    headEventHash: manifest.headEventHash ?? manifest.result?.headEventHash ?? null,
    version: manifest.version ?? manifest.result?.version ?? null,
    workspaceId: manifest.workspaceId ?? manifest.result?.workspaceId ?? null,
    chainManifestDigest: sha256Text(manifestBody),
    attestations: {
      // Not-read and empty are different facts, so the receipt distinguishes them
      // rather than reporting an absent directory as a set of zero witnesses.
      directoryPresent: existsSync(attestationRoot),
      count: attestations.length,
      chainEventsSeen: eventHashes.size,
      // Reported, not enforced: an orphan receipt does not corrupt the chain, and the
      // engine writes these outside its own trust boundary on purpose. Failing the whole
      // backup over one would trade a real backup for a cosmetic invariant.
      orphanReceipts,
      filenameMismatches,
      strength: "advisory local-clock corroboration; unauthenticated, no engine verifier",
      setDigest: sha256Text(attestations.map((item) => `${item.name} ${item.sha256}`).join("\n"))
    }
  };
}

/** Replay the domain export into a fresh store and compare. A backup nobody restored is a hypothesis. */
async function drillDomainRestore(directory) {
  const exported = JSON.parse(await readFile(join(directory, "domain", "domain-export.json"), "utf8"));
  const scratch = join(directory, ".restore-probe.db");
  await rm(scratch, { force: true });
  const store = await loadDomainStore(scratch);
  let restored;
  try {
    // setAnnotation takes an input shape, not the exported row: passing the row back
    // whole would carry fields the writer does not accept. Name the eight it does.
    for (const annotation of exported.annotations) {
      store.setAnnotation({
        partitionId: annotation.partitionId,
        recordId: annotation.recordId,
        externalKey: annotation.externalKey,
        assignee: annotation.assignee,
        priority: annotation.priority,
        labels: annotation.labels,
        updatedAt: annotation.updatedAt,
        updatedBy: annotation.updatedBy
      });
    }
    for (const comment of exported.comments) store.addComment(comment);
    for (const relation of exported.relations) store.addRelation(relation);
    // Restore keeps the original seq (the log is ordered by it); pre-v2
    // exports have no chainWriteLog field and restore an empty log, honestly.
    for (const entry of exported.chainWriteLog ?? []) store.restoreChainWrite(entry);
    restored = store.exportAll();
  } finally {
    store.close();
    for (const suffix of ["", "-wal", "-shm"]) await rm(`${scratch}${suffix}`, { force: true });
  }
  const families = ["annotations", "comments", "relations", "chainWriteLog"];
  const sameShape = families
    .every((key) => restored[key].length === (exported[key] ?? []).length);
  return {
    ok: sameShape,
    replayedInto: "fresh scratch store, deleted after the drill",
    counts: Object.fromEntries(families
      .map((key) => [key, { exported: (exported[key] ?? []).length, restored: restored[key].length }]))
  };
}

/**
 * The lockstep precondition, checked and named before anything is copied.
 *
 * `snapshot-manifest` refuses with `KNOWLEDGE_HIGH_WATER_MISMATCH` whenever the
 * knowledge store's marker digest trails the chain head -- which is the normal state
 * after any governed write, because writes advance the head and the knowledge marker
 * only moves on `knowledge-rebase`. The engine is right to fail closed: the runbook's
 * lockstep doctrine says the two are restored together or not at all, so a manifest
 * that spanned a mismatched pair would be describing a snapshot nobody can restore.
 *
 * It is checked here, separately, because of how it fails otherwise: `validate` and
 * `status` both report `ok` at the same moment `snapshot-manifest` exits non-zero, and
 * the CLI prints the reason code with no remedy. An operator reading that sees a
 * healthy chain and a broken backup tool. The remedy -- `knowledge-rebase` -- is a
 * governed write, so this script names it rather than performing it.
 */
async function checkLockstep() {
  const marker = JSON.parse(await readFile(
    join(workspaceRoot, ".tcrn-workflow/knowledge/store.json"), "utf8"));
  const status = JSON.parse(await engine("status", "--workspace", workspaceRoot));
  const head = status.headEventHash ?? status.result?.headEventHash ?? null;
  return {
    ok: marker.eventHighWaterDigest === head,
    chainHeadEventHash: head,
    knowledgeHighWaterDigest: marker.eventHighWaterDigest,
    knowledgeVersion: marker.version,
    remedy: marker.eventHighWaterDigest === head
      ? null
      : "knowledge-rebase --workspace <root> --expected-version <marker.version> --at <instant>"
        + " (a governed write; this script will not perform it)"
  };
}

async function takePair() {
  if (!existsSync(domainDatabasePath)) {
    return { ok: false, reason: "no_domain_database", domainDatabasePath };
  }
  if (!existsSync(join(workspaceRoot, ".tcrn-workflow"))) {
    return { ok: false, reason: "no_chain_control_tree", workspaceRoot };
  }
  const lockstep = await checkLockstep();
  if (!lockstep.ok) {
    return { ok: false, reason: "knowledge_high_water_behind_chain_head", lockstep };
  }

  // ONE instant for both halves. This is the pairing: the same value is the domain
  // snapshot's createdAt and the chain manifest's --at, so neither half can later be
  // read as belonging to a different moment than the other.
  const instant = new Date().toISOString().replace(/\.\d{3}Z$/u, "Z");
  const stamp = instant.replace(/[:]/gu, "-");
  const directory = join(destinationRoot, stamp);
  await mkdir(join(directory, "domain"), { recursive: true });

  const domain = await snapshotDomain(join(directory, "domain"), instant);
  const chain = await snapshotChain(directory, instant);
  const drill = await drillDomainRestore(directory);

  const pairManifest = {
    schemaVersion: "aos.paired-backup.v1",
    pairedAt: instant,
    partition,
    ok: domain.ok && chain.ok && drill.ok,
    lockstep,
    // The qualified cross-reference the ruling asked for: each half names the other by
    // digest, so a restore can prove the pair rather than trust the directory name.
    pairing: {
      domainSnapshotDigest: domain.snapshotDigest,
      domainExportDigest: domain.exportDigest,
      chainManifestDigest: chain.chainManifestDigest,
      chainHeadEventHash: chain.headEventHash,
      chainVersion: chain.version,
      attestationSetDigest: chain.attestations.setDigest,
      boundBy: "one instant plus mutual digests; either half alone is not a restorable pair"
    },
    domain,
    chain,
    restoreDrill: drill,
    notClaimed: [
      "this run proves each half restores in a drill; it does not perform a restore",
      "the projection database is deliberately absent -- it is rebuilt from the chains, never restored",
      "the O3 event mirror is deliberately absent (MIN-007: 明确不备) -- a derived instrument, never a second restorable copy of chain history",
      "a chain restore is same-path-only and operator-driven; see tcrn-workflow/docs/architecture/backup-restore-runbook.md",
      "no VM copy is made here; the VM never holds this machine's credentials and pulls instead"
    ]
  };
  await writeFile(join(directory, "pair-manifest.json"), `${JSON.stringify(pairManifest, null, 2)}\n`);
  // Written last, so it covers the pair manifest too and a truncated run leaves no
  // export manifest claiming a complete set.
  const exported = await writeExportManifest(directory, pairManifest);
  return { ok: pairManifest.ok, directory, pairManifest, export: exported };
}

/** Re-prove an existing pair: both halves, by digest, plus the domain restore drill. */
async function verifyPair(directory) {
  const manifest = JSON.parse(await readFile(join(directory, "pair-manifest.json"), "utf8"));
  const domainBytes = await readFile(join(directory, "domain", "domain.db"));
  const exportBody = await readFile(join(directory, "domain", "domain-export.json"), "utf8");
  const chainManifestBody = await readFile(join(directory, "chain-snapshot-manifest.json"), "utf8");

  let chainVerified = null;
  try {
    chainVerified = JSON.parse(await engine("snapshot-verify",
      "--root", join(directory, "chain"), "--manifest", join(directory, "chain-snapshot-manifest.json")));
  } catch (error) {
    chainVerified = { reasonCode: null, error: String(error.stderr ?? error.message).trim().slice(0, 400) };
  }

  const digestsMatch = sha256(domainBytes) === manifest.pairing.domainSnapshotDigest
    && sha256Text(exportBody) === manifest.pairing.domainExportDigest
    && sha256Text(chainManifestBody) === manifest.pairing.chainManifestDigest;
  const chainOk = (chainVerified?.reasonCode ?? chainVerified?.result?.reasonCode) === "SNAPSHOT_VERIFIED";
  const drill = await drillDomainRestore(directory);

  return {
    ok: digestsMatch && chainOk && drill.ok,
    directory,
    digestsMatch,
    chainReasonCode: chainVerified?.reasonCode ?? chainVerified?.result?.reasonCode ?? null,
    chainVerifyError: chainVerified?.error ?? null,
    restoreDrill: drill,
    pairedAt: manifest.pairedAt
  };
}

/**
 * The at-rest export surface for the VM (S020 item ⑤), and only the surface.
 *
 * The constraint that shapes this: the VM must PULL. This machine holds the signing key
 * and the credentials; the VM holds `authorized_keys` and nothing else, so today it
 * cannot initiate a connection back here — and that asymmetry is the security property,
 * not an accident to be engineered around. A push from here would need no new secret on
 * the VM, but it would mean this machine reaching into the VM on a schedule; a pull needs
 * the VM to hold something that can read from here. Which of those is acceptable is an
 * Owner call about credential placement, so this function stops at making a pull
 * possible and does not open a path.
 *
 * What it writes is a manifest the puller can act on WITHOUT trusting the transport:
 * every file with its digest, so a pulled copy is verifiable against bytes rather than
 * against the channel that carried it. `paired-backup.mjs --verify <dir>` then re-proves
 * the pair on the far side using only the pulled bytes.
 */
async function writeExportManifest(directory, pairManifest) {
  const files = [];
  const walk = async (relativePath) => {
    const absolute = join(directory, relativePath);
    for (const entry of (await readdir(absolute, { withFileTypes: true }))
      .sort((left, right) => (left.name < right.name ? -1 : 1))) {
      const next = relativePath ? join(relativePath, entry.name) : entry.name;
      if (entry.isDirectory()) {
        await walk(next);
      } else if (entry.isFile()) {
        const body = await readFile(join(directory, next));
        files.push({ path: next, bytes: body.length, sha256: sha256(body) });
      }
    }
  };
  await walk("");

  const manifest = {
    schemaVersion: "aos.paired-backup-export.v1",
    pairedAt: pairManifest.pairedAt,
    partition: pairManifest.partition,
    pairOk: pairManifest.ok,
    // Named so a puller can confirm it fetched the pair it intended, before unpacking.
    pairing: pairManifest.pairing,
    totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
    fileCount: files.length,
    files,
    fileSetDigest: sha256Text(files.map((file) => `${file.path} ${file.sha256}`).join("\n")),
    pullContract: [
      "fetch every path in `files` and compare sha256 before trusting any of it",
      "that check needs nothing but python3/sha256 -- no engine, no repository checkout",
      "the puller needs no credential for the source machine beyond read access to these bytes",
      "this manifest does not itself authenticate the source: it detects corruption and truncation, not substitution"
    ],
    // The honest ceiling of a far-side check, measured against the actual VM on
    // 2026-07-27: it has node v24 but no engine and no repository checkout, so it can
    // prove these bytes arrived intact and CANNOT re-run `snapshot-verify` or the domain
    // restore drill. Byte-integrity there, restorability only where the engine lives.
    farSideVerification: {
      availableWithoutEngine: "sha256 comparison of every file against this manifest",
      requiresEngineCheckout: [
        "snapshot-verify (SNAPSHOT_VERIFIED on the chain half)",
        "the domain restore drill (replay of domain-export.json into a fresh store)"
      ],
      soFullVerifyRunsWhere: "on a host with the tcrn-workflow engine and this repository"
    },
    notClaimed: [
      "no transport is configured here; this run does not send anything anywhere",
      "the VM holds no credential for this machine today, and this file does not change that",
      "a byte-verified pull is not a proven restore: it proves arrival, not restorability"
    ]
  };
  await writeFile(join(directory, "export-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return { fileCount: manifest.fileCount, totalBytes: manifest.totalBytes, fileSetDigest: manifest.fileSetDigest };
}

// ————————————————————————————————————————————————————————————————————————————
// The switch-leg off-site copy (MIN-007 D9). The ruling settled the credential
// question the `notClaimed` above deliberately left open: for the mirror-segment
// interim, the direction is PUSH from this machine over the SSH channel that
// already exists — the VM still holds no credential for this machine, and this
// leg adds no new secret anywhere. The pull direction stays not wired.
// ————————————————————————————————————————————————————————————————————————————

const vmHost = process.env.AOS_VM_HOST ?? "tcrn-platform-dev";
const vmBackupRoot = process.env.AOS_VM_BACKUP_ROOT ?? "/srv/tcrn/backups";

/** Receipts may travel as evidence; local absolute paths do not. */
const maskHome = (text) => String(text).split(homedir()).join("~");

/** Newest directory under the destination that actually carries a pair manifest. */
async function newestPairDirectory() {
  if (!existsSync(destinationRoot)) return null;
  const names = (await readdir(destinationRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse();
  for (const name of names) {
    if (existsSync(join(destinationRoot, name, "pair-manifest.json"))) {
      return join(destinationRoot, name);
    }
  }
  return null;
}

// The far-side check, verbatim to the pullContract already recorded in every
// export-manifest.json: "fetch every path in `files` and compare sha256 …
// needs nothing but python3/sha256 — no engine, no repository checkout". This
// executes that predicate where the bytes landed. It checks the copy against
// the manifest THAT TRAVELLED WITH IT, so it detects corruption and truncation
// in transit; substitution relative to the local record is `--verify-remote`'s
// job, which keeps its baseline on this machine.
const REMOTE_CHECK_PY = `
import hashlib, json, os, sys
root = sys.argv[1]
manifest = json.load(open(os.path.join(root, "export-manifest.json")))
mismatches, missing, lines, checked = [], [], [], 0
for f in manifest["files"]:
    p = os.path.join(root, f["path"])
    if not os.path.isfile(p):
        missing.append(f["path"])
        continue
    with open(p, "rb") as handle:
        digest = hashlib.sha256(handle.read()).hexdigest()
    checked += 1
    if digest != f["sha256"]:
        mismatches.append({"path": f["path"], "expected": f["sha256"], "actual": digest})
    lines.append(f["path"] + " " + digest)
fsd = hashlib.sha256("\\n".join(lines).encode()).hexdigest()
print(json.dumps({
    "ok": not mismatches and not missing and fsd == manifest["fileSetDigest"],
    "checkedFiles": checked,
    "expectedFiles": manifest["fileCount"],
    "missing": missing,
    "mismatches": mismatches,
    "fileSetDigestMatch": fsd == manifest["fileSetDigest"]
}))
`.trim();

async function remoteShaCheck(remoteDirectory) {
  const script = Buffer.from(REMOTE_CHECK_PY, "utf8").toString("base64");
  try {
    const { stdout } = await run("ssh",
      [vmHost, `echo ${script} | base64 -d | python3 - '${remoteDirectory}'`],
      { maxBuffer: 32 * 1024 * 1024 });
    return JSON.parse(stdout);
  } catch (error) {
    return {
      ok: false,
      error: maskHome(error.stderr ?? error.message ?? error).trim().slice(0, 400)
    };
  }
}

/**
 * Push ONE pair to the VM — and only a pair that just proved itself. The order is
 * the point: self-verify first (a pair that cannot re-prove locally is not worth
 * copying anywhere), then rsync, then the engineless far-side sha256 check.
 *
 * A failure is never masked: any red step makes the receipt red and the exit code
 * non-zero, and none of it touches the local pair — the local copy is exactly as
 * restorable after a failed push as before it.
 *
 * The receipt is a SIDECAR (`vm-push-receipt.json` beside the pair), deliberately
 * not merged into `pair-manifest.json`: the export manifest sealed that file's
 * bytes by digest when the pair was taken, so folding a later receipt into it
 * would silently invalidate the very record the far side verifies against. The
 * sidecar is likewise excluded from the transfer, so the VM holds exactly the
 * manifest-sealed set.
 */
async function pushPairToVm(directory) {
  const pairId = basename(directory);
  const receipt = {
    schemaVersion: "aos.paired-backup-push.v1",
    ruling: "MIN-007 D9 (mirror-segment interim: push over existing SSH)",
    pairId,
    vmHost,
    vmPath: `${vmBackupRoot}/${pairId}`,
    pushedAt: new Date().toISOString().replace(/\.\d{3}Z$/u, "Z"),
    ok: false,
    localSelfVerify: null,
    transfer: null,
    remoteCheck: null,
    notClaimed: [
      "the far-side check proves arrival intact against the manifest that travelled with the bytes; it does not authenticate the source and is not a restore",
      "the VM has no engine and no repository checkout: byte-integrity is provable there, restorability only where the engine lives",
      "a failed push leaves the local pair untouched and exactly as restorable as before"
    ]
  };

  if (!/^[0-9A-Za-z][0-9A-Za-z.:TZ_-]*$/u.test(pairId)) {
    receipt.reason = "unsafe_pair_id";
    return receipt;
  }

  const verify = await verifyPair(directory);
  receipt.localSelfVerify = {
    ok: verify.ok,
    digestsMatch: verify.digestsMatch,
    chainReasonCode: verify.chainReasonCode,
    restoreDrillOk: verify.restoreDrill?.ok ?? false,
    pairedAt: verify.pairedAt
  };
  if (!verify.ok) {
    receipt.reason = "local_self_verify_failed_nothing_was_pushed";
    return receipt;
  }

  try {
    await run("ssh", [vmHost, `mkdir -p '${vmBackupRoot}/${pairId}'`]);
    await run("rsync",
      ["-a", "--delete", "--exclude=vm-push-receipt.json", `${directory}/`,
        `${vmHost}:${vmBackupRoot}/${pairId}/`],
      { maxBuffer: 8 * 1024 * 1024 });
    receipt.transfer = { ok: true, tool: "rsync -a --delete over existing ssh; push receipt sidecar excluded" };
  } catch (error) {
    receipt.transfer = {
      ok: false,
      error: maskHome(error.stderr ?? error.message ?? error).trim().slice(0, 400)
    };
    receipt.reason = "transfer_failed";
    return receipt;
  }

  receipt.remoteCheck = await remoteShaCheck(`${vmBackupRoot}/${pairId}`);
  receipt.ok = receipt.remoteCheck.ok === true;
  if (!receipt.ok) receipt.reason = "remote_check_failed";
  return receipt;
}

/**
 * The local-side re-verification of the VM copy (MIN-007 D9 「本机验签」).
 *
 * The baseline is THIS machine's records, never the VM's: the remote export
 * manifest must byte-match the local one, and every sampled file's digest as
 * computed ON the VM must match what the LOCAL manifest recorded. A substituted
 * file on the VM — even one substituted together with a self-consistent forged
 * manifest — therefore reads red here, because the forged set cannot match a
 * record it never saw.
 *
 * The already-recorded limit stands unchanged: the manifest does not
 * authenticate its source. An actor who can both rewrite the VM copy and answer
 * this ssh session can still forge agreement; this check detects substitution
 * of the VM bytes relative to the local record, nothing stronger.
 */
async function verifyRemote(directory) {
  const pairId = basename(directory);
  const remoteDirectory = `${vmBackupRoot}/${pairId}`;
  const localManifestBytes = await readFile(join(directory, "export-manifest.json"));
  const localManifest = JSON.parse(localManifestBytes.toString("utf8"));
  const receipt = {
    schemaVersion: "aos.paired-backup-remote-verify.v1",
    ruling: "MIN-007 D9 (local-side verification of the off-site copy)",
    pairId,
    vmHost,
    vmPath: remoteDirectory,
    verifiedAt: new Date().toISOString().replace(/\.\d{3}Z$/u, "Z"),
    ok: false,
    manifestMatch: null,
    sampled: [],
    limits: [
      "the export manifest does not authenticate its source (already recorded in pullContract): an actor able to rewrite the VM copy AND answer this ssh session can forge agreement",
      "this check detects substitution of the VM bytes relative to the LOCAL record; it proves nothing about restorability on the VM"
    ]
  };
  if (!/^[0-9A-Za-z][0-9A-Za-z.:TZ_-]*$/u.test(pairId)) {
    receipt.reason = "unsafe_pair_id";
    return receipt;
  }

  let remoteManifestBytes;
  try {
    const { stdout } = await run("ssh", [vmHost, `cat '${remoteDirectory}/export-manifest.json'`],
      { maxBuffer: 32 * 1024 * 1024 });
    remoteManifestBytes = Buffer.from(stdout, "utf8");
  } catch (error) {
    receipt.reason = "remote_manifest_unreadable";
    receipt.error = maskHome(error.stderr ?? error.message ?? error).trim().slice(0, 400);
    return receipt;
  }
  receipt.manifestMatch = sha256(remoteManifestBytes) === sha256(localManifestBytes);

  // The sample: the four load-bearing files always, plus up to eight drawn at
  // random each run — so a tamperer cannot know in advance which of the ~360
  // event/attestation files this run will look at. The draw is recorded.
  const digestByPath = new Map(localManifest.files.map((file) => [file.path, file.sha256]));
  const critical = ["pair-manifest.json", "chain-snapshot-manifest.json",
    "domain/domain.db", "domain/domain-export.json"].filter((path) => digestByPath.has(path));
  const rest = localManifest.files.map((file) => file.path)
    .filter((path) => !critical.includes(path));
  const randomPick = [];
  while (randomPick.length < Math.min(8, rest.length)) {
    const candidate = rest[Math.floor(Math.random() * rest.length)];
    if (!randomPick.includes(candidate)) randomPick.push(candidate);
  }
  const sample = [...critical, ...randomPick];

  const remoteSums = new Map();
  let sumError = null;
  try {
    const quoted = sample.map((path) => `'${remoteDirectory}/${path}'`).join(" ");
    const { stdout } = await run("ssh", [vmHost, `sha256sum ${quoted}`],
      { maxBuffer: 8 * 1024 * 1024 });
    for (const line of stdout.trim().split("\n")) {
      const match = line.match(/^([0-9a-f]{64})\s+(.+)$/u);
      if (match) remoteSums.set(match[2].slice(remoteDirectory.length + 1), match[1]);
    }
  } catch (error) {
    // sha256sum exits non-zero when any sampled file is missing, but still
    // prints digests for the ones it read; a missing file must read as a red
    // sample row, not as an aborted check.
    for (const line of String(error.stdout ?? "").trim().split("\n")) {
      const match = line.match(/^([0-9a-f]{64})\s+(.+)$/u);
      if (match) remoteSums.set(match[2].slice(remoteDirectory.length + 1), match[1]);
    }
    sumError = maskHome(error.stderr ?? error.message ?? error).trim().slice(0, 200);
  }

  receipt.sampled = sample.map((path) => ({
    path,
    localSha256: digestByPath.get(path),
    remoteSha256: remoteSums.get(path) ?? null,
    match: remoteSums.get(path) === digestByPath.get(path)
  }));
  if (sumError) receipt.remoteDigestError = sumError;
  receipt.ok = receipt.manifestMatch === true && receipt.sampled.every((entry) => entry.match);
  if (!receipt.ok) receipt.reason = "substitution_or_divergence_detected";
  return receipt;
}

/** Oldest-first, only after the new pair verified, and it names what it deleted. */
async function rotate(keep) {
  const entries = (await readdir(destinationRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const surplus = entries.slice(0, Math.max(0, entries.length - keep));
  for (const name of surplus) await rm(join(destinationRoot, name), { recursive: true, force: true });
  return { kept: entries.length - surplus.length, deleted: surplus };
}

/**
 * The daily fallback. `--if-due` is the mode a scheduler calls: it takes a pair only if
 * the newest existing pair is older than the interval, and it treats "no pair at all"
 * as due.
 *
 * Why catch-up rather than a fixed clock trigger: this is a laptop, so the machine is
 * routinely asleep at whatever hour a timer would name. A trigger that only fires at
 * 03:00 silently produces no backup on every day the lid was shut, and the gap is
 * invisible -- there is no failed run to notice, just a missing one. Asking "is one
 * due?" on each opportunity converts a missed window into a late backup instead of an
 * absent one. The evaluator is the engine's own (`evaluateDailySnapshotCatchUp`).
 */
async function takePairIfDue(intervalHours) {
  const { evaluateDailySnapshotCatchUp } = await import(
    resolve(process.cwd(), "dist/packages/db/src/index.js"));
  const now = new Date().toISOString().replace(/\.\d{3}Z$/u, "Z");

  let latest = null;
  if (existsSync(destinationRoot)) {
    const pairs = (await readdir(destinationRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    // Read the newest pair's own recorded instant rather than its directory name or
    // mtime: OneDrive rewrites mtime when it syncs, so mtime dates the sync, not the
    // backup. The manifest carries the instant the pair was actually taken.
    for (const name of pairs.reverse()) {
      try {
        latest = JSON.parse(await readFile(
          join(destinationRoot, name, "pair-manifest.json"), "utf8")).pairedAt;
        break;
      } catch {
        // A directory without a readable manifest is not a pair; keep looking back.
      }
    }
  }

  const due = evaluateDailySnapshotCatchUp({ latestSnapshotAt: latest, now, intervalHours });
  if (!due.due) {
    return { skipped: true, due, latestPairedAt: latest };
  }
  return { skipped: false, due, latestPairedAt: latest };
}

const verifyFlag = process.argv.indexOf("--verify");
if (process.argv.includes("--push-vm")) {
  const directory = await newestPairDirectory();
  if (!directory) {
    console.error(JSON.stringify({ ok: false, error: "no pair with a readable pair-manifest.json to push" }));
    process.exit(1);
  }
  const receipt = await pushPairToVm(directory);
  // Written red or green: a failed push is a fact worth keeping, not one to hide.
  await writeFile(join(directory, "vm-push-receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(JSON.stringify(receipt, null, 2));
  if (!receipt.ok) process.exitCode = 1;
} else if (process.argv.includes("--verify-remote")) {
  const directory = await newestPairDirectory();
  if (!directory) {
    console.error(JSON.stringify({ ok: false, error: "no local pair to verify the remote copy against" }));
    process.exit(1);
  }
  const receipt = await verifyRemote(directory);
  console.log(JSON.stringify(receipt, null, 2));
  if (!receipt.ok) process.exitCode = 1;
} else if (verifyFlag >= 0) {
  const target = process.argv[verifyFlag + 1];
  if (!target) {
    console.error(JSON.stringify({ ok: false, error: "--verify needs a pair directory" }));
    process.exit(1);
  }
  const result = await verifyPair(resolve(target));
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
} else {
  const ifDue = process.argv.includes("--if-due");
  if (ifDue) {
    const interval = Number.parseInt(process.env.AOS_BACKUP_INTERVAL_HOURS ?? "24", 10);
    const gate = await takePairIfDue(interval);
    if (gate.skipped) {
      // Exit 0: "not due" is a correct outcome, not a failure. A scheduler that read it
      // as failure would alert every hour it ran between backups.
      console.log(JSON.stringify({ ok: true, took: false, ...gate }, null, 2));
      process.exit(0);
    }
  }
  const taken = await takePair();
  if (taken.reason) {
    console.log(JSON.stringify(taken, null, 2));
    process.exit(1);
  }
  // Rotation runs only after the new pair proved itself, so a broken backup can never
  // be the reason an older good one was deleted.
  const rotated = taken.ok
    ? await rotate(retention)
    : { kept: null, deleted: [], skipped: "pair_verification_failed" };
  const receipt = {
    ok: taken.ok,
    destinationRoot,
    directory: basename(taken.directory),
    pair: taken.pairManifest,
    export: taken.export,
    rotated
  };
  await mkdir("evidence", { recursive: true });
  await writeFile("evidence/aos-paired-backup.json", `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(JSON.stringify(receipt, null, 2));
  if (!taken.ok) process.exitCode = 1;
}
