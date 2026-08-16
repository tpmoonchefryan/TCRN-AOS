#!/usr/bin/env node
// TCRN-CROSS-INIT-020 INC-096 — one-shot, read-only export of the sealed
// file-backed event window.  The live PG facade is deliberately not used here:
// INC-096 exists because the earlier archive-window artifact exported the PG
// projection instead of the retained file track.
//
// The VM is read through `ssh host cat <one declared file>`.  No engine command
// is invoked and no remote path is opened for writing.  The selected event bytes
// are sliced from the returned segment bytes without JSON re-serialisation; the
// per-event digest therefore vouches for the exact bytes that were read.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { VM_HOST } from "../deploy/aos-resident-cockpit/manifest.mjs";
import { aosPartition } from "../deploy/aos-local-client/aos-partitions.mjs";

export const FIRST_SEQUENCE = 2106;
export const LAST_SEQUENCE = 2122;
export const EXPECTED_HEAD_EVENT_HASH = "ad2a7c9ba7fc38f0e51a3800c8dbd6535f3c52fd6d351cea9de235077200154e";
export const EXPECTED_SEGMENTS = Object.freeze(["000033.json", "000034.json"]);
export const SCHEMA_VERSION = "aos.inc096.file-track-byte-export.v1";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const json = (value) => JSON.stringify(value, null, 2) + "\n";

function skipWhitespace(bytes, cursor) {
  let index = cursor;
  while (index < bytes.length && (bytes[index] === 0x20 || bytes[index] === 0x09 || bytes[index] === 0x0a || bytes[index] === 0x0d)) {
    index += 1;
  }
  return index;
}

/**
 * Return the raw top-level values in a JSON array.  JSON.parse is still used to
 * validate each slice, but never to produce the exported bytes.
 */
export function extractJsonArrayElements(bytes) {
  const input = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  let cursor = skipWhitespace(input, 0);
  if (input[cursor] !== 0x5b) throw new Error("FILE_TRACK_SEGMENT_NOT_ARRAY");
  cursor = skipWhitespace(input, cursor + 1);
  const elements = [];

  while (cursor < input.length && input[cursor] !== 0x5d) {
    const start = cursor;
    let objectDepth = 0;
    let arrayDepth = 0;
    let inString = false;
    let escaped = false;
    let end = -1;

    for (; cursor < input.length; cursor += 1) {
      const byte = input[cursor];
      if (inString) {
        if (escaped) escaped = false;
        else if (byte === 0x5c) escaped = true;
        else if (byte === 0x22) inString = false;
        continue;
      }
      if (byte === 0x22) {
        inString = true;
        continue;
      }
      if (byte === 0x7b) objectDepth += 1;
      else if (byte === 0x7d) objectDepth -= 1;
      else if (byte === 0x5b) arrayDepth += 1;
      else if (byte === 0x5d) arrayDepth -= 1;
      if (objectDepth === 0 && arrayDepth === 0) {
        end = cursor + 1;
        break;
      }
    }

    if (end < 0 || inString || objectDepth !== 0 || arrayDepth !== 0) {
      throw new Error("FILE_TRACK_SEGMENT_MALFORMED_JSON");
    }
    const raw = input.subarray(start, end);
    let value;
    try {
      value = JSON.parse(raw.toString("utf8"));
    } catch {
      throw new Error("FILE_TRACK_EVENT_JSON_INVALID");
    }
    elements.push({ raw, value });
    cursor = skipWhitespace(input, end);
    if (input[cursor] === 0x2c) cursor = skipWhitespace(input, cursor + 1);
    else if (input[cursor] !== 0x5d) throw new Error("FILE_TRACK_SEGMENT_SEPARATOR_INVALID");
  }

  cursor = skipWhitespace(input, cursor);
  if (input[cursor] !== 0x5d || skipWhitespace(input, cursor + 1) !== input.length) {
    throw new Error("FILE_TRACK_SEGMENT_TRAILING_BYTES");
  }
  return elements;
}

export function selectWindow(segmentBytes, segmentPath, first = FIRST_SEQUENCE, last = LAST_SEQUENCE) {
  const selected = [];
  for (const { raw, value } of extractJsonArrayElements(segmentBytes)) {
    if (!Number.isSafeInteger(value?.sequence)) throw new Error("FILE_TRACK_EVENT_SEQUENCE_INVALID");
    if (value.sequence < first || value.sequence > last) continue;
    selected.push({
      sequence: value.sequence,
      raw,
      value,
      segmentPath,
    });
  }
  return selected;
}

function declaredCrossEventsRoot() {
  const partition = aosPartition("cross-project");
  return join(partition.workspace, ".tcrn-workflow", "events");
}

function remoteRead(remotePath) {
  const result = spawnSync("ssh", [
    "-o", "BatchMode=yes",
    "-o", "ConnectTimeout=10",
    VM_HOST,
    "cat",
    remotePath,
  ], { encoding: null, maxBuffer: 64 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = Buffer.from(result.stderr ?? "").toString("utf8").trim().slice(0, 400);
    throw new Error(`FILE_TRACK_REMOTE_READ_FAILED${detail ? `: ${detail}` : ""}`);
  }
  return Buffer.from(result.stdout ?? "");
}

function parseOption(name, argv) {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] : undefined;
}

function segmentDescriptor(segmentPath, bytes) {
  return {
    logicalPath: relative("/srv/tcrn/governance/tcrn-workspace", segmentPath),
    bytes: bytes.byteLength,
    sha256: sha256(bytes),
  };
}

export function buildManifest({ reason, segments, events }) {
  const ordered = [...events].sort((left, right) => left.sequence - right.sequence);
  const first = ordered[0]?.value;
  const last = ordered.at(-1)?.value;
  const contiguous = ordered.length === LAST_SEQUENCE - FIRST_SEQUENCE + 1
    && ordered.every((entry, index) => entry.sequence === FIRST_SEQUENCE + index)
    && ordered.every((entry, index) => index === 0 || entry.value.priorHash === ordered[index - 1].value.eventHash);
  return {
    schemaVersion: SCHEMA_VERSION,
    purpose: "INC-096 exact bytes from the retained cross-project file track, not the PG authority",
    readReason: reason,
    source: {
      partition: "cross-project",
      track: "sealed file archive",
      transport: "ssh read-only cat",
      segments: segments.map((entry) => segmentDescriptor(entry.path, entry.bytes)),
      authorityBoundary: "The VM file bytes are evidence only; no write or migration is performed.",
    },
    window: {
      firstSequence: FIRST_SEQUENCE,
      lastSequence: LAST_SEQUENCE,
      eventCount: ordered.length,
      previousSequence: FIRST_SEQUENCE - 1,
      previousEventHash: first?.priorHash ?? null,
      sealedHeadEventHash: last?.eventHash ?? null,
      expectedSealedHeadEventHash: EXPECTED_HEAD_EVENT_HASH,
    },
    events: ordered.map((entry) => ({
      sequence: entry.sequence,
      path: `events/${entry.sequence}.json`,
      bytes: entry.raw.byteLength,
      sha256: sha256(entry.raw),
      eventHash: entry.value.eventHash ?? null,
      payloadHash: entry.value.payloadHash ?? null,
      priorHash: entry.value.priorHash ?? null,
      operation: entry.value.payload?.operation ?? null,
    })),
    integrity: {
      exactEventBytes: true,
      extractedWithoutReserialisation: true,
      segmentsReadFromDeclaredPaths: segments.length === EXPECTED_SEGMENTS.length,
      sequencesContiguous: contiguous,
      headMatchesExpected: last?.eventHash === EXPECTED_HEAD_EVENT_HASH,
      byteDigestsAreFullSha256: true,
    },
  };
}

function assertManifestShape(manifest) {
  if (manifest?.schemaVersion !== SCHEMA_VERSION) throw new Error("FILE_TRACK_MANIFEST_SCHEMA_INVALID");
  if (manifest?.window?.firstSequence !== FIRST_SEQUENCE || manifest?.window?.lastSequence !== LAST_SEQUENCE) {
    throw new Error("FILE_TRACK_WINDOW_INVALID");
  }
  if (manifest?.integrity?.exactEventBytes !== true || manifest?.integrity?.extractedWithoutReserialisation !== true) {
    throw new Error("FILE_TRACK_BYTE_PROVENANCE_INVALID");
  }
  if (!Array.isArray(manifest.events) || manifest.events.length !== LAST_SEQUENCE - FIRST_SEQUENCE + 1) {
    throw new Error("FILE_TRACK_EVENT_COUNT_INVALID");
  }
}

export function verifyManifest(manifestPath) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  assertManifestShape(manifest);
  const root = resolve(manifestPath, "..");
  const previous = new Map();
  let previousEventHash = null;
  for (const entry of manifest.events) {
    const path = resolve(root, entry.path);
    const relativePath = relative(root, path);
    if (!relativePath.startsWith("events/") || relativePath.includes("..")) throw new Error("FILE_TRACK_EVENT_PATH_INVALID");
    const bytes = readFileSync(path);
    if (bytes.byteLength !== entry.bytes || sha256(bytes) !== entry.sha256) {
      throw new Error(`FILE_TRACK_EVENT_DIGEST_MISMATCH:${entry.sequence}`);
    }
    let value;
    try { value = JSON.parse(bytes.toString("utf8")); }
    catch { throw new Error(`FILE_TRACK_EVENT_JSON_INVALID:${entry.sequence}`); }
    if (value.sequence !== entry.sequence) throw new Error(`FILE_TRACK_EVENT_SEQUENCE_MISMATCH:${entry.sequence}`);
    if (entry.sequence !== FIRST_SEQUENCE + previous.size) throw new Error("FILE_TRACK_SEQUENCE_NONCONTIGUOUS");
    if (previousEventHash !== null && value.priorHash !== previousEventHash) throw new Error("FILE_TRACK_CHAIN_NONCONTIGUOUS");
    previous.set(entry.sequence, value.eventHash);
    previousEventHash = value.eventHash;
  }
  if (previousEventHash !== EXPECTED_HEAD_EVENT_HASH) throw new Error("FILE_TRACK_HEAD_MISMATCH");
  return {
    ok: true,
    reasonCode: "INC096_FILE_TRACK_BYTES_VERIFIED",
    eventCount: manifest.events.length,
    firstSequence: FIRST_SEQUENCE,
    lastSequence: LAST_SEQUENCE,
    headEventHash: previousEventHash,
  };
}

function exportWindow({ output, reason }) {
  if (existsSync(output)) throw new Error(`FILE_TRACK_OUTPUT_EXISTS:${output}`);
  const eventsRoot = declaredCrossEventsRoot();
  const segments = EXPECTED_SEGMENTS.map((name) => ({
    name,
    path: join(eventsRoot, name),
    bytes: remoteRead(join(eventsRoot, name)),
  }));
  const events = segments.flatMap((segment) => selectWindow(segment.bytes, segment.path));
  const unique = new Map(events.map((entry) => [entry.sequence, entry]));
  const ordered = [...unique.values()].sort((left, right) => left.sequence - right.sequence);
  if (ordered.length !== LAST_SEQUENCE - FIRST_SEQUENCE + 1) throw new Error("FILE_TRACK_WINDOW_NOT_COMPLETE");
  const outputRoot = resolve(output);
  mkdirSync(join(outputRoot, "events"), { recursive: true });
  for (const entry of ordered) writeFileSync(join(outputRoot, "events", `${entry.sequence}.json`), entry.raw, { flag: "wx" });
  const manifest = buildManifest({ reason, segments, events: ordered });
  writeFileSync(join(outputRoot, "manifest.json"), json(manifest), { flag: "wx" });
  return verifyManifest(join(outputRoot, "manifest.json"));
}

const argv = process.argv.slice(2);
if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  try {
    if (argv.includes("--verify")) {
      const path = parseOption("verify", argv);
      if (!path) throw new Error("usage: --verify <manifest.json>");
      process.stdout.write(`${json(verifyManifest(resolve(path)))}`);
    } else {
      const output = parseOption("output", argv);
      const reason = parseOption("reason", argv);
      if (!output || !reason) throw new Error("usage: --output <directory> --reason <documented reason>");
      process.stdout.write(`${json(exportWindow({ output, reason }))}`);
    }
  } catch (error) {
    process.stderr.write(`${error?.message ?? error}\n`);
    process.exitCode = 1;
  }
}
