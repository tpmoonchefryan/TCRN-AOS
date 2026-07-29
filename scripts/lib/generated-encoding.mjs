// Generated-artifact encoding: no chain-derived product may carry U+FFFD.
//
// TCRN-AOS-INC-039. `apps/web/src/cockpit-data.generated.ts` shipped five
// replacement characters, and two Chinese words were silently wrong in the
// cockpit for it: 「评论与立场双轨」 read 「评论与<?><?><?>场双轨」 and
// 「注定推倒的墙被驳倒」 read 「注定推倒的墙<?><?>驳倒」.
//
// The cause was upstream and is fixed (commit 8500646: the chain client now
// decodes stdout through `node:string_decoder`, which holds an incomplete
// trailing sequence back instead of decoding it, so a 3-byte character split
// across Node's 64 KiB pipe boundary survives). But the fix only protects
// artifacts generated AFTER it. Nothing was watching the artifacts themselves,
// so a client regression — or a generator that acquires bytes some other way —
// would put the same corruption back with nobody noticing until a human read
// the Chinese.
//
// U+FFFD is the right predicate precisely because it is never legitimate
// content here: every artifact in scope is machine-written from UTF-8 sources,
// so a replacement character in one always means bytes were mangled on the way
// in. It is a *lossy* corruption — the original character is gone — which is
// why this has to be caught at generation time rather than repaired later.
//
// Scope is chain-derived generated products, NOT the repository: at least one
// hand-written test (`packages/projection/test/event-paging.test.mjs`) uses a
// literal replacement character on purpose, as the fixture proving the naive
// per-chunk decode corrupts a straddling character. A repo-wide sweep would
// have to whitelist the very test that proves the bug, which is the wrong
// shape: the gate guards what generators WRITE, not what people TYPE.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");

/** The replacement character, written as an escape so this file never holds one. */
export const REPLACEMENT_CHARACTER = "\uFFFD";

/**
 * What the gate reads.
 *
 * `file` entries are single generated modules. `tree` entries are directories
 * walked for the listed extensions — evidence receipts are in scope because
 * they are written by the same proof scripts, from the same chain reads,
 * through the same client.
 */
export const GENERATED_ARTIFACT_SOURCES = Object.freeze([
  {
    id: "cockpit-data",
    kind: "file",
    path: "apps/web/src/cockpit-data.generated.ts",
    writtenBy: "scripts/build-cockpit-data.mjs"
  },
  {
    id: "evidence",
    kind: "tree",
    path: "evidence",
    extensions: Object.freeze([".json", ".md"]),
    writtenBy: "the proof scripts under scripts/"
  }
]);

/**
 * Every replacement character in `text`, with the line and column it sits on.
 *
 * Line and column are 1-based and counted in characters, so a failure names a
 * place a person can open the file to rather than a byte offset.
 */
export function findReplacementCharacters(text) {
  const hits = [];
  const lines = text.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    let at = -1;
    while ((at = line.indexOf(REPLACEMENT_CHARACTER, at + 1)) !== -1) {
      hits.push({
        line: index + 1,
        column: at + 1,
        // Context around the hit, so the failure shows the mangled word rather
        // than only its coordinates.
        sample: line.slice(Math.max(0, at - 24), at + 25)
      });
    }
  }
  return hits;
}

/**
 * Every generated artifact in scope, repo-relative and sorted.
 *
 * Read from the filesystem, not from `git ls-files`: a freshly regenerated
 * artifact that has not been staged yet is exactly the file this gate exists to
 * see, and an index-derived list is blind to it by construction.
 */
export function listGeneratedArtifacts(sources = GENERATED_ARTIFACT_SOURCES, root = REPO_ROOT) {
  const found = [];
  for (const source of sources) {
    const full = join(root, source.path);
    if (source.kind === "file") {
      // A missing artifact is a fact the caller must see, not one to skip over.
      statSync(full);
      found.push(relative(root, full));
      continue;
    }
    const walk = (directory) => {
      for (const name of readdirSync(directory).sort()) {
        const entry = join(directory, name);
        if (statSync(entry).isDirectory()) { walk(entry); continue; }
        if (source.extensions.some((extension) => name.endsWith(extension))) {
          found.push(relative(root, entry));
        }
      }
    };
    walk(full);
  }
  return found.sort();
}

/** Per-file findings over every generated artifact in scope. */
export function scanGeneratedArtifacts(sources = GENERATED_ARTIFACT_SOURCES, root = REPO_ROOT) {
  return listGeneratedArtifacts(sources, root)
    .map((path) => ({ path, hits: findReplacementCharacters(readFileSync(join(root, path), "utf8")) }))
    .filter((entry) => entry.hits.length > 0);
}
