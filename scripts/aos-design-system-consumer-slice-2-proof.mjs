import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { startAosLocalServiceProof } from "../dist/apps/api/src/server.js";
import { aosDesignSystemConsumerBridge } from "../dist/apps/web/src/design-system-bridge.js";

const repoRoot = process.cwd();
const sourceHead = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const route = "route_tcrn_aos_design_system_frontend_rebuild_slice_2_service_read_model_stabilization_implementation";
const evidenceDir = join(repoRoot, "evidence", "aos-design-system-consumer-slice-2-browser", sourceHead);
const summaryPath = join(evidenceDir, "browser-service-read-model-summary.json");
const markdownPath = join(repoRoot, "evidence", "aos-design-system-consumer-slice-2-proof.md");
const viewports = [
  { label: "desktop-1440x900", width: 1440, height: 900 },
  { label: "mobile-390x844", width: 390, height: 844 }
];
const rawVisibleForbidden = [
  "external_proof_required",
  "not_claimed",
  "release_proof_required",
  "owner_intent_required",
  "record_participant_position",
  "open_evidence_metadata"
];
const forbiddenPositiveClaims = [
  "product accepted",
  "final mvp accepted",
  "release ready",
  "deployment ready",
  "public ready",
  "dependency clean",
  "legal complete",
  "live dispatch enabled",
  "resource materialized"
];
const staleDisabledReasonPatterns = [
  "slice 1 checkpoint",
  "slice 1-only",
  "slice one checkpoint"
];

await mkdir(evidenceDir, { recursive: true });

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
  const selectedStoryId = apiPayload.serviceReadModel?.surfaces?.workIndex?.selectedStoryId;
  const selectedPayload = await fetch(`${service.url}/api/cockpit?selectedType=story&selectedId=${encodeURIComponent(selectedStoryId ?? "")}`).then((response) => response.json());
  const apiContract = summarizeApiContract(apiPayload, selectedPayload);

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
    page.on("pageerror", (error) => pageErrors.push(`${viewport.label}: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(`${viewport.label}: ${message.text()}`);
      }
    });
    page.on("requestfailed", (request) => {
      requestFailures.push(`${viewport.label}: ${request.url()} ${request.failure()?.errorText ?? "request_failed"}`);
    });
    await page.goto(`${service.url}/operations-cockpit.html`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction((expectedSchema) => {
      const shell = document.querySelector("[data-surface='operations-cockpit']");
      const status = document.querySelector("[data-service-status]");
      return shell?.getAttribute("data-service-model-schema") === expectedSchema
        && shell?.getAttribute("data-service-read-model-source") === "service_api_read"
        && status?.textContent?.includes("service API read");
    }, apiPayload.serviceReadModel.schemaVersion, { timeout: 5000 });
    const screenshotPath = join(evidenceDir, `${viewport.label}-service-read-model.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    const screenshotBody = await readFile(screenshotPath);
    const readback = await page.evaluate(({ rawVisibleForbidden, forbiddenPositiveClaims, staleDisabledReasonPatterns, expected }) => {
      const shell = document.querySelector("[data-surface='operations-cockpit']");
      const text = document.body.innerText;
      const lower = text.toLowerCase();
      const disabledButtons = Array.from(document.querySelectorAll("button:disabled")).map((button) => {
        const ariaDescription = (button.getAttribute("aria-describedby") ?? "")
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
          .filter(Boolean)
          .join(" ");
        const title = button.getAttribute("title")?.trim() ?? "";
        const dataDisabledReason = button.getAttribute("data-disabled-reason")?.trim() ?? "";
        const reason = [title, ariaDescription, dataDisabledReason].filter(Boolean).join(" | ");
        return {
          text: button.textContent?.trim() ?? "",
          className: button.className,
          title,
          ariaDescription,
          dataDisabledReason,
          reason
        };
      });
      const disabledButtonsMissingReason = disabledButtons.filter((button) => !button.reason);
      const disabledButtonsWithStaleReason = disabledButtons.filter((button) => {
        const reason = `${button.reason} ${button.text}`.toLowerCase();
        return staleDisabledReasonPatterns.some((phrase) => reason.includes(phrase));
      });
      const attrs = {
        schema: shell?.getAttribute("data-service-model-schema") ?? "",
        source: shell?.getAttribute("data-service-read-model-source") ?? "",
        workRowCount: Number(shell?.getAttribute("data-service-work-row-count") ?? "0"),
        selectedStoryId: shell?.getAttribute("data-service-selected-story-id") ?? "",
        detailId: shell?.getAttribute("data-service-detail-id") ?? "",
        detailType: shell?.getAttribute("data-service-detail-type") ?? "",
        gateCount: Number(shell?.getAttribute("data-service-gate-count") ?? "0"),
        evidenceReadbackCount: Number(shell?.getAttribute("data-service-evidence-readback-count") ?? "0"),
        runtimeDataCommitted: shell?.getAttribute("data-service-runtime-data-committed") ?? ""
      };
      const renderedRowCount = document.querySelectorAll("[data-work-row]").length;
      const domMatchesApi = attrs.schema === expected.schemaVersion
        && attrs.source === "service_api_read"
        && attrs.workRowCount === expected.workRowCount
        && renderedRowCount === expected.workRowCount
        && attrs.selectedStoryId === expected.selectedStoryId
        && attrs.detailId === expected.detailId
        && attrs.detailType === expected.detailType
        && attrs.gateCount === expected.gateCount
        && attrs.evidenceReadbackCount === expected.evidenceReadbackCount
        && attrs.runtimeDataCommitted === "false";
      return {
        title: document.title,
        serviceBacked: shell?.getAttribute("data-service-backed"),
        designSystemConsumer: shell?.getAttribute("data-design-system-consumer"),
        tokenPackage: shell?.getAttribute("data-design-system-tokens"),
        copyStatePackage: shell?.getAttribute("data-design-system-copy-state"),
        serviceStatus: document.querySelector("[data-service-status]")?.textContent?.trim() ?? "",
        serviceModelBadge: document.querySelector("[data-service-model-readback]")?.textContent?.trim() ?? "",
        attrs,
        renderedRowCount,
        domMatchesApi,
        rawVisibleCopyHits: rawVisibleForbidden.filter((phrase) => text.includes(phrase)),
        forbiddenPositiveClaimHits: forbiddenPositiveClaims.filter((phrase) => lower.includes(phrase)),
        disabledButtonsMissingReason,
        disabledButtonsWithStaleReason,
        bodyLevelHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth || document.body.scrollWidth > window.innerWidth,
        viewportWidth: window.innerWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        hasUnavailableCopy: text.includes("Unavailable: live dispatch"),
        hasHeldRouteCopy: text.includes("Held for later route")
          || text.includes("package-runtime pilot keeps Cockpit available only")
          || text.includes("held for a later routed AOS slice")
      };
    }, { rawVisibleForbidden, forbiddenPositiveClaims, staleDisabledReasonPatterns, expected: apiContract.expectedDom });
    viewportReadbacks.push({
      ...viewport,
      ...readback,
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
    && viewportReadbacks.every((readback) => readback.serviceBacked === "true")
    && viewportReadbacks.every((readback) => readback.designSystemConsumer === aosDesignSystemConsumerBridge.adoptionPosture)
    && viewportReadbacks.every((readback) => readback.tokenPackage === aosDesignSystemConsumerBridge.tokenPackage)
    && viewportReadbacks.every((readback) => readback.copyStatePackage === aosDesignSystemConsumerBridge.copyStatePackage)
    && viewportReadbacks.every((readback) => readback.domMatchesApi)
    && viewportReadbacks.every((readback) => readback.rawVisibleCopyHits.length === 0)
    && viewportReadbacks.every((readback) => readback.forbiddenPositiveClaimHits.length === 0)
    && viewportReadbacks.every((readback) => readback.disabledButtonsMissingReason.length === 0)
    && viewportReadbacks.every((readback) => readback.disabledButtonsWithStaleReason.length === 0)
    && viewportReadbacks.every((readback) => readback.bodyLevelHorizontalOverflow === false)
    && viewportReadbacks.every((readback) => readback.hasUnavailableCopy)
    && viewportReadbacks.every((readback) => readback.hasHeldRouteCopy)
    && pageErrors.length === 0
    && consoleErrors.length === 0
    && requestFailures.length === 0;

  const summary = {
    ok,
    route,
    sourceHead,
    designSystemSourceHead: aosDesignSystemConsumerBridge.designSystemSourceHead,
    serviceLifecycle: {
      loopbackOnly: true,
      ephemeralPort: true,
      stopped: closed
    },
    apiContract,
    designSystemConsumption: {
      adoptionPosture: aosDesignSystemConsumerBridge.adoptionPosture,
      tokenPackage: aosDesignSystemConsumerBridge.tokenPackage,
      copyStatePackage: aosDesignSystemConsumerBridge.copyStatePackage,
      uiReactPackage: aosDesignSystemConsumerBridge.uiReactPackage
    },
    viewportReadbacks,
    browserHealth: {
      pageErrors,
      consoleErrors,
      requestFailures
    },
    noOverclaim: {
      productAcceptanceReady: false,
      finalMvpAcceptanceReady: false,
      releasePublicationReady: false,
      batchPushGate: false,
      packagePublication: false,
      designSystemMutation: false,
      broadUiReactMigration: false,
      liveDispatch: false,
      ownerIntentExecution: false
    }
  };

  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  await writeFile(markdownPath, markdownReceipt(summary));
  console.log(JSON.stringify({
    ok,
    route,
    sourceHead,
    designSystemSourceHead: summary.designSystemSourceHead,
    serviceLifecycle: summary.serviceLifecycle,
    apiContract: {
      ok: apiContract.ok,
      schemaVersion: apiContract.schemaVersion,
      workRowCount: apiContract.expectedDom.workRowCount,
      selectedStoryId: apiContract.expectedDom.selectedStoryId,
      gateCount: apiContract.expectedDom.gateCount,
      productAcceptance: apiContract.productAcceptance,
      finalMvpAcceptance: apiContract.finalMvpAcceptance
    },
    viewportCount: viewportReadbacks.length,
    screenshots: viewportReadbacks.map((readback) => readback.screenshot),
    domMismatchCount: viewportReadbacks.filter((readback) => !readback.domMatchesApi).length,
    rawVisibleCopyHits: viewportReadbacks.flatMap((readback) => readback.rawVisibleCopyHits),
    forbiddenPositiveClaimHits: viewportReadbacks.flatMap((readback) => readback.forbiddenPositiveClaimHits),
    disabledButtonsMissingReason: viewportReadbacks.flatMap((readback) => readback.disabledButtonsMissingReason),
    disabledButtonsWithStaleReason: viewportReadbacks.flatMap((readback) => readback.disabledButtonsWithStaleReason),
    bodyLevelHorizontalOverflowCount: viewportReadbacks.filter((readback) => readback.bodyLevelHorizontalOverflow).length,
    pageErrorCount: pageErrors.length,
    consoleErrorCount: consoleErrors.length,
    requestFailureCount: requestFailures.length,
    summaryPath: relative(repoRoot, summaryPath),
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

function summarizeApiContract(apiPayload, selectedPayload) {
  const serviceReadModel = apiPayload.serviceReadModel;
  const selectedReadModel = selectedPayload.serviceReadModel;
  const expectedDom = {
    schemaVersion: serviceReadModel?.schemaVersion ?? "",
    workRowCount: serviceReadModel?.surfaces?.workIndex?.rowCount ?? 0,
    selectedStoryId: serviceReadModel?.surfaces?.workIndex?.selectedStoryId ?? "",
    detailId: serviceReadModel?.surfaces?.detail?.selectedId ?? "",
    detailType: serviceReadModel?.surfaces?.detail?.selectedType ?? "",
    gateCount: (serviceReadModel?.surfaces?.gate?.roleGateCount ?? 0) + (serviceReadModel?.surfaces?.gate?.ownerIntentGateCount ?? 0),
    evidenceReadbackCount: serviceReadModel?.surfaces?.readback?.evidenceReadbackCount ?? 0
  };
  const ok = apiPayload.ok === true
    && apiPayload.serviceBacked === true
    && serviceReadModel?.schemaVersion === "aos.cockpit.service_read_model.v1"
    && serviceReadModel?.slice === "slice_2_service_read_model_stabilization"
    && serviceReadModel?.source === "service_api_read"
    && expectedDom.workRowCount === apiPayload.model?.workstreams?.flatMap((group) => group.rows)?.length
    && expectedDom.selectedStoryId === apiPayload.model?.detailPanel?.selectedId
    && selectedReadModel?.surfaces?.detail?.selectedId === expectedDom.selectedStoryId
    && serviceReadModel?.surfaces?.gate?.autoExecutableCount === 0
    && serviceReadModel?.surfaces?.readback?.productAcceptance === false
    && serviceReadModel?.surfaces?.readback?.finalMvpAcceptance === false
    && serviceReadModel?.noClaims?.broadUiReactMigration === false
    && apiPayload.boundaries?.productAcceptance === false
    && apiPayload.boundaries?.finalMvpAcceptance === false;
  return {
    ok,
    schemaVersion: serviceReadModel?.schemaVersion ?? "",
    expectedDom,
    selectedDetailRoundTrip: selectedReadModel?.surfaces?.detail?.selectedId === expectedDom.selectedStoryId,
    productAcceptance: serviceReadModel?.surfaces?.readback?.productAcceptance,
    finalMvpAcceptance: serviceReadModel?.surfaces?.readback?.finalMvpAcceptance,
    broadUiReactMigration: serviceReadModel?.noClaims?.broadUiReactMigration,
    runtimeDataCommittedToGit: serviceReadModel?.surfaces?.readback?.runtimeDataCommittedToGit
  };
}

function markdownReceipt(summary) {
  const screenshotRows = summary.viewportReadbacks
    .map((readback) => `| ${readback.label} | \`${readback.screenshot.path}\` | \`${readback.screenshot.sha256}\` | ${readback.domMatchesApi ? "yes" : "no"} | ${readback.rawVisibleCopyHits.length} | ${readback.forbiddenPositiveClaimHits.length} | ${readback.disabledButtonsMissingReason.length} | ${readback.disabledButtonsWithStaleReason.length} | ${readback.bodyLevelHorizontalOverflow ? "yes" : "no"} |`)
    .join("\n");
  return `# AOS Design System Consumer Slice 2 Service Read-Model Proof

Status: ${summary.ok ? "passed" : "failed"}.

Route: \`${summary.route}\`
AOS source head: \`${summary.sourceHead}\`
Design System source basis: \`${summary.designSystemSourceHead}\`

## Service Contract Readback

- schema: \`${summary.apiContract.schemaVersion}\`
- work rows: ${summary.apiContract.expectedDom.workRowCount}
- selected story: \`${summary.apiContract.expectedDom.selectedStoryId}\`
- gate count: ${summary.apiContract.expectedDom.gateCount}
- selected detail round trip: ${summary.apiContract.selectedDetailRoundTrip}
- product acceptance: ${summary.apiContract.productAcceptance}
- final MVP acceptance: ${summary.apiContract.finalMvpAcceptance}
- broad ui-react migration: ${summary.apiContract.broadUiReactMigration}
- runtime data committed to Git: ${summary.apiContract.runtimeDataCommittedToGit}

## Consumption Readback

- token package: \`${summary.designSystemConsumption.tokenPackage}\`
- copy-state package: \`${summary.designSystemConsumption.copyStatePackage}\`
- adoption posture: \`${summary.designSystemConsumption.adoptionPosture}\`
- ui-react posture: \`${summary.designSystemConsumption.uiReactPackage}\`
- service lifecycle: loopback-only, ephemeral, stopped=${summary.serviceLifecycle.stopped}

## Browser Evidence

| Viewport | Screenshot | SHA-256 | DOM matches API | Raw visible copy hits | Forbidden claim hits | Disabled controls missing reason | Stale disabled reason hits | Body overflow |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |
${screenshotRows}

## No-Overclaim Boundaries

No Design System source mutation, Storybook mutation, package publication, AOS/TMS product acceptance, final MVP acceptance, release/publication, Batch Push Gate, broad ui-react migration, live dispatch, Owner Intent execution, registry/generated bridge mutation, or terminal-return ingestion is claimed by this receipt.
`;
}
