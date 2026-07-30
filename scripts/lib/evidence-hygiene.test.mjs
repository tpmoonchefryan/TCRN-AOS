import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  HOST_PATH_RULES, REPO_ROOT,
  findHostPaths, findPlaceholders, listEvidenceFiles, rehydrateHostPaths, scanEvidenceTree,
  pendingClosureViolations, scrubHostPaths, scrubHostPathsInText, trackedEvidencePaths
} from "./evidence-hygiene.mjs";

/**
 * The evidence-hygiene gate (TCRN-AOS-INC-037).
 *
 * Nothing in evidence/ may carry a path off this machine. The drift it exists
 * for was real and unwatched: two backup receipts shipped this laptop's home
 * directory and the platform root, and the only reason anybody noticed was a
 * hand review. A gate that nobody wrote is a gate that lives exactly as long as
 * the day it was needed.
 */

const PENDING = JSON.parse(readFileSync(join(REPO_ROOT, "scripts/lib/evidence-hygiene-pending.json"), "utf8"));
const pendingPaths = PENDING.entries.map((entry) => entry.path);
const isPending = (path) => pendingPaths.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

test("no evidence artifact carries a path off this machine", () => {
  const files = listEvidenceFiles();
  // The scan set is read from the filesystem, not from `git ls-files`: a file
  // written into evidence/ and not yet added is exactly the file this gate must
  // see, and an index-derived list is blind to it by construction.
  assert.ok(files.length > 40, `the scan must actually cover the tree (saw ${files.length} files)`);

  const offenders = scanEvidenceTree().filter((entry) => !isPending(entry.path));
  assert.deepEqual(
    offenders.map((entry) => `${entry.path}: ${entry.hits[0].rule} @ line ${entry.hits[0].line} (${entry.hits[0].sample})`),
    [],
    "evidence artifacts must be redacted before they are committed — see scripts/lib/evidence-hygiene.mjs"
  );
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
  const tracked = trackedEvidencePaths();
  const findings = scanEvidenceTree();
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
