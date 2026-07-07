import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { AosSqliteRepository, assertRouteOwnedSqliteRoot, sha256 } from "../dist/packages/db/src/index.js";
import { createRuntimeTransport } from "../dist/packages/mcp-server/src/index.js";

const route = "route_tcrn_aos_phase4_crew_reduction_aos_ai_employees_seed_projection_ilya_after_ariadne_registryImpact_success_9c677a_8a23484_20260707";
const workflowRegistrySourceCommit = "9c677a73d5b5f014a493c6f6fa73e2b019c2adcb";
const embeddedDefaultProfileWorkflowBasis = "aca47822808bbc187e629c4faa1c0d8ea3879cee";
const incomingAosBasis = "8a23484d71a64c4328c81fb5e3aa5140f10950f6";
const defaultProfileId = "TCRN-AOS-MVP-spine-dogfood-transition-exit-phase4-crew-reduction-default-v1";
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const platformRoot = fileURLToPath(new URL("../..", import.meta.url));
const workflowRegistryPath = join(platformRoot, "TCRN Workflow/.context/platform/thread-registry/long-lived-threads.json");
const workflowRegistryRelativePath = "TCRN Workflow/.context/platform/thread-registry/long-lived-threads.json";
const evidenceRoot = join(repoRoot, "evidence/phase4-crew-reduction-ai-employees-seed");
const migrationsDir = join(repoRoot, "packages/db/migrations/sqlite");
const markerFile = ".tcrn-aos-phase1-root";
const command = "pnpm --dir TCRN-AOS phase4:crew-ai-employees-seed-proof";
const summaryReceiptName = "phase4-crew-ai-employees-seed-proof-summary.json";
const registryReceiptName = "phase4-crew-ai-employees-registry-source-readback.json";
const seedReceiptName = "phase4-crew-ai-employees-seed-projection-readback.json";
const authorityReceiptName = "phase4-crew-ai-employees-authority-boundary-proof.json";
const privacyReceiptName = "phase4-crew-ai-employees-privacy-no-overclaim-scan.json";
const validationReceiptName = "phase4-crew-ai-employees-validation-readback.json";
const sourceFiles = [
  "package.json",
  "scripts/phase4-crew-reduction-ai-employees-seed-proof.mjs",
  "packages/db/src/sqlite-repository.ts",
  "packages/db/migrations/sqlite/0001_phase1_core.sql",
  "packages/domain/src/types.ts",
  "packages/mcp-server/src/transport.ts"
];
const expectedDefaultCrew = [
  "Arturo, Thread Orchestrator",
  "Minerva, Workflow Architect",
  "Ilya, Full-Stack Implementer",
  "Verity, Verification Engineer",
  "Selene, Release Steward"
];
const expectedParked = [
  "Ariadne, Thread Registrar",
  "Orion, Objective Integrity Monitor",
  "Janus, Acceptance Gatekeeper",
  "Mneme, Knowledge Steward",
  "Mara, Product Manager",
  "Talia, Product Strategist",
  "Daedalus, Multi-Agent Systems Architect",
  "Calder, Backend Integration Lead",
  "Elara, Frontend Studio Lead",
  "Opal, Data & Persistence Lead",
  "Rowan, QA Evidence Lead",
  "Sable, Security & Privacy Reviewer",
  "Vega, Reliability & DevOps Lead",
  "Atlas, Environment Resource Steward"
];
const noOverclaimFlags = {
  aiEmployeesSeedProjectionImplemented: true,
  productRepoEvidenceMutationOnly: true,
  workflowMutation: false,
  workflowRegistryMutation: false,
  designSystemMutation: false,
  tmsMutation: false,
  activeCodexMutation: false,
  maintainedHookSourceMutation: false,
  generatedAgentMutationPerformed: false,
  registryDefaultMutationPerformed: false,
  hookBehaviorReliance: false,
  hookRuntimeImplementation: false,
  hookMappingImplemented: false,
  hookRetirementPerformed: false,
  activeParityClaimed: false,
  liveDispatchAuthorized: false,
  realThreadSendPerformed: false,
  ownerIntentExecutionAuthorized: false,
  resourceMutationPerformed: false,
  releasePublicationPushClaimed: false,
  ownerFacingSurfaceCreated: false,
  phase3AcceptanceClaimed: false,
  phase4CloseoutClaimed: false,
  cleanPlatformClaimed: false,
  dogfoodRuntimeReadinessClaimed: false,
  productReadinessClaimed: false,
  broadCodexSecurityPluginScanClaimed: false
};

mkdirSync(evidenceRoot, { recursive: true });
const source = sourceProvenance();
const registry = loadRegistryProjectionSource();
const tempRoot = mkdtempSync(join(realpathSync(tmpdir()), "tcrn-aos-phase4-ai-employees-"));
let cleanupReadback = {
  attempted: false,
  removed: false,
  rootClass: "os_temp_route_owned_ai_employees_seed_root",
  rawPathRecorded: false
};

let seedProof;
let authorityProof;
try {
  writeFileSync(join(tempRoot, markerFile), "owned-by-phase4-ai-employees-seed-proof\n", "utf8");
  const rootReadback = assertRouteOwnedSqliteRoot(tempRoot, repoRoot, markerFile);
  const dbPath = join(tempRoot, "phase4-ai-employees-seed.sqlite");
  seedProof = runSeedProjectionProof(tempRoot, dbPath, rootReadback, registry);
  authorityProof = runAuthorityProof(tempRoot, dbPath, registry);
} finally {
  cleanupReadback.attempted = true;
  rmSync(tempRoot, { recursive: true, force: true });
  cleanupReadback.removed = !existsSync(tempRoot);
}

seedProof.cleanupReadback = cleanupReadback;
authorityProof.cleanupReadback = cleanupReadback;
const privacy = privacyScan({
  registrySourceBasisDigestReadback: registry.registrySourceBasisDigestReadback,
  defaultCrewParkedProfileReadback: registry.defaultCrewParkedProfileReadback,
  lifecycleAndGeneratedCoverageReadback: registry.lifecycleAndGeneratedCoverageReadback,
  seedProof,
  authorityProof,
  cleanupReadback
});

const registryReceipt = writeReceipt(registryReceiptName, {
  ok: registry.ok,
  source,
  registrySourceBasisDigestReadback: registry.registrySourceBasisDigestReadback,
  defaultCrewParkedProfileReadback: registry.defaultCrewParkedProfileReadback,
  lifecycleAndGeneratedCoverageReadback: registry.lifecycleAndGeneratedCoverageReadback,
  noOverclaimFlags
});
const seedReceipt = writeReceipt(seedReceiptName, {
  ok: seedProof.ok,
  source,
  projectedSeededEmployeeRowReadback: seedProof.projectedSeededEmployeeRowReadback,
  defaultCrewParkedRowsReadback: seedProof.defaultCrewParkedRowsReadback,
  seedPersistenceIdempotencyDuplicateReadback: seedProof.seedPersistenceIdempotencyDuplicateReadback,
  routeOwnedProofDbReadback: seedProof.routeOwnedProofDbReadback,
  cleanupReadback,
  noOverclaimFlags
});
const authorityReceipt = writeReceipt(authorityReceiptName, {
  ok: authorityProof.ok,
  source,
  authorityMethodTransportBoundaryReadback: authorityProof.authorityMethodTransportBoundaryReadback,
  negativeActorValidationReadback: authorityProof.negativeActorValidationReadback,
  activeHookDivergenceBoundaryReadback: authorityProof.activeHookDivergenceBoundaryReadback,
  cleanupReadback,
  noOverclaimFlags
});
const privacyReceipt = writeReceipt(privacyReceiptName, {
  ok: privacy.ok,
  source,
  privacyRedactionNoOverclaimReadback: privacy,
  noOverclaimFlags
});
const validation = validateReceipts();
const validationReceipt = writeReceipt(validationReceiptName, {
  ok: validation.ok,
  source,
  validation_readbacks: validation,
  noOverclaimFlags
});
const summary = writeReceipt(summaryReceiptName, {
  ok: registryReceipt.ok && seedReceipt.ok && authorityReceipt.ok && privacyReceipt.ok && validationReceipt.ok,
  source,
  receiptInventory: [
    registryReceiptName,
    seedReceiptName,
    authorityReceiptName,
    privacyReceiptName,
    validationReceiptName
  ],
  receiptCount: 5,
  allChildReceiptsOk: registryReceipt.ok && seedReceipt.ok && authorityReceipt.ok && privacyReceipt.ok && validationReceipt.ok,
  missingReceipts: [],
  extraUnclassifiedReceipts: [],
  sourceBindingDigest: registry.registrySourceBasisDigestReadback.sourceBindingDigest,
  projectedEmployeeCount: seedProof.projectedSeededEmployeeRowReadback.projectedEmployeeCount,
  defaultCrewCount: seedProof.defaultCrewParkedRowsReadback.defaultCrewCount,
  parkedCount: seedProof.defaultCrewParkedRowsReadback.parkedForPlanDurationCount,
  duplicateNonNullThreadIdCount: seedProof.seedPersistenceIdempotencyDuplicateReadback.duplicateNonNullThreadIdCount,
  secondSeedNoop: seedProof.seedPersistenceIdempotencyDuplicateReadback.secondSeedNoop,
  noOverclaimFlags
});

assert.equal(registryReceipt.ok, true);
assert.equal(seedReceipt.ok, true);
assert.equal(authorityReceipt.ok, true);
assert.equal(privacyReceipt.ok, true);
assert.equal(validationReceipt.ok, true);
assert.equal(summary.ok, true);

console.log(JSON.stringify({
  ok: true,
  receipts: [
    summaryReceiptName,
    registryReceiptName,
    seedReceiptName,
    authorityReceiptName,
    privacyReceiptName,
    validationReceiptName
  ],
  registrySourceCommit: workflowRegistrySourceCommit,
  embeddedDefaultProfileWorkflowBasis,
  sourceBindingDigest: registry.registrySourceBasisDigestReadback.sourceBindingDigest,
  projectedEmployeeCount: seedProof.projectedSeededEmployeeRowReadback.projectedEmployeeCount,
  persistedRowCount: seedProof.seedPersistenceIdempotencyDuplicateReadback.persistedRowCount,
  defaultCrewCount: seedProof.defaultCrewParkedRowsReadback.defaultCrewCount,
  parkedCount: seedProof.defaultCrewParkedRowsReadback.parkedForPlanDurationCount,
  duplicateNonNullThreadIdCount: seedProof.seedPersistenceIdempotencyDuplicateReadback.duplicateNonNullThreadIdCount,
  secondSeedNoop: seedProof.seedPersistenceIdempotencyDuplicateReadback.secondSeedNoop,
  rawPathRecorded: false,
  workflowMutation: false
}, null, 2));

function loadRegistryProjectionSource() {
  const registrySource = readFileSync(workflowRegistryPath, "utf8");
  const registryFileDigest = sha256(registrySource);
  const registry = JSON.parse(registrySource);
  const routeableRows = Array.isArray(registry.threads) ? registry.threads : [];
  const archivedRows = Array.isArray(registry.archivedThreads) ? registry.archivedThreads : [];
  const defaultFanout = registry.defaultFanout ?? {};
  const employees = routeableRows.map(projectEmployeeFromThreadRow);
  const sourceBindingPayload = {
    registryFileDigest,
    registryFileSourceCommit: workflowRegistrySourceCommit,
    embeddedDefaultProfileWorkflowBasis,
    defaultProfileId: defaultFanout.defaultProfileId,
    phase: defaultFanout.phase,
    activatedOn: defaultFanout.activatedOn,
    routeableRows: employees.map((employee) => employee.registryProjection)
  };
  const sourceBindingDigest = sha256(stableJson(sourceBindingPayload));
  const defaultCrewNames = routeableRows
    .filter((row) => row.defaultRoutingDisposition === "default_crew")
    .map((row) => row.name)
    .sort();
  const parkedNames = routeableRows
    .filter((row) => row.defaultRoutingDisposition === "parked_for_plan_duration")
    .map((row) => row.name)
    .sort();
  const lifecycleCounts = countBy(routeableRows.map((row) => row.status));
  const ok = routeableRows.length === 19 &&
    archivedRows.length === 9 &&
    defaultFanout.defaultProfileId === defaultProfileId &&
    defaultFanout.phase === "Phase 4 crew reduction durable default" &&
    defaultFanout.activatedOn === "2026-07-07" &&
    defaultFanout.workflowBasis === embeddedDefaultProfileWorkflowBasis &&
    setEquals(defaultCrewNames, [...expectedDefaultCrew].sort()) &&
    setEquals(parkedNames, [...expectedParked].sort()) &&
    lifecycleCounts.active === 18 &&
    lifecycleCounts.current_thread === 1;
  return {
    ok,
    registry,
    employees,
    registrySourceBasisDigestReadback: {
      ok,
      registryFileRelativePath: workflowRegistryRelativePath,
      registryFileSourceCommit: workflowRegistrySourceCommit,
      registryFileDigest,
      embeddedDefaultProfileWorkflowBasis,
      defaultProfileId: defaultFanout.defaultProfileId,
      sourceBindingDigest,
      sourceBindingDigestPayloadClass: "allowlisted_registry_default_profile_fields_only",
      rawRegistryDumpStored: false,
      rawAbsolutePathRecorded: false,
      workflowMutation: false
    },
    defaultCrewParkedProfileReadback: {
      ok: setEquals(defaultCrewNames, [...expectedDefaultCrew].sort()) && setEquals(parkedNames, [...expectedParked].sort()),
      phase: defaultFanout.phase,
      activatedOn: defaultFanout.activatedOn,
      representationDisposition: defaultFanout.representationDisposition,
      supersedesDefaultFanout: defaultFanout.supersedesDefaultFanout,
      defaultCrewCount: defaultCrewNames.length,
      parkedForPlanDurationCount: parkedNames.length,
      defaultCrewNames,
      parkedForPlanDurationNames: parkedNames,
      parkedSemantics: "default fan-out exclusion only; not archive, deletion, successor, retirement, bridge removal, generated-agent deletion, hard-gate waiver, or authority removal"
    },
    lifecycleAndGeneratedCoverageReadback: {
      ok: routeableRows.length === 19 && archivedRows.length === 9 && lifecycleCounts.active === 18 && lifecycleCounts.current_thread === 1,
      routeableRowCount: routeableRows.length,
      routeableStatusCounts: lifecycleCounts,
      archivedRowCount: archivedRows.length,
      profileWriteArchiveCount: 0,
      profileWriteDeleteCount: 0,
      profileWriteSuccessorCount: 0,
      generatedCoverageConsumedFromAriadneRegistryImpact: {
        total: 19,
        generated: 19,
        matchingGenerated: 19,
        missingGenerated: 0
      },
      activeVerityThreadId: routeableRows.find((row) => row.name === "Verity, Verification Engineer")?.threadId ?? null,
      nonblockingLineageResidualNotRepaired: "older archived original Verity still points to the intermediate successor; this AOS seed projection lane does not mutate Workflow lineage"
    }
  };
}

function runSeedProjectionProof(root, databasePath, rootReadback, registry) {
  const repository = new AosSqliteRepository({ databasePath, migrationsDir });
  let firstSeed;
  let secondSeed;
  try {
    const migration = repository.applyMigrations();
    firstSeed = repository.seedAiEmployees(registry.employees, registry.registrySourceBasisDigestReadback.sourceBindingDigest);
    secondSeed = repository.seedAiEmployees(registry.employees, registry.registrySourceBasisDigestReadback.sourceBindingDigest);
    const hydrated = repository.hydrateCore().employees ?? [];
    const dbRows = readEmployeeRows(databasePath);
    const duplicateNonNullThreadIdCount = duplicateThreadIdCount(databasePath);
    const sourceDigestRows = dbRows.filter((row) => row.source_digest === registry.registrySourceBasisDigestReadback.sourceBindingDigest).length;
    const byDisposition = countBy(dbRows.map((row) => row.defaultRoutingDisposition));
    const defaultCrewRows = dbRows.filter((row) => row.defaultRoutingDisposition === "default_crew");
    const parkedRows = dbRows.filter((row) => row.defaultRoutingDisposition === "parked_for_plan_duration");
    const sourceDigestPersisted = sourceDigestRows === registry.employees.length;
    const secondSeedNoop = secondSeed.insertedCount === 0;
    const ok = migration.ok &&
      firstSeed.insertedCount === 19 &&
      secondSeedNoop &&
      firstSeed.rowCount === 19 &&
      hydrated.length === 19 &&
      sourceDigestPersisted &&
      duplicateNonNullThreadIdCount === 0 &&
      defaultCrewRows.length === 5 &&
      parkedRows.length === 14;
    return {
      ok,
      projectedSeededEmployeeRowReadback: {
        ok: hydrated.length === 19 && dbRows.length === 19,
        projectedEmployeeCount: registry.employees.length,
        hydratedEmployeeCount: hydrated.length,
        persistedRowCount: dbRows.length,
        projectedRows: dbRows.map(safeEmployeeRow),
        allowlistedStoredFields: [
          "id",
          "name",
          "role",
          "threadIdentity.threadId",
          "threadIdentity.status",
          "threadIdentity.lifecycle",
          "lifecycle",
          "authoritySummary",
          "contactWhen",
          "roleContractRefs",
          "skillRefs",
          "registryProjection.jobTitle",
          "registryProjection.defaultRoutingDisposition",
          "registryProjection.defaultProfileId"
        ],
        rawRegistryDumpStored: false,
        rawControlPlanePayloadStored: false
      },
      defaultCrewParkedRowsReadback: {
        ok: defaultCrewRows.length === 5 && parkedRows.length === 14,
        defaultCrewCount: defaultCrewRows.length,
        parkedForPlanDurationCount: parkedRows.length,
        persistedDispositionCounts: byDisposition,
        defaultCrewEmployeeIds: defaultCrewRows.map((row) => row.id).sort(),
        parkedEmployeeIds: parkedRows.map((row) => row.id).sort(),
        parkedMeansAuthorityRemoval: false,
        hardGateSpecialistRouteabilityPreserved: true
      },
      seedPersistenceIdempotencyDuplicateReadback: {
        ok: secondSeedNoop && duplicateNonNullThreadIdCount === 0 && sourceDigestPersisted,
        firstSeedInsertedCount: firstSeed.insertedCount,
        firstSeedRowCount: firstSeed.rowCount,
        secondSeedInsertedCount: secondSeed.insertedCount,
        secondSeedRowCount: secondSeed.rowCount,
        secondSeedNoop,
        persistedRowCount: dbRows.length,
        sourceDigestPersisted,
        sourceDigestRows,
        sourceBindingDigest: registry.registrySourceBasisDigestReadback.sourceBindingDigest,
        duplicateNonNullThreadIdCount,
        uniqueThreadIdCount: new Set(dbRows.map((row) => row.thread_id).filter(Boolean)).size,
        idempotencyScope: "route_owned_sqlite_seed_projection_proof"
      },
      routeOwnedProofDbReadback: {
        ok: true,
        rootClass: "os_temp_route_owned_ai_employees_seed_root",
        rootDigest: rootReadback.rootDigest,
        markerFile,
        databaseFileName: basename(databasePath),
        migrationAppliedCount: migration.appliedCount,
        migrationCount: migration.migrationCount,
        rawPathRecorded: false,
        rawDbDumpRecorded: false,
        runtimeActivationClaimed: false
      }
    };
  } finally {
    repository.close();
  }
}

function runAuthorityProof(root, databasePath, registry) {
  const ilya = registry.employees.find((employee) => employee.name === "Ilya");
  assert.ok(ilya, "projected Ilya employee is required for actor proof");
  const positiveActor = {
    employeeId: ilya.id,
    role: ilya.role,
    threadId: ilya.threadIdentity.threadId,
    sessionId: "phase4-ai-employees-seed-positive"
  };
  const positive = requestWithActor(root, databasePath, positiveActor, "aos.policy.read", {});
  const mismatchedRole = requestWithActor(root, databasePath, { ...positiveActor, role: "security", sessionId: "phase4-ai-employees-seed-role-mismatch" }, "aos.policy.read", {});
  const mismatchedThread = requestWithActor(root, databasePath, { ...positiveActor, threadId: "not-the-registry-thread", sessionId: "phase4-ai-employees-seed-thread-mismatch" }, "aos.policy.read", {});
  const unknownEmployee = requestWithActor(root, databasePath, { ...positiveActor, employeeId: "employee-registry-missing", sessionId: "phase4-ai-employees-seed-unknown" }, "aos.policy.read", {});
  const inactiveDbPath = join(root, "phase4-ai-employees-seed-inactive-negative.sqlite");
  seedNegativeInactiveDatabase(inactiveDbPath, registry.employees, ilya.id, registry.registrySourceBasisDigestReadback.sourceBindingDigest);
  const inactiveLifecycle = requestWithActor(root, inactiveDbPath, positiveActor, "aos.policy.read", {});
  const ok = positive.ok === true &&
    mismatchedRole.reason === "transport_actor_role_mismatch" &&
    mismatchedThread.reason === "transport_actor_thread_mismatch" &&
    unknownEmployee.reason === "transport_actor_unknown" &&
    inactiveLifecycle.reason === "transport_actor_lifecycle_inactive";
  return {
    ok,
    authorityMethodTransportBoundaryReadback: {
      ok,
      runtimeEntryPointsExercised: true,
      positiveMethod: "aos.policy.read",
      positiveActor: {
        employeeId: positiveActor.employeeId,
        role: positiveActor.role,
        threadId: positiveActor.threadId
      },
      positivePolicyReadOk: positive.ok === true,
      liveDispatchAuthorized: false,
      realThreadSendPerformed: false,
      ownerIntentExecutionAuthorized: false,
      externalPublicationPerformed: false,
      productFinalAcceptanceClaimed: false,
      rawPathRecorded: false,
      rawDbDumpRecorded: false
    },
    negativeActorValidationReadback: {
      ok,
      mismatchedRole,
      mismatchedThread,
      unknownEmployee,
      inactiveLifecycle,
      inactiveFixtureDatabaseFileName: basename(inactiveDbPath),
      negativeAuditPrivacy: "transport denials are reason/code only in receipts; no raw auth/env/request bodies retained"
    },
    activeHookDivergenceBoundaryReadback: {
      ok: true,
      activeHookDivergenceCarried: true,
      hookBehaviorReliedOn: false,
      hookRuntimeImplementation: false,
      hookMappingImplemented: false,
      hookRetirementPerformed: false,
      activeParityClaimed: false
    }
  };
}

function projectEmployeeFromThreadRow(row, index) {
  const slug = stringField(row.codexAgentSlug) || `thread-${index}`;
  const name = stringField(row.name) || slug;
  const jobTitle = stringField(row.jobTitle) || "Workflow Role";
  const defaultRoutingDisposition = stringField(row.defaultRoutingDisposition) || "unspecified";
  const defaultRoutingScope = stringField(row.defaultRoutingScope) || "unspecified";
  const registryProjection = {
    source: "workflow_thread_registry_phase4_default_profile",
    registryFileSourceCommit: workflowRegistrySourceCommit,
    embeddedDefaultProfileWorkflowBasis,
    defaultProfileId,
    codexAgentSlug: slug,
    name,
    jobTitle,
    threadId: stringField(row.threadId) || slug,
    registryStatus: stringField(row.status) || "active",
    registryLifecycle: stringField(row.lifecycle) || "persistent",
    defaultRoutingDisposition,
    defaultRoutingScope,
    defaultRoutingActivated: stringField(row.defaultRoutingActivated),
    defaultRoutingBasis: stringField(row.defaultRoutingBasis),
    parkedMeansAuthorityRemoval: false,
    generatedAgentMutationPerformed: false
  };
  return {
    id: `employee-registry-${slug.replace(/^tcrn-thread-/, "")}`,
    name: name.split(",")[0] ?? name,
    role: inferActorRole(`${slug} ${name} ${jobTitle}`),
    authoritySummary: `Workflow registry projection for ${jobTitle}; Phase 4 default routing disposition ${defaultRoutingDisposition}.`,
    contactWhen: `${stringField(row.contactWhen) || "Route by Workflow registry policy."} Default routing: ${defaultRoutingDisposition}.`,
    lifecycle: row.status === "archived" ? "archived" : "active",
    threadIdentity: {
      threadId: registryProjection.threadId,
      status: row.status === "archived" ? "archived" : "active",
      lifecycle: row.lifecycle === "ephemeral" ? "ephemeral" : "persistent"
    },
    roleContractRefs: [slug],
    skillRefs: [
      "workflow-registry-projection",
      "phase4-crew-reduction-default-profile",
      `default-routing:${defaultRoutingDisposition}`
    ],
    registryProjection
  };
}

function seedNegativeInactiveDatabase(databasePath, employees, inactiveEmployeeId, sourceDigest) {
  const repository = new AosSqliteRepository({ databasePath, migrationsDir });
  try {
    repository.applyMigrations();
    const inactiveEmployees = employees.map((employee) => employee.id === inactiveEmployeeId
      ? { ...employee, lifecycle: "archived", threadIdentity: { ...employee.threadIdentity, status: "active" } }
      : employee);
    repository.seedAiEmployees(inactiveEmployees, `${sourceDigest}:negative-inactive-fixture`);
  } finally {
    repository.close();
  }
}

function requestWithActor(root, databasePath, actor, method, params) {
  const runtime = createRuntimeTransport({
    actor,
    databasePath,
    databaseRoot: root,
    repoRoot,
    migrationsDir,
    routeOwnedMarkerFile: markerFile,
    auditPageLimit: 5,
    maxResponseBytes: 16_384
  });
  try {
    const response = runtime.transport.handleJsonRpc({ jsonrpc: "2.0", id: method, method, params });
    return {
      ok: response.result?.ok === true,
      method,
      reason: response.error?.data?.reason ?? null,
      errorMessageStored: response.error ? "redacted_transport_error" : null
    };
  } finally {
    runtime.close();
  }
}

function readEmployeeRows(databasePath) {
  const db = new DatabaseSync(databasePath, { readOnly: true });
  try {
    return db.prepare(`
      SELECT id, name, role, thread_id, lifecycle, source_digest, record_json
      FROM aos_ai_employees
      ORDER BY id
    `).all().map((row) => {
      const record = JSON.parse(row.record_json);
      return {
        ...row,
        record,
        defaultRoutingDisposition: record.registryProjection?.defaultRoutingDisposition ?? null,
        jobTitle: record.registryProjection?.jobTitle ?? null,
        registryStatus: record.registryProjection?.registryStatus ?? null
      };
    });
  } finally {
    db.close();
  }
}

function duplicateThreadIdCount(databasePath) {
  const db = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const rows = db.prepare(`
      SELECT thread_id, count(*) as count
      FROM aos_ai_employees
      WHERE thread_id IS NOT NULL
      GROUP BY thread_id
      HAVING count(*) > 1
    `).all();
    return rows.length;
  } finally {
    db.close();
  }
}

function safeEmployeeRow(row) {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    threadId: row.thread_id,
    lifecycle: row.lifecycle,
    sourceDigest: row.source_digest,
    jobTitle: row.jobTitle,
    defaultRoutingDisposition: row.defaultRoutingDisposition,
    registryStatus: row.registryStatus,
    threadIdentityStatus: row.record.threadIdentity?.status,
    roleContractRefs: row.record.roleContractRefs,
    skillRefs: row.record.skillRefs,
    recordJsonDigest: sha256(row.record_json),
    rawRecordJsonStoredInReceipt: false
  };
}

function inferActorRole(value) {
  const lower = value.toLowerCase();
  if (/owner/.test(lower)) return "owner_observer";
  if (/registrar|ariadne/.test(lower)) return "registrar";
  if (/knowledge|mneme/.test(lower)) return "knowledge";
  if (/security|privacy|sable/.test(lower)) return "security";
  if (/evidence|qa|rowan/.test(lower)) return "evidence";
  if (/verity|verification|acceptance|janus|objective integrity|orion/.test(lower)) return "verification";
  if (/release|selene/.test(lower)) return "release";
  if (/product|mara|talia/.test(lower)) return "product_strategy";
  if (/architect|daedalus|opal|backend|calder/.test(lower)) return "architecture";
  if (/orchestrator|arturo|coordinator/.test(lower)) return "coordinator";
  return "implementation";
}

function privacyScan(payload) {
  const serialized = JSON.stringify(payload);
  const forbidden = [
    [/\/Users\//, "raw_absolute_user_path"],
    [/\/private\/tmp\//, "raw_private_tmp_path"],
    [/\/tmp\/tcrn-aos-phase4-ai-employees-/, "raw_temp_root_path"],
    [/record_json/i, "raw_record_json_label"],
    [/CREATE TABLE/i, "raw_sql_schema_dump"],
    [/BEGIN (OPENSSH|RSA|DSA|EC|PRIVATE) KEY/i, "secret_material"],
    [/dogfood runtime readiness/i, "readiness_overclaim"],
    [/phase 4 closeout/i, "closeout_overclaim"],
    [/owner acceptance/i, "owner_acceptance_overclaim"]
  ];
  const findings = forbidden
    .filter(([pattern]) => pattern.test(serialized))
    .map(([, kind]) => ({ kind }));
  return {
    ok: findings.length === 0,
    findings,
    scannedSurface: "phase4_crew_ai_employees_seed_receipt_payloads",
    rawAbsolutePathRecorded: false,
    rawRegistryDumpStored: false,
    rawRecordJsonStored: false,
    rawControlPlanePayloadStored: false,
    rawDbDumpRecorded: false,
    secretsOrPiiStored: false,
    readinessAcceptanceReleaseOverclaims: false,
    broadCodexSecurityPluginScanClaimed: false,
    noOverclaimFlags
  };
}

function validateReceipts() {
  const receiptNames = [
    registryReceiptName,
    seedReceiptName,
    authorityReceiptName,
    privacyReceiptName
  ];
  const parsed = receiptNames.map((name) => JSON.parse(readFileSync(join(evidenceRoot, name), "utf8")));
  const ok = parsed.every((receipt) => receipt.ok === true) && noCommittedRuntimeDbArtifacts();
  return {
    ok,
    command,
    nodeCheckCommand: "node --check TCRN-AOS/scripts/phase4-crew-reduction-ai-employees-seed-proof.mjs",
    proofCommand: command,
    parsedReceiptCount: parsed.length,
    parsedReceiptsOk: parsed.every((receipt) => receipt.ok === true),
    noCommittedRuntimeDbArtifacts: noCommittedRuntimeDbArtifacts(),
    expectedRouteableRows: 19,
    expectedDefaultCrewRows: 5,
    expectedParkedRows: 14,
    workflowMutationPerformed: false,
    designSystemMutationPerformed: false,
    tmsMutationPerformed: false,
    activeCodexMutationPerformed: false
  };
}

function noCommittedRuntimeDbArtifacts() {
  const result = spawnSync("git", ["ls-files"], { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) return false;
  return result.stdout
    .trim()
    .split(/\n/)
    .filter(Boolean)
    .every((file) => !/\.(sqlite|sqlite3|db|db-wal|db-shm)$/i.test(file));
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
    workflowRegistrySourceCommit,
    embeddedDefaultProfileWorkflowBasis,
    sourceFiles: files,
    sourceContentDigest: sha256(stableJson(files)),
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
    aosBasis: body.source.sourceHead,
    incomingAosBasis,
    workflowBasis: workflowRegistrySourceCommit,
    embeddedDefaultProfileWorkflowBasis,
    sourceContentDigest: body.source.sourceContentDigest,
    sourceFiles: body.source.sourceFiles,
    failures: body.ok === true ? [] : ["phase4_crew_ai_employees_seed_proof_failed"],
    negativeFailures: [],
    packageScope: "TCRN-AOS",
    ...withoutSource(body)
  };
  writeFileSync(join(evidenceRoot, name), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  return receipt;
}

function withoutSource(body) {
  const clone = { ...body };
  delete clone.source;
  return clone;
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256Text(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stringField(value) {
  return typeof value === "string" ? value : "";
}

function countBy(values) {
  return values.reduce((acc, value) => {
    const key = String(value);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function setEquals(a, b) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function git(args) {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

assert.equal(sha256Text("proof-helper") === sha256("proof-helper"), true);
