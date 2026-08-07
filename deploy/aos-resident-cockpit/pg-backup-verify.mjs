#!/usr/bin/env node
// STORY-179 — off-site verification of a pulled PostgreSQL backup pair.
//
// ADR 0004 §6 face 6: the off-site verification of a PG backup is a digest compare plus
// a structure check — NOT the per-file tree walk the file pair used, because the artifact
// is a single custom-format archive, not a tree. The engine re-validates the chain on
// read; here the two sides that can differ are the archive's own bytes (via sha256) and
// the archive's internal TOC (via pg_restore --list).
//
// This runs on the OFF-SITE machine, over the pulled copy, without needing the live
// database. One byte changed in the dump, the sidecar, or the manifest's digest field,
// and the verdict is red.
//
// Usage:
//   node deploy/aos-resident-cockpit/pg-backup-verify.mjs --directory <pairDir> [--schema <s>]
//
// Structure command is config-supplied through TCRN_PG_RESTORE_CMD (a JSON argv array
// with a `{FILE}` placeholder), defaulting to a system `pg_restore --list`.

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const runFile = promisify(execFile);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
function hasFlag(name) {
  return process.argv.includes(name);
}

const DEFAULT_RESTORE = ["pg_restore", "--list", "{FILE}"];
const restoreCommand = process.env.TCRN_PG_RESTORE_CMD
  ? JSON.parse(process.env.TCRN_PG_RESTORE_CMD) : DEFAULT_RESTORE;

async function structureToc(dumpPath, schema) {
  const argv = restoreCommand.map((token) => token.replace(/\{FILE\}/gu, dumpPath));
  const { stdout } = await runFile(argv[0], argv.slice(1),
    { maxBuffer: 64 * 1024 * 1024, encoding: "utf8" });
  const tablePattern = new RegExp(`TABLE ${schema.replace(/\./gu, "\\.")} ([a-z_0-9]+)`, "gu");
  const tables = [...String(stdout).matchAll(tablePattern)].map((match) => match[1]);
  return {
    ok: /Format: CUSTOM/u.test(String(stdout)) && tables.includes("events") && tables.includes("metadata"),
    customFormat: /Format: CUSTOM/u.test(String(stdout)),
    tables,
    tocLines: String(stdout).split("\n").length
  };
}

async function main() {
  const receipt = {
    schemaVersion: "aos.pg-backup-verify.v1",
    checkedAt: new Date().toISOString().replace(/\.\d{3}Z$/u, "Z"),
    mode: "verify-offsite",
    ok: false,
    reasonCode: null,
    writesPerformed: false
  };
  const directory = arg("--directory");
  if (!directory || hasFlag("--help")) {
    receipt.reasonCode = "PG_VERIFY_INPUT_INVALID";
    process.stderr.write("usage: pg-backup-verify.mjs --directory <pairDir> [--schema <s>]\n");
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
    process.exitCode = 1;
    return;
  }

  let manifest;
  try {
    manifest = JSON.parse(await readFile(join(directory, "pg-backup-manifest.json"), "utf8"));
  } catch (error) {
    receipt.reasonCode = "NO_PG_MANIFEST";
    receipt.error = String(error?.message ?? error).slice(0, 300);
    receipt.directory = directory;
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
    process.exitCode = 1;
    return;
  }

  const schema = arg("--schema") ?? manifest.schema ?? null;
  const dumpFile = manifest.dumpFile ?? (schema ? `pg-dump-${schema}.dump` : null);
  const dumpPath = dumpFile ? join(directory, dumpFile) : null;

  // The manifest carries its own digest claims; the sidecar is a second, independent
  // statement. Both must agree with the bytes that actually arrived.
  let computed = null;
  let sidecar = null;
  let sidecarRead = false;
  let digestOk = false;
  if (dumpPath) {
    try {
      computed = sha256(await readFile(dumpPath));
      try {
        sidecar = (await readFile(`${dumpPath}.sha256`, "utf8")).trim();
        sidecarRead = true;
      } catch {
        sidecarRead = false;
      }
      digestOk = computed === manifest.dumpSha256
        && (!sidecarRead || computed === sidecar);
    } catch (error) {
      digestOk = false;
    }
  }

  const fields = {
    partitionId: typeof manifest.partition === "string" && manifest.partition.length > 0,
    schema: typeof schema === "string" && /^[a-z_][a-z0-9_]*$/u.test(schema),
    eventsCount: Number.isSafeInteger(manifest.live?.eventsCount),
    headEventHash: manifest.live?.headEventHash === null
      || typeof manifest.live?.headEventHash === "string",
    dumpSha256: typeof manifest.dumpSha256 === "string"
      && /^[a-f0-9]{64}$/u.test(manifest.dumpSha256)
  };
  const fieldsOk = Object.values(fields).every(Boolean);

  let structure = null;
  if (dumpPath && digestOk) {
    try {
      structure = await structureToc(dumpPath, schema);
    } catch (error) {
      structure = { ok: false, error: String(error?.message ?? error).slice(0, 300) };
    }
  }

  receipt.directory = directory;
  receipt.manifest = {
    partition: manifest.partition ?? null,
    schema,
    takenAt: manifest.takenAt ?? null,
    dumpFile: dumpFile ?? null
  };
  receipt.observed = {
    dumpSha256: computed,
    sidecar: sidecarRead ? sidecar : null,
    sidecarRead,
    structure
  };
  receipt.expected = {
    manifestDumpSha256: manifest.dumpSha256 ?? null,
    partition: manifest.partition ?? null,
    schema,
    eventsCount: manifest.live?.eventsCount ?? null,
    headEventHash: manifest.live?.headEventHash ?? null
  };

  receipt.reasonCode = !dumpPath ? "PG_DUMP_MISSING"
    : !digestOk ? "DUMP_DIGEST_MISMATCH"
      : !fieldsOk ? "MANIFEST_FIELDS_MISSING"
        : !(structure?.ok ?? false) ? "DUMP_STRUCTURE_INVALID"
          : "PG_BACKUP_VERIFIED";
  receipt.ok = receipt.reasonCode === "PG_BACKUP_VERIFIED";
  receipt.notClaimed = [
    "摘要比对 + 结构校验证明到达的字节与取备份时刻记录的字节一致,且归档本身是可读的定制格式;"
      + "它不验证此刻的活库(那需要连库,见 pg-chain-verify.mjs),也不执行恢复"
  ];
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  if (!receipt.ok) process.exitCode = 1;
}

await main();
