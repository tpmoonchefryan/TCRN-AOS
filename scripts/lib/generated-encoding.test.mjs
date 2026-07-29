import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  GENERATED_ARTIFACT_SOURCES, REPLACEMENT_CHARACTER,
  findReplacementCharacters, listGeneratedArtifacts, scanGeneratedArtifacts
} from "./generated-encoding.mjs";

/**
 * The generated-artifact encoding gate (TCRN-AOS-INC-039).
 *
 * `apps/web/src/cockpit-data.generated.ts` was committed carrying five
 * replacement characters, because the chain client decoded each stdout chunk on
 * its own and Node splits a pipe read at 64 KiB without asking where a
 * character ends. The client is fixed (8500646) and the artifact regenerated,
 * but the fix protects only what is generated after it. This gate is the part
 * that keeps protecting the repository: whatever a generator does upstream, a
 * mangled character cannot ride into the tree unremarked.
 */

test("the scanner names the file position of every replacement character", () => {
  // The scanner is tested on strings it is handed, separately from the sweep
  // over the real tree: the sweep passes when the tree is clean, which is also
  // what it would do if the scanner found nothing anywhere. Only this test can
  // tell those two apart.
  const clean = "第一行\n评论与立场双轨\n第三行";
  assert.deepEqual(findReplacementCharacters(clean), [], "clean text must produce no hits");

  const mangled = `第一行\n评论与${REPLACEMENT_CHARACTER}${REPLACEMENT_CHARACTER}场双轨\n墙${REPLACEMENT_CHARACTER}驳倒`;
  const hits = findReplacementCharacters(mangled);
  assert.deepEqual(hits.map((hit) => [hit.line, hit.column]), [[2, 4], [2, 5], [3, 2]],
    "each hit must carry the 1-based line and column a person can open the file to");
  for (const hit of hits) {
    assert.ok(hit.sample.includes(REPLACEMENT_CHARACTER),
      "the sample must show the mangled text, not only its coordinates");
  }
});

test("the sweep reads a whole directory tree and reports the file it found", () => {
  // The tree walk and the offender shape, proven against a scratch tree rather
  // than against the repository — a fixture is the only place a *failing* case
  // can be constructed without corrupting a real artifact.
  const root = mkdtempSync(join(tmpdir(), "tcrn-aos-inc039-"));
  try {
    mkdirSync(join(root, "evidence/nested"), { recursive: true });
    writeFileSync(join(root, "evidence/clean.json"), '{"note":"立场"}\n');
    writeFileSync(join(root, "evidence/skipped.bin"), `bytes ${REPLACEMENT_CHARACTER}\n`);
    writeFileSync(join(root, "evidence/nested/mangled.md"), `# 报告\n墙${REPLACEMENT_CHARACTER}驳倒\n`);

    const sources = [{ id: "evidence", kind: "tree", path: "evidence", extensions: [".json", ".md"] }];
    assert.deepEqual(listGeneratedArtifacts(sources, root),
      ["evidence/clean.json", "evidence/nested/mangled.md"],
      "the walk must recurse, and must read only the extensions it claims to read");

    const offenders = scanGeneratedArtifacts(sources, root);
    assert.deepEqual(offenders.map((entry) => entry.path), ["evidence/nested/mangled.md"]);
    assert.deepEqual(offenders[0].hits.map((hit) => hit.line), [2]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("no generated artifact carries a replacement character", () => {
  const files = listGeneratedArtifacts();
  // The scan set has to actually cover the artifacts. Without this the sweep
  // below would pass just as happily over an empty list — the failure mode that
  // makes a gate green forever.
  assert.ok(files.includes("apps/web/src/cockpit-data.generated.ts"),
    "the artifact this gate exists for must be in the scan set");
  assert.ok(files.length > 100, `the scan must cover the evidence tree too (saw ${files.length} files)`);

  const offenders = scanGeneratedArtifacts();
  assert.deepEqual(
    offenders.flatMap((entry) => entry.hits.map(
      (hit) => `${entry.path}:${hit.line}:${hit.column}: ${hit.sample}`)),
    [],
    "a generated artifact holds U+FFFD, so bytes were mangled on the way in — regenerate it with a "
      + "client that decodes across chunk boundaries (see packages/projection/src/chain-client.ts)"
  );

  // Named, not left to the sweep: this is the file the incident was about, and
  // "the sweep found nothing" would also be true if it had been deleted.
  assert.ok(GENERATED_ARTIFACT_SOURCES.some((source) => source.id === "cockpit-data"),
    "the cockpit data module must stay a declared source of this gate");
});
