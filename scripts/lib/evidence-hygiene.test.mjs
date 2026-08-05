import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  FIXTURE_EXCLUDED_FILES, HOST_PATH_RULES, REPO_ROOT,
  findHostPaths, findPlaceholders, isScannablePath, listEvidenceFiles, listGuardedFiles,
  rehydrateHostPaths, scanGuardedFiles,
  pendingClosureViolations, scrubHostPaths, scrubHostPathsInText, trackedPaths
} from "./evidence-hygiene.mjs";

/**
 * The evidence-hygiene gate (TCRN-AOS-INC-037).
 *
 * Nothing this repository publishes may carry a path off this machine. The drift
 * it exists for was real and unwatched: two backup receipts shipped this laptop's
 * home directory and the platform root, and the only reason anybody noticed was a
 * hand review. A gate that nobody wrote is a gate that lives exactly as long as
 * the day it was needed.
 *
 * And a gate whose SCOPE nobody re-checks lives exactly as long as the directory
 * layout it was written against — see the scope tests below (TCRN-CROSS-INC-034).
 */

const PENDING = JSON.parse(readFileSync(join(REPO_ROOT, "scripts/lib/evidence-hygiene-pending.json"), "utf8"));
const pendingPaths = PENDING.entries.map((entry) => entry.path);
const isPending = (path) => pendingPaths.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

/** A throwaway repo-shaped directory. Never the real repository, never `git add`. */
function withScratchRoot(body) {
  const root = mkdtempSync(join(tmpdir(), "aos-evidence-hygiene-"));
  mkdirSync(join(root, "evidence"), { recursive: true });
  try { return body(root); } finally { rmSync(root, { recursive: true, force: true }); }
}

test("no published artifact carries a path off this machine", () => {
  // Two scan sources, each read the way its half can honestly be read: the
  // working tree under evidence/ (a file written there and not yet added is
  // exactly what this gate must see, and an index-derived list is blind to it),
  // plus every tracked scannable file repository-wide (the half that survives a
  // move). Both floors asserted, so neither half can silently empty out.
  const evidence = listEvidenceFiles();
  assert.ok(evidence.length > 40, `the evidence walk must actually cover the tree (saw ${evidence.length} files)`);
  const guarded = listGuardedFiles();
  assert.ok(guarded.length >= evidence.length, "the guarded set must contain the evidence tree");
  assert.ok(guarded.some((path) => !path.startsWith("evidence/")),
    "the scope must reach outside evidence/ — that hardcoded prefix is the whole defect");

  const offenders = scanGuardedFiles().filter((entry) => !isPending(entry.path));
  assert.deepEqual(
    offenders.map((entry) => `${entry.path}: ${entry.hits[0].rule} @ line ${entry.hits[0].line} (${entry.hits[0].sample})`),
    [],
    "artifacts must be redacted before they are committed — see scripts/lib/evidence-hygiene.mjs"
  );
});

test("the scope follows the evidence, including to docs/reports/", () => {
  // TCRN-CROSS-INC-034 moved INIT-018's evidence to docs/reports/init-018/ and
  // the gate did not follow, because its scope was the literal string
  // "evidence". Asserted here as a property of the scope rather than against
  // today's tree: docs/reports/ carries no tracked file yet, so a membership
  // check against reality would be vacuous today and would start passing for the
  // wrong reason tomorrow.
  const moved = "docs/reports/init-018/S2/notes.md";
  assert.ok(isScannablePath(moved), "a report under docs/reports/ is a kind the gate reads");
  withScratchRoot((root) => {
    assert.ok(listGuardedFiles({ repoRoot: root, tracked: [moved] }).includes(moved),
      "a tracked file under docs/reports/ must be in scope");
    assert.ok(listGuardedFiles({ repoRoot: root, tracked: ["deploy/aos-local-client/payloads/x.json"] })
      .includes("deploy/aos-local-client/payloads/x.json"),
      "the scope is not a list of two directories either — it is every tracked scannable file");
  });

  // Against reality, the containment that makes the above more than a unit test:
  // everything git tracks and the gate can read is in the real scan set, except the
  // declared by-name exclusions (INC-046: parity source fixtures + machine-local
  // launchd plists) — those are still scannable by kind, just declared out.
  const scope = listGuardedFiles();
  const missing = trackedPaths().filter(isScannablePath)
    .filter((path) => !FIXTURE_EXCLUDED_FILES.includes(path))
    .filter((path) => !scope.includes(path));
  assert.deepEqual(missing, [], "every tracked scannable file must be in scope");
  for (const excluded of FIXTURE_EXCLUDED_FILES) {
    if (!excluded.endsWith(".mjs")) {
      // launchd plists are a scannable kind excluded by name — a NEW plist (or a
      // change to a non-excluded one) carrying a /Users/<account> literal is caught.
      assert.ok(isScannablePath(excluded), `${excluded} must be a scannable kind — the exclusion is by name, not by softening the detector`);
    }
    assert.ok(!scope.includes(excluded), `${excluded} is declared out of scope`);
  }
});

test("a real host path inside the new scope turns the gate red and names the file", () => {
  // Fed real input, not a removed predicate: the same bytes on disk are red under
  // the new scope and invisible under the old one, and the ONLY difference
  // between the two runs is the scope.
  withScratchRoot((root) => {
    const leaked = "docs/reports/init-018/S9/notes.md";
    mkdirSync(join(root, "docs/reports/init-018/S9"), { recursive: true });
    // A foreign home, not this machine's: the fixture must match the platform-root
    // rule without writing a real username into a public repository. Measured
    // equivalent — same rule, same line — and .mjs is outside SCANNED_EXTENSIONS,
    // so the gate itself could not have caught the real one here.
    writeFileSync(join(root, leaked),
      "line one\nran from /Users/someone/Code/TCRN Platform/TCRN-AOS and it worked\n", "utf8");

    // `tracked` is injected rather than produced by `git add`: it stands in for
    // exactly what `git ls-files` returns once the file is staged, which was
    // verified separately against a throwaway repository.
    const red = scanGuardedFiles({ repoRoot: root, tracked: [leaked] });
    assert.deepEqual(red.map((entry) => entry.path), [leaked], "the offending file must be named");
    assert.equal(red[0].hits[0].rule, "platform-root");
    assert.equal(red[0].hits[0].line, 2, "the offending line must be named");

    // The pre-fix scope, same bytes: nothing. This is what shipped green.
    assert.deepEqual(scanGuardedFiles({ repoRoot: root, tracked: [] }), [],
      "the old evidence/-only scope saw none of this — that is the defect being fixed");
  });
});

test("the placeholder corpus is kept safe by scope, never by a softened detector", () => {
  // `/Users/<you>/…`, `/Users/$USER/…` and `/Users/someone/…` are deliberate
  // fixtures — INC-036 defect 4's detection corpus in
  // deploy/aos-local-client/parity-proof.mjs. They must never be reported as a
  // leak, and the detector is NOT the thing that spares them: it flags all three,
  // as it must, since `/Users/someone` is the home-directory rule's own
  // rehydration example that another test requires to be detected. What spares
  // them is that `.mjs` is not a kind the gate reads. Both halves asserted, so a
  // future widening of SCANNED_EXTENSIONS cannot quietly turn the corpus red.
  for (const fixture of ["/Users/<you>/Code/TCRN Platform/x", "/Users/$USER/x", "/Users/someone/x"]) {
    assert.ok(findHostPaths(fixture).length > 0,
      `${fixture} must still be detected — sparing it in the detector would blind the gate to real leaks`);
  }
  const corpus = ["deploy/aos-local-client/parity-proof.mjs", "deploy/aos-local-client/parity-proof.test.mjs"];
  for (const path of corpus) assert.equal(isScannablePath(path), false, `${path} must not be a scanned kind`);
  withScratchRoot((root) => {
    assert.deepEqual(listGuardedFiles({ repoRoot: root, tracked: corpus }), [],
      "the corpus must be out of scope even when git tracks it");
  });
  assert.deepEqual(listGuardedFiles().filter((path) => path.endsWith(".mjs")), [],
    "no source file is in scope in the real repository either");
});

const DIGEST = /^[0-9a-f]{64}$/u;

/** Every scalar leaf of a JSON value, keyed by its JSON-pointer-ish path. */
function leafMap(value, pointer = "", out = new Map()) {
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) leafMap(entry, `${pointer}/${key}`, out);
  } else {
    out.set(pointer, value);
  }
  return out;
}

test("redaction changes where a receipt was made, never what it claims", () => {
  // Named explicitly, not left to the sweep above: these two are the reason the
  // gate exists, and "the sweep found nothing" would also be true if they were
  // deleted.
  //
  // What is guarded here is the redaction PROPERTY, not one run's values.
  // TCRN-AOS-INC-042: this test used to pin the paired receipt's
  // chainHeadEventHash, domainSnapshotDigest and chainVersion as literals. The
  // intent was right — a scrub must never rewrite a digest — but the predicate
  // was wrong: those receipts are re-runnable artifacts, so it actually held
  // "this receipt is frozen at one particular run", and the first legitimate
  // re-backup turned it red for a reason that had nothing to do with hygiene
  // (S127's final anchor did exactly that). A value that legitimately moves
  // cannot be the thing a gate holds still.
  //
  // The property, instead: redaction is a pure path substitution. Rehydrate a
  // committed receipt back into what it looked like before redaction, scrub
  // that, and the committed receipt must come back exactly. Whatever this run's
  // digests, counts and versions happen to be, they are then proven untouched
  // by construction.
  for (const path of ["evidence/aos-domain-backup.json", "evidence/aos-paired-backup.json"]) {
    const text = readFileSync(join(REPO_ROOT, path), "utf8");
    assert.deepEqual(findHostPaths(text), [], `${path} must carry no host path`);
    const redacted = JSON.parse(text);
    assert.equal(redacted.ok, true, `${path} must still parse and still hold its verdict`);
    assert.match(redacted.destinationRoot, /^<local-[a-z-]+>\//u,
      `${path} must name its destination as a placeholder, not as a directory on one laptop`);

    // Committed bytes must already be a fixed point: scrubbing them again moves
    // nothing. A receipt that still moved here shipped half-redacted.
    assert.deepEqual(scrubHostPaths(redacted), redacted,
      `${path} is not fully redacted — scrubbing it a second time still changes it`);

    // The round trip has to have something to work on, or it proves nothing.
    assert.ok(findPlaceholders(text).length > 0,
      `${path} carries no placeholder, so redaction cannot be exercised against it`);
    const rehydrated = rehydrateHostPaths(redacted);
    assert.ok(findHostPaths(JSON.stringify(rehydrated)).length > 0,
      `the rehydrated ${path} must really carry host paths, or the scrub below removes nothing`);

    // The predicate: forward redaction of the pre-redaction shape reproduces the
    // committed receipt, value for value.
    assert.deepEqual(scrubHostPaths(rehydrated), redacted,
      `redacting ${path} must reproduce the committed receipt exactly`);

    // Said again leaf by leaf, so a failure names the offending field instead of
    // dumping two whole receipts.
    const before = leafMap(rehydrated);
    const after = leafMap(scrubHostPaths(rehydrated));
    assert.deepEqual([...after.keys()], [...before.keys()],
      `redacting ${path} must not add, drop or rename a field`);
    const rewrittenWithoutCause = [...before.keys()].filter((at) =>
      before.get(at) !== after.get(at)
      && (typeof before.get(at) !== "string" || findHostPaths(before.get(at)).length === 0));
    assert.deepEqual(rewrittenWithoutCause, [],
      `redacting ${path} rewrote a leaf that carried no host path`);

    // And the digests by name — counted first, so this can never pass by there
    // being nothing to protect.
    const digests = [...before.keys()].filter((at) => DIGEST.test(String(before.get(at))));
    assert.ok(digests.length >= 2, `${path} should carry digests to protect (saw ${digests.length})`);
    assert.deepEqual(digests.filter((at) => after.get(at) !== before.get(at)), [],
      `redacting ${path} rewrote a digest`);
  }
});

test("every rehydration example scrubs back to exactly the placeholder it stands for", () => {
  // The backwards direction above is only honest while each rule's example is
  // genuinely a path of that rule's shape. Checked here rather than assumed, so
  // a rule whose pattern is edited without its example cannot quietly turn the
  // round trip into a tautology over strings that were never host paths.
  const rehydratable = HOST_PATH_RULES.filter((rule) => rule.rehydratesTo);
  assert.ok(rehydratable.length >= 3, "the rehydratable rule set must not silently empty out");
  for (const rule of rehydratable) {
    assert.ok(findHostPaths(rule.rehydratesTo).some((hit) => hit.rule === rule.id),
      `${rule.id}'s example must be detected as ${rule.id}`);
    assert.equal(scrubHostPathsInText(rule.rehydratesTo), rule.placeholder,
      `${rule.id}'s example must scrub to exactly ${rule.placeholder}`);
  }
  // A placeholder no rule can reconstruct must refuse, not round-trip wrongly.
  assert.throws(() => rehydrateHostPaths({ at: "<local-var-folders>/x" }), /no rule can rehydrate/u);
});

test("every host-path shape is detected, and every rewritable one round-trips to a placeholder", () => {
  // Both sides of the predicate, shape by shape: the raw form must be found,
  // and the scrubbed form must not be. A detector that finds nothing in a
  // scrubbed string proves nothing on its own — it has to find the raw one.
  const samples = [
    ["/Users/someone/Code/TCRN Platform/.tcrn-workspace/TCRN-AOS/workspace", "platform-root"],
    ["/Users/someone/.tcrn-aos/domain.db", "home-directory"],
    ["/private/tmp/claude-501/scratch/x.json", "private-tmp"],
    ["/var/folders/qk/abc123/T/aos-test-9f", "var-folders"],
    ["/private/var/folders/qk/abc123/T/aos-test-9f", "var-folders"]
  ];
  for (const [raw, expectedRule] of samples) {
    const hits = findHostPaths(raw);
    assert.ok(hits.length > 0, `${raw} must be detected`);
    assert.ok(hits.some((hit) => hit.rule === expectedRule),
      `${raw} must be detected as ${expectedRule}, saw ${hits.map((hit) => hit.rule).join(",")}`);
    assert.deepEqual(findHostPaths(scrubHostPathsInText(raw)), [],
      `${raw} must scrub to something the detector no longer flags`);
  }
  // A shape this scrubber cannot safely rewrite is still detected — fail-closed,
  // never a silent pass.
  const foreign = "/Volumes/backup/Code/TCRN Platform/evidence";
  assert.ok(findHostPaths(foreign).some((hit) => hit.rule === "platform-root-foreign-mount"));
  assert.ok(HOST_PATH_RULES.find((rule) => rule.id === "platform-root-foreign-mount").detectOnly);

  // The home directory with its separators mangled to dashes — a Claude Code session
  // directory (TCRN-AOS-STORY-133 emitted one and this gate passed it, because every
  // other rule looks for a `/Users/` shape). Both sides asserted: the dash-encoded
  // form must be found, and the same session id WITHOUT the account name must not be,
  // so the rule is keyed on the leak rather than on "this looks like a session dir".
  const dashEncoded = "<local-private-tmp>/claude-501/-Users-someone-Code-TCRN-Platform/abc/scratchpad";
  const hits = findHostPaths(dashEncoded);
  assert.ok(hits.some((hit) => hit.rule === "home-directory-dash-encoded"),
    `the dash-encoded home must be detected, saw ${hits.map((hit) => hit.rule).join(",")}`);
  assert.ok(HOST_PATH_RULES.find((rule) => rule.id === "home-directory-dash-encoded").detectOnly,
    "there is no safe rewrite for a dash-mangled path; it must fail closed for a person");
  assert.deepEqual(
    findHostPaths("<local-private-tmp>/claude-501/abc-def/scratchpad/story133-red-proof"), [],
    "a scratch path carrying no account name must not be flagged");
});

test("scrubbing rewrites paths and nothing else", () => {
  const receipt = {
    ok: true,
    destinationRoot: "/Users/someone/OneDrive/backups",
    sha256: "e3c2e0fdcb489925461534e0f4c97bfba39ce5747559e4a107defa955ea2f2ae",
    version: 549,
    at: "2026-07-28T13:29:29Z",
    nested: { workspaceRoot: "/Users/someone/Code/TCRN Platform/.tcrn-workspace/TCRN-AOS/workspace" },
    list: ["/private/tmp/x", "INVALID_TRANSITION", 42, null, true]
  };
  const scrubbed = scrubHostPaths(receipt);
  assert.deepEqual(scrubbed, {
    ok: true,
    destinationRoot: "<local-home>/OneDrive/backups",
    sha256: "e3c2e0fdcb489925461534e0f4c97bfba39ce5747559e4a107defa955ea2f2ae",
    version: 549,
    at: "2026-07-28T13:29:29Z",
    nested: { workspaceRoot: "<local-platform-root>/.tcrn-workspace/TCRN-AOS/workspace" },
    list: ["<local-private-tmp>/x", "INVALID_TRANSITION", 42, null, true]
  });
  // The input is not mutated: an emitter that scrubs its receipt must still be
  // able to print the real path to the operator's terminal.
  assert.equal(receipt.destinationRoot, "/Users/someone/OneDrive/backups");
});

/** The probes the closure conditions are really about, read from this checkout. */
function liveProbes() {
  // Repository-wide, not `git ls-files -- evidence`: the trackedness condition
  // was previously unfalsifiable for any pending path outside evidence/, which
  // is the same scope defect one function over.
  const tracked = trackedPaths();
  const findings = scanGuardedFiles();
  return {
    exists: (path) => existsSync(join(REPO_ROOT, path)),
    trackedUnder: (path) => [...tracked].filter((entry) => entry === path || entry.startsWith(`${path}/`)),
    carriesHostPath: (path) => findings.some((finding) => finding.path === path || finding.path.startsWith(`${path}/`)),
  };
}

test("the pending-exception list is closed on every side", () => {
  const violations = pendingClosureViolations(PENDING.entries, liveProbes());
  assert.deepEqual(
    violations.map((entry) => `${entry.path} [${entry.condition}] ${entry.detail}`),
    [],
    "see the closure list in scripts/lib/evidence-hygiene-pending.json"
  );
});

test("every closure condition can actually fail", () => {
  // Each world below is one the real list must survive, and none of them is
  // reachable from this working copy — which is precisely why v1's conditions
  // were jointly unsatisfiable on a fresh checkout without anybody noticing.
  const clean = { exists: () => true, trackedUnder: () => [], carriesHostPath: () => true };
  const entry = { path: "evidence/x", reason: "because", presence: "machine-local" };
  const conditionsFor = (entries, probes) =>
    pendingClosureViolations(entries, probes).map((violation) => violation.condition);

  assert.deepEqual(conditionsFor([entry], clean), [], "the clean world must be clean, or nothing below means anything");
  assert.deepEqual(conditionsFor([{ ...entry, reason: "   " }], clean), ["reason"]);
  assert.deepEqual(conditionsFor([{ ...entry, presence: "whenever" }], clean), ["presence"]);
  assert.deepEqual(
    conditionsFor([entry], { ...clean, trackedUnder: () => ["evidence/x/a.json"] }), ["untracked"],
    "trackedness is not exempted by any presence mode"
  );
  assert.deepEqual(
    conditionsFor([entry], { ...clean, carriesHostPath: () => false }), ["still-needed"],
    "an exception whose reason evaporated is red even when it is machine-local"
  );

  // The fresh-checkout world: absent material. machine-local survives it, the
  // default does not — and the default surviving would mean the strict rule was
  // quietly dropped for everyone rather than exempted for one declared case.
  const absent = { ...clean, exists: () => false };
  assert.deepEqual(conditionsFor([entry], absent), [], "machine-local material may be absent");
  assert.deepEqual(conditionsFor([{ path: "evidence/x", reason: "because" }], absent), ["exists"],
    "an entry that declares nothing is still held to the strict existence rule");

  // And absence must not become a way to smuggle a tracked path past the gate.
  assert.deepEqual(
    conditionsFor([entry], { ...absent, trackedUnder: () => ["evidence/x/a.json"] }), ["untracked"],
    "a tracked-but-absent path is still a failure"
  );
});

test("the real entry is machine-local for a stated reason, and the schema says why", () => {
  // A marker nobody has to justify is a marker that spreads. Both halves are
  // asserted against the file itself rather than assumed from the code above.
  assert.equal(PENDING.schemaVersion, "aos.evidence-hygiene-pending.v2");
  assert.ok(PENDING.whyPresenceExists?.length > 200, "the exemption must carry its own history");
  assert.deepEqual(
    PENDING.entries.filter((entry) => (entry.presence ?? "expected") === "machine-local").map((entry) => entry.path),
    ["evidence/conf-007-recon"],
    "every machine-local entry is a hole in the existence check, so the set of them is asserted explicitly"
  );
});
