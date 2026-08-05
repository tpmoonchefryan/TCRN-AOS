// S10 (TCRN-CROSS-STORY-150) — ceremony lifecycle spans (observability).
//
// Emits JSONL span records for the ceremony lifecycle: start / end / readback /
// refused. Labels are ONLY partition / verb / expected-version — never payload
// content, argv, chain bytes, or reason detail (privacy: the sink must carry no
// chain content). The sink path is TCRN_OTEL_SINK (env), defaulting to a runtime
// path under the platform root (the platform root is not a git repository, so a
// runtime log there cannot pollute a checkout).
//
// Non-throwing by design: observability must never break the ceremony it watches.
// Both failure modes — a record the privacy contract refuses, and a sink that
// cannot be written — drop the record and report one line on stderr. Nothing here
// throws into a live ceremony, and nothing here fails silently either: a drop is
// visible on stderr and in this function's return value.
//
// "Must never break" is a claim about the whole emit path, so read it as covering
// three things and not just the obvious one: the emitter does not throw, the
// DIAGNOSTIC CHANNEL does not throw (a channel that dies loudly is worse than one
// that is merely gone), and a caller-injected seam that throws does not escape
// either. Each of the three has already failed here once; see below.
//
// TCRN-AOS INIT-018 QA F6: until 2026-08-05 the privacy check threw, and it threw
// from OUTSIDE the try, while the comment beside it claimed "never during a live
// ceremony — see the catch below". No catch covered it, and none of ceremony.mjs's
// ten call sites has one either, so the first record that ever tripped that check
// would have aborted a live governed ceremony to protect a log file. The check is
// now inside the try and drops the record instead of throwing.
//
// TCRN-CROSS-INC-041 R2-B: that first fix was itself an instance of the class it
// was fixing. The diagnostic channel wrote through `process.stderr.write`, which on
// a PIPE is asynchronous — the write is queued, and a read end that has already gone
// away surfaces as an EPIPE delivered later as the stream's `error` event. A
// try/catch around the call cannot catch an event, so the "last resort" catch here
// caught nothing and the unhandled `error` killed the ceremony. Measured on the real
// ceremony (dry run, cross-project, an unwritable TCRN_OTEL_SINK so the diagnostic
// branch is actually taken, and the read end of fd 2 closed): exit code 1 while the
// receipt already printed on stdout said ok:true — the exit code and the receipt
// contradicting each other, which is the worst possible shape for a governance tool.
// The channel now writes with `fs.writeSync` straight to the descriptor, which is a
// synchronous syscall wrapper and therefore reports EPIPE / EBADF by THROWING, where
// a try/catch is a real guard rather than a decorative one.
import { appendFileSync, mkdirSync, writeSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PLATFORM_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const DEFAULT_SINK = resolve(PLATFORM_ROOT, "var/tcrn-otel/ceremony-spans.jsonl");

export function ceremonySinkPath() {
  return process.env.TCRN_OTEL_SINK ?? DEFAULT_SINK;
}

/** Allowed span fields — the only thing the sink may ever carry. */
export const ALLOWED_SPAN_KEYS = Object.freeze(["span", "at", "partition", "verb", "expectedVersion", "outcome", "reasonCode"]);

/**
 * The record shape, built from these seven literals and nothing else — which is
 * why the privacy check below is structurally unreachable today. The check is a
 * guard rail for whoever edits THIS function next: add a field here without adding
 * it to ALLOWED_SPAN_KEYS and every span is dropped and reported, rather than
 * chain content being appended to a log nobody re-reads.
 */
export function buildSpanRecord({ span, partition, verb = null, expectedVersion = null, outcome, reasonCode = null }) {
  return {
    span,
    at: new Date().toISOString(),
    partition,
    verb: verb ?? null,
    expectedVersion: Number.isInteger(expectedVersion) ? expectedVersion : null,
    outcome,
    reasonCode: reasonCode ?? null
  };
}

/** The keys of `record` that the S10 privacy contract does not admit. */
export function disallowedSpanKeys(record) {
  return Object.keys(record).filter((key) => !ALLOWED_SPAN_KEYS.includes(key));
}

/** stderr's descriptor. Written to directly — see `writeLineToFd` for why. */
const STDERR_FD = 2;

/** How many `writeSync` syscalls one diagnostic line is allowed to cost. */
const WRITE_ATTEMPTS = 8;

/**
 * An error's `code`, or null — without trusting the error to be well behaved.
 * Reading `.code` is a property access, and a property access can run a getter,
 * and this is called from inside a catch block whose whole purpose is to be the
 * place nothing escapes from.
 */
function errorCode(error) {
  try {
    const code = error?.code;
    return typeof code === "string" ? code : null;
  } catch {
    return null;
  }
}

/** An error rendered as text, from inside a catch, without a second throw. */
function describeError(error) {
  try {
    const message = error?.message;
    if (typeof message === "string" && message !== "") return message;
    return String(error);
  } catch {
    return "<error not describable>";
  }
}

/**
 * Write one line straight to a descriptor, synchronously, and never throw.
 *
 * `fs.writeSync` is the point of this function. A stream write (`process.stderr.write`)
 * on a pipe hands the bytes to libuv and reports failure LATER as an `error` event; an
 * event cannot be caught by the try/catch around the call, so it reaches the process as
 * an unhandled `error` and kills it. `writeSync` performs the `write(2)` inline and
 * turns a failed syscall into a thrown Error at the call site, which is the only form
 * this file can actually contain. That is why all three of the ways this channel dies
 * are survivable here:
 *
 *   - EPIPE   — the read end of the pipe is gone (the operator piped into `head`, or
 *               into a viewer they quit). `write(2)` fails; `writeSync` throws; caught.
 *               (Node ignores SIGPIPE process-wide, so the signal is not a second path.)
 *   - EBADF   — fd 2 was closed outright. Same: the syscall fails, `writeSync` throws.
 *   - EAGAIN  — fd 2 is a non-blocking pipe that is momentarily full. Also thrown, and
 *               the only one worth retrying; the retry is bounded so a descriptor that
 *               never drains costs a fixed number of syscalls rather than an unbounded
 *               spin inside a live ceremony.
 *
 * Anything else (ENOSPC, EIO, a descriptor pointing at a full disk) means the channel
 * is gone for good and the line is dropped. Dropping a diagnostic is a loss; aborting
 * a governed write to preserve one is a defect.
 *
 * Three costs of leaving the stream behind, named rather than discovered later:
 *
 *   1. A BLOCKING pipe with a slow reader now blocks the ceremony for the duration of
 *      the `write(2)` instead of queueing. That is the trade being made on purpose:
 *      bounded waiting on a reader that exists, in exchange for never dying because of
 *      one that does not. It is also what Node already does for a stderr that is a file
 *      or a TTY — only the pipe case was asynchronous, and only the pipe case crashed.
 *   2. Interleaving with anything else in the process that writes fd 2 through the
 *      stream is no longer ordered. Nothing in the ceremony does (`ceremony.mjs` touches
 *      `process.stderr` only on the usage path, which exits before any span is emitted).
 *   3. A line longer than the descriptor accepts in `WRITE_ATTEMPTS` writes is truncated
 *      rather than retried forever. Diagnostics here are a few hundred bytes; a truncated
 *      diagnostic is a smaller loss than an unbounded loop inside a live ceremony.
 *
 * @returns {boolean} whether the whole line reached the descriptor.
 */
function writeLineToFd(fd, line) {
  let buffer;
  try {
    buffer = Buffer.from(line, "utf8");
  } catch {
    return false;
  }
  let written = 0;
  for (let attempt = 0; attempt < WRITE_ATTEMPTS && written < buffer.length; attempt += 1) {
    let advanced = 0;
    try {
      advanced = writeSync(fd, buffer, written, buffer.length - written);
    } catch (error) {
      if (errorCode(error) === "EAGAIN") continue;
      return false;
    }
    if (!Number.isInteger(advanced) || advanced <= 0) return false;
    written += advanced;
  }
  return written >= buffer.length;
}

/**
 * Last-resort diagnostic channel. A dropped span must be observable — a silently
 * dead observation channel is indistinguishable from a quiet one, and this platform
 * has already been bitten by exactly that (INIT-018 QA F1). Where the channel itself
 * is gone there is nowhere left to report to, and a ceremony still must not die over
 * a log line: `writeLineToFd` returns false and that is the end of it.
 */
function warnToStderr(message) {
  writeLineToFd(STDERR_FD, `[ceremony-spans] ${message}\n`);
}

/**
 * Call a diagnostic sink without letting it throw.
 *
 * `warn` is an injection seam, so it is caller code, and caller code that throws must
 * not become the thing that kills the ceremony. This matters beyond tidiness: the
 * refusal branch below calls `warn` from INSIDE the try, so a throwing sink there lands
 * in the catch — which calls `warn` again, and that second throw has no catch left and
 * escapes. Routing every call through here closes that path as well as the first one.
 * The drop still is not silent: a sink that throws is itself reported to the descriptor.
 */
function warnSafely(warn, message) {
  try {
    warn(message);
  } catch {
    writeLineToFd(STDERR_FD, `[ceremony-spans] diagnostic sink threw; dropped message: ${message}\n`);
  }
}

/**
 * Append one span to the sink. Total: there is no input, no environment and no
 * injected seam for which this function throws.
 *
 * The parameter list is two bare identifiers on purpose. The previous signature
 * destructured the options object with defaults, and destructuring happens BEFORE
 * the function body — so `emitCeremonySpan(fields, null)` threw from a position no
 * catch inside the body could ever cover, the same structural mistake as F6 and
 * R2-B in a third place. Seams are therefore resolved inside the try, tolerantly:
 * a seam that is not a function falls back to the shipped implementation rather
 * than throwing when it is called.
 *
 * @returns {{emitted: boolean, reasonCode: string|null, disallowed: string[]}}
 *   `emitted:false` with `SPAN_FIELD_NOT_ALLOWED` (privacy contract refused the
 *   record) or `SPAN_SINK_UNWRITABLE` (the sink could not be appended to).
 *   The second parameter is a seam for the tests: `buildRecord` stands in for a
 *   future edit of the literal above, `warn` captures the diagnostic.
 */
export function emitCeremonySpan(fields, options) {
  // Bound before the try so the catch always has a channel, even if resolving the
  // seams is itself what failed.
  let warn = warnToStderr;
  try {
    const seams = typeof options === "object" && options !== null ? options : {};
    if (typeof seams.warn === "function") warn = seams.warn;
    const buildRecord = typeof seams.buildRecord === "function" ? seams.buildRecord : buildSpanRecord;

    const record = buildRecord(fields);
    const disallowed = disallowedSpanKeys(record);
    if (disallowed.length > 0) {
      // Names the offending keys, never their values: the diagnostic must not
      // become the leak the contract exists to prevent.
      warnSafely(warn, `span dropped: field(s) not allowed by the S10 privacy contract: ${disallowed.join(", ")}`);
      return { emitted: false, reasonCode: "SPAN_FIELD_NOT_ALLOWED", disallowed };
    }
    // Read once. Two reads of a mutable environment variable could put the mkdir
    // and the append on different paths.
    const sink = ceremonySinkPath();
    mkdirSync(dirname(sink), { recursive: true });
    appendFileSync(sink, `${JSON.stringify(record)}\n`);
    return { emitted: true, reasonCode: null, disallowed: [] };
  } catch (error) {
    // Observability must never break the ceremony — but it must not go quiet either.
    // Every expression on this line is total: `warnSafely` swallows a throwing sink,
    // `describeError` survives an error whose own `message` getter throws.
    warnSafely(warn, `span dropped: sink unwritable: ${describeError(error)}`);
    return { emitted: false, reasonCode: "SPAN_SINK_UNWRITABLE", disallowed: [] };
  }
}
