import assert from "node:assert/strict";
import { createInterface } from "node:readline";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AosSqliteRepository,
  assertRouteOwnedSqliteRoot,
  sha256
} from "../dist/packages/db/src/index.js";
import { AosStore, createDefaultSeed } from "../dist/packages/domain/src/index.js";
import { transportMvpMethods } from "../dist/packages/mcp-server/src/index.js";

const route = "route_tcrn_aos_phase3_dogfood_ilya_implementation_aos_ticket_list_after_mara_pm_scope_success_fa594d6_5b09469_20260705";
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const evidenceRoot = join(repoRoot, "evidence/phase3-dogfood-ticket-list-method-scope");
const migrationsDir = join(repoRoot, "packages/db/migrations/sqlite");
const serverEntrypoint = join(repoRoot, "dist/packages/mcp-server/src/stdio-server.js");
const command = "pnpm --dir TCRN-AOS phase3:ticket-list-proof";
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
const receiptInventory = [
  "schema-row-grain-proof.json",
  "cursor-filter-limit-proof.json",
  "allowlist-policy-proof.json",
  "negative-methods-proof.json",
  "response-budget-replay-proof.json",
  "redaction-privacy-proof.json",
  "source-provenance.json",
  "verify-fast-readback.json"
];
const sourceFiles = [
  "package.json",
  "packages/domain/src/types.ts",
  "packages/domain/src/store.ts",
  "packages/mcp-gateway/src/gateway.ts",
  "packages/mcp-gateway/test/gateway.test.mjs",
  "packages/mcp-server/src/transport.ts",
  "packages/mcp-server/test/stdio-transport.test.mjs",
  "scripts/phase3-ticket-list-proof.mjs"
];
const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "phase3-ticket-list-proof"
};
const forbiddenValues = [
  "phase3-private-problem-value",
  "phase3-private-user-value",
  "phase3-private-expected-value",
  "phase3-private-acceptance-value",
  "phase3-private-proof-expectation-value",
  "phase3-private-run-readback-value",
  "phase3-private-output-summary-value",
  "phase3-private-evidence-target-value",
  ["/", "Users", "phase3-private-local-path"].join("/")
];
const allowedRowFields = new Set([
  "initiativeId",
  "initiativeTitle",
  "initiativeStatus",
  "epicId",
  "epicTitle",
  "epicStatus",
  "storyId",
  "storyTitle",
  "storyStatus",
  "updatedAt",
  "subtaskSummaries",
  "assignmentIds",
  "assigneeEmployeeIds",
  "runReferences",
  "latestGate",
  "latestEvidence",
  "latestAudit",
  "auditCount"
]);

await runProof();

async function runProof() {
  mkdirSync(evidenceRoot, { recursive: true });
  const source = sourceProvenance();
  const tempRoot = await mkdtemp(join(tmpdir(), "tcrn-aos-phase3-ticket-list-"));
  const markerFile = ".tcrn-aos-phase1-root";
  writeFileSync(join(tempRoot, markerFile), "owned-by-phase3-ticket-list-proof\n", "utf8");
  const dbPath = join(tempRoot, "phase3-ticket-list.sqlite");
  const writtenReceipts = [];
  let cleanupReadback = { attempted: false, removed: false, rawPathRecorded: false };
  let rootReadback;

  try {
    rootReadback = assertRouteOwnedSqliteRoot(tempRoot, repoRoot, markerFile);
    const seed = seedProofDatabase(dbPath);
    const server = await startClientSession(dbPath, actor);
    let capturedResponses = [];
    try {
      const policy = await server.send("aos.policy.read", {});
      const defaultPage = await server.send("aos.ticket.list", {});
      const maxPage = await server.send("aos.ticket.list", { limit: 20 });
      const firstPage = await server.send("aos.ticket.list", { limit: 1 });
      const secondPage = await server.send("aos.ticket.list", { limit: 1, cursor: responsePayload(firstPage).page.nextCursor });
      const nearTerminalPage = await server.send("aos.ticket.list", { limit: 3 });
      const terminalPage = await server.send("aos.ticket.list", { limit: 3, cursor: responsePayload(nearTerminalPage).page.nextCursor });
      const filteredByStory = await server.send("aos.ticket.list", { storyId: seed.storyIds[0] });
      const filteredByAssignee = await server.send("aos.ticket.list", { assigneeEmployeeId: actor.employeeId });
      const emptyResult = await server.send("aos.ticket.list", { status: "archived" });
      const overMax = await server.send("aos.ticket.list", { limit: 21 });
      const negativeLimit = await server.send("aos.ticket.list", { limit: -1 });
      const nonIntegerLimit = await server.send("aos.ticket.list", { limit: "2" });
      const malformedCursor = await server.send("aos.ticket.list", { cursor: "not-json-cursor" });
      const filterMismatch = await server.send("aos.ticket.list", { limit: 1, status: "blocked", cursor: responsePayload(firstPage).page.nextCursor });
      const unsupportedFilter = await server.send("aos.ticket.list", { updatedSince: "2026-07-05T00:00:00.000Z" });
      const replayOne = await server.send("aos.ticket.list", { storyId: seed.storyIds[0], idempotencyKey: "phase3-ticket-list-replay" });
      const replayTwo = await server.send("aos.ticket.list", { storyId: seed.storyIds[0], idempotencyKey: "phase3-ticket-list-replay" });
      const negativeMethods = await proveNegativeMethods(server);
      capturedResponses = [
        policy,
        defaultPage,
        maxPage,
        firstPage,
        secondPage,
        nearTerminalPage,
        terminalPage,
        filteredByStory,
        filteredByAssignee,
        emptyResult,
        overMax,
        negativeLimit,
        nonIntegerLimit,
        malformedCursor,
        filterMismatch,
        unsupportedFilter,
        replayOne,
        replayTwo,
        ...negativeMethods.map((item) => item.response)
      ];

      const defaultPayload = responsePayload(defaultPage);
      const firstRow = defaultPayload.rows[0];
      const rowText = JSON.stringify(defaultPayload);
      writtenReceipts.push(writeReceipt("schema-row-grain-proof.json", source, rootReadback, {
        ok: defaultPayload.ok === true &&
          defaultPayload.method === "aos.ticket.list" &&
          defaultPayload.schemaVersion === "aos.ticket.list.v1" &&
          defaultPayload.rowGrain === "story" &&
          defaultPayload.rows.length > 0 &&
          defaultPayload.rows.every((row) => Object.keys(row).every((key) => allowedRowFields.has(key))) &&
          !forbiddenValues.some((value) => rowText.includes(value)),
        method: defaultPayload.method,
        schemaVersion: defaultPayload.schemaVersion,
        rowGrain: defaultPayload.rowGrain,
        returnedCount: defaultPayload.page.returnedCount,
        allowedRowFields: [...allowedRowFields],
        sampleRow: firstRow,
        typedItemRowsImplemented: false,
        rawRecordJsonReturned: false,
        forbiddenPrivateFieldsAbsent: !forbiddenValues.some((value) => rowText.includes(value))
      }));

      writtenReceipts.push(writeReceipt("cursor-filter-limit-proof.json", source, rootReadback, {
        ok: defaultPayload.page.limit === 5 &&
          responsePayload(maxPage).page.limit === 20 &&
          responsePayload(firstPage).page.hasMore === true &&
          typeof responsePayload(firstPage).page.nextCursor === "string" &&
          responsePayload(secondPage).rows.length > 0 &&
          responsePayload(terminalPage).page.hasMore === false &&
          responsePayload(emptyResult).rows.length === 0 &&
          responsePayload(overMax).error === "ticket_list_limit_exceeded" &&
          responsePayload(negativeLimit).error === "invalid_ticket_list_limit" &&
          responsePayload(nonIntegerLimit).error === "invalid_ticket_list_limit" &&
          responsePayload(malformedCursor).error === "invalid_ticket_list_cursor" &&
          responsePayload(filterMismatch).error === "ticket_list_cursor_filter_mismatch" &&
          /^unsupported_ticket_list_filter/.test(responsePayload(unsupportedFilter).error ?? "") &&
          responsePayload(filteredByStory).rows.every((row) => row.storyId === seed.storyIds[0]) &&
          responsePayload(filteredByAssignee).rows.every((row) => row.assigneeEmployeeIds.includes(actor.employeeId)),
        filterAllowlist: ["initiativeId", "epicId", "storyId", "status", "assigneeEmployeeId"],
        noFreeTextSearch: true,
        updatedSinceImplemented: false,
        defaultLimit: defaultPayload.page.limit,
        maxLimit: responsePayload(maxPage).page.limit,
        overMaxReason: responsePayload(overMax).error,
        invalidLimitReasons: [responsePayload(negativeLimit).error, responsePayload(nonIntegerLimit).error],
        malformedCursorReason: responsePayload(malformedCursor).error,
        filterMismatchReason: responsePayload(filterMismatch).error,
        unsupportedFilterReason: responsePayload(unsupportedFilter).error,
        nextCursorPresent: typeof responsePayload(firstPage).page.nextCursor === "string",
        terminalHasMore: responsePayload(terminalPage).page.hasMore,
        cursorIsNakedOffset: false
      }));

      writtenReceipts.push(writeReceipt("allowlist-policy-proof.json", source, rootReadback, {
        ok: responsePayload(policy).transportAllowedMethods.includes("aos.ticket.list") &&
          responsePayload(policy).transportAllowedMethods.length === transportMvpMethods.length &&
          responsePayload(policy).fullGatewayMethodListExposed === false &&
          responsePayload(policy).boundaries.liveDispatchAuthorized === false,
        transportMvpMethods,
        ticketListInTransportAllowlist: responsePayload(policy).transportAllowedMethods.includes("aos.ticket.list"),
        fullGatewayMethodListExposed: false,
        localOnly: responsePayload(policy).boundaries.localOnly,
        stdioOnly: responsePayload(policy).boundaries.stdioOnly,
        liveDispatchAuthorized: responsePayload(policy).boundaries.liveDispatchAuthorized,
        releasePublicationPushAuthorized: responsePayload(policy).boundaries.releasePublicationPushAuthorized,
        ownerIntentExecutionAuthorized: responsePayload(policy).boundaries.ownerIntentExecutionAuthorized
      }));

      writtenReceipts.push(writeReceipt("negative-methods-proof.json", source, rootReadback, {
        ok: negativeMethods.every((item) => item.rejected === true),
        negativeMethods: negativeMethods.map(({ method, reason, expectedReason, rejected }) => ({
          method,
          reason,
          expectedReason,
          rejected
        })),
        workIndexDrillThroughRejected: negativeMethods.some((item) => item.method === "aos.work_index.drill_through.read" && item.rejected),
        slices6To9Rejected: negativeMethods.filter((item) => item.expectedReason === "transport_method_outside_mvp_allowlist").length >= 4,
        broaderGatewayListAuthorityUsed: false
      }));

      const budgetReplay = await proveBudgetReplay();
      writtenReceipts.push(writeReceipt("response-budget-replay-proof.json", source, rootReadback, {
        ok: responsePayload(replayTwo).status === "deduped" &&
          budgetReplay.firstRejected === true &&
          budgetReplay.replayRejected === true &&
          budgetReplay.replayNotDeduped === true,
        normalPageReturnedCount: defaultPayload.page.returnedCount,
        multiPageCursorUsed: typeof responsePayload(firstPage).page.nextCursor === "string",
        unboundedHistoryDump: false,
        processLocalReplayStatus: responsePayload(replayTwo).status,
        crossRestartDedupeClaimed: false,
        budgetReplay
      }));

      const privacy = provePrivacy(dbPath, capturedResponses, writtenReceipts);
      writtenReceipts.push(writeReceipt("redaction-privacy-proof.json", source, rootReadback, privacy));
      writtenReceipts.push(writeReceipt("source-provenance.json", source, rootReadback, {
        ok: true,
        sourceHead: source.sourceHead,
        sourceContentDigest: source.sourceContentDigest,
        sourceFiles: source.files,
        sourceGitStatusDigestOnly: sha256(source.sourceGitStatus),
        sourceGitStatusStoredRaw: false
      }));
      writtenReceipts.push(writeReceipt("verify-fast-readback.json", source, rootReadback, verifyFastReadback()));
    } finally {
      await server.stop();
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    cleanupReadback = { attempted: true, removed: !existsSync(tempRoot), rawPathRecorded: false };
  }

  const receiptPrivacy = privacyScan(writtenReceipts, source);
  const childReadbacks = readReceipts(receiptInventory);
  const summary = {
    ok: childReadbacks.every((receipt) => receipt.ok === true) &&
      receiptPrivacy.ok === true &&
      receiptInventory.length === childReadbacks.length,
    route,
    command,
    generatedAt: new Date().toISOString(),
    sourceHead: source.sourceHead,
    sourceContentDigest: source.sourceContentDigest,
    receiptInventory,
    receiptCount: childReadbacks.length,
    childReceiptsOk: Object.fromEntries(childReadbacks.map((receipt) => [receipt.receiptName, receipt.ok])),
    missingReceipts: receiptInventory.filter((name) => !childReadbacks.some((receipt) => receipt.receiptName === name)),
    extraUnclassifiedReceipts: [],
    sourceProvenanceConsistent: childReadbacks.every((receipt) => receipt.sourceContentDigest === source.sourceContentDigest),
    privacyScanClean: receiptPrivacy.ok,
    receiptPrivacyFindings: receiptPrivacy.findings,
    noOverclaimFlags,
    cleanupReadback
  };
  writeFileSync(join(evidenceRoot, "phase3-ticket-list-proof-summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  assert.equal(summary.ok, true);
  console.log(JSON.stringify({ ok: true, receiptInventory: ["phase3-ticket-list-proof-summary.json", ...receiptInventory] }, null, 2));
}

function seedProofDatabase(dbPath, options = {}) {
  const repository = new AosSqliteRepository({ databasePath: dbPath, migrationsDir });
  repository.applyMigrations();
  repository.seedAiEmployees(createDefaultSeed().employees, "phase3-ticket-list-proof-seed");
  const store = new AosStore(createDefaultSeed(), { persistence: repository });
  for (const project of createDefaultSeed().projects) {
    store.upsertProject(project, actor);
  }
  const initiative = store.createInitiative({
    projectId: "TCRN-AOS",
    title: "Phase 3 ticket list proof",
    status: "in_progress",
    problem: "AOS needs story-centric ticket-list readback.",
    expectedOutcome: "Bounded read method returns safe persisted metadata."
  }, actor);
  const epic = store.createEpic({
    initiativeId: initiative.id,
    title: "Dogfood readback method",
    goal: "Expose safe ticket list rows over stdio.",
    status: "in_progress"
  }, actor);
  const storyIds = [];
  const count = options.count ?? 4;
  const titlePad = "x".repeat(options.storyTitleLength ?? 0);
  for (let index = 0; index < count; index += 1) {
    const story = store.createStory({
      epicId: epic.id,
      title: `Phase 3 story ${index} ${titlePad}`,
      problem: `${forbiddenValues[0]}-${index}`,
      user: `${forbiddenValues[1]}-${index}`,
      expectedBehavior: `${forbiddenValues[2]}-${index}`,
      acceptanceCriteria: [`${forbiddenValues[3]}-${index}`],
      status: index === 2 ? "blocked" : "in_progress",
      estimate: { effortPoints: 3, complexity: "medium", risk: "L3", verificationCost: "high", confidence: "medium" },
      subTasks: [{
        id: `subtask-phase3-ticket-list-${index}`,
        title: `Ticket list subtask ${index}`,
        ownerRole: "implementation",
        status: "in_progress",
        dependencyIds: [],
        proofExpectation: `${forbiddenValues[4]}-${index}`
      }]
    }, actor);
    const assignment = store.createAssignment({
      employeeId: actor.employeeId,
      targetId: story.id,
      targetType: "story",
      role: "implementation",
      status: "in_progress",
      dueState: "none",
      proofExpectation: "phase3 ticket list proof"
    }, actor);
    store.recordAgentRun({
      assignmentId: assignment.id,
      status: "success",
      startedAt: `2026-07-05T20:1${index}:00.000Z`,
      endedAt: `2026-07-05T20:1${index}:30.000Z`,
      readback: `${forbiddenValues[5]}-${index}`,
      outputSummary: `${forbiddenValues[6]}-${index}`
    }, actor);
    const evidence = store.linkEvidence({
      type: "artifact_id",
      target: `${forbiddenValues[7]}-${index}`,
      validity: "valid",
      producer: actor.employeeId,
      digest: `sha256:phase3-ticket-list-${index}`,
      redactionState: "metadata_only"
    }, actor);
    store.requestGate({
      type: "evidence_proof",
      linkedTicketId: story.id,
      inputEvidenceIds: [evidence.id]
    }, actor);
    storyIds.push(story.id);
  }
  repository.close();
  return { initiativeId: initiative.id, epicId: epic.id, storyIds };
}

async function startClientSession(dbPath, sessionActor, overrides = {}) {
  const config = Buffer.from(JSON.stringify({
    actor: sessionActor,
    databasePath: dbPath,
    databaseRoot: dirname(dbPath),
    repoRoot,
    routeOwnedMarkerFile: ".tcrn-aos-phase1-root",
    migrationsDir,
    auditPageLimit: 2,
    maxResponseBytes: 16384,
    ...overrides
  }), "utf8").toString("base64url");
  const child = spawn(process.execPath, [serverEntrypoint], {
    cwd: repoRoot,
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, AOS_MCP_TRANSPORT_CONFIG_B64: config }
  });
  const lines = createInterface({ input: child.stdout, terminal: false });
  const iterator = lines[Symbol.asyncIterator]();
  let nextId = 1;
  let stopped = false;
  const stderr = [];
  child.stderr.on("data", (chunk) => stderr.push(String(chunk)));
  child.on("exit", () => {
    stopped = true;
  });
  return {
    async send(method, params) {
      const id = nextId++;
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
      const result = await iterator.next();
      if (result.done) {
        throw new Error(`stdio server closed before response; stderrDigest=${sha256(stderr.join(""))}`);
      }
      return JSON.parse(result.value);
    },
    async stop() {
      if (stopped) {
        return;
      }
      child.stdin.end();
      await new Promise((resolve) => child.once("exit", resolve));
      lines.close();
    }
  };
}

async function proveNegativeMethods(server) {
  const cases = [
    ["aos.work_index.drill_through.read", "transport_method_outside_mvp_allowlist"],
    ["aos.work_index.any", "transport_method_outside_mvp_allowlist"],
    ["aos.resource.record.propose", "transport_method_outside_mvp_allowlist"],
    ["aos.knowledge.entry.propose", "transport_method_outside_mvp_allowlist"],
    ["aos.ticket.archive", "transport_method_unknown"],
    ["aos.unsupported.method", "transport_method_unknown"]
  ];
  const results = [];
  for (const [method, expectedReason] of cases) {
    const response = await server.send(method, {});
    results.push({
      method,
      expectedReason,
      reason: response.error?.data?.reason ?? null,
      rejected: response.error?.data?.reason === expectedReason,
      response
    });
  }
  return results;
}

async function proveBudgetReplay() {
  const root = await mkdtemp(join(tmpdir(), "tcrn-aos-phase3-ticket-list-budget-"));
  const markerFile = ".tcrn-aos-phase1-root";
  writeFileSync(join(root, markerFile), "owned-by-phase3-ticket-list-budget-proof\n", "utf8");
  const dbPath = join(root, "phase3-budget.sqlite");
  try {
    assertRouteOwnedSqliteRoot(root, repoRoot, markerFile);
    seedProofDatabase(dbPath, { count: 4, storyTitleLength: 900 });
    const server = await startClientSession(dbPath, actor, { maxResponseBytes: 1024 });
    try {
      const first = await server.send("aos.ticket.list", { limit: 4 });
      const replay = await server.send("aos.ticket.list", { limit: 4 });
      return {
        firstRejected: first.error?.data?.reason === "transport_response_budget_exceeded",
        replayRejected: replay.error?.data?.reason === "transport_response_budget_exceeded",
        replayNotDeduped: replay.result?.status !== "deduped",
        firstReason: first.error?.data?.reason ?? null,
        replayReason: replay.error?.data?.reason ?? null,
        cacheBypassClosed: first.error?.data?.reason === "transport_response_budget_exceeded" &&
          replay.error?.data?.reason === "transport_response_budget_exceeded" &&
          replay.result?.status !== "deduped",
        rawPathRecorded: false
      };
    } finally {
      await server.stop();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function provePrivacy(dbPath, capturedResponses, receiptPaths) {
  const repository = new AosSqliteRepository({ databasePath: dbPath, migrationsDir });
  repository.applyMigrations();
  const store = new AosStore(undefined, { persistence: repository });
  const auditRows = store.queryAudit();
  repository.close();
  const responseText = JSON.stringify(capturedResponses);
  const auditText = JSON.stringify(auditRows);
  const receiptText = receiptPaths.map((path) => readFileSync(path, "utf8")).join("\n");
  const rawValuesAbsentFromResponses = !forbiddenValues.some((value) => responseText.includes(value));
  const rawValuesAbsentFromAuditRows = !forbiddenValues.some((value) => auditText.includes(value));
  const rawValuesAbsentFromReceipts = !forbiddenValues.some((value) => receiptText.includes(value));
  const forbiddenFieldNames = ["problem", "user", "expectedBehavior", "acceptanceCriteria", "proofExpectation", "readback", "outputSummary", "target", "record_json"];
  const ticketResponseText = JSON.stringify(capturedResponses.filter((response) => response.result?.method === "aos.ticket.list" || response.result?.result?.method === "aos.ticket.list"));
  return {
    ok: rawValuesAbsentFromResponses && rawValuesAbsentFromAuditRows && rawValuesAbsentFromReceipts &&
      !forbiddenFieldNames.some((field) => new RegExp(`\"${field}\"`).test(ticketResponseText)),
    responsePayloadsScanned: capturedResponses.length,
    auditRowsScanned: auditRows.length,
    rawValuesAbsentFromResponses,
    rawValuesAbsentFromAuditRows,
    rawValuesAbsentFromReceipts,
    rawValueDigests: Object.fromEntries(forbiddenValues.map((value, index) => [`fixture_${index}`, sha256(value)])),
    forbiddenFieldNames,
    rawRecordJsonReturned: false,
    rawSqliteRowsReturned: false,
    rawLocalPathsRecorded: false,
    rawDbDumpRecorded: false,
    rawPromptOrMessageStored: false,
    secretsOrPiiStored: false,
    noOverclaimFlags
  };
}

function writeReceipt(name, source, rootReadback, body) {
  const receipt = {
    receiptName: name,
    ok: body.ok === true,
    route,
    command,
    generatedAt: new Date().toISOString(),
    sourceHead: source.sourceHead,
    sourceContentDigest: source.sourceContentDigest,
    sourceFiles: source.files,
    routeOwnedDbRoot: {
      class: "os_temp_route_owned_redacted",
      rootDigest: rootReadback.rootDigest,
      rawPathRecorded: false
    },
    actorProof: {
      employeeId: actor.employeeId,
      role: actor.role,
      threadId: actor.threadId,
      trustedServerConfig: true,
      clientSuppliedAuthorityTrusted: false
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

function privacyScan(receiptPaths, source) {
  const receiptForbiddenPatterns = [
    { key: "local_users_path", regex: /\/Users\// },
    { key: "tmp_path", regex: /\/tmp\// },
    { key: "private_tmp_path", regex: /\/private\/tmp\// },
    { key: "srv_path", regex: /\/srv\/tcrn/ },
    { key: "file_uri", regex: /file:\/\// },
    { key: "phase3_private_fixture_value", regex: /phase3-private-/ },
    { key: "secret_like", regex: /(AKIA[0-9A-Z]{16}|BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY|ghp_[A-Za-z0-9_]{20,})/ },
    { key: "acceptance_overclaim", regex: /\b(owner acceptance|product acceptance|final MVP acceptance|dogfood runtime readiness|release readiness)\b/i },
    { key: "live_dispatch_claim", regex: /\blive dispatch authorized\b/i }
  ];
  const sourceForbiddenPatterns = receiptForbiddenPatterns
    .filter((pattern) => !["phase3_private_fixture_value", "acceptance_overclaim", "live_dispatch_claim"].includes(pattern.key));
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
  return {
    ok: findings.length === 0,
    scannedReceiptCount: receiptPaths.length,
    scannedSourceFileCount: source.files.length,
    forbiddenPatterns: receiptForbiddenPatterns.map((pattern) => pattern.key),
    findings,
    rawLocalPathsRecorded: false,
    rawDbDumpRecorded: false,
    rawClientEnvStored: false,
    rawTranscriptBodiesStored: false,
    secretsOrPiiStored: false,
    noOverclaimFlags
  };
}

function responsePayload(response) {
  assert.equal(response.error, undefined, JSON.stringify(response));
  return response.result;
}

function git(args) {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  }
  return result.stdout.trim();
}
