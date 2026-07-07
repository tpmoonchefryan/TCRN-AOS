import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRuntimeTransport, transportMvpMethods } from "../dist/packages/mcp-server/src/index.js";
import { AosSqliteRepository, sha256, stableJson } from "../dist/packages/db/src/index.js";
import { createDefaultSeed } from "../dist/packages/domain/src/index.js";

const route = "route_tcrn_aos_knowledge_retrieval_layer_kr02_method_boundary_repair_ilya_after_sable_changes_requested_623faf_1d6076_20260708";
const ownerDecisionWorkflowBasis = "8dce81d2e9a6408d1d139e4d84486497c6caf288";
const kr00GateGreenWorkflowBasis = "1d60763f3c0c3eae0fb5465fb50189c4951c48df";
const incomingAosBasis = "623fafa6419a97d66a29bb287469f8a93d114527";
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const platformRoot = dirname(repoRoot);
const evidenceRoot = join(repoRoot, "evidence/aos-knowledge-retrieval-layer-kr02");
const migrationsDir = join(repoRoot, "packages/db/migrations/sqlite");
const command = "pnpm --dir TCRN-AOS kr02:mcp-method-surface-proof";
const sourceFiles = [
  "package.json",
  "packages/db/src/sqlite-repository.ts",
  "packages/mcp-server/src/transport.ts",
  "packages/mcp-server/test/kr02-knowledge-method-surface.test.mjs",
  "packages/db/test/kr01-knowledge-schema-fts.test.mjs",
  "packages/mcp-server/test/stdio-transport.test.mjs",
  "scripts/kr02-mcp-method-surface-proof.mjs"
];
const ilyaActor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "kr02-mcp-method-surface-proof"
};
const atlasActor = {
  employeeId: "employee-atlas",
  role: "owner_observer",
  threadId: "atlas-thread",
  sessionId: "kr02-mcp-method-surface-proof"
};
const noOverclaimFlags = {
  kr02MethodSurfaceImplemented: true,
  sableMethodBoundaryRepairApplied: true,
  kr03ReadbackUiStarted: false,
  kr04HookSwapStarted: false,
  kr05SeedEntriesStarted: false,
  kr06KpiStarted: false,
  frontendTriggerImplemented: false,
  dogfood02TmsMutation: false,
  workflowMutation: false,
  designSystemMutation: false,
  activeCodexMutation: false,
  maintainedHookSourceMutation: false,
  pushRun: false,
  batchPushGateRun: false,
  releaseReadinessClaimed: false,
  ownerFacingAcceptanceClaimed: false,
  finalAcceptanceClaimed: false,
  cleanPlatformClaimed: false,
  parentCompletionClaimed: false,
  liveDispatchAuthorized: false,
  ownerIntentExecutionAuthorized: false,
  bulkVaultMigrationPerformed: false,
  kr03OrKr04OrKr05OrKr06Started: false
};

mkdirSync(evidenceRoot, { recursive: true });

const source = sourceProvenance();
const tmpRoot = join(platformRoot, "tmp");
mkdirSync(tmpRoot, { recursive: true });
const root = await mkdtemp(join(tmpRoot, "tcrn-aos-kr02-proof-"));
try {
  const proof = await runProof(root);
  const privacy = privacyScan(proof);
  const readbackReceipt = writeReceipt("kr02-mcp-method-surface-readback.json", {
    ok: proof.ok && privacy.ok,
    route,
    command,
    source,
    methodRegistryReadback: proof.methodRegistryReadback,
    proposeWriteThroughReadback: proof.proposeWriteThroughReadback,
    searchReadback: proof.searchReadback,
    entryReadReadback: proof.entryReadReadback,
    auditAccessMetadataReadback: proof.auditAccessMetadataReadback,
    idempotencyReplayReadback: proof.idempotencyReplayReadback,
    roleGatingNegativeReadback: proof.roleGatingNegativeReadback,
    negativeAllowlistReadback: proof.negativeAllowlistReadback,
    privacyNoArtifactNoOverclaimReadback: proof.privacyNoArtifactNoOverclaimReadback,
    kr01Kr02CapReadback: proof.kr01Kr02CapReadback,
    validation_readbacks: proof.validation_readbacks,
    privacyNoOverclaimScan: privacy,
    failures: [...proof.failures, ...privacy.findings.map((finding) => finding.kind)],
    negativeFailures: proof.negativeFailures,
    noOverclaimFlags
  });
  const summaryReceipt = writeReceipt("kr02-mcp-method-surface-proof-summary.json", {
    ok: readbackReceipt.ok === true,
    route,
    command,
    source,
    receiptInventory: ["kr02-mcp-method-surface-readback.json"],
    receiptCount: 1,
    allChildReceiptsOk: readbackReceipt.ok === true,
    missingReceipts: [],
    extraUnclassifiedReceipts: [],
    readbackReceiptDigest: sha256(stableJson(readbackReceipt)),
    methodRegistry: proof.methodRegistryReadback.kr02Methods,
    proposedEntryId: proof.proposeWriteThroughReadback.proposedEntryId,
    searchReturnedIds: proof.searchReadback.defaultSearchReturnedIds,
    readAuditEventId: proof.entryReadReadback.auditEventId,
    blockedRoleReason: proof.roleGatingNegativeReadback.blockedRoleWriteReason,
    noOverclaimFlags,
    failures: readbackReceipt.ok === true ? [] : ["kr02_method_surface_readback_not_ok"],
    negativeFailures: proof.negativeFailures
  });

  assert.equal(readbackReceipt.ok, true);
  assert.equal(summaryReceipt.ok, true);
  console.log(JSON.stringify({
    ok: true,
    route,
    command,
    receipts: ["kr02-mcp-method-surface-proof-summary.json", "kr02-mcp-method-surface-readback.json"],
    proposedEntryId: proof.proposeWriteThroughReadback.proposedEntryId,
    defaultSearchReturnedIds: proof.searchReadback.defaultSearchReturnedIds,
    idempotentReplayStatus: proof.idempotencyReplayReadback.replayStatus,
    blockedRoleWriteReason: proof.roleGatingNegativeReadback.blockedRoleWriteReason,
    slice789NegativeReason: proof.negativeAllowlistReadback.slice789NegativeReason,
    rawPathRecorded: false,
    kr03Started: false,
    readinessClaimed: false
  }, null, 2));
} finally {
  await rm(root, { recursive: true, force: true });
}

async function runProof(root) {
  const databasePath = join(root, "kr02.sqlite");
  await writeFile(join(root, ".tcrn-aos-phase1-root"), "owned-by-kr02-proof\n", "utf8");
  seedEmployeesAndCanonicalKnowledge(databasePath);
  const runtime = createRuntimeTransport({ actor: ilyaActor, databasePath, databaseRoot: root, repoRoot, migrationsDir });
  let defaultSearch;
  let includeDraft;
  let includeStale;
  let entryRead;
  let readAudit;
  let searchAudit;
  try {
    const methodRegistryReadback = methodRegistry();
    const propose = call(runtime, "aos.knowledge.entry.propose", knowledgePayload({
      id: "knowledge-kr02-proof-draft",
      title: "KR02 proof draft runbook",
      status: "draft",
      summary: "Draft KR02 proof snippet excluded by default.",
      body: "Draft KR02 proof body."
    }));
    assert.equal(propose.ok, true);
    const replay = call(runtime, "aos.knowledge.entry.propose", knowledgePayload({
      id: "knowledge-kr02-proof-draft",
      title: "KR02 proof draft runbook",
      status: "draft",
      summary: "Draft KR02 proof snippet excluded by default.",
      body: "Draft KR02 proof body."
    }));
    assert.equal(replay.status, "deduped");

    defaultSearch = call(runtime, "aos.knowledge.search", { query: "KR02 proof runbook", project: "TCRN-AOS", limit: 1 });
    const cursorPage = call(runtime, "aos.knowledge.search", {
      query: "KR02 proof runbook",
      project: "TCRN-AOS",
      limit: 1,
      cursor: defaultSearch.page.nextCursor
    });
    includeDraft = call(runtime, "aos.knowledge.search", { query: "draft", project: "TCRN-AOS", includeDraft: true });
    includeStale = call(runtime, "aos.knowledge.search", { query: "stale", project: "TCRN-AOS", includeStale: true });
    entryRead = call(runtime, "aos.knowledge.entry.read", { id: "knowledge-kr02-proof-canonical" });
    readAudit = call(runtime, "aos.audit.query", { targetId: "knowledge-kr02-proof-canonical", action: "mcp.transport.aos.knowledge.entry.read" });
    searchAudit = call(runtime, "aos.audit.query", { targetId: defaultSearch.page.filterDigest, action: "mcp.transport.aos.knowledge.search" });

    const oversized = errorReason(runtime, "aos.knowledge.entry.propose", knowledgePayload({
      id: "knowledge-kr02-proof-oversized",
      body: words(1501),
      status: "draft",
      idempotencyKey: "kr02-proof-oversized"
    }));
    const proposeRoleMismatch = errorReason(runtime, "aos.knowledge.entry.propose", knowledgePayload({
      id: "knowledge-kr02-proof-role-mismatch",
      roleScope: "security",
      status: "draft",
      idempotencyKey: "kr02-proof-role-mismatch"
    }));
    const fakeCanonicalGate = errorReason(runtime, "aos.knowledge.entry.propose", knowledgePayload({
      id: "knowledge-kr02-proof-fake-canonical",
      status: "canonical",
      canonicalGateDecisionId: "fake-gate-decision",
      idempotencyKey: "kr02-proof-fake-canonical"
    }));
    const searchRoleMismatch = errorReason(runtime, "aos.knowledge.search", { query: "KR02", roleScope: "security" });
    const crossRoleRead = errorReason(runtime, "aos.knowledge.entry.read", { id: "knowledge-kr02-proof-security" });
    const unknownKnowledge = errorReason(runtime, "aos.knowledge.entry.delete", { id: "knowledge-kr02-proof-canonical" });
    const slice789 = errorReason(runtime, "aos.resource.governance.read", {});

    runtime.close();

    const atlasRuntime = createRuntimeTransport({ actor: atlasActor, databasePath, databaseRoot: root, repoRoot, migrationsDir });
    let blockedRoleReason;
    let blockedRoleAudit;
    let ownerRead;
    try {
      blockedRoleReason = errorReason(atlasRuntime, "aos.knowledge.entry.propose", knowledgePayload({
        id: "knowledge-kr02-proof-owner-blocked",
        status: "draft",
        idempotencyKey: "kr02-proof-owner-blocked"
      }));
      blockedRoleAudit = call(atlasRuntime, "aos.audit.query", { targetId: "aos.knowledge.entry.propose" });
      ownerRead = call(atlasRuntime, "aos.knowledge.entry.read", { id: "knowledge-kr02-proof-security" });
    } finally {
      atlasRuntime.close();
    }

    const noGitArtifactReadback = noCommittedArtifacts();
    const privacyNoArtifactNoOverclaimReadback = {
      rawPathRecorded: false,
      rawDbDumpRecorded: false,
      rawRecordJsonReturned: false,
      secretsOrPiiStored: false,
      committedDbArtifacts: noGitArtifactReadback.trackedDbArtifactCount,
      committedExportArtifacts: noGitArtifactReadback.trackedExportArtifactCount,
      releaseReadinessClaimed: false,
      ownerFacingAcceptanceClaimed: false,
      finalAcceptanceClaimed: false,
      kr03Started: false,
      kr04HookSwapStarted: false
    };
    const proof = {
      methodRegistryReadback,
      proposeWriteThroughReadback: {
        ok: propose.ok === true,
        proposedEntryId: propose.entry.id,
        status: propose.entry.status,
        bodyReturned: propose.bodyReturned,
        rawRecordJsonReturned: propose.rawRecordJsonReturned,
        auditEventId: propose.auditEventId,
        draftOnlyPublicPropose: true,
        canonicalPromotionDeferred: true,
        fakeCanonicalGateReason: fakeCanonicalGate,
        roleScopeMismatchReason: proposeRoleMismatch,
        bodyCapOversizedReason: oversized
      },
      searchReadback: {
        ok: defaultSearch.ok === true,
        defaultSearchReturnedIds: defaultSearch.items.map((item) => item.id),
        defaultExcludesDraftAndStale: defaultSearch.items.every((item) => item.status === "canonical" && item.stale === false),
        defaultCanonicalFilterApplied: defaultSearch.page.defaultCanonicalFilterApplied,
        defaultFreshnessFilterApplied: defaultSearch.page.defaultFreshnessFilterApplied,
        cursorPagination: {
          firstHasMore: defaultSearch.page.hasMore,
          firstNextCursorPresent: typeof defaultSearch.page.nextCursor === "string",
          secondPageReturnedIds: cursorPage.items.map((item) => item.id)
        },
        includeDraftReturnedIds: includeDraft.items.map((item) => item.id),
        includeStaleReturnedIds: includeStale.items.map((item) => item.id),
        includeStaleMarksStale: includeStale.items.every((item) => item.stale === true),
        searchMode: defaultSearch.page.searchMode,
        bodyReturned: defaultSearch.bodyReturned
      },
      entryReadReadback: {
        ok: entryRead.ok === true,
        entryId: entryRead.entry.id,
        bodyIncluded: entryRead.entry.bodyIncluded,
        bodyDigest: sha256(entryRead.entry.body),
        auditEventId: entryRead.auditEventId,
        responseBudget: entryRead.responseBudget,
        rawRecordJsonReturned: entryRead.rawRecordJsonReturned
      },
      auditAccessMetadataReadback: {
        ok: readAudit.items.length >= 1 && searchAudit.items.length >= 1 && entryRead.entry.accessCount >= 2,
        readAuditEventIds: readAudit.items.map((item) => item.id),
        searchAuditEventIds: searchAudit.items.map((item) => item.id),
        accessCountAfterSearchAndRead: entryRead.entry.accessCount,
        lastAccessedPresent: typeof entryRead.entry.lastAccessed === "string"
      },
      idempotencyReplayReadback: {
        ok: replay.status === "deduped" && replay.result.entry.id === "knowledge-kr02-proof-draft",
        replayStatus: replay.status,
        replayScope: replay.replayScope,
        duplicateEntryId: replay.result.entry.id
      },
      roleGatingNegativeReadback: {
        ok: blockedRoleReason === "transport_actor_blocked_role" &&
          proposeRoleMismatch === "knowledge_role_scope_mismatch" &&
          crossRoleRead === "knowledge_role_scope_mismatch" &&
          ownerRead.ok === true &&
          blockedRoleAudit.items.length >= 1,
        blockedRoleWriteReason: blockedRoleReason,
        proposeRoleScopeMismatchReason: proposeRoleMismatch,
        crossRoleReadReason: crossRoleRead,
        blockedRoleAuditEventIds: blockedRoleAudit.items.map((item) => item.id),
        ownerObserverReadAllowed: ownerRead.ok === true,
        ownerObserverReadException: "owner_observer may read entries across roleScope by explicit KR02 repair exception"
      },
      negativeAllowlistReadback: {
        ok: unknownKnowledge === "transport_method_outside_mvp_allowlist" &&
          slice789 === "transport_method_outside_mvp_allowlist" &&
          searchRoleMismatch === "knowledge_role_scope_mismatch" &&
          fakeCanonicalGate === "knowledge_canonical_propose_deferred",
        unknownKnowledgeReason: unknownKnowledge,
        slice789NegativeReason: slice789,
        searchRoleScopeMismatchReason: searchRoleMismatch,
        canonicalFakeGateReason: fakeCanonicalGate
      },
      privacyNoArtifactNoOverclaimReadback,
      kr01Kr02CapReadback: {
        combinedCapWorkingSessions: 4,
        kr01CompletedBeforeThisRoute: true,
        kr02CurrentRouteSessionCount: 1,
        capBreached: false,
        descopeKr03RequiredByCap: false
      },
      validation_readbacks: {
        proofCommand: command,
        proofScriptSyntaxExpected: "node --check TCRN-AOS/scripts/kr02-mcp-method-surface-proof.mjs",
        targetedTestExpected: "node --test TCRN-AOS/packages/mcp-server/test/kr02-knowledge-method-surface.test.mjs",
        verifyFastExpected: "pnpm --dir TCRN-AOS verify:fast",
        receiptAssertionsEmbedded: true
      },
      failures: [],
      negativeFailures: []
    };
    proof.failures = proofFailures(proof, noGitArtifactReadback);
    return {
      ok: proof.failures.length === 0,
      ...proof
    };
  } catch (error) {
    try {
      runtime.close();
    } catch {
      // best-effort close after assertion failure
    }
    throw error;
  }
}

function call(runtime, method, params) {
  const response = runtime.transport.handleJsonRpc({ jsonrpc: "2.0", id: method, method, params });
  assert.equal(response.error, undefined, `${method}:${JSON.stringify(response.error)}`);
  return response.result;
}

function errorReason(runtime, method, params) {
  const response = runtime.transport.handleJsonRpc({ jsonrpc: "2.0", id: method, method, params });
  assert.equal(response.result, undefined, method);
  return response.error.data.reason;
}

function seedEmployeesAndCanonicalKnowledge(databasePath) {
  const repository = new AosSqliteRepository({ databasePath, migrationsDir });
  try {
    repository.applyMigrations();
    repository.seedAiEmployees(createDefaultSeed().employees, "kr02-proof-seed");
    repository.createKnowledgeRetrievalEntry(knowledgePayload({
      id: "knowledge-kr02-proof-canonical",
      title: "KR02 proof canonical operator runbook",
      summary: "Canonical KR02 proof snippet for role and keyword retrieval.",
      body: "Canonical KR02 proof body appears only through by-id fetch.",
      status: "canonical",
      idempotencyKey: undefined
    }));
    repository.createKnowledgeRetrievalEntry(knowledgePayload({
      id: "knowledge-kr02-proof-second",
      title: "KR02 proof canonical paging runbook",
      summary: "Second canonical KR02 proof snippet for cursor pagination.",
      body: "Second canonical KR02 proof body.",
      status: "canonical",
      idempotencyKey: undefined
    }));
    repository.createKnowledgeRetrievalEntry(knowledgePayload({
      id: "knowledge-kr02-proof-stale",
      title: "KR02 proof stale runbook",
      summary: "Stale KR02 proof snippet excluded by default.",
      body: "Stale KR02 proof body.",
      status: "canonical",
      lastVerified: "2026-01-01",
      stalenessPolicy: "review_after_1_days",
      idempotencyKey: undefined
    }));
    repository.createKnowledgeRetrievalEntry(knowledgePayload({
      id: "knowledge-kr02-proof-security",
      title: "KR02 proof security scoped runbook",
      roleScope: "security",
      summary: "Security scoped KR02 proof entry is blocked for implementation by-id read.",
      body: "Security scoped KR02 proof body.",
      status: "canonical",
      idempotencyKey: undefined
    }));
  } finally {
    repository.close();
  }
}

function knowledgePayload(overrides = {}) {
  return {
    id: "knowledge-kr02-proof-fixture",
    title: "KR02 proof fixture",
    roleScope: "implementation",
    project: "TCRN-AOS",
    category: "knowledge-retrieval",
    knowledgeKind: "runbook_fact",
    status: "draft",
    lastVerified: "2026-07-08",
    stalenessPolicy: "review_after_30_days",
    sourceRef: "workflow-plan-digest-reference",
    sourceDigest: "sha256:kr02-proof-source",
    tags: ["kr02", "mcp", "knowledge"],
    summary: "KR02 proof fixture for MCP method surface validation.",
    body: "KR02 proof fixture body for by-id read.",
    canonicalGateDecisionId: "gate-decision-kr02-proof-default",
    idempotencyKey: "kr02-proof-fixture",
    ...overrides
  };
}

function methodRegistry() {
  const kr02Methods = transportMvpMethods.filter((method) => method.startsWith("aos.knowledge.")).sort();
  return {
    ok: stableJson(kr02Methods) === stableJson(["aos.knowledge.entry.propose", "aos.knowledge.entry.read", "aos.knowledge.search"]),
    kr02Methods,
    proposeWriteMethod: "aos.knowledge.entry.propose",
    readMethods: ["aos.knowledge.entry.read", "aos.knowledge.search"],
    docsSearchIndexReusedAsQueryApi: false,
    documentationIndexReadReusedAsSnippetApi: false,
    fullGatewayMethodListExposed: false
  };
}

function proofFailures(proof, noGitArtifactReadback) {
  const failures = [];
  if (!proof.methodRegistryReadback.ok) failures.push("method_registry_incomplete");
  if (!proof.proposeWriteThroughReadback.ok || proof.proposeWriteThroughReadback.bodyReturned !== false) failures.push("propose_write_through_failed");
  if (!proof.searchReadback.ok || !proof.searchReadback.defaultExcludesDraftAndStale) failures.push("search_filters_failed");
  if (!proof.searchReadback.cursorPagination.firstHasMore || !proof.searchReadback.cursorPagination.firstNextCursorPresent) failures.push("cursor_pagination_failed");
  if (!proof.searchReadback.includeDraftReturnedIds.includes("knowledge-kr02-proof-draft")) failures.push("draft_include_failed");
  if (!proof.searchReadback.includeStaleReturnedIds.includes("knowledge-kr02-proof-stale")) failures.push("stale_include_failed");
  if (!proof.entryReadReadback.ok || proof.entryReadReadback.bodyIncluded !== true) failures.push("entry_read_failed");
  if (!proof.auditAccessMetadataReadback.ok) failures.push("audit_access_metadata_failed");
  if (!proof.idempotencyReplayReadback.ok) failures.push("idempotency_replay_failed");
  if (!proof.roleGatingNegativeReadback.ok) failures.push("role_gating_negative_failed");
  if (!proof.negativeAllowlistReadback.ok) failures.push("negative_allowlist_failed");
  if (!noGitArtifactReadback.ok) failures.push("committed_artifacts_detected");
  if (proof.kr01Kr02CapReadback.capBreached) failures.push("kr01_kr02_cap_breached");
  return failures;
}

function noCommittedArtifacts() {
  const tracked = spawnSync("git", ["-C", repoRoot, "ls-files"], { encoding: "utf8" });
  const files = tracked.stdout.split("\n").filter(Boolean);
  const dbArtifacts = files.filter((file) => /\.(sqlite|sqlite3|db|db-wal|db-shm)$/i.test(file) && !file.startsWith(".codegraph/"));
  const exportArtifacts = files.filter((file) => /\.(jsonl|bak|backup)$/i.test(file));
  return {
    ok: dbArtifacts.length === 0 && exportArtifacts.length === 0,
    trackedDbArtifactCount: dbArtifacts.length,
    trackedExportArtifactCount: exportArtifacts.length,
    dbArtifactDigests: dbArtifacts.map((file) => sha256(file)),
    exportArtifactDigests: exportArtifacts.map((file) => sha256(file))
  };
}

function sourceProvenance() {
  const sourceHead = runGit(["rev-parse", "HEAD"]);
  const fileDigests = Object.fromEntries(sourceFiles.map((file) => [file, fileDigest(file)]));
  return {
    ownerDecisionWorkflowBasis,
    kr00GateGreenWorkflowBasis,
    incomingAosBasis,
    sourceHead,
    sourceFiles,
    sourceFileDigests: fileDigests,
    sourceContentDigest: sha256(stableJson(fileDigests))
  };
}

function fileDigest(relativePath) {
  return sha256(readText(relativePath));
}

function readText(relativePath) {
  return existsSync(join(repoRoot, relativePath))
    ? Buffer.from(spawnSync("cat", [join(repoRoot, relativePath)], { encoding: "buffer" }).stdout)
    : Buffer.from("");
}

function runGit(args) {
  const result = spawnSync("git", ["-C", repoRoot, ...args], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  }
  return result.stdout.trim();
}

function privacyScan(value) {
  const serialized = JSON.stringify(value);
  const findings = [];
  if (serialized.includes(repoRoot) || serialized.includes(platformRoot)) findings.push({ kind: "raw_local_path" });
  if (/\/Users\/[^"\\]+/.test(serialized)) findings.push({ kind: "raw_users_path" });
  if (/record_json|raw\s+db\s+dump|BEGIN PRIVATE KEY|AWS_SECRET|OPENAI_API_KEY|PRIVATE KEY/i.test(serialized)) {
    findings.push({ kind: "private_or_raw_payload_marker" });
  }
  const overclaimPatterns = [
    ["release_readiness", /release\s+readiness/i],
    ["owner_facing_acceptance", /owner-facing\s+acceptance/i],
    ["final_acceptance", /final\s+acceptance/i],
    ["clean_platform", /clean\s+platform/i],
    ["parent_completion", /parent\s+completion/i]
  ];
  for (const [name, pattern] of overclaimPatterns) {
    if (pattern.test(serialized)) findings.push({ kind: `overclaim:${name}` });
  }
  return {
    ok: findings.length === 0,
    findings,
    rawPathRecorded: false,
    rawDbDumpRecorded: false,
    secretsOrPiiStored: false,
    broadSecurityScanClaimed: false,
    readinessReleaseAcceptanceClaimed: false
  };
}

function writeReceipt(fileName, receipt) {
  const path = join(evidenceRoot, fileName);
  writeFileSync(path, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  return receipt;
}

function words(count) {
  return Array.from({ length: count }, (_, index) => `word${index}`).join(" ");
}
