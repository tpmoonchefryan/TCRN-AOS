import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  AUTHORITY_OUTPUT_REFUSED, EXPOSURE_INVARIANT, EXPOSURE_UNPROVEN, FIXTURE_ONLY_REFUSED,
  HOST_CATALOG_TTL_MS, MAX_IN_FLIGHT, PARTITION_ARGUMENT, RESERVED_FLAGS, RemoteReadDispatcher,
  SERVER_NAME, TOOL_PREFIX, WRITE_REFUSED, assertHostAgrees, assertNoArguments,
  assertNoWriteExposed, buildCatalog, engineAnnotationIndex, hostCatalogCacheAge, isForwardableRead,
  isPartitionScoped, loadInstalledCatalog, remoteArgv, resetHostCatalog, runRemoteReadMcpStdio,
  sshFailureText, toolDescriptor, toolName, withheldGround
} from "./remote-read-mcp.mjs";
import { AOS_PARTITIONS } from "./aos-partitions.mjs";
import { LOCAL_ENGINE } from "../switch-rehearsal/rehearsal-lib.mjs";

// The judgement half of the remote read face (TCRN-CROSS-STORY-132). No SSH, no VM, no
// network: every remote-facing assertion here is made against a literal or against the
// engine copy installed on this machine.
//
// The discipline this file is written to (MEMORY: 判据两侧必须能够不同) is that no
// assertion may stand alone. For every green there is a red that differs from it in one
// named field. The file exists because the first delivery of remote-read-mcp.mjs shipped
// 675 lines of governance boundary with no checked-in test at all, and because its
// headline safety assertion — "nothing withheld reaches the published tool list" — was
// filtering by a predicate and then asserting the negation of the same predicate, which
// can never go red.
//
// TWO HALVES, AND THE SECOND ONE NEEDS THE INSTALLED ENGINE. The parity assertions
// compare this face's descriptors against the engine's own `workflowMcpTools()`. When
// the engine copy cannot be loaded, this file FAILS rather than skips: a parity gate that
// silently reports nothing is the exact shape of "I observed nothing" spelled the same
// way as "there is nothing wrong". Point TCRN_AOS_ENGINE_ROOT at an engine root if the
// default (~/.tcrn-workflow/tcrn-workflow) is not where yours lives.

const HERE = fileURLToPath(new URL(".", import.meta.url));
const SOURCE = readFileSync(resolve(HERE, "remote-read-mcp.mjs"), "utf8");

let engine = null;
let engineLoadError = null;
try {
  const loaded = await loadInstalledCatalog();
  const mcp = await import(pathToFileURL(
    resolve(LOCAL_ENGINE, "dist/build/packages/cli/src/mcp.js")).href);
  engine = {
    loaded,
    catalog: buildCatalog(loaded),
    tools: new Map(mcp.workflowMcpTools().map((tool) => [tool.name, tool])),
    prefix: mcp.WORKFLOW_MCP_TOOL_PREFIX
  };
} catch (error) {
  engineLoadError = error;
}

const engineOrFail = () => {
  if (engine === null) {
    assert.fail("the installed engine copy could not be loaded, so the parity half of this file "
      + `observed nothing: ${String(engineLoadError?.message ?? engineLoadError)}`);
  }
  return engine;
};

/** The engine's own tool name for a command — its prefix, not this face's. */
const engineToolName = (command) => `${engineOrFail().prefix}${command.replaceAll("-", "_")}`;

/** A catalogue entry shaped like COMMAND_CATALOG's, with only the fields the face reads. */
const entryOf = (overrides) => ({ name: "work-show", flags: [], ...overrides });

/** An annotation index that says "this verb is a read", for a synthetic catalogue. */
const readAnnotations = (...names) =>
  new Map(names.map((name) => [name, { readOnlyHint: true, destructiveHint: false }]));

test("the installed engine copy loads — without it nothing below about parity means anything", () => {
  assert.equal(engineLoadError, null,
    `loadInstalledCatalog/workflowMcpTools failed: ${String(engineLoadError?.message ?? engineLoadError)}`);
  assert.ok(engine.loaded.commands.length > 0);
  assert.equal(engine.loaded.engineAnnotations.size, engine.loaded.commands.length);
});

// ---------------------------------------------------------------------------
// (a) flag-schema parity with the engine's own descriptors
// ---------------------------------------------------------------------------

test("every published tool's properties equal the engine's, minus the topology-owned flags", () => {
  const { catalog } = engineOrFail();
  let compared = 0;
  for (const entry of catalog.forwardable) {
    const mine = toolDescriptor(entry);
    const theirs = engineOrFail().tools.get(engineToolName(entry.name));
    assert.ok(theirs !== undefined,
      `${entry.name} is published here but absent from the engine's own MCP surface`);

    const mineProperties = { ...mine.inputSchema.properties };
    // `partition` is this face's addition and has no engine counterpart: it is the
    // caller-facing name for the two flags the topology owns.
    delete mineProperties[PARTITION_ARGUMENT];
    const theirProperties = { ...theirs.inputSchema.properties };
    for (const reserved of RESERVED_FLAGS) delete theirProperties[reserved];

    assert.deepEqual(mineProperties, theirProperties,
      `flag schema drift on ${entry.name}: a caller that learned this argument shape from the `
      + "local engine facade would meet a second shape here");
    compared += Object.keys(theirProperties).length;
  }
  // A scope floor. `compared === 0` would satisfy every assertion above while proving
  // nothing, and a loop over an empty list is the cheapest possible false green.
  assert.ok(compared >= 100,
    `parity was asserted over only ${compared} flags; that is too few to be the real catalogue`);
});

test("the required list is the engine's required list, plus partition exactly when scoped", () => {
  const { catalog } = engineOrFail();
  const scoped = catalog.forwardable.filter(isPartitionScoped);
  const unscoped = catalog.forwardable.filter((entry) => !isPartitionScoped(entry));
  assert.ok(scoped.length > 0 && unscoped.length > 0,
    "both sides must be populated or the assertion below only tests one of them");

  for (const entry of scoped) {
    const descriptor = toolDescriptor(entry);
    assert.ok(descriptor.inputSchema.required.includes(PARTITION_ARGUMENT), entry.name);
    assert.deepEqual(descriptor.inputSchema.properties[PARTITION_ARGUMENT].enum,
      Object.keys(AOS_PARTITIONS),
      "the partition enum is the roster, imported — never a hand-typed list");
  }
  for (const entry of unscoped) {
    const descriptor = toolDescriptor(entry);
    assert.ok(!descriptor.inputSchema.required.includes(PARTITION_ARGUMENT), entry.name);
    assert.ok(!Object.hasOwn(descriptor.inputSchema.properties, PARTITION_ARGUMENT), entry.name);
  }
});

test("no published tool carries a topology-owned flag in its caller-facing schema", () => {
  for (const entry of engineOrFail().catalog.forwardable) {
    const properties = toolDescriptor(entry).inputSchema.properties;
    for (const reserved of RESERVED_FLAGS) {
      assert.ok(!Object.hasOwn(properties, reserved),
        `${entry.name} exposes ${reserved} to the caller; that value belongs to the topology`);
    }
  }
});

test("this face's tool prefix is its own, so no call can be ambiguous about which host answered", () => {
  assert.notEqual(TOOL_PREFIX, engineOrFail().prefix);
  assert.equal(toolName("work-show"), `${TOOL_PREFIX}work_show`);
  assert.equal(SERVER_NAME, "tcrn-workflow-remote-read");
});

// ---------------------------------------------------------------------------
// (b) the published/withheld partition of the real catalogue
// ---------------------------------------------------------------------------

test("published ∩ {mutates | authorityBearing | fixture-only | authority-digest} is empty", () => {
  const { catalog } = engineOrFail();
  for (const entry of catalog.forwardable) {
    assert.notEqual(entry.mutates, true, entry.name);
    assert.notEqual(entry.authorityBearing, true, entry.name);
    assert.notEqual(entry.availability, "fixture-only", entry.name);
    assert.ok(!(entry.flags ?? []).some((flag) =>
      flag.required === true && String(flag.name).endsWith("-authority-digest")), entry.name);
  }
  assert.ok(catalog.forwardable.length > 0, "an empty published set would satisfy the loop above");
  // The other side: the withheld half is non-empty and every member of it has a ground.
  assert.ok(catalog.withheld.length > 0);
  for (const entry of catalog.withheld) assert.notEqual(withheldGround(entry), null, entry.name);
});

test("published + withheld accounts for the whole catalogue, with nothing counted twice", () => {
  const { catalog, loaded } = engineOrFail();
  assert.equal(catalog.forwardable.length + catalog.withheld.length, loaded.commands.length);
  assert.equal(catalog.byTool.size, loaded.commands.length);
  assert.equal(catalog.tools.length, catalog.forwardable.length);
  const names = new Set([...catalog.forwardable, ...catalog.withheld].map((entry) => entry.name));
  assert.equal(names.size, loaded.commands.length);
});

test("every withheld verb is still indexed, so a caller gets a refusal and not 'unknown tool'", () => {
  const { catalog } = engineOrFail();
  for (const entry of catalog.withheld) {
    assert.ok(catalog.byTool.has(toolName(entry.name)), entry.name);
  }
  // ...and none of them is published.
  const publishedNames = new Set(catalog.tools.map((tool) => tool.name));
  for (const entry of catalog.withheld) {
    assert.ok(!publishedNames.has(toolName(entry.name)), entry.name);
  }
});

// ---------------------------------------------------------------------------
// (c) the exposure invariant, proved red
// ---------------------------------------------------------------------------

test("buildCatalog goes RED when the local predicate publishes what the engine calls destructive", () => {
  // This is the failure the invariant exists for, reached without touching the source:
  // the entry carries no `mutates` field, so isForwardableRead publishes it, while the
  // engine's own descriptor for the same command says destructiveHint:true.
  const commands = [entryOf({ name: "work-transition" })];
  assert.equal(isForwardableRead(commands[0]), true, "the producing side must want to publish it");

  assert.throws(
    () => buildCatalog({
      commands,
      engineAnnotations: new Map([["work-transition", { readOnlyHint: false, destructiveHint: true }]])
    }),
    (error) => error.reasonCode === EXPOSURE_INVARIANT
      && /work-transition/u.test(error.message)
      && /destructiveHint:true/u.test(error.message));
});

test("the same catalogue is GREEN when the engine's descriptor calls it a read — one field apart", () => {
  const commands = [entryOf({ name: "work-transition" })];
  const built = buildCatalog({
    commands,
    engineAnnotations: new Map([["work-transition", { readOnlyHint: true, destructiveHint: false }]])
  });
  assert.equal(built.tools.length, 1);
  assert.equal(built.withheld.length, 0);
});

test("readOnlyHint:false alone is enough — destructiveHint is not the only side asserted", () => {
  assert.throws(
    () => buildCatalog({
      commands: [entryOf({ name: "adapter-activation-record" })],
      engineAnnotations: new Map([
        ["adapter-activation-record", { readOnlyHint: false, destructiveHint: false }]
      ])
    }),
    (error) => error.reasonCode === EXPOSURE_INVARIANT && /readOnlyHint:true/u.test(error.message));
});

test("a verb the engine's MCP surface withholds entirely is refused, not silently published", () => {
  // `null` is what engineAnnotationIndex records for fixture-only and one-shot-authority
  // verbs: the engine builds no descriptor for them at all.
  assert.throws(
    () => buildCatalog({
      commands: [entryOf({ name: "profile-authorize" })],
      engineAnnotations: new Map([["profile-authorize", null]])
    }),
    (error) => error.reasonCode === EXPOSURE_INVARIANT && /withholds it/u.test(error.message));
  // And when the engine has never heard of the verb at all.
  assert.throws(
    () => buildCatalog({ commands: [entryOf({ name: "invented-verb" })], engineAnnotations: readAnnotations("work-show") }),
    (error) => error.reasonCode === EXPOSURE_INVARIANT && /does not define it/u.test(error.message));
});

test("the invariant refuses to answer at all when it was given nothing to answer from", () => {
  const commands = [entryOf({ name: "work-show" })];
  for (const engineAnnotations of [undefined, null, new Map(), [], "no"]) {
    assert.throws(
      () => buildCatalog({ commands, engineAnnotations }),
      (error) => error.reasonCode === EXPOSURE_UNPROVEN,
      `an absent index (${String(engineAnnotations)}) must not read as a satisfied invariant`);
  }
  // The neighbouring green differs in exactly one thing: the index is populated.
  assert.equal(buildCatalog({ commands, engineAnnotations: readAnnotations("work-show") }).tools.length, 1);
});

test("assertNoWriteExposed does not consult withheldGround — the two sides must be able to differ", () => {
  const body = SOURCE.slice(SOURCE.indexOf("export function assertNoWriteExposed"));
  const end = body.indexOf("\n}\n");
  assert.ok(end > 0);
  assert.ok(!/withheldGround|isForwardableRead/u.test(body.slice(0, end)),
    "the exposure invariant re-entered its own producer's predicate; filter by P then assert "
    + "not-P is empty is a gate that cannot go red");
});

test("engineAnnotationIndex distinguishes 'engine withholds it' from 'engine never heard of it'", () => {
  const commands = [entryOf({ name: "work-show" }), entryOf({ name: "work-transition" })];
  const tools = [{ name: "wf_work_show", annotations: { readOnlyHint: true, destructiveHint: false } }];
  const index = engineAnnotationIndex(commands, tools, "wf_");
  assert.deepEqual(index.get("work-show"), { readOnlyHint: true, destructiveHint: false });
  assert.equal(index.get("work-transition"), null);
  assert.equal(index.has("work-transition"), true);
  assert.equal(index.has("never-existed"), false);
});

test("the real installed catalogue passes the invariant, and 60-odd verbs is the scope floor", () => {
  const { catalog } = engineOrFail();
  assert.doesNotThrow(() => assertNoWriteExposed(catalog.forwardable, engine.loaded.engineAnnotations));
  assert.ok(catalog.forwardable.length >= 40,
    `only ${catalog.forwardable.length} verbs were checked; a near-empty published set would pass `
    + "every assertion in this file while proving nothing");
});

// ---------------------------------------------------------------------------
// (d) argument handling
// ---------------------------------------------------------------------------

test("a partition-scoped verb refuses a caller-named workspace and takes it from the roster", () => {
  const workShow = engineOrFail().loaded.commands.find((entry) => entry.name === "work-show");
  assert.ok(isPartitionScoped(workShow));

  assert.throws(
    () => remoteArgv(workShow, { partition: "TCRN-AOS", id: "work:1", workspace: "/tmp/mine" }),
    (error) => error.reasonCode === "MCP_ARGUMENT_RESERVED");
  // work-show declares `workspace` and NOT `attest-dir`, so naming attest-dir here is not
  // a reserved value — it is a flag this verb does not have, and the answer says so.
  assert.throws(
    () => remoteArgv(workShow, { partition: "TCRN-AOS", id: "work:1", "attest-dir": "/tmp/mine" }),
    (error) => error.reasonCode === "MCP_ARGUMENT_UNKNOWN" && error.message === "attest-dir");

  const plan = remoteArgv(workShow, { partition: "TCRN-AOS", id: "work:1" });
  assert.equal(plan.partition, "TCRN-AOS");
  assert.equal(plan.workspace, AOS_PARTITIONS["TCRN-AOS"].workspace);
  assert.deepEqual(plan.argv,
    ["work-show", "--workspace", AOS_PARTITIONS["TCRN-AOS"].workspace, "--id", "work:1"]);
});

test("attest-dir is reserved on a verb that DECLARES it, and is filled from the roster", () => {
  // No verb published today declares attest-dir — every one that does is a write. The
  // derivation still has to hold for the day a later engine ships a read that reads a
  // sidecar, which is exactly why isPartitionScoped is derived and not a list of names.
  const sidecarRead = entryOf({
    name: "attestation-show",
    flags: [
      { name: "workspace", required: true, valueKind: "string" },
      { name: "attest-dir", required: true, valueKind: "string" },
      { name: "id", required: true, valueKind: "string" }
    ]
  });
  assert.equal(isPartitionScoped(sidecarRead), true);
  assert.throws(() => remoteArgv(sidecarRead, { partition: "TCRN-AOS", id: "x", "attest-dir": "/tmp/mine" }),
    (error) => error.reasonCode === "MCP_ARGUMENT_RESERVED" && /attest-dir/u.test(error.message));

  const plan = remoteArgv(sidecarRead, { partition: "TCRN-AOS", id: "x" });
  assert.deepEqual(plan.argv, [
    "attestation-show",
    "--workspace", AOS_PARTITIONS["TCRN-AOS"].workspace,
    "--attest-dir", AOS_PARTITIONS["TCRN-AOS"].attestDir,
    "--id", "x"
  ]);
});

test("an UNSCOPED verb answers MCP_ARGUMENT_UNKNOWN for workspace, not a remedy it cannot follow", () => {
  const snapshotVerify = engineOrFail().loaded.commands.find((entry) => entry.name === "snapshot-verify");
  assert.equal(isPartitionScoped(snapshotVerify), false);
  // Its descriptor exposes no `partition` property and its schema is additionalProperties:
  // false, so "name partition instead" would have been unsatisfiable advice.
  assert.ok(!Object.hasOwn(toolDescriptor(snapshotVerify).inputSchema.properties, PARTITION_ARGUMENT));

  assert.throws(
    () => remoteArgv(snapshotVerify, { root: "/a", manifest: "/b", workspace: "/tmp/mine" }),
    (error) => error.reasonCode === "MCP_ARGUMENT_UNKNOWN" && error.message === "workspace");

  assert.deepEqual(remoteArgv(snapshotVerify, { root: "/a", manifest: "/b" }).argv,
    ["snapshot-verify", "--root", "/a", "--manifest", "/b"]);
});

test("a missing partition, an unknown partition and a missing required flag are each named", () => {
  const workShow = engineOrFail().loaded.commands.find((entry) => entry.name === "work-show");
  assert.throws(() => remoteArgv(workShow, { id: "work:1" }),
    (error) => error.reasonCode === "MCP_ARGUMENT_MISSING" && error.message === PARTITION_ARGUMENT);
  assert.throws(() => remoteArgv(workShow, { partition: "Nowhere", id: "work:1" }),
    (error) => error.reasonCode === "MCP_PARTITION_UNKNOWN");
  assert.throws(() => remoteArgv(workShow, { partition: "TCRN-AOS" }),
    (error) => error.reasonCode === "MCP_ARGUMENT_MISSING" && error.message === "id");
});

test("a list value carrying an ASCII comma is refused rather than silently split", () => {
  const listEntry = entryOf({
    name: "probe",
    flags: [{ name: "tags", required: false, valueKind: "list" }]
  });
  assert.deepEqual(remoteArgv(listEntry, { tags: ["a", "b"] }).argv, ["probe", "--tags", "a,b"]);
  assert.throws(() => remoteArgv(listEntry, { tags: ["a,b"] }),
    (error) => error.reasonCode === "MCP_ARGUMENT_INVALID" && error.message === "tags");
});

test("the server takes no arguments at all, which is what keeps it unable to hold pins", () => {
  assert.deepEqual(assertNoArguments([]), []);
  assert.throws(() => assertNoArguments(["--authority-pins", "/x"]),
    (error) => error.reasonCode === "MCP_REMOTE_ARGUMENT_UNKNOWN");
});

// ---------------------------------------------------------------------------
// (e) the host's own answer
// ---------------------------------------------------------------------------

test("assertHostAgrees refuses an absent verb and a verb the HOST calls a write", () => {
  const entry = entryOf({ name: "work-show" });
  assert.throws(() => assertHostAgrees(entry, undefined),
    (error) => error.reasonCode === "MCP_REMOTE_VERB_ABSENT");
  assert.throws(() => assertHostAgrees(entry, { name: "work-show", mutates: true }),
    (error) => error.reasonCode === WRITE_REFUSED);
  assert.throws(() => assertHostAgrees(entry, { name: "work-show", authorityBearing: true }),
    (error) => error.reasonCode === AUTHORITY_OUTPUT_REFUSED);
  assert.throws(() => assertHostAgrees(entry, { name: "work-show", availability: "fixture-only" }),
    (error) => error.reasonCode === FIXTURE_ONLY_REFUSED);
  // The green differs from the first red in exactly one field: the host entry exists and
  // its own catalogue calls it a read.
  const agreed = { name: "work-show", mutates: false, availability: "cli", flags: [] };
  assert.equal(assertHostAgrees(entry, agreed), agreed);
});

test("the host catalogue is cached with a stated bound, not for the process lifetime", () => {
  resetHostCatalog();
  assert.equal(hostCatalogCacheAge(), null, "reset must actually clear it");
  assert.ok(HOST_CATALOG_TTL_MS > 0 && HOST_CATALOG_TTL_MS <= 300_000,
    "an unbounded or effectively unbounded cache is an index with no freshness precondition");
  assert.match(SOURCE, /now - hostCatalogEntry\.fetchedAt < HOST_CATALOG_TTL_MS/u,
    "the cache must be compared against the bound, not merely declare one");
});

// ---------------------------------------------------------------------------
// refusal classification: three grounds, three reason codes, three remedies
// ---------------------------------------------------------------------------

test("each withheld ground carries its OWN reason code and its own remedy", () => {
  const write = withheldGround({ name: "work-transition", mutates: true });
  assert.equal(write.reasonCode, WRITE_REFUSED);
  assert.match(write.remedy, /ceremony\.mjs/u);

  const authorityOut = withheldGround({ name: "adapter-activation-record", authorityBearing: true });
  assert.equal(authorityOut.reasonCode, AUTHORITY_OUTPUT_REFUSED);
  assert.match(authorityOut.remedy, /out of band/u);
  assert.match(authorityOut.remedy, /Neither this read face nor/u,
    "the authority family must NOT be redirected to ceremony.mjs, which refuses it too");

  const authorityIn = withheldGround({
    name: "profile-authorize",
    flags: [{ name: "receipt-authority-digest", required: true, valueKind: "string" }]
  });
  assert.equal(authorityIn.reasonCode, AUTHORITY_OUTPUT_REFUSED);

  const fixture = withheldGround({ name: "some-fixture-verb", availability: "fixture-only" });
  assert.equal(fixture.reasonCode, FIXTURE_ONLY_REFUSED);
  assert.match(fixture.remedy, /fixture/u);

  assert.equal(withheldGround({ name: "work-show", mutates: false, availability: "cli" }), null);

  const codes = new Set([write, authorityOut, fixture].map((ground) => ground.reasonCode));
  assert.equal(codes.size, 3, "three grounds collapsing into one code is the defect this replaced");
});

test("the real authority-bearing verb is classified as authority, not as a write", async () => {
  const { loaded } = engineOrFail();
  const entry = loaded.commands.find((command) => command.name === "adapter-activation-record");
  assert.equal(entry.mutates, false, "the premise: it is not a write");
  assert.equal(withheldGround(entry).reasonCode, AUTHORITY_OUTPUT_REFUSED);

  // End to end through the dispatcher, with no SSH: #callTool refuses on the installed
  // catalogue before it builds any argv or asks the host.
  const dispatcher = new RemoteReadDispatcher(buildCatalog(loaded));
  await dispatcher.dispatch({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
  const answer = await dispatcher.dispatch({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: toolName("adapter-activation-record"), arguments: { "activation-receipt": "/x" } }
  });
  assert.equal(answer.result.isError, true);
  assert.equal(answer.result.structuredContent.reasonCode, AUTHORITY_OUTPUT_REFUSED);
  assert.ok(!/as a payload of steps/u.test(answer.result.structuredContent.error),
    "the caller must not be sent to the batch ceremony for a one-shot authority verb");
});

test("a mutating verb IS sent to the ceremony, and says so", async () => {
  const { loaded } = engineOrFail();
  const dispatcher = new RemoteReadDispatcher(buildCatalog(loaded));
  await dispatcher.dispatch({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
  const answer = await dispatcher.dispatch({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: toolName("work-transition"), arguments: {} }
  });
  assert.equal(answer.result.structuredContent.reasonCode, WRITE_REFUSED);
  assert.match(answer.result.structuredContent.error, /ceremony\.mjs/u);
});

test("initialize's instructions state the bounded refresh rather than 'before each call'", async () => {
  const dispatcher = new RemoteReadDispatcher({ byTool: new Map(), tools: [], frameworkVersion: null });
  const answer = await dispatcher.dispatch({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
  const instructions = answer.result.instructions;
  assert.match(instructions, /refreshed at most every \d+s/u);
  assert.ok(!/before each call/u.test(instructions),
    "the prose was a stronger claim than the code; that is the defect, not the cache");
});

// ---------------------------------------------------------------------------
// transport mirroring
// ---------------------------------------------------------------------------

test("asRecord rejects a value that is not Object.prototype-rooted, as the engine's record() does", async () => {
  const dispatcher = new RemoteReadDispatcher({ byTool: new Map(), tools: [], frameworkVersion: null });
  const exotic = Object.create(null);
  exotic.jsonrpc = "2.0";
  exotic.id = 1;
  exotic.method = "ping";
  await assert.rejects(() => dispatcher.dispatch(exotic),
    (error) => error.reasonCode === "MCP_INVALID_REQUEST");
  await assert.rejects(() => dispatcher.dispatch([]),
    (error) => error.reasonCode === "MCP_INVALID_REQUEST");
  await assert.rejects(() => dispatcher.dispatch(null),
    (error) => error.reasonCode === "MCP_INVALID_REQUEST");
  // The green differs in exactly one thing: the prototype.
  await dispatcher.dispatch({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
  const ok = await dispatcher.dispatch({ jsonrpc: "2.0", id: 2, method: "ping" });
  assert.deepEqual(ok, { jsonrpc: "2.0", id: 2, result: {} });
});

test("a request before initialize is refused, and the refusal lifts afterwards", async () => {
  const dispatcher = new RemoteReadDispatcher({ byTool: new Map(), tools: [], frameworkVersion: null });
  const early = await dispatcher.dispatch({ jsonrpc: "2.0", id: 1, method: "tools/list" });
  assert.equal(early.error.code, -32002);
  await dispatcher.dispatch({ jsonrpc: "2.0", id: 2, method: "initialize", params: {} });
  const late = await dispatcher.dispatch({ jsonrpc: "2.0", id: 3, method: "tools/list" });
  assert.deepEqual(late.result, { tools: [] });
});

test("sshFailureText always carries text — a spawn failure's message IS the whole answer", () => {
  assert.equal(sshFailureText({ stderr: "remote refused\n", stdout: "x", message: "y" }), "remote refused");
  assert.equal(sshFailureText({ stderr: "  ", stdout: "partial json", message: "y" }), "partial json");
  // The case the first draft dropped on the floor: no stderr, no stdout, only a message.
  const enoent = Object.assign(new Error("spawn ssh ENOENT"), { code: "ENOENT", stderr: "", stdout: "" });
  assert.equal(sshFailureText(enoent), "spawn ssh ENOENT");
  assert.notEqual(sshFailureText(enoent), "", "an empty diagnosis is the defect this closes");
});

// ---------------------------------------------------------------------------
// the read loop: one slow SSH call must not hold the session
// ---------------------------------------------------------------------------

/** Drives the stdio loop over a list of requests with an injected dispatcher. */
async function driveLoop(requests, dispatch) {
  const written = [];
  const output = { write: (chunk) => { written.push(chunk); return true; } };
  const payload = `${requests.map((request) => JSON.stringify(request)).join("\n")}\n`;
  async function* input() {
    yield payload;
  }
  await runRemoteReadMcpStdio(input(), output, { byTool: new Map(), tools: [] }, { dispatch });
  return written.map((line) => JSON.parse(line));
}

test("a fast request queued behind a slow one is answered first", async () => {
  const answers = await driveLoop(
    [
      { jsonrpc: "2.0", id: "slow", method: "tools/call", params: { name: "x" } },
      { jsonrpc: "2.0", id: "fast", method: "ping" }
    ],
    async (request) => {
      if (request.id === "slow") await new Promise((done) => setTimeout(done, 80));
      return { jsonrpc: "2.0", id: request.id, result: {} };
    });
  assert.deepEqual(answers.map((answer) => answer.id), ["fast", "slow"],
    "under the previous inline `await dispatcher.dispatch(...)` this is ['slow','fast'], and a "
    + "two-minute SSH bound in that position outlives a client's keepalive");
  assert.equal(answers.length, 2, "the loop must still drain everything before returning");
});

test("concurrency is bounded — the limiter is asserted from both sides", async () => {
  let live = 0;
  let peak = 0;
  const requests = Array.from({ length: MAX_IN_FLIGHT + 4 },
    (unused, index) => ({ jsonrpc: "2.0", id: index, method: "tools/call", params: { name: "x" } }));
  const answers = await driveLoop(requests, async (request) => {
    live += 1;
    peak = Math.max(peak, live);
    await new Promise((done) => setTimeout(done, 20));
    live -= 1;
    return { jsonrpc: "2.0", id: request.id, result: {} };
  });
  assert.equal(answers.length, requests.length);
  assert.ok(peak > 1, `dispatch was serialised (peak ${peak}); that is the defect, not the fix`);
  assert.ok(peak <= MAX_IN_FLIGHT,
    `${peak} concurrent SSH round trips exceeded the ${MAX_IN_FLIGHT} limiter`);
});

test("a notification produces no line, and a malformed line does not stop the loop", async () => {
  const written = [];
  const output = { write: (chunk) => { written.push(chunk); return true; } };
  async function* input() {
    yield `${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`;
    yield "{not json\n";
    yield `${JSON.stringify({ jsonrpc: "2.0", id: 7, method: "ping" })}\n`;
  }
  await runRemoteReadMcpStdio(input(), output, { byTool: new Map(), tools: [] },
    { dispatch: async (request) => (request.id === undefined ? null : { jsonrpc: "2.0", id: request.id, result: {} }) });
  const answers = written.map((line) => JSON.parse(line));
  assert.equal(answers.length, 2);
  assert.equal(answers[0].error.code, -32700);
  assert.equal(answers[1].id, 7);
});

test("a rejected dispatch becomes a JSON-RPC error line, not an unhandled rejection", async () => {
  const answers = await driveLoop(
    [{ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "x" } }],
    async () => {
      const error = new Error("boom");
      error.reasonCode = "MCP_REMOTE_READ_TIMEOUT";
      throw error;
    });
  assert.equal(answers.length, 1);
  assert.equal(answers[0].error.code, -32600);
  assert.equal(answers[0].error.data.reasonCode, "MCP_REMOTE_READ_TIMEOUT");
});

// ---------------------------------------------------------------------------
// topology is imported, never typed
// ---------------------------------------------------------------------------

test("no host, workspace path or partition name is hand-typed in this face", () => {
  const body = SOURCE.slice(SOURCE.indexOf("import { execFile }"));
  assert.ok(!/tcrn-platform-dev/u.test(body),
    "the host name belongs to topology.mjs and must be imported");
  assert.ok(!/\/srv\/tcrn\//u.test(body),
    "a VM path belongs to topology.mjs or aos-partitions.mjs and must be imported");
  assert.match(SOURCE, /from "\.\/topology\.mjs"/u);
  assert.match(SOURCE, /from "\.\/aos-partitions\.mjs"/u);
  assert.match(SOURCE, /shellQuote/u,
    "ssh re-joins its remote argv with spaces; a naive join breaks on any quoted argument");
  assert.match(SOURCE, /scrubHostPathsInText/u,
    "an MCP transcript is routinely pasted into a receipt; local host paths may not ride along");
});

// The header asserts a fact about a file OUTSIDE this repository (.mcp.json at the
// platform root), which is exactly the kind of claim that goes stale silently: nothing
// in this tree changes when that file does. Registration happened on 2026-08-04, and the
// header was rewritten in the same change — this case pins the CURRENT fact so the next
// drift is a red test rather than a paragraph nobody re-read.
test("the header states the registration as it actually stands, naming the entry", () => {
  const header = SOURCE.slice(0, SOURCE.indexOf("import { execFile }"));
  assert.match(header, /REGISTERED/u);
  assert.match(header, /tcrn-workflow-aos-read/u,
    "the header must name the entry a reader can go and look for");
  assert.match(header, /\.mcp\.json/u);
  assert.doesNotMatch(header, /NOT REGISTERED WITH ANY CLIENT YET/u,
    "the pre-registration wording must not survive the registration");
  // The boundary the registration had to respect, kept in the same breath as the claim.
  assert.match(header, /authority-pins|--authority-pins|pinned write grant/u,
    "the header must still say that the pins-bearing entry was left alone");
});
