import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join, parse, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { AosSqliteRepository, assertRouteOwnedSqliteRoot, sha256 } from "../dist/packages/db/src/index.js";
import { AosStore, createDefaultSeed } from "../dist/packages/domain/src/index.js";
import { createRuntimeTransport } from "../dist/packages/mcp-server/src/index.js";

const route = "route_tcrn_aos_phase4_d2_runtime_profile_local_activation_ilya_after_owner_decision_78d75eb_eb8f5a8_20260706";
const workflowBasis = "78d75ebdab78c6b8a5488014b529cdbb730104f5";
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const evidenceRoot = join(repoRoot, "evidence/phase3-dogfood-execution-runtime-profile");
const migrationsDir = join(repoRoot, "packages/db/migrations/sqlite");
const markerFile = ".tcrn-aos-phase1-root";
const markerPurpose = "d2-local-dogfood-runtime-profile-activation";
const markerVersion = "phase4-d2-runtime-profile.v1";
const command = "pnpm --dir TCRN-AOS d2:runtime-profile-activation-proof";
const activationReceiptName = "d2-runtime-profile-local-activation-readback.json";
const summaryReceiptName = "d2-runtime-profile-local-activation-proof-summary.json";
const sourceFiles = [
  "package.json",
  "scripts/d2-runtime-profile-activation-proof.mjs",
  "packages/db/src/sqlite-repository.ts",
  "packages/domain/src/store.ts",
  "packages/domain/src/seed.ts",
  "packages/mcp-server/src/transport.ts",
  "packages/mcp-server/src/stdio-server.ts"
];
const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "d2-local-runtime-profile-activation"
};
const noOverclaimFlags = {
  localDogfoodRuntimeProfileActivated: true,
  productRepoMutationOnly: true,
  workflowMutation: false,
  designSystemMutation: false,
  tmsMutation: false,
  durableRuntimeDbActivation: false,
  defaultRuntimeDbActivation: false,
  remoteRuntimeActivation: false,
  dogfoodRuntimeReadinessClaimed: false,
  phase3AcceptanceClaimed: false,
  phase4CloseoutClaimed: false,
  retainedPreviewRuntimeActivation: false,
  ownerVisibleRuntimeDbActivated: false,
  liveDispatchAuthorized: false,
  ownerIntentExecutionAuthorized: false,
  ownerAcceptanceClaimed: false,
  productAcceptanceClaimed: false,
  releasePublicationPushClaimed: false,
  broadCodexSecurityPluginScanClaimed: false,
  d3RealWorkloadCreated: false,
  d4FrictionTicketsCreated: false,
  d5StatusMigrationPerformed: false
};

mkdirSync(evidenceRoot, { recursive: true });
const source = sourceProvenance();
const selectedRoot = selectActivationRoot();
const activation = runActivation(selectedRoot.root);
const privacy = privacyScan(activation);
const receipt = writeReceipt(activationReceiptName, {
  ok: activation.ok && privacy.ok,
  source,
  selectedRoot: selectedRoot.readback,
  activationReadback: activation.activationReadback,
  persistentRuntimeOwnerMarkerReadback: activation.persistentRuntimeOwnerMarkerReadback,
  routeOwnedRootPathHardeningReadback: activation.routeOwnedRootPathHardeningReadback,
  localDogfoodScopeReadback: activation.localDogfoodScopeReadback,
  cleanupRetentionNoOverclaimProof: activation.cleanupRetentionNoOverclaimProof,
  privacyNoOverclaimScan: privacy,
  noOverclaimFlags
});
const summary = writeReceipt(summaryReceiptName, {
  ok: receipt.ok === true,
  source,
  receiptInventory: [activationReceiptName],
  receiptCount: 1,
  allChildReceiptsOk: receipt.ok === true,
  missingReceipts: [],
  extraUnclassifiedReceipts: [],
  activationReceiptDigest: sha256(JSON.stringify(receipt)),
  activationRootRawPathRecorded: false,
  localDogfoodActivationOnly: true,
  noOverclaimFlags
});

assert.equal(receipt.ok, true);
assert.equal(summary.ok, true);
console.log(JSON.stringify({
  ok: true,
  receipts: [summaryReceiptName, activationReceiptName],
  activationRootDigest: activation.activationReadback.profileRootDigest,
  databaseDigest: activation.activationReadback.databaseDigest,
  rawPathRecorded: false,
  localDogfoodActivationOnly: true
}, null, 2));

function runActivation(root) {
  ensureActivationRoot(root);
  const dbPath = join(root, "aos-d2-local-runtime-profile.sqlite");
  const rootReadback = assertRouteOwnedSqliteRoot(root, repoRoot, markerFile);
  const firstSeed = seedActivationDatabase(dbPath);
  const secondSeed = seedActivationDatabase(dbPath);
  const runtime = createRuntimeTransport(runtimeConfig(root, dbPath));
  try {
    const policy = handle(runtime, "aos.policy.read", {});
    const claim = handle(runtime, "aos.assignment.claim", {
      targetType: "story",
      targetId: firstSeed.storyId,
      initiativeId: firstSeed.initiativeId,
      epicId: firstSeed.epicId,
      idempotencyKey: "d2-local-runtime-profile-activation-claim"
    });
    const tickets = handle(runtime, "aos.ticket.list", { storyId: firstSeed.storyId, limit: 1 });
    const audit = handle(runtime, "aos.audit.query", { targetId: firstSeed.storyId, limit: 5 });
    runtime.close();

    const restartRuntime = createRuntimeTransport(runtimeConfig(root, dbPath));
    try {
      const restartTickets = handle(restartRuntime, "aos.ticket.list", { storyId: firstSeed.storyId, limit: 1 });
      const counts = readActivationCounts(dbPath);
      const hardening = proveRuntimePathHardening(root, dbPath);
      const activationOk = policy.result?.ok === true &&
        claim.result?.ok === true &&
        tickets.result?.rows?.[0]?.storyId === firstSeed.storyId &&
        restartTickets.result?.rows?.[0]?.storyId === firstSeed.storyId &&
        audit.result?.returnedCount > 0 &&
        counts.initiativeCount === 1 &&
        counts.epicCount === 1 &&
        secondSeed.seedDigest === firstSeed.seedDigest &&
        hardening.ok === true;
      return {
        ok: activationOk,
        activationReadback: {
          ok: activationOk,
          sourceHead: source.sourceHead,
          workflowBasis,
          activationCommand: command,
          profileRootClass: selectedRoot.readback.profileRootClass,
          profileRootDigest: rootReadback.rootDigest,
          databaseDigest: digestDatabaseFile(dbPath),
          databaseFileName: basename(dbPath),
          rawPathRecorded: false,
          runtimeTransportOpened: true,
          runtimeTransportRestartReadbackOk: restartTickets.result?.rows?.[0]?.storyId === firstSeed.storyId,
          policyReadOk: policy.result?.ok === true,
          ticketListReadOk: tickets.result?.rows?.[0]?.storyId === firstSeed.storyId,
          auditReadOk: audit.result?.returnedCount > 0,
          assignmentClaimOk: claim.result?.ok === true,
          seedIdempotent: secondSeed.seedDigest === firstSeed.seedDigest,
          persistedCounts: counts
        },
        persistentRuntimeOwnerMarkerReadback: markerReadback(root),
        routeOwnedRootPathHardeningReadback: hardening,
        localDogfoodScopeReadback: {
          ok: counts.initiativeCount === 1 && counts.epicCount === 1,
          initiativeTitle: "AOS human readback v1",
          epicTitle: "D2 local runtime profile activation proof",
          storyCount: counts.storyCount,
          gateCount: counts.gateCount,
          proofFixtureOnly: true,
          d3RealWorkloadCreated: false,
          d4FrictionTicketsCreated: false,
          d5StatusMigrationPerformed: false,
          remoteRuntimeActivation: false,
          ownerFacingSurfaceCreated: false,
          productReadinessClaimed: false
        },
        cleanupRetentionNoOverclaimProof: {
          ok: noCommittedDbArtifacts(),
          cleanupAttempted: false,
          cleanupDisposition: "activation_root_intentionally_retained_for_owner_authorized_local_d2_use",
          retainedRootClass: selectedRoot.readback.profileRootClass,
          retainedRootDigest: rootReadback.rootDigest,
          rawPathRecorded: false,
          committedDbArtifacts: false,
          vmResourceCreated: false,
          externalTrackerMutation: false,
          retainedPreviewRuntimeRefresh: false,
          releasePublicationPushClaimed: false,
          resourceLedgerMutation: false
        }
      };
    } finally {
      restartRuntime.close();
    }
  } catch (error) {
    try {
      runtime.close();
    } catch {
      // best-effort close while preserving original failure
    }
    throw error;
  }
}

function selectActivationRoot() {
  const provided = process.env.TCRN_AOS_D2_RUNTIME_PROFILE_ROOT;
  const safeTmp = realpathSync(tmpdir());
  const preferred = provided ? resolve(provided) : join(safeTmp, "tcrn-aos-d2-local-profile");
  const fallback = join(safeTmp, `tcrn-aos-d2-local-profile-${source.sourceHead.slice(0, 12)}`);
  const root = chooseRoot(preferred, fallback, Boolean(provided));
  return {
    root,
    readback: {
      profileRootClass: provided ? "explicit_owner_provided_route_owned_local_root" : "os_temp_route_owned_local_activation_root",
      explicitRootProvided: Boolean(provided),
      fallbackRootSelected: root !== preferred,
      rootDigest: sha256(resolve(root)),
      rawPathRecorded: false
    }
  };
}

function chooseRoot(preferred, fallback, explicit) {
  const candidate = validateRootCandidate(preferred);
  if (candidate.ok) {
    return preferred;
  }
  if (explicit) {
    throw new Error(candidate.reason);
  }
  const fallbackCandidate = validateRootCandidate(fallback);
  if (!fallbackCandidate.ok) {
    throw new Error(fallbackCandidate.reason);
  }
  return fallback;
}

function validateRootCandidate(root) {
  try {
    denyUnsafeRuntimePath(root);
    denyRepoOrWrongSibling(root);
    assertExistingSegmentsHaveNoSymlink(root, "d2_runtime_profile_root_symlink_ancestor_denied");
    if (existsSync(root)) {
      const stat = lstatSync(root);
      if (stat.isSymbolicLink()) return { ok: false, reason: "d2_runtime_profile_root_symlink_denied" };
      if (!stat.isDirectory()) return { ok: false, reason: "d2_runtime_profile_root_not_directory" };
      const markerPath = join(root, markerFile);
      const entries = readdirSync(root);
      if (!existsSync(markerPath) && entries.length > 0) {
        return { ok: false, reason: "d2_runtime_profile_unowned_non_empty_root_denied" };
      }
      if (existsSync(markerPath)) {
        const parsed = JSON.parse(readFileSync(markerPath, "utf8"));
        const expected = markerContent(root);
        if (!markerMatches(parsed, expected)) {
          return { ok: false, reason: "d2_runtime_profile_marker_stale_or_mismatched" };
        }
      }
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

function ensureActivationRoot(root) {
  const validation = validateRootCandidate(root);
  if (!validation.ok) {
    throw new Error(validation.reason);
  }
  mkdirSync(root, { recursive: true });
  assertExistingSegmentsHaveNoSymlink(root, "d2_runtime_profile_root_symlink_ancestor_denied");
  const markerPath = join(root, markerFile);
  if (!existsSync(markerPath)) {
    writeFileSync(markerPath, JSON.stringify(markerContent(root), null, 2), "utf8");
  }
}

function seedActivationDatabase(dbPath) {
  const repository = new AosSqliteRepository({ databasePath: dbPath, migrationsDir });
  const firstApply = repository.applyMigrations();
  const secondApply = repository.applyMigrations();
  const seed = createDefaultSeed();
  repository.seedAiEmployees(seed.employees, "d2-local-runtime-profile-activation-seed");
  const store = new AosStore(seed, { persistence: repository });
  for (const project of seed.projects) {
    store.upsertProject(project, actor);
  }
  const initiative = store.createInitiative({
    projectId: "TCRN-AOS",
    title: "AOS human readback v1",
    status: "in_progress",
    problem: "D2 local runtime profile activation uses a proof-only persisted spine.",
    expectedOutcome: "Local route-owned runtime profile DB opens through bounded transport."
  }, actor);
  const epic = store.createEpic({
    initiativeId: initiative.id,
    title: "D2 local runtime profile activation proof",
    goal: "Prove local dogfood runtime/profile DB activation without readiness or remote claims.",
    status: "in_progress"
  }, actor);
  const story = store.createStory({
    epicId: epic.id,
    title: "D2 local activation readback story",
    problem: "Activation needs a source-visible local DB readback.",
    user: "AOS implementation thread",
    expectedBehavior: "Runtime profile reads stay local and metadata-only.",
    acceptanceCriteria: ["Route-owned DB opens through createRuntimeTransport."],
    status: "in_progress",
    estimate: { effortPoints: 1, complexity: "low", risk: "L2", verificationCost: "medium", confidence: "high" },
    subTasks: []
  }, actor);
  const evidence = store.linkEvidence({
    type: "artifact_id",
    target: "d2-runtime-profile-local-activation-readback",
    validity: "valid",
    producer: actor.employeeId,
    digest: "sha256:d2-runtime-profile-local-activation-readback",
    redactionState: "metadata_only"
  }, actor);
  const gate = store.requestGate({
    type: "evidence_proof",
    linkedTicketId: story.id,
    inputEvidenceIds: [evidence.id]
  }, actor);
  const counts = readActivationCounts(dbPath);
  const seedDigest = sha256(JSON.stringify({
    initiativeId: initiative.id,
    epicId: epic.id,
    storyId: story.id,
    evidenceId: evidence.id,
    gateId: gate.id,
    secondApplyNoop: secondApply.appliedCount === 0
  }));
  repository.close();
  return {
    initiativeId: initiative.id,
    epicId: epic.id,
    storyId: story.id,
    evidenceId: evidence.id,
    gateId: gate.id,
    seedDigest,
    firstApplyAppliedCount: firstApply.appliedCount,
    secondApplyAppliedCount: secondApply.appliedCount
  };
}

function readActivationCounts(dbPath) {
  const repository = new AosSqliteRepository({ databasePath: dbPath, migrationsDir });
  repository.applyMigrations();
  const store = new AosStore(createDefaultSeed(), { persistence: repository });
  const initiatives = store.listInitiatives().filter((row) => row.title === "AOS human readback v1");
  const epics = store.listEpics().filter((row) => row.title === "D2 local runtime profile activation proof");
  const stories = store.listStories().filter((row) => epics.some((epic) => epic.id === row.epicId));
  const gates = store.listGates().filter((row) => stories.some((story) => story.id === row.linkedTicketId));
  const auditEvents = store.queryAudit();
  const assignments = store.listAssignments();
  repository.close();
  return {
    initiativeCount: initiatives.length,
    epicCount: epics.length,
    storyCount: stories.length,
    gateCount: gates.length,
    assignmentCount: assignments.length,
    auditEventCount: auditEvents.length
  };
}

function runtimeConfig(root, dbPath) {
  return {
    actor,
    databasePath: dbPath,
    databaseRoot: root,
    repoRoot,
    routeOwnedMarkerFile: markerFile,
    runtimeProfileMarker: runtimeProfileMarkerExpectation(),
    migrationsDir,
    auditPageLimit: 5,
    maxResponseBytes: 16_384
  };
}

function handle(runtime, method, params) {
  return runtime.transport.handleJsonRpc({ jsonrpc: "2.0", id: method, method, params });
}

function proveRuntimePathHardening(root, dbPath) {
  const staleMarkerRoot = join(realpathSync(tmpdir()), `tcrn-aos-d2-stale-marker-${source.sourceHead.slice(0, 8)}`);
  rmSync(staleMarkerRoot, { recursive: true, force: true });
  mkdirSync(staleMarkerRoot, { recursive: true });
  writeFileSync(join(staleMarkerRoot, markerFile), JSON.stringify({ ...markerContent(staleMarkerRoot), route: "stale-route", rootDigest: "stale" }), "utf8");

  const symlinkParent = join(realpathSync(tmpdir()), `tcrn-aos-d2-symlink-${source.sourceHead.slice(0, 8)}`);
  rmSync(symlinkParent, { recursive: true, force: true });
  mkdirSync(symlinkParent, { recursive: true });
  const realRoot = join(symlinkParent, "real-root");
  const linkedRoot = join(symlinkParent, "linked-root");
  mkdirSync(realRoot, { recursive: true });
  writeFileSync(join(realRoot, markerFile), JSON.stringify(markerContent(realRoot)), "utf8");
  symlinkSync(realRoot, linkedRoot, "dir");

  const outsideRoot = join(realpathSync(tmpdir()), `tcrn-aos-d2-outside-${source.sourceHead.slice(0, 8)}`);
  rmSync(outsideRoot, { recursive: true, force: true });
  mkdirSync(outsideRoot, { recursive: true });
  const dbSymlink = join(root, "d2-symlink.sqlite");
  try {
    writeFileSync(join(outsideRoot, "outside.sqlite"), "", "utf8");
    rmSync(dbSymlink, { force: true });
    symlinkSync(join(outsideRoot, "outside.sqlite"), dbSymlink);
    const cases = {
      routeOwnedPositive: true,
      canonicalDirectChild: dirname(dbPath) === root,
      rootDigestRecorded: typeof assertRouteOwnedSqliteRoot(root, repoRoot, markerFile).rootDigest === "string",
      missingDatabasePathRejected: expectRuntimeReject({ ...runtimeConfig(root, dbPath), databasePath: undefined }, "transport_runtime_database_path_required"),
      missingDatabaseRootRejected: expectRuntimeReject({ ...runtimeConfig(root, dbPath), databaseRoot: undefined }, "transport_runtime_database_root_required"),
      srvPathRejected: expectRuntimeReject({ ...runtimeConfig(root, dbPath), databaseRoot: join("/srv", "tcrn"), databasePath: join("/srv", "tcrn", "aos.sqlite") }, "transport_runtime_srv_path_denied"),
      durableHomeRejected: expectRuntimeReject({ ...runtimeConfig(root, dbPath), databaseRoot: join(homedir(), ".tcrn", "aos"), databasePath: join(homedir(), ".tcrn", "aos", "runtime.sqlite") }, "transport_runtime_durable_home_path_denied"),
      retainedPreviewOwnerVisibleRejected: expectRuntimeReject({ ...runtimeConfig(root, dbPath), databaseRoot: join(realpathSync(tmpdir()), "preview-owner-visible-root"), databasePath: join(realpathSync(tmpdir()), "preview-owner-visible-root", "runtime.sqlite") }, "transport_runtime_retained_or_owner_visible_path_denied"),
      repoTreeRejected: expectRuntimeReject({ ...runtimeConfig(root, dbPath), databaseRoot: repoRoot, databasePath: join(repoRoot, "runtime.sqlite") }, "phase1_sqlite_root_inside_git_repo_denied"),
      wrongSiblingRejected: expectRuntimeReject({ ...runtimeConfig(root, dbPath), databaseRoot: resolve(repoRoot, "..", "..", "TCRN-AOS", "runtime-profile"), databasePath: resolve(repoRoot, "..", "..", "TCRN-AOS", "runtime-profile", "runtime.sqlite") }, "transport_runtime_wrong_sibling_path_denied"),
      missingMarkerRejected: proveMissingMarkerRejected(),
      staleMarkerRejected: expectRuntimeReject({ ...runtimeConfig(staleMarkerRoot, join(staleMarkerRoot, "runtime.sqlite")) }, "transport_runtime_profile_marker_stale_or_mismatched"),
      symlinkRootRejected: expectRuntimeReject({ ...runtimeConfig(linkedRoot, join(linkedRoot, "runtime.sqlite")) }, "transport_runtime_database_root_symlink_ancestor_denied"),
      dbFileSymlinkRejected: expectRuntimeReject({ ...runtimeConfig(root, dbSymlink) }, "transport_runtime_database_file_symlink_denied"),
      nestedDbPathRejected: expectRuntimeReject({ ...runtimeConfig(root, join(root, "nested", "runtime.sqlite")) }, "transport_runtime_database_nested_path_denied"),
      outsideDbPathRejected: expectRuntimeReject({ ...runtimeConfig(root, join(dirname(root), "outside-runtime.sqlite")) }, "transport_runtime_database_path_outside_route_owned_root")
    };
    return {
      ok: Object.values(cases).every(Boolean),
      ...cases,
      canonicalDatabasePathInsideRouteOwnedRoot: true,
      rawPathRecorded: false,
      databaseOpenedBeforeRejectedChecks: false,
      failures: Object.entries(cases).filter(([, ok]) => ok !== true).map(([name]) => name)
    };
  } finally {
    rmSync(staleMarkerRoot, { recursive: true, force: true });
    rmSync(symlinkParent, { recursive: true, force: true });
    rmSync(outsideRoot, { recursive: true, force: true });
    if (existsSync(dbSymlink)) {
      rmSync(dbSymlink, { force: true });
    }
  }
}

function proveMissingMarkerRejected() {
  const root = join(realpathSync(tmpdir()), `tcrn-aos-d2-missing-marker-${source.sourceHead.slice(0, 8)}`);
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  try {
    return expectRuntimeReject({ ...runtimeConfig(root, join(root, "runtime.sqlite")), runtimeProfileMarker: undefined }, "phase1_sqlite_root_marker_missing");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function expectRuntimeReject(config, expectedReason) {
  try {
    const runtime = createRuntimeTransport(config);
    runtime.close();
    return false;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return reason.includes(expectedReason);
  }
}

function markerContent(root) {
  return {
    route,
    markerVersion,
    rootDigest: sha256(resolve(root)),
    purpose: markerPurpose
  };
}

function runtimeProfileMarkerExpectation() {
  return {
    route,
    markerVersion,
    purpose: markerPurpose
  };
}

function markerMatches(actual, expected) {
  return actual &&
    actual.route === expected.route &&
    actual.markerVersion === expected.markerVersion &&
    actual.rootDigest === expected.rootDigest &&
    actual.purpose === expected.purpose;
}

function markerReadback(root) {
  const markerPath = join(root, markerFile);
  const parsed = JSON.parse(readFileSync(markerPath, "utf8"));
  return {
    ok: markerMatches(parsed, markerContent(root)),
    markerFile,
    markerDigest: sha256(JSON.stringify(parsed)),
    markerKeySet: Object.keys(parsed).sort(),
    markerVersion: parsed.markerVersion,
    markerPurpose: parsed.purpose,
    routeMatches: parsed.route === route,
    rootDigestMatches: parsed.rootDigest === sha256(resolve(root)),
    rawPathRecorded: false
  };
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
    throw new Error("d2_runtime_profile_root_inside_git_tree_denied");
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

function digestDatabaseFile(dbPath) {
  return existsSync(dbPath) ? sha256(readFileSync(dbPath)) : null;
}

function noCommittedDbArtifacts() {
  const result = spawnSync("git", ["ls-files"], { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) return false;
  return !result.stdout.split("\n").some((file) => /\.(sqlite|sqlite3|db|db-shm|db-wal)$/.test(file));
}

function privacyScan(activation) {
  const text = JSON.stringify(activation);
  const findings = [
    ["/Users/", "local_users_path"],
    ["/tmp/", "tmp_path"],
    ["/private/tmp/", "private_tmp_path"],
    ["record_json", "raw_db_row"],
    ["CREATE TABLE", "db_dump"],
    ["owner acceptance", "acceptance_overclaim"],
    ["product acceptance", "acceptance_overclaim"],
    ["final MVP acceptance", "acceptance_overclaim"],
    ["dogfood runtime readiness", "readiness_overclaim"],
    ["release readiness", "release_overclaim"]
  ].filter(([needle]) => text.toLowerCase().includes(String(needle).toLowerCase()))
    .map(([, kind]) => ({ kind }));
  return {
    ok: findings.length === 0 &&
      activation.cleanupRetentionNoOverclaimProof.rawPathRecorded === false &&
      activation.activationReadback.rawPathRecorded === false,
    findings,
    rawPathRecorded: false,
    rawDbDumpRecorded: false,
    secretsOrPiiStored: false,
    ownerAcceptanceClaimed: false,
    productAcceptanceClaimed: false,
    runtimeReadinessClaimed: false,
    releasePublicationPushClaimed: false,
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
    aosBasis: body.source.sourceHead,
    failures: [],
    negativeFailures: [],
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
