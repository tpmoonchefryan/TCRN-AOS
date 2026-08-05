#!/usr/bin/env node
// TCRN-AOS-INC-033 — every real control tree must be covered by a host-level deny rule.
//
//   node scripts/control-tree-guard-proof.mjs [--json] [--all-session-roots]
//
// WHAT THIS JUDGES. STORY-139 installed `Write/Edit(**/.tcrn-workflow/**)` and
// `(**/.tcrn-workspace/**)` into the five repositories' `.claude/settings.json`.
// Those five repositories contain zero control trees: every control tree on this
// machine lives either under the platform root's `.tcrn-workspace/` container or
// under `~/.tcrn-workflow`, both OUTSIDE every repository. So the rules were
// installed in a world with nothing to protect, and the governance session — which
// runs at the platform root — was never covered. This script is the machine reading
// of the property STORY-139 claimed: FOR EVERY control tree that actually exists on
// this disk, SOME settings file that a session would load carries a deny rule whose
// pattern matches the bytes inside it.
//
// WHY THE ROSTER IS ENUMERATED AND NOT WRITTEN DOWN. A hand-written roster proves
// nothing about a new partition, a new shadow chain, or a tree somebody moved: it
// would answer with yesterday's list and never say so. The roster here is built by
// three independent observations, because each is blind to something the others see:
//
//   IDENTITY   every `.tcrn-workflow` directory found by walking the platform root —
//              the trees themselves, wherever they sit;
//   CONTAINER  every immediate child of the platform root's `.tcrn-workspace/` —
//              catches a partition directory whose chain is not materialised
//              (`release-trust` holds a gate authority file and no `.tcrn-workflow`),
//              which the identity walk is structurally blind to;
//   HOME       `~/.tcrn-workflow` — the installed engine copy, the skill archive and
//              the bootstrap state, which no walk of the platform root can reach.
//
// An empty roster is RED, not green. "For every control tree ..." over an empty set
// is vacuously true, and a gate that passes because it found nothing to check is the
// exact failure this platform keeps shipping.
//
// BOTH SIDES MOVE. The judgement is a pure function of (roster, deny rules), and both
// inputs have a probe entry so a red can be produced without editing live settings:
//
//   CONTROL_TREE_GUARD_SETTINGS      ':'-separated settings files REPLACING discovery.
//                                    Point it at the five repositories' files to replay
//                                    the pre-INC-033 world; point it at a copy of the
//                                    platform settings with one rule deleted to show the
//                                    judgement is sensitive per rule, not just globally.
//   CONTROL_TREE_GUARD_EXTRA_TREES   ':'-separated extra roots APPENDED to the roster,
//                                    so an uncovered tree turns the same run red.
//   CONTROL_TREE_GUARD_PLATFORM_ROOT override the platform root.
//   CONTROL_TREE_GUARD_HOME          override the home directory.
//
// Both probes feed the same predicate through the same code path — the red side runs
// the judgement, never a copy of it.
//
// WHY THE MATCHER IS COMPILED HERE AND SELF-TESTED. The host's own matcher is not
// reachable from a script, so this file compiles the glob itself, and a matcher that
// silently mis-answers would make every reading — green or red — worthless. So the
// compiler runs an adversarial corpus first and the whole run fails if any sample
// disagrees. Every pattern is evaluated under TWO semantics:
//
//   STRICT      `*` and `**` refuse to match a path component beginning with `.`
//               (picomatch / minimatch default, `dot: false`);
//   PERMISSIVE  they match it (gitignore's own behaviour, which the Claude Code
//               permission documentation names as the specification it follows).
//
// Which one the host uses could not be established from inside a session, so coverage
// is REQUIRED under STRICT and merely REPORTED under PERMISSIVE. Being wrong in the
// conservative direction costs a few redundant rules; being wrong in the other
// direction costs the deepest paths in the tree, which are the governed bytes.
//
// WHAT THIS RUN DOES NOT PROVE. Permission rules are snapshotted when a session
// starts, so no in-session run can demonstrate the host actually refusing a write —
// and manufacturing that demonstration would mean aiming a real write at a real
// control tree. This is a static coverage proof over settings bytes and disk bytes.
// The live confirmation belongs to the next session that starts at the platform root.
import { readFileSync, readdirSync, realpathSync, statSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const AOS_ROOT = resolve(SCRIPT_DIR, "..");

const HOME = process.env.CONTROL_TREE_GUARD_HOME || homedir();
const PLATFORM_ROOT = process.env.CONTROL_TREE_GUARD_PLATFORM_ROOT || resolve(AOS_ROOT, "..");

// Tools whose deny rule must cover every control tree. Both are required: they are
// separate rule namespaces in the host, and a tree covered for `Write` but not `Edit`
// is a tree an editor tool can still reach.
const REQUIRED_TOOLS = ["Write", "Edit"];
const FILE_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);

const WALK_MAX_DEPTH = 12;
const WALK_MAX_FILES = 8000;
const SKIP_DIR_NAMES = new Set(["node_modules", ".git", ".pnpm-store", "dist", ".DS_Store"]);

// ---------------------------------------------------------------------------
// glob compilation
// ---------------------------------------------------------------------------

function escapeLiteral(ch) {
  return /[.*+?^${}()|[\]\\]/.test(ch) ? `\\${ch}` : ch;
}

// Compile a gitignore-style glob (already resolved to an absolute path pattern) into
// a RegExp anchored at both ends. `dot` selects the two semantics described above.
export function globToRegExp(glob, { dot } = { dot: false }) {
  let out = "";
  let i = 0;
  // A wildcard is "at a segment start" when the previous emitted character was a
  // separator or the pattern begins here; only then does the leading-dot guard apply.
  let atSegmentStart = true;
  while (i < glob.length) {
    const ch = glob[i];
    if (ch === "*") {
      const isDouble = glob[i + 1] === "*";
      if (isDouble) {
        const followedBySlash = glob[i + 2] === "/";
        if (followedBySlash) {
          // `**/` — zero or more whole path components.
          out += dot ? "(?:[^/]+/)*" : "(?:(?![.])[^/]+/)*";
          i += 3;
          atSegmentStart = true;
          continue;
        }
        // `**` — one or more components, to the end of what it covers.
        out += dot
          ? "[^/]+(?:/[^/]+)*"
          : "(?![.])[^/]+(?:/(?![.])[^/]+)*";
        i += 2;
        atSegmentStart = false;
        continue;
      }
      // single `*` — within one component.
      out += !dot && atSegmentStart ? "(?![.])[^/]*" : "[^/]*";
      i += 1;
      atSegmentStart = false;
      continue;
    }
    if (ch === "?") {
      out += !dot && atSegmentStart ? "(?![.])[^/]" : "[^/]";
      i += 1;
      atSegmentStart = false;
      continue;
    }
    out += escapeLiteral(ch);
    atSegmentStart = ch === "/";
    i += 1;
  }
  return new RegExp(`^${out}$`);
}

export function globMatches(glob, path, opts) {
  return globToRegExp(glob, opts).test(path);
}

// The adversarial corpus. Every sample is a claim the judgement leans on somewhere:
// depth crossing, the leading-dot split, literal spaces in the platform root, and the
// non-matches that keep the matcher from being a function that says yes.
const MATCHER_CORPUS = [
  // [pattern, path, expectStrict, expectPermissive]
  ["/a/b/**", "/a/b/c.json", true, true],
  ["/a/b/**", "/a/b/c/d/e.json", true, true],
  ["/a/b/**", "/a/b", false, false],
  ["/a/b/**", "/a/bc/d.json", false, false],
  ["/a/b/**", "/x/a/b/c.json", false, false],
  // leading-dot split: the whole reason coverage is required under STRICT
  ["/a/**", "/a/.hidden/x.json", false, true],
  ["/a/**", "/a/b/.hidden.json", false, true],
  ["/a/.*", "/a/.hidden.json", true, true],
  ["/a/.*", "/a/plain.json", false, false],
  ["/a/.*/**", "/a/.hidden/x.json", true, true],
  ["/a/**/.*", "/a/b/.hidden.json", true, true],
  ["/a/**/.*/**", "/a/b/.hidden/c.json", true, true],
  // `**/` legitimately crosses zero components, so this one is a MATCH under both
  // semantics. The corpus asserted `false` here on first writing and the self-test
  // refused the run — which is the only reason the matcher is worth leaning on.
  ["/a/**/.*/**", "/a/.hidden/c.json", true, true],
  // a genuine dot-crossing refusal: the trailing `**` may not enter `.deep`
  ["/a/**/.*/**", "/a/.hidden/.deep/x.json", false, true],
  // `**/` crossing zero components
  ["/root/**/.x/**", "/root/.x/f.json", true, true],
  ["/root/**/.x/**", "/root/p/q/.x/f.json", true, true],
  ["/root/**/.x/**", "/other/.x/f.json", false, false],
  // single star stays inside one component
  ["/a/*", "/a/b", true, true],
  ["/a/*", "/a/b/c", false, false],
  ["/a/*.json", "/a/x.json", true, true],
  ["/a/*.json", "/a/x.txt", false, false],
  ["/a/*", "/a/.dot", false, true],
  // literal space, as in "TCRN Platform"
  ["/p q/.w/**", "/p q/.w/z.json", true, true],
  ["/p q/.w/**", "/pq/.w/z.json", false, false],
];

function selfTestMatcher() {
  const failures = [];
  for (const [pattern, path, expectStrict, expectPermissive] of MATCHER_CORPUS) {
    const gotStrict = globMatches(pattern, path, { dot: false });
    const gotPermissive = globMatches(pattern, path, { dot: true });
    if (gotStrict !== expectStrict) {
      failures.push({ pattern, path, semantics: "strict", expected: expectStrict, got: gotStrict });
    }
    if (gotPermissive !== expectPermissive) {
      failures.push({ pattern, path, semantics: "permissive", expected: expectPermissive, got: gotPermissive });
    }
  }
  return { samples: MATCHER_CORPUS.length, failures };
}

// ---------------------------------------------------------------------------
// inputs: the roster of control trees
// ---------------------------------------------------------------------------

function splitPathList(value) {
  if (!value) return [];
  return value
    .split(":")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => (entry.startsWith("~/") ? join(HOME, entry.slice(2)) : entry));
}

function isDirectory(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function safeReal(path) {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
}

// Walk for directories named `.tcrn-workflow` — the identity observation.
function findControlTreeDirs(root, maxDepth) {
  const found = [];
  const walk = (dir, depth) => {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      const child = join(dir, entry.name);
      if (entry.name === ".tcrn-workflow") {
        found.push(child);
        continue; // the tree itself is the unit; do not descend into it
      }
      if (SKIP_DIR_NAMES.has(entry.name)) continue;
      walk(child, depth + 1);
    }
  };
  walk(root, 0);
  return found;
}

function buildRoster() {
  const container = join(PLATFORM_ROOT, ".tcrn-workspace");
  const entries = [];
  const push = (path, origin) => {
    if (!isDirectory(path)) return;
    entries.push({ path: safeReal(path), declaredPath: path, origin });
  };

  if (isDirectory(container)) {
    push(container, "container-root");
    let children = [];
    try {
      children = readdirSync(container, { withFileTypes: true });
    } catch {
      children = [];
    }
    for (const child of children.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!child.isDirectory()) continue;
      push(join(container, child.name), "container-child");
    }
  }

  for (const dir of findControlTreeDirs(PLATFORM_ROOT, 8).sort()) {
    push(dir, "identity-walk");
  }

  push(join(HOME, ".tcrn-workflow"), "home");

  for (const extra of splitPathList(process.env.CONTROL_TREE_GUARD_EXTRA_TREES)) {
    entries.push({ path: resolve(extra), declaredPath: extra, origin: "probe:extra-trees" });
  }

  // dedupe on resolved path, first origin wins
  const seen = new Map();
  for (const entry of entries) {
    if (!seen.has(entry.path)) seen.set(entry.path, entry);
  }
  return [...seen.values()];
}

// Probe paths for a tree: real bytes first (a claim about what is actually on disk),
// then synthetic paths at three depths so a shallow rule such as `T/*` cannot pass as
// full coverage of a tree that happens to be flat today.
function probePathsFor(treePath) {
  const real = [];
  let truncated = false;
  const walk = (dir, depth) => {
    if (truncated || depth > WALK_MAX_DEPTH) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (real.length >= WALK_MAX_FILES) {
        truncated = true;
        return;
      }
      const child = join(dir, entry.name);
      if (entry.isDirectory() && !entry.isSymbolicLink()) {
        walk(child, depth + 1);
      } else if (entry.isFile()) {
        real.push(child);
      }
    }
  };
  walk(treePath, 0);

  const depthOf = (p) => p.split(sep).length;
  const sorted = [...real].sort((a, b) => depthOf(a) - depthOf(b) || a.localeCompare(b));
  // Probes whose path carries a dot-leading component BELOW the tree root — the
  // segments a `*`/`**` refuses to cross under STRICT semantics, and therefore the
  // ones a rule set that only spells `T/**` will fail to cover.
  const dotted = sorted.filter((p) => p
    .slice(treePath.length)
    .split(sep)
    .some((seg) => seg.startsWith(".") && seg.length > 1));

  const picked = new Set();
  for (const p of sorted.slice(0, 3)) picked.add(p);
  for (const p of sorted.slice(-3)) picked.add(p);
  for (const p of dotted.slice(0, 2)) picked.add(p);
  for (const p of dotted.slice(-2)) picked.add(p);

  const synthetic = [
    join(treePath, "__probe__.json"),
    join(treePath, "a", "__probe__.json"),
    join(treePath, "a", "b", "c", "d", "__probe__.json"),
  ];
  for (const p of synthetic) picked.add(p);

  return { probes: [...picked].sort(), realCount: real.length, truncated };
}

// ---------------------------------------------------------------------------
// inputs: the deny rules a session would load
// ---------------------------------------------------------------------------

const RULE_RE = /^([A-Za-z]+)\((.*)\)$/s;

// The synthetic root used when CONTROL_TREE_GUARD_SETTINGS supplies the sources: the
// caller has named exactly which files make up the world, so every one of them applies.
const ANY_ROOT = " override-world";

function projectRootForSettings(file) {
  const dir = dirname(file);
  return basename(dir) === ".claude" ? dirname(dir) : dir;
}

// Resolve a rule pattern to an absolute path pattern, per the four documented forms.
// `scope: "user"` settings deliberately contribute only the anchoring-free forms:
// where a relative pattern in user settings resolves could not be established, and a
// coverage claim that rests on a guess is a false green.
function resolvePattern(pattern, settingsFile, scope) {
  if (pattern.startsWith("//")) return { pattern: pattern.slice(1), form: "absolute" };
  if (pattern.startsWith("~/")) return { pattern: join(HOME, pattern.slice(2)), form: "home" };
  if (scope === "user") return { pattern: null, form: "relative-in-user-settings" };
  const root = projectRootForSettings(settingsFile);
  if (pattern.startsWith("/")) return { pattern: join(root, pattern.slice(1)), form: "settings-relative" };
  const bare = pattern.startsWith("./") ? pattern.slice(2) : pattern;
  return { pattern: join(root, bare), form: "project-relative" };
}

function discoverSettingsFiles() {
  const files = [];
  const add = (path, scope, sessionRoot) => {
    if (existsSync(path)) files.push({ path, scope, sessionRoot });
  };
  add(join(HOME, ".claude", "settings.json"), "user", null);
  add(join(HOME, ".claude", "settings.local.json"), "user", null);
  add(join(PLATFORM_ROOT, ".claude", "settings.json"), "project", PLATFORM_ROOT);
  add(join(PLATFORM_ROOT, ".claude", "settings.local.json"), "project", PLATFORM_ROOT);

  let children = [];
  try {
    children = readdirSync(PLATFORM_ROOT, { withFileTypes: true });
  } catch {
    children = [];
  }
  for (const child of children.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!child.isDirectory() || child.name.startsWith(".")) continue;
    const root = join(PLATFORM_ROOT, child.name);
    add(join(root, ".claude", "settings.json"), "project", root);
    add(join(root, ".claude", "settings.local.json"), "project", root);
  }
  return files;
}

function loadRules(settingsFiles) {
  const rules = [];
  const sources = [];
  for (const source of settingsFiles) {
    let parsed;
    let error = null;
    try {
      parsed = JSON.parse(readFileSync(source.path, "utf8"));
    } catch (err) {
      error = err.message;
      parsed = null;
    }
    const deny = Array.isArray(parsed?.permissions?.deny) ? parsed.permissions.deny : [];
    let kept = 0;
    for (const raw of deny) {
      const match = RULE_RE.exec(String(raw).trim());
      if (!match) continue;
      const [, tool, pattern] = match;
      if (!FILE_TOOLS.has(tool)) continue;
      const resolved = resolvePattern(pattern, source.path, source.scope);
      if (!resolved.pattern) continue;
      rules.push({
        tool,
        raw: String(raw),
        resolved: resolved.pattern,
        form: resolved.form,
        source: source.path,
        scope: source.scope,
        sessionRoot: source.sessionRoot,
      });
      kept += 1;
    }
    sources.push({ path: source.path, scope: source.scope, denyEntries: deny.length, fileRules: kept, error });
  }
  return { rules, sources };
}

// ---------------------------------------------------------------------------
// the judgement
// ---------------------------------------------------------------------------

// One session root at a time, and deliberately so. A session loads ONE project's
// settings, so a run that pools every repository's rules into a single set answers a
// question no session ever asks — and can only ever get greener as roots are added,
// which is a gate that cannot go red. The first draft of this file did exactly that
// and `--all-session-roots` passed; it is judged per root now.
function judgeSessionRoot(roster, rules, sessionRoot, probeCache) {
  const trees = [];
  for (const entry of roster) {
    const { probes, realCount, truncated } = probeCache.get(entry.path);
    const tools = {};
    for (const tool of REQUIRED_TOOLS) {
      const applicable = rules.filter(
        (rule) => rule.tool === tool
          && (rule.scope === "user" || sessionRoot === ANY_ROOT || rule.sessionRoot === sessionRoot),
      );
      const uncoveredStrict = [];
      const uncoveredPermissive = [];
      const matchedBy = new Set();
      for (const probe of probes) {
        const strictHit = applicable.find((rule) => globMatches(rule.resolved, probe, { dot: false }));
        const permissiveHit = applicable.find((rule) => globMatches(rule.resolved, probe, { dot: true }));
        if (strictHit) matchedBy.add(strictHit.raw);
        else uncoveredStrict.push(probe);
        if (!permissiveHit) uncoveredPermissive.push(probe);
      }
      tools[tool] = {
        coveredStrict: uncoveredStrict.length === 0,
        coveredPermissive: uncoveredPermissive.length === 0,
        uncoveredStrict: uncoveredStrict.slice(0, 5),
        uncoveredStrictCount: uncoveredStrict.length,
        uncoveredPermissiveCount: uncoveredPermissive.length,
        matchedBy: [...matchedBy].sort(),
      };
    }
    trees.push({
      path: entry.path,
      origin: entry.origin,
      probeCount: probes.length,
      realFileCount: realCount,
      walkTruncated: truncated,
      tools,
      covered: REQUIRED_TOOLS.every((tool) => tools[tool].coveredStrict),
    });
  }
  return trees;
}

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes("--json");
  const allSessionRoots = argv.includes("--all-session-roots");

  const selfTest = selfTestMatcher();

  const overrideSettings = splitPathList(process.env.CONTROL_TREE_GUARD_SETTINGS);
  const settingsFiles = overrideSettings.length > 0
    ? overrideSettings.map((path) => ({
      path,
      scope: "project",
      sessionRoot: projectRootForSettings(path),
    }))
    : discoverSettingsFiles();

  // Which session roots this run judges. The governance session runs at the platform
  // root, and that is the world INC-033 says was left uncovered, so it is the gating
  // scope. `--all-session-roots` widens it to every repository root as well; the five
  // repositories' rules are anchored inside those repositories, so that reading is
  // expected to be red and is reported rather than hidden.
  const sessionRoots = overrideSettings.length > 0
    ? [ANY_ROOT]
    : allSessionRoots
      ? [...new Set(settingsFiles.map((file) => file.sessionRoot).filter(Boolean))].sort()
      : [PLATFORM_ROOT];

  const { rules, sources } = loadRules(settingsFiles);
  const roster = buildRoster();

  // The disk is read once; every session root is judged over the SAME observation, so
  // a difference between two roots can only come from the rules, never from the walk.
  const probeCache = new Map();
  for (const entry of roster) probeCache.set(entry.path, probePathsFor(entry.path));

  const worlds = sessionRoots.map((root) => {
    const trees = judgeSessionRoot(roster, rules, root, probeCache);
    return { sessionRoot: root, trees, uncovered: trees.filter((tree) => !tree.covered) };
  });

  const reasons = [];
  if (selfTest.failures.length > 0) reasons.push("GLOB_MATCHER_SELF_TEST_FAILED");
  if (roster.length === 0) reasons.push("NO_CONTROL_TREES_FOUND");
  if (sessionRoots.length === 0) reasons.push("NO_SESSION_ROOTS");
  if (sources.length === 0) reasons.push("NO_SETTINGS_SOURCES");
  if (rules.length === 0) reasons.push("NO_FILE_DENY_RULES_FOUND");
  const uncovered = worlds.flatMap((world) => world.uncovered);
  if (uncovered.length > 0) reasons.push("CONTROL_TREE_DENY_COVERAGE_INCOMPLETE");

  const ok = reasons.length === 0;
  const artifact = {
    verdict: ok ? "CONTROL_TREE_DENY_COVERAGE_COMPLETE" : "CONTROL_TREE_DENY_COVERAGE_FAILED",
    reasons,
    platformRoot: PLATFORM_ROOT,
    home: HOME,
    sessionRootsJudged: sessionRoots,
    probeEntries: {
      CONTROL_TREE_GUARD_SETTINGS: process.env.CONTROL_TREE_GUARD_SETTINGS ?? null,
      CONTROL_TREE_GUARD_EXTRA_TREES: process.env.CONTROL_TREE_GUARD_EXTRA_TREES ?? null,
      CONTROL_TREE_GUARD_PLATFORM_ROOT: process.env.CONTROL_TREE_GUARD_PLATFORM_ROOT ?? null,
      CONTROL_TREE_GUARD_HOME: process.env.CONTROL_TREE_GUARD_HOME ?? null,
      allSessionRoots,
    },
    matcherSelfTest: selfTest,
    settingsSources: sources,
    fileDenyRuleCount: rules.length,
    controlTreeCount: roster.length,
    uncoveredControlTrees: [...new Set(uncovered.map((tree) => tree.path))],
    worlds,
  };

  if (asJson) {
    process.stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
  } else {
    const lines = [];
    lines.push(`matcher self-test: ${selfTest.samples} samples, ${selfTest.failures.length} failure(s)`);
    lines.push(`platform root:     ${PLATFORM_ROOT}`);
    lines.push(`session roots:     ${sessionRoots.join(", ") || "(none)"}`);
    lines.push(`settings sources:  ${sources.length}`);
    for (const source of sources) {
      lines.push(`  - ${source.path} [${source.scope}] deny=${source.denyEntries} file-rules=${source.fileRules}${source.error ? ` ERROR=${source.error}` : ""}`);
    }
    lines.push(`file deny rules:   ${rules.length}`);
    lines.push(`control trees:     ${roster.length}`);
    for (const world of worlds) {
      lines.push(`--- session root: ${world.sessionRoot} --- ${world.uncovered.length} uncovered of ${world.trees.length}`);
      for (const tree of world.trees) {
        const marks = REQUIRED_TOOLS
          .map((tool) => `${tool}=${tree.tools[tool].coveredStrict ? "strict" : tree.tools[tool].coveredPermissive ? "PERMISSIVE-ONLY" : "UNCOVERED"}`)
          .join(" ");
        lines.push(`  ${tree.covered ? "OK  " : "FAIL"} ${tree.path}  [${tree.origin}] probes=${tree.probeCount} real=${tree.realFileCount} ${marks}`);
        if (!tree.covered) {
          for (const tool of REQUIRED_TOOLS) {
            for (const probe of tree.tools[tool].uncoveredStrict) {
              lines.push(`         uncovered(${tool}): ${probe}`);
            }
          }
        }
      }
    }
    lines.push(`verdict: ${artifact.verdict}${reasons.length ? ` (${reasons.join(", ")})` : ""}`);
    process.stdout.write(`${lines.join("\n")}\n`);
  }

  process.exit(ok ? 0 : 1);
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  main();
}
