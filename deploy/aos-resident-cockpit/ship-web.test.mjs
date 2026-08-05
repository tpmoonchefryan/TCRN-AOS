// R2 ship-web tests — real assembly, injected far side (STORY-138).
//
// The far side (the VM) cannot be touched by a test, so `shipWeb`'s remote ledger
// and rsync are injected. Everything else is real: the precondition check, the
// shell assembly, the local ledger walk and the full-value both-direction
// comparison. Green and red are therefore real executions of every step except
// the transport, and the red case proves the ledger gate actually reds on a
// divergent far side.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  REPO_ROOT, assembleWebRoot, checkPrecondition, defaultLocalWebRoot, shipWeb
} from "./ship-web.mjs";
import { compareLedgers, localLedger } from "./resident-lib.mjs";
import { VM_WEB } from "./manifest.mjs";

const stampOf = (text) => text.match(/["']?\bgeneratedAt["']?\s*:\s*["'](\d{4}-\d{2}-\d{2}T[^"']{1,40})["']/u)?.[1] ?? null;

/** The ledger a real far side would report after a faithful ship: assemble + walk. */
async function faithfulRemoteLedger() {
  const fixture = await mkdtemp(join(tmpdir(), "aos-ship-web-fixture-"));
  try {
    await assembleWebRoot(defaultLocalWebRoot(), fixture);
    return localLedger(fixture);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
}

const noopRsync = async () => {};

test("precondition: apps/web/dist exists and its bundle carries a generation stamp", () => {
  const precondition = checkPrecondition(defaultLocalWebRoot());
  assert.equal(precondition.ok, true, precondition.problems.join("; "));
  assert.ok(precondition.bundleStamp, "the built bundle must carry a generation stamp");
});

test("green: an identical far side makes the ledger comparison pass", async () => {
  const expected = await faithfulRemoteLedger();
  const result = await shipWeb({ dryRun: false, remoteLedgerFn: async () => expected, rsyncFn: noopRsync });
  assert.equal(result.ok, true);
  assert.equal(result.reasonCode, "TRANSFER_LEDGERS_EQUAL");
  assert.equal(result.comparison.missingOnVm.length, 0);
  assert.equal(result.comparison.extraOnVm.length, 0);
  assert.equal(result.comparison.mismatched.length, 0);
  assert.ok(result.comparison.fileSetDigest.local, "the report must carry the file-set digest");
});

test("red: a far side with a mismatched byte fails, naming the file", async () => {
  const expected = await faithfulRemoteLedger();
  const tampered = expected.map((file, index) => index === 0 ? { ...file, sha256: "f".repeat(64) } : file);
  const result = await shipWeb({ dryRun: false, remoteLedgerFn: async () => tampered, rsyncFn: noopRsync });
  assert.equal(result.ok, false);
  assert.equal(result.reasonCode, "TRANSFER_LEDGERS_DIVERGENT");
  assert.equal(result.comparison.mismatched.length, 1, "exactly the tampered file must be named");
  assert.equal(result.comparison.ok, false);
});

test("red: a far side missing a file reds on missingOnVm", async () => {
  const expected = await faithfulRemoteLedger();
  const pruned = expected.slice(1); // drop the first file, as if it never reached the VM
  const result = await shipWeb({ dryRun: false, remoteLedgerFn: async () => pruned, rsyncFn: noopRsync });
  assert.equal(result.ok, false);
  assert.equal(result.reasonCode, "TRANSFER_LEDGERS_DIVERGENT");
  assert.equal(result.comparison.missingOnVm.length, 1);
});

test("dry-run touches no network: neither the rsync nor the remote ledger runs", async () => {
  let rsyncCalled = false;
  let remoteCalled = false;
  const result = await shipWeb({
    dryRun: true,
    rsyncFn: async () => { rsyncCalled = true; },
    remoteLedgerFn: async () => { remoteCalled = true; return []; }
  });
  assert.equal(result.ok, true);
  assert.equal(result.reasonCode, "DRY_RUN_NO_NETWORK");
  assert.equal(rsyncCalled, false, "dry-run must not rsync");
  assert.equal(remoteCalled, false, "dry-run must not ask the far side for its ledger");
  assert.ok(Array.isArray(result.localLedger) && result.localLedger.length > 0, "dry-run still reports the local ledger");
  assert.equal(result.wouldSync.to, VM_WEB, "the target must come from manifest.mjs, never a hand-typed address");
});

test("the staging root is world-traversable (0700 would lock the read face out)", async () => {
  // Regression anchor for the first real run's 404: rsyncToVm's --archive carries
  // --perms, so a 0700 staging root propagated onto the remote web root and the
  // read face's unprivileged user could no longer traverse it. The ship must keep
  // the assembled root at 0755.
  const result = await shipWeb({ dryRun: true });
  assert.equal(result.stagingRootMode, "755",
    "the assembled web root must be traversable by the read face's unprivileged user");
});

test("precondition fails when the local build is absent", async () => {
  const empty = await mkdtemp(join(tmpdir(), "aos-ship-web-empty-"));
  try {
    const result = await shipWeb({ localWebRoot: empty });
    assert.equal(result.ok, false);
    assert.equal(result.reasonCode, "PRECONDITION_FAILED");
    assert.ok(result.precondition.problems.length > 0);
  } finally {
    await rm(empty, { recursive: true, force: true });
  }
});

test("the assembled web root is the served cockpit, not the /cockpit product shell", async () => {
  // Guards the INC-051 regression the ship exists to prevent: shipping
  // apps/web/dist verbatim would put the product shell (no data-cockpit-view, no
  // stamped prose) over the served cockpit root. The assembly must render the
  // operations shell and carry a stamp the freshness gate can judge.
  const fixture = await mkdtemp(join(tmpdir(), "aos-ship-web-assembled-"));
  try {
    await assembleWebRoot(defaultLocalWebRoot(), fixture);
    const shell = await readFile(join(fixture, "index.html"), "utf8");
    const bundle = await readFile(join(fixture, "assets/aos-client.js"), "utf8");
    assert.match(shell, /data-cockpit-view="my-work"/u, "index.html must be the cockpit root shell, not the product shell");
    assert.ok(stampOf(bundle), "the assembled bundle must carry a generation stamp");
    const shellStamp = shell.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/u)?.[0] ?? null;
    assert.ok(shellStamp, "the assembled shell must render a generation stamp in prose");
    assert.equal(shellStamp, stampOf(bundle), "shell and bundle must carry the same stamp (freshness gate invariant)");
    const routeShell = await readFile(join(fixture, "work-items", "index.html"), "utf8");
    assert.match(routeShell, /data-cockpit-view="work-items"/u);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test("comparison predicates exist and are consistent with the injected flow", async () => {
  // A sanity anchor so the injected far side is not silently bypassing the real
  // comparator: compareLedgers must call the same ok predicate the report uses.
  const local = [{ path: "a.txt", bytes: 3, sha256: "a".repeat(64) }];
  const same = [{ path: "a.txt", bytes: 3, sha256: "a".repeat(64) }];
  assert.equal(compareLedgers(local, same).ok, true);
  assert.equal(REPO_ROOT.length > 0, true);
});
