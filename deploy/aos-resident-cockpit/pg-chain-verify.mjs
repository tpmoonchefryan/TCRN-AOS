#!/usr/bin/env node
// STORY-179 — the DB-side counterpart of `deploy/aos-engine-host/verify.mjs`.
//
// `engine-host:verify` asks, read-only, "is the engine copy on the host still the pinned
// release?" over the file bytes. Under ADR 0004 the chain's truth moved to PostgreSQL, so
// the same question needs a DB-side answer: "is the PG chain at the head a backup's
// manifest recorded?" — events row count, head event_hash, the whole-events digest, the
// metadata row digest, and the two stores' marker digests, each recomputed here and
// compared against an independently-recorded expectation (a `pg-backup-manifest.json`
// pulled from an earlier take).
//
// Read-only, like its counterpart: only SELECT statements, `writesPerformed: false`. A run
// that cannot reach the DB reports `probed: false` and exits 1 rather than passing quietly.
//
// Usage:
//   node deploy/aos-resident-cockpit/pg-chain-verify.mjs \
//       --connection <conn-string> --schema <schema> \
//       [--expected-file <pg-backup-manifest.json> | --expected <json>] [--driver <pg-lib-path>]
//
// The connection string is never echoed (it carries credentials); only its host/database
// are recorded.

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
function hasFlag(name) {
  return process.argv.includes(name);
}

const SCHEMA_RE = /^[a-z_][a-z0-9_]*$/u;

/** Read the same live state the take program records, plus the chain's canonical bytes
 * digest (so a single-row change moves the binding even when the head hash columns are
 * untouched). */
async function liveReads(client, schema) {
  const one = async (sql) => {
    const { rows } = await client.query(sql);
    return rows[0] ?? {};
  };
  const count = await one(`select count(*)::int as n from ${schema}.events`);
  const head = await one(`select event_hash from ${schema}.events order by sequence desc limit 1`);
  const digest = await one(`select coalesce(encode(sha256(string_agg(payload_hash, '' order by sequence)::bytea), 'hex'), '') as d from ${schema}.events`);
  const meta = await one(`select coalesce(encode(sha256(bytes), 'hex'), '') as d from ${schema}.metadata where id = 1`);
  const knowledge = await one(`select coalesce(encode(sha256(bytes), 'hex'), '') as d from ${schema}.knowledge_marker where id = 1`);
  const artifact = await one(`select coalesce(encode(sha256(bytes), 'hex'), '') as d from ${schema}.artifact_marker where id = 1`);
  const continuity = await one(`select count(*)::int as n from (
    select sequence, prior_hash, lag(event_hash) over (order by sequence) as prev_hash
      from ${schema}.events) t
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

function safeConnectionHost(connection) {
  try {
    const url = new URL(connection);
    return { host: url.host, database: decodeURIComponent(url.pathname.slice(1)) };
  } catch {
    return { host: null, database: null };
  }
}

async function main() {
  const receipt = {
    schemaVersion: "aos.pg-chain-verify.v1",
    counterpart: "deploy/aos-engine-host/verify.mjs (file engine copy) — this is its DB-side question",
    checkedAt: new Date().toISOString().replace(/\.\d{3}Z$/u, "Z"),
    probed: false,
    ok: false,
    reasonCode: null,
    writesPerformed: false
  };

  const connection = arg("--connection");
  const schema = arg("--schema");
  if (!connection || !schema || !SCHEMA_RE.test(schema)) {
    receipt.reasonCode = "PG_CHAIN_VERIFY_INPUT_INVALID";
    process.stderr.write("usage: pg-chain-verify.mjs --connection <conn> --schema <schema>"
      + " [--expected-file <manifest> | --expected <json>] [--driver <pg-lib-path>]\n");
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
    process.exitCode = 1;
    return;
  }
  receipt.connection = safeConnectionHost(connection);
  receipt.schema = schema;

  const driverPath = arg("--driver")
    ?? process.env.TCRN_PG_DRIVER
    ?? resolve(HERE, "..", "..", "..", "tcrn-workflow", "node_modules", "pg", "lib", "index.js");

  // Expected: an independently-recorded snapshot of this chain's truth. When absent the
  // verifier reports the live values (a reading, not a verdict).
  let expected = null;
  let expectedSource = null;
  const expectedFile = arg("--expected-file");
  const expectedInline = arg("--expected");
  if (expectedFile) {
    try {
      const manifest = JSON.parse(await readFile(expectedFile, "utf8"));
      expected = {
        eventsCount: manifest.live?.eventsCount ?? null,
        headEventHash: manifest.live?.headEventHash ?? null,
        eventsDigest: manifest.live?.eventsDigest ?? null,
        metadataSha256: manifest.live?.metadataSha256 ?? null,
        knowledgeMarkerSha256: manifest.live?.knowledgeMarkerSha256 ?? null,
        artifactMarkerSha256: manifest.live?.artifactMarkerSha256 ?? null
      };
      expectedSource = `pg-backup-manifest ${expectedFile} (takenAt ${manifest.takenAt ?? "?"})`;
    } catch (error) {
      receipt.reasonCode = "EXPECTED_UNREADABLE";
      receipt.error = String(error?.message ?? error).slice(0, 300);
      process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }
  } else if (expectedInline) {
    expected = JSON.parse(expectedInline);
    expectedSource = "inline --expected";
  }

  let observed;
  try {
    const pg = await import(pathToFileURL(driverPath).href);
    const client = new pg.default.Client({ connectionString: connection });
    await client.connect();
    try {
      observed = await liveReads(client, schema);
    } finally {
      await client.end().catch(() => {});
    }
  } catch (error) {
    receipt.reasonCode = "PG_CHAIN_UNREACHABLE";
    receipt.error = String(error?.message ?? error).slice(0, 300);
    receipt.note = "probed:false — this run did not observe the PG chain, and a check that could not run is not a check that passed";
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
    process.exitCode = 1;
    return;
  }
  receipt.probed = true;
  receipt.observed = observed;
  receipt.expected = expected;
  receipt.expectedSource = expectedSource;

  const chainContinuityOk = observed.continuityViolations === 0;
  receipt.chainContinuityOk = chainContinuityOk;
  if (!chainContinuityOk) {
    receipt.reasonCode = "CHAIN_CONTINUITY_BROKEN";
  } else if (expected) {
    const differences = Object.entries({
      eventsCount: [observed.eventsCount, expected.eventsCount],
      headEventHash: [observed.headEventHash, expected.headEventHash],
      eventsDigest: [observed.eventsDigest, expected.eventsDigest],
      metadataSha256: [observed.metadataSha256, expected.metadataSha256],
      knowledgeMarkerSha256: [observed.knowledgeMarkerSha256, expected.knowledgeMarkerSha256],
      artifactMarkerSha256: [observed.artifactMarkerSha256, expected.artifactMarkerSha256]
    })
      .filter(([, [actual, want]]) => (actual ?? null) !== (want ?? null))
      .map(([name]) => name);
    receipt.differences = differences;
    receipt.reasonCode = differences.length === 0 ? "CHAIN_MATCHES_EXPECTED" : "CHAIN_DIFFERS_FROM_EXPECTED";
  } else {
    receipt.reasonCode = "CHAIN_READ_REPORTED";
  }
  receipt.ok = receipt.reasonCode === "CHAIN_MATCHES_EXPECTED";
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  if (!receipt.ok) process.exitCode = 1;
}

await main();
