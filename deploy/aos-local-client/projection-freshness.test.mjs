// TCRN-CROSS-INIT-019 INC-058 — projection-freshness pure-logic red legs.
// The full gate needs the live VM and real repos; these tests hold the parts that
// are decidable offline: the SIDECARS declaration is complete and self-consistent,
// the memory row is activity-only (never reds the gate), and the codegraph pending
// grading distinguishes tracked-source staleness from walker residual.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CODEGRAPH_PREDICATE_DISCLOSURE, SIDECARS, checkMemoryIndex, codegraphPendingVerdict, trackedSourceChanges } from "./projection-freshness.mjs";

test("the production CodeGraph predicate is explicitly disclosed and has the INC-104 red legs", () => {
  assert.equal(CODEGRAPH_PREDICATE_DISCLOSURE.schemaVersion, "aos.codegraph-freshness-predicate.v2");
  assert.equal(CODEGRAPH_PREDICATE_DISCLOSURE.changedFrom, "trackedSourceChanges-v1");
  assert.match(CODEGRAPH_PREDICATE_DISCLOSURE.criterion, /tracked added source/u);
  assert.equal(codegraphPendingVerdict({ added: 0, modified: 1, removed: 0 }, [] ).pending, true);
  assert.equal(codegraphPendingVerdict({ added: 0, modified: 0, removed: 1 }, [] ).pending, true);
  assert.equal(codegraphPendingVerdict({ added: 1, modified: 0, removed: 0 }, []).pending, false);
  assert.equal(codegraphPendingVerdict({ added: 1, modified: 0, removed: 0 }, ["src/real.mjs"]).pending, true);
  assert.equal(codegraphPendingVerdict({ added: 0, modified: 0, removed: 0 }, []).pending, false);
});

test("SIDECARS declares each sidecar with truth/self/maxAge, matching the four checked rows (INC-058)", () => {
  assert.equal(SIDECARS.length, 4, "four materialised sidecars are declared");
  for (const sidecar of SIDECARS) {
    assert.ok(typeof sidecar.id === "string" && sidecar.id.length > 0, "sidecar needs an id");
    assert.ok(typeof sidecar.truth === "string", `${sidecar.id} needs a truth description`);
    assert.ok(typeof sidecar.self === "string", `${sidecar.id} needs a self description`);
    assert.ok(typeof sidecar.maxAge === "string", `${sidecar.id} needs a maxAge`);
  }
  assert.deepEqual(SIDECARS.map((s) => s.id), ["knowledge-store", "web-projection", "codegraph", "memory-index"]);
  assert.equal(SIDECARS[3].activityOnly, true, "memory-index is declared activity-only, not a freshness criterion");
});

test("the memory row is an activity notice — never fresh, never red (INC-058)", async () => {
  const home = mkdtempSync(join(tmpdir(), "pf-mem-"));
  const oldHome = process.env.HOME;
  process.env.HOME = home;
  try {
    // A memory dir whose newest file is 40 days old must be activity, not stale.
    const memDir = join(home, ".claude/projects/x-y/memory");
    mkdirSync(memDir, { recursive: true });
    const old = new Date(Date.now() - 40 * 86_400_000).getTime();
    writeFileSync(join(memDir, "a.md"), "x");
    // Fake the mtime to 40 days ago.
    const { utimesSync } = await import("node:fs");
    utimesSync(join(memDir, "a.md"), old / 1000, old / 1000);
    const row = checkMemoryIndex();
    assert.equal(row.status, "activity", "an untouched memory dir is an activity notice, not a freshness red");
    assert.equal(row.activityOnly, true);
  } finally {
    process.env.HOME = oldHome;
    rmSync(home, { recursive: true, force: true });
  }
});

test("codegraph pending is graded by TRACKED source changes, not untracked residue (INC-058)", async () => {
  const repo = mkdtempSync(join(tmpdir(), "pf-git-"));
  const { execFileSync } = await import("node:child_process");
  execFileSync("git", ["-C", repo, "init", "-q"]);
  execFileSync("git", ["-C", repo, "config", "user.email", "t@t"]);
  execFileSync("git", ["-C", repo, "config", "user.name", "t"]);
  writeFileSync(join(repo, "tracked.mjs"), "x");
  execFileSync("git", ["-C", repo, "add", "tracked.mjs"]);
  execFileSync("git", ["-C", repo, "commit", "-q", "-m", "init"]);
  // Untracked residue only -> no tracked changes.
  writeFileSync(join(repo, "untracked.tmp"), "x");
  assert.deepEqual(trackedSourceChanges(repo), [], "untracked residue is NOT a tracked source change");
  // A tracked modification -> a tracked source change.
  writeFileSync(join(repo, "tracked.mjs"), "y");
  const changes = trackedSourceChanges(repo);
  assert.equal(changes.length, 1, "a tracked modification IS a tracked source change");
  assert.match(changes[0], /tracked\.mjs/u);
  rmSync(repo, { recursive: true, force: true });
});

test("the generated cockpit projection is not codegraph source lag", async () => {
  const repo = mkdtempSync(join(tmpdir(), "pf-generated-"));
  const { execFileSync } = await import("node:child_process");
  const generated = join(repo, "apps/web/src/cockpit-data.generated.ts");
  mkdirSync(join(repo, "apps/web/src"), { recursive: true });
  execFileSync("git", ["-C", repo, "init", "-q"]);
  execFileSync("git", ["-C", repo, "config", "user.email", "t@t"]);
  execFileSync("git", ["-C", repo, "config", "user.name", "t"]);
  writeFileSync(generated, "export const generatedAt = 'old';\n");
  execFileSync("git", ["-C", repo, "add", "."]);
  execFileSync("git", ["-C", repo, "commit", "-q", "-m", "init"]);
  writeFileSync(generated, "export const generatedAt = 'new';\n");
  assert.deepEqual(trackedSourceChanges(repo), [], "generated projection regeneration is checked by its own sidecar row");
  writeFileSync(join(repo, "source.mjs"), "x\n");
  execFileSync("git", ["-C", repo, "add", "source.mjs"]);
  writeFileSync(join(repo, "source.mjs"), "y\n");
  const changes = trackedSourceChanges(repo);
  assert.deepEqual(changes, ["source.mjs"], "a non-generated tracked source change still reds codegraph freshness");
  rmSync(repo, { recursive: true, force: true });
});
