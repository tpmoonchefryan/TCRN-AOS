import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

import {
  acquireQueueLock, appendQueue, assertQueueEntry, buildReplayPayload, isAttributedActor,
  readQueueFile, shadowQueueFile, writeQueueAtomic
} from "./fallback-cli.mjs";
import { RESERVED_FLAGS, catalogueIndex } from "./ceremony-plan.mjs";
import { AOS_PARTITIONS } from "./aos-partitions.mjs";

// The fallback queue's machinery (TCRN-CROSS-STORY-127), against scratch files.
//
// WHY THIS FILE EXISTS: the rewrite that added the cross-process lock, the atomic write,
// the fail-loud corrupt read, the entry validation and the catalogue-driven argv parse was
// reviewed by hand and works — and NOTHING in `pnpm verify` executed a line of it. Every
// one of those behaviours could regress with no gate going red, and each of them fails
// SILENTLY when it regresses: a lost append reports success, a swallowed corrupt read
// reports an empty backlog, a pairwise argv walk replays a different governed command.
// A behaviour whose failure mode is silence is the one that most needs a test.
//
// The discipline the neighbouring files are written to (MEMORY: 判据两侧必须能够不同)
// holds here: no refusal is asserted without the accepting case one field away from it,
// because "it threw" is not the claim — "it threw BECAUSE of that field" is.
//
// NO NETWORK, NO SSH, NO CHAIN, NO GOVERNED CONTAINER. Every queue lives in a
// `mkdtempSync` directory removed in a `finally`; the replay catalogue is a fixture built
// here rather than the host engine's live `commands` output. The only real paths this file
// touches are read-only ones it never writes to.

const MODULE_URL = new URL("./fallback-cli.mjs", import.meta.url).href;

/** A scratch queue directory, and the queue file inside it. Caller removes it. */
function scratch() {
  const directory = mkdtempSync(join(tmpdir(), "fallback-cli-test-"));
  return { directory, file: join(directory, "shadow-queue.json") };
}

const entryOf = (args, actor = "agent:claude-opus-5") => ({ verb: args[0], args, actor });

/**
 * A catalogue in the shape `catalogueIndex` produces from the host engine's own
 * `commands` output — built through the real indexer so the fixture cannot drift from
 * the shape `buildReplayPayload` actually consults.
 *
 * The VERB names are synthetic on purpose: naming a real verb here and giving it a flag
 * set of my choosing would be a claim about the host engine that nothing maintains
 * (「文档里的举例就是断言」). The FLAG names mirror the real ones the module's header
 * names — `--allow-stale` is the boolean whose pairwise mis-parse this catalogue exists
 * to prevent — because those are the shapes under test, not the vocabulary.
 *
 * `reserved` is derived from RESERVED_FLAGS rather than restated, so a fourth reserved
 * flag added later is declared by this fixture and exercised by the case below without
 * anyone remembering to edit two lists.
 */
const CATALOGUE = catalogueIndex([
  {
    name: "queued-verb",
    mutates: true,
    flags: [
      ...RESERVED_FLAGS.map((name) => ({ name, required: false, valueKind: "string" })),
      { name: "actor", required: false, valueKind: "string" },
      { name: "id", required: true, valueKind: "string" },
      { name: "note", required: false, valueKind: "string" },
      { name: "allow-stale", required: false, valueKind: "boolean" },
      { name: "allow-unpromoted", required: false, valueKind: "boolean" }
    ]
  },
  {
    // The 24 mutating verbs that declare no --actor: attribution cannot be emitted for
    // them, and the module must not emit it anyway (planStep refuses an undeclared flag).
    name: "unattributable-verb",
    mutates: true,
    flags: [
      { name: "id", required: true, valueKind: "string" },
      { name: "note", required: false, valueKind: "string" }
    ]
  }
]);

/** One queued argv through the whole payload build, for the parse cases. */
const stepFor = (args, actor) =>
  buildReplayPayload("cross-project", [entryOf(args, actor)], CATALOGUE).steps[0];

// --- the cross-process lock ------------------------------------------------------

test("eight concurrent appends all land: the lock serialises read-modify-write across PROCESSES", async () => {
  // The defect this closes, measured before the lock existed: eight concurrent appends to
  // one queue file kept ONE entry and all eight reported success. Atomic writes cannot fix
  // it — an append is a read-modify-write, so both writers read the same array and the
  // second rename wins. Only real child processes can show it: two appends inside one
  // process are already serialised by the event loop, so an in-process "concurrency" test
  // would pass against an implementation with no lock at all.
  //
  // Each child sleeps INSIDE its critical section, which widens the read-modify-write
  // window so the race is certain rather than lucky. Re-run with the acquireQueueLock call
  // removed from the child and the queue keeps one entry of eight (verified 2026-08-04).
  //
  // This case also proves the wait is not a no-op: with a zero wait, seven of the eight
  // children would exit non-zero on the contended lock instead of succeeding.
  const { directory, file } = scratch();
  const children = [];
  try {
    const childPath = join(directory, "append-child.mjs");
    writeFileSync(childPath, `
const [moduleUrl, file, tag, holdMs] = process.argv.slice(2);
const queueModule = await import(moduleUrl);
// This is appendQueue's body, composed from the same exported primitives, with the
// critical section widened. appendQueue itself derives its path from the partition id and
// can only ever write inside the platform's governed workspace container, so it is not
// callable from a test; what it composes is.
const release = queueModule.acquireQueueLock(file, { waitMs: 30000, pollMs: 5 });
try {
  const queue = queueModule.readQueueFile(file);
  queue.push(queueModule.assertQueueEntry(
    { verb: "queued-verb", args: ["queued-verb", "--id", \`work:\${tag}\`], actor: "agent:child", tag },
    \`child \${tag}\`));
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Number(holdMs));
  queueModule.writeQueueAtomic(file, queue);
} finally {
  release();
}
`);

    const exits = await Promise.all(Array.from({ length: 8 }, (_, tag) => new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [childPath, MODULE_URL, file, String(tag), "40"],
        { stdio: ["ignore", "ignore", "inherit"] });
      children.push(child);
      child.on("error", reject);
      child.on("exit", (code) => resolve(code));
    })));

    // A child that lost the race by REFUSING is a different failure from one that lost it
    // silently, and both must be excluded before the count below means anything.
    assert.deepEqual(exits, [0, 0, 0, 0, 0, 0, 0, 0], "every append must succeed, not refuse");

    const queue = readQueueFile(file);
    assert.equal(queue.length, 8, "eight appends, eight entries: none lost, none duplicated");
    assert.deepEqual(queue.map((row) => row.tag).sort(), ["0", "1", "2", "3", "4", "5", "6", "7"]);

    // The lock is released by every path, and the atomic write leaves nothing behind.
    assert.deepEqual(readdirSync(directory).filter((name) => name.endsWith(".json")),
      ["shadow-queue.json"]);
    assert.equal(existsSync(`${file}.lock`), false, "no child may leave the lock held");
  } finally {
    for (const child of children) child.kill("SIGKILL");
    rmSync(directory, { recursive: true, force: true });
  }
});

test("a lock held by a LIVE process is refused BY NAME at the deadline, never silently taken", () => {
  // No elapsed-time assertion anywhere here: the deadline is passed in explicitly and the
  // claim is the refusal, not how long it took to arrive.
  const { directory, file } = scratch();
  try {
    const release = acquireQueueLock(file, { waitMs: 0 });
    try {
      assert.throws(
        () => acquireQueueLock(file, { waitMs: 30, pollMs: 5 }),
        (error) => {
          assert.match(error.message, /shadow queue .* is locked by /u);
          assert.ok(error.message.includes(`${file}.lock`), "the refusal must name the lock file");
          assert.ok(error.message.includes(`pid ${process.pid}`), "and the holder that has it");
          assert.match(error.message, /held since /u);
          assert.match(error.message, /after 30ms/u);
          return true;
        });
    } finally {
      release();
    }

    // ONE field different — the lock is gone — and the same call succeeds. Without this the
    // refusal above could be about the path, the directory, or anything else.
    const second = acquireQueueLock(file, { waitMs: 0 });
    second();
    assert.equal(existsSync(`${file}.lock`), false, "release must remove the lock file");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("a lock whose recorded pid is DEAD is broken loudly and re-taken, not left wedging the queue", () => {
  // A holder SIGKILLed mid-replay leaves the file behind; without the break every later
  // write of that partition is refused forever. The lock's on-disk shape is part of
  // acquireQueueLock's own contract (its refusal quotes the pid and the time it records),
  // so the fixture writes exactly that shape.
  const { directory, file } = scratch();
  const spoken = [];
  const realConsoleError = console.error;
  try {
    // A pid that really was a process and really is not one now — spawnSync has already
    // waited for it, so it is reaped by the time this line runs.
    const deadPid = spawnSync(process.execPath, ["-e", "0"]).pid;
    assert.equal(typeof deadPid, "number");
    writeFileSync(`${file}.lock`,
      `${JSON.stringify({ pid: deadPid, since: "2026-08-04T00:00:00.000Z" })}\n`);

    console.error = (...args) => spoken.push(args.join(" "));
    const release = acquireQueueLock(file, { waitMs: 0 });
    console.error = realConsoleError;

    // Broken, and LOUDLY: a lock silently discarded is indistinguishable from a lock that
    // was never there, which is the reading that would hide a live double-writer.
    assert.equal(spoken.length, 1, "breaking a stale lock must be announced");
    assert.ok(spoken[0].includes(`pid ${deadPid}`), "and must name the pid it broke");
    assert.match(spoken[0], /no longer running; breaking the stale lock/u);

    // Re-taken, not merely deleted: the lock now records THIS process.
    assert.equal(JSON.parse(readFileSync(`${file}.lock`, "utf8")).pid, process.pid);
    release();

    // The other side, one field away: the same lock file recording a LIVE pid is refused
    // rather than broken. A break rule that cannot tell the two apart is a break rule that
    // lets two writers into the file at once.
    writeFileSync(`${file}.lock`,
      `${JSON.stringify({ pid: process.pid, since: "2026-08-04T00:00:00.000Z" })}\n`);
    assert.throws(() => acquireQueueLock(file, { waitMs: 20, pollMs: 5 }), /is locked by /u);
    assert.equal(spoken.length, 1, "a live lock must not be reported as broken");
  } finally {
    console.error = realConsoleError;
    rmSync(directory, { recursive: true, force: true });
  }
});

test("a lock with no readable holder is refused with a by-hand remedy, not broken on a guess", () => {
  // The gap between openSync and writeSync: a holder killed there leaves a lock naming
  // nobody. Breaking it would be a guess about a file another process may be about to
  // finish writing, so it is refused — and the refusal has to carry the remedy, because
  // nothing in the tool can clear this one.
  const { directory, file } = scratch();
  try {
    writeFileSync(`${file}.lock`, "");
    assert.throws(
      () => acquireQueueLock(file, { waitMs: 20, pollMs: 5 }),
      (error) => {
        assert.ok(error.message.includes(`${file}.lock`));
        assert.equal(/pid /u.test(error.message), false, "no pid may be invented for a lock that names none");
        assert.match(error.message, /remove that file by hand/u);
        return true;
      });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

// --- the atomic write ------------------------------------------------------------

test("writeQueueAtomic round-trips the bytes and leaves no temp file beside the queue", () => {
  const { directory, file } = scratch();
  try {
    const queue = [
      entryOf(["queued-verb", "--id", "work:1", "--note", "a value with 中文, a \"quote\" and a\nnewline"]),
      { ...entryOf(["queued-verb", "--id", "work:2"]), queuedAt: "2026-08-04T00:00:00.000Z" }
    ];
    writeQueueAtomic(file, queue);

    // The bytes, not just the parse: a queue file is read back by a different process.
    assert.equal(readFileSync(file, "utf8"), `${JSON.stringify(queue, null, 2)}\n`);
    assert.deepEqual(readQueueFile(file), queue);

    // A leftover `${file}.tmp-*` beside the queue is how a half-written backlog gets
    // mistaken for one, and a directory listing is the only place it would show.
    assert.deepEqual(readdirSync(directory), ["shadow-queue.json"]);

    // Overwriting in place leaves the same single file — the rename replaces, it does not
    // accumulate.
    writeQueueAtomic(file, []);
    assert.deepEqual(readdirSync(directory), ["shadow-queue.json"]);
    assert.deepEqual(readQueueFile(file), []);

    // And it creates the directory it was pointed at rather than failing on a first write.
    const nested = join(directory, "cross-project-shadow", "shadow-queue.json");
    writeQueueAtomic(nested, queue);
    assert.deepEqual(readQueueFile(nested), queue);
    assert.deepEqual(readdirSync(dirname(nested)), ["shadow-queue.json"]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

// --- the fail-loud read ----------------------------------------------------------

test("a MISSING queue file is an empty backlog — the one case that legitimately reads []", () => {
  const { directory, file } = scratch();
  try {
    assert.deepEqual(readQueueFile(file), []);
    assert.equal(existsSync(file), false, "reading an absent queue must not create one");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("a CORRUPT queue file THROWS naming the file; returning [] would destroy the backlog", () => {
  // The behaviour this replaced was `catch { return [] }`. The next append then wrote a
  // fresh array over every un-replayed governed write — the single thing the fallback
  // exists to prevent — and reported success. So the assertion is the throw, not the
  // absence of an empty array.
  const { directory, file } = scratch();
  try {
    writeFileSync(file, '[{"verb":"queued-verb","args":["queued-verb","--id","work:1"');
    assert.throws(
      () => readQueueFile(file),
      (error) => {
        assert.ok(error.message.includes(file), "the refusal must name the file to repair");
        assert.match(error.message, /is corrupt/u);
        assert.match(error.message, /refusing to silently drop the backlog/u);
        return true;
      });

    // ONE field: the same path holding parseable bytes reads back as the backlog it is.
    writeFileSync(file, '[{"verb":"queued-verb","args":["queued-verb","--id","work:1"],"actor":"agent:a"}]');
    assert.equal(readQueueFile(file).length, 1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("valid JSON that is NOT an array throws too — a queue that parsed is not a queue", () => {
  const { directory, file } = scratch();
  try {
    for (const bytes of ['{"queue":[]}', '"[]"', "null", "42"]) {
      writeFileSync(file, bytes);
      assert.throws(
        () => readQueueFile(file),
        (error) => {
          assert.ok(error.message.includes(file));
          assert.match(error.message, /is not a JSON array/u);
          return true;
        },
        `${bytes} parses, but it is not a backlog`);
    }

    // The empty array is the boundary on the accepting side: parseable AND an array.
    writeFileSync(file, "[]");
    assert.deepEqual(readQueueFile(file), []);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

// --- what a queue entry must be --------------------------------------------------

test("a queue entry must be a JSON OBJECT: null, a string and an array are each refused", () => {
  for (const notAnObject of [null, undefined, "queued-verb", 42, ["queued-verb", "--id", "x"]]) {
    assert.throws(() => assertQueueEntry(notAnObject, "where"),
      /^Error: where: a queue entry must be a JSON object$/u,
      `${JSON.stringify(notAnObject) ?? "undefined"} must be refused`);
  }
});

test("args must be a NON-EMPTY array of strings — the engine argv, verbatim", () => {
  const refused = (args) => assert.throws(
    () => assertQueueEntry({ verb: "queued-verb", args, actor: "agent:a" }, "where"),
    (error) => {
      assert.match(error.message, /^where: args must be a non-empty JSON array of strings/u);
      return true;
    },
    `${JSON.stringify(args)} must be refused`);

  refused(undefined);
  refused("queued-verb --id work:1");                       // a command LINE is not an argv
  refused({ 0: "queued-verb" });
  refused([]);                                              // nothing to replay
  refused(["queued-verb", "--id", 1]);                      // a number replays as "1" or not at all
  refused(["queued-verb", "--id", null]);
  refused(["queued-verb", "--id", ["work:1"]]);

  // One token, and it is a verb: the shortest thing that is still replayable.
  const minimal = { verb: "queued-verb", args: ["queued-verb"], actor: "agent:a" };
  assert.equal(assertQueueEntry(minimal, "where"), minimal);
});

test("args[0] must be the VERB — an argv that starts with a flag names no command to replay", () => {
  assert.throws(
    () => assertQueueEntry(
      { verb: "queued-verb", args: ["--id", "work:1", "queued-verb"], actor: "agent:a" }, "where"),
    (error) => {
      assert.match(error.message, /^where: args\[0\] must be the engine verb, not a flag/u);
      assert.ok(error.message.includes('"--id"'), "and must quote what it found instead");
      return true;
    });

  // ONE field: the same tokens with the verb first are accepted.
  const ordered = { verb: "queued-verb", args: ["queued-verb", "--id", "work:1"], actor: "agent:a" };
  assert.equal(assertQueueEntry(ordered, "where"), ordered);
});

test("an entry with no attributed actor is refused where it is QUEUED, not discovered at replay", () => {
  // EPIC-041: this is the only enforcement of "every governed write says who performed it"
  // on the fallback route — ceremony.mjs validates payload.actor, and a replay carries its
  // actors per STEP, which nothing downstream checks.
  const refused = (actor) => assert.throws(
    () => assertQueueEntry({ verb: "queued-verb", args: ["queued-verb"], actor }, "where"),
    (error) => {
      assert.match(error.message, /^where: actor must be an attributed actor/u);
      assert.match(error.message, /would record the write as the ceremony's default agent/u);
      return true;
    },
    `${JSON.stringify(actor) ?? "undefined"} must be refused`);

  refused(undefined);
  refused(null);
  refused("");
  refused("anonymous");
  refused("claude-opus-5");   // a model name is not an attribution
  refused("agent:");
  refused("robot:x");
  refused({ kind: "agent", id: "x" });

  const attributed = { verb: "queued-verb", args: ["queued-verb"], actor: "person:ryan" };
  assert.equal(assertQueueEntry(attributed, "where"), attributed);
});

test("assertQueueEntry returns the well-formed entry unchanged and prefixes every refusal", () => {
  const entry = entryOf(["queued-verb", "--id", "work:1", "--allow-stale", "true"]);
  assert.equal(assertQueueEntry(entry, "shadow queue entry [3]"), entry,
    "the entry is returned by identity — validation may not rewrite what gets queued");

  // The `where` label is what tells a reader WHICH backlog entry is bad days later.
  assert.throws(() => assertQueueEntry({}, "shadow queue entry [3]"),
    /^Error: shadow queue entry \[3\]: /u);
  assert.throws(() => assertQueueEntry({ args: ["v"], actor: "nope" }, "queued action for TCRN-TMS"),
    /^Error: queued action for TCRN-TMS: /u);
});

test("an attributed actor is agent:<model> or person:<id>, and nothing else passes", () => {
  for (const actor of [
    "agent:claude-opus-5", "agent:codex", "person:ryan", "person:hardy.1035",
    "agent:claude:opus:5", "person:a-b_c.d", "agent:0"
  ]) {
    assert.equal(isAttributedActor(actor), true, `${actor} must be accepted`);
  }

  for (const actor of [
    undefined, null, 42, {}, ["agent:a"],
    "", "anonymous", "claude-opus-5", "ryan",
    "agent:", "person:", ":x", "agent", "AGENT:x", "Person:x",
    "agent:has space", " agent:x", "agent:x ", "agent:x\n", "agent:x/y", "team:x"
  ]) {
    assert.equal(isAttributedActor(actor), false,
      `${JSON.stringify(actor) ?? "undefined"} must be rejected`);
  }
});

// --- which queue file a partition has, and which has none ------------------------

test("the AOS partition is REFUSED by name: it is the authority and has no shadow buffer", () => {
  // Before the guard this was `dirname(null)` — an ERR_INVALID_ARG_TYPE with a stack
  // trace, which reads as a broken tool rather than as the deliberate refusal it is. So
  // the assertion is on the sentence AND on the absence of the node error code.
  assert.throws(
    () => shadowQueueFile("TCRN-AOS"),
    (error) => {
      assert.equal(error.code, undefined, "a deliberate refusal must not arrive as ERR_INVALID_ARG_TYPE");
      assert.match(error.message, /^partition TCRN-AOS is the AOS authority and has no shadow buffer/u);
      assert.match(error.message, /the fallback queue and its replay do not apply to it/u);
      return true;
    });

  // An unknown partition is a DIFFERENT refusal that lists what is known — telling an
  // operator "no shadow buffer" for a typo would send them looking for the wrong thing.
  assert.throws(
    () => shadowQueueFile("TCRN-Ghost"),
    (error) => {
      assert.match(error.message, /^unknown partition TCRN-Ghost; known: /u);
      assert.ok(error.message.includes("TCRN-AOS"), "and names the AOS partition among them");
      return true;
    });
});

test("a shadowed partition's queue sits BESIDE its shadow workspace, never inside it", () => {
  // Path arithmetic only — nothing here creates, reads or writes anything on this machine.
  // A queue file inside the shadow workspace would be a file beside a control tree that
  // only the engine may write, which is the mistake the layout exists to prevent.
  for (const partition of ["cross-project", "TCRN-Design-System", "TCRN-TMS", "Joi-Button"]) {
    const file = shadowQueueFile(partition);
    assert.equal(basename(file), "shadow-queue.json");
    assert.equal(basename(dirname(file)), `${partition}-shadow`);
    assert.equal(file.includes("/workspace/"), false, "the queue is not inside the control tree");
    assert.equal(file.endsWith(`${partition}-shadow/shadow-queue.json`), true);
  }

  // Four shadowed partitions and four distinct queues: one shared file would replay one
  // partition's backlog onto another partition's chain.
  const files = ["cross-project", "TCRN-Design-System", "TCRN-TMS", "Joi-Button"]
    .map((partition) => shadowQueueFile(partition));
  assert.equal(new Set(files).size, 4);
});

test("appendQueue refuses a partition BEFORE it can reach the filesystem", () => {
  // appendQueue's happy path is deliberately not exercised: its queue path is derived from
  // the partition id, so the only files it can write are inside this platform's governed
  // workspace container, and a test may not put bytes there. What it composes — the lock,
  // the fail-loud read, the atomic write, the entry check — is covered above and, across
  // processes, by the eight-child case.
  //
  // Both entries below are malformed on purpose. The refusal being asserted comes from
  // shadowQueueFile, which runs first; the malformed entry is the second barrier, so that
  // if the partition guard ever regressed this case would still refuse at
  // assertQueueEntry — before acquireQueueLock's mkdirSync — rather than create a queue in
  // the real container while going red.
  assert.throws(() => appendQueue("TCRN-AOS", {}),
    /^Error: partition TCRN-AOS is the AOS authority and has no shadow buffer/u);
  assert.throws(() => appendQueue("TCRN-Ghost", {}),
    /^Error: unknown partition TCRN-Ghost; known: /u);
});

// --- turning a queued argv back into a ceremony step -----------------------------

test("buildReplayPayload REQUIRES the host engine's catalogue; there is no guessing fallback", () => {
  // An optional catalogue would mean the faithful parse quietly stops happening the day a
  // caller forgets to pass one — and the pairwise walk it would fall back to is exactly the
  // bug this machinery replaced.
  const queue = [entryOf(["queued-verb", "--id", "work:1"])];
  for (const notACatalogue of [undefined, null, new Map(), {}, Object.fromEntries(CATALOGUE), [...CATALOGUE]]) {
    assert.throws(
      () => buildReplayPayload("cross-project", queue, notACatalogue),
      /^Error: buildReplayPayload requires the host engine's own commands catalogue/u);
  }
  // ONE field: the same queue with a real indexed catalogue builds.
  assert.equal(buildReplayPayload("cross-project", queue, CATALOGUE).steps.length, 1);
});

test("a boolean flag replays with its VALUE, in either spelling — and a BARE one is refused", () => {
  // Measured 2026-08-04 against the live host engine: `--allow-stale` alone is answered
  // CLI_ARGUMENT_MALFORMED, while `--allow-stale true` and `--allow-stale=true` both reach
  // the verb. Recording a bare flag as "true" would therefore let the fallback route replay
  // an argv the direct route rejects — a guess in the one function whose purpose is
  // refusing to guess.
  assert.deepEqual(stepFor(["queued-verb", "--id", "work:1", "--allow-stale", "true"]).flags,
    { id: "work:1", "allow-stale": "true", actor: "agent:claude-opus-5" });
  assert.deepEqual(stepFor(["queued-verb", "--id", "work:1", "--allow-stale=true"]).flags,
    { id: "work:1", "allow-stale": "true", actor: "agent:claude-opus-5" });
  // `false` is a value too — a boolean flag is not "present means true".
  assert.equal(stepFor(["queued-verb", "--id", "work:1", "--allow-stale=false"]).flags["allow-stale"],
    "false");

  // ONE token removed from the first line above, and it is refused.
  assert.throws(
    () => stepFor(["queued-verb", "--id", "work:1", "--allow-stale"]),
    (error) => {
      assert.match(error.message, /^shadow queue entry \[0\]: --allow-stale is a boolean/u);
      assert.match(error.message, /a bare flag is CLI_ARGUMENT_MALFORMED there/u);
      return true;
    });

  // And the mid-argv shape that the pairwise walk turned into a DIFFERENT command:
  // `{"allow-unpromoted": "--allow-stale"}` was accepted by every downstream check.
  assert.throws(
    () => stepFor(["queued-verb", "--id", "work:1", "--allow-unpromoted", "--allow-stale", "true"]),
    /^Error: shadow queue entry \[0\]: --allow-unpromoted is a boolean/u);
});

test("a repeated flag is refused rather than resolved to the last occurrence", () => {
  assert.throws(
    () => stepFor(["queued-verb", "--id", "work:1", "--id", "work:2"]),
    (error) => {
      assert.match(error.message, /^shadow queue entry \[0\]: --id appears more than once/u);
      assert.match(error.message, /a list flag carries its values in one comma-separated token/u);
      return true;
    });
  // The two spellings must not be a way around it either.
  assert.throws(() => stepFor(["queued-verb", "--id", "work:1", "--id=work:2"]),
    /--id appears more than once/u);

  assert.equal(stepFor(["queued-verb", "--id", "work:1"]).flags.id, "work:1");
});

test("a stray non-flag token is refused, naming its argv position", () => {
  assert.throws(
    () => stepFor(["queued-verb", "--id", "work:1", "oops"]),
    (error) => {
      assert.match(error.message, /^shadow queue entry \[0\]: expected a --flag at argv\[3\]/u);
      assert.ok(error.message.includes('"oops"'));
      return true;
    });
  // `--` and `-x` are not flags this parse can represent either, and both say so at the
  // position they were found rather than as an undeclared flag named "".
  assert.throws(() => stepFor(["queued-verb", "--"]), /expected a --flag at argv\[1\], found "--"/u);
  assert.throws(() => stepFor(["queued-verb", "-id", "work:1"]), /expected a --flag at argv\[1\]/u);
});

test("a value-taking flag at END of argv is refused; the value it needed cannot be invented", () => {
  // The trailing case is the worst of the pairwise-walk shapes: it walked into `undefined`,
  // and JSON.stringify drops an undefined value on the way to the payload file, so the flag
  // simply vanished from the replayed command.
  assert.throws(
    () => stepFor(["queued-verb", "--id"]),
    (error) => {
      assert.match(error.message, /^shadow queue entry \[0\]: --id is a string/u);
      assert.match(error.message, /queue --id <value> \(or --id=<value>\)/u);
      return true;
    });
  assert.throws(() => stepFor(["queued-verb", "--id", "work:1", "--note"]),
    /--note is a string the host engine still requires a value for/u);

  // CEILING, asserted so it cannot silently change: a value that itself begins with `--`
  // is indistinguishable from the next flag in this spelling and is refused, so such a
  // value must be queued inline. The refusal has a remedy; a silent mis-parse would not.
  assert.throws(() => stepFor(["queued-verb", "--id", "work:1", "--note", "--not-a-flag"]),
    /--note is a string the host engine still requires a value for/u);
  assert.equal(stepFor(["queued-verb", "--id", "work:1", "--note=--not-a-flag"]).flags.note,
    "--not-a-flag");
});

test("an UNDECLARED flag and an UNKNOWN verb are each refused against the host's own catalogue", () => {
  assert.throws(() => stepFor(["queued-verb", "--id", "work:1", "--nope", "x"]),
    /^Error: shadow queue entry \[0\]: the host engine's queued-verb declares no --nope$/u);
  // The inline spelling must report the FLAG, not the whole `nope=x` token — naming the
  // wrong thing sent a reader looking for a flag that was never queued.
  assert.throws(() => stepFor(["queued-verb", "--id", "work:1", "--nope=x"]),
    /declares no --nope$/u);
  assert.throws(() => stepFor(["ghost-verb", "--id", "work:1"]),
    /^Error: shadow queue entry \[0\]: the host engine's commands catalogue declares no verb ghost-verb$/u);

  // The index is per-verb, not a union: a flag declared by one verb is undeclared on
  // another. A catalogue flattened into one flag set would accept this.
  assert.throws(() => stepFor(["unattributable-verb", "--id", "work:1", "--allow-stale", "true"]),
    /the host engine's unattributable-verb declares no --allow-stale$/u);
});

test("a flag the CEREMONY supplies may not be queued — every reserved flag, derived", () => {
  // The fixture declares each reserved flag on the verb, so the refusal being asserted is
  // the reserved one and not "this verb declares no --workspace". These have an authority
  // that is not the queue: two come from the topology and one from a head read taken
  // moments before the write, so a queued copy would freeze nothing and could attest into
  // a sidecar nobody reads.
  assert.ok(RESERVED_FLAGS.length > 0, "an empty reserved list would make this case vacuous");
  for (const reserved of RESERVED_FLAGS) {
    assert.throws(
      () => stepFor(["queued-verb", "--id", "work:1", `--${reserved}`, "supplied-by-the-queue"]),
      (error) => {
        assert.ok(error.message.includes(`--${reserved} is supplied by the ceremony`),
          `--${reserved} must be refused: ${error.message}`);
        return true;
      });
    assert.throws(() => stepFor(["queued-verb", "--id", "work:1", `--${reserved}=x`]),
      new RegExp(`--${reserved} is supplied by the ceremony`, "u"));
  }
});

test("--actor inside the queued argv is refused; the actor is carried on the ENTRY", () => {
  // Two sources for the actor could disagree, and the one that would win is not the one a
  // reader of the queue file would expect.
  assert.throws(
    () => stepFor(["queued-verb", "--id", "work:1", "--actor", "agent:someone-else"]),
    (error) => {
      assert.match(error.message, /^shadow queue entry \[0\]: --actor may not be queued inside the argv/u);
      assert.match(error.message, /so two sources for it could disagree/u);
      return true;
    });
  assert.throws(() => stepFor(["queued-verb", "--id", "work:1", "--actor=agent:someone-else"]),
    /--actor may not be queued inside the argv/u);

  // The accepting side: the entry's actor is what gets emitted.
  assert.equal(stepFor(["queued-verb", "--id", "work:1"], "person:ryan").flags.actor, "person:ryan");
});

test("attribution survives the outage, but only where the verb declares --actor", () => {
  // planStep refuses a flag the verb does not define, so emitting --actor blindly would
  // make every mutating verb that takes no --actor unreplayable. The entry is still
  // required to carry an attributed actor either way — what the engine records for those
  // verbs is the engine's business, and pretending otherwise would be worse.
  assert.equal(stepFor(["queued-verb", "--id", "work:1"], "agent:codex").flags.actor, "agent:codex");
  assert.equal(
    Object.hasOwn(stepFor(["unattributable-verb", "--id", "work:1"], "agent:codex").flags, "actor"),
    false);
  assert.throws(
    () => buildReplayPayload("cross-project",
      [{ verb: "unattributable-verb", args: ["unattributable-verb", "--id", "w"], actor: "anonymous" }],
      CATALOGUE),
    /^Error: shadow queue entry \[0\]: actor must be an attributed actor/u);

  // A batch-level actor is stated only when the backlog agrees on one: the receipt reports
  // it as the ceremony's actor, so naming one of several would make the receipt say
  // something untrue. Steps carry their own either way.
  const one = buildReplayPayload("cross-project",
    [entryOf(["queued-verb", "--id", "a"], "agent:a"), entryOf(["queued-verb", "--id", "b"], "agent:a")],
    CATALOGUE);
  assert.equal(one.actor, "agent:a");

  const two = buildReplayPayload("cross-project",
    [entryOf(["queued-verb", "--id", "a"], "agent:a"), entryOf(["queued-verb", "--id", "b"], "person:ryan")],
    CATALOGUE);
  assert.equal(Object.hasOwn(two, "actor"), false, "a mixed backlog states no batch actor");
  assert.deepEqual(two.steps.map((step) => step.flags.actor), ["agent:a", "person:ryan"]);
});

test("every produced flag value is a STRING and survives the JSON file the ceremony reads", () => {
  // The wire format between here and the ceremony is a JSON file on disk, and
  // JSON.stringify drops an undefined VALUE silently — a flag that parsed to anything but
  // a string would disappear from the payload rather than fail.
  const payload = buildReplayPayload("cross-project", [
    entryOf(["queued-verb", "--id", "work:1", "--allow-stale", "false", "--note", "0"]),
    entryOf(["queued-verb", "--id=work:2", "--note=", "--allow-unpromoted=true"], "person:ryan")
  ], CATALOGUE);

  for (const step of payload.steps) {
    for (const [name, value] of Object.entries(step.flags)) {
      assert.equal(typeof value, "string", `--${name} must reach the payload as a string`);
    }
  }
  // Falsy-looking values are values: "0", "false" and "" must all still be there.
  assert.deepEqual(payload.steps[0].flags,
    { id: "work:1", "allow-stale": "false", note: "0", actor: "agent:claude-opus-5" });
  assert.deepEqual(payload.steps[1].flags,
    { id: "work:2", note: "", "allow-unpromoted": "true", actor: "person:ryan" });

  // The round trip is the real test: nothing dropped, nothing coerced, on the way to disk
  // and back.
  const throughDisk = JSON.parse(JSON.stringify(payload));
  assert.deepEqual(throughDisk, payload);
  for (const [index, step] of throughDisk.steps.entries()) {
    assert.deepEqual(Object.keys(step.flags).sort(), Object.keys(payload.steps[index].flags).sort());
  }
});

test("the read-back anchor is PER-PARTITION and resolves to that partition's own record", () => {
  // The bug this pins: the read-back was hardcoded to Joi-Button's root Initiative for
  // every partition except TCRN-AOS, so on cross-project, the Design System and TMS the
  // engine answered WORKSPACE_INPUT_INVALID for a record their chains do not contain — the
  // read-back could never pass, the replay always failed, and the backlog could never
  // clear. The anchors are asserted as literals because they are the identity the proof
  // depends on (verified 2026-08-04 against each partition's own VM chain, per
  // aos-partitions.mjs); the MAPPING is asserted, no chain is contacted.
  const EXPECTED = {
    "TCRN-AOS": "TCRN-AOS-INIT-004",
    "Joi-Button": "JOI-BUTTON-INIT-001",
    "cross-project": "TCRN-CROSS-INIT-001",
    "TCRN-Design-System": "TCRN-DS-INIT-001",
    "TCRN-TMS": "TCRN-TMS-INIT-001"
  };
  assert.deepEqual(Object.keys(AOS_PARTITIONS).sort(), Object.keys(EXPECTED).sort(),
    "all five partitions, or this case stops covering the one that was added");

  const anchors = new Map();
  for (const [partition, externalKey] of Object.entries(EXPECTED)) {
    const payload = buildReplayPayload(
      partition, [entryOf(["queued-verb", "--id", "work:1"])], CATALOGUE);

    assert.equal(payload.readback.length, 1, "a replay nobody read back is not proven");
    const [readback] = payload.readback;
    assert.equal(readback.verb, "work-show");
    assert.equal(readback.flags.id, AOS_PARTITIONS[partition].anchor.id);
    assert.equal(readback.expect.externalKey, externalKey);
    assert.equal(AOS_PARTITIONS[partition].anchor.externalKey, externalKey);
    // Only externalKey is expected: `status` moves as the Initiative progresses, so a
    // read-back asserting it would go red on its own and the backlog would never clear.
    assert.deepEqual(Object.keys(readback.expect), ["externalKey"]);
    assert.deepEqual(readback.recordFields, ["externalKey", "status"]);

    assert.equal(payload.schemaVersion, "aos.local-client-ceremony.v1");
    assert.ok(payload.intent.includes(partition), "the intent must name the partition it targets");
    anchors.set(partition, readback.flags.id);
  }

  // DIFFERENT per partition — the failing shape was one id shared by four of them.
  assert.equal(new Set(anchors.values()).size, 5, `one anchor per chain: ${[...anchors]}`);

  // A partition with no AOS target has no anchor to read back, and says so rather than
  // building a payload that could never be proven.
  assert.throws(() => buildReplayPayload("TCRN-Ghost", [entryOf(["queued-verb", "--id", "w"])], CATALOGUE),
    /^Error: partition TCRN-Ghost has no AOS target yet; known: /u);
});
