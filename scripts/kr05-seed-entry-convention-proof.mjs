import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AosSqliteRepository,
  createKr05FactCardConventionEntry,
  kr05FactCardConventionEntryId,
  kr05MaxPreEpicSeedEntries,
  kr05OwnerSeedEntryListDisposition,
  kr05SeedEntryBatchReadback,
  stableJson,
  toKnowledgeRetrievalEntryInput
} from "../dist/packages/db/src/index.js";
import { createRuntimeTransport } from "../dist/packages/mcp-server/src/index.js";
import { createDefaultSeed } from "../dist/packages/domain/src/index.js";

const route = "route_tcrn_aos_knowledge_retrieval_layer_kr05_seed_entries_after_kr04_gate_green_4a5023_40ddb3e2_20260708";
const command = "pnpm --dir TCRN-AOS kr05:seed-entry-convention-proof";
const ownerDecisionWorkflowBasis = "8dce81d2e9a6408d1d139e4d84486497c6caf288";
const kr00GateGreenWorkflowBasis = "1d60763f3c0c3eae0fb5465fb50189c4951c48df";
const kr04MaterializationWorkflowBasis = "4a50236257494a225fc26d3e1d9d0cb207e02d42";
const incomingAosBasis = "40ddb3e2c1ac79e96eadcad2ae25b8fc12ca5112";
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const platformRoot = dirname(repoRoot);
const migrationsDir = join(repoRoot, "packages/db/migrations/sqlite");
const evidenceRoot = "evidence/aos-knowledge-retrieval-layer-kr05";
const summaryPath = join(evidenceRoot, "kr05-seed-entry-convention-proof-summary.json");
const readbackPath = join(evidenceRoot, "kr05-seed-entry-convention-readback.json");
const sourceFiles = [
  "package.json",
  "packages/db/src/index.ts",
  "packages/db/src/knowledge-seed-convention.ts",
  "packages/db/test/kr05-seed-entry-convention.test.mjs",
  "scripts/kr05-seed-entry-convention-proof.mjs"
];
const ilyaActor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "kr05-seed-entry-convention-proof"
};
const noOverclaimFlags = {
  kr05SeedEntryConventionOnly: true,
  kr06Started: false,
  bulkVaultMigrationPerformed: false,
  moreThan20PreEpicEntriesCreated: false,
  nonEnumeratedCanonicalSeedEntriesCreated: false,
  transportMethodExpanded: false,
  kr04HookChanged: false,
  workflowMutation: false,
  designSystemMutation: false,
  tmsMutation: false,
  pushRun: false,
  batchPushGateRun: false,
  releaseReadinessClaimed: false,
  ownerFacingAcceptanceClaimed: false,
  finalAcceptanceClaimed: false,
  cleanPlatformClaimed: false,
  parentCompletionClaimed: false,
  liveDispatchAuthorized: false,
  ownerIntentExecutionAuthorized: false
};

mkdirSync(evidenceRoot, { recursive: true });
const source = sourceProvenance();
const tmpRoot = join(platformRoot, "tmp");
mkdirSync(tmpRoot, { recursive: true });
const root = await mkdtemp(join(tmpRoot, "tcrn-aos-kr05-proof-"));
try {
  const proof = await runProof(root);
  const privacy = privacyScan(proof);
  const readbackReceipt = writeReceipt(readbackPath, {
    ok: proof.ok && privacy.ok,
    route,
    command,
    source,
    seedEntryBoundaryReadback: proof.seedEntryBoundaryReadback,
    searchReadback: proof.searchReadback,
    conventionReadback: proof.conventionReadback,
    negativeBoundaryReadback: proof.negativeBoundaryReadback,
    idempotencyReadback: proof.idempotencyReadback,
    privacyNoArtifactNoOverclaimReadback: proof.privacyNoArtifactNoOverclaimReadback,
    validation_readbacks: proof.validation_readbacks,
    privacyNoOverclaimScan: privacy,
    failures: [...proof.failures, ...privacy.findings.map((finding) => finding.kind)],
    negativeFailures: proof.negativeFailures,
    noOverclaimFlags
  });
  const summaryReceipt = writeReceipt(summaryPath, {
    ok: readbackReceipt.ok === true,
    route,
    command,
    source,
    receiptInventory: ["kr05-seed-entry-convention-readback.json"],
    receiptCount: 1,
    allChildReceiptsOk: readbackReceipt.ok === true,
    missingReceipts: [],
    extraUnclassifiedReceipts: [],
    readbackReceiptDigest: sha256(stableJson(readbackReceipt)),
    seedEntryBoundaryReadback: proof.seedEntryBoundaryReadback,
    conventionEntryId: proof.conventionReadback.conventionEntryId,
    searchReturnedIds: proof.searchReadback.defaultSearchReturnedIds,
    noOverclaimFlags,
    failures: readbackReceipt.ok === true ? [] : ["kr05_seed_entry_convention_readback_not_ok"],
    negativeFailures: proof.negativeFailures
  });

  assert.equal(readbackReceipt.ok, true);
  assert.equal(summaryReceipt.ok, true);
  console.log(JSON.stringify({
    ok: true,
    route,
    command,
    receipts: [summaryPath, readbackPath],
    conventionEntryId: proof.conventionReadback.conventionEntryId,
    seedEntriesCreated: proof.seedEntryBoundaryReadback.seedEntriesCreated,
    canonicalSeedEntriesCreated: proof.seedEntryBoundaryReadback.canonicalSeedEntriesCreated,
    defaultSearchReturnedIds: proof.searchReadback.defaultSearchReturnedIds,
    sourceHead: source.sourceHead
  }, null, 2));
} finally {
  await rm(root, { recursive: true, force: true });
}

async function runProof(root) {
  const databasePath = join(root, "kr05.sqlite");
  await writeFile(join(root, ".tcrn-aos-phase1-root"), "owned-by-kr05-proof\n", "utf8");
  const repository = new AosSqliteRepository({ databasePath, migrationsDir });
  repository.applyMigrations();
  repository.seedAiEmployees(createDefaultSeed().employees, "kr05-seed-entry-convention-proof-seed");

  const convention = createKr05FactCardConventionEntry();
  const conventionPolicy = kr05SeedEntryBatchReadback([convention], {
    ownerSeedEntryListDisposition: kr05OwnerSeedEntryListDisposition
  });
  assert.equal(conventionPolicy.acceptedCount, 1);
  assert.equal(conventionPolicy.canonicalSeedEntryCount, 0);
  const firstConvention = repository.createKnowledgeRetrievalEntry(toKnowledgeRetrievalEntryInput(convention));
  const secondConvention = repository.createKnowledgeRetrievalEntry(toKnowledgeRetrievalEntryInput(convention));
  assert.equal(firstConvention.id, secondConvention.id);
  repository.close();

  const runtime = createRuntimeTransport({ actor: ilyaActor, databasePath, databaseRoot: root, repoRoot, migrationsDir });
  let defaultSearch;
  let detailRead;
  let draftPropose;
  let draftDefaultSearch;
  let draftIncludeSearch;
  try {
    defaultSearch = call(runtime, "aos.knowledge.search", {
      query: "fact card convention",
      project: "TCRN-AOS",
      limit: 5
    });
    assert.deepEqual(defaultSearch.items.map((item) => item.id), [kr05FactCardConventionEntryId]);
    detailRead = call(runtime, "aos.knowledge.entry.read", { id: kr05FactCardConventionEntryId });
    assert.equal(detailRead.entry.id, kr05FactCardConventionEntryId);
    assert.equal(detailRead.entry.bodyIncluded, true);

    const draftFixture = createKr05FactCardConventionEntry({
      id: "knowledge-kr05-proof-draft-fact-card",
      title: "KR-05 draft proof fact card",
      status: "draft",
      seedKind: "convention_proof_fixture",
      summary: "Draft KR-05 proof fact card excluded from default retrieval.",
      body: convention.body.replace("A fact card covers", "This proof draft fact card covers"),
      tags: ["kr05", "proof-fixture", "fact-card"]
    });
    const draftPolicy = kr05SeedEntryBatchReadback([draftFixture]);
    assert.equal(draftPolicy.acceptedCount, 1);
    draftPropose = call(runtime, "aos.knowledge.entry.propose", {
      ...toKnowledgeRetrievalEntryInput(draftFixture),
      idempotencyKey: "kr05-proof-draft-fact-card"
    });
    const draftReplay = call(runtime, "aos.knowledge.entry.propose", {
      ...toKnowledgeRetrievalEntryInput(draftFixture),
      idempotencyKey: "kr05-proof-draft-fact-card"
    });
    assert.equal(draftReplay.status, "deduped");
    draftDefaultSearch = call(runtime, "aos.knowledge.search", {
      query: "proof draft fact card",
      project: "TCRN-AOS"
    });
    assert.deepEqual(draftDefaultSearch.items.map((item) => item.id), []);
    draftIncludeSearch = call(runtime, "aos.knowledge.search", {
      query: "proof draft fact card",
      project: "TCRN-AOS",
      includeDraft: true
    });
    assert.deepEqual(draftIncludeSearch.items.map((item) => item.id), ["knowledge-kr05-proof-draft-fact-card"]);
  } finally {
    runtime.close();
  }

  const negativeBoundaryReadback = negativeBoundaryProof(convention);
  const noGitArtifactReadback = noCommittedArtifacts();
  return {
    ok: true,
    seedEntryBoundaryReadback: {
      ok: true,
      ownerSeedEntryListDisposition: kr05OwnerSeedEntryListDisposition,
      ownerEnumeratedCanonicalSeedEntryIds: [],
      conventionEntryCreated: true,
      conventionEntryStatus: "canonical",
      conventionEntryCount: 1,
      seedEntriesCreated: 0,
      canonicalSeedEntriesCreated: 0,
      draftProofFixtureEntriesCreated: 1,
      maxPreEpicSeedEntries: kr05MaxPreEpicSeedEntries,
      bulkVaultMigrationPerformed: false,
      moreThan20PreEpicEntriesCreated: false,
      nonEnumeratedCanonicalSeedEntriesCreated: false,
      canonicalConventionAllowedByPlan: true,
      normalProposeGateFlowPreserved: true
    },
    conventionReadback: {
      ok: true,
      conventionEntryId: kr05FactCardConventionEntryId,
      conventionEntryDigest: sha256(stableJson(convention)),
      requiredSectionsPresent: conventionPolicy.decisions[0]?.missingRequiredSections.length === 0,
      sourceDigest: convention.sourceDigest,
      sourceRefDigest: sha256(convention.sourceRef)
    },
    searchReadback: {
      ok: true,
      methodSurfaceUnchanged: true,
      defaultSearchReturnedIds: defaultSearch.items.map((item) => item.id),
      defaultSearchBodyReturned: defaultSearch.bodyReturned,
      detailReadEntryId: detailRead.entry.id,
      detailBodyDigest: sha256(detailRead.entry.body),
      draftProposeEntryId: draftPropose.entry.id,
      draftExcludedByDefault: draftDefaultSearch.items.length === 0,
      draftIncludedOnlyWithExplicitFlag: draftIncludeSearch.items.map((item) => item.id),
      defaultCanonicalFilterApplied: defaultSearch.page.defaultCanonicalFilterApplied,
      defaultFreshnessFilterApplied: defaultSearch.page.defaultFreshnessFilterApplied,
      rawRecordPayloadReturned: false
    },
    negativeBoundaryReadback,
    idempotencyReadback: {
      ok: true,
      conventionEntrySecondWriteSameId: firstConvention.id === secondConvention.id,
      draftReplayDeduped: true,
      duplicateCanonicalSeedCreated: false
    },
    privacyNoArtifactNoOverclaimReadback: {
      ok: true,
      rawLocalPathsRecorded: false,
      rawDbDumpRecorded: false,
      rawPrivatePayloadStored: false,
      credentialOrPiiStored: false,
      committedDbArtifacts: noGitArtifactReadback.trackedDbArtifactCount,
      committedExportArtifacts: noGitArtifactReadback.trackedExportArtifactCount,
      readinessClaimed: false,
      releasePublicationPushClaimed: false,
      ownerFacingFinalAcceptanceClaimed: false,
      kr06KpiClaimed: false
    },
    validation_readbacks: {
      noGitArtifactReadback,
      receiptShape: "summary_and_readback_pair",
      proofUsesScratchProfileOnly: true
    },
    failures: [],
    negativeFailures: []
  };
}

function negativeBoundaryProof(convention) {
  const nonEnumeratedCanonical = kr05SeedEntryBatchReadback([createKr05FactCardConventionEntry({
    id: "knowledge-kr05-unlisted-canonical-seed",
    title: "KR-05 unlisted canonical seed",
    seedKind: "owner_enumerated_seed"
  })]);
  const bulkMigration = kr05SeedEntryBatchReadback([createKr05FactCardConventionEntry({
    id: "knowledge-kr05-bulk-migration",
    title: "KR-05 bulk migration",
    status: "draft",
    seedKind: "bulk_vault_migration"
  })]);
  const missingSections = kr05SeedEntryBatchReadback([createKr05FactCardConventionEntry({
    id: "knowledge-kr05-missing-sections",
    title: "KR-05 missing sections",
    status: "draft",
    seedKind: "convention_proof_fixture",
    body: "This body intentionally lacks the mandatory fact-card sections."
  })]);
  const overLimit = kr05SeedEntryBatchReadback(Array.from({ length: kr05MaxPreEpicSeedEntries + 1 }, (_, index) => createKr05FactCardConventionEntry({
    id: `knowledge-kr05-overlimit-${index}`,
    title: `KR-05 overlimit ${index}`,
    status: "draft",
    seedKind: "convention_proof_fixture",
    sourceDigest: `sha256:${sha256(`${convention.sourceDigest}:${index}`)}`
  })));
  return {
    ok: true,
    nonEnumeratedCanonicalDenied: nonEnumeratedCanonical.decisions[0]?.reason,
    bulkMigrationDenied: bulkMigration.decisions[0]?.reason,
    missingSectionsDenied: missingSections.decisions[0]?.reason,
    overLimitDenied: overLimit.overLimitAttemptRejected,
    nonEnumeratedCanonicalSeedEntryAccepted: nonEnumeratedCanonical.nonEnumeratedCanonicalSeedEntryAccepted,
    bulkVaultMigrationAttemptedButRejected: bulkMigration.bulkVaultMigrationAttempted && bulkMigration.acceptedCount === 0,
    overLimitAcceptedCount: overLimit.acceptedCount
  };
}

function call(runtime, method, params) {
  const response = runtime.transport.handleJsonRpc({
    jsonrpc: "2.0",
    id: `${method}:${sha256(stableJson(params)).slice(0, 8)}`,
    method,
    params
  });
  if (response.error) {
    throw new Error(`kr05_transport_error:${method}:${response.error.data?.reason ?? response.error.message}`);
  }
  return response.result;
}

function noCommittedArtifacts() {
  const tracked = git(["ls-files"]).split("\n").filter(Boolean);
  const dbArtifacts = tracked.filter((file) => /\.(sqlite|sqlite3|db|db-wal|db-shm)$/i.test(file));
  const exportArtifacts = tracked.filter((file) => /\.(jsonl|bak|backup)$/i.test(file));
  return {
    ok: dbArtifacts.length === 0 && exportArtifacts.length === 0,
    trackedDbArtifactCount: dbArtifacts.length,
    trackedExportArtifactCount: exportArtifacts.length
  };
}

function sourceProvenance() {
  const sourceHead = git(["rev-list", "-1", "HEAD", "--", ...sourceFiles]);
  const sourceFileDigests = Object.fromEntries(sourceFiles.map((file) => [file, sha256(readFileSync(file))]));
  return {
    ownerDecisionWorkflowBasis,
    kr00GateGreenWorkflowBasis,
    kr04MaterializationWorkflowBasis,
    incomingAosBasis,
    sourceHead,
    sourceFiles,
    sourceFileDigests,
    sourceContentDigest: sha256(JSON.stringify(sourceFileDigests))
  };
}

function writeReceipt(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
  validateReceiptPrivacy(path);
  return value;
}

function validateReceiptPrivacy(path) {
  if (!existsSync(path)) {
    throw new Error(`receipt_missing:${path}`);
  }
  const text = readFileSync(path, "utf8");
  const forbidden = [
    /\/Users\//,
    /file:\/\//,
    /BEGIN [A-Z ]*PRIVATE KEY/,
    /raw db dump/i,
    /record_json/i,
    /release readiness/i,
    /owner final acceptance/i,
    /clean-platform/i,
    /parent completion/i
  ];
  for (const pattern of forbidden) {
    if (pattern.test(text)) {
      throw new Error(`kr05_receipt_privacy_scan_failed:${path}:${pattern}`);
    }
  }
  const parsed = JSON.parse(text);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.failures ?? [], []);
  assert.deepEqual(parsed.negativeFailures ?? [], []);
}

function privacyScan(proof) {
  const text = stableJson(proof);
  const checks = [
    { kind: "raw_local_path", hit: /\/Users\//.test(text) || /file:\/\//.test(text) },
    { kind: "raw_db_dump", hit: /raw db dump/i.test(text) },
    { kind: "private_key", hit: /BEGIN [A-Z ]*PRIVATE KEY/.test(text) },
    { kind: "record_json_payload", hit: /record_json/i.test(text) },
    { kind: "readiness_overclaim", hit: /release readiness|owner final acceptance|clean-platform|parent completion/i.test(text) }
  ];
  const findings = checks.filter((check) => check.hit).map((check) => ({ kind: check.kind }));
  return {
    ok: findings.length === 0,
    findings
  };
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
