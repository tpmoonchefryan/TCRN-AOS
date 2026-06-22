import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { startAosLocalServiceProof } from "../dist/apps/api/src/server.js";

const repoRoot = process.cwd();
const route = "route_tcrn_aos_59ah_owner_trial_service_backed_frontend_implementation_after_talia_story_breakdown";
const sourceHead = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const evidenceDir = join(repoRoot, "evidence", "aos-owner-trial-service-backed-frontend", sourceHead);
const summaryPath = join(evidenceDir, "summary.json");
const latestSummaryPath = join(repoRoot, "evidence", "aos-owner-trial-service-backed-frontend-summary.json");
const markdownPath = join(repoRoot, "evidence", "aos-owner-trial-service-backed-frontend-proof.md");
const checkCurrentSource = process.argv.includes("--check-current-source");
const sourceFreshnessReadback = inspectSourceContentDigest();
const viewports = [
  { label: "desktop-1440x900", width: 1440, height: 900 },
  { label: "mobile-390x844", width: 390, height: 844 }
];

await mkdir(evidenceDir, { recursive: true });

if (checkCurrentSource) {
  const retained = JSON.parse(readFileSync(latestSummaryPath, "utf8"));
  const retainedDigest = retained.sourceFreshnessReadback?.sourceContentDigest;
  const ok = retainedDigest === sourceFreshnessReadback.sourceContentDigest;
  console.log(JSON.stringify({
    ok,
    route,
    sourceHead,
    sourceContentDigest: sourceFreshnessReadback.sourceContentDigest,
    retainedDigest,
    strategy: sourceFreshnessReadback.strategy,
    latestSummaryPath: relative(repoRoot, latestSummaryPath)
  }, null, 2));
  if (!ok) {
    process.exit(1);
  }
  process.exit(0);
}

const designSystemRequire = createRequire(join(repoRoot, "..", "TCRN-Design-System", "package.json"));
let playwrightPath;
try {
  playwrightPath = designSystemRequire.resolve("@playwright/test");
} catch {
  throw new Error("design_system_playwright_tooling_unavailable");
}

const playwright = await import(pathToFileURL(playwrightPath).href);
const { chromium } = playwright.default ?? playwright;
const service = await startAosLocalServiceProof();
let browser;
let closed = false;

try {
  const apiPayload = await fetch(`${service.url}/api/cockpit`).then((response) => response.json());
  const workRows = apiPayload.model?.workstreams?.flatMap((group) => group.rows) ?? [];
  const firstStoryId = workRows[0]?.storyId ?? "";
  const secondStoryId = workRows[1]?.storyId ?? "";
  const secondStoryTitle = workRows[1]?.title ?? "";
  const selectedPayload = await fetch(`${service.url}/api/cockpit?selectedType=story&selectedId=${encodeURIComponent(secondStoryId)}`).then((response) => response.json());
  const apiContract = inspectApiContract(apiPayload, selectedPayload, { firstStoryId, secondStoryId });

  browser = await chromium.launch();
  const pageErrors = [];
  const consoleErrors = [];
  const requestFailures = [];
  const viewportReadbacks = [];

  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1
    });
    const page = await context.newPage();
    const cockpitApiCalls = [];
    page.on("pageerror", (error) => pageErrors.push(`${viewport.label}: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(`${viewport.label}: ${message.text()}`);
      }
    });
    page.on("request", (request) => {
      if (request.url().includes("/api/cockpit")) {
        cockpitApiCalls.push(request.url());
      }
    });
    page.on("requestfailed", (request) => {
      requestFailures.push(`${viewport.label}: ${request.url()} ${request.failure()?.errorText ?? "request_failed"}`);
    });

    await page.goto(`${service.url}/operations-cockpit.html`, { waitUntil: "domcontentloaded" });
    await waitForReady(page, apiPayload.serviceReadModel.schemaVersion, workRows.length);
    const initialState = await readServiceState(page);

    await page.click("[data-refresh-readback]");
    await page.waitForFunction((previousCount) => {
      const shell = document.querySelector("[data-surface='operations-cockpit']");
      return Number(shell?.getAttribute("data-service-refresh-count") ?? "0") > previousCount
        && shell?.getAttribute("data-service-refresh-state") === "ok";
    }, initialState.refreshCount, { timeout: 5000 });
    const afterRefreshState = await readServiceState(page);

    await page.fill("[data-work-search]", secondStoryTitle.split(" ").slice(0, 3).join(" "));
    await page.waitForFunction((expectedId) => {
      const visibleRows = Array.from(document.querySelectorAll("[data-work-row]")).filter((row) => !row.hidden);
      return visibleRows.length === 1 && visibleRows[0]?.getAttribute("data-row-id") === expectedId;
    }, secondStoryId, { timeout: 5000 });
    const searchState = await readWorkIndexState(page);

    await page.fill("[data-work-search]", "zzzz no matching owner trial row");
    await page.waitForFunction(() => {
      const visibleRows = Array.from(document.querySelectorAll("[data-work-row]")).filter((row) => !row.hidden);
      const emptyState = document.querySelector("[data-empty-state]");
      return visibleRows.length === 0 && emptyState && !emptyState.hidden;
    }, { timeout: 5000 });
    const zeroMatchState = await readWorkIndexState(page);

    await page.fill("[data-work-search]", "");
    await page.waitForFunction((expectedCount) => {
      return Array.from(document.querySelectorAll("[data-work-row]")).filter((row) => !row.hidden).length === expectedCount;
    }, workRows.length, { timeout: 5000 });
    await page.click(`[data-work-row][data-row-id="${secondStoryId}"]`);
    await page.waitForFunction((expectedId) => {
      const shell = document.querySelector("[data-surface='operations-cockpit']");
      const drawer = document.querySelector("[data-region='detail-drawer']");
      return shell?.getAttribute("data-service-selected-story-id") === expectedId
        && shell?.getAttribute("data-service-detail-id") === expectedId
        && shell?.getAttribute("data-service-selected-detail-round-trip") === "true"
        && drawer?.getAttribute("data-service-detail-id") === expectedId
        && !drawer?.classList.contains("closed");
    }, secondStoryId, { timeout: 5000 });
    const selectedDetailState = await readServiceState(page);

    await page.click("[data-close-detail]");
    await page.waitForFunction(() => document.querySelector("[data-region='detail-drawer']")?.classList.contains("closed") === true, { timeout: 5000 });
    const closedDetailState = await readServiceState(page);

    const screenshotPath = join(evidenceDir, `${viewport.label}-owner-trial-service-backed.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    const screenshotBody = await readFile(screenshotPath);
    const documentReadback = await page.evaluate(() => {
      const normalizeText = (value) => value.replace(/\s+/g, " ").trim();
      const shell = document.querySelector("[data-surface='operations-cockpit']");
      const bodyText = document.body.innerText;
      const idElements = Array.from(document.querySelectorAll("[id]"));
      const idCounts = new Map();
      for (const element of idElements) {
        idCounts.set(element.id, (idCounts.get(element.id) ?? 0) + 1);
      }
      const duplicateIds = Array.from(idCounts.entries())
        .filter(([, count]) => count > 1)
        .map(([id, count]) => ({ id, count }));
      const ariaReferenceFailures = [];
      for (const element of Array.from(document.querySelectorAll("[aria-describedby], [aria-labelledby]"))) {
        for (const attribute of ["aria-describedby", "aria-labelledby"]) {
          const ids = (element.getAttribute(attribute) ?? "").split(/\s+/).filter(Boolean);
          for (const id of ids) {
            const targetCount = idCounts.get(id) ?? 0;
            if (targetCount !== 1) {
              ariaReferenceFailures.push({ tag: element.tagName.toLowerCase(), attribute, id, targetCount });
            }
          }
        }
      }
      const disabledControlFailures = [];
      const disabledControls = Array.from(document.querySelectorAll("button:disabled, select:disabled, input:disabled, textarea:disabled, [aria-disabled='true']"));
      for (const element of disabledControls) {
        const dataDisabledReason = element.getAttribute("data-disabled-reason")?.trim() ?? "";
        const title = element.getAttribute("title")?.trim() ?? "";
        const describedbyIds = (element.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);
        const resolvedText = normalizeText(describedbyIds
          .map((id) => idElements.find((candidate) => candidate.id === id)?.textContent?.trim() ?? "")
          .filter(Boolean)
          .join(" "));
        const failures = [];
        if (!dataDisabledReason) failures.push("missing_data_disabled_reason");
        if (!title) failures.push("missing_title");
        if (describedbyIds.length === 0) failures.push("missing_aria_describedby");
        if (describedbyIds.some((id) => idCounts.get(id) !== 1)) failures.push("bad_aria_target_count");
        if (!resolvedText) failures.push("unresolved_description");
        if (resolvedText && dataDisabledReason && normalizeText(resolvedText) !== normalizeText(dataDisabledReason)) failures.push("description_mismatch");
        if (failures.length > 0) {
          disabledControlFailures.push({
            tag: element.tagName.toLowerCase(),
            label: normalizeText(element.textContent ?? ""),
            dataDisabledReason,
            title,
            ariaDescribedBy: describedbyIds,
            resolvedText,
            failures
          });
        }
      }
      const productVisibleText = [
        bodyText,
        ...Array.from(document.querySelectorAll("[aria-label], [title]")).flatMap((element) => [
          element.getAttribute("aria-label") ?? "",
          element.getAttribute("title") ?? ""
        ])
      ].join(" ");
      const internalCopyPattern = /\b(readback|checkpoint|package-runtime|functional contract|held for later|unavailable in this route|proof required|external proof required)\b/i;
      const enumLeakPattern = /\b(external_proof_required|not_claimed|release_proof_required|owner_intent_required|record_participant_position|open_evidence_metadata|review_required)\b/i;
      return {
        serviceBacked: shell?.getAttribute("data-service-backed") ?? "",
        bootstrapState: shell?.getAttribute("data-service-bootstrap-state") ?? "",
        refreshState: shell?.getAttribute("data-service-refresh-state") ?? "",
        refreshCount: Number(shell?.getAttribute("data-service-refresh-count") ?? "0"),
        ownerTrialReadinessLane: shell?.getAttribute("data-owner-trial-readiness-lane") ?? "",
        selectedDetailRoundTrip: shell?.getAttribute("data-service-selected-detail-round-trip") ?? "",
        duplicateIds,
        ariaReferenceFailures,
        disabledControlCount: disabledControls.length,
        disabledControlFailures,
        internalCopyHits: productVisibleText.match(internalCopyPattern)?.[0] ? [productVisibleText.match(internalCopyPattern)[0]] : [],
        enumLeakHits: productVisibleText.match(enumLeakPattern)?.[0] ? [productVisibleText.match(enumLeakPattern)[0]] : [],
        noOverclaimHits: [
          "product accepted",
          "final mvp accepted",
          "release ready",
          "deployment ready",
          "live dispatch enabled",
          "owner intent executed"
        ].filter((phrase) => productVisibleText.toLowerCase().includes(phrase)),
        bodyHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth || document.body.scrollWidth > window.innerWidth,
        bodyTextIncludesServiceStatus: bodyText.includes("service API read"),
        bodyTextIncludesUnavailableActions: disabledControls.length >= 4
          && disabledControls.some((element) => /Gate request held|Stage detail held|Role detail held|Columns held|Evidence detail held/.test(element.textContent ?? "")),
        visibleRowCount: Array.from(document.querySelectorAll("[data-work-row]")).filter((row) => !row.hidden).length,
        totalRowCount: document.querySelectorAll("[data-work-row]").length,
        viewportWidth: window.innerWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth
      };
    });

    viewportReadbacks.push({
      ...viewport,
      apiCallCount: cockpitApiCalls.length,
      apiCalls: cockpitApiCalls.map((url) => url.replace(service.url, "")),
      initialState,
      afterRefreshState,
      searchState,
      zeroMatchState,
      selectedDetailState,
      closedDetailState,
      documentReadback,
      screenshot: {
        path: relative(repoRoot, screenshotPath),
        sha256: createHash("sha256").update(screenshotBody).digest("hex"),
        bytes: screenshotBody.byteLength
      }
    });
    await context.close();
  }

  const closeResult = await service.close();
  closed = closeResult.stopped && closeResult.runtimeReset;
  const ok = closed
    && apiContract.ok
    && viewportReadbacks.every((readback) => readback.apiCallCount >= 3)
    && viewportReadbacks.every((readback) => readback.initialState.bootstrapState === "ready")
    && viewportReadbacks.every((readback) => readback.afterRefreshState.refreshCount > readback.initialState.refreshCount)
    && viewportReadbacks.every((readback) => readback.searchState.visibleRowCount === 1)
    && viewportReadbacks.every((readback) => readback.zeroMatchState.visibleRowCount === 0 && readback.zeroMatchState.emptyStateVisible)
    && viewportReadbacks.every((readback) => readback.selectedDetailState.selectedStoryId === secondStoryId)
    && viewportReadbacks.every((readback) => readback.selectedDetailState.detailId === secondStoryId)
    && viewportReadbacks.every((readback) => readback.selectedDetailState.selectedDetailRoundTrip === "true")
    && viewportReadbacks.every((readback) => readback.closedDetailState.drawerClosed === true)
    && viewportReadbacks.every((readback) => readback.documentReadback.serviceBacked === "true")
    && viewportReadbacks.every((readback) => readback.documentReadback.bootstrapState === "ready")
    && viewportReadbacks.every((readback) => readback.documentReadback.ownerTrialReadinessLane === "service-backed")
    && viewportReadbacks.every((readback) => readback.documentReadback.duplicateIds.length === 0)
    && viewportReadbacks.every((readback) => readback.documentReadback.ariaReferenceFailures.length === 0)
    && viewportReadbacks.every((readback) => readback.documentReadback.disabledControlFailures.length === 0)
    && viewportReadbacks.every((readback) => readback.documentReadback.internalCopyHits.length === 0)
    && viewportReadbacks.every((readback) => readback.documentReadback.enumLeakHits.length === 0)
    && viewportReadbacks.every((readback) => readback.documentReadback.noOverclaimHits.length === 0)
    && viewportReadbacks.every((readback) => readback.documentReadback.bodyHorizontalOverflow === false)
    && viewportReadbacks.every((readback) => readback.documentReadback.bodyTextIncludesServiceStatus)
    && viewportReadbacks.every((readback) => readback.documentReadback.bodyTextIncludesUnavailableActions)
    && pageErrors.length === 0
    && consoleErrors.length === 0
    && requestFailures.length === 0;

  const summary = {
    ok,
    route,
    sourceHead,
    sourceFreshnessReadback,
    serviceLifecycle: {
      loopbackOnly: true,
      ephemeralPort: true,
      stopped: closed
    },
    apiContract,
    frontendStories: {
      serviceBackedReadModelApi: apiContract.ok,
      serviceDrivenBootstrap: viewportReadbacks.every((readback) => readback.initialState.bootstrapState === "ready"),
      refreshAndHealthReadback: viewportReadbacks.every((readback) => readback.afterRefreshState.refreshCount > readback.initialState.refreshCount),
      workIndexSearchFilterSelection: viewportReadbacks.every((readback) => readback.searchState.visibleRowCount === 1 && readback.zeroMatchState.emptyStateVisible),
      detailRoundTrip: viewportReadbacks.every((readback) => readback.selectedDetailState.detailId === secondStoryId && readback.closedDetailState.drawerClosed),
      unavailableActionLane: viewportReadbacks.every((readback) => readback.documentReadback.disabledControlFailures.length === 0),
      responsiveProductDesignCleanup: viewportReadbacks.every((readback) => readback.documentReadback.bodyHorizontalOverflow === false),
      retainedBrowserProof: viewportReadbacks.length === viewports.length
    },
    viewportReadbacks,
    browserHealth: {
      pageErrors,
      consoleErrors,
      requestFailures
    },
    noOverclaim: {
      productUiAcceptance: false,
      productDesignAcceptance: false,
      productAcceptance: false,
      finalMvpAcceptance: false,
      ownerFinalAcceptance: false,
      phaseAcceptance: false,
      releasePublicationReadiness: false,
      ownerVisibleFreshness: false,
      ownerIntentExecution: false,
      liveDispatch: false,
      parentGoalCompletion: false
    }
  };

  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  await writeFile(latestSummaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  await writeFile(markdownPath, markdownReceipt(summary));
  console.log(JSON.stringify({
    ok,
    route,
    sourceHead,
    apiContract: {
      ok: apiContract.ok,
      ownerTrialSchema: apiContract.ownerTrialSchema,
      workRowCount: apiContract.workRowCount,
      firstStoryId,
      secondStoryId,
      secondStoryRoundTrip: apiContract.secondStoryRoundTrip,
      disabledActionCount: apiContract.disabledActionCount
    },
    viewportCount: viewportReadbacks.length,
    apiCallCounts: viewportReadbacks.map((readback) => ({ label: readback.label, count: readback.apiCallCount })),
    searchAndSelection: viewportReadbacks.map((readback) => ({
      label: readback.label,
      searchVisibleRows: readback.searchState.visibleRowCount,
      zeroMatchVisibleRows: readback.zeroMatchState.visibleRowCount,
      zeroMatchEmptyVisible: readback.zeroMatchState.emptyStateVisible,
      selectedStoryId: readback.selectedDetailState.selectedStoryId,
      detailId: readback.selectedDetailState.detailId,
      detailClosed: readback.closedDetailState.drawerClosed
    })),
    accessibilityFailures: viewportReadbacks.flatMap((readback) => [
      ...readback.documentReadback.duplicateIds,
      ...readback.documentReadback.ariaReferenceFailures,
      ...readback.documentReadback.disabledControlFailures
    ]),
    internalCopyHits: viewportReadbacks.flatMap((readback) => readback.documentReadback.internalCopyHits),
    enumLeakHits: viewportReadbacks.flatMap((readback) => readback.documentReadback.enumLeakHits),
    noOverclaimHits: viewportReadbacks.flatMap((readback) => readback.documentReadback.noOverclaimHits),
    bodyHorizontalOverflowCount: viewportReadbacks.filter((readback) => readback.documentReadback.bodyHorizontalOverflow).length,
    pageErrorCount: pageErrors.length,
    consoleErrorCount: consoleErrors.length,
    requestFailureCount: requestFailures.length,
    screenshots: viewportReadbacks.map((readback) => readback.screenshot),
    summaryPath: relative(repoRoot, summaryPath),
    latestSummaryPath: relative(repoRoot, latestSummaryPath),
    markdownPath: relative(repoRoot, markdownPath)
  }, null, 2));

  if (!ok) {
    process.exit(1);
  }
} finally {
  if (browser) {
    await browser.close().catch(() => undefined);
  }
  if (!closed) {
    await service.close().catch(() => undefined);
  }
}

async function waitForReady(page, schemaVersion, rowCount) {
  await page.waitForFunction(({ schemaVersion, rowCount }) => {
    const shell = document.querySelector("[data-surface='operations-cockpit']");
    return shell?.getAttribute("data-service-model-schema") === schemaVersion
      && shell?.getAttribute("data-service-read-model-source") === "service_api_read"
      && shell?.getAttribute("data-service-bootstrap-state") === "ready"
      && Number(shell?.getAttribute("data-service-work-row-count") ?? "0") === rowCount
      && Number(shell?.getAttribute("data-service-refresh-count") ?? "0") >= 1;
  }, { schemaVersion, rowCount }, { timeout: 5000 });
}

async function readServiceState(page) {
  return page.evaluate(() => {
    const shell = document.querySelector("[data-surface='operations-cockpit']");
    const drawer = document.querySelector("[data-region='detail-drawer']");
    return {
      bootstrapState: shell?.getAttribute("data-service-bootstrap-state") ?? "",
      refreshState: shell?.getAttribute("data-service-refresh-state") ?? "",
      refreshCount: Number(shell?.getAttribute("data-service-refresh-count") ?? "0"),
      lastReadAt: shell?.getAttribute("data-service-last-read-at") ?? "",
      selectedStoryId: shell?.getAttribute("data-service-selected-story-id") ?? "",
      detailId: shell?.getAttribute("data-service-detail-id") ?? "",
      detailType: shell?.getAttribute("data-service-detail-type") ?? "",
      selectedDetailRoundTrip: shell?.getAttribute("data-service-selected-detail-round-trip") ?? "",
      ownerTrialReadinessLane: shell?.getAttribute("data-owner-trial-readiness-lane") ?? "",
      drawerDetailId: drawer?.getAttribute("data-service-detail-id") ?? "",
      drawerClosed: drawer?.classList.contains("closed") ?? false
    };
  });
}

async function readWorkIndexState(page) {
  return page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("[data-work-row]"));
    const visibleRows = rows.filter((row) => !row.hidden);
    const emptyState = document.querySelector("[data-empty-state]");
    return {
      totalRowCount: rows.length,
      visibleRowCount: visibleRows.length,
      visibleRowIds: visibleRows.map((row) => row.getAttribute("data-row-id") ?? ""),
      apiSourcedRowCount: rows.filter((row) => row.getAttribute("data-service-row-source") === "api").length,
      emptyStateVisible: emptyState ? !emptyState.hidden : false
    };
  });
}

function inspectApiContract(apiPayload, selectedPayload, expected) {
  const serviceReadModel = apiPayload.serviceReadModel;
  const ownerTrial = apiPayload.ownerTrial;
  const workRows = apiPayload.model?.workstreams?.flatMap((group) => group.rows) ?? [];
  const disabledActions = ownerTrial?.readinessLane?.disabledActions ?? [];
  const secondStoryRoundTrip = selectedPayload?.serviceReadModel?.surfaces?.workIndex?.selectedStoryId === expected.secondStoryId
    && selectedPayload?.serviceReadModel?.surfaces?.detail?.selectedId === expected.secondStoryId
    && selectedPayload?.model?.detailPanel?.selectedId === expected.secondStoryId;
  const ok = apiPayload.ok === true
    && apiPayload.serviceBacked === true
    && serviceReadModel?.schemaVersion === "aos.cockpit.service_read_model.v1"
    && serviceReadModel?.source === "service_api_read"
    && ownerTrial?.schemaVersion === "aos.owner_trial_service_frontend.v1"
    && ownerTrial?.readinessLane?.serviceBackedState === true
    && ownerTrial?.nonClaims?.productAcceptance === false
    && ownerTrial?.nonClaims?.parentGoalCompletion === false
    && workRows.length >= 2
    && serviceReadModel?.surfaces?.workIndex?.rowCount === workRows.length
    && serviceReadModel?.surfaces?.gate?.autoExecutableCount === 0
    && disabledActions.length >= 4
    && disabledActions.every((action) => action.reason && action.label)
    && secondStoryRoundTrip
    && apiPayload.boundaries?.productAcceptance === false
    && apiPayload.boundaries?.ownerIntentExecution === false
    && apiPayload.boundaries?.liveDispatch === false;
  return {
    ok,
    schemaVersion: serviceReadModel?.schemaVersion ?? "",
    ownerTrialSchema: ownerTrial?.schemaVersion ?? "",
    workRowCount: workRows.length,
    selectedStoryId: serviceReadModel?.surfaces?.workIndex?.selectedStoryId ?? "",
    firstStoryId: expected.firstStoryId,
    secondStoryId: expected.secondStoryId,
    secondStoryRoundTrip,
    disabledActionCount: disabledActions.length,
    disabledActions,
    productAcceptance: serviceReadModel?.surfaces?.readback?.productAcceptance,
    finalMvpAcceptance: serviceReadModel?.surfaces?.readback?.finalMvpAcceptance,
    ownerIntentExecution: ownerTrial?.nonClaims?.ownerIntentExecution,
    liveDispatch: ownerTrial?.nonClaims?.liveDispatch,
    parentGoalCompletion: ownerTrial?.nonClaims?.parentGoalCompletion
  };
}

function inspectSourceContentDigest() {
  const sourcePaths = [
    "apps/api/src/server.ts",
    "apps/api/test/service-smoke.test.mjs",
    "apps/web/src/cockpit.ts",
    "apps/web/src/cockpit-view.ts",
    "apps/web/src/cockpit-ui-react-runtime.ts",
    "apps/web/test/cockpit-view.test.mjs",
    "package.json",
    "packages/db/src/runtime-fixture.ts",
    "packages/db/test/runtime-fixture.test.mjs",
    "scripts/aos-design-system-package-runtime-proof.mjs",
    "scripts/aos-owner-trial-service-backed-frontend-proof.mjs",
    "scripts/service-smoke.mjs"
  ];
  const sourceContentDigest = createHash("sha256")
    .update(sourcePaths.map((sourcePath) => `${sourcePath}\0${readFileSync(join(repoRoot, sourcePath), "utf8")}`).join("\0"))
    .digest("hex");
  return {
    ok: true,
    strategy: "source_content_digest_for_owner_trial_service_browser_receipt",
    sourceHeadAtProofRun: sourceHead,
    exactFinalCommitHeadRequired: false,
    sourceContentDigest,
    sourcePaths
  };
}

function markdownReceipt(summary) {
  const viewportRows = summary.viewportReadbacks
    .map((readback) => `| ${readback.label} | ${readback.apiCallCount} | ${readback.afterRefreshState.refreshCount} | ${readback.searchState.visibleRowCount} | ${readback.zeroMatchState.emptyStateVisible ? "yes" : "no"} | \`${readback.selectedDetailState.detailId}\` | ${readback.closedDetailState.drawerClosed ? "yes" : "no"} | ${readback.documentReadback.bodyHorizontalOverflow ? "yes" : "no"} | \`${readback.screenshot.path}\` |`)
    .join("\n");
  return `# AOS Owner-Trial Service-Backed Frontend Proof

Status: ${summary.ok ? "passed" : "failed"}.

Route: \`${summary.route}\`
AOS source head: \`${summary.sourceHead}\`
Source content digest: \`${summary.sourceFreshnessReadback.sourceContentDigest}\`

## Service API

- schema: \`${summary.apiContract.schemaVersion}\`
- owner-trial schema: \`${summary.apiContract.ownerTrialSchema}\`
- work rows: ${summary.apiContract.workRowCount}
- second-row detail round trip: ${summary.apiContract.secondStoryRoundTrip}
- disabled action reasons: ${summary.apiContract.disabledActionCount}
- product acceptance: ${summary.apiContract.productAcceptance}
- final MVP acceptance: ${summary.apiContract.finalMvpAcceptance}
- Owner Intent execution: ${summary.apiContract.ownerIntentExecution}
- live dispatch: ${summary.apiContract.liveDispatch}
- parent-goal completion: ${summary.apiContract.parentGoalCompletion}

## Browser Readback

| Viewport | API calls | Refresh count | Search visible rows | Zero-match shown | Selected detail | Drawer closed | Body overflow | Screenshot |
| --- | ---: | ---: | ---: | --- | --- | --- | --- | --- |
${viewportRows}

## Boundaries

- product UI acceptance: ${summary.noOverclaim.productUiAcceptance}
- Product Design acceptance: ${summary.noOverclaim.productDesignAcceptance}
- product acceptance: ${summary.noOverclaim.productAcceptance}
- final MVP acceptance: ${summary.noOverclaim.finalMvpAcceptance}
- release/publication readiness: ${summary.noOverclaim.releasePublicationReadiness}
- owner-visible freshness: ${summary.noOverclaim.ownerVisibleFreshness}
- Owner Intent execution: ${summary.noOverclaim.ownerIntentExecution}
- live dispatch: ${summary.noOverclaim.liveDispatch}
- parent goal completion: ${summary.noOverclaim.parentGoalCompletion}
`;
}
