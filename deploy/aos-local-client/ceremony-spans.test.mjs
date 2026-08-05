// TCRN-AOS INIT-018 QA F6 — the ceremony span emitter's two promises, tested.
//
// The two promises are (1) nothing that lands in the sink carries a field outside
// the S10 privacy contract and (2) nothing here ever throws into a live ceremony —
// ceremony.mjs calls emitCeremonySpan from ten places and not one of them has a
// catch, so a throw from here aborts a governed write to protect a log file.
// Until 2026-08-05 the privacy check threw from outside the try while the comment
// beside it claimed the opposite, and no test covered either promise.
//
// Every case writes to a sink under mkdtemp and is removed afterwards; no case
// touches the platform-root default sink. The privacy check cannot be reached
// through the shipped record literal (seven literal keys, seven allowed keys), so
// the case that exercises it injects a builder — that injection IS the future edit
// the guard exists for, and the same case emits once with and once without the
// stray key so the drop is attributable to the guard rather than to the injection.

// TCRN-CROSS-INC-041 R2-B extends this file: promise (2) was asserted only for
// synchronous throws, and the fix for F6 reported drops through
// `process.stderr.write`, whose failure on a pipe arrives as an EVENT rather than
// as a throw. Section ⑤ below closes that with a child process whose stderr reader
// is gone, and it carries its own CONTROL — the same emitCeremonySpan driven
// through the pre-fix stream-based channel — so a construction that stopped
// producing EPIPE would turn the test red instead of quietly passing.

import { strict as assert } from "node:assert";
import { spawn } from "node:child_process";
import {
  closeSync, existsSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync, writeSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  ALLOWED_SPAN_KEYS, buildSpanRecord, ceremonySinkPath, disallowedSpanKeys, emitCeremonySpan
} from "./ceremony-spans.mjs";

/** Where the child processes below import the subject from. Derived, never typed. */
const SPANS_URL = new URL("./ceremony-spans.mjs", import.meta.url).href;

const FIELDS = Object.freeze({ span: "ceremony.start", partition: "cross-project", outcome: "started" });

/** A temp directory for one case, removed however the case ends. */
function withTempDir(run) {
  const dir = mkdtempSync(join(tmpdir(), "ceremony-spans-"));
  try {
    return run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Point the sink at `sink` for the duration of `run`, then restore the env exactly. */
function withSink(sink, run) {
  const had = Object.hasOwn(process.env, "TCRN_OTEL_SINK");
  const previous = process.env.TCRN_OTEL_SINK;
  process.env.TCRN_OTEL_SINK = sink;
  try {
    return run();
  } finally {
    if (had) process.env.TCRN_OTEL_SINK = previous;
    else delete process.env.TCRN_OTEL_SINK;
  }
}

/** Capture the diagnostic channel instead of letting it reach the test runner's stderr. */
function collector() {
  const lines = [];
  return { lines, warn: (message) => lines.push(message) };
}

const sinkLines = (sink) => (existsSync(sink)
  ? readFileSync(sink, "utf8").split("\n").filter((line) => line.trim() !== "")
  : []);

// ---------------------------------------------------------------------------
// ① The happy path: what lands, and exactly which keys land with it
// ---------------------------------------------------------------------------

test("a span lands in the sink carrying exactly the allowed keys and nothing else", () => {
  withTempDir((dir) => {
    const sink = join(dir, "spans.jsonl");
    const log = collector();
    const result = withSink(sink, () => emitCeremonySpan(
      { span: "ceremony.end", partition: "cross-project", verb: "work-show", expectedVersion: 1501, outcome: "ok", reasonCode: "CEREMONY_COMPLETED_AND_READ_BACK" },
      { warn: log.warn }));

    assert.deepEqual(result, { emitted: true, reasonCode: null, disallowed: [] });
    const lines = sinkLines(sink);
    assert.equal(lines.length, 1, "exactly one record per emit");
    const record = JSON.parse(lines[0]);
    assert.deepEqual(Object.keys(record).sort(), [...ALLOWED_SPAN_KEYS].sort(),
      "the key set on disk must be the allowlist itself, neither a subset nor a superset");
    assert.deepEqual(record, {
      span: "ceremony.end",
      at: record.at,
      partition: "cross-project",
      verb: "work-show",
      expectedVersion: 1501,
      outcome: "ok",
      reasonCode: "CEREMONY_COMPLETED_AND_READ_BACK"
    });
    assert.match(record.at, /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/u, "at is an ISO instant");
    assert.deepEqual(log.lines, [], "the happy path says nothing on the diagnostic channel");
  });
});

test("appends accumulate; an emit never rewrites the sink", () => {
  withTempDir((dir) => {
    const sink = join(dir, "spans.jsonl");
    const log = collector();
    withSink(sink, () => {
      emitCeremonySpan(FIELDS, { warn: log.warn });
      emitCeremonySpan({ ...FIELDS, span: "ceremony.end", outcome: "ok" }, { warn: log.warn });
    });
    const lines = sinkLines(sink);
    assert.equal(lines.length, 2);
    assert.equal(JSON.parse(lines[0]).span, "ceremony.start");
    assert.equal(JSON.parse(lines[1]).span, "ceremony.end");
  });
});

// ---------------------------------------------------------------------------
// ② The privacy check: drops the record, does not throw, does not write
// ---------------------------------------------------------------------------

test("a record carrying a field outside the contract is dropped — not thrown, not written", () => {
  withTempDir((dir) => {
    const sink = join(dir, "spans.jsonl");
    const log = collector();
    // The future edit the guard exists for: a builder that adds a field to the
    // record literal without adding it to ALLOWED_SPAN_KEYS.
    const leaky = (fields) => ({ ...buildSpanRecord(fields), payload: "REDACTED-CHAIN-BYTES" });

    let result;
    assert.doesNotThrow(() => {
      result = withSink(sink, () => emitCeremonySpan(FIELDS, { buildRecord: leaky, warn: log.warn }));
    }, "a live ceremony must not be aborted by its own observability");

    assert.equal(result.emitted, false);
    assert.equal(result.reasonCode, "SPAN_FIELD_NOT_ALLOWED");
    assert.deepEqual(result.disallowed, ["payload"]);
    assert.deepEqual(sinkLines(sink), [], "the refused record must not reach the sink");

    assert.equal(log.lines.length, 1, "a dropped span must be observable, not silent");
    assert.match(log.lines[0], /payload/u, "the diagnostic names the offending key");
    assert.doesNotMatch(log.lines[0], /REDACTED-CHAIN-BYTES/u,
      "the diagnostic must not print the value — that would be the leak the check prevents");

    // The other side of the same predicate: the identical injection minus the stray
    // key lands. Without this, the case above would also pass if emitCeremonySpan
    // dropped every injected record, or every record at all.
    const clean = (fields) => ({ ...buildSpanRecord(fields) });
    const ok = withSink(sink, () => emitCeremonySpan(FIELDS, { buildRecord: clean, warn: log.warn }));
    assert.equal(ok.emitted, true);
    assert.equal(sinkLines(sink).length, 1);
    assert.equal(log.lines.length, 1, "the accepted record adds no diagnostic");
  });
});

test("every stray key is named, and the shipped record has none", () => {
  assert.deepEqual(disallowedSpanKeys(buildSpanRecord(FIELDS)), []);
  assert.deepEqual(
    disallowedSpanKeys({ ...buildSpanRecord(FIELDS), argv: [], payloadDigest: "…" }),
    ["argv", "payloadDigest"]);
});

// ---------------------------------------------------------------------------
// ③ Sink creation, and the failure that used to be swallowed in silence
// ---------------------------------------------------------------------------

test("a sink directory that does not exist is created", () => {
  withTempDir((dir) => {
    const sink = join(dir, "nested", "deeper", "spans.jsonl");
    assert.equal(existsSync(join(dir, "nested")), false, "precondition: the directory is absent");
    const log = collector();
    const result = withSink(sink, () => emitCeremonySpan(FIELDS, { warn: log.warn }));
    assert.equal(result.emitted, true);
    assert.equal(sinkLines(sink).length, 1);
    assert.deepEqual(log.lines, []);
  });
});

test("an unwritable sink drops the record loudly instead of throwing", () => {
  withTempDir((dir) => {
    // A regular file where the sink's parent directory must be: mkdirSync fails
    // with ENOTDIR, which is the whole reason the append sits inside a try.
    const blocker = join(dir, "blocker");
    writeFileSync(blocker, "not a directory\n");
    const sink = join(blocker, "spans.jsonl");
    const log = collector();

    let result;
    assert.doesNotThrow(() => {
      result = withSink(sink, () => emitCeremonySpan(FIELDS, { warn: log.warn }));
    });
    assert.equal(result.emitted, false);
    assert.equal(result.reasonCode, "SPAN_SINK_UNWRITABLE");
    assert.equal(existsSync(sink), false);
    assert.equal(log.lines.length, 1, "a dead sink must be observable — INIT-018 QA F1 was exactly this");
    assert.match(log.lines[0], /sink unwritable/u);
  });
});

// ---------------------------------------------------------------------------
// ④ TCRN_OTEL_SINK
// ---------------------------------------------------------------------------

test("TCRN_OTEL_SINK decides the sink path in both directions", () => {
  withTempDir((dir) => {
    const sink = join(dir, "override.jsonl");
    withSink(sink, () => assert.equal(ceremonySinkPath(), sink));

    // With the variable absent the default is the platform-root runtime path. The
    // path is asserted by shape, not as a literal: this file states no topology.
    const had = Object.hasOwn(process.env, "TCRN_OTEL_SINK");
    const previous = process.env.TCRN_OTEL_SINK;
    delete process.env.TCRN_OTEL_SINK;
    try {
      const fallback = ceremonySinkPath();
      assert.notEqual(fallback, sink);
      assert.match(fallback, /[/\\]var[/\\]tcrn-otel[/\\]ceremony-spans\.jsonl$/u);
      assert.equal(fallback.startsWith("/"), true, "the default is absolute");
    } finally {
      if (had) process.env.TCRN_OTEL_SINK = previous;
    }
  });
});

test("TCRN_OTEL_SINK redirects the bytes, not only the reported path", () => {
  withTempDir((dir) => {
    const first = join(dir, "first.jsonl");
    const second = join(dir, "second.jsonl");
    const log = collector();
    withSink(first, () => emitCeremonySpan(FIELDS, { warn: log.warn }));
    withSink(second, () => emitCeremonySpan({ ...FIELDS, span: "ceremony.end", outcome: "ok" }, { warn: log.warn }));

    assert.equal(sinkLines(first).length, 1, "the first sink kept only its own record");
    assert.equal(sinkLines(second).length, 1);
    assert.equal(JSON.parse(sinkLines(first)[0]).span, "ceremony.start");
    assert.equal(JSON.parse(sinkLines(second)[0]).span, "ceremony.end");
  });
});

// ---------------------------------------------------------------------------
// Structural claims: the allowlist and the literal must not drift apart
// ---------------------------------------------------------------------------

test("the allowlist is exactly the record the emitter builds, in order, and is frozen", () => {
  assert.deepEqual(Object.keys(buildSpanRecord(FIELDS)), [...ALLOWED_SPAN_KEYS],
    "a key added to either side without the other is the drift this guard exists for");
  assert.equal(Object.isFrozen(ALLOWED_SPAN_KEYS), true);
});

test("the optional labels are normalised to null rather than omitted", () => {
  const record = buildSpanRecord(FIELDS);
  assert.equal(record.verb, null);
  assert.equal(record.expectedVersion, null);
  assert.equal(record.reasonCode, null);
});

test("expectedVersion is carried only when it is an integer", () => {
  const version = (value) => buildSpanRecord({ ...FIELDS, expectedVersion: value }).expectedVersion;
  assert.equal(version(1501), 1501);
  assert.equal(version(0), 0);
  assert.equal(version("1501"), null, "a string version would make the label untypable downstream");
  assert.equal(version(1.5), null);
  assert.equal(version(Number.NaN), null);
  assert.equal(version(undefined), null);
});

// ---------------------------------------------------------------------------
// ⑤ R2-B: the diagnostic channel itself must not kill the ceremony
// ---------------------------------------------------------------------------

/**
 * The mechanism the whole fix rests on, asserted rather than assumed: a failing
 * `writeSync` reports by THROWING, at the call site, synchronously — which is the
 * only failure shape a `try`/`catch` can contain. EBADF is used because it is the
 * one errno reproducible in-process without a second process.
 */
test("writeSync reports a dead descriptor by throwing, in the same tick", () => {
  withTempDir((dir) => {
    const fd = openSync(join(dir, "scratch"), "w");
    closeSync(fd);
    let error = null;
    // Not assert.throws: the point is that control returns to THIS line, i.e. the
    // failure was delivered synchronously and not as a later event.
    try {
      writeSync(fd, Buffer.from("x", "utf8"), 0, 1);
    } catch (thrown) {
      error = thrown;
    }
    assert.notEqual(error, null, "a stream write would have returned normally and failed later");
    assert.equal(error.code, "EBADF");
  });
});

/**
 * The child process. It emits three spans against an unwritable sink — so every emit
 * is forced down the diagnostic branch, without which this whole section would pass
 * vacuously — then records how far it got, twice:
 *
 *   stage "emitted"  — the emits returned; written synchronously, so it survives even
 *                      a death that is already queued.
 *   stage "survived" — the process was still alive one timer later. A ceremony keeps
 *                      running after a log line; this is that.
 *
 * `legacyWarn` swaps in the pre-fix channel (an async stream write inside a try/catch
 * that cannot see an async failure) and nothing else. It is the control.
 */
function childSource({ conclusionPath, legacyWarn = false, closeFd2 = false }) {
  return [
    'import { writeFileSync, closeSync } from "node:fs";',
    `import { emitCeremonySpan } from ${JSON.stringify(SPANS_URL)};`,
    `const conclusion = ${JSON.stringify(conclusionPath)};`,
    'const say = (stage, body) => writeFileSync(conclusion, JSON.stringify({ stage, ...body }));',
    legacyWarn
      ? 'const seams = { warn: (m) => { try { process.stderr.write("[ceremony-spans] " + m + "\\n"); }'
        + ' catch { /* an event is not catchable here — that is the defect */ } } };'
      : 'const seams = undefined;',
    closeFd2 ? 'try { closeSync(2); } catch { /* already gone */ }' : '',
    'const results = []; let threw = null;',
    'try {',
    '  for (let i = 0; i < 3; i += 1) {',
    '    results.push(emitCeremonySpan(',
    '      { span: "ceremony.start", partition: "cross-project", outcome: "started" }, seams));',
    '  }',
    '} catch (error) { threw = String((error && error.message) || error); }',
    'say("emitted", { results, threw });',
    'setTimeout(() => { say("survived", { results, threw }); process.exitCode = 0; }, 150);',
    ""
  ].join("\n");
}

/** Run one such child; return its exit code and the conclusion it managed to write. */
async function runChild({ legacyWarn = false, closeFd2 = false, closeStderrReader = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "ceremony-spans-child-"));
  try {
    const conclusionPath = join(dir, "conclusion.json");
    // A regular file where the sink's parent directory must be, so every emit fails
    // and therefore every emit reaches the diagnostic channel under test.
    const blocker = join(dir, "blocker");
    writeFileSync(blocker, "not a directory\n");
    const script = join(dir, "child.mjs");
    writeFileSync(script, childSource({ conclusionPath, legacyWarn, closeFd2 }));

    const outcome = await new Promise((settle) => {
      const child = spawn(process.execPath, [script], {
        env: { ...process.env, TCRN_OTEL_SINK: join(blocker, "spans.jsonl") },
        stdio: ["ignore", "pipe", "pipe"]
      });
      // THE CONSTRUCTION: the reader of the child's fd 2 goes away before the child
      // has written a byte to it, so every write on that descriptor returns EPIPE.
      if (closeStderrReader) child.stderr.destroy();
      else child.stderr.resume();
      child.stdout.resume();
      child.stdout.on("error", () => {});
      child.stderr.on("error", () => {});
      child.on("exit", (code, signal) => settle({ code, signal }));
    });

    let report = null;
    try { report = JSON.parse(readFileSync(conclusionPath, "utf8")); } catch { report = null; }
    return { ...outcome, report };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("CONTROL: the pre-fix stream channel really is killed by a closed pipe reader", async () => {
  const run = await runChild({ legacyWarn: true });
  // If this ever goes green, the construction above stopped delivering EPIPE and the
  // case below has become an assertion about nothing.
  assert.notEqual(run.code, 0,
    "the control must die — otherwise the closed reader is not producing EPIPE and the subject case proves nothing");
  assert.notEqual(run.report, null, "the control still got far enough to write its conclusion");
  assert.equal(run.report.stage, "emitted", "it died between returning from emit and the next timer");
  assert.equal(run.report.threw, null, "and it did not die by throwing — that is why a try/catch could not save it");
});

test("a closed stderr reader does not throw out of emit and does not kill the process", async () => {
  const run = await runChild();
  assert.equal(run.code, 0, "the ceremony must exit on its own conclusion, not on a log line");
  assert.equal(run.signal, null);
  assert.notEqual(run.report, null);
  assert.equal(run.report.stage, "survived", "the process outlived the writes to a dead descriptor");
  assert.equal(run.report.threw, null, "emit did not throw");
  assert.equal(run.report.results.length, 3);
  for (const result of run.report.results) {
    // Not vacuous: every emit really did take the diagnostic branch. Had the sink been
    // writable, nothing would ever have touched the broken descriptor.
    assert.equal(result.emitted, false);
    assert.equal(result.reasonCode, "SPAN_SINK_UNWRITABLE");
  }
});

test("fd 2 closed outright is survived too, and the drop is still reported in the return value", async () => {
  const run = await runChild({ closeFd2: true, closeStderrReader: false });
  assert.equal(run.code, 0);
  assert.equal(run.report.stage, "survived");
  assert.equal(run.report.threw, null);
  assert.equal(run.report.results[0].reasonCode, "SPAN_SINK_UNWRITABLE",
    "the descriptor is gone, so the caller's return value is the only surviving channel");
});

// ---------------------------------------------------------------------------
// ⑥ R2-B, second half: every other way the emit path could throw
// ---------------------------------------------------------------------------

test("a diagnostic sink that throws escapes neither branch", () => {
  withTempDir((dir) => {
    const onFire = () => { throw new Error("the diagnostic sink is itself broken"); };

    // Branch 1 — the privacy refusal calls warn from INSIDE the try, so before this
    // fix its throw landed in the catch, which called warn again, and THAT throw had
    // no catch left above it.
    const leaky = (fields) => ({ ...buildSpanRecord(fields), payload: "REDACTED-CHAIN-BYTES" });
    let refusal;
    assert.doesNotThrow(() => {
      refusal = withSink(join(dir, "spans.jsonl"),
        () => emitCeremonySpan(FIELDS, { buildRecord: leaky, warn: onFire }));
    });
    assert.equal(refusal.reasonCode, "SPAN_FIELD_NOT_ALLOWED");

    // Branch 2 — the catch's own warn call, which had no guard above it at all.
    const blocker = join(dir, "blocker");
    writeFileSync(blocker, "not a directory\n");
    let unwritable;
    assert.doesNotThrow(() => {
      unwritable = withSink(join(blocker, "spans.jsonl"),
        () => emitCeremonySpan(FIELDS, { warn: onFire }));
    });
    assert.equal(unwritable.reasonCode, "SPAN_SINK_UNWRITABLE");
  });
});

test("a non-object second argument is tolerated rather than thrown on", () => {
  withTempDir((dir) => {
    const sink = join(dir, "spans.jsonl");
    // The old signature destructured the options object in the parameter list, which
    // runs BEFORE the body — so this threw from a position no catch inside could cover.
    for (const options of [null, 0, "warn", true, Symbol("seam")]) {
      let result;
      assert.doesNotThrow(() => {
        result = withSink(sink, () => emitCeremonySpan(FIELDS, options));
      }, `options=${String(options)} must not throw`);
      assert.equal(result.emitted, true);
    }
    assert.equal(sinkLines(sink).length, 5);
  });
});

test("a seam that is not a function falls back instead of failing when called", () => {
  withTempDir((dir) => {
    const sink = join(dir, "spans.jsonl");
    let result;
    assert.doesNotThrow(() => {
      result = withSink(sink, () => emitCeremonySpan(FIELDS, { warn: "not a function", buildRecord: 42 }));
    });
    assert.equal(result.emitted, true, "the shipped builder is used when the injected one is unusable");
    assert.equal(sinkLines(sink).length, 1);
  });
});

test("an error whose own message getter throws is still described, not rethrown", () => {
  withTempDir((dir) => {
    const log = collector();
    const hostile = () => {
      // Not an Error: a thrown value engineered so that the catch block's own attempt
      // to render it is the second throw. Reading `.message` inside a catch is a
      // property access, and a property access can run code.
      throw { get message() { throw new Error("unreachable"); }, get code() { throw new Error("unreachable"); } };
    };
    let result;
    assert.doesNotThrow(() => {
      result = withSink(join(dir, "spans.jsonl"),
        () => emitCeremonySpan(FIELDS, { buildRecord: hostile, warn: log.warn }));
    });
    assert.equal(result.reasonCode, "SPAN_SINK_UNWRITABLE");
    assert.equal(log.lines.length, 1);
    assert.match(log.lines[0], /error not describable/u);
  });
});

test("options is read through, not ignored: the seams still take effect", () => {
  // The guard against the tolerance above hiding a seam that never arrived — the same
  // trap as two different inputs answering with one reason code.
  withTempDir((dir) => {
    const log = collector();
    const tagged = (fields) => ({ ...buildSpanRecord(fields), strayKeyFromTheSeam: 1 });
    const result = withSink(join(dir, "spans.jsonl"),
      () => emitCeremonySpan(FIELDS, { buildRecord: tagged, warn: log.warn }));
    assert.equal(result.reasonCode, "SPAN_FIELD_NOT_ALLOWED");
    assert.deepEqual(result.disallowed, ["strayKeyFromTheSeam"]);
    assert.equal(log.lines.length, 1, "the injected warn, not the default one, received the drop");
  });
});
