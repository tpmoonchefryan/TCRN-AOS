#!/usr/bin/env node
// TCRN-CROSS-INIT-019 STORY-156 — a minimal MCP client for the write face.
//
//   node deploy/aos-mcp-write/drive.mjs <cases.json>
//
// `cases.json` is an array of tool-call cases: { name?, arguments }. Each is driven
// after a real initialize/initialized/tools-list handshake against a fresh server
// child. Results are written to stdout as one JSON array (one entry per case, in
// order). Used for the live red-side demonstrations (STORY-156.3) and the dry-run
// proof (STORY-156.2), where the answer has to come from the real server process
// — not from a unit test.

import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";

const SERVER = fileURLToPath(import.meta.url).replace("drive.mjs", "server.mjs");

function connect() {
  const child = spawn(process.execPath, [SERVER], { stdio: ["pipe", "pipe", "inherit"] });
  let buffered = "";
  const frames = [];
  let resolveFrame = null;
  child.stdout.on("data", (chunk) => {
    buffered += chunk.toString("utf8");
    while (buffered.includes("\n")) {
      const newline = buffered.indexOf("\n");
      frames.push(buffered.slice(0, newline));
      buffered = buffered.slice(newline + 1);
      if (resolveFrame) {
        const r = resolveFrame;
        resolveFrame = null;
        r();
      }
    }
  });
  const nextFrame = () => new Promise((r) => {
    if (frames.length > 0) { r(frames.shift()); return; }
    resolveFrame = () => r(frames.shift());
  });
  const send = (value) => child.stdin.write(`${JSON.stringify(value)}\n`);
  return { child, send, nextFrame };
}

async function main() {
  const casesPath = process.argv[2];
  if (!casesPath) {
    process.stderr.write("usage: drive.mjs <cases.json>\n");
    process.exit(2);
  }
  const cases = JSON.parse(readFileSync(casesPath, "utf8"));

  const { child, send, nextFrame } = connect();
  const results = [];

  // handshake: initialize → initialized → (the server is ready)
  send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "drive", version: "0.0.1" } } });
  await nextFrame();
  send({ jsonrpc: "2.0", method: "notifications/initialized" });

  for (const [index, entry] of cases.entries()) {
    send({
      jsonrpc: "2.0",
      id: 10 + index,
      method: "tools/call",
      params: { name: entry.name ?? "tcrn_ceremony", arguments: entry.arguments }
    });
    const frame = await nextFrame();
    const parsed = JSON.parse(frame);
    results.push({
      case: index,
      label: entry.label ?? null,
      result: parsed.result
    });
  }

  child.kill("SIGTERM");
  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`drive failed: ${error.message}\n`);
  process.exitCode = 1;
});
