#!/usr/bin/env node
// Every package in the installed tree must carry a licence compatible with distributing
// this repository under Apache-2.0, and the judgement must be recorded rather than assumed.
//
// The rule that matters is the one that is easy to skip: a copyleft or source-available
// licence is not refused silently here, it is REPORTED as needing an explicit ruling —
// because "it looked like MIT" is how the wrong one gets adopted.
//
// The tree is read from pnpm's own store (node_modules/.pnpm), which is what is actually
// installed and therefore what is actually distributed. Guessing top-level paths does not
// work under pnpm's strict layout and produces a page of false alarms, which is worse than
// no report at all.

import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const store = join(repoRoot, "node_modules", ".pnpm");

const PERMISSIVE = new Set([
  "MIT", "ISC", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "0BSD", "Unlicense", "CC0-1.0",
  "BlueOak-1.0.0", "Python-2.0", "MIT-0", "(MIT OR CC0-1.0)", "MIT AND ISC",
]);
const NEEDS_RULING = /\b(A?GPL|LGPL|SSPL|BUSL|CC-BY|EPL|MPL|CDDL|Proprietary|UNLICENSED)\b/i;

/** Dev-only packages are not distributed; the tree that ships is what this judges. */
const manifest = JSON.parse(await readFile(join(repoRoot, "package.json"), "utf8"));
const devNames = new Set(Object.keys(manifest.devDependencies ?? {}));

async function* manifestsIn(dir, depth = 0) {
  if (depth > 3) return;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    const full = join(dir, entry.name);
    const candidate = join(full, "package.json");
    try {
      await stat(candidate);
      yield candidate;
    } catch {
      yield* manifestsIn(full, depth + 1);
    }
  }
}

const byName = new Map();
for await (const path of manifestsIn(store)) {
  let pkg;
  try {
    pkg = JSON.parse(await readFile(path, "utf8"));
  } catch {
    continue;
  }
  if (!pkg.name || !pkg.version) continue;
  const licence = pkg.license ?? (Array.isArray(pkg.licenses) ? pkg.licenses[0]?.type : null) ?? null;
  const key = `${pkg.name}@${pkg.version}`;
  if (!byName.has(key)) byName.set(key, { name: pkg.name, version: pkg.version, licence });
}

const all = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
const shipped = all.filter((entry) => !devNames.has(entry.name));

const needsRuling = shipped.filter((entry) => entry.licence && NEEDS_RULING.test(entry.licence));
const unknown = shipped.filter((entry) => !entry.licence);
const permissive = shipped.filter((entry) => entry.licence && PERMISSIVE.has(entry.licence));
const other = shipped.filter(
  (entry) => entry.licence && !PERMISSIVE.has(entry.licence) && !NEEDS_RULING.test(entry.licence),
);

// A store that yielded nothing means the scan is broken, not that the tree is clean.
const scanned = all.length;
const ok = needsRuling.length === 0 && unknown.length === 0 && scanned > 20;

console.log(
  JSON.stringify(
    {
      ok,
      repositoryLicence: manifest.license,
      packagesInStore: scanned,
      shipped: shipped.length,
      permissive: permissive.length,
      needsExplicitRuling: needsRuling,
      unknownLicence: unknown,
      otherLicences: other,
      ...(scanned <= 20 ? { reasonCode: "STORE_SCAN_EMPTY", note: "the pnpm store yielded almost nothing; the scan is broken" } : {}),
    },
    null,
    2,
  ),
);
process.exit(ok ? 0 : 1);
