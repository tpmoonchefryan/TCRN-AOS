// Evidence hygiene: no artifact in evidence/ may carry a path off this machine.
//
// TCRN-AOS-INC-037. Two receipts (evidence/aos-domain-backup.json and
// evidence/aos-paired-backup.json) shipped this laptop's home directory and the
// platform root inside them. That is the exact class of drift the platform paid
// for once already: making TCRN-AOS public required rewriting 93 commits and
// four blobs to strip home-directory paths out of history. Nothing was watching
// for it here, which is why it came back.
//
// This module is BOTH sides of that:
//   - `scrubHostPaths` is what the emitters call before writing a receipt, so
//     new evidence is born clean;
//   - `scanEvidenceTree` is what the test gate calls, so evidence that got in
//     some other way is caught.
// One file, so the shape a path is scrubbed INTO can never drift from the shape
// the scanner looks FOR.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");

/** File kinds the gate reads. Anything else in evidence/ is bytes, not prose. */
export const SCANNED_EXTENSIONS = Object.freeze([".json", ".md"]);

/**
 * What a path off this machine looks like.
 *
 * Ordered: the platform root is matched before the bare home directory, so
 * `/Users/x/Code/TCRN Platform/...` scrubs to one placeholder rather than to a
 * placeholder with the platform tail still hanging off it.
 *
 * `detectOnly` entries have no rewrite: they catch a host shape this scrubber
 * cannot safely rewrite (a platform root reached through some other mount, say).
 * The gate goes red and a person decides — never a silent pass.
 */
export const HOST_PATH_RULES = Object.freeze([
  {
    id: "platform-root",
    pattern: /\/Users\/[^/"'\s\\]+\/Code\/TCRN Platform/gu,
    placeholder: "<local-platform-root>"
  },
  {
    id: "home-directory",
    pattern: /\/Users\/[^/"'\s\\]+/gu,
    placeholder: "<local-home>"
  },
  {
    id: "private-tmp",
    pattern: /\/private\/tmp/gu,
    placeholder: "<local-private-tmp>"
  },
  {
    id: "var-folders",
    pattern: /(?:\/private)?\/var\/folders\/[^"'\s\\]*/gu,
    placeholder: "<local-var-folders>"
  },
  {
    id: "platform-root-foreign-mount",
    pattern: /\/Code\/TCRN Platform/gu,
    detectOnly: true
  }
]);

/** Every host-path hit in `text`, with the line it sits on. */
export function findHostPaths(text) {
  const hits = [];
  for (const rule of HOST_PATH_RULES) {
    for (const match of text.matchAll(rule.pattern)) {
      hits.push({
        rule: rule.id,
        sample: match[0].slice(0, 120),
        line: text.slice(0, match.index).split("\n").length
      });
    }
  }
  return hits;
}

/** One string, host paths replaced by their placeholders. */
export function scrubHostPathsInText(text) {
  let out = text;
  for (const rule of HOST_PATH_RULES) {
    if (rule.detectOnly) continue;
    out = out.replace(rule.pattern, rule.placeholder);
  }
  return out;
}

/**
 * Deep copy of a JSON-shaped value with host paths scrubbed out of its strings.
 *
 * Only strings are touched, and inside a string only the machine-specific
 * prefix: a digest, a count, a reason code and a timestamp all come out of here
 * byte-identical. Scrubbing must never be able to change what a receipt claims,
 * only where the claim was made.
 */
export function scrubHostPaths(value) {
  if (typeof value === "string") return scrubHostPathsInText(value);
  if (Array.isArray(value)) return value.map(scrubHostPaths);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [scrubHostPathsInText(key), scrubHostPaths(entry)]));
  }
  return value;
}

/** Every scannable file under `root`, repo-relative, sorted. */
export function listEvidenceFiles(root = join(REPO_ROOT, "evidence")) {
  const found = [];
  const walk = (directory) => {
    for (const name of readdirSync(directory).sort()) {
      const full = join(directory, name);
      if (statSync(full).isDirectory()) { walk(full); continue; }
      if (SCANNED_EXTENSIONS.some((extension) => name.endsWith(extension))) {
        found.push(relative(REPO_ROOT, full));
      }
    }
  };
  walk(root);
  return found;
}

/**
 * Which evidence paths git tracks.
 *
 * Read from git rather than from the filesystem because "tracked" is the whole
 * question an exception below turns on, and only git can answer it. A failure
 * to ask is fatal on purpose: an exception that cannot be checked is an
 * exception that does not hold.
 */
export function trackedEvidencePaths(cwd = REPO_ROOT) {
  const raw = execFileSync("git", ["ls-files", "-z", "--", "evidence"], { cwd, encoding: "utf8" });
  return new Set(raw.split("\0").filter((entry) => entry.length > 0));
}

/** Per-file findings over the whole evidence tree. */
export function scanEvidenceTree(root = join(REPO_ROOT, "evidence")) {
  return listEvidenceFiles(root)
    .map((path) => ({ path, hits: findHostPaths(readFileSync(join(REPO_ROOT, path), "utf8")) }))
    .filter((entry) => entry.hits.length > 0);
}
