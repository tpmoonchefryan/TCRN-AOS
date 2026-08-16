import test from "node:test";
import assert from "node:assert/strict";
import { buildManifest, extractJsonArrayElements, selectWindow, verifyManifest, FIRST_SEQUENCE, LAST_SEQUENCE, EXPECTED_HEAD_EVENT_HASH, SCHEMA_VERSION } from "./inc096-file-track-export.mjs";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const event = (sequence, priorHash, eventHash) => ({
  sequence,
  eventHash,
  payloadHash: digest(Buffer.from(`payload-${sequence}`)),
  priorHash,
  payload: { operation: "work.annotated", record: { sequence } },
});

test("extractJsonArrayElements preserves raw nested JSON bytes", () => {
  const source = Buffer.from('[ {"sequence":2106,"payload":{"text":"brace } and [ bracket"}}, {"sequence":2122,"eventHash":"tail"} ]');
  const elements = extractJsonArrayElements(source);
  assert.equal(elements.length, 2);
  assert.equal(elements[0].raw.toString("utf8"), '{"sequence":2106,"payload":{"text":"brace } and [ bracket"}}');
  assert.equal(elements[1].value.sequence, 2122);
});

test("selectWindow selects only the named file-track window", () => {
  const first = event(2105, "prior", "h2105");
  const second = event(2106, first.eventHash, "h2106");
  const tail = event(2122, "h2121", EXPECTED_HEAD_EVENT_HASH);
  const selected = selectWindow(Buffer.from(JSON.stringify([first, second, tail])), "events/000033.json");
  assert.deepEqual(selected.map((entry) => entry.sequence), [2106, 2122]);
});

test("verifyManifest catches a one-byte mutation in an exported event", () => {
  const root = mkdtempSync(join(tmpdir(), "inc096-export-"));
  const eventsRoot = join(root, "events");
  mkdirSync(eventsRoot);
  const entries = [];
  let prior = "fork";
  for (let sequence = FIRST_SEQUENCE; sequence <= LAST_SEQUENCE; sequence += 1) {
    const eventHash = sequence === LAST_SEQUENCE ? EXPECTED_HEAD_EVENT_HASH : `hash-${sequence}`;
    const value = event(sequence, prior, eventHash);
    const bytes = Buffer.from(JSON.stringify(value));
    const path = join(eventsRoot, `${sequence}.json`);
    writeFileSync(path, bytes);
    entries.push({ sequence, path: `events/${sequence}.json`, bytes: bytes.byteLength, sha256: digest(bytes) });
    prior = eventHash;
  }
  writeFileSync(join(root, "manifest.json"), JSON.stringify({
    schemaVersion: SCHEMA_VERSION,
    window: { firstSequence: FIRST_SEQUENCE, lastSequence: LAST_SEQUENCE },
    integrity: { exactEventBytes: true, extractedWithoutReserialisation: true },
    events: entries,
  }));
  assert.equal(verifyManifest(join(root, "manifest.json")).reasonCode, "INC096_FILE_TRACK_BYTES_VERIFIED");
  const lastPath = join(eventsRoot, `${LAST_SEQUENCE}.json`);
  const mutated = readFileSync(lastPath);
  mutated[mutated.length - 2] ^= 1;
  writeFileSync(lastPath, mutated);
  assert.throws(() => verifyManifest(join(root, "manifest.json")), /FILE_TRACK_EVENT_DIGEST_MISMATCH:2122/u);
});
