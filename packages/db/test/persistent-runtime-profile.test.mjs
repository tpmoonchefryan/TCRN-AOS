import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  FUTURE_TARGET_RUNTIME_ROOT,
  prepareRuntimeRoot,
  resetPersistentRuntimeRoot,
  runPersistentRuntimeStorageProof
} from "../../../dist/packages/db/src/index.js";

test("persistent runtime profile proves write, restart readback, backup restore, and reset in temp storage", async () => {
  const proof = await runPersistentRuntimeStorageProof({ useTempRuntimeRoot: true });

  assert.equal(proof.ok, true);
  assert.equal(proof.profile.futureTargetRuntimeRoot, FUTURE_TARGET_RUNTIME_ROOT);
  assert.equal(proof.validation.runtimeRootKind, "safe_temp_route_owned");
  assert.equal(proof.writeReadbackProof.ok, true);
  assert.equal(proof.restartReadbackProof.ok, true);
  assert.equal(proof.restartReadbackProof.simulatedProcessRestart, true);
  assert.equal(proof.backupRestoreProof.ok, true);
  assert.equal(proof.backupRestoreProof.deferralAccepted, false);
  assert.equal(proof.ownershipPermissionsReadback.ok, true);
  assert.equal(proof.resetProof.ok, true);
  assert.equal(proof.resetProof.runtimeDataExistsAfterReset, false);
  assert.equal(proof.noOverclaim.targetHostExecution, false);
  assert.equal(proof.noOverclaim.sourceTransfer, false);
  assert.equal(proof.noOverclaim.runtimeOperationalDataCommittedToGit, false);
});

test("persistent runtime profile fails closed for unsafe roots and cleanup", async () => {
  await assert.rejects(
    () => prepareRuntimeRoot({ repoRoot: process.cwd() }),
    /runtime_root_missing/
  );
  await assert.rejects(
    () => prepareRuntimeRoot({ runtimeRoot: join(process.cwd(), ".runtime-proof"), repoRoot: process.cwd() }),
    /runtime_root_inside_git_tree/
  );

  const parent = await mkdtemp(join(tmpdir(), "tcrn-aos-persistent-profile-test-"));
  try {
    const realRoot = join(parent, "real-root");
    const linkedRoot = join(parent, "linked-root");
    await mkdir(realRoot, { recursive: true });
    await symlink(realRoot, linkedRoot);
    await assert.rejects(
      () => prepareRuntimeRoot({ runtimeRoot: linkedRoot, repoRoot: process.cwd() }),
      /runtime_root_unsafe_symlink/
    );

    const staleRoot = join(parent, "stale-root");
    await mkdir(join(staleRoot, "db"), { recursive: true });
    await writeFile(join(staleRoot, "db", "aos-persistent-runtime-state.json"), "{}");
    await assert.rejects(
      () => prepareRuntimeRoot({ runtimeRoot: staleRoot, repoRoot: process.cwd() }),
      /runtime_root_stale_data_ambiguous/
    );

    const unownedRoot = join(parent, "unowned-root");
    await mkdir(unownedRoot, { recursive: true });
    await assert.rejects(
      () => resetPersistentRuntimeRoot(unownedRoot),
      /destructive_cleanup_requires_route_owner_marker/
    );
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});
