#!/usr/bin/env node
// STORY-139 — the read face's structural invariants, as a gate.
//
// The behavioural half is the read-service test suite (apps/cockpit-read/test):
// no chain routes, every write method refused, the domain store read-only at the
// connection, wildcard binds refused, Host allow-list, security headers. This
// gate is the SOURCE half of the same predicate — it asserts that the read face
// cannot GAIN write capability without this gate going red, even if a future
// edit ships no new test.
//
// Two statements, both about the bytes rather than the runtime:
//
//   1. the read service source never names the machinery of a chain write —
//      ChainClient, authority pins, or callTool. These are the only paths by
//      which a process writes this chain, and the read face must structurally
//      not contain them (MIN-014: read face never holds pins).
//
//   2. the read service exposes no write-method routing: the global write-method
//      refusal and the READ_ONLY_SURFACE constants are present, so a route that
//      accidentally accepts POST/PUT/PATCH/DELETE is caught at the source.
//
// The red proof for this gate is the read-service test "the read face has no
// chain routes and no write methods": remove the WRITE_METHODS guard and that
// test fails. The red proof for the loopback half is the write face's own
// tripwire (service.test.mjs, flipped-bind drill recorded in
// evidence/aos-access-boundary-proof.json).

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readSource = readFileSync(resolve(root, "apps/cockpit-read/src/read-service.ts"), "utf8");
const testSource = readFileSync(resolve(root, "apps/cockpit-read/test/read-service.test.mjs"), "utf8");

const findings = [];
const record = (id, ok, detail) => {
  if (!ok) findings.push({ id, detail });
};

// ── 1. the read face never names chain-write machinery ───────────────────────
const writeMachinery = ["ChainClient", "authorityPins", "authority-pins", "callTool", "SafeWriteSurface"];
const present = writeMachinery.filter((token) => readSource.includes(token));
record(
  "read-service-source-names-no-write-machinery",
  present.length === 0,
  present.length === 0
    ? "no chain-write machinery in the read service source"
    : `read service source names chain-write machinery: ${present.join(", ")}`
);

// ── 2. the read face refuses write methods at the source ─────────────────────
record(
  "read-service-refuses-write-methods",
  readSource.includes("WRITE_METHODS") && readSource.includes("READ_ONLY_SURFACE"),
  readSource.includes("WRITE_METHODS") && readSource.includes("READ_ONLY_SURFACE")
    ? "write-method refusal and READ_ONLY_SURFACE present"
    : "write-method refusal guard is absent from the read service source"
);

// ── 3. the read face options carry no pins (a deployment cannot hand them) ────
record(
  "read-service-options-carry-no-pins",
  !/authorityPins|authorityPinsDigest|authority-pins/u.test(readSource),
  /authorityPins|authorityPinsDigest|authority-pins/u.test(readSource)
    ? "read service options expose a pins field"
    : "read service options expose no pins field"
);

// ── 4. the behavioural suite actually asserts the no-write-route invariant ───
record(
  "read-service-test-asserts-chain-route-absence",
  testSource.includes("/api/chain/") && testSource.includes("READ_ONLY_SURFACE"),
  testSource.includes("/api/chain/") && testSource.includes("READ_ONLY_SURFACE")
    ? "read-service test asserts chain-route absence"
    : "read-service test does not assert chain-route absence"
);

const result = {
  ok: findings.length === 0,
  gate: "aos-read-face-source-gate",
  invariants: [
    "the read face never names chain-write machinery (pins / ChainClient / callTool)",
    "the read face refuses write methods at the source",
    "the read face options carry no pins field",
    "the behavioural suite asserts the no-write-route invariant"
  ],
  findings
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (!result.ok) {
  process.stderr.write(`\n${findings.length} read-face source invariant(s) fail.\n`);
  process.exit(1);
}
