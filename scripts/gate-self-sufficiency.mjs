#!/usr/bin/env node
// verify must run on a tree that has never been built.
//
// This exists because of a specific, repeated shape of defect: a gate that reads dist/,
// or a generated file, or something a previous run left behind, and therefore passes on
// the developer's machine and fails in the container — or worse, passes in the container
// because the image happened to carry a stale artifact.
//
// The check is structural rather than a full clean-room build: it asserts that nothing in
// the verify chain depends on an artifact the chain itself does not produce first.

import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(join(repoRoot, "package.json"), "utf8"));
const verify = manifest.scripts?.verify ?? "";

const steps = verify.split("&&").map((step) => step.trim().replace(/^pnpm\s+/, "")).filter(Boolean);

const problems = [];

// `build` must come before anything that reads dist/. The previous tree had this exactly
// backwards in one chain, and it only showed up on a fresh checkout.
const buildIndex = steps.indexOf("build");
if (buildIndex === -1) problems.push({ problem: "verify never builds", detail: "a chain that does not build cannot be run on a fresh checkout" });

const readsDist = [];
for (const [index, step] of steps.entries()) {
  const scriptBody = manifest.scripts?.[step] ?? "";
  const file = /node\s+(scripts\/[\w.-]+\.mjs)/.exec(scriptBody)?.[1];
  if (!file) continue;
  let source = "";
  try {
    source = await readFile(join(repoRoot, file), "utf8");
  } catch {
    problems.push({ problem: "verify names a script that does not exist", step, file });
    continue;
  }
  if (/["'`][^"'`]*\bdist\//.test(source)) {
    readsDist.push({ step, file, index });
    if (buildIndex !== -1 && index < buildIndex) {
      problems.push({ problem: "reads dist/ before build runs", step, file, stepIndex: index, buildIndex });
    }
  }
}

// Every step must name a script that exists.
for (const step of steps) {
  const [name] = step.split(" ");
  if (!manifest.scripts?.[name] && !step.startsWith("node ")) {
    problems.push({ problem: "verify names a script the manifest does not define", step });
  }
}

const ok = problems.length === 0;
console.log(JSON.stringify({ ok, steps: steps.length, buildAtStep: buildIndex, scriptsReadingDist: readsDist, problems }, null, 2));
process.exit(ok ? 0 : 1);
