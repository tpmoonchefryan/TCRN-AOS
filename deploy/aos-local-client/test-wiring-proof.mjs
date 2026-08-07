#!/usr/bin/env node
// TCRN-CROSS-INIT-020 INC-079 — test wiring gate (AOS). A test that no pipeline
// ever executes is a gate whose lifetime equals the day it was written. The AOS
// `pnpm test` script names its test files explicitly; a new test file that is not
// added to that script (or registered with a dated reason) is an orphan. This
// gate enumerates every *.test.mjs in the repository and reds on orphans.
//
// RED LEG: plant a test file not in the `test` script → this reds.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist" || entry.name === ".codegraph") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name.endsWith(".test.mjs")) out.push(full);
  }
  return out;
}

export function judgeAosTestWiring({ repoRoot = REPO_ROOT } = {}) {
  const problems = [];
  const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
  const testScript = packageJson.scripts?.test ?? "";
  if (typeof testScript !== "string" || !/\bnode --test\b/u.test(testScript)) {
    problems.push("package.json:test does not execute node --test");
  }
  // Only the repository's canonical `test` script is a pipeline. A path mentioned
  // by a convenience proof or a one-off developer script is not evidence that CI
  // or the release verification actually executes it (INC-079).
  const covered = new Set();
  const testCommand = testScript.match(/\bnode --test\b(?<arguments>[\s\S]*)$/u)?.groups?.arguments ?? "";
  for (const match of testCommand.matchAll(/(?:^|\s)(?<path>[\w./-]+\.test\.mjs)(?=\s|$)/gu)) {
    covered.add(match.groups.path);
  }
  const enumerated = [];
  for (const base of ["tests", "packages", "deploy", "scripts", "apps"]) {
    for (const path of walk(join(repoRoot, base))) {
      enumerated.push(relative(repoRoot, path));
    }
  }
  const orphaned = enumerated.filter((path) => !covered.has(path)).sort();
  if (orphaned.length > 0) {
    problems.push(`orphaned test files: ${orphaned.join(", ")}`);
  }
  const enumeratedSet = new Set(enumerated);
  for (const path of covered) {
    if (!enumeratedSet.has(path)) problems.push(`test script names a missing or out-of-scope test file: ${path}`);
  }
  return {
    ok: problems.length === 0,
    reasonCode: problems.length === 0 ? "TEST_WIRING_VERIFIED" : "TEST_WIRING_ORPHANED",
    enumerated: enumerated.length,
    covered: covered.size,
    testCommandFiles: [...covered].sort(),
    orphaned,
    problems,
  };
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href || process.argv[1]?.endsWith("test-wiring-proof.mjs")) {
  const result = judgeAosTestWiring();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  for (const p of result.problems ?? []) process.stderr.write(`  PROBLEM: ${p}\n`);
  if (!result.ok) process.exitCode = 1;
}
