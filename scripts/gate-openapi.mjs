#!/usr/bin/env node
// The committed OpenAPI document must equal the one the registry generates.
//
// A hand-edited spec is a second declaration of the same surface, and two declarations
// diverge the first time someone is in a hurry. Regenerating and byte-comparing makes the
// document a projection of the code rather than a promise about it.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildOpenApi } from "../dist/apps/server/src/openapi.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const committed = join(repoRoot, "openapi.json");
const write = process.argv.includes("--write");

const generated = `${JSON.stringify(buildOpenApi("committed"), null, 2)}\n`;

if (write) {
  await writeFile(committed, generated, "utf8");
  console.log(JSON.stringify({ ok: true, wrote: "openapi.json" }));
  process.exit(0);
}

let current;
try {
  current = await readFile(committed, "utf8");
} catch {
  console.error(JSON.stringify({ ok: false, reasonCode: "OPENAPI_MISSING", fix: "node scripts/gate-openapi.mjs --write" }));
  process.exit(1);
}

if (current !== generated) {
  console.error(JSON.stringify({
    ok: false,
    reasonCode: "OPENAPI_STALE",
    detail: "the committed document no longer matches what the registry generates",
    fix: "node scripts/gate-openapi.mjs --write",
    committedBytes: current.length,
    generatedBytes: generated.length,
  }));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, bytes: generated.length }));
