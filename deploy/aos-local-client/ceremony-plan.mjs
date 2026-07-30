// Planning and refusal for the local-side remote governance ceremony
// (TCRN-AOS-STORY-133), as pure functions.
//
// This is the half that decides WHAT will be sent to the host that owns the chain.
// It is separate from the half that sends it for the usual reason — the sending half
// needs SSH and a live chain and therefore only runs by hand — and for one specific
// paid-for reason:
//
// STORY-131's write-face probe sent `--title` to `work-create`, `--note` to
// `work-annotate` and `--expected-version` to `knowledge-checkpoint`. The engine
// answered CLI_ARGUMENT_UNKNOWN, which proves nothing about the question that was
// being asked, and the whole probe had to be rebuilt against the engine's own
// `commands` catalogue and re-run. That correction is mechanised here: a step whose
// flags the verb does not define is refused BEFORE it reaches the network, and the
// refusal names the flag.
//
// The five values a remote ceremony always needs — workspace, attest-dir, actor,
// instant, expected-version — are supplied from the topology and from a live read,
// and a payload may NOT override the first three or the last one. That is not
// tidiness. `--expected-version` is the only thing that actually enforces a freeze
// (STORY-131 recorded that in those words: a sole-writer claim is a promise, the
// sentinel is the enforcement), so a payload-supplied version would be an operator
// asserting a head they read at some earlier time. And `--attest-dir` decides which
// sidecar the attestation receipt lands in; a ceremony that could name its own would
// be a ceremony that can quietly attest somewhere nobody reads.

export const PAYLOAD_SCHEMA = "aos.local-client-ceremony.v1";

/**
 * Flags this wrapper owns. A payload naming one of these is refused rather than
 * merged, because every one of them has an authority that is not the payload:
 * three come from the topology and one comes from a read taken moments earlier.
 */
export const RESERVED_FLAGS = Object.freeze(["workspace", "attest-dir", "expected-version"]);

/**
 * Verbs this wrapper will never drive, DERIVED rather than listed.
 *
 * The relocation and gate-identity families take a per-invocation authority file plus
 * its digest on the command line. ADR 0003 makes the same derivation for the MCP
 * facade and says why a hand-written list is wrong: a list of command names goes stale
 * in the PERMISSIVE direction — a verb added later is absent from the list and is
 * therefore allowed. The catalogue's own shape ("does this verb require a flag whose
 * name ends in -authority-digest") cannot go stale that way.
 *
 * The point is not that such a ceremony is forbidden. It is that it must not be
 * reachable from a convenience wrapper: an authority document is minted, approved and
 * spent once, and a batch driver holding one would turn a per-invocation permit into
 * a standing grant.
 */
export function requiresOutOfBandAuthority(command) {
  return (command?.flags ?? []).some((flag) =>
    flag.required === true && /-authority-digest$/u.test(String(flag.name)));
}

/** The engine's `commands` output, indexed by verb name. */
export function catalogueIndex(commands) {
  const index = new Map();
  for (const command of commands ?? []) {
    index.set(command.name, {
      name: command.name,
      mutates: command.mutates === true,
      flags: new Map((command.flags ?? []).map((flag) => [flag.name, flag])),
      requiresOutOfBandAuthority: requiresOutOfBandAuthority(command)
    });
  }
  return index;
}

/** A payload is a batch of steps; malformed shapes are refused whole. */
export function assertPayload(payload) {
  const problems = [];
  if (payload?.schemaVersion !== PAYLOAD_SCHEMA) {
    problems.push(`schemaVersion must be ${PAYLOAD_SCHEMA}`);
  }
  if (typeof payload?.story !== "string" || payload.story.length === 0) {
    problems.push("story must name the work item this ceremony is performed for");
  }
  if (typeof payload?.intent !== "string" || payload.intent.length === 0) {
    problems.push("intent must say in one sentence what this ceremony does");
  }
  for (const family of ["steps", "readback"]) {
    const list = payload?.[family];
    if (!Array.isArray(list)) {
      problems.push(`${family} must be an array`);
      continue;
    }
    for (const [index, step] of list.entries()) {
      if (typeof step?.verb !== "string" || step.verb.length === 0) {
        problems.push(`${family}[${index}].verb must be a verb name`);
      }
      if (step?.flags !== undefined && (typeof step.flags !== "object" || Array.isArray(step.flags))) {
        problems.push(`${family}[${index}].flags must be an object`);
      }
    }
  }
  // A ceremony with no read-back is a write nobody confirmed. The whole reason this
  // wrapper exists is that the previous remote write was verified by reading it back;
  // making that structural stops the next operator from skipping it under time
  // pressure and calling the receipt a proof.
  if (Array.isArray(payload?.steps) && payload.steps.length === 0) {
    problems.push("steps must contain at least one step");
  }
  if (Array.isArray(payload?.readback) && payload.readback.length === 0) {
    problems.push("readback must contain at least one read; a write nobody read back is not proven");
  }
  return {
    ok: problems.length === 0,
    reasonCode: problems.length === 0 ? "PAYLOAD_ACCEPTED" : "PAYLOAD_INVALID",
    problems
  };
}

/**
 * One step, turned into the argv that will be sent — or into a named refusal.
 *
 * `chainVersion` and `at` are passed in rather than read here, so this function is
 * total and testable: the same step with the same catalogue always plans the same argv.
 */
export function planStep({ step, catalogue, supply, chainVersion, at }) {
  const command = catalogue.get(step.verb);
  const refuse = (reasonCode, detail) => ({ ok: false, verb: step.verb, reasonCode, detail: detail ?? null });

  if (!command) return refuse("VERB_NOT_IN_CATALOGUE", "the host engine's own commands output does not define it");
  if (command.requiresOutOfBandAuthority) {
    return refuse("VERB_REQUIRES_OUT_OF_BAND_AUTHORITY",
      "this verb takes a per-invocation authority file; it is performed as its own ceremony, never from a batch wrapper");
  }

  const given = { ...(step.flags ?? {}) };
  for (const reserved of RESERVED_FLAGS) {
    if (Object.hasOwn(given, reserved)) {
      return refuse("RESERVED_FLAG_IN_PAYLOAD", `${reserved} is supplied by the wrapper and may not be named by a payload`);
    }
  }
  for (const name of Object.keys(given)) {
    if (!command.flags.has(name)) {
      return refuse("FLAG_NOT_DEFINED_BY_VERB", `${step.verb} defines no --${name}`);
    }
  }

  // Auto-supply, but only what the verb actually declares. Sending a flag a verb does
  // not define is the exact failure this wrapper exists to prevent, so the wrapper
  // must not commit it while preventing it.
  const supplied = {};
  if (command.flags.has("workspace")) supplied.workspace = supply.workspace;
  if (command.flags.has("attest-dir")) supplied["attest-dir"] = supply.attestDir;
  if (command.flags.has("actor") && !Object.hasOwn(given, "actor")) supplied.actor = supply.actor;
  if (command.flags.has("at") && !Object.hasOwn(given, "at")) supplied.at = at;
  if (command.flags.has("expected-version")) {
    if (!Number.isInteger(chainVersion)) {
      return refuse("HEAD_SENTINEL_UNAVAILABLE",
        "this verb takes --expected-version and no live chain version was read; a guessed sentinel enforces nothing");
    }
    supplied["expected-version"] = String(chainVersion);
  }

  const flags = { ...supplied, ...given };
  const missing = [...command.flags.values()]
    .filter((flag) => flag.required === true && !Object.hasOwn(flags, flag.name))
    .map((flag) => flag.name);
  if (missing.length > 0) {
    return refuse("REQUIRED_FLAG_MISSING", `${step.verb} requires --${missing.join(", --")}`);
  }

  const argv = [step.verb];
  for (const name of Object.keys(flags).sort()) {
    argv.push(`--${name}`, String(flags[name]));
  }
  return {
    ok: true,
    verb: step.verb,
    mutates: command.mutates,
    reasonCode: "STEP_PLANNED",
    argv,
    autoSupplied: Object.keys(supplied).sort(),
    fromPayload: Object.keys(given).sort()
  };
}

/**
 * Resolve a read-back's expectations, including the ones that point AT a step's own
 * flag value rather than restating it.
 *
 * `{"expectSameAs": [{"field": "scope", "step": 0, "flag": "scope"}]}` means "the
 * stored scope must equal what step 0 sent". A payload could instead carry the value
 * twice — once as the flag, once as the expectation — and that is the shape to avoid:
 * two copies of a 700-byte string, and an operator who edits one of them turns the
 * read-back into a comparison of the payload against itself. Pointing at the sent
 * value makes the comparison structurally unable to drift.
 */
export function resolveExpectations({ step, steps }) {
  const expected = { ...(step.expect ?? {}) };
  const problems = [];
  for (const reference of step.expectSameAs ?? []) {
    const source = steps?.[reference.step];
    const value = source?.flags?.[reference.flag];
    if (value === undefined) {
      problems.push(`expectSameAs cannot resolve steps[${reference.step}].flags.${reference.flag}`);
      continue;
    }
    expected[reference.field] = value;
  }
  return { expected, problems };
}

/**
 * Did the read-back actually confirm the write?
 *
 * The predicate is FULL VALUE on the fields the ceremony claimed to set, not "the read
 * succeeded". A `work-show` that returns 200 and a record proves the record exists; it
 * does not prove the value that was written is the value now stored. STORY-132 paid for
 * the other end of this: an annotate whose value equalled what was already there was
 * refused by the engine as changing nothing, and the walkthrough had been reading its
 * own success out of a 200.
 */
export function judgeReadback({ expected, observed }) {
  const compared = Object.entries(expected).map(([field, value]) => ({
    field,
    expected: value,
    observed: observed?.[field] ?? null,
    equal: observed?.[field] === value
  }));
  const unequal = compared.filter((entry) => !entry.equal).map((entry) => entry.field);
  return {
    ok: unequal.length === 0 && compared.length > 0,
    reasonCode: compared.length === 0 ? "NOTHING_COMPARED"
      : unequal.length === 0 ? "READBACK_MATCHES_FULL_VALUE"
        : "READBACK_DIVERGENT",
    compared,
    unequal
  };
}
