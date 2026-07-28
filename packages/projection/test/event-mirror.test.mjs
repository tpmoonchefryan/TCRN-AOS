import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";
import {
  EventMirrorStore,
  EventMirrorError,
  loadEngineProtocol
} from "../../../dist/packages/projection/src/index.js";

/**
 * The O3 row mirror (STORY-114), tested against the engine's own protocol.
 *
 * These tests do not fabricate hash rules: the chain under test is BUILT by
 * the governed engine's `createEvent` and judged by its `validateEventChain`,
 * both imported read-only from the installed governed copy. If that copy is
 * missing, the import fails and the suite goes red — a missing judge is a
 * failure, not a skip, because a skipped verification reads as a green one.
 */

const protocolModule = await import(pathToFileURL(
  resolve(homedir(), ".tcrn-workflow/tcrn-workflow/dist/build/packages/protocol/src/index.js")
).href);
const protocol = await loadEngineProtocol();

/** A real, engine-built chain of `length` events for one stream. */
function buildChain(length, { streamId = "workspace:mirror-test", payloadFor } = {}) {
  const events = [];
  let priorHash = null;
  for (let sequence = 1; sequence <= length; sequence += 1) {
    const event = protocolModule.createEvent({
      id: `event:mirror-${sequence}`,
      streamId,
      sequence,
      occurredAt: "2026-07-28T00:00:00Z",
      priorHash,
      payload: payloadFor
        ? payloadFor(sequence)
        : { operation: "work.updated", record: { id: `work:${sequence}` } }
    });
    events.push(event);
    priorHash = event.eventHash;
  }
  return events;
}

test("a missing governed copy is a named failure with the cause preserved, never a bare import error", async () => {
  await assert.rejects(
    loadEngineProtocol(join(tmpdir(), "aos-no-such-governed-copy")),
    (error) => error instanceof EventMirrorError
      && error.reasonCode === "EVENT_MIRROR_PROTOCOL_UNAVAILABLE"
      && error.cause !== undefined
      && error.cause !== null
  );
});

test("the loaded protocol names the governed copy's version, so the judge is identifiable", () => {
  // Read the same manifest independently: the assertion's two sides come from
  // different readers of the same installed copy, not from the module twice.
  const manifest = JSON.parse(readFileSync(
    resolve(homedir(), ".tcrn-workflow/tcrn-workflow/package.json"), "utf8"));
  assert.equal(typeof manifest.version, "string");
  assert.equal(protocol.engineVersion, manifest.version);
});

test("ingest mirrors every event row with its hash columns and engine-canonical bytes", () => {
  const store = new EventMirrorStore();
  try {
    const chain = buildChain(3);
    const appended = store.ingest("TCRN-AOS", 3, chain, protocol);
    assert.equal(appended, 3);

    const rows = store.listRows("TCRN-AOS");
    assert.equal(rows.length, 3);
    for (const [index, row] of rows.entries()) {
      const event = chain[index];
      assert.equal(row.sequence, event.sequence);
      assert.equal(row.eventId, event.id);
      assert.equal(row.priorHash, event.priorHash);
      assert.equal(row.payloadHash, event.payloadHash);
      assert.equal(row.eventHash, event.eventHash);
      assert.equal(row.chainVersion, 3);
      // The canonical bytes are the ENGINE's serialization of the event — this
      // package never invents a second canonical form.
      assert.equal(row.canonicalJson, protocolModule.canonicalJson(event));
    }
    // Genesis mirrors the chain's own rule: null prior exactly at sequence 1.
    assert.equal(rows[0].priorHash, null);
    assert.notEqual(rows[1].priorHash, null);

    // Self-verification replays the stored bytes through the engine validator.
    assert.deepEqual(store.verify("TCRN-AOS", protocol), { ok: true, events: 3 });
  } finally {
    store.close();
  }
});

test("re-ingest at a later chain version appends new rows and leaves held rows byte-identical", () => {
  const store = new EventMirrorStore();
  try {
    const chain = buildChain(5);
    assert.equal(store.ingest("TCRN-AOS", 3, chain.slice(0, 3), protocol), 3);
    const heldBefore = store.listRows("TCRN-AOS");

    // The full chain again, two events longer, at a later version.
    assert.equal(store.ingest("TCRN-AOS", 5, chain, protocol), 2);
    const rows = store.listRows("TCRN-AOS");
    assert.equal(rows.length, 5);
    // Version keying: old rows keep the version that ingested them; only the
    // appended rows carry the new one.
    assert.deepEqual(rows.map((row) => row.chainVersion), [3, 3, 3, 5, 5]);
    assert.deepEqual(rows.slice(0, 3), heldBefore, "held rows must not be rewritten");

    // Idempotent at the same head: nothing to append, nothing changed.
    assert.equal(store.ingest("TCRN-AOS", 5, chain, protocol), 0);
  } finally {
    store.close();
  }
});

test("a divergent overlap is refused as a finding, never repaired by overwrite", () => {
  const store = new EventMirrorStore();
  try {
    store.ingest("TCRN-AOS", 2, buildChain(2), protocol);
    // A different (still internally valid) history for the same partition.
    const divergent = buildChain(2, { payloadFor: (sequence) => ({ operation: "work.updated", record: { id: `work:other-${sequence}` } }) });
    assert.throws(
      () => store.ingest("TCRN-AOS", 2, divergent, protocol),
      (error) => error instanceof EventMirrorError && error.reasonCode === "EVENT_MIRROR_DIVERGENCE"
    );
    // And a shrunken chain is its own named refusal.
    assert.throws(
      () => store.ingest("TCRN-AOS", 2, buildChain(1), protocol),
      (error) => error instanceof EventMirrorError && error.reasonCode === "EVENT_MIRROR_CHAIN_SHRANK"
    );
    assert.equal(store.listRows("TCRN-AOS").length, 2, "refusals must leave the mirror untouched");
  } finally {
    store.close();
  }
});

test("a tampered event is rejected by the engine validator before any row is written", () => {
  const store = new EventMirrorStore();
  try {
    const chain = buildChain(3);
    // Flip one payload after hashing: the engine's own validation must catch
    // it — this package performs no hash checking of its own to catch it with.
    const tampered = chain.map((event, index) => index === 1
      ? { ...event, payload: { operation: "work.updated", record: { id: "work:forged" } } }
      : event);
    assert.throws(() => store.ingest("TCRN-AOS", 3, tampered, protocol));
    assert.equal(store.listRows("TCRN-AOS").length, 0);
  } finally {
    store.close();
  }
});

test("the mirror is append-only: UPDATE and DELETE are rejected by the triggers", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "aos-event-mirror-test-"));
  try {
    const path = join(scratch, "mirror.db");
    const store = new EventMirrorStore(path);
    try {
      store.ingest("TCRN-AOS", 2, buildChain(2), protocol);
    } finally {
      store.close();
    }

    const db = new DatabaseSync(path);
    try {
      const before = db.prepare("SELECT * FROM aos_event_mirror ORDER BY sequence").all();
      assert.equal(before.length, 2);
      // Both mutations against real rows — the matrix R1 A-side touchstone:
      // the predicate's red side is exercised, not assumed.
      assert.throws(
        () => db.exec("UPDATE aos_event_mirror SET event_hash = 'tampered'"),
        /aos_event_mirror_append_only_update_denied/u
      );
      assert.throws(
        () => db.exec("DELETE FROM aos_event_mirror"),
        /aos_event_mirror_append_only_delete_denied/u
      );
      const after = db.prepare("SELECT * FROM aos_event_mirror ORDER BY sequence").all();
      assert.deepEqual(after, before, "rows must survive both attempts unchanged");
    } finally {
      db.close();
    }
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test("tampering with stored canonical bytes turns self-verification red", async () => {
  // The triggers protect the live database file; this proves the verification
  // itself would catch a mirror whose bytes were altered by any other means
  // (a copy, a different tool, a disk fault) — the instrument does not depend
  // on SQLite honouring the trigger to be able to tell truth from tampering.
  const scratch = await mkdtemp(join(tmpdir(), "aos-event-mirror-test-"));
  try {
    const path = join(scratch, "mirror.db");
    const store = new EventMirrorStore(path);
    try {
      store.ingest("TCRN-AOS", 2, buildChain(2), protocol);
      assert.deepEqual(store.verify("TCRN-AOS", protocol), { ok: true, events: 2 });
    } finally {
      store.close();
    }

    // Rebuild the file without triggers to simulate out-of-band tampering.
    const db = new DatabaseSync(path);
    try {
      db.exec("DROP TRIGGER aos_event_mirror_no_update");
      const forged = JSON.stringify({ forged: true });
      db.prepare("UPDATE aos_event_mirror SET canonical_json = ? WHERE sequence = 2").run(forged);
    } finally {
      db.close();
    }

    const reopened = new EventMirrorStore(path);
    try {
      assert.throws(() => reopened.verify("TCRN-AOS", protocol));
    } finally {
      reopened.close();
    }
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});
