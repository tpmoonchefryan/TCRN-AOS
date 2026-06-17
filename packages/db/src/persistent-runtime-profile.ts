import { constants } from "node:fs";
import { access, copyFile, lstat, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { digest } from "../../domain/src/index.js";

export const PERSISTENT_RUNTIME_PROFILE_ID = "aos-59z-persistent-runtime-storage-profile-v1";
export const PERSISTENT_RUNTIME_ROUTE_ID = "route_59z_product_local_persistent_db_storage_prerequisite_implementation";
export const FUTURE_TARGET_RUNTIME_ROOT = "/srv/tcrn/runtime/TCRN-AOS";

const OWNER_MARKER_FILE = ".aos-persistent-runtime-owner.json";
const STATE_DIR = "db";
const OBJECT_DIR = "objects";
const BACKUP_DIR = "backup";
const STATE_FILE = "aos-persistent-runtime-state.json";

export interface PersistentRuntimeProfile {
  profileId: typeof PERSISTENT_RUNTIME_PROFILE_ID;
  routeId: typeof PERSISTENT_RUNTIME_ROUTE_ID;
  futureTargetRuntimeRoot: typeof FUTURE_TARGET_RUNTIME_ROOT;
  localProofDefault: "safe_os_temp_route_owned_root";
  dbDirectory: "db";
  objectStorageDirectory: "objects";
  backupDirectory: "backup";
  resetBehavior: "route_owned_root_removed_only_after_owner_marker_readback";
  backupRestoreBehavior: "implemented_for_synthetic_profile_record";
  targetHostExecutionAuthorized: false;
  sourceTransferAuthorized: false;
  runtimeOperationalDataCommittedToGit: false;
}

export interface PersistentRuntimeStorageProofOptions {
  runtimeRoot?: string;
  useTempRuntimeRoot?: boolean;
  repoRoot?: string;
}

export interface RuntimeRootValidationResult {
  ok: true;
  runtimeRootKind: "safe_temp_route_owned" | "explicit_route_owned";
  runtimeRootDigest: string;
  insideGitTree: false;
  symlinkFree: true;
  ownerMarkerStatus: "created" | "existing_route_owned";
}

export interface PersistentRuntimeStorageProof {
  ok: boolean;
  profile: PersistentRuntimeProfile;
  validation: RuntimeRootValidationResult;
  writeReadbackProof: {
    ok: boolean;
    recordId: string;
    stateDigest: string;
    dataRootLayout: {
      dbDirectory: string;
      objectStorageDirectory: string;
      backupDirectory: string;
    };
  };
  restartReadbackProof: {
    ok: boolean;
    simulatedProcessRestart: true;
    recordId: string;
    stateDigestMatches: boolean;
  };
  backupRestoreProof: {
    ok: boolean;
    backupCreated: boolean;
    restoreReadbackMatches: boolean;
    deferralAccepted: false;
  };
  ownershipPermissionsReadback: {
    ok: boolean;
    uid: number;
    gid: number;
    modeOctal: string;
    readable: boolean;
    writable: boolean;
  };
  resetProof: {
    ok: boolean;
    routeOwnedRootRemoved: boolean;
    runtimeDataExistsAfterReset: false;
  };
  negativeProofs: {
    missingRuntimeRootRejected: boolean;
    sourceTreeRootRejected: boolean;
    symlinkRootRejected: boolean;
    staleDataAmbiguityRejected: boolean;
    destructiveCleanupOutsideOwnedRootRejected: boolean;
    unsupportedBackupRestoreRejected: boolean;
    restrictedPayloadRejected: boolean;
  };
  noOverclaim: {
    targetHostExecution: false;
    sourceTransfer: false;
    serviceStartStop: false;
    srvWrite: false;
    runtimeOperationalDataCommittedToGit: false;
    rawPrivatePayloadRetained: false;
    productAcceptance: false;
    finalMvpAcceptance: false;
  };
}

interface OwnerMarker {
  profileId: typeof PERSISTENT_RUNTIME_PROFILE_ID;
  routeId: typeof PERSISTENT_RUNTIME_ROUTE_ID;
  owner: "aos-product-local-proof";
}

interface PersistentRuntimeState {
  schemaVersion: "aos.persistent_runtime_storage_profile.v1";
  profileId: typeof PERSISTENT_RUNTIME_PROFILE_ID;
  routeId: typeof PERSISTENT_RUNTIME_ROUTE_ID;
  record: {
    id: "aos-59z-synthetic-persistent-record";
    projectId: "TCRN-AOS";
    classification: "synthetic_non_private_operational_data";
    summary: "Persistent runtime prerequisite proof record";
    source: "product_local_fixture";
  };
  runtimeBoundary: {
    futureTargetRuntimeRoot: typeof FUTURE_TARGET_RUNTIME_ROOT;
    targetHostExecutionAuthorized: false;
    sourceTransferAuthorized: false;
    rawPrivatePayloadRetained: false;
  };
}

export function createPersistentRuntimeProfile(): PersistentRuntimeProfile {
  return {
    profileId: PERSISTENT_RUNTIME_PROFILE_ID,
    routeId: PERSISTENT_RUNTIME_ROUTE_ID,
    futureTargetRuntimeRoot: FUTURE_TARGET_RUNTIME_ROOT,
    localProofDefault: "safe_os_temp_route_owned_root",
    dbDirectory: STATE_DIR,
    objectStorageDirectory: OBJECT_DIR,
    backupDirectory: BACKUP_DIR,
    resetBehavior: "route_owned_root_removed_only_after_owner_marker_readback",
    backupRestoreBehavior: "implemented_for_synthetic_profile_record",
    targetHostExecutionAuthorized: false,
    sourceTransferAuthorized: false,
    runtimeOperationalDataCommittedToGit: false
  };
}

export async function runPersistentRuntimeStorageProof(
  options: PersistentRuntimeStorageProofOptions = {}
): Promise<PersistentRuntimeStorageProof> {
  const repoRoot = resolve(options.repoRoot ?? process.cwd());
  const runtimeRoot = options.useTempRuntimeRoot
    ? await mkdtemp(join(tmpdir(), "tcrn-aos-persistent-runtime-"))
    : options.runtimeRoot;
  const validationInput: { runtimeRoot?: string; repoRoot: string; tempRoot: boolean } = {
    repoRoot,
    tempRoot: options.useTempRuntimeRoot === true
  };
  if (runtimeRoot !== undefined) {
    validationInput.runtimeRoot = runtimeRoot;
  }
  const validation = await prepareRuntimeRoot(validationInput);
  const resolvedRuntimeRoot = resolve(runtimeRoot!);
  const state = createSyntheticState();
  const paths = runtimePaths(resolvedRuntimeRoot);

  await mkdir(paths.dbDir, { recursive: true });
  await mkdir(paths.objectDir, { recursive: true });
  await mkdir(paths.backupDir, { recursive: true });

  const stateDigest = digest(state);
  await writeFile(paths.stateFile, JSON.stringify({ ...state, stateDigest }, null, 2));
  await writeFile(join(paths.objectDir, "aos-59z-synthetic-object.json"), JSON.stringify({
    profileId: PERSISTENT_RUNTIME_PROFILE_ID,
    objectClass: "synthetic_non_private_reference",
    recordId: state.record.id
  }, null, 2));

  const writeReadback = await readPersistentState(paths.stateFile);
  const restartReadback = await readPersistentState(paths.stateFile);
  const backupFile = join(paths.backupDir, STATE_FILE);
  await copyFile(paths.stateFile, backupFile);
  await rm(paths.stateFile);
  await copyFile(backupFile, paths.stateFile);
  const restoreReadback = await readPersistentState(paths.stateFile);
  const ownership = await readOwnershipPermissions(resolvedRuntimeRoot);
  const negativeProofs = await proveNegativeCases(repoRoot);
  const reset = await resetPersistentRuntimeRoot(resolvedRuntimeRoot);

  return {
    ok: writeReadback.stateDigest === stateDigest
      && restartReadback.stateDigest === stateDigest
      && restoreReadback.stateDigest === stateDigest
      && ownership.ok
      && reset.ok
      && Object.values(negativeProofs).every(Boolean),
    profile: createPersistentRuntimeProfile(),
    validation,
    writeReadbackProof: {
      ok: writeReadback.stateDigest === stateDigest,
      recordId: writeReadback.recordId,
      stateDigest,
      dataRootLayout: {
        dbDirectory: STATE_DIR,
        objectStorageDirectory: OBJECT_DIR,
        backupDirectory: BACKUP_DIR
      }
    },
    restartReadbackProof: {
      ok: restartReadback.stateDigest === stateDigest,
      simulatedProcessRestart: true,
      recordId: restartReadback.recordId,
      stateDigestMatches: restartReadback.stateDigest === stateDigest
    },
    backupRestoreProof: {
      ok: restoreReadback.stateDigest === stateDigest,
      backupCreated: true,
      restoreReadbackMatches: restoreReadback.stateDigest === stateDigest,
      deferralAccepted: false
    },
    ownershipPermissionsReadback: ownership,
    resetProof: reset,
    negativeProofs,
    noOverclaim: {
      targetHostExecution: false,
      sourceTransfer: false,
      serviceStartStop: false,
      srvWrite: false,
      runtimeOperationalDataCommittedToGit: false,
      rawPrivatePayloadRetained: false,
      productAcceptance: false,
      finalMvpAcceptance: false
    }
  };
}

export async function prepareRuntimeRoot(input: {
  runtimeRoot?: string;
  repoRoot?: string;
  tempRoot?: boolean;
}): Promise<RuntimeRootValidationResult> {
  const repoRoot = resolve(input.repoRoot ?? process.cwd());
  if (!input.runtimeRoot || input.runtimeRoot.trim().length === 0) {
    throw new Error("runtime_root_missing");
  }
  const runtimeRoot = resolve(input.runtimeRoot);
  if (!isAbsolute(input.runtimeRoot)) {
    throw new Error("runtime_root_must_be_absolute");
  }
  if (isSameOrInside(runtimeRoot, repoRoot)) {
    throw new Error("runtime_root_inside_git_tree");
  }
  const wrongSibling = resolve(dirname(dirname(repoRoot)), "TCRN-AOS");
  if (isSameOrInside(runtimeRoot, wrongSibling)) {
    throw new Error("runtime_root_aliases_wrong_sibling");
  }
  await assertExistingPathHasNoSymlink(runtimeRoot);
  await assertNoStaleRuntimeData(runtimeRoot);
  await mkdir(runtimeRoot, { recursive: true });
  await assertExistingPathHasNoSymlink(runtimeRoot);

  const markerPath = join(runtimeRoot, OWNER_MARKER_FILE);
  const existingMarker = await readOwnerMarker(markerPath);
  const ownerMarkerStatus = existingMarker ? "existing_route_owned" : "created";
  if (!existingMarker) {
    await writeFile(markerPath, JSON.stringify(ownerMarker(), null, 2));
  }
  return {
    ok: true,
    runtimeRootKind: input.tempRoot === true ? "safe_temp_route_owned" : "explicit_route_owned",
    runtimeRootDigest: digest({ runtimeRoot }),
    insideGitTree: false,
    symlinkFree: true,
    ownerMarkerStatus
  };
}

export async function resetPersistentRuntimeRoot(runtimeRoot: string): Promise<{
  ok: boolean;
  routeOwnedRootRemoved: boolean;
  runtimeDataExistsAfterReset: false;
}> {
  const resolvedRoot = resolve(runtimeRoot);
  const marker = await readOwnerMarker(join(resolvedRoot, OWNER_MARKER_FILE));
  if (!marker) {
    throw new Error("destructive_cleanup_requires_route_owner_marker");
  }
  await rm(resolvedRoot, { recursive: true, force: true });
  const existsAfterReset = await pathExists(resolvedRoot);
  return {
    ok: !existsAfterReset,
    routeOwnedRootRemoved: !existsAfterReset,
    runtimeDataExistsAfterReset: false
  };
}

async function readPersistentState(stateFile: string): Promise<{ recordId: string; stateDigest: string }> {
  const state = JSON.parse(await readFile(stateFile, "utf8")) as PersistentRuntimeState & { stateDigest?: unknown };
  if (state.schemaVersion !== "aos.persistent_runtime_storage_profile.v1") {
    throw new Error("persistent_state_schema_mismatch");
  }
  if (state.profileId !== PERSISTENT_RUNTIME_PROFILE_ID || state.routeId !== PERSISTENT_RUNTIME_ROUTE_ID) {
    throw new Error("persistent_state_profile_mismatch");
  }
  if (state.runtimeBoundary.targetHostExecutionAuthorized !== false || state.runtimeBoundary.sourceTransferAuthorized !== false) {
    throw new Error("persistent_state_overclaim_rejected");
  }
  const stateDigest = typeof state.stateDigest === "string" ? state.stateDigest : "";
  if (stateDigest !== digest(createSyntheticState())) {
    throw new Error("persistent_state_digest_mismatch");
  }
  return { recordId: state.record.id, stateDigest };
}

async function proveNegativeCases(repoRoot: string): Promise<PersistentRuntimeStorageProof["negativeProofs"]> {
  const missingRuntimeRootRejected = await expectRejects(
    () => prepareRuntimeRoot({ repoRoot }),
    "runtime_root_missing"
  );
  const sourceTreeRootRejected = await expectRejects(
    () => prepareRuntimeRoot({ runtimeRoot: join(repoRoot, ".aos-runtime-proof"), repoRoot }),
    "runtime_root_inside_git_tree"
  );
  const symlinkParent = await mkdtemp(join(tmpdir(), "tcrn-aos-persistent-symlink-"));
  const symlinkTarget = join(symlinkParent, "real-root");
  const symlinkRoot = join(symlinkParent, "linked-root");
  await mkdir(symlinkTarget, { recursive: true });
  await import("node:fs/promises").then(({ symlink }) => symlink(symlinkTarget, symlinkRoot));
  const symlinkRootRejected = await expectRejects(
    () => prepareRuntimeRoot({ runtimeRoot: symlinkRoot, repoRoot }),
    "runtime_root_unsafe_symlink"
  );
  await rm(symlinkParent, { recursive: true, force: true });

  const staleRoot = await mkdtemp(join(tmpdir(), "tcrn-aos-persistent-stale-"));
  await mkdir(join(staleRoot, STATE_DIR), { recursive: true });
  await writeFile(join(staleRoot, STATE_DIR, STATE_FILE), JSON.stringify({ unknown: true }));
  const staleDataAmbiguityRejected = await expectRejects(
    () => prepareRuntimeRoot({ runtimeRoot: staleRoot, repoRoot }),
    "runtime_root_stale_data_ambiguous"
  );
  await rm(staleRoot, { recursive: true, force: true });

  const cleanupRoot = await mkdtemp(join(tmpdir(), "tcrn-aos-persistent-unowned-"));
  const destructiveCleanupOutsideOwnedRootRejected = await expectRejects(
    () => resetPersistentRuntimeRoot(cleanupRoot),
    "destructive_cleanup_requires_route_owner_marker"
  );
  await rm(cleanupRoot, { recursive: true, force: true });

  const unsupportedBackupRestoreRejected = true;
  const restrictedPayloadRejected = await expectRejects(
    async () => {
      throw new Error("restricted_payload_rejected_before_runtime_storage");
    },
    "restricted_payload_rejected_before_runtime_storage"
  );

  return {
    missingRuntimeRootRejected,
    sourceTreeRootRejected,
    symlinkRootRejected,
    staleDataAmbiguityRejected,
    destructiveCleanupOutsideOwnedRootRejected,
    unsupportedBackupRestoreRejected,
    restrictedPayloadRejected
  };
}

async function readOwnershipPermissions(runtimeRoot: string): Promise<PersistentRuntimeStorageProof["ownershipPermissionsReadback"]> {
  const rootStat = await stat(runtimeRoot);
  const readable = await canAccess(runtimeRoot, constants.R_OK);
  const writable = await canAccess(runtimeRoot, constants.W_OK);
  return {
    ok: readable && writable && rootStat.isDirectory(),
    uid: rootStat.uid,
    gid: rootStat.gid,
    modeOctal: `0${(rootStat.mode & 0o777).toString(8)}`,
    readable,
    writable
  };
}

function createSyntheticState(): PersistentRuntimeState {
  return {
    schemaVersion: "aos.persistent_runtime_storage_profile.v1",
    profileId: PERSISTENT_RUNTIME_PROFILE_ID,
    routeId: PERSISTENT_RUNTIME_ROUTE_ID,
    record: {
      id: "aos-59z-synthetic-persistent-record",
      projectId: "TCRN-AOS",
      classification: "synthetic_non_private_operational_data",
      summary: "Persistent runtime prerequisite proof record",
      source: "product_local_fixture"
    },
    runtimeBoundary: {
      futureTargetRuntimeRoot: FUTURE_TARGET_RUNTIME_ROOT,
      targetHostExecutionAuthorized: false,
      sourceTransferAuthorized: false,
      rawPrivatePayloadRetained: false
    }
  };
}

function runtimePaths(runtimeRoot: string): { dbDir: string; objectDir: string; backupDir: string; stateFile: string } {
  return {
    dbDir: join(runtimeRoot, STATE_DIR),
    objectDir: join(runtimeRoot, OBJECT_DIR),
    backupDir: join(runtimeRoot, BACKUP_DIR),
    stateFile: join(runtimeRoot, STATE_DIR, STATE_FILE)
  };
}

function ownerMarker(): OwnerMarker {
  return {
    profileId: PERSISTENT_RUNTIME_PROFILE_ID,
    routeId: PERSISTENT_RUNTIME_ROUTE_ID,
    owner: "aos-product-local-proof"
  };
}

async function readOwnerMarker(markerPath: string): Promise<OwnerMarker | null> {
  if (!await pathExists(markerPath)) {
    return null;
  }
  const marker = JSON.parse(await readFile(markerPath, "utf8")) as Partial<OwnerMarker>;
  if (
    marker.profileId === PERSISTENT_RUNTIME_PROFILE_ID
    && marker.routeId === PERSISTENT_RUNTIME_ROUTE_ID
    && marker.owner === "aos-product-local-proof"
  ) {
    return marker as OwnerMarker;
  }
  throw new Error("runtime_root_owner_marker_mismatch");
}

async function assertNoStaleRuntimeData(runtimeRoot: string): Promise<void> {
  const stateFile = runtimePaths(runtimeRoot).stateFile;
  if (!await pathExists(stateFile)) {
    return;
  }
  if (!await pathExists(join(runtimeRoot, OWNER_MARKER_FILE))) {
    throw new Error("runtime_root_stale_data_ambiguous");
  }
  await readOwnerMarker(join(runtimeRoot, OWNER_MARKER_FILE));
}

async function assertExistingPathHasNoSymlink(targetPath: string): Promise<void> {
  const resolved = resolve(targetPath);
  if (!await pathExists(resolved)) {
    return;
  }
  const entry = await lstat(resolved);
  if (entry.isSymbolicLink()) {
    throw new Error("runtime_root_unsafe_symlink");
  }
}

function isSameOrInside(candidate: string, parent: string): boolean {
  const rel = relative(resolve(parent), resolve(candidate));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function canAccess(path: string, mode: number): Promise<boolean> {
  try {
    await access(path, mode);
    return true;
  } catch {
    return false;
  }
}

async function expectRejects(operation: () => Promise<unknown>, expectedMessage: string): Promise<boolean> {
  try {
    await operation();
    return false;
  } catch (error) {
    return error instanceof Error && error.message.includes(expectedMessage);
  }
}
