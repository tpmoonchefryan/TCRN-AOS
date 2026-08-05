// TCRN-CROSS-INIT-019 STORY-156.5 — red/green tests for the single ceremony write face.
//
// Two layers, and each is tested where it can honestly be tested:
//   * the DECISION logic (reserved flags, verb-in-catalogue, one-shot authority
//     family, no-read-back payload) is ceremony-plan.mjs's own pure functions, run
//     here against a FAKE catalogue — no SSH, no host, the same refusal codes a
//     live ceremony would produce;
//   * the DISPATCHER plumbing (argument validation, materialisation, receipt
//     wrapping) is run through a CeremonyDispatcher with an injected executor and
//     a throwaway write root, so a tool call is exercised end-to-end without
//     touching a chain.
// The live red-side demonstration (four refusals against the real host, via an MCP
// client) is STORY-156.3's 生效证据, run by hand against the host; these tests keep
// the harness green offline.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { assertPayload, catalogueIndex, planStep } from "../aos-local-client/ceremony-plan.mjs";
import { CeremonyDispatcher, TOOL_NAME } from "./server.mjs";

const VALID_PAYLOAD = {
  schemaVersion: "aos.local-client-ceremony.v1",
  story: "TCRN-CROSS-INIT-019-STORY-156",
  intent: "test payload",
  steps: [{ verb: "work-annotate", flags: { id: "work:x", scope: "x" } }],
  readback: [{ verb: "work-show", flags: { id: "work:x" }, expect: { scope: "x" } }]
};

// A fake host catalogue: work-annotate and work-show are ordinary verbs;
// adapter-activation-record carries a required *-authority-digest flag (the shape
// ceremony-plan.mjs derives the one-shot family from).
const fakeCommands = [
  {
    name: "work-annotate", mutates: true,
    flags: [
      { name: "id", required: true },
      { name: "scope", required: false },
      { name: "workspace", required: true },
      { name: "attest-dir", required: false },
      { name: "actor", required: false },
      { name: "at", required: false },
      { name: "expected-version", required: false }
    ]
  },
  {
    name: "work-show", mutates: false,
    flags: [{ name: "id", required: true }, { name: "workspace", required: true }]
  },
  {
    name: "relocation-vacate", mutates: true,
    flags: [{ name: "workspace", required: true }, { name: "relocation-authority", required: true }, { name: "relocation-authority-digest", required: true }]
  }
];

const catalogue = catalogueIndex(fakeCommands);
const supply = { workspace: "/srv/tcrn/t", attestDir: "/srv/tcrn/a", actor: "agent:fable" };

// ── the decision logic (real pure functions, fake catalogue) ─────────────────

test("a payload naming expected-version in a step is refused: RESERVED_FLAG_IN_PAYLOAD", () => {
  const step = { verb: "work-annotate", flags: { id: "work:x", "expected-version": 42 } };
  const plan = planStep({ step, catalogue, supply, chainVersion: 7, at: "2026-08-05T00:00:00Z" });
  assert.equal(plan.ok, false);
  assert.equal(plan.reasonCode, "RESERVED_FLAG_IN_PAYLOAD");
});

test("a verb absent from the host catalogue is refused: VERB_NOT_IN_CATALOGUE", () => {
  const plan = planStep({
    step: { verb: "no-such-verb", flags: {} }, catalogue, supply, chainVersion: 7, at: "2026-08-05T00:00:00Z"
  });
  assert.equal(plan.ok, false);
  assert.equal(plan.reasonCode, "VERB_NOT_IN_CATALOGUE");
});

test("the one-shot authority family is refused: VERB_REQUIRES_OUT_OF_BAND_AUTHORITY", () => {
  const plan = planStep({
    step: { verb: "relocation-vacate", flags: {} },
    catalogue, supply, chainVersion: 7, at: "2026-08-05T00:00:00Z"
  });
  assert.equal(plan.ok, false);
  assert.equal(plan.reasonCode, "VERB_REQUIRES_OUT_OF_BAND_AUTHORITY");
});

test("a payload with no read-back is refused whole: PAYLOAD_INVALID", () => {
  const refused = assertPayload({ ...VALID_PAYLOAD, readback: [] });
  assert.equal(refused.ok, false);
  assert.equal(refused.reasonCode, "PAYLOAD_INVALID");
  assert.ok(refused.problems.some((problem) => problem.includes("readback")));
});

test("a payload naming attest-dir is refused, not silently merged", () => {
  const step = { verb: "work-annotate", flags: { id: "work:x", "attest-dir": "/somewhere" } };
  const plan = planStep({ step, catalogue, supply, chainVersion: 7, at: "2026-08-05T00:00:00Z" });
  assert.equal(plan.reasonCode, "RESERVED_FLAG_IN_PAYLOAD");
});

// ── the dispatcher plumbing (injected executor, throwaway write root) ────────

function makeDispatcher({ perform } = {}) {
  const root = mkdtempSync(join(tmpdir(), "aos-mcp-write-test-"));
  const dispatcher = new CeremonyDispatcher(
    perform ?? (async () => ({ ok: true, reasonCode: "CEREMONY_PLANNED_ONLY", chainBefore: { version: 1 }, chainAfter: { version: 2 } })),
    { writeRoot: root }
  );
  return { dispatcher, root };
}

async function initDispatcher(dispatcher) {
  await dispatcher.dispatch({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0.0.0" } }
  });
}

async function callTool(dispatcher, input, name = TOOL_NAME) {
  await initDispatcher(dispatcher);
  const response = await dispatcher.dispatch({
    jsonrpc: "2.0",
    id: "call-1",
    method: "tools/call",
    params: { name, arguments: input }
  });
  assert.equal(response.error, undefined);
  return response.result;
}

test("tools/list exposes exactly the single ceremony tool, marked as a write", async () => {
  const { dispatcher, root } = makeDispatcher();
  await initDispatcher(dispatcher);
  const response = await dispatcher.dispatch({ jsonrpc: "2.0", id: 1, method: "tools/list" });
  const tools = response.result.tools;
  assert.equal(tools.length, 1);
  assert.equal(tools[0].name, TOOL_NAME);
  assert.equal(tools[0].annotations.readOnlyHint, false);
  rmSync(root, { recursive: true, force: true });
});

test("an unknown partition is refused: MCP_PARTITION_UNKNOWN", async () => {
  const { dispatcher, root } = makeDispatcher();
  const result = await callTool(dispatcher, { payload: VALID_PAYLOAD, partition: "no-such-partition" });
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.reasonCode, "MCP_PARTITION_UNKNOWN");
  rmSync(root, { recursive: true, force: true });
});

test("a non-object payload is refused: MCP_ARGUMENT_INVALID", async () => {
  const { dispatcher, root } = makeDispatcher();
  const result = await callTool(dispatcher, { payload: "not-an-object" });
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.reasonCode, "MCP_ARGUMENT_INVALID");
  rmSync(root, { recursive: true, force: true });
});

test("a refused ceremony is surfaced as an isError tool result with its reason code and materialised paths", async () => {
  const { dispatcher, root } = makeDispatcher({
    perform: async () => ({ ok: false, reasonCode: "RESERVED_FLAG_IN_PAYLOAD", problems: ["expected-version"] })
  });
  const result = await callTool(dispatcher, { payload: VALID_PAYLOAD });
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.ok, false);
  assert.equal(result.structuredContent.reasonCode, "RESERVED_FLAG_IN_PAYLOAD");
  assert.ok(typeof result.structuredContent.receiptPath === "string");
  assert.ok(typeof result.structuredContent.payloadPath === "string");
  rmSync(root, { recursive: true, force: true });
});

test("a dry-run success is a non-error result carrying CEREMONY_PLANNED_ONLY", async () => {
  const { dispatcher, root } = makeDispatcher();
  const result = await callTool(dispatcher, { payload: VALID_PAYLOAD, dryRun: true });
  assert.equal(result.isError, false);
  assert.equal(result.structuredContent.ok, true);
  assert.equal(result.structuredContent.reasonCode, "CEREMONY_PLANNED_ONLY");
  assert.equal(result.structuredContent.dryRun, true);
  assert.equal(result.structuredContent.partition, "TCRN-AOS");
  rmSync(root, { recursive: true, force: true });
});

test("dispatch refuses a request that is not JSON-RPC 2.0", async () => {
  const { dispatcher, root } = makeDispatcher();
  await assert.rejects(
    dispatcher.dispatch({ id: 1, method: "tools/list" }),
    (error) => error.reasonCode === "MCP_INVALID_REQUEST"
  );
  rmSync(root, { recursive: true, force: true });
});
