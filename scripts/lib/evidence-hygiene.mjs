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
 *
 * `rehydratesTo` is a concrete host path of this shape that scrubs back to
 * exactly this rule's placeholder and nothing else. It exists so the gate can
 * run redaction *backwards* — turn a committed receipt into the receipt as it
 * would have looked before redaction — and then assert that scrubbing it
 * forwards reproduces the committed bytes. That is how "redaction may change a
 * path and nothing else" is checked against the real receipts without pinning
 * any of their values (TCRN-AOS-INC-042). It lives here rather than in the test
 * for the same reason the scanner does: the shape scrubbed INTO must never
 * drift from the shape rehydrated FROM. A rule whose pattern consumes an
 * unbounded tail (var-folders) has no `rehydratesTo`, because its placeholder
 * does not carry enough information to reconstruct one; such a placeholder is
 * refused rather than round-tripped wrongly.
 */
export const HOST_PATH_RULES = Object.freeze([
  {
    id: "platform-root",
    pattern: /\/Users\/[^/"'\s\\]+\/Code\/TCRN Platform/gu,
    placeholder: "<local-platform-root>",
    rehydratesTo: "/Users/someone/Code/TCRN Platform"
  },
  {
    id: "home-directory",
    pattern: /\/Users\/[^/"'\s\\]+/gu,
    placeholder: "<local-home>",
    rehydratesTo: "/Users/someone"
  },
  {
    id: "private-tmp",
    pattern: /\/private\/tmp/gu,
    placeholder: "<local-private-tmp>",
    rehydratesTo: "/private/tmp"
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
  },
  {
    /**
     * The home directory with its separators replaced by dashes.
     *
     * Found by TCRN-AOS-STORY-133, which emitted a receipt naming a scratch address
     * under a Claude Code session directory: those are named after the project path
     * with `/` rewritten to `-`, so the operator's home directory arrives as
     * `-Users-<name>-Code-TCRN-Platform`. Every rule above looks for a `/Users/`
     * shape, so the whole file passed the gate while carrying the account name. The
     * lesson is not the dash — it is that this gate only ever caught the ONE encoding
     * it was written against, and the scrubber's green said nothing about the others.
     *
     * `detectOnly`, because there is no safe rewrite: the dashes are ambiguous (a
     * directory may legitimately contain one), so this cannot be un-mangled back into
     * a path and the placeholder would be a guess. A person decides — which for an
     * emitter means reporting the shape rather than the address, the way
     * deploy/aos-local-client/red-proof.mjs reports `<scratch>/…`.
     */
    id: "home-directory-dash-encoded",
    pattern: /-Users-[A-Za-z0-9_.]+/gu,
    detectOnly: true
  }
]);

/** Every `<local-…>` placeholder occurring in `text`, de-duplicated and sorted. */
export function findPlaceholders(text) {
  return [...new Set(text.match(/<local-[a-z-]+>/gu) ?? [])].sort();
}

/**
 * Redaction run backwards: every placeholder replaced by a concrete host path
 * of the shape it stands for. Used only to test the forward direction — no
 * artifact is ever written from this.
 *
 * Throws on a placeholder no rule can reconstruct, so an un-round-trippable
 * shape fails loudly instead of silently weakening the check built on it.
 */
export function rehydrateHostPathsInText(text) {
  for (const placeholder of findPlaceholders(text)) {
    const rule = HOST_PATH_RULES.find((entry) => entry.placeholder === placeholder && entry.rehydratesTo);
    if (!rule) throw new Error(`no rule can rehydrate ${placeholder}`);
    text = text.split(placeholder).join(rule.rehydratesTo);
  }
  return text;
}

/** `rehydrateHostPathsInText` over a JSON-shaped value, mirroring `scrubHostPaths`. */
export function rehydrateHostPaths(value) {
  if (typeof value === "string") return rehydrateHostPathsInText(value);
  if (Array.isArray(value)) return value.map(rehydrateHostPaths);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [rehydrateHostPathsInText(key), rehydrateHostPaths(entry)]));
  }
  return value;
}

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

/** How a pending entry declares whether its material should be found here. */
export const PRESENCE_MODES = Object.freeze(["expected", "machine-local"]);

/**
 * Every way a pending exception can fail its closure conditions.
 *
 * Pure, and driven by injected probes, because the conditions have to hold in
 * worlds this working copy is not in. The defect that forced the split was
 * exactly that: two of the conditions — "the path must exist" and "nothing under
 * it may be tracked" — are jointly unsatisfiable in a fresh checkout, since an
 * untracked path is by definition absent there. So while any entry was listed,
 * the clean-checkout run that the delivery-cadence convention makes the closing
 * gate could never go green, and the only reason nobody hit it is that the gate
 * had only ever been run in a working tree that had the material.
 *
 * `presence: "machine-local"` is the narrow, declared exemption: material that
 * is by design never committed and so is absent everywhere else. It exempts the
 * existence condition and nothing else. `"expected"` stays the default, so an
 * entry that says nothing is still held to the strict rule.
 *
 * Note which condition survives unconditionally: trackedness. `git ls-files`
 * answers from the index, not the filesystem, so "has this entered history"
 * remains checkable on a checkout that does not have the file — and that is the
 * condition the whole exception turns on.
 */
export function pendingClosureViolations(entries, probes) {
  const { exists, trackedUnder, carriesHostPath } = probes;
  const violations = [];
  const fail = (path, condition, detail) => violations.push({ path, condition, detail });
  for (const entry of entries) {
    const { path, reason } = entry;
    const presence = entry.presence ?? "expected";
    if (typeof reason !== "string" || reason.trim().length === 0) {
      fail(path, "reason", "needs a non-empty reason");
    }
    if (!PRESENCE_MODES.includes(presence)) {
      fail(path, "presence", `unknown presence ${JSON.stringify(presence)}; expected one of ${PRESENCE_MODES.join(", ")}`);
    }
    const tracked = trackedUnder(path);
    if (tracked.length > 0) {
      fail(path, "untracked", `tracked by git (${tracked.join(", ")}) — redact it instead of listing it as pending`);
    }
    const present = exists(path);
    if (!present) {
      if (presence === "expected") {
        fail(path, "exists", "listed as pending but does not exist — remove the stale entry, or declare presence: \"machine-local\"");
      }
      continue;
    }
    // Present here, so the live conditions are answerable and both apply
    // regardless of presence mode. This is the branch that catches an exception
    // whose reason has evaporated, and it can only ever run on the machine that
    // holds the material — which is the honest scope for that check.
    if (!carriesHostPath(path)) {
      fail(path, "still-needed", "no longer carries any host path — delete the exception");
    }
  }
  return violations;
}
