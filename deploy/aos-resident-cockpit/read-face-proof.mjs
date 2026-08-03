#!/usr/bin/env node
// STORY-139 — the write-face loopback gate, judged on the live VM socket.
//
// MIN-014 (from CONF-014 verity): "write face never leaves loopback" is a
// MACHINE gate. Its predicate is not the source text and not a unit test's
// bound address — it is the address the kernel reports for the LIVE process,
// read on the same host that runs it. This script asks the VM itself:
//
//   ssh tcrn-platform-dev "ss -tln"
//
// and asserts the resident cockpit's port (4318) is held by a loopback listener
// (127.0.0.1) and by no wildcard/LAN listener. A rebind to 0.0.0.0, a LAN
// address, or an env-driven host turns this red at the only place that matters —
// the VM's actual socket table.
//
// The red proof for this predicate is the write face's own tripwire test
// (apps/cockpit-service/test/service.test.mjs: flip the dist bind to 0.0.0.0 and
// the test fails; drill recorded in evidence/aos-access-boundary-proof.json).
// This gate re-derives the SAME statement against the deployed reality, which a
// unit test cannot: a correct source bound behind a reverse proxy, or a stale
// deployed bundle, would still pass the test but fail here.

import { execFile } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { VM_HOST, PORT } from "./manifest.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

function ssh(args) {
  return new Promise((resolveResult, reject) => {
    execFile("ssh", [VM_HOST, ...args], { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) reject(new Error(`ssh failed: ${stderr || error.message}`));
      else resolveResult(stdout);
    });
  });
}

const findings = [];
const record = (id, ok, detail) => {
  if (!ok) findings.push({ id, detail });
};

const socketTable = await ssh(["ss", "-tln"]);

// The write face's port, and every socket holding it.
const lines = socketTable.split("\n")
  .map((line) => line.trim())
  .filter((line) => line && line.includes(`:${PORT}`));
const listeners = lines.filter((line) => line.startsWith("LISTEN"));

record(
  "write-face-port-listed",
  listeners.length > 0,
  listeners.length > 0
    ? `port ${PORT} is LISTENing (${listeners.length} entry)`
    : `port ${PORT} has no LISTEN entry on the VM — the write face is not running`
);

// The bound address(es). ss prints Local Address:Port as one column; extract
// the address that holds our port (not Recv-Q/Send-Q columns).
const bound = [];
for (const line of listeners) {
  const match = line.match(new RegExp(`([0-9a-fA-F:.\\[\\]]+):${PORT}\\b`));
  if (match) bound.push(match[1]);
}

const loopbackAddrs = new Set(["127.0.0.1", "::1"]);
const wildcardAddrs = new Set(["0.0.0.0", "::", "*"]);

const nonLoopback = bound.filter((addr) => !loopbackAddrs.has(addr));

record(
  "write-face-bound-loopback",
  bound.length > 0 && nonLoopback.length === 0,
  nonLoopback.length === 0
    ? `write face binds only loopback: ${bound.join(", ") || "none"}`
    : `write face binds a non-loopback address: ${nonLoopback.join(", ")}`
);

// No wildcard bind on the port.
record(
  "write-face-not-wildcard",
  !bound.some((addr) => wildcardAddrs.has(addr)),
  bound.some((addr) => wildcardAddrs.has(addr))
    ? "write face is wildcard-bound"
    : "write face is not wildcard-bound"
);

const ok = findings.length === 0;
const receipt = {
  ok,
  gate: "aos-write-face-loopback-vm",
  schemaVersion: "aos.read-face-boundary.v1",
  host: VM_HOST,
  port: PORT,
  boundAddresses: bound,
  invariants: [
    "the write face's port is LISTENing on the VM",
    "the write face binds loopback only (127.0.0.1/::1)",
    "the write face is not wildcard-bound"
  ],
  findings,
  generatedAt: new Date().toISOString()
};

const text = `${JSON.stringify(receipt, null, 2)}\n`;
const out = resolve(REPO_ROOT, "evidence/aos-write-face-loopback-vm.json");
writeFileSync(out, text);
process.stdout.write(text);
if (!ok) process.exit(1);
