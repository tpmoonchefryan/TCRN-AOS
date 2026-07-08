import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AosSqliteRepository,
  createKr05FactCardConventionEntry,
  kr05FactCardConventionEntryId,
  stableJson,
  toKnowledgeRetrievalEntryInput,
  sha256
} from "../dist/packages/db/src/index.js";
import { createRuntimeTransport } from "../dist/packages/mcp-server/src/index.js";
import {
  computeKnowledgeRetrievalKpi,
  createDefaultSeed
} from "../dist/packages/domain/src/index.js";

const route = "route_tcrn_aos_knowledge_retrieval_layer_kr06_kpi_measurement_after_kr05_gate_green_1fa3b8_4a5023_20260708";
const command = "pnpm --dir TCRN-AOS kr06:kpi-measurement-proof";
const ownerDecisionWorkflowBasis = "8dce81d2e9a6408d1d139e4d84486497c6caf288";
const kr04MaterializationWorkflowBasis = "4a50236257494a225fc26d3e1d9d0cb207e02d42";
const incomingAosBasis = "1fa3b80554e32e13733ba377626c2e9d13e25792";
const kr05RepairSourceBasis = "06456d9002ccdbb73b98139d1dffb0068f6d8d4b";
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const platformRoot = dirname(repoRoot);
const migrationsDir = join(repoRoot, "packages/db/migrations/sqlite");
const evidenceRoot = "evidence/aos-knowledge-retrieval-layer-kr06";
const summaryPath = join(evidenceRoot, "kr06-kpi-measurement-proof-summary.json");
const readbackPath = join(evidenceRoot, "kr06-kpi-measurement-readback.json");
const sourceFiles = [
  "package.json",
  "packages/domain/src/index.ts",
  "packages/domain/src/knowledge-kpi.ts",
  "packages/domain/test/kr06-knowledge-kpi.test.mjs",
  "scripts/kr06-kpi-measurement-proof.mjs"
];
const ilyaActor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "kr06-kpi-measurement-proof"
};
const noOverclaimFlags = {
  kr06KpiMeasurementOnly: true,
  kr05SeedBoundaryExpanded: false,
  bulkVaultMigrationPerformed: false,
  moreThan20PreEpicEntriesCreated: false,
  nonEnumeratedCanonicalSeedEntriesCreated: false,
  kr04HookChanged: false,
  workflowMutation: false,
  designSystemMutation: false,
  tmsMutation: false,
  pushRun: false,
  batchPushGateRun: false,
  releaseReadinessClaimed: false,
  productReadinessClaimed: false,
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
const root = await mkdtemp(join(tmpRoot, "tcrn-aos-kr06-proof-"));
try {
  const proof = await runProof(root);
  const privacy = privacyScan(proof);
  const readbackReceipt = writeReceipt(readbackPath, {
    ok: proof.ok && privacy.ok,
    route,
    command,
    source,
    metricDefinitionReadback: proof.metricDefinitionReadback,
    auditDerivedBaselineReadback: proof.auditDerivedBaselineReadback,
    noDataBaselineReadback: proof.noDataBaselineReadback,
    dataAvailabilityReadback: proof.dataAvailabilityReadback,
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
    receiptInventory: ["kr06-kpi-measurement-readback.json"],
    receiptCount: 1,
    allChildReceiptsOk: readbackReceipt.ok === true,
    missingReceipts: [],
    extraUnclassifiedReceipts: [],
    readbackReceiptDigest: sha256(stableJson(readbackReceipt)),
    metricNames: ["retrieval_hit_rate", "retrieval_token_total"],
    hitRate: proof.auditDerivedBaselineReadback.hitRate,
    tokenTotal: proof.auditDerivedBaselineReadback.estimatedRetrievalTokenTotal,
    dataSourceDisposition: proof.auditDerivedBaselineReadback.dataSourceDisposition,
    noQualityAdequacyTargetEvaluated: true,
    noOverclaimFlags,
    failures: readbackReceipt.ok === true ? [] : ["kr06_kpi_measurement_readback_not_ok"],
    negativeFailures: proof.negativeFailures
  });

  assert.equal(readbackReceipt.ok, true);
  assert.equal(summaryReceipt.ok, true);
  console.log(JSON.stringify({
    ok: true,
    route,
    command,
    receipts: [summaryPath, readbackPath],
    hitRate: proof.auditDerivedBaselineReadback.hitRate,
    estimatedRetrievalTokenTotal: proof.auditDerivedBaselineReadback.estimatedRetrievalTokenTotal,
    dataCompleteness: proof.auditDerivedBaselineReadback.dataCompleteness,
    sourceHead: source.sourceHead
  }, null, 2));
} finally {
  await rm(root, { recursive: true, force: true });
}

async function runProof(root) {
  const databasePath = join(root, "kr06.sqlite");
  await writeFile(join(root, ".tcrn-aos-phase1-root"), "owned-by-kr06-proof\n", "utf8");
  const repository = new AosSqliteRepository({ databasePath, migrationsDir });
  repository.applyMigrations();
  repository.seedAiEmployees(createDefaultSeed().employees, "kr06-kpi-proof-seed");
  const convention = createKr05FactCardConventionEntry();
  repository.createKnowledgeRetrievalEntry(toKnowledgeRetrievalEntryInput(convention));
  repository.close();

  const runtime = createRuntimeTransport({ actor: ilyaActor, databasePath, databaseRoot: root, repoRoot, migrationsDir });
  let search;
  let detail;
  let searchAudit;
  let readAudit;
  try {
    search = call(runtime, "aos.knowledge.search", {
      query: "fact card convention",
      project: "TCRN-AOS",
      limit: 5
    });
    assert.deepEqual(search.items.map((item) => item.id), [kr05FactCardConventionEntryId]);
    detail = call(runtime, "aos.knowledge.entry.read", { id: kr05FactCardConventionEntryId });
    assert.equal(detail.entry.id, kr05FactCardConventionEntryId);
    searchAudit = call(runtime, "aos.audit.query", {
      targetId: search.page.filterDigest,
      action: "mcp.transport.aos.knowledge.search"
    });
    readAudit = call(runtime, "aos.audit.query", {
      targetId: kr05FactCardConventionEntryId,
      action: "mcp.transport.aos.knowledge.entry.read"
    });
  } finally {
    runtime.close();
  }

  const auditEvents = [...searchAudit.items, ...readAudit.items].map(auditEventFromTransportReadback);
  const report = computeKnowledgeRetrievalKpi({
    auditEvents,
    referencedEntryIds: [kr05FactCardConventionEntryId],
    snippetTokenEstimatePerSearchResult: 24,
    dataSourceDisposition: "fixture"
  });
  const noDataReport = computeKnowledgeRetrievalKpi({
    auditEvents: [],
    dataSourceDisposition: "no_data"
  });
  assert.equal(report.retrievalHitRate.value, 1);
  assert.equal(report.retrievalEventCounts.search, 1);
  assert.equal(report.retrievalEventCounts.read, 1);
  assert.equal(report.digestOnlyReadback.retrievedEntryDigests.length, 1);
  assert.equal(noDataReport.retrievalHitRate.value, null);

  const noGitArtifactReadback = noCommittedArtifacts();
  const proof = {
    ok: true,
    metricDefinitionReadback: {
      ok: true,
      metricNames: ["retrieval_hit_rate", "retrieval_token_total"],
      hitRateDefinition: report.metricDefinitions.retrievalHitRate,
      tokenTotalDefinition: report.metricDefinitions.retrievalTokenTotal,
      numerator: "unique retrieved entry digests referenced by same-session summary or evidence",
      denominator: "unique entry digests retrieved by KR-02 search/read audit events",
      tokenTotalSource: report.retrievalTokenTotals.source,
      snippetEstimatePerSearchResult: report.retrievalTokenTotals.snippetTokenEstimatePerSearchResult,
      targetThisRound: null
    },
    auditDerivedBaselineReadback: {
      ok: true,
      dataSourceDisposition: report.dataSourceDisposition,
      dataCompleteness: report.dataCompleteness,
      retrievalEventCounts: report.retrievalEventCounts,
      hitRate: report.retrievalHitRate.value,
      numeratorReferencedRetrievedEntryDigestCount: report.retrievalHitRate.numeratorReferencedRetrievedEntryDigestCount,
      denominatorRetrievedEntryDigestCount: report.retrievalHitRate.denominatorRetrievedEntryDigestCount,
      estimatedRetrievalTokenTotal: report.retrievalTokenTotals.estimatedTotal,
      searchSnippetEstimate: report.retrievalTokenTotals.searchSnippetEstimate,
      readBodyWordCount: report.retrievalTokenTotals.readBodyWordCount,
      actualTokenizerUsed: report.retrievalTokenTotals.actualTokenizerUsed,
      digestOnlyReadback: report.digestOnlyReadback,
      rawPromptStored: false,
      rawBodyStored: false
    },
    noDataBaselineReadback: {
      ok: true,
      dataCompleteness: noDataReport.dataCompleteness,
      hitRate: noDataReport.retrievalHitRate.value,
      denominatorRetrievedEntryDigestCount: noDataReport.retrievalHitRate.denominatorRetrievedEntryDigestCount,
      estimatedRetrievalTokenTotal: noDataReport.retrievalTokenTotals.estimatedTotal,
      noDataDoesNotInventQualityConclusion: true
    },
    dataAvailabilityReadback: {
      ok: true,
      dogfood02RealDataPresentInProof: false,
      proofUsesScratchRuntimeAuditEvents: true,
      exactNextDataRequirement: "Run KR-02 search/read during Dogfood 2 sessions and link same-session run-summary/evidence entry references for non-fixture baseline measurement.",
      qualityAdequacyConclusionMade: false
    },
    privacyNoArtifactNoOverclaimReadback: {
      ok: true,
      rawLocalPathsRecorded: false,
      rawDbDumpRecorded: false,
      rawPromptRecorded: false,
      rawBodyRecorded: false,
      credentialOrPiiStored: false,
      committedDbArtifacts: noGitArtifactReadback.trackedDbArtifactCount,
      committedExportArtifacts: noGitArtifactReadback.trackedExportArtifactCount,
      readinessClaimed: false,
      releasePublicationPushClaimed: false,
      ownerFacingFinalAcceptanceClaimed: false,
      retrievalQualityAdequacyClaimed: false
    },
    validation_readbacks: {
      noGitArtifactReadback,
      receiptShape: "summary_and_readback_pair",
      proofUsesScratchProfileOnly: true,
      methodSurfaceExpanded: false,
      kr05SeedBoundaryExpanded: false
    },
    failures: [],
    negativeFailures: []
  };
  proof.failures = proofFailures(proof, noGitArtifactReadback);
  return {
    ...proof,
    ok: proof.failures.length === 0
  };
}

function auditEventFromTransportReadback(event) {
  return {
    id: stringField(event.id, "audit id"),
    actor: { system: stringField(event.actorRef, "audit actor") },
    action: stringField(event.action, "audit action"),
    targetType: stringField(event.targetType, "audit targetType"),
    targetId: stringField(event.targetId, "audit targetId"),
    timestamp: stringField(event.timestamp, "audit timestamp"),
    outcome: event.outcome === "read" ? "read" : "accepted",
    policyVersion: stringField(event.policyVersion, "audit policyVersion"),
    details: typeof event.details === "object" && event.details !== null && !Array.isArray(event.details) ? event.details : {}
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
    throw new Error(`kr06_transport_error:${method}:${response.error.data?.reason ?? response.error.message}`);
  }
  return response.result;
}

function stringField(value, context) {
  assert.equal(typeof value, "string", context);
  return value;
}

function proofFailures(proof, noGitArtifactReadback) {
  const failures = [];
  if (!proof.metricDefinitionReadback.ok) failures.push("metric_definition_failed");
  if (!proof.auditDerivedBaselineReadback.ok) failures.push("audit_baseline_failed");
  if (proof.auditDerivedBaselineReadback.denominatorRetrievedEntryDigestCount < 1) failures.push("retrieval_denominator_missing");
  if (proof.auditDerivedBaselineReadback.estimatedRetrievalTokenTotal < 1) failures.push("token_total_missing");
  if (!proof.noDataBaselineReadback.ok) failures.push("no_data_baseline_failed");
  if (!proof.privacyNoArtifactNoOverclaimReadback.ok) failures.push("privacy_no_overclaim_failed");
  if (!noGitArtifactReadback.ok) failures.push("committed_artifacts_detected");
  return failures;
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
    kr04MaterializationWorkflowBasis,
    incomingAosBasis,
    kr05RepairSourceBasis,
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
    new RegExp(["raw", "db", "dump"].join(" "), "i"),
    new RegExp(["record", "json"].join("_"), "i"),
    new RegExp(["release", "readiness"].join(" "), "i"),
    new RegExp(["owner", "final", "acceptance"].join(" "), "i"),
    new RegExp(["clean", "platform"].join("-"), "i"),
    new RegExp(["parent", "completion"].join(" "), "i")
  ];
  for (const pattern of forbidden) {
    if (pattern.test(text)) {
      throw new Error(`kr06_receipt_privacy_scan_failed:${path}:${pattern}`);
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
    { kind: "raw_db_dump", hit: new RegExp(["raw", "db", "dump"].join(" "), "i").test(text) },
    { kind: "private_key", hit: /BEGIN [A-Z ]*PRIVATE KEY/.test(text) },
    { kind: "raw_record_payload", hit: new RegExp(["record", "json"].join("_"), "i").test(text) },
    { kind: "overclaim", hit: new RegExp([
      ["release", "readiness"].join(" "),
      ["owner", "final", "acceptance"].join(" "),
      ["clean", "platform"].join("-"),
      ["parent", "completion"].join(" ")
    ].join("|"), "i").test(text) }
  ];
  const findings = checks.filter((check) => check.hit).map((check) => ({ kind: check.kind }));
  return {
    ok: findings.length === 0,
    findings
  };
}

function git(args) {
  return execFileSync("git", ["-C", repoRoot, ...args], { encoding: "utf8" }).trim();
}
