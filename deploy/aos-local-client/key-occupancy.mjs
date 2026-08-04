#!/usr/bin/env node
// TCRN-CROSS-STORY-136 — read-only key-occupancy lookup for derived-id namespaces.
//
// The trap this closes, hit three times on this platform: a conference, a minutes
// record, a position and a gate carry NO stored external key. The engine enforces
// uniqueness by DERIVING the record id from the key —
//
//     deriveStableId(ns, key) = `${ns}:` + sha256(`${ns}\0${KEY.toUpperCase()}`)[0..24]
//
// — so "is TCRN-CROSS-MIN-054 still free" cannot be answered by reading any field on
// any record. It can only be answered by deriving the candidate's id and asking
// whether THAT id is already on the chain. Reading fields instead is what produced
// the three collisions: the key looked unused because nothing on the chain spells it.
//
//   node deploy/aos-local-client/key-occupancy.mjs next-free-key --chain cross --kind min
//   node deploy/aos-local-client/key-occupancy.mjs key-taken --chain cross --kind min --key TCRN-CROSS-MIN-052
//   node deploy/aos-local-client/key-occupancy.mjs next-free-key --chain cross --kind gate
//
// All four of those namespaces are covered — see KINDS for the source each one needs.
//
// READ ONLY by construction: the only engine verbs it can issue are the ones frozen
// into READ_ONLY_VERBS below, every one of them `mutates:false` in the host engine's
// own commands catalogue. Nothing here opens a workspace for write. The tool is
// ADVISORY — the engine's own id-collision refusal remains the authority — and
// allocating a key is still a governed write through ceremony.mjs.

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";

import { shellQuote } from "../aos-resident-cockpit/resident-lib.mjs";
import { PARTITION_ROSTER, VM_ENGINE_CLI, VM_HOST } from "./topology.mjs";
import { aosPartition } from "./aos-partitions.mjs";
import { scrubHostPathsInText } from "../../scripts/lib/evidence-hygiene.mjs";

const runFile = promisify(execFile);

/**
 * The verbs this tool is permitted to send. Structural, not documentary: an engine
 * call whose verb is absent here throws before an SSH connection is opened, so the
 * read-only claim cannot rot into prose the day somebody adds a convenience call.
 *
 * All three answer `mutates: false` in the host engine's own commands catalogue
 * (measured 2026-08-04 against `tcrn-workflow.mjs commands` on the VM); re-check with
 * that verb rather than trusting this sentence.
 */
export const READ_ONLY_VERBS = Object.freeze([
  "event-list",
  "conference-minutes-list",
  "conference-position-list"
]);

/** Short CLI alias → the partition id used by topology.mjs / aos-partitions.mjs. */
const CHAIN_ALIASES = Object.freeze({
  cross: "cross-project",
  aos: "TCRN-AOS",
  ds: "TCRN-Design-System",
  tms: "TCRN-TMS",
  joi: "Joi-Button"
});

/**
 * Kind → namespace, key token, and the source used to enumerate that namespace.
 *
 * Everything below is measured against the cross-project chain on the VM engine
 * (2026-08-04); re-measure rather than trust it, the commands are named as you read.
 *
 * Two kinds have a chain-wide list verb and two do not:
 *
 *  - `conference-minutes-list` and `conference-position-list` take an OPTIONAL
 *    `--conference-id`, so with it omitted each enumerates the whole chain — 73 minutes
 *    and 142 positions on the cross chain.
 *  - `conference-list-by-work` and `gate-list` both REQUIRE a work id, and a conference
 *    or a gate need not hang off work you already know about, so those two namespaces
 *    have no chain-wide list verb at all. Their complete source is the event stream,
 *    where `conference.created` / `gate.created` carry `payload.record.id`.
 *
 * What is NOT true — and stood here as the stated rationale until STORY-136's review
 * measured it — is that minutes ids are invisible to an event scan. They are not: all
 * 73 of this chain's minutes ids appear in the event stream at `payload.minutes.id`,
 * and all 142 position ids appear there too. `event-list` alone would answer every
 * kind. The list verbs are preferred where they exist because they read one small page
 * instead of 1,465 events, NOT because the event stream misses anything.
 *
 * That preference carries exactly one dependency, and it points the dangerous way: the
 * engine's `conference-minutes-list` and `conference-position-list` arms both filter
 * `!entry.tombstone`, while `event-list` filters nothing (measured in the host's own
 * build, `dist/build/packages/cli/src/index.js`). A tombstoned record would therefore
 * read FREE from the chosen source and TAKEN from the other, and FREE is the wrong half.
 * Today nothing can tombstone either namespace — in that same build only
 * `deleteProject`, `deleteWork` and `deleteGateInWorkspace` set the flag — so the
 * filtered source cannot under-read. The day a minutes-retire or position-retire verb
 * appears, move that kind's `source` to "event-list"; do not leave it pointed at a
 * source that has learned to hide records.
 *
 * `gate` reads the unfiltered stream for the mirror reason: gates CAN be tombstoned,
 * and a deleted gate's ordinal must still read TAKEN, because the chain's append-only
 * history already discusses that ordinal by name (same rule as `nextFreeOrdinal`'s
 * refusal to re-issue gaps).
 */
export const KINDS = Object.freeze({
  min: Object.freeze({ namespace: "minutes", token: "MIN", source: "conference-minutes-list" }),
  conf: Object.freeze({ namespace: "conference", token: "CONF", source: "event-list" }),
  pos: Object.freeze({ namespace: "position", token: "POS", source: "conference-position-list" }),
  gate: Object.freeze({ namespace: "gate", token: "GATE", source: "event-list" })
});

/**
 * The key format's own ceiling, not an arbitrary scan budget.
 *
 * Keys in this platform are `<PREFIX>-<TOKEN>-NNN`, three digits, zero padded. The
 * scan therefore covers the ENTIRE space the format can express; there is no window
 * beyond which occupancy goes unseen. If a family ever reaches 999 the format itself
 * has to widen, which is a naming decision for a human, so the tool fails loud rather
 * than inventing a four-digit key.
 */
const ORDINAL_WIDTH = 3;
const ORDINAL_MIN = 1;
const ORDINAL_MAX = 999;

/**
 * Where the derivation comes from, and the vector that proves it did not drift.
 *
 * The id derivation is imported from the installed engine build rather than
 * re-implemented, because a local copy drifts silently: the namespace regex, the
 * uppercasing in canonicalExternalKey, the NUL separator and the 24-hex slice are
 * four independent chances to be subtly wrong, and every one of them misjudges
 * occupancy without erroring. A local mirror still exists for the case where the
 * engine build is absent, and BOTH paths are checked against the same known answer
 * before any chain is read — so the fallback cannot be quietly wrong either. The
 * vector is a pure function of the derivation, not a measurement of chain contents:
 * it stays true no matter how many keys are allocated, and it can only go red if the
 * protocol primitive changed, which would orphan every id already on every chain.
 */
const ENGINE_ROOT = process.env.TCRN_AOS_ENGINE_ROOT
  ?? resolve(homedir(), ".tcrn-workflow/tcrn-workflow");
const PROTOCOL_BUILD = join(ENGINE_ROOT, "dist/build/packages/protocol/src/index.js");
const DERIVATION_VECTOR = Object.freeze({
  namespace: "conference",
  key: "TCRN-CROSS-CONF-050",
  id: "conference:52581fc31af5fb17ffc828f4"
});

/** The roster states each chain's key prefix as `<PREFIX>-WORKSPACE`; never hand-typed. */
const WORKSPACE_KEY_SUFFIX = "-WORKSPACE";

/** Bytes per page are what the engine caps, so the page size is discovered, not assumed. */
const FIRST_PAGE_LIMIT = 400;

class UsageError extends Error {}

/** Asking for help is not an error; it is separated so it can exit 0. */
class HelpRequest extends Error {}

// ---------------------------------------------------------------------------
// Derivation
// ---------------------------------------------------------------------------

/** Byte-for-byte mirror of the engine's canonicalExternalKey; used only as fallback. */
function localCanonicalExternalKey(value) {
  if (typeof value !== "string" || !/^[\x21-\x7e]+$/u.test(value)) {
    throw new UsageError(`external key is not printable ASCII: ${String(value)}`);
  }
  const canonical = value.toUpperCase();
  if (!/^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*$/u.test(canonical) || canonical.length > 128) {
    throw new UsageError(`external key is not a legal key: ${value}`);
  }
  return canonical;
}

/** Byte-for-byte mirror of the engine's deriveStableId; used only as fallback. */
function localDeriveStableId(namespace, externalKey) {
  if (typeof namespace !== "string" || !/^[a-z][a-z0-9-]{1,31}$/u.test(namespace)) {
    throw new UsageError(`namespace is not a legal namespace: ${String(namespace)}`);
  }
  const key = localCanonicalExternalKey(externalKey);
  const digest = createHash("sha256").update(`${namespace}\0${key}`, "utf8").digest("hex");
  return `${namespace}:${digest.slice(0, 24)}`;
}

export async function loadDerivation(protocolBuild = PROTOCOL_BUILD) {
  let derive = localDeriveStableId;
  let source = "local-mirror";
  let detail = "installed engine build absent; local mirror used and vector-checked";
  if (existsSync(protocolBuild)) {
    const module = await import(pathToFileURL(protocolBuild).href);
    if (typeof module.deriveStableId !== "function") {
      throw new Error(
        `engine build at ${scrubHostPathsInText(protocolBuild)} exports no deriveStableId`);
    }
    derive = module.deriveStableId;
    source = "engine-build";
    detail = scrubHostPathsInText(protocolBuild);
  }
  const produced = derive(DERIVATION_VECTOR.namespace, DERIVATION_VECTOR.key);
  if (produced !== DERIVATION_VECTOR.id) {
    throw new Error(
      `derivation drift: ${source} maps ${DERIVATION_VECTOR.namespace}/${DERIVATION_VECTOR.key} `
      + `to ${produced}, expected ${DERIVATION_VECTOR.id}. Every occupancy answer this tool `
      + `could give would be wrong; refusing to read the chain.`);
  }
  return { derive, source, detail };
}

// ---------------------------------------------------------------------------
// Topology
// ---------------------------------------------------------------------------

/**
 * Resolve a chain alias to the one address and one key prefix the platform states.
 *
 * Two files state the same fact — the roster's `liveAddress` and aos-partitions'
 * `workspace` — and this is the only place both are read, so they are compared here
 * rather than trusted separately. A tool that silently picked one of two disagreeing
 * addresses would answer confidently about the wrong chain.
 *
 * `deps` exists so those refusals can be PROVEN. Today every rostered partition has
 * `home: "vm"` and the two files agree, so the disagreement and non-vm branches are
 * unreachable from production input, and a branch nothing can reach is a branch nothing
 * proves. The defaults are the imported topology and stay the only production source —
 * a caller passing a hand-written address here would be re-introducing exactly the
 * hand-typed topology this file refuses to carry, so the override is for fixtures only.
 */
export function resolveChain(alias, deps = {}) {
  const roster = deps.roster ?? PARTITION_ROSTER;
  const partitionOf = deps.partitionOf ?? aosPartition;
  const partitionId = CHAIN_ALIASES[alias];
  if (!partitionId) {
    throw new UsageError(
      `unknown --chain ${alias}; known: ${Object.keys(CHAIN_ALIASES).join(", ")}`);
  }
  const rostered = roster.find((entry) => entry.partitionId === partitionId);
  if (!rostered) {
    throw new Error(`partition ${partitionId} is not in PARTITION_ROSTER`);
  }
  const { workspace } = partitionOf(partitionId);
  if (rostered.liveAddress !== workspace) {
    throw new Error(
      `topology disagreement for ${partitionId}: roster says ${rostered.liveAddress}, `
      + `aos-partitions says ${workspace}`);
  }
  if (rostered.home !== "vm") {
    throw new Error(
      `partition ${partitionId} has home=${rostered.home}; this tool reads the VM engine only`);
  }
  if (!rostered.externalKey.endsWith(WORKSPACE_KEY_SUFFIX)) {
    throw new Error(
      `cannot derive a key prefix from workspace externalKey ${rostered.externalKey}`);
  }
  return {
    partitionId,
    workspace,
    keyPrefix: rostered.externalKey.slice(0, -WORKSPACE_KEY_SUFFIX.length)
  };
}

// ---------------------------------------------------------------------------
// Reading the chain
// ---------------------------------------------------------------------------

/**
 * How long this client waits for one read, and how much it will hold.
 *
 * ssh's `ConnectTimeout` bounds only the TCP and auth phase; once the session is up a
 * wedged engine or a stalled link waits forever, because Node's execFile default
 * timeout is 0 — meaning never. Same value and same reason as `SSH_TIMEOUT_MS` in
 * remote-read-mcp.mjs; the number is a client-side policy each entry point owns, not a
 * topology fact, so it is stated here rather than imported from an MCP server module a
 * CLI has no other reason to load.
 *
 * The bound stops THIS side waiting. It does not cancel the projection the host engine
 * is already performing.
 */
const SSH_TIMEOUT_MS = 120_000;
const SSH_MAX_BUFFER = 64 * 1024 * 1024;

/**
 * One read verb against the host that owns the chain.
 *
 * `BatchMode=yes` so an unreachable or unauthenticated host fails instead of blocking
 * on a password prompt. A non-zero exit is an ANSWER carrying a reason code, not a
 * crash — the engine emits its refusals as JSON on stderr — so the reason code is
 * parsed out and returned to the caller, which is what makes adaptive paging possible.
 *
 * Every remote argument is quoted, with the same `shellQuote` the ceremony and the
 * remote-read server use: ssh re-joins its remote argv with spaces and hands the result
 * to a login shell, so an unquoted value carrying a space or parentheses becomes remote
 * syntax rather than an argument (paid for by STORY-133, per remote-read-mcp.mjs). Every
 * value here is an internal constant today, so nothing has broken — which is exactly the
 * state in which the next value stops being word-shaped and nobody remembers.
 */
async function engineRead(verb, flags) {
  if (!READ_ONLY_VERBS.includes(verb)) {
    throw new Error(`verb ${verb} is not in this tool's read-only set`);
  }
  const command = ["node", VM_ENGINE_CLI, verb, ...flags].map(shellQuote).join(" ");
  try {
    const { stdout } = await runFile(
      "ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=15", VM_HOST, command],
      { timeout: SSH_TIMEOUT_MS, maxBuffer: SSH_MAX_BUFFER });
    return { ok: true, page: JSON.parse(stdout) };
  } catch (error) {
    if (error?.killed === true) {
      // A killed child is this client's own bound firing, never an engine refusal. It
      // gets a reason code of its own so the paging loop cannot mistake it for the
      // retryable `*_OVERSIZED` case and re-issue a read that is already wedged.
      return {
        ok: false,
        reasonCode: "KEY_OCCUPANCY_HOST_TIMEOUT",
        detail: `${verb} did not answer within ${SSH_TIMEOUT_MS}ms; this bound stops this `
          + "client waiting, it does not cancel the projection already running on the host"
      };
    }
    const emitted = String(error?.stderr ?? "").trim() || String(error?.stdout ?? "").trim();
    let reasonCode = null;
    try { reasonCode = JSON.parse(emitted).reasonCode ?? null; } catch { reasonCode = null; }
    return {
      ok: false,
      reasonCode: reasonCode ?? "AWAY_HOST_UNREACHABLE_OR_NON_JSON",
      detail: emitted.slice(0, 300)
    };
  }
}

/**
 * Read every record of a list verb, paging until `total` is reached.
 *
 * The page size is capped in BYTES, not rows, so the right limit is not knowable in
 * advance: the engine refuses an oversized page with a `*_OVERSIZED` reason and the
 * loop halves and retries the same offset. The loop terminates on `total` rather than
 * on a short page, because a short page is normal at the byte cap; a loop that stopped
 * at the first short page would under-read, and under-reading occupancy reports a used
 * key as free, which is exactly the failure this tool exists to prevent.
 */
export async function readAllRecords(verb, workspace, firstLimit = FIRST_PAGE_LIMIT) {
  const records = [];
  let limit = firstLimit;
  let offset = 0;
  let total = null;
  let pages = 0;
  let firstHead = null;
  let head = null;
  let version = null;
  for (;;) {
    const result = await engineRead(
      verb, ["--workspace", workspace, "--limit", String(limit), "--offset", String(offset)]);
    if (!result.ok) {
      if (/_OVERSIZED$/u.test(result.reasonCode) && limit > 1) {
        limit = Math.floor(limit / 2);
        continue;
      }
      throw new Error(
        `${verb} failed at offset ${offset} limit ${limit}: ${result.reasonCode} ${result.detail ?? ""}`);
    }
    const page = result.page;
    if (typeof page.total !== "number") {
      throw new Error(`${verb} response carries no numeric 'total'; cannot page safely`);
    }
    pages += 1;
    if (firstHead === null) firstHead = page.headEventHash ?? null;
    head = page.headEventHash ?? null;
    version = page.version ?? version;
    total = page.total;
    const batch = Array.isArray(page.records) ? page.records : [];
    if (batch.length === 0 && offset < total) {
      throw new Error(`${verb} returned an empty page at offset ${offset} of ${total}`);
    }
    records.push(...batch);
    offset += batch.length;
    if (offset >= total) break;
  }
  return {
    records, total, pages, version, headEventHash: head,
    // Events only ever append, so offsets stay stable even if the chain moved under
    // the scan; a moved head means the answer is a snapshot of an earlier version,
    // which is worth stating rather than hiding.
    headStableDuringRead: firstHead === head
  };
}

/**
 * Every id of `namespace` that appears anywhere in a payload.
 *
 * Deliberately a deep walk over the payload rather than a read of `payload.record.id`
 * alone. The two error directions are not symmetric: a missed id reports an occupied
 * key as FREE and hands somebody a collision, while an extra id costs at worst a
 * spurious TAKEN that an operator can check. So the scan is biased toward the safe
 * direction, and it does not have to be re-taught every time a new operation shape
 * carries an id somewhere else.
 *
 * The walk DOES over-read, and this note claimed it could not until STORY-136's review
 * measured otherwise. On the cross chain (2026-08-04) the event stream carries 77
 * `minutes:` ids while only 73 belong to that chain; the other four resolve to
 * TCRN-AOS-MIN-007/008/011/012 and appear solely as `advisory:decided-by` extension
 * values on `work.annotated` events — cross-chain references to another partition's
 * records. Nothing in this walk excludes a foreign id, and nothing here can: an id is
 * an opaque digest with no chain in it.
 *
 * What makes that harmless is NOT a property of the walk. It is `occupiedOrdinals`,
 * which re-derives THIS chain's `<PREFIX>-<TOKEN>-NNN` candidates and intersects, so an
 * id belonging to another prefix can never be counted as this family's. Do not drop
 * that intersection and read `occupancy.namespaceIds` as a count of this chain's
 * records — that number is knowingly over-counted and is reported only as a witness of
 * how much was read.
 */
function collectNamespaceIds(value, pattern, found) {
  if (typeof value === "string") {
    if (pattern.test(value)) found.add(value);
    return found;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectNamespaceIds(item, pattern, found);
    return found;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectNamespaceIds(item, pattern, found);
  }
  return found;
}

/** The occupied id set for one namespace, from the only source that can enumerate it. */
export async function occupiedIds(kind, workspace) {
  const { namespace, source } = KINDS[kind];
  const pattern = new RegExp(`^${namespace}:[0-9a-f]{24}$`, "u");
  const read = await readAllRecords(source, workspace);
  const found = new Set();
  for (const record of read.records) collectNamespaceIds(record, pattern, found);
  return {
    ids: found,
    source,
    recordsRead: read.records.length,
    total: read.total,
    pages: read.pages,
    chainVersion: read.version,
    headEventHash: read.headEventHash,
    headStableDuringRead: read.headStableDuringRead
  };
}

// ---------------------------------------------------------------------------
// Occupancy
// ---------------------------------------------------------------------------

export function familyKey(keyPrefix, token, ordinal) {
  return `${keyPrefix}-${token}-${String(ordinal).padStart(ORDINAL_WIDTH, "0")}`;
}

/** Derived from ORDINAL_WIDTH, not spelled out, so widening the format moves both halves. */
const ORDINAL_PATTERN = new RegExp(`^[0-9]{${ORDINAL_WIDTH}}$`, "u");

/**
 * The ordinal a full key names inside one family — or a usage error naming the
 * canonical spelling.
 *
 * Checking the family PREFIX is not enough, and stopping there was this tool's own
 * worst failure mode. `TCRN-CROSS-MIN-53`, `TCRN-CROSS-MIN-0053` and
 * `TCRN-CROSS-MIN-053-X` all begin with `TCRN-CROSS-MIN-`, all derive a perfectly legal
 * id, and none of those ids is on the chain — so a prefix-only check answered FREE for
 * all three while `TCRN-CROSS-MIN-053` was occupied, and exited 0 doing it. A dropped
 * leading zero is exactly how an operator reaches that path, and FREE-for-an-occupied-
 * ordinal is the one answer this tool must never give.
 *
 * Rejected, never normalised. An operator who typed `-53` has to be told which key was
 * NOT answered; showing them a verdict about a different string is how the answer and
 * the question quietly stop matching.
 */
export function familyOrdinal(canonicalKey, keyPrefix, token) {
  const expectedStart = `${keyPrefix}-${token}-`;
  if (!canonicalKey.startsWith(expectedStart)) {
    throw new UsageError(
      `key ${canonicalKey} is not in family ${expectedStart}NNN; occupancy of another `
      + `chain's or another kind's key cannot be answered from this family's id set`);
  }
  const tail = canonicalKey.slice(expectedStart.length);
  if (!ORDINAL_PATTERN.test(tail)) {
    const digits = /^[0-9]+$/u.test(tail) ? Number(tail) : null;
    const suggestion = digits !== null && digits >= ORDINAL_MIN && digits <= ORDINAL_MAX
      ? ` Did you mean ${familyKey(keyPrefix, token, digits)}?`
      : "";
    throw new UsageError(
      `key ${canonicalKey} is not the canonical ${expectedStart}NNN form (${ORDINAL_WIDTH} `
      + `digits, zero padded), so no answer about it would be an answer about an `
      + `allocatable key.${suggestion}`);
  }
  const ordinal = Number(tail);
  if (ordinal < ORDINAL_MIN || ordinal > ORDINAL_MAX) {
    throw new UsageError(
      `key ${canonicalKey} names ordinal ${ordinal}, outside the family's `
      + `[${ORDINAL_MIN}, ${ORDINAL_MAX}] range`);
  }
  return ordinal;
}

/**
 * Which ordinals of one `<PREFIX>-<TOKEN>-NNN` family are occupied.
 *
 * A namespace holds several families — the cross chain's `minutes` namespace carries
 * ids from more than one key shape — so occupancy is answered per family by deriving
 * this family's candidates and intersecting, never by counting the namespace. There
 * is no namespace-global counter and there should not be one.
 */
export function occupiedOrdinals(ids, derive, namespace, keyPrefix, token) {
  const occupied = [];
  for (let ordinal = ORDINAL_MIN; ordinal <= ORDINAL_MAX; ordinal += 1) {
    if (ids.has(derive(namespace, familyKey(keyPrefix, token, ordinal)))) occupied.push(ordinal);
  }
  return occupied;
}

/**
 * The next key to allocate: HIGHEST OCCUPIED + 1, never the lowest gap.
 *
 * The gaps are real and they are not free space. The cross chain has holes at MIN
 * 007/023/026/027 and CONF 013 left by work that was cancelled or renumbered, and the
 * chain's own append-only history already discusses those ordinals by name. Re-issuing
 * one would give a single key two unrelated meanings in a record that can never be
 * edited. Gaps are therefore REPORTED, so a human can see them, and never suggested.
 */
export function nextFreeOrdinal(occupied) {
  const highest = occupied.length === 0 ? 0 : occupied[occupied.length - 1];
  const next = highest + 1;
  if (next > ORDINAL_MAX) {
    throw new Error(
      `family is exhausted at ordinal ${ORDINAL_MAX}; widening the key format past `
      + `${ORDINAL_WIDTH} digits is a naming decision, not this tool's to make`);
  }
  return { highest, next };
}

export function gapsBelow(occupied, highest) {
  const present = new Set(occupied);
  const gaps = [];
  for (let ordinal = ORDINAL_MIN; ordinal < highest; ordinal += 1) {
    if (!present.has(ordinal)) gaps.push(ordinal);
  }
  return gaps;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

// Spelled from the tables themselves: a usage line that lists the kinds by hand goes
// stale the first time a kind is added, and the operator believes the usage line.
const CHAIN_CHOICES = Object.keys(CHAIN_ALIASES).join("|");
const KIND_CHOICES = Object.keys(KINDS).join("|");

const USAGE = `key-occupancy — read-only external-key occupancy for derived-id namespaces

  next-free-key --chain <${CHAIN_CHOICES}> --kind <${KIND_CHOICES}>
  key-taken     --chain <...> --kind <...> --key <FULL-KEY>

Keys are <PREFIX>-<TOKEN>-NNN with exactly ${ORDINAL_WIDTH} zero-padded digits;
key-taken refuses any other spelling rather than answering about a different key.

Answers go to stdout as JSON. Exit status reports whether the LOOKUP succeeded, not
what the answer was: a TAKEN verdict exits 0 like a FREE one, so a non-zero exit
always means the tool could not answer (unreachable host, drifted derivation) and is
never confused with an occupied key.`;

export function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!command || command === "--help" || command === "-h") {
    throw new HelpRequest(USAGE);
  }
  if (command !== "next-free-key" && command !== "key-taken") {
    throw new UsageError(`unknown command ${command}\n\n${USAGE}`);
  }
  const allowed = new Set(["--chain", "--kind", "--key"]);
  const flags = {};
  for (let index = 0; index < rest.length; index += 2) {
    const flag = rest[index];
    if (!allowed.has(flag)) throw new UsageError(`unknown flag ${flag}\n\n${USAGE}`);
    const value = rest[index + 1];
    if (value === undefined) throw new UsageError(`flag ${flag} needs a value`);
    const name = flag.slice(2);
    // A repeat used to last-win in silence: `--chain cross --chain joi` answered for
    // joi, printed `chain: "joi"`, and exited 0. This answer gets pasted into a ceremony
    // payload, so quietly allocating against a partition the operator did not name first
    // is the same class of harm as a wrong FREE.
    if (Object.hasOwn(flags, name)) {
      throw new UsageError(
        `flag ${flag} was given twice (${flags[name]}, then ${value}); name it once, `
        + `because this tool will not choose which of the two you meant`);
    }
    flags[name] = value;
  }
  if (!flags.chain) throw new UsageError("--chain is required");
  if (!flags.kind) throw new UsageError("--kind is required");
  if (!KINDS[flags.kind]) {
    throw new UsageError(`unknown --kind ${flags.kind}; known: ${Object.keys(KINDS).join(", ")}`);
  }
  if (command === "key-taken" && !flags.key) throw new UsageError("--key is required for key-taken");
  if (command === "next-free-key" && flags.key) {
    throw new UsageError("--key is not meaningful for next-free-key");
  }
  return { command, ...flags };
}

export async function run(argv) {
  const args = parseArgs(argv);
  const { derive, source, detail } = await loadDerivation();
  const { partitionId, workspace, keyPrefix } = resolveChain(args.chain);
  const { namespace, token } = KINDS[args.kind];
  const occupancy = await occupiedIds(args.kind, workspace);
  const occupied = occupiedOrdinals(occupancy.ids, derive, namespace, keyPrefix, token);

  const common = {
    ok: true,
    command: args.command,
    chain: args.chain,
    partitionId,
    workspace,
    host: VM_HOST,
    kind: args.kind,
    namespace,
    keyPrefix,
    keyFamily: `${keyPrefix}-${token}-NNN`,
    derivation: { source, detail, vector: DERIVATION_VECTOR },
    read: {
      verb: occupancy.source,
      recordsRead: occupancy.recordsRead,
      total: occupancy.total,
      pages: occupancy.pages,
      chainVersion: occupancy.chainVersion,
      headEventHash: occupancy.headEventHash,
      headStableDuringRead: occupancy.headStableDuringRead
    },
    occupancy: {
      namespaceIds: occupancy.ids.size,
      familyOccupiedCount: occupied.length,
      scanWindow: { from: ORDINAL_MIN, to: ORDINAL_MAX, width: ORDINAL_WIDTH }
    }
  };

  if (args.command === "key-taken") {
    // Canonicalise, then check family AND ordinal form BEFORE deriving, so a malformed
    // or foreign key is a usage error with a readable message rather than a confident
    // verdict about a key nobody could allocate. Both halves matter: a key from another
    // chain or kind, and a key with a mis-spelled ordinal, each derive a legal id that
    // this set simply never contains, and each would be reported FREE — the one answer
    // this tool must never give wrongly.
    const canonicalKey = localCanonicalExternalKey(args.key);
    const ordinal = familyOrdinal(canonicalKey, keyPrefix, token);
    const derivedId = derive(namespace, canonicalKey);
    return {
      ...common,
      key: canonicalKey,
      ordinal,
      derivedId,
      verdict: occupancy.ids.has(derivedId) ? "TAKEN" : "FREE"
    };
  }

  const { highest, next } = nextFreeOrdinal(occupied);
  const nextKey = familyKey(keyPrefix, token, next);
  return {
    ...common,
    highestTakenOrdinal: highest,
    highestTakenKey: highest === 0 ? null : familyKey(keyPrefix, token, highest),
    gapsBelowHighest: gapsBelow(occupied, highest),
    semantics: "highest-occupied + 1; gaps below the highest are reported, never suggested",
    nextFreeKey: nextKey,
    nextFreeId: derive(namespace, nextKey)
  };
}

const invokedDirectly = process.argv[1]
  && pathToFileURL(process.argv[1]).href === import.meta.url;

if (invokedDirectly) {
  run(process.argv.slice(2))
    .then((answer) => {
      process.stdout.write(`${JSON.stringify(answer, null, 2)}\n`);
    })
    .catch((error) => {
      if (error instanceof HelpRequest) {
        process.stdout.write(`${error.message}\n`);
        return;
      }
      const usage = error instanceof UsageError;
      process.stderr.write(`${JSON.stringify({
        ok: false,
        reasonCode: usage ? "KEY_OCCUPANCY_USAGE" : "KEY_OCCUPANCY_UNANSWERABLE",
        error: scrubHostPathsInText(String(error?.message ?? error))
      }, null, 2)}\n`);
      process.exitCode = usage ? 2 : 1;
    });
}
