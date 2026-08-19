#!/usr/bin/env node
// Prove the product does not depend on tcrn-workflow or tcrn-workflow-helper.
//
// Zero dependency was a ruling, and a ruling is a claim until something checks it. This
// gate does two things: it looks for any reference in the shipped tree, and then it moves
// both sibling repositories aside on disk and runs the suite, so "it works without them"
// becomes an observation rather than an assertion.
//
// The rename is restored in a finally block, and the gate refuses to run at all if it
// cannot restore — a check that can leave the machine broken is not worth its finding.

import { spawnSync } from "node:child_process";
import { readdir, readFile, rename, stat } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const platformRoot = resolve(repoRoot, "..");

const FORBIDDEN = [
  { pattern: /tcrn-workflow-helper/i, name: "tcrn-workflow-helper" },
  { pattern: /tcrn-workflow(?!-helper)/i, name: "tcrn-workflow" },
  { pattern: /\.tcrn-workspace/, name: "the chain container" },
];

// Documents may discuss the separation; code may not depend on it. The distinction is the
// point of the rule, so it is stated rather than left to whoever reads the output.
const SEARCHED = ["packages", "apps", "scripts", "deploy"];
const SKIP_FILE = /gate-absence\.mjs$/;

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      yield* walk(full);
    } else if (/\.(ts|tsx|mjs|js|json|sql|ya?ml)$/.test(entry.name)) {
      yield full;
    }
  }
}

const references = [];
for (const dir of SEARCHED) {
  for await (const file of walk(join(repoRoot, dir))) {
    if (SKIP_FILE.test(file)) continue;
    const source = await readFile(file, "utf8");
    for (const [index, line] of source.split("\n").entries()) {
      for (const { pattern, name } of FORBIDDEN) {
        if (pattern.test(line)) {
          references.push({ file: relative(repoRoot, file), line: index + 1, refersTo: name, text: line.trim().slice(0, 160) });
        }
      }
    }
  }
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

const siblings = ["tcrn-workflow", "tcrn-workflow-helper"];
const moved = [];
let suite = { skipped: true, reason: "" };

try {
  for (const name of siblings) {
    const from = join(platformRoot, name);
    if (!(await exists(from))) continue;
    const to = `${from}.absent-for-gate`;
    if (await exists(to)) {
      suite = { skipped: true, reason: `${to} already exists; a previous run did not restore` };
      break;
    }
    await rename(from, to);
    moved.push([from, to]);
  }

  if (!suite.reason) {
    const result = spawnSync("node", ["--test", "--test-concurrency=1", "packages/store/test/search-text.test.mjs", "apps/web/src/test/url.test.mjs"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    suite = {
      skipped: false,
      status: result.status,
      passed: result.status === 0,
      tail: (result.stdout ?? "").trim().split("\n").slice(-6).join("\n"),
    };
  }
} finally {
  for (const [from, to] of moved.reverse()) {
    await rename(to, from);
  }
}

const stillMoved = [];
for (const name of siblings) {
  const original = join(platformRoot, name);
  const parked = `${original}.absent-for-gate`;
  if (await exists(parked)) stillMoved.push(parked);
}

const ok = references.length === 0 && suite.passed !== false && stillMoved.length === 0;
console.log(
  JSON.stringify(
    {
      ok,
      searchedDirectories: SEARCHED,
      references,
      renamedAside: moved.map(([from]) => relative(platformRoot, from)),
      suiteWithSiblingsAbsent: suite,
      ...(stillMoved.length ? { reasonCode: "RESTORE_FAILED", stillMoved } : {}),
    },
    null,
    2,
  ),
);
process.exit(ok ? 0 : 1);
