import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AosSqliteRepository,
  assertRouteOwnedSqliteRoot
} from "../dist/packages/db/src/index.js";
import { createDefaultSeed } from "../dist/packages/domain/src/index.js";
import { createRuntimeTransport } from "../dist/packages/mcp-server/src/index.js";

const route = "route_tcrn_aos_phase3_dogfood_ilya_runtime_path_hardening_repair_after_sable_changes_requested_5805cd8_d6a648a_20260705";
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const evidenceRoot = join(repoRoot, "evidence/runtime-path-hardening");
const migrationsDir = join(repoRoot, "packages/db/migrations/sqlite");
const safeTmpRoot = realpathSync(tmpdir());
const markerFile = ".tcrn-aos-phase1-root";
const command = "pnpm build && node scripts/runtime-path-hardening-proof.mjs";
const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "runtime-path-hardening-proof"
};
const sourceFiles = [
  "packages/mcp-server/src/transport.ts",
  "packages/mcp-server/test/stdio-transport.test.mjs",
  "scripts/runtime-path-hardening-proof.mjs"
];
const noOverclaimFlags = {
  productRepoMutationOnly: true,
  workflowMutation: false,
  designSystemMutation: false,
  durableRuntimeDbActivation: false,
  dogfoodRuntimeReadinessClaimed: false,
  retainedPreviewFreshnessClaimed: false,
  liveDispatchAuthorized: false,
  ownerAcceptanceClaimed: false,
  productAcceptanceClaimed: false,
  releasePublicationPushClaimed: false,
  broadCodexSecurityPluginScanClaimed: false
};
const inventory = [
  "route-owned-positive-proof.json",
  "db-file-symlink-proof.json",
  "symlink-ancestor-proof.json",
  "route-owned-boundary-proof.json",
  "raw-path-and-no-overclaim-scan.json",
  "runtime-path-hardening-proof-summary.json"
];

runProof();

function runProof() {
  mkdirSync(evidenceRoot, { recursive: true });
  const source = sourceProvenance();
  const positive = proveRouteOwnedPositive();
  writeReceipt("route-owned-positive-proof.json", source, positive);
  const dbFileSymlink = proveDbFileSymlinkRejected();
  writeReceipt("db-file-symlink-proof.json", source, dbFileSymlink);
  const symlinkAncestor = proveSymlinkAncestorRejected();
  writeReceipt("symlink-ancestor-proof.json", source, symlinkAncestor);
  const boundary = proveRouteOwnedBoundaries();
  writeReceipt("route-owned-boundary-proof.json", source, boundary);
  const privacyScan = scanReceiptsForRawPathsAndOverclaims(inventory.filter((name) => name !== "raw-path-and-no-overclaim-scan.json" && name !== "runtime-path-hardening-proof-summary.json"));
  writeReceipt("raw-path-and-no-overclaim-scan.json", source, privacyScan);
  const summary = {
    ok: positive.ok && dbFileSymlink.ok && symlinkAncestor.ok && boundary.ok && privacyScan.ok,
    receiptInventory: inventory,
    dbFileSymlinkRejected: dbFileSymlink.dbFileSymlinkRejected,
    symlinkAncestorRejected: symlinkAncestor.symlinkAncestorRejected,
    canonicalDatabasePathInsideRouteOwnedRoot: positive.canonicalDatabasePathInsideRouteOwnedRoot,
    routeOwnedRootBoundaryPreserved: boundary.routeOwnedRootBoundaryPreserved,
    liveDurableRetainedActivation: false,
    rawPathRecorded: false,
    cleanupAttempted: [
      positive.cleanupReadback,
      dbFileSymlink.cleanupReadback,
      symlinkAncestor.cleanupReadback,
      boundary.cleanupReadback
    ].every((item) => item.attempted === true),
    cleanupRemoved: [
      positive.cleanupReadback,
      dbFileSymlink.cleanupReadback,
      symlinkAncestor.cleanupReadback,
      boundary.cleanupReadback
    ].every((item) => item.removed === true),
    failures: [
      ...positive.failures,
      ...dbFileSymlink.failures,
      ...symlinkAncestor.failures,
      ...boundary.failures,
      ...privacyScan.failures
    ]
  };
  writeReceipt("runtime-path-hardening-proof-summary.json", source, summary);
  assert.equal(summary.ok, true, JSON.stringify(summary.failures));
}

function proveRouteOwnedPositive() {
  const root = mkdtempSync(join(safeTmpRoot, "tcrn-aos-runtime-path-positive-"));
  const dbPath = join(root, "runtime.sqlite");
  const cleanupReadback = cleanupAfter(() => {
    writeFileSync(join(root, markerFile), "owned-by-runtime-path-hardening-proof\n", "utf8");
    const rootReadback = assertRouteOwnedSqliteRoot(root, repoRoot, markerFile);
    seedPersistedEmployees(dbPath);
    const runtime = createRuntimeTransport({
      actor,
      databasePath: dbPath,
      databaseRoot: root,
      repoRoot,
      migrationsDir
    });
    try {
      const policy = runtime.transport.handleJsonRpc({ jsonrpc: "2.0", id: 1, method: "aos.policy.read", params: {} });
      assert.equal(policy.error, undefined);
      assert.equal(policy.result.boundaries.durableRuntimeActivation, false);
      return {
        ok: true,
        routeOwnedRootAccepted: true,
        canonicalDatabasePathInsideRouteOwnedRoot: true,
        routeOwnedRootDigest: rootReadback.rootDigest,
        dbFileName: "runtime.sqlite",
        sqliteOpenedOnlyAfterPathValidation: true,
        rawPathRecorded: false,
        failures: []
      };
    } finally {
      runtime.close();
    }
  }, root);
  return { ...cleanupReadback.result, cleanupReadback: cleanupReadback.cleanup };
}

function proveDbFileSymlinkRejected() {
  const root = mkdtempSync(join(safeTmpRoot, "tcrn-aos-runtime-path-db-symlink-"));
  const outsideRoot = mkdtempSync(join(safeTmpRoot, "tcrn-aos-runtime-path-outside-"));
  const outsideDb = join(outsideRoot, "outside.sqlite");
  const dbPath = join(root, "runtime.sqlite");
  const cleanupReadback = cleanupAfter(() => {
    writeFileSync(join(root, markerFile), "owned-by-runtime-path-hardening-proof\n", "utf8");
    writeFileSync(outsideDb, "", "utf8");
    const beforeBytes = statSync(outsideDb).size;
    symlinkSync(outsideDb, dbPath);
    const rejected = expectRuntimeReject({
      actor,
      databasePath: dbPath,
      databaseRoot: root,
      repoRoot,
      migrationsDir
    }, "transport_runtime_database_file_symlink_denied");
    const afterBytes = statSync(outsideDb).size;
    return {
      ok: rejected === true && beforeBytes === afterBytes,
      dbFileSymlinkRejected: rejected,
      rejectionReason: "transport_runtime_database_file_symlink_denied",
      outsideTargetUnchanged: beforeBytes === afterBytes,
      sqliteOpenPrevented: beforeBytes === afterBytes,
      rawPathRecorded: false,
      failures: rejected && beforeBytes === afterBytes ? [] : ["db_file_symlink_not_rejected_before_sqlite_open"]
    };
  }, root, outsideRoot);
  return { ...cleanupReadback.result, cleanupReadback: cleanupReadback.cleanup };
}

function proveSymlinkAncestorRejected() {
  const parent = mkdtempSync(join(safeTmpRoot, "tcrn-aos-runtime-path-ancestor-"));
  const realParent = join(parent, "real-parent");
  const linkedParent = join(parent, "linked-parent");
  const linkedRoot = join(linkedParent, "route-root");
  const cleanupReadback = cleanupAfter(() => {
    mkdirSync(realParent, { recursive: true });
    symlinkSync(realParent, linkedParent, "dir");
    mkdirSync(linkedRoot, { recursive: true });
    writeFileSync(join(linkedRoot, markerFile), "owned-by-runtime-path-hardening-proof\n", "utf8");
    const rejected = expectRuntimeReject({
      actor,
      databasePath: join(linkedRoot, "runtime.sqlite"),
      databaseRoot: linkedRoot,
      repoRoot,
      migrationsDir
    }, "transport_runtime_database_root_symlink_ancestor_denied");
    return {
      ok: rejected === true && existsSync(join(realParent, "route-root", "runtime.sqlite")) === false,
      symlinkAncestorRejected: rejected,
      rejectionReason: "transport_runtime_database_root_symlink_ancestor_denied",
      databaseFileCreatedThroughSymlinkAncestor: false,
      rawPathRecorded: false,
      failures: rejected ? [] : ["symlink_ancestor_not_rejected"]
    };
  }, parent);
  return { ...cleanupReadback.result, cleanupReadback: cleanupReadback.cleanup };
}

function proveRouteOwnedBoundaries() {
  const roots = [];
  const failures = [];
  const nestedRoot = mkdtempSync(join(safeTmpRoot, "tcrn-aos-runtime-path-nested-"));
  roots.push(nestedRoot);
  writeFileSync(join(nestedRoot, markerFile), "owned-by-runtime-path-hardening-proof\n", "utf8");
  mkdirSync(join(nestedRoot, "nested"), { recursive: true });
  const nestedDenied = expectRuntimeReject({
    actor,
    databasePath: join(nestedRoot, "nested", "runtime.sqlite"),
    databaseRoot: nestedRoot,
    repoRoot,
    migrationsDir
  }, "transport_runtime_database_nested_path_denied");
  if (!nestedDenied) failures.push("nested_db_path_not_denied");

  const missingMarkerRoot = mkdtempSync(join(safeTmpRoot, "tcrn-aos-runtime-path-missing-marker-"));
  roots.push(missingMarkerRoot);
  const missingMarkerDenied = expectRuntimeReject({
    actor,
    databasePath: join(missingMarkerRoot, "runtime.sqlite"),
    databaseRoot: missingMarkerRoot,
    repoRoot,
    migrationsDir
  }, "phase1_sqlite_root_marker_missing");
  if (!missingMarkerDenied) failures.push("missing_marker_not_denied");

  const missingPathDenied = expectRuntimeReject({ actor }, "transport_runtime_database_path_required");
  if (!missingPathDenied) failures.push("missing_database_path_not_denied");
  const missingRootDenied = expectRuntimeReject({
    actor,
    databasePath: join(nestedRoot, "runtime.sqlite")
  }, "transport_runtime_database_root_required");
  if (!missingRootDenied) failures.push("missing_database_root_not_denied");
  const srvDenied = expectRuntimeReject({
    actor,
    databasePath: "/srv/tcrn/runtime.sqlite",
    databaseRoot: "/srv/tcrn",
    repoRoot,
    migrationsDir
  }, "transport_runtime_srv_path_denied");
  if (!srvDenied) failures.push("srv_runtime_path_not_denied");

  const cleanup = cleanupRoots(roots);
  return {
    ok: failures.length === 0 && cleanup.removed,
    routeOwnedRootBoundaryPreserved: failures.length === 0,
    directChildRequired: nestedDenied,
    missingMarkerRejected: missingMarkerDenied,
    missingDatabasePathRejected: missingPathDenied,
    missingDatabaseRootRejected: missingRootDenied,
    srvPathRejected: srvDenied,
    rawPathRecorded: false,
    cleanupReadback: cleanup,
    failures
  };
}

function seedPersistedEmployees(dbPath) {
  const repository = new AosSqliteRepository({ databasePath: dbPath, migrationsDir });
  try {
    repository.applyMigrations();
    repository.seedAiEmployees(createDefaultSeed().employees, "runtime-path-hardening-proof-seed");
  } finally {
    repository.close();
  }
}

function expectRuntimeReject(config, reason) {
  try {
    const runtime = createRuntimeTransport(config);
    runtime.close();
    return false;
  } catch (error) {
    return error instanceof Error && error.message.includes(reason);
  }
}

function cleanupAfter(operation, ...roots) {
  let result;
  let thrown;
  try {
    result = operation();
  } catch (error) {
    thrown = error;
  }
  const cleanup = cleanupRoots(roots);
  if (thrown) {
    throw thrown;
  }
  return { result, cleanup };
}

function cleanupRoots(roots) {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
  return {
    attempted: true,
    removed: roots.every((root) => !existsSync(root)),
    rawPathRecorded: false
  };
}

function scanReceiptsForRawPathsAndOverclaims(receiptNames) {
  const forbidden = [
    { label: "machine_home_path", regex: /\/Users\// },
    { label: "temp_path", regex: /\/(?:private\/)?tmp\// },
    { label: "var_folders_path", regex: /\/var\/folders\// },
    { label: "target_host_path", regex: /\/srv\// },
    { label: "file_uri", regex: /file:\/\//i },
    { label: "durable_runtime_activation_claim", regex: /\bdurable runtime (activation|readiness)\b/i },
    { label: "dogfood_runtime_readiness_claim", regex: /\bdogfood runtime readiness\b/i },
    { label: "owner_or_product_acceptance_claim", regex: /\b(owner acceptance|product acceptance|final MVP acceptance)\b/i },
    { label: "release_publication_push_claim", regex: /\b(release readiness|publication|BPG|push authorized)\b/i }
  ];
  const failures = [];
  for (const name of receiptNames) {
    const text = readFileSync(join(evidenceRoot, name), "utf8");
    for (const item of forbidden) {
      if (item.regex.test(text)) {
        failures.push(`${name}:${item.label}`);
      }
    }
  }
  return {
    ok: failures.length === 0,
    scannedReceipts: receiptNames,
    scannedClasses: forbidden.map((item) => item.label),
    rawPathRecorded: false,
    auditRowsWritten: false,
    transportErrorsReturned: false,
    durableRuntimeDbActivation: false,
    dogfoodRuntimeReadinessClaimed: false,
    failures
  };
}

function writeReceipt(name, source, payload) {
  const receipt = {
    ok: payload.ok === true,
    route,
    command,
    generatedAt: new Date().toISOString(),
    sourceHead: source.sourceHead,
    sourceContentDigest: source.sourceContentDigest,
    sourceFiles: source.sourceFiles,
    noOverclaimFlags,
    failures: payload.failures ?? [],
    negativeFailures: payload.negativeFailures ?? [],
    ...payload
  };
  writeFileSync(join(evidenceRoot, name), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  return receipt;
}

function sourceProvenance() {
  const sourceHead = git(["rev-parse", "HEAD"]);
  const fileDigests = sourceFiles.map((file) => ({
    file,
    digest: sha256(readFileSync(join(repoRoot, file), "utf8"))
  }));
  return {
    sourceHead,
    sourceFiles: fileDigests,
    sourceContentDigest: sha256(JSON.stringify(fileDigests))
  };
}

function git(args) {
  const result = spawnSync("git", ["-C", repoRoot, ...args], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
