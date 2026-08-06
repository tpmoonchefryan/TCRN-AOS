#!/usr/bin/env node
// TCRN-CROSS-INIT-019 STORY-156 — the AOS-mode MCP WRITE face: a single `ceremony`
// tool that wraps the existing local-side remote governance ceremony.
//
//   (stdio MCP server; --self-test for a client round-trip without a live chain)
//   node deploy/aos-mcp-write/server.mjs
//
// WHY A SINGLE TOOL. D5 (TCRN-CROSS-MIN-061): the write surface is one `ceremony`
// tool, not a per-verb forwarding of the mutating catalogue. Ceremony discipline —
// a payload of steps plus at least one read-back, reserved flags, expected-version
// from a live read, receipts, batch semantics — is ONE invariant, and per-verb
// forwarding would push that discipline onto the caller, reopening the door this
// platform closed. This file is the wrapper for deploy/aos-local-client/ceremony.mjs
// (TCRN-CROSS-STORY-133); it does not rewrite any ceremony logic.
//
// WHAT IT CANNOT DO, structurally rather than by promise:
//   - it publishes exactly ONE tool (tcrn_ceremony), so no configuration of it can
//     turn into a per-verb write face;
//   - it refuses a payload that names --workspace / --attest-dir / --expected-version
//     (RESERVED_FLAG_IN_PAYLOAD), a payload with no read-back (PAYLOAD_INVALID),
//     a verb absent from the HOST engine's own catalogue (VERB_NOT_IN_CATALOGUE),
//     and the one-shot authority verb family (VERB_REQUIRES_OUT_OF_BAND_AUTHORITY);
//   - it decides where payloads and receipts are materialised, and a caller cannot
//     name either path.
//
// The transport is mirrored from deploy/aos-local-client/remote-read-mcp.mjs
// (TCRN-CROSS-STORY-132) — framing, protocol negotiation, not-initialized guard,
// back-pressure and the one-MiB line ceiling are the same function, imported, not
// reinvented, so a client that learned the read protocol meets the same protocol here.
// The refusal grounds that do not need the network are answered locally; the ones
// that do (a verb's presence in the host catalogue) are answered by the ceremony
// itself, which re-reads the head before every mutating step.
//
// CONTRACT: deploy/aos-mcp-write/SPEC.md (STORY-156.1). THE SPEC IS THE CONTRACT.

import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runRemoteReadMcpStdio, PROTOCOL_VERSIONS } from "../aos-local-client/remote-read-mcp.mjs";
import { runCeremony } from "../aos-local-client/ceremony.mjs";
import { AOS_PARTITIONS } from "../aos-local-client/aos-partitions.mjs";
import { REPO_ROOT, VM_HOST } from "../aos-local-client/topology.mjs";
import { scrubHostPaths, scrubHostPathsInText } from "../../scripts/lib/evidence-hygiene.mjs";

export const SERVER_NAME = "aos-mcp-write";
export const SERVER_VERSION = "0.1.0";
export const TOOL_NAME = "tcrn_ceremony";
export const SELF_TEST_FLAG = "--self-test";
/** Where this server materialises payloads and receipts. Tool-owned; a caller cannot name a path. */
export const WRITE_ROOT = resolve(REPO_ROOT, "evidence", "mcp-ceremony-write");

function fail(reasonCode, message) {
  const error = new Error(message);
  error.reasonCode = reasonCode;
  throw error;
}

/** Mirrors the read face's `asRecord`; see its comment about the prototype check. */
function asRecord(value, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype) {
    fail("MCP_INVALID_REQUEST", label);
  }
  return value;
}

/** A filename-friendly timestamp plus a nonce, so two calls in one millisecond cannot collide. */
function stamp() {
  return `${new Date().toISOString().replace(/[.:]/g, "-")}-${randomBytes(3).toString("hex")}`;
}

function ceremonyToolDescriptor() {
  const partition = Object.keys(AOS_PARTITIONS).sort();
  return {
    name: TOOL_NAME,
    description: `Single governed-write face onto the chains hosted on ${VM_HOST}. `
      + "Performs a ceremony as a payload of steps plus at least one read-back — a write "
      + "nobody read back is not proven. The payload may not name --workspace / --attest-dir / "
      + "--expected-version: the first two come from the partition topology and the third from a "
      + "live head read, because a sentinel you chose yourself froze nothing. Verbs absent from the "
      + "host engine's own catalogue, and verbs needing a one-shot authority file, are refused. "
      + "This tool is the ONLY write face; the engine facade's read tools and the remote read face "
      + "are how you verify, and a ceremony receipt is how you prove.",
    inputSchema: {
      type: "object",
      properties: {
        payload: {
          type: "object",
          description: "The ceremony payload: {schemaVersion: \"aos.local-client-ceremony.v1\", story, intent, steps[], readback[]}."
        },
        dryRun: {
          type: "boolean",
          description: "Plan and read only, send nothing; the receipt answers CEREMONY_PLANNED_ONLY."
        },
        partition: {
          type: "string",
          enum: partition,
          description: "Which governed partition to write. The workspace path behind it comes from "
            + "deploy/aos-local-client/aos-partitions.mjs and may not be named by the caller."
        }
      },
      required: ["payload"],
      additionalProperties: false
    },
    annotations: {
      // The opposite of the read face: this tool exists to mutate the chain.
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    }
  };
}

/** The default ceremony executor: the existing recipe, unmodified. */
export async function performCeremony({ payloadPath, dryRun, partition }) {
  // STORY-185: the write MCP face drives the facade write service (the ceremony
  // endpoint on 127.0.0.1:FACADE_WRITE_PORT through the SSH tunnel), which
  // performs the batch against the PG-backed chain. The facade's request takes
  // the payload object and the partition; the payload file written by the
  // dispatcher is read here and forwarded.
  const payload = JSON.parse(readFileSync(payloadPath, "utf8"));
  const tunnel = await establishWriteTunnel();
  const body = JSON.stringify({ partition, dryRun, payload });
  try {
    const { execFileSync } = await import("node:child_process");
    const stdout = execFileSync("curl", [
      "-s", "-m", "120", "-X", "POST", "-H", "content-type: application/json",
      "-d", body, `http://127.0.0.1:${tunnel.port}/api/ceremony`,
    ], { maxBuffer: 64 * 1024 * 1024, encoding: "utf8" });
    const receipt = JSON.parse(stdout);
    // The facade-write receipt shape is the ceremony receipt shape; the
    // dispatcher reads specific fields (ok, reasonCode, steps, readback).
    return {
      ...receipt,
      ok: receipt.ok === true,
      reasonCode: receipt.reasonCode ?? (receipt.ok === true ? "CEREMONY_COMPLETED" : "CEREMONY_REFUSED"),
    };
  } catch (error) {
    const text = String(error?.stdout ?? error?.stderr ?? error?.message ?? error).trim();
    throw new Error(`facade write ceremony failed: ${text.slice(0, 500)}`);
  }
}

// STORY-185: the facade write service binds loopback on the VM; the local MCP
// server reaches it through an ssh -N -L tunnel, established per session.
let writeTunnel = null;
async function establishWriteTunnel() {
  if (writeTunnel !== null) return writeTunnel;
  const { spawn } = await import("node:child_process");
  const { FACADE_WRITE_PORT, VM_HOST } = await import("../aos-local-client/topology.mjs");
  const port = FACADE_WRITE_PORT;
  const child = spawn("ssh", ["-N", "-L", `${port}:127.0.0.1:${port}`, VM_HOST],
    { stdio: "ignore", detached: true });
  child.unref();
  const net = await import("node:net");
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await new Promise((done) => setTimeout(done, 250));
    try {
      const ok = await new Promise((resolve) => {
        const socket = net.connect(port, "127.0.0.1", () => { socket.destroy(); resolve(true); });
        socket.on("error", () => resolve(false));
      });
      if (ok) { writeTunnel = { port, pid: child.pid }; return writeTunnel; }
    } catch { /* retry */ }
  }
  child.kill("SIGTERM");
  throw new Error("the facade write tunnel did not come up");
}

export async function reclaimWriteTunnel() {
  if (writeTunnel === null) return;
  try { process.kill(-writeTunnel.pid, "SIGTERM"); } catch { /* gone */ }
  try { process.kill(writeTunnel.pid, "SIGTERM"); } catch { /* gone */ }
  writeTunnel = null;
}

export class CeremonyDispatcher {
  #initialized = false;
  #perform;
  #writeRoot;

  constructor(perform = performCeremony, { writeRoot = WRITE_ROOT } = {}) {
    this.#perform = perform;
    this.#writeRoot = writeRoot;
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
          instructions: `Single governed-write face onto the chains hosted on ${VM_HOST}. One tool `
            + `(${TOOL_NAME}) runs the ceremony recipe from deploy/aos-local-client/ceremony.mjs: a `
            + "payload of steps plus at least one read-back, reserved flags refused, "
            + "--expected-version from a live head read, receipts materialised by this server. "
            + "Nothing else is reachable from this server."
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
      return { jsonrpc: "2.0", id, result: { tools: [ceremonyToolDescriptor()] } };
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
        // question and this face is answering "no, and here is the reason code".
        return { jsonrpc: "2.0", id, result: errorResult(error) };
      }
    }
    return { jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } };
  }

  async #callTool(name, input) {
    if (name !== TOOL_NAME) fail("MCP_TOOL_UNKNOWN", name);
    const args = asRecord(input, "arguments");

    const allowed = ["payload", "dryRun", "partition"];
    const unknown = Object.keys(args).filter((key) => !allowed.includes(key));
    if (unknown.length > 0) fail("MCP_ARGUMENT_UNKNOWN", unknown.sort().join(","));

    const partition = args.partition ?? "TCRN-AOS";
    if (typeof partition !== "string" || !Object.hasOwn(AOS_PARTITIONS, partition)) {
      fail("MCP_PARTITION_UNKNOWN", `partition must be one of ${Object.keys(AOS_PARTITIONS).sort().join(", ")}`);
    }
    const dryRun = args.dryRun ?? false;
    if (typeof dryRun !== "boolean") fail("MCP_ARGUMENT_INVALID", "dryRun");

    let payload = args.payload;
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch {
        fail("MCP_ARGUMENT_INVALID", "payload is not valid JSON");
      }
    }
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
      fail("MCP_ARGUMENT_INVALID", "payload must be a ceremony payload object");
    }

    // Materialisation paths are THIS server's decision (SPEC: the caller names
    // neither the payload nor the receipt path). Both land under the tool-owned
    // root so they are committable evidence that does not leak this machine's
    // home directory.
    const payloadPath = resolve(this.#writeRoot, "payloads", `${stamp()}-${partition}.json`);
    mkdirSync(dirname(payloadPath), { recursive: true });
    // INC-037 discipline: a materialised payload is committable evidence, so it is
    // scrubbed of host paths before it lands — the same hygiene the receipt gets.
    // A payload can carry a host path (an init step names its framework root), and
    // an unscrupped payload in evidence/ is how the gate below was reddened once.
    writeFileSync(payloadPath, `${JSON.stringify(scrubHostPaths(payload), null, 2)}\n`);

    let receipt;
    try {
      receipt = await this.#perform({ payloadPath, dryRun, partition });
    } catch (error) {
      // INC-047: a ceremony that THROWS must still leave a receipt — otherwise an
      // orphan payload sits in evidence/ and the caller cannot tell how many steps of
      // a batch landed. The failure receipt names the error and that the chain
      // position is unknown.
      receipt = {
        schemaVersion: "aos.local-client-ceremony.v1",
        story: typeof payload?.story === "string" ? payload.story : "<unknown>",
        intent: typeof payload?.intent === "string" ? payload.intent : "<unknown>",
        ok: false,
        reasonCode: "CEREMONY_THREW_BEFORE_RECEIPT",
        error: scrubHostPathsInText(String(error?.message ?? error)).slice(0, 500),
        partition,
        dryRun,
        thrownBeforeReceipt: true,
        chainBefore: null,
        chainAfter: null,
        steps: [],
        readback: []
      };
    }

    const receiptPath = resolve(this.#writeRoot, "receipts", `${stamp()}-${partition}.json`);
    mkdirSync(dirname(receiptPath), { recursive: true });
    writeFileSync(receiptPath, `${JSON.stringify(scrubHostPaths(receipt), null, 2)}\n`);

    const result = {
      ok: receipt.ok === true,
      reasonCode: receipt.reasonCode ?? (receipt.ok === true ? "CEREMONY_OK" : "CEREMONY_REFUSED"),
      host: VM_HOST,
      partition,
      dryRun,
      receipt: scrubHostPaths(receipt),
      receiptPath: relative(REPO_ROOT, receiptPath),
      payloadPath: relative(REPO_ROOT, payloadPath)
    };
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result,
      isError: receipt.ok !== true
    };
  }
}

function errorResult(error) {
  const reasonCode = typeof error?.reasonCode === "string" ? error.reasonCode : "MCP_INTERNAL_ERROR";
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

/** The JSON-RPC round-trip a real MCP client makes, driven against a child of ourselves. */
export function runSelfTest({ spawnChild = spawn, executable = process.execPath } = {}) {
  const child = spawnChild(executable, [fileURLToPath(import.meta.url)], {
    stdio: ["pipe", "pipe", "inherit"]
  });
  let output = "";
  const frames = [];
  const incoming = (chunk) => {
    output += chunk.toString("utf8");
    while (output.includes("\n")) {
      const newline = output.indexOf("\n");
      frames.push(output.slice(0, newline));
      output = output.slice(newline + 1);
    }
  };
  child.stdout.on("data", incoming);

  return new Promise((resolvePromise) => {
    let sentInitialize = false;
    let sentList = false;
    let sentInitialized = false;
    const settle = (ok, reasonCode, detail) => {
      child.kill("SIGTERM");
      resolvePromise({ ok, reasonCode, detail, frames });
    };
    child.on("error", (error) => settle(false, "SELF_TEST_CHILD_SPAWN_FAILED", String(error.message)));
    child.on("exit", () => {
      if (!sentList) return; // wait for the tools/list frame before judging
    });
    const poll = () => {
      if (!sentInitialize) {
        child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "self-test", version: "0.0.0" } } })}\n`);
        sentInitialize = true;
      } else if (frames.some((frame) => frame.includes('"id":1')) && !sentInitialized) {
        child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
        sentInitialized = true;
      } else if (sentInitialized && !sentList) {
        child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" })}\n`);
        sentList = true;
      } else if (sentList) {
        const list = frames.find((frame) => frame.includes('"id":2'));
        if (list !== undefined) {
          let parsed = null;
          try { parsed = JSON.parse(list); } catch { /* malformed */ }
          if (parsed?.result?.tools?.some((tool) => tool.name === TOOL_NAME)) {
            settle(true, "SELF_TEST_OK", "initialize + tools/list round-trip carries the single ceremony tool");
          } else {
            settle(false, "SELF_TEST_TOOL_MISSING", `tools/list did not expose ${TOOL_NAME}`);
          }
          return;
        }
      }
      setTimeout(poll, 25);
    };
    poll();
  });
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  const argv = process.argv.slice(2);
  if (argv.includes(SELF_TEST_FLAG)) {
    if (argv.length !== 1) {
      process.stderr.write(JSON.stringify({ ok: false, reasonCode: "SELF_TEST_ARGS_INVALID", detail: "--self-test takes no other arguments" }) + "\n");
      process.exitCode = 1;
    } else {
      const result = await runSelfTest();
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      if (!result.ok) process.exitCode = 1;
    }
  } else if (argv.length > 0) {
    // A write face may not be configured with arguments; there is nothing a
    // configuration could add that would not be an authority grant.
    process.stderr.write(JSON.stringify({ ok: false, reasonCode: "MCP_WRITE_ARGUMENT_UNKNOWN", detail: `this server takes no arguments (got ${argv.length}); use ${SELF_TEST_FLAG} to self-test` }) + "\n");
    process.exitCode = 1;
  } else {
    try {
      await runRemoteReadMcpStdio(process.stdin, process.stdout, { tools: [ceremonyToolDescriptor()] }, new CeremonyDispatcher());
    } catch (error) {
      process.stderr.write(`${JSON.stringify({
        ok: false,
        reasonCode: typeof error?.reasonCode === "string" ? error.reasonCode : "MCP_INTERNAL_ERROR",
        error: scrubHostPathsInText(String(error?.message ?? error))
      })}\n`);
      process.exitCode = 1;
    } finally {
      await reclaimWriteTunnel();
    }
  }
}
