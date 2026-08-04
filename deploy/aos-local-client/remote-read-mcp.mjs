#!/usr/bin/env node
// TCRN-CROSS-STORY-132 — the AOS-mode MCP read face, as a LOCAL PROXY.
//
//   (stdio MCP server; takes no arguments)
//   node deploy/aos-local-client/remote-read-mcp.mjs
//
// WHY THIS EXISTS. Every partition's chain now lives on the AOS host, so the MCP
// server this platform has always run — the installed engine's own facade, driven
// in-process against a local workspace path — can no longer read any of them. The
// facade is not the place to fix that: its stated property is that it constructs no
// shell and is host-neutral, and teaching it SSH would both contradict that and make
// every future change to this read path an engine release plus a trusted reinstall.
// So the remote half lives out here, beside the ceremony that already owns this
// machine's side of the remote governance conversation (Owner ruling: candidate A).
//
// WHAT IT IS INCAPABLE OF, structurally rather than by promise:
//   - it takes NO arguments. The only arguments the engine facade accepts are
//     --authority-pins and its digest; a server that refuses every argument cannot be
//     handed the pinned grant, so no configuration of it can turn into a write face;
//   - it forwards only verbs the installed engine's own catalogue marks non-mutating
//     and non-authority-bearing, and it re-asks the HOST engine's catalogue on a bounded
//     cache (HOST_CATALOG_TTL_MS) rather than on literally every forward. A verb either
//     catalogue withholds is refused with a reason code that names the GROUND —
//     MCP_REMOTE_WRITE_REFUSED, MCP_REMOTE_AUTHORITY_OUTPUT_REFUSED or
//     MCP_REMOTE_FIXTURE_ONLY — because "go use ceremony.mjs" is the right answer for
//     exactly one of those three and a wrong redirection is worse than none.
// The derivation is the point. A hand-written allow-list goes stale permissively — a
// verb added by a later engine is absent from the list and therefore allowed — while
// "what does the catalogue say about this verb" cannot go stale in that direction.
// ADR 0003 makes the same argument for the facade, and ceremony-plan.mjs already
// refuses the authority-file family the same way.
//
// THE EXPOSURE INVARIANT IS DERIVED TWICE, FROM TWO SOURCES. `withheldGround` decides
// what this file publishes; `assertNoWriteExposed` decides what it may not publish, and
// it answers from the installed engine's OWN `workflowMcpTools()` descriptors
// (readOnlyHint / destructiveHint / membership) rather than from `withheldGround`. The
// first draft of this file filtered by a predicate and then asserted the negation of the
// same predicate, which can never go red; that is a recorded platform sin
// (判据两侧必须能够不同). Two sources can disagree, and disagreement is the red.
// The assertion also refuses to answer at all when it is handed no engine descriptors:
// "I observed nothing" must not be spelled the same way as "there is nothing wrong".
//
// REGISTERED, 2026-08-04, as `tcrn-workflow-aos-read` in the platform root's .mcp.json
// (Owner ruling D5 of that date: this proxy is the AOS-mode read face, rather than a
// change to the engine's own MCP facade). The entry is exactly:
//
//   "tcrn-workflow-aos-read": {
//     "command": "node",
//     "args": ["<platform root>/TCRN-AOS/deploy/aos-local-client/remote-read-mcp.mjs"]
//   }
//
// with no pins argument and no other argument — see assertNoArguments. That registration
// was a separate step on purpose: .mcp.json lives at the platform root, outside this
// repository, and adding an MCP server to every session on this machine is a
// configuration change rather than a code change, so it is the Owner's to approve and it
// does not travel with this file. The pre-existing `tcrn-workflow` entry — the one that
// DOES carry --authority-pins — was left untouched in the same change; repointing it is
// how the pinned write grant would get relaxed by accident.
//
// TWO ADDRESSES, NEITHER TYPED HERE. The host and engine CLI come from topology.mjs
// (whose VM half is imported from the systemd unit's own manifest); the per-partition
// workspace comes from aos-partitions.mjs. A caller names a PARTITION, never a path —
// the same division as the ceremony, where a payload may not name --workspace because
// that value belongs to the topology and not to whoever wrote the request.
//
// THE TRANSPORT IS MIRRORED, NOT INVENTED. Framing, method set, protocol-version
// negotiation, the not-initialized guard and the one-MiB line ceiling all follow the
// installed engine's scripts/tcrn-workflow-mcp.mjs → mcp.js, so a real client sees one
// protocol from both servers. The flag→JSON-Schema mapping is mirrored for the same
// reason: a caller that learned an argument shape from the local server must not have
// to learn a second one here.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { shellQuote } from "../aos-resident-cockpit/resident-lib.mjs";
import { LOCAL_ENGINE } from "../switch-rehearsal/rehearsal-lib.mjs";
import { VM_ENGINE_CLI, VM_HOST } from "./topology.mjs";
import { AOS_PARTITIONS, aosPartition } from "./aos-partitions.mjs";
import { scrubHostPathsInText } from "../../scripts/lib/evidence-hygiene.mjs";

const runFile = promisify(execFile);

export const SERVER_NAME = "tcrn-workflow-remote-read";
export const SERVER_VERSION = "0.1.0";

/**
 * A prefix of its own, deliberately not the engine facade's `tcrn_workflow_`.
 *
 * Both servers can be configured at once, and the one thing an operator must never
 * have to guess is which chain a call reached. Two tools with the same name, one
 * answering from this process and one from another host, is precisely the shape this
 * platform has already been bitten by twice (a document naming a stale address, a
 * convention naming a repository that had moved).
 */
export const TOOL_PREFIX = "tcrn_remote_read_";

export const PROTOCOL_VERSIONS = Object.freeze([
  "2025-06-18",
  "2025-03-26",
  "2024-11-05"
]);

/**
 * A read is not fast here. `status` on the cross-project chain projects over 1,400+
 * events on the far side of an SSH round trip, and the shared ssh() helper forwards
 * neither a timeout nor a buffer size — Node's execFile default timeout is 0, meaning
 * never, so a wedged read would hang the client's tool call forever rather than fail.
 * The execFile call therefore lives in this file: rehearsal-lib.mjs belongs to the
 * switch-rehearsal arc and changing its signature to serve this story would put a
 * second arc's requirement into a library whose callers never asked for it.
 *
 * This bound is client-side. It stops waiting; it does not cancel the projection the
 * host engine is already performing.
 */
export const SSH_TIMEOUT_MS = 120_000;
export const SSH_MAX_BUFFER = 64 * 1024 * 1024;

/** Matches the engine facade's line ceiling, so neither server accepts what the other rejects. */
const MAX_LINE_BYTES = 1_048_576;

/**
 * Flags whose value is topology, not caller input.
 *
 * A caller names `partition`; this file resolves it. Same ruling as the ceremony's
 * reserved flags: a request that could name its own workspace could read a chain the
 * roster does not know about, and a request that could name its own attest-dir could
 * point a sidecar-reading verb somewhere nobody maintains.
 */
export const RESERVED_FLAGS = Object.freeze(["workspace", "attest-dir"]);
export const PARTITION_ARGUMENT = "partition";

/**
 * Three grounds, three reason codes — because they have three different remedies.
 *
 * The first draft answered MCP_REMOTE_WRITE_REFUSED for all of them and pointed every
 * caller at ceremony.mjs. That is wrong twice over for the authority family:
 * `adapter-activation-record` has mutates:false — it is not a write — and
 * ceremony-plan.mjs refuses exactly that family ("this verb takes a per-invocation
 * authority file; it is performed as its own ceremony, never from a batch wrapper"), so
 * the caller was misclassified AND sent to a door that is also shut.
 */
export const WRITE_REFUSED = "MCP_REMOTE_WRITE_REFUSED";
export const AUTHORITY_OUTPUT_REFUSED = "MCP_REMOTE_AUTHORITY_OUTPUT_REFUSED";
export const FIXTURE_ONLY_REFUSED = "MCP_REMOTE_FIXTURE_ONLY";
export const EXPOSURE_INVARIANT = "MCP_REMOTE_EXPOSURE_INVARIANT";
/** The scope floor: the invariant could not be evaluated, which is not the same as green. */
export const EXPOSURE_UNPROVEN = "MCP_REMOTE_EXPOSURE_UNPROVEN";

export class RemoteReadError extends Error {
  reasonCode;
  constructor(reasonCode, message) {
    super(message);
    this.name = "RemoteReadError";
    this.reasonCode = reasonCode;
  }
}

function fail(reasonCode, message) {
  throw new RemoteReadError(reasonCode, message);
}

/**
 * Mirrors the engine facade's `record()` in dist/build/packages/cli/src/mcp.js EXACTLY,
 * prototype check included.
 *
 * That last clause is unreachable through JSON.parse — its output is always
 * Object.prototype-rooted and a literal `__proto__` key arrives as an own enumerable
 * property, where the MCP_ARGUMENT_UNKNOWN filter catches it. It is restored anyway:
 * `RemoteReadDispatcher.dispatch()` is exported and callable in-process with a value
 * that never went through the parser, and "the transport is mirrored, not invented" is
 * the property this file claims for itself. A silent divergence in the one function
 * guarding every request is the kind of gap that is only ever found afterwards.
 */
function asRecord(value, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype) {
    fail("MCP_INVALID_REQUEST", label);
  }
  return value;
}

/**
 * This server takes no arguments, and the refusal is the feature.
 *
 * The engine facade's entrypoint parses exactly two: the operator authority pins and
 * their digest. Accepting nothing is how "carries no operator authority, ever" becomes
 * a property of the program rather than a sentence in a README.
 */
export function assertNoArguments(argv) {
  if (argv.length > 0) {
    fail("MCP_REMOTE_ARGUMENT_UNKNOWN",
      `this server takes no arguments; received ${argv.length}. The engine facade's only `
      + "arguments are --authority-pins and --authority-pins-digest, and refusing every "
      + "argument is what makes this read face structurally unable to hold them. A governed "
      + "write goes through deploy/aos-local-client/ceremony.mjs.");
  }
  return argv;
}

const CEREMONY_REMEDY =
  `A governed write to a chain on ${VM_HOST} is performed by `
  + "deploy/aos-local-client/ceremony.mjs, as a payload of steps plus at least one read-back.";

const AUTHORITY_REMEDY =
  "This verb sits in the one-shot authority family: it emits or consumes an authority "
  + "document that is minted, approved and spent once. Neither this read face nor "
  + "deploy/aos-local-client/ceremony.mjs can supply one — ceremony-plan.mjs refuses the same "
  + "family, because a batch driver holding such a document turns a per-invocation permit into "
  + "a standing grant — so it is performed out of band, as its own ceremony.";

const FIXTURE_REMEDY =
  "The catalogue marks this verb available only against a fixture installation, so there is "
  + `nothing on a real installation such as ${VM_HOST} for it to answer from. There is no `
  + "remote door to open; run it against a fixture locally.";

/**
 * Why a verb is withheld from the remote read face — `null` when it is forwardable,
 * otherwise `{ reasonCode, ground, remedy }`.
 *
 * The remedy travels with the classification on purpose. When they were separate, the
 * single WRITE_REFUSED message told an `adapter-activation-record` caller it had asked
 * for a write (it had not: mutates:false) and sent it to ceremony.mjs (which refuses
 * that family). Classification and remedy cannot drift apart if they are the same value.
 *
 * This function decides what this face PUBLISHES. It deliberately is NOT the function
 * that checks the published set — see assertNoWriteExposed.
 */
export function withheldGround(entry) {
  if (entry?.mutates === true) {
    return Object.freeze({
      reasonCode: WRITE_REFUSED,
      ground: "the catalogue marks it mutates:true",
      remedy: CEREMONY_REMEDY
    });
  }
  if (entry?.authorityBearing === true) {
    return Object.freeze({
      reasonCode: AUTHORITY_OUTPUT_REFUSED,
      ground: "the catalogue marks it authorityBearing:true — it produces an authority-bearing "
        + "output, which is not the same thing as a write",
      remedy: AUTHORITY_REMEDY
    });
  }
  if ((entry?.flags ?? []).some((flag) =>
    flag.required === true && String(flag.name).endsWith("-authority-digest"))) {
    return Object.freeze({
      reasonCode: AUTHORITY_OUTPUT_REFUSED,
      ground: "it requires a per-invocation authority file, which is spent once and never held "
        + "by a wrapper",
      remedy: AUTHORITY_REMEDY
    });
  }
  if (entry?.availability === "fixture-only") {
    return Object.freeze({
      reasonCode: FIXTURE_ONLY_REFUSED,
      ground: "the catalogue marks it availability:fixture-only",
      remedy: FIXTURE_REMEDY
    });
  }
  return null;
}

export const isForwardableRead = (entry) => withheldGround(entry) === null;

function refusalMessage(entry, withheld, source) {
  return `${entry.name} is not forwardable by the remote read face: ${withheld.ground} `
    + `(${source}). This face carries no operator-authority pins and forwards no mutating verb. `
    + withheld.remedy;
}

export const toolName = (command) => `${TOOL_PREFIX}${String(command).replaceAll("-", "_")}`;

/** Mirrors the engine facade's flag→schema mapping; a caller must not meet two shapes. */
export function flagSchema(flag) {
  if (flag.valueKind === "integer") {
    return flag.headSentinel === true
      ? { oneOf: [{ type: "integer" }, { const: "head" }] }
      : { type: "integer" };
  }
  if (flag.valueKind === "boolean") return { type: "boolean" };
  if (flag.valueKind === "list") return { type: "array", items: { type: "string" } };
  if (flag.valueKind === "json") return {};
  if (flag.valueKind === "instant") return { type: "string", format: "date-time" };
  return { type: "string" };
}

/**
 * A verb is partition-scoped exactly when it names one of the topology-owned flags.
 * Derived rather than listed, so a verb that grows a `--attest-dir` later becomes
 * partition-scoped on its own instead of silently losing the value.
 */
export const isPartitionScoped = (entry) =>
  (entry.flags ?? []).some((flag) => RESERVED_FLAGS.includes(flag.name));

export function toolDescriptor(entry) {
  const callerFlags = (entry.flags ?? []).filter((flag) => !RESERVED_FLAGS.includes(flag.name));
  const scoped = isPartitionScoped(entry);
  const properties = Object.fromEntries(callerFlags.map((flag) => [flag.name, flagSchema(flag)]));
  const required = callerFlags.filter((flag) => flag.required === true).map((flag) => flag.name);
  if (scoped) {
    properties[PARTITION_ARGUMENT] = {
      type: "string",
      enum: Object.keys(AOS_PARTITIONS),
      description: "Which governed partition to read. The workspace path behind it comes from "
        + "deploy/aos-local-client/aos-partitions.mjs and may not be named by the caller."
    };
    required.push(PARTITION_ARGUMENT);
  }
  return {
    name: toolName(entry.name),
    description: `Read-only Workflow command ${entry.name}, forwarded to the engine on ${VM_HOST} `
      + "over SSH. Stable CLI reason codes are preserved. This face performs no governed write.",
    inputSchema: {
      type: "object",
      properties,
      required: required.sort(),
      additionalProperties: false
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      // The answer is produced by another host, not by this process. A client that
      // treats every tool as local would otherwise cache or retry this wrongly.
      openWorldHint: true
    }
  };
}

/**
 * The engine's own verdict on one command, read out of `workflowMcpTools()`.
 *
 * `null` means the engine's MCP surface does not publish the verb at all (fixture-only,
 * or it requires a one-shot authority document — the engine filters both out before it
 * builds a descriptor). `undefined` means the engine's catalogue has never heard of it.
 * Both are refusals here; only a descriptor that says readOnlyHint:true and
 * destructiveHint:false is a pass.
 */
export function engineAnnotationIndex(commands, tools, toolPrefix) {
  const byToolName = new Map(tools.map((tool) => [tool.name, tool]));
  const index = new Map();
  for (const entry of commands) {
    const tool = byToolName.get(`${toolPrefix}${String(entry.name).replaceAll("-", "_")}`);
    index.set(entry.name, tool === undefined ? null : (tool.annotations ?? null));
  }
  return index;
}

/**
 * The exposure invariant: nothing the ENGINE withholds may reach the published tool list.
 *
 * This is the second of two independent derivations and it must stay independent — it
 * does not call `withheldGround`, and it must not be "simplified" into calling it. The
 * first version of this function did exactly that while its producer filtered on the
 * same predicate: filter by P, then assert not-P is empty. That gate could not go red,
 * and it was the file's headline safety property.
 *
 * The authority here is the installed engine's own `workflowMcpTools()` descriptors.
 * If `withheldGround` is ever widened — say somebody drops the authorityBearing clause —
 * this face would publish `adapter-activation-record`, the engine's descriptor for it
 * would still say readOnlyHint:false, and this assertion fires. That is a real red on a
 * real edit, not a hypothetical one.
 *
 * A missing or empty index is refused rather than passed. A gate that cannot see its
 * subject must not report the same colour as a gate that looked and found nothing wrong.
 */
export function assertNoWriteExposed(entries, engineAnnotations) {
  if (!(engineAnnotations instanceof Map) || engineAnnotations.size === 0) {
    fail(EXPOSURE_UNPROVEN,
      "the exposure invariant was handed no engine descriptors, so it could not be evaluated. "
      + "Refusing to publish: an unevaluated invariant is not a satisfied one. Load the "
      + "installed engine's workflowMcpTools() (loadInstalledCatalog does this) and pass its "
      + "annotations in.");
  }
  const leaked = [];
  for (const entry of entries) {
    if (!engineAnnotations.has(entry.name)) {
      leaked.push(`${entry.name} (the installed engine's catalogue does not define it)`);
      continue;
    }
    const annotations = engineAnnotations.get(entry.name);
    if (annotations === null) {
      leaked.push(`${entry.name} (the installed engine's own MCP surface withholds it: it is `
        + "fixture-only, or it requires a one-shot authority document)");
      continue;
    }
    if (annotations.destructiveHint === true) {
      leaked.push(`${entry.name} (the engine's own descriptor marks it destructiveHint:true)`);
      continue;
    }
    if (annotations.readOnlyHint !== true) {
      leaked.push(`${entry.name} (the engine's own descriptor does not mark it readOnlyHint:true)`);
    }
  }
  if (leaked.length > 0) {
    fail(EXPOSURE_INVARIANT,
      `refusing to publish ${leaked.length} withheld verb(s) on a read-only face: `
      + leaked.join("; "));
  }
  return entries;
}

/** Mirrors the engine facade's value coercion, including the ASCII-comma refusal. */
export function cliFlagValue(flag, value) {
  if (flag.valueKind === "string" || flag.valueKind === "instant") {
    if (typeof value !== "string") fail("MCP_ARGUMENT_INVALID", flag.name);
    return value;
  }
  if (flag.valueKind === "integer") {
    if (flag.headSentinel === true && value === "head") return "head";
    if (!Number.isSafeInteger(value)) fail("MCP_ARGUMENT_INVALID", flag.name);
    return String(value);
  }
  if (flag.valueKind === "boolean") {
    if (typeof value !== "boolean") fail("MCP_ARGUMENT_INVALID", flag.name);
    return String(value);
  }
  if (flag.valueKind === "list") {
    // The engine splits a list flag on ASCII commas, so a comma inside a value would
    // arrive as two values with no way to tell that it had. Refused at this boundary
    // rather than repaired, because a silently split value is a wrong answer.
    if (!Array.isArray(value)
      || value.some((item) => typeof item !== "string" || item.length === 0 || item.includes(","))) {
      fail("MCP_ARGUMENT_INVALID", flag.name);
    }
    return value.length === 0 ? "-" : value.join(",");
  }
  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) fail("MCP_ARGUMENT_INVALID", flag.name);
    return serialized;
  } catch {
    fail("MCP_ARGUMENT_INVALID", flag.name);
  }
}

/** One tool call, turned into the argv the host engine will be sent — or into a named refusal. */
export function remoteArgv(entry, input) {
  const given = input === undefined ? {} : asRecord(input, "arguments");
  const scoped = isPartitionScoped(entry);

  // Reserved ONLY for the verb that actually owns the flag. `snapshot-verify` declares
  // neither workspace nor attest-dir and is not partition-scoped, so a caller naming
  // `workspace` there has not named a reserved value — it has named a flag that does not
  // exist, and the advice "name partition instead" is unsatisfiable for it (its descriptor
  // exposes no partition property and its schema is additionalProperties:false). Those
  // fall through to MCP_ARGUMENT_UNKNOWN below, which is the true answer.
  const declared = new Set((entry.flags ?? []).map((flag) => flag.name));
  for (const reserved of RESERVED_FLAGS) {
    if (!declared.has(reserved)) continue;
    if (Object.hasOwn(given, reserved)) {
      fail("MCP_ARGUMENT_RESERVED",
        `${reserved} comes from the partition topology and may not be named by a caller; name `
        + `${PARTITION_ARGUMENT} instead`);
    }
  }

  const allowed = new Set((entry.flags ?? [])
    .map((flag) => flag.name)
    .filter((name) => !RESERVED_FLAGS.includes(name)));
  if (scoped) allowed.add(PARTITION_ARGUMENT);
  const unknown = Object.keys(given).filter((name) => !allowed.has(name));
  if (unknown.length > 0) fail("MCP_ARGUMENT_UNKNOWN", unknown.sort().join(","));

  let target = null;
  let partition = null;
  if (scoped) {
    partition = given[PARTITION_ARGUMENT];
    if (typeof partition !== "string" || partition.length === 0) {
      fail("MCP_ARGUMENT_MISSING", PARTITION_ARGUMENT);
    }
    try {
      target = aosPartition(partition);
    } catch (error) {
      fail("MCP_PARTITION_UNKNOWN", String(error?.message ?? error));
    }
  }

  const missing = (entry.flags ?? [])
    .filter((flag) => flag.required === true
      && !RESERVED_FLAGS.includes(flag.name)
      && given[flag.name] === undefined)
    .map((flag) => flag.name);
  if (missing.length > 0) fail("MCP_ARGUMENT_MISSING", missing.join(","));

  const argv = [entry.name];
  for (const flag of entry.flags ?? []) {
    if (flag.name === "workspace") {
      argv.push("--workspace", target.workspace);
      continue;
    }
    if (flag.name === "attest-dir") {
      argv.push("--attest-dir", target.attestDir);
      continue;
    }
    const value = given[flag.name];
    if (value === undefined) continue;
    argv.push(`--${flag.name}`, cliFlagValue(flag, value));
  }
  return { argv, partition, workspace: target?.workspace ?? null };
}

/**
 * One engine verb on the host that owns the chain. A refusal is data; only a broken
 * transport throws.
 *
 * Every remote argument is quoted: ssh re-joins its remote argv with spaces and hands
 * the result to a login shell, so an unquoted value carrying parentheses or a space
 * becomes a remote syntax error rather than an argument (paid for by STORY-133).
 */
/**
 * The text a failed ssh invocation is allowed to speak with.
 *
 * The last clause is the one that matters for a transport that never started: when ssh
 * cannot be spawned at all (ENOENT) there is no stderr and no stdout, and
 * `spawn ssh ENOENT` IS the whole diagnosis. Without the fallback the caller was handed
 * reasonCode MCP_REMOTE_NON_JSON_OUTPUT with an empty error string — the one failure
 * whose message is the entire answer, delivered as silence. The same held for any error
 * whose code is a non-numeric string other than the maxBuffer one, which sshRead handles
 * above this point.
 *
 * Extracted so a test can exercise all three shapes without a network or a shim on PATH.
 */
export function sshFailureText(error) {
  return String(error?.stderr ?? "").trim()
    || String(error?.stdout ?? "").trim()
    || String(error?.message ?? error).trim();
}

async function sshRead(argv) {
  const remote = ["node", VM_ENGINE_CLI, ...argv].map(shellQuote).join(" ");
  try {
    const { stdout } = await runFile("ssh", ["-n", VM_HOST, remote],
      { timeout: SSH_TIMEOUT_MS, maxBuffer: SSH_MAX_BUFFER });
    return { ok: true, code: 0, text: stdout, json: parseJson(stdout) };
  } catch (error) {
    if (error?.killed === true) {
      fail("MCP_REMOTE_READ_TIMEOUT",
        `the host engine did not answer ${argv[0]} within ${SSH_TIMEOUT_MS}ms; this bound stops `
        + "this client waiting, it does not cancel the projection already running on the host");
    }
    if (error?.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
      fail("MCP_REMOTE_READ_OVERSIZED",
        `${argv[0]} answered with more than ${SSH_MAX_BUFFER} bytes; narrow the read (for example `
        + "with --limit) rather than raising the ceiling");
    }
    const emitted = sshFailureText(error);
    return {
      ok: false,
      code: typeof error?.code === "number" ? error.code : null,
      text: emitted,
      json: parseJson(emitted)
    };
  }
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * How long the host's catalogue may be believed without re-asking.
 *
 * An MCP server started by a client lives for the whole session — hours. A catalogue
 * cached once and never invalidated is an index with no freshness precondition, which is
 * this platform's own recorded failure mode (索引类工具必带新鲜度前置): the VM engine can
 * be upgraded mid-session, a verb can become mutates:true, and a face answering from a
 * snapshot would keep forwarding it while telling the caller it had asked the authority.
 * The round trip costs about half a second, so sixty seconds is a bound whose price is
 * roughly one percent of one call per minute and whose benefit is that the window in
 * which this face can be wrong is stated rather than unbounded.
 */
export const HOST_CATALOG_TTL_MS = 60_000;

/**
 * The host engine's own catalogue, cached for HOST_CATALOG_TTL_MS and re-asked after a
 * failure or after the bound expires.
 *
 * The installed copy decides what this face PUBLISHES; the host decides what it may
 * FORWARD. Both must call a verb a read. Two engines can be at different versions —
 * they are two installations — and the direction that matters is the permissive one: a
 * verb the local catalogue thinks is a read while the host treats it as a write is the
 * only way a write could cross this boundary, and one question to the authority closes
 * it. A rejected fetch is not cached, or a single unreachable moment would poison the
 * face for the rest of the session.
 *
 * What this does NOT give you: a guarantee that the host agreed at the instant of the
 * forward. It gives you "the host agreed within the last HOST_CATALOG_TTL_MS". Saying
 * more than that in the `instructions` string was the defect, not the cache.
 */
let hostCatalogEntry = null;

export async function hostCatalog(now = Date.now()) {
  if (hostCatalogEntry !== null && now - hostCatalogEntry.fetchedAt < HOST_CATALOG_TTL_MS) {
    return hostCatalogEntry.promise;
  }
  const pending = { fetchedAt: now, promise: null };
  pending.promise = fetchHostCatalog().catch((error) => {
    // Only clear what THIS fetch installed: a later refresh may already have replaced it.
    if (hostCatalogEntry === pending) hostCatalogEntry = null;
    throw error;
  });
  hostCatalogEntry = pending;
  return pending.promise;
}

/** Drop the cached host catalogue. Exported so a test can prove the bound rather than wait it out. */
export function resetHostCatalog() {
  hostCatalogEntry = null;
}

/** What the cache currently holds, for a probe that wants to see the bound without SSH. */
export function hostCatalogCacheAge(now = Date.now()) {
  return hostCatalogEntry === null ? null : now - hostCatalogEntry.fetchedAt;
}

async function fetchHostCatalog() {
  const result = await sshRead(["commands"]);
  const commands = result.json?.commands ?? result.json?.result?.commands ?? null;
  if (!result.ok || !Array.isArray(commands) || commands.length === 0) {
    fail("MCP_REMOTE_CATALOGUE_UNAVAILABLE",
      `the engine on ${VM_HOST} did not report its command catalogue`
      + `${result.json?.reasonCode ? `: ${result.json.reasonCode}` : ""}`);
  }
  return new Map(commands.map((entry) => [entry.name, entry]));
}

/** The host's own answer about this verb. Absent, or withheld there, is a refusal here. */
export function assertHostAgrees(entry, hostEntry) {
  if (hostEntry === undefined) {
    fail("MCP_REMOTE_VERB_ABSENT",
      `the engine on ${VM_HOST} does not define ${entry.name}; the two installed copies are at `
      + "different versions and the host's catalogue is the one that answers");
  }
  const withheld = withheldGround(hostEntry);
  if (withheld !== null) {
    fail(withheld.reasonCode, refusalMessage(entry, withheld, `${VM_HOST}'s own catalogue`));
  }
  return hostEntry;
}

export function buildCatalog({ commands, frameworkVersion = null, engineAnnotations = null }) {
  const byTool = new Map();
  for (const entry of commands) {
    const name = toolName(entry.name);
    if (byTool.has(name)) {
      fail("MCP_TOOL_COLLISION", "catalog command names do not map one-to-one");
    }
    // EVERY entry is indexed, including the withheld ones. A caller who asks for a
    // write verb must be told it was refused and where to go instead; answering
    // "unknown tool" would send them looking for a typo.
    byTool.set(name, entry);
  }
  const forwardable = commands.filter(isForwardableRead);
  const withheld = commands.filter((entry) => !isForwardableRead(entry));
  // What this actually catches is a DUPLICATE VERB NAME in the host catalogue, and
  // saying so is the point: both halves are complementary filters over the same
  // `commands`, so their lengths always sum to `commands.length`, and the only way this
  // can differ from `byTool.size` is two entries collapsing onto one key. That matters
  // here — the later of two same-named entries wins the map, so a duplicate would decide
  // by arrival order whether a verb is forwarded or refused. It does NOT check that the
  // split is correct; `assertNoWriteExposed` answers that, from a second source.
  // (Stated precisely because a comment claiming a guard the code does not provide is
  // worse than no comment: the next reader stops looking for the real one.)
  if (forwardable.length + withheld.length !== byTool.size) {
    fail(EXPOSURE_INVARIANT,
      `the published/withheld split does not account for the whole catalogue: `
      + `${forwardable.length} + ${withheld.length} !== ${byTool.size}`);
  }
  assertNoWriteExposed(forwardable, engineAnnotations);
  return {
    byTool,
    forwardable,
    withheld,
    frameworkVersion,
    tools: forwardable.map(toolDescriptor)
  };
}

/** The command catalogue of the trusted copy installed on THIS machine. */
export async function loadInstalledCatalog(engineRoot = LOCAL_ENGINE) {
  const cli = await import(pathToFileURL(
    resolve(engineRoot, "dist/build/packages/cli/src/index.js")).href);
  let frameworkVersion = null;
  try {
    const core = await import(pathToFileURL(
      resolve(engineRoot, "dist/build/packages/core/src/index.js")).href);
    frameworkVersion = core.FRAMEWORK_VERSION ?? null;
  } catch {
    // A version string is a courtesy in `instructions`; the catalogue is the substance.
    frameworkVersion = null;
  }
  if (!Array.isArray(cli.COMMAND_CATALOG) || cli.COMMAND_CATALOG.length === 0) {
    fail("MCP_REMOTE_CATALOGUE_UNAVAILABLE",
      "the installed engine copy exports no COMMAND_CATALOG; without it this face has no derived allow-list");
  }
  // The second, independent source for the exposure invariant: the engine's OWN MCP
  // descriptors. Not a re-reading of COMMAND_CATALOG through this file's predicate —
  // `workflowMcpTools()` is the engine's code deciding what it itself would publish and
  // with which annotations, which is precisely why it can disagree with `withheldGround`.
  const mcp = await import(pathToFileURL(
    resolve(engineRoot, "dist/build/packages/cli/src/mcp.js")).href);
  if (typeof mcp.workflowMcpTools !== "function" || typeof mcp.WORKFLOW_MCP_TOOL_PREFIX !== "string") {
    fail("MCP_REMOTE_CATALOGUE_UNAVAILABLE",
      "the installed engine copy exports no workflowMcpTools()/WORKFLOW_MCP_TOOL_PREFIX; without "
      + "them the exposure invariant has no second source and this face refuses to publish on the "
      + "strength of its own predicate alone");
  }
  const engineAnnotations = engineAnnotationIndex(
    cli.COMMAND_CATALOG, mcp.workflowMcpTools(), mcp.WORKFLOW_MCP_TOOL_PREFIX);
  return { commands: cli.COMMAND_CATALOG, frameworkVersion, engineAnnotations };
}

function errorResult(error) {
  const reasonCode = typeof error?.reasonCode === "string" ? error.reasonCode : "MCP_REMOTE_INTERNAL_ERROR";
  // Scrubbed because a diagnostic can quote a path off this machine and an MCP
  // transcript is routinely pasted into a receipt or an issue (TCRN-AOS-INC-037).
  const result = {
    ok: false,
    reasonCode,
    error: scrubHostPathsInText(String(error?.message ?? error))
  };
  return {
    content: [{ type: "text", text: JSON.stringify(result) }],
    structuredContent: result,
    isError: true
  };
}

export class RemoteReadDispatcher {
  #catalog;
  #initialized = false;

  constructor(catalog) {
    this.#catalog = catalog;
  }

  async #callTool(name, input) {
    if (typeof name !== "string") fail("MCP_TOOL_UNKNOWN", "tool name");
    const entry = this.#catalog.byTool.get(name);
    if (entry === undefined) fail("MCP_TOOL_UNKNOWN", name);

    const withheld = withheldGround(entry);
    if (withheld !== null) {
      fail(withheld.reasonCode, refusalMessage(entry, withheld, "the installed engine's catalogue"));
    }

    const plan = remoteArgv(entry, input);
    assertHostAgrees(entry, (await hostCatalog()).get(entry.name));

    const result = await sshRead(plan.argv);
    if (!result.ok) {
      const refused = {
        ok: false,
        command: entry.name,
        partition: plan.partition,
        host: VM_HOST,
        reasonCode: result.json?.reasonCode
          ?? (result.json === null ? "MCP_REMOTE_NON_JSON_OUTPUT" : "MCP_REMOTE_READ_REFUSED"),
        exitCode: result.code,
        error: scrubHostPathsInText(result.text).slice(0, 2000)
      };
      return {
        content: [{ type: "text", text: JSON.stringify(refused) }],
        structuredContent: refused,
        isError: true
      };
    }
    // The engine's own bytes, unaltered. Scrubbing a successful read would mean this
    // face could change what the chain says about itself, which is a worse failure
    // than the leak it would be guarding against; only diagnostics are rewritten.
    const structured = {
      ok: true,
      command: entry.name,
      partition: plan.partition,
      host: VM_HOST,
      result: result.json ?? result.text
    };
    return {
      content: [{ type: "text", text: result.text }],
      structuredContent: structured,
      isError: false
    };
  }

  async dispatch(value) {
    const request = asRecord(value, "JSON-RPC request");
    if (request.jsonrpc !== "2.0" || typeof request.method !== "string") {
      fail("MCP_INVALID_REQUEST", "jsonrpc or method");
    }
    const notification = request.id === undefined;
    if (!notification && typeof request.id !== "string" && typeof request.id !== "number") {
      fail("MCP_INVALID_REQUEST", "id");
    }
    const id = request.id;

    if (request.method === "notifications/initialized") {
      this.#initialized = true;
      return null;
    }
    if (notification) return null;

    if (request.method === "initialize") {
      const parameters = asRecord(request.params, "initialize params");
      const requested = typeof parameters.protocolVersion === "string" ? parameters.protocolVersion : "";
      const protocolVersion = PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[0];
      this.#initialized = true;
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
          instructions: `Read-only face onto the governed chains hosted on ${VM_HOST}. Every tool `
            + "names a partition and is forwarded to that host's engine over SSH; CLI reason codes "
            + "are preserved. The exposed set is derived from the installed engine's command "
            + `catalogue${this.#catalog.frameworkVersion ? ` (${this.#catalog.frameworkVersion})` : ""} `
            + `and re-checked against the host's own catalogue, refreshed at most every `
            + `${Math.round(HOST_CATALOG_TTL_MS / 1000)}s — so a forward carries the host's answer `
            + "from within that window, not from the instant of the call. No mutating or "
            + "authority-bearing verb is forwarded and no operator-authority pins are carried: a "
            + "governed write is performed by deploy/aos-local-client/ceremony.mjs, and a verb in "
            + "the one-shot authority family is performed out of band as its own ceremony."
        }
      };
    }

    if (!this.#initialized) {
      return { jsonrpc: "2.0", id, error: { code: -32002, message: "Server not initialized" } };
    }
    if (request.method === "ping") {
      return { jsonrpc: "2.0", id, result: {} };
    }
    if (request.method === "tools/list") {
      return { jsonrpc: "2.0", id, result: { tools: this.#catalog.tools } };
    }
    if (request.method === "tools/call") {
      try {
        const parameters = asRecord(request.params, "tools/call params");
        return {
          jsonrpc: "2.0",
          id,
          result: await this.#callTool(parameters.name, parameters.arguments)
        };
      } catch (error) {
        // A refusal is a tool RESULT, not a protocol error: the caller asked a legal
        // question and this face is answering "no, and here is where to go instead".
        return { jsonrpc: "2.0", id, result: errorResult(error) };
      }
    }
    return { jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } };
  }
}

/**
 * How many tool calls may be in flight at once.
 *
 * The engine facade awaits each dispatch inline in its read loop, and this file mirrors
 * its transport — but the mirroring stops at the wire. There, every call is in-process
 * and sub-millisecond; here, every call is an SSH round trip bounded at SSH_TIMEOUT_MS,
 * two minutes. Serialised, one wedged read stalls `ping`, `tools/list` and every other
 * tool behind it for long enough that a client's own keepalive declares the server dead
 * and kills it, taking the pending read with it. JSON-RPC does not require responses in
 * request order, so the fix is to stop blocking the reader.
 *
 * The limiter is not decoration: without one, a client that pipelines a hundred calls
 * opens a hundred ssh processes at once. Eight is a chosen bound, not a measured optimum —
 * what matters is that the fan-out has a stated ceiling rather than the client's queue
 * depth. Raise it only against a measurement of this machine's ssh concurrency, not a hunch.
 */
export const MAX_IN_FLIGHT = 8;

/**
 * `dispatcher` is a seam, and only a seam: production always takes the default. It exists
 * because the property this loop has to prove — that a slow call does not hold up the
 * calls behind it — cannot be observed without a slow call, and every slow call here is
 * an SSH round trip. A checked-in test that needs the VM is a test that does not run.
 */
export async function runRemoteReadMcpStdio(input, output, catalog,
  dispatcher = new RemoteReadDispatcher(catalog)) {
  const inFlight = new Set();

  // One write call per response, and the whole line is built before the call. Node's
  // Writable.write() appends the entire chunk before it returns, so two responses
  // completing at once cannot splice into each other's frame.
  const writeLine = (value) => output.write(`${JSON.stringify(value)}\n`);

  const start = (parsed) => {
    const task = dispatcher.dispatch(parsed).then(
      (response) => {
        if (response !== null) writeLine(response);
      },
      (error) => {
        writeLine({
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32600,
            message: "Invalid Request",
            data: {
              reasonCode: typeof error?.reasonCode === "string" ? error.reasonCode : "MCP_INVALID_REQUEST"
            }
          }
        });
      }
    ).finally(() => {
      inFlight.delete(task);
    });
    inFlight.add(task);
  };

  let buffered = "";
  for await (const chunk of input) {
    buffered += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
    if (Buffer.byteLength(buffered, "utf8") > MAX_LINE_BYTES) {
      fail("MCP_INPUT_OVERSIZED", "JSON-RPC line exceeds one MiB");
    }
    while (buffered.includes("\n")) {
      const newline = buffered.indexOf("\n");
      const line = buffered.slice(0, newline);
      buffered = buffered.slice(newline + 1);
      if (line.trim() === "") continue;
      let parsed;
      try {
        parsed = JSON.parse(line);
      } catch (error) {
        writeLine({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: String(error?.message ?? error) }
        });
        continue;
      }
      start(parsed);
      // Back-pressure, not ordering: yield the reader only once the window is full, and
      // only until one slot frees. A `ping` behind a wedged read still overtakes it.
      while (inFlight.size >= MAX_IN_FLIGHT) {
        await Promise.race(inFlight);
      }
    }
  }
  // stdin ended; the answers to what it carried have not necessarily been written yet.
  await Promise.allSettled(inFlight);
  if (buffered.trim() !== "") {
    writeLine({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "unterminated JSON-RPC line" }
    });
  }
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  try {
    assertNoArguments(process.argv.slice(2));
    await runRemoteReadMcpStdio(process.stdin, process.stdout, buildCatalog(await loadInstalledCatalog()));
  } catch (error) {
    // stdout belongs to the protocol; a startup failure must never be parsed as a frame.
    process.stderr.write(`${JSON.stringify({
      ok: false,
      reasonCode: typeof error?.reasonCode === "string" ? error.reasonCode : "MCP_REMOTE_INTERNAL_ERROR",
      error: scrubHostPathsInText(String(error?.message ?? error))
    })}\n`);
    process.exitCode = 1;
  }
}
