#!/usr/bin/env node
// No U+FFFD in any generated or shipped artifact.
//
// This gate exists because five replacement characters once silently corrupted two Chinese
// strings in the interface. Nothing failed; the words were simply wrong, and stayed wrong.
// A product whose primary language is Chinese cannot leave that to review.

import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ROOTS = ["packages", "apps", "scripts", "deploy"];

async function* walk(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      yield* walk(full);
    } else if (/\.(ts|tsx|mjs|js|json|sql|css|html|ya?ml|md)$/.test(entry.name)) {
      yield full;
    }
  }
}

const hits = [];
let scanned = 0;
for (const root of ROOTS) {
  for await (const file of walk(join(repoRoot, root))) {
    scanned += 1;
    const text = await readFile(file, "utf8");
    // Written as an escape, not a literal: a gate that contains the byte it hunts for
    // finds itself, and a check whose only finding is its own source is noise.
    const index = text.indexOf("\uFFFD");
    if (index !== -1) {
      const line = text.slice(0, index).split("\n").length;
      hits.push({ file: relative(repoRoot, file), line, context: text.slice(Math.max(0, index - 40), index + 40) });
    }
  }
}

const ok = hits.length === 0;
console.log(JSON.stringify({ ok, filesScanned: scanned, replacementCharacters: hits }, null, 2));
process.exit(ok ? 0 : 1);
