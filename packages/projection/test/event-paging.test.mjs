import test from "node:test";
import assert from "node:assert/strict";
import {
  assembleEventPages,
  readAllEvents,
  EventPagingError,
  EVENT_PAGE_OVERSIZED
} from "../../../dist/packages/projection/src/index.js";

/**
 * The paged-read assembly judged on synthetic input (STORY-114).
 *
 * These tests need no chain and no engine on purpose: what is under test is the
 * ASSEMBLY of pages into a stream, and the whole point of the assertions is that
 * they must fail on a stream that was assembled wrong. A test that could only run
 * against a real, correct chain could never present a wrong assembly, so it could
 * only ever observe green — the "predicate whose two sides cannot differ" shape
 * this platform has now paid for three times.
 *
 * Hash values here are fixtures, not derived digests. Nothing in this file claims
 * hash linkage is valid; that judgment belongs to the engine's `validateEventChain`
 * inside `EventMirrorStore.ingest`, and is exercised in event-mirror.test.mjs
 * against a genuinely engine-built chain.
 */

/**
 * `assert.throws` returns undefined, so it cannot hand back the error whose
 * fields these tests need to inspect. Capturing it here keeps the assertions on
 * the reason code AND its detail — a red that only proves "something threw"
 * would not distinguish a caught mutation from a typo in the test.
 */
function captureThrow(fn) {
  try {
    fn();
  } catch (error) {
    return error;
  }
  assert.fail("expected the assembly to refuse, but it returned");
}

const ANCHOR_WORKSPACE = "workspace:paging-test";
const hashFor = (sequence) => String(sequence).padStart(2, "0").repeat(32);

function makeEvent(sequence) {
  return {
    schemaVersion: "tcrn.event.v1",
    id: `event:paging-${sequence}`,
    streamId: "stream:paging-test",
    sequence,
    occurredAt: "2026-07-29T00:00:00Z",
    priorHash: sequence === 1 ? null : hashFor(sequence - 1),
    payload: { operation: "test.noop", record: { sequence } },
    payloadHash: hashFor(sequence),
    eventHash: hashFor(sequence)
  };
}

/** A whole synthetic chain of `total` events plus the status anchor that describes it. */
function makeChain(total) {
  const events = Array.from({ length: total }, (unused, index) => makeEvent(index + 1));
  return {
    events,
    anchor: {
      workspaceId: ANCHOR_WORKSPACE,
      version: total,
      headEventHash: events.at(-1).eventHash
    }
  };
}

function makePage(chain, limit, offset) {
  const records = chain.events.slice(offset, offset + limit);
  return {
    reasonCode: "WORKSPACE_LIST_READY",
    workspaceId: chain.anchor.workspaceId,
    version: chain.anchor.version,
    headEventHash: chain.anchor.headEventHash,
    kind: "event",
    total: chain.anchor.version,
    truncated: offset + records.length < chain.anchor.version,
    records
  };
}

/** Split a chain into the pages a `limit`-wide paged read would produce. */
function pageChain(chain, limit) {
  const pages = [];
  for (let offset = 0; offset < chain.anchor.version; offset += limit) {
    pages.push(makePage(chain, limit, offset));
  }
  return pages;
}

test("assembleEventPages accepts a complete, correctly ordered page set", () => {
  const chain = makeChain(37);
  const { events, assertions } = assembleEventPages(pageChain(chain, 8), chain.anchor);
  assert.equal(events.length, 37);
  assert.equal(events.at(-1).eventHash, chain.anchor.headEventHash);
  assert.deepEqual(assertions.map((entry) => entry.name), [
    "every-page-matches-anchor",
    "assembled-count-equals-chain-version",
    "sequences-contiguous-1-to-n",
    "tail-eventHash-equals-chain-head"
  ]);
  // The head assertion must record that it compared FULL digests, never a prefix.
  const head = assertions.find((entry) => entry.name === "tail-eventHash-equals-chain-head");
  assert.equal(head.detail.comparedChars, 64);
});

// ---- the deliberate red: a dropped middle page ----------------------------
// The mutation is the one a paged reader actually suffers — one page lost in
// the middle, every remaining page individually well-formed. Nothing about a
// single page reveals it; only the assembly does.
test("dropping a middle page turns the assembly red (EVENT_PAGING_COUNT_MISMATCH)", () => {
  const chain = makeChain(37);
  const pages = pageChain(chain, 8);
  const mutated = pages.filter((unused, index) => index !== 2);
  assert.equal(mutated.length, pages.length - 1);
  const error = captureThrow(() => assembleEventPages(mutated, chain.anchor));
  assert.ok(error instanceof EventPagingError);
  assert.equal(error.reasonCode, "EVENT_PAGING_COUNT_MISMATCH");
  assert.equal(error.detail.assembled, 29);
  assert.equal(error.detail.version, 37);
});

// Same mutation, count restored: a dropped page whose absence is masked by a
// repeated one. The count check cannot see it; contiguity can.
test("a dropped page masked by a repeated page is caught by contiguity", () => {
  const chain = makeChain(37);
  const pages = pageChain(chain, 8);
  const mutated = [pages[0], pages[1], pages[1], pages[3], pages[4]];
  assert.equal(mutated.flatMap((page) => page.records).length, chain.anchor.version);
  const error = captureThrow(() => assembleEventPages(mutated, chain.anchor));
  assert.ok(error instanceof EventPagingError);
  assert.equal(error.reasonCode, "EVENT_PAGING_SEQUENCE_GAP");
  assert.equal(error.detail.position, 17);
  assert.equal(error.detail.expected, 17);
  assert.equal(error.detail.received, 9);
});

test("a truncated tail is caught as a head mismatch when the count is forced to agree", () => {
  const chain = makeChain(16);
  const pages = pageChain(chain, 8);
  // Drop the last event and duplicate an earlier sequence at the end, so the
  // count still equals version and only the head comparison can object.
  const lastPage = pages[1];
  const mutated = [pages[0], {
    ...lastPage,
    records: [...lastPage.records.slice(0, -1), { ...makeEvent(9), sequence: 16 }]
  }];
  const error = captureThrow(() => assembleEventPages(mutated, chain.anchor));
  assert.ok(error instanceof EventPagingError);
  assert.equal(error.reasonCode, "EVENT_PAGING_HEAD_MISMATCH");
  assert.equal(error.detail.headEventHash, chain.anchor.headEventHash);
  assert.notEqual(error.detail.tailEventHash, chain.anchor.headEventHash);
});

test("a page from a chain that moved mid-read is refused before stitching", () => {
  const chain = makeChain(16);
  const pages = pageChain(chain, 8);
  const mutated = [pages[0], { ...pages[1], version: 17, headEventHash: hashFor(17) }];
  const error = captureThrow(() => assembleEventPages(mutated, chain.anchor));
  assert.ok(error instanceof EventPagingError);
  assert.equal(error.reasonCode, "EVENT_PAGING_ANCHOR_MOVED");
  assert.equal(error.detail.drifted.length, 1);
});

test("an event-list total that disagrees with status version is its own red", () => {
  const chain = makeChain(16);
  const pages = pageChain(chain, 8).map((page) => ({ ...page, total: 15 }));
  const error = captureThrow(() => assembleEventPages(pages, chain.anchor));
  assert.ok(error instanceof EventPagingError);
  assert.equal(error.reasonCode, "EVENT_PAGING_TOTAL_DISAGREES_WITH_VERSION");
});

test("an empty page set is refused rather than read as an empty chain", () => {
  const chain = makeChain(4);
  const error = captureThrow(() => assembleEventPages([], chain.anchor));
  assert.ok(error instanceof EventPagingError);
  assert.equal(error.reasonCode, "EVENT_PAGING_NO_PAGES");
});

// ---- the paging loop -------------------------------------------------------

test("readAllEvents walks the whole chain and records the windows it used", async () => {
  const chain = makeChain(37);
  const seen = [];
  const { events, proof } = await readAllEvents({
    anchor: chain.anchor,
    initialLimit: 8,
    read: async (limit, offset) => {
      seen.push([limit, offset]);
      return makePage(chain, limit, offset);
    }
  });
  assert.equal(events.length, 37);
  assert.deepEqual(seen, [[8, 0], [8, 8], [8, 16], [8, 24], [8, 32]]);
  assert.deepEqual(proof.windowsUsed, [8]);
  assert.equal(proof.pages, 5);
  assert.equal(proof.oversizedRefusals, 0);
  assert.equal(proof.assertions.length, 4);
});

test("CLI_EVENT_PAGE_OVERSIZED halves the window and retries the same offset", async () => {
  const chain = makeChain(20);
  const attempts = [];
  const { events, proof } = await readAllEvents({
    anchor: chain.anchor,
    initialLimit: 8,
    read: async (limit, offset) => {
      attempts.push([limit, offset]);
      // A fat region: offsets 8 and up refuse anything wider than 2 events, so
      // the window has to halve TWICE at the same offset before it gets through.
      if (offset >= 8 && limit > 2) {
        const error = new Error(`${EVENT_PAGE_OVERSIZED}: page too large`);
        error.reasonCode = EVENT_PAGE_OVERSIZED;
        throw error;
      }
      return makePage(chain, limit, offset);
    }
  });
  assert.equal(events.length, 20);
  assert.equal(proof.oversizedRefusals, 2);
  assert.deepEqual(attempts, [
    [8, 0], [8, 8], [4, 8], [2, 8], [2, 10], [2, 12], [2, 14], [2, 16], [2, 18]
  ]);
  assert.deepEqual(proof.windowsUsed, [2, 8]);
  assert.equal(proof.finalLimit, 2);
  const refusals = proof.windowSteps.filter((step) => step.outcome === "oversized");
  assert.deepEqual(refusals.map((step) => step.limit), [8, 4]);
  assert.ok(refusals.every((step) => step.reasonCode === EVENT_PAGE_OVERSIZED));
});

test("a reason code that is not the oversize refusal propagates untouched", async () => {
  const chain = makeChain(8);
  await assert.rejects(() => readAllEvents({
    anchor: chain.anchor,
    initialLimit: 4,
    read: async () => {
      const failure = new Error("WORKSPACE_VIEW_STALE: the view moved");
      failure.reasonCode = "WORKSPACE_VIEW_STALE";
      throw failure;
    }
    // Not an EventPagingError, and not re-wrapped as one: the engine's own code
    // must reach the caller, or "try a smaller window" becomes the answer to
    // every failure the chain can have.
  }), (error) => error.reasonCode === "WORKSPACE_VIEW_STALE" && error.name !== "EventPagingError");
});

test("a single event that cannot fit even the floor window is a named failure", async () => {
  const chain = makeChain(8);
  await assert.rejects(() => readAllEvents({
    anchor: chain.anchor,
    initialLimit: 4,
    minLimit: 2,
    read: async () => {
      const failure = new Error("page too large");
      failure.reasonCode = EVENT_PAGE_OVERSIZED;
      throw failure;
    }
  }), { reasonCode: "EVENT_PAGING_WINDOW_FLOOR_REACHED" });
});

test("a zero-record page short of the end is refused, not read as the end", async () => {
  const chain = makeChain(8);
  await assert.rejects(() => readAllEvents({
    anchor: chain.anchor,
    initialLimit: 4,
    read: async (limit, offset) => (offset === 4
      ? { ...makePage(chain, limit, offset), records: [] }
      : makePage(chain, limit, offset))
  }), { reasonCode: "EVENT_PAGING_EMPTY_PAGE" });
});

// ---- the chunk-boundary decode regression ---------------------------------
// Found by this wiring, on the live chain, not by inspection: a 64-event
// event-list page came back with one 的 turned into U+FFFD, and the engine's
// validateEventChain refused the chain as EVENT_CHAIN_CORRUPT because the
// payload no longer hashed to its recorded payloadHash. The cause was
// ChainClient decoding each stdout chunk in isolation; Node splits a pipe read
// at 64 KiB with no regard for character boundaries.
//
// The control assertion below is the part that matters: it proves the fixture
// split really does straddle a multi-byte character, so this test CAN go red.
// Without it, a split that happened to land on a boundary would make the whole
// case pass for the wrong reason.
test("ChainClient reassembles a multi-byte character split across stdout chunks", async () => {
  const { ChainClient } = await import("../../../dist/packages/projection/src/index.js");
  const { mkdtemp, rm, writeFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");

  const text = `设计交付对账:被让掉的屏内深度补回${"—".repeat(40)}结束`;
  const directory = await mkdtemp(join(tmpdir(), "tcrn-aos-chunk-"));
  const serverPath = join(directory, "split-stdout-server.mjs");
  // A minimal MCP stub that answers tools/call, then writes its reply as two
  // raw buffers split at a byte index chosen to fall INSIDE a character.
  await writeFile(serverPath, `
const payload = ${JSON.stringify(text)};
const reply = (id, result) => {
  const line = Buffer.from(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\\n", "utf8");
  const split = ${JSON.stringify(text)}.length > 0 ? findSplit(line) : 1;
  process.stdout.write(line.subarray(0, split));
  setTimeout(() => process.stdout.write(line.subarray(split)), 5);
};
// Split one byte after the first lead byte of the first multi-byte character.
function findSplit(line) {
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] >= 0xc0) return index + 1;
  }
  return 1;
}
let buffer = "";
process.stdin.on("data", (chunk) => {
  buffer += chunk.toString("utf8");
  let newline;
  while ((newline = buffer.indexOf("\\n")) >= 0) {
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (!line) continue;
    const message = JSON.parse(line);
    if (message.method === "initialize") reply(message.id, { protocolVersion: "2024-11-05" });
    if (message.method === "tools/call") {
      reply(message.id, { content: [{ type: "text", text: JSON.stringify({ reasonCode: "STUB_OK", payload }) }] });
    }
  }
});
`, "utf8");

  const client = new ChainClient({ serverPath, timeoutMs: 15_000 });
  try {
    const result = await client.callTool("tcrn_workflow_status", {});
    assert.equal(result.payload, text);
    assert.ok(!result.payload.includes("�"));
  } finally {
    await client.stop();
    await rm(directory, { recursive: true, force: true });
  }

  // Control: the same split, decoded the old way (per chunk, independently),
  // MUST produce the replacement character. If this ever stops holding, the
  // fixture no longer reproduces the bug and the case above proves nothing.
  const line = Buffer.from(JSON.stringify({ payload: text }), "utf8");
  let split = 1;
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] >= 0xc0) { split = index + 1; break; }
  }
  const naive = line.subarray(0, split).toString("utf8") + line.subarray(split).toString("utf8");
  assert.ok(naive.includes("�"), "fixture split does not straddle a multi-byte character");
});
