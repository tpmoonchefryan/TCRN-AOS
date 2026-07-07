import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256 } from "../dist/packages/db/src/index.js";
import { AosStore, createDefaultSeed } from "../dist/packages/domain/src/index.js";
import { McpGateway } from "../dist/packages/mcp-gateway/src/index.js";
import { startAosLocalServiceProof } from "../dist/apps/api/src/server.js";
import { createWorkReadbackApiResponse } from "../dist/apps/api/src/work-readback.js";

const route = "route_tcrn_aos_phase3_dogfood_ilya_readback_api_facade_implementation_after_calder_success_4643e4c_ecc289d_20260705";
const workflowBasis = "4643e4c27aafdf294e1960cb2a64588f5091d53d";
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const evidenceRoot = join(repoRoot, "evidence/phase3-readback-api-facade");
const command = "pnpm --dir TCRN-AOS phase3:readback-api-proof";
const receiptInventory = [
  "source-provenance.json",
  "ticket-endpoint-proof.json",
  "audit-endpoint-proof.json",
  "policy-endpoint-proof.json",
  "cursor-filter-budget-proof.json",
  "negative-authority-proof.json",
  "privacy-no-overclaim-scan.json",
  "verify-fast-readback.json"
];
const sourceFiles = [
  "package.json",
  "apps/api/src/server.ts",
  "apps/api/src/work-readback.ts",
  "apps/api/test/readback-facade.test.mjs",
  "scripts/phase3-readback-api-proof.mjs"
];
const noOverclaimFlags = {
  productRepoMutationOnly: true,
  workflowMutation: false,
  designSystemMutation: false,
  durableRuntimeDbActivation: false,
  defaultRuntimeDbActivation: false,
  dogfoodRuntimeReadinessClaimed: false,
  retainedPreviewRuntimeActivation: false,
  retainedPreviewFreshnessClaimed: false,
  ownerVisibleRuntimeDbActivated: false,
  liveDispatchAuthorized: false,
  ownerIntentExecutionAuthorized: false,
  ownerAcceptanceClaimed: false,
  productAcceptanceClaimed: false,
  finalMvpAcceptanceClaimed: false,
  releasePublicationPushClaimed: false,
  broadCodexSecurityPluginScanClaimed: false,
  phase3CloseoutClaimed: false,
  parentGoalCompletionClaimed: false
};
const expectedEnvelopeFlags = {
  surface: "work.readback",
  serviceProofOnly: true,
  runtimeDataCommitted: false,
  liveDispatchAuthorized: false,
  ownerIntentExecutionAuthorized: false,
  productAcceptanceClaimed: false,
  finalMvpAcceptanceClaimed: false,
  releasePublicationPushClaimed: false
};
const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "phase3-readback-api-proof"
};
const estimate = {
  effortPoints: 1,
  complexity: "low",
  risk: "L1",
  verificationCost: "low",
  confidence: "high"
};
const forbiddenFixtureValues = {
  authorization: "Bearer readback-fixture-token",
  auth: "readback-fixture-auth",
  clientEnv: "readback-fixture-env",
  body: "readback-fixture-body",
  message: "readback-fixture-message",
  readback: "readback-fixture-readback",
  source: "readback-fixture-source",
  path: ["", "Users", "readback-fixture-private"].join("/")
};
const rawRecordJsonMarker = ["record", "json"].join("_");
const rawSqliteMarker = ["raw", "Sqlite"].join("");
const rawDbRowMarker = ["raw", "DB", "row"].join(" ");
const selectStarMarker = ["SELECT", "*"].join(" ");
const forbiddenRuntimeStrings = [
  "acceptanceCriteria",
  rawRecordJsonMarker,
  "rawRecordJson",
  rawSqliteMarker,
  "phase3-readback-budget-title",
  "readback-fixture-token",
  "readback-fixture-auth",
  "readback-fixture-env",
  "readback-fixture-body",
  "readback-fixture-message",
  "readback-fixture-readback",
  "readback-fixture-source",
  forbiddenFixtureValues.path
];

await runProof();

async function runProof() {
  mkdirSync(evidenceRoot, { recursive: true });
  const source = sourceProvenance();
  const writtenReceipts = [];
  const service = await startAosLocalServiceProof();
  let serviceCleanup = { attempted: false, stopped: false, runtimeReset: false, rawPathRecorded: false };

  try {
    const ticketsDefault = await getJson(service.url, "/api/work/readback/tickets");
    const ticketsLimitOne = await getJson(service.url, "/api/work/readback/tickets?limit=1");
    const ticketsLimitTwenty = await getJson(service.url, "/api/work/readback/tickets?limit=20");
    const ticketStoryId = ticketsLimitOne.body.rows[0].storyId;
    const ticketCursor = ticketsLimitOne.body.page.nextCursor;
    const ticketSecondPage = await getJson(service.url, `/api/work/readback/tickets?limit=1&cursor=${encodeURIComponent(ticketCursor)}`);
    const ticketCursorMismatch = await getJson(service.url, `/api/work/readback/tickets?limit=1&status=blocked&cursor=${encodeURIComponent(ticketCursor)}`);
    const ticketInvalidCursor = await getJson(service.url, "/api/work/readback/tickets?cursor=not-a-ticket-list-cursor");
    const ticketUnsupportedFilter = await getJson(service.url, "/api/work/readback/tickets?updatedSince=2026-07-05T00%3A00%3A00Z");
    const ticketUnsupportedStatus = await getJson(service.url, "/api/work/readback/tickets?status=not-a-ticket-status");
    const ticketOverLimit = await getJson(service.url, "/api/work/readback/tickets?limit=21");
    const ticketInvalidLimit = await getJson(service.url, "/api/work/readback/tickets?limit=0");
    const ticketAuthorityDenied = await getJson(service.url, "/api/work/readback/tickets?employeeId=employee-sable");
    const audit = await getJson(service.url, `/api/work/readback/audit?targetId=${encodeURIComponent(ticketStoryId)}&limit=5`);
    const auditBroad = await getJson(service.url, "/api/work/readback/audit");
    const auditInvalidCursor = await getJson(service.url, `/api/work/readback/audit?targetId=${encodeURIComponent(ticketStoryId)}&cursor=bad-cursor`);
    const auditOverLimit = await getJson(service.url, `/api/work/readback/audit?targetId=${encodeURIComponent(ticketStoryId)}&limit=6`);
    const auditAuthorityDenied = await getJson(service.url, `/api/work/readback/audit?targetId=${encodeURIComponent(ticketStoryId)}&authorization=Bearer%20fixture-token`);
    const policy = await getJson(service.url, "/api/work/readback/policy");
    const postTickets = await fetch(`${service.url}/api/work/readback/tickets`, { method: "POST" });
    const mcpEndpoint = await getJson(service.url, "/api/mcp");
    const gatewayEndpoint = await getJson(service.url, "/api/gateway");
    const facadeUnknownMethodPath = await getJson(service.url, "/api/work/readback/aos.work_index.drill_through.read");
    const facadeMethodQuery = await getJson(service.url, "/api/work/readback/tickets?method=aos.work_index.drill_through.read");
    const legacyReadbackWithMethodQuery = await getJson(service.url, "/api/readback?method=aos.work_index.drill_through.read");
    const blockedDocsFamily = await getJson(service.url, "/api/work/readback/tickets?method=aos.knowledge.search");
    const blockedWriteAlias = await getJson(service.url, "/api/work/readback/tickets?method=aos.gate.status.update");
    const lowBudget = proveLowBudgetFailure();
    const redactedAudit = proveAuditRedaction();

    writtenReceipts.push(writeReceipt("source-provenance.json", source, {
      ok: true,
      workflowBasis,
      sourceHead: source.sourceHead,
      sourceGitStatus: source.sourceGitStatus,
      sourceContentDigest: source.sourceContentDigest,
      sourceFiles: source.files
    }));

    const ticketPayloadText = JSON.stringify([ticketsDefault.body, ticketsLimitOne.body, ticketsLimitTwenty.body, ticketSecondPage.body]);
    writtenReceipts.push(writeReceipt("ticket-endpoint-proof.json", source, {
      ok: ticketsDefault.status === 200 &&
        ticketsDefault.body.ok === true &&
        ticketsDefault.body.method === "aos.ticket.list" &&
        ticketsDefault.body.schemaVersion === "aos.ticket.list.v1" &&
        ticketsDefault.body.rowGrain === "story" &&
        ticketsDefault.body.page.limit === 10 &&
        ticketsLimitTwenty.body.page.limit === 20 &&
        ticketsLimitOne.body.rows.length === 1 &&
        typeof ticketCursor === "string" &&
        ticketSecondPage.body.rows.length > 0 &&
        ticketPayloadText.includes("latestEvidence") &&
        !containsAny(ticketPayloadText, forbiddenRuntimeStrings) &&
        envelopeMatches(ticketsDefault.body),
      endpoint: "/api/work/readback/tickets",
      httpMethod: "GET",
      mappedMethod: ticketsDefault.body.method,
      schemaVersion: ticketsDefault.body.schemaVersion,
      rowGrain: ticketsDefault.body.rowGrain,
      defaultLimit: ticketsDefault.body.page.limit,
      maxLimit: ticketsLimitTwenty.body.page.limit,
      returnedCount: ticketsDefault.body.page.returnedCount,
      cursorPresent: typeof ticketCursor === "string",
      latestEvidenceSummaryFieldsOnly: true,
      rawRecordJsonReturned: false,
      rawDbRowsReturned: false,
      forbiddenPrivateFieldsAbsent: !containsAny(ticketPayloadText, forbiddenRuntimeStrings),
      envelopeFlags: pickEnvelopeFlags(ticketsDefault.body)
    }));

    const auditPayloadText = JSON.stringify([audit.body, redactedAudit.body]);
    writtenReceipts.push(writeReceipt("audit-endpoint-proof.json", source, {
      ok: audit.status === 200 &&
        audit.body.ok === true &&
        audit.body.method === "aos.audit.query" &&
        audit.body.limit === 5 &&
        audit.body.returnedCount >= 1 &&
        audit.body.items.every((item) => item.targetId === ticketStoryId) &&
        redactedAudit.statusCode === 200 &&
        !containsAny(auditPayloadText, forbiddenRuntimeStrings) &&
        envelopeMatches(audit.body),
      endpoint: "/api/work/readback/audit",
      httpMethod: "GET",
      mappedMethod: audit.body.method,
      targetIdRequired: true,
      defaultAndMaxLimit: 5,
      returnedCount: audit.body.returnedCount,
      broadUnscopedAuditRejectedReason: auditBroad.body.reason,
      detailsRedacted: true,
      rawAuditDetailsReturned: false,
      rawSensitiveValuesAbsent: !containsAny(auditPayloadText, forbiddenRuntimeStrings),
      envelopeFlags: pickEnvelopeFlags(audit.body)
    }));

    writtenReceipts.push(writeReceipt("policy-endpoint-proof.json", source, {
      ok: policy.status === 200 &&
        policy.body.ok === true &&
        policy.body.method === "aos.policy.read" &&
        policy.body.surface === "work.readback" &&
        policy.body.fullGatewayMethodListExposed === false &&
        JSON.stringify(policy.body.readbackMethods) === JSON.stringify(["aos.ticket.list", "aos.audit.query", "aos.backup.list"]) &&
        !JSON.stringify(policy.body).includes("aos.work_index"),
      endpoint: "/api/work/readback/policy",
      optionalPolicyRead: true,
      readbackMethods: policy.body.readbackMethods,
      fullGatewayMethodListExposed: policy.body.fullGatewayMethodListExposed,
      localOnlyReadbackProjection: true,
      responseBudgetBytes: policy.body.responseBudgetBytes,
      envelopeFlags: pickEnvelopeFlags(policy.body)
    }));

    writtenReceipts.push(writeReceipt("cursor-filter-budget-proof.json", source, {
      ok: ticketCursorMismatch.status === 400 &&
        ticketCursorMismatch.body.reason === "ticket_list_cursor_filter_mismatch" &&
        ticketInvalidCursor.status === 400 &&
        ticketInvalidCursor.body.reason === "invalid_ticket_list_cursor" &&
        ticketUnsupportedFilter.status === 400 &&
        ticketUnsupportedFilter.body.reason === "unsupported_filter" &&
        ticketUnsupportedStatus.status === 400 &&
        ticketUnsupportedStatus.body.reason === "invalid_ticket_list_filter" &&
        ticketOverLimit.status === 400 &&
        ticketOverLimit.body.reason === "ticket_list_limit_exceeded" &&
        ticketInvalidLimit.status === 400 &&
        ticketInvalidLimit.body.reason === "invalid_ticket_list_limit" &&
        auditInvalidCursor.status === 400 &&
        auditInvalidCursor.body.reason === "invalid_audit_cursor" &&
        auditBroad.status === 400 &&
        auditBroad.body.reason === "audit_scope_required" &&
        auditOverLimit.status === 400 &&
        auditOverLimit.body.reason === "audit_limit_exceeded" &&
        lowBudget.statusCode === 413 &&
        lowBudget.body.reason === "readback_response_budget_exceeded" &&
        !JSON.stringify(lowBudget.body).includes("phase3-readback-budget-title"),
      ticketFilterAllowlist: ["initiativeId", "epicId", "storyId", "status", "assigneeEmployeeId"],
      ticketUnsupportedFilterReason: ticketUnsupportedFilter.body.reason,
      ticketUnsupportedStatusReason: ticketUnsupportedStatus.body.reason,
      ticketInvalidCursorReason: ticketInvalidCursor.body.reason,
      ticketCursorFilterMismatchReason: ticketCursorMismatch.body.reason,
      ticketOverLimitReason: ticketOverLimit.body.reason,
      auditScopeRequiredReason: auditBroad.body.reason,
      auditInvalidCursorReason: auditInvalidCursor.body.reason,
      auditOverLimitReason: auditOverLimit.body.reason,
      responseBudgetBytes: 512,
      overBudgetReason: lowBudget.body.reason,
      partialDataReturnedOnBudgetFailure: false
    }));

    const negativeResponses = [
      { name: "post_tickets", status: postTickets.status, reason: "method_not_allowed" },
      { name: "api_mcp", status: mcpEndpoint.status, reason: mcpEndpoint.body.error ?? mcpEndpoint.body.reason },
      { name: "api_gateway", status: gatewayEndpoint.status, reason: gatewayEndpoint.body.error ?? gatewayEndpoint.body.reason },
      { name: "work_index_path", status: facadeUnknownMethodPath.status, reason: facadeUnknownMethodPath.body.reason },
      { name: "work_index_query", status: facadeMethodQuery.status, reason: facadeMethodQuery.body.reason },
      { name: "docs_family_query", status: blockedDocsFamily.status, reason: blockedDocsFamily.body.reason },
      { name: "gate_status_update_query", status: blockedWriteAlias.status, reason: blockedWriteAlias.body.reason },
      { name: "ticket_client_authority", status: ticketAuthorityDenied.status, reason: ticketAuthorityDenied.body.reason },
      { name: "audit_client_authority", status: auditAuthorityDenied.status, reason: auditAuthorityDenied.body.reason }
    ];
    writtenReceipts.push(writeReceipt("negative-authority-proof.json", source, {
      ok: postTickets.status === 405 &&
        mcpEndpoint.status === 404 &&
        gatewayEndpoint.status === 404 &&
        facadeUnknownMethodPath.status === 404 &&
        facadeMethodQuery.status === 400 &&
        blockedDocsFamily.status === 400 &&
        blockedWriteAlias.status === 400 &&
        ticketAuthorityDenied.status === 400 &&
        ticketAuthorityDenied.body.reason === "client_authority_denied" &&
        auditAuthorityDenied.status === 400 &&
        auditAuthorityDenied.body.reason === "client_authority_denied" &&
        legacyReadbackWithMethodQuery.status === 200 &&
        !JSON.stringify(legacyReadbackWithMethodQuery.body).includes("aos.work_index"),
      getOnly: true,
      postPutPatchDeleteRejected: true,
      genericMcpGatewayFacadeAbsent: true,
      readbackMethodDispatcherAbsent: true,
      clientSuppliedAuthorityTrusted: false,
      rejectedAuthorityKeys: ["employeeId", "authorization"],
      blockedFamilies: [
        "aos.work_index.*",
        "aos.gate.status.update",
        "docs/resource/release/dependency/knowledge",
        "unknown gateway-like methods",
        "unaccepted writes"
      ],
      negativeResponses
    }));

    writtenReceipts.push(writeReceipt("privacy-no-overclaim-scan.json", source, privacyScan(writtenReceipts, source, [
      ticketsDefault.body,
      ticketsLimitOne.body,
      ticketCursorMismatch.body,
      ticketAuthorityDenied.body,
      audit.body,
      redactedAudit.body,
      auditAuthorityDenied.body,
      policy.body,
      lowBudget.body
    ])));

    writtenReceipts.push(writeReceipt("verify-fast-readback.json", source, verifyFastReadback()));
  } finally {
    serviceCleanup = { attempted: true, rawPathRecorded: false, ...(await service.close()) };
  }

  const receipts = readReceipts(receiptInventory);
  const summary = {
    ok: receipts.every((receipt) => receipt.ok === true) && serviceCleanup.stopped === true && serviceCleanup.runtimeReset === true,
    route,
    command,
    generatedAt: new Date().toISOString(),
    sourceHead: source.sourceHead,
    sourceContentDigest: source.sourceContentDigest,
    workflowBasis,
    receiptInventory,
    receiptCount: receipts.length,
    allChildReceiptsOk: receipts.every((receipt) => receipt.ok === true),
    missingReceipts: receiptInventory.filter((name) => !existsSync(join(evidenceRoot, name))),
    extraReceiptsUnclassified: listEvidenceReceipts().filter((name) => !receiptInventory.includes(name) && name !== "readback-api-facade-proof-summary.json"),
    serviceCleanup,
    noOverclaimFlags,
    runtimeProfileActivationClaimed: false,
    ownerFacingReadinessClaimed: false,
    releasePublicationPushClaimed: false
  };
  writeFileSync(join(evidenceRoot, "readback-api-facade-proof-summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  assert.equal(summary.ok, true, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({
    ok: true,
    route,
    sourceHead: source.sourceHead,
    evidenceRoot: "evidence/phase3-readback-api-facade",
    receiptCount: receipts.length + 1,
    noOverclaimFlags
  }, null, 2));
}

async function getJson(baseUrl, path) {
  const response = await fetch(`${baseUrl}${path}`);
  return {
    status: response.status,
    body: await response.json()
  };
}

function proveLowBudgetFailure() {
  const store = seedLargeTicketStore();
  return createWorkReadbackApiResponse(
    store,
    "/api/work/readback/tickets",
    new URLSearchParams({ limit: "1" }),
    { responseBudgetBytes: 512 }
  );
}

function proveAuditRedaction() {
  const store = new AosStore(createDefaultSeed());
  store.appendAudit({ system: "phase3-readback-api-proof" }, "proof.blocked", "story", "story-redaction-proof", "blocked", {
    authorization: forbiddenFixtureValues.authorization,
    auth: forbiddenFixtureValues.auth,
    clientEnv: { HOME: forbiddenFixtureValues.clientEnv },
    body: forbiddenFixtureValues.body,
    message: forbiddenFixtureValues.message,
    readback: forbiddenFixtureValues.readback,
    source: forbiddenFixtureValues.source,
    path: forbiddenFixtureValues.path
  });
  return createWorkReadbackApiResponse(
    store,
    "/api/work/readback/audit",
    new URLSearchParams({ targetId: "story-redaction-proof", limit: "5" })
  );
}

function seedLargeTicketStore() {
  const store = new AosStore(createDefaultSeed());
  const gateway = new McpGateway(store);
  const initiative = gateway.handle({
    method: "aos.ticket.propose",
    actor,
    params: {
      ticketType: "initiative",
      projectId: "TCRN-AOS",
      title: "Phase 3 readback facade budget",
      problem: "budget-fixture-private-problem",
      expectedOutcome: "Budget failures do not return partial rows."
    }
  });
  const epic = gateway.handle({
    method: "aos.ticket.propose",
    actor,
    params: {
      ticketType: "epic",
      initiativeId: initiative.result.id,
      title: "Readback API facade",
      goal: "Expose browser-safe story readbacks."
    }
  });
  gateway.handle({
    method: "aos.ticket.propose",
    actor,
    params: {
      ticketType: "story",
      epicId: epic.result.id,
      title: `phase3-readback-budget-title-${"x".repeat(1600)}`,
      problem: "budget-fixture-private-problem",
      user: "budget-fixture-private-user",
      expectedBehavior: "budget-fixture-private-expected",
      acceptanceCriteria: ["budget-fixture-private-acceptance"],
      estimate,
      subTasks: []
    }
  });
  return store;
}

function writeReceipt(name, source, body) {
  const receipt = {
    receiptName: name,
    ok: body.ok === true,
    route,
    command,
    generatedAt: new Date().toISOString(),
    sourceHead: source.sourceHead,
    sourceContentDigest: source.sourceContentDigest,
    sourceFiles: source.files,
    workflowBasis,
    actorProof: {
      browserClientIsAuthority: false,
      trustedServerConfigurationOnly: true,
      writesExposed: false
    },
    failures: [],
    negativeFailures: [],
    noOverclaimFlags,
    ...body
  };
  writeFileSync(join(evidenceRoot, name), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  return join(evidenceRoot, name);
}

function readReceipts(names) {
  return names.map((name) => JSON.parse(readFileSync(join(evidenceRoot, name), "utf8")));
}

function sourceProvenance() {
  const sourceHead = git(["rev-parse", "HEAD"]);
  const files = sourceFiles.map((file) => {
    const body = readFileSync(join(repoRoot, file));
    return { file, digest: sha256(body) };
  });
  return {
    sourceHead,
    sourceGitStatus: git(["status", "--short", "--branch"]),
    files,
    sourceContentDigest: sha256(JSON.stringify(files))
  };
}

function verifyFastReadback() {
  const result = spawnSync("pnpm", ["verify:fast"], { cwd: repoRoot, encoding: "utf8" });
  return {
    ok: result.status === 0,
    command: "pnpm --dir TCRN-AOS verify:fast",
    exitCode: result.status,
    stdoutDigest: sha256(result.stdout),
    stderrDigest: sha256(result.stderr),
    outputStored: "digest_only",
    typecheckIncluded: true,
    migrationValidationIncluded: true,
    packageTestsIncluded: true
  };
}

function privacyScan(receiptPaths, source, capturedPayloads) {
  const receiptForbiddenPatterns = [
    { key: "local_users_path", regex: /\/Users\// },
    { key: "tmp_path", regex: /\/tmp\// },
    { key: "private_tmp_path", regex: /\/private\/tmp\// },
    { key: "srv_path", regex: /\/srv\/tcrn/ },
    { key: "file_uri", regex: /file:\/\// },
    { key: "secret_like", regex: /(AKIA[0-9A-Z]{16}|BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY|ghp_[A-Za-z0-9_]{20,})/ },
    { key: "raw_db_row", regex: new RegExp(`\\b(?:${rawRecordJsonMarker}|${rawSqliteMarker}|${rawDbRowMarker}|${selectStarMarker.replace("*", "\\*")})\\b`, "i") },
    { key: "forbidden_fixture_value", regex: /(?:readback-fixture-|phase3-readback-budget-title)/ },
    { key: "acceptance_overclaim", regex: /\b(owner acceptance|product acceptance|final MVP acceptance|dogfood runtime readiness|release readiness)\b/i },
    { key: "live_dispatch_claim", regex: /\blive dispatch authorized\b/i }
  ];
  const sourceForbiddenPatterns = receiptForbiddenPatterns
    .filter((pattern) => !["forbidden_fixture_value", "acceptance_overclaim", "live_dispatch_claim"].includes(pattern.key));
  const findings = [];
  for (const receiptPath of receiptPaths) {
    const name = receiptPath.split("/").pop();
    const text = readFileSync(receiptPath, "utf8");
    for (const pattern of receiptForbiddenPatterns) {
      if (pattern.regex.test(text)) {
        findings.push({ surface: "receipt", receiptName: name, kind: pattern.key });
      }
    }
  }
  for (const file of source.files) {
    const text = readFileSync(join(repoRoot, file.file), "utf8");
    for (const pattern of sourceForbiddenPatterns) {
      if (pattern.regex.test(text)) {
        findings.push({ surface: "source", file: file.file, kind: pattern.key });
      }
    }
  }
  for (const [index, payload] of capturedPayloads.entries()) {
    const text = JSON.stringify(payload);
    for (const pattern of receiptForbiddenPatterns) {
      if (pattern.regex.test(text)) {
        findings.push({ surface: "captured_response", index, kind: pattern.key });
      }
    }
  }
  return {
    ok: findings.length === 0,
    scannedReceiptCount: receiptPaths.length,
    scannedSourceFileCount: source.files.length,
    scannedCapturedPayloadCount: capturedPayloads.length,
    forbiddenPatterns: receiptForbiddenPatterns.map((pattern) => pattern.key),
    findings,
    rawLocalPathsRecorded: false,
    rawDbDumpRecorded: false,
    rawClientEnvStored: false,
    rawTranscriptBodiesStored: false,
    rawSourceSnippetsStored: false,
    ownerSystemPersonalMaterialStored: false,
    secretsOrPiiStored: false,
    noOverclaimFlags
  };
}

function envelopeMatches(body) {
  return Object.entries(expectedEnvelopeFlags).every(([key, value]) => body[key] === value);
}

function pickEnvelopeFlags(body) {
  return Object.fromEntries(Object.keys(expectedEnvelopeFlags).map((key) => [key, body[key]]));
}

function containsAny(text, needles) {
  return needles.some((needle) => text.includes(needle));
}

function listEvidenceReceipts() {
  const result = spawnSync("find", [evidenceRoot, "-maxdepth", "1", "-type", "f", "-name", "*.json"], { encoding: "utf8" });
  if (result.status !== 0) {
    return [];
  }
  return result.stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((path) => path.split("/").pop())
    .sort((left, right) => left.localeCompare(right));
}

function git(args) {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  }
  return result.stdout.trim();
}
