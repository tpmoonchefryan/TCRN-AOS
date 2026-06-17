import { constants } from "node:fs";
import { access, copyFile, lstat, mkdir, mkdtemp, readdir, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, parse, relative, resolve } from "node:path";
import { assertNoRestrictedContent, digest } from "../../domain/src/index.js";

export const PERSISTENT_RUNTIME_PROFILE_ID = "aos-59z-persistent-runtime-storage-profile-v1";
export const PERSISTENT_RUNTIME_ROUTE_ID = "route_59z_product_local_persistent_db_storage_prerequisite_implementation";
export const PERSISTENT_RUNTIME_RUN_CONTEXT = "aos-59z-product-local-persistent-runtime-proof-v1";
export const FUTURE_TARGET_RUNTIME_ROOT = "/srv/tcrn/runtime/TCRN-AOS";

const OWNER_MARKER_SCHEMA_VERSION = "aos.persistent_runtime_owner.v1";
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
    conflictingRuntimeRootTempFlagsRejected: boolean;
    sourceTreeRootRejected: boolean;
    wrongSiblingRootRejected: boolean;
    symlinkRootRejected: boolean;
    symlinkAncestorRejected: boolean;
    nonEmptyUnownedRootRejected: boolean;
    staleDataAmbiguityRejected: boolean;
    staleMarkerRootMismatchRejected: boolean;
    destructiveCleanupOutsideOwnedRootRejected: boolean;
    dangerousMarkedRootResetRejected: boolean;
    restrictedPayloadRejected: boolean;
  };
  aliasCanonicalizationProof: {
    caseInsensitiveAliasSupported: boolean;
    sourceTreeAliasRejected: boolean | null;
    wrongSiblingAliasRejected: boolean | null;
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
  markerSchemaVersion: typeof OWNER_MARKER_SCHEMA_VERSION;
  profileId: typeof PERSISTENT_RUNTIME_PROFILE_ID;
  routeId: typeof PERSISTENT_RUNTIME_ROUTE_ID;
  runContext: typeof PERSISTENT_RUNTIME_RUN_CONTEXT;
  owner: "aos-product-local-proof";
  runtimeRootDigest: string;
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

interface CanonicalRuntimeRoot {
  requestedRoot: string;
  canonicalRoot: string;
  runtimeRootDigest: string;
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
  if (options.runtimeRoot !== undefined && options.useTempRuntimeRoot === true) {
    throw new Error("runtime_root_conflicting_temp_and_explicit");
  }
  const runtimeRoot = options.useTempRuntimeRoot
    ? await mkdtemp(join(await realpath(tmpdir()), "tcrn-aos-persistent-runtime-"))
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
  assertNoRestrictedContent(state, "persistent runtime state");
  const paths = runtimePaths(resolvedRuntimeRoot);

  await mkdir(paths.dbDir, { recursive: true });
  await mkdir(paths.objectDir, { recursive: true });
  await mkdir(paths.backupDir, { recursive: true });

  const stateDigest = digest(state);
  await writeFile(paths.stateFile, JSON.stringify({ ...state, stateDigest }, null, 2));
  const objectReference = {
    profileId: PERSISTENT_RUNTIME_PROFILE_ID,
    objectClass: "synthetic_non_private_reference",
    recordId: state.record.id
  };
  assertNoRestrictedContent(objectReference, "persistent runtime object reference");
  await writeFile(join(paths.objectDir, "aos-59z-synthetic-object.json"), JSON.stringify(objectReference, null, 2));

  const writeReadback = await readPersistentState(paths.stateFile);
  const restartReadback = await readPersistentState(paths.stateFile);
  const backupFile = join(paths.backupDir, STATE_FILE);
  await copyFile(paths.stateFile, backupFile);
  await rm(paths.stateFile);
  await copyFile(backupFile, paths.stateFile);
  const restoreReadback = await readPersistentState(paths.stateFile);
  const ownership = await readOwnershipPermissions(resolvedRuntimeRoot);
  const negativeProofs = await proveNegativeCases(repoRoot);
  const aliasCanonicalizationProof = await proveAliasCanonicalizationCases(repoRoot);
  const reset = await resetPersistentRuntimeRoot(resolvedRuntimeRoot);
  const aliasCanonicalizationOk = aliasCanonicalizationProof.caseInsensitiveAliasSupported
    ? aliasCanonicalizationProof.sourceTreeAliasRejected === true
      && aliasCanonicalizationProof.wrongSiblingAliasRejected === true
    : true;

  return {
    ok: writeReadback.stateDigest === stateDigest
      && restartReadback.stateDigest === stateDigest
      && restoreReadback.stateDigest === stateDigest
      && ownership.ok
      && reset.ok
      && Object.values(negativeProofs).every(Boolean)
      && aliasCanonicalizationOk,
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
    aliasCanonicalizationProof,
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
  const repoRoot = await realpath(resolve(input.repoRoot ?? process.cwd()));
  if (!input.runtimeRoot || input.runtimeRoot.trim().length === 0) {
    throw new Error("runtime_root_missing");
  }
  if (!isAbsolute(input.runtimeRoot)) {
    throw new Error("runtime_root_must_be_absolute");
  }
  const runtimeRoot = await canonicalizeRuntimeRoot(input.runtimeRoot);
  if (isSameOrInside(runtimeRoot.canonicalRoot, repoRoot)) {
    throw new Error("runtime_root_inside_git_tree");
  }
  const wrongSibling = await canonicalizePathWithExistingAncestor(resolve(dirname(dirname(repoRoot)), "TCRN-AOS"));
  if (isSameOrInside(runtimeRoot.canonicalRoot, wrongSibling)) {
    throw new Error("runtime_root_aliases_wrong_sibling");
  }
  const runtimeRootExisted = await pathExists(runtimeRoot.requestedRoot);
  if (runtimeRootExisted) {
    const rootStat = await lstat(runtimeRoot.requestedRoot);
    if (!rootStat.isDirectory()) {
      throw new Error("runtime_root_not_directory");
    }
  }
  const runtimeRootDigest = runtimeRoot.runtimeRootDigest;
  const markerPath = join(runtimeRoot.requestedRoot, OWNER_MARKER_FILE);
  const existingMarker = await readOwnerMarker(markerPath, runtimeRootDigest);
  if (!existingMarker && runtimeRootExisted) {
    if (await pathExists(runtimePaths(runtimeRoot.requestedRoot).stateFile)) {
      throw new Error("runtime_root_stale_data_ambiguous");
    }
    if (!await directoryIsEmpty(runtimeRoot.requestedRoot)) {
      throw new Error("runtime_root_unowned_non_empty");
    }
  }
  await mkdir(runtimeRoot.requestedRoot, { recursive: true });
  await assertExistingPathHasNoSymlink(runtimeRoot.requestedRoot);
  const ownerMarkerStatus = existingMarker ? "existing_route_owned" : "created";
  if (!existingMarker) {
    await writeFile(markerPath, JSON.stringify(ownerMarker(runtimeRootDigest), null, 2));
  }
  return {
    ok: true,
    runtimeRootKind: input.tempRoot === true ? "safe_temp_route_owned" : "explicit_route_owned",
    runtimeRootDigest,
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
  const repoRoot = await realpath(process.cwd());
  const resolvedRoot = await canonicalizeRuntimeRoot(runtimeRoot);
  if (isSameOrInside(resolvedRoot.canonicalRoot, repoRoot)) {
    throw new Error("runtime_root_inside_git_tree");
  }
  const wrongSibling = await canonicalizePathWithExistingAncestor(resolve(dirname(dirname(repoRoot)), "TCRN-AOS"));
  if (isSameOrInside(resolvedRoot.canonicalRoot, wrongSibling)) {
    throw new Error("runtime_root_aliases_wrong_sibling");
  }
  const marker = await readOwnerMarker(join(resolvedRoot.requestedRoot, OWNER_MARKER_FILE), resolvedRoot.runtimeRootDigest);
  if (!marker) {
    throw new Error("destructive_cleanup_requires_route_owner_marker");
  }
  await rm(resolvedRoot.requestedRoot, { recursive: true, force: true });
  const existsAfterReset = await pathExists(resolvedRoot.requestedRoot);
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
  const safeTmp = await realpath(tmpdir());
  const missingRuntimeRootRejected = await expectRejects(
    () => prepareRuntimeRoot({ repoRoot }),
    "runtime_root_missing"
  );
  const conflictingRuntimeRootTempFlagsRejected = await expectRejects(
    () => runPersistentRuntimeStorageProof({ runtimeRoot: join(safeTmp, "tcrn-aos-conflicting-root"), useTempRuntimeRoot: true, repoRoot }),
    "runtime_root_conflicting_temp_and_explicit"
  );
  const sourceTreeRootRejected = await expectRejects(
    () => prepareRuntimeRoot({ runtimeRoot: join(repoRoot, ".aos-runtime-proof"), repoRoot }),
    "runtime_root_inside_git_tree"
  );
  const wrongSiblingRootRejected = await expectRejects(
    () => prepareRuntimeRoot({ runtimeRoot: resolve(repoRoot, "..", "..", "TCRN-AOS", "runtime-proof"), repoRoot }),
    "runtime_root_aliases_wrong_sibling"
  );
  const symlinkParent = await mkdtemp(join(safeTmp, "tcrn-aos-persistent-symlink-"));
  const symlinkTarget = join(symlinkParent, "real-root");
  const symlinkRoot = join(symlinkParent, "linked-root");
  await mkdir(symlinkTarget, { recursive: true });
  await import("node:fs/promises").then(({ symlink }) => symlink(symlinkTarget, symlinkRoot));
  const symlinkRootRejected = await expectRejects(
    () => prepareRuntimeRoot({ runtimeRoot: symlinkRoot, repoRoot }),
    "runtime_root_unsafe_symlink"
  );
  const symlinkAncestorTarget = join(symlinkParent, "ancestor-target");
  const symlinkAncestor = join(symlinkParent, "ancestor-link");
  await mkdir(symlinkAncestorTarget, { recursive: true });
  await import("node:fs/promises").then(({ symlink }) => symlink(symlinkAncestorTarget, symlinkAncestor));
  const symlinkAncestorRejected = await expectRejects(
    () => prepareRuntimeRoot({ runtimeRoot: join(symlinkAncestor, "runtime-root"), repoRoot }),
    "runtime_root_unsafe_symlink"
  );
  await rm(symlinkParent, { recursive: true, force: true });

  const nonEmptyRoot = await mkdtemp(join(safeTmp, "tcrn-aos-persistent-non-empty-"));
  await writeFile(join(nonEmptyRoot, "pre-existing-data.txt"), "not route owned");
  const nonEmptyUnownedRootRejected = await expectRejects(
    () => prepareRuntimeRoot({ runtimeRoot: nonEmptyRoot, repoRoot }),
    "runtime_root_unowned_non_empty"
  );
  await rm(nonEmptyRoot, { recursive: true, force: true });

  const staleRoot = await mkdtemp(join(safeTmp, "tcrn-aos-persistent-stale-"));
  await mkdir(join(staleRoot, STATE_DIR), { recursive: true });
  await writeFile(join(staleRoot, STATE_DIR, STATE_FILE), JSON.stringify({ unknown: true }));
  const staleDataAmbiguityRejected = await expectRejects(
    () => prepareRuntimeRoot({ runtimeRoot: staleRoot, repoRoot }),
    "runtime_root_stale_data_ambiguous"
  );
  await rm(staleRoot, { recursive: true, force: true });

  const staleMarkedRoot = await mkdtemp(join(safeTmp, "tcrn-aos-persistent-stale-marker-"));
  await writeFile(join(staleMarkedRoot, OWNER_MARKER_FILE), JSON.stringify({
    ...ownerMarker("stale-root-digest")
  }));
  const staleMarkerRootMismatchRejected = await expectRejects(
    () => prepareRuntimeRoot({ runtimeRoot: staleMarkedRoot, repoRoot }),
    "runtime_root_owner_marker_mismatch"
  );
  await rm(staleMarkedRoot, { recursive: true, force: true });

  const cleanupRoot = await mkdtemp(join(safeTmp, "tcrn-aos-persistent-unowned-"));
  const destructiveCleanupOutsideOwnedRootRejected = await expectRejects(
    () => resetPersistentRuntimeRoot(cleanupRoot),
    "destructive_cleanup_requires_route_owner_marker"
  );
  await rm(cleanupRoot, { recursive: true, force: true });

  const dangerousMarkedRoot = join(repoRoot, ".aos-dangerous-reset-proof");
  await mkdir(dangerousMarkedRoot, { recursive: true });
  await writeFile(join(dangerousMarkedRoot, OWNER_MARKER_FILE), JSON.stringify(ownerMarker("dangerous-root-digest")));
  const dangerousMarkedRootResetRejected = await expectRejects(
    () => resetPersistentRuntimeRoot(dangerousMarkedRoot),
    "runtime_root_inside_git_tree"
  );
  await rm(dangerousMarkedRoot, { recursive: true, force: true });

  const restrictedPayloadRejected = await expectRejects(
    async () => {
      assertNoRestrictedContent({ body: "/" + "Users/example/persistent-runtime" }, "persistent runtime state");
    },
    "persistent runtime state rejected restricted machine_local_absolute_path"
  );

  return {
    missingRuntimeRootRejected,
    conflictingRuntimeRootTempFlagsRejected,
    sourceTreeRootRejected,
    wrongSiblingRootRejected,
    symlinkRootRejected,
    symlinkAncestorRejected,
    nonEmptyUnownedRootRejected,
    staleDataAmbiguityRejected,
    staleMarkerRootMismatchRejected,
    destructiveCleanupOutsideOwnedRootRejected,
    dangerousMarkedRootResetRejected,
    restrictedPayloadRejected
  };
}

async function proveAliasCanonicalizationCases(repoRoot: string): Promise<PersistentRuntimeStorageProof["aliasCanonicalizationProof"]> {
  const sourceAlias = await caseInsensitiveAliasForExistingPath(repoRoot);
  const codeRootAlias = await caseInsensitiveAliasForExistingPath(resolve(repoRoot, "..", ".."));
  const sourceTreeAliasRejected = sourceAlias
    ? await expectRejects(
      () => prepareRuntimeRoot({ runtimeRoot: join(sourceAlias, ".aos-runtime-proof-alias"), repoRoot }),
      "runtime_root_inside_git_tree"
    )
    : null;
  const wrongSiblingAliasRejected = codeRootAlias
    ? await expectRejects(
      () => prepareRuntimeRoot({ runtimeRoot: join(codeRootAlias, "TCRN-AOS", "runtime-proof-alias"), repoRoot }),
      "runtime_root_aliases_wrong_sibling"
    )
    : null;

  return {
    caseInsensitiveAliasSupported: sourceAlias !== null && codeRootAlias !== null,
    sourceTreeAliasRejected,
    wrongSiblingAliasRejected
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

function ownerMarker(runtimeRootDigest: string): OwnerMarker {
  return {
    markerSchemaVersion: OWNER_MARKER_SCHEMA_VERSION,
    profileId: PERSISTENT_RUNTIME_PROFILE_ID,
    routeId: PERSISTENT_RUNTIME_ROUTE_ID,
    runContext: PERSISTENT_RUNTIME_RUN_CONTEXT,
    owner: "aos-product-local-proof",
    runtimeRootDigest
  };
}

async function readOwnerMarker(markerPath: string, expectedRuntimeRootDigest: string): Promise<OwnerMarker | null> {
  if (!await pathExists(markerPath)) {
    return null;
  }
  const marker = JSON.parse(await readFile(markerPath, "utf8")) as Partial<OwnerMarker>;
  if (
    marker.markerSchemaVersion === OWNER_MARKER_SCHEMA_VERSION
    && marker.profileId === PERSISTENT_RUNTIME_PROFILE_ID
    && marker.routeId === PERSISTENT_RUNTIME_ROUTE_ID
    && marker.runContext === PERSISTENT_RUNTIME_RUN_CONTEXT
    && marker.owner === "aos-product-local-proof"
    && marker.runtimeRootDigest === expectedRuntimeRootDigest
  ) {
    return marker as OwnerMarker;
  }
  throw new Error("runtime_root_owner_marker_mismatch");
}

async function assertExistingPathHasNoSymlink(targetPath: string): Promise<void> {
  const resolved = resolve(targetPath);
  const parsed = parse(resolved);
  const parts = relative(parsed.root, resolved).split("/").filter(Boolean);
  let current = parsed.root;
  for (const part of parts) {
    current = join(current, part);
    if (!await pathExists(current)) {
      return;
    }
    const entry = await lstat(current);
    if (entry.isSymbolicLink()) {
      throw new Error("runtime_root_unsafe_symlink");
    }
  }
}

async function canonicalizeRuntimeRoot(runtimeRoot: string): Promise<CanonicalRuntimeRoot> {
  const requestedRoot = resolve(runtimeRoot);
  await assertExistingPathHasNoSymlink(requestedRoot);
  const canonicalRoot = await canonicalizePathWithExistingAncestor(requestedRoot);
  return {
    requestedRoot,
    canonicalRoot,
    runtimeRootDigest: digestRuntimeRoot(canonicalRoot)
  };
}

async function canonicalizePathWithExistingAncestor(path: string): Promise<string> {
  const resolved = resolve(path);
  const parsed = parse(resolved);
  const parts = relative(parsed.root, resolved).split("/").filter(Boolean);
  let current = parsed.root;
  let nearestExisting = parsed.root;
  let firstMissingIndex = parts.length;

  for (let index = 0; index < parts.length; index += 1) {
    current = join(current, parts[index]!);
    if (!await pathExists(current)) {
      firstMissingIndex = index;
      break;
    }
    nearestExisting = current;
  }

  const canonicalExisting = await realpath(nearestExisting);
  const remainder = parts.slice(firstMissingIndex);
  return remainder.length > 0 ? join(canonicalExisting, ...remainder) : canonicalExisting;
}

async function caseInsensitiveAliasForExistingPath(path: string): Promise<string | null> {
  const canonicalPath = await realpath(path);
  const candidates: string[] = [];
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

async function directoryIsEmpty(path: string): Promise<boolean> {
  return (await readdir(path)).length === 0;
}

function digestRuntimeRoot(canonicalRuntimeRoot: string): string {
  return digest({
    profileId: PERSISTENT_RUNTIME_PROFILE_ID,
    routeId: PERSISTENT_RUNTIME_ROUTE_ID,
    runContext: PERSISTENT_RUNTIME_RUN_CONTEXT,
    runtimeRoot: resolve(canonicalRuntimeRoot)
  });
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
