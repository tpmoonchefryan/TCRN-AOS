#!/usr/bin/env node
// Take the AOS pair — governed chain + domain store — ON the host that holds both.
//
// TCRN-AOS-INC-045. The pairing rule has never changed: the two stores are only
// useful together, so they are snapshotted at ONE instant and each half names the
// other by digest. What changed is where they live. STORY-131 moved the chain to
// the VM and STORY-132 moved the domain store after it, and for the window in
// between the two halves sat on different machines — which did not merely make the
// backup awkward, it made a PAIR impossible to take at all. A "pair" whose halves
// are read across a network at two different moments is two snapshots in one
// directory.
//
// So this program runs where the halves are. It is streamed to the VM over ssh
// stdin (`node --input-type=module -`) rather than installed: the bytes that run
// are the committed bytes of this file, and there is no deployed copy to drift
// from it. It is therefore SELF-CONTAINED — node builtins plus dynamic imports out
// of the deployed runtime tree whose absolute paths arrive in the config. It
// cannot import anything from the repository, because there is no repository here.
//
// Read-only against the chain. `snapshot-manifest` and `snapshot-verify` are the
// only engine verbs it calls and both are non-mutating; the one governed WRITE the
// ceremony can need (`knowledge-rebase`) is named as a remedy and never performed
// here — see the lockstep step.
//
// Usage (from the orchestrator, never by hand):
//   ssh VM 'node --input-type=module -' <<< <this file>   '<config json>'

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, copyFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir, hostname } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const runFile = promisify(execFile);
// The config arrives base64-encoded, and that is not decoration. ssh re-joins its
// remote argv with spaces and hands the result to the remote LOGIN SHELL, so a JSON
// argument is re-parsed there: `{"workspace":"/srv/…","engine":"/srv/…"}` is a brace
// expansion, and what this program received on the first attempt was
// `workspace:/srv/…` with the quotes eaten. Base64 has no shell metacharacters.
const config = JSON.parse(Buffer.from(process.argv[2] ?? "", "base64").toString("utf8") || "{}");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sha256Text = (text) => sha256(Buffer.from(text, "utf8"));
const note = (text) => process.stderr.write(`[vm-take-pair] ${text}\n`);

/** Read-only engine verbs only. A mutating verb has no business in a backup. */
const READ_ONLY_VERBS = new Set(["status", "validate", "snapshot-manifest", "snapshot-verify"]);
async function engine(verb, args) {
  if (!READ_ONLY_VERBS.has(verb)) {
    throw new Error(`refusing to call a non-read-only verb from a backup: ${verb}`);
  }
  try {
    const { stdout } = await runFile(process.execPath,
      [join(config.engine, "scripts/tcrn-workflow.mjs"), verb, ...args],
      { cwd: config.engine, maxBuffer: 64 * 1024 * 1024 });
    return { exitCode: 0, body: stdout };
  } catch (error) {
    return {
      exitCode: typeof error.code === "number" ? error.code : 1,
      body: String(error.stdout ?? "").trim() || String(error.stderr ?? "").trim()
    };
  }
}
const parseOrNull = (text) => { try { return JSON.parse(text); } catch { return null; } };

/* ------------------------------------------------------------------ preflight */

/**
 * Is each half the LIVE half?
 *
 * This is the check INC-045 exists for, and it is deliberately not "do the paths
 * exist". Both halves still exist at their OLD addresses too: the vacated
 * workspace is intact on the operator's laptop and so is the archived store
 * beside its sentinel. A backup script that only asked "is there a chain here and
 * a database there" would have taken a beautifully green pair of two dead halves
 * and rotated away the last live one to make room for it.
 *
 * So liveness is asked of the authority in each case: the ENGINE answers for the
 * chain (a relocated address answers WORKSPACE_RELOCATION_VACATED, which is the
 * relocation working), and the archive SENTINEL answers for the store (its
 * presence beside a database means that file is an archive nobody reads back).
 */
async function judgeHalvesAreLive() {
  const status = await engine("status", ["--workspace", config.workspace]);
  const parsed = parseOrNull(status.body) ?? {};
  const chainLive = status.exitCode === 0 && parsed.ok !== false;
  const sentinel = join(dirname(config.domainDb), "RELOCATED-TO-VM.json");
  const storeIsArchive = existsSync(sentinel);
  return {
    chain: {
      host: hostname(),
      path: config.workspace,
      live: chainLive,
      engineReasonCode: parsed.reasonCode ?? null,
      headEventHash: parsed.headEventHash ?? null,
      version: parsed.version ?? null,
      workspaceId: parsed.workspaceId ?? null,
      askedOf: "the engine, on the host holding the chain — a vacated address answers WORKSPACE_RELOCATION_VACATED"
    },
    domain: {
      host: hostname(),
      path: config.domainDb,
      live: existsSync(config.domainDb) && !storeIsArchive,
      present: existsSync(config.domainDb),
      archiveSentinelPresent: storeIsArchive,
      askedOf: "the archive sentinel beside the file — its presence means this store is an archive, not the store the cockpit writes"
    }
  };
}

/**
 * The lockstep precondition, named before anything is copied.
 *
 * `snapshot-manifest` fails closed with KNOWLEDGE_HIGH_WATER_MISMATCH whenever the
 * knowledge marker trails the chain head — the normal state after any governed
 * write, because writes advance the head and the marker only moves on
 * `knowledge-rebase`. It is checked separately because of how it fails otherwise:
 * `status` and `validate` both answer ok at the same moment, so the operator sees a
 * healthy chain and concludes the backup tool is broken. The remedy is a governed
 * write, so this program NAMES it and does not perform it.
 */
async function checkLockstep(headEventHash) {
  const marker = JSON.parse(await readFile(
    join(config.workspace, ".tcrn-workflow/knowledge/store.json"), "utf8"));
  const ok = marker.eventHighWaterDigest === headEventHash;
  return {
    ok,
    chainHeadEventHash: headEventHash,
    knowledgeHighWaterDigest: marker.eventHighWaterDigest,
    knowledgeVersion: marker.version,
    remedy: ok ? null
      : `node ${join(config.engine, "scripts/tcrn-workflow.mjs")} knowledge-rebase`
        + ` --workspace ${config.workspace} --expected-version ${marker.version} --at <instant>`
        + " (a governed write on the live chain; this program will not perform it)"
  };
}

/* --------------------------------------------------------------- domain half */

async function loadDomainStore(path) {
  const { DomainStore, loadDomainMigrationSql } = await import(pathToFileURL(
    join(config.runtime, "dist/packages/projection/src/index.js")).href);
  // The whole migrations directory, so a schema addition is covered the day it
  // lands rather than when someone remembers to update this loader.
  const migration = loadDomainMigrationSql(join(config.runtime, "packages/db/migrations/domain"));
  return new DomainStore(path, migration);
}

/**
 * The domain half.
 *
 * The logical export is taken FIRST and the physical snapshot second, in that
 * order for the reason the migration recipe paid for: opening a SQLite database
 * can touch its bytes, so anything digest-bearing has to come after the read that
 * might move them.
 *
 * The physical copy goes through the engine-owned snapshot path (`VACUUM INTO` +
 * `PRAGMA integrity_check`), never `copyFile`: copying a live SQLite file — and
 * this one is live, the resident cockpit writes it — can capture a torn page set
 * that only fails at read time, long after the run that produced it reported
 * success. Here it would also miss the WAL entirely.
 */
async function snapshotDomain(directory, instant) {
  const { createSqlitePhysicalSnapshot, sqliteIntegrityCheck } = await import(pathToFileURL(
    join(config.runtime, "dist/packages/db/src/index.js")).href);

  // The live store's bytes before anything touches it. A backup has no business
  // modifying what it copies, and this path does open the store read-WRITE: the
  // `DomainStore` constructor applies the migration SQL. Those statements are
  // idempotent, but "should be idempotent" is a belief and this is a measurement.
  const liveBefore = sha256(await readFile(config.domainDb));

  const store = await loadDomainStore(config.domainDb);
  let exported;
  try {
    exported = store.exportAll();
  } finally {
    store.close();
  }
  const exportBody = `${JSON.stringify(exported, null, 2)}\n`;
  await writeFile(join(directory, "domain-export.json"), exportBody);

  // One reading, used for both fields: two reads of a live file can differ, and a
  // digest compared against a second, later digest of itself is not the same check.
  const liveAfter = sha256(await readFile(config.domainDb));

  const physical = createSqlitePhysicalSnapshot({
    sourceDatabasePath: config.domainDb,
    snapshotPath: join(directory, "domain.db"),
    snapshotId: `domain-${instant}`,
    createdAt: instant,
    purpose: "paired-domain-and-chain-backup",
    sourceProfileDigest: sha256Text(config.domainDb),
    routeId: "route_tcrn_aos_inc_045_paired_backup_new_topology",
    profileId: "profile_tcrn_aos_domain",
    // Not a git worktree on this host, but the governance tree and the engine are
    // roots nothing may write into, and this is the check that says so.
    forbiddenWorktreeRoots: config.forbiddenRoots ?? []
  });

  return {
    ok: physical.ok,
    createdWith: physical.createdWith,
    liveDatabaseFileCopiedDirectly: physical.liveDatabaseFileCopiedDirectly,
    integrityCheck: physical.manifest.integrityCheck,
    snapshotDigest: physical.snapshotDigest,
    manifestDigest: physical.manifestDigest,
    snapshotManifestCreatedAt: physical.manifest.createdAt,
    sourceDatabaseDigest: physical.manifest.sourceDatabaseDigest,
    tableRowCounts: physical.manifest.tableRowCounts,
    exportDigest: sha256Text(exportBody),
    counts: {
      annotations: exported.annotations.length,
      comments: exported.comments.length,
      relations: exported.relations.length,
      chainWriteLog: exported.chainWriteLog.length
    },
    liveIntegrityCheck: sqliteIntegrityCheck(config.domainDb),
    // Reported, not enforced. A difference here usually means this path wrote to
    // the store it was copying, which is what it is watching for — but the
    // resident cockpit is live, so a genuine write arriving between the two
    // readings would look identical. Failing the backup on it would let anyone
    // using the UI break the backup; reporting it puts the fact where an operator
    // can act on it.
    liveStoreBytes: {
      sha256Before: liveBefore,
      sha256After: liveAfter,
      unchangedAcrossThisRun: liveBefore === liveAfter,
      enforced: false,
      note: "备份不该改动它所拷贝的东西;但座舱是活的,同期一笔真实写入看起来一样,故只报不拦"
    }
  };
}

/**
 * Replay the export into a fresh store and count every table two ways.
 *
 * A backup nobody restored is a hypothesis. The scratch store lives in the
 * system temp directory, never inside the pair: a probe database that shared the
 * directory would have to be deleted before the export manifest was written, and
 * a cleanup step standing between a backup and its own manifest is a step that
 * can fail halfway.
 */
async function drillDomainRestore(directory) {
  const exported = JSON.parse(await readFile(join(directory, "domain-export.json"), "utf8"));
  const scratchDir = await mkdtemp(join(tmpdir(), "aos-pair-drill-"));
  const scratch = join(scratchDir, "probe.db");
  const store = await loadDomainStore(scratch);
  let restored;
  try {
    // setAnnotation takes an input shape, not the exported row: handing the row
    // back whole would carry fields the writer does not accept.
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
    // Restore keeps the original seq — the log is ordered by it.
    for (const entry of exported.chainWriteLog ?? []) store.restoreChainWrite(entry);
    restored = store.exportAll();
  } finally {
    store.close();
  }

  // The second judge: raw COUNT(*) straight at the rebuilt tables. The comparison
  // above is one code path reading itself, so a family `exportAll` silently
  // dropped would agree with itself and stay green. A count issued at the table
  // cannot share that blind spot — the two sides of this predicate can differ.
  const { DatabaseSync } = await import("node:sqlite");
  const families = [
    ["annotations", "aos_domain_annotation"],
    ["comments", "aos_domain_comment"],
    ["relations", "aos_domain_relation"],
    ["chainWriteLog", "aos_chain_write_log"]
  ];
  const sqlCounts = {};
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
    replayedInto: "a fresh store in the system temp directory, removed after the drill",
    judges: ["the store's own exportAll re-read", "raw COUNT(*) per table on the rebuilt file"],
    counts,
    notClaimed: "this proves the export REBUILDS a store; it does not perform a restore of the live one"
  };
}

/* ---------------------------------------------------------------- chain half */

/**
 * The chain half. The manifest is taken first, then the tree is copied, then the
 * copy is verified — the order the engine's runbook requires, because the manifest
 * excludes the held lease subtree and only matches a copy taken after release.
 */
async function snapshotChain(directory, instant) {
  const manifest = await engine("snapshot-manifest", ["--workspace", config.workspace, "--at", instant]);
  if (manifest.exitCode !== 0) {
    return { ok: false, reasonCode: parseOrNull(manifest.body)?.reasonCode ?? "SNAPSHOT_MANIFEST_REFUSED",
      manifestError: manifest.body.slice(0, 400) };
  }
  const manifestPath = join(directory, "chain-snapshot-manifest.json");
  await writeFile(manifestPath, manifest.body);

  const chainRoot = join(directory, "chain");
  await cp(join(config.workspace, ".tcrn-workflow"), join(chainRoot, ".tcrn-workflow"),
    { recursive: true, verbatimSymlinks: true });

  const verified = await engine("snapshot-verify", ["--root", chainRoot, "--manifest", manifestPath]);
  const verdict = parseOrNull(verified.body) ?? {};
  const reasonCode = verdict.reasonCode ?? verdict.result?.reasonCode ?? null;

  // The attestation sibling. The engine requires `--attest-dir` to resolve OUTSIDE
  // the workspace root — precisely so these receipts can never be mistaken for
  // attested in-workspace artifacts — so the chain's own snapshot never sees them.
  // Left out of the pair, a restored chain keeps its events and loses every
  // local-clock reading taken alongside them.
  //
  // Their real strength, stated rather than implied: `tcrn.time-attestation.v1` is
  // ADVISORY and unauthenticated, written best-effort after a successful mutation,
  // and the engine ships no verifier. Each receipt says "at observedAt this
  // machine's clock read this while committing the event with this hash". Backing
  // them up preserves corroboration; it does not upgrade it to proof.
  //
  // Event hashes are read out of the COPY, not the source: the copy is what a
  // restore would get, and `snapshot-verify` has already proven the two identical.
  const eventHashes = new Set();
  const eventsDir = join(chainRoot, ".tcrn-workflow/events");
  for (const name of (await readdir(eventsDir)).sort()) {
    const segment = JSON.parse(await readFile(join(eventsDir, name), "utf8"));
    for (const event of (Array.isArray(segment) ? segment : segment.events ?? [])) {
      if (typeof event?.eventHash === "string") eventHashes.add(event.eventHash);
    }
  }

  // The sidecar holds more than one KIND of receipt, and the counters have to say
  // so. `tcrn.time-attestation.v1` is named after the event hash it witnesses, so
  // "filename does not equal eventHash" and "eventHash names no event here" are
  // meaningful failures for it. `tcrn.relocation-attestation.v1` — the two receipts
  // STORY-131 wrote for the adopted and vacated stages — has no eventHash and is
  // named after the relocation, so counting it as an orphan makes the orphan counter
  // permanently 2. A counter that is never zero is a counter readers learn to skip,
  // which is precisely how a real orphan would get past it. So each kind is counted
  // on its own, and the orphan check runs only where it means something.
  const kinds = { timeAttestations: 0, relocationAttestations: 0, unrecognised: [] };
  const receipts = [];
  let orphanReceipts = 0;
  let filenameMismatches = 0;
  const attestationsPresent = existsSync(config.attestDir);
  if (attestationsPresent) {
    await mkdir(join(directory, "attestations"), { recursive: true });
    for (const name of (await readdir(config.attestDir)).sort()) {
      const body = await readFile(join(config.attestDir, name));
      await copyFile(join(config.attestDir, name), join(directory, "attestations", name));
      const receipt = parseOrNull(body.toString("utf8"));
      const schema = receipt?.schemaVersion ?? null;
      if (schema === "tcrn.time-attestation.v1") {
        kinds.timeAttestations += 1;
        if (receipt.eventHash !== name.replace(/\.json$/u, "")) filenameMismatches += 1;
        if (!eventHashes.has(receipt.eventHash)) orphanReceipts += 1;
      } else if (schema === "tcrn.relocation-attestation.v1") {
        kinds.relocationAttestations += 1;
      } else {
        // Neither kind: reported by name rather than folded into a count, because an
        // unrecognised receipt in this directory is a thing to look at, not a number.
        kinds.unrecognised.push({ name, schemaVersion: schema });
      }
      receipts.push({ name, sha256: sha256(body) });
    }
  }

  const body = JSON.parse(manifest.body);
  return {
    ok: reasonCode === "SNAPSHOT_VERIFIED",
    reasonCode,
    verifyError: verified.exitCode === 0 ? null : verified.body.slice(0, 400),
    headEventHash: body.headEventHash ?? null,
    version: body.version ?? null,
    workspaceId: body.workspaceId ?? null,
    validate: body.validate ?? null,
    chainManifestDigest: sha256Text(manifest.body),
    attestations: {
      // Not-read and empty are different facts.
      directoryPresent: attestationsPresent,
      count: receipts.length,
      byKind: kinds,
      chainEventsSeen: eventHashes.size,
      // Reported, not enforced: an orphan receipt does not corrupt the chain, and
      // failing a whole backup over one trades a real backup for a cosmetic
      // invariant. Checked here because the engine has no verifier for them, so
      // if this correspondence is not checked here it is checked nowhere.
      orphanReceipts,
      filenameMismatches,
      orphanCheckAppliesTo: "tcrn.time-attestation.v1 only -- the only kind whose filename is defined to be an event hash",
      strength: "advisory local-clock corroboration; unauthenticated, no engine verifier",
      setDigest: sha256Text(receipts.map((item) => `${item.name} ${item.sha256}`).join("\n"))
    }
  };
}

/* -------------------------------------------------------------- the manifest */

/** Every file in the pair with its digest, so the far side can act without trusting the transport. */
async function writeExportManifest(directory, pairManifest) {
  const files = [];
  const walk = async (relativePath) => {
    for (const entry of (await readdir(join(directory, relativePath), { withFileTypes: true }))
      .sort((left, right) => (left.name < right.name ? -1 : 1))) {
      const next = relativePath ? join(relativePath, entry.name) : entry.name;
      if (entry.isDirectory()) await walk(next);
      else if (entry.isFile()) {
        const body = await readFile(join(directory, next));
        files.push({ path: next, bytes: body.length, sha256: sha256(body) });
      } else throw new Error(`unsupported entry in a transfer set: ${next}`);
    }
  };
  await walk("");

  const manifest = {
    schemaVersion: "aos.paired-backup-export.v1",
    pairedAt: pairManifest.pairedAt,
    partition: pairManifest.partition,
    pairOk: pairManifest.ok,
    takenOn: pairManifest.takenOn,
    pairing: pairManifest.pairing,
    totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
    fileCount: files.length,
    files,
    fileSetDigest: sha256Text(files.map((file) => `${file.path} ${file.sha256}`).join("\n")),
    // Verbatim from the shape this repository has carried since S020, and NOT
    // rewritten now that the direction finally reversed. MIN-007 D9 chose push
    // while the truth lived on the laptop and kept this contract unchanged as the
    // residual case ("若未来改拉,契约与判据一字不改"). The truth moved; the
    // residual case is now the live one; the words are the ones that were kept.
    pullContract: [
      "fetch every path in `files` and compare sha256 before trusting any of it",
      "that check needs nothing but python3/sha256 -- no engine, no repository checkout",
      "the puller needs no credential for the source machine beyond read access to these bytes",
      "this manifest does not itself authenticate the source: it detects corruption and truncation, not substitution"
    ],
    // The ceiling MOVED, and this is where it is recorded. While the truth was on
    // the laptop the far side was a VM with node and nothing else: byte-integrity
    // provable there, restorability only where the engine lived. Now the engine
    // lives WITH the chain — which is the standing use MIN-011 kept it for — so
    // the primary side proves restorability itself, and the off-site host proves
    // it a second time with its own independent engine.
    farSideVerification: {
      provenHere: [
        "snapshot-verify (SNAPSHOT_VERIFIED) by the engine on the host holding the chain",
        "the domain restore drill, replayed into a fresh store by this host's own runtime"
      ],
      availableWithoutEngine: "sha256 comparison of every file against this manifest",
      offsiteHostReProves: "both of the above again, with a second engine and a second checkout",
      soRestorabilityIsProvenOn: "two hosts, independently, over the same bytes"
    },
    notClaimed: [
      "this manifest does not authenticate its source; it detects corruption and truncation, not substitution",
      "a byte-verified copy is not a proven restore: it proves arrival plus a drill, not a restore"
    ]
  };
  await writeFile(join(directory, "export-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return {
    fileCount: manifest.fileCount,
    totalBytes: manifest.totalBytes,
    fileSetDigest: manifest.fileSetDigest
  };
}

/* ------------------------------------------------------------------- the run */

async function main() {
  const halves = await judgeHalvesAreLive();
  if (!halves.chain.live) {
    return { ok: false, reason: "chain_half_is_not_live", halves };
  }
  if (!halves.domain.live) {
    return { ok: false, reason: halves.domain.archiveSentinelPresent
      ? "domain_half_is_an_archive" : "no_domain_store", halves };
  }
  if (halves.chain.host !== halves.domain.host) {
    // Unreachable while both addresses are on this host, and kept anyway: this is
    // the condition INC-045 was raised for, and a predicate that cannot be
    // evaluated is a predicate nobody notices going false.
    return { ok: false, reason: "halves_on_different_hosts", halves };
  }

  const lockstep = await checkLockstep(halves.chain.headEventHash);
  if (!lockstep.ok) {
    return { ok: false, reason: "knowledge_high_water_behind_chain_head", lockstep, halves };
  }

  // ONE instant for both halves, read from the clock of the host that HOLDS both
  // halves. Under the old topology the orchestrator's clock was also the halves'
  // clock; it is not any more, and a pair stamped with a third machine's reading
  // of the time would be describing a moment neither half was read at.
  const instant = new Date().toISOString().replace(/\.\d{3}Z$/u, "Z");
  const directory = join(config.pairRoot, instant.replace(/:/gu, "-"));
  if (existsSync(directory)) {
    return { ok: false, reason: "pair_directory_already_exists", directory };
  }
  await mkdir(join(directory, "domain"), { recursive: true });
  note(`taking the pair at ${instant} into ${directory}`);

  const domain = await snapshotDomain(join(directory, "domain"), instant);
  const chain = await snapshotChain(directory, instant);
  const drill = await drillDomainRestore(join(directory, "domain"));

  const pairManifest = {
    schemaVersion: "aos.paired-backup.v2",
    supersedes: "aos.paired-backup.v1 (both halves on the operator's laptop)",
    pairedAt: instant,
    partition: config.partition,
    ok: domain.ok && chain.ok && drill.ok,
    // WHERE the pair was taken, per half, recorded rather than assumed. INC-045
    // was a topology fact that no artifact stated, so nothing could go red on it.
    takenOn: {
      host: halves.chain.host,
      clockRead: "on the host holding both halves; the orchestrator's clock is recorded separately as corroboration",
      engine: config.engine,
      runtime: config.runtime
    },
    halves,
    lockstep,
    // The qualified cross-reference: each half names the other by digest, so a
    // restore proves the pair instead of trusting the directory name. Two files
    // written in the same second still do not prove they belong together.
    pairing: {
      domainSnapshotDigest: domain.snapshotDigest,
      domainExportDigest: domain.exportDigest,
      chainManifestDigest: chain.chainManifestDigest,
      chainHeadEventHash: chain.headEventHash,
      chainVersion: chain.version,
      attestationSetDigest: chain.attestations.setDigest,
      boundBy: "one instant read on one host, plus mutual digests; either half alone is not a restorable pair"
    },
    domain,
    chain,
    restoreDrill: drill,
    notClaimed: [
      "this run proves each half restores in a drill; it does not perform a restore",
      "the projection database is deliberately absent -- it is rebuilt from the chains, never restored",
      "the O3 event mirror is deliberately absent (MIN-007) -- a derived instrument, never a second restorable copy of chain history",
      "a chain restore is same-path-only and operator-driven; see tcrn-workflow/docs/architecture/backup-restore-runbook.md",
      "this pair sits on the same host as the truth it copies; off-site is a separate leg, and this program does not perform it"
    ]
  };
  await writeFile(join(directory, "pair-manifest.json"), `${JSON.stringify(pairManifest, null, 2)}\n`);
  // Written last so it covers the pair manifest too, and a truncated run leaves no
  // export manifest claiming a complete set.
  const exported = await writeExportManifest(directory, pairManifest);
  return { ok: pairManifest.ok, directory, instant, pair: pairManifest, export: exported };
}

/**
 * Re-derive, from the bytes of an existing pair, every fact the pairing judgement
 * needs — recomputing each digest rather than reading back the manifest's claim
 * about it, re-running `snapshot-verify` on the chain copy, and re-running the
 * restore drill on the domain export.
 *
 * Separate from `take` on purpose. The take run WROTE those digests; a check that
 * compares them to themselves is one act agreeing with itself. This is a second
 * reading of the same bytes, and it is the mode the tamper drill points at a
 * disposable copy.
 */
async function observe(directory) {
  const pairManifest = JSON.parse(await readFile(join(directory, "pair-manifest.json"), "utf8"));
  const chainManifestBody = await readFile(join(directory, "chain-snapshot-manifest.json"), "utf8");
  const chainManifest = parseOrNull(chainManifestBody) ?? {};
  const domainManifest = JSON.parse(await readFile(
    join(directory, "domain", "domain.db.manifest.json"), "utf8"));

  const verified = await engine("snapshot-verify",
    ["--root", join(directory, "chain"), "--manifest", join(directory, "chain-snapshot-manifest.json")]);
  const verdict = parseOrNull(verified.body) ?? {};

  const attestationDir = join(directory, "attestations");
  const receipts = [];
  if (existsSync(attestationDir)) {
    for (const name of (await readdir(attestationDir)).sort()) {
      receipts.push({ name, sha256: sha256(await readFile(join(attestationDir, name))) });
    }
  }

  const drill = await drillDomainRestore(join(directory, "domain"));
  return {
    ok: true,
    mode: "observe",
    directory,
    pairManifest,
    observed: {
      domainSnapshotSha256: sha256(await readFile(join(directory, "domain", "domain.db"))),
      domainExportSha256: sha256(await readFile(join(directory, "domain", "domain-export.json"))),
      chainManifestSha256: sha256Text(chainManifestBody),
      chainManifestHeadEventHash: chainManifest.headEventHash ?? null,
      chainManifestVersion: chainManifest.version ?? null,
      domainSnapshotManifestCreatedAt: domainManifest.createdAt ?? null,
      domainSnapshotManifestSnapshotDigest: domainManifest.snapshotDigest ?? null,
      attestationSetDigest: sha256Text(receipts.map((item) => `${item.name} ${item.sha256}`).join("\n")),
      chainVerifyReasonCode: verdict.reasonCode ?? verdict.result?.reasonCode ?? null,
      restoreDrillOk: drill.ok
    },
    restoreDrill: drill
  };
}

/** Oldest-first rotation of the PRIMARY pairs, and it names what it deleted. */
async function rotate(keep) {
  if (!existsSync(config.pairRoot)) return { kept: 0, deleted: [] };
  const names = (await readdir(config.pairRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && existsSync(join(config.pairRoot, entry.name, "pair-manifest.json")))
    .map((entry) => entry.name)
    .sort();
  const surplus = names.slice(0, Math.max(0, names.length - keep));
  for (const name of surplus) await rm(join(config.pairRoot, name), { recursive: true, force: true });
  return { kept: names.length - surplus.length, deleted: surplus };
}

const mode = config.mode ?? "take";
const result = mode === "rotate"
  ? { ok: true, mode, rotated: await rotate(config.keep ?? 5) }
  : mode === "observe"
    ? await observe(config.pairDir)
    : await main();
process.stdout.write(JSON.stringify(result));
if (!result.ok) process.exitCode = 1;
