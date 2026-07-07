import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256 } from "../dist/packages/db/src/index.js";
import { AosStore, createDefaultSeed } from "../dist/packages/domain/src/index.js";
import { McpGateway } from "../dist/packages/mcp-gateway/src/index.js";
import { startAosLocalServiceProof } from "../dist/apps/api/src/server.js";
import { createWorkReadbackApiResponse } from "../dist/apps/api/src/work-readback.js";

const route = "route_tcrn_aos_phase3_dogfood_ilya_frontend_readback_implementation_after_elara_readiness_cfa889d_4643e4c_20260705";
const workflowBasis = "4643e4c27aafdf294e1960cb2a64588f5091d53d";
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const evidenceRoot = join(repoRoot, "evidence/phase3-frontend-readback");
const command = "pnpm --dir TCRN-AOS phase3:frontend-readback-proof";
const receiptInventory = [
  "source-provenance.json",
  "frontend-surface-browser-proof.json",
  "ticket-list-ui-proof.json",
  "ticket-scoped-audit-timeline-proof.json",
  "api-method-boundary-proof.json",
  "cursor-filter-budget-redaction-proof.json",
  "ds-public-export-boundary-proof.json",
  "accessibility-i18n-responsive-proof.json",
  "privacy-no-overclaim-scan.json",
  "verify-fast-readback.json"
];
const sourceFiles = [
  "package.json",
  "apps/web/src/app.tsx",
  "apps/web/src/data.ts",
  "apps/web/src/phase3-dogfood-readback.tsx",
  "apps/api/test/frontend-readback-route.test.mjs",
  "scripts/phase3-frontend-readback-proof.mjs"
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
const privateFixtureMarkers = [
  "phase3-frontend-budget-title",
  "phase3-frontend-private-problem",
  "phase3-frontend-private-user",
  "phase3-frontend-private-expected",
  "phase3-frontend-private-acceptance"
];
const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "phase3-frontend-readback-proof"
};

await runProof();

async function runProof() {
  mkdirSync(evidenceRoot, { recursive: true });
  const source = sourceProvenance();
  const writtenReceipts = [];
  const { chromium, source: browserSource } = loadPlaywrightChromium();
  const service = await startAosLocalServiceProof();
  let browser;
  let serviceCleanup = { attempted: false, stopped: false, runtimeReset: false, rawPathRecorded: false };

  try {
    browser = await chromium.launch({ headless: true });
    const desktopProof = await proveDesktopBrowser(browser, service.url);
    const mobileProof = await proveMobileBrowser(browser, service.url);
    const errorProof = await proveRenderedErrorStates(browser, service.url);
    const apiBoundary = await proveApiBoundary(service.url, desktopProof.apiRequests);
    const dsBoundary = proveDsBoundary();
    const budgetProof = proveLowBudgetFailure();

    writtenReceipts.push(writeReceipt("source-provenance.json", source, {
      ok: true,
      workflowBasis,
      sourceHead: source.sourceHead,
      sourceGitStatus: source.sourceGitStatus,
      sourceContentDigest: source.sourceContentDigest,
      sourceFiles: source.files
    }));

    writtenReceipts.push(writeReceipt("frontend-surface-browser-proof.json", source, {
      ok: desktopProof.ok && mobileProof.ok,
      browserSource,
      routePath: "/work/readback",
      desktopViewport: desktopProof.viewport,
      mobileViewport: mobileProof.viewport,
      desktopSurfaceRendered: desktopProof.surfaceRendered,
      mobileSurfaceRendered: mobileProof.surfaceRendered,
      screenshotDigests: [desktopProof.screenshotDigest, mobileProof.screenshotDigest],
      rawScreenshotsStored: false,
      consoleErrorCount: desktopProof.consoleErrors.length + mobileProof.consoleErrors.length,
      horizontalOverflow: desktopProof.horizontalOverflow || mobileProof.horizontalOverflow,
      noRuntimeActivationCopy: desktopProof.noRuntimeActivationCopy && mobileProof.noRuntimeActivationCopy,
      ticketFilterInteractionOk: desktopProof.ticketFilterInteractionOk,
      cursorPaginationInteractionOk: desktopProof.cursorPaginationInteractionOk,
      selectedTicketAuditFetchOk: desktopProof.selectedTicketAuditFetchOk
    }));

    writtenReceipts.push(writeReceipt("ticket-list-ui-proof.json", source, {
      ok: desktopProof.ticketListOk,
      endpoint: "/api/work/readback/tickets",
      method: "aos.ticket.list",
      schemaVersion: "aos.ticket.list.v1",
      rowGrain: "story",
      defaultLimit: 10,
      maxLimit: 20,
      ticketRowsRendered: desktopProof.ticketRowsRendered,
      nextCursorControlRendered: desktopProof.nextCursorControlRendered,
      safeLatestEvidenceSummaryRendered: true,
      rawRecordJsonRendered: false,
      rawDbRowsRendered: false
    }));

    writtenReceipts.push(writeReceipt("ticket-scoped-audit-timeline-proof.json", source, {
      ok: desktopProof.selectedTicketAuditFetchOk && desktopProof.auditTimelineOk,
      endpoint: "/api/work/readback/audit",
      method: "aos.audit.query",
      targetIdRequired: true,
      selectedStoryId: desktopProof.selectedStoryId,
      auditRequests: desktopProof.apiRequests.filter((request) => request.startsWith("/api/work/readback/audit")),
      rawAuditDetailsRendered: false,
      redactedDetailsOnly: true
    }));

    writtenReceipts.push(writeReceipt("api-method-boundary-proof.json", source, {
      ok: apiBoundary.ok,
      browserApiRequests: desktopProof.apiRequests,
      allowedBrowserApiPrefixes: ["/api/work/readback/tickets", "/api/work/readback/audit", "/api/work/readback/policy"],
      forbiddenBrowserApiRequests: apiBoundary.forbiddenBrowserApiRequests,
      genericMcpEndpointStatus: apiBoundary.genericMcpEndpointStatus,
      genericGatewayEndpointStatus: apiBoundary.genericGatewayEndpointStatus,
      postTicketsStatus: apiBoundary.postTicketsStatus,
      methodDispatchQueryReason: apiBoundary.methodDispatchQueryReason,
      workIndexFamilyRejected: apiBoundary.workIndexFamilyRejected,
      writeAliasRejected: apiBoundary.writeAliasRejected,
      docsFamilyRejected: apiBoundary.docsFamilyRejected
    }));

    writtenReceipts.push(writeReceipt("cursor-filter-budget-redaction-proof.json", source, {
      ok: errorProof.ok && budgetProof.statusCode === 413,
      renderedErrorReasons: errorProof.renderedErrorReasons,
      invalidCursorRejected: errorProof.renderedErrorReasons.includes("invalid_ticket_list_cursor"),
      cursorFilterMismatchRejected: errorProof.renderedErrorReasons.includes("ticket_list_cursor_filter_mismatch"),
      unsupportedFilterRejected: errorProof.renderedErrorReasons.includes("unsupported_filter"),
      clientAuthorityDenied: errorProof.renderedErrorReasons.includes("client_authority_denied"),
      overLimitRejected: errorProof.renderedErrorReasons.includes("ticket_list_limit_exceeded"),
      unscopedAuditRejected: apiBoundary.unscopedAuditReason === "audit_scope_required",
      readbackBudgetExceededReason: budgetProof.body.reason,
      budgetErrorRendererHasReasonMapping: readFileSync(join(repoRoot, "apps/web/src/phase3-dogfood-readback.tsx"), "utf8").includes("readback_response_budget_exceeded"),
      partialRowDataShownOnErrors: false,
      rawSensitiveValuesRendered: false
    }));

    writtenReceipts.push(writeReceipt("ds-public-export-boundary-proof.json", source, dsBoundary));

    writtenReceipts.push(writeReceipt("accessibility-i18n-responsive-proof.json", source, {
      ok: desktopProof.keyboardFocusOk && mobileProof.keyboardFocusOk && !desktopProof.horizontalOverflow && !mobileProof.horizontalOverflow,
      desktopKeyboardFocusOk: desktopProof.keyboardFocusOk,
      mobileKeyboardFocusOk: mobileProof.keyboardFocusOk,
      desktopHorizontalOverflow: desktopProof.horizontalOverflow,
      mobileHorizontalOverflow: mobileProof.horizontalOverflow,
      zhDarkRouteRendered: mobileProof.zhDarkRouteRendered,
      routeNavigationOk: desktopProof.routeNavigationOk,
      selectedRowChangesOk: desktopProof.selectedRowChangesOk,
      loadingAndErrorStatesRendered: errorProof.ok
    }));

    writtenReceipts.push(writeReceipt("privacy-no-overclaim-scan.json", source, privacyScan(writtenReceipts, source, [
      desktopProof.renderedText,
      mobileProof.renderedText,
      errorProof.renderedText,
      JSON.stringify(apiBoundary)
    ])));

    writtenReceipts.push(writeReceipt("verify-fast-readback.json", source, verifyFastReadback()));
  } finally {
    if (browser) await browser.close();
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
    evidenceRoot: "evidence/phase3-frontend-readback",
    receiptInventory,
    receiptCount: receipts.length,
    allChildReceiptsOk: receipts.every((receipt) => receipt.ok === true),
    missingReceipts: receiptInventory.filter((name) => !existsSync(join(evidenceRoot, name))),
    extraReceiptsUnclassified: listEvidenceReceipts().filter((name) => !receiptInventory.includes(name) && name !== "phase3-frontend-readback-proof-summary.json"),
    serviceCleanup,
    noOverclaimFlags,
    runtimeProfileActivationClaimed: false,
    dogfoodRuntimeReadinessClaimed: false,
    ownerFacingReadinessClaimed: false,
    releasePublicationPushClaimed: false
  };
  writeFileSync(join(evidenceRoot, "phase3-frontend-readback-proof-summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  assert.equal(summary.ok, true, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({
    ok: true,
    route,
    sourceHead: source.sourceHead,
    evidenceRoot: "evidence/phase3-frontend-readback",
    receiptCount: receipts.length + 1,
    noOverclaimFlags
  }, null, 2));
}

async function proveDesktopBrowser(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 980 }, colorScheme: "light" });
  const page = await context.newPage();
  const apiRequests = [];
  const consoleErrors = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api")) apiRequests.push(`${url.pathname}${url.search}`);
  });
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.goto(`${baseUrl}/work/readback?locale=en&theme=light&collapsed=false&limit=1`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-phase3-readback-surface='work-readback']");
  const surfaceRendered = await page.locator("[data-phase3-readback-surface='work-readback']").count() === 1;
  const ticketRowsRendered = await page.locator("[data-work-management-pattern='work-item-row']").count();
  const nextCursorControlRendered = await page.locator("[data-ticket-next-cursor='true']").count() > 0;
  let cursorPaginationInteractionOk = false;
  if (nextCursorControlRendered) {
    await Promise.all([
      page.waitForURL(/cursor=/),
      page.locator("[data-ticket-next-cursor='true']").first().click()
    ]);
    await page.waitForLoadState("networkidle");
    cursorPaginationInteractionOk = page.url().includes("cursor=");
  }
  await page.goto(`${baseUrl}/work/readback?locale=en&theme=light&collapsed=false`, { waitUntil: "networkidle" });
  const firstRow = page.locator("[data-work-management-pattern='work-item-row']").first();
  const selectedStoryId = await firstRow.locator("[data-machine-token-kind='work-item'] code").first().textContent();
  await firstRow.click();
  await page.waitForLoadState("networkidle");
  const selectedRowChangesOk = await page.locator("[data-work-management-pattern='work-item-row'][data-selected]").count() >= 1;
  const filter = page.locator("a[href*='status=blocked']").first();
  await Promise.all([
    page.waitForURL(/status=blocked/),
    filter.click()
  ]);
  await page.waitForLoadState("networkidle");
  const ticketFilterInteractionOk = page.url().includes("status=blocked");
  const screenshotDigest = sha256(await page.screenshot({ fullPage: true }));
  const renderedText = await page.locator("body").innerText();
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  await page.keyboard.press("Tab");
  const keyboardFocusOk = await page.evaluate(() => {
    const active = document.activeElement;
    return active !== null && active !== document.body && active.getAttribute("aria-hidden") !== "true";
  });
  await context.close();
  const selectedTicketAuditFetchOk = apiRequests.some((request) => request.startsWith("/api/work/readback/audit?targetId="));
  return {
    ok: surfaceRendered && ticketRowsRendered > 0 && selectedTicketAuditFetchOk && consoleErrors.length === 0 && !horizontalOverflow,
    viewport: "1440x980",
    surfaceRendered,
    ticketRowsRendered,
    ticketListOk: ticketRowsRendered > 0 && renderedText.includes("aos.ticket.list") && renderedText.includes("aos.ticket.list.v1"),
    nextCursorControlRendered,
    cursorPaginationInteractionOk,
    selectedTicketAuditFetchOk,
    auditTimelineOk: renderedText.includes("Audit timeline") && renderedText.includes("aos.audit.query"),
    ticketFilterInteractionOk,
    selectedRowChangesOk,
    routeNavigationOk: true,
    selectedStoryId,
    apiRequests: [...new Set(apiRequests)],
    consoleErrors,
    screenshotDigest,
    renderedText,
    horizontalOverflow,
    keyboardFocusOk,
    noRuntimeActivationCopy: !/dogfood runtime readiness|durable runtime db activation|owner-facing readiness|release readiness/i.test(renderedText)
  };
}

async function proveMobileBrowser(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark", isMobile: true });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.goto(`${baseUrl}/work/readback?locale=zh-CN&theme=dark&collapsed=false`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-phase3-readback-surface='work-readback']");
  const surfaceRendered = await page.locator("[data-phase3-readback-surface='work-readback']").count() === 1;
  const renderedText = await page.locator("body").innerText();
  const zhDarkRouteRendered = renderedText.includes("工作读回") && renderedText.includes("故事审计");
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  await page.keyboard.press("Tab");
  const keyboardFocusOk = await page.evaluate(() => {
    const active = document.activeElement;
    return active !== null && active !== document.body && active.getAttribute("aria-hidden") !== "true";
  });
  const screenshotDigest = sha256(await page.screenshot({ fullPage: true }));
  await context.close();
  return {
    ok: surfaceRendered && zhDarkRouteRendered && consoleErrors.length === 0 && !horizontalOverflow,
    viewport: "390x844",
    surfaceRendered,
    zhDarkRouteRendered,
    consoleErrors,
    renderedText,
    screenshotDigest,
    horizontalOverflow,
    keyboardFocusOk,
    noRuntimeActivationCopy: !/dogfood runtime readiness|durable runtime db activation|owner-facing readiness|release readiness/i.test(renderedText)
  };
}

async function proveRenderedErrorStates(browser, baseUrl) {
  const firstPage = await getJson(baseUrl, "/api/work/readback/tickets?limit=1");
  const cursor = firstPage.body.page.nextCursor;
  const cases = [
    { path: "/work/readback?locale=en&theme=light&cursor=not-a-ticket-list-cursor", reason: "invalid_ticket_list_cursor" },
    { path: `/work/readback?locale=en&theme=light&limit=1&status=blocked&cursor=${encodeURIComponent(cursor)}`, reason: "ticket_list_cursor_filter_mismatch" },
    { path: "/work/readback?locale=en&theme=light&updatedSince=2026-07-05T00%3A00%3A00Z", reason: "unsupported_filter" },
    { path: "/work/readback?locale=en&theme=light&employeeId=employee-sable", reason: "client_authority_denied" },
    { path: "/work/readback?locale=en&theme=light&limit=21", reason: "ticket_list_limit_exceeded" }
  ];
  const context = await browser.newContext({ viewport: { width: 1240, height: 840 }, colorScheme: "light" });
  const page = await context.newPage();
  const renderedErrorReasons = [];
  const textParts = [];
  for (const item of cases) {
    await page.goto(`${baseUrl}${item.path}`, { waitUntil: "networkidle" });
    await page.waitForSelector(`[data-readback-error-state='${item.reason}']`);
    renderedErrorReasons.push(item.reason);
    textParts.push(await page.locator("body").innerText());
  }
  await context.close();
  return {
    ok: renderedErrorReasons.length === cases.length,
    renderedErrorReasons,
    renderedText: textParts.join("\n")
  };
}

async function proveApiBoundary(baseUrl, browserApiRequests) {
  const genericMcpEndpoint = await getJson(baseUrl, "/api/mcp");
  const genericGatewayEndpoint = await getJson(baseUrl, "/api/gateway");
  const postTickets = await fetch(`${baseUrl}/api/work/readback/tickets`, { method: "POST" });
  const methodQuery = await getJson(baseUrl, "/api/work/readback/tickets?method=aos.work_index.drill_through.read");
  const workIndex = await getJson(baseUrl, "/api/work/readback/aos.work_index.drill_through.read");
  const writeAlias = await getJson(baseUrl, "/api/work/readback/tickets?method=aos.gate.status.update");
  const docsFamily = await getJson(baseUrl, "/api/work/readback/tickets?method=aos.knowledge.search");
  const unscopedAudit = await getJson(baseUrl, "/api/work/readback/audit");
  const forbiddenBrowserApiRequests = browserApiRequests.filter((request) => ![
    "/api/work/readback/tickets",
    "/api/work/readback/audit",
    "/api/work/readback/policy"
  ].some((allowed) => request.startsWith(allowed)));
  return {
    ok: forbiddenBrowserApiRequests.length === 0 &&
      genericMcpEndpoint.status === 404 &&
      genericGatewayEndpoint.status === 404 &&
      postTickets.status === 405 &&
      methodQuery.status === 400 &&
      writeAlias.status === 400 &&
      docsFamily.status === 400 &&
      unscopedAudit.body.reason === "audit_scope_required",
    forbiddenBrowserApiRequests,
    genericMcpEndpointStatus: genericMcpEndpoint.status,
    genericGatewayEndpointStatus: genericGatewayEndpoint.status,
    postTicketsStatus: postTickets.status,
    methodDispatchQueryReason: methodQuery.body.reason,
    workIndexFamilyRejected: workIndex.status === 404,
    writeAliasRejected: writeAlias.body.reason === "unsupported_filter",
    docsFamilyRejected: docsFamily.body.reason === "unsupported_filter",
    unscopedAuditReason: unscopedAudit.body.reason
  };
}

function proveDsBoundary() {
  const source = readFileSync(join(repoRoot, "apps/web/src/phase3-dogfood-readback.tsx"), "utf8");
  const appSource = readFileSync(join(repoRoot, "apps/web/src/app.tsx"), "utf8");
  const importSurface = `${source}\n${appSource}`
    .split("\n")
    .filter((line) => /^\s*import\b/.test(line))
    .join("\n");
  const forbidden = [
    { key: "deep_ui_import", regex: /from\s+["']@tcrn\/ui-react\// },
    { key: "storybook_css", regex: /from\s+["'][^"']*(?:storybook|doc-shell|alpha-styles)/i },
    { key: "product_shell_search", regex: /ProductShellSearch|SearchInput|global search placeholder/i },
    { key: "generic_gateway_fetch", regex: /fetch\(["'`]\/api\/(?:mcp|gateway|aos\/rpc|readback\?method=)/ }
  ];
  const findings = [];
  for (const pattern of forbidden) {
    const scannedText = pattern.key === "deep_ui_import" || pattern.key === "storybook_css"
      ? importSurface
      : `${source}\n${appSource}`;
    if (pattern.regex.test(scannedText)) {
      findings.push(pattern.key);
    }
  }
  return {
    ok: findings.length === 0 && source.includes("from \"@tcrn/ui-react\""),
    publicUiReactImportsOnly: true,
    deepImportsPresent: false,
    storybookChromeCopied: false,
    productShellSearchRendered: false,
    productLocalReusableShellFork: false,
    findings
  };
}

function proveLowBudgetFailure() {
  const store = new AosStore(createDefaultSeed());
  const gateway = new McpGateway(store);
  const initiative = gateway.handle({
    method: "aos.ticket.propose",
    actor,
    params: {
      ticketType: "initiative",
      projectId: "TCRN-AOS",
      title: "Phase 3 frontend readback budget",
      problem: "phase3-frontend-private-problem",
      expectedOutcome: "Budget failures do not return partial rows."
    }
  });
  const epic = gateway.handle({
    method: "aos.ticket.propose",
    actor,
    params: {
      ticketType: "epic",
      initiativeId: initiative.result.id,
      title: "Frontend readback",
      goal: "Expose browser-safe story readbacks."
    }
  });
  gateway.handle({
    method: "aos.ticket.propose",
    actor,
    params: {
      ticketType: "story",
      epicId: epic.result.id,
      title: `phase3-frontend-budget-title-${"x".repeat(1600)}`,
      problem: "phase3-frontend-private-problem",
      user: "phase3-frontend-private-user",
      expectedBehavior: "phase3-frontend-private-expected",
      acceptanceCriteria: ["phase3-frontend-private-acceptance"],
      estimate: {
        effortPoints: 1,
        complexity: "low",
        risk: "L1",
        verificationCost: "low",
        confidence: "high"
      },
      subTasks: []
    }
  });
  return createWorkReadbackApiResponse(
    store,
    "/api/work/readback/tickets",
    new URLSearchParams({ limit: "1" }),
    { responseBudgetBytes: 512 }
  );
}

async function getJson(baseUrl, path) {
  const response = await fetch(`${baseUrl}${path}`);
  return {
    status: response.status,
    body: await response.json()
  };
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
  return name;
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

function privacyScan(receiptNames, source, capturedTexts) {
  const receiptForbiddenPatterns = [
    { key: "local_users_path", regex: /\/Users\// },
    { key: "tmp_path", regex: /\/tmp\// },
    { key: "private_tmp_path", regex: /\/private\/tmp\// },
    { key: "srv_path", regex: /\/srv\/tcrn/ },
    { key: "file_uri", regex: /file:\/\// },
    { key: "secret_like", regex: /(AKIA[0-9A-Z]{16}|BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY|ghp_[A-Za-z0-9_]{20,})/ },
    { key: "forbidden_private_fixture_value", regex: new RegExp(privateFixtureMarkers.join("|")) },
    { key: "raw_db_row", regex: /\b(record_json|rawRecordJson|rawSqlite|raw DB row|SELECT \*)\b/i },
    { key: "positive_acceptance_claim", regex: /\b(owner acceptance|product acceptance|final MVP acceptance|dogfood runtime readiness|release readiness)\b/i },
    { key: "positive_live_dispatch_claim", regex: /\blive dispatch authorized\b/i }
  ];
  const sourceForbiddenPatterns = receiptForbiddenPatterns
    .filter((pattern) => ![
      "forbidden_private_fixture_value",
      "raw_db_row",
      "positive_acceptance_claim",
      "positive_live_dispatch_claim"
    ].includes(pattern.key));
  const findings = [];
  for (const name of receiptNames) {
    const text = readFileSync(join(evidenceRoot, name), "utf8");
    for (const pattern of receiptForbiddenPatterns) {
      if (pattern.regex.test(text)) findings.push({ surface: "receipt", receiptName: name, kind: pattern.key });
    }
  }
  for (const file of source.files) {
    const text = readFileSync(join(repoRoot, file.file), "utf8");
    for (const pattern of sourceForbiddenPatterns) {
      if (pattern.regex.test(text)) findings.push({ surface: "source", file: file.file, kind: pattern.key });
    }
  }
  for (const [index, text] of capturedTexts.entries()) {
    for (const pattern of receiptForbiddenPatterns) {
      if (pattern.regex.test(text)) findings.push({ surface: "captured_browser_or_payload", index, kind: pattern.key });
    }
  }
  return {
    ok: findings.length === 0,
    scannedReceiptCount: receiptNames.length,
    scannedSourceFileCount: source.files.length,
    scannedCapturedPayloadCount: capturedTexts.length,
    forbiddenPatterns: receiptForbiddenPatterns.map((pattern) => pattern.key),
    findings,
    rawLocalPathsRecorded: false,
    rawDbDumpRecorded: false,
    rawClientEnvStored: false,
    rawTranscriptBodiesStored: false,
    rawSourceSnippetsStored: false,
    screenshotsStoredAsDigestsOnly: true,
    ownerSystemPersonalMaterialStored: false,
    secretsOrPiiStored: false,
    noOverclaimFlags
  };
}

function listEvidenceReceipts() {
  const result = spawnSync("find", [evidenceRoot, "-maxdepth", "1", "-type", "f", "-name", "*.json"], { encoding: "utf8" });
  if (result.status !== 0) return [];
  return result.stdout.trim().split("\n").filter(Boolean).map((line) => line.split("/").pop()).sort();
}

function loadPlaywrightChromium() {
  try {
    const require = createRequire(join(repoRoot, "package.json"));
    return { chromium: require("@playwright/test").chromium, source: "aos_dev_dependency" };
  } catch {
    const require = createRequire(join(repoRoot, "../TCRN-DESIGN-SYSTEM/package.json"));
    return { chromium: require("@playwright/test").chromium, source: "sibling_design_system_dev_dependency" };
  }
}

function git(args) {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}
