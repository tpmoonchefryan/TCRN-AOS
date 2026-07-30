#!/usr/bin/env node
// TCRN-AOS-STORY-132, step one: move the precious domain store to the VM.
//
// `domain.db` holds assignees, labels, priorities, comments, free relations and
// the S113 chain write log. Every other store on this platform is derivable —
// delete the projection and re-ingesting rebuilds it byte for byte — so this is
// the one file here whose loss is permanent. The chain moved to the VM; the
// cockpit that writes this store is about to become resident there; a store left
// behind on a machine the service can no longer reach would be a store that
// silently stops receiving writes.
//
// The order below is the whole design:
//   1. INSURANCE FIRST, and verified. scripts/domain-backup.mjs takes both a
//      logical export and a byte snapshot and then proves the export restores.
//      Nothing else in this file runs until that came back ok.
//   2. The local logical export is taken BEFORE the file digest, because opening
//      a SQLite database can touch its bytes; the digest is then computed on the
//      bytes that are actually about to travel.
//   3. Transfer, then compare digests, and only THEN open the copy on the VM.
//      Opening it first would invalidate the comparison it is supposed to pass.
//   4. Two independent judges (deploy/aos-resident-cockpit/resident-predicates.mjs):
//      the logical export compared full-value as text, and raw COUNT(*) per
//      table issued straight at the destination's own tables.
//   5. The original stays. It is renamed to nothing, deleted by nothing, and
//      gains a sentinel beside it so a local `pnpm cockpit:service` refuses to
//      start rather than writing to an archive nobody would read again.

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  VM_DATA_DIR, VM_DOMAIN_DB, VM_HOST, VM_RUNTIME
} from "./manifest.mjs";
import { judgeArchiveRetained, judgeDomainMigration } from "./resident-predicates.mjs";
import { instant, run, saveState, sha256File, sha256Text, ssh, sshNode, stepper } from "./resident-lib.mjs";
import { scrubHostPaths } from "../../scripts/lib/evidence-hygiene.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const LOCAL_DOMAIN_DB = process.env.AOS_DOMAIN_DB ?? resolve(homedir(), ".tcrn-aos/domain.db");
const ARCHIVE_SENTINEL = join(dirname(LOCAL_DOMAIN_DB), "RELOCATED-TO-VM.json");

/** The families the store holds, and the table each one is stored in. */
export const DOMAIN_TABLES = Object.freeze([
  { family: "annotations", table: "aos_domain_annotation" },
  { family: "comments", table: "aos_domain_comment" },
  { family: "relations", table: "aos_domain_relation" },
  { family: "chainWriteLog", table: "aos_chain_write_log" }
]);

/**
 * `--verify-only` re-reads an already-migrated store instead of moving one.
 *
 * A redeploy must not re-transfer the precious store: the copy on the VM is by
 * then the LIVE one, and overwriting it with the archive would silently discard
 * every write made since.
 *
 * So the second and later runs judge a different invariant, and it took a red run
 * to get it right. The first version of this mode compared the two stores for
 * equality and failed the moment the resident cockpit had written anything —
 * reporting a working deployment as a divergent store. What migration promises is
 * that nothing was LOST, not that the two copies stay the same. See
 * `judgeArchiveRetained`.
 */
const VERIFY_ONLY = process.argv.includes("--verify-only");

const receipt = {
  schemaVersion: "aos.domain-store-migration.v1",
  story: "TCRN-AOS-STORY-132",
  mode: VERIFY_ONLY ? "verify" : "transfer",
  ok: false,
  startedAt: instant(),
  steps: []
};
const step = stepper("domain", receipt, (partial) => saveState("domain-migration", partial));

/* ---- 0. the destination must be able to read what it is given ------------ */
// The VM verifies the migrated store with the same DomainStore class the resident
// service will use, out of the deployed runtime tree. That tree therefore has to
// be there already, and saying so here fails closed instead of producing a
// mysterious module-not-found from the far side of an ssh pipe.
const runtimePresent = await ssh(["test", "-f", `${VM_RUNTIME}/dist/packages/projection/src/index.js`],
  { allowFailure: true });
step("destination-runtime-present", {
  ok: runtimePresent.code === 0,
  reasonCode: runtimePresent.code === 0 ? "DESTINATION_RUNTIME_PRESENT" : "DESTINATION_RUNTIME_ABSENT",
  runtime: VM_RUNTIME,
  remedy: "run deploy/aos-resident-cockpit/apply.mjs, which stages the runtime before calling this recipe"
});

/* ---- 1. insurance, verified, before anything moves ----------------------- */

const backupOut = await run(process.execPath, [join(REPO_ROOT, "scripts/domain-backup.mjs")], { cwd: REPO_ROOT });
const backup = JSON.parse(backupOut.stdout);
step("insurance-snapshot-verified", {
  ok: backup.ok === true && backup.verified?.ok === true && backup.verified?.digestsMatch === true
    && backup.verified?.roundTrips === true,
  reasonCode: backup.ok ? "DOMAIN_BACKUP_TAKEN_AND_RESTORE_PROVEN" : "DOMAIN_BACKUP_FAILED",
  takenAt: backup.snapshot?.takenAt ?? null,
  counts: backup.snapshot?.counts ?? null,
  artifacts: backup.snapshot?.artifacts ?? null,
  restoreProof: {
    digestsMatch: backup.verified?.digestsMatch ?? null,
    roundTrips: backup.verified?.roundTrips ?? null,
    sqlCounts: backup.verified?.sqlCounts ?? null
  },
  note: "两件保险都取了:逻辑导出(JSON,跨 SQLite 构建可读)与物理快照(字节副本),且导出已实证可重建"
});

/* ---- 2. the local reading, then the bytes about to travel ---------------- */

const { DomainStore, loadDomainMigrationSql } = await import(
  join(REPO_ROOT, "dist/packages/projection/src/index.js"));
const migrationSql = loadDomainMigrationSql(join(REPO_ROOT, "packages/db/migrations/domain"));

function exportText(path) {
  const store = new DomainStore(path, migrationSql);
  try {
    // Two spaces, sorted by nothing this file chooses: the store's own reader
    // decides order and membership, and both hosts run the identical code over
    // the identical bytes. Any difference in the text is a difference in the data.
    return `${JSON.stringify(store.exportAll(), null, 2)}\n`;
  } finally {
    store.close();
  }
}

if (!existsSync(LOCAL_DOMAIN_DB)) {
  throw new Error(`no domain store at ${LOCAL_DOMAIN_DB}; nothing to migrate`);
}
const localExportText = exportText(LOCAL_DOMAIN_DB);
const localFileSha256 = sha256File(LOCAL_DOMAIN_DB);
step("local-reading-taken", {
  ok: localExportText.length > 0,
  reasonCode: "LOCAL_STORE_READ",
  fileSha256: localFileSha256,
  exportSha256: sha256Text(localExportText),
  exportBytes: Buffer.byteLength(localExportText),
  order: "导出先取、文件摘要后算——打开 SQLite 可能动到字节,摘要必须算在真正要传的那份上"
});

/* ---- 3. transfer, digest comparison, then (and only then) open it -------- */

await ssh(["mkdir", "-p", VM_DATA_DIR]);
const alreadyThere = await ssh(["test", "-e", VM_DOMAIN_DB], { allowFailure: true });
let remoteFileSha256 = null;
if (VERIFY_ONLY) {
  step("destination-already-holds-the-live-store", {
    ok: alreadyThere.code === 0,
    reasonCode: alreadyThere.code === 0 ? "DESTINATION_HOLDS_A_STORE" : "DESTINATION_HAS_NO_STORE",
    path: VM_DOMAIN_DB,
    transferred: false,
    why: "重跑不再搬:VM 上那份此刻才是活的,用归档覆盖它会把迁后所有写入静默丢掉"
  });
  remoteFileSha256 = (await ssh(["sha256sum", VM_DOMAIN_DB])).stdout.trim().split(/\s+/u)[0];
} else {
  step("destination-empty-before-transfer", {
    ok: alreadyThere.code !== 0,
    reasonCode: alreadyThere.code !== 0 ? "DESTINATION_HAS_NO_STORE" : "DESTINATION_ALREADY_HOLDS_A_STORE",
    path: VM_DOMAIN_DB,
    why: "拒绝覆盖:目的地若已有一份存储,它可能是别人写过的真值,而这一步不可逆",
    remedy: "确属重跑则加 --verify-only:改为重新核验,不再搬运"
  });

  await run("rsync", ["--archive", LOCAL_DOMAIN_DB, `${VM_HOST}:${VM_DOMAIN_DB}`]);
  remoteFileSha256 = (await ssh(["sha256sum", VM_DOMAIN_DB])).stdout.trim().split(/\s+/u)[0];
  step("bytes-arrived-intact", {
    ok: remoteFileSha256 === localFileSha256,
    reasonCode: remoteFileSha256 === localFileSha256 ? "STORE_BYTES_EQUAL" : "STORE_BYTES_DIVERGENT",
    localFileSha256,
    remoteFileSha256,
    comparedFullValue: true
  });
}

// The destination reads its own copy with its own node, through the same store
// class the resident service will use — so this step also proves the migrated
// schema opens on the VM at all, which a digest comparison cannot say.
const remoteReading = JSON.parse(await sshNode(`
  const path = require("path");
  const { DatabaseSync } = require("node:sqlite");
  (async () => {
    const runtime = ${JSON.stringify(VM_RUNTIME)};
    const { DomainStore, loadDomainMigrationSql } = await import(
      require("url").pathToFileURL(path.join(runtime, "dist/packages/projection/src/index.js")).href);
    const sql = loadDomainMigrationSql(path.join(runtime, "packages/db/migrations/domain"));
    const store = new DomainStore(${JSON.stringify(VM_DOMAIN_DB)}, sql);
    let text;
    try { text = JSON.stringify(store.exportAll(), null, 2) + "\\n"; } finally { store.close(); }
    const db = new DatabaseSync(${JSON.stringify(VM_DOMAIN_DB)});
    const counts = {};
    for (const table of ${JSON.stringify(DOMAIN_TABLES.map((entry) => entry.table))}) {
      counts[table] = Number(db.prepare("SELECT COUNT(*) AS n FROM " + table).get().n);
    }
    db.close();
    process.stdout.write(JSON.stringify({ text, counts }));
  })().catch((error) => { process.stderr.write(String(error && error.stack || error)); process.exit(1); });
`));

const verdict = VERIFY_ONLY
  ? judgeArchiveRetained({
    archiveExportText: localExportText,
    liveExportText: remoteReading.text,
    remoteSqlCounts: remoteReading.counts,
    expectedTables: DOMAIN_TABLES
  })
  : judgeDomainMigration({
    localExportText,
    remoteExportText: remoteReading.text,
    remoteSqlCounts: remoteReading.counts,
    localFileSha256,
    remoteFileSha256,
    expectedTables: DOMAIN_TABLES
  });
step(VERIFY_ONLY ? "archive-still-retained-in-the-live-store" : "migration-judged-by-two-independent-readers", {
  ...verdict,
  archiveExportSha256: sha256Text(localExportText),
  liveExportSha256: sha256Text(remoteReading.text),
  note: VERIFY_ONLY
    ? "复核判的是包含关系:归档里的每一行仍能在活库中被认出,追加表的旧行逐字未变,"
      + "且活库自己的 COUNT(*) 与自己的导出彼此确认(两个读者读同一份文件)"
    : "逻辑导出全值逐字节比对(不是计数比对),外加目的地自己的 COUNT(*) 作第二判据——后者与 exportAll 不共享盲区"
});

/* ---- 4. the original stays, and stops being writable by accident -------- */

const existingSentinel = existsSync(ARCHIVE_SENTINEL)
  ? JSON.parse(await readFile(ARCHIVE_SENTINEL, "utf8"))
  : null;
const sentinel = {
  schemaVersion: "aos.domain-store-archived.v1",
  story: "TCRN-AOS-STORY-132",
  // The archival instant is when the store MOVED, not when it was last checked.
  // Re-stamping it on every verification would erase the only date that answers
  // "how long has this been an archive".
  archivedAt: existingSentinel?.archivedAt ?? instant(),
  lastVerifiedAt: instant(),
  why: "这份存储已迁至 VM 常驻座舱;本文件在此,本机原库保留为归档,不删除",
  liveStore: {
    host: VM_HOST,
    path: VM_DOMAIN_DB,
    sha256AtMigration: existingSentinel?.liveStore?.sha256AtMigration ?? remoteFileSha256,
    // Named for WHEN it was read, not "now": a sentinel is read weeks later, and
    // a field called "now" then describes a moment that has passed.
    sha256AtLastVerification: remoteFileSha256
  },
  archivedCopy: {
    sha256AtMigration: existingSentinel?.archivedCopy?.sha256AtMigration ?? localFileSha256,
    sha256AtLastVerification: localFileSha256
  },
  effect: "scripts/cockpit-service-start.mjs 见到本文件即拒绝启动(除非显式给出别的 AOS_DOMAIN_DB),"
    + "以免有人在归档上继续写出一份无人回读的分叉"
};
await writeFile(ARCHIVE_SENTINEL, `${JSON.stringify(sentinel, null, 2)}\n`);
const localStillThere = existsSync(LOCAL_DOMAIN_DB) && sha256File(LOCAL_DOMAIN_DB) === localFileSha256;
step("original-kept-as-archive", {
  ok: localStillThere && existsSync(ARCHIVE_SENTINEL),
  reasonCode: localStillThere ? "ARCHIVE_INTACT_AND_MARKED" : "ARCHIVE_MOVED_OR_CHANGED",
  archivedSha256: localFileSha256,
  sentinelWritten: existsSync(ARCHIVE_SENTINEL),
  deleted: false
});

receipt.ok = receipt.steps.every((entry) => entry.ok !== false);
receipt.finishedAt = instant();
receipt.destination = { host: VM_HOST, path: VM_DOMAIN_DB };
saveState("domain-migration", scrubHostPaths(receipt));
console.log(JSON.stringify({
  ok: receipt.ok,
  reasonCodes: receipt.steps.map((entry) => entry.reasonCode),
  counts: verdict.exportedCounts ?? null,
  families: verdict.families ?? null,
  remoteSqlCounts: verdict.remoteSqlCounts ?? remoteReading.counts
}, null, 2));
if (!receipt.ok) process.exitCode = 1;
