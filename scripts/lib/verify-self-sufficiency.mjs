/**
 * Is `pnpm verify` runnable on a checkout that has never been built?
 *
 * The drift this exists for was real and it hid for the whole of INIT-002 and
 * INIT-003: `verify` ran `validate:migrations` before anything emitted into
 * `dist/`, and that step imports `dist/packages/db/src/index.js`. In a working
 * tree the directory is already there from some earlier build, so the chain was
 * green every time anybody ran it. It only went red in the closing
 * clean-checkout run the delivery-cadence convention asks for — that is, at the
 * one moment when a red is most expensive and least expected.
 *
 * The check is static on purpose. Actually proving it would mean deleting
 * `dist/` and running the head of the chain, which is both slow and a
 * destructive act inside a test. So instead: walk the module graph reachable
 * from each verify step by relative imports, and assert that no step positioned
 * before the first emitting step reads out of `dist/`.
 *
 * What makes it a real gate rather than a comment: move `validate:migrations`
 * back ahead of `build` in package.json and this turns red, naming the step and
 * the file that reads `dist/`.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");

/** The build output directory every step below is judged against. */
export const OUTPUT_DIR = "dist";

/**
 * Split a `pnpm a && pnpm b && ...` chain into the script names it runs.
 *
 * Only `pnpm <name>` links are steps. Anything else in the chain (a bare
 * `node …`, an env assignment) is returned as a literal so the caller can see
 * it rather than have it silently dropped — a step this function cannot name is
 * a step it cannot judge, and that has to be visible.
 */
export function verifyChain(verifyBody) {
  return verifyBody
    .split("&&")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => {
      const match = /^pnpm\s+(?:run\s+)?([A-Za-z0-9:._-]+)$/u.exec(part);
      return match ? { kind: "script", name: match[1] } : { kind: "literal", text: part };
    });
}

/**
 * Does this script body emit into the output directory?
 *
 * `tsc -p …` emits unless `--noEmit` is passed, which is exactly the difference
 * between `build` and `typecheck` here and the reason the two cannot be treated
 * as interchangeable.
 */
export function emitsOutput(body) {
  if (/\btsc\b[^&|]*-p\b/u.test(body) && !/--noEmit\b/u.test(body)) return true;
  return /\bpnpm\s+(?:run\s+)?build\b/u.test(body);
}

/**
 * Files reachable from `entry` through relative imports, as repo-relative paths.
 *
 * Bare specifiers are not followed: a dependency in `node_modules` cannot be
 * the thing that reads this repository's `dist/`, and following them would turn
 * a cheap check into a package-manager crawl.
 */
export function moduleGraph(entry, root = REPO_ROOT) {
  const seen = new Set();
  const queue = [resolve(root, entry)];
  while (queue.length > 0) {
    const file = queue.shift();
    const key = relative(root, file);
    if (seen.has(key) || !existsSync(file)) continue;
    seen.add(key);
    const source = readFileSync(file, "utf8");
    const specifiers = [
      ...source.matchAll(/(?:^|[^\w$])(?:import|export)[^;'"]*?from\s*["']([^"']+)["']/gmu),
      ...source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/gu),
      ...source.matchAll(/\brequire\s*\(\s*["']([^"']+)["']\s*\)/gu),
    ].map((match) => match[1]);
    for (const specifier of specifiers) {
      if (!specifier.startsWith(".")) continue;
      queue.push(resolve(dirname(file), specifier));
    }
  }
  return seen;
}

/** Local script files a script body runs, so their sources can be walked. */
export function scriptEntries(body) {
  return [...body.matchAll(/(?:^|[\s"'])((?:scripts|deploy|packages|apps)\/[A-Za-z0-9._/-]+\.(?:mjs|js|cjs))/gu)]
    .map((match) => match[1]);
}

/**
 * Everything a step reads that lives under the output directory, with the file
 * that reads it, so a failure names a place to go rather than a verdict.
 */
export function outputReads(body, root = REPO_ROOT) {
  const needle = new RegExp(`(?:^|["'\`\\s(/])${OUTPUT_DIR}/`, "u");
  const hits = [];
  if (needle.test(body)) hits.push({ file: "<script body>", reason: `body references ${OUTPUT_DIR}/` });
  for (const entry of scriptEntries(body)) {
    for (const file of moduleGraph(entry, root)) {
      const source = readFileSync(join(root, file), "utf8");
      for (const [index, line] of source.split("\n").entries()) {
        if (needle.test(line)) {
          hits.push({ file, reason: `line ${index + 1}: ${line.trim().slice(0, 120)}` });
          break;
        }
      }
    }
  }
  return hits;
}

/**
 * Steps that read the output directory before anything has written it.
 *
 * The emitting step itself is not judged: whatever it reads, it reads after its
 * own compile. `firstEmitIndex` of -1 means the chain never builds at all, in
 * which case every output read is unsatisfied and all of them are reported.
 */
export function unbuiltOutputReads(scripts, verifyName = "verify", root = REPO_ROOT) {
  const chain = verifyChain(scripts[verifyName] ?? "");
  const bodyOf = (step) => (step.kind === "script" ? scripts[step.name] ?? "" : step.text);
  const firstEmitIndex = chain.findIndex((step) => emitsOutput(bodyOf(step)));
  const limit = firstEmitIndex === -1 ? chain.length : firstEmitIndex;
  const violations = [];
  for (const [index, step] of chain.entries()) {
    if (index >= limit) break;
    const label = step.kind === "script" ? step.name : step.text;
    for (const hit of outputReads(bodyOf(step), root)) {
      violations.push({ step: label, position: index, ...hit });
    }
  }
  return { chain, firstEmitIndex, violations };
}
