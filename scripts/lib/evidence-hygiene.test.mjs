import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  HOST_PATH_RULES, REPO_ROOT,
  findHostPaths, listEvidenceFiles, scanEvidenceTree, scrubHostPaths, scrubHostPathsInText,
  trackedEvidencePaths
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

test("the two INC-037 receipts are redacted and still say what they said", () => {
  // Named explicitly, not left to the sweep above: these two are the reason the
  // gate exists, and "the sweep found nothing" would also be true if they were
  // deleted.
  for (const path of ["evidence/aos-domain-backup.json", "evidence/aos-paired-backup.json"]) {
    const text = readFileSync(join(REPO_ROOT, path), "utf8");
    assert.deepEqual(findHostPaths(text), [], `${path} must carry no host path`);
    const receipt = JSON.parse(text);
    assert.equal(receipt.ok, true, `${path} must still parse and still hold its verdict`);
    assert.match(receipt.destinationRoot, /^<local-[a-z-]+>\//u,
      `${path} must name its destination as a placeholder, not as a directory on one laptop`);
  }
  // The digests are the part a redaction must never touch. These are the values
  // that were in the receipts before redaction, transcribed here from the
  // pre-redaction bytes — if a future scrub ever rewrites a digest, this fails.
  const paired = JSON.parse(readFileSync(join(REPO_ROOT, "evidence/aos-paired-backup.json"), "utf8"));
  assert.equal(paired.pair.pairing.chainHeadEventHash,
    "557b5032648ede9157d68b4c9ccec7b4216f700576ff7c39cbf781e6bfac1088");
  assert.equal(paired.pair.pairing.domainSnapshotDigest,
    "8b16e1f5b7c21f2ab111ace3c29c56435ed0c44c1fa50d5e1ee1171a6dda8d6d");
  assert.equal(paired.pair.pairing.chainVersion, 549);
  const domain = JSON.parse(readFileSync(join(REPO_ROOT, "evidence/aos-domain-backup.json"), "utf8"));
  assert.equal(domain.snapshot.artifacts["domain.db"].sha256,
    "e3c2e0fdcb489925461534e0f4c97bfba39ce5747559e4a107defa955ea2f2ae");
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

test("the pending-exception list is closed on every side", () => {
  const tracked = trackedEvidencePaths();
  const findings = scanEvidenceTree();
  for (const entry of PENDING.entries) {
    assert.ok(typeof entry.reason === "string" && entry.reason.trim().length > 0,
      `${entry.path} needs a reason`);
    assert.ok(existsSync(join(REPO_ROOT, entry.path)),
      `${entry.path} is listed as pending but does not exist — remove the stale entry`);
    // The exception holds only while the path stays out of history. Adding it
    // to the index is the moment the hygiene obligation attaches, and the gate
    // must turn red then rather than keep excusing it.
    const trackedUnder = [...tracked].filter((path) => path === entry.path || path.startsWith(`${entry.path}/`));
    assert.deepEqual(trackedUnder, [],
      `${entry.path} is tracked by git — redact it instead of listing it as pending`);
    // And an exception whose reason has evaporated (nothing under it carries a
    // host path any more) must be deleted, not left standing as a hole.
    assert.ok(findings.some((finding) => isPending(finding.path) && finding.path.startsWith(entry.path)),
      `${entry.path} no longer carries any host path — delete the exception`);
  }
});
