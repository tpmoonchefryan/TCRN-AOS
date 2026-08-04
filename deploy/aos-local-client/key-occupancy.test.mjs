// TCRN-CROSS-STORY-136 — the key-occupancy judgements, against literals.
//
// This file never opens an SSH connection and never needs `dist/`: every case here is
// about a decision the tool makes BEFORE or AFTER the chain is read, and those are the
// decisions that can be wrong without anything erroring. The live answers (which key is
// actually taken on the cross chain today) belong to an acceptance run, not here — they
// change tomorrow, and a test that asserts today's chain contents fails for a reason
// that has nothing to do with the code.
//
// Every case is written so the mutation that should make it fail is visible in the case
// itself: fixed inputs, a stub derivation whose output is readable, and rosters that
// differ from the truth by exactly one term. A case whose inputs cannot disagree is a
// case that cannot fail.

import { strict as assert } from "node:assert";
import test from "node:test";

import {
  KINDS, READ_ONLY_VERBS, familyKey, familyOrdinal, gapsBelow, loadDerivation,
  nextFreeOrdinal, occupiedOrdinals, parseArgs, readAllRecords, resolveChain
} from "./key-occupancy.mjs";

const PREFIX = "TCRN-CROSS";

/** A derivation stub whose "id" is the key itself, so an intersection is readable. */
const echoDerive = (namespace, key) => `${namespace}:${key}`;

const thrown = (fn) => {
  try {
    fn();
  } catch (error) {
    return error;
  }
  return null;
};

// ---------------------------------------------------------------------------
// familyKey / familyOrdinal — the ordinal spelling, both directions
// ---------------------------------------------------------------------------

test("familyKey zero-pads to the format's own width", () => {
  assert.equal(familyKey(PREFIX, "MIN", 1), "TCRN-CROSS-MIN-001");
  assert.equal(familyKey(PREFIX, "MIN", 53), "TCRN-CROSS-MIN-053");
  assert.equal(familyKey(PREFIX, "MIN", 999), "TCRN-CROSS-MIN-999");
});

test("familyOrdinal accepts only the canonical spelling and returns its ordinal", () => {
  assert.equal(familyOrdinal("TCRN-CROSS-MIN-001", PREFIX, "MIN"), 1);
  assert.equal(familyOrdinal("TCRN-CROSS-MIN-053", PREFIX, "MIN"), 53);
  assert.equal(familyOrdinal("TCRN-CROSS-GATE-999", PREFIX, "GATE"), 999);
});

test("familyOrdinal refuses the near-miss spellings that used to answer FREE", () => {
  // These three all pass a prefix-only check, all derive a legal id, and none of those
  // ids is on the chain — so before this guard existed each answered FREE and exited 0
  // while TCRN-CROSS-MIN-053 was occupied.
  for (const key of ["TCRN-CROSS-MIN-53", "TCRN-CROSS-MIN-0053", "TCRN-CROSS-MIN-053-X"]) {
    const error = thrown(() => familyOrdinal(key, PREFIX, "MIN"));
    assert.ok(error, `${key} was accepted`);
    assert.match(error.message, /canonical TCRN-CROSS-MIN-NNN form/u);
    assert.match(error.message, new RegExp(key, "u"), "the refusal names the key it refused");
  }
});

test("familyOrdinal names the canonical spelling only when one exists", () => {
  assert.match(
    thrown(() => familyOrdinal("TCRN-CROSS-MIN-53", PREFIX, "MIN")).message,
    /Did you mean TCRN-CROSS-MIN-053\?/u);
  // No integer to suggest: the tail is not a number at all.
  assert.doesNotMatch(
    thrown(() => familyOrdinal("TCRN-CROSS-MIN-053-X", PREFIX, "MIN")).message,
    /Did you mean/u);
  // An integer, but outside the family's range, so there is nothing legal to propose.
  assert.doesNotMatch(
    thrown(() => familyOrdinal("TCRN-CROSS-MIN-1000", PREFIX, "MIN")).message,
    /Did you mean/u);
});

test("familyOrdinal refuses ordinal zero, which the width alone would allow", () => {
  assert.match(
    thrown(() => familyOrdinal("TCRN-CROSS-MIN-000", PREFIX, "MIN")).message,
    /outside the family's \[1, 999\] range/u);
});

test("familyOrdinal refuses another chain's and another kind's key", () => {
  assert.match(
    thrown(() => familyOrdinal("TCRN-AOS-MIN-053", PREFIX, "MIN")).message,
    /is not in family TCRN-CROSS-MIN-NNN/u);
  assert.match(
    thrown(() => familyOrdinal("TCRN-CROSS-CONF-050", PREFIX, "MIN")).message,
    /is not in family TCRN-CROSS-MIN-NNN/u);
});

// ---------------------------------------------------------------------------
// Occupancy arithmetic
// ---------------------------------------------------------------------------

test("occupiedOrdinals counts this family only, never the namespace", () => {
  const ids = new Set([
    echoDerive("minutes", "TCRN-CROSS-MIN-001"),
    echoDerive("minutes", "TCRN-CROSS-MIN-003"),
    // Same namespace, other family: a different key shape on the same chain.
    echoDerive("minutes", "TCRN-CROSS-SPRINT-MIN-002"),
    // Same namespace, other chain: exactly the shape the payload deep walk over-reads.
    echoDerive("minutes", "TCRN-AOS-MIN-002"),
    // Same key, other namespace.
    echoDerive("conference", "TCRN-CROSS-MIN-002")
  ]);
  assert.deepEqual(occupiedOrdinals(ids, echoDerive, "minutes", PREFIX, "MIN"), [1, 3]);
});

test("occupiedOrdinals returns nothing for an untouched family", () => {
  assert.deepEqual(occupiedOrdinals(new Set(), echoDerive, "minutes", PREFIX, "MIN"), []);
});

test("gapsBelow reports the holes below the highest, and only those", () => {
  assert.deepEqual(gapsBelow([1, 2, 5, 8], 8), [3, 4, 6, 7]);
  assert.deepEqual(gapsBelow([3], 3), [1, 2]);
  assert.deepEqual(gapsBelow([1, 2, 3], 3), []);
  assert.deepEqual(gapsBelow([], 0), []);
});

test("nextFreeOrdinal is highest+1, never the lowest gap", () => {
  assert.deepEqual(nextFreeOrdinal([]), { highest: 0, next: 1 });
  assert.deepEqual(nextFreeOrdinal([1, 2, 3]), { highest: 3, next: 4 });
  // The hole at 2 is history that cannot be re-issued; 4 is the answer, not 2.
  assert.deepEqual(nextFreeOrdinal([1, 3]), { highest: 3, next: 4 });
});

test("nextFreeOrdinal refuses to invent a key the format cannot express", () => {
  const error = thrown(() => nextFreeOrdinal([998, 999]));
  assert.ok(error, "an exhausted family was allocated a 1000th key");
  assert.match(error.message, /exhausted at ordinal 999/u);
  assert.match(error.message, /naming decision, not this tool's to make/u);
});

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

test("parseArgs accepts each command and each kind", () => {
  for (const kind of Object.keys(KINDS)) {
    assert.deepEqual(parseArgs(["next-free-key", "--chain", "cross", "--kind", kind]),
      { command: "next-free-key", chain: "cross", kind });
  }
  assert.deepEqual(
    parseArgs(["key-taken", "--chain", "cross", "--kind", "min", "--key", "TCRN-CROSS-MIN-053"]),
    { command: "key-taken", chain: "cross", kind: "min", key: "TCRN-CROSS-MIN-053" });
});

test("parseArgs treats a help request as a request, not an error", () => {
  for (const argv of [[], ["--help"], ["-h"]]) {
    const error = thrown(() => parseArgs(argv));
    assert.equal(error?.constructor.name, "HelpRequest",
      "help must not share an exit status with a usage error");
    assert.match(error.message, /key-occupancy/u);
  }
});

test("parseArgs refuses a repeated flag instead of letting the last one win", () => {
  const error = thrown(() => parseArgs(
    ["next-free-key", "--chain", "cross", "--chain", "joi", "--kind", "min"]));
  assert.ok(error, "a repeated --chain was accepted");
  assert.equal(error.constructor.name, "UsageError");
  assert.match(error.message, /--chain was given twice/u);
  assert.match(error.message, /cross/u);
  assert.match(error.message, /joi/u);
});

test("parseArgs refuses each malformed invocation", () => {
  const cases = [
    [["frobnicate", "--chain", "cross"], /unknown command frobnicate/u],
    [["next-free-key", "--partition", "cross"], /unknown flag --partition/u],
    [["next-free-key", "--chain"], /flag --chain needs a value/u],
    [["next-free-key", "--kind", "min"], /--chain is required/u],
    [["next-free-key", "--chain", "cross"], /--kind is required/u],
    [["next-free-key", "--chain", "cross", "--kind", "epic"], /unknown --kind epic/u],
    [["key-taken", "--chain", "cross", "--kind", "min"], /--key is required for key-taken/u],
    [["next-free-key", "--chain", "cross", "--kind", "min", "--key", "TCRN-CROSS-MIN-001"],
      /--key is not meaningful for next-free-key/u]
  ];
  for (const [argv, expected] of cases) {
    const error = thrown(() => parseArgs(argv));
    assert.ok(error, `${argv.join(" ")} was accepted`);
    assert.equal(error.constructor.name, "UsageError", `${argv.join(" ")} was not a usage error`);
    assert.match(error.message, expected);
  }
});

test("the usage text lists the kinds the tool actually carries", () => {
  const usage = thrown(() => parseArgs(["--help"])).message;
  for (const kind of Object.keys(KINDS)) assert.match(usage, new RegExp(`[<|]${kind}[|>]`, "u"));
});

// ---------------------------------------------------------------------------
// Topology resolution
// ---------------------------------------------------------------------------

const rosterEntry = (over = {}) => ({
  partitionId: "cross-project",
  externalKey: "TCRN-CROSS-WORKSPACE",
  home: "vm",
  liveAddress: "/srv/tcrn/governance/tcrn-workspace/cross-project/workspace",
  ...over
});

const partitionOfFixture = (workspace) => () => ({ workspace });

test("resolveChain reads the real topology for a known alias", () => {
  const resolved = resolveChain("cross");
  assert.equal(resolved.partitionId, "cross-project");
  assert.equal(resolved.keyPrefix, "TCRN-CROSS");
  // The address is not asserted as a literal here: this file states no topology of its
  // own, and doc-topology:proof is what holds the address itself down.
  assert.equal(typeof resolved.workspace, "string");
  assert.ok(resolved.workspace.length > 0);
});

test("resolveChain refuses an alias it does not know", () => {
  const error = thrown(() => resolveChain("nope"));
  assert.equal(error.constructor.name, "UsageError");
  assert.match(error.message, /unknown --chain nope/u);
});

test("resolveChain refuses a partition missing from the roster", () => {
  const error = thrown(() => resolveChain("cross", {
    roster: [rosterEntry({ partitionId: "TCRN-AOS", externalKey: "TCRN-AOS-WORKSPACE" })],
    partitionOf: partitionOfFixture("/srv/tcrn/governance/tcrn-workspace/cross-project/workspace")
  }));
  assert.match(error.message, /cross-project is not in PARTITION_ROSTER/u);
});

test("resolveChain refuses when the two topology files disagree", () => {
  const error = thrown(() => resolveChain("cross", {
    roster: [rosterEntry()],
    partitionOf: partitionOfFixture("/srv/tcrn/governance/tcrn-workspace/cross-project/OTHER")
  }));
  assert.match(error.message, /topology disagreement for cross-project/u);
  assert.match(error.message, /OTHER/u, "the refusal shows both addresses, not just one");
});

test("resolveChain refuses a partition whose home is not the VM", () => {
  const address = "/srv/tcrn/governance/tcrn-workspace/cross-project/workspace";
  const error = thrown(() => resolveChain("cross", {
    roster: [rosterEntry({ home: "local" })],
    partitionOf: partitionOfFixture(address)
  }));
  assert.match(error.message, /home=local; this tool reads the VM engine only/u);
});

test("resolveChain refuses a workspace key it cannot turn into a prefix", () => {
  const address = "/srv/tcrn/governance/tcrn-workspace/cross-project/workspace";
  const error = thrown(() => resolveChain("cross", {
    roster: [rosterEntry({ externalKey: "TCRN-CROSS-CHAIN" })],
    partitionOf: partitionOfFixture(address)
  }));
  assert.match(error.message, /cannot derive a key prefix/u);
});

test("resolveChain derives the prefix from the roster, never a hand-typed one", () => {
  const address = "/srv/tcrn/governance/tcrn-workspace/cross-project/workspace";
  const resolved = resolveChain("cross", {
    roster: [rosterEntry({ externalKey: "SOMETHING-ELSE-WORKSPACE" })],
    partitionOf: partitionOfFixture(address)
  });
  assert.equal(resolved.keyPrefix, "SOMETHING-ELSE");
});

// ---------------------------------------------------------------------------
// Structural claims the file makes about itself
// ---------------------------------------------------------------------------

test("every kind's source is a verb the read-only allowlist carries", () => {
  for (const [kind, { source }] of Object.entries(KINDS)) {
    assert.ok(READ_ONLY_VERBS.includes(source), `${kind} reads through unlisted verb ${source}`);
  }
});

test("every kind has a legal namespace and a distinct token", () => {
  const tokens = new Set();
  for (const [kind, { namespace, token }] of Object.entries(KINDS)) {
    assert.match(namespace, /^[a-z][a-z0-9-]{1,31}$/u, `${kind} namespace is not derivable`);
    assert.match(token, /^[A-Z0-9]+$/u, `${kind} token is not key-shaped`);
    assert.ok(!tokens.has(token), `token ${token} is claimed by two kinds`);
    tokens.add(token);
  }
});

test("a verb outside the allowlist is refused before any connection is opened", async () => {
  await assert.rejects(
    readAllRecords("status", "/srv/tcrn/governance/tcrn-workspace/cross-project/workspace"),
    /verb status is not in this tool's read-only set/u);
  await assert.rejects(
    readAllRecords("work-create", "/srv/tcrn/governance/tcrn-workspace/cross-project/workspace"),
    /verb work-create is not in this tool's read-only set/u);
});

// ---------------------------------------------------------------------------
// Derivation fallback
// ---------------------------------------------------------------------------

test("loadDerivation falls back to the local mirror and still checks the vector", async () => {
  const { derive, source } = await loadDerivation("/nonexistent/engine/protocol/index.js");
  assert.equal(source, "local-mirror");
  // A fixed vector measured against the live cross chain: TCRN-CROSS-MIN-053 is the key
  // whose id the chain carries. It is a pure function of the derivation, so it stays true
  // however many keys are allocated, and it can only move if the protocol primitive moved.
  assert.equal(derive("minutes", "TCRN-CROSS-MIN-053"), "minutes:ff33f3598f6ed51dbd33b0ee");
  assert.equal(derive("conference", "TCRN-CROSS-CONF-050"), "conference:52581fc31af5fb17ffc828f4");
  // Case folding is part of the derivation, not a nicety.
  assert.equal(derive("minutes", "tcrn-cross-min-053"), derive("minutes", "TCRN-CROSS-MIN-053"));
});

test("the local mirror refuses keys the engine's validator would refuse", async () => {
  const { derive } = await loadDerivation("/nonexistent/engine/protocol/index.js");
  assert.throws(() => derive("minutes", "TCRN_CROSS_MIN_053"), /not a legal key/u);
  assert.throws(() => derive("minutes", "-LEADING-DASH"), /not a legal key/u);
  assert.throws(() => derive("minutes", "TCRN--CROSS-MIN-053"), /not a legal key/u);
  // A space fails one step earlier: the printable-ASCII gate runs before the key shape.
  assert.throws(() => derive("minutes", "TCRN CROSS MIN 053"), /not printable ASCII/u);
  assert.throws(() => derive("minutes", "TCRN-CROSS-MIN-é"), /not printable ASCII/u);
  assert.throws(() => derive("Minutes", "TCRN-CROSS-MIN-053"), /not a legal namespace/u);
});

test("loadDerivation refuses to read a chain when the derivation drifted", async () => {
  // The vector's whole job is to go red here. A build that exports a deriveStableId
  // answering anything else must stop the tool, because every occupancy answer it could
  // give would be about ids nothing on any chain uses.
  const { mkdtempSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "key-occupancy-drift-"));
  const build = join(dir, "index.js");
  writeFileSync(build, "export const deriveStableId = (ns, key) => `${ns}:deadbeef`;\n");
  await assert.rejects(loadDerivation(build), /derivation drift/u);

  const noExport = join(dir, "no-export.js");
  writeFileSync(noExport, "export const somethingElse = 1;\n");
  await assert.rejects(loadDerivation(noExport), /exports no deriveStableId/u);
});
