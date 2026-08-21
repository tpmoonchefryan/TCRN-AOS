#!/usr/bin/env node
// Keep the verify chain explicit. Removing a gate from package.json must be a red change,
// not a quiet reduction in what the repository proves.

import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(await readFile(join(repoRoot, "package.json"), "utf8"));
const manifest = JSON.parse(await readFile(join(repoRoot, "scripts/gates.json"), "utf8"));
const actual = packageJson.scripts.verify
  .split("&&")
  .map((part) => part.trim())
  .map((part) => part.replace(/^pnpm\s+/, ""));
const expected = manifest.verifySteps;

const ok = JSON.stringify(actual) === JSON.stringify(expected)
  && actual.every((step) => step.length > 0);
console.log(JSON.stringify({ ok, actual, expected }, null, 2));
process.exit(ok ? 0 : 1);
