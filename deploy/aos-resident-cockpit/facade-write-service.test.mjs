// STORY-182 — red/green proof of the facade WRITE service, on the file backend.
//
// The chains live on the file backend until the STORY-188 window, so the write
// face is proven against a scratch file-backed workspace the local engine CLI
// seeds in this test and the service writes to through HTTP.
//
// TWO LEGS:
//   positive — ONE governed write performed through the facade alone (a ceremony
//              payload of steps plus a read-back), the receipt carrying a full-value
//              read-back verdict, and the chain genuinely advanced;
//   red      — the ceremony-plan refusal surface, all named: a payload with no
//              read-back (PAYLOAD_INVALID), reserved flags in a payload
//              (RESERVED_FLAG_IN_PAYLOAD), a step verb absent from the catalogue
//              (VERB_NOT_IN_CATALOGUE), the one-shot authority family
//              (VERB_REQUIRES_OUT_OF_BAND_AUTHORITY), a read verb in a step
//              (FACADE_WRITE_VERB_NOT_MUTATING), a divergent read-back
//              (READBACK_DIVERGENT), a read-back that compared nothing
//              (READBACK_NOTHING_COMPARED), and a ceremony that THREW still
//              leaving a receipt (CEREMONY_THREW_BEFORE_RECEIPT, INC-047).
//
// The expected-version semantics (chain head for chain verbs, store marker for the
// knowledge-* family) are proven at the unit level — casSource and
// readKnowledgeMarker — plus the live-head supply in the positive leg (a step that
// names expected-version itself is refused).

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { startFacadeWriteService } from "./facade-write-service.mjs";
import { LOCAL_ENGINE } from "../switch-rehearsal/rehearsal-lib.mjs";
import {
  writeWithheldGround, isForwardableWrite, casSource, readKnowledgeMarker,
  assertNoReadExposedOnWrite, FACADE_WRITE_SERVER_NAME
} from "./facade-write-service.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ENGINE_CLI = resolve(LOCAL_ENGINE, "scripts/tcrn-workflow.mjs");

function engineArgs(verb, flags = {}) {
  const args = [ENGINE_CLI, verb];
  for (const [flag, value] of Object.entries(flags)) args.push(`--${flag}`, String(value));
  return args;
}

/** A scratch file-backed chain the local engine can seed and the facade can write to. */
function scratchWorkspace() {
  const base = realpathSync(mkdtempSync(join(tmpdir(), "facade-write-test-")));
  const workspace = join(base, "workspace");
  mkdirSync(workspace, { recursive: true });
  const framework = realpathSync(mkdirSync(join(base, "framework"), { recursive: true }));
  const transient = realpathSync(mkdirSync(join(base, "transient"), { recursive: true }));
  const evidence = realpathSync(mkdirSync(join(base, "evidence"), { recursive: true }));
  const release = realpathSync(mkdirSync(join(base, "release-trust"), { recursive: true }));
  const attestDir = realpathSync(mkdirSync(join(base, "attestations"), { recursive: true }));

  const initOut = execFileSync("node", engineArgs("init", {
    workspace,
    framework,
    transient,
    "evidence-locator": evidence,
    "release-trust": release,
    "external-key": "FACADE-182-SCRATCH",
    at: "2026-08-06T00:00:00Z"
  }), { encoding: "utf8" });
  const init = JSON.parse(initOut);
  assert.equal(init.reasonCode, "WORKSPACE_COMMAND_COMPLETED", `scratch init failed: ${initOut}`);

  const projectOut = execFileSync("node", engineArgs("project-create", {
    workspace,
    "external-key": "FACADE-182-PROJECT",
    name: "Facade Write 182",
    actor: "agent:fable",
    at: "2026-08-06T00:00:00Z",
    "expected-version": 0
  }), { encoding: "utf8" });
  const project = JSON.parse(projectOut);
  assert.equal(project.reasonCode, "WORKSPACE_COMMAND_COMPLETED", `project-create failed: ${projectOut}`);

  const workOut = execFileSync("node", engineArgs("work-create", {
    workspace,
    "project-id": project.record.id,
    "external-key": "FACADE-182-INIT",
    kind: "Initiative",
    "parent-id": "-",
    actor: "agent:fable",
    at: "2026-08-06T00:00:00Z",
    "expected-version": 1
  }), { encoding: "utf8" });
  const work = JSON.parse(workOut);
  assert.equal(work.reasonCode, "WORKSPACE_COMMAND_COMPLETED", `work-create failed: ${workOut}`);

  return { workspace, projectId: project.record.id, workId: work.record.id, base, attestDir };
}

// ── harness ──────────────────────────────────────────────────────────────────

const PARTITION = "SCRATCH-182";
const BROKEN = "BROKEN-182";
const SCOPE_TEXT = "facade-write full-value proof";
let service = null;
let url = "";
let fixture = null;
let writeRoot = null;

function validPayload() {
  return {
    schemaVersion: "aos.local-client-ceremony.v1",
    story: "TCRN-AOS-STORY-182",
    intent: "one governed write through the facade, read back full-value",
    steps: [{ verb: "work-annotate", flags: { id: fixture.workId, scope: SCOPE_TEXT } }],
    readback: [{
      verb: "work-show",
      flags: { id: fixture.workId },
      recordFields: ["externalKey", "kind", "status", "scope"],
      expect: { externalKey: "FACADE-182-INIT", kind: "Initiative", status: "planned" },
      expectSameAs: [{ field: "scope", step: 0, flag: "scope" }]
    }]
  };
}

test.before(async () => {
  fixture = scratchWorkspace();
  writeRoot = mkdtempSync(join(tmpdir(), "facade-write-root-"));
  service = await startFacadeWriteService({
    engineRoot: LOCAL_ENGINE,
    workspaces: { [PARTITION]: fixture.workspace, [BROKEN]: join(fixture.base, "does-not-exist") },
    attestDirs: { [PARTITION]: fixture.attestDir, [BROKEN]: join(fixture.base, "does-not-exist-attest") },
    // INC-084: startup now requires pgSchemas to cover every workspace. The test
    // engine runs file-backed (no TCRN_PG_CONNECTION, so the PG path is not
    // taken), but the keyset must be stated.
    pgSchemas: { [PARTITION]: "chain_test", [BROKEN]: "chain_broken" },
    host: "127.0.0.1",
    port: 0,
    allowedHosts: ["127.0.0.1", "localhost"],
    catalogTtlMs: 5 * 60_000,
    writeRoot,
    actor: "agent:fable"
  });
  url = service.url;
});

test.after(async () => {
  await service?.close();
  if (fixture) rmSync(fixture.base, { recursive: true, force: true });
  if (writeRoot) rmSync(writeRoot, { recursive: true, force: true });
});

async function postCeremony(body) {
  return fetch(`${url}/api/ceremony`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

function receiptFiles(dir) {
  const full = join(writeRoot, dir);
  if (!existsSync(full)) return [];
  return readdirSync(full).filter((name) => name.endsWith(".json"));
}

// ── the derivation (pure functions, no network) ──────────────────────────────

test("casSource: knowledge verbs CAS on the store marker, chain verbs on the chain head", () => {
  for (const verb of ["knowledge-create", "knowledge-promote", "knowledge-retire", "knowledge-rebase", "knowledge-reverify"]) {
    assert.equal(casSource(verb), "marker", `${verb} must CAS on the store marker`);
  }
  for (const verb of ["work-annotate", "work-create", "work-transition", "project-create", "conference-close"]) {
    assert.equal(casSource(verb), "chain", `${verb} must CAS on the chain head`);
  }
});

test("readKnowledgeMarker reads the store marker version directly, unrelated to the chain", async () => {
  const base = realpathSync(mkdtempSync(join(tmpdir(), "facade-write-marker-")));
  const store = join(base, ".tcrn-workflow", "knowledge");
  mkdirSync(store, { recursive: true });
  writeFileSync(join(store, "store.json"), JSON.stringify({
    version: 7, workspaceId: "ws-182", eventHighWaterDigest: "abc123"
  }));
  const marker = await readKnowledgeMarker(base);
  assert.equal(marker.version, 7);
  assert.equal(marker.workspaceId, "ws-182");
  assert.equal(marker.eventHighWaterDigest, "abc123");
  rmSync(base, { recursive: true, force: true });
});

test("writeWithheldGround names each ground: read, authority-output, one-shot, fixture", () => {
  const read = { name: "work-show", mutates: false, flags: [{ name: "id", required: true }] };
  assert.equal(writeWithheldGround(read).reasonCode, "FACADE_WRITE_VERB_NOT_MUTATING");
  assert.equal(isForwardableWrite(read), false);

  const authorityOutput = { name: "adapter-activation-record", mutates: false, authorityBearing: true, flags: [] };
  assert.equal(writeWithheldGround(authorityOutput).reasonCode, "FACADE_WRITE_AUTHORITY_OUTPUT");

  const oneShot = {
    name: "relocation-vacate", mutates: true,
    flags: [{ name: "workspace", required: true }, { name: "relocation-authority-digest", required: true }]
  };
  assert.equal(writeWithheldGround(oneShot).reasonCode, "FACADE_WRITE_VERB_REQUIRES_OUT_OF_BAND_AUTHORITY");

  const fixtureOnly = { name: "artifact-archive-apply", mutates: true, availability: "fixture-only", flags: [] };
  assert.equal(writeWithheldGround(fixtureOnly).reasonCode, "FACADE_WRITE_FIXTURE_ONLY");

  const write = { name: "work-annotate", mutates: true, flags: [] };
  assert.equal(writeWithheldGround(write), null);
  assert.equal(isForwardableWrite(write), true);
});

test("assertNoReadExposedOnWrite refuses a verb the engine's own descriptor marks a read", () => {
  const annotations = new Map([["work-annotate", { readOnlyHint: false }], ["status", { readOnlyHint: true }]]);
  assert.doesNotThrow(() => assertNoReadExposedOnWrite(
    [{ name: "work-annotate", mutates: true }], annotations));
  assert.throws(() => assertNoReadExposedOnWrite(
    [{ name: "status", mutates: true }], annotations),
  (error) => error.reasonCode === "FACADE_WRITE_EXPOSURE_INVARIANT");
});

// ── positive leg: one governed write through the facade, read back full-value ──

test("health answers a WRITE face: not readonly, chain write available, no pins", async () => {
  const response = await fetch(`${url}/api/health`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.service, FACADE_WRITE_SERVER_NAME);
  assert.equal(body.readonly, false);
  assert.equal(body.chainWriteAvailable, true);
  assert.equal(body.noPins, true);
  assert.deepEqual(body.partitions, [PARTITION, BROKEN]);
});

test("the catalogue exposes the write whitelist and withholds the rest with named grounds", async () => {
  const response = await fetch(`${url}/api/engine/catalog`);
  assert.equal(response.status, 200);
  const body = await response.json();
  for (const verb of ["work-annotate", "work-create", "work-transition", "project-create", "knowledge-create", "init"]) {
    assert.ok(body.forwardable.includes(verb), `write whitelist missing ${verb}`);
  }
  const withheld = new Map(body.withheld.map((entry) => [entry.name, entry.reasonCode]));
  assert.equal(withheld.get("work-show"), "FACADE_WRITE_VERB_NOT_MUTATING");
  assert.equal(withheld.get("status"), "FACADE_WRITE_VERB_NOT_MUTATING");
  assert.equal(withheld.get("adapter-activation-record"), "FACADE_WRITE_AUTHORITY_OUTPUT");
  assert.equal(withheld.get("relocation-vacate"), "FACADE_WRITE_VERB_REQUIRES_OUT_OF_BAND_AUTHORITY");
  assert.equal(withheld.get("artifact-archive-apply"), "FACADE_WRITE_FIXTURE_ONLY");
});

test("POSITIVE LEG: one governed write through the facade alone, receipt with a full-value read-back", async () => {
  const receiptsBefore = receiptFiles("receipts").length;
  const response = await postCeremony({ payload: validPayload(), partition: PARTITION });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.reasonCode, "CEREMONY_COMPLETED_AND_READ_BACK");
  assert.equal(body.dryRun, false);
  assert.equal(body.partition, PARTITION);

  const receipt = body.receipt;
  assert.equal(receipt.schemaVersion, "aos.facade-write-receipt.v1");
  // The expected-version was supplied by the SERVICE from a live head read; the
  // payload never named it. The step recorded the head it CAS'd against.
  assert.equal(receipt.steps.length, 1);
  assert.equal(receipt.steps[0].verb, "work-annotate");
  assert.equal(receipt.steps[0].accepted, true);
  assert.equal(receipt.steps[0].headAtPlanning, receipt.chainBefore.version);
  assert.equal(receipt.steps[0].autoSupplied.includes("expected-version"), true);

  // Full-value read-back: every field the ceremony claimed to set was compared and
  // matched — NOTHING_COMPARED is not a comparison.
  const verdict = receipt.readback[0].verdict;
  assert.equal(verdict.reasonCode, "READBACK_MATCHES_FULL_VALUE");
  assert.equal(verdict.ok, true);
  assert.ok(verdict.compared.length >= 4, `expected >= 4 compared fields, got ${verdict.compared.length}`);
  assert.equal(receipt.readback[0].record.scope, SCOPE_TEXT);
  assert.equal(receipt.readback[0].record.externalKey, "FACADE-182-INIT");

  // The chain genuinely advanced by the one annotate event.
  assert.equal(receipt.eventsAppended, 1);
  assert.equal(receipt.chainAfter.version - receipt.chainBefore.version, 1);

  // STORY-160 best-effort rebase: no knowledge store on this scratch chain, so it
  // is recorded as unreadable rather than silently skipped or silently failing.
  assert.equal(receipt.knowledgeRebase.reasonCode, "MARKER_UNREADABLE");

  // Receipt materialised, scrubbed of the host's scratch path.
  assert.ok(typeof body.receiptPath === "string" && body.receiptPath.startsWith("receipts/"));
  assert.equal(receiptFiles("receipts").length, receiptsBefore + 1);
  const materialised = JSON.parse(readFileSync(join(writeRoot, body.receiptPath), "utf8"));
  assert.equal(materialised.ok, true);
  assert.equal(materialised.reasonCode, "CEREMONY_COMPLETED_AND_READ_BACK");
  assert.ok(!JSON.stringify(materialised).includes(fixture.base),
    "the materialised receipt must not carry the host's scratch path");

  // The engine's own bytes, read independently, confirm the write really landed.
  const showOut = execFileSync("node", engineArgs("work-show", { workspace: fixture.workspace, id: fixture.workId }), { encoding: "utf8" });
  const show = JSON.parse(showOut);
  assert.equal(show.reasonCode, "WORKSPACE_RECORD_READY");
  assert.equal(show.advisory?.scope, SCOPE_TEXT, "the annotate must have reached the chain");
});

test("a dry-run ceremony plans everything, sends nothing, and does not advance the chain", async () => {
  const response = await postCeremony({ payload: validPayload(), dryRun: true, partition: PARTITION });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.reasonCode, "CEREMONY_PLANNED_ONLY");
  assert.equal(body.dryRun, true);
  assert.equal(body.receipt.steps[0].executed, false);
  assert.ok(typeof body.receipt.steps[0].wouldSend === "string");
  assert.equal(body.receipt.readback[0].executed, false);
  assert.equal(body.receipt.chainAfter.version, body.receipt.chainBefore.version,
    "a dry run must not advance the chain");
});

// ── red leg: the ceremony-plan refusal surface, all named ────────────────────

test("a payload with no read-back is refused whole: PAYLOAD_INVALID", async () => {
  const response = await postCeremony({ payload: { ...validPayload(), readback: [] }, partition: PARTITION });
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.equal(body.reasonCode, "PAYLOAD_INVALID");
  assert.ok(body.receipt.problems.some((problem) => problem.includes("readback")));
});

test("a payload naming expected-version in a step is refused: RESERVED_FLAG_IN_PAYLOAD", async () => {
  const payload = validPayload();
  payload.steps[0].flags["expected-version"] = 42;
  const response = await postCeremony({ payload, partition: PARTITION });
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.reasonCode, "RESERVED_FLAG_IN_PAYLOAD");
});

test("a payload naming attest-dir is refused: RESERVED_FLAG_IN_PAYLOAD", async () => {
  const payload = validPayload();
  payload.steps[0].flags["attest-dir"] = "/somewhere/else";
  const response = await postCeremony({ payload, partition: PARTITION });
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.reasonCode, "RESERVED_FLAG_IN_PAYLOAD");
});

test("a step verb absent from the host catalogue is refused: VERB_NOT_IN_CATALOGUE", async () => {
  const payload = validPayload();
  payload.steps[0].verb = "no-such-verb";
  const response = await postCeremony({ payload, partition: PARTITION });
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.reasonCode, "VERB_NOT_IN_CATALOGUE");
});

test("the one-shot authority family in a step is refused: VERB_REQUIRES_OUT_OF_BAND_AUTHORITY", async () => {
  const payload = validPayload();
  payload.steps = [{ verb: "relocation-vacate", flags: {} }];
  const response = await postCeremony({ payload, partition: PARTITION });
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.reasonCode, "VERB_REQUIRES_OUT_OF_BAND_AUTHORITY");
});

test("a read verb in a step is refused on the write face: FACADE_WRITE_VERB_NOT_MUTATING", async () => {
  const payload = validPayload();
  payload.steps = [{ verb: "work-show", flags: { id: fixture.workId } }];
  const response = await postCeremony({ payload, partition: PARTITION });
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.reasonCode, "FACADE_WRITE_VERB_NOT_MUTATING");
});

test("a divergent read-back is a refusal: READBACK_DIVERGENT", async () => {
  const payload = validPayload();
  // A distinct scope so this annotate is a real change (an annotate equal to the
  // stored value can be refused by the engine as changing nothing, STORY-132).
  payload.steps[0].flags.scope = "divergent-scope";
  payload.readback[0].expect = { externalKey: "FACADE-182-WRONG" };
  const response = await postCeremony({ payload, partition: PARTITION });
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.reasonCode, "READBACK_DIVERGENT");
  assert.equal(body.receipt.readback[0].verdict.ok, false);
});

test("a read-back that compared nothing is a refusal, not a pass: READBACK_NOTHING_COMPARED", async () => {
  const payload = validPayload();
  payload.steps[0].flags.scope = "nothing-compared-scope";
  payload.readback[0].expect = {};
  payload.readback[0].expectSameAs = [];
  const response = await postCeremony({ payload, partition: PARTITION });
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.reasonCode, "READBACK_NOTHING_COMPARED");
});

test("an unknown partition is refused: MCP_PARTITION_UNKNOWN", async () => {
  const response = await postCeremony({ payload: validPayload(), partition: "no-such-partition" });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.reasonCode, "MCP_PARTITION_UNKNOWN");
});

// ── INC-047: a ceremony that THROWS must still leave a receipt ───────────────

test("a ceremony that throws still materialises a failure receipt (INC-047)", async () => {
  const receiptsBefore = receiptFiles("receipts").length;
  // BROKEN-182's workspace does not exist, so the service's live head read throws
  // before any step is planned — the whole ceremony must leave a receipt.
  const response = await postCeremony({ payload: validPayload(), partition: BROKEN });
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.equal(body.reasonCode, "CEREMONY_THREW_BEFORE_RECEIPT");
  assert.equal(body.receipt.thrownBeforeReceipt, true);
  assert.equal(receiptFiles("receipts").length, receiptsBefore + 1, "a thrown ceremony must write exactly one failure receipt");
  const materialised = JSON.parse(readFileSync(join(writeRoot, body.receiptPath), "utf8"));
  assert.equal(materialised.thrownBeforeReceipt, true);
  assert.equal(materialised.reasonCode, "CEREMONY_THREW_BEFORE_RECEIPT");
});

// ── source gate: the write face itself performs no chain write ───────────────

test("the write face source names no chain-write machinery; only the engine CLI is driven", () => {
  const source = readFileSync(join(HERE, "facade-write-service.mjs"), "utf8");
  const chainWriteMachinery = ["ChainClient", "authorityPins", "authority-pins", "callTool", "SafeWriteSurface"];
  const present = chainWriteMachinery.filter((token) => source.includes(token));
  assert.deepEqual(present, [], `facade write source names chain-write machinery: ${present.join(", ")}`);
});

// ── INC-084 red legs: a misconfigured facade refuses to start ───────────────

test("INC-084 REDS: startup refuses when pgSchemas does not cover every workspace", async () => {
  await assert.rejects(
    () => startFacadeWriteService({
      engineRoot: LOCAL_ENGINE,
      workspaces: { [PARTITION]: fixture.workspace, [BROKEN]: join(fixture.base, "does-not-exist") },
      attestDirs: { [PARTITION]: fixture.attestDir, [BROKEN]: join(fixture.base, "does-not-exist-attest") },
      // pgSchemas deliberately omitted / partial → must refuse to start
      pgSchemas: { [PARTITION]: "chain_test" },
      host: "127.0.0.1",
      port: 0,
      writeRoot,
      actor: "agent:fable"
    }),
    /no PG schema/u,
  );
  await assert.rejects(
    () => startFacadeWriteService({
      engineRoot: LOCAL_ENGINE,
      workspaces: { [PARTITION]: fixture.workspace },
      attestDirs: { [PARTITION]: fixture.attestDir },
      pgSchemas: undefined,
      host: "127.0.0.1",
      port: 0,
      writeRoot,
      actor: "agent:fable"
    }),
    /no pgSchemas/u,
  );
});

test("INC-084 REDS: startup refuses a non-loopback bind", async () => {
  await assert.rejects(
    () => startFacadeWriteService({
      engineRoot: LOCAL_ENGINE,
      workspaces: { [PARTITION]: fixture.workspace },
      attestDirs: { [PARTITION]: fixture.attestDir },
      pgSchemas: { [PARTITION]: "chain_test" },
      host: "0.0.0.0", // not loopback
      port: 0,
      writeRoot,
      actor: "agent:fable"
    }),
    /loopback/u,
  );
});
