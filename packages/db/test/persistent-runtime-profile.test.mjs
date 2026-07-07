import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
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
    () => runPersistentRuntimeStorageProof({
      runtimeRoot: join(tmpdir(), "tcrn-aos-conflicting-root"),
      useTempRuntimeRoot: true
    }),
    /runtime_root_conflicting_temp_and_explicit/
  );
  await assert.rejects(
    () => prepareRuntimeRoot({ runtimeRoot: join(process.cwd(), ".runtime-proof"), repoRoot: process.cwd() }),
    /runtime_root_inside_git_tree/
  );
  await assert.rejects(
    () => prepareRuntimeRoot({
      runtimeRoot: resolve(process.cwd(), "..", "..", "TCRN-AOS", "runtime-proof"),
      repoRoot: process.cwd()
    }),
    /runtime_root_aliases_wrong_sibling/
  );

  const parent = await mkdtemp(join(await realpath(tmpdir()), "tcrn-aos-persistent-profile-test-"));
  const dangerousMarkedRoot = join(process.cwd(), ".aos-dangerous-reset-test");
  try {
    const realRoot = join(parent, "real-root");
    const linkedRoot = join(parent, "linked-root");
    await mkdir(realRoot, { recursive: true });
    await symlink(realRoot, linkedRoot);
    await assert.rejects(
      () => prepareRuntimeRoot({ runtimeRoot: linkedRoot, repoRoot: process.cwd() }),
      /runtime_root_unsafe_symlink/
    );
    const symlinkParentTarget = join(parent, "symlink-parent-target");
    const symlinkParent = join(parent, "symlink-parent");
    await mkdir(symlinkParentTarget, { recursive: true });
    await symlink(symlinkParentTarget, symlinkParent);
    await assert.rejects(
      () => prepareRuntimeRoot({ runtimeRoot: join(symlinkParent, "runtime-root"), repoRoot: process.cwd() }),
      /runtime_root_unsafe_symlink/
    );

    const nonEmptyRoot = join(parent, "non-empty-unowned-root");
    await mkdir(nonEmptyRoot, { recursive: true });
    await writeFile(join(nonEmptyRoot, "pre-existing-data.txt"), "not route owned");
    await assert.rejects(
      () => prepareRuntimeRoot({ runtimeRoot: nonEmptyRoot, repoRoot: process.cwd() }),
      /runtime_root_unowned_non_empty/
    );

    const staleRoot = join(parent, "stale-root");
    await mkdir(join(staleRoot, "db"), { recursive: true });
    await writeFile(join(staleRoot, "db", "aos-persistent-runtime-state.json"), "{}");
    await assert.rejects(
      () => prepareRuntimeRoot({ runtimeRoot: staleRoot, repoRoot: process.cwd() }),
      /runtime_root_stale_data_ambiguous/
    );
    const staleMarkedRoot = join(parent, "stale-marked-root");
    await mkdir(staleMarkedRoot, { recursive: true });
    await writeFile(join(staleMarkedRoot, ".aos-persistent-runtime-owner.json"), JSON.stringify({
      markerSchemaVersion: "aos.persistent_runtime_owner.v1",
      profileId: "aos-59z-persistent-runtime-storage-profile-v1",
      routeId: "route_59z_product_local_persistent_db_storage_prerequisite_implementation",
      runContext: "aos-59z-product-local-persistent-runtime-proof-v1",
      owner: "aos-product-local-proof",
      runtimeRootDigest: "stale-root-digest"
    }));
    await assert.rejects(
      () => prepareRuntimeRoot({ runtimeRoot: staleMarkedRoot, repoRoot: process.cwd() }),
      /runtime_root_owner_marker_mismatch/
    );

    const unownedRoot = join(parent, "unowned-root");
    await mkdir(unownedRoot, { recursive: true });
    await assert.rejects(
      () => resetPersistentRuntimeRoot(unownedRoot),
      /destructive_cleanup_requires_route_owner_marker/
    );
    await mkdir(dangerousMarkedRoot, { recursive: true });
    await writeFile(join(dangerousMarkedRoot, ".aos-persistent-runtime-owner.json"), JSON.stringify({
      markerSchemaVersion: "aos.persistent_runtime_owner.v1",
      profileId: "aos-59z-persistent-runtime-storage-profile-v1",
      routeId: "route_59z_product_local_persistent_db_storage_prerequisite_implementation",
      runContext: "aos-59z-product-local-persistent-runtime-proof-v1",
      owner: "aos-product-local-proof",
      runtimeRootDigest: "dangerous-root-digest"
    }));
    await assert.rejects(
      () => resetPersistentRuntimeRoot(dangerousMarkedRoot),
      /runtime_root_inside_git_tree/
    );
  } finally {
    await rm(parent, { recursive: true, force: true });
    await rm(dangerousMarkedRoot, { recursive: true, force: true });
  }
});

test("persistent runtime profile supports route-bound owner marker bindings", async () => {
  const root = await mkdtemp(join(await realpath(tmpdir()), "tcrn-aos-persistent-binding-"));
  const staleRoot = await mkdtemp(join(await realpath(tmpdir()), "tcrn-aos-persistent-binding-stale-"));
  const binding = {
    profileId: "conditional-dogfood-start-p1-clean-start-runtime-profile-v1",
    routeId: "route_tcrn_conditional_dogfood_start_p1_durable_runtime_profile_root_migration_test",
    runContext: "conditional-dogfood-start-p1-clean-start-v1",
    owner: "aos-product-local-p1"
  };
  try {
    const first = await prepareRuntimeRoot({ runtimeRoot: root, repoRoot: process.cwd(), ownerMarker: binding });
    const second = await prepareRuntimeRoot({ runtimeRoot: root, repoRoot: process.cwd(), ownerMarker: binding });
    const marker = JSON.parse(await readFile(join(root, ".aos-persistent-runtime-owner.json"), "utf8"));

    assert.equal(first.ownerMarkerStatus, "created");
    assert.equal(second.ownerMarkerStatus, "existing_route_owned");
    assert.equal(marker.profileId, binding.profileId);
    assert.equal(marker.routeId, binding.routeId);
    assert.equal(marker.runContext, binding.runContext);
    assert.equal(marker.owner, binding.owner);

    await writeFile(join(staleRoot, ".aos-persistent-runtime-owner.json"), JSON.stringify({
      markerSchemaVersion: "aos.persistent_runtime_owner.v1",
      profileId: "unexpected-profile",
      routeId: binding.routeId,
      runContext: binding.runContext,
      owner: binding.owner,
      runtimeRootDigest: first.runtimeRootDigest
    }));
    await assert.rejects(
      () => prepareRuntimeRoot({ runtimeRoot: staleRoot, repoRoot: process.cwd(), ownerMarker: binding }),
      /runtime_root_owner_marker_mismatch/
    );
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(staleRoot, { recursive: true, force: true });
  }
});

test("persistent runtime profile rejects case-insensitive source-tree aliases when supported", async (t) => {
  const sourceAlias = await caseAliasForExistingPath(process.cwd());
  if (!sourceAlias) {
    t.skip("case-insensitive source-tree alias is not available on this filesystem");
    return;
  }

  await assert.rejects(
    () => prepareRuntimeRoot({ runtimeRoot: join(sourceAlias, ".runtime-proof"), repoRoot: process.cwd() }),
    /runtime_root_inside_git_tree/
  );
});

test("persistent runtime profile rejects case-insensitive wrong-sibling aliases when supported", async (t) => {
  const codeRootAlias = await caseAliasForExistingPath(resolve(process.cwd(), "..", ".."));
  if (!codeRootAlias) {
    t.skip("case-insensitive parent alias is not available on this filesystem");
    return;
  }

  await assert.rejects(
    () => prepareRuntimeRoot({ runtimeRoot: join(codeRootAlias, "TCRN-AOS", "runtime-proof"), repoRoot: process.cwd() }),
    /runtime_root_aliases_wrong_sibling/
  );
});

async function caseAliasForExistingPath(path) {
  const canonicalPath = await realpath(path);
  const candidates = [];
  if (canonicalPath.startsWith("/Users/")) {
    candidates.push(canonicalPath.replace(/^\/Users\//, "/users/"));
  }

  for (const candidate of candidates) {
    if (candidate === canonicalPath) {
      continue;
    }
    try {
      if (await realpath(candidate) === canonicalPath) {
        return candidate;
      }
    } catch {
      // Unsupported on this filesystem.
    }
  }
  return null;
}
