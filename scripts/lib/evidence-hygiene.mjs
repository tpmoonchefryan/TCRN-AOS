// Evidence hygiene: no artifact this repository publishes may carry a path off
// this machine.
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
//   - `scanGuardedFiles` is what the test gate calls, so evidence that got in
//     some other way is caught.
// One file, so the shape a path is scrubbed INTO can never drift from the shape
// the scanner looks FOR.
//
// The scanner's SCOPE is the second thing that can drift, and it did.
// TCRN-CROSS-INC-034 moved INIT-018's 154 evidence files out of evidence/ and
// into docs/reports/init-018/. The gate's scope was the hardcoded string
// "evidence", so it kept reading an emptier and emptier tree while ~40 files
// carrying host paths sat one directory over, unignored and one `git add` away
// from a public repository — and the suite stayed green throughout. A gate keyed
// to a directory NAME loses to `mv`. `listGuardedFiles` below is therefore keyed
// to where guarded bytes can actually be, not to where they were in July.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
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

/** Whether the gate reads this path at all. A question about kind, not place. */
export function isScannablePath(path) {
  return SCANNED_EXTENSIONS.some((extension) => path.endsWith(extension));
}

/** Every scannable file under `root`, repo-relative, sorted. */
export function listEvidenceFiles(root = join(REPO_ROOT, "evidence"), repoRoot = REPO_ROOT) {
  const found = [];
  const walk = (directory) => {
    for (const name of readdirSync(directory).sort()) {
      const full = join(directory, name);
      if (statSync(full).isDirectory()) { walk(full); continue; }
      if (isScannablePath(name)) found.push(relative(repoRoot, full));
    }
  };
  walk(root);
  return found;
}

/**
 * Every path git has in its index, repo-relative and sorted.
 *
 * Read from git rather than from the filesystem because "tracked" is the whole
 * question both the scope below and the pending exceptions turn on, and only git
 * can answer it. A failure to ask is fatal on purpose: a condition that cannot
 * be checked is a condition that does not hold.
 *
 * The pathspec is the whole repository. It used to be `evidence`, which quietly
 * made the trackedness condition unfalsifiable for any path outside that
 * directory: `trackedUnder("docs/reports/x")` returned empty however thoroughly
 * git tracked it. `--full-name` so the answer does not depend on the directory
 * the call was made from.
 */
export function trackedPaths(cwd = REPO_ROOT) {
  const raw = execFileSync("git", ["ls-files", "-z", "--full-name", "--", "."], { cwd, encoding: "utf8" });
  return raw.split("\0").filter((entry) => entry.length > 0).sort();
}

/**
 * Every file the gate reads — the union of the two places guarded bytes live,
 * each read the way that place can honestly be read.
 *
 *   1. The working tree under evidence/, tracked or not. An artifact written
 *      into evidence/ and not yet added is exactly the file this gate must see,
 *      and an index-derived list is blind to it by construction.
 *
 *   2. Every git-tracked scannable file, ANYWHERE in the repository. This is the
 *      half that survives a move: it does not name docs/reports/, it names
 *      "whatever this repository is about to publish", so the next INC-034 does
 *      not walk out from under it.
 *
 * Why (2) is index-derived when (1) is not — this is the load-bearing choice.
 * Reading (2) from the working tree instead would be strictly stronger and it
 * was measured: it is RED TODAY, 42 files and 488 hits under docs/reports/
 * init-018/ alone. A gate that is red on the day it is written does not get
 * obeyed, it gets switched off, and the platform has the scar tissue to prove it
 * ("a gate's predicate must be satisfiable in every world it will be evaluated
 * in" — the pending list below exists because v1 of it was not). Tracked-only is
 * green today and turns red the instant somebody `git add`s such a file, which
 * is the last moment before the bytes can reach history — and history is what
 * the hygiene obligation was always about. `git ls-files` answers from the
 * index, so a staged-but-uncommitted file is already listed (verified against a
 * throwaway repository, TCRN-CROSS-INC-034 follow-up); the gate fires between
 * `add` and `commit`, not after.
 *
 * The redaction backlog under docs/reports/ is a separate ticket. This function
 * is the thing that will notice if anyone tries to commit it unredacted.
 *
 * Note what scope is doing here that the detector cannot. `/Users/<you>/…`,
 * `/Users/$USER/…` and `/Users/someone/…` are deliberate test fixtures — the
 * corpus deploy/aos-local-client/parity-proof.mjs checks itself against — and
 * `findHostPaths` flags all three, as it must: `/Users/someone` is the
 * home-directory rule's own `rehydratesTo` example, which a test requires to be
 * detected. So the fixtures are kept out of the gate by not being IN SCOPE
 * (`.mjs` is not a scanned kind), never by teaching the detector to look away.
 * Widening SCANNED_EXTENSIONS is therefore not a free improvement; it must be
 * measured against that corpus first.
 */
export function listGuardedFiles({
  repoRoot = REPO_ROOT,
  evidenceRoot = join(repoRoot, "evidence"),
  tracked
} = {}) {
  const indexed = tracked ?? trackedPaths(repoRoot);
  const files = new Set(indexed.filter(isScannablePath));
  for (const path of listEvidenceFiles(evidenceRoot, repoRoot)) files.add(path);
  return [...files].sort();
}

/**
 * Per-file findings over every guarded file.
 *
 * A tracked path with no file behind it (deleted in the working tree, deletion
 * not staged) is skipped rather than fatal: there are no bytes here to inspect.
 * The residue is that a leak living only in a staged blob whose working-tree
 * copy was deleted goes unseen — narrow, and named here rather than left to be
 * discovered.
 */
export function scanGuardedFiles(options = {}) {
  const repoRoot = options.repoRoot ?? REPO_ROOT;
  return listGuardedFiles({ ...options, repoRoot })
    .filter((path) => existsSync(join(repoRoot, path)))
    .map((path) => ({ path, hits: findHostPaths(readFileSync(join(repoRoot, path), "utf8")) }))
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
