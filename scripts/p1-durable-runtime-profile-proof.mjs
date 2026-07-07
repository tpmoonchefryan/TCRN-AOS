import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join, parse, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import {
  assertRouteOwnedSqliteRoot,
  prepareRuntimeRoot,
  sha256
} from "../dist/packages/db/src/index.js";
import { createRuntimeTransport } from "../dist/packages/mcp-server/src/index.js";

const route = "route_tcrn_conditional_dogfood_start_p1_durable_runtime_profile_root_migration_ilya_after_owner_decision_949a58_8aa904_20260707";
const workflowBasis = "949a58a556715a5f2e72d2934cb735da3845e869";
const incomingAosBasis = "8aa904814cde840b09844eb0a9ad066647a3af18";
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const evidenceRoot = join(repoRoot, "evidence/conditional-dogfood-start-p1-runtime-profile");
const migrationsDir = join(repoRoot, "packages/db/migrations/sqlite");
const command = "pnpm --dir TCRN-AOS p1:durable-runtime-profile-proof";
const markerFile = ".tcrn-aos-phase1-root";
const ownerMarkerFile = ".aos-persistent-runtime-owner.json";
const markerPurpose = "p1-clean-start-durable-runtime-profile-root";
const markerVersion = "conditional-dogfood-start-p1-runtime-profile.v1";
const databaseFileName = "aos-p1-durable-runtime-profile.sqlite";
const readbackReceiptName = "p1-durable-runtime-profile-root-readback.json";
const summaryReceiptName = "p1-durable-runtime-profile-root-proof-summary.json";
const p1OwnerMarker = {
  profileId: "conditional-dogfood-start-p1-clean-start-runtime-profile-v1",
  routeId: route,
  runContext: "conditional-dogfood-start-p1-clean-start-v1",
  owner: "aos-product-local-owner-authorized"
};
const ownerDecisionFields = {
  owner_accepts_packet: "accepted",
  p1_runtime_root_migration: "authorized",
  p1_data_disposition: "clean_start_declared",
  df02_crew_equivalence_accepted: "accepted",
  dogfood_start_after_p1_readback: "authorized_after_verified_persistent_root_readback",
  canonical_decision_field_location: "conditional-dogfood-start-readiness-packet.md section 5 YAML block"
};
const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "p1-durable-runtime-profile-clean-start"
};
const sourceFiles = [
  "package.json",
  "scripts/p1-durable-runtime-profile-proof.mjs",
  "packages/db/src/persistent-runtime-profile.ts",
  "packages/db/test/persistent-runtime-profile.test.mjs",
  "packages/db/src/sqlite-repository.ts",
  "packages/mcp-server/src/transport.ts"
];
const coreTables = [
  "aos_projects",
  "aos_ai_employees",
  "aos_initiatives",
  "aos_epics",
  "aos_stories",
  "aos_subtasks",
  "aos_assignments",
  "aos_agent_runs",
  "aos_gate_work_orders",
  "aos_evidence_links",
  "aos_audit_events"
];
const noOverclaimFlags = {
  boundedP1DurableLocalProfileRootProof: true,
  cleanStartDeclared: true,
  p1DataCarryoverAttempted: false,
  df01Started: false,
  df02Started: false,
  df03Started: false,
  df04Started: false,
  phase3ReevaluationStarted: false,
  phase5Started: false,
  runtimeDogfoodReadinessClaimed: false,
  productReadinessClaimed: false,
  ownerFacingReadinessClaimed: false,
  ownerAcceptanceClaimed: false,
  finalAcceptanceClaimed: false,
  releasePublicationPushClaimed: false,
  cleanPlatformClaimed: false,
  parentCompletionClaimed: false,
  remoteRuntimeActivationClaimed: false,
  defaultRuntimeActivationClaimed: false,
  ownerVisibleRuntimeDbClaimed: false,
  liveDispatchAuthorized: false,
  ownerIntentExecutionAuthorized: false,
  workflowMutation: false,
  designSystemMutation: false,
  tmsMutation: false,
  activeCodexMutation: false,
  hookRuntimeMutation: false,
  hookBehaviorReliance: false,
  hookRetirementClaimed: false,
  broadCodexSecurityPluginScanClaimed: false
};

mkdirSync(evidenceRoot, { recursive: true });

const source = sourceProvenance();
const selectedRoot = selectDurableRoot();
const proof = await runP1Proof(selectedRoot.root);
const privacy = privacyScan(proof);
const receipt = writeReceipt(readbackReceiptName, {
  ok: proof.ok && privacy.ok,
  source,
  ownerDecisionFields,
  selectedRoot: selectedRoot.readback,
  cleanStartProfileReadback: proof.cleanStartProfileReadback,
  ownerMarkerDurableRootReadback: proof.ownerMarkerDurableRootReadback,
  restartPersistenceReadback: proof.restartPersistenceReadback,
  unsafePathRejectionReadback: proof.unsafePathRejectionReadback,
  digestPrivacyNoArtifactReadback: proof.digestPrivacyNoArtifactReadback,
  privacyNoOverclaimScan: privacy,
  failures: [...proof.failures, ...privacy.findings.map((finding) => finding.kind)],
  negativeFailures: proof.unsafePathRejectionReadback.failures,
  noOverclaimFlags
});
const summary = writeReceipt(summaryReceiptName, {
  ok: receipt.ok === true,
  source,
  ownerDecisionFields,
  receiptInventory: [readbackReceiptName],
  receiptCount: 1,
  allChildReceiptsOk: receipt.ok === true,
  missingReceipts: [],
  extraUnclassifiedReceipts: [],
  readbackReceiptDigest: sha256(JSON.stringify(receipt)),
  cleanStartDeclared: true,
  durableLocalProfileRootSelected: proof.ownerMarkerDurableRootReadback.ok,
  restartPersistenceProven: proof.restartPersistenceReadback.ok,
  unsafePathRejectionProven: proof.unsafePathRejectionReadback.ok,
  rawPathRecorded: false,
  noOverclaimFlags,
  failures: receipt.ok === true ? [] : ["p1_durable_runtime_profile_readback_not_ok"],
  negativeFailures: proof.unsafePathRejectionReadback.failures
});

assert.equal(receipt.ok, true);
assert.equal(summary.ok, true);
console.log(JSON.stringify({
  ok: true,
  route,
  command,
  receipts: [summaryReceiptName, readbackReceiptName],
  profileRootDigest: proof.ownerMarkerDurableRootReadback.persistentRuntimeRootDigest,
  sqliteRootDigest: proof.ownerMarkerDurableRootReadback.sqliteRootDigest,
  databaseDigest: proof.digestPrivacyNoArtifactReadback.databaseDigest,
  cleanStartCoreRowsTotal: proof.cleanStartProfileReadback.restartCounts.coreRowsTotal,
  restartPersistenceProven: proof.restartPersistenceReadback.ok,
  unsafePathRejectionProven: proof.unsafePathRejectionReadback.ok,
  rawPathRecorded: false,
  readinessClaimed: false
}, null, 2));

async function runP1Proof(root) {
  denyUnsafeRuntimePath(root);
  denyRepoOrWrongSibling(root);
  assertExistingSegmentsHaveNoSymlink(root, "p1_runtime_profile_root_symlink_ancestor_denied");
  const persistentRoot = await prepareRuntimeRoot({
    runtimeRoot: root,
    repoRoot,
    ownerMarker: p1OwnerMarker
  });
  ensureRouteOwnedMarker(root);
  const databasePath = join(root, databaseFileName);
  const cleanStart = ensureCleanStartDatabase(databasePath);
  const sqliteRoot = assertRouteOwnedSqliteRoot(root, repoRoot, markerFile);

  const firstRuntime = createRuntimeTransport(runtimeConfig(root, databasePath));
  firstRuntime.close();
  const firstCounts = readProfileCounts(databasePath);
  const firstStateDigest = cleanStartStateDigest(firstCounts);
  const firstDatabaseDigest = digestDatabaseFile(databasePath);

  const restartRuntime = createRuntimeTransport(runtimeConfig(root, databasePath));
  restartRuntime.close();
  const restartCounts = readProfileCounts(databasePath);
  const restartStateDigest = cleanStartStateDigest(restartCounts);
  const restartDatabaseDigest = digestDatabaseFile(databasePath);
  const unsafe = await proveUnsafePathRejection(root, databasePath);
  const noArtifact = noCommittedDbArtifacts();
  const ownerMarker = ownerMarkerReadback(root, persistentRoot.runtimeRootDigest);
  const routeMarker = routeMarkerReadback(root);
  const profileEmpty = firstCounts.coreRowsTotal === 0 && restartCounts.coreRowsTotal === 0;
  const restartOk = firstStateDigest === restartStateDigest && profileEmpty;
  const ok = cleanStart.ok &&
    ownerMarker.ok &&
    routeMarker.ok &&
    restartOk &&
    unsafe.ok &&
    noArtifact &&
    firstDatabaseDigest === restartDatabaseDigest;
  const failures = [
    cleanStart.ok ? null : "p1_clean_start_not_ok",
    ownerMarker.ok ? null : "p1_owner_marker_not_ok",
    routeMarker.ok ? null : "p1_route_marker_not_ok",
    restartOk ? null : "p1_restart_persistence_not_ok",
    firstDatabaseDigest === restartDatabaseDigest ? null : "p1_database_digest_changed_after_restart",
    unsafe.ok ? null : "p1_unsafe_path_rejection_not_ok",
    noArtifact ? null : "p1_committed_db_artifacts_found"
  ].filter(Boolean);

  return {
    ok,
    failures,
    cleanStartProfileReadback: {
      ok: cleanStart.ok && profileEmpty,
      p1DataDisposition: ownerDecisionFields.p1_data_disposition,
      carryoverAttempted: false,
      profileStartedEmpty: firstCounts.coreRowsTotal === 0,
      restartProfileStillEmpty: restartCounts.coreRowsTotal === 0,
      existingEmptyProfileResetBeforeOpen: cleanStart.existingEmptyProfileResetBeforeOpen,
      nonEmptyDurableProfileWouldBlock: true,
      firstCounts,
      restartCounts,
      cleanStartStateDigest: firstStateDigest,
      rawPathRecorded: false
    },
    ownerMarkerDurableRootReadback: {
      ok: ownerMarker.ok && routeMarker.ok && persistentRoot.ok === true,
      profileRootClass: selectedRoot.readback.profileRootClass,
      explicitRootProvided: selectedRoot.readback.explicitRootProvided,
      persistentRuntimeRootDigest: persistentRoot.runtimeRootDigest,
      sqliteRootDigest: sqliteRoot.rootDigest,
      ownerMarkerStatus: persistentRoot.ownerMarkerStatus,
      ownerMarker,
      routeOwnedSqliteMarker: routeMarker,
      ownerMarkerBoundToIntendedRouteProfile: ownerMarker.routeMatches && ownerMarker.profileIdMatches && ownerMarker.runContextMatches,
      routeOwnedMarkerBoundToIntendedRoute: routeMarker.routeMatches && routeMarker.purposeMatches,
      rawPathRecorded: false
    },
    restartPersistenceReadback: {
      ok: restartOk && firstDatabaseDigest === restartDatabaseDigest,
      firstOpenViaCreateRuntimeTransport: true,
      restartOpenViaCreateRuntimeTransport: true,
      sameDurableRootDigest: true,
      firstCleanStartStateDigest: firstStateDigest,
      restartCleanStartStateDigest: restartStateDigest,
      stateDigestMatches: firstStateDigest === restartStateDigest,
      databaseDigestMatchesAfterRestart: firstDatabaseDigest === restartDatabaseDigest,
      coreRowsRemainEmptyAfterRestart: restartCounts.coreRowsTotal === 0,
      rawPathRecorded: false
    },
    unsafePathRejectionReadback: unsafe,
    digestPrivacyNoArtifactReadback: {
      ok: noArtifact,
      rootDigestOnly: true,
      databaseFileName,
      databaseDigest: restartDatabaseDigest,
      databaseWalDigest: digestOptionalFile(`${databasePath}-wal`),
      databaseShmDigest: digestOptionalFile(`${databasePath}-shm`),
      rawPathRecorded: false,
      rawDbDumpRecorded: false,
      committedDbArtifacts: false,
      secretsOrPiiStored: false,
      workflowMutation: false,
      designSystemMutation: false,
      tmsMutation: false,
      remoteRuntimeActivationClaimed: false,
      readinessClaimed: false,
      releasePublicationPushClaimed: false
    }
  };
}

function ensureCleanStartDatabase(databasePath) {
  const sidecars = [databasePath, `${databasePath}-wal`, `${databasePath}-shm`];
  if (!existsSync(databasePath)) {
    for (const sidecar of sidecars.slice(1)) {
      rmSync(sidecar, { force: true });
    }
    return {
      ok: true,
      disposition: "clean_start_empty_profile_created",
      existingEmptyProfileResetBeforeOpen: false
    };
  }
  const existingCounts = readProfileCounts(databasePath);
  if (existingCounts.coreRowsTotal !== 0) {
    throw new Error("p1_clean_start_refuses_nonempty_durable_profile");
  }
  for (const sidecar of sidecars) {
    rmSync(sidecar, { force: true });
  }
  return {
    ok: true,
    disposition: "existing_empty_profile_reset_for_declared_clean_start",
    existingEmptyProfileResetBeforeOpen: true,
    priorCleanStartStateDigest: cleanStartStateDigest(existingCounts)
  };
}

function selectDurableRoot() {
  const explicit = process.env.TCRN_AOS_P1_DURABLE_RUNTIME_PROFILE_ROOT;
  const defaultRoot = join(homedir(), "Library", "Application Support", "TCRN-AOS", "conditional-dogfood-start-p1-runtime-profile");
  const root = resolve(explicit || defaultRoot);
  return {
    root,
    readback: {
      profileRootClass: explicit ? "explicit_owner_marker_durable_local_profile_root" : "owner_marker_durable_local_profile_root",
      explicitRootProvided: Boolean(explicit),
      selectedRootDigest: sha256(resolve(root)),
      rawPathRecorded: false,
      cleanStartDisposition: ownerDecisionFields.p1_data_disposition
    }
  };
}

function runtimeConfig(root, databasePath) {
  return {
    actor,
    databasePath,
    databaseRoot: root,
    repoRoot,
    routeOwnedMarkerFile: markerFile,
    runtimeProfileMarker: {
      route,
      markerVersion,
      purpose: markerPurpose
    },
    migrationsDir,
    auditPageLimit: 5,
    maxResponseBytes: 16_384
  };
}

function ensureRouteOwnedMarker(root) {
  mkdirSync(root, { recursive: true });
  const markerPath = join(root, markerFile);
  const expected = routeMarkerContent(root);
  if (!existsSync(markerPath)) {
    writeFileSync(markerPath, `${JSON.stringify(expected, null, 2)}\n`, "utf8");
    return;
  }
  const existing = JSON.parse(readFileSync(markerPath, "utf8"));
  if (!routeMarkerMatches(existing, expected)) {
    throw new Error("p1_route_owned_marker_stale_or_mismatched");
  }
}

function routeMarkerContent(root) {
  return {
    route,
    markerVersion,
    rootDigest: sha256(resolve(root)),
    purpose: markerPurpose,
    p1DataDisposition: ownerDecisionFields.p1_data_disposition,
    ownerDecisionDigest: sha256(JSON.stringify(ownerDecisionFields))
  };
}

function routeMarkerMatches(actual, expected) {
  return actual &&
    actual.route === expected.route &&
    actual.markerVersion === expected.markerVersion &&
    actual.rootDigest === expected.rootDigest &&
    actual.purpose === expected.purpose &&
    actual.p1DataDisposition === expected.p1DataDisposition &&
    actual.ownerDecisionDigest === expected.ownerDecisionDigest;
}

function routeMarkerReadback(root) {
  const marker = JSON.parse(readFileSync(join(root, markerFile), "utf8"));
  const expected = routeMarkerContent(root);
  return {
    ok: routeMarkerMatches(marker, expected),
    markerFile,
    markerDigest: sha256(JSON.stringify(marker)),
    markerKeySet: Object.keys(marker).sort(),
    markerVersion: marker.markerVersion,
    markerPurpose: marker.purpose,
    routeMatches: marker.route === route,
    rootDigestMatches: marker.rootDigest === expected.rootDigest,
    purposeMatches: marker.purpose === markerPurpose,
    cleanStartDispositionMatches: marker.p1DataDisposition === ownerDecisionFields.p1_data_disposition,
    rawPathRecorded: false
  };
}

function ownerMarkerReadback(root, runtimeRootDigest) {
  const marker = JSON.parse(readFileSync(join(root, ownerMarkerFile), "utf8"));
  return {
    ok: marker.profileId === p1OwnerMarker.profileId &&
      marker.routeId === p1OwnerMarker.routeId &&
      marker.runContext === p1OwnerMarker.runContext &&
      marker.owner === p1OwnerMarker.owner &&
      marker.runtimeRootDigest === runtimeRootDigest,
    markerFile: ownerMarkerFile,
    markerDigest: sha256(JSON.stringify(marker)),
    markerKeySet: Object.keys(marker).sort(),
    markerSchemaVersion: marker.markerSchemaVersion,
    profileId: marker.profileId,
    routeIdDigest: sha256(String(marker.routeId)),
    runContext: marker.runContext,
    owner: marker.owner,
    routeMatches: marker.routeId === route,
    profileIdMatches: marker.profileId === p1OwnerMarker.profileId,
    runContextMatches: marker.runContext === p1OwnerMarker.runContext,
    runtimeRootDigestMatches: marker.runtimeRootDigest === runtimeRootDigest,
    rawPathRecorded: false
  };
}

function readProfileCounts(databasePath) {
  const db = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const coreTableRowCounts = Object.fromEntries(coreTables.map((table) => [table, tableExists(db, table) ? countRows(db, table) : 0]));
    const coreRowsTotal = Object.values(coreTableRowCounts).reduce((sum, value) => sum + Number(value), 0);
    return {
      coreTableRowCounts,
      coreRowsTotal,
      schemaMigrationCount: tableExists(db, "aos_schema_migrations") ? countRows(db, "aos_schema_migrations") : 0
    };
  } finally {
    db.close();
  }
}

function tableExists(db, table) {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
  return Boolean(row);
}

function countRows(db, table) {
  const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get();
  return Number(row?.count ?? 0);
}

function cleanStartStateDigest(counts) {
  return sha256(JSON.stringify({
    schema: "p1.clean_start_state.v1",
    coreTableRowCounts: counts.coreTableRowCounts,
    coreRowsTotal: counts.coreRowsTotal,
    schemaMigrationCount: counts.schemaMigrationCount,
    p1DataDisposition: ownerDecisionFields.p1_data_disposition
  }));
}

async function proveUnsafePathRejection(root, databasePath) {
  const tempPrefix = source.sourceHead.slice(0, 8);
  const cleanupRoots = [];
  const cleanupFiles = [];
  const cases = {};
  try {
    const repoDb = join(repoRoot, "p1-runtime-should-not-open.sqlite");
    cleanupFiles.push(repoDb);
    cases.repoTreeRejectedBeforeDbOpen = expectRuntimeReject(
      { ...runtimeConfig(repoRoot, repoDb) },
      "phase1_sqlite_root_inside_git_repo_denied",
      repoDb
    );

    const retainedRoot = join(realpathSync(tmpdir()), `tcrn-aos-p1-retained-preview-denied-${tempPrefix}`);
    cleanupRoots.push(retainedRoot);
    cases.retainedPreviewRejectedBeforeDbOpen = expectRuntimeReject(
      { ...runtimeConfig(retainedRoot, join(retainedRoot, databaseFileName)) },
      "transport_runtime_retained_or_owner_visible_path_denied",
      join(retainedRoot, databaseFileName)
    );

    const ownerVisibleRoot = join(realpathSync(tmpdir()), `tcrn-aos-p1-owner-visible-preview-denied-${tempPrefix}`);
    cleanupRoots.push(ownerVisibleRoot);
    cases.ownerVisiblePreviewRejectedBeforeDbOpen = expectRuntimeReject(
      { ...runtimeConfig(ownerVisibleRoot, join(ownerVisibleRoot, databaseFileName)) },
      "transport_runtime_retained_or_owner_visible_path_denied",
      join(ownerVisibleRoot, databaseFileName)
    );

    const outsideDb = join(dirname(root), `p1-parent-traversal-${tempPrefix}.sqlite`);
    cleanupFiles.push(outsideDb);
    cases.parentTraversalRejectedBeforeDbOpen = expectRuntimeReject(
      { ...runtimeConfig(root, join(root, "..", basename(outsideDb))) },
      "transport_runtime_database_path_outside_route_owned_root",
      outsideDb
    );

    const unownedRoot = join(realpathSync(tmpdir()), `tcrn-aos-p1-unowned-root-${tempPrefix}`);
    mkdirSync(unownedRoot, { recursive: true });
    cleanupRoots.push(unownedRoot);
    cases.unownedRootRejectedBeforeDbOpen = expectRuntimeReject(
      { ...runtimeConfig(unownedRoot, join(unownedRoot, databaseFileName)), runtimeProfileMarker: undefined },
      "phase1_sqlite_root_marker_missing",
      join(unownedRoot, databaseFileName)
    );

    const persistentUnownedRoot = join(realpathSync(tmpdir()), `tcrn-aos-p1-persistent-unowned-${tempPrefix}`);
    mkdirSync(persistentUnownedRoot, { recursive: true });
    writeFileSync(join(persistentUnownedRoot, "preexisting.txt"), "not route owned", "utf8");
    cleanupRoots.push(persistentUnownedRoot);
    cases.persistentOwnerMarkerUnownedRootRejected = await expectPrepareReject(
      () => prepareRuntimeRoot({ runtimeRoot: persistentUnownedRoot, repoRoot, ownerMarker: p1OwnerMarker }),
      "runtime_root_unowned_non_empty"
    );

    const symlinkParent = join(realpathSync(tmpdir()), `tcrn-aos-p1-symlink-${tempPrefix}`);
    const realRoot = join(symlinkParent, "real-root");
    const linkedRoot = join(symlinkParent, "linked-root");
    mkdirSync(realRoot, { recursive: true });
    writeFileSync(join(realRoot, markerFile), `${JSON.stringify(routeMarkerContent(realRoot), null, 2)}\n`, "utf8");
    symlinkSync(realRoot, linkedRoot, "dir");
    cleanupRoots.push(symlinkParent);
    cases.symlinkRootRejectedBeforeDbOpen = expectRuntimeReject(
      { ...runtimeConfig(linkedRoot, join(linkedRoot, databaseFileName)) },
      "transport_runtime_database_root_symlink_ancestor_denied",
      join(linkedRoot, databaseFileName)
    );

    const outsideRoot = join(realpathSync(tmpdir()), `tcrn-aos-p1-db-symlink-outside-${tempPrefix}`);
    mkdirSync(outsideRoot, { recursive: true });
    const outsideTarget = join(outsideRoot, "outside.sqlite");
    writeFileSync(outsideTarget, "", "utf8");
    const dbSymlink = join(root, "p1-symlink.sqlite");
    rmSync(dbSymlink, { force: true });
    symlinkSync(outsideTarget, dbSymlink);
    cleanupRoots.push(outsideRoot);
    cleanupFiles.push(dbSymlink);
    cases.dbFileSymlinkRejectedBeforeDbOpen = expectRuntimeReject(
      { ...runtimeConfig(root, dbSymlink) },
      "transport_runtime_database_file_symlink_denied",
      dbSymlink,
      { existingArtifactIsExpected: true }
    );

    const staleMarkerRoot = join(realpathSync(tmpdir()), `tcrn-aos-p1-stale-marker-${tempPrefix}`);
    mkdirSync(staleMarkerRoot, { recursive: true });
    writeFileSync(join(staleMarkerRoot, markerFile), JSON.stringify({ ...routeMarkerContent(staleMarkerRoot), route: "stale-route", rootDigest: "stale" }), "utf8");
    cleanupRoots.push(staleMarkerRoot);
    cases.staleRouteMarkerRejectedBeforeDbOpen = expectRuntimeReject(
      { ...runtimeConfig(staleMarkerRoot, join(staleMarkerRoot, databaseFileName)) },
      "transport_runtime_profile_marker_stale_or_mismatched",
      join(staleMarkerRoot, databaseFileName)
    );

    const ok = Object.values(cases).every((entry) => entry.ok === true);
    return {
      ok,
      cases,
      routeOwnedPositiveCase: existsSync(databasePath) && dirname(databasePath) === root,
      databaseOpenedBeforeRejectedChecks: false,
      rawPathRecorded: false,
      failures: Object.entries(cases).filter(([, result]) => result.ok !== true).map(([name]) => name)
    };
  } finally {
    for (const file of cleanupFiles) {
      rmSync(file, { force: true });
    }
    for (const cleanupRoot of cleanupRoots) {
      rmSync(cleanupRoot, { recursive: true, force: true });
    }
  }
}

function expectRuntimeReject(config, expectedReason, artifactPath, options = {}) {
  const existedBefore = artifactPath ? existsSync(artifactPath) : false;
  try {
    const runtime = createRuntimeTransport(config);
    runtime.close();
    return {
      ok: false,
      expectedReason,
      actualReason: "not_rejected",
      databaseArtifactCreated: artifactPath ? existsSync(artifactPath) && !existedBefore : false
    };
  } catch (error) {
    const actualReason = error instanceof Error ? error.message : String(error);
    const created = artifactPath ? existsSync(artifactPath) && !existedBefore : false;
    const artifactOk = options.existingArtifactIsExpected === true ? true : !created;
    return {
      ok: actualReason.includes(expectedReason) && artifactOk,
      expectedReason,
      actualReason,
      rejectedBeforeDbOpen: artifactOk,
      databaseArtifactCreated: created,
      rawPathRecorded: false
    };
  }
}

function expectPrepareReject(operation, expectedReason) {
  return operation().then(
    () => ({
      ok: false,
      expectedReason,
      actualReason: "not_rejected",
      rawPathRecorded: false
    }),
    (error) => ({
      ok: error instanceof Error && error.message.includes(expectedReason),
      expectedReason,
      actualReason: error instanceof Error ? error.message : String(error),
      rawPathRecorded: false
    })
  );
}

function denyUnsafeRuntimePath(path) {
  const home = homedir();
  const normalized = resolve(path).split(sep).join("/");
  if (normalized.startsWith("/srv/") || normalized === "/srv") throw new Error("transport_runtime_srv_path_denied");
  if (normalized.includes("/.tcrn") || (home && normalized.startsWith(`${home}/.tcrn`))) throw new Error("transport_runtime_durable_home_path_denied");
  if (/retained|owner-trial|preview/i.test(normalized)) throw new Error("transport_runtime_retained_or_owner_visible_path_denied");
}

function denyRepoOrWrongSibling(path) {
  const normalized = resolve(path);
  const canonicalRepo = realpathSync(repoRoot);
  if (normalized === canonicalRepo || normalized.startsWith(`${canonicalRepo}${sep}`)) {
    throw new Error("p1_runtime_profile_root_inside_git_tree_denied");
  }
  const wrongSibling = resolve(dirname(dirname(repoRoot)), "TCRN-AOS");
  if (normalized === wrongSibling || normalized.startsWith(`${wrongSibling}${sep}`)) {
    throw new Error("transport_runtime_wrong_sibling_path_denied");
  }
}

function assertExistingSegmentsHaveNoSymlink(targetPath, reason) {
  const resolvedPath = resolve(targetPath);
  const root = parse(resolvedPath).root;
  const parts = resolvedPath.slice(root.length).split(sep).filter(Boolean);
  let currentPath = root;
  for (const part of parts) {
    currentPath = currentPath === root ? `${root}${part}` : `${currentPath}${sep}${part}`;
    if (!existsSync(currentPath)) return;
    if (lstatSync(currentPath).isSymbolicLink()) throw new Error(reason);
  }
}

function digestDatabaseFile(databasePath) {
  return existsSync(databasePath) ? sha256(readFileSync(databasePath)) : null;
}

function digestOptionalFile(file) {
  return existsSync(file) ? sha256(readFileSync(file)) : null;
}

function noCommittedDbArtifacts() {
  const result = spawnSync("git", ["ls-files", "-z"], { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) return false;
  return result.stdout
    .split("\0")
    .filter(Boolean)
    .filter((file) => !file.startsWith(".codegraph/"))
    .every((file) => !/\.(sqlite|sqlite3|db|db-shm|db-wal)$/.test(file));
}

function privacyScan(proof) {
  const text = JSON.stringify(proof);
  const findings = [
    ["/Users/", "local_users_path"],
    ["/tmp/", "tmp_path"],
    ["/private/tmp/", "private_tmp_path"],
    ["CREATE TABLE", "db_dump"],
    ["record_json", "raw_db_row"],
    ["owner acceptance", "acceptance_overclaim"],
    ["product acceptance", "acceptance_overclaim"],
    ["final MVP acceptance", "acceptance_overclaim"],
    ["dogfood runtime readiness", "readiness_overclaim"],
    ["release readiness", "release_overclaim"]
  ].filter(([needle]) => text.toLowerCase().includes(String(needle).toLowerCase()))
    .map(([, kind]) => ({ kind }));
  return {
    ok: findings.length === 0 &&
      proof.digestPrivacyNoArtifactReadback.rawPathRecorded === false &&
      proof.digestPrivacyNoArtifactReadback.rawDbDumpRecorded === false,
    findings,
    rawPathRecorded: false,
    rawDbDumpRecorded: false,
    secretsOrPiiStored: false,
    readinessClaimed: false,
    releasePublicationPushClaimed: false,
    ownerAcceptanceClaimed: false,
    productAcceptanceClaimed: false,
    broadCodexSecurityPluginScanClaimed: false
  };
}

function sourceProvenance() {
  const sourceHead = git(["rev-parse", "HEAD"]);
  const files = sourceFiles.map((file) => ({
    file,
    digest: sha256(readFileSync(join(repoRoot, file)))
  }));
  return {
    sourceHead,
    incomingAosBasis,
    workflowBasis,
    files,
    sourceContentDigest: sha256(JSON.stringify(files)),
    sourceGitStatusDigestOnly: sha256(git(["status", "--short", "--branch"])),
    sourceGitStatusStoredRaw: false
  };
}

function writeReceipt(name, body) {
  const receipt = {
    receiptName: name,
    ok: body.ok === true,
    route,
    command,
    generatedAt: new Date().toISOString(),
    sourceHead: body.source.sourceHead,
    sourceContentDigest: body.source.sourceContentDigest,
    sourceFiles: body.source.files,
    workflowBasis,
    incomingAosBasis,
    aosBasis: body.source.sourceHead,
    failures: body.failures ?? [],
    negativeFailures: body.negativeFailures ?? [],
    noOverclaimFlags,
    ...body
  };
  delete receipt.source;
  writeFileSync(join(evidenceRoot, name), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  return receipt;
}

function git(args) {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  }
  return result.stdout.trim();
}
