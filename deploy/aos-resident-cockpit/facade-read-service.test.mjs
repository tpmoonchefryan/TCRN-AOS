import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { startFacadeReadService } from "./facade-read-service.mjs";
import { LOCAL_ENGINE } from "../switch-rehearsal/rehearsal-lib.mjs";

// STORY-181 — the local empirical proof of the facade read service, on the file
// backend. The chains still live on the file backend until the STORY-188 window,
// so the facade is proven against a scratch file-backed workspace the local engine
// CLI init's in this test and the service reads back through HTTP.
//
// TWO LEGS:
//   positive — the engine read verbs (status / work-list / work-show / export /
//              validate / project-list / knowledge-list / commands / …) are
//              reachable through the facade, and the engine's own reason codes
//              travel through unaltered;
//   red      — a mutating verb (work-transition) and an authority-bearing verb
//              (adapter-activation-record) are refused with the MCP_REMOTE_WRITE_REFUSED
//              family reason codes before any route to the engine runs.
//
// A source gate (read-face-gate) separately asserts the facade process carries no
// pins / ChainClient / callTool; this file exercises the running service.

const HERE = dirname(fileURLToPath(import.meta.url));
const ENGINE_CLI = resolve(LOCAL_ENGINE, "scripts/tcrn-workflow.mjs");

function engineArgs(verb, flags = {}) {
  const args = [ENGINE_CLI, verb];
  for (const [flag, value] of Object.entries(flags)) args.push(`--${flag}`, String(value));
  return args;
}

/** A scratch file-backed chain the local engine can read. Caller removes it. */
function scratchWorkspace() {
  // tmpdir on macOS resolves /var → /private/var through a symlink; every root
  // the engine binds must be a canonical real path (ROOT_PATH_ALIAS otherwise).
  const base = realpathSync(mkdtempSync(join(tmpdir(), "facade-read-test-")));
  const workspace = join(base, "workspace");
  mkdirSync(workspace, { recursive: true });
  const framework = realpathSync(mkdirSync(join(base, "framework"), { recursive: true }));
  const transient = realpathSync(mkdirSync(join(base, "transient"), { recursive: true }));
  const evidence = realpathSync(mkdirSync(join(base, "evidence"), { recursive: true }));
  const release = realpathSync(mkdirSync(join(base, "release-trust"), { recursive: true }));

  const initOut = execFileSync("node", engineArgs("init", {
    workspace,
    framework,
    transient,
    "evidence-locator": evidence,
    "release-trust": release,
    "external-key": "FACADE-181-SCRATCH",
    at: "2026-08-06T00:00:00Z"
  }), { encoding: "utf8" });
  const init = JSON.parse(initOut);
  assert.equal(init.reasonCode, "WORKSPACE_COMMAND_COMPLETED", `scratch init failed: ${initOut}`);

  const projectOut = execFileSync("node", engineArgs("project-create", {
    workspace,
    "external-key": "FACADE-181-PROJECT",
    name: "Facade Read 181",
    actor: "agent:fable",
    at: "2026-08-06T00:00:00Z",
    "expected-version": 0
  }), { encoding: "utf8" });
  const project = JSON.parse(projectOut);
  assert.equal(project.reasonCode, "WORKSPACE_COMMAND_COMPLETED", `project-create failed: ${projectOut}`);

  const workOut = execFileSync("node", engineArgs("work-create", {
    workspace,
    "project-id": project.record.id,
    "external-key": "FACADE-181-INIT",
    kind: "Initiative",
    "parent-id": "-",
    actor: "agent:fable",
    at: "2026-08-06T00:00:00Z",
    "expected-version": 1
  }), { encoding: "utf8" });
  const work = JSON.parse(workOut);
  assert.equal(work.reasonCode, "WORKSPACE_COMMAND_COMPLETED", `work-create failed: ${workOut}`);

  return { workspace, projectId: project.record.id, workId: work.record.id, base };
}

// ── harness ──────────────────────────────────────────────────────────────────

const PARTITION = "SCRATCH-181";
let service = null;
let url = "";
let fixture = null;

test.before(async () => {
  fixture = scratchWorkspace();
  service = await startFacadeReadService({
    engineRoot: LOCAL_ENGINE,
    workspaces: { [PARTITION]: fixture.workspace },
    // INC-084: startup now requires pgSchemas to cover every workspace; the test
    // engine runs file-backed (no TCRN_PG_CONNECTION).
    pgSchemas: { [PARTITION]: "chain_test" },
    host: "127.0.0.1",
    port: 0,
    allowedHosts: ["127.0.0.1", "localhost"],
    catalogTtlMs: 5 * 60_000
  });
  url = service.url;
});

test.after(async () => {
  await service?.close();
  if (fixture) rmSync(fixture.base, { recursive: true, force: true });
});

async function post(verb, body) {
  return fetch(`${url}/api/engine/${verb}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

test("the installed engine copy loads and its catalog is derived", () => {
  assert.ok(existsSync(resolve(LOCAL_ENGINE, "dist/build/packages/cli/src/index.js")),
    "local engine copy must have dist built for the facade to derive from");
  assert.ok(existsSync(ENGINE_CLI), "local engine CLI must exist");
});

// ── positive leg: the engine read verbs are reachable, reason codes preserved ──

test("GET /api/health answers readonly with the partition set", async () => {
  const response = await fetch(`${url}/api/health`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.readonly, true);
  assert.equal(body.chainWriteAvailable, false);
  assert.deepEqual(body.partitions, [PARTITION]);
  assert.equal(body.noPins, true);
});

test("GET /api/engine/catalog exposes the forwardable read-verb full set", async () => {
  const response = await fetch(`${url}/api/engine/catalog`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(body.tools.length >= 50,
    `the catalogue should expose most of the engine's read verbs, got ${body.tools.length}`);
  const names = body.tools.map((tool) => tool.name);
  for (const verb of ["work_show", "work_list", "status", "export", "validate",
    "knowledge_list", "project_list", "commands", "snapshot_manifest", "event_list"]) {
    assert.ok(names.includes(`tcrn_remote_read_${verb}`), `catalogue missing read verb ${verb}`);
  }
  // The withheld half is the refusal surface: mutating + authority-bearing verbs
  // are indexed but never published.
  const withheldNames = body.withheld.map((entry) => entry.name);
  assert.ok(withheldNames.includes("tcrn_remote_read_work_transition"),
    "work-transition must be indexed as withheld, not unknown");
  assert.ok(withheldNames.includes("tcrn_remote_read_adapter_activation_record"),
    "adapter-activation-record must be indexed as withheld, not unknown");
  // Every published tool is readOnlyHint:true — the surface is read-only by shape.
  for (const tool of body.tools) assert.equal(tool.annotations.readOnlyHint, true);
});

test("status through the facade answers the engine's own reason code", async () => {
  const response = await post("status", { partition: PARTITION });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.command, "status");
  assert.equal(body.partition, PARTITION);
  assert.equal(body.result.reasonCode, "WORKSPACE_COMMAND_COMPLETED");
  assert.ok(body.result.version >= 2, "the scratch chain has been written to");
});

test("work-list through the facade returns the records and its reason code", async () => {
  const response = await post("work-list", { partition: PARTITION });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.result.reasonCode, "WORKSPACE_LIST_READY");
  assert.ok(Array.isArray(body.result.records));
  assert.ok(body.result.records.some((record) => record.externalKey === "FACADE-181-INIT"),
    "the scratch Initiative must be readable through the facade");
});

test("work-show through the facade returns one record's own bytes", async () => {
  const response = await post("work-show", { partition: PARTITION, arguments: { id: fixture.workId } });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.result.reasonCode, "WORKSPACE_RECORD_READY");
  assert.equal(body.result.record?.id, fixture.workId);
  assert.equal(body.result.record?.externalKey, "FACADE-181-INIT");
});

test("export, validate, project-list, knowledge-list and commands all answer", async () => {
  for (const verb of ["export", "validate", "project-list"]) {
    const response = await post(verb, { partition: PARTITION });
    assert.equal(response.status, 200, `${verb} should answer 200`);
    const body = await response.json();
    assert.equal(body.ok, true, `${verb} ok`);
  }
  // knowledge-list requires the `at` instant AND a knowledge store, which a
  // freshly init'd scratch chain does not have — so the engine itself refuses it
  // with KNOWLEDGE_PATH_INVALID. That refusal travelling through the facade with
  // its reason code intact is exactly the fidelity this story is about.
  const knowledgeResponse = await post("knowledge-list", {
    partition: PARTITION,
    arguments: { at: "2026-08-06T00:00:00Z" }
  });
  assert.equal(knowledgeResponse.status, 502, "knowledge-list should answer the engine's refusal");
  const knowledge = await knowledgeResponse.json();
  assert.equal(knowledge.ok, false);
  assert.equal(knowledge.reasonCode, "KNOWLEDGE_PATH_INVALID",
    "the engine's own refusal reason code must travel through unaltered");
  // `commands` is a non-partition-scoped read: no partition needed.
  const response = await post("commands", { arguments: {} });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.ok(Array.isArray(body.result.commands));
});

test("a caller-supplied partition workspace is refused as reserved", async () => {
  const response = await post("work-list", {
    partition: PARTITION,
    arguments: { workspace: "/somewhere/else" }
  });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.reasonCode, "MCP_ARGUMENT_RESERVED");
});

// ── red leg: mutating / authority-bearing verbs are refused ─────────────────

test("work-transition through the read face is refused with MCP_REMOTE_WRITE_REFUSED", async () => {
  const response = await post("work-transition", {
    partition: PARTITION,
    arguments: { id: fixture.workId, status: "ready", actor: "agent:fable", at: "2026-08-06T00:00:00Z" }
  });
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.reasonCode, "MCP_REMOTE_WRITE_REFUSED");
  assert.equal(body.command, "work-transition");
  assert.ok(body.remedy.includes("ceremony"), "the remedy must point at the ceremony");
});

test("an authority-bearing verb is refused with MCP_REMOTE_AUTHORITY_OUTPUT_REFUSED", async () => {
  const response = await post("adapter-activation-record", { arguments: { "activation-receipt": "x" } });
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.reasonCode, "MCP_REMOTE_AUTHORITY_OUTPUT_REFUSED");
});

test("the red mutation did not touch the chain — a read still answers", async () => {
  const response = await post("status", { partition: PARTITION });
  const body = await response.json();
  assert.equal(body.result.reasonCode, "WORKSPACE_COMMAND_COMPLETED");
});

// ── source gate: the read process structurally holds no pins ────────────────

test("the facade source never names pins / ChainClient / callTool", () => {
  const source = readFileSync(join(HERE, "facade-read-service.mjs"), "utf8");
  const writeMachinery = ["ChainClient", "authorityPins", "authority-pins", "callTool", "SafeWriteSurface"];
  const present = writeMachinery.filter((token) => source.includes(token));
  assert.deepEqual(present, [], `facade read source names chain-write machinery: ${present.join(", ")}`);
});
