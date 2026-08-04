#!/usr/bin/env node
// TCRN-CROSS-INIT-017 — single-authority + fallback machinery.
//
// AOS (the VM) is the single authority for every partition chain. The local
// machine holds a per-partition fallback QUEUE, used ONLY when AOS is unreachable,
// so a write is never silently dropped. When AOS returns, the backlog is replayed
// onto the AOS chain.
//
//   node deploy/aos-local-client/fallback-cli.mjs probe
//       Reachability of the AOS write face. Exit 0 = reachable, non-zero = down.
//
//   node deploy/aos-local-client/fallback-cli.mjs write --partition <id> \
//       --actor <agent:<model>|person:<id>> --args '[...]'
//       Write one governed action. If AOS is reachable it goes straight to the
//       AOS ceremony; if not, it is appended to the partition's fallback queue and
//       recorded for replay. `--actor` is REQUIRED and is stored on the queue entry:
//       a replay that defaulted it would record every backlogged write as the
//       wrapper's default agent, whoever actually queued it (EPIC-041 attribution).
//
//   node deploy/aos-local-client/fallback-cli.mjs replay --partition <id>
//       Replay the backlog onto the AOS chain, in order, as one all-or-nothing
//       ceremony batch.
//
// What the fallback buffer actually is: a plain JSON queue file (shadow-queue.json)
// sitting BESIDE the partition's shadow workspace, not inside it. Each partition's
// shadow workspace is an init'd control tree, but this tool never writes governed
// events into it — a queued action is stored verbatim as the engine argv it would
// have run, and is executed against no chain at all. On replay those argv records
// are issued to the AOS chain as fresh writes through the ceremony; nothing is
// byte-merged into the authority's event log (the engine has no cross-chain merge —
// ADR 0003's four ceilings). The AOS chain is the only authority throughout.
//
// A queued argv is re-issued through the ceremony as {verb, flags}, and turning argv
// back into flags is NOT a pairwise walk: the host engine defines boolean flags
// (conference-close --distill, knowledge-body --allow-stale, and eight more as of
// 2026-08-04), so `[..., "--allow-stale"]` and `[..., "--scope", "x"]` have the same
// shape and different meanings. The parse therefore consults the host engine's own
// `commands` catalogue, read live at replay time, and refuses anything it cannot
// represent rather than guessing — a guess here does not go red anywhere, it just
// replays a different governed command from the one that was queued.

import { execFileSync } from "node:child_process";
import {
  closeSync, existsSync, fsyncSync, mkdirSync, mkdtempSync, openSync, readFileSync,
  renameSync, rmSync, unlinkSync, writeFileSync, writeSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { aosPartition } from "./aos-partitions.mjs";
import { VM_HOST } from "./topology.mjs";
import { RESERVED_FLAGS, catalogueIndex } from "./ceremony-plan.mjs";
import { remoteEngine } from "./ceremony.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PLATFORM_ROOT = resolve(REPO_ROOT, "..");
const WORKSPACE_CONTAINER = join(PLATFORM_ROOT, ".tcrn-workspace");

// The host is IMPORTED, never typed here. topology.mjs re-exports it from
// deploy/aos-resident-cockpit/manifest.mjs — the constants already rendered into
// the systemd unit that serves the chain. A literal here would let this probe and
// the ceremony that performs the write point at different machines the first time
// somebody moved the truth root, with nothing going red.
const AOS_PROBE = ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=3", VM_HOST, "echo ok"];

/**
 * Partitions under single-authority. A partition is usable when its chain has
 * been relocated to the AOS host (its AOS workspace exists in aos-partitions).
 * `shadowWorkspace` only names WHERE that partition's queue file lives (beside it);
 * it is not a second authority, and the AOS partition has none because it IS the
 * authority — that null is guarded, never dereferenced.
 */
const PARTITIONS = {
  "Joi-Button": {
    aosWorkspace: aosPartition("Joi-Button").workspace,
    shadowWorkspace: join(WORKSPACE_CONTAINER, "Joi-Button-shadow/workspace"),
  },
  "cross-project": {
    aosWorkspace: aosPartition("cross-project").workspace,
    shadowWorkspace: join(WORKSPACE_CONTAINER, "cross-project-shadow/workspace"),
  },
  "TCRN-Design-System": {
    aosWorkspace: aosPartition("TCRN-Design-System").workspace,
    shadowWorkspace: join(WORKSPACE_CONTAINER, "TCRN-Design-System-shadow/workspace"),
  },
  "TCRN-TMS": {
    aosWorkspace: aosPartition("TCRN-TMS").workspace,
    shadowWorkspace: join(WORKSPACE_CONTAINER, "TCRN-TMS-shadow/workspace"),
  },
  "TCRN-AOS": {
    aosWorkspace: aosPartition("TCRN-AOS").workspace,
    shadowWorkspace: null, // the AOS partition itself has no shadow (it IS the authority)
  },
};

function sh(args, { allowFailure = false } = {}) {
  try {
    return { code: 0, stdout: execFileSync(args[0], args.slice(1), { encoding: "utf8" }) };
  } catch (error) {
    if (allowFailure) return { code: error.status ?? 1, stdout: String(error.stdout ?? "") };
    throw error;
  }
}

/** AOS reachable? Exit code 0 = yes. */
function probe() {
  const result = sh(AOS_PROBE, { allowFailure: true });
  return result.code === 0;
}

/**
 * The same actor predicate `ceremony.mjs` applies to a payload's actor
 * (`assertAttributedActor`), restated here because that function is module-private.
 *
 * It has to be applied HERE and not only there: ceremony.mjs validates
 * `payload.actor`, and a replay carries its actors per STEP (`flags.actor`), which
 * nothing downstream checks. So for a replayed write this is the only enforcement
 * of "every governed write says who performed it" (EPIC-041). If ceremony.mjs ever
 * exports its predicate, import it and delete this one — two copies of a rule is a
 * drift waiting to happen, and this copy exists only because the export does not.
 */
const ATTRIBUTED_ACTOR = /^(?:agent|person):[A-Za-z0-9._:-]+$/u;
export function isAttributedActor(actor) {
  return typeof actor === "string" && ATTRIBUTED_ACTOR.test(actor);
}

/** Every partition-scoped queue operation refuses here rather than in dirname(). */
export function shadowQueueFile(partition) {
  const entry = PARTITIONS[partition];
  if (!entry) {
    throw new Error(`unknown partition ${partition}; known: ${Object.keys(PARTITIONS).join(", ")}`);
  }
  if (!entry.shadowWorkspace) {
    // The AOS partition IS the single authority, so it has no fallback buffer and
    // there is no queue file to name. Without this, dirname(null) raised
    // ERR_INVALID_ARG_TYPE with a stack trace — which reads as a broken tool rather
    // than as the deliberate refusal it is.
    throw new Error(
      `partition ${partition} is the AOS authority and has no shadow buffer; the fallback queue and its replay do not apply to it`
    );
  }
  return join(dirname(entry.shadowWorkspace), "shadow-queue.json");
}

function readLockHolder(lock) {
  try {
    const record = JSON.parse(readFileSync(lock, "utf8"));
    return {
      pid: Number.isInteger(record?.pid) ? record.pid : null,
      since: typeof record?.since === "string" ? record.since : null
    };
  } catch {
    return { pid: null, since: null };
  }
}

/** Is that pid still a process on THIS machine? EPERM means yes, just not ours. */
function processAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

/** A blocking sleep, because every path that holds this lock is synchronous. */
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Serialise every mutation of one partition's queue.
 *
 * Atomic writes buy write-WHOLENESS, not sequence-safety: an append is a
 * read-modify-write, so two `write` invocations during one AOS outage — precisely
 * the situation the queue exists for — can both read the same array and the second
 * rename wins, discarding the first entry with nothing going red. The lock is what
 * makes "a queued write is never lost" true; the rename only makes each file whole.
 * Measured before the lock existed: eight concurrent appends to one file kept ONE,
 * and all eight reported success.
 *
 * `openSync(lock, "wx")` is the claim: it fails if the file exists, so the check and
 * the take are one syscall. A contended lock is WAITED for up to `waitMs` and only
 * then refused — an append blocked for the milliseconds another append needs must
 * succeed, not fail, or the queue would drop writes by a different route than the one
 * this fixes. What the wait must never become is silent: past the deadline (a replay
 * ceremony holds the lock for as long as an SSH batch takes) the caller gets a named
 * refusal naming the lock and its holder, never a lost write.
 *
 * A holder that died without releasing (SIGKILL, Ctrl-C mid-replay) would otherwise
 * wedge the queue forever, so a lock whose recorded pid is no longer running is broken
 * loudly and re-taken. CEILING: pids are reused, so a long-dead holder whose number has
 * been handed to an unrelated process reads as live and the lock is refused instead of
 * broken — that direction is the safe one (a refusal a human resolves, never two
 * writers in the file at once).
 *
 * Returns the release function; call it in a `finally`. Nothing inside a held lock
 * may call `process.exit` — exit skips `finally`, and the lock file would survive.
 */
export function acquireQueueLock(file, { waitMs = 10_000, pollMs = 25 } = {}) {
  const lock = `${file}.lock`;
  mkdirSync(dirname(lock), { recursive: true });
  const claim = () => {
    const fd = openSync(lock, "wx");
    try {
      writeSync(fd, `${JSON.stringify({ pid: process.pid, since: new Date().toISOString() })}\n`);
    } finally {
      closeSync(fd);
    }
  };
  const release = () => {
    try {
      unlinkSync(lock);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  };
  const deadline = Date.now() + Math.max(0, waitMs);
  for (;;) {
    try {
      claim();
      return release;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      const holder = readLockHolder(lock);
      if (holder.pid !== null && !processAlive(holder.pid)) {
        console.error(
          `shadow queue lock ${lock} records pid ${holder.pid}, which is no longer running; breaking the stale lock`
        );
        release();
        continue; // re-claim immediately; a racing breaker just puts us back here
      }
      if (Date.now() >= deadline) {
        throw new Error(
          `shadow queue ${file} is locked by ${lock}`
          + (holder.pid === null ? "" : ` (pid ${holder.pid}, held since ${holder.since ?? "an unrecorded time"})`)
          + `; another write or replay of this partition still held it after ${waitMs}ms. Retry once that `
          + "finishes; if that process is gone and this lock outlived it, remove that file by hand."
        );
      }
      sleepSync(pollMs);
    }
  }
}

/**
 * Same-directory temp file, flushed, then renamed — and the directory flushed after.
 *
 * WHAT THIS COVERS, exactly: a process that dies at any point leaves either the old
 * backlog or the new one, never the truncated middle of a `writeFileSync` — which is
 * the state that would then be read as "corrupt" and block every later replay. The
 * temp file's bytes are `fsync`'d before the rename, so the directory entry cannot
 * become visible ahead of the data it points at.
 *
 * WHAT IT DOES NOT COVER, and this sentence is the honest half: on macOS `fsync`
 * hands the data to the drive, it does not make the drive flush its own write cache
 * (that is `F_FULLFSYNC`, which node does not expose), and the directory flush is
 * best-effort because a platform may refuse to open a directory for reading. So a
 * HOST crash or power loss between the rename and writeback can still lose the last
 * write. The claim here is "a crash of this process is survivable", not "a power cut
 * is", and nothing in this repository tests the latter.
 */
export function writeQueueAtomic(file, queue) {
  const directory = dirname(file);
  mkdirSync(directory, { recursive: true });
  const temp = `${file}.tmp-${process.pid}-${Date.now()}`;
  try {
    const fd = openSync(temp, "wx");
    try {
      writeSync(fd, JSON.stringify(queue, null, 2) + "\n");
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(temp, file);
    try {
      const dirFd = openSync(directory, "r");
      try {
        fsyncSync(dirFd);
      } finally {
        closeSync(dirFd);
      }
    } catch {
      // A platform that will not open a directory for reading cannot be asked to
      // flush one. The rename already succeeded; reporting it as a failure because
      // the flush was unavailable would be worse than the missing flush.
    }
  } catch (error) {
    // On a thrown error the temp is removed. A SIGKILL can still leave one behind;
    // it carries this process's pid in its name, is never read back, and can never
    // be mistaken for the queue itself.
    try { unlinkSync(temp); } catch { /* nothing was written, nothing to remove */ }
    throw error;
  }
}

/**
 * A corrupt queue file is a LOUD failure, never an empty backlog. Reporting zero
 * queued actions would let the next append overwrite the file with a fresh array,
 * destroying every un-replayed write — the single thing this fallback exists to
 * prevent. A missing file, by contrast, genuinely means "nothing queued".
 */
export function readQueueFile(file) {
  if (!existsSync(file)) return [];
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(
      `shadow queue ${file} is corrupt (${error.message}); refusing to silently drop the backlog — repair or move that file by hand, then retry`
    );
  }
  if (!Array.isArray(parsed)) {
    throw new Error(
      `shadow queue ${file} is not a JSON array; refusing to silently drop the backlog — repair or move that file by hand, then retry`
    );
  }
  return parsed;
}

/**
 * What a queue entry must be for a replay to re-issue it faithfully — checked when
 * it is OFFERED, so a shape the replay cannot honour is refused by the writer who
 * can still fix it rather than discovered by whoever runs the replay days later.
 *
 * Only catalogue-free properties are checked here, and that limit is the honest one:
 * an entry is queued precisely when AOS is unreachable, so the host engine's verb and
 * flag catalogue — the only authority on whether `--allow-stale` takes a value — is
 * by definition unavailable at this moment. Verb and flag fidelity is therefore
 * checked at replay, against the live catalogue, in buildReplayPayload.
 */
export function assertQueueEntry(entry, where) {
  if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
    throw new Error(`${where}: a queue entry must be a JSON object`);
  }
  const { args } = entry;
  if (!Array.isArray(args) || args.length === 0 || !args.every((token) => typeof token === "string")) {
    throw new Error(
      `${where}: args must be a non-empty JSON array of strings (the engine argv, verb first)`
    );
  }
  if (args[0].startsWith("--")) {
    throw new Error(`${where}: args[0] must be the engine verb, not a flag (got ${JSON.stringify(args[0])})`);
  }
  if (!isAttributedActor(entry.actor)) {
    throw new Error(
      `${where}: actor must be an attributed actor (agent:<model> or person:<id>); got `
      + `${JSON.stringify(entry.actor ?? null)}. A replay that defaulted here would record the write `
      + "as the ceremony's default agent whoever actually queued it."
    );
  }
  return entry;
}

export function appendQueue(partition, entry) {
  const file = shadowQueueFile(partition);
  assertQueueEntry(entry, `queued action for ${partition}`);
  const release = acquireQueueLock(file);
  try {
    const queue = readQueueFile(file);
    queue.push({ ...entry, queuedAt: new Date().toISOString() });
    writeQueueAtomic(file, queue);
    return queue.length;
  } finally {
    release();
  }
}

/**
 * Write one governed action. `args` is the argv for the engine verb (e.g.
 * ["work-create", "--external-key", "...", ...]) WITHOUT --workspace/--attest-dir/
 * --expected-version/--actor: the first three belong to the ceremony's topology and
 * to a live head read, and the actor is carried on the entry (`--actor`) so the
 * replay can re-emit the actor who queued it rather than a default. If AOS is
 * reachable, the caller drives the ceremony directly (this tool just reports
 * reachable). If AOS is down, the action is QUEUED — recorded verbatim, not
 * executed against any chain — so that replay can issue it to the AOS chain
 * later with correct partition-scoped parameters.
 */
function writeAction(partition, args, actor) {
  const entry = PARTITIONS[partition];
  if (!entry) {
    console.error(`unknown partition ${partition}; known: ${Object.keys(PARTITIONS).join(", ")}`);
    process.exit(2);
  }
  // Validated before the probe, so a malformed request is refused the same way on
  // both routes instead of being accepted whenever AOS happens to be up.
  try {
    assertQueueEntry({ verb: args[0], args, actor }, "write");
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
  if (probe()) {
    // AOS reachable — the caller drives the ceremony directly.
    console.log(JSON.stringify({ ok: true, route: "aos", partition, actor }));
    return;
  }
  // AOS down — queue the action verbatim for replay onto the AOS chain.
  if (!entry.shadowWorkspace) {
    console.error(
      `partition ${partition} is the AOS authority and has no shadow buffer; while AOS is unreachable its writes cannot be queued anywhere`
    );
    process.exit(2);
  }
  const depth = appendQueue(partition, { verb: args[0], args, actor });
  console.log(JSON.stringify({ ok: true, route: "queued", partition, actor, queued: true, backlog: depth }));
}

/**
 * One queued argv, turned back into the ceremony's {flag: value} form using the host
 * engine's own declaration of what each flag takes.
 *
 * The catalogue is load-bearing, not a nicety. A pairwise walk over the argv
 * (`flags[rest[i]] = rest[i+1]`) is correct only for argv that is exactly
 * [verb, --flag, value, ...]; the host engine declares ten boolean flags, and
 * `["knowledge-body", "--id", "x", "--allow-unpromoted", "--allow-stale"]` walks
 * pairwise into `{"allow-unpromoted": "--allow-stale"}` — a different governed
 * command, accepted by every downstream check, with nothing going red. A trailing
 * boolean is worse still: it walks into `undefined`, and `JSON.stringify` drops an
 * undefined value on the way to the payload file, so the flag simply vanishes.
 *
 * The host engine's CLI takes a VALUE for every flag, booleans included: measured
 * 2026-08-04 against the live engine, `--allow-stale` alone is refused outright
 * (`CLI_ARGUMENT_MALFORMED`), while `--allow-stale true` and `--allow-stale=true`
 * both reach the verb. So a bare boolean is refused here too, rather than recorded
 * as "true" — inventing the value would let the fallback route replay an argv the
 * direct route rejects, which is a guess in the one function whose whole purpose is
 * refusing to guess. Both accepted spellings are honoured, including `--flag=value`.
 * Anything the catalogue cannot explain — an undeclared flag, a repeat, a stray
 * non-flag token, a value-taking flag at the end of the argv — throws naming the
 * entry, because re-issuing a guess is the failure this whole file exists to prevent.
 */
function flagsFromQueuedArgv(args, command, where) {
  const flags = {};
  for (let index = 1; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith("--") || token.length <= 2) {
      throw new Error(
        `${where}: expected a --flag at argv[${index}], found ${JSON.stringify(token)}; the queue stores `
        + "the engine argv verbatim and a token that is neither a flag nor a flag's value cannot be re-issued"
      );
    }
    // `--name=value` is a spelling the host engine accepts, so it must survive the
    // round trip; splitting here also stops the name lookup from reporting the whole
    // `allow-stale=true` token as an undeclared flag, which named the wrong problem.
    const equals = token.indexOf("=");
    const name = equals === -1 ? token.slice(2) : token.slice(2, equals);
    const inlineValue = equals === -1 ? null : token.slice(equals + 1);
    const spec = command.flags.get(name);
    if (!spec) {
      throw new Error(`${where}: the host engine's ${command.name} declares no --${name}`);
    }
    if (Object.hasOwn(flags, name)) {
      throw new Error(
        `${where}: --${name} appears more than once; keeping the last occurrence would replay a `
        + "different command from the one that was queued (a list flag carries its values in one "
        + "comma-separated token, not as a repeated flag)"
      );
    }
    if (inlineValue !== null) {
      flags[name] = inlineValue;
      continue;
    }
    const next = args[index + 1];
    if (next === undefined || next.startsWith("--")) {
      throw new Error(
        `${where}: --${name} is a ${spec.valueKind} the host engine still requires a value for; `
        + `queue --${name} <value> (or --${name}=<value>) — a bare flag is CLI_ARGUMENT_MALFORMED there, `
        + "so recording it as \"true\" here would replay an argv the engine would have refused"
      );
    }
    flags[name] = next;
    index += 1;
  }
  return flags;
}

/**
 * The ceremony payload for one replay: each queued argv record becomes a step, and the
 * read-back proves the batch reached THIS partition's chain.
 *
 * `catalogue` is the host engine's own `commands` output indexed by
 * `ceremony-plan.mjs`'s `catalogueIndex`, and it is REQUIRED rather than optional on
 * purpose: without it there is no way to tell a boolean flag from a flag whose value
 * was omitted, and an optional catalogue would mean the faithful parse quietly stops
 * happening the day somebody forgets to pass one.
 *
 * Pure and exported so the anchor choice and the argv parse can be checked without
 * sending anything — the bug this replaced could only ever be caught by an actual
 * replay against a live chain, which is the one thing nobody runs on a whim.
 */
export function buildReplayPayload(partition, queue, catalogue) {
  if (!(catalogue instanceof Map) || catalogue.size === 0) {
    throw new Error(
      "buildReplayPayload requires the host engine's own commands catalogue (catalogueIndex of its "
      + "`commands` output); a queued argv cannot be re-issued faithfully without it"
    );
  }
  const actors = new Set();
  const steps = queue.map((queued, index) => {
    const where = `shadow queue entry [${index}]`;
    assertQueueEntry(queued, where);
    const verb = queued.args[0];
    const command = catalogue.get(verb);
    if (!command) {
      throw new Error(`${where}: the host engine's commands catalogue declares no verb ${verb}`);
    }
    const flags = flagsFromQueuedArgv(queued.args, command, where);
    for (const reserved of RESERVED_FLAGS) {
      if (Object.hasOwn(flags, reserved)) {
        throw new Error(
          `${where}: --${reserved} is supplied by the ceremony (from the topology, or from a head read `
          + "taken moments before the write) and may not be queued"
        );
      }
    }
    if (Object.hasOwn(flags, "actor")) {
      throw new Error(
        `${where}: --actor may not be queued inside the argv; the actor is carried on the entry and `
        + "re-emitted here, so two sources for it could disagree"
      );
    }
    // Attribution survives the outage (EPIC-041). Only where the verb declares the
    // flag: planStep refuses a flag the verb does not define, so emitting it blindly
    // would make the 24 mutating verbs that take no --actor unreplayable. On those,
    // the engine records whatever it records — this client cannot attribute a write
    // the engine does not let it attribute, and pretending otherwise would be worse.
    if (command.flags.has("actor")) flags.actor = queued.actor;
    actors.add(queued.actor);
    // Post-condition, not a measurement: the wire format between here and the
    // ceremony is a JSON file, and JSON.stringify drops an undefined VALUE silently.
    // A flag that parsed to anything but a string must die here, loudly, rather than
    // disappear from the payload on the way to disk.
    for (const [name, value] of Object.entries(flags)) {
      if (typeof value !== "string") {
        throw new Error(
          `${where}: --${name} did not parse to a string value; a non-string would be dropped or `
          + "coerced by the JSON payload and the replayed step would not be the queued one"
        );
      }
    }
    return { verb, flags };
  });
  // The read-back targets a stable record on THIS partition's own chain, to prove the
  // replay reached the chain it was aimed at (a record the replay just created has no
  // id until after the write lands). The anchor therefore comes per-partition from
  // aos-partitions.mjs: this read-back used to be hardcoded to Joi-Button's root
  // Initiative for every partition except TCRN-AOS, so on cross-project, the Design
  // System and TMS the engine answered WORKSPACE_INPUT_INVALID for a record their
  // chains do not contain — the read-back could never pass, replay always failed, and
  // the backlog could never clear. Only externalKey is asserted; the anchor's status
  // moves as its Initiative progresses.
  const { anchor } = aosPartition(partition);
  if (!anchor?.id || !anchor?.externalKey) {
    throw new Error(
      `partition ${partition} has no read-back anchor in aos-partitions.mjs; a replay that cannot be read back is not proven`
    );
  }
  // A batch-level actor is stated only when the backlog agrees on one. It is what the
  // receipt reports as the ceremony's actor, so naming one of several would make the
  // receipt say something untrue; steps carry their own actor either way.
  const soleActor = actors.size === 1 ? [...actors][0] : null;
  return {
    schemaVersion: "aos.local-client-ceremony.v1",
    story: "TCRN-CROSS-INIT-017",
    intent: `shadow replay for ${partition} after AOS recovery`,
    ...(soleActor === null ? {} : { actor: soleActor }),
    steps,
    readback: [{
      verb: "work-show",
      flags: { id: anchor.id },
      recordFields: ["externalKey", "status"],
      expect: { externalKey: anchor.externalKey },
    }],
  };
}

/** The host engine's own verb catalogue, read live. Nothing here is remembered. */
async function hostCatalogue() {
  const result = await remoteEngine(["commands"]);
  if (!result.accepted) {
    throw new Error(
      `the host engine would not report its commands catalogue (${result.reasonCode ?? result.exitCode}); `
      + "a queued argv cannot be re-issued faithfully without it, so the backlog is left untouched"
    );
  }
  const commands = result.json.commands ?? result.json.result?.commands ?? [];
  return catalogueIndex(commands);
}

/**
 * Replay the backlog onto the AOS chain. The whole backlog goes out as ONE ceremony
 * payload, in order, and it is ALL-OR-NOTHING: the queue is trimmed only when every
 * step and the read-back succeeded. On any failure the queue is left exactly as it
 * was, so the next replay re-issues the entire backlog from the first entry —
 * including steps that already landed before the failure. Replayed actions must
 * therefore tolerate being issued twice (an idempotent write, or a duplicate-key
 * refusal a human resolves); replay does not resume from the failed step.
 *
 * Two things this deliberately does NOT do:
 *   - it does not TRUNCATE the queue on success. It removes exactly the entries it
 *     sent (`slice(queue.length)`), because a blind `[]` would destroy anything
 *     appended while the ceremony was running — the AOS host flapping back down for
 *     a writer while the replayer still sees it up is not exotic, it is the outage
 *     this queue exists for;
 *   - it does not release the queue lock across the ceremony. A `write` attempted
 *     mid-replay is refused loudly, naming the lock, rather than racing the trim.
 *     A refusal the caller can see and retry is not a lost write; a silent race is.
 */
async function replay(partition) {
  const entry = PARTITIONS[partition];
  if (!entry) {
    console.error(`unknown partition ${partition}`);
    process.exit(2);
  }
  if (!entry.shadowWorkspace) {
    console.error(`partition ${partition} is the AOS authority; it has no backlog to replay`);
    process.exit(2);
  }
  if (!probe()) {
    console.error(`AOS is unreachable; cannot replay ${partition} yet`);
    process.exit(1);
  }
  const file = shadowQueueFile(partition);
  const release = acquireQueueLock(file);
  let outcome;
  try {
    // Nothing between here and release() may call process.exit: exit does not run a
    // finally block, and the lock file would outlive the process holding it.
    const queue = readQueueFile(file);
    if (queue.length === 0) {
      outcome = { ok: true, report: { ok: true, partition, replayed: 0, note: "no backlog" } };
    } else {
      const catalogue = await hostCatalogue();
      const payload = buildReplayPayload(partition, queue, catalogue);
      // The generated payload NEVER lands in the tracked tree. It is queued engine
      // argv verbatim, which can carry absolute local paths, and it cannot be
      // scrubbed the way a receipt is (scrubbing it would change the bytes that get
      // written to the chain). scripts/lib/evidence-hygiene.mjs only walks evidence/,
      // so a host path written into deploy/aos-local-client/payloads/ would be seen
      // by no gate and committed by the next `git add -A` — TCRN-AOS-INC-037's leak
      // shape, one directory over. A temp directory, removed in a finally, has no
      // such reach; ceremony.mjs already reports an out-of-repository payload path as
      // `<outside-repository>` rather than relativising it back out.
      const scratch = mkdtempSync(join(tmpdir(), "shadow-replay-"));
      try {
        const payloadPath = join(scratch, "shadow-replay.json");
        writeFileSync(payloadPath, JSON.stringify(payload, null, 2) + "\n");
        const ceremony = join(REPO_ROOT, "deploy/aos-local-client/ceremony.mjs");
        const result = sh(
          [process.execPath, ceremony, "--payload", payloadPath, "--partition", partition],
          { allowFailure: true }
        );
        if (result.code !== 0) {
          outcome = { ok: false, message: `replay ceremony failed: ${result.stdout}` };
        }
      } finally {
        rmSync(scratch, { recursive: true, force: true });
      }
      if (outcome === undefined) {
        const remaining = readQueueFile(file).slice(queue.length);
        writeQueueAtomic(file, remaining);
        outcome = {
          ok: true,
          report: { ok: true, partition, replayed: queue.length, remaining: remaining.length }
        };
      }
    }
  } finally {
    release();
  }
  if (!outcome.ok) {
    console.error(outcome.message);
    process.exit(1);
  }
  console.log(JSON.stringify(outcome.report));
}

async function main([command, ...rest]) {
  const flag = (name) => {
    const i = rest.indexOf(`--${name}`);
    return i >= 0 ? rest[i + 1] : undefined;
  };

  if (command === "probe") {
    process.exit(probe() ? 0 : 1);
  } else if (command === "write") {
    const partition = flag("partition");
    const argsJson = flag("args");
    const actor = flag("actor");
    if (!partition || !argsJson || !actor) {
      console.error(
        "usage: fallback-cli.mjs write --partition <id> --actor <agent:<model>|person:<id>> --args '[...]'"
      );
      process.exit(2);
    }
    let args;
    try {
      args = JSON.parse(argsJson);
    } catch (error) {
      console.error(`--args must be a JSON array of strings: ${error.message}`);
      process.exit(2);
    }
    writeAction(partition, args, actor);
  } else if (command === "replay") {
    const partition = flag("partition");
    if (!partition) {
      console.error("usage: fallback-cli.mjs replay --partition <id>");
      process.exit(2);
    }
    await replay(partition);
  } else {
    console.error("usage: fallback-cli.mjs {probe|write|replay} ...");
    process.exit(2);
  }
}

// The dispatch runs only when this file IS the entry point, so the queue helpers
// above can be imported and exercised against a scratch directory without the CLI
// parsing the test runner's argv. The queue guards throw rather than exit, which
// keeps them testable; here that becomes a one-line refusal instead of a stack trace.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
