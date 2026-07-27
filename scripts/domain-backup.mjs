#!/usr/bin/env node
// Back up the cockpit's domain store — the one thing here that cannot be rebuilt.
//
// Every other store on this platform is derivable. Delete the projection and
// re-running ingestion reproduces it byte for byte; delete a build and rebuild
// it. `domain.db` holds assignees, labels, priorities, comments and free
// relations that exist nowhere else, so it is the first data on this platform
// whose loss is permanent.
//
// That is why the direction conference made the backup a condition of creating
// the store rather than a follow-up: "domain.db's export backup must land in the
// same batch as the domain schema, or no real domain data may be written"
// (TCRN-CROSS-MIN-052, D5). This is that path. It was written after the
// condition had already been broken — real annotations were written before a
// backup route existed — which is recorded here rather than quietly repaired.
//
// Two artifacts per run, deliberately:
//
//   1. A byte copy of the SQLite file. Restores fastest, and is what you want
//      when the machine is the same machine.
//   2. A JSON export. Survives a schema change, a different SQLite build, and a
//      restore onto something that is not this laptop. A binary-only backup is a
//      bet that the reader will be identical to the writer, and that bet is
//      exactly the one a backup exists to avoid losing.
//
// The destination follows the platform's data-gravity ruling: backups flow to
// this machine, because this machine is the OneDrive gateway and the VM has no
// cloud backup path of its own.
//
// Usage:
//   node scripts/domain-backup.mjs                 # take a snapshot
//   node scripts/domain-backup.mjs --verify <dir>  # prove one restores

import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const domainDatabasePath = process.env.AOS_DOMAIN_DB
  ?? resolve(homedir(), ".tcrn-aos/domain.db");
const destinationRoot = process.env.AOS_BACKUP_DEST
  ?? resolve(homedir(), "OneDrive/Github/tcrn-aos-domain-backups");
// Oldest-first rotation, and only ever after a new snapshot has verified. A
// rotation that runs before verification can delete the last good copy in order
// to make room for a broken one.
const retention = Number.parseInt(process.env.AOS_BACKUP_RETENTION ?? "5", 10);

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

async function loadStore(path) {
  const { DomainStore } = await import(
    resolve(process.cwd(), "dist/packages/projection/src/index.js"));
  const migration = await readFile(
    resolve(process.cwd(), "packages/db/migrations/domain/0001_cockpit_domain.sql"), "utf8");
  return new DomainStore(path, migration);
}

async function snapshot(stamp) {
  if (!existsSync(domainDatabasePath)) {
    return { ok: false, reason: "no_domain_database", domainDatabasePath };
  }
  const directory = join(destinationRoot, stamp);
  await mkdir(directory, { recursive: true });

  // The JSON export is taken through the store's own reader, so it reflects what
  // the schema says rather than what a raw file copy happens to contain.
  const store = await loadStore(domainDatabasePath);
  let exported;
  try {
    exported = store.exportAll();
  } finally {
    store.close();
  }
  const exportBody = `${JSON.stringify(exported, null, 2)}\n`;
  await writeFile(join(directory, "domain-export.json"), exportBody);
  await copyFile(domainDatabasePath, join(directory, "domain.db"));

  const databaseBytes = await readFile(join(directory, "domain.db"));
  const manifest = {
    schemaVersion: "aos.domain-backup.v1",
    takenAt: stamp,
    source: domainDatabasePath,
    counts: {
      annotations: exported.annotations.length,
      comments: exported.comments.length,
      relations: exported.relations.length
    },
    artifacts: {
      "domain.db": { bytes: databaseBytes.length, sha256: sha256(databaseBytes) },
      "domain-export.json": { bytes: Buffer.byteLength(exportBody), sha256: sha256(Buffer.from(exportBody)) }
    },
    notClaimed: [
      "this backup covers the cockpit's own store only; the governed chains have their own snapshots",
      "the projection database is deliberately absent — it is rebuilt from the chains, never restored"
    ]
  };
  await writeFile(join(directory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return { ok: true, directory, manifest };
}

/**
 * Prove a snapshot restores, by rebuilding a store from its JSON export and
 * comparing the result against the export itself.
 *
 * A backup nobody has restored is a hypothesis. This is cheap enough to run on
 * every snapshot, so it does.
 */
async function verifySnapshot(directory) {
  const manifest = JSON.parse(await readFile(join(directory, "manifest.json"), "utf8"));
  const exportBody = await readFile(join(directory, "domain-export.json"), "utf8");
  const databaseBytes = await readFile(join(directory, "domain.db"));

  const digestsMatch =
    sha256(Buffer.from(exportBody)) === manifest.artifacts["domain-export.json"].sha256
    && sha256(databaseBytes) === manifest.artifacts["domain.db"].sha256;

  const exported = JSON.parse(exportBody);
  const scratch = join(directory, ".restore-probe.db");
  await rm(scratch, { force: true });
  const store = await loadStore(scratch);
  let restored;
  try {
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
    restored = store.exportAll();
  } finally {
    store.close();
    await rm(scratch, { force: true });
    await rm(`${scratch}-wal`, { force: true });
    await rm(`${scratch}-shm`, { force: true });
  }

  const roundTrips =
    restored.annotations.length === exported.annotations.length
    && restored.comments.length === exported.comments.length
    && restored.relations.length === exported.relations.length;

  return {
    ok: digestsMatch && roundTrips,
    directory,
    digestsMatch,
    roundTrips,
    counts: manifest.counts
  };
}

/** Oldest-first, only after the new snapshot verified, and it names what it deleted. */
async function rotate(keep) {
  const entries = (await readdir(destinationRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const surplus = entries.slice(0, Math.max(0, entries.length - keep));
  for (const name of surplus) await rm(join(destinationRoot, name), { recursive: true, force: true });
  return { kept: entries.length - surplus.length, deleted: surplus };
}

const verifyFlag = process.argv.indexOf("--verify");
if (verifyFlag >= 0) {
  const target = process.argv[verifyFlag + 1];
  if (!target) {
    console.error(JSON.stringify({ ok: false, error: "--verify needs a snapshot directory" }));
    process.exit(1);
  }
  const result = await verifySnapshot(resolve(target));
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
} else {
  // Timestamps come from the clock here rather than from an argument because a
  // backup's name is genuinely "when it was taken", and there is nothing to
  // reproduce byte-for-byte.
  const stamp = new Date().toISOString().replace(/[:.]/gu, "-").replace(/Z$/u, "Z");
  const taken = await snapshot(stamp);
  if (!taken.ok) {
    console.log(JSON.stringify(taken, null, 2));
    process.exit(0);
  }
  const verified = await verifySnapshot(taken.directory);
  // Rotation runs only after the new snapshot has proven itself, so a broken
  // backup can never be the reason an older good one was deleted.
  const rotated = verified.ok ? await rotate(retention) : { kept: null, deleted: [], skipped: "verification_failed" };
  const receipt = { ok: verified.ok, destinationRoot, snapshot: taken.manifest, verified, rotated };
  await mkdir("evidence", { recursive: true });
  await writeFile("evidence/aos-domain-backup.json", `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(JSON.stringify(receipt, null, 2));
  if (!verified.ok) process.exitCode = 1;
}
