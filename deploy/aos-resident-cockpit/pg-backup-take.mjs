#!/usr/bin/env node
// STORY-179 — take a PostgreSQL chain backup pair ON the host holding the PG data.
//
// ADR 0004 §6 face 6 redefined the backup: `paired:backup` switches from a file-tree
// snapshot to a VM-side `pg_dump` in custom format + a sha256 digest sidecar; the pull
// direction and the off-site verification are unchanged. This is the PG-side take
// program, the counterpart of `vm-take-pair.mjs` for the file-tree pair: self-contained,
// streamed to the host holding the data (or run directly), calling only read-only PG
// reads and the pg_dump/pg_restore binaries. It performs NO governed write.
//
// It runs where the database is reachable. On the production VM that is the PG instance
// on 127.0.0.1; for the local "new backend" empirical harness that is the Docker PG
// (`tcrn-postgres`) — the pg_dump / pg_restore commands are config-supplied argv arrays,
// so the same program drives both.
//
// Usage (from the orchestrator, never by hand):
//   node deploy/aos-resident-cockpit/pg-backup-take.mjs '<config-json-b64>'
//
// The config arrives base64-encoded for the same reason `vm-take-pair.mjs` does: ssh
// re-joins its remote argv with spaces and hands the result to the remote LOGIN SHELL,
// so a JSON argument is brace-expanded there. Base64 has no shell metacharacters.

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { hostname } from "node:os";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const runFile = promisify(execFile);
const config = JSON.parse(Buffer.from(process.argv[2] ?? "", "base64").toString("utf8") || "{}");

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const note = (text) => process.stderr.write(`[pg-backup-take] ${text}\n`);

/** Control tables a healthy chain schema must carry. The views/stores are derived and
 * rebuildable (ADR 0004 §4), but their PRESENCE is a structure fact the dump must prove. */
const EXPECTED_TABLES = ["events", "metadata", "views", "knowledge_marker", "artifact_marker"];
const SCHEMA_RE = /^[a-z_][a-z0-9_]*$/u;

function validateSchema(schema) {
  if (typeof schema !== "string" || !SCHEMA_RE.test(schema)) {
    throw new Error(`refusing a schema that is not a bare identifier: ${String(schema)}`);
  }
  return schema;
}
const SCHEMA = validateSchema(config.schema);
const SCHEMA_RE_ESC = SCHEMA.replace(/\./gu, "\\.");

/* ------------------------------------------------------------------ live reads */

/**
 * Read the chain's live state, one transaction's worth of SELECTs.
 *
 * `eventsDigest` is a whole-chain binding computed in SQL over the stored payload_hashes
 * in sequence order — a single-row change moves it, independent of the archive bytes.
 * The continuity query re-checks the chain's own invariants (sequence 1 has no prior;
 * every later event's prior_hash is the preceding event_hash) as a cheap first line;
 * the engine re-validates the whole chain on read, which stays the authority.
 */
async function liveReads(client) {
  const one = async (sql) => {
    const { rows } = await client.query(sql);
    return rows[0] ?? {};
  };
  const count = await one(`select count(*)::int as n from ${SCHEMA}.events`);
  const head = await one(`select event_hash from ${SCHEMA}.events order by sequence desc limit 1`);
  const digest = await one(`select coalesce(encode(sha256(string_agg(payload_hash, '' order by sequence)::bytea), 'hex'), '') as d from ${SCHEMA}.events`);
  const meta = await one(`select coalesce(encode(sha256(bytes), 'hex'), '') as d from ${SCHEMA}.metadata where id = 1`);
  const knowledge = await one(`select coalesce(encode(sha256(bytes), 'hex'), '') as d from ${SCHEMA}.knowledge_marker where id = 1`);
  const artifact = await one(`select coalesce(encode(sha256(bytes), 'hex'), '') as d from ${SCHEMA}.artifact_marker where id = 1`);
  const continuity = await one(`select count(*)::int as n from (
    select sequence, prior_hash, lag(event_hash) over (order by sequence) as prev_hash
      from ${SCHEMA}.events) t
    where (sequence = 1 and prior_hash is not null)
       or (sequence > 1 and prior_hash is distinct from prev_hash)`);
  return {
    eventsCount: count.n ?? 0,
    headEventHash: head.event_hash ?? null,
    eventsDigest: digest.d ?? "",
    metadataSha256: meta.d ?? "",
    knowledgeMarkerSha256: knowledge.d ?? "",
    artifactMarkerSha256: artifact.d ?? "",
    continuityViolations: continuity.n ?? 0
  };
}

/* ------------------------------------------------------------------- the dump */

/** Run the config-supplied pg_dump (no `-f`), capturing the custom-format archive bytes
 * from stdout and writing them into the pair directory. Returns the archive's sha256. */
async function runPgDump(outPath) {
  const argv = config.pgDumpCommand.map((token) => token.replace(/\{SCHEMA\}/gu, SCHEMA));
  const { stdout } = await runFile(argv[0], argv.slice(1),
    { maxBuffer: 512 * 1024 * 1024, encoding: "buffer" });
  if (stdout.length === 0) {
    throw new Error(`pg_dump produced zero bytes for ${SCHEMA} — refusing to write an empty backup`);
  }
  await writeFile(outPath, stdout);
  return sha256(stdout);
}

/** Run the config-supplied pg_restore --list over the archive file and parse the TOC. */
async function structureToc(dumpPath) {
  const argv = config.pgRestoreCommand.map((token) => token.replace(/\{FILE\}/gu, dumpPath));
  const { stdout } = await runFile(argv[0], argv.slice(1),
    { maxBuffer: 64 * 1024 * 1024, encoding: "utf8" });
  const tablePattern = new RegExp(`TABLE ${SCHEMA_RE_ESC} ([a-z_0-9]+)`, "gu");
  const tables = [...String(stdout).matchAll(tablePattern)].map((match) => match[1]);
  const missing = EXPECTED_TABLES.filter((table) => !tables.includes(table));
  return {
    ok: missing.length === 0 && /Format: CUSTOM/u.test(String(stdout)),
    customFormat: /Format: CUSTOM/u.test(String(stdout)),
    tables,
    missing,
    expectedTables: [...EXPECTED_TABLES],
    tocLines: String(stdout).split("\n").length
  };
}

/* ------------------------------------------------------------------- the run */

async function main() {
  const instant = new Date().toISOString().replace(/\.\d{3}Z$/u, "Z");
  const directory = join(config.pairRoot, instant.replace(/:/gu, "-"));
  await mkdir(directory, { recursive: true });
  const dumpPath = join(directory, `pg-dump-${SCHEMA}.dump`);

  const pg = await import(pathToFileURL(config.pgDriverPath).href);
  const client = new pg.default.Client({ connectionString: config.pgConnection });
  let live;
  await client.connect();
  try {
    live = await liveReads(client);
  } finally {
    await client.end().catch(() => {});
  }

  const dumpSha256 = await runPgDump(dumpPath);
  const structure = await structureToc(dumpPath);
  await writeFile(`${dumpPath}.sha256`, `${dumpSha256}\n`);

  const manifest = {
    schemaVersion: "aos.pg-backup.v1",
    supersedes: "aos.paired-backup.v2 (file-tree pair — kept for the local/shadow chains)",
    partition: config.partition,
    schema: SCHEMA,
    database: config.pgDatabase ?? null,
    takenAt: instant,
    takenOn: { host: hostname(), engineHost: config.takenOnHost ?? null, reads: "read-only SELECT + pg_dump; no governed write" },
    dumpFile: basename(dumpPath),
    dumpSha256,
    structure,
    live,
    ok: live.continuityViolations === 0 && structure.ok
  };
  await writeFile(join(directory, "pg-backup-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  note(`took PG backup of ${SCHEMA} at ${instant} into ${directory} (${live.eventsCount} events)`);
  return { ok: manifest.ok, directory, instant, partition: config.partition, schema: SCHEMA, manifest };
}

const result = await main();
process.stdout.write(JSON.stringify(result));
if (!result.ok) process.exitCode = 1;
